#!/usr/bin/env node
/**
 * VP-6 · 会话状态映射（→ docs/index.md §3.2 的 6 个会话状态）
 *
 * 三段：
 *   A. 离线回放：把**已录制的真实帧**喂进归一化器，看 6 个状态里哪些真能到达
 *   B. 实时 mock（permission=ask）：验证 request_permission → waiting_input 的完整往返
 *   C. 覆盖率表：逐状态给出「可得 / 需推断 / 不可得」+ 依据帧
 *
 *   node bin/state-mapping-experiment.mjs
 *   node bin/state-mapping-experiment.mjs --real=dsh-real
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTransport, loadHostConfig, stopAllServers } from '../src/transport-factory.mjs';
import { FrameRecorder, writeJson } from '../src/recorder.mjs';
import { AcpClient } from '../src/client.mjs';
import { createSessionStateNormalizer, ALL_STATES, SESSION_STATE, isNoiseUpdate } from '../src/normalize/session-state.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '../..');
const WORKSPACE = path.resolve(SPIKE, '..');
const RUN_DIR = path.join(WORKSPACE, '.orch-spike/runs/vp6');
fs.mkdirSync(RUN_DIR, { recursive: true });

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=?([\s\S]*)$/);
    return [m[1], m[2] || 'true'];
  }),
);

const out = { experiment: 'VP-6 session-state-mapping', at: new Date().toISOString(), parts: {} };

/** ---------- A. 离线回放真实帧 ---------- */
function replayFile(file) {
  if (!fs.existsSync(file)) return null;
  const rows = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const norm = createSessionStateNormalizer();
  const seenKinds = {};
  let updateCount = 0;
  let noiseCount = 0;

  for (const r of rows) {
    const u = r.frame?.params?.update;
    if (!u) continue;
    const sid = r.frame?.params?.sessionId ?? 'unknown';
    updateCount += 1;
    seenKinds[u.sessionUpdate] = (seenKinds[u.sessionUpdate] ?? 0) + 1;
    if (isNoiseUpdate(u)) noiseCount += 1;
    norm.applyUpdate(sid, u);
  }

  const sessions = norm.all();
  const reached = new Set();
  for (const s of sessions) for (const t of s.transitions) reached.add(t.state);

  return {
    file: path.relative(WORKSPACE, file).replace(/\\/g, '/'),
    updateCount,
    noiseCount,
    updateKinds: seenKinds,
    sessions: sessions.length,
    reachedStates: [...reached],
    timelines: sessions.map((s) => ({ id: s.id, transitions: s.transitions })),
  };
}

const offlineFiles = [
  '.orch-spike/runs/vp1/dsh-real/stdio.jsonl',
  '.orch-spike/runs/vp4/dsh-real-real/stdio.jsonl',
  '.orch-spike/runs/vp2-real/dsh-real/stdio-p2-2.jsonl',
].map((p) => path.join(WORKSPACE, p));

out.parts.A_offlineReal = offlineFiles.map(replayFile).filter(Boolean);

/** ---------- B. 实时 mock：permission 往返 ---------- */
async function runMockPermissionTurn() {
  const runDir = path.join(RUN_DIR, 'mock-permission');
  fs.mkdirSync(runDir, { recursive: true });

  const host = {
    kind: 'stdio',
    name: 'mock-stdio-permission-ask',
    represents: 'mock',
    evidence: 'mock',
    command: process.execPath,
    args: [path.join(SPIKE, 'mock-acp-server/stdio-agent.mjs'), '--permission=ask', '--dialect=load-only', '--turn-delay-ms=20'],
    cwd: WORKSPACE,
  };

  const { transport, stop } = await createTransport(host, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId: 'vp6', transport: transport.kind });
  transport.recorder = recorder;

  const norm = createSessionStateNormalizer();
  const transitions = [];
  norm.applyUpdate = ((orig) =>
    function (sid, u) {
      const r = orig.call(this, sid, u);
      if (r.changed) transitions.push({ at: Date.now(), ...r });
      return r;
    })(norm.applyUpdate);
  norm.permissionRequested = ((orig) =>
    function (sid, meta) {
      const r = orig.call(this, sid, meta);
      if (r.changed) transitions.push({ at: Date.now(), ...r });
      return r;
    })(norm.permissionRequested);
  norm.permissionResolved = ((orig) =>
    function (sid, outcome) {
      const r = orig.call(this, sid, outcome);
      if (r.changed) transitions.push({ at: Date.now(), ...r });
      return r;
    })(norm.permissionResolved);
  norm.turnSettled = ((orig) =>
    function (sid, reason) {
      const r = orig.call(this, sid, reason);
      if (r.changed) transitions.push({ at: Date.now(), ...r });
      return r;
    })(norm.turnSettled);

  const permissionLog = [];
  const result = { host: host.name, transitions, permissionLog };

  try {
    await transport.connect();
    const client = new AcpClient(transport, { recorder });
    await client.initialize({ name: 'vp6', version: '0.1.0' });
    const cwd = path.join(runDir, 'cwd');
    fs.mkdirSync(cwd, { recursive: true });
    const session = await client.newSession(cwd, []);
    norm.sessionCreated(session.id);

    client.onUpdate((u, sid) => norm.applyUpdate(sid ?? session.id, u));
    client.onClientRequest = async (method, params) => {
      if (method !== 'session/request_permission') return {};
      const t = Date.now();
      norm.permissionRequested(params.sessionId, { toolCallId: params.toolCall?.toolCallId, kind: params.toolCall?.kind });
      permissionLog.push({
        method,
        at: new Date(t).toISOString(),
        sessionId: params.sessionId,
        toolCall: params.toolCall,
        optionKinds: (params.options ?? []).map((o) => o.kind),
      });
      // 模拟「人点了允许」
      norm.permissionResolved(params.sessionId, 'allow-once');
      return { outcome: { outcome: 'selected', optionId: 'allow-once' } };
    };

    const r = await client.prompt(session.id, 'EVIDENCE: 写一份说明', { timeoutMs: 120_000 });
    norm.turnSettled(session.id, r.stopReason);
    result.stopReason = r.stopReason;
    result.states = [...new Set(transitions.map((x) => x.state))];
    result.timeline = transitions.map((x) => `${x.state}(${x.evidence})`);
    result.hasWaitingInput = transitions.some((x) => x.state === SESSION_STATE.WAITING_INPUT);
    // 回到 thinking 的往返：权限解决后是否离开 waiting_input
    result.leftWaitingInput = transitions.some((x) => x.state === SESSION_STATE.THINKING && x.evidence?.startsWith('permission'));

    await client.close();
    result.ok = true;
  } catch (err) {
    result.ok = false;
    result.error = { code: err.code ?? null, message: err.message };
  } finally {
    result.frames = recorder.file;
    writeJson(path.join(runDir, 'permission-turn.json'), result);
    await stop().catch(() => {});
    recorder.close();
  }
  return result;
}

out.parts.B_mockPermission = await runMockPermissionTurn();

/** ---------- C. 可选：真实宿主上是否能到达 waiting_input ---------- */
if (argv.real) {
  const runDir = path.join(RUN_DIR, `real-${argv.real}`);
  fs.mkdirSync(runDir, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(path.join(SPIKE, 'acp-harness/hosts', `${argv.real}.json`), 'utf8'));
  const host = loadHostConfig(raw, { SPIKE, WORKSPACE, RUN_DIR: runDir, SESSION_ID: `vp6-${Date.now()}` });
  const { transport, stop } = await createTransport(host, { recorder: null });
  const recorder = new FrameRecorder({ dir: runDir, runId: 'vp6', transport: transport.kind });
  transport.recorder = recorder;

  const norm = createSessionStateNormalizer();
  const permissionLog = [];
  const realOut = { host: argv.real, permissionLog };

  try {
    await transport.connect();
    const client = new AcpClient(transport, { recorder });
    await client.initialize({ name: 'vp6', version: '0.1.0' });
    const cwd = path.join(runDir, 'cwd');
    fs.mkdirSync(cwd, { recursive: true });
    const session = await client.newSession(cwd, []);
    norm.sessionCreated(session.id);
    client.onUpdate((u, sid) => norm.applyUpdate(sid ?? session.id, u));
    client.onClientRequest = async (method, params) => {
      permissionLog.push({ method, at: new Date().toISOString(), params: JSON.stringify(params).slice(0, 300) });
      norm.permissionRequested(params?.sessionId ?? session.id, { kind: params?.toolCall?.kind });
      return { outcome: { outcome: 'selected', optionId: params?.options?.[0]?.optionId } };
    };
    const r = await client.prompt(session.id, '写一份 50 字的产品说明', { timeoutMs: 120_000 });
    norm.turnSettled(session.id, r.stopReason);
    realOut.stopReason = r.stopReason;
    realOut.timeline = norm.timeline(session.id).map((x) => `${x.state}(${x.evidence})`);
    realOut.reachedStates = [...new Set(norm.timeline(session.id).map((x) => x.state))];
    realOut.permissionSeen = permissionLog.length > 0;
    await client.close();
    realOut.ok = true;
  } catch (err) {
    realOut.ok = false;
    realOut.error = { code: err.code ?? null, message: err.message };
  } finally {
    realOut.frames = recorder.file;
    writeJson(path.join(runDir, 'state-mapping.json'), realOut);
    await stop().catch(() => {});
    recorder.close();
  }
  out.parts.C_real = realOut;
}

/** ---------- D. 覆盖率表 ---------- */
const realReached = new Set();
for (const p of out.parts.A_offlineReal) for (const s of p.reachedStates) realReached.add(s);
if (out.parts.C_real?.reachedStates) for (const s of out.parts.C_real.reachedStates) realReached.add(s);
const mockReached = new Set(out.parts.B_mockPermission.states ?? []);

const REASON = {
  idle: { real: '可得', mock: '可得', note: '会话创建即知，无需事件' },
  thinking: { real: '可得', mock: '可得', note: '真实 DSH 发 agent_thought_chunk / agent_message_chunk' },
  tool_running: { real: '可得', mock: '可得', note: 'tool_call / tool_call_update 直接映射' },
  waiting_input: {
    real: '不可得（未观测）',
    mock: '可得',
    note: '只由客户端侧 session/request_permission 触发；真实 DSH 当前 profile 未发起审批',
  },
  waiting_dependency: { real: '不可得', mock: '不可得', note: 'ACP 无「产物已提交」语义，只能由核心推断，不是适配器可观测状态' },
  escalated: { real: '不可得', mock: '不可得', note: '核心生成，非 ACP 事件' },
};

out.parts.D_coverage = ALL_STATES.map((s) => ({
  state: s,
  realReached: realReached.has(s),
  mockReached: mockReached.has(s),
  verdict: {
    real: REASON[s].real,
    mock: REASON[s].mock,
  },
  note: REASON[s].note,
}));

out.summary = {
  realRecordings: out.parts.A_offlineReal.map((p) => ({ file: p.file, updates: p.updateCount, noise: p.noiseCount, states: p.reachedStates })),
  mockWaitingInputRideTrip: {
    hasWaitingInput: out.parts.B_mockPermission.hasWaitingInput,
    leftWaitingInput: out.parts.B_mockPermission.leftWaitingInput,
    timeline: out.parts.B_mockPermission.timeline,
  },
  derivableFromAcp: out.parts.D_coverage.filter((c) => c.verdict.real === '可得').map((c) => c.state),
  notDerivableFromAcp: out.parts.D_coverage.filter((c) => c.verdict.real !== '可得').map((c) => c.state),
};

writeJson(path.join(RUN_DIR, 'state-mapping.json'), out);
process.stdout.write(JSON.stringify(out.summary, null, 2) + '\n');
await stopAllServers();
