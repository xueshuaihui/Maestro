// AC-29 找不到、歧义或状态不对时拒绝处理（异常 / mock 夹具面）
// 三个子场景各用独立项目根：① 升级不存在 ② 两实例都有 ESC-001 不带 --instance ③ INST-002 非挂起
import {
  makeCase, freshRoot, runScene, resetCursor, escalateResolve, orch, cloneState,
  readState, text, instanceIds, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-29';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];

    // ① 升级号不存在
    const r1 = freshRoot(`${AC}-a`); c.add(r1); roots.push(r1);
    const a = c.cmd(escalateResolve(r1, 'ESC-001', 'fail', 'INST-001'),
      'orch escalate resolve ESC-001 --instance INST-001 --decision fail（升级不存在）');
    c.eq('Then①：提示「未找到升级 ESC-001」', text(a).trim(), '未找到升级 ESC-001');
    c.eq('Then①：退出码 1', a.exitCode, 1);
    c.eq('机检①：没有实例被写入', instanceIds(r1).length, 0);

    // ② 两个实例都有 ESC-001，不带 --instance
    const r2 = freshRoot(`${AC}-b`); c.add(r2); roots.push(r2);
    c.cmd(runScene(r2, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（INST-001）');
    resetCursor(r2);
    c.cmd(runScene(r2, { scenario: 'rounds-exceeded', cwd: 'demo2' }), 'orch run code-loop rounds-exceeded（INST-002）');
    c.check('Given②：两个实例都有 ESC-001', instanceIds(r2).length === 2, instanceIds(r2).join(','));
    const rev2Before = JSON.stringify(instanceIds(r2).map((id) => readState(r2, id)?.rev));
    const b = c.cmd(orch(r2, ['escalate', 'resolve', 'ESC-001', '--decision', 'fail']),
      'orch escalate resolve ESC-001 --decision fail（不带 --instance，歧义）');
    c.includes('Then②：提示「请加 --instance」', text(b), '请加 --instance');
    c.eq('Then②：退出码 1', b.exitCode, 1);
    c.eq('机检②：所有实例 rev 不变', JSON.stringify(instanceIds(r2).map((id) => readState(r2, id)?.rev)), rev2Before);

    // ③ INST-002 不是挂起（有 ESC-001 但已完成）
    const r3 = freshRoot(`${AC}-c`); c.add(r3); roots.push(r3);
    c.cmd(runScene(r3, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（母版 INST-001 挂起）');
    cloneState(r3, 'INST-001', 'INST-002', (s) => { s.state = 'completed'; s.paused = false; });
    const rev3Before = JSON.stringify(instanceIds(r3).map((id) => readState(r3, id)?.rev));
    const cc = c.cmd(escalateResolve(r3, 'ESC-001', 'fail', 'INST-002'),
      'orch escalate resolve ESC-001 --instance INST-002 --decision fail（INST-002 非挂起）');
    c.includes('Then③：提示「实例 INST-002 当前不是挂起状态，不能处理升级」', text(cc), '实例 INST-002 当前不是挂起状态，不能处理升级');
    c.eq('Then③：退出码 1', cc.exitCode, 1);
    c.eq('机检③：所有实例 rev 不变', JSON.stringify(instanceIds(r3).map((id) => readState(r3, id)?.rev)), rev3Before);
    return conclude(c, roots);
  },
}];
