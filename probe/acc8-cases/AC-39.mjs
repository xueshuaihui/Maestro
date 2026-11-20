/**
 * AC-39 · failed 节点保持 failed。
 *
 * Given：夹具预置一个 code-loop 的 failed 节点 T-001 + 既有下一步指向 T-002；daemon 强杀。
 * When：重启 daemon。Then：节点仍「失败」；无自动重跑；status 仍显示既有下一步。
 */
import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, prepareGiven, boot } from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-39', {
    scenario: 'failed-node-held',
    title: 'failed 节点保持 failed',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-39');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'failed',
          extra: { failure: { code: 'VERIFY_FAILED', message: '核对失败：缺陷未修复' } } }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'pending' }),
      ],
      extra: { note: '既有下一步：修复 T-001 缺陷后重跑测试' },
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：T-001 failed 且 T-002 为既有下一步',
      given.nodes[0].state === 'failed' && given.nodes[1].state === 'pending',
      JSON.stringify(given.nodes));

    const b = await boot(root, g.env);
    check(c, '夹具：recoveredAt 落盘，重启对账发生', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const graph = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'graph.txt', graph.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout || '(实例日志无新增行)\n');
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const node = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const next = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-002');
    eq(c, 'Then：失败节点 state === failed', node?.state ?? null, 'failed');
    includes(c, 'Then：graph 显示「T-001 开发 · 失败」', graph.stdout, 'T-001 开发 · 失败');
    eq(c, 'Then：既有下一步节点未变（T-002 仍 pending）', next?.state ?? null, 'pending');
    eq(c, '机检：node.dispatch 次数不变（0 → 0）',
      b.events.filter((e) => e.reason === 'node.dispatch').length, 0);
    check(c, 'Then：实例未自动重跑失败节点（无该节点新会话/派发）',
      !(b.afterState?.sessions ?? []).some((s) => s.nodeId === 'T-001')
      && !b.events.some((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-001'),
      JSON.stringify({ sessions: b.afterState?.sessions ?? [], dispatches: b.events.filter((e) => e.reason === 'node.dispatch') }));
    includes(c, 'Then：status 仍显示既有下一步节点「T-002 测试 待执行」', status.stdout, '节点 T-002 测试 待执行');
    includes(c, 'Then：status 仍显示失败节点', status.stdout, '失败');

    note(c, 'Given 用受控 state.json 预置 failed 节点与 pending 的既有下一步；'
      + '「既有下一步」按 status 的「节点 T-002 测试 待执行」行核对（running 实例不打印独立的「下一步：」引导行）。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
