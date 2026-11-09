// AC-34 并行组内作用域不得重复（机检 + 用户可见）
// 两段：① T-002/T-003 的 scope 都改成 draft → WORKFLOW_SCOPE_OVERLAP；
// ② 并行组 draft 只剩一个节点（去掉 T-003 的 parallel_scope）→ WORKFLOW_SCOPE_INVALID。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-34';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    const file = writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // 第一段：T-002 与 T-003 的 scope 都改成 draft
    const overlap = (readText(file) ?? '')
      .replace('    scope: draft-a', '    scope: draft')
      .replace('    scope: draft-b', '    scope: draft');
    c.check('夹具自检：两处 scope 均已改为 draft', (overlap.match(/    scope: draft\n/g) ?? []).length >= 2, 'replace applied');
    fs.writeFileSync(file, overlap, 'utf8');
    c.noteFixture('把 T-002 与 T-003 的 scope 都改成 draft', '');

    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（scope 重复）');
    c.evText('validate-overlap', text(res));
    c.eq('Then 第一段退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_SCOPE_OVERLAP', text(res), '（WORKFLOW_SCOPE_OVERLAP）');
    c.includes('Then 明细同时含 T-002/T-003/draft', clean(text(res)), '并行组 draft 内的 T-002 与 T-003 使用了同一作用域 draft');

    const overlapJson = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（scope 重复）');
    const overlapPayload = jsonOf(overlapJson);
    c.evJson('payload-overlap', overlapPayload);
    c.eq('机检：第一段 errors[0].code', overlapPayload?.errors?.[0]?.code, 'WORKFLOW_SCOPE_OVERLAP');

    // 第二段：并行组 draft 只剩一个节点（去掉 T-003 的 parallel_scope）
    const single = (readText(file) ?? '').replace('    title: 撰写B\n    parallel_scope: draft', '    title: 撰写B');
    c.check('夹具自检：T-003 的 parallel_scope 已去掉', !single.includes('    parallel_scope: draft\n    scope: draft\n    inputs: [brief]\n  - id: T-004'), 'replace applied');
    fs.writeFileSync(file, single, 'utf8');
    c.noteFixture('去掉 T-003 的 parallel_scope（并行组 draft 只剩 T-002）', '');

    const res2 = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（并行组只剩一个节点）');
    c.evText('validate-invalid', text(res2));
    c.eq('Then 第二段退出码 1', res2.exitCode, 1);
    c.includes('Then 改报 WORKFLOW_SCOPE_INVALID', text(res2), '（WORKFLOW_SCOPE_INVALID）');

    const singleJson = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（并行组只剩一个节点）');
    const singlePayload = jsonOf(singleJson);
    c.evJson('payload-invalid', singlePayload);
    c.eq('机检：第二段 errors[0].code', singlePayload?.errors?.[0]?.code, 'WORKFLOW_SCOPE_INVALID');
    c.includes('机检：第二段明细', singlePayload?.errors?.[0]?.detail ?? '', '并行组 draft 只有 1 个节点');

    return finish(c);
  }
}];
