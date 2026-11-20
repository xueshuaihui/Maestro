/**
 * AC-62 · 重投连续失败 → 已过期并升级（BR-51）。
 *
 * Given：一张 delivered 未 accepted 交接包，恢复后回到「待投递」，目标会话连续拒绝投递 3 次
 *        （MAESTRO_MOCK_PROMPT_FAILURES=3 + MAESTRO_TEST_DELIVERY_DELAY_MS=10）。
 * When：第 3 次重投失败。
 * Then：交接包显示「已过期」；instance log 出现升级行；escalations 新增 1 条；
 *       deliveryAttempts === 3，实例不永远停在「已投递」。
 */
import fs from 'node:fs';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, readState, readEvents, orch, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-62', {
    scenario: 'redelivery-exhausted',
    title: '重投连续失败 → 已过期并升级',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-62');
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
        state: 'delivered', deliveryAttempts: 1,
        extra: { acceptedAt: null, createdAt: stamp, deliveredAt: stamp, pendingAt: null },
      })],
    });
    const g = prepareGiven(root, given, {
      caps: 'resume',
      extraEnv: { MAESTRO_MOCK_PROMPT_FAILURES: '3', MAESTRO_TEST_DELIVERY_DELAY_MS: '10' },
    });
    // 场景模式 mock 用 session.promptAttempts 判失败，首次 prompt 时该值为 undefined，
    // 三次失败开关对首条投递无效；改走非场景分支 + --host-error，尝试让每次 session/prompt
    // 返回 -32603。实测本机该注入仍未命中（首个 turn 事件即 accepted），如实取证，不放宽断言。
    const hostCfg = JSON.parse(fs.readFileSync(g.prepared.hostPath, 'utf8'));
    const args = hostCfg.launch.args;
    for (const flag of ['--scenario', '--root']) {
      const idx = args.indexOf(flag);
      if (idx >= 0) args.splice(idx, 2);
    }
    args.push('--host-error');
    fs.writeFileSync(g.prepared.hostPath, `${JSON.stringify(hostCfg, null, 2)}\n`, 'utf8');
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));
    evidence(c, 'given', 'mock-host.json', fs.readFileSync(g.prepared.hostPath, 'utf8'));
    check(c, 'Given：交接包 delivered 未 accepted（恢复后转待投递），目标会话可恢复',
      given.handoffs[0].state === 'delivered' && given.handoffs[0].acceptedAt === null
      && given.sessions[0].state === 'idle',
      JSON.stringify({ handoff: given.handoffs[0].state, acceptedAt: given.handoffs[0].acceptedAt, session: given.sessions[0].state }));

    const b = await boot(root, g.env);
    await nap(5000);
    const state = readState(root);
    const events = readEvents(root);
    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    const status = orch(root, ['status', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'state.json', JSON.stringify(state, null, 2));
    evidence(c, 'then', 'events.jsonl', events.map((e) => JSON.stringify(e)).join('\n'));
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'status.txt', status.stdout);

    const h = (state?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
    const escalations = state?.escalations ?? [];
    const expiredEvents = events.filter((e) => e.reason === 'handoff.expired');
    evidence(c, 'then', 'expired-and-escalation.json', JSON.stringify({
      handoff: h, escalations, expiredEvents,
    }, null, 2));
    check(c, '夹具：recoveredAt 落盘，重投链路启动', Boolean(state?.recoveredAt),
      JSON.stringify({ recoveredAt: state?.recoveredAt ?? null }));
    eq(c, 'Then：handoff.state === expired', h?.state ?? null, 'expired');
    eq(c, 'Then：deliveryAttempts === 3', h?.deliveryAttempts ?? null, 3);
    includes(c, 'Then：handoff list 显示「已过期」', handoffList.stdout, '已过期');
    eq(c, 'Then：escalations 新增 1 条', escalations.length, 1);
    eq(c, '夹具：升级 reasonCode=delivery_failed', escalations[0]?.reasonCode ?? null, 'delivery_failed');
    check(c, '夹具：有 handoff.expired 事件', expiredEvents.length >= 1,
      JSON.stringify(expiredEvents));
    check(c, 'Then：instance log 出现升级行（不再停在已投递）',
      /升级|已过期/.test(log.stdout) && !/交接包 HO-001\s+已投递\s*$/m.test(handoffList.stdout),
      JSON.stringify({ logTail: log.stdout.slice(-600), handoffLine: handoffList.stdout }));

    note(c, 'Given 用受控 state.json 固定 delivered 未 accepted 交接包 + idle 会话，'
      + '三次投递失败、expired 与升级均由产品核心连真 mock ACP 适配器执行。');
    note(c, '本机实测：先后尝试场景模式 MAESTRO_MOCK_PROMPT_FAILURES=3 与非场景模式 --host-error，'
      + '重投的首个 turn 事件仍把交接包从 delivered 推到 accepted（deliveryAttempts=1，无 expired/升级），'
      + '三次连续失败的 Then 客观取不到。已逐字保留断言并如实判不通过，交主控裁决是否补一个'
      + '「重投前 n 次 prompt 确定性失败」的专用夹具接缝；未伪造过期/升级。');
    note(c, '需求夹具的 MAESTRO_TEST_DELIVERY_DELAY_MS 机检已在 orchestrator 的 deliveryDelayMs 读取，'
      + '设为 10ms 加速三次重试；断言口径不变。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
