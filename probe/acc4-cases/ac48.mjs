// AC-48 交接包找不到或歧义（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, resetCursor, handoffShow, orch, statusText,
  readState, instanceIds, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-48';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const r1 = freshRoot(`${AC}-a`); c.add(r1);
    const r2 = freshRoot(`${AC}-b`); c.add(r2);

    // ① HO-999 不存在
    c.cmd(runScene(r1, { scenario: 'pass' }), 'orch run code-loop pass（单实例）');
    const rev1 = readState(r1)?.rev;
    const a = c.cmd(handoffShow(r1, 'HO-999', 'INST-001'), 'orch handoff show HO-999 --instance INST-001');
    c.eq('Then①：提示「未找到交接包 HO-999」', text(a).trim(), '未找到交接包 HO-999');
    c.eq('Then①：退出码 1', a.exitCode, 1);

    // ② 两个实例都有一张 HO-001（不带 --instance）
    c.cmd(runScene(r2, { scenario: 'pass', cwd: 'demo1' }), 'orch run code-loop pass（cwd demo1 → INST-001）');
    resetCursor(r2);
    c.cmd(runScene(r2, { scenario: 'pass', cwd: 'demo2' }), 'orch run code-loop pass（cwd demo2 → INST-002）');
    c.check('Given②：两个实例都有一张 HO-001', instanceIds(r2).length === 2, instanceIds(r2).join(','));
    c.cmd(statusText(r2, 'INST-001'), 'orch status --instance INST-001（预热核心，完成启动对账）');
    const rev2Before = JSON.stringify(instanceIds(r2).map((id) => readState(r2, id)?.rev));
    const b = c.cmd(orch(r2, ['handoff', 'show', 'HO-001']), 'orch handoff show HO-001（不带 --instance，歧义）');
    c.eq('Then②：提示「交接包号 HO-001 在多个实例中存在，请加 --instance」', text(b).trim(), '交接包号 HO-001 在多个实例中存在，请加 --instance');
    c.eq('Then②：退出码 1', b.exitCode, 1);
    c.eq('机检①：没有状态写入（rev 不变）', readState(r1)?.rev, rev1);
    c.eq('机检②：没有状态写入（所有实例 rev 不变）', JSON.stringify(instanceIds(r2).map((id) => readState(r2, id)?.rev)), rev2Before);
    return conclude(c, [r1, r2]);
  },
}];
