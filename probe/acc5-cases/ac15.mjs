// AC-15 技能正文为空被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeSkill, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-15';

// 只有前置元数据，正文只有空白行。
const EMPTY_BODY = [
  '---',
  'schema: skill/v1',
  'id: empty-body',
  'name: 空正文',
  'summary: 只有元数据',
  '---',
  '',
  '   ',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    c.noteFixture('写 .orch/skills/empty-body/SKILL.md（正文只有空白行）',
      writeSkill(root, 'empty-body', EMPTY_BODY));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 SKILL_BODY_EMPTY', out, 'SKILL_BODY_EMPTY');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === SKILL_BODY_EMPTY', err.code, 'SKILL_BODY_EMPTY');
    c.eq('机检：errors[0].file', err.file, 'skills/empty-body/SKILL.md');

    return finish(c);
  }
}];
