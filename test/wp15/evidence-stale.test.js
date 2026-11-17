/**
 * I1.12 WP-3 / AC-05 + AC-06 contract: evidence freshness gate.
 *
 * Discipline: pure decision plus injectable read-only IO. Fixtures live under
 * os.tmpdir() (%TEMP% on Windows), NODE_ENV=test is injected, no existing file
 * is modified. All assertions use code names / constant names, never localized
 * wording. The escalation counter is a caller-side stand-in: the real commit
 * path is owned by the wiring package, the pure decision stays write-free.
 *
 * Coverage:
 *   - AC-05: matching fingerprint -> pass, no stale rejection, no escalation.
 *   - AC-06: fingerprint mismatch / missing reference -> reject, exactly one
 *     escalation each, decision carries the associated node and no UI field.
 *   - D-4 / conflict 7: the legacy HANDOFF_HASH_MISMATCH path is unchanged and
 *     coexists with the appended EVIDENCE_STALE verdict.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CODES,
  EVIDENCE_STALE,
  validateHandoff,
  validateHandoffEvidence,
  validateEvidenceFreshness
} from '../../src/core/handoff-schema.js';
import { sha256Of } from '../../src/core/doc-artifact.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const HANDOFF_SRC = path.join(REPO, 'src', 'core', 'handoff-schema.js');

const REASON_MISMATCH = 'fingerprint_mismatch';
const REASON_MISSING = 'evidence_missing';
const REASON_NO_HASH = 'hash_unavailable';
const EXPECTED_CODES = [
  'HANDOFF_FIELD_MISSING',
  'HANDOFF_EDGE_INVALID',
  'HANDOFF_EVIDENCE_MISSING',
  'HANDOFF_EVIDENCE_UNREADABLE',
  'HANDOFF_EVIDENCE_EMPTY',
  'HANDOFF_EVIDENCE_ESCAPE',
  'HANDOFF_HASH_MISMATCH',
  'HANDOFF_BACKFLOW_INCOMPLETE'
];

let fixtureRoot;
let workspaceDir;
let taskDir;
let okHash;

test.before(async () => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-ev-stale-'));
  workspaceDir = path.join(fixtureRoot, 'workspace');
  taskDir = path.join(fixtureRoot, 'task');
  await fsp.mkdir(path.join(workspaceDir, 'artifacts'), { recursive: true });
  await fsp.mkdir(taskDir, { recursive: true });
  await fsp.writeFile(path.join(workspaceDir, 'artifacts', 'ok.md'), 'v1-content', 'utf8');
  await fsp.writeFile(path.join(workspaceDir, 'artifacts', 'stale.md'), 'v2-content', 'utf8');
  const fingerprint = await sha256Of(path.join(workspaceDir, 'artifacts', 'ok.md'));
  okHash = fingerprint.sha256;
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function makeHandoff(overrides = {}) {
  return {
    handoffId: 'HO-003',
    instanceId: 'INST-001',
    fromNodeId: 'T-002',
    toNodeId: 'T-003',
    round: 2,
    createdAt: '2026-11-18T00:00:00.000Z',
    edge: { kind: 'forward', from: 'T-002', to: 'T-003' },
    artifactRefs: { input: [], previous: { ref: 'artifacts/ok.md', sha256: okHash } },
    ...overrides
  };
}

function gateOptions() {
  return { workspaceDir, cwd: taskDir, fs: fsp, sha256Of };
}

// Caller-side stand-in for the single escalation a rejection must produce.
function applyFreshnessGate(result, escalations, delivered) {
  if (!result.ok) {
    escalations.push(result.decision);
    return { delivered: false, escalations: escalations.length };
  }
  delivered.push(result.handoffId);
  return { delivered: true, escalations: escalations.length };
}

test('AC-05 #1: matching fingerprint passes with a clean freshness result', async () => {
  const escalations = [];
  const delivered = [];
  const result = await validateEvidenceFreshness(makeHandoff(), gateOptions());
  const effect = applyFreshnessGate(result, escalations, delivered);

  assert.equal(result.ok, true);
  assert.equal(result.stale, false);
  assert.deepEqual(Object.keys(result).sort(), ['ok', 'stale']);
  assert.equal(effect.delivered, true);
  assert.equal(effect.escalations, 0);
});

test('AC-05 #2: matching declaration also passes through the full handoff chain', async () => {
  const handoff = makeHandoff({
    artifactRefs: { input: [], previous: { ref: 'artifacts/ok.md' } },
    declaredSha256: okHash
  });
  const result = await validateHandoff(handoff, { workspaceDir, cwd: taskDir });

  assert.equal(result.ok, true);
  assert.equal(result.code, undefined);
});

test('AC-06 #1: fingerprint mismatch rejects with exactly one escalation', async () => {
  const escalations = [];
  const delivered = [];
  const handoff = makeHandoff({
    artifactRefs: { input: [], previous: { ref: 'artifacts/stale.md', sha256: okHash } }
  });
  const result = await validateEvidenceFreshness(handoff, gateOptions());
  const effect = applyFreshnessGate(result, escalations, delivered);

  assert.equal(result.ok, false);
  assert.equal(result.code, EVIDENCE_STALE);
  assert.equal(result.decision.reason, REASON_MISMATCH);
  assert.equal(result.decision.stale, true);
  assert.equal(result.decision.nodeId, 'T-002', 'decision must locate the source node');
  assert.equal(effect.delivered, false);
  assert.equal(effect.escalations, 1, 'one rejection yields exactly one escalation');
});

test('AC-06 #2: missing reference rejects with exactly one escalation', async () => {
  const escalations = [];
  const delivered = [];
  const handoff = makeHandoff({
    artifactRefs: { input: [], previous: { ref: 'artifacts/absent.md', sha256: okHash } }
  });
  const result = await validateEvidenceFreshness(handoff, gateOptions());
  const effect = applyFreshnessGate(result, escalations, delivered);

  assert.equal(result.ok, false);
  assert.equal(result.code, EVIDENCE_STALE);
  assert.equal(result.decision.reason, REASON_MISSING);
  assert.equal(result.decision.nodeId, 'T-002');
  assert.match(result.detail, /evidence_missing/);
  assert.equal(effect.delivered, false);
  assert.equal(effect.escalations, 1, 'one missing reference yields exactly one escalation');
});

test('D-4 #1: uncomputable fingerprint is classified as hash_unavailable', async () => {
  const failingHash = async () => ({ ok: false, code: 'READ_FAILED' });
  const result = await validateEvidenceFreshness(makeHandoff(), {
    workspaceDir,
    cwd: taskDir,
    fs: fsp,
    sha256Of: failingHash
  });

  assert.equal(result.ok, false);
  assert.equal(result.decision.reason, REASON_NO_HASH);
  assert.equal(result.decision.nodeId, 'T-002');
});

test('D-4 #2: decision structure carries no UI field', async () => {
  const handoff = makeHandoff({
    artifactRefs: { input: [], previous: { ref: 'artifacts/stale.md', sha256: okHash } }
  });
  const result = await validateEvidenceFreshness(handoff, gateOptions());

  assert.deepEqual(Object.keys(result.decision).sort(), [
    'handoffId', 'instanceId', 'nodeId', 'reason', 'stale'
  ]);
  assert.equal(Object.isFrozen(result.decision), true);
  for (const key of Object.keys(result.decision)) {
    assert.equal(/label|text|button|view|message|title/i.test(key), false);
  }
});

test('D-4 #3: the appended step fires at the end of validateHandoff', async () => {
  const handoff = makeHandoff({
    artifactRefs: { input: [], previous: { ref: 'artifacts/ok.md' } },
    declaredSha256: '0'.repeat(64)
  });
  const result = await validateHandoff(handoff, { workspaceDir, cwd: taskDir });

  assert.equal(result.ok, false);
  assert.equal(result.code, EVIDENCE_STALE);
  assert.equal(result.decision.reason, REASON_MISMATCH);
});

test('conflict 7 #1: CODES order and the legacy HANDOFF_HASH_MISMATCH code are unchanged', async () => {
  assert.deepEqual(Object.keys(CODES), EXPECTED_CODES);
  assert.equal(CODES.HANDOFF_HASH_MISMATCH, 'HANDOFF_HASH_MISMATCH');
  assert.equal(Object.values(CODES).includes(EVIDENCE_STALE), false);

  const legacy = makeHandoff({
    artifactRefs: {
      input: [],
      previous: { ref: 'artifacts/ok.md', sha256: '0'.repeat(64) }
    }
  });
  const verdict = await validateHandoffEvidence(legacy, { workspaceDir, cwd: taskDir });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, CODES.HANDOFF_HASH_MISMATCH);
});

test('conflict 7 #2: source shows the legacy branch intact and the new step last', () => {
  const source = fs.readFileSync(HANDOFF_SRC, 'utf8');
  assert.match(source, /HANDOFF_HASH_MISMATCH: 'HANDOFF_HASH_MISMATCH'/);
  assert.match(source, /return failure\(CODES\.HANDOFF_HASH_MISMATCH/);

  const chain = source.slice(source.indexOf('export async function validateHandoff('));
  const freshnessAt = chain.indexOf('const freshness = await validateEvidenceFreshness(handoff, opts)');
  const returnAt = chain.indexOf('return ok();', freshnessAt);
  assert.ok(freshnessAt > -1, 'freshness step must be appended to the chain');
  assert.ok(returnAt > freshnessAt, 'freshness must run before the final ok()');
});
