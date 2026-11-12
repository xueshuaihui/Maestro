/**
 * Edge aggregation tests (I1.10a WP-4, AC-16).
 *
 * Anchors: one forward line and one backflow arc per role pair (never a third
 * same-direction line), the backflow aggregate is the strongest handoff state,
 * parallel handoffs of the same round merge into one line, and the aggregate
 * priority is locked by a full 7x7 state-pair table driven off
 * `AGGREGATE_PRIORITY` (the same order the CLI side freezes; two
 * implementations, one order, both pinned by tests).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AGGREGATE_PRIORITY, buildGraph } from '../../src/daemon/graph.js';

const HANDOFF_STATES = Object.freeze([
  'rejected',
  'expired',
  'pending',
  'delivered',
  'accepted',
  'consumed',
]);

/** Minimal running-instance snapshot around two roles with a two-node loop. */
function stateWith(handoffs) {
  return {
    schemaVersion: 2,
    instanceId: 'INST-AGG',
    template: 'pair-flow',
    state: 'running',
    workflowRef: 'pair-flow',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'dev', state: 'done', round: 1 },
      { nodeId: 'T-002', roleId: 'qa', state: 'running', round: 1 },
    ],
    sessions: [],
    handoffs,
    escalations: [],
  };
}

const DEF = {
  id: 'pair-flow',
  nodes: [
    { id: 'T-001', node_type: 'role', role: 'dev', order: 0 },
    { id: 'T-002', node_type: 'role', role: 'qa', order: 1 },
  ],
  edges: [
    { from: 'T-001', to: 'T-002' },
    { from: 'T-002', to: 'T-001', kind: 'backflow' },
  ],
};

function project(handoffs) {
  return buildGraph({ state: stateWith(handoffs), workflowDef: DEF, roles: {} });
}

const forward = (graph) => graph.edges.find((edge) => edge.direction === 'forward');
const backflow = (graph) => graph.edges.find((edge) => edge.direction === 'backflow');

test('AC-16: three backflow handoffs collapse into one rejected arc, two parallel forwards into one line', () => {
  const graph = project([
    { handoffId: 'HO-001', edge: { from: 'T-002', to: 'T-001', kind: 'backflow' }, state: 'rejected', round: 1 },
    { handoffId: 'HO-002', edge: { from: 'T-002', to: 'T-001', kind: 'backflow' }, state: 'accepted', round: 2 },
    { handoffId: 'HO-003', edge: { from: 'T-002', to: 'T-001', kind: 'backflow' }, state: 'consumed', round: 3 },
    { handoffId: 'HO-004', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
    { handoffId: 'HO-005', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
  ]);

  // The role pair owns exactly two lines: one forward, one backflow arc.
  assert.equal(graph.edges.length, 2);
  assert.notEqual(forward(graph), undefined);
  assert.notEqual(backflow(graph), undefined);

  // The arc shows the strongest state of all rounds, the latest round only.
  assert.equal(backflow(graph).aggregateStatus, 'rejected');
  assert.equal(backflow(graph).latestRound, 3);
  assert.equal(backflow(graph).parallelCount, 1); // the latest round carries one handoff
  assert.deepEqual(backflow(graph).handoffIds, ['HO-001', 'HO-002', 'HO-003']);

  // Same-round parallel handoffs merge and count.
  assert.equal(forward(graph).aggregateStatus, 'delivered');
  assert.equal(forward(graph).parallelCount, 2);
  assert.equal(forward(graph).latestRound, 1);
  assert.deepEqual(forward(graph).handoffIds, ['HO-004', 'HO-005']);
});

test('AC-16: no third same-direction line exists for the role pair', () => {
  const graph = project([
    { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
    { handoffId: 'HO-002', edge: { from: 'T-001', to: 'T-002', kind: 'retest' }, state: 'delivered', round: 2 },
  ]);
  const forwardLines = graph.edges.filter((edge) => edge.direction === 'forward');
  assert.equal(forwardLines.length, 1);
  // A retest handoff travels forward but keeps its own round in latestRound.
  assert.equal(forwardLines[0].latestRound, 2);
  assert.equal(forwardLines[0].parallelCount, 1);
});

test('AC-16: aggregate priority is table-driven over all 7x7 state pairs', () => {
  for (const first of HANDOFF_STATES) {
    for (const second of HANDOFF_STATES) {
      const graph = project([
        { handoffId: 'HO-A', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: first, round: 1 },
        { handoffId: 'HO-B', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: second, round: 1 },
      ]);
      const expected = AGGREGATE_PRIORITY.indexOf(first) <= AGGREGATE_PRIORITY.indexOf(second)
        ? first
        : second;
      assert.equal(
        forward(graph).aggregateStatus,
        expected,
        `${first} vs ${second} must aggregate to ${expected}`,
      );
    }
  }
});

test('AC-16: two same-direction definition edges between one role pair merge into a single line', () => {
  const def = {
    id: 'wide-flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'dev', order: 0 },
      { id: 'T-002', node_type: 'role', role: 'qa', order: 1 },
      { id: 'T-003', node_type: 'role', role: 'dev', order: 2 },
      { id: 'T-004', node_type: 'role', role: 'qa', order: 3 },
    ],
    edges: [
      { from: 'T-001', to: 'T-002' },
      { from: 'T-003', to: 'T-004' },
    ],
  };
  const graph = buildGraph({
    state: stateWith([]),
    workflowDef: def,
    roles: {},
  });
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].parallelCount, 0);
  assert.equal(graph.edges[0].aggregateStatus, 'not_started');
});

test('definition edges without handoffs are not_started and stay hidden by default', () => {
  const graph = project([]);
  assert.equal(graph.edges.length, 2);
  for (const edge of graph.edges) {
    assert.equal(edge.aggregateStatus, 'not_started');
    assert.equal(edge.parallelCount, 0);
    assert.equal(edge.latestRound, null);
    assert.deepEqual(edge.handoffIds, []);
    assert.equal(edge.labelVisible, false);
    assert.equal(edge.direction, edge === backflow(graph) ? 'backflow' : 'forward');
  }
});

test('handoffs without a matching definition edge are not drawn; edge ids are stable', () => {
  const graph = project([
    { handoffId: 'HO-404', edge: { from: 'T-009', to: 'T-002', kind: 'forward' }, state: 'rejected', round: 1 },
    { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
  ]);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(
    graph.edges.map((edge) => edge.id),
    ['E-01', 'E-02'],
  );
  const drawn = forward(graph);
  assert.deepEqual(drawn.handoffIds, ['HO-001']);
  assert.equal(drawn.aggregateStatus, 'delivered');
});

test('handoff states outside the aggregate set degrade to pending, not to an unknown token', () => {
  const graph = project([
    { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'created', round: 1 },
  ]);
  assert.equal(forward(graph).aggregateStatus, 'pending');
  assert.equal(forward(graph).labelVisible, true);
});

test('parallelCount counts only the latest round; earlier rounds stay in handoffIds', () => {
  const graph = project([
    { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
    { handoffId: 'HO-002', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 2 },
    { handoffId: 'HO-003', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 2 },
  ]);
  const line = forward(graph);
  assert.equal(line.latestRound, 2);
  assert.equal(line.parallelCount, 2);
  assert.deepEqual(line.handoffIds, ['HO-001', 'HO-002', 'HO-003']);
});
