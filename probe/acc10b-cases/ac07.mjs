// AC-07 · 任务卡片三层信息逐字（A-3 第 1~6 行）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-07', {
  testFile: 'drill-cards.test.js',
  arch: [
    { label: 'drill 中文走文案键（无中文模板字面量）', pattern: '已运行|轮次|依赖', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    '卡片 T-003 · 实现登录 · 轮次 1/2 · 执行中',
    '执行 开发 · 执行中 · 已运行 12m · 工具 write',
    '依赖 T-001 已完成 · 产物 calc.js · 证据 2',
    '卡片 T-001 · 需求澄清 · 轮次 1/1 · 已完成',
    '执行 协调者 · 无会话 · — · 工具 —',
    '依赖 — · 产物 — · 证据 0',
  ],
  notes: [
    'Then 逐字：A-3 六行（正常卡三行 + 空值卡三行）；已运行 12m 由注入时钟与 stateSince 得出。',
    '卡片文本模板只来自文案表，drill 目录对「已运行/轮次/依赖」零命中。',
  ],
})];
