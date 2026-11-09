// AC-26 子工作流引用必须存在且不得成环（机检 + 用户可见）
// Given：sub-ghost.yaml（subworkflow + workflow: ghost）与 sub-self.yaml（workflow: sub-self 自引用）。
import {
  makeCase, freshRoot, workflowValidate, jsonOf, writeWorkflow,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-26';
const mk = (id, name, subId) => [
  'schema: workflow/v1',
  `id: ${id}`,
  `name: ${name}`,
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: subworkflow',
  `    workflow: ${subId}`,
  '    title: 子工作流节点',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    writeWorkflow(root, 'sub-ghost', mk('sub-ghost', '幽灵引用', 'ghost'));
    writeWorkflow(root, 'sub-self', mk('sub-self', '自环', 'sub-self'));
    c.noteFixture('预置 sub-ghost.yaml（workflow: ghost）与 sub-self.yaml（workflow: sub-self）', '');

    // When：orch workflow validate（全量）
    const res = c.cmd(workflowValidate(root), 'orch workflow validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));

    // Then：两条错误 + 退出 1
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好三行（计数头 + 两条错误）', rows.length, 3);
    c.includes('Then SUB_UNKNOWN 明细含 ghost', text(res), '引用的子工作流不存在：ghost');
    c.includes('Then SUB_CYCLE 明细含 sub-self', text(res), '子工作流成环：sub-self');

    // 机检：codes 排序后等于两个专属码
    const json = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    const codes = (payload?.errors ?? []).map((e) => e.code);
    c.deepEq('机检：codes 排序后', [...codes].sort(), ['WORKFLOW_SUB_CYCLE', 'WORKFLOW_SUB_UNKNOWN']);
    c.eq('机检：errors[0].file 是 sub-ghost（文件名字典序在前）', payload?.errors?.[0]?.file, 'workflows/sub-ghost.yaml');
    c.eq('机检：counts.invalid === 2', payload?.counts?.invalid, 2);

    return finish(c);
  }
}];
