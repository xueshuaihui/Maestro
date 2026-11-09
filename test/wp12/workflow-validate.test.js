/**
 * WP-3 contract tests: the C-09 check-order orchestration over
 * `loadWorkflows`, the D-3 graph-level judgements (steps 6, 8..13), the
 * counts/errors contracts and the AC-61 built-in gate (memory side).
 *
 * Fixture roots live under `os.tmpdir()` (D-10); the loader itself stays
 * read-only. The AC-61 "asset regression turns the gate red" scenario is
 * exercised on the in-memory role table (the full file-level red/restore
 * drill belongs to S3), so these tests never touch `assets/**`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GRAPHS } from '../../src/templates/index.js';
import { loadWorkflows, WORKFLOW_CHECK_ORDER } from '../../src/registry/workflows.js';

const tempRoots = [];

function makeTemp(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wfval-${label}-`));
  tempRoots.push(root);
  return root;
}

function writeWorkflows(root, files) {
  const dir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text, 'utf8');
  }
}

function load(root, roles = MEMORY_ROLES) {
  return loadWorkflows({ root, builtinGraphs: GRAPHS, roles });
}

function codesOf(result, file = null) {
  return result.errors
    .filter((error) => file === null || error.file === file)
    .map((error) => error.code);
}

/** Minimal YAML emitter for the fixture objects (A-1 field order). */
function nodeYaml(node) {
  const lines = [];
  let first = true;
  for (const [key, value] of Object.entries(node)) {
    if (value === undefined) continue;
    const prefix = first ? '  - ' : '    ';
    first = false;
    if (Array.isArray(value)) lines.push(`${prefix}${key}: [${value.join(', ')}]`);
    else lines.push(`${prefix}${key}: ${value}`);
  }
  return lines.join('\n');
}

function edgeYaml(edge) {
  const lines = [];
  const { map, ...rest } = edge;
  let first = true;
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue;
    lines.push(`${first ? '  - ' : '    '}${key}: ${value}`);
    first = false;
  }
  if (Array.isArray(map)) {
    lines.push('    map:');
    for (const item of map) {
      lines.push(`      - from: ${item.from}`);
      lines.push(`        to: ${item.to}`);
    }
  }
  return lines.join('\n');
}

function wfYaml({ id, name = 'Fixture', entry, terminal, nodes, edges = [] }) {
  const lines = [
    'schema: workflow/v1',
    `id: ${id}`,
    `name: ${name}`,
    `entry: ${entry}`,
    `terminal: ${terminal}`,
    'nodes:',
    ...nodes.map(nodeYaml),
    edges.length > 0 ? 'edges:' : 'edges: []',
    ...(edges.length > 0 ? edges.map(edgeYaml) : [])
  ];
  return `${lines.join('\n')}\n`;
}

/** Minimal in-memory role table: the wake/role-reference oracle. */
const MEMORY_ROLES = [
  { id: 'researcher', name: 'Researcher', wake_allow: ['writer', 'editor'] },
  { id: 'writer', name: 'Writer', wake_allow: ['reviewer'] },
  { id: 'editor', name: 'Editor', wake_allow: [] },
  { id: 'reviewer', name: 'Reviewer', wake_allow: [] },
  { id: 'developer', name: 'Developer', wakeAllow: ['tester'] },
  { id: 'tester', name: 'Tester', wakeAllow: [] },
  { id: 'worker', name: 'Worker', wakeAllow: [] }
];

const NODES = {
  research: { id: 'T-001', node_type: 'role', role: 'researcher', title: 'Study', timeout: 600, retry: 2, outputs: ['research.notes'] },
  writeA: { id: 'T-002', node_type: 'role', role: 'writer', title: 'Draft A', parallel_scope: 'draft', scope: 'draft-a', inputs: ['brief'] },
  writeB: { id: 'T-003', node_type: 'role', role: 'editor', title: 'Draft B', parallel_scope: 'draft', scope: 'draft-b', inputs: ['brief'] },
  confirm: { id: 'T-004', node_type: 'human', title: 'Confirm' },
  escalate: { id: 'T-005', node_type: 'escalate', title: 'Escalate' },
  sub: { id: 'T-006', node_type: 'subworkflow', workflow: 'code-loop', title: 'Loop' }
};

/** Appendix A-13 `doc-fanout`, assembled field-verbatim. */
const DOC_FANOUT = {
  id: 'doc-fanout',
  name: 'Parallel Doc',
  entry: 'T-001',
  terminal: 'T-006',
  nodes: [NODES.research, NODES.writeA, NODES.writeB, NODES.confirm, NODES.escalate, NODES.sub],
  edges: [
    { from: 'T-001', to: 'T-002', map: [{ from: 'T-001.research.notes', to: 'brief' }] },
    { from: 'T-001', to: 'T-003', map: [{ from: 'T-001.research.notes', to: 'brief' }] },
    { from: 'T-002', to: 'T-004' },
    { from: 'T-003', to: 'T-004' },
    { from: 'T-004', to: 'T-006', when: 'human_approved' },
    { from: 'T-004', to: 'T-005', when: 'human_rejected' },
    { from: 'T-006', to: 'T-005', when: 'failed' }
  ]
};

function docFanout(overrides = {}) {
  return wfYaml({ ...DOC_FANOUT, ...overrides });
}

test('WORKFLOW_CHECK_ORDER is the frozen 13-step C-09 order', () => {
  assert.equal(Object.isFrozen(WORKFLOW_CHECK_ORDER), true);
  assert.equal(WORKFLOW_CHECK_ORDER.length, 13);
  assert.equal(WORKFLOW_CHECK_ORDER[0], 'parse');
  assert.equal(WORKFLOW_CHECK_ORDER[4], 'node-type-and-required-fields');
  assert.equal(WORKFLOW_CHECK_ORDER[7], 'reachability');
  assert.equal(WORKFLOW_CHECK_ORDER[12], 'wake-permissions');
});

test('counts carry exactly 4 keys; errors carry exactly 6 keys with scope workflow (AC-38)', () => {
  const root = makeTemp('contract');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout() });
  const result = load(root);
  assert.deepEqual(Object.keys(result.counts), ['assets', 'builtin', 'project', 'invalid']);
  assert.deepEqual(result.counts, { assets: 4, builtin: 3, project: 1, invalid: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);

  const bad = makeTemp('contract-bad');
  writeWorkflows(bad, {
    'bad-type.yaml': wfYaml({
      id: 'bad-type',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'script', role: 'writer' }],
      edges: []
    })
  });
  const failing = load(bad);
  assert.equal(failing.ok, false);
  assert.equal(failing.errors.length, 1);
  assert.deepEqual(Object.keys(failing.errors[0]), ['code', 'file', 'scope', 'field', 'line', 'params']);
  assert.equal(failing.errors[0].scope, 'workflow');
  assert.equal(failing.errors[0].file, 'workflows/bad-type.yaml');
  assert.equal(failing.counts.invalid, 1);
});

test('shape steps 2-5 and 7 delegate to checkWorkflowShape in file order (AC-25)', () => {
  const root = makeTemp('shape');
  writeWorkflows(root, {
    'a-schema.yaml': 'id: a-schema\nentry: A\nterminal: A\nnodes:\n  - id: A\n    node_type: role\n    role: writer\n',
    'b-id.yaml': wfYaml({
      id: 'not-b-id',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'role', role: 'writer' }],
      edges: []
    }),
    'c-dup.yaml': wfYaml({
      id: 'c-dup',
      entry: 'A',
      terminal: 'A',
      nodes: [
        { id: 'A', node_type: 'role', role: 'writer' },
        { id: 'A', node_type: 'role', role: 'editor' }
      ],
      edges: []
    }),
    'd-edge.yaml': wfYaml({
      id: 'd-edge',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'role', role: 'writer' }],
      edges: [{ from: 'A', to: 'A', when: 'maybe' }]
    })
  });
  const result = load(root);
  assert.deepEqual(
    result.errors.map((error) => [error.file, error.code]),
    [
      ['workflows/a-schema.yaml', 'WORKFLOW_SCHEMA_MISSING'],
      ['workflows/b-id.yaml', 'WORKFLOW_ID_MISMATCH'],
      ['workflows/c-dup.yaml', 'WORKFLOW_NODE_DUPLICATE'],
      ['workflows/d-edge.yaml', 'WORKFLOW_EDGE_INVALID']
    ]
  );
});

test('step 6: unknown role, unknown subworkflow, self cycle and cross-file cycle (AC-26 / AC-62)', () => {
  const root = makeTemp('refs');
  writeWorkflows(root, {
    'role-ghost.yaml': wfYaml({
      id: 'role-ghost',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'role', role: 'ghost-role' }],
      edges: []
    }),
    'sub-ghost.yaml': wfYaml({
      id: 'sub-ghost',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'subworkflow', workflow: 'ghost' }],
      edges: []
    }),
    'sub-self.yaml': wfYaml({
      id: 'sub-self',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'subworkflow', workflow: 'sub-self' }],
      edges: []
    }),
    'sub-a.yaml': wfYaml({
      id: 'sub-a',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'subworkflow', workflow: 'sub-b' }],
      edges: []
    }),
    'sub-b.yaml': wfYaml({
      id: 'sub-b',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'subworkflow', workflow: 'sub-a' }],
      edges: []
    })
  });
  const result = load(root);
  const byFile = new Map(result.errors.map((error) => [error.file, error]));
  assert.equal(byFile.get('workflows/role-ghost.yaml').code, 'WORKFLOW_ROLE_UNKNOWN');
  assert.equal(byFile.get('workflows/role-ghost.yaml').params.role, 'ghost-role');
  assert.equal(byFile.get('workflows/sub-ghost.yaml').code, 'WORKFLOW_SUB_UNKNOWN');
  assert.equal(byFile.get('workflows/sub-ghost.yaml').params.id, 'ghost');
  assert.equal(byFile.get('workflows/sub-self.yaml').code, 'WORKFLOW_SUB_CYCLE');
  assert.deepEqual(byFile.get('workflows/sub-self.yaml').params.chain, ['sub-self', 'sub-self']);
  const chainA = byFile.get('workflows/sub-a.yaml').params.chain;
  assert.deepEqual(chainA, ['sub-a', 'sub-b', 'sub-a']);
});

test('step 8: a node nobody points at is unreachable (AC-32)', () => {
  const root = makeTemp('reach');
  writeWorkflows(root, {
    'doc-fanout.yaml': docFanout({
      nodes: [...DOC_FANOUT.nodes, { id: 'T-007', node_type: 'role', role: 'tester' }]
    })
  });
  const result = load(root);
  assert.deepEqual(codesOf(result), ['WORKFLOW_UNREACHABLE']);
  assert.equal(result.errors[0].params.node, 'T-007');
  assert.equal(result.counts.invalid, 1);
});

test('step 8 / AC-64: human and escalate nodes are terminal states, a plain role dead end is not', () => {
  const base = {
    entry: 'T-001',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'researcher', outputs: [] },
      { id: 'T-END', node_type: 'role', role: 'writer' }
    ],
    edges: [
      { from: 'T-001', to: 'T-END' }
    ]
  };

  const humanRoot = makeTemp('end-human');
  writeWorkflows(humanRoot, {
    'human-end.yaml': wfYaml({
      id: 'human-end',
      ...base,
      terminal: 'T-END',
      nodes: [...base.nodes, { id: 'T-H', node_type: 'human', title: 'Wait' }],
      edges: [...base.edges, { from: 'T-001', to: 'T-H' }]
    })
  });
  const human = load(humanRoot);
  assert.deepEqual(
    codesOf(human).filter((code) => code !== 'WORKFLOW_ROLE_UNKNOWN'),
    []
  );
  assert.equal(human.counts.invalid, 0);

  const escRoot = makeTemp('end-esc');
  writeWorkflows(escRoot, {
    'escalate-end.yaml': wfYaml({
      id: 'escalate-end',
      ...base,
      terminal: 'T-END',
      nodes: [...base.nodes, { id: 'T-E', node_type: 'escalate', title: 'Esc' }],
      edges: [...base.edges, { from: 'T-001', to: 'T-E' }]
    })
  });
  const esc = load(escRoot);
  assert.equal(esc.counts.invalid, 0);

  const deadRoot = makeTemp('end-dead');
  writeWorkflows(deadRoot, {
    'no-end.yaml': wfYaml({
      id: 'no-end',
      ...base,
      terminal: 'T-END',
      nodes: [...base.nodes, { id: 'T-R', node_type: 'role', role: 'writer' }],
      edges: [...base.edges, { from: 'T-001', to: 'T-R' }]
    })
  });
  const dead = load(deadRoot);
  assert.deepEqual(codesOf(dead), ['WORKFLOW_UNREACHABLE']);
  assert.equal(dead.errors[0].params.node, 'T-R');
});

test('step 9: a backflow target without max_rounds is rejected, then fixed (AC-33)', () => {
  const withBackflow = {
    ...DOC_FANOUT,
    edges: [
      ...DOC_FANOUT.edges,
      { from: 'T-003', to: 'T-002', kind: 'backflow', when: 'failed' }
    ]
  };
  const root = makeTemp('rounds');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout(withBackflow) });
  const failing = load(root);
  assert.deepEqual(codesOf(failing, 'workflows/doc-fanout.yaml'), ['WORKFLOW_BACKFLOW_NO_LIMIT']);
  assert.equal(failing.errors[0].params.node, 'T-002');

  const fixed = structuredClone(withBackflow);
  fixed.nodes[1] = { ...fixed.nodes[1], max_rounds: 2 };
  const root2 = makeTemp('rounds-fixed');
  writeWorkflows(root2, { 'doc-fanout.yaml': docFanout(fixed) });
  const ok = load(root2);
  assert.deepEqual(codesOf(ok, 'workflows/doc-fanout.yaml'), []);
});

test('step 10: duplicate scopes report overlap, a one-node group reports invalid (AC-34)', () => {
  const overlapped = structuredClone(DOC_FANOUT);
  overlapped.nodes[1] = { ...overlapped.nodes[1], scope: 'draft' };
  overlapped.nodes[2] = { ...overlapped.nodes[2], scope: 'draft' };
  const root = makeTemp('scope');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout(overlapped) });
  const overlap = load(root);
  assert.deepEqual(codesOf(overlap, 'workflows/doc-fanout.yaml'), ['WORKFLOW_SCOPE_OVERLAP']);
  assert.deepEqual(overlap.errors[0].params, { scope: 'draft', a: 'T-002', b: 'T-003', name: 'draft' });

  const single = structuredClone(DOC_FANOUT);
  const { parallel_scope: _dropped, ...writeBAlone } = single.nodes[2];
  single.nodes[2] = writeBAlone;
  const root2 = makeTemp('scope-single');
  writeWorkflows(root2, { 'doc-fanout.yaml': docFanout(single) });
  const invalid = load(root2);
  assert.deepEqual(codesOf(invalid, 'workflows/doc-fanout.yaml'), ['WORKFLOW_SCOPE_INVALID']);
  assert.deepEqual(invalid.errors[0].params, { scope: 'draft' });
});

test('step 11: task inputs are legal, a non-upstream prefix and an unknown target field are not (AC-35 / AC-60)', () => {
  const shifted = structuredClone(DOC_FANOUT);
  shifted.edges[0].map = [{ from: 'T-003.research.notes', to: 'brief' }];
  const root = makeTemp('vars');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout(shifted) });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/doc-fanout.yaml'), ['WORKFLOW_VAR_UNKNOWN']);
  assert.equal(result.errors[0].params.ref, 'T-003.research.notes');

  const taskRoot = makeTemp('vars-task');
  writeWorkflows(taskRoot, {
    'task-var.yaml': wfYaml({
      id: 'task-var',
      entry: 'A',
      terminal: 'B',
      nodes: [
        { id: 'A', node_type: 'role', role: 'researcher', outputs: [] },
        { id: 'B', node_type: 'role', role: 'writer', inputs: ['brief'] }
      ],
      edges: [{ from: 'A', to: 'B', map: [{ from: 'task.brief', to: 'brief' }] }]
    })
  });
  const task = load(taskRoot);
  assert.deepEqual(codesOf(task, 'workflows/task-var.yaml'), []);

  const badTargetRoot = makeTemp('vars-target');
  writeWorkflows(badTargetRoot, {
    'bad-target.yaml': wfYaml({
      id: 'bad-target',
      entry: 'A',
      terminal: 'B',
      nodes: [
        { id: 'A', node_type: 'role', role: 'researcher', outputs: ['note'] },
        { id: 'B', node_type: 'role', role: 'writer', inputs: ['brief'] }
      ],
      edges: [{ from: 'A', to: 'B', map: [{ from: 'A.note', to: 'nope' }] }]
    })
  });
  const badTarget = load(badTargetRoot);
  assert.deepEqual(codesOf(badTarget, 'workflows/bad-target.yaml'), ['WORKFLOW_VAR_UNKNOWN']);
  assert.equal(badTarget.errors[0].params.ref, 'nope');
});

test('step 11: an input without any source reports mapping incompleteness (AC-31)', () => {
  const widened = structuredClone(DOC_FANOUT);
  widened.nodes[1] = { ...widened.nodes[1], inputs: ['brief', 'outline'] };
  const root = makeTemp('mapping');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout(widened) });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/doc-fanout.yaml'), ['WORKFLOW_MAPPING_INCOMPLETE']);
  assert.deepEqual(result.errors[0].params, { node: 'T-002', field: 'outline' });
});

test('step 12: escalate forward out edge and human edges without human conditions (AC-36)', () => {
  const withEscEdge = {
    ...DOC_FANOUT,
    edges: [...DOC_FANOUT.edges, { from: 'T-005', to: 'T-006', when: 'always' }]
  };
  const root = makeTemp('trans');
  writeWorkflows(root, { 'doc-fanout.yaml': docFanout(withEscEdge) });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/doc-fanout.yaml'), ['WORKFLOW_TRANSITION_ILLEGAL']);
  assert.deepEqual(result.errors[0].params, { reason: 'escalateForward', node: 'T-005' });

  const bareHuman = structuredClone(DOC_FANOUT);
  bareHuman.edges[4] = { from: 'T-004', to: 'T-006' };
  bareHuman.edges[5] = { from: 'T-004', to: 'T-005' };
  const root2 = makeTemp('trans-human');
  writeWorkflows(root2, { 'doc-fanout.yaml': docFanout(bareHuman) });
  const human = load(root2);
  assert.deepEqual(codesOf(human, 'workflows/doc-fanout.yaml'), ['WORKFLOW_TRANSITION_ILLEGAL']);
  assert.deepEqual(human.errors[0].params, { reason: 'humanCondition', node: 'T-004' });
});

test('step 12 / AC-60: a backflow edge may not target a human node', () => {
  const root = makeTemp('trans-target');
  writeWorkflows(root, {
    'backflow-target.yaml': wfYaml({
      id: 'backflow-target',
      entry: 'A',
      terminal: 'B',
      nodes: [
        { id: 'A', node_type: 'role', role: 'researcher', outputs: [] },
        { id: 'B', node_type: 'human', title: 'Wait' }
      ],
      edges: [{ from: 'A', to: 'B', kind: 'backflow', when: 'failed' }]
    })
  });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/backflow-target.yaml'), ['WORKFLOW_TRANSITION_ILLEGAL']);
  assert.deepEqual(result.errors[0].params, { reason: 'backflowTarget', node: 'B' });
});

test('step 13: the node-level wake_allow decides (AC-37); empty allow denies; retest is exempt (AC-60)', () => {
  const deny = wfYaml({
    id: 'wake',
    entry: 'T-001',
    terminal: 'T-002',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'writer', wake_allow: ['editor'] },
      { id: 'T-002', node_type: 'role', role: 'reviewer' }
    ],
    edges: [{ from: 'T-001', to: 'T-002' }]
  });
  const root = makeTemp('wake');
  writeWorkflows(root, { 'wake.yaml': deny });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/wake.yaml'), ['WORKFLOW_WAKE_DENIED']);
  assert.deepEqual(result.errors[0].params, { from: 'writer', to: 'reviewer' });

  const allowRoot = makeTemp('wake-ok');
  writeWorkflows(allowRoot, {
    'wake.yaml': wfYaml({
      id: 'wake',
      entry: 'T-001',
      terminal: 'T-002',
      nodes: [
        { id: 'T-001', node_type: 'role', role: 'writer', wake_allow: ['editor'] },
        { id: 'T-002', node_type: 'role', role: 'editor' }
      ],
      edges: [{ from: 'T-001', to: 'T-002' }]
    })
  });
  const allowed = load(allowRoot);
  assert.deepEqual(codesOf(allowed, 'workflows/wake.yaml'), []);

  const emptyRoot = makeTemp('wake-empty');
  writeWorkflows(emptyRoot, {
    'wake-empty.yaml': wfYaml({
      id: 'wake-empty',
      entry: 'A',
      terminal: 'B',
      nodes: [
        { id: 'A', node_type: 'role', role: 'writer', wake_allow: [] },
        { id: 'B', node_type: 'role', role: 'reviewer' }
      ],
      edges: [{ from: 'A', to: 'B' }]
    })
  });
  const empty = load(emptyRoot);
  assert.deepEqual(codesOf(empty, 'workflows/wake-empty.yaml'), ['WORKFLOW_WAKE_DENIED']);

  const retestRoot = makeTemp('wake-retest');
  writeWorkflows(retestRoot, {
    'retest-ok.yaml': wfYaml({
      id: 'retest-ok',
      entry: 'A',
      terminal: 'B',
      maxRoundsNote: undefined,
      nodes: [
        { id: 'A', node_type: 'role', role: 'writer', wake_allow: [] },
        { id: 'B', node_type: 'role', role: 'reviewer' }
      ],
      edges: [{ from: 'A', to: 'B', kind: 'retest', when: 'always' }]
    })
  });
  const retest = load(retestRoot);
  assert.deepEqual(codesOf(retest, 'workflows/retest-ok.yaml'), []);
});

test('step 13 / AC-61 gate: the three built-in graphs validate clean with the aligned roles', () => {
  const aligned = [
    { id: 'researcher', name: 'Researcher', wake_allow: ['writer'] },
    { id: 'writer', name: 'Writer', wake_allow: ['editor', 'reviewer'] },
    { id: 'developer', name: 'Developer', wakeAllow: ['tester'] },
    { id: 'tester', name: 'Tester', wakeAllow: [] },
    { id: 'worker', name: 'Worker', wakeAllow: [] },
    { id: 'editor', name: 'Editor', wakeAllow: [] },
    { id: 'reviewer', name: 'Reviewer', wakeAllow: [] }
  ];
  const root = makeTemp('gate');
  const result = load(root, aligned);
  assert.deepEqual(result.counts, { assets: 3, builtin: 3, project: 0, invalid: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.workflows.length, 3);

  // The regression drill on the memory side: writer back to [editor] turns
  // the task-loop forward edge red with the A-9 detail slots.
  const regressed = aligned.map((role) =>
    role.id === 'writer' ? { ...role, wake_allow: ['editor'] } : role
  );
  const red = load(root, regressed);
  assert.equal(red.counts.invalid, 1);
  assert.equal(red.ok, false);
  assert.equal(red.errors.length, 1);
  assert.equal(red.errors[0].code, 'WORKFLOW_WAKE_DENIED');
  assert.equal(red.errors[0].file.startsWith('\u5185\u7f6e '), true);
  assert.equal(red.errors[0].file, '\u5185\u7f6e task-loop');
  assert.deepEqual(red.errors[0].params, { from: 'writer', to: 'reviewer' });
  assert.deepEqual(Object.keys(red.errors[0]), ['code', 'file', 'scope', 'field', 'line', 'params']);
});

test('AC-65: two runs are byte-identical and the error order is file-then-step', () => {
  const root = makeTemp('order');
  writeWorkflows(root, {
    'bad-type.yaml': wfYaml({
      id: 'bad-type',
      entry: 'A',
      terminal: 'A',
      nodes: [{ id: 'A', node_type: 'script', role: 'writer' }],
      edges: []
    }),
    'wake-deny.yaml': wfYaml({
      id: 'wake-deny',
      entry: 'T-001',
      terminal: 'T-002',
      nodes: [
        { id: 'T-001', node_type: 'role', role: 'writer', wake_allow: ['editor'] },
        { id: 'T-002', node_type: 'role', role: 'reviewer' }
      ],
      edges: [{ from: 'T-001', to: 'T-002' }]
    })
  });
  const first = load(root);
  const second = load(root);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(
    first.errors.map((error) => `${error.file}:${error.code}`),
    [
      'workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID',
      'workflows/wake-deny.yaml:WORKFLOW_WAKE_DENIED'
    ]
  );
  assert.deepEqual(first.counts, { assets: 5, builtin: 3, project: 2, invalid: 2 });
});

test('inside one file the errors follow the C-09 step order (BR-40)', () => {
  const root = makeTemp('steps');
  writeWorkflows(root, {
    'doc-fanout.yaml': docFanout({
      nodes: [...DOC_FANOUT.nodes, { id: 'T-007', node_type: 'role', role: 'tester' }],
      edges: [
        ...DOC_FANOUT.edges,
        { from: 'T-003', to: 'T-002', kind: 'backflow', when: 'failed' }
      ]
    })
  });
  const result = load(root);
  assert.deepEqual(codesOf(result, 'workflows/doc-fanout.yaml'), [
    'WORKFLOW_UNREACHABLE', // step 8
    'WORKFLOW_BACKFLOW_NO_LIMIT' // step 9
  ]);
});
