// AC-61 取消时待投递交接包不再重试（异常 / mock 夹具面）
import path from 'node:path';
import {
  makeCase, freshRoot, writeLocalTaskScenario, retrySteps, prepareScene,
  launch, baseEnv, seam, delivery, cancel, waitUntil, readState, readEvents,
  readInboxAll, readAttemptFiles, reasonsOf, DOC_TASK, text, sleep,
  requirementTitle, conclude,
} from '../acc4-f-common.mjs';

const AC = 'AC-61';
export const cases = [{
  ac: AC, title: requirementTitle(AC), face: 'mock 夹具面', grade: 'mock 实测',
  async run() {
    const c = makeCase(AC, { title: requirementTitle(AC) });
    const root = freshRoot(AC); c.add(root);

    // Given：T-002 首次 prompt 失败一次；after_output:T-001 停住；test.delivery hold
    const scenario = writeLocalTaskScenario(root, 'ac61-hold', retrySteps(1));
    prepareScene(root, { scenario, suite: 'task-loop', cwd: 'demo' });
    const h = launch(root, ['run', '--cwd', './demo', '--task', DOC_TASK, '--template', 'task-loop'],
      { env: baseEnv({ MAESTRO_TEST_PAUSE: 'after_output:T-001' }) });
    const paused = await h.waitFile('.mock/paused', 30000);
    c.check('Given：项目根出现 .mock/paused', Boolean(paused), String(h.stdout).slice(-200));
    c.cmd(seam(root, 'test.delivery', { instance: 'INST-001', action: 'hold' }), 'call-seam test.delivery --action hold');
    h.release();
    // 必须等到「重试等待点」真正落定（handoff.pending 事件出现）再 cancel；
    // 只看 deliveryAttempts>=1 会在包刚 delivered 时过早返回，cancel 后接缝
    // 放行仍会触发一次重试，误判为缺陷。
    const held = await waitUntil(() => readEvents(root).some((e) => e.reason === 'handoff.pending'),
      { timeout: 30000, interval: 100 });
    c.check('Given：交接包停在「待投递 · 重试 1/2」重试等待点', Boolean(held),
      JSON.stringify({ handoffs: (readState(root)?.handoffs ?? []).map((x) => [x.handoffId, x.state, x.deliveryAttempts]), reasons: reasonsOf(readEvents(root)) }));
    const before = readState(root);
    const attemptsBefore = readAttemptFiles(root);
    const pendingBefore = reasonsOf(readEvents(root)).filter((r) => r === 'handoff.pending').length;
    c.cmd(delivery(root, 'hold', 'INST-001'), 'call-seam test.delivery --action hold（占位复跑，确认幂等）');

    // When：cancel，随后 test.delivery release
    const cc = c.cmd(cancel(root), 'orch cancel --instance INST-001');
    const rel = c.cmd(delivery(root, 'release', 'INST-001'), 'call-seam test.delivery --action release');
    await Promise.race([h.done, sleep(25000)]);
    c.keep('orch run task-loop（前台，投递重试等待点）', h);
    const after = readState(root);
    const attemptsAfter = readAttemptFiles(root);
    const inbox = readInboxAll(root);

    c.eq('Then：cancel 退出码 0', cc.exitCode, 0);
    c.includes('Then：该交接包显示「已拒绝（已撤回）」', text(cc), '已拒绝（已撤回）');
    c.eq('机检：实例 cancelled', after?.state, 'cancelled');
    const pkg = (after?.handoffs ?? []).find((x) => x.handoffId === 'HO-001');
    c.eq('机检：包 state === rejected', pkg?.state, 'rejected');
    c.eq('机检：包 rejectReason === withdrawn', pkg?.rejectReason, 'withdrawn');
    c.eq('机检：deliveryAttempts 不再增加', pkg?.deliveryAttempts, before?.handoffs?.find((x) => x.handoffId === 'HO-001')?.deliveryAttempts);
    // 需求只按 prompt-attempts-<sessionId>.json 计数；prompt-failures-* 是故障
    // 元数据，不属于该机检点。另需比较「释放前/后」pending 事件数是否相等，
    // 而不是断言全程没有 handoff.pending（Given 阶段本来就停在重试等待点）。
    const attemptKeys = (o) => Object.entries(o)
      .filter(([k]) => k.startsWith('prompt-attempts-'))
      .map(([k, v]) => [k, v?.attempts]).sort();
    c.check('机检：release 后 .mock/prompt-attempts-<sessionId>.json 的 attempts 不再增加',
      JSON.stringify(attemptKeys(attemptsAfter)) === JSON.stringify(attemptKeys(attemptsBefore)),
      `before=${JSON.stringify(attemptsBefore)} after=${JSON.stringify(attemptsAfter)}`);
    c.check('机检：.orch/inbox/INST-001/HO-001.json 仍存在', Object.keys(inbox).some((k) => k.includes('HO-001')), Object.keys(inbox).join(','));
    c.eq('机检：释放后不再发起重试（无新增 handoff.pending）',
      reasonsOf(readEvents(root)).filter((r) => r === 'handoff.pending').length, pendingBefore);
    await h.stop();
    return conclude(c, root);
  },
}];
