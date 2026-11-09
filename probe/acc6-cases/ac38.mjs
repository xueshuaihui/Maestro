// AC-38 工作流校验的文本与 JSON 一致（机检 + 用户可见）
// Given：全新项目根（只有内置三张图）。
import {
  makeCase, freshRoot, workflowValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-38';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（只有内置三张图）', root);

    // When：orch workflow validate（文本）
    const res = c.cmd(workflowValidate(root), 'orch workflow validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));

    // Then：恰好一行 校验工作流 3 个：全部通过、退出 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 恰好一行', rows.length, 1);
    c.lineEq('Then 该行逐字', rows[0], '校验工作流 3 个：全部通过');

    // When：orch workflow validate --format json
    const json = c.cmd(workflowValidate(root, ['--format', 'json']), 'orch workflow validate --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);

    // Then：JSON 顶层恰两键 counts/errors
    c.eq('Then JSON 退出码 0', json.exitCode, 0);
    c.deepEq('Then JSON 顶层恰两键', Object.keys(payload ?? {}).sort(), ['counts', 'errors']);

    // 机检：counts 恰 4 键 + 四项取值 + errors 为空
    c.deepEq('机检：counts 恰 4 键', Object.keys(payload?.counts ?? {}).sort(), ['assets', 'builtin', 'invalid', 'project']);
    c.eq('机检：counts.assets === 3', payload?.counts?.assets, 3);
    c.eq('机检：counts.builtin === 3', payload?.counts?.builtin, 3);
    c.eq('机检：counts.project === 0', payload?.counts?.project, 0);
    c.eq('机检：counts.invalid === 0', payload?.counts?.invalid, 0);
    c.deepEq('机检：errors 为空数组', payload?.errors, []);

    // 机检：文本与 JSON 一致（全量计数 3 = assets；JSON 无错误对应文本无错误行）
    c.eq('机检：文本行数与 counts.invalid 一致（0 条错误行）',
      rows.filter((l) => l.startsWith('- ')).length, payload?.counts?.invalid ?? -1);

    return finish(c);
  }
}];
