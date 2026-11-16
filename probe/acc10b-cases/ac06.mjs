// AC-06 · 点击 DAG 任一节点都滚动到对应卡片并高亮（内部断言 ≤200ms）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-06', {
  testFile: 'drill-dag.test.js',
  arch: [
    { label: 'dag.js 联动不重新取数', pattern: 'fetch\\(|request\\(', target: 'desktop/ui/drill/dag.js', expect: 'zero' },
  ],
  literals: [
    'view.scrollTarget, target',
    'view.highlight, target',
    'view.lastElapsed <= 200',
    'view.cards.length, view.dag.nodes.length',
  ],
  notes: [
    'Then 逐字：依次点击 A、C、E，每次滚到对应卡片并高亮，三次都命中、卡片已在可视区也给高亮、高亮持续到下一次点击；「不用等」为内部断言 elapsed ≤ 200ms（注入时钟）。',
    '联动只改视图状态，不触发重新取数（dag.js 零 fetch/request）。',
  ],
})];
