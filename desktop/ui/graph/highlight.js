/**
 * Hover highlight set derivation (I1.10a WP-6; AC-33 / BR-27 / BR-28).
 *
 * Contract (split doc 2.2):
 * - `hoverSet(graph, key)` derives the highlight from the graph adjacency
 *   only — never from positions or proximity:
 *   - hovering a node keeps that node, every incoming and outgoing line and
 *     both endpoints of those lines fully opaque;
 *   - hovering a line keeps that line and its two endpoint nodes;
 *   - everything else is dimmed.
 * - A missing / unknown key is the resting state: every element is opaque and
 *   nothing is dimmed (`dimIds` empty), which is exactly the set the caller
 *   gets again when the pointer leaves (`hoverSet(graph, null)`).
 * - `opaqueIds` / `dimIds` mix node and edge ids in one namespace but keep the
 *   graph declaration order (nodes first, then edges), so the result is
 *   deterministic and cheap to compare.
 * - Choosing a key never mutates the graph: the caller keeps the real layout
 *   coordinates untouched (AC-33 last clause).
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

function idList(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const nodeIds = [];
  const edgeIds = [];
  for (const node of nodes) {
    if (typeof node?.id === 'string' && node.id.length > 0) nodeIds.push(node.id);
  }
  for (const edge of edges) {
    if (typeof edge?.id === 'string' && edge.id.length > 0) edgeIds.push(edge.id);
  }
  return { nodes, edges, nodeIds, edgeIds };
}

/**
 * Highlight sets for one hovered element.
 *
 * @param {{ nodes?: Array<object>, edges?: Array<object> }} graph
 *        the frozen projection (read-only)
 * @param {string|null} key the hovered node id or edge id; `null` clears
 * @returns {{ opaqueIds: string[], dimIds: string[] }}
 */
export function hoverSet(graph, key) {
  const { edges, nodeIds, edgeIds } = idList(graph);
  const order = [...nodeIds, ...edgeIds];
  const hovered = typeof key === 'string' && key.length > 0 ? key : null;

  if (hovered === null) return { opaqueIds: order, dimIds: [] };

  const opaque = new Set();
  if (nodeIds.includes(hovered)) {
    opaque.add(hovered);
    for (const edge of edges) {
      if (edge?.from !== hovered && edge?.to !== hovered) continue;
      if (typeof edge.id === 'string') opaque.add(edge.id);
      if (typeof edge.from === 'string') opaque.add(edge.from);
      if (typeof edge.to === 'string') opaque.add(edge.to);
    }
  } else if (edgeIds.includes(hovered)) {
    const target = edges.find((edge) => edge?.id === hovered) ?? null;
    if (target === null) return { opaqueIds: order, dimIds: [] };
    opaque.add(hovered);
    if (typeof target.from === 'string') opaque.add(target.from);
    if (typeof target.to === 'string') opaque.add(target.to);
  } else {
    // Unknown key: treat it exactly like the resting state.
    return { opaqueIds: order, dimIds: [] };
  }

  const opaqueIds = order.filter((id) => opaque.has(id));
  const dimIds = order.filter((id) => !opaque.has(id));
  return { opaqueIds, dimIds };
}
