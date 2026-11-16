// AC-10 · 特殊节点卡片与未知类型/未知状态兜底（A-3 五行逐字）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-10', {
  testFile: 'drill-cards.test.js',
  arch: [
    { label: 'drill 不按标题猜类型', pattern: '人工验收|人工裁决|发布子流程', target: 'desktop/ui/', expect: 'zero' },
  ],
  literals: [
    '卡片 人工节点 H-001 · 人工验收 · 轮次 0/1 · 待执行',
    '卡片 升级节点 X-001 · 人工裁决 · 轮次 2/2 · 已升级',
    '卡片 子工作流：发布子流程 · 角色 3 · 轮次 1/1 · 待执行',
    '卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行',
    '卡片 Z-001 · 未知任务 · 轮次 1/1 · 状态未知',
    "z.tier, 'blocked'",
    "z.boardColumn, 'blocked'",
    'assert.equal(result.length, 5)',
  ],
  notes: [
    'Then 逐字：A-3 五行特殊/异常逐字；U-001 按角色节点显示无类型前缀并保留编号；mystery 节点落「被阻塞」档、标题末尾「状态未知」且看板同归 blocked；卡片总数 5，无丢失无异常。',
    '架构：类型只从定义层 node_type 读（裁决 D）；drill 对具体标题零命中。',
  ],
})];
