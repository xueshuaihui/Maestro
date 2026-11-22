/**
 * I1.11 WP-4 契约测试：全局角色占用投影（src/daemon/occupancy.js）。
 *
 * 覆盖：AC-26（跨实例聚合五字段：参与实例数、活跃会话数、服务节点并集、宿主
 * 并集（D-48）、最忙状态序 + 同源断言）、AC-27（空态与「未参与」不冒充「不可用」、实例不可读
 * 跳过并计数、注册表为空不判不可用、只读动作面）、AC-28（占用随运行时变化
 * 更新且与实例流程图同源——同一份 state.json 喂给既有 buildRoleInstances /
 * buildGraph 与本投影，角色集合与状态词一致）。
 *
 * 夹具红线（D-40）：占用投影读的是实例 `state.json`，`graph/pulse` 只写
 * overlay 不写 state，**全程禁用 pulse**——占用数据一律「先起核再写盘」经
 * store.save 手写 state.json，运行时变化经既有 `test.dispatch` 接缝真实派发
 * （真实写 state.json）。每个用例自建自清，`$TMPDIR` 独立根（短前缀 wp14o-）。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import {
  buildOccupancy,
  OCCUPANCY_LABELS,
  OCCUPANCY_STATUS_ORDER,
} from '../../src/daemon/occupancy.js';
import { buildGraph } from '../../src/daemon/graph.js';
import { createClient } from '../../src/daemon/client.js';
import { createServer } from '../../src/daemon/server.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { instanceDir, statePath } from '../../src/persistence/paths.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';
import { loadRegistry } from '../../src/registry/index.js';
import { getGraph } from '../../src/templates/index.js';

// 接缝（test.dispatch）只在 NODE_ENV=test 注册；独立跑本文件时兜底设置。
process.env.NODE_ENV = 'test';

const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 200,
};
const CODE_TASK = '给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js';
const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');

// ------------------------------------------------------------------ 临时目录

const tempDirs = [];

function makeRoot(tag) {
  // 前缀必须短：核心管道 <root>/.orch/core.sock 受 macOS 104 字节路径上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14o-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ 夹具

function sanitizedEnv() {
  const env = { ...process.env };
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  delete env.MAESTRO_PERMISSION_POLICY;
  return env;
}

/** 脚本化宿主：每次派发按脚本步执行（hold 挂住 / error 报错 / 默认完成）。 */
function makeScriptedFactory(script) {
  let index = 0;
  return {
    async create() {
      const step = script[index] ?? {};
      index += 1;
      let rejectHold = null;
      return {
        async initialize() {
          return { ok: true };
        },
        async newSession() {
          return { ok: true, result: { sessionId: `fake-sess-${index}` } };
        },
        async prompt() {
          if (step.hold) {
            return new Promise((resolve, reject) => {
              rejectHold = reject;
            });
          }
          if (step.error) {
            return { ok: false, error: { code: -32603, message: `宿主错误：${step.error}` } };
          }
          return { ok: true, result: { stopReason: 'end_turn' } };
        },
        async cancel() {
          if (rejectHold) rejectHold(new Error('cancelled'));
          return { ok: true };
        },
        onUpdate() {},
        async dispose() {},
      };
    },
  };
}

/** 真实 mock 宿主（stdio + ACP），与产品同一条装配链（wp14q 同款）。 */
function makeMockFactory({ switches = [] } = {}) {
  return {
    async create({ cwd }) {
      const transport = createStdioTransport({
        command: process.execPath,
        args: [MOCK, ...switches],
        env: sanitizedEnv(),
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
        onPermission: (cb) => client.onPermission(cb),
        dispose: () => client.dispose(),
      };
    },
  };
}

/** 先起核再写盘口径：核心与守护进程先起，state.json 一律经 store.save 落盘。 */
async function boot(tag, { mockSwitches = null, script = [{}] } = {}) {
  const root = makeRoot(`${tag}-root`);
  const cwd = makeRoot(`${tag}-cwd`);
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const factory = mockSwitches ? makeMockFactory({ switches: mockSwitches }) : makeScriptedFactory(script);
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: factory,
    generation: 'gen-wp14o',
    env: { NODE_ENV: 'test' },
  });
  const server = createServer({ root, bus, orchestrator, generation: 'gen-wp14o', logger: () => {} });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  return {
    root,
    cwd,
    store,
    bus,
    orch: orchestrator,
    server,
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

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** 等 state.json 的 rev 静默（回合帧写盘收敛），避免与在途宿主帧的 CAS 写冲突。 */
async function waitForRevSettled(store, instanceId, { quietMs = 600, timeoutMs = 15_000 } = {}) {
  let lastRev = null;
  let lastChange = Date.now();
  await waitFor(async () => {
    const disk = await store.load(instanceId);
    const rev = disk.ok ? disk.state.rev : null;
    if (rev !== lastRev) {
      lastRev = rev;
      lastChange = Date.now();
    }
    return Date.now() - lastChange >= quietMs;
  }, { timeoutMs, intervalMs: 50 });
}

function craftedState({ instanceId, cwd, template = 'single', state = 'running', nodes = [], sessions = [] }) {
  return {
    schemaVersion: 2,
    instanceId,
    state,
    halted: false,
    paused: false,
    rev: 0,
    template,
    task: '写一份说明文档',
    cwd,
    createdAt: '2026-11-15T10:00:00.000Z',
    stateSince: '2026-11-15T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes,
    sessions,
    handoffs: [],
    escalations: [],
    approvals: [],
  };
}

function node({ nodeId, roleId, state, round = 0, sessionId = null }) {
  return {
    nodeId,
    state,
    round,
    roleId,
    sessionId,
    stateSince: '2026-11-15T10:00:00.000Z',
    startedAt: null,
    roundStartedAt: null,
    endedAt: null,
    failure: null,
    note: null,
    verdict: null,
    artifactRefs: [],
  };
}

function session({ sessionId, nodeId, state = 'running', hostId = 'mock' }) {
  return { sessionId, state, nodeId, hostId, quarantined: false };
}

async function saveInstance(env, instanceId, state) {
  const saved = await env.store.save(instanceId, state);
  assert.equal(saved.ok, true, JSON.stringify(saved));
}

/**
 * WP-7 未来收集占用的同款口径（数据侧预演）：逐实例读 state.json（D-40），
 * 不可读的实例转成 `{ instanceId, unreadable: true, reason }` 交给投影跳过。
 */
async function instancesFromDisk(store, instanceIds) {
  const instances = [];
  for (const id of instanceIds) {
    const loaded = await store.load(id);
    if (loaded.ok) instances.push(loaded.state);
    else instances.push({ instanceId: id, unreadable: true, reason: loaded.code ?? null });
  }
  return instances;
}

function rowOf(result, roleId) {
  return result.rows.find((row) => row.roleId === roleId) ?? null;
}

// ------------------------------------------------------------------ AC-26

test('buildOccupancy：跨实例聚合五字段与最忙状态序（AC-26 / BR-16 / D-5 / D-48）', async () => {
  const env = await boot('agg');
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        template: 'code-loop',
        nodes: [
          node({ nodeId: 'T-001', roleId: 'developer', state: 'running', sessionId: 's1' }),
          node({ nodeId: 'T-002', roleId: 'reviewer', state: 'running', sessionId: 's3' }),
          node({ nodeId: 'T-003', roleId: 'reviewer', state: 'running' }),
          node({ nodeId: 'T-005', roleId: 'reviewer', state: 'running' }),
          node({ nodeId: 'T-006', roleId: 'tester', state: 'done' }),
        ],
        sessions: [
          session({ sessionId: 's1', nodeId: 'T-001' }),
          session({ sessionId: 's1b', nodeId: 'T-001' }),
          session({ sessionId: 's3', nodeId: 'T-002' }),
        ],
      }),
    );
    await saveInstance(
      env,
      'INST-002',
      craftedState({
        instanceId: 'INST-002',
        cwd: env.cwd,
        template: 'code-loop',
        nodes: [node({ nodeId: 'T-004', roleId: 'developer', state: 'running', sessionId: 's4' })],
        sessions: [session({ sessionId: 's4', nodeId: 'T-004' })],
      }),
    );

    const instances = await instancesFromDisk(env.store, ['INST-001', 'INST-002']);
    const result = buildOccupancy(env.root, { instances });

    assert.deepEqual(skippedOf(result), [], '可读实例不产生跳过');
    for (const row of result.rows) {
      assert.deepEqual(
        Object.keys(row),
        ['roleId', 'roleName', 'group', 'instances', 'activeSessions', 'servingNodes', 'status', 'hosts'],
        '行是 §2.5 的八字段模板，不缩字段（D-48）',
      );
    }

    const dev = rowOf(result, 'developer');
    assert.ok(dev, '开发行存在');
    assert.equal(dev.roleName, '开发', '中文名来自注册表');
    assert.equal(dev.group, 'coding', '分组来自注册表');
    assert.equal(dev.instances, 2, '参与实例计数');
    assert.equal(dev.activeSessions, 3, '活跃会话跨实例求和（2 + 1）');
    assert.deepEqual(dev.servingNodes, ['T-001', 'T-004'], '服务节点并集（≤ 2 个逐个列出）');
    assert.equal(dev.status, '服务中');
    assert.deepEqual(dev.hosts, ['mock'], '宿主并集来自参与实例的会话宿主（D-48 / A-6 宿主 mock）');

    const rev = rowOf(result, 'reviewer');
    assert.ok(rev, '审核者行存在（单实例里服务三个节点）');
    assert.equal(rev.instances, 1);
    assert.equal(rev.activeSessions, 1);
    assert.equal(rev.servingNodes.length, 3, '服务节点数组保留全部 3 个（折叠是界面职责）');
    assert.deepEqual(rev.servingNodes, ['T-002', 'T-003', 'T-005'], '并集按字典序，首个为 T-002');
    assert.equal(rev.status, '服务中');
    assert.deepEqual(rev.hosts, ['mock'], '宿主并集去重升序（D-48）');

    const tst = rowOf(result, 'tester');
    assert.ok(tst, '测试行存在（只有已完成节点 → 冷却中）');
    assert.equal(tst.instances, 1);
    assert.equal(tst.activeSessions, 0);
    assert.deepEqual(tst.servingNodes, []);
    assert.equal(tst.status, '冷却中');
    assert.deepEqual(tst.hosts, ['mock'], '冷却行仍透出参与实例的宿主（A-6 测试行宿主 mock）');

    const coord = rowOf(result, 'coordinator');
    assert.ok(coord, '模板声明但未绑定节点的角色出现（夹具预期）');
    assert.equal(coord.roleName, '协调者');
    assert.equal(coord.status, '未参与', '声明未绑定 → 未参与，不是不可用');
    assert.equal(coord.instances, 0, '参与实例按绑定节点计：仅声明不累计');
    assert.deepEqual(coord.hosts, [], '未参与行无运行时记录 → 宿主空数组（A-6 宿主 —）');

    // 最忙状态序：服务中在前（同档按角色名升序），其次冷却中，未参与最后。
    const order = result.rows.map((row) => row.roleId);
    const idx = (roleId) => order.indexOf(roleId);
    assert.ok(idx('developer') < idx('reviewer'), '同档按角色名升序：开发 < 审核者');
    assert.ok(idx('reviewer') < idx('tester'), '服务中档整体在冷却中档之前');
    for (let i = 0; i < idx('tester'); i += 1) {
      assert.ok(['服务中', '可用'].includes(result.rows[i].status), '冷却中之前只有服务中/可用档');
    }
    for (let i = idx('tester') + 1; i < order.length; i += 1) {
      assert.equal(result.rows[i].status, '未参与', '冷却中之后只有未参与档');
    }
    assert.ok(OCCUPANCY_STATUS_ORDER[0] === '服务中' && OCCUPANCY_STATUS_ORDER[4] === '未参与');

    // 同源断言：同一份 state.json 喂给既有角色实例投影，绑定过节点的角色集合一致
    // （AC-28 锚点；lastAction 仅在有绑定节点时非空）。
    const reg = loadRegistry({ root: env.root }).roleMap;
    const runtimeRoleIds = new Set(
      instances
        .map((snapshot) =>
          buildRoleInstances({ state: snapshot, graph: getGraph(snapshot.template), roles: reg }),
        )
        .flatMap((built) =>
          built.roles.filter((view) => view.lastAction !== null).map((view) => view.roleId),
        ),
    );
    const occupancyRuntimeRoleIds = new Set(
      result.rows.filter((row) => row.instances > 0).map((row) => row.roleId),
    );
    assert.deepEqual([...occupancyRuntimeRoleIds].sort(), [...runtimeRoleIds].sort());
  } finally {
    await env.teardown();
  }
});

// ------------------------------------------------------------------ AC-27

test('buildOccupancy：空态、未参与不冒充不可用、不可读跳过计数（AC-27 / D-5）', async () => {
  // 现场一：没有任何实例 → 空行集（界面渲染「暂无角色占用」），无任何动作位。
  const emptyRoot = makeRoot('empty-root');
  const empty = buildOccupancy(emptyRoot, { instances: [] });
  assert.deepEqual(empty.rows, [], '没有实例 → 无行（暂无角色占用）');
  assert.deepEqual(skippedOf(empty), []);
  assert.deepEqual(Object.keys(empty), ['rows', 'skipped'], '导出动作清单为空（无 release / kick 位）');
  assert.equal(OCCUPANCY_LABELS.EMPTY, '暂无角色占用');

  const env = await boot('ac27');
  try {
    const reg = loadRegistry({ root: env.root });

    // 现场二：一个干净实例（无任何角色运行时记录）→ 注册表角色全部「未参与」。
    await saveInstance(
      env,
      'INST-001',
      craftedState({ instanceId: 'INST-001', cwd: env.cwd, template: null }),
    );
    const clean = buildOccupancy(env.root, {
      instances: await instancesFromDisk(env.store, ['INST-001']),
    });
    assert.equal(clean.rows.length, reg.roles.length, '行数 = 注册表角色数');
    for (const row of clean.rows) {
      assert.equal(row.status, '未参与', '干净实例不冒充不可用');
      assert.equal(row.instances, 0, '参与实例 0');
      assert.equal(row.activeSessions, 0, '活跃会话 0');
      assert.deepEqual(row.servingNodes, []);
      assert.notEqual(row.roleName, null, '注册表可读 → 中文名齐全');
    }
    assert.ok(clean.rows.every((row) => row.status !== '不可用'));

    // 现场三：一个实例 state.json 损坏 → 跳过并计数，可读实例照常计入。
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        template: 'code-loop',
        nodes: [node({ nodeId: 'T-001', roleId: 'developer', state: 'running', sessionId: 's1' })],
        sessions: [session({ sessionId: 's1', nodeId: 'T-001' })],
      }),
    );
    fs.mkdirSync(instanceDir(env.root, 'INST-BAD'), { recursive: true });
    fs.writeFileSync(statePath(env.root, 'INST-BAD'), 'not-json{', 'utf8');

    const mixed = buildOccupancy(env.root, {
      instances: await instancesFromDisk(env.store, ['INST-BAD', 'INST-001']),
    });
    assert.deepEqual(
      skippedOf(mixed),
      [{ instanceId: 'INST-BAD', reason: 'STATE_CORRUPT' }],
      '跳过条目带实例号与原因码，可断言',
    );
    const dev = rowOf(mixed, 'developer');
    assert.equal(dev.status, '服务中', '可读实例的角色照常计入');
    assert.equal(dev.instances, 1);
    assert.equal(OCCUPANCY_LABELS.SKIPPED.replace('{n}', String(skippedOf(mixed).length)),
      '1 个实例状态不可读，已跳过', '跳过提示模板逐字（A-6）');

    // 注册表为空：中文名 / 分组为 null（界面用 id 兜底），不判不可用（D-5）。
    const noRegistry = buildOccupancy(env.root, {
      instances: await instancesFromDisk(env.store, ['INST-001']),
      registry: new Map(),
    });
    const devNoReg = rowOf(noRegistry, 'developer');
    assert.equal(devNoReg.roleName, null, '注册表空 → 中文名 null');
    assert.equal(devNoReg.group, null, '注册表空 → 分组 null');
    assert.equal(devNoReg.status, '服务中', '绑定了服务节点的角色不因空表判不可用');
    const coordNoReg = rowOf(noRegistry, 'coordinator');
    assert.equal(coordNoReg.status, '未参与', '声明未绑定的角色不因空表判不可用');

    // 注册表非空但缺该角色：透传既有投影的 unknown-role 结论（不可用），不新增口径。
    const partialRegistry = buildOccupancy(env.root, {
      instances: await instancesFromDisk(env.store, ['INST-001']),
      registry: new Map([['ghost', { id: 'ghost', name: '幽灵', group: 'ops' }]]),
    });
    assert.equal(rowOf(partialRegistry, 'developer').status, '不可用');
    assert.equal(rowOf(partialRegistry, 'developer').roleName, null, '不在注册表 → 中文名 null');
    assert.equal(rowOf(partialRegistry, 'ghost').roleName, '幽灵', '注册表角色补「未参与」行');
  } finally {
    await env.teardown();
  }
});

test('buildOccupancy：断线位与终态实例并入未参与档（§2.5 边界 / A-9 口径）', () => {
  const root = makeRoot('edge-root');
  const offline = buildOccupancy(root, { instances: null });
  assert.equal(offline.disconnected, true, '实例清单取不到 → 断线位（同 buildQueue 形态）');
  assert.deepEqual(offline.rows, []);
  assert.deepEqual(skippedOf(offline), []);

  const result = buildOccupancy(root, {
    instances: [
      {
        schemaVersion: 2,
        instanceId: 'INST-001',
        state: 'completed',
        template: 'single',
        nodes: [node({ nodeId: 'T-001', roleId: 'developer', state: 'done' })],
        sessions: [],
      },
    ],
  });
  const dev = rowOf(result, 'developer');
  assert.equal(dev.instances, 1, '终态实例仍计入参与实例');
  assert.equal(dev.status, '未参与', '终态实例的角色并入未参与档（不产生新状态词）');
});

// ------------------------------------------------------------------ AC-28

/** 实例流程图（既有投影）里的角色令牌 ↔ 占用状态词，同一时点必须配得上（AC-28）。 */
const GRAPH_TOKEN_WORDS = { serving: '服务中', available: '可用', cooldown: '冷却中', unavailable: '不可用', inactive: '未参与' };

test('buildOccupancy：占用随真实派发更新且与流程图同源（AC-28 / BR-37 数据侧 / D-40）', async () => {
  // 真实 mock 宿主：tool_call_update(in_progress) 保持 3000ms，造出稳定的
  // 「服务中 + 活跃会话」观察窗（脚本化宿主发不出宿主帧，会话恒 idle，造不出
  // 活跃会话）。test.dispatch 接缝只透传派发不挂驱动循环（M-14），因此第二
  // 阶段按夹具允许的另一条路径落地：手写 state.json 把 T-001 置为已完成，再
  // 经 test.dispatch 真实派发 T-002 —— 全程禁 pulse，两个阶段的观察点都建立
  // 在真实 state.json 上。
  const env = await boot('live', { mockSwitches: ['--turn-delay-ms', '3000'] });
  try {
    // 正向交接包会引用 T-001 的产物证据：文件必须真实可读（同 queue 套路）。
    fs.writeFileSync(path.join(env.cwd, 'calc.js'), 'module.exports = {};\n', 'utf8');
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        template: 'code-loop',
        task: CODE_TASK,
        nodes: [
          node({ nodeId: 'T-001', roleId: 'developer', state: 'pending' }),
          node({ nodeId: 'T-002', roleId: 'tester', state: 'pending' }),
        ],
      }),
    );

    const reg = loadRegistry({ root: env.root }).roleMap;
    const graphOf = (snapshot) =>
      buildGraph({ state: snapshot, workflowDef: getGraph(snapshot.template), roles: reg });

    // 变化前：T-001 待执行、无活跃会话 → 开发「可用」。
    const beforeDisk = (await env.store.load('INST-001')).state;
    const before = buildOccupancy(env.root, { instances: [beforeDisk] });
    const beforeRow = rowOf(before, 'developer');
    assert.equal(beforeRow.status, '可用');
    assert.deepEqual(beforeRow.servingNodes, []);
    assert.equal(beforeRow.activeSessions, 0);

    // 经既有 test.dispatch 接缝真实派发（真实写 state.json），禁 pulse。
    const dispatched = await seam(env.root, 'test.dispatch', { instanceId: 'INST-001', nodeId: 'T-001' });
    assert.equal(dispatched.ok, true, JSON.stringify(dispatched));
    await waitFor(async () => {
      const disk = (await env.store.load('INST-001')).state;
      const target = disk.nodes.find((item) => item.nodeId === 'T-001');
      const bound = disk.sessions.find((item) => item.nodeId === 'T-001');
      return target?.state === 'running' && !!target?.sessionId && bound?.state !== 'idle';
    }, { timeoutMs: 20_000 });

    // 同一时点的三处读取：占用投影 / 既有角色实例投影 / 实例流程图投影。
    const disk1 = (await env.store.load('INST-001')).state;
    assert.equal(disk1.state, 'running', '实例保持运行中');
    const after1 = buildOccupancy(env.root, { instances: [disk1] });
    const row1 = rowOf(after1, 'developer');
    assert.equal(row1.status, '服务中', '派发后该行变服务中');
    assert.ok(row1.servingNodes.includes('T-001'), 'servingNodes 含 T-001');
    assert.equal(row1.activeSessions - beforeRow.activeSessions, 1, '活跃会话增量为 1');

    const proj1 = buildRoleInstances({ state: disk1, graph: getGraph('code-loop'), roles: reg });
    assert.equal(proj1.roles.find((view) => view.roleId === 'developer').status, 'busy',
      '同源：既有角色实例投影同点位为六态原始值');
    const graph1 = graphOf(disk1);
    const graphNode1 = graph1.nodes.find((item) => item.id === 'role:developer');
    assert.equal(GRAPH_TOKEN_WORDS[graphNode1.status], row1.status, '流程图令牌与占用状态词同点配对');
    // 同源（集合关系）：流程图角色节点（声明 ∪ 绑定）必须都出现在占用行里；
    // 反过来，占用行里参与实例数 > 0（绑定了节点）的角色必须都在流程图上。
    const graphRoleIds1 = graph1.nodes.filter((item) => item.type === 'role').map((item) => item.roleId);
    const occupancyRowIds1 = after1.rows.map((row) => row.roleId);
    for (const roleId of graphRoleIds1) {
      assert.ok(occupancyRowIds1.includes(roleId), `流程图角色 ${roleId} 在占用行中存在`);
    }
    for (const row of after1.rows.filter((item) => item.instances > 0)) {
      assert.ok(graphRoleIds1.includes(row.roleId), `占用角色 ${row.roleId} 在流程图上存在`);
    }

    // 第二阶段：T-001 完成（手写 state.json，夹具允许路径；会话回 idle 同
    // onPromptSettled 口径），再经 test.dispatch 真实派发下游 T-002。
    // 手写前先等阶段一的回合帧写盘收敛（rev 静默），避免与在途写冲突。
    await waitForRevSettled(env.store, 'INST-001');
    const mid = (await env.store.load('INST-001')).state;
    mid.nodes.find((item) => item.nodeId === 'T-001').state = 'done';
    const devSession = mid.sessions.find((item) => item.nodeId === 'T-001');
    if (devSession) devSession.state = 'idle';
    await saveInstance(env, 'INST-001', mid);
    const dispatched2 = await seam(env.root, 'test.dispatch', { instanceId: 'INST-001', nodeId: 'T-002' });
    assert.equal(dispatched2.ok, true, JSON.stringify(dispatched2));
    await waitFor(async () => {
      const disk = (await env.store.load('INST-001')).state;
      const first = disk.nodes.find((item) => item.nodeId === 'T-001');
      const second = disk.nodes.find((item) => item.nodeId === 'T-002');
      const bound = disk.sessions.find((item) => item.nodeId === 'T-002');
      return first?.state === 'done' && second?.state === 'running' && bound?.state !== 'idle';
    }, { timeoutMs: 20_000 });

    const disk2 = (await env.store.load('INST-001')).state;
    const after2 = buildOccupancy(env.root, { instances: [disk2] });
    const row2 = rowOf(after2, 'developer');
    assert.equal(row2.status, '冷却中', '无服务中节点、有已完成节点 → 冷却中');
    assert.deepEqual(row2.servingNodes, []);
    assert.equal(row2.activeSessions, 0);
    const testerRow = rowOf(after2, 'tester');
    assert.equal(testerRow.status, '服务中', '下游测试节点在执行 → 测试档「服务中」');
    assert.ok(testerRow.servingNodes.includes('T-002'), '测试的服务节点含 T-002');
    assert.equal(testerRow.activeSessions, 1);

    const proj2 = buildRoleInstances({ state: disk2, graph: getGraph('code-loop'), roles: reg });
    assert.equal(proj2.roles.find((view) => view.roleId === 'developer').status, 'cooldown');
    const graphNode2 = graphOf(disk2).nodes.find((item) => item.id === 'role:developer');
    assert.equal(GRAPH_TOKEN_WORDS[graphNode2.status], row2.status, '第二阶段两处状态词仍相同');
  } finally {
    await env.teardown();
  }
});

/** skipped 的承载方式：数组返回值上的非枚举属性（不污染 rows 的七字段模板）。 */
function skippedOf(result) {
  assert.ok(Array.isArray(result.rows), 'rows 是数组');
  assert.ok(Array.isArray(result.skipped), 'skipped 是数组');
  return result.skipped;
}
