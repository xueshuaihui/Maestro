// AC-23 项目工作流覆盖同名内置（用户可见 + 机检）
// Given：全新项目根，预置 .orch/workflows/code-loop.yaml（3 节点、4 边，与内置 2 节点 3 边
// 结构不同但合法）。同名项目工作流整体覆盖内置（C-11 / BR-18）。
import {
  makeCase, freshRoot, workflowList, workflowShow, jsonOf, writeWorkflow,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-23';
// 3 节点 4 边的合法覆盖版：T-001 →(T-002,T-003)，T-002 → T-003，T-003 →(backflow) T-002。
// 节点级 wake_allow 声明避免 ⑬（D-3：节点级优先于角色资产；tester 资产白名单为空数组）。
const OVERRIDE_YAML = [
  'schema: workflow/v1',
  'id: code-loop',
  'name: 编码闭环',
  'summary: 项目侧的三节点覆盖版',
  'entry: T-001',
  'terminal: T-003',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 开发',
  '    wake_allow: [tester]',
  '  - id: T-002',
  '    node_type: role',
  '    role: tester',
  '    title: 测试',
  '    wake_allow: [tester]',
  '    max_rounds: 2',
  '  - id: T-003',
  '    node_type: role',
  '    role: tester',
  '    title: 验收',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  '  - from: T-001',
  '    to: T-003',
  '  - from: T-002',
  '    to: T-003',
  '  - from: T-003',
  '    to: T-002',
  '    kind: backflow',
  '    when: failed',
  ''
].join('\n');

export const cases = [{
  ac: AC,
  title: requirementTitle(AC),
  face: '用户可见',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '用户可见' });
    const root = freshRoot(AC);
    c.add(root);
    c.noteFixture('预置 .orch/workflows/code-loop.yaml（3 节点 4 边，覆盖同名内置）', OVERRIDE_YAML);
    writeWorkflow(root, 'code-loop', OVERRIDE_YAML);

    // When：orch workflow list
    const res = c.cmd(workflowList(root), 'orch workflow list');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('list', text(res));

    // Then：首行计数（内置 2 · 项目 1）+ 覆盖条目行
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行 = 工作流 3 个（内置 2 · 项目 1）', rows[0], '工作流 3 个（内置 2 · 项目 1）');
    c.lineEq('Then code-loop 条目行逐字', rows[1], '- code-loop 编码闭环 · 3 节点 · 4 边 · 项目');
    c.eq('Then 总行数 4（首行 + 三条目）', rows.length, 4);

    // When：orch workflow show code-loop
    const show = c.cmd(workflowShow(root, 'code-loop'), 'orch workflow show code-loop');
    const showRows = nonEmptyLines(clean(text(show)));
    c.evText('show', text(show));
    c.eq('Then show 退出码 0', show.exitCode, 0);
    c.lineEq('Then show 首行逐字', showRows[0], '- code-loop 编码闭环 · 3 节点 · 4 边 · 项目');

    // 机检：--format json 的 counts 与同名条目来源
    const json = c.cmd(workflowList(root, ['--format', 'json']), 'orch workflow list --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.eq('机检：counts.builtin === 2', payload?.counts?.builtin, 2);
    c.eq('机检：counts.project === 1', payload?.counts?.project, 1);
    const entry = (payload?.workflows ?? []).find((w) => w.id === 'code-loop');
    c.eq('机检：同名条目 source === project', entry?.source, 'project');
    c.eq('机检：同名条目 file === .orch/workflows/code-loop.yaml', entry?.file, '.orch/workflows/code-loop.yaml');

    // 机检：show 的节点数为 3
    const showJson = c.cmd(workflowShow(root, 'code-loop', ['--format', 'json']), 'orch workflow show code-loop --format json');
    const showPayload = jsonOf(showJson);
    c.evJson('show-payload', showPayload);
    c.eq('机检：show 的 workflow.nodeCount === 3', showPayload?.workflow?.nodeCount, 3);
    c.eq('机检：show 的 nodes 长度 3', (showPayload?.nodes ?? []).length, 3);

    return finish(c);
  }
}];
