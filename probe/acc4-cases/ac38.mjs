// AC-38 instance status 与 status --instance 同口径（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, instanceStatus, statusText, normalizeVolatile,
  readState, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-38';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass');
    const revBefore = readState(root)?.rev;

    // When：INST-001 两次查看；INST-999 两次查看
    const a = c.cmd(instanceStatus(root, 'INST-001'), 'orch instance status INST-001');
    const b = c.cmd(statusText(root, 'INST-001'), 'orch status --instance INST-001');
    const m1 = c.cmd(instanceStatus(root, 'INST-999'), 'orch instance status INST-999');
    const m2 = c.cmd(statusText(root, 'INST-999'), 'orch status --instance INST-999');

    c.eq('Then：INST-001 两次输出逐字一致（时间相关行归一）', normalizeVolatile(text(a)), normalizeVolatile(text(b)));
    c.eq('机检：INST-001 存在时退出码都是 0', `${a.exitCode}/${b.exitCode}`, '0/0');
    c.eq('Then：INST-999 两次都输出「实例 INST-999 · 不存在」', normalizeVolatile(text(m1)).trim(), '实例 INST-999 · 不存在');
    c.eq('Then：INST-999 两次输出一致', normalizeVolatile(text(m2)).trim(), normalizeVolatile(text(m1)).trim());
    c.eq('机检：INST-999 不存在时退出码都是 1', `${m1.exitCode}/${m2.exitCode}`, '1/1');
    c.eq('机检：.orch 不变（rev 不变）', readState(root)?.rev, revBefore);
    return conclude(c, root);
  },
}];
