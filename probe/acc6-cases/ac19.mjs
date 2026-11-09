// AC-19 技能校验定位到具体文件（机检 + 用户可见）
// 注意：需求正文里 AC-19 是「skill validate」；三条主链回归是 AC-49（批次 c），别混。
// 输出顺序说明：产品按文件名字典序（empty → half）打印错误行；Then 的「随后两行」为
// 逐行枚举（机检本身用「codes 排序后」的顺序无关口径），本用例按逐行存在 + 集合断言。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, skillValidate, jsonOf, writeSkill,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-19';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：.orch/skills/half/SKILL.md（缺 summary）与 .orch/skills/empty/SKILL.md（正文只有空行）
    writeSkill(root, 'half', { id: 'half', name: '缺摘要', omit: ['summary'] });
    writeSkill(root, 'empty', { id: 'empty', name: '空正文', body: '\n' }); // 其余字段齐、正文只有空行
    c.noteFixture('预置 .orch/skills/half/SKILL.md（缺 summary）与 .orch/skills/empty/SKILL.md（正文只有空行）', '');

    // When：orch skill validate（文本 + JSON）
    const res = c.cmd(skillValidate(root), 'orch skill validate');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('validate', text(res));
    const jsonRes = c.cmd(skillValidate(root, ['--format', 'json']), 'orch skill validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);

    // Then：首行 + 两行错误（半份与空正文各一行，逐字）
    c.eq('Then 退出码 1', res.exitCode, 1);
    c.eq('Then 输出恰好三行', rows.length, 3);
    c.lineEq('Then 首行逐字', rows[0], '校验技能 12 个：2 个不合法');
    c.check('Then 有 half 行（缺 summary，逐字）',
      rows.includes('- skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）'),
      rows.slice(1).join(' || '));
    c.check('Then 有 empty 行（正文为空，逐字）',
      rows.includes('- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY）'),
      rows.slice(1).join(' || '));

    // 机检：codes 排序后等于两个码；counts.assets === 12
    const codes = (payload?.errors ?? []).map((e) => e.code);
    c.deepEq('机检：codes 排序后等于 [SKILL_BODY_EMPTY, SKILL_SCHEMA_MISSING]',
      [...codes].sort(), ['SKILL_BODY_EMPTY', 'SKILL_SCHEMA_MISSING']);
    c.eq('机检：counts.assets === 12', payload?.counts?.assets, 12);

    return finish(c);
  }
}];
