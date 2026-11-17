// AC-47 · 角色与连接线同时变化：两条都到、都不丢、顺序不变
import { standardCase } from './_shared.mjs';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

export const cases = [standardCase('AC-47', {
  testFile: 'drill-live.test.js',
  arch: [
    { label: '不新开第二推送通道（new WebSocket(/EventSource( 零命中）',
      pattern: 'new WebSocket\\(|new EventSource\\(', target: 'desktop/ui/drill/ src/daemon/drill.js', expect: 'zero' },
  ],
  literals: [
    "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'serving' }));",
    "app.handleFrame(frame('connection.updated', 'E-07', { aggregateStatus: 'rejected' }));",
    "assert.equal(v.roleBar.status, statusWord('serving'));",
    "assert.equal(v.connection.title.includes(handoffWord('rejected')), true);",
    'assert.deepEqual(order(v), beforeOrder);',
    'assert.ok(roleAt - trigger <= 2000);',
    'assert.ok(connAt - trigger <= 2000);',
  ],
  extra(c) {
    // Then 逐字：状态词「服务中」、连接线聚合词「已拒绝」取自冻结词表
    c.eq("状态词 serving → 服务中",
      JSON.parse(UI_LABEL_KEYS.DRILL_ROLE_STATUS_TOKEN).serving, '服务中');
    c.eq("交接词 rejected → 已拒绝",
      UI_LABEL_KEYS.HANDOFF_LABEL_REJECTED, '已拒绝');
  },
  notes: [
    'Then 逐字锚点（requirement.md:952）：状态栏转「服务中」、连接线聚合转「已拒绝」；两条变化都到达、无覆盖无丢弃；卡片顺序不变（机检 roleMissed===false / connectionMissed===false / order_before===order_after）。',
    '内部断言（非用户可见）：roleUpdatedAt/connectionUpdatedAt - trigger ≤ 2000（NF-2 的 2 秒上限，与 Then 一致不放宽）。',
    '夹具：两条变化经同一条图流接缝连续触发（裁决 H：下钻与图投影共用 overlay，不新开通道/帧类型）；接缝限制同 AC-27——只翻状态词、不翻 servingNodes，本 AC 只判两条都到、互不覆盖。',
  ],
})];
