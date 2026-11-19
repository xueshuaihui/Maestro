// AC-15 重复/冲突处理：机检 queue.test.js（AC-15 已处理不重复写）+ ui-views.test.js（A-2 已处理文案逐字）。
// 架构检查按 v11 原文：ESCALATION_NOT_PENDING 在 queue.js 恰好 1 命中（exit 0）。
// 复核发现锚点与实现冲突（常量与结论映射在核心/labels.js，queue.js 只经 QUEUE_ERROR_CONCLUSIONS 透传）→ 不通过 + 裁决请求。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-15';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '异常 / 重复处置 / 机检',
  async run() {
    const c = makeCase(AC, { face: '异常 / 重复处置 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js | head -1', expect: 0, note: 'AC-15 架构①（v12/D-55）：错误码事实在核心（≥1 命中，exit 0）' },
        { cmd: 'grep -REn "QUEUE_ERROR_CONCLUSIONS|DESKTOP_QUEUE_CONCLUSIONS" src/daemon/queue.js | head -1', expect: 0, note: 'AC-15 架构②（v12/D-55）：queue.js 按 code 映射固定结论词（≥1 命中，exit 0）' },
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');

    c.check('AC-15 已处理不重复写用例存在：二次处置返回 ESCALATION_NOT_PENDING / conclusion 已处理',
      Boolean(q?.subtests?.some((x) => /已处理不重复写.*AC-15/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /重复写|已处理/.test(x)).join(' | ') || '（未找到）',
      'second.code === ESCALATION_NOT_PENDING；second.conclusion === 已处理');
    c.check('只按终端首次处置变化：轮次只 +1 / resolution 仍 retry / 无第二次裁决',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      'round===2；escalations[0].resolution===retry；状态不变');
    c.check('A-2 提示逐字「已处理（重新分配），无需再次处理」由 ui-views A-2/AC-49 用例承载',
      Boolean(u?.subtests?.some((x) => /A-2 \/ AC-49: already-resolved/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /already-resolved/.test(x)).join(' | ') || '（未找到）',
      'outcome.text === 已处理（重新分配），无需再次处理');
    c.check('队列 2 秒内自动刷新该行消失',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      '处置后队列条数为 0');

    // 语义复核：字面锚点在 queue.js 零命中，但错误码在核心产生、结论词在 labels.js 由 QUEUE_ERROR_CONCLUSIONS 透传。
    const core = runCmd('grep -REn "ESCALATION_NOT_PENDING" src/core/escalation.js src/core/orchestrator.js src/cli/labels.js', { tmpdir: tmp });
    c.cmd(core, '语义复核：错误码与结论词实际落点');
    c.check('语义复核：错误码在核心产生、结论词由 labels.js 映射（queue.js 经 QUEUE_ERROR_CONCLUSIONS 透传）',
      /ESCALATION_NOT_PENDING/.test(core.stdout) && /已处理/.test(core.stdout),
      core.stdout.trim().split('\n').slice(0, 6).join(' | ') || '（未找到）',
      'core 产生错误码；labels.js:949 ESCALATION_NOT_PENDING: 已处理；queue.js:50 QUEUE_ERROR_CONCLUSIONS 同源引用');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-conflict.test.js（本分支不存在），AC-15 逐字断言合并进 test/wp14/queue.test.js「已处理不重复写」用例；提示文案逐字由 ui-views.test.js「A-2 / AC-49: already-resolved notice is verbatim」承载。按实际文件机检并登记说明，不放宽。');
    c.note('D-55 裁决已落实：需求 v12 把 AC-15 架构锚点从 queue.js 归位核心（D-11 禁改核心：错误码在 escalation.js:89 / orchestrator.js:5049），queue.js:50 以 QUEUE_ERROR_CONCLUSIONS = DESKTOP_QUEUE_CONCLUSIONS 同源引用、:260 按 code 取「已处理」——两条新锚点合起来等价原语义「核心判重兜底 + 面板映射固定文案」，行为判定不放宽。');
    return finish(c);
  }
}];
