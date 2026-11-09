// AC-17 技能详情含正文（用户可见 + 机检）
import {
  makeCase, freshRoot, skillShow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-17';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('全新项目根（无 .orch）', root);

    // When：orch skill show code-change
    const res = c.cmd(skillShow(root, 'code-change'), 'orch skill show code-change');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('show', text(res));

    // Then：前 6 行 + 第 7 行
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 第 1 行契约行', rows[0], '- code-change 代码修改 · 编码工程 · 命令 1');
    c.matches('Then 第 2 行摘要', rows[1], /^  摘要：.+$/);
    c.lineEq('Then 第 3 行命令', rows[2], '  命令：node --test');
    c.lineEq('Then 第 4 行适用', rows[3], '  适用：编码工程');
    c.lineEq('Then 第 5 行来源', rows[4], '  来源：内置 assets/skills/code-change/SKILL.md');
    c.lineEq('Then 第 6 行正文头', rows[5], '  正文：');
    c.lineEq('Then 第 7 行 = `  ### 工作方法`', rows[6], '  ### 工作方法');

    // 机检：行数、关键行、--format json 结构
    c.check('机检：lines.length > 7', rows.length > 7, `实际 ${rows.length} 行`);
    c.lineEq('机检：lines[5] === "  正文："', rows[5], '  正文：');
    c.lineEq('机检：lines[6] === "  ### 工作方法"', rows[6], '  ### 工作方法');
    const json = c.cmd(skillShow(root, 'code-change', ['--format', 'json']), 'orch skill show code-change --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.deepEq('机检：顶层键恰为 skill/body', Object.keys(payload ?? {}).sort(), ['body', 'skill']);
    c.includes('机检：body 含 ### 工作方法', payload?.body ?? '', '### 工作方法');
    c.eq('机检：skill 对象恰 7 键', Object.keys(payload?.skill ?? {}).length, 7);

    return finish(c);
  }
}];
