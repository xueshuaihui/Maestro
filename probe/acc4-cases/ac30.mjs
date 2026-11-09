// AC-30 重新分配后仍失败会再次升级（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, escalateResolve, readState, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-30';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // 夹具：rounds-exceeded 场景在重新分配时新会话创建/推进失败（mock 已无后续步），再次升级
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（挂起 + ESC-001 待处理）');
    const before = readState(root);
    c.eq('Given：实例 suspended', before?.state, 'suspended');
    const escBefore = (before?.escalations ?? []).length;

    const res = c.cmd(escalateResolve(root, 'ESC-001', 'retry', 'INST-001'),
      'orch escalate resolve ESC-001 --instance INST-001 --decision retry');
    c.includes('Then：输出「升级 ESC-001 已处理（重新分配）」', text(res), '升级 ESC-001 已处理（重新分配）');
    c.notIncludes('Then：不会显示「运行中」', text(res), '实例 INST-001 · 运行中');
    c.eq('Then：resolve 命令按挂起收尾，退出码 4', res.exitCode, 4);

    const after = readState(root);
    c.eq('机检：escalations 数量增加 1', (after?.escalations ?? []).length, escBefore + 1);
    c.eq('机检：实例 suspended', after?.state, 'suspended');
    c.includes('Then：生成新的升级', text(res), '升级 ESC-002 待处理');
    return conclude(c, root);
  },
}];
