/**
 * Budget and quota pure decisions (I1.12 WP-3, AC-11 / AC-12, D-6).
 *
 * Scope:
 *   - Parallelism ceiling: let at most `limit` nodes enter execution, keep the
 *     rest in the ready queue, and backfill one slot per completed node.
 *   - Budget exhaustion: return a `suspend` decision that the caller applies
 *     through the existing suspend / resume path (state word `suspended`).
 *
 * Discipline: decisions only. This module never persists state, never calls a
 * transition, never emits, and never produces a failure node. All values are
 * codes / numbers / ids, never localized text. Instance state is owned by the
 * orchestrator transition entry point; the caller applies each decision.
 */

// Existing instance state word (suspend/resume path). No new enum is introduced.
const SUSPENDED_STATE = 'suspended';

// Frozen reason codes. Codes only; user-facing wording belongs to the CLI layer.
const REASON_BUDGET_EXHAUSTED = 'budget_exhausted';
const REASON_INVALID_LIMIT = 'invalid_limit';

function isText(value) {
  return typeof value === 'string' && value.length > 0;
}

/** Accept a finite number or a numeric string; everything else is unusable. */
function finiteOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nodeIdOf(value) {
  if (isText(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const key of ['id', 'nodeId', 'key', 'name']) {
    if (isText(value[key])) return value[key];
  }
  return null;
}

/** Normalize a node collection into a de-duplicated list of id strings. */
function idListOf(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const item of value) {
    const id = nodeIdOf(item);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Effective ceiling = the smallest legal value among the instance config,
 * the budget object and the role-level `max_concurrent_sessions` values.
 * An absent or illegal value is never treated as "unlimited".
 *
 * @returns {number|null} a positive integer, or null when no legal value exists
 */
function resolveCeiling({ maxConcurrent, instanceBudget } = {}) {
  const candidates = [];

  const direct = finiteOf(maxConcurrent);
  if (direct !== null) candidates.push(direct);

  if (instanceBudget && typeof instanceBudget === 'object') {
    const fromBudget = finiteOf(
      instanceBudget.maxConcurrent ?? instanceBudget.max_concurrent_sessions
    );
    if (fromBudget !== null) candidates.push(fromBudget);

    const roles = instanceBudget.roles;
    if (Array.isArray(roles)) {
      for (const role of roles) {
        const perRole = finiteOf(role?.max_concurrent_sessions ?? role?.maxConcurrent);
        if (perRole !== null) candidates.push(perRole);
      }
    } else if (roles && typeof roles === 'object') {
      for (const role of Object.values(roles)) {
        const perRole = finiteOf(role?.max_concurrent_sessions ?? role?.maxConcurrent);
        if (perRole !== null) candidates.push(perRole);
      }
    }
  }

  if (candidates.length === 0) return null;
  const smallest = Math.min(...candidates);
  if (!Number.isFinite(smallest) || smallest < 1) return 0;
  return Math.floor(smallest);
}

/**
 * Parallelism decision (D-6 / AC-11).
 *
 * Already-running nodes consume slots. Ready nodes beyond the remaining slots
 * stay queued in their original order; when a running node finishes, calling
 * this again with the updated running set backfills exactly one slot.
 * Illegal / missing limits are conservative: no new dispatch at all.
 *
 * @param {{readyNodes: Array, runningNodes: Array, maxConcurrent: number,
 *          instanceBudget: object|number}} input
 * @returns {{allowed: string[], queued: string[], limit: number,
 *            reason: null|string}}
 */
export function decideParallelism({
  readyNodes,
  runningNodes,
  maxConcurrent,
  instanceBudget
} = {}) {
  const ready = idListOf(readyNodes);
  const running = idListOf(runningNodes);
  const ceiling = resolveCeiling({ maxConcurrent, instanceBudget });

  if (ceiling === null || ceiling < 1) {
    return { allowed: [], queued: ready, limit: 0, reason: REASON_INVALID_LIMIT };
  }

  const freeSlots = Math.max(0, ceiling - running.length);
  const allowed = ready.slice(0, freeSlots);
  const queued = ready.slice(freeSlots);
  return { allowed, queued, limit: ceiling, reason: null };
}

/**
 * Budget decision (D-6 / AC-12).
 *
 * `suspend: true` tells the caller to put the instance into the existing
 * `suspended` state with `budget_exhausted` as the reason; no failure node and
 * no failed event is created. When a suspended instance is given enough budget
 * again, `resumeRound` carries the original round so the caller resumes there.
 * Missing / illegal budget fields are conservative: suspend instead of dispatch.
 *
 * @param {{remainingBudget: number, nextCost: number, state: object}} input
 * @returns {{suspend: boolean, reason: 'budget_exhausted'|null,
 *            resumeRound: number|null}}
 */
export function decideBudget({ remainingBudget, nextCost, state } = {}) {
  const remaining = finiteOf(remainingBudget);
  const cost = finiteOf(nextCost);
  const round = finiteOf(state?.round ?? state?.currentRound ?? state?.resumeRound);
  const alreadySuspended =
    state?.state === SUSPENDED_STATE || state?.suspended === true;

  const insufficient =
    remaining === null || cost === null || cost <= 0 || remaining < cost;

  if (insufficient) {
    return {
      suspend: true,
      reason: REASON_BUDGET_EXHAUSTED,
      resumeRound: round
    };
  }

  return {
    suspend: false,
    reason: null,
    resumeRound: alreadySuspended ? round : null
  };
}
