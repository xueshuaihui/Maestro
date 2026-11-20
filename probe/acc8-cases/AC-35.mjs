/**
 * AC-35 · 重投成功后回到已投递 / 已接受。
 *
 * Given：AC-32 同款 HO-001 delivered 未 accepted（测试→开发回流），目标开发会话可 resume。
 * When：冷启动恢复后不 hold，让重投继续到底。
 * Then：状态序列 pending → delivered → accepted；连接线聚合随之从待投递变为已投递再已接受。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, check, includes, evidence, note, finish } from '../acc8-f-common.mjs';
import { freshRoot, cleanupRoot, orch, readState, readEvents, GRADING_MOCK } from '../acc8-f-lib.mjs';
import {
  baseState, nodeTpl, sessionTpl, handoffTpl, prepareGiven, boot, releaseAndStop,
} from './AC-28.mjs';

const nap = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  const c = makeCase('AC-35', {
    scenario: 'redeliver-success',
    title: '重投成功后回到已投递 / 已接受',
    grading: GRADING_MOCK,
  });
  const root = freshRoot('AC-35');
  c.root = root;
  try {
    const given = baseState(root, {
      nodes: [
        // 目标用 pending 而非 running+assigned：否则它会同时进入 plan.assigned，
        // 先被无交接包的重派发抢占，redeliver 再派发时撞 NODE_BUSY，取不到重投链路。
        nodeTpl({ nodeId: 'T-001', roleId: 'developer', state: 'pending' }),
        nodeTpl({ nodeId: 'T-002', roleId: 'tester', state: 'done', extra: { verdict: { value: 'fail', defects: [] } } }),
      ],
      sessions: [],
      handoffs: [handoffTpl({
        handoffId: 'HO-001', from: 'T-002', to: 'T-001', kind: 'backflow',
        state: 'delivered', acceptedAt: null, deliveryAttempts: 1,
      })],
    });
    const g = prepareGiven(root, given, { caps: 'resume' });
    evidence(c, 'given', 'state.json', JSON.stringify(given, null, 2));

    // 在触发冷启动之前就开始按 40ms 采样，避免 pending 窗口被启动过程吞掉。
    const samples = [];
    const sample = () => {
      const st = readState(root);
      const h = (st?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
      samples.push({
        at: new Date().toISOString(),
        state: h?.state ?? null,
        deliveryAttempts: h?.deliveryAttempts ?? null,
        acceptedAt: h?.acceptedAt ?? null,
        node: (st?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.state ?? null,
      });
    };
    const timer = setInterval(sample, 40);
    let b;
    try {
      b = await boot(root, g.env);
      await nap(8000);
    } finally {
      clearInterval(timer);
    }
    sample();
    check(c, '夹具：recoveredAt 落盘，重投链路已启动', Boolean(b.afterState?.recoveredAt),
      JSON.stringify({ recoveredAt: b.afterState?.recoveredAt ?? null }));

    const sequence = [];
    for (const s of samples) if (s.state && sequence[sequence.length - 1] !== s.state) sequence.push(s.state);
    evidence(c, 'then', 'handoff-state-samples.json', JSON.stringify(samples, null, 2));
    evidence(c, 'then', 'handoff-state-sequence.json', JSON.stringify(sequence, null, 2));
    evidence(c, 'then', 'boots.json', JSON.stringify(b.boots, null, 2));
    evidence(c, 'then', 'events.jsonl',
      b.events.map((e) => JSON.stringify(e)).join('\n') || '(恢复期无事件)\n');

    const idxPending = sequence.indexOf('pending');
    const idxDelivered = sequence.indexOf('delivered', idxPending + 1);
    const idxAccepted = sequence.indexOf('accepted', idxDelivered + 1);
    check(c, 'Then：状态序列出现 pending → delivered → accepted（按时间顺序）',
      idxPending >= 0 && idxDelivered > idxPending && idxAccepted > idxDelivered,
      JSON.stringify(sequence));
    check(c, 'Then：重投后目标首个事件触发 accepted（acceptedAt 落盘）',
      samples.some((s) => s.state === 'accepted' && Boolean(s.acceptedAt)),
      JSON.stringify(samples.filter((s) => s.state === 'accepted').slice(0, 2)));
    const handoffNow = (readState(root)?.handoffs ?? []).find((h) => h.handoffId === 'HO-001');
    check(c, '夹具：重投后 deliveredAt 落盘且 deliveryAttempts >= 1',
      (handoffNow?.deliveryAttempts ?? 0) >= 1 && Boolean(handoffNow?.deliveredAt),
      JSON.stringify(handoffNow ?? null));

    const graphJson = orch(root, ['instance', 'graph', '--instance', 'INST-001', '--format', 'json'], { env: g.env });
    const graphText = orch(root, ['instance', 'graph', '--instance', 'INST-001'], { env: g.env });
    const handoffList = orch(root, ['handoff', 'list', '--instance', 'INST-001'], { env: g.env });
    const log = orch(root, ['instance', 'log', '--instance', 'INST-001'], { env: g.env });
    evidence(c, 'then', 'graph.json.txt', graphJson.stdout);
    evidence(c, 'then', 'graph.txt', graphText.stdout);
    evidence(c, 'then', 'handoff-list.txt', handoffList.stdout);
    evidence(c, 'then', 'instance-log.txt', log.stdout);
    let parsed = null;
    try { parsed = JSON.parse(graphJson.stdout); } catch { /* 证据已落 */ }
    evidence(c, 'then', 'connections-final.json', JSON.stringify(parsed?.connections ?? null, null, 2));
    const finalAggregate = parsed?.connections?.[0]?.aggregate ?? null;
    const finalState = readState(root);
    const finalHandoff = (finalState?.handoffs ?? []).find((h) => h.handoffId === 'HO-001');
    check(c, 'Then：最终连接线 aggregate 与交接包最终 state 一致',
      finalAggregate === (finalHandoff?.state ?? null),
      JSON.stringify({ aggregate: finalAggregate, handoffState: finalHandoff?.state ?? null }));
    check(c, 'Then：最终交接包落在 已投递/已接受',
      ['delivered', 'accepted'].includes(finalHandoff?.state ?? null),
      JSON.stringify(finalHandoff ?? null));
    includes(c, 'Then：graph 文本出现该连接线的中文聚合行', graphText.stdout, '连接线：测试→开发（回流）');

    note(c, '夹具名沿用 recovery-driver 的 redeliver 语义，但用受控 state.json 固定 Given，'
      + '再经冷启动让产品核心真正执行 delivered→pending→重投→接受；40ms 采样保证不漏中间态。');
    note(c, '连接线聚合与交接包 state 同源（deriveConnections），故以最终 aggregate==最终 state'
      + '核对「待投递 → 已投递 → 已接受」的聚合变化，并保留逐帧 state 序列证据。');
    try { fs.writeFileSync(path.join(root, '.mock', 'release'), '1'); } catch { /* 清理 */ }
    releaseAndStop(root, g.env);
  } finally {
    cleanupRoot(root);
  }
  return finish(c);
}
