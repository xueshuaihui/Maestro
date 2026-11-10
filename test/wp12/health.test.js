/**
 * WP-3 contract tests for computeHealth (I1.9 / D-8 / AC-13 / AC-14 / AC-15).
 *
 * Pure in-memory objects only: no disk access, no repository directories.
 * Every time-based assertion injects a fixed `now` so the exact-equality
 * boundaries (30000 / 50000 / 900000) are reproducible.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeHealth,
  normal,
  slow,
  attention,
  ended,
  pending_escalation,
  node_timeout,
  session_crash,
  role_unavailable,
  connection_rejected,
  connection_expired,
  p90_exceeded,
  handoff_ttl_half,
  HEALTH_LEVELS,
  HEALTH_REASONS,
  HEALTH_CONTRACT,
} from '../../src/core/health.js';

const NOW = 1_700_000_000_000;

/** Minimal running-state snapshot; override only what a case needs. */
function stateWith(overrides = {}) {
  return {
    state: 'running',
    nodes: [],
    sessions: [],
    handoffs: [],
    escalations: [],
    health: { nodeTimeoutMs: 30000 },
    ...overrides,
  };
}

function compute(state, { now = NOW, graph = null, traces = [] } = {}) {
  return computeHealth({ state, graph, traces, now });
}

/** Finished spans of the given durations (start_time 0, end_time = duration). */
function tracesWithDurations(durations) {
  return durations.map((d, i) => ({
    trace_id: `TRC-0000000${i}`,
    instance_id: 'INST-001',
    node_id: `T-${i}`,
    round: 1,
    start_time: 0,
    end_time: d,
    status: 'done',
  }));
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) deepFreeze(obj[key]);
  }
  return obj;
}

// ---------------------------------------------------------------------------
// 1. Exported contract: 4 levels, 8 reason codes, frozen order.
// ---------------------------------------------------------------------------
test('exports: 4 levels + 8 reason codes verbatim, frozen tables, fixed order', () => {
  assert.strictEqual(normal, 'normal');
  assert.strictEqual(slow, 'slow');
  assert.strictEqual(attention, 'attention');
  assert.strictEqual(ended, 'ended');

  assert.strictEqual(pending_escalation, 'pending_escalation');
  assert.strictEqual(node_timeout, 'node_timeout');
  assert.strictEqual(session_crash, 'session_crash');
  assert.strictEqual(role_unavailable, 'role_unavailable');
  assert.strictEqual(connection_rejected, 'connection_rejected');
  assert.strictEqual(connection_expired, 'connection_expired');
  assert.strictEqual(p90_exceeded, 'p90_exceeded');
  assert.strictEqual(handoff_ttl_half, 'handoff_ttl_half');

  assert.deepStrictEqual(HEALTH_LEVELS, ['normal', 'slow', 'attention', 'ended']);
  assert.deepStrictEqual(HEALTH_REASONS, [
    'pending_escalation',
    'node_timeout',
    'session_crash',
    'role_unavailable',
    'connection_rejected',
    'connection_expired',
    'p90_exceeded',
    'handoff_ttl_half',
  ]);
  assert.ok(Object.isFrozen(HEALTH_LEVELS));
  assert.ok(Object.isFrozen(HEALTH_REASONS));
  assert.ok(Object.isFrozen(HEALTH_CONTRACT));
  assert.deepStrictEqual(HEALTH_CONTRACT.levels, HEALTH_LEVELS);
  assert.deepStrictEqual(HEALTH_CONTRACT.reasons, HEALTH_REASONS);
});

// ---------------------------------------------------------------------------
// 2. Equal-boundary group A: node timeout (AC-13 / BR-11).
// ---------------------------------------------------------------------------
test('node timeout: now - startedAt = 30000 (exact) -> NOT node_timeout', () => {
  const state = stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 30000 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
  assert.ok(!reasons.includes(node_timeout));
});

test('node timeout: now - startedAt = 30001 -> node_timeout', () => {
  const state = stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 30001 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, attention);
  assert.deepStrictEqual(reasons, [node_timeout]);
});

test('node timeout: missing health.nodeTimeoutMs falls back to 30000', () => {
  const state = stateWith({
    health: {},
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 31000 }],
  });
  assert.deepStrictEqual(compute(state).reasons, [node_timeout]);
});

// ---------------------------------------------------------------------------
// 3. Equal-boundary group B: P90 nearest-rank (AC-14 / BR-12 / BR-19).
// ---------------------------------------------------------------------------
test('P90: 5 samples -> P90 = 50000; node duration = 50000 (exact) -> NOT p90_exceeded', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000, 50000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 50000 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
  assert.ok(!reasons.includes(p90_exceeded));
});

test('P90: node duration = 50001 -> p90_exceeded', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000, 50000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 50001 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, slow);
  assert.deepStrictEqual(reasons, [p90_exceeded]);
});

test('P90: 4 samples (< 5) -> p90_exceeded never triggers even with a long node', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 70000 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
});

test('P90: spans missing start_time / end_time are not samples (AC-23 notime)', () => {
  const traces = [
    ...tracesWithDurations([10000, 20000, 30000, 40000]),
    { trace_id: 'TRC-notime', node_id: 'T-x', round: 1, status: 'done' },
  ];
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 70000 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
});

// ---------------------------------------------------------------------------
// 4. Equal-boundary group C: TTL 50% (AC-15 / BR-12 / BR-20 / B-3).
// ---------------------------------------------------------------------------
test('TTL: now - pendingAt = 900000 (exact) -> NOT handoff_ttl_half', () => {
  const state = stateWith({
    handoffs: [{ handoffId: 'HO-1', state: 'pending', pendingAt: NOW - 900000 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
  assert.ok(!reasons.includes(handoff_ttl_half));
});

test('TTL: now - pendingAt = 900001 -> handoff_ttl_half', () => {
  const state = stateWith({
    handoffs: [{ handoffId: 'HO-1', state: 'pending', pendingAt: NOW - 900001 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, slow);
  assert.deepStrictEqual(reasons, [handoff_ttl_half]);
});

test('TTL: now - pendingAt = 899999 -> NOT handoff_ttl_half', () => {
  const state = stateWith({
    handoffs: [{ handoffId: 'HO-1', state: 'pending', pendingAt: NOW - 899999 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, normal);
  assert.deepStrictEqual(reasons, []);
});

test('TTL: pending packet with no pendingAt / createdAt does not participate', () => {
  const state = stateWith({
    handoffs: [{ handoffId: 'HO-1', state: 'pending' }],
  });
  assert.deepStrictEqual(compute(state), { level: normal, reasons: [] });
});

test('TTL: createdAt is used when pendingAt is missing (B-3 fallback)', () => {
  const state = stateWith({
    handoffs: [{ handoffId: 'HO-1', state: 'pending', createdAt: NOW - 900001 }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, slow);
  assert.deepStrictEqual(reasons, [handoff_ttl_half]);
});

// ---------------------------------------------------------------------------
// 5. Terminal priority (AC-12 / BR-13).
// ---------------------------------------------------------------------------
test('terminal priority: completed with timeout node + escalation + rejected handoff -> ended', () => {
  const state = stateWith({
    state: 'completed',
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 31000 }],
    escalations: [{ state: 'pending' }],
    handoffs: [{ state: 'rejected' }],
  });
  assert.deepStrictEqual(compute(state), { level: ended, reasons: [] });
});

test('terminal priority: all four terminal states -> ended', () => {
  for (const terminal of ['completed', 'failed', 'cancelled', 'interrupted']) {
    const state = stateWith({ state: terminal, escalations: [{ state: 'pending' }] });
    assert.deepStrictEqual(compute(state), { level: ended, reasons: [] });
  }
});

// ---------------------------------------------------------------------------
// 6. Four levels, one explicit case each (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).
// ---------------------------------------------------------------------------
test('four levels: normal when there is no anomaly', () => {
  assert.deepStrictEqual(compute(stateWith()), { level: normal, reasons: [] });
});

test('four levels: attention on a single pending escalation', () => {
  const state = stateWith({ escalations: [{ state: 'pending' }] });
  assert.deepStrictEqual(compute(state), { level: attention, reasons: [pending_escalation] });
});

test('four levels: slow on a single TTL-exceeded pending handoff', () => {
  const state = stateWith({
    handoffs: [{ state: 'pending', pendingAt: NOW - 900001 }],
  });
  assert.deepStrictEqual(compute(state), { level: slow, reasons: [handoff_ttl_half] });
});

test('four levels: ended on a terminal instance', () => {
  assert.deepStrictEqual(compute(stateWith({ state: 'failed' })), { level: ended, reasons: [] });
});

// ---------------------------------------------------------------------------
// 7. Fixed reason order, priority, and no double counting.
// ---------------------------------------------------------------------------
test('multiple reasons: all six red conditions -> reasons in fixed order', () => {
  const state = stateWith({
    escalations: [{ state: 'pending' }],
    nodes: [
      { nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 31000 },
      { nodeId: 'T-2', roleId: 'r', state: 'failed' },
      { nodeId: 'T-3', roleId: 'r', state: 'review' },
    ],
    sessions: [
      { sessionId: 's1', nodeId: 'T-2', state: 'idle', quarantined: true },
      { sessionId: 's2', nodeId: 'T-3', state: 'escalated', quarantined: false },
    ],
    handoffs: [{ state: 'rejected' }, { state: 'expired' }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, attention);
  assert.deepStrictEqual(reasons, [
    pending_escalation,
    node_timeout,
    session_crash,
    role_unavailable,
    connection_rejected,
    connection_expired,
  ]);
});

test('red dominates yellow: red + two yellow signals -> attention, yellow codes omitted', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000, 50000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    escalations: [{ state: 'pending' }],
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 70000 }],
    handoffs: [{ state: 'pending', pendingAt: NOW - 900001 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, attention);
  assert.deepStrictEqual(reasons, [pending_escalation]);
  assert.ok(!reasons.includes(p90_exceeded));
  assert.ok(!reasons.includes(handoff_ttl_half));
});

test('two yellow conditions -> reasons in fixed order', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000, 50000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 70000 }],
    handoffs: [{ state: 'pending', pendingAt: NOW - 900001 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, slow);
  assert.deepStrictEqual(reasons, [p90_exceeded, handoff_ttl_half]);
});

// ---------------------------------------------------------------------------
// 8. Individual red mappings (AC-13 matrix alignment with B-4).
// ---------------------------------------------------------------------------
test('session_crash: quarantined session bound to a failed node', () => {
  const state = stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'failed' }],
    sessions: [{ sessionId: 's1', nodeId: 'T-1', state: 'idle', quarantined: true }],
  });
  assert.deepStrictEqual(compute(state), { level: attention, reasons: [session_crash] });
});

test('role_unavailable: escalated session (not quarantined)', () => {
  const state = stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'review' }],
    sessions: [{ sessionId: 's1', nodeId: 'T-1', state: 'escalated', quarantined: false }],
  });
  assert.deepStrictEqual(compute(state), { level: attention, reasons: [role_unavailable] });
});

test('quarantined + escalated session counted only as session_crash (no double count)', () => {
  const state = stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'failed' }],
    sessions: [{ sessionId: 's1', nodeId: 'T-1', state: 'escalated', quarantined: true }],
  });
  const { level, reasons } = compute(state);
  assert.strictEqual(level, attention);
  assert.deepStrictEqual(reasons, [session_crash]);
});

test('connection_rejected / connection_expired each map to their own code', () => {
  const rejected = stateWith({ handoffs: [{ state: 'rejected' }] });
  const expired = stateWith({ handoffs: [{ state: 'expired' }] });
  assert.deepStrictEqual(compute(rejected), { level: attention, reasons: [connection_rejected] });
  assert.deepStrictEqual(compute(expired), { level: attention, reasons: [connection_expired] });
});

// ---------------------------------------------------------------------------
// 9. AC-14 fixture premise: explicit nodeTimeoutMs = 300000 must not steal red.
// ---------------------------------------------------------------------------
test('AC-14 premise: nodeTimeoutMs = 300000 keeps a 70s node out of the red tier', () => {
  const traces = tracesWithDurations([10000, 20000, 30000, 40000, 50000]);
  const state = stateWith({
    health: { nodeTimeoutMs: 300000 },
    nodes: [{ nodeId: 'T-6', roleId: 'r', state: 'running', startedAt: NOW - 70000 }],
  });
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, slow);
  assert.deepStrictEqual(reasons, [p90_exceeded]);
  assert.ok(!reasons.includes(node_timeout));
});

// ---------------------------------------------------------------------------
// 10. ISO timestamps, defaults, purity, and closed level set.
// ---------------------------------------------------------------------------
test('ISO string timestamps are accepted (startedAt / pendingAt)', () => {
  const byNode = compute(stateWith({
    nodes: [{ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: new Date(NOW - 30001).toISOString() }],
  }));
  assert.strictEqual(byNode.level, attention);
  assert.deepStrictEqual(byNode.reasons, [node_timeout]);

  const byHandoff = compute(stateWith({
    handoffs: [{ state: 'pending', pendingAt: new Date(NOW - 900001).toISOString() }],
  }));
  assert.strictEqual(byHandoff.level, slow);
  assert.deepStrictEqual(byHandoff.reasons, [handoff_ttl_half]);
});

test('defaults: graph = null and traces = [] do not throw', () => {
  const implicit = computeHealth({ state: stateWith(), now: NOW });
  assert.deepStrictEqual(implicit, { level: normal, reasons: [] });
  const explicit = computeHealth({ state: stateWith(), graph: null, traces: [], now: NOW });
  assert.deepStrictEqual(explicit, { level: normal, reasons: [] });
});

test('defaults: no-argument call returns a valid shape', () => {
  const result = computeHealth();
  assert.ok(result && typeof result === 'object');
  assert.ok(HEALTH_LEVELS.includes(result.level));
  assert.ok(Array.isArray(result.reasons));
});

test('pure: does not mutate any argument (frozen inputs)', () => {
  const state = deepFreeze(stateWith({
    nodes: [deepFreeze({ nodeId: 'T-1', roleId: 'r', state: 'running', startedAt: NOW - 31000 })],
    escalations: [deepFreeze({ state: 'pending' })],
  }));
  const traces = deepFreeze(tracesWithDurations([10000, 20000, 30000, 40000, 50000]));
  const { level, reasons } = compute(state, { traces });
  assert.strictEqual(level, attention);
  assert.deepStrictEqual(reasons, [pending_escalation, node_timeout]);
});

test('level is always one of the four frozen values', () => {
  const cases = [
    stateWith(),
    stateWith({ state: 'completed' }),
    stateWith({ escalations: [{ state: 'pending' }] }),
    stateWith({ handoffs: [{ state: 'pending', pendingAt: NOW - 900001 }] }),
  ];
  for (const state of cases) {
    const { level } = compute(state);
    assert.ok(HEALTH_LEVELS.includes(level));
  }
});
