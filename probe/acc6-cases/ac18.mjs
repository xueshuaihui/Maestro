// AC-18 建技能并立即通过校验（用户可见 + 机检）
import fs from 'node:fs';
import path from 'node:path';
import {
  makeCase, freshRoot, skillCreate, skillValidate, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-18';
// A-7 的默认正文（逐字）：不给 --body-file 时写入 SKILL.md 的正文。
const DEFAULT_BODY_LINES = [
  '### 工作方法',
  '',
  '1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。'
];

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // When：orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing
    const res = c.cmd(skillCreate(root, 'quote', ['--name', '引用规范', '--summary', '给结论配上可核对的出处', '--applies-to', 'writing']),
      'orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('create', text(res));

    // Then：三行 + 退出 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.eq('Then 输出恰好三行', rows.length, 3);
    c.lineEq('Then 第 1 行逐字', rows[0], '已创建项目技能：.orch/skills/quote/SKILL.md');
    c.lineEq('Then 第 2 行契约行', rows[1], '- quote 引用规范 · 内容创作 · 命令 0');
    c.lineEq('Then 第 3 行校验通过', rows[2], '校验：通过');

    // Then：随后 orch skill validate 首行
    const v = c.cmd(skillValidate(root), 'orch skill validate');
    const vRows = nonEmptyLines(clean(text(v)));
    c.evText('validate', text(v));
    c.eq('Then skill validate 退出码 0', v.exitCode, 0);
    c.lineEq('Then validate 首行 = 校验技能 11 个：全部通过', vRows[0], '校验技能 11 个：全部通过');

    // 机检：文件以 --- 开头、含 schema: skill/v1 与 id: quote、正文去空白后非空
    const file = path.join(root, '.orch', 'skills', 'quote', 'SKILL.md');
    const content = fs.readFileSync(file, 'utf8');
    c.evText('SKILL.md', content);
    c.check('机检：文件以 --- 开头', content.startsWith('---'), content.split('\n')[0]);
    c.includes('机检：文件含 schema: skill/v1', content, 'schema: skill/v1');
    c.includes('机检：文件含 id: quote', content, 'id: quote');
    const body = content.split('---').slice(2).join('---');
    c.check('机检：正文去掉空白后非空', body.replace(/\s/g, '').length > 0, `${body.replace(/\s/g, '').length} 个非空白字符`);
    // A-7 逐字：默认正文三行在文件里逐字出现
    for (const [i, l] of DEFAULT_BODY_LINES.entries()) {
      if (l === '') continue;
      c.includes(`机检：默认正文第 ${i + 1} 行逐字（A-7）`, content, l);
    }
    const vJson = c.cmd(skillValidate(root, ['--format', 'json']), 'orch skill validate --format json');
    const vp = jsonOf(vJson);
    c.evJson('validate-payload', vp);
    c.eq('机检：skill validate counts.invalid === 0', vp?.counts?.invalid, 0);

    return finish(c);
  }
}];
