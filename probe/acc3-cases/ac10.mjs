// AC-10 审核第 2 轮驳回 → 停止回流、升级挂起（夹具：doc-reject-twice 完整跑完）。
import {
  makeCase, freshRoot, runSync, statusText, coreStop, forceKillCore,
  text, lines, readState, nodeOf, handoffOf, escalationOf,
  requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-10';
const SCENARIO = 'doc-reject-twice';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核第 2 轮驳回 → 停止回流、升级挂起',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      const out = text(run);

      c.check('命令在 60 秒内结束且退出码是 4', run.exitCode === 4 && run.durationMs < 60000,
        `exit=${run.exitCode} ${run.durationMs}ms`);
      c.includes('输出含「实例 INST-001 · 已挂起 · 模板 通用任务闭环」', out, '实例 INST-001 · 已挂起 · 模板 通用任务闭环');
      c.includes('输出含「升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮」', out,
        '升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮');

      // When：orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('输出含「原因：回流超上限：审核者已派发 2 次仍未通过」', t, '原因：回流超上限：审核者已派发 2 次仍未通过');
      c.includes('输出含「节点：T-003 审核者 · 第 2 轮」', t, '节点：T-003 审核者 · 第 2 轮');
      const defectLines = lines(t).filter((l) => l.trim().startsWith('缺陷：'));
      c.eq('输出含两条「缺陷：」行', defectLines.length, 2);
      c.check('两条缺陷行分别带证据（v2）', defectLines.length === 2
        && defectLines.every((l) => l.includes('（证据 artifacts/docs/release-notes.v2.md#L')), defectLines.join(' | '));

      // 机检
      const s = readState(root);
      c.eq('机检：实例 state = suspended', s?.state, 'suspended');
      c.eq('机检：T-003 state/round = escalated/2', `${nodeOf(s, 'T-003')?.state}/${nodeOf(s, 'T-003')?.round}`, 'escalated/2');
      c.eq('机检：T-002 state/round = done/2', `${nodeOf(s, 'T-002')?.state}/${nodeOf(s, 'T-002')?.round}`, 'done/2');
      c.eq('机检：counters.dispatchCount = 5', s?.counters?.dispatchCount, 5);
      const ids = (s?.handoffs ?? []).map((h) => h.handoffId);
      c.check('机检：handoffs 恰好 4 条，没有 HO-005', ids.length === 4 && !ids.includes('HO-005'), ids.join(','));

      const escs = s?.escalations ?? [];
      c.eq('机检：escalations 恰好 1 条', escs.length, 1);
      c.eq('机检：升级 state = pending', escalationOf(s)?.state, 'pending');
      c.eq('机检：升级 defects 恰好 2 条', escalationOf(s)?.defects?.length ?? -1, 2);
      c.eq('机检：升级 nodeId/round = T-003/2', `${escalationOf(s)?.nodeId}/${escalationOf(s)?.round}`, 'T-003/2');
      c.eq('机检：升级 reasonCode = rounds_exceeded', escalationOf(s)?.reasonCode, 'rounds_exceeded');
      c.eq('机检：HO-004 是最后一张交接包且已 consumed', `${handoffOf(s, 'HO-004')?.state}`, 'consumed');
      c.snap(root, 'state.live');
      c.note('`state.live.json` 是挂起时刻（run 结束后、core stop 之前）的快照；收尾 `state.json` 是 core stop 之后的快照（suspended 不在对账范围，字段不变）。');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
