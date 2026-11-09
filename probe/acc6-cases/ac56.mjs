// AC-56 role edit 的 --set / --unset 用法错误不改动文件（异常路径 + 用户可见）
// Given：orch role create 建出 lead-dev（普通项目角色，edit 一视同仁）。
// Then：--set 未知字段 / --unset 必填字段各回 26 行用法块并退出 2、文件不变；
//       第三次 --set artifact_type=document --unset summary 成功回四行。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, roleCreate, roleEdit, roleShow,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { USAGE_25 } from './ac43.mjs';

const AC = 'AC-56';
const ROLE_FILE = (root) => path.join(root, '.orch', 'roles', 'lead-dev.yaml');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：先建出 lead-dev ---
    const created = c.cmd(roleCreate(root, 'lead-dev',
      ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write',
        '--skills', 'code-change,test-run']), 'orch role create lead-dev …');
    c.eq('Given role create lead-dev 退出码 0', created.exitCode, 0);
    const fileBefore = readText(ROLE_FILE(root));
    c.check('Given lead-dev.yaml 已落盘', Boolean(fileBefore), 'read ok');

    // --- When / Then：前两次用法错误 ---
    const edit1 = c.cmd(roleEdit(root, 'lead-dev', ['--set', 'nope=1']), 'orch role edit lead-dev --set nope=1');
    const rows1 = nonEmptyLines(clean(text(edit1)));
    c.evText('edit-set-nope', text(edit1));
    c.eq('Then --set nope=1 退出码 2', edit1.exitCode, 2);
    c.eq('Then --set nope=1 整块行数 26（25 行用法块 + 原因行）', rows1.length, 26);
    c.deepEq('Then --set nope=1 前 25 行为 A-12 用法块逐字', rows1.slice(0, 25), [...USAGE_25]);
    c.lineEq('Then --set nope=1 原因行逐字', rows1[25], '  （未知字段：nope）');
    c.eq('Then --set nope=1 文件内容不变', readText(ROLE_FILE(root)), fileBefore);

    const edit2 = c.cmd(roleEdit(root, 'lead-dev', ['--unset', 'name']), 'orch role edit lead-dev --unset name');
    const rows2 = nonEmptyLines(clean(text(edit2)));
    c.evText('edit-unset-name', text(edit2));
    c.eq('Then --unset name 退出码 2', edit2.exitCode, 2);
    c.lineEq('Then --unset name 原因行逐字', rows2[25], '  （role edit 不能删除必填字段：name）');
    c.eq('Then --unset name 文件内容不变', readText(ROLE_FILE(root)), fileBefore);

    // --- When / Then：第三次成功（退出 0，回四行）---
    const edit3 = c.cmd(roleEdit(root, 'lead-dev', ['--set', 'artifact_type=document', '--unset', 'summary']),
      'orch role edit lead-dev --set artifact_type=document --unset summary');
    const rows3 = nonEmptyLines(clean(text(edit3)));
    c.evText('edit-success', text(edit3));
    c.eq('Then 第三次退出码 0', edit3.exitCode, 0);
    c.eq('Then 第三次回四行', rows3.length, 4);
    c.lineEq('Then 第三次首行逐字', rows3[0], '已更新项目角色：.orch/roles/lead-dev.yaml');
    c.lineEq('Then 第三次契约行逐字（A-3）', rows3[1], '- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1');
    c.lineEq('Then 第三次校验行逐字', rows3[2], '校验：通过');
    c.lineEq('Then 第三次重写注记逐字', rows3[3], '（已按规范格式重写，注释不保留）');

    // --- Then：show 的产物类型变 document、职责行变空（占位 —）---
    const show = c.cmd(roleShow(root, 'lead-dev'), 'orch role show lead-dev');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show-after', text(show));
    c.eq('Then show 退出码 0', show.exitCode, 0);
    c.lineEq('Then show 契约行（产物类型 document）', showRows[0],
      '- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1');
    c.lineEq('Then show 职责行变空（冒号后无值，需求原文「职责行变空」）', showRows[1], '  职责：');

    // --- 机检 ---
    const after = readText(ROLE_FILE(root)) ?? '';
    c.eq('机检：grep -c \'nope:\' 为 0（前两次未改动文件）',
      after.split('\n').filter((l) => l.includes('nope:')).length, 0);
    c.eq('机检：grep -c \'artifact_type: document\' 为 1',
      after.split('\n').filter((l) => l.includes('artifact_type: document')).length, 1);
    c.eq('机检：grep -c \'summary:\' 为 0（--unset summary 后键被删除）',
      after.split('\n').filter((l) => l.includes('summary:')).length, 0);

    return finish(c);
  }
}];
