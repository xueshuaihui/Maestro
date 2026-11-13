/**
 * Abnormal element style tests (I1.10a WP-6; AC-23, collaboration AC-18).
 *
 * AC-23 anchor: a role node that gains an escalated node and a connection line
 * that turns rejected keep their geometry — width, height, x and y are equal
 * before and after — while the style tokens switch to the abnormality form:
 * node `animation === 'pulse'` with badge `escalated`, line `color === 'red'`
 * with `arrow === 'back'`, both lifted above their neighbours (z 1).
 *
 * The style projection returns `{ opacity, z, animation }` and nothing else:
 * geometry never travels through it, which is what keeps a pulse from
 * triggering a re-layout. Clearing the abnormality drops the tokens at once
 * with the same coordinates.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLayout } from '../../desktop/ui/graph/layout.js';
import { renderEdgeRow } from '../../desktop/ui/graph/edge-rows.js';
import { DIM_OPACITY, FULL_OPACITY, elementStyle } from '../../desktop/ui/graph/style.js';
import { buildGraph } from '../../src/daemon/graph.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const LABELS = UI_LABEL_KEYS;

const DEF = {
  id: 'abnormal-flow',
  nodes: [
    { id: 'A', node_type: 'role', role: 'dev', title: 'A', order: 0 },
    { id: 'B', node_type: 'role', role: 'qa', title: 'B', order: 1 },
  ],
  edges: [
    { from: 'A', to: 'B' },
    { from: 'B', to: 'A', kind: 'backflow' },
  ],
};

/** Two graphs that differ only in the abnormality of A and of the A->B line. */
function project({ abnormal = false } = {}) {
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-STYLE',
    template: 'abnormal-flow',
    state: 'running',
    workflowRef: 'abnormal-flow',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { nodeId: 'A', roleId: 'dev', state: abnormal ? 'escalated' : 'done', round: 1 },
      { nodeId: 'B', roleId: 'qa', state: 'running', round: 1 },
    ],
    sessions: [],
    handoffs: [
      {
        handoffId: 'HO-001',
        edge: { from: 'A', to: 'B', kind: 'forward' },
        state: abnormal ? 'rejected' : 'consumed',
        round: 1,
      },
      {
        handoffId: 'HO-002',
        edge: { from: 'B', to: 'A', kind: 'backflow' },
        state: 'consumed',
        round: 1,
      },
    ],
    escalations: [],
  };
  const roles = { dev: { id: 'dev', name: 'A' }, qa: { id: 'qa', name: 'B' } };
  return buildGraph({ state, workflowDef: DEF, roles });
}

function layoutOf(graph) {
  return computeLayout({ nodes: graph.nodes, edges: graph.edges });
}

function byId(list, id) {
  return list.find((entry) => entry.id === id);
}

test('AC-23: the abnormal node keeps width / height / x / y and gains the pulse token', () => {
  const clean = project();
  const abnormal = project({ abnormal: true });
  const cleanLayout = layoutOf(clean);
  const abnormalLayout = layoutOf(abnormal);

  const before = byId(cleanLayout.nodes, 'role:dev');
  const after = byId(abnormalLayout.nodes, 'role:dev');
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);

  const node = byId(abnormal.nodes, 'role:dev');
  const style = elementStyle(node, { hoveredKey: null });
  assert.equal(style.animation, 'pulse');
  assert.equal(style.z, 1);
  assert.equal(node.abnormalCount, 1);
});

test('AC-23: the rejected line turns red with the backflow arrow and lifts', () => {
  const abnormal = project({ abnormal: true });
  const line = abnormal.edges.find((edge) => edge.direction === 'forward');
  assert.equal(line.aggregateStatus, 'rejected');
  assert.equal(line.visual.color, 'red');
  assert.equal(line.visual.dash, 'solid');
  assert.equal(line.visual.arrow, 'back');
  assert.equal(elementStyle(line, { hoveredKey: null }).z, 1);

  // AC-18 collaboration: the layout lifts the lines attached to the abnormal node.
  const layout = layoutOf(abnormal);
  const cleanLayout = layoutOf(project());
  assert.equal(byId(layout.edges, line.id).z, 1);
  assert.equal(byId(cleanLayout.edges, line.id).z, 0);
});

test('AC-23: every other node keeps its coordinates when one node turns abnormal', () => {
  const cleanLayout = layoutOf(project());
  const abnormalLayout = layoutOf(project({ abnormal: true }));
  for (const node of cleanLayout.nodes) {
    const other = byId(abnormalLayout.nodes, node.id);
    assert.equal(other.x, node.x, `x of ${node.id}`);
    assert.equal(other.y, node.y, `y of ${node.id}`);
    assert.equal(other.width, node.width, `width of ${node.id}`);
    assert.equal(other.height, node.height, `height of ${node.id}`);
    if (node.id !== 'role:dev') assert.equal(other.z, node.z, `z of ${node.id}`);
  }
  // Only the abnormal node lifts.
  assert.equal(byId(abnormalLayout.nodes, 'role:dev').z, 1);
  assert.equal(byId(abnormalLayout.nodes, 'role:qa').z, 0);
});

test('AC-23: the style projection never carries geometry and clearing is immediate', () => {
  const clean = project();
  const abnormal = project({ abnormal: true });
  const node = byId(abnormal.nodes, 'role:dev');
  const style = elementStyle(node, { hoveredKey: null });
  assert.deepEqual(Object.keys(style).sort(), ['animation', 'opacity', 'z']);

  const cleared = elementStyle(byId(clean.nodes, 'role:dev'), { hoveredKey: null });
  assert.equal(cleared.animation, 'none');
  assert.equal(cleared.z, 0);
  assert.equal(cleared.opacity, FULL_OPACITY);

  const line = abnormal.edges.find((edge) => edge.direction === 'forward');
  const lineStyle = elementStyle(line, { hoveredKey: null });
  assert.deepEqual(Object.keys(lineStyle).sort(), ['animation', 'opacity', 'z']);
  assert.equal(lineStyle.animation, line.visual.animation);
});

test('AC-23: hover dimming is a paint-level token, not a geometry change', () => {
  const abnormal = project({ abnormal: true });
  const layout = layoutOf(abnormal);
  const node = byId(layout.nodes, 'role:qa');
  const dimmed = elementStyle(
    { ...byId(abnormal.nodes, 'role:qa'), ...node },
    { hoveredKey: 'role:dev', opaqueIds: ['role:dev'] },
  );
  assert.equal(dimmed.opacity, DIM_OPACITY);
  const lit = elementStyle(
    { ...byId(abnormal.nodes, 'role:dev'), ...byId(layout.nodes, 'role:dev') },
    { hoveredKey: 'role:dev', opaqueIds: ['role:dev'] },
  );
  assert.equal(lit.opacity, FULL_OPACITY);
  // Coordinates are exactly the layout values: the style never rewrites them.
  assert.equal(node.x, layout.nodes.find((entry) => entry.id === 'role:qa').x);
  assert.equal(node.y, layout.nodes.find((entry) => entry.id === 'role:qa').y);
});

test('A-11: the connection line text rows are verbatim, with the parallel and hover forms', () => {
  const dev = { from: 'role:dev', fromTitle: '开发' };
  const qa = { to: 'role:qa', toTitle: '测试' };
  const row = (edge) => renderEdgeRow(edge, LABELS);

  assert.equal(
    row({ id: 'E-01', ...dev, ...qa, direction: 'forward', aggregateStatus: 'delivered', parallelCount: 0 }).text,
    '连接线 开发→测试 · 正向 · 已投递',
  );
  assert.equal(
    row({ id: 'E-02', from: 'role:qa', fromTitle: '测试', to: 'role:dev', toTitle: '开发', direction: 'backflow', aggregateStatus: 'rejected', parallelCount: 0 }).text,
    '连接线 测试→开发 · 回流 · 已拒绝',
  );
  const accepted = row({ id: 'E-03', ...dev, ...qa, direction: 'forward', aggregateStatus: 'accepted', parallelCount: 2 });
  assert.equal(accepted.text, '连接线 开发→测试 · 正向 · 已接受 · 2 并行交接');
  // A-11: an accepted line shows the merged processing wording on hover.
  assert.equal(accepted.hoverText, '连接线 开发→测试 · 正向 · 已接受 · 处理中 · 2 并行交接');
  assert.equal(
    row({ id: 'E-04', ...dev, ...qa, direction: 'forward', aggregateStatus: 'not_started', parallelCount: 0 }).text,
    '连接线 开发→测试 · 正向 · 未开始',
  );
  // Without display titles the id is used and the internal namespace is stripped.
  assert.equal(
    row({ id: 'E-05', from: 'role:dev', to: 'role:qa', direction: 'forward', aggregateStatus: 'pending', parallelCount: 0 }).text,
    '连接线 dev→qa · 正向 · 待投递',
  );
  // The frozen A-11 tokens travel through untouched.
  const visual = { color: 'red', dash: 'solid', arrow: 'back', animation: 'none', badge: null };
  const carried = row({ id: 'E-06', ...dev, ...qa, direction: 'forward', aggregateStatus: 'rejected', parallelCount: 0, visual });
  assert.deepEqual(carried.visual, visual);
});
