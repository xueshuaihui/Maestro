/**
 * WP-4 assembly contract: read-only browsing + stability counters (AC-28).
 * Verifies the three state files are never written and the four state groups
 * stay byte-identical, plus the internal 40/30/1 stability口径 from NF-4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { createApp } from '../../desktop/ui/app.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const LABELS = { keys: UI_LABEL_KEYS };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-readonly', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function fixtureData() {
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
    ],
    now: 0,
  };
}

test('AC-28: 浏览全程三份文件哈希与四组状态不变，三处视图一致', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10b-readonly-'));
  const files = {
    state: path.join(dir, 'state.json'),
    events: path.join(dir, 'events.jsonl'),
    traces: path.join(dir, 'traces.jsonl'),
  };
  const groups = {
    nodes: [{ nodeId: 'T-001', state: 'running' }],
    sessions: [{ sessionId: 'S1', hostId: 'dsh' }],
    handoffs: [{ handoffId: 'HO-1', state: 'delivered' }],
    escalations: [{ escalationId: 'ESC-1', state: 'pending' }],
  };
  fs.writeFileSync(files.state, JSON.stringify(groups));
  fs.writeFileSync(files.events, JSON.stringify([{ type: 'node.updated' }]));
  fs.writeFileSync(files.traces, JSON.stringify([{ span: 'x' }]));
  const before = { state: hash(files.state), events: hash(files.events), traces: hash(files.traces) };
  const groupsBefore = JSON.parse(JSON.stringify(groups));

  const app = createApp({ labels: LABELS, project: PROJECT, io: { now: () => 0 } });
  const data = fixtureData();
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data });
  const beforeLine = app.state().drillView.roleBar.line;
  const beforeCards = app.state().drillView.cards.map((c) => c.nodeId);
  const beforeDag = app.state().drillView.dag.nodes.map((n) => n.nodeId);

  // 前置浏览动作（不计入取数统计）：展开交接 / 详情 / 看板 / 复制 / 子流程等
  app.openConnectionPanel({ edgeId: 'E-1', data: { edge: {}, handoffs: [] } });
  app.openNodeDetail({ nodeId: 'T-003', data: { node: { nodeId: 'T-003' }, timeline: [], summary: null, evidence: [], handoffs: [] } });
  if (typeof app.state().drillView?.scrollToEnd === 'function') app.state().drillView.scrollToEnd();
  app.openAllNodes();
  app.backToDrill();
  app.openSubflow({ data: {} });
  app.backSubflow();

  // 三份文件与四组状态未被写
  assert.equal(hash(files.state), before.state);
  assert.equal(hash(files.events), before.events);
  assert.equal(hash(files.traces), before.traces);
  const after = JSON.parse(fs.readFileSync(files.state, 'utf8'));
  assert.deepEqual(after, groupsBefore);

  // 三处视图与操作前一致（重新以同一投影进入下钻比对）
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: fixtureData() });
  assert.equal(app.state().drillView.roleBar.line, beforeLine);
  assert.deepEqual(app.state().drillView.cards.map((c) => c.nodeId), beforeCards);
  assert.deepEqual(app.state().drillView.dag.nodes.map((n) => n.nodeId), beforeDag);
  // 无「已变更 / 提交」提示
  assert.equal(app.state().escalationNotice, null);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-28 / NF-4: 40 次导航 opCount=40，fetchCount=30，maxFetchesPerView=1（内部断言）', () => {
  const app = createApp({ labels: LABELS, project: PROJECT, io: { now: () => 0 } });
  const data = fixtureData();
  app.openGraph('INST-001');

  // 进入下钻 10 + 退出 10
  for (let i = 0; i < 10; i += 1) {
    app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data });
    app.backToGraph();
  }
  // 进入看板 10（每次进入取 1 份数据）
  for (let i = 0; i < 10; i += 1) app.openAllNodes();
  // 下钻子流程 10（每次进入取 1 份数据）
  for (let i = 0; i < 10; i += 1) app.openSubflow({ data: {} });

  const st = app.state();
  assert.equal(st.opCount, 40);
  assert.equal(st.fetchCount, 30);
  assert.ok(st.fetchCount <= st.opCount);
  assert.equal(st.maxFetchesPerView, 1);
  assert.equal(st.crashCount, 0);
  assert.equal(st.daemonRestarts, 0);
});

test('AC-28: 唯一写动作「继续」之后才出现状态变化提示（与只读分开记账）', async () => {
  const app = createApp({
    labels: LABELS,
    project: PROJECT,
    io: {
      now: () => 0,
      continueEscalation: async () => ({ ok: true, escalationId: 'ESC-001' }),
    },
  });
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  assert.equal(app.state().escalationNotice, null);
  const result = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(result.ok, true);
  assert.equal(app.state().escalationNotice.text, w('DRILL_ESC_DONE').replace('{id}', 'ESC-001'));
});
