// AC-01 编码闭环启动后出现共享工作区（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, statusText, readState, text,
  requirementTitle, conclude, checkWorkspace, checkStatusMd,
} from '../acc4-f-common.mjs';

const AC = 'AC-01';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // When：编码闭环完整跑一轮（夹具场景 pass）
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run --cwd ./demo --task CODE_TASK --template code-loop（夹具 pass）');

    const { md } = checkWorkspace(c, root, { stages: ['T-001', 'T-002'] });
    checkStatusMd(c, md, {});

    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    c.eq('Then：status 首行仍是原来的实例行', text(st).split('\n')[0].trim(), '实例 INST-001 · 已完成 · 模板 编码闭环');

    const s = readState(root);
    c.eq('机检：state=completed', s?.state, 'completed');
    c.eq('机检：schemaVersion=2', s?.schemaVersion, 2);
    return conclude(c, root);
  },
}];
