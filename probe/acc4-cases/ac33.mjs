// AC-33 同一审批不能处理两次（边界 / mock 夹具面）
import {
  makeCase, freshRoot, holdApproval, approve, readState, readEvents,
  approvalOf, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-33';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：按 AC-31 的步骤重放至审批已通过
    const { h } = await holdApproval(root);
    const first = c.cmd(approve(root, 'APR-001', 'allow', 'INST-001'), 'orch approve APR-001 --instance INST-001 --decision allow（第一次）');
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run --approval hold（前台）', h);
    c.includes('Given：第一次已通过', text(first), '审批 APR-001 已通过');
    const afterFirst = readState(root);
    c.eq('Given：审批已变为 approved', approvalOf(afterFirst, 'APR-001')?.state, 'approved');

    // When：再次执行 approve APR-001
    const again = c.cmd(approve(root, 'APR-001', 'allow', 'INST-001'), 'orch approve APR-001 --decision allow（第二次）');
    c.includes('Then：提示审批已处理', text(again), '审批 APR-001 已处理');
    c.includes('Then：提示无需再次处理', text(again), '无需再次处理');
    c.eq('Then：退出码 1', again.exitCode, 1);

    const afterAgain = readState(root);
    c.eq('机检：实例状态不变', afterAgain?.state, afterFirst?.state);
    c.eq('机检：审批 state 仍为 approved（只变一次）', approvalOf(afterAgain, 'APR-001')?.state, 'approved');
    const ev = readEvents(root);
    c.eq('机检：只有一条 permission.allowed 事件', reasonsOf(ev).filter((r) => r === 'permission.allowed').length, 1);
    c.eq('机检：实例 rev 不变', afterAgain?.rev, afterFirst?.rev);
    await h.stop();
    return conclude(c, root);
  },
}];
