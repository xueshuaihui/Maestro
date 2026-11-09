// AC-16 一次投递失败后重试成功（异常恢复 / mock 夹具面）+ 补充 promptFailures:2
import {
  makeCase, freshRoot, runLocalTaskScene, retrySteps, readState, readEvents,
  readAttemptFiles, reasonsOf, DOC_TASK, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-16';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];

    // 主场景：promptFailures:1（第 1 次失败、第 2 次成功）
    const r1 = freshRoot(AC); c.add(r1); roots.push(r1);
    c.cmd(runLocalTaskScene(r1, { name: 'acc4-ac16-f1', steps: retrySteps(1), task: DOC_TASK }),
      'orch run task-loop（本地夹具 promptFailures:1）');
    const s1 = readState(r1);
    const ev1 = readEvents(r1);
    const pend1 = ev1.filter((e) => e.reason === 'handoff.pending');
    c.eq('Then/机检：实例 completed', s1?.state, 'completed');
    c.eq('机检：handoff.pending 恰好 1 次', pend1.length, 1);
    c.eq('机检：pending.detail.deliveryAttempts === 1', pend1[0]?.detail?.deliveryAttempts, 1);
    c.check('机检：pending 位于最终 handoff.delivered 之前',
      ev1.findIndex((e) => e.reason === 'handoff.pending') < reasonsOf(ev1).lastIndexOf('handoff.delivered'),
      reasonsOf(ev1).join(','));
    c.eq('机检：HO-001 deliveryAttempts === 2', s1?.handoffs?.find((h) => h.handoffId === 'HO-001')?.deliveryAttempts, 2);
    const at1 = Object.values(readAttemptFiles(r1)).map((v) => Number(typeof v === 'object' && v !== null ? v.attempts : v));
    c.check('机检：目标会话 prompt-attempts 文件 attempts === 2', at1.includes(2), JSON.stringify(at1));
    c.eq('机检：目标节点 T-002 只有 1 个会话（重试不新建会话）', (s1?.sessions ?? []).filter((x) => x.nodeId === 'T-002').length, 1);
    c.eq('机检：T-002 的 node.dispatch 只有一条', ev1.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-002').length, 1);

    // 补充：同一场景改用 promptFailures:2 重跑一次，第 3 次成功
    const r2 = freshRoot(`${AC}-f2`); c.add(r2); roots.push(r2);
    c.cmd(runLocalTaskScene(r2, { name: 'acc4-ac16-f2', steps: retrySteps(2), task: DOC_TASK }),
      'orch run task-loop（本地夹具 promptFailures:2，补充场景）');
    const s2 = readState(r2);
    const ev2 = readEvents(r2);
    const pend2 = ev2.filter((e) => e.reason === 'handoff.pending').map((e) => e.detail?.deliveryAttempts);
    c.eq('补充：HO-001 deliveryAttempts === 3', s2?.handoffs?.find((h) => h.handoffId === 'HO-001')?.deliveryAttempts, 3);
    c.check('补充：有两次 handoff.pending（attempts 1、2）',
      pend2.length === 2 && pend2[0] === 1 && pend2[1] === 2, JSON.stringify(pend2));
    c.check('补充：最终出现 handoff.delivered', reasonsOf(ev2).includes('handoff.delivered'), reasonsOf(ev2).join(','));
    return conclude(c, roots);
  },
}];
