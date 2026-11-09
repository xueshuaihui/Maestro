// AC-20 信箱写不进去时不投递（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readState, readEvents, readPrompts, readAttemptFiles,
  reasonsOf, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-20';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // MAESTRO_FAULT=inbox_write:fail（仅 NODE_ENV=test 生效）
    c.cmd(runScene(root, { scenario: 'pass', env: { MAESTRO_FAULT: 'inbox_write:fail' } }),
      'orch run code-loop（MAESTRO_FAULT=inbox_write:fail）');

    const s = readState(root);
    const h = s?.handoffs?.find((x) => x.handoffId === 'HO-001');
    c.eq('Then/机检：实例挂起 suspended', s?.state, 'suspended');
    c.eq('机检：交接包已拒绝（投递失败）', h?.state, 'rejected');
    c.eq('机检：rejectReason === delivery_failed', h?.rejectReason, 'delivery_failed');
    c.eq('机检：escalations[0].reasonCode === delivery_failed', s?.escalations?.[0]?.reasonCode, 'delivery_failed');

    const p2 = readPrompts(root)['2.json'];
    c.eq('机检：.mock/prompts/2.json 的 task 仍为 null（宿主没收到提示）', p2?.task ?? null, null);
    const targetSessions = (s?.sessions ?? []).filter((x) => x.nodeId === 'T-002');
    c.eq('机检：目标会话最多 1 个', targetSessions.length, 1);
    c.eq('机检：目标会话为 idle', targetSessions[0]?.state, 'idle');
    const targetSid = targetSessions[0]?.sessionId;
    const attemptKeys = Object.keys(readAttemptFiles(root));
    c.check(`机检：目标会话 ${targetSid} 没有 prompt-attempts 文件`,
      !attemptKeys.some((k) => String(targetSid) && k.includes(String(targetSid))), attemptKeys.join(','));
    c.notIncludes('Then：宿主没有收到提示（events 无 handoff.delivered）', reasonsOf(readEvents(root)).join(','), 'handoff.delivered');
    return conclude(c, root);
  },
}];
