// AC-46 单个资产不可解析：机检 assets.test.js（AC-46 现场 3 个角色文件：2 合法 + broken-role.yaml
// 内容不可解析；列表 3 行、只有坏行标「角色 broken-role · 不可读」、详情 reason 非空、计数 total=3）。
// 架构检查两条：单文件坏不得整目录降级（「资产不可读」零命中）、坏文件不得被过滤出列表（filter.*readable 零命中），
// 均按需求 §3.1 原文，文案只来自 labels 且仅在目录级失败时用。A-5 口径：单资产不可解析用「不可读」，
// 与目录级「资产不可读 · {目录}」区分。
import { makeCase, req, machineChecks, thenChecks, finish, ensureDir } from '../acc11-f-common.mjs';
const AC = 'AC-46';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 异常 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 异常 / 机检', grade: 'mock 实测' });
    const tmp = ensureDir(`/tmp/m11d-${AC}`);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "资产不可读" desktop/ui/assets/', expect: 1,
          note: 'AC-46 架构①：单文件坏不得整目录降级（UI assets 目录零「资产不可读」硬编码，exit 1）' },
        { cmd: 'grep -REn "filter.*readable" desktop/ui/assets/', expect: 1,
          note: 'AC-46 架构②：坏文件不得被过滤出列表（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('列表 3 行，broken-role 仍出现且只有它那行标「角色 broken-role · 不可读」（非整页降级）',
      Boolean(a?.subtests?.some((x) => /AC-46 单个资产不可解析/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-46/.test(x)).join(' | ') || '（未找到）',
      "unreadableRows===1 && dirUnreadable===false；broken-role 行逐字匹配 A-5『{kind} {id} · 不可读』");
    c.check('另外两行照常给出名称、分组、来源、校验状态（通过/不通过），计数 total 仍含坏项=3',
      Boolean(a?.v?.ok),
      `# pass assets ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      '另外两行 status ∈ {通过,不通过}；count.total===3（含 broken-role）');
    c.check('点开详情能看到解析失败原因、不白屏、不打印堆栈，列表与详情结论一致',
      Boolean(a?.v?.ok && c.arch.every((x) => x.ok)),
      `arch① exit ${c.arch[0]?.exit} / arch② exit ${c.arch[1]?.exit} / #pass ${a?.tap?.pass ?? 0}`,
      '详情 reason 非空、无堆栈；列表/详情对同一资产结论一致');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/assets.test.js（本分支存在），AC-46 逐字断言由其中「AC-46 单个资产不可解析：那一行标不可读，其余照常」用例承载；按实际文件机检并登记，不放宽。');
    c.note('A-5/D-13 口径：单资产不可解析用 `不可读`（DESKTOP_ASSET_ITEM_UNREADABLE=『{kind} {id} · 不可读』），区别于目录级 `资产不可读 · {dir}`（DESKTOP_ASSET_UNREADABLE，仅目录级失败用）；坏文件写 {{{{ 使整体不可解析，先起核再写盘，独立根 /tmp/m11d-AC-46。');
    return finish(c);
  }
}];
