// AC-08 正常交接包通过校验并投递（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, readState, readEvents, readInbox, reasonsOf, handoffOf, text,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-08';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    const r = c.cmd(runScene(root, { scenario: 'pass' }), 'orch run code-loop（开发完成，核心推进到测试）');

    c.notIncludes('Then：终端不出现拒绝', text(r), '已拒绝');
    c.notIncludes('Then：终端不出现升级', text(r), '升级 ESC');

    const ev = readEvents(root);
    const reasons = reasonsOf(ev);
    c.check('机检：events 含 handoff.delivered', reasons.includes('handoff.delivered'), reasons.join(','));
    c.notIncludes('机检：没有 handoff.rejected 事件', reasons.join(','), 'handoff.rejected');

    const s = readState(root);
    const h = handoffOf(s, 'HO-001');
    c.check('机检：handoff.delivered 之后该包 state 为 delivered 或 consumed',
      ['delivered', 'accepted', 'consumed'].includes(h?.state), h?.state);
    const ib = readInbox(root, 'INST-001', 'HO-001');
    c.check('机检：测试会话收到提示（信箱 promptText 非空）', typeof ib?.promptText === 'string' && ib.promptText.length > 0, JSON.stringify(Object.keys(ib ?? {})));
    return conclude(c, root);
  },
}];
