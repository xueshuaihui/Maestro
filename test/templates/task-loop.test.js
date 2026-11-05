/**
 * WP-1 contract tests: the `task-loop` graph data and the four new prompt templates
 * (requirement D-4 / D-8), plus the byte-for-byte regression of the I1.1 / I1.2
 * prompts (`single` / `forward` / `backflow` / `retest`).
 *
 * Prompt wording is asserted verbatim so a later edit cannot silently reword what the
 * host model receives (the fixtures parse `写入路径：` / `工作区：` out of it).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_GRAPH,
  DEFAULT_REVISION_REQUIREMENT,
  GRAPHS,
  PROMPT_TEMPLATES,
  REVIEW_REQUIREMENT,
  ROLES,
  VERDICT_REQUIREMENT,
  defaultGraph,
  getGraph,
  initialNodes,
  promptFor
} from '../../src/templates/index.js';

const TASK = '写一篇发布说明';
const WORKSPACE = 'D:/tmp/inst/workspace';
const RESEARCH_REF = 'artifacts/reports/research-notes.v1.md';

const graph = getGraph('task-loop');
const node = (id) => graph.nodes.find((item) => item.id === id);

test('task-loop 图：入口 / 终节点 / 轮次上限 / 文档策略', () => {
  assert.equal(graph.id, 'task-loop');
  assert.equal(graph.showTemplate, true);
  assert.equal(graph.entry, 'T-001');
  assert.equal(graph.terminal, 'T-003');
  assert.deepEqual([...graph.terminals], ['T-003']);
  assert.deepEqual({ ...graph.maxRounds }, { 'T-001': 1, 'T-002': 2, 'T-003': 2 });
  assert.equal(graph.productPolicy, 'doc-single');
  assert.equal(getGraph('task-loop'), graph);
  assert.equal(getGraph('task-loop-typo'), null);
});

test('task-loop 图：三节点顺序、角色、产物策略与门控', () => {
  assert.deepEqual(
    graph.nodes.map((item) => item.id),
    ['T-001', 'T-002', 'T-003']
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.order),
    [1, 2, 3]
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.roleId),
    ['researcher', 'writer', 'reviewer']
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.title),
    ['研究员', '撰写者', '审核者']
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.prompt),
    ['research', 'write', 'review']
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.artifactPolicy),
    ['fixed-workspace', 'versioned-doc', 'review']
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.downstreamGate),
    [true, true, false]
  );
  assert.deepEqual(
    graph.nodes.map((item) => item.judge),
    ['none', 'none', 'review']
  );

  // nodeId mirrors id so the engine never translates a D-6 field.
  for (const item of graph.nodes) assert.equal(item.nodeId, item.id);

  assert.deepEqual([...node('T-001').products], [RESEARCH_REF]);
  assert.equal(node('T-001').artifactDir, 'artifacts/reports');
  assert.equal(node('T-002').artifactDir, 'artifacts/docs');
  assert.equal(node('T-002').artifactExt, '.md');
  assert.equal(node('T-003').reviewPath, 'out/review.json');
  assert.deepEqual([...node('T-002').products], []);
  assert.deepEqual([...node('T-003').products], []);
});

test('task-loop 图：四条边，不新增 kind', () => {
  assert.equal(graph.edges.length, 4);
  assert.deepEqual(
    graph.edges.map((edge) => `${edge.from}->${edge.to}:${edge.kind}`),
    ['T-001->T-002:forward', 'T-002->T-003:forward', 'T-003->T-002:backflow', 'T-002->T-003:retest']
  );
  const backflow = graph.edges.find((edge) => edge.kind === 'backflow');
  assert.equal(backflow.condition, 'review-reject');
  assert.equal(backflow.requiresHandoff, true);
  const retest = graph.edges.find((edge) => edge.kind === 'retest');
  assert.equal(retest.condition, 'reopen-failed-target');
});

test('三角色：可派发且指向各自的提示词键', () => {
  for (const [roleId, promptKey] of [
    ['researcher', 'research'],
    ['writer', 'write'],
    ['reviewer', 'review']
  ]) {
    const role = ROLES[roleId];
    assert.equal(role.roleId, roleId);
    assert.equal(role.labelKey, roleId);
    assert.equal(role.dispatchable, true);
    assert.equal(role.prompt, promptKey);
    assert.ok(role.mustDeliver.length >= 1);
  }
  // I1.1 / I1.2 roles untouched.
  assert.equal(ROLES.developer.prompt, 'forward');
  assert.equal(ROLES.tester.prompt, 'verify');
  assert.equal(ROLES.coordinator.dispatchable, false);
});

test('initialNodes：task-loop 三节点初始为 pending/round 0', () => {
  const nodes = initialNodes(graph, { stateAt: '2026-11-06T02:00:00.000Z' });
  assert.deepEqual(
    nodes.map((item) => `${item.nodeId}:${item.state}:${item.round}`),
    ['T-001:pending:0', 'T-002:pending:0', 'T-003:pending:0']
  );
  for (const item of nodes) {
    assert.equal(item.stateSince, '2026-11-06T02:00:00.000Z');
    assert.deepEqual(item.artifactRefs, []);
  }
});

test('研究提示词逐字（D-8 研究段）', () => {
  const text = promptFor({
    node: node('T-001'),
    task: TASK,
    writePath: `${WORKSPACE}/${RESEARCH_REF}`
  });
  assert.equal(
    text,
    `${TASK}\n\n研究笔记：${RESEARCH_REF}\n写入路径：${WORKSPACE}/${RESEARCH_REF}\n只交研究笔记，不写最终文档。`
  );
});

test('撰写第 1 轮提示词逐字（D-8 撰写段）', () => {
  const text = promptFor({
    node: node('T-002'),
    task: TASK,
    researchRef: RESEARCH_REF,
    docRef: 'artifacts/docs/release-notes.v1.md',
    writePath: `${WORKSPACE}/artifacts/docs/release-notes.v1.md`,
    round: 1
  });
  assert.equal(
    text,
    `${TASK}\n\n研究笔记：${RESEARCH_REF}\n本轮文档引用：artifacts/docs/release-notes.v1.md\n` +
      `写入路径：${WORKSPACE}/artifacts/docs/release-notes.v1.md\n每一轮交完整文档，不要改写上一版。`
  );
});

test('撰写回流提示词逐字（D-8 撰写第 2 轮）', () => {
  const text = promptFor({
    graph,
    handoff: { edge: { from: 'T-003', to: 'T-002', kind: 'backflow' } },
    task: TASK,
    defects: [
      { summary: '缺少「回滚方案」一节', evidence: 'artifacts/docs/release-notes.v1.md#L1' },
      { summary: '升级步骤没写旧数据迁移', evidence: 'artifacts/docs/release-notes.v1.md#L18' }
    ],
    revisionRequirement: '补写「回滚方案」一节',
    researchRef: RESEARCH_REF,
    previousRef: 'artifacts/docs/release-notes.v1.md',
    docRef: 'artifacts/docs/release-notes.v2.md',
    writePath: `${WORKSPACE}/artifacts/docs/release-notes.v2.md`,
    round: 2
  });
  assert.equal(
    text,
    `${TASK}\n\n上一轮审核不通过，请按下列缺陷修改：\n` +
      '缺陷 1：缺少「回滚方案」一节（证据 artifacts/docs/release-notes.v1.md#L1）\n' +
      '缺陷 2：升级步骤没写旧数据迁移（证据 artifacts/docs/release-notes.v1.md#L18）\n' +
      '修改要求：补写「回滚方案」一节\n' +
      `研究笔记：${RESEARCH_REF}\n` +
      '上一版文档引用：artifacts/docs/release-notes.v1.md\n' +
      '本轮文档引用：artifacts/docs/release-notes.v2.md\n' +
      `写入路径：${WORKSPACE}/artifacts/docs/release-notes.v2.md\n不得改写上一版文件。`
  );
});

test('回流提示词缺修改要求时回落默认句', () => {
  const text = promptFor({
    graph,
    handoff: { edge: { from: 'T-003', to: 'T-002', kind: 'backflow' } },
    task: TASK,
    defects: [{ summary: 'A', evidence: 'e#L1' }],
    round: 2
  });
  assert.ok(text.includes(`修改要求：${DEFAULT_REVISION_REQUIREMENT}\n`));
});

test('审核提示词逐字（D-8 审核段，含 schema 行与工作区）', () => {
  const docRef = 'artifacts/docs/release-notes.v2.md';
  const text = promptFor({
    node: node('T-003'),
    task: TASK,
    docRef,
    workspaceDir: WORKSPACE,
    round: 2
  });
  assert.equal(
    text,
    `${TASK}\n\n本轮文档引用：${docRef}\n工作区：${WORKSPACE}\n审核文件写入路径：out/review.json\n` +
      '只认审核文件：{"decision":"pass"|"reject","artifact":"' +
      docRef +
      '","defects":[{"summary":"一句话缺陷","evidence":"' +
      docRef +
      '#L1"}],"revisionRequirement":"..."}\n' +
      '判定为 reject 时至少一条缺陷；判定为 pass 时 defects 必须为空。\n不要修改文档。'
  );
  // 审核文件路径取自图节点，不在模板里另写一份常量。
  assert.equal(node('T-003').reviewPath, 'out/review.json');
});

test('schema 里的 JSON 花括号不被当成占位符吞掉', () => {
  assert.ok(REVIEW_REQUIREMENT.includes('{"decision":"pass"|"reject"'));
  assert.ok(!REVIEW_REQUIREMENT.includes('undefined'));
  const filled = promptFor({
    node: node('T-003'),
    task: TASK,
    docRef: 'artifacts/docs/x.v1.md',
    workspaceDir: WORKSPACE
  });
  assert.ok(filled.includes('"artifact":"artifacts/docs/x.v1.md"'));
  assert.ok(filled.includes('不要修改文档。'));
});

// --- I1.1 / I1.2 逐字回归 -----------------------------------------------------------

test('single 提示词逐字不变（I1.1）', () => {
  const text = promptFor({ graph: defaultGraph(), task: TASK });
  assert.equal(text, `${TASK}\n\n完成后直接结束，不需要额外说明。`);
  assert.equal(DEFAULT_GRAPH, 'single');
});

test('code-loop 的 forward / verify 提示词逐字不变（I1.2）', () => {
  const codeLoop = getGraph('code-loop');
  const forward = promptFor({
    graph: codeLoop,
    handoff: { edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
    task: TASK
  });
  assert.equal(forward, `${TASK}${VERDICT_REQUIREMENT}`);

  const backflow = promptFor({
    graph: codeLoop,
    handoff: { edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
    task: TASK,
    defects: [{ summary: 'division by zero', evidence: 'out/log.txt' }],
    retestRequirement: 'guard b === 0'
  });
  assert.equal(
    backflow,
    `${TASK}\n\n上一轮判定不通过，请按下列缺陷修正：\n` +
      '缺陷 1：division by zero（证据 out/log.txt）\n复测要求：guard b === 0'
  );
  // 编码闭环的回流文案是「复测要求」，不是「修改要求」。
  assert.equal(backflow.includes('修改要求'), false);

  const retest = promptFor({
    graph: codeLoop,
    handoff: { edge: { from: 'T-001', to: 'T-002', kind: 'retest' } },
    task: TASK,
    defectCount: 2,
    products: ['calc.js']
  });
  assert.equal(
    retest,
    `${TASK}\n\n上一轮缺陷：2 条\n产物：calc.js\n请复测并把结构化判定写到 out/verdict.json。`
  );
});

test('代码闭环未被注入新键：模板表只追加不修改', () => {
  assert.equal(PROMPT_TEMPLATES.single, '{task}\n\n完成后直接结束，不需要额外说明。');
  assert.equal(PROMPT_TEMPLATES.forward, '{task}');
  assert.equal(
    PROMPT_TEMPLATES.backflow,
    '{task}\n\n上一轮判定不通过，请按下列缺陷修正：\n{defectLines}\n复测要求：{retestRequirement}'
  );
  assert.equal(
    PROMPT_TEMPLATES.retest,
    '{task}\n\n上一轮缺陷：{defectCount} 条\n产物：{products}\n请复测并把结构化判定写到 out/verdict.json。'
  );
});

test('既有图对象不因新增 productPolicy 而变形', () => {
  assert.equal('productPolicy' in GRAPHS.single, false);
  assert.equal('productPolicy' in getGraph('code-loop'), false);
  assert.deepEqual(Object.keys(GRAPHS).sort(), ['code-loop', 'single', 'task-loop']);
});
