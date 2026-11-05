/**
 * Advance planning and handoff construction (pure; no IO, no mutation).
 *
 * `planAdvance` answers one question: given a completed node and the graph, what
 * happens next? It never writes state — the caller performs the CAS and the dispatch.
 * `round` in the result is the *target* round (dispatch time is when a round starts),
 * so the caller must not add one again.
 *
 * Wake-up rules (D-2): a wake-up needs a handoff that is still `created`/`delivered`
 * with `wakeConsumedAt === null`, and a target node that is reopenable
 * (`done` for a backflow, `failed` for a retest). The round check uses the round
 * *before* dispatch, so the second (and last) dispatch is not blocked.
 */
import {
  edgeFor,
  isTerminalNode,
  maxRoundsOf,
  nodeById
} from './graph.js';
import { extractProductLines } from './verify-artifact.js';
import { promptFor } from '../templates/index.js';

const defaultNow = () => Date.now();

const PENDING_HANDOFF_STATES = new Set(['created', 'delivered']);

function idOf(node) {
  return node?.nodeId ?? node?.id ?? null;
}

function roundOf(node) {
  return Number.isInteger(node?.round) ? node.round : 0;
}

function isoOf(now) {
  const value = typeof now === 'function' ? now() : Date.now();
  return new Date(value).toISOString();
}

function normalizeDefects(defects) {
  if (!Array.isArray(defects)) return [];
  return defects
    .filter((defect) => defect && typeof defect === 'object')
    .map((defect) => ({
      summary: typeof defect.summary === 'string' ? defect.summary : '',
      evidence: typeof defect.evidence === 'string' ? defect.evidence : ''
    }));
}

function verdictValue(verdict, node) {
  const direct = verdict?.result ?? verdict?.value ?? null;
  if (direct === 'pass' || direct === 'fail') return direct;
  const stored = node?.verdict?.value ?? node?.verdict?.result ?? null;
  return stored === 'pass' || stored === 'fail' ? stored : null;
}

/** The most recently ended node, used when the caller does not name one. */
function latestNodeId(nodes) {
  let bestId = null;
  let bestAt = null;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!['done', 'failed', 'escalated'].includes(node?.state)) continue;
    const endedAt = typeof node.endedAt === 'string' ? node.endedAt : null;
    if (endedAt === null) continue;
    if (bestAt === null || endedAt > bestAt) {
      bestAt = endedAt;
      bestId = idOf(node);
    }
  }
  return bestId;
}

/**
 * Classify a finished node.
 *   'passed'       -> done, verdict null/pass
 *   'verdict-fail' -> failed because a structured verdict said fail
 *   'escalated'    -> already escalated (the escalation transaction owns the rest)
 *   'error'        -> any other failure (host error, artifact failure, legacy path)
 */
export function classifyNodeOutcome(state, nodeId, verdict = null) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const node = nodes.find((item) => idOf(item) === nodeId) ?? null;
  if (!node) return 'error';
  if (node.state === 'escalated') return 'escalated';
  if (node.state === 'done') return 'passed';
  if (node.state === 'failed') {
    return verdictValue(verdict, node) === 'fail' ? 'verdict-fail' : 'error';
  }
  return 'error';
}

/** Globally increasing handoff id: HO-001, HO-002, … (never reused). */
export function nextHandoffId(handoffs) {
  let max = 0;
  for (const handoff of Array.isArray(handoffs) ? handoffs : []) {
    const match = /^HO-(\d+)$/.exec(handoff?.handoffId ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `HO-${String(max + 1).padStart(3, '0')}`;
}

/**
 * Build a handoff entry in the D-6 shape. `fromNode`/`toNode`/`task`/`products`
 * are accepted for call-site symmetry; only the persisted fields are returned.
 */
export function buildHandoff({
  instanceId = null,
  edge = null,
  round = 1,
  fromNode = null,
  toNode = null,
  task = '',
  products = [],
  defects = [],
  retestRequirement = null,
  handoffs = [],
  handoffId = null,
  now = defaultNow
} = {}) {
  return {
    handoffId: handoffId ?? nextHandoffId(handoffs),
    edge: {
      from: edge?.from ?? null,
      to: edge?.to ?? null,
      kind: edge?.kind ?? 'forward'
    },
    state: 'created',
    createdAt: isoOf(now),
    deliveredAt: null,
    acceptedAt: null,
    consumedAt: null,
    rejectedAt: null,
    rejectReason: null,
    wakeConsumedAt: null,
    acceptedSignal: null,
    ambiguityWindowMs: null,
    defects: normalizeDefects(defects),
    note: null
  };
}

/**
 * Backflow handoff: the defect list with evidence locations plus the retest
 * requirement is mandatory (AC-24). Returns the handoff and the prompt text so the
 * caller only persists the handoff.
 */
export function buildBackflowHandoff({
  instanceId = null,
  edge = null,
  round = 1,
  fromNode = null,
  toNode = null,
  task = '',
  products = [],
  defects = [],
  retestRequirement = null,
  handoffs = [],
  handoffId = null,
  now = defaultNow
} = {}) {
  const normalized = normalizeDefects(defects);
  const handoff = buildHandoff({
    instanceId,
    edge: { from: edge?.from ?? null, to: edge?.to ?? null, kind: 'backflow' },
    round,
    fromNode,
    toNode,
    task,
    products,
    defects: normalized,
    retestRequirement,
    handoffs,
    handoffId,
    now
  });
  const promptText = promptFor({
    node: toNode,
    handoff,
    task,
    products,
    defects: normalized,
    retestRequirement,
    defectCount: normalized.length
  });
  return { handoff, defects: normalized, retestRequirement: retestRequirement ?? null, promptText };
}

/**
 * Wake gate (D-2). Order: pending handoff -> round cap -> target eligibility.
 * @returns {{ok:true, wakeHandoffId:string}|{ok:false, code:string, detail:{code:string}}}
 */
export function shouldWake({ handoff = null, node = null, maxRounds = null } = {}) {
  const reject = (code) => ({ ok: false, code, detail: { code } });

  if (!handoff || !handoff.edge) return reject('NO_PENDING_BACKFLOW');
  const kind = handoff.edge.kind;
  if (kind !== 'backflow' && kind !== 'retest') return reject('NO_PENDING_BACKFLOW');
  if (!PENDING_HANDOFF_STATES.has(handoff.state)) return reject('NO_PENDING_BACKFLOW');
  if (handoff.wakeConsumedAt !== null && handoff.wakeConsumedAt !== undefined) {
    return reject('NO_PENDING_BACKFLOW');
  }
  if (!node) return reject('TARGET_NOT_ELIGIBLE');

  const limit = Number.isInteger(maxRounds) ? maxRounds : null;
  if (limit !== null && roundOf(node) >= limit) return reject('ROUNDS_EXCEEDED');

  const eligibleStates = kind === 'retest' ? ['failed'] : ['done', 'failed'];
  if (!eligibleStates.includes(node.state)) return reject('TARGET_NOT_ELIGIBLE');

  return { ok: true, wakeHandoffId: handoff.handoffId };
}

/**
 * Snapshot-driven wake gate: find the pending handoff for `edge.to`/`edge.kind`
 * and run the same rules. Used by the engine before a backflow or retest dispatch.
 */
export function checkWakeGate({ graph = null, state = null, edge = null } = {}) {
  const reject = (code) => ({ ok: false, code, detail: { code } });
  if (!edge) return reject('NO_PENDING_BACKFLOW');

  const handoffs = Array.isArray(state?.handoffs) ? state.handoffs : [];
  const handoff =
    handoffs.find(
      (item) =>
        item?.edge?.to === edge.to &&
        item?.edge?.kind === edge.kind &&
        PENDING_HANDOFF_STATES.has(item.state) &&
        (item.wakeConsumedAt === null || item.wakeConsumedAt === undefined)
    ) ?? null;
  if (!handoff) return reject('NO_PENDING_BACKFLOW');

  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const node = nodes.find((item) => idOf(item) === edge.to) ?? null;
  if (!node) return reject('TARGET_NOT_ELIGIBLE');

  const limit = graph === null ? null : maxRoundsOf(graph, edge.to);
  const rounded = Number.isFinite(limit) ? limit : null;
  return shouldWake({ handoff, node, maxRounds: rounded });
}

function escalate(nodeId, round, reason) {
  return { action: 'escalate', nodeId, round, reason };
}

/**
 * Plan the next move after a node finished.
 *
 * @param {{graph:object, snapshot?:object, state?:object, verdict?:object,
 *          fromNodeId?:string, outcome?:string, now?:Function}} options
 * @returns {{action:'dispatch'|'backflow'|'complete'|'escalate'|'halt',
 *            nodeId:string|null, targetNodeId?:string|null, edge?:object|null,
 *            round:number, reason:string, handoffDraft?:object, promptText?:string}}
 */
export function planAdvance({
  graph = null,
  snapshot = null,
  state = null,
  verdict = null,
  fromNodeId = null,
  outcome = null,
  now = defaultNow
} = {}) {
  const snap = snapshot ?? state ?? {};
  const nodes = Array.isArray(snap.nodes) ? snap.nodes : [];
  const currentId = fromNodeId ?? latestNodeId(nodes);
  const currentNode = currentId === null ? null : (nodes.find((item) => idOf(item) === currentId) ?? null);
  const currentRound = roundOf(currentNode);

  if (snap.halted === true) {
    return { action: 'halt', nodeId: currentId, round: currentRound, reason: 'halted' };
  }
  if (!graph) {
    return { action: 'halt', nodeId: currentId, round: currentRound, reason: 'graph_missing' };
  }
  if (currentId === null) {
    return { action: 'halt', nodeId: null, round: 0, reason: 'no_completed_node' };
  }

  const classified = outcome ?? classifyNodeOutcome(snap, currentId, verdict);
  if (classified === 'escalated') {
    return escalate(currentId, currentRound, 'node_escalated');
  }
  if (classified === 'error') {
    return escalate(currentId, currentRound, 'execution_failed');
  }

  const edge = edgeFor(graph, currentId, classified, snap);
  const target = edge ? nodeById(graph, edge.to) : null;
  // Rounds live on the snapshot, not on the graph; the graph node only carries ids.
  const targetSnapshot = target
    ? (nodes.find((item) => idOf(item) === idOf(target)) ?? null)
    : null;

  const productsOf = (node) => {
    const declared = Array.isArray(node?.products) ? node.products : [];
    if (declared.length > 0) return declared;
    const parsed = extractProductLines(snap.task ?? '');
    return parsed.ok ? parsed.refs : [];
  };

  if (classified === 'verdict-fail') {
    if (!edge || !target) return escalate(currentId, currentRound, 'rounds_exceeded');
    const limit = maxRoundsOf(graph, currentId);
    if (Number.isFinite(limit) && currentRound >= limit) {
      return escalate(currentId, currentRound, 'rounds_exceeded');
    }
    const round = roundOf(targetSnapshot) + 1;
    const defects = normalizeDefects(verdict?.defects ?? []);
    const retestRequirement = verdict?.retestRequirement ?? null;
    const products = productsOf(target);
    const handoffDraft = buildHandoff({
      instanceId: snap.instanceId ?? null,
      edge,
      round,
      fromNode: currentNode,
      toNode: target,
      task: snap.task ?? '',
      products,
      defects,
      retestRequirement,
      handoffs: snap.handoffs ?? [],
      now
    });
    const promptText = promptFor({
      graph,
      node: target,
      handoff: handoffDraft,
      task: snap.task ?? '',
      products,
      defects,
      retestRequirement,
      defectCount: defects.length
    });
    return {
      action: 'backflow',
      nodeId: idOf(target),
      targetNodeId: idOf(target),
      edge: handoffDraft.edge,
      round,
      reason: 'verdict_fail',
      handoffDraft,
      promptText
    };
  }

  // classified === 'passed'
  if (isTerminalNode(graph, currentId)) {
    return { action: 'complete', nodeId: currentId, round: currentRound, reason: 'terminal' };
  }
  if (!edge || !target) return escalate(currentId, currentRound, 'no_edge');

  const limit = maxRoundsOf(graph, idOf(target));
  if (Number.isFinite(limit) && roundOf(targetSnapshot) >= limit) {
    return escalate(currentId, currentRound, 'rounds_exceeded');
  }

  const round = roundOf(targetSnapshot) + 1;
  const products = productsOf(target);
  const handoffDraft = buildHandoff({
    instanceId: snap.instanceId ?? null,
    edge,
    round,
    fromNode: currentNode,
    toNode: target,
    task: snap.task ?? '',
    products,
    defects: [],
    handoffs: snap.handoffs ?? [],
    now
  });
  const promptText = promptFor({
    graph,
    node: target,
    handoff: handoffDraft,
    task: snap.task ?? '',
    products,
    defects: [],
    defectCount: 0
  });

  return {
    action: 'dispatch',
    nodeId: idOf(target),
    targetNodeId: idOf(target),
    edge: handoffDraft.edge,
    round,
    reason: edge.kind === 'retest' ? 'retest' : 'forward',
    handoffDraft,
    promptText
  };
}
