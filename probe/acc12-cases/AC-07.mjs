/**
 * AC-07 · 高风险缺人工终审被挡下（mock / 夹具面）。
 * 缺终审 → verify review 非 0 + A-5 逐字 + 节点定位；补齐 human → 校验通过退出 0。
 */
import path from 'node:path';

import { ACC12_PATHS, freshRoot, writeJson, readText, cleanupRoot, loadLabels, appendixBlockFromRequirement } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, includes, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { validateHighRiskReview } from '../../src/core/governance.js';
import { reviewGate } from '../../src/core/orchestrator.js';
import { verifyCommand } from '../../src/cli/verify.js';

const ROLES = [
  { id: 'role-release', side_effect: 'high' },
  { id: 'role-normal', side_effect: 'low' },
];

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-07', { scenario: 'risk', title: '高风险缺人工终审被挡下' });
  c.root = freshRoot('risk-ac07');

  try {
    const missing = {
      nodes: [
        { id: 'T-001', type: 'publish', side_effect: 'high', role: 'role-normal' },
        { id: 'T-002', type: 'code', side_effect: 'low' },
      ],
      edges: [{ from: 'T-001', to: 'T-002' }],
    };
    const filled = {
      nodes: [
        { id: 'T-001', type: 'publish', side_effect: 'high', role: 'role-normal' },
        { id: 'T-002', type: 'human', side_effect: 'low' },
        { id: 'T-003', type: 'code', side_effect: 'low' },
      ],
      edges: [{ from: 'T-001', to: 'T-002' }, { from: 'T-002', to: 'T-003' }],
    };
    writeJson(path.join(c.root, 'workflow-missing.json'), missing);
    writeJson(path.join(c.root, 'workflow-filled.json'), filled);
    evidence(c, 'fixture', 'workflow-missing.json', JSON.stringify(missing, null, 2));
    evidence(c, 'fixture', 'workflow-filled.json', JSON.stringify(filled, null, 2));

    const reviewMissing = validateHighRiskReview({ workflow: missing, roles: ROLES, graph: missing });
    const reviewFilled = validateHighRiskReview({ workflow: filled, roles: ROLES, graph: filled });
    evidence(c, 'verify', 'review-missing.json', JSON.stringify(reviewMissing, null, 2));
    evidence(c, 'verify', 'review-filled.json', JSON.stringify(reviewFilled, null, 2));

    eq(c, 'Then：缺终审校验不通过 ok=false', reviewMissing.ok, false);
    eq(c, 'Then：缺终审 blocked=true', reviewMissing.blocked, true);
    eq(c, 'Then：缺终审 reason=missing_human_gate', reviewMissing.reason, 'missing_human_gate');
    eq(c, '机检：提示含高风险节点定位 nodeIds=[T-001]', reviewMissing.nodeIds, ['T-001']);
    eq(c, 'Then：补齐 human 后校验通过 ok=true', reviewFilled.ok, true);
    eq(c, 'Then：补齐后 blocked=false', reviewFilled.blocked, false);
    eq(c, 'Then：补齐后 reason=null', reviewFilled.reason, null);
    eq(c, '机检：补齐后仍标记 needsHumanReview=true', reviewFilled.needsHumanReview, true);

    const linesMissing = [];
    const linesFilled = [];
    const exitMissing = await verifyCommand(
      { sub: 'review', positionals: ['workflow-missing'], flags: {} },
      { deps: { workflow: missing, roles: ROLES, graph: missing }, out: (line) => linesMissing.push(line) },
    );
    const exitFilled = await verifyCommand(
      { sub: 'review', positionals: ['workflow-filled'], flags: {} },
      { deps: { workflow: filled, roles: ROLES, graph: filled }, out: (line) => linesFilled.push(line) },
    );
    evidence(c, 'verify', 'review-cli.stdout.txt', [
      `--- missing (exit=${exitMissing}) ---`, ...linesMissing,
      `--- filled (exit=${exitFilled}) ---`, ...linesFilled,
    ].join('\n'));

    includes(c, 'Then：verify review 缺终审输出 A-5 逐字（取自 labels）',
      linesMissing[0] || '', labels.HIGH_RISK_MISSING_REVIEW);
    check(c, 'Then：verify review 缺终审退出码非 0', exitMissing !== 0, `exit=${exitMissing}`);
    eq(c, 'Then：verify review 补齐后输出取自 labels', linesFilled[0] || '', labels.VERIFY_REVIEW_PASSED);
    eq(c, 'Then：verify review 补齐后退出码 0', exitFilled, 0);

    const a5 = appendixBlockFromRequirement('A-5');
    check(c, 'Then：A-5 文案逐字见 requirement.md 附录（取自 labels）',
      a5.includes(labels.HIGH_RISK_MISSING_REVIEW),
      'A-5 carries frozen label literal');

    const blockedGate = reviewGate({
      governance: { validateHighRiskReview: () => reviewMissing, reviewDecision: (input) => Object.freeze(input) },
      input: { workflow: missing, roles: ROLES, graph: missing },
      nodeId: 'T-001', instanceId: 'INST-001',
    });
    evidence(c, 'verify', 'start-blocked.json', JSON.stringify(blockedGate.verdict, null, 2));
    eq(c, 'Then：尝试启动被挡 HIGH_RISK_REVIEW_BLOCKED', blockedGate.verdict?.code, 'HIGH_RISK_REVIEW_BLOCKED');
    eq(c, 'Then：启动被挡判定含节点定位', blockedGate.verdict?.nodeIds, ['T-001']);

    const govSrc = readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'governance.js'));
    check(c, '架构检查：治理规则不含 UI 文案字面量', !/[\u4e00-\u9fff]/.test(govSrc), 'no CJK in governance');

    note(c, 'verify review 以冻结签名桩注入工作流对象（WP-7 wiring 采用同一路径），CLI 输出按 A-5 冻结文案');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      reviewMissing, reviewFilled, exitMissing, exitFilled,
      linesMissing, linesFilled, blockedGate: blockedGate.verdict, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `missing.exit=${exitMissing} blocked=${blockedGate.verdict?.code}`,
      `filled.exit=${exitFilled} needsHumanReview=${reviewFilled.needsHumanReview}`,
      `nodeLocation=${JSON.stringify(reviewMissing.nodeIds)}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
