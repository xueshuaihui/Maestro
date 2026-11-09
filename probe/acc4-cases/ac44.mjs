// AC-44 attach 只读跟随（正常路径 / mock 夹具面）
// 先预热核心（让启动对账落定），再取 before 快照；否则新核心对账会写 rev，不是 attach 所为。
import {
  makeCase, freshRoot, holdApproval, statusText, instanceLog, attachHold,
  sessionIdFrom, sessionIdFromLog, readState, text, lines, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-44';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：正在执行且有历史、宿主已请求审批（hold）的会话
    const { h, approvalSeen } = await holdApproval(root);
    c.check('Given：会话在等待审批', approvalSeen, h.stdout.slice(0, 300));
    // 预热：核心完成启动对账（AC-58 口径），之后取 before 快照
    c.cmd(statusText(root), 'orch status --instance INST-001（预热核心，完成启动对账）');
    const before = readState(root);
    const sid = sessionIdFrom(h) ?? sessionIdFromLog(instanceLog(root, 'INST-001', 'json'));
    c.check('Given：会话号来源可取得（run 的「会话已创建」或 instance log json 的 objectId）', typeof sid === 'string' && sid.length > 0, String(sid));

    // When：orch attach <会话号> → 看事件 → Ctrl-C
    const att = c.cmd(await attachHold(root, sid), `orch attach ${sid}`);
    const after = readState(root);
    c.keep('orch run --approval hold（前台稳定会话）', h);
    const out = text(att);
    const body = lines(out);
    const eventRows = body.filter((l) => /^\d{2}:\d{2}:\d{2}/.test(l));

    c.eq('Then：attach 正常脱离（退出码 0）', att.exitCode, 0);
    c.includes('Then：首行显示该会话号、实例、节点', body[0], `已附着会话 ${sid}（实例 INST-001 · 节点`);
    c.includes('Then：若有待审批，紧跟一行审批信息', body[1], '审批 APR-001 待处理');
    c.check('Then：随后输出该会话最近事件（行数 ≤ 20 且 ≥ 1）', eventRows.length >= 1 && eventRows.length <= 20, String(eventRows.length));
    c.includes('Then：脱离收尾行', out, `已脱离会话 ${sid}`);
    c.includes('机检：stdout 含 APR- 行', out, 'APR-');

    // 机检：附着前后 state/rev 与节点、会话状态都不变
    c.eq('机检：附着前后 state 不变', after?.state, before?.state);
    c.eq('机检：附着前后 rev 不变', after?.rev, before?.rev);
    c.eq('机检：附着前后节点状态不变', JSON.stringify((after?.nodes ?? []).map((n) => n.state)), JSON.stringify((before?.nodes ?? []).map((n) => n.state)));
    c.eq('机检：附着前后会话状态不变', JSON.stringify((after?.sessions ?? []).map((s) => s.state)), JSON.stringify((before?.sessions ?? []).map((s) => s.state)));
    await h.stop();
    return conclude(c, root);
  },
}];
