/**
 * WP-3 contract tests: the YAML subset gate (D-2), the built-in read-only
 * projection (C-10) and the same-id project override (BR-18 / AC-23).
 *
 * Fixture roots are created with `fs.mkdtemp` under `os.tmpdir()` and never
 * inside the repository (D-10). `loadWorkflows` stays read-only: the tests
 * write the fixture files themselves and the loader only scans.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { GRAPHS } from '../../src/templates/index.js';
import { projectBuiltinWorkflows, loadWorkflows } from '../../src/registry/workflows.js';

const tempRoots = [];

function makeTemp(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-wfyaml-${label}-`));
  tempRoots.push(root);
  return root;
}

function writeWorkflow(root, fileName, text) {
  const dir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), text, 'utf8');
}

function load(root, extra = {}) {
  return loadWorkflows({ root, builtinGraphs: GRAPHS, roles: MEMORY_ROLES, ...extra });
}

/** Minimal in-memory role table used as the wake/role-reference oracle. */
const MEMORY_ROLES = [
  { id: 'researcher', name: 'Researcher', wake_allow: ['writer', 'editor'] },
  { id: 'writer', name: 'Writer', wake_allow: ['reviewer'] },
  { id: 'editor', name: 'Editor', wake_allow: [] },
  { id: 'reviewer', name: 'Reviewer', wake_allow: [] },
  { id: 'developer', name: 'Developer', wakeAllow: ['tester'] },
  { id: 'tester', name: 'Tester', wakeAllow: [] },
  { id: 'worker', name: 'Worker', wakeAllow: [] }
];

/** A shape-valid three-node project workflow with four edges (AC-23 shape). */
const OVERRIDE_YAML = `schema: workflow/v1
id: code-loop
name: Project Override
entry: T-001
terminal: T-003
nodes:
  - id: T-001
    node_type: role
    role: developer
    title: Build
    max_rounds: 2
    outputs: [patch]
  - id: T-002
    node_type: role
    role: tester
    title: Verify
    max_rounds: 3
    inputs: [patch]
  - id: T-003
    node_type: human
    title: Accept
edges:
  - from: T-001
    to: T-002
    map:
      - from: T-001.patch
        to: patch
  - from: T-002
    to: T-003
  - from: T-002
    to: T-001
    kind: backflow
    when: failed
  - from: T-001
    to: T-002
    kind: retest
`;

test('D-2: inline mappings, block scalars, anchors, document separators and tabs are rejected', () => {
  const root = makeTemp('subset');
  const cases = [
    // [yaml fragment, offending 1-based line]
    ['schema: workflow/v1\nid: bad-inline\nname: {a: b}\nentry: A\nterminal: A\nnodes: []\n', 3],
    ['schema: workflow/v1\nid: bad-block\nname: |\n  folded\nentry: A\nterminal: A\nnodes: []\n', 3],
    ['schema: workflow/v1\nid: bad-anchor\nname: &a anchored\nentry: A\nterminal: A\nnodes: []\n', 3],
    ['schema: workflow/v1\nid: bad-alias\nname: *a\nentry: A\nterminal: A\nnodes: []\n', 3],
    ['schema: workflow/v1\n---\nid: bad-doc\nname: X\nentry: A\nterminal: A\nnodes: []\n', 2],
    ['schema: workflow/v1\nid: bad-tab\nname: X\n\tentry: A\nterminal: A\nnodes: []\n', 4],
    ['schema: workflow/v1\nid: bad-brace\nname: a { b\nentry: A\nterminal: A\nnodes: []\n', 3]
  ];
  let index = 0;
  for (const [text, line] of cases) {
    const one = makeTemp(`subset-${index}`);
    writeWorkflow(one, `bad-${index}.yaml`, text);
    const result = load(one);
    assert.equal(result.ok, false, `case ${index}`);
    assert.equal(result.errors.length, 1, `case ${index}`);
    const error = result.errors[0];
    assert.equal(error.code, 'YAML_PARSE_FAILED', `case ${index}`);
    assert.equal(error.scope, 'workflow');
    assert.equal(error.file, `workflows/bad-${index}.yaml`);
    assert.equal(error.line, line, `case ${index} line`);
    assert.equal(error.params.line, line, `case ${index} params.line`);
    assert.equal(typeof error.params.detailKey, 'string');
    index += 1;
  }
});

test('D-2: a subset-conformant file parses and validates cleanly', () => {
  const root = makeTemp('clean');
  writeWorkflow(root, 'code-loop.yaml', OVERRIDE_YAML);
  const result = load(root);
  assert.deepEqual(
    result.errors.filter((error) => error.file === 'workflows/code-loop.yaml'),
    []
  );
  const workflow = result.workflows.find((item) => item.id === 'code-loop');
  assert.ok(workflow);
  assert.deepEqual(
    workflow.edges.map((edge) => edge.kind),
    ['forward', 'forward', 'backflow', 'retest']
  );
  // Defaults are normalized on the in-memory edge objects; a declared
  // closed-domain `when` (here the backflow's `failed`) is kept verbatim.
  assert.deepEqual(
    workflow.edges.map((edge) => edge.when),
    ['always', 'always', 'failed', 'always']
  );
  assert.deepEqual(workflow.edges.map((edge) => edge.join), ['all', 'all', 'all', 'all']);
});

test('C-10: the projection turns GRAPHS into three read-only workflow/v1 shapes', () => {
  const projected = projectBuiltinWorkflows(GRAPHS);
  assert.equal(projected.length, 3);
  for (const workflow of projected) {
    assert.equal(workflow.source, 'builtin');
    assert.equal(workflow.file, null);
    assert.equal(workflow.schema, 'workflow/v1');
    for (const node of workflow.nodes) {
      assert.equal(node.node_type, 'role');
      assert.equal(typeof node.role, 'string');
    }
    for (const edge of workflow.edges) {
      assert.ok(['forward', 'backflow', 'retest'].includes(edge.kind));
      // null and runtime-only conditions normalize to 'always' (C-10).
      assert.equal(edge.when, 'always');
    }
  }

  const byId = new Map(projected.map((workflow) => [workflow.id, workflow]));
  const single = byId.get('single');
  assert.equal(single.nodes.length, 1);
  assert.equal(single.edges.length, 0);
  assert.equal(single.nodes[0].max_rounds, 1);

  const codeLoop = byId.get('code-loop');
  assert.equal(codeLoop.nodes.length, 2);
  assert.equal(codeLoop.edges.length, 3);
  assert.deepEqual(
    codeLoop.edges.map((edge) => edge.kind),
    ['forward', 'backflow', 'retest']
  );
  assert.equal(codeLoop.nodes[0].title, '开发');
  assert.equal(codeLoop.nodes[0].max_rounds, 2);
  assert.equal(codeLoop.nodes[1].max_rounds, 2);

  const taskLoop = byId.get('task-loop');
  assert.equal(taskLoop.nodes.length, 3);
  assert.equal(taskLoop.edges.length, 4);
  assert.equal(taskLoop.nodes[0].title, '研究员');
});

test('C-10: a null graph title falls back to the injected role display name, else stays null', () => {
  const projected = projectBuiltinWorkflows(GRAPHS, {
    roleNames: { worker: 'Worker CN', developer: 'Developer CN' }
  });
  const single = projected.find((workflow) => workflow.id === 'single');
  assert.equal(single.nodes[0].title, 'Worker CN');

  const withoutNames = projectBuiltinWorkflows(GRAPHS);
  assert.equal(withoutNames.find((workflow) => workflow.id === 'single').nodes[0].title, null);
});

test('C-10: the workflow display name is injected data, falling back to the graph id', () => {
  const named = projectBuiltinWorkflows(GRAPHS, { names: { 'code-loop': 'Coding Loop CN' } });
  assert.equal(named.find((workflow) => workflow.id === 'code-loop').name, 'Coding Loop CN');
  assert.equal(named.find((workflow) => workflow.id === 'single').name, 'single');
  const plain = projectBuiltinWorkflows(GRAPHS);
  assert.equal(plain.find((workflow) => workflow.id === 'code-loop').name, 'code-loop');
});

test('BR-18 / AC-23: a same-id project workflow overrides the built-in as a whole', () => {
  const root = makeTemp('override');
  writeWorkflow(root, 'code-loop.yaml', OVERRIDE_YAML);
  const result = load(root);
  assert.deepEqual(result.counts, { assets: 3, builtin: 2, project: 1, invalid: 0 });
  assert.equal(result.ok, true);

  const overridden = result.workflowMap.get('code-loop');
  assert.equal(overridden.source, 'project');
  assert.equal(overridden.file, 'workflows/code-loop.yaml');
  assert.equal(overridden.nodes.length, 3);
  assert.equal(overridden.edges.length, 4);
  assert.equal(overridden.nodes[1].max_rounds, 3);

  // Sort order is the plain file-string dictionary order: `workflows/...`
  // sorts before the `内置 ` prefixed built-ins (A-9).
  assert.deepEqual(
    result.workflows.map((workflow) => [workflow.id, workflow.source]),
    [
      ['code-loop', 'project'],
      ['single', 'builtin'],
      ['task-loop', 'builtin']
    ]
  );
});

test('BR-18: the merge counts an unparseable project file in assets and invalid', () => {
  const root = makeTemp('override-broken');
  writeWorkflow(root, 'code-loop.yaml', 'name: {oops}\n');
  const result = load(root);
  assert.equal(result.ok, false);
  assert.equal(result.counts.assets, 3);
  assert.equal(result.counts.builtin, 2);
  assert.equal(result.counts.project, 1);
  assert.equal(result.counts.invalid, 1);
  assert.equal(result.errors[0].code, 'YAML_PARSE_FAILED');
  // The broken file shadows the built-in it overrides, so no usable
  // 'code-loop' survives the merge (the project wins as a whole, BR-18).
  assert.equal(result.workflowMap.get('code-loop'), undefined);
  assert.equal(result.workflows.length, 2);
});

test('a missing .orch/workflows directory is skipped silently (D-3 step 2)', () => {
  const root = makeTemp('empty');
  const result = load(root);
  assert.deepEqual(result.counts, { assets: 3, builtin: 3, project: 0, invalid: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.workflows.length, 3);
});
