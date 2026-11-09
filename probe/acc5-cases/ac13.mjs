// AC-13 技能目录缺 SKILL.md 被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeSkillDirOnly, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-13';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    c.noteFixture('建 .orch/skills/half-done/ 但不放 SKILL.md', writeSkillDirOnly(root, 'half-done'));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 SKILL_FILE_MISSING', out, 'SKILL_FILE_MISSING');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === SKILL_FILE_MISSING', err.code, 'SKILL_FILE_MISSING');
    c.includes('Then 明细含该目录名 half-done', err.detail, 'half-done');
    c.eq('机检：errors[0].scope 为 skill', err.scope, 'skill');

    return finish(c);
  }
}];
