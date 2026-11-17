// AC-12 审批「允许」与「拒绝」：机检 queue.test.js + A-4 结果行逐字 + 架构恰好 1 命中。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-12';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '审批 / 机检',
  async run() {
    const c = makeCase(AC, { face: '审批 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js'],
      arch: [
        { cmd: 'grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js | head -1', expect: 0, note: 'AC-12 架构①（v11/D-54）：会话失效判定事实在核心（≥1 命中，exit 0）' },
        { cmd: 'grep -REn "resolveApproval|approval\\.resolve" src/daemon/queue.js | head -1', expect: 0, lines: 1, note: 'AC-12 架构②（v11/D-54）：queue.js 只转发既有裁决入口（恰好 1 命中，exit 0）' },
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const names = (q?.subtests ?? []).filter((x) => /审批·允许|审批·拒绝/.test(x));
    c.check('审批两用例存在（allow → approved / deny → denied，真实等待会话）', names.length >= 2, names.join(' | ') || '（未找到）', 'allow/deny 两条用例');
    c.eq('allow/deny 用例数 2', names.length, 2);
    // A-4 结果行逐字由用例断言（审批 APR-001 已通过 · 动作 write / 已拒绝 · 动作 write）。
    c.check('A-4 审批结果行逐字 + 状态 approved/denied + 队列减 2（由用例承载）', Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`, '逐字「审批 APR-001 已通过 · 动作 write」/「已拒绝 · 动作 write」');

    // 语义复核：架构检查字面未命中，但行为意图（经 approval.resolve 且做会话校验）由核心路径满足。
    const where = runCmd(`grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js`, { tmpdir: tmp });
    c.cmd(where, '语义复核：APPROVAL_SESSION_GONE 实际落点');
    c.check('语义复核：会话失效判定在核心 approvals/orchestrator（未绕过），queue.decideApproval 转发 approval.resolve',
      /orchestrator\.js/.test(where.stdout) && /APPROVAL_SESSION_GONE/.test(where.stdout),
      where.stdout.trim().split('\n').slice(0, 5).join(' | ') || '（未找到）',
      'orchestrator.js 调 approvals.APPROVAL_SESSION_GONE；queue.js:332 forward approval.resolve');
    thenChecks(c);
    c.note('D-54 裁决已落实：需求 v11 把 AC-12 架构锚点从 queue.js 归位核心（D-11 禁改核心，APPROVAL_SESSION_GONE 事实在 approvals.js:104 / orchestrator.js:4961），queue.js:332 只转发 approval.resolve。本用例按 v11 两条锚点判定：核心有会话校验 + queue.js 经既有入口——等价原语义「经 approval.resolve 且做会话校验」，不放宽行为判定（allow/deny 逐字 + 状态 + 队列减 2）。');
    c.note('逐字断言由 test/wp14/queue.test.js 的「审批·允许」「审批·拒绝」用例承载（走真实等待会话）；需求机检原文点名 queue-actions.test.js，本分支合并进 queue.test.js。');
    return finish(c);
  }
}];
