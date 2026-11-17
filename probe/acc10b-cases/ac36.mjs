// AC-36 · 四层下钻：面包屑段数 1/2/3/4、逐级返回 3 次、栈承载层级
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-36', {
  testFile: 'subworkflow-drill.test.js',
  arch: [
    { label: '层级由栈结构承载（stack.push|pop ≥1，不绑写法）', pattern: 'stack[.]push|stack[.]pop', target: 'desktop/ui/drill/subflow.js', expect: 'min1' },
    { label: '层级不持久化（localStorage|sessionStorage 零命中）', pattern: 'localStorage|sessionStorage', target: 'desktop/ui/drill/subflow.js', expect: 'zero' },
  ],
  literals: [
    'assert.deepEqual([one, two, three, four].map((v) => v.breadcrumb.length), [1, 2, 3, 4])',
    'assert.equal(four.returnCount, 3)',
    "assert.deepEqual(sequence, ['child-x', 'publish-child', 'release-flow'])",
    '实例 INST-001',
    '子工作流 发布子流程',
    '子工作流 leaf-y',
    'assert.deepEqual(iterative, [1, 2, 3, 4])',
  ],
  notes: [
    '四层定义链 release-flow → publish-child → child-x → leaf-y（3 个 workflow 引用）；Then 逐字锚点：面包屑段数 1/2/3/4、逐级返回 3 次（returnCount === levels-1 === 3）、每次退一层。',
    '层级栈只增删一层由行为断言判（段数 [1,2,3,4] + returnCount===3）；架构检查只要求栈结构承载且不绑写法（F3-08 语义断言），localStorage/sessionStorage 零命中证明层级不持久化。',
  ],
})];
