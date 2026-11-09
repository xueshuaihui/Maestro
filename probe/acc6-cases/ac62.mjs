// AC-62 node_type 四类取值异常与子工作流引用 / 跨工作流环（异常路径 + 机检）
// Given：bad-type（node_type: script）/ esc-no-title（escalate 缺 title）/ sub-no-wf（subworkflow 缺 workflow）/
//        sub-ghost（workflow: ghost）/ sub-a 与 sub-b（互相引用成环）——六份文件 id 均与文件名一致。
// Then：四类原因码各至少一行、明细逐字；机检：errors[0].file === workflows/bad-type.yaml。
import {
  makeCase, freshRoot, workflowValidate, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-62';

/** 单节点工作流骨架（nodes/edges 由调用方给）。 */
function singleNode(id, name, nodeLines, edgeLines = []) {
  return [
    'schema: workflow/v1',
    `id: ${id}`,
    `name: ${name}`,
    'entry: T-001',
    'terminal: T-001',
    'nodes:',
    ...nodeLines,
    ...(edgeLines.length ? ['edges:', ...edgeLines] : []),
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

    // --- Given：六份坏工作流（id 与文件名一致）---
    writeWorkflow(root, 'bad-type', singleNode('bad-type', '坏类型', [
      '  - id: T-001',
      '    node_type: script',
      '    title: 坏类型'
    ]));
    writeWorkflow(root, 'esc-no-title', singleNode('esc-no-title', '升级缺标题', [
      '  - id: T-001',
      '    node_type: escalate'
    ]));
    writeWorkflow(root, 'sub-no-wf', singleNode('sub-no-wf', '子流程缺引用', [
      '  - id: T-001',
      '    node_type: subworkflow',
      '    title: 子流程'
    ]));
    writeWorkflow(root, 'sub-ghost', singleNode('sub-ghost', '子流程不存在', [
      '  - id: T-001',
      '    node_type: subworkflow',
      '    workflow: ghost',
      '    title: 子流程'
    ]));
    writeWorkflow(root, 'sub-a', singleNode('sub-a', '子甲', [
      '  - id: T-1',
      '    node_type: subworkflow',
      '    workflow: sub-b',
      '    title: 引乙'
    ]));
    writeWorkflow(root, 'sub-b', singleNode('sub-b', '子乙', [
      '  - id: T-1',
      '    node_type: subworkflow',
      '    workflow: sub-a',
      '    title: 引甲'
    ]));
    c.noteFixture('预置六份坏工作流 bad-type / esc-no-title / sub-no-wf / sub-ghost / sub-a / sub-b（sub-a↔sub-b 跨工作流成环；全部 id 与文件名一致）', '');

    // --- When：validate 全量（文本 + json）---
    const res = c.cmd(workflowValidate(root), 'orch workflow validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate-text', text(res));
    const resJson = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const payload = jsonOf(resJson);
    c.evJson('payload', payload);
    const errors = payload?.errors ?? [];

    // --- Then：退出 1；四类原因码各至少一行，明细逐字 ---
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_NODE_TYPE_INVALID（明细逐字含 合法取值清单）', text(res),
      '节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）');
    const detailText = clean(text(res));
    c.eq('Then 报 WORKFLOW_NODE_FIELD_MISSING：缺 title 与 workflow 两类',
      detailText.includes('缺少必填字段：title（WORKFLOW_NODE_FIELD_MISSING）') &&
      detailText.includes('缺少必填字段：workflow（WORKFLOW_NODE_FIELD_MISSING）'), true);
    c.includes('Then 报 WORKFLOW_SUB_UNKNOWN（明细含 ghost）', detailText,
      '引用的子工作流不存在：ghost（WORKFLOW_SUB_UNKNOWN）');
    c.includes('Then 报 WORKFLOW_SUB_CYCLE（明细给出 sub-a / sub-b 的环）', detailText,
      '子工作流成环：');
    const cycleRow = rows.find((l) => l.includes('WORKFLOW_SUB_CYCLE')) ?? '';
    c.check('Then SUB_CYCLE 明细给出 sub-a 与 sub-b 的环', cycleRow.includes('sub-a') && cycleRow.includes('sub-b'), cycleRow);

    // --- 机检 ---
    const codes = errors.map((e) => e.code);
    for (const code of ['WORKFLOW_NODE_TYPE_INVALID', 'WORKFLOW_NODE_FIELD_MISSING', 'WORKFLOW_SUB_UNKNOWN', 'WORKFLOW_SUB_CYCLE']) {
      c.eq(`机检：errors.map(code) 去重后含 ${code}`, [...new Set(codes)].includes(code), true);
    }
    c.eq('机检：errors[0].file === workflows/bad-type.yaml（按文件名字典序）', errors[0]?.file, 'workflows/bad-type.yaml');
    c.includes('机检：errors[0].detail 含 合法取值清单', errors[0]?.detail ?? '', '合法取值：role / human / escalate / subworkflow');
    c.eq('机检：counts.invalid === 6（六份坏文件各计 1）', payload?.counts?.invalid, 6);
    c.eq('机检：counts.assets === 9（内置 3 + 项目 6）', payload?.counts?.assets, 9);
    c.eq('机检：counts.builtin === 3', payload?.counts?.builtin, 3);

    return finish(c);
  }
}];
