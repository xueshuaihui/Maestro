#!/usr/bin/env node
/**
 * I1.11 S3 验收 · 原始帧导出助手（只读产品模块，不改实现）。
 *
 * 目的：为机检型 AC 留「意图 / 队列投影」原始帧，与 test/wp14 的同名契约测试
 * 使用同一批产品模块（createNotifier / buildQueue）与同一组夹具字段，逐字断言
 * 仍由测试文件承载；本助手只导出真实产品输出，供 evidence/<AC>.state.json 取证。
 *
 * 用法：
 *   node probe/acc11-frame-dump.mjs notify ac01      # 升级意图
 *   node probe/acc11-frame-dump.mjs notify ac02      # 完成意图
 *   node probe/acc11-frame-dump.mjs notify ac03      # 异常意图（单条）
 *   node probe/acc11-frame-dump.mjs notify ac06      # 异常合并 [1,2,3,4]
 *   node probe/acc11-frame-dump.mjs notify ac07      # 3 条不同升级
 *   node probe/acc11-frame-dump.mjs queue  ac08      # 三行 + 排序 + 空态
 */
import { createNotifier } from '../src/daemon/notify.js';
import { buildQueue } from '../src/daemon/queue.js';

process.env.NODE_ENV = 'test';

function makeClock(start = 0) {
  let t = start;
  const timers = [];
  return {
    now: () => t,
    advance(ms) { t += ms; },
    schedule(fn, ms) { const e = { fn, at: t + ms, cancelled: false }; timers.push(e); return () => { e.cancelled = true; }; },
    fireDue() { let n = 0; for (const e of timers) if (!e.cancelled && e.at <= t) { e.cancelled = true; e.fn(); n++; } return n; },
    pendingCount: () => timers.filter((e) => !e.cancelled).length
  };
}
function makeBus() {
  const hs = new Set();
  return { subscribe(h) { hs.add(h); return () => hs.delete(h); }, emit(e) { for (const h of [...hs]) h({ ...e }); } };
}
function snapshot(overrides = {}) {
  return {
    instanceId: 'INST-001', state: 'running', health: { level: 'normal' }, workflowName: '单节点',
    nodes: [{ nodeId: 'T-001', roleName: '执行者', round: 1, state: 'done' }],
    escalations: [{ escalationId: 'ESC-001', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：测试未通过' }],
    ...overrides
  };
}
const escalationEvent = (id = 'ESC-001', detail) => ({
  object: 'escalation', objectId: id, from: null, to: 'pending', result: 'applied',
  reason: 'escalation.created', detail: detail ?? { nodeId: 'T-001', round: 1, reasonCode: 'execution_failed' }
});
const instanceEvent = (to, from = 'running') => ({
  object: 'instance', objectId: 'INST-001', from, to, result: 'applied', reason: 'state.change', detail: null
});
const healthEvent = (message) => ({
  object: 'health', objectId: 'INST-001', from: 'normal', to: 'attention', result: 'applied',
  reason: 'health.changed', detail: { message }
});
const settle = () => new Promise((r) => setTimeout(r, 20));
async function until(fn, ms = 500) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 5)); }
  return fn();
}
async function runNotify(kind) {
  const clock = makeClock();
  const bus = makeBus();
  let states = [snapshot()];
  const opts = { bus, getInstanceStates: async () => states, clock };
  if (kind === 'ac05') { /* 预留：开关由 notify.test.js 承载 */ }
  const notifier = createNotifier(opts);
  const seen = [];
  const task = (async () => { try { for await (const i of notifier.intents$) seen.push(i); } catch { /* dispose */ } })();

  if (kind === 'ac01') {
    bus.emit(escalationEvent());
    await until(() => seen.length >= 1);
  } else if (kind === 'ac02') {
    states = [snapshot({ state: 'completed' })];
    bus.emit(instanceEvent('completed'));
    await until(() => seen.length >= 1);
  } else if (kind === 'ac03') {
    states = [snapshot({ state: 'interrupted', health: { level: 'ended' } })];
    bus.emit(instanceEvent('interrupted'));
    await until(() => seen.length >= 1);
  } else if (kind === 'ac06') {
    states = [snapshot({ state: 'interrupted' })];
    bus.emit(instanceEvent('interrupted'));
    await until(() => seen.length >= 1);
    clock.advance(5_000); bus.emit(healthEvent('会话 mock-sess-12345-1 崩溃')); await until(() => seen.length >= 2);
    clock.advance(5_000); bus.emit(instanceEvent('failed')); await until(() => seen.length >= 3);
    clock.advance(5_000); bus.emit(instanceEvent('interrupted')); await until(() => seen.length >= 4);
  } else if (kind === 'ac07') {
    // AC-07 主现场：3 个不同升级编号、分属 3 实例 → 3 条 notify 意图 + 3 条投递失败
    // （与需求 Then「探针记录 3 条 notify 与 3 条 delivered=false」一致）。
    // 首读失败丢弃不崩溃的变体由 test/wp14/notify.test.js 的 AC-07 用例承载，本帧取主现场。
    states = [
      snapshot(),
      snapshot({ instanceId: 'INST-002', escalations: [{ escalationId: 'ESC-002', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：命令超时' }] }),
      snapshot({ instanceId: 'INST-003', escalations: [{ escalationId: 'ESC-003', state: 'pending', nodeId: 'T-001', round: 1, reasonDetail: '执行失败：核对未过' }] })
    ];
    bus.emit(escalationEvent('ESC-001'));
    bus.emit(escalationEvent('ESC-002'));
    bus.emit(escalationEvent('ESC-003'));
    await until(() => seen.length >= 3);
  } else {
    throw new Error(`未知 notify 场景 ${kind}`);
  }

  const groups = [...new Set(seen.map((i) => `${i.kind}::${i.instanceId}`))];
  const frame = {
    ac: kind.toUpperCase(),
    source: 'createNotifier + 注入时钟（与 test/wp14/notify.test.js 同模块同夹具）',
    intentCountRaw: seen.length,
    dedupeGroupCount: groups.length,
    groups,
    mergedCounts: seen.map((i) => i.mergedCount),
    intents: seen
  };
  await notifier.dispose();
  await Promise.race([task, settle()]);
  return frame;
}

function escEntry(id, overrides = {}) {
  const base = {
    escalationId: id, nodeId: 'T-001', round: 1, reasonCode: 'rounds_exceeded',
    reasonDetail: '轮次超限：第 1 轮', defects: [], state: 'pending',
    createdAt: '2026-11-15T10:30:00.000Z', resolvedAt: null, resolution: null, voidedAt: null
  };
  return { ...base, ...overrides };
}
function approvalRow(id, overrides = {}) {
  return {
    approvalId: id, nodeId: 'T-001', sessionId: 'sess-001', action: 'write', toolCallId: 'tc-1',
    state: 'pending', createdAt: '2026-11-15T10:32:00.000Z', resolvedAt: null, resolution: null, ...overrides
  };
}
function runQueue(kind) {
  if (kind !== 'ac08') throw new Error(`未知 queue 场景 ${kind}`);
  const queue = buildQueue('/tmp/maestro-i11-frame', {
    instances: [
      {
        instanceId: 'INST-001', state: 'suspended',
        nodes: [{ nodeId: 'T-001', state: 'escalated', round: 1, roleId: 'worker' }],
        escalations: [escEntry('ESC-001')], approvals: [], pendingEscalations: 1, pendingApprovals: 0
      },
      {
        instanceId: 'INST-002', state: 'suspended',
        nodes: [
          { nodeId: 'T-001', state: 'escalated', round: 2, roleId: 'developer' },
          { nodeId: 'T-002', state: 'pending', round: 0, roleId: 'tester' }
        ],
        escalations: [escEntry('ESC-002', { round: 2, reasonDetail: '执行失败：命令超时' })],
        approvals: [approvalRow('APR-001')], pendingEscalations: 1, pendingApprovals: 1
      }
    ]
  });
  const empty = buildQueue('/tmp/maestro-i11-frame', { instances: [] });
  return {
    ac: 'AC-08',
    source: 'buildQueue（与 test/wp14/queue.test.js 同模块同夹具）',
    order: queue.items.map((i) => i.id),
    totals: queue.totals,
    items: queue.items,
    itemKeys: queue.items.map((i) => Object.keys(i)),
    empty: { items: empty.items, totals: empty.totals, emptyText: '待处理 无' }
  };
}

const [domain, kind] = process.argv.slice(2);
let frame;
if (domain === 'notify') frame = await runNotify(kind);
else if (domain === 'queue') frame = runQueue(kind);
else { process.stderr.write('usage: frame-dump.mjs <notify|queue> <acXX>\n'); process.exit(2); }
process.stdout.write(JSON.stringify(frame, null, 2) + '\n');
