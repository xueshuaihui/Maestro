import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../../src/daemon/server.js';
import { createClient } from '../../src/daemon/client.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { coreMetaPath, pipeName as pipeNameFor } from '../../src/persistence/paths.js';

const tempDirs = [];

after(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

async function makeRoot(tag) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `maestro-wp5-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

/** 假 orchestrator：实现 §2.12 冻结的方法表（run.start 早返回 + stream 推进）。 */
function createFakeOrchestrator({ bus, generation } = {}) {
  const calls = [];
  return {
    calls,
    async startRun({ cwd, task, instanceId = 'INST-001', onProgress }) {
      calls.push({ method: 'startRun', cwd, task, instanceId });
      if (typeof onProgress === 'function') onProgress({ phase: 'session.created', sessionId: 'sess-001' });
      const stream = (async function* withBus() {
        yield { object: 'node', objectId: 'T-001', from: 'pending', to: 'running', result: 'applied', reason: 'run.start' };
        yield { object: 'node', objectId: 'T-001', from: 'running', to: 'review', result: 'applied', reason: 'turn.settled' };
      })();
      return { ok: true, instanceId, nodeId: 'T-001', sessionId: 'sess-001', stream };
    },
    async cancel({ instanceId }) {
      calls.push({ method: 'cancel', instanceId });
      return { ok: true, session: { state: 'idle' }, node: { state: 'cancelled' }, handoff: { state: 'rejected' } };
    },
    async getStatus({ instanceId }) {
      calls.push({ method: 'getStatus', instanceId });
      return { ok: true, snapshot: { instanceId, state: 'running', node: { state: 'running' } } };
    },
    async listInstances() {
      calls.push({ method: 'listInstances' });
      return { ok: true, items: [{ instanceId: 'INST-001', state: 'running' }] };
    },
    async reconcileOnBoot({ generation: gen }) {
      calls.push({ method: 'reconcileOnBoot', generation: gen });
      return { ok: true, interrupted: ['INST-090', 'INST-091'] };
    },
    async interruptAll({ reason }) {
      calls.push({ method: 'interruptAll', reason });
      return { ok: true, interrupted: ['INST-001'] };
    },
    async dispose() {
      calls.push({ method: 'dispose' });
    },
  };
}

async function boot(tag, overrides = {}) {
  const root = await makeRoot(tag);
  const bus = createEventBus({ store: createStore({ root }) });
  const orchestrator = createFakeOrchestrator({ bus, generation: 'gen-test' });
  const server = createServer({
    root,
    bus,
    orchestrator,
    generation: 'gen-test',
    logger: () => {},
    ...overrides,
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  const client = createClient({ root });
  const connected = await client.connect({ ensure: false });
  assert.equal(connected.ok, true, JSON.stringify(connected));
  return { root, bus, orchestrator, server, client, listened };
}

test('listen：写 core.json、绑定管道，并完成启动对账', async () => {
  const { root, client, orchestrator, listened, server } = await boot('listen');
  try {
    assert.equal(listened.pipeName, pipeNameFor(root));
    assert.equal(listened.generation, 'gen-test');

    const meta = JSON.parse(await fs.readFile(coreMetaPath(root), 'utf8'));
    assert.equal(meta.pipeName, listened.pipeName);
    assert.equal(meta.pid, process.pid);
    assert.equal(meta.generation, 'gen-test');
    assert.ok(meta.startedAt);
    assert.equal(meta.version, 1);

    assert.equal(orchestrator.calls.some((c) => c.method === 'reconcileOnBoot'), true);

    const pong = await client.ping();
    assert.equal(pong.ok, true);
    assert.equal(pong.result.pid, process.pid);
    assert.equal(pong.result.generation, 'gen-test');
    assert.equal(pong.result.interrupted, 2);
  } finally {
    await client.close();
    await server.close();
  }
});

test('重复 listen：活核心占着管道时返回 CORE_ALREADY_RUNNING', async () => {
  const { server, client } = await boot('eeexist');
  try {
    const otherRoot = await makeRoot('second');
    const second = createServer({
      root: otherRoot,
      orchestrator: createFakeOrchestrator(),
      bus: createEventBus({ store: createStore({ root: otherRoot }) }),
      pipeName: server.pipeName,
      logger: () => {},
    });
    const res = await second.listen();
    assert.equal(res.ok, false);
    assert.equal(res.code, 'CORE_ALREADY_RUNNING');
    assert.equal(res.params.pipeName, server.pipeName);
    await second.close();
  } finally {
    await client.close();
    await server.close();
  }
});

test('未知方法：返回 IPC_BAD_METHOD，服务端不崩且后续请求正常', async () => {
  const { client, server } = await boot('badmethod');
  try {
    const res = await client.request('no.such.method', {});
    assert.equal(res.ok, false);
    assert.equal(res.code, 'IPC_BAD_METHOD');
    assert.equal(res.params.method, 'no.such.method');

    const again = await client.ping();
    assert.equal(again.ok, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('坏帧 / 非法帧不杀连接：发一段垃圾后 ping 仍可用', async () => {
  const { root, client, server } = await boot('garbage', {});
  try {
    const net = await import('node:net');
    const socket = net.connect(pipeNameFor(root));
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.write('not-json\n');
    socket.write('{"v":9,"kind":"req","id":"c-9","method":"core.ping"}\n');
    await new Promise((r) => setTimeout(r, 50));
    socket.destroy();

    const pong = await client.ping();
    assert.equal(pong.ok, true);
  } finally {
    await client.close();
    await server.close();
  }
});

test('instance.subscribe：bus.emit 一条即推 evt 帧，seq 正确', async () => {
  const { client, bus, server } = await boot('subscribe');
  try {
    const received = [];
    const off = client.subscribe('INST-001', (event) => received.push(event));
    // 订阅请求是异步发出的，等它落地（重复订阅在服务端幂等）。
    await client.request('instance.subscribe', { instanceId: 'INST-001' });

    const emitted = await bus.emit({
      instanceId: 'INST-001',
      object: 'node',
      objectId: 'T-001',
      from: 'running',
      to: 'review',
      result: 'applied',
      reason: 'turn.settled',
      gen: 'gen-test',
    });
    assert.equal(emitted.ok, true);

    const deadline = Date.now() + 2000;
    while (received.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(received.length, 1);
    assert.equal(received[0].seq, emitted.seq);
    assert.equal(received[0].to, 'review');
    off();
  } finally {
    await client.close();
    await server.close();
  }
});

test('run.start：先回包 {instanceId,nodeId,sessionId}，stream 进展转成 evt', async () => {
  const { client, orchestrator, server } = await boot('runstart');
  try {
    const received = [];
    client.subscribe('INST-001', (event) => received.push(event));
    await client.request('instance.subscribe', { instanceId: 'INST-001' });

    const res = await client.request('run.start', { cwd: '.', task: '写一段说明' });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(res.result, { instanceId: 'INST-001', nodeId: 'T-001', sessionId: 'sess-001' });
    assert.ok(orchestrator.calls.some((c) => c.method === 'startRun'));

    const deadline = Date.now() + 2000;
    while (received.length < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert.equal(received.length, 2);
    assert.equal(received[0].seq, 1);
    assert.equal(received[1].seq, 2);
    assert.equal(received[1].to, 'review');
  } finally {
    await client.close();
    await server.close();
  }
});

test('instance.get / list / events / cancel 直通 orchestrator', async () => {
  const { client, bus, server } = await boot('instance-api');
  try {
    const got = await client.request('instance.get', { instanceId: 'INST-001' });
    assert.equal(got.ok, true);
    assert.equal(got.result.instanceId, 'INST-001');

    const listed = await client.request('instance.list', {});
    assert.equal(listed.ok, true);
    assert.equal(listed.result.items.length, 1);

    await bus.emit({
      instanceId: 'INST-001',
      object: 'instance',
      objectId: 'INST-001',
      from: 'created',
      to: 'running',
      result: 'applied',
      reason: 'run.start',
      gen: 'gen-test',
    });
    const events = await client.request('instance.events', { instanceId: 'INST-001' });
    assert.equal(events.ok, true);
    assert.equal(events.result.events.length, 1);
    assert.equal(events.result.events[0].seq, 1);

    const since = await client.request('instance.events', { instanceId: 'INST-001', sinceSeq: 1 });
    assert.equal(since.result.events.length, 0);

    const cancelled = await client.request('instance.cancel', { instanceId: 'INST-001' });
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.result.node.state, 'cancelled');

    const missing = await client.request('instance.get', {});
    assert.equal(missing.ok, false);
    assert.equal(missing.code, 'IPC_BAD_PARAMS');
  } finally {
    await client.close();
    await server.close();
  }
});

test('core.stop：先回包再断连，5s 内收敛，core.json 仍可读', async () => {
  const { root, client, server, orchestrator } = await boot('stop', { exitOnStop: false });
  try {
    const t0 = Date.now();
    const res = await client.request('core.stop', {}, { timeoutMs: 2000 });
    assert.equal(res.ok, true);
    assert.equal(res.result.pid, process.pid);

    const closed = await client.waitForClose(5000);
    assert.equal(closed.ok, true);
    assert.ok(Date.now() - t0 < 5000);

    assert.equal(orchestrator.calls.some((c) => c.method === 'interruptAll'), true);
    assert.equal(orchestrator.calls.some((c) => c.method === 'dispose'), true);

    const meta = JSON.parse(await fs.readFile(coreMetaPath(root), 'utf8'));
    assert.equal(meta.pid, process.pid);
  } finally {
    await client.close();
    await server.close();
  }
});
