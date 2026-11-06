import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createNormalizer } from '../../src/adapter/session-state.js';
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

const CODE_TASK = '给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js';

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await sleep(intervalMs);
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

/** 夹具工厂：走真实的 stdio transport + acp-client（single 回归用）。 */
function makeMockFactory({ switches = [], command = process.execPath, args = null } = {}) {
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

/**
 * 多节点夹具：每次派发一个“会话”，按脚本顺序执行（写产物 / 写判定 / 报错 / 挂住）。
 * 走的是产品侧的 adapterFactory 注入点，不碰磁盘上的 state.json。
 */
function makeScriptedFactory(script, { deferFirstUpdateMs = 0 } = {}) {
  let index = 0;
  const prompts = [];
  const sessionHolds = [];
  const factory = {
    prompts,
    /** 已进入 `newSession` 且尚未返回的会话数（BLK-C1：首派未返回的时刻）。 */
    get sessionHeld() {
      return sessionHolds.length;
    },
    releaseSessions() {
      for (const release of sessionHolds.splice(0)) release();
    },
    async create({ cwd }) {
      const step = script[index] ?? {};
      const ordinal = index + 1;
      index += 1;
      const sessionId = `fake-sess-${ordinal}`;
      let updateCb = () => {};
      let rejectHold = null;
      return {
        sessionId,
        async initialize() {
          if (step.initFail) {
            return { ok: false, error: { code: 'DSH_SPAWN_FAILED', message: '初始化失败' } };
          }
          return { ok: true };
        },
        async newSession() {
          if (step.sessionFail) {
            return { ok: false, error: { code: 'DSH_SPAWN_FAILED', message: '会话不可用' } };
          }
          if (step.holdSession) {
            // 模拟「session/new 尚未返回」：目录锁仍被首个发起持有。
            await new Promise((resolve) => sessionHolds.push(resolve));
          }
          return { ok: true, result: { sessionId } };
        },
        async prompt(_sessionId, blocks) {
          prompts.push({ ordinal, text: blocks?.[0]?.text ?? '' });
          if (step.hold) {
            return new Promise((resolve, reject) => {
              rejectHold = reject;
              void resolve;
            });
          }
          await sleep(step.delayMs ?? 0);
          if (step.error) {
            return { ok: false, error: { code: -32603, message: '宿主错误：boom' } };
          }
          // 真实宿主不会在 `prompt()` 里同步吐帧：`handoff.delivered` 必须在首个帧之前
          // 落盘，否则 `delivered → accepted` 的顺序会被测试自己打乱（task-loop 需要它）。
          if (deferFirstUpdateMs > 0) await sleep(deferFirstUpdateMs);
          updateCb({ sessionId, update: { sessionUpdate: 'agent_thought_chunk' } });
          if (step.write) {
            // 绝对路径原样使用：`doc-single` 的产落在实例工作区（不在会话 cwd），
            // 提示词里给的就是绝对 `写入路径：`（D-8）。
            const target = path.isAbsolute(step.write) ? step.write : path.join(cwd, step.write);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, step.content ?? 'module.exports = {};\n', 'utf8');
          }
          if (step.review) {
            // 审核文件固定落在会话 cwd 的 `out/review.json`（D-7 / `REVIEW_PATH`）。
            // 传字符串时原样写入，用来造「不可解析」；不传 review 即「文件缺失」。
            const target = path.join(cwd, 'out', 'review.json');
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(
              target,
              typeof step.review === 'string' ? step.review : JSON.stringify(step.review),
              'utf8',
            );
          }
          if (step.verdict) {
            const target = path.join(cwd, 'out', 'verdict.json');
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, JSON.stringify(step.verdict), 'utf8');
          }
          if (step.evidence) {
            const target = path.join(cwd, step.evidence);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, 'log', 'utf8');
          }
          return { ok: true, result: { stopReason: 'end_turn' } };
        },
        async cancel() {
          if (rejectHold) rejectHold(new Error('cancelled'));
          return { ok: true };
        },
        onUpdate(cb) {
          updateCb = cb;
        },
        async dispose() {},
      };
    },
  };
  return factory;
}

function buildOrch({ root, cwd, factory, env = {}, generation = 'gen-wp4' }) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const events = [];
  bus.subscribe((event) => events.push(event));
  const orch = createOrchestrator({
    store,
    bus,
    adapterFactory: factory,
    generation,
    env,
  });
  return { root, cwd, store, bus, orch, events };
}

async function setupMock(options = {}) {
  const root = tmpDir('maestro-wp4-root-');
  const cwd = tmpDir('maestro-wp4-cwd-');
  const result = buildOrch({ root, cwd, factory: makeMockFactory(options) });
  return {
    ...result,
    async teardown() {
      try {
        await result.orch.dispose();
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

async function setupFake({ script = [], env = {}, factory: injected = null } = {}) {
  const root = tmpDir('maestro-wp4-loop-root-');
  const cwd = tmpDir('maestro-wp4-loop-cwd-');
  const factory = injected ?? makeScriptedFactory(script);
  const result = buildOrch({ root, cwd, factory, env });
  return {
    ...result,
    factory,
    async teardown() {
      try {
        await result.orch.dispose();
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
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

function passStep() {
  return { write: 'calc.js' };
}

function testPassStep() {
  return { evidence: 'out/test-log.txt', verdict: { verdict: 'pass', defects: [] } };
}

function testFailStep() {
  return {
    evidence: 'out/test-log.txt',
    verdict: {
      verdict: 'fail',
      defects: [{ summary: 'div 在除数为 0 时返回 Infinity，未抛错', evidence: 'out/test-log.txt' }],
    },
  };
}

// ---------------------------------------------------------------- single 回归

test('single happy path：9 步顺序正确，终态 completed / done / consumed / idle', async () => {
  const env = await setupMock({ switches: ['--write-ref', 'out/intro.md'] });
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
    assert.equal(state.schemaVersion, 2);
    assert.equal(state.nodes.length, 1);
    assert.equal(state.nodes[0].nodeId, 'T-001');
    assert.equal(state.nodes[0].roleId, 'worker');
    assert.equal(state.nodes[0].state, 'done');
    assert.equal(state.handoffs.length, 1);
    assert.equal(state.handoffs[0].handoffId, 'HO-001');
    assert.equal(state.handoffs[0].state, 'consumed');
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].state, 'idle');
    assert.equal(state.nodes[0].artifactRefs.length, 1);
    assert.equal(state.nodes[0].artifactRefs[0].ref, 'out/intro.md');
    assert.equal(state.nodes[0].artifactRefs[0].sha256, null);
    assert.equal(fs.existsSync(path.join(env.cwd, 'out', 'intro.md')), true);
  } finally {
    await env.teardown();
  }
});

test('NODE_BUSY：同一实例并发发起不建第二个会话', async () => {
  const env = await setupMock({ switches: ['--turn-delay-ms', '3000'] });
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
  const env = await setupMock({
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
  const env = await setupMock({ switches: [] });
  try {
    const task = '写一段 200 字的产品说明，保存到 out/intro.md';
    const result = await env.orch.startRun({ cwd: env.cwd, task });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'VERIFY_FAILED');
    assert.equal(result.params.reason, '未找到声明的产出 out/intro.md');

    const loaded = await env.store.load('INST-001');
    const state = loaded.state;
    assert.equal(state.nodes[0].state, 'failed');
    assert.equal(state.state, 'failed');
    assert.equal(state.handoffs[0].state, 'accepted');
    assert.notEqual(state.handoffs[0].state, 'consumed');
    assert.equal(state.nodes[0].failure.code, 'MISSING');
    assert.equal(fs.existsSync(path.join(env.cwd, 'out', 'intro.md')), false);
  } finally {
    await env.teardown();
  }
});

test('cancel：立即落终态（数组结果），不等宿主（turn-delay 10s）', async () => {
  const env = await setupMock({ switches: ['--turn-delay-ms', '10000'] });
  try {
    const running = env.orch.startRun({ cwd: env.cwd, task: '长任务' });
    await waitFor(() => env.events.some((e) => e.object === 'handoff' && e.to === 'delivered'));

    const startedAt = Date.now();
    const cancelled = await env.orch.cancel({ instanceId: 'INST-001' });
    const elapsed = Date.now() - startedAt;
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    assert.ok(elapsed < 3000, `cancel 应快速返回，实际 ${elapsed}ms`);
    assert.equal(Array.isArray(cancelled.nodes), true);
    assert.equal(Array.isArray(cancelled.sessions), true);
    assert.equal(Array.isArray(cancelled.handoffs), true);
    assert.equal(Array.isArray(cancelled.escalations), true);

    const loaded = await env.store.load('INST-001');
    const state = loaded.state;
    assert.equal(state.sessions[0].state, 'idle');
    assert.equal(state.nodes[0].state, 'cancelled');
    assert.equal(state.handoffs[0].state, 'rejected');
    assert.equal(state.handoffs[0].rejectReason, 'withdrawn');
    assert.equal(state.state, 'cancelled');

    const firstResult = await running;
    assert.equal(firstResult.cancelled, true);

    const again = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(again.ok, false);
    assert.equal(again.code, 'CANCEL_NOT_NEEDED');
  } finally {
    await env.teardown();
  }
});

test('getStatus：派生字段（elapsedMs / sessionStalled / handoffWaitMs）与 NOT_FOUND', async () => {
  const env = await setupMock();
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

test('reconcileOnBoot：v2 旧 generation 的运行中实例 → interrupted；v1 保持原样', async () => {
  const env = await setupMock();
  try {
    const at = new Date().toISOString();
    const v2 = {
      schemaVersion: 2,
      instanceId: 'INST-009',
      coreGeneration: 'gen-old',
      createdAt: at,
      updatedAt: at,
      state: 'running',
      stateSince: at,
      template: 'single',
      cwd: env.cwd,
      task: '写点什么',
      halted: false,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
      nodes: [
        {
          nodeId: 'T-001',
          roleId: 'worker',
          round: 1,
          state: 'running',
          stateSince: at,
          startedAt: at,
          roundStartedAt: at,
          endedAt: null,
          failure: null,
          note: null,
          verdict: null,
          sessionId: 'sess-old',
          artifactRefs: [],
        },
      ],
      sessions: [
        {
          sessionId: 'sess-old',
          nodeId: 'T-001',
          round: 1,
          hostId: 'dsh',
          state: 'thinking',
          stateSince: at,
          createdAt: at,
          lastEventAt: at,
          toolName: null,
          turnId: 'turn-1',
          artifactRef: null,
          pendingPermission: null,
          quarantined: false,
        },
      ],
      handoffs: [
        {
          handoffId: 'HO-001',
          edge: null,
          state: 'delivered',
          createdAt: at,
          deliveredAt: at,
          acceptedAt: null,
          consumedAt: null,
          rejectedAt: null,
          rejectReason: null,
          wakeConsumedAt: null,
          acceptedSignal: null,
          ambiguityWindowMs: null,
          defects: [],
          note: null,
        },
      ],
      escalations: [],
    };
    assert.equal((await env.store.save('INST-009', v2)).ok, true);

    const legacy = {
      ...v2,
      schemaVersion: 1,
      instanceId: 'INST-010',
      coreGeneration: 'gen-old',
      node: v2.nodes[0],
      session: v2.sessions[0],
      handoff: v2.handoffs[0],
    };
    delete legacy.nodes;
    delete legacy.sessions;
    delete legacy.handoffs;
    delete legacy.template;
    delete legacy.halted;
    assert.equal((await env.store.save('INST-010', legacy)).ok, true);
    const legacyBefore = fs.readFileSync(
      path.join(env.root, '.orch', 'instances', 'INST-010', 'state.json'),
      'utf8',
    );

    const result = await env.orch.reconcileOnBoot({ generation: 'gen-wp4' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.interrupted, ['INST-009']);

    const loaded = await env.store.load('INST-009');
    assert.equal(loaded.state.state, 'interrupted');
    assert.equal(loaded.state.nodes[0].state, 'running');
    assert.match(loaded.state.nodes[0].note, /stopped at node running/);

    const read = await env.store.readEvents('INST-009');
    const gone = read.events.filter((e) => e.reason === 'core.gone');
    assert.equal(gone.length >= 1, true);
    assert.equal(gone[0].from, 'running');
    assert.equal(gone[0].to, 'interrupted');

    const legacyAfter = fs.readFileSync(
      path.join(env.root, '.orch', 'instances', 'INST-010', 'state.json'),
      'utf8',
    );
    assert.equal(legacyAfter, legacyBefore, 'v1 实例必须一字不改');
  } finally {
    await env.teardown();
  }
});

test('v1 实例：startRun / cancel 都返回 LEGACY_READ_ONLY', async () => {
  const env = await setupMock();
  try {
    const at = new Date().toISOString();
    const legacy = {
      schemaVersion: 1,
      instanceId: 'INST-020',
      coreGeneration: 'gen-old',
      createdAt: at,
      updatedAt: at,
      state: 'running',
      stateSince: at,
      cwd: env.cwd,
      task: '老任务',
      roleId: 'worker',
      node: { nodeId: 'T-001', state: 'pending', stateSince: at, startedAt: null, endedAt: null, failure: null, note: null },
      session: null,
      handoff: null,
      artifactRefs: [],
      hostRaw: {},
      counters: { eventSeq: 0, runCount: 1 },
    };
    assert.equal((await env.store.save('INST-020', legacy)).ok, true);

    const resumed = await env.orch.startRun({
      cwd: env.cwd,
      task: '再来一次',
      instanceId: 'INST-020',
    });
    assert.equal(resumed.ok, false);
    assert.equal(resumed.code, 'LEGACY_READ_ONLY');

    const cancelled = await env.orch.cancel({ instanceId: 'INST-020' });
    assert.equal(cancelled.ok, false);
    assert.equal(cancelled.code, 'LEGACY_READ_ONLY');
  } finally {
    await env.teardown();
  }
});

// ---------------------------------------------------------------- code-loop

test('code-loop 一轮通过：T-001 → T-002 → 实例 completed（AC-03：只有 1 张交接包）', async () => {
  const env = await setupFake({ script: [passStep(), testPassStep()] });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'completed');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.template, 'code-loop');
    assert.equal(state.nodes.length, 2);
    assert.deepEqual(state.nodes.map((n) => n.nodeId), ['T-001', 'T-002']);
    assert.equal(state.nodes[0].state, 'done');
    assert.equal(state.nodes[0].round, 1);
    assert.equal(state.nodes[1].state, 'done');
    assert.equal(state.nodes[1].round, 1);
    assert.equal(state.nodes[1].verdict.value, 'pass');
    // AC-03 固定为“恰好 1 条”，与“3 张”只出现在回流路径。
    assert.equal(state.handoffs.length, 1);
    assert.equal(state.handoffs[0].handoffId, 'HO-001');
    assert.equal(state.handoffs[0].edge.kind, 'forward');
    assert.equal(state.handoffs[0].state, 'consumed');
    assert.equal(state.sessions.length, 2);
    assert.notEqual(state.sessions[0].sessionId, state.sessions[1].sessionId);

    const list = transitions(env.events);
    assertSubsequence(list, [
      'instance:created->running',
      'node:pending->running',
      'node:running->review',
      'node:review->done',
      'node:pending->running',
      'handoff:created->delivered',
      'node:running->review',
      'node:review->done',
      'handoff:accepted->consumed',
      'instance:running->completed',
    ]);

    const dispatches = env.events.filter((e) => e.reason === 'node.dispatch');
    assert.deepEqual(
      dispatches.map((e) => [e.objectId, e.detail.round, e.detail.roleId]),
      [
        ['T-001', 1, 'developer'],
        ['T-002', 1, 'tester'],
      ],
    );

    // 第二轮派发必须是新会话，且正向包把任务与产物带到下游。
    assert.ok(env.factory.prompts[1].text.includes('产物：calc.js') || env.factory.prompts[1].text.includes('calc.js'));
    assert.ok(env.factory.prompts[1].text.includes('out/verdict.json'));
  } finally {
    await env.teardown();
  }
});

test('code-loop 回流：第 1 轮不通过 → 开发第 2 轮 → 复测通过 → completed（3 张交接包）', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testPassStep()],
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'completed');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.nodes[0].state, 'done');
    assert.equal(state.nodes[0].round, 2);
    assert.equal(state.nodes[1].state, 'done');
    assert.equal(state.nodes[1].round, 2);
    assert.equal(state.handoffs.length, 3);
    assert.deepEqual(
      state.handoffs.map((h) => h.handoffId),
      ['HO-001', 'HO-002', 'HO-003'],
    );
    assert.deepEqual(
      state.handoffs.map((h) => h.edge.kind),
      ['forward', 'backflow', 'retest'],
    );
    assert.equal(
      state.handoffs.every((h) => h.state === 'consumed'),
      true,
    );
    const backflow = state.handoffs[1];
    assert.equal(backflow.defects.length, 1);
    assert.equal(backflow.defects[0].evidence, 'out/test-log.txt');
    assert.ok(backflow.wakeConsumedAt);
    assert.equal(state.escalations.length, 0);
    assert.equal(state.halted, false);

    // 回流包把缺陷与证据交给开发，复测包带上一轮缺陷条数。
    assert.ok(env.factory.prompts[2].text.includes('div 在除数为 0 时返回 Infinity'));
    assert.ok(env.factory.prompts[2].text.includes('out/test-log.txt'));
    assert.ok(env.factory.prompts[3].text.includes('上一轮缺陷：1 条'));

    const list = transitions(env.events);
    assertSubsequence(list, [
      'node:review->done',
      'node:review->failed',
      'node:done->running',
      'handoff:created->delivered',
      'node:running->review',
      'node:review->done',
      'node:failed->running',
      'handoff:created->delivered',
      'node:running->review',
      'node:review->done',
      'instance:running->completed',
    ]);
  } finally {
    await env.teardown();
  }
});

test('code-loop 上限：第 2 轮仍不通过 → 节点 escalated / 实例 suspended / 3 张包 consumed', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testFailStep()],
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'suspended');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'suspended');
    assert.equal(state.halted, false);
    assert.equal(state.nodes[0].state, 'done');
    assert.equal(state.nodes[0].round, 2);
    assert.equal(state.nodes[1].state, 'escalated');
    assert.equal(state.nodes[1].round, 2);
    assert.equal(state.nodes[1].endedAt !== null, true);
    assert.equal(state.handoffs.length, 3);
    assert.equal(
      state.handoffs.every((h) => h.state === 'consumed'),
      true,
    );
    assert.equal(state.escalations.length, 1);
    assert.equal(state.escalations[0].escalationId, 'ESC-001');
    assert.equal(state.escalations[0].nodeId, 'T-002');
    assert.equal(state.escalations[0].round, 2);
    assert.equal(state.escalations[0].state, 'pending');
    assert.equal(state.escalations[0].reasonCode, 'rounds_exceeded');
    assert.equal(state.escalations[0].reasonDetail, '回流超上限：测试已派发 2 次仍未通过');
    assert.equal(state.escalations[0].defects.length, 1);

    // AC-07：T-002 必须 review → escalated，且没有第 3 轮。
    const events = (await env.store.readEvents('INST-001')).events;
    const nodeEvents = events.filter((e) => e.object === 'node' && e.objectId === 'T-002');
    assert.equal(
      nodeEvents.some((e) => e.from === 'review' && e.to === 'escalated'),
      true,
    );
    assert.equal(
      nodeEvents.some((e) => e.from === 'running' && e.to === 'escalated'),
      false,
    );
    assert.equal(state.nodes.some((n) => n.round > 2), false);

    // AC-39：会话 final state = escalated。
    const testerSession = state.sessions[state.sessions.length - 1];
    assert.equal(testerSession.state, 'escalated');
    assert.equal(testerSession.quarantined, true);

    // 取消：已升级节点也收掉，升级作废。
    const cancelled = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    const after = (await env.store.load('INST-001')).state;
    assert.equal(after.state, 'cancelled');
    assert.equal(after.nodes[1].state, 'cancelled');
    assert.equal(after.nodes[0].state, 'done');
    assert.equal(after.escalations[0].state, 'voided');
    assert.equal(
      after.handoffs.every((h) => h.state === 'consumed'),
      true,
    );
  } finally {
    await env.teardown();
  }
});

test('code-loop 取消优先：after_verdict 停住时取消，回流包 created → rejected(withdrawn)', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testPassStep()],
    env: { NODE_ENV: 'test', MAESTRO_TEST_PAUSE: 'after_verdict' },
  });
  try {
    const started = await env.orch.startRun({
      cwd: env.cwd,
      task: CODE_TASK,
      template: 'code-loop',
      earlyReturn: true,
    });
    assert.equal(started.ok, true, JSON.stringify(started));
    await waitFor(() => exists(path.join(env.root, '.mock', 'paused')));

    const cancelled = await env.orch.cancel({ instanceId: 'INST-001' });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));
    fs.writeFileSync(path.join(env.root, '.mock', 'release'), 'ok', 'utf8');

    const waited = await env.orch.waitForRun({ instanceId: 'INST-001', timeoutMs: 10_000 });
    assert.equal(waited.ok, true, JSON.stringify(waited));

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'cancelled');
    assert.equal(state.nodes[0].state, 'done');
    assert.equal(state.nodes[0].round, 1, '开发不得被回流拉起');
    const backflow = state.handoffs.find((h) => h.edge && h.edge.kind === 'backflow');
    assert.ok(backflow, '应存在回流交接包');
    assert.equal(backflow.state, 'rejected');
    assert.equal(backflow.rejectReason, 'withdrawn');

    const events = (await env.store.readEvents('INST-001')).events;
    assert.equal(
      events.some((e) => e.reason === 'handoff.rejected' && e.detail?.reason === 'withdrawn'),
      true,
    );
  } finally {
    await env.teardown();
  }
});

test('code-loop 派发失败：目标会话建不起来 → 目标节点 escalated / 实例 suspended（round 已 +1）', async () => {
  const env = await setupFake({
    script: [passStep(), { sessionFail: true }],
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'suspended');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'suspended');
    assert.equal(state.nodes[1].state, 'escalated');
    assert.equal(state.nodes[1].round, 1);
    assert.equal(state.escalations[0].reasonCode, 'dispatch_failed');
    assert.equal(state.escalations[0].reasonDetail, '派遣失败：目标会话不可用');
    assert.equal(state.sessions.length, 1, '建会话失败不得留下会话记录');

    const events = (await env.store.readEvents('INST-001')).events;
    const dispatches = events.filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-002');
    assert.equal(dispatches.length, 1, '失败派发只记一次 node.dispatch');
    assert.equal(dispatches[0].detail.round, 1);
  } finally {
    await env.teardown();
  }
});

test('code-loop DIR_BUSY：同目录第二个闭环被拒', async () => {
  const env = await setupFake({ script: [{ hold: true }] });
  try {
    const started = await env.orch.startRun({
      cwd: env.cwd,
      task: CODE_TASK,
      template: 'code-loop',
      earlyReturn: true,
    });
    assert.equal(started.ok, true, JSON.stringify(started));

    const second = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(second.ok, false);
    assert.equal(second.code, 'DIR_BUSY');
    assert.equal(second.params.instanceId, 'INST-001');

    const listed = await env.store.list();
    assert.equal(listed.items.length, 1);

    await env.orch.cancel({ instanceId: 'INST-001' });
  } finally {
    await env.teardown();
  }
});

test('code-loop DIR_BUSY：首个实例停在首派 session/new 未返回时，同目录并发发起 2s 内被拒（BLK-C1）', async () => {
  const env = await setupFake({ factory: makeScriptedFactory([{ holdSession: true }]) });
  const first = env.orch.startRun({
    cwd: env.cwd,
    task: CODE_TASK,
    template: 'code-loop',
  });
  first.catch(() => {});
  try {
    const stateFile = path.join(env.root, '.orch', 'instances', 'INST-001', 'state.json');
    await waitFor(() => env.factory.sessionHeld === 1 && exists(stateFile));

    // Given 机检：首派已把实例落盘为 running，但 newSession 仍未返回（目录锁仍被持有）
    const live = (await env.store.load('INST-001')).state;
    assert.equal(live.state, 'running');
    assert.equal(env.factory.sessionHeld, 1, '首派应仍未返回');

    // When 同目录第二次发起
    const at = Date.now();
    const second = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    const elapsed = Date.now() - at;

    // Then 2 秒内返回既有 DIR_BUSY 语义，且不新建实例
    assert.ok(elapsed < 2000, `第二次发起耗时 ${elapsed}ms，应 < 2000ms`);
    assert.equal(second.ok, false);
    assert.equal(second.code, 'DIR_BUSY');
    assert.equal(second.params.instanceId, 'INST-001');

    const listed = await env.store.list();
    assert.deepEqual(
      listed.items.map((item) => item.instanceId),
      ['INST-001'],
    );
    assert.equal(exists(path.join(env.root, '.orch', 'instances', 'INST-002')), false);
  } finally {
    env.factory.releaseSessions();
    await env.orch.cancel({ instanceId: 'INST-001' });
    await env.teardown();
  }
});

test('code-loop 发起前拦截：未知模板 / 空任务 / 缺产物行', async () => {
  const env = await setupFake({ script: [] });
  try {
    const unknown = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'no-such' });
    assert.equal(unknown.code, 'TEMPLATE_UNKNOWN');

    const empty = await env.orch.startRun({ cwd: env.cwd, task: '   ', template: 'code-loop' });
    assert.equal(empty.code, 'TASK_EMPTY');

    const missing = await env.orch.startRun({ cwd: env.cwd, task: '给 calc.js 补 div', template: 'code-loop' });
    assert.equal(missing.code, 'PRODUCT_LINE_MISSING');

    const listed = await env.store.list();
    assert.deepEqual(listed.items, []);
  } finally {
    await env.teardown();
  }
});

test('code-loop 停止推进：升级写入故障 → halted=true，节点保持 review（不假装挂起）', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testFailStep()],
    env: { NODE_ENV: 'test', MAESTRO_FAULT: 'state_write:escalation' },
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'running');
    assert.equal(result.snapshot.halted, true);

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'running');
    assert.equal(state.halted, true);
    assert.equal(state.escalations.length, 0);
    assert.equal(state.nodes[1].state, 'review');
    assert.equal(state.nodes[1].round, 2);

    const events = (await env.store.readEvents('INST-001')).events;
    assert.equal(events.some((e) => e.reason === 'run.halted'), true);
  } finally {
    await env.teardown();
  }
});

// ---------------------------------------------------------------- 测试接缝

test('接缝：仅 NODE_ENV=test 导出 dispatchToNode / escalateOnce，生产对象没有这两个键', async () => {
  const devEnv = await setupFake({ script: [], env: {} });
  try {
    assert.equal(typeof devEnv.orch.dispatchToNode, 'undefined');
    assert.equal(typeof devEnv.orch.escalateOnce, 'undefined');
  } finally {
    await devEnv.teardown();
  }

  const testEnv = await setupFake({ script: [], env: { NODE_ENV: 'test' } });
  try {
    assert.equal(typeof testEnv.orch.dispatchToNode, 'function');
    assert.equal(typeof testEnv.orch.escalateOnce, 'function');
  } finally {
    await testEnv.teardown();
  }
});

test('接缝 dispatchToNode：无待唤醒回流包 → WAKE_REJECTED(NO_PENDING_BACKFLOW) 且轮次不变', async () => {
  const env = await setupFake({
    script: [passStep(), testPassStep()],
    env: { NODE_ENV: 'test' },
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    const before = (await env.store.load('INST-001')).state;

    const rejected = await env.orch.dispatchToNode('INST-001', 'T-001');
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, 'WAKE_REJECTED');
    assert.equal(rejected.detail.code, 'NO_PENDING_BACKFLOW');

    const after = (await env.store.load('INST-001')).state;
    assert.equal(after.nodes[0].state, before.nodes[0].state);
    assert.equal(after.nodes[0].round, before.nodes[0].round);
    assert.equal(after.sessions.length, before.sessions.length);

    const events = (await env.store.readEvents('INST-001')).events;
    assert.equal(
      events.some((e) => e.reason === 'wake.rejected' && e.detail?.code === 'NO_PENDING_BACKFLOW'),
      true,
    );
  } finally {
    await env.teardown();
  }
});

test('接缝 escalateOnce：同 (nodeId, round) 幂等复用 ESC-001', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testFailStep()],
    env: { NODE_ENV: 'test' },
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });

    const first = await env.orch.escalateOnce('INST-001', 'T-002');
    assert.equal(first.ok, true, JSON.stringify(first));
    assert.equal(first.escalationId, 'ESC-001');
    assert.equal(first.reused, true);

    const second = await env.orch.escalateOnce('INST-001', 'T-002');
    assert.equal(second.ok, true, JSON.stringify(second));
    assert.equal(second.escalationId, 'ESC-001');
    assert.equal(second.reused, true);

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.escalations.length, 1);
  } finally {
    await env.teardown();
  }
});

test('会话守卫：进入 escalated 后除取消外任何输入都保持 escalated（C-08 / AC-39）', () => {
  const normalizer = createNormalizer({ clock: () => 1000 });
  normalizer.onPromptSent('s1', 'turn-1');
  normalizer.onEscalated('s1');
  assert.equal(normalizer.getSession('s1').state, 'escalated');
  assert.equal(normalizer.getSession('s1').quarantined, true);

  const reduced = normalizer.reduce({ sessionId: 's1', state: 'escalated' }, { sessionUpdate: 'agent_message_chunk' });
  assert.equal(reduced.dropped, true);
  assert.equal(normalizer.stateOf('s1'), 'escalated');

  normalizer.onPermissionSettled({ sessionId: 's1', decision: 'allow' });
  normalizer.onPromptSettled('s1', { stopReason: 'end_turn' });
  normalizer.onPermissionRequested({ sessionId: 's1', toolCallId: 't1', action: 'write' });
  assert.equal(normalizer.stateOf('s1'), 'escalated');

  normalizer.onCancelled('s1');
  assert.equal(normalizer.stateOf('s1'), 'idle');
});

test('handoffToState 白名单：edge / defects / note / wakeConsumedAt 不被 update 抹掉', async () => {
  const env = await setupFake({
    script: [passStep(), testFailStep(), passStep(), testPassStep()],
  });
  try {
    await env.orch.startRun({ cwd: env.cwd, task: CODE_TASK, template: 'code-loop' });
    const state = (await env.store.load('INST-001')).state;
    const backflow = state.handoffs.find((h) => h.edge && h.edge.kind === 'backflow');
    assert.ok(backflow);
    assert.equal(Array.isArray(backflow.defects), true);
    assert.equal(backflow.defects.length, 1);
    assert.equal(typeof backflow.wakeConsumedAt, 'string');
    assert.equal('note' in backflow, true);
  } finally {
    await env.teardown();
  }
});

// ---------------------------------------------------------------- task-loop（I1.3 / WP-3）

const DOC_TASK = '写一篇发布说明，覆盖背景、变更与回滚方案。\n产物：release-notes.md';

const RESEARCH_TEXT = '# 研究笔记\n\n## 背景\n本次发布整理三处修复。\n';

function docText(round) {
  return `# 发布说明 v${round}\n\n## 背景\n本次发布整理三处修复。\n`;
}

/** 实例工作区里的三个固定位置（D-8）：研究笔记固定 v1，文档按轮次带版本号。 */
function docPaths(root) {
  const workspace = path.join(root, '.orch', 'instances', 'INST-001', 'workspace');
  return {
    workspace,
    research: path.join(workspace, 'artifacts', 'reports', 'research-notes.v1.md'),
    doc: (round) => path.join(workspace, 'artifacts', 'docs', `release-notes.v${round}.md`),
  };
}

function researchStep(root) {
  return { write: docPaths(root).research, content: RESEARCH_TEXT };
}

function writeStep(root, round) {
  return { write: docPaths(root).doc(round), content: docText(round) };
}

function passReview(round = 1) {
  return {
    review: {
      decision: 'pass',
      artifact: `artifacts/docs/release-notes.v${round}.md`,
      defects: [],
      revisionRequirement: '',
    },
  };
}

function rejectReview(round = 1) {
  return {
    review: {
      decision: 'reject',
      artifact: `artifacts/docs/release-notes.v${round}.md`,
      defects: [
        { summary: '缺少回滚方案', evidence: `artifacts/docs/release-notes.v${round}.md#L1` },
        { summary: '升级步骤缺少验证', evidence: `artifacts/docs/release-notes.v${round}.md#L2` },
      ],
      revisionRequirement: '补写「回滚方案」一节',
    },
  };
}

/**
 * 逐次 `saveState` 的快照账本。用来证明「门控一次 CAS」：不可观察的中间态不许出现，
 * 且 `review(downstream) → done` 与 `handoff accepted` 必须落在同一次写入里。
 */
function trackSaves(store) {
  const log = [];
  const original = store.save.bind(store);
  store.save = async (instanceId, state, options) => {
    const result = await original(instanceId, state, options);
    if (result?.ok) {
      const nodes = state.nodes ?? [];
      log.push({
        rev: result.rev,
        instance: state.state,
        nodes: Object.fromEntries(nodes.map((node) => [node.nodeId, node.state])),
        handoffs: Object.fromEntries((state.handoffs ?? []).map((h) => [h.handoffId, h.state])),
        reviewReason: Object.fromEntries(nodes.map((node) => [node.nodeId, node.reviewReason ?? null])),
        artifactCounts: Object.fromEntries(nodes.map((node) => [node.nodeId, (node.artifactRefs ?? []).length])),
        notes: Object.fromEntries(nodes.map((node) => [node.nodeId, node.note ?? null])),
      });
    }
    return result;
  };
  return log;
}

/** `script` 收到 root 后再生成步骤：产物必须写到实例工作区，那是 claimGraph 才知道的路径。 */
async function setupDoc(script, { env = {} } = {}) {
  const root = tmpDir('maestro-wp4-doc-root-');
  const cwd = tmpDir('maestro-wp4-doc-cwd-');
  const factory = makeScriptedFactory(script(root), { deferFirstUpdateMs: 5 });
  const result = buildOrch({ root, cwd, factory, env });
  const saves = trackSaves(result.store);
  return {
    ...result,
    factory,
    saves,
    async teardown() {
      try {
        await result.orch.dispose();
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    },
  };
}

test('task-loop 门控：下游接受时才 done，且与 handoff accepted 同一次 CAS（rev 只 +1）', async () => {
  const env = await setupDoc((root) => [researchStep(root), writeStep(root, 1), passReview(1)]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'completed');

    // 核准：accepted 与 done 只能在同一次写入里一起出现
    const acceptIndex = env.saves.findIndex((entry) => entry.handoffs['HO-001'] === 'accepted');
    assert.notEqual(acceptIndex, -1, 'HO-001 从未被接受');
    const before = env.saves[acceptIndex - 1];
    // `delivered` 是短暂态：宿主够快时它会在内存里被 accepted 覆盖后一起落盘，
    // 因此这里只要求「接受之前还没接受」，节点仍停在 review。
    assert.notEqual(before.handoffs['HO-001'], 'accepted');
    assert.equal(before.nodes['T-001'], 'review');
    assert.equal(env.saves[acceptIndex].nodes['T-001'], 'done');
    assert.equal(env.saves[acceptIndex].rev, before.rev + 1, '门控必须一次落盘（C-09）');

    // 反向：不存在「已接受但节点还没完成」的落盘
    assert.equal(
      env.saves.some((entry) => entry.handoffs['HO-001'] === 'accepted' && entry.nodes['T-001'] !== 'done'),
      false,
    );

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.template, 'task-loop');
    assert.equal(state.artifactStem, 'release-notes');
    assert.deepEqual(state.nodes.map((n) => n.nodeId), ['T-001', 'T-002', 'T-003']);
    assert.deepEqual(state.nodes.map((n) => n.roleId), ['researcher', 'writer', 'reviewer']);
    assert.equal(state.nodes.every((n) => n.state === 'done'), true);
    assert.equal(state.escalations.length, 0);
    // doc-single 投影：没有 absPath，也没有正文（NFR-08）
    for (const node of state.nodes.slice(0, 2)) {
      assert.deepEqual(Object.keys(node.artifactRefs[0]).sort(), ['bytes', 'ref', 'sha256', 'verifiedAt']);
      assert.equal(node.artifactRefs[0].ref.startsWith('artifacts/'), true);
    }
    assert.equal(state.nodes[2].review.decision, 'pass');
    assert.equal(state.nodes[2].review.artifact, 'artifacts/docs/release-notes.v1.md');

    const dispatched = env.events.filter((e) => e.reason === 'node.dispatch');
    assert.deepEqual(
      dispatched.map((e) => [e.objectId, e.detail.round, e.detail.roleId]),
      [
        ['T-001', 1, 'researcher'],
        ['T-002', 1, 'writer'],
        ['T-003', 1, 'reviewer'],
      ],
    );
  } finally {
    await env.teardown();
  }
});

test('task-loop 子原因两段可见：running→review 写 evidence，核对通过后改 downstream', async () => {
  const env = await setupDoc((root) => [researchStep(root), writeStep(root, 1), passReview(1)]);
  try {
    await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });

    const reviewWrites = env.saves.filter((entry) => entry.nodes['T-002'] === 'review');
    assert.ok(reviewWrites.length >= 2, '应当至少有「待核对」与「待下游」两次落盘');
    // 第一次进 review 时还没核对：证据未落，子原因是 evidence（after_output 暂停点可见）
    assert.equal(reviewWrites[0].reviewReason['T-002'], 'evidence');
    assert.equal(reviewWrites[0].artifactCounts['T-002'], 0);
    // 核对通过后仍停在 review，子原因换成 downstream
    const downstream = reviewWrites.find((entry) => entry.reviewReason['T-002'] === 'downstream');
    assert.ok(downstream, '核对通过后子原因应改成 downstream');
    assert.equal(downstream.artifactCounts['T-002'], 1);
    assert.equal(downstream.nodes['T-002'], 'review');

    // 终态 releaseReason 归零：只在 review 态存活
    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.nodes[1].reviewReason, null);
  } finally {
    await env.teardown();
  }
});

test('task-loop 驳回未超限：审核 failed（等待复审）→ 回流带缺陷 → 第 2 轮通过', async () => {
  const env = await setupDoc((root) => [
    researchStep(root),
    writeStep(root, 1),
    rejectReview(1),
    writeStep(root, 2),
    passReview(2),
  ]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'completed');

    // 驳回后审核者是「失败 + 等待复审」，不是完成、不是升级
    const failed = env.saves.find((entry) => entry.nodes['T-003'] === 'failed');
    assert.ok(failed, '驳回未超限时审核节点应落 failed');
    assert.equal(failed.notes['T-003'], '等待复审');

    const state = (await env.store.load('INST-001')).state;
    assert.deepEqual(
      state.handoffs.map((h) => h.edge.kind),
      ['forward', 'forward', 'backflow', 'retest'],
    );
    assert.equal(state.handoffs.every((h) => h.state === 'consumed'), true);
    assert.equal(state.nodes[1].round, 2);
    assert.equal(state.nodes[2].round, 2);
    assert.equal(state.nodes[1].artifactHistory.length, 2);
    assert.deepEqual(
      state.nodes[1].artifactHistory.map((h) => h.ref),
      ['artifacts/docs/release-notes.v1.md', 'artifacts/docs/release-notes.v2.md'],
    );
    assert.equal(state.escalations.length, 0);
    assert.equal(state.halted, false);

    // 回流包保留缺陷、修改要求与上一版指纹；复测包指向新版
    const backflow = state.handoffs[2];
    assert.equal(backflow.defects.length, 2);
    assert.equal(backflow.revisionRequirement, '补写「回滚方案」一节');
    assert.equal(backflow.artifactRefs.previous.ref, 'artifacts/docs/release-notes.v1.md');
    assert.match(backflow.artifactRefs.previous.sha256, /^[0-9a-f]{64}$/);
    assert.equal(state.handoffs[3].artifactRefs.input[0], 'artifacts/docs/release-notes.v2.md');
    // 提示词真的把修改要求交给了撰写者
    assert.ok(env.factory.prompts[3].text.includes('补写「回滚方案」一节'));
    assert.ok(fs.existsSync(docPaths(env.root).doc(1)), '旧版本不得被删除');
  } finally {
    await env.teardown();
  }
});

test('task-loop 派发时刻锁进事件 ts：startedAt / roundStartedAt 与 node.dispatch 逐字相等（AC-35）', async () => {
  const env = await setupDoc((root) => [
    researchStep(root),
    writeStep(root, 1),
    rejectReview(1),
    writeStep(root, 2),
    passReview(2),
  ]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));

    const state = (await env.store.load('INST-001')).state;
    const writer = state.nodes.find((n) => n.nodeId === 'T-002');
    const dispatches = env.events.filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-002');
    assert.equal(dispatches.length, 2, 'T-002 应当派发两轮');

    // 第 1 轮：startedAt 与事件 ts 严格相等——saveState 的磁盘 IO 不许把两者拉开
    assert.equal(dispatches[0].detail.round, 1);
    assert.equal(dispatches[0].ts, writer.startedAt);

    // 第 2 轮派发不重置 startedAt，但 roundStartedAt 换成第 2 轮的派发时刻
    assert.equal(dispatches[1].detail.round, 2);
    assert.equal(dispatches[1].ts, writer.roundStartedAt);
    assert.notEqual(writer.startedAt, writer.roundStartedAt);

    // 不变量：seq 严格单调、ts 不早于同实例上一条事件
    for (let i = 1; i < env.events.length; i += 1) {
      assert.equal(env.events[i].seq > env.events[i - 1].seq, true, `seq 断层：${env.events[i].seq}`);
      assert.equal(env.events[i].ts >= env.events[i - 1].ts, true, `ts 倒退：${env.events[i].ts} < ${env.events[i - 1].ts}`);
    }
  } finally {
    await env.teardown();
  }
});

test('task-loop 核对通过时刻锁进事件 ts：review.evidence_verified 的 ts 与 node.endedAt 严格相等（AC-35）', async () => {
  const env = await setupDoc((root) => [
    researchStep(root),
    writeStep(root, 1),
    rejectReview(1),
    writeStep(root, 2),
    passReview(2),
  ]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));

    const state = (await env.store.load('INST-001')).state;
    const evidence = env.events.filter((e) => e.reason === 'review.evidence_verified');
    assert.ok(evidence.length >= 3, `evidence_verified 事件数不足：${evidence.length}`);

    for (const nodeId of ['T-001', 'T-002']) {
      const last = evidence.filter((e) => e.objectId === nodeId).at(-1);
      assert.ok(last, `${nodeId} 没有 review.evidence_verified 事件`);
      const node = state.nodes.find((n) => n.nodeId === nodeId);
      // 逐字等式：总线不得在 emit 时重新取时间（否则磁盘 IO 会把两者拉开 1ms）
      assert.equal(node.endedAt, last.ts);
    }

    // 不变量：seq 严格递增、ts 不早于同实例上一条事件
    for (let i = 1; i < env.events.length; i += 1) {
      assert.equal(env.events[i].seq > env.events[i - 1].seq, true, `seq 断层：${env.events[i].seq}`);
      assert.equal(env.events[i].ts >= env.events[i - 1].ts, true, `ts 倒退：${env.events[i].ts} < ${env.events[i - 1].ts}`);
    }
  } finally {
    await env.teardown();
  }
});

test('task-loop 第 2 轮仍驳回：停止回流 → 升级挂起，不再派发第 3 次', async () => {
  const env = await setupDoc((root) => [
    researchStep(root),
    writeStep(root, 1),
    rejectReview(1),
    writeStep(root, 2),
    rejectReview(2),
  ]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.snapshot.state, 'suspended');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'suspended');
    assert.equal(state.nodes[2].state, 'escalated');
    assert.equal(state.nodes[2].round, 2);
    assert.equal(state.nodes[1].state, 'done');
    assert.equal(state.nodes[1].round, 2);
    assert.equal(state.escalations.length, 1);
    assert.equal(state.escalations[0].reasonCode, 'rounds_exceeded');
    assert.equal(state.escalations[0].defects.length, 2);
    assert.equal(state.counters.dispatchCount, 5);
    assert.equal(state.handoffs.length, 4);
    const dispatches = env.events.filter((e) => e.reason === 'node.dispatch' && e.objectId === 'T-003');
    assert.equal(dispatches.length, 2);
  } finally {
    await env.teardown();
  }
});

test('task-loop 审核文件无效：一律升级，不回流、不写第 2 轮', async () => {
  const env = await setupDoc((root) => [researchStep(root), writeStep(root, 1), { reviewMissing: true }]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.snapshot.state, 'suspended');

    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.nodes[2].state, 'escalated');
    assert.equal(state.nodes[1].state, 'done');
    assert.equal(state.nodes[1].round, 1);
    assert.equal(state.escalations[0].reasonCode, 'review_missing');
    assert.equal(state.counters.dispatchCount, 3);
    assert.equal(state.handoffs.length, 2);
    // `halted` 只用于「升级写不进去」（BR-37）；正常升级是 suspended + halted=false
    assert.equal(state.halted, false);
  } finally {
    await env.teardown();
  }
});

test('task-loop 审核文件不可解析：同样升级挂起（不回流）', async () => {
  const env = await setupDoc((root) => [researchStep(root), writeStep(root, 1), { review: '{' }]);
  try {
    await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.state, 'suspended');
    assert.equal(state.nodes[2].state, 'escalated');
    assert.equal(state.escalations[0].reasonCode, 'review_invalid');
    assert.equal(state.handoffs.length, 2);
  } finally {
    await env.teardown();
  }
});

test('task-loop 工作区建不起来：WORKSPACE_INIT_FAILED，且不留半个实例目录（AC-44）', async () => {
  const env = await setupDoc((root) => [researchStep(root)], {
    env: { MAESTRO_FAULT: 'workspace_init:fail' },
  });
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'WORKSPACE_INIT_FAILED');
    assert.match(String(result.params?.cause ?? ''), /workspace_init:fail/);
    assert.equal(fs.existsSync(path.join(env.root, '.orch', 'instances', 'INST-001')), false);
    assert.equal(env.events.length, 0);
  } finally {
    await env.teardown();
  }
});

test('task-loop 产物行不合规：缺行 / 非 md / 多行一律在发起时拒绝', async () => {
  const env = await setupDoc(() => []);
  try {
    const missing = await env.orch.startRun({ cwd: env.cwd, task: '写一篇发布说明', template: 'task-loop' });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'PRODUCT_LINE_MISSING_TASK_LOOP');

    const badExt = await env.orch.startRun({ cwd: env.cwd, task: '写一篇发布说明\n产物：notes.txt', template: 'task-loop' });
    assert.equal(badExt.ok, false);
    assert.equal(badExt.code, 'PRODUCT_INVALID_TASK_LOOP');

    const twoLines = await env.orch.startRun({
      cwd: env.cwd,
      task: '写两篇\n产物：a.md\n产物：b.md',
      template: 'task-loop',
    });
    // C-02 第 1 条是「恰好一行」：0 行与 2 行以上都归 MISSING，只有名字违规才是 INVALID
    assert.equal(twoLines.ok, false);
    assert.equal(twoLines.code, 'PRODUCT_LINE_MISSING_TASK_LOOP');

    assert.equal(fs.existsSync(path.join(env.root, '.orch', 'instances', 'INST-001')), false);
  } finally {
    await env.teardown();
  }
});

test('task-loop 审核提示词给绝对路径：基址与 readReview 同源，避免宿主写进实例工作区', async () => {
  const env = await setupDoc((root) => [researchStep(root), writeStep(root, 1), passReview(1)]);
  try {
    const result = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, template: 'task-loop' });
    assert.equal(result.ok, true, JSON.stringify(result));

    // 第 3 次派发是审核节点（研究 → 撰写 → 审核）
    const reviewPrompt = env.factory.prompts[2].text;
    const matched = reviewPrompt.match(/审核文件写入路径：(.+)/);
    assert.ok(matched, '审核提示词必须带「审核文件写入路径：」一行');
    const given = matched[1].trim();

    // 相对路径会让宿主以为该写进「工作区：<绝对路径>」；必须是绝对路径，且解析结果
    // 等于 path.join(state.cwd, REVIEW_PATH) —— 与 readReview({cwd}) 的基址同一个值。
    assert.equal(path.isAbsolute(given), true, `审核路径必须是绝对路径，实际：${given}`);
    assert.equal(path.resolve(env.cwd, given), path.join(path.resolve(env.cwd), 'out', 'review.json'));

    // 其它变量没被改动：文档引用仍是版本化相对引用（不落绝对路径，NFR-08）
    assert.equal(reviewPrompt.includes('本轮文档引用：artifacts/docs/release-notes.v1.md'), true);

    // 回读侧不受影响：review.reviewPath 仍是相对值，会进事件 detail
    const state = (await env.store.load('INST-001')).state;
    assert.equal(state.nodes[2].review.reviewPath, 'out/review.json');
  } finally {
    await env.teardown();
  }
});
