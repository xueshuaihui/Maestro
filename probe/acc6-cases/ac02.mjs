// AC-02 从零创建缺必填参数是用法错误（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate,
  text, nonEmptyLines, clean, requirementTitle, finish, USAGE_LINE_COUNT, exists
} from '../acc6-f-common.mjs';

const AC = 'AC-02';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）；三条命令都不带 --from', root);

    // When：依次执行三条（无 --from，四项必填逐档缺）
    const r1 = c.cmd(roleCreate(root, 'lead-dev'), 'orch role create lead-dev');
    const r2 = c.cmd(roleCreate(root, 'lead-dev', ['--group', 'coding']), 'orch role create lead-dev --group coding');
    const r3 = c.cmd(roleCreate(root, 'lead-dev', ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code']),
      'orch role create lead-dev --name 首席开发 --group coding --artifact-type code');

    const rows1 = nonEmptyLines(clean(text(r1)));
    const rows2 = nonEmptyLines(clean(text(r2)));
    const rows3 = nonEmptyLines(clean(text(r3)));
    c.evText('usage-1', text(r1));
    c.evText('usage-2', text(r2));
    c.evText('usage-3', text(r3));

    // Then：三次都打印用法块并追加一行原因，退出码都是 2
    c.eq('Then 第 1 次退出码 2', r1.exitCode, 2);
    c.eq('Then 第 2 次退出码 2', r2.exitCode, 2);
    c.eq('Then 第 3 次退出码 2', r3.exitCode, 2);
    for (const [name, rows] of [['第 1 次', rows1], ['第 2 次', rows2], ['第 3 次', rows3]]) {
      c.eq(`Then ${name}输出 = 用法块 25 行 + 原因行（共 ${USAGE_LINE_COUNT} 行）`, rows.length, USAGE_LINE_COUNT);
    }
    c.lineEq('Then 第 1 次原因行', rows1[USAGE_LINE_COUNT - 1], '  （role create 需要 --name）');
    c.lineEq('Then 第 2 次原因行', rows2[USAGE_LINE_COUNT - 1], '  （role create 需要 --name）');
    c.lineEq('Then 第 3 次原因行', rows3[USAGE_LINE_COUNT - 1], '  （role create 需要 --side-effect）');

    // 机检：三次退出码 2（上面已断言）；没有建文件
    c.check('机检：test -e "$ROOT/.orch" 为假（没建文件）', !exists(path.join(root, '.orch')), path.join(root, '.orch'));

    return finish(c);
  }
}];
