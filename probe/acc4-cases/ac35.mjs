// AC-35 取消时待处理审批作废（异常 / mock 夹具面）
import {
  makeCase, freshRoot, holdApproval, cancel, statusText, readState, readEvents,
  approvalOf, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-35';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：实例处于等待审批
    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：处于等待审批', approvalSeen, h.stdout.slice(0, 300));
    c.eq('Given：审批 pending', approvalOf(readState(root), 'APR-001')?.state, 'pending');

    // When：orch cancel --instance INST-001
    const res = c.cmd(cancel(root), 'orch cancel --instance INST-001');
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run --approval hold（前台，取消收尾）', h);
    c.eq('Then：cancel 退出码 0', res.exitCode, 0);

    const after = readState(root);
    c.eq('机检：实例 cancelled', after?.state, 'cancelled');
    c.eq('机检：审批 withdrawn', approvalOf(after, 'APR-001')?.state, 'withdrawn');
    c.eq('机检：会话 idle', after?.sessions?.[0]?.state, 'idle');
    c.check('机检：出现 approval.withdrawn 事件', reasonsOf(readEvents(root)).includes('approval.withdrawn'), reasonsOf(readEvents(root)).join(','));

    // Then：审批行显示已作废；不会留下「待处理」
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.includes('Then：审批行显示「已作废」', text(st), '审批 APR-001 已作废');
    c.notIncludes('机检：宿主收到取消，审批不留下「待处理」', text(st).split('\n').filter((l) => l.includes('审批')).join('|'), '待处理');
    await h.stop();
    return conclude(c, root);
  },
}];
