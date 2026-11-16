/**
 * Collapse tests (I1.10a WP-6; AC-19, S-07 measured stage).
 *
 * AC-19 anchor: thirteen roles (eight of one group, five of another) collapse
 * into two group nodes labelled verbatim, the collapsed state draws exactly one
 * line between the two group nodes, expanding one group shows its eight members
 * while the other group stays folded, and collapsing again returns to two
 * nodes. The visible counts of the three states are 2 / 10 / 2, and the members
 * come back on their original layers.
 *
 * S-07 measured stage: the role registry has to read directly written
 * `.orch/roles/*.yaml` files, otherwise the whole collapse fixture is not
 * judgeable. The stage writes thirteen role files into an isolated `$TMPDIR`
 * project root, starts one real session with `--host mock` and asserts that the
 * registry reads thirteen roles with group counts 8 / 5. It is the only part of
 * this file allowed to touch the disk and spawn a process; the pure module
 * assertions above it never do either.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { COLLAPSE_THRESHOLD, UNGROUPED_GROUP_ID, autoCollapse, toggleGroup } from '../../desktop/ui/graph/collapse.js';
import { computeLayout } from '../../desktop/ui/graph/layout.js';
import { renderSpecialRow } from '../../desktop/ui/graph/node-rows.js';
import { buildGraph } from '../../src/daemon/graph.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';
import { loadRegistry } from '../../src/registry/index.js';
import { labelKeysPayload } from '../../src/daemon/http/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ORCH = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

/**
 * The real `GET /ui/labels` key table (249 keys). Group display names are part
 * of it since the A-14 supplement (decision K / B-16), so the fixture never
 * fabricates `GROUP_LABEL_*` keys of its own.
 */
const LABELS = labelKeysPayload().keys;

/** Thirteen roles: eight `coding` (`c1`..`c8`) and five `research` (`r1`..`r5`). */
function roleIds() {
  const coding = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `c${i}`);
  const research = [1, 2, 3, 4, 5].map((i) => `r${i}`);
  return { coding, research };
}

function groupOf(roleId) {
  return roleId.startsWith('c') ? 'coding' : 'research';
}

/** Definition: a coding chain, one cross-group edge, then a research chain. */
function collapseDef() {
  const { coding, research } = roleIds();
  const chain = [...coding, ...research];
  const nodes = chain.map((roleId, index) => ({
    id: `T-${String(index + 1).padStart(3, '0')}`,
    node_type: 'role',
    role: roleId,
    order: index,
  }));
  const edges = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
  }
  return { id: 'big-flow', nodes, edges };
}

function roleAssets() {
  const { coding, research } = roleIds();
  const assets = {};
  for (const roleId of coding) assets[roleId] = { id: roleId, name: `角色${roleId}`, group: 'coding' };
  for (const roleId of research) assets[roleId] = { id: roleId, name: `角色${roleId}`, group: 'research' };
  return assets;
}

function collapseState() {
  const def = collapseDef();
  return {
    schemaVersion: 2,
    instanceId: 'INST-BIG',
    template: 'big-flow',
    state: 'running',
    workflowRef: 'big-flow',
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes: def.nodes.map((node) => ({ nodeId: node.id, roleId: node.role, state: 'pending', round: 0 })),
    sessions: [],
    handoffs: [],
    escalations: [],
  };
}

function projectedGraph() {
  return buildGraph({ state: collapseState(), workflowDef: collapseDef(), roles: roleAssets() });
}

function layerById(layout) {
  return new Map(layout.nodes.map((node) => [node.id, node.layer]));
}

test('AC-19: thirteen roles collapse into two groups, expand to ten, collapse back to two', () => {
  const collapsed = autoCollapse(projectedGraph());
  assert.equal(collapsed.active, true);
  assert.equal(collapsed.visibleIds.length, 2);
  assert.deepEqual([...collapsed.visibleIds].sort(), ['group:coding', 'group:research']);
  assert.equal(collapsed.edges.length, 1);
  assert.equal(collapsed.edges[0].from, 'group:coding');
  assert.equal(collapsed.edges[0].to, 'group:research');

  const expanded = toggleGroup(collapsed, 'group:coding');
  assert.equal(expanded.visibleIds.length, 10);
  assert.equal(expanded.groups.find((group) => group.id === 'group:coding').collapsed, false);
  assert.equal(expanded.groups.find((group) => group.id === 'group:research').collapsed, true);
  const visibleRoles = expanded.visibleIds.filter((id) => id.startsWith('role:'));
  assert.equal(visibleRoles.length, 8);

  const again = toggleGroup(expanded, 'group:coding');
  assert.equal(again.visibleIds.length, 2);
  assert.deepEqual([...again.visibleIds].sort(), ['group:coding', 'group:research']);
  assert.equal(again.edges.length, 1);
});

test('AC-19: the group node labels are the A-10 rows verbatim', () => {
  const collapsed = autoCollapse(projectedGraph());
  const coding = collapsed.groups.find((group) => group.id === 'group:coding');
  const research = collapsed.groups.find((group) => group.id === 'group:research');
  assert.equal(coding.memberCount, 8);
  assert.equal(research.memberCount, 5);
  // The real `GET /ui/labels` body already carries both group display names
  // (A-14 supplement), so `{ keys: {...} }` renders the verbatim A-10 rows.
  const real = labelKeysPayload();
  assert.equal(renderSpecialRow(coding, real).text, '分组 编码工程 · 8 角色');
  assert.equal(renderSpecialRow(research, real).text, '分组 研究分析 · 5 角色');
  // Groups without a registered display name fall back to the raw group id
  // (known limitation of this iteration, never an invented name).
  assert.equal(renderSpecialRow({ ...coding, group: 'ops' }, real).text, '分组 ops · 8 角色');
});

test('AC-19: expanded members return to their original layers and order', () => {
  const graph = projectedGraph();
  const full = computeLayout({ nodes: graph.nodes, edges: graph.edges });
  const fullLayers = layerById(full);

  const collapsed = autoCollapse(graph);
  const collapsedLayers = layerById(computeLayout({ nodes: collapsed.nodes, edges: collapsed.edges }));
  assert.equal(collapsedLayers.get('group:coding'), 0);
  assert.equal(collapsedLayers.get('group:research'), 1);

  const expanded = toggleGroup(collapsed, 'group:coding');
  const expandedLayers = layerById(computeLayout({ nodes: expanded.nodes, edges: expanded.edges }));
  for (const [index, roleId] of roleIds().coding.entries()) {
    const nodeId = `role:${roleId}`;
    assert.equal(expandedLayers.get(nodeId), fullLayers.get(nodeId), `layer of ${nodeId}`);
    assert.equal(fullLayers.get(nodeId), index, `full layer of ${nodeId}`);
  }
  // Original relative order is preserved (declaration order inside the group).
  const order = expanded.visibleIds.filter((id) => id.startsWith('role:'));
  assert.deepEqual(order, roleIds().coding.map((roleId) => `role:${roleId}`));
  // The folded research members stay hidden either way.
  for (const roleId of roleIds().research) {
    assert.equal(expanded.visibleIds.includes(`role:${roleId}`), false);
  }
});

test('AC-19: the threshold is "more than twelve visible role nodes"', () => {
  const make = (count) => Array.from({ length: count }, (_, index) => ({
    id: `role:x${index}`,
    type: 'role',
    group: 'coding',
  }));
  assert.equal(COLLAPSE_THRESHOLD, 12);
  const atLimit = autoCollapse(make(12));
  assert.equal(atLimit.active, false);
  assert.deepEqual(atLimit.groups, []);
  assert.equal(atLimit.visibleIds.length, 12);
  const above = autoCollapse(make(13));
  assert.equal(above.active, true);
  assert.equal(above.groups.length, 1);
  assert.equal(above.groups[0].memberCount, 13);
});

test('AC-19: a role without a group lands in the single ungrouped bucket', () => {
  const nodes = Array.from({ length: 13 }, (_, index) => ({
    id: `role:u${index}`,
    type: 'role',
    group: index < 3 ? null : 'coding',
  }));
  const view = autoCollapse(nodes);
  const ungrouped = view.groups.find((group) => group.id === UNGROUPED_GROUP_ID);
  assert.notEqual(ungrouped, undefined);
  assert.equal(ungrouped.memberCount, 3);
  assert.equal(ungrouped.group, null);
  // B-17: the ungrouped bucket reads its display name from GROUP_LABEL_UNGROUPED.
  assert.equal(renderSpecialRow(ungrouped, LABELS).text, '分组 未分组 · 3 角色');
});

test('AC-19: subworkflows stay folded and every ungrouped node stays visible', () => {
  const graph = projectedGraph();
  const withSubflow = {
    nodes: [
      ...graph.nodes,
      { id: 'S-001', type: 'subworkflow', title: 'child', nodeIds: [], memberCount: 2, collapsed: true, abnormal: false },
    ],
    edges: graph.edges,
  };
  const view = autoCollapse(withSubflow);
  assert.equal(view.visibleIds.length, 3);
  assert.equal(view.visibleIds.includes('S-001'), true);
  const subflow = view.nodes.find((node) => node.id === 'S-001');
  assert.equal(subflow.collapsed, true);

  // B-21: a drifting `collapsed: false` on a subworkflow is normalised to true.
  const drifted = autoCollapse({
    nodes: [
      ...graph.nodes,
      { id: 'S-002', type: 'subworkflow', title: 'child', nodeIds: [], memberCount: 2, collapsed: false, abnormal: false },
    ],
    edges: graph.edges,
  });
  assert.equal(drifted.nodes.find((node) => node.id === 'S-002').collapsed, true);
  assert.equal(drifted.visibleIds.includes('S-002'), true);
  // The input node itself is never mutated.
  assert.equal(drifted.source.nodes.find((node) => node.id === 'S-002').collapsed, false);
});

test('AC-19: toggling an unknown group changes nothing', () => {
  const collapsed = autoCollapse(projectedGraph());
  const same = toggleGroup(collapsed, 'group:nope');
  assert.equal(same, collapsed);
  const untouched = autoCollapse(projectedGraph());
  assert.deepEqual(untouched.visibleIds, collapsed.visibleIds);
  // The source graph is never mutated by collapsing.
  const graph = projectedGraph();
  const before = JSON.stringify(graph);
  autoCollapse(graph);
  toggleGroup(autoCollapse(graph), 'group:coding');
  assert.equal(JSON.stringify(graph), before);
});

// ---------------------------------------------------------------------------
// S-07 measured stage: directly written role files must be readable.
// ---------------------------------------------------------------------------

function writeRoleFile(root, roleId) {
  const dir = path.join(root, '.orch', 'roles');
  fs.mkdirSync(dir, { recursive: true });
  const group = groupOf(roleId);
  const lines = [
    'schema: role/v1',
    `id: ${roleId}`,
    `name: ${roleId.toUpperCase()}`,
    `group: ${group}`,
    `summary: ${group} role ${roleId}`,
    `artifact_type: ${group === 'coding' ? 'code' : 'report'}`,
    `side_effect: ${group === 'coding' ? 'write' : 'none'}`,
    'skills: []',
    'max_concurrent_sessions: 1',
    '',
  ];
  fs.writeFileSync(path.join(dir, `${roleId}.yaml`), lines.join('\n'), 'utf8');
}

function writeMockHost(root) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'mock.json'),
    JSON.stringify({
      transport: 'stdio',
      launch: { command: process.execPath, args: [MOCK] },
      limits: {
        initializeTimeoutMs: 8000,
        requestTimeoutMs: 8000,
        promptTimeoutMs: 8000,
        quietIdleMs: 30,
        quietCapMs: 200,
      },
    }),
    'utf8',
  );
}

function readInstanceId(root) {
  const dir = path.join(root, '.orch', 'instances');
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.equal(entries.length, 1);
  return entries[0].name;
}

test('S-07: thirteen directly written role files are read by the registry (--host mock)', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp6-collapse-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const { coding, research } = roleIds();
  for (const roleId of [...coding, ...research]) writeRoleFile(root, roleId);
  writeMockHost(root);

  const run = spawnSync(
    process.execPath,
    [ORCH, 'run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', 'write a note'],
    { cwd: root, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8', timeout: 120000 },
  );
  assert.equal(run.status, 0, `orch run failed: ${run.stderr ?? ''}`);

  const registry = loadRegistry({ root });
  const projectRoles = registry.roles.filter((role) => role.source === 'project');
  assert.equal(projectRoles.length, 13);
  const counts = {};
  for (const role of projectRoles) counts[role.group] = (counts[role.group] ?? 0) + 1;
  assert.equal(counts.coding, 8);
  assert.equal(counts.research, 5);

  // One real session exists, and the role instance projection reads all 13.
  const instanceId = readInstanceId(root);
  const state = JSON.parse(
    fs.readFileSync(path.join(root, '.orch', 'instances', instanceId, 'state.json'), 'utf8'),
  );
  const declared = projectRoles.map((role) => role.id);
  const view = buildRoleInstances({ state, graph: { roles: declared }, roles: registry.roleMap });
  // The session binds one extra role from the built-in template, so the
  // assertion is about the thirteen declared project roles being readable.
  const declaredViews = view.roles.filter((entry) => declared.includes(entry.roleId));
  assert.equal(declaredViews.length, 13);
  assert.equal(declaredViews.every((entry) => entry.statusReason !== 'unknown-role'), true);

  // The collapse fixture is judgeable on registry-derived data: every projected
  // role node carries its group, so the two groups are 8 / 5.
  const def = {
    id: 'registry-flow',
    nodes: declared.map((roleId, index) => ({
      id: `T-${String(index + 1).padStart(3, '0')}`,
      node_type: 'role',
      role: roleId,
      order: index,
    })),
    edges: declared.slice(1).map((roleId, index) => ({ from: `T-${String(index + 1).padStart(3, '0')}`, to: `T-${String(index + 2).padStart(3, '0')}` })),
  };
  const boundState = {
    ...state,
    workflowRef: 'registry-flow',
    nodes: def.nodes.map((node) => ({ nodeId: node.id, roleId: node.role, state: 'pending', round: 0 })),
  };
  const graph = buildGraph({ state: boundState, workflowDef: def, roles: registry.roleMap });
  const roleNodes = graph.nodes.filter((node) => node.type === 'role');
  assert.equal(roleNodes.length, 13);
  const collapse = autoCollapse(graph);
  assert.equal(collapse.groups.length, 2);
  assert.equal(collapse.groups.find((group) => group.group === 'coding').memberCount, 8);
  assert.equal(collapse.groups.find((group) => group.group === 'research').memberCount, 5);
});
