/**
 * Desktop HTTP channel contract tests (I1.10a WP-2).
 *
 * AC-27 (channel part) / D-1: loopback-only bind, Bearer token auth with a
 * body that carries only the error code, desktop.json shape and deletion
 * timing, and the regression red line — without the `http` switch the daemon
 * listens on IPC only and no desktop.json ever appears.
 *
 * S-02 seam: /ui/labels is already live via the batch-1 labels.js lazy
 * import (frozen 147 + 63 key contract); routes.js (WP-3) is not landed in this
 * batch, so REST routes owned by WP-3 degrade to a structured 503 and the
 * injected handler table still works.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createServer } from '../../src/daemon/server.js';
import { createHttpServer, desktopMetaPath } from '../../src/daemon/http/server.js';
import { labelKeysPayload } from '../../src/daemon/http/labels.js';
import { createRoutes } from '../../src/daemon/http/routes.js';
import { TEMPLATE_LABEL } from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp2-channel-'));
}

function fakeOrchestrator(spy = {}) {
  return {
    mode: 'real',
    async reconcileOnBoot() {
      return { ok: true, interrupted: [] };
    },
    async interruptAll() {
      return { ok: true, interrupted: [] };
    },
    async dispose() {},
    async listInstances() {
      return { ok: true, items: [] };
    },
    async getStatus() {
      return { ok: false, code: 'NOT_FOUND' };
    },
    async startRun(params) {
      spy.startRunCalls = (spy.startRunCalls ?? 0) + 1;
      spy.lastStartRunParams = params ?? null;
      return { ok: false, code: 'IPC_BAD_PARAMS' };
    },
    async waitForRun() {
      return { ok: false, code: 'NOT_RUNNING' };
    },
  };
}

async function startDesktopServer(root, orchestrator) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const server = createServer({
    root,
    orchestrator,
    bus,
    generation: 'gen-wp2-channel',
    exitOnStop: false,
    http: true,
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true);
  const meta = JSON.parse(fs.readFileSync(desktopMetaPath(root), 'utf8'));
  return { server, store, bus, meta };
}

test('desktop.json is written after listen with the D-1 shape', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    try {
      assert.equal(Number.isInteger(meta.port), true);
      assert.match(meta.token, /^[0-9a-f]{64}$/); // 32 random bytes, hex
      assert.equal(meta.pid, process.pid);
      assert.equal(meta.generation, 'gen-wp2-channel');
      assert.match(meta.startedAt, /^\d{4}-\d{2}-\d{2}T/);
      const raw = fs.readFileSync(desktopMetaPath(root), 'utf8');
      assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), [
        'generation',
        'pid',
        'port',
        'startedAt',
        'token',
      ]);
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('missing or wrong bearer token yields 401 with a code-only body', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    try {
      const base = `http://127.0.0.1:${meta.port}`;
      const missing = await fetch(`${base}/instances`);
      assert.equal(missing.status, 401);
      assert.deepEqual(JSON.parse(await missing.text()), { error: 'UNAUTHORIZED' });

      const wrong = await fetch(`${base}/ui/labels`, {
        headers: { Authorization: 'Bearer deadbeef' },
      });
      assert.equal(wrong.status, 401);
      assert.deepEqual(JSON.parse(await wrong.text()), { error: 'UNAUTHORIZED' });
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('GET /ui/labels serves the frozen 147 + 63 key payload via the S-02 seam', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    try {
      const res = await fetch(`http://127.0.0.1:${meta.port}/ui/labels`, {
        headers: { Authorization: `Bearer ${meta.token}` },
      });
      assert.equal(res.status, 200);
      const payload = await res.json();
      assert.equal(typeof payload.keys, 'object');
      assert.equal(Object.keys(payload.keys).length, 147 + 63);
      assert.deepEqual(Object.keys(payload.keys).sort(), Object.keys(labelKeysPayload().keys).sort());
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('registerLabels injection takes precedence over the lazy import', async () => {
  const root = makeRoot();
  try {
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const httpServer = createHttpServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
      staticRoot: root,
    });
    httpServer.registerLabels((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ keys: { INJECTED: 'yes' } }));
    });
    const listened = await httpServer.listen();
    assert.equal(listened.ok, true);
    try {
      const res = await fetch(`http://127.0.0.1:${listened.port}/ui/labels`, {
        headers: { Authorization: `Bearer ${listened.token}` },
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { keys: { INJECTED: 'yes' } });
    } finally {
      await httpServer.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('registerRoutes injection serves injected handlers', async () => {
  const root = makeRoot();
  try {
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const httpServer = createHttpServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
      staticRoot: root,
    });
    httpServer.registerRoutes([
      {
        method: 'GET',
        pattern: '/instances/:id/graph',
        handler(req, res, url, params) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ injected: params.id }));
        },
      },
    ]);
    const listened = await httpServer.listen();
    assert.equal(listened.ok, true);
    try {
      const res = await fetch(`http://127.0.0.1:${listened.port}/instances/INST-9/graph`, {
        headers: { Authorization: `Bearer ${listened.token}` },
      });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { injected: 'INST-9' });
    } finally {
      await httpServer.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('WP-3 routes take over 503 NOT_READY when injected; unattached seam still degrades', async () => {
  // Form 1 (degradation preserved, decision H): with the write seam absent
  // the WP-3 table refuses to build, so the WP-3 owned paths answer the
  // structured 503 NOT_READY (S-02) and the seam is never invoked. This form
  // is unreachable in production once routes.js registers its table at boot;
  // it guards the S-02 degradation semantics only (B-09).
  {
    const root = makeRoot();
    try {
      const spy = { startRunCalls: 0, startRunProbes: 0 };
      const orchestrator = new Proxy(
        {
          async listInstances() {
            return { ok: true, items: [] };
          },
          async getStatus() {
            return { ok: false, code: 'NOT_FOUND' };
          },
        },
        {
          // `startRun` is probed by createRoutes and stays non-callable: that
          // refusal is exactly what keeps the 503 fallback in force, and the
          // probe counter proves the seam was inspected but never invoked.
          get(target, prop, receiver) {
            if (prop === 'startRun') {
              spy.startRunProbes += 1;
              return undefined;
            }
            return Reflect.get(target, prop, receiver);
          },
        },
      );
      const store = createStore({ root });
      const bus = createEventBus({ store });
      const httpServer = createHttpServer({
        root,
        orchestrator,
        bus,
        graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
        staticRoot: root,
      });
      const listened = await httpServer.listen();
      assert.equal(listened.ok, true);
      try {
        const base = `http://127.0.0.1:${listened.port}`;
        const headers = { Authorization: `Bearer ${listened.token}` };
        for (const pathname of ['/instances', '/workflows']) {
          const res = await fetch(`${base}${pathname}`, { headers });
          assert.equal(res.status, 503);
          assert.deepEqual(JSON.parse(await res.text()), { error: 'NOT_READY' });
        }
        const post = await fetch(`${base}/instances`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: 'single', task: 'hello' }),
        });
        assert.equal(post.status, 503);
        assert.deepEqual(JSON.parse(await post.text()), { error: 'NOT_READY' });
        assert.equal(spy.startRunProbes > 0, true); // seam probed by the table builder
        assert.equal(spy.startRunCalls ?? 0, 0); // degradation never writes
        const instancesDir = path.join(root, '.orch', 'instances');
        assert.deepEqual(fs.existsSync(instancesDir) ? fs.readdirSync(instancesDir) : [], []);
      } finally {
        await httpServer.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  // Form 2 (takeover, decision H): after registerRoutes injects the WP-3
  // table built from routes.js createRoutes, the same paths answer 200 with
  // real orchestrator data; POST /instances reaches the orchestrator
  // exclusively through the existing startRun seam (AC-27).
  {
    const root = makeRoot();
    try {
      const spy = {};
      const snapshot = {
        template: 'single',
        state: 'running',
        nodes: [
          { nodeId: 'n1', roleId: 'coder', state: 'done' },
          { nodeId: 'n2', roleId: 'coder', state: 'running' },
        ],
        sessions: [],
        handoffs: [],
        pendingEscalations: 0,
        pendingApprovals: 1,
        health: { level: 'ok', reasons: [] },
        updatedAt: '2026-11-13T00:00:00.000Z',
      };
      const orchestrator = {
        async listInstances() {
          return { ok: true, items: [{ instanceId: 'INST-1', template: 'single', readable: true }] };
        },
        async getStatus(params) {
          return params?.instanceId === 'INST-1'
            ? { ok: true, snapshot }
            : { ok: false, code: 'NOT_FOUND' };
        },
        async startRun(params) {
          spy.startRunCalls = (spy.startRunCalls ?? 0) + 1;
          spy.lastStartRunParams = params ?? null;
          return { ok: true, instanceId: 'INST-NEW' };
        },
      };
      const store = createStore({ root });
      const bus = createEventBus({ store });
      const httpServer = createHttpServer({
        root,
        orchestrator,
        bus,
        graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
        staticRoot: root,
      });
      httpServer.registerRoutes(createRoutes({ orchestrator, root }));
      const listened = await httpServer.listen();
      assert.equal(listened.ok, true);
      try {
        const base = `http://127.0.0.1:${listened.port}`;
        const headers = { Authorization: `Bearer ${listened.token}` };
        const list = await fetch(`${base}/instances`, { headers });
        assert.equal(list.status, 200);
        const payload = await list.json();
        assert.equal(payload.items.length, 1);
        assert.deepEqual(payload.items[0], {
          instanceId: 'INST-1',
          template: 'single',
          templateTitle: TEMPLATE_LABEL.single,
          phase: 'running',
          progress: { done: 1, total: 2 },
          pending: { escalations: 0, approvals: 1 },
          health: { level: 'ok', reasons: [] },
          updatedAt: '2026-11-13T00:00:00.000Z',
          readable: true,
        });
        const workflows = await fetch(`${base}/workflows`, { headers });
        assert.equal(workflows.status, 200);
        const wf = await workflows.json();
        assert.deepEqual(wf.items.map((item) => item.id), ['single', 'code-loop', 'task-loop']);
        const post = await fetch(`${base}/instances`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: 'single', task: 'hello' }),
        });
        assert.equal(post.status, 200);
        assert.deepEqual(await post.json(), { instanceId: 'INST-NEW' });
        assert.equal(spy.startRunCalls, 1);
        assert.deepEqual(spy.lastStartRunParams, {
          cwd: root,
          task: 'hello',
          template: 'single',
          earlyReturn: true,
        });
      } finally {
        await httpServer.close();
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('without the http switch nothing listens and desktop.json never appears', async () => {
  const root = makeRoot();
  try {
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const server = createServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      generation: 'gen-wp2-ipc-only',
      exitOnStop: false,
    });
    const listened = await server.listen();
    assert.equal(listened.ok, true);
    try {
      assert.equal(server.isListening, true); // IPC main channel alive
      assert.equal(fs.existsSync(desktopMetaPath(root)), false);
      assert.equal(server.address().httpPort ?? null, null);
    } finally {
      await server.close();
    }
    assert.equal(fs.existsSync(desktopMetaPath(root)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('closing the server removes desktop.json (core.stop / SIGTERM path)', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    assert.equal(fs.existsSync(desktopMetaPath(root)), true);
    void meta;
    await server.close();
    assert.equal(fs.existsSync(desktopMetaPath(root)), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a desktop.json write failure fails the channel but not the IPC server', async () => {
  const root = makeRoot();
  try {
    fs.mkdirSync(desktopMetaPath(root), { recursive: true }); // path blocked by a directory
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const server = createServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      generation: 'gen-wp2-blocked',
      exitOnStop: false,
      http: true,
    });
    const listened = await server.listen();
    try {
      assert.equal(listened.ok, true); // IPC main channel unaffected (D-1)
      assert.equal(server.isListening, true);
      const stat = fs.statSync(desktopMetaPath(root));
      assert.equal(stat.isDirectory(), true); // never clobbered
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the desktop port listens on loopback only (lsof shows 127.0.0.1)', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    try {
      const probe = spawnSync('lsof', ['-nP', `-iTCP:${meta.port}`, '-sTCP:LISTEN'], {
        encoding: 'utf8',
      });
      assert.equal(probe.status, 0);
      const lines = probe.stdout.split('\n').filter((line) => line.includes(':') && !line.startsWith('COMMAND'));
      assert.ok(lines.length >= 1);
      for (const line of lines) {
        assert.match(line, /127\.0\.0\.1:\d+\s+\(LISTEN\)/);
        assert.doesNotMatch(line, /0\.0\.0\.0|\*:/);
      }
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unknown paths answer 404 with a code-only body', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startDesktopServer(root, fakeOrchestrator());
    try {
      const res = await fetch(`http://127.0.0.1:${meta.port}/nope`, {
        headers: { Authorization: `Bearer ${meta.token}` },
      });
      assert.equal(res.status, 404);
      assert.deepEqual(JSON.parse(await res.text()), { error: 'NOT_FOUND' });
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('decision R: the static face is public while the data plane stays Bearer-only', async () => {
  // Decision R (superseding decision M / B-25): the WebView's ES module
  // imports (`import './app.js'`) cannot carry a header or a query, so a GET
  // that resolves to a real file inside the static root is served without any
  // credential. Handler-owned paths (`/ui/labels`) keep refusing both the
  // missing header and the query credential.
  const root = makeRoot();
  try {
    const uiDir = path.join(root, 'ui-fixture');
    fs.mkdirSync(uiDir, { recursive: true });
    const page = '<html><body>desktop</body></html>';
    const script = 'export const boot = 1;\n';
    fs.writeFileSync(path.join(uiDir, 'index.html'), page);
    fs.writeFileSync(path.join(uiDir, 'app.js'), script);
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const httpServer = createHttpServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
      staticRoot: uiDir,
    });
    const listened = await httpServer.listen();
    assert.equal(listened.ok, true);
    try {
      const base = `http://127.0.0.1:${listened.port}`;
      const headers = { Authorization: `Bearer ${listened.token}` };

      const viaBearer = await fetch(`${base}/ui/index.html`, { headers });
      assert.equal(viaBearer.status, 200);
      const expected = await viaBearer.text();
      assert.equal(expected, page);

      const viaQuery = await fetch(`${base}/ui/index.html?token=${listened.token}`);
      assert.equal(viaQuery.status, 200);
      assert.equal(await viaQuery.text(), expected);

      // The top-level document and every module it imports are public.
      const anonymous = await fetch(`${base}/ui/index.html`);
      assert.equal(anonymous.status, 200);
      assert.equal(await anonymous.text(), expected);

      const scriptViaBearer = await fetch(`${base}/ui/app.js`, { headers });
      assert.equal(scriptViaBearer.status, 200);
      const moduleText = await scriptViaBearer.text();
      assert.equal(moduleText, script);
      const scriptAnonymous = await fetch(`${base}/ui/app.js`);
      assert.equal(scriptAnonymous.status, 200);
      assert.equal(await scriptAnonymous.text(), moduleText);

      // Data plane: no credential, and the query credential, both stay 401.
      const labelsAnonymous = await fetch(`${base}/ui/labels`);
      assert.equal(labelsAnonymous.status, 401);
      assert.deepEqual(JSON.parse(await labelsAnonymous.text()), { error: 'UNAUTHORIZED' });

      const labelsViaQuery = await fetch(`${base}/ui/labels?token=${listened.token}`);
      assert.equal(labelsViaQuery.status, 401);
      assert.deepEqual(JSON.parse(await labelsViaQuery.text()), { error: 'UNAUTHORIZED' });

      const instancesAnonymous = await fetch(`${base}/instances`);
      assert.equal(instancesAnonymous.status, 401);
      assert.deepEqual(JSON.parse(await instancesAnonymous.text()), { error: 'UNAUTHORIZED' });
    } finally {
      await httpServer.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('static /ui/* serves files read-only from the configured root', async () => {
  const root = makeRoot();
  try {
    const uiDir = path.join(root, 'ui-fixture');
    fs.mkdirSync(uiDir, { recursive: true });
    fs.writeFileSync(path.join(uiDir, 'index.html'), '<html><body>desktop</body></html>');
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const httpServer = createHttpServer({
      root,
      orchestrator: fakeOrchestrator(),
      bus,
      graph: { loadState: async () => ({ ok: false, code: 'NOT_FOUND' }) },
      staticRoot: uiDir,
    });
    const listened = await httpServer.listen();
    assert.equal(listened.ok, true);
    try {
      const headers = { Authorization: `Bearer ${listened.token}` };
      const page = await fetch(`http://127.0.0.1:${listened.port}/ui/index.html`, { headers });
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-type'), /text\/html/);
      assert.equal(await page.text(), '<html><body>desktop</body></html>');
      const traversal = await fetch(
        `http://127.0.0.1:${listened.port}/ui/..%2F..%2Fstate.json`,
        { headers },
      );
      assert.equal(traversal.status, 404);
    } finally {
      await httpServer.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
