// AC-21 跨实例列出待处理升级（正常路径 / mock 夹具面）
// 静态前置（两实例各一待处理、INST-001 另有已处理/已作废）以真实跑出的 state.json 为母版克隆改写，
// 所有断言仍落在真实 CLI 输出上（视图 RPC 逐字段渲染，构造 Given 不等于伪造结论）。
import {
  makeCase, freshRoot, runScene, resetCursor, escalateList, readState, mutateState,
  text, lines, instanceIds, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-21';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const empty = freshRoot(`${AC}-empty`); c.add(empty);

    // 两个实例各有一个待处理升级（不同 cwd 绕开 DIR_BUSY）
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo1' }), 'orch run code-loop rounds-exceeded（cwd demo1 → INST-001）');
    resetCursor(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded', cwd: 'demo2' }), 'orch run code-loop rounds-exceeded（cwd demo2 → INST-002）');
    c.check('夹具：确有两个实例', instanceIds(root).length === 2, instanceIds(root).join(','));
    // INST-001 追加一条已处理（pass）与一条已作废
    mutateState(root, 'INST-001', (s) => {
      const base = s.escalations[0];
      s.escalations = [
        base,
        { ...base, escalationId: 'ESC-002', state: 'resolved', resolution: 'pass', resolvedAt: '2026-11-08T19:00:00.000Z', voidedAt: null },
        { ...base, escalationId: 'ESC-003', state: 'voided', resolution: null, voidedAt: '2026-11-08T19:00:01.000Z' },
      ];
    });
    c.note('Given 的「已处理/已作废」为视图静态前置：以真实挂起 state.json 为母版，仅改写 escalations 数组状态字段后交 CLI 渲染。');

    // ① 默认：两行（先按实例号、再按升级号）
    const def = c.cmd(escalateList(root, {}), 'orch escalate list');
    const defRows = lines(text(def)).filter((l) => l.startsWith('升级 ESC'));
    c.eq('Then：默认两行', defRows.length, 2);
    c.includes('机检：默认行序稳定（INST-001 在 INST-002 之前）', defRows[0], '实例 INST-001');
    c.includes('机检：默认第 2 行 INST-002', defRows[1], '实例 INST-002');
    c.includes('Then：行内含实例号、节点与角色、轮次、状态、原因摘要', defRows[0], '节点 T-002 测试 · 第 2 轮  待处理  回流超上限');
    c.notIncludes('机检：默认不含已处理', text(def), '已处理');
    c.notIncludes('机检：默认不含已作废', text(def), '已作废');
    const def2 = c.cmd(escalateList(root, {}), 'orch escalate list（复跑验行序）');
    c.eq('机检：默认各次输出行序稳定', text(def2), text(def));

    // ② --all：含全部，已处理「已处理（通过）」、已作废「已作废」
    const all = c.cmd(escalateList(root, { all: true }), 'orch escalate list --all');
    const allRows = lines(text(all)).filter((l) => l.startsWith('升级 ESC'));
    c.eq('Then：--all 四行', allRows.length, 4);
    c.includes('机检：--all 已处理以「已处理（通过）」出现', text(all), '已处理（通过）');
    c.includes('机检：--all 已作废以「已作废」出现', text(all), '已作废');
    // 补齐机检：把「已处理/已作废」标签绑定到具体升级行，并确认 --all 真的含全部实例。
    const resolvedRow = allRows.find((l) => l.includes('ESC-002'));
    const voidedRow = allRows.find((l) => l.includes('ESC-003'));
    c.includes('机检：已处理行（ESC-002）逐字带「已处理（通过）」', resolvedRow ?? '', '已处理（通过）');
    c.includes('机检：已作废行（ESC-003）逐字带「已作废」', voidedRow ?? '', '已作废');
    c.check('机检：--all 含 INST-002 的待处理行（含全部实例）',
      allRows.some((l) => l.includes('实例 INST-002') && l.includes('待处理')), allRows.join('|'));

    // ③ --instance INST-001 --all：只该实例，但含其已处理/已作废
    const both = c.cmd(escalateList(root, { instance: 'INST-001', all: true }), 'orch escalate list --instance INST-001 --all');
    const bothRows = lines(text(both)).filter((l) => l.startsWith('升级 ESC'));
    c.eq('机检：--instance + --all 只含 INST-001 三行', bothRows.length, 3);
    c.check('机检：三行都是 INST-001', bothRows.every((l) => l.includes('实例 INST-001')), bothRows.join('|'));
    c.includes('机检：含待处理', text(both), '待处理');
    c.includes('机检：含已处理（通过）', text(both), '已处理（通过）');
    c.includes('机检：含已作废', text(both), '已作废');

    // ④ 全新项目根无升级
    const emp = c.cmd(escalateList(empty, {}), 'orch escalate list（全新项目根）');
    c.eq('Then：没有升级时输出「升级 —」', text(emp).trim(), '升级 —');
    return conclude(c, [root, empty]);
  },
}];
