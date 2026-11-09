// AC-16 技能清单可列且格式稳定（用户可见 + 机检）
import {
  makeCase, freshRoot, skillList, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-16';
// A-6 的 10 行逐字（id 字典序）。
const EXPECTED_ROWS = [
  '- code-change 代码修改 · 编码工程 · 命令 1',
  '- code-review 代码审查 · 编码工程 · 命令 0',
  '- compliance-check 合规审查 · 业务运营 · 命令 0',
  '- coordination 编排协调 · 通用协调 · 命令 0',
  '- data-analysis 数据分析 · 研究分析 · 命令 1',
  '- doc-draft 文档撰写 · 内容创作 · 命令 0',
  '- doc-review 文档审核 · 内容创作 · 命令 0',
  '- fact-check 事实核查 · 研究分析 · 命令 0',
  '- research-brief 调研笔记 · 研究分析 · 命令 0',
  '- test-run 测试执行 · 编码工程 · 命令 1'
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

    // When：orch skill list
    const res = c.cmd(skillList(root), 'orch skill list');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('list', text(res));

    // Then：首行 + 10 行 + 退出码 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行 = 技能 10 个（内置 10 · 项目 0）', rows[0], '技能 10 个（内置 10 · 项目 0）');
    c.deepEq('Then 随后 10 行逐字（A-6，id 字典序）', rows.slice(1), EXPECTED_ROWS);
    c.eq('机检：总行数 11', rows.length, 11);

    // 机检：--format json 的结构与键数
    const json = c.cmd(skillList(root, ['--format', 'json']), 'orch skill list --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.deepEq('机检：顶层键恰为 counts/skills', Object.keys(payload ?? {}).sort(), ['counts', 'skills']);
    c.deepEq('机检：counts 恰 4 键（total/builtin/project/invalid）', Object.keys(payload?.counts ?? {}).sort(), ['builtin', 'invalid', 'project', 'total']);
    c.eq('机检：skills 长度 10', (payload?.skills ?? []).length, 10);
    const keySets = (payload?.skills ?? []).map((s) => Object.keys(s).sort().join(','));
    c.eq('机检：每个技能对象恰 7 键', [...new Set(keySets)].join('|'),
      'appliesTo,appliesToLabels,commands,file,id,name,source');

    return finish(c);
  }
}];
