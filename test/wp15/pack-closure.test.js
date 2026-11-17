/**
 * I1.12 WP-4 / AC-13 contract: dependency-closure export.
 *
 * Fixtures live under os.tmpdir() (%TEMP% on Windows) with NODE_ENV=test.
 * Assertions use machine codes / paths only; no localized wording is needed.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildPackage } from '../../src/core/pack.js';

const sha = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

let root;

test.before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-closure-'));
  fs.mkdirSync(path.join(root, '.orch', 'roles'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'roles', 'keep.yaml'), 'id: keep\nversion: 1\n', 'utf8');
});

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function snapshot(dir) {
  const out = {};
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out[path.relative(dir, abs).replace(/\\/g, '/')] = sha(fs.readFileSync(abs, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

function roleRegistry() {
  return {
    roles: {
      'role-child': {
        version: 1,
        file: '.orch/roles/role-child.yaml',
        skills: ['skill-x'],
        derived_from: 'role-parent',
        text: 'id: role-child\nversion: 1\n'
      },
      'role-parent': {
        version: 2,
        file: '.orch/roles/role-parent.yaml',
        text: 'id: role-parent\nversion: 2\n'
      },
      'role-unrelated': {
        version: 1,
        file: '.orch/roles/role-unrelated.yaml',
        text: 'id: role-unrelated\nversion: 1\n'
      }
    },
    skills: {
      'skill-x': {
        version: 2,
        file: '.orch/skills/skill-x.yaml',
        text: 'id: skill-x\nversion: 2\n'
      },
      'skill-unrelated': {
        version: 1,
        file: '.orch/skills/skill-unrelated.yaml',
        text: 'id: skill-unrelated\nversion: 1\n'
      }
    },
    workflows: {}
  };
}

function workflowRegistry() {
  return {
    roles: {},
    skills: {},
    workflows: {
      'wf-main': {
        version: 1,
        file: '.orch/workflows/wf-main.yaml',
        subworkflows: ['wf-child'],
        text: 'id: wf-main\nversion: 1\n'
      },
      'wf-child': {
        version: 2,
        file: '.orch/workflows/wf-child.yaml',
        text: 'id: wf-child\nversion: 2\n'
      },
      'wf-unrelated': {
        version: 1,
        file: '.orch/workflows/wf-unrelated.yaml',
        text: 'id: wf-unrelated\nversion: 1\n'
      }
    }
  };
}

test('role closure contains skill and derived parent, never an unrelated asset', () => {
  const before = snapshot(root);
  const result = buildPackage({
    asset: { type: 'role', id: 'role-child' },
    registry: roleRegistry(),
    root
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.files).sort(), [
    '.orch/roles/role-child.yaml',
    '.orch/roles/role-parent.yaml',
    '.orch/skills/skill-x.yaml'
  ]);
  assert.deepEqual(
    result.manifest.deps.map((dep) => dep.name).sort(),
    ['role-parent', 'skill-x']
  );
  assert.equal(result.manifest.type, 'role');
  assert.equal(result.manifest.id, 'role-child');
  assert.equal(result.manifest.version, 1);
  for (const [rel, text] of Object.entries(result.files)) {
    assert.equal(result.manifest.files[rel], sha(text));
  }
  assert.ok(!JSON.stringify(result.manifest).includes('unrelated'));
  assert.deepEqual(snapshot(root), before);
});

test('workflow closure contains the sub-workflow and excludes unrelated ones', () => {
  const result = buildPackage({
    asset: { type: 'workflow', id: 'wf-main' },
    registry: workflowRegistry(),
    root
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.files).sort(), [
    '.orch/workflows/wf-child.yaml',
    '.orch/workflows/wf-main.yaml'
  ]);
  assert.deepEqual(result.manifest.deps, [{ name: 'wf-child', type: 'workflow', version: 2 }]);
});

test('missing dependency is refused and names the missing asset', () => {
  const registry = roleRegistry();
  registry.roles['role-child'].skills = ['skill-ghost'];
  const result = buildPackage({
    asset: { type: 'role', id: 'role-child' },
    registry,
    root
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPENDENCY_MISSING');
  assert.equal(result.detail.name, 'skill-ghost');
});

test('derived chain cycle is refused and locates the loop', () => {
  const registry = roleRegistry();
  registry.roles['role-parent'].derived_from = 'role-child';
  const result = buildPackage({
    asset: { type: 'role', id: 'role-child' },
    registry,
    root
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'DEPENDENCY_CYCLE');
  assert.ok(result.detail.chain.includes('role:role-child'));
  assert.ok(result.detail.chain.includes('role:role-parent'));
  assert.equal(result.detail.chain[0], result.detail.chain[result.detail.chain.length - 1]);
});

test('buildPackage reads file text from root when no in-memory text is supplied', () => {
  fs.mkdirSync(path.join(root, '.orch', 'roles'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'roles', 'on-disk.yaml'), 'id: on-disk\nversion: 3\n', 'utf8');
  const result = buildPackage({
    asset: {
      type: 'role',
      id: 'on-disk',
      version: 3,
      file: '.orch/roles/on-disk.yaml'
    },
    registry: { roles: {}, skills: {}, workflows: {} },
    root
  });
  assert.equal(result.ok, true);
  assert.equal(result.files['.orch/roles/on-disk.yaml'], 'id: on-disk\nversion: 3\n');
  assert.equal(result.manifest.files['.orch/roles/on-disk.yaml'], sha('id: on-disk\nversion: 3\n'));
});
