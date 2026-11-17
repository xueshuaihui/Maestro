/**
 * I1.11 WP-2 契约测试：人工干预队列投影与决策映射（src/daemon/queue.js）。
 *
 * 覆盖：AC-08（合并 / 排序 / 八字段 / 降级 / 空态 / 断线位）、AC-09 两现场
 * （终态节点 pass → completed；非终态 pass → running + 下游唤醒）、AC-10
 * （retry 轮次 +1）、AC-11 数据侧（终止 = 实例级取消，D-08）、AC-12（allow /
 * deny 走真实等待会话）、AC-13（跨实例互不影响 + 三处数字同步）、AC-15
 * （已处理不重复写）、AC-16 三异常（错配 / 未挂起 / 会话失效）、AC-44（pass
 * 只认轮次超限）、AC-17（与 CLI 同源，按各自分隔符拆字段值比较，D-37）。
 *
 * 夹具：$TMPDIR 独立根 + 真实 store / bus / orchestrator / daemon server。
 * 挂起现场按「先起核再写盘」口径直接落 state.json（`test.escalate` 接缝会在
 * 实例上留下活跃 run 句柄，使 getStatus 的 live 快照与磁盘脱节，属引擎既有
 * 行为，故不用它造挂起）；审批经 mock 宿主 `--permission=ask` + 策略 hold 走
 * 真实等待会话。每个用例自建自清。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { createAcpClient } from '../../src/adapter/acp-client.js';
import { createStdioTransport } from '../../src/adapter/stdio-transport.js';
import {
  buildQueue,
  cancelInstance,
  decideApproval,
  decideEscalation,
  QUEUE_LABELS,
} from '../../src/daemon/queue.js';
import { createClient } from '../../src/daemon/client.js';
import { createServer } from '../../src/daemon/server.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { renderApprovalLine, renderEscalationListRow } from '../../src/cli/render.js';

// 接缝（test.escalate）只在 NODE_ENV=test 注册；独立跑本文件时兜底设置。
process.env.NODE_ENV = 'test';

const MOCK = path.resolve('test/fixtures/mock-acp-agent.js');
const LIMITS = {
  initializeTimeoutMs: 8000,
  requestTimeoutMs: 8000,
  promptTimeoutMs: 8000,
  quietIdleMs: 30,
  quietCapMs: 200,
};
const CODE_TASK = '给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js';
const DOC_TASK = '写下 out/a.md';

// ------------------------------------------------------------------ 临时目录

const tempDirs = [];

function makeRoot(tag) {
  // 前缀必须短：核心管道 <root>/.orch/core.sock 受 macOS 104 字节路径上限约束。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14q-${tag}-`));
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

/** 真实 mock 宿主（stdio + ACP），与产品同一条装配链（wp8 同款）。 */
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

async function boot(tag, { script = [], mockSwitches = null, permissionPolicy = null } = {}) {
  const root = makeRoot(`${tag}-root`);
  const cwd = makeRoot(`${tag}-cwd`);
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const factory = mockSwitches ? makeMockFactory({ switches: mockSwitches }) : makeScriptedFactory(script);
  const orchestrator = createOrchestrator({
    store,
    bus,
    adapterFactory: factory,
    generation: 'gen-wp14',
    env: { NODE_ENV: 'test' },
    ...(permissionPolicy ? { permissionPolicy } : {}),
  });
  const server = createServer({ root, bus, orchestrator, generation: 'gen-wp14', logger: () => {} });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  return {
    root,
    cwd,
    store,
    bus,
    factory,
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

async function snapshotOf(env, instanceId) {
  const status = await env.orch.getStatus({ instanceId });
  assert.equal(status.ok, true, JSON.stringify(status));
  return status.snapshot;
}

async function queueOf(env, instanceIds) {
  const instances = [];
  for (const id of instanceIds) instances.push(await snapshotOf(env, id));
  return buildQueue(env.root, { instances });
}

/** 三处数字（AC-13 / BR-12）：[队列总条数, 托盘待升级数, 实例一待处理, 实例二待处理]。 */
async function countsOf(env) {
  const first = await snapshotOf(env, 'INST-001');
  const second = await snapshotOf(env, 'INST-002');
  const queue = buildQueue(env.root, { instances: [first, second] });
  const pendingOf = (snapshot) =>
    (Number.isInteger(snapshot.pendingEscalations) ? snapshot.pendingEscalations : 0) +
    (Number.isInteger(snapshot.pendingApprovals) ? snapshot.pendingApprovals : 0);
  return [queue.items.length, queue.totals.pendingEscalations, pendingOf(first), pendingOf(second)];
}

// -------------------------------------------------------------- 纯投影夹具

const ESCALATION_KEYS = ['escalationId', 'nodeId', 'round', 'reasonCode', 'reasonDetail', 'defects', 'state', 'createdAt', 'resolvedAt', 'resolution', 'voidedAt'];

function escEntry(id, overrides = {}) {
  const base = {
    escalationId: id,
    nodeId: 'T-001',
    round: 1,
    reasonCode: 'rounds_exceeded',
    reasonDetail: '轮次超限：第 1 轮',
    defects: [],
    state: 'pending',
    createdAt: '2026-11-15T10:30:00.000Z',
    resolvedAt: null,
    resolution: null,
    voidedAt: null,
  };
  return { ...base, ...overrides };
}

function approvalRow(id, overrides = {}) {
  return {
    approvalId: id,
    nodeId: 'T-001',
    sessionId: 'sess-001',
    action: 'write',
    toolCallId: 'tc-1',
    state: 'pending',
    createdAt: '2026-11-15T10:32:00.000Z',
    resolvedAt: null,
    resolution: null,
    ...overrides,
  };
}

function craftedState({ instanceId, cwd, template = 'single', nodes, sessions = [], escalations = [], approvals = [], state = 'suspended', task = DOC_TASK }) {
  return {
    schemaVersion: 2,
    instanceId,
    state,
    halted: false,
    paused: false,
    rev: 0,
    template,
    task,
    cwd,
    createdAt: '2026-11-15T10:00:00.000Z',
    stateSince: '2026-11-15T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes,
    sessions,
    handoffs: [],
    escalations,
    approvals,
  };
}

function escalatedNode({ roleId = 'worker', nodeId = 'T-001' } = {}) {
  return { nodeId, state: 'escalated', round: 1, roleId, sessionId: 'sess-001', artifactRefs: [] };
}

function escalatedSession() {
  return { sessionId: 'sess-001', state: 'escalated', nodeId: 'T-001', hostId: null, quarantined: false };
}

/** 落盘一个实例（先起核再写盘口径）。 */
async function saveInstance(env, instanceId, state) {
  const saved = await env.store.save(instanceId, state);
  assert.equal(saved.ok, true, JSON.stringify(saved));
}

// ------------------------------------------------------------------ 纯投影

test('buildQueue：跨实例合并、排序与统一八字段模板（AC-08 / BR-06 / BR-07）', () => {
  const snapshots = [
    {
      instanceId: 'INST-001',
      state: 'suspended',
      nodes: [{ nodeId: 'T-001', state: 'escalated', round: 1, roleId: 'worker' }],
      escalations: [escEntry('ESC-001')],
      approvals: [],
      pendingEscalations: 1,
      pendingApprovals: 0,
    },
    {
      instanceId: 'INST-002',
      state: 'suspended',
      nodes: [
        { nodeId: 'T-001', state: 'escalated', round: 2, roleId: 'developer' },
        { nodeId: 'T-002', state: 'pending', round: 0, roleId: 'tester' },
      ],
      escalations: [escEntry('ESC-002', { round: 2, reasonDetail: '执行失败：命令超时' })],
      approvals: [approvalRow('APR-001')],
      pendingEscalations: 1,
      pendingApprovals: 1,
    },
  ];
  const queue = buildQueue('/tmp/maestro-wp14-pure', { instances: snapshots });
  assert.deepEqual(
    queue.items.map((item) => item.id),
    ['ESC-001', 'ESC-002', 'APR-001'],
    '排序：升级在审批前，同类按编号升序（type → id → instanceId）',
  );
  assert.deepEqual(queue.totals, { pendingEscalations: 2, pendingApprovals: 1 });

  const KEYS = ['type', 'id', 'instanceId', 'nodeId', 'role', 'round', 'stateWord', 'reasonSummary', 'createdAt'];
  for (const item of queue.items) {
    assert.deepEqual(Object.keys(item), KEYS, '审批行与升级行是同一套八字段模板');
  }
  const approval = queue.items[2];
  assert.equal(approval.type, 'approval');
  assert.equal(approval.instanceId, 'INST-002');
  assert.equal(approval.nodeId, 'T-001');
  assert.equal(approval.role, '开发');
  assert.equal(approval.round, 2, '审批行轮次由 nodeId 反查节点当前轮次（D-19）');
  assert.equal(approval.stateWord, '待处理');
  assert.equal(approval.reasonSummary, '动作 write', '审批行原因摘要位固定写动作名');
  assert.equal(approval.createdAt, '2026-11-15T10:32:00.000Z');
});

test('buildQueue：无节点审批行轮次为 null、降级行标注状态不可读、断线位与空态（AC-08 / D-19 / BR-36 数据位）', () => {
  const queue = buildQueue('/tmp/maestro-wp14-pure', {
    instances: [
      { instanceId: 'INST-004', unreadable: true, pendingEscalations: 0, pendingApprovals: 1 },
      {
        instanceId: 'INST-005',
        nodes: [],
        escalations: [],
        approvals: [approvalRow('APR-009', { nodeId: null, sessionId: null })],
        pendingEscalations: 0,
        pendingApprovals: 1,
      },
    ],
  });
  assert.equal(queue.items.length, 2, '降级行不省略，段仍在');

  const noNode = queue.items[0];
  assert.equal(noNode.id, 'APR-009');
  assert.equal(noNode.nodeId, null, '无 nodeId 是既有允许态');
  assert.equal(noNode.round, null, '取不到节点 → 轮次为 null（界面渲染 —，D-19）');

  const degraded = queue.items[1];
  assert.equal(degraded.stateWord, QUEUE_LABELS.STATE_UNREADABLE);
  assert.equal(degraded.type, 'approval');
  assert.equal(degraded.instanceId, 'INST-004');
  assert.equal(degraded.nodeId, null);
  assert.equal(degraded.round, null);
  assert.deepEqual(Object.keys(degraded).length, 9, '降级行仍是同一模板，不缩字段');

  const offline = buildQueue('/tmp/maestro-wp14-pure', { instances: null });
  assert.equal(offline.disconnected, true, '实例清单取不到 → 断线位');
  assert.deepEqual(offline.items, []);
  assert.deepEqual(offline.totals, { pendingEscalations: 0, pendingApprovals: 0 });

  const empty = buildQueue('/tmp/maestro-wp14-pure', { instances: [] });
  assert.deepEqual(empty.items, [], '空队列 items 为空（空态文案「待处理 无」由界面渲染）');
  assert.deepEqual(empty.totals, { pendingEscalations: 0, pendingApprovals: 0 });
  assert.equal(QUEUE_LABELS.EMPTY, '待处理 无');
  assert.equal(QUEUE_LABELS.DISCONNECTED, '已断开 · 正在重连…');
});

test('buildQueue：totals 只读既有快照计数字段，不按数组重算（D-36 / AC-18 数据侧）', () => {
  const queue = buildQueue('/tmp/maestro-wp14-pure', {
    instances: [
      {
        instanceId: 'INST-001',
        nodes: [],
        escalations: [escEntry('ESC-001')],
        approvals: [],
        // 计数字段故意与数组不一致：投影必须逐字采用既有字段值。
        pendingEscalations: 5,
        pendingApprovals: 0,
      },
    ],
  });
  assert.equal(queue.totals.pendingEscalations, 5, 'totals 来自既有快照字段，不是 filter 计数');
  assert.equal(queue.items.length, 1, '条目仍按 pending 数组逐条投影');
});

// ------------------------------------------------------------------ 决策路径

test('升级·继续：终态节点判通过 → 实例已完成（AC-09 现场一 / D-39）', async () => {
  const env = await boot('pass-terminal', { script: [{}] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001')],
      }),
    );

    const before = await queueOf(env, ['INST-001']);
    assert.deepEqual(before.items.map((item) => item.id), ['ESC-001']);
    assert.equal(before.items[0].stateWord, '待处理');

    const res = await decideEscalation(env.root, 'ESC-001', 'pass');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.resolution, 'pass');
    assert.equal(res.result.state, 'completed');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'completed', '终态节点判通过 → 实例「已完成」');
    assert.equal(disk.nodes[0].state, 'done');
    assert.equal(disk.escalations[0].state, 'resolved');
    assert.equal(disk.escalations[0].resolution, 'pass');

    const after = await queueOf(env, ['INST-001']);
    assert.deepEqual(after.items, [], '处置后条目消失');
    assert.deepEqual(after.totals, { pendingEscalations: 0, pendingApprovals: 0 });
  } finally {
    await env.teardown();
  }
});

test('升级·继续：非终态节点判通过 → 保持运行中且下游被唤醒（AC-09 现场二 / D-39）', async () => {
  const env = await boot('pass-midway', { script: [{ hold: true }] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        template: 'code-loop',
        task: CODE_TASK,
        nodes: [
          escalatedNode({ roleId: 'developer', nodeId: 'T-001' }),
          { nodeId: 'T-002', state: 'pending', round: 0, roleId: 'tester', sessionId: null },
        ],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001', { reasonDetail: '轮次超限：开发已派发 2 次' })],
      }),
    );
    // 正向交接包会引用 T-001 的产物证据（回退到任务里的「产物：calc.js」行）：
    // 文件必须真实可读，否则派发以 handoff_invalid 升级。
    fs.writeFileSync(path.join(env.cwd, 'calc.js'), 'module.exports = {};\n', 'utf8');

    const res = await decideEscalation(env.root, 'ESC-001', 'pass');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.resolution, 'pass');
    assert.equal(res.result.state, 'running', '非终态节点判通过 → 实例保持「运行中」');

    let disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'running');
    assert.equal(disk.nodes[0].nodeId, 'T-001');
    assert.equal(disk.nodes[0].state, 'done', 'T-001（非终态）判通过 → done');
    // 派发相对裁决异步落地：等下游进入执行后再断言。
    await waitFor(async () => {
      const fresh = (await env.store.load('INST-001')).state;
      const target = fresh.nodes.find((node) => node.nodeId === 'T-002');
      return target?.state === 'running' && !!target?.sessionId;
    });
    disk = (await env.store.load('INST-001')).state;
    const downstream = disk.nodes.find((node) => node.nodeId === 'T-002');
    assert.ok(downstream, '下游节点存在');
    assert.equal(downstream.state, 'running', '下游 T-002 被唤醒并进入执行');
    assert.ok(downstream.sessionId, '下游绑定到会话');

    const after = await queueOf(env, ['INST-001']);
    assert.deepEqual(after.items, [], '队列清空');
  } finally {
    await env.teardown();
  }
});

test('升级·重派：轮次 +1、绑定新会话、实例回到运行中（AC-10）', async () => {
  const env = await boot('retry', { script: [{ hold: true }] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001')],
      }),
    );

    const res = await decideEscalation(env.root, 'ESC-001', 'retry');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.resolution, 'retry');
    assert.equal(res.result.dispatched, true);

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'running');
    assert.equal(disk.nodes[0].round, 2, '重派后该节点轮次变为 2');
    assert.ok(disk.nodes[0].sessionId, '节点绑定到一个会话');
    const session = disk.sessions[disk.sessions.length - 1];
    assert.equal(session.sessionId, disk.nodes[0].sessionId);
    assert.equal(disk.escalations[0].resolution, 'retry');

    const after = await queueOf(env, ['INST-001']);
    assert.deepEqual(after.items, [], '队列中该条消失');
  } finally {
    await env.teardown();
  }
});

test('升级·终止：实例级取消，待处理升级作废、条目消失（AC-11 数据侧 / D-08）', async () => {
  const env = await boot('cancel', { script: [{}] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001', { reasonCode: 'execution_failed', reasonDetail: '执行失败：boom' })],
      }),
    );
    const before = await queueOf(env, ['INST-001']);
    assert.equal(before.items.length, 1);

    const res = await cancelInstance(env.root, 'INST-001');
    assert.equal(res.ok, true, JSON.stringify(res));

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'cancelled', '终止 = 实例级取消');
    assert.equal(disk.escalations[0].state, 'voided', '待处理升级随取消作废');

    const after = await queueOf(env, ['INST-001']);
    assert.deepEqual(after.items, [], '队列不再显示它');
  } finally {
    await env.teardown();
  }
});

test('继续只对轮次超限可用：其它升级返回 ACTION_NOT_SUPPORTED 且不生效（AC-44 / U-5 数据侧）', async () => {
  const env = await boot('pass-guard', {});
  try {
    await env.store.save(
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [
          escEntry('ESC-001', { reasonCode: 'execution_failed', reasonDetail: '执行失败：boom' }),
          escEntry('ESC-002', {}),
        ],
      }),
    );

    const denied = await decideEscalation(env.root, 'ESC-001', 'pass');
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'ACTION_NOT_SUPPORTED');
    assert.equal(denied.hint, QUEUE_LABELS.PASS_UNAVAILABLE, '悬停说明逐字');
    assert.equal(denied.params.reasonCode, 'execution_failed');

    let disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'suspended', '强行点击后实例仍挂起');
    assert.equal(disk.escalations[0].state, 'pending', 'ESC-001 仍待处理');
    assert.equal(disk.escalations[0].resolution, null, '不产生裁决');

    const allowed = await decideEscalation(env.root, 'ESC-002', 'pass');
    assert.equal(allowed.ok, true, JSON.stringify(allowed));
    assert.equal(allowed.result.resolution, 'pass', '轮次超限的升级点得动');

    disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.escalations[1].resolution, 'pass');
    assert.equal(disk.escalations[0].state, 'pending', '另一条不受影响');
  } finally {
    await env.teardown();
  }
});

test('已处理不重复写：二次处置返回固定结论且不再落盘（AC-15 / D-13 / BR-09）', async () => {
  const env = await boot('already', { script: [{ hold: true }] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001')],
      }),
    );

    const first = await decideEscalation(env.root, 'ESC-001', 'retry');
    assert.equal(first.ok, true, JSON.stringify(first));

    const second = await decideEscalation(env.root, 'ESC-001', 'pass');
    assert.equal(second.ok, false);
    assert.equal(second.code, 'ESCALATION_NOT_PENDING');
    assert.equal(second.conclusion, '已处理', 'D-3 错误映射：已处理');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.nodes[0].round, 2, '轮次只按第一次处置变化');
    assert.equal(disk.escalations[0].resolution, 'retry', '不产生第二次裁决');
    assert.equal(disk.state, 'running');
  } finally {
    await env.teardown();
  }
});

test('动作错配：审批行点升级动作 / 升级行点审批动作 → ACTION_NOT_SUPPORTED（AC-16①）', async () => {
  const root = makeRoot('mismatch');
  const cwd = makeRoot('mismatch-cwd');
  const store = createStore({ root });
  await store.save(
    'INST-001',
    craftedState({
      instanceId: 'INST-001',
      cwd,
      nodes: [escalatedNode()],
      sessions: [escalatedSession()],
      escalations: [escEntry('ESC-001')],
      approvals: [approvalRow('APR-001')],
    }),
  );

  const wrongType = await decideEscalation(root, 'APR-001', 'pass');
  assert.equal(wrongType.ok, false);
  assert.equal(wrongType.code, 'ACTION_NOT_SUPPORTED', '升级动作打到审批条目 → 显式不支持');

  const wrongType2 = await decideApproval(root, 'ESC-001', 'allow');
  assert.equal(wrongType2.ok, false);
  assert.equal(wrongType2.code, 'ACTION_NOT_SUPPORTED', '审批动作打到升级条目 → 显式不支持');

  const disk = (await store.load('INST-001')).state;
  assert.equal(disk.state, 'suspended', '错配不改变任何状态');
  assert.equal(disk.escalations[0].state, 'pending');
  assert.equal(disk.approvals[0].state, 'pending');
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('实例未挂起：固定结论且原状态不变（AC-16②）', async () => {
  const env = await boot('not-suspended', { script: [{}] });
  try {
    await saveInstance(
      env,
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001')],
      }),
    );

    // 别处已把实例恢复为运行中（先起核再写盘口径）。
    const loaded = await env.store.load('INST-001');
    loaded.state.state = 'running';
    loaded.state.stateSince = '2026-11-15T11:00:00.000Z';
    await env.store.save('INST-001', loaded.state);

    const res = await decideEscalation(env.root, 'ESC-001', 'retry');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'INSTANCE_NOT_SUSPENDED');
    assert.equal(res.conclusion, '不是挂起状态', 'D-3 错误映射');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.state, 'running', '原状态不变');
    assert.equal(disk.escalations[0].state, 'pending', '升级仍待处理');
    assert.equal(disk.nodes[0].round, 1, '轮次不变');
  } finally {
    await env.teardown();
  }
});

test('审批会话失效：返回已失效且行仍待处理（AC-16③）', async () => {
  const env = await boot('session-gone', {});
  try {
    await env.store.save(
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [{ ...escalatedNode(), state: 'running' }],
        sessions: [{ sessionId: 'sess-001', state: 'waiting_input', nodeId: 'T-001', hostId: null, quarantined: false }],
        approvals: [approvalRow('APR-001')],
        state: 'running',
      }),
    );

    const res = await decideApproval(env.root, 'APR-001', 'allow');
    assert.equal(res.ok, false);
    assert.equal(res.code, 'APPROVAL_SESSION_GONE');
    assert.equal(res.conclusion, '已失效', 'D-3 错误映射：会话不在运行');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.approvals[0].state, 'pending', '绝不假放行，行仍待处理');
    assert.equal(disk.approvals[0].resolvedAt, null);
    assert.equal(disk.state, 'running');
  } finally {
    await env.teardown();
  }
});

test('审批·允许：真实等待会话被放行并继续（AC-12 allow）', async () => {
  const env = await boot('allow', {
    mockSwitches: ['--permission=ask', '--write-ref', 'out/a.md'],
    permissionPolicy: 'hold',
  });
  try {
    const started = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, earlyReturn: true });
    assert.equal(started.ok, true, JSON.stringify(started));
    await waitFor(async () => {
      const listed = await env.orch.listApprovals({ instanceId: 'INST-001' });
      return (listed.approvals ?? []).some((row) => row?.state === 'pending');
    });

    const res = await decideApproval(env.root, 'APR-001', 'allow');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.state, 'approved');
    assert.equal(res.result.resolution, 'allow');
    assert.equal(res.result.action, 'write');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.approvals[0].state, 'approved');
    assert.equal(disk.approvals[0].resolution, 'allow');

    await waitFor(async () => (await snapshotOf(env, 'INST-001')).state === 'completed', { timeoutMs: 20_000 });
    const after = await queueOf(env, ['INST-001']);
    assert.deepEqual(after.items, [], '审批行从队列消失，会话继续跑完');
  } finally {
    await env.teardown();
  }
});

test('审批·拒绝：真实等待会话被拒绝（AC-12 deny）', async () => {
  const env = await boot('deny', { mockSwitches: ['--permission=ask'], permissionPolicy: 'hold' });
  try {
    const started = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, earlyReturn: true });
    assert.equal(started.ok, true, JSON.stringify(started));
    await waitFor(async () => {
      const listed = await env.orch.listApprovals({ instanceId: 'INST-001' });
      return (listed.approvals ?? []).some((row) => row?.state === 'pending');
    });

    const res = await decideApproval(env.root, 'APR-001', 'deny');
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.state, 'denied');
    assert.equal(res.result.resolution, 'deny');

    const disk = (await env.store.load('INST-001')).state;
    assert.equal(disk.approvals[0].state, 'denied');
    assert.equal(disk.approvals[0].resolution, 'deny');

    const after = await queueOf(env, ['INST-001']);
    assert.equal(
      after.items.some((item) => item.type === 'approval'),
      false,
      '审批行从队列消失；实例状态按既有规则推进',
    );
  } finally {
    await env.teardown();
  }
});

test('跨实例分别处置互不影响，三处数字各自同步（AC-13 / BR-12）', async () => {
  const env = await boot('cross', { mockSwitches: ['--permission=ask'] });
  try {
    // D-54：按需求 Given 的实例号构造现场——INST-001 持升级、INST-002 持审批。
    // 先写 INST-001（先起核再写盘，执行失败第 1 轮），让 startRun 的
    // allocateInstanceId（现有最大 +1）把真实等待审批分到 INST-002。
    await env.store.save(
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        nodes: [escalatedNode()],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001', { reasonCode: 'execution_failed', reasonDetail: '执行失败：测试未通过' })],
      }),
    );

    // INST-002：真实等待审批（hold）——会话校验依赖内存 respond 句柄，
    // 必须走真实 startRun（手写 state 无法伪造，D-45）。
    assert.equal(env.orch.setApprovalPolicy('hold').ok, true);
    const started = await env.orch.startRun({ cwd: env.cwd, task: DOC_TASK, earlyReturn: true });
    assert.equal(started.ok, true, JSON.stringify(started));
    assert.equal(started.instanceId, 'INST-002', 'startRun 应分到 INST-002（INST-001 已占用）');
    await waitFor(async () => {
      const listed = await env.orch.listApprovals({ instanceId: 'INST-002' });
      return (listed.approvals ?? []).some((row) => row?.state === 'pending');
    });

    assert.deepEqual(await countsOf(env), [2, 1, 1, 1], '初始：队列 2 · 托盘 1 · 两实例各 1');

    // 第一步只影响 INST-001：重派其升级，INST-002 的审批原样不动。
    assert.equal(env.orch.setApprovalPolicy('allow').ok, true);
    const retried = await decideEscalation(env.root, 'ESC-001', 'retry');
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(retried.result.resolution, 'retry');

    const disk1 = (await env.store.load('INST-001')).state;
    assert.equal(disk1.nodes[0].round, 2, 'INST-001 轮次变 2');
    const disk2 = (await env.store.load('INST-002')).state;
    assert.equal(disk2.approvals[0].state, 'pending', 'INST-001 的处置不影响 INST-002 的审批');
    // 需求机检序列：处置升级后 [队列 1 · 托盘 0 · INST-001 0 · INST-002 1]。
    assert.deepEqual(await countsOf(env), [1, 0, 0, 1], '处置升级后：队列 1 · 托盘 0 · INST-001 清零 · INST-002 仍 1');

    // 第二步只影响 INST-002：允许其审批。
    const allowed = await decideApproval(env.root, 'APR-001', 'allow');
    assert.equal(allowed.ok, true, JSON.stringify(allowed));
    assert.equal(allowed.result.state, 'approved');

    assert.deepEqual(await countsOf(env), [0, 0, 0, 0], '处置审批后：三处清零');
  } finally {
    await env.teardown();
  }
});

test('队列与 CLI 同源：同一时点字段值一致，各按本侧分隔符拆（AC-17 / D-37）', async () => {
  const env = await boot('consistency', {});
  try {
    await env.store.save(
      'INST-001',
      craftedState({
        instanceId: 'INST-001',
        cwd: env.cwd,
        template: 'code-loop',
        task: CODE_TASK,
        nodes: [
          escalatedNode({ roleId: 'developer' }),
          { nodeId: 'T-002', state: 'pending', round: 0, roleId: 'tester', sessionId: null },
        ],
        sessions: [escalatedSession()],
        escalations: [escEntry('ESC-001', { reasonDetail: '执行失败：测试未通过' })],
        approvals: [approvalRow('APR-001')],
      }),
    );

    const snapshot = await snapshotOf(env, 'INST-001');
    const queue = buildQueue(env.root, { instances: [snapshot] });
    assert.deepEqual(queue.items.map((item) => item.id), ['ESC-001', 'APR-001']);

    // 升级行：CLI 按两个空格拆 5 段，与队列条目归一化为同六元组后逐项相等。
    const cliEscalation = renderEscalationListRow(snapshot.escalations[0], snapshot);
    const escParts = cliEscalation.split(/\s{2,}/);
    assert.equal(escParts.length, 5, `CLI 升级行按两个空格拆成 5 段：${cliEscalation}`);
    const nodeMatch = /^节点 (\S+) (\S+) · 第 (\d+) 轮$/.exec(escParts[2]);
    assert.ok(nodeMatch, `节点段形态：${escParts[2]}`);
    const escNormalized = {
      id: escParts[0].replace(/^升级 /, ''),
      instanceId: escParts[1].replace(/^实例 /, ''),
      nodeId: nodeMatch[1],
      round: Number(nodeMatch[3]),
      stateWord: escParts[3],
      reasonSummary: escParts[4],
    };
    const queueEscalation = queue.items[0];
    assert.deepEqual(escNormalized, {
      id: queueEscalation.id,
      instanceId: queueEscalation.instanceId,
      nodeId: queueEscalation.nodeId,
      round: queueEscalation.round,
      stateWord: queueEscalation.stateWord,
      reasonSummary: queueEscalation.reasonSummary,
    }, '升级条目：编号 / 实例 / 节点 / 轮次 / 状态词 / 原因摘要逐项相等');

    // 审批行：CLI 按 · 拆、只比 {编号, 状态词, 动作}；桌面行多出的实例 / 轮次 /
    // 时间三字段必须存在且非空，但不参与与 CLI 的相等比较（D-22 / D-37）。
    const cliApproval = renderApprovalLine(snapshot.approvals[0], snapshot, { template: 'code-loop' });
    const aprParts = cliApproval.split(' · ');
    assert.equal(aprParts.length, 3, `CLI 审批行 3 段：${cliApproval}`);
    const queueApproval = queue.items[1];
    assert.equal(aprParts[0], `审批 ${queueApproval.id} ${queueApproval.stateWord}`, '编号与状态词一致');
    assert.equal(aprParts[2], queueApproval.reasonSummary, '动作位一致（动作 write）');
    assert.notEqual(cliApproval, queueApproval.reasonSummary, '不出现「审批行字符串相等」这类断言');
    assert.ok(queueApproval.instanceId, '桌面审批行多出实例号');
    assert.ok(Number.isInteger(queueApproval.round), '桌面审批行多出轮次');
    assert.ok(queueApproval.createdAt, '桌面审批行多出产生时间');
  } finally {
    await env.teardown();
  }
});
