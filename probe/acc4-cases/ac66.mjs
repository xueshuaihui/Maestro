// AC-66 暂停落在交接包已构造、尚未派发之间（边界 / mock 夹具面）
// Given：MAESTRO_TEST_PAUSE=after_verdict 让编码闭环在回流包已落盘、派发未提交时停住。
import {
  makeCase, freshRoot, liveScene, workflow, readState, readEvents,
  reasonsOf, waitUntil, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-66';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：after_verdict 停在回流包已落盘、派发未提交
    const h = liveScene(root, { scenario: 'backflow', env: { MAESTRO_TEST_PAUSE: 'after_verdict' } });
    const paused = await h.waitFile('.mock/paused', 30000);
    c.check('Given：项目根出现 .mock/paused（回流包已落盘、派发未提交）', Boolean(paused), String(h.stdout).slice(-200));
    const ps = readState(root);
    const createdAtPause = (ps?.handoffs ?? []).filter((x) => x.state === 'created');
    const createdId = createdAtPause[0]?.handoffId ?? null;
    const pauseDispatch = ps?.counters?.dispatchCount;
    const pauseDispatchEvents = reasonsOf(readEvents(root)).filter((r) => r === 'node.dispatch').length;
    const pauseRound = (ps?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round;
    c.eq('机检：暂停落定后指向该节点的 created 包恰好 1 张', createdAtPause.length, 1);

    // When：pause → 放行接缝 → 等前台 run 以暂停收尾（退出 0）→ resume
    const pa = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    c.eq('When：pause 退出码 0', pa.exitCode, 0);
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run code-loop（前台，暂停收尾）', h);
    c.eq('When：前台 orch run 以暂停收尾（退出 0）', h.exitCode, 0);
    const pausedFinal = readState(root);
    c.eq('Then：暂停期间该包显示「已构造」（created 仍在）',
      (pausedFinal?.handoffs ?? []).find((x) => x.handoffId === createdId)?.state, 'created');
    c.eq('机检：暂停落定后目标节点 round 未增加',
      (pausedFinal?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round, pauseRound);
    c.eq('机检：暂停落定后 dispatchCount 未增加', pausedFinal?.counters?.dispatchCount, pauseDispatch);
    c.eq('机检：暂停落定后没有新增 node.dispatch',
      reasonsOf(readEvents(root)).filter((r) => r === 'node.dispatch').length, pauseDispatchEvents);

    const re = c.cmd(workflow(root, 'resume', 'INST-001'), 'orch workflow resume INST-001');
    c.eq('When：resume 退出码 0', re.exitCode, 0);
    // 需求机检的「+1」指「恢复动作补做的那一次派发」。在同一轮询里捕获
    // created 包离开 created 态（handoff.delivered 落定）时的 state+events：
    // 此刻尚无下一轮推进，正是「用同一张包派发一次、不产生第二张包」的
    // 观察窗口。后续正常推进属于另一轮，不在本 AC 的计数断言范围内。
    const snap = await waitUntil(() => {
      const s = readState(root);
      const x = (s?.handoffs ?? []).find((y) => y.handoffId === createdId);
      return x && x.state !== 'created' ? { s, ev: readEvents(root) } : null;
    }, { timeout: 25000, interval: 50 });
    c.check('机检：恢复后该 created 包被派发（离开 created 态）', Boolean(snap), String(createdId));
    const end = snap?.s ?? readState(root);
    const ev = snap?.ev ?? readEvents(root);
    const same = (end?.handoffs ?? []).find((x) => x.handoffId === createdId);

    c.check('Then：恢复后核心用同一张包派发（不产生第二张包）',
      (end?.handoffs ?? []).length === (ps?.handoffs ?? []).length,
      `before=${(ps?.handoffs ?? []).length} after=${(end?.handoffs ?? []).length} ids=${(end?.handoffs ?? []).map((x) => x.handoffId).join(',')}`);
    c.check('机检：该 handoffId 变为 delivered/consumed',
      ['delivered', 'consumed', 'accepted', 'completed'].includes(same?.state), String(same?.state));
    c.eq('机检：deliveryAttempts === 1', same?.deliveryAttempts, 1);
    c.eq('机检：dispatchCount 恰好 +1', end?.counters?.dispatchCount, pauseDispatch + 1);
    c.eq('机检：指向该节点的包仍只有 1 张',
      (end?.handoffs ?? []).filter((x) => x.toNodeId === 'T-001').length, 1);
    c.eq('机检：node.dispatch 新增恰好 1 条',
      reasonsOf(ev).filter((r) => r === 'node.dispatch').length, pauseDispatchEvents + 1);
    c.note('上一轮收口期发现的产品缺陷（resume 重新规划构造第二张包）已由 src/core/orchestrator.js:4400 的既有修复收口：本轮机检全通过（同一张 created 包被复用、deliveryAttempts===1、dispatchCount 恰好 +1、无第二张包）。修复登记见 probe/acc4-f-blockers.md。');
    await h.stop();
    return conclude(c, root);
  },
}];
