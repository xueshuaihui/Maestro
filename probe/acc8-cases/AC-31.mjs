/**
 * AC-31 · 降级后重新调度，角色回到 busy。
 *
 * Given：复用 AC-28 的 after_assign hold 点（caps=none，开发角色已降 available）。
 * When：写 .mock/release 释放 hold，让恢复继续派发。
 * Then：节点从「已分配」转为「执行中」，role show developer 回到 服务中 · 活跃会话 1/1。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, eq, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, readState, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-31', {
    scenario: 'redispatch-back-to-busy',
    title: '降级后重新调度，角色回到 busy',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-31');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'running', phase: 'assigned' })],
      sessions: [sessionTpl({ sessionId: 'mock-sess-dev', nodeId: 'T-001', roleId: 'developer', state: 'idle' })],
    });
    given.nodes[0].sessionId = 'mock-sess-dev';
    const g = prepareGiven(root, given, {
      caps: 'none', extraEnv: { MAESTRO_TEST_RECOVERY_HOLD: 'after_assign' },
    });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));

    const b = await boot(root, g.env, 'INST-001', { waitPaused: true });
    check(c, 'Given：hold 点恢复成功（recoveredAt 落盘）', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));
    const beforeRole = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const beforeGraph = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'given', 'role-show-held.txt', beforeRole.stdout);
    evidence(c, 'given', 'graph-held.txt', beforeGraph.stdout);
    includes(c, 'Given：hold 点开发角色已降为「可用」', beforeRole.stdout, '可用 · 活跃会话 0/1');
    includes(c, 'Given：hold 点节点停在「已分配」', beforeGraph.stdout, 'T-001 开发 · 已分配');

    // When：释放 hold，观察重新派发。每 80ms 采样一次（冰点可能很短），落证据后逐点断言。
    fs.writeFileSync(path.join(root, '.mock', 'release'), '1');
    const samples = [];
    const until = Date.now() + 30000;
    while (Date.now() < until && !samples.some((s) => s.busy)) {
      const st = readState(root);
      const node = (st?.nodes ?? []).find((n) => n.nodeId === 'T-001');
      const rs = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
      const active = (st?.sessions ?? []).filter(
        (s) => s.nodeId === 'T-001' && s.state !== 'idle',
      ).length;
      samples.push({
        at: new Date().toISOString(),
        nodeState: node?.state ?? null,
        phase: node?.phase ?? null,
        active,
        statusLine: (rs.stdout.match(/实例 INST-001：[^\n]*/) || [])[0] ?? '',
        // role show 读到的快照可能比采样前的 readState 更新一拍；以 CLI 用户可见行为准。
        busy: /服务中 · 活跃会话 1\/1/.test(rs.stdout),
      });
      if (!samples[samples.length - 1].busy) await nap(80);
    }
    evidence(c, 'then', 'redispatch-samples.json', JSON.stringify(samples.slice(0, 200), null, 2));

    const finalState = readState(root);
    const finalNode = (finalState?.nodes ?? []).find((n) => n.nodeId === 'T-001');
    const finalRole = orch(root, ['role', 'show', 'developer', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    const events = b.events.concat(
      // 释放后新增的事件（重新读盘，hold 前事件已在 b.events）。
      (() => {
        try {
          return fs.readFileSync(path.join(root, '.orch', 'instances', 'INST-001', 'events.jsonl'), 'utf8')
            .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).filter(Boolean);
        } catch { return []; }
      })(),
    );
    evidence(c, 'then', 'role-show-final.txt', finalRole.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    evidence(c, 'then', 'state.json', JSON.stringify(finalState, null, 2));
    const uniq = new Map();
    for (const e of events) uniq.set(JSON.stringify(e), e);
    evidence(c, 'then', 'events.jsonl',
      [...uniq.values()].map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const busySample = samples.find((s) => s.busy);
    check(c, 'Then：存在「节点执行中 + 角色服务中 1/1」的采样点',
      Boolean(busySample), JSON.stringify(busySample ?? samples.slice(-3)));
    // 「已分配 → 执行中」以 node.dispatch 事件的 phase 字段为准（采样点会滞后一拍）。
    const dispatchEvent = events.find((e) => e.reason === 'node.dispatch'
      && e.detail?.recovered === true && e.detail?.nodeId === 'T-001');
    check(c, 'Then：node.dispatch 事件把节点从「已分配」推进到「执行中」（phase=running）',
      dispatchEvent?.detail?.phase === 'running',
      JSON.stringify(dispatchEvent ?? null));
    includes(c, 'Then：role show 回到「服务中 · 活跃会话 1/1」',
      busySample?.statusLine ?? '', '服务中 · 活跃会话 1/1');
    check(c, '夹具：重新派发产生 node.dispatch（recovered=true）',
      events.some((e) => e.reason === 'node.dispatch' && e.detail?.recovered === true
        && e.detail?.nodeId === 'T-001'),
      JSON.stringify(events.filter((e) => e.reason === 'node.dispatch')));
    check(c, '夹具：hold 释放前无 node.dispatch，释放后有',
      !b.events.some((e) => e.reason === 'node.dispatch')
      && events.some((e) => e.reason === 'node.dispatch'),
      `before=${b.events.filter((e) => e.reason === 'node.dispatch').length} after=${events.filter((e) => e.reason === 'node.dispatch').length}`);

    note(c, 'Given/When 用 AC-28 同款 after_assign hold（caps=none），写 .mock/release 释放；'
      + '重新派发由产品核心的 continueRecovery 执行，非夹具伪造。');
    note(c, '按 80ms 采样捕捉「服务中 · 活跃会话 1/1」窗口；会话最终可能被驱动推进，'
      + '断言取出现过的窗口而非最终快照。');
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
