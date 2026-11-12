/**
 * Node board contract tests (I1.10a WP-5).
 *
 * AC-24 anchor: ten snapshot nodes — two pending (one with an unfinished
 * upstream), one running, one review, two done, one failed, one escalated,
 * two cancelled. The seven columns keep their fixed order and verbatim
 * names; the blocked/ready split of the single pending state follows U-8
 * (all forward predecessors done, or none, -> ready); both cancelled cards
 * fold into the done column with the frozen `已取消 2` fold label; switching
 * back to the graph view keeps zoom, pan, drag offsets and focus intact,
 * and the projection never mutates its inputs or adds a state field.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD_COLUMNS, projectBoard } from '../../desktop/ui/board/board.js';
import { createViewState } from '../../desktop/ui/graph/view.js';
import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { buildGraph } from '../../src/daemon/graph.js';

/** AC-24 fixture: ten snapshot nodes over a small forward chain. */
function ac24State() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    nodes: [
      { nodeId: 'P-001', state: 'pending', round: 0 }, // upstream R-001 not done
      { nodeId: 'P-002', state: 'pending', round: 0 }, // no predecessors
      { nodeId: 'R-001', state: 'running', round: 1 },
      { nodeId: 'V-001', state: 'review', round: 1 },
      { nodeId: 'D-001', state: 'done', round: 1 },
      { nodeId: 'D-002', state: 'done', round: 1 },
      { nodeId: 'F-001', state: 'failed', round: 2 },
      { nodeId: 'X-001', state: 'escalated', round: 1 },
      { nodeId: 'C-001', state: 'cancelled', round: 0 },
      { nodeId: 'C-002', state: 'cancelled', round: 0 },
    ],
    handoffs: [],
    escalations: [],
  };
}

function ac24Graph() {
  return {
    rev: 5,
    nodes: [
      { id: 'P-001', type: 'role', title: '待执行一' },
      { id: 'P-002', type: 'role', title: '待执行二' },
      { id: 'R-001', type: 'role', title: '执行中' },
      { id: 'V-001', type: 'role', title: '待校验' },
      { id: 'D-001', type: 'role', title: '已完成一' },
      { id: 'D-002', type: 'role', title: '已完成二' },
      { id: 'F-001', type: 'role', title: '失败' },
      { id: 'X-001', type: 'role', title: '已升级' },
      { id: 'C-001', type: 'role', title: '已取消一' },
      { id: 'C-002', type: 'role', title: '已取消二' },
    ],
    edges: [
      { id: 'E-01', from: 'R-001', to: 'P-001', direction: 'forward' },
      { id: 'E-02', from: 'R-001', to: 'V-001', direction: 'forward' },
    ],
  };
}

function cardsIn(board, column) {
  return board.cards.filter((card) => card.column === column).map((card) => card.id);
}

test('AC-24: the seven columns keep their fixed id order and verbatim names', () => {
  const board = projectBoard({ state: ac24State(), graph: ac24Graph(), labels: DESKTOP_LABEL_KEYS });
  assert.deepEqual(board.columns, ['blocked', 'ready', 'running', 'review', 'done', 'failed', 'escalated']);
  assert.deepEqual(BOARD_COLUMNS, board.columns);
  assert.deepEqual(board.columnNames, ['被阻塞', '可调度', '执行中', '待校验', '已完成', '失败', '已升级']);
  assert.deepEqual(board.columnNames, [
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_BLOCKED,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_READY,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_RUNNING,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_REVIEW,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_DONE,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_FAILED,
    DESKTOP_LABEL_KEYS.DESKTOP_BOARD_COLUMN_ESCALATED,
  ]);
});

test('AC-24: the single pending state derives into blocked and ready per U-8', () => {
  const board = projectBoard({ state: ac24State(), graph: ac24Graph(), labels: DESKTOP_LABEL_KEYS });
  // P-001: upstream R-001 is running (not done) -> blocked.
  // P-002: no forward predecessors -> ready.
  assert.deepEqual(cardsIn(board, 'blocked'), ['P-001']);
  assert.deepEqual(cardsIn(board, 'ready'), ['P-002']);
  assert.deepEqual(cardsIn(board, 'running'), ['R-001']);
  assert.deepEqual(cardsIn(board, 'review'), ['V-001']);
  assert.deepEqual(cardsIn(board, 'failed'), ['F-001']);
  assert.deepEqual(cardsIn(board, 'escalated'), ['X-001']);
});

test('AC-24: both cancelled cards fold into done with the frozen fold label', () => {
  const board = projectBoard({ state: ac24State(), graph: ac24Graph(), labels: DESKTOP_LABEL_KEYS });
  assert.deepEqual(cardsIn(board, 'done'), ['D-001', 'D-002', 'C-001', 'C-002']);
  const folded = board.cards.filter((card) => card.folded).map((card) => card.id);
  assert.deepEqual(folded, ['C-001', 'C-002']);
  assert.equal(board.cancelledCount, 2);
  assert.equal(board.cancelledFold, '已取消 2');
  assert.equal(board.cancelledFold, DESKTOP_LABEL_KEYS.DESKTOP_BOARD_CANCELLED_FOLD.replace('{n}', '2'));
});

test('AC-24: card titles resolve from the graph projection', () => {
  const board = projectBoard({ state: ac24State(), graph: ac24Graph(), labels: DESKTOP_LABEL_KEYS });
  const byId = new Map(board.cards.map((card) => [card.id, card]));
  assert.equal(byId.get('P-001').title, '待执行一');
  assert.equal(byId.get('P-001').state, 'pending');
  assert.equal(byId.get('C-002').folded, true);
});

test('AC-24: the frozen WP-4 shape (role:<id>, empty nodeIds) gates pending correctly', () => {
  // Real buildGraph projection: role display ids are `role:<roleId>` and role
  // nodeIds stay empty, so the upstream derivation must resolve through the
  // snapshot nodes' roleId. T-001 done -> T-002 ready; T-002 still pending
  // -> T-003 blocked.
  const def = {
    id: 'gate-flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'alpha', order: 0 },
      { id: 'T-002', node_type: 'role', role: 'beta', order: 1 },
      { id: 'T-003', node_type: 'role', role: 'gamma', order: 2 },
    ],
    edges: [
      { from: 'T-001', to: 'T-002' },
      { from: 'T-002', to: 'T-003' },
    ],
  };
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-GATE',
    nodes: [
      { nodeId: 'T-001', roleId: 'alpha', state: 'done', round: 1 },
      { nodeId: 'T-002', roleId: 'beta', state: 'pending', round: 0 },
      { nodeId: 'T-003', roleId: 'gamma', state: 'pending', round: 0 },
    ],
    handoffs: [],
    escalations: [],
  };
  const graph = buildGraph({ state, workflowDef: def, roles: {}, traces: [], events: [] });
  const board = projectBoard({ state, graph, labels: DESKTOP_LABEL_KEYS });
  const byId = new Map(board.cards.map((card) => [card.id, card]));
  assert.equal(byId.get('T-002').column, 'ready'); // upstream T-001 is done
  assert.equal(byId.get('T-003').column, 'blocked'); // upstream T-002 not done yet
  assert.equal(byId.get('T-002').title, 'beta'); // title resolves through roleId
});

test('AC-24: switching back to the graph view keeps every view-state field', () => {
  const view = createViewState({ nodes: ac24Graph().nodes, edges: ac24Graph().edges });
  view.setZoom(1.5);
  view.setPan(120, -40);
  view.applyOffsets({ 'P-001': { dx: 10, dy: -4 } });
  view.focus('V-001');

  const snapshotBefore = {
    zoom: view.getZoom(),
    pan: view.getPan(),
    offsets: view.getOffsets(),
    focus: view.getFocus(),
    visible: view.visibleNodeIds(),
    edges: view.visibleEdges().map((edge) => edge.id),
  };

  projectBoard({ state: ac24State(), graph: ac24Graph(), labels: DESKTOP_LABEL_KEYS });

  assert.deepEqual(
    {
      zoom: view.getZoom(),
      pan: view.getPan(),
      offsets: view.getOffsets(),
      focus: view.getFocus(),
      visible: view.visibleNodeIds(),
      edges: view.visibleEdges().map((edge) => edge.id),
    },
    snapshotBefore,
  );
});

test('AC-24: the projection adds no state field and never mutates its inputs', () => {
  const state = ac24State();
  const graph = ac24Graph();
  const before = JSON.stringify({ state, graph });
  projectBoard({ state, graph, labels: DESKTOP_LABEL_KEYS });
  assert.equal(JSON.stringify({ state, graph }), before);
  const board = projectBoard({ state, graph, labels: DESKTOP_LABEL_KEYS });
  assert.equal(board.cards.length, 10); // one card per snapshot node, none dropped
});
