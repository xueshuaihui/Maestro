// AC-32 可达性（机检 + 用户可见）
// Given：doc-fanout 追加一个谁都不指向的节点 T-007（node_type: role、role: tester）。
import fs from 'node:fs';
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-32';

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

    // Given：追加 T-007（谁都不指向它）
    const broken = (readText(file) ?? '').replace(
      'edges:',
      '  - id: T-007\n    node_type: role\n    role: tester\n    title: 孤儿\nedges:'
    );
    c.check('夹具自检：T-007 已追加', broken.includes('id: T-007'), 'replace applied');
    fs.writeFileSync(file, broken, 'utf8');
    c.noteFixture('追加节点 T-007（node_type: role、role: tester，无任何边指向）', '');

    // When：orch workflow validate doc-fanout
    const res = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 报 WORKFLOW_UNREACHABLE', text(res), '（WORKFLOW_UNREACHABLE）');
    c.includes('Then 明细含 T-007', clean(text(res)), '节点不可达：T-007');

    // 机检：errors[0]
    const json = c.cmd(workflowValidate(root, ['doc-fanout', '--format', 'json']), 'orch workflow validate doc-fanout --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：errors[0].code === WORKFLOW_UNREACHABLE', payload?.errors?.[0]?.code, 'WORKFLOW_UNREACHABLE');
    c.includes('机检：errors[0].detail 含 T-007', payload?.errors?.[0]?.detail ?? '', 'T-007');
    c.eq('机检：counts.invalid === 1', payload?.counts?.invalid, 1);

    return finish(c);
  }
}];
