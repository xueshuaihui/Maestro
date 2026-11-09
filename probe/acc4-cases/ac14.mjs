// AC-14 校验失败时零派发且原因可见（异常 / mock 夹具面）
import {
  makeCase, freshRoot, badHandoff, statusText, statusEvents, readState, readEvents,
  reasonsOf, text, requirementTitle, conclude, checkBadPackage,
} from '../acc4-f-common.mjs';

const AC = 'AC-14';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // Given：AC-10 的坏包场景（no-evidence）
    const res = await badHandoff(root, 'no-evidence');
    c.keep('orch run（AC-10 坏包场景，前台挂起收尾）', res.h);
    c.cmd(res.seamRes, 'call-seam test.handoff --mutate no-evidence');
    checkBadPackage(c, root, {});

    // When：status 与 status --events
    const st = c.cmd(statusText(root), 'orch status --instance INST-001');
    const se = c.cmd(statusEvents(root), 'orch status --instance INST-001 --events');

    c.includes('Then：交接包行显示已拒绝（内容不合规）', text(st), '已拒绝');
    c.includes('Then：交接包行显示「内容不合规」原因', text(st), '内容不合规');
    c.includes('Then：升级块给出节点', text(st), '节点：T-001 开发');
    c.includes('Then：升级块给出轮次', text(st), '第 1 轮');
    c.includes('Then：升级块给出原因', text(st), '原因：交接包 HO-001 内容不合规：缺少证据引用');
    c.includes('Then：升级块给出下一步', text(st), '下一步：orch escalate list');
    c.includes('Then：日志里能看到拒绝事件', text(se), '交接被拒');
    c.includes('Then：日志里能看到升级事件', text(se), '创建升级');
    c.notIncludes('Then：没有「执行中」的假会话', text(st), '会话 执行中');

    const s = readState(root);
    c.eq('机检：sessions.length 不增加（仍为入口 1 个）', (s?.sessions ?? []).length, 1);
    c.eq('机检：counters.dispatchCount 不增加（仍为 1）', s?.counters?.dispatchCount, 1);
    c.notIncludes('机检：events 没有额外的 node.dispatch（拒绝后）',
      reasonsOf(readEvents(root).slice(readEvents(root).findIndex((e) => e.reason === 'handoff.rejected'))).join(','), 'node.dispatch');
    return conclude(c, root);
  },
}];
