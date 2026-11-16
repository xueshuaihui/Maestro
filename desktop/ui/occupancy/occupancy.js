/**
 * Global role occupancy view model (I1.11 WP-8; requirement A-6, AC-26 /
 * AC-27 / AC-28 / AC-47).
 *
 * Contract:
 * - One row per role aggregation; the projection owns the sort (busiest
 *   status first, roleId ascending within a tier) and every number — this
 *   module renders the A-6 template and folds the serving-node list only
 *   (at most two listed one by one, more collapse via the serving-more fold
 *   template, key DESKTOP_ROLE_ROW_SERVING_MORE). That fold is presentation
 *   formatting, not recomputation (D-36): the values come straight from
 *   the row.
 * - The host segment is the projection's `hosts` list (D-48 field 8) joined
 *   with the A-0 multi-value separator; no host renders the placeholder
 *   (DESKTOP_PLACEHOLDER).
 * - Empty registry / no readable instance renders the empty line (key
 *   DESKTOP_OCCUPANCY_EMPTY); skipped
 *   (unreadable) instances render the A-6 skip line with the projection's
 *   own count.
 * - Disconnection (AC-47 / BR-36): the caller keeps the last rows and
 *   prepends the queue-side disconnected line — the wording source is the
 *   same `DESKTOP_QUEUE_DISCONNECTED` label, rendered through
 *   `disconnectedText` so both views say exactly the same sentence.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals: every visible word comes from the label table.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const SERVING_MORE_KEY = 'DESKTOP_ROLE_ROW_SERVING_MORE';
const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';

/** At most two serving nodes are listed one by one (A-6). */
const SERVING_LIST_LIMIT = 2;

function tableOf(labels) {
  return resolveLabels(labels).keys;
}

function word(labels, key) {
  const value = tableOf(labels)[key];
  return typeof value === 'string' ? value : null;
}

function placeholderOf(labels) {
  const value = tableOf(labels)[PLACEHOLDER_KEY];
  return typeof value === 'string' ? value : '';
}

/**
 * Serving-node segment of A-6: ids joined for one or two, the folding form
 * above that (the fold template is the same key the instance graph role row
 * uses), and the placeholder (DESKTOP_PLACEHOLDER) when nothing is served.
 */
function servingSegment(nodes, labels) {
  const list = Array.isArray(nodes)
    ? nodes.filter((node) => typeof node === 'string' && node.length > 0)
    : [];
  if (list.length === 0) return placeholderOf(labels);
  if (list.length <= SERVING_LIST_LIMIT) return list.join(', ');
  const template = word(labels, SERVING_MORE_KEY);
  if (template === null) return list.join(', ');
  return fillTemplate(template, { first: list[0], n: list.length });
}

/**
 * Render one occupancy row into the A-6 text.
 *
 * @param {object} row the frozen occupancy projection row (read-only)
 * @param {unknown} labels
 * @returns {{ roleId: string, text: string|null }}
 */
export function renderOccupancyRow(row, labels) {
  const placeholder = placeholderOf(labels);
  const template = word(labels, 'DESKTOP_OCCUPANCY_ROW');
  if (row === null || typeof row !== 'object' || template === null) {
    return { roleId: typeof row?.roleId === 'string' ? row.roleId : '', text: null };
  }
  const role = typeof row.roleName === 'string' && row.roleName.length > 0
    ? row.roleName
    : (typeof row.roleId === 'string' ? row.roleId : placeholder);
  const status = typeof row.status === 'string' && row.status.length > 0 ? row.status : placeholder;
  const hosts = Array.isArray(row.hosts)
    ? row.hosts.filter((host) => typeof host === 'string' && host.length > 0)
    : [];
  return {
    roleId: typeof row.roleId === 'string' ? row.roleId : '',
    text: fillTemplate(template, {
      role,
      status,
      instances: row.instances === null || row.instances === undefined ? placeholder : String(row.instances),
      sessions: row.activeSessions === null || row.activeSessions === undefined
        ? placeholder
        : String(row.activeSessions),
      serving: servingSegment(row.servingNodes, labels),
      hosts: hosts.length > 0 ? hosts.join(', ') : placeholder,
    }),
  };
}

/** Empty line (A-6, key DESKTOP_OCCUPANCY_EMPTY). */
export function emptyText(labels) {
  return word(labels, 'DESKTOP_OCCUPANCY_EMPTY');
}

/**
 * Skipped-instances line (A-6, key DESKTOP_OCCUPANCY_SKIPPED) — `n` is the
 * projection's own skip count, never recomputed here. Zero skips yield
 * `null` (the line does not appear).
 */
export function skippedText(skipped, labels) {
  const n = Array.isArray(skipped) ? skipped.length : 0;
  if (n === 0) return null;
  const template = word(labels, 'DESKTOP_OCCUPANCY_SKIPPED');
  return template === null ? null : fillTemplate(template, { n });
}

/**
 * Disconnected line (AC-47): the same sentence the queue page uses (key
 * DESKTOP_QUEUE_DISCONNECTED), resolved from the same label key.
 */
export function disconnectedText(labels) {
  return word(labels, 'DESKTOP_QUEUE_DISCONNECTED');
}
