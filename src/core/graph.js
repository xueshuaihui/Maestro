/**
 * Read-only graph queries. Pure functions: no IO, no state, no mutation.
 *
 * The engine receives a graph object; it never imports a built-in graph here and
 * never spells a template or role name (AC-28). Nodes may carry either `id` or
 * `nodeId` (both are present in the built-in data); edges always use `from`/`to`.
 *
 * Edge kinds:
 *   forward  — first visit of the next node in order
 *   backflow — a failed verdict sends work back to the previous node
 *   retest   — re-open a node that already failed, with the same products
 */

export function idOf(node) {
  if (!node) return null;
  return node.id ?? node.nodeId ?? null;
}

export function nodesOf(graph) {
  return Array.isArray(graph?.nodes) ? graph.nodes : [];
}

export function edgesOf(graph) {
  return Array.isArray(graph?.edges) ? graph.edges : [];
}

/** Resolve a graph by name in a `name -> graph` dictionary; unknown names return null. */
export function getGraph(graphs, name) {
  if (!graphs || typeof graphs !== 'object') return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (!Object.prototype.hasOwnProperty.call(graphs, name)) return null;
  const graph = graphs[name];
  return graph && typeof graph === 'object' ? graph : null;
}

/** Node by id (accepts either field spelling); null when absent. */
export function nodeById(graph, id) {
  if (id === null || id === undefined) return null;
  return nodesOf(graph).find((node) => idOf(node) === id) ?? null;
}

/** Alias kept for the split-doc spelling (`findNode`). */
export function findNode(graph, id) {
  return nodeById(graph, id);
}

/** Entry node; falls back to the lowest `order` when `entry` is missing. */
export function firstNode(graph) {
  const entry = graph?.entry ?? null;
  const byEntry = entry === null ? null : nodeById(graph, entry);
  if (byEntry) return byEntry;
  return [...nodesOf(graph)].sort((a, b) => orderOf(a) - orderOf(b))[0] ?? null;
}

/** Alias kept for the split-doc spelling (`initialNode`). */
export function initialNode(graph) {
  return firstNode(graph);
}

function orderOf(node) {
  return Number.isInteger(node?.order) ? node.order : Number.MAX_SAFE_INTEGER;
}

/** Outgoing edges of a node, optionally filtered by kind. */
export function outgoingEdges(graph, id, kind = null) {
  return edgesOf(graph).filter(
    (edge) => edge.from === id && (kind === null || edge.kind === kind)
  );
}

/** Alias kept for the split-doc spelling (`outEdges`). */
export function outEdges(graph, id, kind = null) {
  return outgoingEdges(graph, id, kind);
}

/**
 * Next node after `fromId`, decided by `ctx.kind`:
 *   'backflow'       -> the backflow edge's target
 *   'retest'         -> the retest edge's target
 *   'forward' / 'passed' -> forward edge first, then retest
 * Returns null when no such edge exists.
 */
export function nextNode(graph, fromId, ctx = {}) {
  const kind = typeof ctx === 'string' ? ctx : (ctx?.kind ?? 'forward');
  const order =
    kind === 'forward' || kind === 'passed'
      ? ['forward', 'retest']
      : kind === 'retest'
        ? ['retest', 'forward']
        : [kind];

  for (const candidate of order) {
    const edge = outgoingEdges(graph, fromId, candidate)[0];
    if (edge) return nodeById(graph, edge.to);
  }
  return null;
}

/**
 * Pick the edge for a completed node.
 *
 * outcome:
 *   'passed'       -> forward, or retest when the target is currently reopened
 *                     (its node state is 'failed' in the supplied snapshot)
 *   'verdict-fail' -> backflow
 *   'escalated' / 'error' -> no edge
 *
 * @param {object} graph
 * @param {string} fromId
 * @param {'passed'|'verdict-fail'|'escalated'|'error'} outcome
 * @param {object|null} state optional snapshot used to choose forward vs retest
 */
export function edgeFor(graph, fromId, outcome, state = null) {
  if (outcome === 'verdict-fail') {
    return outgoingEdges(graph, fromId, 'backflow')[0] ?? null;
  }
  if (outcome !== 'passed') return null;

  const forward = outgoingEdges(graph, fromId, 'forward')[0] ?? null;
  const retest = outgoingEdges(graph, fromId, 'retest')[0] ?? null;
  if (!forward) return retest;
  if (!retest) return forward;

  if (state && Array.isArray(state.nodes)) {
    const target = state.nodes.find(
      (node) => (node.nodeId ?? node.id) === retest.to
    );
    if (target?.state === 'failed') return retest;
  }
  return forward;
}

/** True when the node id is the graph terminal (declared or, failing that, edge-less). */
export function isTerminalNode(graph, id) {
  if (id === null || id === undefined) return false;
  const declared = graph?.terminal ?? null;
  if (declared !== null) return declared === id;
  if (Array.isArray(graph?.terminals)) return graph.terminals.includes(id);
  return outgoingEdges(graph, id).length === 0;
}

/** Alias kept for the split-doc spelling (`isTerminal`). */
export function isTerminal(graph, id) {
  return isTerminalNode(graph, id);
}

/**
 * Dispatch limit for a node: `maxRounds[nodeId]`, else `maxRounds[roleId]`, else
 * Infinity (an unlimited node). Never negative.
 */
export function maxRoundsOf(graph, id) {
  const node = nodeById(graph, id);
  const table = graph?.maxRounds;
  if (!table || typeof table !== 'object') return Infinity;
  const byId = table[id] ?? (node ? table[node.roleId] : undefined);
  if (Number.isInteger(byId) && byId >= 0) return byId;
  return Infinity;
}

/**
 * The state a wake-up needs to see on the target node:
 *   backflow -> 'done' (a finished node is reopened)
 *   retest   -> 'failed' (a failed node is retried)
 * Anything else -> null.
 */
export function wakeSourceOf(graph, nodeId, kind) {
  if (kind === 'backflow') return 'done';
  if (kind === 'retest') return 'failed';
  if (kind === null || kind === undefined) {
    return outgoingEdges(graph, nodeId, 'backflow').length > 0 ? 'done' : null;
  }
  return null;
}

/**
 * Structural check for injected graphs (unit tests only; not a loader).
 * @returns {{ok:true}|{ok:false, code:'GRAPH_INVALID', detail:string}}
 */
export function validateGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    return { ok: false, code: 'GRAPH_INVALID', detail: 'graph must be an object' };
  }
  const nodes = nodesOf(graph);
  if (nodes.length === 0) {
    return { ok: false, code: 'GRAPH_INVALID', detail: 'graph has no nodes' };
  }

  const ids = new Set();
  for (const node of nodes) {
    const id = idOf(node);
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, code: 'GRAPH_INVALID', detail: 'node without id' };
    }
    if (ids.has(id)) {
      return { ok: false, code: 'GRAPH_INVALID', detail: `duplicate node ${id}` };
    }
    if (typeof node.roleId !== 'string' || node.roleId.length === 0) {
      return { ok: false, code: 'GRAPH_INVALID', detail: `node ${id} without roleId` };
    }
    ids.add(id);
  }

  const entry = graph.entry ?? idOf(nodes[0]);
  if (!ids.has(entry)) {
    return { ok: false, code: 'GRAPH_INVALID', detail: `entry ${entry} is not a node` };
  }

  const terminal = graph.terminal ?? (Array.isArray(graph.terminals) ? graph.terminals[0] : null);
  if (terminal === null || !ids.has(terminal)) {
    return { ok: false, code: 'GRAPH_INVALID', detail: 'terminal node is missing' };
  }

  const seen = new Set();
  for (const edge of edgesOf(graph)) {
    const key = `${edge.from}->${edge.to}:${edge.kind}`;
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      return { ok: false, code: 'GRAPH_INVALID', detail: `edge ${key} references an unknown node` };
    }
    if (!['forward', 'backflow', 'retest'].includes(edge.kind)) {
      return { ok: false, code: 'GRAPH_INVALID', detail: `edge ${key} has an unknown kind` };
    }
    if (seen.has(key)) {
      return { ok: false, code: 'GRAPH_INVALID', detail: `duplicate edge ${key}` };
    }
    seen.add(key);
  }

  return { ok: true };
}
