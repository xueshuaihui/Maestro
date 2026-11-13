/**
 * Element style projection: opacity, stacking and animation tokens
 * (I1.10a WP-6; AC-18 / AC-23 / §2.11).
 *
 * Contract (split doc 2.2):
 * - `elementStyle(element, { hoveredKey })` returns exactly
 *   `{ opacity, z, animation }`. It never returns geometry: the pulse and the
 *   highlight are paint-level effects, so width, height, x and y stay exactly
 *   what the layout produced (AC-23) and nothing is ever re-flowed.
 * - Abnormality lifts an element above its neighbours (`z = 1`) and gives a
 *   node the `pulse` animation token. Clearing the abnormality drops both
 *   immediately (`z = 0`, `animation = 'none'`) with the same coordinates.
 * - Edge visuals are carried by the frozen A-11 token table, so an edge keeps
 *   its own animation token (`flow` for delivered); only the stacking is
 *   derived here, from the abnormal aggregate states (rejected / expired).
 * - Dimming follows the hover set: with no hover everything is fully opaque;
 *   with a hover the caller passes the `opaqueIds` of `hoverSet(graph, key)`
 *   and everything outside that set drops to `DIM_OPACITY`. When only the
 *   hovered key is known (no adjacency at hand) the hovered element itself
 *   stays opaque and the rest dims — the app always passes `opaqueIds` so that
 *   neighbours of the hovered node stay readable (AC-33).
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

/** Full opacity of a highlighted element. */
export const FULL_OPACITY = 1;
/** Opacity of an element outside the highlight set. */
export const DIM_OPACITY = 0.35;

/** Aggregate states rendered as abnormal lines (A-11: red / orange). */
const ABNORMAL_EDGE_STATES = new Set(['rejected', 'expired']);

function isEdge(element) {
  return typeof element?.aggregateStatus === 'string'
    || (typeof element?.from === 'string' && typeof element?.to === 'string' && typeof element?.type !== 'string');
}

function isAbnormal(element, edge) {
  if (element?.abnormal === true) return true;
  if (edge && typeof element?.aggregateStatus === 'string') {
    return ABNORMAL_EDGE_STATES.has(element.aggregateStatus);
  }
  return false;
}

/**
 * Style tokens of one layout element.
 *
 * @param {object} element a projection node or projection edge (the frozen
 *        shapes that carry `abnormal` / `aggregateStatus` / `visual`);
 *        layout coordinates are never an input, they stay with the layout.
 * @param {{ hoveredKey?: string|null, opaqueIds?: Iterable<string>|null }} [options]
 * @returns {{ opacity: number, z: number, animation: string }}
 */
export function elementStyle(element, options = {}) {
  const hoveredKey = typeof options?.hoveredKey === 'string' && options.hoveredKey.length > 0
    ? options.hoveredKey
    : null;
  const opaqueIds = options?.opaqueIds ?? null;

  const edge = isEdge(element);
  const abnormal = isAbnormal(element, edge);

  let opacity = FULL_OPACITY;
  if (hoveredKey !== null) {
    const id = typeof element?.id === 'string' ? element.id : null;
    if (opaqueIds !== null && typeof opaqueIds !== 'string' && typeof opaqueIds[Symbol.iterator] === 'function') {
      let member = false;
      for (const candidate of opaqueIds) {
        if (candidate === id) {
          member = true;
          break;
        }
      }
      opacity = member ? FULL_OPACITY : DIM_OPACITY;
    } else {
      opacity = id !== null && id === hoveredKey ? FULL_OPACITY : DIM_OPACITY;
    }
  }

  // A-11 already owns the line animation token; the pulse belongs to nodes
  // (an abnormal line is encoded by colour, dash and arrow alone).
  const animation = edge
    ? (typeof element?.visual?.animation === 'string' ? element.visual.animation : 'none')
    : (abnormal ? 'pulse' : 'none');

  return {
    opacity,
    z: abnormal ? 1 : 0,
    animation,
  };
}
