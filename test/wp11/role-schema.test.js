import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTIFACT_TYPES,
  CONCURRENCY_MAX,
  CONCURRENCY_MIN,
  GROUPS,
  ROLE_ID_MAX,
  ROLE_ID_MIN,
  ROLE_ID_PATTERN,
  ROLE_OPTIONAL_KEYS,
  ROLE_REQUIRED_KEYS,
  ROLE_SCHEMA_VERSION,
  SIDE_EFFECTS,
  SKILL_OPTIONAL_KEYS,
  SKILL_REQUIRED_KEYS,
  SKILL_SCHEMA_VERSION,
  checkRoleShape,
  checkSkillMeta
} from '../../src/registry/role-schema.js';

const ROLE = () => ({
  schema: ROLE_SCHEMA_VERSION,
  id: 'developer',
  name: '开发',
  group: 'coding',
  summary: '按任务修改代码',
  artifact_type: 'code',
  side_effect: 'write',
  skills: ['code-change'],
  max_concurrent_sessions: 1
});

const SKILL = () => ({
  schema: SKILL_SCHEMA_VERSION,
  id: 'code-change',
  name: '代码修改',
  summary: '最小改动',
  applies_to: ['coding']
});

test('exposes the closed value sets in the documented order', () => {
  assert.deepEqual([...GROUPS], ['coordinator', 'research', 'writing', 'coding', 'ops']);
  assert.deepEqual([...ARTIFACT_TYPES], ['code', 'document', 'dataset', 'report']);
  assert.deepEqual([...SIDE_EFFECTS], ['none', 'read', 'write', 'exec']);
});

test('freezes every exported value set', () => {
  for (const list of [GROUPS, ARTIFACT_TYPES, SIDE_EFFECTS, ROLE_REQUIRED_KEYS, ROLE_OPTIONAL_KEYS, SKILL_REQUIRED_KEYS, SKILL_OPTIONAL_KEYS]) {
    assert.equal(Object.isFrozen(list), true);
  }
});

test('declares nine required role keys and five optional ones', () => {
  assert.equal(ROLE_REQUIRED_KEYS.length, 9);
  assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools', 'wake_allow', 'inputs', 'outputs', 'dispatchable']);
});

test('declares the id pattern and its length window', () => {
  assert.equal(ROLE_ID_MIN, 2);
  assert.equal(ROLE_ID_MAX, 32);
  assert.equal(ROLE_ID_PATTERN.test('worker'), true);
  assert.equal(ROLE_ID_PATTERN.test('Worker'), false);
  assert.equal(ROLE_ID_PATTERN.test('2worker'), false);
});

test('declares the concurrency window as 1..5', () => {
  assert.equal(CONCURRENCY_MIN, 1);
  assert.equal(CONCURRENCY_MAX, 5);
});

test('accepts a fully valid role with no errors', () => {
  assert.deepEqual(checkRoleShape(ROLE(), { fileId: 'developer' }), []);
});

test('accepts a role without any optional key', () => {
  assert.deepEqual(checkRoleShape(ROLE()), []);
});

test('reports exactly one error when max_concurrent_sessions is missing', () => {
  const role = ROLE();
  delete role.max_concurrent_sessions;
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0], {
    code: 'ROLE_SCHEMA_MISSING',
    field: 'max_concurrent_sessions',
    params: { field: 'max_concurrent_sessions' }
  });
});

test('reports exactly one error when skills is missing', () => {
  const role = ROLE();
  delete role.skills;
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'ROLE_SCHEMA_MISSING');
  assert.equal(errors[0].field, 'skills');
});

test('lists every missing required key in declaration order', () => {
  const errors = checkRoleShape({ schema: ROLE_SCHEMA_VERSION }, {});
  assert.equal(errors.length, 8);
  assert.deepEqual(
    errors.map((item) => item.field),
    ['id', 'name', 'group', 'summary', 'artifact_type', 'side_effect', 'skills', 'max_concurrent_sessions']
  );
});

test('rejects a wrong schema version through the schema code', () => {
  const role = { ...ROLE(), schema: 'role/v2' };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'ROLE_SCHEMA_MISSING');
  assert.equal(errors[0].field, 'schema');
});

test('rejects an id that differs from the file name', () => {
  const errors = checkRoleShape(ROLE(), { fileId: 'dev' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'ROLE_ID_MISMATCH');
  assert.deepEqual(errors[0].params, { fileId: 'dev', declaredId: 'developer' });
});

test('rejects an id with an illegal character', () => {
  const role = { ...ROLE(), id: 'Dev_01' };
  const errors = checkRoleShape(role, { fileId: 'Dev_01' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'ROLE_ID_MISMATCH');
});

test('rejects an id shorter than the minimum length', () => {
  const role = { ...ROLE(), id: 'a' };
  const errors = checkRoleShape(role, { fileId: 'a' });
  assert.equal(errors[0].code, 'ROLE_ID_MISMATCH');
});

test('rejects an id longer than the maximum length', () => {
  const role = { ...ROLE(), id: 'a'.repeat(33) };
  const errors = checkRoleShape(role, { fileId: 'a'.repeat(33) });
  assert.equal(errors[0].code, 'ROLE_ID_MISMATCH');
});

test('rejects an unknown group and keeps the raw value', () => {
  const role = { ...ROLE(), group: 'marketing' };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors[0].code, 'ROLE_GROUP_INVALID');
  assert.deepEqual(errors[0].params, { value: 'marketing' });
});

test('rejects an unknown artifact type', () => {
  const role = { ...ROLE(), artifact_type: 'video' };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors[0].code, 'ROLE_ARTIFACT_TYPE_INVALID');
  assert.deepEqual(errors[0].params, { value: 'video' });
});

test('rejects an unknown side effect', () => {
  const role = { ...ROLE(), side_effect: 'network' };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors[0].code, 'ROLE_SIDE_EFFECT_INVALID');
});

test('rejects a concurrency value outside 1..5', () => {
  for (const value of [0, 6, -1]) {
    const role = { ...ROLE(), max_concurrent_sessions: value };
    const errors = checkRoleShape(role, { fileId: 'developer' });
    assert.equal(errors[0].code, 'ROLE_MAX_CONCURRENT_INVALID');
    assert.deepEqual(errors[0].params, { value });
  }
});

test('rejects a non-integer concurrency value', () => {
  for (const value of [1.5, '2', null]) {
    const role = { ...ROLE(), max_concurrent_sessions: value };
    const errors = checkRoleShape(role, { fileId: 'developer' });
    assert.equal(errors[0].code, 'ROLE_MAX_CONCURRENT_INVALID');
  }
});

test('rejects skills that are not a string array', () => {
  for (const value of ['code-change', 1, [1, 2]]) {
    const role = { ...ROLE(), skills: value };
    const errors = checkRoleShape(role, { fileId: 'developer' });
    assert.equal(errors[0].code, 'ROLE_SCHEMA_MISSING');
    assert.equal(errors[0].field, 'skills');
  }
});

test('rejects a non-string name or summary', () => {
  const role = { ...ROLE(), name: 42, summary: null };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.deepEqual(
    errors.map((item) => [item.code, item.field]),
    [
      ['ROLE_SCHEMA_MISSING', 'name'],
      ['ROLE_SCHEMA_MISSING', 'summary']
    ]
  );
});

test('rejects a non-boolean dispatchable', () => {
  const role = { ...ROLE(), dispatchable: 'yes' };
  const errors = checkRoleShape(role, { fileId: 'developer' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].field, 'dispatchable');
});

test('accepts every optional key when well typed', () => {
  const role = {
    ...ROLE(),
    tools: ['read', 'write'],
    wake_allow: ['tester'],
    inputs: ['task.md'],
    outputs: ['patch.diff'],
    dispatchable: false
  };
  assert.deepEqual(checkRoleShape(role, { fileId: 'developer' }), []);
});

test('orders field errors the way D-3 requires', () => {
  const role = {
    schema: ROLE_SCHEMA_VERSION,
    id: 'Dev_01',
    name: '开发',
    group: 'marketing',
    summary: 'x',
    artifact_type: 'video',
    side_effect: 'network',
    skills: [],
    max_concurrent_sessions: 9
  };
  const errors = checkRoleShape(role, { fileId: 'dev' });
  assert.deepEqual(
    errors.map((item) => item.code),
    [
      'ROLE_ID_MISMATCH',
      'ROLE_GROUP_INVALID',
      'ROLE_ARTIFACT_TYPE_INVALID',
      'ROLE_SIDE_EFFECT_INVALID',
      'ROLE_MAX_CONCURRENT_INVALID'
    ]
  );
});

test('treats a non-object role payload as missing schema', () => {
  const errors = checkRoleShape(null, { fileId: 'x' });
  assert.equal(errors[0].code, 'ROLE_SCHEMA_MISSING');
});

test('accepts a fully valid skill metadata block', () => {
  assert.deepEqual(checkSkillMeta(SKILL(), { dirId: 'code-change' }), []);
});

test('accepts a skill without optional keys', () => {
  const skill = SKILL();
  delete skill.applies_to;
  assert.deepEqual(checkSkillMeta(skill, { dirId: 'code-change' }), []);
});

test('reports a missing summary for a skill', () => {
  const skill = SKILL();
  delete skill.summary;
  const errors = checkSkillMeta(skill, { dirId: 'code-change' });
  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0], {
    code: 'SKILL_SCHEMA_MISSING',
    field: 'summary',
    params: { field: 'summary' }
  });
});

test('reports a skill id that differs from the directory name', () => {
  const skill = { ...SKILL(), id: 'quoting' };
  const errors = checkSkillMeta(skill, { dirId: 'quote' });
  assert.equal(errors[0].code, 'SKILL_ID_MISMATCH');
  assert.deepEqual(errors[0].params, { dirId: 'quote', declaredId: 'quoting' });
});

test('reports both skill defects of the AC-14 fixture in order', () => {
  const skill = { schema: SKILL_SCHEMA_VERSION, id: 'quoting', name: '引文' };
  const errors = checkSkillMeta(skill, { dirId: 'quote' });
  assert.deepEqual(
    errors.map((item) => item.code),
    ['SKILL_SCHEMA_MISSING', 'SKILL_ID_MISMATCH']
  );
  assert.equal(errors[0].field, 'summary');
});

test('rejects an applies_to value outside the group set', () => {
  const skill = { ...SKILL(), applies_to: ['marketing'] };
  const errors = checkSkillMeta(skill, { dirId: 'code-change' });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'SKILL_GROUP_INVALID');
  assert.deepEqual(errors[0].params, { value: 'marketing' });
});

test('accepts several valid applies_to values', () => {
  const skill = { ...SKILL(), applies_to: ['coding', 'ops'] };
  assert.deepEqual(checkSkillMeta(skill, { dirId: 'code-change' }), []);
});

test('rejects a wrong skill schema version', () => {
  const skill = { ...SKILL(), schema: 'skill/v2' };
  const errors = checkSkillMeta(skill, { dirId: 'code-change' });
  assert.equal(errors[0].code, 'SKILL_SCHEMA_MISSING');
  assert.equal(errors[0].field, 'schema');
});

test('rejects commands that are not a string array', () => {
  const skill = { ...SKILL(), commands: 'node --test' };
  const errors = checkSkillMeta(skill, { dirId: 'code-change' });
  assert.equal(errors[0].code, 'SKILL_SCHEMA_MISSING');
  assert.equal(errors[0].field, 'commands');
});

test('reports every required skill key when metadata is empty', () => {
  const errors = checkSkillMeta({}, { dirId: 'x' });
  assert.deepEqual(
    errors.map((item) => item.field),
    ['schema', 'id', 'name', 'summary']
  );
});
