/** V3.2 状态存储：唯一写入口 transit（CAS + 原子落盘 + 事件/审计链 + 广播）。 */

import fs from 'node:fs';
import path from 'node:path';

import {
  STATE_KEYS, ORG_AUDIT_FILE, ORG_EVENTS_FILE, ORG_SCHEMA_VERSION, ORG_STATE_FILE,
  assertTransition, assertUniqueId, canTransition, collectIds, deepClone, fail,
  isPlainObject, makeSnapshot, ok
} from './contracts.js';
import { fromError } from './errors.js';
import { ID_PATTERN, ID_PREFIX, formatId, parseSequence, resolvePrefix } from './ids.js';
import { createEvent, readJsonl, appendJsonl, verifyChain, queryJsonl } from './events.js';
import { createAuditEvent, isAuditable, queryAudit, verifyAuditChain } from './audit.js';

const COLLECTIONS = Object.freeze({
  role: 'roles', employee: 'employees', team: 'teams', workflow: 'workflows',
  workItem: 'workItems', nodeExecutorPlan: 'nodeExecutorPlans', assignment: 'assignments',
  employeeSession: 'sessions.employees', hostBinding: 'sessions.hostBindings',
  attempt: 'sessions.attempts', run: 'runs', deliverable: 'deliveries',
  cliInstall: 'cliPool.installs', artifact: 'artifacts'
});

function emptyState(now) {
  return {
    schemaVersion: ORG_SCHEMA_VERSION,
    rev: 0,
    updatedAt: now(),
    roles: [], employees: [], teams: [], workflows: [],
    workItems: [], nodeExecutorPlans: [], assignments: [],
    sessions: { employees: [], hostBindings: [], attempts: [] },
    runs: [], deliveries: [],
    cliPool: { installs: [], scan: { mode: null, startedAt: null, finishedAt: null, status: null } },
    artifacts: []
  };
}

function mergeState(parsed, now) {
  const base = emptyState(now);
  if (!isPlainObject(parsed)) return base;
  const merged = { ...base, ...parsed };
  merged.sessions = { ...base.sessions, ...(isPlainObject(parsed.sessions) ? parsed.sessions : {}) };
  merged.cliPool = { ...base.cliPool, ...(isPlainObject(parsed.cliPool) ? parsed.cliPool : {}) };
  merged.cliPool.scan = { ...base.cliPool.scan, ...(isPlainObject(merged.cliPool.scan) ? merged.cliPool.scan : {}) };
  return merged;
}

function getCollection(state, kind) {
  if (kind === 'task') return state.runs.flatMap((run) => Array.isArray(run.tasks) ? run.tasks : []);
  const key = COLLECTIONS[kind];
  if (!key) return null;
  let value = state;
  for (const part of key.split('.')) {
    if (!isPlainObject(value)) return null;
    value = value[part];
  }
  return Array.isArray(value) ? value : null;
}

function findIn(target, kind, id) {
  const collection = getCollection(target, kind);
  if (!collection) return null;
  return collection.find((item) => isPlainObject(item) && item.id === id) || null;
}

function orderedState(nextState, now) {
  const base = emptyState(now);
  const ordered = {};
  for (const key of STATE_KEYS) ordered[key] = nextState[key] !== undefined ? nextState[key] : base[key];
  for (const key of Object.keys(nextState)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, key)) ordered[key] = nextState[key];
  }
  return ordered;
}

function fileSize(file) {
  try { return fs.statSync(file).size; } catch { return 0; }
}

/**
 * @param {{root:string, now?:()=>string, sink?:(event:object,meta:object)=>void}} options
 * root 必须是绝对路径；read()/首次 transit 之前不创建任何目录。
 */
export function createV32Store({ root, now = () => new Date().toISOString(), sink = null } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    throw new TypeError('createV32Store: root must be an absolute path');
  }
  const statePath = path.join(root, ORG_STATE_FILE);
  const eventsPath = path.join(root, ORG_EVENTS_FILE);
  const auditPath = path.join(root, ORG_AUDIT_FILE);

  const readDisk = () => {
    if (!fs.existsSync(statePath)) return emptyState(now);
    return mergeState(JSON.parse(fs.readFileSync(statePath, 'utf8')), now);
  };

  let state = readDisk();
  let txn = null; // {draft, allocated, usedIds, existingEvents, existingAudit, ts, actor, reason}
  let broadcastSink = typeof sink === 'function' ? sink : null;

  function getFrom(target, kind, id) {
    const found = findIn(target, kind, id);
    return found ? deepClone(found) : null;
  }

  function listFrom(target, kind) {
    const collection = getCollection(target, kind);
    return collection ? deepClone(collection) : [];
  }

  function nextId(kind) {
    if (!txn) return fail('ORG_INVALID_INPUT', { field: 'nextId', reason: 'outside-transit' });
    const prefix = resolvePrefix(kind);
    if (!prefix) return fail('ORG_INVALID_INPUT', { field: 'kind', value: kind });

    const existingIds = collectIds(txn.draft);
    let max = 0;
    const scan = (id) => {
      const seq = parseSequence(id, prefix);
      if (seq !== null && seq > max) max = seq;
    };
    existingIds.forEach(scan);
    txn.existingEvents.forEach((event) => scan(event.id));
    txn.existingAudit.forEach((event) => scan(event.id));

    let offset = txn.allocated.get(prefix) || 0;
    let candidate = formatId(prefix, max + offset + 1);
    while (txn.usedIds.has(candidate) || existingIds.includes(candidate)) {
      offset += 1;
      candidate = formatId(prefix, max + offset + 1);
    }
    if (!ID_PATTERN.test(candidate)) return fail('ORG_DUPLICATE_ID', { id: candidate });
    txn.allocated.set(prefix, offset + 1);
    txn.usedIds.add(candidate);
    return ok(candidate);
  }

  function snapshot(kind, id, version) {
    const target = txn ? txn.draft : state;
    const definition = getFrom(target, kind, id);
    if (!definition) return fail('ORG_NOT_FOUND', { kind, id });
    return makeSnapshot(kind, id, version, definition, now());
  }

  /** 唯一写入口。mutator 只能改 draft；任何失败都不改内存状态。 */
  function transit(mutator, { expectedRev, reason = null, actor = 'system' } = {}) {
    if (typeof mutator !== 'function') return fail('ORG_INVALID_INPUT', { field: 'mutator' });
    let diskState;
    let existingEvents;
    let existingAudit;
    try {
      diskState = readDisk();
      existingEvents = readJsonl(eventsPath);
      existingAudit = readJsonl(auditPath);
    } catch (error) {
      return fromError(error);
    }
    if (diskState.rev !== expectedRev) {
      return fail('ORG_REV_CONFLICT', { expectedRev, actualRev: diskState.rev });
    }

    const draft = deepClone(diskState);
    const ts = now();
    txn = {
      draft, allocated: new Map(), usedIds: new Set(),
      existingEvents, existingAudit, ts, actor, reason
    };

    let result;
    try {
      result = mutator(draft, { now: ts, rev: diskState.rev, reason, actor, nextId, assertTransition, snapshot });
    } catch (error) {
      result = fromError(error);
    }
    if (!isPlainObject(result) || result.ok !== true) {
      txn = null;
      if (isPlainObject(result) && result.ok === false && typeof result.code === 'string') return result;
      return fail('ORG_INVALID_INPUT', { field: 'mutator-result' });
    }

    // 领域状态写入强制经 assertTransition：已有对象的 status 变化必须落在 TRANSITIONS 内。
    const transitionKinds = [
      ['workItem', 'workItems'], ['team', 'teams'], ['workflow', 'workflows'], ['assignment', 'assignments']
    ];
    for (const [kind, collection] of transitionKinds) {
      for (const changed of draft[collection]) {
        if (!isPlainObject(changed) || typeof changed.id !== 'string') continue;
        const before = findIn(diskState, kind, changed.id);
        if (!before || before.status === changed.status) continue;
        const check = assertTransition(kind, before.status, changed.status);
        if (!check.ok) {
          txn = null;
          return check;
        }
      }
    }
    for (const changedRun of draft.runs) {
      if (!Array.isArray(changedRun.tasks)) continue;
      for (const changedTask of changedRun.tasks) {
        if (!isPlainObject(changedTask) || typeof changedTask.id !== 'string') continue;
        const before = findIn(diskState, 'task', changedTask.id);
        if (!before || before.status === changedTask.status) continue;
        const check = assertTransition('task', before.status, changedTask.status);
        if (!check.ok) {
          txn = null;
          return check;
        }
      }
    }

    // 事件/审计在写盘前全部构造完毕；未知事件类型直接失败，不产生半截状态。
    const events = [];
    let eventSeq = existingEvents.length ? Math.max(...existingEvents.map((event) => event.seq)) : 0;
    let prevHash = existingEvents.length ? existingEvents[existingEvents.length - 1].hash : null;
    for (const raw of Array.isArray(result.events) ? result.events : []) {
      if (!isPlainObject(raw)) {
        txn = null;
        return fail('ORG_INVALID_INPUT', { field: 'events' });
      }
      eventSeq += 1;
      const built = createEvent({
        id: formatId(ID_PREFIX.event, eventSeq), seq: eventSeq, ts,
        type: raw.type, actor: raw.actor ?? actor, refs: raw.refs ?? {},
        payload: raw.payload ?? {}, prevHash
      });
      if (!built.ok) {
        txn = null;
        return built;
      }
      events.push(built.value);
      prevHash = built.value.hash;
    }

    let auditSeq = existingAudit.length ? Math.max(...existingAudit.map((event) => event.seq)) : 0;
    let auditPrevHash = existingAudit.length ? existingAudit[existingAudit.length - 1].hash : null;
    const auditEvents = [];
    for (const event of events) {
      if (!isAuditable(event.type)) continue;
      auditSeq += 1;
      const built = createAuditEvent({
        id: formatId(ID_PREFIX.audit, auditSeq), seq: auditSeq, ts,
        type: event.type, actor: event.actor, refs: event.refs,
        payload: event.payload, prevHash: auditPrevHash
      });
      if (!built.ok) {
        txn = null;
        return built;
      }
      auditEvents.push(built.value);
      auditPrevHash = built.value.hash;
    }

    const nextState = orderedState({ ...draft, rev: diskState.rev + 1, updatedAt: ts }, now);
    const originalRaw = fs.existsSync(statePath) ? fs.readFileSync(statePath) : null;
    const sizes = { events: fileSize(eventsPath), audit: fileSize(auditPath) };
    let tmp = null;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      tmp = path.join(path.dirname(statePath), `.state-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
      fs.writeFileSync(tmp, JSON.stringify(nextState), 'utf8');
      fs.renameSync(tmp, statePath);
      tmp = null;
      appendJsonl(eventsPath, events);
      appendJsonl(auditPath, auditEvents);
    } catch (error) {
      try {
        if (originalRaw === null) {
          if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
        } else {
          fs.writeFileSync(statePath, originalRaw);
        }
        if (fileSize(eventsPath) > sizes.events) fs.truncateSync(eventsPath, sizes.events);
        if (fileSize(auditPath) > sizes.audit) fs.truncateSync(auditPath, sizes.audit);
      } catch { /* best-effort rollback */ }
      if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp);
      txn = null;
      return fromError(error);
    }

    state = deepClone(nextState);
    txn = null;

    // 事件先落盘，再广播；广播失败不回滚已持久化状态。
    if (broadcastSink) {
      for (const event of events) {
        try { broadcastSink(event, { reason, actor }); } catch { /* 广播失败不影响已落盘事件 */ }
      }
    }

    return ok(deepClone(nextState), {
      events: deepClone(events), audit: deepClone(auditEvents), mutatorValue: deepClone(result.value)
    });
  }

  function events(filters = {}) {
    return queryJsonl(readJsonl(eventsPath), filters);
  }

  function audit(filters = {}) {
    return queryAudit(readJsonl(auditPath), filters);
  }

  function verifyAllChains() {
    const eventResult = verifyChain(readJsonl(eventsPath), 'EVT');
    if (!eventResult.ok) return fail(eventResult.code, { chain: 'events', ...eventResult.params });
    const auditResult = verifyAuditChain(readJsonl(auditPath));
    if (!auditResult.ok) return fail(auditResult.code, { chain: 'audit', ...auditResult.params });
    return ok(true);
  }

  return {
    read: () => deepClone(state),
    get: (kind, id) => getFrom(state, kind, id),
    list: (kind) => listFrom(state, kind),
    transit,
    nextId,
    snapshot,
    canTransition,
    assertTransition,
    assertUniqueId: (id) => assertUniqueId(txn ? txn.draft : state, id),
    events,
    audit,
    verifyChain: verifyAllChains,
    /** appendEvent/appendAudit 仅供 transit 内部链路使用；外部调用返回失败。 */
    appendEvent: (event) => {
      if (!txn) return fail('ORG_INVALID_INPUT', { field: 'appendEvent', reason: 'outside-transit' });
      appendJsonl(eventsPath, [event]);
      return ok(event);
    },
    appendAudit: (event) => {
      if (!txn) return fail('ORG_INVALID_INPUT', { field: 'appendAudit', reason: 'outside-transit' });
      appendJsonl(auditPath, [event]);
      return ok(event);
    },
    setSink: (fn) => { broadcastSink = typeof fn === 'function' ? fn : null; },
    paths: { state: statePath, events: eventsPath, audit: auditPath }
  };
}
