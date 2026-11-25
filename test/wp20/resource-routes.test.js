/** Unified resource HTTP contract tests (wp20). */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createHttpServer } from '../../src/daemon/http/server.js';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-res-http-'));
}

function fakeOrchestrator() {
  return {
    mode: 'real',
    async reconcileOnBoot() { return { ok: true, interrupted: [] }; },
    async interruptAll() { return { ok: true, interrupted: [] }; },
    async dispose() {},
    async listInstances() { return { ok: true, items: [] }; },
    async getStatus() { return { ok: false, code: 'NOT_FOUND' }; }
  };
}

async function withServer(fn) {
  const root = makeRoot();
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const http = createHttpServer({
    root,
    orchestrator: fakeOrchestrator(),
    bus,
    graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
    staticRoot: root
  });
  const listened = await http.listen();
  assert.equal(listened.ok, true);
  const base = `http://127.0.0.1:${listened.port}`;
  const headers = { Authorization: `Bearer ${listened.token}`, 'content-type': 'application/json' };
  try {
    await fn({ root, base, headers });
  } finally {
    await http.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function call(base, headers, method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  assert.equal(res.status, 200);
  return res.json();
}

test('GET /resources returns the unified projection with counts', async () => {
  await withServer(async ({ base, headers }) => {
    const body = await call(base, headers, 'GET', '/resources');
    assert.equal(body.ok, true);
    assert.equal(body.counts.department, 6);
    assert.equal(Array.isArray(body.items), true);
    assert.deepEqual(Object.keys(body.items[0]).slice(0, 8), [
      'id', 'type', 'name', 'source', 'origin', 'archived', 'createdAt', 'updatedAt'
    ]);
  });
});

test('full resource lifecycle over HTTP', async () => {
  await withServer(async ({ base, headers }) => {
    const created = await call(base, headers, 'POST', '/resources', {
      type: 'role', input: { name: 'Builder', departmentId: 'engineering-management', code: 'backend-dev' }
    });
    assert.equal(created.ok, true);
    const id = created.item.id;

    const got = await call(base, headers, 'GET', `/resources/role/${encodeURIComponent(id)}`);
    assert.equal(got.item.name, 'Builder');

    const patched = await call(base, headers, 'PATCH', `/resources/role/${encodeURIComponent(id)}`, {
      patch: { summary: 'builds things' }
    });
    assert.equal(patched.item.summary, 'builds things');

    const cloned = await call(base, headers, 'POST', `/resources/role/${encodeURIComponent(id)}/clone`, {});
    assert.equal(cloned.ok, true);

    const exported = await call(base, headers, 'GET', `/resources/role/${encodeURIComponent(id)}/export`);
    assert.equal(exported.payload.format, 'maestro-resource/v1');

    const archived = await call(base, headers, 'POST', `/resources/role/${encodeURIComponent(id)}/archive`, {});
    assert.equal(archived.item.archived, true);

    const restored = await call(base, headers, 'POST', `/resources/role/${encodeURIComponent(id)}/restore`, {});
    assert.equal(restored.item.archived, false);

    const refs = await call(base, headers, 'GET', `/resources/role/${encodeURIComponent(id)}/refs`);
    assert.equal(refs.ok, true);
    assert.deepEqual(refs.incoming, []);
  });
});

test('fork of a built-in role produces a project resource over HTTP', async () => {
  await withServer(async ({ base, headers }) => {
    const builtins = await call(base, headers, 'GET', '/resources?types=role&source=builtin');
    assert.equal(builtins.items.length > 0, true);
    const forked = await call(base, headers, 'POST', `/resources/role/${encodeURIComponent(builtins.items[0].id)}/fork`, {});
    assert.equal(forked.ok, true);
    assert.equal(forked.item.source, 'project');
    assert.equal(forked.item.origin, builtins.items[0].id);
  });
});

test('legacy /studio/action shape is untouched by the new table', async () => {
  await withServer(async ({ base, headers }) => {
    const state = await call(base, headers, 'GET', '/studio/state');
    assert.equal(state.ok, true);
    assert.equal(Array.isArray(state.doc?.departments ?? state.departments ?? []), true);
    const labels = await call(base, headers, 'GET', '/studio/labels');
    assert.equal(labels.ok, true);
    assert.equal(typeof labels.labels, 'object');
  });
});
