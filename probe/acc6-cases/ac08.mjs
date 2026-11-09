// AC-08 导入被拒的两种情形都不落盘（机检 + 用户可见）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleImport, writeRole, dirSnapshot,
  text, nonEmptyLines, clean, requirementTitle, finish, ROLE_DIR, exists
} from '../acc6-f-common.mjs';

const AC = 'AC-08';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：ghost.yaml（技能 no-such）、lead-dev.yaml（合法，技能 test-run）；项目里已有同名项目角色
    writeRole(root, 'lead-dev', { id: 'lead-dev', name: '首席开发', skills: ['test-run'] });
    fs.writeFileSync(path.join(root, 'ghost.yaml'), [
      'schema: role/v1', 'id: ghost', 'name: 幽灵', 'group: coding', 'summary: 技能不存在',
      'artifact_type: code', 'side_effect: write', 'skills: [no-such]', 'max_concurrent_sessions: 1', ''
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(root, 'lead-dev.yaml'), [
      'schema: role/v1', 'id: lead-dev', 'name: 首席开发', 'group: coding', 'summary: 合法待导入',
      'artifact_type: code', 'side_effect: write', 'skills: [test-run]', 'max_concurrent_sessions: 1', ''
    ].join('\n'), 'utf8');
    const rolesDir = ROLE_DIR(root);
    const snapBefore = dirSnapshot(rolesDir);
    c.noteFixture('预置根下 ghost.yaml（技能 no-such）与 lead-dev.yaml（合法）；.orch/roles/lead-dev.yaml 已存在', JSON.stringify(snapBefore));

    // When：依次导入两个文件
    const deny = c.cmd(roleImport(root, 'ghost.yaml'), 'orch role import ghost.yaml');
    const denyRows = nonEmptyLines(clean(text(deny)));
    c.evText('deny', text(deny));
    const snapAfterDeny = dirSnapshot(rolesDir);
    const dup = c.cmd(roleImport(root, 'lead-dev.yaml'), 'orch role import lead-dev.yaml');
    const dupRows = nonEmptyLines(clean(text(dup)));
    c.evText('dup', text(dup));
    const snapAfterDup = dirSnapshot(rolesDir);

    // Then：第一次导入被拒、退出 1、没有任何新文件
    c.eq('Then 第一次退出码 1', deny.exitCode, 1);
    c.eq('Then 第一次输出恰好一行', denyRows.length, 1);
    c.lineEq('Then 第一次输出逐字', denyRows[0], '导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）');
    c.deepEq('机检：.orch/roles 文件清单在第一次执行前后逐字相同', snapAfterDeny, snapBefore);
    c.check('机检：第一次执行后 test -e "$ROOT/.orch/roles/ghost.yaml" 为假', !exists(path.join(rolesDir, 'ghost.yaml')), 'ghost.yaml 不存在');

    // Then：第二次同名被拒、退出 1、文件内容不变
    c.eq('Then 第二次退出码 1', dup.exitCode, 1);
    c.eq('Then 第二次输出恰好一行', dupRows.length, 1);
    c.lineEq('Then 第二次输出逐字', dupRows[0], '已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）');
    c.deepEq('机检：.orch/roles 文件清单在两次执行前后逐字相同', snapAfterDup, snapBefore);

    return finish(c);
  }
}];
