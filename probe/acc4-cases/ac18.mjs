// AC-18 重试不增加派发、轮次或会话（回归 / mock 夹具面）
import {
  makeCase, freshRoot, runLocalTaskScene, retrySteps, readState, readEvents,
  reasonsOf, DOC_TASK, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-18';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // Given：AC-16 的重试场景（promptFailures:1）
    c.cmd(runLocalTaskScene(root, { name: 'acc4-ac18-f1', steps: retrySteps(1), task: DOC_TASK }),
      'orch run task-loop（AC-16 重试场景）');

    const s = readState(root);
    const ev = readEvents(root);
    const reasons = reasonsOf(ev);
    c.eq('机检：counters.dispatchCount 只加 1（每节点一次，共 3）', s?.counters?.dispatchCount, 3);
    c.eq('Then：目标节点 T-002 round 不变（第 1 轮）', s?.nodes?.find((n) => n.nodeId === 'T-002')?.round, 1);
    c.eq('机检：events 中 T-002 的 node.dispatch 只有一条', ev.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-002').length, 1);
    c.check('Then：终端没有重复的派发事件（无第 4 条 node.dispatch）',
      reasons.filter((r) => r === 'node.dispatch').length === 3, String(reasons.filter((r) => r === 'node.dispatch').length));
    return conclude(c, root);
  },
}];
