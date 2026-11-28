/** V3.2 审计：命中 AUDIT_TYPES 的事件自动落 audit.jsonl，链格式与事件一致。 */

import { AUDIT_TYPES, fail, ok } from './contracts.js';
import { appendJsonl, createEvent, queryJsonl, readJsonl, verifyChain } from './events.js';

export { AUDIT_TYPES } from './contracts.js';
export { appendJsonl, queryJsonl, readJsonl } from './events.js';

export function isAuditable(type) {
  return AUDIT_TYPES.includes(type);
}

/** 审计事件构造；非审计类型返回 V32_INVALID_INPUT。 */
export function createAuditEvent(fields) {
  if (!isAuditable(fields && fields.type)) return fail('V32_INVALID_INPUT', { field: 'type', value: fields && fields.type });
  return createEvent(fields);
}

export function readAudit(file) {
  return readJsonl(file);
}

export function appendAudit(file, events) {
  if (!Array.isArray(events)) return fail('V32_INVALID_INPUT', { field: 'events' });
  appendJsonl(file, events);
  return ok(events.length);
}

export function verifyAuditChain(events) {
  return verifyChain(events, 'AUD');
}

/** 审计类型过滤与截断；与 store.audit() 共用。 */
export function queryAudit(events, filters = {}) {
  return queryJsonl(events, filters);
}
