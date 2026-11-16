/**
 * Connection-line handoff panel (I1.10b WP-3, contract D6).
 *
 * One row per handoff package: parallel packages keep their own row. The
 * title carries the aggregated status of the caller-provided edge; row times
 * and timeline stamps come from the package records only. Long lists use a
 * paged model view: the clock is injected and no document object is used.
 * No other panel is referenced by this module.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const PAGE_SIZE = 20;

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function clockText(ts, placeholder) {
  if (typeof ts !== 'string' || ts.length < 19) return placeholder;
  return ts.slice(11, 19);
}

function handoffWord(resolver, state, missing) {
  const token = state === 'built' ? 'created' : state;
  const key = `HANDOFF_LABEL_${String(token ?? '').toUpperCase()}`;
  const word = resolver.get(key);
  if (word !== null) return word;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

export function buildHandoffPanel(panel, labels, options = {}) {
  const source = panel !== null && typeof panel === 'object' ? panel : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';
  const edge = source.edge ?? {};
  const clock = typeof options.clock === 'function' ? options.clock : () => 0;
  const start = clock();

  const directionKey = edge.direction === 'backflow'
    ? 'DESKTOP_EDGE_DIRECTION_BACKFLOW'
    : 'DESKTOP_EDGE_DIRECTION_FORWARD';
  const direction = take(resolver, directionKey, {}, missingLabels);
  const status = handoffWord(resolver, edge.aggregateStatus, missingLabels);
  let title = take(resolver, 'DRILL_CONN_HEAD', {
    from: edge.fromRole ?? placeholder,
    to: edge.toRole ?? placeholder,
    direction,
    status,
  }, missingLabels);
  const parallel = Number.isInteger(edge.parallelCount) ? edge.parallelCount : 0;
  if (parallel > 1) {
    title += take(resolver, 'DRILL_CONN_PARALLEL', { n: parallel }, missingLabels);
  }

  const rows = [];
  for (const item of Array.isArray(source.handoffs) ? source.handoffs : []) {
    if (item === null || typeof item !== 'object') continue;
    const time = clockText(item.lastActivity, placeholder);
    const row = {
      id: item.handoffId ?? null,
      handoffId: item.handoffId ?? null,
      round: item.round ?? null,
      state: item.state ?? null,
      time,
      reason: item.rejectReason ?? null,
      timeline: Array.isArray(item.timeline) ? item.timeline.slice() : [],
    };
    row.line = take(resolver, 'DRILL_CONN_HANDOFF', {
      id: row.id ?? placeholder,
      round: item.round ?? placeholder,
      state: handoffWord(resolver, item.state, missingLabels),
      time,
    }, missingLabels);
    rows.push(row);
  }
  rows.sort((a, b) => String(b.time ?? '').localeCompare(String(a.time ?? '')));

  const expandedId = options.expandedId ?? null;
  const expanded = expandedId === null
    ? null
    : rows.find((row) => row.id === expandedId) ?? null;
  const timelineRows = [];
  if (expanded !== null) {
    for (const entry of expanded.timeline) {
      if (entry === null || typeof entry !== 'object') continue;
      timelineRows.push(take(resolver, 'DRILL_DETAIL_TIMELINE', {
        time: clockText(entry.ts, placeholder),
        state: handoffWord(resolver, entry.state, missingLabels),
      }, missingLabels));
    }
  }

  let offset = 0;
  const pageOf = () => rows.slice(offset, offset + PAGE_SIZE);
  const result = {
    title,
    target: 'connection-panel',
    emptyText: rows.length === 0
      ? take(resolver, 'DRILL_CONN_EMPTY', {}, missingLabels)
      : null,
    rows,
    expandedId,
    timelineRows,
    visibleIds: pageOf().map((row) => row.id),
    renderedRows: Math.min(rows.length, PAGE_SIZE),
    scrollElapsed: 0,
    anchorRowTop: Number.isFinite(options.anchorRowTop) ? options.anchorRowTop : 0,
    missingLabels,
    scrollToEnd() {
      offset = Math.max(0, rows.length - PAGE_SIZE);
      result.visibleIds = pageOf().map((row) => row.id);
      result.scrollElapsed = clock() - start;
      return result;
    },
  };
  return result;
}

export default buildHandoffPanel;
