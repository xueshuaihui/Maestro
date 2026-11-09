// AC-20 技能导出再导入（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, skillExport, skillImport, skillList, skillValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, sha256File
} from '../acc6-f-common.mjs';

const AC = 'AC-20';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const rootA = freshRoot(`${AC}-A`);
    const rootB = freshRoot(`${AC}-B`);
    c.add(rootA);
    c.add(rootB);
    c.noteFixture('全新项目根 A 与另一个空项目根 B', `${rootA} / ${rootB}`);

    // When：A 导出 → 拷进 B → B 导入
    const exp = c.cmd(skillExport(rootA, 'code-change', ['--out', 'exports/code-change.md']),
      '[A] orch skill export code-change --out exports/code-change.md');
    const expRows = nonEmptyLines(clean(text(exp)));
    c.evText('export', text(exp));
    c.eq('Then A 导出退出 0', exp.exitCode, 0);
    c.eq('Then A 导出输出恰好一行', expRows.length, 1);
    c.lineEq('Then A 导出行逐字', expRows[0], '已导出技能 code-change 到 exports/code-change.md');

    const exported = path.join(rootA, 'exports', 'code-change.md');
    c.check('机检：A 导出的文件存在', fs.existsSync(exported), exported);
    fs.copyFileSync(exported, path.join(rootB, 'code-change.md'));
    c.noteFixture('把导出文件拷进 B 根下（code-change.md）', `sha256=${sha256File(exported)}`);

    const imp = c.cmd(skillImport(rootB, 'code-change.md'), '[B] orch skill import code-change.md');
    const impRows = nonEmptyLines(clean(text(imp)));
    c.evText('import', text(imp));
    c.eq('Then B 导入退出 0', imp.exitCode, 0);
    c.eq('Then B 导入输出恰好两行', impRows.length, 2);
    c.lineEq('Then B 导入第 1 行逐字', impRows[0], '已安装项目技能：.orch/skills/code-change/SKILL.md');
    c.lineEq('Then B 导入第 2 行逐字', impRows[1], '校验：通过');

    const list = c.cmd(skillList(rootB), '[B] orch skill list');
    const listRows = nonEmptyLines(clean(text(list)));
    c.evText('list-B', text(list));
    c.lineEq('Then B 的 skill list 首行 = 技能 10 个（内置 9 · 项目 1）', listRows[0], '技能 10 个（内置 9 · 项目 1）');

    // 机检：B 的安装文件与 A 导出逐字节相同；B 的 validate invalid=0、project=1
    const installed = path.join(rootB, '.orch', 'skills', 'code-change', 'SKILL.md');
    c.eq('机检：B 的 SKILL.md 与 A 导出文件 sha256 相同（逐字节）', sha256File(installed), sha256File(exported));
    const vJson = c.cmd(skillValidate(rootB, ['--format', 'json']), '[B] orch skill validate --format json');
    const vp = jsonOf(vJson);
    c.evJson('validate-B', vp);
    c.eq('机检：B 的 skill validate counts.invalid === 0', vp?.counts?.invalid, 0);
    c.eq('机检：B 的 skill validate counts.project === 1', vp?.counts?.project, 1);

    return finish(c);
  }
}];
