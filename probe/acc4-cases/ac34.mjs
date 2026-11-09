// AC-34 审批号歧义时要求指定实例（异常 / mock 夹具面）
// 静态前置「两实例各有 APR-001」以真实 hold 状态为母版克隆改写，断言落在真实 CLI 输出。
import {
  makeCase, freshRoot, holdApproval, approve, cloneState, readState,
  instanceIds, approvalOf, statusText, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-34';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：两个实例都有 APR-001（INST-001 真实 hold；INST-002 由真实状态克隆）
    const { h } = await holdApproval(root);
    cloneState(root, 'INST-001', 'INST-002', (s) => {
      s.approvals = [{ ...(s.approvals?.[0] ?? {}), approvalId: 'APR-001', instanceId: 'INST-002' }];
    });
    c.check('Given：两个实例都有 APR-001',
      instanceIds(root).length === 2 && approvalOf(readState(root, 'INST-001'), 'APR-001') && approvalOf(readState(root, 'INST-002'), 'APR-001'),
      instanceIds(root).join(','));
    c.note('Given 的第二个实例以真实 hold 快照为母版克隆，仅改写 approvals.instanceId；视图/决策 RPC 逐字段读取，构造 Given 不等于伪造结论。');
    // 预热：让核心完成启动对账（同 AC-44/58 口径），否则首条决策命令会带一次对账写入。
    c.cmd(statusText(root, 'INST-001'), 'orch status --instance INST-001（预热核心，完成启动对账）');
    const revBefore = JSON.stringify(instanceIds(root).map((id) => readState(root, id)?.rev));

    // When①：不带 --instance 的歧义审批
    const amb = c.cmd(approve(root, 'APR-001', 'allow'), 'orch approve APR-001 --decision allow（不带 --instance，歧义）');
    c.eq('Then①：提示「审批号 APR-001 在多个实例中存在，请加 --instance」', text(amb).trim(), '审批号 APR-001 在多个实例中存在，请加 --instance');
    c.eq('Then①：退出码 1', amb.exitCode, 1);

    // When②：不存在的审批号
    const missing = c.cmd(approve(root, 'APR-999', 'allow', 'INST-001'), 'orch approve APR-999 --instance INST-001 --decision allow');
    c.eq('Then②：提示「未找到审批 APR-999」', text(missing).trim(), '未找到审批 APR-999');
    c.eq('Then②：退出码 1', missing.exitCode, 1);

    c.eq('机检：相关实例 rev 都不变', JSON.stringify(instanceIds(root).map((id) => readState(root, id)?.rev)), revBefore);
    c.eq('机检：APR-001 仍是 pending', approvalOf(readState(root, 'INST-001'), 'APR-001')?.state, 'pending');
    await h.stop();
    return conclude(c, root);
  },
}];
