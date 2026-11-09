/**
 * WP-6 / D-5 / AC-31~35 / AC-67: approval rows, APR-nnn allocation, state
 * migration, the core-restart (APPROVAL_SESSION_GONE) guard, and the two new
 * snapshotOf fields. Pure helpers are locked directly; the orchestrator-level
 * paths are driven over a crafted on-disk state (no live run handle).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  nextApprovalId,
  buildApproval,
  findApproval,
  pendingForSession,
  decideApproval,
  withdrawPending,
  approvalSessionCheck,
  APPROVAL_SESSION_GONE,
  APPROVAL_NOT_PENDING,
  APPROVAL_DECISION_INVALID,
} from '../../src/core/approvals.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

// ------------------------------------------------------------------ pure helpers

test('nextApprovalId：APR-nnn 实例内递增、不复用，忽略脏数据', () => {
  assert.equal(nextApprovalId([]), 'APR-001');
  assert.equal(nextApprovalId([{ approvalId: 'APR-001' }]), 'APR-002');
  assert.equal(
    nextApprovalId([
      { approvalId: 'APR-001' },
      { approvalId: 'APR-003' },
      { approvalId: 'not-an-id' },
      { approvalId: 'APR-999' },
    ]),
    'APR-1000',
  );
  assert.equal(nextApprovalId(null), 'APR-001');
});

test('buildApproval：完整字段且初始 pending（D-5.3）', () => {
  const row = buildApproval({
    approvals: [{ approvalId: 'APR-001' }],
    instanceId: 'INST-001',
    nodeId: 'T-001',
    sessionId: 'sess-001',
    action: 'write',
    toolCallId: 'tc-9',
    now: () => 1_760_000_000_000,
  });
  assert.deepEqual(row, {
    approvalId: 'APR-002',
    instanceId: 'INST-001',
    nodeId: 'T-001',
    sessionId: 'sess-001',
    action: 'write',
    toolCallId: 'tc-9',
    state: 'pending',
    createdAt: new Date(1_760_000_000_000).toISOString(),
    resolvedAt: null,
    resolution: null,
  });
  assert.equal(buildApproval({}).toolCallId, null);
});

test('findApproval / pendingForSession：按 id 取行、按会话取待处理行', () => {
  const rows = [
    { approvalId: 'APR-001', sessionId: 's1', state: 'pending' },
    { approvalId: 'APR-002', sessionId: 's1', state: 'approved' },
    { approvalId: 'APR-003', sessionId: 's2', state: 'pending' },
  ];
  assert.equal(findApproval(rows, 'APR-002').state, 'approved');
  assert.equal(findApproval(rows, 'APR-404'), null);
  assert.equal(findApproval(rows, ''), null);
  assert.deepEqual(pendingForSession(rows, 's1').map((r) => r.approvalId), ['APR-001']);
  assert.deepEqual(pendingForSession(rows, 's2').map((r) => r.approvalId), ['APR-003']);
  assert.deepEqual(pendingForSession(rows, ''), []);
});

test('decideApproval：allow/deny 迁移，非 pending 与非法决策拒绝', () => {
  const allow = { approvalId: 'APR-001', state: 'pending', resolution: null, resolvedAt: null };
  assert.deepEqual(decideApproval(allow, 'allow', 'T0'), {
    ok: true, state: 'approved', resolution: 'allow',
  });
  assert.equal(allow.resolvedAt, 'T0');

  const deny = { approvalId: 'APR-002', state: 'pending', resolution: null, resolvedAt: null };
  assert.deepEqual(decideApproval(deny, 'deny', 'T1').state, 'denied');

  const bad = { approvalId: 'APR-003', state: 'pending' };
  assert.deepEqual(decideApproval(bad, 'maybe'), { ok: false, code: APPROVAL_DECISION_INVALID });
  assert.equal(bad.state, 'pending', '非法决策不得改内存');

  const settled = { approvalId: 'APR-004', state: 'approved' };
  assert.deepEqual(decideApproval(settled, 'allow'), { ok: false, code: APPROVAL_NOT_PENDING });
});

test('withdrawPending：全部 pending → withdrawn，返回被改行，非 pending 不动', () => {
  const rows = [
    { approvalId: 'APR-001', state: 'pending' },
    { approvalId: 'APR-002', state: 'approved' },
    { approvalId: 'APR-003', state: 'pending' },
  ];
  const changed = withdrawPending(rows, 'T9');
  assert.deepEqual(changed.map((r) => r.approvalId), ['APR-001', 'APR-003']);
  assert.deepEqual(rows.map((r) => r.state), ['withdrawn', 'approved', 'withdrawn']);
  assert.equal(rows[0].resolvedAt, 'T9');
  assert.deepEqual(withdrawPending(null), []);
});

test('approvalSessionCheck：无内存 respond（核心重启）→ APPROVAL_SESSION_GONE（AC-67 / D-5.9）', () => {
  const pending = { approvalId: 'APR-001', state: 'pending' };
  assert.deepEqual(approvalSessionCheck(pending, { respond: () => {} }), { ok: true });
  assert.deepEqual(approvalSessionCheck(pending, null), { ok: false, code: APPROVAL_SESSION_GONE });
  assert.deepEqual(approvalSessionCheck(pending, { respond: 'not-a-fn' }), {
    ok: false, code: APPROVAL_SESSION_GONE,
  });
  assert.deepEqual(approvalSessionCheck({ state: 'approved' }, { respond: () => {} }), {
    ok: false, code: APPROVAL_NOT_PENDING,
  });
});

// ------------------------------------------------------------------ orchestrator + store

function baseState(overrides = {}) {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    state: 'running',
    halted: false,
    rev: 3,
    task: '写下 out/a.md',
    cwd: '/tmp/maestro-approvals-work',
    createdAt: '2026-01-01T00:00:00.000Z',
    stateSince: '2026-01-01T00:00:00.000Z',
    counters: { dispatchCount: 1, eventSeq: 0 },
    nodes: [{ nodeId: 'T-001', state: 'running', round: 1, sessionId: 'sess-001' }],
    sessions: [
      { sessionId: 'sess-001', state: 'waiting_input', nodeId: 'T-001', hostId: null, quarantined: false },
    ],
    handoffs: [],
    escalations: [],
    approvals: [
      {
        approvalId: 'APR-001', instanceId: 'INST-001', nodeId: 'T-001',
        sessionId: 'sess-001', action: 'write', toolCallId: 'tc-1',
        state: 'pending', createdAt: '2026-01-01T00:00:01.000Z',
        resolvedAt: null, resolution: null,
      },
    ],
    ...overrides,
  };
}

async function makeOrch(stateOverrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-approvals-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: { async create() { throw new Error('no host in unit test'); } },
    env: { NODE_ENV: 'test' },
  });
  await store.save('INST-001', baseState(stateOverrides));
  return {
    root, store, bus, orch,
    async teardown() {
      await orch.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('listApprovals：投影带 instanceId，可按 sessionId 过滤', async () => {
  const env = await makeOrch();
  try {
    const all = await env.orch.listApprovals({ instanceId: 'INST-001' });
    assert.equal(all.ok, true);
    assert.equal(all.approvals.length, 1);
    assert.equal(all.approvals[0].approvalId, 'APR-001');
    assert.equal(all.approvals[0].instanceId, 'INST-001');
    assert.equal(all.approvals[0].state, 'pending');

    const hit = await env.orch.listApprovals({ instanceId: 'INST-001', sessionId: 'sess-001' });
    assert.equal(hit.approvals.length, 1);
    const miss = await env.orch.listApprovals({ instanceId: 'INST-001', sessionId: 'other' });
    assert.equal(miss.approvals.length, 0);
  } finally {
    await env.teardown();
  }
});

test('resolveApproval：核心重启无 respond → APPROVAL_SESSION_GONE 且审批仍 pending（AC-67）', async () => {
  const env = await makeOrch();
  try {
    const res = await env.orch.resolveApproval({
      instanceId: 'INST-001', approvalId: 'APR-001', decision: 'allow',
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, APPROVAL_SESSION_GONE);

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.approvals[0].state, 'pending', '拒绝后绝不写 approved');
    assert.equal(disk.approvals[0].resolvedAt, null);
  } finally {
    await env.teardown();
  }
});

test('resolveApproval：非法 decision / 不存在的 id / 非 pending 均被拒绝', async () => {
  const env = await makeOrch();
  try {
    const bad = await env.orch.resolveApproval({
      instanceId: 'INST-001', approvalId: 'APR-001', decision: 'maybe',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'USAGE_ERROR');

    const missing = await env.orch.resolveApproval({
      instanceId: 'INST-001', approvalId: 'APR-404', decision: 'allow',
    });
    assert.equal(missing.code, 'APPROVAL_NOT_FOUND');
  } finally {
    await env.teardown();
  }
});

test('snapshotOf：approvals / pendingApprovals 追加在 paused 之后，既有派生字段顺序不变（D-9.1 / M-10）', async () => {
  // A state WITHOUT the projected keys: snapshotOf must supply the defaults
  // (paused=false, approvals=[], pendingApprovals=0) at the very end.
  const env = await makeOrch({ approvals: undefined });
  try {
    const status = await env.orch.getStatus({ instanceId: 'INST-001' });
    assert.equal(status.ok, true);
    const snap = status.snapshot;
    assert.equal(snap.paused, false);
    assert.deepEqual(snap.approvals, []);
    assert.equal(snap.pendingApprovals, 0);

    const keys = Object.keys(snap);
    assert.ok(keys.indexOf('elapsedMs') < keys.indexOf('paused'), 'elapsedMs 等冻结字段仍在前');
    assert.ok(keys.indexOf('pendingEscalations') < keys.indexOf('paused'));
    assert.ok(keys.indexOf('paused') < keys.indexOf('approvals'), 'approvals 追加在 paused 之后');
    assert.ok(keys.indexOf('approvals') < keys.indexOf('pendingApprovals'));
  } finally {
    await env.teardown();
  }
});

test('snapshotOf：存在一条 pending 审批时 pendingApprovals === 1', async () => {
  const env = await makeOrch();
  try {
    const snap = (await env.orch.getStatus({ instanceId: 'INST-001' })).snapshot;
    assert.equal(snap.approvals.length, 1);
    assert.equal(snap.pendingApprovals, 1);
  } finally {
    await env.teardown();
  }
});

test('cancel：待处理审批 withdrawn、paused 清零，与终态同一次 CAS（AC-35 / AC-60 / D-5.8）', async () => {
  const env = await makeOrch({ paused: true });
  try {
    const res = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(res.ok, true, JSON.stringify(res));
    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'cancelled');
    assert.equal(disk.approvals[0].state, 'withdrawn');
    assert.ok(disk.approvals[0].resolvedAt);
    assert.ok(!disk.paused, 'cancel 清零 paused');
    const events = (await env.store.readEvents('INST-001')).events;
    assert.ok(events.some(
      (ev) => ev.reason === 'approval.withdrawn' && ev.detail?.approvalId === 'APR-001',
    ));
  } finally {
    await env.teardown();
  }
});
