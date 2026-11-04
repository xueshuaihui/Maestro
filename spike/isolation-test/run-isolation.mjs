#!/usr/bin/env node
/**
 * VP-3 并发隔离测试（五维：cwd / 工具调用 / 权限请求 / cancel / close）
 *
 *   node run-isolation.mjs --host=mock-stdio --sessions=5 --connections=single
 *   node run-isolation.mjs --host=mock-http  --sessions=3 --connections=single
 *
 * 同一份测试可直接指向真实宿主（--host=dsh-real），仅换 host 配置。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../acp-harness/src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../acp-harness/src/recorder.mjs';
import { AcpClient } from '../acp-harness/src/client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '..');
const WORKSPACE = path.resolve(SPIKE, '..');

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=')[1] : d;
};

const HOST = arg('host', 'mock-stdio');
const N = Number(arg('sessions', '3'));
const PERMISSION_MODE = arg('permission', 'auto');
const TURN_DELAY = Number(arg('turn-delay', '300'));
const RUN_ID = arg('run', `${HOST}-${N}s-${PERMISSION_MODE}-${Date.now()}`);
const RUN_DIR = path.resolve(WORKSPACE, '.orch-spike/runs/vp3', RUN_ID);

if (HOST.startsWith('mock-')) {
  process.env.MOCK_DIALECT = arg('dialect', 'resume-no-replay');
  process.env.MOCK_PERMISSION = PERMISSION_MODE;
  process.env.MOCK_TURN_DELAY = String(TURN_DELAY);
}

/** mock 场景允许用环境变量覆盖参数；真实宿主忽略这些 */
function hostConfig(name, overrides = {}) {
  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${name}.json`), 'utf8'));
  const vars = { SPIKE, WORKSPACE, RUN_DIR, SESSION_ID: `iso-${RUN_ID}` };
  const cfg = loadHostConfig(raw, vars);
  if (raw.evidence === 'mock') {
    const extra = [
      `--dialect=${overrides.dialect ?? process.env.MOCK_DIALECT}`,
      `--permission=${overrides.permission ?? process.env.MOCK_PERMISSION}`,
      `--turn-delay-ms=${overrides.turnDelay ?? process.env.MOCK_TURN_DELAY}`,
    ];
    cfg.args = [...(cfg.args ?? []), ...extra];
    if (cfg.spawn) cfg.spawn.args = [...cfg.spawn.args, ...extra];
  }
  return cfg;
}

let recorderSeq = 0;
async function open({ overrides = {}, tag = 'main' } = {}) {
  const cfg = hostConfig(HOST, overrides);
  const { transport, stop } = await createTransport(cfg, { recorder: null });
  const recorder = new FrameRecorder({ dir: RUN_DIR, runId: RUN_ID, transport: `${transport.kind}-${tag}-${++recorderSeq}` });
  transport.recorder = recorder;
  await transport.connect();
  const client = new AcpClient(transport, { recorder });
  await client.initialize({ name: 'maestro-iso', version: '0.1.0' });
  return { client, transport, recorder, stop };
}

function sessionDir(name) {
  const dir = path.join(RUN_DIR, 'workspaces', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function scanCrossTalk(sessions) {
  const issues = [];
  for (const s of sessions) {
    const files = fs.readdirSync(s.cwd).filter((f) => f.startsWith('marker-'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(s.cwd, f), 'utf8').trim();
      if (content !== s.id) issues.push({ kind: 'content-mismatch', dir: s.cwd, file: f, content, expected: s.id });
      const owner = f.replace(/^marker-/, '').replace(/\.txt$/, '');
      if (owner !== s.id) issues.push({ kind: 'foreign-file', dir: s.cwd, file: f, expectedOwner: s.id });
    }
  }
  return issues;
}

const report = { runId: RUN_ID, host: HOST, sessions: N, permissionMode: PERMISSION_MODE, turnDelay: TURN_DELAY, phases: {} };

// ---------------- Phase A：并发写入 + cwd 隔离 ----------------
{
  const { client, stop, recorder } = await open({ tag: 'A' });
  const sessions = [];
  for (let i = 0; i < N; i++) {
    const cwd = sessionDir(`A-${i + 1}`);
    const s = await client.newSession(cwd, []);
    sessions.push({ ...s, cwd, tag: `A-${i + 1}` });
  }

  const updates = new Map(sessions.map((s) => [s.id, []]));
  client.onUpdate((u, sid) => updates.get(sid)?.push(u));

  const t0 = Date.now();
  const results = await Promise.all(
    sessions.map(async (s) => {
      const r = await client.prompt(s.id, `并行任务 ${s.tag}：写入本会话独立产物`);
      return { id: s.id, tag: s.tag, stopReason: r.stopReason };
    }),
  );
  const elapsed = Date.now() - t0;

  const crosstalk = scanCrossTalk(sessions);
  report.phases.A = {
    sessions: sessions.length,
    concurrency: 'single-connection',
    elapsedMs: elapsed,
    stopReasons: results,
    crosstalk,
    perSessionUpdateCounts: Object.fromEntries([...updates].map(([k, v]) => [k, v.length])),
    frames: recorder.file,
  };

  await client.close();
  await stop();
  recorder.close();
}

// ---------------- Phase B：cancel 只影响目标会话 ----------------
{
  const { client, stop, recorder } = await open({ tag: 'B', overrides: { turnDelay: 800 } });
  const sessions = [];
  for (let i = 0; i < Math.min(3, N); i++) {
    const cwd = sessionDir(`B-${i + 1}`);
    sessions.push({ ...(await client.newSession(cwd, [])), cwd, tag: `B-${i + 1}` });
  }

  const resolvedAt = {};
  const promises = sessions.map(async (s) => {
    try {
      const r = await client.prompt(s.id, `长任务 ${s.tag}`);
      resolvedAt[s.id] = Date.now();
      return { tag: s.tag, id: s.id, stopReason: r.stopReason };
    } catch (err) {
      resolvedAt[s.id] = Date.now();
      return { tag: s.tag, id: s.id, error: { code: err.code, message: err.message } };
    }
  });

  await new Promise((r) => setTimeout(r, 250));
  const target = sessions[0];
  const cancelAt = Date.now();
  await client.cancel(target.id);
  const outcomes = await Promise.all(promises);
  const settleAt = Date.now();

  report.phases.B = {
    cancelTarget: target.id,
    outcomes,
    cancelIsolated: outcomes.filter((o) => o.id !== target.id).every((o) => o.stopReason === 'end_turn'),
    targetStopped: outcomes.find((o) => o.id === target.id)?.stopReason === 'cancelled',
    // 目标会话响应 cancel 的时延 vs 其余会话自然跑完的时延
    targetCancelLatencyMs: resolvedAt[target.id] - cancelAt,
    othersSettleMs: settleAt - cancelAt,
    frames: recorder.file,
  };

  await client.close();
  await stop();
  recorder.close();
}

// ---------------- Phase C：close 只释放目标会话 ----------------
{
  const { client, stop, recorder } = await open({ tag: 'C' });
  const a = { ...(await client.newSession(sessionDir('C-1'), [])), cwd: sessionDir('C-1') };
  const b = { ...(await client.newSession(sessionDir('C-2'), [])), cwd: sessionDir('C-2') };

  let closeError = null;
  let closeSupported = true;
  try {
    await client.closeSession(a.id);
  } catch (err) {
    closeSupported = false;
    closeError = { code: err.code, message: err.message };
  }

  const afterB = await client.prompt(b.id, '关闭 A 之后 B 仍应可用');
  let promptClosed = null;
  try {
    await client.prompt(a.id, '已关闭会话不应可写');
  } catch (err) {
    promptClosed = { code: err.code, message: err.message };
  }

  report.phases.C = {
    closeSupported,
    closeError,
    survivorStopReason: afterB.stopReason,
    closedSessionError: promptClosed,
    closeIsolated: closeSupported ? afterB.stopReason === 'end_turn' && !!promptClosed : null,
    frames: recorder.file,
  };

  await client.close();
  await stop();
  recorder.close();
}

// ---------------- Phase D：权限请求只作用于本会话 ----------------
{
  const { client, stop, recorder } = await open({ tag: 'D', overrides: { permission: 'ask' } });
  const decisions = new Map();

  client.onClientRequest = async (method, params) => {
    if (method !== 'session/request_permission') return {};
    const sid = params.sessionId;
    const plan = decisions.get(sid) ?? { outcome: { outcome: 'cancelled' } };
    report.phases.D ??= { requests: [] };
    report.phases.D.requests.push({ sessionId: sid, toolCallId: params.toolCall?.toolCallId, answered: plan.outcome });
    return plan;
  };

  const allow = { ...(await client.newSession(sessionDir('D-allow'), [])), cwd: sessionDir('D-allow') };
  const reject = { ...(await client.newSession(sessionDir('D-reject'), [])), cwd: sessionDir('D-reject') };
  const bogus = { ...(await client.newSession(sessionDir('D-bogus'), [])), cwd: sessionDir('D-bogus') };

  decisions.set(allow.id, { outcome: { outcome: 'selected', optionId: 'allow-once' } });
  decisions.set(reject.id, { outcome: { outcome: 'selected', optionId: 'reject-once' } });
  // 负面用例：optionId 不在本次 options 里，按 ACP 规范不得视为批准
  decisions.set(bogus.id, { outcome: { outcome: 'selected', optionId: 'allow-always' } });

  const outcomes = await Promise.all(
    [allow, reject, bogus].map(async (s) => {
      const r = await client.prompt(s.id, `权限用例 ${path.basename(s.cwd)}`);
      const files = fs.readdirSync(s.cwd).filter((f) => f.startsWith('marker-'));
      return { sessionId: s.id, cwd: s.cwd, stopReason: r.stopReason, files };
    }),
  );

  const [aOut, rOut, bOut] = outcomes;
  report.phases.D = {
    ...report.phases.D,
    outcomes,
    permissionIsolated:
      aOut.stopReason === 'end_turn' && aOut.files.length === 1 &&
      rOut.stopReason === 'refusal' && rOut.files.length === 0 &&
      bOut.stopReason === 'refusal' && bOut.files.length === 0,
    frames: recorder.file,
  };

  await client.close();
  await stop();
  recorder.close();
}

fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));
writeJson(path.join(RUN_DIR, 'result.json'), {
  runId: RUN_ID,
  host: HOST,
  summary: {
    A_concurrentIsolation: (report.phases.A?.crosstalk ?? []).length === 0,
    B_cancelIsolated: report.phases.B?.cancelIsolated && report.phases.B?.targetStopped,
    C_closeIsolated: report.phases.C?.closeIsolated,
    D_permissionIsolated: report.phases.D?.permissionIsolated,
  },
});
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
await stopAllServers();
process.exit(0);
