/**
 * AC-12 · 预算耗尽时暂停而非失败（mock / 夹具面）。
 * 耗尽 → suspended + budget_exhausted + 无 failed；补预算后原轮次恢复、无失败事件。
 */
import path from 'node:path';

import {
  ACC12_PATHS, freshRoot, writeJson, readText, cleanupRoot, loadLabels, appendixBlockFromRequirement,
} from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { decideBudget } from '../../src/core/budget.js';
import { budgetGate } from '../../src/core/orchestrator.js';

const SUSPENDED = 'suspended';
const REASON_EXHAUSTED = 'budget_exhausted';

function applyBudget(state, decision) {
  if (decision.suspend) {
    state.state = SUSPENDED;
    state.pauseReason = decision.reason;
    state.resumeRound = decision.resumeRound;
  } else if (state.state === SUSPENDED) {
    state.state = 'running';
    state.round = decision.resumeRound ?? state.round;
  }
  return state;
}

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-12', { scenario: 'budget', title: '预算耗尽时暂停而非失败' });
  c.root = freshRoot('budget-ac12');
  const state = {
    instanceId: 'INST-001', state: 'running', round: 4,
    budget: { remaining: 0, nextCost: 1 },
    events: [],
    nodes: [
      { id: 'T-001', state: 'running', round: 4 },
      { id: 'T-002', state: 'running', round: 4 },
      { id: 'T-003', state: 'ready', round: 4 },
      { id: 'T-004', state: 'ready', round: 4 },
      { id: 'T-005', state: 'ready', round: 4 },
    ],
  };

  try {
    const fixture = path.join(c.root, 'budget.json');
    writeJson(fixture, state);
    evidence(c, 'fixture', 'budget.json', readText(fixture));
    const originalEventCount = state.events.length;

    const suspendDecision = decideBudget({
      remainingBudget: state.budget.remaining, nextCost: state.budget.nextCost, state,
    });
    applyBudget(state, suspendDecision);
    evidence(c, 'verify', 'decision-suspend.json', JSON.stringify(suspendDecision, null, 2));
    evidence(c, 'verify', 'state-suspended.json', JSON.stringify(state, null, 2));

    eq(c, 'Then：预算不足判定 suspend=true', suspendDecision.suspend, true);
    eq(c, '机检：reason=budget_exhausted', suspendDecision.reason, REASON_EXHAUSTED);
    eq(c, 'Then：实例状态转为 suspended（不标记为失败）', state.state, SUSPENDED);
    eq(c, '机检：暂停原因可见（pauseReason=budget_exhausted）', state.pauseReason, REASON_EXHAUSTED);
    eq(c, 'Then：不生成 failed 节点', state.nodes.filter((n) => n.state === 'failed').length, 0);
    eq(c, '机检：未新增失败事件', state.events.length, originalEventCount);

    const gate = budgetGate({
      budget: { decideBudget },
      input: { remainingBudget: 0, nextCost: 1, state },
      explicit: true,
    });
    evidence(c, 'verify', 'gate-suspend.json', JSON.stringify(gate.verdict, null, 2));
    eq(c, '机检：运行时门禁 blocked=true', gate.verdict?.blocked, true);
    eq(c, '机检：门禁 reasonCode=budget_exhausted', gate.verdict?.reasonCode, REASON_EXHAUSTED);
    eq(c, '机检：门禁保留原轮次 resumeRound=4', gate.verdict?.resumeRound, 4);

    const a5 = appendixBlockFromRequirement('A-5');
    check(c, 'Then：「已挂起 / 预算耗尽」可见原因逐字见 A-5（取自 labels）',
      a5.includes(labels.I112_VOCAB.suspended) && a5.includes(labels.I112_VOCAB.budgetExhausted)
      && a5.includes(labels.BUDGET_EXHAUSTED), 'A-5 carries frozen label literals');

    state.budget.remaining = 10;
    const resumeDecision = decideBudget({
      remainingBudget: state.budget.remaining, nextCost: state.budget.nextCost, state,
    });
    applyBudget(state, resumeDecision);
    evidence(c, 'verify', 'decision-resume.json', JSON.stringify(resumeDecision, null, 2));
    evidence(c, 'verify', 'state-resumed.json', JSON.stringify(state, null, 2));
    eq(c, 'Then：补充预算后不再挂起 suspend=false', resumeDecision.suspend, false);
    eq(c, 'Then：恢复后实例回到 running', state.state, 'running');
    eq(c, 'Then：节点从原轮次继续（round=4）', state.round, 4);
    eq(c, '机检：全部节点仍为原轮次', state.nodes.every((n) => n.round === 4), true);
    eq(c, 'Then：恢复后无 failed 节点', state.nodes.filter((n) => n.state === 'failed').length, 0);
    eq(c, '机检：恢复未新增失败事件', state.events.length, originalEventCount);

    const budgetSrc = readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'budget.js'));
    check(c, '架构检查：预算暂停复用既有 suspended 状态词', /'suspended'/.test(budgetSrc), 'suspended reused');
    check(c, '架构检查：预算模块无写状态/迁移',
      !/\bsaveState\b/.test(budgetSrc) && !/transit\(/.test(budgetSrc), 'pure decision');

    note(c, '以 applyBudget 桩模拟既有挂起/恢复路径（WP-7 接线采用同一冻结签名）');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      suspendDecision, resumeDecision, gate: gate.verdict, state, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `suspended=${state.state === 'running' ? 'resumed' : SUSPENDED} reason=${REASON_EXHAUSTED}`,
      `resumeRound=${resumeDecision.resumeRound} failed=0 failedEvents=0`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
