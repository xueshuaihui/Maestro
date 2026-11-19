/**
 * AC-02 · 链式哈希加固与 I1.9 基线衔接（mock / 夹具面）。
 * 用未改写的落盘通道产生两段事件：旧段字节/序号/前序指纹不变，新段接续。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import {
  ACC12_PATHS, freshRoot, sha256, loadLabels, fillCount, cleanupRoot,
} from '../acc12-f-lib.mjs';
import {
  makeCase, eq, includes, check, verify, evidence, note, finish,
} from '../acc12-f-common.mjs';

import { verifyChain, verifyChainText, CHAIN_LABEL_KEYS } from '../../src/core/audit-verify.js';
import { ZERO_HASH, createEventBus, eventFingerprint } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

const INSTANCE = 'INST-CHAIN';
const FIXED_TS = '2026-11-18T00:00:00.000Z';
const SEG1 = [
  { object: 'run', result: 'applied', reason: 'run.started' },
  { object: 'node', objectId: 'T-002', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-003', from: null, to: 'delivered', result: 'applied', reason: 'handoff.delivered' },
];
const SEG2 = [
  { object: 'node', objectId: 'T-003', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  { object: 'handoff', objectId: 'HO-004', from: 'created', to: 'accepted', result: 'applied', reason: 'handoff.accepted' },
];

export async function run() {
  const labels = await loadLabels();
  const c = makeCase('AC-02', { scenario: 'chain', title: '链式哈希加固与 I1.9 基线衔接' });
  c.root = freshRoot('chain-ac02');
  const file = eventsPath(c.root, INSTANCE);

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const store = createStore({ root: c.root });
    const bus = createEventBus({ store, clock: () => Date.parse(FIXED_TS) });
    for (const seed of SEG1) {
      const emitted = await bus.emit({ instanceId: INSTANCE, ...seed });
      eq(c, `夹具：旧段落盘 seq=${emitted.seq ?? '?'} 成功`, emitted.ok, true);
    }
    const baselineText = fs.readFileSync(file, 'utf8');
    const baselineLines = baselineText.trimEnd().split(/\r?\n/);
    eq(c, 'Given：旧段为一段连续事件（3 条）', baselineLines.length, 3);
    evidence(c, 'fixture', 'baseline.events.jsonl', baselineText);

    for (const seed of SEG2) {
      const emitted = await bus.emit({ instanceId: INSTANCE, ...seed });
      eq(c, `夹具：新段落盘 seq=${emitted.seq ?? '?'} 成功`, emitted.ok, true);
    }
    const afterText = fs.readFileSync(file, 'utf8');
    const afterLines = afterText.trimEnd().split(/\r?\n/);
    evidence(c, 'fixture', 'after.events.jsonl', afterText);

    const result = await verifyChain({ root: c.root, instanceId: INSTANCE, fs: fsp });
    eq(c, 'Then：整链校验通过（无断点）', result.ok, true);
    eq(c, 'Then：断点数为 0', result.firstMismatch, null);
    eq(c, 'Then：总条数 = 5', result.total, 5);

    const firstLine = JSON.parse(baselineLines[0]);
    const oldLast = JSON.parse(baselineLines[baselineLines.length - 1]);
    eq(c, 'I1.9 基线：首条前序指纹为 64 个 0', firstLine.prev_event_hash, ZERO_HASH);
    eq(c, 'I1.9 基线：ZERO_HASH 长度为 64', ZERO_HASH.length, 64);

    for (let i = 0; i < baselineLines.length; i += 1) {
      eq(c, `Then：旧行字节内容逐条不变 line ${i + 1}`, afterLines[i], baselineLines[i]);
    }
    eq(c, '机检：旧 N 行字节哈希运行前后一致', sha256(afterLines.slice(0, baselineLines.length).join('\n')),
      sha256(baselineLines.join('\n')));

    const newFirst = JSON.parse(afterLines[baselineLines.length]);
    const newSecond = JSON.parse(afterLines[baselineLines.length + 1]);
    eq(c, 'Then：新行序号从 N+1 起（4）', newFirst.seq, baselineLines.length + 1);
    eq(c, 'Then：新行序号连续（5）', newSecond.seq, baselineLines.length + 2);
    eq(c, 'Then：新行首条 prev_event_hash 等于旧末条规范化指纹',
      newFirst.prev_event_hash, eventFingerprint(oldLast));
    eq(c, 'Then：新行第二条 prev_event_hash 等于新行首条指纹',
      newSecond.prev_event_hash, eventFingerprint(newFirst));

    const zeroCount = afterLines.filter((line) => JSON.parse(line).prev_event_hash === ZERO_HASH).length;
    eq(c, 'Then：不出现第二个起点（仅 1 条 ZERO_HASH）', zeroCount, 1);

    const render = verifyChainText(result, {
      [CHAIN_LABEL_KEYS.ok]: labels.CHAIN_COMPLETE,
      [CHAIN_LABEL_KEYS.broken]: labels.CHAIN_BROKEN,
    });
    const expectedOk = fillCount(labels.CHAIN_COMPLETE, result.total);
    includes(c, 'Then：A-1「链完整，共 N 条」逐字', render, expectedOk);

    evidence(c, 'verify', 'result.json', JSON.stringify({
      ok: result.ok, total: result.total, count: result.count,
      firstMismatch: result.firstMismatch, badLines: result.badLines,
      gaps: result.gaps, historical: result.historical, render, expectedOk,
    }, null, 2));
    evidence(c, 'meta', 'fingerprints.json', JSON.stringify({
      zeroHash: ZERO_HASH,
      oldLastFingerprint: eventFingerprint(oldLast),
      newFirstPrev: newFirst.prev_event_hash,
      newSecondPrev: newSecond.prev_event_hash,
      baselineSha256: sha256(baselineText),
      afterSha256: sha256(afterText),
      zeroCount,
    }, null, 2));
    evidence(c, 'summary', 'status.txt', [
      `verdict-pending; checks=${c.checks.length}`,
      `old=${baselineLines.length} new=${afterLines.length - baselineLines.length}`,
      `render=${render}`,
    ].join('\n'));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}
