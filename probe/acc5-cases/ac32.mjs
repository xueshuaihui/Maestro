// AC-32 --group 只列该组（用户可见 + 机检）
import {
  makeCase, freshRoot, roleList, jsonOf, text, nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { LIST_ROWS, listHeader } from './_baselines.mjs';

const AC = 'AC-32';

const CODING = LIST_ROWS.filter((line) => line.includes(' · 编码工程 · '));

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // When
    const res = c.cmd(roleList(root, ['--group', 'coding']), 'orch role list --group coding');
    const rows = nonEmptyLines(text(res));
    c.evText('list', text(res));

    // Then
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行是「角色 3 个（内置 3 · 项目 0）」', rows[0], listHeader({ total: 3, builtin: 3, project: 0 }));
    c.deepEq('Then 随后 3 行都是编码工程组（code-reviewer / developer / tester）', rows.slice(1), CODING);
    c.check('机检：3 行的分组名都是编码工程',
      rows.slice(1).every((line) => line.includes(' · 编码工程 · ')), JSON.stringify(rows.slice(1)));

    const jsonRes = c.cmd(roleList(root, ['--group', 'coding', '--format', 'json']), 'orch role list --group coding --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：groups 只有一个元素', payload?.groups?.length, 1);
    c.eq('机检：该元素 count === 3', payload?.groups?.[0]?.count, 3);
    c.eq('机检：roles 长度 3', payload?.roles?.length, 3);
    c.eq('机检：counts.total 为 3（--group 时只统计该组）', payload?.counts?.total, 3);

    return finish(c);
  }
}];
