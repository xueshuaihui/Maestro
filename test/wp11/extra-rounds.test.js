/**
 * D-6.8 / §2.10: WP-4 owns the five READ-side round-cap limits. A human
 * `retry` (WP-6 write side) grants exactly one extra round; every cap must
 * become `maxRounds + extraRounds`, not `maxRounds` alone.
 *
 * These are pure-module tests: they lock the read-side arithmetic without
 * implementing the write side (resolveEscalation retry -> extraRounds + 1).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { planAdvance, shouldWake, checkWakeGate } from '../../src/core/advance.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

const NOW = () => 1_760_000_000_000;

/** Injectable graph: A -> B -> C, C backflows to A; every node capped at 2. */
const graph = {
  id: 'extra-cap',
  entry: 'N-1',
  terminal: 'N-3',
  terminals: ['N-3'],
  maxRounds: { 'N-1': 2, 'N-2': 2, 'N-3': 2 },
  nodes: [
    { id: 'N-1', roleId: 'alpha', order: 1, products: ['out/a.txt'], prompt: 'forward' },
    { id: 'N-2', roleId: 'beta', order: 2, products: [], prompt: 'forward' },
    { id: 'N-3', roleId: 'gamma', order: 3, products: [], prompt: 'forward' },
  ],
  edges: [
    { from: 'N-1', to: 'N-2', kind: 'forward' },
    { from: 'N-2', to: 'N-3', kind: 'forward' },
    { from: 'N-3', to: 'N-1', kind: 'backflow' },
  ],
};

function nodes(overrides = {}) {
  const base = [
    { nodeId: 'N-1', state: 'done', round: 1, endedAt: '2026-01-01T00:00:01.000Z', verdict: null },
    { nodeId: 'N-2', state: 'pending', round: 0, endedAt: null, verdict: null },
    { nodeId: 'N-3', state: 'pending', round: 0, endedAt: null, verdict: null },
  ];
  return base.map((node) => ({ ...node, ...(overrides[node.nodeId] ?? {}) }));
}

function snapshot(overrides = {}, extra = {}) {
  return { instanceId: 'INST-900', task: 'fake task', handoffs: [], nodes: nodes(overrides), ...extra };
}

const FAIL_VERDICT = { result: 'fail', defects: [{ summary: 'still broken', evidence: 'out/log.txt' }] };

/** A node that just finished its 2nd (= maxRounds) round with a failed verdict. */
function failedSecondRound(extraRounds) {
  return snapshot({
    'N-1': { state: 'done', round: 2, endedAt: '2026-01-01T00:00:04.000Z' },
    'N-2': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z' },
    'N-3': {
      state: 'failed',
      round: 2,
      endedAt: '2026-01-01T00:00:05.000Z',
      verdict: { value: 'fail' },
      ...(extraRounds === undefined ? {} : { extraRounds }),
    },
  });
}

// ---- read side #2: verdict-fail backflow cap (advance.js) ------------------

test('verdict-fail：未 retry 时 round=2 立即升级（防"改宽了所有人"）', () => {
  const plan = planAdvance({
    graph,
    snapshot: failedSecondRound(undefined),
    fromNodeId: 'N-3',
    outcome: 'verdict-fail',
    verdict: FAIL_VERDICT,
    now: NOW,
  });
  assert.equal(plan.action, 'escalate');
  assert.equal(plan.reason, 'rounds_exceeded');
  assert.equal(plan.nodeId, 'N-3');
});

test('verdict-fail：retry(extraRounds=1) 后 round=2 仍可回流派发一轮', () => {
  const plan = planAdvance({
    graph,
    snapshot: failedSecondRound(1),
    fromNodeId: 'N-3',
    outcome: 'verdict-fail',
    verdict: FAIL_VERDICT,
    now: NOW,
  });
  assert.equal(plan.action, 'backflow');
  assert.equal(plan.edge.kind, 'backflow');
  assert.equal(plan.nodeId, 'N-1');
});

test('verdict-fail：retry 后直到 round=3 才升级', () => {
  const state = snapshot({
    'N-1': { state: 'done', round: 3, endedAt: '2026-01-01T00:00:06.000Z' },
    'N-2': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z' },
    'N-3': {
      state: 'failed',
      round: 3,
      endedAt: '2026-01-01T00:00:07.000Z',
      verdict: { value: 'fail' },
      extraRounds: 1,
    },
  });
  const plan = planAdvance({
    graph,
    snapshot: state,
    fromNodeId: 'N-3',
    outcome: 'verdict-fail',
    verdict: FAIL_VERDICT,
    now: NOW,
  });
  assert.equal(plan.action, 'escalate');
  assert.equal(plan.reason, 'rounds_exceeded');
});

// ---- read side #3: passed forward cap, TARGET node extraRounds -------------

test('passed 前进：目标节点未 retry 时 round=2 升级；retry 后仍可派发', () => {
  const base = {
    'N-1': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:01.000Z' },
    'N-2': { state: 'pending', round: 2, endedAt: null },
    'N-3': { state: 'pending', round: 0, endedAt: null },
  };
  const opts = { graph, fromNodeId: 'N-1', outcome: 'passed', now: NOW };
  const blocked = planAdvance({ ...opts, snapshot: snapshot(base) });
  assert.equal(blocked.action, 'escalate');
  assert.equal(blocked.reason, 'rounds_exceeded');

  const retried = snapshot({ ...base, 'N-2': { ...base['N-2'], extraRounds: 1 } });
  const allowed = planAdvance({ ...opts, snapshot: retried });
  assert.equal(allowed.action, 'dispatch');
  assert.equal(allowed.nodeId, 'N-2');
});

// ---- read side #1: shouldWake / checkWakeGate ------------------------------

test('shouldWake：extraRounds 放宽唤醒门限，round=2 可唤醒、round=3 仍拒绝', () => {
  const handoff = {
    handoffId: 'HO-009',
    edge: { from: 'N-3', to: 'N-1', kind: 'backflow' },
    state: 'created',
    wakeConsumedAt: null,
  };
  const round2 = { state: 'done', round: 2 };
  assert.equal(shouldWake({ handoff, node: round2, maxRounds: 2 }).detail.code, 'ROUNDS_EXCEEDED');
  assert.deepEqual(shouldWake({ handoff, node: round2, maxRounds: 2, extraRounds: 1 }), {
    ok: true,
    wakeHandoffId: 'HO-009',
  });
  assert.equal(
    shouldWake({ handoff, node: { state: 'done', round: 3 }, maxRounds: 2, extraRounds: 1 }).detail.code,
    'ROUNDS_EXCEEDED',
  );
});

test('checkWakeGate：目标节点持久化的 extraRounds 与显式值都生效', () => {
  const handoff = {
    handoffId: 'HO-001',
    edge: { from: 'N-3', to: 'N-1', kind: 'backflow' },
    state: 'delivered',
    wakeConsumedAt: null,
  };
  const edge = { from: 'N-3', to: 'N-1', kind: 'backflow' };
  const base = { 'N-1': { state: 'done', round: 2, endedAt: '2026-01-01T00:00:04.000Z' } };
  const state0 = snapshot(base, { handoffs: [handoff] });
  assert.equal(checkWakeGate({ graph, state: state0, edge }).detail.code, 'ROUNDS_EXCEEDED');

  const state1 = snapshot(
    { ...base, 'N-1': { ...base['N-1'], extraRounds: 1 } },
    { handoffs: [handoff] },
  );
  assert.equal(checkWakeGate({ graph, state: state1, edge }).ok, true);
  assert.equal(checkWakeGate({ graph, state: state0, edge, extraRounds: 1 }).ok, true);
});

// ---- read side #4/#5: finishGraphNode 的可观测输出 -------------------------
// The engine-side caps live inside finishGraphNode (not exported), so lock them
// by driving the real orchestrator and reading the resulting state instead of
// re-reading the source (an f(x)===f(x) self-proof). `extraRounds` is the WP-6
// write side; here it is injected into the loaded node state so the READ side
// under test can be observed in isolation.
const ENGINE_TASK = '给 calc.js 补 div 函数。改动写在 calc.js\n产物：calc.js';
const ENGINE_FAIL = { verdict: 'fail', defects: [{ summary: 'div by zero', evidence: 'out/test-log.txt' }] };
const ENGINE_PASS = { verdict: 'pass', defects: [] };

function engineFactory(script, cwd) {
  let ordinal = 0;
  return {
    async create() {
      const step = script[ordinal] ?? {};
      const sessionId = `extra-sess-${++ordinal}`;
      let updateCb = () => {};
      return {
        sessionId,
        async initialize() { return { ok: true }; },
        async newSession() { return { ok: true, result: { sessionId } }; },
        async prompt(sid) {
          updateCb({ sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk' } });
          if (step.write) {
            const target = path.join(cwd, step.write);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, 'module.exports = {};\n', 'utf8');
          }
          if (step.verdict) {
            const out = path.join(cwd, 'out');
            fs.mkdirSync(out, { recursive: true });
            fs.writeFileSync(path.join(out, 'verdict.json'), JSON.stringify(step.verdict), 'utf8');
            fs.writeFileSync(path.join(out, 'test-log.txt'), 'log\n', 'utf8');
          }
          return { ok: true, result: { stopReason: 'end_turn' } };
        },
        onUpdate(cb) { updateCb = cb; },
        async cancel() { return { ok: true }; },
        async closeSession() { return { ok: true }; },
        async dispose() {},
      };
    },
  };
}

/** Run a code-loop with two failing verdicts; optionally grant T-002 one extra round. */
async function runTwoFailingRounds({ extraRounds }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'extra-rounds-root-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'extra-rounds-cwd-'));
  const W = () => ({ write: 'calc.js' });
  const F = () => ({ verdict: ENGINE_FAIL });
  const P = () => ({ verdict: ENGINE_PASS });
  // Without a retry the run stops at round 2; with one it must reach round 3.
  const script = extraRounds
    ? [W(), F(), W(), F(), W(), P()]
    : [W(), F(), W(), F()];
  const store = createStore({ root });
  const bus = createEventBus({ store });
  if (extraRounds) {
    // The WP-6 write side is not implemented yet: inject the granted round into
    // every loaded snapshot so finishVerdictNode / checkWakeGate / planAdvance
    // observe it. This is state, not source — the assertions below are on the
    // actual terminal output of the driven run.
    const rawLoad = store.load.bind(store);
    store.load = async (instanceId) => {
      const loaded = await rawLoad(instanceId);
      const target = loaded.ok && Array.isArray(loaded.state?.nodes)
        ? loaded.state.nodes.find((item) => item.nodeId === 'T-002')
        : null;
      if (target) target.extraRounds = 1;
      return loaded;
    };
  }
  const orch = createOrchestrator({
    store, bus,
    adapterFactory: engineFactory(script, cwd),
    env: { NODE_ENV: 'test' },
  });
  try {
    const result = await orch.startRun({ cwd, task: ENGINE_TASK, template: 'code-loop' });
    const state = (await store.load('INST-001')).state;
    return { result, state };
  } finally {
    await orch.dispose();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

test('finishGraphNode 可观测输出：未 retry 时 round=2 升级 rounds_exceeded', async () => {
  const { state } = await runTwoFailingRounds({ extraRounds: false });
  assert.equal(state.state, 'suspended');
  assert.equal(state.nodes[1].state, 'escalated');
  assert.equal(state.nodes[1].round, 2);
  assert.equal(state.escalations[0].reasonCode, 'rounds_exceeded');
});

test('finishGraphNode 可观测输出：retry(extraRounds=1) 后能派发到 round=3 才收口', async () => {
  const { state } = await runTwoFailingRounds({ extraRounds: true });
  assert.equal(state.state, 'completed');
  assert.equal(state.nodes[1].state, 'done');
  assert.equal(state.nodes[1].round, 3, '未放宽门限时 round=2 就升级，放宽后应到第 3 轮');
  assert.equal(state.escalations.length, 0);
});
