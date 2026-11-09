/**
 * Role-instance projection tests (WP-5).
 *
 * Everything here is in-memory: a hand-built `state` plus a hand-built graph. The
 * projection is a pure function of its input, so the six-status table, the ordering
 * rules and the derived lists can all be driven without a host, a core process or a
 * clock (NFR-04).
 *
 * `state` / `sessions` shapes are copied from a real I1.3 snapshot
 * (`docs/iterations/iteration-3/evidence/AC-01.state.json`), which is what the S3
 * harness reads back from disk.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildRoleInstances, decideStatus } from '../../src/registry/role-instances.js';
import { loadRegistry } from '../../src/registry/index.js';
import { getGraph } from '../../src/templates/index.js';

let realRoleMap = null;

/** Built-in registry as a Map; computed once because it only reads. */
function roleMap() {
  if (realRoleMap !== null) return realRoleMap;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-ri-'));
  try {
    realRoleMap = loadRegistry({ root }).roleMap;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return realRoleMap;
}

/** Minimal role map so a case can pick any group / cap without touching assets. */
function syntheticRoles(defs) {
  return new Map(
    Object.entries(defs).map(([id, extra]) => [
      id,
      {
        id,
        name: id,
        group: 'coding',
        summary: '',
        artifactType: 'code',
        sideEffect: 'read',
        skills: [],
        tools: [],
        wakeAllow: [],
        dispatchable: true,
        maxConcurrentSessions: 1,
        source: 'builtin',
        file: `assets/roles/${id}.yaml`,
        ...extra
      }
    ])
  );
}

function node(nodeId, roleId, state, stateSince, round = 1) {
  return {
    nodeId,
    roleId,
    round,
    state,
    stateSince,
    startedAt: null,
    roundStartedAt: null,
    endedAt: null,
    failure: null,
    note: null,
    verdict: null,
    sessionId: null,
    artifactRefs: []
  };
}

function session(sessionId, nodeId, state, createdAt, extra) {
  return {
    sessionId,
    nodeId,
    round: 1,
    hostId: 'dsh',
    state,
    stateSince: createdAt,
    createdAt,
    lastEventAt: createdAt,
    toolName: null,
    turnId: 'turn-1',
    artifactRef: null,
    pendingPermission: null,
    quarantined: false,
    ...(extra || {})
  };
}

function snapshot({ state = 'running', template = 'code-loop', nodes = [], sessions = [] }) {
  return { instanceId: 'INST-001', state, template, rev: 7, nodes, sessions };
}

function graphOf(name) {
  return getGraph(name);
}

function viewOf(result, roleId) {
  return result.roles.find((item) => item.roleId === roleId);
}

// ---------------------------------------------------------------------------
// Contract shape and ordering
// ---------------------------------------------------------------------------

test('a role instance carries exactly the nine contract keys', () => {
  const state = snapshot({
    nodes: [node('T-001', 'developer', 'running', '2026-11-08T10:00:00.000Z')],
    sessions: [session('s-1', 'T-001', 'thinking', '2026-11-08T10:00:00.000Z')]
  });
  const result = buildRoleInstances({
    state,
    graph: graphOf('code-loop'),
    roles: roleMap()
  });

  const view = viewOf(result, 'developer');
  assert.deepEqual(Object.keys(view).sort(), [
    'activeSessions',
    'hostIcons',
    'lastAction',
    'maxConcurrentSessions',
    'roleId',
    'roleInstanceId',
    'servingNodes',
    'status',
    'statusReason'
  ]);
  assert.equal(view.roleInstanceId, 'RI-developer');
});

test('AC-21: task-loop exposes three distinct roles in group-then-id order', () => {
  const state = snapshot({
    template: 'task-loop',
    nodes: [
      node('T-001', 'researcher', 'done', '2026-11-08T10:00:00.000Z', 1),
      node('T-002', 'writer', 'running', '2026-11-08T10:05:00.000Z', 1),
      node('T-003', 'reviewer', 'pending', '2026-11-08T09:00:00.000Z', 1)
    ],
    sessions: []
  });
  const result = buildRoleInstances({ state, graph: graphOf('task-loop'), roles: roleMap() });

  assert.deepEqual(
    result.roles.map((item) => item.roleId),
    ['researcher', 'reviewer', 'writer']
  );
  assert.equal(result.roles.length, 3);
  for (const view of result.roles) {
    assert.equal(view.roleInstanceId, `RI-${view.roleId}`);
  }
  assert.deepEqual(
    result.roles.map((item) => item.roleInstanceId),
    [...new Set(result.roles.map((item) => item.roleInstanceId))]
  );
});

test('AC-31: two consecutive projections return the same order', () => {
  const state = snapshot({
    template: 'task-loop',
    nodes: [
      node('T-001', 'researcher', 'done', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'writer', 'running', '2026-11-08T10:05:00.000Z'),
      node('T-003', 'reviewer', 'pending', '2026-11-08T09:00:00.000Z')
    ]
  });
  const first = buildRoleInstances({ state, graph: graphOf('task-loop'), roles: roleMap() });
  const second = buildRoleInstances({ state, graph: graphOf('task-loop'), roles: roleMap() });

  assert.deepEqual(
    first.roles.map((item) => item.roleId),
    second.roles.map((item) => item.roleId)
  );
  assert.deepEqual(first, second);
});

test('an unregistered role sorts last, reports unknown-role and has no cap', () => {
  const state = snapshot({ nodes: [node('T-001', 'ghost-role', 'pending', '2026-11-08T10:00:00.000Z')] });
  const graph = { roles: ['ghost-role', 'developer'], nodes: state.nodes, maxRounds: {} };
  const result = buildRoleInstances({ state, graph, roles: roleMap() });

  assert.deepEqual(
    result.roles.map((item) => item.roleId),
    ['developer', 'ghost-role']
  );
  const ghost = viewOf(result, 'ghost-role');
  assert.equal(ghost.status, 'unavailable');
  assert.equal(ghost.statusReason, 'unknown-role');
  assert.equal(ghost.maxConcurrentSessions, null);
});

test('a declared but unbound known role is inactive and has no session key', () => {
  const state = snapshot({
    nodes: [node('T-001', 'developer', 'running', '2026-11-08T10:00:00.000Z')],
    sessions: [session('s-1', 'T-001', 'thinking', '2026-11-08T10:00:00.000Z')]
  });
  const result = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });

  const coordinator = viewOf(result, 'coordinator');
  assert.equal(coordinator.status, 'inactive');
  assert.equal(coordinator.statusReason, null);
  assert.deepEqual(coordinator.servingNodes, []);
  assert.deepEqual(coordinator.activeSessions, []);
  assert.equal(Object.prototype.hasOwnProperty.call(result.roleToSessions, 'coordinator'), false);
  assert.equal(coordinator.roleInstanceId, 'RI-coordinator');
});

test('every built-in graph declares its roles; single still lists worker', () => {
  const empty = snapshot({ state: 'running', template: 'single', nodes: [], sessions: [] });
  const single = buildRoleInstances({ state: empty, graph: graphOf('single'), roles: roleMap() });
  assert.deepEqual(single.roles.map((item) => item.roleId), ['worker']);

  const idle = snapshot({ nodes: [], sessions: [] });
  const code = buildRoleInstances({ state: idle, graph: graphOf('code-loop'), roles: roleMap() });
  // Group order puts the coordinator group first, so it leads the code-loop list.
  assert.deepEqual(code.roles.map((item) => item.roleId), ['coordinator', 'developer', 'tester']);

  const task = buildRoleInstances({ state: idle, graph: graphOf('task-loop'), roles: roleMap() });
  assert.deepEqual(task.roles.map((item) => item.roleId), ['researcher', 'reviewer', 'writer']);
});

// ---------------------------------------------------------------------------
// Six statuses
// ---------------------------------------------------------------------------

test('AC-22: a serving node makes the role busy and lists its session and host', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'done', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'tester', 'running', '2026-11-08T10:05:00.000Z', 2)
    ],
    sessions: [
      session('s-1', 'T-001', 'idle', '2026-11-08T10:00:00.000Z'),
      session('s-2', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z')
    ]
  });
  const result = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });
  const tester = viewOf(result, 'tester');

  assert.equal(tester.status, 'busy');
  assert.equal(tester.statusReason, null);
  assert.deepEqual(tester.activeSessions, ['s-2']);
  assert.deepEqual(tester.servingNodes, ['T-002']);
  assert.deepEqual(tester.hostIcons, ['dsh']);
  assert.equal(tester.lastAction.nodeId, 'T-002');
  assert.equal(tester.lastAction.round, 2);
  assert.equal(tester.lastAction.maxRounds, 2, 'maxRounds comes from the graph');
});

test('a review-state node also counts as serving', () => {
  const state = snapshot({
    template: 'task-loop',
    nodes: [node('T-001', 'researcher', 'review', '2026-11-08T10:00:00.000Z')],
    sessions: [session('s-1', 'T-001', 'waiting_dependency', '2026-11-08T10:00:00.000Z')]
  });
  const view = viewOf(
    buildRoleInstances({ state, graph: graphOf('task-loop'), roles: roleMap() }),
    'researcher'
  );
  assert.equal(view.status, 'busy');
  assert.deepEqual(view.servingNodes, ['T-001']);
});

test('AC-23: a pending node with no session is available', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'running', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'tester', 'pending', '2026-11-08T10:00:00.000Z')
    ],
    sessions: [session('s-1', 'T-001', 'thinking', '2026-11-08T10:00:00.000Z')]
  });
  const tester = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'tester'
  );

  assert.equal(tester.status, 'available');
  assert.deepEqual(tester.activeSessions, []);
  assert.deepEqual(tester.servingNodes, []);
  assert.equal(tester.lastAction.nodeId, 'T-002');
});

test('AC-24: a finished node with nothing serving is cooling down', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'done', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'tester', 'running', '2026-11-08T10:05:00.000Z')
    ],
    sessions: [
      session('s-1', 'T-001', 'idle', '2026-11-08T10:00:00.000Z'),
      session('s-2', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z')
    ]
  });
  const developer = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'developer'
  );

  assert.equal(developer.status, 'cooldown');
  assert.deepEqual(developer.activeSessions, [], 'an idle session is not active');
  assert.deepEqual(developer.servingNodes, []);
});

test('AC-26: an escalated session makes the role unavailable with reason escalated', () => {
  const state = snapshot({
    nodes: [node('T-002', 'tester', 'escalated', '2026-11-08T10:05:00.000Z')],
    sessions: [session('s-2', 'T-002', 'escalated', '2026-11-08T10:05:00.000Z')]
  });
  const tester = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'tester'
  );

  assert.equal(tester.status, 'unavailable');
  assert.equal(tester.statusReason, 'escalated');
});

test('a quarantined session reports reason quarantined (D-9 unit-test branch)', () => {
  const state = snapshot({
    nodes: [node('T-002', 'tester', 'running', '2026-11-08T10:05:00.000Z')],
    sessions: [
      session('s-2', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z', { quarantined: true })
    ]
  });
  const tester = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'tester'
  );

  assert.equal(tester.status, 'unavailable');
  assert.equal(tester.statusReason, 'quarantined');
  assert.deepEqual(tester.activeSessions, ['s-2'], 'quarantined sessions stay active');
});

test('AC-27: a terminal instance retires every role', () => {
  for (const state_ of ['completed', 'failed', 'cancelled', 'interrupted']) {
    const state = snapshot({
      state: state_,
      nodes: [node('T-001', 'developer', 'done', '2026-11-08T10:00:00.000Z')],
      sessions: [session('s-1', 'T-001', 'idle', '2026-11-08T10:00:00.000Z')]
    });
    const result = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });
    for (const view of result.roles) {
      assert.equal(view.status, 'retired', `${state_} must retire ${view.roleId}`);
      assert.equal(view.statusReason, null);
    }
  }
});

test('suspended is not terminal', () => {
  const state = snapshot({
    state: 'suspended',
    nodes: [node('T-002', 'tester', 'running', '2026-11-08T10:05:00.000Z')],
    sessions: [session('s-2', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z')]
  });
  const tester = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'tester'
  );
  assert.equal(tester.status, 'busy');
});

// ---------------------------------------------------------------------------
// decideStatus in isolation
// ---------------------------------------------------------------------------

test('decideStatus follows the documented precedence, first hit wins', () => {
  const base = {
    terminal: false,
    known: true,
    boundCount: 1,
    sessions: [],
    servingCount: 0,
    doneCount: 0
  };

  assert.deepEqual(decideStatus({ ...base, terminal: true, known: false }), {
    status: 'retired',
    statusReason: null
  });
  assert.deepEqual(decideStatus({ ...base, known: false, boundCount: 0 }), {
    status: 'unavailable',
    statusReason: 'unknown-role'
  });
  assert.deepEqual(decideStatus({ ...base, boundCount: 0 }), {
    status: 'inactive',
    statusReason: null
  });
  assert.deepEqual(
    decideStatus({ ...base, sessions: [{ state: 'escalated' }], servingCount: 1, doneCount: 1 }),
    { status: 'unavailable', statusReason: 'escalated' }
  );
  assert.deepEqual(decideStatus({ ...base, servingCount: 1, doneCount: 1 }), {
    status: 'busy',
    statusReason: null
  });
  assert.deepEqual(decideStatus({ ...base, doneCount: 1 }), {
    status: 'cooldown',
    statusReason: null
  });
  assert.deepEqual(decideStatus(base), { status: 'available', statusReason: null });
});

test('decideStatus prefers escalated over quarantined when both appear', () => {
  const result = decideStatus({
    terminal: false,
    known: true,
    boundCount: 1,
    sessions: [{ state: 'escalated' }, { state: 'thinking', quarantined: true }],
    servingCount: 0,
    doneCount: 0
  });
  assert.deepEqual(result, { status: 'unavailable', statusReason: 'escalated' });
});

// ---------------------------------------------------------------------------
// Derived lists
// ---------------------------------------------------------------------------

test('AC-28: the cap comes from the registry, not from the snapshot', () => {
  const state = snapshot({
    nodes: [node('T-002', 'writer', 'running', '2026-11-08T10:05:00.000Z')],
    sessions: [session('s-1', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z')]
  });
  const graph = graphOf('task-loop');
  const builtin = viewOf(
    buildRoleInstances({ state, graph, roles: roleMap() }),
    'writer'
  );
  assert.equal(builtin.maxConcurrentSessions, 2);
  assert.equal(builtin.activeSessions.length, 1);

  const overridden = viewOf(
    buildRoleInstances({
      state,
      graph,
      roles: syntheticRoles({ writer: { group: 'writing', maxConcurrentSessions: 3 } })
    }),
    'writer'
  );
  assert.equal(overridden.maxConcurrentSessions, 3);
  assert.equal(overridden.activeSessions.length, 1, 'the same snapshot is reused');
});

test('AC-29: roleToSessions keeps every session, including idle ones, by creation order', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'done', '2026-11-08T10:00:00.000Z', 2),
      node('T-002', 'tester', 'running', '2026-11-08T10:05:00.000Z', 2)
    ],
    sessions: [
      session('s-2', 'T-001', 'idle', '2026-11-08T10:03:00.000Z', { round: 2 }),
      session('s-1', 'T-001', 'idle', '2026-11-08T10:00:00.000Z', { round: 1 }),
      session('s-4', 'T-002', 'thinking', '2026-11-08T10:06:00.000Z', { round: 2 }),
      session('s-3', 'T-002', 'idle', '2026-11-08T10:01:00.000Z', { round: 1 })
    ]
  });
  const result = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });

  assert.deepEqual(result.roleToSessions.developer, ['s-1', 's-2']);
  assert.deepEqual(result.roleToSessions.tester, ['s-3', 's-4']);
  assert.deepEqual(viewOf(result, 'developer').activeSessions, []);
  assert.deepEqual(viewOf(result, 'tester').activeSessions, ['s-4']);
});

test('hostIcons de-duplicates in serving order and skips null hosts', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'running', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'developer', 'review', '2026-11-08T10:05:00.000Z')
    ],
    sessions: [
      session('s-1', 'T-001', 'thinking', '2026-11-08T10:00:00.000Z', { hostId: 'dsh' }),
      session('s-2', 'T-002', 'thinking', '2026-11-08T10:05:00.000Z', { hostId: null }),
      session('s-3', 'T-001', 'idle', '2026-11-08T10:01:00.000Z', { hostId: 'cursor' })
    ]
  });
  const developer = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'developer'
  );
  assert.deepEqual(developer.hostIcons, ['dsh', 'cursor']);
  assert.deepEqual(developer.servingNodes, ['T-001', 'T-002']);
});

test('lastAction breaks a stateSince tie on the smaller nodeId', () => {
  const stamp = '2026-11-08T10:00:00.000Z';
  const state = snapshot({
    nodes: [
      node('T-002', 'developer', 'running', stamp),
      node('T-001', 'developer', 'done', stamp)
    ]
  });
  const developer = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'developer'
  );
  assert.equal(developer.lastAction.nodeId, 'T-001');
});

test('lastAction is null when the role binds no node', () => {
  const state = snapshot({ nodes: [] });
  const coordinator = viewOf(
    buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() }),
    'coordinator'
  );
  assert.equal(coordinator.lastAction, null);
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

test('AC-30: the projection is derived, it never mutates its input', () => {
  const state = snapshot({
    nodes: [node('T-002', 'tester', 'escalated', '2026-11-08T10:05:00.000Z')],
    sessions: [session('s-2', 'T-002', 'escalated', '2026-11-08T10:05:00.000Z')]
  });
  const before = JSON.parse(JSON.stringify(state));
  const first = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });
  assert.equal(viewOf(first, 'tester').status, 'unavailable');
  assert.deepEqual(state, before, 'the snapshot must be untouched');
  assert.equal(state.rev, 7);

  // Simulate the operator edit from the AC: idle + not quarantined.
  state.sessions[0].state = 'idle';
  state.sessions[0].quarantined = false;
  state.nodes[0].state = 'done';
  const second = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });
  assert.equal(viewOf(second, 'tester').status, 'cooldown');
  assert.equal(viewOf(second, 'tester').statusReason, null);
});

test('an empty input yields an empty projection instead of throwing', () => {
  assert.deepEqual(buildRoleInstances({}), { roles: [], roleToSessions: {} });
  assert.deepEqual(buildRoleInstances({ state: {}, graph: {} }), { roles: [], roleToSessions: {} });
  assert.deepEqual(
    buildRoleInstances({ state: { nodes: [], sessions: [] }, graph: { nodes: [] } }),
    { roles: [], roleToSessions: {} }
  );
});

test('a graph without a roles field falls back to the node role ids', () => {
  const state = snapshot({
    nodes: [node('T-001', 'developer', 'running', '2026-11-08T10:00:00.000Z')]
  });
  const result = buildRoleInstances({ state, graph: { nodes: state.nodes }, roles: roleMap() });
  assert.deepEqual(result.roles.map((item) => item.roleId), ['developer']);
  assert.equal(result.roles[0].lastAction.maxRounds, null);
});

test('the same role bound twice still produces one instance', () => {
  const state = snapshot({
    nodes: [
      node('T-001', 'developer', 'done', '2026-11-08T10:00:00.000Z'),
      node('T-002', 'developer', 'running', '2026-11-08T10:05:00.000Z')
    ]
  });
  const result = buildRoleInstances({ state, graph: graphOf('code-loop'), roles: roleMap() });
  assert.equal(result.roles.filter((item) => item.roleId === 'developer').length, 1);
  assert.deepEqual(viewOf(result, 'developer').servingNodes, ['T-002']);
});
