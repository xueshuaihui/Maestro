/**
 * Connection throttle and session-indicator tests (I1.10a WP-2, AC-09/AC-10).
 *
 * AC-09: five connection changes inside one second produce exactly one
 * `connection.updated` frame carrying the LAST value; the window starts at
 * the first change and is never extended by later changes. The 1000/1001ms
 * boundary is asserted against a fully injected virtual clock (pure
 * scheduler, no real racing), per split doc risk 4.
 *
 * AC-10: session changes pass through as `session.indicator` frames only —
 * no role frames, no connection frames, `rev` unchanged, node objects (ids,
 * order, statuses) byte-identical across the pulse, i.e. no re-layout. The
 * geometry-level comparison lands with WP-5 layout.js (batch 3); until then
 * the projected node objects are the strongest available equality set.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConnectionThrottle, parseSseBlock } from '../../src/daemon/http/stream.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createServer } from '../../src/daemon/server.js';
import { desktopMetaPath } from '../../src/daemon/http/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/**
 * Virtual clock harness: a manual timer queue driven by `advance`.
 * `now()` returns the current virtual time; `setTimer` schedules at
 * `virtualNow + delayMs` exactly (so the window boundary is deterministic).
 */
function virtualClock() {
  let nowMs = 0;
  let nextId = 1;
  const timers = new Map(); // id -> {fireAt, fn}
  return {
    now: () => nowMs,
    advance(ms) {
      nowMs += ms;
      const due = [...timers.values()]
        .filter((timer) => timer.fireAt <= nowMs)
        .sort((a, b) => a.fireAt - b.fireAt || a.id - b.id);
      for (const timer of due) {
        timers.delete(timer.id);
        timer.fn();
      }
    },
    setTimer(fn, delayMs) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { id, fireAt: nowMs + delayMs, fn });
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    pendingCount: () => timers.size,
  };
}

function makeThrottle(clock, emitted) {
  return createConnectionThrottle({
    windowMs: 1000,
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    emit: (key, payload) => emitted.push({ key, payload, at: clock.now() }),
  });
}

test('AC-09 boundary: 1000ms after the FIRST change fires exactly once with the last value', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);

  // Five changes inside the window (0, 40, 80, 120, 160 virtual ms).
  throttle.push('E-01', { aggregateStatus: 'accepted' });
  clock.advance(40);
  throttle.push('E-01', { aggregateStatus: 'pending' });
  clock.advance(40);
  throttle.push('E-01', { aggregateStatus: 'rejected' });
  clock.advance(40);
  throttle.push('E-01', { aggregateStatus: 'consumed' });
  clock.advance(40);
  throttle.push('E-01', { aggregateStatus: 'expired' });

  // Nothing has fired before the window ends (999ms).
  clock.advance(839); // now 999
  assert.equal(emitted.length, 0);

  // Window ends at 1000ms counted from the FIRST change: the later changes
  // did not extend it (a broken implementation would fire at 1160ms).
  clock.advance(1); // now 1000
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].key, 'E-01');
  assert.deepEqual(emitted[0].payload, { aggregateStatus: 'expired' });
  assert.equal(emitted[0].at, 1000);
});

test('AC-09 boundary: a single change still fires at the window end (never lost)', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);
  throttle.push('E-01', { aggregateStatus: 'delivered' });
  clock.advance(999);
  assert.equal(emitted.length, 0);
  clock.advance(1);
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].at, 1000);
  assert.deepEqual(emitted[0].payload, { aggregateStatus: 'delivered' });
});

test('AC-09 boundary: a change at 1001ms opens a NEW window ending at 2001ms', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);
  throttle.push('E-01', { aggregateStatus: 'accepted' }); // t=0
  clock.advance(1000); // t=1000: first window ends
  assert.equal(emitted.length, 1);
  clock.advance(1); // t=1001: the next change lands one ms past the boundary
  throttle.push('E-01', { aggregateStatus: 'consumed' });
  clock.advance(998); // t=1999: still pending
  assert.equal(emitted.length, 1);
  clock.advance(1); // t=2000: window ends at 2001, not 2000
  assert.equal(emitted.length, 1);
  clock.advance(1); // t=2001
  assert.equal(emitted.length, 2);
  assert.equal(emitted[1].at, 2001);
  assert.deepEqual(emitted[1].payload, { aggregateStatus: 'consumed' });
});

test('AC-09: different keys keep independent windows', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);
  throttle.push('E-01', { aggregateStatus: 'accepted' });
  clock.advance(400);
  throttle.push('E-02', { aggregateStatus: 'expired' });
  clock.advance(600); // t=1000
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].key, 'E-01');
  clock.advance(400); // t=1400
  assert.equal(emitted.length, 2);
  assert.equal(emitted[1].key, 'E-02');
});

test('AC-09: flush() emits every pending window immediately with the last value', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);
  throttle.push('E-01', { aggregateStatus: 'accepted' });
  clock.advance(100);
  throttle.push('E-01', { aggregateStatus: 'rejected' });
  throttle.push('E-02', { aggregateStatus: 'consumed' });
  throttle.flush();
  assert.equal(emitted.length, 2);
  assert.deepEqual(emitted.find((entry) => entry.key === 'E-01').payload, {
    aggregateStatus: 'rejected',
  });
  assert.equal(throttle.pendingCount(), 0);
});

test('the pure scheduler is injectable end-to-end (no hidden real timers)', () => {
  const clock = virtualClock();
  const emitted = [];
  const throttle = makeThrottle(clock, emitted);
  throttle.push('E-01', { value: 1 });
  // No virtual time has passed: nothing may have fired, proving the scheduler
  // never borrowed a real timer behind the injected clock.
  assert.equal(emitted.length, 0);
  assert.equal(clock.pendingCount(), 1);
  throttle.close();
  assert.equal(clock.pendingCount(), 0);
});

test('the AC-09/AC-37 lanes stay separated in code: role frames bypass the throttle', () => {
  // Structural guard for the AC-37 architecture check: the immediate fan-out
  // path must not route through any throttling queue.
  const source = fs.readFileSync(path.join(REPO, 'src', 'daemon', 'http', 'stream.js'), 'utf8');
  const fanOutBody = source.slice(source.indexOf('function fanOut'), source.indexOf('/** Maps one whitelisted bus event'));
  assert.ok(fanOutBody.includes("kind === 'connection'"));
  assert.match(
    fanOutBody,
    /if \(kind === 'connection'\) stream\.throttle\.push/,
    'connection frames must enter the merge lane',
  );
  const immediateBranch = fanOutBody.split("if (kind === 'connection')")[1];
  assert.match(
    immediateBranch,
    /else writeSse\(/,
    'role/special/session frames must be written immediately',
  );
});

// ---------------------------------------------------------------------------
// HTTP-level AC-09 / AC-10: the same assertions against a live channel.
// ---------------------------------------------------------------------------

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
  - id: H-001
    node_type: human
    title: Review
    order: 2
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-wp2-throttle-'));
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
    generation: 'gen-wp2-throttle',
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

test('AC-09 live: five changes within 200ms collapse into exactly one frame with the last value', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const stream = await openGraphStream(meta);
      await stream.waitFor('graph.snapshot');

      const t0 = Date.now();
      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'connection',
        key: 'E-01',
        count: 5,
        intervalMs: 40,
        statuses: ['accepted', 'pending', 'rejected', 'consumed', 'expired'],
      });
      // The merged frame fires at ~1000ms after the first change; 1.5s of
      // quiet must contain exactly one connection.updated frame for E-01.
      await delay(1500);
      const frames = stream.frames.filter(
        (frame) => frame.event === 'connection.updated' && frame.data.key === 'E-01',
      );
      assert.equal(frames.length, 1);
      const frame = frames[0];
      assert.equal(frame.data.payload.aggregateStatus, 'expired');
      assert.deepEqual(frame.data.payload.visual, {
        color: 'orange',
        dash: 'dashed',
        arrow: 'forward',
        animation: 'none',
        badge: '!',
      });
      assert.ok(frame.data.rev >= 1);
      assert.ok(Date.now() - t0 >= 1000); // window truly elapsed, not rushed
      await stream.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('AC-10 live: session pulses move the indicator only, rev and nodes stay put', async () => {
  const root = makeRoot();
  try {
    const { server, meta } = await startServer(root);
    try {
      const headers = { Authorization: `Bearer ${meta.token}` };
      const before = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph`, { headers });
      const graphBefore = await before.json();

      const stream = await openGraphStream(meta);
      await stream.waitFor('graph.snapshot');

      await pulse(meta, {
        instanceId: 'INST-001',
        kind: 'session',
        key: 'SESS-1',
        count: 5,
        intervalMs: 40,
        statuses: ['tool_running', 'thinking', 'tool_running', 'idle', 'waiting_input'],
      });
      await delay(1500);

      const roleFrames = stream.frames.filter((frame) => frame.event === 'role_instance.updated');
      const connectionFrames = stream.frames.filter(
        (frame) => frame.event === 'connection.updated',
      );
      const indicatorFrames = stream.frames.filter(
        (frame) => frame.event === 'session.indicator',
      );
      assert.equal(roleFrames.length, 0);
      assert.equal(connectionFrames.length, 0);
      assert.ok(indicatorFrames.length >= 1 && indicatorFrames.length <= 5);
      for (const frame of indicatorFrames) {
        assert.equal(frame.data.type, 'session.indicator');
        assert.equal(frame.data.key, 'SESS-1');
        assert.equal(frame.data.rev, graphBefore.rev); // rev never moved
        assert.ok(typeof frame.data.payload.state === 'string');
      }

      const after = await fetch(`http://127.0.0.1:${meta.port}/instances/INST-001/graph`, { headers });
      const graphAfter = await after.json();
      assert.equal(graphAfter.rev, graphBefore.rev); // rev_before === rev_after
      assert.deepEqual(graphAfter.nodes, graphBefore.nodes); // no re-layout, no reorder
      assert.deepEqual(graphAfter.edges, graphBefore.edges);
      await stream.close();
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
