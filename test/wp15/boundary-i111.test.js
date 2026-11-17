/**
 * I1.12 WP-2 / AC-23 contract: boundary with I1.11.
 *
 * Discipline: governance only produces consumable decision data (reason +
 * associated node), never UI; the change list must have zero intersection
 * with I1.11 path features. Fixture root is os.tmpdir() (%TEMP%),
 * NODE_ENV=test is injected.
 *
 * Coverage:
 *   - decision structures carry a reason and an associated node/id;
 *   - no UI label keys, buttons or localized text in module or output;
 *   - changed-file list has zero intersection with I1.11 path features
 *     (notification tray / intervention queue / asset library / canvas /
 *     evidence view under desktop/ui/**), asserted by path scanning.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  decideWake,
  validateHighRiskReview,
  reviewDecision,
  isPrimaryAuditEvent
} from '../../src/core/governance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const GOVERNANCE_SRC = path.join(REPO, 'src', 'core', 'governance.js');

const AUTHORIZED_FILES = [
  'src/core/governance.js',
  'test/wp15/governance-wake.test.js',
  'test/wp15/governance-review.test.js',
  'test/wp15/governance-granularity.test.js',
  'test/wp15/boundary-i111.test.js'
];

// I1.11 path features: notification tray, intervention queue, asset library,
// workflow canvas, evidence view, plus the iteration id itself.
const I111_FEATURES = [
  /i1[._-]11/i,
  /notif|notify|tray/i,
  /interven|queue/i,
  /asset[-_]?lib|library/i,
  /canvas/i,
  /evidence[-_]?(view|browser)/i
];

const UI_FIELD_KEYS = new Set([
  'label', 'labelKey', 'button', 'buttons', 'text', 'title', 'icon',
  'view', 'ui', 'toast', 'placeholder', 'tooltip', 'menu'
]);
const UI_SOURCE_TOKENS = /button|btn|labelKey|uiLabel|UI_LABEL|toast|modal|dialog|intervention|notification|evidence-view|placeholder|tooltip/i;

let fixtureRoot;

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-boundary-'));
  fs.writeFileSync(
    path.join(fixtureRoot, 'workflow.json'),
    JSON.stringify({
      nodes: [
        { id: 'T-100', side_effect: 'high' },
        { id: 'T-101', type: 'code' }
      ],
      edges: [{ from: 'T-100', to: 'T-101' }]
    }),
    'utf8'
  );
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function collectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

function changedFiles() {
  const commands = [
    ['diff', '--name-only', 'HEAD'],
    ['diff', '--cached', '--name-only'],
    ['ls-files', '--others', '--exclude-standard']
  ];
  const files = new Set();
  for (const args of commands) {
    const result = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
    for (const line of result.stdout.split('\n')) {
      const normalized = line.trim().replace(/\\/g, '/');
      if (normalized) files.add(normalized);
    }
  }
  return [...files];
}

function desktopUiFeatureFiles() {
  const root = path.join(REPO, 'desktop', 'ui');
  const found = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = path.relative(REPO, full).replace(/\\/g, '/');
        if (I111_FEATURES.some((pattern) => pattern.test(rel))) found.push(rel);
      }
    }
  };
  walk(root);
  return found;
}

test('AC-23 #1: every decision output carries a reason and an associated node/id', () => {
  const wake = decideWake({
    sourceRole: 'role-a',
    targetRole: 'role-c',
    roles: [{ id: 'role-a', wake_allow: ['role-b'] }, { id: 'role-c', wake_allow: [] }],
    now: 1000
  });
  const workflow = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'workflow.json'), 'utf8'));
  const review = validateHighRiskReview({ workflow, roles: [] });
  const decision = reviewDecision({
    instanceId: 'INST-100',
    nodeId: 'T-100',
    needsHumanReview: true,
    blocked: true,
    reason: 'awaiting_human'
  });

  assert.equal(typeof wake.reason, 'string');
  assert.equal(wake.reason.length > 0, true);
  assert.equal(wake.detail.from, 'role-a');
  assert.equal(wake.detail.to, 'role-c');
  assert.equal(wake.detail.reason, wake.reason);

  assert.equal(typeof review.reason, 'string');
  assert.equal(review.reason.length > 0, true);
  assert.deepEqual(review.nodeIds, ['T-100']);

  assert.equal(typeof decision.reason, 'string');
  assert.equal(decision.nodeId, 'T-100');
  assert.equal(decision.instanceId, 'INST-100');
});

test('AC-23 #2: module and decision outputs contain no UI keys or buttons', () => {
  const source = fs.readFileSync(GOVERNANCE_SRC, 'utf8');
  const outputs = [
    decideWake({ sourceRole: 'a', targetRole: 'b', now: 0 }),
    validateHighRiskReview({ workflow: {} }),
    reviewDecision({ instanceId: 'I', nodeId: 'N', needsHumanReview: true, blocked: true, reason: 'r' }),
    isPrimaryAuditEvent({ object: 'node', reason: 'state.change' })
  ];

  assert.equal(/[\u4e00-\u9fff]/.test(source), false, 'no localized text in governance module');
  assert.equal(UI_SOURCE_TOKENS.test(source), false, 'no UI token in governance module');
  for (const output of outputs) {
    for (const key of collectKeys(output)) {
      assert.equal(UI_FIELD_KEYS.has(key), false, `UI field ${key} must not appear in a decision`);
    }
  }
});

test('AC-23 #3: change list has zero intersection with I1.11 path features', () => {
  const changed = changedFiles();
  const offenders = changed.filter((file) => I111_FEATURES.some((pattern) => pattern.test(file)));

  assert.deepEqual(offenders, [], `I1.11 path features leaked into change list: ${offenders.join(', ')}`);
  assert.equal(
    changed.some((file) => file.startsWith('desktop/ui/') || file.startsWith('desktop/harness/')),
    false,
    'no desktop UI/harness file may be touched'
  );
});

test('AC-23 #4: authorized file list has zero intersection with I1.11 feature files', () => {
  const featureFiles = desktopUiFeatureFiles();
  const intersection = AUTHORIZED_FILES.filter((file) =>
    featureFiles.includes(file) || I111_FEATURES.some((pattern) => pattern.test(file))
  );

  assert.deepEqual(intersection, []);
  for (const file of AUTHORIZED_FILES) {
    assert.equal(file.startsWith('desktop/ui/'), false);
    assert.equal(fs.existsSync(path.join(REPO, file)), true, `${file} must exist`);
  }
});

test('AC-23 #5: decision data is consumable (plain data, no functions or DOM)', () => {
  const decision = reviewDecision({
    instanceId: 'INST-100',
    nodeId: 'T-100',
    needsHumanReview: true,
    blocked: false,
    reason: 'human_approved'
  });
  const serialized = JSON.stringify(decision);

  assert.equal(serialized.includes('function'), false);
  assert.equal(serialized.includes('document'), false);
  assert.equal(serialized.includes('window'), false);
  assert.deepEqual(JSON.parse(serialized), decision);
});
