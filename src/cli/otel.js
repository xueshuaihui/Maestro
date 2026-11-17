/**
 * I1.12 WP-5 `orch export <type>` carrier (AC-18 / D-9 / D-13 freeze A).
 *
 * Dispatches the three frozen type tokens (`events`, `traces`, `pack`) to the
 * read-only `exportOtel` module. The exit code and the counts travel through
 * `labels.js` keys with ASCII fallbacks; this module carries no Chinese text.
 */

import path from 'node:path';

import * as labels from './labels.js';
import { exportOtel } from '../core/otel-export.js';
import { eventsPath, instanceTracesPath } from '../persistence/paths.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;

const KEYS = Object.freeze({
  done: 'EXPORT_DONE',
  failed: 'EXPORT_FAILED',
  usage: 'EXPORT_USAGE'
});

const FALLBACK = Object.freeze({
  [KEYS.done]: 'EXPORT OK EVENTS {events} SPANS {spans} -> {out}',
  [KEYS.failed]: 'EXPORT FAILED {code}',
  [KEYS.usage]: 'EXPORT USAGE <events|traces|pack>'
});

const TYPES = Object.freeze({
  events: 'events',
  traces: 'traces',
  spans: 'traces',
  trace: 'traces',
  pack: 'pack',
  all: 'pack'
});

function textOf(key) {
  const table = labels.OTEL_TEXT ?? labels.EXPORT_TEXT ?? {};
  return typeof table[key] === 'string' ? table[key] : FALLBACK[key];
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function typeOf(parsed) {
  const candidate = parsed?.sub ??
    parsed?.positional ??
    parsed?.positionals?.[0] ??
    parsed?.flags?.type ??
    '';
  return TYPES[String(candidate).toLowerCase()] ?? null;
}

/**
 * @param {{sub?:string, positional?:string, positionals?:string[], flags?:object}} parsed
 * @param {{cwd?:string, out?:(line:string)=>void, fs?:object,
 *   instanceId?:string, events?:*, spans?:*, outFile?:string}} ctx
 * @returns {Promise<number>} 0 on a successful export, 1 on failure
 */
export async function exportCommand(parsed, ctx) {
  const out = typeof ctx?.out === 'function' ? ctx.out : () => {};
  const root = typeof ctx?.cwd === 'string' && ctx.cwd.length > 0 ? ctx.cwd : '.';
  const type = typeOf(parsed);
  if (type === null) {
    out(fill(textOf(KEYS.usage), { type: parsed?.sub ?? '' }));
    return EXIT_FAILED;
  }

  const instanceId = parsed?.flags?.instance ?? ctx?.instanceId ?? null;
  const wantEvents = type === TYPES.events || type === TYPES.pack;
  const wantSpans = type === TYPES.traces || type === TYPES.pack;
  const events = wantEvents ? (ctx?.events ?? eventsPath(root, instanceId)) : [];
  const spans = wantSpans ? (ctx?.spans ?? instanceTracesPath(root, instanceId)) : [];
  const outFile = parsed?.flags?.out ?? ctx?.outFile ?? path.join(root, 'otel-export.json');

  const result = await exportOtel({ events, spans, instanceId, out: outFile, fs: ctx?.fs });
  if (!result.ok) {
    out(fill(textOf(KEYS.failed), { code: result.code, badLines: result.badLines }));
    return EXIT_FAILED;
  }

  out(fill(textOf(KEYS.done), {
    events: result.count.events,
    spans: result.count.spans,
    out: result.out
  }));
  return EXIT_OK;
}

/** Label keys consumed by the renderer / wiring tests; no text lives here. */
export const EXPORT_LABEL_KEYS = KEYS;
