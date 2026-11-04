#!/usr/bin/env node
/**
 * 宿主探活：只做 initialize +（可选）session/new + session/list (+ 可选 prompt)。
 * 用于 ENV-1 / ENV-3 的环境指纹与能力矩阵，不依赖 LLM 凭据即可拿到能力广告。
 *
 *   node bin/probe-host.mjs --host=dsh-real --run=env1/dsh
 *   node bin/probe-host.mjs --host=dsh-real --run=env1/dsh --prompt="你好"
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

const hostName = argv.host;
const runId = argv.run ?? `probe/${hostName}-${Date.now()}`;
const runDir = path.resolve(WORKSPACE, '.orch-spike/runs', runId);
fs.mkdirSync(runDir, { recursive: true });

const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${hostName}.json`), 'utf8'));
const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: argv['session-id'] ?? `probe-${Date.now()}` });

const out = { host: hostName, runId, represents: host.represents, evidence: host.evidence ?? 'real', steps: [] };
let code = 0;

const { transport, stop } = await createTransport(host, { recorder: null });
const recorder = new FrameRecorder({ dir: runDir, runId, transport: transport.kind });
transport.recorder = recorder;

try {
  const t0 = Date.now();
  await transport.connect();
  out.connectMs = Date.now() - t0;
  out.steps.push({ step: 'connect', ok: true, ms: out.connectMs });

  const client = new AcpClient(transport, { recorder });
  const caps = await client.initialize({ name: 'maestro-probe', version: '0.1.0' });
  out.capabilities = caps;
  out.steps.push({ step: 'initialize', ok: true, capabilities: caps });

  const cwd = path.join(runDir, 'sessions', 'p1');
  fs.mkdirSync(cwd, { recursive: true });
  const session = await client.newSession(cwd, []);
  out.steps.push({ step: 'session/new', ok: true, sessionId: session.id });

  if (caps.resume || caps.loadSession) {
    try {
      const restored = await client.resumeOrCreate({ sessionId: session.id, cwd });
      out.steps.push({ step: 'resumeOrCreate(existing)', ok: true, restored: restored.restored, keys: Object.keys(restored) });
    } catch (err) {
      out.steps.push({ step: 'resumeOrCreate(existing)', ok: false, error: { code: err.code, message: err.message } });
    }
  }

  try {
    const list = await client.listSessions();
    out.steps.push({ step: 'session/list', ok: true, count: list.sessions?.length ?? null });
  } catch (err) {
    out.steps.push({ step: 'session/list', ok: false, error: { code: err.code, message: err.message } });
  }

  if (argv.prompt) {
    const updates = [];
    client.onUpdate((u) => updates.push({ sessionUpdate: u.sessionUpdate, text: u.content?.text?.slice(0, 200) }));
    try {
      const r = await client.prompt(session.id, argv.prompt, { timeoutMs: Number(argv['prompt-timeout'] ?? 180000) });
      out.steps.push({ step: 'session/prompt', ok: true, stopReason: r.stopReason, updates: updates.length });
    } catch (err) {
      out.steps.push({ step: 'session/prompt', ok: false, error: { code: err.code, message: err.message }, updates: updates.length });
    }
    out.updateSample = updates.slice(0, 20);
  }

  await client.close();
  out.ok = true;
} catch (err) {
  code = 1;
  out.ok = false;
  out.error = { code: err.code ?? null, message: err.message };
  if (recorder.stderrTail) out.stderrTail = recorder.stderrTail;
} finally {
  out.frames = recorder.file;
  writeJson(path.join(runDir, 'probe.json'), out);
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  try {
    await stop();
  } catch {
    /* ignore */
  }
  recorder.close();
  await stopAllServers();
  process.exit(code);
}
