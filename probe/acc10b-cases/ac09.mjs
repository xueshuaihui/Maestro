// AC-09 · 会话指示器 6 态与「等待审批：动作」文案（A-3 指示器表）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-09', {
  testFile: 'drill-cards.test.js',
  arch: [
    { label: 'desktop/ui 无硬编码 git_push', pattern: 'git_push', target: 'desktop/ui/', expect: 'zero' },
  ],
  literals: [
    "'等待审批：git_push'", "'：git_push'",
    "['空闲', 'gray', 'none', null, '']",
    "['执行中', 'blue', 'pulse', null, '']",
    "['执行中', 'blue', 'pulse', 'tool', '']",
    "['等待下游', 'yellow', 'none', null, '']",
    "['已升级', 'red', 'none', null, '']",
    "['无会话', 'gray', 'none', null, '']",
    'assert.equal(result.length, 7)',
  ],
  notes: [
    'Then 逐字：7 组 {label,color,animation,icon,detail} 逐项等于 A-3 指示器表；idle→空闲/灰、thinking→执行中/蓝/脉冲、tool_running→执行中/蓝/脉冲/工具图标、waiting_input→等待审批：git_push/黄、waiting_dependency→等待下游/黄、escalated→已升级/红、无会话→无会话/灰；每卡一个指示器。',
    '动作名来自数据（approvals 记录），desktop/ui 对 git_push 零命中。',
  ],
})];
