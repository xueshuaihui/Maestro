// AC-35 阶段耗时区间不重叠，等待下游不计入上游耗时（doc-backflow-once 完整跑完）。
// 逐轮边界一律取 events.jsonl 的 ts（终态的 roundStartedAt 会被后续派发重置）。
import {
  makeCase, freshRoot, runSync, statusText, readState, readEvents, nodeOf, handoffOf,
  coreStop, forceKillCore, requirementTitle, finish, lines
} from '../acc3-f-common.mjs';

const AC = 'AC-35';
const SCENARIO = 'doc-backflow-once';

const ms = (v) => (typeof v === 'string' ? Date.parse(v) : NaN);
const at = (e) => (e ? `#${e.seq} ${e.ts}` : '（缺失）');
const byNodeReason = (events, id, reason) => events.filter((e) => e.object === 'node' && e.objectId === id && e.reason === reason);

/** 与 src/cli/labels.js 的 formatDuration 同口径（含渲染层「同毫秒钳到 1s」）。 */
function fmtDuration(msValue) {
  const value = Number(msValue);
  if (!Number.isFinite(value) || value <= 0) return '0s';
  let totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 1) totalSeconds = 1;
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`;
}

/** 'Xs' / '1m12s' → 秒；解析不了返回 NaN。 */
function parseDuration(text) {
  const m = /^(?:(\d+)m)?(\d+)s$/.exec(String(text));
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 60 + Number(m[2]);
}

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '阶段耗时区间不重叠，等待下游不计入上游耗时',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 0', run.exitCode, 0);

      const s = readState(root);
      const events = readEvents(root).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
      const dispatches = events.filter((e) => e.reason === 'node.dispatch');
      const d = (nodeId, round) => dispatches.find((e) => e.objectId === nodeId && e.detail?.round === round) ?? null;

      const t1Ev = byNodeReason(events, 'T-001', 'review.evidence_verified')[0] ?? null;
      const t2Ev = byNodeReason(events, 'T-002', 'review.evidence_verified');
      const t3Read = byNodeReason(events, 'T-003', 'review.read');
      const t3Rej = byNodeReason(events, 'T-003', 'review.rejected');
      const runStart = events.find((e) => e.reason === 'run.started') ?? null;

      c.eq('前置：5 次 node.dispatch（T-001/T-002r1/T-003r1/T-002r2/T-003r2）',
        dispatches.map((e) => `${e.objectId}r${e.detail?.round}`).join(','), 'T-001r1,T-002r1,T-003r1,T-002r2,T-003r2');

      // —— 阶段区间：上游核对通过 ≤ 下游派发
      c.check('机检：T-001 的 review.evidence_verified ts ≤ T-002 第 1 轮 node.dispatch ts',
        Boolean(t1Ev) && Boolean(d('T-002', 1)) && ms(t1Ev.ts) <= ms(d('T-002', 1).ts),
        `${at(t1Ev)} ≤ ${at(d('T-002', 1))}`);

      c.check('机检：T-002 第 1 轮 review.evidence_verified ts ≤ T-003 第 1 轮 node.dispatch ts',
        Boolean(t2Ev[0]) && Boolean(d('T-003', 1)) && ms(t2Ev[0].ts) <= ms(d('T-003', 1).ts),
        `${at(t2Ev[0])} ≤ ${at(d('T-003', 1))}`);

      c.check('机检：T-003 第 1 轮 review.read ts ≤ T-002 第 2 轮 node.dispatch ts',
        Boolean(t3Read[0]) && Boolean(d('T-002', 2)) && ms(t3Read[0].ts) <= ms(d('T-002', 2).ts),
        `${at(t3Read[0])} ≤ ${at(d('T-002', 2))}`);

      c.check('机检：T-002 第 2 轮 review.evidence_verified ts ≤ T-003 第 2 轮 node.dispatch ts',
        Boolean(t2Ev[1]) && Boolean(d('T-003', 2)) && ms(t2Ev[1].ts) <= ms(d('T-003', 2).ts),
        `${at(t2Ev[1])} ≤ ${at(d('T-003', 2))}`);

      // —— 每一轮的下界：本轮起点不早于上游的结束事件
      const t1 = nodeOf(s, 'T-001');
      const t2 = nodeOf(s, 'T-002');
      c.check('机检：T-001 第 1 轮 roundStartedAt ≥ run.started 事件 ts',
        typeof t1?.roundStartedAt === 'string' && Boolean(runStart) && ms(t1.roundStartedAt) >= ms(runStart.ts),
        `${t1?.roundStartedAt} ≥ ${runStart?.ts}`);
      c.check('机检：T-002 第 1 轮起点（= startedAt，第 2 轮不重置）≥ T-001 的 review.evidence_verified 事件 ts（同一时刻允许）',
        typeof t2?.startedAt === 'string' && Boolean(t1Ev) && ms(t2.startedAt) >= ms(t1Ev.ts),
        `${t2?.startedAt} ≥ ${t1Ev?.ts}`);
      c.check('机检：T-002 第 2 轮 node.dispatch ts ≥ T-003 第 1 轮 review.rejected（result=note）事件 ts（同轮起点，同一时刻允许）',
        Boolean(t3Rej[0]) && t3Rej[0].result === 'note' && Boolean(d('T-002', 2)) && ms(d('T-002', 2).ts) >= ms(t3Rej[0].ts),
        `${d('T-002', 2)?.ts} ≥ ${t3Rej[0]?.ts}（result=${t3Rej[0]?.result}）`);
      c.note('第 2 轮与第 3 条的「本轮起点」用 events.jsonl 的 node.dispatch ts（终态 roundStartedAt 已被第 2 轮重置，见 AC-35 需求原文说明）。');

      // —— 跨轮累计：startedAt 取自第 1 轮派发，endedAt 是第 2 轮完成时刻
      c.check('机检：T-002 的 startedAt = 第 1 轮 node.dispatch 事件 ts（逐字等式）',
        typeof t2?.startedAt === 'string' && Boolean(d('T-002', 1)) && t2.startedAt === d('T-002', 1).ts,
        `startedAt=${t2?.startedAt} vs dispatch=${d('T-002', 1)?.ts}（差 ${Number.isFinite(ms(t2?.startedAt)) && Number.isFinite(ms(d('T-002', 1)?.ts)) ? ms(d('T-002', 1).ts) - ms(t2.startedAt) : 'NaN'}ms）`);
      c.check('机检：T-002 的 startedAt 指向第 1 轮、没有被第 2 轮重置（语义）',
        typeof t2?.startedAt === 'string' && Boolean(d('T-002', 2)) && ms(t2.startedAt) < ms(d('T-002', 2).ts),
        `${t2?.startedAt} < ${d('T-002', 2)?.ts}`);
      c.check('机检：T-002 的 endedAt = 第 2 轮完成时刻（= 第 2 轮 review.evidence_verified 事件 ts）',
        typeof t2?.endedAt === 'string' && Boolean(t2Ev[1]) && t2.endedAt === t2Ev[1].ts,
        `endedAt=${t2?.endedAt} vs evidence=${t2Ev[1]?.ts}`);

      // —— 终态 status 的 T-001 行耗时 ≈ endedAt - startedAt，且 endedAt ≤ HO-001 accepted（等下游那段不计入）
      const st = c.cmd(statusText(root), 'orch status --instance INST-001');
      const stText = `${st.stdout}${st.stderr}`;
      const t1Row = lines(stText).find((l) => l.includes('节点 T-001')) ?? '';
      const durationText = /耗时 ([^\s·]+)/.exec(t1Row)?.[1] ?? null;
      const expectedMs = ms(t1.endedAt) - ms(t1.startedAt);
      const expectedText = fmtDuration(expectedMs);
      c.check(`机检：终态 orch status 的 T-001 行耗时 ≈ T-001.endedAt - T-001.startedAt（${expectedMs}ms → ${expectedText}）`,
        durationText === expectedText && Number.isFinite(parseDuration(durationText)),
        `行=${t1Row} / 解析=${durationText}`);

      const ho1Accepted = events.find((e) => e.object === 'handoff' && e.objectId === 'HO-001' && e.to === 'accepted') ?? null;
      c.check('机检：T-001 的 endedAt ≤ HO-001 的 accepted 事件 ts（核对通过即定格，等下游那段不计入）',
        Boolean(ho1Accepted) && ms(t1.endedAt) <= ms(ho1Accepted.ts),
        `endedAt=${t1.endedAt} ≤ accepted=${ho1Accepted?.ts}`);

      // —— done 事件的 reason 分布
      const downAccepted = events.filter((e) => e.object === 'node' && e.to === 'done' && e.reason === 'review.downstream_accepted');
      c.eq("机检：node→done、reason=review.downstream_accepted 的事件共 3 条（T-001 一次、T-002 两轮各一次）",
        downAccepted.length, 3);
      c.eq('机检：这 3 条分别是 T-001×1 / T-002×2',
        downAccepted.map((e) => `${e.objectId}r${e.detail?.round}`).join(','), 'T-001r1,T-002r1,T-002r2');
      const t3Done = events.filter((e) => e.object === 'node' && e.objectId === 'T-003' && e.to === 'done');
      c.check('机检：T-003 的 done 事件 reason 是 verification.passed（不在这 3 条里）',
        t3Done.length === 1 && t3Done[0].reason === 'verification.passed',
        t3Done.map((e) => `#${e.seq} ${e.result}/${e.reason}`).join(' '));

      // —— 节点行不含「耗时 0s」
      const nodeRows = lines(stText).filter((l) => l.includes('节点 '));
      c.check('机检：节点行不含「耗时 0s」', nodeRows.length > 0 && nodeRows.every((l) => !l.includes('耗时 0s')),
        nodeRows.join(' | '));

      // 佐证：交接包与派发一一对应（AC-33 的输入）
      c.eq('佐证：handoffs 4 条（forward/forward/backflow/retest）',
        (s?.handoffs ?? []).map((h) => `${h.handoffId}:${h.edge?.kind}`).join(','),
        'HO-001:forward,HO-002:forward,HO-003:backflow,HO-004:retest');
      c.check('佐证：HO-001 存在且已 accepted', handoffOf(s, 'HO-001')?.state === 'consumed', handoffOf(s, 'HO-001')?.state);
      c.note(
        '关于「T-002 的 startedAt = 第 1 轮 node.dispatch 事件 ts」：逐字等式不成立，稳定差 4~8ms'
        + '（startedAt 在 dispatchInState 开头由 iso() 写死，事件 ts 由 bus 在 saveState 落盘之后生成，'
        + 'src/core/orchestrator.js:1121、:1134-1145）。语义口径（startedAt 取第 1 轮、第 2 轮不重置）成立。'
        + '该等式是与实现因果顺序冲突的亚 10ms 判据，建议需求改为「startedAt ≤ 第 1 轮 node.dispatch ts」'
        + '或让 node.dispatch 直接带 startedAt 的 ts。'
      );
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
