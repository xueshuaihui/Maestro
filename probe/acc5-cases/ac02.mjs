// AC-02 角色详情给全契约（用户可见 + 机检）
import {
  makeCase, freshRoot, roleList, roleShow, text, nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { SHOW_DEVELOPER, LIST_ROWS } from './_baselines.mjs';

const AC = 'AC-02';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    const res = c.cmd(roleShow(root, 'developer'), 'orch role show developer');
    const rows = nonEmptyLines(text(res));
    c.evText('show', text(res));

    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('机检：行数恰好 6（不等于 6 即判不通过）', rows.length, 6);
    c.deepEq('Then 输出恰好是附录 A-3 的 6 行（逐字）', rows, SHOW_DEVELOPER);

    // 契约行与 list 中 developer 行逐字相同
    const list = c.cmd(roleList(root), 'orch role list');
    const devRow = nonEmptyLines(text(list)).find((line) => line.startsWith('- developer '));
    c.lineEq('Then 契约行与 role list 中 developer 行逐字相同', rows[0], devRow);
    c.eq('机检：list 里 developer 行也在 A-2 表中', devRow, LIST_ROWS[12]);

    c.includes('Then 来源行写「内置 assets/roles/developer.yaml」', rows[5], '来源：内置 assets/roles/developer.yaml');

    return finish(c);
  }
}];
