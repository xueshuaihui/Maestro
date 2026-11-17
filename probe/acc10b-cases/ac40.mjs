// AC-40 · 角色 ID 对不上注册表仍画出并按角色节点显示（拓扑矩阵）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-40', {
  testFile: 'drill-dag.test.js',
  arch: [
    { label: '不按注册表存在性过滤节点（filter(.*registry|hasRole( 零命中）', pattern: 'filter\\(.*registry|hasRole\\(', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "assert.equal(node.type, 'role')",
    "result.lines.includes('局部节点 T-032 · 上游 · 角色 · 执行中')",
    "view.cards.some((c) => c.nodeId === 'T-032')",
    'view.cards.length, view.dag.nodes.length',
    "roleId: 'ghost-role'",
  ],
  notes: [
    'Then 逐字锚点（requirement.md:875）：T-032（roleId=ghost-role、执行中、直接上游）仍在 DAG 与卡片，类型显示「角色」不显示未知/空，编号与状态照常，卡片总数与节点集合一一对应。',
    '拓扑矩阵口径：ghost-role 不在注册表仍保留节点；架构零命中证明不按注册表过滤。',
  ],
})];
