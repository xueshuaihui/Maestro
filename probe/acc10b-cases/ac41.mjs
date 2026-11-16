// AC-41 · 卡片缺值显示 — + 来源置换证明不自造字面量（语义断言，不设 grep）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-41', {
  testFile: 'drill-cards.test.js',
  arch: [], // 语义断言，不设 grep 锚点（评审 F4-12）
  literals: [
    "assert.equal(t033.lines[0], '卡片 T-033 · — · 轮次 1/1 · 待执行')",
    "assert.equal(t034.lines[1], '执行 — · 执行中 · 已运行 3m · 工具 —')",
    '!/undefined|null/.test(line)',
    "assert.equal(swapped[0].lines[0], '卡片 T-033 · TBD · 轮次 1/1 · 待执行')",
    "title: 'TBD'",
  ],
  notes: [
    'Then 逐字锚点（requirement.md:886）：T-033 标题行「卡片 T-033 · — · 轮次 1/1 · 待执行」；T-034 执行行「执行 — · 执行中 · 已运行 3m · 工具 —」；两行不含空串/undefined/null。',
    '语义断言（F4-12）：来源置换——把投影标题改为 TBD，卡片原样显示 TBD，证明卡片只渲染投影值、不自造 —/undefined/null；本 AC 不设 grep 锚点。',
  ],
})];
