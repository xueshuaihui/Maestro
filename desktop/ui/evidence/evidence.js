/**
 * Evidence view model (I1.11 WP-8; requirement A-8 / AC-32 / AC-33 / AC-34 /
 * AC-42).
 *
 * Contract:
 * - Consumes the read-only `buildEvidence` projection
 *   `{ instanceId, items: [{ nodeId, round, command, exitCode,
 *   keyOutputLines, logRef, artifactRefs, unreadable }] }`. Every visible word
 *   comes from the label table; this module owns no wording (D-36).
 * - Five fields + round per item, in the fixed A-8 order: node header, command,
 *   exit code, key-output count, log reference, artifact references, then the
 *   trailing host line. A missing field (`null`) renders the `unprovided`
 *   word; a value found in the item's `unreadable` list renders the `unreadable`
 *   word appended to that field; a truncated value is marked with the
 *   `truncated` prefix — never the raw body.
 * - No log body and no session text is ever read or emitted: only references
 *   and counts pass through. The daemon already capped each value; this module
 *   only formats what it was given.
 * - UI-layer 64 KB gate (AC-34): `renderEvidence` measures the UTF-8 byte
 *   length of the composed text; when it exceeds the cap it truncates at a
 *   safe boundary and appends the `truncated` word, so an oversized reference
 *   can never leak extra body into the screen.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals; no recomputation of counts or rounds.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

/** AC-34 UI render cap (bytes). */
export const RENDER_LIMIT_BYTES = 64 * 1024;

const NODE_ROW_KEY = 'DESKTOP_EVIDENCE_NODE_ROW';
const ARTIFACT_KEY = 'DESKTOP_EVIDENCE_ARTIFACT';
const VERIFIED_KEY = 'DESKTOP_EVIDENCE_VERIFIED_AT';
const UNPROVIDED_KEY = 'DESKTOP_EVIDENCE_UNPROVIDED';
const LOG_ON_HOST_KEY = 'DESKTOP_EVIDENCE_LOG_ON_HOST';
const UNREADABLE_KEY = 'DESKTOP_EVIDENCE_UNREADABLE';
const TRUNCATED_KEY = 'DESKTOP_EVIDENCE_TRUNCATED';
const OUTPUT_LINES_KEY = 'SUMMARY_OUTPUT_LINES';
/**
 * Field specs: the A-8 label key, the projection field it reads, and whether
 * the value is a line count (unit suffix) or a plain reference.
 */
const FIELDS = Object.freeze([
  { labelKey: 'SUMMARY_LABEL_COMMAND', source: 'command', lines: false },
  { labelKey: 'SUMMARY_LABEL_EXIT_CODE', source: 'exitCode', lines: false },
  { labelKey: 'SUMMARY_LABEL_KEY_OUTPUT', source: 'keyOutputLines', lines: true },
  { labelKey: 'SUMMARY_LABEL_LOG', source: 'logRef', lines: false },
]);

/** Middle-dot separator (A-8) — structural glyph, not a wording literal. */
const SEP = ' \u00B7 ';

function tableOf(labels) {
  return resolveLabels(labels).keys;
}

function word(labels, key) {
  const value = tableOf(labels)[key];
  return typeof value === 'string' ? value : null;
}

function isPlain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function missing(value) {
  return value === null || value === undefined;
}

function listOf(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Unreadable entries are daemon-supplied strings: either a raw reference value
 * (the value is unreadable) or a `TRUNCATED:field` marker. The word `truncated`
 * comes from the label table, so a marker is recognised by the prefix the
 * daemon built from that same word.
 */
function unreadableSet(item, labels) {
  const out = new Set();
  const truncated = word(labels, TRUNCATED_KEY);
  for (const entry of listOf(item?.unreadable)) {
    if (typeof entry !== 'string') continue;
    out.add(entry);
    if (truncated !== null && entry.startsWith(`${truncated}\uFF1A`)) {
      out.add(entry.slice(truncated.length + 1)); // field name, e.g. "command"
    }
  }
  return out;
}

function truncatedFields(item, labels) {
  const out = [];
  const truncated = word(labels, TRUNCATED_KEY);
  for (const entry of listOf(item?.unreadable)) {
    if (typeof entry === 'string' && truncated !== null && entry.startsWith(`${truncated}\uFF1A`)) {
      out.push(entry.slice(truncated.length + 1));
    }
  }
  return out;
}

/**
 * One field line: `label value`, where the value is the `unprovided` word when
 * absent, the `unreadable` word when the daemon marked the value unreadable,
 * and the raw value otherwise. The key-output field appends the line-count unit.
 *
 * @returns {string|null} null when the field template key is unavailable
 */
function fieldLine(item, spec, labels, unreadable) {
  const labelWord = word(labels, spec.labelKey);
  if (labelWord === null) return null;
  const unprovided = word(labels, UNPROVIDED_KEY) ?? '';
  const bad = word(labels, UNREADABLE_KEY) ?? '';
  const raw = item?.[spec.source];
  let value;
  if (missing(raw)) {
    value = unprovided;
  } else if (unreadable.has(String(raw))) {
    value = `${String(raw)} ${bad}`.trim();
  } else {
    value = String(raw);
    if (spec.lines) {
      const unit = word(labels, OUTPUT_LINES_KEY);
      if (unit !== null) value = fillTemplate(unit, { n: value });
    }
  }
  return `${labelWord} ${value}`.trim();
}

/**
 * Artifact reference lines (A-8): one line per reference, `artifact ref`, with
 * an optional `verifiedAt` suffix. An unreadable reference is marked with the
 * `unreadable` word. When nothing was provided, one `unprovided` line renders.
 */
function artifactLines(item, labels, unreadable) {
  const artifact = word(labels, ARTIFACT_KEY);
  if (artifact === null) return [];
  const unprovided = word(labels, UNPROVIDED_KEY) ?? '';
  const bad = word(labels, UNREADABLE_KEY) ?? '';
  const verified = word(labels, VERIFIED_KEY);
  const refs = listOf(item?.artifactRefs).filter(isPlain);
  if (refs.length === 0) return [`${artifact} ${unprovided}`.trim()];
  return refs.map((ref) => {
    const refText = typeof ref.ref === 'string' ? ref.ref : unprovided;
    let line = `${artifact} ${refText}`.trim();
    if (unreadable.has(refText)) line = `${line} ${bad}`.trim();
    if (verified !== null && typeof ref.verifiedAt === 'string' && ref.verifiedAt.length > 0) {
      line = `${line}${SEP}${fillTemplate(verified, { at: ref.verifiedAt })}`.trim();
    }
    return line;
  });
}

/**
 * Render one evidence item into its A-8 lines. The node header carries the
 * round; the five fields follow in fixed order; truncation is flagged on its
 * own line; the host line closes the block.
 *
 * @param {object} item the frozen projection item (read-only)
 * @param {unknown} labels
 * @returns {{ nodeId: string|null, round: number|null, lines: string[] }}
 */
export function itemLines(item, labels) {
  if (!isPlain(item)) return { nodeId: null, round: null, lines: [] };
  const nodeId = typeof item.nodeId === 'string' ? item.nodeId : null;
  const round = Number.isInteger(item.round) ? item.round : null;
  const lines = [];
  const header = word(labels, NODE_ROW_KEY);
  if (header !== null) {
    lines.push(fillTemplate(header, {
      id: nodeId ?? '',
      n: round === null ? (word(labels, UNPROVIDED_KEY) ?? '') : round,
    }));
  }
  const unreadable = unreadableSet(item, labels);
  for (const spec of FIELDS) {
    const line = fieldLine(item, spec, labels, unreadable);
    if (line !== null) lines.push(line);
  }
  for (const line of artifactLines(item, labels, unreadable)) lines.push(line);
  const truncated = word(labels, TRUNCATED_KEY);
  for (const field of truncatedFields(item, labels)) {
    if (truncated !== null) lines.push(`${truncated}\uFF1A${field}`);
  }
  const host = word(labels, LOG_ON_HOST_KEY);
  if (host !== null) lines.push(host);
  return { nodeId, round, lines };
}

/**
 * UTF-8 byte length of a string.
 *
 * This module runs in the desktop shell's browser context, where `Buffer` does
 * not exist: calling it unguarded threw `ReferenceError: Buffer is not defined`
 * and left the evidence tab blank. Node's Buffer is preferred when present so
 * the unit tests keep their exact byte counts; `TextEncoder` is the browser
 * equivalent (same UTF-8 encoding, same numbers).
 */
function byteLength(text) {
  const source = typeof text === 'string' ? text : '';
  if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
    return Buffer.byteLength(source, 'utf8');
  }
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(source).length;
  // Last resort: count code points at worst-case 3 bytes. Only reachable in an
  // environment with neither Buffer nor TextEncoder.
  return source.length * 3;
}

/**
 * UI-layer 64 KB final gate (AC-34). Returns the text unchanged when within
 * the cap; otherwise truncates to a safe byte boundary and appends the
 * `truncated` word. The cut never exposes additional body beyond the cap.
 *
 * @param {string} text
 * @param {unknown} labels
 * @param {number} [limit]
 * @returns {{ text: string, capped: boolean, bytes: number }}
 */
export function capText(text, labels, limit = RENDER_LIMIT_BYTES) {
  const source = typeof text === 'string' ? text : '';
  const cap = Number.isFinite(limit) && limit > 0 ? limit : RENDER_LIMIT_BYTES;
  if (byteLength(source) <= cap) return { text: source, capped: false, bytes: byteLength(source) };
  const marker = word(labels, TRUNCATED_KEY) ?? '';
  const suffix = marker.length > 0 ? `\n${marker}` : '';
  const budget = Math.max(0, cap - byteLength(suffix));
  // Slice by code points until the byte budget is met; never split a surrogate.
  let out = '';
  let used = 0;
  for (const ch of source) {
    const n = byteLength(ch);
    if (used + n > budget) break;
    out += ch;
    used += n;
  }
  const finalText = `${out}${suffix}`;
  return { text: finalText, capped: true, bytes: byteLength(finalText) };
}

/**
 * Render the whole evidence projection: each item's A-8 lines joined by
 * newlines, blocks separated by a blank line, then the 64 KB UI gate.
 *
 * @param {object} projection the frozen buildEvidence projection (read-only)
 * @param {unknown} labels
 * @returns {{ instanceId: string|null, items: Array<{nodeId, round, lines}>,
 *             text: string, capped: boolean, bytes: number }}
 */
export function renderEvidence(projection, labels) {
  const instanceId = isPlain(projection) && typeof projection.instanceId === 'string'
    ? projection.instanceId
    : null;
  const items = [];
  const blocks = [];
  for (const item of listOf(isPlain(projection) ? projection.items : [])) {
    const rendered = itemLines(item, labels);
    items.push(rendered);
    blocks.push(rendered.lines.join('\n'));
  }
  const capped = capText(blocks.join('\n\n'), labels);
  return {
    instanceId,
    items,
    text: capped.text,
    capped: capped.capped,
    bytes: capped.bytes,
  };
}
