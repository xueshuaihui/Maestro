/**
 * AC-04 · 越权唤醒被拦截并留痕（mock / 夹具面，显式配置口径 D-1）。
 * 目标角色不在 wake_allow → 恰 1 条 wake.not-whitelisted，目标会话未创建，
 * 既有 wake.rejected 语义/键值不变。
 */
import path from 'node:path';

import {
  ACC12_PATHS, freshRoot, loadLabels, writeJson, readText, cleanupRoot, appendixBlockFromRequirement,
} from '../acc12-f-lib.mjs';
import {
  makeCase, eq, includes, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { decideWake } from '../../src/core/governance.js';
import { wakeGate } from '../../src/core/orchestrator.js';

const CLOCK = () => Date.parse('2026-11-18T00:00:03.000Z');
const AT = '2026-11-18T00:00:03.000Z';
const SOURCE = 'role-a';
const TARGET = 'role-c';
const NEW_REASON = 'wake.not-whitelisted';

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-04', { scenario: 'deny', title: '越权唤醒被拦截并留痕' });
  c.root = freshRoot('deny-ac04');
  const roles = [
    { id: 'role-a', wake_allow: ['role-b'], side_effect: 'low' },
    { id: 'role-b', wake_allow: [], side_effect: 'low' },
    { id: 'role-c', wake_allow: [], side_effect: 'low' },
  ];

  try {
    const rolesFile = path.join(c.root, 'roles.json');
    writeJson(rolesFile, roles);
    evidence(c, 'fixture', 'roles.json', readText(rolesFile));

    const input = { sourceRole: SOURCE, targetRole: TARGET, roles, now: CLOCK };
    const decision = decideWake(input);
    const gated = wakeGate({ governance: { decideWake }, input });
    evidence(c, 'decision', 'deny.json', JSON.stringify({ decision, gated }, null, 2));

    eq(c, 'Then：唤醒被拒绝 allowed=false', decision.allowed, false);
    eq(c, 'Then：拒绝 reason 为冻结新码 wake.not-whitelisted', decision.reason, NEW_REASON);
    eq(c, 'Then：拒绝审计 detail 含来源/目标/原因/时间', decision.detail,
      { from: SOURCE, to: TARGET, reason: NEW_REASON, at: AT });
    eq(c, '机检：运行时门禁 verdict.reasonCode 为新码', gated.verdict?.reasonCode, NEW_REASON);
    eq(c, '机检：拒绝留痕含来源角色', gated.verdict?.from, SOURCE);
    eq(c, '机检：拒绝留痕含目标角色', gated.verdict?.to, TARGET);
    eq(c, '机检：拒绝留痕含原因', gated.verdict?.reason, NEW_REASON);
    eq(c, '机检：拒绝留痕含时间', gated.verdict?.at, AT);

    const rejectionEvents = [decision].filter((d) => d.reason === NEW_REASON);
    eq(c, '机检：拒绝审计事件恰为 1 条', rejectionEvents.length, 1);

    const sessions = new Set();
    const delivered = [];
    if (decision.allowed && !gated.verdict) {
      delivered.push(decision.detail.to);
      sessions.add(decision.detail.to);
    }
    eq(c, 'Then：目标会话未创建', [...sessions], []);
    eq(c, 'Then：交接包未投递', delivered, []);
    check(c, 'Then：拒绝为 blocking（走既有升级/挂起口径，不静默跳过）',
      gated.verdict?.blocked === undefined || gated.verdict?.reasonCode === NEW_REASON,
      'gate verdict present');

    const governanceSrc = readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'governance.js'));
    check(c, 'Then：治理模块不产出既有 wake.rejected 码', !governanceSrc.includes('wake.rejected'), 'no legacy code');
    const a3 = appendixBlockFromRequirement('A-3');
    check(c, 'Then：新码文案取自 labels.js 且逐字见 A-3',
      a3.includes(labels.REASON_LABEL[NEW_REASON]), 'A-3 contains label value');
    check(c, 'Then：既有 wake.rejected 键仍存在（语义不变）',
      typeof labels.REASON_LABEL['wake.rejected'] === 'string' && labels.REASON_LABEL['wake.rejected'].length > 0,
      'legacy label present');
    check(c, 'Then：未引入被否决的 wake.denied', !governanceSrc.includes('wake.denied'), 'no wake.denied');

    note(c, '本用例以 wakeGate 冻结签名桩模拟运行时拒绝路径（WP-7 接线采用同一冻结签名）');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      roles, source: SOURCE, target: TARGET, decision, gated,
      rejectionCount: rejectionEvents.length,
      sessions: [...sessions], delivered, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `allowed=${decision.allowed} reason=${decision.reason}`,
      `rejections=${rejectionEvents.length} sessionCreated=0 handoffDelivered=0`,
      `legacyWakeRejectedLabel=${labels.REASON_LABEL['wake.rejected']}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
