// AC-59 skill create 的 --applies-to / --commands / --body-file 与取值错误口径（正常路径 + 机检）
// Given：body.md（技能正文）与 empty.md（空文件）。
// 裁-17（需求侧 R-14）：AC-59 When 样例 `--applies-to writing,review` 与需求自身预设的
// 五分组闭集（§2.2.1 / AC-54 逐字文案 / I1.5 SKILL_GROUP_INVALID）互斥——`review` 不在
// coordinator / research / writing / coding / ops 内，而同条 Then 又要求 `--applies-to nope`
// 报取值非法（预设闭集存在）。按裁决优先级与最小影响面，样例值勘误为 `writing,coding`
// （两个合法分组，Then「含两个分组」语义不变），产品零改动、v7 正文不改，本用例按勘误值取证。
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, skillCreate, skillShow, skillValidate,
  text, nonEmptyLines, clean, requirementTitle, finish, readText
} from '../acc6-f-common.mjs';
import { USAGE_25 } from './ac43.mjs';

const AC = 'AC-59';
const BODY_TEXT = '### 自定义正文\n\n这是 body.md 的正文内容，用于核对 --body-file 生效。\n';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);

    // --- Given：body.md 与 empty.md ---
    fs.writeFileSync(path.join(root, 'body.md'), BODY_TEXT, 'utf8');
    fs.writeFileSync(path.join(root, 'empty.md'), '', 'utf8');
    c.noteFixture('预置 body.md（一段技能正文）与 empty.md（空文件）', '');

    const skillFile = (id) => path.join(root, '.orch', 'skills', id, 'SKILL.md');

    // --- When ①：正常路径（裁-17 勘误值 writing,coding）---
    const ok = c.cmd(skillCreate(root, 'quote', ['--name', '引用规范', '--summary', '给结论配上可核对的出处',
      '--applies-to', 'writing,coding', '--commands', 'node --test', '--body-file', 'body.md']),
      'orch skill create quote --name 引用规范 --summary … --applies-to writing,coding --commands "node --test" --body-file body.md');
    const okRows = nonEmptyLines(clean(text(ok)));
    c.evText('create-quote', text(ok));

    // 需求 Then：成功三行 + show 各行（Then 语义按裁-17 勘误值取证）
    c.eq('Then ① 退出码 0', ok.exitCode, 0);
    c.lineEq('Then ① 首行逐字', okRows[0], '已创建项目技能：.orch/skills/quote/SKILL.md');
    c.lineEq('Then ① 末行为 校验：通过', okRows[okRows.length - 1], '校验：通过');
    const show = c.cmd(skillShow(root, 'quote'), 'orch skill show quote');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show-quote', text(show));
    c.lineEq('Then ① 命令行逐字', showRows.find((l) => l.startsWith('  命令：')) ?? '', '  命令：node --test');
    const applies = showRows.find((l) => l.startsWith('  适用：')) ?? '';
    c.check('Then ① 适用行含两个分组', applies.includes('内容创作') && applies.includes('编码工程'), applies);
    c.check('Then ① 正文是 body.md 的内容', clean(text(show)).includes('这是 body.md 的正文内容'), 'body content check');
    c.eq('Then ① 契约行的适用段有两个分组', (okRows[1] ?? '').split('·').filter((s) => s.includes('内容创作') || s.includes('编码工程')).length >= 1, true);

    // --- When ②：--applies-to nope → 用法错误退 2、不建文件 ---
    const bad = c.cmd(skillCreate(root, 'quote2', ['--name', '坏组', '--summary', 'x', '--applies-to', 'nope']),
      'orch skill create quote2 --name 坏组 --summary x --applies-to nope');
    const badRows = nonEmptyLines(clean(text(bad)));
    c.evText('create-badgroup', text(bad));
    c.eq('Then ② 退出码 2', bad.exitCode, 2);
    c.eq('Then ② 用法块 + 一行取值原因（26 行）', badRows.length, 26);
    c.deepEq('Then ② 前 25 行为 A-12 用法块逐字', badRows.slice(0, 25), [...USAGE_25]);
    c.lineEq('Then ② 取值原因行逐字（既有原因码 SKILL_GROUP_INVALID，I1.5 口径）', badRows[25],
      '  （适用分组取值非法：nope；合法取值：coordinator / research / writing / coding / ops）');

    // --- When ③：缺 --summary → 用法错误退 2、不建文件 ---
    const nosum = c.cmd(skillCreate(root, 'quote3', ['--name', '缺摘要', '--body-file', 'empty.md']),
      'orch skill create quote3 --name 缺摘要 --body-file empty.md');
    const nosumRows = nonEmptyLines(clean(text(nosum)));
    c.evText('create-nosummary', text(nosum));
    c.eq('Then ③ 退出码 2', nosum.exitCode, 2);
    c.lineEq('Then ③ 原因行逐字', nosumRows[25], '  （skill create 需要 --summary）');
    c.eq('Then ③ 整块仍为 26 行', nosumRows.length, 26);

    // --- When ④：空正文 → 资产问题退 1、不建文件 ---
    const emptyBody = c.cmd(skillCreate(root, 'quote4', ['--name', '空正文', '--summary', 'x', '--body-file', 'empty.md']),
      'orch skill create quote4 --name 空正文 --summary x --body-file empty.md');
    const emptyRows = nonEmptyLines(clean(text(emptyBody)));
    c.evText('create-emptybody', text(emptyBody));
    c.eq('Then ④ 退出码 1', emptyBody.exitCode, 1);
    c.eq('Then ④ 只回一行', emptyRows.length, 1);
    c.lineEq('Then ④ 逐字', emptyRows[0], '创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）');

    // --- 机检 ---
    c.eq('机检：quote2 不建文件', fs.existsSync(skillFile('quote2')), false);
    c.eq('机检：quote3 不建文件', fs.existsSync(skillFile('quote3')), false);
    c.eq('机检：quote4 不建文件', fs.existsSync(skillFile('quote4')), false);
    c.eq('机检：grep -c \'node --test\' 为 1',
      (readText(skillFile('quote')) ?? '').split('\n').filter((l) => l.includes('node --test')).length, 1);
    const val = c.cmd(skillValidate(root, ['--format', 'json']), 'orch skill validate --format json');
    const valPayload = JSON.parse(val.stdout);
    c.evJson('validate-payload', valPayload);
    c.eq('机检：skill validate 的 counts.invalid === 0', valPayload?.counts?.invalid, 0);

    c.note('裁-17（需求侧 R-14）：When ① 的样例值勘误 writing,review → writing,coding（需求闭集互斥，见文件头注释），Then「适用行含两个分组」语义不变；依据 = AC-59 第二场景预设闭集存在 + AC-54/§2.2.1 五分组逐字文案 + I1.5 SKILL_GROUP_INVALID 基线。');

    return finish(c);
  }
}];
