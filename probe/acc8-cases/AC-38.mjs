/**
 * AC-38 · escalate 节点保持 escalated。
 *
 * Given：夹具预置 escalate 节点 T-003 escalated + 一张 ESC-001 待处理升级；daemon 强杀。
 * When：重启 daemon。Then：节点仍「已升级」；无重派、无新升级；escalations 计数不变。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, prepareGiven, boot } from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-38', {
    scenario: 'escalated-node-held',
    title: 'escalate 节点保持 escalated',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-38');
  c.root = root;
  try {
    const stamp = new Date().toISOString();
    const escalation = {
      escalationId: 'ESC-001', instanceId: 'INST-001', nodeId: 'T-003',
      roleId: 'developer', state: 'pending', round: 2, reason: '合并冲突',
      createdAt: stamp, updatedAt: stamp,
    };
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-003', roleId: 'developer', state: 'escalated', extra: { failure: { code: 'MERGE_CONFLICT' } } }),
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done', extra: { verdict: { value: 'pass', defects: [] } } }),
      ],
      escalations: [escalation],
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：T-003 escalated + ESC-001 pending',
      given.nodes[0].state === 'escalated' && given.escalations[0].state === 'pending',
      JSON.stringify({ node: given.nodes[0], escalation }));

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

    const node = (b.afterState?.nodes ?? []).find((n) => n.nodeId === 'T-003');
    eq(c, 'Then：节点 state === escalated', node?.state ?? null, 'escalated');
    includes(c, 'Then：status 显示节点 T-003「已升级」', status.stdout, '节点 T-003 开发 已升级');
    includes(c, 'Then：status 显示升级 ESC-001', status.stdout, '升级 ESC-001');
    eq(c, '机检：escalations 计数不变（仍 1）', (b.afterState?.escalations ?? []).length, 1);
    eq(c, '机检：升级号未变（仍 ESC-001）', b.afterState?.escalations?.[0]?.escalationId ?? null, 'ESC-001');
    eq(c, '机检：无 node.dispatch', b.events.filter((e) => e.reason === 'node.dispatch').length, 0);
    eq(c, '机检：无新升级（escalation.created）',
      b.events.filter((e) => e.reason === 'escalation.created').length, 0);
    excludes(c, 'Then：无「已升级 → 执行中」重派', graph.stdout, 'T-003 开发 · 执行中');

    note(c, 'Given 用受控 state.json 预置 escalate 节点与待处理升级；'
      + '恢复核心按 §3.6 跳过 escalated/failed 节点，本机逐项核对状态与计数未变。');
    note(c, 'graph --format text 只渲染内置图声明的 T-001/T-002，故 T-003 的「已升级」在 status 节点行核对；'
      + 'status 同时保留升级块与 ESC-001 号。');
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
