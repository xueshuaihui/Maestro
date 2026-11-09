// AC-15 信箱先落盘再投递（夹具 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readEvents, readInbox, reasonsOf,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-15';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop（开发完成，核心唤醒测试）');

    const ev = readEvents(root);
    const reasons = reasonsOf(ev);
    const iInbox = reasons.indexOf('handoff.inboxed');
    const iDeliver = reasons.indexOf('handoff.delivered');
    c.check('机检：events 含 handoff.inboxed', iInbox >= 0, reasons.join(','));
    c.check('Then/机检：handoff.inboxed 出现在该包 handoff.delivered 之前', iInbox >= 0 && iDeliver >= 0 && iInbox < iDeliver,
      `inboxed=${iInbox} delivered=${iDeliver}`);

    const ib = readInbox(root, 'INST-001', 'HO-001');
    c.check('机检：信箱文件 HO-001.json 可解析', ib && typeof ib === 'object', JSON.stringify(Object.keys(ib ?? {})));
    c.eq('机检：含目标节点 toNodeId', ib?.toNodeId, 'T-002');
    c.check('机检：含目标会话 sessionId', typeof ib?.sessionId === 'string' && ib.sessionId.length > 0, String(ib?.sessionId));
    c.check('机检：含提示词 promptText', typeof ib?.promptText === 'string' && ib.promptText.length > 0, String(ib?.promptText ?? '').slice(0, 60));
    c.check('机检：含 deliveryAttempts 字段', Object.prototype.hasOwnProperty.call(ib ?? {}, 'deliveryAttempts'), String(ib?.deliveryAttempts));
    c.check('机检：含 lastError 字段', Object.prototype.hasOwnProperty.call(ib ?? {}, 'lastError'), String(ib?.lastError));
    c.note('按 AC-15 口径，先后证据取 events 顺序，不依赖 .mock/prompts/2.json 写入时机（mock 在 sessionNew 即建占位文件）。');
    return conclude(c, root);
  },
}];
