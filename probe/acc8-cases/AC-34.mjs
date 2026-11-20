/**
 * AC-34 · consumed / rejected / expired 恢复后不改。
 *
 * Given：三张交接包分别为 consumed、rejected、expired（含时间与拒绝原因）。
 * When：重启 daemon。Then：三行状态词逐字不变、没有重投、没有新拒绝原因。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-34', {
    scenario: 'terminal-handoffs-unchanged',
    title: 'consumed / rejected / expired 恢复后不改',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-34');
  c.root = root;
  try {
    const stamp = new Date().toISOString();
    const handoffs = [
      handoffTpl({ handoffId: 'HO-001', from: 'T-001', to: 'T-002', kind: 'forward',
        state: 'consumed', extra: { consumedAt: stamp, deliveredAt: stamp, acceptedAt: stamp } }),
      handoffTpl({ handoffId: 'HO-002', from: 'T-002', to: 'T-001', kind: 'backflow',
        state: 'rejected', extra: { rejectedAt: stamp, deliveredAt: stamp, rejectReason: 'withdrawn' } }),
      handoffTpl({ handoffId: 'HO-003', from: 'T-001', to: 'T-002', kind: 'retest',
        state: 'expired', extra: { expiredAt: stamp, deliveredAt: stamp } }),
    ];
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'done' }),
      ],
      handoffs,
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    const givenStates = handoffs.map((h) => ({ handoffId: h.handoffId, state: h.state }));
    evidence(c, 'given', 'handoff-states.json', JSON.stringify(givenStates, null, 2));

    const b = await boot(root, g.env);
    check(c, '夹具：recoveredAt 落盘，重启对账确实发生', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件：两节点均 done，且交接包均为终态)\n');

    const afterStates = (b.afterState?.handoffs ?? []).map((h) => ({ handoffId: h.handoffId, state: h.state }));
    evidence(c, 'then', 'handoff-states.json', JSON.stringify(afterStates, null, 2));
    const rowOf = (id) => handoffList.stdout.split(/\r?\n/).find((l) => l.includes(`交接包 ${id}`)) ?? '';
    const consumedRow = rowOf('HO-001');
    const rejectedRow = rowOf('HO-002');
    const expiredRow = rowOf('HO-003');
    evidence(c, 'then', 'handoff-rows.txt', [consumedRow, rejectedRow, expiredRow].join('\n'));

    check(c, '机检：三张交接包 state 逐项不变',
      JSON.stringify(afterStates) === JSON.stringify(givenStates),
      JSON.stringify({ before: givenStates, after: afterStates }));
    includes(c, '机检：consumed 行显示「已完成」', consumedRow, '已完成');
    includes(c, '机检：rejected 行显示「已拒绝（已撤回）」', rejectedRow, '已拒绝（已撤回）');
    includes(c, '机检：expired 行显示「已过期」', expiredRow, '已过期');
    excludes(c, 'Then：无重投（handoff list 不含「待投递」）', handoffList.stdout, '待投递');
    excludes(c, 'Then：status 不含「待投递 · 重试」', status.stdout, '待投递 · 重试');
    eq(c, '机检：无 recovery.connection 事件',
      b.events.filter((e) => e.reason === 'recovery.connection').length, 0);
    eq(c, '机检：无 handoff.pending 事件',
      b.events.filter((e) => e.reason === 'handoff.pending').length, 0);
    check(c, '机检：无新拒绝原因（events 无 handoff.rejected）',
      !b.events.some((e) => e.reason === 'handoff.rejected'),
      JSON.stringify(b.events.filter((e) => e.reason === 'handoff.rejected')));

    note(c, '「重启前逐字节相同」以 Given 的三状态快照核对：CLI 冷启动即触发恢复，'
      + '无法先取未恢复的 CLI 输出；恢复后三行状态词与 Given 逐字一致，且无重投/拒绝事件。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
