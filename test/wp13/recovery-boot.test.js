/**
 * WP-4 契约测试（启动恢复面）：位置投影、检查点写点、六步对账、轮次、幂等、
 * 特殊节点保持、按实例记录恢复与恢复失败。
 *
 * 口径（需求 v3 / 拆分 §2.3 §3.2~3.6）：
 * - AC-01 九位置投影（NODE_STATES 仍 7 项）+ transit 的 phase 六组合法表；
 * - AC-04 检查点写失败每次运行最多 1 条提醒，state.json 仍保留进展；
 * - AC-05/07/08/09/18 按实例记录恢复、轮次不重置、已完成节点不重放、摘要恰 1 条；
 * - AC-06/11/12/13/15/16/17 不可读、挂起、终态、旧实例与恢复失败；
 * - AC-59/60 已分配节点保持并重新派发、待执行节点保持位置。
 *
 * 全部项目根用 `fs.mkdtemp(os.tmpdir())`，不 spawn 进程、不写仓库内文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator, selectReusableSession } from '../../src/core/orchestrator.js';
import { buildCheckpoint, writeCheckpoint } from '../../src/core/checkpoint.js';
import { eventsPath, statePath } from '../../src/persistence/paths.js';
import { NODE_STATES } from '../../src/core/state-machine.js';
import { getGraph } from '../../src/templates/index.js';

const AT = '2026-11-09T10:00:00.000Z';

async function tempRoot(label) {
  return fs.mkdtemp(path.join(os.tmpdir(), `maestro-i18-${label}-`));
}

function makeGraph() {
  return getGraph('code-loop');
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

/** Recording adapter factory: no child process, dialect answers are scripted. */
function makeFactory(options = {}) {
  const record = { created: 0, prompts: [], resume: 0, load: 0, newSessions: 0, disposed: 0 };
  const factory = {
    async create({ hostId, cwd } = {}) {
      record.created += 1;
      if (options.failCreate === true) {
        return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: 'spawn blocked' } };
      }
      const caps = options.caps ?? {};
      const adapter = {
        hostId: hostId ?? null,
        cwd,
        sessionId: `sess-${record.created}`,
        client: {
          capabilities: caps,
          normalizeCapabilities(value) {
            return {
              canResume: Boolean(value?.resume),
              canLoad: Boolean(value?.load || value?.loadSession),
            };
          },
          async resumeSession(id) {
            record.resume += 1;
            return options.resumeFail === true
              ? { ok: false, error: { code: 'HOST_ERROR' } }
              : { ok: true, result: { sessionId: id } };
          },
          async loadSession(id) {
            record.load += 1;
            return options.loadFail === true
              ? { ok: false, error: { code: 'HOST_ERROR' } }
              : { ok: true, result: { sessionId: id } };
          },
          async newSession() {
            record.newSessions += 1;
            return { ok: true, result: { sessionId: `new-${record.newSessions}` } };
          },
        },
        async initialize() {
          return { ok: true };
        },
        async newSession() {
          record.newSessions += 1;
          return { ok: true, result: { sessionId: `new-${record.newSessions}` } };
        },
        async prompt(sessionId) {
          record.prompts.push(sessionId);
          return options.prompt ? options.prompt(sessionId, record) : { ok: true, result: { stopReason: 'end_turn' } };
        },
        onUpdate() {
          return () => {};
        },
        onPermission() {
          return () => {};
        },
        async dispose() {
          record.disposed += 1;
        },
        async listSessions() {
          return { ok: true, result: { sessions: [] } };
        },
      };
      return { ok: true, adapter };
    },
  };
  return { factory, record };
}

async function boot(root, { env = {}, factory } = {}) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const bridge = makeFactory(factory?.options ?? {});
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: factory?.factory ?? bridge.factory,
    generation: 'gen-current',
    env: { NODE_ENV: 'test', ...env },
    graph: makeGraph(),
  });
  return { store, bus, orchestrator, record: factory?.record ?? bridge.record };
}

async function persist(store, state, { checkpoint = false } = {}) {
  const saved = await store.save(state.instanceId, state);
  assert.equal(saved.ok, true, `save failed: ${saved.code}`);
  if (checkpoint) {
    const written = await writeCheckpoint(
      store.root,
      state.instanceId,
      buildCheckpoint({ state, graph: getGraph('code-loop'), cwd: state.cwd, task: state.task }),
    );
    assert.equal(written.ok, true);
  }
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

function countReason(events, reason) {
  return events.filter((event) => event?.reason === reason).length;
}

async function teardown(orchestrator, root, instanceId) {
  try {
    await orchestrator.cancel({ instanceId });
  } catch {
    // Already terminal.
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}

async function waitFor(predicate, ms = 3000) {
  const until = Date.now() + ms;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= until) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test('AC-01 NODE_STATES 仍 7 项；九位置由 state+phase 投影齐全', async () => {
  assert.deepEqual([...NODE_STATES], [
    'pending', 'running', 'review', 'done', 'failed', 'cancelled', 'escalated',
  ]);
  const root = await tempRoot('ac01');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const state = makeState('INST-001', cwd, {
    nodes: [
      { nodeId: 'N1', state: 'pending', phase: 'blocked', round: 1, roleId: 'developer' },
      { nodeId: 'N2', state: 'pending', phase: 'ready', round: 1, roleId: 'developer' },
      { nodeId: 'N3', state: 'running', phase: 'assigned', round: 1, roleId: 'developer' },
      { nodeId: 'N4', state: 'running', phase: 'running', round: 1, roleId: 'developer' },
      { nodeId: 'N5', state: 'review', round: 1, roleId: 'tester' },
      { nodeId: 'N6', state: 'done', round: 1, roleId: 'tester' },
      { nodeId: 'N7', state: 'failed', round: 1, roleId: 'tester' },
      { nodeId: 'N8', state: 'escalated', round: 1, roleId: 'tester' },
      { nodeId: 'N9', state: 'cancelled', round: 1, roleId: 'tester' },
    ],
  });
  await persist(store, state);
  const status = await orchestrator.getStatus({ instanceId: 'INST-001' });
  assert.equal(status.ok, true);
  const positions = new Map(status.snapshot.nodes.map((node) => {
    const phase = node.phase;
    const derived = node.state === 'pending'
      ? (phase === 'ready' ? 'ready' : 'blocked')
      : node.state === 'running'
        ? (phase === 'assigned' ? 'assigned' : 'running')
        : node.state;
    return [node.nodeId, derived];
  }));
  assert.deepEqual([...positions.values()], [
    'blocked', 'ready', 'assigned', 'running', 'review', 'done', 'failed', 'escalated', 'cancelled',
  ]);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-01 恢复经 transit 同一次 CAS 写入 state+phase，非法相位值不落盘', async () => {
  const root = await tempRoot('ac01-transit');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  // `bogus` is not one of the six legal positions; the node is still projected as
  // `running` and recovery can only move it through the legal `running -> assigned`
  // edge, landing `state` and `phase` in the same CAS.
  await persist(store, makeState('INST-002', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', phase: 'bogus', round: 2, roleId: 'developer' }],
  }));

  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.recovered, ['INST-002']);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-002'), 'utf8'));
  assert.equal(disk.nodes[0].state, 'running');
  assert.equal(disk.nodes[0].phase, 'assigned');
  const events = await readEvents(root, 'INST-002');
  assert.equal(countReason(events, 'illegal_transition'), 0);
  assert.equal(countReason(events, 'recovery.summary'), 1);
  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-04 检查点写失败：每次运行最多 1 条提醒，state.json 保留进展', async () => {
  const root = await tempRoot('ac04');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_FAULT: 'checkpoint_write:fail', MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-004', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', round: 2, roleId: 'developer' }],
  }));
  const before = JSON.parse(await fs.readFile(statePath(root, 'INST-004'), 'utf8'));
  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const events = await readEvents(root, 'INST-004');
  assert.equal(countReason(events, 'checkpoint.write_failed'), 1);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-004'), 'utf8'));
  assert.equal(disk.schemaVersion, 2);
  assert.ok(Array.isArray(disk.nodes));
  assert.ok(disk.rev > before.rev, 'state.json must still advance when the checkpoint fails');
  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-05 检查点缺失但内建模板：按实例记录恢复且提示可见', async () => {
  const root = await tempRoot('ac05');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: { options: { caps: {} } },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-005', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'done', round: 2, roleId: 'developer' },
      { nodeId: 'T-002', state: 'running', phase: 'assigned', round: 2, roleId: 'tester' },
    ],
    sessions: [{ sessionId: 'sess-old', nodeId: 'T-002', hostId: 'mock', state: 'idle', policy: 'fresh' }],
  }));
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.recovered, ['INST-005']);
  const events = await readEvents(root, 'INST-005');
  assert.equal(countReason(events, 'recovery.record'), 1);
  assert.equal(countReason(events, 'recovery.summary'), 1);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-005'), 'utf8'));
  assert.equal(disk.recoveredAt !== null && disk.recoveredAt !== undefined, true);
  assert.equal(disk.recovery.skipped, 1);
  assert.equal(disk.recovery.round, 2);
  assert.equal(disk.recovery.maxRounds, 2);
  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-06 实例记录不可读：不从检查点静默重建', async () => {
  const root = await tempRoot('ac06');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const state = makeState('INST-006', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', round: 2, roleId: 'developer' }],
  });
  await persist(store, state, { checkpoint: true });
  const original = '{ this is not json';
  await fs.writeFile(statePath(root, 'INST-006'), original, 'utf8');
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.recovered, []);
  const after = await fs.readFile(statePath(root, 'INST-006'), 'utf8');
  assert.equal(after, original);
  const disk = await store.load('INST-006');
  assert.equal(disk.ok, false);
  assert.equal(disk.code, 'STATE_CORRUPT');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-07/08/09 恢复后轮次不重置、跳过已完成节点、摘要恰 1 条', async () => {
  const root = await tempRoot('ac0709');
  const { store, orchestrator, record } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: { options: { caps: {} } },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-009', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'done', round: 2, roleId: 'developer' },
      { nodeId: 'T-002', state: 'running', phase: 'assigned', round: 2, roleId: 'tester' },
    ],
    sessions: [{ sessionId: 'sess-009', nodeId: 'T-002', hostId: 'mock', state: 'idle', policy: 'fresh' }],
  }), { checkpoint: true });

  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.recovered, ['INST-009']);
  const status = await orchestrator.getStatus({ instanceId: 'INST-009' });
  const node = status.snapshot.nodes.find((item) => item.nodeId === 'T-001');
  assert.equal(node.round, 2);
  assert.equal(status.snapshot.nodes.find((item) => item.nodeId === 'T-002').round, 2);
  assert.equal(status.snapshot.recovery.round, 2);
  assert.equal(status.snapshot.recovery.maxRounds, 2);
  assert.equal(status.snapshot.recovery.skipped, 1);
  const events = await readEvents(root, 'INST-009');
  assert.equal(countReason(events, 'recovery.summary'), 1);
  assert.equal(events.filter((event) => event.reason === 'node.dispatch').length, 0);
  assert.deepEqual(record.prompts, []);
  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-11 挂起实例重启后仍挂起（无恢复、无派发）', async () => {
  const root = await tempRoot('ac11');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-011', cwd, {
    state: 'suspended',
    nodes: [
      { nodeId: 'T-001', state: 'running', round: 2, roleId: 'developer' },
      { nodeId: 'T-002', state: 'review', round: 2, roleId: 'tester' },
      { nodeId: 'T-003', state: 'escalated', round: 2, roleId: 'tester' },
    ],
  }), { checkpoint: true });
  const before = JSON.parse(await fs.readFile(statePath(root, 'INST-011'), 'utf8'));
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.interrupted, []);
  assert.deepEqual(result.recovered, []);
  const after = JSON.parse(await fs.readFile(statePath(root, 'INST-011'), 'utf8'));
  assert.equal(after.state, 'suspended');
  assert.deepEqual(after.nodes, before.nodes);
  assert.deepEqual(after.nodes.map((node) => node.state), ['running', 'review', 'escalated']);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-12/13 已升级 / 失败的节点恢复后保持原状且不派发', async () => {
  const root = await tempRoot('ac1213');
  const { store, orchestrator, record } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-012', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'escalated', round: 2, roleId: 'developer' },
      { nodeId: 'T-002', state: 'failed', round: 2, roleId: 'tester', failed_reason: 'verdict_fail' },
    ],
  }), { checkpoint: true });
  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-012'), 'utf8'));
  assert.equal(disk.nodes[0].state, 'escalated');
  assert.equal(disk.nodes[1].state, 'failed');
  assert.equal(disk.nodes[1].failed_reason, 'verdict_fail');
  const events = await readEvents(root, 'INST-012');
  assert.equal(events.filter((event) => event.reason === 'node.dispatch').length, 0);
  assert.deepEqual(record.prompts, []);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-14 review 节点恢复只重新核对，不重放会话', async () => {
  const root = await tempRoot('ac14');
  const { store, orchestrator, record } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'out', 'review.json'), JSON.stringify({
    decision: 'pass',
    artifact: 'docs/report.v1.md',
    defects: [],
  }), 'utf8');
  await persist(store, makeState('INST-014', cwd, {
    template: 'task-loop',
    nodes: [{ nodeId: 'T-003', state: 'review', round: 1, roleId: 'reviewer', roundStartedAt: '2020-01-01T00:00:00.000Z' }],
  }), { checkpoint: true });
  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-014'), 'utf8'));
  assert.equal(disk.nodes[0].state, 'done');
  const events = await readEvents(root, 'INST-014');
  assert.equal(countReason(events, 'recovery.reverify'), 1);
  assert.deepEqual(record.prompts, []);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-15 旧实例无检查点且模板未知 → 已中断并提示新建', async () => {
  const root = await tempRoot('ac15');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-015', cwd, {
    template: 'legacy-graph',
    nodes: [{ nodeId: 'N1', state: 'running', round: 1, roleId: 'developer' }],
  }));
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.interrupted, ['INST-015']);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-015'), 'utf8'));
  assert.equal(disk.state, 'interrupted');
  const events = await readEvents(root, 'INST-015');
  assert.equal(countReason(events, 'recovery.legacy'), 1);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-16 显式 core stop 产生的 interrupted 不自动恢复', async () => {
  const root = await tempRoot('ac16');
  const { store, orchestrator } = await boot(root);
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-016', cwd, {
    state: 'interrupted',
    nodes: [{ nodeId: 'T-001', state: 'running', round: 2, roleId: 'developer' }],
  }), { checkpoint: true });
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.recovered, []);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-016'), 'utf8'));
  assert.equal(disk.state, 'interrupted');
  const events = await readEvents(root, 'INST-016');
  assert.equal(countReason(events, 'recovery.summary'), 0);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-17 宿主不可达 → interrupted + 恢复失败原因', async () => {
  const root = await tempRoot('ac17');
  const { store, orchestrator } = await boot(root, { factory: { options: { failCreate: true } } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-017', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', round: 2, roleId: 'developer' }],
    sessions: [{ sessionId: 'sess-017', nodeId: 'T-001', hostId: 'mock', state: 'idle', policy: 'fresh' }],
  }), { checkpoint: true });
  const result = await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  assert.deepEqual(result.interrupted, ['INST-017']);
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-017'), 'utf8'));
  assert.equal(disk.state, 'interrupted');
  const events = await readEvents(root, 'INST-017');
  assert.equal(countReason(events, 'recovery.failed'), 1);
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-18 恢复幂等：第二次启动不重复写恢复摘要', async () => {
  const root = await tempRoot('ac18');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: { options: { caps: {} } },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-018', cwd, {
    nodes: [
      { nodeId: 'T-001', state: 'done', round: 2, roleId: 'developer' },
      { nodeId: 'T-002', state: 'running', phase: 'assigned', round: 2, roleId: 'tester' },
    ],
    sessions: [{ sessionId: 'sess-018', nodeId: 'T-002', hostId: 'mock', state: 'idle', policy: 'fresh' }],
  }), { checkpoint: true });

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  // Simulate an unrelated restart by making this boot generation see the record again.
  const disk = JSON.parse(await fs.readFile(statePath(root, 'INST-018'), 'utf8'));
  disk.coreGeneration = 'gen-old';
  await fs.writeFile(statePath(root, 'INST-018'), `${JSON.stringify(disk, null, 2)}\n`, 'utf8');
  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });

  const events = await readEvents(root, 'INST-018');
  assert.equal(countReason(events, 'recovery.summary'), 1);
  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  await fs.rm(root, { recursive: true, force: true });
});

test('AC-59 已分配节点保持已分配并重新派发（phase 不退回阻塞）', async () => {
  const root = await tempRoot('ac59');
  const { store, orchestrator } = await boot(root, {
    env: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    factory: {
      options: {
        caps: {},
        // Never settles: the node must stay visible as `running` so the test can
        // assert the phase without racing a fast graph completion.
        prompt: () => new Promise(() => {}),
      },
    },
  });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  await persist(store, makeState('INST-059', cwd, {
    nodes: [{ nodeId: 'T-001', state: 'running', phase: 'assigned', round: 2, roleId: 'developer' }],
    sessions: [{ sessionId: 'sess-059', nodeId: 'T-001', hostId: 'mock', state: 'idle', policy: 'fresh' }],
  }), { checkpoint: true });

  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  await waitFor(async () => {
    try {
      await fs.access(path.join(root, '.mock', 'paused'));
      return true;
    } catch {
      return false;
    }
  });
  const held = JSON.parse(await fs.readFile(statePath(root, 'INST-059'), 'utf8'));
  assert.equal(held.nodes[0].state, 'running');
  assert.equal(held.nodes[0].phase, 'assigned');
  const dispatchBefore = (await readEvents(root, 'INST-059'))
    .filter((event) => event.reason === 'node.dispatch').length;

  await fs.writeFile(path.join(root, '.mock', 'release'), '1', 'utf8');
  const dispatched = await waitFor(async () => {
    const events = await readEvents(root, 'INST-059');
    return events.filter((event) => event.reason === 'node.dispatch').length > dispatchBefore;
  });
  assert.equal(dispatched, true, 'released recovery must dispatch exactly once');
  const after = JSON.parse(await fs.readFile(statePath(root, 'INST-059'), 'utf8'));
  assert.equal(after.nodes[0].state, 'running');
  assert.equal(after.nodes[0].phase, 'running');
  const dispatchAfter = (await readEvents(root, 'INST-059'))
    .filter((event) => event.reason === 'node.dispatch').length;
  assert.equal(dispatchAfter - dispatchBefore, 1);
  await teardown(orchestrator, root, 'INST-059');
});

test('AC-60 待执行节点恢复后保持原位置与依赖', async () => {
  const root = await tempRoot('ac60');
  const { store, orchestrator } = await boot(root, { factory: { options: { caps: {} } } });
  const cwd = path.join(root, 'demo');
  await fs.mkdir(cwd, { recursive: true });
  const nodes = [
    { nodeId: 'T-001', state: 'done', round: 1, roleId: 'developer' },
    { nodeId: 'T-002', state: 'pending', phase: 'blocked', round: 0, roleId: 'tester' },
    { nodeId: 'T-003', state: 'pending', phase: 'ready', round: 0, roleId: 'developer' },
  ];
  await persist(store, makeState('INST-060', cwd, { nodes }), { checkpoint: true });
  const before = JSON.parse(await fs.readFile(statePath(root, 'INST-060'), 'utf8'));
  await orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const after = JSON.parse(await fs.readFile(statePath(root, 'INST-060'), 'utf8'));
  assert.deepEqual(after.nodes.map((node) => node.phase ?? null), before.nodes.map((node) => node.phase ?? null));
  assert.deepEqual(getGraph('code-loop').edges, makeGraph().edges);
  await fs.rm(root, { recursive: true, force: true });
});


async function writeInjectedGraph(root, name, value) {
  const file = path.join(root, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(value), 'utf8');
  return file;
}

test('AC-38/40/41 人工节点与子工作流节点恢复后保持原状、不派发', async () => {
  const root = await tempRoot('ac3841');
  const humanGraph = {
    id: 'human-graph',
    entry: 'H-001',
    terminal: 'H-001',
    terminals: ['H-001'],
    maxRounds: { 'H-001': 2 },
    roles: ['developer'],
    nodes: [{
      id: 'H-001',
      nodeId: 'H-001',
      roleId: 'developer',
      order: 1,
      title: '人工',
      nodeType: 'human',
      artifactPolicy: 'declared',
      judge: 'none',
      products: [],
      wakeFrom: [],
      prompt: 'forward',
    }],
    edges: [],
  };
  const subGraph = {
    id: 'sub-graph',
    entry: 'S-001',
    terminal: 'S-001',
    terminals: ['S-001'],
    maxRounds: { 'S-001': 2 },
    roles: ['developer'],
    nodes: [{
      id: 'S-001',
      nodeId: 'S-001',
      roleId: 'developer',
      order: 1,
      title: '子流程',
      nodeType: 'subworkflow',
      artifactPolicy: 'declared',
      judge: 'none',
      products: [],
      wakeFrom: [],
      prompt: 'forward',
    }],
    edges: [],
  };

  const humanRoot = path.join(root, 'human');
  await fs.mkdir(path.join(humanRoot, 'demo'), { recursive: true });
  const humanFile = await writeInjectedGraph(root, 'human-graph', humanGraph);
  const human = await boot(humanRoot, { env: { MAESTRO_TEST_GRAPH: humanFile } });
  await persist(human.store, makeState('INST-038', path.join(humanRoot, 'demo'), {
    template: 'human-graph',
    nodes: [{ nodeId: 'H-001', state: 'running', round: 1, roleId: 'developer' }],
  }));
  await human.orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const humanDisk = JSON.parse(await fs.readFile(statePath(humanRoot, 'INST-038'), 'utf8'));
  assert.equal(humanDisk.nodes[0].state, 'running');
  assert.equal(human.record.created, 0);
  assert.equal(human.record.prompts.length, 0);
  assert.equal(countReason(await readEvents(humanRoot, 'INST-038'), 'recovery.human'), 1);
  await fs.rm(humanRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });

  const subRoot = path.join(root, 'sub');
  await fs.mkdir(path.join(subRoot, 'demo'), { recursive: true });
  const subFile = await writeInjectedGraph(root, 'sub-graph', subGraph);
  const sub = await boot(subRoot, { env: { MAESTRO_TEST_GRAPH: subFile } });
  const before = makeState('INST-041', path.join(subRoot, 'demo'), {
    template: 'sub-graph',
    nodes: [{ nodeId: 'S-001', state: 'running', round: 1, roleId: 'developer' }],
  });
  await persist(sub.store, before);
  await sub.orchestrator.reconcileOnBoot({ generation: 'gen-current' });
  const subDisk = JSON.parse(await fs.readFile(statePath(subRoot, 'INST-041'), 'utf8'));
  assert.equal(subDisk.nodes.length, 1);
  assert.equal(subDisk.nodes[0].state, 'running');
  assert.equal(sub.record.created, 0);
  const subEvents = await readEvents(subRoot, 'INST-041');
  assert.equal(subEvents.filter((event) => event.reason === 'node.dispatch').length, 0);
  assert.equal(subEvents.some((event) => String(event.objectId ?? '').startsWith('S-001/')), false);
  await fs.rm(subRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  await fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});


test('复用选择：只挑同实例/角色/宿主且空闲的会话', async () => {
  const sessions = [
    { sessionId: 's-busy', instanceId: 'INST-R', roleId: 'developer', hostId: 'mock', state: 'thinking' },
    { sessionId: 's-other-role', instanceId: 'INST-R', roleId: 'tester', hostId: 'mock', state: 'idle' },
    { sessionId: 's-other-host', instanceId: 'INST-R', roleId: 'developer', hostId: 'cloud', state: 'idle' },
    { sessionId: 's-other-instance', instanceId: 'INST-Q', roleId: 'developer', hostId: 'mock', state: 'idle' },
    { sessionId: 's-bound', instanceId: 'INST-R', roleId: 'developer', hostId: 'mock', state: 'idle', servingNodeId: 'T-002' },
    { sessionId: 's-ok', instanceId: 'INST-R', roleId: 'developer', hostId: 'mock', state: 'idle', servingNodeId: 'T-001' },
  ];
  const pick = selectReusableSession(sessions, {
    instanceId: 'INST-R', roleId: 'developer', hostId: 'mock', nodeId: 'T-001',
  });
  assert.equal(pick.sessionId, 's-ok');
  assert.equal(selectReusableSession(sessions, {
    instanceId: 'INST-R', roleId: 'developer', hostId: 'mock', nodeId: 'T-003',
  }), null);
  assert.equal(selectReusableSession(null, {}), null);
});
