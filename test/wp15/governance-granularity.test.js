/**
 * I1.12 WP-2 / AC-09 + AC-10 contract: primary-audit event granularity.
 *
 * Discipline: pure predicate only, no audit writes. Event fixtures live under
 * os.tmpdir() (%TEMP%), NODE_ENV=test is injected.
 *
 * Coverage:
 *   - AC-09: node / handoff.* / health / suspend / halt enter the main audit.
 *   - AC-10: connection / role / session do not; aggregates are recomputable
 *     from handoff events and a handoff state is recorded once.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isPrimaryAuditEvent } from '../../src/core/governance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

let fixtureRoot;

const MIXED_EVENTS = [
  { object: 'run', objectId: 'RUN-1', result: 'applied', reason: 'run.started' },
  { object: 'node', objectId: 'T-001', from: 'ready', to: 'running', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-001', from: null, to: 'created', reason: 'handoff.created' },
  { object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', reason: 'handoff.delivered' },
  { object: 'health', objectId: 'H-1', reason: 'health.changed' },
  { object: 'instance', objectId: 'INST-1', reason: 'core.suspend' },
  { object: 'run', objectId: 'RUN-1', reason: 'run.halted' },
  { object: 'connection', objectId: 'C-1', reason: 'aggregate.changed' },
  { object: 'role_instance', objectId: 'R-1', reason: 'state.change' },
  { object: 'session', objectId: 'S-1', reason: 'state' },
  { object: 'node', objectId: 'T-002', reason: 'dispatch' }
];

test.before(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-granularity-'));
  fs.writeFileSync(
    path.join(fixtureRoot, 'events.jsonl'),
    MIXED_EVENTS.map((event) => JSON.stringify(event)).join('\n') + '\n',
    'utf8'
  );
});

test.after(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

function loadEvents() {
  return fs
    .readFileSync(path.join(fixtureRoot, 'events.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

// Caller-side derived view: connection aggregate rebuilt from handoff events.
function recomputeConnectionAggregate(events) {
  const byHandoff = new Map();
  for (const event of events) {
    if (!isPrimaryAuditEvent(event)) continue;
    if (event.object !== 'handoff') continue;
    const row = byHandoff.get(event.objectId) ?? { handoffId: event.objectId, states: [] };
    row.states.push(event.to);
    byHandoff.set(event.objectId, row);
  }
  return [...byHandoff.values()].map((row) => ({
    handoffId: row.handoffId,
    state: row.states[row.states.length - 1],
    transitions: row.states.length
  }));
}

test('AC-09 #1: node state changes enter the main audit', () => {
  assert.equal(isPrimaryAuditEvent({ object: 'node', reason: 'state.change' }), true);
  assert.equal(isPrimaryAuditEvent({ type: 'node.state.change' }), true);
  assert.equal(isPrimaryAuditEvent('node.state.change'), true);
});

test('AC-09 #2: every handoff state change enters the main audit', () => {
  for (const state of ['created', 'delivered', 'accepted', 'consumed', 'rejected', 'expired']) {
    assert.equal(
      isPrimaryAuditEvent({ object: 'handoff', reason: `handoff.${state}` }),
      true,
      `handoff.${state} must be primary`
    );
  }
  assert.equal(isPrimaryAuditEvent({ type: 'handoff.delivered' }), true);
});

test('AC-09 #3: health / suspend / halt enter the main audit', () => {
  assert.equal(isPrimaryAuditEvent({ object: 'health', reason: 'health.changed' }), true);
  assert.equal(isPrimaryAuditEvent({ type: 'health.changed' }), true);
  assert.equal(isPrimaryAuditEvent({ object: 'instance', reason: 'core.suspend' }), true);
  assert.equal(isPrimaryAuditEvent({ type: 'run.halted' }), true);
});

test('AC-10 #1: connection / role / session events are not primary', () => {
  assert.equal(isPrimaryAuditEvent({ object: 'connection', reason: 'aggregate.changed' }), false);
  assert.equal(isPrimaryAuditEvent({ type: 'connection.aggregate' }), false);
  assert.equal(isPrimaryAuditEvent({ object: 'role_instance', reason: 'state.change' }), false);
  assert.equal(isPrimaryAuditEvent({ type: 'role.state.change' }), false);
  assert.equal(isPrimaryAuditEvent({ object: 'session', reason: 'state' }), false);
  assert.equal(isPrimaryAuditEvent({ type: 'session.state' }), false);
});

test('AC-10 #2: unrelated or malformed events are not primary', () => {
  for (const event of [null, undefined, {}, '', 42, { reason: 'node.dispatch' }]) {
    assert.equal(isPrimaryAuditEvent(event), false);
  }
});

test('AC-09/10 #3: main audit contains only the whitelisted event types', () => {
  const primary = loadEvents().filter(isPrimaryAuditEvent);
  const types = primary.map((event) =>
    event.type ?? (event.object === 'node' ? `${event.object}.${event.reason}` : event.reason)
  );

  assert.deepEqual(types, [
    'node.state.change',
    'handoff.created',
    'handoff.delivered',
    'health.changed',
    'core.suspend',
    'run.halted'
  ]);
  assert.equal(types.some((type) => type.startsWith('connection')), false);
  assert.equal(types.some((type) => type.startsWith('role')), false);
  assert.equal(types.some((type) => type.startsWith('session')), false);
});

test('AC-10 #4: connection aggregate is recomputable from handoff events', () => {
  const events = loadEvents();
  const aggregate = recomputeConnectionAggregate(events);

  assert.deepEqual(aggregate, [
    { handoffId: 'HO-001', state: 'delivered', transitions: 2 }
  ]);
  // The derived view is not itself a primary audit event.
  assert.equal(isPrimaryAuditEvent({ object: 'connection', reason: 'aggregate.changed' }), false);
});

test('AC-10 #5: one primary record per handoff state transition', () => {
  const handoffEvents = loadEvents().filter(
    (event) => isPrimaryAuditEvent(event) && event.object === 'handoff'
  );
  const keys = handoffEvents.map((event) => `${event.objectId}:${event.to}`);

  assert.equal(keys.length, new Set(keys).size, 'no duplicated handoff state in main audit');
  assert.deepEqual(keys, ['HO-001:created', 'HO-001:delivered']);
});
