/**
 * Legend projection for the role flow graph (I1.10a WP-5; A-8 / AC-34).
 *
 * Contract (split doc 2.2 / requirement AC-34):
 * - `renderLegend(labels)` returns the fixed two-line legend:
 *   `{ anchor: 'bottom-left', layer: 'top', offset, lines: [roleLine, specialLine] }`.
 *   The two line strings come verbatim from the frozen label keys
 *   `DESKTOP_LEGEND_ROLE` / `DESKTOP_LEGEND_SPECIAL` (A-8); this module owns
 *   no text itself, so the desktop layer stays CJK-free.
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
 * Project the two-line legend from the frozen label keys.
 *
 * @param {{ DESKTOP_LEGEND_ROLE?: string, DESKTOP_LEGEND_SPECIAL?: string }} labels
 *        the label key table (`DESKTOP_LABEL_KEYS` or a `/ui/labels` payload).
 * @returns {{ anchor: 'bottom-left', layer: 'top',
 *             offset: { x: number, y: number },
 *             lines: [string, string] }}
 *         plain JSON data; `lines[0]` is the A-8 role-status row,
 *         `lines[1]` the A-8 special-node/direction row, both verbatim.
 */
export function renderLegend(labels) {
  return {
    anchor: LEGEND_ANCHOR,
    layer: LEGEND_LAYER,
    offset: { ...LEGEND_OFFSET },
    lines: [labels?.DESKTOP_LEGEND_ROLE ?? null, labels?.DESKTOP_LEGEND_SPECIAL ?? null],
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
