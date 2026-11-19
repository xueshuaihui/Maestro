/**
 * AC-08 · 有终审路径的高风险节点需等人裁决（mock / 夹具面）。
 * 未裁决：下游不进入执行、实例停在等待；裁决后：下游进入执行、裁决被记录。
 */
import path from 'node:path';

import { freshRoot, writeJson, cleanupRoot } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { validateHighRiskReview, reviewDecision } from '../../src/core/governance.js';
import { reviewGate } from '../../src/core/orchestrator.js';

const ROLES = [
  { id: 'role-release', side_effect: 'high' },
  { id: 'role-normal', side_effect: 'low' },
];
const INSTANCE = 'INST-001';
const NODE = 'T-001';

export async function run() {
  const c = makeCase('AC-08', { scenario: 'approve', title: '有终审路径的高风险节点需等人裁决' });
  c.root = freshRoot('approve-ac08');

  try {
    const workflow = {
      nodes: [
        { id: NODE, type: 'publish', side_effect: 'high', role: 'role-normal' },
        { id: 'T-002', type: 'human', side_effect: 'low' },
      ],
      edges: [{ from: NODE, to: 'T-002' }],
    };
    writeJson(path.join(c.root, 'workflow.json'), workflow);
    evidence(c, 'fixture', 'workflow.json', JSON.stringify(workflow, null, 2));

    const review = validateHighRiskReview({ workflow, roles: ROLES, graph: workflow });
    eq(c, 'Given：高风险节点有人工终审路径（校验通过）', review.ok, true);
    eq(c, 'Given：仍需人工裁决标记', review.needsHumanReview, true);
    eq(c, 'Given：需裁决节点定位', review.nodeIds, [NODE]);

    const executed = new Set();
    const pending = reviewGate({
      governance: { validateHighRiskReview: () => review, reviewDecision: (input) => Object.freeze(input) },
      input: { workflow, roles: ROLES, graph: workflow },
      nodeId: NODE, instanceId: INSTANCE, hasHumanRuling: false,
    });
    evidence(c, 'verify', 'review-pending.json', JSON.stringify(pending.verdict, null, 2));
    if (!pending.verdict?.blocked) executed.add('T-002');
    eq(c, 'Then：未裁决时下游节点未进入执行', [...executed], []);
    eq(c, 'Then：实例停在等待人工状态（HIGH_RISK_REVIEW_PENDING）', pending.verdict?.code, 'HIGH_RISK_REVIEW_PENDING');
    eq(c, '机检：等待判定 reason=awaiting_human_review', pending.verdict?.reason, 'awaiting_human_review');
    eq(c, '机检：等待判定定位到高风险节点', pending.verdict?.nodeIds, [NODE]);

    const awaiting = reviewDecision({
      instanceId: INSTANCE, nodeId: NODE,
      needsHumanReview: true, blocked: true, reason: 'awaiting_human_review',
    });
    evidence(c, 'verify', 'decision-awaiting.json', JSON.stringify(awaiting, null, 2));
    eq(c, 'Then：未裁决判定为可追溯数据副本', awaiting, {
      instanceId: INSTANCE, nodeId: NODE, needsHumanReview: true, blocked: true, reason: 'awaiting_human_review',
    });
    check(c, 'Then：裁决记录冻结不可变', Object.isFrozen(awaiting), 'frozen');

    const approved = reviewDecision({
      instanceId: INSTANCE, nodeId: NODE,
      needsHumanReview: true, blocked: false, reason: 'human_approved',
    });
    const afterRuling = reviewGate({
      governance: { validateHighRiskReview: () => review, reviewDecision: (input) => Object.freeze(input) },
      input: { workflow, roles: ROLES, graph: workflow },
      nodeId: NODE, instanceId: INSTANCE, hasHumanRuling: true,
    });
    if (!afterRuling.verdict?.blocked) executed.add('T-002');
    evidence(c, 'verify', 'decision-approved.json', JSON.stringify(approved, null, 2));
    evidence(c, 'verify', 'review-after-ruling.json', JSON.stringify({
      verdict: afterRuling.verdict, executed: [...executed],
    }, null, 2));
    eq(c, 'Then：裁决后门禁放行 verdict=null', afterRuling.verdict, null);
    eq(c, 'Then：裁决后下游进入执行', [...executed], ['T-002']);
    eq(c, '机检：裁决事件被记录（含节点与结论）', approved.reason, 'human_approved');
    eq(c, '机检：裁决记录含实例/节点', [approved.instanceId, approved.nodeId], [INSTANCE, NODE]);
    eq(c, '架构检查：不新增第三种实例状态（裁决结构无 state 字段）',
      Object.prototype.hasOwnProperty.call(approved, 'state'), false);

    const recordedKeys = Object.keys(approved).sort();
    eq(c, 'Then：裁决记录结构固定（可消费、无 UI 字段）', recordedKeys,
      ['blocked', 'instanceId', 'needsHumanReview', 'nodeId', 'reason']);

    note(c, '以 reviewGate 冻结签名桩模拟运行时停等/放行；裁决走既有 approval/escalation 路径，不新增状态枚举');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      review, pending: pending.verdict, awaiting, approved,
      afterRuling: afterRuling.verdict, executed: [...executed], checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `pending.code=${pending.verdict?.code} downstreamExecuted=0`,
      `afterRuling=${afterRuling.verdict === null ? 'PASS' : 'BLOCKED'} downstreamExecuted=${[...executed].join(',')}`,
      `recordedReason=${approved.reason}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
