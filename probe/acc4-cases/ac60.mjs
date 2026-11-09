// AC-60 取消覆盖暂停与待审批（异常 / mock 夹具面）
// Given 用真实命令构造：hold 等待审批 → workflow pause（暂停时该回合已有待处理审批）→ cancel。
import {
  makeCase, freshRoot, holdApproval, workflow, cancel, statusText, readState,
  approvalOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-60';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：等待审批的实例，且已暂停（暂停时已进入的回合里有 hold 待处理审批）
    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：宿主请求 write，实例等待审批', approvalSeen, h.stdout.slice(0, 300));
    const p = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    c.eq('Given：pause 退出码 0', p.exitCode, 0);
    const mid = readState(root);
    c.eq('Given：已暂停', mid?.paused, true);
    c.eq('Given：暂停时仍有待处理审批', approvalOf(mid, 'APR-001')?.state, 'pending');

    // When：orch cancel --instance INST-001
    const res = c.cmd(cancel(root), 'orch cancel --instance INST-001');
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run --approval hold（前台）', h);
    c.eq('Then：cancel 退出码 0', res.exitCode, 0);

    const after = readState(root);
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('机检：实例 cancelled', after?.state, 'cancelled');
    c.eq('Then：暂停标记清除（paused === false）', after?.paused, false);
    c.eq('机检：审批 withdrawn', approvalOf(after, 'APR-001')?.state, 'withdrawn');
    c.eq('机检：会话 idle', after?.sessions?.[0]?.state, 'idle');
    c.includes('Then：审批行显示已作废', text(st), '审批 APR-001 已作废');
    c.notIncludes('机检：不会留下「待处理」', text(st).split('\n').filter((l) => l.includes('审批')).join('|'), '待处理');
    await h.stop();
    return conclude(c, root);
  },
}];
