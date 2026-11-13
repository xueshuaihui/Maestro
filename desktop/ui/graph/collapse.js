/**
 * Automatic role-group collapse (I1.10a WP-6; BR-15 / AC-19 / section 2.10).
 *
 * Contract (split doc 2.2):
 * - `autoCollapse(nodes, { threshold = 12 })` groups the visible role nodes by
 *   their role `group` as soon as there are more than `threshold` of them. The
 *   grouping key is the role `group` only (never the role id, never the title);
 *   a role without a group lands in the single ungrouped bucket, whose node id
 *   is `group:ungrouped` and whose display name is left to the label layer
 *   (this module owns no text). The result is a plain, data-only collapse
 *   model: the group nodes, the visible node list, the re-wired edge list and
 *   the group membership, ready to be handed to the layout module.
 * - The input may be the frozen projection graph (`{ nodes, edges }`), whose
 *   `group` nodes are produced upstream, or a bare node array. When the graph
 *   already carries `group` nodes they are reused verbatim (same ids, same
 *   members) so the two layers never disagree.
 * - Collapsed state: only the group nodes (and every node outside a group)
 *   are visible; edges between two members of the same collapsed group are
 *   internal and disappear, edges leaving a collapsed group re-attach to its
 *   group node (no dangling line, no duplicated line).
 * - An expanded group keeps its container node visible next to its members, so
 *   the three AC-19 states are 2 (all collapsed) / 10 (eight members plus both
 *   containers) / 2 (collapsed again), and the members keep their original
 *   relative order — the visible list is the input order with group members
 *   substituted at their first member position, which is what makes the layout
 *   put expanded members back on their original layers and rows.
 * - `toggleGroup(view, groupId)` flips one group and returns a new model.
 *   Neither function mutates its input: the source arrays stay untouched.
 *
 * Subworkflows are always collapsed by the projection (`collapsed: true`) and
 * are not part of this model: a subworkflow group node is never a member of an
 * automatic group. `buildView` re-asserts that state on every emitted node
 * (B-21), so an upstream `collapsed: false` can never be drawn expanded.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

/** Visible role nodes above this count trigger automatic grouping (D-4). */
export const COLLAPSE_THRESHOLD = 12;

/** Node id of the bucket for roles without a `group` (matches the projection). */
export const UNGROUPED_GROUP_ID = 'group:ungrouped';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function groupIdOf(key) {
  return key === null ? UNGROUPED_GROUP_ID : `group:${key}`;
}

function isRoleNode(node) {
  return node !== null && typeof node === 'object'
    && node.type === 'role'
    && typeof node.id === 'string'
    && node.id.length > 0;
}

function isGroupNode(node) {
  return node !== null && typeof node === 'object'
    && node.type === 'group'
    && typeof node.id === 'string'
    && node.id.length > 0
    && Array.isArray(node.nodeIds);
}

/**
 * Emit a node of the visible view. A subworkflow is always collapsed (B-21):
 * the projection declares it once, and this normalisation keeps a drifting
 * `collapsed: false` from rendering it expanded. Other nodes pass through.
 */
function viewNode(node) {
  if (node !== null && typeof node === 'object' && node.type === 'subworkflow' && node.collapsed !== true) {
    return { ...node, collapsed: true };
  }
  return node;
}

/**
 * Automatic groups derived from the role `group` field (no projected group
 * nodes present). Key order follows the projection: text order, ungrouped last.
 */
function deriveGroups(roleNodes) {
  const buckets = new Map();
  for (const node of roleNodes) {
    const key = typeof node.group === 'string' && node.group.length > 0 ? node.group : null;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(node);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return compareText(a, b);
  });
  return keys.map((key) => {
    const members = buckets.get(key);
    let abnormalCount = 0;
    for (const member of members) {
      abnormalCount += Number.isInteger(member.abnormalCount) ? member.abnormalCount : (member.abnormal === true ? 1 : 0);
    }
    return {
      id: groupIdOf(key),
      type: 'group',
      title: key,
      group: key,
      memberCount: members.length,
      nodeIds: members.map((member) => member.id),
      collapsed: true,
      abnormal: abnormalCount > 0,
      abnormalCount,
    };
  });
}

/** Normalise the projected group nodes into the same data shape. */
function adoptGroups(groupNodes) {
  return groupNodes.map((node) => {
    const ids = node.nodeIds.filter((id) => typeof id === 'string' && id.length > 0);
    const abnormalCount = Number.isInteger(node.abnormalCount)
      ? node.abnormalCount
      : (node.abnormal === true ? 1 : 0);
    return {
      id: node.id,
      type: 'group',
      title: typeof node.title === 'string' ? node.title : (typeof node.group === 'string' ? node.group : null),
      group: typeof node.group === 'string' && node.group.length > 0 ? node.group : null,
      memberCount: ids.length,
      nodeIds: ids,
      collapsed: true,
      abnormal: node.abnormal === true || abnormalCount > 0,
      abnormalCount,
    };
  });
}

function mapEdges(edges, memberGroup, collapsed) {
  const out = [];
  const seen = new Set();
  for (const edge of edges) {
    if (edge === null || typeof edge !== 'object') continue;
    let from = edge.from;
    let to = edge.to;
    const fromGroup = typeof from === 'string' ? memberGroup[from] : undefined;
    if (fromGroup !== undefined && collapsed.has(fromGroup)) from = fromGroup;
    const toGroup = typeof to === 'string' ? memberGroup[to] : undefined;
    if (toGroup !== undefined && collapsed.has(toGroup)) to = toGroup;
    // A line that became internal to one collapsed group disappears; a
    // pre-existing self loop is never dropped by this rewriting.
    if (from === to && (from !== edge.from || to !== edge.to)) continue;
    const key = `${from}\u0000${to}\u0000${edge.direction ?? ''}`;
    if (seen.has(key)) continue; // parallel lines merge onto the group node
    seen.add(key);
    out.push(from === edge.from && to === edge.to ? edge : { ...edge, from, to });
  }
  return out;
}

function buildView({ baseNodes, baseEdges, groups, expanded, active, threshold }) {
  const expandedSet = new Set(expanded);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const memberGroup = {};
  for (const group of groups) {
    for (const id of group.nodeIds) memberGroup[id] = group.id;
  }

  if (!active) {
    return {
      active: false,
      threshold,
      groups: [],
      expanded: [],
      collapsedGroupIds: [],
      nodes: baseNodes.map(viewNode),
      edges: baseEdges.slice(),
      memberGroup: {},
      members: {},
      visibleIds: baseNodes.map((node) => node?.id).filter((id) => typeof id === 'string'),
      source: { nodes: baseNodes, edges: baseEdges },
    };
  }

  const emitted = new Set();
  const nodes = [];
  const emitGroup = (groupId) => {
    const group = groupById.get(groupId);
    if (group === undefined || emitted.has(groupId)) return;
    emitted.add(groupId);
    nodes.push({ ...group, nodeIds: group.nodeIds.slice(), collapsed: !expandedSet.has(groupId) });
  };

  for (const node of baseNodes) {
    if (isGroupNode(node)) continue; // re-emitted at the first member position
    const id = typeof node?.id === 'string' ? node.id : null;
    const groupId = id === null ? undefined : memberGroup[id];
    if (groupId === undefined) {
      nodes.push(viewNode(node));
      continue;
    }
    emitGroup(groupId);
    if (expandedSet.has(groupId)) nodes.push(viewNode(node));
  }
  for (const group of groups) emitGroup(group.id);

  const collapsed = new Set(groups.map((group) => group.id).filter((id) => !expandedSet.has(id)));
  const edges = mapEdges(baseEdges, memberGroup, collapsed);

  const members = {};
  for (const group of groups) members[group.id] = group.nodeIds.slice();

  return {
    active: true,
    threshold,
    groups: groups.map((group) => ({
      ...group,
      nodeIds: group.nodeIds.slice(),
      collapsed: !expandedSet.has(group.id),
    })),
    expanded: groups.map((group) => group.id).filter((id) => expandedSet.has(id)),
    collapsedGroupIds: groups.map((group) => group.id).filter((id) => collapsed.has(id)),
    nodes,
    edges,
    memberGroup: { ...memberGroup },
    members,
    visibleIds: nodes.map((node) => node?.id).filter((id) => typeof id === 'string'),
    source: { nodes: baseNodes, edges: baseEdges },
  };
}

/**
 * Build the collapse model of one graph.
 *
 * @param {Array<object>|{ nodes?: Array<object>, edges?: Array<object> }} nodes
 *        the visible node list, or the frozen projection graph
 * @param {{ threshold?: number }} [options]
 * @returns {{ active: boolean, threshold: number, groups: Array<object>,
 *             expanded: string[], collapsedGroupIds: string[],
 *             nodes: Array<object>, edges: Array<object>,
 *             memberGroup: Record<string,string>,
 *             members: Record<string,string[]>, visibleIds: string[],
 *             source: { nodes: Array<object>, edges: Array<object> } }}
 *        `nodes` / `edges` are the visible, re-wired views for the layout;
 *        `source` keeps the untouched inputs so `toggleGroup` can rebuild.
 */
export function autoCollapse(nodes, options = {}) {
  const threshold = Number.isInteger(options?.threshold) && options.threshold >= 0
    ? options.threshold
    : COLLAPSE_THRESHOLD;
  const baseNodes = asArray(Array.isArray(nodes) ? nodes : nodes?.nodes);
  const baseEdges = Array.isArray(nodes) ? [] : asArray(nodes?.edges);

  const roleNodes = baseNodes.filter(isRoleNode);
  const active = roleNodes.length > threshold;

  let groups = [];
  if (active) {
    const projected = baseNodes.filter(isGroupNode);
    groups = projected.length > 0 ? adoptGroups(projected) : deriveGroups(roleNodes);
  }

  return buildView({ baseNodes, baseEdges, groups, expanded: [], active, threshold });
}

/**
 * Expand or collapse one group and return the next model.
 *
 * @param {object} view a model produced by `autoCollapse`
 * @param {string} groupId the group node id
 * @returns {object} a new model (the input is left untouched)
 */
export function toggleGroup(view, groupId) {
  const groups = asArray(view?.groups);
  const id = typeof groupId === 'string' ? groupId : null;
  const known = id !== null && groups.some((group) => group.id === id);
  if (!known) return view;

  const expanded = asArray(view?.expanded).filter((entry) => typeof entry === 'string');
  const nextExpanded = expanded.includes(id)
    ? expanded.filter((entry) => entry !== id)
    : [...expanded, id];

  const baseNodes = Array.isArray(view?.source?.nodes) ? view.source.nodes : asArray(view?.nodes);
  const baseEdges = Array.isArray(view?.source?.edges) ? view.source.edges : asArray(view?.edges);
  return buildView({
    baseNodes,
    baseEdges,
    groups,
    expanded: nextExpanded,
    active: view?.active === true,
    threshold: Number.isInteger(view?.threshold) ? view.threshold : COLLAPSE_THRESHOLD,
  });
}
