/**
 * I1.12 WP-5 read-only OTLP export carrier (AC-18 / D-9 / freeze point 5).
 *
 * Contract: turn event-log records into OTLP log records and trace spans into
 * OTLP trace spans, then write the bundle to the caller supplied `out` file.
 *
 * Read-only discipline: event and trace sources are consumed as data only.
 * The single write in this module targets `out` through the injected fs; there
 * is no append to an event/trace path, no state transition and no emit path.
 * All user-facing text is owned by src/cli/labels.js; this file holds only
 * machine codes and ASCII identifiers.
 */

import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

/** Machine codes carried in the `{ok:false}` branch. */
export const EXPORT_CODES = Object.freeze({
  outRequired: 'EXPORT_OUT_REQUIRED',
  writeFailed: 'EXPORT_WRITE_FAILED'
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Accept every source shape the runtime or a contract test may hand over:
 *  - a file path string (read through the injected fs, never written)
 *  - an array of parsed records or raw JSON lines
 *  - a `{path}` / `{lines}` wrapper
 *  - null / undefined (no data at all)
 * Broken lines are skipped and counted; they never fail the whole export.
 *
 * @returns {Promise<{records:object[], badLines:number}>}
 */
async function readSource(source, io) {
  if (source === null || source === undefined) return { records: [], badLines: 0 };

  let raw = source;
  if (typeof source === 'string') {
    try {
      raw = await io.readFile(source, 'utf8');
    } catch {
      return { records: [], badLines: 0 };
    }
  } else if (isRecord(source) && typeof source.path === 'string') {
    try {
      raw = await io.readFile(source.path, 'utf8');
    } catch {
      return { records: [], badLines: 0 };
    }
  } else if (isRecord(source) && Array.isArray(source.lines)) {
    raw = source.lines;
  }

  let items;
  if (typeof raw === 'string') {
    items = raw.split(/\r?\n/);
  } else if (Array.isArray(raw)) {
    items = raw;
  } else {
    return { records: [], badLines: 0 };
  }

  const records = [];
  let badLines = 0;
  for (const line of items) {
    if (typeof line === 'string') {
      const text = line.trim();
      if (text === '') continue;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        badLines += 1;
        continue;
      }
      if (!isRecord(value)) {
        badLines += 1;
        continue;
      }
      records.push(value);
    } else if (isRecord(line)) {
      records.push(line);
    } else {
      badLines += 1;
    }
  }
  return { records, badLines };
}

function stableId(seed, length) {
  return crypto.createHash('sha256').update(String(seed), 'utf8').digest('hex').slice(0, length);
}

/**
 * Handoff ids are not stored on a landed span, so prefer an explicit field and
 * otherwise derive them from the event stream by matching node id and round.
 */
function handoffIdsOf(span, events) {
  if (Array.isArray(span.handoff_ids)) return span.handoff_ids.slice();
  if (Array.isArray(span.handoffIds)) return span.handoffIds.slice();
  const nodeId = span.node_id ?? span.nodeId ?? null;
  const round = Number(span.round);
  const ids = [];
  for (const event of events) {
    if (event?.object !== 'handoff') continue;
    const detail = isRecord(event.detail) ? event.detail : {};
    const matchesNode = nodeId === null ||
      detail.nodeId === nodeId || detail.node_id === nodeId || event.objectId === nodeId;
    const matchesRound = !Number.isFinite(round) ||
      Number(detail.round) === round || Number(event.round) === round;
    const id = event.objectId ?? detail.handoffId ?? detail.handoff_id ?? null;
    if (matchesNode && matchesRound && id !== null && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** span -> OTLP trace span (frozen field set in iteration-12.md 3.6 / D-9). */
function spanToTraceSpan(span, events, fallbackTraceId) {
  const nodeId = span.node_id ?? span.nodeId ?? null;
  const round = span.round ?? null;
  return {
    trace_id: span.trace_id ?? span.traceId ?? fallbackTraceId ?? null,
    span_id: span.span_id ?? span.spanId ?? stableId(`${nodeId ?? 'node'}|${round ?? 0}`, 16),
    start_time: span.start_time ?? span.startTime ?? null,
    end_time: span.end_time ?? span.endTime ?? null,
    status: span.status ?? null,
    handoff_ids: handoffIdsOf(span, events)
  };
}

/** event -> OTLP log record (frozen field set in iteration-12.md 3.6 / D-9). */
function eventToLogRecord(event) {
  const attributes = {};
  for (const key of Object.keys(event)) {
    if (key === 'severity' || key === 'body') continue;
    attributes[key] = event[key];
  }
  if (event.object === 'handoff' && !attributes.handoffId && event.objectId) {
    attributes.handoffId = event.objectId;
  }
  const severity = typeof event.severity === 'string'
    ? event.severity
    : (event.result === 'applied' ? 'INFO' : 'WARN');
  return {
    severity,
    body: typeof event.body === 'string'
      ? event.body
      : (event.reason ?? event.object ?? ''),
    attributes
  };
}

/**
 * Export events and spans as one OTLP-shaped document.
 *
 * @param {object} args
 * @param {*} args.events event file path, raw lines, parsed records or null
 * @param {*} args.spans  trace file path, raw lines, parsed records or null
 * @param {string} args.instanceId resource attribute value
 * @param {string} args.out destination file path (the only write target)
 * @param {object} [args.fs] fs/promises compatible object; defaults to node:fs/promises
 * @returns {Promise<{ok:true, count:{events:number, spans:number}, out:string}
 *   |{ok:false, code:string, badLines:number}>}
 */
export async function exportOtel({ events, spans, instanceId, out, fs } = {}) {
  const io = fs ?? fsp;
  const [eventData, spanData] = await Promise.all([
    readSource(events, io),
    readSource(spans, io)
  ]);
  const badLines = eventData.badLines + spanData.badLines;

  if (typeof out !== 'string' || out.length === 0) {
    return { ok: false, code: EXPORT_CODES.outRequired, badLines };
  }

  const fallbackTraceId = spanData.records.find((s) => s?.trace_id)?.trace_id ?? null;
  const document = {
    resource: { instance_id: instanceId ?? null },
    traceSpans: spanData.records.map((span) => spanToTraceSpan(span, eventData.records, fallbackTraceId)),
    logRecords: eventData.records.map(eventToLogRecord),
    skipped: { badLines }
  };

  try {
    await io.writeFile(out, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } catch {
    return { ok: false, code: EXPORT_CODES.writeFailed, badLines };
  }

  return {
    ok: true,
    count: { events: document.logRecords.length, spans: document.traceSpans.length },
    out
  };
}
