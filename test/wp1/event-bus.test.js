import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createEventBus } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

const tempDirs = [];

async function makeBus(extra = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp1-bus-'));
  tempDirs.push(dir);
  const store = createStore({ root: dir });
  return { root: dir, store, bus: createEventBus({ store, ...extra }) };
}

after(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function transition(overrides = {}) {
  return {
    object: 'instance',
    objectId: 'INST-001',
    from: 'created',
    to: 'running',
    result: 'applied',
    reason: 'run.start',
    gen: 'gen-test',
    ...overrides,
  };
}

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

test('emit 先落盘后广播，ts/seq 由总线补齐', async () => {
  const { root, store, bus } = await makeBus();
  const received = [];
  const off = bus.subscribe((ev) => received.push(ev), { instanceId: 'INST-001' });

  const res = await bus.emit({ instanceId: 'INST-001', ...transition() });

  assert.equal(res.ok, true);
  assert.equal(res.seq, 1);
  assert.match(res.ts, ISO_MS);

  assert.equal(received.length, 1);
  assert.equal(received[0].seq, 1);
  assert.equal(received[0].ts, res.ts);
  assert.equal(received[0].object, 'instance');
  // instanceId 只是路由键，不进落盘行也不进广播体。
  assert.equal('instanceId' in received[0], false);

  const lines = (await fs.readFile(eventsPath(root, 'INST-001'), 'utf8')).split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 1);
  const line = JSON.parse(lines[0]);
  assert.equal(line.seq, 1);
  assert.equal(line.ts, res.ts);
  assert.equal(line.result, 'applied');
  assert.equal('instanceId' in line, false);
  assert.equal(store.nextSeq('INST-001'), 2);

  off();
});

test('emit 100 次并发：单实例串行，seq 严格递增且无丢行', async () => {
  const { root, store, bus } = await makeBus();
  const broadcastSeqs = [];
  bus.subscribe((ev) => broadcastSeqs.push(ev.seq), { instanceId: 'INST-009' });

  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      bus.emit({ instanceId: 'INST-009', ...transition({ reason: `step.${i + 1}` }) }),
    ),
  );

  assert.equal(results.every((r) => r.ok === true), true);
  const expected = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual(results.map((r) => r.seq), expected);
  assert.deepEqual(broadcastSeqs, expected); // 广播顺序与落盘顺序一致

  const read = await store.readEvents('INST-009');
  assert.equal(read.events.length, 100);
  assert.equal(read.badLines, 0);
  assert.deepEqual(read.events.map((e) => e.seq), expected);

  const lines = (await fs.readFile(eventsPath(root, 'INST-009'), 'utf8')).split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 100);
});

test('emit 落盘失败时不广播，并返回 STORE_WRITE_FAILED', async () => {
  const failingStore = {
    nextSeq: () => 7,
    appendEvent: async () => ({ ok: false, code: 'STORE_WRITE_FAILED', params: { errno: 'EPERM', path: 'x' } }),
    readEvents: async () => ({ ok: true, events: [], badLines: 0 }),
  };
  const bus = createEventBus({ store: failingStore });

  let calls = 0;
  bus.subscribe(() => {
    calls += 1;
  });

  const res = await bus.emit({ instanceId: 'INST-404', ...transition() });

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORE_WRITE_FAILED');
  assert.deepEqual(res.params, { errno: 'EPERM', path: 'x' });
  assert.equal(calls, 0);
});

test('subscribe 支持按实例过滤、取消订阅，订阅者异常不影响 emit', async () => {
  const { bus } = await makeBus();
  const all = [];
  const onlyA = [];
  const offAll = bus.subscribe((ev) => all.push(ev.objectId));
  const offA = bus.subscribe((ev) => onlyA.push(ev.objectId), { instanceId: 'INST-A' });
  bus.subscribe(() => {
    throw new Error('订阅者自己的错误');
  });

  const first = await bus.emit({ instanceId: 'INST-A', ...transition({ objectId: 'A' }) });
  const second = await bus.emit({ instanceId: 'INST-B', ...transition({ objectId: 'B' }) });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(all, ['A', 'B']);
  assert.deepEqual(onlyA, ['A']);

  offAll();
  offA();
  await bus.emit({ instanceId: 'INST-A', ...transition({ objectId: 'C' }) });

  assert.deepEqual(all, ['A', 'B']);
  assert.deepEqual(onlyA, ['A']);
});

test('replay 返回该实例的全部事件，坏行被跳过', async () => {
  const { root, bus } = await makeBus();
  await bus.emit({ instanceId: 'INST-R', ...transition() });
  await bus.emit({ instanceId: 'INST-R', ...transition({ from: 'running', to: 'completed' }) });

  await fs.appendFile(eventsPath(root, 'INST-R'), '{"half\n', 'utf8');

  const events = await bus.replay('INST-R');

  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.seq), [1, 2]);
  assert.equal(events[1].to, 'completed');
});

test('bus.nextSeq 与 store.nextSeq 一致，空实例从 1 开始', async () => {
  const { store, bus } = await makeBus();

  assert.equal(bus.nextSeq('INST-EMPTY'), 1);
  await bus.emit({ instanceId: 'INST-SEQ', ...transition() });
  assert.equal(bus.nextSeq('INST-SEQ'), store.nextSeq('INST-SEQ'));
  assert.equal(bus.nextSeq('INST-SEQ'), 2);
});

test('emit 缺少 instanceId 时抛 TypeError（进程内参数校验）', async () => {
  const { bus } = await makeBus();

  assert.throws(() => bus.emit({ ...transition() }), TypeError);
  assert.throws(() => bus.emit(null), TypeError);
});
