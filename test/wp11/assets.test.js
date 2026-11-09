/**
 * Built-in asset tests (WP-3).
 *
 * The expected values are copied from requirement appendix A-1 row by row. This is
 * the data-side twin of AC-17 / AC-18: the command output is verified by the S3
 * acceptance harness and by `cli-role.test.js`, but the table itself must already be
 * right here, or neither of those can pass.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry } from '../../src/registry/index.js';
import { ROLE_LABEL } from '../../src/cli/labels.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TEST_DIR, '..', '..');
const ASSETS = path.join(REPO, 'assets');

/** Requirement A-1, in table order: group order, then id inside a group. */
const EXPECTED = [
  // id, name, group, artifactType, sideEffect, skills, maxConcurrentSessions
  ['arbiter', '裁决者', 'coordinator', 'report', 'none', ['coordination'], 1],
  ['coordinator', '协调者', 'coordinator', 'report', 'none', ['coordination'], 1],
  ['planner', '规划者', 'coordinator', 'report', 'read', ['coordination', 'research-brief'], 1],
  ['summarizer', '汇总者', 'coordinator', 'report', 'read', ['coordination'], 2],
  ['worker', '执行者', 'coordinator', 'document', 'write', [], 1],
  ['data-analyst', '数据分析师', 'research', 'dataset', 'write', ['data-analysis', 'fact-check'], 2],
  ['fact-checker', '事实核查员', 'research', 'report', 'read', ['fact-check'], 1],
  ['researcher', '研究员', 'research', 'report', 'write', ['research-brief'], 1],
  ['editor', '编辑', 'writing', 'document', 'write', ['doc-draft', 'doc-review'], 1],
  ['reviewer', '审核者', 'writing', 'document', 'read', ['doc-review'], 1],
  ['writer', '撰写者', 'writing', 'document', 'write', ['doc-draft'], 2],
  ['code-reviewer', '代码审查', 'coding', 'code', 'read', ['code-review'], 1],
  ['developer', '开发', 'coding', 'code', 'write', ['code-change', 'test-run'], 1],
  ['tester', '测试', 'coding', 'code', 'exec', ['test-run'], 1],
  ['compliance-reviewer', '合规审查者', 'ops', 'report', 'read', ['compliance-check'], 1],
  ['requirement-clarifier', '需求澄清者', 'ops', 'document', 'write', ['doc-draft', 'coordination'], 1]
];

const EXPECTED_SKILLS = [
  'research-brief',
  'fact-check',
  'data-analysis',
  'doc-draft',
  'doc-review',
  'code-change',
  'test-run',
  'code-review',
  'coordination',
  'compliance-check'
];

function cleanProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-assets-'));
}

function registry() {
  const root = cleanProject();
  try {
    return loadRegistry({ root });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('AC-12: the whole built-in tree validates with the six-key asset counts', () => {
  const result = registry();

  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, {
    assets: 26,
    roles: 16,
    skills: 10,
    builtin: 26,
    project: 0,
    invalid: 0
  });
  assert.equal(result.counts.assets, result.counts.roles + result.counts.skills + result.counts.invalid);
});

test('AC-17: five groups hold 5 / 3 / 3 / 3 / 2 roles, each group at least two', () => {
  const result = registry();

  assert.deepEqual(
    result.groups.map((item) => [item.group, item.count]),
    [
      ['coordinator', 5],
      ['research', 3],
      ['writing', 3],
      ['coding', 3],
      ['ops', 2]
    ]
  );
  for (const item of result.groups) {
    assert.ok(item.count >= 2, `${item.group} must hold at least two roles`);
  }
  assert.equal(result.groups.reduce((sum, item) => sum + item.count, 0), 16);
});

test('A-1: the sixteen roles match the table row by row, in table order', () => {
  const result = registry();

  assert.deepEqual(
    result.roles.map((role) => role.id),
    EXPECTED.map((row) => row[0])
  );

  for (const [index, row] of EXPECTED.entries()) {
    const [id, name, group, artifactType, sideEffect, skills, maxConcurrentSessions] = row;
    const role = result.roles[index];
    assert.deepEqual(
      {
        id: role.id,
        name: role.name,
        group: role.group,
        artifactType: role.artifactType,
        sideEffect: role.sideEffect,
        skills: role.skills,
        maxConcurrentSessions: role.maxConcurrentSessions
      },
      { id, name, group, artifactType, sideEffect, skills, maxConcurrentSessions },
      `row ${id}`
    );
    assert.equal(role.source, 'builtin');
    assert.equal(role.file, `assets/roles/${id}.yaml`);
    assert.equal(role.dispatchable, true);
  }
});

test('AC-18: the six template role names match ROLE_LABEL verbatim', () => {
  const result = registry();

  for (const [id, label] of Object.entries(ROLE_LABEL)) {
    const role = result.roleMap.get(id);
    assert.ok(role, `ROLE_LABEL id ${id} must exist in the built-in table`);
    assert.equal(role.name, label, `${id} name must equal ROLE_LABEL`);
  }
  // The six template roles plus `worker` are all present (AC-18 second half).
  for (const id of ['developer', 'tester', 'coordinator', 'researcher', 'writer', 'reviewer', 'worker']) {
    assert.ok(result.roleMap.has(id), `${id} must be in the built-in table`);
  }
  assert.equal(Object.keys(ROLE_LABEL).length, 6);
});

test('worker is the only role without skills', () => {
  const result = registry();

  assert.deepEqual(result.roleMap.get('worker').skills, []);
  const withoutSkills = result.roles.filter((role) => role.skills.length === 0).map((role) => role.id);
  assert.deepEqual(withoutSkills, ['worker']);
});

test('ten skills are present, each with at least three working steps', () => {
  const result = registry();

  // D-4 orders skills by id; the A-1 list above is a set, not a sequence.
  assert.deepEqual(result.skills.map((skill) => skill.id), [...EXPECTED_SKILLS].sort());
  assert.equal(result.counts.skills, 10);

  for (const skill of result.skills) {
    const file = path.join(ASSETS, 'skills', skill.id, 'SKILL.md');
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /### 工作方法/, `${skill.id} needs a 工作方法 section`);
    const steps = text.split('\n').filter((line) => /^\d+\.\s+\S/.test(line));
    assert.ok(steps.length >= 3, `${skill.id} needs at least three steps, got ${steps.length}`);
    assert.equal(skill.body.trim().length > 0, true);
  }
});

test('every skill is referenced by at least one role', () => {
  const result = registry();

  const referenced = new Set();
  for (const role of result.roles) {
    for (const skillId of role.skills) referenced.add(skillId);
  }
  assert.deepEqual([...referenced].sort(), [...EXPECTED_SKILLS].sort());
  assert.equal(referenced.size, 10);
});

test('A-1: developer.yaml matches the documented sample byte for byte', () => {
  const text = fs.readFileSync(path.join(ASSETS, 'roles', 'developer.yaml'), 'utf8');
  const expected = [
    'schema: role/v1',
    'id: developer',
    'name: 开发',
    'group: coding',
    'summary: 按任务修改代码，交出声明的产物文件',
    'artifact_type: code',
    'side_effect: write',
    'skills:',
    '  - code-change',
    '  - test-run',
    'tools:',
    '  - read',
    '  - write',
    '  - edit',
    '  - bash',
    'wake_allow:',
    '  - tester',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n');

  assert.equal(text, expected);
});

test('A-1: code-change/SKILL.md matches the documented sample byte for byte', () => {
  const text = fs.readFileSync(path.join(ASSETS, 'skills', 'code-change', 'SKILL.md'), 'utf8');
  const expected = [
    '---',
    'schema: skill/v1',
    'id: code-change',
    'name: 代码修改',
    'summary: 定位到要改的文件，做最小改动，并写清改了什么',
    'applies_to: [coding]',
    'commands: ["node --test"]',
    '---',
    '',
    '### 工作方法',
    '',
    '1. 先读任务里「产物：」那一行，确认要改的文件。',
    '2. 只改必要位置，不动无关文件。',
    '3. 改完说明：改了哪个文件、为什么这样改。',
    ''
  ].join('\n');

  assert.equal(text, expected);
});

test('asset directory layout: 16 role files and 10 skill directories, nothing else', () => {
  const roleFiles = fs.readdirSync(path.join(ASSETS, 'roles')).sort();
  assert.deepEqual(roleFiles, EXPECTED.map((row) => `${row[0]}.yaml`).sort());

  const skillDirs = fs.readdirSync(path.join(ASSETS, 'skills')).sort();
  assert.deepEqual(skillDirs, [...EXPECTED_SKILLS].sort());
  for (const dir of skillDirs) {
    assert.deepEqual(fs.readdirSync(path.join(ASSETS, 'skills', dir)), ['SKILL.md']);
  }
});

test('project assets still win over the shipped ones (AC-03 / AC-45 shape)', () => {
  const root = cleanProject();
  try {
    fs.mkdirSync(path.join(root, '.orch', 'skills', 'code-change'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.orch', 'skills', 'code-change', 'SKILL.md'),
      [
        '---',
        'schema: skill/v1',
        'id: code-change',
        'name: 代码修改（项目版）',
        'summary: 项目自己的改码流程',
        'applies_to: [coding]',
        '---',
        '',
        '1. 只改这一处。',
        '2. 改完写说明。',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = loadRegistry({ root });
    assert.equal(result.ok, true);
    assert.equal(result.counts.skills, 10, 'same id does not grow the table');
    assert.equal(result.counts.builtin, 25);
    assert.equal(result.counts.project, 1);
    assert.equal(result.skillMap.get('code-change').source, 'project');
    assert.equal(result.skillMap.get('code-change').name, '代码修改（项目版）');
    // References resolve by id, so the role's skill list is unchanged (AC-45).
    assert.deepEqual(result.roleMap.get('developer').skills, ['code-change', 'test-run']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
