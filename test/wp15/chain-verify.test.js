/**
 * I1.12 WP-1 / AC-01 contract tests.
 *
 * Independent %TEMP% root + NODE_ENV=test. No process spawn, no bash, no CLI
 * wiring (that belongs to WP-7). Exit-code checks use the documented
 * `ok` / `code -> exit` mapping of verifyChain. A-1 / A-2 literals are asserted
 * verbatim against templates supplied through the label-table fixture.
 *
 * verifyChain is called with the frozen signature ({root, instanceId, fs}) and
 * an explicit injected fs. Fixture bytes are written by test setup only; the
 * verifier itself stays read-only (asserted by hash before/after every call).
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
  eventFingerprint,
} from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

/** Stand-in for the label table WP-7 will extend; A-1 / A-2 verbatim. */
const LABELS = Object.freeze({
  [CHAIN_LABEL_KEYS.ok]: '链完整，共 {N} 条',
  [CHAIN_LABEL_KEYS.broken]: '链已断：第 {N} 条记录与前一条指纹不匹配',
});

const INSTANCE = 'INST-VERIFY';
const FIXED_TS = '2026-11-18T00:00:00.000Z';
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** ok/code -> process exit code (WP-7 verifyCommand will own the real mapping). */
function exitCodeOf(result) {
  return result && result.ok === true ? 0 : 1;
}

async function withTempRoot(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-i112-verify-'));
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

const SEEDS = [
  { object: 'run', result: 'applied', reason: 'run.started' },
  { object: 'node', objectId: 'T-002', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-003', from: null, to: 'delivered', result: 'applied', reason: 'handoff.delivered' },
];

/** Produce a real chain through the untouched write path, return raw log text. */
async function makeChain(root) {
  const store = createStore({ root });
  const bus = createEventBus({ store, clock: () => Date.parse(FIXED_TS) });
  for (const seed of SEEDS) {
    const emitted = await bus.emit({ instanceId: INSTANCE, ...seed });
    assert.equal(emitted.ok, true, 'fixture emit must succeed');
  }
  const file = eventsPath(root, INSTANCE);
  return { file, text: await fs.readFile(file, 'utf8') };
}

function splitLines(text) {
  return text.trimEnd().split('\n');
}

test('导出与文案键契约（冻结点① / A-1 / A-2）', () => {
  assert.equal(typeof verifyChain, 'function');
  assert.equal(typeof verifyChainText, 'function');
  assert.deepEqual({ ...CHAIN_LABEL_KEYS }, {
    ok: 'CHAIN_COMPLETE',
    broken: 'CHAIN_BROKEN',
  });
  assert.throws(
    () => verifyChainText({ ok: true, count: 1 }, {}),
    /CHAIN_COMPLETE/,
    'no hardcoded Chinese fallback when label key is absent',
  );
});

test('架构检查：校验模块只读、无时钟判定', async () => {
  const source = await fs.readFile(
    new URL('../../src/core/audit-verify.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /writeFile|appendFile|unlink|saveState|transit\(/);
  assert.doesNotMatch(source, /Date\.now/);
});

test('冻结签名入口：按 {root,instanceId,fs} 调用返回 Promise 与 ok 结构', async () => {
  await withTempRoot(async (root) => {
    await makeChain(root);
    const pending = verifyChain({ root, instanceId: INSTANCE, fs });
    assert.equal(typeof pending.then, 'function', 'frozen entry must be async');
    const result = await pending;
    assert.equal(result.ok, true);
    assert.equal(result.total, 3);
  });
});

test('AC-01 正常链：A-1 逐字、count=N、退出码 0、原件哈希不变', async () => {
  await withTempRoot(async (root) => {
    const { file, text } = await makeChain(root);
    const before = sha256(text);

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, true);
    assert.equal(result.count, 3);
    assert.equal(result.total, 3);
    assert.equal(result.badIndex, null);
    assert.equal(result.firstMismatch, null);
    assert.equal(exitCodeOf(result), 0);
    assert.equal(verifyChainText(result, LABELS), '链完整，共 3 条');
    assert.equal(sha256(await fs.readFile(file, 'utf8')), before);
  });
});

test('AC-01 篡改中间一条的指纹字段：首处失配序号=2、A-2 逐字、退出码非 0', async () => {
  await withTempRoot(async (root) => {
    const { text } = await makeChain(root);
    const lines = splitLines(text);
    assert.equal(lines.length, 3);
    const middle = JSON.parse(lines[1]);
    assert.equal(middle.seq, 2);
    const head = middle.prev_event_hash[0];
    middle.prev_event_hash = (head === '0' ? '1' : '0') + middle.prev_event_hash.slice(1);
    lines[1] = JSON.stringify(middle);

    const file = await writeLog(root, INSTANCE, `${lines.join('\n')}\n`);
    const before = sha256(await fs.readFile(file, 'utf8'));

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'CHAIN_BROKEN');
    assert.equal(result.badIndex, 2);
    assert.equal(result.seq, 2);
    assert.equal(result.firstMismatch, 2);
    assert.notEqual(exitCodeOf(result), 0);
    assert.equal(verifyChainText(result, LABELS), '链已断：第 2 条记录与前一条指纹不匹配');
    assert.equal(sha256(await fs.readFile(file, 'utf8')), before);
  });
});

test('AC-01 篡改中间一条的内容字段：100% 命中，首处失配落在其后继记录', async () => {
  await withTempRoot(async (root) => {
    const { text } = await makeChain(root);
    const lines = splitLines(text);
    const middle = JSON.parse(lines[1]);
    middle.to = 'frozen';
    lines[1] = JSON.stringify(middle);

    const file = await writeLog(root, INSTANCE, `${lines.join('\n')}\n`);
    const before = sha256(await fs.readFile(file, 'utf8'));

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'CHAIN_BROKEN');
    // D-2: record 2's own prev is still valid; record 3 is the first record whose
    // stored prev no longer equals the fingerprint of record 2 as written.
    assert.equal(result.badIndex, 3);
    assert.equal(result.seq, 3);
    assert.equal(result.firstMismatch, 3);
    assert.equal(verifyChainText(result, LABELS), '链已断：第 3 条记录与前一条指纹不匹配');
    assert.equal(sha256(await fs.readFile(file, 'utf8')), before);
  });
});

test('AC-02 历史遗留无标记记录：不校验、不算断点', async () => {
  await withTempRoot(async (root) => {
    const legacy = { seq: 1, ts: FIXED_TS, object: 'run', result: 'applied', reason: 'run.started' };
    const second = {
      seq: 2,
      ts: FIXED_TS,
      prev_event_hash: eventFingerprint(legacy),
      object: 'node',
      to: 'running',
    };
    const third = {
      seq: 3,
      ts: FIXED_TS,
      prev_event_hash: eventFingerprint(second),
      object: 'handoff',
      to: 'delivered',
    };
    const lines = [legacy, second, third].map((record) => JSON.stringify(record));
    await writeLog(root, INSTANCE, `${lines.join('\n')}\n`);

    const result = await verifyChain({ root, instanceId: INSTANCE, fs });

    assert.equal(result.ok, true);
    assert.equal(result.count, 3);
    assert.equal(result.historical, 1);
    assert.equal(result.badIndex, null);
    assert.equal(verifyChainText(result, LABELS), '链完整，共 3 条');
    assert.equal(ZERO_HASH.length, 64);
  });
});
