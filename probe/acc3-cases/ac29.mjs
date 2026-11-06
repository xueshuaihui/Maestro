// AC-29 已升级节点也能被取消（doc-reject-twice 挂起后 cancel）。
import {
  makeCase, freshRoot, runSync, cancel, text, lines, readState, nodeOf, escalationOf,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-29';
const SCENARIO = 'doc-reject-twice';

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '已升级节点也能被取消',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given：doc-reject-twice 已跑完，T-003 已升级、实例已挂起
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 4', run.exitCode, 4);
      const before = readState(root);
      c.eq('Given 机检：实例已挂起', before?.state, 'suspended');
      c.eq("Given 机检：T-003 state='escalated'", nodeOf(before, 'T-003')?.state, 'escalated');
      c.eq('Given 机检：escalations[0].state=pending', escalationOf(before)?.state, 'pending');

      // When
      const res = c.cmd(cancel(root), 'orch cancel --instance INST-001（已升级实例）');

      // Then
      c.eq('Then 退出码 0', res.exitCode, 0);
      c.includes('佐证：取消输出含「节点 T-003 审核者 已取消」', hitLine(text(res), '节点 T-003 审核者 已取消'), '节点 T-003 审核者 已取消');

      const after = readState(root);
      c.eq("机检：实例 state='cancelled'", after?.state, 'cancelled');
      c.eq("机检：T-003 state='cancelled'（不是 'escalated'）", nodeOf(after, 'T-003')?.state, 'cancelled');
      c.eq("机检：escalations[0].state='voided'", escalationOf(after)?.state, 'voided');
      c.check('机检：escalations[0].voidedAt 非空', typeof escalationOf(after)?.voidedAt === 'string' && escalationOf(after).voidedAt.length > 0,
        escalationOf(after)?.voidedAt);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
