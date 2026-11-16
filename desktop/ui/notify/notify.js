/**
 * Notification consumption model (I1.11 WP-8; requirement D-46 / AC-04 /
 * AC-49 / U-13).
 *
 * Contract:
 * - One `notify` SSE frame carries one intent
 *   `{ kind, ids, instanceId, title, body, mergedCount, at }`. Presentation
 *   replaces by the `(kind, instanceId)` key (D-46): a merged update swaps
 *   the previous entry in place instead of appending, so the user always
 *   sees exactly one notification per target with the latest merged count.
 * - The title / body strings are consumed verbatim — the daemon already
 *   rendered the A-1 five-segment template, and this module never re-wraps
 *   or re-fills it.
 * - Click routing (AC-04 / AC-49): an escalation / approval intent points at
 *   the queue row(s) of its instance; completed / anomaly intents only bring
 *   the queue page up. Whether the pointed-at row still exists is decided by
 *   the caller against the freshest snapshot — this module only supplies the
 *   target.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals: notification wording passes through untouched.
 */

/** Presentation key of one intent: `(kind, instanceId)`. */
export function notifyKey(intent) {
  const kind = typeof intent?.kind === 'string' ? intent.kind : '';
  const instanceId = typeof intent?.instanceId === 'string' ? intent.instanceId : '';
  return `${kind}|${instanceId}`;
}

/**
 * Replace (or insert) one intent in the entry list keyed by
 * `(kind, instanceId)` (D-46). The input list is never mutated.
 *
 * @param {Array<object>} entries the current entries (read-only)
 * @param {object} intent the incoming intent
 * @returns {Array<object>} the new entry list (latest intent per key, in
 *   first-seen order, the replaced entry staying at its original position)
 */
export function replaceIntent(entries, intent) {
  const list = Array.isArray(entries) ? entries : [];
  if (intent === null || typeof intent !== 'object') return list.slice();
  const key = notifyKey(intent);
  const next = [];
  let replaced = false;
  for (const entry of list) {
    if (entry !== null && typeof entry === 'object' && notifyKey(entry) === key) {
      next.push(intent);
      replaced = true;
    } else {
      next.push(entry);
    }
  }
  if (!replaced) next.push(intent);
  return next;
}

/**
 * Queue target of one intent (AC-04). Escalation / approval intents carry
 * the ids to select; the other kinds only navigate.
 *
 * @returns {{ kind: string, instanceId: string, ids: string[],
 *             selectable: boolean }}
 */
export function queueTargetOf(intent) {
  const kind = typeof intent?.kind === 'string' ? intent.kind : '';
  const instanceId = typeof intent?.instanceId === 'string' ? intent.instanceId : '';
  const ids = Array.isArray(intent?.ids)
    ? intent.ids.filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  return {
    kind,
    instanceId,
    ids,
    selectable: (kind === 'escalation' || kind === 'approval') && ids.length > 0,
  };
}

/**
 * The entry to render in the queue page notification strip: the latest
 * intent per `(kind, instanceId)` is already enforced by `replaceIntent`, so
 * the strip simply shows the newest arrival.
 *
 * @param {Array<object>} entries
 * @returns {object|null} `{ key, title, body, mergedCount }` or `null`
 */
export function stripEntryOf(entries) {
  const list = Array.isArray(entries) ? entries : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const entry = list[index];
    if (entry !== null && typeof entry === 'object' && typeof entry.title === 'string') {
      return {
        key: notifyKey(entry),
        title: entry.title,
        body: typeof entry.body === 'string' ? entry.body : '',
        mergedCount: Number.isInteger(entry.mergedCount) ? entry.mergedCount : null,
      };
    }
  }
  return null;
}
