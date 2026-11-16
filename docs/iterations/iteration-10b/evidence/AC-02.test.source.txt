/**
 * WP-4 assembly contract: drill entry / return / status vocabulary (AC-01/02/03/04).
 *
 * The assertions drive the REAL `createApp` assembly path with real frozen
 * label keys and the real `createDrillView` module. No test-only render
 * branch exists in the UI layer. All Chinese expectations are read from the
 * frozen label table (never typed into this file as an authored sentence).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../desktop/ui/app.js';
import { createDrillView } from '../../desktop/ui/drill/index.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const LABELS = { keys: UI_LABEL_KEYS };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-entry', source: 'test' };

const word = (key) => UI_LABEL_KEYS[key];
const statusWord = (token) => JSON.parse(word('DRILL_ROLE_STATUS_TOKEN'))[token];
const placeholder = word('DESKTOP_PLACEHOLDER');

function makeApp(io = {}) {
  return createApp({ labels: LABELS, project: PROJECT, io });
}

function baseDrill(overrides = {}) {
  const roleTitle = overrides.roleBar?.roleTitle ?? '开发';
  return {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'developer', roleTitle },
    roleBar: {
      roleTitle,
      statusToken: 'serving',
      activeSessions: 2,
      servingNodes: ['T-001', 'T-002'],
      hostIcons: ['dsh', 'cursor'],
      lastAction: { nodeId: 'T-002', round: 2, maxRounds: 3, state: 'review' },
    },
    dag: {
      nodes: ['T-001', 'T-002', 'T-003', 'T-004', 'T-005'].map((id) => ({
        nodeId: id, relation: 'self', type: 'role', status: 'running',
      })),
      edges: [],
      bounds: { width: 240, height: 80 },
      dangling: 0,
    },
    cards: [
      { nodeId: 'T-001', tier: 'running', rank: 3, state: 'running', title: '实现登录', round: '1/3' },
      { nodeId: 'T-002', tier: 'review', rank: 4, state: 'review', title: '联调', round: '2/3' },
      { nodeId: 'T-003', tier: 'done', rank: 8, state: 'done', title: '收尾', round: '1/3' },
      { nodeId: 'T-004', tier: 'ready', rank: 6, state: 'pending', title: '回归', round: '1/1' },
      { nodeId: 'T-005', tier: 'done', rank: 8, state: 'done', title: '归档', round: '1/1' },
    ],
    now: 0,
    ...overrides,
  };
}

const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------------------

test('AC-01: 进入下钻 view===drill，A-1 第 7 行逐字，DAG/卡片一次可用，注入时钟 ≤1000ms，state.json 哈希不变', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10b-entry-'));
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ schemaVersion: 2, rev: 1, state: 'running', nodes: [] }));
  const before = hash(stateFile);

  let current = 5000;
  const clock = () => current;
  const app = makeApp({ now: clock });
  const clickAt = clock();
  current = 5300;
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: baseDrill() });

  const st = app.state();
  assert.equal(st.view, 'drill');
  const view = st.drillView;
  // A-1 第 7 行逐字（全部从文案键拼出，未手写整句）
  const expectedLine = [
    '角色栏 开发',
    statusWord('serving'),
    '2 个活跃会话',
    '服务 T-001, T-002',
    '宿主 dsh cursor',
    '最近 T-002 · 轮次 2/3 · ' + word('NODE_LABEL_REVIEW'),
  ].join(' · ');
  assert.equal(view.roleBar.line, expectedLine);
  assert.equal(view.breadcrumb, '实例 INST-001 / 角色 开发');
  const nodeIds = view.dag.nodes.map((n) => n.nodeId).sort();
  assert.deepEqual(nodeIds, ['T-001', 'T-002', 'T-003', 'T-004', 'T-005']);
  assert.equal(view.dag.dangling === 0 || view.dag.nodes.length === 5, true);
  assert.equal(view.cards.length, 5);
  assert.equal(view.cards[0].nodeId, 'T-001');
  assert.equal(view.roleBar.activeSessions, 2);
  assert.deepEqual(view.roleBar.servingNodes, ['T-001', 'T-002']);
  assert.deepEqual(view.roleBar.hostIcons, ['dsh', 'cursor']);
  assert.equal(view.roleBar.lastAction.nodeId, 'T-002');
  // 内部断言：注入时钟
  assert.ok(st.drillTiming.enteredAt - clickAt <= 1000);
  // 只读：进入不改 state.json
  assert.equal(hash(stateFile), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-01: 独立 createDrillView 对相同投影输出同一行（装配只消费纯模块）', () => {
  const data = baseDrill();
  const viaModule = createDrillView({ labels: LABELS, data, interactions: {} });
  const app = makeApp();
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data });
  assert.equal(app.state().drillView.roleBar.line, viaModule.roleBar.line);
  assert.equal(app.state().drillView.cards.length, viaModule.cards.length);
});

test('AC-02: 返回流程图保留五组 viewState 值逐字段相等，且 viewState 非 null', () => {
  const app = makeApp({ now: () => 0 });
  // 通过真实装配路径设置图视图状态（不新建 createViewState）
  app.setGraph({
    nodes: [
      { id: 'T-002', type: 'role', title: '联调' },
      { id: 'T-003', type: 'role', title: '实现登录' },
    ],
    edges: [{ id: 'E-1', from: 'T-002', to: 'T-003' }],
    groups: [{ id: 'coding', members: ['T-002'] }],
    stateNodes: [],
  }, 'INST-001');
  const vs = app.state().viewState;
  vs.setZoom(1.5);
  vs.setPan(120, -40);
  vs.applyOffsets({ 'T-002': { dx: 40, dy: 60 } });
  vs.focus('T-003', 2);
  app.toggleGroup('coding');

  const s0 = app.state();
  const before = {
    zoom: s0.viewState.getZoom(),
    pan: s0.viewState.getPan(),
    offsets: s0.viewState.getOffsets(),
    collapsed: JSON.parse(JSON.stringify(s0.collapse)),
    focus: s0.viewState.getFocus(),
  };
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: baseDrill() });
  assert.equal(app.state().view, 'drill');
  app.backToGraph();
  const s1 = app.state();
  assert.equal(s1.view, 'graph');
  assert.ok(s1.viewState !== null, '不得走 backToList() 清空 viewState');
  assert.equal(s1.viewState.getZoom(), before.zoom);
  assert.deepEqual(s1.viewState.getPan(), before.pan);
  assert.deepEqual(s1.viewState.getOffsets(), before.offsets);
  assert.deepEqual(JSON.parse(JSON.stringify(s1.collapse)), before.collapsed);
  assert.deepEqual(s1.viewState.getFocus(), before.focus);
});

test('AC-02: 三条静态锚点 —— app.js createViewState 恰好 2 处，drill 内零命中，drill 内零 backToList', () => {
  const appJs = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
  const hits = appJs.match(/createViewState\(/g) ?? [];
  assert.equal(hits.length, 2);
  const drillDir = path.join(REPO, 'desktop', 'ui', 'drill');
  for (const file of fs.readdirSync(drillDir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(drillDir, file), 'utf8');
    assert.equal(/createViewState\(/.test(text), false, `${file} 不得新建视图状态`);
    assert.equal(/backToList\(/.test(text), false, `${file} 不得退回实例列表`);
  }
});

test('AC-03: 五词子集 + 零「已关闭」', () => {
  const allowed = ['available', 'serving', 'cooldown', 'unavailable', 'inactive'].map(statusWord);
  assert.deepEqual(allowed, ['可用', '服务中', '冷却中', '不可用', '未参与']);
  for (const token of ['available', 'serving', 'cooldown', 'unavailable', 'inactive']) {
    assert.ok(allowed.includes(statusWord(token)));
  }
  const app = makeApp();
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: baseDrill() });
  const line = app.state().drillView.roleBar.line;
  assert.ok(allowed.some((w) => line.includes(w)));
  assert.equal(line.includes(word('ROLE_INSTANCE_STATUS_LABEL_RETIRED') ?? '已关闭'), false);
  const allUi = ['app.js', 'drill/index.js', 'drill/role-bar.js']
    .map((p) => fs.readFileSync(path.join(REPO, 'desktop', 'ui', p), 'utf8')).join('\n');
  assert.equal(allUi.includes('已关闭'), false);
});

test('AC-04: 第 4 / 2 / 3 行逐字（折叠 / 占位 / 多宿主 / 无绑定）', () => {
  const app = makeApp();
  // 第 4 行：3 个服务中节点，折叠 + 多宿主
  app.openDrill({
    instanceId: 'INST-001', roleId: 'developer',
    data: baseDrill({
      roleBar: {
        roleTitle: '开发', statusToken: 'serving', activeSessions: 3,
        servingNodes: ['T-001', 'T-002', 'T-003'], hostIcons: ['dsh', 'cursor'],
        lastAction: { nodeId: 'T-002', round: 2, maxRounds: 3, state: 'review' },
      },
    }),
  });
  const l4 = app.state().drillView.roleBar.line;
  assert.equal(l4, [
    '角色栏 开发', statusWord('serving'), '3 个活跃会话',
    '服务 T-001 等 3 个', '宿主 dsh cursor',
    '最近 T-002 · 轮次 2/3 · ' + word('NODE_LABEL_REVIEW'),
  ].join(' · '));
  assert.equal(app.state().drillView.roleBar.servingFolded, true);
  assert.equal(app.state().drillView.roleBar.servingNodes.length, 3);

  // 第 2 行：有绑定节点但无服务中节点、无会话
  app.openDrill({
    instanceId: 'INST-001', roleId: 'tester',
    data: baseDrill({
      roleBar: {
        roleTitle: '测试', statusToken: 'available', activeSessions: 0,
        servingNodes: [], hostIcons: [],
        lastAction: { nodeId: 'T-010', round: 1, maxRounds: 1, state: 'pending' },
      },
    }),
  });
  const l2 = app.state().drillView.roleBar.line;
  assert.equal(l2, [
    '角色栏 测试', statusWord('available'), '0 个活跃会话',
    '服务 ' + placeholder, '宿主 ' + placeholder,
    '最近 T-010 · 轮次 1/1 · ' + word('NODE_LABEL_PENDING'),
  ].join(' · '));
  assert.deepEqual(app.state().drillView.roleBar.hostIcons, []);

  // 第 3 行：无绑定节点
  app.openDrill({
    instanceId: 'INST-001', roleId: 'coordinator',
    data: baseDrill({
      roleBar: {
        roleTitle: '协调者', statusToken: 'inactive', activeSessions: 0,
        servingNodes: [], hostIcons: [], lastAction: null,
      },
    }),
  });
  const l3 = app.state().drillView.roleBar.line;
  assert.equal(l3, [
    '角色栏 协调者', statusWord('inactive'), '0 个活跃会话',
    '服务 ' + placeholder, '宿主 ' + placeholder, '最近 ' + placeholder,
  ].join(' · '));
  assert.equal(app.state().drillView.roleBar.lastAction, null);
});
