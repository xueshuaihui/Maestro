/** V3.2 事件：稳定规范化、sha256 哈希链、JSONL 读写与查询。 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { EVENT_REF_FIELDS, EVENT_TYPES, deepClone, fail, isPlainObject, ok } from './contracts.js';
import { ID_PATTERN } from './ids.js';

/** 稳定序列化：对象键排序，undefined 视作 null。 */
export function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** sha256(canonicalize({...无 hash 字段}))。 */
export function eventHash(event) {
  if (!isPlainObject(event)) return null;
  const { hash, ...rest } = event;
  void hash;
  return createHash('sha256').update(canonicalize(rest)).digest('hex');
}

/**
 * 构造单条事件；refs 八个字段齐全，缺失补 null；未知 type 返回 V32_INVALID_INPUT。
 */
export function createEvent({
  id, seq, ts, type, actor = 'system', refs = {}, payload = {}, prevHash = null
} = {}) {
  if (!EVENT_TYPES.includes(type)) return fail('V32_INVALID_INPUT', { field: 'type', value: type });
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return fail('V32_INVALID_INPUT', { field: 'id', value: id });
  if (!Number.isInteger(seq) || seq < 1) return fail('V32_INVALID_INPUT', { field: 'seq', value: seq });
  if (typeof ts !== 'string') return fail('V32_INVALID_INPUT', { field: 'ts', value: ts });

  const normalizedRefs = {};
  for (const field of EVENT_REF_FIELDS) normalizedRefs[field] = refs[field] ?? null;
  const base = {
    id, seq, ts, type, actor: actor ?? 'system',
    refs: normalizedRefs,
    payload: isPlainObject(payload) ? deepClone(payload) : {},
    prevHash: prevHash ?? null
  };
  return ok({ ...base, hash: eventHash(base) });
}

export function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  return text.split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line));
}

export function appendJsonl(file, events) {
  if (!Array.isArray(events) || events.length === 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, events.map((event) => `${JSON.stringify(event)}\n`).join(''), 'utf8');
}

/**
 * 校验哈希链：seq 从 1 单调递增、prevHash 指向上一条、hash 与规范化重算一致。
 */
export function verifyChain(events, prefix = 'EVT') {
  if (!Array.isArray(events)) return fail('V32_INVALID_INPUT', { field: 'events' });
  const seen = new Set();
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!isPlainObject(event)) return fail('V32_INVALID_INPUT', { index: i, reason: 'not-object' });
    if (typeof event.id !== 'string' || !event.id.startsWith(`${prefix}-`)) {
      return fail('V32_INVALID_INPUT', { index: i, reason: 'id-prefix' });
    }
    if (seen.has(event.id)) return fail('V32_INVALID_INPUT', { index: i, reason: 'duplicate-id' });
    seen.add(event.id);
    if (event.seq !== i + 1) return fail('V32_INVALID_INPUT', { index: i, reason: 'seq' });
    const expectedPrev = i === 0 ? null : events[i - 1].hash;
    if ((event.prevHash ?? null) !== expectedPrev) return fail('V32_INVALID_INPUT', { index: i, reason: 'prevHash' });
    if (eventHash(event) !== event.hash) return fail('V32_INVALID_INPUT', { index: i, reason: 'hash' });
    for (const field of EVENT_REF_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(event.refs || {}, field)) {
        return fail('V32_INVALID_INPUT', { index: i, reason: 'refs', field });
      }
    }
  }
  return ok(true);
}

/** 过滤 + 截断：limit 取最近 N 条（日志尾部）。返回深拷贝。 */
export function queryJsonl(events, { workItemId, runId, type, limit } = {}) {
  let result = Array.isArray(events) ? events.slice() : [];
  const refsOf = (event) => (isPlainObject(event.refs) ? event.refs : {});
  if (workItemId !== undefined && workItemId !== null) {
    result = result.filter((event) => refsOf(event).workItemId === workItemId);
  }
  if (runId !== undefined && runId !== null) {
    result = result.filter((event) => refsOf(event).runId === runId);
  }
  if (type !== undefined && type !== null) result = result.filter((event) => event.type === type);
  if (Number.isInteger(limit) && limit >= 0) result = limit === 0 ? [] : result.slice(-limit);
  return deepClone(result);
}
