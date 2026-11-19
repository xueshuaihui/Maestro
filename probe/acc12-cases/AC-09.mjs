/**
 * AC-09 · 审计粒度：节点与交接包状态变更进主审计（mock / 夹具面）。
 * 主审计含 node / handoff.* / health / suspend / halt；逐条命中白名单。
 */
import path from 'node:path';

import { freshRoot, writeJson, cleanupRoot } from '../acc12-f-lib.mjs';
import {
  makeCase, eq, check, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { isPrimaryAuditEvent } from '../../src/core/governance.js';

const EVENTS = [
  { object: 'run', objectId: 'RUN-1', result: 'applied', reason: 'run.started' },
  { object: 'node', objectId: 'T-001', from: 'ready', to: 'running', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-001', from: null, to: 'created', reason: 'handoff.created' },
  { object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', reason: 'handoff.delivered' },
  { object: 'health', objectId: 'H-1', reason: 'health.changed' },
  { object: 'instance', objectId: 'INST-1', reason: 'core.suspend' },
  { object: 'run', objectId: 'RUN-1', reason: 'run.halted' },
  { object: 'connection', objectId: 'C-1', reason: 'aggregate.changed' },
  { object: 'role_instance', objectId: 'R-1', reason: 'state.change' },
  { object: 'session', objectId: 'S-1', reason: 'state' },
];

export async function run() {
  const c = makeCase('AC-09', { scenario: 'granularity', title: '节点与交接包状态变更进主审计' });
  c.root = freshRoot('granularity-ac09');

  try {
    const file = path.join(c.root, 'events.jsonl');
    writeJson(file, EVENTS);
    evidence(c, 'fixture', 'events.jsonl', EVENTS.map((e) => JSON.stringify(e)).join('\n') + '\n');

    for (const [name, event] of [
      ['node.state.change', { object: 'node', reason: 'state.change' }],
      ['handoff.created', { object: 'handoff', reason: 'handoff.created' }],
      ['handoff.delivered', { object: 'handoff', reason: 'handoff.delivered' }],
      ['health.changed', { object: 'health', reason: 'health.changed' }],
      ['core.suspend', { object: 'instance', reason: 'core.suspend' }],
      ['run.halted', { type: 'run.halted' }],
    ]) {
      eq(c, `Then：主审计白名单命中 ${name}`, isPrimaryAuditEvent(event), true);
    }
    for (const state of ['created', 'delivered', 'accepted', 'consumed', 'rejected', 'expired']) {
      eq(c, `Then：交接包状态变更 handoff.${state} 进主审计`,
        isPrimaryAuditEvent({ object: 'handoff', reason: `handoff.${state}` }), true);
    }

    const primary = EVENTS.filter(isPrimaryAuditEvent);
    const types = primary.map((e) => (e.object === 'node' ? `${e.object}.${e.reason}` : e.reason));
    evidence(c, 'verify', 'primary-audit.json', JSON.stringify(primary, null, 2));
    evidence(c, 'verify', 'types.json', JSON.stringify(types, null, 2));

    eq(c, '机检：主审计类型集合含 node/handoff/health（逐条）', types, [
      'node.state.change', 'handoff.created', 'handoff.delivered',
      'health.changed', 'core.suspend', 'run.halted',
    ]);
    check(c, 'Then：健康度档位变化进事件日志（I1.9 BR-15 口径）',
      types.includes('health.changed'), 'health.changed present');
    check(c, 'Then：节点状态变更进主审计',
      primary.some((e) => e.object === 'node' && e.reason === 'state.change'), 'node.state.change present');
    check(c, 'Then：交接包状态变更进主审计',
      primary.filter((e) => e.object === 'handoff').length >= 2, 'handoff events present');

    note(c, '以只含目标条件的事件快照构造主审计（mock/夹具面），未改产品事件总线');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      eventCount: EVENTS.length, primaryCount: primary.length, types, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `events=${EVENTS.length} primary=${primary.length}`,
      `types=${types.join(',')}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
