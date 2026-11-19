// AC-22 工作流库列表与详情：机检 assets.test.js（AC-22 7 节点 8 边、节点清单同序、回流 2 条）。
import { makeCase, req, machineChecks, thenChecks, caseTmp, finish } from '../acc11-f-common.mjs';
const AC = 'AC-22';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '资产库 / 工作流 / 机检',
  async run() {
    const c = makeCase(AC, { face: '资产库 / 工作流 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['assets.test.js'],
      arch: [
        { cmd: 'grep -REn "人工验收|人工裁决" desktop/ui/assets/', expect: 1, note: 'AC-22 架构：节点类型只从定义 node_type 读，不按标题猜，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const a = c.testRuns.find((t) => t.file === 'assets.test.js');
    c.check('AC-22 工作流列表与详情用例存在：计数行/来源/7 节点 8 边/校验状态',
      Boolean(a?.subtests?.some((x) => /AC-22 工作流列表与详情/.test(x)) && a?.v?.ok),
      (a?.subtests ?? []).filter((x) => /AC-22/.test(x)).join(' | ') || '（未找到）',
      '列表行含 7 节点 · 8 条边；第 2 段只取内置/项目；来源计数相等');
    c.check('A-5 列表行逐字「工作流 release-flow · 项目 · 7 节点 · 8 条边 · 通过」（工作流行不含分组，BR-14）',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'nodeCount=7 / edgeCount=8 / group=null / source=项目');
    c.check('A-5 详情块逐字：7 节点清单同序（角色/人工/子工作流）、回流 2 条、校验通过',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      "节点序列 ['T-001','T-002','T-003','H-001','S-001','T-004','T-005']；backflowCount=2");
    c.check('节点类型按 node_type 读（角色 5 / 人工 1 / 子工作流 1），sub-flow 真实存在不报 WORKFLOW_SUB_UNKNOWN',
      Boolean(a?.v?.ok),
      `# pass ${a?.tap?.pass ?? 0} / # fail ${a?.tap?.fail ?? 0}`,
      'byType role=5 / human=1 / subworkflow=1；校验通过');
    thenChecks(c);
    c.note('逐字断言由 test/wp14/assets.test.js 的 AC-22 用例承载；夹具按 H-17 写两份定义（release-flow 7 节点 8 边 + sub-flow 供 S-001 引用），5 个角色节点 role 取注册表内置 id（developer/tester/reviewer/code-reviewer/writer），避免 WORKFLOW_ROLE_UNKNOWN / WORKFLOW_SUB_UNKNOWN。A-5 详情块与 A-7/AC-29 同一份 release-flow（D-31）。');
    return finish(c);
  }
}];
