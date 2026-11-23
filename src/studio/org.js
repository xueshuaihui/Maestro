/**
 * A2 — organization: departments / roles / employees / sessions.
 *
 * Three boundaries from the baseline are encoded here, not in the UI:
 *   1. a role is not an agent: one role may hold many employees;
 *   2. a role declares required CLI *capabilities*, never a concrete cli_id;
 *      the employee is what binds a cli_id;
 *   3. an employee instance is not a session: sessions are separate records.
 */

import {
  ROLE_CODES,
  emptyRequires,
  fail,
  isId,
  isPlainObject,
  normalizeRequires,
  slugify
} from './schema.js';
import { findById, indexBy } from './store.js';

const MAX_NAME = 80;

function cleanName(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : '';
}

function uniqueId(doc, listName, base) {
  const list = Array.isArray(doc[listName]) ? doc[listName] : [];
  const taken = new Set(list.map((item) => item.id));
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

/** Resolve a role reference by id or by code (users may pass either). */
export function resolveRole(doc, ref) {
  if (typeof ref !== 'string') return null;
  return findById(doc.roles, ref) ?? (doc.roles ?? []).find((role) => role.code === ref) ?? null;
}

export function addRole(doc, input = {}) {
  const name = cleanName(input.name);
  if (name.length === 0) return fail('STUDIO_ROLE_NAME_REQUIRED');
  const departmentId = typeof input.departmentId === 'string' && input.departmentId.length > 0
    ? input.departmentId
    : 'product';
  if (!findById(doc.departments, departmentId)) {
    return fail('STUDIO_DEPARTMENT_UNKNOWN', { department: departmentId });
  }
  const code = typeof input.code === 'string' && input.code.length > 0 ? input.code : null;
  if (code !== null && !ROLE_CODES.includes(code)) {
    return fail('STUDIO_ROLE_CODE_UNKNOWN', { code });
  }
  // Prefer the semantic code as the id: role ids then match the codes a flow
  // declares, and a Chinese display name never blocks id generation.
  const base = isId(input.id)
    ? input.id
    : (isId(code) ? code : slugify(input.id ?? name));
  if (base === null) return fail('STUDIO_ID_INVALID', { name });
  const role = {
    id: uniqueId(doc, 'roles', base),
    name,
    code,
    departmentId,
    summary: typeof input.summary === 'string' ? input.summary : '',
    duty: typeof input.duty === 'string' ? input.duty : '',
    contract: {
      inputs: Array.isArray(input.inputs) ? input.inputs.filter((v) => typeof v === 'string') : [],
      outputs: Array.isArray(input.outputs) ? input.outputs.filter((v) => typeof v === 'string') : [],
      doneWhen: typeof input.doneWhen === 'string' ? input.doneWhen : ''
    },
    skills: Array.isArray(input.skills) ? input.skills.filter((v) => typeof v === 'string') : [],
    requires: normalizeRequires(input.requires),
    createdAt: new Date().toISOString()
  };
  doc.roles.push(role);
  return { ok: true, role };
}

export function updateRole(doc, ref, patch = {}) {
  const role = resolveRole(doc, ref);
  if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: String(ref) });
  for (const field of ['name', 'summary', 'duty']) {
    if (typeof patch[field] === 'string') role[field] = field === 'name' ? cleanName(patch[field]) : patch[field];
  }
  if (typeof patch.departmentId === 'string') {
    if (!findById(doc.departments, patch.departmentId)) {
      return fail('STUDIO_DEPARTMENT_UNKNOWN', { department: patch.departmentId });
    }
    role.departmentId = patch.departmentId;
  }
  if (patch.code === null || typeof patch.code === 'string') {
    if (patch.code !== null && !ROLE_CODES.includes(patch.code)) {
      return fail('STUDIO_ROLE_CODE_UNKNOWN', { code: patch.code });
    }
    role.code = patch.code;
  }
  if (isPlainObject(patch.requires)) role.requires = normalizeRequires({ ...role.requires, ...patch.requires });
  if (isPlainObject(patch.contract)) {
    role.contract = {
      inputs: Array.isArray(patch.contract.inputs) ? patch.contract.inputs : role.contract.inputs,
      outputs: Array.isArray(patch.contract.outputs) ? patch.contract.outputs : role.contract.outputs,
      doneWhen: typeof patch.contract.doneWhen === 'string' ? patch.contract.doneWhen : role.contract.doneWhen
    };
  }
  if (Array.isArray(patch.skills)) role.skills = patch.skills.filter((v) => typeof v === 'string');
  role.updatedAt = new Date().toISOString();
  return { ok: true, role };
}

export function employeesOfRole(doc, roleId) {
  return (doc.employees ?? []).filter((emp) => emp.roleId === roleId);
}

export function removeRole(doc, ref) {
  const role = resolveRole(doc, ref);
  if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: String(ref) });
  const employees = employeesOfRole(doc, role.id);
  if (employees.length > 0) {
    return fail('STUDIO_ROLE_IN_USE', { role: role.id, employees: employees.length });
  }
  const teams = (doc.teams ?? []).filter((team) => (team.roleIds ?? []).includes(role.id));
  if (teams.length > 0) {
    return fail('STUDIO_ROLE_IN_USE', { role: role.id, teams: teams.length });
  }
  doc.roles = doc.roles.filter((item) => item.id !== role.id);
  return { ok: true, role };
}

export function addEmployee(doc, input = {}) {
  const role = resolveRole(doc, input.roleId ?? input.role);
  if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: String(input.roleId ?? input.role ?? '') });
  const cliId = typeof input.cliId === 'string' ? input.cliId.trim() : '';
  if (cliId.length === 0) return fail('STUDIO_CLI_REQUIRED');
  const name = cleanName(input.name) || `${role.name} ${employeesOfRole(doc, role.id).length + 1}`;
  const base = isId(input.id) ? input.id : slugify(input.id ?? name) ?? role.id;
  const maxConcurrent = Number.isInteger(input.maxConcurrentSessions) && input.maxConcurrentSessions > 0
    ? input.maxConcurrentSessions
    : 1;
  const employee = {
    id: uniqueId(doc, 'employees', base),
    name,
    roleId: role.id,
    cliId,
    maxConcurrentSessions: maxConcurrent,
    sessionPolicy: typeof input.sessionPolicy === 'string' ? input.sessionPolicy : 'fresh',
    workingDir: typeof input.workingDir === 'string' ? input.workingDir : null,
    createdAt: new Date().toISOString()
  };
  doc.employees.push(employee);
  return { ok: true, employee };
}

export function updateEmployee(doc, ref, patch = {}) {
  const employee = findById(doc.employees, ref);
  if (!employee) return fail('STUDIO_EMPLOYEE_UNKNOWN', { employee: String(ref) });
  if (typeof patch.name === 'string') employee.name = cleanName(patch.name) || employee.name;
  if (typeof patch.cliId === 'string' && patch.cliId.trim().length > 0) employee.cliId = patch.cliId.trim();
  if (Number.isInteger(patch.maxConcurrentSessions) && patch.maxConcurrentSessions > 0) {
    employee.maxConcurrentSessions = patch.maxConcurrentSessions;
  }
  if (typeof patch.roleId === 'string') {
    const role = resolveRole(doc, patch.roleId);
    if (!role) return fail('STUDIO_ROLE_UNKNOWN', { role: patch.roleId });
    employee.roleId = role.id;
  }
  employee.updatedAt = new Date().toISOString();
  return { ok: true, employee };
}

export function removeEmployee(doc, ref) {
  const employee = findById(doc.employees, ref);
  if (!employee) return fail('STUDIO_EMPLOYEE_UNKNOWN', { employee: String(ref) });
  const open = (doc.sessions ?? []).filter((s) => s.employeeId === employee.id && s.status === 'open');
  if (open.length > 0) return fail('STUDIO_EMPLOYEE_BUSY', { employee: employee.id, sessions: open.length });
  doc.employees = doc.employees.filter((item) => item.id !== employee.id);
  return { ok: true, employee };
}

/**
 * Open a session record for one employee. In this phase a session is a
 * semantic record (real ACP driving is B1); `mode` says exactly which.
 */
export function openSession(doc, input = {}) {
  const employee = findById(doc.employees, input.employeeId ?? input.employee);
  if (!employee) return fail('STUDIO_EMPLOYEE_UNKNOWN', { employee: String(input.employeeId ?? input.employee ?? '') });
  const open = (doc.sessions ?? []).filter((s) => s.employeeId === employee.id && s.status === 'open');
  if (open.length >= employee.maxConcurrentSessions) {
    return fail('STUDIO_SESSION_LIMIT', { employee: employee.id, limit: employee.maxConcurrentSessions });
  }
  const session = {
    id: `S-${employee.id}-${(doc.sessions ?? []).length + 1}`,
    employeeId: employee.id,
    roleId: employee.roleId,
    cliId: employee.cliId,
    mode: typeof input.mode === 'string' ? input.mode : 'record',
    task: typeof input.task === 'string' ? input.task : '',
    status: 'open',
    createdAt: new Date().toISOString()
  };
  doc.sessions.push(session);
  return { ok: true, session };
}

export function closeSession(doc, id) {
  const session = findById(doc.sessions, id);
  if (!session) return fail('STUDIO_SESSION_UNKNOWN', { session: String(id) });
  session.status = 'closed';
  session.closedAt = new Date().toISOString();
  return { ok: true, session };
}

/**
 * Capability check (A2 "角色能力校验").
 *
 * A role declares capabilities; every employee of that role must bind a CLI
 * that satisfies them. An unprobed dimension (null) is a warning, never a
 * silent pass and never a hard failure — the CLI simply has not been probed.
 */
export function checkOrganization(doc, clis = []) {
  const errors = [];
  const warnings = [];
  const cliMap = indexBy(clis, 'cli_id');
  const departments = new Set((doc.departments ?? []).map((d) => d.id));
  const roleMap = indexBy(doc.roles, 'id');

  for (const role of doc.roles ?? []) {
    if (!departments.has(role.departmentId)) {
      errors.push({ code: 'STUDIO_DEPARTMENT_UNKNOWN', params: { role: role.id, department: role.departmentId } });
    }
    const staff = employeesOfRole(doc, role.id);
    if (staff.length === 0) {
      warnings.push({ code: 'STUDIO_ROLE_NO_EMPLOYEE', params: { role: role.id } });
      continue;
    }
    for (const employee of staff) {
      const cli = cliMap.get(employee.cliId) ?? null;
      if (!cli) {
        warnings.push({ code: 'STUDIO_CLI_UNKNOWN', params: { employee: employee.id, cli: employee.cliId } });
        continue;
      }
      if (cli.connection_status === 'unreachable' || !cli.executable) {
        warnings.push({ code: 'STUDIO_CLI_UNREACHABLE', params: { employee: employee.id, cli: employee.cliId } });
      }
      const requires = role.requires ?? emptyRequires();
      if (requires.acp === true && cli.acp === false) {
        errors.push({ code: 'STUDIO_CAPABILITY_MISMATCH', params: { employee: employee.id, cli: employee.cliId, dimension: 'acp' } });
      } else if (requires.acp === true && cli.acp === null) {
        warnings.push({ code: 'STUDIO_CAPABILITY_UNPROBED', params: { employee: employee.id, cli: employee.cliId, dimension: 'acp' } });
      }
      if (requires.max_concurrent_sessions !== null
        && cli.max_concurrent_sessions !== null
        && requires.max_concurrent_sessions > cli.max_concurrent_sessions) {
        errors.push({
          code: 'STUDIO_CAPABILITY_MISMATCH',
          params: { employee: employee.id, cli: employee.cliId, dimension: 'max_concurrent_sessions' }
        });
      }
    }
  }

  for (const employee of doc.employees ?? []) {
    if (!roleMap.has(employee.roleId)) {
      errors.push({ code: 'STUDIO_ROLE_UNKNOWN', params: { employee: employee.id, role: employee.roleId } });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
