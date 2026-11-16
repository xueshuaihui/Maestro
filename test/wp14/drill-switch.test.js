/**
 * WP-4 assembly contract: drill <-> shared 7-column board (AC-16).
 * Drives the real createApp navigation; column names come from the frozen
 * board module + label table, never authored in this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../desktop/ui/app.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const LABELS = { keys: UI_LABEL_KEYS };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-switch', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];

function makeApp() {
  return createApp({ labels: LABELS, project: PROJECT, io: { now: () => 0 } });
}

function drillData() {
  return {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'developer', roleTitle: '开发' },
    roleBar: {
      roleTitle: '开发', statusToken: 'serving', activeSessions: 2,
      servingNodes: ['T-001', 'T-002'], hostIcons: ['dsh', 'cursor'],
      lastAction: { nodeId: 'T-002', round: 2, maxRounds: 3, state: 'review' },
    },
    dag: {
      nodes: ['T-001', 'T-002', 'T-003'].map((nodeId) => ({ nodeId, relation: 'self', type: 'role', status: 'running' })),
      edges: [], dangling: 0,
    },
    cards: [
      { nodeId: 'T-001', tier: 'running', rank: 3, state: 'running', title: '实现登录', round: '1/3' },
      { nodeId: 'T-002', tier: 'review', rank: 4, state: 'review', title: '联调', round: '2/3' },
      { nodeId: 'T-003', tier: 'done', rank: 8, state: 'done', title: '收尾', round: '1/3' },
    ],
    now: 0,
  };
}

const EXPECTED_COLUMNS = [
  w('DESKTOP_BOARD_COLUMN_BLOCKED'), w('DESKTOP_BOARD_COLUMN_READY'),
  w('DESKTOP_BOARD_COLUMN_RUNNING'), w('DESKTOP_BOARD_COLUMN_REVIEW'),
  w('DESKTOP_BOARD_COLUMN_DONE'), w('DESKTOP_BOARD_COLUMN_FAILED'),
  w('DESKTOP_BOARD_COLUMN_ESCALATED'),
];

test('AC-16: 切到 7 列看板，列名数组逐项来自文案键', () => {
  const app = makeApp();
  app.setGraph({ nodes: [], edges: [], stateNodes: [] }, 'INST-001');
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: drillData() });
  app.openAllNodes();
  assert.equal(app.state().view, 'board');
  const composed = app.compose();
  assert.deepEqual(composed.board.columnNames, EXPECTED_COLUMNS);
  assert.equal(composed.board.columns.length, 7);
});

test('AC-16: 返回后 view===drill（不是流程图），高亮与滚动位置保持', () => {
  const app = makeApp();
  app.setGraph({ nodes: [], edges: [], stateNodes: [] }, 'INST-001');
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: drillData() });
  // 滚动到第 3 张卡片并高亮 T-002（真实联动入口）
  app.state().drillView.clickCard('T-002');
  const beforeHighlight = app.state().drillView.highlight;
  const beforeScroll = app.state().drillView.scrollTarget;
  const beforeCardIds = app.state().drillView.cards.map((c) => c.nodeId);
  const scrollTopBefore = beforeCardIds.indexOf(beforeScroll);

  app.openAllNodes();
  assert.equal(app.state().view, 'board');
  app.backToDrill();
  const st = app.state();
  assert.equal(st.view, 'drill', '返回的是下钻，不是流程图');
  assert.equal(st.drillView.highlight, beforeHighlight);
  assert.equal(st.drillView.scrollTarget, beforeScroll);
  assert.equal(st.drillView.cards.map((c) => c.nodeId).indexOf(st.drillView.scrollTarget), scrollTopBefore);
});

test('AC-16: 面包屑在下钻与看板间正确切换；看板未复制第二套列名模块', () => {
  const app = makeApp();
  app.setGraph({ nodes: [], edges: [], stateNodes: [] }, 'INST-001');
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: drillData() });
  const crumbDrill = app.compose().breadcrumb;
  assert.equal(crumbDrill, '实例 INST-001 / 角色 开发');
  app.openAllNodes();
  assert.equal(app.compose().view, 'board');
  app.backToDrill();
  assert.equal(app.compose().breadcrumb, crumbDrill);

  // 架构检查：下钻层不复制看板列名词面
  const drillPath = fileURLToPath(new URL('../../desktop/ui/drill/index.js', import.meta.url));
  const drillText = fs.readFileSync(drillPath, 'utf8');
  assert.equal(/DESKTOP_BOARD_COLUMN_|被阻塞|可调度/.test(drillText), false);
});
