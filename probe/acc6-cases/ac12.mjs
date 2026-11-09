// AC-12 契约连通：输入没人给、输出没人要（机检 + 用户可见）
// 夹具说明：Given 只描述角色字段与「边上带 map: T-001.notes → notes」，未钉节点级 YAML。
// 按 D-3⑪（map.from 首字段必须在该节点 outputs 里）与裁-15 的节点级声明先例，工作流节点
// T-001 声明 outputs: [notes] / wake_allow: [scribe]，T-002 声明 inputs: [notes]——否则
// workflow solo 自身报 WORKFLOW_VAR_UNKNOWN / WORKFLOW_WAKE_DENIED，契约连通无从谈起。
// 输出形态说明：role validate 文本首行是计数头（I1.5 既有形态，AC-15 逐字钉过），Then 的
// 「恰好两行」按两条 `- ` 错误行计（与 AC-13「三条错误」同口径）。
import {
  makeCase, freshRoot, roleValidate, workflowValidate, writeRole, writeWorkflow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-12';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：scout（inputs [brief]、outputs [notes]）与 scribe（inputs [notes]、outputs [digest]）
    writeRole(root, 'scout', { id: 'scout', name: '侦察员', inputs: ['brief'], outputs: ['notes'] });
    writeRole(root, 'scribe', { id: 'scribe', name: '书记员', inputs: ['notes'], outputs: ['digest'] });
    // 工作流 solo：T-001（scout，入口）→ T-002（scribe，终点），边上带 map: T-001.notes → notes
    writeWorkflow(root, 'solo', [
      'schema: workflow/v1',
      'id: solo',
      'name: 两人接力',
      'entry: T-001',
      'terminal: T-002',
      'nodes:',
      '  - id: T-001',
      '    node_type: role',
      '    role: scout',
      '    title: 侦察',
      '    wake_allow: [scribe]',
      '    outputs: [notes]',
      '  - id: T-002',
      '    node_type: role',
      '    role: scribe',
      '    title: 记录',
      '    inputs: [notes]',
      'edges:',
      '  - from: T-001',
      '    to: T-002',
      '    map:',
      '      - from: T-001.notes',
      '        to: notes',
      ''
    ].join('\n'));
    c.noteFixture('预置 scout/scribe 与工作流 solo（T-001→T-002 带 map T-001.notes → notes；T-001 声明 outputs/wake_allow、T-002 声明 inputs，见文件头说明）', '');
    // 前置自证：solo 本身合法（否则契约连通无从谈起）
    const wv = c.cmd(workflowValidate(root), '（自证）orch workflow validate');
    c.eq('自证：workflow solo 合法（校验工作流 4 个）', wv.exitCode, 0);
    c.evText('workflow-validate', text(wv));

    // When：role validate（文本 + JSON）
    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(clean(text(res)));
    const errRows = rows.filter((l) => l.startsWith('- '));
    c.evText('validate-text', text(res));
    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);

    // Then：恰好两行 ROLE_CONTRACT_UNBOUND；notes 两边都不报
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 恰好两行错误（- 开头）', errRows.length, 2);
    c.lineEq('Then 错误行 1 逐字', errRows[0], '- roles/scout.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）');
    c.lineEq('Then 错误行 2 逐字', errRows[1], '- roles/scribe.yaml：契约不连通：digest 没有去处（ROLE_CONTRACT_UNBOUND）');
    c.notIncludes('Then notes 两边都不报（错误行 1）', errRows[0], 'notes');
    c.notIncludes('Then notes 两边都不报（错误行 2）', errRows[1], 'notes');

    // 机检：errors 结构与 file/detail 逐字段
    c.eq('机检：errors.length === 2', (payload?.errors ?? []).length, 2);
    c.deepEq('机检：errors.map(code) 全为 ROLE_CONTRACT_UNBOUND', [...new Set((payload?.errors ?? []).map((e) => e.code))], ['ROLE_CONTRACT_UNBOUND']);
    c.eq('机检：errors[0].file === roles/scout.yaml', payload?.errors?.[0]?.file, 'roles/scout.yaml');
    c.includes('机检：errors[0].detail 含 brief', payload?.errors?.[0]?.detail ?? '', 'brief');
    c.eq('机检：errors[1].file === roles/scribe.yaml', payload?.errors?.[1]?.file, 'roles/scribe.yaml');
    c.includes('机检：errors[1].detail 含 digest', payload?.errors?.[1]?.detail ?? '', 'digest');
    c.notIncludes('机检：errors[0].detail 不含 notes', payload?.errors?.[0]?.detail ?? '', 'notes');
    c.notIncludes('机检：errors[1].detail 不含 notes', payload?.errors?.[1]?.detail ?? '', 'notes');

    return finish(c);
  }
}];
