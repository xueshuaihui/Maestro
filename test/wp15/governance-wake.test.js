/**
 * I1.12 WP-2 / AC-03 + AC-04 contract: wake whitelist gate.
 *
 * Discipline: pure decision only. Fixtures live under os.tmpdir() (%TEMP% on
 * Windows), NODE_ENV=test is injected, and no existing file is modified.
 *
 * Coverage:
 *   - AC-03: whitelisted target -> allowed, no rejection event created.
 *   - AC-04: non-whitelisted target -> exactly one 'wake.not-whitelisted'
 *     decision, target session not created, legacy 'wake.rejected' untouched.
 *   - D-3 strict denial: undeclared / unreadable whitelist, missing target role.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decideWake } from '../../src/core/governance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const GOVERNANCE_SRC = path.join(REPO, 'src', 'core', 'governance.js');
const LABELS_SRC = path.join(REPO, 'src', 'cli', 'labels.js');
const NEW_REASON = 'wake.not-whitelisted';

let fixtureRoot;

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-allow-'));
  const roles = [
    { id: 'role-a', wake_allow: ['role-b'], side_effect: 'low' },
    { id: 'role-b', wake_allow: [], side_effect: 'low' },
    { id: 'role-c', wake_allow: [], side_effect: 'low' },
    { id: 'role-no-allow', side_effect: 'low' }
  ];
  fs.writeFileSync(path.join(fixtureRoot, 'roles.json'), JSON.stringify(roles, null, 2), 'utf8');
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function loadRoles() {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'roles.json'), 'utf8'));
}

const CLOCK = () => Date.parse('2026-11-18T00:00:03.000Z');

// A tiny stand-in for the caller-side routing side effects (WP-7 wiring):
// the target session is only created when the pure decision allows it.
function routeWake(decision, sessions) {
  if (!decision.allowed) return { handoffDelivered: false, sessionCreated: false };
  sessions.add(decision.detail.to);
  return { handoffDelivered: true, sessionCreated: true };
}

test('AC-03 #1: whitelisted target is allowed with a clean detail shape', () => {
  const decision = decideWake({
    sourceRole: 'role-a',
    targetRole: 'role-b',
    roles: loadRoles(),
    now: CLOCK
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, null);
  assert.deepEqual(Object.keys(decision).sort(), ['allowed', 'detail', 'reason']);
  assert.deepEqual(decision.detail, {
    from: 'role-a',
    to: 'role-b',
    reason: null,
    at: '2026-11-18T00:00:03.000Z'
  });
});

test('AC-03 #2: allowed wake delivers handoff and creates the target session', () => {
  const sessions = new Set();
  const decision = decideWake({
    sourceRole: 'role-a',
    targetRole: 'role-b',
    roles: loadRoles(),
    now: CLOCK
  });
  const sideEffects = routeWake(decision, sessions);

  assert.equal(sideEffects.handoffDelivered, true);
  assert.equal(sideEffects.sessionCreated, true);
  assert.deepEqual([...sessions], ['role-b']);
  // No rejection is produced on the allow path.
  assert.equal(decision.reason === NEW_REASON, false);
});

test('AC-04 #1: non-whitelisted target yields exactly one wake.not-whitelisted decision', () => {
  const decision = decideWake({
    sourceRole: 'role-a',
    targetRole: 'role-c',
    roles: loadRoles(),
    now: CLOCK
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NEW_REASON);
  assert.equal(decision.detail.reason, NEW_REASON);
  const rejectionDecisions = [decision].filter((item) => item.reason === NEW_REASON);
  assert.equal(rejectionDecisions.length, 1, 'rejection decision must be exactly one');
});

test('AC-04 #2: denied wake does not deliver handoff nor create the target session', () => {
  const sessions = new Set();
  const decision = decideWake({
    sourceRole: 'role-a',
    targetRole: 'role-c',
    roles: loadRoles(),
    now: CLOCK
  });
  const sideEffects = routeWake(decision, sessions);

  assert.equal(sideEffects.handoffDelivered, false);
  assert.equal(sideEffects.sessionCreated, false);
  assert.equal(sessions.has('role-c'), false);
  assert.equal(sessions.size, 0);
});

test('AC-04 #3: rejection detail carries source, target, reason and injected time', () => {
  const decision = decideWake({
    sourceRole: { id: 'role-a', wake_allow: ['role-b'] },
    targetRole: { id: 'role-c' },
    roles: loadRoles(),
    now: '2026-11-18T00:00:03.000Z'
  });

  assert.deepEqual(decision.detail, {
    from: 'role-a',
    to: 'role-c',
    reason: NEW_REASON,
    at: '2026-11-18T00:00:03.000Z'
  });
});

test('D-3 #1: undeclared wake_allow is denied strictly', () => {
  const decision = decideWake({
    sourceRole: 'role-no-allow',
    targetRole: 'role-b',
    roles: loadRoles(),
    now: CLOCK
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NEW_REASON);
});

test('D-3 #2: unreadable source config / no registry is denied strictly', () => {
  const noRegistry = decideWake({ sourceRole: 'role-a', targetRole: 'role-b' });
  const unknownSource = decideWake({
    sourceRole: 'ghost',
    targetRole: 'role-b',
    roles: loadRoles()
  });

  assert.equal(noRegistry.allowed, false);
  assert.equal(noRegistry.reason, NEW_REASON);
  assert.equal(unknownSource.allowed, false);
  assert.equal(unknownSource.reason, NEW_REASON);
});

test('D-3 #3: target role missing from the registry is denied strictly', () => {
  const decision = decideWake({
    sourceRole: 'role-a',
    targetRole: 'ghost',
    roles: loadRoles(),
    now: CLOCK
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, NEW_REASON);
  assert.equal(decision.detail.to, 'ghost');
});

test('AC-04 #4: legacy wake.rejected key stays unchanged and is not emitted here', () => {
  const labels = fs.readFileSync(LABELS_SRC, 'utf8');
  const source = fs.readFileSync(GOVERNANCE_SRC, 'utf8');

  // Existing label key and its literal are untouched by this package.
  assert.match(labels, /'wake\.rejected': '唤醒被拒'/);
  // Vetoed candidate code (decision A-4) never landed.
  assert.equal(labels.includes('wake.denied'), false);
  // The governance module produces only the frozen new code.
  assert.equal(source.includes('wake.rejected'), false);
  assert.equal(source.includes('wake.denied'), false);
  assert.match(source, /wake\.not-whitelisted/);
});

test('AC-04 #5: decision is deterministic for an injected clock (no ambient time)', () => {
  const a = decideWake({ sourceRole: 'role-a', targetRole: 'role-c', roles: loadRoles(), now: CLOCK });
  const b = decideWake({ sourceRole: 'role-a', targetRole: 'role-c', roles: loadRoles(), now: CLOCK });

  assert.deepEqual(a, b);
  assert.equal(a.detail.at, '2026-11-18T00:00:03.000Z');
});
