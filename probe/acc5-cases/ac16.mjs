// AC-16 技能适用分组取值非法被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeSkill, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';
import { GROUPS } from './_baselines.mjs';

const AC = 'AC-16';

const BAD_GROUP_SKILL = [
  '---',
  'schema: skill/v1',
  'id: bad-group',
  'name: 坏分组技能',
  'summary: 适用分组非法',
  'applies_to: [marketing]',
  '---',
  '',
  '### 工作方法',
  '',
  '1. 做事。',
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

    c.noteFixture('写 .orch/skills/bad-group/SKILL.md（applies_to: [marketing]）',
      writeSkill(root, 'bad-group', BAD_GROUP_SKILL));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    c.evText('validate', text(res));
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.includes('Then 原因码 SKILL_GROUP_INVALID', text(res), 'SKILL_GROUP_INVALID');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const err = payload?.errors?.[0] ?? {};
    c.eq('机检：errors[0].code === SKILL_GROUP_INVALID', err.code, 'SKILL_GROUP_INVALID');
    const detail = String(err.detail ?? '');
    for (const g of GROUPS) c.includes(`机检：明细列出合法取值 ${g}`, detail, g);
    c.eq('机检：errors[0].field 指出 applies_to', err.field, 'applies_to');

    return finish(c);
  }
}];
