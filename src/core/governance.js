/**
 * Governance-side pure decision module (I1.12 WP-2).
 *
 * Scope:
 *   - Wake whitelist gate (D-3 / AC-03 / AC-04).
 *   - High-risk human review gate (D-5 / AC-07 / AC-08).
 *   - Primary-audit event granularity (AC-09 / AC-10).
 *
 * Discipline: pure decisions only. No persistence, no state transition, no UI
 * fields, no display text, no ambient clock reads. Timestamps come from the
 * injected `now` argument. The single reason-code literal is
 * 'wake.not-whitelisted' (decision A-4); no other rejection code is produced
 * or referenced here, so the existing rejection path stays untouched.
 *
 * Every allowed value is a code or a key name, never a localized string; all
 * user-visible text is owned by the CLI label layer.
 */

// Frozen reason literal (freeze point 2 / decision A-4). This is a CODE, not text.
const WAKE_NOT_WHITELISTED = 'wake.not-whitelisted';

// High-risk recognition (D-5): declared marker UNION side effect === 'high'
// (U-05, union option). Codes only; no localized category names live here.
const HIGH_RISK_FLAGS = ['highRisk', 'high_risk', 'requiresHumanReview', 'needsHumanReview'];
const HIGH_RISK_LEVELS = new Set(['high', 'release', 'data-change', 'data_change', 'compliance', 'compliance-opinion']);
const HIGH_SIDE_EFFECT = 'high';
const HUMAN_GATE_TYPES = new Set(['human', 'approval', 'gate', 'escalate']);

// Primary-audit whitelist (D-5 / AC-09 / AC-10).
const PRIMARY_AUDIT_EXACT = new Set([
  'node.state.change',
  'health.changed',
  'core.suspend',
  'run.halted'
]);
const PRIMARY_AUDIT_PREFIXES = ['handoff.'];

function isText(value) {
  return typeof value === 'string' && value.length > 0;
}

function firstText(source, keys) {
  if (!source || typeof source !== 'object') return null;
  for (const key of keys) {
    if (isText(source[key])) return source[key];
  }
  return null;
}

/** Normalize an injected clock into an ISO string; never reads an ambient clock. */
function isoAt(now) {
  if (typeof now === 'function') {
    let value;
    try {
      value = now();
    } catch {
      return null;
    }
    return isoAt(value);
  }
  if (typeof now === 'number' && Number.isFinite(now)) {
    const date = new Date(now);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (isText(now)) {
    const date = new Date(now);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function roleIdOf(value) {
  if (isText(value)) return value;
  if (value && typeof value === 'object') {
    return firstText(value, ['id', 'roleId', 'role_id', 'name']);
  }
  return null;
}

/** Build an id -> role-config lookup from either an array or a keyed object. */
function indexRoles(roles) {
  const map = new Map();
  if (Array.isArray(roles)) {
    for (const role of roles) {
      const id = roleIdOf(role);
      if (id && !map.has(id)) map.set(id, role);
    }
    return map;
  }
  if (roles && typeof roles === 'object') {
    for (const [key, value] of Object.entries(roles)) {
      if (Array.isArray(value)) {
        if (!map.has(key)) map.set(key, { id: key, wake_allow: value });
      } else if (value && typeof value === 'object') {
        const id = roleIdOf(value) || key;
        if (!map.has(id)) map.set(id, value);
      }
    }
  }
  return map;
}

/**
 * Wake whitelist decision at the core routing point (D-3 / AC-03 / AC-04).
 * A whitelist that is undeclared / unreadable, or a target role that does not
 * exist in a supplied registry, is denied strictly rather than silently passed.
 *
 * @param {{sourceRole: object|string, targetRole: object|string,
 *          roles: Array|object, now: Function|number|string}} input
 * @returns {{allowed: boolean, reason: string|null,
 *            detail: {from: string|null, to: string|null,
 *                     reason: string|null, at: string|null}}}
 */
export function decideWake({ sourceRole, targetRole, roles, now } = {}) {
  const roleIndex = indexRoles(roles);
  const from = roleIdOf(sourceRole);
  const to = roleIdOf(targetRole);
  const at = isoAt(now);
  const registryProvided = Array.isArray(roles) || (!!roles && typeof roles === 'object');

  let sourceConfig = null;
  if (sourceRole && typeof sourceRole === 'object' && Array.isArray(sourceRole.wake_allow)) {
    sourceConfig = sourceRole;
  } else if (from && roleIndex.size > 0) {
    const found = roleIndex.get(from);
    if (found && typeof found === 'object') sourceConfig = found;
  }

  const deny = () => ({
    allowed: false,
    reason: WAKE_NOT_WHITELISTED,
    detail: { from, to, reason: WAKE_NOT_WHITELISTED, at }
  });

  // Unreadable configuration / unknown source or target -> strict deny.
  if (!from || !to || !sourceConfig) return deny();
  const allow = sourceConfig.wake_allow;
  if (!Array.isArray(allow)) return deny();
  if (registryProvided && !roleIndex.has(to)) return deny();
  if (!allow.some((entry) => roleIdOf(entry) === to)) return deny();

  return {
    allowed: true,
    reason: null,
    detail: { from, to, reason: null, at }
  };
}

function nodeIdOf(node) {
  return firstText(node, ['id', 'nodeId', 'key']);
}

function nodeTypeOf(node) {
  return (firstText(node, ['type', 'kind', 'nodeType']) || '').toLowerCase();
}

function isHighRiskNode(node, roleIndex) {
  if (!node || typeof node !== 'object') return false;
  for (const flag of HIGH_RISK_FLAGS) {
    if (node[flag] === true) return true;
  }
  const level = (firstText(node, ['risk', 'riskLevel', 'risk_level']) || '').toLowerCase();
  if (HIGH_RISK_LEVELS.has(level)) return true;
  const side = (firstText(node, ['side_effect', 'sideEffect']) || '').toLowerCase();
  if (side === HIGH_SIDE_EFFECT) return true;

  const roleId = firstText(node, ['role', 'roleId', 'role_id']);
  if (roleId && roleIndex.size > 0) {
    const role = roleIndex.get(roleId);
    if (role && typeof role === 'object') {
      for (const flag of HIGH_RISK_FLAGS) {
        if (role[flag] === true) return true;
      }
      const roleLevel = (firstText(role, ['risk', 'riskLevel', 'risk_level']) || '').toLowerCase();
      if (HIGH_RISK_LEVELS.has(roleLevel)) return true;
      const roleSide = (firstText(role, ['side_effect', 'sideEffect']) || '').toLowerCase();
      if (roleSide === HIGH_SIDE_EFFECT) return true;
    }
  }
  return false;
}

function collectNodes(workflow, graph) {
  const nodes = new Map();
  for (const source of [workflow, graph]) {
    if (!source || typeof source !== 'object') continue;
    const list = source.nodes || source.tasks || source.steps;
    if (!Array.isArray(list)) continue;
    for (const node of list) {
      const id = nodeIdOf(node);
      if (id && !nodes.has(id)) nodes.set(id, node);
    }
  }
  return nodes;
}

function buildAdjacency(graph, workflow) {
  const adjacency = new Map();
  const addEdge = (from, to, meta) => {
    if (!from || !to) return;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ to, meta });
  };
  for (const source of [graph, workflow]) {
    if (!source || typeof source !== 'object') continue;
    const edges = source.edges || source.links || source.transitions;
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        if (!edge || typeof edge !== 'object') continue;
        addEdge(
          firstText(edge, ['from', 'source', 'src', 'fromId']),
          firstText(edge, ['to', 'target', 'dst', 'toId']),
          edge
        );
      }
    }
    const adjacent = source.adjacency;
    if (adjacent && typeof adjacent === 'object' && !Array.isArray(adjacent)) {
      for (const [from, targets] of Object.entries(adjacent)) {
        for (const target of Array.isArray(targets) ? targets : [targets]) {
          addEdge(from, roleIdOf(target), target);
        }
      }
    }
  }
  return adjacency;
}

function hasHumanGate(startId, adjacency, nodeIndex) {
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const { to, meta } of adjacency.get(current) || []) {
      if (meta) {
        const isEscalate =
          meta.escalate === true ||
          meta.escalation === true ||
          (firstText(meta, ['kind', 'type']) || '').toLowerCase() === 'escalate';
        if (isEscalate) return true;
      }
      const target = nodeIndex.get(to);
      if (target) {
        if (HUMAN_GATE_TYPES.has(nodeTypeOf(target))) return true;
        if (target.human === true || target.isHuman === true) return true;
      }
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return false;
}

/**
 * High-risk human review gate (D-5 / AC-07).
 * A high-risk node (declared marker UNION side effect 'high') must have a
 * downstream human node or an escalate path, otherwise validation fails and
 * the offending node ids are returned for location.
 *
 * @param {{workflow: object, roles: Array|object, graph: object}} input
 * @returns {{ok: boolean, needsHumanReview: boolean, blocked: boolean,
 *            reason: string|null, nodeIds: string[]}}
 */
export function validateHighRiskReview({ workflow, roles, graph } = {}) {
  const roleIndex = indexRoles(roles);
  const nodeIndex = collectNodes(workflow, graph);
  const adjacency = buildAdjacency(graph, workflow);

  const highRiskIds = [];
  for (const [id, node] of nodeIndex) {
    if (isHighRiskNode(node, roleIndex)) highRiskIds.push(id);
  }
  if (highRiskIds.length === 0) {
    return { ok: true, needsHumanReview: false, blocked: false, reason: null, nodeIds: [] };
  }

  // Insufficient data to judge any downstream gate -> block with node location.
  const dataSufficient = adjacency.size > 0 || nodeIndex.size > highRiskIds.length;
  if (!dataSufficient) {
    return {
      ok: false,
      needsHumanReview: true,
      blocked: true,
      reason: 'insufficient_data',
      nodeIds: highRiskIds
    };
  }

  const missing = highRiskIds.filter((id) => !hasHumanGate(id, adjacency, nodeIndex));
  if (missing.length > 0) {
    return {
      ok: false,
      needsHumanReview: true,
      blocked: true,
      reason: 'missing_human_gate',
      nodeIds: missing
    };
  }

  return { ok: true, needsHumanReview: true, blocked: false, reason: null, nodeIds: highRiskIds };
}

/**
 * Per-node review decision copy (D-5 / AC-08).
 * Returns a frozen data-only snapshot that downstream consumers can record as
 * traceable evidence; it contains no view fields.
 *
 * @param {{instanceId: string, nodeId: string, needsHumanReview: boolean,
 *          blocked: boolean, reason: string|null}} input
 * @returns {{instanceId: string|null, nodeId: string|null,
 *            needsHumanReview: boolean, blocked: boolean, reason: string|null}}
 */
export function reviewDecision({ instanceId, nodeId, needsHumanReview, blocked, reason } = {}) {
  return Object.freeze({
    instanceId: isText(instanceId) ? instanceId : null,
    nodeId: isText(nodeId) ? nodeId : null,
    needsHumanReview: needsHumanReview === true,
    blocked: blocked === true,
    reason: isText(reason) ? reason : null
  });
}

function eventTypeOf(event) {
  if (isText(event)) return event;
  if (!event || typeof event !== 'object') return '';
  const direct = firstText(event, ['type', 'eventType', 'event']);
  if (direct) return direct;
  const object = firstText(event, ['object', 'objectType', 'subject']);
  const action = firstText(event, ['reason', 'action']);
  if (action) {
    // An action that already names a fully-qualified primary type wins as-is
    // (e.g. health + 'health.changed', instance + 'core.suspend').
    if (
      action.includes('.') &&
      (PRIMARY_AUDIT_EXACT.has(action) || PRIMARY_AUDIT_PREFIXES.some((prefix) => action.startsWith(prefix)))
    ) {
      return action;
    }
    if (object && action.toLowerCase().startsWith(`${object.toLowerCase()}.`)) return action;
    if (object) return `${object}.${action}`;
    return action;
  }
  return object || '';
}

/**
 * Primary-audit granularity decision (AC-09 / AC-10).
 * Node state changes, handoff state changes, health changes, suspend and halt
 * go to the main audit. Derived connection / role / session events do not.
 *
 * @param {object|string} event
 * @returns {boolean}
 */
export function isPrimaryAuditEvent(event) {
  const type = eventTypeOf(event);
  if (!type) return false;
  if (PRIMARY_AUDIT_EXACT.has(type)) return true;
  return PRIMARY_AUDIT_PREFIXES.some((prefix) => type.startsWith(prefix));
}
