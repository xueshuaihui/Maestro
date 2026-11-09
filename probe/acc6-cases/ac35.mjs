// AC-35 变量引用无效（机检 + 用户可见）
// Given：doc-fanout 的 T-001→T-002 映射改成 from: T-003.research.notes（T-003 不是该边的上游）。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-35';

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

    // Given：T-001→T-002 的 map.from 改成 T-003.research.notes
    const broken = (readText(file) ?? '').replace(
      '      - from: T-001.research.notes\n        to: brief\n  - from: T-001\n    to: T-003',
      '      - from: T-003.research.notes\n        to: brief\n  - from: T-001\n    to: T-003'
    );
    c.check('夹具自检：map.from 已改为 T-003.research.notes', broken.includes('from: T-003.research.notes'), 'replace applied');
    fs.writeFileSync(file, broken, 'utf8');
    c.noteFixture('把 T-001→T-002 的映射改成 from: T-003.research.notes', '');

    // When：orch workflow validate doc-fanout
    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_VAR_UNKNOWN', text(res), '（WORKFLOW_VAR_UNKNOWN）');
    c.includes('Then 明细含 T-003.research.notes', clean(text(res)), '变量引用无法解析：T-003.research.notes');

    // 机检：errors[0]
    const json = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：errors[0].code === WORKFLOW_VAR_UNKNOWN', payload?.errors?.[0]?.code, 'WORKFLOW_VAR_UNKNOWN');
    c.includes('机检：errors[0].detail 含 T-003.research.notes', payload?.errors?.[0]?.detail ?? '', 'T-003.research.notes');
    c.eq('机检：counts.invalid === 1', payload?.counts?.invalid, 1);

    return finish(c);
  }
}];
