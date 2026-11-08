// AC-08 引用不存在的技能被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeRole, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-08';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    const file = writeRole(root, 'ghost-skill', {
      id: 'ghost-skill',
      name: '幽灵技能',
      group: 'coding',
      summary: '引用了不存在的技能',
      artifactType: 'code',
      sideEffect: 'write',
      skills: ['no-such-skill'],
      tools: ['read'],
      wakeAllow: [],
      max: 1
    });
    c.noteFixture('写 .orch/roles/ghost-skill.yaml（skills: [no-such-skill]）', file);

    const res = c.cmd(roleValidate(root), 'orch role validate');
    c.evText('validate', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 ROLE_SKILL_NOT_FOUND', text(res), 'ROLE_SKILL_NOT_FOUND');
    c.includes('Then 明细指名 no-such-skill', text(res), 'no-such-skill');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === ROLE_SKILL_NOT_FOUND', err.code, 'ROLE_SKILL_NOT_FOUND');
    c.includes('机检：errors[0].detail 含 no-such-skill', err.detail, 'no-such-skill');
    c.eq('机检：errors[0].field 指出 skills', err.field, 'skills');

    return finish(c);
  }
}];
