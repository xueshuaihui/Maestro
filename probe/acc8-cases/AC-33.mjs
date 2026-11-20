/**
 * AC-33 · 已 accepted 的交接包不重投。
 *
 * Given：HO-001 为 accepted 且未 consumed、acceptedAt 已写；daemon 强杀后冷启动恢复。
 * Then：交接包仍是 已接受；没有重投行、没有「待投递」计数；deliveryAttempts 不变。
 */
import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-33', {
    scenario: 'accepted-not-redelivered',
    title: '已 accepted 的交接包不重投',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-33');
  c.root = root;
  try {
    const acceptedAt = new Date().toISOString();
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done', extra: { verdict: { value: 'pass', defects: [] } } }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'running', phase: 'assigned' }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-test', nodeId: 'T-002', roleId: 'tester', state: 'idle' })],
      handoffs: [handoffTpl({
        handoffId: 'HO-001', from: 'T-001', to: 'T-002', kind: 'forward',
        state: 'accepted', acceptedAt, deliveryAttempts: 1,
      })],
    });
    given.nodes[1].sessionId = 'mock-sess-test';
    const g = prepareGiven(root, given, {
      caps: 'resume', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));

    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    check(c, '夹具：recoveredAt 落盘，恢复窗口构造成功', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(b.afterState, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const handoffAfter = (b.afterState?.handoffs ?? []).find((h) => h.handoffId === 'HO-001');
    const pendingEvents = b.events.filter((e) => e.reason === 'handoff.pending'
      && (e.objectId === 'HO-001' || e.detail?.handoffId === 'HO-001'));
    const connectionEvents = b.events.filter((e) => e.reason === 'recovery.connection'
      && e.detail?.handoffId === 'HO-001');
    evidence(c, 'then', 'handoff-events.json', JSON.stringify({ pendingEvents, connectionEvents }, null, 2));

    eq(c, '机检：handoff.state === accepted', handoffAfter?.state ?? null, 'accepted');
    eq(c, '机检：deliveryAttempts 不变（仍为 1）', handoffAfter?.deliveryAttempts ?? null, 1);
    includes(c, 'Then：handoff list 仍显示「已接受」', handoffList.stdout, '已接受');
    excludes(c, 'Then：handoff list 无「待投递」', handoffList.stdout, '待投递');
    excludes(c, 'Then：status 无「待投递 · 重试」计数', status.stdout, '待投递 · 重试');
    excludes(c, 'Then：instance log 无该包的重投行', log.stdout, '已投递 → 待投递');
    eq(c, '机检：无该包 handoff.pending 事件', pendingEvents.length, 0);
    eq(c, '机检：无该包 recovery.connection 事件', connectionEvents.length, 0);

    note(c, 'Given 用受控 state.json（HO-001 accepted、acceptedAt 已写、未 consumed）。'
      + '「重启前状态词」以 Given 固定值核对：CLI 在冷启动时会立刻触发恢复，无法先取一份未恢复的 CLI 快照；'
      + '已以给定 state 与恢复后 state/CLI 对照，逐字断言 accepted 未变。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
