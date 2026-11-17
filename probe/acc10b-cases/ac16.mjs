// AC-16 · 「查看全部节点」切到 7 列看板并能原路回到下钻（列名沿用 I1.10a，下钻不复制第二套）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-16', {
  testFile: 'drill-switch.test.js',
  arch: [
    { label: '看板列名只由既有模块提供，下钻层不复制', pattern: 'DESKTOP_BOARD_COLUMN_|被阻塞|可调度', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    "assert.equal(app.state().view, 'board')",
    'assert.deepEqual(composed.board.columnNames, EXPECTED_COLUMNS)',
    'assert.equal(composed.board.columns.length, 7)',
    'DESKTOP_BOARD_COLUMN_BLOCKED', 'DESKTOP_BOARD_COLUMN_ESCALATED',
    "assert.equal(st.view, 'drill', '返回的是下钻，不是流程图')",
    'assert.equal(st.drillView.highlight, beforeHighlight)',
    'assert.equal(st.drillView.scrollTarget, beforeScroll)',
    "'实例 INST-001 / 角色 开发'",
  ],
  notes: [
    'Then 逐字：看板 7 列（被阻塞/可调度/执行中/待校验/已完成/失败/已升级）由 DESKTOP_BOARD_COLUMN_* 文案键逐项取值；返回后 view===\'drill\'（不是流程图），highlight/scrollTarget/DAG 选中态保持，面包屑切回「实例 INST-001 / 角色 开发」。',
    '内部断言（非用户可见）：scrollTop 前后相等（scrollTarget 索引比对）；机检 # pass≥1、# fail 0。',
    '架构锚点：下钻层 desktop/ui/drill/ 对 DESKTOP_BOARD_COLUMN_|被阻塞|可调度 零命中（exit 1），证明未复制第二套列名。',
  ],
})];
