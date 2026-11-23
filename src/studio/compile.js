/**
 * B — engine bridge: compile a studio team+flow into the engine's own asset
 * documents (`role/v1`, `workflow/v1`) and prove it with the engine's validators.
 *
 * Nothing here starts a process. The compile step is what "接线" means: the new
 * authoring model must produce artifacts the v1 engine already accepts, so the
 * engine keeps being the底座 rather than being rewritten.
 */

import { checkWorkflowShape, WORKFLOW_SCHEMA_VERSION } from '../registry/workflow-schema.js';
import { checkRoleShape, ROLE_SCHEMA_VERSION } from '../registry/role-schema.js';
import { serializeRole, serializeWorkflow } from '../registry/asset-write.js';
import { fail } from './schema.js';
import { employeesOfRole } from './org.js';
import { topoOrder } from './flow.js';

/** Role code -> engine role group (closed set from role-schema GROUPS). */
const GROUP_BY_CODE = Object.freeze({
  'product-lead': 'coordinator',
  'product-analyst': 'research',
  'user-researcher': 'research',
  'competitor-analyst': 'research',
  'product-reviewer': 'research',
  'eng-lead': 'coordinator',
  architect: 'coding',
  'tech-reviewer': 'research',
  'frontend-lead': 'coordinator',
  'frontend-dev': 'coding',
  'frontend-reviewer': 'research',
  'backend-lead': 'coordinator',
  'backend-dev': 'coding',
  'backend-reviewer': 'research',
  'qa-lead': 'coordinator',
  'qa-functional': 'ops',
  'qa-api': 'ops',
  'qa-automation': 'ops',
  'qa-performance': 'ops',
  'qa-security': 'ops',
  devops: 'ops',
  'security-reviewer': 'ops',
  'data-architect': 'coding',
  dba: 'ops'
});

const CODE_ARTIFACT = Object.freeze({
  'frontend-dev': 'code',
  'backend-dev': 'code',
  architect: 'document',
  'data-architect': 'document',
  dba: 'document'
});

/** Employees that write code are `write`; reviewers read; leaders read+decide. */
function sideEffectFor(code) {
  if (code === 'frontend-dev' || code === 'backend-dev' || code === 'devops') return 'write';
  if (code === 'product-lead' || code === 'eng-lead' || code === 'architect' || code === 'data-architect') return 'write';
  return 'read';
}

export function roleDocFromRole(doc, role, { wakeAllow = [] } = {}) {
  const staff = employeesOfRole(doc, role.id);
  const maxConcurrent = staff.reduce(
    (max, emp) => Math.max(max, Number.isInteger(emp.maxConcurrentSessions) ? emp.maxConcurrentSessions : 1),
    1
  );
  const code = role.code ?? '';
  return {
    schema: ROLE_SCHEMA_VERSION,
    id: role.id,
    name: role.name,
    group: GROUP_BY_CODE[code] ?? 'coordinator',
    summary: role.summary || role.duty || role.name,
    artifact_type: CODE_ARTIFACT[code] ?? 'report',
    side_effect: sideEffectFor(code),
    skills: Array.isArray(role.skills) ? role.skills.slice() : [],
    tools: [],
    wake_allow: wakeAllow.slice(),
    max_concurrent_sessions: Math.min(Math.max(maxConcurrent, 1), 5)
  };
}

/**
 * @returns {{ok:true, roles:Array<{id:string,doc:object,yaml:string}>,
 *   workflow:object, yaml:string, order:string[]}
 *   | {ok:false, code:string, params:object}}
 */
export function compileStudio({ doc, team, flow }) {
  if (!team || !flow) return fail('STUDIO_COMPILE_INPUT_MISSING');
  const order = topoOrder(flow);
  if (order === null) return fail('STUDIO_FLOW_CYCLE');

  const errors = [];
  const roleIdByCode = new Map();
  for (const roleId of team.roleIds ?? []) {
    const role = (doc.roles ?? []).find((r) => r.id === roleId);
    if (role && typeof role.code === 'string') roleIdByCode.set(role.code, role.id);
  }

  // Engine nodes are stage-scoped role instances: the same studio role can
  // appear in several stages, and the engine's wake contract is node-to-node
  // (a role never wakes "itself" across nodes). `${roleId}-${stageId}` keeps
  // every compiled role unique without inventing new studio roles.
  const compiledId = (roleId, stageId) => `${roleId}-${stageId}`;
  const stageById = new Map((flow.stages ?? []).map((s) => [s.id, s]));
  const stageRoles = new Map();
  for (const stage of flow.stages ?? []) {
    const ids = [];
    for (const code of stage.roleCodes ?? []) {
      const roleId = roleIdByCode.get(code);
      if (!roleId) {
        errors.push({ code: 'STUDIO_FLOW_ROLE_UNCOVERED', params: { stage: stage.id, code } });
        continue;
      }
      ids.push(compiledId(roleId, stage.id));
    }
    stageRoles.set(stage.id, ids);
  }

  const roles = [];
  const seenRoleFile = new Set();
  for (const stageId of order) {
    const stage = stageById.get(stageId);
    const successors = (flow.edges ?? [])
      .filter((edge) => edge.from === stageId)
      .flatMap((edge) => stageRoles.get(edge.to) ?? []);
    for (const code of stage.roleCodes ?? []) {
      const roleId = roleIdByCode.get(code);
      if (!roleId) continue;
      const engineId = compiledId(roleId, stageId);
      if (seenRoleFile.has(engineId)) continue;
      seenRoleFile.add(engineId);
      const role = (doc.roles ?? []).find((r) => r.id === roleId);
      if (!role) {
        errors.push({ code: 'STUDIO_ROLE_UNKNOWN', params: { role: roleId } });
        continue;
      }
      const roleDoc = roleDocFromRole(doc, role, { wakeAllow: successors.filter((id) => id !== engineId) });
      roleDoc.id = engineId;
      const shapeErrors = checkRoleShape(roleDoc, { fileId: roleDoc.id });
      for (const err of shapeErrors) errors.push({ code: err.code, params: err.params ?? {} });
      roles.push({ id: engineId, doc: roleDoc, yaml: serializeRole(roleDoc) });
    }
  }

  const nodes = [];
  for (const stageId of order) {
    const stage = stageById.get(stageId);
    const ids = stageRoles.get(stageId) ?? [];
    if (ids.length === 0) {
      errors.push({ code: 'STUDIO_FLOW_ROLE_UNCOVERED', params: { stage: stageId, codes: stage.roleCodes ?? [] } });
      continue;
    }
    nodes.push({
      id: stage.id,
      node_type: 'role',
      role: ids[0],
      title: stage.titleKey ?? stage.name ?? stage.id
    });
  }

  const workflow = {
    schema: WORKFLOW_SCHEMA_VERSION,
    id: flow.id,
    name: flow.name || flow.id,
    summary: flow.kind === 'builtin' ? 'built-in 12-stage R&D workflow' : 'custom workflow',
    entry: order[0],
    terminal: order[order.length - 1],
    nodes,
    edges: (flow.edges ?? []).map((edge) => ({ from: edge.from, to: edge.to, kind: 'forward', when: 'always', join: 'all' }))
  };
  for (const err of checkWorkflowShape(workflow, { fileId: flow.id })) {
    errors.push({ code: err.code, params: err.params ?? {} });
  }
  if (errors.length > 0) return fail('STUDIO_COMPILE_INVALID', { errors });

  return { ok: true, roles, workflow, yaml: serializeWorkflow(workflow), order };
}
