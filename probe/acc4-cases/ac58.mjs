// AC-58 查看类命令严格只读（边界 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, statusText, statusAll, instanceStatus,
  instanceLog, instanceGraph, handoffList, handoffShow, escalateList,
  readState, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-58';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop pass（运行中→已完成实例）');

    // Given：核心已由前一条命令拉起并完成启动对账
    c.cmd(statusText(root), 'orch status --instance INST-001（预热核心，完成启动对账）');
    const before = readState(root);

    // When：七条查看类命令
    const cmds = [
      c.cmd(statusAll(root), 'orch status'),
      c.cmd(instanceStatus(root, 'INST-001'), 'orch instance status INST-001'),
      c.cmd(instanceLog(root, 'INST-001'), 'orch instance log INST-001'),
      c.cmd(instanceGraph(root, 'INST-001', 'json'), 'orch instance graph INST-001 --format json'),
      c.cmd(handoffList(root), 'orch handoff list'),
      c.cmd(handoffShow(root, 'HO-001', 'INST-001'), 'orch handoff show HO-001 --instance INST-001'),
      c.cmd(escalateList(root, {}), 'orch escalate list'),
    ];
    for (const r of cmds) c.eq('Then：查看类命令退出码 0', r.exitCode, 0);
    const after = readState(root);

    c.eq('机检：命令前后 rev 不变', after?.rev, before?.rev);
    c.eq('Then：实例 state.json 完全不变', JSON.stringify(after), JSON.stringify(before));
    return conclude(c, root);
  },
}];
