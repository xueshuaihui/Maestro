// AC-10 缺证据引用被拒绝并升级（异常 / mock 夹具面）
import {
  makeCase, freshRoot, badHandoff, readState, statusText, text,
  requirementTitle, conclude, checkBadPackage,
} from '../acc4-f-common.mjs';

const AC = 'AC-10';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const res = await badHandoff(root, 'no-evidence');
    c.keep('orch run（test.handoff --mutate no-evidence，放行后前台挂起收尾）', res.h);
    c.cmd(res.seamRes, 'call-seam test.handoff --mutate no-evidence');

    const { s } = checkBadPackage(c, root, {});
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('机检：escalations[0].reasonCode', s?.escalations?.[0]?.reasonCode, 'handoff_invalid');
    c.includes('Then：终端升级原因显示「缺少证据引用」', text(st), '缺少证据引用');
    c.includes('机检：reasonDetail 含「缺少证据引用」', s?.escalations?.[0]?.reasonDetail ?? '', '缺少证据引用');
    c.eq('Then：下游未启动（T-002 round 仍为 0）', (s?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.round, 0);
    return conclude(c, root);
  },
}];
