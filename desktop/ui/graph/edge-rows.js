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
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

import { fillTemplate } from '../labels/labels.js';

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
 * @param {Record<string, string>} labels the frozen label key table
 * @returns {{ id: string|null, text: string|null, hoverText: string|null,
 *             statusText: string|null, directionText: string|null,
 *             direction: string, aggregateStatus: string|null,
 *             parallelCount: number, visual: object|null }}
 */
export function renderEdgeRow(edge, labels) {
  const from = endpointName(edge, 'from');
  const to = endpointName(edge, 'to');

  const direction = edge?.direction === 'backflow' ? 'backflow' : 'forward';
  const directionText = textOf(
    labels,
    direction === 'backflow' ? 'DESKTOP_EDGE_DIRECTION_BACKFLOW' : 'DESKTOP_EDGE_DIRECTION_FORWARD',
  );

  const aggregateStatus = typeof edge?.aggregateStatus === 'string' ? edge.aggregateStatus : null;
  const statusKey = aggregateStatus === null ? null : STATUS_WORD_KEY[aggregateStatus] ?? null;
  const statusText = statusKey === null ? null : textOf(labels, statusKey);

  const parallelCount = Number.isInteger(edge?.parallelCount) && edge.parallelCount > 1
    ? edge.parallelCount
    : 0;
  const parallelText = parallelCount > 1
    ? fillTemplate(textOf(labels, 'DESKTOP_EDGE_ROW_PARALLEL') ?? '', { n: parallelCount })
    : '';

  const rowTemplate = textOf(labels, 'DESKTOP_EDGE_ROW');
  const build = (status) => (rowTemplate === null
    ? null
    : `${fillTemplate(rowTemplate, {
      from,
      to,
      direction: directionText ?? '',
      status: status ?? '',
    })}${parallelText}`);

  const text = build(statusText);

  // A-11: hovering an accepted line shows the merged "processing" wording.
  let hoverText = text;
  if (aggregateStatus === 'accepted') {
    const hoverStatus = textOf(labels, 'DESKTOP_EDGE_ROW_ACCEPTED_HOVER');
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
