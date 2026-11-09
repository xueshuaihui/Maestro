// AC-51 重复暂停 / 恢复幂等（边界 / mock 夹具面）
// NODE_ENV=test 下用不带节点限定的 MAESTRO_TEST_PAUSE=after_output，恢复后的测试回合也停在同一接缝。
import path from 'node:path';
import {
  makeCase, freshRoot, liveScene, workflow, purgePauseMarkers, waitUntil,
  exists, readState, readEvents, reasonsOf, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-51';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    const h = liveScene(root, { scenario: 'pass', env: { MAESTRO_TEST_PAUSE: 'after_output' } });
    const p1 = await h.waitFile('.mock/paused', 30000);
    c.check('Given：开发回合停在派发边界', Boolean(p1), String(h.stdout).slice(-200));

    // 第一次 pause（之后放行让 run 以暂停收尾）
    const pa = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001（第一次）');
    purgePauseMarkers(root);
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run（前台，暂停收尾）', h);
    const mid1 = readState(root);
    c.eq('Given：已暂停且开发已完成', mid1?.paused, true);

    // 再执行一次 pause（幂等）
    const pa2 = c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001（重复，幂等）');
    // 第一次 resume：产生测试回合派发
    const r1 = c.cmd(workflow(root, 'resume', 'INST-001'), 'orch workflow resume INST-001（第一次）');
    const dispAfterR1 = readState(root)?.counters?.dispatchCount;
    // 等测试回合的 .mock/paused 重新出现
    purgePauseMarkers(root);
    const p2 = await waitUntil(() => exists(path.join(root, '.mock', 'paused')) || readState(root)?.state === 'completed',
      { timeout: 20000, interval: 100 });
    const beforeR2 = readState(root);
    // 第二次 resume（幂等，不再派发）
    const r2 = c.cmd(workflow(root, 'resume', 'INST-001'), 'orch workflow resume INST-001（第二次）');
    const afterR2 = readState(root);
    purgePauseMarkers(root);
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    const end = readState(root);
    const ev = readEvents(root);

    for (const [label, r] of [['pause①', pa], ['pause②', pa2], ['resume①', r1], ['resume②', r2]]) {
      c.eq(`Then：${label} 退出码 0`, r.exitCode, 0);
      c.includes(`Then：${label} 打印当前实例行`, text(r), '实例 INST-001 · 运行中');
    }
    c.check('Given：测试回合的 .mock/paused 重新出现', Boolean(p2), String(p2));
    c.eq('机检：第二次 resume 前后 dispatchCount 不变', afterR2?.counters?.dispatchCount, beforeR2?.counters?.dispatchCount);
    c.eq('机检：第二次 resume 前后测试节点 round 不变',
      afterR2?.nodes?.find((n) => n.nodeId === 'T-002')?.round,
      beforeR2?.nodes?.find((n) => n.nodeId === 'T-002')?.round);
    c.check('机检：只有第一次 resume 产生一次派发（dispatchCount 由 1 增至 2）',
      dispAfterR1 === 1 && beforeR2?.counters?.dispatchCount === 2,
      `afterR1=${dispAfterR1} beforeR2=${beforeR2?.counters?.dispatchCount}`);
    c.eq('机检：events.jsonl 中 node.dispatch 共 2 条（开发、测试各一条）', reasonsOf(ev).filter((r) => r === 'node.dispatch').length, 2);
    const toTest = (end?.handoffs ?? []).filter((x) => x.toNodeId === 'T-002');
    c.eq('机检：指向测试的交接包恰好 1 张', toTest.length, 1);
    c.eq('机检：测试节点会话恰好 1 个', (end?.sessions ?? []).filter((s) => s.nodeId === 'T-002').length, 1);
    c.eq('机检：paused 最终为 false', end?.paused, false);
    await h.stop();
    return conclude(c, root);
  },
}];
