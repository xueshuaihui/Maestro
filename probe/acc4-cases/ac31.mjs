// AC-31 审批允许后会话继续（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, holdApproval, approve, statusText, readState, readEvents,
  approvalOf, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-31';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：--template single --approval hold，宿主请求 write，实例等待审批
    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：run 打印了待处理审批行（会话在等待审批）', approvalSeen, h.stdout.slice(0, 400));
    const before = readState(root);
    c.eq('Given：审批为 pending', approvalOf(before, 'APR-001')?.state, 'pending');
    c.includes('Given：审批动作为 write', JSON.stringify(approvalOf(before, 'APR-001')), '"action":"write"');

    // When：orch approve APR-001 --instance INST-001 --decision allow
    const res = c.cmd(approve(root, 'APR-001', 'allow', 'INST-001'), 'orch approve APR-001 --instance INST-001 --decision allow');
    c.includes('Then：输出「审批 APR-001 已通过 · 动作 write」', text(res), '审批 APR-001 已通过 · 动作 write');
    c.eq('机检：approve 退出码 0', res.exitCode, 0);

    // 等前台 run 跑完后记录完整 stdout
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run --approval hold（前台，待审批→继续）', h);
    const after = readState(root);
    const ev = readEvents(root);
    c.eq('Then：任务最终按正常路径结束（实例 completed）', after?.state, 'completed');
    c.eq('机检：审批 state === approved', approvalOf(after, 'APR-001')?.state, 'approved');
    c.check('机检：出现 permission.allowed 事件', reasonsOf(ev).includes('permission.allowed'), reasonsOf(ev).join(','));
    c.check('Then：会话从「等待审批」回到执行中（run stdout 审批行之后仍有会话执行行）',
      h.stdout.indexOf('审批 APR-001 待处理') >= 0 && h.stdout.indexOf('会话 执行中') > h.stdout.indexOf('审批 APR-001 待处理'),
      h.stdout.slice(0, 600));
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.includes('机检：status --instance 的审批行显示「已通过」', text(st), '审批 APR-001 已通过 · 动作 write');
    await h.stop();
    return conclude(c, root);
  },
}];
