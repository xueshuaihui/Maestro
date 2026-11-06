// AC-31 审核无效时不留下回流包、不再派发（review-missing 完整跑完）。
import {
  makeCase, freshRoot, runSync, readState, readEvents, nodeOf,
  coreStop, forceKillCore, requirementTitle, finish
} from '../acc3-f-common.mjs';

const AC = 'AC-31';
const SCENARIO = 'review-missing';

export const cases = [{
  ac: AC,
  title: requirementTitle(AC) || '审核无效时不留下回流包、不再派发',
  face: '夹具',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC), face: '夹具' });
    const root = freshRoot(AC);
    c.add(root);

    try {
      // Given：夹具场景 review-missing 已完整跑完
      const run = c.cmd(runSync(root, SCENARIO), `driver --scenario ${SCENARIO}（完整跑完）`);
      c.eq('Given 前置：夹具跑完退出码 4（升级挂起）', run.exitCode, 4);

      const s = readState(root);
      c.eq('机检：counters.dispatchCount=3', s?.counters?.dispatchCount, 3);

      const backflowEvents = readEvents(root).filter((e) => e.reason === 'backflow.constructed');
      c.eq("机检：events 中没有 reason='backflow.constructed'", backflowEvents.length, 0);

      const backflowHandoffs = (s?.handoffs ?? []).filter((h) => h?.edge?.kind === 'backflow');
      c.eq("机检：handoffs 中没有 edge.kind='backflow'", backflowHandoffs.length, 0);
      c.eq('机检：handoffs 恰好 2 条（HO-001、HO-002）',
        (s?.handoffs ?? []).map((h) => h.handoffId).join(','), 'HO-001,HO-002');

      c.eq("机检：T-002 state='done'", nodeOf(s, 'T-002')?.state, 'done');
      c.eq("机检：T-003 state='escalated'", nodeOf(s, 'T-003')?.state, 'escalated');

      const t3Session = (s?.sessions ?? []).find((x) => x.nodeId === 'T-003');
      c.eq("机检：T-003 对应的会话 state='escalated'", t3Session?.state, 'escalated');
      c.check('机检：T-003 升级后没有被再次派发（round 仍为 1）', nodeOf(s, 'T-003')?.round === 1, nodeOf(s, 'T-003')?.round);
      c.eq('机检：实例已挂起（不是 failed）', s?.state, 'suspended');
    } finally {
      c.cmd(coreStop(root), 'orch core stop');
      await forceKillCore(root);
    }
    return finish(c);
  }
}];
