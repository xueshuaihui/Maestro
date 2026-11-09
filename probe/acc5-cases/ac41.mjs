// AC-41 零运行时依赖（架构检查）
import path from 'node:path';
import {
  makeCase, freshRoot, runCmd, NODE, REPO, text, readJson, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-41';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '架构检查',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '架构检查' });
    const root = freshRoot(AC);
    c.add(root); // 独立根占位；本条只读 package.json

    // 需求原文给的命令（注意 `?? {}`：当前 package.json **没有** dependencies 键）
    const res = c.cmd(runCmd([NODE, '-e',
      "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"],
    { cwd: REPO }), "node -e \"…Object.keys(p.dependencies ?? {}).length\"");
    c.evText('dependencies', text(res));

    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 键数量为 0（输出必须是 0）', text(res).trim(), '0');

    const pkg = readJson(path.join(REPO, 'package.json'));
    c.evJson('package.json', { name: pkg?.name, version: pkg?.version, dependencies: pkg?.dependencies ?? null });
    c.check('机检：package.json 没有 dependencies 键（或为空对象）',
      pkg?.dependencies === undefined || Object.keys(pkg.dependencies).length === 0,
      JSON.stringify(pkg?.dependencies ?? null));

    return finish(c);
  }
}];
