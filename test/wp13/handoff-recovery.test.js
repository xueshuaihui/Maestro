/**
 * WP-4 契约测试（交接包恢复面）：
 * - AC-32 `delivered` 未 `accepted` → 回到 `pending` 并重投；
 * - AC-33 `accepted` 不重投；AC-34 `consumed` / `rejected` / `expired` 不改；
 * - AC-35 重投成功后回到 `delivered`；
 * - AC-61 `created` 继续投递，包号与重试次数不变；
 * - AC-62 连续 3 次投递失败 → `expired` + 升级。
 *
 * 全部项目根用 `fs.mkdtemp(os.tmpdir())`，适配器为内存实现，不 spawn 进程。
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

const AT = '2026-11-09T10:00:00.000Z';
const GRAPH = getGraph('code-loop');

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

function makeNode(nodeId, overrides = {}) {
  return { nodeId, state: 'pending', phase: 'ready', round: 1, roleId: 'developer', ...overrides };
}

function makeHandoff(handoffId, overrides = {}) {
  return {
    handoffId,
    edge: { from: 'T-001', to: 'T-001', kind: 'forward' },
    from: 'T-001',
    to: 'T-001',
    state: 'delivered',
    round: 1,
    deliveryAttempts: 1,
    deliveredAt: AT,
    createdAt: AT,
    ...overrides,
  };
}

function makeFactory(options = {}) {
  const record = { created: 0, prompts: [], promptTexts: [] };
  const factory = {
    async create({ hostId, cwd } = {}) {
      record.created += 1;
      let calls = 0;
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
            return { ok: true, result: { sessionId: id } };
          },
          async loadSession(id) {
            return { ok: true, result: { sessionId: id } };
          },
        },
        async initialize() {
          return { ok: true };
        },
        async newSession() {
          return { ok: true, result: { sessionId: `new-${record.created}` } };
        },
        async prompt(sessionId, blocks) {
          record.prompts.push(sessionId);
          record.promptTexts.push(blocks?.[0]?.text ?? '');
          calls += 1;
          if (options.failPrompts === true) {
            return { ok: false, error: { code: 'HOST_ERROR', message: 'delivery refused' } };
          }
          if (Array.isArray(options.failures) && calls <= options.failures.length) {
            return options.failures[calls - 1]
              ? { ok: false, error: { code: 'HOST_ERROR', message: 'delivery refused' } }
              : { ok: true, result: { stopReason: 'end_turn' } };
          }
          return { ok: true, result: { stopReason: 'end_turn' } };
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
    env: { NODE_ENV: 'test', MAESTRO_TEST_DELIVERY_DELAY_MS: '5', ...env },
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
    // The hold point may already be past.
  }
}

/** Stop any live drive before removing the temp root (Windows file locks). */
async function teardown(orchestrator, root, instanceId) {
  await release(root);
  try {
    await orchestrator.cancel({ instanceId });
  } catch {
    // Terminal instances need no cancel.
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

test('AC-32 delivered 未 accepted → pending 并重投', async () => {
  const root = await tempRoot('ac32');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-032', cwd, {
    nodes: [makeNode('T-001')],
    handoffs: [makeHandoff('HO-032')],
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
  const held = await readDisk(root, 'INST-032');
  assert.equal(held.handoffs[0].state, 'pending');

  await release(root);
  const delivered = await waitFor(async () => {
    const disk = await readDisk(root, 'INST-032');
    return disk.handoffs[0].state === 'delivered';
  });
  assert.equal(delivered, true, 'recovery must redeliver the handoff');
  const prompted = await waitFor(() => record.prompts.length === 1);
  assert.equal(prompted, true, 'redelivery must actually prompt the target session');
  const disk = await readDisk(root, 'INST-032');
  assert.ok(disk.handoffs[0].deliveryAttempts >= 1);

  await new Promise((resolve) => setTimeout(resolve, 200));
  const events = await readEvents(root, 'INST-032');
  assert.equal(events.filter((event) => event.reason === 'recovery.connection').length, 1);
  await teardown(orchestrator, root, 'INST-032');
});

test('AC-33 accepted 未 consumed 不重投', async () => {
  const root = await tempRoot('ac33');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-033', cwd, {
    nodes: [makeNode('T-001', { state: 'running', phase: 'running' })],
    handoffs: [makeHandoff('HO-033', {
      state: 'accepted',
      acceptedAt: AT,
      deliveryAttempts: 1,
    })],
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const disk = await readDisk(root, 'INST-033');
  assert.equal(disk.handoffs[0].state, 'accepted');
  assert.equal(disk.handoffs[0].deliveryAttempts, 1);
  const events = await readEvents(root, 'INST-033');
  assert.equal(events.filter((event) => event.reason === 'handoff.pending').length, 0);
  assert.deepEqual(record.prompts, []);
  await teardown(orchestrator, root, 'INST-033');
});

test('AC-34 consumed / rejected / expired 恢复后逐字不变', async () => {
  const root = await tempRoot('ac34');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const handoffs = [
    makeHandoff('HO-034-A', { state: 'consumed', consumedAt: AT }),
    makeHandoff('HO-034-B', { state: 'rejected', rejectedAt: AT, rejectReason: 'verdict_fail' }),
    makeHandoff('HO-034-C', { state: 'expired', expiredAt: AT, deliveryAttempts: 3 }),
  ];
  await persist(store, makeState('INST-034', cwd, {
    nodes: [makeNode('T-001', { state: 'running', phase: 'running' })],
    handoffs,
  }));

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const disk = await readDisk(root, 'INST-034');
  assert.deepEqual(disk.handoffs.map((item) => item.state), ['consumed', 'rejected', 'expired']);
  assert.deepEqual(disk.handoffs.map((item) => item.deliveryAttempts), [1, 1, 3]);
  assert.deepEqual(record.prompts, []);
  await teardown(orchestrator, root, 'INST-034');
});

test('AC-35 重投成功后回到 delivered', async () => {
  const root = await tempRoot('ac35');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-035', cwd, {
    nodes: [makeNode('T-001')],
    handoffs: [makeHandoff('HO-035', { state: 'delivered', deliveryAttempts: 1 })],
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
  await release(root);
  const done = await waitFor(async () => {
    const disk = await readDisk(root, 'INST-035');
    return disk.handoffs[0].state === 'delivered' && disk.handoffs[0].deliveredAt !== AT;
  });
  assert.equal(done, true, 'pending -> delivered after redelivery');
  await new Promise((resolve) => setTimeout(resolve, 200));
  const events = await readEvents(root, 'INST-035');
  const reasons = events.map((event) => event.reason);
  assert.ok(reasons.includes('handoff.pending') || reasons.includes('recovery.connection'));
  await teardown(orchestrator, root, 'INST-035');
});

test('AC-61 created 交接包继续投递：包号与重试次数不变', async () => {
  const root = await tempRoot('ac61');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-061', cwd, {
    nodes: [makeNode('T-001')],
    handoffs: [makeHandoff('HO-061', {
      state: 'created',
      deliveryAttempts: 0,
      deliveredAt: null,
    })],
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
  await release(root);
  const delivered = await waitFor(async () => {
    const disk = await readDisk(root, 'INST-061');
    return disk.handoffs[0].state === 'delivered';
  });
  assert.equal(delivered, true);
  const disk = await readDisk(root, 'INST-061');
  assert.equal(disk.handoffs[0].handoffId, 'HO-061');
  assert.equal(disk.handoffs.filter((item) => item.handoffId === 'HO-061').length, 1);
  assert.equal(disk.handoffs[0].deliveryAttempts, 1);
  const events = await readEvents(root, 'INST-061');
  assert.equal(events.filter((event) => event.reason === 'recovery.handoff').length, 1);
  await teardown(orchestrator, root, 'INST-061');
});

test('AC-62 连续 3 次重投失败 → expired + 升级', async () => {
  const root = await tempRoot('ac62');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign', MAESTRO_TEST_DELIVERY_DELAY_MS: '5' },
    factory: { failPrompts: true },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-062', cwd, {
    nodes: [makeNode('T-001')],
    handoffs: [makeHandoff('HO-062', { state: 'delivered', deliveryAttempts: 0 })],
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
  await release(root);
  const expired = await waitFor(async () => {
    const disk = await readDisk(root, 'INST-062');
    return disk.handoffs[0].state === 'expired' && disk.escalations.length === 1;
  }, 8000);
  assert.equal(expired, true, 'third delivery failure must expire the handoff and escalate');
  const disk = await readDisk(root, 'INST-062');
  assert.equal(disk.handoffs[0].deliveryAttempts, 3);
  assert.equal(disk.escalations.length, 1);
  await teardown(orchestrator, root, 'INST-062');
});
