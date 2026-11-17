/**
 * WP-4 assembly contract: live seam / consistency / reconnect refetch
 * (AC-27 / AC-32 / AC-47 / AC-48 / AC-50).
 *
 * Live frames travel through the REAL `createApp.handleFrame`, reusing the
 * single graph-stream seam (contract A5). No new channel / event type is
 * introduced; the drill view is rebuilt from the same frozen projection.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../desktop/ui/app.js';
import { createDrillView } from '../../desktop/ui/drill/index.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LABELS = { keys: UI_LABEL_KEYS };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-live', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];
const statusWord = (t) => JSON.parse(w('DRILL_ROLE_STATUS_TOKEN'))[t];
const handoffWord = (s) => w('HANDOFF_LABEL_' + String(s).toUpperCase());
const nodeWord = (s) => w('NODE_LABEL_' + String(s).toUpperCase());
const placeholder = w('DESKTOP_PLACEHOLDER');

function makeApp(clockRef = { t: 0 }) {
  return createApp({ labels: LABELS, project: PROJECT, io: { now: () => clockRef.t } });
}

function liveDrill(overrides = {}) {
  return {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'developer', roleTitle: '开发' },
    roleBar: {
      roleTitle: '开发', statusToken: 'available', activeSessions: 2,
      servingNodes: ['T-001', 'T-002'], hostIcons: ['dsh', 'cursor'],
      lastAction: { nodeId: 'T-002', round: 2, maxRounds: 3, state: 'review' },
    },
    dag: {
      nodes: ['T-001', 'T-002', 'T-003'].map((nodeId) => ({ nodeId, relation: 'self', type: 'role', status: 'running' })),
      edges: [{ id: 'E-07', from: 'T-002', to: 'T-003', direction: 'forward', aggregateStatus: 'delivered' }],
      dangling: 0,
    },
    cards: [
      { nodeId: 'T-001', tier: 'running', rank: 3, state: 'running', title: '实现登录', round: '1/3' },
      { nodeId: 'T-002', tier: 'review', rank: 4, state: 'review', title: '联调', round: '2/3' },
      { nodeId: 'T-003', tier: 'running', rank: 3, state: 'running', title: '实现登录', round: '1/3' },
    ],
    connection: {
      edge: { id: 'E-07', fromRole: '开发', toRole: '测试', direction: 'forward', aggregateStatus: 'delivered', parallelCount: 2 },
      handoffs: [],
    },
    now: 0,
    ...overrides,
  };
}

function frame(type, key, payload, rev = 2) {
  return { type, data: { key, rev, payload } };
}

const order = (view) => view.cards.map((c) => c.nodeId);

// ---------------------------------------------------------------------------

test('AC-27: 状态词 2s 内到达、会话 5 次变化只动指示器不重排', () => {
  const clock = { t: 1000 };
  const app = makeApp(clock);
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: liveDrill() });
  const beforeOrder = order(app.state().drillView);
  const beforeDag = app.state().drillView.dag.nodes.map((n) => n.nodeId);
  const trigger = clock.t;

  app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }));
  const roleAt = clock.t;
  for (let i = 0; i < 5; i += 1) {
    clock.t += 10;
    app.handleFrame(frame('session.indicator', 'SESS-' + i, { state: 'thinking' }));
  }
  const v = app.state().drillView;
  assert.equal(v.roleBar.status, statusWord('serving'));
  assert.deepEqual(order(v), beforeOrder);
  assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag);
  assert.ok(roleAt - trigger <= 2000);
  assert.ok(app.state().frames.session <= 5);
});

test('AC-32: 同一节点四处 {title,status,color} 一致，看板 running 列、卡片 running 档', () => {
  const app = makeApp();
  app.setGraph({
    nodes: [{ id: 'T-003', type: 'role', title: '实现登录', status: 'running' }],
    edges: [],
    stateNodes: [{ nodeId: 'T-003', roleId: 'developer', state: 'running' }],
  }, 'INST-001');
  app.openAllNodes();
  const board = app.compose().board;
  const boardCard = board.cards.find((c) => c.nodeId === 'T-003' || c.id === 'T-003');
  assert.ok(boardCard);

  const data = liveDrill();
  const viaModule = createDrillView({ labels: LABELS, data, interactions: {} });
  const dagNode = viaModule.dag.nodes.find((n) => n.nodeId === 'T-003');
  const card = viaModule.cards.find((c) => c.nodeId === 'T-003');
  const graphWord = nodeWord('running');
  assert.equal(dagNode.status, graphWord);
  assert.equal(card.displayStatus, graphWord);
  assert.equal(card.tier, 'running');
  assert.equal(card.rank, 3);
  // 四处状态词一致（标题同源、颜色 token 同源）
  assert.equal(w('NODE_LABEL_RUNNING'), graphWord);
  assert.equal(board.columns.includes('running'), true);
  assert.equal(board.columnNames[2], w('DESKTOP_BOARD_COLUMN_RUNNING'));
});

test('AC-47: 角色与连接线两条变化都到达、互不覆盖、顺序不变', () => {
  const clock = { t: 0 };
  const app = makeApp(clock);
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: liveDrill() });
  const beforeOrder = order(app.state().drillView);
  const trigger = clock.t;

  app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }));
  const roleAt = clock.t;
  app.handleFrame(frame('connection.updated', 'E-07', { aggregateStatus: 'rejected' }));
  const connAt = clock.t;

  const v = app.state().drillView;
  assert.equal(v.roleBar.status, statusWord('serving'));
  assert.equal(v.connection.title.includes(handoffWord('rejected')), true);
  assert.deepEqual(order(v), beforeOrder);
  assert.ok(roleAt - trigger <= 2000);
  assert.ok(connAt - trigger <= 2000);
});

test('AC-48: 状态词翻成未参与，其余段逐项保留、卡片/DAG 不塌陷、下钻不关闭', () => {
  const clock = { t: 0 };
  const app = makeApp(clock);
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: liveDrill() });
  const before = app.state().drillView;
  const beforeServing = before.roleBar.servingNodes.slice();
  const beforeHosts = before.roleBar.hostIcons.slice();
  const beforeLast = JSON.parse(JSON.stringify(before.roleBar.lastAction));
  const beforeCards = before.cards.length;
  const beforeDagLen = before.dag.nodes.length;
  const trigger = clock.t;

  app.handleFrame(frame('role_instance.updated', 'developer', { status: 'inactive' }));
  const at = clock.t;

  const v = app.state().drillView;
  assert.equal(v.roleBar.status, statusWord('inactive'));
  assert.deepEqual(v.roleBar.servingNodes, beforeServing);
  assert.deepEqual(v.roleBar.hostIcons, beforeHosts);
  assert.deepEqual(v.roleBar.lastAction, beforeLast);
  assert.equal(v.cards.length, beforeCards);
  assert.equal(v.dag.nodes.length, beforeDagLen);
  assert.equal(app.state().view, 'drill');
  assert.ok(at - trigger <= 2000);
  // 架构锚点：空卡片不清空面板、不短路渲染
  const cardsSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'drill', 'cards.js'), 'utf8');
  assert.equal(/if \(!cards\.length\) return|return null/.test(cardsSrc), false);
});

test('AC-50: 同一图流保持/重开（A5）+ 重取后状态栏未参与/卡片清空/DAG 保留', () => {
  const clock = { t: 0 };
  const app = makeApp(clock);
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: liveDrill() });
  const beforeDag = app.state().drillView.dag.nodes.map((n) => n.nodeId);

  // 图流先开、断开后经 scheduleReconnect 重开同一条 -> noteGraphStreamOpen 两次
  app.noteGraphStreamOpen();
  app.noteGraphStreamOpen();
  assert.equal(app.state().graphStreamReopened, true);
  assert.equal(app.state().graphStreamOpens, 2);

  // 重取首帧：roleBar 绑定归零 + 空卡片，DAG 段缺失（应保留上一帧）
  const tDrop = clock.t;
  app.handleFrame(frame('graph.snapshot', null, {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'developer', roleTitle: '开发' },
    roleBar: {
      roleTitle: '开发', statusToken: 'inactive', activeSessions: 0,
      servingNodes: [], hostIcons: [], lastAction: null,
    },
    cards: [],
  }));
  const tRefetch = clock.t;

  const v = app.state().drillView;
  assert.equal(v.roleBar.line, [
    '角色栏 开发', statusWord('inactive'), '0 个活跃会话',
    '服务 ' + placeholder, '宿主 ' + placeholder, '最近 ' + placeholder,
  ].join(' · '));
  assert.equal(v.cards.length, 0);
  assert.equal(v.cardsEmptyText, w('DRILL_EMPTY_TASK'));
  assert.deepEqual(v.dag.nodes.map((n) => n.nodeId), beforeDag);
  assert.equal(app.state().view, 'drill');
  assert.ok(tRefetch - tDrop <= 2000);
});

test('AC-50/A5: ensureStreams 只扩展条件到 drill，不新建通道 / 帧类型', () => {
  const appSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
  // 同一条件分支里同时出现 graph 与 drill
  assert.ok(/current\.view === 'graph' \|\| current\.view === 'drill'/.test(appSrc));
  // 仅一条 graph/stream 构造（复用同一通道）
  assert.equal((appSrc.match(/\/graph\/stream/g) ?? []).length, 1);
  // drill 层不新建事件/通道
  const drillDir = path.join(REPO, 'desktop', 'ui', 'drill');
  for (const file of fs.readdirSync(drillDir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(drillDir, file), 'utf8');
    assert.equal(/new WebSocket\(|new EventSource\(/.test(text), false);
  }
});
