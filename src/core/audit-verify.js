/**
 * Read-only audit chain verifier (I1.12 WP-1 / AC-01 / AC-02 / D-2 / freeze point 1).
 *
 * This module never mutates the event log and never performs a state transition.
 * It reads `events.jsonl` through the injected read-only `fs` (the injected-fs
 * equivalent of `createStore.readEvents`), then parses lines, recomputes
 * fingerprints with the same canonicalizer the write path uses, and compares
 * each stored `prev_event_hash` with the fingerprint of its predecessor. The
 * first failing record is reported and traversal stops.
 *
 * No clock, no write path, no store mutation is consulted here.
 */

import fs from 'node:fs/promises';
import { ZERO_HASH, canonicalizeEvent, eventFingerprint } from './event-bus.js';
import { eventsPath } from '../persistence/paths.js';

/**
 * Label keys the caller must supply to `verifyChainText` (A-1 / A-2).
 * The Chinese templates live only in `src/cli/labels.js`; this module carries
 * no user-facing literal. WP-7 adds these two keys to the label table.
 */
export const CHAIN_LABEL_KEYS = Object.freeze({
  ok: 'CHAIN_COMPLETE',
  broken: 'CHAIN_BROKEN',
});

function parseLines(lines) {
  const records = [];
  let badLines = 0;
  for (const raw of lines) {
    if (typeof raw !== 'string') {
      badLines += 1;
      continue;
    }
    const line = raw.trim();
    if (line === '') continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }
    if (record === null || typeof record !== 'object' || Array.isArray(record)) {
      badLines += 1;
      continue;
    }
    if (!Number.isInteger(record.seq)) {
      badLines += 1;
      continue;
    }
    records.push(record);
  }
  records.sort((a, b) => a.seq - b.seq);
  return { records, badLines };
}

/**
 * Pure verification core: parse lines, walk the chain, locate the first break.
 * No I/O, no clock; only the frozen read-only traversal (D-2 / §3.1).
 *
 * @param {string} text raw JSONL text of events.jsonl
 * @returns {{ok:true, count:number, total:number, badIndex:null, firstMismatch:null,
 *   badLines:number, gaps:number, historical:number}
 *   |{ok:false, code:'CHAIN_BROKEN', badIndex:number, seq:number, firstMismatch:number,
 *   count:number, total:number, badLines:number, gaps:number, historical:number,
 *   expected:string, actual:string, detail:string}}
 */
function verifyChainCore(text) {
  const { records, badLines: unreadableLines } = parseLines(String(text ?? '').split(/\r?\n/));
  let badLines = unreadableLines;

  let expected = ZERO_HASH;
  let lastSeq = null;
  let historical = 0;
  let gaps = 0;
  let count = 0;

  for (const record of records) {
    const seq = record.seq;
    if (lastSeq !== null && seq !== lastSeq + 1) {
      // A sequence hole is counted as a bad line as well as a gap (D-2 / §3.1),
      // but it is historical: never a chain break and never backfilled.
      gaps += 1;
      badLines += 1;
    }

    if (!Object.prototype.hasOwnProperty.call(record, 'prev_event_hash')) {
      historical += 1;
      expected = eventFingerprint(record);
      lastSeq = seq;
      count += 1;
      continue;
    }

    if (record.prev_event_hash !== expected) {
      return {
        ok: false,
        code: 'CHAIN_BROKEN',
        badIndex: seq,
        seq,
        firstMismatch: seq,
        count,
        total: records.length,
        badLines,
        gaps,
        historical,
        expected,
        actual: record.prev_event_hash,
        detail: `seq ${seq}: prev_event_hash does not match the predecessor fingerprint`,
      };
    }

    expected = eventFingerprint(record);
    lastSeq = seq;
    count += 1;
  }

  return {
    ok: true,
    count,
    total: records.length,
    badIndex: null,
    firstMismatch: null,
    badLines,
    gaps,
    historical,
  };
}

/**
 * Frozen entry point (§2.1 / freeze point 1): verify the audit chain of one
 * instance by reading its `events.jsonl` through the injected read-only `fs`.
 *
 * @param {{root:string, instanceId:string, fs?:object}} opts
 * @returns {Promise<object>} the pure core's result (see `verifyChainCore`)
 */
export async function verifyChain({ root, instanceId, fs: injectedFs } = {}) {
  const io = injectedFs && typeof injectedFs.readFile === 'function' ? injectedFs : fs;
  const file = eventsPath(root, instanceId);
  let text = '';
  try {
    text = await io.readFile(file, 'utf8');
  } catch (err) {
    // A missing event log is an empty chain (same as createStore.readEvents).
    if (err?.code !== 'ENOENT') throw err;
  }
  return verifyChainCore(text);
}

function templateOf(labels, key) {
  if (labels !== null && typeof labels === 'object' && typeof labels[key] === 'string') {
    return labels[key];
  }
  throw new TypeError(`verifyChainText: missing label template "${key}"`);
}

function applyCount(template, n) {
  return template.replace(/\{N\}/g, String(n)).replace(/\[N\]/g, String(n));
}

/**
 * Render a verification result with templates supplied by the label table.
 *
 * @param {object} result value returned by `verifyChain`
 * @param {{CHAIN_COMPLETE:string, CHAIN_BROKEN:string}} labels
 * @returns {string}
 */
export function verifyChainText(result, labels) {
  if (result === null || typeof result !== 'object') {
    throw new TypeError('verifyChainText: result must be an object');
  }
  if (result.ok === true) {
    const n = result.count ?? result.total;
    return applyCount(templateOf(labels, CHAIN_LABEL_KEYS.ok), n);
  }
  const n = result.badIndex ?? result.seq ?? result.firstMismatch;
  return applyCount(templateOf(labels, CHAIN_LABEL_KEYS.broken), n);
}
