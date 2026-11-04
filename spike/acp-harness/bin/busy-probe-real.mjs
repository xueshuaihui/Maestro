#!/usr/bin/env node
/**
 * 补充探针：真实 DSH 上「目标会话忙时再投递」的实际行为。
 * mock LLM 单轮极快（~70ms），必须在同一 tick 内背靠背发起，才能撞上活跃 turn。
 *
 *   node bin/busy-probe-real.mjs --host=dsh-real --rounds=5
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
const rounds = Number(argv.rounds ?? 5);
const runDir = path.join(WORKSPACE, '.orch-spike/runs/vp7', `busy-real-${hostName}`);
fs.mkdirSync(runDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `busy-${Date.now()}` });

const out = { host: hostName, rounds: [], at: new Date().toISOString() };
const { transport, stop } = await createTransport(host, { recorder: null });
const recorder = new FrameRecorder({ dir: runDir, runId: 'vp7-busy', transport: transport.kind });
transport.recorder = recorder;

try {
  await transport.connect();
  const client = new AcpClient(transport, { recorder });
  await client.initialize({ name: 'vp7-busy', version: '0.1.0' });
  const cwd = path.join(runDir, 'cwd');
  fs.mkdirSync(cwd, { recursive: true });
  const session = await client.newSession(cwd, []);

  for (let i = 1; i <= rounds; i += 1) {
    const t0 = Date.now();
    const p1 = client.prompt(session.id, `任务 A-${i}`, { timeoutMs: 60_000 }).then(
      (r) => ({ ok: true, stopReason: r.stopReason, ms: Date.now() - t0 }),
      (e) => ({ ok: false, code: e.code ?? null, message: e.message, ms: Date.now() - t0 }),
    );
    // 不等待：同一 tick 立刻发第二个，尽量撞上活跃 turn
    const t1 = Date.now();
    const p2 = client.prompt(session.id, `任务 B-${i}`, { timeoutMs: 60_000 }).then(
      (r) => ({ ok: true, stopReason: r.stopReason, ms: Date.now() - t1 }),
      (e) => ({ ok: false, code: e.code ?? null, message: e.message, ms: Date.now() - t1 }),
    );
    out.rounds.push({ round: i, first: await p1, second: await p2 });
  }
  out.ok = true;
} catch (err) {
  out.ok = false;
  out.error = { code: err.code ?? null, message: err.message };
} finally {
  out.cliCapabilities = null;
  writeJson(path.join(runDir, 'busy-probe.json'), out);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  await stop().catch(() => {});
  recorder.close();
  await stopAllServers();
}
