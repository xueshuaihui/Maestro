/**
 * Health computation for an instance (I1.9 / WP-3).
 *
 * Pure function: reads only the arguments passed in, uses only the injected
 * `now` timestamp, never reads or writes the filesystem, never triggers a
 * state transition / escalation / dispatch, and never mutates any argument.
 * `graph` is part of the frozen signature but is reserved for a future
 * per-node timeout; this iteration does not read it.
 *
 * No user-facing wording lives here: `reasons` are machine codes only and are
 * rendered elsewhere. All comments are English by contract.
 */

// ---- Four level values (names and values are identical on purpose). ----
export const normal = 'normal';
export const slow = 'slow';
export const attention = 'attention';
export const ended = 'ended';

// ---- Eight reason codes (fixed output order). ----
export const pending_escalation = 'pending_escalation';
export const node_timeout = 'node_timeout';
export const session_crash = 'session_crash';
export const role_unavailable = 'role_unavailable';
export const connection_rejected = 'connection_rejected';
export const connection_expired = 'connection_expired';
export const p90_exceeded = 'p90_exceeded';
export const handoff_ttl_half = 'handoff_ttl_half';

/** Frozen contract tables. `HEALTH_REASONS` is the fixed output order. */
export const HEALTH_LEVELS = Object.freeze([normal, slow, attention, ended]);
export const HEALTH_REASONS = Object.freeze([
  pending_escalation,
  node_timeout,
  session_crash,
  role_unavailable,
  connection_rejected,
  connection_expired,
  p90_exceeded,
  handoff_ttl_half,
]);
export const HEALTH_CONTRACT = Object.freeze({
  levels: HEALTH_LEVELS,
  reasons: HEALTH_REASONS,
});

// ---- Internal constants (not exported). ----
const DEFAULT_NODE_TIMEOUT_MS = 30000;
const MIN_P90_SAMPLES = 5;
const TTL_HALF_MS = 900000;
const TERMINAL_INSTANCE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const CRASH_BOUND_NODE = new Set(['failed', 'escalated']);

/** Convert an ISO string or an epoch-millisecond number to millis, else null. */
function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

/** Effective per-instance node timeout; missing / invalid values fall back. */
function nodeTimeoutMsOf(state) {
  const raw = state?.health?.nodeTimeoutMs;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? raw
    : DEFAULT_NODE_TIMEOUT_MS;
}

/** Duration of one finished span; invalid or missing times are not samples. */
function spanDuration(span) {
  if (!span || span.status === 'running') return null;
  const start = toMillis(span.start_time);
  const end = toMillis(span.end_time);
  if (start === null || end === null || end < start) return null;
  return end - start;
}

/** Nearest-rank P90 of finished spans, or null when samples are too few. */
function p90Of(traces) {
  const durations = [];
  for (const span of arrayOrEmpty(traces)) {
    const duration = spanDuration(span);
    if (duration !== null) durations.push(duration);
  }
  if (durations.length < MIN_P90_SAMPLES) return null;
  durations.sort((a, b) => a - b);
  const rank = Math.ceil(0.9 * durations.length);
  return durations[rank - 1];
}

/** Map of nodeId -> node for resolving the node bound to a session. */
function nodeIndex(nodes) {
  const byId = new Map();
  for (const node of nodes) {
    if (node && node.nodeId != null && !byId.has(node.nodeId)) byId.set(node.nodeId, node);
  }
  return byId;
}

/**
 * @param {{state?:object, graph?:object|null, traces?:Array, now?:number}} args
 * @returns {{level:string, reasons:string[]}}
 */
export function computeHealth({ state, graph = null, traces = [], now = Date.now() } = {}) {
  void graph; // reserved by the frozen signature; not read this iteration.

  // Terminal instance first: no red / yellow condition may override it.
  if (TERMINAL_INSTANCE.has(state?.state)) {
    return { level: ended, reasons: [] };
  }

  const nodes = arrayOrEmpty(state?.nodes);
  const sessions = arrayOrEmpty(state?.sessions);
  const handoffs = arrayOrEmpty(state?.handoffs);
  const escalations = arrayOrEmpty(state?.escalations);
  const byId = nodeIndex(nodes);
  const nodeTimeoutMs = nodeTimeoutMsOf(state);

  // ---- Red (attention) conditions, evaluated in fixed order. ----
  const red = [];

  if (escalations.some((e) => e?.state === 'pending')) {
    red.push(pending_escalation);
  }

  if (nodes.some((n) => {
    if (n?.state !== 'running') return false;
    const start = toMillis(n.startedAt);
    return start !== null && now - start > nodeTimeoutMs; // strictly greater
  })) {
    red.push(node_timeout);
  }

  // A quarantined session approximates a crash (B-4): sessions carry no
  // dedicated crash state. When the bound node is resolvable it must not have
  // succeeded; when it is absent the flag is the only signal, so keep it
  // rather than silently dropping a crash (missing fields degrade, never throw).
  if (sessions.some((s) => {
    if (!s || s.quarantined !== true) return false;
    const node = s.nodeId == null ? undefined : byId.get(s.nodeId);
    if (node === undefined) return true;
    return CRASH_BOUND_NODE.has(node.state);
  })) {
    red.push(session_crash);
  }

  // Role availability is projected from state nodes and sessions directly;
  // no registry lookup is involved, so an unknown role id is never reported
  // here. Quarantined sessions belong to the crash condition only (B-4).
  if (sessions.some((s) => s?.state === 'escalated' && s.quarantined !== true)) {
    red.push(role_unavailable);
  }

  if (handoffs.some((h) => h?.state === 'rejected')) {
    red.push(connection_rejected);
  }
  if (handoffs.some((h) => h?.state === 'expired')) {
    red.push(connection_expired);
  }

  // One level only: red wins. Slow conditions are evaluated only when no red
  // condition matched (priority: terminal > red > yellow > green).
  if (red.length > 0) {
    return { level: attention, reasons: red };
  }

  // ---- Yellow (slow) conditions, evaluated in fixed order. ----
  const yellow = [];
  const p90 = p90Of(traces);
  if (p90 !== null && nodes.some((n) => {
    if (n?.state !== 'running') return false;
    const start = toMillis(n.startedAt);
    return start !== null && now - start > p90; // strictly greater
  })) {
    yellow.push(p90_exceeded);
  }

  // TTL half: pending handoff, start time preferring pendingAt then createdAt,
  // skipping packets that carry no start time (B-3 / BR-20). Strictly greater.
  if (handoffs.some((h) => {
    if (h?.state !== 'pending') return false;
    const pending = toMillis(h.pendingAt);
    const created = toMillis(h.createdAt);
    const base = pending !== null ? pending : created;
    return base !== null && now - base > TTL_HALF_MS;
  })) {
    yellow.push(handoff_ttl_half);
  }

  if (yellow.length > 0) {
    return { level: slow, reasons: yellow };
  }

  return { level: normal, reasons: [] };
}
