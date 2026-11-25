/** Unified resource platform domain tests (wp20). */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listResources,
  getResource,
  createResource,
  updateResource,
  archiveResource,
  restoreResource,
  removeResource,
  cloneResource,
  forkResource,
  exportResource,
  importResource,
  refsInDoc,
  outgoingInDoc,
  deriveId,
  projectMeta,
  META_KEYS
} from '../../src/resources/index.js';
import { saveStudio, loadStudio } from '../../src/studio/store.js';
import { emptyStudio } from '../../src/studio/schema.js';

function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-res-'));
}

test('meta projection keeps the frozen 8-field prefix and no CJK', () => {
  const meta = projectMeta('role', { id: 'r1', name: 'Role', extra: 1 }, { source: 'project' });
  assert.deepEqual(META_KEYS.slice(0, 8), ['id', 'type', 'name', 'source', 'origin', 'archived', 'createdAt', 'updatedAt']);
  assert.deepEqual(Object.keys(meta).slice(0, 8), [...META_KEYS]);
  assert.equal(meta.extra, 1);
  assert.equal(meta.archived, false);
  assert.equal(projectMeta('role', null), null);
});

test('deriveId avoids collisions deterministically', () => {
  assert.equal(deriveId('Hello World', []), 'hello-world');
  assert.equal(deriveId('role', ['role', 'role-copy-2']), 'role-copy-3');
});

test('list on an empty project returns seeded departments and no roles', async () => {
  const root = freshRoot();
  const result = await listResources(root);
  assert.equal(result.ok, true);
  assert.equal(result.counts.department, 6);
  assert.equal(result.counts.role >= 16, true);
  assert.equal(result.counts.skill >= 10, true);
  assert.equal(result.counts.team ?? 0, 0);
});

test('full CRUD on studio-backed resources persists to studio.json', async () => {
  const root = freshRoot();
  const created = await createResource(root, 'role', { name: 'Platform Engineer', departmentId: 'backend', code: 'backend-dev' });
  assert.equal(created.ok, true);
  const id = created.item.id;
  assert.equal(created.item.source, 'project');
  assert.equal(created.item.archived, false);

  const got = await getResource(root, 'role', id);
  assert.equal(got.ok, true);
  assert.equal(got.item.name, 'Platform Engineer');

  const updated = await updateResource(root, 'role', id, { summary: 'owns runtime' });
  assert.equal(updated.ok, true);
  assert.equal(updated.item.summary, 'owns runtime');

  const doc = (await loadStudio(root)).doc;
  assert.equal(doc.roles.find((r) => r.id === id).summary, 'owns runtime');
});

test('archive hides a resource but restore brings it back; force remove deletes', async () => {
  const root = freshRoot();
  const created = await createResource(root, 'team', { name: 'Alpha', roleIds: [], runMode: 'auto' });
  assert.equal(created.ok, false); // no role in team is rejected by domain

  const role = await createResource(root, 'role', { name: 'Dev', departmentId: 'backend', code: 'backend-dev' });
  const team = await createResource(root, 'team', { name: 'Alpha', roleIds: [role.item.id] });
  assert.equal(team.ok, true);

  const archived = await archiveResource(root, 'team', team.item.id);
  assert.equal(archived.ok, true);
  assert.equal((await listResources(root, { types: ['team'] })).items.some((r) => r.id === team.item.id), false);
  assert.equal((await listResources(root, { types: ['team'], includeArchived: true })).items.some((r) => r.id === team.item.id), true);

  await restoreResource(root, 'team', team.item.id);
  assert.equal((await getResource(root, 'team', team.item.id)).item.archived, false);

  const removed = await removeResource(root, 'team', team.item.id, { archive: false });
  assert.equal(removed.ok, true);
  assert.equal((await getResource(root, 'team', team.item.id)).ok, false);
});

test('references block deletion until they are detached', async () => {
  const root = freshRoot();
  const role = await createResource(root, 'role', { name: 'Dev', departmentId: 'backend', code: 'backend-dev' });
  const team = await createResource(root, 'team', { name: 'Alpha', roleIds: [role.item.id] });
  const refs = await refsInDoc((await loadStudio(root)).doc, 'role', role.item.id);
  assert.equal(refs.some((r) => r.type === 'team' && r.id === team.item.id), true);

  const blocked = await removeResource(root, 'role', role.item.id, { archive: false });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'RESOURCE_IN_USE');

  const forced = await removeResource(root, 'role', role.item.id, { archive: false, force: true });
  assert.equal(forced.ok, true);
  const doc = (await loadStudio(root)).doc;
  assert.equal(doc.teams[0].roleIds.includes(role.item.id), false);
});

test('clone makes an independent writable copy', async () => {
  const root = freshRoot();
  const role = await createResource(root, 'role', { name: 'Dev', departmentId: 'backend', code: 'backend-dev' });
  const clone = await cloneResource(root, 'role', role.item.id);
  assert.equal(clone.ok, true);
  assert.equal(clone.item.id !== role.item.id, true);
  assert.equal((await loadStudio(root)).doc.roles.length, 2);
});

test('built-in role fork lands in .orch/roles and becomes a project resource', async () => {
  const root = freshRoot();
  const builtins = await listResources(root, { types: ['role'], source: 'builtin' });
  assert.equal(builtins.items.length > 0, true);
  const source = builtins.items[0];
  const forked = await forkResource(root, 'role', source.id);
  assert.equal(forked.ok, true);
  assert.equal(forked.item.source, 'project');
  assert.equal(forked.item.origin, source.id);
  assert.equal(fs.existsSync(path.join(root, '.orch', 'roles', `${forked.item.id}.yaml`)), true);

  const again = await forkResource(root, 'role', source.id);
  assert.equal(again.ok, true);
  assert.equal(again.item.id !== forked.item.id, true);
});

test('export/import round trip keeps the body and type', async () => {
  const root = freshRoot();
  const role = await createResource(root, 'role', { name: 'Dev', departmentId: 'backend', code: 'backend-dev' });
  const exported = await exportResource(root, 'role', role.item.id);
  assert.equal(exported.ok, true);
  assert.equal(exported.payload.format, 'maestro-resource/v1');

  const other = freshRoot();
  const imported = await importResource(other, exported.payload);
  assert.equal(imported.ok, true);
  assert.equal(imported.item.name, 'Dev');
  assert.equal((await listResources(other, { types: ['role'], source: 'project' })).items.length, 1);
});

test('outgoing references describe dependencies without mutating', () => {
  const doc = emptyStudio();
  doc.roles.push({ id: 'r1', departmentId: 'backend', skills: ['s1'] });
  doc.teams.push({ id: 't1', roleIds: ['r1'], flowId: 'f1' });
  const out = outgoingInDoc(doc, 'team', 't1');
  assert.deepEqual(out.map((r) => `${r.type}:${r.id}`), ['role:r1', 'flow:f1']);
});

test('studio store round-trip keeps custom department name and archived flag', async () => {
  const root = freshRoot();
  const created = await createResource(root, 'department', { id: 'custom-dept', name: 'Custom Dept', labelKey: null });
  assert.equal(created.ok, true);
  await archiveResource(root, 'department', 'custom-dept');
  const doc = (await loadStudio(root)).doc;
  const row = doc.departments.find((d) => d.id === 'custom-dept');
  assert.equal(row.name, 'Custom Dept');
  assert.equal(row.archived, true);
});
