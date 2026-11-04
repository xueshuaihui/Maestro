#!/usr/bin/env node
/**
 * VP-7 · 交接包状态推导（→ docs/index.md §3.4 的 7 个状态）
 *
 * 核心问题：ACP 只有 `session/prompt`（阻塞到 turn 结束）与 `session/update`（流式），
 * 没有「目标已接受」这一语义。本实验量化 accepted / consumed 的**可推导性**与**歧义窗口**。
 *
 *   node bin/handoff-experiment.mjs
 *   node bin/handoff-experiment.mjs --real=dsh-real
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';
import { createHandoffTracker, HANDOFF_STATE } from '../src/normalize/handoff-state.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const RUN_DIR = path.join(WORKSPACE, '.orch-spike/runs/vp7');
fs.mkdirSync(RUN_DIR, { recursive: true });

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?([\s\S]*)$/);
    return [m[1], m[2] || 'true'];
  }),
);

const out = { experiment: 'VP-7 handoff-state-derivation', at: new Date().toISOString(), scenarios: [], real: null };

function mockHost(extraArgs = [], name = 'mock') {
  return {
    kind: 'stdio',
    name,
    represents: 'mock',
    evidence: 'mock',
    command: process.execPath,
    args: [path.join(SPIKE, 'mock-acp-server/stdio-agent.mjs'), '--dialect=load-only', ...extraArgs],
    cwd: WORKSPACE,
  };
}

async function withClient(hostConfig, runId, fn) {
  const runDir = path.join(RUN_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const { transport, stop } = await createTransport(hostConfig, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId: 'vp7', transport: transport.kind });
  transport.recorder = recorder;
  try {
    await transport.connect();
    const client = new AcpClient(transport, { recorder });
    await client.initialize({ name: 'vp7', version: '0.1.0' });
    const cwd = path.join(runDir, 'cwd');
    fs.mkdirSync(cwd, { recursive: true });
    return await fn({ client, cwd, runDir });
  } finally {
    await stop().catch(() => {});
    recorder.close();
  }
}

/** 单场景：投递一次交接 → 跟踪 accepted → 结束 */
async function runScenario({ id, extraArgs, prompt = '写一份说明', ttlMs = 30_000, acceptPolicy = 'turn-event', tickAtMs = null, cancelAtMs = null, doublePrompt = false }) {
  return withClient(mockHost(extraArgs, id), id, async ({ client, cwd }) => {
    const tracker = createHandoffTracker({ ttlMs, acceptPolicy });
    const session = await client.newSession(cwd, []);
    client.onUpdate((u) => tracker.observeUpdate(handoffId, u));

    const handoffId = tracker.create({ to: session.id });
    const t0 = Date.now();
    tracker.delivered(handoffId);

    const results = { id, ttlMs, acceptPolicy };
    try {
      const p1 = client.prompt(session.id, prompt, { timeoutMs: 120_000 });
      if (cancelAtMs != null) {
        await new Promise((r) => setTimeout(r, cancelAtMs));
        await client.cancel(session.id);
      }
      if (tickAtMs != null) {
        await new Promise((r) => setTimeout(r, tickAtMs));
        tracker.tick();
        results.stateAtTick = tracker.get(handoffId).state;
      }
      if (doublePrompt) {
        // 目标忙时再次投递：ACP 不允许同会话并发 turn，看宿主怎么回应
        try {
          const second = await client.prompt(session.id, '第二个任务（忙时投递）', { timeoutMs: 30_000 });
          results.secondPrompt = { ok: true, stopReason: second.stopReason, ms: Date.now() - t0 };
        } catch (err) {
          results.secondPrompt = { ok: false, code: err.code ?? null, message: err.message, ms: Date.now() - t0 };
        }
      }
      const r = await p1;
      tracker.settle(handoffId, { stopReason: r.stopReason });
      results.stopReason = r.stopReason;
    } catch (err) {
      tracker.settle(handoffId, { error: { code: err.code ?? null, message: err.message } });
      results.error = { code: err.code ?? null, message: err.message };
    }

    const snap = tracker.get(handoffId);
    Object.assign(results, {
      finalState: snap.state,
      ambiguityWindowMs: snap.ambiguityWindowMs,
      totalMs: snap.totalMs,
      noiseCount: snap.noiseCount,
      transitions: snap.transitions.map((t) => `${t.state}(${t.evidence})`),
      wallMs: Date.now() - t0,
    });
    return results;
  });
}

const mark = (s) => s;
const S = [];

// 1) 基线：接受信号立即出现
S.push(await runScenario({ id: 'baseline', extraArgs: ['--turn-delay-ms=20', '--noise-at-turn-end=true'] }));

// 2) 慢接受：宿主在收到 prompt 后 1.2s 才发第一帧
S.push(await runScenario({ id: 'slow-accept', extraArgs: ['--accept-delay-ms=1200', '--turn-delay-ms=20'] }));

// 3) TTL 误判：接受延迟 1.2s，但 TTL 只有 500ms → 会在 turn 完成前被判 expired
S.push(await runScenario({ id: 'ttl-false-expire', extraArgs: ['--accept-delay-ms=1200', '--turn-delay-ms=20'], ttlMs: 500, tickAtMs: 700 }));

// 4) 目标忙（拒绝并发 turn）：第二个交接立刻失败
S.push(await runScenario({ id: 'busy-error', extraArgs: ['--turn-delay-ms=1200'], doublePrompt: true }));

// 5) 目标忙（排队）：第二个交接「已投递」但长时间无事件
S.push(await runScenario({ id: 'busy-queue', extraArgs: ['--turn-delay-ms=1200', '--busy-policy=queue'], doublePrompt: true }));

// 6) 目标拒绝：permission=deny → stopReason refusal
S.push(await runScenario({ id: 'refusal', extraArgs: ['--permission=deny', '--turn-delay-ms=20'] }));

// 7) 中途取消：cancel ≠ 目标拒绝，但状态机上二者难区分
S.push(await runScenario({ id: 'cancelled', extraArgs: ['--turn-delay-ms=600'], cancelAtMs: 150 }));

// 8) 噪声误判：会话创建即发 available_commands_update，投递后立即有噪声帧
// 噪声帧在投递 60ms 后到达、turn 首帧要到 900ms 才出现 → 朴素「收到任何帧即接受」会提前 840ms 误判
const noiseAny = await runScenario({
  id: 'noise-any-event',
  extraArgs: ['--noise-on-session-new=true', '--noise-delay-ms=60', '--accept-delay-ms=900', '--turn-delay-ms=20'],
  acceptPolicy: 'any-event',
});
const noiseTurn = await runScenario({
  id: 'noise-turn-event',
  extraArgs: ['--noise-on-session-new=true', '--noise-delay-ms=60', '--accept-delay-ms=900', '--turn-delay-ms=20'],
  acceptPolicy: 'turn-event',
});
S.push(noiseAny, noiseTurn);

out.scenarios = S;

/** ---------- 真实宿主 ---------- */
if (argv.real) {
  const runDir = path.join(RUN_DIR, `real-${argv.real}`);
  fs.mkdirSync(runDir, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${argv.real}.json`), 'utf8'));
  const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp7-${Date.now()}` });
  const real = { host: argv.real };

  await withClient(host, `real-${argv.real}`, async ({ client, cwd }) => {
    const tracker = createHandoffTracker({ ttlMs: 30_000 });
    const session = await client.newSession(cwd, []);
    let handoffId;
    client.onUpdate((u) => handoffId && tracker.observeUpdate(handoffId, u));

    handoffId = tracker.create({ to: session.id });
    tracker.delivered(handoffId);
    const t0 = Date.now();
    let firstEventAt = null;
    const off = client.onUpdate(() => {
      if (!firstEventAt) firstEventAt = Date.now();
    });
    try {
      const r = await client.prompt(session.id, '写一份 50 字的产品说明', { timeoutMs: 120_000 });
      tracker.settle(handoffId, { stopReason: r.stopReason });
      real.stopReason = r.stopReason;
    } catch (err) {
      tracker.settle(handoffId, { error: { code: err.code ?? null, message: err.message } });
      real.error = { code: err.code ?? null, message: err.message };
    }
    off();
    const snap = tracker.get(handoffId);
    real.firstEventLatencyMs = firstEventAt ? firstEventAt - t0 : null;
    real.finalState = snap.state;
    real.ambiguityWindowMs = snap.ambiguityWindowMs;
    real.totalMs = snap.totalMs;
    real.transitions = snap.transitions.map((t) => `${t.state}(${t.evidence})`);

    // 忙时再次投递：ACP 语义下同会话不允许并发 turn，看真实宿主行为
    const busyProbe = { attempted: true };
    try {
      const p1 = client.prompt(session.id, '长任务 A', { timeoutMs: 60_000 });
      await new Promise((r) => setTimeout(r, 300));
      const tBusy = Date.now();
      try {
        const p2 = await client.prompt(session.id, '并发任务 B', { timeoutMs: 30_000 });
        busyProbe.second = { ok: true, stopReason: p2.stopReason, ms: Date.now() - tBusy };
      } catch (err) {
        busyProbe.second = { ok: false, code: err.code ?? null, message: err.message, ms: Date.now() - tBusy };
      }
      await p1.catch((e) => (busyProbe.first = { error: e.message }));
    } catch (err) {
      busyProbe.setupError = err.message;
    }
    real.busyProbe = busyProbe;
  });

  writeJson(path.join(runDir, 'handoff.json'), real);
  out.real = real;
}

writeJson(path.join(RUN_DIR, 'handoff-summary.json'), out);

const brief = out.scenarios.map((s) => ({
  id: s.id,
  final: s.finalState,
  acceptGap: s.ambiguityWindowMs,
  total: s.totalMs,
  noise: s.noiseCount,
  atTick: s.stateAtTick ?? null,
  second: s.secondPrompt ? (s.secondPrompt.ok ? `ok:${s.secondPrompt.stopReason}` : `err:${s.secondPrompt.code}`) : null,
}));
process.stdout.write(JSON.stringify({ scenarios: brief, real: out.real && { final: out.real.finalState, gap: out.real.ambiguityWindowMs, total: out.real.totalMs, busy: out.real.busyProbe?.second } }, null, 2) + '\n');

await stopAllServers();
