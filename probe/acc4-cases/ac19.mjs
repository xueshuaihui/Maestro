// AC-19 会话创建失败仍按一次尝试升级（回归 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readState, readEvents, reasonsOf, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-19';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // I1.2 编码闭环 dispatch-fail-first 夹具（首个节点 sessionNew 失败）
    const r = c.cmd(runScene(root, { scenario: 'dispatch-fail-first' }), 'orch run code-loop dispatch-fail-first');

    c.includes('Then：实例直接挂起并显示升级', text(r), '已挂起');
    c.notIncludes('Then：没有「待投递」', text(r), '待投递');
    const s = readState(root);
    c.eq('Then/机检：实例 suspended', s?.state, 'suspended');
    c.eq('机检：escalations[0].reasonCode === dispatch_failed', s?.escalations?.[0]?.reasonCode, 'dispatch_failed');
    c.eq('机检：sessions.length === 0（首派会话没建起来）', (s?.sessions ?? []).length, 0);
    c.eq('机检：node.dispatch 只有一条', reasonsOf(readEvents(root)).filter((x) => x === 'node.dispatch').length, 1);
    c.eq('机检：handoffs 中没有 created 包', (s?.handoffs ?? []).filter((h) => h.state === 'created').length, 0);
    return conclude(c, root);
  },
}];
