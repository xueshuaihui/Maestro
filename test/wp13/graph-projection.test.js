/**
 * Graph projection contract tests (I1.10a WP-4).
 *
 * AC-07 anchor (batch-1 judgable part): 8 nodes / 9 edges are drawn in one
 * snapshot, no dangling endpoints, every node carries type + status, every
 * edge carries direction + aggregate status. The two-line legend assertion of
 * AC-07 is deferred to WP-5 legend.test.js (S-03) and therefore not here.
 *
 * AC-14 anchor (projection part): a topology with a human node and a
 * subworkflow is complete — all definition edges are drawn, dangling count 0,
 * the subworkflow keeps its collapsed group info.
 *
 * Everything runs in memory against the pure projection; the single harness
 * case at the end builds a throwaway project root under the OS temp dir
 * (never inside the repository) and drives desktop/harness/graph-dump.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  AGGREGATE_PRIORITY,
  buildGraph,
  edgeHidden,
  isRevEvent,
  LABEL_VISIBLE_STATES,
  REV_WHITELIST,
} from '../../src/daemon/graph.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** Five role nodes + human + escalate + subworkflow, nine edges, one backflow. */
function ac07Def() {
  return {
    id: 'release-flow',
    title: '发布流程',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'alpha', order: 0, title: '需求' },
      { id: 'T-002', node_type: 'role', role: 'beta', order: 1, title: '实现' },
      { id: 'T-003', node_type: 'role', role: 'gamma', order: 2, title: '检查' },
      { id: 'T-004', node_type: 'role', role: 'delta', order: 3, title: '集成' },
      { id: 'T-005', node_type: 'role', role: 'epsilon', order: 4, title: '交付' },
      { id: 'H-001', node_type: 'human', order: 5, title: '人工验收' },
      { id: 'X-001', node_type: 'escalate', order: 6, title: '人工裁决' },
      { id: 'S-001', node_type: 'subworkflow', order: 7, title: '发布子流程', workflow: 'publish-child' },
    ],
    edges: [
      { from: 'T-001', to: 'T-002' },
      { from: 'T-002', to: 'T-003' },
      { from: 'T-003', to: 'H-001' },
      { from: 'H-001', to: 'X-001' },
      { from: 'X-001', to: 'S-001' },
      { from: 'S-001', to: 'T-004' },
      { from: 'T-004', to: 'T-005' },
      { from: 'T-004', to: 'H-001' },
      { from: 'T-005', to: 'T-001', kind: 'backflow' },
    ],
  };
}

function ac07State() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    template: 'release-flow',
    state: 'running',
    workflowRef: 'release-flow',
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'alpha', state: 'done', round: 1, stateSince: '2026-01-01T00:01:00.000Z' },
      { nodeId: 'T-002', roleId: 'beta', state: 'running', round: 1, stateSince: '2026-01-01T00:02:00.000Z' },
      { nodeId: 'T-003', roleId: 'gamma', state: 'pending', round: 0 },
      { nodeId: 'T-004', roleId: 'delta', state: 'pending', round: 0 },
      { nodeId: 'T-005', roleId: 'epsilon', state: 'pending', round: 0 },
    ],
    sessions: [
      { sessionId: 'SESS-1', nodeId: 'T-002', state: 'tool_running', hostId: 'dsh', createdAt: '2026-01-01T00:02:10.000Z' },
      { sessionId: 'SESS-2', nodeId: 'T-002', state: 'thinking', hostId: 'cursor', createdAt: '2026-01-01T00:02:20.000Z' },
    ],
    handoffs: [
      { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'consumed', round: 1 },
      { handoffId: 'HO-002', edge: { from: 'T-002', to: 'T-003', kind: 'forward' }, state: 'delivered', round: 1 },
      { handoffId: 'HO-003', edge: { from: 'T-005', to: 'T-001', kind: 'backflow' }, state: 'rejected', round: 2 },
    ],
    escalations: [],
    health: { level: 'attention', reasons: ['connection_rejected'], computedAt: '2026-01-01T00:10:00.000Z' },
  };
}

const SUB_DEF = {
  id: 'publish-child',
  nodes: [
    { id: 'C-001', node_type: 'role', role: 'pack-a' },
    { id: 'C-002', node_type: 'role', role: 'pack-b' },
    { id: 'C-003', node_type: 'role', role: 'pack-c' },
    { id: 'C-004', node_type: 'role', role: 'pack-c' },
  ],
};

function project({ state = ac07State(), def = ac07Def(), roles = {}, traces = [], events = [], rev, subWorkflows = { 'publish-child': SUB_DEF } } = {}) {
  return buildGraph({ state, workflowDef: def, roles, traces, events, rev, subWorkflows });
}

test('AC-07: the snapshot draws 8 nodes and 9 edges in one pass', () => {
  const graph = project();
  assert.equal(graph.nodes.length, 8);
  assert.equal(graph.edges.length, 9);
  const roles = graph.nodes.filter((node) => node.type === 'role');
  const special = graph.nodes.filter((node) => node.type !== 'role');
  assert.equal(roles.length, 5);
  assert.deepEqual(
    special.map((node) => node.type).sort(),
    ['escalate', 'human', 'subworkflow'],
  );
});

test('AC-07: no dangling endpoints; every node has type and status; every edge has direction and aggregate status', () => {
  const graph = project();
  const ids = new Set(graph.nodes.map((node) => node.id));
  let dangling = 0;
  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) dangling += 1;
    if (!ids.has(edge.to)) dangling += 1;
  }
  assert.equal(dangling, 0);
  for (const node of graph.nodes) {
    assert.equal(typeof node.type, 'string');
    assert.notEqual(node.type, '');
    assert.notEqual(node.status, undefined, `node ${node.id} lacks status`);
  }
  for (const edge of graph.edges) {
    assert.ok(['forward', 'backflow'].includes(edge.direction));
    assert.ok(AGGREGATE_PRIORITY.includes(edge.aggregateStatus));
  }
});

test('AC-07 fixture: the projected node and edge sets equal the definition sets', () => {
  const graph = project();
  const def = ac07Def();
  // Five definition role nodes collapse one-to-one onto five role instances.
  const roleIds = graph.nodes.filter((n) => n.roleId !== null && n.type === 'role').map((n) => n.roleId);
  assert.deepEqual(roleIds.sort(), ['alpha', 'beta', 'delta', 'epsilon', 'gamma']);
  const specialIds = graph.nodes.filter((n) => n.type !== 'role').map((n) => n.id);
  assert.deepEqual(specialIds, ['H-001', 'X-001', 'S-001']);
  // Nine definition edges, nine distinct projected triples.
  assert.equal(def.edges.length, 9);
  assert.equal(graph.edges.length, 9);
});

test('projection is deterministic and does not mutate its inputs', () => {
  const state = ac07State();
  const def = ac07Def();
  const traces = [{ node_id: 'T-002', end_time: '2026-01-01T00:03:00.000Z' }];
  const events = [{ seq: 3, object: 'node', reason: 'state.change' }];
  const before = JSON.stringify({ state, def, traces, events });
  const first = buildGraph({ state, workflowDef: def, roles: {}, traces, events });
  const second = buildGraph({ state, workflowDef: def, roles: {}, traces, events });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify({ state, def, traces, events }), before);
});

test('AC-14: topology with a human node and a subworkflow is complete', () => {
  const def = {
    id: 'topology-flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'dev', order: 0 },
      { id: 'H-001', node_type: 'human', order: 1, title: '人工验收' },
      { id: 'S-001', node_type: 'subworkflow', order: 2, title: '发布子流程', workflow: 'publish-child' },
      { id: 'T-002', node_type: 'role', role: 'qa', order: 3 },
    ],
    edges: [
      { from: 'T-001', to: 'H-001' },
      { from: 'H-001', to: 'S-001' },
      { from: 'S-001', to: 'T-002' },
      { from: 'T-002', to: 'T-001', kind: 'backflow' },
    ],
  };
  const graph = project({
    def,
    state: {
      schemaVersion: 2,
      instanceId: 'INST-002',
      template: 'topology-flow',
      state: 'running',
      workflowRef: 'topology-flow',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { nodeId: 'T-001', roleId: 'dev', state: 'done', round: 1 },
        { nodeId: 'T-002', roleId: 'qa', state: 'pending', round: 0 },
      ],
      sessions: [],
      handoffs: [],
      escalations: [],
    },
  });
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.deepEqual([...ids].sort(), ['H-001', 'S-001', 'role:dev', 'role:qa']);
  // All four definition edges are drawn, none dangling.
  assert.equal(graph.edges.length, 4);
  let dangling = 0;
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) dangling += 1;
  }
  assert.equal(dangling, 0);
  // The backflow is its own line, not a second forward line.
  const backflow = graph.edges.filter((edge) => edge.direction === 'backflow');
  assert.equal(backflow.length, 1);
  assert.equal(backflow[0].aggregateStatus, 'not_started');
  // Subworkflow keeps the collapsed group info of the child definition.
  const sub = graph.nodes.find((node) => node.type === 'subworkflow');
  assert.equal(sub.memberCount, 3);
  assert.deepEqual(sub.nodeIds, ['role:pack-a', 'role:pack-b', 'role:pack-c']);
  assert.equal(sub.collapsed, true);
  assert.equal(sub.workflow, 'publish-child');
});

test('subworkflow with an unreadable child definition degrades to memberCount null and gray status', () => {
  const def = {
    id: 'flow',
    nodes: [{ id: 'S-001', node_type: 'subworkflow', title: '发布子流程', workflow: 'missing-child' }],
    edges: [],
  };
  const graph = project({ def, subWorkflows: {} });
  const sub = graph.nodes.find((node) => node.id === 'S-001');
  assert.equal(sub.memberCount, null);
  assert.equal(sub.status, null);
  assert.equal(sub.abnormal, false);
  assert.deepEqual(sub.nodeIds, []);
  assert.equal(sub.collapsed, true);
});

test('unknown node_type renders as a role node and keeps its id', () => {
  const def = {
    id: 'flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'alpha' },
      { id: 'W-009', node_type: 'mystery', role: 'ghost', title: '神秘节点' },
    ],
    edges: [{ from: 'T-001', to: 'W-009' }],
  };
  const graph = project({ def });
  const unknown = graph.nodes.find((node) => node.id === 'W-009');
  assert.notEqual(unknown, undefined);
  assert.equal(unknown.type, 'role');
  assert.equal(unknown.roleId, 'ghost');
  const ids = new Set(graph.nodes.map((node) => node.id));
  assert.equal(graph.edges.length, 1);
  assert.ok(ids.has(graph.edges[0].from) && ids.has(graph.edges[0].to));
});

test('special nodes read their status from the snapshot; missing state falls back to pending', () => {
  const def = {
    id: 'flow',
    nodes: [
      { id: 'H-001', node_type: 'human', title: '人工验收' },
      { id: 'X-001', node_type: 'escalate', title: '人工裁决' },
    ],
    edges: [],
  };
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-003',
    state: 'running',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [{ nodeId: 'H-001', state: 'review' }],
    sessions: [],
    handoffs: [],
    escalations: [],
  };
  const graph = project({ def, state });
  const human = graph.nodes.find((node) => node.id === 'H-001');
  const escalate = graph.nodes.find((node) => node.id === 'X-001');
  assert.equal(human.status, 'review');
  assert.equal(escalate.status, 'pending');
  assert.equal(escalate.abnormal, false);
});

test('escalated node state and pending escalations light the abnormal badge', () => {
  const def = {
    id: 'flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'alpha' },
      { id: 'X-001', node_type: 'escalate', title: '人工裁决' },
    ],
    edges: [],
  };
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-004',
    state: 'running',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'alpha', state: 'escalated', round: 1 },
      { nodeId: 'X-001', state: 'pending' },
    ],
    sessions: [
      // An escalated node carries an escalated session in real snapshots; the
      // frozen role-instance projection reads unavailability from the session.
      { sessionId: 'SESS-9', nodeId: 'T-001', state: 'escalated', hostId: 'mock', createdAt: '2026-01-01T00:00:10.000Z' },
    ],
    handoffs: [],
    escalations: [{ escalationId: 'ESC-001', nodeId: 'X-001', state: 'pending' }],
  };
  const graph = project({ def, state });
  const role = graph.nodes.find((node) => node.id === 'role:alpha');
  const escalate = graph.nodes.find((node) => node.id === 'X-001');
  assert.equal(role.abnormal, true);
  assert.equal(role.abnormalCount, 1);
  assert.equal(role.status, 'unavailable');
  assert.equal(role.statusReason, 'escalated');
  assert.equal(escalate.abnormal, true);
  assert.equal(escalate.abnormalCount, 1);
});

test('an empty registry keeps declared roles known by declaration (never unavailable)', () => {
  // `omega` is declared on the definition but bound by no snapshot node.
  const def = ac07Def();
  def.roles = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'omega'];
  const graph = project({ def, roles: null });
  for (const node of graph.nodes.filter((entry) => entry.type === 'role')) {
    assert.notEqual(node.status, 'unavailable');
    assert.notEqual(node.status, null);
  }
  const unbound = graph.nodes.find((node) => node.roleId === 'omega');
  assert.notEqual(unbound, undefined);
  assert.equal(unbound.status, 'inactive');
});

test('rev follows the whitelist: session/execution/health events never advance it', () => {
  const events = [
    { seq: 4, object: 'session', reason: 'state.change' },
    { seq: 7, object: 'node', reason: 'state.change' },
    { seq: 9, object: 'handoff', reason: 'handoff.rejected' },
    { seq: 12, object: 'session', reason: 'session.state' },
    { seq: 15, object: 'execution', reason: 'execution.summary' },
    { seq: 18, object: 'health', reason: 'health.changed' },
    { seq: 20, object: 'instance', reason: 'run.completed' },
    { seq: 25, object: 'escalation', reason: 'escalation.created' },
  ];
  assert.equal(project({ events }).rev, 25);
  // An explicit caller-supplied rev wins over the event replay.
  assert.equal(project({ events, rev: 99 }).rev, 99);
  assert.equal(project({ events: [] }).rev, 0);
  assert.equal(project({}).rev, 0);
  assert.equal(isRevEvent({ object: 'node', seq: 1 }), true);
  assert.equal(isRevEvent({ object: 'session', seq: 2 }), false);
  assert.deepEqual([...REV_WHITELIST].sort(), ['escalation', 'handoff', 'instance', 'node', 'special_node']);
});

test('role lastActivity prefers the latest landed span end_time and falls back to state.updatedAt', () => {
  const traces = [
    { node_id: 'T-002', end_time: '2026-01-01T00:03:00.000Z' },
    { node_id: 'T-002', end_time: '2026-01-01T00:05:00.000Z' },
    { node_id: 'T-001', end_time: '2026-01-01T00:04:00.000Z' },
    { node_id: 'T-002', start_time: '2026-01-01T00:06:00.000Z' }, // running span: no end_time
  ];
  const graph = project({ traces });
  assert.equal(graph.nodes.find((node) => node.roleId === 'beta').lastActivity, '2026-01-01T00:05:00.000Z');
  assert.equal(graph.nodes.find((node) => node.roleId === 'alpha').lastActivity, '2026-01-01T00:04:00.000Z');
  // A role with no spans falls back to the snapshot updatedAt.
  assert.equal(graph.nodes.find((node) => node.roleId === 'gamma').lastActivity, '2026-01-01T00:10:00.000Z');
});

test('group nodes appear only above 12 visible role nodes', () => {
  const roles = {};
  const build = (count) => {
    const defNodes = [];
    for (let i = 1; i <= count; i += 1) {
      const id = `R-${String(i).padStart(3, '0')}`;
      const roleId = `role-${String(i).padStart(2, '0')}`;
      defNodes.push({ id, node_type: 'role', role: roleId, order: i });
      roles[roleId] = { id: roleId, name: roleId, group: i <= 8 ? 'coding' : 'research' };
    }
    return {
      id: 'flow',
      nodes: defNodes,
      edges: [],
    };
  };
  const stateOf = (count) => ({
    schemaVersion: 2,
    instanceId: 'INST-G',
    state: 'running',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nodes: [],
    sessions: [],
    handoffs: [],
    escalations: [],
    workflowRef: null,
    template: 'flow',
    __count: count,
  });

  const atThreshold = project({ def: build(12), roles, state: stateOf(12) });
  assert.equal(atThreshold.nodes.filter((node) => node.type === 'group').length, 0);
  assert.equal(atThreshold.nodes.filter((node) => node.type === 'role').length, 12);

  const above = project({ def: build(13), roles, state: stateOf(13) });
  const groups = above.nodes.filter((node) => node.type === 'group');
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((node) => node.memberCount).sort((a, b) => a - b), [5, 8]);
  for (const group of groups) {
    assert.equal(group.collapsed, true);
    assert.ok(group.nodeIds.every((id) => above.nodes.some((node) => node.id === id)));
  }
  // Member role nodes stay in the data so the client can expand them.
  assert.equal(above.nodes.filter((node) => node.type === 'role').length, 13);
});

test('an unreadable definition projects an empty graph with readable=false', () => {
  const graph = project({ def: null });
  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.edges, []);
  assert.equal(graph.workflow.readable, false);
  assert.equal(graph.workflow.ref, 'release-flow'); // falls back to the snapshot workflowRef
  assert.equal(graph.rev, 0);
});

test('workflow reports ref and readability; snapshot passthrough fields are intact', () => {
  const graph = project();
  assert.equal(graph.workflow.ref, 'release-flow');
  assert.equal(graph.workflow.readable, true);
  assert.equal(graph.instanceId, 'INST-001');
  assert.equal(graph.template, 'release-flow');
  assert.equal(graph.state, 'running');
});

test('label visibility defaults: only rejected, expired and pending are visible', () => {
  assert.deepEqual([...LABEL_VISIBLE_STATES].sort(), ['expired', 'pending', 'rejected']);
  const graph = project();
  for (const edge of graph.edges) {
    assert.equal(edge.labelVisible, LABEL_VISIBLE_STATES.has(edge.aggregateStatus));
  }
});

test('edgeHidden implements the not-started toggle (AC-15 server half)', () => {
  assert.equal(edgeHidden({ aggregateStatus: 'not_started' }), true);
  assert.equal(edgeHidden({ aggregateStatus: 'not_started' }, { showNotStarted: true }), false);
  assert.equal(edgeHidden({ aggregateStatus: 'delivered' }), false);
  assert.equal(edgeHidden({ aggregateStatus: 'delivered' }, { showNotStarted: true }), false);
});

test('harness end-to-end: graph-dump.mjs builds a payload from a throwaway project root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp4-'));
  const out = path.join(root, 'out', 'graph.json');
  try {
    // Fixture workflow yaml with all four node_type classes, block style only
    // (yaml-lite has no inline mappings).
    const workflowDir = path.join(root, '.orch', 'workflows');
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowDir, 'release-flow.yaml'),
      [
        'workflow: release-flow',
        'title: release flow',
        'nodes:',
        '  - id: T-001',
        '    node_type: role',
        '    role: dev',
        '    order: 0',
        '  - id: H-001',
        '    node_type: human',
        '    title: manual review',
        '    order: 1',
        '  - id: S-001',
        '    node_type: subworkflow',
        '    title: publish child',
        '    workflow: publish-child',
        '    order: 2',
        '  - id: X-001',
        '    node_type: escalate',
        '    title: manual verdict',
        '    order: 3',
        '  - id: T-002',
        '    node_type: role',
        '    role: qa',
        '    order: 4',
        'edges:',
        '  - from: T-001',
        '    to: H-001',
        '  - from: H-001',
        '    to: X-001',
        '  - from: X-001',
        '    to: S-001',
        '  - from: S-001',
        '    to: T-002',
        '  - from: T-002',
        '    to: T-001',
        '    kind: backflow',
      ].join('\n'),
      'utf8',
    );
    const instanceDir = path.join(root, '.orch', 'instances', 'INST-001');
    fs.mkdirSync(instanceDir, { recursive: true });
    fs.writeFileSync(
      path.join(instanceDir, 'state.json'),
      JSON.stringify({
        schemaVersion: 2,
        instanceId: 'INST-001',
        template: 'release-flow',
        state: 'running',
        workflowRef: 'release-flow',
        updatedAt: '2026-01-01T00:00:00.000Z',
        nodes: [
          { nodeId: 'T-001', roleId: 'dev', state: 'done', round: 1 },
          { nodeId: 'T-002', roleId: 'qa', state: 'pending', round: 0 },
        ],
        sessions: [],
        handoffs: [
          { handoffId: 'HO-001', edge: { from: 'T-001', to: 'H-001', kind: 'forward' }, state: 'delivered', round: 1 },
        ],
        escalations: [],
      }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(instanceDir, 'events.jsonl'),
      [
        JSON.stringify({ seq: 1, object: 'node', reason: 'state.change', ts: '2026-01-01T00:00:01.000Z' }),
        JSON.stringify({ seq: 2, object: 'handoff', reason: 'handoff.created', ts: '2026-01-01T00:00:02.000Z' }),
        JSON.stringify({ seq: 3, object: 'session', reason: 'session.state', ts: '2026-01-01T00:00:03.000Z' }),
      ].join('\n'),
      'utf8',
    );

    const harness = path.join(REPO, 'desktop', 'harness', 'graph-dump.mjs');
    const result = spawnSync(
      process.execPath,
      [harness, '--project', root, '--instance', 'INST-001', '--payload', out],
      { env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(out));

    const payload = JSON.parse(fs.readFileSync(out, 'utf8'));
    // Smoke contract: nodes/edges non-empty, rev present, legend/hover null (S-03).
    assert.ok(payload.nodes.length > 0);
    assert.ok(payload.edges.length > 0);
    assert.equal(typeof payload.rev, 'number');
    assert.equal(payload.rev, 2); // session event must not advance rev
    assert.equal(payload.legend, null);
    assert.equal(payload.hover, null);
    assert.equal(payload.workflow.readable, true);
    assert.equal(payload.workflow.ref, 'release-flow');
    const ids = new Set(payload.nodes.map((node) => node.id));
    let dangling = 0;
    for (const edge of payload.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) dangling += 1;
    }
    assert.equal(dangling, 0);
    assert.equal(payload.nodes.filter((node) => node.type === 'subworkflow').length, 1);
    assert.equal(payload.nodes.filter((node) => node.type === 'human').length, 1);
    assert.equal(payload.nodes.filter((node) => node.type === 'escalate').length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
