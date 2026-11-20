/**
 * AC-61 · 已构造未投递的交接包恢复后继续投递（BR-49）。
 *
 * Given：HO-001 state=created / deliveryAttempts=2 / 未投递；T-001 done，T-002 pending
 *        （避免 running+assigned 抢先无交接包重派发），目标会话 idle。
 * When：冷启动恢复，让 continueRecovery 继续投递。
 * Then：行从「已构造」转「已投递」；instance log 出现「恢复：交接包 HO-001 已构造 → 继续投递」；
 *       包号不变、重试次数不被清零、没有第二张同方向包。
 */
import fs from 'node:fs';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-61', {
    scenario: 'created-handoff-redelivered',
    title: '已构造未投递的交接包恢复后继续投递',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-61');
  c.root = root;
  try {
    const stamp = new Date().toISOString();
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'done',
          extra: { verdict: { value: 'pass', defects: [] } } }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'pending' }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-test', nodeId: 'T-002', roleId: 'tester', state: 'idle' })],
      handoffs: [handoffTpl({
        handoffId: 'HO-001', from: 'T-001', to: 'T-002', kind: 'forward',
        state: 'created', deliveryAttempts: 2,
        extra: { deliveredAt: null, pendingAt: null, createdAt: stamp, note: '等待投递' },
      })],
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：HO-001 已构造（created / 未投递 / deliveryAttempts=2）',
      given.handoffs[0].state === 'created' && given.handoffs[0].deliveredAt === null
      && given.handoffs[0].deliveryAttempts === 2,
      JSON.stringify(given.handoffs[0]));

    const b = await boot(root, g.env);
    await nap(4000);
    const state = readState(root);
    const events = readEvents(root);
    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);

    const h = (state?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
    const recoveryHandoffs = events.filter((e) => e.reason === 'recovery.handoff');
    const sameDirection = (state?.handoffs ?? []).filter((x) => x.fromNodeId === 'T-001' && x.toNodeId === 'T-002');
    evidence(c, 'then', 'recovery-handoff-events.json', JSON.stringify(recoveryHandoffs, null, 2));
    check(c, '夹具：recoveredAt 落盘，恢复链路启动', Boolean(state?.recoveredAt),
      JSON.stringify({ recoveredAt: state?.recoveredAt ?? null }));
    check(c, 'Then：交接包行从「已构造」转「已投递」',
      ['delivered', 'accepted', 'consumed'].includes(h?.state ?? null),
      JSON.stringify({ state: h?.state ?? null, handoff: h ?? null }));
    check(c, 'Then：handoff list 显示「已投递」或其后继状态（本机走到已接受）',
      /已投递|已接受|已完成/.test(handoffList.stdout),
      JSON.stringify(handoffList.stdout));
    includes(c, 'Then：instance log 出现「恢复：交接包 HO-001 已构造 → 继续投递」',
      log.stdout, '恢复：交接包 HO-001 已构造 → 继续投递');
    check(c, 'Then：handoffId 不变（HO-001）', h?.handoffId === 'HO-001', JSON.stringify(h?.handoffId ?? null));
    check(c, '夹具：deliveryAttempts 未被清零（>=1）', (h?.deliveryAttempts ?? 0) >= 1,
      JSON.stringify({ given: 2, after: h?.deliveryAttempts ?? null }));
    eq(c, '机检：没有第二张同方向交接包', sameDirection.length, 1);
    check(c, '夹具：recovery.handoff 事件 created → delivered',
      recoveryHandoffs.some((e) => e.detail?.handoffId === 'HO-001'
        && e.detail?.from === 'created' && e.detail?.to === 'delivered'),
      JSON.stringify(recoveryHandoffs));

    note(c, '本机实测：目标首个 turn 事件把交接包从 delivered 直接推到 accepted，'
      + 'handoff list 显示「已接受」而非需求措辞「已投递」；这是 delivered 的后继状态，'
      + '已按状态机语义断言并 note 记录，未改产品。');
    note(c, 'Given 用受控 state.json 固定「created 未投递 + deliveryAttempts=2」窗口，'
      + '继续投递与状态迁移仍由产品核心连真 mock ACP 适配器执行。');
    note(c, '目标节点用 pending 而非 running+assigned：后者会在无交接包路径先被重派发，'
      + '与 AC-35 同款冲突，取不到 created → delivered 链路。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
