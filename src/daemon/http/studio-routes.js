/**
 * Desktop Studio API (v2 A2~A6, B bridge, D multi-project).
 *
 * Three routes, all additive to the frozen v1 table:
 *   GET  /studio/state   one read-only projection of the whole authoring state
 *   GET  /studio/labels  the STUDIO_TEXT table (single Chinese source)
 *   POST /studio/action  one command per call, mapped 1:1 onto src/studio/*
 *
 * No business logic here: every action calls the same domain function the CLI
 * calls, so the UI and `orch ...` can never drift. Errors travel as
 * `{ok:false, code, labelKey, params}` with HTTP 200 so the page can render the
 * localized sentence it already has.
 */

import { readBody } from './stream.js';
import {
  loadStudio,
  updateStudio,
  findById,
  resolveRole,
  employeesOfRole,
  checkOrganization,
  addRole,
  addEmployee,
  createTeam,
  checkTeam,
  createFlow,
  updateTeam,
  startRun,
  approveRun,
  engineRun,
  raiseRequirementGap,
  teamMembers,
  roleCoverage,
  DEPARTMENT_SEEDS,
  departmentLabelKey,
  ROLE_CODES
} from '../../studio/index.js';
import { errorLabelKey } from '../../studio/messages.js';
import { discoverAgentClis, loadCliRegistry, saveCliRegistry } from '../../adapter/cli-discovery/index.js';
import { STUDIO_TEXT as T } from '../../cli/labels.js';
import { seedOrganization } from '../../templates/studio-seed.js';

const BODY_LIMIT = 64 * 1024;

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function t(key, fallback = '') {
  return typeof T[key] === 'string' ? T[key] : fallback;
}

function labelize(dept) {
  const key = dept.labelKey ?? departmentLabelKey(dept.id);
  return t(key, dept.id);
}

function stageTitle(flow, stage) {
  if (stage.titleKey && typeof T[stage.titleKey] === 'string') return T[stage.titleKey];
  return stage.name || stage.id;
}

function artifactTitle(id) {
  const key = `ARTIFACT_${String(id).replace(/-/g, '_').toUpperCase()}`;
  return t(key, id);
}

function fail(res, result) {
  return sendJson(res, 200, {
    ok: false,
    code: result.code ?? 'STUDIO_UNKNOWN',
    labelKey: errorLabelKey(result.code),
    params: result.params ?? {}
  });
}

async function buildState(root) {
  const loaded = await loadStudio(root);
  if (!loaded.ok) return loaded;
  const doc = loaded.doc;
  const cliLoaded = await loadCliRegistry(root);
  const clis = cliLoaded.ok ? (cliLoaded.registry.clis ?? []) : [];
  const org = checkOrganization(doc, clis);

  const roles = (doc.roles ?? []).map((role) => ({
    id: role.id,
    name: role.name,
    code: role.code,
    departmentId: role.departmentId,
    department: labelize({ id: role.departmentId }),
    duty: role.duty ?? '',
    employeeCount: employeesOfRole(doc, role.id).length,
    requires: role.requires ?? null
  }));

  const employees = (doc.employees ?? []).map((emp) => ({
    id: emp.id,
    name: emp.name,
    roleId: emp.roleId,
    roleName: findById(doc.roles, emp.roleId)?.name ?? emp.roleId,
    cliId: emp.cliId,
    maxConcurrentSessions: emp.maxConcurrentSessions ?? 1
  }));

  const teams = (doc.teams ?? []).map((team) => {
    const readiness = checkTeam(doc, team);
    return {
      id: team.id,
      name: team.name,
      leadRoleId: team.leadRoleId,
      leadName: findById(doc.roles, team.leadRoleId)?.name ?? team.leadRoleId,
      runMode: team.runMode,
      gates: team.gates,
      flowId: team.flowId,
      roleCount: (team.roleIds ?? []).length,
      employeeCount: teamMembers(doc, team).reduce((n, row) => n + row.employees.length, 0),
      ready: readiness.ok,
      errors: readiness.errors,
      missingCodes: readiness.coverage?.missing ?? [],
      members: teamMembers(doc, team).map((row) => ({
        roleId: row.roleId,
        roleName: row.roleName,
        code: row.code,
        isLead: row.isLead,
        employees: row.employees
      }))
    };
  });

  const flows = (doc.flows ?? []).map((flow) => ({
    id: flow.id,
    name: flow.titleKey && typeof T[flow.titleKey] === 'string' ? T[flow.titleKey] : (flow.name || flow.id),
    kind: flow.kind,
    runMode: flow.runMode,
    stageCount: (flow.stages ?? []).length,
    gates: flow.gates,
    stages: (flow.stages ?? []).map((stage) => ({
      id: stage.id,
      title: stageTitle(flow, stage),
      roleCodes: stage.roleCodes ?? [],
      gate: stage.gate ?? null,
      artifacts: (stage.artifacts ?? []).map((id) => ({ id, title: artifactTitle(id) })),
      parallel: stage.parallel === true
    })),
    edges: (flow.edges ?? []).map((edge) => `${edge.from}->${edge.to}`)
  }));

  const runs = (doc.runs ?? []).slice().reverse().map((run) => {
    const flow = findById(doc.flows, run.flowId);
    return {
      id: run.id,
      status: run.status,
      mode: run.mode,
      teamId: run.teamId,
      flowId: run.flowId,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      progress: {
        done: run.stages.filter((s) => s.status === 'done').length,
        total: run.stages.length
      },
      stages: run.stages.map((slot) => ({
        id: slot.stageId,
        title: flow ? stageTitle(flow, findById(flow.stages, slot.stageId) ?? { id: slot.stageId }) : slot.stageId,
        status: slot.status,
        gate: slot.gate ?? null,
        gateStatus: slot.gateStatus ?? null,
        artifactCount: (slot.artifacts ?? []).length,
        taskId: slot.taskId ?? null
      }))
    };
  });

  return {
    ok: true,
    root,
    schemaVersion: doc.schemaVersion,
    updatedAt: doc.updatedAt,
    departments: (doc.departments ?? []).map((dept) => ({
      id: dept.id,
      label: labelize(dept),
      roleCount: (doc.roles ?? []).filter((role) => role.departmentId === dept.id).length
    })),
    roles,
    employees,
    teams,
    flows,
    runs,
    tasks: (doc.tasks ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      runId: task.runId,
      stageId: task.stageId,
      status: task.status,
      roleId: task.roleId
    })),
    defects: doc.defects ?? [],
    changes: doc.changes ?? [],
    sessions: doc.sessions ?? [],
    clis: clis.map((cli) => ({
      id: cli.cli_id,
      name: cli.name,
      executable: cli.executable ?? null,
      status: cli.connection_status,
      acp: cli.acp ?? null,
      version: cli.version ?? null
    })),
    readiness: { ok: org.ok, errors: org.errors, warnings: org.warnings },
    seedDepartments: DEPARTMENT_SEEDS.length,
    roleCodes: ROLE_CODES,
    runModes: ['auto', 'semi', 'manual'],
    runModeLabels: { auto: T.MODE_AUTO, semi: T.MODE_SEMI, manual: T.MODE_MANUAL }
  };
}

/** Deterministic wrappers: each returns `{ok:true, ...}` or a domain failure. */
const ACTIONS = Object.freeze({
  async 'org.seed'(root, payload) {
    const cliLoaded = await loadCliRegistry(root);
    const clis = cliLoaded.ok ? (cliLoaded.registry.clis ?? []) : [];
    const cliId = typeof payload.cli === 'string' && payload.cli.length > 0
      ? payload.cli
      : (clis[0]?.cli_id ?? 'unbound');
    let counts = { roles: 0, employees: 0 };
    const saved = await updateStudio(root, (doc) => {
      counts = seedOrganization(doc, {
        cliId,
        perRole: Number(payload.perRole) > 0 ? Number(payload.perRole) : 1,
        addRole,
        addEmployee,
        employeesOfRole,
        label: (key, fallback) => t(key, fallback)
      });
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, counts, cliId };
  },

  async 'role.add'(root, payload) {
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = addRole(doc, {
        name: payload.name,
        code: payload.code ?? null,
        departmentId: payload.departmentId ?? 'product',
        duty: payload.duty ?? ''
      });
      if (!result.ok) return result;
      created = result.role;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, role: created };
  },

  async 'emp.add'(root, payload) {
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = addEmployee(doc, {
        name: payload.name,
        roleId: payload.roleId ?? payload.role,
        cliId: payload.cliId ?? payload.cli,
        maxConcurrentSessions: Number(payload.maxConcurrentSessions) > 0
          ? Number(payload.maxConcurrentSessions)
          : 1
      });
      if (!result.ok) return result;
      created = result.employee;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, employee: created };
  },

  async 'team.create'(root, payload) {
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const result = createTeam(doc, {
        name: payload.name,
        leadRoleId: payload.leadRoleId ?? payload.lead,
        roleIds: Array.isArray(payload.roleIds) ? payload.roleIds : [],
        flowId: payload.flowId ?? null,
        runMode: payload.runMode ?? 'semi',
        gates: Array.isArray(payload.gates) ? payload.gates : undefined
      });
      if (!result.ok) return result;
      created = result.team;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, team: created };
  },

  async 'team.update'(root, payload) {
    let updated = null;
    const saved = await updateStudio(root, (doc) => {
      const result = updateTeam(doc, payload.teamId, {
        name: payload.name,
        flowId: payload.flowId === undefined ? undefined : payload.flowId,
        runMode: payload.runMode,
        gates: Array.isArray(payload.gates) ? payload.gates : undefined,
        addRole: payload.addRole
      });
      if (!result.ok) return result;
      updated = result.team;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, team: updated };
  },

  async 'flow.create'(root, payload) {
    let created = null;
    const saved = await updateStudio(root, (doc) => {
      const spec = payload.template === 'rd-12'
        ? { template: 'rd-12' }
        : { stages: payload.stages ?? [], edges: payload.edges ?? [] };
      const result = createFlow(doc, {
        ...spec,
        name: payload.name ?? '',
        id: payload.id,
        runMode: payload.runMode ?? 'semi'
      });
      if (!result.ok) return result;
      created = result.flow;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, flow: created };
  },

  async 'run.start'(root, payload) {
    const loaded = await loadStudio(root);
    if (!loaded.ok) return loaded;
    const doc = loaded.doc;
    const mode = payload.mode ?? 'simulate';
    const started = await startRun({
      root,
      doc,
      teamId: payload.teamId,
      flowId: payload.flowId ?? null,
      mode
    });
    if (!started.ok) return started;
    let engine = null;
    if (mode === 'engine') {
      const team = findById(doc.teams, started.run.teamId);
      const flow = findById(doc.flows, started.run.flowId);
      const prepared = await engineRun({ root, doc, run: started.run, team, flow });
      if (!prepared.ok) return prepared;
      engine = prepared;
    }
    const persisted = await updateStudio(root, (target) => {
      target.runs = doc.runs;
      target.tasks = doc.tasks;
      return { ok: true };
    });
    if (!persisted.ok) return persisted;
    return { ok: true, run: started.run, waiting: started.waiting ?? null, engine };
  },

  async 'run.approve'(root, payload) {
    const loaded = await loadStudio(root);
    if (!loaded.ok) return loaded;
    const doc = loaded.doc;
    const result = await approveRun({
      root,
      doc,
      runId: payload.runId,
      stageId: payload.stageId ?? null,
      approve: payload.approve !== false
    });
    if (!result.ok) return result;
    const persisted = await updateStudio(root, (target) => {
      target.runs = doc.runs;
      target.tasks = doc.tasks;
      return { ok: true };
    });
    if (!persisted.ok) return persisted;
    return { ok: true, run: result.run, waiting: result.waiting ?? null, approvedStage: result.approvedStage ?? null };
  },

  async 'task.change'(root, payload) {
    let result = null;
    const saved = await updateStudio(root, (doc) => {
      const raised = raiseRequirementGap(doc, {
        runId: payload.runId,
        stageId: payload.stageId,
        summary: payload.summary,
        severity: payload.severity,
        taskId: payload.taskId
      });
      if (!raised.ok) return raised;
      result = raised;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, change: result.change, defect: result.defect, task: result.task };
  },

  async 'cli.scan'(root) {
    const loaded = await loadCliRegistry(root);
    if (!loaded.ok) return loaded;
    const scan = discoverAgentClis({ userConfig: loaded.registry.user_config });
    const saved = await saveCliRegistry(root, scan, { userConfig: loaded.registry.user_config });
    if (!saved.ok) return saved;
    return { ok: true, count: scan.findings.length, findings: scan.findings };
  }
});

export function createStudioRoutes({ root }) {
  return [
    {
      method: 'GET',
      pattern: '/studio/state',
      async handler(_req, res) {
        try {
          const state = await buildState(root);
          if (!state.ok) return fail(res, state);
          return sendJson(res, 200, state);
        } catch (err) {
          return sendJson(res, 500, { ok: false, code: 'STUDIO_STATE_FAILED', message: err?.message ?? String(err) });
        }
      }
    },
    {
      method: 'GET',
      pattern: '/studio/labels',
      handler(_req, res) {
        return sendJson(res, 200, { ok: true, labels: T });
      }
    },
    {
      method: 'POST',
      pattern: '/studio/action',
      async handler(req, res) {
        let payload;
        try {
          payload = JSON.parse((await readBody(req, BODY_LIMIT)) || '{}');
        } catch {
          return sendJson(res, 200, { ok: false, code: 'STUDIO_BAD_BODY', labelKey: null, params: {} });
        }
        const action = typeof payload?.action === 'string' ? payload.action : '';
        const fn = ACTIONS[action];
        if (typeof fn !== 'function') {
          return sendJson(res, 200, { ok: false, code: 'STUDIO_ACTION_UNKNOWN', labelKey: null, params: { action } });
        }
        try {
          const result = await fn(root, payload ?? {});
          if (!result.ok) return fail(res, result);
          return sendJson(res, 200, result);
        } catch (err) {
          return sendJson(res, 500, { ok: false, code: 'STUDIO_ACTION_FAILED', message: err?.message ?? String(err) });
        }
      }
    }
  ];
}
