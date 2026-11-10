/**
 * Trace log primitives (I1.9, WP-1).
 *
 * A trace is one JSON object per line in `<instance>/state/traces.jsonl`.
 * Each line carries exactly seven fields. The `handoff_ids` display value is
 * never stored here: consumers derive it from the current state snapshot with
 * `deriveHandoffIds`. Running nodes are projected in memory by
 * `overlayRunningSpans` and never appended to the file.
 *
 * This module stays free of display text and host-specific branches; caller
 * code owns all rendering and all decisions about when to append a span.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

import { instanceTracesPath } from '../persistence/paths.js';

const APPEND_FAILED = 'TRACE_APPEND_FAILED';

/** A fresh per-instance trace id: `TRC-` plus eight lowercase hex chars. */
export function newTraceId() {
  return `TRC-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Append one span as a single full line. The parent directory is created on
 * demand. Only the seven contracted fields are written; any extra keys on the
 * input (for example `handoff_ids`) are dropped.
 *
 * @returns {Promise<{ok:true}|{ok:false, code:string}>}
 */
export async function appendSpan(root, instanceId, span) {
  const filePath = instanceTracesPath(root, instanceId);
  const record = {
    trace_id: span?.trace_id ?? null,
    instance_id: span?.instance_id ?? instanceId ?? null,
    node_id: span?.node_id ?? null,
    round: span?.round ?? null,
    start_time: span?.start_time ?? null,
    end_time: span?.end_time ?? null,
    status: span?.status ?? null,
  };
  const line = `${JSON.stringify(record)}\n`;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, line, 'utf8');
    return { ok: true };
  } catch {
    return { ok: false, code: APPEND_FAILED };
  }
}

/**
 * Read every parseable span. A missing or unreadable file yields an empty set.
 * One broken line is skipped and counted instead of failing the whole file.
 *
 * @returns {Promise<{spans:object[], badLines:number}>}
 */
export async function readTraces(root, instanceId) {
  const filePath = instanceTracesPath(root, instanceId);
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return { spans: [], badLines: 0 };
  }
  const spans = [];
  let badLines = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const value = JSON.parse(trimmed);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        spans.push(value);
      } else {
        badLines += 1;
      }
    } catch {
      badLines += 1;
    }
  }
  return { spans, badLines };
}

function idOf(handoff) {
  return handoff?.handoffId ?? handoff?.id ?? null;
}

function fromOf(handoff) {
  return handoff?.fromNodeId ?? handoff?.edge?.from ?? null;
}

function toOf(handoff) {
  return handoff?.toNodeId ?? handoff?.edge?.to ?? null;
}

function isBackflow(handoff) {
  const kind = handoff?.edge?.kind ?? handoff?.edgeKind ?? handoff?.kind ?? null;
  return kind === 'backflow';
}

function createdAtKey(handoff) {
  const value = Date.parse(String(handoff?.createdAt ?? ''));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Derive the handoff ids shown for one span, computed from the current state
 * instead of stored on disk.
 *
 * Received packages: `toNodeId === nodeId && round === r`.
 * Produced packages: `fromNodeId === nodeId` and the package round equals `r`
 * for a forward package or `r + 1` for a backflow package. A backflow created
 * by a later step carries the receiver's next round, so filtering only on
 * `round === r` would drop it from the producer's current span.
 *
 * Results are ordered by `createdAt` ascending and de-duplicated by id.
 *
 * @returns {string[]}
 */
export function deriveHandoffIds(state, nodeId, round) {
  const handoffs = Array.isArray(state?.handoffs) ? state.handoffs : [];
  const r = Number(round);
  const matched = [];
  for (const handoff of handoffs) {
    if (!handoff || typeof handoff !== 'object') continue;
    const id = idOf(handoff);
    if (typeof id !== 'string' || id.length === 0) continue;
    const hr = Number(handoff.round);
    const received = toOf(handoff) === nodeId && hr === r;
    const produced = fromOf(handoff) === nodeId &&
      (isBackflow(handoff) ? hr === r + 1 : hr === r);
    if (received || produced) matched.push({ id, at: createdAtKey(handoff) });
  }
  matched.sort((a, b) => a.at - b.at);
  const seen = new Set();
  const ids = [];
  for (const item of matched) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    ids.push(item.id);
  }
  return ids;
}

/**
 * Project the in-progress spans for nodes still marked `running` that have no
 * landed span for the same node and round. Pure: it never writes a file and the
 * returned entries are not counted as landed spans. `end_time` is null so
 * consumers can render their own placeholder.
 *
 * @returns {object[]}
 */
export function overlayRunningSpans(state, spans) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const landed = Array.isArray(spans) ? spans : [];
  const traceId = landed.length > 0 ? (landed[0]?.trace_id ?? null) : null;
  const instanceId = state?.instanceId ??
    (landed.length > 0 ? landed[0]?.instance_id ?? null : null);
  const result = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || node.state !== 'running') continue;
    const nodeId = node.nodeId ?? node.id ?? null;
    const round = node.round;
    const alreadyDone = landed.some((s) =>
      s && typeof s === 'object' &&
      (s.node_id ?? s.nodeId ?? null) === nodeId &&
      Number(s.round) === Number(round)
    );
    if (alreadyDone) continue;
    result.push({
      trace_id: traceId,
      instance_id: instanceId,
      node_id: nodeId,
      round: Number.isFinite(Number(round)) ? Number(round) : round,
      start_time: node.startedAt ?? null,
      end_time: null,
      status: 'running',
      running: true,
    });
  }
  return result;
}
