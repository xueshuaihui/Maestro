/**
 * Dry-run orchestration plan builder (requirement A-14 / D-5 / C-12, WP-4).
 *
 * `planWorkflow({ workflow, task })` turns one in-memory workflow object into
 * the frozen 8-key plan consumed by `renderWorkflowDryRun` (WP-5) and the
 * `workflow dry-run` command (WP-8):
 *
 *   { id, name, nodeCount, edgeCount, layers, branches, mappings, policies }
 *
 * with `layers[]` exactly `{ parallel, nodes }` (node ids, declaration order),
 * `branches[]` / `mappings[]` / `policies[]` exactly 3 keys each (A-14). The
 * plan never carries a `warnings` key (no slot in A-14) and never carries
 * per-node descriptions: `layers[].nodes` hold ids only, and the text layer
 * builds descriptions from the `nodes` / `joins` arguments WP-8 passes
 * separately (render.js contract).
 *
 * Generation order is D-5 verbatim:
 *   1. longest-path layering from `entry` (back edges take no part, they are
 *      only "annotated" - a back edge still lands in `branches` when its
 *      `when` is set, but it never lifts a layer);
 *   2. same-layer nodes sharing a `parallel_scope` merge into one
 *      `parallel: true` layer record;
 *   3. edges with `when !== 'always'` sorted by `(from layer, to layer, when)`
 *      - stable, declaration order breaks ties;
 *   4. all `map` items sorted by `(from layer, to node, item index)` - stable;
 *   5. nodes with a non-empty `timeout` / `retry` sorted by layer - stable;
 *   6. subworkflow node counts are NOT resolved here (A-14 has no slot; the
 *      renderer takes `subNodeCount` from the nodes argument of WP-8).
 *
 * Pure function: no imports, no IO, no clock, no network, no file writes
 * (C-12 / NFR-04); the same input always yields a byte-identical output.
 *
 * Key compatibility: the in-memory workflow object carries the YAML keys
 * (`node_type`, `parallel_scope`, ...); camelCase fallbacks (`nodeType`,
 * `parallelScope`) are accepted as a contract-compat default so either
 * loader-side spelling feeds the same plan (split doc §1.4 rule 2).
 */

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** First own property among `keys` that is not `undefined` (schema `has` semantics). */
function pickFirst(source, keys) {
  if (!isPlainObject(source)) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

const DEFAULT_WHEN = 'always';
/** Sentinel layer for nodes the layering never reaches; sorts after every real layer. */
const UNREACHED = Number.MAX_SAFE_INTEGER;

export function planWorkflow({ workflow, task } = {}) {
  // `task` is accepted for the §2.4 CLI signature, but the frozen 8-key plan
  // shape (A-14) has no slot for it, so it never enters the output.
  void task;

  const source = isPlainObject(workflow) ? workflow : {};
  const nodeList = Array.isArray(source.nodes) ? source.nodes : [];
  const edgeList = Array.isArray(source.edges) ? source.edges : [];
  const nodeCount = nodeList.length;
  const edgeCount = edgeList.length;

  const nodeIds = [];
  const nodeById = new Map();
  for (const node of nodeList) {
    if (!isPlainObject(node)) continue;
    const id = node.id;
    if (typeof id === 'string' && !nodeById.has(id)) {
      nodeById.set(id, node);
      nodeIds.push(id);
    }
  }

  const entry = stringOrNull(pickFirst(source, ['entry']));
  const entryId = entry !== null && nodeById.has(entry) ? entry : (nodeIds[0] ?? null);

  // Step 1 - longest-path layering from the entry. Only `forward` edges
  // (explicit or by missing kind) participate; `backflow` / `retest` are
  // control-flow back edges (D-3 step 11 wording) and take no part. The
  // relaxation is capped at nodeIds.length rounds, so even a malformed graph
  // terminates with a deterministic result.
  const layerOf = new Map();
  if (entryId !== null) layerOf.set(entryId, 0);
  const flowEdges = [];
  for (const edge of edgeList) {
    if (!isPlainObject(edge)) continue;
    const kind = pickFirst(edge, ['kind']);
    if (kind === 'backflow' || kind === 'retest') continue;
    flowEdges.push(edge);
  }
  for (let round = 0; round < Math.max(nodeIds.length, 1); round += 1) {
    let changed = false;
    for (const edge of flowEdges) {
      const from = stringOrNull(edge.from);
      const to = stringOrNull(edge.to);
      if (from === null || to === null || !layerOf.has(from)) continue;
      const candidate = layerOf.get(from) + 1;
      if (!layerOf.has(to) || candidate > layerOf.get(to)) {
        layerOf.set(to, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const layerRank = (id) => {
    if (typeof id === 'string' && layerOf.has(id)) return layerOf.get(id);
    return UNREACHED;
  };

  // Step 2 - group node ids per layer (declaration order inside a layer),
  // then merge same-layer same-`parallel_scope` nodes into one parallel
  // record. A scope shared by fewer than two nodes in the layer cannot merge
  // (the validator would reject it as WORKFLOW_SCOPE_INVALID) and stays a
  // plain single-node record.
  const byLayer = new Map();
  for (const id of nodeIds) {
    const layer = layerRank(id);
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(id);
  }
  const layers = [];
  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  for (const layerKey of layerKeys) {
    const ids = byLayer.get(layerKey);
    const scopeOfId = new Map();
    const scopeGroups = new Map();
    for (const id of ids) {
      const raw = pickFirst(nodeById.get(id), ['parallel_scope', 'parallelScope']);
      const scope = typeof raw === 'string' && raw !== '' ? raw : null;
      scopeOfId.set(id, scope);
      if (scope !== null) {
        if (!scopeGroups.has(scope)) scopeGroups.set(scope, []);
        scopeGroups.get(scope).push(id);
      }
    }
    const emitted = new Set();
    for (const id of ids) {
      if (emitted.has(id)) continue;
      const scope = scopeOfId.get(id);
      const members = scope !== null ? scopeGroups.get(scope) : null;
      if (members !== null && members !== undefined && members.length >= 2) {
        layers.push({ parallel: true, nodes: [...members] });
        for (const member of members) emitted.add(member);
      } else {
        layers.push({ parallel: false, nodes: [id] });
        emitted.add(id);
      }
    }
  }

  // Step 3 - conditional branches: edges whose effective `when` is not
  // `always`, sorted by (from layer, to layer, when) with a stable sort so
  // declaration order breaks ties.
  const whenOf = (edge) => {
    const when = pickFirst(edge, ['when']);
    return typeof when === 'string' ? when : DEFAULT_WHEN;
  };
  const branchEntries = [];
  for (const edge of edgeList) {
    if (!isPlainObject(edge)) continue;
    if (whenOf(edge) !== DEFAULT_WHEN) branchEntries.push(edge);
  }
  const compareBy = (ranksOf) => (a, b) => {
    const ra = ranksOf(a);
    const rb = ranksOf(b);
    for (let i = 0; i < ra.length; i += 1) {
      if (ra[i] < rb[i]) return -1;
      if (ra[i] > rb[i]) return 1;
    }
    return 0;
  };
  branchEntries.sort(
    compareBy((edge) => [layerRank(edge.from), layerRank(edge.to), whenOf(edge)]),
  );
  const branches = branchEntries.map((edge) => ({
    from: edge.from,
    to: edge.to,
    when: whenOf(edge),
  }));

  // Step 4 - field mappings: every `map` item of every edge, keyed
  // `{ from, to, edge }` where `edge` is `"<from>→<to>"` (the renderer splits
  // the target side off it). Sort key: (from layer, target node, item index),
  // stable on declaration order.
  const mappingEntries = [];
  for (const edge of edgeList) {
    if (!isPlainObject(edge)) continue;
    const items = edge.map;
    if (!Array.isArray(items)) continue;
    const edgeFrom = stringOrNull(edge.from) ?? '';
    const edgeTo = stringOrNull(edge.to) ?? '';
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!isPlainObject(item)) continue;
      mappingEntries.push({
        from: item.from,
        to: item.to,
        edge: `${edgeFrom}→${edgeTo}`,
        rank: layerRank(edgeFrom),
        toNode: edgeTo,
        index,
      });
    }
  }
  mappingEntries.sort(compareBy((entry) => [entry.rank, entry.toNode, entry.index]));
  const mappings = mappingEntries.map(({ from, to, edge }) => ({ from, to, edge }));

  // Step 5 - policies: nodes with a non-empty `timeout` / `retry`, sorted by
  // layer (stable on declaration order). Exactly 3 keys; a missing half is
  // `null` (the renderer writes the dash / zero placeholders).
  const policyEntries = [];
  for (const id of nodeIds) {
    const node = nodeById.get(id);
    const timeout = pickFirst(node, ['timeout']);
    const retry = pickFirst(node, ['retry']);
    if (timeout === undefined && retry === undefined) continue;
    policyEntries.push({
      nodeId: id,
      timeout: timeout === undefined ? null : timeout,
      retry: retry === undefined ? null : retry,
      rank: layerRank(id),
    });
  }
  policyEntries.sort(compareBy((entry) => [entry.rank]));
  const policies = policyEntries.map(({ nodeId, timeout, retry }) => ({ nodeId, timeout, retry }));

  // Step 6 - subworkflow node counts stay out of the plan (A-14 has no
  // description slot; the renderer takes `subNodeCount` from WP-8's nodes).

  return {
    id: stringOrNull(source.id),
    name: stringOrNull(source.name),
    nodeCount,
    edgeCount,
    layers,
    branches,
    mappings,
    policies,
  };
}
