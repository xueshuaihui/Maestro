// AC-58 内置资产只读：导入 / 创建 / --force 都不动内置（异常路径 + 机检）
// Given：developer.yaml（id: developer 的合法角色文件）+ 项目技能 quote；
//        执行前记录 assets/** sha256 清单。四次命令后 assets/** 一个字节不变。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, makeCase, freshRoot, runCmd, roleImport, skillCreate, writeSkill, sha256File, listFiles,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';

const AC = 'AC-58';

/** 仓库 assets/** 的 sha256 清单（相对路径正斜杠、字典序，逐字可比）。 */
function assetManifest() {
  return listFiles(path.join(REPO, 'assets'))
    .map((rel) => `${rel}  ${sha256File(path.join(REPO, 'assets', ...rel.split('/')))}`)
    .join('\n');
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '机检',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '机检' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：developer.yaml（合法、id 与内置同名）+ 项目技能 quote ---
    fs.writeFileSync(path.join(root, 'developer.yaml'), [
      'schema: role/v1',
      'id: developer',
      'name: 开发（冒名文件）',
      'group: coding',
      'summary: 用来撞内置 id 的合法角色文件',
      'artifact_type: code',
      'side_effect: write',
      'skills: [test-run]',
      'tools: [read]',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n'), 'utf8');
    const quoteFile = writeSkill(root, 'quote');
    const quoteBefore = readText(quoteFile);
    c.noteFixture('预置 developer.yaml（id: developer 的合法角色文件）与项目技能 .orch/skills/quote/SKILL.md', '');
    c.check('Given 项目技能 quote 已落盘', Boolean(quoteBefore), 'read ok');

    const manifestBefore = assetManifest();
    c.evText('assets-manifest-before', manifestBefore);

    // --- When ①：import 撞内置 id ---
    const imp = c.cmd(roleImport(root, 'developer.yaml'), 'orch role import developer.yaml');
    const impRows = nonEmptyLines(clean(text(imp)));
    c.evText('import-developer', text(imp));
    c.eq('Then ① 退出码 1', imp.exitCode, 1);
    c.eq('Then ① 只回一行', impRows.length, 1);
    c.lineEq('Then ① 逐字', impRows[0], '导入被拒：内置角色只读：developer（ASSET_READONLY）');

    // --- When ②：create 撞内置技能 id，--force 也不豁免 ---
    const mk1 = c.cmd(skillCreate(root, 'code-change', ['--name', '冒名', '--summary', '占位', '--force']),
      'orch skill create code-change --name 冒名 --summary 占位 --force');
    const mk1Rows = nonEmptyLines(clean(text(mk1)));
    c.evText('create-builtin-force', text(mk1));
    c.eq('Then ② 退出码 1', mk1.exitCode, 1);
    c.eq('Then ② 只回一行', mk1Rows.length, 1);
    c.lineEq('Then ② 逐字', mk1Rows[0], '创建被拒：内置技能只读：code-change（ASSET_READONLY）');

    // --- When ③：create 撞项目技能 id（无 --force）→ 已存在，文件不变 ---
    const mk2 = c.cmd(skillCreate(root, 'quote', ['--name', '冒名', '--summary', '占位']),
      'orch skill create quote --name 冒名 --summary 占位');
    const mk2Rows = nonEmptyLines(clean(text(mk2)));
    c.evText('create-project-exists', text(mk2));
    c.eq('Then ③ 退出码 1', mk2.exitCode, 1);
    c.eq('Then ③ 只回一行', mk2Rows.length, 1);
    c.lineEq('Then ③ 逐字', mk2Rows[0], '已存在同名项目技能：.orch/skills/quote/SKILL.md（加 --force 覆盖）');
    c.eq('Then ③ 文件不变', readText(quoteFile), quoteBefore);

    // --- When ④：--force 覆盖项目同名资产 → 成功 ---
    const mk3 = c.cmd(skillCreate(root, 'quote', ['--name', '冒名', '--summary', '占位', '--force']),
      'orch skill create quote --name 冒名 --summary 占位 --force');
    const mk3Rows = nonEmptyLines(clean(text(mk3)));
    c.evText('create-project-force', text(mk3));
    c.eq('Then ④ 退出码 0', mk3.exitCode, 0);
    c.lineEq('Then ④ 首行逐字', mk3Rows[0], '已创建项目技能：.orch/skills/quote/SKILL.md');
    c.lineEq('Then ④ 末行为 校验：通过', mk3Rows[mk3Rows.length - 1], '校验：通过');

    // --- 机检 ---
    const manifestAfter = assetManifest();
    c.evText('assets-manifest-after', manifestAfter);
    c.eq('机检：assets/** sha256 清单执行前后逐字相同（四次后一个字节都没变）', manifestAfter, manifestBefore);
    const git = runCmd(['git', 'status', '--porcelain', 'assets'], { cwd: REPO, label: 'git status --porcelain assets' });
    c.evText('git-status-assets', `${text(git)}(exit=${git.exitCode})`);
    c.eq('机检：git status --porcelain assets 输出为空', clean(text(git)).trim(), '');
    c.eq('机检：第二次执行后 test -e "$ROOT/.orch/skills/code-change/SKILL.md" 为假',
      fs.existsSync(path.join(root, '.orch', 'skills', 'code-change', 'SKILL.md')), false);
    c.eq('机检：--force 只覆盖项目里的同名资产（quote 正文已换成冒名内容）',
      (readText(quoteFile) ?? '').includes('name: 冒名'), true);

    return finish(c);
  }
}];
