// AC-54 role create 四个必填参数取值非法是用法错误、不建文件（异常路径 + 用户可见）
// Given：全新项目根（无 .orch）。三次 role create 分别 --group / --artifact-type / --side-effect 取值非法。
// 用法块 25 行（ac43 的 USAGE_25，与附录 A-12 逐字一致）+ 各追加一行原因，合计 26 行。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, orch, roleCreate,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';
import { USAGE_25 } from './ac43.mjs';

const AC = 'AC-54';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // --- When：三次取值非法的 role create ---
    // 原因行逐字：--group 行为需求原文逐字；另两条同句式、合法取值集合与 role-schema.js
    // 的 ARTIFACT_TYPES / SIDE_EFFECTS（资产级 ROLE_ARTIFACT_TYPE_INVALID / ROLE_SIDE_EFFECT_INVALID
    // 同源闭集）一致，拼接口径与 --group 行相同（'/' 连接、无空格）。
    const CASES = [
      {
        args: ['--name', '首席开发', '--group', 'nope', '--artifact-type', 'code', '--side-effect', 'write'],
        reason: '  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）',
        label: 'orch role create lead-dev --group nope …'
      },
      {
        args: ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'doc', '--side-effect', 'write'],
        reason: '  （role create 的 --artifact-type 只接受 code/document/dataset/report）',
        label: 'orch role create lead-dev --artifact-type doc …'
      },
      {
        args: ['--name', '首席开发', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'heavy'],
        reason: '  （role create 的 --side-effect 只接受 none/read/write/exec）',
        label: 'orch role create lead-dev --side-effect heavy …'
      }
    ];

    const reasons = [];
    for (const item of CASES) {
      const res = c.cmd(roleCreate(root, 'lead-dev', item.args), item.label);
      const rows = nonEmptyLines(clean(text(res)));
      c.evText(item.label.replace(/\s+/g, '-'), text(res));

      // --- Then：25 行用法块 + 一行原因，退出码 2，不建文件 ---
      c.eq(`Then ${item.label} 退出码 2`, res.exitCode, 2);
      c.eq(`Then ${item.label} 整块行数 26（25 + 原因行）`, rows.length, 26);
      c.deepEq(`Then ${item.label} 前 25 行为 A-12 用法块逐字`, rows.slice(0, 25), [...USAGE_25]);
      c.lineEq(`Then ${item.label} 原因行逐字`, rows[25], item.reason);
      reasons.push(rows[25]);
      // Then：没有建文件（.orch 不存在）
      c.eq(`Then ${item.label} 后 test -e "$ROOT/.orch" 为假`, fs.existsSync(path.join(root, '.orch')), false);
    }

    // --- 机检：--group 原因行逐字（需求原文钉死）；orch role bogus 的用法块行数恒为 25 ---
    c.lineEq('机检：--group 原因行逐字（需求原文）', reasons[0],
      '  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）');
    const bogus = c.cmd(orch(root, ['role', 'bogus']), 'orch role bogus');
    const bogusRows = nonEmptyLines(clean(text(bogus)));
    c.evText('role-bogus', text(bogus));
    c.deepEq('机检：orch role bogus 输出的用法块行数恒为 25（前 25 行逐字）', bogusRows.slice(0, 25), [...USAGE_25]);
    c.eq('机检：orch role bogus 整块仍为 25 行用法块 + 1 行原因', bogusRows.length, 26);
    c.eq('机检：orch role bogus 后 .orch 仍不存在', fs.existsSync(path.join(root, '.orch')), false);

    return finish(c);
  }
}];
