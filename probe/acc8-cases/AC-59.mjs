/**
 * AC-59 · 恢复前就「已分配」的节点保持已分配并重新派发（BR-53）。
 *
 * Given：受控 running 实例，T-001 running + phase=assigned + idle 会话；
 *        MAESTRO_TEST_RECOVERY_HOLD=after_assign 冻结在派发点后 SIGKILL。
 * When：冷启动恢复（hold 看一眼）→ 释放 hold → 让重新派发发生。
 * Then：hold 期间仍 assigned + 等待重新分配会话；释放后 phase=running；
 *       没有退回 pending；node.dispatch 只增加 1 次。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, excludes, evidence, note, finish } from '../acc8-f-common.mjs';
import {
  freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK,
} from '../acc8-f-lib.mjs';
import { baseState, nodeTpl, sessionTpl, prepareGiven, boot } from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-59', {
    scenario: 'assigned-kept-and-redispatched',
    title: '恢复前已分配的节点保持已分配并重新派发',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-59');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, {
      caps: 'resume', scenario: 'pass',
      extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：节点 state=running / phase=assigned（未开始执行）',
      given.nodes[0].state === 'running' && given.nodes[0].phase === 'assigned',
      JSON.stringify(given.nodes[0]));

    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    const held = b.afterState;
    const graphHeld = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const statusHeld = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'hold-state.json', JSON.stringify(held, null, 2));
    evidence(c, 'then', 'hold-graph.txt', graphHeld.stdout);
    evidence(c, 'then', 'hold-status.txt', statusHeld.stdout);
    evidence(c, 'then', 'hold-events.jsonl', b.events.map((e) => JSON.stringify(e)).join('\n'));
    const heldNode = (held?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    check(c, '夹具：recoveredAt 落盘，恢复窗口冻结成功', Boolean(held?.recoveredAt),
      JSON.stringify({ recoveredAt: held?.recoveredAt ?? null, boots: b.boots }));
    check(c, 'Then：hold 期间节点仍 running + phase=assigned',
      heldNode?.state === 'running' && heldNode?.phase === 'assigned', JSON.stringify(heldNode));
    includes(c, 'Then：graph 显示「已分配」', graphHeld.stdout, '已分配');
    includes(c, 'Then：graph 带「等待重新分配会话」后缀', graphHeld.stdout, '等待重新分配会话');
    eq(c, '机检：hold 期间无 node.dispatch（尚未重新派发）',
      b.events.filter((e) => e.reason === 'node.dispatch').length, 0);

    // When：释放 hold，让 continueRecovery 真正重新派发。
    fs.writeFileSync(path.join(root, '.mock', 'release'), '1', 'utf8');
    let released = null;
    for (let i = 0; i < 150; i += 1) {
      const st = readState(root);
      const n = (st?.nodes ?? []).find((x) => x.nodeId === 'T-001');
      if (n?.phase === 'running' || n?.state === 'done' || n?.state === 'review') { released = st; break; }
      await nap(100);
    }
    await nap(300);
    const after = released ?? readState(root);
    const events = readEvents(root);
    const graphAfter = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'released-state.json', JSON.stringify(after, null, 2));
    evidence(c, 'then', 'released-graph.txt', graphAfter.stdout);
    evidence(c, 'then', 'released-events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    const relNode = (after?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const dispatch = events.filter((e) => e.reason === 'node.dispatch'
      && (e.detail?.nodeId === 'T-001' || e.objectId === 'T-001'));
    evidence(c, 'then', 'dispatch-events.json', JSON.stringify(dispatch, null, 2));

    check(c, 'Then：释放后节点转执行中（phase=running 或已推进）',
      relNode?.phase === 'running' || ['done', 'review'].includes(relNode?.state),
      JSON.stringify(relNode));
    excludes(c, 'Then：没有退回「待执行」重新开始', graphAfter.stdout,
      'T-001 开发 · 待执行');
    eq(c, '机检：node.dispatch 只增加 1 次', dispatch.length, 1);
    check(c, '夹具：重新派发事件带 phase=running（由 assigned 直接推进）',
      dispatch.some((e) => e.detail?.phase === 'running'),
      JSON.stringify(dispatch.map((e) => e.detail ?? null)));
    check(c, '夹具：无 recoveredAt 之后的第二次恢复摘要',
      events.filter((e) => e.reason === 'recovery.summary').length === 1,
      JSON.stringify(events.filter((e) => e.reason === 'recovery.summary')));

    note(c, 'Given 用受控 state.json（T-001 running+assigned + idle 会话）替代真实 SIGKILL 窗口，'
      + '恢复与重新派发仍由产品核心连真 mock ACP 适配器执行。');
    note(c, '需求夹具写 MAESTRO_TEST_RECOVERY_HOLD=after_assign 停在派发点：'
      + '本用例先在该冻结点核对 assigned，再写 .mock/release 放行并核对只重新派发一次。');
    try { orch(root, ['core', 'stop'], { env: g.env }); } catch { /* 清理 */ }
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
