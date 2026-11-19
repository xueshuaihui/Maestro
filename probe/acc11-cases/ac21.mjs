// AC-21 技能库列表与详情：机检 assets.test.js（AC-21 正文摘要按上限截断）+ BODY_PREVIEW_LINES 双锚点。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-21';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 技能 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 技能 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "BODY_PREVIEW_LINES" src/daemon desktop/ui', expect: 0, lines: 2, note: 'AC-21 架构①：BODY_PREVIEW_LINES 恰好 2 命中（定义 1 + 使用 1，exit 0）' },
        { cmd: 'grep -REn "BODY_PREVIEW_LINES =" src/daemon desktop/ui', expect: 0, lines: 1, note: 'AC-21 架构②：BODY_PREVIEW_LINES 定义恰好 1 条（exit 0）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('AC-21 技能列表与详情用例存在：计数行/每行来源命令数校验状态/详情字段',
      Boolean(a?.subtests?.some((x) => /AC-21 技能列表与详情/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-21/.test(x)).join(' | ') || '（未找到）',
      '项目技能来源=项目 / 内置技能来源=内置；每行按 · 切分段数一致');
    c.check('A-5 计数行与列表行逐字：「技能 {total} 个（内置 {builtin} · 项目 {project}）」；来源计数相等',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'counts.total === builtin + project；第 3 段只取内置/项目');
    c.check('详情给中文名/分组/命令/摘要/正文摘要，正文不整篇铺开（≤20 行）',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'bodyPreviewLines <= 20；40 行正文只取前 20 行；不含第 40 行正文');
    c.check('BODY_PREVIEW_LINES = 20 常量在 src/daemon 侧、界面只消费（用例内 assert.equal(BODY_PREVIEW_LINES, 20) 承载）',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'BODY_PREVIEW_LINES === 20；assets-view.js 定义 + 使用');
    thenChecks(c);
    c.note('逐字断言由 test/wp14/assets.test.js 的 AC-21 用例承载（计数行/列表行来源命令数校验状态/详情字段/正文摘要行数上限 20）；两条 BODY_PREVIEW_LINES 架构锚点按需求 §3.1 AC-21 原文核对（定义 1 + 使用 1 = 2 命中）。');
    return finish(c);
  }
}];
