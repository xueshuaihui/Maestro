/**
 * Connection line text projection (I1.10a WP-6; A-11 / AC-23 / AC-25).
 *
 * Contract (split doc 2.2):
 * - `renderEdgeRow(edge, labels)` projects one frozen projection edge into the
 *   A-11 text row (line prefix, endpoints, direction word, status word), plus the
 *   the parallel-handoff suffix when `parallelCount > 1`. Every token comes from
 *   the frozen keys (`DESKTOP_EDGE_ROW`, `DESKTOP_EDGE_ROW_PARALLEL`,
 *   `DESKTOP_EDGE_DIRECTION_*`, `HANDOFF_LABEL_*`, `DESKTOP_EDGE_NOT_STARTED`),
 *   so the row never invents a second wording for a state.
 * - `accepted` lines keep the plain accepted word as the row text and expose the merged
 *   "accepted while processing" wording through `hoverText` (A-11: the label
 *   reads the accepted-and-processing wording on hover).
 * - The visual tokens (colour / dash / arrow / animation / badge) are carried
 *   through from `edge.visual` untouched: the frozen A-11 table belongs to the
 *   projection layer, and this module must never derive colour from the line
 *   count or position (AC-15 architecture note).
 * - Endpoint display names come from `edge.fromTitle` / `edge.toTitle` when the
 *   caller annotates them; otherwise the id is used with a leading `role:`
 *   namespace stripped, so `role:dev` renders as `dev` instead of an internal
 *   id.
 * - The label table may arrive in either accepted shape (B-18, same seam as
 *   `renderLegend`): the flat key table or the `GET /ui/labels` body
 *   `{ keys: { "<KEY>": "<template>" } }`. A table without `DESKTOP_EDGE_ROW`
 *   throws a `TypeError` naming the key instead of degrading to `text: null`.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

/** Aggregate state -> status word key (A-11 last column uses the same states). */
const STATUS_WORD_KEY = Object.freeze({
  rejected: 'HANDOFF_LABEL_REJECTED',
  expired: 'HANDOFF_LABEL_EXPIRED',
  pending: 'HANDOFF_LABEL_PENDING',
  delivered: 'HANDOFF_LABEL_DELIVERED',
  accepted: 'HANDOFF_LABEL_ACCEPTED',
  consumed: 'HANDOFF_LABEL_CONSUMED',
  not_started: 'DESKTOP_EDGE_NOT_STARTED',
});

function textOf(labels, key) {
  if (labels === null || typeof labels !== 'object' || typeof key !== 'string') return null;
  const value = labels[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Normalise either accepted label shape to the flat key table and assert the
 * row template this projection cannot render without. Shape handling is
 * delegated to `resolveLabels`, the same seam the legend uses.
 *
 * @param {unknown} labels flat key table or `{ keys: {...} }` payload
 * @throws {TypeError} naming the missing key
 * @returns {Record<string, string>}
 */
function requireLabelTable(labels) {
  const table = resolveLabels(labels).keys;
  if (textOf(table, 'DESKTOP_EDGE_ROW') === null) {
    throw new TypeError(
      'renderEdgeRow: label table (flat keys or { keys } payload) is missing DESKTOP_EDGE_ROW',
    );
  }
  return table;
}

function endpointName(edge, side) {
  const title = side === 'from' ? edge?.fromTitle : edge?.toTitle;
  if (typeof title === 'string' && title.length > 0) return title;
  const raw = side === 'from' ? edge?.from : edge?.to;
  if (typeof raw !== 'string' || raw.length === 0) return '';
  return raw.startsWith('role:') ? raw.slice('role:'.length) : raw;
}

/**
 * Project one connection line into the A-11 text row.
 *
 * @param {object} edge the frozen projection edge (read-only)
 * @param {Record<string, string> | { keys: Record<string, string> }} labels
 *        the frozen label key table, flat or wrapped in a `/ui/labels` payload
 * @returns {{ id: string|null, text: string, hoverText: string,
 *             statusText: string|null, directionText: string|null,
 *             direction: string, aggregateStatus: string|null,
 *             parallelCount: number, visual: object|null }}
 * @throws {TypeError} when the resolved table lacks `DESKTOP_EDGE_ROW`
 */
export function renderEdgeRow(edge, labels) {
  const table = requireLabelTable(labels);
  const from = endpointName(edge, 'from');
  const to = endpointName(edge, 'to');

  const direction = edge?.direction === 'backflow' ? 'backflow' : 'forward';
  const directionText = textOf(
    table,
    direction === 'backflow' ? 'DESKTOP_EDGE_DIRECTION_BACKFLOW' : 'DESKTOP_EDGE_DIRECTION_FORWARD',
  );

  const aggregateStatus = typeof edge?.aggregateStatus === 'string' ? edge.aggregateStatus : null;
  const statusKey = aggregateStatus === null ? null : STATUS_WORD_KEY[aggregateStatus] ?? null;
  const statusText = statusKey === null ? null : textOf(table, statusKey);

  const parallelCount = Number.isInteger(edge?.parallelCount) && edge.parallelCount > 1
    ? edge.parallelCount
    : 0;
  const parallelText = parallelCount > 1
    ? fillTemplate(textOf(table, 'DESKTOP_EDGE_ROW_PARALLEL') ?? '', { n: parallelCount })
    : '';

  const build = (status) => `${fillTemplate(table.DESKTOP_EDGE_ROW, {
    from,
    to,
    direction: directionText ?? '',
    status: status ?? '',
  })}${parallelText}`;

  const text = build(statusText);

  // A-11: hovering an accepted line shows the merged "processing" wording.
  let hoverText = text;
  if (aggregateStatus === 'accepted') {
    const hoverStatus = textOf(table, 'DESKTOP_EDGE_ROW_ACCEPTED_HOVER');
    if (hoverStatus !== null) hoverText = build(hoverStatus);
  }

  return {
    id: typeof edge?.id === 'string' ? edge.id : null,
    text,
    hoverText,
    statusText,
    directionText,
    direction,
    aggregateStatus,
    parallelCount,
    visual: edge !== null && typeof edge === 'object' && edge.visual !== null && typeof edge.visual === 'object'
      ? { ...edge.visual }
      : null,
  };
}
