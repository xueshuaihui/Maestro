/**
 * I1.10a WP-8：界面装配 / 连接态 / 降级契约测试（`test/wp13/errors.test.js`）。
 *
 * 承担（拆分文档 §4 WP-8 + 需求 AC-30 主责）：
 * - AC-30 六种异常现场逐字：`实例 INST-999 · 不存在` /
 *   `流程图定义不可读 · 已按内置模板显示` / `子工作流 child-x · 角色数未知` /
 *   `连接守护进程失败 · 请确认项目目录后重试` / `已断开 · 正在重连…` /
 *   `实例 {id} · 状态不可读`；每条都断言「界面仍可继续操作」（返回列表 /
 *   重试动作存在、没有异常抛出、没有堆栈）。
 * - F-17 瞬态：冷启动先出现 `正在连接守护进程…`，注入时钟 10 s 整仍是该句，
 *   超过 10 s 转失败句；重试重新出现瞬态（不真实等待）。
 * - 协作 AC-31（项目提示页装配）、AC-01（`view:"instances"` 六项行与四档）、
 *   AC-26（graph-shown / closed 探针数据）、AC-08 / AC-37 / AC-10（推送分流）、
 *   AC-21（Esc 退出聚焦）、AC-15（未开始连接线开关）、AC-22（拖拽偏好形状）。
 * - S-02 批次后置端到端：起一次真实 `serve-entry --desktop`，断言 `/ui/labels`
 *   147 + 63 键、`/instances`、`/workflows`、`/instances/:id/graph` 经注入路由全量可用，
 *   且无凭据时 401。
 *
 * 纪律：夹具根在 `os.tmpdir()`；`NODE_ENV=test` 必注入；芯片数据先起核再写盘；
 * 既有测试零改动；不引入任何测试专用渲染分支（断言走 `createApp` 的真实装配路径）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildClosedProbe,
  buildGraphShownProbe,
  createApp,
  createLoopbackTransport,
  parseSseBlock,
  resolveMountProject,
  takeLocationCredentials,
} from '../../desktop/ui/app.js';
import { createConnectionState } from '../../desktop/ui/connection.js';
import { resolveProject } from '../../desktop/ui/project.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const LABELS = UI_LABEL_KEYS;

const SCENE_MISSING = '实例 INST-999 · 不存在';
const SCENE_DEF_UNREADABLE = '流程图定义不可读 · 已按内置模板显示';
const SCENE_SUBFLOW_UNKNOWN = '子工作流 child-x · 角色数未知';
const SCENE_CONN_FAILED = '连接守护进程失败 · 请确认项目目录后重试';
const SCENE_RECONNECTING = '已断开 · 正在重连…';
const SCENE_UNREADABLE = '实例 INST-002 · 状态不可读';
const CONNECTING_LINE = '正在连接守护进程…';

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

function roleNode(id, title, overrides = {}) {
  return {
    id,
    type: 'role',
    title,
    roleId: id.replace(/^role:/, ''),
    status: 'available',
    activeSessions: 0,
    servingNodes: [],
    hostIcons: ['mock'],
    abnormal: false,
    abnormalCount: 0,
    collapsed: false,
    ...overrides,
  };
}

function edgeOf(id, from, to, overrides = {}) {
  return {
    id,
    from,
    to,
    direction: 'forward',
    aggregateStatus: 'delivered',
    handoffIds: [],
    parallelCount: 1,
    latestRound: 1,
    visual: { color: 'blue', dash: 'solid', arrow: 'forward', animation: 'flow', badge: null },
    labelVisible: false,
    ...overrides,
  };
}

function graphPayload(overrides = {}) {
  return {
    rev: 10,
    instanceId: 'INST-001',
    template: 'code-loop',
    state: 'running',
    workflow: { ref: 'release-flow', readable: true },
    nodes: [
      roleNode('role:dev', '开发', { status: 'serving', activeSessions: 2, servingNodes: ['T-001', 'T-002'], hostIcons: ['dsh', 'cursor'] }),
      roleNode('role:qa', '测试', { status: 'available' }),
    ],
    edges: [edgeOf('E-01', 'role:dev', 'role:qa')],
    ...overrides,
  };
}

function instanceItem(instanceId, overrides = {}) {
  return {
    instanceId,
    template: 'code-loop',
    templateTitle: '编码闭环',
    phase: 'running',
    progress: { done: 1, total: 2 },
    pending: { escalations: 1, approvals: 0 },
    health: { level: 'attention', reasons: [{ code: 'pending_escalation' }] },
    updatedAt: '2026-01-01T00:01:00.000Z',
    readable: true,
    ...overrides,
  };
}

function makeApp({ labels = LABELS, project = { view: 'instances' }, io = {} } = {}) {
  const probes = [];
  const writes = [];
  const transport = {
    getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
    getInstances: async () => ({ status: 200, body: { items: [] } }),
    getGraph: async () => ({ status: 200, body: graphPayload() }),
    getWorkflows: async () => ({ status: 200, body: { items: [] } }),
    postInstance: async () => ({ status: 200, body: { instanceId: 'INST-010' } }),
    writeViewOffsets: async (args) => writes.push(args),
    probe: (event) => probes.push(event),
    ...io,
  };
  const app = createApp({ labels, project, io: transport });
  return { app, probes, writes };
}

function instancesIo(items) {
  return { getInstances: async () => ({ status: 200, body: { items } }) };
}

// ---------------------------------------------------------------------------
// AC-30 现场一：实例不存在
// ---------------------------------------------------------------------------

test('AC-30 scene 1: missing instance renders the exact line and keeps the list one action away', async () => {
  const { app } = makeApp({
    io: { getGraph: async () => ({ status: 404, body: { error: 'NOT_FOUND' } }) },
  });
  await app.openGraph('INST-999');
  const model = app.compose();
  assert.equal(model.view, 'graph');
  assert.equal(model.notice.key, 'DESKTOP_GRAPH_MISSING');
  assert.equal(model.notice.text, SCENE_MISSING);
  assert.equal(model.notice.returnable, true);
  assert.equal(model.operable, true);
  assert.ok(model.actions.some((action) => action.id === 'back-to-list'));
  assert.ok(model.actions.some((action) => action.id === 'retry-graph'));
  assert.equal(app.state().lastError, null, 'a 404 must not become an exception');

  app.backToList();
  assert.equal(app.compose().view, 'instances');
});

// ---------------------------------------------------------------------------
// AC-30 现场二：流程图定义不可读（按内置模板回退，不删其它元素）
// ---------------------------------------------------------------------------

test('AC-30 scene 2: unreadable definition shows the exact line and keeps the fallback graph', async () => {
  const payload = graphPayload({
    workflow: { ref: 'missing-flow', readable: false },
    nodes: [roleNode('role:dev', '开发'), roleNode('role:qa', '测试')],
  });
  const { app } = makeApp({ io: { getGraph: async () => ({ status: 200, body: payload }) } });
  await app.openGraph('INST-001');
  const model = app.compose();
  assert.equal(model.notice.key, 'DESKTOP_DEF_UNREADABLE');
  assert.equal(model.notice.text, SCENE_DEF_UNREADABLE);
  assert.equal(model.graph.nodes.length, 2, 'degradation must not remove the fallback elements');
  assert.equal(model.graph.edges.length, 1);
  assert.equal(model.operable, true);
});

// ---------------------------------------------------------------------------
// AC-30 现场三：子工作流角色数未知（A-10 降级行）
// ---------------------------------------------------------------------------

test('AC-30 scene 3: unknown subworkflow member count renders the exact A-10 degraded row', async () => {
  const payload = graphPayload({
    nodes: [
      roleNode('role:dev', '开发'),
      {
        id: 'S-001',
        type: 'subworkflow',
        title: '发布子流程',
        workflow: 'child-x',
        memberCount: null,
        collapsed: true,
        abnormal: false,
      },
    ],
    edges: [edgeOf('E-01', 'role:dev', 'S-001')],
  });
  const { app } = makeApp({ io: { getGraph: async () => ({ status: 200, body: payload }) } });
  await app.openGraph('INST-001');
  const model = app.compose();
  const texts = model.graph.rows.map((row) => row.text);
  assert.ok(texts.includes(SCENE_SUBFLOW_UNKNOWN), texts.join('\n'));
  assert.equal(model.notice, null, 'a degraded child row is not a page-level notice');
  assert.equal(model.graph.nodes.length, 2, 'the special node stays on the canvas');
  assert.equal(model.operable, true);
});

// ---------------------------------------------------------------------------
// AC-30 现场四 + F-17：守护进程未启动 / 连接失败
// ---------------------------------------------------------------------------

test('AC-30 scene 4 + F-17: connecting transient shows first, failure after 10s, retry restarts it', () => {
  const clock = { t: 1_000 };
  const { app } = makeApp({ io: { now: () => clock.t } });
  app.state().connection.begin();

  let model = app.compose();
  assert.equal(model.statusKey, 'DESKTOP_CONN_CONNECTING');
  assert.equal(model.statusText, CONNECTING_LINE);

  clock.t += 10_000;
  app.state().connection.tick();
  model = app.compose();
  assert.equal(model.connection.status, 'connecting', 'exactly 10s is still the transient');
  assert.equal(model.statusText, CONNECTING_LINE);

  clock.t += 1;
  app.state().connection.tick();
  model = app.compose();
  assert.equal(model.connection.status, 'failed');
  assert.equal(model.statusText, SCENE_CONN_FAILED);
  assert.equal(model.connection.canRetry, true);
  assert.equal(model.operable, true);
  assert.ok(model.actions.some((action) => action.id === 'retry-connection'));

  app.retryConnection();
  model = app.compose();
  assert.equal(model.statusText, CONNECTING_LINE, 'retry must re-enter the transient');
});

test('F-17 machine: rejection keeps the transient and only the injected clock fails it', () => {
  let at = 0;
  const conn = createConnectionState({
    now: () => at,
    timeoutMs: 10_000,
    connect: () => Promise.reject(new Error('ECONNREFUSED')),
  });
  conn.begin();
  assert.equal(conn.status(), 'connecting');
  assert.equal(conn.text(LABELS), CONNECTING_LINE);
  assert.equal(conn.lastError(), null);
  at = 10_000;
  assert.equal(conn.tick(), 'connecting');
  at = 10_001;
  assert.equal(conn.tick(), 'failed');
  assert.equal(conn.text(LABELS), SCENE_CONN_FAILED);
  assert.equal(conn.canRetry(), true);
  conn.retry();
  assert.equal(conn.status(), 'connecting');
  assert.equal(conn.text(LABELS), CONNECTING_LINE);
});

// ---------------------------------------------------------------------------
// AC-30 现场五：推送连接断开（保留最后一次内容）
// ---------------------------------------------------------------------------

test('AC-30 scene 5: a dropped stream shows the reconnecting line and keeps the last graph', async () => {
  const { app } = makeApp();
  await app.openGraph('INST-001');
  const before = app.compose();
  assert.equal(before.graph.nodes.length, 2);

  app.state().connection.markReady();
  app.state().connection.disconnect();
  const model = app.compose();
  assert.equal(model.statusKey, 'DESKTOP_CONN_RECONNECTING');
  assert.equal(model.statusText, SCENE_RECONNECTING);
  assert.equal(model.connection.keepsContent, true);
  assert.deepEqual(
    model.graph.nodes.map((node) => node.id),
    before.graph.nodes.map((node) => node.id),
    'content must survive the drop',
  );
  assert.equal(model.operable, true);
});

// ---------------------------------------------------------------------------
// AC-30 现场六：state.json 损坏 → 列表不可读行
// ---------------------------------------------------------------------------

test('AC-30 scene 6: a corrupt snapshot renders the exact unreadable row without blocking others', async () => {
  const items = [
    instanceItem('INST-001'),
    { instanceId: 'INST-002', readable: false, health: null },
    instanceItem('INST-003', { health: { level: 'normal', reasons: [] }, updatedAt: '2026-01-01T00:00:10.000Z' }),
  ];
  const { app } = makeApp({ io: instancesIo(items) });
  await app.loadInstances();
  const model = app.compose();
  const texts = model.rows.map((row) => row.text);
  assert.ok(texts.includes(SCENE_UNREADABLE), texts.join('\n'));
  assert.equal(model.rows.length, 3, 'the unreadable row never hides the healthy ones');
  assert.equal(model.rows.filter((row) => row.readable).length, 2);
  assert.equal(model.operable, true);
});

// ---------------------------------------------------------------------------
// 协作 AC-31：项目未指定 / 不可用 / 已记住 → 列表
// ---------------------------------------------------------------------------

test('AC-31: the project guard stops at the prompt page and a usable remembered root enters the list', async () => {
  const missing = resolveProject({ labels: LABELS });
  assert.equal(missing.view, 'project-missing');
  assert.equal(missing.message, '项目 未指定 · 请填写项目目录');

  const invalid = resolveProject({
    argRoot: '/tmp/maestro-i10a-proj/nope',
    isUsable: () => false,
    labels: LABELS,
  });
  assert.equal(invalid.view, 'project-invalid');
  assert.equal(invalid.message, '项目 不可用 · /tmp/maestro-i10a-proj/nope');

  const remembered = resolveProject({
    argRoot: null,
    envRoot: null,
    remembered: '/tmp/maestro-i10a-proj',
    isUsable: (root) => root === '/tmp/maestro-i10a-proj',
    labels: LABELS,
  });
  assert.equal(remembered.view, 'instances');
  assert.equal(remembered.message, null);

  // 高优先级不可用不得回落到已记住项目（AC-31 现场二口径）。
  const shadowed = resolveProject({
    argRoot: '/tmp/nope',
    remembered: '/tmp/ok',
    isUsable: (root) => root === '/tmp/ok',
    labels: LABELS,
  });
  assert.equal(shadowed.view, 'project-invalid');

  const { app } = makeApp({ project: missing });
  const model = app.compose();
  assert.equal(model.view, 'project');
  assert.equal(model.projectMessage, '项目 未指定 · 请填写项目目录');
  assert.equal(model.rows.length, 0);
  assert.equal(model.operable, false, 'the prompt page has nothing to return to');

  const { app: listApp } = makeApp({ project: remembered });
  assert.equal(listApp.compose().view, 'instances');
  assert.equal(listApp.compose().emptyText, '实例 无');
});

// ---------------------------------------------------------------------------
// 协作 AC-01：view:"instances" 六字段 + 四档
// ---------------------------------------------------------------------------

test('AC-01: the instance list assembles six fields, four tiers and the A-1 order', async () => {
  const items = [
    instanceItem('INST-001'),
    {
      instanceId: 'INST-002',
      template: 'single',
      phase: 'completed',
      progress: { done: 1, total: 1 },
      pending: { escalations: 0, approvals: 0 },
      health: { level: 'ended', reasons: [] },
      updatedAt: '2026-01-01T00:04:00.000Z',
      readable: true,
    },
    {
      instanceId: 'INST-003',
      template: 'task-loop',
      phase: 'suspended',
      progress: { done: 2, total: 3 },
      pending: { escalations: 2, approvals: 0 },
      health: { level: 'slow', reasons: [{ code: 'handoff_ttl_half' }] },
      updatedAt: '2026-01-01T00:03:00.000Z',
      readable: true,
    },
    {
      instanceId: 'INST-004',
      template: 'code-loop',
      phase: 'running',
      progress: { done: 0, total: 2 },
      pending: { escalations: 0, approvals: 0 },
      health: { level: 'normal', reasons: [] },
      updatedAt: '2026-01-01T00:05:00.000Z',
      readable: true,
    },
  ];
  const { app } = makeApp({ io: instancesIo(items) });
  await app.loadInstances();
  const model = app.compose();
  assert.equal(model.view, 'instances');
  assert.deepEqual(model.rows.map((row) => row.instanceId), ['INST-001', 'INST-003', 'INST-004', 'INST-002']);
  for (const row of model.rows) {
    assert.equal(row.text.split(' · ').length, 6, row.text);
    assert.match(row.text, /需关注|慢|正常|已结束$/);
  }
  assert.equal(model.rows[2].text.split(' · ').length, 6);
  assert.match(model.rows[2].text, /待处理 0/);
  assert.ok(model.rows.every((row) => typeof row.healthText === 'string' && row.healthText.length > 0));
});

// ---------------------------------------------------------------------------
// 协作 AC-26：graph-shown / closed 探针数据
// ---------------------------------------------------------------------------

test('AC-26: opening the graph emits graph-shown with node / edge / dangling counts', async () => {
  const payload = graphPayload({
    nodes: [
      roleNode('role:dev', '开发'),
      { id: 'H-001', type: 'human', title: '人工验收', status: 'pending', abnormal: false },
      { id: 'S-001', type: 'subworkflow', title: '发布子流程', memberCount: 3, collapsed: true, abnormal: false },
      roleNode('role:qa', '测试'),
    ],
    edges: [
      edgeOf('E-01', 'role:dev', 'H-001'),
      edgeOf('E-02', 'H-001', 'S-001'),
      edgeOf('E-03', 'S-001', 'role:qa'),
      edgeOf('E-04', 'role:qa', 'role:dev', { direction: 'backflow', aggregateStatus: 'rejected', visual: { color: 'red', dash: 'solid', arrow: 'back', animation: 'none', badge: null } }),
    ],
  });
  const { app, probes } = makeApp({ io: { getGraph: async () => ({ status: 200, body: payload }) } });
  await app.openGraph('INST-001');
  const expected = { event: 'graph-shown', instanceId: 'INST-001', view: 'graph', nodes: 4, edges: 4, dangling: 0 };
  assert.deepEqual(probes.at(-1), expected);
  assert.deepEqual(app.compose().probe, expected);
  assert.deepEqual(buildGraphShownProbe(payload, 'INST-001'), expected);
  assert.deepEqual(buildClosedProbe(), { event: 'closed', view: 'instances', window: { visible: false } });
  assert.equal(app.state().probes.length, 1);
});

// ---------------------------------------------------------------------------
// D-5 / AC-37 / AC-10：推送分流
// ---------------------------------------------------------------------------

test('push dispatch: element frames repaint, session stays an indicator, list asks for a refetch', async () => {
  let items = [instanceItem('INST-001')];
  const { app } = makeApp({
    io: { getInstances: async () => ({ status: 200, body: { items } }) },
  });
  await app.loadInstances();
  await app.openGraph('INST-001');
  const revBefore = app.state().graph.rev;

  const role = app.handleFrame({
    type: 'role_instance.updated',
    rev: revBefore + 1,
    key: 'role:dev',
    payload: { status: 'serving', activeSessions: 2, servingNodes: ['T-001', 'T-002'], hostIcons: ['dsh', 'cursor'] },
  });
  assert.equal(role.repaint, 'graph');
  assert.equal(app.state().frames.role, 1);
  assert.match(app.compose().graph.rows[0].text, /服务中/);

  const graphBefore = JSON.stringify(app.compose().graph.nodes);
  const revAfterRole = app.state().graph.rev;
  const session = app.handleFrame({
    type: 'session.indicator',
    rev: revBefore,
    key: 'mock-sess-12345-1',
    payload: { state: 'tool_running' },
  });
  assert.equal(session.indicatorOnly, true);
  assert.equal(session.repaint, 'none');
  assert.equal(JSON.stringify(app.compose().graph.nodes), graphBefore, 'session frames never repaint geometry');
  assert.equal(app.state().graph.rev, revAfterRole, 'session frames never advance rev');
  assert.deepEqual(app.state().indicator['mock-sess-12345-1'].state, 'tool_running');

  const connection = app.handleFrame({
    type: 'connection.updated',
    rev: revAfterRole + 1,
    key: 'E-01',
    payload: {
      aggregateStatus: 'expired',
      visual: { color: 'orange', dash: 'dashed', arrow: 'forward', animation: 'none', badge: '!' },
    },
  });
  assert.equal(connection.repaint, 'graph');
  assert.equal(app.state().frames.connection, 1);
  const edge = app.compose().graph.edges.find((entry) => entry.id === 'E-01');
  assert.equal(edge.visual.color, 'orange');
  assert.ok(app.compose().graph.rows.some((row) => /已过期/.test(row.text)), 'edge rows join the projection');

  items = [...items, instanceItem('INST-005', { updatedAt: '2026-01-01T00:09:00.000Z' })];
  const list = app.handleFrame({ type: 'instances.changed', rev: revAfterRole + 2, payload: {} });
  assert.equal(list.refetch, true);
  assert.equal(app.state().frames.list, 1);
  await app.loadInstances();
  assert.equal(app.state().refetches, 2);
  assert.equal(app.state().instances.length, 2);
  app.backToList();
  assert.equal(app.compose().rows.length, 2);

  // AC-37：两类元素帧独立计数，都不丢。
  assert.equal(app.state().frames.role, 1);
  assert.equal(app.state().frames.connection, 1);
});

// ---------------------------------------------------------------------------
// 协作 AC-21 / AC-15 / AC-22：键盘、开关、拖拽偏好
// ---------------------------------------------------------------------------

function chainGraph() {
  return graphPayload({
    nodes: ['A', 'B', 'C', 'D', 'E'].map((id) => roleNode(`role:${id}`, id)),
    edges: [
      edgeOf('AB', 'role:A', 'role:B'),
      edgeOf('BC', 'role:B', 'role:C'),
      edgeOf('CD', 'role:C', 'role:D'),
      edgeOf('DE', 'role:D', 'role:E'),
      edgeOf('AE', 'role:A', 'role:E'),
    ],
  });
}

test('AC-21: focus keeps the two-hop window and Esc restores the full set', async () => {
  const { app } = makeApp({ io: { getGraph: async () => ({ status: 200, body: chainGraph() }) } });
  await app.openGraph('INST-001');
  assert.equal(app.compose().graph.nodes.length, 5);

  app.focusNode('role:C');
  const focused = app.compose();
  assert.deepEqual(focused.graph.nodes.map((node) => node.id).sort(), ['role:B', 'role:C', 'role:D']);
  assert.equal(focused.graph.focusTitle, '聚焦 C（2 跳）');
  assert.ok(focused.toolbar.some((item) => item.id === 'exit-focus'));

  app.escape();
  const restored = app.compose();
  assert.equal(restored.graph.nodes.length, 5);
  assert.equal(restored.graph.focusTitle, null);
});

test('AC-15: the not-started switch hides and shows the gray line', async () => {
  const payload = graphPayload({
    edges: [
      edgeOf('E-01', 'role:dev', 'role:qa'),
      edgeOf('E-02', 'role:qa', 'role:dev', {
        aggregateStatus: 'not_started',
        visual: { color: 'gray', dash: 'dashed', arrow: 'forward', animation: 'none', badge: null },
      }),
    ],
  });
  const { app } = makeApp({ io: { getGraph: async () => ({ status: 200, body: payload }) } });
  await app.openGraph('INST-001');
  assert.deepEqual(app.compose().graph.edges.map((edge) => edge.id), ['E-01']);
  const toggle = app.compose().toolbar.find((item) => item.id === 'toggle-not-started');
  assert.equal(toggle.text, '显示未开始连接线');

  app.toggleNotStarted();
  const shown = app.compose();
  assert.deepEqual(shown.graph.edges.map((edge) => edge.id), ['E-01', 'E-02']);
  assert.equal(shown.toolbar.find((item) => item.id === 'toggle-not-started').text, '隐藏未开始连接线');
  assert.ok(shown.graph.edges.find((edge) => edge.id === 'E-02').visual.color === 'gray');
});

test('AC-22: a drag writes the views shape and reset clears it', async () => {
  const { app, writes } = makeApp({ io: { getGraph: async () => ({ status: 200, body: graphPayload() }) } });
  await app.openGraph('INST-001');
  const base = app.compose().graph.nodes.find((node) => node.id === 'role:dev');

  app.dragEnd('role:dev', 40, 60);
  const moved = app.compose().graph.nodes.find((node) => node.id === 'role:dev');
  assert.equal(moved.x, base.x + 40);
  assert.equal(moved.y, base.y + 60);
  assert.equal(writes.length, 1);
  // AC-22 / split 3.2: the transport receives the three-field seam and the
  // offsets map stays flat; the shell adds `updatedAt` when it writes the file.
  assert.equal(writes[0].instance_id, 'INST-001');
  assert.equal(writes[0].root, null);
  assert.deepEqual(writes[0].offsets, { 'role:dev': { dx: 40, dy: 60 } });
  assert.equal(writes[0].offsets.offsets, undefined);
  assert.equal(writes[0].offsets.updatedAt, undefined);

  app.resetView();
  const reset = app.compose().graph.nodes.find((node) => node.id === 'role:dev');
  assert.equal(reset.x, base.x);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].offsets, {});
});

// ---------------------------------------------------------------------------
// B-31 接缝：SSE 原文 → 解析 → setGraph / invoke 实参形状 / 重开读回偏移
// ---------------------------------------------------------------------------

/** Install a fake shell bridge for one test and return the restore hook. */
function stubTauri(invoke) {
  const previous = globalThis.window;
  globalThis.window = { ...(previous ?? {}), __TAURI__: { core: { invoke } } };
  return () => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  };
}

test('B-31 seam 1: the raw graph.snapshot frame replaces the graph through the SSE parser', async () => {
  const { app } = makeApp();
  await app.openGraph('INST-001');
  assert.equal(app.state().graph.rev, 10);

  const next = graphPayload({
    rev: 42,
    nodes: [
      roleNode('role:dev', '开发'),
      roleNode('role:qa', '测试'),
      { id: 'H-001', type: 'human', title: '人工验收', status: 'pending', abnormal: false },
    ],
  });
  const raw = `event: graph.snapshot\ndata: ${JSON.stringify({ rev: 42, instanceId: 'INST-001', type: 'snapshot', key: null, payload: next })}\n\n`;
  const frame = parseSseBlock(raw.trimEnd());
  assert.equal(frame.event, 'graph.snapshot');
  assert.equal(frame.type, 'graph.snapshot', 'the event name wins over data.type');

  const result = app.handleFrame(frame);
  assert.equal(result.repaint, 'graph');
  assert.equal(app.state().graph.rev, 42);
  assert.equal(app.compose().graph.nodes.length, 3, 'the snapshot must replace the graph');

  const again = parseSseBlock(
    `event: graph.snapshot\ndata: ${JSON.stringify({ rev: 43, instanceId: 'INST-001', type: 'graph.snapshot', payload: graphPayload({ rev: 43 }) })}`,
  );
  assert.equal(app.handleFrame(again).repaint, 'graph');
  assert.equal(app.state().graph.rev, 43);
});

test('B-31 seam 2: writeViewOffsets hands the shell the three-field invoke shape', async () => {
  const calls = [];
  const restore = stubTauri(async (command, args) => {
    calls.push({ command, args });
    return null;
  });
  try {
    const transport = createLoopbackTransport({ port: 51234, token: 'tok' });
    await transport.writeViewOffsets({
      root: '/tmp/maestro-i10a-view',
      instance_id: 'INST-001',
      offsets: { 'T-002': { dx: 40, dy: 60 } },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'write_view_command');
    assert.deepEqual(calls[0].args, {
      root: '/tmp/maestro-i10a-view',
      instance_id: 'INST-001',
      offsets: { 'T-002': { dx: 40, dy: 60 } },
    });
    assert.equal(calls[0].args.offsets.offsets, undefined, 'the offsets map is never wrapped twice');
    assert.equal(calls[0].args.offsets.updatedAt, undefined, 'updatedAt belongs to the shell');
  } finally {
    restore();
  }
});

test('B-31 seam 3: reopening an instance replays the stored offsets onto the base coordinates', async () => {
  const files = new Map();
  const restore = stubTauri(async (command, args) => {
    if (command === 'write_view_command') {
      files.set(args.instance_id, { offsets: args.offsets, updatedAt: '2026-01-01T00:00:00.000Z' });
      return null;
    }
    if (command === 'read_view_command') return files.get(args.instance_id) ?? null;
    return null;
  });
  try {
    const transport = createLoopbackTransport({ port: 51234, token: 'tok' });
    const app = createApp({
      labels: LABELS,
      project: { view: 'instances', root: '/tmp/maestro-i10a-view' },
      io: {
        ...transport,
        getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
        getGraph: async () => ({ status: 200, body: graphPayload() }),
      },
    });
    await app.openGraph('INST-001');
    const base = app.compose().graph.nodes.find((node) => node.id === 'role:dev');

    app.dragEnd('role:dev', 40, 60);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(files.get('INST-001'), {
      offsets: { 'role:dev': { dx: 40, dy: 60 } },
      updatedAt: '2026-01-01T00:00:00.000Z',
    }, 'the shell file stays single-layer');

    app.backToList();
    await app.openGraph('INST-001');
    const reopened = app.compose().graph.nodes.find((node) => node.id === 'role:dev');
    assert.equal(reopened.x, base.x + 40);
    assert.equal(reopened.y, base.y + 60);
    assert.deepEqual(app.state().offsets, { 'role:dev': { dx: 40, dy: 60 } });
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// Q-1：壳侧把项目根随查询参数送达（窗口面 project.root 非 null）
// ---------------------------------------------------------------------------

/** Install a fake `window` (location + recording history) for one test. */
function stubWindow(search, calls) {
  const previous = globalThis.window;
  globalThis.window = {
    ...(previous ?? {}),
    location: { search, pathname: '/ui/', hash: '', port: '51234', origin: 'http://127.0.0.1:51234' },
    history: { replaceState: (...args) => calls.push(args) },
  };
  return () => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  };
}

test('Q-1: the query project reaches state.project.root and the offsets seam', async () => {
  const calls = [];
  const restore = stubWindow('?token=tok-q1&project=%2Ftmp%2Fmaestro-q1-root', calls);
  try {
    const creds = takeLocationCredentials();
    assert.deepEqual(creds, { port: 51234, token: 'tok-q1', project: '/tmp/maestro-q1-root' });
    assert.deepEqual(
      calls.at(-1),
      [null, '', '/ui/'],
      'both the token and the project query values are scrubbed from the address bar',
    );

    // Priority (decision Q): explicit argument > injected global > query value.
    const summary = resolveMountProject({ credentials: creds, labels: LABELS });
    assert.equal(summary.view, 'instances');
    assert.equal(summary.root, '/tmp/maestro-q1-root');
    assert.equal(summary.message, null);
    assert.equal(
      resolveMountProject({
        project: { view: 'instances', root: '/explicit' },
        injected: { project: { view: 'instances', root: '/injected' } },
        credentials: creds,
      }).root,
      '/explicit',
    );
    assert.equal(
      resolveMountProject({
        injected: { project: { view: 'instances', root: '/injected' } },
        credentials: creds,
      }).root,
      '/injected',
    );

    // With the root in place the preference calls stop being no-ops (AC-22).
    const { app, writes } = makeApp({ project: summary });
    await app.openGraph('INST-001');
    app.dragEnd('role:dev', 20, 30);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.state().project.root, '/tmp/maestro-q1-root');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].root, '/tmp/maestro-q1-root');
    assert.equal(writes[0].instance_id, 'INST-001');
    assert.deepEqual(writes[0].offsets, { 'role:dev': { dx: 20, dy: 30 } });
  } finally {
    restore();
  }
});

// ---------------------------------------------------------------------------
// 裁决 R / R-06：无 project root → 项目提示页（不是列表空态）
// ---------------------------------------------------------------------------

test('R-06: no project root assembles the project prompt page, never the empty list', () => {
  for (const project of [undefined, null, {}, { root: '' }]) {
    const app = createApp({ labels: LABELS, project });
    const model = app.compose();
    assert.equal(model.view, 'project');
    assert.equal(model.projectMessage, LABELS.DESKTOP_PROJECT_MISSING);
    assert.equal(model.emptyText, null, 'the empty list line must never paint');
    assert.equal(model.rows.length, 0);
    assert.equal(model.operable, false);
  }

  // The window mounts before `/ui/labels` arrives: the summary keeps its key
  // and resolves once the table lands.
  const late = createApp({ labels: null, project: null });
  assert.equal(late.compose().view, 'project');
  late.setLabels({ keys: LABELS });
  assert.equal(late.compose().projectMessage, LABELS.DESKTOP_PROJECT_MISSING);

  // An unusable directory stops on the same page with the invalid wording.
  const invalid = resolveProject({
    argRoot: '/tmp/maestro-i10a-proj/nope',
    isUsable: () => false,
    labels: LABELS,
  });
  assert.equal(invalid.messageKey, 'DESKTOP_PROJECT_INVALID');
  const invalidModel = createApp({ labels: LABELS, project: invalid }).compose();
  assert.equal(invalidModel.view, 'project');
  assert.equal(invalidModel.projectMessage, '项目 不可用 · /tmp/maestro-i10a-proj/nope');
  assert.equal(invalidModel.emptyText, null);
});

// ---------------------------------------------------------------------------
// 裁决 R / R-04：sessionStorage 单键恢复凭据（URL 无 query）
// ---------------------------------------------------------------------------

/** Install a fake sessionStorage for one test and return the restore hook. */
function stubSessionStorage(initial) {
  const store = new Map(Object.entries(initial ?? {}));
  const previous = globalThis.sessionStorage;
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  return {
    store,
    restore() {
      if (previous === undefined) delete globalThis.sessionStorage;
      else globalThis.sessionStorage = previous;
    },
  };
}

test('R-04: a stored token is restored when the URL carries no query', () => {
  const calls = [];
  const restoreWindow = stubWindow('', calls);
  const storage = stubSessionStorage({ 'maestro.desktop.token': 'tok-restored' });
  try {
    const creds = takeLocationCredentials();
    assert.deepEqual(creds, { port: 51234, token: 'tok-restored', project: null });
    assert.deepEqual(calls, [], 'nothing to scrub when the URL is already clean');
  } finally {
    storage.restore();
    restoreWindow();
  }
});

test('R-04: a query token wins and is written to the single sessionStorage key', () => {
  const calls = [];
  const restoreWindow = stubWindow('?token=tok-query', calls);
  const storage = stubSessionStorage({ 'maestro.desktop.token': 'tok-stale' });
  try {
    const creds = takeLocationCredentials();
    assert.equal(creds.token, 'tok-query');
    assert.equal(storage.store.get('maestro.desktop.token'), 'tok-query');
    assert.deepEqual(calls.at(-1), [null, '', '/ui/']);
  } finally {
    storage.restore();
    restoreWindow();
  }
});

// ---------------------------------------------------------------------------
// 裁决 R / R-09 + R-10：注入源回退不被删；重载同时恢复 project root
// ---------------------------------------------------------------------------

test('R-09: the injected __MAESTRO_DESKTOP__ token still works as the last resort', () => {
  const calls = [];
  const restoreWindow = stubWindow('', calls);
  const storage = stubSessionStorage({});
  try {
    globalThis.window.__MAESTRO_DESKTOP__ = { port: 51234, token: 'tok-injected' };
    const creds = takeLocationCredentials();
    assert.deepEqual(creds, { port: 51234, token: 'tok-injected', project: null });
  } finally {
    delete globalThis.window.__MAESTRO_DESKTOP__;
    storage.restore();
    restoreWindow();
  }
});

test('R-10: a reload restores the project root from the single sessionStorage key', () => {
  const calls = [];
  const restoreWindow = stubWindow('', calls);
  const storage = stubSessionStorage({
    'maestro.desktop.token': 'tok-reload',
    'maestro.desktop.project': '/tmp/maestro-reload-root',
  });
  try {
    const creds = takeLocationCredentials();
    assert.deepEqual(creds, {
      port: 51234,
      token: 'tok-reload',
      project: '/tmp/maestro-reload-root',
    });
    const summary = resolveMountProject({ credentials: creds, labels: LABELS });
    assert.equal(summary.view, 'instances');
    assert.equal(summary.root, '/tmp/maestro-reload-root');
  } finally {
    storage.restore();
    restoreWindow();
  }
});

// ---------------------------------------------------------------------------
// S-02：真实守护进程的批次后置端到端校验
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(makeValue, timeoutMs = 30_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

function writeState(root, instanceId, snapshot) {
  const dir = path.join(root, '.orch', 'instances', instanceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({ schemaVersion: 2, instanceId, ...snapshot }, null, 2),
    'utf8',
  );
}

test('S-02: the desktop channel serves labels and all REST routes through the injected seam', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp8-'));
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_PERMISSION_POLICY']) {
    delete env[key];
  }
  const child = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env,
    stdio: 'ignore',
  });
  try {
    const meta = await waitFor(() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8'));
      } catch {
        return null;
      }
    });
    assert.ok(meta, 'desktop.json never appeared');

    // 先起核再写盘（避免 boot 对账改写运行态快照）。
    writeState(root, 'INST-001', {
      template: 'single',
      state: 'running',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:01:00.000Z',
      nodes: [{ nodeId: 'T-001', state: 'running' }],
      health: { level: 'normal', reasons: [] },
    });

    const base = `http://127.0.0.1:${meta.port}`;
    const headers = { Authorization: `Bearer ${meta.token}` };

    const labels = await fetch(`${base}/ui/labels`, { headers });
    assert.equal(labels.status, 200);
    const payload = await labels.json();
    assert.equal(Object.keys(payload.keys).length, 147 + 63);
    for (const key of [
      'DESKTOP_GRAPH_MISSING',
      'DESKTOP_DEF_UNREADABLE',
      'DESKTOP_SUBFLOW_UNKNOWN',
      'DESKTOP_CONN_FAILED',
      'DESKTOP_CONN_RECONNECTING',
      'DESKTOP_PROJECT_MISSING',
      'DESKTOP_PROJECT_INVALID',
      'DESKTOP_VIEW_FOCUS',
    ]) {
      assert.equal(typeof payload.keys[key], 'string', key);
    }
    assert.equal(payload.keys.DESKTOP_GRAPH_MISSING.replace('{id}', 'INST-999'), SCENE_MISSING);

    const list = await fetch(`${base}/instances`, { headers });
    assert.equal(list.status, 200);
    const listBody = await list.json();
    assert.ok(Array.isArray(listBody.items));
    assert.ok(listBody.items.some((item) => item.instanceId === 'INST-001'));

    const workflows = await fetch(`${base}/workflows`, { headers });
    assert.equal(workflows.status, 200);
    const workflowBody = await workflows.json();
    assert.equal(workflowBody.items.length, 3);

    const graph = await fetch(`${base}/instances/INST-001/graph`, { headers });
    assert.equal(graph.status, 200);
    const graphBody = await graph.json();
    assert.ok(Array.isArray(graphBody.nodes));
    assert.ok(Array.isArray(graphBody.edges));
    assert.ok(graphBody.nodes.length >= 1, 'the graph route must be live through the injected table');

    const anonymous = await fetch(`${base}/instances`);
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: 'UNAUTHORIZED' });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000);
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
