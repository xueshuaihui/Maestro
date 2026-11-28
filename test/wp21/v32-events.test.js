/** T01 · R5/R6/R12：事件规范化、哈希链、审计链与查询过滤。 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  AUDIT_TYPES, ERROR_CODES, EVENT_REF_FIELDS, EVENT_TYPES,
  appendJsonl, canonicalize, createAuditEvent, createEvent, eventHash,
  isAuditable, queryAudit, queryJsonl, readJsonl, verifyAuditChain, verifyChain
} from '../../src/v32/index.js';

const TS = '2026-11-28T00:00:00.000Z';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v32-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, eventsFile: path.join(root, 'events.jsonl'), auditFile: path.join(root, 'audit.jsonl') };
}

function buildChain(types, prefix = 'EVT') {
  const list = [];
  let prevHash = null;
  for (let i = 0; i < types.length; i += 1) {
    const built = createEvent({
      id: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      seq: i + 1, ts: TS, type: types[i], actor: 'T01',
      refs: { workItemId: i % 2 === 0 ? 'WI-001' : null, runId: 'RUN-001' },
      payload: { i }, prevHash
    });
    assert.equal(built.ok, true);
    list.push(built.value);
    prevHash = built.value.hash;
  }
  return list;
}

// ---------------------------------------------------------------------------
// R5 规范化与哈希
// ---------------------------------------------------------------------------

test('R5 canonicalize 对键顺序不敏感，undefined 视作 null', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 2, c: [3, 4] } }), canonicalize({ a: { c: [3, 4], d: 2 }, b: 1 }));
  assert.equal(canonicalize({ a: undefined }), '{"a":null}');
  assert.equal(canonicalize([1, 'x', null]), '[1,"x",null]');
});

test('R5 eventHash 是 sha256 且对 payload 变化敏感', () => {
  const first = buildChain(['role.created'])[0];
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.equal(eventHash(first), first.hash);
  assert.notEqual(eventHash({ ...first, payload: { i: 99 } }), first.hash);
});

test('R12/R5 createEvent 只接受 EVENT_TYPES 中的类型', () => {
  const bad = createEvent({ id: 'EVT-001', seq: 1, ts: TS, type: 'nope.never' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'V32_INVALID_INPUT');
  assert.equal(ERROR_CODES.includes(bad.code), true);
  for (const type of EVENT_TYPES) {
    const built = createEvent({ id: 'EVT-999', seq: 1, ts: TS, type });
    assert.equal(built.ok, true, type);
  }
});

test('R5 createEvent 补齐 refs 全部字段（§1.3.1 共 9 项）并生成 hash', () => {
  const built = createEvent({ id: 'EVT-001', seq: 1, ts: TS, type: 'role.created', refs: { taskId: 'TASK-001' } });
  assert.equal(built.ok, true);
  assert.deepEqual(Object.keys(built.value.refs), [...EVENT_REF_FIELDS]);
  assert.equal(built.value.refs.taskId, 'TASK-001');
  assert.equal(built.value.refs.workItemId, null);
  assert.equal(built.value.prevHash, null);
  assert.equal(built.value.hash, eventHash(built.value));
});

test('R5 verifyChain 接受完整链，识别 seq / prevHash / hash 篡改', () => {
  const chain = buildChain(['role.created', 'work_item.created', 'human.approved']);
  assert.equal(verifyChain(chain).ok, true);

  const badSeq = chain.map((event) => ({ ...event }));
  badSeq[1].seq = 5;
  assert.equal(verifyChain(badSeq).params.reason, 'seq');

  const badPrev = chain.map((event) => ({ ...event }));
  badPrev[1].prevHash = 'deadbeef';
  assert.equal(verifyChain(badPrev).params.reason, 'prevHash');

  const badHash = chain.map((event) => ({ ...event }));
  badHash[2].hash = '0'.repeat(64);
  assert.equal(verifyChain(badHash).params.reason, 'hash');

  const duplicate = [...chain, { ...chain[0], seq: 4, prevHash: chain[2].hash, hash: 'x' }];
  assert.equal(verifyChain(duplicate).params.reason, 'duplicate-id');
});

// ---------------------------------------------------------------------------
// R5 JSONL 读写与过滤
// ---------------------------------------------------------------------------

test('R5 readJsonl 对不存在文件返回空数组，appendJsonl 可往返', (t) => {
  const { eventsFile } = setup(t);
  assert.deepEqual(readJsonl(eventsFile), []);
  const chain = buildChain(['role.created', 'role.updated']);
  appendJsonl(eventsFile, chain);
  assert.deepEqual(readJsonl(eventsFile), chain);
});

test('R5 queryJsonl 按 workItemId / runId / type / limit 过滤截断', () => {
  const chain = buildChain(['human.approved', 'human.rejected', 'human.approved', 'delivery.delivered']);
  assert.equal(queryJsonl(chain, { type: 'human.approved' }).length, 2);
  assert.equal(queryJsonl(chain, { runId: 'RUN-001' }).length, 4);
  assert.equal(queryJsonl(chain, { workItemId: 'WI-001' }).length, 2);
  assert.equal(queryJsonl(chain, { workItemId: 'WI-001', type: 'human.approved' }).length, 2);
  assert.deepEqual(queryJsonl(chain, { limit: 2 }).map((event) => event.id), ['EVT-003', 'EVT-004']);
  assert.equal(queryJsonl(chain, { limit: 0 }).length, 0);
  assert.notEqual(queryJsonl(chain)[0], chain[0], '查询结果应为深拷贝');
});

// ---------------------------------------------------------------------------
// R6 审计链
// ---------------------------------------------------------------------------

test('R6 AUDIT_TYPES 覆盖人工审批 / 异常恢复 / 交付三类', () => {
  const categories = {
    'human.approved': true, 'recovery.succeeded': true, 'recovery.failed': true,
    'delivery.accepted': true, 'delivery.delivered': true
  };
  for (const type of Object.keys(categories)) {
    assert.equal(isAuditable(type), true, type);
    assert.equal(AUDIT_TYPES.includes(type), true, type);
    assert.equal(EVENT_TYPES.includes(type), true, type);
  }
  assert.equal(isAuditable('role.created'), false);
});

test('R6 createAuditEvent 拒绝非审计类型，AUD 链可独立校验', () => {
  const bad = createAuditEvent({ id: 'AUD-001', seq: 1, ts: TS, type: 'role.created' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'V32_INVALID_INPUT');

  const chain = buildChain(['human.approved', 'recovery.succeeded', 'delivery.accepted'], 'AUD');
  assert.equal(verifyAuditChain(chain).ok, true);
  assert.equal(verifyChain(chain, 'EVT').ok, false, '审计链不能被当成事件链校验');
  const tampered = chain.map((event) => ({ ...event }));
  tampered[1].prevHash = null;
  assert.equal(verifyAuditChain(tampered).ok, false);
});

test('R6 审计事件保留 refs 与 payload，queryAudit 可过滤', (t) => {
  const { auditFile } = setup(t);
  const first = createEvent({
    id: 'EVT-001', seq: 1, ts: TS, type: 'human.approved',
    refs: { workItemId: 'WI-001', runId: 'RUN-001' }, payload: { approver: 'ROLE-001' }
  }).value;
  const audit = createAuditEvent({
    id: 'AUD-001', seq: 1, ts: TS, type: first.type, actor: first.actor,
    refs: first.refs, payload: first.payload, prevHash: null
  }).value;
  appendJsonl(auditFile, [audit]);

  const stored = readJsonl(auditFile);
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0].refs, first.refs);
  assert.deepEqual(stored[0].payload, first.payload);
  assert.equal(queryAudit(stored, { type: 'human.approved' }).length, 1);
  assert.equal(queryAudit(stored, { workItemId: 'WI-001' }).length, 1);
  assert.equal(queryAudit(stored, { type: 'delivery.accepted' }).length, 0);
  assert.equal(verifyAuditChain(stored).ok, true);
});
