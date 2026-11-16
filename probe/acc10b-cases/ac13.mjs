// AC-13 · ACP 事件摘要四项齐全与缺项占位（经 daemon 投影，UI 层 execution.summary 零命中）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-13', {
  testFile: 'node-detail.test.js',
  arch: [
    { label: 'UI 层不直接读 execution.summary（daemon 投影）', pattern: 'execution\\.summary', target: 'desktop/ui/', expect: 'zero' },
  ],
  literals: [
    '摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log',
    '摘要 命令 npm test · 退出码 1 · 关键输出 — 行 · 日志 —',
    "assert.ok(!/undefined/.test(line))",
  ],
  notes: [
    'Then 逐字：T-003 摘要行逐字等于 A-4；T-005 缺关键输出/日志显示「—」；两行都不出现 undefined。',
    '架构：摘要由 daemon 侧只读投影选定唯一一条，界面不直接读事件流（desktop/ui 对 execution.summary 零命中）。',
  ],
})];
