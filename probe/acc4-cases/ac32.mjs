// AC-32 审批拒绝后沿用原失败口径（异常 / mock 夹具面）
import {
  makeCase, freshRoot, holdApproval, approve, readState, readEvents,
  approvalOf, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-32';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：处于等待审批', approvalSeen, h.stdout.slice(0, 300));

    // When：orch approve APR-001 --instance INST-001 --decision deny
    const res = c.cmd(approve(root, 'APR-001', 'deny', 'INST-001'), 'orch approve APR-001 --instance INST-001 --decision deny');
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run --approval hold（前台，拒绝后收尾）', h);
    c.includes('Then：输出「审批 APR-001 已拒绝 · 动作 write」', text(res), '审批 APR-001 已拒绝 · 动作 write');
    c.eq('机检：approve 退出码 0', res.exitCode, 0);
    c.includes('Then：orch run 以「审批被拒绝，任务中止于 write」收尾', h.stdout, '审批被拒绝，任务中止于 write');
    c.eq('Then：run 以失败收尾（退出码 1）', h.exitCode, 1);

    const after = readState(root);
    c.eq('机检：审批 denied', approvalOf(after, 'APR-001')?.state, 'denied');
    c.eq('机检：实例 failed', after?.state, 'failed');
    c.eq('机检：节点 failed', after?.nodes?.[0]?.state, 'failed');
    c.check('机检：出现 permission.denied 事件', reasonsOf(readEvents(root)).includes('permission.denied'), reasonsOf(readEvents(root)).join(','));
    c.notIncludes('机检：没有第二套原因文案（不出现执行失败口径）', h.stdout, '执行失败');
    await h.stop();
    return conclude(c, root);
  },
}];
