/** T01 · R3/R4/R5/R6/R9/R10/R11/R12/R13/R14：Store CAS、事件链、审计与并发。 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ERROR_CODES, EVENT_REF_FIELDS, ID_PATTERN, STATE_KEYS,
  createOrgStore, eventHash, publishDefinition, validate
} from '../../src/org/index.js';

const FIXTURE_TIME = '2026-11-28T00:00:00.000Z';
const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

function setup(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'org-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createOrgStore({ root, now: () => FIXTURE_TIME, ...options });
  return { store, root };
}

function addRole(draft, ctx, suffix = '') {
  const role = clone(fixture('org-role'));
  const id = ctx.nextId('role').value;
  role.id = id;
  role.name = `${role.name}${suffix}`;
  draft.roles.push(role);
  return id;
}

// ---------------------------------------------------------------------------
// R3 / R13 初始化与路径约束
// ---------------------------------------------------------------------------

test('R3/R13 空状态结构完整，read() 不创建目录', (t) => {
  const { store, root } = setup(t);
  const snapshot = store.read();
  assert.deepEqual(Object.keys(snapshot), [...STATE_KEYS]);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.rev, 0);
  assert.equal(typeof snapshot.updatedAt, 'string');
  assert.deepEqual(snapshot.sessions, { employees: [], hostBindings: [], attempts: [] });
  assert.deepEqual(snapshot.cliPool.installs, []);
  assert.equal(snapshot.cliPool.scan.mode, null);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
});

test('R13 root 必须是绝对路径', (t) => {
  const { root } = setup(t);
  assert.throws(() => createOrgStore({ root: 'relative/path' }), /absolute path/);
  assert.throws(() => createOrgStore({}), /absolute path/);
  assert.doesNotThrow(() => createOrgStore({ root }));
});

test('R13 首次 transit 才创建 .orch/org 且路径均在临时 root 下', (t) => {
  const { store, root } = setup(t);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  const result = store.transit((draft, ctx) => ({ ok: true, value: addRole(draft, ctx) }), { expectedRev: 0 });
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(root, '.orch', 'org', 'state.json')), true);
  for (const target of Object.values(store.paths)) {
    assert.equal(target.startsWith(root), true, target);
  }
});

// ---------------------------------------------------------------------------
// R4 CAS 与只读访问
// ---------------------------------------------------------------------------

test('R4 成功 transit：rev+1、原子落盘、返回新快照', (t) => {
  const { store, root } = setup(t);
  const result = store.transit((draft, ctx) => ({ ok: true, value: addRole(draft, ctx) }), {
    expectedRev: 0, reason: 'init', actor: 'T01'
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.rev, 1);
  assert.equal(result.value.updatedAt, FIXTURE_TIME);
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'org', 'state.json'), 'utf8'));
  assert.equal(onDisk.rev, 1);
  assert.equal(onDisk.roles.length, 1);
  assert.equal(validate('role', onDisk.roles[0]).ok, true);
});

test('R4 read/get/list 返回深拷贝，外部修改不影响内存状态', (t) => {
  const { store } = setup(t);
  store.transit((draft, ctx) => {
    const id = addRole(draft, ctx);
    draft.teams.push({ ...fixture('org-team'), id: ctx.nextId('team').value });
    return { ok: true, value: id };
  }, { expectedRev: 0 });

  const readBack = store.read();
  readBack.roles[0].name = '外部篡改';
  readBack.roles.push({});
  assert.notEqual(store.get('role', 'ROLE-001').name, '外部篡改');
  assert.equal(store.list('role').length, 1);

  const got = store.get('role', 'ROLE-001');
  got.description = '再次篡改';
  assert.notEqual(store.get('role', 'ROLE-001').description, '再次篡改');
  const listed = store.list('team');
  listed.length = 0;
  assert.equal(store.list('team').length, 1);
  assert.equal(store.get('role', 'ROLE-999'), null);
});

test('R4 expectedRev 不符返回 ORG_REV_CONFLICT，mutator 不执行', (t) => {
  const { store, root } = setup(t);
  let called = false;
  const result = store.transit(() => { called = true; return { ok: true, value: 1 }; }, { expectedRev: 7 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ORG_REV_CONFLICT');
  assert.equal(ERROR_CODES.includes(result.code), true);
  assert.equal(called, false);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  assert.equal(store.read().rev, 0);
});

test('R4 mutator 返回失败不落盘、不改内存；异常也不改内存', (t) => {
  const { store, root } = setup(t);
  const failed = store.transit((draft) => {
    draft.roles.push(fixture('org-role'));
    return { ok: false, code: 'ORG_NO_CANDIDATE', params: { nodeId: 'N-PM' } };
  }, { expectedRev: 0 });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'ORG_NO_CANDIDATE');
  assert.equal(store.read().roles.length, 0);
  assert.equal(store.read().rev, 0);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);

  const thrown = store.transit(() => { throw new Error('boom'); }, { expectedRev: 0 });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.code, 'ORG_INVALID_INPUT');
  assert.equal(store.read().rev, 0);
});

test('R4 连续 transit 基于磁盘最新快照，rev 单调递增', (t) => {
  const { store } = setup(t);
  for (let i = 0; i < 3; i += 1) {
    const result = store.transit((draft, ctx) => ({ ok: true, value: addRole(draft, ctx) }), { expectedRev: i });
    assert.equal(result.ok, true);
    assert.equal(result.value.rev, i + 1);
  }
  assert.equal(store.read().rev, 3);
  assert.deepEqual(store.list('role').map((role) => role.id), ['ROLE-001', 'ROLE-002', 'ROLE-003']);
});

// ---------------------------------------------------------------------------
// R9 ID 生成
// ---------------------------------------------------------------------------

test('R9 nextId 按现有最大序号 +1，同事务多次调用连续递增', (t) => {
  const { store } = setup(t);
  store.transit((draft) => {
    draft.roles.push({ ...fixture('org-role'), id: 'ROLE-001' });
    draft.roles.push({ ...fixture('org-role'), id: 'ROLE-005' });
    draft.roles.push({ ...fixture('org-role'), id: 'ROLE-003' });
    return { ok: true, value: null };
  }, { expectedRev: 0 });

  const result = store.transit((draft, ctx) => {
    const first = ctx.nextId('role');
    const second = store.nextId('role'); // 同一事务内通过 store 访问同一上下文
    const third = ctx.nextId('role');
    return { ok: true, value: [first.value, second.value, third.value] };
  }, { expectedRev: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.mutatorValue, ['ROLE-006', 'ROLE-007', 'ROLE-008']);
  for (const id of result.mutatorValue) assert.equal(ID_PATTERN.test(id), true, id);
});

test('R9 nextId 事务外不可用；重复 ID 返回 ORG_DUPLICATE_ID', (t) => {
  const { store } = setup(t);
  const outside = store.nextId('role');
  assert.equal(outside.ok, false);
  assert.equal(outside.code, 'ORG_INVALID_INPUT');
  assert.equal(store.assertUniqueId('ROLE-001').ok, true);

  store.transit((draft) => {
    draft.roles.push({ ...fixture('org-role'), id: 'ROLE-001' });
    return { ok: true, value: null };
  }, { expectedRev: 0 });
  const duplicate = store.assertUniqueId('ROLE-001');
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'ORG_DUPLICATE_ID');
  assert.equal(ERROR_CODES.includes(duplicate.code), true);
});

// ---------------------------------------------------------------------------
// R10 / R11 / R14 领域辅助在 transit 内可用
// ---------------------------------------------------------------------------

test('R10 transit 内非法迁移返回 ORG_ILLEGAL_TRANSITION 且不落盘', (t) => {
  const { store, root } = setup(t);
  const result = store.transit((draft, ctx) => {
    const check = ctx.assertTransition('workItem', 'cancelled', 'running');
    assert.equal(check.ok, false);
    return check;
  }, { expectedRev: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ORG_ILLEGAL_TRANSITION');
  assert.equal(store.read().rev, 0);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);

  const legal = store.transit((draft, ctx) => ({ ok: true, value: ctx.assertTransition('workItem', 'draft', 'configured').ok }), { expectedRev: 0 });
  assert.equal(legal.ok, true);
  assert.equal(legal.mutatorValue, true);
});

test('R10 已有对象直改 status 也强制走迁移表，非法迁移不落盘', (t) => {
  const { store } = setup(t);
  store.transit((draft, ctx) => {
    draft.workItems.push({ ...fixture('org-work-item'), id: ctx.nextId('workItem').value });
    return { ok: true, value: null };
  }, { expectedRev: 0 });

  const illegal = store.transit((draft) => {
    draft.workItems[0].status = 'running';
    return { ok: true, value: null };
  }, { expectedRev: 1 });
  assert.equal(illegal.ok, false);
  assert.equal(illegal.code, 'ORG_ILLEGAL_TRANSITION');
  assert.equal(store.get('workItem', 'WI-001').status, 'draft');
  assert.equal(store.read().rev, 1);

  const legal = store.transit((draft) => {
    draft.workItems[0].status = 'configured';
    return { ok: true, value: null };
  }, { expectedRev: 1 });
  assert.equal(legal.ok, true);
  assert.equal(store.get('workItem', 'WI-001').status, 'configured');
});

test('R11 snapshot 深拷贝隔离，读取快照不污染状态', (t) => {
  const { store } = setup(t);
  store.transit((draft, ctx) => {
    draft.workflows.push({ ...fixture('org-workflow'), id: ctx.nextId('workflow').value });
    return { ok: true, value: null };
  }, { expectedRev: 0 });

  const snap = store.snapshot('workflow', 'WF-001', '1.0');
  assert.deepEqual(snap.snapshotOf, { kind: 'workflow', id: 'WF-001', version: '1.0' });
  assert.equal(typeof snap.capturedAt, 'string');
  snap.definition.nodes[0].name = '篡改快照定义';
  assert.notEqual(store.get('workflow', 'WF-001').nodes[0].name, '篡改快照定义');

  const storeItem = store.get('workflow', 'WF-001');
  storeItem.nodes[0].name = '篡改读取结果';
  assert.notEqual(store.get('workflow', 'WF-001').nodes[0].name, '篡改读取结果');
  assert.equal(store.snapshot('workflow', 'WF-999', '1.0').code, 'ORG_NOT_FOUND');
});

test('R14 publishDefinition 可在 transit 内复用，versions append-only', (t) => {
  const { store } = setup(t);
  store.transit((draft, ctx) => {
    draft.roles.push({ ...fixture('org-role'), id: ctx.nextId('role').value });
    return { ok: true, value: null };
  }, { expectedRev: 0 });

  const result = store.transit((draft) => {
    const published = publishDefinition(draft.roles[0], FIXTURE_TIME);
    if (!published.ok) return published;
    draft.roles[0] = published.value;
    return { ok: true, value: published.value.version };
  }, { expectedRev: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.mutatorValue, '1.1');
  assert.deepEqual(store.get('role', 'ROLE-001').versions.map((v) => v.version), ['1.0', '1.1']);
});

// ---------------------------------------------------------------------------
// R5 / R6 / R12 事件与审计
// ---------------------------------------------------------------------------

test('R5 事件链：EVT-### 单调 seq、prevHash 指向上一条、hash 可重算', (t) => {
  const { store } = setup(t);
  for (let i = 0; i < 2; i += 1) {
    const result = store.transit((draft, ctx) => ({
      ok: true, value: addRole(draft, ctx),
      events: [{ type: 'role.created', refs: { workItemId: 'WI-001' }, payload: { i } }]
    }), { expectedRev: i, actor: 'T01' });
    assert.equal(result.ok, true);
  }
  const list = store.events();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((event) => event.id), ['EVT-001', 'EVT-002']);
  assert.deepEqual(list.map((event) => event.seq), [1, 2]);
  assert.equal(list[0].prevHash, null);
  assert.equal(list[1].prevHash, list[0].hash);
  assert.equal(list[0].ts, FIXTURE_TIME);
  assert.equal(list[0].actor, 'T01');
  for (const event of list) {
    assert.equal(eventHash(event), event.hash);
    assert.deepEqual(Object.keys(event.refs), [...EVENT_REF_FIELDS]);
  }
  assert.equal(store.verifyChain().ok, true);
});

test('R5 refs 字段齐全（§1.3.1 共 9 项），缺失一律为 null，不省略', (t) => {
  const { store } = setup(t);
  store.transit(() => ({ ok: true, value: null, events: [{ type: 'cli.scan.started', refs: {}, payload: {} }] }), { expectedRev: 0 });
  const event = store.events()[0];
  assert.deepEqual(Object.keys(event.refs), [...EVENT_REF_FIELDS]);
  for (const field of EVENT_REF_FIELDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(event.refs, field), field);
    assert.equal(event.refs[field], null, field);
  }
});

test('R5 verifyChain 能识别被篡改的 hash', (t) => {
  const { store, root } = setup(t);
  store.transit(() => ({ ok: true, value: null, events: [{ type: 'role.created', payload: {} }] }), { expectedRev: 0 });
  const file = path.join(root, '.orch', 'org', 'events.jsonl');
  const events = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  events.hash = '0'.repeat(64);
  fs.writeFileSync(file, `${JSON.stringify(events)}\n`, 'utf8');
  const result = store.verifyChain();
  assert.equal(result.ok, false);
  assert.equal(result.params.chain, 'events');
  assert.equal(result.params.reason, 'hash');
});

test('R6 人工审批 / 异常恢复 / 交付验收三类事件自动写审计', (t) => {
  const { store } = setup(t);
  const types = ['human.approved', 'recovery.succeeded', 'delivery.accepted', 'role.created'];
  store.transit(() => ({
    ok: true, value: null, events: types.map((type) => ({ type, payload: {} }))
  }), { expectedRev: 0 });

  const events = store.events();
  const audit = store.audit();
  assert.equal(events.length, 4);
  assert.equal(audit.length, 3);
  assert.deepEqual(audit.map((event) => event.type), ['human.approved', 'recovery.succeeded', 'delivery.accepted']);
  assert.deepEqual(audit.map((event) => event.id), ['AUD-001', 'AUD-002', 'AUD-003']);
  assert.equal(audit[0].prevHash, null);
  assert.equal(audit[1].prevHash, audit[0].hash);
  assert.equal(audit[2].prevHash, audit[1].hash);
  assert.equal(store.verifyChain().ok, true);
});

test('R5 events/audit 过滤与 limit 截断', (t) => {
  const { store } = setup(t);
  store.transit(() => ({
    ok: true, value: null,
    events: [
      { type: 'human.approved', refs: { workItemId: 'WI-001', runId: 'RUN-001' }, payload: {} },
      { type: 'human.approved', refs: { workItemId: 'WI-002', runId: 'RUN-002' }, payload: {} },
      { type: 'delivery.delivered', refs: { workItemId: 'WI-001', runId: 'RUN-001' }, payload: {} }
    ]
  }), { expectedRev: 0 });

  assert.equal(store.events({ type: 'human.approved' }).length, 2);
  assert.equal(store.events({ workItemId: 'WI-001' }).length, 2);
  assert.equal(store.events({ runId: 'RUN-002' }).length, 1);
  assert.equal(store.events({ workItemId: 'WI-001', type: 'human.approved' }).length, 1);
  assert.equal(store.events({ limit: 2 }).length, 2);
  assert.deepEqual(store.events({ limit: 1 }).map((event) => event.id), ['EVT-003']);
  assert.equal(store.events({ limit: 0 }).length, 0);
  assert.equal(store.audit({ type: 'delivery.delivered' }).length, 1);
  assert.equal(store.audit({ type: 'role.created' }).length, 0);
});

test('R12 未知事件类型返回 ORG_INVALID_INPUT 且不落盘', (t) => {
  const { store, root } = setup(t);
  const result = store.transit(() => ({
    ok: true, value: null, events: [{ type: 'totally.unknown', payload: {} }]
  }), { expectedRev: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ORG_INVALID_INPUT');
  assert.equal(store.read().rev, 0);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
});

test('R4 sink 在事件落盘后广播，且广播异常不影响已提交状态', (t) => {
  const seen = [];
  let root = null;
  let store = null;
  const sink = (event) => {
    const onDisk = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'org', 'events.jsonl'), 'utf8').trim());
    seen.push({ event, onDiskId: onDisk.id });
    throw new Error('sink failure');
  };
  ({ store, root } = setup(t, { sink }));
  const result = store.transit(() => ({
    ok: true, value: null, events: [{ type: 'role.created', payload: {} }]
  }), { expectedRev: 0 });
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].event.id, seen[0].onDiskId);
  assert.equal(store.events().length, 1);
  assert.equal(store.read().rev, 1);
});

// ---------------------------------------------------------------------------
// 并发与隔离
// ---------------------------------------------------------------------------

test('并发 transit：同一 expectedRev 只有一个成功，失败者不改文件', async (t) => {
  const { store, root } = setup(t);
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => Promise.resolve().then(() =>
    store.transit((draft, ctx) => {
      const id = ctx.nextId('role');
      draft.roles.push({ ...fixture('org-role'), id: id.value, name: `并发-${i}` });
      return { ok: true, value: id.value };
    }, { expectedRev: 0 })
  )));
  const succeeded = results.filter((result) => result.ok);
  const conflicts = results.filter((result) => result.code === 'ORG_REV_CONFLICT');
  assert.equal(succeeded.length, 1);
  assert.equal(conflicts.length, 19);
  assert.equal(store.read().rev, 1);
  assert.equal(store.read().roles.length, 1);
  assert.equal(new Set(store.read().roles.map((role) => role.id)).size, 1);
  assert.equal(store.events().length, 0);
  assert.equal(fs.existsSync(path.join(root, '.orch', 'org', 'state.json')), true);
});

test('并发 nextId 不重号：逐次提交后序号连续且唯一', (t) => {
  const { store } = setup(t);
  const ids = [];
  for (let i = 0; i < 12; i += 1) {
    const result = store.transit((draft, ctx) => {
      const id = ctx.nextId('employee').value;
      draft.employees.push({ ...fixture('org-employee'), id });
      return { ok: true, value: id };
    }, { expectedRev: i });
    assert.equal(result.ok, true);
    ids.push(result.mutatorValue);
  }
  assert.equal(new Set(ids).size, 12);
  assert.deepEqual(ids, Array.from({ length: 12 }, (_, i) => `EMP-${String(i + 1).padStart(3, '0')}`));
});
