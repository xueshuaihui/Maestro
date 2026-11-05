import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../../src/persistence/instance-store.js';
import { corruptPath, instanceDir, statePath, eventsPath } from '../../src/persistence/paths.js';

const LEGACY = path.resolve('test/fixtures/legacy-v1');
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

/** v2 快照：2 节点 / 2 会话 / 2 交接包 / 1 条待处理升级。 */
function v2State(instanceId, overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    instanceId,
    state: 'suspended',
    template: 'code-loop',
    cwd: 'D:\\WWW\\Maestro\\demo-code-pass',
    task: '给 calc.js 补 div\n产物：calc.js',
    coreGeneration: 'gen-test',
    halted: false,
    createdAt: now,
    updatedAt: now,
    stateSince: now,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 4 },
    hostRaw: { stopReason: 'end_turn', lastError: null, agentInfo: { name: 'mock', version: '0.0.0' } },
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', round: 2, state: 'done' },
      { nodeId: 'T-002', roleId: 'tester', round: 2, state: 'escalated' },
    ],
    sessions: [
      { sessionId: 'sess-1', nodeId: 'T-001', state: 'idle' },
      { sessionId: 'sess-2', nodeId: 'T-002', state: 'escalated' },
    ],
    handoffs: [
      { handoffId: 'HO-001', state: 'consumed', defects: [] },
      { handoffId: 'HO-002', state: 'consumed', defects: [] },
    ],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', defects: [] },
      { escalationId: 'ESC-000', nodeId: 'T-001', round: 1, state: 'voided', defects: [] },
    ],
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

async function sha256(filePath) {
  return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function dirEntries(dir) {
  try {
    return (await fs.readdir(dir)).sort();
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

/** 把 legacy 夹具原样拷进临时项目的实例目录（模拟 AC-20 的拷贝步骤）。 */
async function copyLegacy(root, id) {
  const target = instanceDir(root, id);
  await fs.mkdir(target, { recursive: true });
  await fs.copyFile(path.join(LEGACY, id, 'state.json'), statePath(root, id));
  return target;
}

// ---------------------------------------------------------------- save 基本语义

test('旧调用 save(id, state) 行为不变：原子写、updatedAt 刷新、rev 从 1 递增', async () => {
  const { root, store } = await makeStore();
  const old = '2020-01-01T00:00:00.000Z';
  const state = validState('INST-001', { createdAt: old, updatedAt: old });

  const first = await store.save('INST-001', state);
  assert.equal(first.ok, true);
  assert.equal(first.rev, 1, '首次写入 rev=1');
  assert.notEqual(first.updatedAt, old);
  assert.equal(state.updatedAt, first.updatedAt);
  assert.equal(Number.isNaN(Date.parse(first.updatedAt)), false);

  const second = await store.save('INST-001', state);
  const third = await store.save('INST-001', state);
  assert.deepEqual([second.rev, third.rev], [2, 3]);

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.instanceId, 'INST-001');
  assert.equal(onDisk.updatedAt, third.updatedAt);
  assert.equal(onDisk.rev, 3);
  assert.equal(onDisk.node.state, 'review');

  const loaded = await store.load('INST-001');
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.updatedAt, third.updatedAt);
  assert.equal(loaded.state.rev, 3);
  assert.equal(loaded.state.state, 'running');
});

test('save 缺省 expectedState：load 出来的 rev 能续增，且仍以磁盘现值为准', async () => {
  const { root, store } = await makeStore();
  await store.save('INST-001', validState('INST-001'));
  const loaded = await store.load('INST-001');

  // 模拟「load 出来 → 改字段 → 原样写回」：不传 expectedState 也保持单调。
  const res = await store.save('INST-001', { ...loaded.state, state: 'completed' });
  assert.equal(res.ok, true);
  assert.equal(res.rev, 2);
  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.rev, 2);
});

// ---------------------------------------------------------------- rev 全局单调（偏差 ②）

test('无 expectedState 的第 2、3 次写也基于磁盘 rev 递增：磁盘 rev 严格等于 3', async () => {
  const { root, store } = await makeStore();

  // 首次显式 CAS 落一个确定的 1；后两次都是「全新快照对象 + 不带 expectedState」。
  const first = await store.save('INST-001', validState('INST-001'), { expectedState: { rev: 0 } });
  assert.equal(first.rev, 1);
  const second = await store.save('INST-001', validState('INST-001', { state: 'suspended' }));
  const third = await store.save('INST-001', validState('INST-001', { state: 'completed' }));
  assert.equal(second.ok, true);
  assert.equal(third.ok, true);
  assert.deepEqual([second.rev, third.rev], [2, 3]);

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.rev, 3, '磁盘 rev 必须严格等于 3，不得回退到 1');
  assert.equal(onDisk.state, 'completed');
});

test('模拟进程重启（新 store 空缓存）：首个无 CAS 写 rev=4，不回 1', async () => {
  const { root, store } = await makeStore();
  for (let i = 0; i < 3; i += 1) {
    await store.save('INST-001', validState('INST-001'));
  }

  // 新建 store 等价于进程重启：revCache / saveChains 都是全新的。
  const restarted = createStore({ root });
  const res = await restarted.save('INST-001', validState('INST-001', { state: 'completed' }));
  assert.equal(res.ok, true);
  assert.equal(res.rev, 4, '重启后必须接着磁盘的 3 递增，不能回到 1');

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.rev, 4);
});

test('rev 单调之后 CAS 判定正确：{rev:3} 命中、{rev:2} 冲突且磁盘不变', async () => {
  const { root, store } = await makeStore();
  for (let i = 0; i < 3; i += 1) {
    await store.save('INST-001', validState('INST-001'));
  }
  const file = statePath(root, 'INST-001');
  const before = await sha256(file);

  const miss = await store.save('INST-001', validState('INST-001', { state: 'completed' }), {
    expectedState: { rev: 2 },
  });
  assert.equal(miss.ok, false);
  assert.equal(miss.code, 'STORE_CONFLICT');
  assert.deepEqual(miss.params.actual, { state: 'running', halted: false, rev: 3 });
  assert.equal(await sha256(file), before, '冲突不得写盘');

  const hit = await store.save('INST-001', validState('INST-001', { state: 'completed' }), {
    expectedState: { rev: 3 },
  });
  assert.equal(hit.ok, true);
  assert.equal(hit.rev, 4);
});

test('并发 20 次不带 expectedState 的 save：rev 连续无重复无回退', async () => {
  const { root, store } = await makeStore();
  const first = await store.save('INST-001', validState('INST-001'));
  assert.equal(first.rev, 1);

  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => store.save('INST-001', validState('INST-001', { task: `并发写 ${i}` }))),
  );
  assert.equal(results.every((r) => r.ok === true), true);

  const revs = results.map((r) => r.rev).sort((a, b) => a - b);
  assert.deepEqual(revs, Array.from({ length: 20 }, (_, i) => i + 2), '每次写拿到 2..21，无重复');

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.rev, 1 + 20, '最终 rev = 初始 1 + 20');
});

test('expectedState 传 string：命中则写、不命中返回 STORE_CONFLICT 且磁盘不变', async () => {
  const { root, store } = await makeStore();
  await store.save('INST-001', validState('INST-001'));

  const hit = await store.save('INST-001', { ...validState('INST-001'), state: 'completed' }, { expectedState: 'running' });
  assert.equal(hit.ok, true);
  assert.equal(hit.rev, 2);

  const before = await sha256(statePath(root, 'INST-001'));
  const miss = await store.save('INST-001', validState('INST-001'), { expectedState: 'created' });
  assert.equal(miss.ok, false);
  assert.equal(miss.code, 'STORE_CONFLICT');
  assert.equal(miss.params.expected, 'created');
  assert.equal(miss.params.actual, 'completed', 'string 形状的 actual 仍是实例状态字符串');
  assert.equal(await sha256(statePath(root, 'INST-001')), before, '冲突时不得写入');
});

test('expectedState 传对象：state / halted / rev 任一不符都冲突且磁盘字节不变', async () => {
  const { root, store } = await makeStore();
  await store.save('INST-001', v2State('INST-001'));
  const file = statePath(root, 'INST-001');
  const before = await sha256(file);

  const cases = [
    { expected: { state: 'running' }, field: 'state', actual: 'suspended' },
    { expected: { halted: true }, field: 'halted', actual: false },
    { expected: { rev: 99 }, field: 'rev', actual: 1 },
    { expected: { state: 'suspended', halted: true, rev: 1 }, field: 'halted', actual: false },
  ];
  for (const item of cases) {
    const res = await store.save('INST-001', v2State('INST-001'), { expectedState: item.expected });
    assert.equal(res.ok, false, `expected=${JSON.stringify(item.expected)} 应冲突`);
    assert.equal(res.code, 'STORE_CONFLICT');
    assert.equal(res.params.expected, item.expected);
    assert.deepEqual(res.params.actual, { state: 'suspended', halted: false, rev: 1 });
    assert.equal(res.params.actual[item.field], item.actual);
    assert.equal(await sha256(file), before, '冲突时磁盘字节不得变化');
  }

  // 三字段全对才放行，并 +1。
  const ok = await store.save('INST-001', v2State('INST-001'), {
    expectedState: { state: 'suspended', halted: false, rev: 1 },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.rev, 2);
});

test('expectedState 只比较显式提供了的键（窄条件写）', async () => {
  const { store } = await makeStore();
  const state = v2State('INST-001');
  await store.save('INST-001', state);

  const res = await store.save('INST-001', { ...state, halted: true }, { expectedState: { halted: false } });
  assert.equal(res.ok, true, '只给 halted 时不应被 state/rev 卡住');
  assert.equal(res.rev, 2);
});

test('并发 50 次带 rev 的读改写：无丢更新，rev 严格单调', async () => {
  const { root, store } = await makeStore();
  const first = await store.save('INST-001', v2State('INST-001', { hits: 0 }));
  assert.equal(first.rev, 1);

  const done = [];
  async function bump() {
    for (;;) {
      const loaded = await store.load('INST-001');
      assert.equal(loaded.ok, true);
      const next = { ...loaded.state, hits: (loaded.state.hits ?? 0) + 1 };
      const res = await store.save('INST-001', next, { expectedState: { rev: loaded.state.rev } });
      if (res.ok) {
        done.push(res.rev);
        return;
      }
      assert.equal(res.code, 'STORE_CONFLICT', '重试只能因为冲突');
    }
  }
  await Promise.all(Array.from({ length: 50 }, () => bump()));

  const onDisk = JSON.parse(await fs.readFile(statePath(root, 'INST-001'), 'utf8'));
  assert.equal(onDisk.hits, 50, '50 次自增一次都不能丢');
  assert.equal(onDisk.rev, 51);
  assert.deepEqual(
    [...done].sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, i) => i + 2),
    '每次成功写入的 rev 是 2..51，无重复',
  );
});

// ---------------------------------------------------------------- list 投影

test('list 对 v2 快照投影 schemaVersion/template/cwd/pendingEscalations', async () => {
  const { store } = await makeStore();
  await store.save('INST-001', v2State('INST-001'));

  const res = await store.list();
  assert.equal(res.ok, true);
  assert.deepEqual(res.items, [
    {
      instanceId: 'INST-001',
      schemaVersion: 2,
      template: 'code-loop',
      cwd: 'D:\\WWW\\Maestro\\demo-code-pass',
      state: 'suspended',
      nodeState: 'done',
      sessionState: 'escalated',
      handoffState: 'consumed',
      pendingEscalations: 1,
      updatedAt: (await store.load('INST-001')).state.updatedAt,
      readable: true,
    },
  ]);
});

test('list 对 v1 快照（legacy 夹具）：template=single、pendingEscalations=0、不回写', async () => {
  const { root, store } = await makeStore();
  await copyLegacy(root, 'OLD-001');
  const before = await sha256(statePath(root, 'OLD-001'));

  const res = await store.list();
  assert.equal(res.ok, true);
  const item = res.items.find((entry) => entry.instanceId === 'OLD-001');
  assert.ok(item);
  assert.equal(item.schemaVersion, 1);
  assert.equal(item.template, 'single');
  assert.equal(item.cwd, 'D:\\WWW\\Maestro\\demo-legacy-1');
  assert.equal(item.state, 'completed');
  assert.equal(item.nodeState, 'done');
  assert.equal(item.pendingEscalations, 0);
  assert.equal(item.readable, true);
  assert.equal(await sha256(statePath(root, 'OLD-001')), before, 'list 不得回写旧快照');
});

test('list 缺字段的 v2 快照不抛错（数组字段可缺省）', async () => {
  const { root, store } = await makeStore();
  const file = statePath(root, 'INST-MIN');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ schemaVersion: 2, instanceId: 'INST-MIN', state: 'created' }), 'utf8');

  const res = await store.list();
  assert.equal(res.ok, true);
  const item = res.items.find((entry) => entry.instanceId === 'INST-MIN');
  assert.equal(item.template, null);
  assert.equal(item.cwd, root, '缺 cwd 时退回项目根');
  assert.equal(item.nodeState, null);
  assert.equal(item.pendingEscalations, 0);
  assert.equal(item.readable, true);
});

test('list 遇损坏只标记内存态 readable:false，不写 .corrupt、不产生新文件', async () => {
  const { root, store } = await makeStore();
  const file = statePath(root, 'INST-C');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, '{"broken', 'utf8');
  const beforeEntries = await dirEntries(instanceDir(root, 'INST-C'));

  const listed = await store.list();
  assert.equal(listed.ok, true);
  const item = listed.items.find((entry) => entry.instanceId === 'INST-C');
  assert.ok(item);
  assert.equal(item.readable, false);
  assert.equal(item.state, null);
  assert.equal(item.pendingEscalations, 0);

  assert.deepEqual(await dirEntries(instanceDir(root, 'INST-C')), beforeEntries);
  await assert.rejects(fs.stat(corruptPath(root, 'INST-C')), { code: 'ENOENT' });

  // 读路径仍然阻断写入（内存态），且不覆盖原字节。
  const blocked = await store.save('INST-C', validState('INST-C'));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'STORE_WRITE_BLOCKED_CORRUPT');
  assert.equal(await fs.readFile(file, 'utf8'), '{"broken');
});

// ---------------------------------------------------------------- v1 只读

test('load 对 v1 返回原形状且文件字节 / mtime 不变（AC-20）', async () => {
  const { root, store } = await makeStore();
  const dir = await copyLegacy(root, 'OLD-001');
  const file = statePath(root, 'OLD-001');
  const rawBefore = await fs.readFile(file, 'utf8');
  const hashBefore = await sha256(file);
  const statBefore = await fs.stat(file);

  const loaded = await store.load('OLD-001');

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, JSON.parse(rawBefore), '原样返回，不做规范化');
  assert.equal(loaded.state.schemaVersion, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(loaded.state, 'rev'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(loaded.state, 'nodes'), false);
  assert.equal(typeof loaded.state.node, 'object');

  assert.equal(await sha256(file), hashBefore);
  const statAfter = await fs.stat(file);
  assert.equal(statAfter.mtimeMs, statBefore.mtimeMs);
  assert.deepEqual(await dirEntries(dir), ['state.json'], '不含 .corrupt 等新文件');
});

test('两份 legacy 夹具的 state/events sha256 与 SHA256SUMS 一致', async () => {
  const sums = await fs.readFile(path.join(LEGACY, 'SHA256SUMS'), 'utf8');
  const lines = sums.split('\n').filter((line) => line.trim() !== '');
  // AC-20 / 需求 §6：四个文件（两份 state.json + 两份 events.jsonl）都要可查且不改。
  assert.equal(lines.length, 4);
  for (const line of lines) {
    const [expected, rel] = line.trim().split(/\s+/);
    assert.equal(await sha256(path.join(LEGACY, rel)), expected, `${rel} 哈希不符`);
  }
});

// ---------------------------------------------------------------- I1.1 既有语义（回归）

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
  assert.equal(res.items[0].nodeState, 'review');
  assert.equal(res.items[0].sessionState, 'waiting_dependency');
  assert.equal(res.items[0].handoffState, 'accepted');
});

test('list 在 .orch/instances 尚不存在时返回空列表', async () => {
  const { store } = await makeStore();
  const res = await store.list();

  assert.equal(res.ok, true);
  assert.deepEqual(res.items, []);
});
