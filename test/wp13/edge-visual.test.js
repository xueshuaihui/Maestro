/**
 * Edge visual token tests (I1.10a WP-4, AC-15).
 *
 * The A-11 table is frozen value by value: color, dash, arrow, animation and
 * badge for each of the seven aggregate states, plus the default label
 * visibility and the not-started toggle (`edgeHidden`). Colors and animation
 * are derived from the aggregate status only — never from line counts or
 * positions — so every assertion here goes through a projected edge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { EDGE_VISUAL, buildGraph, edgeHidden } from '../../src/daemon/graph.js';

/** A-11 verbatim expectation, written out here instead of importing the constant. */
const A11_TABLE = Object.freeze({
  rejected: Object.freeze({ color: 'red', dash: 'solid', arrow: 'back', animation: 'none', badge: null, labelVisible: true }),
  expired: Object.freeze({ color: 'orange', dash: 'dashed', arrow: 'forward', animation: 'none', badge: '!', labelVisible: true }),
  pending: Object.freeze({ color: 'yellow', dash: 'dashed', arrow: 'forward', animation: 'none', badge: null, labelVisible: true }),
  delivered: Object.freeze({ color: 'blue', dash: 'solid', arrow: 'forward', animation: 'flow', badge: null, labelVisible: false }),
  accepted: Object.freeze({ color: 'blue', dash: 'solid', arrow: 'forward', animation: 'none', badge: null, labelVisible: false }),
  consumed: Object.freeze({ color: 'green', dash: 'solid', arrow: 'forward', animation: 'none', badge: null, labelVisible: false }),
  not_started: Object.freeze({ color: 'gray', dash: 'dashed', arrow: 'forward', animation: 'none', badge: null, labelVisible: false }),
});

const AGGREGATE_STATES = Object.freeze(Object.keys(A11_TABLE));

const DEF = {
  id: 'visual-flow',
  nodes: [
    { id: 'T-001', node_type: 'role', role: 'dev', order: 0 },
    { id: 'T-002', node_type: 'role', role: 'qa', order: 1 },
    { id: 'T-003', node_type: 'role', role: 'ops', order: 2 },
    { id: 'T-004', node_type: 'role', role: 'rel', order: 3 },
    { id: 'T-005', node_type: 'role', role: 'sec', order: 4 },
    { id: 'T-006', node_type: 'role', role: 'net', order: 5 },
    { id: 'T-007', node_type: 'role', role: 'obs', order: 6 },
    { id: 'T-008', node_type: 'role', role: 'doc', order: 7 },
  ],
  edges: [
    { from: 'T-001', to: 'T-002' },
    { from: 'T-002', to: 'T-003' },
    { from: 'T-003', to: 'T-004' },
    { from: 'T-004', to: 'T-005' },
    { from: 'T-005', to: 'T-006' },
    { from: 'T-006', to: 'T-007' },
    { from: 'T-007', to: 'T-008' },
  ],
};

function project(states) {
  // A `null` entry means the definition edge carries no handoff at all, which
  // is the only way a line reaches `not_started` (D-3: no handoff -> not_started).
  const handoffs = [];
  states.forEach((state, index) => {
    if (state === null) return;
    handoffs.push({
      handoffId: `HO-${String(index + 1).padStart(3, '0')}`,
      edge: { from: `T-00${index + 1}`, to: `T-00${index + 2}`, kind: 'forward' },
      state,
      round: 1,
    });
  });
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-VIS',
    template: 'visual-flow',
    state: 'running',
    workflowRef: 'visual-flow',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: DEF.nodes.map((node) => ({
      nodeId: node.id,
      roleId: node.role,
      state: 'pending',
      round: 0,
    })),
    sessions: [],
    handoffs,
    escalations: [],
  };
  return buildGraph({ state, workflowDef: DEF, roles: {} });
}

test('EDGE_VISUAL equals the A-11 table value by value', () => {
  assert.deepEqual(Object.keys(EDGE_VISUAL).sort(), [...AGGREGATE_STATES].sort());
  for (const status of AGGREGATE_STATES) {
    const { labelVisible, ...tokens } = A11_TABLE[status];
    assert.deepEqual(EDGE_VISUAL[status], tokens, `token mismatch for ${status}`);
  }
});

test('AC-15: seven lines in seven states carry exactly the A-11 tokens', () => {
  // The not_started line comes from an edge without handoffs; the other six
  // edges each carry one handoff frozen in its aggregate state.
  const graph = project([
    'rejected',
    'expired',
    'pending',
    'delivered',
    'accepted',
    'consumed',
    null,
  ]);
  assert.equal(graph.edges.length, 7);
  for (const edge of graph.edges) {
    const expected = A11_TABLE[edge.aggregateStatus];
    assert.notEqual(expected, undefined, `unexpected aggregate ${edge.aggregateStatus}`);
    assert.deepEqual(
      {
        color: edge.visual.color,
        dash: edge.visual.dash,
        arrow: edge.visual.arrow,
        animation: edge.visual.animation,
        badge: edge.visual.badge,
        labelVisible: edge.labelVisible,
      },
      expected,
      `visual mismatch for ${edge.aggregateStatus}`,
    );
  }
  // All seven states are covered exactly once.
  assert.deepEqual(
    graph.edges.map((edge) => edge.aggregateStatus).sort(),
    [...AGGREGATE_STATES].sort(),
  );
});

test('AC-15: rejected always renders the backflow arrow even on a forward line', () => {
  const graph = project(['rejected']);
  const edge = graph.edges[0];
  assert.equal(edge.direction, 'forward');
  assert.equal(edge.visual.color, 'red');
  assert.equal(edge.visual.arrow, 'back');
  assert.equal(edge.visual.animation, 'none');
  assert.equal(edge.labelVisible, true);
});

test('AC-15: not_started is hidden by default and appears once the toggle is on', () => {
  const graph = project([null]);
  const edge = graph.edges[0];
  assert.equal(edge.aggregateStatus, 'not_started');
  assert.equal(edgeHidden(edge), true);
  assert.equal(edgeHidden(edge, { showNotStarted: true }), false);
  // The toggle never hides the six non-default states.
  for (const status of AGGREGATE_STATES.filter((entry) => entry !== 'not_started')) {
    const line = project([status]).edges[0];
    assert.equal(edgeHidden(line), false);
    assert.equal(edgeHidden(line, { showNotStarted: true }), false);
  }
});

test('visual tokens are stable across rebuilds of the same input', () => {
  const graph = project(['delivered', 'expired']);
  const again = project(['delivered', 'expired']);
  assert.equal(JSON.stringify(graph.edges), JSON.stringify(again.edges));
});

test('label visibility defaults match the A-11 last column', () => {
  const graph = project([
    'rejected',
    'expired',
    'pending',
    'delivered',
    'accepted',
    'consumed',
    null,
  ]);
  const visible = graph.edges
    .filter((edge) => edge.labelVisible)
    .map((edge) => edge.aggregateStatus)
    .sort();
  assert.deepEqual(visible, ['expired', 'pending', 'rejected']);
});
