import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTANCE_STATES,
  NODE_STATES,
  HANDOFF_STATES,
  IllegalTransitionError,
  createInstanceSM,
  createNodeSM,
  createHandoffSM
} from '../../src/core/state-machine.js';

/** Expected tables, transcribed one row per source state from requirement 2.2 / 2.4 / 2.5. */
const INSTANCE_EDGES = [
  ['created', 'running'],
  ['created', 'cancelled'],
  ['running', 'completed'],
  ['running', 'failed'],
  ['running', 'cancelled'],
  ['running', 'interrupted']
];

const NODE_EDGES = [
  ['pending', 'running'],
  ['pending', 'cancelled'],
  ['running', 'review'],
  ['running', 'failed'],
  ['running', 'cancelled'],
  ['review', 'done'],
  ['review', 'failed']
];

const HANDOFF_EDGES = [
  ['created', 'delivered'],
  ['delivered', 'accepted'],
  ['delivered', 'rejected'],
  ['accepted', 'consumed'],
  ['accepted', 'rejected'],
  ['pending', 'delivered'],
  ['pending', 'expired']
];

const CASES = [
  {
    name: 'instance',
    states: INSTANCE_STATES,
    edges: INSTANCE_EDGES,
    create: createInstanceSM,
    terminal: ['completed', 'failed', 'cancelled', 'interrupted'],
    definedOnly: []
  },
  {
    name: 'node',
    states: NODE_STATES,
    edges: NODE_EDGES,
    create: createNodeSM,
    terminal: ['done', 'failed', 'cancelled'],
    definedOnly: ['escalated']
  },
  {
    name: 'handoff',
    states: HANDOFF_STATES,
    edges: HANDOFF_EDGES,
    create: createHandoffSM,
    terminal: ['consumed', 'rejected', 'expired'],
    definedOnly: []
  }
];

const edgeKey = (from, to) => `${from}->${to}`;

for (const c of CASES) {
  const allowed = new Set(c.edges.map(([from, to]) => edgeKey(from, to)));

  test(`${c.name}: every in-table edge is allowed and applies`, async () => {
    for (const [from, to] of c.edges) {
      const events = [];
      const sm = c.create({ emit: (ev) => events.push(ev) });

      assert.equal(sm.can(from, to).ok, true, `${c.name} ${from}->${to} should be allowed`);

      const res = await sm.apply(from, to, {
        objectId: 'OBJ-1',
        reason: 'test.edge',
        detail: { n: 1 }
      });
      assert.deepEqual(res, { ok: true, from, to });
      assert.equal(events.length, 1);
      assert.deepEqual(events[0], {
        object: c.name,
        objectId: 'OBJ-1',
        from,
        to,
        result: 'applied',
        reason: 'test.edge',
        detail: { n: 1 }
      });
    }
  });

  test(`${c.name}: every out-of-table pair is rejected by can() and apply()`, async () => {
    for (const from of c.states) {
      for (const to of c.states) {
        if (allowed.has(edgeKey(from, to))) continue;

        const events = [];
        const sm = c.create({ emit: (ev) => events.push(ev) });

        const verdict = sm.can(from, to);
        assert.equal(verdict.ok, false, `${c.name} ${from}->${to} must be rejected`);
        assert.ok(
          verdict.code === 'ILLEGAL_TRANSITION' ||
            verdict.code === 'DEFINED_ONLY' ||
            verdict.code === 'UNKNOWN_STATE',
          `unexpected code ${verdict.code}`
        );

        const res = await sm.apply(from, to, { objectId: 'OBJ-1' });
        assert.equal(res.ok, false);
        assert.equal(res.from, from);
        assert.equal(res.to, to);
        assert.equal(typeof res.message, 'string');

        if (from === to) {
          // No event for a repeat set; the code stays whatever the table says,
          // except that a defined-only source reports DEFINED_ONLY first.
          assert.ok(
            res.code === 'ILLEGAL_TRANSITION' || res.code === 'DEFINED_ONLY',
            `unexpected repeat code ${res.code}`
          );
          assert.equal(events.length, 0, 'repeat set must not emit');
        } else {
          assert.equal(events.length, 1);
          assert.equal(events[0].result, 'rejected');
          assert.equal(events[0].reason, 'illegal_transition');
          assert.equal(events[0].to, to);
        }
      }
    }
  });

  test(`${c.name}: terminal states accept nothing`, () => {
    const sm = c.create({ emit: () => {} });
    for (const state of c.terminal) {
      assert.equal(sm.isTerminal(state), true, `${state} should be terminal`);
      for (const next of c.states) {
        assert.equal(sm.can(state, next).ok, false);
      }
    }
  });

  test(`${c.name}: definedOnly() reports ${c.definedOnly.length} state(s)`, () => {
    const sm = c.create({ emit: () => {} });
    assert.deepEqual(sm.definedOnly(), c.definedOnly);
  });
}

test('explicit out-of-table samples from the acceptance list', () => {
  const node = createNodeSM({ emit: () => {} });
  const instance = createInstanceSM({ emit: () => {} });
  const handoff = createHandoffSM({ emit: () => {} });

  assert.equal(node.can('done', 'running').ok, false);
  assert.equal(node.can('done', 'running').code, 'ILLEGAL_TRANSITION');
  assert.equal(instance.can('completed', 'running').ok, false);
  assert.equal(handoff.can('created', 'accepted').ok, false);
  assert.equal(handoff.can('rejected', 'delivered').ok, false);
});

test('escalated accepts no transition at all', async () => {
  const sm = createNodeSM({ emit: () => {} });

  for (const to of NODE_STATES) {
    const verdict = sm.can('escalated', to);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'DEFINED_ONLY', `escalated->${to} should be DEFINED_ONLY`);

    const res = await sm.apply('escalated', to, { objectId: 'T-001' });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'DEFINED_ONLY');
  }

  // Applying with escalated as the target is also rejected (no inbound edge).
  assert.equal(sm.can('done', 'escalated').code, 'ILLEGAL_TRANSITION');
});

test('from === to is ILLEGAL_TRANSITION and emits nothing', async () => {
  const sm = createNodeSM({ emit: () => {} });
  assert.equal(sm.can('running', 'running').code, 'ILLEGAL_TRANSITION');
  assert.equal((await sm.apply('running', 'running')).code, 'ILLEGAL_TRANSITION');

  const events = [];
  const watched = createInstanceSM({ emit: (ev) => events.push(ev) });
  const res = await watched.apply('running', 'running', { objectId: 'INST-001' });
  assert.equal(res.ok, false);
  assert.equal(events.length, 0);
});

test('rejected apply emits one rejected event with the attempted target', async () => {
  const events = [];
  const sm = createNodeSM({ emit: (ev) => events.push(ev) });

  const res = await sm.apply('done', 'running', {
    objectId: 'T-001',
    reason: 'fixture.attempt_transition',
    detail: { source: 'fixture/attempt-transition' }
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'ILLEGAL_TRANSITION');
  assert.equal(events.length, 1);

  const ev = events[0];
  assert.equal(ev.object, 'node');
  assert.equal(ev.objectId, 'T-001');
  assert.equal(ev.from, 'done');
  assert.equal(ev.to, 'running');
  assert.equal(ev.result, 'rejected');
  assert.equal(ev.reason, 'illegal_transition');
  assert.equal(ev.detail.source, 'fixture/attempt-transition');
  assert.match(ev.detail.message, /done/);
});

test('apply awaits an async emit before returning', async () => {
  let settled = false;
  const sm = createInstanceSM({
    emit: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      settled = true;
    }
  });

  await sm.apply('created', 'running', { objectId: 'INST-001' });
  assert.equal(settled, true, 'apply must not resolve before emit settles');
});

test('assert throws IllegalTransitionError carrying from/to/code', () => {
  const sm = createHandoffSM({ emit: () => {} });

  assert.throws(
    () => sm.assert('consumed', 'delivered'),
    (err) => {
      assert.ok(err instanceof IllegalTransitionError);
      assert.ok(err instanceof Error);
      assert.equal(err.from, 'consumed');
      assert.equal(err.to, 'delivered');
      assert.equal(err.code, 'ILLEGAL_TRANSITION');
      return true;
    }
  );

  assert.throws(() => createNodeSM({ emit: () => {} }).assert('escalated', 'done'), /defined-only/);
  assert.doesNotThrow(() => sm.assert('created', 'delivered'));
});

test('can and apply never throw on garbage input', async () => {
  const sm = createInstanceSM({ emit: () => {} });

  for (const [from, to] of [
    [undefined, 'running'],
    ['created', null],
    ['nope', 'running'],
    ['created', 'nope']
  ]) {
    const verdict = sm.can(from, to);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'UNKNOWN_STATE');
    const res = await sm.apply(from, to, {});
    assert.equal(res.ok, false);
    assert.equal(res.code, 'UNKNOWN_STATE');
  }

  await assert.doesNotReject(async () => sm.apply('created', 'cancelled'));
  assert.equal(sm.isTerminal('nope'), false);
});
