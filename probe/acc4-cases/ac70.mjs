// AC-70 编号唯一时 `handoff show` 可省略 --instance（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, cloneState, statusText, handoffShow,
  readState, instanceIds, normalizeVolatile, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-70';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：只有一个实例有 HO-002，另一个实例没有该包号
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（造 INST-001）');
    cloneState(root, 'INST-001', 'INST-002', (s) => { s.handoffs = (s.handoffs ?? []).slice(0, 1); });
    c.note('第二个实例以真实快照为母版克隆，仅保留 HO-001（去掉 HO-002）；视图 RPC 逐字段渲染，构造 Given 不等于伪造结论。');
    c.check('Given：项目根有两个实例', instanceIds(root).length === 2, instanceIds(root).join(','));
    c.check('Given：INST-001 有 HO-002', (readState(root, 'INST-001')?.handoffs ?? []).some((h) => h.handoffId === 'HO-002'), 'HO-002');
    c.check('Given：INST-002 没有 HO-002', !(readState(root, 'INST-002')?.handoffs ?? []).some((h) => h.handoffId === 'HO-002'), JSON.stringify((readState(root, 'INST-002')?.handoffs ?? []).map((h) => h.handoffId)));
    c.cmd(statusText(root, 'INST-001'), 'orch status --instance INST-001（预热核心）');
    const revBefore = readState(root, 'INST-001')?.rev;

    // When：orch handoff show HO-002（不带 --instance）
    const res = c.cmd(handoffShow(root, 'HO-002'), 'orch handoff show HO-002');
    c.eq('Then：退出码 0', res.exitCode, 0);
    c.includes('Then：正常输出该包详情（不需要 --instance）', text(res), '交接包 HO-002');
    // 补齐：「正常输出该包详情」按内容核对，而不是只认包号这一行。
    c.includes('机检：输出含实例行', text(res), '实例：INST-001');
    c.includes('机检：输出含方向与状态', text(res), '方向：测试→开发（回流）');
    c.includes('机检：输出含缺陷逐条', text(res), '缺陷：');
    c.includes('机检：输出含尝试次数（分母 3）', text(res), '尝试：1/3');
    c.eq('机检：命令前后 rev 不变', readState(root, 'INST-001')?.rev, revBefore);
    const withInst = c.cmd(handoffShow(root, 'HO-002', 'INST-001'), 'orch handoff show HO-002 --instance INST-001');
    c.eq('机检：省略 --instance 与显式 --instance 输出逐字一致',
      normalizeVolatile(text(res)), normalizeVolatile(text(withInst)));
    return conclude(c, root);
  },
}];
