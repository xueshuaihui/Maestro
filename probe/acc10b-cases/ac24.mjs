// AC-24 · 升级面板不越界：可操作项恰为 ['继续','取消']，写动作只有 continue（无重派/终止/允许/拒绝）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-24', {
  testFile: 'special-node-jump.test.js',
  arch: [
    { label: '无重派/终止/允许/拒绝动作', pattern: 'reassign|terminate|approve|deny', target: 'desktop/ui/drill/ src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    "assert.deepEqual(p.actions, [w('DRILL_ESC_CONTINUE'), w('DRILL_ESC_CANCEL')])",
    "assert.deepEqual(p.actions, ['继续', '取消'])",
    '面板可操作项恰为继续与取消；写动作只有 continue',
    "assert.equal(/reassign|terminate|approve|deny/.test(src), false)",
    "assert.equal(/reassign|terminate|approve|deny/.test(daemon), false)",
  ],
  notes: [
    'Then 逐字：可操作项恰为「继续」与「取消」两项（actions 数组逐项等于 [DRILL_ESC_CONTINUE, DRILL_ESC_CANCEL] = [\'继续\',\'取消\']）；面板不含重派、终止、允许、拒绝、批量、跨实例筛选、通知开关。',
    '机检：special-node-jump.test.js 断言 actions 逐项；escalation-continue.test.js 承担「写动作只有 continue」（transport seam 为唯一写动作，见 app.js:337 Contract A4）。两处 # pass≥1、# fail 0。',
    '架构锚点：desktop/ui/drill/ 与 src/daemon/drill.js 对 reassign|terminate|approve|deny 零命中（exit 1）。',
  ],
})];
