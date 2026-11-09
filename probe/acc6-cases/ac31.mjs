// AC-31 契约不连通的工作流被拒绝（规划验收；机检 + 用户可见）
// Given：doc-fanout 的 T-002.inputs 改成 [brief, outline]，没有任何边提供 outline。
// 先报 WORKFLOW_MAPPING_INCOMPLETE；把映射补上后同一命令全部通过。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, readText, writeWorkflow
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-31';

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

    // Given：T-002.inputs [brief] → [brief, outline]（只改 T-002 那处）
    const before = readText(file) ?? '';
    const broken = before.replace('    scope: draft-a\n    inputs: [brief]', '    scope: draft-a\n    inputs: [brief, outline]');
    c.check('夹具自检：T-002 inputs 已改为 [brief, outline]', broken.includes('inputs: [brief, outline]'), 'replace applied');
    fs.writeFileSync(file, broken, 'utf8');
    c.noteFixture('把 T-002.inputs 改成 [brief, outline]（无任何边提供 outline）', '');

    // When：orch workflow validate doc-fanout
    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate-broken', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_MAPPING_INCOMPLETE', text(res), '（WORKFLOW_MAPPING_INCOMPLETE）');
    c.includes('Then 明细为 T-002 的输入 outline 没有来源', clean(text(res)), 'T-002 的输入 outline 没有来源');

    // 机检：失败时 errors[0]
    const bad = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json');
    const badPayload = jsonOf(bad);
    c.evJson('payload-broken', badPayload);
    c.eq('机检：errors[0].code === WORKFLOW_MAPPING_INCOMPLETE', badPayload?.errors?.[0]?.code, 'WORKFLOW_MAPPING_INCOMPLETE');
    c.includes('机检：errors[0].detail 含 outline', badPayload?.errors?.[0]?.detail ?? '', 'outline');

    // Then（后半）：把映射补上后同一命令全部通过
    const fixed = (readText(file) ?? '').replace(
      '        to: brief\n  - from: T-001\n    to: T-003',
      '        to: brief\n      - from: T-001.research.notes\n        to: outline\n  - from: T-001\n    to: T-003'
    );
    c.check('夹具自检：outline 映射已补上', fixed.includes('to: outline'), 'replace applied');
    fs.writeFileSync(file, fixed, 'utf8');
    c.noteFixture('在 T-001→T-002 的 map 补一条 {from: T-001.research.notes, to: outline}', '');
    const fix = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout（补映射后）');
    c.evText('validate-fixed', text(fix));
    c.eq('Then 补上映射后退出 0', fix.exitCode, 0);
    c.includes('Then 补上映射后全部通过', clean(text(fix)), '全部通过');

    // 机检：补上后 counts.invalid === 0
    const good = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json（补映射后）');
    const goodPayload = jsonOf(good);
    c.evJson('payload-fixed', goodPayload);
    c.eq('机检：补上后 counts.invalid === 0', goodPayload?.counts?.invalid, 0);

    return finish(c);
  }
}];
