// AC-24 通过处理中间节点升级 → 下游继续（正常路径 / mock 夹具面）
import {
  makeCase, freshRoot, putTaskFile, pauseAtOutput, seam, seamJson, escalateResolve,
  readState, readEvents, reasonsOf, statusText, text, sleep, waitUntil,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-24';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);
    // Given：任务目录放好非空 calc.js；用 test.escalate 把开发节点置为 rounds_exceeded 升级，测试尚未派发
    putTaskFile(root, 'calc.js', 'export function add(a,b){return a+b}\n');
    const { h, paused } = await pauseAtOutput(root, 'T-001', { scenario: 'pass' });
    c.check('夹具：pause at after_output:T-001 命中', paused, String(paused));
    const es = c.cmd(seam(root, 'test.escalate', { instance: 'INST-001', node: 'T-001', reasonCode: 'rounds_exceeded' }),
      'call-seam test.escalate --reason-code rounds_exceeded（node T-001）');
    c.check('夹具：接缝注入升级成功', seamJson(es)?.ok === true, String(seamJson(es)));
    h.release();
    await Promise.race([h.done, sleep(35000)]);
    c.keep('orch run（放行后挂起收尾）', h);
    const before = readState(root);
    c.eq('Given：实例挂起', before?.state, 'suspended');
    c.eq('Given：测试尚未派发（T-002 round 0）', before?.nodes?.find((n) => n.nodeId === 'T-002')?.round, 0);

    // When：人工 pass
    const res = c.cmd(escalateResolve(root, 'ESC-001', 'pass', 'INST-001'),
      'orch escalate resolve ESC-001 --instance INST-001 --decision pass');
    c.includes('Then：输出「升级 ESC-001 已处理（通过）」', text(res), '升级 ESC-001 已处理（通过）');
    const done = await waitUntil(() => {
      const s = readState(root);
      return s && (s.state === 'completed' || s.state === 'running') ? s : null;
    }, { timeout: 25000, interval: 200 });
    const after = readState(root);
    c.check('Then/机检：实例 running 或 completed', ['running', 'completed'].includes(after?.state), String(after?.state));
    c.includes('Then：orch status 显示测试执行中或已完成', text(c.cmd(statusText(root), 'orch status --instance INST-001')), '节点 T-002');

    // 核心在 resolve 之后异步推进测试；以「指向测试的交接包进入终态」为同步点
    const settled = await waitUntil(() => {
      const s = readState(root);
      const h = (s?.handoffs ?? []).find((x) => x.toNodeId === 'T-002');
      return h && ['consumed', 'delivered', 'accepted'].includes(h.state) ? { s, h } : null;
    }, { timeout: 25000, interval: 200 });
    const afterSettled = settled?.s ?? after;
    const ev = readEvents(root);
    c.check('机检：出现一次新的 node.dispatch（指向 T-002）',
      ev.filter((e) => e.reason === 'node.dispatch' && e.detail?.nodeId === 'T-002').length >= 1,
      reasonsOf(ev).join(','));
    c.check('机检：下游节点 T-002 round 增加', (afterSettled?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.round >= 1,
      String((afterSettled?.nodes ?? []).find((n) => n.nodeId === 'T-002')?.round));
    c.notIncludes('机检：没有 handoff.rejected 事件', reasonsOf(ev).join(','), 'handoff.rejected');
    c.check('机检：交接包校验通过（指向测试的 HO-001 进入 delivered/consumed）',
      Boolean(settled) && ['consumed', 'delivered', 'accepted'].includes(settled.h.state),
      JSON.stringify((afterSettled?.handoffs ?? []).filter((x) => x.toNodeId === 'T-002').map((x) => ({ id: x.handoffId, state: x.state }))));
    await h.stop();
    c.note('Given 的「有证据的交接包」由真实产物 calc.js 的已验证 artifactRefs 提供（核心在 pass 后据此构造 HO-001）。实测接缝 --artifact-ref 注入会生成未验证引用而被 handoff-schema 以「缺少证据引用」拒绝，故按需求意图改走真实已验证产物路径；结论仍是核心立即推进测试、校验通过。');
    return conclude(c, root);
  },
}];
