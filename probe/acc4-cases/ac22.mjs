// AC-22 按实例过滤升级（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, resetCursor, escalateList, readState, text, lines,
  instanceIds, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-22';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（INST-001）');
    resetCursor(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo2' }), 'orch run code-loop rounds-exceeded（INST-002）');
    c.check('Given：两个实例都有升级', instanceIds(root).length === 2, instanceIds(root).join(','));

    const r = c.cmd(escalateList(root, { instance: 'INST-001' }), 'orch escalate list --instance INST-001');
    const rows = lines(text(r)).filter((l) => l.startsWith('升级 ESC'));
    c.eq('Then：只出现 INST-001 的升级行', rows.length, 1);
    c.includes('Then：该行含 INST-001', rows[0], '实例 INST-001');
    c.notIncludes('机检：输出不含 INST-002', text(r), 'INST-002');
    // 补齐机检：过滤必须排除的是「真实存在的另一实例升级行」，而不是空结果；
    // 并核对那一行确实是可复核的完整升级行（升级号/节点与角色/轮次/状态/原因摘要）。
    c.eq('机检：INST-002 确有 1 条待处理升级（被过滤的是真实行）',
      (readState(root, 'INST-002')?.escalations ?? []).filter((e) => e.state === 'pending').length, 1);
    c.includes('机检：该行含升级号 ESC-001', rows[0], 'ESC-001');
    c.includes('机检：该行含节点与角色、轮次、状态、原因摘要', rows[0],
      '节点 T-002 测试 · 第 2 轮  待处理  回流超上限');
    return conclude(c, root);
  },
}];
