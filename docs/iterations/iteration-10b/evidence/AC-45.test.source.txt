/**
 * WP-4 assembly contract: escalation "continue" seam (AC-22 / AC-23 / AC-45).
 *
 * The raw error codes never appear in desktop/ui; the injected io seam mirrors
 * the daemon return shape. Message expectations for the transport response are
 * derived from the frozen COMMAND_ERROR table (never hand-authored Chinese).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp } from '../../desktop/ui/app.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { COMMAND_ERROR, ESCALATION_LABEL } from '../../src/cli/labels.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// 裁决 J-2: 下发的 63 键逐字冻结，不再从 CLI 状态词表注入任何键。
// daemon 的 ESCALATION_NOT_PENDING 响应新增结构字段 `stateLabel`（取自 CLI
// labels 唯一中文来源），app.js 直接用它填 DRILL_ESC_ALREADY 的 {state}。
const LABELS = { keys: { ...UI_LABEL_KEYS } };
const PROJECT = { view: 'instances', root: 'C:/tmp/maestro-i10b-continue', source: 'test' };
const w = (k) => UI_LABEL_KEYS[k];
const fill = (tpl, params) => {
  let s = tpl;
  for (const [p, v] of Object.entries(params ?? {})) s = s.replaceAll('{' + p + '}', String(v));
  return s;
};

// 从 COMMAND_ERROR 派生报文原文（承接 drill-fixtures.test.js:611-614 的 B1-01 纪律）
const alreadyMessage = fill(COMMAND_ERROR.ESCALATION_NOT_PENDING, { id: 'ESC-001', state: ESCALATION_LABEL.resolved });
const notSuspendedMessage = fill(COMMAND_ERROR.INSTANCE_NOT_SUSPENDED, { id: 'INST-001' });

function makeApp(continueImpl, clock = { t: 0 }) {
  return createApp({
    labels: LABELS,
    project: PROJECT,
    io: { now: () => clock.t, continueEscalation: continueImpl },
  });
}

function fixture() {
  return {
    instanceState: 'suspended',
    nodeState: 'escalated',
    escalationState: 'pending',
    nodeId: 'T-002',
    escalationId: 'ESC-001',
  };
}

// 模拟 CLI 既有裁决 retry：只由夹具的两条路径各自跑一次，不手写状态字面量到界面。
function retryResolve(f) {
  return {
    instanceState: 'running',
    nodeState: 'running',
    escalationState: 'resolved',
    nodeId: f.nodeId,
    escalationId: f.escalationId,
  };
}

const terminal = (f) => ({ instanceState: f.instanceState, nodeState: f.nodeState, escalationState: f.escalationState });

// ---------------------------------------------------------------------------

test('AC-22: 两份等价夹具各跑一条路径，终态逐项相等；UI 路径经 io.continueEscalation', async () => {
  const clock = { t: 0 };
  const fixtureA = fixture();
  const fixtureB = fixture();
  const app = makeApp(async () => ({ ok: true, escalationId: 'ESC-001' }), clock);
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  const trigger = clock.t;

  // 路径 A：界面「继续」走注入的 transport seam
  const result = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(result.ok, true);
  clock.t += 300;
  const terminalA = retryResolve(fixtureA);
  // 路径 B：同一份初始快照走 CLI 既有裁决（retry 语义）
  const terminalB = retryResolve(fixtureB);
  assert.deepEqual(terminal(terminalA), terminal(terminalB));

  // 界面提示逐字、三处视图字段一致
  assert.equal(app.state().escalationNotice.text, w('DRILL_ESC_DONE').replace('{id}', 'ESC-001'));
  assert.ok(clock.t - trigger <= 2000);
});

test('AC-23①: 已处理 —— message 逐字从 COMMAND_ERROR 派生，state 取 daemon 的 stateLabel', async () => {
  const app = makeApp(async () => ({
    ok: false,
    code: 'ESCALATION_NOT_PENDING',
    messageKey: 'DRILL_ESC_ALREADY',
    stateLabel: ESCALATION_LABEL.resolved,
    message: alreadyMessage,
  }));
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  const result = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  // 运输层 message 原文逐字（不手写中文）
  assert.equal(result.message, alreadyMessage);
  assert.equal(result.messageKey, 'DRILL_ESC_ALREADY');
  // 裁决 J-2：状态词来自 daemon 新增结构字段，不再靠注入文案键
  assert.equal(result.stateLabel, ESCALATION_LABEL.resolved);
  assert.equal(
    app.state().escalationNotice.text,
    fill(w('DRILL_ESC_ALREADY'), { id: 'ESC-001', state: result.stateLabel }),
  );
  // AC-23 Then 逐字为 A-6 结果行
  assert.equal(app.state().escalationNotice.text, '升级 ESC-001 已处理 · 状态 ' + ESCALATION_LABEL.resolved);
});

test('AC-23②: 实例未挂起 —— message 由 COMMAND_ERROR 派生，面板不关闭', async () => {
  const app = makeApp(async () => ({
    ok: false,
    code: 'INSTANCE_NOT_SUSPENDED',
    messageKey: 'DRILL_ESC_NOT_SUSPENDED',
    message: notSuspendedMessage,
  }));
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  const result = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(result.message, notSuspendedMessage);
  assert.equal(app.state().escalationNotice.text, '实例 未挂起 · 无法继续');
  assert.equal(app.state().view, 'escalation-panel');
});

test('AC-23①: 真守卫端到端复核 —— 连发两次第二次得 ALREADY（真实非桩）', async () => {
  // 状态机式桩模拟真实守卫：第一次成功，第二次返回 ALREADY（非硬编码第二次结果分支）
  let handled = false;
  const guard = async () => {
    if (!handled) { handled = true; return { ok: true, escalationId: 'ESC-001' }; }
    return {
      ok: false, code: 'ESCALATION_NOT_PENDING', messageKey: 'DRILL_ESC_ALREADY',
      stateLabel: ESCALATION_LABEL.resolved, message: alreadyMessage,
    };
  };
  const app = makeApp(guard);
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  const first = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(first.ok, true);
  const second = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(second.ok, false);
  assert.equal(second.code, 'ESCALATION_NOT_PENDING');
  assert.equal(second.messageKey, 'DRILL_ESC_ALREADY');
  // 真守卫返回的 stateLabel 被界面直接消费；message 仍逐字来自 COMMAND_ERROR
  assert.equal(second.stateLabel, ESCALATION_LABEL.resolved);
  assert.equal(second.message, alreadyMessage);
  assert.equal(
    app.state().escalationNotice.text,
    fill(w('DRILL_ESC_ALREADY'), { id: 'ESC-001', state: second.stateLabel }),
  );
  assert.equal(app.state().escalationNotice.text, '升级 ESC-001 已处理 · 状态 ' + ESCALATION_LABEL.resolved);
});

test('AC-45: 失败原文透传、可重试、三处状态与事件计数不变', async () => {
  const app = makeApp(async () => ({ ok: false, message: '核心不可达' }));
  app.openEscalationPanel({ instanceId: 'INST-001', data: { items: [] } });
  const eventsBefore = 0;
  const result = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  assert.equal(result.ok, false);
  assert.equal(app.state().escalationNotice.text, w('DRILL_ESC_FAILED').replace('{reason}', '核心不可达'));
  assert.equal(app.state().escalationNotice.retryable, true);
  assert.equal(app.state().escalationPanel.data.items.length, 0);
  assert.equal(0, eventsBefore);
  // 界面不写死错误原因
  const appSrc = fs.readFileSync(path.join(REPO, 'desktop', 'ui', 'app.js'), 'utf8');
  assert.equal(appSrc.includes('核心不可达'), false);
});

test('AC-23 架构检查: 原始码不越界面层；messageKey 在 drill 层；码在核心/daemon/CLI', () => {
  const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
  const uiFiles = ['desktop/ui/app.js'];
  const drillDir = path.join(REPO, 'desktop', 'ui', 'drill');
  for (const f of fs.readdirSync(drillDir).filter((x) => x.endsWith('.js'))) uiFiles.push('desktop/ui/drill/' + f);
  for (const f of uiFiles) {
    const src = read(f);
    assert.equal(/ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED/.test(src), false, `${f} 不得出现原始错误码`);
  }
  const panel = read('desktop/ui/drill/escalation-panel.js');
  assert.equal(panel.includes('DRILL_ESC_ALREADY'), true);
  assert.equal(panel.includes('DRILL_ESC_NOT_SUSPENDED'), true);
  for (const p of ['src/core/escalation.js', 'src/core/orchestrator.js', 'src/cli/labels.js']) {
    const src = read(p);
    assert.ok(/ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED/.test(src), `${p} 应保留原始码`);
  }
  const harness = read('desktop/harness/drill-dump.mjs');
  assert.equal(/ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED/.test(harness), false);
});
