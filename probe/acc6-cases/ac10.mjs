// AC-10 差异清单与「无差异」（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleDiff, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish, REPO
} from '../acc6-f-common.mjs';

const AC = 'AC-10';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：AC-04 的 lead-dev + 一份与内置 developer 逐字段相同的项目覆盖文件
    const setup = c.cmd(roleCreate(root, 'lead-dev', ['--from', 'developer', '--skills', 'test-run']),
      '（Given）orch role create lead-dev --from developer --skills test-run');
    c.eq('Given：lead-dev 建出', setup.exitCode, 0);
    const builtin = fs.readFileSync(path.join(REPO, 'assets', 'roles', 'developer.yaml'), 'utf8');
    fs.mkdirSync(path.join(root, '.orch', 'roles'), { recursive: true });
    fs.writeFileSync(path.join(root, '.orch', 'roles', 'developer.yaml'), builtin, 'utf8');
    c.noteFixture('预置 .orch/roles/developer.yaml = assets/roles/developer.yaml 逐字节拷贝（逐字段相同的项目覆盖文件）', `sha256 源=${builtin.length}B`);

    // When：diff lead-dev → diff developer（同名覆盖）
    const d1 = c.cmd(roleDiff(root, 'lead-dev'), 'orch role diff lead-dev');
    const rows1 = nonEmptyLines(clean(text(d1)));
    c.evText('diff-lead-dev', text(d1));
    const d2 = c.cmd(roleDiff(root, 'developer'), 'orch role diff developer（逐字段相同的项目覆盖）');
    const rows2 = nonEmptyLines(clean(text(d2)));
    c.evText('diff-developer', text(d2));
    const j1 = c.cmd(roleDiff(root, 'lead-dev', ['--format', 'json']), 'orch role diff lead-dev --format json');
    const p1 = jsonOf(j1);
    c.evJson('diff-payload', p1);

    // Then：第一次 5 行（对比行 + 三行差异 + 差异 3 项）
    c.eq('Then 第一次退出码 0', d1.exitCode, 0);
    c.eq('机检：第一次输出行数 5', rows1.length, 5);
    c.lineEq('Then 第 1 行逐字', rows1[0], '对比角色 lead-dev（项目）与基线 developer（内置）');
    c.lineEq('Then 差异行 1', rows1[1], '+ derived_from：developer');
    c.lineEq('Then 差异行 2', rows1[2], '~ name：开发 → 开发（派生）');
    c.lineEq('Then 差异行 3', rows1[3], '~ skills：code-change, test-run → test-run');
    c.lineEq('Then 末行逐字 = 差异 3 项', rows1[4], '差异 3 项');

    // Then：第二次末行是 无差异
    c.eq('Then 第二次退出码 0', d2.exitCode, 0);
    c.eq('Then 第二次输出恰好 2 行', rows2.length, 2);
    c.lineEq('Then 第二次末行 = 无差异', rows2[1], '无差异');

    // 机检：--format json 顶层键恰为 base/target/changes；changes 长度 3、kind 集合 {added, changed}
    c.deepEq('机检：顶层键恰为 base/target/changes', Object.keys(p1 ?? {}).sort(), ['base', 'changes', 'target']);
    c.eq('机检：changes 长度 3', (p1?.changes ?? []).length, 3);
    c.deepEq('机检：changes 的 kind 集合 = {added, changed}', [...new Set((p1?.changes ?? []).map((x) => x.kind))].sort(), ['added', 'changed']);

    return finish(c);
  }
}];
