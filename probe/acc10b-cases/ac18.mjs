// AC-18 · 子工作流三种降级：读不到 / 循环 / 空（提示逐字 + 循环 depth 不增长 + 空图角色 无）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-18', {
  testFile: 'subworkflow-drill.test.js',
  arch: [
    { label: '循环检测基于已访问 ref 集合，不用 while(true)', pattern: 'while \\(true\\)', target: 'desktop/ui/drill/subflow.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(missing.degraded.kind, 'missing')",
    "assert.equal(missing.degraded.text, '子工作流 child-y · 角色数未知')",
    'assert.equal(missing.nodes.length, 0)',
    "assert.equal(cyc.degraded.kind, 'cycle')",
    "assert.equal(cyc.degraded.text, '子工作流定义存在循环 · 已停止下钻')",
    'assert.equal(cyc.depth, 2)',
    "assert.equal(empty.degraded.kind, 'empty')",
    "assert.equal(empty.degraded.text, '角色 无')",
    'assert.equal(empty.nodes.length, 0)',
  ],
  notes: [
    'Then 逐字：① 子工作流 child-y · 角色数未知（不进入、就地显示）；② 子工作流定义存在循环 · 已停止下钻（停在当前层，depth=2 不再增长，不递归不卡死）；③ 进入后空图 + 角色 无 + 返回入口。',
    '架构锚点：循环检测基于已访问 ref 集合，subflow.js 对 while(true) 零命中（exit 1）。内部断言 ② elapsed≤100 由注入时钟承载，用户可见 Then 只判"用户感觉不到等待"。',
  ],
})];
