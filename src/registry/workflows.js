/**
 * Workflow asset loader: scan -> project -> merge -> validate -> sort (WP-3).
 *
 * Owns the C-09 check-order orchestration (steps 1..13) over the shape kernel
 * in `workflow-schema.js` (which already emits steps 2..5 and 7 in order for a
 * single document). Graph-level judgements (6, 8..13) follow the D-3 wording:
 *
 *   6  role references resolve against the injected role ids; subworkflow
 *      references resolve against the merged collection and never cycle
 *   8  reachability: forward from `entry` along ALL edges, then every node
 *      must reach a terminal state (`terminal` node or any `human` /
 *      `escalate` node, BR-35)
 *   9  every `backflow` target must declare `max_rounds`
 *   10 parallel groups: >= 2 nodes, no duplicate product scope in a group
 *   11 variable references and mapping completeness on `forward` edges only
 *      (control-flow edges `backflow`/`retest` are exempt)
 *   12 static transition matrix (see `checkTransitions`)
 *   13 wake permissions on `forward` edges only, for EVERY workflow including
 *      the three built-in projections (no exemption, BR-39)
 *
 * The loader is read-only (scans `<root>/.orch/workflows/*.yaml`, skips the
 * directory when absent), never writes, and never produces natural-language
 * text: every failure is a 6-key `{code, file, scope, field, line, params}`
 * record (`scope` is always 'workflow'); the CLI layer assembles sentences.
 * Error order: by `file` (built-ins sort under their built-in file prefix of
 * A-9, spelled via unicode escapes so this source stays free of CJK), then by
 * the fixed C-09 step order inside one file, and the same reason code is
 * reported only once per file.
 *
 * Steps 6 and 13 need role data no graph carries, so the caller injects it:
 * `roles` is the `loadRegistry` role array (objects with `id` and
 * `wake_allow`/`wakeAllow`). When `roles` is omitted, step 6 is skipped and
 * step 13 falls back to node-level `wake_allow` declarations only. Workflow
 * and role display names (C-10 title fallback) are injected as plain data
 * maps as well, keeping this file free of CJK and concrete asset ids.
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseYaml } from './yaml-lite.js';
import {
  EDGE_KINDS,
  WHEN_VALUES,
  WORKFLOW_REASONS,
  WORKFLOW_SCHEMA_VERSION,
  checkWorkflowShape
} from './workflow-schema.js';

const BUILTIN = 'builtin';
const PROJECT = 'project';
const SCOPE = 'workflow';
const EXT = '.yaml';

/** The built-in file prefix of A-9, spelled so the source stays CJK-free. */
const BUILTIN_FILE_PREFIX = '\u5185\u7f6e ';

/**
 * C-09 verbatim: the 13 fixed check steps in execution order. The
 * `CODE_STEP` mapping below drives the per-file error ordering (BR-40 /
 * AC-65: two runs over the same tree produce byte-identical error arrays).
 */
export const WORKFLOW_CHECK_ORDER = Object.freeze([
  'parse', // 1
  'required-keys', // 2
  'id-filename', // 3
  'node-id-unique', // 4
  'node-type-and-required-fields', // 5
  'references-role-subworkflow', // 6
  'edge-endpoints-and-values', // 7
  'reachability', // 8
  'backflow-round-limit', // 9
  'parallel-scope', // 10
  'variables-and-mappings', // 11
  'state-transitions', // 12
  'wake-permissions' // 13
]);

const CODE_STEP = Object.freeze({
  YAML_PARSE_FAILED: 1,
  WORKFLOW_SCHEMA_MISSING: 2,
  WORKFLOW_ID_MISMATCH: 3,
  WORKFLOW_NODE_DUPLICATE: 4,
  WORKFLOW_NODE_TYPE_INVALID: 5,
  WORKFLOW_NODE_FIELD_MISSING: 5,
  WORKFLOW_ROLE_UNKNOWN: 6,
  WORKFLOW_SUB_UNKNOWN: 6,
  WORKFLOW_SUB_CYCLE: 6,
  WORKFLOW_EDGE_INVALID: 7,
  WORKFLOW_TIMEOUT_INVALID: 7,
  WORKFLOW_RETRY_INVALID: 7,
  WORKFLOW_UNREACHABLE: 8,
  WORKFLOW_BACKFLOW_NO_LIMIT: 9,
  WORKFLOW_SCOPE_OVERLAP: 10,
  WORKFLOW_SCOPE_INVALID: 10,
  WORKFLOW_VAR_UNKNOWN: 11,
  WORKFLOW_MAPPING_INCOMPLETE: 11,
  WORKFLOW_TRANSITION_ILLEGAL: 12,
  WORKFLOW_WAKE_DENIED: 13
});

/** D-3 step 11: `map.from` reference pattern (task input or `<node>.<field>`). */
const REF_PATTERN = /^(task|[A-Za-z0-9-]+)\.[A-Za-z0-9_.-]+$/;

const HUMAN_WHEN = Object.freeze(['human_approved', 'human_rejected']);

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function listYamlFiles(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(EXT))
      .map((entry) => entry.name.slice(0, -EXT.length))
      .sort(compareText);
  } catch {
    return [];
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function makeError(code, file, field, line, params) {
  return { code, file, scope: SCOPE, field: field ?? null, line: line ?? null, params: params ?? {} };
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function strArray(value) {
  return isStringArray(value) ? value.slice() : [];
}

function nodeTypeOf(node) {
  return node && typeof node === 'object' && typeof node.node_type === 'string' ? node.node_type : null;
}

function hasMaxRounds(node) {
  return node !== null && typeof node === 'object' && Number.isInteger(node.max_rounds);
}

function effectiveScope(node) {
  return typeof node.scope === 'string' && node.scope !== '' ? node.scope : node.id;
}

/**
 * Wake whitelist governing one forward edge (step 13). A node-level
 * `wake_allow` declaration wins (AC-37 / AC-60); otherwise the value comes
 * from the role asset passed by the caller. `undefined` means no decision is
 * available for this role and the edge is skipped.
 */
function effectiveWakeAllow(node, roleById) {
  if (node && typeof node === 'object' && isStringArray(node.wake_allow)) {
    return node.wake_allow;
  }
  if (roleById === null) return undefined;
  const role = roleById.get(node.role);
  if (role === undefined) return undefined;
  const value = isStringArray(role.wake_allow)
    ? role.wake_allow
    : isStringArray(role.wakeAllow)
      ? role.wakeAllow
      : undefined;
  return value === undefined ? undefined : value.slice();
}

/**
 * C-10 read-only projection: turn built-in graph objects into `workflow/v1`
 * shapes. `source` is 'builtin' and `file` is null. Every node becomes
 * `node_type: 'role'`; `title` takes the graph node title and falls back to
 * the injected role display name (null when neither exists); `max_rounds`
 * takes `maxRounds[nodeId]`; edge `kind` is kept and `when` is the
 * normalization of the graph `condition` (null and runtime-only conditions
 * collapse to 'always': only the closed `when` domain carries declarative
 * meaning). Graph-only fields are dropped.
 *
 * `options.names` (`{[graphId]: string}`) and `options.roleNames`
 * (`{[roleId]: string}`) are display-name data injected by the caller; the
 * workflow `name` falls back to the graph id when no name is supplied.
 */
export function projectBuiltinWorkflows(builtinGraphs, { names = null, roleNames = null } = {}) {
  const graphs = builtinGraphs && typeof builtinGraphs === 'object' ? builtinGraphs : {};
  const out = [];
  for (const key of Object.keys(graphs)) {
    const graph = graphs[key];
    if (!graph || typeof graph !== 'object') continue;
    const graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
    const maxRounds = graph.maxRounds && typeof graph.maxRounds === 'object' ? graph.maxRounds : {};

    const nodes = graphNodes.map((node) => {
      const nodeId = typeof node.id === 'string' ? node.id : node.nodeId;
      const projected = {
        id: nodeId,
        node_type: 'role',
        role: node.roleId,
        title:
          typeof node.title === 'string'
            ? node.title
            : roleNames !== null && node.roleId !== undefined && typeof roleNames[node.roleId] === 'string'
              ? roleNames[node.roleId]
              : null
      };
      const rounds = maxRounds[nodeId];
      if (Number.isInteger(rounds)) projected.max_rounds = rounds;
      return projected;
    });

    const edges = graphEdges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: EDGE_KINDS.includes(edge.kind) ? edge.kind : 'forward',
      when: WHEN_VALUES.includes(edge.condition) ? edge.condition : 'always',
      join: 'all'
    }));

    out.push({
      schema: WORKFLOW_SCHEMA_VERSION,
      id: typeof graph.id === 'string' ? graph.id : key,
      name: names !== null && typeof names[graph.id] === 'string' ? names[graph.id] : graph.id,
      summary: null,
      entry: graph.entry,
      terminal: graph.terminal,
      nodes,
      edges,
      source: BUILTIN,
      file: null
    });
  }
  return out;
}

/** Normalize one parsed edge to the workflow/v1 field set with defaults. */
function normalizeEdge(edge) {
  const out = {
    from: edge.from,
    to: edge.to,
    kind: EDGE_KINDS.includes(edge.kind) ? edge.kind : 'forward',
    when: WHEN_VALUES.includes(edge.when) ? edge.when : 'always',
    join: edge.join === 'any' ? 'any' : 'all'
  };
  if (edge.map !== undefined) out.map = edge.map;
  if (edge.max_rounds !== undefined) out.max_rounds = edge.max_rounds;
  return out;
}

function normalizeRoles(roles) {
  if (Array.isArray(roles)) return roles;
  if (roles instanceof Map) return [...roles.values()];
  return null;
}

function roleIndexOf(roles) {
  const map = new Map();
  for (const role of normalizeRoles(roles) ?? []) {
    if (role && typeof role === 'object' && typeof role.id === 'string') map.set(role.id, role);
  }
  return map;
}

function subTargetsOf(workflow) {
  const out = [];
  for (const node of workflow.nodes) {
    if (nodeTypeOf(node) === 'subworkflow' && typeof node.workflow === 'string' && !out.includes(node.workflow)) {
      out.push(node.workflow);
    }
  }
  return out;
}

/** First subworkflow cycle reachable from `start`, as a closed chain, or null. */
function findSubCycle(start, subsOf, allIds) {
  const path = [];
  const visiting = new Set();
  const walk = (current) => {
    if (visiting.has(current)) {
      const at = path.indexOf(current);
      return at === -1 ? null : path.slice(at);
    }
    if (!allIds.has(current)) return null;
    visiting.add(current);
    path.push(current);
    for (const target of subsOf(current) ?? []) {
      const cycle = walk(target);
      if (cycle !== null) return cycle;
    }
    path.pop();
    visiting.delete(current);
    return null;
  };
  const cycle = walk(start);
  return cycle === null ? null : [...cycle, cycle[0]];
}

/** Step 6: role and subworkflow reference resolution, plus the sub cycle. */
function checkReferences(workflow, nodeIndex, allIds, roleIds, file, errors, merged) {
  let roleMissing = null;
  for (const node of workflow.nodes) {
    if (nodeTypeOf(node) === 'role' && typeof node.role === 'string' && roleIds !== null) {
      if (!roleIds.has(node.role)) {
        roleMissing = node.role;
        break;
      }
    }
  }
  if (roleMissing !== null) {
    errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_ROLE_UNKNOWN, file, null, null, { role: roleMissing }));
  }

  let subMissing = null;
  for (const node of workflow.nodes) {
    if (nodeTypeOf(node) === 'subworkflow' && typeof node.workflow === 'string' && !allIds.has(node.workflow)) {
      subMissing = node.workflow;
      break;
    }
  }
  if (subMissing !== null) {
    errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_SUB_UNKNOWN, file, null, null, { id: subMissing }));
    return;
  }

  const cache = new Map();
  const subsOf = (id) => {
    if (!cache.has(id)) {
      const target = id === workflow.id ? workflow : mergedWorkflowOf(merged, id);
      cache.set(id, target === undefined || target === null ? null : subTargetsOf(target));
    }
    return cache.get(id);
  };
  const chain = findSubCycle(workflow.id, subsOf, allIds);
  if (chain !== null) {
    errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_SUB_CYCLE, file, null, null, { chain }));
  }
}

function mergedWorkflowOf(merged, id) {
  const entry = merged.get(id);
  return entry === undefined ? undefined : entry.workflow;
}

/** Step 7 remainder: both endpoints of every edge must reference a node. */
function checkEdgeEndpoints(edges, nodeIndex, file, errors) {
  for (const edge of edges) {
    if (!nodeIndex.has(edge.from) || !nodeIndex.has(edge.to)) {
      errors.push(
        makeError(WORKFLOW_REASONS.WORKFLOW_EDGE_INVALID, file, null, null, {
          detail: 'endpoint',
          edge: `${edge.from}->${edge.to}`
        })
      );
      return;
    }
  }
}

/** Step 8: forward reachability from entry, then reachability to a terminal. */
function checkReachability(workflow, nodeIndex, file, errors) {
  const terminalIds = new Set(
    workflow.nodes
      .filter((node) => nodeTypeOf(node) === 'human' || nodeTypeOf(node) === 'escalate')
      .map((node) => node.id)
  );
  if (typeof workflow.terminal === 'string') terminalIds.add(workflow.terminal);

  const outgoing = new Map();
  for (const node of workflow.nodes) outgoing.set(node.id, []);
  for (const edge of workflow.edges) {
    const list = outgoing.get(edge.from);
    if (list !== undefined) list.push(edge.to);
  }

  const forward = new Set();
  const stack = [workflow.entry];
  while (stack.length > 0) {
    const current = stack.pop();
    if (forward.has(current)) continue;
    forward.add(current);
    for (const next of outgoing.get(current) ?? []) stack.push(next);
  }
  for (const node of workflow.nodes) {
    if (!forward.has(node.id)) {
      errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_UNREACHABLE, file, null, null, { node: node.id }));
      return;
    }
  }

  // Memoize only nodes PROVEN to settle: a failed branch must not mark its
  // side nodes as settled just because they were visited along the way.
  const settles = new Set();
  const canSettle = (current, path) => {
    if (settles.has(current)) return true;
    if (terminalIds.has(current)) {
      settles.add(current);
      return true;
    }
    if (path.has(current)) return false;
    path.add(current);
    for (const next of outgoing.get(current) ?? []) {
      if (canSettle(next, path)) {
        settles.add(current);
        path.delete(current);
        return true;
      }
    }
    path.delete(current);
    return false;
  };
  for (const node of workflow.nodes) {
    if (!canSettle(node.id, new Set())) {
      errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_UNREACHABLE, file, null, null, { node: node.id }));
      return;
    }
  }
}

/** Step 9: every backflow target must declare max_rounds. A non-role target
 * is step 12's business (BR-36), so the round limit is judged for role
 * targets only — this keeps AC-60's `errors[0]` on the transition code. */
function checkBackflowLimit(edges, nodeIndex, file, errors) {
  for (const edge of edges) {
    if (edge.kind !== 'backflow') continue;
    const target = nodeIndex.get(edge.to);
    if (target === undefined || nodeTypeOf(target) !== 'role') continue;
    if (!hasMaxRounds(target)) {
      errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_BACKFLOW_NO_LIMIT, file, null, null, { node: edge.to }));
      return;
    }
  }
}

/** Step 10: parallel groups need >= 2 nodes and unique product scopes. */
function checkParallelScopes(workflow, file, errors) {
  const groups = new Map();
  for (const node of workflow.nodes) {
    if (typeof node.parallel_scope !== 'string' || node.parallel_scope === '') continue;
    if (!groups.has(node.parallel_scope)) groups.set(node.parallel_scope, []);
    groups.get(node.parallel_scope).push(node);
  }
  for (const [name, members] of groups) {
    if (members.length < 2) {
      errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_SCOPE_INVALID, file, null, null, { scope: name }));
      continue;
    }
    const seen = new Map();
    for (const node of members) {
      const scope = effectiveScope(node);
      if (seen.has(scope)) {
        errors.push(
          makeError(WORKFLOW_REASONS.WORKFLOW_SCOPE_OVERLAP, file, null, null, {
            scope: name,
            a: seen.get(scope),
            b: node.id,
            name: scope
          })
        );
        return;
      }
      seen.set(scope, node.id);
    }
  }
}

/** Step 11: variable references and mapping completeness on forward edges. */
function checkVariablesAndMappings(edges, nodeIndex, file, errors) {
  let varIssue = null;
  let mappingIssue = null;
  for (const edge of edges) {
    if (edge.kind !== 'forward') continue;
    const source = nodeIndex.get(edge.from);
    const target = nodeIndex.get(edge.to);
    if (source === undefined || target === undefined) continue;
    const sourceOutputs = strArray(source.outputs);
    const targetInputs = strArray(target.inputs);
    const mappedTo = new Set();

    for (const item of Array.isArray(edge.map) ? edge.map : []) {
      if (varIssue === null) {
        varIssue = mapReferenceIssue(item, edge, nodeIndex, sourceOutputs, targetInputs);
      }
      mappedTo.add(item.to);
    }
    if (varIssue !== null) break;

    for (const field of targetInputs) {
      if (!(sourceOutputs.includes(field) || mappedTo.has(field))) {
        mappingIssue = { node: edge.to, field };
        break;
      }
    }
    if (mappingIssue !== null) break;
  }
  if (varIssue !== null) {
    errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_VAR_UNKNOWN, file, null, null, varIssue));
  }
  if (mappingIssue !== null) {
    errors.push(makeError(WORKFLOW_REASONS.WORKFLOW_MAPPING_INCOMPLETE, file, null, null, mappingIssue));
  }
}

function mapReferenceIssue(item, edge, nodeIndex, sourceOutputs, targetInputs) {
  const ref = typeof item.from === 'string' ? item.from : '';
  if (!REF_PATTERN.test(ref)) return { ref };
  const dot = ref.indexOf('.');
  const prefix = ref.slice(0, dot);
  const rest = ref.slice(dot + 1);
  if (prefix !== 'task') {
    // The prefix must be this edge's own upstream node and the field must be
    // one of its declared outputs (AC-35: a non-upstream node id is unknown).
    if (prefix !== edge.from || !nodeIndex.has(prefix) || !sourceOutputs.includes(rest)) {
      return { ref };
    }
  }
  if (!targetInputs.includes(item.to)) return { ref: item.to };
  return null;
}

/**
 * Step 12: the static transition matrix (BR-25 / BR-36).
 * - a `backflow` / `retest` edge may only target a `role` node
 * - the entry must not be re-entered by an unbounded backflow: an entry that
 *   declares `max_rounds` carries the bound (the second built-in graph does,
 *   A-8:1273), so only the unbounded shape reports `entryBackflow`
 * - an `escalate` node has no forward out edge
 * - a `human` node's out edges are forward edges with human conditions only
 */
function checkTransitions(workflow, nodeIndex, file, errors) {
  for (const edge of workflow.edges) {
    const source = nodeIndex.get(edge.from);
    const target = nodeIndex.get(edge.to);
    if (edge.kind === 'backflow' || edge.kind === 'retest') {
      if (target === undefined || nodeTypeOf(target) !== 'role') {
        errors.push(
          makeError(WORKFLOW_REASONS.WORKFLOW_TRANSITION_ILLEGAL, file, null, null, {
            reason: 'backflowTarget',
            node: edge.to
          })
        );
        return;
      }
      if (edge.kind === 'backflow' && edge.to === workflow.entry && !hasMaxRounds(target)) {
        errors.push(
          makeError(WORKFLOW_REASONS.WORKFLOW_TRANSITION_ILLEGAL, file, null, null, {
            reason: 'entryBackflow',
            node: edge.to
          })
        );
        return;
      }
    }
    if (edge.kind === 'forward' && source !== undefined && nodeTypeOf(source) === 'escalate') {
      errors.push(
        makeError(WORKFLOW_REASONS.WORKFLOW_TRANSITION_ILLEGAL, file, null, null, {
          reason: 'escalateForward',
          node: edge.from
        })
      );
      return;
    }
    if (
      source !== undefined &&
      nodeTypeOf(source) === 'human' &&
      (edge.kind !== 'forward' || !HUMAN_WHEN.includes(edge.when))
    ) {
      errors.push(
        makeError(WORKFLOW_REASONS.WORKFLOW_TRANSITION_ILLEGAL, file, null, null, {
          reason: 'humanCondition',
          node: edge.from
        })
      );
      return;
    }
  }
}

/** Step 13: wake permissions on forward edges between role nodes. */
function checkWakePermissions(edges, nodeIndex, roleById, file, errors) {
  for (const edge of edges) {
    if (edge.kind !== 'forward') continue;
    const source = nodeIndex.get(edge.from);
    const target = nodeIndex.get(edge.to);
    if (source === undefined || target === undefined) continue;
    if (nodeTypeOf(source) !== 'role' || nodeTypeOf(target) !== 'role') continue;
    const allow = effectiveWakeAllow(source, roleById);
    if (allow === undefined) continue;
    if (!allow.includes(target.role)) {
      errors.push(
        makeError(WORKFLOW_REASONS.WORKFLOW_WAKE_DENIED, file, null, null, {
          from: source.role,
          to: target.role
        })
      );
      return;
    }
  }
}

/** Stable per-file sort by the fixed C-09 step of each reason code. */
function sortByStep(errors) {
  return errors
    .map((error, index) => ({ error, index }))
    .sort((a, b) => {
      const delta = CODE_STEP[a.error.code] - CODE_STEP[b.error.code];
      return delta !== 0 ? delta : a.index - b.index;
    })
    .map((entry) => entry.error);
}

function fileOf(entry) {
  return entry.source === BUILTIN
    ? `${BUILTIN_FILE_PREFIX}${entry.workflow.id}`
    : entry.workflow.file;
}

/**
 * @param {{root?:string, builtinGraphs?:object, roles?:Array|Map|null,
 *          builtinNames?:object|null}} [options]
 * @returns {{ok:boolean, workflows:Array, workflowMap:Map, errors:Array,
 *            counts:{assets:number, builtin:number, project:number, invalid:number}}}
 */
export function loadWorkflows({ root, builtinGraphs = null, roles = null, builtinNames = null } = {}) {
  const base = root ?? process.cwd();

  // 1. built-in projection (C-10); display names are injected as plain data.
  const nameMap =
    builtinNames !== null && typeof builtinNames === 'object' ? { ...builtinNames } : null;
  const roleList = normalizeRoles(roles) ?? [];
  const roleNames = {};
  for (const role of roleList) {
    if (role && typeof role === 'object' && typeof role.id === 'string' && typeof role.name === 'string') {
      roleNames[role.id] = role.name;
    }
  }
  const builtins = projectBuiltinWorkflows(builtinGraphs, {
    names: nameMap,
    roleNames: roleList.length > 0 ? roleNames : null
  });

  // 2. project scan, then 3. merge: built-in by id, project overrides whole.
  //    The map key set is the validated asset set, so files that fail parse or
  //    shape still count towards `counts.assets` (D-3 step 5 of the counters).
  const merged = new Map();
  for (const workflow of builtins) merged.set(workflow.id, { source: BUILTIN, workflow });

  const dir = path.join(base, '.orch', 'workflows');
  const roleById = roles === null || roles === undefined ? null : roleIndexOf(roles);
  const roleIds = roleById === null ? null : new Set(roleById.keys());

  const errors = [];
  for (const fileId of listYamlFiles(dir)) {
    const text = readText(path.join(dir, `${fileId}.yaml`));
    if (text === null) continue;
    const file = `workflows/${fileId}.yaml`;
    const workflow = validateProjectWorkflow({ fileId, text }, file, errors);
    merged.set(fileId, { source: PROJECT, workflow });
  }

  // Every workflow (built-in projections included) participates in steps
  // 6 and 8..13 against the fully merged collection, so subworkflow
  // references resolve across sources and cycles are seen cross-file.
  for (const entry of merged.values()) {
    if (entry.workflow !== null) {
      validateGraphLevel(entry.workflow, fileOf(entry), roleIds, roleById, merged, errors);
    }
  }

  // 4. fixed output order: by file (stable), then the C-09 step order inside
  //    one file, then one entry per (file, code).
  const byFile = new Map();
  for (const error of errors) {
    if (!byFile.has(error.file)) byFile.set(error.file, []);
    byFile.get(error.file).push(error);
  }
  const ordered = [];
  for (const file of [...byFile.keys()].sort(compareText)) ordered.push(...sortByStep(byFile.get(file)));
  const seen = new Set();
  const uniqueErrors = ordered.filter((error) => {
    const key = `${error.file}\u0000${error.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const valid = [...merged.values()]
    .filter((entry) => entry.workflow !== null && !uniqueErrors.some((error) => error.file === fileOf(entry)))
    .map((entry) => entry.workflow)
    .sort((a, b) => compareText(fileOf({ source: a.source, workflow: a }), fileOf({ source: b.source, workflow: b })));

  const invalidFiles = new Set(uniqueErrors.map((error) => error.file));
  const builtinCount = [...merged.values()].filter((entry) => entry.source === BUILTIN).length;

  return {
    ok: uniqueErrors.length === 0,
    workflows: valid,
    workflowMap: new Map(valid.map((workflow) => [workflow.id, workflow])),
    errors: uniqueErrors,
    counts: {
      assets: merged.size,
      builtin: builtinCount,
      project: merged.size - builtinCount,
      invalid: invalidFiles.size
    }
  };
}

/** Parse + shape steps (1..5, 7) for one project file; appends to `errors`. */
function validateProjectWorkflow(candidate, file, errors) {
  const parsed = parseYaml(candidate.text);
  if (!parsed.ok) {
    errors.push(
      makeError('YAML_PARSE_FAILED', file, null, parsed.line, {
        line: parsed.line,
        detailKey: parsed.detailKey,
        detailParams: parsed.detailParams ?? {}
      })
    );
    return null;
  }
  const value =
    parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value) ? parsed.value : {};

  const shapeIssues = checkWorkflowShape(value, { fileId: candidate.fileId });
  for (const issue of shapeIssues) {
    errors.push(makeError(issue.code, file, issue.field, null, issue.params));
  }
  if (shapeIssues.length > 0) return null;

  return {
    schema: value.schema,
    id: value.id,
    name: value.name,
    summary: value.summary === undefined ? null : value.summary,
    entry: value.entry,
    terminal: value.terminal,
    nodes: value.nodes,
    edges: Array.isArray(value.edges) ? value.edges.map(normalizeEdge) : [],
    source: PROJECT,
    file
  };
}

/**
 * Graph-level checks (steps 6, 8..13) for one workflow. Runs only when the
 * shape steps passed, so node/edge structures can be trusted here. `merged`
 * carries the whole collection for subworkflow resolution.
 */
function validateGraphLevel(workflow, file, roleIds, roleById, merged, errors) {
  const nodeIndex = new Map();
  for (const node of workflow.nodes) {
    if (node && typeof node === 'object' && typeof node.id === 'string') nodeIndex.set(node.id, node);
  }

  const allIds = new Set(merged.keys());
  allIds.add(workflow.id);

  checkReferences(workflow, nodeIndex, allIds, roleIds, file, errors, merged);
  checkEdgeEndpoints(workflow.edges, nodeIndex, file, errors);

  const structural = errors.filter((error) => error.file === file && CODE_STEP[error.code] <= 7);
  if (structural.length > 0) return;

  checkReachability(workflow, nodeIndex, file, errors); // 8
  checkBackflowLimit(workflow.edges, nodeIndex, file, errors); // 9
  checkParallelScopes(workflow, file, errors); // 10
  checkVariablesAndMappings(workflow.edges, nodeIndex, file, errors); // 11
  checkTransitions(workflow, nodeIndex, file, errors); // 12
  checkWakePermissions(workflow.edges, nodeIndex, roleById, file, errors); // 13
}
