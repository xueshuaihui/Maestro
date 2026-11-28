/** V3.2 公共入口：只导出本任务已创建的模块，其他任务按约定直接相对路径 import 具体文件。 */

export {
  V32_SCHEMA_VERSION, V32_STATE_FILE, V32_EVENTS_FILE, V32_AUDIT_FILE,
  ID_PREFIX, ID_PATTERN, formatId, parseSequence, resolvePrefix, snapshotId,
  ERROR_CODES, fail, ok, fromError, isErrorCode,
  WORK_ITEM_STATUS, TASK_STATUS, ASSIGNMENT_STATUS, ASSET_STATUS, NODE_TYPES,
  AUDIT_TYPES, EVENT_TYPES, TRANSITIONS, EVENT_REF_FIELDS, STATE_KEYS,
  canTransition, assertTransition, validate, normalizeKind,
  deepClone, isPlainObject, collectIds, assertUniqueId,
  INITIAL_VERSION, parseVersion, bumpVersion, makeVersionEntry, publishDefinition,
  cloneSnapshot, makeSnapshot
} from './contracts.js';

export {
  canonicalize, eventHash, createEvent, readJsonl, appendJsonl, verifyChain, queryJsonl
} from './events.js';

export {
  isAuditable, createAuditEvent, readAudit, appendAudit, verifyAuditChain, queryAudit
} from './audit.js';

export { createV32Store } from './store.js';
