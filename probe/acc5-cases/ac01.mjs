// AC-01 内置角色全表可列出（用户可见 + 机检）
import {
  makeCase, freshRoot, roleList, jsonOf, text, nonEmptyLines, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { FULL_LIST, GROUPS, listHeader, LIST_ROWS } from './_baselines.mjs';

const AC = 'AC-01';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    const res = c.cmd(roleList(root), 'orch role list');
    const rows = nonEmptyLines(text(res));
    c.evText('list', text(res));

    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行 = 角色 16 个（内置 16 · 项目 0）', rows[0], listHeader());
    c.deepEq('Then 随后 16 行逐字（A-2）', rows.slice(1), LIST_ROWS);
    c.eq('机检：总行数 17', rows.length, 17);

    // 分组按「通用协调 → 研究分析 → 内容创作 → 编码工程 → 业务运营」，同组内按 id 字典序
    const groupOrder = rows.slice(1).map((line) => line.split(' · ')[1]);
    const expectedGroups = GROUPS.flatMap((g) => {
      const label = { coordinator: '通用协调', research: '研究分析', writing: '内容创作', coding: '编码工程', ops: '业务运营' }[g];
      return LIST_ROWS.filter((r) => r.split(' · ')[1] === label).map(() => label);
    });
    c.deepEq('And 分组按五组顺序排列（同组内 id 字典序由逐字比对保证）', groupOrder, expectedGroups);

    const jsonRes = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.eq('机检：roles 数组长度 16', payload?.roles?.length, 16);
    c.eq('机检：counts.total 为 16', payload?.counts?.total, 16);
    c.eq('机检：counts.builtin 为 16', payload?.counts?.builtin, 16);

    return finish(c);
  }
}];
