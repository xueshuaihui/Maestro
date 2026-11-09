// AC-09 缺必填字段的交接包被拒绝并升级（异常 / mock 夹具面）
import {
  makeCase, freshRoot, badHandoff, readState, readEvents, reasonsOf, seamJson,
  requirementTitle, conclude, checkBadPackage,
} from '../acc4-f-common.mjs';

const AC = 'AC-09';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // Given：NODE_ENV=test 下 test.handoff 接缝构造缺目标节点字段的交接包草稿
    const res = await badHandoff(root, 'missing-to');
    c.keep('orch run（test.handoff --mutate missing-to，放行后前台挂起收尾）', res.h);
    const seam = c.cmd(res.seamRes, 'call-seam test.handoff --mutate missing-to');
    c.check('夹具：接缝注册成功', seamJson(seam)?.ok === true, String(seamJson(seam)));
    c.check('夹具：暂停接缝命中（after_output:T-001）', res.paused, String(res.paused));

    const { s, ev, hs } = checkBadPackage(c, root, {});
    c.includes('机检：升级原因 detail 含缺少字段 toNodeId', s?.escalations?.[0]?.reasonDetail ?? '', 'toNodeId');
    c.eq('Then：没有新会话（sessions 只有入口 1 个）', (s?.sessions ?? []).length, 1);
    // 「没有 node.dispatch」按 Then「没有新派发」口径：拒绝事件之后不得出现任何 node.dispatch
    const idx = ev.findIndex((e) => e.reason === 'handoff.rejected');
    const after = ev.slice(idx).filter((e) => e.reason === 'node.dispatch').length;
    c.eq('机检：拒绝事件之后没有 node.dispatch（零新派发）', after, 0);
    c.notIncludes('机检：handoffs 无 created 记录', hs.map((h) => h.state).join(','), 'created');
    c.note('入口 T-001 的 node.dispatch 属 Given 上游；AC-09 Then「没有新派发」以拒绝事件之后零 node.dispatch + sessions 不增加取证。');
    return conclude(c, root);
  },
}];
