// AC-19 角色库列表：机检 assets.test.js（AC-19 三类列表计数自洽）+ ui-views.test.js（A-5 计数行逐字）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-19';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 列表 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 列表 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "yaml|readFile" desktop/ui/assets/', expect: 1, note: 'AC-19 架构：列表投影复用既有注册表读取与校验结果，不在界面层重跑 schema 校验，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');
    c.check('AC-19 三类列表用例存在：来源/分组/校验状态与计数自洽',
      Boolean(a?.subtests?.some((x) => /AC-19 三类列表/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-19/.test(x)).join(' | ') || '（未找到）',
      '三处分页 total === builtin + project 且与行数自洽');
    c.check('三个分页计数行自洽：角色/技能/工作流各自 total = builtin + project',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'roles/skills/workflows 三处 counts.total === builtin + project');
    c.check('角色行给名称/分组/来源/校验状态，缺失技能那个标不通过',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'proj-coder 通过 / proj-gap（skills:[not-exist]）不通过');
    c.check('A-5 计数行逐字「角色 {total} 个（内置 {builtin} · 项目 {project}）」等三处（ui-views 逐字用例承载）',
      Boolean(u?.subtests?.some((x) => /A-5: three tabs, count line/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /three tabs|count line/.test(x)).join(' | ') || '（未找到）',
      '「角色 12 个（内置 9 · 项目 3）」逐字；资产行「角色 开发 · 编码工程 · 项目 · 通过」');
    thenChecks(c);
    c.note('逐字断言由 test/wp14/assets.test.js 的 AC-19 用例（计数自洽、来源/分组/校验状态）与 ui-views.test.js 的「A-5: three tabs, count line, rows and unreadable banners are verbatim」承载；harness assets-dump 同模块导出计数行（ui-views「harness: assets-dump exports tabs + count verbatim」复核）。');
    return finish(c);
  }
}];
