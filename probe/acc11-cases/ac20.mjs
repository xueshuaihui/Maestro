// AC-20 角色详情：机检 assets.test.js（AC-20 契约要点/缺失技能/原因与 CLI 原文一致）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-20';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 详情 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 详情 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "worktree|versioned|snapshot" desktop/ui/assets/', expect: 1, note: 'AC-20 架构：详情字段只读注册表与校验输出，不在界面层推断产物隔离方式，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('AC-20 角色详情用例存在：契约要点逐项显示（分组/产物/副作用/并发/技能/工具/唤醒）',
      Boolean(a?.subtests?.some((x) => /AC-20 角色详情/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-20/.test(x)).join(' | ') || '（未找到）',
      'artifactType=code / sideEffect=write / maxConcurrentSessions=2 / tools 3 项 / wakeAllow 2 项');
    c.check('A-5 详情块逐字：产物 code · 副作用 write · 并发 2 / 技能引用 2 个 / 工具 / 唤醒',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      '「角色 开发 · 编码工程 · 产物 code · 副作用 write · 并发 2」等 A-5 详情块逐字');
    c.check('缺失技能标「缺失」并给出技能名（A-5 状态词）',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'skills[1] === { id: missing-skill, missing: true }；界面渲染「s2 · 缺失」');
    c.check('校验状态「不通过」且原因与 CLI `orch role validate` 原文逐字相同',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'reason === 引用的技能不存在：missing-skill（与 detailOf 同一组装函数）');
    thenChecks(c);
    c.note('逐字断言由 test/wp14/assets.test.js 的 AC-20 用例承载（详情字段透传、missing-skill 标缺失、reason 与 src/cli/roles.js detailOf 同一函数）；A-5 角色详情块逐字见 requirement 附录 A-5，ui-views.test.js「A-5: detail lines render fixed order with missing markers」复核「缺失/校验」渲染。');
    return finish(c);
  }
}];
