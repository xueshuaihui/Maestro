// AC-43 · 展开 HO-010 期间聚合状态变化：面板刷新、锚点行不跳走（用户可见 Then）+ 内部断言 anchorRowTop
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-43', {
  testFile: 'connection-panel.test.js',
  arch: [
    { label: '面板不自行取数（fetch(|request( 零命中）', pattern: 'fetch\\(|request\\(', target: 'desktop/ui/drill/handoff-panel.js', expect: 'zero' },
  ],
  literals: [
    "changed.edge.aggregateStatus = 'rejected'",
    "panelAfter.title.includes('已拒绝')",
    "assert.equal(panelAfter.expandedId, 'HO-010')",
    'assert.deepEqual(panelAfter.timelineRows, timelineBefore)',
    'Math.abs(panelAfter.anchorRowTop - panelBefore.anchorRowTop) <= 1',
    "expandedId: 'HO-010'",
    "aggregateStatus: 'rejected'",
  ],
  notes: [
    '用户可见 Then（requirement.md:908）：刷新后标题聚合词变「已拒绝」；HO-010 仍处展开态、仍看得见、没从眼皮底下跳走；已展开时间线不被收起。',
    '内部断言（非用户可见，裁决 H 第5条 / F2-11 / F4-14）：|anchorRowTopAfter - anchorRowTopBefore| ≤ 1（模型坐标+注入时钟的模拟值），scrollTop 仅记录不判方向；取数路径同 pulse overlay（D-14）。',
  ],
})];
