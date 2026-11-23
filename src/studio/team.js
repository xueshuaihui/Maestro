/**
 * A3 — Agent Team assembly: a named set of roles plus execution policy.
 *
 * A team references roles, never employees directly: employees belong to roles,
 * so adding a second employee to a role automatically widens the team. That is
 * the "one role, many agents" boundary expressed at the team layer.
 */

import { GATE_KINDS, RUN_MODES, fail, isId, slugify } from './schema.js';
import { findById, indexBy } from './store.js';
import { employeesOfRole, resolveRole } from './org.js';
import { flowRoleCodes, resolveStageRole } from './flow.js';

function uniqueTeamId(doc, base) {
  const taken = new Set((doc.teams ?? []).map((t) => t.id));
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function normalizeRoles(doc, refs) {
  const out = [];
  for (const ref of Array.isArray(refs) ? refs : []) {
    const role = resolveRole(doc, ref);
    if (!role) return { ok: false, ref };
    if (!out.includes(role.id)) out.push(role.id);
  }
  return { ok: true, roleIds: out };
}

/** Resolve a team by id or display name (the CLI accepts either). */
export function resolveTeam(doc, ref) {
  if (typeof ref !== 'string') return null;
  return (doc.teams ?? []).find((team) => team.id === ref)
    ?? (doc.teams ?? []).find((team) => team.name === ref)
    ?? null;
}

export function createTeam(doc, input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  if (name.length === 0) return fail('STUDIO_TEAM_NAME_REQUIRED');
  const roles = normalizeRoles(doc, input.roleIds ?? input.roles);
  if (!roles.ok) return fail('STUDIO_ROLE_UNKNOWN', { role: roles.ref });
  if (roles.roleIds.length === 0) return fail('STUDIO_TEAM_NO_ROLE');

  const lead = resolveRole(doc, input.leadRoleId ?? input.lead ?? roles.roleIds[0]);
  if (!lead) return fail('STUDIO_ROLE_UNKNOWN', { role: String(input.leadRoleId ?? input.lead ?? '') });
  if (!roles.roleIds.includes(lead.id)) roles.roleIds.unshift(lead.id);

  const runMode = RUN_MODES.includes(input.runMode) ? input.runMode : 'semi';
  const gates = Array.isArray(input.gates)
    ? input.gates.filter((g) => GATE_KINDS.includes(g))
    : ['prd-freeze', 'arch-confirm', 'release-approve'];

  const flowId = typeof input.flowId === 'string' && input.flowId.length > 0 ? input.flowId : null;
  if (flowId !== null && !findById(doc.flows, flowId)) return fail('STUDIO_FLOW_UNKNOWN', { flow: flowId });

  const base = isId(input.id)
    ? input.id
    : (slugify(input.id ?? name) ?? `team-${(doc.teams ?? []).length + 1}`);

  const team = {
    id: uniqueTeamId(doc, base),
    name,
    leadRoleId: lead.id,
    roleIds: roles.roleIds,
    flowId,
    runMode,
    gates,
    rules: {
      maxConcurrentPerEmployee: Number.isInteger(input.rules?.maxConcurrentPerEmployee)
        ? input.rules.maxConcurrentPerEmployee
        : 1,
      requireReview: input.rules?.requireReview !== false
    },
    createdAt: new Date().toISOString()
  };
  doc.teams.push(team);
  return { ok: true, team };
}

export function updateTeam(doc, id, patch = {}) {
  const team = findById(doc.teams, id);
  if (!team) return fail('STUDIO_TEAM_UNKNOWN', { team: String(id) });
  if (typeof patch.name === 'string' && patch.name.trim().length > 0) team.name = patch.name.trim().slice(0, 80);
  if (Array.isArray(patch.roleIds)) {
    const roles = normalizeRoles(doc, patch.roleIds);
    if (!roles.ok) return fail('STUDIO_ROLE_UNKNOWN', { role: roles.ref });
    team.roleIds = roles.roleIds;
  }
  if (typeof patch.addRole === 'string') {
    const role = resolveRole(doc, patch.addRole);
    if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: patch.addRole });
    if (!team.roleIds.includes(role.id)) team.roleIds.push(role.id);
  }
  if (typeof patch.removeRole === 'string') {
    const role = resolveRole(doc, patch.removeRole);
    if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: patch.removeRole });
    if (role.id === team.leadRoleId) return fail('STUDIO_TEAM_LEAD_REMOVE', { role: role.id });
    team.roleIds = team.roleIds.filter((id2) => id2 !== role.id);
  }
  if (typeof patch.leadRoleId === 'string') {
    const role = resolveRole(doc, patch.leadRoleId);
    if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: patch.leadRoleId });
    if (!team.roleIds.includes(role.id)) team.roleIds.unshift(role.id);
    team.leadRoleId = role.id;
  }
  if (RUN_MODES.includes(patch.runMode)) team.runMode = patch.runMode;
  if (Array.isArray(patch.gates)) team.gates = patch.gates.filter((g) => GATE_KINDS.includes(g));
  if (patch.flowId === null || typeof patch.flowId === 'string') {
    if (patch.flowId !== null && !findById(doc.flows, patch.flowId)) {
      return fail('STUDIO_FLOW_UNKNOWN', { flow: patch.flowId });
    }
    team.flowId = patch.flowId;
  }
  team.updatedAt = new Date().toISOString();
  return { ok: true, team };
}

export function removeTeam(doc, id) {
  const team = findById(doc.teams, id);
  if (!team) return fail('STUDIO_TEAM_UNKNOWN', { team: String(id) });
  doc.teams = doc.teams.filter((t) => t.id !== id);
  return { ok: true, team };
}

/** Members table used by `team show` and the desktop page. */
export function teamMembers(doc, team) {
  const roleMap = indexBy(doc.roles, 'id');
  return (team?.roleIds ?? []).map((roleId) => {
    const role = roleMap.get(roleId) ?? null;
    const staff = role ? employeesOfRole(doc, role.id) : [];
    return {
      roleId,
      roleName: role?.name ?? roleId,
      code: role?.code ?? null,
      isLead: team.leadRoleId === roleId,
      employees: staff.map((emp) => ({ id: emp.id, name: emp.name, cliId: emp.cliId }))
    };
  });
}

/**
 * Team readiness: every member role staffed, lead present, and (when a flow is
 * attached) every role code the flow needs covered by a team role.
 */
export function checkTeam(doc, team) {
  const errors = [];
  const warnings = [];
  if (!Array.isArray(team?.roleIds) || team.roleIds.length === 0) errors.push({ code: 'STUDIO_TEAM_NO_ROLE' });
  const roleMap = indexBy(doc.roles, 'id');
  if (!roleMap.has(team?.leadRoleId)) {
    errors.push({ code: 'STUDIO_ROLE_UNKNOWN', params: { role: String(team?.leadRoleId ?? '') } });
  }
  for (const roleId of team?.roleIds ?? []) {
    const role = roleMap.get(roleId);
    if (!role) {
      errors.push({ code: 'STUDIO_ROLE_UNKNOWN', params: { role: roleId } });
      continue;
    }
    if (employeesOfRole(doc, role.id).length === 0) {
      errors.push({ code: 'STUDIO_ROLE_NO_EMPLOYEE', params: { role: role.id } });
    }
  }
  let coverage = null;
  if (typeof team?.flowId === 'string') {
    const flow = findById(doc.flows, team.flowId);
    if (!flow) {
      errors.push({ code: 'STUDIO_FLOW_UNKNOWN', params: { flow: team.flowId } });
    } else {
      const codes = new Set(
        (team.roleIds ?? [])
          .map((id) => roleMap.get(id)?.code)
          .filter((code) => typeof code === 'string')
      );
      const missing = flowRoleCodes(flow).filter((code) => !codes.has(code));
      coverage = { required: flowRoleCodes(flow).length, missing };
      for (const code of missing) {
        errors.push({ code: 'STUDIO_FLOW_ROLE_UNCOVERED', params: { code } });
      }
      const unstaffedStage = (flow.stages ?? []).filter((stage) => resolveStageRole(doc, stage, team) === null);
      if (unstaffedStage.length > 0 && missing.length === 0) {
        warnings.push({ code: 'STUDIO_STAGE_ROLE_FALLBACK', params: { stages: unstaffedStage.length } });
      }
    }
  } else {
    warnings.push({ code: 'STUDIO_TEAM_NO_FLOW', params: { team: team?.id ?? '' } });
  }
  return { ok: errors.length === 0, errors, warnings, coverage };
}

/** Export/import: a team template carries roles' codes, not local role ids. */
export function exportTeam(doc, team) {
  const roleMap = indexBy(doc.roles, 'id');
  return {
    kind: 'maestro/team-template',
    version: 1,
    name: team.name,
    runMode: team.runMode,
    gates: team.gates,
    rules: team.rules,
    leadCode: roleMap.get(team.leadRoleId)?.code ?? null,
    roles: (team.roleIds ?? []).map((id) => {
      const role = roleMap.get(id);
      return {
        code: role?.code ?? null,
        name: role?.name ?? id,
        departmentId: role?.departmentId ?? null,
        duty: role?.duty ?? '',
        requires: role?.requires ?? null,
        employees: employeesOfRole(doc, id).map((emp) => ({ name: emp.name, cliId: emp.cliId }))
      };
    })
  };
}
