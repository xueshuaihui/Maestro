/**
 * I1.12 WP-1 / AC-02 contract tests: I1.9 chain continuity and canonicalizer
 * byte-level parity with the private helper in instance-store.js.
 *
 * Independent %TEMP% root + NODE_ENV=test. No process spawn, no bash. The
 * private `canonicalize` / `hashRecord` are mirrored verbatim in this test and
 * cross-checked against both the new exports and the fingerprints the real
 * store actually wrote into `events.jsonl`.
 *
 * verifyChain uses the frozen signature ({root, instanceId, fs}); only test
 * setup writes fixture bytes, the verifier itself is read-only.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import {
  verifyChain,
  verifyChainText,
  CHAIN_LABEL_KEYS,
} from '../../src/core/audit-verify.js';
import {
  ZERO_HASH,
  createEventBus,
  canonicalizeEvent,
  eventFingerprint,
} from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

const LABELS = Object.freeze({
  [CHAIN_LABEL_KEYS.ok]: '链完整，共 {N} 条',
  [CHAIN_LABEL_KEYS.broken]: '链已断：第 {N} 条记录与前一条指纹不匹配',
});

const INSTANCE = 'INST-CHAIN';
const FIXED_TS = '2026-11-18T00:00:00.000Z';
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const SEEDS = [
  { object: 'run', result: 'applied', reason: 'run.started' },
  { object: 'node', objectId: 'T-002', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-003', from: null, to: 'delivered', result: 'applied', reason: 'handoff.delivered' },
  { object: 'node', objectId: 'T-004', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-005', from: 'T-004', to: 'done', result: 'applied', reason: 'handoff.delivered' },
];

/** Verbatim mirror of src/persistence/instance-store.js:53-66 (read-only baseline). */
function mirrorCanonicalize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(mirrorCanonicalize).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${mirrorCanonicalize(value[k])}`).join(',')}}`;
}

function mirrorHashRecord(record) {
  return createHash('sha256').update(mirrorCanonicalize(record), 'utf8').digest('hex');
}

async function withTempRoot(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-i112-chain-'));
  try {
    await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

/** Test-only fixture writer: verifyChain never writes, only the setup does. */
async function writeLog(root, instanceId, text) {
  const file = eventsPath(root, instanceId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
  return file;
}

function splitLines(text) {
  return text.trimEnd().split('\n');
}

async function emitRange(bus, from, to) {
  for (let i = from; i < to; i += 1) {
    const emitted = await bus.emit({ instanceId: INSTANCE, ...SEEDS[i] });
    assert.equal(emitted.ok, true, 'fixture emit must succeed');
  }
}

test('AC-02 旧 N 行字节不变、新行 seq=N+1、prev=旧末条指纹、断点 0', async () => {
  await withTempRoot(async (root) => {
    const store = createStore({ root });
    const bus = createEventBus({ store, clock: () => Date.parse(FIXED_TS) });
    await emitRange(bus, 0, 3);

    const file = eventsPath(root, INSTANCE);
    const oldText = await fs.readFile(file, 'utf8');
    const oldLines = splitLines(oldText);
    const oldHash = sha256(oldText);
    const oldLast = JSON.parse(oldLines[oldLines.length - 1]);
    const oldLastFingerprint = eventFingerprint(oldLast);

    await emitRange(bus, 3, 5);

    const newText = await fs.readFile(file, 'utf8');
    const newLines = splitLines(newText);
    assert.equal(newLines.length, oldLines.length + 2);
    assert.deepEqual(newLines.slice(0, oldLines.length), oldLines, 'old lines are byte-identical');
    assert.equal(sha256(`${newLines.slice(0, oldLines.length).join('\n')}\n`), oldHash);

    const added = newLines.slice(oldLines.length).map((line) => JSON.parse(line));
    assert.equal(added[0].seq, oldLast.seq + 1);
    assert.equal(added[1].seq, oldLast.seq + 2);
    assert.equal(added[0].prev_event_hash, oldLastFingerprint);
    assert.equal(added[1].prev_event_hash, eventFingerprint(added[0]));

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });
    assert.equal(result.ok, true);
    assert.equal(result.badIndex, null);
    assert.equal(result.count, 5);
    assert.equal(result.historical, 0);
    assert.equal(result.gaps, 0);
    assert.equal(result.badLines, 0);
    assert.equal(verifyChainText(result, LABELS), '链完整，共 5 条');
  });
});

test('冻结点① canonicalizeEvent / eventFingerprint 与私有实现字节级对拍', async () => {
  const samples = [
    { seq: 1, ts: FIXED_TS, prev_event_hash: ZERO_HASH, object: 'run', result: 'applied' },
    { b: 2, a: 1, z: { y: [3, { d: 4, c: 5 }], x: null }, n: true, s: 'unicode ✓' },
    { arr: [null, undefined, false, 0, '', {}, []], nested: { k: 'v' } },
    { 'z-last': 1, 'a-first': 2, mixed: { q: [1, 2], p: { b: '2', a: '1' } } },
  ];
  for (const sample of samples) {
    assert.equal(canonicalizeEvent(sample), mirrorCanonicalize(sample));
    assert.equal(eventFingerprint(sample), mirrorHashRecord(sample));
  }

  // Equivalence against what the real write path stored, not just the mirror.
  await withTempRoot(async (root) => {
    const store = createStore({ root });
    const bus = createEventBus({ store, clock: () => Date.parse(FIXED_TS) });
    await emitRange(bus, 0, 3);
    const lines = splitLines(await fs.readFile(eventsPath(root, INSTANCE), 'utf8'));
    const records = lines.map((line) => JSON.parse(line));
    assert.equal(records[0].prev_event_hash, ZERO_HASH);
    for (let i = 1; i < records.length; i += 1) {
      assert.equal(records[i].prev_event_hash, eventFingerprint(records[i - 1]));
      assert.equal(records[i].prev_event_hash, mirrorHashRecord(records[i - 1]));
      assert.equal(canonicalizeEvent(records[i - 1]), mirrorCanonicalize(records[i - 1]));
    }
  });
});

test('D-2 不可读行与序号空洞跳过并计数、不算断点', async () => {
  await withTempRoot(async (root) => {
    const first = { seq: 1, ts: FIXED_TS, prev_event_hash: ZERO_HASH, object: 'run' };
    const second = { seq: 2, ts: FIXED_TS, prev_event_hash: eventFingerprint(first), object: 'node' };
    // seq 3 is a hole; seq 4 still points at seq 2's fingerprint (no backfill).
    const fourth = { seq: 4, ts: FIXED_TS, prev_event_hash: eventFingerprint(second), object: 'handoff' };
    const lines = [JSON.stringify(first), 'BROKEN LINE', JSON.stringify(second), JSON.stringify(fourth)];
    await writeLog(root, INSTANCE, lines.join('\n'));

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, true);
    assert.equal(result.count, 3);
    assert.equal(result.badLines, 2, 'one unreadable line + one sequence hole');
    assert.equal(result.gaps, 1);
    assert.equal(result.badIndex, null);
    assert.equal(verifyChainText(result, LABELS), '链完整，共 3 条');
  });
});

test('A-0 首条固定起点：首条 prev 非 64 个 0 即断点 1', async () => {
  await withTempRoot(async (root) => {
    const first = { seq: 1, ts: FIXED_TS, prev_event_hash: '1'.repeat(64), object: 'run' };
    const second = { seq: 2, ts: FIXED_TS, prev_event_hash: eventFingerprint(first), object: 'node' };
    const lines = [first, second].map((record) => JSON.stringify(record));
    await writeLog(root, INSTANCE, lines.join('\n'));

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'CHAIN_BROKEN');
    assert.equal(result.badIndex, 1);
    assert.equal(result.expected, ZERO_HASH);
    assert.equal(verifyChainText(result, LABELS), '链已断：第 1 条记录与前一条指纹不匹配');
  });
});
