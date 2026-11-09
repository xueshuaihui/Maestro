/**
 * WP-6 / D-6 / AC-23~30 / AC-66: the three adjudication exits (pass / fail /
 * retry), the retry write side (extraRounds + 1 with no `extraOf` double count),
 * and the driveGraph `paused` tail ("no dispatch, exit 0 with a paused snapshot").
 *
 * The adjudication paths use a crafted suspended on-disk state and a save spy
 * (deterministic, no live host). The paused-tail test drives a real multi-node
 * run with the MAESTRO_TEST_STOP_AFTER seam to freeze between rounds on purpose.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const graph = {
  id: 'esc-test', entry: 'N-1', terminal: 'N-2', terminals: ['N-2'], maxRounds: 2,
  nodes: [
    { id: 'N-1', roleId: 'alpha', order: 1, products: ['out/a.txt'], prompt: 'forward' },
    { id: 'N-2', roleId: 'beta', order: 2, products: [], prompt: 'forward' },
  ],
  edges: [{ from: 'N-1', to: 'N-2', kind: 'forward' }],
};

const ID = 'INST-ESC';

/** suspended instance with ONE pending escalation on `nodeId`. */
function escState({ nodeId = 'N-1', reasonCode = 'execution_failed', state = 'pending' } = {}) {
  const nodes = [
    { nodeId: 'N-1', state: 'done', round: 2, endedAt: '2026-01-01T00:00:02.000Z', sessionId: 'sess-0' },
    { nodeId: 'N-2', state: 'pending', round: 0, endedAt: null },
  ];
  const target = nodes.find((n) => n.nodeId === nodeId);
  target.state = 'escalated';
  return {
    schemaVersion: 2,
    instanceId: ID,
    state: 'suspended',
    halted: false,
    rev: 5,
    paused: false,
    task: '写下产物：out/a.txt',
    cwd: '/tmp/maestro-esc-work',
    template: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    stateSince: '2026-01-01T00:00:00.000Z',
    counters: { dispatchCount: 1, eventSeq: 0 },
    nodes,
    sessions: [{ sessionId: 'sess-0', state: 'escalated', nodeId, hostId: null, quarantined: false }],
    handoffs: [],
    approvals: [],
    escalations: [{
      escalationId: 'ESC-001', nodeId, round: 2, state,
      reasonCode, reasonDetail: 'boom', defects: [],
      createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: null, resolution: null,
    }],
  };
}

async function makeEsc(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-esc-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const saved = [];
  const rawSave = store.save.bind(store);
  store.save = (id, s, opts) => { saved.push({ state: clone(s), opts }); return rawSave(id, s, opts); };
  // No host: a retry dispatch degrades to "verdict persisted + escalation",
  // which is exactly the §4 WP-6 rollback path (never a half-written running).
  const orch = createOrchestrator({
    store, bus, graph, env: { NODE_ENV: 'test' },
    adapterFactory: { async create() { throw new Error('no host in unit test'); } },
  });
  await store.save(ID, escState(overrides));
  saved.length = 0;
  return {
    root, store, bus, orch, saved,
    async teardown() {
      await orch.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

function extraOf(savedState) {
  const node = (savedState.nodes ?? []).find((n) => Number.isInteger(n.extraRounds));
  return node?.extraRounds ?? 0;
}

// ------------------------------------------------------------------ retry (write side)

test('D-6.6 / D-6.8：retry 在裁决 CAS 写入 extraRounds+1，且不重复计数（extraOf = 1）', async () => {
  const h = await makeEsc();
  try {
    const res = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-001', decision: 'retry',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.resolution, 'retry');
    // No advance() inside a held lock; a failed dispatch degrades cleanly.
    assert.equal(res.dispatched, false);
    assert.equal(res.suspended, true);

    // The adjudication CAS (and every later save) carries exactly ONE extra
    // round. If an explicit `extraRounds` were ALSO passed to advance/planAdvance,
    // `extraOf` would sum persisted(1) + explicit(1) = 2 — it must not.
    const withExtra = h.saved.filter((s) => extraOf(s.state) === 1);
    assert.ok(withExtra.length >= 1, '裁决 CAS 必须落盘 extraRounds=1');
    assert.ok(h.saved.every((s) => extraOf(s.state) <= 1), '不得出现 extraRounds=2（防重复计数）');

    const disk = (await h.store.load(ID)).state;
    assert.equal(extraOf(disk), 1, '磁盘现值 extraRounds=1');
    const esc = disk.escalations.find((e) => e.escalationId === 'ESC-001');
    assert.equal(esc.state, 'resolved');
    assert.equal(esc.resolution, 'retry');
    assert.ok(esc.resolvedAt);

    const events = (await h.store.readEvents(ID)).events;
    assert.ok(events.some((ev) => ev.reason === 'escalation.resolved'));
  } finally {
    await h.teardown();
  }
});

test('retry 把裁决落盘后再派发：事件先落盘再广播（escalation.resolved 在 node.dispatch 之前）', async () => {
  const h = await makeEsc();
  try {
    await h.orch.resolveEscalation({ instanceId: ID, escalationId: 'ESC-001', decision: 'retry' });
    const events = (await h.store.readEvents(ID)).events;
    const resolvedIdx = events.findIndex((ev) => ev.reason === 'escalation.resolved');
    const dispatchIdx = events.findIndex((ev) => ev.reason === 'node.dispatch');
    assert.ok(resolvedIdx >= 0, 'escalation.resolved 必须落盘');
    // With the no-host rollback there is no dispatch at all; when there is one
    // it must come strictly after the resolved event.
    assert.ok(dispatchIdx === -1 || resolvedIdx < dispatchIdx);
  } finally {
    await h.teardown();
  }
});

// ------------------------------------------------------------------ fail / pass exits

test('D-6.5：fail → 节点 failed / 实例 failed / 不再推进', async () => {
  const h = await makeEsc();
  try {
    const res = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-001', decision: 'fail',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.resolution, 'fail');
    assert.equal(res.state, 'failed');
    assert.equal(res.dispatched, false);

    const disk = (await h.store.load(ID)).state;
    assert.equal(disk.state, 'failed');
    assert.equal(disk.nodes.find((n) => n.nodeId === 'N-1').state, 'failed');
    assert.equal(disk.escalations[0].resolution, 'fail');
    assert.equal(disk.sessions[0].state, 'idle');
    assert.equal(disk.sessions[0].quarantined, true);
    assert.equal((await h.store.readEvents(ID)).events.some((ev) => ev.reason === 'node.dispatch'), false);
  } finally {
    await h.teardown();
  }
});

test('D-6.4：终节点 pass（rounds_exceeded）→ 节点 done / 实例 completed', async () => {
  const h = await makeEsc({ nodeId: 'N-2', reasonCode: 'rounds_exceeded' });
  try {
    const res = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-001', decision: 'pass',
    });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.resolution, 'pass');
    assert.equal(res.state, 'completed');
    assert.equal(res.dispatched, false, '终节点 pass 不再 advance');

    const disk = (await h.store.load(ID)).state;
    assert.equal(disk.state, 'completed');
    assert.equal(disk.nodes.find((n) => n.nodeId === 'N-2').state, 'done');
  } finally {
    await h.teardown();
  }
});

test('D-6.3 / BR-19：仅 rounds_exceeded 允许 pass，其他原因与非法决策被拒且 rev 不变', async () => {
  const h = await makeEsc({ reasonCode: 'execution_failed' });
  try {
    const before = (await h.store.load(ID)).state.rev;
    const pass = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-001', decision: 'pass',
    });
    assert.equal(pass.ok, false);
    assert.equal(pass.code, 'ESCALATION_DECISION_INVALID');

    const bogus = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-001', decision: 'whatever',
    });
    assert.equal(bogus.code, 'ESCALATION_DECISION_INVALID');

    const missing = await h.orch.resolveEscalation({
      instanceId: ID, escalationId: 'ESC-404', decision: 'fail',
    });
    assert.equal(missing.code, 'ESCALATION_NOT_FOUND');

    assert.equal((await h.store.load(ID)).state.rev, before, '被拒裁决不写盘');
  } finally {
    await h.teardown();
  }
});

// ------------------------------------------------------------------ driveGraph paused tail

const pauseGraph = {
  id: 'code-loop', productPolicy: 'declared', entry: 'T-001', terminal: 'T-002',
  terminals: ['T-002'], maxRounds: 2,
  nodes: [
    { id: 'T-001', roleId: 'a', order: 1, products: ['calc.js'], prompt: 'write', title: 'A' },
    { id: 'T-002', roleId: 'b', order: 2, products: [], prompt: 'verify', title: 'B' },
  ],
  edges: [{ from: 'T-001', to: 'T-002', kind: 'forward' }],
};

function passFactory(cwd) {
  let ordinal = 0;
  return {
    async create() {
      const sid = `sess-${++ordinal}`;
      let updateCb = () => {};
      return {
        sessionId: sid,
        async initialize() { return { ok: true }; },
        async newSession() { return { ok: true, result: { sessionId: sid } }; },
        async prompt(s) {
          updateCb({ sessionId: s, update: { sessionUpdate: 'agent_thought_chunk' } });
          fs.mkdirSync(path.join(cwd, 'out'), { recursive: true });
          fs.writeFileSync(path.join(cwd, 'calc.js'), 'module.exports={};\n', 'utf8');
          fs.writeFileSync(path.join(cwd, 'out', 'verdict.json'), JSON.stringify({ verdict: 'pass', defects: [] }), 'utf8');
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

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

async function waitFile(p, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (exists(p)) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

test('D-7.4 ③ / AC-49：driveGraph 遇 paused → 不派发、不落盘，以 paused 快照（exit 0）收尾', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-paused-tail-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-paused-tail-cwd-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store, bus, graph: pauseGraph,
    env: { NODE_ENV: 'test', MAESTRO_TEST_STOP_AFTER: '1' },
    adapterFactory: passFactory(cwd),
  });
  const marker = path.join(root, '.mock', 'stopped-after-1');
  const release = path.join(root, '.mock', 'release');
  const TASK = '补 div 函数。改动写在 calc.js\n产物：calc.js';

  try {
    const started = await orch.startRun({ cwd, task: TASK, template: 'code-loop', earlyReturn: true });
    assert.equal(started.ok, true, JSON.stringify(started));

    // Freeze the drive deterministically between round 1 and the next advance.
    assert.equal(await waitFile(marker, 30000), true, '应在派发边界停住');
    const paused = await orch.pause({ instanceId: 'INST-001' });
    assert.equal(paused.ok, true, JSON.stringify(paused));
    assert.equal(paused.paused, true);

    fs.writeFileSync(release, 'go', 'utf8');
    const waited = await orch.waitForRun({ instanceId: 'INST-001', timeoutMs: 30000 });
    assert.equal(waited.ok, true, JSON.stringify(waited));
    assert.equal(waited.snapshot.paused, true, 'run.wait 以 paused 收尾');
    assert.equal(waited.snapshot.state, 'running', 'paused 不是失败、不是挂起');

    const events = (await store.readEvents('INST-001')).events;
    assert.equal(
      events.filter((ev) => ev.reason === 'node.dispatch').length, 1,
      '暂停后不得再派发（不落盘 / 不升级 / 不建会话）',
    );
    const disk = (await store.load('INST-001')).state;
    assert.equal(disk.paused, true);
    assert.equal(disk.counters.dispatchCount, 1, '无第二个派发 CAS');
    assert.equal(disk.sessions.length, 1, '没有新建会话');
  } finally {
    await orch.dispose();
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
