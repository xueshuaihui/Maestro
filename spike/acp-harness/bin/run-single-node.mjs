#!/usr/bin/env node
/**
 * 单节点探针：切换 --host 即可换宿主，核心代码与编排循环不变。
 *
 *   node bin/run-single-node.mjs --host=mock-stdio --run=vp1/mock-stdio --prompt="写一个 hello"
 *
 * 产出：.orch-spike/runs/<run>/<transport>.jsonl（原始帧）+ result.json（结构化结论）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';
import { runSingleNode } from '../core/orchestration-loop.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?([\s\S]*)$/);
    return [m[1], m[2] || 'true'];
  }),
);

const hostName = argv.host ?? 'mock-stdio';
const runId = argv.run ?? `adhoc-${Date.now()}`;
const prompt = argv.prompt ?? 'ARTIFACT: 写一份 200 字的产品说明，输出到 artifacts/docs/draft.md';
const runDir = path.resolve(WORKSPACE, '.orch-spike/runs', runId);
const sessionCwd = path.join(runDir, 'sessions', 'node-1');
fs.mkdirSync(sessionCwd, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
const vars = { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: argv['session-id'] ?? 'default' };
const host = loadHostConfig(raw, vars);

const { transport, stop } = await createTransport(host, { recorder: null });
const recorder = new FrameRecorder({ dir: runDir, runId, transport: transport.kind });
transport.recorder = recorder;

const logger = (m) => {
  if (argv.verbose) process.stderr.write(`[client] ${m}\n`);
};

let exitCode = 0;
try {
  await transport.connect();
  const client = new AcpClient(transport, { recorder, logger });
  const result = await runSingleNode(client, {
    cwd: sessionCwd,
    prompt,
    sessionId: argv['reuse-session'] ?? null,
  });

  const summary = {
    runId,
    host: host.name,
    represents: host.represents ?? null,
    evidence: host.evidence ?? 'real',
    transportKind: transport.kind,
    sessionId: result.sessionId,
    restored: result.restored,
    nodeStatus: result.nodeStatus,
    stopReason: result.stopReason,
    error: result.error,
    updateCount: result.updateCount,
    elapsedMs: result.elapsedMs,
    capabilities: result.capabilities,
    frameCounts: recorder.counts,
    sessionCwd,
    frameFile: recorder.file,
  };
  writeJson(path.join(runDir, 'result.json'), summary);
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} catch (err) {
  exitCode = 1;
  const blocked = {
    runId,
    host: host.name,
    evidence: host.evidence ?? 'real',
    transportKind: transport?.kind ?? host.kind,
    blocked: true,
    error: { code: err.code ?? null, message: err.message },
    hint: `宿主 ${host.command ?? host.kind} 不可用；记录为阻塞项，不改结论口径`,
  };
  writeJson(path.join(runDir, 'result.json'), blocked);
  process.stdout.write(JSON.stringify(blocked, null, 2) + '\n');
} finally {
  try {
    await stop();
  } catch {
    /* ignore */
  }
  recorder.close();
  await stopAllServers();
  process.exit(exitCode);
}
