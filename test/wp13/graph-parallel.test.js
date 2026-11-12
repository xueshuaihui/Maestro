/**
 * Parallel lane test (I1.10a WP-2, AC-37): a role change and five connection
 * changes inside the same one-second window must both arrive, neither lost,
 * neither blocking the other — the role frame within 500ms of the trigger
 * while the connection window is still pending, and the merged connection
 * frame within 1200ms carrying the last value.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSseBlock } from '../../src/daemon/http/stream.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createServer } from '../../src/daemon/server.js';
import { desktopMetaPath } from '../../src/daemon/http/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
edges:
  - from: T-001
    to: T-002
    kind: forward
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
      { nodeId: 'T-001', roleId: 'alpha', state: 'running', round: 1, stateSince: '2026-01-01T00:01:00.000Z' },
      { nodeId: 'T-002', roleId: 'beta', state: 'pending', round: 0 },
    ],
    sessions: [
      { sessionId: 'SESS-1', nodeId: 'T-001', state: 'idle', hostId: 'dsh', createdAt: '2026-01-01T00:01:10.000Z' },
    ],
    handoffs: [
      { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
    ],
    escalations: [],
    health: { level: 'normal', reasons: [], computedAt: '2026-01-01T00:10:00.000Z' },
  };
}

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp2-parallel-'));
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
  const server = createServer({
    root,
    orchestrator: fakeOrchestrator(),
    bus,
    generation: 'gen-wp2-parallel',
    exitOnStop: false,
    http: true,
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true);
  const meta = JSON.parse(fs.readFileSync(desktopMetaPath(root), 'utf8'));
  fs.mkdirSync(path.join(root, '.orch', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'workflows', 'release-flow.yaml'), RELEASE_FLOW_YAML);
  const saved = await store.save('INST-001', fixtureState());
  assert.equal(saved.ok, true);
  return { server, meta };
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

async function openGraphStream(meta) {
  const res = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph/stream`, {
    headers: { Authorization: `Bearer ${meta.token}` },
  });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
  })();
  return {
    frames,
    async waitFor(eventName, timeoutMs = 4000) {
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

test('AC-37: role and connection changes in one window both arrive, neither blocking', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const stream = await openGraphStream(meta);
      const snapshot = await stream.waitFor('graph.snapshot');
      assert.ok(snapshot);

      const tTrigger = Date.now();
      // One role change first, then five connection changes inside 200ms —
      // all inside the same one-second merge window (requirement AC-37 When).
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'role',
        key: 'alpha',
        count: 1,
        statuses: ['cooldown'],
      });
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'connection',
        key: 'E-01',
        count: 5,
        intervalMs: 40,
        statuses: ['accepted', 'pending', 'rejected', 'consumed', 'expired'],
      });

      const roleFrame = await stream.waitFor('role_instance.updated');
      assert.ok(roleFrame, 'role frame must arrive');
      const tRole = Date.now();
      assert.equal(roleFrame.data.key, 'role:alpha');
      assert.equal(roleFrame.data.payload.status, 'cooldown');
      assert.ok(tRole - tTrigger <= 500, `role frame took ${tRole - tTrigger}ms (>500ms)`);

      // The role frame arrived while the connection window was still pending:
      // no connection frame may exist yet at this moment (non-blocking proof).
      const connectionSoFar = stream.frames.filter(
        (frame) => frame.event === 'connection.updated',
      );
      assert.equal(connectionSoFar.length, 0);

      const connectionFrame = await stream.waitFor('connection.updated');
      assert.ok(connectionFrame, 'connection frame must arrive');
      const tConn = Date.now();
      assert.equal(connectionFrame.data.key, 'E-01');
      assert.equal(connectionFrame.data.payload.aggregateStatus, 'expired'); // last value wins
      assert.ok(tConn - tTrigger <= 1200, `connection frame took ${tConn - tTrigger}ms (>1200ms)`);
      assert.ok(tConn - tTrigger >= 900, 'the merged window must actually elapse');

      // Both lanes delivered exactly one frame each: nothing lost, no floods.
      const roleFrames = stream.frames.filter((frame) => frame.event === 'role_instance.updated');
      const connectionFrames = stream.frames.filter(
        (frame) => frame.event === 'connection.updated',
      );
      assert.equal(roleFrames.length, 1);
      assert.equal(connectionFrames.length, 1);
      await stream.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
