/**
 * `orch workflow list|show|create|validate|diff|dry-run` (split doc 2.11, WP-8).
 *
 * Discipline (mirrors `roles.js` / `skills.js`):
 * 1. Zero CJK in this file (D-9 / AC-51). Every sentence comes from `labels.js`
 *    (`WORKFLOW_CLI_TEXT`, `WORKFLOW_REASON_TEXT`, `WORKFLOW_TRANSITION_TEXT`,
 *    `REGISTRY_ERROR`, `YAML_DETAIL`); machine details are assembled here, the
 *    line layout stays with `render.js`.
 * 2. `--format json` bypasses the renderers and `JSON.stringify`s directly
 *    (A-14 key sets are pinned per command below).
 * 3. The only disk write is `workflow create`, through `asset-write.js`'s
 *    `serializeWorkflow` + `atomicWrite` (C-04). Both write gates replay the
 *    loader's full C-09 order and never touch the real tree: gate A reads the
 *    live collection (an illegal file cannot be covered even with `--force`,
 *    AC-40 third leg), gate B re-runs `loadWorkflows` over a throwaway mirror
 *    of `.orch/workflows` under `os.tmpdir()` with the candidate in place.
 *    `--force` never skips a verdict (BR-07 / BR-08 / C-05).
 * 4. Read-only commands never call `ctx.createClient` and never create `.orch`
 *    (AC-45 / BR-30); `dry-run` is a pure `planWorkflow` replay (C-12 / AC-41):
 *    no instances, no core file, no sessions, byte-identical across runs.
 * 5. Usage-level checks live in `parseArgs` (WP-5) and are not repeated here.
 * 6. `GRAPHS` is consumed read-only (R-1 / C-10); built-in display names come
 *    from `TEMPLATE_LABEL` and role display names from the registry, so no
 *    concrete asset literal ever appears here (BR-31).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadRegistry } from '../registry/index.js';
import { loadWorkflows, projectBuiltinWorkflows } from '../registry/workflows.js';
import { planWorkflow } from '../registry/workflow-plan.js';
import { WORKFLOW_SCHEMA_VERSION } from '../registry/workflow-schema.js';
import { parseYaml } from '../registry/yaml-lite.js';
import { serializeWorkflow, atomicWrite } from '../registry/asset-write.js';
import { GRAPHS } from '../templates/index.js';
import * as render from './render.js';
import {
  REGISTRY_ERROR,
  TEMPLATE_LABEL,
  WORKFLOW_CLI_TEXT,
  WORKFLOW_REASON_TEXT,
  WORKFLOW_TRANSITION_TEXT,
  YAML_DETAIL
} from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

const PROJECT_FILE_PREFIX = '.orch/workflows/';

/**
 * `WORKFLOW_TRANSITION_ILLEGAL` reason keys of the loader mapped onto the
 * `WORKFLOW_TRANSITION_TEXT` slots of `labels.js` (A-15 fixed sentences).
 */
const TRANSITION_DETAIL_KEY = Object.freeze({
  entryBackflow: 'entryBackflow',
  escalateForward: 'escalateOutbound',
  humanCondition: 'humanEdgeCondition',
  backflowTarget: 'backflowTarget'
});

/** `{name}` substitution; absent values become empty strings, never `undefined`. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- details

/**
 * One loader / shape error -> its human detail (A-15). `YAML_PARSE_FAILED`
 * needs the nested `YAML_DETAIL` phrase first; the transition code picks one
 * of the four fixed sentences; the sub-cycle chain drops the repeated tail
 * before joining, same convention as the role side.
 */
function workflowDetailOf(err) {
  const code = err?.code;
  const params = { ...(err?.params ?? {}) };
  if (code === 'YAML_PARSE_FAILED') {
    params.detail = fill(YAML_DETAIL[params.detailKey] ?? '', params.detailParams ?? {});
    if (params.line === undefined || params.line === null) params.line = err?.line ?? null;
    return fill(REGISTRY_ERROR.YAML_PARSE_FAILED, params);
  }
  if (code === 'WORKFLOW_TRANSITION_ILLEGAL') {
    const slot = TRANSITION_DETAIL_KEY[params.reason] ?? params.reason;
    params.detail = fill(WORKFLOW_TRANSITION_TEXT[slot] ?? '', params);
  }
  if (code === 'WORKFLOW_SUB_CYCLE' && Array.isArray(params.chain)) {
    const chain = params.chain;
    const open =
      chain.length > 1 && chain[0] === chain[chain.length - 1] ? chain.slice(0, -1) : chain;
    params.chain = open.join(' → ');
  }
  if (code === 'WORKFLOW_EDGE_INVALID') {
    if (params.value !== undefined) params.detail = `${params.detail}: ${params.value}`;
    else if (params.edge !== undefined) params.detail = `${params.detail}: ${params.edge}`;
  }
  const template = WORKFLOW_REASON_TEXT[code];
  return template === undefined ? String(code ?? '') : fill(template, params);
}

function rejectedLine(err) {
  return fill(WORKFLOW_CLI_TEXT.createRejected, {
    detail: workflowDetailOf(err),
    code: err?.code ?? ''
  });
}

// ---------------------------------------------------------------- collection

/**
 * The workflow universe of one project root: built-in projections merged with
 * `.orch/workflows/*.yaml`, validated in the fixed C-09 order with the role
 * assets injected (step 6 references and step 13 wake permissions need them).
 */
function loadCollection(cwd) {
  const registry = loadRegistry({ root: cwd });
  const workflows = loadWorkflows({
    root: cwd,
    builtinGraphs: GRAPHS,
    roles: registry.roles,
    builtinNames: TEMPLATE_LABEL
  });
  return { registry, workflows };
}

/** The three read-only built-in projections, as diff baselines. */
function builtinBaselines(registry) {
  const roleNames = {};
  for (const role of registry.roles) {
    if (typeof role?.id === 'string' && typeof role?.name === 'string') {
      roleNames[role.id] = role.name;
    }
  }
  return projectBuiltinWorkflows(GRAPHS, { names: TEMPLATE_LABEL, roleNames });
}

// ---------------------------------------------------------------- json / rows

/** A-14 list row object: six keys, `file` is null for built-ins. */
function workflowJson(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    nodeCount: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
    edgeCount: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
    source: workflow.source,
    file: workflow.source === 'project' ? PROJECT_FILE_PREFIX + `${workflow.id}.yaml` : null
  };
}

/** A-14 show node object: eleven keys (`nodeType` camelCase, A-14), plus
 * `workflow` on subworkflow nodes (AC-24). */
function nodeJson(node) {
  return {
    id: node.id,
    nodeType: node.node_type,
    role: node.role ?? null,
    title: node.title ?? null,
    timeout: node.timeout ?? null,
    retry: node.retry ?? 0,
    maxRounds: node.max_rounds ?? null,
    parallelScope: node.parallel_scope ?? null,
    scope: node.scope ?? node.id,
    inputs: Array.isArray(node.inputs) ? node.inputs.slice() : [],
    outputs: Array.isArray(node.outputs) ? node.outputs.slice() : [],
    ...(node.node_type === 'subworkflow' ? { workflow: node.workflow ?? null } : {})
  };
}

/** A-14 show edge object: five keys, `map` items reduced to `{from, to}`. */
function edgeJson(edge) {
  return {
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    when: edge.when ?? 'always',
    map: Array.isArray(edge.map)
      ? edge.map.map((item) => ({ from: item?.from ?? null, to: item?.to ?? null }))
      : []
  };
}

/** The contract row slots (`listRow`): byte-identical between list and show (A-8). */
function rowSlots(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    nodes: Array.isArray(workflow.nodes) ? workflow.nodes.length : 0,
    edges: Array.isArray(workflow.edges) ? workflow.edges.length : 0,
    source: workflow.source === 'project' ? WORKFLOW_CLI_TEXT.sourceProject : WORKFLOW_CLI_TEXT.sourceBuiltin
  };
}

/** D-5 step 6 landing point: the node count of a referenced workflow. */
function subNodeCountOf(ref, workflowMap) {
  const target = typeof ref === 'string' ? workflowMap.get(ref) : undefined;
  return Array.isArray(target?.nodes) ? target.nodes.length : 0;
}

/** Node slots for `renderWorkflowShow` / `renderWorkflowDryRun` (camelCase). */
function nodeSlots(workflow, workflowMap) {
  return {
    id: workflow.id,
    title: workflow.title ?? null,
    nodeType: workflow.node_type,
    role: workflow.role ?? null,
    workflow: workflow.workflow ?? null,
    subNodeCount:
      workflow.node_type === 'subworkflow' ? subNodeCountOf(workflow.workflow, workflowMap) : 0,
    parallelScope: workflow.parallel_scope ?? null,
    timeout: workflow.timeout ?? null,
    retry: workflow.retry ?? null
  };
}

// ---------------------------------------------------------------- list / show

function listWorkflows({ collection, format, out }) {
  const rows = collection.workflows.workflows;
  const counts = {
    total: rows.length,
    builtin: rows.filter((workflow) => workflow.source === 'builtin').length,
    project: rows.filter((workflow) => workflow.source === 'project').length,
    invalid: collection.workflows.counts.invalid
  };
  if (format === 'json') {
    out(JSON.stringify({ counts, workflows: rows.map(workflowJson) }, null, 2));
  } else {
    for (const line of render.renderWorkflowList({
      counts,
      rows: rows.map((workflow) => {
        const json = workflowJson(workflow);
        return {
          id: json.id,
          name: json.name,
          nodeCount: json.nodeCount,
          edgeCount: json.edgeCount,
          source: json.source
        };
      })
    })) {
      out(line);
    }
  }
  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

function notFound(out, id) {
  out(fill(WORKFLOW_CLI_TEXT.notFoundWorkflow, { id }));
  out(WORKFLOW_CLI_TEXT.notFoundWorkflowHint);
  return EXIT_FAILED;
}

function showWorkflow({ collection, format, out, id }) {
  const { workflows } = collection;
  const workflow = workflows.workflowMap.get(id);
  if (workflow === undefined) return notFound(out, id);

  if (format === 'json') {
    out(
      JSON.stringify(
        {
          workflow: { ...workflowJson(workflow), entry: workflow.entry, terminal: workflow.terminal },
          nodes: workflow.nodes.map(nodeJson),
          edges: workflow.edges.map(edgeJson)
        },
        null,
        2
      )
    );
    return EXIT_OK;
  }

  const nodeIndex = new Map(workflow.nodes.map((node) => [node.id, node]));
  const slots = workflow.nodes.map((node) => nodeSlots(node, workflows.workflowMap));
  const edges = workflow.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    when: edge.when ?? 'always',
    // A-8: the round limit of a backflow edge comes from the edge itself or
    // from the target node's `max_rounds` (the built-in projection stores it
    // on the node); a missing limit prints the dash.
    rounds: edge.max_rounds ?? nodeIndex.get(edge.to)?.max_rounds ?? null,
    mapCount: Array.isArray(edge.map) ? edge.map.length : 0
  }));
  for (const line of render.renderWorkflowShow({
    row: fill(WORKFLOW_CLI_TEXT.listRow, rowSlots(workflow)),
    entry: workflow.entry,
    terminal: workflow.terminal,
    nodes: slots,
    edges
  })) {
    out(line);
  }
  return EXIT_OK;
}

// ---------------------------------------------------------------- validate

/** True when the error belongs to the scoped id (project file or built-in row). */
function scopedErrorOf(err, id) {
  return err.file === `workflows/${id}.yaml` || err.file.endsWith(` ${id}`);
}

function validateWorkflows({ collection, format, out, only }) {
  const { workflows } = collection;
  let errors = workflows.errors;
  let counts = { ...workflows.counts };

  if (only !== null) {
    errors = workflows.errors.filter((err) => scopedErrorOf(err, only));
    const workflow = workflows.workflowMap.get(only);
    if (workflow === undefined && errors.length === 0) return notFound(out, only);
    // AC-29: validating one named workflow counts that workflow alone.
    const projectFile = `workflows/${only}.yaml`;
    const isBuiltin =
      workflow !== undefined ? workflow.source === 'builtin' : !errors.some((err) => err.file === projectFile);
    counts = {
      assets: 1,
      builtin: isBuiltin ? 1 : 0,
      project: isBuiltin ? 0 : 1,
      invalid: errors.length > 0 ? 1 : 0
    };
  }

  if (format === 'json') {
    out(
      JSON.stringify(
        {
          counts,
          errors: errors.map((err) => ({
            code: err.code,
            file: err.file,
            scope: err.scope,
            field: err.field,
            line: err.line,
            detail: workflowDetailOf(err)
          }))
        },
        null,
        2
      )
    );
  } else {
    for (const line of render.renderWorkflowValidate({
      counts,
      rows: errors.map((err) => ({ file: err.file, detail: workflowDetailOf(err), code: err.code }))
    })) {
      out(line);
    }
  }
  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

// ---------------------------------------------------------------- create

/**
 * Write-gate B: the candidate must pass the loader's full C-09 order. The
 * verdict is produced by `loadWorkflows` itself over a throwaway mirror of the
 * project's workflow directory (real project files copied as-is, the candidate
 * written over its own name), so no second judgement exists (D-4). The mirror
 * lives in `os.tmpdir()` and is always removed; the real tree is never touched.
 * An id that is not a safe file name is mirrored under a neutral name, which
 * makes the loader's id-vs-file-name step reject it before any real write.
 */
function sandboxVerdict({ candidate, id, cwd, roles }) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'i16-wf-'));
  try {
    const dir = path.join(sandbox, '.orch', 'workflows');
    fs.mkdirSync(dir, { recursive: true });
    const realDir = path.join(cwd, '.orch', 'workflows');
    let names = [];
    try {
      names = fs.readdirSync(realDir);
    } catch {
      names = [];
    }
    for (const name of names) {
      if (!name.endsWith('.yaml')) continue;
      const text = readText(path.join(realDir, name));
      if (text !== null) fs.writeFileSync(path.join(dir, name), text, 'utf8');
    }
    const safeName = /^[a-z][a-z0-9-]*$/.test(id) ? id : 'wf';
    fs.writeFileSync(path.join(dir, `${safeName}.yaml`), serializeWorkflow(candidate), 'utf8');
    const result = loadWorkflows({
      root: sandbox,
      builtinGraphs: GRAPHS,
      roles,
      builtinNames: TEMPLATE_LABEL
    });
    return result.errors.filter((err) => err.file === `workflows/${safeName}.yaml`);
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}

async function createWorkflow({ collection, flags, out, id, cwd }) {
  const { registry, workflows } = collection;

  // AC-40: an existing target file is refused first, with or without --force.
  const target = path.join(cwd, '.orch', 'workflows', `${id}.yaml`);
  if (flags.force !== true && fs.existsSync(target)) {
    out(fill(WORKFLOW_CLI_TEXT.exists, { file: `${PROJECT_FILE_PREFIX}${id}.yaml` }));
    return EXIT_FAILED;
  }

  // Gate A: covering an illegal file stays rejected even with --force (AC-40
  // third leg: the covered content must itself validate, bytes stay unchanged).
  const covering = workflows.errors.filter((err) => err.file === `workflows/${id}.yaml`);
  if (covering.length > 0) {
    out(rejectedLine(covering[0]));
    return EXIT_FAILED;
  }

  let candidate;
  if (typeof flags.from === 'string') {
    const source = workflows.workflowMap.get(flags.from);
    if (source === undefined) return notFound(out, flags.from);
    // B-06: the whole definition body plus the strategy fields are copied;
    // identity keys (`id`) and display keys (`name`) come from the arguments.
    candidate = {
      schema: source.schema,
      id,
      name: flags.name,
      summary: source.summary ?? null,
      entry: source.entry,
      terminal: source.terminal,
      nodes: structuredClone(source.nodes),
      edges: structuredClone(source.edges)
    };
  } else {
    // Without a derive source the smallest legal shape is one endpoint-only
    // node titled by `--name` (BR-35: an endpoint node may have no out edges).
    candidate = {
      schema: WORKFLOW_SCHEMA_VERSION,
      id,
      name: flags.name,
      summary: null,
      entry: 'T-001',
      terminal: 'T-001',
      nodes: [{ id: 'T-001', node_type: 'human', title: flags.name }],
      edges: []
    };
  }

  const issues = sandboxVerdict({ candidate, id, cwd, roles: registry.roles });
  if (issues.length > 0) {
    out(rejectedLine(issues[0]));
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target, text: serializeWorkflow(candidate) });
  if (!written.ok) {
    out(fill(WORKFLOW_CLI_TEXT.createRejected, { detail: written.code, code: written.code }));
    return EXIT_FAILED;
  }
  out(fill(WORKFLOW_CLI_TEXT.created, { file: `${PROJECT_FILE_PREFIX}${id}.yaml` }));
  out(WORKFLOW_CLI_TEXT.checkPassed);
  return EXIT_OK;
}

// ---------------------------------------------------------------- diff

/**
 * BR-37 field paths: the definition body only (`summary` / `entry` /
 * `terminal` / `nodes` / `edges`); `schema` / `id` / `name` never compare.
 * Nodes and edges pair by index; a missing key joins at its default
 * (`retry` 0, `scope` the node id, `kind`/`when`/`join` their closed-set
 * defaults, arrays and texts null when absent).
 */
const NODE_DIFF_KEYS = Object.freeze([
  'id',
  'node_type',
  'role',
  'workflow',
  'title',
  'timeout',
  'retry',
  'max_rounds',
  'parallel_scope',
  'scope',
  'inputs',
  'outputs'
]);
const EDGE_DIFF_KEYS = Object.freeze(['from', 'to', 'kind', 'when', 'join', 'max_rounds']);
const MAP_DIFF_KEYS = Object.freeze(['from', 'to']);

function stringArraySlot(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')
    ? value.slice()
    : null;
}

function normalizeNodeForDiff(node) {
  const source = node !== null && typeof node === 'object' ? node : {};
  return {
    id: source.id ?? null,
    node_type: source.node_type ?? source.nodeType ?? null,
    role: source.role ?? null,
    workflow: source.workflow ?? null,
    title: source.title ?? null,
    timeout: source.timeout ?? null,
    retry: source.retry ?? 0,
    max_rounds: source.max_rounds ?? null,
    parallel_scope: source.parallel_scope ?? source.parallelScope ?? null,
    scope: source.scope ?? source.id ?? null,
    inputs: stringArraySlot(source.inputs),
    outputs: stringArraySlot(source.outputs)
  };
}

function normalizeEdgeForDiff(edge) {
  const source = edge !== null && typeof edge === 'object' ? edge : {};
  return {
    from: source.from ?? null,
    to: source.to ?? null,
    kind: source.kind ?? 'forward',
    when: source.when ?? 'always',
    join: source.join ?? 'all',
    max_rounds: source.max_rounds ?? null,
    map: Array.isArray(source.map)
      ? source.map.map((item) => ({ from: item?.from ?? null, to: item?.to ?? null }))
      : []
  };
}

function diffChanges(base, target) {
  const changes = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const push = (field, a, b) => {
    if (same(a, b)) return;
    changes.push({
      field,
      kind: a === null ? 'added' : b === null ? 'removed' : 'changed',
      base: a,
      target: b
    });
  };

  const topOf = (workflow, key) => {
    const value = workflow?.[key];
    return value === undefined || value === '' ? null : value;
  };
  for (const key of ['summary', 'entry', 'terminal']) {
    push(key, topOf(base, key), topOf(target, key));
  }

  const baseNodes = (Array.isArray(base?.nodes) ? base.nodes : []).map(normalizeNodeForDiff);
  const targetNodes = (Array.isArray(target?.nodes) ? target.nodes : []).map(normalizeNodeForDiff);
  for (let i = 0; i < Math.max(baseNodes.length, targetNodes.length); i += 1) {
    const b = baseNodes[i];
    const t = targetNodes[i];
    if (b === undefined || t === undefined) {
      const present = b ?? t;
      const kind = b !== undefined ? 'removed' : 'added';
      for (const key of NODE_DIFF_KEYS) {
        if (present[key] === null) continue;
        changes.push({
          field: `nodes[${i}].${key}`,
          kind,
          base: b?.[key] ?? null,
          target: t?.[key] ?? null
        });
      }
      continue;
    }
    for (const key of NODE_DIFF_KEYS) push(`nodes[${i}].${key}`, b[key], t[key]);
  }

  const baseEdges = (Array.isArray(base?.edges) ? base.edges : []).map(normalizeEdgeForDiff);
  const targetEdges = (Array.isArray(target?.edges) ? target.edges : []).map(normalizeEdgeForDiff);
  for (let i = 0; i < Math.max(baseEdges.length, targetEdges.length); i += 1) {
    const b = baseEdges[i];
    const t = targetEdges[i];
    if (b === undefined || t === undefined) {
      const present = b ?? t;
      const kind = b !== undefined ? 'removed' : 'added';
      for (const key of EDGE_DIFF_KEYS) {
        if (present[key] === null) continue;
        changes.push({
          field: `edges[${i}].${key}`,
          kind,
          base: b?.[key] ?? null,
          target: t?.[key] ?? null
        });
      }
      for (let j = 0; j < present.map.length; j += 1) {
        for (const key of MAP_DIFF_KEYS) {
          if (present.map[j][key] === null) continue;
          changes.push({
            field: `edges[${i}].map[${j}].${key}`,
            kind,
            base: b?.map[j]?.[key] ?? null,
            target: t?.map[j]?.[key] ?? null
          });
        }
      }
      continue;
    }
    for (const key of EDGE_DIFF_KEYS) push(`edges[${i}].${key}`, b[key], t[key]);
    for (let j = 0; j < Math.max(b.map.length, t.map.length); j += 1) {
      const bj = b.map[j];
      const tj = t.map[j];
      if (bj === undefined || tj === undefined) {
        const present = bj ?? tj;
        const kind = bj !== undefined ? 'removed' : 'added';
        for (const key of MAP_DIFF_KEYS) {
          if (present[key] === null) continue;
          changes.push({
            field: `edges[${i}].map[${j}].${key}`,
            kind,
            base: bj?.[key] ?? null,
            target: tj?.[key] ?? null
          });
        }
        continue;
      }
      for (const key of MAP_DIFF_KEYS) push(`edges[${i}].map[${j}].${key}`, bj[key], tj[key]);
    }
  }

  return changes;
}

function parsedWorkflowFile(cwd, fileArg) {
  const text = readText(path.resolve(cwd, fileArg));
  if (text === null) return null;
  const parsed = parseYaml(text);
  return parsed.ok &&
    parsed.value !== null &&
    typeof parsed.value === 'object' &&
    !Array.isArray(parsed.value)
    ? parsed.value
    : null;
}

function diffWorkflow({ collection, flags, format, out, id, cwd }) {
  const { registry, workflows } = collection;
  const target = workflows.workflowMap.get(id);
  if (target === undefined) return notFound(out, id);

  const builtins = builtinBaselines(registry);
  const against = typeof flags.against === 'string' ? flags.against : null;
  let base = null;
  let baseLabel = null;
  let baseSource = 'builtin';

  if (against !== null) {
    const builtinBase = builtins.find((workflow) => workflow.id === against);
    if (builtinBase !== undefined) {
      base = builtinBase;
      baseLabel = against;
    } else {
      const projectBase = workflows.workflowMap.get(against);
      if (projectBase !== undefined) {
        base = projectBase;
        baseLabel = against;
        baseSource = projectBase.source;
      } else {
        const fileBase = parsedWorkflowFile(cwd, against);
        if (fileBase !== null) {
          base = fileBase;
          baseLabel = against;
          baseSource = 'project';
        }
      }
    }
    if (base === null) {
      out(fill(WORKFLOW_CLI_TEXT.missingBaseline, { id }));
      return EXIT_FAILED;
    }
  } else {
    // Default baseline: the same-name built-in original (a project override
    // shadows it in the merged map, so the projection list is consulted).
    const sameName = builtins.find((workflow) => workflow.id === id);
    if (sameName !== undefined) {
      base = sameName;
      baseLabel = id;
    } else {
      // An untouched derive has no same-name baseline; §2.10 lets it diff
      // against the built-in whose definition body it still matches.
      const identical = builtins.find(
        (workflow) => diffChanges(workflow, target).length === 0
      );
      if (identical !== undefined) {
        base = identical;
        baseLabel = identical.id;
      }
    }
    if (base === null) {
      out(fill(WORKFLOW_CLI_TEXT.missingBaseline, { id }));
      return EXIT_FAILED;
    }
  }

  const changes = diffChanges(base, target);
  if (format === 'json') {
    out(JSON.stringify({ base: baseLabel, target: id, changes }, null, 2));
    return EXIT_OK;
  }
  for (const line of render.renderWorkflowDiff({
    id,
    idSource: target.source,
    base: baseLabel,
    baseSource,
    changes
  })) {
    out(line);
  }
  return EXIT_OK;
}

// ---------------------------------------------------------------- dry-run

/**
 * A-10 fan-in condition per layer: the `join` of the forward edges that land
 * in the layer's nodes; the closed-set default (`all`) when none declares one.
 */
function layerJoins(plan, workflow) {
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
  return plan.layers.map((layer) => {
    if (layer?.parallel !== true || !Array.isArray(layer.nodes)) return 'all';
    let join = 'all';
    for (const edge of edges) {
      if (edge.kind !== 'forward') continue;
      if (!layer.nodes.includes(edge.to)) continue;
      if (edge.join === 'any') {
        join = 'any';
        break;
      }
    }
    return join;
  });
}

function dryRunWorkflow({ collection, format, out, id, task }) {
  const { workflows } = collection;
  const workflow = workflows.workflowMap.get(id);
  if (workflow === undefined) {
    // AC-42: an illegal workflow is refused up front, with the first scoped
    // detail and no plan line at all.
    const scoped = workflows.errors.filter((err) => scopedErrorOf(err, id));
    if (scoped.length > 0) {
      out(fill(WORKFLOW_CLI_TEXT.plan.rejected, { detail: workflowDetailOf(scoped[0]), code: scoped[0].code }));
      out(WORKFLOW_CLI_TEXT.plan.rejectedHint);
      return EXIT_FAILED;
    }
    return notFound(out, id);
  }

  const plan = planWorkflow({ workflow, task });
  if (format === 'json') {
    // A-14: exactly the frozen eight-key plan shape.
    out(JSON.stringify(plan, null, 2));
    return EXIT_OK;
  }
  const slots = workflow.nodes.map((node) => nodeSlots(node, workflows.workflowMap));
  for (const line of render.renderWorkflowDryRun({
    plan,
    nodes: slots,
    joins: layerJoins(plan, workflow)
  })) {
    out(line);
  }
  return EXIT_OK;
}

// ---------------------------------------------------------------- dispatch

/**
 * @param {{command:'workflow', sub:string, positional:string|null, flags:object}} parsed
 * @param {{cwd:string, out:(line:string)=>void, createClient:Function, now?:Function}} ctx
 * @returns {Promise<number>} 0 ok / 1 bad assets or target missing / 2 usage
 */
export async function workflowCommand(parsed, ctx) {
  const out = ctx.out;
  const flags = parsed.flags ?? {};
  const format = flags.format ?? 'text';
  const collection = loadCollection(ctx.cwd);
  const positional = typeof parsed.positional === 'string' ? parsed.positional : '';
  const only = positional.length > 0 ? positional : null;

  switch (parsed.sub) {
    case 'list':
      return listWorkflows({ collection, format, out });
    case 'show':
      return showWorkflow({ collection, format, out, id: positional });
    case 'create':
      return createWorkflow({ collection, flags, out, id: positional, cwd: ctx.cwd });
    case 'validate':
      return validateWorkflows({ collection, format, out, only });
    case 'diff':
      return diffWorkflow({ collection, flags, format, out, id: positional, cwd: ctx.cwd });
    case 'dry-run':
      return dryRunWorkflow({
        collection,
        format,
        out,
        id: positional,
        task: typeof flags.task === 'string' ? flags.task : ''
      });
    default:
      // Unreachable: `parseArgs` rejects unknown subs before dispatch (WP-5).
      out(render.renderUsage(WORKFLOW_CLI_TEXT.notImplemented));
      return EXIT_USAGE;
  }
}
