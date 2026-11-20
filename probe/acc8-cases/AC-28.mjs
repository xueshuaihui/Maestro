/**
 * AC-28 · busy 且会话不可恢复 → available。
 *
 * 本文件同时导出本批共享的受控恢复现场助手（prepareGiven / boot / releaseAndStop /
 * baseState / nodeOfTpl），供 AC-29~AC-40 复用。纪律与前两批一致：只写 Given 现场，
 * 方言选择、降级、交接包与节点保持全部由产品核心连真 mock ACP 适配器执行。
 *
 * Given 现场：code-loop 图，T-001 开发节点 running(phase=assigned) + 会话 idle，
 * caps=none（无 resume/load 广告）→ 恢复时核心按 dialect=new 判定「会话不可恢复」，
 * 节点停在 after_assign 冻结位。role show developer 应显示 可用 · 活跃会话 0/1。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  NODE, ORCH_BIN, freshRoot, cleanupRoot, readState, readEvents, orch, runCmd, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { prepareScene, mockArgsFromEnv, buildRunEnv } from '../../test/fixtures/code-loop-driver.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const ISO = () => new Date().toISOString();

/** 核心 pid（SIGKILL 重试用）；读不到返回 null。 */
export function corePid(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8')).pid ?? null;
  } catch {
    return null;
  }
}

/** 标准节点模板（字段齐全，避免核心 arraysOf 补字段时形状漂移）。 */
export function nodeTpl({ nodeId, roleId, state, phase, round = 1, nodeType = null, title = null, extra = {} }) {
  const out = {
    nodeId, roleId, round, state, stateSince: ISO(),
    startedAt: ISO(), roundStartedAt: ISO(), endedAt: null,
    failure: null, note: null, verdict: null, sessionId: null, artifactRefs: [],
    ...extra,
  };
  if (phase) out.phase = phase;
  if (nodeType) out.nodeType = nodeType;
  if (title) out.title = title;
  return out;
}

/** 标准会话模板：state=idle 的会话不计入「活跃会话」，thinking 计入。 */
export function sessionTpl({ sessionId, nodeId, roleId = 'tester', state = 'idle', extra = {} }) {
  return {
    sessionId, nodeId, roleId, round: 1, hostId: 'mock', state,
    stateSince: ISO(), createdAt: ISO(), lastEventAt: ISO(),
    toolName: null, turnId: null, artifactRef: null, pendingPermission: null,
    quarantined: false, ...extra,
  };
}

/** 标准交接包模板：把 7 个时间字段都补齐，状态行/连接线才有可观测锚点。 */
export function handoffTpl({
  handoffId = 'HO-001', from = 'T-001', to = 'T-002', kind = 'forward',
  state = 'delivered', acceptedAt = null, deliveryAttempts = 1, extra = {},
}) {
  const stamp = ISO();
  return {
    handoffId, instanceId: 'INST-001',
    edge: { from, to, kind }, from, to, kind,
    fromNodeId: from, toNodeId: to,
    state, createdAt: stamp, pendingAt: null,
    deliveredAt: stamp, acceptedAt, consumedAt: null,
    rejectedAt: null, rejectReason: null, expiredAt: null,
    wakeConsumedAt: null, acceptedSignal: null, ambiguityWindowMs: null,
    defects: [], note: null, artifactRefs: null, round: 2,
    retestRequirement: null, deliveryAttempts, lastError: null,
    ...extra,
  };
}

/** 一个 schemaVersion=2 的 running 实例骨架（调用方填 nodes/sessions/handoffs）。 */
export function baseState(root, { instanceId = 'INST-001', state = 'running', nodes = [], sessions = [], handoffs = [], escalations = [], extra = {} } = {}) {
  const stamp = ISO();
  return {
    schemaVersion: 2, instanceId, coreGeneration: 'gen-before-recovery',
    createdAt: stamp, updatedAt: stamp, state, stateSince: stamp,
    template: 'code-loop', cwd: path.join(root, 'demo-recovery'),
    task: '修复 calc.js 的除零边界，并补一条回归测试。\n改动写在 calc.js\n产物：calc.js',
    halted: false, paused: false, rev: 1,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes, sessions, handoffs, escalations,
    health: { level: 'normal', reasons: [], computedAt: stamp, nodeTimeoutMs: 30000 },
    ...extra,
  };
}

/**
 * 落 Given 现场：prepareScene 提供真 mock host/图，state.json 由用例手写（只写 Given）。
 * @returns {{env, prepared, promptLog, stateFile, instanceId}}
 */
export function prepareGiven(root, state, { caps = 'resume', extraEnv = {}, scenario = 'backflow' } = {}) {
  const envExtra = {};
  if (caps !== undefined) envExtra.MAESTRO_MOCK_CAPS = caps;
  const env = buildRunEnv(process.env, { ...envExtra, ...extraEnv });
  const promptLog = path.join(root, 'prompt-log.ndjson');
  env.MAESTRO_MOCK_PROMPT_LOG = promptLog;
  const prepared = prepareScene({ root, scenario, reset: false, mockArgs: mockArgsFromEnv(env) });
  fs.mkdirSync(path.join(root, 'demo-recovery'), { recursive: true });
  const instanceId = state.instanceId ?? 'INST-001';
  const stateFile = path.join(root, '.orch', 'instances', instanceId, 'state.json');
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(prepared.mockDir, 'cursor.json'), '{"next":1}\n', 'utf8');
  fs.rmSync(path.join(prepared.mockDir, 'cursor.lock'), { force: true });
  fs.rmSync(path.join(prepared.mockDir, 'exhausted'), { force: true });
  return { env, prepared, promptLog, stateFile, instanceId };
}

/**
 * 冷启动触发 reconcileOnBoot，等 recoveredAt 落盘；hold=after_assign 时再等 .mock/paused。
 * 首次恢复若撞 instance.get 健康写 CAS 冲突，再 SIGKILL 新 core 重试一次（沿用 AC-19）。
 */
export async function boot(root, env, instanceId = 'INST-001', { waitPaused = false, timeoutMs = 60000 } = {}) {
  const boots = [];
  for (let attempt = 0; attempt < 2 && !readState(root, instanceId)?.recoveredAt; attempt += 1) {
    if (attempt === 1) {
      const pid = corePid(root);
      if (pid) { try { process.kill(pid, 'SIGKILL'); } catch { /* 已退出 */ } }
      await nap(1200);
    }
    const r = orch(root, ['status'], { env });
    boots.push({ attempt, exit: r.exitCode, pid: corePid(root) });
    const until = Date.now() + timeoutMs;
    while (Date.now() < until && !readState(root, instanceId)?.recoveredAt) await nap(300);
    boots.push({ attempt, pid: corePid(root), recoveredAt: readState(root, instanceId)?.recoveredAt ?? null });
  }
  if (waitPaused) {
    const until = Date.now() + 30000;
    while (Date.now() < until && !fs.existsSync(path.join(root, '.mock', 'paused'))) await nap(100);
  }
  // recoveredAt 先于 recovery.summary 等事件落盘；给事件文件一个短 flushing 窗口，避免偶发空集。
  await nap(300);
  return { boots, afterState: readState(root, instanceId), events: readEvents(root, instanceId) };
}

/** 释放 hold 并干净停核心（清理动作，不参与判定）。 */
export function releaseAndStop(root, env) {
  try { fs.writeFileSync(path.join(root, '.mock', 'release'), '1'); } catch { /* 放行 */ }
  try { orch(root, ['core', 'stop'], { env }); } catch { /* 清理 */ }
}

export async function run() {
  const c = makeCase('AC-28', {
    scenario: 'role-unrecoverable',
    title: '角色 busy 且会话不可恢复 → available',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-28');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, {
      caps: 'none',
      extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：开发节点 running(phase=assigned) + idle 会话、caps=none',
      given.nodes[0].state === 'running' && given.nodes[0].phase === 'assigned'
      && given.sessions[0].state === 'idle', '受控现场');

    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    check(c, '夹具：recoveredAt 落盘，恢复窗口构造成功', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null, boots: b.boots }));

    const roleShow = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    const graph = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'role-show.txt', roleShow.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'graph.txt', graph.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const node = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const roleEvents = b.events.filter((e) => e.reason === 'recovery.role');
    evidence(c, 'then', 'role-events.json', JSON.stringify(roleEvents, null, 2));

    includes(c, 'Then：role show 显示「可用 · 活跃会话 0/1」', roleShow.stdout, '可用 · 活跃会话 0/1');
    includes(c, 'Then：role show 服务节点为 —（assigned 不算服务节点，裁-10a）', roleShow.stdout, '服务节点 —');
    check(c, 'Then：节点停在 running + phase=assigned',
      node?.state === 'running' && node?.phase === 'assigned', JSON.stringify(node));
    includes(c, 'Then：instance log 出现「服务中 → 可用（会话不可恢复）」',
      log.stdout, '服务中 → 可用（会话不可恢复）');
    includes(c, 'Then：instance log 点名角色 开发', log.stdout, '恢复：角色 开发');
    check(c, '夹具：recovery.role 事件 from=busy / to=available / reason=session_unrecoverable',
      roleEvents.some((e) => e.detail?.roleId === 'developer' && e.detail?.from === 'busy'
        && e.detail?.to === 'available' && e.detail?.reason === 'session_unrecoverable'),
      JSON.stringify(roleEvents));
    check(c, '夹具：无 node.dispatch（hold 冻结在重新派发之前）',
      !b.events.some((e) => e.reason === 'node.dispatch'), `dispatch=${b.events.filter((e) => e.reason === 'node.dispatch').length}`);
    excludes(c, 'Then：实例不出现「已分配 → 执行中」的已推进节点', graph.stdout, 'T-001 开发 · 执行中');

    note(c, 'Given 用受控 state.json（T-001 running+assigned + idle 会话）冻结在 after_assign；'
      + 'caps=none 使核心连真 mock ACP 适配器走 dialect=new，按 §3.6 判会话不可恢复并降级角色。');
    note(c, '裁-10a：running + phase=assigned 不算服务节点，故 role show 的「服务节点 —」与「可用」一致。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
