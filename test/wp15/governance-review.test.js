/**
 * I1.12 WP-2 / AC-07 + AC-08 contract: high-risk human review gate.
 *
 * Discipline: pure decisions only. Workflow fixtures live under os.tmpdir()
 * (%TEMP%), NODE_ENV=test is injected, no state transition and no UI field.
 *
 * Coverage:
 *   - AC-07: missing human gate -> validation fails + node location; after the
 *     human/escalate gate is added -> validation passes.
 *   - AC-08: without a human decision downstream does not advance; the decision
 *     is recorded as a data-only, frozen evidence copy.
 *   - D-5: high-risk = declared marker UNION side effect 'high'.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateHighRiskReview, reviewDecision } from '../../src/core/governance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const GOVERNANCE_SRC = path.join(REPO, 'src', 'core', 'governance.js');

let fixtureRoot;

const ROLES = [
  { id: 'role-release', side_effect: 'high' },
  { id: 'role-normal', side_effect: 'low' }
];

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-risk-'));
  const fixtures = {
    missing: {
      nodes: [
        { id: 'T-001', type: 'publish', side_effect: 'high', role: 'role-normal' },
        { id: 'T-002', type: 'code', side_effect: 'low' }
      ],
      edges: [{ from: 'T-001', to: 'T-002' }]
    },
    filled: {
      nodes: [
        { id: 'T-001', type: 'publish', side_effect: 'high', role: 'role-normal' },
        { id: 'T-002', type: 'human', side_effect: 'low' },
        { id: 'T-003', type: 'code', side_effect: 'low' }
      ],
      edges: [
        { from: 'T-001', to: 'T-002' },
        { from: 'T-002', to: 'T-003' }
      ]
    },
    flagged: {
      nodes: [
        { id: 'T-010', type: 'data-migrate', highRisk: true },
        { id: 'T-011', type: 'code' }
      ],
      edges: [{ from: 'T-010', to: 'T-011', escalate: true }]
    },
    multiple: {
      nodes: [
        { id: 'T-020', risk: 'release' },
        { id: 'T-021', risk: 'compliance' },
        { id: 'T-022', type: 'human' }
      ],
      edges: [
        { from: 'T-020', to: 'T-022' },
        { from: 'T-021', to: 'T-022' }
      ]
    },
    partial: {
      nodes: [
        { id: 'T-030', risk: 'release' },
        { id: 'T-031', risk: 'compliance' },
        { id: 'T-032', type: 'human' }
      ],
      edges: [{ from: 'T-030', to: 'T-032' }]
    },
    insufficient: {
      nodes: [{ id: 'T-040', side_effect: 'high' }]
    },
    none: {
      nodes: [
        { id: 'T-050', type: 'code', side_effect: 'low' },
        { id: 'T-051', type: 'review-node', side_effect: 'low' }
      ],
      edges: [{ from: 'T-050', to: 'T-051' }]
    },
    roleHigh: {
      nodes: [
        { id: 'T-060', type: 'execute', role: 'role-release' },
        { id: 'T-061', type: 'human' }
      ],
      edges: [{ from: 'T-060', to: 'T-061' }]
    }
  };
  for (const [name, workflow] of Object.entries(fixtures)) {
    fs.writeFileSync(path.join(fixtureRoot, `${name}.json`), JSON.stringify(workflow, null, 2), 'utf8');
  }
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function loadWorkflow(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), 'utf8'));
}

// Caller-side simulation of the downstream gate (WP-7 owns the real wiring).
function advanceDownstream(decision, executed) {
  if (decision.blocked) return { advanced: false };
  executed.add(decision.nodeId ?? 'downstream');
  return { advanced: true };
}

test('AC-07 #1: high-risk node without human gate fails with node location', () => {
  const result = validateHighRiskReview({ workflow: loadWorkflow('missing'), roles: ROLES });

  assert.equal(result.ok, false);
  assert.equal(result.needsHumanReview, true);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'missing_human_gate');
  assert.deepEqual(result.nodeIds, ['T-001']);
});

test('AC-07 #2: adding a human node downstream makes validation pass', () => {
  const result = validateHighRiskReview({ workflow: loadWorkflow('filled'), roles: ROLES });

  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.equal(result.reason, null);
  assert.equal(result.needsHumanReview, true, 'high-risk node still needs a human decision at runtime');
  assert.deepEqual(result.nodeIds, ['T-001']);
});

test('AC-07 #3: escalate path also satisfies the gate (D-5)', () => {
  const result = validateHighRiskReview({ workflow: loadWorkflow('flagged'), roles: ROLES });

  assert.equal(result.ok, true);
  assert.equal(result.blocked, false);
  assert.deepEqual(result.nodeIds, ['T-010']);
});

test('AC-07 #4: every high-risk node is checked; only the uncovered one is located', () => {
  const allCovered = validateHighRiskReview({ workflow: loadWorkflow('multiple'), roles: ROLES });
  const oneMissing = validateHighRiskReview({ workflow: loadWorkflow('partial'), roles: ROLES });

  assert.equal(allCovered.ok, true);
  assert.deepEqual(allCovered.nodeIds, ['T-020', 'T-021']);
  assert.equal(oneMissing.ok, false);
  assert.equal(oneMissing.reason, 'missing_human_gate');
  assert.deepEqual(oneMissing.nodeIds, ['T-031']);
});

test('D-5 #1: high-risk recognition is marker UNION side effect high', () => {
  const byEffect = validateHighRiskReview({ workflow: loadWorkflow('missing'), roles: ROLES });
  const byMarker = validateHighRiskReview({ workflow: loadWorkflow('flagged'), roles: ROLES });
  const byRole = validateHighRiskReview({ workflow: loadWorkflow('roleHigh'), roles: ROLES });

  assert.deepEqual(byEffect.nodeIds, ['T-001']);
  assert.deepEqual(byMarker.nodeIds, ['T-010']);
  assert.deepEqual(byRole.nodeIds, ['T-060'], 'role side_effect high is recognized');
  assert.equal(byRole.ok, true);
});

test('D-5 #2: no high-risk node -> clean pass with empty location', () => {
  const result = validateHighRiskReview({ workflow: loadWorkflow('none'), roles: ROLES });

  assert.equal(result.ok, true);
  assert.equal(result.needsHumanReview, false);
  assert.equal(result.blocked, false);
  assert.equal(result.reason, null);
  assert.deepEqual(result.nodeIds, []);
});

test('AC-07 #5: insufficient graph data blocks with node location', () => {
  const result = validateHighRiskReview({ workflow: loadWorkflow('insufficient'), roles: ROLES });

  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'insufficient_data');
  assert.deepEqual(result.nodeIds, ['T-040']);
});

test('AC-08 #1: without a human decision, downstream is not advanced', () => {
  const executed = new Set();
  const decision = reviewDecision({
    instanceId: 'INST-001',
    nodeId: 'T-001',
    needsHumanReview: true,
    blocked: true,
    reason: 'awaiting_human'
  });
  const result = advanceDownstream(decision, executed);

  assert.equal(result.advanced, false);
  assert.equal(executed.size, 0);
  assert.equal(decision.blocked, true);
});

test('AC-08 #2: recorded decision is a complete, frozen, data-only evidence copy', () => {
  const decision = reviewDecision({
    instanceId: 'INST-001',
    nodeId: 'T-001',
    needsHumanReview: true,
    blocked: false,
    reason: 'human_approved'
  });
  const recorded = [];
  recorded.push(decision);

  assert.deepEqual(Object.keys(decision).sort(), [
    'blocked', 'instanceId', 'needsHumanReview', 'nodeId', 'reason'
  ]);
  assert.deepEqual(decision, {
    instanceId: 'INST-001',
    nodeId: 'T-001',
    needsHumanReview: true,
    blocked: false,
    reason: 'human_approved'
  });
  assert.equal(Object.isFrozen(decision), true, 'recorded evidence must be immutable');
  assert.equal(recorded[0].instanceId, 'INST-001');
  assert.equal(recorded[0].nodeId, 'T-001');
  assert.equal(recorded[0].reason, 'human_approved');
});

test('AC-08 #3: after the human decision downstream advances', () => {
  const executed = new Set();
  const decision = reviewDecision({
    instanceId: 'INST-001',
    nodeId: 'T-001',
    needsHumanReview: true,
    blocked: false,
    reason: 'human_approved'
  });
  const result = advanceDownstream(decision, executed);

  assert.equal(result.advanced, true);
  assert.deepEqual([...executed], ['T-001']);
});

test('AC-08 #4: decision adds no state enum and no UI field', () => {
  const decision = reviewDecision({
    instanceId: 'INST-001',
    nodeId: 'T-001',
    needsHumanReview: true,
    blocked: true,
    reason: 'awaiting_human'
  });

  assert.equal(Object.hasOwn(decision, 'state'), false);
  assert.equal(Object.hasOwn(decision, 'label'), false);
  assert.equal(Object.hasOwn(decision, 'button'), false);
  const source = fs.readFileSync(GOVERNANCE_SRC, 'utf8');
  assert.equal(/[\u4e00-\u9fff]/.test(source), false, 'governance module has no localized text');
});
