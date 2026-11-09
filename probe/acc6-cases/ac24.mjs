// AC-24 四类节点齐备的工作流校验通过（机检 + 用户可见）
// 裁-13（decisions.md 第十二节 / R-9）：AC-24 的 When 参数 `doc-fanout` 为笔误，
// S3 按全量 `orch workflow validate`（无 id）执行 → `校验工作流 4 个：全部通过` + counts.assets===4。
// 夹具：writeDocFanout()（裁-15：T-001 节点级 wake_allow: [writer, editor]）。
import {
  makeCase, freshRoot, workflowValidate, workflowShow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-24';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    const file = writeDocFanout(root);
    c.noteFixture('预置附录 A-1/A-13 的 doc-fanout（writeDocFanout，含 T-001 节点级 wake_allow）', readText(file) ?? '');

    // When：orch workflow validate（全量，裁-13）
    const res = c.cmd(workflowValidate(root), 'orch workflow validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));

    // Then：校验工作流 4 个：全部通过，退出码 0（T-005 升级终点无出边不算不可达，BR-35）
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 恰好一行', rows.length, 1);
    c.lineEq('Then 该行逐字', rows[0], '校验工作流 4 个：全部通过');

    // 机检：--format json 的 counts
    const json = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：counts.invalid === 0', payload?.counts?.invalid, 0);
    c.eq('机检：counts.assets === 4', payload?.counts?.assets, 4);
    c.eq('机检：counts.builtin === 3', payload?.counts?.builtin, 3);
    c.eq('机检：counts.project === 1', payload?.counts?.project, 1);

    // 机检：workflow show doc-fanout --format json 的 nodeType 去重集合与 T-006 的 workflow 键
    const show = c.cmd(workflowShow(root, 'doc-fanout', ['--format', 'json']), 'orch workflow show doc-fanout --format json');
    const showPayload = jsonOf(show);
    c.evJson('show-payload', showPayload);
    const nodeTypes = [...new Set((showPayload?.nodes ?? []).map((n) => n.nodeType))].sort();
    c.deepEq('机检：nodeType 去重集合', nodeTypes, ['escalate', 'human', 'role', 'subworkflow']);
    const t006 = (showPayload?.nodes ?? []).find((n) => n.id === 'T-006');
    c.eq('机检：T-006 多一个 workflow 键且值 code-loop', t006?.workflow, 'code-loop');
    const othersWithWorkflow = (showPayload?.nodes ?? []).filter((n) => n.id !== 'T-006' && 'workflow' in n);
    c.eq('机检：非 subworkflow 节点不带 workflow 键', othersWithWorkflow.length, 0);
    c.eq('机检：T-006 键数 = 11 + workflow', Object.keys(t006 ?? {}).length, 12);

    return finish(c);
  }
}];
