/**
 * WP-4 派发接线契约测试：`session_policy = reuse` 在**真实派发路径**上的行为
 * （I1.8 / 需求 §2.9 / D-13 / AC-49 / AC-65 / AC-66）。
 *
 * 为什么是「进程内接缝」而不是 CLI 端到端：
 * - AC-49（有可复用会话）已由 `probe/acc8-cases/AC-49.mjs` 走真实 CLI 端到端取证；
 * - AC-65 / AC-66 的 Given 是「没有空闲会话 / 空闲会话正服务其他节点 / 跨宿主」，
 *   而 `advance()` 的图推进是**严格串行**的（一次只派发一个节点），单条 CLI 运行
 *   不可能让同角色的两个节点同时在飞 —— 需求夹具写的「两个节点同角色并发」在
 *   当前编排模型里不可达（裁-20l）。因此这两条改用**既有 `test.dispatch` 接缝**
 *   构造 Given：先落盘 `state.json`（预置会话现场），再走 `dispatchToNode` →
 *   `dispatchInState` 的真实派发分支，断言的是同一条产品代码路径，只把宿主换成
 *   mock，不旁路、不伪造中间态。
 *
 * 断言口径：
 * - Then 一律按需求原文判：新建 → 会话 id 不等于预置会话、`session.reuse` 事件 0 条；
 *   复用 → 会话 id 相同、`session.reuse` 事件 1 条且带 `roleId` / `sessionId`。
 * - 中文只在 `src/cli/labels.js`（用例侧不硬编码复用行文案，只查事件与 id）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import { createClient } from '../../src/daemon/client.js';
import { createServer } from '../../src/daemon/server.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';

process.env.NODE_ENV = 'test';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');
const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 200,
};
const TASK = '给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js';

const tempDirs = [];
function makeRoot(tag) {
  // 前缀要短：核心管道路径受 macOS 104 字节上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp13r-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function sanitizedEnv() {
  const env = { ...process.env };
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  delete env.MAESTRO_PERMISSION_POLICY;
  return env;
}

/** 真实 mock 宿主（stdio + ACP），与产品同一条装配链。 */
function makeMockFactory() {
  return {
    async create({ cwd }) {
      const transport = createStdioTransport({
        command: process.execPath,
        args: [MOCK],
        env: sanitizedEnv(),
        cwd,
      });
      const client = createAcpClient({ transport, limits: LIMITS });
      return {
        // 与产品 `src/adapter/factory.js` 的 `buildAdapter` 同形：必须把 ACP 客户端
        // 挂出来，D-13 的「接回空闲会话」正是经 `adapter.client` 的 resume/load 原语。
        client,
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
        onPermission: (cb) => client.onPermission(cb),
        dispose: () => client.dispose(),
      };
    },
  };
}

async function boot(tag) {
  const root = makeRoot(`${tag}-root`);
  const cwd = makeRoot(`${tag}-cwd`);
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: makeMockFactory(),
    generation: 'gen-wp13r',
    env: { NODE_ENV: 'test' },
  });
  const server = createServer({
    root, bus, orchestrator, generation: 'gen-wp13r', logger: () => {},
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  return {
    root,
    cwd,
    store,
    async teardown() {
      await server.close();
      await orchestrator.dispose();
    },
  };
}

async function seam(root, method, params) {
  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: false, hotRetryMs: 1500 });
    assert.equal(connected?.ok, true, `连接核心失败：${JSON.stringify(connected)}`);
    return await client.request(method, params, { timeoutMs: 30_000 });
  } finally {
    await client.close();
  }
}

function nodeOf({ nodeId, roleId, state, sessionId = null }) {
  return {
    nodeId,
    state,
    round: state === 'pending' ? 0 : 1,
    roleId,
    sessionId,
    stateSince: '2026-11-20T10:00:00.000Z',
    startedAt: null,
    roundStartedAt: null,
    endedAt: null,
    failure: null,
    note: null,
    verdict: null,
    artifactRefs: [],
  };
}

/**
 * 预置现场：`graphForState` 按 `template` 反查内置图，所以只要 template 与节点号
 * 对齐就能走真实派发分支；预置会话就是 Given 的唯一变量。
 */
function craftedState({ cwd, sessions, sessionPolicies }) {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-wp13r',
    state: 'running',
    halted: false,
    paused: false,
    rev: 0,
    template: 'code-loop',
    task: TASK,
    cwd,
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    stateSince: '2026-11-20T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes: [
      nodeOf({ nodeId: 'T-001', roleId: 'developer', state: 'pending' }),
      nodeOf({ nodeId: 'T-002', roleId: 'tester', state: 'pending' }),
    ],
    sessions,
    handoffs: [],
    escalations: [],
    approvals: [],
    sessionPolicies,
    health: { nodeTimeoutMs: 30000 },
  };
}

function sessionOf({ sessionId, state, servingNodeId, hostId }) {
  return {
    sessionId,
    nodeId: servingNodeId ?? null,
    round: 1,
    roleId: 'developer',
    instanceId: 'INST-001',
    servingNodeId: servingNodeId ?? null,
    reused: false,
    hostId: hostId ?? null,
    state,
    stateSince: '2026-11-20T09:00:00.000Z',
    createdAt: '2026-11-20T09:00:00.000Z',
    lastEventAt: '2026-11-20T09:05:00.000Z',
    toolName: null,
    turnId: null,
    artifactRef: null,
    pendingPermission: null,
    quarantined: false,
  };
}

/** 落盘现场 → 真实派发 T-001 → 读回 state 与事件。 */
async function dispatchWith(tag, { sessions, sessionPolicies = { developer: 'reuse' }, hostId = 'mock' }) {
  const env = await boot(tag);
  try {
    const saved = await env.store.save('INST-001', craftedState({
      cwd: env.cwd, sessions, sessionPolicies,
    }));
    assert.equal(saved.ok, true, JSON.stringify(saved));

    const dispatched = await seam(env.root, 'test.dispatch', {
      instanceId: 'INST-001',
      nodeId: 'T-001',
      hostId,
    });
    assert.equal(dispatched?.ok, true, `派发失败：${JSON.stringify(dispatched)}`);

    const loaded = await env.store.load('INST-001');
    assert.equal(loaded.ok, true, JSON.stringify(loaded));
    const read = await env.store.readEvents('INST-001');
    return { state: loaded.state, events: read.ok ? read.events : [], sessionPolicies };
  } finally {
    await env.teardown();
  }
}

function reuseEvents(events) {
  return events.filter((event) => event?.reason === 'session.reuse');
}

test('AC-65：策略是 reuse 但没有空闲会话 → 新建会话、不写复用行', async () => {
  const seeded = sessionOf({
    sessionId: 'seeded-busy', state: 'thinking', servingNodeId: 'T-001', hostId: 'mock',
  });
  const { state, events } = await dispatchWith('ac65', { sessions: [seeded] });

  const created = state.sessions.filter((item) => item.round === 1 && item.nodeId === 'T-001'
    && item.sessionId !== 'seeded-busy');
  assert.equal(created.length, 1, `应新建 1 个会话：${JSON.stringify(state.sessions.map((s) => s.sessionId))}`);
  assert.notEqual(created[0].sessionId, 'seeded-busy', '不得复用非空闲会话');
  assert.equal(created[0].reused, false, '新建会话不标 reused');
  assert.equal(reuseEvents(events).length, 0, '不得出现 session.reuse 事件（AC-65 的「不出现复用行」）');
  const node = state.nodes.find((item) => item.nodeId === 'T-001');
  assert.equal(node.state, 'running', '派发正常继续');
});

test('AC-66：空闲同角色但正服务其他节点 → 不复用', async () => {
  const seeded = sessionOf({
    sessionId: 'seeded-other-node', state: 'idle', servingNodeId: 'T-002', hostId: 'mock',
  });
  const { state, events } = await dispatchWith('ac66-node', { sessions: [seeded] });

  const mine = state.sessions.filter((item) => item.nodeId === 'T-001' && item.round === 1);
  assert.equal(mine.length, 1);
  assert.notEqual(mine[0].sessionId, 'seeded-other-node', '不得复用正服务其他节点的会话');
  assert.equal(reuseEvents(events).length, 0);
});

test('AC-66：空闲同角色但宿主不同 → 不复用', async () => {
  const seeded = sessionOf({
    sessionId: 'seeded-other-host', state: 'idle', servingNodeId: null, hostId: 'mock2',
  });
  const { state, events } = await dispatchWith('ac66-host', { sessions: [seeded], hostId: 'mock' });

  const mine = state.sessions.filter((item) => item.nodeId === 'T-001' && item.round === 1);
  assert.equal(mine.length, 1);
  assert.notEqual(mine[0].sessionId, 'seeded-other-host', '不得跨宿主复用');
  assert.equal(reuseEvents(events).length, 0);
});

test('AC-49 派发面正控：空闲、同角色、同宿主且未服务其他节点 → 复用同一会话并写复用行', async () => {
  const seeded = sessionOf({
    sessionId: 'seeded-idle', state: 'idle', servingNodeId: null, hostId: 'mock',
  });
  const { state, events } = await dispatchWith('ac49', { sessions: [seeded] });

  const mine = state.sessions.filter((item) => item.nodeId === 'T-001' && item.round === 1);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].sessionId, 'seeded-idle', '应复用空闲会话');
  assert.equal(mine[0].reused, true, '复用记录标记 reused');
  assert.equal(mine[0].roleId, 'developer', '复用记录带 roleId（D-13 的会话归属）');
  const reuse = reuseEvents(events);
  assert.equal(reuse.length, 1, '复用恰好写 1 条 session.reuse');
  assert.equal(reuse[0].detail?.sessionId, 'seeded-idle');
  assert.equal(reuse[0].detail?.roleId, 'developer');
});

test('AC-48 派发面：没有策略快照（fresh 默认）→ 一律新建，不写复用行', async () => {
  const seeded = sessionOf({
    sessionId: 'seeded-idle', state: 'idle', servingNodeId: null, hostId: 'mock',
  });
  const { state, events } = await dispatchWith('ac48', {
    sessions: [seeded], sessionPolicies: null,
  });

  const mine = state.sessions.filter((item) => item.nodeId === 'T-001' && item.round === 1);
  assert.equal(mine.length, 1);
  assert.notEqual(mine[0].sessionId, 'seeded-idle', '默认 fresh 不得复用');
  assert.equal(reuseEvents(events).length, 0);
});
