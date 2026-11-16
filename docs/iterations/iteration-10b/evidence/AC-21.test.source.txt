/**
 * WP-4 assembly contract: special-node jump + escalation panel boundaries
 * (AC-20 / AC-21 / AC-24 / AC-44 / AC-49).
 * Both escalation entry points land on the SAME `view === 'escalation-panel'`
 * state; the badge entry must NEVER be `drill` (AC-49).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../desktop/ui/app.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LABELS = { keys: UI_LABEL_KEYS };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-special', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];
const handoffWord = (s) => w('HANDOFF_LABEL_' + String(s).toUpperCase());
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function makeApp() {
  return createApp({ labels: LABELS, project: PROJECT, io: { now: () => 0 } });
}

function escalations(two = true) {
  return {
    items: two ? [
      { escalationId: 'ESC-001', state: 'pending', nodeId: 'T-003', roleId: 'dev', round: 2,
        reasonDetail: '测试第 2 轮失败', defects: [{ summary: '断言失败', evidence: 'defects/d1.md' }] },
      { escalationId: 'ESC-002', state: 'pending', nodeId: 'T-005', roleId: 'dev', round: 1,
        reasonDetail: '合并冲突', defects: [{ summary: '冲突未解决', evidence: 'defects/d2.md' }] },
    ] : [],
    resolved: two ? [] : [
      { escalationId: 'ESC-003', state: 'resolved', nodeId: 'T-007', roleId: 'dev', round: 1 },
      { escalationId: 'ESC-004', state: 'resolved', nodeId: 'T-008', roleId: 'dev', round: 1 },
    ],
  };
}

// ---------------------------------------------------------------------------

test('AC-20: 人工节点进入节点详情，面包屑/盾牌 token/四段逐字', () => {
  const app = makeApp();
  app.openGraph('INST-001');
  const data = {
    node: { nodeId: 'H-001', title: '人工验收', state: 'pending', round: 0, maxRounds: 1, nodeType: 'human' },
    timeline: [], summary: null, evidence: [],
    handoffs: [{ handoffId: 'HO-012', direction: 'forward', round: 1, state: 'accepted', lastActivity: '2026-11-15T09:20:00.000Z' }],
  };
  app.openNodeDetail({ nodeId: 'H-001', data, breadcrumbKey: 'DRILL_CRUMB_NODE' });
  assert.equal(app.state().view, 'node-detail');
  const v = app.state().detail.view;
  assert.equal(v.breadcrumb, '实例 INST-001 / 节点 H-001');
  assert.equal(v.detail.visual.shape, 'shield');
  const lines = (key) => v.detail.sections.find((s) => s.key === key).lines;
  assert.deepEqual(lines('timeline'), [w('DRILL_DETAIL_NONE').replace('{section}', v.detail.sections[0].title)]);
  assert.deepEqual(lines('summary'), [w('DRILL_DETAIL_NONE').replace('{section}', v.detail.sections[1].title)]);
  assert.deepEqual(lines('evidence'), [w('DRILL_DETAIL_NONE').replace('{section}', v.detail.sections[2].title)]);
  assert.equal(lines('handoff')[0],
    w('DRILL_DETAIL_HANDOFF')
      .replace('{id}', 'HO-012').replace('{direction}', w('DESKTOP_EDGE_DIRECTION_FORWARD'))
      .replace('{round}', '1').replace('{state}', handoffWord('accepted')).replace('{time}', '09:20:00'));
  // 人工节点详情不引用升级面板
  const src = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'drill', 'node-detail.js'), 'utf8');
  assert.equal(/escalation/.test(src), false);
});

test('AC-21: 升级节点进入面板，本实例作用域 + 原因/缺陷逐字', () => {
  const app = makeApp();
  app.openGraph('INST-001');
  app.openEscalationPanel({ instanceId: 'INST-001', data: escalations(true), breadcrumbKey: 'DRILL_CRUMB_NODE' });
  assert.equal(app.state().view, 'escalation-panel');
  const p = app.state().escalationPanel.view.escalations;
  assert.equal(p.title, w('DRILL_ESC_TITLE'));
  assert.equal(p.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'));
  assert.deepEqual(p.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002']);
  assert.equal(p.items[0].reasonLine, '原因：测试第 2 轮失败');
  assert.equal(p.items[0].defectLines[0], '缺陷：断言失败（证据 defects/d1.md）');
  assert.equal(JSON.stringify(p.items).includes('INST-002'), false);
});

test('AC-24: 面板可操作项恰为继续与取消；写动作只有 continue', () => {
  const app = makeApp();
  app.openEscalationPanel({ instanceId: 'INST-001', data: escalations(true) });
  const p = app.state().escalationPanel.view.escalations;
  assert.deepEqual(p.actions, [w('DRILL_ESC_CONTINUE'), w('DRILL_ESC_CANCEL')]);
  assert.deepEqual(p.actions, ['继续', '取消']);
  // 架构检查：不出现重派 / 终止 / 允许 / 拒绝
  for (const file of ['escalation-panel.js', 'index.js']) {
    const src = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'drill', file), 'utf8');
    assert.equal(/reassign|terminate|approve|deny/.test(src), false);
  }
  const daemon = fs.readFileSync(path.join(REPO, 'src', 'daemon', 'drill.js'), 'utf8');
  assert.equal(/reassign|terminate|approve|deny/.test(daemon), false);
});

test('AC-44: 0 待处理升级空态 + 2 条已处理记录，继续不可点', () => {
  const app = makeApp();
  app.openEscalationPanel({ instanceId: 'INST-001', data: escalations(false) });
  const p = app.state().escalationPanel.view.escalations;
  assert.equal(p.countLine, w('DRILL_ESC_COUNT').replace('{n}', '0'));
  assert.equal(p.items.length, 0);
  assert.equal(p.resolved.length, 2);
  assert.equal(p.continueDisabled, true);
  assert.deepEqual({ continue: { disabled: p.continueDisabled } }.continue, { disabled: true });
});

test('AC-49: escalated 角标入口 view===escalation-panel 且 !== drill，回到流程图状态保持，状态哈希不变', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10b-badge-'));
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ schemaVersion: 2, rev: 9, state: 'suspended', nodes: [] }));
  const beforeHash = hash(stateFile);

  const app = makeApp();
  app.setGraph({
    nodes: [
      { id: 'T-003', type: 'role', title: '实现登录', status: 'escalated' },
      { id: 'T-005', type: 'role', title: '归档', status: 'done' },
    ],
    edges: [], groups: [{ id: 'coding', members: ['T-003'] }], stateNodes: [],
  }, 'INST-001');
  const vs = app.state().viewState;
  vs.setZoom(1.5); vs.setPan(60, -20);
  app.toggleGroup('coding');
  const before = {
    zoom: vs.getZoom(), pan: vs.getPan(),
    collapsed: JSON.parse(JSON.stringify(app.state().collapse)),
  };

  // 角标入口（不经过角色下钻）
  app.openEscalationPanel({ instanceId: 'INST-001', data: escalations(true), breadcrumbKey: 'DRILL_CRUMB_NODE' });
  const st = app.state();
  assert.equal(st.view, 'escalation-panel');
  assert.notEqual(st.view, 'drill');
  const v = st.escalationPanel.view;
  assert.equal(v.breadcrumb, '实例 INST-001 / 升级处理');
  assert.equal(v.escalations.countLine, w('DRILL_ESC_COUNT').replace('{n}', '2'));
  assert.deepEqual(v.escalations.items.map((i) => i.escalationId), ['ESC-001', 'ESC-002']);
  assert.deepEqual(v.escalations.actions, ['继续', '取消']);

  app.backToGraph();
  const s2 = app.state();
  assert.equal(s2.viewState.getZoom(), before.zoom);
  assert.deepEqual(s2.viewState.getPan(), before.pan);
  assert.deepEqual(JSON.parse(JSON.stringify(s2.collapse)), before.collapsed);
  assert.equal(hash(stateFile), beforeHash);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-49 架构检查: 面板标题只在一处产出（DRILL_ESC_TITLE 恰 1 条）', () => {
  const dir = path.join(REPO, 'desktop', 'ui', 'drill');
  let count = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    if (text.includes('DRILL_ESC_TITLE')) count += 1;
  }
  assert.equal(count, 1);
});
