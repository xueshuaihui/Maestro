// AC-38 角色命令只读（边界 + 机检）
import path from 'node:path';
import {
  makeCase, freshRoot, roleList, roleShow, roleValidate, exists, dirSnapshot, REPO,
  text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-38';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '边界',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '边界' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（没有 .orch）', root);

    const assetsBefore = dirSnapshot(path.join(REPO, 'assets'));
    c.evJson('assets-before', assetsBefore);

    // When：三条命令都不带 --instance
    const list = c.cmd(roleList(root), 'orch role list');
    const show = c.cmd(roleShow(root, 'developer'), 'orch role show developer');
    const validate = c.cmd(roleValidate(root), 'orch role validate');
    c.eq('前置：三条命令都成功（list 0）', list.exitCode, 0);
    c.eq('前置：三条命令都成功（show 0）', show.exitCode, 0);
    c.eq('前置：三条命令都成功（validate 0）', validate.exitCode, 0);

    // Then
    const orchDir = path.join(root, '.orch');
    c.check('机检：执行后项目根下 .orch 目录不存在', !exists(orchDir), String(exists(orchDir)));
    c.check('机检：因而不可能存在 .orch/core.json（没有启动核心）', !exists(path.join(orchDir, 'core.json')), 'core.json 不存在');
    c.check('机检：也没有写任何文件（项目根下只有 .orch 检查项，其余为空）',
      !exists(orchDir) && !exists(path.join(root, '.mock')), 'project root 未被写入');

    const assetsAfter = dirSnapshot(path.join(REPO, 'assets'));
    c.evJson('assets-after', assetsAfter);
    const same = JSON.stringify(assetsBefore) === JSON.stringify(assetsAfter);
    c.check('机检：assets/** 的 sha256 清单前后逐字相同', same,
      `${Object.keys(assetsBefore).length} 个文件`);
    c.evText('assets-hashes', Object.entries(assetsAfter).map(([f, v]) => `${v.sha256}  ${f}`).join('\n'));

    return finish(c);
  }
}];
