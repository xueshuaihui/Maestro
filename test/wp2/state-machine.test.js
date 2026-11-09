import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTANCE_STATES,
  NODE_STATES,
  HANDOFF_STATES,
  ESCALATION_STATES,
  APPROVAL_STATES,
  SESSION_STATES,
  TERMINAL_INSTANCE,
  CORE_IMMUTABLE_INSTANCE,
  RUN_DONE_INSTANCE,
  CANCELABLE_NODE,
  CANCELABLE_HANDOFF,
  IllegalTransitionError,
  createInstanceSM,
  createNodeSM,
  createHandoffSM,
  createEscalationSM,
  createApprovalSM,
  createSessionSM
} from '../../src/core/state-machine.js';

/** Expected tables, transcribed one row per source state from requirement D-1 / D-2 / D-4 / D-6. */
const INSTANCE_EDGES = [
  ['created', 'running'],
  ['created', 'cancelled'],
  ['running', 'completed'],
  ['running', 'failed'],
  ['running', 'cancelled'],
  ['running', 'interrupted'],
  ['running', 'suspended'],
  ['suspended', 'running'],
  ['suspended', 'completed'],
  ['suspended', 'failed'],
  ['suspended', 'cancelled']
];

/**
 * Requirement D-1 plus the I1.4 D-2 adjudication exits: `escalated` may be reopened
 * for a retry (`running`) or closed by `pass` / `fail`, and still stays cancellable.
 * `running->failed` and `review->failed` are kept; `done` deliberately has no cancel edge.
 */
const NODE_EDGES = [
  ['pending', 'running'],
  ['pending', 'escalated'],
  ['pending', 'cancelled'],
  ['running', 'review'],
  ['running', 'failed'],
  ['running', 'escalated'],
  ['running', 'cancelled'],
  ['review', 'done'],
  ['review', 'failed'],
  ['review', 'escalated'],
  ['review', 'cancelled'],
  ['done', 'running'],
  ['done', 'escalated'],
  ['failed', 'running'],
  ['failed', 'escalated'],
  ['failed', 'cancelled'],
  ['escalated', 'running'],
  ['escalated', 'done'],
  ['escalated', 'failed'],
  ['escalated', 'cancelled']
];

const HANDOFF_EDGES = [
  ['created', 'delivered'],
  ['created', 'rejected'],
  ['delivered', 'accepted'],
  ['delivered', 'rejected'],
  ['delivered', 'pending'],
  ['accepted', 'consumed'],
  ['accepted', 'rejected'],
  ['pending', 'delivered'],
  ['pending', 'expired'],
  ['pending', 'rejected']
];

const ESCALATION_EDGES = [
  ['pending', 'resolved'],
  ['pending', 'voided']
];

/** requirement D-2: approval lifecycle (memory-only rows). */
const APPROVAL_EDGES = [
  ['pending', 'approved'],
  ['pending', 'denied'],
  ['pending', 'withdrawn']
];

/** Requirement D-6: session guard table. `escalated` has no exit except cancel (`idle`). */
const SESSION_EDGES = [
  ['idle', 'thinking'],
  ['idle', 'escalated'],
  ['thinking', 'tool_running'],
  ['thinking', 'waiting_dependency'],
  ['thinking', 'waiting_input'],
  ['thinking', 'idle'],
  ['thinking', 'escalated'],
  ['tool_running', 'thinking'],
  ['tool_running', 'waiting_dependency'],
  ['tool_running', 'waiting_input'],
  ['tool_running', 'idle'],
  ['tool_running', 'escalated'],
  ['waiting_input', 'thinking'],
  ['waiting_input', 'idle'],
  ['waiting_input', 'escalated'],
  ['waiting_dependency', 'idle'],
  ['waiting_dependency', 'escalated'],
  ['escalated', 'idle']
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
    // `cancelled` is the only state with no outbound edge: `done` can be reopened by a
    // backflow wake-up, `failed` by a retest, `escalated` by an adjudication verdict.
    name: 'node',
    states: NODE_STATES,
    edges: NODE_EDGES,
    create: createNodeSM,
    terminal: ['cancelled'],
    definedOnly: []
  },
  {
    name: 'handoff',
    states: HANDOFF_STATES,
    edges: HANDOFF_EDGES,
    create: createHandoffSM,
    terminal: ['consumed', 'rejected', 'expired'],
    definedOnly: []
  },
  {
    name: 'escalation',
    states: ESCALATION_STATES,
    edges: ESCALATION_EDGES,
    create: createEscalationSM,
    terminal: ['voided'],
    definedOnly: []
  },
  {
    name: 'approval',
    states: APPROVAL_STATES,
    edges: APPROVAL_EDGES,
    create: createApprovalSM,
    terminal: ['approved', 'denied', 'withdrawn'],
    definedOnly: []
  },
  {
    name: 'session',
    states: SESSION_STATES,
    edges: SESSION_EDGES,
    create: createSessionSM,
    terminal: [],
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
          assert.equal(res.code, 'ILLEGAL_TRANSITION', `unexpected repeat code ${res.code}`);
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

  test(`${c.name}: definedOnly() is empty`, () => {
    const sm = c.create({ emit: () => {} });
    assert.deepEqual(sm.definedOnly(), c.definedOnly);
  });

  test(`${c.name}: assert / apply / isTerminal share one verdict`, () => {
    const sm = c.create({ emit: () => {} });
    assert.equal(sm.object, c.name);
    assert.deepEqual(sm.states, [...c.states]);
  });
}

test('node: only cancelled is terminal; done / failed / escalated still have exits', () => {
  const sm = createNodeSM({ emit: () => {} });
  assert.equal(sm.isTerminal('cancelled'), true);
  assert.equal(sm.isTerminal('done'), false);
  assert.equal(sm.isTerminal('failed'), false);
  assert.equal(sm.isTerminal('escalated'), false);
  assert.equal(sm.isTerminal('nope'), false);
});

test('node: cancel is still the only terminal edge; adjudication exits exist (D-2)', async () => {
  const sm = createNodeSM({ emit: () => {} });

  assert.deepEqual(sm.can('escalated', 'cancelled'), { ok: true });
  const res = await sm.apply('escalated', 'cancelled', { objectId: 'T-002' });
  assert.deepEqual(res, { ok: true, from: 'escalated', to: 'cancelled' });

  // 人工裁决出边（retry / pass / fail）与取消并列，取消仍是唯一的终止边。
  for (const to of ['running', 'done', 'failed']) {
    assert.deepEqual(sm.can('escalated', to), { ok: true }, `escalated->${to}`);
  }
  const denied = sm.can('escalated', 'review');
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'ILLEGAL_TRANSITION');
  // No state is defined-only any more.
  assert.notEqual(sm.can('escalated', 'running').code, 'DEFINED_ONLY');
});

test('node: done is reopened by backflow, failed by retest, and done is never cancelled', () => {
  const sm = createNodeSM({ emit: () => {} });
  assert.equal(sm.can('done', 'running').ok, true);
  assert.equal(sm.can('done', 'escalated').ok, true);
  assert.equal(sm.can('done', 'cancelled').ok, false);
  assert.equal(sm.can('failed', 'running').ok, true);
  assert.equal(sm.can('failed', 'escalated').ok, true);
  assert.equal(sm.can('failed', 'cancelled').ok, true);
  assert.equal(sm.can('review', 'cancelled').ok, true);
  assert.equal(sm.can('running', 'failed').ok, true);
  assert.equal(sm.can('review', 'failed').ok, true);
});

test('escalation: pending->voided only', async () => {
  const sm = createEscalationSM({ emit: () => {} });
  assert.equal(sm.isTerminal('pending'), false);
  assert.equal(sm.isTerminal('voided'), true);

  const ok = await sm.apply('pending', 'voided', { objectId: 'ESC-001' });
  assert.deepEqual(ok, { ok: true, from: 'pending', to: 'voided' });

  const back = sm.can('voided', 'pending');
  assert.equal(back.ok, false);
  assert.equal(back.code, 'ILLEGAL_TRANSITION');
  assert.equal(sm.can('voided', 'voided').code, 'ILLEGAL_TRANSITION');
});

test('escalation: resolved is terminal and only reachable from pending (D-2)', () => {
  const sm = createEscalationSM({ emit: () => {} });

  assert.deepEqual(sm.can('pending', 'resolved'), { ok: true });
  assert.equal(sm.isTerminal('resolved'), true);
  assert.equal(sm.can('resolved', 'pending').ok, false);
  assert.equal(sm.can('voided', 'resolved').ok, false);
});

test('session: escalated only leaves on cancel (idle)', () => {
  const sm = createSessionSM({ emit: () => {} });

  const thinking = sm.can('escalated', 'thinking');
  assert.equal(thinking.ok, false);
  assert.equal(thinking.code, 'ILLEGAL_TRANSITION');

  assert.equal(sm.can('escalated', 'idle').ok, true);
  assert.equal(sm.can('escalated', 'waiting_dependency').ok, false);
  assert.equal(sm.can('escalated', 'tool_running').ok, false);
});

test('session: every state can be escalated, and idle only starts a turn', () => {
  const sm = createSessionSM({ emit: () => {} });
  for (const state of ['idle', 'thinking', 'tool_running', 'waiting_input', 'waiting_dependency']) {
    assert.equal(sm.can(state, 'escalated').ok, true, `${state}->escalated`);
  }
  assert.equal(sm.can('idle', 'thinking').ok, true);
  assert.equal(sm.can('idle', 'tool_running').ok, false);
  assert.equal(sm.can('idle', 'waiting_dependency').ok, false);
  assert.equal(sm.can('thinking', 'tool_running').ok, true);
  assert.equal(sm.can('tool_running', 'thinking').ok, true);
});

test('instance: suspended is reachable from running and leaves via adjudication or cancel', () => {
  const sm = createInstanceSM({ emit: () => {} });
  assert.equal(sm.can('running', 'suspended').ok, true);
  assert.equal(sm.can('suspended', 'cancelled').ok, true);
  assert.equal(sm.can('suspended', 'running').ok, true);
  assert.equal(sm.can('suspended', 'completed').ok, true);
  assert.equal(sm.can('suspended', 'failed').ok, true);
  assert.equal(sm.isTerminal('suspended'), false);
});

test('five constant groups match requirement D-4', () => {
  // suspended must NOT be terminal: cancel is its only exit.
  assert.deepEqual([...TERMINAL_INSTANCE], ['completed', 'failed', 'cancelled', 'interrupted']);
  assert.equal(TERMINAL_INSTANCE.includes('suspended'), false);

  assert.deepEqual([...CORE_IMMUTABLE_INSTANCE], [
    'completed',
    'failed',
    'cancelled',
    'interrupted',
    'suspended'
  ]);
  assert.deepEqual([...RUN_DONE_INSTANCE], [
    'completed',
    'failed',
    'cancelled',
    'interrupted',
    'suspended'
  ]);

  assert.deepEqual([...CANCELABLE_NODE], ['pending', 'running', 'review', 'failed', 'escalated']);
  assert.equal(CANCELABLE_NODE.includes('failed'), true);
  assert.equal(CANCELABLE_NODE.includes('escalated'), true);
  assert.equal(CANCELABLE_NODE.includes('done'), false);
  assert.equal(CANCELABLE_NODE.includes('cancelled'), false);

  assert.deepEqual([...CANCELABLE_HANDOFF], ['created', 'delivered', 'pending', 'accepted']);
  assert.equal(CANCELABLE_HANDOFF.includes('consumed'), false);
});

test('explicit out-of-table samples from the acceptance list', async () => {
  const node = createNodeSM({ emit: () => {} });
  const instance = createInstanceSM({ emit: () => {} });
  const handoff = createHandoffSM({ emit: () => {} });

  assert.equal(node.can('done', 'review').ok, false);
  assert.equal(node.can('escalated', 'running').ok, true);
  assert.equal(node.can('escalated', 'done').ok, true);
  assert.equal(node.can('escalated', 'failed').ok, true);
  assert.equal(node.can('escalated', 'review').ok, false);
  for (const to of NODE_STATES) {
    assert.equal(node.can('cancelled', to).ok, false, `cancelled->${to}`);
  }

  assert.equal(instance.can('completed', 'running').ok, false);
  // escalated does not participate in instances at all.
  assert.equal(instance.can('running', 'escalated').code, 'UNKNOWN_STATE');
  assert.equal(instance.can('escalated', 'cancelled').code, 'UNKNOWN_STATE');

  assert.equal(handoff.can('created', 'accepted').ok, false);
  assert.equal(handoff.can('rejected', 'delivered').ok, false);
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

  const res = await sm.apply('escalated', 'review', {
    objectId: 'T-002',
    reason: 'fixture.attempt_transition',
    detail: { source: 'fixture/attempt-transition' }
  });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'ILLEGAL_TRANSITION');
  assert.equal(events.length, 1);

  const ev = events[0];
  assert.equal(ev.object, 'node');
  assert.equal(ev.objectId, 'T-002');
  assert.equal(ev.from, 'escalated');
  assert.equal(ev.to, 'review');
  assert.equal(ev.result, 'rejected');
  assert.equal(ev.reason, 'illegal_transition');
  assert.equal(ev.detail.source, 'fixture/attempt-transition');
  assert.match(ev.detail.message, /escalated/);
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

  assert.throws(() => createNodeSM({ emit: () => {} }).assert('escalated', 'review'), /not in the transition table/);
  assert.doesNotThrow(() => sm.assert('created', 'delivered'));
  assert.doesNotThrow(() => createNodeSM({ emit: () => {} }).assert('escalated', 'cancelled'));
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
