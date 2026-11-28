/** V3.2 ID 前缀与序号工具（实现约定，非规格断言）。 */

export const ID_PREFIX = Object.freeze({
  role: 'ROLE', employee: 'EMP', team: 'TEAM', workflow: 'WF', workItem: 'WI',
  run: 'RUN', task: 'TASK', assignment: 'ASSIGN', employeeSession: 'ES',
  hostBinding: 'HB', attempt: 'ATT', artifact: 'ART', event: 'EVT', audit: 'AUD'
});

/** ID 格式：前缀 + 至少三位序号；快照 ID 形如 WF-SNAPSHOT-WI-001。 */
export const ID_PATTERN = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{3,}$/;

/** 对象种类 → ID 前缀的补充别名；不改动上方 ID_PREFIX 全集。 */
const PREFIX_ALIASES = Object.freeze({
  nodeExecutorPlan: 'PLAN',
  cliInstall: 'CLI',
  cliInstallation: 'CLI',
  taskAssignment: 'ASSIGN',
  employeeProfile: 'EMP',
  roleDefinition: 'ROLE',
  teamDefinition: 'TEAM',
  workflowDefinition: 'WF',
  workflowRun: 'RUN',
  hostSessionBinding: 'HB',
  node: 'NODE'
});

export function resolvePrefix(kind) {
  if (typeof kind !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(ID_PREFIX, kind)) return ID_PREFIX[kind];
  if (Object.prototype.hasOwnProperty.call(PREFIX_ALIASES, kind)) return PREFIX_ALIASES[kind];
  return null;
}

export function formatId(prefix, seq) {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

/** 从形如 `PREFIX-001` 的 ID 取序号；快照/复合 ID 不计入序号。 */
export function parseSequence(id, prefix) {
  if (typeof id !== 'string' || !prefix) return null;
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
  return match ? Number(match[1]) : null;
}

/** 仅用于本次需求的资产快照 ID，不写入 workflows[]/teams[]。 */
export function snapshotId(kind, workItemId) {
  const prefix = kind === 'team' ? 'TEAM' : 'WF';
  return `${prefix}-SNAPSHOT-${String(workItemId ?? '')}`;
}
