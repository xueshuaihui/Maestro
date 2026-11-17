/**
 * I1.10b WP-2：`test/wp14/drill-fixtures.test.js`（拆分 §4 WP-2 / D-9）。
 *
 * 夹具构造自检（不绑定 AC 判定）+ 回环接口面最小契约断言：
 * ① 5 条 GET 端点响应形状符合拆分 §3.3~§3.6（drill / nodes / connections /
 *    escalations / subworkflow），且 pulse 接缝对下钻投影生效（契约 A2 第二
 *    调用点：下钻路由复用与图流同一个 in-memory overlay）；
 * ② 产品路径自然升级（AC-22 同款「产品可达路径」）产出真实现场后连发两次
 *    `POST /instances/:id/escalations/:escalationId/continue`，第二次
 *    `code === 'ESCALATION_NOT_PENDING'`（AC-23① 端到端复核同口径，真实守卫
 *    非桩）；再经既有 CLI `escalate resolve`（B3 接缝）预置 resolved 现场，
 *    断言 pending 列表排除 resolved；
 * ③ `POST /hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` 错误形状（§3.7）；
 * ④ 五个投影导出（buildDrill / buildNodeDetail / buildConnectionPanel /
 *    buildEscalationList / buildSubflowGraph）对夹具快照的基本形状断言，五条
 *    齐全。
 *
 * ---------------------------------------------------------------------------------
 * F5-01 竞态最小实验（拆分 §7 风险 1，S2 开工第一步，动手写码前完成）
 * ---------------------------------------------------------------------------------
 * 命令：
 *   NODE_ENV=test node src/daemon/serve-entry.js --project %TEMP%/maestro-i10b-f501-probe --desktop
 *   POST /instances {template:'code-loop', task:'probe f501\n产物：calc.js'}
 *     （宿主 mock，launch 带 --accept-delay-ms 60000，实例停在「运行中」）
 *   读 state.json → rev=4, state=running
 *   外部替换 state.json：rev=9999 + 新增 probe 字段（模拟测试写盘）
 *   静置 5s → rev=9999、probe 字段仍在（此窗口核心无写盘动作）
 *   核心继续推进实例（mock 会话建立、T-001 失败升级）后复读：
 *     rev=10010、probe 字段被覆盖消失、state=suspended、ESC-001 pending
 *   再触发 `orch workflow pause`（核心 CAS 写）：rev 保持 10010（核心以自己的
 *     内存态续写；STORE_CONFLICT 后按磁盘 prevRev 重读续写，最终覆盖外部写入）
 * 结论：竞态成立 —— 核心对**有活跃 run 的实例**的后续写盘最终会以内存态覆盖
 *   外部替换（rev 从磁盘现值续写，probe 等外部字段被抹掉）；核心刚启动、实例
 *   尚未被驱动时写盘是安全的（无内存写者、无 getStatus 健康写路径）。
 * 是否触发回改：触发（不改 AC 判据）。回改路径 = 拆分 §7 风险 1 的处置：
 *   ① 本文件的静态投影夹具（场景 A）按 §3.3 铁序「先空目录起核再写盘」，且该
 *      实例核心绝不驱动（不 POST /instances、不对其调 getStatus 类写路径）；
 *   ② 一切行为场景（升级 / continue / resolve）一律走产品路径与既有裁决接缝
 *      （自然升级 = AC-22 口径；CLI `escalate resolve` = B3），内存态与磁盘
 *      同源，不做任何「替换 / 外部写运行中实例 state.json」的动作；pulse 属
 *      内存 overlay（不写盘），不受此竞态影响。
 *   补充事实：`test.escalate` 接缝只写盘（store CAS），活跃 run 的下一次
 *      saveLive 会覆盖它，且 CLI 的升级查找（instance.get → 活跃 run 返回
 *      内存态）看不见它 —— 因此在活跃实例上用 test.escalate 造现场不可行，
 *      与 F5-01 结论一致。
 * ---------------------------------------------------------------------------------
 *
 * 夹具纪律（D-9）：独立项目根放 %TEMP%（mkdtemp 前缀 maestro-i10b-）；一律
 * NODE_ENV=test；先起核再写盘（自检断言）；升级现场只由 test.escalate /
 * escalate resolve 真实接缝产出，不手写 state:'suspended' + escalations；
 * 测试内不硬编码平台差异（不起 bash，落盘一律 fs write）。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openHost, resetOpenHostDedup } from '../../src/adapter/host-open.js';
import {
  buildConnectionPanel,
  buildDrill,
  buildEscalationList,
  buildNodeDetail,
  buildSubflowGraph,
} from '../../src/daemon/drill.js';
// B1-01 防回归：期望文案从 CLI labels 表读取，测试内不手写中文。
import { COMMAND_ERROR, ESCALATION_LABEL, ERROR_TEMPLATE } from '../../src/cli/labels.js';
import { escalationErrorText } from '../../src/daemon/http/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

// --------------------------------------------------------------------- helpers

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(makeValue, timeoutMs = 20_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

function envFor(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', ...extra };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS']) {
    delete env[key];
  }
  return env;
}

/** 起核（唯一起核方式：serve-entry --desktop，与 wp13 既有夹具同形）。 */
function startDesktopDaemon(root) {
  const child = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env: envFor(),
    stdio: 'ignore',
  });
  const ready = waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8'));
    } catch {
      return null;
    }
  }, 30_000);
  return { child, ready };
}

async function stopDaemon(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000);
  if (!exited) child.kill('SIGKILL');
}

function channel(meta) {
  const base = `http://127.0.0.1:${meta.port}`;
  const headers = { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' };
  return {
    async get(pathname) {
      const res = await fetch(`${base}${pathname}`, { headers });
      return { status: res.status, body: await res.json() };
    },
    async post(pathname, payload) {
      const res = await fetch(`${base}${pathname}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}

function writeHostConfig(root, hostId, config) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hostId}.json`), JSON.stringify(config, null, 2), 'utf8');
}

/**
 * 场景 B 宿主：**快速 mock**（无 accept-delay）。首派交接包证据不可读
 * （`产物：calc.js` 尚不存在）→ 产品路径在 ~0.5s 内自然升级（`handoff_invalid`，
 * 实例 suspended）—— 这是 AC-22 口径的「产品可达路径」真实产出。关键约束
 * （F5-01 实验结论）：升级必须走产品路径 / 既有裁决路径，让内存态与磁盘同源；
 * `test.escalate` 只写盘，会被活跃 run 的下一次 saveLive 覆盖、且 CLI 的
 * 升级查找（instance.get → 活跃 run 时返回内存态）看不见它，因此本文件
 * 不用 test.escalate 在活跃实例上造现场。
 */
function mockHostConfig() {
  return {
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK] },
    limits: {
      initializeTimeoutMs: 15_000,
      requestTimeoutMs: 15_000,
      promptTimeoutMs: 120_000,
      quietIdleMs: 30,
      quietCapMs: 200,
    },
  };
}

// ---------------------------------------------------------------- 场景 A 夹具

/**
 * 静态投影夹具（场景 A）：先空目录起核，再写一份核心绝不驱动的实例快照
 * （template code-loop，无 pending 升级 —— pending 现场一律由场景 B 的
 * 产品路径自然升级产出）。schemaVersion: 2。
 */
function sceneAState(root) {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    rev: 42,
    state: 'running',
    template: 'code-loop',
    createdAt: '2026-11-15T09:00:00.000Z',
    stateSince: '2026-11-15T09:40:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'running', round: 1, stateSince: '2026-11-15T09:40:00.000Z' },
      { nodeId: 'T-002', roleId: 'tester', state: 'pending', round: 1, stateSince: '2026-11-15T09:05:00.000Z' },
      { nodeId: 'Z-001', roleId: 'developer', state: 'mystery', round: 1, stateSince: '2026-11-15T09:00:00.000Z' },
    ],
    sessions: [
      {
        sessionId: 'SESS-A', nodeId: 'T-001', state: 'thinking', hostId: 'mock',
        createdAt: '2026-11-15T09:40:10.000Z', lastChangedAt: '2026-11-15T09:41:00.000Z',
        currentTool: 'write',
      },
      {
        sessionId: 'SESS-B', nodeId: 'T-001', state: 'finished', hostId: 'mock',
        createdAt: '2026-11-15T09:10:00.000Z', lastChangedAt: '2026-11-15T09:12:00.000Z',
      },
    ],
    handoffs: [
      {
        handoffId: 'HO-001', fromNodeId: 'T-001', toNodeId: 'T-002', kind: 'forward',
        state: 'delivered', round: 1, createdAt: '2026-11-15T09:41:00.000Z',
        deliveredAt: '2026-11-15T09:41:05.000Z', products: ['artifacts/code/calc.js'],
      },
      {
        handoffId: 'HO-002', fromNodeId: 'T-002', toNodeId: 'T-001', kind: 'backflow',
        state: 'rejected', round: 1, rejectReason: '下游拒绝',
        createdAt: '2026-11-15T09:50:00.000Z', rejectedAt: '2026-11-15T09:50:10.000Z',
        updatedAt: '2026-11-15T09:50:10.000Z',
        defects: [{ summary: '缺少断言', evidence: 'defects/d1.md' }],
        artifactRefs: ['logs/T-001.log'],
      },
    ],
    escalations: [
      {
        escalationId: 'ESC-002', nodeId: 'T-002', round: 1, state: 'resolved',
        reasonCode: 'execution_failed', reasonDetail: '历史失败，已恢复',
        defects: [], resolvedAt: '2026-11-15T10:00:00.000Z',
      },
    ],
    cwd: root,
  };
}

const SCENE_A_EVENTS = [
  { object: 'session', objectId: 'SESS-A', from: null, to: 'starting', result: 'applied', reason: 'state.change', seq: 1, ts: '2026-11-15T09:12:00.000Z' },
  { object: 'session', objectId: 'SESS-A', from: 'starting', to: 'running', result: 'applied', reason: 'state.change', seq: 2, ts: '2026-11-15T09:12:03.000Z' },
  { object: 'session', objectId: 'SESS-A', from: 'running', to: 'review', result: 'applied', reason: 'state.change', seq: 3, ts: '2026-11-15T09:15:41.000Z' },
  {
    object: 'session', objectId: 'SESS-A', result: 'note', reason: 'execution.summary', seq: 4,
    ts: '2026-11-15T09:15:42.000Z',
    detail: { nodeId: 'T-001', round: 1, summary: { command: 'npm test', exitCode: 1, keyOutputLines: 12, logRef: 'logs/T-001.log' } },
  },
];

async function writeSceneAInstance(root) {
  const dir = path.join(root, '.orch', 'instances', 'INST-001');
  fs.mkdirSync(dir, { recursive: true });
  const state = sceneAState(root);
  await fsp.writeFile(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
  await fsp.writeFile(
    path.join(dir, 'events.jsonl'),
    `${SCENE_A_EVENTS.map((event) => JSON.stringify(event)).join('\n')}\n`,
    'utf8',
  );
  return state;
}

// ---------------------------------------------------------------- 共享夹具状态

let sceneA = null;
async function getSceneA() {
  if (sceneA) return sceneA;
  const root = tmpRoot('maestro-i10b-fixA-');
  const { child, ready } = startDesktopDaemon(root);
  const meta = await ready;
  assert.ok(meta, '场景 A：desktop.json 未生成（核心未起来）');
  // 自检：核心已起、实例尚未写盘（空目录先起核）。
  const api = channel(meta);
  const before = await api.get('/instances');
  assert.equal(before.status, 200);
  assert.equal(before.body.items.length, 0, '场景 A：写盘前实例列表必须为空');
  // mock 宿主配置（无 open 段）；open 成功路径用独立的 opener 宿主。
  writeHostConfig(root, 'mock', mockHostConfig());
  writeHostConfig(root, 'opener', {
    open: {
      command: process.execPath,
      args: ['-e', "require('fs').appendFileSync(process.env.MAESTRO_OPEN_PROBE, 'x\\n')"],
    },
  });
  const state = await writeSceneAInstance(root);
  sceneA = { root, child, meta, api, state };
  return sceneA;
}

let sceneB = null;
async function getSceneB() {
  if (sceneB) return sceneB;
  const root = tmpRoot('maestro-i10b-fixB-');
  const { child, ready } = startDesktopDaemon(root);
  const meta = await ready;
  assert.ok(meta, '场景 B：desktop.json 未生成（核心未起来）');
  writeHostConfig(root, 'dsh', mockHostConfig());
  const api = channel(meta);
  const started = await api.post('/instances', {
    template: 'code-loop',
    task: '实现 calc.js\n产物：calc.js',
  });
  assert.equal(started.status, 200, `场景 B 启动失败：${JSON.stringify(started.body)}`);
  const instanceId = started.body.instanceId;
  assert.equal(typeof instanceId, 'string');
  const listed = await waitFor(async () => {
    const res = await api.get('/instances');
    return res.body.items.find((item) => item.instanceId === instanceId) ?? null;
  }, 10_000);
  assert.ok(listed, '场景 B：实例未在 10s 内入列');
  sceneB = { root, child, meta, api, instanceId };
  return sceneB;
}

// ------------------------------------------------------------------- 场景 A 测试

test('夹具构造自检：先起核再写盘、schemaVersion 2、独立项目根在 %TEMP% 下', async () => {
  const fixture = await getSceneA();
  // desktop.json（核心就绪标志）先于实例目录存在 —— 顺序在 getSceneA 内已经
  // 用「写盘前 GET /instances 为空」断言过，这里再核文件层事实。
  const metaStat = fs.statSync(path.join(fixture.root, '.orch', 'desktop.json'));
  const stateStat = fs.statSync(path.join(fixture.root, '.orch', 'instances', 'INST-001', 'state.json'));
  assert.ok(metaStat.birthtimeMs <= stateStat.birthtimeMs, '先起核再写盘');
  assert.equal(fixture.state.schemaVersion, 2);
  assert.ok(fixture.root.startsWith(os.tmpdir()), `项目根必须在 %TEMP% 下：${fixture.root}`);
  assert.ok(path.basename(fixture.root).startsWith('maestro-i10b-'));
});

test('pulse 接缝真实产出 → 5 条 GET 响应形状（§3.3~§3.6）+ 契约 A2 overlay 生效', async () => {
  const { api, root, state } = await getSceneA();

  // 契约 A2：pulse 写的是图流同一个 in-memory overlay，下钻路由必须读到。
  const pulseRole = await api.post('/__test__/graph/pulse', {
    instanceId: 'INST-001', kind: 'role', key: 'developer', statuses: ['serving'],
  });
  assert.equal(pulseRole.status, 200, JSON.stringify(pulseRole.body));
  const pulseEdge = await api.post('/__test__/graph/pulse', {
    instanceId: 'INST-001', kind: 'connection', key: 'E-01', statuses: ['rejected'],
  });
  assert.equal(pulseEdge.status, 200, JSON.stringify(pulseEdge.body));

  // --- GET /instances/:id/drill/:roleId（§3.3） ---
  const drill = await api.get('/instances/INST-001/drill/developer');
  assert.equal(drill.status, 200);
  const drillBody = drill.body;
  assert.equal(drillBody.breadcrumb.key, 'DRILL_CRUMB_ROLE');
  assert.equal(drillBody.breadcrumb.instanceId, 'INST-001');
  assert.equal(drillBody.breadcrumb.roleId, 'developer');
  // overlay 第二调用点：pulse 把 developer 覆盖为 serving，下钻必须看到。
  assert.equal(drillBody.roleBar.statusToken, 'serving');
  for (const key of ['statusToken', 'statusReason', 'activeSessions', 'servingNodes', 'hostIcons', 'lastAction']) {
    assert.ok(key in drillBody.roleBar, `roleBar 缺字段 ${key}`);
  }
  assert.equal(drillBody.roleBar.statusReason, null);
  assert.equal(drillBody.roleBar.activeSessions, 2);
  assert.deepEqual(drillBody.roleBar.servingNodes, ['T-001']);
  assert.deepEqual(drillBody.roleBar.hostIcons, ['mock']);
  assert.equal(drillBody.roleBar.lastAction.nodeId, 'T-001');
  assert.equal(drillBody.roleBar.lastAction.maxRounds, 2);
  assert.ok(Array.isArray(drillBody.dag.nodes) && drillBody.dag.nodes.length === 3);
  const dagById = new Map(drillBody.dag.nodes.map((node) => [node.nodeId, node]));
  assert.equal(dagById.get('T-001').relation, 'self');
  assert.equal(dagById.get('Z-001').relation, 'self');
  assert.equal(dagById.get('Z-001').status, 'mystery');
  assert.equal(dagById.get('T-002').relation, 'upstream');
  assert.equal(dagById.get('T-002').status, 'pending');
  assert.ok(drillBody.dag.edges.length >= 1);
  for (const edge of drillBody.dag.edges) {
    assert.ok(typeof edge.id === 'string' && edge.id.length > 0);
    assert.ok(['forward', 'backflow'].includes(edge.direction));
  }
  assert.deepEqual(drillBody.dag.bounds, { width: 240, height: 80 });
  assert.equal(drillBody.dag.dangling, 0);
  assert.ok(Array.isArray(drillBody.cards) && drillBody.cards.length === 3);
  assert.deepEqual(drillBody.cards.map((card) => card.nodeId), ['T-001', 'Z-001', 'T-002']);
  assert.equal(drillBody.cards[0].tier, 'running');
  assert.equal(drillBody.cards[0].rank, 3);
  assert.equal(drillBody.cards[0].round, '1/2');
  assert.equal(drillBody.cards[1].tier, 'blocked');
  assert.equal(drillBody.cards[1].unknownStatus, true);
  assert.equal(drillBody.cards[1].boardColumn, 'blocked');
  assert.equal(drillBody.cards[2].tier, 'blocked');

  // --- GET /instances/:id/nodes/:nodeId（§3.4） ---
  const detail = await api.get('/instances/INST-001/nodes/T-001');
  assert.equal(detail.status, 200);
  assert.equal(detail.body.node.nodeId, 'T-001');
  assert.equal(detail.body.node.state, 'running');
  assert.equal(detail.body.node.maxRounds, 2);
  assert.equal(detail.body.node.nodeType, 'role');
  assert.ok(Array.isArray(detail.body.timeline) && detail.body.timeline.length === 3);
  assert.deepEqual(
    detail.body.timeline.map((row) => row.sessionState),
    ['starting', 'running', 'review'],
  );
  assert.deepEqual(detail.body.summary, {
    command: 'npm test', exitCode: 1, keyOutputLines: 12, logRef: 'logs/T-001.log',
  });
  assert.ok(Array.isArray(detail.body.evidence) && detail.body.evidence.length === 3);
  assert.deepEqual(detail.body.evidence.map((row) => row.ref), [
    'artifacts/code/calc.js', 'defects/d1.md', 'logs/T-001.log',
  ]);
  assert.deepEqual(detail.body.evidence.map((row) => row.index), [1, 2, 3]);
  for (const row of detail.body.evidence) {
    assert.ok(['resolvable', 'missing'].includes(row.status));
  }
  assert.ok(Array.isArray(detail.body.handoffs) && detail.body.handoffs.length === 2);
  assert.deepEqual(detail.body.handoffs.map((row) => row.direction), ['backflow', 'forward']);
  assert.deepEqual(detail.body.handoffs.map((row) => row.handoffId), ['HO-002', 'HO-001']);

  // --- GET /instances/:id/connections/:edgeId（§3.5） ---
  const conn = await api.get('/instances/INST-001/connections/E-02');
  assert.equal(conn.status, 200);
  assert.equal(conn.body.edge.id, 'E-02');
  assert.equal(conn.body.edge.fromRole, 'tester');
  assert.equal(conn.body.edge.toRole, 'developer');
  assert.equal(conn.body.edge.direction, 'backflow');
  assert.equal(conn.body.edge.aggregateStatus, 'rejected');
  assert.equal(conn.body.edge.parallelCount, 1);
  assert.ok(Array.isArray(conn.body.handoffs) && conn.body.handoffs.length === 1);
  assert.equal(conn.body.handoffs[0].handoffId, 'HO-002');
  assert.equal(conn.body.handoffs[0].lastActivity, '2026-11-15T09:50:10.000Z');
  assert.deepEqual(
    conn.body.handoffs[0].timeline.map((row) => row.state),
    ['built', 'rejected'],
  );
  // pulse 只覆盖聚合词，不改交接包行（overlay 可见范围）。
  const conn1 = await api.get('/instances/INST-001/connections/E-01');
  assert.equal(conn1.body.edge.aggregateStatus, 'rejected');
  assert.equal(conn1.body.handoffs[0].state, 'delivered');

  // --- GET /instances/:id/escalations（§3.6）：只列 pending ---
  const escalations = await api.get('/instances/INST-001/escalations');
  assert.equal(escalations.status, 200);
  assert.deepEqual(escalations.body, { items: [] });

  // --- GET /instances/:id/subworkflow/:ref ---
  const subflow = await api.get('/instances/INST-001/subworkflow/code-loop');
  assert.equal(subflow.status, 200);
  assert.equal(subflow.body.workflow.ref, 'code-loop');
  assert.equal(subflow.body.workflow.readable, true);
  assert.equal(subflow.body.nodes.length, 2);
  assert.equal(subflow.body.edges.length, 3);
  for (const node of subflow.body.nodes) {
    assert.ok('nodeId' in node && 'status' in node);
  }

  // 未知边 / 未知实例的降级形状。
  const missingEdge = await api.get('/instances/INST-001/connections/E-99');
  assert.equal(missingEdge.status, 404);
  const missingInstance = await api.get(`/instances/INST-404/drill/developer`);
  assert.equal(missingInstance.status, 404);
  void root;
  void state;
});

test('五投影导出基本形状（直接 import，五条齐全）', async () => {
  const { root, state } = await getSceneA();

  // ① buildDrill
  const drill = buildDrill({
    state,
    workflowDef: null,
    roleId: 'developer',
    roles: null,
    graph: {
      nodes: [{ id: 'role:developer', type: 'role', roleId: 'developer', status: 'serving', title: 'developer' }],
      edges: [],
    },
  });
  assert.ok(drill.breadcrumb && drill.roleBar && drill.dag && Array.isArray(drill.cards));
  assert.equal(drill.roleBar.statusToken, 'serving');

  // ② buildNodeDetail（异步：证据存在性是只读 fs 探测）
  const detail = await buildNodeDetail({
    state,
    workflowDef: null,
    events: SCENE_A_EVENTS,
    handoffs: state.handoffs,
    nodeId: 'T-001',
    workspace: path.join(root, '.orch', 'instances', 'INST-001', 'workspace'),
    cwd: root,
  });
  assert.ok(detail.node && Array.isArray(detail.timeline) && Array.isArray(detail.evidence)
    && Array.isArray(detail.handoffs));
  assert.ok(detail.summary !== null && typeof detail.summary === 'object');

  // ③ buildConnectionPanel（graph 入参即路由侧 overlay 后的图投影）
  const panel = buildConnectionPanel({
    state,
    workflowDef: null,
    handoffs: state.handoffs,
    edgeId: 'E-02',
    graph: {
      edges: [{
        id: 'E-02', from: 'role:tester', to: 'role:developer', direction: 'backflow',
        aggregateStatus: 'rejected', parallelCount: 1, handoffIds: ['HO-002'],
      }],
    },
  });
  assert.ok(panel !== null && panel.edge && Array.isArray(panel.handoffs));
  assert.equal(panel.edge.fromRole, 'tester');

  // ④ buildEscalationList
  const list = buildEscalationList({ state });
  assert.ok(Array.isArray(list.items));
  assert.equal(list.items.length, 0, 'resolved 升级不进 pending 列表');

  // ⑤ buildSubflowGraph（含 visited 循环降级）
  const subflow = buildSubflowGraph({
    workflowDef: { id: 'sub-a', title: '子流程', nodes: [{ id: 'S-001', role: 'developer' }], edges: [] },
    ref: 'sub-a',
    visited: [],
    state,
  });
  assert.equal(subflow.workflow.readable, true);
  assert.equal(subflow.nodes.length, 1);
  assert.equal(subflow.nodes[0].status, 'pending');
  const cycle = buildSubflowGraph({ workflowDef: null, ref: 'sub-a', visited: ['sub-a'], state });
  assert.equal(cycle.workflow.readable, false);
  assert.equal(cycle.cycle, true);
});

test('/hosts/open 对 mock 宿主返回 HOST_UNSUPPORTED（§3.7 错误形状）', async () => {
  const { api } = await getSceneA();
  const res = await api.post('/hosts/open', { instanceId: 'INST-001', sessionId: 'SESS-A' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    ok: false,
    code: 'HOST_UNSUPPORTED',
    message: '宿主 mock 不支持跳转',
  });
});

test('openHost 成功路径 + 500ms 去重（配置驱动，探针文件计数）', async () => {
  const { root } = await getSceneA();
  resetOpenHostDedup();
  const probeFile = path.join(root, '.orch', 'open-probe.txt');
  const env = { ...process.env, MAESTRO_OPEN_PROBE: probeFile };
  const first = await openHost({
    root, hostId: 'opener', instanceId: 'INST-001', sessionId: 'SESS-OPEN', env,
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.host, 'opener');
  assert.equal(first.sessionId, 'SESS-OPEN');
  assert.equal(first.sessionChoice, 'most-recent-active');
  // 500ms 窗口内的第二次调用直接复用结果，不再 spawn。
  const second = await openHost({
    root, hostId: 'opener', instanceId: 'INST-001', sessionId: 'SESS-OPEN', env,
  });
  assert.deepEqual(second, first);
  await sleep(250);
  assert.equal(fs.readFileSync(probeFile, 'utf8').split('x').length - 1, 1, '窗口内不得第二次 spawn');
  // 窗口过后第三次调用正常再执行。
  await sleep(600);
  const third = await openHost({
    root, hostId: 'opener', instanceId: 'INST-001', sessionId: 'SESS-OPEN', env,
  });
  assert.equal(third.ok, true);
  await waitFor(() => {
    try {
      return fs.readFileSync(probeFile, 'utf8').split('x').length - 1 >= 2 ? true : null;
    } catch {
      return null;
    }
  }, 5_000);
  resetOpenHostDedup();
});

// ------------------------------------------------------------------- 场景 B 测试

test('产品路径自然升级 → GET escalations 的 pending 形状（§3.6）', async () => {
  const fixture = await getSceneB();
  // 快速 mock：首派交接包证据不可读 → 自然升级 ESC-001（产品可达路径）。
  const res = await waitFor(async () => {
    const r = await fixture.api.get(`/instances/${fixture.instanceId}/escalations`);
    return (r.body.items ?? []).length > 0 ? r : null;
  }, 15_000);
  assert.ok(res, '15s 内未观察到自然升级');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.items) && res.body.items.length === 1);
  const item = res.body.items[0];
  assert.equal(item.escalationId, 'ESC-001');
  assert.equal(item.state, 'pending');
  assert.equal(item.nodeId, 'T-001');
  assert.equal(item.roleId, 'developer');
  assert.equal(typeof item.round, 'number');
  assert.ok('reasonDetail' in item && item.reasonDetail.length > 0);
  assert.ok(Array.isArray(item.defects));
});

test('连发两次 POST continue：第二次 ESCALATION_NOT_PENDING（AC-23① 端到端复核同口径）', async () => {
  const fixture = await getSceneB();
  const first = await fixture.api.post(
    `/instances/${fixture.instanceId}/escalations/ESC-001/continue`,
    {},
  );
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.ok, true);
  assert.equal(first.body.escalationId, 'ESC-001');

  const second = await fixture.api.post(
    `/instances/${fixture.instanceId}/escalations/ESC-001/continue`,
    {},
  );
  assert.equal(second.status, 409);
  assert.equal(second.body.ok, false);
  assert.equal(second.body.code, 'ESCALATION_NOT_PENDING');
  assert.equal(second.body.messageKey, 'DRILL_ESC_ALREADY');
  // B1-01：逐字等于 COMMAND_ERROR 既有原文（{id} 为升级号，{state} 经 CLI
  // 状态表本地化），不再接受「非空」这种可放进 UNKNOWN_ERROR 兜底的弱断言。
  const expectedAlready = COMMAND_ERROR.ESCALATION_NOT_PENDING
    .replace('{id}', 'ESC-001')
    .replace('{state}', ESCALATION_LABEL.resolved);
  assert.equal(second.body.message, expectedAlready);
});

test('continue 错误文案两码逐字查表（B1-01 防回归，第二码纯查表覆盖）', () => {
  // 真实 HTTP 夹具只能构造 ESCALATION_NOT_PENDING（pending 升级在已 resolved
  // 实例上重放）；INSTANCE_NOT_SUSPENDED 需要「pending 升级 + 非 suspended
  // 实例」的不一致现场，产品路径不可达，故按同查表路径做纯断言。
  // 期望值全部来自 src/cli/labels.js，测试内不手写任何中文文案。
  const escalationId = 'ESC-001';
  const instanceId = 'INST-B1-01';

  assert.equal(
    escalationErrorText('ESCALATION_NOT_PENDING', { escalationId, state: 'resolved' }),
    COMMAND_ERROR.ESCALATION_NOT_PENDING
      .replace('{id}', escalationId)
      .replace('{state}', ESCALATION_LABEL.resolved),
  );
  assert.equal(
    escalationErrorText('INSTANCE_NOT_SUSPENDED', { instanceId, state: 'running' }),
    COMMAND_ERROR.INSTANCE_NOT_SUSPENDED.replace('{id}', instanceId),
  );
  // 非 COMMAND_ERROR 的未知码仍走既有兜底，语义不因本次修复改变。
  assert.equal(
    escalationErrorText('B1_UNKNOWN_CODE', {}),
    ERROR_TEMPLATE.UNKNOWN_ERROR.replace('{raw}', 'B1_UNKNOWN_CODE'),
  );
});

test('escalate resolve 真实接缝 → resolved 排除在 pending 列表外', async () => {
  const fixture = await getSceneB();
  // continue 之后 retry 首派会再次失败，产品路径立即产出新的 pending 升级
  //（内存态与磁盘同源，CLI 的升级查找经 instance.get 可见）。
  const pending = await waitFor(async () => {
    const res = await fixture.api.get(`/instances/${fixture.instanceId}/escalations`);
    return (res.body.items ?? []).find((item) => item.escalationId !== 'ESC-001') ?? null;
  }, 15_000);
  assert.ok(pending, 'continue 后未观察到新的 pending 升级');

  const resolved = spawnSync(
    process.execPath,
    [BIN, 'escalate', 'resolve', pending.escalationId, '--instance', fixture.instanceId, '--decision', 'retry'],
    { cwd: fixture.root, env: envFor(), encoding: 'utf8', timeout: 30_000 },
  );
  assert.equal(resolved.status, 0, `escalate resolve 失败：\n${resolved.stdout}\n${resolved.stderr}`);

  const after = await fixture.api.get(`/instances/${fixture.instanceId}/escalations`);
  assert.equal(after.status, 200);
  assert.ok(Array.isArray(after.body.items));
  assert.equal(
    after.body.items.filter((item) => item.escalationId === pending.escalationId).length,
    0,
    'resolved 升级必须被 pending 列表排除',
  );
});

// ------------------------------------------------------------------- 收尾

test('收尾：两个场景的核心进程退出', async () => {
  if (sceneA) await stopDaemon(sceneA.child);
  if (sceneB) await stopDaemon(sceneB.child);
  // 临时项目根清出 %TEMP%（daemon 已退出，无进程占用）。
  for (const fixture of [sceneA, sceneB]) {
    if (fixture?.root) {
      try {
        fs.rmSync(fixture.root, { recursive: true, force: true });
      } catch {
        // 清理失败不影响判定（%TEMP% 由系统回收）。
      }
    }
  }
  sceneA = null;
  sceneB = null;
  assert.ok(true);
});
