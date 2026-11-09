// AC-50 恢复后从边界继续（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, pauseAtOutput, workflow, readState, readEvents,
  readStatusMd, reasonsOf, text, sleep, waitUntil, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-50';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：按 AC-49 重放至「已暂停且开发已完成」
    const { h } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
    c.cmd(workflow(root, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    h.release();
    await Promise.race([h.done, sleep(30000)]);
    c.keep('orch run（前台，暂停收尾）', h);
    const before = readState(root);
    c.eq('Given：已暂停', before?.paused, true);

    // When：orch workflow resume INST-001
    const rr = c.cmd(workflow(root, 'resume', 'INST-001'), 'orch workflow resume INST-001');
    const reached = await waitUntil(() => readState(root)?.state === 'completed', { timeout: 30000, interval: 150 });
    const after = readState(root);
    const ev = readEvents(root);
    const md = readStatusMd(root);

    c.eq('Then：resume 退出码 0', rr.exitCode, 0);
    c.includes('Then：实例行恢复「运行中」', text(rr), '实例 INST-001 · 运行中 · 模板 编码闭环');
    c.eq('机检：paused === false', after?.paused, false);
    c.check('机检：events.jsonl 出现指向测试的 node.dispatch（同步点）',
      ev.some((e) => e.reason === 'node.dispatch' && e.objectId === 'T-002'), reasonsOf(ev).join(','));
    c.eq('机检：测试 round 增加 1', after?.nodes?.find((n) => n.nodeId === 'T-002')?.round, 1);
    const toTest = (after?.handoffs ?? []).filter((x) => x.toNodeId === 'T-002');
    c.eq('机检：指向测试的交接包恰好 1 张', toTest.length, 1);
    c.eq('机检：该包 deliveryAttempts === 1', toTest[0]?.deliveryAttempts, 1);
    c.eq('Then：测试最终完成（实例 completed）', after?.state, 'completed');
    c.check('Then：核心立即派发测试并跑完', Boolean(reached) && after?.nodes?.find((n) => n.nodeId === 'T-002')?.state === 'done', String(reached));
    c.includes('机检：workspace/status.md 含「- 暂停：否」', String(md), '- 暂停：否');
    await h.stop();
    return conclude(c, root);
  },
}];
