// AC-12 内置技能全部可解析且无悬空（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleList, roleValidate, jsonOf, text, nonEmptyLines, REPO,
  requirementTitle, finish
} from '../acc5-f-common.mjs';
import { COUNTS_CLEAN } from './_baselines.mjs';

const AC = 'AC-12';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    const res = c.cmd(roleValidate(root), 'orch role validate');
    const rows = nonEmptyLines(text(res));
    c.evText('validate', text(res));
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 文本输出恰好一行', rows.length, 1);
    c.lineEq('Then 文本输出逐字（A-4 全通过版式）', rows[0], '校验资产 26 个：全部通过（角色 16 · 技能 10）');

    const jsonRes = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json');
    const payload = jsonOf(jsonRes);
    c.evJson('payload', payload);
    c.deepEq('机检：counts 六键与 A-7 逐字一致', payload?.counts, COUNTS_CLEAN);
    c.deepEq('机检：errors 为空', payload?.errors, []);

    // 「无悬空」：全部角色技能引用并集 = 内置 10 个技能目录（一个不多一个不少）。
    // A-7 只给 counts/errors，角色表要从 `role list --format json` 取（A-6）。
    const listRes = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const listPayload = jsonOf(listRes);
    const referenced = new Set();
    for (const role of listPayload?.roles ?? []) for (const s of role.skills ?? []) referenced.add(s);
    const builtinSkills = fs.readdirSync(path.join(REPO, 'assets', 'skills'))
      .filter((name) => fs.statSync(path.join(REPO, 'assets', 'skills', name)).isDirectory())
      .sort();
    c.evJson('skills-union', { referenced: [...referenced].sort(), builtinSkills });
    c.eq('机检：技能引用并集长度 = 10（无无人引用的技能）', referenced.size, 10);
    c.deepEq('机检：技能引用并集与内置技能目录逐个相同', [...referenced].sort(), builtinSkills);

    return finish(c);
  }
}];
