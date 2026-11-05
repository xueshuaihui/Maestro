import assert from 'node:assert/strict';
import test from 'node:test';

import { diskState, setup, waitFor } from './helpers.js';

const INSTANCE = 'INST-001';

test('F-3 存储层：expectedState 不符 → STORE_CONFLICT 且不写', async () => {
  const env = await setup({ switches: [] });
  try {
    const at = new Date().toISOString();
    const state = {
      schemaVersion: 1,
      instanceId: INSTANCE,
      coreGeneration: 'gen-wp8',
      createdAt: at,
      updatedAt: at,
      state: 'running',
      stateSince: at,
      cwd: env.cwd,
      task: 't',
      roleId: 'worker',
      node: { nodeId: 'T-001', state: 'running', stateSince: at, startedAt: at, endedAt: null, failure: null, note: null },
      session: null,
      handoff: null,
      artifactRefs: [],
      hostRaw: {},
      counters: { eventSeq: 0, runCount: 1 },
    };
    const first = await env.store.save(INSTANCE, state);
    assert.equal(first.ok, true);
    assert.equal(first.rev, 1);

    // ① string（v1 旧语义）：只比 disk.state.state
    const conflict = await env.store.save(
      INSTANCE,
      { ...state, state: 'completed' },
      { expectedState: 'created' },
    );
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 'STORE_CONFLICT');
    assert.deepEqual(conflict.params.expected, 'created');
    assert.equal(conflict.params.actual, 'running');

    // ② 对象形状：rev 是整快照版本，state 相同但 rev 不符同样冲突
    const staleRev = await env.store.save(
      INSTANCE,
      { ...state, state: 'completed' },
      { expectedState: { state: 'running', halted: false, rev: 0 } },
    );
    assert.equal(staleRev.ok, false);
    assert.equal(staleRev.code, 'STORE_CONFLICT');
    assert.deepEqual(staleRev.params.actual, { state: 'running', halted: false, rev: 1 });

    const after = await diskState(env.store, INSTANCE);
    assert.equal(after.state, 'running', '冲突时不得写入');
    assert.equal(after.rev, 1, '冲突不推进版本');

    // ③ 三字段全对才放行，rev 单调 +1
    const passed = await env.store.save(
      INSTANCE,
      { ...state, state: 'completed' },
      { expectedState: { state: 'running', halted: false, rev: 1 } },
    );
    assert.equal(passed.ok, true);
    assert.equal(passed.rev, 2);
    assert.equal((await diskState(env.store, INSTANCE)).rev, 2);
  } finally {
    await env.teardown();
  }
});

test('F-3 编排层：磁盘被外部改成 interrupted 后，→completed 被拒且留事件', async () => {
  const env = await setup({ switches: ['--write-ref', 'out/a.md', '--turn-delay-ms', '600'] });
  try {
    const running = env.orch.startRun({ cwd: env.cwd, task: '写下 out/a.md' });

    // 等它真的跑起来，并进入 --turn-delay-ms 的静默窗口（没有在飞的状态写入）
    await waitFor(async () => {
      const loaded = await env.store.load(INSTANCE);
      return (
        loaded.ok &&
        loaded.state.state === 'running' &&
        loaded.state.nodes?.[0]?.state === 'running' &&
        loaded.state.sessions?.at(-1)?.state === 'tool_running'
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 模拟另一个核心（或重启对账）把实例判成已中断；节点保持 running。
    const loaded = await env.store.load(INSTANCE);
    loaded.state.state = 'interrupted';
    loaded.state.stateSince = new Date().toISOString();
    assert.equal((await env.store.save(INSTANCE, loaded.state)).ok, true);

    const result = await running;
    assert.equal(result.ok, false, JSON.stringify(result));

    const events = (await env.store.readEvents(INSTANCE)).events;
    const rejected = events.filter(
      (ev) => ev.object === 'instance' && ev.to === 'completed' && ev.result === 'rejected',
    );
    assert.equal(rejected.length >= 1, true, '应有 instance → completed 的拒绝事件');
    assert.equal(rejected[0].from, 'interrupted');

    const after = await diskState(env.store, INSTANCE);
    assert.equal(after.state, 'interrupted', '终态不得被内存里的 running 覆盖');
  } finally {
    await env.teardown();
  }
});
