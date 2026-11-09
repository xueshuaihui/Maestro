// AC-09 就地编辑与内置角色只读（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleEdit,
  text, nonEmptyLines, clean, requirementTitle, finish, sha256File, REPO
} from '../acc6-f-common.mjs';

const AC = 'AC-09';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：AC-01 建出的 lead-dev（artifact_type: code）
    const setup = c.cmd(roleCreate(root, 'lead-dev', ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write', '--skills', 'code-change,test-run']),
      '（Given）orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run');
    c.eq('Given：lead-dev 建出', setup.exitCode, 0);
    c.noteFixture('预置 lead-dev（同 AC-01 命令，artifact_type: code）', '');
    const builtin = path.join(REPO, 'assets', 'roles', 'developer.yaml');
    const builtinShaBefore = sha256File(builtin);

    // When：第一次编辑项目角色 → 第二次编辑内置角色
    const edit = c.cmd(roleEdit(root, 'lead-dev', ['--set', 'artifact_type=document']),
      'orch role edit lead-dev --set artifact_type=document');
    const editRows = nonEmptyLines(clean(text(edit)));
    c.evText('edit', text(edit));
    const deny = c.cmd(roleEdit(root, 'developer', ['--set', 'artifact_type=document']),
      'orch role edit developer --set artifact_type=document');
    const denyRows = nonEmptyLines(clean(text(deny)));
    c.evText('deny', text(deny));

    // Then：第一次回四行、退出 0
    c.eq('Then 第一次退出码 0', edit.exitCode, 0);
    c.eq('Then 第一次输出恰好四行', editRows.length, 4);
    c.matches('Then 第 1 行 = 已更新项目角色：…', editRows[0], /^已更新项目角色：\.orch\/roles\/lead-dev\.yaml$/);
    c.lineEq('Then 第 2 行契约行（产物类型变 document）', editRows[1], '- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1');
    c.lineEq('Then 第 3 行校验通过', editRows[2], '校验：通过');
    c.lineEq('Then 第 4 行（已按规范格式重写，注释不保留）', editRows[3], '（已按规范格式重写，注释不保留）');

    // Then：第二次内置拒绝、退出 1
    c.eq('Then 第二次退出码 1', deny.exitCode, 1);
    c.eq('Then 第二次输出恰好一行', denyRows.length, 1);
    c.lineEq('Then 第二次输出逐字', denyRows[0], '内置角色不可编辑：先 orch role create <新角色> --from developer');

    // 机检：文件里有 artifact_type: document；内置 developer.yaml sha256 前后相同
    const file = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
    const content = fs.readFileSync(file, 'utf8');
    c.evText('lead-dev.yaml', content);
    c.eq('机检：grep -c "artifact_type: document" = 1',
      content.split('\n').filter((l) => l.includes('artifact_type: document')).length, 1);
    c.eq('机检：assets/roles/developer.yaml 的 sha256 前后相同', sha256File(builtin), builtinShaBefore);
    c.eq('机检：第二次退出码 1（复核）', deny.exitCode, 1);

    return finish(c);
  }
}];
