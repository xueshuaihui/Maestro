/** Instance maintenance tests (wp20). */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  archiveInstance,
  cloneInstance,
  renameInstance,
  exportInstance,
  saveInstanceAsTemplate
} from '../../src/daemon/instance-maintenance.js';
import { instanceDir, statePath } from '../../src/persistence/paths.js';

function seed(root, id, overrides = {}) {
  const dir = instanceDir(root, id);
  fs.mkdirSync(path.join(dir, 'state'), { recursive: true });
  const state = {
    instanceId: id,
    state: 'completed',
    template: 'code-loop',
    title: 'Original',
    nodes: [{ id: 'T-001', nodeId: 'T-001', roleId: 'developer', title: 'Build' }],
    createdAt: new Date().toISOString(),
    ...overrides
  };
  fs.writeFileSync(statePath(root, id), JSON.stringify(state, null, 2));
  fs.writeFileSync(path.join(dir, 'events.jsonl'), '{"seq":1,"type":"x"}\n');
  fs.writeFileSync(path.join(dir, 'state', 'traces.jsonl'), '{"traceId":"t1"}\n');
  return state;
}
function fresh() { return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-instm-')); }

test('rename keeps the instance and updates the display title', async () => {
  const root = fresh();
  seed(root, 'INST-001');
  const r = await renameInstance(root, 'INST-001', 'Renamed Task');
  assert.equal(r.ok, true);
  assert.equal(JSON.parse(fs.readFileSync(statePath(root, 'INST-001'), 'utf8')).title, 'Renamed Task');
});

test('clone copies files and resets the engine state', async () => {
  const root = fresh();
  seed(root, 'INST-001');
  const r = await cloneInstance(root, 'INST-001', { id: 'INST-002' });
  assert.equal(r.ok, true);
  const cloned = JSON.parse(fs.readFileSync(statePath(root, 'INST-002'), 'utf8'));
  assert.equal(cloned.state, 'created');
  assert.equal(cloned.clonedFrom, 'INST-001');
  assert.equal(typeof cloned.nodes, 'undefined');
  assert.equal(fs.existsSync(path.join(instanceDir(root, 'INST-002'), 'events.jsonl')), true);
});

test('active instances cannot be archived', async () => {
  const root = fresh();
  seed(root, 'INST-001', { state: 'running' });
  const blocked = await archiveInstance(root, 'INST-001');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'INSTANCE_ACTIVE');
  const state = JSON.parse(fs.readFileSync(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(state.state, 'running');
});

test('terminal instances archive to a recoverable location', async () => {
  const root = fresh();
  seed(root, 'INST-001', { state: 'cancelled' });
  const r = await archiveInstance(root, 'INST-001');
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(instanceDir(root, 'INST-001')), false);
  assert.equal(fs.existsSync(path.join(root, r.archivedTo)), true);
});

test('export returns real events and spans', async () => {
  const root = fresh();
  seed(root, 'INST-001');
  const r = await exportInstance(root, 'INST-001');
  assert.equal(r.ok, true);
  assert.equal(r.payload.format, 'maestro-instance-export/v1');
  assert.equal(r.payload.events.length, 1);
  assert.equal(r.payload.spans.length, 1);
});

test('save-as-template writes a reusable workflow asset', async () => {
  const root = fresh();
  seed(root, 'INST-001');
  const r = await saveInstanceAsTemplate(root, 'INST-001', { id: 'reusable-flow' });
  assert.equal(r.ok, true);
  const text = fs.readFileSync(path.join(root, '.orch', 'workflows', 'reusable-flow.yaml'), 'utf8');
  assert.ok(text.includes('schema: workflow/v1'));
  assert.ok(text.includes('node_type: role'));
  assert.ok(text.includes('entry: T-001'));
});

test('invalid ids are refused without touching disk', async () => {
  const root = fresh();
  assert.equal((await archiveInstance(root, '../escape')).ok, false);
  assert.equal((await cloneInstance(root, 'x')).ok, false);
  assert.equal((await renameInstance(root, 'x', '')).ok, false);
});
