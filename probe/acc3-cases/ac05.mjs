// AC-05 下游接受之后，上游才变已完成（夹具：doc-backflow-once 的 events.jsonl）。
import {
  makeCase, freshRoot, runSync, coreStop, forceKillCore,
  readState, readEvents, nodeOf, handoffOf, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-05';
const SCENARIO = 'doc-backflow-once';

const isNodeDone = (e, id) => e.object === 'node' && e.objectId === id && e.to === 'done' && e.reason === 'review.downstream_accepted';
const acceptedSeq = (events, handoffId) => {
  const e = events.find((x) => x.object === 'handoff' && x.objectId === handoffId && x.to === 'accepted');
  return e ? e.seq : null;
};

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '下游接受之后，上游才变已完成',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);
    try {
      c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      const events = readEvents(root);
      const state = readState(root);

      // 配对前提：四张交接包都在，方向正确
      const edges = ['HO-001', 'HO-002', 'HO-003', 'HO-004'].map((id) => {
        const h = handoffOf(state, id);
        return `${id}=${h?.edge?.from}→${h?.edge?.to}/${h?.edge?.kind}`;
      }).join(',');
      c.eq('机检：四张交接包的方向/种类（HO-001/HO-002 正向，HO-003 回流，HO-004 复测）', edges,
        'HO-001=T-001→T-002/forward,HO-002=T-002→T-003/forward,HO-003=T-003→T-002/backflow,HO-004=T-002→T-003/retest');

      // 配对 1：(T-001, HO-001)
      const a1 = acceptedSeq(events, 'HO-001');
      const d1 = events.filter((e) => isNodeDone(e, 'T-001'));
      c.check('机检：(T-001, HO-001) 存在 T-001 的 review.downstream_accepted done 事件', d1.length === 1,
        d1.map((e) => `#${e.seq} round=${e.detail?.round ?? '-'}`).join(' / ') || '无');
      c.check('机检：T-001 done 的 seq 大于 HO-001 accepted 的 seq',
        Boolean(a1) && d1.length === 1 && d1[0].seq > a1, `done=${d1[0]?.seq ?? '-'} accepted=${a1 ?? '-'}`);

      // 配对 2/3：(T-002 第 1 轮, HO-002)、(T-002 第 2 轮, HO-004)
      const d2 = events.filter((e) => isNodeDone(e, 'T-002'));
      c.eq('机检：objectId=T-002、to=done、reason=review.downstream_accepted 的事件恰好 2 条', d2.length, 2);
      const byRound = new Map(d2.map((e) => [e.detail?.round, e]));
      c.eq('机检：两条 T-002 done 事件按 detail.round 配对（1/2）', [...byRound.keys()].sort().join(','), '1,2');
      const a2 = acceptedSeq(events, 'HO-002');
      const a4 = acceptedSeq(events, 'HO-004');
      c.check('机检：(T-002 第 1 轮, HO-002) 的 done seq 大于 HO-002 accepted seq',
        Boolean(a2) && Boolean(byRound.get(1)) && byRound.get(1).detail?.handoffId === 'HO-002' && byRound.get(1).seq > a2,
        `done=${byRound.get(1)?.seq ?? '-'} handoff=${byRound.get(1)?.detail?.handoffId ?? '-'} accepted=${a2 ?? '-'}`);
      c.check('机检：(T-002 第 2 轮, HO-004) 的 done seq 大于 HO-004 accepted seq',
        Boolean(a4) && Boolean(byRound.get(2)) && byRound.get(2).detail?.handoffId === 'HO-004' && byRound.get(2).seq > a4,
        `done=${byRound.get(2)?.seq ?? '-'} handoff=${byRound.get(2)?.detail?.handoffId ?? '-'} accepted=${a4 ?? '-'}`);

      // 配对 4：(T-003, 无上游门控)
      const t3pass = events.find((e) => e.object === 'node' && e.objectId === 'T-003' && e.to === 'done'
        && e.result === 'applied' && e.reason === 'verification.passed');
      c.check('机检：T-003 的迁移事件是 applied / done / verification.passed', Boolean(t3pass),
        t3pass ? `#${t3pass.seq} ${t3pass.result}/${t3pass.to}/${t3pass.reason}` : '无');
      const t3note = events.find((e) => e.object === 'node' && e.objectId === 'T-003' && e.result === 'note' && e.reason === 'review.passed');
      c.check('机检：T-003 的审核结论是同节点另一条 note / review.passed 事件（不是同一条记录）',
        Boolean(t3note) && Boolean(t3pass) && t3note.seq !== t3pass.seq
          && !(t3note.to === 'done') && t3note.result === 'note',
        t3note ? `#${t3note.seq} ${t3note.result}/${t3note.reason} vs #${t3pass?.seq}` : '无');
      c.check('机检：T-003 没有 review.downstream_accepted 的 done 事件（terminal 节点 downstreamGate:false）',
        !events.some((e) => isNodeDone(e, 'T-003')), '检查全部 T-003 done 事件');

      // 逐对反证：任何 to=done 都不早于它自己那张交接包的 accepted
      const early = [];
      if (d1.some((e) => !(e.seq > a1))) early.push('T-001/HO-001');
      if (d2.some((e) => !(e.seq > acceptedSeq(events, e.detail?.handoffId)))) early.push('T-002');
      c.check('机检：不存在 T-001 / T-002 的任何 to=done 事件早于它自己那一张交接包的 accepted（逐对比较）',
        early.length === 0, early.length ? early.join(',') : '三对全部满足 done.seq > 对应 accepted.seq');

      // 收尾字段
      const t1 = nodeOf(state, 'T-001');
      const t2 = nodeOf(state, 'T-002');
      c.eq('机检：T-001 最终 state/reviewReason = done/空', `${t1?.state}/${t1?.reviewReason ?? ''}`, 'done/');
      c.eq('机检：T-002 最终 state/reviewReason = done/空', `${t2?.state}/${t2?.reviewReason ?? ''}`, 'done/');
      c.note('事件按 seq 全序；`detail.round` 用于区分 T-002 的两轮配哪一张交接包（HO-002 / HO-004），seq 只作交叉验证。');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
