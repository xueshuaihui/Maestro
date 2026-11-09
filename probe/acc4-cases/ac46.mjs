// AC-46 handoff list 跨实例稳定排序（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, resetCursor, handoffList, mutateState,
  instanceIds, text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-46';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const empty = freshRoot(`${AC}-empty`); c.add(empty);

    // Given：两个实例各有多张交接包（不同 cwd 绕开 DIR_BUSY）
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（cwd demo1 → INST-001）');
    resetCursor(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo2' }), 'orch run code-loop rounds-exceeded（cwd demo2 → INST-002）');
    c.check('Given：两个实例', instanceIds(root).length === 2, instanceIds(root).join(','));

    const list = c.cmd(handoffList(root), 'orch handoff list');
    const rows = lines(text(list)).filter((l) => l.startsWith('交接包 HO-'));
    c.eq('Then：两实例共 6 张包', rows.length, 6);
    c.check('Then：先按实例号、再按包号排序',
      rows.slice(0, 3).every((l, i) => l.includes('实例 INST-001') && l.includes(`HO-00${i + 1}`))
      && rows.slice(3).every((l, i) => l.includes('实例 INST-002') && l.includes(`HO-00${i + 1}`)),
      rows.join('|'));
    c.includes('Then：每行含包号、实例、方向、状态、最后时间', rows[0], '交接包 HO-001');
    c.includes('Then：每行含实例号', rows[0], '实例 INST-001');
    c.matches('Then：每行含方向中文', rows[0], /开发→测试|测试→开发/);

    const inst = c.cmd(handoffList(root, 'INST-001'), 'orch handoff list --instance INST-001');
    const iRows = lines(text(inst)).filter((l) => l.startsWith('交接包 HO-'));
    c.eq('Then：--instance 只出现 INST-001 的交接包', iRows.length, 3);
    c.check('机检：--instance 不含 INST-002', iRows.every((l) => l.includes('实例 INST-001')), iRows.join('|'));

    // 机检：排序稳定，不随快照数组顺序变化（打乱 INST-001 的 handoffs 数组）
    mutateState(root, 'INST-001', (s) => { s.handoffs.reverse(); });
    const list2 = c.cmd(handoffList(root), 'orch handoff list（打乱快照数组后复跑）');
    c.eq('机检：排序稳定，不随快照数组顺序变化', text(list2), text(list));

    const emp = c.cmd(handoffList(empty), 'orch handoff list（全新项目根）');
    c.eq('Then：空时输出「交接包 —」', text(emp).trim(), '交接包 —');
    return conclude(c, [root, empty]);
  },
}];
