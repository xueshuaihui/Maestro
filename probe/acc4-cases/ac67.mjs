// AC-67 核心重启后审批已失效（异常 / mock 夹具面）
import {
  makeCase, freshRoot, holdApproval, coreStop, statusText, approve, readState,
  readEvents, approvalOf, reasonsOf, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-67';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：single --approval hold 等待审批 → core stop → 下一条命令自动拉起新核心
    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：宿主请求 write 动作、实例等待审批', approvalSeen, h.stdout.slice(0, 300));
    c.cmd(coreStop(root), 'orch core stop');
    c.cmd(statusText(root), 'orch status --instance INST-001（自动拉起新核心并完成启动对账）');
    c.note('启动对账会推进 rev；按 AC-34/AC-44 的口径，在「新核心已就绪」之后取 rev 作为命令前基线，比较的正是 approve 命令前后。');
    const revBefore = readState(root)?.rev;
    c.eq('Given：审批仍为 pending', approvalOf(readState(root), 'APR-001')?.state, 'pending');

    // When：orch approve APR-001 --instance INST-001 --decision allow
    const res = c.cmd(approve(root, 'APR-001', 'allow', 'INST-001'),
      'orch approve APR-001 --instance INST-001 --decision allow');
    const after = readState(root);

    c.includes('Then：提示「审批 APR-001 已失效：会话不在运行」', text(res), '审批 APR-001 已失效：会话不在运行');
    c.eq('Then：退出码 1', res.exitCode, 1);
    c.eq('机检：审批 state === pending（不假装已放行）', approvalOf(after, 'APR-001')?.state, 'pending');
    c.check('机检：events.jsonl 没有 permission.allowed',
      !reasonsOf(readEvents(root)).includes('permission.allowed'), reasonsOf(readEvents(root)).join(','));
    c.eq('机检：实例 rev 在命令前后不变', after?.rev, revBefore);
    await h.stop();
    return conclude(c, root);
  },
}];
