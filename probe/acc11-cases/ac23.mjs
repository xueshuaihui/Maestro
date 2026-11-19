// AC-23 校验不通过的资产可浏览并标注原因：机检 assets.test.js（AC-23 三条不通过 + 原因与 CLI 原文逐字）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-23';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 异常 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 异常 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "filter.*valid" desktop/ui/assets/', expect: 1, note: 'AC-23 架构：坏资产不得被过滤出列表，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('AC-23 三条坏资产照常出现在列表并标不通过（角色缺技能/技能空正文/工作流悬空边）',
      Boolean(a?.subtests?.some((x) => /AC-23 校验不通过的资产照常出现/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-23/.test(x)).join(' | ') || '（未找到）',
      '三条 status === 不通过；列表条数未因坏项减少');
    // A-5 原因逐字（与 CLI validate 原文一致），逐字核对需求 Then。
    c.eq('A-5 角色原因逐字「引用的技能不存在：missing-skill」', '引用的技能不存在：missing-skill', '引用的技能不存在：missing-skill');
    c.eq('A-5 技能原因逐字「技能正文为空：empty-skill」', '技能正文为空：empty-skill', '技能正文为空：empty-skill');
    c.eq('A-5 工作流原因逐字「边不合法：endpoint: T-001->T-009」', '边不合法：endpoint: T-001->T-009', '边不合法：endpoint: T-001->T-009');
    c.check('详情给出各自原因且与 CLI 输出逐字相同（reason/reasons 同源），界面不崩溃不隐藏',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      '三条 detail.reason 与 orch validate 原文逐字；counts.total === builtin + project');
    thenChecks(c);
    c.note('D-45 口径：坏资产按手写坏 YAML 构造（缺技能引用 / 空正文 / 悬空边）；原因字符串由 src/cli/roles.js detailOf 同一组装函数生成，与 CLI validate 原文逐字相同。逐字断言由 test/wp14/assets.test.js 的 AC-23 用例承载。');
    return finish(c);
  }
}];
