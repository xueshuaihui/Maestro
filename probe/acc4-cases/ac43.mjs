// AC-43 图反映暂停、挂起、审批与升级（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, runScene, instanceGraph, mutateState, approvalRow,
  graphJson, readState, text, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-43';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const rootA = freshRoot(`${AC}-A`); c.add(rootA);
    const rootB = freshRoot(`${AC}-B`); c.add(rootB);

    // Given A：已暂停且有待审批（hold）——以真实完成状态为母版改写
    c.cmd(runScene(rootA, { scenario: 'pass' }), 'orch run code-loop pass（A 母版）');
    mutateState(rootA, 'INST-001', (s) => {
      s.state = 'running'; s.paused = true;
      s.approvals = [approvalRow('APR-001', 'INST-001')];
      if (s.nodes?.[0]) s.nodes[0].state = 'running';
      if (s.sessions?.[0]) s.sessions[0].state = 'running';
    });
    // Given B：有升级（真实挂起实例）
    c.cmd(runScene(rootB, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded（B 挂起 + 升级）');

    const rA = c.cmd(instanceGraph(rootA, 'INST-001', 'json'), 'orch instance graph INST-001 --format json（A）');
    const rB = c.cmd(instanceGraph(rootB, 'INST-001', 'json'), 'orch instance graph INST-001 --format json（B）');
    const gA = graphJson(rA);
    const gB = graphJson(rB);
    const sA = readState(rootA);
    const sB = readState(rootB);

    c.eq('Then：A 的 paused === true', gA?.paused, true);
    c.check('Then：A 的 approvals 含待处理项', (gA?.approvals ?? []).some((a) => a.state === 'pending'), JSON.stringify(gA?.approvals));
    c.check('Then：A 的 current 指向当前节点或为 null',
      gA?.current === null || (typeof gA?.current === 'object' && typeof gA.current.nodeId === 'string'),
      JSON.stringify(gA?.current));
    c.eq('Then：B 的 paused === false', gB?.paused, false);
    c.check('Then：B 的 escalations 含待处理项', (gB?.escalations ?? []).some((e) => e.state === 'pending'), JSON.stringify(gB?.escalations));
    c.check('Then：B 的 current 指向当前节点或为 null',
      gB?.current === null || (typeof gB?.current === 'object' && typeof gB.current.nodeId === 'string'),
      JSON.stringify(gB?.current));

    // 机检：字段值与 state.json 一致
    c.eq('机检：A paused 与 state.json 一致', gA?.paused, sA?.paused);
    c.eq('机检：A approvals 长度与 state.json 一致', gA?.approvals?.length, sA?.approvals?.length);
    c.eq('机检：A state 与 state.json 一致', gA?.state, sA?.state);
    // suspended 快照未写 paused 字段时，graph 按 false 投影（I1.4 默认口径）。
    c.eq('机检：B paused 与 state.json 一致（未写字段按 false）', gB?.paused, Boolean(sB?.paused));
    c.eq('机检：B escalations 长度与 state.json 一致', gB?.escalations?.length, sB?.escalations?.length);
    c.eq('机检：B state 与 state.json 一致', gB?.state, sB?.state);
    return conclude(c, [rootA, rootB]);
  },
}];
