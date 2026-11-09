// AC-28 条件分支可表达并在预演中逐条列出（机检 + 用户可见）
// 夹具：writeDocFanout()（裁-15）。A-10 条件段三行逐字 + JSON branches 三键。
import {
  makeCase, freshRoot, workflowDryRun, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { writeDocFanout } from './_fixtures.mjs';

const AC = 'AC-28';
const BRANCH_LINES = [
  '- T-004 → T-006 当 人工通过',
  '- T-004 → T-005 当 人工驳回',
  '- T-006 → T-005 当 判定不通过'
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

    // When：orch workflow dry-run doc-fanout
    const res = c.cmd(workflowDryRun(root, 'doc-fanout'), 'orch workflow dry-run doc-fanout');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('dry-run', text(res));

    // Then：条件分支：段 + 三行逐字
    c.eq('Then dry-run 退出码 0', res.exitCode, 0);
    const headIdx = rows.findIndex((l) => l === '条件分支：');
    c.matches('Then 输出含 条件分支： 段', clean(text(res)), /条件分支：/);
    c.deepEq('Then 条件段三行逐字（A-10）', headIdx >= 0 ? rows.slice(headIdx + 1, headIdx + 4) : [], BRANCH_LINES);

    // 机检：预演 JSON 的 branches
    const json = c.cmd(workflowDryRun(root, 'doc-fanout', ['--format', 'json']), 'orch workflow dry-run doc-fanout --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：branches 长度 3', (payload?.branches ?? []).length, 3);
    const keySets = (payload?.branches ?? []).map((b) => Object.keys(b).sort().join(','));
    c.eq('机检：每个分支恰 from/to/when 三键', [...new Set(keySets)].join('|'), 'from,to,when');
    const whens = (payload?.branches ?? []).map((b) => b.when).sort();
    c.deepEq('机检：when 集合', whens, ['failed', 'human_approved', 'human_rejected']);
    c.deepEq('机检：branches 全文（A-10 序）', payload?.branches, [
      { from: 'T-004', to: 'T-006', when: 'human_approved' },
      { from: 'T-004', to: 'T-005', when: 'human_rejected' },
      { from: 'T-006', to: 'T-005', when: 'failed' }
    ]);

    return finish(c);
  }
}];
