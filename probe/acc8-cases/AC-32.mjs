/**
 * AC-32 · delivered 未 accepted → pending 并重投。
 *
 * Given：T-002 测试节点 done（判失败）+ T-001 开发节点 running(phase=assigned) + idle 会话，
 * 回流交接包 HO-001（测试→开发）为 delivered 且 acceptedAt=null、deliveryAttempts=1；
 * 用 after_assign hold 冻结在「已改 pending、尚未重投」窗口。
 * Then：handoff list 待投递、status 待投递 · 重试 n/2、instance log 连接线重投行。
 */
import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

export async function run() {
  const c = makeCase('AC-32', {
    scenario: 'delivered-to-pending-redeliver',
    title: 'delivered 未 accepted → pending 并重投',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-32');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'done', extra: { verdict: { value: 'fail', defects: [{ summary: '除零未处理', evidence: 'calc.test.js' }] } } }),
      ],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
      handoffs: [handoffTpl({
        handoffId: 'HO-001', from: 'T-002', to: 'T-001', kind: 'backflow',
        state: 'delivered', acceptedAt: null, deliveryAttempts: 1,
      })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, {
      caps: 'resume', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    check(c, 'Given：HO-001 delivered 且 acceptedAt=null、deliveryAttempts>=1',
      given.handoffs[0].state === 'delivered' && given.handoffs[0].acceptedAt === null
      && given.handoffs[0].deliveryAttempts >= 1, JSON.stringify(given.handoffs[0]));

    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    check(c, '夹具：recoveredAt 落盘，重投窗口冻结成功', Boolean(b.afterState?.recoveredAt),
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
    const connectionEvents = b.events.filter((e) => e.reason === 'recovery.connection');
    evidence(c, 'then', 'connection-events.json', JSON.stringify(connectionEvents, null, 2));

    eq(c, 'Then：交接包 state === pending（产品核心动作，非夹具写死）', handoffAfter?.state ?? null, 'pending');
    check(c, '夹具：deliveryAttempts >= 1', (handoffAfter?.deliveryAttempts ?? 0) >= 1,
      JSON.stringify({ deliveryAttempts: handoffAfter?.deliveryAttempts ?? null }));
    includes(c, 'Then：handoff list 显示「待投递」', handoffList.stdout, '待投递');
    includes(c, 'Then：status 交接包行显示「待投递 · 重试 n/2」', status.stdout, '待投递 · 重试');
    includes(c, 'Then：instance log 出现「连接线 测试→开发（回流） 已投递 → 待投递（重投）」',
      log.stdout, '恢复：连接线 测试→开发（回流） 已投递 → 待投递（重投）');
    check(c, '夹具：recovery.connection 事件 delivered → pending（kind=backflow）',
      connectionEvents.some((e) => e.detail?.handoffId === 'HO-001'
        && e.detail?.fromState === 'delivered' && e.detail?.toState === 'pending'
        && e.detail?.kind === 'backflow'), JSON.stringify(connectionEvents));
    check(c, '夹具：hold 冻结时尚未真正重投（无 node.dispatch）',
      !b.events.some((e) => e.reason === 'node.dispatch'),
      `dispatch=${b.events.filter((e) => e.reason === 'node.dispatch').length}`);

    note(c, '需求夹具写 MAESTRO_TEST_PAUSE=after_accepted:developer 之前强杀；本用例用受控 state.json'
      + '直接构造同一窗口（HO-001 delivered、acceptedAt=null、deliveryAttempts=1），再经真 SIGKILL 后冷启动'
      + '触发核心对账，delivered→pending 与连接线重投行均由产品核心产生。');
    note(c, '需求示例方向「测试→开发（回流）」由 HO-001 edge=T-002→T-001/kind=backflow 映射得到，逐字断言。');
    note(c, '本机实测差异（交主控裁决）：instance log 的恢复连接线行渲染为'
      + '「恢复：连接线 tester→developer（回流） 已投递 → 待投递（重投）」，使用角色 id 而非 labels.js 的中文名。'
      + 'handoff list / status 与 graph 的方向均为「测试→开发（回流）」，仅恢复日志行不同。'
      + '已按需求原文保留断言并如实判不通过，未放宽、未改产品代码。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
