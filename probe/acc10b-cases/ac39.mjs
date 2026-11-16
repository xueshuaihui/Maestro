// AC-39 · 端点节点无运行时状态按「待执行」+ 来源置换证明卡片不自造兜底（语义断言，不设 grep）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-39', {
  testFile: 'drill-dag.test.js',
  arch: [], // 语义断言，不设 grep 锚点（评审 F4-12）；缺省兜底只在投影层一次
  literals: [
    "assert.equal(pending.nodes[0].status, '待执行')",
    "pending.lines.includes('局部节点 T-031 · 下游 · 角色 · 待执行')",
    "blocked.lines.includes('局部节点 T-031 · 下游 · 角色 · 被阻塞')",
    "viewPending.cards[0].displayStatus, '待执行'",
    "viewBlocked.cards[0].displayStatus, '被阻塞'",
    "nodeId: 'T-031'",
  ],
  notes: [
    'Then 逐字锚点：T-031 同时在 DAG 与卡片出现、状态词「待执行」、色为待执行色；不隐藏、不显示「状态未知」。',
    '语义断言（F4-12）：来源置换——把投影输出由 pending 改为 blocked（仅测试内注入），DAG 与卡片同步变「被阻塞」，证明卡片只渲染投影结果、不自造兜底；本 AC 不设 grep 锚点。',
  ],
})];
