/**
 * `orch org|team|flow|studio|task|project` - the v2 authoring surface (A2~A6, B, D).
 *
 * Discipline:
 * - Zero CJK here: every user-visible string comes from STUDIO_TEXT.
 * - The bin entry routes these six roots before `src/cli/main.js`, so the
 *   frozen v1 parser and its 18-row flag whitelist stay untouched.
 * - Every mutation goes through `updateStudio` (read-modify-write + one atomic
 *   save); every read goes through `loadStudio`.
 * - Exit codes: 0 ok, 1 blocking error, 2 usage.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  STUDIO_SCHEMA_VERSION,
  loadStudio,
  updateStudio,
  addRole,
  updateRole,
  removeRole,
  addEmployee,
  updateEmployee,
  removeEmployee,
  openSession,
  closeSession,
  employeesOfRole,
  resolveRole,
  checkOrganization,
  createTeam,
  updateTeam,
  removeTeam,
  checkTeam,
  teamMembers,
  exportTeam,
  resolveTeam,
  createFlow,
  validateFlow,
  topoOrder,
  roleCoverage,
  removeFlow,
  startRun,
  approveRun,
  engineRun,
  prepareEngine,
  findById,
  planRun,
  transitionTask,
  recordException,
  addDefect,
  raiseRequirementGap,
  reviewChange,
  loadProjects,
  addProject,
  useProject,
  removeProject,
  hostMatrix,
  DEPARTMENT_SEEDS,
  RUN_MODES as STUDIO_RUN_MODES,
  TASK_STATUS
} from '../studio/index.js';
import { loadCliRegistry } from '../adapter/cli-discovery/index.js';
import { STUDIO_TEXT as T, fill } from './labels.js';
import { STUDIO_SEED_ROLES, seedOrganization as seedOrgDoc } from '../templates/studio-seed.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

export const STUDIO_ROOTS = Object.freeze(['org', 'team', 'flow', 'studio', 'task', 'project']);

const ERROR_KEY = Object.freeze({
  STUDIO_ROLE_NAME_REQUIRED: 'ERR_ROLE_NAME_REQUIRED',
  STUDIO_ROLE_CODE_UNKNOWN: 'ERR_ROLE_CODE_UNKNOWN',
  STUDIO_ROLE_UNKNOWN: 'ERR_ROLE_UNKNOWN',
  STUDIO_ROLE_IN_USE: 'ERR_ROLE_IN_USE',
  STUDIO_EMPLOYEE_UNKNOWN: 'ERR_EMPLOYEE_UNKNOWN',
  STUDIO_EMPLOYEE_BUSY: 'ERR_EMPLOYEE_BUSY',
  STUDIO_CLI_REQUIRED: 'ERR_CLI_REQUIRED',
  STUDIO_CLI_UNKNOWN: 'ERR_CLI_UNKNOWN',
  STUDIO_CLI_UNREACHABLE: 'ERR_CLI_UNREACHABLE',
  STUDIO_CAPABILITY_MISMATCH: 'ERR_CAPABILITY_MISMATCH',
  STUDIO_CAPABILITY_UNPROBED: 'ERR_CAPABILITY_UNPROBED',
  STUDIO_DEPARTMENT_UNKNOWN: 'ERR_DEPARTMENT_UNKNOWN',
  STUDIO_TEAM_NAME_REQUIRED: 'ERR_TEAM_NAME_REQUIRED',
  STUDIO_TEAM_NO_ROLE: 'ERR_TEAM_NO_ROLE',
  STUDIO_TEAM_UNKNOWN: 'ERR_TEAM_UNKNOWN',
  STUDIO_TEAM_NOT_READY: 'ERR_TEAM_NOT_READY',
  STUDIO_TEAM_LEAD_REMOVE: 'ERR_TEAM_LEAD_REMOVE',
  STUDIO_TEAM_NO_FLOW: 'ERR_TEAM_NO_FLOW',
  STUDIO_FLOW_SPEC_REQUIRED: 'ERR_FLOW_SPEC_REQUIRED',
  STUDIO_FLOW_INVALID: 'ERR_FLOW_INVALID',
  STUDIO_FLOW_UNKNOWN: 'ERR_FLOW_UNKNOWN',
  STUDIO_FLOW_EXISTS: 'ERR_FLOW_EXISTS',
  STUDIO_FLOW_IN_USE: 'ERR_FLOW_IN_USE',
  STUDIO_FLOW_CYCLE: 'ERR_FLOW_CYCLE',
  STUDIO_FLOW_ROLE_UNCOVERED: 'ERR_FLOW_ROLE_UNCOVERED',
  STUDIO_FLOW_STAGE_NO_ROLE: 'ERR_FLOW_STAGE_NO_ROLE',
  STUDIO_RUN_UNKNOWN: 'ERR_RUN_UNKNOWN',
  STUDIO_RUN_NO_GATE: 'ERR_RUN_NO_GATE',
  STUDIO_RUN_GATE_NOT_PENDING: 'ERR_RUN_GATE_NOT_PENDING',
  STUDIO_RUN_MODE_UNKNOWN: 'ERR_RUN_MODE_UNKNOWN',
  STUDIO_TASK_UNKNOWN: 'ERR_TASK_UNKNOWN',
  STUDIO_TASK_TRANSITION_ILLEGAL: 'ERR_TASK_TRANSITION',
  STUDIO_TASK_STATUS_UNKNOWN: 'ERR_TASK_STATUS_UNKNOWN',
  STUDIO_INVALID: 'ERR_STUDIO_INVALID',
  STUDIO_ID_INVALID: 'ERR_ID_INVALID'
});

const MODE_TEXT = Object.freeze({
  auto: T.MODE_AUTO,
  semi: T.MODE_SEMI,
  manual: T.MODE_MANUAL,
  plan: T.MODE_PLAN,
  simulate: T.MODE_SIMULATE,
  engine: T.MODE_ENGINE
});

const GATE_TEXT = Object.freeze({
  'prd-freeze': T.GATE_PRD_FREEZE,
  'arch-confirm': T.GATE_ARCH_CONFIRM,
  'release-approve': T.GATE_RELEASE_APPROVE
});

const GATE_STATUS_TEXT = Object.freeze({
  pending: T.GATE_PENDING,
  approved: T.GATE_APPROVED,
  'auto-approved': T.GATE_AUTO,
  rejected: T.GATE_REJECTED
});

const STAGE_STATUS_TEXT = Object.freeze({
  pending: T.STAGE_PENDING,
  running: T.STAGE_RUNNING,
  done: T.STAGE_DONE,
  'awaiting-approval': T.STAGE_WAITING,
  blocked: T.STAGE_BLOCKED
});

const RUN_STATUS_TEXT = Object.freeze({
  planned: T.RUN_PLANNED_STATUS,
  running: T.RUN_RUNNING_STATUS,
  completed: T.RUN_COMPLETED_STATUS,
  'awaiting-approval': T.RUN_WAITING_STATUS,
  blocked: T.RUN_BLOCKED_STATUS,
  prepared: T.RUN_PREPARED_STATUS
});

const TASK_STATUS_TEXT = Object.freeze({
  todo: T.TASK_TODO,
  ready: T.TASK_READY,
  claimed: T.TASK_CLAIMED,
  running: T.TASK_RUNNING,
  review: T.TASK_REVIEW,
  fixing: T.TASK_FIXING,
  done: T.TASK_DONE,
  blocked: T.TASK_BLOCKED,
  cancelled: T.TASK_CANCELLED
});

const BOOLEAN_FLAGS = new Set([
  'requirement', 'reject', 'accept', 'json', 'force', 'all', 'no-gates'
]);

function out(line = '') {
  process.stdout.write(`${line}\n`);
}

function failWith(key, params = {}) {
  out(fill(T[key] ?? key, params));
  return EXIT_FAILED;
}

function failCode(result) {
  const key = ERROR_KEY[result.code] ?? null;
  if (key === null) {
    const reason = result.params?.cause
    ?? result.params?.errors?.[0]?.code
    ?? result.params?.code
    ?? '';
    out(`${result.code}${reason ? `：${reason}` : ''}`);
    return EXIT_FAILED;
  }
  return failWith(key, result.params ?? {});
}

function titleOf(flow, stage) {
  if (stage.titleKey && typeof T[stage.titleKey] === 'string') return T[stage.titleKey];
  if (typeof stage.name === 'string' && stage.name.length > 0) return stage.name;
  return stage.id;
}

function flowTitle(flow) {
  if (flow.titleKey && typeof T[flow.titleKey] === 'string') return T[flow.titleKey];
  return flow.name && flow.name.length > 0 ? flow.name : flow.id;
}

function artifactText(id) {
  const key = `ARTIFACT_${String(id).replace(/-/g, '_').toUpperCase()}`;
  return typeof T[key] === 'string' ? T[key] : id;
}

function gateText(gate) {
  if (!gate) return T.GATE_NONE;
  return GATE_TEXT[gate] ?? gate;
}

function modeText(mode) {
  return MODE_TEXT[mode] ?? mode;
}

function stageStatusText(status) {
  return STAGE_STATUS_TEXT[status] ?? status;
}

function runStatusText(status) {
  return RUN_STATUS_TEXT[status] ?? status;
}

function taskStatusText(status) {
  return TASK_STATUS_TEXT[status] ?? status;
}

function deptText(doc, id) {
  const dept = (doc.departments ?? []).find((d) => d.id === id);
  const key = dept?.labelKey;
  return key && typeof T[key] === 'string' ? T[key] : id;
}

function table(headers, rows) {
  const lines = [headers.join('  |  ')];
  lines.push('-'.repeat(Math.max(headers.join('  |  ').length, 24)));
  for (const row of rows) lines.push(row.join('  |  '));
  return lines.join('\n');
}

export function parseStudioArgs(tokens) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (typeof token !== 'string') continue;
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      const key = eq === -1 ? token.slice(2) : token.slice(2, eq);
      if (eq !== -1) {
        flags[key] = token.slice(eq + 1);
      } else if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
      } else if (i + 1 < tokens.length && !String(tokens[i + 1]).startsWith('--')) {
        flags[key] = tokens[i + 1];
        i += 1;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(token);
  }
  return { flags, positional };
}

function splitList(value) {
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

async function loadClis(root) {
  const loaded = await loadCliRegistry(root);
  return loaded.ok ? loaded.registry.clis ?? [] : [];
}

async function requireStudio(root) {
  const loaded = await loadStudio(root);
  if (!loaded.ok) return loaded;
  return { ok: true, doc: loaded.doc, existed: loaded.existed };
}

/** Parse `--stages "a:role1,role2|b:role3"` into a custom linear DAG. */
export function parseStageSpec(spec) {
  const chunks = String(spec ?? '').split('|').map((c) => c.trim()).filter(Boolean);
  const stages = [];
  for (const chunk of chunks) {
    const [idPart, rolesPart] = chunk.split(':').map((v) => (v ?? '').trim());
    if (!idPart || !rolesPart) return null;
    stages.push({
      id: idPart,
      roleCodes: rolesPart.split(',').map((r) => r.trim()).filter(Boolean)
    });
  }
  const edges = [];
  for (let i = 1; i < stages.length; i += 1) edges.push({ from: stages[i - 1].id, to: stages[i].id });
  return { stages, edges };
}

// ---------------------------------------------------------------- org ------

async function orgCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'init') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    if (loaded.existed) {
      out(T.INIT_EXISTS);
      return EXIT_OK;
    }
    const saved = await updateStudio(root, () => ({ ok: true }));
    if (!saved.ok) return failCode(saved);
    out(fill(T.INIT_DONE, { departments: DEPARTMENT_SEEDS.length }));
    return EXIT_OK;
  }

  if (sub === 'seed') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    if ((loaded.doc.roles ?? []).length > 0 && flags.force !== true) {
      out(T.SEED_SKIP);
      return EXIT_OK;
    }
    const clis = await loadClis(root);
    const cliId = typeof flags.cli === 'string' && flags.cli.length > 0
      ? flags.cli
      : (clis[0]?.cli_id ?? 'unbound');
    const perRole = Number.isInteger(Number(flags.per)) && Number(flags.per) > 0 ? Number(flags.per) : 1;
    let counts = { roles: 0, employees: 0 };
    const saved = await updateStudio(root, (doc) => {
      counts = seedOrgDoc(doc, {
        cliId,
        perRole,
        addRole,
        addEmployee,
        employeesOfRole,
        label: (key, fallback) => (typeof T[key] === 'string' ? T[key] : fallback)
      });
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.SEED_DONE, { roles: counts.roles, employees: counts.employees, cli: cliId }));
    if (cliId === 'unbound') out(fill(T.DEMO_HINT, { cli: 'unbound' }));
    return EXIT_OK;
  }

  if (sub === 'list') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const doc = loaded.doc;
    if (flags.format === 'json') {
      out(JSON.stringify({
        schemaVersion: STUDIO_SCHEMA_VERSION,
        departments: doc.departments,
        roles: doc.roles,
        employees: doc.employees,
        sessions: doc.sessions
      }, null, 2));
      return EXIT_OK;
    }
    out(T.TITLE);
    out('');
    for (const dept of doc.departments ?? []) {
      const roles = (doc.roles ?? []).filter((role) => role.departmentId === dept.id);
      out(`${deptText(doc, dept.id)}（${roles.length}）`);
      for (const role of roles) {
        const staff = employeesOfRole(doc, role.id);
        out(`  - ${role.name} [${role.id}]${role.code ? ` ${role.code}` : ''} · ${T.COL_EMPLOYEES} ${staff.length}`);
      }
    }
    if ((doc.roles ?? []).length === 0) {
      out('');
      out(T.NO_ROLES);
    }
    return EXIT_OK;
  }

  if (sub === 'role') {
    const action = positional.shift();
    if (action === 'add') {
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      let created = null;
      const saved = await updateStudio(root, (doc) => {
        const result = addRole(doc, {
          name: flags.name,
          code: typeof flags.code === 'string' ? flags.code : null,
          departmentId: typeof flags.dept === 'string' ? flags.dept : 'product',
          duty: typeof flags.duty === 'string' ? flags.duty : '',
          summary: typeof flags.summary === 'string' ? flags.summary : '',
          outputs: splitList(flags.outputs),
          inputs: splitList(flags.inputs),
          skills: splitList(flags.skills),
          requires: {
            acp: flags['requires-acp'] === 'false' ? false : flags['requires-acp'] === 'true' ? true : null
          }
        });
        if (!result.ok) return result;
        created = result.role;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.ROLE_ADDED, { id: created.id, name: created.name }));
      return EXIT_OK;
    }
    if (action === 'list') {
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      const roles = loaded.doc.roles ?? [];
      if (flags.format === 'json') {
        out(JSON.stringify(roles, null, 2));
        return EXIT_OK;
      }
      if (roles.length === 0) return failWith('NO_ROLES');
      out(table([T.COL_ID, T.COL_NAME, T.COL_CODE, T.COL_DEPT, T.COL_EMPLOYEES], roles.map((role) => [
        role.id,
        role.name,
        role.code ?? '-',
        deptText(loaded.doc, role.departmentId),
        String(employeesOfRole(loaded.doc, role.id).length)
      ])));
      return EXIT_OK;
    }
    if (action === 'set') {
      const ref = positional[0];
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      let updated = null;
      const saved = await updateStudio(root, (doc) => {
        const result = updateRole(doc, ref, {
          name: flags.name,
          duty: flags.duty,
          summary: flags.summary,
          departmentId: flags.dept,
          code: flags.code,
          requires: flags['requires-acp'] === undefined
            ? undefined
            : { acp: flags['requires-acp'] === 'true' }
        });
        if (!result.ok) return result;
        updated = result.role;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.ROLE_UPDATED, { id: updated.id }));
      return EXIT_OK;
    }
    if (action === 'remove' || action === 'rm') {
      const ref = positional[0];
      let removed = null;
      const saved = await updateStudio(root, (doc) => {
        const result = removeRole(doc, ref);
        if (!result.ok) return result;
        removed = result.role;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.ROLE_REMOVED, { id: removed.id }));
      return EXIT_OK;
    }
    return failWith('ACTION', { usage: T.USAGE });
  }

  if (sub === 'emp') {
    const action = positional.shift();
    if (action === 'add') {
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      const clis = await loadClis(root);
      const cliId = typeof flags.cli === 'string' ? flags.cli : '';
      if (cliId.length > 0 && clis.length > 0 && !clis.some((cli) => cli.cli_id === cliId)) {
        return failWith('ERR_CLI_UNKNOWN', { cli: cliId });
      }
      let created = null;
      const saved = await updateStudio(root, (doc) => {
        const result = addEmployee(doc, {
          name: flags.name,
          roleId: flags.role,
          cliId,
          maxConcurrentSessions: Number.isInteger(Number(flags['max-concurrent']))
            ? Number(flags['max-concurrent'])
            : 1
        });
        if (!result.ok) return result;
        created = result.employee;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.EMP_ADDED, {
        id: created.id,
        name: created.name,
        role: created.roleId,
        cli: created.cliId
      }));
      return EXIT_OK;
    }
    if (action === 'list') {
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      const employees = loaded.doc.employees ?? [];
      if (flags.format === 'json') {
        out(JSON.stringify(employees, null, 2));
        return EXIT_OK;
      }
      if (employees.length === 0) return failWith('NO_EMPLOYEES');
      out(table([T.COL_ID, T.COL_NAME, T.COL_ROLE, T.COL_CLI, T.COL_MAX], employees.map((emp) => {
        const role = findById(loaded.doc.roles, emp.roleId);
        return [emp.id, emp.name, role?.name ?? emp.roleId, emp.cliId, String(emp.maxConcurrentSessions ?? 1)];
      })));
      return EXIT_OK;
    }
    if (action === 'set') {
      const ref = positional[0];
      let updated = null;
      const saved = await updateStudio(root, (doc) => {
        const result = updateEmployee(doc, ref, {
          name: flags.name,
          cliId: flags.cli,
          roleId: flags.role,
          maxConcurrentSessions: Number.isInteger(Number(flags['max-concurrent']))
            ? Number(flags['max-concurrent'])
            : undefined
        });
        if (!result.ok) return result;
        updated = result.employee;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.EMP_UPDATED, { id: updated.id }));
      return EXIT_OK;
    }
    if (action === 'remove' || action === 'rm') {
      let removed = null;
      const saved = await updateStudio(root, (doc) => {
        const result = removeEmployee(doc, positional[0]);
        if (!result.ok) return result;
        removed = result.employee;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.EMP_REMOVED, { id: removed.id }));
      return EXIT_OK;
    }
    return failWith('ACTION', { usage: T.USAGE });
  }

  if (sub === 'session') {
    const action = positional.shift();
    if (action === 'open') {
      let created = null;
      const saved = await updateStudio(root, (doc) => {
        const result = openSession(doc, {
          employeeId: flags.emp ?? positional[0],
          task: typeof flags.task === 'string' ? flags.task : '',
          mode: typeof flags.mode === 'string' ? flags.mode : 'record'
        });
        if (!result.ok) return result;
        created = result.session;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.SESSION_OPENED, {
        id: created.id,
        employee: created.employeeId,
        cli: created.cliId,
        mode: created.mode
      }));
      return EXIT_OK;
    }
    if (action === 'list') {
      const loaded = await requireStudio(root);
      if (!loaded.ok) return failCode(loaded);
      const sessions = loaded.doc.sessions ?? [];
      if (flags.format === 'json') {
        out(JSON.stringify(sessions, null, 2));
        return EXIT_OK;
      }
      out(table([T.COL_ID, '员工', 'CLI', '模式', '状态'], sessions.map((s) => [
        s.id, s.employeeId, s.cliId, s.mode, s.status
      ])));
      return EXIT_OK;
    }
    if (action === 'close') {
      let closed = null;
      const saved = await updateStudio(root, (doc) => {
        const result = closeSession(doc, positional[0]);
        if (!result.ok) return result;
        closed = result.session;
        return { ok: true };
      });
      if (!saved.ok) return failCode(saved);
      out(fill(T.SESSION_CLOSED, { id: closed.id }));
      return EXIT_OK;
    }
    return failWith('ACTION', { usage: T.USAGE });
  }

  if (sub === 'check') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const clis = await loadClis(root);
    const report = checkOrganization(loaded.doc, clis);
    if (flags.format === 'json') {
      out(JSON.stringify(report, null, 2));
      return report.ok ? EXIT_OK : EXIT_FAILED;
    }
    if (report.ok && report.warnings.length === 0) {
      out(fill(T.TEAM_READY, {
        id: '-',
        roles: (loaded.doc.roles ?? []).length,
        employees: (loaded.doc.employees ?? []).length,
        covered: '-'
      }));
      return EXIT_OK;
    }
    for (const err of report.errors) {
      const key = ERROR_KEY[err.code] ?? null;
      out(key ? `✗ ${fill(T[key], err.params ?? {})}` : `✗ ${err.code}`);
    }
    for (const warn of report.warnings) {
      const key = ERROR_KEY[warn.code] ?? null;
      out(key ? `! ${fill(T[key], warn.params ?? {})}` : `! ${warn.code}`);
    }
    return report.ok ? EXIT_OK : EXIT_FAILED;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

// --------------------------------------------------------------- team ------

async function teamCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'create') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = createTeam(doc, {
        name: flags.name,
        leadRoleId: flags.lead,
        roleIds: splitList(flags.roles),
        flowId: typeof flags.flow === 'string' ? flags.flow : null,
        runMode: typeof flags['run-mode'] === 'string' ? flags['run-mode'] : 'semi',
        gates: splitList(flags.gates)
      });
      if (!result.ok) return result;
      created = result.team;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    const staff = created.roleIds.reduce((sum, id) => sum + employeesOfRole(loaded.doc, id).length, 0);
    out(fill(T.TEAM_CREATED, {
      id: created.id,
      roles: created.roleIds.length,
      employees: staff,
      mode: modeText(created.runMode)
    }));
    return EXIT_OK;
  }

  if (sub === 'list') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const teams = loaded.doc.teams ?? [];
    if (flags.format === 'json') {
      out(JSON.stringify(teams, null, 2));
      return EXIT_OK;
    }
    if (teams.length === 0) return failWith('NO_TEAMS');
    out(table([T.COL_ID, T.COL_NAME, T.COL_ROLES, '负责人', '工作流', '运行模式'], teams.map((team) => [
      team.id,
      team.name,
      String((team.roleIds ?? []).length),
      findById(loaded.doc.roles, team.leadRoleId)?.name ?? team.leadRoleId,
      team.flowId ?? '-',
      modeText(team.runMode)
    ])));
    return EXIT_OK;
  }

  if (sub === 'show' || sub === 'check') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const team = resolveTeam(loaded.doc, positional[0]);
    if (!team) return failWith('ERR_TEAM_UNKNOWN', { team: String(positional[0]) });
    const report = checkTeam(loaded.doc, team);
    if (flags.format === 'json') {
      out(JSON.stringify({ team, report, members: teamMembers(loaded.doc, team) }, null, 2));
      return report.ok ? EXIT_OK : EXIT_FAILED;
    }
    out(`${team.name} [${team.id}] · ${modeText(team.runMode)} · ${team.flowId ?? '-'}`);
    out('');
    out(table([T.COL_ROLE, T.COL_CODE, T.COL_EMPLOYEES, 'CLI'], teamMembers(loaded.doc, team).map((row) => [
      `${row.isLead ? '*' : ' '}${row.roleName}`,
      row.code ?? '-',
      row.employees.map((emp) => emp.name).join(', ') || '-',
      [...new Set(row.employees.map((emp) => emp.cliId))].join(', ') || '-'
    ])));
    out('');
    if (report.coverage) {
      out(`${T.COL_STAGE}: ${report.coverage.required - report.coverage.missing.length}/${report.coverage.required}`);
    }
    for (const err of report.errors) {
      const key = ERROR_KEY[err.code] ?? null;
      out(key ? `✗ ${fill(T[key], err.params ?? {})}` : `✗ ${err.code}`);
    }
    for (const warn of report.warnings) {
      const key = ERROR_KEY[warn.code] ?? null;
      out(key ? `! ${fill(T[key], warn.params ?? {})}` : `! ${warn.code}`);
    }
    if (report.ok) out(fill(T.TEAM_READY, {
      id: team.id,
      roles: team.roleIds.length,
      employees: teamMembers(loaded.doc, team).reduce((n, r) => n + r.employees.length, 0),
      covered: report.coverage ? `${report.coverage.required - report.coverage.missing.length}/${report.coverage.required}` : '-'
    }));
    return report.ok ? EXIT_OK : EXIT_FAILED;
  }

  if (sub === 'set') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    let updated = null;
    const saved = await updateStudio(root, (doc) => {
      const result = updateTeam(doc, positional[0], {
        name: flags.name,
        addRole: flags['add-role'],
        removeRole: flags['remove-role'],
        leadRoleId: flags.lead,
        runMode: flags['run-mode'],
        gates: flags.gates === undefined ? undefined : splitList(flags.gates),
        flowId: flags.flow === undefined ? undefined : flags.flow
      });
      if (!result.ok) return result;
      updated = result.team;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.TEAM_UPDATED, { id: updated.id }));
    return EXIT_OK;
  }

  if (sub === 'export') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const team = resolveTeam(loaded.doc, positional[0]);
    if (!team) return failWith('ERR_TEAM_UNKNOWN', { team: String(positional[0]) });
    const target = path.resolve(root, typeof flags.out === 'string' ? flags.out : `.orch/teams/${team.id}.template.json`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(exportTeam(loaded.doc, team), null, 2)}\n`, 'utf8');
    out(fill(T.TEAM_EXPORTED, { path: path.relative(root, target) }));
    return EXIT_OK;
  }

  if (sub === 'remove' || sub === 'rm') {
    let removed = null;
    const saved = await updateStudio(root, (doc) => {
      const target = resolveTeam(doc, positional[0]);
      const result = removeTeam(doc, target?.id ?? positional[0]);
      if (!result.ok) return result;
      removed = result.team;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.TEAM_REMOVED, { id: removed.id }));
    return EXIT_OK;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

// --------------------------------------------------------------- flow ------

async function flowCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'create') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    let spec = null;
    if (flags.template === 'rd-12') {
      spec = { template: 'rd-12' };
    } else if (typeof flags.from === 'string') {
      try {
        spec = JSON.parse(await fs.readFile(path.resolve(root, flags.from), 'utf8'));
      } catch (err) {
        return failWith('ERR_FLOW_INVALID', { reason: err?.message ?? String(err) });
      }
    } else if (typeof flags.stages === 'string') {
      spec = parseStageSpec(flags.stages);
      if (spec === null) return failWith('ERR_FLOW_SPEC_REQUIRED');
    }
    if (spec === null) return failWith('ERR_FLOW_SPEC_REQUIRED');
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = createFlow(doc, {
        ...spec,
        name: typeof flags.name === 'string' ? flags.name : '',
        id: typeof flags.id === 'string' ? flags.id : undefined,
        runMode: typeof flags['run-mode'] === 'string' ? flags['run-mode'] : 'semi'
      });
      if (!result.ok) return result;
      created = result.flow;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.FLOW_CREATED, {
      id: created.id,
      stages: created.stages.length,
      gates: created.gates.length,
      edges: created.edges.length
    }));
    return EXIT_OK;
  }

  if (sub === 'list') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const flows = loaded.doc.flows ?? [];
    if (flags.format === 'json') {
      out(JSON.stringify(flows, null, 2));
      return EXIT_OK;
    }
    if (flows.length === 0) return failWith('NO_FLOWS');
    out(table([T.COL_ID, T.COL_NAME, T.COL_STAGE, T.COL_GATE, '类型'], flows.map((flow) => [
      flow.id,
      flowTitle(flow),
      String(flow.stages.length),
      String(flow.gates.length),
      flow.kind
    ])));
    return EXIT_OK;
  }

  if (sub === 'show') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const flow = findById(loaded.doc.flows, positional[0]);
    if (!flow) return failWith('ERR_FLOW_UNKNOWN', { flow: String(positional[0]) });
    if (flags.format === 'json') {
      out(JSON.stringify(flow, null, 2));
      return EXIT_OK;
    }
    out(`${flowTitle(flow)} [${flow.id}] · ${flow.stages.length} 阶段 · ${modeText(flow.runMode)}`);
    out('');
    out(table([T.COL_STAGE, T.COL_NAME, T.COL_ROLES, T.COL_GATE, T.COL_ARTIFACTS], flow.stages.map((stage) => [
      stage.id,
      titleOf(flow, stage),
      stage.roleCodes.join(','),
      gateText(stage.gate),
      stage.artifacts.map(artifactText).join(',') || '-'
    ])));
    out('');
    out(`依赖：${flow.edges.map((e) => `${e.from}->${e.to}`).join('  ') || '-'}`);
    return EXIT_OK;
  }

  if (sub === 'validate') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const flow = positional[0] ? findById(loaded.doc.flows, positional[0]) : null;
    if (!flow) return failWith('ERR_FLOW_UNKNOWN', { flow: String(positional[0] ?? '') });
    const team = loaded.doc.teams.find((t) => t.flowId === flow.id) ?? null;
    const coverage = team ? roleCoverage(flow, team, loaded.doc.roles) : { missing: [] };
    const checked = validateFlow(flow, {
      roleCodes: team
        ? new Set(team.roleIds.map((id) => findById(loaded.doc.roles, id)?.code).filter(Boolean))
        : null
    });
    if (flags.format === 'json') {
      out(JSON.stringify({ flow: flow.id, ...checked, coverage }, null, 2));
      return checked.ok ? EXIT_OK : EXIT_FAILED;
    }
    if (!checked.ok) {
      return failWith('ERR_FLOW_INVALID', { reason: checked.errors.map((e) => e.code).join(', ') });
    }
    const order = topoOrder(flow) ?? [];
    out(fill(T.FLOW_VALID, {
      id: flow.id,
      stages: flow.stages.length,
      entry: order[0] ?? '-',
      terminal: order[order.length - 1] ?? '-'
    }));
    if (coverage.missing.length > 0) {
      out(fill(T.ERR_FLOW_ROLE_UNCOVERED, { code: coverage.missing.join(', ') }));
    }
    return EXIT_OK;
  }

  if (sub === 'remove' || sub === 'rm') {
    let removed = null;
    const saved = await updateStudio(root, (doc) => {
      const result = removeFlow(doc, positional[0]);
      if (!result.ok) return result;
      removed = result.flow;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.FLOW_REMOVED, { id: removed.id }));
    return EXIT_OK;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

// ------------------------------------------------------------- studio ------

async function runDetail(root, run, doc) {
  const flow = findById(doc.flows, run.flowId);
  out(`${run.id} · ${runStatusText(run.status)} · ${modeText(run.mode)} · ${run.teamId} / ${run.flowId}`);
  out('');
  const rows = run.stages.map((slot) => {
    const stage = flow ? findById(flow.stages, slot.stageId) : null;
    return [
      slot.stageId,
      stage ? titleOf(flow, stage) : slot.stageId,
      stageStatusText(slot.status),
      gateText(slot.gate),
      slot.gateStatus ? (GATE_STATUS_TEXT[slot.gateStatus] ?? slot.gateStatus) : '-',
      String(slot.artifacts.length)
    ];
  });
  out(table([T.COL_STAGE, T.COL_NAME, T.COL_STATUS, T.COL_GATE, '门禁状态', T.COL_ARTIFACTS], rows));
  return EXIT_OK;
}

async function studioCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'demo') {
    // One-shot core journey: seed org -> create 12-stage flow -> create team ->
    // simulate a run. Used by `npm run verify:core` and the desktop empty state.
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const clis = await loadClis(root);
    const cliId = typeof flags.cli === 'string' && flags.cli.length > 0
      ? flags.cli
      : (clis[0]?.cli_id ?? 'unbound');
    let ids = { teamId: null, flowId: null };
    const seeded = await updateStudio(root, (doc) => {
      seedOrgDoc(doc, {
        cliId,
        perRole: 1,
        addRole,
        addEmployee,
        employeesOfRole,
        label: (key, fallback) => (typeof T[key] === 'string' ? T[key] : fallback)
      });
      let flow = (doc.flows ?? []).find((f) => f.kind === 'builtin') ?? null;
      if (!flow) {
        const createdFlow = createFlow(doc, { template: 'rd-12', name: '', id: 'rd-12' });
        if (!createdFlow.ok) return createdFlow;
        flow = createdFlow.flow;
      }
      let team = (doc.teams ?? [])[0] ?? null;
      if (!team) {
        const roleIds = (doc.roles ?? []).map((role) => role.id);
        const createdTeam = createTeam(doc, {
          name: T.FLOW_RD12,
          leadRoleId: 'eng-lead',
          roleIds,
          flowId: flow.id,
          runMode: 'auto'
        });
        if (!createdTeam.ok) return createdTeam;
        team = createdTeam.team;
      } else if (team.flowId === null) {
        team.flowId = flow.id;
      }
      ids = { teamId: team.id, flowId: flow.id };
      return { ok: true };
    });
    if (!seeded.ok) return failCode(seeded);
    const doc = seeded.doc;
    const started = await startRun({ root, doc, teamId: ids.teamId, flowId: ids.flowId, mode: 'simulate' });
    if (!started.ok) return failCode(started);
    const persisted = await updateStudio(root, (d) => {
      d.runs = doc.runs;
      d.tasks = doc.tasks;
      return { ok: true };
    });
    if (!persisted.ok) return failCode(persisted);
    out(fill(T.DEMO_DONE, {
      roles: (doc.roles ?? []).length,
      employees: (doc.employees ?? []).length,
      teams: (doc.teams ?? []).length,
      flows: (doc.flows ?? []).length,
      run: started.run.id
    }));
    out(fill(T.RUN_STATUS, {
      id: started.run.id,
      status: runStatusText(started.run.status),
      done: String(started.run.stages.filter((stage) => stage.status === 'done').length),
      total: String(started.run.stages.length)
    }));
    return EXIT_OK;
  }

  if (sub === 'run') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const mode = typeof flags.mode === 'string' ? flags.mode : 'simulate';
    const startedAt = Date.now();
    let started = null;
    const saved = await updateStudio(root, (doc) => {
      // startRun is async (artifact IO); the update helper needs a sync mutator,
      // so the run is executed on a detached copy here and merged below.
      return { ok: true, value: { doc, mode } };
    });
    if (!saved.ok) return failCode(saved);
    const doc = saved.doc;
    started = await startRun({
      root,
      doc,
      teamId: resolveTeam(loaded.doc, flags.team ?? positional[0])?.id ?? (flags.team ?? positional[0]),
      flowId: typeof flags.flow === 'string' ? flags.flow : null,
      mode
    });
    if (!started.ok) return failCode(started);
    if (mode === 'engine') {
      const team = findById(doc.teams, started.run.teamId);
      const flow = findById(doc.flows, started.run.flowId);
      const engine = await engineRun({ root, doc, run: started.run, team, flow });
      if (!engine.ok) return failCode(engine);
      out(fill(T.RUN_ENGINE_PREPARED, { count: engine.prepared.written.length, flow: engine.prepared.workflowId }));
      if (engine.prepared.hostConfigured) {
        out(fill(T.RUN_ENGINE_HOST_READY, { hosts: engine.prepared.hosts.join(', ') }));
      } else {
        out(fill(T.RUN_ENGINE_NO_HOST, { path: path.join('.orch', 'hosts', 'dsh.json') }));
      }
    }
    const persisted = await updateStudio(root, (d) => {
      d.runs = doc.runs;
      d.tasks = doc.tasks;
      d.sessions = doc.sessions;
      return { ok: true };
    });
    if (!persisted.ok) return failCode(persisted);
    out(fill(T.RUN_STARTED, {
      id: started.run.id,
      team: started.run.teamId,
      flow: started.run.flowId,
      mode: modeText(started.run.mode)
    }));
    if (mode === 'plan') {
      out(fill(T.RUN_PLANNED, { id: started.run.id }));
      return EXIT_OK;
    }
    const waiting = started.run.stages.find((s) => s.status === 'awaiting-approval');
    if (waiting) {
      for (const slot of started.run.stages) {
        if (slot.status !== 'done') continue;
        out(fill(T.RUN_STAGE_DONE, { stage: slot.stageId, artifacts: String(slot.artifacts.length) }));
      }
      out(fill(T.RUN_WAITING, {
        stage: waiting.stageId,
        gate: gateText(waiting.gate),
        mode: modeText(findById(doc.teams, started.run.teamId)?.runMode),
        run: started.run.id
      }));
      return EXIT_OK;
    }
    const artifacts = started.run.stages.reduce((n, s) => n + s.artifacts.length, 0);
    if (started.run.status === 'completed') {
      out(fill(T.RUN_COMPLETED, {
        id: started.run.id,
        stages: started.run.stages.length,
        artifacts,
        ms: Date.now() - startedAt
      }));
    } else {
      out(fill(T.RUN_STATUS, {
        id: started.run.id,
        status: runStatusText(started.run.status),
        done: String(started.run.stages.filter((s) => s.status === 'done').length),
        total: String(started.run.stages.length)
      }));
    }
    return EXIT_OK;
  }

  if (sub === 'approve') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const doc = loaded.doc;
    const result = await approveRun({
      root,
      doc,
      runId: positional[0] ?? flags.run,
      stageId: typeof flags.stage === 'string' ? flags.stage : null,
      approve: flags.reject !== true
    });
    if (!result.ok) return failCode(result);
    const persisted = await updateStudio(root, (d) => {
      d.runs = doc.runs;
      d.tasks = doc.tasks;
      return { ok: true };
    });
    if (!persisted.ok) return failCode(persisted);
    if (result.rejected) {
      out(fill(T.RUN_REJECTED, { stage: result.rejected }));
      return EXIT_OK;
    }
    out(fill(T.RUN_APPROVED, { stage: result.approvedStage ?? flags.stage ?? '-' }));
    if (result.waiting) {
      out(fill(T.RUN_WAITING, {
        stage: result.waiting.stageId,
        gate: gateText(result.waiting.gate),
        mode: modeText(findById(doc.teams, result.run.teamId)?.runMode),
        run: result.run.id
      }));
    } else if (result.run.status === 'completed') {
      out(fill(T.RUN_COMPLETED, {
        id: result.run.id,
        stages: result.run.stages.length,
        artifacts: result.run.stages.reduce((n, s) => n + s.artifacts.length, 0),
        ms: 0
      }));
    }
    return EXIT_OK;
  }

  if (sub === 'list') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const runs = loaded.doc.runs ?? [];
    if (flags.format === 'json') {
      out(JSON.stringify(runs, null, 2));
      return EXIT_OK;
    }
    if (runs.length === 0) return failWith('NO_RUNS');
    out(table(['RUN', T.COL_STATUS, '模式', '团队', '工作流', '阶段'], runs.map((run) => [
      run.id,
      runStatusText(run.status),
      modeText(run.mode),
      run.teamId,
      run.flowId,
      `${run.stages.filter((s) => s.status === 'done').length}/${run.stages.length}`
    ])));
    return EXIT_OK;
  }

  if (sub === 'show') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const run = findById(loaded.doc.runs, positional[0]);
    if (!run) return failWith('ERR_RUN_UNKNOWN', { id: String(positional[0]) });
    if (flags.format === 'json') {
      out(JSON.stringify(run, null, 2));
      return EXIT_OK;
    }
    return runDetail(root, run, loaded.doc);
  }

  if (sub === 'status') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const doc = loaded.doc;
    const clis = await loadClis(root);
    const org = checkOrganization(doc, clis);
    const summary = {
      departments: doc.departments.length,
      roles: doc.roles.length,
      employees: doc.employees.length,
      teams: doc.teams.length,
      flows: doc.flows.length,
      runs: doc.runs.length,
      tasks: doc.tasks.length,
      sessions: doc.sessions.length,
      orgOk: org.ok,
      orgWarnings: org.warnings.length,
      lastRun: doc.runs.at(-1)?.id ?? null
    };
    if (flags.format === 'json') {
      out(JSON.stringify(summary, null, 2));
      return EXIT_OK;
    }
    out(T.TITLE);
    out('');
    out(table(['项', '数量'], [
      ['部门', String(summary.departments)],
      ['角色', String(summary.roles)],
      ['员工', String(summary.employees)],
      ['团队', String(summary.teams)],
      ['工作流', String(summary.flows)],
      ['任务', String(summary.tasks)],
      ['运行', String(summary.runs)],
      ['会话', String(summary.sessions)]
    ]));
    out('');
    out(`${T.COL_STATUS}: ${org.ok ? 'OK' : 'ERROR'} · ${org.warnings.length} warnings`);
    if (summary.lastRun) out(`last run: ${summary.lastRun}`);
    return EXIT_OK;
  }

  if (sub === 'hosts') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const clis = await loadClis(root);
    const matrix = hostMatrix(clis, loaded.doc.teams, loaded.doc.roles);
    if (flags.format === 'json') {
      out(JSON.stringify(matrix, null, 2));
      return EXIT_OK;
    }
    out(T.HOSTS_TITLE);
    out('');
    if (matrix.rows.length === 0) return failWith('HOSTS_NONE');
    out(table([T.COL_CLI_ID, T.COL_NAME, T.COL_STATUS, T.COL_ACP, T.COL_MAX, 'PATH'], matrix.rows.map((row) => [
      row.cli_id,
      row.name,
      row.connection_status,
      row.acp === null ? '-' : String(row.acp),
      row.max_concurrent_sessions === null ? '-' : String(row.max_concurrent_sessions),
      row.executable ?? '-'
    ])));
    out('');
    out(fill(T.HOSTS_READY, { n: matrix.readyCount }));
    return EXIT_OK;
  }

  if (sub === 'compile') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    const team = resolveTeam(loaded.doc, flags.team ?? positional[0]);
    if (!team) return failWith('ERR_TEAM_UNKNOWN', { team: String(flags.team ?? positional[0]) });
    const flow = findById(loaded.doc.flows, flags.flow ?? team.flowId ?? '');
    if (!flow) return failWith('ERR_FLOW_UNKNOWN', { flow: String(flags.flow ?? team.flowId ?? '') });
    const prepared = await prepareEngine({ root, doc: loaded.doc, team, flow });
    if (!prepared.ok) return failCode(prepared);
    out(fill(T.RUN_ENGINE_PREPARED, { count: prepared.written.length, flow: prepared.workflowId }));
    for (const file of prepared.written) out(`  ${file}`);
    if (!prepared.hostConfigured) out(fill(T.RUN_ENGINE_NO_HOST, { path: path.join('.orch', 'hosts', 'dsh.json') }));
    return EXIT_OK;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

// --------------------------------------------------------------- task ------

async function taskCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'list') {
    const loaded = await requireStudio(root);
    if (!loaded.ok) return failCode(loaded);
    let tasks = loaded.doc.tasks ?? [];
    if (typeof flags.run === 'string') tasks = tasks.filter((task) => task.runId === flags.run);
    if (flags.format === 'json') {
      out(JSON.stringify(tasks, null, 2));
      return EXIT_OK;
    }
    if (tasks.length === 0) return failWith('TASK_NO_TASKS');
    out(table([T.COL_ID, T.COL_TASK, T.COL_STAGE, T.COL_STATUS, T.COL_ROLE], tasks.map((task) => [
      task.id,
      task.title,
      task.stageId ?? '-',
      taskStatusText(task.status),
      task.roleId ?? '-'
    ])));
    return EXIT_OK;
  }

  if (sub === 'move') {
    if (!TASK_STATUS.includes(flags.to)) {
      return failWith('ERR_TASK_STATUS_UNKNOWN', { status: String(flags.to ?? '') });
    }
    let moved = null;
    const saved = await updateStudio(root, (doc) => {
      const result = transitionTask(doc, positional[0], flags.to, { note: flags.note });
      if (!result.ok) return result;
      moved = result.task;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.TASK_MOVED, { id: moved.id, status: taskStatusText(moved.status) }));
    return EXIT_OK;
  }

  if (sub === 'exception') {
    let result = null;
    const saved = await updateStudio(root, (doc) => {
      const moved = recordException(doc, positional[0], flags.kind, {
        note: typeof flags.note === 'string' ? flags.note : ''
      });
      if (!moved.ok) return moved;
      result = moved;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.TASK_EXCEPTION, { id: result.task.id, kind: String(flags.kind) }));
    return EXIT_OK;
  }

  if (sub === 'defect') {
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = addDefect(doc, {
        runId: flags.run,
        stageId: flags.stage,
        summary: flags.summary,
        severity: flags.severity,
        kind: flags.requirement === true ? 'requirement' : 'product',
        reporter: flags.reporter
      });
      if (!result.ok) return result;
      created = result.defect;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.DEFECT_OPENED, { id: created.id, severity: created.severity }));
    return EXIT_OK;
  }

  if (sub === 'change') {
    let result = null;
    const saved = await updateStudio(root, (doc) => {
      const raised = raiseRequirementGap(doc, {
        runId: flags.run,
        stageId: flags.stage,
        summary: flags.summary,
        severity: flags.severity,
        taskId: flags.task
      });
      if (!raised.ok) return raised;
      result = raised;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.CHANGE_OPENED, {
      id: result.change.id,
      task: result.task?.id ?? '-'
    }));
    return EXIT_OK;
  }

  if (sub === 'review') {
    let result = null;
    const saved = await updateStudio(root, (doc) => {
      const reviewed = reviewChange(doc, positional[0], {
        decision: flags.reject === true ? 'rejected' : 'accepted',
        note: typeof flags.note === 'string' ? flags.note : ''
      });
      if (!reviewed.ok) return reviewed;
      result = reviewed;
      return { ok: true };
    });
    if (!saved.ok) return failCode(saved);
    out(fill(T.CHANGE_REVIEWED, { id: result.change.id, status: result.change.status }));
    return EXIT_OK;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

// ------------------------------------------------------------ project ------

async function projectCommand(tokens, root) {
  const sub = tokens.shift();
  const { flags, positional } = parseStudioArgs(tokens);

  if (sub === 'add') {
    const target = positional[0] ?? root;
    const added = await addProject({ root: path.resolve(root, target), name: flags.name });
    if (!added.ok) return failCode(added);
    out(fill(T.PROJECT_ADDED, { id: added.project.id, root: added.project.root }));
    return EXIT_OK;
  }
  if (sub === 'list') {
    const listed = await loadProjects();
    if (!listed.ok) return failCode(listed);
    if (flags.format === 'json') {
      out(JSON.stringify(listed.doc, null, 2));
      return EXIT_OK;
    }
    if (listed.doc.projects.length === 0) return failWith('PROJECT_LIST_EMPTY');
    out(table([T.COL_ID, T.COL_NAME, T.COL_ROOT, 'active'], listed.doc.projects.map((project) => [
      project.id,
      project.name,
      project.root,
      listed.doc.active === project.root ? '*' : ''
    ])));
    return EXIT_OK;
  }
  if (sub === 'use') {
    const used = await useProject(path.resolve(root, positional[0] ?? '.'));
    if (!used.ok) return failWith('PROJECT_UNKNOWN', { ref: String(positional[0] ?? root) });
    out(fill(T.PROJECT_USING, { id: used.project.id, root: used.project.root }));
    return EXIT_OK;
  }
  if (sub === 'remove' || sub === 'rm') {
    const removed = await removeProject(positional[0]);
    if (!removed.ok) return failWith('PROJECT_UNKNOWN', { ref: String(positional[0]) });
    out(fill(T.PROJECT_REMOVED, { id: removed.removed.id }));
    return EXIT_OK;
  }

  out(T.USAGE);
  return EXIT_USAGE;
}

/** Top-level dispatcher for the six new roots. */
export async function studioMain(argv) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const rootName = tokens.shift();
  const root = process.cwd();
  if (!STUDIO_ROOTS.includes(rootName)) {
    out(T.USAGE);
    return EXIT_USAGE;
  }
  if (rootName === 'org') return orgCommand(tokens, root);
  if (rootName === 'team') return teamCommand(tokens, root);
  if (rootName === 'flow') return flowCommand(tokens, root);
  if (rootName === 'studio') return studioCommand(tokens, root);
  if (rootName === 'task') return taskCommand(tokens, root);
  return projectCommand(tokens, root);
}

/** Re-exported for the desktop HTTP layer and tests. */
export { STUDIO_RUN_MODES, planRun };
