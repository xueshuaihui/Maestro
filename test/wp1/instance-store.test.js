import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/persistence/instance-store.js';
import { instanceDir, statePath, eventsPath } from '../../src/persistence/paths.js';

const tempDirs = [];

async function makeStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp1-store-'));
  tempDirs.push(dir);
  const root = dir;
  return { root, store: createStore({ root }) };
}

after(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

function validState(instanceId, overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    instanceId,
    coreGeneration: 'gen-test',
    createdAt: now,
    updatedAt: now,
    state: 'running',
    cwd: 'C:\\demo',
    task: 'demo task',
    roleId: 'worker',
    node: { nodeId: 'T-001', state: 'review', stateSince: now, startedAt: now, endedAt: null, failure: null, note: null },
    session: { sessionId: 'sess-1', hostId: 'dsh', state: 'waiting_dependency', stateSince: now, createdAt: now, lastEventAt: now, toolName: null, turnId: 'turn-1', pendingPermission: null, quarantined: false },
    handoff: { handoffId: 'HO-001', state: 'accepted', createdAt: now, deliveredAt: now, acceptedAt: now, consumedAt: null, rejectedAt: null, rejectReason: null, acceptedSignal: 'agent_thought_chunk', ambiguityWindowMs: 63 },
    artifactRefs: [],
    hostRaw: { stopReason: 'end_turn', lastError: null, agentInfo: { name: 'mock', version: '0.0.0' } },
    counters: { eventSeq: 0, runCount: 1 },
    ...overrides,
  };
}

function event(seq) {
  return {
    seq,
    ts: new Date().toISOString(),
    object: 'node',
    objectId: 'T-001',
    from: null,
    to: null,
    result: 'note',
    reason: 'wp1.test',
    gen: 'gen-test',
  };
}

test('save 原子写成功、内容可解析、updatedAt 被刷新', async () => {
  const { root, store } = await makeStore();
  const old = '2020-01-01T00:00:00.000Z';
  const state = validState('INST-001', { createdAt: old, updatedAt: old });

  const saved = await store.save('INST-001', state);

  assert.equal(saved.ok, true);
  assert.notEqual(saved.updatedAt, old);
  assert.equal(state.updatedAt, saved.updatedAt); // save 直接刷新入参
  assert.equal(Number.isNaN(Date.parse(saved.updatedAt)), false);

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.instanceId, 'INST-001');
  assert.equal(onDisk.updatedAt, saved.updatedAt);
  assert.equal(onDisk.node.state, 'review');

  const loaded = await store.load('INST-001');
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.updatedAt, saved.updatedAt);
  assert.equal(loaded.state.state, 'running');
});

test('load 对不存在的实例返回 NOT_FOUND', async () => {
  const { store } = await makeStore();
  const res = await store.load('INST-NOPE');

  assert.equal(res.ok, false);
  assert.equal(res.code, 'NOT_FOUND');
});

test('load 遇坏 JSON 返回 STATE_CORRUPT，备份存在且原文件字节未变', async () => {
  const { root, store } = await makeStore();
  const file = statePath(root, 'INST-001');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const broken = '{"broken';
  await fs.writeFile(file, broken, 'utf8');
  const originalBytes = await fs.readFile(file);

  const res = await store.load('INST-001');

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STATE_CORRUPT');
  assert.equal(res.backupPath, path.join(instanceDir(root, 'INST-001'), 'state.json.corrupt'));

  // AC-13：备份是复制出来的，原 state.json 一个字节都没动。
  assert.equal(await fs.readFile(res.backupPath, 'utf8'), broken);
  const afterBytes = await fs.readFile(file);
  assert.deepEqual(afterBytes, originalBytes);
});

test('load 缺 schemaVersion / instanceId 同样判为损坏', async () => {
  for (const [index, payload] of [
    { instanceId: 'INST-001' },
    { schemaVersion: 1 },
    {},
  ].entries()) {
    const { root, store } = await makeStore();
    const id = `INST-00${index + 2}`;
    const file = statePath(root, id);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(payload), 'utf8');

    const res = await store.load(id);
    assert.equal(res.ok, false);
    assert.equal(res.code, 'STATE_CORRUPT');
    assert.equal(await fs.readFile(res.backupPath, 'utf8'), JSON.stringify(payload));
  }
});

test('损坏之后 save 返回 STORE_WRITE_BLOCKED_CORRUPT，且不覆盖原文件', async () => {
  const { root, store } = await makeStore();
  const file = statePath(root, 'INST-001');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const broken = '{"broken';
  await fs.writeFile(file, broken, 'utf8');

  await store.load('INST-001');
  const res = await store.save('INST-001', validState('INST-001'));

  assert.equal(res.ok, false);
  assert.equal(res.code, 'STORE_WRITE_BLOCKED_CORRUPT');
  assert.equal(await fs.readFile(file, 'utf8'), broken);
});

test('appendEvent 100 次并发：100 行、seq 严格递增、无重号无丢行', async () => {
  const { root, store } = await makeStore();

  const results = await Promise.all(
    Array.from({ length: 100 }, (_, i) => store.appendEvent('INST-001', event(i + 1))),
  );
  assert.equal(results.every((r) => r.ok === true), true);
  assert.deepEqual(results.map((r) => r.seq), Array.from({ length: 100 }, (_, i) => i + 1));

  const read = await store.readEvents('INST-001');
  assert.equal(read.ok, true);
  assert.equal(read.badLines, 0);
  assert.equal(read.events.length, 100);
  assert.deepEqual(read.events.map((e) => e.seq), Array.from({ length: 100 }, (_, i) => i + 1));

  // 落盘是 NDJSON：每行一个完整对象，没有跨行拼接。
  const lines = (await fs.readFile(eventsPath(root, 'INST-001'), 'utf8')).split('\n').filter((l) => l.trim() !== '');
  assert.equal(lines.length, 100);
  assert.equal(lines.every((line) => JSON.parse(line).objectId === 'T-001'), true);

  assert.equal(store.nextSeq('INST-001'), 101);
});

test('readEvents 跳过坏行并计数，不让整份记录不可读', async () => {
  const { root, store } = await makeStore();
  const file = eventsPath(root, 'INST-001');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify(event(1))}\n{"half\n${JSON.stringify(event(3))}\n`,
    'utf8',
  );

  const read = await store.readEvents('INST-001');

  assert.equal(read.ok, true);
  assert.equal(read.events.length, 2);
  assert.equal(read.badLines, 1);
  assert.deepEqual(read.events.map((e) => e.seq), [1, 3]);
  // 末行可解析，序号接着走。
  assert.equal(store.nextSeq('INST-001'), 4);
});

test('readEvents 对没有事件文件的实例返回空数组', async () => {
  const { store } = await makeStore();
  const read = await store.readEvents('INST-NOPE');

  assert.equal(read.ok, true);
  assert.deepEqual(read.events, []);
  assert.equal(read.badLines, 0);
  assert.equal(store.nextSeq('INST-NOPE'), 1);
});

test('list 不返回只有 events.jsonl 的半截实例', async () => {
  const { root, store } = await makeStore();

  // 完整实例
  await store.save('INST-A', validState('INST-A'));

  // 半截实例：只有 events.jsonl，从没落过 state.json
  await fs.mkdir(instanceDir(root, 'INST-B'), { recursive: true });
  await store.appendEvent('INST-B', event(1));

  const res = await store.list();

  assert.equal(res.ok, true);
  assert.deepEqual(res.items.map((item) => item.instanceId), ['INST-A']);
  assert.deepEqual(res.items[0], {
    instanceId: 'INST-A',
    state: 'running',
    nodeState: 'review',
    sessionState: 'waiting_dependency',
    handoffState: 'accepted',
    updatedAt: (await store.load('INST-A')).state.updatedAt,
    readable: true,
  });
});

test('list 对损坏实例标记 readable:false 但仍列出来，并顺手备份', async () => {
  const { root, store } = await makeStore();
  const file = statePath(root, 'INST-C');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '{"broken', 'utf8');

  const res = await store.list();

  assert.equal(res.ok, true);
  const item = res.items.find((entry) => entry.instanceId === 'INST-C');
  assert.ok(item);
  assert.equal(item.readable, false);
  assert.equal(item.state, null);
  assert.equal(await fs.readFile(path.join(instanceDir(root, 'INST-C'), 'state.json.corrupt'), 'utf8'), '{"broken');
  assert.equal(await fs.readFile(file, 'utf8'), '{"broken');
});

test('list 在 .orch/instances 尚不存在时返回空列表', async () => {
  const { store } = await makeStore();
  const res = await store.list();

  assert.equal(res.ok, true);
  assert.deepEqual(res.items, []);
});
