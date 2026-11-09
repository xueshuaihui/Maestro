// AC-27 同一升级不能处理两次（边界 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, escalateResolve, readState, readEvents, reasonsOf, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-27';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded');
    const first = c.cmd(escalateResolve(root, 'ESC-001', 'pass', 'INST-001'),
      'orch escalate resolve ESC-001 --decision pass（第 1 次）');
    c.eq('夹具：第 1 次 resolve 成功', first.exitCode, 0);
    const s1 = readState(root);
    const revBefore = s1?.rev;
    const roundBefore = JSON.stringify((s1?.nodes ?? []).map((n) => n.round));

    // When：再次执行同一 resolve
    const second = c.cmd(escalateResolve(root, 'ESC-001', 'pass', 'INST-001'),
      'orch escalate resolve ESC-001 --decision pass（第 2 次）');
    c.includes('Then：提示升级已处理', text(second), '已处理');
    c.eq('Then：退出码 1', second.exitCode, 1);
    const s2 = readState(root);
    c.eq('机检：实例状态不变', s2?.state, s1?.state);
    c.eq('机检：节点轮次不变', JSON.stringify((s2?.nodes ?? []).map((n) => n.round)), roundBefore);
    c.eq('机检：rev 不变', s2?.rev, revBefore);
    c.eq('机检：没有第二条 escalation.resolved 事件', reasonsOf(readEvents(root)).filter((x) => x === 'escalation.resolved').length, 1);
    return conclude(c, root);
  },
}];
