// AC-17 重试耗尽后升级（异常 / mock 夹具面）
import {
  makeCase, freshRoot, runLocalTaskScene, retrySteps, readState, readEvents,
  readInbox, readAttemptFiles, reasonsOf, DOC_TASK, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-17';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // 宿主连续 3 次拒绝 prompt（首次 + 2 次重试）
    c.cmd(runLocalTaskScene(root, { name: 'acc4-ac17-f3', steps: retrySteps(3), task: DOC_TASK }),
      'orch run task-loop（本地夹具 promptFailures:3）');

    const s = readState(root);
    const h = s?.handoffs?.find((x) => x.handoffId === 'HO-001');
    c.eq('Then/机检：实例挂起 suspended', s?.state, 'suspended');
    c.eq('机检：包 state === expired', h?.state, 'expired');
    c.eq('机检：deliveryAttempts === 3', h?.deliveryAttempts, 3);
    c.check('机检：expiredAt 非空', Boolean(h?.expiredAt), String(h?.expiredAt));
    c.includes('Then：升级原因写明已尝试 3 次', s?.escalations?.[0]?.reasonDetail ?? '', '已尝试 3 次');
    c.eq('机检：escalations[0].reasonCode === delivery_failed', s?.escalations?.[0]?.reasonCode, 'delivery_failed');

    const ib = readInbox(root, 'INST-001', 'HO-001');
    c.eq('机检：信箱文件 deliveryAttempts === 3', ib?.deliveryAttempts, 3);
    c.check('机检：信箱文件 lastError 非空', Boolean(ib?.lastError), String(ib?.lastError));
    const at = Object.values(readAttemptFiles(root)).map((v) => Number(typeof v === 'object' && v !== null ? v.attempts : v));
    c.check('机检：目标会话 prompt-attempts 文件 attempts === 3', at.includes(3), JSON.stringify(at));
    c.eq('机检：目标节点 T-002 仍只有 1 个会话（重试不新增会话）', (s?.sessions ?? []).filter((x) => x.nodeId === 'T-002').length, 1);
    c.check('机检：events 含 handoff.expired', reasonsOf(readEvents(root)).includes('handoff.expired'), reasonsOf(readEvents(root)).join(','));
    return conclude(c, root);
  },
}];
