/**
 * I1.12 WP-6 / AC-20 / AC-21 performance baseline primitives (freeze point 6, D-11).
 *
 * Two pure exports:
 *   collectHandoffLatency({events, spans, round}) -> {samples, stats}
 *   buildPerfReport({samples, evidenceLevel, target}) -> report
 *
 * Contract guarantees (ruling A item 3 / requirement line 483 / D-11):
 *   - Evidence level is one of three frozen ASCII machine keys and is NEVER
 *     substituted. A mock sample set can only ever produce the MOCK key; it
 *     cannot make the real-host judgement true. Only the PENDING key blocks.
 *   - No state-file writes, no host interaction, no user-host config access,
 *     no display text. Levels are ASCII machine keys; all user-facing Chinese
 *     is owned by labels.js via PERF_LEVEL_LABEL_KEYS (WP-7 registers keys).
 */
export const PERF_LEVELS = Object.freeze({
  mock: 'PERF_LEVEL_MOCK',
  real: 'PERF_LEVEL_REAL',
  pending: 'PERF_LEVEL_PENDING'
});

/**
 * labels.js key names WP-7 must register for the three user-facing evidence
 * levels (ruling C item 3: capability packages emit keys only; WP-7 owns the
 * verbatim Chinese values in labels.js and fails closed on a missing key).
 * Each name is the same ASCII machine key carried in the report's `level`.
 */
export const PERF_LEVEL_LABEL_KEYS = Object.freeze({
  mock: PERF_LEVELS.mock,
  real: PERF_LEVELS.real,
  pending: PERF_LEVELS.pending
});

/** Machine-readable bottleneck identifiers (never user-facing prose). */
export const PERF_BOTTLENECKS = Object.freeze({
  concurrentInstancesBelowTarget: 'CONCURRENT_INSTANCES_BELOW_TARGET',
  activeSessionsBelowTarget: 'ACTIVE_SESSIONS_BELOW_TARGET',
  handoffLatencyOverBudget: 'HANDOFF_LATENCY_OVER_BUDGET'
});

/** D-11 load and budget defaults. Overridable via the `target` argument. */
export const PERF_TARGETS = Object.freeze({
  concurrentInstances: 20,
  activeSessions: 50,
  handoffBudgetMs: 2000
});

const FIRST_EVENT_REASONS = new Set([
  'session.started',
  'session.first_event',
  'session.first_update',
  'session/prompt',
  'turn.started',
  'handoff.accepted',
  'node.state.change',
  'execution.started'
]);

function firstText(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

function field(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key] ?? obj?.detail?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const row of rows) {
    if (row && typeof row === 'object') {
      out.push(row);
      continue;
    }
    if (typeof row === 'string') {
      try {
        const parsed = JSON.parse(row);
        if (parsed && typeof parsed === 'object') out.push(parsed);
      } catch {
        // Bad jsonl line: skipped by contract (D-11 tolerance), never fatal.
      }
    }
  }
  return out;
}

function timeMs(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return timeMs(numeric);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function matchesRound(recordRound, round) {
  if (round === undefined || round === null) return true;
  if (recordRound === undefined || recordRound === null) return true;
  return String(recordRound) === String(round);
}

function isDelivered(event) {
  const reason = firstText(event, ['reason', 'action', 'eventType', 'type']);
  return reason === 'handoff.delivered'
    || (firstText(event, ['object', 'objectType', 'subject']).toLowerCase() === 'handoff' && event.to === 'delivered');
}

function isFirstEvent(event) {
  if (event?.detail?.firstEvent === true || event?.firstEvent === true) return true;
  return FIRST_EVENT_REASONS.has(firstText(event, ['reason', 'action', 'eventType', 'type']));
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Median / P95 / max over finite non-negative latency values (ms). */
export function statsOf(values) {
  const nums = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Math.round(value))
    .sort((a, b) => a - b);
  if (nums.length === 0) return { median: null, p95: null, max: null };
  return {
    median: Math.round(percentile(nums, 0.5)),
    p95: Math.round(percentile(nums, 0.95)),
    max: nums[nums.length - 1]
  };
}

function firstArrivalMs(delivered, eventRows, spanRows) {
  const start = delivered.start;
  if (start === null || start === undefined) return null;
  let best = null;
  for (const event of eventRows) {
    if (isDelivered(event) || !isFirstEvent(event)) continue;
    const instanceId = field(event, ['instanceId', 'instance']);
    const sessionId = field(event, ['sessionId', 'targetSessionId']);
    if (delivered.instanceId && instanceId && String(instanceId) !== String(delivered.instanceId)) continue;
    if (delivered.sessionId && sessionId && String(sessionId) !== String(delivered.sessionId)) continue;
    const at = timeMs(field(event, ['ts', 'at', 'timestamp']));
    if (at === null || at < start) continue;
    if (best === null || at < best) best = at;
  }
  if (best !== null) return best;
  for (const span of spanRows) {
    if (!matchesRound(field(span, ['round']), delivered.round)) continue;
    const instanceId = field(span, ['instance_id', 'instanceId']);
    if (delivered.instanceId && instanceId && String(instanceId) !== String(delivered.instanceId)) continue;
    const at = timeMs(field(span, ['start_time', 'startTime']));
    if (at === null || at < start) continue;
    if (best === null || at < best) best = at;
  }
  return best;
}

/**
 * Collect one handoff-latency sample per delivered handoff that has a matching
 * target-session first ACP event (or a starting span). A handoff without an
 * arrival observation yields no sample — it is never reported as zero latency.
 */
export function collectHandoffLatency({ events = [], spans = [], round } = {}) {
  const eventRows = normalizeRows(events);
  const spanRows = normalizeRows(spans);
  const samples = [];
  for (const event of eventRows) {
    if (!isDelivered(event)) continue;
    const handoffRound = field(event, ['round']);
    if (!matchesRound(handoffRound, round)) continue;
    const start = timeMs(field(event, ['ts', 'deliveredAt', 'at', 'timestamp']));
    if (start === null) continue;
    const handoff = {
      start,
      round: handoffRound,
      instanceId: field(event, ['instanceId', 'instance']),
      sessionId: field(event, ['sessionId', 'targetSessionId']),
      handoffId: field(event, ['handoffId', 'objectId', 'id'])
    };
    const arrival = firstArrivalMs(handoff, eventRows, spanRows);
    if (arrival === null) continue;
    samples.push({
      instanceId: handoff.instanceId ?? null,
      sessionId: handoff.sessionId ?? null,
      handoffId: handoff.handoffId ?? null,
      latencyMs: Math.max(0, Math.round(arrival - start))
    });
  }
  return { samples, stats: statsOf(samples.map((sample) => sample.latencyMs)) };
}

function validLevel(level) {
  return level === PERF_LEVELS.mock || level === PERF_LEVELS.real || level === PERF_LEVELS.pending;
}

/**
 * Build the graded report. The evidence level is taken verbatim from the
 * caller (an unknown value fails closed to PENDING -> blocked). Only the
 * real-host surface that is genuinely uncollected blocks; mock and real
 * measured reports never block and are never conflated.
 */
export function buildPerfReport({ samples = [], evidenceLevel, target = PERF_TARGETS } = {}) {
  const goals = { ...PERF_TARGETS, ...(target && typeof target === 'object' ? target : {}) };
  const stats = statsOf(samples.map((sample) => Number(sample?.latencyMs)));
  const instances = new Set(samples.map((sample) => sample?.instanceId).filter(Boolean)).size;
  const sessions = new Set(samples.map((sample) => sample?.sessionId).filter(Boolean)).size;
  const level = validLevel(evidenceLevel) ? evidenceLevel : PERF_LEVELS.pending;
  const blocked = level === PERF_LEVELS.pending;

  let bottleneck = null;
  if (!blocked) {
    if (instances < goals.concurrentInstances) {
      bottleneck = PERF_BOTTLENECKS.concurrentInstancesBelowTarget;
    } else if (sessions < goals.activeSessions) {
      bottleneck = PERF_BOTTLENECKS.activeSessionsBelowTarget;
    } else if (stats.p95 !== null && stats.p95 >= goals.handoffBudgetMs) {
      bottleneck = PERF_BOTTLENECKS.handoffLatencyOverBudget;
    }
  }
  const ok = !blocked && bottleneck === null && stats.p95 !== null;
  return { ok, level, stats, bottleneck, blocked };
}
