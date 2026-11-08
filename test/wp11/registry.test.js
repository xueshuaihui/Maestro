/**
 * Registry loader tests (WP-2).
 *
 * Every fixture below is byte-for-byte the one written in split doc 3.2 / 3.3,
 * because S3 rebuilds the same files from the requirement and the line numbers
 * must match (AC-09 needs `line === 4`).
 *
 * A synthetic built-in root is injected through `builtinRoot`: at the time this
 * package lands the repository has no `assets/` yet (that is WP-3), and relying on
 * its absence would make `REGISTRY_ASSETS_MISSING` flip once the real assets exist.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadRegistry } from '../../src/registry/index.js';
import {
  assetsRoot,
  builtinRolesDir,
  builtinSkillsDir,
  projectRolesDir,
  projectSkillsDir
} from '../../src/registry/assets.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TEST_DIR, '..', '..');
const REGISTRY_DIR = path.join(REPO, 'src', 'registry');

const tempRoots = [];

function makeTemp(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-${label}-`));
  tempRoots.push(root);
  return root;
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function writeAsset(root, relative, content) {
  const abs = path.join(root, relative);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function skillText(id, name, appliesTo) {
  const head = [
    '---',
    'schema: skill/v1',
    `id: ${id}`,
    `name: ${name}`,
    `summary: ${name}的做法`
  ];
  if (appliesTo) head.push(`applies_to: [${appliesTo}]`);
  head.push('---', '', '### 工作方法', '', '1. 按步骤做事。', '');
  return head.join('\n');
}

function roleText({ id, group = 'coding', skills = [], artifact = 'code', side = 'read', max = 1 }) {
  return [
    'schema: role/v1',
    `id: ${id}`,
    `name: ${id}`,
    `group: ${group}`,
    'summary: 说明',
    `artifact_type: ${artifact}`,
    `side_effect: ${side}`,
    `skills: [${skills.join(', ')}]`,
    `max_concurrent_sessions: ${max}`,
    ''
  ].join('\n');
}

/**
 * Built-in fixture: three roles across three groups plus three skills, so the
 * group ordering and the `builtin` / `project` split can both be observed.
 */
function makeBuiltinRoot() {
  const base = makeTemp('builtin');
  const skills = {
    coord: ['coord', '协调', 'coordinator'],
    research: ['research', '研究', 'research'],
    'ops-run': ['ops-run', '运行', 'ops']
  };
  for (const [dir, [id, name, group]] of Object.entries(skills)) {
    writeAsset(base, `skills/${dir}/SKILL.md`, skillText(id, name, group));
  }
  writeAsset(base, 'roles/coord-core.yaml', roleText({ id: 'coord-core', group: 'coordinator', skills: ['coord'] }));
  writeAsset(base, 'roles/research-lead.yaml', roleText({ id: 'research-lead', group: 'research', skills: ['research'], artifact: 'report' }));
  writeAsset(base, 'roles/ops-runner.yaml', roleText({ id: 'ops-runner', group: 'ops', skills: ['ops-run'], side: 'exec' }));
  return base;
}

/**
 * The built-in fixture is immutable, so one copy serves every case: rebuilding the
 * same six files twelve times only adds IO pressure to an already parallel suite.
 */
let sharedBuiltin = null;

function builtinFixture() {
  if (sharedBuiltin === null) sharedBuiltin = makeBuiltinRoot();
  return sharedBuiltin;
}

function makeProject(files) {
  const root = makeTemp('project');
  for (const [relative, content] of Object.entries(files || {})) {
    writeAsset(root, relative, content);
  }
  return root;
}

function load(root, builtinRoot, extra) {
  return loadRegistry({ root, builtinRoot, ...(extra || {}) });
}

function codesOf(registry) {
  return registry.errors.map((item) => item.code);
}

function errorsFor(registry, file) {
  return registry.errors.filter((item) => item.file === file);
}

// ---------------------------------------------------------------------------
// Happy path, counts and ordering
// ---------------------------------------------------------------------------

test('loads a clean tree: six built-in assets, five groups, no errors', () => {
  const builtin = builtinFixture();
  const registry = load(makeProject(), builtin);

  assert.equal(registry.ok, true);
  assert.deepEqual(registry.counts, {
    assets: 6,
    roles: 3,
    skills: 3,
    builtin: 6,
    project: 0,
    invalid: 0
  });
  assert.deepEqual(
    registry.groups.map((item) => item.group),
    ['coordinator', 'research', 'writing', 'coding', 'ops']
  );
  assert.deepEqual(
    registry.groups.map((item) => item.count),
    [1, 1, 0, 0, 1]
  );
  assert.deepEqual(registry.roles.map((role) => role.id), [
    'coord-core',
    'research-lead',
    'ops-runner'
  ]);
  assert.deepEqual(registry.skills.map((skill) => skill.id), ['coord', 'ops-run', 'research']);
});

test('RoleDef carries exactly the thirteen contract keys', () => {
  const builtin = builtinFixture();
  const registry = load(makeProject(), builtin);
  const def = registry.roleMap.get('coord-core');

  assert.deepEqual(Object.keys(def).sort(), [
    'artifactType',
    'dispatchable',
    'file',
    'group',
    'id',
    'maxConcurrentSessions',
    'name',
    'sideEffect',
    'skills',
    'source',
    'summary',
    'tools',
    'wakeAllow'
  ]);
  assert.equal(def.file, 'assets/roles/coord-core.yaml');
  assert.equal(def.source, 'builtin');
  assert.equal(def.dispatchable, true);
  assert.deepEqual(def.tools, []);
  assert.deepEqual(def.wakeAllow, []);
});

test('SkillDef carries the body and the optional arrays as defaults', () => {
  const builtin = builtinFixture();
  const registry = load(makeProject(), builtin);
  const def = registry.skillMap.get('coord');

  assert.equal(def.file, 'assets/skills/coord/SKILL.md');
  assert.deepEqual(def.appliesTo, ['coordinator']);
  assert.deepEqual(def.commands, []);
  assert.match(def.body, /按步骤做事/);
});

test('roles sort by group order then id, not by directory listing order', () => {
  const base = makeTemp('builtin-order');
  writeAsset(base, 'roles/zeta.yaml', roleText({ id: 'zeta', group: 'ops' }));
  writeAsset(base, 'roles/alpha.yaml', roleText({ id: 'alpha', group: 'coding' }));
  writeAsset(base, 'roles/beta.yaml', roleText({ id: 'beta', group: 'coordinator' }));
  writeAsset(base, 'roles/gamma.yaml', roleText({ id: 'gamma', group: 'ops' }));

  const registry = load(makeProject(), base);
  assert.deepEqual(registry.roles.map((role) => role.id), ['beta', 'alpha', 'gamma', 'zeta']);
});

test('a missing project directory is not an error', () => {
  const builtin = builtinFixture();
  const root = makeTemp('empty-project');
  const registry = load(root, builtin);

  assert.equal(registry.ok, true);
  assert.equal(registry.counts.project, 0);
  assert.equal(registry.counts.invalid, 0);
});

// ---------------------------------------------------------------------------
// AC-04 .. AC-09: role assets (split doc 3.2, fixtures are verbatim)
// ---------------------------------------------------------------------------

test('AC-04: missing max_concurrent_sessions yields exactly one ROLE_SCHEMA_MISSING', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/no-concurrency.yaml': [
      'schema: role/v1',
      'id: no-concurrency',
      'name: 没并发',
      'group: coding',
      'summary: 只缺并发上限',
      'artifact_type: code',
      'side_effect: read',
      'skills: []',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.equal(registry.errors.length, 1);
  const [item] = registry.errors;
  assert.equal(item.code, 'ROLE_SCHEMA_MISSING');
  assert.equal(item.field, 'max_concurrent_sessions');
  assert.equal(item.file, 'roles/no-concurrency.yaml');
  assert.equal(item.scope, 'role');
  assert.equal(item.line, null);
  assert.deepEqual(item.params, { field: 'max_concurrent_sessions' });
  assert.equal(registry.counts.invalid, 1);
  assert.equal(registry.counts.assets, 3 + 3 + 1);
});

test('AC-05: file name writer.yaml declaring wordsmith yields ROLE_ID_MISMATCH', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/writer.yaml': [
      'schema: role/v1',
      'id: wordsmith',
      'name: 冒名',
      'group: writing',
      'summary: 文件名与声明 id 不一致',
      'artifact_type: document',
      'side_effect: write',
      'skills: []',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['ROLE_ID_MISMATCH']);
  assert.equal(registry.errors[0].field, 'id');
  assert.deepEqual(registry.errors[0].params, { fileId: 'writer', declaredId: 'wordsmith' });
  assert.equal(registry.errors[0].file, 'roles/writer.yaml');
});

test('AC-06: group outside the five groups yields ROLE_GROUP_INVALID', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/bad-group.yaml': [
      'schema: role/v1',
      'id: bad-group',
      'name: 坏分组',
      'group: marketing',
      'summary: 分组不在五组内',
      'artifact_type: report',
      'side_effect: read',
      'skills: []',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['ROLE_GROUP_INVALID']);
  assert.equal(registry.errors[0].field, 'group');
  assert.deepEqual(registry.errors[0].params, { value: 'marketing' });
});

test('AC-07: artifact_type / side_effect / max_concurrent_sessions each report their own code', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/bad-artifact.yaml': [
      'schema: role/v1',
      'id: bad-artifact',
      'name: 坏产物',
      'group: coding',
      'summary: 产物类型不在四类内',
      'artifact_type: slides',
      'side_effect: read',
      'skills: []',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n'),
    '.orch/roles/bad-side-effect.yaml': [
      'schema: role/v1',
      'id: bad-side-effect',
      'name: 坏副作用',
      'group: coding',
      'summary: 副作用等级不在四级内',
      'artifact_type: code',
      'side_effect: admin',
      'skills: []',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n'),
    '.orch/roles/bad-concurrency.yaml': [
      'schema: role/v1',
      'id: bad-concurrency',
      'name: 坏并发',
      'group: coding',
      'summary: 并发上限超出 1~5',
      'artifact_type: code',
      'side_effect: read',
      'skills: []',
      'max_concurrent_sessions: 9',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), [
    'ROLE_ARTIFACT_TYPE_INVALID',
    'ROLE_MAX_CONCURRENT_INVALID',
    'ROLE_SIDE_EFFECT_INVALID'
  ]);
  assert.deepEqual(
    registry.errors.map((item) => item.field),
    ['artifact_type', 'max_concurrent_sessions', 'side_effect']
  );
  assert.deepEqual(
    registry.errors.map((item) => item.params.value),
    ['slides', 9, 'admin']
  );
  assert.equal(registry.counts.invalid, 3);
  assert.equal(registry.counts.roles, 3, 'built-in roles stay valid');
});

test('AC-08: an unknown skill reference yields ROLE_SKILL_NOT_FOUND naming the skill', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/ghost-skill.yaml': [
      'schema: role/v1',
      'id: ghost-skill',
      'name: 悬空',
      'group: research',
      'summary: 引用了不存在的技能',
      'artifact_type: report',
      'side_effect: read',
      'skills:',
      '  - no-such-skill',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['ROLE_SKILL_NOT_FOUND']);
  assert.equal(registry.errors[0].field, 'skills');
  assert.deepEqual(registry.errors[0].params, { skill: 'no-such-skill' });
});

test('AC-09: broken indentation reports line 4 and the machine detail key', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/broken.yaml': [
      'schema: role/v1',
      'id: broken',
      'name: 坏语法',
      '    summary: 四个空格缩进，前面没有 2 空格的父级可挂',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['YAML_PARSE_FAILED']);
  const [item] = registry.errors;
  assert.equal(item.line, 4);
  assert.equal(item.file, 'roles/broken.yaml');
  assert.equal(item.scope, 'role');
  assert.equal(item.field, null);
  assert.equal(item.params.line, 4);
  assert.equal(item.params.detailKey, 'inconsistent-indentation');
});

// ---------------------------------------------------------------------------
// AC-13 .. AC-16: skill assets (split doc 3.3)
// ---------------------------------------------------------------------------

test('AC-13: a skill directory without SKILL.md yields SKILL_FILE_MISSING', () => {
  const builtin = builtinFixture();
  const root = makeProject();
  fs.mkdirSync(path.join(root, '.orch', 'skills', 'half-done'), { recursive: true });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['SKILL_FILE_MISSING']);
  const [item] = registry.errors;
  assert.equal(item.file, 'skills/half-done/SKILL.md');
  assert.equal(item.scope, 'skill');
  assert.equal(item.field, null);
  assert.deepEqual(item.params, { dir: 'half-done' });
});

test('AC-14: one SKILL.md with two defects reports two errors, metadata first', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/skills/quote/SKILL.md': [
      '---',
      'schema: skill/v1',
      'id: quoting',
      'name: 引文',
      '---',
      '',
      '### 工作方法',
      '',
      '1. 只摘原文，不改写。',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  const items = errorsFor(registry, 'skills/quote/SKILL.md');
  assert.equal(items.length, 2);
  assert.equal(items[0].code, 'SKILL_SCHEMA_MISSING');
  assert.equal(items[0].field, 'summary');
  assert.equal(items[1].code, 'SKILL_ID_MISMATCH');
  assert.deepEqual(items[1].params, { dirId: 'quote', declaredId: 'quoting' });
  assert.equal(registry.counts.invalid, 1, 'invalid counts files, not errors');
});

test('AC-15: metadata only, empty body yields SKILL_BODY_EMPTY', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/skills/empty-body/SKILL.md': [
      '---',
      'schema: skill/v1',
      'id: empty-body',
      'name: 空正文',
      'summary: 只有元数据',
      '---',
      '',
      '   ',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['SKILL_BODY_EMPTY']);
  assert.deepEqual(registry.errors[0].params, { dir: 'empty-body' });
  assert.equal(registry.errors[0].file, 'skills/empty-body/SKILL.md');
});

test('AC-16: applies_to outside the five groups yields SKILL_GROUP_INVALID', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/skills/wrong-group/SKILL.md': [
      '---',
      'schema: skill/v1',
      'id: wrong-group',
      'name: 坏分组技能',
      'summary: 适用分组非法',
      'applies_to: [marketing]',
      '---',
      '',
      '### 工作方法',
      '',
      '1. 做事。',
      ''
    ].join('\n')
  });

  const registry = load(root, builtin);
  assert.deepEqual(codesOf(registry), ['SKILL_GROUP_INVALID']);
  assert.equal(registry.errors[0].field, 'applies_to');
  assert.deepEqual(registry.errors[0].params, { value: 'marketing' });
});

// ---------------------------------------------------------------------------
// Merge, onlyRole, asset root
// ---------------------------------------------------------------------------

test('AC-45: a project skill replaces the built-in one without changing totals', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/skills/coord/SKILL.md': skillText('coord', '协调（项目版）', 'coordinator')
  });

  const registry = load(root, builtin);
  assert.equal(registry.ok, true);
  assert.equal(registry.counts.skills, 3, 'same id does not grow the table');
  assert.equal(registry.counts.builtin, 5);
  assert.equal(registry.counts.project, 1);
  assert.equal(registry.counts.invalid, 0);
  assert.equal(registry.skillMap.get('coord').source, 'project');
  assert.equal(registry.skillMap.get('coord').file, 'skills/coord/SKILL.md');
  assert.equal(registry.skillMap.get('coord').name, '协调（项目版）');
});

test('a project role replaces the built-in one as a whole file', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/coord-core.yaml': roleText({
      id: 'coord-core',
      group: 'ops',
      skills: ['ops-run'],
      artifact: 'document',
      side: 'write',
      max: 3
    })
  });

  const registry = load(root, builtin);
  const def = registry.roleMap.get('coord-core');
  assert.equal(def.source, 'project');
  assert.equal(def.file, 'roles/coord-core.yaml');
  assert.equal(def.group, 'ops');
  assert.equal(def.artifactType, 'document');
  assert.equal(def.sideEffect, 'write');
  assert.equal(def.maxConcurrentSessions, 3);
  assert.equal(registry.counts.roles, 3);
  assert.equal(registry.counts.builtin, 5);
  assert.equal(registry.counts.project, 1);
});

test('onlyRole loads one role, loads all skills, and drops skill errors', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    // This skill is broken; its error must not leak into a single-role run.
    '.orch/skills/broken-skill/SKILL.md': '---\nschema: skill/v1\n---\n'
  });

  const registry = load(root, builtin, { onlyRole: 'coord-core' });
  assert.equal(registry.ok, true);
  assert.deepEqual(registry.roles.map((role) => role.id), ['coord-core']);
  assert.equal(registry.errors.length, 0);
  assert.deepEqual(registry.counts, {
    assets: 1,
    roles: 1,
    skills: 0,
    builtin: 1,
    project: 0,
    invalid: 0
  });
  assert.equal(registry.skillMap.get('coord').source, 'builtin', 'skills still resolve');
  assert.equal(registry.groups.length, 5);
});

test('onlyRole on a broken role keeps just that file in errors', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/no-concurrency.yaml': [
      'schema: role/v1',
      'id: no-concurrency',
      'name: 没并发',
      'group: coding',
      'summary: 只缺并发上限',
      'artifact_type: code',
      'side_effect: read',
      'skills: []',
      ''
    ].join('\n'),
    '.orch/skills/quote/SKILL.md': '---\nschema: skill/v1\nid: quoting\nname: 引文\n---\n\n1. x\n'
  });

  const registry = load(root, builtin, { onlyRole: 'no-concurrency' });
  assert.equal(registry.ok, false);
  assert.deepEqual(codesOf(registry), ['ROLE_SCHEMA_MISSING']);
  assert.equal(registry.errors[0].file, 'roles/no-concurrency.yaml');
  assert.deepEqual(registry.counts, {
    assets: 1,
    roles: 0,
    skills: 0,
    builtin: 0,
    project: 0,
    invalid: 1
  });
});

test('onlyRole prefers the project copy over the built-in copy', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/coord-core.yaml': roleText({ id: 'coord-core', group: 'ops', skills: ['ops-run'] })
  });

  const registry = load(root, builtin, { onlyRole: 'coord-core' });
  assert.equal(registry.roles[0].source, 'project');
  assert.deepEqual(registry.counts, {
    assets: 1,
    roles: 1,
    skills: 0,
    builtin: 0,
    project: 1,
    invalid: 0
  });
});

test('onlyRole on an unknown id returns an empty table without errors', () => {
  const builtin = builtinFixture();
  const registry = load(makeProject(), builtin, { onlyRole: 'not-here' });

  assert.equal(registry.ok, true);
  assert.equal(registry.roles.length, 0);
  assert.equal(registry.errors.length, 0);
  assert.equal(registry.counts.roles, 0);
  assert.equal(registry.counts.assets, 1);
});

test('a missing built-in root yields one REGISTRY_ASSETS_MISSING and stops', () => {
  const missing = path.join(makeTemp('nowhere'), 'no-such-assets');
  const root = makeProject({
    '.orch/roles/coord-core.yaml': roleText({ id: 'coord-core', group: 'coding' })
  });

  const registry = load(root, missing);
  assert.equal(registry.ok, false);
  assert.equal(registry.errors.length, 1);
  const [item] = registry.errors;
  assert.equal(item.code, 'REGISTRY_ASSETS_MISSING');
  assert.equal(item.file, 'roles');
  assert.equal(item.scope, 'role');
  assert.equal(item.field, null);
  assert.equal(item.line, null);
  assert.equal(item.params.path, missing);
  assert.equal(registry.roles.length, 0);
  assert.equal(registry.counts.invalid, 1);
});

// ---------------------------------------------------------------------------
// AC-44: read-only, no network imports
// ---------------------------------------------------------------------------

function snapshot(root) {
  const files = new Map();
  const dirs = [];
  const walk = (dir) => {
    dirs.push(path.relative(root, dir));
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        files.set(path.relative(root, abs), {
          hash: crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'),
          mtime: fs.statSync(abs).mtimeMs
        });
      }
    }
  };
  walk(root);
  return { files, dirs: dirs.sort() };
}

test('AC-44: loading leaves bytes, mtimes and the directory tree untouched', () => {
  const builtin = builtinFixture();
  const root = makeProject({
    '.orch/roles/coord-core.yaml': roleText({ id: 'coord-core', group: 'ops', skills: ['ops-run'] }),
    '.orch/skills/half-done/README.md': 'not a skill\n',
    '.orch/roles/broken.yaml': 'schema: role/v1\nid: broken\nname: 坏\n    oops: 1\n'
  });

  const beforeBuiltin = snapshot(builtin);
  const beforeProject = snapshot(root);
  load(root, builtin);
  load(root, builtin, { onlyRole: 'coord-core' });

  assert.deepEqual(snapshot(builtin), beforeBuiltin);
  assert.deepEqual(snapshot(root), beforeProject);
});

test('AC-44: the registry never imports a network module', () => {
  const banned = ['node:http', 'node:https', 'node:net', 'node:dns', 'node:tls', "'http'", "'https'"];
  for (const name of fs.readdirSync(REGISTRY_DIR)) {
    if (!name.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(REGISTRY_DIR, name), 'utf8');
    for (const specifier of banned) {
      assert.equal(text.includes(specifier), false, `${name} must not reference ${specifier}`);
    }
  }
});

test('AC-43: the registry sources contain no CJK characters', () => {
  const cjk = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  for (const name of fs.readdirSync(REGISTRY_DIR)) {
    if (!name.endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(REGISTRY_DIR, name), 'utf8');
    assert.equal(cjk.test(text), false, `${name} must stay free of CJK`);
  }
});

// ---------------------------------------------------------------------------
// Path helpers (2.4)
// ---------------------------------------------------------------------------

test('asset path helpers point at the documented directories', () => {
  assert.equal(assetsRoot(), path.join(REPO, 'assets'));
  assert.equal(builtinRolesDir(), path.join(REPO, 'assets', 'roles'));
  assert.equal(builtinSkillsDir(), path.join(REPO, 'assets', 'skills'));
  assert.equal(projectRolesDir('/tmp/x'), path.join('/tmp/x', '.orch', 'roles'));
  assert.equal(projectSkillsDir('/tmp/x'), path.join('/tmp/x', '.orch', 'skills'));
});
