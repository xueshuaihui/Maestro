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
import path from 'node:path';

import {
  edgeFor,
  isTerminalNode,
  maxRoundsOf,
  nodeById,
  nodesOf
} from './graph.js';
import { docRef, writePathOf } from './doc-artifact.js';
import { REVIEW_PATH } from './review.js';
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

/**
 * A node has "left the execution state" when it is done / failed / escalated, or when it
 * sits in `review` waiting for the downstream node to take over (downstream gate, D-3).
 * The latter still counts as ended here, otherwise the dispatcher would never advance to
 * the next node after a gated node verified its own output.
 */
function hasEnded(node) {
  if (['done', 'failed', 'escalated'].includes(node?.state)) return true;
  return node?.state === 'review' && node?.reviewReason === 'downstream';
}

/** The most recently ended node, used when the caller does not name one. */
function latestNodeId(nodes) {
  let bestId = null;
  let bestAt = null;
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!hasEnded(node)) continue;
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
  if (node.state === 'review' && node.reviewReason === 'downstream') return 'passed';
  if (node.state === 'failed') {
    // A review node that rejected this round: the defect list feeds the backflow.
    const decided = node.review?.decision ?? null;
    if (decided === 'reject') return 'verdict-fail';
    if (decided === 'pass') return 'passed';
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
  artifactRefs = null,
  revisionRequirement = null,
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
    note: null,
    // I1.3 (D-6): which document this handoff carries in / out / replaces.
    artifactRefs: artifactRefs === null ? null : artifactRefs,
    revisionRequirement: revisionRequirement ?? null
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
  revisionRequirement = null,
  artifactRefs = null,
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
    artifactRefs,
    revisionRequirement,
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
    revisionRequirement,
    defectCount: normalized.length,
    round,
    docRef: artifactRefs?.output ?? null,
    previousRef: artifactRefs?.previous?.ref ?? null
  });
  return {
    handoff,
    defects: normalized,
    retestRequirement: retestRequirement ?? null,
    revisionRequirement: revisionRequirement ?? null,
    promptText
  };
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
  workspaceDir = null,
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

  const productPolicy = graph?.productPolicy ?? 'declared';

  const productsOf = (def) => {
    const declared = Array.isArray(def?.products) ? def.products : [];
    if (declared.length > 0) return declared;
    // A single-document graph must never fall back to the task's `产物：` line here: it
    // would hand back a bare `<name>.md` and make an empty node look submitted (R3).
    if (productPolicy === 'doc-single') return [];
    const parsed = extractProductLines(snap.task ?? '');
    return parsed.ok ? parsed.refs : [];
  };

  /** The fixed research note declared by the report node, if the graph has one. */
  const researchRefOf = () => {
    const def = nodesOf(graph).find(
      (item) =>
        item?.artifactPolicy === 'fixed-workspace' &&
        Array.isArray(item.products) &&
        item.products.length > 0
    );
    return def?.products?.[0] ?? null;
  };

  /**
   * Per-edge artifact references — the single source of truth (D-6 table).
   * Only a `versioned-doc` target produces an output document; everything else passes
   * the source node's first reference through as `input`.
   */
  const refsForEdge = (targetEdge, round) => {
    const fromSnapshot = nodes.find((item) => idOf(item) === targetEdge.from) ?? null;
    const toSnapshot = nodes.find((item) => idOf(item) === targetEdge.to) ?? null;
    const toDef = nodeById(graph, targetEdge.to);
    const stem = snap.artifactStem ?? null;
    const input =
      Array.isArray(fromSnapshot?.artifactRefs) && fromSnapshot.artifactRefs.length > 0
        ? [fromSnapshot.artifactRefs[0].ref]
        : [];

    if (toDef?.artifactPolicy !== 'versioned-doc') {
      return {
        artifactRefs: { input, output: null, previous: null },
        current: input[0] ?? null,
        previous: null
      };
    }

    const naming = {
      artifactDir: toDef.artifactDir,
      artifactExt: toDef.artifactExt,
      stem
    };
    const current = docRef({ ...naming, round });
    const previous = round > 1 ? docRef({ ...naming, round: round - 1 }) : null;

    if (targetEdge.kind === 'backflow') {
      const history = Array.isArray(toSnapshot?.artifactHistory) ? toSnapshot.artifactHistory : [];
      const entry = previous === null ? null : (history.find((item) => item?.ref === previous) ?? null);
      return {
        artifactRefs: {
          input: previous === null ? [] : [previous],
          output: current,
          previous: previous === null ? null : { ref: previous, sha256: entry?.sha256 ?? null }
        },
        current,
        previous
      };
    }

    return { artifactRefs: { input, output: current, previous: null }, current, previous: null };
  };

  /** Prompt variables for the target node (refs + the absolute write path). */
  const promptVarsOf = (targetEdge, round) => {
    const { artifactRefs, current, previous } = refsForEdge(targetEdge, round);
    const toDef = nodeById(graph, targetEdge.to);
    const writeRef = toDef?.prompt === 'research' ? (toDef.products?.[0] ?? null) : current;
    return {
      artifactRefs,
      revisionRequirement: null,
      researchRef: researchRefOf(),
      docRef: current,
      previousRef: previous,
      writePath: writeRef === null ? null : writePathOf(workspaceDir, writeRef),
      // Absolute on purpose: a bare `out/review.json` next to an absolute
      // `工作区：` line reads as "inside the workspace" to the host. Same base as
      // `readReview({cwd})`, which joins `REVIEW_PATH` against `state.cwd`.
      reviewPath: path.join(path.resolve(snap.cwd ?? process.cwd()), REVIEW_PATH)
    };
  };

  if (classified === 'verdict-fail') {
    if (!edge || !target) return escalate(currentId, currentRound, 'rounds_exceeded');
    const limit = maxRoundsOf(graph, currentId);
    if (Number.isFinite(limit) && currentRound >= limit) {
      return escalate(currentId, currentRound, 'rounds_exceeded');
    }
    const round = roundOf(targetSnapshot) + 1;
    // Verdict files feed the coding loop; a review file feeds the document loop. Prefer
    // the explicit argument, then whatever the finished node stored on itself.
    const defects = normalizeDefects(
      Array.isArray(verdict?.defects) && verdict.defects.length > 0
        ? verdict.defects
        : (currentNode?.review?.defects ?? [])
    );
    const retestRequirement = verdict?.retestRequirement ?? null;
    const revisionRequirement =
      verdict?.revisionRequirement ?? currentNode?.review?.revisionRequirement ?? null;
    const products = productsOf(target);
    const vars = promptVarsOf(edge, round);
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
      artifactRefs: vars.artifactRefs,
      revisionRequirement,
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
      revisionRequirement,
      defectCount: defects.length,
      round,
      researchRef: vars.researchRef,
      docRef: vars.docRef,
      previousRef: vars.previousRef,
      writePath: vars.writePath,
      workspaceDir,
      reviewPath: vars.reviewPath
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
  const vars = promptVarsOf(edge, round);
  const handoffDraft = buildHandoff({
    instanceId: snap.instanceId ?? null,
    edge,
    round,
    fromNode: currentNode,
    toNode: target,
    task: snap.task ?? '',
    products,
    defects: [],
    artifactRefs: vars.artifactRefs,
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
    defectCount: 0,
    round,
    researchRef: vars.researchRef,
    docRef: vars.docRef,
    previousRef: vars.previousRef,
    writePath: vars.writePath,
    workspaceDir,
    reviewPath: vars.reviewPath
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
