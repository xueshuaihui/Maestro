/**
 * Graph stream contract tests (I1.10a WP-2, AC-08).
 *
 * - `GET /instances/:id/graph` reuses the frozen `buildGraph` projection and
 *   answers with the full snapshot payload.
 * - `GET /instances/:id/graph/stream` opens with `graph.snapshot`, delivers a
 *   role frame within 500ms of the pulse, and on reconnect always opens with
 *   `graph.snapshot` again (no incremental stacking after a disconnect).
 * - `sinceRev` replays buffered whitelist frames after the snapshot.
 * - The pulse seam (`POST /__test__/graph/pulse`, NODE_ENV=test only) drives
 *   the in-memory test projection; state.json / events.jsonl stay untouched.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createServer } from '../../src/daemon/server.js';
import { desktopMetaPath } from '../../src/daemon/http/server.js';
import { parseSseBlock } from '../../src/daemon/http/stream.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const RELEASE_FLOW_YAML = `workflow: release-flow
title: Release Flow
nodes:
  - id: T-001
    node_type: role
    role: alpha
    title: Alpha
    order: 0
  - id: T-002
    node_type: role
    role: beta
    title: Beta
    order: 1
  - id: T-003
    node_type: role
    role: gamma
    title: Gamma
    order: 2
  - id: H-001
    node_type: human
    title: Review
    order: 3
  - id: X-001
    node_type: escalate
    title: Decide
    order: 4
  - id: S-001
    node_type: subworkflow
    title: Publish
    workflow: publish-child
    order: 5
edges:
  - from: T-001
    to: T-002
    kind: forward
  - from: T-002
    to: T-003
    kind: forward
  - from: T-003
    to: H-001
    kind: forward
  - from: H-001
    to: X-001
    kind: forward
  - from: X-001
    to: S-001
    kind: forward
  - from: T-003
    to: T-001
    kind: backflow
`;

const PUBLISH_CHILD_YAML = `workflow: publish-child
title: Publish Child
nodes:
  - id: C-001
    node_type: role
    role: pack-a
    order: 0
  - id: C-002
    node_type: role
    role: pack-b
    order: 1
edges:
  - from: C-001
    to: C-002
`;

function fixtureState() {
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    template: 'release-flow',
    state: 'running',
    workflowRef: 'release-flow',
    cwd: '/tmp',
    paused: false,
    rev: 0,
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'alpha', state: 'done', round: 1, stateSince: '2026-01-01T00:01:00.000Z' },
      { nodeId: 'T-002', roleId: 'beta', state: 'running', round: 1, stateSince: '2026-01-01T00:02:00.000Z' },
      { nodeId: 'T-003', roleId: 'gamma', state: 'pending', round: 0 },
    ],
    sessions: [
      { sessionId: 'SESS-1', nodeId: 'T-002', state: 'tool_running', hostId: 'dsh', createdAt: '2026-01-01T00:02:10.000Z' },
    ],
    handoffs: [
      { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
      { handoffId: 'HO-002', edge: { from: 'T-003', to: 'T-001', kind: 'backflow' }, state: 'rejected', round: 2 },
    ],
    escalations: [],
    health: { level: 'normal', reasons: [], computedAt: '2026-01-01T00:10:00.000Z' },
  };
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp2-stream-'));
}

function fakeOrchestrator() {
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
    async startRun() {
      return { ok: false, code: 'IPC_BAD_PARAMS' };
    },
    async waitForRun() {
      return { ok: false, code: 'NOT_RUNNING' };
    },
  };
}

async function startServer(root) {
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orchestrator = fakeOrchestrator();
  const server = createServer({
    root,
    orchestrator,
    bus,
    generation: 'gen-wp2-stream',
    exitOnStop: false,
    http: true,
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true);
  const meta = JSON.parse(fs.readFileSync(desktopMetaPath(root), 'utf8'));

  fs.mkdirSync(path.join(root, '.orch', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'workflows', 'release-flow.yaml'), RELEASE_FLOW_YAML);
  fs.writeFileSync(path.join(root, '.orch', 'workflows', 'publish-child.yaml'), PUBLISH_CHILD_YAML);
  const saved = await store.save('INST-001', fixtureState());
  assert.equal(saved.ok, true);
  // Two whitelisted disk events -> rev 2 (session events later stay below).
  const e1 = await bus.emit({
    instanceId: 'INST-001',
    object: 'node',
    objectId: 'T-002',
    from: 'pending',
    to: 'running',
    result: 'note',
    reason: 'node.dispatch',
  });
  assert.equal(e1.ok, true);
  const e2 = await bus.emit({
    instanceId: 'INST-001',
    object: 'handoff',
    objectId: 'HO-001',
    from: 'pending',
    to: 'delivered',
    result: 'note',
    reason: 'handoff.delivered',
  });
  assert.equal(e2.ok, true);
  return { server, bus, meta };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pulse(meta, body) {
  const res = await fetch(`http://127.0.0.1:${meta.port}/__test__/graph/pulse`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 200);
  return res.json();
}

/** Opens a graph stream and parses SSE frames incrementally. */
async function openGraphStream(meta, { sinceRev } = {}) {
  const query = Number.isFinite(sinceRev) ? `?sinceRev=${sinceRev}` : '';
  const res = await fetch(
    `http://127.0.0.1:${meta.port}/instances/INST-001/graph/stream${query}`,
    { headers: { Authorization: `Bearer ${meta.token}` } },
  );
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let closed = false;
  const frames = [];
  const pump = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const frame = parseSseBlock(block);
          if (frame) frames.push(frame);
        }
      }
    } catch {
      // connection closed
    }
    closed = true;
  })();
  return {
    frames,
    isClosed: () => closed,
    async waitFor(eventName, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = frames.find((frame) => frame.event === eventName);
        if (found) return found;
        await delay(15);
      }
      return frames.find((frame) => frame.event === eventName) ?? null;
    },
    async close() {
      try {
        await reader.cancel();
      } catch {
        // already gone
      }
      await pump.catch(() => {});
    },
  };
}

test('GET /instances/:id/graph reuses the frozen buildGraph projection', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const res = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph`, {
        headers: { Authorization: `Bearer ${meta.token}` },
      });
      assert.equal(res.status, 200);
      const graph = await res.json();
      assert.equal(graph.rev, 2);
      assert.equal(graph.instanceId, 'INST-001');
      assert.equal(graph.template, 'release-flow');
      assert.equal(graph.state, 'running');
      assert.deepEqual(graph.workflow, { ref: 'release-flow', readable: true });
      assert.equal(graph.nodes.length, 6); // 3 roles + human + escalate + subworkflow
      assert.equal(graph.edges.length, 6);
      for (const node of graph.nodes) {
        assert.ok(['role', 'human', 'escalate', 'subworkflow'].includes(node.type));
        assert.ok(node.status !== undefined);
      }
      for (const edge of graph.edges) {
        assert.ok(['forward', 'backflow'].includes(edge.direction));
        assert.ok(typeof edge.aggregateStatus === 'string');
        assert.ok(edge.visual);
      }
      const backflow = graph.edges.find((edge) => edge.direction === 'backflow');
      assert.equal(backflow.aggregateStatus, 'rejected');
      const roleBeta = graph.nodes.find((node) => node.roleId === 'beta');
      assert.equal(roleBeta.status, 'serving');
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unknown instance answers 404, corrupt state answers 422', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const headers = { Authorization: `Bearer ${meta.token}` };
      const missing = await fetch(`http://127.0.0.1:${meta.port}/instances/NOPE/graph`, { headers });
      assert.equal(missing.status, 404);
      assert.deepEqual(JSON.parse(await missing.text()), { error: 'NOT_FOUND' });

      const streamMissing = await fetch(
        `http://127.0.0.1:${meta.port}/instances/NOPE/graph/stream`,
        { headers },
      );
      assert.equal(streamMissing.status, 404);

      const stateFile = path.join(root, '.orch', 'instances', 'INST-001', 'state.json');
      fs.writeFileSync(stateFile, '{not json');
      const corrupt = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph`, { headers });
      assert.equal(corrupt.status, 422);
      assert.deepEqual(JSON.parse(await corrupt.text()), { error: 'STATE_CORRUPT' });
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('AC-08: first frame is the full snapshot, role frame arrives within 500ms', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const stream = await openGraphStream(meta);
      const first = await stream.waitFor('graph.snapshot');
      assert.ok(first, 'expected a graph.snapshot first frame');
      assert.equal(first.data.type, 'snapshot');
      assert.equal(first.data.instanceId, 'INST-001');
      assert.equal(first.data.rev, 2);
      assert.equal(first.data.payload.nodes.length, 6);
      assert.equal(first.data.payload.edges.length, 6);

      const t0 = Date.now();
      const pulseRes = await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'role',
        key: 'beta',
        count: 1,
        statuses: ['available'],
      });
      assert.equal(pulseRes.injected, 1);
      const roleFrame = await stream.waitFor('role_instance.updated');
      assert.ok(roleFrame, 'expected a role_instance.updated frame');
      const elapsed = Date.now() - t0;
      assert.ok(elapsed <= 500, `role frame took ${elapsed}ms (>500ms)`);
      assert.equal(roleFrame.data.type, 'role_instance.updated');
      assert.equal(roleFrame.data.key, 'role:beta');
      assert.equal(roleFrame.data.payload.status, 'available');
      assert.equal(roleFrame.data.rev, 3); // pulse advances rev via the projection

      // Other nodes did not flash: exactly one element frame after the pulse.
      const elementFrames = stream.frames.filter((frame) =>
        ['role_instance.updated', 'connection.updated', 'special_node.updated'].includes(frame.event),
      );
      assert.equal(elementFrames.length, 1);

      await stream.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('AC-08: reconnect always reopens with a full snapshot matching the REST view', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const first = await openGraphStream(meta);
      await first.waitFor('graph.snapshot');
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'role',
        key: 'beta',
        count: 1,
        statuses: ['cooldown'],
      });
      await first.waitFor('role_instance.updated');
      await first.close();

      const rest = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph`, {
        headers: { Authorization: `Bearer ${meta.token}` },
      });
      const restGraph = await rest.json();

      const second = await openGraphStream(meta);
      const snapshot = await second.waitFor('graph.snapshot');
      assert.ok(snapshot, 'reconnected stream must open with graph.snapshot');
      assert.equal(snapshot.data.payload.nodes.length, restGraph.nodes.length);
      assert.equal(snapshot.data.payload.rev, restGraph.rev);
      const roleBeta = snapshot.data.payload.nodes.find((node) => node.roleId === 'beta');
      assert.equal(roleBeta.status, 'cooldown'); // latest state, no stale layers
      await second.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sinceRev replays buffered whitelist frames after the snapshot', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const stream = await openGraphStream(meta);
      const snapshot = await stream.waitFor('graph.snapshot');
      const beforeRev = snapshot.data.rev;
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'connection',
        key: 'E-01',
        count: 1,
        statuses: ['accepted'],
      });
      const connectionFrame = await stream.waitFor('connection.updated');
      assert.ok(connectionFrame);
      assert.equal(connectionFrame.data.key, 'E-01');
      await stream.close();

      const reconnect = await openGraphStream(meta, { sinceRev: beforeRev });
      await reconnect.waitFor('graph.snapshot');
      const replayed = await reconnect.waitFor('connection.updated', 500);
      assert.ok(replayed, 'buffered connection frame must replay after sinceRev');
      assert.equal(replayed.data.key, 'E-01');
      assert.ok(replayed.data.rev > beforeRev);
      await reconnect.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the pulse seam never writes state.json or events.jsonl (AC-27 hash rule)', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const stateFile = path.join(root, '.orch', 'instances', 'INST-001', 'state.json');
      const eventsFile = path.join(root, '.orch', 'instances', 'INST-001', 'events.jsonl');
      const stateHash = fs.readFileSync(stateFile);
      const eventsHash = fs.readFileSync(eventsFile);
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'role',
        key: 'beta',
        count: 2,
        intervalMs: 20,
        statuses: ['serving', 'cooldown'],
      });
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'connection',
        key: 'E-01',
        count: 3,
        intervalMs: 20,
        statuses: ['accepted', 'pending', 'consumed'],
      });
      await delay(300);
      assert.deepEqual(fs.readFileSync(stateFile), stateHash);
      assert.deepEqual(fs.readFileSync(eventsFile), eventsHash);
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('non-test environments never register the pulse route', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      // This suite always runs with NODE_ENV=test; the registration guard is
      // asserted structurally so the guarantee does not depend on the env.
      const source = fs.readFileSync(
        path.join(REPO, 'src', 'daemon', 'http', 'server.js'),
        'utf8',
      );
      assert.match(
        source,
        /process\.env\.NODE_ENV !== 'test'[\s\S]{0,80}sendError\(res, 404, 'NOT_FOUND'\)/,
      );
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
