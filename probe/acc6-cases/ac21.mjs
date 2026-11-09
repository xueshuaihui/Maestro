// AC-21 内置工作流可列出（用户可见 + 机检）
import {
  makeCase, freshRoot, workflowList, jsonOf,
  text, nonEmptyLines, clean, requirementTitle, finish
} from '../acc6-f-common.mjs';

const AC = 'AC-21';
// A-8 的三行逐字（id 字典序）。
const EXPECTED_ROWS = [
  '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置',
  '- single 单节点 · 1 节点 · 0 边 · 内置',
  '- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置'
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

    // When：orch workflow list
    const res = c.cmd(workflowList(root), 'orch workflow list');
    const rows = nonEmptyLines(clean(text(res)));
    c.evText('list', text(res));

    // Then：首行 + 三行 + 退出码 0
    c.eq('Then 退出码 0', res.exitCode, 0);
    c.lineEq('Then 首行 = 工作流 3 个（内置 3 · 项目 0）', rows[0], '工作流 3 个（内置 3 · 项目 0）');
    c.deepEq('Then 随后三行逐字（A-8）', rows.slice(1), EXPECTED_ROWS);
    c.eq('机检：总行数 4', rows.length, 4);

    // 机检：--format json 的结构与键数
    const json = c.cmd(workflowList(root, ['--format', 'json']), 'orch workflow list --format json');
    const payload = jsonOf(json);
    c.evJson('payload', payload);
    c.deepEq('机检：顶层键恰为 counts/workflows', Object.keys(payload ?? {}).sort(), ['counts', 'workflows']);
    c.eq('机检：counts.total === 3', payload?.counts?.total, 3);
    c.eq('机检：workflows[0] 恰 6 键', Object.keys(payload?.workflows?.[0] ?? {}).length, 6);
    c.deepEq('机检：workflows[0] 键集合', Object.keys(payload?.workflows?.[0] ?? {}).sort(),
      ['edgeCount', 'file', 'id', 'name', 'nodeCount', 'source']);
    c.eq('机检：workflows[0].source === builtin', payload?.workflows?.[0]?.source, 'builtin');
    c.eq('机检：workflows[0].file === null', payload?.workflows?.[0]?.file, null);

    return finish(c);
  }
}];
