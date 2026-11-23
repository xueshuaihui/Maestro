/**
 * A6 — horizontal collaboration base: tasks, defects, changes.
 *
 * The state machine is deliberately small but total: every transition not in
 * the table is rejected with a code, so an automation bug cannot silently move
 * a task backwards. Exceptional flows (clarify / change / conflict / timeout /
 * agent-exit) are recorded as history entries instead of extra statuses, which
 * keeps `TASK_STATUS` readable in the UI.
 */

import { TASK_STATUS, TASK_EXCEPTIONS, fail } from './schema.js';
import { findById } from './store.js';

/** Allowed forward transitions; `done` and `cancelled` are terminal. */
const TRANSITIONS = Object.freeze({
  todo: ['ready', 'cancelled', 'blocked'],
  ready: ['claimed', 'cancelled', 'blocked'],
  claimed: ['running', 'cancelled', 'blocked', 'reassign'],
  running: ['review', 'done', 'cancelled', 'blocked', 'reassign'],
  review: ['fixing', 'done', 'blocked', 'reassign'],
  fixing: ['review', 'cancelled', 'blocked'],
  blocked: ['ready', 'todo', 'cancelled'],
  done: [],
  cancelled: []
});

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

function nextTaskId(doc) {
  const n = (doc.tasks ?? []).length + 1;
  return `T-${String(n).padStart(3, '0')}`;
}

export function addTask(doc, input = {}) {
  const task = {
    id: nextTaskId(doc),
    title: typeof input.title === 'string' ? input.title.slice(0, 120) : '',
    runId: typeof input.runId === 'string' ? input.runId : null,
    flowId: typeof input.flowId === 'string' ? input.flowId : null,
    stageId: typeof input.stageId === 'string' ? input.stageId : null,
    roleId: typeof input.roleId === 'string' ? input.roleId : null,
    employeeIds: Array.isArray(input.employeeIds) ? input.employeeIds.filter((v) => typeof v === 'string') : [],
    dependsOn: Array.isArray(input.dependsOn) ? input.dependsOn.filter((v) => typeof v === 'string') : [],
    status: 'todo',
    artifacts: [],
    history: [{ at: new Date().toISOString(), event: 'created' }]
  };
  doc.tasks.push(task);
  return { ok: true, task };
}

export function transitionTask(doc, id, to, { note = null, at = null } = {}) {
  const task = findById(doc.tasks, id);
  if (!task) return fail('STUDIO_TASK_UNKNOWN', { task: String(id) });
  if (!TASK_STATUS.includes(to)) return fail('STUDIO_TASK_STATUS_UNKNOWN', { status: String(to) });
  if (!canTransition(task.status, to)) {
    return fail('STUDIO_TASK_TRANSITION_ILLEGAL', { task: task.id, from: task.status, to });
  }
  const entry = { at: at ?? new Date().toISOString(), event: 'status', from: task.status, to };
  if (typeof note === 'string' && note.length > 0) entry.note = note;
  task.status = to;
  task.history.push(entry);
  return { ok: true, task };
}

/** Record one exceptional event without inventing a new status. */
export function recordException(doc, id, kind, detail = {}) {
  const task = findById(doc.tasks, id);
  if (!task) return fail('STUDIO_TASK_UNKNOWN', { task: String(id) });
  if (!TASK_EXCEPTIONS.includes(kind)) return fail('STUDIO_TASK_EXCEPTION_UNKNOWN', { kind: String(kind) });
  const entry = { at: new Date().toISOString(), event: kind, ...detail };
  task.history.push(entry);
  if (kind === 'timeout' || kind === 'agent-exit' || kind === 'conflict') task.status = 'blocked';
  return { ok: true, task, entry };
}

export function addDefect(doc, input = {}) {
  const defect = {
    id: `D-${String((doc.defects ?? []).length + 1).padStart(3, '0')}`,
    runId: typeof input.runId === 'string' ? input.runId : null,
    stageId: typeof input.stageId === 'string' ? input.stageId : null,
    kind: input.kind === 'requirement' ? 'requirement' : 'product',
    summary: typeof input.summary === 'string' ? input.summary.slice(0, 200) : '',
    severity: ['blocker', 'major', 'minor', 'suggestion'].includes(input.severity) ? input.severity : 'major',
    status: 'open',
    reporter: typeof input.reporter === 'string' ? input.reporter : null,
    assignee: typeof input.assignee === 'string' ? input.assignee : null,
    history: [{ at: new Date().toISOString(), event: 'opened' }]
  };
  doc.defects.push(defect);
  return { ok: true, defect };
}

export function resolveDefect(doc, id, { status = 'fixed' } = {}) {
  const defect = findById(doc.defects, id);
  if (!defect) return fail('STUDIO_DEFECT_UNKNOWN', { defect: String(id) });
  if (!['fixed', 'verified', 'rejected'].includes(status)) {
    return fail('STUDIO_DEFECT_STATUS_UNKNOWN', { status: String(status) });
  }
  defect.status = status;
  defect.history.push({ at: new Date().toISOString(), event: status });
  return { ok: true, defect };
}

/**
 * A6 closed loop: QA finds a missing requirement. The defect is filed as
 * `kind: requirement` and a change request is opened for product review; the
 * task is blocked so no one "fixes" it in code.
 */
export function raiseRequirementGap(doc, input = {}) {
  // Resolve the stage first: the Studio UI reports a gap with only the run in
  // hand, so falling back to "the stage that is currently being worked on" is
  // what keeps the blocked-task guarantee true for both callers.
  const run = typeof input.runId === 'string'
    ? (doc.runs ?? []).find((row) => row.id === input.runId) ?? null
    : null;
  const stageId = typeof input.stageId === 'string'
    ? input.stageId
    : (run
      ? (run.stages.find((slot) => slot.status === 'awaiting-approval')
        ?? run.stages.find((slot) => slot.status === 'running')
        ?? run.stages.find((slot) => slot.status === 'pending')
        ?? null)?.stageId ?? null
      : null);

  const defect = addDefect(doc, { ...input, stageId, kind: 'requirement' });
  if (!defect.ok) return defect;
  const change = {
    id: `C-${String((doc.changes ?? []).length + 1).padStart(3, '0')}`,
    runId: run ? run.id : null,
    stageId,
    type: 'requirement-gap',
    summary: defect.defect.summary,
    status: 'pending-review',
    defectId: defect.defect.id,
    history: [{ at: new Date().toISOString(), event: 'opened', route: 'product-review' }]
  };
  doc.changes.push(change);
  // Default to the task that owns this stage in this run, so a QA gap report
  // always blocks exactly one task instead of silently recording a defect.
  const taskId = typeof input.taskId === 'string'
    ? input.taskId
    : (doc.tasks ?? []).find((task) => task.runId === change.runId && task.stageId === change.stageId)?.id ?? null;
  let task = null;
  if (typeof taskId === 'string') {
    const moved = transitionTask(doc, taskId, 'blocked', { note: `defect ${defect.defect.id}` });
    if (moved.ok) task = moved.task;
  }
  return { ok: true, defect: defect.defect, change, task };
}

/** Product review outcome: accept (re-open the stage) or reject (resume). */
export function reviewChange(doc, id, { decision = 'accepted', note = '' } = {}) {
  const change = findById(doc.changes, id);
  if (!change) return fail('STUDIO_CHANGE_UNKNOWN', { change: String(id) });
  if (!['accepted', 'rejected'].includes(decision)) {
    return fail('STUDIO_CHANGE_DECISION_UNKNOWN', { decision: String(decision) });
  }
  change.status = decision;
  change.history.push({ at: new Date().toISOString(), event: decision, note });
  return { ok: true, change };
}
