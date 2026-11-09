// AC-17 五组各至少两个角色（用户可见 + 机检）
import {
  makeCase, freshRoot, roleList, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { GROUPS, GROUP_LABELS } from './_baselines.mjs';

const AC = 'AC-17';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    const res = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(res);
    c.evJson('payload', payload);

    const groups = payload?.groups ?? [];
    c.eq('Then groups 数组长度 5', groups.length, 5);
    c.deepEq('Then 取值依次为 coordinator / research / writing / coding / ops',
      groups.map((g) => g.group), GROUPS);
    c.deepEq('机检：五组计数分别为 5 / 3 / 3 / 3 / 2', groups.map((g) => g.count), [5, 3, 3, 3, 2]);
    c.check('Then 每组 count ≥ 2', groups.every((g) => g.count >= 2), JSON.stringify(groups.map((g) => g.count)));
    const sum = groups.reduce((n, g) => n + g.count, 0);
    c.eq('Then count 之和等于 counts.total', sum, payload?.counts?.total);
    c.deepEq('Then 每组 label 与 A-6 一致', groups.map((g) => g.label), GROUPS.map((g) => GROUP_LABELS[g]));

    return finish(c);
  }
}];
