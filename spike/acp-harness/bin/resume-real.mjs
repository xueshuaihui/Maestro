#!/usr/bin/env node
/**
 * VP-2（真实宿主）：真 DSH 上「断连 → 重连 → 恢复 → 继续」。
 * DSH 广告 sessionCapabilities.resume（不回放）与 loadSession（回放），
 * 因此这里能直接观测到两种方言在真实宿主上的行为差异。
 *
 *   node bin/resume-real.mjs --host=dsh-real
 *   node bin/resume-real.mjs --host=dsh-http
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?([\s\S]*)$/);
    return [m[1], m[2] || 'true'];
  }),
);
const hostName = argv.host ?? 'dsh-real';
const runId = argv.run ?? `vp2-real/${hostName}`;
const runDir = path.resolve(WORKSPACE, '.orch-spike/runs', runId);
const cwd = path.join(runDir, 'workspace');
fs.mkdirSync(cwd, { recursive: true });

let seq = 0;
async function open(phaseName) {
  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
  const cfg = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp2r-${Date.now()}` });
  const { transport, stop } = await createTransport(cfg, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId, transport: `${transport.kind}-${phaseName}-${++seq}` });
  transport.recorder = recorder;
  await transport.connect();
  const client = new AcpClient(transport, { recorder });
  const caps = await client.initialize({ name: 'maestro-probe', version: '0.1.0' });
  return { client, caps, stop, recorder };
}

const out = { host: hostName, runId, steps: {} };

// 阶段一
const p1 = await open('p1');
const s1 = await p1.client.newSession(cwd, []);
const t1 = await p1.client.prompt(s1.id, '请回复一句话');
out.steps.turn1 = { sessionId: s1.id, stopReason: t1.stopReason };
out.capabilities = p1.caps;
await p1.client.close();
await p1.stop();
p1.recorder.close();

// 阶段二：重连 + 恢复
const p2 = await open('p2');
const replay = [];
const off = p2.client.onUpdate((u) => replay.push(u.sessionUpdate));
const t0 = Date.now();
let restored = null;
let resumeError = null;
try {
  restored = await p2.client.resumeOrCreate({ sessionId: s1.id, cwd });
} catch (err) {
  resumeError = { code: err.code, message: err.message };
}
const restoreMs = Date.now() - t0;
off();

let turn2 = null;
if (restored) {
  turn2 = await p2.client.prompt(restored.id, '继续').catch((err) => ({ stopReason: `error:${err.code}:${err.message}` }));
}

out.steps.restore = {
  restored: restored?.restored ?? false,
  sameSessionId: restored?.id === s1.id,
  replayUpdates: replay.length,
  replayTypes: replay,
  restoreMs,
  returnedKeys: restored ? Object.keys(restored) : null,
  error: resumeError,
};
out.steps.turn2 = turn2 ? { stopReason: turn2.stopReason } : null;
out.verdict = {
  adapterReturnsNeutralSession: restored ? !('replayMode' in restored) && !('resolveMethod' in restored) : null,
  contextRestored: restored?.restored ?? false,
  continuedAfterRestore: turn2?.stopReason === 'end_turn',
};
out.frames = p2.recorder.file;

writeJson(path.join(runDir, 'observation.json'), out);
process.stdout.write(JSON.stringify(out, null, 2) + '\n');

await p2.client.close();
await p2.stop();
p2.recorder.close();
await stopAllServers();
process.exit(0);
