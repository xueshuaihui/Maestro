// AC-33 每次派发对应一张交接包，编号连续（doc-backflow-once 完整跑完）。
import {
  makeCase, freshRoot, runSync, statusEvents, readState, readEvents, eventSeqs,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-33';
const SCENARIO = 'doc-backflow-once';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '每次派发对应一张交接包，编号连续',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 0', run.exitCode, 0);

      const s = readState(root);
      const handoffs = s?.handoffs ?? [];

      c.eq('机检：handoffs 恰好 4 条', handoffs.length, 4);
      c.eq('机检：handoffId 依次是 HO-001、HO-002、HO-003、HO-004',
        handoffs.map((h) => h.handoffId).join(','), 'HO-001,HO-002,HO-003,HO-004');
      c.eq('机检：edge.kind 依次是 forward、forward、backflow、retest',
        handoffs.map((h) => h.edge?.kind).join(','), 'forward,forward,backflow,retest');
      c.eq("机检：四条 state 都是 'consumed'", handoffs.map((h) => h.state).join(','), 'consumed,consumed,consumed,consumed');
      c.check('机检：四条 createdAt 都非空', handoffs.every((h) => typeof h.createdAt === 'string' && h.createdAt.length > 0),
        handoffs.map((h) => h.createdAt).join(','));
      c.check('机检：四条 consumedAt 都非空', handoffs.every((h) => typeof h.consumedAt === 'string' && h.consumedAt.length > 0),
        handoffs.map((h) => h.consumedAt).join(','));

      c.eq('机检：counters.dispatchCount=5（首派没有前置交接包）', s?.counters?.dispatchCount, 5);

      // And：orch status --instance INST-001 --events 的 [#序号] 严格递增、不跳号
      const ev = c.cmd(statusEvents(root), 'orch status --instance INST-001 --events');
      const seqs = eventSeqs(ev);
      const strictlyUp = seqs.every((n, i) => i === 0 || n > seqs[i - 1]);
      const noGap = seqs.every((n, i) => i === 0 ? n === 1 : n === seqs[i - 1] + 1);
      c.check(`And 机检：[#序号] 严格递增（共 ${seqs.length} 条）`, seqs.length > 0 && strictlyUp,
        seqs.slice(0, 8).join(',') + '…' + seqs.slice(-3).join(','));
      c.check("And 机检：[#序号] 不跳号（从 #1 连续递增）", noGap,
        seqs.length ? `首 ${seqs[0]} / 尾 ${seqs.at(-1)} / 条数 ${seqs.length}` : '（无事件行）');
      c.eq('佐证：events.jsonl 的事件条数与 [#] 行数一致', seqs.length, readEvents(root).length);
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
