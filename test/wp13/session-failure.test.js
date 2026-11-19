/**
 * WP-4 契约测试（会话失败面）：AC-42 / AC-43 / AC-44 / AC-45 / AC-46 / AC-47。
 *
 * D-8 的两条判据互斥：
 * - 崩溃：prompt 结果携带 `DSH_SPAWN_FAILED` / `IPC_CLOSED` → 重建一次；
 * - 运行慢：进程存活 + 会话处于 thinking/tool_running + 超过 `slowMs` → 只提示。
 *
 * 适配器为内存实现：`prompt` 可以按脚本崩溃 / 停滞，并主动推一帧 thinking。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { eventsPath, statePath } from '../../src/persistence/paths.js';
import { getGraph } from '../../src/templates/index.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';

const AT = '2026-11-09T10:00:00.000Z';
const GRAPH = getGraph('code-loop');
const ROLES = new Map([
  ['developer', { id: 'developer', group: 'coding', maxConcurrentSessions: 1 }],
  ['tester', { id: 'tester', group: 'coding', maxConcurrentSessions: 1 }],
  ['coordinator', { id: 'coordinator', group: 'coordinator', maxConcurrentSessions: 1 }],
]);

async function tempRoot(label) {
  return fs.mkdtemp(path.join(os.tmpdir(), `maestro-i18-${label}-`));
}

function makeState(instanceId, cwd, overrides = {}) {
  return {
    schemaVersion: 2,
    instanceId,
    coreGeneration: 'gen-current',
    createdAt: AT,
    updatedAt: AT,
    state: 'running',
    stateSince: AT,
    template: 'code-loop',
    cwd,
    task: '修复 calc.js 的除零边界，并补一条回归测试。',
    halted: false,
    paused: false,
    rev: 0,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes: [{ nodeId: 'T-001', state: 'pending', phase: 'ready', round: 0, roleId: 'developer' }],
    sessions: [],
    handoffs: [],
    escalations: [],
    approvals: [],
    artifactRefs: [],
    health: { nodeTimeoutMs: 30000 },
    ...overrides,
  };
}

/**
 * @param {object} options
 *   mode: 'ok' | 'crash-once' | 'crash-twice' | 'stall'
 *   failCreateFrom: fail every create from the Nth call (1-based)
 */
function makeFactory(options = {}) {
  const record = { created: 0, prompts: [], sessionIds: [], listeners: [] };
  const factory = {
    async create({ hostId, cwd } = {}) {
      record.created += 1;
      if (options.failCreateFrom && record.created >= options.failCreateFrom) {
        throw new Error('spawn blocked');
      }
      const index = record.created;
      const adapter = {
        hostId: hostId ?? null,
        cwd,
        sessionId: `sess-${index}`,
        client: {
          capabilities: {},
          normalizeCapabilities() {
            return { canResume: false, canLoad: false };
          },
        },
        async initialize() {
          return { ok: true };
        },
        async newSession() {
          return { ok: true, result: { sessionId: `new-${index}` } };
        },
        async prompt(sessionId) {
          record.prompts.push(sessionId);
          record.sessionIds.push(sessionId);
          const mode = options.mode ?? 'ok';
          if (mode === 'crash-once' && record.prompts.length === 1) {
            return { ok: false, error: { code: 'IPC_CLOSED', message: 'agent exited' } };
          }
          if (mode === 'crash-twice' && record.prompts.length <= 2) {
            return { ok: false, error: { code: 'IPC_CLOSED', message: 'agent exited' } };
          }
          if (mode === 'stall') {
            // Turn frame first: the watcher only counts thinking sessions.
            for (const listener of record.listeners) {
              try {
                listener({
                  sessionId,
                  update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '...' } },
                });
              } catch {
                // A listener failure is the test's problem, not the runtime's.
              }
            }
            return new Promise(() => {});
          }
          return { ok: true, result: { stopReason: 'end_turn' } };
        },
        onUpdate(listener) {
          record.listeners.push(listener);
          return () => {
            record.listeners = record.listeners.filter((item) => item !== listener);
          };
        },
        onPermission() {
          return () => {};
        },
        async cancel() {},
        async dispose() {},
        async listSessions() {
          return { ok: true, result: { sessions: [] } };
        },
      };
      return { ok: true, adapter };
    },
  };
  return { factory, record };
}

async function boot(root, { env = {}, factory = {}, graph = GRAPH } = {}) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const bridge = makeFactory(factory);
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: bridge.factory,
    generation: 'gen-current',
    env: { NODE_ENV: 'test', MAESTRO_TEST_SLOW_MS: '100', ...env },
    graph,
  });
  return { store, orchestrator, record: bridge.record };
}

async function persist(store, state) {
  const saved = await store.save(state.instanceId, state);
  assert.equal(saved.ok, true);
  return saved;
}

async function readEvents(root, instanceId) {
  try {
    const text = await fs.readFile(eventsPath(root, instanceId), 'utf8');
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

async function readDisk(root, instanceId) {
  return JSON.parse(await fs.readFile(statePath(root, instanceId), 'utf8'));
}

async function waitFor(predicate, ms = 6000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

async function teardown(orchestrator, root, instanceId) {
  try {
    await orchestrator.cancel({ instanceId });
  } catch {
    // Terminal / already stopped.
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

function reasonsOf(events) {
  return events.map((event) => event.reason);
}

const TASK = '修复 calc.js 的除零边界，并补一条回归测试。\n产物：out/verdict.json';

/** Start a real run so `driveGraph` owns the prompt/verdict lifecycle. */
async function start(orchestrator, cwd, template = 'code-loop') {
  const started = await orchestrator.startRun({ cwd, task: TASK, template, earlyReturn: true });
  assert.equal(started.ok, true, `startRun failed: ${started.code ?? ''}`);
  return started.instanceId;
}

test('AC-42 会话崩溃 → 重建一次并重试当前轮', async () => {
  const root = await tempRoot('ac42');
  const { store, orchestrator, record } = await boot(root, { factory: { mode: 'crash-once' } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);

  const rebuilt = await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.rebuilt');
  });
  assert.equal(rebuilt, true, 'crash must rebuild exactly once');
  assert.equal(record.created, 2);
  assert.ok(record.prompts.length >= 2);
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.crash').length, 1);
  assert.equal(events.filter((event) => event.reason === 'session.rebuilt').length, 1);
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.nodes[0].round, 1);
  await teardown(orchestrator, root, instanceId);
});

test('AC-43 会话重建失败 → 升级人工并挂起实例', async () => {
  const root = await tempRoot('ac43');
  const { store, orchestrator } = await boot(root, {
    factory: { mode: 'crash-once', failCreateFrom: 2 },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);
  const failed = await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.rebuild_failed');
  });
  assert.equal(failed, true, 'failed rebuild must be recorded');
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.rebuild_failed').length, 1);
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.nodes[0].state, 'escalated');
  assert.equal(disk.escalations.length, 1);
  assert.equal(disk.state, 'suspended');
  await teardown(orchestrator, root, instanceId);
});

test('AC-44 运行慢 → 只提示，不重建会话', async () => {
  const root = await tempRoot('ac44');
  const { store, orchestrator, record } = await boot(root, { factory: { mode: 'stall' } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);
  const slowed = await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.slow');
  });
  assert.equal(slowed, true, 'slow session must emit exactly one note');
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.slow').length, 1);
  assert.equal(events.filter((event) => event.reason === 'session.crash').length, 0);
  assert.equal(record.created, 1);
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.nodes[0].state, 'running');
  assert.equal(disk.nodes[0].failed_reason, undefined);
  assert.equal(disk.escalations.length, 0);
  await teardown(orchestrator, root, instanceId);
});

test('AC-45 运行慢 + 声明超时 → 记超时失败并升级，不重建', async () => {
  const root = await tempRoot('ac45');
  const graphFile = path.join(root, 'slow-graph.json');
  const injected = {
    id: 'slow-graph',
    title: 'slow',
    entry: 'T-001',
    terminal: 'T-001',
    terminals: ['T-001'],
    maxRounds: { 'T-001': 2 },
    roles: ['developer'],
    nodes: [{
      id: 'T-001',
      nodeId: 'T-001',
      roleId: 'developer',
      order: 1,
      title: '开发',
      artifactPolicy: 'declared',
      judge: 'none',
      products: [],
      wakeFrom: [],
      prompt: 'forward',
      timeout: 1,
    }],
    edges: [],
  };
  await fs.writeFile(graphFile, JSON.stringify(injected), 'utf8');

  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_GRAPH: graphFile },
    factory: { mode: 'stall' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd, 'slow-graph');
  const timedOut = await waitFor(async () => {
    const disk = await readDisk(root, instanceId);
    return disk.nodes[0].state === 'escalated';
  }, 8000);
  assert.equal(timedOut, true, 'declared timeout must escalate the slow node');
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.nodes[0].failed_reason, 'timeout');
  assert.equal(disk.escalations.length, 1);
  assert.equal(record.created, 1);
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.timeout').length, 1);
  await teardown(orchestrator, root, instanceId);
});

test('AC-46 运行慢且未声明超时 → 继续等待，不失败不升级', async () => {
  const root = await tempRoot('ac46');
  const { store, orchestrator, record } = await boot(root, { factory: { mode: 'stall' } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);
  await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.slow');
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.nodes[0].state, 'running');
  assert.equal(disk.nodes[0].failed_reason, undefined);
  assert.equal(disk.escalations.length, 0);
  assert.equal(record.created, 1);
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.timeout').length, 0);
  await teardown(orchestrator, root, instanceId);
});

test('AC-47 崩溃与运行慢的提示不互相出现', async () => {
  const crashRoot = await tempRoot('ac47-crash');
  const crash = await boot(crashRoot, { factory: { mode: 'crash-once' } });
  const crashCwd = path.join(crashRoot, 'demo');
  await fs.mkdir(crashCwd, { recursive: true });
  const crashId = await start(crash.orchestrator, crashCwd);
  await waitFor(async () => reasonsOf(await readEvents(crashRoot, crashId)).includes('session.rebuilt'));
  const crashReasons = reasonsOf(await readEvents(crashRoot, crashId));
  assert.ok(crashReasons.includes('session.crash'));
  assert.ok(crashReasons.includes('session.rebuilt'));
  assert.equal(crashReasons.includes('session.slow'), false);
  assert.equal(crashReasons.includes('session.timeout'), false);
  await teardown(crash.orchestrator, crashRoot, crashId);

  const slowRoot = await tempRoot('ac47-slow');
  const slow = await boot(slowRoot, { factory: { mode: 'stall' } });
  const slowCwd = path.join(slowRoot, 'demo');
  await fs.mkdir(slowCwd, { recursive: true });
  const slowId = await start(slow.orchestrator, slowCwd);
  await waitFor(async () => reasonsOf(await readEvents(slowRoot, slowId)).includes('session.slow'));
  const slowReasons = reasonsOf(await readEvents(slowRoot, slowId));
  assert.ok(slowReasons.includes('session.slow'));
  assert.equal(slowReasons.includes('session.crash'), false);
  assert.equal(slowReasons.includes('session.rebuilt'), false);
  assert.equal(slowReasons.includes('session.rebuild_failed'), false);
  await teardown(slow.orchestrator, slowRoot, slowId);
});


test('AC-63 重建后的会话再次崩溃 → 直接升级，不再重建', async () => {
  const root = await tempRoot('ac63');
  const { store, orchestrator, record } = await boot(root, { factory: { mode: 'crash-twice' } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);
  const failed = await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.rebuild_failed');
  }, 8000);
  assert.equal(failed, true, 'second crash must escalate instead of rebuilding');
  assert.equal(record.created, 2, 'only one rebuild is allowed');
  const events = await readEvents(root, instanceId);
  assert.equal(events.filter((event) => event.reason === 'session.crash').length, 1);
  assert.equal(events.filter((event) => event.reason === 'session.rebuilt').length, 1);
  assert.equal(events.filter((event) => event.reason === 'session.rebuild_failed').length, 1);
  const disk = await readDisk(root, instanceId);
  assert.equal(disk.escalations.length, 1);
  assert.equal(disk.nodes[0].state, 'escalated');
  await teardown(orchestrator, root, instanceId);
});

test('AC-64 重建失败 / 宿主不可达 → 角色显示不可用', async () => {
  const root = await tempRoot('ac64');
  const { store, orchestrator } = await boot(root, {
    factory: { mode: 'crash-once', failCreateFrom: 2 },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const instanceId = await start(orchestrator, cwd);
  const failed = await waitFor(async () => {
    const events = await readEvents(root, instanceId);
    return reasonsOf(events).includes('session.rebuild_failed');
  });
  assert.equal(failed, true);
  const disk = await readDisk(root, instanceId);
  const session = disk.sessions.find((item) => item.nodeId === 'T-001');
  assert.equal(session.state, 'escalated');
  const built = buildRoleInstances({ state: disk, graph: GRAPH, roles: ROLES });
  const developer = built.roles.find((role) => role.roleId === 'developer');
  assert.equal(developer.status, 'unavailable');
  assert.equal(developer.statusReason, 'escalated');
  await teardown(orchestrator, root, instanceId);
});
