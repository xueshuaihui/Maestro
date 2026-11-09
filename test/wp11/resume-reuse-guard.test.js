/**
 * B-01 / AC-66 / D-7.4 step 1+3: the resume side path may reuse a `created`
 * package persisted just before a pause ONLY when the three gates hold:
 *   1. toNodeId === the advance's target node (never reverse-derived from a package)
 *   2. round === targetRound (target node round + 1)
 *   3. no session already started for that round (old-round sessions do not count)
 * and only when the round guard (busy target / node.round >= targetRound /
 * committed dispatch) does not stop the drive.
 *
 * These are deterministic unit tests: a "dispatch already committed, package
 * still `created`" disk snapshot is written directly, then resume() is called.
 * No real host is used (adapterFactory.create throws on purpose).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

const ID = 'INST-RG';

/** Two nodes, one forward edge: planner target is N2, targetRound = N2.round + 1. */
const GRAPH = {
  id: 'resume-guard-graph',
  nodes: [{ id: 'N1' }, { id: 'N2' }],
  edges: [{ from: 'N1', to: 'N2', kind: 'forward' }],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** paused=true, one `created` package to N2 built for round 1, no N2 session yet. */
function baseState(overrides = {}) {
  return {
    schemaVersion: 2,
    instanceId: ID,
    state: 'running',
    halted: false,
    rev: 0,
    paused: true,
    task: 'resume reuse guard',
    cwd: '/tmp/maestro-resume-guard-work',
    template: 'resume-guard-graph',
    createdAt: '2026-01-01T00:00:00.000Z',
    stateSince: '2026-01-01T00:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes: [
      { nodeId: 'N1', state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z', sessionId: 'sess-1' },
      { nodeId: 'N2', state: 'pending', round: 0, endedAt: null },
    ],
    sessions: [
      { sessionId: 'sess-1', nodeId: 'N1', round: 1, state: 'idle', createdAt: '2026-01-01T00:00:01.000Z' },
    ],
    handoffs: [
      {
        handoffId: 'HO-001', state: 'created', round: 1,
        fromNodeId: 'N1', toNodeId: 'N2',
        edge: { from: 'N1', to: 'N2', kind: 'forward' },
        defects: [], deliveryAttempts: 0,
      },
    ],
    escalations: [],
    approvals: [],
    ...overrides,
  };
}

const dispatchEvents = (events) => events.filter((ev) => ev.reason === 'node.dispatch').length;

async function makeHarness(stateOverrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-resume-guard-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store,
    bus,
    graph: GRAPH,
    adapterFactory: { async create() { throw new Error('no host in unit test'); } },
    env: { NODE_ENV: 'test' },
  });
  await store.save(ID, baseState(stateOverrides));

  const rawLoad = store.load.bind(store);
  const rawSave = store.save.bind(store);
  const h = { store, orch, root, loadCount: 0, saveCount: 0 };
  store.load = (id) => { h.loadCount += 1; return rawLoad(id); };
  store.save = (id, state, opts) => { h.saveCount += 1; return rawSave(id, state, opts); };
  h.disk = async () => (await rawLoad(ID)).state;
  h.events = async () => (await store.readEvents(ID)).events;
  /** Wait until the background drive re-read the disk and all writes went quiet.
   *  The dispatch CAS is a real file write, so allow a generous quiet window. */
  h.settle = async () => {
    let quiet = 0;
    let prev = h.saveCount;
    for (let i = 0; i < 400; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (h.loadCount >= 2 && h.saveCount === prev) quiet += 1;
      else quiet = 0;
      prev = h.saveCount;
      if (quiet >= 30) return;
    }
    throw new Error('background drive did not settle');
  };
  /** Wait for the OBSERVABLE dispatch terminal state (not the internal loadCount):
   *  dispatchCount reached `expected` AND at least one node.dispatch event landed. */
  h.waitForDispatch = async (expected, { timeoutMs = 15000 } = {}) => {
    const deadline = Date.now() + timeoutMs;
    let observed = null;
    for (;;) {
      const state = await h.disk();
      const events = await h.events();
      observed = { dispatchCount: state.counters.dispatchCount, nodeDispatch: dispatchEvents(events) };
      if (observed.dispatchCount >= expected && observed.nodeDispatch >= 1) return;
      if (Date.now() >= deadline) {
        throw new Error(`派发终态未到达：期望 counters.dispatchCount>=${expected} 且 events.jsonl 出现 node.dispatch；上限 ${timeoutMs}ms；最后观测 ${JSON.stringify(observed)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  h.teardown = async () => {
    await orch.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  };
  return h;
}

/** Shared assertion: a `created` package on disk was NOT reused / re-dispatched. */
async function assertNotReused(h, before) {
  const after = await h.disk();
  const events = await h.events();
  assert.equal(after.handoffs.length, before.handoffs.length, '不产生第二张包');
  assert.equal(after.handoffs[0].handoffId, 'HO-001');
  assert.equal(after.handoffs[0].state, 'created', '残留 created 包未被复用');
  assert.equal(after.counters.dispatchCount, before.counters.dispatchCount, 'dispatchCount 不增加');
  assert.equal(dispatchEvents(events), 0, '没有重复派发');
  assert.equal(after.sessions.length, before.sessions.length, '没有重复会话');
  return after;
}

test('B-01 竞态：派发已提交但包仍残留 created，resume 不产生第二张包 / 不重复派发 / dispatchCount 不增加 / 无重复会话', async () => {
  const h = await makeHarness({
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 2 },
    nodes: [
      { nodeId: 'N1', state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z', sessionId: 'sess-1' },
      { nodeId: 'N2', state: 'running', round: 1, endedAt: null, sessionId: 'sess-2' },
    ],
    sessions: [
      { sessionId: 'sess-1', nodeId: 'N1', round: 1, state: 'idle', createdAt: '2026-01-01T00:00:01.000Z' },
      { sessionId: 'sess-2', nodeId: 'N2', round: 1, state: 'thinking', createdAt: '2026-01-01T00:00:03.000Z' },
    ],
  });
  try {
    const before = clone(await h.disk());
    const resumed = await h.orch.resume({ instanceId: ID });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    await h.settle();
    const after = await assertNotReused(h, before);
    assert.equal(after.nodes.find((n) => n.nodeId === 'N2').round, 1, 'round 未重复增加');
  } finally {
    await h.teardown();
  }
});

test('B-01 负例 1：toNodeId !== 目标节点时不复用', async () => {
  const h = await makeHarness({
    handoffs: [{
      handoffId: 'HO-001', state: 'created', round: 1,
      fromNodeId: 'N1', toNodeId: 'N3',
      edge: { from: 'N1', to: 'N3', kind: 'forward' },
      defects: [], deliveryAttempts: 0,
    }],
  });
  try {
    const before = clone(await h.disk());
    assert.equal((await h.orch.resume({ instanceId: ID })).ok, true);
    await h.settle();
    await assertNotReused(h, before);
  } finally {
    await h.teardown();
  }
});

test('B-01 负例 2：round !== targetRound 时不复用', async () => {
  const h = await makeHarness({
    handoffs: [{
      handoffId: 'HO-001', state: 'created', round: 7,
      fromNodeId: 'N1', toNodeId: 'N2',
      edge: { from: 'N1', to: 'N2', kind: 'forward' },
      defects: [], deliveryAttempts: 0,
    }],
  });
  try {
    const before = clone(await h.disk());
    assert.equal((await h.orch.resume({ instanceId: ID })).ok, true);
    await h.settle();
    await assertNotReused(h, before);
  } finally {
    await h.teardown();
  }
});

test('B-01 负例 3：该轮已有已开始会话时不复用（旧轮次会话不算）', async () => {
  const h = await makeHarness({
    sessions: [
      { sessionId: 'sess-1', nodeId: 'N1', round: 1, state: 'idle', createdAt: '2026-01-01T00:00:01.000Z' },
      { sessionId: 'sess-2', nodeId: 'N2', round: 1, state: 'thinking', createdAt: '2026-01-01T00:00:03.000Z' },
    ],
  });
  try {
    const before = clone(await h.disk());
    assert.equal((await h.orch.resume({ instanceId: ID })).ok, true);
    await h.settle();
    await assertNotReused(h, before);
  } finally {
    await h.teardown();
  }
});

test('B-01 正例：三重门控全部成立时仍复用同一张 created 包派发一次', async () => {
  const h = await makeHarness();
  try {
    const before = clone(await h.disk());
    assert.equal((await h.orch.resume({ instanceId: ID })).ok, true);
    await h.waitForDispatch(before.counters.dispatchCount + 1);
    const after = await h.disk();
    const events = await h.events();
    assert.equal(after.handoffs.length, before.handoffs.length, '不产生第二张包');
    assert.equal(after.handoffs[0].handoffId, 'HO-001', '仍是原来那张包');
    assert.equal(after.counters.dispatchCount, before.counters.dispatchCount + 1, 'dispatchCount 恰好 +1');
    assert.equal(dispatchEvents(events), 1, '恰好一次派发');
    assert.equal(after.nodes.find((n) => n.nodeId === 'N2').round, 1, '目标节点 round 提交一次');
  } finally {
    await h.teardown();
  }
});
