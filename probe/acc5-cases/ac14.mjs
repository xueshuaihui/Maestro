// AC-14 技能元数据缺字段或 id 不一致被拒绝（用户可见 + 机检）
import {
  makeCase, freshRoot, writeSkill, roleValidate, jsonOf, text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-14';

// 一份 SKILL.md 两处缺陷：声明 id=quoting（目录名 quote）、缺 summary。正文非空。
const TWO_DEFECTS = [
  '---',
  'schema: skill/v1',
  'id: quoting',
  'name: 引文',
  '---',
  '',
  '### 工作方法',
  '',
  '1. 只摘原文，不改写。',
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

    c.noteFixture('写 .orch/skills/quote/SKILL.md（id: quoting、缺 summary，全文同一份文件）',
      writeSkill(root, 'quote', TWO_DEFECTS));

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const out = text(res);
    c.evText('validate', out);
    c.eq('Then 退出码 1', res.exitCode, 1);

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    const items = (payload?.errors ?? []).filter((e) => e.file === 'skills/quote/SKILL.md');
    c.deepEq('机检：对该文件报两条，code 集合恰好是 SKILL_SCHEMA_MISSING 与 SKILL_ID_MISMATCH',
      items.map((e) => e.code), ['SKILL_SCHEMA_MISSING', 'SKILL_ID_MISMATCH']);
    c.eq('机检：SKILL_SCHEMA_MISSING 的字段是 summary', items[0]?.field, 'summary');
    c.includes('机检：SKILL_ID_MISMATCH 明细给出目录名 quote', items[1]?.detail, 'quote');
    c.includes('机检：SKILL_ID_MISMATCH 明细给出声明 id quoting', items[1]?.detail, 'quoting');
    c.eq('机检：counts.invalid 按文件计（1，不是 2）', payload?.counts?.invalid, 1);

    return finish(c);
  }
}];
