/**
 * WP-3 contract tests for sub-workflow drilldown
 * (AC-17 / AC-18 / AC-36). Pure module surface only; layout comes from the
 * existing pure graph layout module.
 *
 * Run: NODE_ENV=test node --test test/wp14/subworkflow-drill.test.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { computeLayout } from '../../desktop/ui/graph/layout.js';
import { buildSubflow } from '../../desktop/ui/drill/subflow.js';

const labels = { ...UI_LABEL_KEYS };

const defs = {
  'release-flow': {
    title: '发布主流程',
    nodes: [{ id: 'S-001', node_type: 'subworkflow', role: 'dev' }],
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
  'child-x': { title: 'child-x', nodes: [{ id: 'X-1', node_type: 'role' }], edges: [] },
  'leaf-y': { title: 'leaf-y', nodes: [{ id: 'Y-1', node_type: 'role' }], edges: [] },
  'empty-flow': { title: 'empty-flow', nodes: [], edges: [] },
};

function level(ref, levels) {
  return buildSubflow(
    { ref, workflowDef: defs, instanceId: 'INST-001' },
    labels,
    { levels },
  );
}

test('AC-17 three-level breadcrumbs and reused computeLayout coordinates', () => {
  const top = level('release-flow', []);
  const child = level('publish-child', top.levels);
  const grand = level('child-x', child.levels);
  assert.deepEqual(top.breadcrumb, ['实例 INST-001']);
  assert.deepEqual(child.breadcrumb, ['实例 INST-001', '子工作流 发布子流程']);
  assert.deepEqual(grand.breadcrumb, [
    '实例 INST-001', '子工作流 发布子流程', '子工作流 child-x',
  ]);
  assert.equal(child.nodes.length, 3);
  assert.equal(child.edges.length, 1);
  assert.equal(grand.nodes.length, 1);
  assert.deepEqual(child.legend, [
    '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与',
    '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流',
  ]);

  const expected = computeLayout({
    nodes: child.nodes.map((n) => ({ id: n.nodeId })),
    edges: child.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, direction: e.direction })),
  });
  assert.deepEqual(
    child.nodes.map((n) => [n.x, n.y, n.layer, n.z]),
    expected.nodes.map((n) => [n.x, n.y, n.layer, n.z]),
  );
  const back = grand.back();
  assert.deepEqual(back.breadcrumb, ['实例 INST-001', '子工作流 发布子流程']);
});

test('AC-18 three degradations: unreadable ref, cycle, empty', () => {
  const missing = level('child-y', []);
  assert.equal(missing.degraded.kind, 'missing');
  assert.equal(missing.degraded.text, '子工作流 child-y · 角色数未知');
  assert.equal(missing.nodes.length, 0);

  const cyc = level('child-a', [
    { ref: 'child-b', title: 'child-b' },
    { ref: 'child-a', title: 'child-a' },
  ]);
  assert.equal(cyc.degraded.kind, 'cycle');
  assert.equal(cyc.degraded.text, '子工作流定义存在循环 · 已停止下钻');
  assert.equal(cyc.depth, 2); // stack did not grow on the cycle

  const empty = level('empty-flow', []);
  assert.equal(empty.degraded.kind, 'empty');
  assert.equal(empty.degraded.text, '角色 无');
  assert.equal(empty.nodes.length, 0);
});

test('AC-36 four breadcrumb levels 1/2/3/4 and three single-step returns', () => {
  const one = level('release-flow', []);
  const two = level('publish-child', one.levels);
  const three = level('child-x', two.levels);
  const four = level('leaf-y', three.levels);
  assert.deepEqual([one, two, three, four].map((v) => v.breadcrumb.length), [1, 2, 3, 4]);
  assert.deepEqual(four.breadcrumb, [
    '实例 INST-001',
    '子工作流 发布子流程',
    '子工作流 child-x',
    '子工作流 leaf-y',
  ]);
  assert.equal(four.returnCount, 3);

  const sequence = [];
  let current = four;
  for (let i = 0; i < 3; i += 1) {
    current = current.back();
    sequence.push(current.ref);
  }
  assert.deepEqual(sequence, ['child-x', 'publish-child', 'release-flow']);
  assert.deepEqual(current.breadcrumb, ['实例 INST-001']);

  const iterative = [];
  let levels = [];
  for (const ref of ['release-flow', 'publish-child', 'child-x', 'leaf-y']) {
    const view = level(ref, levels);
    iterative.push(view.breadcrumb.length);
    levels = view.levels;
  }
  assert.deepEqual(iterative, [1, 2, 3, 4]);
});
