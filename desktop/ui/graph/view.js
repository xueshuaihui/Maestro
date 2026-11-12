/**
 * Pure view state for the role flow graph (I1.10a WP-5; D-4).
 *
 * Contract (split doc 2.2 / requirement AC-20 / AC-21 / AC-22):
 * - `createViewState(initial)` returns a state machine with
 *   `setZoom` (clamped to [0.5, 2.0]), `setPan`, `reset` (100% / (0,0) /
 *   cleared drag offsets / focus exit), `screen` (view transform over one
 *   layout node), `focus` (visible-window switch, see below),
 *   `exitFocus`, `applyOffsets` / `clearOffsets` (drag offsets, overlaid on
 *   top of the layout coordinates), plus read accessors.
 * - Zoom and pan live only in the transform: `screen(node)` derives screen
 *   geometry from the immutable layout coordinates; layout output never
 *   changes (AC-20). `screen` is invertible:
 *   `(screen.x - pan.x) / zoom` recovers the laid-out x.
 * - Focus filters which nodes/edges are visible; it never recomputes
 *   coordinates (AC-21). The fixed desktop mode is the 2-hop budget
 *   (`hops = 2`); the anchor-visible window around the focused node splits
 *   that budget over both directions, so the visible set is the focused node
 *   plus its direct neighbors (undirected BFS depth `floor(hops / 2)`). On
 *   the AC-21 fixture (chain A->B->C->D->E plus A->E, double-click C) this
 *   yields exactly [B, C, D] and hides the A->E skip edge. Esc calls
 *   `exitFocus()` and the full set comes back.
 * - Drag offsets are plain `{ nodeId: { dx, dy } }` data. The caller owns
 *   persistence: the pure module never touches `.orch/desktop/views/`
 *   (AC-22 file shape `{ offsets, updatedAt }` is written by the shell or by
 *   a harness/test, then replayed through `applyOffsets`).
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.0;
export const DEFAULT_ZOOM = 1;
/** Fixed focus budget of the desktop graph (A-12: two hops). */
export const DEFAULT_FOCUS_HOPS = 2;

function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ZOOM;
  if (n < ZOOM_MIN) return ZOOM_MIN;
  if (n > ZOOM_MAX) return ZOOM_MAX;
  return n;
}

function normalizePan(x, y) {
  return {
    x: Number.isFinite(Number(x)) ? Number(x) : 0,
    y: Number.isFinite(Number(y)) ? Number(y) : 0,
  };
}

function normalizeOffsets(map) {
  const out = {};
  if (map === null || typeof map !== 'object') return out;
  for (const [id, delta] of Object.entries(map)) {
    if (typeof id !== 'string' || id.length === 0) continue;
    const dx = Number(delta?.dx);
    const dy = Number(delta?.dy);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
    out[id] = { dx, dy };
  }
  return out;
}

/**
 * Undirected adjacency over every edge (forward and backflow alike): focus
 * is a proximity window, not a direction filter.
 */
function buildAdjacency(nodes, edges) {
  const adjacency = new Map();
  for (const node of nodes) {
    if (typeof node?.id === 'string') adjacency.set(node.id, new Set());
  }
  for (const edge of edges) {
    if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string') continue;
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to) || edge.from === edge.to) continue;
    adjacency.get(edge.from).add(edge.to);
    adjacency.get(edge.to).add(edge.from);
  }
  return adjacency;
}

/**
 * Visible window for one focused node: undirected BFS with depth
 * `floor(hops / 2)` (the 2-hop budget split over both directions).
 * Deterministic: the returned ids are sorted.
 */
function focusWindow(nodeId, hops, adjacency) {
  const depth = Math.max(0, Math.floor(Number(hops) / 2)) || 0;
  if (!adjacency.has(nodeId) || depth < 1) return [nodeId];
  const seen = new Set([nodeId]);
  let frontier = [nodeId];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id)) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Create one pure view state.
 *
 * @param {{ zoom?: number, pan?: {x, y}, nodes?: Array<object>, edges?: Array<object> }} [initial]
 *        `nodes` / `edges` seed the adjacency used by `focus`; they are the
 *        frozen WP-4 projection arrays and are only read, never written.
 */
export function createViewState(initial = {}) {
  const nodes = Array.isArray(initial.nodes) ? initial.nodes : [];
  const edges = Array.isArray(initial.edges) ? initial.edges : [];
  const adjacency = buildAdjacency(nodes, edges);

  let zoom = clampZoom(initial.zoom ?? DEFAULT_ZOOM);
  let pan = normalizePan(initial.pan?.x ?? 0, initial.pan?.y ?? 0);
  let offsets = {};
  let focus = null; // { nodeId, hops, visible: string[] } | null

  const visibleIds = () => {
    if (focus !== null) return focus.visible.slice();
    return nodes.map((node) => node?.id).filter((id) => typeof id === 'string');
  };

  return {
    getZoom: () => zoom,
    getPan: () => ({ ...pan }),
    getOffsets: () => {
      const out = {};
      for (const [id, delta] of Object.entries(offsets)) out[id] = { ...delta };
      return out;
    },
    getFocus: () => (focus === null ? null : { ...focus, visible: focus.visible.slice() }),

    /** Clamp into [ZOOM_MIN, ZOOM_MAX] and return the applied value. */
    setZoom(value) {
      zoom = clampZoom(value);
      return zoom;
    },
    setPan(x, y) {
      pan = normalizePan(x, y);
      return { ...pan };
    },

    /** Back to 100% / origin / no drag offsets / no focus (AC-20 / AC-22). */
    reset() {
      zoom = DEFAULT_ZOOM;
      pan = { x: 0, y: 0 };
      offsets = {};
      focus = null;
    },

    /**
     * View transform of one layout node, drag offsets overlaid first.
     * Layout coordinates are read-only inputs here (AC-20 / AC-21).
     */
    screen(node) {
      const dx = offsets[node?.id]?.dx ?? 0;
      const dy = offsets[node?.id]?.dy ?? 0;
      return {
        x: (Number(node?.x) + dx) * zoom + pan.x,
        y: (Number(node?.y) + dy) * zoom + pan.y,
        width: Number(node?.width) * zoom,
        height: Number(node?.height) * zoom,
      };
    },

    /** Merge one `{ nodeId: {dx, dy} }` map into the drag offsets. */
    applyOffsets(map) {
      const incoming = normalizeOffsets(map);
      for (const [id, delta] of Object.entries(incoming)) offsets[id] = delta;
      return this.getOffsets();
    },
    clearOffsets() {
      offsets = {};
    },

    /**
     * Enter focus mode (AC-21). `null` exits. Returns the visible id list.
     * Coordinates are untouched; only the visible set changes.
     */
    focus(nodeId, hops = DEFAULT_FOCUS_HOPS) {
      if (nodeId === null || nodeId === undefined || !adjacency.has(nodeId)) {
        focus = null;
        return null;
      }
      focus = { nodeId, hops, visible: focusWindow(nodeId, hops, adjacency) };
      return focus.visible.slice();
    },
    /** Esc: leave focus and restore the full set (AC-21). */
    exitFocus() {
      focus = null;
    },

    /** Node ids currently visible (full set when not focused). */
    visibleNodeIds() {
      return visibleIds();
    },
    /** Edges with both ends visible (AC-21: edges follow node visibility). */
    visibleEdges() {
      const visible = new Set(visibleIds());
      return edges.filter((edge) => visible.has(edge?.from) && visible.has(edge?.to));
    },
  };
}
