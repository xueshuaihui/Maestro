/**
 * D-3 / D-4 / AC-08~20 / AC-63 / AC-65: schema rejection, durable inbox and the
 * retry state machine (WP-4 回补).
 *
 * Retries are driven by the product-side injectable hold gate (`deliveryHold`)
 * instead of real sleeps / MAESTRO_TEST_DELIVERY_DELAY_MS: with an injected
 * controller the retry loop awaits an explicit release/cancel promise and never
 * schedules a timer, so full-suite concurrency cannot perturb the timing.
 * WP-6 registers the `test.delivery` / `holdDelivery` RPC over the same seam.
 *
 * Bad handoff drafts are produced through the test-only `handoffDraftHook`
 * (the `test.handoff` seam is driven by WP-6); a bad draft goes through the
 * exact same one-CAS rejection as a production bad package.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { validateHandoff } from '../../src/core/handoff-schema.js';
import { inboxFilePath, instanceInboxDir } from '../../src/persistence/paths.js';
import { createStore } from '../../src/persistence/instance-store.js';

const CODE_TASK = '给 calc.js 补 div 函数。改动写在 calc.js\n产物：calc.js';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
/**
 * No wall-clock deadline anywhere in this file. A fixed `startRun` timeout was
 * the exact flakiness source under full-suite I/O contention: the run is fully
 * deterministic (hold/promise gates, scripted adapter), so it must simply be
 * awaited to completion. A genuine hang is a bug that has to surface, not be
 * masked by a bigger number.
 */

/**
 * M-01 / AC-61 hold controller. In auto mode (default) `wait` resolves true
 * immediately so retries proceed with no timer; in hold mode it suspends until
 * release()/cancel() are called. `cancel()` also invokes info.cancelTimer()
 * so a pending backoff timer is cleared deterministically.
 */
function makeHoldController() {
  let holding = false;
  const waiters = [];
  const heldWaiters = [];
  return {
    hold() { holding = true; },
    async wait(info) {
      if (!holding) return true;
      return new Promise((resolve) => {
        waiters.push({ resolve, info });
        for (const fn of heldWaiters.splice(0)) fn(info);
      });
    },
    release() {
      for (const w of waiters.splice(0)) w.resolve(true);
    },
    cancel() {
      for (const w of waiters.splice(0)) {
        w.info?.cancelTimer?.();
        w.resolve(false);
      }
    },
    whenHeld() {
      if (waiters.length > 0) return Promise.resolve();
      return new Promise((resolve) => heldWaiters.push(resolve));
    },
  };
}

/**
 * Scripted adapter factory. `byOrdinal[n]` is the per-adapter sequence of
 * prompt results, indexed by that adapter's own prompt call count. A failed
 * result deliberately emits NO turn frame, so the tracker stays `delivered`
 * and the retry layer treats it as a delivery failure (C-09 / D-4.4).
 */
function makeFactory({ byOrdinal = {} } = {}) {
  let createIndex = 0;
  const calls = [];
  return {
    calls,
    async create({ cwd }) {
      const ordinal = ++createIndex;
      const sessionId = `dsess-${ordinal}`;
      const results = byOrdinal[ordinal] ?? [{ ok: true }];
      let localIndex = 0;
      let updateCb = () => {};
      return {
        sessionId,
        async initialize() { return { ok: true }; },
        async newSession() { return { ok: true, result: { sessionId } }; },
        async prompt(sid, blocks) {
          const idx = localIndex++;
          calls.push({ ordinal, idx, sessionId: sid, text: blocks?.[0]?.text ?? '' });
          const spec = results[Math.min(idx, results.length - 1)] ?? { ok: true };
          if (spec.ok === false) {
            return { ok: false, error: spec.error ?? { code: -32603, message: 'host boom' } };
          }
          updateCb({ sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk' } });
          if (spec.write) {
            const target = path.join(cwd, spec.write);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, spec.content ?? 'module.exports = {};\n', 'utf8');
          }
          if (spec.evidence) {
            const target = path.join(cwd, spec.evidence);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, 'log\n', 'utf8');
          }
          if (spec.verdict) {
            const target = path.join(cwd, 'out', 'verdict.json');
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, JSON.stringify(spec.verdict), 'utf8');
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

const DEV_OK = { ok: true, write: 'calc.js' };
const VERDICT_PASS = { ok: true, evidence: 'out/test-log.txt', verdict: { verdict: 'pass', defects: [] } };
const DELIVERY_FAIL = { ok: false };

async function setup({ byOrdinal, env = {}, deliveryHold = null, handoffDraftHook = null } = {}) {
  const root = tmpDir('maestro-delivery-root-');
  const cwd = tmpDir('maestro-delivery-cwd-');
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const events = [];
  bus.subscribe((event) => events.push(event));
  const factory = makeFactory({ byOrdinal });
  const hold = deliveryHold ?? makeHoldController();
  // Track every successful CAS so the "one-CAS rejection" can be asserted.
  const saves = [];
  const rawSave = store.save.bind(store);
  store.save = async (instanceId, state, options) => {
    const result = await rawSave(instanceId, state, options);
    if (result?.ok) {
      saves.push({
        handoffs: (state.handoffs ?? []).map((h) => h.state),
        nodes: (state.nodes ?? []).map((n) => n.state),
        instance: state.state,
      });
    }
    return result;
  };
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: factory,
    env: { NODE_ENV: 'test', ...env },
    deliveryHold: hold,
    handoffDraftHook,
  });
  return {
    root, cwd, store, bus, events, factory, orch, hold, saves,
    async teardown() {
      try { await orch.dispose(); } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

function reasons(events) {
  return events.map((e) => e.reason);
}
function handoffTransitions(events) {
  return events
    .filter((e) => e.object === 'handoff' && e.result === 'applied' && e.from !== null)
    .map((e) => `${e.from}->${e.to}`);
}
function ordinalCalls(factory, ordinal) {
  return factory.calls.filter((c) => c.ordinal === ordinal);
}

// ---------------------------------------------------------------- 6 retry scenarios

test('首投失败二次成功：deliveryAttempts=2、信箱 deliveredAt 落盘、事件含 delivered→pending→delivered', async () => {
  const env = await setup({
    byOrdinal: { 1: [DEV_OK], 2: [DELIVERY_FAIL, VERDICT_PASS] },
  });
  try {
    const started = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(started.ok, true, JSON.stringify(started));

    const t2 = ordinalCalls(env.factory, 2);
    assert.equal(t2.length, 2, `图驱动包应恰好 2 次投递，实际 ${t2.length}`);

    const state = (await env.store.load('INST-001')).state;
    const h = state.handoffs.find((x) => x.edge && x.edge.kind === 'forward');
    assert.ok(h, '存在图驱动交接包');
    assert.equal(h.deliveryAttempts, 2);
    assert.equal(h.state, 'consumed');
    // pendingAt is an audit trace: tracker.delivered does not clear it, so a
    // successful retry keeps the timestamp of the earlier delivered->pending
    // fallback (D-3.1 initializes it to null; it is never reset on success).
    assert.equal(typeof h.pendingAt, 'string');

    const inbox = JSON.parse(fs.readFileSync(inboxFilePath(env.root, 'INST-001', h.handoffId), 'utf8'));
    assert.equal(inbox.deliveryAttempts, 2);
    assert.ok(inbox.deliveredAt, '成功投递后信箱有 deliveredAt');

    const seq = handoffTransitions(env.events);
    assert.ok(seq.includes('delivered->pending'), `应含回落，实际 ${seq.join(',')}`);
    assert.ok(seq.includes('pending->delivered'), `应含重试成功，实际 ${seq.join(',')}`);
    assert.ok(reasons(env.events).includes('handoff.inboxed'));
  } finally {
    await env.teardown();
  }
});

test('三次失败 expired：3 次投递、expiredAt、delivery_failed 升级、事件序 inboxed→delivered→pending→expired', async () => {
  const env = await setup({
    byOrdinal: { 1: [DEV_OK], 2: [DELIVERY_FAIL] },
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });

    const t2 = ordinalCalls(env.factory, 2);
    assert.equal(t2.length, 3, `三次即耗尽，实际 ${t2.length}`);

    const state = (await env.store.load('INST-001')).state;
    const h = state.handoffs.find((x) => x.edge && x.edge.kind === 'forward');
    assert.equal(h.state, 'expired');
    assert.equal(h.deliveryAttempts, 3);
    assert.ok(h.expiredAt, 'expiredAt 必须落盘');
    assert.ok(h.lastError, 'lastError 必须落盘');
    const escalation = state.escalations.find((e) => e.reasonCode === 'delivery_failed');
    assert.ok(escalation, '耗尽后升级 delivery_failed');

    const rs = reasons(env.events);
    const iInboxed = rs.indexOf('handoff.inboxed');
    assert.ok(iInboxed >= 0);
    assert.ok(rs.includes('handoff.pending'));
    assert.ok(rs.includes('handoff.expired'));
    const seq = handoffTransitions(env.events);
    assert.ok(seq.includes('delivered->pending'));
    assert.ok(seq.includes('pending->expired'));
  } finally {
    await env.teardown();
  }
});

test('取消中重试：hold 挂住重试后 cancel 清定时器，不再有迟到投递', async () => {
  const hold = makeHoldController();
  hold.hold();
  const env = await setup({
    byOrdinal: { 1: [DEV_OK], 2: [DELIVERY_FAIL, VERDICT_PASS] },
    deliveryHold: hold,
  });
  try {
    const running = env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    // Deterministic: the retry loop is suspended at the hold gate (no sleep).
    await hold.whenHeld();
    const before = ordinalCalls(env.factory, 2).length;
    assert.equal(before, 1, '取消前恰好 1 次投递');

    const cancelled = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    // cancel resolves the hold with false and clears any pending timer.
    hold.cancel();
    await running;

    const after = ordinalCalls(env.factory, 2).length;
    assert.equal(after, 1, `cancel 后不得迟到投递，实际 ${after} 次`);
  } finally {
    await env.teardown();
  }
});

test('inbox_write:fail：不投递、不建信箱、包 rejected/delivery_failed 与升级同一次 CAS', async () => {
  const env = await setup({
    byOrdinal: { 1: [DEV_OK], 2: [VERDICT_PASS] },
    env: { MAESTRO_FAULT: 'inbox_write:fail' },
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });

    assert.equal(ordinalCalls(env.factory, 2).length, 0, '信箱写失败后不得调用 adapter.prompt');
    assert.equal(fs.existsSync(instanceInboxDir(env.root, 'INST-001')), false, '信箱目录不应存在');
    assert.equal(reasons(env.events).includes('handoff.inboxed'), false, '不应广播 handoff.inboxed');

    const state = (await env.store.load('INST-001')).state;
    const h = state.handoffs.find((x) => x.edge && x.edge.kind === 'forward');
    assert.equal(h.state, 'rejected');
    assert.equal(h.rejectReason, 'delivery_failed');
    const escalation = state.escalations.find((e) => e.reasonCode === 'delivery_failed');
    assert.ok(escalation, '升级 delivery_failed');
  } finally {
    await env.teardown();
  }
});

test('单节点不重试：引导包不进信箱/重试、失败一次即止、9 字段不落到引导包', async () => {
  const env = await setup({
    byOrdinal: { 1: [DELIVERY_FAIL] },
  });
  try {
    const started = await env.orch.startRun({ cwd: env.cwd, task: '写一段说明' });

    assert.equal(ordinalCalls(env.factory, 1).length, 1, 'single 失败只投一次');
    assert.equal(fs.existsSync(instanceInboxDir(env.root, 'INST-001')), false, 'single 不建信箱目录');
    const rs = reasons(env.events);
    assert.equal(rs.includes('handoff.inboxed'), false);
    assert.equal(rs.includes('handoff.pending'), false);
    assert.equal(rs.includes('handoff.expired'), false);

    const state = (await env.store.load('INST-001')).state;
    const h = state.handoffs[0];
    assert.ok(h, 'single 有引导包');
    assert.equal(h.edge, null);
    for (const key of ['deliveryAttempts', 'pendingAt', 'expiredAt', 'lastError', 'round', 'fromNodeId', 'toNodeId']) {
      assert.equal(Object.prototype.hasOwnProperty.call(h, key), false, `引导包不应携带 ${key}`);
    }
    assert.equal(started.ok === true || started.ok === false, true);
  } finally {
    await env.teardown();
  }
});

test('delivered→pending 回落：每次失败各发一条 handoff.pending，信箱 lastError 与尝试数同步', async () => {
  const env = await setup({
    byOrdinal: { 1: [DEV_OK], 2: [DELIVERY_FAIL] },
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });

    const pending = env.events.filter((e) => e.reason === 'handoff.pending');
    assert.equal(pending.length, 3, `三次失败各一条 handoff.pending，实际 ${pending.length}`);
    assert.equal(pending[0].detail.deliveryAttempts, 1);
    assert.equal(pending[2].detail.deliveryAttempts, 3);

    const state = (await env.store.load('INST-001')).state;
    const h = state.handoffs.find((x) => x.edge && x.edge.kind === 'forward');
    const inbox = JSON.parse(fs.readFileSync(inboxFilePath(env.root, 'INST-001', h.handoffId), 'utf8'));
    assert.equal(inbox.deliveryAttempts, 3);
    assert.ok(inbox.lastError, '信箱保留 lastError');
    assert.equal(inbox.deliveredAt, null, '耗尽时信箱 deliveredAt 仍为 null');
  } finally {
    await env.teardown();
  }
});

// ---------------------------------------------------------- D-3 bad-package rejection

/**
 * One mutation per D-3 code. `marker` is the distinctive body produced by
 * handoffInvalidDetail (a 1:1 code->wording map), asserted on the escalation.
 * The mutated draft is re-validated after the run to lock the machine code.
 */
const BAD_CASES = [
  {
    code: 'HANDOFF_FIELD_MISSING',
    marker: '缺少字段',
    mutate: (h) => { delete h.instanceId; },
  },
  {
    code: 'HANDOFF_EDGE_INVALID',
    marker: '交接未关联有效交接边',
    mutate: (h) => { h.fromNodeId = 'WRONG'; },
  },
  {
    code: 'HANDOFF_EVIDENCE_MISSING',
    marker: '缺少证据引用',
    mutate: (h) => { h.artifactRefs = { input: [], output: null, previous: null }; h.defects = []; },
  },
  {
    code: 'HANDOFF_EVIDENCE_UNREADABLE',
    marker: '证据不可读',
    mutate: (h) => { h.artifactRefs.input = ['ghost-evidence.js']; },
  },
  {
    code: 'HANDOFF_EVIDENCE_EMPTY',
    marker: '证据为空',
    mutate: (h, info) => {
      fs.writeFileSync(path.join(info.cwd, 'empty-evidence.js'), '', 'utf8');
      h.artifactRefs.input = ['empty-evidence.js'];
    },
  },
  {
    code: 'HANDOFF_EVIDENCE_ESCAPE',
    marker: '证据越界',
    mutate: (h) => { h.artifactRefs.input = ['../secret.txt']; },
  },
  {
    code: 'HANDOFF_HASH_MISMATCH',
    marker: '证据哈希不符',
    mutate: (h) => { h.artifactRefs.previous = { ref: 'calc.js', sha256: '0'.repeat(64) }; },
  },
  {
    code: 'HANDOFF_BACKFLOW_INCOMPLETE',
    marker: '回流缺少',
    mutate: (h) => {
      h.edge.kind = 'backflow';
      h.defects = [];
      h.revisionRequirement = null;
      h.retestRequirement = null;
    },
  },
];

for (const spec of BAD_CASES) {
  test(`D-3 ${spec.code}：坏包零派发 / handoff_invalid 一次 CAS 拒绝`, async () => {
    let captured = null;
    const env = await setup({
      byOrdinal: { 1: [DEV_OK], 2: [VERDICT_PASS] },
      handoffDraftHook: (draft, info) => {
        spec.mutate(draft, info);
        captured = { draft, info };
      },
    });
    try {
      await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });

      // Machine code: re-validate the exact draft the engine rejected.
      assert.ok(captured, '校验钩子应被调用');
      const sourceNode = captured.info.graph.nodes.find(
        (n) => (n.id ?? n.nodeId) === captured.draft.edge.from,
      ) ?? null;
      const check = await validateHandoff(captured.draft, {
        graph: captured.info.graph,
        workspaceDir: captured.info.workspaceDir,
        cwd: captured.info.cwd,
        sourceNode,
      });
      assert.equal(check.ok, false);
      assert.equal(check.code, spec.code);

      const state = (await env.store.load('INST-001')).state;
      const h = state.handoffs.find((x) => x.handoffId === 'HO-001');
      assert.ok(h, '坏包仍以 rejected 落到 handoffs');
      assert.equal(h.state, 'rejected');
      assert.equal(h.rejectReason, 'invalid_payload');
      assert.ok(h.rejectedAt, 'rejectedAt 必须落盘');

      // D-3.5: rejected + escalated + suspended all in ONE CAS. The rejected
      // package appears in exactly one save and never had a `created` record.
      const commits = env.saves.filter((s) => s.handoffs.includes('rejected'));
      assert.equal(commits.length, 1, `rejected 只应由一次 CAS 写入，实际 ${commits.length}`);
      assert.equal(commits[0].instance, 'suspended');
      assert.ok(commits[0].nodes.includes('escalated'));

      const escalation = state.escalations.find((e) => e.reasonCode === 'handoff_invalid');
      assert.ok(escalation, '升级 handoff_invalid');
      assert.ok(escalation.reasonDetail.includes(spec.marker),
        `reasonDetail=${escalation.reasonDetail}`);
      assert.equal(escalation.reasonDetail, check.detail, '复用 handoffInvalidDetail 文案');

      assert.equal(state.nodes[0].state, 'escalated', '来源节点 escalated');
      assert.equal(state.state, 'suspended', '实例 suspended');

      // AC-14 / BR-46: zero dispatch — no handoff.created, no node.dispatch
      // for the downstream node, no inbox, no round increment, no new session.
      const rs = reasons(env.events);
      assert.equal(rs.includes('handoff.created'), false);
      assert.equal(rs.includes('handoff.rejected'), true);
      assert.equal(rs.includes('escalation.created'), true);
      // The entry node (T-001) was legitimately dispatched; the downstream
      // node (T-002) must not be — that is the "zero dispatch" of AC-14.
      const downstreamDispatches = env.events.filter(
        (e) => e.reason === 'node.dispatch' && e.objectId === 'T-002',
      );
      assert.equal(downstreamDispatches.length, 0, '下游不得派发');
      assert.equal(rs.includes('handoff.inboxed'), false, '不建信箱');
      assert.equal(fs.existsSync(instanceInboxDir(env.root, 'INST-001')), false);
      assert.equal(ordinalCalls(env.factory, 2).length, 0, '下游不得调用 adapter.prompt');
      assert.equal(state.nodes[1].round, 0, '下游轮次不增加');
      assert.equal(state.sessions.length, 1, '不新建会话');
    } finally {
      await env.teardown();
    }
  });
}
