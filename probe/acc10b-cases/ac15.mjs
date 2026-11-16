// AC-15 · 交接包历史入/出双向、按最近活动倒序，方向由定义边 kind 决定
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-15', {
  testFile: 'node-detail.test.js',
  arch: [
    { label: '方向读定义边 kind（backflow 命中）', pattern: 'backflow', target: 'desktop/ui/drill/node-detail.js', expect: 'min1' },
    { label: '方向不由交接状态推断', pattern: "state === 'rejected'|state === 'expired'", target: 'desktop/ui/drill/node-detail.js', expect: 'zero' },
  ],
  literals: [
    '交接 HO-007 · 回流 · 第 2 轮 · 已完成 · 09:20:00',
    '交接 HO-006 · 正向 · 第 1 轮 · 已拒绝 · 09:14:00',
    "direction: 'backflow'", "direction: 'forward'",
    "second[0].includes('回流')", "second[1].includes('正向')",
  ],
  notes: [
    'Then 逐字：三行按 HO-007 / HO-006 / HO-004 倒序（机检夹具以 HO-007/HO-006 双向两行覆盖逐字），方向词只「正向/回流」；语义断言把两条交接包状态互换后方向词不变，证明方向只跟定义边 kind 走、与交接包状态无关。',
    '架构：backflow 命中定义边方向读取（>=1，不绑定条数）；「state === rejected/expired」零命中。',
  ],
})];
