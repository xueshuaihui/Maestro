/** T01 · R1/R2/R10/R11/R14：常量、对象契约、迁移表、快照与版本辅助。 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ASSIGNMENT_STATUS, ASSET_STATUS, AUDIT_TYPES, ERROR_CODES, EVENT_TYPES,
  ID_PATTERN, ID_PREFIX, NODE_TYPES, TASK_STATUS, TRANSITIONS, V32_AUDIT_FILE,
  V32_EVENTS_FILE, V32_SCHEMA_VERSION, V32_STATE_FILE, WORK_ITEM_STATUS,
  assertTransition, bumpVersion, canTransition, cloneSnapshot, fail,
  makeSnapshot, publishDefinition, snapshotId, validate
} from '../../src/v32/index.js';

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

// ---------------------------------------------------------------------------
// R1 常量与状态枚举
// ---------------------------------------------------------------------------

test('R1 WorkItem/Task/Assignment 状态枚举与规格 §13 逐字相等', () => {
  assert.deepEqual(WORK_ITEM_STATUS, [
    'draft', 'configured', 'ready_to_run', 'running', 'waiting_human', 'blocked',
    'ready_for_acceptance', 'accepted', 'delivered', 'cancelled'
  ]);
  assert.deepEqual(TASK_STATUS, [
    'waiting_dependency', 'ready', 'assignment_prepared', 'preflight', 'creating_session', 'running',
    'succeeded', 'interrupted', 'blocked', 'failed', 'cancelled', 'skipped'
  ]);
  assert.deepEqual(ASSIGNMENT_STATUS, [
    'draft', 'prepared', 'preflight', 'locked', 'released', 'failed'
  ]);
  assert.equal(WORK_ITEM_STATUS.length, 10);
  assert.equal(TASK_STATUS.length, 12);
  assert.equal(ASSIGNMENT_STATUS.length, 6);
});

test('R1 反向断言：原型状态不得混入规格枚举', () => {
  for (const list of [WORK_ITEM_STATUS, TASK_STATUS, ASSIGNMENT_STATUS]) {
    assert.equal(list.includes('waiting_queue'), false);
    assert.equal(list.includes('human_waiting'), false);
  }
  assert.equal(ASSIGNMENT_STATUS.includes('cancelled'), false);
  assert.equal(WORK_ITEM_STATUS.includes('queued'), false);
});

test('R1 ID 前缀、资产状态、节点类型与文件路径常量齐全', () => {
  assert.deepEqual(ID_PREFIX, {
    role: 'ROLE', employee: 'EMP', team: 'TEAM', workflow: 'WF', workItem: 'WI',
    run: 'RUN', task: 'TASK', assignment: 'ASSIGN', employeeSession: 'ES',
    hostBinding: 'HB', attempt: 'ATT', artifact: 'ART', event: 'EVT', audit: 'AUD'
  });
  assert.deepEqual(ASSET_STATUS, ['draft', 'published', 'deprecated']);
  assert.deepEqual(NODE_TYPES, ['agent', 'human']);
  assert.equal(V32_SCHEMA_VERSION, 1);
  assert.equal(V32_STATE_FILE, '.orch/v32/state.json');
  assert.equal(V32_EVENTS_FILE, '.orch/v32/events.jsonl');
  assert.equal(V32_AUDIT_FILE, '.orch/v32/audit.jsonl');
});

test('R1/R12 事件类型与审计类型全集覆盖三类审计操作', () => {
  for (const type of ['human.approved', 'recovery.succeeded', 'recovery.failed', 'delivery.accepted', 'delivery.delivered']) {
    assert.equal(AUDIT_TYPES.includes(type), true, type);
    assert.equal(EVENT_TYPES.includes(type), true, type);
  }
  assert.equal(EVENT_TYPES.includes('work_item.created'), true);
  assert.equal(EVENT_TYPES.includes('session.created'), true);
  assert.equal(AUDIT_TYPES.includes('assignment.locked'), true);
});

// ---------------------------------------------------------------------------
// R2 对象契约
// ---------------------------------------------------------------------------

test('R2 七类夹具全部通过 validate()', () => {
  const kinds = {
    role: 'v32-role', employee: 'v32-employee', team: 'v32-team',
    workflow: 'v32-workflow', workItem: 'v32-work-item', run: 'v32-run', assignment: 'v32-assignment'
  };
  for (const [kind, name] of Object.entries(kinds)) {
    const result = validate(kind, fixture(name));
    assert.equal(result.ok, true, `${kind}: ${JSON.stringify(result)}`);
  }
});

test('R2 Employee 禁止 cliId / 单一 roleId / teamId / sessionId', () => {
  const base = fixture('v32-employee');
  for (const field of ['cliId', 'roleId', 'teamId', 'sessionId', 'cliInstallationId', 'hostSessionId']) {
    const obj = clone(base);
    obj[field] = 'X';
    const result = validate('employee', obj);
    assert.equal(result.ok, false, field);
    assert.equal(result.code, 'V32_FORBIDDEN_FIELD', field);
  }
});

test('R2 Team / Workflow / Role 禁止跨对象归属字段', () => {
  const cases = [
    ['team', 'v32-team', 'workflowId'],
    ['team', 'v32-team', 'sessionId'],
    ['workflow', 'v32-workflow', 'employeeId'],
    ['workflow', 'v32-workflow', 'teamId'],
    ['workflow', 'v32-workflow', 'cliId'],
    ['role', 'v32-role', 'employeeId'],
    ['role', 'v32-role', 'teamId'],
    ['role', 'v32-role', 'cliId']
  ];
  for (const [kind, name, field] of cases) {
    const obj = clone(fixture(name));
    obj[field] = 'X';
    const result = validate(kind, obj);
    assert.equal(result.ok, false, `${kind}.${field}`);
    assert.equal(result.code, 'V32_FORBIDDEN_FIELD', `${kind}.${field}`);
  }
});

test('R2 Agent/Human 节点禁止执行人、CLI、Session 字段', () => {
  const workflow = clone(fixture('v32-workflow'));
  const agent = workflow.nodes.find((node) => node.type === 'agent');
  const human = workflow.nodes.find((node) => node.type === 'human');
  assert.ok(agent && human);

  for (const field of ['employeeId', 'cliId', 'cliInstallationId']) {
    const bad = clone(agent);
    bad[field] = 'X';
    assert.equal(validate('node', bad).code, 'V32_FORBIDDEN_FIELD', `agent.${field}`);
  }
  for (const field of ['employeeId', 'executor', 'assignee', 'cliId', 'sessionId', 'employeeSessionId']) {
    const bad = clone(human);
    bad[field] = 'X';
    assert.equal(validate('node', bad).code, 'V32_FORBIDDEN_FIELD', `human.${field}`);
  }
  const badApprover = clone(human);
  badApprover.human.approver = 'EMP-001';
  assert.equal(validate('node', badApprover).code, 'V32_FORBIDDEN_FIELD');
});

test('R2 缺失必需字段返回 V32_INVALID_INPUT', () => {
  const base = clone(fixture('v32-role'));
  delete base.requires;
  const result = validate('role', base);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'V32_INVALID_INPUT');
  assert.equal(result.params.field, 'requires');

  assert.equal(validate('employee', null).code, 'V32_INVALID_INPUT');
  assert.equal(validate('unknownKind', {}).code, 'V32_INVALID_INPUT');
});

test('R2 状态字段只接受各自枚举内的值', () => {
  const workItem = clone(fixture('v32-work-item'));
  workItem.status = 'waiting_queue';
  assert.equal(validate('workItem', workItem).code, 'V32_INVALID_INPUT');

  const assignment = clone(fixture('v32-assignment'));
  assignment.status = 'cancelled';
  assert.equal(validate('assignment', assignment).code, 'V32_INVALID_INPUT');

  const team = clone(fixture('v32-team'));
  team.status = 'archived';
  assert.equal(validate('team', team).code, 'V32_INVALID_INPUT');
});

// ---------------------------------------------------------------------------
// R10 迁移表
// ---------------------------------------------------------------------------

test('R10 五张迁移表与 §1.3.1 完全一致', () => {
  assert.deepEqual(TRANSITIONS.workItem, {
    draft: ['configured', 'cancelled'],
    configured: ['ready_to_run', 'cancelled'],
    ready_to_run: ['running', 'cancelled'],
    running: ['waiting_human', 'blocked', 'ready_for_acceptance', 'cancelled'],
    waiting_human: ['running', 'ready_for_acceptance', 'cancelled'],
    blocked: ['running', 'ready_for_acceptance', 'cancelled'],
    ready_for_acceptance: ['accepted', 'cancelled'],
    accepted: ['delivered'],
    delivered: [],
    cancelled: []
  });
  assert.deepEqual(TRANSITIONS.task, {
    waiting_dependency: ['ready', 'skipped', 'cancelled'],
    ready: ['assignment_prepared', 'blocked', 'cancelled'],
    assignment_prepared: ['preflight', 'blocked', 'cancelled'],
    preflight: ['creating_session', 'failed', 'assignment_prepared'],
    creating_session: ['running', 'failed', 'interrupted'],
    running: ['succeeded', 'interrupted', 'blocked', 'failed', 'cancelled'],
    interrupted: ['preflight', 'running', 'cancelled'],
    blocked: ['ready', 'failed', 'cancelled'],
    failed: ['ready', 'cancelled'],
    succeeded: [], cancelled: [], skipped: []
  });
  assert.deepEqual(TRANSITIONS.assignment, {
    draft: ['prepared'], prepared: ['preflight'],
    preflight: ['locked', 'failed', 'prepared'],
    locked: ['released', 'failed'], released: [], failed: ['draft', 'prepared']
  });
  assert.deepEqual(TRANSITIONS.team, { draft: ['published'], published: ['deprecated'], deprecated: [] });
  assert.deepEqual(TRANSITIONS.workflow, { draft: ['published'], published: ['deprecated'], deprecated: [] });
  assert.equal(TRANSITIONS.assignment.cancelled, undefined);
  assert.equal(TRANSITIONS.workItem.waiting_queue, undefined);
});

test('R10 canTransition / assertTransition 合法与非法', () => {
  assert.equal(canTransition('workItem', 'draft', 'configured'), true);
  assert.equal(canTransition('workItem', 'delivered', 'accepted'), false);
  assert.equal(canTransition('task', 'ready', 'assignment_prepared'), true);
  assert.equal(canTransition('task', 'ready', 'running'), false);
  assert.equal(canTransition('assignment', 'locked', 'released'), true);
  assert.equal(canTransition('assignment', 'draft', 'cancelled'), false);
  assert.equal(canTransition('team', 'draft', 'published'), true);
  assert.equal(canTransition('team', 'draft', 'deprecated'), false);
  assert.equal(canTransition('workflow', 'published', 'deprecated'), true);

  const legal = assertTransition('workItem', 'configured', 'ready_to_run');
  assert.equal(legal.ok, true);
  const illegal = assertTransition('workItem', 'cancelled', 'running');
  assert.equal(illegal.ok, false);
  assert.equal(illegal.code, 'V32_ILLEGAL_TRANSITION');
  assert.equal(ERROR_CODES.includes(illegal.code), true);
});

test('R10 错误码只能取 ERROR_CODES 全集', () => {
  assert.equal(ERROR_CODES.includes('V32_FORBIDDEN_FIELD'), true);
  assert.equal(ERROR_CODES.includes('V32_SNAPSHOT_MISMATCH'), true);
  assert.throws(() => fail('V32_MADE_UP'), /Unknown V32 error code/);
});

// ---------------------------------------------------------------------------
// R11 快照
// ---------------------------------------------------------------------------

test('R11 makeSnapshot 结构与定义深拷贝隔离', () => {
  const definition = clone(fixture('v32-workflow'));
  const snapshot = makeSnapshot('workflow', 'WF-SNAPSHOT-WI-001', '1.0', definition, '2026-11-28T00:00:00.000Z');
  assert.deepEqual(snapshot.snapshotOf, { kind: 'workflow', id: 'WF-SNAPSHOT-WI-001', version: '1.0' });
  assert.equal(snapshot.capturedAt, '2026-11-28T00:00:00.000Z');

  definition.nodes[0].name = '被外部修改';
  assert.notEqual(snapshot.definition.nodes[0].name, '被外部修改');
  const readBack = cloneSnapshot(snapshot);
  readBack.definition.nodes[0].name = '再次修改';
  assert.notEqual(snapshot.definition.nodes[0].name, '再次修改');
});

test('R9 snapshotId 生成仅用于本次需求的快照 ID', () => {
  const workflowSnapshot = snapshotId('workflow', 'WI-001');
  const teamSnapshot = snapshotId('team', 'WI-001');
  assert.equal(workflowSnapshot, 'WF-SNAPSHOT-WI-001');
  assert.equal(teamSnapshot, 'TEAM-SNAPSHOT-WI-001');
  assert.equal(ID_PATTERN.test(workflowSnapshot), true);
  assert.equal(ID_PATTERN.test(teamSnapshot), true);
});

// ---------------------------------------------------------------------------
// R14 版本辅助
// ---------------------------------------------------------------------------

test('R14 资产版本 major.minor：首次 1.0，每次 publish minor +1', () => {
  assert.equal(bumpVersion('1.0'), '1.1');
  assert.equal(bumpVersion('2.9'), '2.10');
  assert.equal(bumpVersion('bad'), null);

  const role = clone(fixture('v32-role'));
  const result = publishDefinition(role, '2026-11-28T01:00:00.000Z');
  assert.equal(result.ok, true);
  assert.equal(result.value.version, '1.1');
  assert.equal(role.version, '1.0', '入参不得被修改');
  assert.equal(role.versions.length, 1);
  assert.equal(result.value.versions.length, 2);
  assert.equal(result.value.versions[0].version, '1.0');
  assert.equal(result.value.versions[1].version, '1.1');
});

test('R14 同版本重复发布返回 V32_DUPLICATE_VERSION', () => {
  const role = clone(fixture('v32-role'));
  role.versions.push({ version: '1.1', publishedAt: '2026-11-28T01:00:00.000Z' });
  const result = publishDefinition(role, '2026-11-28T02:00:00.000Z');
  assert.equal(result.ok, false);
  assert.equal(result.code, 'V32_DUPLICATE_VERSION');
  assert.equal(result.params.version, '1.1');
  assert.equal(ERROR_CODES.includes(result.code), true);
});

// ---------------------------------------------------------------------------
// 防假绿：glob 必须命中三组测试且声明用例数达基线
// ---------------------------------------------------------------------------

test('wp21 防假绿：glob 文件与声明用例数达基线', () => {
  const dir = new URL('.', import.meta.url);
  const files = fs.readdirSync(dir).filter((name) => /^v32-.*\.test\.js$/.test(name));
  assert.ok(files.length >= 3, `glob 命中 ${files.length} 个测试文件`);
  let declared = 0;
  for (const name of files) {
    const text = fs.readFileSync(new URL(name, dir), 'utf8');
    declared += (text.match(/^test\(/gm) || []).length;
  }
  assert.ok(declared >= 30, `声明用例数 ${declared} 应 >= 基线 30`);
});
