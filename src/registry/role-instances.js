/**
 * Derived role-instance view (split doc 2.6 / requirement D-5).
 *
 * A pure projection over an in-memory snapshot: no file reads, no clock, no CLI
 * import. The same input always produces the same output (NFR-04 / AC-31), so the
 * view can be rebuilt on every read and never written back (AC-30).
 *
 * The six-status precedence is `retired > unknown-role > inactive > unavailable >
 * busy > cooldown > available`, first hit wins. `unknown-role` must sit before
 * `inactive`: a role declared by the graph whose asset was deleted and that has no
 * bound node would otherwise look merely unused.
 */

import { GROUPS } from './role-schema.js';
import { TERMINAL_INSTANCE } from '../core/state-machine.js';

/** Same four states the CLI treats as finished (`suspended` is not terminal). */
const TERMINAL = new Set(TERMINAL_INSTANCE);

const SERVING_NODE_STATES = new Set(['running', 'review']);
const DONE_NODE_STATE = 'done';

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrEmpty(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Six-status decision. Kept separate from the projection so the S3 harness and the
 * unit tests can drive every branch without building a snapshot.
 *
 * @param {{terminal:boolean, known:boolean, boundCount:number,
 *          sessions?:Array, servingCount:number, doneCount:number}} input
 * @returns {{status:string, statusReason:string|null}}
 */
export function decideStatus({
  terminal,
  known,
  boundCount,
  sessions,
  servingCount,
  doneCount
}) {
  if (terminal) return { status: 'retired', statusReason: null };
  if (!known) return { status: 'unavailable', statusReason: 'unknown-role' };
  if (boundCount === 0) return { status: 'inactive', statusReason: null };

  const list = asArray(sessions);
  const escalated = list.some((session) => session.state === 'escalated');
  const quarantined = list.some((session) => session.quarantined === true);
  if (escalated || quarantined) {
    return { status: 'unavailable', statusReason: escalated ? 'escalated' : 'quarantined' };
  }

  if (servingCount > 0) return { status: 'busy', statusReason: null };
  if (doneCount > 0) return { status: 'cooldown', statusReason: null };
  return { status: 'available', statusReason: null };
}

/** Host ids of the serving nodes, de-duplicated and order preserving; `null` skipped. */
function hostIconsOf(serving, sessions) {
  const icons = [];
  for (const node of serving) {
    for (const session of sessions) {
      if (session.nodeId !== node.nodeId) continue;
      const host = session.hostId;
      if (typeof host !== 'string' || host.length === 0) continue;
      if (!icons.includes(host)) icons.push(host);
    }
  }
  return icons;
}

/** Latest bound node by `stateSince`; ties break on the smaller `nodeId`. */
function lastActionOf(bound, maxRounds) {
  let latest = null;
  for (const node of bound) {
    if (latest === null) {
      latest = node;
      continue;
    }
    const current = textOrEmpty(node.stateSince);
    const kept = textOrEmpty(latest.stateSince);
    if (current > kept) latest = node;
    else if (current === kept && compareText(textOrEmpty(node.nodeId), textOrEmpty(latest.nodeId)) < 0) {
      latest = node;
    }
  }
  if (latest === null) return null;
  return {
    nodeId: latest.nodeId,
    round: latest.round ?? null,
    maxRounds: maxRounds?.[latest.nodeId] ?? null,
    state: latest.state ?? null,
    stateSince: latest.stateSince ?? null
  };
}

function groupRank(registry, roleId) {
  const role = registry.get(roleId);
  if (!role) return GROUPS.length;
  const index = GROUPS.indexOf(role.group);
  // An out-of-contract group would give -1 and sort first; keep it last instead.
  return index < 0 ? GROUPS.length : index;
}

/**
 * @param {{state?:object, graph?:object, roles?:Map|object}} input
 * @returns {{roles:Array<object>, roleToSessions:Object<string,string[]>}}
 */
export function buildRoleInstances({ state, graph, roles } = {}) {
  const nodes = asArray(state?.nodes);
  const sessions = asArray(state?.sessions);
  const declared = asArray(graph?.roles);
  const registry = roles instanceof Map ? roles : new Map(Object.entries(roles ?? {}));
  const terminal = TERMINAL.has(state?.state);
  const maxRounds = graph?.maxRounds ?? null;

  // C-04: the graph's declared roles plus every role a node actually binds.
  const roleIds = [];
  const seen = new Set();
  for (const roleId of [...declared, ...nodes.map((node) => node.roleId)]) {
    if (typeof roleId !== 'string' || roleId.length === 0 || seen.has(roleId)) continue;
    seen.add(roleId);
    roleIds.push(roleId);
  }

  // Stable order: group order, then id; unknown roles go last, by id.
  roleIds.sort((a, b) => {
    const delta = groupRank(registry, a) - groupRank(registry, b);
    if (delta !== 0) return delta;
    const left = registry.get(a)?.id ?? a;
    const right = registry.get(b)?.id ?? b;
    return compareText(left, right);
  });

  const views = [];
  const roleToSessions = {};

  for (const roleId of roleIds) {
    const role = registry.get(roleId);
    const known = role !== undefined;
    const bound = nodes.filter((node) => node.roleId === roleId);
    const serving = bound.filter((node) => SERVING_NODE_STATES.has(node.state));
    const boundNodeIds = new Set(bound.map((node) => node.nodeId));

    const sess = sessions
      .filter((session) => boundNodeIds.has(session.nodeId))
      .slice()
      .sort((a, b) => {
        const delta = compareText(textOrEmpty(a.createdAt), textOrEmpty(b.createdAt));
        return delta !== 0 ? delta : compareText(textOrEmpty(a.sessionId), textOrEmpty(b.sessionId));
      });

    const active = sess.filter(
      (session) => session.state !== 'idle' || session.quarantined === true
    );

    // Only non-empty lists get a key (AC-20 asserts the absent key).
    if (sess.length > 0) roleToSessions[roleId] = sess.map((session) => session.sessionId);

    const { status, statusReason } = decideStatus({
      terminal,
      known,
      boundCount: bound.length,
      sessions: sess,
      servingCount: serving.length,
      doneCount: bound.filter((node) => node.state === DONE_NODE_STATE).length
    });

    views.push({
      roleId,
      roleInstanceId: `RI-${roleId}`,
      status,
      statusReason,
      activeSessions: active.map((session) => session.sessionId),
      servingNodes: serving.map((node) => node.nodeId),
      hostIcons: hostIconsOf(serving, sess),
      // An unregistered role has no cap in the registry; `null`, never a made-up 1.
      maxConcurrentSessions: known ? role.maxConcurrentSessions : null,
      lastAction: lastActionOf(bound, maxRounds)
    });
  }

  return { roles: views, roleToSessions };
}
