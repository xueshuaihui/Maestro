/**
 * In-memory graph projection (I1.10a WP-4; requirement D-2 / D-3, split doc 2.1).
 *
 * Pure function core: it turns one instance snapshot plus a workflow definition
 * plus role data into the frozen desktop contract shape. It never reads or
 * writes the filesystem, never touches the event bus, and never reads the wall
 * clock: disk IO and time belong to the caller (routes.js, stream.js, harness).
 * The read-only discipline of D-3 is absolute: no state write, no event
 * publication, no trace append may ever be reached from this module, which the
 * AC-07 architecture gate verifies by scanning this file for the offending
 * call shapes (state save / event publish) and requiring zero hits.
 *
 * Node semantics (D-3):
 * - `role` nodes are role instances (one per role id), consuming the
 *   `buildRoleInstances` shape; an absent registry makes every declared or
 *   bound role "known by declaration" instead of unavailable.
 * - `human` / `escalate` nodes come from the definition layer `node_type`;
 *   their status is the snapshot node state, `pending` when missing.
 * - `subworkflow` nodes are collapsed groups; `memberCount` counts the
 *   distinct role nodes of the child definition; an unreadable child
 *   definition yields `memberCount: null`, a gray (null) status and
 *   `abnormal: false`.
 * - `group` nodes are generated only when visible role nodes exceed 12.
 * - unknown `node_type` renders as a role node and keeps its definition id,
 *   so no node is ever dropped.
 *
 * Edge semantics (D-3 / A-11): endpoints of role-type definition nodes are
 * aggregated to the role instance id (`role:<roleId>`), special endpoints keep
 * the definition node id; the same `(from, to, direction)` triple merges into
 * one edge; definition edges without handoffs are `not_started`; the aggregate
 * status follows `AGGREGATE_PRIORITY` only; visual tokens come from
 * `EDGE_VISUAL` only; `parallelCount` counts the handoffs of the latest round
 * so multi-round backflows stay one arc with `latestRound` preserved (AC-16).
 *
 * `rev` (D-2): the maximal event seq among whitelisted events; the caller may
 * pass `rev` directly or an `events` array from the read-only replay. The
 * whitelist is expressed on the event object kind, because the existing event
 * stream does not use category-unique reasons (`state.change` is emitted for
 * sessions, nodes and the instance alike). `session.state`, `execution.summary`
 * and `health.changed` can therefore never advance `rev`.
 */

import { buildRoleInstances } from '../registry/role-instances.js';

/** Aggregate priority over handoff states (A-11 / D-3, first is strongest). */
export const AGGREGATE_PRIORITY = Object.freeze([
  'rejected',
  'expired',
  'pending',
  'delivered',
  'accepted',
  'consumed',
  'not_started',
]);

/** Frozen A-11 token table: aggregate status -> visual tokens. */
export const EDGE_VISUAL = Object.freeze({
  rejected: Object.freeze({ color: 'red', dash: 'solid', arrow: 'back', animation: 'none', badge: null }),
  expired: Object.freeze({ color: 'orange', dash: 'dashed', arrow: 'forward', animation: 'none', badge: '!' }),
  pending: Object.freeze({ color: 'yellow', dash: 'dashed', arrow: 'forward', animation: 'none', badge: null }),
  delivered: Object.freeze({ color: 'blue', dash: 'solid', arrow: 'forward', animation: 'flow', badge: null }),
  accepted: Object.freeze({ color: 'blue', dash: 'solid', arrow: 'forward', animation: 'none', badge: null }),
  consumed: Object.freeze({ color: 'green', dash: 'solid', arrow: 'forward', animation: 'none', badge: null }),
  not_started: Object.freeze({ color: 'gray', dash: 'dashed', arrow: 'forward', animation: 'none', badge: null }),
});

/** Aggregate states whose label is visible by default (A-11 last column). */
export const LABEL_VISIBLE_STATES = Object.freeze(new Set(['rejected', 'expired', 'pending']));

/**
 * Rev whitelist, expressed as the D-2 event categories (node state, handoff,
 * escalation, instance state, special node). `session`, `execution` and
 * `health` objects are outside by construction (AC-10 anchor).
 */
export const REV_WHITELIST = Object.freeze([
  'node',
  'handoff',
  'escalation',
  'instance',
  'special_node',
]);

/** True when the event may advance `rev`. */
export function isRevEvent(event) {
  return typeof event?.object === 'string' && REV_WHITELIST.includes(event.object);
}

/**
 * Visibility of one connection line for the "show not-started lines" toggle
 * (AC-15): `not_started` is hidden by default and shown once the toggle is on.
 */
export function edgeHidden(edge, { showNotStarted = false } = {}) {
  return edge?.aggregateStatus === 'not_started' && showNotStarted !== true;
}

const GROUP_THRESHOLD = 12;
const SPECIAL_NODE_TYPES = new Set(['human', 'escalate', 'subworkflow']);

/** Role-instance six-status -> desktop five-status visual token (A-9). */
const STATUS_TOKENS = Object.freeze({
  available: 'available',
  busy: 'serving',
  cooldown: 'cooldown',
  unavailable: 'unavailable',
  inactive: 'inactive',
  retired: 'inactive',
});

/** Handoff state -> aggregate status (A-11 seven states; unknown falls to pending). */
const HANDOFF_AGGREGATE = Object.freeze({
  created: 'pending',
  pending: 'pending',
  delivered: 'delivered',
  accepted: 'accepted',
  consumed: 'consumed',
  rejected: 'rejected',
  expired: 'expired',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function stateNodeKey(node) {
  if (!node || typeof node !== 'object') return null;
  const id = node.nodeId ?? node.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function defNodeId(node) {
  if (!node || typeof node !== 'object') return null;
  const id = node.id ?? node.nodeId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function nodeTypeOf(node) {
  const raw = node?.node_type ?? node?.nodeType;
  return typeof raw === 'string' && raw.length > 0 ? raw : 'role';
}

function defRoleOf(node) {
  const raw = node?.role ?? node?.roleId;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function defRefOf(def) {
  const raw = def?.id ?? def?.workflow;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function roundOf(value) {
  return Number.isInteger(value) ? value : 0;
}

/** Build an empty node with every contract key present (D-2 uniform shape). */
function emptyNode() {
  return {
    id: null,
    type: 'role',
    title: null,
    roleId: null,
    status: null,
    statusReason: null,
    activeSessions: 0,
    servingNodes: [],
    hostIcons: [],
    abnormal: false,
    abnormalCount: 0,
    nodeIds: [],
    memberCount: null,
    collapsed: false,
    lastActivity: null,
    round: null,
    maxRounds: null,
    group: null,
    workflow: null,
  };
}

/**
 * Pure projection. `state` is the instance snapshot object (already read by the
 * caller), `workflowDef` the resolved definition (builtin shape or parsed yaml,
 * `null` when unreadable), `roles` the registry assets (Map or plain object),
 * `traces` the landed spans, `events` the read-only event replay used for
 * `rev`, `rev` an optional explicit override, `subWorkflows` the resolved child
 * definitions keyed by reference, and `now` is reserved by the frozen
 * signature (this module never reads a clock itself).
 *
 * @returns {{rev:number, instanceId:string|null, template:string|null,
 *            state:string|null, workflow:{ref:string|null, readable:boolean},
 *            nodes:Array<object>, edges:Array<object>}}
 */
export function buildGraph({ state, workflowDef, roles, traces, events, rev, subWorkflows, now } = {}) {
  void now; // frozen signature placeholder: time comes from the caller only.

  const snapshot = state !== null && typeof state === 'object' ? state : {};
  const def = workflowDef !== null && typeof workflowDef === 'object' ? workflowDef : null;
  const defNodes = asArray(def?.nodes);
  const defEdges = asArray(def?.edges);
  const stateNodes = asArray(snapshot.nodes);

  const stateNodeById = new Map();
  for (const node of stateNodes) {
    const key = stateNodeKey(node);
    if (key !== null && !stateNodeById.has(key)) stateNodeById.set(key, node);
  }

  const subDefMap = subWorkflows instanceof Map
    ? subWorkflows
    : subWorkflows !== null && typeof subWorkflows === 'object'
      ? new Map(Object.entries(subWorkflows))
      : null;

  // ---- role instance projection (D-3: roles, known by declaration) --------
  const declaredRoles = Array.isArray(def?.roles)
    ? def.roles.filter((id) => typeof id === 'string' && id.length > 0)
    : defNodes
      .filter((node) => nodeTypeOf(node) === 'role' && defRoleOf(node) !== null)
      .map((node) => defRoleOf(node));

  const boundRoleIds = [];
  const nodeIdsByRole = new Map();
  for (const node of stateNodes) {
    const roleId = typeof node?.roleId === 'string' && node.roleId.length > 0 ? node.roleId : null;
    const key = stateNodeKey(node);
    if (roleId === null || key === null) continue;
    if (!nodeIdsByRole.has(roleId)) nodeIdsByRole.set(roleId, []);
    nodeIdsByRole.get(roleId).push(key);
    if (!boundRoleIds.includes(roleId)) boundRoleIds.push(roleId);
  }

  const seenRoles = new Set();
  const allRoleIds = [];
  for (const roleId of [...declaredRoles, ...boundRoleIds]) {
    if (seenRoles.has(roleId)) continue;
    seenRoles.add(roleId);
    allRoleIds.push(roleId);
  }

  const providedRoles = roles instanceof Map
    ? roles
    : roles !== null && typeof roles === 'object'
      ? new Map(Object.entries(roles))
      : null;
  let effectiveRoles = providedRoles;
  if (effectiveRoles === null || effectiveRoles.size === 0) {
    // D-3: an absent registry must not turn declared roles unavailable.
    effectiveRoles = new Map(allRoleIds.map((id) => [id, { id, name: id, group: null }]));
  }
  const roleAssetOf = (roleId) => effectiveRoles.get(roleId) ?? null;

  // D-3 ③: an unreadable definition projects an empty graph (no nodes, no
  // edges); role instances are only drawn when a definition anchors them.
  const instanceView = def !== null
    ? buildRoleInstances({
      state: snapshot,
      graph: { roles: declaredRoles, maxRounds: def?.maxRounds ?? null },
      roles: effectiveRoles,
    })
    : { roles: [] };

  // ---- latest landed span end time per snapshot node id (D-3 lastActivity) --
  const latestEndByNode = new Map();
  for (const span of asArray(traces)) {
    const nodeId = typeof span?.node_id === 'string' && span.node_id.length > 0
      ? span.node_id
      : (typeof span?.nodeId === 'string' && span.nodeId.length > 0 ? span.nodeId : null);
    const end = typeof span?.end_time === 'string' && span.end_time.length > 0
      ? span.end_time
      : (typeof span?.endTime === 'string' && span.endTime.length > 0 ? span.endTime : null);
    if (nodeId === null || end === null) continue;
    const ms = Date.parse(end);
    if (!Number.isFinite(ms)) continue;
    const prev = latestEndByNode.get(nodeId);
    if (prev === undefined || ms > prev.ms) latestEndByNode.set(nodeId, { ms, end });
  }
  const latestEndFor = (nodeIds) => {
    let best = null;
    for (const id of nodeIds) {
      const hit = latestEndByNode.get(id);
      if (hit !== undefined && (best === null || hit.ms > best.ms)) best = hit;
    }
    return best === null ? null : best.end;
  };
  const fallbackActivity = typeof snapshot.updatedAt === 'string' ? snapshot.updatedAt : null;

  // ---- role nodes ---------------------------------------------------------
  const nodes = [];
  const nodeIdSet = new Set();
  const roleNodeIdByRole = new Map();

  for (const view of instanceView.roles) {
    const boundIds = nodeIdsByRole.get(view.roleId) ?? [];
    let escalatedCount = 0;
    for (const id of boundIds) {
      if (stateNodeById.get(id)?.state === 'escalated') escalatedCount += 1;
    }
    const asset = roleAssetOf(view.roleId);
    const node = emptyNode();
    node.id = `role:${view.roleId}`;
    node.type = 'role';
    node.title = typeof asset?.name === 'string' && asset.name.length > 0 ? asset.name : view.roleId;
    node.roleId = view.roleId;
    node.status = STATUS_TOKENS[view.status] ?? view.status;
    node.statusReason = view.statusReason ?? null;
    node.activeSessions = asArray(view.activeSessions).length;
    node.servingNodes = asArray(view.servingNodes).slice();
    node.hostIcons = asArray(view.hostIcons).slice();
    node.abnormal = escalatedCount > 0;
    node.abnormalCount = escalatedCount;
    node.lastActivity = latestEndFor(boundIds) ?? fallbackActivity;
    node.round = view.lastAction?.round ?? null;
    node.maxRounds = view.lastAction?.maxRounds ?? null;
    node.group = typeof asset?.group === 'string' && asset.group.length > 0 ? asset.group : null;
    nodes.push(node);
    nodeIdSet.add(node.id);
    roleNodeIdByRole.set(view.roleId, node.id);
  }

  // ---- definition-derived nodes (special, fallback and unknown types) ------
  const defNodeById = new Map();
  for (const defNode of defNodes) {
    const id = defNodeId(defNode);
    if (id !== null && !defNodeById.has(id)) defNodeById.set(id, defNode);
  }

  const pendingEscalationNodeIds = new Set();
  for (const escalation of asArray(snapshot.escalations)) {
    if (escalation?.state !== 'pending') continue;
    const nodeId = escalation?.nodeId;
    if (typeof nodeId === 'string' && nodeId.length > 0) pendingEscalationNodeIds.add(nodeId);
  }

  const roleNodes = nodes.slice();

  /**
   * Emit one node anchored at a definition node id (special types, role-type
   * nodes without a resolvable role instance, and unknown node types).
   */
  const emitDefNode = (id, type, defNode, roleId, extra = {}) => {
    const live = stateNodeById.get(id) ?? null;
    const state = typeof live?.state === 'string' && live.state.length > 0 ? live.state : 'pending';
    const node = emptyNode();
    node.id = id;
    node.type = type;
    node.title = typeof defNode?.title === 'string' && defNode.title.length > 0
      ? defNode.title
      : (roleId ?? id);
    node.roleId = roleId;
    node.status = extra.status !== undefined ? extra.status : state;
    node.round = Number.isInteger(live?.round) ? live.round : null;
    node.maxRounds = Number.isInteger(defNode?.max_rounds)
      ? defNode.max_rounds
      : (Number.isInteger(def?.maxRounds?.[id]) ? def.maxRounds[id] : null);
    node.lastActivity = latestEndFor([id]) ?? (typeof live?.stateSince === 'string' ? live.stateSince : null);
    if (extra.abnormal !== undefined) {
      node.abnormal = extra.abnormal;
      node.abnormalCount = extra.abnormalCount ?? (extra.abnormal ? 1 : 0);
    } else {
      const abnormal = state === 'escalated' || pendingEscalationNodeIds.has(id);
      node.abnormal = abnormal;
      node.abnormalCount = abnormal ? 1 : 0;
    }
    Object.assign(node, extra.fields ?? {});
    nodes.push(node);
    nodeIdSet.add(node.id);
  };

  for (const defNode of defNodes) {
    const id = defNodeId(defNode);
    if (id === null) continue;
    const type = nodeTypeOf(defNode);

    if (type === 'role') {
      const roleId = defRoleOf(defNode);
      if (roleId !== null && roleNodeIdByRole.has(roleId)) continue; // already projected
      emitDefNode(id, 'role', defNode, roleId);
      continue;
    }

    if (type === 'human' || type === 'escalate') {
      emitDefNode(id, type, defNode, null);
      continue;
    }

    if (type === 'subworkflow') {
      const ref = typeof defNode?.workflow === 'string' && defNode.workflow.length > 0
        ? defNode.workflow
        : null;
      const childDef = ref !== null && subDefMap !== null ? subDefMap.get(ref) ?? null : null;
      const childNodes = asArray(childDef?.nodes);
      const memberRoleIds = [];
      const memberNodeIds = [];
      for (const childNode of childNodes) {
        if (nodeTypeOf(childNode) !== 'role') continue;
        const childRoleId = defRoleOf(childNode);
        if (childRoleId === null || memberRoleIds.includes(childRoleId)) continue;
        memberRoleIds.push(childRoleId);
        memberNodeIds.push(`role:${childRoleId}`);
      }
      const childDefIds = childNodes.map((childNode) => defNodeId(childNode)).filter(Boolean);
      let escalatedCount = 0;
      for (const childId of childDefIds) {
        if (stateNodeById.get(childId)?.state === 'escalated') escalatedCount += 1;
      }
      emitDefNode(id, 'subworkflow', defNode, null, {
        status: childDef !== null
          ? (typeof stateNodeById.get(id)?.state === 'string' && stateNodeById.get(id).state.length > 0
            ? stateNodeById.get(id).state
            : 'pending')
          : null, // unreadable child definition: gray status, no abnormality (D-3)
        abnormal: childDef !== null && escalatedCount > 0,
        abnormalCount: childDef !== null ? escalatedCount : 0,
        fields: {
          workflow: ref,
          nodeIds: memberNodeIds,
          memberCount: childDef !== null ? memberRoleIds.length : null,
          collapsed: true,
        },
      });
      continue;
    }

    // Unknown node_type: render as a role node, keep the definition id (D-3).
    emitDefNode(id, 'role', defNode, defRoleOf(defNode));
  }

  // ---- group nodes (only above the 12 visible role nodes threshold) --------
  if (roleNodes.length > GROUP_THRESHOLD) {
    const groups = new Map();
    for (const roleNode of roleNodes) {
      const key = roleNode.group;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(roleNode);
    }
    const orderedKeys = [...groups.keys()].sort((a, b) => {
      if (a === null) return 1; // ungrouped members last, deterministic order
      if (b === null) return -1;
      return compareText(a, b);
    });
    for (const key of orderedKeys) {
      const members = groups.get(key);
      const abnormalCount = members.reduce((sum, member) => sum + member.abnormalCount, 0);
      const node = emptyNode();
      node.id = `group:${key ?? 'ungrouped'}`;
      node.type = 'group';
      node.title = key;
      node.status = null;
      node.abnormal = abnormalCount > 0;
      node.abnormalCount = abnormalCount;
      node.nodeIds = members.map((member) => member.id);
      node.memberCount = members.length;
      node.collapsed = true;
      node.group = key;
      nodes.push(node);
      nodeIdSet.add(node.id);
    }
  }

  // ---- edges --------------------------------------------------------------
  const edgeBuckets = new Map();
  const edgeOrder = [];
  const bucketKey = (from, to, direction) => `${from}\u0000${to}\u0000${direction}`;

  const endpointOf = (defId) => {
    const defNode = defNodeById.get(defId);
    if (defNode === undefined) return null;
    const type = nodeTypeOf(defNode);
    if (type === 'role') {
      const roleId = defRoleOf(defNode);
      if (roleId !== null) return roleNodeIdByRole.get(roleId) ?? defId;
      return defId;
    }
    return defId; // special types and unknown types keep the definition id
  };

  const directionOf = (kind) => (kind === 'backflow' ? 'backflow' : 'forward');

  const addBucket = (from, to, direction) => {
    const key = bucketKey(from, to, direction);
    let bucket = edgeBuckets.get(key);
    if (bucket === undefined) {
      bucket = { from, to, direction, handoffs: [] };
      edgeBuckets.set(key, bucket);
      edgeOrder.push(bucket);
    }
    return bucket;
  };

  for (const defEdge of defEdges) {
    if (!defEdge || typeof defEdge !== 'object') continue;
    const from = typeof defEdge.from === 'string' ? endpointOf(defEdge.from) : null;
    const to = typeof defEdge.to === 'string' ? endpointOf(defEdge.to) : null;
    if (from === null || to === null) continue; // never draw a dangling line
    const kind = typeof defEdge.kind === 'string' && defEdge.kind.length > 0 ? defEdge.kind : 'forward';
    addBucket(from, to, directionOf(kind));
  }

  for (const handoff of asArray(snapshot.handoffs)) {
    if (!handoff || typeof handoff !== 'object') continue;
    const rawFrom = handoff?.edge?.from ?? handoff?.fromNodeId ?? null;
    const rawTo = handoff?.edge?.to ?? handoff?.toNodeId ?? null;
    const rawKind = handoff?.edge?.kind ?? handoff?.edgeKind ?? handoff?.kind ?? 'forward';
    if (typeof rawFrom !== 'string' || typeof rawTo !== 'string') continue;
    const from = endpointOf(rawFrom);
    const to = endpointOf(rawTo);
    if (from === null || to === null) continue;
    const bucket = edgeBuckets.get(bucketKey(from, to, directionOf(rawKind)));
    if (bucket === undefined) continue; // a handoff without a definition edge is not drawn
    bucket.handoffs.push({
      id: typeof handoff.handoffId === 'string' && handoff.handoffId.length > 0 ? handoff.handoffId : null,
      state: typeof handoff.state === 'string' && handoff.state.length > 0 ? handoff.state : null,
      round: roundOf(handoff.round),
    });
  }

  const edges = edgeOrder.map((bucket, index) => {
    let aggregate = 'not_started';
    let latestRound = null;
    let parallelCount = 0;
    if (bucket.handoffs.length > 0) {
      let bestRank = AGGREGATE_PRIORITY.length; // smallest index wins (rejected first)
      for (const handoff of bucket.handoffs) {
        const status = HANDOFF_AGGREGATE[handoff.state] ?? 'pending';
        const rank = AGGREGATE_PRIORITY.indexOf(status);
        if (rank >= 0 && rank < bestRank) {
          bestRank = rank;
          aggregate = status;
        }
      }
      latestRound = bucket.handoffs.reduce((max, handoff) => Math.max(max, handoff.round), 0);
      parallelCount = bucket.handoffs.filter((handoff) => handoff.round === latestRound).length;
    }
    return {
      id: `E-${String(index + 1).padStart(2, '0')}`,
      from: bucket.from,
      to: bucket.to,
      direction: bucket.direction,
      aggregateStatus: aggregate,
      handoffIds: bucket.handoffs
        .map((handoff) => handoff.id)
        .filter((id) => id !== null)
        .sort(compareText),
      parallelCount,
      latestRound,
      visual: EDGE_VISUAL[aggregate],
      labelVisible: LABEL_VISIBLE_STATES.has(aggregate),
    };
  });

  // ---- rev (D-2 whitelist) -------------------------------------------------
  let resolvedRev = 0;
  if (Number.isFinite(rev) && rev >= 0) {
    resolvedRev = Math.trunc(rev);
  } else {
    for (const event of asArray(events)) {
      if (!isRevEvent(event)) continue;
      const seq = event?.seq;
      if (Number.isInteger(seq) && seq > resolvedRev) resolvedRev = seq;
    }
  }

  const workflowRef = typeof snapshot.workflowRef === 'string' && snapshot.workflowRef.length > 0
    ? snapshot.workflowRef
    : defRefOf(def) ?? (typeof snapshot.template === 'string' ? snapshot.template : null);

  return {
    rev: resolvedRev,
    instanceId: typeof snapshot.instanceId === 'string' ? snapshot.instanceId : null,
    template: typeof snapshot.template === 'string' ? snapshot.template : null,
    state: typeof snapshot.state === 'string' ? snapshot.state : null,
    workflow: { ref: workflowRef, readable: def !== null },
    nodes,
    edges,
  };
}
