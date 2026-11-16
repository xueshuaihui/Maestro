// AC-32 · 同一节点四处一致（状态词同源）+ 不重算状态（裁决 H 的 9 字段投影）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-32', {
  testFile: 'drill-live.test.js',
  arch: [
    { label: 'drill 层不重算状态（decideStatus|statusReason 零命中）', pattern: 'decideStatus|statusReason', target: 'desktop/ui/drill/', expect: 'zero' },
    { label: 'drill 层不直接 import CLI 文案（cli/labels 零命中）', pattern: 'cli/labels', target: 'desktop/ui/drill/', expect: 'zero' },
  ],
  literals: [
    'assert.equal(dagNode.status, graphWord)',
    'assert.equal(card.displayStatus, graphWord)',
    "assert.equal(card.tier, 'running')",
    'assert.equal(card.rank, 3)',
    "assert.equal(w('NODE_LABEL_RUNNING'), graphWord)",
    "assert.equal(board.columns.includes('running'), true)",
    "assert.equal(board.columnNames[2], w('DESKTOP_BOARD_COLUMN_RUNNING'))",
  ],
  notes: [
    'Then 逐字锚点：四处标题相同（实现登录）、状态词相同（执行中）、状态色 token 相同（blue）；看板落 running 列、卡片 tier===running（rank===3，8 档口径见 AC-08）。',
    '四层均由同一份投影字段派生：dagNode.status === card.displayStatus === graphWord（同一 nodeWord("running") 词源），文档层不重算状态；架构两条零命中证明未自算状态、未直连 CLI 文案模块。',
  ],
})];
