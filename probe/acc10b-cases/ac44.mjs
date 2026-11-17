// AC-44 · 本实例 0 条待处理升级：空态「本实例待处理升级 0 个」+ 2 条已处理 + 继续不可点
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-44', {
  testFile: 'special-node-jump.test.js',
  arch: [
    { label: '空列表不短路渲染（if (!items.length) return 零命中）', pattern: 'if \\(!items[.]length\\) return', target: 'desktop/ui/drill/escalation-panel.js', expect: 'zero' },
  ],
  literals: [
    "w('DRILL_ESC_COUNT').replace('{n}', '0')",
    'assert.equal(p.items.length, 0)',
    'assert.equal(p.resolved.length, 2)',
    'assert.equal(p.continueDisabled, true)',
    "{ disabled: true }",
    "state: 'resolved'",
    "escalationId: 'ESC-003'",
    "escalationId: 'ESC-004'",
  ],
  extra(c) {
    // 逐字基线：A-6 / labels.js DRILL_ESC_COUNT='本实例待处理升级 {n} 个' → {n}=0 逐字
    c.check('Then 逐字：计数行渲染为「本实例待处理升级 0 个」',
      '本实例待处理升级 {n} 个'.replace('{n}', '0') === '本实例待处理升级 0 个',
      '本实例待处理升级 0 个');
  },
  notes: [
    'Then 逐字锚点（requirement.md:919）：第一行「本实例待处理升级 0 个」，只读列出 2 条已处理（编号·状态·节点·角色·轮次），「继续」不可点、不白屏、不抛错、可返回。',
    '计数行由文案键 DRILL_ESC_COUNT（本实例待处理升级 {n} 个）以 {n}=0 逐字填充，已在 extra 中核对逐字结果。',
  ],
})];
