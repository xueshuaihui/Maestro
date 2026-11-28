/** V3.2 契约：常量、对象形状校验、迁移表、版本辅助。其他任务统一从本文件 import。 */

import { fail, ok } from './errors.js';
import { ID_PATTERN, ID_PREFIX } from './ids.js';

export { ERROR_CODES, fail, fromError, isErrorCode, ok } from './errors.js';
export { ID_PATTERN, ID_PREFIX, formatId, parseSequence, resolvePrefix, snapshotId } from './ids.js';

export const V32_SCHEMA_VERSION = 1;
export const V32_STATE_FILE = '.orch/v32/state.json';
export const V32_EVENTS_FILE = '.orch/v32/events.jsonl';
export const V32_AUDIT_FILE = '.orch/v32/audit.jsonl';

/**
 * 状态枚举必须逐字对齐规格 §13（docs/index.md L634-667 / page_spec.md L701-733）。
 * 原型里的 waiting_queue / human_waiting / assignment.cancelled 不在规格内，禁止加入。
 */
export const WORK_ITEM_STATUS = Object.freeze([
  'draft', 'configured', 'ready_to_run', 'running', 'waiting_human', 'blocked',
  'ready_for_acceptance', 'accepted', 'delivered', 'cancelled'
]);
export const TASK_STATUS = Object.freeze([
  'waiting_dependency', 'ready', 'assignment_prepared', 'preflight', 'creating_session', 'running', 'succeeded',
  'interrupted', 'blocked', 'failed', 'cancelled', 'skipped'
]);
export const ASSIGNMENT_STATUS = Object.freeze([
  'draft', 'prepared', 'preflight', 'locked', 'released', 'failed'
]);
export const ASSET_STATUS = Object.freeze(['draft', 'published', 'deprecated']);
export const NODE_TYPES = Object.freeze(['agent', 'human']);

/** 审计类型全集（实现约定；人工审批 / 异常恢复 / 交付三类缺一不可）。 */
export const AUDIT_TYPES = Object.freeze([
  'role.published', 'employee.updated', 'team.published', 'team.deprecated',
  'workflow.published', 'workflow.deprecated', 'work_item.created', 'plan.revised',
  'mapping.changed', 'assignment.locked', 'session.created', 'recovery.succeeded',
  'recovery.failed', 'human.approved', 'delivery.accepted', 'delivery.delivered'
]);

/** 事件类型全集（实现约定）：所有任务只能从这里取值。 */
export const EVENT_TYPES = Object.freeze([
  'cli.scan.started', 'cli.scan.finished', 'cli.health.checked',
  'role.created', 'role.updated', 'role.published', 'role.deprecated',
  'employee.created', 'employee.updated', 'employee.toggled',
  'team.created', 'team.updated', 'team.published', 'team.deprecated', 'team.copied',
  'workflow.created', 'workflow.updated', 'workflow.published', 'workflow.deprecated', 'workflow.copied',
  'work_item.created', 'work_item.started', 'work_item.cancelled',
  'plan.revised', 'mapping.changed',
  'assignment.prepared', 'assignment.preflight_failed', 'assignment.locked', 'assignment.released',
  'session.created', 'host.bound', 'host.woken',
  'attempt.started', 'attempt.finished',
  'task.ready', 'task.started', 'task.succeeded', 'task.interrupted', 'task.failed', 'task.queued',
  'human.approved', 'human.rejected',
  'recovery.succeeded', 'recovery.failed',
  'delivery.accepted', 'delivery.delivered', 'artifact.created'
]);

/** 合法迁移表；assertTransition 是唯一判定入口。 */
export const TRANSITIONS = Object.freeze({
  workItem: {
    draft: ['configured', 'cancelled'],
    configured: ['ready_to_run', 'cancelled'],
    ready_to_run: ['running', 'cancelled'],
    running: ['waiting_human', 'blocked', 'ready_for_acceptance', 'cancelled'],
    waiting_human: ['running', 'ready_for_acceptance', 'cancelled'],
    blocked: ['running', 'ready_for_acceptance', 'cancelled'],
    ready_for_acceptance: ['accepted', 'cancelled'],
    accepted: ['delivered'],
    delivered: [],
    cancelled: []
  },
  task: {
    waiting_dependency: ['ready', 'skipped', 'cancelled'],
    ready: ['assignment_prepared', 'blocked', 'cancelled'],
    assignment_prepared: ['preflight', 'blocked', 'cancelled'],
    preflight: ['creating_session', 'failed', 'assignment_prepared'],
    creating_session: ['running', 'failed', 'interrupted'],
    running: ['succeeded', 'interrupted', 'blocked', 'failed', 'cancelled'],
    interrupted: ['preflight', 'running', 'cancelled'],
    blocked: ['ready', 'failed', 'cancelled'],
    failed: ['ready', 'cancelled'],
    succeeded: [],
    cancelled: [],
    skipped: []
  },
  assignment: {
    draft: ['prepared'],
    prepared: ['preflight'],
    preflight: ['locked', 'failed', 'prepared'],
    locked: ['released', 'failed'],
    released: [],
    failed: ['draft', 'prepared']
  },
  team: { draft: ['published'], published: ['deprecated'], deprecated: [] },
  workflow: { draft: ['published'], published: ['deprecated'], deprecated: [] }
});

/** 顶层状态固定结构；新字段只能追加在末尾。 */
export const STATE_KEYS = Object.freeze([
  'schemaVersion', 'rev', 'updatedAt', 'roles', 'employees', 'teams', 'workflows',
  'workItems', 'nodeExecutorPlans', 'assignments',
  'sessions', 'runs', 'deliveries', 'cliPool', 'artifacts'
]);

/** 事件/审计引用的八个字段，缺失一律补 null，不得省略。 */
export const EVENT_REF_FIELDS = Object.freeze([
  'workItemId', 'runId', 'taskId', 'assignmentId', 'employeeId',
  'cliInstallationId', 'employeeSessionId', 'hostBindingId', 'attemptId'
]);

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

export function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const has = (obj, field) => Object.prototype.hasOwnProperty.call(obj, field);

// ---------------------------------------------------------------------------
// 对象形状校验（R2）
// ---------------------------------------------------------------------------

const S = 'string';
const A = 'array';
const O = 'object';
const B = 'boolean';
const N = 'number';
const ANY = 'any';

/** 最小必需字段 + 禁止出现字段；允许追加规格外字段，但禁止字段一旦出现即失败。 */
const FIELD_SPECS = Object.freeze({
  cliInstall: {
    required: {
      id: S, name: S, path: S, version: S, adapter: S, capabilities: O,
      health: ANY, auth: ANY, resumable: B, fingerprint: S, source: S
    },
    forbidden: ['employeeId', 'employees', 'teamId', 'teams', 'sessionId', 'employeeSessionId', 'hostSessionId', 'workflowId']
  },
  role: {
    required: {
      id: S, name: S, description: S, duties: A, skills: A, inputs: A, outputs: A,
      requires: O, acceptance: A, version: S, status: S, versions: A
    },
    forbidden: ['employeeId', 'employees', 'teamId', 'teams', 'cliId', 'cliInstallationId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  employee: {
    required: { id: S, name: S, description: S, qualifications: A, enabled: B, createdAt: S, updatedAt: S },
    forbidden: ['cliId', 'cliInstallationId', 'teamId', 'sessionId', 'employeeSessionId', 'hostSessionId', 'roleId', 'workflowId']
  },
  team: {
    required: { id: S, name: S, description: S, version: S, status: S, versions: A, members: A, createdAt: S },
    forbidden: ['workflowId', 'cliId', 'cliInstallationId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  workflow: {
    required: { id: S, name: S, description: S, version: S, status: S, kind: S, nodes: A, edges: A, versions: A, createdAt: S },
    forbidden: ['employeeId', 'teamId', 'cliId', 'cliInstallationId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  nodeAgent: {
    required: {
      id: S, type: S, name: S, roleId: S, instruction: S, inputs: A, outputs: A, deps: A,
      capabilities: O, acceptance: A, timeout: N, failurePolicy: S, retry: ANY,
      fallback: ANY, escalation: ANY, handoff: ANY, condition: ANY
    },
    forbidden: ['employeeId', 'cliId', 'cliInstallationId', 'teamId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  nodeHuman: {
    required: { id: S, type: S, name: S, human: O, inputs: A, outputs: A, deps: A, acceptance: A },
    forbidden: ['employeeId', 'executor', 'assignee', 'assignedEmployeeId', 'cliId', 'cliInstallationId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  workItem: {
    required: {
      id: S, title: S, description: S, background: S, goal: S, projectDir: S, workspace: S,
      attachments: A, referenceRefs: A, priority: S, creator: S, createdAt: S, status: S,
      workflowSnapshot: O, teamSnapshot: O, nodeExecutorPlanId: S, runId: S,
      historyRuns: A, planRevisions: A, deliveryRecord: O
    },
    forbidden: ['hostSessionId', 'employeeSessionId', 'sessionId', 'cliId', 'cliInstallationId', 'hostBindingId', 'hostSession', 'host']
  },
  nodeExecutorPlan: {
    required: { id: S, workItemId: S, workflowSnapshotId: S, teamSnapshotId: S, mapping: O, createdAt: S, updatedAt: S },
    forbidden: ['hostSessionId', 'employeeSessionId', 'sessionId', 'cliId', 'cliInstallationId', 'hostBindingId']
  },
  assignment: {
    required: {
      id: S, runId: S, taskId: S, nodeId: S, employeeId: S, cliInstallationId: S,
      cliFingerprint: S, adapterVersion: S, workingDir: S, inputArtifactRefs: A,
      permissions: O, status: S
    },
    forbidden: ['name', 'description', 'qualifications', 'enabled', 'teamId', 'workflowId', 'cliId', 'sessionId', 'employeeSessionId', 'hostSessionId']
  },
  employeeSession: {
    required: { id: S, employeeId: S, status: S, contextRefs: A, checkpointRef: ANY, createdAt: S, updatedAt: S },
    forbidden: ['name', 'description', 'qualifications', 'enabled', 'teamId', 'cliId', 'cliInstallationId', 'hostSessionId']
  },
  hostBinding: {
    required: {
      id: S, employeeSessionId: S, cliInstallationId: S, adapter: S, hostSessionId: S,
      resumable: B, compatible: B, capabilities: O, status: S, lastActivity: ANY
    },
    forbidden: ['employeeId', 'name', 'description', 'qualifications', 'enabled', 'teamId']
  },
  attempt: {
    required: {
      id: S, taskId: S, assignmentId: S, employeeSessionId: S, hostBindingId: S,
      resumedFrom: ANY, status: S, startedAt: S, endedAt: ANY, checkpointRef: ANY,
      artifactRefs: A, activity: A, error: ANY
    },
    forbidden: []
  },
  run: {
    required: {
      id: S, workItemId: S, workflowVersion: S, teamVersion: S, tasks: A, queue: A,
      status: S, createdAt: S, finishedAt: ANY, stats: O
    },
    forbidden: []
  },
  artifact: {
    required: {
      id: S, name: S, kind: S, workItemId: S, runId: S, taskId: S, employeeId: S,
      cliInstallationId: S, attemptId: S, handoffId: S, path: S, createdAt: S
    },
    forbidden: []
  },
  deliverable: {
    required: { id: S, workItemId: S, status: S, items: A, createdAt: S },
    forbidden: []
  }
});

const KIND_ALIASES = Object.freeze({
  cliInstallation: 'cliInstall',
  employeeProfile: 'employee',
  roleDefinition: 'role',
  teamDefinition: 'team',
  workflowDefinition: 'workflow',
  node: 'node',
  taskAssignment: 'assignment',
  workflowRun: 'run',
  hostSessionBinding: 'hostBinding',
  employeeSessionProfile: 'employeeSession'
});

export function normalizeKind(kind) {
  return KIND_ALIASES[kind] || kind;
}

function matchesType(value, type) {
  switch (type) {
    case S: return typeof value === 'string' && value.length > 0;
    case N: return typeof value === 'number' && Number.isFinite(value);
    case B: return typeof value === 'boolean';
    case A: return Array.isArray(value);
    case O: return isPlainObject(value);
    case ANY: return true;
    default: return false;
  }
}

/**
 * 校验对象形状。返回 {ok:true,value} | {ok:false,code,params}。
 * 禁止字段优先于缺失字段报错（R2 强制「不该保存的字段」不存在）。
 */
export function validate(kind, obj) {
  const key = normalizeKind(kind);
  if (key === 'node') {
    if (!isPlainObject(obj) || !NODE_TYPES.includes(obj.type)) return fail('V32_INVALID_INPUT', { kind: 'node', field: 'type' });
    return validate(obj.type === 'human' ? 'nodeHuman' : 'nodeAgent', obj);
  }
  const spec = FIELD_SPECS[key];
  if (!spec) return fail('V32_INVALID_INPUT', { kind, field: 'kind' });
  if (!isPlainObject(obj)) return fail('V32_INVALID_INPUT', { kind: key, field: 'object' });

  for (const field of spec.forbidden) {
    if (has(obj, field)) return fail('V32_FORBIDDEN_FIELD', { kind: key, field });
  }
  for (const [field, type] of Object.entries(spec.required)) {
    if (!has(obj, field) || !matchesType(obj[field], type)) {
      return fail('V32_INVALID_INPUT', { kind: key, field, expected: type });
    }
  }

  if (key === 'role' || key === 'team' || key === 'workflow') {
    if (!ASSET_STATUS.includes(obj.status)) return fail('V32_INVALID_INPUT', { kind: key, field: 'status', value: obj.status });
  }
  if (key === 'workItem' && !WORK_ITEM_STATUS.includes(obj.status)) {
    return fail('V32_INVALID_INPUT', { kind: key, field: 'status', value: obj.status });
  }
  if (key === 'assignment' && !ASSIGNMENT_STATUS.includes(obj.status)) {
    return fail('V32_INVALID_INPUT', { kind: key, field: 'status', value: obj.status });
  }
  if (key === 'run') {
    for (let i = 0; i < obj.tasks.length; i += 1) {
      const task = obj.tasks[i];
      if (!isPlainObject(task) || !TASK_STATUS.includes(task.status)) {
        return fail('V32_INVALID_INPUT', { kind: key, field: `tasks[${i}].status` });
      }
    }
  }
  if (key === 'nodeHuman') {
    const approver = obj.human && obj.human.approver;
    if (typeof approver === 'string' && /^EMP-\d+$/.test(approver)) {
      return fail('V32_FORBIDDEN_FIELD', { kind: key, field: 'human.approver' });
    }
  }
  if (key === 'workflow') {
    for (let i = 0; i < obj.nodes.length; i += 1) {
      const result = validate('node', obj.nodes[i]);
      if (!result.ok) return fail(result.code, { kind: key, field: `nodes[${i}]`, detail: result.params });
    }
  }
  return ok(obj);
}

// ---------------------------------------------------------------------------
// 合法迁移（R10）
// ---------------------------------------------------------------------------

export function canTransition(kind, from, to) {
  const table = TRANSITIONS[kind];
  return Boolean(table && has(table, from) && Array.isArray(table[from]) && table[from].includes(to));
}

export function assertTransition(kind, from, to) {
  return canTransition(kind, from, to)
    ? ok(true)
    : fail('V32_ILLEGAL_TRANSITION', { kind, from, to });
}

// ---------------------------------------------------------------------------
// ID 唯一性与资产版本（R9 / R14）
// ---------------------------------------------------------------------------

/** 收集状态内所有对象的 id（含 sessions 子数组）。 */
export function collectIds(state) {
  const ids = [];
  if (!isPlainObject(state)) return ids;
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isPlainObject(item) && typeof item.id === 'string') ids.push(item.id);
    } else if (key === 'sessions' && isPlainObject(value)) {
      for (const nested of Object.values(value)) {
        if (Array.isArray(nested)) {
          for (const item of nested) if (isPlainObject(item) && typeof item.id === 'string') ids.push(item.id);
        }
      }
    }
  }
  return ids;
}

export function assertUniqueId(state, id) {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return fail('V32_INVALID_INPUT', { field: 'id', value: id });
  return collectIds(state).includes(id) ? fail('V32_DUPLICATE_ID', { id }) : ok(id);
}

export const INITIAL_VERSION = '1.0';

export function parseVersion(version) {
  if (typeof version !== 'string') return null;
  const match = /^(\d+)\.(\d+)$/.exec(version);
  return match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
}

/** major.minor 递增：1.0 → 1.1；非法版本返回 null。 */
export function bumpVersion(version) {
  const parsed = parseVersion(version);
  return parsed ? `${parsed.major}.${parsed.minor + 1}` : null;
}

export function makeVersionEntry(version, now, extra = {}) {
  return { version, publishedAt: now, ...extra };
}

/**
 * 可复用的发布辅助（T03/T05/T06）：同版本重复发布返回 V32_DUPLICATE_VERSION。
 * 不修改入参，versions 保持 append-only。
 */
export function publishDefinition(definition, now, extra = {}) {
  if (!isPlainObject(definition) || !Array.isArray(definition.versions) || typeof definition.version !== 'string') {
    return fail('V32_INVALID_INPUT', { field: 'versions' });
  }
  const next = bumpVersion(definition.version) || INITIAL_VERSION;
  if (definition.versions.some((entry) => isPlainObject(entry) && entry.version === next)) {
    return fail('V32_DUPLICATE_VERSION', { version: next });
  }
  return ok({
    ...definition,
    version: next,
    status: 'published',
    versions: [...definition.versions, makeVersionEntry(next, now, extra)]
  });
}

/** 快照深拷贝；快照结构见 §1.3.1。 */
export function cloneSnapshot(snapshot) {
  return snapshot === null || snapshot === undefined ? snapshot : deepClone(snapshot);
}

export function makeSnapshot(kind, id, version, definition, now) {
  return {
    snapshotOf: { kind, id, version },
    capturedAt: now,
    definition: deepClone(definition)
  };
}
