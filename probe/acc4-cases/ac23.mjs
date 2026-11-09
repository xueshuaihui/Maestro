// AC-23 通过处理终节点升级 → 实例完成（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, escalateResolve, readState, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-23';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（终节点 T-002 升级，实例挂起）');
    const before = readState(root);
    c.eq('Given：实例挂起且升级待处理', before?.state, 'suspended');
    c.eq('Given：ESC-001 待处理', before?.escalations?.[0]?.state, 'pending');

    const res = c.cmd(escalateResolve(root, 'ESC-001', 'pass', 'INST-001'), 'orch escalate resolve ESC-001 --instance INST-001 --decision pass');
    c.includes('Then：输出「升级 ESC-001 已处理（通过）」', text(res), '升级 ESC-001 已处理（通过）');
    c.includes('Then：输出当前实例行「实例 INST-001 · 已完成 · 模板 编码闭环」', text(res), '实例 INST-001 · 已完成 · 模板 编码闭环');
    c.eq('Then：退出码 0', res.exitCode, 0);

    const after = readState(root);
    c.eq('机检：升级 state === resolved', after?.escalations?.[0]?.state, 'resolved');
    c.eq('机检：resolution === pass', after?.escalations?.[0]?.resolution, 'pass');
    c.eq('机检：实例 completed', after?.state, 'completed');
    c.check('机检：节点都为 done', (after?.nodes ?? []).every((n) => n.state === 'done'), (after?.nodes ?? []).map((n) => n.state).join(','));
    c.note('「不需要再敲 run」：resolve 命令自身把实例推进到 completed，未再执行 orch run。');
    return conclude(c, root);
  },
}];
