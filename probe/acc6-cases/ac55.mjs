// AC-55 导入非角色文件被拒且不落盘（异常路径 + 机检）
// Given：not-role.yaml（缺 schema 的一段 YAML）与 wrong-schema.yaml（schema: workflow/v1）。
// When：两次 orch role import。Then：各只回一行同样的拒绝句、退出 1、.orch/roles/ 无任何文件。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleImport, roleList, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-55';
const REJECT_LINE = '导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：两份非角色文件（写在工作根，不在 .orch 下）---
    fs.writeFileSync(path.join(root, 'not-role.yaml'), 'id: not-role\nname: 不是角色\n', 'utf8');
    fs.writeFileSync(path.join(root, 'wrong-schema.yaml'), 'schema: workflow/v1\nid: wrong-schema\n', 'utf8');
    c.noteFixture('预置 not-role.yaml（缺 schema）与 wrong-schema.yaml（schema: workflow/v1）', '');

    // --- When：两次 import ---
    const r1 = c.cmd(roleImport(root, 'not-role.yaml'), 'orch role import not-role.yaml');
    const r2 = c.cmd(roleImport(root, 'wrong-schema.yaml'), 'orch role import wrong-schema.yaml');
    c.evText('import-not-role', text(r1));
    c.evText('import-wrong-schema', text(r2));

    // --- Then：各只回一行拒绝句、退出 1 ---
    for (const [label, res] of [['not-role.yaml', r1], ['wrong-schema.yaml', r2]]) {
      const rows = nonEmptyLines(clean(text(res)));
      c.eq(`Then ${label} 退出码 1`, res.exitCode, 1);
      c.eq(`Then ${label} 只回一行`, rows.length, 1);
      c.lineEq(`Then ${label} 拒绝行逐字`, rows[0], REJECT_LINE);
    }

    // --- 机检：不落盘 + 内置计数不变 ---
    c.eq('机检：test -e "$ROOT/.orch/roles/not-role.yaml" 为假',
      fs.existsSync(path.join(root, '.orch', 'roles', 'not-role.yaml')), false);
    c.eq('机检：test -e "$ROOT/.orch/roles/wrong-schema.yaml" 为假',
      fs.existsSync(path.join(root, '.orch', 'roles', 'wrong-schema.yaml')), false);
    const rolesDir = path.join(root, '.orch', 'roles');
    const left = fs.existsSync(rolesDir) ? fs.readdirSync(rolesDir) : [];
    c.deepEq('机检：.orch/roles/ 下没有留下任何文件', left, []);
    const list = c.cmd(roleList(root, ['--format', 'json']), 'orch role list --format json');
    const payload = jsonOf(list);
    c.evJson('role-list-payload', payload);
    c.eq('机检：role list 的 counts.total === 16（import 只装单个文件，注册表仍是内置 16 角色）',
      payload?.counts?.total, 16);

    return finish(c);
  }
}];
