// AC-05 派生角色改技能引用后，三处行为同时变化（用户可见 + 机检）
import {
  makeCase, freshRoot, roleCreate, roleEdit, roleShow, roleList, roleValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-05';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：AC-04 建出的 lead-dev（技能 ['test-run']）
    const setup = c.cmd(roleCreate(root, 'lead-dev', ['--from', 'developer', '--skills', 'test-run']),
      '（Given）orch role create lead-dev --from developer --skills test-run');
    c.eq('Given：派生 lead-dev 建出', setup.exitCode, 0);
    c.noteFixture('预置 lead-dev（--from developer --skills test-run，同 AC-04）', '');

    // 机检：改前 role show --format json 的 role.skills === ['test-run']
    const showBefore = c.cmd(roleShow(root, 'lead-dev', ['--format', 'json']), 'orch role show lead-dev --format json（改前）');
    const before = jsonOf(showBefore);
    c.evJson('skills-before', before);
    c.deepEq('机检：改前 role.skills = [test-run]', before?.role?.skills, ['test-run']);

    // When：改技能引用
    const edit = c.cmd(roleEdit(root, 'lead-dev', ['--set', 'skills=test-run,code-review']),
      'orch role edit lead-dev --set skills=test-run,code-review');
    c.eq('When：role edit 退出码 0', edit.exitCode, 0);
    c.evText('edit', text(edit));

    // Then ①：role show 的技能行变化
    const show = c.cmd(roleShow(root, 'lead-dev'), 'orch role show lead-dev');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show-after', text(show));
    c.eq('Then ① role show 退出码 0', show.exitCode, 0);
    c.lineEq('Then ① 技能行变成 `  技能：test-run, code-review`', showRows[2], '  技能：test-run, code-review');

    // Then ②：role list 中 lead-dev 行技能数变化
    const list = c.cmd(roleList(root), 'orch role list');
    const listRows = nonEmptyLines(clean(text(list)));
    c.evText('list-after', text(list));
    c.eq('Then ② role list 退出码 0', list.exitCode, 0);
    const row = listRows.find((l) => l.startsWith('- lead-dev '));
    c.check('Then ② lead-dev 行以 · 技能 2 · 并发 1 结尾', row?.endsWith('· 技能 2 · 并发 1') === true, row);

    // Then ③：role validate 仍然全部通过（此根含 1 个项目角色，计数为 27/17，Then 只钉「全部通过 + 退出 0」）
    const validate = c.cmd(roleValidate(root), 'orch role validate');
    const vRows = nonEmptyLines(clean(text(validate)));
    c.evText('validate-after', text(validate));
    c.eq('Then ③ role validate 退出码 0', validate.exitCode, 0);
    c.matches('Then ③ 校验行 = 全部通过', vRows[0], /全部通过/);

    // 机检：改后 role.skills === ['test-run','code-review']；counts.invalid === 0
    const showAfter = c.cmd(roleShow(root, 'lead-dev', ['--format', 'json']), 'orch role show lead-dev --format json（改后）');
    const after = jsonOf(showAfter);
    c.evJson('skills-after', after);
    c.deepEq('机检：改后 role.skills = [test-run, code-review]', after?.role?.skills, ['test-run', 'code-review']);
    const vJson = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const vp = jsonOf(vJson);
    c.evJson('validate-payload', vp);
    c.eq('机检：role validate 的 counts.invalid === 0', vp?.counts?.invalid, 0);

    return finish(c);
  }
}];
