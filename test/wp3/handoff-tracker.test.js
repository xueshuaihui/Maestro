import assert from 'node:assert/strict';
import test from 'node:test';

import { REJECT_REASONS, createHandoffTracker } from '../../src/adapter/handoff-tracker.js';

test('accepted 只认 turn 内事件：噪声帧先到仍停在 delivered', () => {
  const events = [];
  const tracker = createHandoffTracker({
    handoffId: 'HO-001',
    startedAt: 1000,
    emit: (ev) => events.push(ev),
  });

  assert.equal(tracker.state(), 'created');
  assert.deepEqual(tracker.created({ atMs: 1000 }), {
    ok: true,
    state: 'created',
    createdAt: new Date(1000).toISOString(),
  });

  const delivered = tracker.delivered({ atMs: 1002 });
  assert.equal(delivered.ok, true);
  assert.equal(delivered.state, 'delivered');

  for (const name of ['usage_update', 'available_commands_update', 'hologram_update']) {
    const observed = tracker.observeTurnEvent({ name, atMs: 1100 });
    assert.equal(observed.state, 'delivered', name);
    assert.equal(observed.ignored, true, name);
    assert.equal(observed.noise, true, name);
    assert.equal(tracker.state(), 'delivered', name);
  }

  const accepted = tracker.observeTurnEvent({ name: 'agent_thought_chunk', atMs: 1065 });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.acceptedSignal, 'agent_thought_chunk');
  assert.equal(accepted.ambiguityWindowMs, 63);
  assert.ok(accepted.ambiguityWindowMs >= 0);

  const snap = tracker.snapshot();
  assert.equal(snap.state, 'accepted');
  assert.equal(snap.acceptedSignal, 'agent_thought_chunk');
  assert.equal(snap.ambiguityWindowMs, 63);
  assert.equal(snap.timestamps.deliveredAt, new Date(1002).toISOString());
  assert.equal(snap.timestamps.acceptedAt, new Date(1065).toISOString());

  // emitted 事件与 events.jsonl 同构：只记录真实迁移
  const acceptedEvent = events.find((e) => e.to === 'accepted');
  assert.equal(acceptedEvent.object, 'handoff');
  assert.equal(acceptedEvent.objectId, 'HO-001');
  assert.equal(acceptedEvent.from, 'delivered');
  assert.equal(acceptedEvent.reason, 'turn.first_event');
  assert.equal(acceptedEvent.detail.ambiguityWindowMs, 63);
  assert.equal(events.filter((e) => e.result === 'applied').length, 3); // created/delivered/accepted
});

test('拒绝原因必须可区分（AC-11；I1.4 增内容不合规与投递失败）', () => {
  assert.deepEqual(REJECT_REASONS, [
    'target_rejected',
    'permission_denied',
    'withdrawn',
    'invalid_payload',
    'delivery_failed',
  ]);

  for (const reason of REJECT_REASONS) {
    const tracker = createHandoffTracker({ handoffId: `HO-${reason}`, startedAt: 1000 });
    tracker.created({ atMs: 1000 });
    tracker.delivered({ atMs: 1010 });
    const result = tracker.rejected({ reason, atMs: 1020 });
    assert.equal(result.ok, true, reason);
    assert.equal(result.state, 'rejected');
    assert.equal(result.reason, reason);
    assert.equal(tracker.snapshot().rejectReason, reason);
  }

  const tracker = createHandoffTracker({ handoffId: 'HO-bad', startedAt: 1 });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2 });
  const bad = tracker.rejected({ reason: 'timeout', atMs: 3 });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'INVALID_REASON');
  assert.equal(tracker.state(), 'delivered');
});

test('迁移表外一律拒绝，且 accepted 不能先于 delivered', () => {
  const tracker = createHandoffTracker({ handoffId: 'HO-002', startedAt: 1 });

  const early = tracker.observeTurnEvent({ name: 'tool_call', atMs: 5 });
  assert.equal(early.state, 'created');
  assert.equal(early.ignored, true);
  assert.equal(tracker.state(), 'created');

  assert.equal(tracker.consumed({ atMs: 6 }).ok, false);
  assert.equal(tracker.consumed({ atMs: 6 }).code, 'ILLEGAL_TRANSITION');

  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2 });
  assert.equal(tracker.consumed({ atMs: 3 }).ok, false);

  tracker.observeTurnEvent({ name: 'tool_call', atMs: 4 });
  const consumed = tracker.consumed({ atMs: 5 });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.state, 'consumed');

  // 终态不再接受任何迁移
  assert.equal(tracker.rejected({ reason: 'withdrawn', atMs: 6 }).ok, false);
  assert.equal(tracker.delivered({ atMs: 7 }).ok, false);
});

test('无 TTL：过期只能由迁移表拒绝，没有任何定时器产生 expired', async () => {
  const tracker = createHandoffTracker({ handoffId: 'HO-003', startedAt: 1 });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2 });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(tracker.state(), 'delivered');
  assert.equal(tracker.snapshot().timestamps.rejectedAt, null);
  assert.equal(tracker.can('expired'), false);
});

// --- I1.4 D-2 / D-4：投递重试链路 ---------------------------------------------

test('created 可以直接拒绝（校验失败 / 信箱写失败），不发 delivered', () => {
  const events = [];
  const tracker = createHandoffTracker({
    handoffId: 'HO-010',
    startedAt: 1,
    emit: (ev) => events.push(ev),
  });
  tracker.created({ atMs: 1 });

  for (const reason of ['invalid_payload', 'delivery_failed']) {
    const fresh = createHandoffTracker({ handoffId: `HO-${reason}`, startedAt: 1 });
    fresh.created({ atMs: 1 });
    assert.equal(fresh.can('rejected'), true);
    const res = fresh.rejected({ reason, atMs: 2 });
    assert.equal(res.ok, true, reason);
    assert.equal(res.state, 'rejected');
    assert.equal(fresh.snapshot().rejectReason, reason);
  }

  const res = tracker.rejected({ reason: 'invalid_payload', atMs: 2 });
  assert.equal(res.ok, true);
  assert.deepEqual(
    events.map((ev) => `${ev.from}->${ev.to}`),
    ['null->created', 'created->rejected'],
  );
});

test('delivered → pending 回落：写 pendingAt / deliveryAttempts / lastError', () => {
  const tracker = createHandoffTracker({ handoffId: 'HO-011', startedAt: 1 });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2, attempt: 1 });

  const res = tracker.pending({ atMs: 3, attempt: 1, lastError: 'mock: prompt failed' });
  assert.equal(res.ok, true);
  assert.equal(res.state, 'pending');
  assert.equal(res.deliveryAttempts, 1);
  assert.equal(res.lastError, 'mock: prompt failed');

  const snap = tracker.snapshot();
  assert.equal(snap.state, 'pending');
  assert.equal(snap.deliveryAttempts, 1);
  assert.equal(snap.pendingAt, new Date(3).toISOString());
  assert.equal(snap.expiredAt, null);
  assert.equal(snap.lastError, 'mock: prompt failed');
});

test('pending → delivered（重试成功）：attempt 写入尝试数并保留投递时间', () => {
  const events = [];
  const tracker = createHandoffTracker({
    handoffId: 'HO-012',
    startedAt: 1,
    emit: (ev) => events.push(ev),
  });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2, attempt: 1 });
  tracker.pending({ atMs: 3, attempt: 1, lastError: 'first failure' });

  const res = tracker.delivered({ atMs: 4, attempt: 2 });
  assert.equal(res.ok, true);
  assert.equal(res.state, 'delivered');
  assert.equal(res.deliveryAttempts, 2);

  const snap = tracker.snapshot();
  assert.equal(snap.deliveryAttempts, 2);
  assert.equal(snap.timestamps.deliveredAt, new Date(4).toISOString());

  const delivered = events.filter((ev) => ev.to === 'delivered');
  assert.equal(delivered.length, 2);
  assert.equal(delivered[1].from, 'pending');
  assert.equal(delivered[1].detail.attempt, 2);
});

test('pending → expired：3 次尝试耗尽写 expiredAt 与最后错误', () => {
  const events = [];
  const tracker = createHandoffTracker({
    handoffId: 'HO-013',
    startedAt: 1,
    emit: (ev) => events.push(ev),
  });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2, attempt: 1 });
  tracker.pending({ atMs: 3, attempt: 1, lastError: 'e1' });
  tracker.pending({ atMs: 4, attempt: 2, lastError: 'e2' });

  const res = tracker.expired({ atMs: 5, attempts: 3 });
  assert.equal(res.ok, true);
  assert.equal(res.state, 'expired');

  const snap = tracker.snapshot();
  assert.equal(snap.deliveryAttempts, 3);
  assert.equal(snap.expiredAt, new Date(5).toISOString());
  assert.equal(snap.lastError, 'e2');

  const expired = events.filter((ev) => ev.reason === 'handoff.expired');
  assert.equal(expired.length, 1);
  assert.equal(expired[0].detail.deliveryAttempts, 3);
  assert.equal(expired[0].detail.lastError, 'e2');

  // 终态不再接受迁移；pending 之外的来源也进不去。
  assert.equal(tracker.pending({ atMs: 6 }).ok, false);
  const fresh = createHandoffTracker({ handoffId: 'HO-014', startedAt: 1 });
  fresh.created({ atMs: 1 });
  assert.equal(fresh.expired({ atMs: 2 }).code, 'ILLEGAL_TRANSITION');
});

test('delivered 未传 attempt 时不改尝试数（旧调用兼容）', () => {
  const tracker = createHandoffTracker({ handoffId: 'HO-015', startedAt: 1 });
  tracker.created({ atMs: 1 });
  tracker.delivered({ atMs: 2 });

  const snap = tracker.snapshot();
  assert.equal(snap.deliveryAttempts, 0);
  assert.equal(snap.pendingAt, null);
  assert.equal(snap.lastError, null);
});
