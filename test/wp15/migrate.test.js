/**
 * I1.12 WP-4 / AC-16 + AC-17 contract: `orch migrate` list/apply, one-to-one
 * reference upgrades, no-op on latest assets, bad-reference safety and
 * idempotency.
 *
 * Fixtures live under os.tmpdir() (%TEMP%) with NODE_ENV=test; all writes go
 * through `fs.writeFileSync` on Windows (no shell, no hardcoded bash).
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { listMigrations, applyMigrations } from '../../src/core/pack.js';
import { migrateCommand } from '../../src/cli/migrate.js';

const sha = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

const FILES = {
  '.orch/roles/role-parent.yaml': 'id: role-parent\nversion: 2\nsummary: parent definition body\n',
  '.orch/roles/role-child.yaml': [
    'schema: role/v1',
    'id: role-child',
    'version: 1',
    'summary: business text kept untouched',
    'derived_from: role-parent@1',
    'skills:',
    '  - skill-x@1',
    ''
  ].join('\n'),
  '.orch/skills/skill-x.yaml': 'id: skill-x\nversion: 2\nsummary: skill definition body\n',
  '.orch/workflows/wf-main.yaml': [
    'schema: workflow/v1',
    'id: wf-main',
    'version: 1',
    'nodes:',
    '  - id: T-001',
    '    node_type: subworkflow',
    '    workflow: wf-child@1',
    ''
  ].join('\n'),
  '.orch/workflows/wf-child.yaml': 'id: wf-child\nversion: 2\nsummary: child definition body\n'
};

function fixture(t, mutate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-migrate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(FILES)) {
    const abs = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, mutate ? mutate(rel, text) : text, 'utf8');
  }
  return root;
}

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

function byName(items) {
  return items.slice().sort((a, b) => a.name.localeCompare(b.name));
}

test('listMigrations lists every old reference with a one-to-one from -> to', (t) => {
  const root = fixture(t);
  const plan = listMigrations({ root });
  assert.equal(plan.total, 3);
  assert.deepEqual(
    byName(plan.items).map((item) => ({ name: item.name, from: item.from, to: item.to, field: item.field })),
    [
      { name: 'role-parent', from: 1, to: 2, field: 'derived_from' },
      { name: 'skill-x', from: 1, to: 2, field: 'skills' },
      { name: 'wf-child', from: 1, to: 2, field: 'workflow' }
    ]
  );
  for (const item of plan.items) {
    assert.equal(item.targetExists, true);
    assert.ok(item.file.length > 0);
  }
});

test('applyMigrations upgrades exactly the listed references and backs up first', async (t) => {
  const root = fixture(t);
  const backupDir = path.join(root, '.migrate-backup-test');
  const plan = listMigrations({ root });
  const before = snapshot(root);

  const result = await applyMigrations({ root, plan, backupDir });
  assert.equal(result.ok, true);
  assert.equal(result.changed, plan.total);
  assert.deepEqual(result.summary.items, byName(result.summary.items));
  assert.equal(result.summary.items.length, plan.total);
  assert.equal(result.summary.backupDir, backupDir);
  assert.equal(result.labelKey, 'MIGRATE_DONE');

  for (const item of plan.items) {
    const text = fs.readFileSync(path.join(root, ...item.file.split('/')), 'utf8');
    assert.ok(text.includes(`${item.name}@${item.to}`), `${item.name} not upgraded`);
    assert.ok(!text.includes(`${item.name}@${item.from}`), `${item.name} still old`);
    const backup = fs.readFileSync(path.join(backupDir, ...item.file.split('/')), 'utf8');
    assert.equal(sha(backup), before[item.file]);
  }
  const child = fs.readFileSync(path.join(root, '.orch', 'roles', 'role-child.yaml'), 'utf8');
  assert.ok(child.includes('summary: business text kept untouched'));
  assert.ok(child.includes('schema: role/v1'));
  assert.notDeepEqual(snapshot(root), before);
});

test('re-list after apply is empty and a second apply writes nothing', async (t) => {
  const root = fixture(t);
  const plan = listMigrations({ root });
  assert.equal(plan.total, 3);
  await applyMigrations({ root, plan });
  const afterFirst = snapshot(root);

  const again = listMigrations({ root });
  assert.equal(again.total, 0);
  assert.deepEqual(again.items, []);
  const second = await applyMigrations({ root, plan: again });
  assert.equal(second.ok, true);
  assert.equal(second.changed, 0);
  assert.deepEqual(snapshot(root), afterFirst);
});

test('latest assets need no migration and migrateCommand writes nothing', async (t) => {
  const root = fixture(t, (rel, text) => text.replace(/@1/g, '@2'));
  const before = snapshot(root);
  assert.equal(listMigrations({ root }).total, 0);

  const lines = [];
  const code = await migrateCommand(
    { flags: { yes: true } },
    { cwd: root, out: (line) => lines.push(line) }
  );
  assert.equal(code, 0);
  assert.deepEqual(lines, ['NO MIGRATION NEEDED']);
  assert.deepEqual(snapshot(root), before);
});

test('a missing target is rejected before any write and keeps original bytes', async (t) => {
  const root = fixture(t, (rel, text) =>
    rel === '.orch/roles/role-child.yaml' ? text.replace('role-parent@1', 'ghost@1') : text
  );
  const before = snapshot(root);
  const plan = listMigrations({ root });
  const bad = plan.items.find((item) => item.name === 'ghost');
  assert.ok(bad);
  assert.equal(bad.targetExists, false);
  assert.equal(bad.to, null);

  const result = await applyMigrations({ root, plan, backupDir: path.join(root, '.migrate-backup-bad') });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MIGRATION_TARGET_MISSING');
  assert.deepEqual(snapshot(root), before);
  assert.ok(!fs.existsSync(path.join(root, '.migrate-backup-bad')));
});

test('migrateCommand lists the plan, then applies exactly that many upgrades', async (t) => {
  const root = fixture(t);
  const expected = listMigrations({ root }).total;
  const lines = [];
  const code = await migrateCommand(
    { flags: { yes: true } },
    { cwd: root, out: (line) => lines.push(line) }
  );
  assert.equal(code, 0);
  assert.equal(lines.filter((line) => line.startsWith('MIGRATE ')).length, expected);
  assert.ok(lines.includes(`MIGRATION DONE ${expected} REFERENCES UPGRADED`));
  assert.equal(listMigrations({ root }).total, 0);
});

test('without confirmation migrateCommand lists but does not write', async (t) => {
  const root = fixture(t);
  const before = snapshot(root);
  const lines = [];
  const plan = listMigrations({ root });
  const code = await migrateCommand({ flags: {} }, { cwd: root, out: (line) => lines.push(line) });
  assert.equal(code, 0);
  assert.equal(lines.filter((line) => line.startsWith('MIGRATE ')).length, plan.total);
  assert.ok(lines.includes('MIGRATION CANCELLED'));
  assert.deepEqual(snapshot(root), before);
});
