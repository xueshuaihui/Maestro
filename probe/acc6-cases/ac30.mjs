// AC-30 字段映射可表达并可核对（机检 + 用户可见）
// 夹具：writeDocFanout()（裁-15）。A-10 字段映射段两行逐字 + JSON mappings 恰 3 键。
import {
  makeCase, freshRoot, workflowValidate, workflowDryRun, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-30';
const MAP_LINES = [
  '- T-001.research.notes → T-002.brief',
  '- T-001.research.notes → T-003.brief'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    writeDocFanout(root);
    c.noteFixture('预置附录 A-13 的 doc-fanout（writeDocFanout）', '');

    // 先自证 validate 全通过（裁-15：先 validate 再断言 dry-run）
    const val = c.cmd(workflowValidate(root, ['doc-fanout']), 'orch workflow validate doc-fanout');
    c.evText('validate', text(val));
    c.eq('自证：validate doc-fanout 全部通过', val.exitCode === 0 && clean(text(val)).includes('全部通过'), true);

    // When：orch workflow dry-run doc-fanout
    const res = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('dry-run', text(res));

    // Then：字段映射：段 + 两行逐字
    c.eq('Then dry-run 退出码 0', res.exitCode, 0);
    const headIdx = rows.findIndex((l) => l === '字段映射：');
    c.matches('Then 输出含 字段映射： 段', clean(text(res)), /字段映射：/);
    c.deepEq('Then 映射段两行逐字（A-10）', headIdx >= 0 ? rows.slice(headIdx + 1, headIdx + 3) : [], MAP_LINES);

    // 机检：预演 JSON 的 mappings
    const json = c.cmd(workflowDryRun(root, 'doc-fanout', ['--format', 'json']), 'orch workflow dry-run doc-fanout --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：mappings 长度 2', (payload?.mappings ?? []).length, 2);
    const keySets = (payload?.mappings ?? []).map((m) => Object.keys(m).sort().join(','));
    c.eq('机检：每个映射恰 from/to/edge 三键', [...new Set(keySets)].join('|'), 'edge,from,to');
    c.eq('机检：mappings[0].from === T-001.research.notes', payload?.mappings?.[0]?.from, 'T-001.research.notes');
    c.deepEq('机检：mappings 全文（A-10 序）', payload?.mappings, [
      { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-002' },
      { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-003' }
    ]);

    return finish(c);
  }
}];
