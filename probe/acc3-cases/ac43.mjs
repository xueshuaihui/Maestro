// AC-43 回合执行失败 → 升级挂起，不回流（execution-fail）。
import {
  makeCase, freshRoot, runSync, statusText, text, lines,
  readState, readEvents, nodeOf, handoffOf, escalationOf,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-43';
const SCENARIO = 'execution-fail';
const LIMIT_MS = 30000;

function hitLine(t, needle) {
  return lines(t).find((l) => l.includes(needle)) ?? `（未出现）${String(t).slice(0, 300)}`;
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '回合执行失败 → 升级挂起，不回流',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given 夹具场景 execution-fail 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.check(`Then 命令在 ${LIMIT_MS / 1000} 秒内结束（实测 ${run.durationMs}ms）`, run.durationMs <= LIMIT_MS, `${run.durationMs}ms`);
      c.eq('Then 退出码是 4', run.exitCode, 4);

      // When 我执行 orch status --instance INST-001
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const t = text(st);
      c.includes('Then 输出含「原因：执行失败：」', hitLine(t, '原因：执行失败：'), '原因：执行失败：');
      c.includes('Then 输出含「节点 T-002 撰写者 已升级」', hitLine(t, '节点 T-002 撰写者 已升级'), '节点 T-002 撰写者 已升级');
      c.includes('Then 原因行带宿主原文（mock-host: upstream model request failed）',
        hitLine(t, 'upstream model request failed'), 'upstream model request failed');

      // And 机检
      const s = readState(root);
      c.eq("And 机检：实例 state='suspended'", s?.state, 'suspended');
      c.eq("And 机检：T-001 state='review'", nodeOf(s, 'T-001')?.state, 'review');
      c.eq("And 机检：T-001 reviewReason='downstream'", nodeOf(s, 'T-001')?.reviewReason, 'downstream');
      c.eq("And 机检：T-002 state='escalated'", nodeOf(s, 'T-002')?.state, 'escalated');
      c.eq("And 机检：escalations[0].reasonCode='execution_failed'", escalationOf(s, 0)?.reasonCode, 'execution_failed');

      // And 机检：HO-001 state='delivered'（上游尚未转 done）
      c.eq("And 机检：HO-001 state='delivered'", handoffOf(s, 'HO-001')?.state, 'delivered');
      c.check('And 机检：T-001 未转 done（没有 review.evidence_verified 之外的 done 事件）',
        nodeOf(s, 'T-001')?.state !== 'done', nodeOf(s, 'T-001')?.state);

      // And 机检：counters.dispatchCount=2；没有 HO-002，也没有第 3 次派发
      c.eq('And 机检：counters.dispatchCount=2', s?.counters?.dispatchCount, 2);
      c.check('And 机检：没有 HO-002', handoffOf(s, 'HO-002') === null,
        (s?.handoffs ?? []).map((h) => h.handoffId).join(','));
      const events = readEvents(root);
      c.eq('And 机检：events 中 node.dispatch 恰好 2 条（没有第 3 次派发）',
        events.filter((e) => e.reason === 'node.dispatch').length, 2);
      c.eq('And 机检：events 中没有 backflow.constructed（执行失败不回流）',
        events.filter((e) => e.reason === 'backflow.constructed').length, 0);
      c.eq('And 机检：events 中没有 handoff.created 的第 2 张（不构造 HO-002）',
        events.filter((e) => e.reason === 'handoff.created').length, 1);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
