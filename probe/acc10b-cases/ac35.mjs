// AC-35 · 卡片耗时 12m→13m：三次 elapsed 相同、推进 60s 后 13m、stateSince 哈希不变
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-35', {
  testFile: 'drill-cards.test.js',
  arch: [
    { label: 'cards.js 不取系统时间（Date.now 零命中）', pattern: 'Date[.]now', target: 'desktop/ui/drill/cards.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(a[0].elapsed, '12m')",
    "assert.equal(b[0].elapsed, '12m')",
    "assert.equal(c[0].elapsed, '13m')",
    "a[0].lines[1].includes('已运行 12m')",
    "c[0].lines[1].includes('已运行 13m')",
    'assert.equal(JSON.stringify(cards[0].session.stateSince), before)',
  ],
  notes: [
    'Then 逐字锚点：三次执行行都是「已运行 12m」，注入时钟推进 60 秒后为「已运行 13m」，stateSince 三次导出之间不变。',
    '耗时由注入时钟（NOW）与会话 stateSince 之差得出，模块不取系统时间（Date.now 零命中），刷新不重置。',
  ],
})];
