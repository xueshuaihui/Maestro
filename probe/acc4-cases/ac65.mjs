// AC-65 下游会话创建失败不留未投递包（异常 / mock 夹具面）
// Given：I1.2 编码闭环 dispatch-fail-retest 夹具（复测节点 sessionNew 失败）。
import {
  makeCase, freshRoot, runScene, handoffList, readState, readEvents, reasonsOf,
  text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-65';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // When：核心投递复测交接包（场景内复测节点 sessionNew 失败）
    const r = c.cmd(runScene(root, { scenario: 'dispatch-fail-retest' }),
      'orch run code-loop dispatch-fail-retest');
    const hl = c.cmd(handoffList(root), 'orch handoff list');
    const s = readState(root);
    const ev = readEvents(root);
    const hs = s?.handoffs ?? [];
    // 「本轮复测包」= 最后一指向测试节点 T-002 的包。
    const toTest = hs.filter((h) => h.toNodeId === 'T-002');
    const last = toTest.at(-1) ?? null;

    c.eq('Then：实例挂起并显示升级（suspended）', s?.state, 'suspended');
    c.eq('机检：escalations[0].reasonCode === dispatch_failed', s?.escalations?.[0]?.reasonCode, 'dispatch_failed');
    c.eq('机检：本轮复测包 state === rejected', last?.state, 'rejected');
    c.eq('机检：本轮复测包 rejectReason === delivery_failed', last?.rejectReason, 'delivery_failed');
    c.check('机检：handoffs 中没有该节点本轮的 created 包（不留孤儿包）',
      !hs.some((h) => h.toNodeId === 'T-002' && h.state === 'created'),
      JSON.stringify(hs.map((h) => ({ id: h.handoffId, state: h.state, to: h.toNodeId, reason: h.rejectReason }))));
    c.check('机检：没有 handoff.pending', !reasonsOf(ev).includes('handoff.pending'), reasonsOf(ev).join(','));
    c.notIncludes('Then：不出现「待投递」', text(r), '待投递');
    c.includes('Then：该交接包以「已拒绝（投递失败）」收尾', text(hl), '已拒绝（投递失败）');
    c.note('上一轮收口期发现的产品缺陷（dispatch_failed 升级分支遗留 created 孤儿包）已由 src/core/orchestrator.js:1606 的既有修复收口：本轮机检全通过（末张复测包 rejected/delivery_failed、无 created 包、无 handoff.pending）。修复登记见 probe/acc4-f-blockers.md。');
    return conclude(c, root);
  },
}];
