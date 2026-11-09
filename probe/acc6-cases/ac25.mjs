// AC-25 非法节点类型与类型必填字段被拒（机检 + 用户可见）
// Given：bad-type.yaml（node_type: script）、no-title.yaml（human 无 title）、no-role.yaml（role 无 role）。
import {
  makeCase, freshRoot, workflowValidate, jsonOf, writeWorkflow,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-25';
const mk = (id, name, nodeLines) => [
  'schema: workflow/v1',
  `id: ${id}`,
  `name: ${name}`,
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  ...nodeLines,
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
    writeWorkflow(root, 'bad-type', mk('bad-type', '坏类型', ['    node_type: script']));
    writeWorkflow(root, 'no-title', mk('no-title', '缺标题', ['    node_type: human']));
    writeWorkflow(root, 'no-role', mk('no-role', '缺角色', ['    node_type: role']));
    c.noteFixture('预置 bad-type.yaml / no-title.yaml / no-role.yaml（各自单节点、entry=terminal=T-001）', '');

    // When：orch workflow validate（全量）
    const res = c.cmd(workflowValidate(root), 'orch workflow validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));

    // Then：三条错误 + 退出 1
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好四行（计数头 + 三条错误）', rows.length, 4);
    c.includes('Then 明细列出四个合法类型', text(res), '合法取值：role / human / escalate / subworkflow');
    c.matches('Then no-title 明细含 title', text(res), /缺少必填字段：title/);
    c.matches('Then no-role 明细含 role', text(res), /缺少必填字段：role/);

    // 机检：errors.map(code) 排序后等于三个专属码；errors[0].file 是 workflows/bad-type.yaml
    const json = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    const codes = (payload?.errors ?? []).map((e) => e.code);
    c.deepEq('机检：codes 排序后', [...codes].sort(),
      ['WORKFLOW_NODE_FIELD_MISSING', 'WORKFLOW_NODE_FIELD_MISSING', 'WORKFLOW_NODE_TYPE_INVALID']);
    c.eq('机检：errors[0].file === workflows/bad-type.yaml', payload?.errors?.[0]?.file, 'workflows/bad-type.yaml');
    c.eq('机检：errors[0].code === WORKFLOW_NODE_TYPE_INVALID', payload?.errors?.[0]?.code, 'WORKFLOW_NODE_TYPE_INVALID');
    c.eq('机检：counts.assets === 6（内置 3 + 项目 3）', payload?.counts?.assets, 6);
    c.eq('机检：counts.invalid === 3', payload?.counts?.invalid, 3);

    return finish(c);
  }
}];
