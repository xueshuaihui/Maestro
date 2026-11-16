// AC-48 · 下钻期间角色状态词转「未参与」：界面不清空、不崩、不关（裁决 H overlay 能力边界）
import { standardCase } from './_shared.mjs';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

export const cases = [standardCase('AC-48', {
  testFile: 'drill-live.test.js',
  arch: [
    { label: '空卡片不清空面板、不短路渲染（if (!cards.length) return|return null 零命中）',
      pattern: 'if \\(!cards\\.length\\) return|return null', target: 'desktop/ui/drill/cards.js', expect: 'zero' },
  ],
  literals: [
    "app.handleFrame(frame('role_instance.updated', 'developer', { status: 'inactive' }));",
    "assert.equal(v.roleBar.status, statusWord('inactive'));",
    'assert.deepEqual(v.roleBar.servingNodes, beforeServing);',
    'assert.deepEqual(v.roleBar.hostIcons, beforeHosts);',
    'assert.deepEqual(v.roleBar.lastAction, beforeLast);',
    'assert.equal(v.cards.length, beforeCards);',
    'assert.equal(v.dag.nodes.length, beforeDagLen);',
    "assert.equal(app.state().view, 'drill');",
    'assert.ok(at - trigger <= 2000);',
  ],
  extra(c, { src }) {
    c.eq("状态词 inactive → 未参与",
      JSON.parse(UI_LABEL_KEYS.DRILL_ROLE_STATUS_TOKEN).inactive, '未参与');
    // 裁决 H overlay 边界：接缝只带 status，不携带 servingNodes/hostIcons/lastAction
    c.includes('接缝只翻状态词（frame 仅含 status: inactive），不覆盖绑定字段',
      src, "{ status: 'inactive' }");
  },
  notes: [
    'Then 逐字锚点（requirement.md:963）：状态栏状态词转「未参与」；因接缝只覆盖角色状态词、不覆盖绑定与会话，其余四段（服务 …、宿主 …、最近 …）仍是最后一次投影的真实内容，不清空、不变成 undefined；卡片不消失、局部 DAG 不塌陷、下钻不关闭、可返回流程图。',
    '机检内部断言：t_update - t_trigger ≤ 2000（裁决 H 第 5 条分层，非用户可见）。',
    '裁决 H overlay 能力边界：POST /__test__/graph/pulse 接缝只能翻角色状态词（src/daemon/http/stream.js:255-275,586），不能清空 roleId 绑定；绑定归零后「任务 无」的形态由 AC-50 承担，本 AC 只判「状态词翻转、其余段保留」。',
  ],
})];
