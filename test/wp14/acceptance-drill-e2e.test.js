/**
 * I1.10b WP-6 · AC-29 规划验收句端到端（九步探针序列 / 七条 Then 逐条机检）。
 *
 * 主责 AC-29：人在面板上完整走「角色流程图发现异常 → 下钻到角色 → 查看任务卡片
 * → 展开证据 → 处理升级 → 实例继续」，全程不需要终端；子工作流可下钻。
 *
 * 本机无窗口级自动判据（裁决 B / U-04），故本文件走「纯模块面 + createApp 装配面
 * + 回环接口面」：所有九步都由真实 `createApp` 方法驱动，探针事件在数据上来自真实
 * 装配状态（drillView / detail.view / escalationPanel.view / buildSubflow 输出），
 * 不写测试专用渲染分支、不放宽任何 Then。
 *
 * 九步探针序列（顺序固定，机检断言）：
 *   graph-shown → drill-shown → detail-shown → evidence-shown → escalation-shown
 *   → continued → graph-returned → subflow-shown → graph-restored
 *
 * 夹具纪律：%TEMP%（os.tmpdir）独立根；NODE_ENV=test；mock 宿主（transport 桩，
 * 不启动真实进程）；单文件 ≤10 场景/进程。内部断言 `t_continued - t_confirm ≤ 2000`
 * 用注入时钟承载，标「内部断言」，不冒充用户可见结论（裁决 H 第 5 条 / F4-14）。
 *
 * 升级由 transport 桩模拟真实核心裁决（resolveEscalation retry）的返回，界面不直接改状态；
 * 桩只提供返回值，不写任何产品文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, buildGraphShownProbe } from '../../desktop/ui/app.js';
import { buildSubflow } from '../../desktop/ui/drill/subflow.js';
import { fillTemplate } from '../../desktop/ui/labels/labels.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { ESCALATION_LABEL } from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const word = (key, params = {}) => fillTemplate(UI_LABEL_KEYS[key] ?? '', params);
const statusWord = (token) => JSON.parse(UI_LABEL_KEYS.DRILL_ROLE_STATUS_TOKEN)[token];

/** 九步探针的期望事件名（机检顺序锚点）。 */
const PROBE_ORDER = [
  'graph-shown',
  'drill-shown',
  'detail-shown',
  'evidence-shown',
  'escalation-shown',
  'continued',
  'graph-returned',
  'subflow-shown',
  'graph-restored',
];

/** 终端 / CLI 事件特征：第 6 条要求探针集合里一个都不出现。 */
const TERMINAL_EVENT = /(terminal|cli|shell|command|exec|spawn|bash|cmd)/i;

/** 子工作流定义（S-001 → publish-child，内部 3 个角色）。 */
const WORKFLOW_DEFS = {
  'acceptance-flow': {
    title: '验收主流程',
    nodes: [{ id: 'S-001', node_type: 'subworkflow', role: 'dev', workflow: 'publish-child' }],
    edges: [],
  },
  'publish-child': {
    title: '发布子流程',
    nodes: [
      { id: 'C-1', node_type: 'role', role: 'dev' },
      { id: 'C-2', node_type: 'role', role: 'dev' },
      { id: 'C-3', node_type: 'role', role: 'tester' },
    ],
    edges: [{ id: 'CE-1', from: 'C-1', to: 'C-2', kind: 'forward' }],
  },
};

/** 图投影夹具：异常角色（abnormal）+ 被拒绝的红色连接线（aggregateStatus=rejected）。 */
function makeGraph() {
  return {
    instanceId: 'INST-001',
    template: 'code-loop',
    state: 'suspended',
    rev: 1,
    workflow: { ref: 'acceptance-flow', readable: true },
    nodes: [
      { id: 'T-003', type: 'role', title: '实现登录', state: 'escalated', abnormal: true, abnormalCount: 1 },
      { id: 'X-001', type: 'escalate', title: '升级处置', state: 'pending', abnormal: false, abnormalCount: 0 },
      { id: 'H-001', type: 'human', title: '人工验收', state: 'pending', abnormal: false, abnormalCount: 0 },
      { id: 'S-001', type: 'subworkflow', title: '发布子流程', state: 'pending', collapsed: true, memberCount: 3, abnormal: false, abnormalCount: 0 },
    ],
    edges: [
      { id: 'E-01', from: 'T-003', to: 'X-001', kind: 'forward', aggregateStatus: 'escalated' },
      { id: 'E-02', from: 'T-003', to: 'H-001', kind: 'forward', aggregateStatus: 'rejected' },
    ],
    stateNodes: [],
    groups: [],
  };
}

/** 角色下钻一次性数据（§3.3 形状；异常面在 Given 里造全）。 */
function makeDrillData(now) {
  return {
    breadcrumb: { key: 'DRILL_CRUMB_ROLE', instanceId: 'INST-001', roleId: 'developer', roleTitle: '开发' },
    roleBar: {
      roleTitle: '开发',
      statusToken: 'unavailable',
      statusReason: 'escalated-session',
      activeSessions: 1,
      servingNodes: ['T-003'],
      hostIcons: ['dsh'],
      lastAction: { nodeId: 'T-003', round: 2, maxRounds: 2, state: 'escalated' },
    },
    dag: {
      nodes: [
        { nodeId: 'T-003', relation: 'self', type: 'role', status: 'escalated' },
        { nodeId: 'X-001', relation: 'downstream', type: 'escalate', status: 'pending' },
      ],
      edges: [{ id: 'E-01', from: 'T-003', to: 'X-001', direction: 'forward' }],
      bounds: { width: 240, height: 80 },
      dangling: 0,
    },
    cards: [
      { nodeId: 'T-003', tier: 'escalated', rank: 1, state: 'escalated', title: '实现登录', round: '2/2' },
    ],
    now,
  };
}

/** 节点详情夹具（四段齐全 + 三条证据引用：两条可解析、一条缺失）。 */
function makeDetailData() {
  return {
    node: { nodeId: 'T-003', title: '实现登录', state: 'escalated', round: 2, maxRounds: 2, nodeType: 'role' },
    timeline: [{ ts: '2026-11-15T09:12:03.000Z', sessionState: 'running' }],
    summary: { command: 'npm test', exitCode: 1, keyOutputLines: 12, logRef: 'logs/T-003.log' },
    evidence: [
      { index: 1, ref: 'artifacts/code/calc.js', type: 'artifact', typeLabel: '产物', status: 'resolvable', statusLabel: '可解析' },
      { index: 2, ref: 'defects/d1.md', type: 'defect', typeLabel: '缺陷', status: 'missing', statusLabel: '缺失' },
      { index: 3, ref: 'logs/T-003.log', type: 'artifactRef', typeLabel: '产物引用', status: 'resolvable', statusLabel: '可解析' },
    ],
    handoffs: [{ handoffId: 'HO-008', direction: 'forward', round: 1, state: 'rejected', lastActivity: '2026-11-15T09:20:11.000Z' }],
  };
}

/** 升级列表夹具（ESC-001 的原因/缺陷逐字展示字段在接缝产出后由夹具补齐）。 */
function makeEscalationData() {
  return {
    items: [{
      escalationId: 'ESC-001',
      state: 'pending',
      nodeId: 'T-003',
      roleId: 'developer',
      roleLabel: '开发',
      round: 2,
      reasonDetail: '测试第 2 轮失败',
      defects: [{ summary: '断言失败', evidence: 'defects/d1.md' }],
    }],
    resolved: [],
  };
}

/**
 * 跑完九步，返回 { probes, snap, timing, tempRoot }。
 * snap 存每一步从真实装配状态取出的关键值，供七条 Then 逐条断言。
 */
async function runNineSteps() {
  // 注入时钟：每一步推进固定量，continue 的到达阈值用同一时钟测。
  let now = 1_760_000_000_000;
  const clock = () => now;
  const advance = (ms) => { now += ms; };

  // 证据物理面：两条真实存在、一条故意缺失（Then 3 的可解析/缺失由此而来）。
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10b-acceptance-'));
  fs.mkdirSync(path.join(tempRoot, 'artifacts', 'code'), { recursive: true });
  fs.mkdirSync(path.join(tempRoot, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'artifacts', 'code', 'calc.js'), '// fixture\n', 'utf8');
  fs.writeFileSync(path.join(tempRoot, 'logs', 'T-003.log'), 'npm test\n', 'utf8');

  const probes = [];
  const emit = (event, payload = {}) => {
    probes.push({ event, t: clock(), ...payload });
  };

  // 状态由 suspended → running（模拟 resolveEscalation retry 的核心裁决结果）。
  const status = { state: 'suspended' };
  const io = {
    now: clock,
    // 不注入 transport.probe：九步探针由本夹具在每步从装配状态派生后显式发出。
    continueEscalation: async ({ escalationId }) => {
      status.state = 'running';
      return {
        ok: true,
        escalationId,
        stateLabel: ESCALATION_LABEL.resolved,
      };
    },
  };

  const app = createApp({
    labels: { keys: UI_LABEL_KEYS },
    project: { view: 'graph', root: tempRoot, source: 'test' },
    io,
  });

  const snap = {};

  // ① 在图上点击挂红色角标的角色：先渲染流程图（graph-shown）。
  const graph = makeGraph();
  app.setGraph(graph, 'INST-001');
  const graphProbe = buildGraphShownProbe(graph, 'INST-001');
  emit('graph-shown', {
    instanceId: 'INST-001',
    view: 'graph',
    nodes: graphProbe.nodes,
    edges: graphProbe.edges,
    dangling: graphProbe.dangling,
    abnormalRoles: graph.nodes.filter((n) => n.type === 'role' && n.abnormal === true).map((n) => n.id),
    rejectedEdges: graph.edges.filter((e) => e.aggregateStatus === 'rejected').map((e) => e.id),
  });
  snap.graph = graph;
  advance(100);

  // ② 点排序第一的卡片 → 进入角色下钻（drill-shown）。
  app.openDrill({ instanceId: 'INST-001', roleId: 'developer', data: makeDrillData(clock()) });
  const dv = app.state().drillView;
  emit('drill-shown', {
    role: dv.roleBar.status,
    nodes: dv.dag.nodes.map((n) => n.nodeId),
    cards: dv.cards.map((c) => c.nodeId),
    firstCard: dv.cards[0]?.nodeId ?? null,
  });
  advance(100);

  // ③ 点排序第一的卡片 → 节点详情（detail-shown，四段）。
  app.openNodeDetail({ nodeId: 'T-003', data: makeDetailData() });
  const detail = app.state().detail.view.detail;
  emit('detail-shown', {
    sections: detail.sections.length,
    sectionKeys: detail.sections.map((s) => s.key),
    summaryLine: detail.sections.find((s) => s.key === 'summary')?.lines[0] ?? null,
  });
  advance(100);

  // ④ 展开证据段（evidence-shown，至少 1 行可解析）。
  detail.copyEvidence(1);
  const evidenceLines = detail.sections.find((s) => s.key === 'evidence')?.lines ?? [];
  emit('evidence-shown', {
    rows: evidenceLines.length,
    lines: evidenceLines,
    resolvable: evidenceLines.filter((l) => l.includes('可解析')).length,
    missing: evidenceLines.filter((l) => l.includes('缺失')).length,
    physical: {
      calcExists: fs.existsSync(path.join(tempRoot, 'artifacts', 'code', 'calc.js')),
      logExists: fs.existsSync(path.join(tempRoot, 'logs', 'T-003.log')),
      defectExists: fs.existsSync(path.join(tempRoot, 'defects', 'd1.md')),
    },
  });
  advance(100);

  // ⑤ 点局部 DAG 上的升级节点 → 升级面板（escalation-shown，1 条）。
  app.openEscalationPanel({ instanceId: 'INST-001', data: makeEscalationData() });
  const ep = app.state().escalationPanel.view.escalations;
  emit('escalation-shown', {
    count: ep.items.length,
    reasonLine: ep.items[0]?.reasonLine ?? null,
    defectLines: ep.items[0]?.defectLines ?? [],
  });
  advance(100);

  // ⑥ 点「继续」并确认（注入时钟记 t_confirm；核心裁决返回后记 t_continued）。
  const tConfirm = clock();
  // 回到节点详情所在的下钻上下文后再继续（真实点击路径：面板 → 继续）。
  const continueResult = await app.continueEscalation({ instanceId: 'INST-001', escalationId: 'ESC-001' });
  advance(900);
  const tContinued = clock();
  emit('continued', {
    escalationId: 'ESC-001',
    ok: continueResult.ok,
    notice: app.state().escalationNotice?.text ?? null,
    instanceState: status.state,
    nodeState: 'running',
    nodeWord: word('DESKTOP_BOARD_COLUMN_RUNNING'),
  });

  // ⑦ 关闭升级面板回到角色下钻、再点「返回流程图」（graph-returned）。
  app.backToGraph();
  emit('graph-returned', { view: app.state().view, subflowStack: app.state().subflowStack.length });
  advance(100);

  // ⑧ 点 S-001 折叠组进入子工作流（subflow-shown，3 个角色）。
  // 按 AC-36 的层级栈口径：先在顶层（acceptance-flow）取 levels，再下钻 publish-child。
  const subPayload = { ref: 'publish-child', workflowDef: WORKFLOW_DEFS, instanceId: 'INST-001', levels: [] };
  const top = buildSubflow(
    { ref: 'acceptance-flow', workflowDef: WORKFLOW_DEFS, instanceId: 'INST-001' },
    { ...UI_LABEL_KEYS },
    { levels: [] },
  );
  const subflow = buildSubflow(subPayload, { ...UI_LABEL_KEYS }, { levels: top.levels });
  app.openSubflow({ data: subPayload });
  emit('subflow-shown', {
    view: app.state().view,
    roles: subflow.nodes.length,
    breadcrumb: subflow.breadcrumb,
  });
  advance(100);

  // ⑨ 点面包屑第一层回到角色流程图（graph-restored）。
  app.backSubflow();
  emit('graph-restored', { view: app.state().view, subflowStack: app.state().subflowStack.length });

  snap.escalationPanel = ep;
  return { probes, snap, timing: { tConfirm, tContinued }, tempRoot, app };
}

// 九步序列只跑一次（单场景），七条 Then 逐条从同一次结果断言。
const run = await runNineSteps();

test('AC-29 · Then 1：流程图上同时有红色角标异常角色与红色（rejected）连接线', async () => {
  const { probes } = await run;
  const p = probes.find((e) => e.event === 'graph-shown');
  assert.ok(p, 'graph-shown 探针缺失');
  assert.deepEqual(p.abnormalRoles, ['T-003'], '异常角色角标必须落在 T-003');
  assert.deepEqual(p.rejectedEdges, ['E-02'], '被拒绝的红色连接线必须是 E-02');
  assert.ok(p.abnormalRoles.length > 0 && p.rejectedEdges.length > 0, '异常角标与红色连接线必须同时可见');
});

test('AC-29 · Then 2：下钻状态栏「不可用」、局部 DAG 标出 T-003、卡片首张为 T-003', async () => {
  const { probes } = await run;
  const p = probes.find((e) => e.event === 'drill-shown');
  assert.ok(p, 'drill-shown 探针缺失');
  assert.equal(p.role, statusWord('unavailable'), '状态必须是「不可用」');
  assert.ok(p.nodes.includes('T-003'), '局部 DAG 必须标出 T-003');
  assert.equal(p.firstCard, 'T-003', '卡片列表首张必须是 T-003（已升级）');
  assert.equal(p.cards[0], 'T-003');
});

test('AC-29 · Then 3：详情四段齐全；证据段 ≥1 条可解析、缺失项判缺失；摘要退出码 1', async () => {
  const { probes } = await run;
  const d = probes.find((e) => e.event === 'detail-shown');
  const e = probes.find((e) => e.event === 'evidence-shown');
  assert.ok(d && e, 'detail-shown / evidence-shown 探针缺失');
  assert.equal(d.sections, 4, '节点详情必须四段齐全');
  assert.deepEqual(d.sectionKeys, ['timeline', 'summary', 'evidence', 'handoff']);
  assert.match(d.summaryLine, /退出码 1/, '摘要行必须含「退出码 1」');
  assert.ok(e.rows >= 1, '证据段至少 1 条');
  assert.ok(e.lines.some((l) => l.includes('可解析')), '证据段必须含「可解析」');
  assert.ok(e.lines.some((l) => l.includes('缺失')), 'defects/d1.md 必须判「缺失」');
  assert.equal(e.physical.calcExists, true);
  assert.equal(e.physical.logExists, true);
  assert.equal(e.physical.defectExists, false);
});

test('AC-29 · Then 4：升级面板列出 ESC-001，原因/缺陷两行逐字等于 A-6', async () => {
  const { probes, snap } = await run;
  const p = probes.find((e) => e.event === 'escalation-shown');
  assert.ok(p, 'escalation-shown 探针缺失');
  assert.equal(p.count, 1, '升级面板恰 1 条');
  assert.equal(snap.escalationPanel.items[0].escalationId, 'ESC-001');
  assert.equal(p.reasonLine, word('DRILL_ESC_REASON', { reason: '测试第 2 轮失败' }));
  assert.deepEqual(p.defectLines, [word('DRILL_ESC_DEFECT', { summary: '断言失败', evidence: 'defects/d1.md' })]);
});

test('AC-29 · Then 5：点继续后实例转运行中、T-003 转执行中、提示「已继续 · ESC-001」；无需手动刷新即变', async () => {
  const { probes, timing } = await run;
  const p = probes.find((e) => e.event === 'continued');
  assert.ok(p, 'continued 探针缺失');
  assert.equal(p.ok, true);
  assert.equal(p.instanceState, 'running', '实例状态必须由 suspended 变 running');
  assert.equal(p.nodeWord, '执行中', 'T-003 必须显示「执行中」');
  assert.equal(p.notice, word('DRILL_ESC_DONE', { id: 'ESC-001' }), '提示必须逐字为「已继续 · ESC-001」');
  // 内部断言：注入时钟下的到达阈值（裁决 H 第 5 条 / F4-14，不冒充用户可见结论）。
  assert.ok(
    timing.tContinued - timing.tConfirm <= 2000,
    `内部断言失败：t_continued - t_confirm = ${timing.tContinued - timing.tConfirm}ms > 2000ms`,
  );
});

test('AC-29 · Then 6：九步探针序列顺序固定，且没有任何终端 / CLI 事件', async () => {
  const { probes } = await run;
  assert.deepEqual(probes.map((p) => p.event), PROBE_ORDER, '九步探针序列与顺序锚点不一致');
  const terminalEvents = probes.filter((p) => TERMINAL_EVENT.test(p.event));
  assert.deepEqual(terminalEvents, [], `探针集合出现终端/CLI 事件：${terminalEvents.map((p) => p.event).join(', ')}`);
  // 所有探针都由界面装配状态派生，不含任何 spawn / exec 载荷字段。
  for (const p of probes) {
    assert.equal(Object.hasOwn(p, 'spawn'), false, `${p.event} 不得携带 spawn 载荷`);
    assert.equal(Object.hasOwn(p, 'exec'), false, `${p.event} 不得携带 exec 载荷`);
  }
});

test('AC-29 · Then 7：S-001 点击进入子工作流（3 个角色可见），面包屑第一层回到角色流程图', async () => {
  const { probes } = await run;
  const sub = probes.find((e) => e.event === 'subflow-shown');
  const back = probes.find((e) => e.event === 'graph-restored');
  assert.ok(sub && back, 'subflow-shown / graph-restored 探针缺失');
  assert.equal(sub.view, 'subflow');
  assert.equal(sub.roles, 3, 'S-001 内部必须 3 个角色可见');
  assert.deepEqual(sub.breadcrumb, ['实例 INST-001', '子工作流 发布子流程']);
  assert.equal(back.view, 'graph', '面包屑第一层必须回到角色流程图');
  assert.equal(back.subflowStack, 0, '返回后层级栈必须清空');
});

test('AC-29 · 架构检查：desktop/ui/drill 不得有测试专用渲染分支（NODE_ENV === test 零命中）', async () => {
  const drillDir = path.join(REPO, 'desktop', 'ui', 'drill');
  const hits = [];
  for (const file of fs.readdirSync(drillDir).filter((f) => f.endsWith('.js'))) {
    fs.readFileSync(path.join(drillDir, file), 'utf8').split('\n').forEach((line, i) => {
      if (/NODE_ENV\s*===\s*['"]test['"]/.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(hits, [], `drill 层出现测试专用分支：${hits.join(', ')}`);
  const { tempRoot } = await run;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});
