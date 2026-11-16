// AC-29 · 规划验收句端到端：九步探针序列 + 七条 Then 逐条（WP-6 已交付用例复用取证）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-29', {
  testFile: 'acceptance-drill-e2e.test.js',
  arch: [
    { label: 'drill 层无测试专用渲染分支', pattern: "NODE_ENV === 'test'", target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "'graph-shown',", "'drill-shown',", "'detail-shown',", "'evidence-shown',",
    "'escalation-shown',", "'continued',", "'graph-returned',", "'subflow-shown',", "'graph-restored',",
    'assert.deepEqual(probes.map((p) => p.event), PROBE_ORDER',
    'assert.deepEqual(p.abnormalRoles, [\'T-003\']',
    'assert.deepEqual(p.rejectedEdges, [\'E-02\']',
    'assert.equal(d.sections, 4',
    'assert.match(d.summaryLine, /退出码 1/',
    'assert.ok(e.lines.some((l) => l.includes(\'可解析\'))',
    'assert.equal(p.count, 1',
    'assert.equal(p.instanceState, \'running\'',
    'assert.equal(p.nodeWord, \'执行中\'',
    'assert.equal(p.notice, word(\'DRILL_ESC_DONE\', { id: \'ESC-001\' })',
    'assert.deepEqual(terminalEvents, []',
    'assert.equal(sub.roles, 3',
    'assert.equal(back.view, \'graph\'',
    'timing.tContinued - timing.tConfirm <= 2000',
  ],
  notes: [
    'Then 七条逐条：①红色角标+红色（rejected）连接线；②状态栏不可用/DAG 标 T-003/首卡 T-003；③四段齐全+证据含可解析+摘要退出码 1；④ESC-001 原因缺陷两行逐字等于 A-6；⑤继续后 suspended→running、提示「已继续 · ESC-001」无需刷新；⑥探针集无终端/CLI 事件；⑦S-001 进入子工作流 3 角色可见、面包屑第一层回流程图。',
    '九步探针序列 ANCHOR：graph-shown→drill-shown→detail-shown→evidence-shown→escalation-shown→continued→graph-returned→subflow-shown→graph-restored，顺序固定。',
    '内部断言：t_continued - t_confirm ≤ 2000（注入时钟，裁决 H 第 5 条）。复用 WP-6 已交付用例；规划 874 后段按裁决 A 归 AC-25，不在本 AC 判定范围。',
  ],
})];
