// AC-04 status.md 随状态变化刷新（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, statusText, readStatusMd, readEvents, reasonsOf, text,
  requirementTitle, conclude, checkStatusMd,
} from '../acc4-f-common.mjs';

const AC = 'AC-04';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop（开发/测试各完成一次状态变化）');

    const md = readStatusMd(root);
    checkStatusMd(c, md, {});
    c.includes('Then：文件含实例号与模板名（标题行）', md.split('\n')[0], '# INST-001 编码闭环');
    c.includes('Then：两个节点各自的状态与轮次（T-001）', md, '- T-001 开发：已完成 · 第 1 轮');
    c.includes('Then：两个节点各自的状态与轮次（T-002）', md, '- T-002 测试：已完成 · 第 1 轮');
    c.includes('Then：最近交接包段', md, '- HO-001 开发→测试：已完成');
    c.includes('Then：升级段落', md, '## 升级');
    c.includes('Then：审批段落', md, '## 审批');

    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.includes('Then：节点状态与 orch status 显示一致（T-001）', text(st), '节点 T-001 开发 已完成 · 第 1 轮');
    c.includes('Then：节点状态与 orch status 显示一致（T-002）', text(st), '节点 T-002 测试 已完成 · 第 1 轮');

    // 机检：events 出现节点/交接包状态变化后，status.md 含对应中文状态
    const reasons = reasonsOf(readEvents(root));
    c.check('机检：events 含节点状态变化事件 verification.passed', reasons.includes('verification.passed'), reasons.join(','));
    c.check('机检：events 含交接包状态变化事件 handoff.created', reasons.includes('handoff.created'), reasons.join(','));
    c.check('机检：events 含交接包投递事件 handoff.delivered', reasons.includes('handoff.delivered'), reasons.join(','));
    c.includes('机检：status.md 含对应中文状态「已完成」', md, '已完成');
    c.includes('机检：status.md 含对应中文状态「已完成」（交接包）', md, '已完成 · 输入 calc.js');
    c.note('「1 秒内刷新」为时序性质（NFR-02 覆盖）；本 AC 以 events 状态变化与 status.md 含对应中文状态的可复核快照取证。');
    return conclude(c, root);
  },
}];
