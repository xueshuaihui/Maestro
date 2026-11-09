// AC-63 11 项完整原语逐项可表达且逐项可见（正常路径 + 机检）
// Given：附录 A-1 / A-13 的 doc-fanout（writeDocFanout：A-1 逐字 + T-001 节点级 wake_allow，裁-15/R-11）。
// When：workflow validate（全量）、workflow dry-run doc-fanout、workflow show code-loop。
// 裁决（AC-63-1）：Then 写「校验工作流 4 个」而 When 写 `orch workflow validate doc-fanout`；按附录 A-9
// `[<工作流>]` 可选参数与 AC-29 先例，带 id 的 scoped 校验恒为「1 个」，「4 个」（项目 1 + 内置 3）
// 只能来自无参全量校验。两种都实跑：4 个 断言钉在全量 validate，scoped 结果作旁证落证据。
import {
  makeCase, freshRoot, workflowValidate, workflowDryRun, workflowShow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-63';

// A-10 预演全文 14 行逐字
const DRY_RUN_LINES = [
  '编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流',
  '1. T-001 研究（角色节点 researcher）',
  '2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all',
  '3. T-004 人工确认（人工节点）',
  '4. T-006 代码闭环（子工作流 code-loop · 2 节点）',
  '5. T-005 升级（升级节点）',
  '条件分支：',
  '- T-004 → T-006 当 人工通过',
  '- T-004 → T-005 当 人工驳回',
  '- T-006 → T-005 当 判定不通过',
  '字段映射：',
  '- T-001.research.notes → T-002.brief',
  '- T-001.research.notes → T-003.brief',
  '超时与重试：',
  '- T-001 超时 600s · 重试 2',
  '结论：编排可执行，未启动任何会话'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：A-1/A-13 的 doc-fanout（含裁-15 的节点级 wake_allow 一行）---
    writeDocFanout(root);
    c.noteFixture('预置附录 A-1/A-13 的 doc-fanout（writeDocFanout：A-1 逐字 + T-001 节点级 wake_allow: [writer, editor]，裁-15/R-11）', '');

    // --- When ①：全量 validate（Then 的「4 个」）+ scoped 旁证 ---
    const val = c.cmd(workflowValidate(root), 'orch workflow validate');
    const valRows = nonEmptyLines(clean(text(val)));
    c.evText('validate-all', text(val));
    c.eq('Then 校验退出码 0（全量：项目 1 + 内置 3 = 4 个，裁决 AC-63-1）', val.exitCode, 0);
    c.lineEq('Then 校验首行逐字（4 个：全部通过）', valRows[0], '校验工作流 4 个：全部通过');
    const valJson = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const valPayload = jsonOf(valJson);
    c.evJson('payload-validate', valPayload);
    c.eq('机检：counts.invalid === 0', valPayload?.counts?.invalid, 0);
    c.eq('机检：counts.assets === 4', valPayload?.counts?.assets, 4);
    const valScoped = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（scoped 旁证，裁决 AC-63-1）');
    c.evText('validate-scoped', text(valScoped));
    c.lineEq('裁决 AC-63-1 旁证：scoped 校验首行为 1 个口径', nonEmptyLines(clean(text(valScoped)))[0], '校验工作流 1 个：全部通过');

    // --- When ②：dry-run（文本 + json）---
    const dry = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout');
    const dryRows = nonEmptyLines(clean(text(dry)));
    c.evText('dry-run', text(dry));
    const dryJson = c.cmd(workflowDryRun(root, 'doc-fanout', ['--format', 'json']), 'orch workflow dry-run doc-fanout --format json');
    const dryPayload = jsonOf(dryJson);
    c.evJson('payload-dry-run', dryPayload);

    // --- Then：预演 16 行逐字 = 11 项原语逐项可见 ---
    c.eq('Then dry-run 退出码 0', dry.exitCode, 0);
    c.deepEq('Then 预演全文逐字（A-10；首行 + 11 项原语 + 结论行）', dryRows, DRY_RUN_LINES);
    // 11 项逐项落点（Then 原文列出的可见位置，逐条钉）
    c.lineEq('原语·顺序（层 1）', dryRows[1], DRY_RUN_LINES[1]);
    c.lineEq('原语·并行 fan-out/fan-in（层 2 并行组一行 + 汇合：all，F-19）', dryRows[2], DRY_RUN_LINES[2]);
    c.eq('原语·条件分支（标题 + 三行）', dryRows[6] === '条件分支：' && dryRows[7].startsWith('- ') && dryRows[8].startsWith('- ') && dryRows[9].startsWith('- '), true);
    c.lineEq('原语·人工节点（层 3）', dryRows[3], DRY_RUN_LINES[3]);
    c.lineEq('原语·子工作流（层 4）', dryRows[4], DRY_RUN_LINES[4]);
    c.lineEq('原语·升级（层 5）', dryRows[5], DRY_RUN_LINES[5]);
    c.eq('原语·终止（升级终点：T-005 无正向出边，条件分支与层行均无 T-005 作源）',
      dryRows.slice(7, 10).every((l) => !l.startsWith('- T-005 ')), true);
    c.lineEq('原语·超时 / 重试（超时与重试段一行）', dryRows[14], DRY_RUN_LINES[14]);
    c.eq('原语·字段映射（能力域 2 单列：两行映射）', dryRows[10] === '字段映射：' && dryRows[11].startsWith('- T-001.') && dryRows[12].startsWith('- T-001.'), true);
    c.lineEq('Then 末行逐字', dryRows[dryRows.length - 1], '结论：编排可执行，未启动任何会话');
    c.eq('机检：预演文本中 1 个子工作流 恰出现 1 次',
      dryRows.filter((l) => l.includes('1 个子工作流')).length, 1);
    c.eq('机检：层行 4. T-006 代码闭环（子工作流 code-loop · 2 节点） 存在',
      dryRows.includes('4. T-006 代码闭环（子工作流 code-loop · 2 节点）'), true);

    // --- When ③：show code-loop（回流循环与轮次上限的可见位置）---
    const show = c.cmd(workflowShow(root, 'code-loop'), 'orch workflow show code-loop');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show-code-loop', text(show));
    c.eq('Then show code-loop 退出码 0', show.exitCode, 0);
    c.eq('原语·回流循环 + 轮次上限（show 的回边一行）',
      showRows.includes('    T-002 → T-001 回流 · 轮次上限 2'), true);

    // --- 机检：dry-run json 四段齐全与计数 ---
    c.deepEq('机检：dry-run json 顶层恰 8 键', Object.keys(dryPayload ?? {}).sort(),
      ['branches', 'edgeCount', 'id', 'layers', 'mappings', 'name', 'nodeCount', 'policies']);
    c.eq('机检：nodeCount === 6', dryPayload?.nodeCount, 6);
    c.eq('机检：edgeCount === 7', dryPayload?.edgeCount, 7);
    for (const seg of ['layers', 'branches', 'mappings', 'policies']) {
      c.check(`机检：${seg} 段齐全（非空数组）`, Array.isArray(dryPayload?.[seg]) && dryPayload[seg].length > 0,
        `len=${dryPayload?.[seg]?.length}`);
    }
    c.deepEq('机检：branches[] 恰三键 from/to/when 且三行条件分支', (dryPayload?.branches ?? []).map((b) => `${b.from} → ${b.to} ${b.when}`),
      ['T-004 → T-006 human_approved', 'T-004 → T-005 human_rejected', 'T-006 → T-005 failed']);
    c.eq('机检：并行组行显示 汇合：all（join 缺省 all 时 fan-in 汇合条件用户可见，F-19）',
      dryRows.some((l) => l.includes('汇合：all')), true);

    // --- 机检：show code-loop json ---
    const showJson = c.cmd(workflowShow(root, 'code-loop', ['--format', 'json']), 'orch workflow show code-loop --format json');
    const showPayload = jsonOf(showJson);
    c.evJson('payload-show-code-loop', showPayload);
    c.eq('机检：show code-loop 退出码 0', showJson.exitCode, 0);
    c.eq('机检：edges[1].kind === backflow', showPayload?.edges?.[1]?.kind, 'backflow');
    c.eq('机检：nodes 中存在 maxRounds === 2', (showPayload?.nodes ?? []).some((n) => n.maxRounds === 2), true);

    return finish(c);
  }
}];
