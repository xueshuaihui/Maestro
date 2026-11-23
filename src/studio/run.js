/**
 * A5 — end-to-end run: plan, gate, execute, archive.
 *
 * Three honest execution modes:
 *   - `plan`      : build the run record + tasks, touch nothing else;
 *   - `simulate`  : walk the DAG, respect gates, write artifact skeletons under
 *                   `.orch/kb/<runId>/` marked `mode: simulated` — this proves
 *                   the orchestration and the knowledge-base layout without
 *                   claiming a model ever ran;
 *   - `engine`    : additionally compile to `.orch/roles|workflows/*.yaml` and
 *                   report whether a host is configured. It never pretends a
 *                   real CLI session happened when there is no CLI.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { writeTextAtomic } from '../persistence/atomic-write.js';
import { fail } from './schema.js';
import { findById } from './store.js';
import { employeesOfRole } from './org.js';
import { topoOrder } from './flow.js';
import { checkTeam } from './team.js';
import { addTask, transitionTask } from './tasks.js';
import { compileStudio } from './compile.js';
import { hostConfigPath } from '../adapter/host-config.js';

const KB_DIR = '.orch/kb';
const ENGINE_ROLES_DIR = '.orch/roles';
const ENGINE_FLOWS_DIR = '.orch/workflows';

export const RUN_MODES = Object.freeze(['plan', 'simulate', 'engine']);

function runIdFor(doc) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const taken = new Set((doc.runs ?? []).map((r) => r.id));
  let id = `R-${stamp}`;
  let n = 2;
  while (taken.has(id)) {
    id = `R-${stamp}-${n}`;
    n += 1;
  }
  return id;
}

/**
 * Static plan: which role/employees own each stage, in dependency order.
 * @returns {{ok:true, order:string[], stages:Array}|{ok:false,code:string,params:object}}
 */
export function planRun(doc, team, flow) {
  const readiness = checkTeam(doc, team);
  if (!readiness.ok) return fail('STUDIO_TEAM_NOT_READY', { errors: readiness.errors });
  const order = topoOrder(flow);
  if (order === null) return fail('STUDIO_FLOW_CYCLE');

  const roleByCode = new Map();
  for (const roleId of team.roleIds ?? []) {
    const role = findById(doc.roles, roleId);
    if (role && typeof role.code === 'string') roleByCode.set(role.code, role);
  }

  const stages = order.map((stageId) => {
    const stage = findById(flow.stages, stageId);
    const roleIds = [];
    for (const code of stage.roleCodes ?? []) {
      const role = roleByCode.get(code);
      if (role && !roleIds.includes(role.id)) roleIds.push(role.id);
    }
    const employees = roleIds.flatMap((roleId) => employeesOfRole(doc, roleId).map((emp) => emp.id));
    const dependsOn = (flow.edges ?? []).filter((edge) => edge.to === stageId).map((edge) => edge.from);
    return {
      stageId,
      titleKey: stage.titleKey ?? null,
      name: stage.name ?? '',
      roleIds,
      employeeIds: employees,
      gate: stage.gate ?? null,
      artifacts: stage.artifacts ?? [],
      parallel: stage.parallel === true,
      dependsOn
    };
  });
  return { ok: true, order, stages };
}

function artifactBody({ run, stage, artifact, employees }) {
  const lines = [
    '---',
    `run: ${run.id}`,
    `stage: ${stage.stageId}`,
    `artifact: ${artifact}`,
    `roles: ${stage.roleIds.join(',')}`,
    `employees: ${stage.employeeIds.join(',')}`,
    `gate: ${stage.gate ?? 'none'}`,
    `mode: ${run.mode}`,
    `generated_at: ${new Date().toISOString()}`,
    '---',
    '',
    `# ${artifact}`,
    '',
    'This artifact was produced by the studio orchestrator to prove the',
    'knowledge-base layout and the stage ordering. It contains no model output.',
    '',
    `- stage: ${stage.stageId}`,
    `- depends_on: ${stage.dependsOn.join(',') || 'none'}`,
    `- parallel_roles: ${stage.roleIds.length}`,
    ''
  ];
  return lines.join('\n');
}

async function writeArtifacts(root, run, stage) {
  const dir = path.join(root, KB_DIR, run.id, stage.stageId);
  const files = [];
  for (const artifact of stage.artifacts) {
    const target = path.join(dir, `${artifact}.md`);
    const written = await writeTextAtomic(target, artifactBody({ run, stage, artifact, employees: stage.employeeIds }));
    if (!written.ok) return written;
    files.push(path.relative(root, target));
  }
  return { ok: true, files };
}

async function writeRunSummary(root, run, flow) {
  const target = path.join(root, KB_DIR, run.id, 'run.md');
  const lines = [
    `# ${run.id}`,
    '',
    `- team: ${run.teamId}`,
    `- flow: ${flow.id}`,
    `- mode: ${run.mode}`,
    `- status: ${run.status}`,
    `- started_at: ${run.startedAt}`,
    `- finished_at: ${run.finishedAt ?? ''}`,
    '',
    '| stage | status | roles | gate |',
    '|---|---|---|---|',
    ...run.stages.map((s) => `| ${s.stageId} | ${s.status} | ${s.roleIds.join(',')} | ${s.gate ?? 'none'} |`),
    ''
  ];
  return writeTextAtomic(target, lines.join('\n'));
}

/**
 * Create a run. Tasks are created with cross-stage dependencies so the task
 * board (A6) reflects the same DAG the flow declares.
 */
export async function startRun({ root, doc, teamId, flowId, mode = 'simulate' }) {
  if (!RUN_MODES.includes(mode)) return fail('STUDIO_RUN_MODE_UNKNOWN', { mode: String(mode) });
  const team = findById(doc.teams, teamId) ?? null;
  if (!team) return fail('STUDIO_TEAM_UNKNOWN', { team: String(teamId) });
  const flow = findById(doc.flows, flowId ?? team.flowId ?? '') ?? null;
  if (!flow) return fail('STUDIO_FLOW_UNKNOWN', { flow: String(flowId ?? team.flowId ?? '') });

  const planned = planRun(doc, team, flow);
  if (!planned.ok) return planned;

  const run = {
    id: runIdFor(doc),
    teamId: team.id,
    flowId: flow.id,
    mode,
    status: mode === 'plan' ? 'planned' : 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stages: planned.stages.map((stage) => ({
      stageId: stage.stageId,
      status: 'pending',
      roleIds: stage.roleIds,
      employeeIds: stage.employeeIds,
      gate: stage.gate,
      gateStatus: stage.gate ? 'pending' : null,
      artifacts: [],
      taskId: null
    }))
  };
  doc.runs.push(run);

  const taskIdByStage = new Map();
  for (const stage of planned.stages) {
    const deps = stage.dependsOn.map((id) => taskIdByStage.get(id)).filter(Boolean);
    const created = addTask(doc, {
      title: `${run.id}/${stage.stageId}`,
      runId: run.id,
      flowId: flow.id,
      stageId: stage.stageId,
      roleId: stage.roleIds[0] ?? null,
      employeeIds: stage.employeeIds,
      dependsOn: deps
    });
    taskIdByStage.set(stage.stageId, created.task.id);
    const slot = run.stages.find((s) => s.stageId === stage.stageId);
    slot.taskId = created.task.id;
  }

  if (mode !== 'plan') {
    const advanced = await advanceRun({ root, doc, run, flow, team });
    if (!advanced.ok) return advanced;
  } else {
    const summary = await writeRunSummary(root, run, flow);
    if (!summary.ok) return summary;
  }
  return { ok: true, run, planned };
}

/**
 * Walk the DAG once. Stages whose predecessors are not done stay pending; a
 * gate under a non-auto run mode stops the walk (A4 "半自动模式下门禁确实拦截").
 */
export async function advanceRun({ root, doc, run, flow, team }) {
  for (const stageId of topoOrder(flow) ?? []) {
    const slot = run.stages.find((s) => s.stageId === stageId);
    if (!slot || slot.status === 'done') continue;
    const stage = findById(flow.stages, stageId);
    const deps = (flow.edges ?? []).filter((edge) => edge.to === stageId).map((edge) => edge.from);
    const blocked = deps.some((dep) => run.stages.find((s) => s.stageId === dep)?.status !== 'done');
    if (blocked) continue;

    if (stage.gate && team.runMode !== 'auto' && slot.gateStatus !== 'approved') {
      slot.status = 'awaiting-approval';
      slot.gateStatus = 'pending';
      run.status = 'awaiting-approval';
      await writeRunSummary(root, run, flow);
      return { ok: true, waiting: { stageId, gate: stage.gate } };
    }

    slot.status = 'running';
    const written = await writeArtifacts(root, run, {
      stageId,
      roleIds: slot.roleIds,
      employeeIds: slot.employeeIds,
      gate: stage.gate,
      artifacts: stage.artifacts ?? [],
      dependsOn: deps
    });
    if (!written.ok) return written;
    slot.artifacts = written.files;
    slot.status = 'done';
    slot.finishedAt = new Date().toISOString();
    slot.gateStatus = stage.gate ? (team.runMode === 'auto' ? 'auto-approved' : 'approved') : null;

    if (slot.taskId) {
      const task = findById(doc.tasks, slot.taskId);
      if (task) {
        for (const to of ['ready', 'claimed', 'running', 'done']) {
          if (task.status === to) continue;
          const moved = transitionTask(doc, task.id, to, { note: `${run.id}/${stageId}` });
          if (!moved.ok) break;
        }
      }
    }
  }

  const allDone = run.stages.every((s) => s.status === 'done');
  run.status = allDone ? 'completed' : 'running';
  if (allDone) run.finishedAt = new Date().toISOString();
  const summary = await writeRunSummary(root, run, flow);
  if (!summary.ok) return summary;
  return { ok: true, run };
}

/** Human approval for one gated stage, then continue the walk. */
export async function approveRun({ root, doc, runId, stageId, approve = true }) {
  const run = findById(doc.runs, runId);
  if (!run) return fail('STUDIO_RUN_UNKNOWN', { run: String(runId) });
  const flow = findById(doc.flows, run.flowId);
  const team = findById(doc.teams, run.teamId);
  if (!flow || !team) return fail('STUDIO_RUN_BROKEN', { run: run.id });
  const slot = stageId
    ? run.stages.find((s) => s.stageId === stageId)
    : run.stages.find((s) => s.status === 'awaiting-approval');
  if (!slot) return fail('STUDIO_RUN_NO_GATE', { run: run.id });
  if (slot.status !== 'awaiting-approval') return fail('STUDIO_RUN_GATE_NOT_PENDING', { stage: slot.stageId });

  if (!approve) {
    slot.gateStatus = 'rejected';
    slot.status = 'blocked';
    run.status = 'blocked';
    await writeRunSummary(root, run, flow);
    return { ok: true, run, rejected: slot.stageId };
  }
  slot.gateStatus = 'approved';
  slot.status = 'pending';
  run.status = 'running';
  const approvedStage = slot.stageId;
  const advanced = await advanceRun({ root, doc, run, flow, team });
  if (!advanced.ok) return advanced;
  return { ok: true, run, approvedStage, waiting: advanced.waiting ?? null };
}

/** Compile the run's team+flow into engine assets (B bridge, no process). */
export async function prepareEngine({ root, doc, team, flow }) {
  const compiled = compileStudio({ doc, team, flow });
  if (!compiled.ok) return compiled;
  const written = [];
  for (const role of compiled.roles) {
    const target = path.join(root, ENGINE_ROLES_DIR, `${role.id}.yaml`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const out = await writeTextAtomic(target, role.yaml);
    if (!out.ok) return out;
    written.push(path.relative(root, target));
  }
  const flowTarget = path.join(root, ENGINE_FLOWS_DIR, `${compiled.workflow.id}.yaml`);
  await fs.mkdir(path.dirname(flowTarget), { recursive: true });
  const out = await writeTextAtomic(flowTarget, compiled.yaml);
  if (!out.ok) return out;
  written.push(path.relative(root, flowTarget));

  const hosts = ['.orch/hosts/dsh.json', '.orch/hosts/workbuddy.json'].map((p) => path.join(root, p));
  const available = [];
  for (const candidate of hosts) {
    try {
      await fs.access(candidate);
      available.push(path.relative(root, candidate));
    } catch {
      // A missing host config is the normal case on a machine with no CLI.
    }
  }
  return {
    ok: true,
    written,
    hostConfigured: available.length > 0,
    hosts: available,
    workflowId: compiled.workflow.id,
    roleIds: compiled.roles.map((role) => role.id)
  };
}

/** `engine` mode: prepare assets, then report whether a real run is possible. */
export async function engineRun({ root, doc, run, team, flow }) {
  const prepared = await prepareEngine({ root, doc, team, flow });
  if (!prepared.ok) return prepared;
  run.engine = {
    preparedAt: new Date().toISOString(),
    workflowId: prepared.workflowId,
    roleIds: prepared.roleIds,
    hostConfigured: prepared.hostConfigured,
    launched: false,
    reason: prepared.hostConfigured ? 'host_configured_launch_pending' : 'no_host_config'
  };
  if (!prepared.hostConfigured) {
    run.status = 'prepared';
    return { ok: true, prepared, launched: false, reason: 'no_host_config', hint: hostConfigPath(root) };
  }
  return { ok: true, prepared, launched: false, reason: 'host_configured_launch_pending' };
}
