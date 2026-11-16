// AC-17 · 子工作流逐层下钻与逐级返回（三层面包屑 / 复用 computeLayout 坐标逐字节相等 / 图例两行同 A-8）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-17', {
  testFile: 'subworkflow-drill.test.js',
  arch: [
    { label: '子图复用既有布局模块 graph/layout（引用存在，不绑定条数）', pattern: 'graph/layout', target: 'desktop/ui/drill/subflow.js', expect: 'min1' },
    { label: 'drill 不自建第二套 computeLayout', pattern: 'function computeLayout|const computeLayout', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "import { computeLayout } from '../../desktop/ui/graph/layout.js'",
    "assert.deepEqual(child.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])",
    "assert.deepEqual(grand.breadcrumb, [",
    "'子工作流 child-x',",
    'assert.equal(child.nodes.length, 3)',
    'assert.equal(child.edges.length, 1)',
    'assert.equal(grand.nodes.length, 1)',
    '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与',
    '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流',
    'const expected = computeLayout({',
    'child.nodes.map((n) => [n.x, n.y, n.layer, n.z])',
    'expected.nodes.map((n) => [n.x, n.y, n.layer, n.z])',
    "assert.deepEqual(back.breadcrumb, ['实例 INST-001', '子工作流 发布子流程'])",
  ],
  notes: [
    'Then 逐字：三层面包屑 实例 INST-001 / 子工作流 发布子流程 / 子工作流 child-x；第一层 3 节点 1 内部边、第二层 1 节点；图例两行逐字同 A-8；返回后上一层视图状态保持。',
    '复用性语义断言：把第一层子图节点/边单独喂给 desktop/ui/graph/layout.js 的 computeLayout，断言 child.nodes 的 [x,y,layer,z] 与该次输出逐字节相等（等价实现/再导出同样通过，不数 import 次数）。',
  ],
})];
