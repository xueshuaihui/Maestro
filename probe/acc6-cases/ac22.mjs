// AC-22 工作流详情给出节点、边与类型（用户可见 + 机检）
import {
  makeCase, freshRoot, workflowShow, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-22';
// A-8 的 show 全文（code-loop，7 行逐字）。
const EXPECTED_SHOW = [
  '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置',
  '  入口：T-001 · 终点：T-002',
  '  节点：',
  '    T-001 开发 · 角色节点 developer · 超时 — · 重试 0',
  '    T-002 测试 · 角色节点 tester · 超时 — · 重试 0',
  '  边：',
  '    T-001 → T-002 正向',
  '    T-002 → T-001 回流 · 轮次上限 2',
  '    T-001 → T-002 复测'
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

    // When：orch workflow show code-loop
    const res = c.cmd(workflowShow(root, 'code-loop'), 'orch workflow show code-loop');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('show', text(res));

    // Then：首行 + 入口终点行 + 节点两行 + 边三行（A-8 逐字）
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.deepEq('Then show 全文 9 行逐字（A-8）', rows, EXPECTED_SHOW);
    c.lineEq('Then 首行逐字', rows[0], '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置');
    c.lineEq('Then 边含回流行逐字', rows[7], '    T-002 → T-001 回流 · 轮次上限 2');

    // 机检：--format json 的 nodes/edges 结构
    const json = c.cmd(workflowShow(root, 'code-loop', ['--format', 'json']), 'orch workflow show code-loop --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：nodes 长度 2', (payload?.nodes ?? []).length, 2);
    const keySets = (payload?.nodes ?? []).map((n) => Object.keys(n).sort().join(','));
    c.eq('机检：每个节点恰 11 键',
      [...new Set(keySets)].join('|'),
      'id,inputs,maxRounds,nodeType,outputs,parallelScope,retry,role,scope,timeout,title');
    c.eq('机检：nodes[0].nodeType === role', payload?.nodes?.[0]?.nodeType, 'role');
    c.eq('机检：edges 长度 3', (payload?.edges ?? []).length, 3);
    c.eq('机检：edges[1].kind === backflow', payload?.edges?.[1]?.kind, 'backflow');

    return finish(c);
  }
}];
