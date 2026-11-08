/**
 * WP-4 contract tests for the dry-run plan builder (split doc 2.4 row 4).
 * Pure in-memory only — no disk access (D-10).
 *
 * Fixture: the A-13 `doc-fanout` workflow, quoted verbatim from requirement
 * appendix A-1 / A-13. The YAML text is parsed in memory with `parseYaml`
 * (a pure function of its string argument — importing it keeps the fixture
 * byte-verbatim without any IO; `planWorkflow` itself never parses YAML, it
 * only consumes the parsed in-memory object).
 *
 * Covered here: the frozen 8-key shape (A-14 / §3.4), the D-5 layering and
 * stable sort keys, the parallel-group layer (AC-27), the three conditional
 * branches in A-10 order (AC-28), the `policies` row (AC-29), the two field
 * mappings with the verbatim first `from` (AC-30), byte-identical repeat
 * calls and the `task` no-slot rule (AC-41 root), the 11-primitive memory
 * face including backflow/retest layering exclusion (AC-63), and the exact
 * feed into WP-5's `renderWorkflowDryRun` reproducing the A-10 text block
 * verbatim.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseYaml } from '../../src/registry/yaml-lite.js';
import { planWorkflow } from '../../src/registry/workflow-plan.js';
import { renderWorkflowDryRun } from '../../src/cli/render.js';

/** Appendix A-1 / A-13 `doc-fanout` full text, verbatim. */
const DOC_FANOUT_YAML = `
schema: workflow/v1
id: doc-fanout
name: 文档并行版
summary: 研究后两人并行撰写，汇总后人工确认
entry: T-001
terminal: T-006
nodes:
  - id: T-001
    node_type: role
    role: researcher
    title: 研究
    timeout: 600
    retry: 2
    outputs: [research.notes]
  - id: T-002
    node_type: role
    role: writer
    title: 撰写A
    parallel_scope: draft
    scope: draft-a
    inputs: [brief]
  - id: T-003
    node_type: role
    role: editor
    title: 撰写B
    parallel_scope: draft
    scope: draft-b
    inputs: [brief]
  - id: T-004
    node_type: human
    title: 人工确认
  - id: T-005
    node_type: escalate
    title: 升级
  - id: T-006
    node_type: subworkflow
    workflow: code-loop
    title: 代码闭环
edges:
  - from: T-001
    to: T-002
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-001
    to: T-003
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-002
    to: T-004
  - from: T-003
    to: T-004
  - from: T-004
    to: T-006
    when: human_approved
  - from: T-004
    to: T-005
    when: human_rejected
  - from: T-006
    to: T-005
    when: failed
`;

function docFanout() {
  const parsed = parseYaml(DOC_FANOUT_YAML);
  assert.equal(parsed.ok, true, 'the verbatim A-13 fixture must parse');
  return parsed.value;
}

/** §3.4 sample, the single source of truth for the four plan segments. */
const SAMPLE_LAYERS = [
  { parallel: false, nodes: ['T-001'] },
  { parallel: true, nodes: ['T-002', 'T-003'] },
  { parallel: false, nodes: ['T-004'] },
  { parallel: false, nodes: ['T-006'] },
  { parallel: false, nodes: ['T-005'] },
];
const SAMPLE_BRANCHES = [
  { from: 'T-004', to: 'T-006', when: 'human_approved' },
  { from: 'T-004', to: 'T-005', when: 'human_rejected' },
  { from: 'T-006', to: 'T-005', when: 'failed' },
];
const SAMPLE_MAPPINGS = [
  { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-002' },
  { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-003' },
];
const SAMPLE_POLICIES = [{ nodeId: 'T-001', timeout: 600, retry: 2 }];

test('plan shape: exactly the frozen 8 top-level keys on the A-13 fixture', () => {
  const plan = planWorkflow({ workflow: docFanout(), task: '预演任务' });
  assert.deepEqual(Object.keys(plan), [
    'id',
    'name',
    'nodeCount',
    'edgeCount',
    'layers',
    'branches',
    'mappings',
    'policies',
  ]);
  assert.equal(plan.id, 'doc-fanout');
  assert.equal(plan.name, '文档并行版');
  assert.equal(plan.nodeCount, 6);
  assert.equal(plan.edgeCount, 7);
  assert.equal('warnings' in plan, false, 'A-14: no warnings key is ever emitted');
});

test('AC-27: the parallel group occupies one layer, one record (§3.4 sample)', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  assert.deepEqual(plan.layers, SAMPLE_LAYERS);
  const layersWithT002 = plan.layers.filter((layer) => layer.nodes.includes('T-002'));
  assert.equal(layersWithT002.length, 1, 'T-002 appears in exactly one layer record');
  assert.equal(plan.layers[1].parallel, true);
  assert.deepEqual(plan.layers[1].nodes, ['T-002', 'T-003']);
  for (const layer of plan.layers) {
    assert.deepEqual(Object.keys(layer), ['parallel', 'nodes'], 'layers[] is exactly 2 keys');
  }
});

test('AC-28: three conditional branches, {from,to,when} 3 keys, A-10 order', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  assert.equal(plan.branches.length, 3);
  assert.deepEqual(plan.branches, SAMPLE_BRANCHES);
  assert.deepEqual(
    plan.branches.map((branch) => branch.when),
    ['human_approved', 'human_rejected', 'failed'],
  );
  for (const branch of plan.branches) {
    assert.deepEqual(Object.keys(branch), ['from', 'to', 'when']);
  }
});

test('AC-30: two field mappings, 3 keys, first `from` verbatim (§3.4 sample)', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  assert.equal(plan.mappings.length, 2);
  assert.equal(plan.mappings[0].from, 'T-001.research.notes');
  assert.deepEqual(plan.mappings, SAMPLE_MAPPINGS);
  for (const mapping of plan.mappings) {
    assert.deepEqual(Object.keys(mapping), ['from', 'to', 'edge']);
  }
});

test('AC-29: policies carry the timeout/retry node as {nodeId,timeout,retry}', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  assert.deepEqual(plan.policies, SAMPLE_POLICIES);
  for (const policy of plan.policies) {
    assert.deepEqual(Object.keys(policy), ['nodeId', 'timeout', 'retry']);
  }
});

test('AC-41 root: two calls on the same input are byte-identical; task has no slot', () => {
  const workflow = docFanout();
  const first = JSON.stringify(planWorkflow({ workflow, task: '第一次' }));
  const second = JSON.stringify(planWorkflow({ workflow, task: '第二次' }));
  const withoutTask = JSON.stringify(planWorkflow({ workflow }));
  assert.equal(first, second, 'same input must serialize byte-for-byte identically');
  assert.equal(first, withoutTask, 'the 8-key shape (A-14) has no slot for `task`');
});

test('AC-63: the 11-primitive memory face on the doc-fanout plan', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  const layerOfNode = (id) => plan.layers.findIndex((layer) => layer.nodes.includes(id));
  // 顺序: layers chain T-001 → T-004 → T-006 → T-005
  assert.ok(layerOfNode('T-001') < layerOfNode('T-004'));
  assert.ok(layerOfNode('T-004') < layerOfNode('T-006'));
  assert.ok(layerOfNode('T-006') < layerOfNode('T-005'));
  // 并行 fan-out/fan-in: one parallel record (1 个并行组 in the A-10 header)
  assert.equal(plan.layers.filter((layer) => layer.parallel === true).length, 1);
  // 条件分支: three rows
  assert.equal(plan.branches.length, 3);
  // 超时 / 重试: the policies row
  assert.deepEqual(plan.policies, SAMPLE_POLICIES);
  // 人工 / 升级 / 终止: T-004 and the escalate T-005 each hold a plain layer
  assert.deepEqual(plan.layers[layerOfNode('T-004')].nodes, ['T-004']);
  assert.deepEqual(plan.layers[layerOfNode('T-005')].nodes, ['T-005']);
  assert.equal(layerOfNode('T-005'), plan.layers.length - 1);
  // 子工作流: T-006 is planned as a plain layer id; the `subNodeCount` of the
  // node description lives outside the plan (A-14 has no slot) and is passed
  // to the renderer by WP-8 together with `nodes`.
  assert.deepEqual(plan.layers[layerOfNode('T-006')].nodes, ['T-006']);
});

test('AC-63: backflow/retest edges are counted but never lift a layer (D-5 step 1)', () => {
  const loop = {
    schema: 'workflow/v1',
    id: 'plan-loop-fixture',
    name: 'plan loop fixture',
    entry: 'T-001',
    terminal: 'T-002',
    nodes: [
      { id: 'T-001', node_type: 'role', max_rounds: 2 },
      { id: 'T-002', node_type: 'role' },
    ],
    edges: [
      { from: 'T-001', to: 'T-002' },
      { from: 'T-002', to: 'T-001', kind: 'backflow', when: 'failed' },
      { from: 'T-001', to: 'T-002', kind: 'retest' },
    ],
  };
  const plan = planWorkflow({ workflow: loop });
  assert.equal(plan.edgeCount, 3, 'back edges are counted in edgeCount');
  assert.deepEqual(
    plan.layers.map((layer) => layer.nodes),
    [['T-001'], ['T-002']],
    'the backflow edge must not lift T-001 out of layer 0',
  );
  // 回边「只标注」: with a `when` set, a backflow edge still lands in branches.
  assert.deepEqual(plan.branches, [{ from: 'T-002', to: 'T-001', when: 'failed' }]);
  // max_rounds / retest produce no policies (no timeout/retry fields).
  assert.deepEqual(plan.policies, []);
});

test('layers align with the renderer `joins` index contract (WP-8 wiring)', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  const nodes = camelNodesForRender(docFanout());
  const linesAny = renderWorkflowDryRun({ plan, nodes, joins: ['all', 'any'] });
  assert.match(linesAny[2], / · 汇合：any$/, 'joins[1] targets the parallel record');
  const linesDefault = renderWorkflowDryRun({ plan, nodes });
  assert.match(linesDefault[2], / · 汇合：all$/, 'a missing join defaults to all');
});

test('AC-27~30 text anchors: plan + renderer nodes/joins reproduce A-10 verbatim', () => {
  const plan = planWorkflow({ workflow: docFanout() });
  const lines = renderWorkflowDryRun({ plan, nodes: camelNodesForRender(docFanout()) });
  assert.deepEqual(lines, [
    '编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流',
    '1. T-001 研究（角色节点 researcher）',
    '2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all',
    '3. T-004 人工确认（人工节点）',
    '4. T-006 代码闭环（子工作流 code-loop · 2 节点）',
    '5. T-005 升级（升级节点）',
    '条件分支：',
    '- T-004 → T-006 当 人工通过',
    '- T-004 → T-005 当 人工驳回',
    '- T-006 → T-005 当 判定不通过',
    '字段映射：',
    '- T-001.research.notes → T-002.brief',
    '- T-001.research.notes → T-003.brief',
    '超时与重试：',
    '- T-001 超时 600s · 重试 2',
    '结论：编排可执行，未启动任何会话',
  ]);
});

/** What WP-8 passes to the renderer: camelCase nodes plus the sub node count. */
function camelNodesForRender(workflow) {
  return workflow.nodes.map((node) => ({
    id: node.id,
    title: node.title ?? null,
    nodeType: node.node_type,
    role: node.role ?? null,
    parallelScope: node.parallel_scope ?? null,
    workflow: node.workflow ?? null,
    subNodeCount: node.node_type === 'subworkflow' ? 2 : undefined,
  }));
}

test('contract-compat: empty and null workflows yield the 8-key empty plan', () => {
  for (const workflow of [undefined, null, {}]) {
    const plan = planWorkflow({ workflow });
    assert.deepEqual(Object.keys(plan), [
      'id',
      'name',
      'nodeCount',
      'edgeCount',
      'layers',
      'branches',
      'mappings',
      'policies',
    ]);
    assert.equal(plan.nodeCount, 0);
    assert.equal(plan.edgeCount, 0);
    assert.deepEqual(plan.layers, []);
    assert.deepEqual(plan.branches, []);
    assert.deepEqual(plan.mappings, []);
    assert.deepEqual(plan.policies, []);
  }
});

test('contract-compat: camelCase node keys feed the same plan (loader-side freedom)', () => {
  const snake = planWorkflow({ workflow: docFanout() });
  const camelSource = docFanout();
  camelSource.nodes = camelSource.nodes.map(({ parallel_scope, node_type, ...rest }) => ({
    ...rest,
    parallelScope: parallel_scope,
    nodeType: node_type,
  }));
  const camel = planWorkflow({ workflow: camelSource });
  assert.equal(JSON.stringify(camel), JSON.stringify(snake));
});
