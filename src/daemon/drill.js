/**
 * Drill-down read-only projections (I1.10b WP-2; split doc §1.1 / §3.1~§3.6,
 * requirement D-1 / D-2).
 *
 * Five pure projections over already-read inputs (instance snapshot, workflow
 * definition, event replay, graph payload): `buildDrill`, `buildNodeDetail`,
 * `buildConnectionPanel`, `buildEscalationList`, `buildSubflowGraph`. This
 * module never touches the store, never appends to the event log, never
 * publishes on the bus and never reads the wall clock: disk IO and time belong
 * to the caller (routes.js passes `loadState` / `replayEvents` results and a
 * caller-owned `now`). The single sanctioned filesystem access is the
 * evidence-existence check (read-only `fs.access`, requirement D-2 / D-6); it
 * never creates, repairs or caches anything inside the instance directory.
 *
 * Role-level truth comes exclusively from the existing `buildRoleInstances`
 * projection (decision H: no status-word logic is rewritten here). The
 * `roleBar.statusToken` is read from the caller-provided graph payload —
 * which the drill route has already passed through the existing test
 * overlay seam (contract A2, second call site) — every other roleBar field
 * is taken from the same `buildRoleInstances` view the graph used.
 *
 * The daemon ships keys plus structured data only (A-10 division of labor):
 * no sentence composition happens here, and no host name is known to this
 * module (the architecture gate scans it for host literals).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { buildRoleInstances } from '../registry/role-instances.js';

/** Eight card tiers in sort order (§1.9); `rank` is the 1-based index. */
export const CARD_TIERS = Object.freeze([
  'escalated',
  'failed',
  'running',
  'review',
  'assigned',
  'ready',
  'blocked',
  'done',
]);

/** Node states with a fixed tier; everything else degrades like the board. */
const TIER_BY_STATE = Object.freeze({
  escalated: 'escalated',
  failed: 'failed',
  running: 'running',
  review: 'review',
  assigned: 'assigned',
  ready: 'ready',
  blocked: 'blocked',
  done: 'done',
  cancelled: 'done', // board folds cancelled into done (U-8); no unknown tag
});

/** Handoff timestamp fields -> timeline stage tokens (§3.5 sample). */
const HANDOFF_TS_FIELDS = Object.freeze([
  ['createdAt', 'built'],
  ['pendingAt', 'pending'],
  ['deliveredAt', 'delivered'],
  ['acceptedAt', 'accepted'],
  ['consumedAt', 'consumed'],
  ['rejectedAt', 'rejected'],
  ['expiredAt', 'expired'],
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function textOrEmpty(value) {
  return value === null || value === undefined ? '' : String(value);
}

function objOrEmpty(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function defNodeId(node) {
  const id = node?.id ?? node?.nodeId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function defRoleOf(node) {
  const raw = node?.role ?? node?.roleId;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function nodeTypeOf(node) {
  const raw = node?.node_type ?? node?.nodeType;
  return typeof raw === 'string' && raw.length > 0 ? raw : 'role';
}

function directionOf(kind) {
  return kind === 'backflow' ? 'backflow' : 'forward';
}

function maxRoundsOf(def, defNode, nodeId) {
  if (defNode && Number.isInteger(defNode.max_rounds)) return defNode.max_rounds;
  const table = def?.maxRounds;
  if (table && Number.isInteger(table[nodeId])) return table[nodeId];
  return null;
}

function roundTextOf(stateNode, maxRounds) {
  const round = Number.isInteger(stateNode?.round) ? stateNode.round : 1;
  return `${round}/${Number.isInteger(maxRounds) ? maxRounds : '—'}`;
}

/**
 * Declared roles of a definition, mirroring the graph projection's reading
 * order: explicit `roles` list first, else role-type definition nodes.
 */
function declaredRolesOf(def) {
  const defObj = objOrEmpty(def);
  if (Array.isArray(defObj.roles)) {
    return defObj.roles.filter((id) => typeof id === 'string' && id.length > 0);
  }
  return asArray(defObj.nodes)
    .filter((node) => nodeTypeOf(node) === 'role' && defRoleOf(node) !== null)
    .map((node) => defRoleOf(node));
}

/**
 * D-3 registry fallback (same semantics as the graph projection): an absent
 * registry must not turn declared roles unavailable.
 */
function effectiveRolesOf(roles, declared) {
  const provided = roles instanceof Map
    ? roles
    : roles !== null && typeof roles === 'object'
      ? new Map(Object.entries(roles))
      : null;
  if (provided !== null && provided.size > 0) return provided;
  const ids = new Set(declared);
  return new Map([...ids].map((id) => [id, { id, name: id, group: null }]));
}

/** Latest non-empty timestamp of one handoff (last-activity column). */
function handoffLastActivity(handoff) {
  let latest = null;
  for (const [field] of HANDOFF_TS_FIELDS) {
    const value = handoff?.[field];
    if (typeof value !== 'string' || value.length === 0) continue;
    if (latest === null || value > latest) latest = value;
  }
  const updated = handoff?.updatedAt;
  if (typeof updated === 'string' && updated.length > 0 && (latest === null || updated > latest)) {
    latest = updated;
  }
  return latest;
}

/** Timeline of actually reached handoff states, chronological (§3.5). */
function handoffTimeline(handoff) {
  const rows = [];
  for (const [field, stage] of HANDOFF_TS_FIELDS) {
    const value = handoff?.[field];
    if (typeof value !== 'string' || value.length === 0) continue;
    rows.push({ ts: value, state: stage });
  }
  rows.sort((a, b) => compareText(a.ts, b.ts));
  return rows;
}

function handoffEndpoints(handoff) {
  const from = typeof handoff?.fromNodeId === 'string'
    ? handoff.fromNodeId
    : (typeof handoff?.edge?.from === 'string' ? handoff.edge.from : null);
  const to = typeof handoff?.toNodeId === 'string'
    ? handoff.toNodeId
    : (typeof handoff?.edge?.to === 'string' ? handoff.edge.to : null);
  const kind = typeof handoff?.edge?.kind === 'string'
    ? handoff.edge.kind
    : (typeof handoff?.kind === 'string' ? handoff.kind : 'forward');
  return { from, to, kind };
}

/**
 * Direction comes from the definition edge `kind` (AC-15), never from the
 * handoff state. Falls back to the handoff's own kind field, then forward.
 */
function handoffDirection(handoff, def) {
  const { from, to, kind } = handoffEndpoints(handoff);
  if (from !== null && to !== null) {
    const hit = asArray(objOrEmpty(def).edges)
      .find((edge) => edge?.from === from && edge?.to === to) ?? null;
    if (hit) return directionOf(hit.kind);
  }
  return directionOf(kind);
}

/** Read-only existence probe for one evidence ref (D-2 / D-6). */
async function evidenceResolvable(ref, workspace, cwd) {
  const candidates = [];
  if (path.isAbsolute(ref)) {
    candidates.push(ref);
  } else {
    if (typeof workspace === 'string' && workspace.length > 0) {
      candidates.push(path.resolve(workspace, ref));
    }
    if (typeof cwd === 'string' && cwd.length > 0) {
      candidates.push(path.resolve(cwd, ref));
    }
  }
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return 'resolvable';
    } catch {
      // try the next base; a missing file is the expected common case
    }
  }
  return 'missing';
}

function normalizeRef(value) {
  if (typeof value === 'string' && value.length > 0) return value;
  if (value !== null && typeof value === 'object') {
    const ref = value.ref ?? value.path ?? value.evidence;
    if (typeof ref === 'string' && ref.length > 0) return ref;
  }
  return null;
}

/**
 * Role drill-down: breadcrumb + role bar + 1-hop local DAG + task cards
 * (`GET /instances/:id/drill/:roleId`, §3.3).
 *
 * @param {object} input
 * @param {object} input.state instance snapshot
 * @param {object|null} input.workflowDef resolved workflow definition
 * @param {string} input.roleId the drilled-into role id
 * @param {Map|object|null} input.roles registry assets (absent registry keeps
 *   declared roles known, same D-3 semantics as the graph projection)
 * @param {object|null} input.graph graph payload whose role-node tokens are
 *   already final for this request (the route applies the shared test overlay
 *   on it before calling; contract A2)
 * @param {Function} [input.now] reserved by the frozen signature; this module
 *   never reads a clock itself
 */
export function buildDrill({ state, workflowDef, roleId, roles, graph, now } = {}) {
  void now; // frozen signature placeholder: time comes from the caller only.

  const snapshot = objOrEmpty(state);
  const def = workflowDef !== null && typeof workflowDef === 'object' ? workflowDef : null;
  const declared = declaredRolesOf(def);
  const effective = effectiveRolesOf(roles, declared);

  const view = buildRoleInstances({
    state: snapshot,
    graph: { roles: declared, maxRounds: def?.maxRounds ?? null },
    roles: effective,
  });
  const roleView = asArray(view.roles).find((entry) => entry?.roleId === roleId) ?? null;

  const graphNode = asArray(objOrEmpty(graph).nodes)
    .find((node) => node?.type === 'role' && node?.roleId === roleId) ?? null;

  const roleBar = {
    statusToken: graphNode?.status ?? null,
    statusReason: roleView?.statusReason ?? null,
    activeSessions: roleView ? asArray(roleView.activeSessions).length : 0,
    servingNodes: asArray(roleView?.servingNodes),
    hostIcons: asArray(roleView?.hostIcons),
    lastAction: roleView?.lastAction ?? null,
    maxConcurrentSessions: roleView?.maxConcurrentSessions ?? null,
  };

  const breadcrumb = {
    key: 'DRILL_CRUMB_ROLE',
    instanceId: typeof snapshot.instanceId === 'string' ? snapshot.instanceId : null,
    roleId,
    roleTitle: graphNode?.title ?? roleId,
  };

  // ---- 1-hop local DAG over snapshot node ids -----------------------------
  const stateNodes = asArray(snapshot.nodes);
  const stateNodeById = new Map();
  for (const node of stateNodes) {
    const id = typeof node?.nodeId === 'string' && node.nodeId.length > 0 ? node.nodeId : null;
    if (id !== null && !stateNodeById.has(id)) stateNodeById.set(id, node);
  }
  const defNodes = asArray(def?.nodes);
  const defNodeById = new Map();
  for (const node of defNodes) {
    const id = defNodeId(node);
    if (id !== null && !defNodeById.has(id)) defNodeById.set(id, node);
  }
  const defEdges = asArray(def?.edges);

  const boundIds = stateNodes
    .filter((node) => node?.roleId === roleId && typeof node?.nodeId === 'string')
    .map((node) => node.nodeId);
  const boundSet = new Set(boundIds);

  const nodeSet = new Set(boundIds);
  let dangling = 0;
  const localEdges = [];
  for (const defEdge of defEdges) {
    const from = typeof defEdge?.from === 'string' ? defEdge.from : null;
    const to = typeof defEdge?.to === 'string' ? defEdge.to : null;
    if (from === null || to === null) continue;
    const touches = boundSet.has(from) || boundSet.has(to);
    if (!touches) continue;
    const fromKnown = defNodeById.has(from) && stateNodeById.has(from);
    const toKnown = defNodeById.has(to) && stateNodeById.has(to);
    if (!fromKnown || !toKnown) {
      dangling += 1;
      continue;
    }
    nodeSet.add(from);
    nodeSet.add(to);
    localEdges.push({
      id: typeof defEdge.id === 'string' && defEdge.id.length > 0
        ? defEdge.id
        : `DE-${localEdges.length + 1}`,
      from,
      to,
      direction: directionOf(defEdge.kind),
    });
  }

  const relationRank = { self: 0, upstream: 1, downstream: 2 };
  const relationOf = (nodeId) => {
    if (boundSet.has(nodeId)) return 'self';
    const upstream = defEdges.some((edge) => edge?.from === nodeId && boundSet.has(edge?.to));
    if (upstream) return 'upstream';
    return 'downstream';
  };

  const dagNodes = [...nodeSet]
    .map((nodeId) => {
      const live = stateNodeById.get(nodeId) ?? null;
      const defNode = defNodeById.get(nodeId) ?? null;
      return {
        nodeId,
        relation: relationOf(nodeId),
        type: nodeTypeOf(defNode),
        status: typeof live?.state === 'string' && live.state.length > 0 ? live.state : 'pending',
        roleId: typeof live?.roleId === 'string' ? live.roleId : defRoleOf(defNode),
        title: defNode?.title ?? (typeof live?.title === 'string' ? live.title : null),
        round: Number.isInteger(live?.round) ? live.round : null,
        maxRounds: maxRoundsOf(def, defNode, nodeId),
      };
    })
    .sort((a, b) => {
      const delta = relationRank[a.relation] - relationRank[b.relation];
      if (delta !== 0) return delta;
      return compareText(a.nodeId, b.nodeId);
    });

  const dag = {
    nodes: dagNodes,
    edges: localEdges,
    bounds: { width: 240, height: 80 },
    dangling,
  };

  // ---- task cards over the DAG node set -----------------------------------
  const sessions = asArray(snapshot.sessions);
  const latestSessionOf = (nodeId) => {
    let latest = null;
    for (const session of sessions) {
      if (session?.nodeId !== nodeId) continue;
      if (latest === null
        || textOrEmpty(session.createdAt) >= textOrEmpty(latest.createdAt)) {
        latest = session;
      }
    }
    return latest;
  };

  const upstreamDone = (nodeId) => {
    const incoming = defEdges.filter((edge) => edge?.to === nodeId && edge?.from !== nodeId);
    if (incoming.length === 0) return true;
    return incoming.every((edge) => stateNodeById.get(edge.from)?.state === 'done');
  };

  const cards = dagNodes.map((dagNode) => {
    const live = stateNodeById.get(dagNode.nodeId) ?? null;
    const rawState = typeof live?.state === 'string' && live.state.length > 0 ? live.state : null;
    let tier;
    let unknownStatus = false;
    if (rawState === null || rawState === 'pending') {
      tier = upstreamDone(dagNode.nodeId) ? 'ready' : 'blocked';
    } else if (Object.prototype.hasOwnProperty.call(TIER_BY_STATE, rawState)) {
      tier = TIER_BY_STATE[rawState];
    } else {
      tier = 'blocked';
      unknownStatus = true;
    }
    const card = {
      nodeId: dagNode.nodeId,
      tier,
      rank: CARD_TIERS.indexOf(tier) + 1,
      title: dagNode.title,
      round: roundTextOf(live, dagNode.maxRounds),
      session: null,
    };
    const session = latestSessionOf(dagNode.nodeId);
    if (session) {
      card.session = {
        sessionId: typeof session.sessionId === 'string' ? session.sessionId : null,
        state: typeof session.state === 'string' ? session.state : null,
        hostId: typeof session.hostId === 'string' ? session.hostId : null,
        currentTool: typeof session.currentTool === 'string' ? session.currentTool : null,
      };
    }
    if (unknownStatus) {
      card.unknownStatus = true;
      card.boardColumn = 'blocked';
    }
    return card;
  });

  const ownershipRank = { self: 0, upstream: 1, downstream: 2 };
  cards.sort((a, b) => {
    const aNode = dagNodes.find((node) => node.nodeId === a.nodeId);
    const bNode = dagNodes.find((node) => node.nodeId === b.nodeId);
    const delta = a.rank - b.rank
      || ownershipRank[aNode?.relation ?? 'downstream'] - ownershipRank[bNode?.relation ?? 'downstream'];
    if (delta !== 0) return delta;
    return compareText(a.nodeId, b.nodeId);
  });

  return { breadcrumb, roleBar, dag, cards };
}

/**
 * Node detail: fixed four sections (`GET /instances/:id/nodes/:nodeId`, §3.4).
 *
 * @param {object} input
 * @param {object} input.state instance snapshot
 * @param {object|null} input.workflowDef resolved workflow definition
 * @param {Array} input.events read-only event replay
 * @param {Array} input.handoffs snapshot handoff list
 * @param {string} input.nodeId target orchestration node id
 * @param {string|null} [input.workspace] instance workspace dir (evidence base)
 * @param {string|null} [input.cwd] instance cwd (second evidence base)
 */
export async function buildNodeDetail({
  state,
  workflowDef,
  events,
  handoffs,
  nodeId,
  workspace,
  cwd,
} = {}) {
  const snapshot = objOrEmpty(state);
  const def = workflowDef !== null && typeof workflowDef === 'object' ? workflowDef : null;
  const defNode = asArray(def?.nodes)
    .find((node) => defNodeId(node) === nodeId) ?? null;
  const live = asArray(snapshot.nodes).find((node) => node?.nodeId === nodeId) ?? null;

  const node = {
    nodeId,
    title: defNode?.title ?? (typeof live?.title === 'string' ? live.title : null),
    state: typeof live?.state === 'string' && live.state.length > 0 ? live.state : 'pending',
    round: Number.isInteger(live?.round) ? live.round : null,
    maxRounds: maxRoundsOf(def, defNode, nodeId),
    nodeType: nodeTypeOf(defNode),
  };

  const sessionIds = asArray(snapshot.sessions)
    .filter((session) => session?.nodeId === nodeId)
    .map((session) => session?.sessionId)
    .filter((id) => typeof id === 'string' && id.length > 0);
  const sessionIdSet = new Set(sessionIds);

  const timeline = asArray(events)
    .filter((event) => event?.object === 'session'
      && sessionIdSet.has(event?.objectId)
      && event?.reason === 'state.change')
    .map((event) => ({ ts: event.ts, sessionState: event.to ?? null }))
    .sort((a, b) => compareText(textOrEmpty(a.ts), textOrEmpty(b.ts)));

  let summary = null;
  let summaryEvent = null;
  for (const event of asArray(events)) {
    if (event?.reason !== 'execution.summary' || event?.detail?.nodeId !== nodeId) continue;
    const round = Number.isInteger(event.detail.round) ? event.detail.round : -1;
    const currentRound = summaryEvent
      ? (Number.isInteger(summaryEvent.detail.round) ? summaryEvent.detail.round : -1)
      : -1;
    if (summaryEvent === null
      || round > currentRound
      || (round === currentRound && textOrEmpty(event.ts) >= textOrEmpty(summaryEvent.ts))) {
      summaryEvent = event;
    }
  }
  if (summaryEvent) {
    const draft = objOrEmpty(summaryEvent.detail.summary);
    summary = {
      command: draft.command ?? null,
      exitCode: Number.isInteger(draft.exitCode) ? draft.exitCode : (draft.exitCode ?? null),
      keyOutputLines: draft.keyOutputLines ?? null,
      logRef: draft.logRef ?? null,
    };
  }

  const nodeHandoffs = asArray(handoffs).filter((handoff) => {
    const { from, to } = handoffEndpoints(handoff);
    return from === nodeId || to === nodeId;
  });

  const evidence = [];
  const seenRefs = new Set();
  const pushRef = (value, type) => {
    const ref = normalizeRef(value);
    if (ref === null || seenRefs.has(ref)) return;
    seenRefs.add(ref);
    evidence.push({ ref, type });
  };
  for (const handoff of nodeHandoffs) {
    for (const product of asArray(handoff?.products)) pushRef(product, 'artifact');
    for (const defect of asArray(handoff?.defects)) {
      if (defect !== null && typeof defect === 'object') pushRef(defect.evidence, 'defect');
    }
    for (const artifact of asArray(handoff?.artifactRefs)) pushRef(artifact, 'artifact');
  }
  const evidenceRows = [];
  for (const entry of evidence) {
    evidenceRows.push({
      index: evidenceRows.length + 1,
      ref: entry.ref,
      type: entry.type,
      status: await evidenceResolvable(entry.ref, workspace, cwd),
    });
  }

  const handoffRows = nodeHandoffs
    .map((handoff) => ({
      handoffId: typeof handoff?.handoffId === 'string' ? handoff.handoffId : null,
      direction: handoffDirection(handoff, def),
      round: Number.isInteger(handoff?.round) ? handoff.round : null,
      state: typeof handoff?.state === 'string' ? handoff.state : null,
      lastActivity: handoffLastActivity(handoff),
    }))
    .sort((a, b) => compareText(textOrEmpty(b.lastActivity), textOrEmpty(a.lastActivity)));

  return { node, timeline, summary, evidence: evidenceRows, handoffs: handoffRows };
}

/**
 * Connection panel for one aggregated graph edge (`GET /instances/:id/connections/:edgeId`,
 * §3.5). The edge block (aggregate status included) is read from the
 * caller-provided graph payload — the route has already applied the shared
 * test overlay on it (contract A2); handoff rows come from the same snapshot.
 *
 * @returns {object|null} null when the edge id is unknown to the graph payload
 */
export function buildConnectionPanel({ state, workflowDef, handoffs, edgeId, graph } = {}) {
  const graphEdge = asArray(objOrEmpty(graph).edges)
    .find((edge) => edge?.id === edgeId) ?? null;
  if (graphEdge === null) return null;
  const def = workflowDef !== null && typeof workflowDef === 'object' ? workflowDef : null;

  const roleOfEndpoint = (endpoint) => {
    if (typeof endpoint !== 'string') return null;
    if (endpoint.startsWith('role:')) return endpoint.slice('role:'.length);
    const defNode = asArray(def?.nodes).find((node) => defNodeId(node) === endpoint) ?? null;
    return defRoleOf(defNode) ?? endpoint;
  };

  const handoffIdSet = new Set(asArray(graphEdge.handoffIds));
  const rows = asArray(handoffs)
    .filter((handoff) => typeof handoff?.handoffId === 'string' && handoffIdSet.has(handoff.handoffId))
    .map((handoff) => {
      const timeline = handoffTimeline(handoff);
      return {
        handoffId: handoff.handoffId,
        round: Number.isInteger(handoff?.round) ? handoff.round : null,
        state: typeof handoff?.state === 'string' ? handoff.state : null,
        rejectReason: typeof handoff?.rejectReason === 'string' ? handoff.rejectReason : null,
        lastActivity: timeline.length > 0
          ? timeline[timeline.length - 1].ts
          : handoffLastActivity(handoff),
        timeline,
      };
    })
    .sort((a, b) => compareText(textOrEmpty(b.lastActivity), textOrEmpty(a.lastActivity)));

  return {
    edge: {
      id: graphEdge.id,
      fromRole: roleOfEndpoint(graphEdge.from),
      toRole: roleOfEndpoint(graphEdge.to),
      direction: graphEdge.direction ?? 'forward',
      aggregateStatus: graphEdge.aggregateStatus ?? null,
      parallelCount: graphEdge.parallelCount ?? 0,
    },
    handoffs: rows,
  };
}

/**
 * Pending escalations of ONE instance (`GET /instances/:id/escalations`, §3.6).
 * The list is instance-scoped by construction: the caller passes one
 * snapshot, so no cross-instance filtering exists on this path.
 */
export function buildEscalationList({ state } = {}) {
  const snapshot = objOrEmpty(state);
  const stateNodeById = new Map();
  for (const node of asArray(snapshot.nodes)) {
    if (typeof node?.nodeId === 'string' && !stateNodeById.has(node.nodeId)) {
      stateNodeById.set(node.nodeId, node);
    }
  }
  const items = asArray(snapshot.escalations)
    .filter((entry) => entry?.state === 'pending')
    .map((entry) => ({
      escalationId: typeof entry.escalationId === 'string' ? entry.escalationId : null,
      state: entry.state,
      nodeId: typeof entry.nodeId === 'string' ? entry.nodeId : null,
      roleId: stateNodeById.get(entry.nodeId)?.roleId ?? null,
      round: Number.isInteger(entry.round) ? entry.round : null,
      reasonCode: typeof entry.reasonCode === 'string' ? entry.reasonCode : null,
      reasonDetail: typeof entry.reasonDetail === 'string' ? entry.reasonDetail : '',
      defects: asArray(entry.defects)
        .filter((defect) => defect !== null && typeof defect === 'object')
        .map((defect) => ({
          summary: typeof defect.summary === 'string' ? defect.summary : '',
          evidence: typeof defect.evidence === 'string' ? defect.evidence : '',
        })),
    }));
  return { items };
}

/**
 * One sub-workflow level (`GET /instances/:id/subworkflow/:ref`). The caller
 * resolves the definition for `ref` (project yaml, then built-in template —
 * the same resolution order as the graph snapshot path); this projection only
 * shapes it. A ref already on the caller's navigation stack (`visited`) is a
 * cycle and degrades to an unreadable workflow; a missing definition degrades
 * to `{readable: false}` with empty nodes and edges.
 *
 * @param {object} input
 * @param {object|null} input.workflowDef definition resolved for `ref`
 * @param {string} input.ref the requested workflow reference
 * @param {string[]|Set<string>} [input.visited] refs already on the level stack
 * @param {object|null} [input.state] instance snapshot (status source)
 */
export function buildSubflowGraph({ workflowDef, ref, visited, state } = {}) {
  const seen = visited instanceof Set ? visited : new Set(asArray(visited));
  const degraded = { nodes: [], edges: [], workflow: { ref, readable: false } };
  if (typeof ref !== 'string' || ref.length === 0) return degraded;
  if (seen.has(ref)) return { ...degraded, cycle: true };
  const def = workflowDef !== null && typeof workflowDef === 'object' ? workflowDef : null;
  if (def === null) return degraded;

  const snapshot = objOrEmpty(state);
  const stateNodeById = new Map();
  for (const node of asArray(snapshot.nodes)) {
    if (typeof node?.nodeId === 'string' && !stateNodeById.has(node.nodeId)) {
      stateNodeById.set(node.nodeId, node);
    }
  }

  const nodes = [];
  const defNodeById = new Map();
  for (const defNode of asArray(def.nodes)) {
    const id = defNodeId(defNode);
    if (id === null || defNodeById.has(id)) continue;
    defNodeById.set(id, defNode);
    const live = stateNodeById.get(id) ?? null;
    nodes.push({
      nodeId: id,
      title: typeof defNode.title === 'string' && defNode.title.length > 0 ? defNode.title : null,
      type: nodeTypeOf(defNode),
      roleId: defRoleOf(defNode),
      status: typeof live?.state === 'string' && live.state.length > 0 ? live.state : 'pending',
      round: Number.isInteger(live?.round) ? live.round : null,
      maxRounds: maxRoundsOf(def, defNode, id),
    });
  }

  const edges = [];
  for (const defEdge of asArray(def.edges)) {
    const from = typeof defEdge?.from === 'string' ? defEdge.from : null;
    const to = typeof defEdge?.to === 'string' ? defEdge.to : null;
    if (from === null || to === null) continue;
    edges.push({
      id: typeof defEdge.id === 'string' && defEdge.id.length > 0
        ? defEdge.id
        : `SE-${edges.length + 1}`,
      from,
      to,
      direction: directionOf(defEdge.kind),
    });
  }

  return {
    nodes,
    edges,
    workflow: {
      ref,
      readable: true,
      title: typeof def.title === 'string' && def.title.length > 0 ? def.title : null,
    },
  };
}
