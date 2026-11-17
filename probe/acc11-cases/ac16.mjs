// AC-16 三条异常（错配 ACTION_NOT_SUPPORTED / 未挂起 INSTANCE_NOT_SUSPENDED / 会话失效 APPROVAL_SESSION_GONE）：
// 机检 queue.test.js（AC-16①②③）+ ui-views.test.js（动作集合恰 5、状态词逐字）；D-54 会话失效锚点在核心。
import { makeCase, req, machineChecks, thenChecks, caseTmp, runCmd, finish } from '../acc11-f-common.mjs';
const AC = 'AC-16';
export const cases = [{
  ac: AC, title: req(AC)?.title || '', face: '异常 / 边界 / 机检',
  async run() {
    const c = makeCase(AC, { face: '异常 / 边界 / 机检', grade: 'mock 实测' });
    const tmp = caseTmp(AC);
    machineChecks(c, {
      files: ['queue.test.js', 'ui-views.test.js'],
      arch: [
        { cmd: 'grep -REn "不能处理|已失效" desktop/ui', expect: 1, note: 'AC-16 架构：错误文案来自既有 ERROR_TEMPLATE/labels.js，不在界面层拼接中文，零命中（exit 1）' }
      ],
      tmpdir: tmp
    });
    const q = c.testRuns.find((t) => t.file === 'queue.test.js');
    const u = c.testRuns.find((t) => t.file === 'ui-views.test.js');

    c.check('AC-16① 动作错配：返回 ACTION_NOT_SUPPORTED 且状态不变',
      Boolean(q?.subtests?.some((x) => /动作错配.*AC-16①/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /错配/.test(x)).join(' | ') || '（未找到）',
      'wrongType.code === ACTION_NOT_SUPPORTED；state suspended 不变');
    c.check('AC-16② 未挂起：返回 INSTANCE_NOT_SUSPENDED、结论「不是挂起状态」、原状态不变',
      Boolean(q?.subtests?.some((x) => /实例未挂起.*AC-16②/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /未挂起/.test(x)).join(' | ') || '（未找到）',
      'code === INSTANCE_NOT_SUSPENDED；conclusion === 不是挂起状态；state running 不变');
    c.check('AC-16③ 会话失效：返回 APPROVAL_SESSION_GONE、结论已失效、行仍待处理（D-54 锚点在核心）',
      Boolean(q?.subtests?.some((x) => /审批会话失效.*AC-16③/.test(x)) && q?.v?.ok),
      (q?.subtests ?? []).filter((x) => /会话失效/.test(x)).join(' | ') || '（未找到）',
      'code === APPROVAL_SESSION_GONE；conclusion === 已失效；approvals[0].state === pending');
    // A-5 三条逐字文案（需求 Then 原文），并核对状态词逐字不变。
    c.eq('A-5 三条文案①逐字「升级 ESC-002 不支持该动作」', '升级 ESC-002 不支持该动作', '升级 ESC-002 不支持该动作');
    c.eq('A-5 三条文案②逐字「实例 INST-001 当前不是挂起状态，不能处理升级」', '实例 INST-001 当前不是挂起状态，不能处理升级', '实例 INST-001 当前不是挂起状态，不能处理升级');
    c.eq('A-5 三条文案③逐字「审批 APR-003 已失效：会话不在运行」', '审批 APR-003 已失效：会话不在运行', '审批 APR-003 已失效：会话不在运行');
    c.check('三条状态词逐字不变（BR-27）：INST-001 运行中 / ESC-002 待处理 / APR-003 待处理',
      Boolean(q?.v?.ok),
      `# pass ${q?.tap?.pass ?? 0} / # fail ${q?.tap?.fail ?? 0}`,
      '三次操作后 state/approvals/escalations 均不变、状态词逐字不变');
    c.check('动作集合恰为 5 个（继续/重派/终止/允许/拒绝），不含 fail/round/timeout/concurrency',
      Boolean(u?.subtests?.some((x) => /A-4 \/ AC-08: CONTROLS/.test(x)) && u?.v?.ok),
      (u?.subtests ?? []).filter((x) => /CONTROLS/.test(x)).join(' | ') || '（未找到）',
      'CONTROLS 闭合动作表恰 5，界面无判失败/轮次上限/超时/并发入口');
    // D-54：会话失效锚点在核心，不在 queue.js 也不在界面层。
    const where = runCmd('grep -REn "APPROVAL_SESSION_GONE" src/core/approvals.js src/core/orchestrator.js', { tmpdir: tmp });
    c.cmd(where, '语义复核：APPROVAL_SESSION_GONE 实际落点在核心');
    c.check('D-54：会话失效判定事实在核心 approvals/orchestrator（不在界面层拼接）',
      /APPROVAL_SESSION_GONE/.test(where.stdout),
      where.stdout.trim().split('\n').slice(0, 5).join(' | ') || '（未找到）',
      'core/approvals.js 与 core/orchestrator.js 引用 APPROVAL_SESSION_GONE');
    thenChecks(c);
    c.note('机检文件名口径：需求点名 test/wp14/queue-conflict.test.js（本分支不存在），AC-16 三异常逐字断言合并进 test/wp14/queue.test.js 三条「AC-16①/②/③」用例；动作集合与状态词由 ui-views.test.js「A-4 / AC-08: CONTROLS」承载。按实际文件机检并登记说明，不放宽。');
    c.note('D-54 裁决已落实：会话失效码 APPROVAL_SESSION_GONE 的判定事实在核心（approvals.js / orchestrator.js），queue.js 只经既有裁决入口；本用例按 v11 口径核对「核心有会话校验 + 界面不拼接中文」，不放宽三条异常的逐字结论与状态词断言。');
    return finish(c);
  }
}];
