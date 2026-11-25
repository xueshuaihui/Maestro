/**
 * workflow/v1 -> engine graph adapter.
 *
 * Lives under `src/templates/**`, the only product directory allowed to spell
 * graph/role literals (AC-28 purity gate). The engine never learns a workflow
 * name: the daemon injects the graphs it loads from project assets.
 *
 * A workflow node is `{id, node_type:'role', role, title, ...}`; an engine node
 * is `{id, nodeId, roleId, order, title, artifactPolicy, judge, products,
 * wakeFrom, prompt}`. Project workflows are declarative DAGs, so they map to
 * a forward-only graph with one round per node and no backflow.
 */

import { checkWorkflowShape } from '../registry/workflow-schema.js';

function safeId(value, fallback) {
  const text = String(value ?? '');
  return /^[A-Za-z][A-Za-z0-9._-]*$/.test(text) ? text : fallback;
}

/**
 * @param {object} workflow a validated `workflow/v1` definition
 * @returns {{ok:true, graph:object} | {ok:false, code:string, params:object}}
 */
export function workflowToGraph(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    return { ok: false, code: 'WORKFLOW_GRAPH_INPUT_INVALID', params: {} };
  }
  const shape = checkWorkflowShape(workflow, { fileId: String(workflow.id ?? '') });
  if (shape.length > 0) {
    return { ok: false, code: 'WORKFLOW_GRAPH_INVALID', params: { errors: shape.map((e) => e.code ?? e) } };
  }
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  if (nodes.length === 0) return { ok: false, code: 'WORKFLOW_GRAPH_EMPTY', params: {} };

  const roleIds = [];
  const engineNodes = nodes.map((node, index) => {
    const id = safeId(node.id, `N-${String(index + 1).padStart(3, '0')}`);
    const roleId = safeId(node.role, `worker-${index + 1}`);
    if (!roleIds.includes(roleId)) roleIds.push(roleId);
    const wakeFrom = (workflow.edges ?? [])
      .filter((edge) => edge?.to === node.id)
      .map((edge) => String(edge.from ?? ''))
      .filter((v) => v.length > 0);
    return {
      id,
      nodeId: id,
      roleId,
      order: index + 1,
      title: typeof node.title === 'string' && node.title.length > 0 ? node.title : null,
      artifactPolicy: 'declared',
      judge: 'none',
      products: [],
      wakeFrom,
      prompt: 'forward'
    };
  });

  const ids = engineNodes.map((node) => node.id);
  const entry = ids.includes(workflow.entry) ? workflow.entry : ids[0];
  const terminal = ids.includes(workflow.terminal) ? workflow.terminal : ids[ids.length - 1];
  const maxRounds = {};
  for (const id of ids) maxRounds[id] = 1;

  const edges = (workflow.edges ?? [])
    .filter((edge) => edge && typeof edge.from === 'string' && typeof edge.to === 'string')
    .filter((edge) => ids.includes(edge.from) && ids.includes(edge.to))
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind === 'backflow' || edge.kind === 'retest' ? edge.kind : 'forward',
      condition: typeof edge.when === 'string' ? edge.when : (edge.condition ?? null)
    }));

  return {
    ok: true,
    graph: {
      id: safeId(workflow.id, 'project-workflow'),
      title: typeof workflow.name === 'string' && workflow.name.length > 0 ? workflow.name : workflow.id,
      showTemplate: false,
      entry,
      terminal,
      terminals: [terminal],
      maxRounds,
      roles: roleIds,
      nodes: engineNodes,
      edges
    }
  };
}

/**
 * Build the injected graph table: built-ins first, then project workflows.
 * Project ids never overwrite a built-in id, so the frozen default graphs stay
 * byte-identical (I1.1 red line).
 */
export function mergeProjectGraphs(builtinGraphs, workflows = []) {
  const out = { ...(builtinGraphs ?? {}) };
  for (const workflow of Array.isArray(workflows) ? workflows : []) {
    if (!workflow || typeof workflow !== 'object') continue;
    const id = String(workflow.id ?? '');
    if (id.length === 0 || Object.prototype.hasOwnProperty.call(out, id)) continue;
    const converted = workflowToGraph(workflow);
    if (converted.ok) out[id] = converted.graph;
  }
  return out;
}
