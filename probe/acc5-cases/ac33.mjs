// AC-33 --format json 键集合稳定（用户可见 + 机检）
import {
  makeCase, freshRoot, roleList, jsonOf, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { LIST_TOP_KEYS, ROLE_KEYS, GROUPS } from './_baselines.mjs';

const AC = 'AC-33';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const res = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(res);
    c.evJson('payload', payload);

    // Then
    c.deepEq('Then 顶层键恰好是 counts / groups / roles', Object.keys(payload ?? {}).sort(), LIST_TOP_KEYS);
    const roles = payload?.roles ?? [];
    c.eq('机检：角色对象 16 个', roles.length, 16);
    const expected = [...ROLE_KEYS].sort(); // A-6 的 10 个键（顺序不参与判定，集合参与）
    const keySets = roles.map((role) => Object.keys(role).sort());
    c.check('机检：每个角色对象的键集合都恰好是 A-6 的 10 个',
      keySets.every((keys) => JSON.stringify(keys) === JSON.stringify(expected)), JSON.stringify(keySets[0]));
    c.deepEq('机检：键集合排序后逐字比对（第 1 个角色）', keySets[0], expected);
    c.deepEq('机检：counts 的键集合', Object.keys(payload?.counts ?? {}).sort(),
      ['builtin', 'invalid', 'project', 'total']);
    c.deepEq('机检：groups 元素的键集合', Object.keys((payload?.groups ?? [])[0] ?? {}).sort(),
      ['count', 'group', 'label']);
    c.deepEq('机检：groups 顺序与五组一致', (payload?.groups ?? []).map((g) => g.group), GROUPS);

    return finish(c);
  }
}];
