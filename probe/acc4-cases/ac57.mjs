// AC-57 新动作都有审计事件（机检 / mock 夹具面）
// 完整流程的互斥状态（同一实例无法同时「审批通过/拒绝」「坏包/合法包」「暂停/恢复」）
// 由多个独立项目根各自跑真实子流程取证，再对每条 `instance log --format json` 汇总 reason。
import {
  makeCase, freshRoot, badHandoff, runLocalTaskScene, retrySteps, holdApproval,
  approve, runScene, escalateResolve, pauseAtOutput, workflow, instanceLog,
  readState, text, sleep, waitUntil, requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const NEEDED = ['handoff.inboxed', 'handoff.pending', 'handoff.expired', 'handoff.rejected',
  'escalation.created', 'escalation.resolved', 'approval.created', 'permission.allowed',
  'permission.denied', 'workflow.paused', 'workflow.resumed'];

const AC = 'AC-57';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const roots = [];
    const mk = (suffix) => { const r = freshRoot(`${AC}-${suffix}`); c.add(r); roots.push(r); return r; };

    // ① 校验失败（坏包）→ handoff.rejected / escalation.created
    const bad = mk('bad');
    await badHandoff(bad, 'no-evidence');
    // ② 投递重试直至耗尽 → handoff.inboxed / handoff.pending / handoff.expired
    const retry = mk('retry');
    c.cmd(runLocalTaskScene(retry, { name: 'ac57-retry', steps: retrySteps(3) }), 'orch run task-loop（3 次投递失败）');
    // ③ 审批通过 → approval.created / permission.allowed
    const allow = mk('allow');
    const ha = await holdApproval(allow);
    c.cmd(approve(allow, 'APR-001', 'allow', 'INST-001'), 'orch approve APR-001 --decision allow');
    await Promise.race([ha.h.done, sleep(30000)]); c.keep('orch run --approval hold（allow 前台）', ha.h);
    await ha.h.stop();
    // ④ 审批拒绝 → permission.denied
    const deny = mk('deny');
    const hd = await holdApproval(deny);
    c.cmd(approve(deny, 'APR-001', 'deny', 'INST-001'), 'orch approve APR-001 --decision deny');
    await Promise.race([hd.h.done, sleep(30000)]); c.keep('orch run --approval hold（deny 前台）', hd.h);
    await hd.h.stop();
    // ⑤ 升级处理 → escalation.resolved
    const esc = mk('escalation');
    c.cmd(runScene(esc, { scenario: 'rounds-exceeded' }), 'orch run code-loop rounds-exceeded');
    c.cmd(escalateResolve(esc, 'ESC-001', 'pass', 'INST-001'), 'orch escalate resolve ESC-001 --decision pass');
    // ⑥ 暂停 / 恢复 → workflow.paused / workflow.resumed
    const flow = mk('flow');
    const hf = await pauseAtOutput(flow, 'T-001', { scenario: 'pass' });
    c.cmd(workflow(flow, 'pause', 'INST-001'), 'orch workflow pause INST-001');
    hf.h.release();
    await Promise.race([hf.h.done, sleep(30000)]);
    c.cmd(workflow(flow, 'resume', 'INST-001'), 'orch workflow resume INST-001');
    await waitUntil(() => readState(flow)?.state === 'completed', { timeout: 25000, interval: 150 });
    c.keep('orch run（暂停/恢复前台）', hf.h);
    await hf.h.stop();

    // When：对每个子流程执行 orch instance log INST-001 --format json，汇总 reason
    const seen = new Set();
    let parsedAll = true;
    for (const root of roots) {
      const lj = c.cmd(instanceLog(root, 'INST-001', 'json'), `orch instance log INST-001 --format json（${root.split('/').pop()}）`);
      try {
        const arr = JSON.parse(text(lj));
        c.check(`Then：${root.split('/').pop()} 的 log json 可解析且非空`, Array.isArray(arr) && arr.length > 0, `array=${Array.isArray(arr)} len=${arr?.length}`);
        for (const e of arr) seen.add(e.reason);
      } catch { parsedAll = false; }
    }
    c.check('Then：所有 instance log --format json 均可解析', parsedAll, String(parsedAll));
    for (const reason of NEEDED) {
      c.check(`机检：事件 reason 覆盖 ${reason}`, seen.has(reason), [...seen].sort().join(','));
    }
    c.note('完整流程的互斥状态由 6 个独立项目根各自真实子流程取证（单实例无法同时具备通过/拒绝、坏包/合法包、暂停/恢复）；approval.withdrawn 与 workspace.status_write_failed 按需求不在本 AC 断言，分别由 AC-35、AC-59 覆盖。');
    return conclude(c, roots);
  },
}];
