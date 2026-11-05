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
function makeScriptedFactory(script) {
  let index = 0;
  const prompts = [];
  return {
    prompts,
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
          updateCb({ sessionId, update: { sessionUpdate: 'agent_thought_chunk' } });
          if (step.write) {
            const target = path.join(cwd, step.write);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, step.content ?? 'module.exports = {};\n', 'utf8');
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

async function setupFake({ script, env = {} }) {
  const root = tmpDir('maestro-wp4-loop-root-');
  const cwd = tmpDir('maestro-wp4-loop-cwd-');
  const factory = makeScriptedFactory(script);
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
