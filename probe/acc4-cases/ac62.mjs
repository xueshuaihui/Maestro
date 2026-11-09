// AC-62 多节点审批拒绝走既有执行失败路径（异常 / mock 夹具面）
// Given：非场景 code-loop + --permission=ask --write-ref=calc.js + --approval hold，
// 让「开发节点 T-001」等待审批（而非 single 的收尾口径）。
import {
  makeCase, freshRoot, prepareScene, launch, baseEnv, approve, readState,
  readEvents, approvalOf, reasonsOf, text, sleep, requirementTitle, conclude,
  CODE_TASK,
} from '../acc4-f-common.mjs';

const AC = 'AC-62';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：--template code-loop --approval hold 发起，开发节点等待审批
    prepareScene(root, { scenario: null, mockArgs: ['--permission=ask', '--write-ref=calc.js'] });
    const h = launch(root, ['run', '--cwd', './demo', '--task', CODE_TASK,
      '--template', 'code-loop', '--approval', 'hold'], { env: baseEnv() });
    const seen = await h.waitOutput('APR-', 25000);
    c.check('Given：开发节点 T-001 等待审批（run 打印 APR-001 待处理行）', Boolean(seen), h.stdout.slice(0, 400));
    const before = readState(root);
    c.eq('Given：审批 pending', approvalOf(before, 'APR-001')?.state, 'pending');
    c.eq('Given：来源节点为开发 T-001', approvalOf(before, 'APR-001')?.nodeId, 'T-001');
    c.eq('Given：审批动作为 write', approvalOf(before, 'APR-001')?.action, 'write');

    // When：orch approve APR-001 --instance INST-001 --decision deny
    const res = c.cmd(approve(root, 'APR-001', 'deny', 'INST-001'),
      'orch approve APR-001 --instance INST-001 --decision deny');
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run code-loop --approval hold（前台，拒绝后收尾）', h);
    const after = readState(root);
    const ev = readEvents(root);

    c.includes('Then：输出「审批 APR-001 已拒绝 · 动作 write」', text(res), '审批 APR-001 已拒绝 · 动作 write');
    c.eq('机检：审批 denied', approvalOf(after, 'APR-001')?.state, 'denied');
    c.eq('机检：来源节点 escalated', (after?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.state, 'escalated');
    c.eq('机检：实例 suspended', after?.state, 'suspended');
    c.eq('机检：escalations[0].reasonCode === execution_failed', after?.escalations?.[0]?.reasonCode, 'execution_failed');
    c.notIncludes('机检：不出现 failed 实例行', h.stdout, '· 已失败');
    c.notIncludes('Then：不出现第二套失败文案（执行失败口径）', h.stdout, '执行失败');
    c.check('机检：出现 permission.denied 事件', reasonsOf(ev).includes('permission.denied'), reasonsOf(ev).join(','));
    c.check('机检：出现 escalation.created 事件（沿 refusal 路径升级）', reasonsOf(ev).includes('escalation.created'), reasonsOf(ev).join(','));
    await h.stop();
    return conclude(c, root);
  },
}];
