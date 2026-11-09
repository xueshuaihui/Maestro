// AC-26 重新分配 → 新会话、新一轮、只重跑该节点（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, pauseAtOutput, seam, seamJson, escalateResolve,
  readState, text, sleep, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-26';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // Given：开发节点已派发过一次并回到空闲；test.escalate 把该节点置为 rounds_exceeded，实例挂起、测试尚未派发
    const { h, paused } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
    c.check('夹具：pause 命中', paused, String(paused));
    const es = c.cmd(seam(root, 'test.escalate', { instance: 'INST-001', node: 'T-001', reasonCode: 'rounds_exceeded' }),
      'call-seam test.escalate（node T-001）');
    c.check('夹具：接缝注册升级成功', seamJson(es)?.ok === true, String(seamJson(es)));
    h.release();
    await Promise.race([h.done, sleep(35000)]);
    c.keep('orch run（放行后挂起收尾）', h);
    const before = readState(root);
    c.eq('Given：实例 suspended', before?.state, 'suspended');
    c.eq('Given：测试 round 0', before?.nodes?.find((n) => n.nodeId === 'T-002')?.round, 0);
    const sessionsBefore = (before?.sessions ?? []).length;

    // When：retry；断言时刻取 resolve 返回后的即时快照（核心异步推进前）
    const res = c.cmd(escalateResolve(root, 'ESC-001', 'retry', 'INST-001'),
      'orch escalate resolve ESC-001 --instance INST-001 --decision retry');
    const after = readState(root);
    c.includes('Then：输出「升级 ESC-001 已处理（重新分配）」', text(res), '升级 ESC-001 已处理（重新分配）');
    c.includes('Then：输出当前实例行「实例 INST-001 · 运行中 · 模板 编码闭环」', text(res), '实例 INST-001 · 运行中 · 模板 编码闭环');
    c.eq('机检：sessions.length 增加 1', (after?.sessions ?? []).length, sessionsBefore + 1);
    c.eq('机检：目标节点 T-001 round 增加 1', (after?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round,
      (before?.nodes ?? []).find((n) => n.nodeId === 'T-001')?.round + 1);
    c.eq('Then：测试没有被重跑（T-002 round 不变，仍 0）', (after?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.round, 0);
    c.check('机检：旧会话不再是 running', (after?.sessions ?? [])[0]?.state !== 'running',
      (after?.sessions ?? []).map((s) => s.state).join(','));
    await h.stop();
    return conclude(c, root);
  },
}];
