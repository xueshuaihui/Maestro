/**
 * I1.6 WP-2 contract tests for `checkRoleContracts` (split doc 2.2 / D-10 file 9).
 *
 * Pure in-memory fixtures: no filesystem, no assets directory, no CLI. Covered:
 * the seven A-15 role reason codes (each with a triggering and a clean case),
 * the three fixed permission sentences selected via the English `params.reason`
 * keys shared with `ROLE_PERMISSION_TEXT` in `src/cli/labels.js`, field-level
 * contract binding (BR-13), derive chains (BR-06), the C-08 step 8..11 issue
 * order with the one-code-per-file rule, and the AC-11 shape for the part that
 * belongs to this layer (the `ROLE_SCHEMA_MISSING` / `ROLE_SKILL_NOT_FOUND`
 * issues and the 31/16/10/invalid-5 counters are produced by the loader / CLI
 * layer, not here).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkRoleContracts } from '../../src/registry/contracts.js';
import { ROLE_PERMISSION_TEXT } from '../../src/cli/labels.js';

const ISSUE_KEYS = ['code', 'file', 'scope', 'field', 'line', 'params'];

function makeRole(overrides = {}) {
  const base = {
    schema: 'role/v1',
    id: 'alpha',
    name: 'Alpha',
    group: 'ops',
    summary: 'fixture role',
    artifact_type: 'report',
    side_effect: 'none',
    skills: ['some-skill'],
    tools: [],
    wake_allow: [],
    max_concurrent_sessions: 1,
    source: 'project',
    file: `roles/${overrides.id ?? 'alpha'}.yaml`
  };
  return { ...base, ...overrides };
}

function makeWorkflow(overrides = {}) {
  return {
    id: 'flow-a',
    nodes: [],
    edges: [],
    ...overrides
  };
}

test('ROLE_TOOL_UNKNOWN: first invalid tool value is reported once per file', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 't1', side_effect: 'read', tools: ['read', 'curl', 'wget'] })]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_TOOL_UNKNOWN');
  assert.equal(issues[0].field, 'tools');
  assert.deepEqual(issues[0].params, { value: 'curl' });
});

test('ROLE_TOOL_UNKNOWN: the four legal tool values stay silent', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 't2', side_effect: 'exec', tools: ['read', 'write', 'edit', 'bash'] })]
  });
  assert.deepEqual(issues, []);
});

test('ROLE_PERMISSION_MISMATCH: read role with a write tool', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p1', side_effect: 'read', tools: ['read', 'write'] })]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_PERMISSION_MISMATCH');
  assert.deepEqual(issues[0].params, { tool: 'write', reason: 'readWithWriteTool' });
});

test('ROLE_PERMISSION_MISMATCH: edit counts as a write tool for read roles', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p2', side_effect: 'read', tools: ['edit'] })]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].params.reason, 'readWithWriteTool');
  assert.equal(issues[0].params.tool, 'edit');
});

test('ROLE_PERMISSION_MISMATCH: exec role without a command tool', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p3', side_effect: 'exec', tools: ['read'] })]
  });
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].params, { tool: 'bash', reason: 'execNeedsCommandTool' });
});

test('ROLE_PERMISSION_MISMATCH: exec role with bash passes', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p4', side_effect: 'exec', tools: ['read', 'bash'] })]
  });
  assert.deepEqual(issues, []);
});

test('ROLE_PERMISSION_MISMATCH: none role must not carry any tool', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p5', side_effect: 'none', tools: ['read'] })]
  });
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].params, { tool: 'read', reason: 'noneWithAnyTool' });
});

test('ROLE_PERMISSION_MISMATCH: none role without tools passes', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'p6', side_effect: 'none', tools: [] })]
  });
  assert.deepEqual(issues, []);
});

test('ROLE_PERMISSION_MISMATCH: reason keys align with the CLI label table', () => {
  const reasons = ['readWithWriteTool', 'execNeedsCommandTool', 'noneWithAnyTool'];
  for (const reason of reasons) {
    assert.ok(Object.hasOwn(ROLE_PERMISSION_TEXT, reason), `missing label key: ${reason}`);
  }
});

test('ROLE_WAKE_UNKNOWN: a wake entry outside the role set is reported', () => {
  const issues = checkRoleContracts({
    roles: [
      makeRole({ id: 'w1', wake_allow: ['ghost'] }),
      makeRole({ id: 'w2', wake_allow: ['w1'] })
    ]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_WAKE_UNKNOWN');
  assert.equal(issues[0].file, 'roles/w1.yaml');
  assert.equal(issues[0].field, 'wake_allow');
  assert.deepEqual(issues[0].params, { role: 'ghost' });
});

test('ROLE_WAKE_SELF: the whitelist must not contain the role itself', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'w3', wake_allow: ['w3', 'w1'] }), makeRole({ id: 'w1' })]
  });
  const self = issues.find((issue) => issue.code === 'ROLE_WAKE_SELF');
  assert.ok(self, 'expected a ROLE_WAKE_SELF issue');
  assert.equal(self.file, 'roles/w3.yaml');
  assert.deepEqual(self.params, { role: 'w3' });
});

test('ROLE_WAKE_UNKNOWN: known targets pass and empty lists stay silent', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'w4', wake_allow: ['w5'] }), makeRole({ id: 'w5', wake_allow: [] })]
  });
  assert.deepEqual(issues, []);
});

test('ROLE_DERIVE_MISSING: a derive target outside the role set is reported', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'd1', derived_from: 'ghost' })]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_DERIVE_MISSING');
  assert.equal(issues[0].field, 'derived_from');
  assert.deepEqual(issues[0].params, { role: 'ghost' });
});

test('ROLE_DERIVE_CYCLE: self-derivation closes a one-step chain', () => {
  const issues = checkRoleContracts({
    roles: [makeRole({ id: 'd2', derived_from: 'd2' })]
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_DERIVE_CYCLE');
  assert.deepEqual(issues[0].params, { chain: ['d2', 'd2'] });
});

test('ROLE_DERIVE_CYCLE: every member reports the cycle rotated to itself', () => {
  const issues = checkRoleContracts({
    roles: [
      makeRole({ id: 'ca', derived_from: 'cb' }),
      makeRole({ id: 'cb', derived_from: 'ca' }),
      makeRole({ id: 'tail', derived_from: 'ca' })
    ]
  });
  const cycles = issues.filter((issue) => issue.code === 'ROLE_DERIVE_CYCLE');
  assert.equal(cycles.length, 2, 'the tail role must stay silent');
  assert.deepEqual(cycles.map((issue) => issue.file), ['roles/ca.yaml', 'roles/cb.yaml']);
  assert.deepEqual(cycles[0].params, { chain: ['ca', 'cb', 'ca'] });
  assert.deepEqual(cycles[1].params, { chain: ['cb', 'ca', 'cb'] });
});

test('ROLE_DERIVE_CYCLE: an acyclic derive chain stays silent', () => {
  const issues = checkRoleContracts({
    roles: [
      makeRole({ id: 'da', derived_from: 'db' }),
      makeRole({ id: 'db' })
    ]
  });
  assert.deepEqual(issues, []);
});

test('ROLE_CONTRACT_UNBOUND: unbound input and unbound output, field by field', () => {
  const roles = [
    makeRole({ id: 'scout', file: 'roles/scout.yaml', inputs: ['brief'], outputs: ['notes'] }),
    makeRole({ id: 'scribe', file: 'roles/scribe.yaml', inputs: ['notes'], outputs: ['digest'] })
  ];
  const workflows = [
    makeWorkflow({
      nodes: [
        { id: 'T-001', node_type: 'role', role: 'scout' },
        { id: 'T-002', node_type: 'role', role: 'scribe' }
      ],
      edges: [{ from: 'T-001', to: 'T-002', map: { from: 'T-001.notes', to: 'notes' } }]
    })
  ];
  const issues = checkRoleContracts({ roles, workflows });
  assert.equal(issues.length, 2);
  assert.equal(issues[0].file, 'roles/scout.yaml');
  assert.equal(issues[0].field, 'inputs');
  assert.deepEqual(issues[0].params, { field: 'brief', side: 'source' });
  assert.equal(issues[1].file, 'roles/scribe.yaml');
  assert.equal(issues[1].field, 'outputs');
  assert.deepEqual(issues[1].params, { field: 'digest', side: 'destination' });
  assert.ok(!issues.some((issue) => issue.params.field === 'notes'), 'notes is bound on both sides');
});

test('ROLE_CONTRACT_UNBOUND: upstream outputs bind an input without a map', () => {
  const roles = [makeRole({ id: 'down', inputs: ['brief'] })];
  const workflows = [
    makeWorkflow({
      nodes: [
        { id: 'N1', node_type: 'role', role: 'other', outputs: ['brief'] },
        { id: 'N2', node_type: 'role', role: 'down' }
      ],
      edges: [{ from: 'N1', to: 'N2', map: null }]
    })
  ];
  assert.deepEqual(checkRoleContracts({ roles, workflows }), []);
});

test('ROLE_CONTRACT_UNBOUND: a map.to entry binds an input without upstream outputs', () => {
  const roles = [makeRole({ id: 'down', inputs: ['brief'] })];
  const workflows = [
    makeWorkflow({
      nodes: [
        { id: 'N1', node_type: 'role', role: 'other' },
        { id: 'N2', node_type: 'role', role: 'down' }
      ],
      edges: [{ from: 'N1', to: 'N2', map: { from: 'N1.raw', to: 'brief' } }]
    })
  ];
  assert.deepEqual(checkRoleContracts({ roles, workflows }), []);
});

test('ROLE_CONTRACT_UNBOUND: downstream inputs bind an output without a map', () => {
  const roles = [makeRole({ id: 'up', outputs: ['digest'] })];
  const workflows = [
    makeWorkflow({
      nodes: [
        { id: 'N1', node_type: 'role', role: 'up' },
        { id: 'N2', node_type: 'role', role: 'other', inputs: ['digest'] }
      ],
      edges: [{ from: 'N1', to: 'N2', map: null }]
    })
  ];
  assert.deepEqual(checkRoleContracts({ roles, workflows }), []);
});

test('ROLE_CONTRACT_UNBOUND: roles without any referencing workflow are skipped', () => {
  const roles = [makeRole({ id: 'lonely', inputs: ['brief'], outputs: ['digest'] })];
  assert.deepEqual(checkRoleContracts({ roles, workflows: [] }), []);
  assert.deepEqual(checkRoleContracts({ roles }), []);
});

test('ROLE_CONTRACT_UNBOUND: only the first unbound field per file is reported', () => {
  const roles = [makeRole({ id: 'greedy', file: 'roles/greedy.yaml', inputs: ['a', 'b'] })];
  const workflows = [
    makeWorkflow({
      nodes: [{ id: 'N1', node_type: 'role', role: 'greedy' }],
      edges: []
    })
  ];
  const issues = checkRoleContracts({ roles, workflows });
  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].params, { field: 'a', side: 'source' });
});

test('C-08 order: steps 8..11 run in the fixed order inside one file', () => {
  const roles = [
    makeRole({
      id: 'messy',
      file: 'roles/messy.yaml',
      side_effect: 'read',
      tools: ['curl', 'write'],
      wake_allow: ['messy', 'ghost'],
      derived_from: 'nowhere',
      inputs: ['brief']
    })
  ];
  const workflows = [
    makeWorkflow({
      nodes: [{ id: 'N1', node_type: 'role', role: 'messy' }],
      edges: []
    })
  ];
  const issues = checkRoleContracts({ roles, workflows });
  assert.deepEqual(
    issues.map((issue) => issue.code),
    [
      'ROLE_TOOL_UNKNOWN',
      'ROLE_PERMISSION_MISMATCH',
      'ROLE_WAKE_SELF',
      'ROLE_WAKE_UNKNOWN',
      'ROLE_DERIVE_MISSING',
      'ROLE_CONTRACT_UNBOUND'
    ]
  );
});

test('C-08 order: issues are grouped by file in dictionary order', () => {
  const roles = [
    makeRole({ id: 'zeta', file: 'roles/zeta.yaml', wake_allow: ['ghost'] }),
    makeRole({ id: 'beta', file: 'roles/beta.yaml', wake_allow: ['ghost'] })
  ];
  const issues = checkRoleContracts({ roles });
  assert.deepEqual(issues.map((issue) => issue.file), ['roles/beta.yaml', 'roles/zeta.yaml']);
});

test('AC-53 shape: one file can carry two different codes in check order', () => {
  const roles = [
    makeRole({
      id: 'pmix',
      file: 'roles/pmix.yaml',
      side_effect: 'read',
      tools: ['write'],
      wake_allow: ['ghost']
    })
  ];
  const issues = checkRoleContracts({ roles });
  assert.equal(issues.length, 2);
  assert.deepEqual(
    issues.map((issue) => issue.code),
    ['ROLE_PERMISSION_MISMATCH', 'ROLE_WAKE_UNKNOWN']
  );
});

test('AC-11 scope: the contract layer contributes exactly its three files', () => {
  // 16 clean roles plus the three shape-valid bad ones from AC-11 (m and s are
  // dropped by the loader before this layer and their codes are not ours).
  const clean = [];
  for (let i = 0; i < 16; i += 1) {
    clean.push(makeRole({ id: `clean-${i}`, file: `roles/clean-${i}.yaml` }));
  }
  const bad = [
    makeRole({ id: 'rc', file: 'roles/rc.yaml', inputs: ['brief'] }),
    makeRole({
      id: 'rp',
      file: 'roles/rp.yaml',
      side_effect: 'read',
      tools: ['write'],
      wake_allow: ['ghost']
    }),
    makeRole({ id: 'rd', file: 'roles/rd.yaml', derived_from: 'rd' })
  ];
  const workflows = [
    makeWorkflow({
      id: 'use-c',
      nodes: [
        { id: 'T-001', node_type: 'role', role: 'rc' },
        { id: 'T-002', node_type: 'role', role: 'clean-0' }
      ],
      edges: [{ from: 'T-001', to: 'T-002', map: null }]
    })
  ];
  const issues = checkRoleContracts({ roles: [...clean, ...bad], workflows });
  assert.deepEqual(
    issues.map((issue) => issue.code).sort(),
    ['ROLE_CONTRACT_UNBOUND', 'ROLE_DERIVE_CYCLE', 'ROLE_PERMISSION_MISMATCH', 'ROLE_WAKE_UNKNOWN']
  );
  for (const issue of issues) {
    assert.deepEqual(Object.keys(issue), ISSUE_KEYS);
    assert.equal(issue.scope, 'role');
    assert.equal(issue.line, null);
  }
});

test('input tolerance: missing arguments and odd shapes never throw', () => {
  assert.deepEqual(checkRoleContracts(), []);
  assert.deepEqual(checkRoleContracts({}), []);
  assert.deepEqual(checkRoleContracts({ roles: [] }), []);
  assert.deepEqual(checkRoleContracts({ roles: [null, 42, 'x'] }), []);
});

test('workflows tolerance: Map and plain-object collections both work', () => {
  const roles = [makeRole({ id: 'maprole', inputs: ['brief'] })];
  const workflow = makeWorkflow({
    nodes: [{ id: 'N1', node_type: 'role', role: 'maprole' }],
    edges: []
  });
  const fromMap = checkRoleContracts({ roles, workflows: new Map([['flow-a', workflow]]) });
  const fromObject = checkRoleContracts({ roles, workflows: { 'flow-a': workflow } });
  assert.equal(fromMap.length, 1);
  assert.deepEqual(fromMap, fromObject);
  assert.equal(fromMap[0].params.field, 'brief');
});

test('fully valid referenced roles produce no issues at all', () => {
  const roles = [
    makeRole({
      id: 'okup',
      file: 'roles/okup.yaml',
      side_effect: 'write',
      tools: ['read', 'edit'],
      inputs: ['brief'],
      outputs: ['notes']
    }),
    makeRole({
      id: 'okdown',
      file: 'roles/okdown.yaml',
      side_effect: 'read',
      tools: ['read'],
      inputs: ['notes'],
      outputs: ['digest']
    })
  ];
  const workflows = [
    makeWorkflow({
      nodes: [
        { id: 'E0', node_type: 'role', role: 'other' },
        { id: 'N1', node_type: 'role', role: 'okup', outputs: ['notes'] },
        { id: 'N2', node_type: 'role', role: 'okdown', inputs: ['notes'] },
        { id: 'N3', node_type: 'role', role: 'other', inputs: ['digest'] }
      ],
      edges: [
        { from: 'E0', to: 'N1', map: { from: 'E0.raw', to: 'brief' } },
        { from: 'N1', to: 'N2', map: { from: 'N1.notes', to: 'notes' } },
        { from: 'N2', to: 'N3', map: { from: 'N2.digest', to: 'digest' } }
      ]
    })
  ];
  assert.deepEqual(checkRoleContracts({ roles, workflows }), []);
});
