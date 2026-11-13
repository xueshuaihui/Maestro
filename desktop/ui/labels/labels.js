/**
 * Label table resolution and connection-label visibility policy
 * (I1.10a WP-6; requirement A-14 / AC-25 / D-4).
 *
 * Contract (split doc 2.2):
 * - `resolveLabels(payload)` normalises either label shape into a resolver:
 *   the `GET /ui/labels` body `{ keys: { "<KEY>": "<template>" } }` or the flat
 *   key table. The resolver offers `has` / `get` (key lookup) and `text`
 *   (placeholder substitution). Substitution is literal: `{xx}` is replaced
 *   only when the parameter exists, otherwise the placeholder is kept as is.
 *   Missing keys never throw and never yield invented text: `get` / `text`
 *   return `null` and the caller falls back to its own placeholder key.
 *   The source table is a shared reference and is never written in place.
 * - `visibleLabels(edges, hoveredKey)` implements the label policy: the
 *   default visible set is the aggregate states `rejected`, `expired` and
 *   `pending`; hovering one connection line adds that line and changes
 *   nothing else. The return value is the list of visible line keys in edge
 *   declaration order, so a caller can answer "is this label visible?" with a
 *   membership test and a test can compare the three states 3 / 4 / 3.
 * - `fillTemplate` is the one literal substitution helper shared by the row
 *   renderers (`node-rows.js` / `edge-rows.js`), so no module invents a second
 *   template dialect.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * This file owns no user-visible text: every string it emits comes from the
 * supplied label table, so the desktop layer stays free of CJK literals.
 */

/** Aggregate states whose line label is visible without hovering (A-11 / D-4). */
export const LABEL_VISIBLE_STATES = Object.freeze(['rejected', 'expired', 'pending']);

const DEFAULT_VISIBLE = new Set(LABEL_VISIBLE_STATES);

/**
 * Extract the flat key table out of either accepted shape.
 *
 * @param {unknown} payload a `{ keys: {...} }` body or the flat table
 * @returns {Record<string, string>} the table (shared reference, never copied)
 */
function labelTable(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const keys = payload.keys;
  if (keys !== null && typeof keys === 'object' && !Array.isArray(keys)) return keys;
  return payload;
}

/**
 * Literal `{xx}` placeholder substitution (same discipline as the frozen
 * label table: no escaping, no interpolation, unknown placeholders kept).
 *
 * @param {string} template
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function fillTemplate(template, params = {}) {
  const source = String(template);
  const values = params !== null && typeof params === 'object' ? params : {};
  return source.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

/**
 * Build a label resolver over one `GET /ui/labels` payload or flat key table.
 *
 * @param {unknown} payload
 * @returns {{ keys: Record<string, string>,
 *             has(key: string): boolean,
 *             get(key: string): string|null,
 *             text(key: string, params?: Record<string, unknown>): string|null }}
 */
export function resolveLabels(payload) {
  const keys = labelTable(payload);

  const get = (key) => {
    if (typeof key !== 'string' || key.length === 0) return null;
    const value = keys[key];
    return typeof value === 'string' ? value : null;
  };

  return {
    keys,
    has(key) {
      return get(key) !== null;
    },
    get,
    /**
     * Template lookup plus literal substitution. A missing key yields `null`
     * (never an empty string, never a fabricated sentence) and a missing
     * parameter keeps its `{xx}` placeholder verbatim.
     */
    text(key, params = {}) {
      const template = get(key);
      return template === null ? null : fillTemplate(template, params);
    },
  };
}

/** Key of one connection line for the visibility policy. */
function edgeKeyOf(edge) {
  if (edge === null || typeof edge !== 'object') return null;
  if (typeof edge.id === 'string' && edge.id.length > 0) return edge.id;
  if (typeof edge.key === 'string' && edge.key.length > 0) return edge.key;
  const from = typeof edge.from === 'string' ? edge.from : '';
  const to = typeof edge.to === 'string' ? edge.to : '';
  if (from.length === 0 && to.length === 0) return null;
  return `${from}->${to}`;
}

/**
 * Visible connection labels for one graph state.
 *
 * @param {Array<object>} edges the frozen projection edges (read-only)
 * @param {string|null} [hoveredKey] the hovered line key, if any
 * @returns {string[]} visible line keys in edge declaration order
 */
export function visibleLabels(edges, hoveredKey = null) {
  const list = Array.isArray(edges) ? edges : [];
  const hovered = typeof hoveredKey === 'string' && hoveredKey.length > 0 ? hoveredKey : null;
  const out = [];
  const seen = new Set();
  for (const edge of list) {
    const key = edgeKeyOf(edge);
    if (key === null) continue;
    const byState = DEFAULT_VISIBLE.has(edge.aggregateStatus);
    const byHover = hovered !== null && key === hovered;
    if (!byState && !byHover) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
