// AC-53 非运行实例不能暂停或恢复（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, workflow, readState, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-53';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：实例已完成
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass');
    const revBefore = readState(root)?.rev;
    c.eq('Given：实例已完成', readState(root)?.state, 'completed');

    // When：pause / resume
    const p = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    const r = c.cmd(workflow(root, 'resume', 'INST-001'), 'orch workflow resume INST-001');

    c.eq('Then：pause 提示当前状态与不能执行的原因', text(p).trim(), '实例 INST-001 当前为已完成，不能暂停');
    c.eq('Then：resume 提示当前状态与不能执行的原因', text(r).trim(), '实例 INST-001 当前为已完成，不能恢复');
    c.eq('Then：pause 退出码 1', p.exitCode, 1);
    c.eq('Then：resume 退出码 1', r.exitCode, 1);
    c.eq('机检：状态不变（state 仍 completed）', readState(root)?.state, 'completed');
    c.eq('机检：rev 不变', readState(root)?.rev, revBefore);
    return conclude(c, root);
  },
}];
