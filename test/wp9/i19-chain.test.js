/**
 * I1.9 WP-2 — 存储尾读与审计链（event-bus.js + instance-store.js）的契约测试。
 *
 * 覆盖：规范化 JSON 序列化 SHA-256、64 个 0 固定起点、链式逐条比对、
 * 旧记录不回填、末行截断前溯、整份不可解析重起链、replay 的 badLines
 * 同源透出、mock store 降级兼容。
 *
 * 所有落盘用例都用 os.tmpdir() + fs.mkdtemp 起临时目录，finally 清理，
 * 绝不在仓库内写文件。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { createEventBus } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

const ZERO_HASH = '0'.repeat(64);
const T0 = '2026-11-10T10:00:00.000Z';
const T1 = '2026-11-10T10:00:01.000Z';
const T2 = '2026-11-10T10:02:10.000Z';
const HEX64 = /^[0-9a-f]{64}$/;

/** 测试侧独立实现的规范化序列化 + SHA-256，用作断言 oracle（D-1 L941）。 */
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
    .join(',')}}`;
}

function chainHash(record) {
  return createHash('sha256').update(canonicalJson(record), 'utf8').digest('hex');
}

async function makeEnv() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i19-chain-'));
  const store = createStore({ root });
  const bus = createEventBus({ store });
  return { root, store, bus };
}

/** 预置 events.jsonl：字符串按原字节写入（用于坏行 / 乱码），对象按 JSON 序列化。 */
async function seedLines(root, id, lines) {
  const p = eventsPath(root, id);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const text =
    lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n';
  await fs.writeFile(p, text, 'utf8');
  return p;
}

async function nonEmptyLines(p) {
  const text = await fs.readFile(p, 'utf8');
  return text.split('\n').filter((l) => l.trim() !== '');
}

function rec(seq) {
  return { object: 'node', reason: 'state.change', seq, ts: T0, to: 'running' };
}

async function cleanup(root) {
  await fs.rm(root, { recursive: true, force: true });
}

test('规范化序列化：字段顺序不同但内容相同的记录指纹相同（不对原始行字节哈希）', async () => {
  // (1) 显式规范化串作为独立 oracle，证明规范化会按键名排序。
  const explicitCanonical = '{"a":1,"b":2}';
  const explicitHash = createHash('sha256').update(explicitCanonical, 'utf8').digest('hex');
  assert.equal(chainHash({ b: 2, a: 1 }), explicitHash);
  assert.equal(chainHash({ a: 1, b: 2 }), explicitHash);

  const { root, store } = await makeEnv();
  try {
    const content = {
      object: 'node', seq: 1, ts: T0, to: 'running', result: 'applied', reason: 'state.change',
    };
    const a = { object: 'node', seq: 1, ts: T0, to: 'running', result: 'applied', reason: 'state.change' };
    const b = { reason: 'state.change', result: 'applied', to: 'running', ts: T0, seq: 1, object: 'node' };
    // (2) 两条原始行字节确实不同。
    assert.notEqual(JSON.stringify(a), JSON.stringify(b));

    await seedLines(root, 'INST-ORDER-A', [a]);
    await seedLines(root, 'INST-ORDER-B', [b]);
    const ta = await store.readTailForChain('INST-ORDER-A');
    const tb = await store.readTailForChain('INST-ORDER-B');

    // (3) 同内容不同键序 → 同一规范化哈希；且等于 oracle，证明非原始字节哈希。
    assert.match(ta.prevHash, HEX64);
    assert.equal(ta.prevHash, tb.prevHash);
    assert.equal(ta.prevHash, chainHash(content));
    assert.equal(tb.prevHash, chainHash(content));
    assert.equal(ta.seq, 2);
    assert.equal(ta.corruptAll, false);
  } finally {
    await cleanup(root);
  }
});

test('emit 生成首尾相接的规范化哈希链，首条为 64 个 0（逐条比对第 N-1 条）', async () => {
  const { root, bus } = await makeEnv();
  try {
    const id = 'INST-CHAIN';
    const payloads = [
      { reason: 'state.change', object: 'node', to: 'running', from: 'pending' },
      { object: 'session', detail: { event: 'tool_call', meta: { z: 1, a: 2 } }, reason: 'session.state' },
      { to: 'done', from: 'running', reason: 'state.change', object: 'node' },
      { reason: 'note', object: 'health', detail: { reasons: ['x', 'y'], level: 'normal' } },
    ];
    for (const p of payloads) {
      const res = await bus.emit({ instanceId: id, ...p });
      assert.equal(res.ok, true);
      // emit 返回结构不变：仍 { ok, seq, ts }。
      assert.deepEqual(Object.keys(res).sort(), ['ok', 'seq', 'ts']);
    }

    const lines = (await nonEmptyLines(eventsPath(root, id))).map((l) => JSON.parse(l));
    assert.equal(lines.length, payloads.length);
    assert.deepEqual(lines.map((l) => l.seq), [1, 2, 3, 4]);
    assert.equal(lines[0].prev_event_hash, ZERO_HASH); // 首条固定起点

    for (let i = 1; i < lines.length; i += 1) {
      assert.match(lines[i].prev_event_hash, HEX64);
      // 第 N 条 prev_event_hash == 第 N-1 条完整 record 的规范化 SHA-256。
      assert.equal(lines[i].prev_event_hash, chainHash(lines[i - 1]), `第 ${i + 1} 条前一条指纹`);
    }
    // instanceId 只作路由键，既不落盘也不进广播体。
    for (const l of lines) assert.equal('instanceId' in l, false);
  } finally {
    await cleanup(root);
  }
});

test('旧记录无 prev_event_hash：原字节不动、不回填，新行指向第 3 条的规范化哈希', async () => {
  const { root, bus } = await makeEnv();
  try {
    const id = 'INST-LEGACY';
    const legacy = [
      { seq: 1, ts: T0, object: 'node', reason: 'state.change', to: 'running' },
      { to: 'done', reason: 'state.change', object: 'node', ts: T1, seq: 2 },
      { object: 'node', to: 'failed', seq: 3, ts: T2, reason: 'state.change' },
    ];
    const p = await seedLines(root, id, legacy);
    const before = await fs.readFile(p, 'utf8');

    const res = await bus.emit({ instanceId: id, object: 'node', reason: 'state.change', to: 'done' });
    assert.equal(res.ok, true);
    assert.equal(res.seq, 4, '新记录序号从 4 接着走、不回 1');

    const after = await fs.readFile(p, 'utf8');
    // 旧 3 行字节前缀逐字不变。
    assert.equal(after.slice(0, before.length), before);
    const beforeLines = before.split('\n').filter((l) => l.trim() !== '');
    const afterLines = after.split('\n').filter((l) => l.trim() !== '');
    assert.equal(afterLines.length, 4);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(afterLines[i], beforeLines[i], `旧第 ${i + 1} 行字节不变`);
      assert.equal('prev_event_hash' in JSON.parse(afterLines[i]), false, `旧第 ${i + 1} 行不回填`);
    }

    const newRec = JSON.parse(afterLines[3]);
    assert.equal(newRec.seq, 4);
    assert.equal(newRec.prev_event_hash, chainHash(JSON.parse(beforeLines[2])));
  } finally {
    await cleanup(root);
  }
});

test('末行被截断：跳过该行前溯到第 2 条续链，序号继续递增、不回 1', async () => {
  const { root, bus } = await makeEnv();
  try {
    const id = 'INST-TRUNC';
    const l1 = { seq: 1, ts: T0, object: 'node', reason: 'state.change', to: 'running', prev_event_hash: ZERO_HASH };
    const l2 = { seq: 2, ts: T2, object: 'node', reason: 'state.change', to: 'done', prev_event_hash: chainHash(l1) };
    const truncated = '{"object":"node","to":'; // 半行乱码
    const p = await seedLines(root, id, [JSON.stringify(l1), JSON.stringify(l2), truncated]);

    const res = await bus.emit({ instanceId: id, object: 'node', reason: 'state.change', to: 'failed' });
    assert.equal(res.ok, true);
    assert.equal(res.seq, 3, '序号继续递增、不回 1');

    const lines = await nonEmptyLines(p);
    assert.equal(lines.length, 4);
    assert.equal(lines[2], truncated, '被截断的坏行原样保留');
    const second = JSON.parse(lines[1]);
    const newRec = JSON.parse(lines[3]);
    // 新链前一条指纹指向第 2 条记录，而非第 1 条、也不是被截断的第 3 行。
    assert.equal(newRec.prev_event_hash, chainHash(second));
    assert.notEqual(newRec.prev_event_hash, chainHash(JSON.parse(lines[0])));
    assert.notEqual(
      newRec.prev_event_hash,
      createHash('sha256').update(truncated, 'utf8').digest('hex'),
      '不得对截断行字节哈希',
    );
    assert.equal(newRec.seq, 3);
  } finally {
    await cleanup(root);
  }
});

test('整份不可解析：corruptAll=true、从 seq=1 / 64 个 0 重起链、旧 3 行字节不变、命令不中断', async () => {
  const { root, store, bus } = await makeEnv();
  try {
    const id = 'INST-CORRUPT';
    const garbage = ['不是一个 JSON 记录', '%%%% 乱码 %%%%', '坏行三'];
    const p = await seedLines(root, id, garbage);
    const before = await fs.readFile(p, 'utf8');

    const tail = await store.readTailForChain(id);
    assert.equal(tail.corruptAll, true);
    assert.equal(tail.seq, 1);
    assert.equal(tail.prevHash, ZERO_HASH);

    const res = await bus.emit({ instanceId: id, object: 'node', reason: 'state.change' });
    assert.equal(res.ok, true, '命令不中断');
    assert.equal(res.seq, 1);

    const after = await fs.readFile(p, 'utf8');
    assert.equal(after.slice(0, before.length), before, '旧 3 行字节原样保留');
    const newRec = JSON.parse(after.slice(before.length).trim());
    assert.equal(newRec.seq, 1);
    assert.equal(newRec.prev_event_hash, ZERO_HASH);

    // 再写一条：链继续递增、彼此不重号。
    const res2 = await bus.emit({ instanceId: id, object: 'node', reason: 'state.change' });
    assert.equal(res2.ok, true);
    assert.equal(res2.seq, 2);
    const all = (await nonEmptyLines(p)).slice(3).map((l) => JSON.parse(l));
    assert.deepEqual(all.map((e) => e.seq), [1, 2]);
    assert.equal(all[0].prev_event_hash, ZERO_HASH);
    assert.equal(all[1].prev_event_hash, chainHash(all[0]));
  } finally {
    await cleanup(root);
  }
});

test('replay 透出 readEvents 的 badLines，与读取层同源（0 / 1 / 3）', async () => {
  const { root, store, bus } = await makeEnv();
  try {
    const cases = [
      { id: 'INST-B0', lines: [rec(1), rec(2)], bad: 0, seqs: [1, 2] },
      { id: 'INST-B1', lines: [rec(1), 'NOT_JSON{{{'], bad: 1, seqs: [1] },
      { id: 'INST-B3', lines: ['g1', 'g2', 'g3'], bad: 3, seqs: [] },
    ];
    for (const c of cases) {
      await seedLines(root, c.id, c.lines);
      const read = await store.readEvents(c.id);
      assert.equal(read.badLines, c.bad);

      const replayed = await bus.replay(c.id);
      // 仍返回数组：既有调用者（server.js / 既有测试）拿到的形状不回归。
      assert.ok(Array.isArray(replayed));
      assert.equal(replayed.badLines, c.bad, '透出的坏行数');
      assert.equal(replayed.badLines, read.badLines, '与 readEvents 同源、不另算');
      assert.equal(replayed.length, read.events.length);
      assert.deepEqual(replayed.map((e) => e.seq), c.seqs);
      // 附带字段非枚举：对 length / JSON / Object.keys / 深比较透明。
      assert.deepEqual(Object.keys(replayed), Object.keys(read.events));
      assert.equal(JSON.stringify(replayed), JSON.stringify(read.events));
      assert.deepEqual([...replayed], read.events);
    }
  } finally {
    await cleanup(root);
  }
});

test('兼容：store 未实现 readTailForChain 时降级到 nextSeq + 64 个 0，不抛错', async () => {
  const appended = [];
  const mockStore = {
    nextSeq: () => 7,
    appendEvent: async (id, record) => {
      appended.push({ id, record });
      return { ok: true, seq: record.seq };
    },
    readEvents: async () => ({ ok: true, events: [], badLines: 0 }),
  };
  const bus = createEventBus({ store: mockStore });

  const res = await bus.emit({ instanceId: 'INST-MOCK', object: 'node', reason: 'state.change' });
  assert.equal(res.ok, true);
  assert.equal(res.seq, 7, '降级后序号仍来自 nextSeq');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].record.prev_event_hash, ZERO_HASH, '降级固定起点');
  assert.equal('instanceId' in appended[0].record, false);

  // replay 在无坏行的 mock 上仍返回数组并带 badLines=0。
  const replayed = await bus.replay('INST-MOCK');
  assert.ok(Array.isArray(replayed));
  assert.equal(replayed.badLines, 0);
});
