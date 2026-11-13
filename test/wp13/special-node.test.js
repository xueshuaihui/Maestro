/**
 * Special node row tests (I1.10a WP-6; AC-13, collaboration AC-14 / AC-30).
 *
 * AC-13 anchor: the three A-10 rows are reproduced verbatim (the subworkflow
 * row keeps its full-width colon), with the frozen shapes and colours
 * `shield` / `alert` / `group` and `gray` / `red` / `green`.
 *
 * The node type is read from the definition layer `node_type` only: a human
 * node whose title reads like a role stays a human node, and a role node whose
 * title reads like an artificial node stays a role node. Titles never decide
 * the row.
 *
 * Collaboration: the "member count unknown" row (AC-30 third state) and the
 * subworkflow row inside a complete topology (AC-14) are covered here as well.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { renderRoleRow, renderSpecialRow } from '../../desktop/ui/graph/node-rows.js';
import { buildGraph } from '../../src/daemon/graph.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const LABELS = UI_LABEL_KEYS;

/** A-10 rows, verbatim. */
const A10_HUMAN = '人工节点 人工验收 · 待执行';
const A10_ESCALATE = '升级节点 人工裁决 · 已升级';
const A10_SUBFLOW = '子工作流：发布子流程 · 3 角色';
const A10_SUBFLOW_UNKNOWN = '子工作流 child-x · 角色数未知';

/** Human + escalate + subworkflow, plus the four-node topology of AC-14. */
function specialDef() {
  return {
    id: 'special-flow',
    title: '发布流程',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'dev', title: '开发', order: 0 },
      { id: 'H-001', node_type: 'human', title: '人工验收', order: 1 },
      { id: 'X-001', node_type: 'escalate', title: '人工裁决', order: 2 },
      { id: 'S-001', node_type: 'subworkflow', title: '发布子流程', workflow: 'publish-child', order: 3 },
      { id: 'T-002', node_type: 'role', role: 'qa', title: '测试', order: 4 },
    ],
    edges: [
      { from: 'T-001', to: 'H-001' },
      { from: 'H-001', to: 'X-001' },
      { from: 'X-001', to: 'S-001' },
      { from: 'S-001', to: 'T-002' },
    ],
  };
}

/** Child definition with three roles (optionally one escalated). */
function childDef(escalated = false) {
  return {
    id: 'publish-child',
    nodes: [
      { id: 'C-001', node_type: 'role', role: 'rel', order: 0 },
      { id: 'C-002', node_type: 'role', role: 'ops', order: 1 },
      { id: 'C-003', node_type: 'role', role: 'sec', order: 2 },
    ],
    edges: [
      { from: 'C-001', to: 'C-002' },
      { from: 'C-002', to: 'C-003' },
    ],
    ...(escalated ? { stateHint: 'escalated' } : {}),
  };
}

function specialState({ childEscalated = false } = {}) {
  const nodes = [
    { nodeId: 'T-001', roleId: 'dev', state: 'done', round: 1 },
    { nodeId: 'H-001', state: 'pending', round: 0 },
    { nodeId: 'X-001', state: 'escalated', round: 1 },
    { nodeId: 'S-001', state: 'pending', round: 0 },
    { nodeId: 'T-002', roleId: 'qa', state: 'pending', round: 0 },
  ];
  if (childEscalated) nodes.push({ nodeId: 'C-002', roleId: 'ops', state: 'escalated', round: 1 });
  return {
    schemaVersion: 2,
    instanceId: 'INST-SPECIAL',
    template: 'special-flow',
    state: 'running',
    workflowRef: 'special-flow',
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes,
    sessions: [],
    handoffs: [],
    escalations: [],
  };
}

function project({ subWorkflows = { 'publish-child': childDef() }, childEscalated = false } = {}) {
  const graph = buildGraph({
    state: specialState({ childEscalated }),
    workflowDef: specialDef(),
    roles: { dev: { id: 'dev', name: '开发' }, qa: { id: 'qa', name: '测试' } },
    subWorkflows,
  });
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return { graph, byId };
}

test('AC-13: the three A-10 rows are reproduced verbatim', () => {
  const { byId } = project();
  assert.equal(renderSpecialRow(byId.get('H-001'), LABELS).text, A10_HUMAN);
  assert.equal(renderSpecialRow(byId.get('X-001'), LABELS).text, A10_ESCALATE);
  assert.equal(renderSpecialRow(byId.get('S-001'), LABELS).text, A10_SUBFLOW);
  // The subworkflow row keeps the full-width colon of A-10.
  assert.equal(renderSpecialRow(byId.get('S-001'), LABELS).text.includes('：'), true);
});

test('AC-13: shapes are shield / alert / group and colours gray / red / green', () => {
  const { byId } = project();
  const human = renderSpecialRow(byId.get('H-001'), LABELS);
  const escalate = renderSpecialRow(byId.get('X-001'), LABELS);
  const subflow = renderSpecialRow(byId.get('S-001'), LABELS);
  assert.equal(human.visual.shape, 'shield');
  assert.equal(human.visual.color, 'gray');
  assert.equal(human.visual.animation, 'none');
  assert.equal(escalate.visual.shape, 'alert');
  assert.equal(escalate.visual.color, 'red');
  assert.equal(escalate.visual.animation, 'pulse');
  assert.equal(subflow.visual.shape, 'group');
  assert.equal(subflow.visual.color, 'green');
  assert.equal(subflow.visual.animation, 'none');
  assert.equal(subflow.memberCount, 3);
});

test('AC-13: a subworkflow with an escalated member turns red', () => {
  const { byId } = project({ childEscalated: true });
  const row = renderSpecialRow(byId.get('S-001'), LABELS);
  assert.equal(row.visual.color, 'red');
  assert.equal(row.visual.animation, 'pulse');
  assert.equal(row.memberCount, 3);
});

test('AC-30 (collaboration): an unreadable child definition renders the unknown row', () => {
  const { byId } = project({ subWorkflows: {} });
  const node = byId.get('S-001');
  assert.equal(node.memberCount, null);
  const row = renderSpecialRow(node, LABELS);
  assert.equal(row.text, '子工作流 publish-child · 角色数未知');
  assert.equal(row.visual.color, 'gray');
  assert.equal(row.visual.animation, 'none');
  // AC-30 fixture form: the degraded row keys off the node id.
  const degraded = renderSpecialRow(
    { id: 'child-x', type: 'subworkflow', title: 'child-x', status: null, memberCount: null, abnormal: false },
    LABELS,
  );
  assert.equal(degraded.text, A10_SUBFLOW_UNKNOWN);
});

test('AC-13: the type comes from node_type, never from the title', () => {
  const asHuman = renderSpecialRow(
    { id: 'H-001', type: 'human', title: '角色 开发', status: 'pending', abnormal: false },
    LABELS,
  );
  assert.equal(asHuman.type, 'human');
  assert.equal(asHuman.visual.shape, 'shield');
  assert.equal(asHuman.text, '人工节点 角色 开发 · 待执行');

  const asRole = renderSpecialRow(
    { id: 'T-001', type: 'role', title: '人工验收', status: 'serving', activeSessions: 0 },
    LABELS,
  );
  assert.equal(asRole, null);
  const roleRow = renderRoleRow(
    { id: 'T-001', type: 'role', title: '人工验收', status: 'available', activeSessions: 0 },
    LABELS,
  );
  assert.equal(roleRow.text.startsWith('角色 人工验收'), true);

  const unknownType = renderSpecialRow({ id: 'Z-001', type: 'mystery', title: '人工验收' }, LABELS);
  assert.equal(unknownType, null);
});

test('AC-14 (collaboration): the subworkflow row appears inside a complete topology', () => {
  const { graph, byId } = project();
  const types = graph.nodes.map((node) => node.type).sort();
  assert.deepEqual(types, ['escalate', 'human', 'role', 'role', 'subworkflow']);
  assert.equal(graph.edges.length, 4);
  const rows = graph.nodes
    .map((node) => (node.type === 'role' ? renderRoleRow(node, LABELS) : renderSpecialRow(node, LABELS)))
    .filter((row) => row !== null);
  assert.equal(rows.length, graph.nodes.length);
  assert.equal(rows.some((row) => row.text === A10_SUBFLOW), true);
  assert.equal(rows.some((row) => row.text === A10_HUMAN), true);
  assert.equal(rows.some((row) => row.text === A10_ESCALATE), true);
  // No row lost its text: the topology is renderable end to end.
  for (const row of rows) assert.equal(typeof row.text, 'string');
  assert.equal(byId.get('S-001').collapsed, true);
});
