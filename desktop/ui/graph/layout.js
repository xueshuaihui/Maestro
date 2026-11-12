/**
 * Pure hierarchical layout for the role flow graph (I1.10a WP-5; D-4).
 *
 * Contract (split doc 2.2 / requirement AC-17 / AC-18):
 * - `computeLayout(graph)` takes the frozen WP-4 projection shape
 *   (`{ nodes: [...], edges: [...] }`) and returns
 *   `{ nodes: [{ id, x, y, width, height, layer, z }],
 *      edges: [{ id, path: { kind: 'straight' | 'arc', ctrl? }, z }] }`.
 * - Layering runs over `forward` edges only (longest path, fixpoint
 *   iteration); `backflow` edges never push a node to a deeper layer and
 *   render as arcs: the control point sits at the midpoint of the two node
 *   centers, lifted by ARC_LIFT.
 * - Within one layer the row order follows declaration order (`order`) and
 *   breaks ties by node id, so two layouts of the same graph are byte-equal.
 * - `z = abnormal ? 1 : 0`; abnormality never enters layer or coordinate
 *   math, and an edge inherits z = 1 when either endpoint is abnormal.
 *
 * Purity: no DOM, no filesystem access, no wall clock, no `window`. Same
 * input in, byte equal output out (the AC-17 gate greps this file for the
 * clock call and file-system call shapes and requires zero hits). Inputs
 * are never mutated.
 */

/** Node box size (D-4 / AC-17 anchor). */
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 80;
/** Horizontal distance between layers: x = layer * LAYER_GAP. */
export const LAYER_GAP = 240;
/** Vertical distance between rows inside one layer: y = row * ROW_GAP. */
export const ROW_GAP = 140;
/** Backflow arc control point lift above the endpoint midpoint (D-4). */
export const ARC_LIFT = 40;

/**
 * Compute the deterministic layout of one graph projection.
 *
 * @param {{ nodes: Array<object>, edges: Array<object>, rev?: number }} graph
 *        the frozen WP-4 projection payload (read-only).
 * @param {{ canvas?: { width: number, height: number } }} [options]
 *        reserved; the layout math never reads it (canvas belongs to the
 *        view transform, not to layout).
 * @returns {{ nodes: Array<{id, x, y, width, height, layer, z}>,
 *             edges: Array<{id, path: {kind, ctrl?}, z}> }}
 */
export function computeLayout(graph, options = {}) {
  void options; // reserved signature slot: canvas never enters layout math.
  const sourceNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const sourceEdges = Array.isArray(graph?.edges) ? graph.edges : [];

  const declarationIndex = new Map();
  for (let i = 0; i < sourceNodes.length; i += 1) {
    const id = typeof sourceNodes[i]?.id === 'string' ? sourceNodes[i].id : null;
    if (id !== null && !declarationIndex.has(id)) declarationIndex.set(id, i);
  }

  // ---- layering: longest path over forward edges only (AC-17) -------------
  const layerById = new Map();
  for (const node of sourceNodes) {
    if (typeof node?.id === 'string') layerById.set(node.id, 0);
  }
  const forwardEdges = sourceEdges.filter(
    (edge) =>
      edge?.direction === 'forward' &&
      layerById.has(edge.from) &&
      layerById.has(edge.to) &&
      edge.from !== edge.to,
  );
  // Monotone fixpoint: the result is the longest forward path and therefore
  // independent of the relaxation order (deterministic by construction).
  for (let round = 0; round < sourceNodes.length; round += 1) {
    let changed = false;
    for (const edge of forwardEdges) {
      const next = layerById.get(edge.from) + 1;
      if (next > layerById.get(edge.to)) {
        layerById.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // ---- rows inside a layer: declaration order, then node id ---------------
  const byLayer = new Map();
  for (const node of sourceNodes) {
    const id = typeof node?.id === 'string' ? node.id : null;
    if (id === null) continue;
    const layer = layerById.get(id) ?? 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(id);
  }
  const rowById = new Map();
  for (const layer of [...byLayer.keys()].sort((a, b) => a - b)) {
    const ids = byLayer.get(layer).slice().sort((a, b) => {
      const ia = declarationIndex.get(a) ?? Number.MAX_SAFE_INTEGER;
      const ib = declarationIndex.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    ids.forEach((id, row) => rowById.set(id, row));
  }

  // ---- nodes: x/y from layer/row; z only from abnormal (AC-18) ------------
  const centerById = new Map();
  const nodes = sourceNodes
    .filter((node) => typeof node?.id === 'string' && layerById.has(node.id))
    .map((node) => {
      const layer = layerById.get(node.id) ?? 0;
      const row = rowById.get(node.id) ?? 0;
      const x = layer * LAYER_GAP;
      const y = row * ROW_GAP;
      centerById.set(node.id, { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT / 2 });
      return {
        id: node.id,
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        layer,
        z: node.abnormal === true ? 1 : 0,
      };
    });

  // ---- edges: straight for forward, arc for backflow; edge z lifts with
  // either endpoint (AC-18: edges connected to the abnormal node lift too) --
  const zById = new Map(nodes.map((node) => [node.id, node.z]));
  const edges = [];
  for (const edge of sourceEdges) {
    if (typeof edge?.id !== 'string' || !centerById.has(edge.from) || !centerById.has(edge.to)) continue;
    const z = zById.get(edge.from) === 1 || zById.get(edge.to) === 1 ? 1 : 0;
    if (edge.direction === 'backflow') {
      const a = centerById.get(edge.from);
      const b = centerById.get(edge.to);
      edges.push({
        id: edge.id,
        path: {
          kind: 'arc',
          ctrl: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - ARC_LIFT },
        },
        z,
      });
    } else {
      edges.push({ id: edge.id, path: { kind: 'straight' }, z });
    }
  }

  return { nodes, edges };
}
