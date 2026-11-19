/**
 * WP-4 契约测试（角色恢复面）：AC-28 / AC-29 / AC-30 / AC-31 / AC-67。
 *
 * 角色实例是派生视图（`src/registry/role-instances.js`，不在本 WP 的文件边界内），
 * 所以这里同时断言两件事：
 * 1. 编排内核产出的恢复事实（`recovery.role` 事件、会话方言、节点位置、`session/new`）；
 * 2. 用同一份派生函数复核角色状态词（只读消费，不改注册表代码）。
 *
 * 角色「服务节点」是否包含 `assigned` 由注册表投影决定；本文件在 hold 点断言内核
 * 事件与节点位置，避免把跨 WP 的显示口径混进内核契约。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { writeCheckpoint, buildCheckpoint } from '../../src/core/checkpoint.js';
import { eventsPath, statePath } from '../../src/persistence/paths.js';
import { getGraph } from '../../src/templates/index.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';

const AT = '2026-11-09T10:00:00.000Z';
const GRAPH = getGraph('code-loop');
const ROLES = new Map([
  ['developer', { id: 'developer', group: 'coding', maxConcurrentSessions: 1 }],
  ['tester', { id: 'tester', group: 'coding', maxConcurrentSessions: 1 }],
  ['reviewer', { id: 'reviewer', group: 'coding', maxConcurrentSessions: 1 }],
  ['coordinator', { id: 'coordinator', group: 'coordinator', maxConcurrentSessions: 1 }],
]);

async function tempRoot(label) {
  return fs.mkdtemp(path.join(os.tmpdir(), `maestro-i18-${label}-`));
}

function makeState(instanceId, cwd, overrides = {}) {
  return {
    schemaVersion: 2,
    instanceId,
    coreGeneration: 'gen-old',
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
    nodes: [],
    sessions: [],
    handoffs: [],
    escalations: [],
    approvals: [],
    artifactRefs: [],
    health: { nodeTimeoutMs: 30000 },
    ...overrides,
  };
}

function makeSession(sessionId, overrides = {}) {
  return {
    sessionId,
    nodeId: 'T-001',
    hostId: 'mock',
    state: 'idle',
    policy: 'fresh',
    createdAt: AT,
    ...overrides,
  };
}

function makeFactory(options = {}) {
  const record = { created: 0, prompts: [], resume: 0, load: 0 };
  const factory = {
    async create({ hostId, cwd } = {}) {
      record.created += 1;
      const adapter = {
        hostId: hostId ?? null,
        cwd,
        sessionId: `sess-${record.created}`,
        client: {
          capabilities: options.caps ?? {},
          normalizeCapabilities(value) {
            return { canResume: Boolean(value?.resume), canLoad: Boolean(value?.load) };
          },
          async resumeSession(id) {
            record.resume += 1;
            return { ok: true, result: { sessionId: id } };
          },
          async loadSession(id) {
            record.load += 1;
            return { ok: true, result: { sessionId: id } };
          },
        },
        async initialize() {
          return { ok: true };
        },
        async newSession() {
          return { ok: true, result: { sessionId: `new-${record.created}` } };
        },
        async prompt(sessionId) {
          record.prompts.push(sessionId);
          return options.prompt ? options.prompt(sessionId) : { ok: true, result: { stopReason: 'end_turn' } };
        },
        onUpdate() {
          return () => {};
        },
        onPermission() {
          return () => {};
        },
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

async function boot(root, { env = {}, factory = {} } = {}) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const bridge = makeFactory(factory);
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: bridge.factory,
    generation: 'gen-current',
    env: { NODE_ENV: 'test', ...env },
    graph: GRAPH,
  });
  return { store, orchestrator, record: bridge.record };
}

async function persist(store, state) {
  const saved = await store.save(state.instanceId, state);
  assert.equal(saved.ok, true);
  const written = await writeCheckpoint(
    store.root,
    state.instanceId,
    buildCheckpoint({ state, graph: GRAPH, cwd: state.cwd, task: state.task }),
  );
  assert.equal(written.ok, true);
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

async function waitFor(predicate, ms = 4000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function release(root) {
  try {
    await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  } catch {
    // Not held.
  }
}

async function teardown(orchestrator, root, instanceId) {
  await release(root);
  try {
    await orchestrator.cancel({ instanceId });
  } catch {
    // Already terminal.
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

function roleOf(state, roleId) {
  const built = buildRoleInstances({ state, graph: GRAPH, roles: ROLES });
  return {
    role: built.roles.find((item) => item.roleId === roleId) ?? null,
    roleToSessions: built.roleToSessions,
  };
}

test('AC-28 角色 busy 且会话不可恢复 → 事件降级为 available', async () => {
  const root = await tempRoot('ac28');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-028', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', phase: 'assigned', round: 2, roleId: 'developer' }],
    sessions: [makeSession('sess-028', { nodeId: 'T-001', state: 'idle' })],
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const events = await readEvents(root, 'INST-028');
  const roleEvents = events.filter((event) => event.reason === 'recovery.role');
  assert.equal(roleEvents.length, 1);
  assert.equal(roleEvents[0].detail.from, 'busy');
  assert.equal(roleEvents[0].detail.to, 'available');
  assert.equal(roleEvents[0].detail.reason, 'session_unrecoverable');
  const disk = await readDisk(root, 'INST-028');
  assert.equal(disk.nodes[0].phase, 'assigned');
  await teardown(orchestrator, root, 'INST-028');
});

test('AC-29 角色 busy 且会话可 resume → 保持服务中，无降级行', async () => {
  const root = await tempRoot('ac29');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: { caps: { resume: true } },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-029', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', phase: 'running', round: 2, roleId: 'developer' }],
    sessions: [makeSession('sess-029', { nodeId: 'T-001', state: 'thinking' })],
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.equal(record.resume, 1);
  const events = await readEvents(root, 'INST-029');
  assert.equal(events.filter((event) => event.reason === 'recovery.role').length, 0);
  const disk = await readDisk(root, 'INST-029');
  const session = disk.sessions.find((item) => item.sessionId === 'sess-029');
  assert.equal(session.dialect, 'resume');
  assert.equal(session.recovered, true);
  const view = roleOf(disk, 'developer');
  assert.equal(view.role.status, 'busy');
  assert.deepEqual(view.role.activeSessions, ['sess-029']);
  await teardown(orchestrator, root, 'INST-029');
});

test('AC-30 available / cooldown / inactive 三个角色恢复前后不变', async () => {
  const root = await tempRoot('ac30');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-030', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'done', round: 1, roleId: 'developer' },
      { nodeId: 'T-002', state: 'pending', phase: 'blocked', round: 1, roleId: 'tester' },
    ],
  }));

  const beforeDisk = await readDisk(root, 'INST-030');
  const before = {
    developer: roleOf(beforeDisk, 'developer').role.status,
    tester: roleOf(beforeDisk, 'tester').role.status,
    coordinator: roleOf(beforeDisk, 'coordinator').role.status,
  };
  assert.equal(before.developer, 'cooldown');
  assert.equal(before.tester, 'available');
  assert.equal(before.coordinator, 'inactive');

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const afterDisk = await readDisk(root, 'INST-030');
  const after = {
    developer: roleOf(afterDisk, 'developer').role.status,
    tester: roleOf(afterDisk, 'tester').role.status,
    coordinator: roleOf(afterDisk, 'coordinator').role.status,
  };
  assert.deepEqual(after, before);
  const events = await readEvents(root, 'INST-030');
  assert.equal(events.filter((event) => event.reason === 'recovery.role').length, 0);
  assert.deepEqual(roleOf(afterDisk, 'tester').roleToSessions, {});
  await teardown(orchestrator, root, 'INST-030');
});

test('AC-31 释放 hold 后重新派发，角色回到服务中', async () => {
  const root = await tempRoot('ac31');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: { prompt: () => new Promise(() => {}) },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-031', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', phase: 'assigned', round: 2, roleId: 'developer' }],
    sessions: [makeSession('sess-031', { nodeId: 'T-001', state: 'idle' })],
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  await waitFor(async () => {
    try {
      await fs.access(path.join(root, '.mock', 'paused'));
      return true;
    } catch {
      return false;
    }
  });
  const held = await readDisk(root, 'INST-031');
  assert.equal(held.nodes[0].phase, 'assigned');

  await release(root);
  const promoted = await waitFor(async () => {
    const disk = await readDisk(root, 'INST-031');
    return disk.nodes[0].phase === 'running';
  });
  assert.equal(promoted, true, 'released recovery must promote assigned -> running');
  const disk = await readDisk(root, 'INST-031');
  assert.equal(disk.nodes[0].state, 'running');

  const view = roleOf(disk, 'developer');
  assert.equal(view.role.status, 'busy');
  assert.ok(view.roleToSessions.developer.length >= 1);
  const prompted = await waitFor(() => record.prompts.length >= 1);
  assert.equal(prompted, true, 'redispatch must prompt the recovered session');
  await teardown(orchestrator, root, 'INST-031');
});

test('AC-67 会话不可恢复且无可调度节点 → 保持可用，不新建会话', async () => {
  const root = await tempRoot('ac67');
  const { store, orchestrator, record } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-067', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'failed', round: 2, roleId: 'developer', failed_reason: 'verdict_fail' },
      { nodeId: 'T-002', state: 'done', round: 2, roleId: 'tester' },
    ],
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.equal(record.created, 0, 'no schedulable node must not open a session');
  const disk = await readDisk(root, 'INST-067');
  const view = roleOf(disk, 'developer');
  assert.equal(view.role.status, 'available');
  assert.deepEqual(view.role.servingNodes, []);
  assert.deepEqual(view.roleToSessions, {});
  const events = await readEvents(root, 'INST-067');
  assert.equal(events.filter((event) => event.reason === 'recovery.role').length, 0);
  await teardown(orchestrator, root, 'INST-067');
});
