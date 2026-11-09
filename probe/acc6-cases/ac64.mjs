// AC-64 可达性终态定义：human / escalate 也是终点（边界 + 机检）
// Given：human-end（T-END role 终点 + T-H human 无出边）/ escalate-end（同结构、T-E escalate）/
//        no-end（换成普通 role 节点 T-R，无出边且不在 terminal）。三条工作流所有节点从入口可达。
import {
  makeCase, freshRoot, workflowValidate, workflowShow, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-64';

/** 三节点骨架：T-001（researcher）→ T-END（writer，terminal）与 → <side 节点>（无出边）。 */
function threeNodes(id, name, sideNodeTitle, sideNodeLines) {
  return [
    'schema: workflow/v1',
    `id: ${id}`,
    `name: ${name}`,
    'entry: T-001',
    'terminal: T-END',
    'nodes:',
    '  - id: T-001',
    '    node_type: role',
    '    role: researcher',
    '    title: 研究',
    '  - id: T-END',
    '    node_type: role',
    '    role: writer',
    '    title: 完成',
    ...sideNodeLines,
    'edges:',
    '  - from: T-001',
    '    to: T-END',
    `  - from: T-001`,
    `    to: ${sideNodeTitle.split(' ')[0]}`,
    ''
  ].join('\n');
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：三条工作流（id 与文件名一致；researcher → writer 由 D-7b 对齐覆盖唤醒）---
    writeWorkflow(root, 'human-end', threeNodes('human-end', '人工终点', 'T-H', [
      '  - id: T-H',
      '    node_type: human',
      '    title: 人工确认'
    ]));
    writeWorkflow(root, 'escalate-end', threeNodes('escalate-end', '升级终点', 'T-E', [
      '  - id: T-E',
      '    node_type: escalate',
      '    title: 升级'
    ]));
    writeWorkflow(root, 'no-end', threeNodes('no-end', '无终态', 'T-R', [
      '  - id: T-R',
      '    node_type: role',
      '    role: writer',
      '    title: 死端'
    ]));
    c.noteFixture('预置 human-end / escalate-end / no-end 三条工作流（T-001 → T-END 与 → 侧节点；T-H 人工、T-E 升级、T-R 普通 role 无出边且不在 terminal）', '');

    // --- When / Then：前两次 全部通过、退出 0 ---
    for (const id of ['human-end', 'escalate-end']) {
      const res = c.cmd(workflowValidate(root, [id]), `orch workflow validate ${id}`);
      const rows = nonEmptyLines(clean(text(res)));
      c.evText(`validate-${id}`, text(res));
      c.eq(`Then ${id} 退出码 0`, res.exitCode, 0);
      c.lineEq(`Then ${id} 首行逐字（human / escalate 天然是终态）`, rows[0], '校验工作流 1 个：全部通过');
      const jsonRes = c.cmd(workflowValidate(root, [id, '--format', 'json']), `orch workflow validate ${id} --format json`);
      const payload = jsonOf(jsonRes);
      c.evJson(`payload-${id}`, payload);
      c.eq(`机检：${id} counts.invalid === 0`, payload?.counts?.invalid, 0);
    }

    // --- When / Then：no-end 报 WORKFLOW_UNREACHABLE、明细 节点不可达：T-R、退出 1 ---
    const bad = c.cmd(workflowValidate(root, ['no-end']), 'orch workflow validate no-end');
    const badRows = nonEmptyLines(clean(text(bad)));
    c.evText('validate-no-end', text(bad));
    c.eq('Then no-end 退出码 1', bad.exitCode, 1);
    c.eq('Then no-end 首行 1 个不合法', badRows[0], '校验工作流 1 个：1 个不合法');
    c.lineEq('Then no-end 错误行逐字（A-15：节点不可达：{node}）', badRows[1],
      '- workflows/no-end.yaml：节点不可达：T-R（WORKFLOW_UNREACHABLE）');
    const badJson = c.cmd(workflowValidate(root, ['no-end', '--format', 'json']), 'orch workflow validate no-end --format json');
    const badPayload = jsonOf(badJson);
    c.evJson('payload-no-end', badPayload);
    c.eq('机检：no-end errors[0].code === WORKFLOW_UNREACHABLE', badPayload?.errors?.[0]?.code, 'WORKFLOW_UNREACHABLE');
    c.includes('机检：no-end errors[0].detail 含 T-R', badPayload?.errors?.[0]?.detail ?? '', 'T-R');

    // --- 机检：show human-end 的 nodes 里 T-H 的 nodeType === human ---
    const show = c.cmd(workflowShow(root, 'human-end', ['--format', 'json']), 'orch workflow show human-end --format json');
    const showPayload = jsonOf(show);
    c.evJson('payload-show-human-end', showPayload);
    c.eq('机检：show human-end 退出码 0', show.exitCode, 0);
    const th = (showPayload?.nodes ?? []).find((n) => n.id === 'T-H');
    c.eq('机检：nodes 里 T-H 的 nodeType === human', th?.nodeType, 'human');

    return finish(c);
  }
}];
