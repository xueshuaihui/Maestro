// AC-38 · 单节点 0 线不塌陷（+ 同文件 computeLayout 复用保证两次布局逐字节相等）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-38', {
  testFile: 'drill-dag.test.js',
  arch: [
    { label: '边集为空不短路布局（if (!edges.length) return 零命中）', pattern: 'if \\(!edges[.]length\\) return', target: 'desktop/ui/drill/dag.js', expect: 'zero' },
  ],
  literals: [
    'assert.equal(result.nodes.length, 1)',
    'assert.equal(result.edges.length, 0)',
    'result.bounds.width > 0 && result.bounds.height > 0',
    'assert.equal(result.dangling, 0)',
    "'T-030'",
    'JSON.stringify(a), JSON.stringify(b)',
  ],
  notes: [
    'Then 逐字锚点（requirement.md:853-854）：局部 DAG 恰好 1 个节点、0 条连线，图区仍有可见尺寸（bounds>0），节点可见、dangling=0、不出现替代文案。',
    '「两次布局逐字节相等」由同文件 buildDag 两次调用 JSON.stringify 相等断言承载（drill-dag.test.js:53），且布局复用同一 computeLayout（裁决 F3-08）；AC-38 机检原文聚焦单节点退化不塌陷。',
  ],
})];
