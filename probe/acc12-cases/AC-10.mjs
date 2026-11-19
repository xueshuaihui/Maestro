/**
 * AC-10 · 审计粒度：派生与会话状态不单独审计（mock / 夹具面）。
 * 主审计无 connection/role/session 独立类型；聚合可由交接包状态重算；同一状态只记一次。
 */
import fs from 'node:fs';
import path from 'node:path';

import { ACC12_PATHS, freshRoot, readText, cleanupRoot } from '../acc12-f-lib.mjs';
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
  { object: 'connection', objectId: 'C-1', reason: 'aggregate.changed' },
  { object: 'role_instance', objectId: 'R-1', reason: 'state.change' },
  { object: 'session', objectId: 'S-1', reason: 'state' },
];

function recomputeConnectionAggregate(events) {
  const byHandoff = new Map();
  for (const event of events) {
    if (!isPrimaryAuditEvent(event) || event.object !== 'handoff') continue;
    const row = byHandoff.get(event.objectId) ?? { handoffId: event.objectId, states: [] };
    row.states.push(event.to);
    byHandoff.set(event.objectId, row);
  }
  return [...byHandoff.values()].map((row) => ({
    handoffId: row.handoffId,
    state: row.states[row.states.length - 1],
    transitions: row.states.length,
  }));
}

export async function run() {
  const c = makeCase('AC-10', { scenario: 'granularity', title: '派生与会话状态不单独审计' });
  c.root = freshRoot('granularity-ac10');

  try {
    const file = path.join(c.root, 'events.jsonl');
    fs.writeFileSync(file, EVENTS.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    evidence(c, 'fixture', 'events.jsonl', fs.readFileSync(file, 'utf8'));

    for (const [name, event] of [
      ['connection 聚合', { object: 'connection', reason: 'aggregate.changed' }],
      ['connection 类型', { type: 'connection.aggregate' }],
      ['role_instance 状态', { object: 'role_instance', reason: 'state.change' }],
      ['role 状态', { type: 'role.state.change' }],
      ['session 状态', { object: 'session', reason: 'state' }],
      ['session 类型', { type: 'session.state' }],
    ]) {
      eq(c, `Then：${name}不进主审计（isPrimaryAuditEvent=false）`, isPrimaryAuditEvent(event), false);
    }

    const primary = EVENTS.filter(isPrimaryAuditEvent);
    const types = primary.map((e) => (e.object === 'node' ? `${e.object}.${e.reason}` : e.reason));
    evidence(c, 'verify', 'primary-audit.json', JSON.stringify(primary, null, 2));
    evidence(c, 'verify', 'types.json', JSON.stringify(types, null, 2));
    check(c, '机检：主审计事件类型集合不含 connection 独立审计类型',
      !types.some((t) => t.startsWith('connection')), 'no connection type');
    check(c, '机检：主审计事件类型集合不含 role 独立审计类型',
      !types.some((t) => t.startsWith('role')), 'no role type');
    check(c, '机检：主审计事件类型集合不含 session 独立审计类型',
      !types.some((t) => t.startsWith('session')), 'no session type');
    eq(c, 'Then：主审计仅含白名单类型', types, [
      'node.state.change', 'handoff.created', 'handoff.delivered', 'health.changed', 'core.suspend',
    ]);

    const aggregate = recomputeConnectionAggregate(EVENTS);
    evidence(c, 'verify', 'aggregate-recomputed.json', JSON.stringify(aggregate, null, 2));
    eq(c, '机检：聚合状态可由交接包状态重算一致', aggregate, [
      { handoffId: 'HO-001', state: 'delivered', transitions: 2 },
    ]);
    eq(c, 'Then：聚合状态本身不是主审计事件',
      isPrimaryAuditEvent({ object: 'connection', reason: 'aggregate.changed' }), false);

    const handoffEvents = EVENTS.filter((e) => isPrimaryAuditEvent(e) && e.object === 'handoff');
    const keys = handoffEvents.map((e) => `${e.objectId}:${e.to}`);
    evidence(c, 'verify', 'handoff-state-keys.json', JSON.stringify(keys, null, 2));
    eq(c, 'Then：同一份交接包状态在主审计中只记一次', keys, ['HO-001:created', 'HO-001:delivered']);
    eq(c, '机检：无重复 handoff:state', new Set(keys).size, keys.length);

    const auditSrc = [
      readText(path.join(ACC12_PATHS.REPO, 'src', 'core', 'governance.js')),
    ].join('\n');
    check(c, '架构检查：治理模块不写 connection/role 审计事件',
      !/connection.*emit|role.*audit/i.test(auditSrc), 'no connection emit / role audit');

    note(c, '会话状态只体现在执行日志摘要（夹具未把它标成主审计类型）');
    evidence(c, 'meta', 'result.json', JSON.stringify({
      eventCount: EVENTS.length, primaryCount: primary.length, types, aggregate, keys, checks: c.checks,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `primary=${primary.length} types=${types.join(',')}`,
      `aggregate=${JSON.stringify(aggregate)}`,
      'connection/role/session independent audit = 0',
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
