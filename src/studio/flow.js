/**
 * A4 — workflow authoring: the built-in 12-stage R&D template plus arbitrary DAGs.
 *
 * The built-in template is *one* shipped scenario (baseline §6), not the product
 * boundary: `createFlow` accepts any stage/edge set the DAG validator agrees
 * with, and `validateFlow` is the only gate used by both paths.
 */

import { GATE_KINDS, RUN_MODES, fail, isId, stageLabelKey, artifactLabelKey, slugify } from './schema.js';
import { findById, indexBy } from './store.js';

/** Stage ids are `s01..s12` so the label key is derivable without a table. */
function stage(index, roleCodes, extra = {}) {
  return {
    id: `s${String(index).padStart(2, '0')}`,
    titleKey: stageLabelKey(index),
    roleCodes,
    parallel: roleCodes.length > 1,
    gate: null,
    artifacts: [],
    ...extra
  };
}

/**
 * The 12 stages from the user's scenario document, condensed to one stage per
 * phase. Gates land on the three points the baseline names: PRD freeze,
 * architecture confirmation, release approval.
 */
export function buildRd12() {
  const stages = [
    stage(1, ['product-lead', 'product-analyst', 'user-researcher', 'competitor-analyst'], {
      artifacts: ['prd', 'research-notes']
    }),
    stage(2, ['product-reviewer', 'eng-lead', 'tech-reviewer', 'qa-lead', 'security-reviewer'], {
      gate: 'prd-freeze',
      artifacts: ['prd-review', 'issue-list']
    }),
    stage(3, ['architect', 'frontend-lead', 'backend-lead', 'data-architect'], {
      artifacts: ['architecture', 'api-contract', 'data-model']
    }),
    stage(4, ['tech-reviewer', 'frontend-reviewer', 'backend-reviewer', 'qa-lead'], {
      gate: 'arch-confirm',
      artifacts: ['arch-review', 'risk-list']
    }),
    stage(5, ['eng-lead'], { artifacts: ['iteration-plan', 'task-breakdown'] }),
    stage(6, ['frontend-dev', 'backend-dev'], { artifacts: ['code', 'unit-tests'] }),
    stage(7, ['backend-dev', 'frontend-dev'], { artifacts: ['integration-report'] }),
    stage(8, ['qa-lead', 'qa-functional', 'qa-api', 'qa-automation', 'qa-performance', 'qa-security'], {
      artifacts: ['test-plan', 'test-report']
    }),
    stage(9, ['eng-lead', 'backend-dev', 'frontend-dev'], { artifacts: ['defect-list', 'fix-record'] }),
    stage(10, ['qa-lead', 'product-lead', 'eng-lead'], { artifacts: ['acceptance-report'] }),
    stage(11, ['devops', 'security-reviewer'], { gate: 'release-approve', artifacts: ['release-record', 'smoke-report'] }),
    stage(12, ['eng-lead', 'product-lead'], { artifacts: ['retrospective', 'next-iteration-plan'] })
  ];
  const edges = [
    ['s01', 's02'], ['s02', 's03'], ['s03', 's04'], ['s04', 's05'], ['s05', 's06'],
    ['s06', 's07'], ['s07', 's08'], ['s08', 's09'], ['s08', 's10'], ['s09', 's10'],
    ['s10', 's11'], ['s11', 's12']
  ].map(([from, to]) => ({ from, to }));
  return {
    id: 'rd-12',
    name: '',
    titleKey: 'STUDIO_FLOW_RD12',
    kind: 'builtin',
    runMode: 'semi',
    gates: ['prd-freeze', 'arch-confirm', 'release-approve'],
    stages,
    edges
  };
}

/** Role codes a flow needs, de-duplicated in first-seen order. */
export function flowRoleCodes(flow) {
  const seen = new Set();
  for (const stage of flow?.stages ?? []) {
    for (const code of stage.roleCodes ?? []) seen.add(code);
  }
  return [...seen];
}

/** Kahn topological order; returns null when the graph has a cycle. */
export function topoOrder(flow) {
  const stages = flow?.stages ?? [];
  const ids = stages.map((s) => s.id);
  const indeg = new Map(ids.map((id) => [id, 0]));
  const out = new Map(ids.map((id) => [id, []]));
  for (const edge of flow?.edges ?? []) {
    if (!indeg.has(edge.from) || !indeg.has(edge.to)) continue;
    indeg.set(edge.to, indeg.get(edge.to) + 1);
    out.get(edge.from).push(edge.to);
  }
  const queue = ids.filter((id) => indeg.get(id) === 0);
  const order = [];
  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    for (const next of out.get(id)) {
      indeg.set(next, indeg.get(next) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  return order.length === ids.length ? order : null;
}

/**
 * @param {object} flow
 * @param {{roleIds?:Set<string>, roleCodes?:Set<string>}} [scope]
 * @returns {{ok:boolean, errors:Array}}
 */
export function validateFlow(flow, scope = {}) {
  const errors = [];
  const stages = Array.isArray(flow?.stages) ? flow.stages : [];
  if (stages.length === 0) errors.push({ code: 'STUDIO_FLOW_EMPTY' });
  const ids = new Set();
  for (const s of stages) {
    if (!isId(s.id)) errors.push({ code: 'STUDIO_FLOW_STAGE_ID_INVALID', params: { stage: String(s.id) } });
    if (ids.has(s.id)) errors.push({ code: 'STUDIO_FLOW_STAGE_DUPLICATE', params: { stage: s.id } });
    ids.add(s.id);
    const codes = Array.isArray(s.roleCodes) ? s.roleCodes : [];
    if (codes.length === 0) errors.push({ code: 'STUDIO_FLOW_STAGE_NO_ROLE', params: { stage: s.id } });
    if (s.gate !== null && s.gate !== undefined && !GATE_KINDS.includes(s.gate)) {
      errors.push({ code: 'STUDIO_FLOW_GATE_UNKNOWN', params: { stage: s.id, gate: String(s.gate) } });
    }
  }
  const edges = Array.isArray(flow?.edges) ? flow.edges : [];
  for (const edge of edges) {
    if (!ids.has(edge?.from) || !ids.has(edge?.to)) {
      errors.push({ code: 'STUDIO_FLOW_EDGE_INVALID', params: { from: String(edge?.from), to: String(edge?.to) } });
    }
  }
  if (errors.length === 0 && topoOrder(flow) === null) errors.push({ code: 'STUDIO_FLOW_CYCLE' });
  // Entry stages must exist: a DAG where every stage has an incoming edge can
  // never start.
  if (errors.length === 0) {
    const incoming = new Set(edges.map((e) => e.to));
    if (![...ids].some((id) => !incoming.has(id))) errors.push({ code: 'STUDIO_FLOW_NO_ENTRY' });
  }
  if (scope.roleCodes && scope.roleCodes.size > 0) {
    for (const code of flowRoleCodes(flow)) {
      if (!scope.roleCodes.has(code)) {
        errors.push({ code: 'STUDIO_FLOW_ROLE_UNCOVERED', params: { code } });
      }
    }
  }
  if (flow?.runMode !== undefined && flow.runMode !== null && !RUN_MODES.includes(flow.runMode)) {
    errors.push({ code: 'STUDIO_FLOW_RUN_MODE_UNKNOWN', params: { runMode: String(flow.runMode) } });
  }
  return { ok: errors.length === 0, errors };
}

function normalizeStage(raw, index) {
  const roleCodes = Array.isArray(raw?.roleCodes)
    ? raw.roleCodes.filter((v) => typeof v === 'string')
    : (typeof raw?.roleCode === 'string' ? [raw.roleCode] : []);
  const id = isId(raw?.id) ? raw.id : `s${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    titleKey: typeof raw?.titleKey === 'string' ? raw.titleKey : null,
    name: typeof raw?.name === 'string' ? raw.name.slice(0, 80) : '',
    roleCodes,
    parallel: raw?.parallel === true || roleCodes.length > 1,
    gate: GATE_KINDS.includes(raw?.gate) ? raw.gate : null,
    artifacts: Array.isArray(raw?.artifacts) ? raw.artifacts.filter((v) => typeof v === 'string') : []
  };
}

/**
 * Create a flow in the document: either the built-in template or a custom spec.
 * `spec.stages` wins over `template` when both are present.
 */
export function createFlow(doc, input = {}) {
  const wantBuiltin = input.template === 'rd-12' || input.template === true || input.kind === 'builtin';
  const custom = Array.isArray(input.stages) && input.stages.length > 0;
  if (!wantBuiltin && !custom) return fail('STUDIO_FLOW_SPEC_REQUIRED');

  const base = wantBuiltin && !custom ? buildRd12() : null;
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  const idBase = isId(input.id)
    ? input.id
    : (base !== null ? 'rd-12' : (slugify(input.id ?? name ?? 'flow') ?? `flow-${(doc.flows ?? []).length + 1}`));
  if ((doc.flows ?? []).some((f) => f.id === idBase)) return fail('STUDIO_FLOW_EXISTS', { id: idBase });

  const flow = base ?? {
    id: idBase,
    name,
    titleKey: null,
    kind: 'custom',
    runMode: RUN_MODES.includes(input.runMode) ? input.runMode : 'semi',
    gates: [],
    stages: input.stages.map(normalizeStage),
    edges: Array.isArray(input.edges)
      ? input.edges.filter((e) => typeof e?.from === 'string' && typeof e?.to === 'string')
      : []
  };
  if (base) {
    flow.id = idBase;
    flow.kind = 'builtin';
    flow.mode = 'template';
  } else {
    flow.id = idBase;
    flow.gates = flow.stages.map((s) => s.gate).filter(Boolean);
  }
  if (Array.isArray(input.edges) && custom) {
    flow.edges = input.edges
      .filter((e) => typeof e?.from === 'string' && typeof e?.to === 'string')
      .map((e) => ({ from: e.from, to: e.to }));
  }
  const checked = validateFlow(flow);
  if (!checked.ok) return fail('STUDIO_FLOW_INVALID', { errors: checked.errors });
  flow.createdAt = new Date().toISOString();
  doc.flows.push(flow);
  return { ok: true, flow };
}

/** Coverage report: which team roles satisfy each required code. */
export function roleCoverage(flow, team, roles) {
  const roleMap = indexBy(roles, 'id');
  const members = (team?.roleIds ?? []).map((id) => roleMap.get(id)).filter(Boolean);
  const byCode = new Map();
  for (const role of members) {
    if (typeof role.code === 'string') byCode.set(role.code, role);
  }
  const rows = flowRoleCodes(flow).map((code) => ({ code, roleId: byCode.get(code)?.id ?? null }));
  return { rows, missing: rows.filter((row) => row.roleId === null).map((row) => row.code) };
}

export function resolveStageRole(doc, stage, team) {
  const teamRoles = new Set(team?.roleIds ?? []);
  for (const code of stage.roleCodes ?? []) {
    const role = (doc.roles ?? []).find((r) => r.code === code && teamRoles.has(r.id));
    if (role) return role;
  }
  return null;
}

export function removeFlow(doc, id) {
  const flow = findById(doc.flows, id);
  if (!flow) return fail('STUDIO_FLOW_UNKNOWN', { flow: String(id) });
  const used = (doc.teams ?? []).filter((t) => t.flowId === id);
  if (used.length > 0) return fail('STUDIO_FLOW_IN_USE', { flow: id, teams: used.length });
  doc.flows = doc.flows.filter((f) => f.id !== id);
  return { ok: true, flow };
}

/** Artifact display key for the CLI (custom names pass through). */
export function artifactKey(id) {
  return artifactLabelKey(id);
}
