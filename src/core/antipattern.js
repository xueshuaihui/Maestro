/**
 * I1.12 WP-5 read-only anti-pattern signals (AC-19 / D-10 / freeze point 5).
 *
 * Three signal kinds are produced: a document node stalled in review, an
 * independent node pair executed strictly one after the other, and a review
 * node that repeatedly agrees with its upstream without separate evidence.
 *
 * Pure and read-only: the inputs are never modified and no state transition,
 * event write or upgrade notice is created. Every human sentence is a key that
 * src/cli/labels.js (WP-7) maps to the A-7 wording; no Chinese literal lives
 * here. Thresholds are implementation parameters supplied through `config`.
 */

/** Frozen signal `type` values. */
export const SIGNAL_TYPES = Object.freeze({
  docBottleneck: 'doc_bottleneck',
  serializationRegression: 'serialization_regression',
  confirmationBias: 'confirmation_bias'
});

/**
 * Frozen `detailKey` names. `SIGNAL_INSUFFICIENT_DATA` is the "not enough data"
 * prompt key; the other three carry the one-line human description for A-7.
 */
export const SIGNAL_DETAIL_KEYS = Object.freeze({
  docBottleneck: 'SIGNAL_DOC_BOTTLENECK',
  serializationRegression: 'SIGNAL_SERIALIZATION_REGRESSION',
  confirmationBias: 'SIGNAL_CONFIRMATION_BIAS',
  insufficientData: 'SIGNAL_INSUFFICIENT_DATA'
});

const DEFAULTS = Object.freeze({
  minSamples: 2,
  docDwellMs: 10 * 60 * 1000,
  agreementCount: 3
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function timeMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function numberAt(config, key) {
  const value = config?.[key];
  return Number.isFinite(value) && value >= 0 ? value : DEFAULTS[key];
}

function instanceIdOf(state, traces, events, config) {
  if (typeof config?.instanceId === 'string') return config.instanceId;
  if (typeof state?.instanceId === 'string') return state.instanceId;
  const trace = asArray(traces).find((s) => typeof s?.instance_id === 'string');
  if (trace) return trace.instance_id;
  const event = asArray(events).find((e) => typeof e?.instanceId === 'string');
  return event ? event.instanceId : null;
}

function referenceNow(config, state, traces, events) {
  const hint = timeMs(config?.now);
  if (hint !== null) return hint;
  const candidates = [];
  for (const event of asArray(events)) {
    const at = timeMs(event?.ts ?? event?.timestamp);
    if (at !== null) candidates.push(at);
  }
  for (const span of asArray(traces)) {
    const at = timeMs(span?.end_time ?? span?.start_time);
    if (at !== null) candidates.push(at);
  }
  for (const node of asArray(state?.nodes)) {
    const at = timeMs(node?.updatedAt ?? node?.startedAt);
    if (at !== null) candidates.push(at);
  }
  return candidates.length > 0 ? Math.max(...candidates) : 0;
}

function nodeIdOf(node) {
  if (!isRecord(node)) return null;
  return node.nodeId ?? node.id ?? null;
}

function kindOf(node) {
  if (!isRecord(node)) return '';
  return String(node.artifact_type ?? node.artifactType ?? node.node_type ?? node.type ?? '').toLowerCase();
}

function signal(type, instanceId, nodeId, detailKey) {
  return { type, instanceId, nodeId, detailKey };
}

/** Document node parked in review beyond the configured dwell threshold. */
function documentBottlenecks(nodes, traces, now, dwellMs, instanceId) {
  const found = [];
  const reported = new Set();
  for (const node of nodes) {
    const nodeId = nodeIdOf(node);
    if (nodeId === null || kindOf(node) !== 'document') continue;
    const current = node.state ?? node.status;
    const entered = timeMs(node.startedAt ?? node.reviewStartedAt ?? node.enteredAt ?? node.start_time);
    if (current === 'review' && entered !== null && now - entered >= dwellMs) {
      found.push(signal(SIGNAL_TYPES.docBottleneck, instanceId, nodeId, SIGNAL_DETAIL_KEYS.docBottleneck));
      reported.add(nodeId);
    }
  }
  // A landed span that sat in review for too long is the same signal when the
  // current state snapshot no longer shows the node in that phase.
  for (const span of traces) {
    const nodeId = span?.node_id ?? span?.nodeId ?? null;
    if (nodeId === null || reported.has(nodeId)) continue;
    const related = nodes.find((n) => nodeIdOf(n) === nodeId);
    if (!related || kindOf(related) !== 'document') continue;
    if ((span?.status ?? '') !== 'review') continue;
    const start = timeMs(span.start_time);
    const end = timeMs(span.end_time);
    if (start === null || end === null || end - start < dwellMs) continue;
    found.push(signal(SIGNAL_TYPES.docBottleneck, instanceId, nodeId, SIGNAL_DETAIL_KEYS.docBottleneck));
    reported.add(nodeId);
  }
  return found;
}

function pairKey(a, b) {
  return `${a}\u0000${b}`;
}

/** Nodes connected by a dependency path in either direction. */
function dependentPairs(nodes, edges) {
  const adjacency = new Map();
  for (const node of nodes) {
    const id = nodeIdOf(node);
    if (id !== null && !adjacency.has(id)) adjacency.set(id, new Set());
  }
  for (const edge of edges) {
    const from = edge?.from ?? edge?.fromNodeId ?? null;
    const to = edge?.to ?? edge?.toNodeId ?? null;
    if (from === null || to === null) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }
  const dependent = new Set();
  for (const start of adjacency.keys()) {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        dependent.add(pairKey(start, next));
        queue.push(next);
      }
    }
  }
  return dependent;
}

function spansByNodeAndRound(traces) {
  const table = new Map();
  for (const span of traces) {
    const nodeId = span?.node_id ?? span?.nodeId ?? null;
    if (nodeId === null) continue;
    const round = Number(span.round);
    const key = `${nodeId}#${Number.isFinite(round) ? round : 0}`;
    if (!table.has(key)) table.set(key, []);
    table.get(key).push(span);
  }
  return table;
}

function overlaps(a, b) {
  const aStart = timeMs(a.start_time);
  const aEnd = timeMs(a.end_time);
  const bStart = timeMs(b.start_time);
  const bEnd = timeMs(b.end_time);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/** Independent node pairs whose spans never overlap in the same round. */
function serializations(graph, traces, instanceId) {
  const nodes = asArray(graph?.nodes);
  const edges = asArray(graph?.edges);
  const dependent = dependentPairs(nodes, edges);
  const table = spansByNodeAndRound(traces);
  const rounds = new Set();
  for (const span of traces) {
    const round = Number(span?.round);
    if (Number.isFinite(round)) rounds.add(round);
  }

  const found = [];
  const reported = new Set();
  const nodeIds = nodes.map(nodeIdOf).filter((id) => id !== null);
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (let j = i + 1; j < nodeIds.length; j += 1) {
      const a = nodeIds[i];
      const b = nodeIds[j];
      if (dependent.has(pairKey(a, b)) || dependent.has(pairKey(b, a))) continue;
      for (const round of rounds) {
        const aSpans = table.get(`${a}#${round}`) ?? [];
        const bSpans = table.get(`${b}#${round}`) ?? [];
        let sequential = false;
        let later = b;
        for (const left of aSpans) {
          for (const right of bSpans) {
            if (overlaps(left, right)) continue;
            const leftEnd = timeMs(left.end_time) ?? 0;
            const rightEnd = timeMs(right.end_time) ?? 0;
            later = leftEnd >= rightEnd ? a : b;
            sequential = true;
          }
        }
        if (!sequential || reported.has(later)) continue;
        found.push(signal(
          SIGNAL_TYPES.serializationRegression,
          instanceId,
          later,
          SIGNAL_DETAIL_KEYS.serializationRegression
        ));
        reported.add(later);
      }
    }
  }
  return found;
}

function evidencePresent(detail) {
  const refs = detail.evidenceRefs ?? detail.evidence_refs ??
    detail.independentEvidence ?? detail.independent_evidence ?? detail.evidence;
  if (refs === undefined || refs === null || refs === false || refs === '') return false;
  return Array.isArray(refs) ? refs.length > 0 : true;
}

/** Review nodes that keep agreeing with upstream and cite no separate evidence. */
function confirmations(events, nodes, threshold, instanceId) {
  const reviewIds = new Set();
  for (const node of nodes) {
    const nodeId = nodeIdOf(node);
    if (nodeId === null) continue;
    const type = kindOf(node);
    const state = node.state ?? node.status;
    if (type.includes('review') || state === 'review') reviewIds.add(nodeId);
  }

  const counts = new Map();
  for (const event of events) {
    const nodeId = event?.objectId ?? event?.nodeId ?? event?.detail?.nodeId ?? null;
    if (nodeId === null) continue;
    if (reviewIds.size > 0 && !reviewIds.has(nodeId)) continue;
    const detail = isRecord(event.detail) ? event.detail : {};
    const verdict = detail.verdict ?? detail.conclusion ?? detail.result ?? null;
    const upstream = detail.upstreamVerdict ?? detail.upstream ?? detail.parentVerdict ?? null;
    if (verdict === null || upstream === null || String(verdict) !== String(upstream)) continue;
    if (evidencePresent(detail)) continue;
    counts.set(nodeId, (counts.get(nodeId) ?? 0) + 1);
  }

  const found = [];
  for (const [nodeId, count] of counts) {
    if (count >= threshold) {
      found.push(signal(SIGNAL_TYPES.confirmationBias, instanceId, nodeId, SIGNAL_DETAIL_KEYS.confirmationBias));
    }
  }
  return found;
}

/**
 * Detect the three read-only anti-pattern signals for one instance.
 *
 * @param {object} args
 * @param {object} [args.graph] node/edge definition used for dependency checks
 * @param {object} [args.state] current instance state snapshot
 * @param {Array}  [args.traces] landed trace spans
 * @param {Array}  [args.events] parsed event records
 * @param {object} [args.config] thresholds: minSamples, docDwellMs,
 *   agreementCount, now (all optional)
 * @returns {{signals:Array<{type:string,instanceId:string|null,nodeId:string|null,detailKey:string}>,
 *   insufficientData:boolean}}
 */
export function detectAntipatterns({ graph, state, traces, events, config } = {}) {
  const traceList = asArray(traces);
  const eventList = asArray(events).filter(isRecord);
  const sampleCount = traceList.length + eventList.length;
  const minSamples = numberAt(config, 'minSamples');
  if (sampleCount < minSamples) {
    return { signals: [], insufficientData: true };
  }

  const instanceId = instanceIdOf(state, traceList, eventList, config);
  const now = referenceNow(config, state, traceList, eventList);
  const stateNodes = asArray(state?.nodes);
  const graphNodes = asArray(graph?.nodes);

  const signals = [
    ...documentBottlenecks(stateNodes, traceList, now, numberAt(config, 'docDwellMs'), instanceId),
    ...serializations(graph, traceList, instanceId),
    ...confirmations(eventList, graphNodes.length > 0 ? graphNodes : stateNodes,
      numberAt(config, 'agreementCount'), instanceId)
  ];

  return { signals, insufficientData: false };
}
