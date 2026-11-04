#!/usr/bin/env node
/**
 * VP-2 实验：会话恢复方言能否在适配器层统一为 resumeOrCreate。
 *
 * 三个方言场景，各自跑「建会话 → prompt → 断连 → 重连 → 恢复 → prompt」：
 *   resume-no-replay   DSH 形态（resume 不回放 / load 回放）
 *   load-only          WorkBuddy 形态（只有 load，回放追加）
 *   none               都不支持 → 必须回退到 new
 *
 * 判定关键：核心只拿到 Session { id, cwd, restored }，看不到 replayMode；
 *          回放条数只出现在适配器日志与原始帧里。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const RUNS = path.resolve(WORKSPACE, '.orch-spike/runs/vp2');

const SCENARIOS = [
  { name: 'resume-no-replay', kind: 'stdio', dialect: 'resume-no-replay' },
  { name: 'load-only', kind: 'http-sse', dialect: 'load-only' },
  { name: 'none-fallback', kind: 'stdio', dialect: 'none' },
];

function makeHost({ kind, dialect, stateFile }) {
  if (kind === 'stdio') {
    return {
      name: `mock-${dialect}`,
      kind: 'stdio',
      command: 'node',
      args: [path.join(SPIKE, 'mock-acp-server/stdio-agent.mjs'), `--dialect=${dialect}`, `--state-file=${stateFile}`],
      cwd: WORKSPACE,
    };
  }
  return {
    name: `mock-${dialect}`,
    kind: 'http-sse',
    spawn: {
      command: 'node',
      args: [path.join(SPIKE, 'mock-acp-server/http-sse-server.mjs'), `--dialect=${dialect}`, `--state-file=${stateFile}`, '--port=0'],
      cwd: WORKSPACE,
    },
  };
}

async function phase({ kind, dialect, stateFile, runDir, phaseName }) {
  const host = makeHost({ kind, dialect, stateFile });
  const { transport, stop } = await createTransport(host, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId: `vp2/${path.basename(runDir)}`, transport: `${transport.kind}-${phaseName}` });
  transport.recorder = recorder;
  await transport.connect();
  const client = new AcpClient(transport, { recorder });
  await client.initialize({ name: 'maestro-probe', version: '0.1.0' });
  return { client, transport, recorder, stop };
}

async function runScenario(sc) {
  const runDir = path.join(RUNS, sc.name);
  fs.mkdirSync(runDir, { recursive: true });
  const stateFile = path.join(runDir, 'agent-state.json');
  const cwd = path.join(runDir, 'workspace');
  fs.mkdirSync(cwd, { recursive: true });

  const observations = { scenario: sc, steps: [] };

  // ---- 阶段一：建会话 + 首次 prompt ----
  const p1 = await phase({ ...sc, stateFile, runDir, phaseName: 'p1' });
  const session1 = await p1.client.newSession(cwd, []);
  const turn1Updates = [];
  const off1 = p1.client.onUpdate((u) => turn1Updates.push(u.sessionUpdate));
  const turn1 = await p1.client.prompt(session1.id, 'FIRST: 产出初稿');
  off1();
  observations.steps.push({
    step: 'p1.prompt',
    sessionId: session1.id,
    stopReason: turn1.stopReason,
    updateTypes: turn1Updates,
  });
  const caps1 = p1.client.capabilities;
  await p1.client.close();
  await p1.stop();
  p1.recorder.close();

  // ---- 阶段二：重连 + 恢复 + 再次 prompt ----
  const p2 = await phase({ ...sc, stateFile, runDir, phaseName: 'p2' });
  const replay = [];
  const offReplay = p2.client.onUpdate((u) => replay.push(u.sessionUpdate));

  const before = Date.now();
  const restoredSession = await p2.client.resumeOrCreate({ sessionId: session1.id, cwd });
  const restoreMs = Date.now() - before;
  offReplay();

  const turn2Updates = [];
  const off2 = p2.client.onUpdate((u) => turn2Updates.push(u.sessionUpdate));
  const turn2 = await p2.client.prompt(restoredSession.id, 'SECOND: 在初稿基础上继续');
  off2();

  const markerFiles = fs.readdirSync(cwd).filter((f) => f.startsWith('marker-'));
  observations.capabilities = caps1;
  observations.restore = {
    restored: restoredSession.restored,
    sameSessionId: restoredSession.id === session1.id,
    replayUpdates: replay.length,
    replayTypes: replay,
    restoreMs,
    returnedSessionKeys: Object.keys(restoredSession).sort(),
  };
  observations.steps.push({
    step: 'p2.prompt',
    stopReason: turn2.stopReason,
    updateTypes: turn2Updates,
  });
  observations.artifacts = { markerFileCount: markerFiles.length, markerFiles };
  observations.verdict = {
    dialectUnifiedInAdapter: !('replayMode' in restoredSession) && !('resolveMethod' in restoredSession),
    contextRestored: restoredSession.restored,
    // 只有在「恢复成功且同一会话」时，产物多于 1 份才说明回放/继续导致了重复落盘
    duplicateArtifact: restoredSession.restored && markerFiles.length > 1,
  };

  await p2.client.close();
  await p2.stop();
  p2.recorder.close();

  writeJson(path.join(runDir, 'observation.json'), observations);
  return observations;
}

const results = [];
for (const sc of SCENARIOS) {
  try {
    results.push(await runScenario(sc));
  } catch (err) {
    results.push({ scenario: sc, error: { message: err.message, code: err.code ?? null } });
  }
}
writeJson(path.join(RUNS, 'summary.json'), results);
process.stdout.write(JSON.stringify(results, null, 2) + '\n');
await stopAllServers();
process.exit(0);
