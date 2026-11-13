/**
 * Legend projection for the role flow graph (I1.10a WP-5; A-8 / AC-34).
 *
 * Contract (split doc 2.2 / requirement AC-34):
 * - `renderLegend(labels)` accepts either label shape: the flat key table
 *   (`DESKTOP_LABEL_KEYS`) or a `GET /ui/labels` payload `{ keys: {...} }`
 *   (B-07). It returns the fixed two-line legend:
 *   `{ anchor: 'bottom-left', layer: 'top', offset, lines: [roleLine, specialLine] }`.
 *   The two line strings come verbatim from the frozen label keys
 *   `DESKTOP_LEGEND_ROLE` / `DESKTOP_LEGEND_SPECIAL` (A-8); this module owns
 *   no text itself, so the desktop layer stays CJK-free. A table missing
 *   either key throws instead of silently yielding `lines: [null, null]`.
 * - The anchor is a canvas-only property: zoom and pan values never enter
 *   `legendPoint`, which maps the fixed bottom-left offset onto a canvas
 *   size. Three view states (zoomed/panned, reset, collapsed) therefore
 *   produce the same anchor and the same lines (AC-34).
 * - The returned object is plain JSON data with a frozen shape so that the
 *   phased harness `desktop/harness/graph-dump.mjs` can fill its currently
 *   `null` `legend` segment through a lazy dynamic import (S-03, batch 4):
 *   the emitted payload will carry exactly the object returned here.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

/** Fixed anchor inside the canvas viewport (A-8 / AC-34). */
export const LEGEND_ANCHOR = 'bottom-left';
/** The legend paints above nodes and edges (canvas top layer). */
export const LEGEND_LAYER = 'top';
/** Fixed pixel offset from the canvas bottom-left corner (AC-34). */
export const LEGEND_OFFSET = Object.freeze({ x: 16, y: 16 });

/**
 * Pick the key table out of either accepted shape: a `{ keys: {...} }`
 * payload (as served by `GET /ui/labels`) or the flat table itself.
 *
 * @param {unknown} labels
 * @returns {unknown} the table to read `DESKTOP_LEGEND_*` from.
 */
function labelTable(labels) {
  if (
    labels !== null &&
    typeof labels === 'object' &&
    labels.keys !== null &&
    typeof labels.keys === 'object' &&
    !Array.isArray(labels.keys)
  ) {
    return labels.keys;
  }
  return labels;
}

/**
 * Project the two-line legend from the frozen label keys.
 *
 * Accepts both shapes (B-07): the flat key table (`DESKTOP_LABEL_KEYS`) and a
 * `/ui/labels` payload carrying the table under `keys`.
 *
 * @param {{ DESKTOP_LEGEND_ROLE?: string, DESKTOP_LEGEND_SPECIAL?: string }
 *         | { keys?: { DESKTOP_LEGEND_ROLE?: string, DESKTOP_LEGEND_SPECIAL?: string } }} labels
 *        the label key table, flat or wrapped in a `/ui/labels` payload.
 * @returns {{ anchor: 'bottom-left', layer: 'top',
 *             offset: { x: number, y: number },
 *             lines: [string, string] }}
 *         plain JSON data; `lines[0]` is the A-8 role-status row,
 *         `lines[1]` the A-8 special-node/direction row, both verbatim.
 * @throws {TypeError} when the resolved table lacks
 *         `DESKTOP_LEGEND_ROLE` or `DESKTOP_LEGEND_SPECIAL` as strings; the
 *         legend never degrades to `lines: [null, null]`.
 */
export function renderLegend(labels) {
  const table = labelTable(labels);
  const role = table?.DESKTOP_LEGEND_ROLE;
  const special = table?.DESKTOP_LEGEND_SPECIAL;
  const missing = [];
  if (typeof role !== 'string') missing.push('DESKTOP_LEGEND_ROLE');
  if (typeof special !== 'string') missing.push('DESKTOP_LEGEND_SPECIAL');
  if (missing.length > 0) {
    throw new TypeError(
      `renderLegend: label table (flat keys or { keys } payload) is missing ${missing.join(', ')}`,
    );
  }
  return {
    anchor: LEGEND_ANCHOR,
    layer: LEGEND_LAYER,
    offset: { ...LEGEND_OFFSET },
    lines: [role, special],
  };
}

/**
 * Anchor point of the legend inside a canvas of the given size. Depends on
 * the canvas dimensions only: zoom and pan are not parameters (AC-34).
 *
 * @param {{ width: number, height: number }} canvas
 * @returns {{ x: number, y: number }}
 */
export function legendPoint(canvas) {
  return {
    x: LEGEND_OFFSET.x,
    y: Number(canvas?.height) - LEGEND_OFFSET.y,
  };
}
