/**
 * Instance list rendering, pure module (I1.10a WP-3; requirement A-1 / A-2,
 * split doc 2.2). No DOM, no fs, no `Date.now`, no `window`: every function
 * takes its inputs and returns strings / arrays.
 *
 * Row discipline (A-1): six fields in a fixed order — instance id, workflow,
 * phase, progress, pending count, health — and a zero pending count still
 * renders (the template keeps the slot). The desktop row is NOT the CLI
 * `orch status` row: it always prints the workflow's Chinese name through the
 * flat label keys, so the built-in single-node template id renders via
 * `TEMPLATE_LABEL_SINGLE` and the CLI row is never touched from here (C-04).
 *
 * Sorting (AC-03): attention -> slow -> normal -> ended, and within one level
 * the most recently updated row first. Levels are the frozen four-value health
 * set (`src/core/health.js`); an unknown or missing level sorts after `ended`
 * so a corrupt row can never jump to the top.
 *
 * All visible wording comes from the flat label keys delivered by
 * `GET /ui/labels` (zero CJK characters in this module; placeholders are
 * replaced literally and a missing argument keeps its `{xx}` form).
 */

/** Frozen sort ranks for the four health levels (A-1 order). */
const LEVEL_RANK = Object.freeze({
  attention: 0,
  slow: 1,
  normal: 2,
  ended: 3,
});

const UNKNOWN_RANK = 4;

/**
 * Literal `{xx}` replacement on a label template; a missing argument keeps the
 * placeholder verbatim (batch-1 consumption discipline).
 */
function fill(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (raw, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : raw
  );
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Resolves one display word through the flat key naming convention
 * (`PREFIX_VALUE` with `-` folded to `_` and upper-cased), e.g. the coding
 * loop template id resolves through `TEMPLATE_LABEL_CODE_LOOP`. Falls back to
 * the raw value when the key is absent, so unknown ids still render.
 */
function wordFor(labels, prefix, value, fallback) {
  if (typeof value !== 'string' || value.length === 0) {
    return typeof fallback === 'string' ? fallback : '';
  }
  const key = `${prefix}_${value.replaceAll('-', '_').toUpperCase()}`;
  const word = labels?.[key];
  if (typeof word === 'string' && word.length > 0) return word;
  return typeof fallback === 'string' && fallback.length > 0 ? fallback : value;
}

function rankOf(item) {
  const level = item?.health?.level;
  return Object.prototype.hasOwnProperty.call(LEVEL_RANK, level)
    ? LEVEL_RANK[level]
    : UNKNOWN_RANK;
}

function updatedDesc(a, b) {
  const ta = typeof a?.updatedAt === 'string' ? a.updatedAt : '';
  const tb = typeof b?.updatedAt === 'string' ? b.updatedAt : '';
  if (ta === tb) return 0;
  return ta < tb ? 1 : -1; // most recent first; missing updatedAt sinks
}

/**
 * Sorts a copy of the list (never mutates the argument): health level
 * attention -> slow -> normal -> ended (unknown last), same level by
 * `updatedAt` descending.
 */
export function sortInstances(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  return list.sort((a, b) => {
    const rankDiff = rankOf(a) - rankOf(b);
    return rankDiff !== 0 ? rankDiff : updatedDesc(a, b);
  });
}

function pendingCount(instance) {
  const pending = instance?.pending ?? {};
  const escalations = Number.isInteger(pending.escalations) ? pending.escalations : 0;
  const approvals = Number.isInteger(pending.approvals) ? pending.approvals : 0;
  return escalations + approvals;
}

function progressOf(instance) {
  const progress = instance?.progress ?? {};
  const done = Number.isInteger(progress.done) ? progress.done : 0;
  const total = Number.isInteger(progress.total) ? progress.total : 0;
  return { done, total };
}

/**
 * One list row as display fields plus the frozen A-1 row text. The card view
 * consumes the fields; `renderListRow` keeps the server wording unchanged.
 */
export function describeListRow(instance, labels) {
  const template = typeof instance?.template === 'string' ? instance.template : '';
  const templateTitle = wordFor(
    labels,
    'TEMPLATE_LABEL',
    template,
    typeof instance?.templateTitle === 'string' ? instance.templateTitle : template,
  );
  const phase = wordFor(labels, 'INSTANCE_LABEL', instance?.phase ?? '');
  // Missing level degrades to `normal` exactly like the CLI health line
  // (render.js healthLevelWord): a live run returns its snapshot before the
  // first health write, and the row must still show one of the four words.
  const healthLevel = typeof instance?.health?.level === 'string'
    ? instance.health.level
    : 'normal';
  const health = wordFor(labels, 'HEALTH_LABEL', healthLevel);
  const { done, total } = progressOf(instance);
  return {
    instanceId: instance?.instanceId ?? '',
    template,
    templateTitle,
    phase: instance?.phase ?? '',
    // `state` is the word a reader sees; `stateRaw` is the snapshot value it
    // came from. Any decision that branches on a state (terminal? which tone?
    // which filter?) must use `stateRaw` — comparing the Chinese word against
    // an English list silently never matches, which is how a finished run kept
    // offering a pause button that could only answer "not pausable".
    state: phase,
    stateRaw: typeof instance?.phase === 'string' ? instance.phase : '',
    // Pause is a flag on a still-`running` snapshot, so the state word alone
    // can never show it; the row needs the flag to offer resume instead.
    paused: instance?.paused === true,
    done,
    total,
    pending: pendingCount(instance),
    healthLevel,
    health,
    readable: instance?.readable !== false,
  };
}

/**
 * Renders one A-1 row via the `DESKTOP_LIST_ROW` template: the six fields in
 * the fixed order, a zero pending count included. `labels` is the flat key
 * table from `GET /ui/labels`.
 */
export function renderListRow(instance, labels) {
  const row = describeListRow(instance, labels);
  return fill(labels?.DESKTOP_LIST_ROW, {
    id: row.instanceId,
    template: row.templateTitle,
    state: row.state,
    done: row.done,
    total: row.total,
    pending: row.pending,
    health: row.health,
  });
}

/** A-2 empty state (`DESKTOP_LIST_EMPTY`); the new-instance entry stays available. */
export function renderListEmpty(labels) {
  return text(labels?.DESKTOP_LIST_EMPTY);
}

/** A-2 unreadable row (`DESKTOP_LIST_UNREADABLE`); it never blocks other rows. */
export function renderListUnreadable(instanceId, labels) {
  return fill(labels?.DESKTOP_LIST_UNREADABLE, { id: instanceId ?? '' });
}
