// AC-07 导出再导入，角色在另一个项目里可用（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleExport, roleImport, roleList, roleValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, sha256File
} from '../acc6-f-common.mjs';

const AC = 'AC-07';

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

    // Given：项目根 A（含 AC-04 的 lead-dev）与项目根 B（空）
    const setup = c.cmd(roleCreate(rootA, 'lead-dev', ['--from', 'developer', '--skills', 'test-run']),
      '（Given）[A] orch role create lead-dev --from developer --skills test-run');
    c.eq('Given：A 里建出 lead-dev', setup.exitCode, 0);
    c.noteFixture('项目根 A 预置 lead-dev（--from developer --skills test-run）；项目根 B 为空', '');

    // When：A 里导出 → 拷到 B → B 里导入 → B 里 list/validate
    const exp = c.cmd(roleExport(rootA, 'lead-dev', ['--out', 'exports/lead-dev.yaml']),
      '[A] orch role export lead-dev --out exports/lead-dev.yaml');
    const expRows = nonEmptyLines(clean(text(exp)));
    c.evText('export', text(exp));
    c.eq('Then 导出回一行、退出 0', exp.exitCode, 0);
    c.eq('Then 导出输出恰好一行', expRows.length, 1);
    c.lineEq('Then 导出行逐字', expRows[0], '已导出角色 lead-dev 到 exports/lead-dev.yaml');

    const exported = path.join(rootA, 'exports', 'lead-dev.yaml');
    c.check('机检：A 导出的文件存在', fs.existsSync(exported), exported);
    const exportedContent = fs.readFileSync(exported, 'utf8');
    c.evText('exported.yaml', exportedContent);
    c.includes('机检：A 导出的文件里含 derived_from: developer', exportedContent, 'derived_from: developer');

    fs.copyFileSync(exported, path.join(rootB, 'lead-dev.yaml'));
    c.noteFixture('把 exports/lead-dev.yaml 拷到 B 的根下（lead-dev.yaml）', `sha256=${sha256File(exported)}`);

    const imp = c.cmd(roleImport(rootB, 'lead-dev.yaml'), '[B] orch role import lead-dev.yaml');
    const impRows = nonEmptyLines(clean(text(imp)));
    c.evText('import', text(imp));
    c.eq('Then 导入退出 0', imp.exitCode, 0);
    c.eq('Then 导入输出恰好两行', impRows.length, 2);
    c.lineEq('Then 导入第 1 行逐字', impRows[0], '已安装项目角色：.orch/roles/lead-dev.yaml');
    c.lineEq('Then 导入第 2 行逐字', impRows[1], '校验：通过');

    const list = c.cmd(roleList(rootB), '[B] orch role list');
    const listRows = nonEmptyLines(clean(text(list)));
    c.evText('list-B', text(list));
    c.lineEq('Then B 的 role list 首行 = 角色 17 个（内置 16 · 项目 1）', listRows[0], '角色 17 个（内置 16 · 项目 1）');

    // 机检：B 的 .orch/roles/lead-dev.yaml 与 A 导出的文件逐字节相同；B 的 validate 全通过
    const installed = path.join(rootB, '.orch', 'roles', 'lead-dev.yaml');
    c.eq('机检：B 的 lead-dev.yaml 与 A 导出文件 sha256 相同（逐字节）', sha256File(installed), sha256File(exported));
    const vJson = c.cmd(roleValidate(rootB, ['--format', 'json']), '[B] orch role validate --format json');
    const vp = jsonOf(vJson);
    c.evJson('validate-B', vp);
    c.eq('机检：B 的 role validate counts.invalid === 0', vp?.counts?.invalid, 0);

    return finish(c);
  }
}];
