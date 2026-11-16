/**
 * WP-4 assembly contract: runtime degradations + unknown role (AC-31 / AC-37).
 * All visible lines are derived from the frozen label table; this file never
 * authors a Chinese sentence. Interface-still-operable is asserted via the
 * createApp state/probe surface.
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
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-errors', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];
const statusWord = (t) => JSON.parse(w('DRILL_ROLE_STATUS_TOKEN'))[t];
const fill = (k, params) => {
  let s = w(k);
  for (const [p, v] of Object.entries(params ?? {})) s = s.replaceAll('{' + p + '}', String(v));
  return s;
};

function makeApp() {
  return createApp({ labels: LABELS, project: PROJECT, io: { now: () => 0 } });
}

const EXPECTED = {
  missingInstance: fill('DESKTOP_GRAPH_MISSING', { id: 'INST-999' }),
  unusedRole: fill('DRILL_ROLE_UNUSED', { role: '协调者' }),
  missingNode: fill('DRILL_NODE_MISSING', { node: 'T-003' }),
  reconnecting: w('DESKTOP_CONN_RECONNECTING'),
};

test('AC-31: 四类异常提示逐字（从文案键派生）', () => {
  assert.equal(EXPECTED.missingInstance, '实例 INST-999 · 不存在');
  assert.equal(EXPECTED.unusedRole, '角色 协调者 · 本实例未使用');
  assert.equal(EXPECTED.missingNode, '节点 T-003 · 不存在');
  assert.equal(EXPECTED.reconnecting, '已断开 · 正在重连…');
});

test('AC-31: 异常后界面仍可操作（返回 / 重试探针存在，不白屏、不抛栈）', async () => {
  const app = makeApp();
  // 实例不存在：openGraph 走 notice 分支，仍保留返回动作
  await app.openGraph('INST-999');
  const composed = app.compose();
  assert.ok(composed.notice && composed.notice.text.length > 0);
  assert.ok(composed.actions.some((a) => a.id === 'back-to-list' || a.id === 'retry-graph'));

  // 节点不存在 / 角色未使用 / 推送断开：均从同一投影派生，界面不抛异常
  const data = {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'coordinator', roleTitle: '协调者' },
    roleBar: {
      roleTitle: '协调者', statusToken: 'inactive', statusReason: 'unused-role', activeSessions: 0,
      servingNodes: [], hostIcons: [], lastAction: null,
    },
    dag: { nodes: [], edges: [], dangling: 0 },
    cards: [], now: 0,
  };
  app.openDrill({ instanceId: 'INST-001', roleId: 'coordinator', data });
  assert.equal(app.state().view, 'drill');
  assert.equal(app.state().drillView.cardsEmptyText, w('DRILL_EMPTY_TASK'));
  app.handleFrame({ type: 'connection.status', data: { status: 'closed' } });
  // 仍可返回流程图
  app.backToGraph();
  assert.equal(app.state().view, 'graph');
});

test('AC-31 架构检查: drill 渲染层不抛异常', () => {
  const dir = path.join(REPO, 'desktop', 'ui', 'drill');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(/throw new Error/.test(text), false, `${file} 不得抛异常`);
  }
});

test('AC-37: 未知角色状态栏「不可用」，其余四项照常，statusReason 透传', () => {
  const data = {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'external-auditor', roleTitle: '外部审核' },
    roleBar: {
      roleTitle: '外部审核', statusToken: 'unavailable', statusReason: 'unknown-role',
      activeSessions: 1, servingNodes: ['T-021'], hostIcons: ['dsh'],
      lastAction: { nodeId: 'T-021', round: 1, maxRounds: 1, state: 'running', stateSince: '2026-11-15T10:04:00.000Z' },
    },
    dag: {
      nodes: [
        { nodeId: 'T-020', relation: 'self', type: 'role', status: 'pending' },
        { nodeId: 'T-021', relation: 'self', type: 'role', status: 'running' },
      ],
      edges: [], dangling: 0,
    },
    cards: [
      { nodeId: 'T-020', tier: 'ready', rank: 6, state: 'pending', round: '1/1' },
      { nodeId: 'T-021', tier: 'running', rank: 3, state: 'running', round: '1/1' },
    ],
    now: 0,
  };
  const app = makeApp();
  app.openDrill({ instanceId: 'INST-001', roleId: 'external-auditor', data });
  const bar = app.state().drillView.roleBar;
  assert.equal(bar.status, statusWord('unavailable'));
  assert.equal(bar.statusReason, 'unknown-role');
  assert.equal(bar.line, [
    '角色栏 外部审核', statusWord('unavailable'), '1 个活跃会话',
    '服务 T-021', '宿主 dsh',
    '最近 T-021 · 轮次 1/1 · ' + w('NODE_LABEL_RUNNING'),
  ].join(' · '));
  assert.deepEqual(bar.servingNodes, ['T-021']);
  assert.deepEqual(bar.hostIcons, ['dsh']);
  assert.deepEqual(bar.lastAction, { nodeId: 'T-021', round: 1, maxRounds: 1, state: 'running', stateSince: '2026-11-15T10:04:00.000Z' });
  assert.equal(app.state().drillView.cards.length, 2);
  // 独立模块同证
  assert.equal(createDrillView({ labels: LABELS, data, interactions: {} }).roleBar.status, statusWord('unavailable'));
});

test('AC-37 架构检查: 界面不查注册表判定角色是否存在', () => {
  const dir = path.join(REPO, 'desktop', 'ui', 'drill');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.equal(/registry|roleMap/.test(text), false, `${file} 不得查注册表`);
  }
});
