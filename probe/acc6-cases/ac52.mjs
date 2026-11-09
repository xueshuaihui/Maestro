// AC-52 零运行时依赖（架构检查）
// Given 实现完成后的 package.json；When 读取 dependencies；Then 键数量为 0。
// 架构检查命令逐字执行：node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)" → 输出 0。
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO, NODE, makeCase, runCmd, clean, text, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-52';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    const pkgFile = path.join(REPO, 'package.json');

    // Given / When：读取 dependencies（D-9 之外，正文机检口径）
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const deps = pkg.dependencies ?? {};
    c.evJson('package-json', pkg);

    // Then
    c.eq('Then dependencies 键数量为 0', Object.keys(deps).length, 0);

    // 架构检查（附录 AC-52 逐字命令）：node -e "…" 输出必须是 0
    const res = c.cmd(runCmd([NODE, '-e', "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"], { cwd: REPO }),
      'node -e "const p=require(\'./package.json\');console.log(Object.keys(p.dependencies ?? {}).length)"');
    c.evText('node-e-out', text(res));
    c.eq('机检：架构检查命令退出 0', res.exitCode, 0);
    c.eq('机检：架构检查命令输出必须是 0（逐字）', clean(res.stdout).trim(), '0');

    return finish(c);
  }
}];
