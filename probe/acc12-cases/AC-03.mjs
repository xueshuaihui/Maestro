/**
 * AC-03 · 白名单内唤醒正常发生（mock / 夹具面，显式配置口径 D-1）。
 * 角色甲 wake_allow 显式包含角色乙 → 投递 + 目标会话创建，拒绝计数 0。
 */
import path from 'node:path';

import {
  ACC12_PATHS, freshRoot, loadLabels, writeJson, readText, cleanupRoot, appendixBlockFromRequirement,
} from '../acc12-f-lib.mjs';
import {
  makeCase, eq, includes, check, verify, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { decideWake } from '../../src/core/governance.js';
import { wakeGate } from '../../src/core/orchestrator.js';

const CLOCK = () => Date.parse('2026-11-18T00:00:03.000Z');
const AT = '2026-11-18T00:00:03.000Z';
const SOURCE = 'role-a';
const TARGET = 'role-b';

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-03', { scenario: 'allow', title: '白名单内唤醒正常发生' });
  c.root = freshRoot('allow-ac03');
  const roles = [
    { id: 'role-a', wake_allow: ['role-b'], side_effect: 'low' },
    { id: 'role-b', wake_allow: [], side_effect: 'low' },
    { id: 'role-c', wake_allow: [], side_effect: 'low' },
  ];

  try {
    const rolesFile = path.join(c.root, 'roles.json');
    writeJson(rolesFile, roles);
    evidence(c, 'fixture', 'roles.json', readText(rolesFile));

    const decision = decideWake({ sourceRole: SOURCE, targetRole: TARGET, roles, now: CLOCK });
    const gated = wakeGate({ governance: { decideWake }, input: { sourceRole: SOURCE, targetRole: TARGET, roles, now: CLOCK } });
    evidence(c, 'decision', 'allow.json', JSON.stringify({ decision, gated }, null, 2));

    eq(c, 'Then：白名单内唤醒判定 allowed=true', decision.allowed, true);
    eq(c, 'Then：allowed 路径 reason=null', decision.reason, null);
    eq(c, 'Then：detail 含来源/目标/原因/时间', decision.detail,
      { from: SOURCE, to: TARGET, reason: null, at: AT });
    eq(c, 'Then：运行时门禁 verdict=null（未被拒绝）', gated.verdict, null);

    const sessions = new Set();
    const delivered = [];
    if (decision.allowed && !gated.verdict) {
      delivered.push(decision.detail.to);
      sessions.add(decision.detail.to);
    }
    eq(c, '机检：交接包状态进入已投递（夹具：delivered）', delivered, [TARGET]);
    eq(c, '机检：目标节点/会话进入执行', [...sessions], [TARGET]);
    eq(c, 'Then：审计里没有越权拒绝记录（拒绝事件计数 0）',
      [decision, gated.decision].filter((d) => d && d.reason === 'wake.not-whitelisted').length, 0);
    check(c, 'Then：allowed 路径不产生新拒绝码',
      decision.reason !== 'wake.not-whitelisted', 'reason is null');

    const governanceSrc = readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'governance.js'));
    includes(c, '架构检查：whitelist/allowWake 命中核心判定模块', governanceSrc, 'wake_allow');
    const a3 = appendixBlockFromRequirement('A-3');
    check(c, 'Then：越权拒绝文案取自 labels.js 且逐字见 requirement.md A-3',
      a3.includes(labels.REASON_LABEL['wake.not-whitelisted']),
      `A-3 contains label value`);

    evidence(c, 'meta', 'result.json', JSON.stringify({
      roles, source: SOURCE, target: TARGET, decision, gated,
      delivered, sessions: [...sessions], checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `allowed=${decision.allowed} rejections=0`,
      `delivered=${delivered.join(',')}`,
      `sessionCreated=${[...sessions].join(',')}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
