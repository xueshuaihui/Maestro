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
  updateRole,
  addEmployee,
  createTeam,
  checkTeam,
  createFlow,
  updateFlow,
  addStage,
  updateStage,
  removeStage,
  addFlowEdge,
  removeFlowEdge,
  updateTeam,
  startRun,
  approveRun,
  engineRun,
  raiseRequirementGap,
  teamMembers,
  listHosts,
  bindHost,
  removeHost,
  hostIdForCli,
  roleCoverage,
  DEPARTMENT_SEEDS,
  departmentLabelKey,
  ROLE_CODES
} from '../../studio/index.js';
import { errorLabelKey } from '../../studio/messages.js';
import { discoverAgentClis, loadCliRegistry, saveCliRegistry } from '../../adapter/cli-discovery/index.js';
import { STUDIO_TEXT as T, SKILL_DEFAULT_BODY } from '../../cli/labels.js';
import { seedOrganization } from '../../templates/studio-seed.js';
import { loadRegistry } from '../../registry/index.js';
import { checkSkillMeta, GROUPS, SKILL_SCHEMA_VERSION } from '../../registry/role-schema.js';
import { serializeSkill, atomicWrite } from '../../registry/asset-write.js';
import { projectSkillsDir } from '../../registry/assets.js';
import { isId } from '../../studio/schema.js';
import { createResource, updateResource, removeResource, restoreResource, collectRefs } from '../../resources/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { statePath } from '../../persistence/paths.js';

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
  // Custom departments carry a literal `name`; built-in seeds carry a label
  // key. Prefer the literal so a user-created department is visible by name.
  if (typeof dept.name === 'string' && dept.name.length > 0 && !dept.labelKey) {
    return dept.name;
  }
  const key = dept.labelKey ?? departmentLabelKey(dept.id);
  const translated = t(key, null);
  if (typeof translated === 'string' && translated.length > 0) return translated;
  return typeof dept.name === 'string' && dept.name.length > 0 ? dept.name : dept.id;
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

/**
 * Stage progress for an engine run, read from the instance it launched.
 *
 * The compiled node id is `${roleId}-${stageId}`, and a stage can own several
 * nodes (one per role), so a stage is done only when every one of its nodes is.
 * Returns null when the instance cannot be read: the caller then keeps the
 * statuses the studio recorded rather than inventing progress.
 */
async function readInstanceStages(root, instanceId, stageIds) {
  let state;
  try {
    state = JSON.parse(await fs.readFile(statePath(root, instanceId), 'utf8'));
  } catch {
    return null;
  }
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const byStage = new Map();
  for (const node of nodes) {
    const nodeId = typeof node?.nodeId === 'string' ? node.nodeId : '';
    const stageId = stageIds.find((id) => nodeId.endsWith(`-${id}`));
    if (!stageId) continue;
    const list = byStage.get(stageId) ?? [];
    // Node state lives in `state` (NODE_STATES), not `status`.
    list.push(String(node.state ?? ''));
    byStage.set(stageId, list);
  }
  const result = new Map();
  for (const [stageId, states] of byStage) {
    if (states.some((value) => value === 'failed' || value === 'cancelled')) {
      result.set(stageId, 'blocked');
    } else if (states.length > 0 && states.every((value) => value === 'done')) {
      result.set(stageId, 'done');
    } else if (states.some((value) => value === 'running' || value === 'review')) {
      result.set(stageId, 'running');
    } else {
      result.set(stageId, 'pending');
    }
  }
  return result;
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
    summary: role.summary ?? '',
    skills: role.skills ?? [],
    contract: role.contract ?? null,
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

  // An engine run executes in a real instance, and that instance is the only
  // source of truth for stage progress. A plan/simulate run has no instance and
  // keeps the statuses the studio recorded.
  const liveProgress = new Map();
  for (const run of doc.runs ?? []) {
    const instanceId = run.engine?.instanceId;
    if (typeof instanceId !== 'string' || instanceId.length === 0) continue;
    const stageIds = (run.stages ?? []).map((slot) => slot.stageId);
    const byStage = await readInstanceStages(root, instanceId, stageIds);
    if (byStage !== null) liveProgress.set(run.id, byStage);
  }

  const runs = (doc.runs ?? []).slice().reverse().map((run) => {
    const flow = findById(doc.flows, run.flowId);
    const live = liveProgress.get(run.id) ?? null;
    const stages = run.stages.map((slot) => ({
      id: slot.stageId,
      title: flow ? stageTitle(flow, findById(flow.stages, slot.stageId) ?? { id: slot.stageId }) : slot.stageId,
      // A missing entry in the instance means the stage has not started yet.
      status: live?.get(slot.stageId) ?? slot.status,
      gate: slot.gate ?? null,
      gateStatus: slot.gateStatus ?? null,
      artifactCount: (slot.artifacts ?? []).length,
      taskId: slot.taskId ?? null
    }));
    return {
      id: run.id,
      status: run.status,
      mode: run.mode,
      teamId: run.teamId,
      flowId: run.flowId,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      // The engine half of the run: whether a real instance was launched, and
      // which one. Null for plan/simulate, where no engine is involved.
      engine: run.engine ?? null,
      task: typeof run.task === 'string' ? run.task : null,
      progress: {
        done: stages.filter((stage) => stage.status === 'done').length,
        total: stages.length
      },
      stages
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
      archived: dept.archived === true,
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
      version: cli.version ?? null,
      bundled: cli.bundled === true,
      notOnPath: cli.not_on_path === true,
      // The ACP entrypoint is per-CLI (`acp`, `--acp`, `--profile acp`); the
      // page must not guess, or binding dsh starts a process that exits 1.
      acpArgs: Array.isArray(cli.acp_args) ? cli.acp_args : ['--acp']
    })),
    readiness: { ok: org.ok, errors: org.errors, warnings: org.warnings },
    // Hosts are what `POST /instances` actually needs; surfacing them here
    // means the instance page can tell "no runnable host" from "not scanned".
    hosts: (await listHosts(root)).hosts ?? [],
    seedDepartments: DEPARTMENT_SEEDS.length,
    roleCodes: ROLE_CODES,
    runModes: ['auto', 'semi', 'manual'],
    runModeLabels: { auto: T.MODE_AUTO, semi: T.MODE_SEMI, manual: T.MODE_MANUAL }
  };
}

/**
 * A free `flow-<n>` id for a create without an explicit id.
 *
 * The page used to let `createFlow` derive the id from the template (`rd-12`),
 * so the second "create workflow" click always failed with
 * `STUDIO_FLOW_EXISTS` — the button looked broken. A generated id keeps the
 * domain rule ("explicit duplicate id is an error") intact while making the
 * button idempotent-by-identity: every click really creates a new flow.
 */
function nextFlowId(doc) {
  const used = new Set((doc.flows ?? []).map((flow) => flow.id));
  let n = used.size + 1;
  let id = `flow-${n}`;
  while (used.has(id)) {
    n += 1;
    id = `flow-${n}`;
  }
  return id;
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
        duty: payload.duty ?? '',
        summary: payload.summary ?? '',
        inputs: payload.inputs ?? [],
        outputs: payload.outputs ?? [],
        skills: payload.skills ?? [],
        requires: payload.requires ?? {}
      });
      if (!result.ok) return result;
      created = result.role;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, role: created };
  },

  async 'role.update'(root, payload) {
    let updated = null;
    const saved = await updateStudio(root, (doc) => {
      const patch = {};
      for (const field of ['name', 'summary', 'duty', 'departmentId', 'code']) {
        if (payload[field] !== undefined) patch[field] = payload[field];
      }
      if (Array.isArray(payload.skills)) patch.skills = payload.skills;
      if (payload.requires !== undefined && typeof payload.requires === 'object') {
        patch.requires = payload.requires;
      }
      const contract = {};
      if (Array.isArray(payload.inputs)) contract.inputs = payload.inputs;
      if (Array.isArray(payload.outputs)) contract.outputs = payload.outputs;
      if (typeof payload.doneWhen === 'string') contract.doneWhen = payload.doneWhen;
      if (Object.keys(contract).length > 0) patch.contract = contract;
      const result = updateRole(doc, payload.id ?? payload.role, patch);
      if (!result.ok) return result;
      updated = result.role;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, role: updated };
  },

  async 'skill.create'(root, payload) {
    const skillId = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (!isId(skillId)) return { ok: false, code: 'STUDIO_ID_INVALID', params: { id: skillId } };
    const registry = loadRegistry({ root });
    const existing = registry.skillMap.get(skillId);
    if (existing?.source === 'builtin') {
      return { ok: false, code: 'STUDIO_SKILL_READONLY', params: { id: skillId } };
    }
    if (existing && payload.force !== true) {
      return { ok: false, code: 'STUDIO_SKILL_EXISTS', params: { id: skillId } };
    }
    const meta = {
      schema: SKILL_SCHEMA_VERSION,
      id: skillId,
      name: typeof payload.name === 'string' ? payload.name.trim() : '',
      summary: typeof payload.summary === 'string' ? payload.summary.trim() : ''
    };
    const appliesTo = Array.isArray(payload.appliesTo)
      ? payload.appliesTo.filter((v) => typeof v === 'string')
      : [];
    if (appliesTo.length > 0) {
      const bad = appliesTo.find((group) => !GROUPS.includes(group));
      if (bad) return { ok: false, code: 'SKILL_GROUP_INVALID', params: { value: bad } };
      meta.applies_to = appliesTo;
    }
    if (Array.isArray(payload.commands) && payload.commands.every((v) => typeof v === 'string')) {
      meta.commands = payload.commands;
    }
    const issues = checkSkillMeta(meta, { dirId: skillId });
    if (issues.length > 0) return { ok: false, code: issues[0].code, params: issues[0].params ?? {} };
    const body = typeof payload.body === 'string' && payload.body.trim().length > 0
      ? payload.body
      : SKILL_DEFAULT_BODY;
    const target = path.join(projectSkillsDir(root), skillId, 'SKILL.md');
    const written = await atomicWrite({ target, text: serializeSkill(meta, body) });
    if (!written.ok) return written;
    return { ok: true, skill: { id: skillId, name: meta.name, appliesTo, file: `.orch/skills/${skillId}/SKILL.md` } };
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
      const result = updateTeam(doc, payload.teamId ?? payload.id, {
        name: payload.name,
        flowId: payload.flowId === undefined ? undefined : payload.flowId,
        runMode: payload.runMode,
        gates: Array.isArray(payload.gates) ? payload.gates : undefined,
        // The team form sets the whole member set in one save; `addRole` /
        // `removeRole` stay for the CLI's incremental verbs.
        roleIds: Array.isArray(payload.roleIds) ? payload.roleIds : undefined,
        leadRoleId: typeof payload.leadRoleId === 'string' ? payload.leadRoleId : undefined,
        addRole: typeof payload.addRole === 'string' ? payload.addRole : undefined
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
      // `builtin` means "instantiate the built-in organisation flow under a
      // fresh id"; the caller never has to know the template id.
      const builtin = payload.builtin === true || payload.template === 'rd-12';
      const spec = builtin
        ? { template: 'rd-12' }
        : { stages: payload.stages ?? [], edges: payload.edges ?? [] };
      const explicitId = typeof payload.id === 'string' && payload.id.trim().length > 0
        ? payload.id.trim()
        : null;
      const rawName = typeof payload.name === 'string' ? payload.name.trim() : '';
      // An unnamed template instance still needs a human name; showing the
      // generated id in every list is what made "新建工作流" look like it
      // produced a broken row.
      const name = rawName.length > 0 || !builtin ? rawName : t('FLOW_RD12');
      const result = createFlow(doc, {
        ...spec,
        name,
        id: explicitId ?? nextFlowId(doc),
        runMode: payload.runMode ?? 'semi'
      });
      if (!result.ok) return result;
      created = result.flow;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, flow: created };
  },

  async 'flow.update'(root, payload) {
    let updated = null;
    const saved = await updateStudio(root, (doc) => {
      const patch = {};
      if (payload.name !== undefined) patch.name = payload.name;
      if (payload.runMode !== undefined) patch.runMode = payload.runMode;
      const result = updateFlow(doc, payload.flowId ?? payload.id, patch);
      if (!result.ok) return result;
      updated = result.flow;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, flow: updated };
  },

  async 'flow.stage.add'(root, payload) {
    let stage = null;
    const saved = await updateStudio(root, (doc) => {
      const result = addStage(doc, payload.flowId ?? payload.flow, {
        name: payload.name,
        id: payload.stageId,
        roleCodes: payload.roleCodes,
      });
      if (!result.ok) return result;
      stage = result.stage;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, stage };
  },

  async 'flow.stage.update'(root, payload) {
    let stage = null;
    const saved = await updateStudio(root, (doc) => {
      const result = updateStage(doc, payload.flowId ?? payload.flow, payload.stageId ?? payload.id, {
        name: payload.name,
        roleCodes: payload.roleCodes,
        gate: payload.gate,
      });
      if (!result.ok) return result;
      stage = result.stage;
      return { ok: true };
    });
    if (!saved.ok) return saved;
    return { ok: true, stage };
  },

  async 'flow.stage.remove'(root, payload) {
    const saved = await updateStudio(root, (doc) => removeStage(
      doc, payload.flowId ?? payload.flow, payload.stageId ?? payload.id
    ));
    return saved.ok ? { ok: true } : saved;
  },

  async 'flow.edge.add'(root, payload) {
    const saved = await updateStudio(root, (doc) => addFlowEdge(
      doc, payload.flowId ?? payload.flow, payload.from, payload.to
    ));
    return saved.ok ? { ok: true } : saved;
  },

  async 'flow.edge.remove'(root, payload) {
    const saved = await updateStudio(root, (doc) => removeFlowEdge(
      doc, payload.flowId ?? payload.flow, payload.from, payload.to
    ));
    return saved.ok ? { ok: true } : saved;
  },

  async 'run.start'(root, payload) {
    const loaded = await loadStudio(root);
    if (!loaded.ok) return loaded;
    const doc = loaded.doc;
    const mode = payload.mode ?? 'simulate';
    // The task text is what the engine hands to the agents. It only matters
    // in `engine` mode, but it travels with the run so a later retry can reuse
    // the same wording instead of asking the user to type it again.
    const task = typeof payload.task === 'string' ? payload.task : '';
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
      // The CLI registry is machine-level; reading it here keeps the domain
      // module free of adapter imports.
      const cliLoaded = await loadCliRegistry(root);
      const clis = cliLoaded.ok ? cliLoaded.registry.clis : [];
      const prepared = await engineRun({
        root,
        doc,
        run: started.run,
        team,
        flow,
        clis,
        // The daemon owns the orchestrator, so the launch is injected. Without
        // an injector the run still prepares its yaml and says it did not
        // start, which is the honest fallback for a non-daemon caller.
        launch: typeof startEngine === 'function'
          ? ({ workflowId }) => startEngine({
            workflowId,
            task,
            hostId: typeof payload.hostId === 'string' && payload.hostId.length > 0 ? payload.hostId : null
          })
          : null
      });
      if (!prepared.ok) return prepared;
      engine = prepared;
      if (typeof task === 'string' && task.length > 0) started.run.task = task;
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

  async 'host.list'(root) {
    return listHosts(root);
  },

  /**
   * Bind a discovered CLI as a runnable host.
   *
   * The only caller is the instance page: without this the scan can report
   * "opencode is here" forever while `POST /instances` keeps failing on a
   * missing `.orch/hosts/*.json`.
   */
  async 'host.bind'(root, payload) {
    return bindHost(root, {
      id: payload.id ?? (payload.cliId ? hostIdForCli(payload.cliId) : undefined),
      cliId: payload.cliId,
      command: payload.executable ?? payload.command,
      args: payload.acpArgs ?? payload.args,
      permissionPolicy: payload.permissionPolicy ?? null
    });
  },

  async 'host.remove'(root, payload) {
    return removeHost(root, payload.id);
  },

  async 'cli.scan'(root) {
    const loaded = await loadCliRegistry(root);
    if (!loaded.ok) return loaded;
    const scan = discoverAgentClis({ userConfig: loaded.registry.user_config });
    const saved = await saveCliRegistry(root, scan, { userConfig: loaded.registry.user_config });
    if (!saved.ok) return saved;
    // Mark the findings a host already exists for: the page must not offer
    // "bind" twice for the same executable.
    const bound = await listHosts(root);
    const byCommand = new Map();
    for (const host of bound.ok ? bound.hosts : []) {
      if (host.command) byCommand.set(host.command, host.id);
    }
    const findings = scan.findings.map((item) => ({
      ...item,
      bound_host: item.executable ? (byCommand.get(item.executable) ?? null) : null
    }));
    return { ok: true, count: findings.length, findings };
  },

  // -------------------------------------------------------------------------
  // Maintenance actions. Same domain functions the resource platform uses;
  // exposed here so the existing studio UI gains real delete/maintain without
  // a rewrite. All are additive - none of the 21 frozen actions changed.
  // -------------------------------------------------------------------------

  async 'dept.add'(root, payload) {
    return createResource(root, 'department', {
      id: payload.id,
      name: payload.name,
      labelKey: payload.labelKey ?? null
    });
  },

  async 'dept.update'(root, payload) {
    return updateResource(root, 'department', payload.id, {
      name: payload.name,
      labelKey: payload.labelKey
    });
  },

  async 'resource.remove'(root, payload) {
    const { type, id, force, archive } = payload;
    return removeResource(root, type, id, {
      force: force === true,
      archive: archive !== false
    });
  },

  async 'resource.restore'(root, payload) {
    return restoreResource(root, payload.type, payload.id);
  },

  async 'resource.refs'(root, payload) {
    return collectRefs(root, payload.type, payload.id);
  }
});

export function createStudioRoutes({ root, startEngine = null }) {
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
