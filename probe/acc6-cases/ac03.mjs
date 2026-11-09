// AC-03 目标已存在时拒绝，--force 才覆盖（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate,
  text, nonEmptyLines, clean, requirementTitle, finish, sha256File
} from '../acc6-f-common.mjs';

const AC = 'AC-03';
const CREATE_ARGS = ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code',
  '--side-effect', 'write', '--skills', 'code-change,test-run'];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // Given：lead-dev.yaml 已存在（由 AC-01 的同一条命令建出，内容为 summary 为空）
    const setup = c.cmd(roleCreate(root, 'lead-dev', CREATE_ARGS), '（Given）orch role create lead-dev --name 首席开发 …（同 AC-01）');
    c.eq('Given：预置 lead-dev.yaml 成功', setup.exitCode, 0);
    const file = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
    const before = fs.readFileSync(file, 'utf8');
    const beforeSha = sha256File(file);
    // asset-write.js:26 的既定序列化口径：空字符串 summary 写成 `summary : ''`（冒号前有空格）。
    c.includes('Given：文件内容为 summary 为空（summary : \'\'）', before, "summary : ''");
    c.noteFixture('预置 .orch/roles/lead-dev.yaml（AC-01 同款命令）', `sha256=${beforeSha}`);

    // When：先执行同名 create（不加 --force），再执行同一条命令加 --force（When 原文不带 --skills）
    const deny = c.cmd(roleCreate(root, 'lead-dev', ['--name', '另一个名字', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write']),
      'orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write');
    const denyRows = nonEmptyLines(clean(text(deny)));
    c.evText('deny', text(deny));
    const snapAfterDeny = sha256File(file);
    // 第一次被拒后的文件快照（必须在 --force 之前读，否则读到的是覆盖后的内容）
    const contentAfterDeny = fs.readFileSync(file, 'utf8');
    const grepAfterDeny = contentAfterDeny.split('\n').filter((l) => l.includes('另一个名字')).length;
    const force = c.cmd(roleCreate(root, 'lead-dev', ['--name', '另一个名字', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write', '--force']),
      'orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write --force');
    const forceRows = nonEmptyLines(clean(text(force)));
    c.evText('force', text(force));

    // Then：第一次拒绝、退出码 1、文件内容不变
    c.eq('Then 第一次退出码 1', deny.exitCode, 1);
    c.eq('Then 第一次输出恰好一行', denyRows.length, 1);
    c.lineEq('Then 第一次输出逐字', denyRows[0], '已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）');
    c.eq('机检：第一次后文件 sha256 不变', snapAfterDeny, beforeSha);
    c.eq('机检：第一次后 grep -c 另一个名字 = 0', grepAfterDeny, 0);

    // Then：第二次成功、退出码 0、契约行的名字变成 另一个名字
    c.eq('Then 第二次退出码 0', force.exitCode, 0);
    c.eq('Then 第二次输出恰好三行', forceRows.length, 3);
    c.lineEq('Then 第二次第 1 行逐字', forceRows[0], '已创建项目角色：.orch/roles/lead-dev.yaml');
    c.matches('Then 第二次契约行的名字变成 另一个名字', forceRows[1], /^- lead-dev 另一个名字 · /);
    c.lineEq('Then 第二次第 3 行校验通过', forceRows[2], '校验：通过');

    // 机检：第二次后 grep -c 另一个名字 = 1
    const after = fs.readFileSync(file, 'utf8');
    c.eq('机检：第二次后 grep -c 另一个名字 = 1', after.split('\n').filter((l) => l.includes('另一个名字')).length, 1);
    c.evText('lead-dev.yaml', after);

    return finish(c);
  }
}];
