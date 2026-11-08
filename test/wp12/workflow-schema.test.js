/**
 * WP-1 contract tests for the workflow field-contract kernel (split doc
 * 2.1 / 2.20 row 1). Pure in-memory objects only — no disk access (D-10).
 *
 * Covered here: the 19 reason-code constants verbatim from A-15, the closed
 * value sets (node_type / kind / when / join) and numeric ranges, the
 * four-type required-field matrix (AC-24 / AC-25 / AC-26 / AC-62 shape
 * part), the timeout / retry / max_rounds boundary values (AC-29 shape
 * part), node id uniqueness, the top-level key contract and the
 * `{code, field, params}` return convention shared with role-schema.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOIN_VALUES,
  MAX_ROUNDS_MAX,
  MAX_ROUNDS_MIN,
  NODE_REQUIRED_FIELD,
  NODE_TYPES,
  RETRY_MAX,
  RETRY_MIN,
  TIMEOUT_MAX,
  TIMEOUT_MIN,
  WORKFLOW_REASONS,
  WORKFLOW_SCHEMA_VERSION,
  WHEN_VALUES,
  EDGE_KINDS,
  checkEdgeShape,
  checkNodeShape,
  checkWorkflowShape,
} from '../../src/registry/workflow-schema.js';

/** The 19 codes in A-15 table order, verbatim. */
const A15_WORKFLOW_CODES = [
  'WORKFLOW_SCHEMA_MISSING',
  'WORKFLOW_ID_MISMATCH',
  'WORKFLOW_NODE_DUPLICATE',
  'WORKFLOW_NODE_TYPE_INVALID',
  'WORKFLOW_NODE_FIELD_MISSING',
  'WORKFLOW_ROLE_UNKNOWN',
  'WORKFLOW_SUB_UNKNOWN',
  'WORKFLOW_SUB_CYCLE',
  'WORKFLOW_EDGE_INVALID',
  'WORKFLOW_TIMEOUT_INVALID',
  'WORKFLOW_RETRY_INVALID',
  'WORKFLOW_UNREACHABLE',
  'WORKFLOW_BACKFLOW_NO_LIMIT',
  'WORKFLOW_SCOPE_OVERLAP',
  'WORKFLOW_SCOPE_INVALID',
  'WORKFLOW_VAR_UNKNOWN',
  'WORKFLOW_MAPPING_INCOMPLETE',
  'WORKFLOW_TRANSITION_ILLEGAL',
  'WORKFLOW_WAKE_DENIED',
];

function makeValidWorkflow() {
  return {
    schema: 'workflow/v1',
    id: 'sample-flow',
    name: 'Sample Flow',
    summary: 'A shape-valid sample used by the contract tests',
    entry: 'n1',
    terminal: 'n6',
    nodes: [
      { id: 'n1', node_type: 'role', role: 'role-alpha', title: 'Step 1', timeout: 600, retry: 2, outputs: ['note'] },
      { id: 'n2', node_type: 'role', role: 'role-beta', title: 'Step 2a', parallel_scope: 'pair', scope: 'pair-a', inputs: ['brief'] },
      { id: 'n3', node_type: 'role', role: 'role-gamma', title: 'Step 2b', parallel_scope: 'pair', scope: 'pair-b', inputs: ['brief'] },
      { id: 'n4', node_type: 'human', title: 'Confirm' },
      { id: 'n5', node_type: 'escalate', title: 'Escalate' },
      { id: 'n6', node_type: 'subworkflow', workflow: 'child-flow', title: 'Nested' },
    ],
    edges: [
      { from: 'n1', to: 'n2', map: [{ from: 'n1.note', to: 'brief' }] },
      { from: 'n1', to: 'n3', map: [{ from: 'n1.note', to: 'brief' }] },
      { from: 'n2', to: 'n4' },
      { from: 'n3', to: 'n4', join: 'any' },
      { from: 'n4', to: 'n6', when: 'human_approved' },
      { from: 'n4', to: 'n5', when: 'human_rejected' },
      { from: 'n6', to: 'n5', when: 'failed' },
    ],
  };
}

test('WORKFLOW_REASONS holds the 19 A-15 codes verbatim, frozen, name equals value', () => {
  assert.equal(Object.isFrozen(WORKFLOW_REASONS), true);
  const keys = Object.keys(WORKFLOW_REASONS);
  assert.equal(keys.length, 19);
  assert.deepEqual(keys, A15_WORKFLOW_CODES);
  for (const key of keys) {
    assert.equal(WORKFLOW_REASONS[key], key);
    assert.ok(key.startsWith('WORKFLOW_'));
  }
});

test('closed value sets and numeric ranges are frozen and verbatim', () => {
  assert.equal(WORKFLOW_SCHEMA_VERSION, 'workflow/v1');
  assert.deepEqual([...NODE_TYPES], ['role', 'human', 'escalate', 'subworkflow']);
  assert.deepEqual([...EDGE_KINDS], ['forward', 'backflow', 'retest']);
  assert.deepEqual([...WHEN_VALUES], ['always', 'passed', 'failed', 'human_approved', 'human_rejected']);
  assert.deepEqual([...JOIN_VALUES], ['all', 'any']);
  for (const set of [NODE_TYPES, EDGE_KINDS, WHEN_VALUES, JOIN_VALUES]) {
    assert.equal(Object.isFrozen(set), true);
  }
  assert.deepEqual([TIMEOUT_MIN, TIMEOUT_MAX], [1, 86400]);
  assert.deepEqual([RETRY_MIN, RETRY_MAX], [0, 5]);
  assert.deepEqual([MAX_ROUNDS_MIN, MAX_ROUNDS_MAX], [1, 9]);
  assert.deepEqual({ ...NODE_REQUIRED_FIELD }, {
    role: 'role',
    human: 'title',
    escalate: 'title',
    subworkflow: 'workflow',
  });
});

test('a shape-valid workflow with all four node types returns no issues (AC-24 / AC-63 shape part)', () => {
  assert.deepEqual(checkWorkflowShape(makeValidWorkflow(), { fileId: 'sample-flow' }), []);
});

test('each type-required field missing yields WORKFLOW_NODE_FIELD_MISSING (AC-25 / AC-62 shape part)', () => {
  const matrix = [
    [{ id: 'n1', node_type: 'role', title: 'x' }, 'role'],
    [{ id: 'n2', node_type: 'human' }, 'title'],
    [{ id: 'n3', node_type: 'escalate' }, 'title'],
    [{ id: 'n4', node_type: 'subworkflow', title: 'x' }, 'workflow'],
  ];
  for (const [node, field] of matrix) {
    const issues = checkNodeShape(node);
    assert.equal(issues.length, 1, `node_type ${node.node_type}`);
    assert.equal(issues[0].code, 'WORKFLOW_NODE_FIELD_MISSING');
    assert.equal(issues[0].field, field);
    assert.equal(issues[0].params.field, field);
    assert.equal(issues[0].params.node, node.id);
  }
});

test('an unknown node_type yields WORKFLOW_NODE_TYPE_INVALID with {value} params (AC-25)', () => {
  const issues = checkNodeShape({ id: 'n1', node_type: 'script' });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'WORKFLOW_NODE_TYPE_INVALID');
  assert.equal(issues[0].field, 'node_type');
  assert.deepEqual(issues[0].params, { value: 'script' });
});

test('a missing node_type or id is a field-missing issue, not a type-invalid one', () => {
  const noType = checkNodeShape({ id: 'n1' });
  assert.equal(noType.length, 1);
  assert.equal(noType[0].code, 'WORKFLOW_NODE_FIELD_MISSING');
  assert.equal(noType[0].params.field, 'node_type');

  const noId = checkNodeShape({ node_type: 'role', role: 'role-alpha' });
  assert.equal(noId.length, 1);
  assert.equal(noId[0].code, 'WORKFLOW_NODE_FIELD_MISSING');
  assert.equal(noId[0].params.field, 'id');
  assert.equal(noId[0].params.node, null);
});

test('timeout boundaries: 1 and 86400 are valid, 0 / 86401 / non-integers are rejected (AC-29)', () => {
  for (const value of [TIMEOUT_MIN, TIMEOUT_MAX]) {
    assert.deepEqual(
      checkNodeShape({ id: 'n1', node_type: 'human', title: 'x', timeout: value }).filter(
        (issue) => issue.code === 'WORKFLOW_TIMEOUT_INVALID'
      ),
      []
    );
  }
  for (const value of [0, TIMEOUT_MAX + 1, 600.5, '600', null]) {
    const issues = checkNodeShape({ id: 'n1', node_type: 'human', title: 'x', timeout: value });
    assert.equal(issues.length, 1, `timeout ${String(value)}`);
    assert.equal(issues[0].code, 'WORKFLOW_TIMEOUT_INVALID');
    assert.deepEqual(issues[0].params, { value });
  }
});

test('retry boundaries: 0 and 5 are valid, -1 / 6 / non-integers are rejected (AC-29)', () => {
  for (const value of [RETRY_MIN, RETRY_MAX]) {
    assert.deepEqual(
      checkNodeShape({ id: 'n1', node_type: 'human', title: 'x', retry: value }).filter(
        (issue) => issue.code === 'WORKFLOW_RETRY_INVALID'
      ),
      []
    );
  }
  for (const value of [RETRY_MIN - 1, RETRY_MAX + 1, 2.5, '2']) {
    const issues = checkNodeShape({ id: 'n1', node_type: 'human', title: 'x', retry: value });
    assert.equal(issues.length, 1, `retry ${String(value)}`);
    assert.equal(issues[0].code, 'WORKFLOW_RETRY_INVALID');
    assert.deepEqual(issues[0].params, { value });
  }
});

test('max_rounds boundaries: 1 and 9 are valid, out-of-range values report the generic edge code', () => {
  for (const value of [MAX_ROUNDS_MIN, MAX_ROUNDS_MAX]) {
    assert.deepEqual(
      checkNodeShape({ id: 'n1', node_type: 'role', role: 'role-alpha', max_rounds: value }),
      []
    );
  }
  for (const value of [0, MAX_ROUNDS_MAX + 1, 2.5]) {
    const issues = checkNodeShape({ id: 'n1', node_type: 'role', role: 'role-alpha', max_rounds: value });
    assert.equal(issues.length, 1, `max_rounds ${String(value)}`);
    assert.equal(issues[0].code, 'WORKFLOW_EDGE_INVALID');
    assert.equal(issues[0].field, 'max_rounds');
    assert.equal(issues[0].params.detail, 'max_rounds');
  }
});

test('malformed optional node keys report field issues; well-formed ones pass', () => {
  assert.deepEqual(
    checkNodeShape({
      id: 'n1',
      node_type: 'role',
      role: 'role-alpha',
      title: 'x',
      parallel_scope: 'pair',
      scope: 'pair-a',
      inputs: ['brief'],
      outputs: ['note'],
    }),
    []
  );
  for (const [patch, field] of [
    [{ title: 7 }, 'title'],
    [{ parallel_scope: [] }, 'parallel_scope'],
    [{ scope: {} }, 'scope'],
    [{ inputs: ['a', 2] }, 'inputs'],
    [{ outputs: 'note' }, 'outputs'],
  ]) {
    const issues = checkNodeShape({ id: 'n1', node_type: 'role', role: 'role-alpha', ...patch });
    assert.equal(issues.length, 1, field);
    assert.equal(issues[0].code, 'WORKFLOW_NODE_FIELD_MISSING');
    assert.equal(issues[0].field, field);
  }
});

test('missing required top-level keys report WORKFLOW_SCHEMA_MISSING per key', () => {
  const issues = checkWorkflowShape({});
  const fields = issues.map((issue) => issue.params.field);
  assert.deepEqual(fields, ['schema', 'id', 'name', 'entry', 'terminal', 'nodes']);
  for (const issue of issues) assert.equal(issue.code, 'WORKFLOW_SCHEMA_MISSING');
});

test('wrong schema value, empty or non-array nodes and non-array edges are schema issues', () => {
  const base = makeValidWorkflow();

  const badSchema = { ...base, schema: 'workflow/v2' };
  let issues = checkWorkflowShape(badSchema);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'WORKFLOW_SCHEMA_MISSING');
  assert.equal(issues[0].field, 'schema');

  for (const nodes of [[], 'nope', null]) {
    issues = checkWorkflowShape({ ...base, nodes }).filter(
      (issue) => issue.field === 'nodes' && issue.code === 'WORKFLOW_SCHEMA_MISSING'
    );
    assert.equal(issues.length, 1, `nodes ${String(nodes)}`);
  }

  for (const edges of ['nope', { from: 'n1' }]) {
    issues = checkWorkflowShape({ ...base, edges }).filter(
      (issue) => issue.field === 'edges' && issue.code === 'WORKFLOW_SCHEMA_MISSING'
    );
    assert.equal(issues.length, 1, `edges ${String(edges)}`);
  }
});

test('non-string name / summary / entry / terminal values are schema issues', () => {
  const base = makeValidWorkflow();
  for (const key of ['name', 'summary', 'entry', 'terminal']) {
    const issues = checkWorkflowShape({ ...base, [key]: 42 }).filter(
      (issue) => issue.field === key
    );
    assert.equal(issues.length, 1, key);
    assert.equal(issues[0].code, 'WORKFLOW_SCHEMA_MISSING');
  }
});

test('id charset violations and file-name mismatch report WORKFLOW_ID_MISMATCH', () => {
  const base = makeValidWorkflow();
  const mismatch = (workflow, fileId) =>
    checkWorkflowShape(workflow, fileId === undefined ? {} : { fileId }).filter(
      (issue) => issue.code === 'WORKFLOW_ID_MISMATCH'
    );

  let issues;
  assert.deepEqual(mismatch(base, 'sample-flow'), []);
  assert.deepEqual(mismatch(base), []);

  issues = mismatch(base, 'different-name');
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].params, { fileId: 'different-name', declaredId: 'sample-flow' });

  for (const id of ['Bad', 'a', '-lead', 'has_underscore', 42]) {
    issues = mismatch({ ...base, id }, 'sample-flow');
    assert.equal(issues.length, 1, `id ${String(id)}`);
    assert.equal(issues[0].code, 'WORKFLOW_ID_MISMATCH');
  }
});

test('duplicate node ids report WORKFLOW_NODE_DUPLICATE once per id', () => {
  const base = makeValidWorkflow();
  const workflow = {
    ...base,
    nodes: [
      ...base.nodes,
      { id: 'n1', node_type: 'human', title: 'Again' },
      { id: 'n3', node_type: 'human', title: 'Again' },
      { id: 'n3', node_type: 'human', title: 'Again' },
    ],
  };
  const issues = checkWorkflowShape(workflow).filter(
    (issue) => issue.code === 'WORKFLOW_NODE_DUPLICATE'
  );
  assert.deepEqual(
    issues.map((issue) => issue.params.id),
    ['n1', 'n3']
  );
});

test('undeclared top-level keys are tolerated (only A-1 keys are judged)', () => {
  const workflow = { ...makeValidWorkflow(), extra_key: ' tolerated' };
  assert.deepEqual(checkWorkflowShape(workflow, { fileId: 'sample-flow' }), []);
});

test('edges: missing endpoints, bad kind / when / join and malformed map report WORKFLOW_EDGE_INVALID', () => {
  assert.deepEqual(checkEdgeShape({ from: 'n1', to: 'n2' }), []);
  assert.deepEqual(checkEdgeShape({ from: 'n1', to: 'n2', kind: 'backflow', when: 'failed', join: 'any' }), []);
  assert.deepEqual(checkEdgeShape({ from: 'n1', to: 'n2', map: [{ from: 'n1.note', to: 'brief' }] }), []);

  for (const [edge, field] of [
    [{ to: 'n2' }, 'from'],
    [{ from: 'n1' }, 'to'],
    [{ from: 'n1', to: 'n2', kind: 'jump' }, 'kind'],
    [{ from: 'n1', to: 'n2', when: 'maybe' }, 'when'],
    [{ from: 'n1', to: 'n2', join: 'both' }, 'join'],
    [{ from: 'n1', to: 'n2', map: 'nope' }, 'map'],
    [{ from: 'n1', to: 'n2', map: [{ from: 'n1.note' }] }, 'map'],
    [{ from: 'n1', to: 'n2', map: [{ from: 'n1.note', to: 3 }] }, 'map'],
  ]) {
    const issues = checkEdgeShape(edge);
    assert.equal(issues.length, 1, field);
    assert.equal(issues[0].code, 'WORKFLOW_EDGE_INVALID');
    assert.equal(issues[0].field, field);
  }
});

test('per-node and per-edge issues are aggregated by checkWorkflowShape in document order', () => {
  const workflow = {
    schema: 'workflow/v1',
    id: 'sample-flow',
    name: 'Sample Flow',
    entry: 'n1',
    terminal: 'n2',
    nodes: [
      { id: 'n1', node_type: 'script' },
      { id: 'n2', node_type: 'human', timeout: 0 },
    ],
    edges: [{ from: 'n1', when: 'failed' }],
  };
  const issues = checkWorkflowShape(workflow);
  assert.deepEqual(
    issues.map((issue) => issue.code),
    [
      'WORKFLOW_NODE_TYPE_INVALID',
      'WORKFLOW_NODE_FIELD_MISSING',
      'WORKFLOW_TIMEOUT_INVALID',
      'WORKFLOW_EDGE_INVALID',
    ]
  );
});

test('every returned issue follows the {code, field, params} convention', () => {
  const broken = {
    schema: 'nope',
    id: 'Bad!',
    nodes: [{ node_type: 'script' }, { id: 'n2', node_type: 'human' }],
    edges: [{ to: 'n2', kind: 'jump', map: [null] }],
  };
  const all = [
    ...checkWorkflowShape(broken, { fileId: 'broken' }),
    ...checkNodeShape(null),
    ...checkEdgeShape(undefined),
  ];
  assert.ok(all.length >= 8);
  for (const issue of all) {
    assert.equal(typeof issue.code, 'string');
    assert.ok(issue.field === null || typeof issue.field === 'string');
    assert.equal(typeof issue.params, 'object');
    assert.notEqual(issue.params, null);
    assert.ok(A15_WORKFLOW_CODES.includes(issue.code));
  }
});
