/**
 * WP-6 / D-7.2 / AC-49~53: pause writes go through the instance write queue with
 * a FUNCTION-valued expectedState, evaluated inside the queue task RIGHT AFTER
 * the disk read. A rev bump during queuing is therefore NOT a false conflict,
 * and a pause that lands before a dispatch CAS must make that CAS conflict.
 *
 * These are deterministic unit tests: a competing writer is injected into the
 * same store.save sequence on purpose, instead of relying on real timing.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

const ID = 'INST-PAUSE';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** running / not-paused / no ended node (so a background advance is a clean stop). */
function baseState(overrides = {}) {
  return {
    schemaVersion: 2,
    instanceId: ID,
    state: 'running',
    halted: false,
    rev: 0,
    task: 'pause cas test',
    cwd: '/tmp/maestro-pause-work',
    createdAt: '2026-01-01T00:00:00.000Z',
    stateSince: '2026-01-01T00:00:00.000Z',
    counters: { dispatchCount: 1, eventSeq: 0 },
    nodes: [{ nodeId: 'T-001', state: 'running', round: 1, sessionId: 'sess-001', endedAt: null }],
    sessions: [
      { sessionId: 'sess-001', state: 'thinking', nodeId: 'T-001', hostId: null, quarantined: false },
    ],
    handoffs: [],
    escalations: [],
    approvals: [],
    ...overrides,
  };
}

/**
 * Real store + a save spy. `injectBump` enqueues one competing save (rev +1,
 * paused left false) BEFORE the first function-valued expectedState save, so the
 * pause write can prove it re-read the disk inside the queue task.
 */
async function makeHarness({ stateOverrides = {}, injectBump = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-pause-cas-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: { async create() { throw new Error('no host in unit test'); } },
    env: { NODE_ENV: 'test' },
  });
  await store.save(ID, baseState(stateOverrides));

  const rawSave = store.save.bind(store);
  const saves = [];           // every store.save call from the orchestrator
  let expectedDisk = null;     // the disk value handed to the expected function
  let saveInsideExpected = 0;  // must stay 0 (no re-entrant save in the queue task)
  let inExpected = 0;
  let bumpDone = false;

  store.save = (id, state, opts) => {
    let passOpts = opts;
    if (typeof opts?.expectedState === 'function') {
      const fn = opts.expectedState;
      passOpts = {
        ...opts,
        expectedState: (disk) => {
          inExpected += 1;
          expectedDisk = disk;
          try {
            return fn(disk);
          } finally {
            inExpected -= 1;
          }
        },
      };
    }
    if (inExpected > 0) saveInsideExpected += 1;
    saves.push({ hasFn: typeof opts?.expectedState === 'function', paused: state.paused });

    if (injectBump && typeof opts?.expectedState === 'function' && !bumpDone) {
      bumpDone = true;
      // Competing writer queued first: bumps rev, keeps paused false.
      rawSave(id, { ...clone(state), paused: false }, {});
    }
    return rawSave(id, state, passOpts);
  };

  return {
    store,
    orch,
    saves,
    get expectedDisk() { return expectedDisk; },
    get saveInsideExpected() { return saveInsideExpected; },
    async teardown() {
      await orch.dispose();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('D-7.2 队列内取 expected：排队期间 rev 变化不产生假冲突', async () => {
  const h = await makeHarness({ injectBump: true });
  try {
    const paused = await h.orch.pause({ instanceId: ID });
    assert.equal(paused.ok, true, JSON.stringify(paused));
    assert.equal(paused.paused, true);
    assert.equal(paused.idempotent, false);

    // The expected function saw the FRESH disk (rev bumped by the competitor),
    // not the stale rev that pause() captured at load time.
    assert.ok(h.expectedDisk, 'expectedState 函数必须被队列任务调用');
    assert.equal(h.expectedDisk.rev, 2, '期望值取自读盘现值（排队期间的 rev 变化被吸收）');

    // Exactly ONE function-valued save: a stale static expected would have
    // conflicted and forced the up-to-3 retry loop (a false conflict).
    const fnSaves = h.saves.filter((s) => s.hasFn);
    assert.equal(fnSaves.length, 1, '不得因假冲突重放');
    assert.equal(h.saveInsideExpected, 0, '队列任务内不得再调 store.save（防死锁）');

    const disk = (await h.store.load(ID)).state;
    assert.equal(disk.paused, true);
    assert.equal(disk.state, 'running');
    assert.equal(disk.rev, 3, 'rev 基于磁盘现值递增');

    const events = (await h.store.readEvents(ID)).events;
    assert.equal(events.filter((ev) => ev.reason === 'workflow.paused').length, 1);
  } finally {
    await h.teardown();
  }
});

test('D-7.2 暂停写先于派发 CAS → STORE_CONFLICT 且无会话 / 无 node.dispatch', async () => {
  const h = await makeHarness();
  try {
    const paused = await h.orch.pause({ instanceId: ID });
    assert.equal(paused.ok, true);

    const before = (await h.store.load(ID)).state;
    assert.equal(before.paused, true);
    const staleExpected = {
      state: 'running', halted: false, rev: before.rev - 1, paused: false,
    };

    // A dispatch CAS built from the pre-pause snapshot: it would add a session
    // and bump the round. With `paused` fixed false it must conflict.
    const dispatchSnapshot = clone(before);
    dispatchSnapshot.sessions.push({
      sessionId: 'sess-NEW', state: 'thinking', nodeId: 'T-001', hostId: null,
    });
    dispatchSnapshot.nodes[0].round += 1;
    dispatchSnapshot.paused = false;

    const res = await h.store.save(ID, dispatchSnapshot, { expectedState: staleExpected });
    assert.equal(res.ok, false);
    assert.equal(res.code, 'STORE_CONFLICT', JSON.stringify(res));
    assert.equal(res.params.expected.paused, false, '派发期望 paused:false');
    assert.equal(res.params.actual.paused, true, '磁盘 paused:true');

    const after = (await h.store.load(ID)).state;
    assert.equal(after.paused, true, '冲突不写盘');
    assert.equal(after.rev, before.rev, '冲突不递增 rev');
    assert.equal(after.sessions.length, 1, '没有新建会话');
    assert.equal(after.nodes[0].round, before.nodes[0].round, '没有派发提交');
    const events = (await h.store.readEvents(ID)).events;
    assert.equal(events.some((ev) => ev.reason === 'node.dispatch'), false);
  } finally {
    await h.teardown();
  }
});

test('pause 幂等 / 业务前置：二次 pause 不写盘不发事件；非 running 拒绝且 rev 不变（AC-51 / AC-53）', async () => {
  const h = await makeHarness();
  try {
    const first = await h.orch.pause({ instanceId: ID });
    assert.equal(first.idempotent, false);
    const savesAfterFirst = h.saves.length;
    const revAfterFirst = (await h.store.load(ID)).state.rev;

    const second = await h.orch.pause({ instanceId: ID });
    assert.equal(second.ok, true);
    assert.equal(second.idempotent, true);
    assert.equal(second.paused, true);
    // The idempotent path still performs a (conflicted, non-writing) save call,
    // but the disk rev and the event count must not change.
    assert.equal((await h.store.load(ID)).state.rev, revAfterFirst, '幂等不递增 rev');
    const pausedEvents = (await h.store.readEvents(ID)).events.filter(
      (ev) => ev.reason === 'workflow.paused',
    );
    assert.equal(pausedEvents.length, 1, '幂等不重发事件');
    assert.ok(h.saves.length >= savesAfterFirst);

    // A separate instance that is already cancelled cannot be paused.
    const other = await makeHarness({ stateOverrides: { state: 'cancelled', rev: 4 } });
    try {
      const bad = await other.orch.pause({ instanceId: ID });
      assert.equal(bad.ok, false);
      assert.equal(bad.code, 'INSTANCE_NOT_PAUSABLE');
      const disk = (await other.store.load(ID)).state;
      assert.ok(!disk.paused, '不得把 paused 写到已取消实例');
    } finally {
      await other.teardown();
    }
  } finally {
    await h.teardown();
  }
});

test('resume：一次 CAS 写 paused=false 并发 workflow.resumed；再次 resume 幂等', async () => {
  const h = await makeHarness();
  try {
    await h.orch.pause({ instanceId: ID });
    const resumed = await h.orch.resume({ instanceId: ID });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(resumed.paused, false);
    assert.equal(resumed.idempotent, false);
    assert.equal(resumed.snapshot.paused, false);

    const disk = (await h.store.load(ID)).state;
    assert.equal(disk.paused, false);
    assert.equal(disk.state, 'running');
    const events = (await h.store.readEvents(ID)).events;
    assert.equal(events.filter((ev) => ev.reason === 'workflow.resumed').length, 1);

    const again = await h.orch.resume({ instanceId: ID });
    assert.equal(again.idempotent, true);
  } finally {
    await h.teardown();
  }
});
