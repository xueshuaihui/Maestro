import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');
const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * 夹具工厂：走真实的 stdio transport + acp-client，mock 只是“另一个 host 命令”。
 * 核心不认识它的存在，只看到 adapter 接口。
 */
function makeFactory({ switches = [], command = process.execPath, args = null } = {}) {
  return {
    async create({ cwd }) {
      const transport = createStdioTransport({
        command,
        args: args ?? [MOCK, ...switches],
        env: process.env,
        cwd,
      });
      const client = createAcpClient({ transport, limits: LIMITS });
      return {
        async initialize() {
          const spawned = await transport.spawn();
          if (!spawned.ok) {
            return {
              ok: false,
              error: { code: spawned.code, message: spawned.params?.cause ?? spawned.code },
            };
          }
          return client.initialize();
        },
        newSession: (params) => client.newSession(params),
        prompt: (sessionId, blocks) => client.prompt(sessionId, blocks),
        cancel: (sessionId) => client.cancel(sessionId),
        closeSession: (sessionId) => client.closeSession(sessionId),
        onUpdate: (cb) => client.onUpdate(cb),
        dispose: () => client.dispose(),
      };
    },
  };
}

async function setup(options = {}) {
  const root = tmpDir('maestro-wp4-root-');
  const cwd = tmpDir('maestro-wp4-cwd-');
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const events = [];
  bus.subscribe((event) => events.push(event));
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: makeFactory(options),
    generation: 'gen-wp4',
  });
  return {
    root,
    cwd,
    store,
    bus,
    orch,
    events,
    async teardown() {
      try {
        await orch.dispose();
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** 断言 list 中存在按顺序出现的 pattern 子序列。 */
function assertSubsequence(list, patterns) {
  let cursor = 0;
  for (const entry of list) {
    const pattern = patterns[cursor];
    if (pattern === undefined) break;
    const hit = pattern instanceof RegExp ? pattern.test(entry) : pattern === entry;
    if (hit) cursor += 1;
  }
  assert.equal(
    cursor,
    patterns.length,
    `事件序列不匹配，期望 ${cursor}/${patterns.length}，实际：\n${list.join('\n')}`,
  );
}

function transitions(events) {
  return events
    .filter((event) => event.result === 'applied' && event.from !== null)
    .map((event) => `${event.object}:${event.from}->${event.to}`);
}

test('happy path：9 步顺序正确，终态 completed / done / consumed / idle', async () => {
  const env = await setup({ switches: ['--write-ref', 'out/intro.md'] });
  try {
    const task = '写一段 200 字的产品说明，保存到 out/intro.md';
    const result = await env.orch.startRun({ cwd: env.cwd, task });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.instanceId, 'INST-001');
    assert.equal(result.nodeId, 'T-001');
    assert.match(result.sessionId, /^mock-sess-/);

    const list = transitions(env.events);
    assertSubsequence(list, [
      'node:pending->running',
      'handoff:created->delivered',
      'handoff:delivered->accepted',
      /^session:.+->waiting_dependency$/,
      'node:running->review',
      'node:review->done',
      'handoff:accepted->consumed',
      'instance:running->completed',
    ]);

    const loaded = await env.store.load('INST-001');
    assert.equal(loaded.ok, true, JSON.stringify(loaded));
    const state = loaded.state;
    assert.equal(state.state, 'completed');
    assert.equal(state.state, 'completed');
    assert.equal(state.node.state, 'done');
    assert.equal(state.handoff.state, 'consumed');
    assert.equal(state.session.state, 'idle');
    assert.equal(state.roleId, 'worker');
    assert.equal(state.artifactRefs.length, 1);
    assert.equal(state.artifactRefs[0].ref, 'out/intro.md');
    assert.equal(state.artifactRefs[0].sha256, null);
    assert.equal(fs.existsSync(path.join(env.cwd, 'out', 'intro.md')), true);
  } finally {
    await env.teardown();
  }
});

test('NODE_BUSY：同一实例并发发起不建第二个会话', async () => {
  const env = await setup({ switches: ['--turn-delay-ms', '3000'] });
  try {
    const first = env.orch.startRun({ cwd: env.cwd, task: '跑一会儿', instanceId: 'INST-001' });
    await waitFor(() => env.events.some((e) => e.object === 'handoff' && e.to === 'delivered'));

    const second = await env.orch.startRun({ cwd: env.cwd, task: '再跑一次', instanceId: 'INST-001' });
    assert.equal(second.ok, false);
    assert.equal(second.code, 'NODE_BUSY');
    assert.equal(second.params && Object.keys(second.params).length, 0);

    const firstResult = await first;
    assert.equal(firstResult.ok, true, JSON.stringify(firstResult));

    const sessionIds = new Set(
      env.events
        .filter((e) => e.object === 'session')
        .map((e) => e.objectId)
        .filter((id) => typeof id === 'string' && id.startsWith('mock-sess-')),
    );
    assert.equal(sessionIds.size, 1, `只应有一个会话，实际：${[...sessionIds].join(',')}`);

    const loaded = await env.store.load('INST-001');
    assert.equal(loaded.state.state, 'completed');
  } finally {
    await env.teardown();
  }
});

test('DSH_SPAWN_FAILED：拉起失败后不落 state.json（无半截实例）', async () => {
  const env = await setup({
    command: path.join(os.tmpdir(), 'maestro-wp4-missing-binary.exe'),
    args: [],
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: '保存到 out/x.md' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'DSH_SPAWN_FAILED');
    assert.equal(typeof result.params.cause, 'string');

    const listed = await env.store.list();
    assert.deepEqual(listed.items, []);
    assert.deepEqual(env.events, []);
  } finally {
    await env.teardown();
  }
});

test('VERIFY_FAILED：未写产出 → 节点/实例 failed，交接包停在 accepted', async () => {
  const env = await setup({ switches: [] });
  try {
    const task = '写一段 200 字的产品说明，保存到 out/intro.md';
    const result = await env.orch.startRun({ cwd: env.cwd, task });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VERIFY_FAILED');
    assert.equal(result.params.reason, '未找到声明的产出 out/intro.md');

    const loaded = await env.store.load('INST-001');
    const state = loaded.state;
    assert.equal(state.node.state, 'failed');
    assert.equal(state.state, 'failed');
    assert.equal(state.handoff.state, 'accepted');
    assert.notEqual(state.handoff.state, 'consumed');
    assert.equal(state.node.failure.code, 'MISSING');
    assert.equal(fs.existsSync(path.join(env.cwd, 'out', 'intro.md')), false);
  } finally {
    await env.teardown();
  }
});

test('cancel：立即落三对象终态，不等宿主（turn-delay 10s）', async () => {
  const env = await setup({ switches: ['--turn-delay-ms', '10000'] });
  try {
    const running = env.orch.startRun({ cwd: env.cwd, task: '长任务' });
    await waitFor(() => env.events.some((e) => e.object === 'handoff' && e.to === 'delivered'));

    const startedAt = Date.now();
    const cancelled = await env.orch.cancel({ instanceId: 'INST-001' });
    const elapsed = Date.now() - startedAt;
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.ok(elapsed < 3000, `cancel 应快速返回，实际 ${elapsed}ms`);

    const loaded = await env.store.load('INST-001');
    const state = loaded.state;
    assert.equal(state.session.state, 'idle');
    assert.equal(state.node.state, 'cancelled');
    assert.equal(state.handoff.state, 'rejected');
    assert.equal(state.handoff.rejectReason, 'withdrawn');
    assert.equal(state.state, 'cancelled');

    const firstResult = await running;
    assert.equal(firstResult.cancelled, true);

    const again = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(again.ok, false);
    assert.equal(again.code, 'INSTANCE_TERMINAL');
  } finally {
    await env.teardown();
  }
});

test('getStatus：派生字段（elapsedMs / sessionStalled / handoffWaitMs）与 NOT_FOUND', async () => {
  const env = await setup();
  try {
    const nowMs = Date.now();
    const old = new Date(nowMs - 20_000).toISOString();
    const at = new Date(nowMs).toISOString();
    const seeded = {
      schemaVersion: 1,
      instanceId: 'INST-003',
      coreGeneration: 'gen-wp4',
      createdAt: old,
      updatedAt: at,
      state: 'running',
      stateSince: old,
      cwd: env.cwd,
      task: '执行中',
      roleId: 'worker',
      node: { nodeId: 'T-001', state: 'running', stateSince: old, startedAt: old, endedAt: null, failure: null, note: null },
      session: {
        sessionId: 'sess-live',
        hostId: 'dsh',
        state: 'thinking',
        stateSince: old,
        createdAt: old,
        lastEventAt: old,
        toolName: null,
        turnId: 'turn-1',
        pendingPermission: null,
        quarantined: false,
      },
      handoff: { handoffId: 'HO-001', state: 'delivered', createdAt: old, deliveredAt: old },
      artifactRefs: [],
      hostRaw: {},
      counters: { eventSeq: 0, runCount: 1 },
    };
    assert.equal((await env.store.save('INST-003', seeded)).ok, true);

    const status = await env.orch.getStatus({ instanceId: 'INST-003' });
    assert.equal(status.ok, true);
    assert.ok(status.snapshot.elapsedMs >= 19_000);
    assert.equal(status.snapshot.sessionStalled, true);
    assert.ok(status.snapshot.sessionIdleMs >= 19_000);
    assert.ok(status.snapshot.handoffWaitMs >= 19_000);

    const missing = await env.orch.getStatus({ instanceId: 'INST-404' });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'NOT_FOUND');

    const listed = await env.orch.listInstances();
    assert.equal(listed.ok, true);
    assert.equal(listed.items.some((item) => item.instanceId === 'INST-003'), true);
  } finally {
    await env.teardown();
  }
});

test('reconcileOnBoot：旧 generation 的运行中实例 → interrupted，节点保持原状态', async () => {
  const env = await setup();
  try {
    const at = new Date().toISOString();
    const seeded = {
      schemaVersion: 1,
      instanceId: 'INST-009',
      coreGeneration: 'gen-old',
      createdAt: at,
      updatedAt: at,
      state: 'running',
      stateSince: at,
      cwd: env.cwd,
      task: '写点什么',
      roleId: 'worker',
      node: {
        nodeId: 'T-001',
        state: 'running',
        stateSince: at,
        startedAt: at,
        endedAt: null,
        failure: null,
        note: null,
      },
      session: {
        sessionId: 'sess-old',
        hostId: 'dsh',
        state: 'thinking',
        stateSince: at,
        createdAt: at,
        lastEventAt: at,
        toolName: null,
        turnId: 'turn-1',
        pendingPermission: null,
        quarantined: false,
      },
      handoff: {
        handoffId: 'HO-001',
        state: 'delivered',
        createdAt: at,
        deliveredAt: at,
      },
      artifactRefs: [],
      hostRaw: {},
      counters: { eventSeq: 0, runCount: 1 },
    };
    const saved = await env.store.save('INST-009', seeded);
    assert.equal(saved.ok, true);

    const result = await env.orch.reconcileOnBoot({ generation: 'gen-wp4' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.interrupted, ['INST-009']);

    const loaded = await env.store.load('INST-009');
    assert.equal(loaded.state.state, 'interrupted');
    assert.equal(loaded.state.node.state, 'running');
    assert.equal(loaded.state.handoff.state, 'delivered');
    assert.match(loaded.state.node.note, /stopped at node running/);

    const read = await env.store.readEvents('INST-009');
    const gone = read.events.filter((e) => e.reason === 'core.gone');
    assert.equal(gone.length >= 1, true);
    assert.equal(gone[0].from, 'running');
    assert.equal(gone[0].to, 'interrupted');
  } finally {
    await env.teardown();
  }
});
