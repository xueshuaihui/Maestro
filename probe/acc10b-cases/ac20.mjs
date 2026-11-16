// AC-20 · 点击人工节点跳到人工任务详情（面包屑 / 灰色盾牌 token / 待执行 0/1 / 交接段逐字 / 三空态行）
import { standardCase } from './_shared.mjs';

export const cases = [standardCase('AC-20', {
  testFile: 'special-node-jump.test.js',
  arch: [
    { label: '人工节点详情不引用升级面板', pattern: 'escalation', target: 'desktop/ui/drill/node-detail.js', expect: 'zero' },
  ],
  literals: [
    "assert.equal(v.breadcrumb, '实例 INST-001 / 节点 H-001')",
    "assert.equal(v.detail.visual.shape, 'shield')",
    "assert.equal(lines('handoff')[0],",
    "w('DRILL_DETAIL_HANDOFF')",
    ".replace('{id}', 'HO-012').replace('{direction}', w('DESKTOP_EDGE_DIRECTION_FORWARD'))",
    ".replace('{round}', '1').replace('{state}', handoffWord('accepted')).replace('{time}', '09:20:00')",
    'nodeType: \'human\'',
    'assert.equal(/escalation/.test(src), false)',
  ],
  notes: [
    'Then 逐字：面包屑「实例 INST-001 / 节点 H-001」；视觉灰色盾牌 token（visual.shape===\'shield\'）、状态待执行、轮次 0/1；交接段「交接 HO-012 · 正向 · 第 1 轮 · 已接受 · 09:20:00」（由 DRILL_DETAIL_HANDOFF + 文案键逐项替换拼出）。',
    '三段空态按 A-4 逐字：时间线 无记录 / 摘要 无记录 / 证据 无记录（由 DRILL_DETAIL_NONE.replace({section}) 拼行）；提供「返回流程图」。HO-012 不带 products/defects/artifactRefs，故证据段为空态。',
    '夹具独立：本 AC 不复用 AC-19 的 HO-008 编号，避免同编号两种状态。',
  ],
})];
