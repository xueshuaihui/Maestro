// AC-45 项目级技能可覆盖内置同名技能（用户可见 + 机检）
import {
  makeCase, freshRoot, writeSkill, roleValidate, roleShow, jsonOf, nodeTest,
  text, requirementTitle, finish
} from '../acc5-f-common.mjs';

const AC = 'AC-45';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '混合',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '混合' });
    const root = freshRoot(AC);
    c.add(root);

    // 动作前置：先记录内置版的通过结果
    const before = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json（内置版基线）');
    const beforePayload = jsonOf(before);
    c.evJson('payload-before', beforePayload);
    c.eq('前置：内置版全部通过（counts.invalid === 0）', beforePayload?.counts?.invalid, 0);
    c.eq('前置：内置版 counts.skills === 10', beforePayload?.counts?.skills, 10);

    // Given：项目根下的同名技能（id 相同、name/summary/正文都换成项目自己的）
    c.noteFixture('写 .orch/skills/code-change/SKILL.md（name: 代码修改（项目版））', writeSkill(root, 'code-change', {
      id: 'code-change',
      name: '代码修改（项目版）',
      summary: '项目自己的改码口径：先读产物行，再最小改动',
      appliesTo: '[coding]',
      commands: '["node --test"]',
      body: '### 项目口径\n\n1. 先读任务里「产物：」那一行。\n2. 只改必要位置，并在结束语里写清改了什么。\n'
    }));

    // When
    const after = c.cmd(roleValidate(root, ['--format', 'json']), 'orch role validate --format json（覆盖后）');
    const payload = jsonOf(after);
    c.evJson('payload-after', payload);

    // Then
    c.eq('Then 校验仍然全部通过（counts.invalid === 0）', payload?.counts?.invalid, 0);
    c.eq('Then counts.project === 1', payload?.counts?.project, 1);
    c.eq('机检：覆盖后 counts.skills 仍为 10（同 id 覆盖不增加总数）', payload?.counts?.skills, 10);
    c.eq('机检：counts.builtin 为 25', payload?.counts?.builtin, 25);
    c.eq('机检：counts.assets 仍为 26', payload?.counts?.assets, 26);

    const showRes = c.cmd(roleShow(root, 'developer', ['--format', 'json']), 'orch role show developer --format json');
    const showPayload = jsonOf(showRes);
    c.evJson('payload-developer', showPayload);
    c.deepEq('Then developer 的技能列表仍为 ["code-change","test-run"]', showPayload?.role?.skills, ['code-change', 'test-run']);
    c.includes('Then 引用按 id 解析，不因覆盖而变（技能名仍是 code-change）',
      JSON.stringify(showPayload?.role?.skills), 'code-change');

    // 机检：skills 表里 code-change 的 source === 'project'（需求原文：判定以该用例为准）
    const suite = c.cmd(nodeTest(['test/wp11/registry.test.js'], { timeout: 180000 }), 'node --test test/wp11/registry.test.js');
    const out = text(suite);
    c.evText('registry-test', out);
    const mFail = /^# fail (\d+)$/m.exec(out);
    const mPass = /^# pass (\d+)$/m.exec(out);
    c.eq('机检：registry.test.js 退出码 0', suite.exitCode, 0);
    c.eq('机检：fail = 0', Number(mFail?.[1] ?? -1), 0);
    c.check('机检：用例条数 ≥ 20（覆盖合并 / onlyRole / 资产根）', Number(mPass?.[1] ?? -1) >= 20, String(mPass?.[1]));

    return finish(c);
  }
}];
