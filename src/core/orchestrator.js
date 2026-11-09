/**
 * 图驱动编排主流程（I1.2 / WP-4）。
 *
 * 职责边界：
 * - 本文件只做“裁决”：调状态机、调事件总线、调核对/判定器；宿主细节全部由注入的
 *   `adapterFactory` 提供（本层不认识具体宿主、协议或进程）。
 * - 所有层（实例 / 节点 / 会话 / 交接包 / 升级）统一存在 `state.json` 的数组里；
 *   每次迁移走 CAS，事件先落盘再推进内存状态。
 * - 默认图是单节点图，行为与 I1.1 逐字一致；多节点推进由 `advance()` + `driveGraph()`
 *   完成，实例只在图终节点完成时写一次 `completed`。
 * - `stopReason` 只用于判定“turn 结束”，绝不用于判定成功/失败：失败只来自
 *   ① prompt 返回 JSON-RPC error，② 产出核对/判定不通过。
 *
 * 本文件不出现模板名与角色名（AC-28）：图与角色都是注入的数据对象。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { createHandoffTracker } from '../adapter/handoff-tracker.js';
import { normalizePermissionPolicy, resolvePermissionPolicy } from '../adapter/host-config.js';
import { createNormalizer } from '../adapter/session-state.js';
import { CODES, classifyPromptError } from './error-map.js';
import {
  CANCELABLE_HANDOFF,
  CANCELABLE_NODE,
  CORE_IMMUTABLE_INSTANCE,
  RUN_DONE_INSTANCE,
  TERMINAL_INSTANCE,
  createEscalationSM,
  createHandoffSM,
  createInstanceSM,
  createNodeSM,
  createSessionSM,
} from './state-machine.js';
import {
  extractDeclaredArtifacts,
  extractProductLines,
  verifyArtifacts as defaultVerify,
  verifyProducts,
} from './verify-artifact.js';
import { readVerdict } from './verdict.js';
import { REVIEW_PATH, readReview } from './review.js';
import {
  artifactMessage,
  docRef,
  parseProductDeclaration,
  resolveNodeProducts,
  verifyPrevious,
  writePathOf,
} from './doc-artifact.js';
import { buildEscalation, commitEscalation, findPending, markHalted } from './escalation.js';
import { checkWakeGate, classifyNodeOutcome, planAdvance } from './advance.js';
import {
  instanceDir as dirOfInstance,
  instanceDocsDir,
  instanceReportsDir,
  instanceWorkspaceDir,
} from '../persistence/paths.js';
import { firstNode, getGraph as graphByName, maxRoundsOf, nodeById as graphNode } from './graph.js';
import {
  DEFAULT_RETEST_REQUIREMENT,
  DEFAULT_REVISION_REQUIREMENT,
  GRAPHS,
  defaultGraph,
  initialNodes,
  promptFor,
} from '../templates/index.js';
import { validateHandoff } from './handoff-schema.js';
import { CORE_TEXT, applyPlaceholders, handoffInvalidDetail } from './status-text.js';
import { buildInboxMessage, writeInbox, patchInbox } from './inbox.js';
import {
  prepareWorkspace as prepareWorkspaceDir,
  refreshStatusDoc,
  STATUS_WRITE_FAULT,
  WORKSPACE_INIT_FAILED,
} from './workspace.js';
import * as approvals from './approvals.js';

const TURN_ID = 'turn-1';

/** 会话“无新事件”阈值（只影响展示，不触发失败判定）。 */
const STALL_MS = 10_000;
/** cancel 通知的 best-effort 超时：宿主无响应也不阻塞终态落地。 */
const CANCEL_TIMEOUT_MS = 1000;
const PAUSE_POLL_MS = 100;

const TERMINAL = new Set(TERMINAL_INSTANCE);
const RUN_DONE = new Set(RUN_DONE_INSTANCE);
const CORE_IMMUTABLE = new Set(CORE_IMMUTABLE_INSTANCE);
const CANCEL_NODE = new Set(CANCELABLE_NODE);
const CANCEL_HANDOFF = new Set(CANCELABLE_HANDOFF);

/** waitForRun 超时哨兵：与任何业务返回值都不相等。 */
const WAIT_TIMEOUT = Symbol('run.wait.timeout');

/**
 * Escalation reason texts. The only wording pieces assembled in the engine are the
 * prefixes and the round sentence; role titles come from the graph data so no
 * template/role literal lives here.
 */
const ESC_TEXT = Object.freeze({
  dispatchFailed: '派遣失败：目标会话不可用',
  executionPrefix: '执行失败：',
  roundsPrefix: '回流超上限：',
});

function roundsDetail(title, round) {
  const name = typeof title === 'string' && title.length > 0 ? title : '节点';
  return `${ESC_TEXT.roundsPrefix}${name}已派发 ${round} 次仍未通过`;
}

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

/** 暂停点轮询：**不能** unref —— 暂停期间进程必须活着等 `.mock/release`。 */
function pollSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fail(code, params = {}) {
  return { ok: false, code, params };
}

function isLegacy(state) {
  return (Number.isInteger(state?.schemaVersion) ? state.schemaVersion : 1) < 2;
}

function isNodeBusyState(state) {
  return state === 'running' || state === 'review';
}

function arraysOf(state) {
  state.nodes = Array.isArray(state.nodes) ? state.nodes : [];
  state.sessions = Array.isArray(state.sessions) ? state.sessions : [];
  state.handoffs = Array.isArray(state.handoffs) ? state.handoffs : [];
  state.escalations = Array.isArray(state.escalations) ? state.escalations : [];
  state.counters = state.counters ?? { eventSeq: 0, runCount: 1, dispatchCount: 0 };
  state.hostRaw = state.hostRaw ?? { stopReason: null, lastError: null, agentInfo: null };
  if (!Number.isInteger(state.counters.dispatchCount)) state.counters.dispatchCount = 0;
  return state;
}

function nodeOf(state, nodeId) {
  return (state?.nodes ?? []).find((node) => node.nodeId === nodeId) ?? null;
}

function sessionOf(state, sessionId) {
  return (state?.sessions ?? []).find((session) => session.sessionId === sessionId) ?? null;
}

function handoffOf(state, handoffId) {
  return (state?.handoffs ?? []).find((handoff) => handoff.handoffId === handoffId) ?? null;
}

function latestSession(state) {
  let latest = null;
  for (const session of state?.sessions ?? []) {
    if (!latest || String(session.createdAt ?? '') >= String(latest.createdAt ?? '')) latest = session;
  }
  return latest;
}

function latestHandoff(state) {
  const list = state?.handoffs ?? [];
  return list.length === 0 ? null : list[list.length - 1];
}

/**
 * Same rule as `advance.hasEnded`: a node waiting for its downstream neighbour
 * (`review` + `reviewReason === 'downstream'`) has already left the execution state.
 * Both copies must stay in sync (risk R1): `advance` picks the planning target from the
 * disk snapshot with the identical predicate.
 */
function hasEndedNode(node) {
  if (['done', 'failed', 'escalated'].includes(node?.state)) return true;
  return node?.state === 'review' && node?.reviewReason === 'downstream';
}

function latestEndedNodeId(state) {
  let bestId = null;
  let bestAt = null;
  for (const node of state?.nodes ?? []) {
    if (!hasEndedNode(node)) continue;
    const endedAt = typeof node.endedAt === 'string' ? node.endedAt : null;
    if (endedAt === null) continue;
    if (bestAt === null || endedAt > bestAt) {
      bestAt = endedAt;
      bestId = node.nodeId;
    }
  }
  return bestId;
}

/** Single-node graphs keep the I1.1 lifecycle; anything with edges uses the graph engine. */
function isSingleGraph(graph) {
  const nodes = graph?.nodes?.length ?? 0;
  const edges = graph?.edges?.length ?? 0;
  return nodes <= 1 && edges === 0;
}

function productsOfTask(state) {
  const parsed = extractProductLines(state?.task ?? '');
  return parsed.ok ? parsed.refs : [];
}

/**
 * D-9.8: the 9 fields persisted on graph-driven handoffs. They are projected
 * key-by-key (only when the source actually carries them) so a tracker snapshot
 * that lacks them never writes `undefined` into state.json.
 */
const HANDOFF_EXTRA_KEYS = Object.freeze([
  'instanceId',
  'round',
  'fromNodeId',
  'toNodeId',
  'retestRequirement',
  'deliveryAttempts',
  'pendingAt',
  'expiredAt',
  'lastError',
]);
const HANDOFF_EXTRA_KEYS_SET = new Set(HANDOFF_EXTRA_KEYS);

/**
 * Handoff projection whitelist (D-6). Fields the tracker does not produce
 * (`edge` / `defects` / `note` / `wakeConsumedAt`) are only written when the source
 * object actually carries them, so a plain `session/update` never wipes them.
 */
function handoffToState(snapshot) {
  const out = {
    handoffId: snapshot.handoffId,
    state: snapshot.state,
    createdAt: snapshot.timestamps?.createdAt ?? null,
    deliveredAt: snapshot.timestamps?.deliveredAt ?? null,
    acceptedAt: snapshot.timestamps?.acceptedAt ?? null,
    consumedAt: snapshot.timestamps?.consumedAt ?? null,
    rejectedAt: snapshot.timestamps?.rejectedAt ?? null,
    rejectReason: snapshot.rejectReason ?? null,
    acceptedSignal: snapshot.acceptedSignal ?? null,
    ambiguityWindowMs: snapshot.ambiguityWindowMs ?? null,
  };
  if (Object.prototype.hasOwnProperty.call(snapshot, 'edge')) out.edge = snapshot.edge;
  if (Object.prototype.hasOwnProperty.call(snapshot, 'defects')) out.defects = snapshot.defects;
  if (Object.prototype.hasOwnProperty.call(snapshot, 'note')) out.note = snapshot.note;
  if (Object.prototype.hasOwnProperty.call(snapshot, 'wakeConsumedAt')) {
    out.wakeConsumedAt = snapshot.wakeConsumedAt;
  }
  // I1.3 (D-6): only projected when the source object carries them, so a plain
  // `session/update` never wipes the artifact refs of an accepted handoff.
  if (Object.prototype.hasOwnProperty.call(snapshot, 'artifactRefs')) {
    out.artifactRefs = snapshot.artifactRefs;
  }
  if (Object.prototype.hasOwnProperty.call(snapshot, 'revisionRequirement')) {
    out.revisionRequirement = snapshot.revisionRequirement;
  }
  // D-9.8: only keys that actually exist on the source are projected. Never
  // spread the whole tracker snapshot (it would carry internal fields and
  // overwrite the 9 persisted fields with tracker defaults).
  for (const key of HANDOFF_EXTRA_KEYS) {
    if (
      Object.prototype.hasOwnProperty.call(snapshot, key) &&
      snapshot[key] !== undefined
    ) {
      out[key] = snapshot[key];
    }
  }
  return out;
}

function applyHandoff(handoff, snapshot) {
  if (!handoff) return;
  const next = handoffToState(snapshot);
  for (const [key, value] of Object.entries(next)) {
    // The 9 fields only live on graph-driven packages. A `single` bootstrap
    // package (edge === null) must never gain them (C-04 / D-9.3).
    if (
      HANDOFF_EXTRA_KEYS_SET.has(key) &&
      !Object.prototype.hasOwnProperty.call(handoff, key)
    ) {
      continue;
    }
    handoff[key] = value;
  }
}

/**
 * @param {{
 *   store: object,
 *   bus: object,
 *   adapterFactory: {create: (args:{hostId?:string,cwd:string}) => Promise<object>},
 *   verify?: Function,
 *   clock?: () => number,
 *   generation?: string,
 *   permissionPolicy?: string|null,
 *   env?: Record<string,string|undefined>,
 *   graph?: object,
 *   graphs?: Record<string,object>,
 * }} options
 */
export function createOrchestrator({
  store,
  bus,
  adapterFactory,
  verify = defaultVerify,
  clock = () => Date.now(),
  generation = 'gen-1',
  permissionPolicy = null,
  env = process.env,
  graph = defaultGraph(),
  graphs = GRAPHS,
  // M-01 / AC-61: product-side injectable hold gate in front of the retry
  // backoff. WP-6 registers the `test.delivery` / `holdDelivery` RPC over this
  // controller from daemon/server.js; this package only consumes it and never
  // registers an RPC or touches `return {}`.
  //   wait(info) -> Promise<boolean>   true = proceed, false = cancel/stop
  //   info.cancelTimer() clears any pending backoff timer.
  deliveryHold = null,
  // B-01 / D-3 (AC-09~14): test-only hook that may mutate the handoff draft
  // before validation (the `test.handoff` seam is driven by WP-6). NODE_ENV=test
  // only; a bad draft here goes through the same one-CAS rejection as production.
  handoffDraftHook = null,
} = {}) {
  if (!store || typeof store.save !== 'function' || typeof store.load !== 'function') {
    throw new TypeError('createOrchestrator: 需要实现 load/save/list 的 store');
  }
  if (!bus || typeof bus.emit !== 'function') {
    throw new TypeError('createOrchestrator: 需要事件总线');
  }
  if (!adapterFactory || typeof adapterFactory.create !== 'function') {
    throw new TypeError('createOrchestrator: 需要 adapterFactory.create');
  }
  if (!graph || typeof graph !== 'object') {
    throw new TypeError('createOrchestrator: graph 必须是图对象');
  }

  const instanceSM = createInstanceSM();
  const nodeSM = createNodeSM();
  const handoffSM = createHandoffSM();
  const escalationSM = createEscalationSM();
  const sessionSM = createSessionSM();

  const runtimeEnv = env ?? process.env;
  const isTest = runtimeEnv?.NODE_ENV === 'test';
  const pauseSpec = parsePauseSpec(runtimeEnv?.MAESTRO_TEST_PAUSE);
  const stopAfter = Number.parseInt(runtimeEnv?.MAESTRO_TEST_STOP_AFTER ?? '', 10);
  const stopAfterStep = Number.isInteger(stopAfter) && stopAfter > 0 ? stopAfter : null;
  const fault =
    runtimeEnv?.MAESTRO_FAULT === 'state_write:escalation' ? 'state_write:escalation' : null;
  /** AC-44 fault injection: the workspace cannot be created. */
  const workspaceFault =
    runtimeEnv?.MAESTRO_FAULT === 'workspace_init:fail' ? 'workspace_init:fail' : null;
  /** D-4 / D-10: durable-inbox write fault (test-only seam value). */
  const inboxFault =
    isTest && runtimeEnv?.MAESTRO_FAULT === 'inbox_write:fail' ? 'inbox_write:fail' : null;
  /** AC-59: status.md refresh fault (test-only seam value). */
  const statusFault =
    isTest && runtimeEnv?.MAESTRO_FAULT === 'workspace_status_write:fail' ? STATUS_WRITE_FAULT : null;
  /** Deterministic retry gate for tests; production always uses 200/500ms. */
  const deliveryDelayMs = (() => {
    if (!isTest) return null;
    const value = Number.parseInt(runtimeEnv?.MAESTRO_TEST_DELIVERY_DELAY_MS ?? '', 10);
    return Number.isInteger(value) && value >= 0 ? value : null;
  })();

  /** 审批策略：显式参数 > env > 宿主配置 > 默认 allow（宿主细节不进入核心分支）。 */
  const explicitPermissionPolicy = normalizePermissionPolicy(permissionPolicy);
  const policyCache = new Map();
  async function policyFor(hostId) {
    if (explicitPermissionPolicy) return explicitPermissionPolicy;
    const key = typeof hostId === 'string' && hostId.length > 0 ? hostId : null;
    if (key !== null && policyCache.has(key)) return policyCache.get(key);
    const resolved = await resolvePermissionPolicy(key === null ? { root: store.root, env } : { root: store.root, hostId: key, env });
    if (key !== null) policyCache.set(key, resolved.policy);
    return resolved.policy;
  }

  /** 同一实例 / 同一目录的互斥。 */
  const locks = new Map();
  /** 运行中的图句柄：instanceId → { instanceId, graph, currentCtx, cancelled, finished }。 */
  const activeRuns = new Map();
  /** 运行终态等待器：instanceId → {promise, resolve}。 */
  const runWaiters = new Map();
  /** 已分配的实例号（防止并发自动分配撞号）。 */
  const reserved = new Set();
  /** 已创建的 adapter，dispose 时统一关闭。 */
  const adapters = new Set();
  /** 定点停止只触发一次。 */
  let stopAfterFired = false;

  const now = () => {
    const value = clock();
    return Number.isFinite(value) ? value : Date.now();
  };
  const iso = (ms = now()) => new Date(ms).toISOString();

  function withLock(key, fn) {
    const previous = locks.get(key) ?? Promise.resolve();
    const next = previous.then(fn, fn);
    const guard = next.catch(() => {});
    locks.set(key, guard);
    guard.then(() => {
      if (locks.get(key) === guard) locks.delete(key);
    });
    return next;
  }

  /** 事件发射器：统一补 instanceId / gen / 默认字段，并回灌 onProgress。 */
  function makeEmitter(instanceId, onProgress) {
    return async function emit(ev) {
      const payload = {
        instanceId,
        object: ev.object,
        objectId: ev.objectId,
        from: ev.from ?? null,
        to: ev.to ?? null,
        result: ev.result ?? 'applied',
        reason: ev.reason ?? 'state.change',
        detail: ev.detail ?? null,
        gen: generation,
      };
      // 可选：调用方已持有事件发生时刻时透传给总线（只有 node.dispatch 会带）。
      if (typeof ev.ts === 'string' && ev.ts.length > 0) payload.ts = ev.ts;
      const result = await bus.emit(payload);
      if (typeof onProgress === 'function') {
        try {
          onProgress({ ...payload, seq: result?.seq ?? null, ts: result?.ts ?? null });
        } catch {
          // 进度回调异常不影响裁决
        }
      }
      return result;
    };
  }

  async function saveState(instanceId, state, opts) {
    if (state?.counters) {
      state.counters.eventSeq = Math.max(0, store.nextSeq(instanceId) - 1);
    }
    const pending = opts ? store.save(instanceId, state, opts) : store.save(instanceId, state);
    const saved = await pending;
    // C-02: every successful snapshot write rewrites status.md atomically.
    // A refresh failure only emits an event and never rolls the state back (AC-59).
    if (saved?.ok) await refreshWorkspaceStatus(instanceId, state);
    return saved;
  }

  function expectedOf(state) {
    return {
      state: state?.state ?? null,
      halted: Boolean(state?.halted),
      rev: Number.isInteger(state?.rev) ? state.rev : 0,
      paused: Boolean(state?.paused),
    };
  }

  /** D-7.4 step 3: a dispatch CAS always expects a non-paused disk snapshot. */
  function expectedForDispatch(reloaded) {
    return {
      state: reloaded?.state ?? null,
      halted: Boolean(reloaded?.halted),
      rev: Number.isInteger(reloaded?.rev) ? reloaded.rev : 0,
      paused: false,
    };
  }

  /**
   * Refresh `status.md` from the just-persisted snapshot. Writing is best-effort:
   * `refreshStatusDoc` emits `workspace.status_write_failed` on failure and the
   * caller keeps going (AC-59).
   */
  async function refreshWorkspaceStatus(instanceId, state) {
    try {
      return await refreshStatusDoc({
        root: store.root,
        state,
        graph: graphForState(state),
        emit: makeEmitter(instanceId, null),
        workspaceDir: workspaceDirOf(state),
        fault: statusFault,
      });
    } catch {
      return { ok: false, code: 'WORKSPACE_STATUS_WRITE_FAILED', params: {} };
    }
  }

  /** 把磁盘快照灌回内存副本（保持引用不变，ctx 里的 state 仍然有效）。 */
  function adoptState(live, disk) {
    if (!live || !disk) return;
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, disk);
  }

  function smFor(object) {
    if (object === 'instance') return instanceSM;
    if (object === 'node') return nodeSM;
    if (object === 'session') return sessionSM;
    if (object === 'handoff') return handoffSM;
    if (object === 'escalation') return escalationSM;
    return null;
  }

  function locate(state, object, ids) {
    if (!state) return undefined;
    if (object === 'instance') return state;
    if (object === 'node') return nodeOf(state, ids.nodeId);
    if (object === 'session') return sessionOf(state, ids.sessionId);
    if (object === 'handoff') return handoffOf(state, ids.handoffId);
    if (object === 'escalation') {
      return (state.escalations ?? []).find((entry) => entry.escalationId === ids.escalationId) ?? null;
    }
    return undefined;
  }

  function objectIdOf(object, state, ids, instanceId) {
    if (object === 'instance') return instanceId;
    if (object === 'node') return ids.nodeId ?? nodeOf(state, ids.nodeId)?.nodeId ?? null;
    if (object === 'session') return ids.sessionId ?? null;
    if (object === 'handoff') return ids.handoffId ?? null;
    if (object === 'escalation') return ids.escalationId ?? null;
    return null;
  }

  /**
   * 统一迁移入口（比较并交换）。
   *
   * 1. 每次以磁盘最新快照为 `from` 重新校验；内存与磁盘分叉先按磁盘校正；
   * 2. 非法 → 落一条 `rejected / illegal_transition` 事件，磁盘不动；
   * 3. 合法 → 改内存副本，`save(..., {expectedState:{state,halted,rev}})`；
   * 4. `STORE_CONFLICT` → 重新 load 重试（最多 3 次）→ 仍冲突落 `store.conflict` 并放弃。
   */
  async function transit(instanceId, object, to, options = {}) {
    const { emit, state, reason, detail } = options;
    const ids = {
      nodeId: options.nodeId ?? null,
      sessionId: options.sessionId ?? null,
      handoffId: options.handoffId ?? null,
      escalationId: options.escalationId ?? null,
    };
    const sm = smFor(object);
    if (!sm) return { ok: false, code: 'UNKNOWN_OBJECT', from: null, to };

    let lastFrom = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const disk = await store.load(instanceId);
      if (!disk.ok) {
        return { ok: false, code: disk.code ?? 'NOT_FOUND', from: lastFrom, to };
      }
      const diskHolder = locate(disk.state, object, ids);
      if (diskHolder === null || diskHolder === undefined) {
        return { ok: false, code: 'UNKNOWN_STATE', from: lastFrom, to };
      }
      const expected = expectedOf(disk.state);
      const from = diskHolder.state;
      lastFrom = from;

      const liveHolder = state ? locate(state, object, ids) : diskHolder;
      if (liveHolder === null || liveHolder === undefined) {
        return { ok: false, code: 'UNKNOWN_STATE', from, to };
      }
      if (liveHolder.state !== from) {
        liveHolder.state = from;
        liveHolder.stateSince = diskHolder.stateSince;
      }

      if (from === to) return { ok: true, from, to, repeat: true };

      const verdict = sm.can(from, to);
      if (!verdict.ok) {
        if (typeof emit === 'function') {
          await emit({
            object,
            objectId: objectIdOf(object, disk.state, ids, instanceId),
            from,
            to,
            result: 'rejected',
            reason: 'illegal_transition',
            detail: { ...(detail || {}), message: verdict.message },
          });
        }
        return { ok: false, code: verdict.code, from, to };
      }

      liveHolder.state = to;
      liveHolder.stateSince = iso();
      let working = state ?? disk.state;
      // 非实例对象的迁移：实例级状态若已被外部改写（重启对账判 interrupted、
      // 别的核心写下终态），必须先按磁盘校正再重放本次迁移，绝不能把内存里的
      // 旧实例状态（running）连带写回磁盘，否则外部终态会被静默覆盖。
      if (object !== 'instance' && state && working.state !== disk.state.state) {
        adoptState(state, disk.state);
        const replay = locate(state, object, ids);
        if (replay === null || replay === undefined) {
          return { ok: false, code: 'UNKNOWN_STATE', from, to };
        }
        replay.state = to;
        replay.stateSince = iso();
        working = state;
      }
      const saved = await saveState(instanceId, working, { expectedState: expected });
      if (saved.ok) {
        if (typeof emit === 'function') {
          await emit({
            object,
            objectId: objectIdOf(object, working, ids, instanceId),
            from,
            to,
            result: 'applied',
            reason,
            detail,
          });
        }
        return { ok: true, from, to };
      }

      if (state) adoptState(state, disk.state);
      if (saved.code !== 'STORE_CONFLICT') {
        if (typeof emit === 'function') {
          await emit({
            object,
            objectId: objectIdOf(object, disk.state, ids, instanceId),
            from,
            to,
            result: 'rejected',
            reason: 'store.write_failed',
            detail: { ...(detail || {}), code: saved.code },
          });
        }
        return { ok: false, code: saved.code, from, to };
      }
    }

    const disk = await store.load(instanceId);
    const from = disk.ok ? (locate(disk.state, object, ids)?.state ?? lastFrom) : lastFrom;
    if (typeof emit === 'function') {
      await emit({
        object,
        objectId: disk.ok ? objectIdOf(object, disk.state, ids, instanceId) : instanceId,
        from,
        to,
        result: 'rejected',
        reason: 'store.conflict',
        detail: { ...(detail || {}), expected: lastFrom, actual: from },
      });
    }
    return { ok: false, code: 'STORE_CONFLICT', from, to };
  }

  function makeTransitioner(ctx) {
    return function transition(object, to, reason, detail) {
      return transit(ctx.instanceId, object, to, {
        emit: ctx.emit,
        state: ctx.state,
        reason,
        detail,
        nodeId: ctx.nodeId,
        sessionId: ctx.sessionId,
        handoffId: ctx.handoffId,
        escalationId: ctx.escalationId,
      });
    };
  }

  /** 落盘内存快照（CAS 到内存当前的实例状态/版本）。 */
  async function saveLive(ctx) {
    let res = await saveState(ctx.instanceId, ctx.state, { expectedState: expectedOf(ctx.state) });
    if (!res.ok && res.code === 'STORE_CONFLICT') {
      // D-7.2: a pause/resume write may have won the CAS. Backfill rev/paused
      // from the disk snapshot and replay the round write once.
      const disk = await store.load(ctx.instanceId);
      if (disk.ok) {
        ctx.state.rev = disk.state.rev;
        ctx.state.paused = Boolean(disk.state.paused);
        res = await saveState(ctx.instanceId, ctx.state, { expectedState: expectedOf(ctx.state) });
      }
      if (!res.ok && res.code === 'STORE_CONFLICT') ctx.conflicted = true;
    }
    return res;
  }

  async function allocateInstanceId() {
    const listed = await store.list();
    let max = 0;
    for (const item of listed?.items ?? []) {
      const match = /^INST-(\d+)$/.exec(String(item.instanceId ?? ''));
      if (match) max = Math.max(max, Number(match[1]));
    }
    for (const id of reserved) {
      const match = /^INST-(\d+)$/.exec(id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `INST-${String(max + 1).padStart(3, '0')}`;
  }

  /** 拉起 + 建会话失败的统一分类。 */
  function preflightFailure(error) {
    const message = error?.message ?? String(error ?? '未知错误');
    if (error?.code === 'REQUEST_TIMEOUT' || error?.code === 'CORE_START_FAILED') {
      return fail(CODES.CORE_START_FAILED, { cause: message });
    }
    return fail(CODES.DSH_SPAWN_FAILED, { cause: message });
  }

  function buildSession({ sessionId, hostId, nodeId, round }) {
    const at = iso();
    return {
      sessionId,
      nodeId: nodeId ?? null,
      round: Number.isInteger(round) ? round : 0,
      hostId: isinstanceOrNull(hostId),
      state: 'idle',
      stateSince: at,
      createdAt: at,
      lastEventAt: at,
      toolName: null,
      turnId: null,
      artifactRef: null,
      pendingPermission: null,
      quarantined: false,
    };
  }

  function isinstanceOrNull(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  function newState({ instanceId, cwd, task, runGraph }) {
    const at = iso();
    return arraysOf({
      schemaVersion: 2,
      instanceId,
      coreGeneration: generation,
      createdAt: at,
      updatedAt: at,
      state: 'created',
      stateSince: at,
      template: runGraph?.id ?? null,
      cwd,
      task,
      halted: false,
      rev: 0,
      counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      nodes: initialNodes(runGraph, { stateAt: at }),
      sessions: [],
      handoffs: [],
      escalations: [],
    });
  }

  /** 图名 → 图对象；未知模板返回 null（不抛）。 */
  function resolveTemplate(name) {
    return graphByName(graphs, name);
  }

  /** 实例当前所用的图（按写入的 template 反查，找不到退回本次注入的图）。 */
  function graphForState(state) {
    const byName = resolveTemplate(state?.template);
    if (byName) return byName;
    if (!Array.isArray(state?.nodes) || state.nodes.length === 0) return graph;
    return graph;
  }

  /** `productPolicy` of the graph this instance runs (`declared` when absent). */
  function productPolicyOf(state) {
    return graphForState(state)?.productPolicy ?? 'declared';
  }

  /** `<root>/.orch/instances/<id>/workspace` — the only base for versioned documents. */
  function workspaceDirOf(state) {
    if (!state || typeof state.instanceId !== 'string' || state.instanceId.length === 0) return null;
    return instanceWorkspaceDir(store.root, state.instanceId);
  }

  /**
   * Absolute `out/review.json` handed to the review prompt. Resolved from `state.cwd` —
   * the same base `readReview({cwd})` joins `REVIEW_PATH` against — so the host cannot
   * mistake a relative path for "inside the instance workspace".
   */
  function reviewPathOf(state) {
    return path.join(path.resolve(state?.cwd ?? process.cwd()), REVIEW_PATH);
  }

  /**
   * Create the instance workspace (D-8). Called *before* the first `state.json` write so a
   * failure leaves no half-built instance behind (AC-44).
   */
  /** Remove a half-built instance directory (only used before its first write). */
  async function discardInstance(instanceId) {
    try {
      await fs.rm(dirOfInstance(store.root, instanceId), { recursive: true, force: true });
    } catch {
      // The caller already reports WORKSPACE_INIT_FAILED; a leftover empty dir is harmless.
    }
  }

  async function prepareWorkspace(instanceId, runGraph = null, state = null) {
    if (workspaceFault) return { ok: false, cause: `注入故障（${workspaceFault}）` };
    // M-1 / D-8: delegate to the core workspace builder so every instance gets
    // shared/, status.md and (for multi-node graphs) one stage/ dir per node.
    const prepared = await prepareWorkspaceDir({
      root: store.root,
      instanceId,
      graph: runGraph,
      state,
    });
    if (!prepared.ok) {
      return { ok: false, cause: prepared.params?.cause ?? prepared.cause ?? 'workspace_init_failed' };
    }
    return { ok: true };
  }

  /**
   * Which document the review must point at (D-8): the input reference of the handoff that
   * dispatched the review node, falling back to the upstream node's first artifact.
   */
  function expectedArtifactOf(ctx) {
    const input = ctx.handoff?.artifactRefs?.input;
    if (Array.isArray(input) && typeof input[0] === 'string' && input[0].length > 0) return input[0];
    const fromId = ctx.handoff?.edge?.from ?? null;
    const fromNode = fromId === null ? null : nodeOf(ctx.state, fromId);
    return fromNode?.artifactRefs?.[0]?.ref ?? null;
  }

  async function createAdapter(hostId, cwd) {
    const args = typeof hostId === 'string' && hostId.length > 0 ? { hostId, cwd } : { cwd };
    const created = await adapterFactory.create(args);
    if (created && created.ok === false) throw created.error ?? created;
    const adapter = created && created.ok === true && created.adapter ? created.adapter : created;
    if (!adapter || typeof adapter.initialize !== 'function') {
      throw new Error('adapterFactory.create 未返回可用适配器');
    }
    adapters.add(adapter);
    const initialized = await adapter.initialize();
    if (!initialized || initialized.ok !== true) {
      throw initialized?.error ?? new Error('initialize 失败');
    }
    const session = await adapter.newSession({ cwd, mcpServers: [] });
    if (!session || session.ok !== true) {
      throw session?.error ?? new Error('newSession 失败');
    }
    return { adapter, sessionId: session.result.sessionId };
  }

  async function disposeAdapter(adapter) {
    if (!adapter) return;
    adapters.delete(adapter);
    try {
      await adapter.dispose();
    } catch {
      // 清理失败不改变错误分类
    }
  }

  // ------------------------------------------------------------------ 上下文

  function makeCtx({ instanceId, state, node, session, adapter, hostId, handoffId, emit, onProgress }) {
    const normalizer = createNormalizer({ clock });
    const handoffEmits = [];
    const handoff = handoffId ? handoffOf(state, handoffId) : null;
    const tracker = handoff
      ? createHandoffTracker({
          handoffId,
          startedAt: Date.parse(handoff.createdAt ?? '') || now(),
          clock,
          emit: (ev) => handoffEmits.push(ev),
        })
      : null;
    return {
      instanceId,
      state,
      node,
      session,
      adapter,
      tracker,
      normalizer,
      // 回流/复测的下一轮派发要从上一轮的 ctx 取 hostId（driveGraph → advance）；
      // 丢了它会退回默认宿主（dsh），把 mock 夹具的会话换掉。
      hostId: hostId ?? null,
      sessionId: session.sessionId,
      nodeId: node.nodeId,
      handoffId: handoffId ?? null,
      handoff,
      cancelled: false,
      finished: false,
      quiescing: false,
      conflicted: false,
      permission: null,
      permissionPolicy: 'allow',
      chain: Promise.resolve(),
      observedRefs: [],
      handoffEmits,
      pauses: [],
      emit,
      onProgress,
    };
  }

  function enqueue(ctx, fn) {
    ctx.chain = ctx.chain.then(fn, fn);
    return ctx.chain;
  }

  async function flushHandoff(ctx) {
    const list = ctx.handoffEmits.splice(0);
    for (const ev of list) {
      await ctx.emit({
        object: ev.object,
        objectId: ev.objectId,
        from: ev.from,
        to: ev.to,
        result: ev.result,
        reason: ev.reason,
        detail: ev.detail ?? null,
      });
    }
  }

  async function subscribe(ctx) {
    ctx.adapter.onUpdate((payload) => {
      if (payload?.sessionId !== ctx.sessionId) return;
      handleUpdate(ctx, payload.update);
    });
    if (typeof ctx.adapter.onPermission === 'function') {
      ctx.offPermission = ctx.adapter.onPermission((permission) => handlePermission(ctx, permission));
    }
  }

  // ------------------------------------------------------------- 会话与审批

  /** 被审批动作名：tool_call.title（已记进会话）> toolCallId > 固定串。 */
  function permissionAction(ctx, permission) {
    const remembered = ctx.session?.toolName;
    if (typeof remembered === 'string' && remembered.trim().length > 0) return remembered.trim();
    if (typeof permission?.toolCallId === 'string' && permission.toolCallId.length > 0) {
      return permission.toolCallId;
    }
    return 'unknown-tool';
  }

  async function handlePermission(ctx, permission) {
    if (!permission || typeof permission.respond !== 'function') return;
    if (ctx.finished || ctx.quiescing) {
      permission.respond({ outcome: { outcome: 'cancelled' } });
      return;
    }
    if (permission.sessionId && ctx.sessionId && permission.sessionId !== ctx.sessionId) {
      permission.respond({ outcome: { outcome: 'selected', optionId: 'allow-once' } });
      return;
    }

    const action = permissionAction(ctx, permission);
    ctx.permission = {
      action,
      toolCallId: permission.toolCallId ?? null,
      respond: permission.respond,
    };

    ctx.normalizer.onPermissionRequested({
      sessionId: ctx.sessionId,
      toolCallId: permission.toolCallId,
      action,
    });

    // D-5.2: an explicit per-run policy overrides the host default. With no
    // override this is exactly the old `ctx.permissionPolicy` (declared in the
    // WP-6 tail section below, read here through the closure at call time).
    const policy = runtimeApprovalPolicy ?? ctx.permissionPolicy;

    // hold: the approval row AND the session's waiting_input move land in ONE
    // CAS; every event is broadcast only after that write (D-5.4 / section 2.9).
    if (policy === 'hold') {
      const state = ctx.state;
      const session = ctx.session;
      const from = session ? session.state : null;
      if (session) {
        session.state = 'waiting_input';
        session.stateSince = iso();
        session.pendingPermission = { toolCallId: permission.toolCallId ?? null, action };
      }
      if (!Array.isArray(state.approvals)) state.approvals = [];
      const approval = approvals.buildApproval({
        approvals: state.approvals,
        instanceId: ctx.instanceId,
        nodeId: ctx.nodeId,
        sessionId: ctx.sessionId,
        action,
        toolCallId: permission.toolCallId ?? null,
        now: clock,
      });
      state.approvals.push(approval);

      const events = [];
      if (session && from !== 'waiting_input') {
        events.push({
          object: 'session',
          objectId: ctx.sessionId,
          from,
          to: 'waiting_input',
          result: 'applied',
          reason: 'permission.requested',
          detail: { action, toolCallId: permission.toolCallId ?? null },
        });
      }
      events.push({
        object: 'approval',
        objectId: approval.approvalId,
        from: null,
        to: 'pending',
        result: 'applied',
        reason: 'approval.created',
        detail: {
          approvalId: approval.approvalId,
          nodeId: ctx.nodeId,
          sessionId: ctx.sessionId,
          action,
          toolCallId: permission.toolCallId ?? null,
        },
      });
      await enqueue(ctx, async () => {
        await saveLive(ctx);
        for (const event of events) await ctx.emit(event);
      });
      // No respond: an external decide (approve/cancel) owns the next move.
      return;
    }

    // allow / reject are launch-time policies: keep the I1.1 path byte-for-byte.
    const session = ctx.session;
    if (session) {
      const from = session.state;
      session.state = 'waiting_input';
      session.stateSince = iso();
      session.pendingPermission = { toolCallId: permission.toolCallId ?? null, action };
      if (from !== 'waiting_input') {
        await enqueue(ctx, async () => {
          await ctx.emit({
            object: 'session',
            objectId: ctx.sessionId,
            from,
            to: 'waiting_input',
            result: 'applied',
            reason: 'permission.requested',
            detail: { action, toolCallId: permission.toolCallId ?? null },
          });
          await saveLive(ctx);
        });
      } else {
        await saveLive(ctx);
      }
    }

    if (policy === 'allow') {
      permission.respond({ outcome: { outcome: 'selected', optionId: 'allow-once' } });
      await settlePermission(ctx, 'allow');
      return;
    }
    if (policy === 'reject') {
      permission.respond({ outcome: { outcome: 'selected', optionId: 'reject-once' } });
      await settlePermission(ctx, 'reject');
      return;
    }
    // Unknown policy: keep the session waiting without a respond, exactly like
    // the old hold fallback (normalizePermissionPolicy guards the valid values).
  }

  async function settlePermission(ctx, decision, options = {}) {
    const { approval = null, respond = null } = options;
    ctx.normalizer.onPermissionSettled({ sessionId: ctx.sessionId, decision });
    const to = decision === 'allow' ? 'thinking' : 'idle';
    const session = ctx.session;
    if (!session) return;
    const from = session.state;
    if (decision !== 'allow') {
      ctx.quiescing = true;
      session.quarantined = true;
    }
    session.state = to;
    session.stateSince = iso();

    if (approval) {
      // approve --decision allow|deny: the row move, the session move and the
      // event share ONE CAS; broadcast only after the write, then answer the
      // host so it cannot overtake the committed state.
      const verdict = approvals.decideApproval(
        approval,
        decision === 'allow' ? 'allow' : 'deny',
        iso(),
      );
      await enqueue(ctx, async () => {
        await saveLive(ctx);
        if (verdict.ok) {
          await ctx.emit({
            object: 'session',
            objectId: ctx.sessionId,
            from,
            to,
            result: 'applied',
            reason: decision === 'allow' ? 'permission.allowed' : 'permission.denied',
            detail: ctx.permission
              ? { action: ctx.permission.action, approvalId: approval.approvalId }
              : { approvalId: approval.approvalId },
          });
        }
        if (typeof respond === 'function') {
          try {
            respond({
              outcome: {
                outcome: 'selected',
                optionId: decision === 'allow' ? 'allow-once' : 'reject-once',
              },
            });
          } catch {
            // A late host acknowledgement must not roll back the committed row.
          }
        }
      });
      return;
    }

    // Launch-time allow / reject strategy: the I1.1 path stays byte-for-byte.
    if (from !== to) {
      await enqueue(ctx, async () => {
        await ctx.emit({
          object: 'session',
          objectId: ctx.sessionId,
          from,
          to,
          result: 'applied',
          reason: decision === 'allow' ? 'permission.allowed' : 'permission.denied',
          detail: ctx.permission ? { action: ctx.permission.action } : null,
        });
        await saveLive(ctx);
      });
    } else {
      await saveLive(ctx);
    }
  }

  /** 单条 session/update：归并会话状态（节流）、判定 accepted、抓 artifactRef。 */
  /**
   * Downstream gate (D-3): the upstream node leaves `review(downstream)` only when the
   * downstream node's first turn event has been accepted. Returns the event to emit, or
   * null when nothing is gated. The caller persists both the mutation and the event in a
   * single `saveLive` — this function never writes.
   */
  function openDownstreamGate(ctx) {
    const state = ctx.state;
    const handoff = ctx.handoff;
    if (!state || !handoff || handoff.state !== 'accepted') return null;
    const fromId = handoff.edge?.from ?? null;
    const upstream = fromId === null ? null : nodeOf(state, fromId);
    if (!upstream) return null;
    if (upstream.state !== 'review' || upstream.reviewReason !== 'downstream') return null;

    upstream.state = 'done';
    upstream.stateSince = iso();
    upstream.reviewReason = null;
    const upstreamSession = upstream.sessionId ? sessionOf(state, upstream.sessionId) : null;
    if (upstreamSession && upstreamSession.state === 'waiting_dependency') {
      upstreamSession.state = 'idle';
      upstreamSession.stateSince = iso();
    }
    return {
      object: 'node',
      objectId: upstream.nodeId,
      from: 'review',
      to: 'done',
      result: 'note',
      reason: 'review.downstream_accepted',
      detail: { handoffId: handoff.handoffId, fromNodeId: fromId, round: upstream.round },
    };
  }

  function handleUpdate(ctx, update) {
    const normalizer = ctx.normalizer;
    const tracker = ctx.tracker;
    const session = ctx.session;
    if (!session) return;
    const name = update?.sessionUpdate;
    const before = session.state;

    const reduced = normalizer.reduce(session, update, {
      sessionId: ctx.sessionId,
      turnId: session.turnId,
      toolName: session.toolName,
    });

    session.lastEventAt = iso();

    const pendingEvents = [];
    if (!reduced.dropped) {
      if (reduced.state !== before) {
        pendingEvents.push({
          object: 'session',
          objectId: ctx.sessionId,
          from: before,
          to: reduced.state,
          result: 'applied',
          reason: 'session.state',
          detail: { event: typeof name === 'string' ? name : null },
        });
        session.state = reduced.state;
        session.stateSince = iso();
      }
      if (reduced.state === 'tool_running') {
        session.toolName = reduced.toolName ?? session.toolName ?? null;
      } else {
        session.toolName = null;
      }
    }

    if (name === 'tool_call') {
      if (typeof update?.title === 'string' && update.title.trim()) {
        session.toolName = update.title.trim();
      }
      const filePath = update?.rawInput?.file_path;
      if (typeof filePath === 'string' && filePath.length > 0) {
        session.artifactRef = filePath;
        if (!ctx.observedRefs.includes(filePath)) ctx.observedRefs.push(filePath);
      }
    }

    let accepted = false;
    if (tracker && ctx.handoff) {
      const beforeHandoff = tracker.state();
      tracker.observeTurnEvent({ name, atMs: now() });
      applyHandoff(ctx.handoff, {
        ...tracker.snapshot(),
        edge: ctx.handoff.edge,
        defects: ctx.handoff.defects,
        note: ctx.handoff.note,
        wakeConsumedAt: ctx.handoff.wakeConsumedAt,
        artifactRefs: ctx.handoff.artifactRefs,
        revisionRequirement: ctx.handoff.revisionRequirement,
      });
      if (beforeHandoff !== 'accepted' && tracker.state() === 'accepted') accepted = true;
    }
    session.quarantined = Boolean(normalizer.getSession(ctx.sessionId)?.quarantined);

    let gateEvent = null;
    if (accepted) {
      ctx.pauses.push(pauseFor('after_accepted', ctx.nodeId));
      // D-3: the upstream node becomes `done` exactly here — the first turn event of the
      // downstream node is the idempotency key. The state change and its event are saved
      // by the single `saveLive` below (C-09: one CAS, never a second `transit`).
      gateEvent = openDownstreamGate(ctx);
    }

    const handoffEvents = ctx.handoffEmits.splice(0);
    if (pendingEvents.length === 0 && handoffEvents.length === 0 && gateEvent === null) return;
    enqueue(ctx, async () => {
      for (const ev of pendingEvents) await ctx.emit(ev);
      for (const ev of handoffEvents) {
        await ctx.emit({
          object: ev.object,
          objectId: ev.objectId,
          from: ev.from,
          to: ev.to,
          result: ev.result,
          reason: ev.reason,
          detail: ev.detail ?? null,
        });
      }
      if (gateEvent) await ctx.emit(gateEvent);
      await saveLive(ctx);
    });
  }

  /**
   * 失败收尾统一把会话拉回 idle：不允许 thinking / tool_running / waiting_input
   * 跨到终态之后。quiescing 之后的迟到帧一律丢弃。
   */
  async function quiesceSession(ctx, reason) {
    ctx.quiescing = true;
    const session = ctx.session;
    if (!session) return;
    try {
      ctx.normalizer.onCancelled(ctx.sessionId);
    } catch {
      // 归一化器异常不影响收尾
    }
    const from = session.state;
    if (from !== 'idle') {
      await ctx.emit({
        object: 'session',
        objectId: ctx.sessionId,
        from,
        to: 'idle',
        result: 'applied',
        reason,
        detail: null,
      });
    }
    session.state = 'idle';
    session.stateSince = iso();
    session.toolName = null;
    session.pendingPermission = null;
    session.quarantined = true;
  }

  /** 正常结束后让会话回到 idle（不隔离，保留后续状态读取）。 */
  async function idleSession(ctx, reason) {
    ctx.quiescing = true;
    const session = ctx.session;
    if (!session) return;
    try {
      ctx.normalizer.onPromptSettled(ctx.sessionId, {});
    } catch {
      // ignore
    }
    const from = session.state;
    if (from !== 'idle') {
      await ctx.emit({
        object: 'session',
        objectId: ctx.sessionId,
        from,
        to: 'idle',
        result: 'applied',
        reason,
        detail: null,
      });
    }
    session.state = 'idle';
    session.stateSince = iso();
    session.toolName = null;
    session.pendingPermission = null;
  }

  // ------------------------------------------------------------------ 派发

  /**
   * 把一次派发写进快照并拉起会话。
   *
   * 顺序固定：轮次 +1（含派发计数）→ 落盘 → `node.dispatch` → 建会话 →
   * 投递 prompt → 交接包 delivered → 落盘。建会话失败也保留这次派发计数。
   */
  /**
   * M-01 / AC-61: injectable hold point in front of the retry backoff.
   * When a controller is injected, its `wait(info)` fully replaces the real
   * timer (no sleep, deterministic release/cancel from the RPC or a test);
   * `null` means "no controller, fall through to the cancellable timer".
   * WP-6 owns release()/cancel() on the controller; here we only consume it.
   */
  async function awaitDeliveryHold(info) {
    if (!deliveryHold || typeof deliveryHold.wait !== 'function') return null;
    const proceed = await deliveryHold.wait(info);
    return proceed === false ? false : true;
  }

  /** 可取消的重试等待：每 20ms 重查取消标记，定时器句柄常驻 ctx.deliveryTimer。 */
  function waitDeliveryRetry(ctx, ms) {
    return new Promise((resolve) => {
      const total = Math.max(0, Number.isFinite(ms) ? ms : 0);
      const step = Math.min(20, total || 1);
      let waited = 0;
      const poll = () => {
        if (ctx.cancelled || ctx.finished) {
          if (ctx.deliveryTimer) clearTimeout(ctx.deliveryTimer);
          ctx.deliveryTimer = null;
          resolve(false);
          return;
        }
        if (waited >= total) {
          ctx.deliveryTimer = null;
          resolve(true);
          return;
        }
        const slice = Math.min(step, total - waited);
        waited += slice;
        const timer = setTimeout(poll, slice);
        timer.unref?.();
        ctx.deliveryTimer = timer;
      };
      poll();
    });
  }

  /** D-4.6 / D-4.9: exhaust -> expired package, then one-CAS delivery_failed escalation. */
  async function escalateDeliveryFailure(ctx, lastError, attempts) {
    const { state, node, session } = ctx;
    const detail = applyPlaceholders(CORE_TEXT.deliveryFailed, {
      id: ctx.handoff?.handoffId ?? '',
      n: attempts,
      lastError,
    });
    return escalateState({
      instanceId: ctx.instanceId,
      state,
      node,
      reasonCode: 'delivery_failed',
      reasonDetail: detail,
      defects: [],
      overlaySession: session ? { ...session } : null,
      sessionTerminal: 'idle',
      emit: ctx.emit,
    });
  }

  /**
   * D-4: deliver a graph-driven handoff with 1 first attempt + 2 retries.
   * The returned promise resolves only with the final prompt result so
   * finishGraphNode never sees an intermediate failure. Events are persisted
   * by ctx.emit before the state CAS, and the inbox is rewritten per attempt.
   */
  async function deliverWithRetry(ctx, text) {
    const { state, adapter, sessionId, handoff, tracker } = ctx;
    const instanceId = ctx.instanceId;
    const delays = deliveryDelayMs === null ? [200, 500] : [deliveryDelayMs, deliveryDelayMs, deliveryDelayMs];
    let lastError = 'delivery failed';
    let final = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // D-4.3 / C-14: re-check the instance before every attempt.
      if (ctx.cancelled || ctx.finished) break;
      const disk = await store.load(instanceId);
      if (!disk.ok || disk.state.state === 'cancelled' || disk.state.halted === true) break;

      // Optimistic `delivered` is placed BEFORE adapter.prompt so the first
      // turn frame can still drive delivered -> accepted (D-4.5 / C-10).
      if (tracker && handoff && tracker.can('delivered')) {
        tracker.delivered({ atMs: now(), attempt });
        applyHandoff(handoff, {
          ...tracker.snapshot(),
          edge: handoff.edge,
          defects: handoff.defects,
          note: handoff.note,
          wakeConsumedAt: handoff.wakeConsumedAt,
          artifactRefs: handoff.artifactRefs,
          revisionRequirement: handoff.revisionRequirement,
        });
        await flushHandoff(ctx);
        await saveLive(ctx);
      }

      let result;
      try {
        result = await Promise.resolve().then(() =>
          adapter.prompt(sessionId, [{ type: 'text', text }]),
        );
      } catch (error) {
        result = { ok: false, error: { code: 'UNKNOWN_ERROR', message: String(error?.message ?? error) } };
      }

      if (result && result.ok === true) {
        await patchInbox({
          root: store.root,
          instanceId,
          handoffId: handoff.handoffId,
          patch: { deliveryAttempts: attempt, deliveredAt: iso(), lastError: null },
          fault: inboxFault,
        });
        final = result;
        break;
      }

      lastError = String(result?.error?.message ?? result?.error?.code ?? 'delivery failed');

      // A turn frame already arrived: this is an execution failure, not a
      // delivery failure (C-09). Hand the result straight to the finish path.
      if (tracker && tracker.state() !== 'delivered') {
        final = result;
        break;
      }

      // delivered -> pending fallback, one CAS and one handoff.pending event (D-4.4).
      if (tracker && handoff) {
        tracker.pending({ atMs: now(), attempt, lastError });
        applyHandoff(handoff, {
          ...tracker.snapshot(),
          edge: handoff.edge,
          defects: handoff.defects,
          note: handoff.note,
          wakeConsumedAt: handoff.wakeConsumedAt,
          artifactRefs: handoff.artifactRefs,
          revisionRequirement: handoff.revisionRequirement,
        });
        await flushHandoff(ctx);
        await saveLive(ctx);
      }
      await patchInbox({
        root: store.root,
        instanceId,
        handoffId: handoff.handoffId,
        patch: { deliveryAttempts: attempt, lastError },
        fault: inboxFault,
      });

      if (attempt === 3) {
        if (tracker && handoff) {
          tracker.expired({ atMs: now(), attempts: 3 });
          applyHandoff(handoff, {
            ...tracker.snapshot(),
            edge: handoff.edge,
            defects: handoff.defects,
            note: handoff.note,
            wakeConsumedAt: handoff.wakeConsumedAt,
            artifactRefs: handoff.artifactRefs,
            revisionRequirement: handoff.revisionRequirement,
          });
          await flushHandoff(ctx);
          await saveLive(ctx);
        }
        await patchInbox({
          root: store.root,
          instanceId,
          handoffId: handoff.handoffId,
          patch: { deliveryAttempts: 3, lastError },
          fault: inboxFault,
        });
        // Escalate BEFORE the promise settles so finishGraphNode is short-circuited.
        await escalateDeliveryFailure(ctx, lastError, 3);
        final = result;
        break;
      }

      // M-01: an injected hold gate replaces the real backoff timer entirely,
      // so retries are driven by explicit release/cancel (no sleep under load).
      const hold = await awaitDeliveryHold({
        instanceId,
        handoffId: handoff?.handoffId ?? null,
        attempt,
        cancelTimer: () => {
          if (ctx.deliveryTimer) clearTimeout(ctx.deliveryTimer);
          ctx.deliveryTimer = null;
        },
      });
      if (hold === false || ctx.cancelled || ctx.finished) {
        if (ctx.deliveryTimer) clearTimeout(ctx.deliveryTimer);
        ctx.deliveryTimer = null;
        final = result;
        break;
      }
      if (hold === null) {
        const goOn = await waitDeliveryRetry(ctx, delays[attempt - 1]);
        if (!goOn) {
          if (ctx.deliveryTimer) clearTimeout(ctx.deliveryTimer);
          ctx.deliveryTimer = null;
          final = result;
          break;
        }
      }
    }
    if (ctx.deliveryTimer) {
      clearTimeout(ctx.deliveryTimer);
      ctx.deliveryTimer = null;
    }
    return final ?? { ok: false, error: { code: 'HOST_ERROR', message: lastError } };
  }

  async function dispatchInState(state, nodeId, options = {}) {
    const { handoffId = null, promptText = null, hostId = null, emit, onProgress } = options;
    const runGraph = graphForState(state);
    const node = nodeOf(state, nodeId);
    if (!node) return { ok: false, action: 'stop', code: 'UNKNOWN_STATE' };
    if (isNodeBusyState(node.state)) return { ok: false, action: 'reject', code: 'NODE_BUSY' };

    const def = graphNode(runGraph, nodeId);
    const fromNodeState = node.state;
    const at = iso();
    node.round = (Number.isInteger(node.round) ? node.round : 0) + 1;
    node.state = 'running';
    node.stateSince = at;
    node.roundStartedAt = at;
    if (!node.startedAt) node.startedAt = at;
    node.endedAt = null;
    node.failure = null;
    node.note = null;
    state.counters.dispatchCount += 1;
    state.state = 'running';
    state.stateSince = at;

    // D-7.4 step 3: the dispatch CAS expects the seam-fresh snapshot and a
    // fixed `paused: false`, so a pause write that landed first must conflict.
    const saved = await saveState(state.instanceId, state, {
      expectedState: expectedForDispatch(state),
    });
    if (!saved.ok) return { ok: false, action: 'reject', code: saved.code };

    await emit({
      object: 'node',
      objectId: nodeId,
      from: fromNodeState,
      to: 'running',
      result: 'applied',
      reason: 'node.dispatch',
      detail: { round: node.round, nodeId, roleId: node.roleId },
      // 事件的 ts 复用本条派发取到的 `at`：saveState 的磁盘 IO 不得把两者拉开，
      // 否则 `startedAt` 与事件 ts 只是"近似相等"（AC-35 要求逐字等式）。
      ts: at,
    });

    let adapter = null;
    let sessionId = null;
    try {
      const created = await createAdapter(hostId, state.cwd);
      adapter = created.adapter;
      sessionId = created.sessionId;
    } catch (error) {
      if (adapter) await disposeAdapter(adapter);
      // AC-65 / BR-13,BR-29: the handoff was already persisted as `created`
      // before this dispatch. A session-creation failure must not leave it as
      // an orphan; fold it into the escalation's single CAS as rejected.
      const pendingHandoff = (state.handoffs ?? []).find(
        (item) => item?.handoffId === handoffId,
      ) ?? null;
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: 'dispatch_failed',
        reasonDetail: ESC_TEXT.dispatchFailed,
        defects: [],
        ...(pendingHandoff
          ? { pendingHandoff: { ...pendingHandoff, rejectReason: 'delivery_failed' } }
          : {}),
        emit,
      });
      return {
        ok: false,
        action: 'stop',
        code: escalation.ok ? 'DISPATCH_FAILED' : 'ESCALATION_WRITE_FAILED',
        escalation,
      };
    }

    const session = buildSession({ sessionId, hostId, nodeId, round: node.round });
    state.sessions.push(session);
    node.sessionId = sessionId;

    const ctx = makeCtx({
      instanceId: state.instanceId,
      state,
      node,
      session,
      adapter,
      hostId,
      handoffId,
      emit,
      onProgress,
    });
    await subscribe(ctx);

    // 会话初值保持 idle：只有宿主真的发出 turn 内帧才进入 thinking。
    ctx.normalizer.onPromptSent(ctx.sessionId, TURN_ID);
    session.turnId = TURN_ID;
    ctx.permissionPolicy = await policyFor(hostId);

    let text = promptText;
    if (text === null || text === undefined) {
      // Entry-node dispatch (and the test seam) has no plan to borrow a prompt from, so
      // the wording is assembled here. `doc-single` resolves its own product path so the
      // research prompt gets an absolute `写入路径：` (D-8); older graphs keep using the
      // task's `产物：` line exactly as in I1.2.
      const productPolicy = productPolicyOf(state);
      const workspaceDir = workspaceDirOf(state);
      const resolution = resolveNodeProducts(def, {
        node,
        state,
        workspaceDir,
        cwd: state.cwd,
        productPolicy,
      });
      const docSingleProducts = resolution.ok ? resolution.products : [];
      const promptProducts = productPolicy === 'doc-single' ? docSingleProducts : productsOfTask(state);
      const writeRef = promptProducts[0] ?? def?.products?.[0] ?? null;
      text = promptFor({
        graph: runGraph,
        node: def,
        handoff: ctx.handoff,
        task: state.task ?? '',
        products: promptProducts,
        defects: ctx.handoff?.defects ?? [],
        defectCount: ctx.handoff?.defects?.length ?? 0,
        round: node.round,
        researchRef: def?.products?.[0] ?? null,
        docRef: promptProducts[0] ?? null,
        previousRef: null,
        writePath: writeRef === null ? null : writePathOf(workspaceDir, writeRef),
        workspaceDir,
        reviewPath: reviewPathOf(state),
        revisionRequirement: ctx.handoff?.revisionRequirement ?? null,
      });
    }

    // D-4.1 / C-04: only graph-driven packages (edge !== null) enter the
    // durable-inbox + retry path. Single bootstraps and the entry-node dispatch
    // keep the I1.2 / I1.3 delivery path byte-for-byte.
    const graphHandoff = ctx.handoff && ctx.handoff.edge != null ? ctx.handoff : null;
    if (graphHandoff) {
      // D-7.4 step 2: atomically persist the inbox BEFORE any delivery; only
      // deliverable === true may reach adapter.prompt (AC-15 / C-08).
      const message = buildInboxMessage({
        handoffId: graphHandoff.handoffId,
        instanceId: state.instanceId,
        fromNodeId: graphHandoff.fromNodeId ?? graphHandoff.edge?.from ?? null,
        toNodeId: graphHandoff.toNodeId ?? graphHandoff.edge?.to ?? null,
        sessionId: ctx.sessionId,
        promptText: text,
        createdAt: graphHandoff.createdAt ?? at,
        deliveryAttempts: 1,
      });
      const inbox = await writeInbox({
        root: store.root,
        instanceId: state.instanceId,
        handoffId: graphHandoff.handoffId,
        message,
        fault: inboxFault,
      });
      if (!inbox.deliverable) {
        // D-4.2 / D-4.7: no delivery; one CAS writes the rejected package,
        // quarantines the just-created session and escalates delivery_failed.
        const escalation = await escalateState({
          instanceId: state.instanceId,
          state,
          node,
          reasonCode: 'delivery_failed',
          reasonDetail: applyPlaceholders(CORE_TEXT.deliveryFailed, {
            id: graphHandoff.handoffId,
            n: 0,
            lastError: inbox.code ?? 'INBOX_WRITE_FAILED',
          }),
          defects: [],
          pendingHandoff: { ...graphHandoff, rejectReason: 'delivery_failed' },
          overlaySession: session ? { ...session } : null,
          sessionTerminal: 'idle',
          emit,
        });
        return {
          ok: false,
          action: 'stop',
          code: escalation.ok ? 'INBOX_WRITE_FAILED' : 'ESCALATION_WRITE_FAILED',
          escalation,
        };
      }
      // D-7.4 step 3 / AC-15: handoff.inboxed strictly precedes delivered.
      await emit({
        object: 'handoff',
        objectId: graphHandoff.handoffId,
        from: null,
        to: null,
        result: 'note',
        reason: 'handoff.inboxed',
        detail: { path: inbox.path },
      });
      // D-4.9: ctx.promptPromise exposes ONLY the final result; the retry loop
      // owns every intermediate delivered/pending/expired CAS.
      ctx.promptPromise = deliverWithRetry(ctx, text);
      ctx.promptPromise.catch(() => {});
    } else {
      const promptPromise = Promise.resolve().then(() =>
        adapter.prompt(ctx.sessionId, [{ type: 'text', text }]),
      );
      promptPromise.catch(() => {});
      ctx.promptPromise = promptPromise;

      if (ctx.tracker && ctx.handoff) {
        if (ctx.handoff.state === 'created') {
          ctx.tracker.delivered({ atMs: now() });
          applyHandoff(ctx.handoff, {
            ...ctx.tracker.snapshot(),
            edge: ctx.handoff.edge,
            defects: ctx.handoff.defects,
            note: ctx.handoff.note,
            wakeConsumedAt: ctx.handoff.wakeConsumedAt,
            artifactRefs: ctx.handoff.artifactRefs,
            revisionRequirement: ctx.handoff.revisionRequirement,
          });
          await flushHandoff(ctx);
        }
      }
      await saveLive(ctx);
    }

    const handle = activeRuns.get(state.instanceId);
    if (handle) handle.currentCtx = ctx;
    else activeRuns.set(state.instanceId, {
      instanceId: state.instanceId,
      graph: runGraph,
      currentCtx: ctx,
      cancelled: false,
      finished: false,
    });

    return { ok: true, action: 'dispatch', ctx, nodeId, round: node.round, sessionId };
  }

  // -------------------------------------------------------------- 升级事务

  async function escalateState({
    instanceId,
    state,
    node,
    reasonCode,
    reasonDetail,
    defects = [],
    pendingHandoff = null,
    overlaySession = null,
    sessionTerminal = 'escalated',
    retryOnConflict = 1,
    emit,
  }) {
    if (!node) return { ok: false, code: 'ESCALATION_WRITE_FAILED' };
    // commitEscalation 的 emit 是同步签名（不允许回滚已提交事务），这里把返回的
    // promise 收集起来，事务结束前统一 await —— 否则调用方一拿到结果就读
    // events.jsonl 会读不到 node/session/instance 三条迁移。
    const pending = [];
    const tracked = (event) => {
      const maybe = typeof emit === 'function' ? emit(event) : null;
      if (maybe && typeof maybe.then === 'function') pending.push(Promise.resolve(maybe).catch(() => {}));
      return maybe;
    };
    const entry = buildEscalation({
      instanceId,
      escalations: state?.escalations ?? [],
      nodeId: node.nodeId,
      round: Number.isInteger(node.round) ? node.round : 1,
      reasonCode,
      reasonDetail,
      defects,
      now: clock,
    });

    const committed = await commitEscalation({
      instanceId,
      escalation: entry,
      pendingHandoff,
      overlaySession,
      sessionTerminal,
      retryOnConflict,
      load: store.load,
      saveState: (id, value, opts) => saveState(id, value, opts),
      emit: tracked,
      fault,
      now: clock,
    });
    await Promise.all(pending);

    if (committed.ok) {
      const disk = await store.load(instanceId);
      if (disk.ok && state) adoptState(state, disk.state);
      return committed;
    }

    const halted = await markHalted({
      instanceId,
      load: store.load,
      saveState: (id, value, opts) => saveState(id, value, opts),
      emit: tracked,
      now: clock,
      // 原因来自失败的那次升级写入（params.cause）；没有就退化为通用标记，
      // 保证 `orch run` 的「无法记录升级：<cause>」不出现 `?`。
      cause: committed.params?.cause ?? 'state_write_failed',
    });
    await Promise.all(pending);
    if (halted.ok) {
      const disk = await store.load(instanceId);
      if (disk.ok && state) adoptState(state, disk.state);
    }
    return { ok: false, code: 'ESCALATION_WRITE_FAILED', halted: halted.ok, params: committed.params };
  }

  // ---------------------------------------------------------- 单节点收尾（I1.1）

  async function finishSingle(ctx) {
    const { instanceId, nodeId, sessionId, state } = ctx;
    let prompted = null;
    try {
      prompted = await ctx.promptPromise;
    } catch (error) {
      prompted = { ok: false, error: { code: 'UNKNOWN_ERROR', message: String(error?.message ?? error) } };
    }
    await ctx.chain.catch(() => {});

    if (ctx.cancelled) {
      await cleanup(ctx);
      return { ok: true, instanceId, nodeId, sessionId, cancelled: true, snapshot: snapshotOf(state) };
    }

    if (!prompted || prompted.ok !== true) {
      const classified = classifyPromptError({
        code: prompted?.error?.code,
        message: prompted?.error?.message,
        sessionKnown: true,
      });
      return finishPromptError(ctx, classified, prompted?.error?.message, prompted?.error?.code);
    }

    const stopReason = prompted.result?.stopReason ?? null;
    state.hostRaw = state.hostRaw ?? {};
    state.hostRaw.stopReason = stopReason;

    if (stopReason === 'refusal') {
      return finishPromptError(
        ctx,
        {
          code: CODES.PERMISSION_DENIED,
          params: { step: ctx.permission?.action ?? ctx.session?.toolName ?? 'unknown-tool' },
        },
        'stopReason: refusal',
        null,
      );
    }
    if (stopReason === 'cancelled') {
      return finishPromptError(
        ctx,
        { code: CODES.HOST_ERROR, params: {} },
        'stopReason: cancelled（非本核心发起）',
        null,
      );
    }

    const transition = makeTransitioner(ctx);

    ctx.normalizer.onOutputSubmitted(sessionId);
    const sessionFrom = ctx.session.state;
    if (sessionFrom !== 'waiting_dependency') {
      await ctx.emit({
        object: 'session',
        objectId: sessionId,
        from: sessionFrom,
        to: 'waiting_dependency',
        result: 'applied',
        reason: 'output.submitted',
        detail: null,
      });
      ctx.session.state = 'waiting_dependency';
      ctx.session.stateSince = iso();
    }
    await transition('node', 'review', 'output.submitted');
    await saveLive(ctx);

    const declared = extractDeclaredArtifacts(state.task ?? '');
    const verified = await verify({ cwd: state.cwd, declared, observedRefs: ctx.observedRefs });
    ctx.node.artifactRefs = (verified.refs ?? []).map((ref) => ({ ...ref, verifiedAt: iso() }));

    if (verified.note === 'NO_DECLARATION') {
      await ctx.emit({
        object: 'node',
        objectId: nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'verification.skipped',
        detail: { note: '未声明产出，跳过存在性检查' },
      });
    }

    if (verified.ok) {
      await transition('node', 'done', 'verification.passed');
      if (ctx.handoff?.state === 'accepted') {
        ctx.tracker.consumed({ atMs: now() });
        applyHandoff(ctx.handoff, {
          ...ctx.tracker.snapshot(),
          edge: ctx.handoff.edge,
          defects: ctx.handoff.defects,
          note: ctx.handoff.note,
          wakeConsumedAt: ctx.handoff.wakeConsumedAt,
        });
        await flushHandoff(ctx);
      }
      const completed = await transition('instance', 'completed', 'run.completed');
      if (!completed.ok) {
        ctx.node.endedAt = iso();
        await quiesceSession(ctx, 'run.failed');
        await saveLive(ctx);
        await cleanup(ctx);
        return fail(completed.code ?? 'ILLEGAL_TRANSITION', {
          from: completed.from ?? null,
          to: 'completed',
        });
      }
      await quiesceSession(ctx, 'run.completed');
      ctx.node.endedAt = iso();
      await saveLive(ctx);
      await cleanup(ctx);
      return {
        ok: true,
        instanceId,
        nodeId,
        sessionId,
        stopReason,
        snapshot: snapshotOf(state),
      };
    }

    const failure = verified.failure ?? { code: 'MISSING', ref: null, message: '产出核对未通过' };
    ctx.node.failure = { code: failure.code, ref: failure.ref ?? null, message: failure.message };
    ctx.node.endedAt = iso();
    await transition('node', 'failed', 'verification.failed', {
      code: failure.code,
      ref: failure.ref ?? null,
      message: failure.message,
    });
    await transition('instance', 'failed', 'verification.failed');
    if (ctx.handoff) ctx.handoff.note = 'verification_failed';
    await quiesceSession(ctx, 'run.failed');
    await saveLive(ctx);
    await cleanup(ctx);
    return fail(CODES.VERIFY_FAILED, { reason: failure.message });
  }

  async function finishPromptError(ctx, classified, rawMessage, rawCode) {
    const { instanceId, state } = ctx;
    const code = classified?.code ?? CODES.UNKNOWN_ERROR;
    const params = { ...(classified?.params ?? {}) };

    ctx.quiescing = true;

    if (code === CODES.HOST_ERROR || code === CODES.UNKNOWN_ERROR) {
      state.hostRaw = state.hostRaw ?? {};
      state.hostRaw.lastError = {
        code: rawCode ?? null,
        message: rawMessage ?? params.raw ?? '',
        at: iso(),
      };
      params.raw = rawMessage ?? params.raw ?? '';
    }
    if (code === CODES.PERMISSION_DENIED) {
      const step = ctx.permission?.action ?? ctx.session?.toolName ?? 'unknown-tool';
      params.step = typeof step === 'string' && step.length > 0 ? step : 'unknown-tool';
    }
    ctx.node.failure = { code, message: params.raw ?? params.step ?? code };

    const transition = makeTransitioner(ctx);
    await transition('node', 'failed', 'run.failed', { code, message: params.raw ?? params.step ?? null });
    await transition('instance', 'failed', 'run.failed');
    ctx.node.endedAt = iso();

    const rejectReason =
      code === CODES.PERMISSION_DENIED
        ? 'permission_denied'
        : code === CODES.NODE_BUSY
          ? null
          : 'target_rejected';
    if (rejectReason && ctx.tracker && ctx.handoff && ctx.handoff.state !== 'rejected') {
      const rejected = ctx.tracker.rejected({ reason: rejectReason, atMs: now() });
      if (rejected.ok) {
        applyHandoff(ctx.handoff, {
          ...ctx.tracker.snapshot(),
          edge: ctx.handoff.edge,
          defects: ctx.handoff.defects,
          note: ctx.handoff.note,
          wakeConsumedAt: ctx.handoff.wakeConsumedAt,
          artifactRefs: ctx.handoff.artifactRefs,
          revisionRequirement: ctx.handoff.revisionRequirement,
        });
        await flushHandoff(ctx);
      }
    }

    await quiesceSession(ctx, code === CODES.PERMISSION_DENIED ? 'permission.denied' : 'run.failed');
    await saveLive(ctx);
    await cleanup(ctx);
    return fail(code, params);
  }

  // ---------------------------------------------------------- 多节点收尾

  /**
   * 本轮是否真的交了产出（D-6：无产出提交的回合结束不显示“等待下游”）：
   * 判定节点看 `out/verdict.json` 是否本轮新写，其余节点看声明产物是否本轮新写。
   */
  async function hasSubmittedOutput(ctx, def) {
    const { state, node } = ctx;
    if (def?.judge === 'verdict') {
      const read = await readVerdict({ cwd: state.cwd, roundStartedAt: node.roundStartedAt, now: clock });
      return read.ok === true;
    }
    if (def?.judge === 'review') {
      // The review node only hands in `out/review.json`; the task's `产物：` line is a
      // different file and must never be mistaken for "submitted" (risk R3).
      const read = await readReview({
        cwd: state.cwd,
        workspaceDir: workspaceDirOf(state),
        expectedArtifact: expectedArtifactOf(ctx),
        roundStartedAt: node.roundStartedAt,
        now: clock,
      });
      return read.ok === true;
    }

    const productPolicy = productPolicyOf(state);
    const resolution = resolveNodeProducts(def, {
      node,
      state,
      workspaceDir: workspaceDirOf(state),
      cwd: state.cwd,
      productPolicy,
    });
    if (!resolution.ok) return false;
    if (resolution.products.length === 0) return true;

    const verified = await verifyProducts({
      cwd: state.cwd,
      baseDir: resolution.baseDir,
      products: resolution.products,
      roundStartedAt: node.roundStartedAt,
      now: clock,
    });
    return verified.ok === true;
  }

  /**
   * 多节点图里单个节点的收尾：通过 → done；判定不通过（未超上限）→ failed；
   * 其余一律升级（节点 review → escalated，实例 suspended）。
   */
  async function finishGraphNode(ctx) {
    const { state, node } = ctx;
    const runGraph = graphForState(state);
    const def = graphNode(runGraph, node.nodeId) ?? {};

    let prompted = null;
    try {
      prompted = await ctx.promptPromise;
    } catch (error) {
      prompted = { ok: false, error: { code: 'UNKNOWN_ERROR', message: String(error?.message ?? error) } };
    }
    await ctx.chain.catch(() => {});
    await Promise.allSettled(ctx.pauses);

    if (ctx.cancelled || (await isRunStopped(ctx.instanceId))) {
      await cleanup(ctx);
      return { kind: 'cancelled' };
    }

    // turn 结束：先落到“已出料”，再核对；会话显示“等待下游”。
    // 无产出提交的回合结束 → idle（D-6），由核对流程决定后续升级。
    if (await hasSubmittedOutput(ctx, def)) {
      ctx.normalizer.onOutputSubmitted(ctx.sessionId);
      if (ctx.session.state !== 'waiting_dependency') {
        const from = ctx.session.state;
        ctx.session.state = 'waiting_dependency';
        ctx.session.stateSince = iso();
        await ctx.emit({
          object: 'session',
          objectId: ctx.sessionId,
          from,
          to: 'waiting_dependency',
          result: 'applied',
          reason: 'output.submitted',
          detail: null,
        });
      }
    } else if (ctx.session.state !== 'idle') {
      const from = ctx.session.state;
      try {
        ctx.normalizer.onPromptSettled(ctx.sessionId, { stopReason: prompted?.result?.stopReason ?? null });
      } catch {
        // 归一化失败不改变落盘结论
      }
      ctx.session.state = 'idle';
      ctx.session.stateSince = iso();
      await ctx.emit({
        object: 'session',
        objectId: ctx.sessionId,
        from,
        to: 'idle',
        result: 'applied',
        reason: 'run.completed',
        detail: null,
      });
    }
    // D-3 / M-8: a gated node enters `review` **because its own output is being checked**,
    // and the reason has to be in the *same* write as `running → review` — otherwise the
    // first frame of the pause still reads a bare `待校验`. So it is set before the
    // transition (`transit()` persists on its own), not after it.
    if (node.state === 'running') {
      if (def.downstreamGate === true && Object.prototype.hasOwnProperty.call(node, 'reviewReason')) {
        node.reviewReason = 'evidence';
      }
      await makeTransitioner(ctx)('node', 'review', 'output.submitted');
    }
    await saveLive(ctx);

    await pauseFor('after_output', node.nodeId);
    if (ctx.cancelled || (await isRunStopped(ctx.instanceId))) {
      await cleanup(ctx);
      return { kind: 'cancelled' };
    }

    if (!prompted || prompted.ok !== true) {
      const message = prompted?.error?.message ?? String(prompted?.error?.code ?? '未知错误');
      state.hostRaw = state.hostRaw ?? {};
      state.hostRaw.lastError = { code: prompted?.error?.code ?? null, message, at: iso() };
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: 'execution_failed',
        reasonDetail: `${ESC_TEXT.executionPrefix}${message}`,
        defects: [],
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    const stopReason = prompted.result?.stopReason ?? null;
    ctx.session.turnId = ctx.session.turnId ?? TURN_ID;
    state.hostRaw = state.hostRaw ?? {};
    state.hostRaw.stopReason = stopReason;

    if (stopReason === 'refusal' || stopReason === 'cancelled') {
      const message = stopReason === 'refusal' ? 'stopReason: refusal' : 'stopReason: cancelled（非本核心发起）';
      state.hostRaw.lastError = { code: null, message, at: iso() };
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: 'execution_failed',
        reasonDetail: `${ESC_TEXT.executionPrefix}${message}`,
        defects: [],
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    if (def.judge === 'verdict') {
      return finishVerdictNode(ctx, def);
    }
    if (def.judge === 'review') {
      return finishReviewNode(ctx, def);
    }
    return finishArtifactNode(ctx, def);
  }

  /** 升级前先掐断迟到帧：会话进入终态守卫，宿主补发的帧不得把它翻回执行中。 */
  function guardEscalation(ctx) {
    ctx.quiescing = true;
    try {
      ctx.normalizer.onEscalated(ctx.sessionId);
    } catch {
      // 守卫失败不影响升级事务
    }
  }

  /** One escalation shape for every artifact failure (D-4 reason codes). */
  async function escalateArtifact(ctx, reasonCode, message, defects = []) {
    guardEscalation(ctx);
    const escalation = await escalateState({
      instanceId: ctx.state.instanceId,
      state: ctx.state,
      node: ctx.node,
      reasonCode,
      reasonDetail: `核对失败：${message}`,
      defects,
      emit: ctx.emit,
    });
    await markEscalatedSession(ctx);
    return { kind: escalation.ok ? 'escalated' : 'halted' };
  }

  /**
   * Artifact node finishing (D-8).
   *
   * 1. resolve this round's products through `doc-artifact` (the only entry point);
   * 2. rounds > 1: the previous version must still be there and byte-identical;
   * 3. verify the current version (exists / non-empty / newer than the dispatch);
   * 4. project the refs (the versioned-doc policy keeps only ref/bytes/sha256/verifiedAt) and append
   *    `artifactHistory`;
   * 5. a gated node does **not** become `done` yet: it waits in `review(downstream)`
   *    until the downstream node accepts (D-3); everything else keeps I1.2 behaviour.
   */
  async function finishArtifactNode(ctx, def) {
    const { state, node } = ctx;
    const productPolicy = productPolicyOf(state);
    const resolution = resolveNodeProducts(def, {
      node,
      state,
      workspaceDir: workspaceDirOf(state),
      cwd: state.cwd,
      productPolicy,
    });

    if (!resolution.ok) {
      // The engine could not even name a product for this round: report it as missing
      // rather than inventing a path (never fall back to the task line, risk R3).
      return escalateArtifact(ctx, 'artifact_missing', artifactMessage('missing', null));
    }

    const baseDir = resolution.baseDir;
    const withSha = productPolicy === 'doc-single';

    // 2. previous version integrity, before looking at the new one.
    if (def.artifactPolicy === 'versioned-doc' && node.round > 1) {
      const previousRef = docRef({
        artifactDir: def.artifactDir,
        artifactExt: def.artifactExt,
        stem: state.artifactStem,
        round: node.round - 1,
      });
      const history = Array.isArray(node.artifactHistory) ? node.artifactHistory : [];
      const record = history.find((item) => item?.ref === previousRef) ?? null;
      const previous = await verifyPrevious({
        baseDir,
        ref: previousRef,
        sha256: record?.sha256 ?? null,
        fs,
      });
      if (!previous.ok) {
        const message =
          previous.code === 'artifact_previous_modified'
            ? artifactMessage('previousModified', previous.ref)
            : artifactMessage('previousMissing', previous.ref);
        return escalateArtifact(ctx, previous.code, message);
      }
    }

    // 3. this round's version.
    const verified = await verifyProducts({
      cwd: state.cwd,
      baseDir,
      products: resolution.products,
      roundStartedAt: node.roundStartedAt,
      sha256: withSha,
      now: clock,
    });

    if (!verified.ok) {
      const reasonCode =
        verified.code === 'EMPTY'
          ? 'artifact_empty'
          : verified.code === 'STALE'
            ? 'artifact_stale'
            : 'artifact_missing';
      return escalateArtifact(ctx, reasonCode, verified.message);
    }

    // 4. projection: the versioned-doc policy never stores absolute paths (NFR-08).
    // B-01: a declared-but-empty source node (products: []) verifies to an empty
    // refs list, so the disk snapshot—and every downstream handoff built from it—
    // would carry no evidence. Re-derive the references from the task's `产物：`
    // line through the same verifier used at turn finish, then persist them via
    // the saveLive below. A doc-single graph is excluded: its versioned documents
    // live in the workspace, not next to the task (R3). The refsForEdge fallback
    // in advance.js remains the last safety net for any still-empty snapshot.
    const verifiedAt = iso();
    let refsForNode = verified.refs ?? [];
    if (refsForNode.length === 0 && productPolicy !== 'doc-single') {
      const declared = productsOfTask(state);
      if (declared.length > 0) {
        const observed = await verify({
          cwd: state.cwd,
          declared,
          observedRefs: ctx.observedRefs,
        });
        if (observed.ok) refsForNode = observed.refs;
      }
    }
    node.artifactRefs = refsForNode.map((ref) =>
      withSha
        ? { ref: ref.ref, bytes: ref.bytes, sha256: ref.sha256 ?? null, verifiedAt }
        : { ...ref, verifiedAt }
    );
    if (withSha && node.artifactRefs.length > 0) {
      node.artifactHistory = Array.isArray(node.artifactHistory) ? node.artifactHistory : [];
      for (const ref of node.artifactRefs) {
        node.artifactHistory.push({
          round: node.round,
          ref: ref.ref,
          sha256: ref.sha256 ?? null,
          bytes: ref.bytes,
          verifiedAt,
        });
      }
    }

    // 5. downstream gate: stay in `review`, hand the move to the accepted frame.
    if (def.downstreamGate === true) {
      node.reviewReason = 'downstream';
      node.endedAt = verifiedAt;
      const first = node.artifactRefs[0] ?? null;
      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'review.evidence_verified',
        detail: { ref: first?.ref ?? null, sha256: first?.sha256 ?? null },
        // 事件的 ts 复用 `endedAt` 的同一时刻：否则总线现取时间会把两者拉开 1ms，
        // AC-35 的 `endedAt = 第 2 轮 review.evidence_verified ts` 就无法逐字成立。
        ts: node.endedAt,
      });
      await consumeHandoff(ctx, 'handoff.consumed');
      await saveLive(ctx);
      await cleanup(ctx);
      return { kind: 'passed' };
    }

    await makeTransitioner(ctx)('node', 'done', 'verification.passed');
    node.endedAt = iso();
    await consumeHandoff(ctx, 'handoff.consumed');
    await idleSession(ctx, 'run.completed');
    await saveLive(ctx);
    await cleanup(ctx);
    return { kind: 'passed' };
  }

  /**
   * Review node finishing (D-7 / D-3). The review file decides:
   *   pass                      -> done (I1.2 transition reason kept)
   *   reject, under the cap     -> failed + note `等待复审`, the planner backflows next
   *   reject at the cap         -> escalate `rounds_exceeded`
   *   invalid file              -> escalate with the reader's reason code
   */
  async function finishReviewNode(ctx, def) {
    const { state, node } = ctx;
    const read = await readReview({
      cwd: state.cwd,
      workspaceDir: workspaceDirOf(state),
      expectedArtifact: expectedArtifactOf(ctx),
      roundStartedAt: node.roundStartedAt,
      now: clock,
    });

    if (!read.ok) {
      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'review.invalid',
        detail: { reasonCode: read.reasonCode, stage: read.stage, message: read.reasonDetail },
      });
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: read.reasonCode,
        reasonDetail: read.reasonDetail,
        defects: [],
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    const review = read.review;
    node.review = {
      decision: review.decision,
      defectCount: review.defectCount,
      reviewPath: review.reviewPath,
      artifact: review.artifact,
      readAt: review.readAt,
      defects: review.defects,
      revisionRequirement: review.revisionRequirement,
    };
    await ctx.emit({
      object: 'node',
      objectId: node.nodeId,
      from: null,
      to: null,
      result: 'note',
      reason: 'review.read',
      detail: {
        source: 'file',
        path: review.reviewPath,
        decision: review.decision,
        results: review.defectCount,
      },
    });

    if (review.decision === 'reject') {
      // D-6.8: a human `retry` grants one more round at this gate too.
      const limit = maxRoundsOf(graphForState(state), node.nodeId) + (node.extraRounds ?? 0);
      const exhausted = Number.isFinite(limit) && node.round >= limit;
      await consumeHandoff(ctx, 'handoff.consumed');
      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'review.rejected',
        detail: { defectCount: review.defectCount },
      });

      if (!exhausted) {
        node.note = '等待复审';
        node.endedAt = iso();
        await makeTransitioner(ctx)('node', 'failed', 'review.rejected', {
          decision: 'reject',
          defectCount: review.defectCount,
        });
        await idleSession(ctx, 'verification.failed');
        await saveLive(ctx);
        await cleanup(ctx);
        return { kind: 'verdict-fail' };
      }

      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'rounds.exceeded',
        detail: { round: node.round, maxRounds: limit },
      });
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: 'rounds_exceeded',
        reasonDetail: roundsDetail(def.title, node.round),
        defects: review.defects,
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    await ctx.emit({
      object: 'node',
      objectId: node.nodeId,
      from: null,
      to: null,
      result: 'note',
      reason: 'review.passed',
      detail: { defectCount: 0 },
    });
    await makeTransitioner(ctx)('node', 'done', 'verification.passed');
    node.endedAt = iso();
    await consumeHandoff(ctx, 'handoff.consumed');
    await idleSession(ctx, 'run.completed');
    await saveLive(ctx);
    await cleanup(ctx);
    return { kind: 'passed' };
  }

  async function finishVerdictNode(ctx, def) {
    const { state, node } = ctx;
    const read = await readVerdict({ cwd: state.cwd, roundStartedAt: node.roundStartedAt, now: clock });

    if (!read.ok) {
      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'verdict.invalid',
        detail: {
          reasonCode: read.reasonCode,
          stage: read.stage,
          message: read.reasonDetail,
        },
      });
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: read.reasonCode,
        reasonDetail: read.reasonDetail,
        defects: [],
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    const verdict = read.verdict;
    node.verdict = {
      value: verdict.value,
      defectCount: verdict.defectCount,
      verdictPath: verdict.verdictPath,
      readAt: verdict.readAt,
    };
    await ctx.emit({
      object: 'node',
      objectId: node.nodeId,
      from: null,
      to: null,
      result: 'note',
      reason: 'verdict.read',
      detail: { source: 'file', path: verdict.verdictPath, verdict: verdict.value },
    });

    if (verdict.value === 'fail') {
      // D-6.8: a human `retry` grants one more round at this gate too.
      const limit = maxRoundsOf(graphForState(state), node.nodeId) + (node.extraRounds ?? 0);
      const exhausted = Number.isFinite(limit) && node.round >= limit;
      await consumeHandoff(ctx, 'handoff.consumed');

      if (!exhausted) {
        node.note = '等待复测';
        node.endedAt = iso();
        await makeTransitioner(ctx)('node', 'failed', 'verification.failed', {
          verdict: 'fail',
          defectCount: verdict.defectCount,
        });
        await idleSession(ctx, 'verification.failed');
        await saveLive(ctx);
        await cleanup(ctx);
        return { kind: 'verdict-fail', verdict };
      }

      await ctx.emit({
        object: 'node',
        objectId: node.nodeId,
        from: null,
        to: null,
        result: 'note',
        reason: 'rounds.exceeded',
        detail: { round: node.round, maxRounds: limit },
      });
      guardEscalation(ctx);
      const escalation = await escalateState({
        instanceId: state.instanceId,
        state,
        node,
        reasonCode: 'rounds_exceeded',
        reasonDetail: roundsDetail(def.title, node.round),
        defects: verdict.defects ?? [],
        emit: ctx.emit,
      });
      await markEscalatedSession(ctx);
      return { kind: escalation.ok ? 'escalated' : 'halted' };
    }

    await makeTransitioner(ctx)('node', 'done', 'verification.passed');
    node.endedAt = iso();
    await consumeHandoff(ctx, 'handoff.consumed');
    await idleSession(ctx, 'run.completed');
    await saveLive(ctx);
    await cleanup(ctx);
    return { kind: 'passed', verdict };
  }

  async function markEscalatedSession(ctx) {
    ctx.quiescing = true;
    try {
      ctx.normalizer.onEscalated(ctx.sessionId);
    } catch {
      // 守卫失败不影响已落盘的升级
    }
    await cleanup(ctx);
  }

  async function consumeHandoff(ctx, reason) {
    if (!ctx.handoff) return;
    if (ctx.handoff.state === 'consumed') return;
    if (ctx.tracker && ctx.tracker.can('consumed') && ctx.handoff.state === 'accepted') {
      ctx.tracker.consumed({ atMs: now() });
      // M-4: the explicit rebuild must carry the I1.3 fields, otherwise `accepted ->
      // consumed` would silently drop the artifact refs of the handoff.
      applyHandoff(ctx.handoff, {
        ...ctx.tracker.snapshot(),
        edge: ctx.handoff.edge,
        defects: ctx.handoff.defects,
        note: ctx.handoff.note,
        wakeConsumedAt: ctx.handoff.wakeConsumedAt,
        artifactRefs: ctx.handoff.artifactRefs,
        revisionRequirement: ctx.handoff.revisionRequirement,
      });
      await flushHandoff(ctx);
      await saveLive(ctx);
      return;
    }
    // 迟到帧导致未 accepted 时直接收口（本轮产出已核对通过）。
    if (['created', 'delivered', 'accepted'].includes(ctx.handoff.state)) {
      const from = ctx.handoff.state;
      ctx.handoff.state = 'consumed';
      ctx.handoff.consumedAt = iso();
      await ctx.emit({
        object: 'handoff',
        objectId: ctx.handoff.handoffId,
        from,
        to: 'consumed',
        result: 'applied',
        reason,
        detail: null,
      });
      await saveLive(ctx);
    }
  }

  // ------------------------------------------------------------------ 推进

  /**
   * 读磁盘最新快照 → 规划 → 门控 → 建包 → 派发。调用方必须已持有实例锁。
   */
  async function advanceLocked(instanceId, options = {}) {
    const { onProgress = null, verdict = null } = options;
    let loaded = await store.load(instanceId);
    if (!loaded.ok) return { action: 'stop', code: loaded.code };
    let state = loaded.state;
    if (isLegacy(state)) return { action: 'stop', code: 'LEGACY_READ_ONLY' };
    arraysOf(state);
    if (state.halted === true) return { action: 'halt' };
    if (RUN_DONE.has(state.state)) return { action: 'stop' };

    const runGraph = graphForState(state);
    const fromNodeId = latestEndedNodeId(state);
    if (!fromNodeId) return { action: 'stop' };
    const outcome = classifyNodeOutcome(state, fromNodeId, verdict);
    if (outcome === 'escalated') return { action: 'stop' };
    if (outcome === 'error') {
      const node = nodeOf(state, fromNodeId);
      const escalation = await escalateState({
        instanceId,
        state,
        node,
        reasonCode: 'execution_failed',
        reasonDetail: `${ESC_TEXT.executionPrefix}${node?.failure?.message ?? ''}`,
        defects: [],
        emit: makeEmitter(instanceId, onProgress),
      });
      return { action: escalation.ok ? 'stop' : 'halt', code: escalation.code ?? null };
    }

    const plan = planAdvance({
      graph: runGraph,
      snapshot: state,
      fromNodeId,
      outcome,
      verdict,
      workspaceDir: workspaceDirOf(state),
      now: clock,
    });

    if (plan.action === 'halt') return { action: 'halt' };
    if (plan.action === 'stop') return { action: 'stop' };
    if (plan.action === 'escalate') {
      const node = nodeOf(state, plan.nodeId);
      const escalation = await escalateState({
        instanceId,
        state,
        node,
        reasonCode: plan.reason === 'rounds_exceeded' ? 'rounds_exceeded' : 'execution_failed',
        reasonDetail:
          plan.reason === 'rounds_exceeded'
            ? roundsDetail(graphNode(runGraph, plan.nodeId)?.title, plan.round)
            : `${ESC_TEXT.executionPrefix}${node?.failure?.message ?? ''}`,
        defects: verdict?.defects ?? [],
        emit: makeEmitter(instanceId, onProgress),
      });
      return { action: escalation.ok ? 'stop' : 'halt', code: escalation.code ?? null };
    }
    if (plan.action === 'complete') {
      const at = iso();
      const expected = expectedOf(state);
      state.state = 'completed';
      state.stateSince = at;
      const saved = await saveState(instanceId, state, { expectedState: expected });
      if (!saved.ok) return { action: 'reject', code: saved.code };
      const emit = makeEmitter(instanceId, onProgress);
      await emit({
        object: 'instance',
        objectId: instanceId,
        from: 'running',
        to: 'completed',
        result: 'applied',
        reason: 'run.completed',
        detail: null,
      });
      return { action: 'complete' };
    }

    // dispatch / backflow
    const emit = makeEmitter(instanceId, onProgress);
    const handoff = plan.handoffDraft;
    if (!handoff) return { action: 'stop' };

    // D-3 / B-01 (AC-08~14 / 68 / 69): every graph-driven package (edge !== null)
    // is validated BEFORE it is committed. `edge === null` single bootstraps stay
    // exempt (C-04 / D-3.2 step 1) and keep their I1.2 output byte-for-byte.
    if (handoff.edge !== null && handoff.edge !== undefined) {
      // NODE_ENV=test seam: let a test mutate the draft into a bad package;
      // WP-6's `test.handoff` RPC drives the same controller. A bad draft here
      // goes through the exact same one-CAS rejection as a production bad package.
      if (isTest && typeof handoffDraftHook === 'function') {
        await handoffDraftHook(handoff, {
          instanceId,
          graph: runGraph,
          cwd: state.cwd,
          workspaceDir: workspaceDirOf(state),
        });
      }
      const check = await validateHandoff(handoff, {
        graph: runGraph,
        workspaceDir: workspaceDirOf(state),
        cwd: state.cwd,
        sourceNode: graphNode(runGraph, handoff.edge.from),
      });
      if (!check.ok) {
        // D-3.5: ONE CAS writes the rejected package / invalid_payload,
        // escalates the source node, suspends the instance and creates the
        // handoff_invalid escalation. No handoff.created, no node.dispatch,
        // no inbox, no session, no round increment.
        await escalateState({
          instanceId,
          state,
          node: nodeOf(state, handoff.edge.from),
          reasonCode: 'handoff_invalid',
          reasonDetail: check.detail,
          defects: [],
          pendingHandoff: { ...handoff, rejectReason: 'invalid_payload' },
          emit,
        });
        return { action: 'stop' };
      }
    }

    if (handoff.edge?.kind === 'backflow') handoff.wakeConsumedAt = iso();
    const expected = expectedOf(state);
    state.handoffs.push(handoff);
    state.state = 'running';

    const saved = await saveState(instanceId, state, { expectedState: expected });
    if (!saved.ok) return { action: 'reject', code: saved.code };

    await emit({
      object: 'handoff',
      objectId: handoff.handoffId,
      from: null,
      to: 'created',
      result: 'applied',
      reason: 'handoff.created',
      detail: null,
    });
    if (handoff.edge?.kind === 'backflow') {
      await emit({
        object: 'handoff',
        objectId: handoff.handoffId,
        from: null,
        to: null,
        result: 'note',
        reason: 'backflow.constructed',
        // The document loop asks for a revision, the coding loop asks for a retest: the
        // detail key tells the renderer which indent line to print (D-5).
        detail:
          productPolicyOf(state) === 'doc-single'
            ? {
                defects: handoff.defects ?? [],
                revisionRequirement: handoff.revisionRequirement ?? DEFAULT_REVISION_REQUIREMENT,
              }
            : {
                defects: handoff.defects ?? [],
                retestRequirement: verdict?.retestRequirement ?? DEFAULT_RETEST_REQUIREMENT,
              },
      });
      await pauseFor('after_verdict', plan.nodeId);
      const fresh = await store.load(instanceId);
      if (!fresh.ok || RUN_DONE.has(fresh.state.state) || fresh.state.halted === true) {
        return { action: 'stop' };
      }
      state = arraysOf(fresh.state);
    }

    let promptText = plan.promptText;
    // I1.2 re-assembles the retest prompt here. A `doc-single` graph keeps the planner's
    // text instead: it already carries the versioned references, which this block has no
    // way to reproduce (D-8).
    if (handoff.edge?.kind === 'retest' && productPolicyOf(state) !== 'doc-single') {
      const target = nodeOf(state, plan.nodeId);
      promptText = promptFor({
        graph: runGraph,
        node: graphNode(runGraph, plan.nodeId),
        handoff,
        task: state.task ?? '',
        products: productsOfTask(state),
        defectCount: target?.verdict?.defectCount ?? 0,
        reviewPath: reviewPathOf(state),
        // AC-07: the retest prompt is a multi-node prompt too; without the
        // workspace base the A-6 "workspace context" section is dropped.
        workspaceDir: workspaceDirOf(state),
      });
    }

    const dispatched = await dispatchInState(state, plan.nodeId, {
      handoffId: handoff.handoffId,
      promptText,
      hostId: options.hostId ?? null,
      emit,
      onProgress,
    });
    if (dispatched.ok) return { action: 'dispatch', ...dispatched };
    return {
      action: dispatched.action === 'reject' ? 'reject' : 'stop',
      code: dispatched.code ?? null,
    };
  }

  async function advance(instanceId, options = {}) {
    const { onProgress = null, hostId = null, verdict = null } = options;
    return withLock(instanceId, () => advanceLocked(instanceId, { onProgress, hostId, verdict }));
  }

  // ------------------------------------------------------------- 驱动循环

  async function currentSnapshot(instanceId) {
    const status = await getStatus({ instanceId });
    if (status.ok) return status.snapshot;
    const loaded = await store.load(instanceId);
    return loaded.ok ? snapshotOf(loaded.state) : null;
  }

  /**
   * 长生命周期驱动：finishNode → advance 循环，直到整图结束、挂起、停止推进或被取消。
   * 这是**唯一** resolve runWaiters 的地方。
   */
  async function driveGraph(handle) {
    let resolveWaiter = null;
    const waited = new Promise((resolve) => {
      resolveWaiter = resolve;
    });
    runWaiters.set(handle.instanceId, { promise: waited, resolve: resolveWaiter });

    let outcome = null;
    try {
      for (;;) {
        const ctx = handle.currentCtx;
        if (!ctx) {
          outcome = { ok: true, snapshot: await currentSnapshot(handle.instanceId) };
          break;
        }

        let finished = null;
        try {
          if (isSingleGraph(handle.graph)) {
            const result = await finishSingle(ctx);
            finished = {
              kind: result.ok ? 'passed' : 'terminal',
              terminal: true,
              result,
            };
          } else {
            finished = await finishGraphNode(ctx);
          }
        } catch (error) {
          finished = await failRunUnexpected(ctx, error);
        }

        if (handle.currentCtx === ctx) handle.currentCtx = null;
        await cleanup(ctx);

        if (finished?.terminal) {
          outcome = finished.result;
          break;
        }
        if (handle.cancelled || finished?.kind === 'cancelled') {
          outcome = { ok: true, cancelled: true, snapshot: await currentSnapshot(handle.instanceId) };
          break;
        }
        if (finished?.kind === 'halted' || finished?.kind === 'escalated') {
          outcome = { ok: true, snapshot: await currentSnapshot(handle.instanceId) };
          break;
        }

        // D-7.2: a round whose own write was conflicted stops immediately; it
        // must not enter advance() (that would write again).
        if (ctx.conflicted === true) {
          outcome = await pausedTailOrConflict(handle.instanceId);
          break;
        }

        await maybeStopAfter(handle.instanceId);

        // D-7.4 step 3: re-read the disk before the next dispatch. A pause that
        // landed during the just-finished round ends the drive here: no write,
        // no escalation, no dispatch (AC-49).
        const beforeAdvance = await store.load(handle.instanceId);
        if (
          beforeAdvance.ok &&
          beforeAdvance.state.paused === true &&
          beforeAdvance.state.state === 'running' &&
          beforeAdvance.state.halted !== true
        ) {
          outcome = { ok: true, snapshot: snapshotOf(beforeAdvance.state) };
          break;
        }

        const next = await advance(handle.instanceId, {
          onProgress: ctx.onProgress,
          hostId: ctx.hostId,
          verdict: finished?.verdict ?? null,
        });
        if (next.action === 'dispatch' && next.ctx) {
          handle.currentCtx = next.ctx;
          continue;
        }

        // WP-6 tail branches (D-7.2 / D-7.4). Neither writes a snapshot,
        // escalates, nor replays a write after re-reading the disk.
        let action = next.action;
        if (action === 'reject' && next.code === 'STORE_CONFLICT') {
          // A pause write that won the dispatch CAS surfaces as a conflict with
          // `paused === true` on disk. Normalize it to the paused tail (exit 0);
          // every other conflict is surfaced verbatim to waitForRun.
          const disk = await store.load(handle.instanceId);
          const pausedOnDisk =
            disk.ok &&
            disk.state.paused === true &&
            disk.state.state === 'running' &&
            disk.state.halted !== true;
          action = pausedOnDisk ? 'paused' : 'conflict';
        }
        if (action === 'paused') {
          // `paused` was already persisted by workflow.pause. End this drive
          // WITHOUT any write, escalation or retry; hand the paused snapshot
          // to run.wait (exit 0). No `pausedAt` field exists in the contract.
          outcome = { ok: true, snapshot: await currentSnapshot(handle.instanceId) };
          break;
        }
        if (action === 'conflict') {
          // Stop the drive and pass the code through to waitForRun unchanged.
          outcome = { ok: false, code: 'STORE_CONFLICT' };
          break;
        }
        outcome = { ok: true, snapshot: await currentSnapshot(handle.instanceId) };
        break;
      }
    } finally {
      handle.finished = true;
      if (activeRuns.get(handle.instanceId) === handle) activeRuns.delete(handle.instanceId);
      resolveWaiter(outcome);
      if (runWaiters.get(handle.instanceId)?.resolve === resolveWaiter) {
        runWaiters.delete(handle.instanceId);
      }
    }
    return outcome;
  }

  async function isRunStopped(instanceId) {
    const loaded = await store.load(instanceId);
    if (!loaded.ok) return true;
    return RUN_DONE.has(loaded.state.state) || loaded.state.halted === true;
  }

  async function cleanup(ctx) {
    if (ctx.finished) return;
    ctx.finished = true;
    try {
      await ctx.chain;
    } catch {
      // 收尾链路的异常不改变已落盘结果
    }
    if (ctx.offPermission) {
      try {
        ctx.offPermission();
      } catch {
        // ignore
      }
    }
    if (ctx.adapter) await disposeAdapter(ctx.adapter);
  }

  async function failRunUnexpected(ctx, error) {
    const message = error?.message ?? String(error ?? '未知错误');
    try {
      if (!ctx.finished) {
        const transition = makeTransitioner(ctx);
        if (ctx.node && isNodeBusyState(ctx.node.state) === false && ctx.node.state === 'pending') {
          await transition('node', 'running', 'run.failed');
        }
        if (ctx.node && !['failed', 'done', 'cancelled', 'escalated'].includes(ctx.node.state)) {
          await transition('node', 'failed', 'run.failed', { code: CODES.HOST_ERROR, message });
        }
        if (ctx.state.state !== 'failed' && !RUN_DONE.has(ctx.state.state)) {
          await transition('instance', 'failed', 'run.failed');
        }
        if (ctx.node) ctx.node.endedAt = iso();
        await quiesceSession(ctx, 'run.failed');
        await saveLive(ctx);
      }
    } catch {
      // 落终态失败也不得再抛
    }
    try {
      await cleanup(ctx);
    } catch {
      // ignore
    }
    return { terminal: true, kind: 'terminal', result: fail(CODES.HOST_ERROR, { raw: message }) };
  }

  // ------------------------------------------------------------------ 发起

  async function findDirBusy(resolvedCwd, excludeId, multiOnly) {
    const listed = await store.list();
    const target = path.resolve(resolvedCwd);
    for (const item of listed?.items ?? []) {
      if (!item?.readable) continue;
      if (item.instanceId === excludeId) continue;
      if (TERMINAL.has(item.state)) continue;
      if (isLegacy({ schemaVersion: item.schemaVersion })) continue;
      if (multiOnly) {
        const itemGraph = resolveTemplate(item.template);
        if (!itemGraph || isSingleGraph(itemGraph)) continue;
      }
      if (typeof item.cwd !== 'string') continue;
      if (path.resolve(item.cwd).toLowerCase() === target.toLowerCase()) return item.instanceId;
    }
    return null;
  }

  async function claimSingle({ existing, instanceId, cwd, task, hostId, onProgress, runGraph = graph }) {
    const fresh = !existing;
    const state = fresh ? newState({ instanceId, cwd, task, runGraph }) : arraysOf(existing);
    const prevState = fresh ? null : state.state;
    const prevRev = fresh ? null : state.rev;

    state.schemaVersion = 2;
    state.cwd = cwd;
    state.task = task;
    state.template = runGraph.id ?? null;
    state.coreGeneration = generation;
    state.counters = state.counters ?? { eventSeq: 0, runCount: 0, dispatchCount: 0 };
    state.counters.runCount = fresh ? 1 : (state.counters.runCount ?? 0) + 1;
    state.counters.dispatchCount = Number.isInteger(state.counters.dispatchCount)
      ? state.counters.dispatchCount
      : 0;

    const at = iso();
    const node = state.nodes[0];
    state.state = 'running';
    state.stateSince = at;
    state.halted = false;
    state.sessions = [];
    state.handoffs = [];
    state.escalations = [];
    node.state = 'running';
    node.stateSince = at;
    node.round = 1;
    node.roundStartedAt = at;
    node.startedAt = at;
    node.endedAt = null;
    node.failure = null;
    node.note = null;
    node.verdict = null;
    node.artifactRefs = [];
    node.sessionId = null;
    state.counters.dispatchCount += 1;

    const emit = makeEmitter(instanceId, onProgress);

    if (fresh) {
      // §2.9 / AC-44: build the workspace (shared/ + status.md) BEFORE any
      // session or state.json exists. A single-node graph never gets stage/.
      const workspace = await prepareWorkspace(instanceId, runGraph, state);
      if (!workspace.ok) {
        await discardInstance(instanceId);
        return { ok: false, result: fail('WORKSPACE_INIT_FAILED', { cause: workspace.cause }) };
      }
    }

    let adapter = null;
    let sessionId = null;
    try {
      const created = await createAdapter(hostId, cwd);
      adapter = created.adapter;
      sessionId = created.sessionId;
    } catch (error) {
      if (adapter) await disposeAdapter(adapter);
      return { ok: false, result: preflightFailure(error) };
    }

    const session = buildSession({ sessionId, hostId, nodeId: node.nodeId, round: 1 });
    state.sessions.push(session);
    node.sessionId = sessionId;

    let saved;
    if (fresh) {
      saved = await saveState(instanceId, state);
    } else {
      saved = await saveState(instanceId, state, {
        expectedState: { state: prevState, halted: Boolean(existing?.halted), rev: prevRev ?? 0 },
      });
    }
    if (!saved.ok) {
      await disposeAdapter(adapter);
      return { ok: false, result: fail(saved.code, saved.params ?? {}) };
    }

    if (prevState !== 'running') {
      await emit({
        object: 'instance',
        objectId: instanceId,
        from: prevState ?? 'created',
        to: 'running',
        result: 'applied',
        reason: 'run.started',
        detail: null,
      });
    }
    await emit({
      object: 'node',
      objectId: node.nodeId,
      from: 'pending',
      to: 'running',
      result: 'applied',
      reason: 'run.started',
      detail: null,
    });

    const ctx = makeCtx({
      instanceId,
      state,
      node,
      session,
      adapter,
      hostId,
      handoffId: null,
      emit,
      onProgress,
    });
    ctx.graph = graph;
    ctx.hostId = hostId ?? null;

    ctx.normalizer.onPromptSent(ctx.sessionId, TURN_ID);
    session.turnId = TURN_ID;
    ctx.permissionPolicy = await policyFor(hostId);

    const handle = {
      instanceId,
      graph,
      currentCtx: ctx,
      cancelled: false,
      finished: false,
    };

    // 交接包先构造并投递就绪，再发 prompt —— 保证 turn 的首帧到达时 tracker 已是 delivered。
    const handoffId = 'HO-001';
    const tracker = createHandoffTracker({
      handoffId,
      startedAt: now(),
      clock,
      emit: (ev) => ctx.handoffEmits.push(ev),
    });
    tracker.created({ atMs: now() });
    const handoff = {
      handoffId,
      edge: null,
      state: 'created',
      createdAt: iso(),
      deliveredAt: null,
      acceptedAt: null,
      consumedAt: null,
      rejectedAt: null,
      rejectReason: null,
      wakeConsumedAt: null,
      acceptedSignal: null,
      ambiguityWindowMs: null,
      defects: [],
      note: null,
    };
    applyHandoff(handoff, { ...tracker.snapshot(), edge: null, defects: [] });
    state.handoffs.push(handoff);
    ctx.tracker = tracker;
    ctx.handoff = handoff;
    ctx.handoffId = handoffId;
    await flushHandoff(ctx);
    await saveLive(ctx);

    await subscribe(ctx);
    activeRuns.set(instanceId, handle);

    const text = promptFor({
      graph,
      node: graphNode(graph, node.nodeId),
      task,
      products: [],
      reviewPath: reviewPathOf(state),
      // A-6 / AC-07: every graph=true production call site carries a non-empty
      // workspaceDir; a single-node graph has one node, so no section is appended,
      // but the argument must still be present (prompt-context.test.js 机检).
      workspaceDir: workspaceDirOf(state),
    });
    const promptPromise = Promise.resolve().then(() =>
      adapter.prompt(ctx.sessionId, [{ type: 'text', text }]),
    );
    promptPromise.catch(() => {});
    ctx.promptPromise = promptPromise;

    tracker.delivered({ atMs: now() });
    applyHandoff(handoff, { ...tracker.snapshot(), edge: null, defects: [], note: null, wakeConsumedAt: null });
    await flushHandoff(ctx);
    await saveLive(ctx);

    return { ok: true, handle };
  }

  async function claimGraph({ existing, instanceId, cwd, task, hostId, onProgress, runGraph: chosenGraph = graph }) {
    const fresh = !existing;
    const runGraph = existing ? graphForState(existing) : chosenGraph;
    const state = fresh ? newState({ instanceId, cwd, task, runGraph }) : arraysOf(existing);
    const prevState = fresh ? 'created' : state.state;

    state.schemaVersion = 2;
    state.cwd = cwd;
    state.task = task;
    state.template = runGraph.id ?? state.template ?? null;
    state.coreGeneration = generation;
    state.counters.runCount = fresh ? 1 : (state.counters.runCount ?? 0) + 1;

    const emit = makeEmitter(instanceId, onProgress);

    if (fresh && runGraph.productPolicy === 'doc-single') {
      // D-8: the stem is computed once from the task's `产物：` line and only read later.
      const declared = parseProductDeclaration(task);
      state.artifactStem = declared.ok ? declared.stem : null;
    }
    if (fresh) {
      // §2.9 / AC-44: EVERY graph builds shared/, status.md, multi-node stage/
      // and doc-single artifacts/ BEFORE state.json and any session exist.
      // Passing graph/state lets the upstream builder lay out stage/ and render
      // the initial status.md; a failure leaves no half-created instance behind.
      const workspace = await prepareWorkspace(instanceId, runGraph, state);
      if (!workspace.ok) {
        await discardInstance(instanceId);
        return { ok: false, result: fail('WORKSPACE_INIT_FAILED', { cause: workspace.cause }) };
      }
    }

    if (fresh) {
      // M-3：先落盘“已创建 + 两节点 + 模板 + rev”。
      const saved = await saveState(instanceId, state);
      if (!saved.ok) return { ok: false, result: fail(saved.code, saved.params ?? {}) };
    }

    const at = iso();
    const stateBefore = state.state;
    const revBefore = state.rev;
    state.state = 'running';
    state.stateSince = at;
    const saved = await saveState(instanceId, state, {
      expectedState: { state: stateBefore, halted: Boolean(state.halted), rev: Number.isInteger(revBefore) ? revBefore : 0 },
    });
    if (!saved.ok) return { ok: false, result: fail(saved.code, saved.params ?? {}) };

    if (prevState !== 'running') {
      await emit({
        object: 'instance',
        objectId: instanceId,
        from: prevState,
        to: 'running',
        result: 'applied',
        reason: 'run.started',
        detail: null,
      });
    }

    const entry = firstNode(runGraph);
    const handle = {
      instanceId,
      graph: runGraph,
      currentCtx: null,
      cancelled: false,
      finished: false,
    };
    activeRuns.set(instanceId, handle);

    const dispatched = await dispatchInState(state, entry.id ?? entry.nodeId, {
      handoffId: null,
      hostId,
      emit,
      onProgress,
    });
    if (!dispatched.ok) {
      if (activeRuns.get(instanceId) === handle) activeRuns.delete(instanceId);
      // 首派失败已经是「升级 + 挂起」的终局（AC-42），CLI 仍要能按实例号继续收尾，
      // 所以这里把 instanceId 一并回给调用方；会话没建起来，`sessionId` 为 null。
      return {
        ok: false,
        handle,
        stopped: true,
        result: {
          ok: true,
          instanceId,
          nodeId: entry.id ?? entry.nodeId,
          sessionId: null,
          snapshot: await currentSnapshot(instanceId),
        },
      };
    }
    handle.currentCtx = dispatched.ctx;
    dispatched.ctx.hostId = hostId ?? null;
    return { ok: true, handle };
  }

  async function claimRun({ existing, instanceId, cwd, task, hostId, onProgress, multi, runGraph }) {
    return multi
      ? claimGraph({ existing, instanceId, cwd, task, hostId, onProgress, runGraph })
      : claimSingle({ existing, instanceId, cwd, task, hostId, onProgress, runGraph });
  }

  /**
   * 发起一次任务。
   *
   * `earlyReturn=false`：单节点图返回 I1.1 的终态结果；多节点图返回终态快照。
   * `earlyReturn=true`：入口节点会话建立 + 投递完成后立即返回。
   */
  async function startRun({
    cwd,
    task,
    instanceId = null,
    hostId = null,
    template = null,
    onProgress,
    earlyReturn = false,
  } = {}) {
    const selected = template ? resolveTemplate(template) : graph;
    if (template && !selected) {
      return fail('TEMPLATE_UNKNOWN', { name: String(template) });
    }
    const runGraph = selected ?? graph;
    const multi = !isSingleGraph(runGraph);

    if (typeof task !== 'string' || task.trim().length === 0) {
      if (multi) return fail('TASK_EMPTY', {});
      return fail(CODES.UNKNOWN_ERROR, { raw: '任务描述为空' });
    }
    if (runGraph.productPolicy === 'doc-single') {
      // D-8: exactly one full-width `产物：<name>.md` line; the token is echoed verbatim.
      const declared = parseProductDeclaration(task);
      if (!declared.ok) {
        return declared.name === null ? fail(declared.code, {}) : fail(declared.code, { name: declared.name });
      }
    } else if (multi && !extractProductLines(task).ok) {
      return fail('PRODUCT_LINE_MISSING', {});
    }
    if (typeof cwd !== 'string' || cwd.length === 0) {
      return fail(CODES.CWD_NOT_WRITABLE, { path: String(cwd ?? '') });
    }

    let resolvedCwd;
    try {
      resolvedCwd = await fs.realpath(cwd);
    } catch {
      return fail(CODES.CWD_NOT_WRITABLE, { path: cwd });
    }
    try {
      await fs.access(resolvedCwd, fs.constants.W_OK);
    } catch {
      return fail(CODES.CWD_NOT_WRITABLE, { path: resolvedCwd });
    }

    // AC-31 / BLK-C1: reject a live multi-node instance before taking the directory lock.
    // The first dispatch (even `session/new`) runs while that lock is still held; queuing
    // behind it would turn a clean business rejection into a 60s IPC_TIMEOUT.
    // The same scan is repeated inside the lock (see below) to close the race with a
    // caller that registers its instance between this scan and the lock acquisition.
    // `single` keeps I1.1's node-level NODE_BUSY behaviour untouched.
    if (multi) {
      if (instanceId && activeRuns.has(instanceId)) return fail('INSTANCE_RUNNING', {});
      const busyBefore = await findDirBusy(resolvedCwd, instanceId ?? null, multi);
      if (busyBefore) return fail('DIR_BUSY', { instanceId: busyBefore });
    }

    const dirKey = `@dir:${resolvedCwd.toLowerCase()}`;
    let allocatedId = instanceId;
    let claimed;
    try {
      claimed = await withLock(dirKey, async () => {
        let existing = null;
        if (instanceId) {
          if (activeRuns.has(instanceId)) return fail(CODES.NODE_BUSY, {});
          const loaded = await store.load(instanceId);
          if (loaded.ok) {
            existing = loaded.state;
            if (isLegacy(existing)) return fail('LEGACY_READ_ONLY', {});
            if (!multi) {
              const node = existing.nodes?.[0] ?? existing.node;
              if (node && isNodeBusyState(node.state)) return fail(CODES.NODE_BUSY, {});
            }
            if (existing.state === 'running') return fail('INSTANCE_RUNNING', {});
            if (existing.state === 'suspended') return fail('INSTANCE_SUSPENDED', {});
            if (TERMINAL.has(existing.state)) {
              return fail(CODES.INSTANCE_TERMINAL, { state: existing.state });
            }
            const busy = await findDirBusy(resolvedCwd, instanceId, multi);
            if (busy) return fail('DIR_BUSY', { instanceId: busy });
          } else if (loaded.code === 'STATE_CORRUPT') {
            return { ok: false, code: 'STATE_CORRUPT', backupPath: loaded.backupPath, params: loaded.params };
          } else if (loaded.code !== 'NOT_FOUND') {
            return fail(loaded.code, loaded.params ?? {});
          }
        } else if (multi) {
          const busy = await findDirBusy(resolvedCwd, null, true);
          if (busy) return fail('DIR_BUSY', { instanceId: busy });
        }

        allocatedId = instanceId ?? (await allocateInstanceId());
        if (!instanceId) reserved.add(allocatedId);
        return withLock(allocatedId, () =>
          claimRun({
            existing,
            instanceId: allocatedId,
            cwd: resolvedCwd,
            task,
            hostId,
            onProgress,
            multi,
            runGraph,
          }),
        );
      });

      if (!claimed.ok) return claimed.result ?? claimed;
      if (earlyReturn) {
        driveGraph(claimed.handle).catch(() => {});
        const ctx = claimed.handle.currentCtx;
        return {
          ok: true,
          instanceId: allocatedId,
          nodeId: ctx?.nodeId ?? null,
          sessionId: ctx?.sessionId ?? null,
        };
      }
      return driveGraph(claimed.handle);
    } finally {
      if (!instanceId && allocatedId) reserved.delete(allocatedId);
    }
  }

  // ------------------------------------------------------------------ 查询

  async function waitForRun({ instanceId, timeoutMs = 120_000 } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_RUNNING', { instanceId: instanceId ?? null });
    }
    const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000;
    const waiter = runWaiters.get(instanceId);

    if (!waiter) {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) return fail('NOT_RUNNING', { instanceId });
      if (!RUN_DONE.has(loaded.state.state) && loaded.state.halted !== true) {
        return fail('NOT_RUNNING', { instanceId });
      }
      return { ok: true, snapshot: snapshotOf(loaded.state) };
    }

    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(WAIT_TIMEOUT), limit);
      timer.unref?.();
    });
    const outcome = await Promise.race([waiter.promise, timeout]);
    if (timer) clearTimeout(timer);

    if (outcome === WAIT_TIMEOUT) return fail('WAIT_TIMEOUT', { instanceId, timeoutMs: limit });

    // D-7.2 / §4.9: ONLY a conflicted run handle surfaces its code verbatim.
    // Every other terminal result (HOST_ERROR / VERIFY_FAILED / ...) must still
    // fall through to getStatus and return ok:true with the final snapshot —
    // that is the pre-WP-4 contract wp7:140 relies on. A broad `ok===false`
    // passthrough would turn a normal failed run into a waitForRun error.
    if (outcome && outcome.ok === false && outcome.code === 'STORE_CONFLICT') {
      return { ok: false, code: outcome.code };
    }

    const status = await getStatus({ instanceId });
    if (status.ok) return { ok: true, snapshot: status.snapshot };
    return { ok: true, snapshot: outcome?.snapshot ?? null };
  }

  async function cancel({ instanceId } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_FOUND', { instanceId: instanceId ?? null });
    }
    const live = activeRuns.get(instanceId);
    if (live && !live.finished) return cancelLive(live);

    return withLock(instanceId, async () => {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) {
        if (loaded.code === 'STATE_CORRUPT') {
          return { ok: false, code: 'STATE_CORRUPT', backupPath: loaded.backupPath, params: loaded.params };
        }
        return fail(loaded.code === 'NOT_FOUND' ? 'NOT_FOUND' : loaded.code, loaded.params ?? {});
      }
      if (isLegacy(loaded.state)) return fail('LEGACY_READ_ONLY', {});
      if (TERMINAL.has(loaded.state.state)) {
        return fail(CODES.CANCEL_NOT_NEEDED, { state: loaded.state.state });
      }
      const emit = makeEmitter(instanceId, null);
      return applyCancel(instanceId, loaded.state, emit, null);
    });
  }

  async function cancelLive(handle) {
    handle.cancelled = true;
    const ctx = handle.currentCtx;
    if (ctx) {
      ctx.cancelled = true;
      ctx.quiescing = true;
      if (ctx.permission && typeof ctx.permission.respond === 'function') {
        try {
          ctx.permission.respond({ outcome: { outcome: 'cancelled' } });
        } catch {
          // 应答失败不阻塞取消
        }
        ctx.permission = null;
      }
      if (ctx.adapter && ctx.sessionId) {
        try {
          await Promise.race([ctx.adapter.cancel(ctx.sessionId), delay(CANCEL_TIMEOUT_MS)]);
        } catch {
          // 取消失败不阻塞终态落地
        }
      }
      await ctx.chain.catch(() => {});
    }

    // 不能走 withLock：驱动循环可能在暂停点/推进中持锁，取消必须能立刻落地。
    // applyCancel 自身带 CAS 重试，冲突时按磁盘最新快照重放。
    const loaded = await store.load(handle.instanceId);
    if (!loaded.ok) {
      return fail(loaded.code ?? 'NOT_FOUND', loaded.params ?? {});
    }
    if (isLegacy(loaded.state)) return fail('LEGACY_READ_ONLY', {});
    if (TERMINAL.has(loaded.state.state)) {
      return fail(CODES.INSTANCE_TERMINAL, { state: loaded.state.state });
    }
    const emit = ctx?.emit ?? makeEmitter(handle.instanceId, null);
    return applyCancel(handle.instanceId, loaded.state, emit, ctx, handle);
  }

  /**
   * 取消：遍历四张数组，内存改完后**一次 CAS** 落盘，再逐条 emit。
   */
  async function applyCancel(instanceId, state, emit, ctx, handle = null) {
    // AC-61: release any retry parked at the injected delivery gate BEFORE the
    // CAS, so no late prompt can race with the cancelled terminal write.
    if (deliveryHold && typeof deliveryHold.cancel === 'function') {
      try { deliveryHold.cancel(); } catch { /* best effort */ }
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const disk = attempt === 0 ? { ok: true, state } : await store.load(instanceId);
      if (!disk.ok) return fail(disk.code ?? 'NOT_FOUND', disk.params ?? {});
      const work = disk.state;
      if (isLegacy(work)) return fail('LEGACY_READ_ONLY', {});
      arraysOf(work);
      const expected = expectedOf(work);

      const at = iso();
      const events = [];
      const cancelledNodes = [];
      const cancelledSessions = [];
      const cancelledHandoffs = [];
      const cancelledEscalations = [];

      for (const session of work.sessions) {
        if (session.state === 'idle') {
          cancelledSessions.push(session);
          continue;
        }
        const from = session.state;
        try {
          if (ctx?.normalizer && ctx.sessionId === session.sessionId) {
            ctx.normalizer.onCancelled(session.sessionId);
          }
        } catch {
          // ignore
        }
        session.state = 'idle';
        session.stateSince = at;
        session.toolName = null;
        session.pendingPermission = null;
        session.quarantined = true;
        events.push({
          object: 'session',
          objectId: session.sessionId,
          from,
          to: 'idle',
          result: 'applied',
          reason: 'run.cancelled',
          detail: null,
        });
        cancelledSessions.push(session);
      }

      for (const node of work.nodes) {
        if (CANCEL_NODE.has(node.state)) {
          const from = node.state;
          node.state = 'cancelled';
          node.stateSince = at;
          if (node.startedAt) node.endedAt = at;
          // D-6: `reviewReason` only lives while the node is in `review`.
          if (Object.prototype.hasOwnProperty.call(node, 'reviewReason')) node.reviewReason = null;
          events.push({
            object: 'node',
            objectId: node.nodeId,
            from,
            to: 'cancelled',
            result: 'applied',
            reason: 'run.cancelled',
            detail: null,
          });
        }
        cancelledNodes.push(node);
      }

      for (const handoff of work.handoffs) {
        if (CANCEL_HANDOFF.has(handoff.state)) {
          const from = handoff.state;
          handoff.state = 'rejected';
          handoff.rejectReason = 'withdrawn';
          handoff.rejectedAt = at;
          events.push({
            object: 'handoff',
            objectId: handoff.handoffId,
            from,
            to: 'rejected',
            result: 'applied',
            reason: 'handoff.rejected',
            detail: { reason: 'withdrawn' },
          });
        }
        cancelledHandoffs.push(handoff);
      }

      for (const escalation of work.escalations) {
        if (escalation.state === 'pending') {
          escalation.state = 'voided';
          escalation.voidedAt = at;
          events.push({
            object: 'escalation',
            objectId: escalation.escalationId,
            from: 'pending',
            to: 'voided',
            result: 'applied',
            reason: 'escalation.voided',
            detail: { escalationId: escalation.escalationId },
          });
        }
        cancelledEscalations.push(escalation);
      }

      // D-5.8 / AC-35 / AC-60: cancel voids every pending approval and clears
      // the pause flag in the SAME CAS as the rest of the cancellation.
      const withdrawnApprovals = approvals.withdrawPending(work.approvals, at);
      for (const approval of withdrawnApprovals) {
        events.push({
          object: 'approval',
          objectId: approval.approvalId,
          from: 'pending',
          to: 'withdrawn',
          result: 'applied',
          reason: 'approval.withdrawn',
          detail: { approvalId: approval.approvalId },
        });
      }
      work.paused = false;

      if (work.state !== 'cancelled') {
        const from = work.state;
        work.state = 'cancelled';
        work.stateSince = at;
        events.push({
          object: 'instance',
          objectId: instanceId,
          from,
          to: 'cancelled',
          result: 'applied',
          reason: 'run.cancelled',
          detail: null,
        });
      }

      const saved = await saveState(instanceId, work, { expectedState: expected });
      if (!saved.ok) {
        if (saved.code === 'STORE_CONFLICT') continue;
        return fail(saved.code, saved.params ?? {});
      }

      for (const event of events) await emit(event);
      if (ctx) {
        ctx.state = work;
        ctx.finished = true;
        await cleanup(ctx);
      }
      if (handle) {
        handle.finished = true;
        if (activeRuns.get(instanceId) === handle) activeRuns.delete(instanceId);
      }

      return {
        ok: true,
        nodes: cancelledNodes,
        sessions: cancelledSessions,
        handoffs: cancelledHandoffs,
        escalations: cancelledEscalations,
      };
    }

    await emit({
      object: 'instance',
      objectId: instanceId,
      from: null,
      to: null,
      result: 'rejected',
      reason: 'store.conflict',
      detail: { expected: 'cancelled', actual: 'concurrent' },
    });
    return fail('STORE_CONFLICT', {});
  }

  function snapshotOf(state) {
    const at = now();
    const since = Date.parse(state?.stateSince ?? state?.createdAt ?? '') || at;
    const snapshot = { ...state };
    snapshot.elapsedMs = Math.max(0, at - since);

    const session = latestSession(state) ?? state?.session ?? null;
    if (session) {
      const last = Date.parse(session.lastEventAt ?? session.stateSince ?? '') || at;
      snapshot.sessionIdleMs = Math.max(0, at - last);
      snapshot.sessionStalled =
        (session.state === 'thinking' || session.state === 'tool_running') &&
        snapshot.sessionIdleMs > STALL_MS;
    } else {
      snapshot.sessionIdleMs = null;
      snapshot.sessionStalled = false;
    }
    snapshot.session = session;

    const handoff = latestHandoff(state) ?? state?.handoff ?? null;
    snapshot.handoffWaitMs =
      handoff && handoff.state === 'delivered' && handoff.deliveredAt
        ? Math.max(0, at - (Date.parse(handoff.deliveredAt) || at))
        : null;

    const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
    snapshot.node = nodes[0] ?? state?.node ?? null;
    // A-2: the "interrupted at" line must name the node that is actually stuck. Derived
    // read-only field (never written to state.json); older snapshots lack it and fall back
    // to `snapshot.node` in the renderer.
    const stuck = nodes.find((item) => item?.state === 'running' || item?.state === 'review') ?? null;
    snapshot.interruptedNodeId = stuck?.nodeId ?? null;
    snapshot.productPolicy = graphForState(state)?.productPolicy ?? 'declared';
    snapshot.handoff = handoff;
    snapshot.template = state?.template ?? null;
    snapshot.cwd = state?.cwd ?? null;
    // 停止推进的原因必须随快照透出（渲染层读 haltCause）。
    snapshot.haltCause = state?.haltCause ?? null;
    snapshot.pendingEscalations = (state?.escalations ?? []).filter((entry) => entry.state === 'pending')
      .length;
    // §4.9 WP-4 owns only the `paused` field here; approvals / pendingApprovals
    // are frozen as field names and left to WP-6.
    snapshot.paused = Boolean(state?.paused);
    // WP-6: appended AFTER every frozen field, so the existing field order is
    // unchanged. Old snapshots project to [] / 0 (D-9.1 / M-10).
    snapshot.approvals = Array.isArray(state?.approvals) ? state.approvals : [];
    snapshot.pendingApprovals = snapshot.approvals.filter(
      (entry) => entry?.state === 'pending',
    ).length;
    return snapshot;
  }

  async function getStatus({ instanceId } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_FOUND', { instanceId: instanceId ?? null });
    }
    const loaded = await store.load(instanceId);
    if (!loaded.ok) {
      if (loaded.code === 'STATE_CORRUPT') {
        return { ok: false, code: 'STATE_CORRUPT', backupPath: loaded.backupPath, params: loaded.params };
      }
      if (loaded.code === 'NOT_FOUND') return fail('NOT_FOUND', { instanceId });
      return fail(loaded.code, loaded.params ?? {});
    }
    const live = activeRuns.get(instanceId);
    const liveState = live?.currentCtx?.state;
    return { ok: true, snapshot: snapshotOf(liveState ?? loaded.state) };
  }

  function listInstances() {
    return store.list();
  }

  // ------------------------------------------------------------------ 对账

  async function reconcileOnBoot({ generation: current } = {}) {
    const currentGeneration = current ?? generation;
    const listed = await store.list();
    const interrupted = [];
    for (const item of listed?.items ?? []) {
      if (!item?.readable) continue;
      if (Number.isInteger(item.schemaVersion) && item.schemaVersion < 2) continue;
      if (item.state !== 'created' && item.state !== 'running') continue;
      const loaded = await store.load(item.instanceId);
      if (!loaded.ok) continue;
      if (isLegacy(loaded.state)) continue;
      if (CORE_IMMUTABLE.has(loaded.state.state)) continue;
      if (loaded.state.coreGeneration === currentGeneration) continue;
      await markInterrupted(loaded.state, 'core.gone');
      interrupted.push(item.instanceId);
    }
    return { ok: true, interrupted };
  }

  async function interruptAll({ reason = 'core.stop' } = {}) {
    const listed = await store.list();
    const interrupted = [];
    for (const item of listed?.items ?? []) {
      if (!item?.readable) continue;
      if (Number.isInteger(item.schemaVersion) && item.schemaVersion < 2) continue;
      if (CORE_IMMUTABLE.has(item.state)) continue;
      const loaded = await store.load(item.instanceId);
      if (!loaded.ok) continue;
      if (isLegacy(loaded.state)) continue;
      await markInterrupted(loaded.state, reason);
      interrupted.push(item.instanceId);
    }
    return { ok: true, interrupted };
  }

  async function markInterrupted(state, reason) {
    arraysOf(state);
    const emit = makeEmitter(state.instanceId, null);
    const activeNode = state.nodes.find((node) => node.state === 'running' || node.state === 'review')
      ?? state.nodes[0]
      ?? null;
    const activeSession = latestSession(state);
    const note = `停在节点 ${activeNode?.state ?? '-'} / 会话 ${activeSession?.state ?? '-'}`;

    if (state.state !== 'running' && state.state !== 'created') {
      return { ok: false, code: 'ILLEGAL_TRANSITION', from: state.state, to: 'interrupted' };
    }
    if (activeNode) {
      activeNode.note = `stopped at node ${activeNode.state ?? '-'} / session ${activeSession?.state ?? '-'}`;
    }
    for (const handoff of state.handoffs) {
      if (handoff && (handoff.state === 'created' || handoff.state === 'delivered' || handoff.state === 'accepted')) {
        handoff.note = `stopped at handoff ${handoff.state}`;
      }
    }

    if (state.state === 'created') {
      await transit(state.instanceId, 'instance', 'running', {
        emit,
        state,
        reason,
        detail: { note },
      });
    }
    return transit(state.instanceId, 'instance', 'interrupted', {
      emit,
      state,
      reason,
      detail: { note },
    });
  }

  // ---------------------------------------------------------------- 测试接缝

  function parsePauseSpec(raw) {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    const [kind, nodeId] = raw.split(':');
    if (!['after_accepted', 'after_output', 'after_verdict'].includes(kind)) return null;
    return { kind, nodeId: nodeId || null };
  }

  async function exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function pauseFor(kind, nodeId) {
    if (!isTest || !pauseSpec) return;
    if (pauseSpec.kind !== kind) return;
    if (pauseSpec.nodeId && pauseSpec.nodeId !== nodeId) return;
    const mockDir = path.join(store.root, '.mock');
    const paused = path.join(mockDir, 'paused');
    const release = path.join(mockDir, 'release');
    if (await exists(release)) return;
    await fs.mkdir(mockDir, { recursive: true });
    await fs.writeFile(paused, iso(), 'utf8');
    while (!(await exists(release))) {
      await pollSleep(PAUSE_POLL_MS);
    }
  }

  async function maybeStopAfter(instanceId) {
    if (!isTest || stopAfterStep === null || stopAfterFired) return;
    const loaded = await store.load(instanceId);
    if (!loaded.ok) return;
    const count = Number.isInteger(loaded.state.counters?.dispatchCount)
      ? loaded.state.counters.dispatchCount
      : 0;
    if (count < stopAfterStep) return;
    const mockDir = path.join(store.root, '.mock');
    const release = path.join(mockDir, 'release');
    if (await exists(release)) {
      stopAfterFired = true;
      return;
    }
    await fs.mkdir(mockDir, { recursive: true });
    await fs.writeFile(path.join(mockDir, `stopped-after-${stopAfterStep}`), iso(), 'utf8');
    stopAfterFired = true;
    while (!(await exists(release))) {
      await pollSleep(PAUSE_POLL_MS);
    }
  }

  async function seamDispatch(instanceId, nodeId, options = {}) {
    // AC-32: answer NODE_BUSY without queuing behind the advance lock, which may
    // be held while the host creates a session. Reads are lock-free and atomic.
    const preloaded = await store.load(instanceId);
    if (preloaded.ok) {
      const preNode = nodeOf(arraysOf(preloaded.state), nodeId);
      if (preNode && isNodeBusyState(preNode.state)) return fail(CODES.NODE_BUSY, {});
    }
    return withLock(instanceId, async () => {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) return fail(loaded.code ?? 'NOT_FOUND', loaded.params ?? {});
      const state = arraysOf(loaded.state);
      if (isLegacy(state)) return fail('LEGACY_READ_ONLY', {});
      const node = nodeOf(state, nodeId);
      if (!node) return fail('UNKNOWN_STATE', { nodeId });
      if (isNodeBusyState(node.state)) return fail(CODES.NODE_BUSY, {});

      const runGraph = graphForState(state);
      const emit = makeEmitter(instanceId, options.onProgress ?? null);

      let handoff = null;
      if (node.state === 'done' || node.state === 'failed') {
        const kind = node.state === 'failed' ? 'retest' : 'backflow';
        const gate = checkWakeGate({ graph: runGraph, state, edge: { to: nodeId, kind } });
        if (!gate.ok) {
          await emit({
            object: 'node',
            objectId: nodeId,
            from: null,
            to: null,
            result: 'rejected',
            reason: 'wake.rejected',
            detail: { code: gate.code },
          });
          return { ok: false, code: 'WAKE_REJECTED', detail: { code: gate.code } };
        }
        handoff = (state.handoffs ?? []).find((item) => item.handoffId === gate.wakeHandoffId) ?? null;
        if (handoff && kind === 'backflow') handoff.wakeConsumedAt = iso();
      } else if (!CANCEL_NODE.has(node.state)) {
        return fail('NODE_BUSY', {});
      }

      const dispatched = await dispatchInState(state, nodeId, {
        handoffId: handoff?.handoffId ?? null,
        hostId: options.hostId ?? null,
        emit,
        onProgress: options.onProgress ?? null,
      });
      if (!dispatched.ok) {
        return { ok: false, code: dispatched.code ?? 'NODE_BUSY', detail: dispatched.code ?? null };
      }
      return {
        ok: true,
        instanceId,
        nodeId,
        round: dispatched.round,
        sessionId: dispatched.sessionId,
      };
    });
  }

  async function escalateOnce(instanceId, nodeId, options = {}) {
    // D-10 / G10: the test seam may request a specific escalation reason and
    // seed artifactRefs on the escalated node (AC-24 middle-node pass).
    const reasonCode = typeof options.reasonCode === 'string' && options.reasonCode.length > 0
      ? options.reasonCode
      : 'execution_failed';
    const artifactRefs = Array.isArray(options.artifactRefs) ? options.artifactRefs : null;
    return withLock(instanceId, async () => {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) return fail(loaded.code ?? 'NOT_FOUND', loaded.params ?? {});
      const state = arraysOf(loaded.state);
      if (isLegacy(state)) return fail('LEGACY_READ_ONLY', {});
      const node = nodeOf(state, nodeId);
      if (!node) return fail('UNKNOWN_STATE', { nodeId });

      const round = Number.isInteger(node.round) ? node.round : 1;
      const existing = findPending(state.escalations, { nodeId, round });
      if (existing) {
        return { ok: true, escalationId: existing.escalationId, reused: true };
      }

      if (artifactRefs) {
        // commitEscalation re-reads the disk, so an in-memory-only change would
        // be lost. Persist the seed in ONE CAS before the escalation transaction.
        node.artifactRefs = artifactRefs;
        const seeded = await saveState(instanceId, state, { expectedState: expectedOf(state) });
        if (!seeded.ok) return fail(seeded.code, seeded.params ?? {});
        state.rev = seeded.rev;
      }

      const emit = makeEmitter(instanceId, null);
      const result = await escalateState({
        instanceId,
        state,
        node,
        reasonCode,
        reasonDetail: `${ESC_TEXT.executionPrefix}${node.failure?.message ?? ''}`,
        defects: node.verdict?.value === 'fail' ? (node.verdict.defects ?? []) : [],
        emit,
      });
      if (!result.ok) return { ok: false, code: 'ESCALATION_WRITE_FAILED', detail: result.params ?? null };
      return { ok: true, escalationId: result.escalationId, reused: false };
    });
  }

  async function dispose() {
    const list = [...adapters];
    adapters.clear();
    for (const handle of [...activeRuns.values()]) {
      handle.cancelled = true;
      handle.finished = true;
      if (handle.currentCtx) handle.currentCtx.finished = true;
    }
    activeRuns.clear();
    for (const adapter of list) {
      try {
        await adapter.dispose();
      } catch {
        // 忽略单个适配器的清理异常
      }
    }
  }

  // ------------------------------------------------------------ WP-6 lifecycle

  // D-5.2: explicit per-run approval policy (set by the run.start RPC). Read by
  // handlePermission through the closure; null keeps the host-configured value.
  let runtimeApprovalPolicy = null;
  function setApprovalPolicy(policy) {
    runtimeApprovalPolicy = normalizePermissionPolicy(policy);
    return { ok: true, policy: runtimeApprovalPolicy };
  }

  // WP-4's two injectable gates are constructor parameters. Rebind them lazily
  // here (only when the constructor did NOT supply one) so the daemon can drive
  // them over the test-only RPCs without recreating the orchestrator.
  const deliveryGate = { wait: null, cancel: null };
  if (!deliveryHold) deliveryHold = deliveryGate;
  let deliveryActive = false;
  const deliveryWaiters = [];
  let deliveryHeldNotify = null;

  deliveryGate.cancel = () => {
    deliveryActive = false;
    for (const waiter of deliveryWaiters.splice(0)) {
      waiter.info?.cancelTimer?.();
      waiter.resolve(false);
    }
  };

  function holdDelivery({ action } = {}) {
    if (action === 'hold') {
      deliveryActive = true;
      deliveryGate.wait = (info) => new Promise((resolve) => {
        deliveryWaiters.push({ resolve, info });
        if (typeof deliveryHeldNotify === 'function') {
          const notify = deliveryHeldNotify;
          deliveryHeldNotify = null;
          notify(info);
        }
      });
      return { ok: true, action };
    }
    if (action === 'release') {
      deliveryActive = false;
      deliveryGate.wait = null;
      for (const waiter of deliveryWaiters.splice(0)) waiter.resolve(true);
      return { ok: true, action };
    }
    if (action === 'cancel') {
      deliveryGate.cancel();
      deliveryGate.wait = null;
      return { ok: true, action };
    }
    return fail('IPC_BAD_PARAMS', { field: 'action' });
  }

  function whenDeliveryHeld() {
    if (deliveryWaiters.length > 0) return Promise.resolve();
    return new Promise((resolve) => { deliveryHeldNotify = resolve; });
  }

  let handoffMutator = null;
  if (isTest && !handoffDraftHook) {
    handoffDraftHook = (handoff, meta) => {
      if (typeof handoffMutator !== 'function') return undefined;
      const apply = handoffMutator;
      handoffMutator = null; // one-shot
      return apply(handoff, meta);
    };
  }

  function applyHandoffMutation(handoff, mutate) {
    const refs = handoff.artifactRefs && typeof handoff.artifactRefs === 'object'
      ? { ...handoff.artifactRefs }
      : { input: [], output: null, previous: null };
    switch (mutate) {
      case 'missing-to':
        handoff.toNodeId = null;
        break;
      case 'missing-field':
        delete handoff.round;
        break;
      case 'no-evidence':
        handoff.artifactRefs = { ...refs, input: [], previous: null };
        handoff.defects = [];
        break;
      case 'remove-evidence':
        handoff.artifactRefs = { ...refs, input: [] };
        break;
      case 'escape-ref':
        handoff.artifactRefs = { ...refs, input: ['../outside.txt'] };
        break;
      case 'hash-mismatch':
        handoff.artifactRefs = { ...refs, previous: { ref: 'calc.js', sha256: 'deadbeef' } };
        break;
      case 'backflow-empty-defects':
        handoff.defects = [];
        break;
      case 'empty-requirements':
        handoff.revisionRequirement = '';
        handoff.retestRequirement = '';
        break;
      default:
        break;
    }
    return handoff;
  }

  /** D-10 / AC-09~14: register a one-shot draft mutation for `test.handoff`. */
  function seamHandoff({ instanceId, nodeId, edgeKind = null, round = null, mutate = null } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('IPC_BAD_PARAMS', { field: 'instanceId' });
    }
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
      return fail('IPC_BAD_PARAMS', { field: 'nodeId' });
    }
    if (typeof mutate !== 'string' || mutate.length === 0) {
      return fail('IPC_BAD_PARAMS', { field: 'mutate' });
    }
    if (!isTest) return fail('IPC_BAD_METHOD', { method: 'test.handoff' });
    handoffMutator = (handoff) => applyHandoffMutation(handoff, mutate);
    return {
      ok: true,
      registered: true,
      instanceId,
      nodeId,
      edgeKind,
      round,
      mutate,
      // A draft exists only once the next drive reaches the hook. The caller
      // asserts the rejected package from state.json / events.jsonl.
      snapshot: null,
    };
  }

  function terminalNodeId(graph, id) {
    if (!graph) return false;
    if (typeof graph.terminal === 'string' && graph.terminal.length > 0) return graph.terminal === id;
    if (Array.isArray(graph.terminals)) return graph.terminals.includes(id);
    return (Array.isArray(graph.edges) ? graph.edges : []).every((edge) => edge.from !== id);
  }

  /** Distinguish a pause that won the CAS from a genuine concurrent-write conflict. */
  async function pausedTailOrConflict(instanceId) {
    const disk = await store.load(instanceId);
    const pausedOnDisk =
      disk.ok &&
      disk.state.paused === true &&
      disk.state.state === 'running' &&
      disk.state.halted !== true;
    return pausedOnDisk
      ? { ok: true, snapshot: snapshotOf(disk.state) }
      : { ok: false, code: 'STORE_CONFLICT' };
  }

  /**
   * D-7.2: pause/resume never take the instance lock. One queued save carries a
   * function-valued expectedState evaluated INSIDE the queue task, right after
   * the disk read, so a rev bump during queuing is not a false conflict. A
   * business-precondition failure is expressed as a guaranteed conflict (no
   * write); the caller re-enqueues at most 3 times and NEVER calls store.save
   * from inside the queue task (self-deadlock).
   */
  function pausedExpected(kind, disk, guard) {
    if (!disk) return { state: '__missing__' };
    if (disk.state !== 'running' || disk.halted === true) {
      guard.code = kind === 'pause' ? 'INSTANCE_NOT_PAUSABLE' : 'INSTANCE_NOT_RESUMABLE';
      guard.state = disk.state ?? null;
      return { state: '__guard__' };
    }
    const target = kind === 'pause';
    if (Boolean(disk.paused) === target) {
      guard.code = 'IDEMPOTENT';
      return { state: '__guard__' };
    }
    return {
      state: disk.state,
      halted: Boolean(disk.halted),
      rev: Number.isInteger(disk.rev) ? disk.rev : 0,
      paused: Boolean(disk.paused),
    };
  }

  async function withPausedWrite(instanceId, kind) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_FOUND', { instanceId: instanceId ?? null });
    }
    const target = kind === 'pause';
    const live = activeRuns.get(instanceId);
    const ctx = live && !live.finished ? live.currentCtx : null;
    let state;
    if (ctx?.state) {
      // D-7.2 step 5: flip the live round's in-memory snapshot first so its
      // next saveLive uses the newest rev.
      state = ctx.state;
      state.paused = target;
    } else {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) return fail(loaded.code ?? 'NOT_FOUND', loaded.params ?? {});
      if (isLegacy(loaded.state)) return fail('LEGACY_READ_ONLY', {});
      state = arraysOf(loaded.state);
      state.paused = target;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const guard = {};
      const saved = await store.save(instanceId, state, {
        expectedState: (disk) => pausedExpected(kind, disk, guard),
      });
      if (saved.ok) {
        state.rev = saved.rev;
        const emit = makeEmitter(instanceId, null);
        await emit({
          object: 'instance',
          objectId: instanceId,
          from: null,
          to: null,
          result: 'applied',
          reason: target ? 'workflow.paused' : 'workflow.resumed',
          detail: { paused: target },
        });
        if (!target) maybeResumeDrive(instanceId, state);
        return { ok: true, paused: target, idempotent: false, snapshot: snapshotOf(state) };
      }
      if (saved.code !== 'STORE_CONFLICT') return fail(saved.code, saved.params ?? {});
      if (guard.code === 'IDEMPOTENT') {
        const loaded = await store.load(instanceId);
        return {
          ok: true,
          idempotent: true,
          paused: Boolean(loaded.ok && loaded.state.paused),
          snapshot: loaded.ok ? snapshotOf(loaded.state) : null,
        };
      }
      if (guard.code) return fail(guard.code, { instanceId, state: guard.state });
      // Genuine concurrent-write conflict: re-enqueue a FRESH save. The expected
      // function re-reads the disk inside the next queue task.
    }
    return fail('STORE_CONFLICT', {});
  }

  async function pause(args = {}) { return withPausedWrite(args.instanceId, 'pause'); }
  async function resume(args = {}) { return withPausedWrite(args.instanceId, 'resume'); }
  async function abort(args = {}) { return cancel({ instanceId: args.instanceId }); }

  /** D-7.3: lock-free background drive after a real resume. */
  function maybeResumeDrive(instanceId, state) {
    const live = activeRuns.get(instanceId);
    if (live && !live.finished) return; // an existing drive keeps going
    const handle = {
      instanceId,
      graph: graphForState(state),
      currentCtx: null,
      cancelled: false,
      finished: false,
    };
    // Claim synchronously: no await between the activeRuns check and the set.
    activeRuns.set(instanceId, handle);
    const hostId = latestSession(state)?.hostId ?? null;
    (async () => {
      try {
        // AC-66 / BR-14,BR-24,BR-25 / D-7.4 step 1+3: a handoff persisted as
        // `created` just before the pause is the package that was about to be
        // dispatched. Reuse it ONLY under the three gates and the round guard;
        // a committed dispatch leaving a stale `created` package on disk must
        // never trigger a second package, dispatch, round or session.
        // Re-read the disk snapshot: the in-memory copy from withPausedWrite
        // may predate the dispatch that committed, and dispatchInState must
        // expect the disk rev (AC-53), not a stale one.
        const freshLoaded = await store.load(instanceId);
        const fresh = freshLoaded.ok && !isLegacy(freshLoaded.state)
          ? arraysOf(freshLoaded.state)
          : null;
        let runGraph = null;
        let targetNodeId = null;
        let pending = null;
        let skipAdvance = false;
        if (fresh) {
          runGraph = graphForState(fresh);
          // D-7.4 step 1: derive THIS advance's target node + targetRound from
          // the planner (advance.js: targetRound = target node round + 1),
          // never reverse-derive the node id from the chosen package.
          const fromNodeId = latestEndedNodeId(fresh);
          const plan = planAdvance({
            graph: runGraph,
            snapshot: fresh,
            fromNodeId,
            outcome: classifyNodeOutcome(fresh, fromNodeId, null),
            verdict: null,
            workspaceDir: workspaceDirOf(fresh),
            now: clock,
          });
          targetNodeId = plan.targetNodeId ?? plan.nodeId ?? null;
          const targetRound = plan.targetRound ?? plan.round ?? null;
          const targetNode = nodeOf(fresh, targetNodeId);
          // A `created` package carries construction-time targetRound in
          // handoff.round (iteration-4.md section 2.10). A busy target, a disk
          // node.round already >= that round, or a session already started for
          // it all mean the dispatch committed -> D-7.4 step 1 stop guard.
          const built = [...(fresh.handoffs ?? [])].reverse().find(
            (item) => item?.state === 'created' && item?.edge &&
              item.toNodeId === targetNodeId,
          ) ?? null;
          const builtRound = Number.isInteger(built?.round) ? built.round : null;
          const committed = !!built && !!targetNode &&
            Number.isInteger(builtRound) && targetNode.round >= builtRound;
          const startedThisRound = !!built && (fresh.sessions ?? []).some(
            (session) => session?.nodeId === targetNodeId &&
              session?.round === builtRound,
          );
          const stopped = !!targetNode &&
            (isNodeBusyState(targetNode.state) || committed);
          const anyCreated = (fresh.handoffs ?? []).some(
            (item) => item?.state === 'created' && item?.edge,
          );
          if (!stopped && ['dispatch', 'backflow'].includes(plan.action)) {
            // Three gates: toNodeId === target, round === targetRound, and no
            // session started for that round (old-round sessions do not count).
            pending = [...(fresh.handoffs ?? [])].reverse().find((item) =>
              item?.state === 'created' && item?.edge &&
              item.toNodeId === targetNodeId &&
              item.round === targetRound &&
              !startedThisRound,
            ) ?? null;
          }
          // With a `created` package on disk but no gated match, re-planning
          // would build a second package. Stop instead; a clean resume with no
          // `created` package still falls through to advance().
          skipAdvance = stopped || (anyCreated && !pending);
        }
        if (pending) {
          const dispatched = await dispatchInState(fresh, targetNodeId, {
            handoffId: pending.handoffId,
            promptText: retryPromptText(fresh, { nodeId: targetNodeId }, runGraph),
            hostId,
            emit: makeEmitter(instanceId, null),
            onProgress: null,
          });
          if (dispatched.ok && dispatched.ctx) {
            handle.currentCtx = dispatched.ctx;
            driveGraph(handle).catch(() => {});
            return;
          }
        } else if (fresh && !skipAdvance) {
          const next = await advance(instanceId, { hostId });
          if (next.action === 'dispatch' && next.ctx) {
            handle.currentCtx = next.ctx;
            driveGraph(handle).catch(() => {});
            return;
          }
        }
        handle.finished = true;
        if (activeRuns.get(instanceId) === handle) activeRuns.delete(instanceId);
      } catch {
        handle.finished = true;
        if (activeRuns.get(instanceId) === handle) activeRuns.delete(instanceId);
      }
    })();
  }

  function attachToDrive(instanceId, state, ctx) {
    const existing = activeRuns.get(instanceId);
    const handle = existing && !existing.finished
      ? existing
      : {
          instanceId,
          graph: graphForState(state),
          currentCtx: null,
          cancelled: false,
          finished: false,
        };
    activeRuns.set(instanceId, handle);
    handle.currentCtx = ctx;
    return handle;
  }

  async function instanceIds(scoped) {
    if (typeof scoped === 'string' && scoped.length > 0) return [scoped];
    const listed = await store.list();
    return (listed?.items ?? [])
      .map((item) => item?.instanceId)
      .filter((id) => typeof id === 'string');
  }

  async function listApprovals({ instanceId = null, sessionId = null } = {}) {
    const ids = await instanceIds(instanceId);
    const rows = [];
    for (const id of ids) {
      const loaded = await store.load(id);
      if (!loaded.ok) continue;
      const list = Array.isArray(loaded.state.approvals) ? loaded.state.approvals : [];
      for (const row of list) {
        if (typeof sessionId === 'string' && sessionId.length > 0 && row?.sessionId !== sessionId) {
          continue;
        }
        rows.push({ instanceId: id, ...row });
      }
    }
    rows.sort((a, b) =>
      String(a.instanceId).localeCompare(String(b.instanceId)) ||
      String(a.approvalId).localeCompare(String(b.approvalId)));
    return { ok: true, approvals: rows };
  }

  async function resolveApproval({ instanceId = null, approvalId, decision } = {}) {
    if (typeof approvalId !== 'string' || approvalId.length === 0) {
      return fail('APPROVAL_NOT_FOUND', { approvalId: approvalId ?? null });
    }
    if (decision !== 'allow' && decision !== 'deny') {
      return fail('USAGE_ERROR', { field: 'decision' });
    }
    const scoped = typeof instanceId === 'string' && instanceId.length > 0;
    const ids = await instanceIds(instanceId);
    const matches = [];
    for (const id of ids) {
      const loaded = await store.load(id);
      if (!loaded.ok) continue;
      const row = approvals.findApproval(loaded.state.approvals, approvalId);
      if (row) matches.push({ id, state: loaded.state, row });
    }
    if (matches.length === 0) return fail('APPROVAL_NOT_FOUND', { approvalId });
    if (matches.length > 1 && !scoped) return fail('APPROVAL_AMBIGUOUS', { approvalId });
    const target = matches[0];
    if (target.row.state !== 'pending') {
      return fail('APPROVAL_NOT_PENDING', { approvalId, state: target.row.state });
    }

    // Section 1.5 / D-5.9: without the in-memory respond handle (core restart)
    // keep the row pending and refuse; never fake an approval.
    const live = activeRuns.get(target.id);
    const ctx = live && !live.finished ? live.currentCtx : null;
    const permission = ctx?.permission ?? null;
    const check = approvals.approvalSessionCheck(target.row, permission);
    if (!check.ok) return fail(check.code, { approvalId });
    if (ctx.finished || ctx.cancelled || !ctx.session || ctx.session.state !== 'waiting_input') {
      return fail(approvals.APPROVAL_SESSION_GONE, { approvalId });
    }
    const row = approvals.findApproval(ctx.state.approvals, approvalId) ?? target.row;
    const respond = (arg) => permission.respond(arg);
    await settlePermission(ctx, decision === 'allow' ? 'allow' : 'reject', {
      approval: row,
      respond,
    });
    return {
      ok: true,
      approvalId,
      state: row.state,
      resolution: row.resolution,
      action: row.action,
      instanceId: target.id,
    };
  }

  async function locateSession({ sessionId } = {}) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      return fail('SESSION_NOT_FOUND', { sessionId: sessionId ?? null });
    }
    for (const id of await instanceIds(null)) {
      const loaded = await store.load(id);
      if (!loaded.ok) continue;
      const session = sessionOf(loaded.state, sessionId);
      if (!session) continue;
      return { ok: true, instanceId: id, nodeId: session.nodeId ?? null, session };
    }
    return fail('SESSION_NOT_FOUND', { sessionId });
  }

  /** D-6.7: reuse the newest handoff aimed at the node, else reassemble. */
  function retryPromptText(state, entry, graph) {
    const candidate = [...(state.handoffs ?? [])].reverse().find(
      (item) => item.toNodeId === entry.nodeId || item.edge?.to === entry.nodeId,
    ) ?? null;
    const def = graphNode(graph, entry.nodeId);
    return promptFor({
      graph,
      node: def,
      handoff: candidate,
      task: state.task ?? '',
      products: productsOfTask(state),
      defects: candidate?.defects ?? [],
      defectCount: candidate?.defects?.length ?? 0,
      round: (nodeOf(state, entry.nodeId)?.round ?? 0) + 1,
      workspaceDir: workspaceDirOf(state),
      reviewPath: reviewPathOf(state),
      revisionRequirement: candidate?.revisionRequirement ?? null,
    });
  }

  /**
   * Three adjudication exits (D-6 / section 3.1). ONE CAS persists the verdict
   * plus the node/instance/session moves; events are broadcast only afterwards.
   * No `advance()` runs inside a held lock: resolveEscalation itself takes no
   * lock, and the follow-up dispatch/advance runs AFTER the write is committed.
   * A failed dispatch degrades to "verdict persisted + new escalation" (section
   * 4 WP-6 rollback), never a half-written running instance.
   */
  async function resolveEscalation({ instanceId = null, escalationId, decision } = {}) {
    if (typeof escalationId !== 'string' || escalationId.length === 0) {
      return fail('ESCALATION_NOT_FOUND', { escalationId: escalationId ?? null });
    }
    if (!['pass', 'fail', 'retry'].includes(decision)) {
      return fail('ESCALATION_DECISION_INVALID', {
        escalationId, decision, allowed: 'pass|fail|retry',
      });
    }

    // C-12: locate across instances; ambiguity only when no instance was given.
    const scoped = typeof instanceId === 'string' && instanceId.length > 0;
    const ids = await instanceIds(instanceId);
    const matches = [];
    for (const id of ids) {
      const loaded = await store.load(id);
      if (!loaded.ok) continue;
      const entry = (Array.isArray(loaded.state.escalations) ? loaded.state.escalations : [])
        .find((item) => item?.escalationId === escalationId);
      if (entry) matches.push({ id, state: loaded.state, entry });
    }
    if (matches.length === 0) return fail('ESCALATION_NOT_FOUND', { escalationId });
    if (matches.length > 1 && !scoped) return fail('ESCALATION_AMBIGUOUS', { escalationId });

    const { id, state: diskState, entry } = matches[0];
    const state = arraysOf(diskState);
    if (entry.state !== 'pending') {
      return fail('ESCALATION_NOT_PENDING', { escalationId, state: entry.state });
    }
    if (state.state !== 'suspended' || state.halted === true) {
      return fail('INSTANCE_NOT_SUSPENDED', { instanceId: id, state: state.state });
    }
    // BR-19: only a rounds_exceeded escalation may be passed.
    if (decision === 'pass' && entry.reasonCode !== 'rounds_exceeded') {
      return fail('ESCALATION_DECISION_INVALID', {
        escalationId, decision, allowed: 'fail|retry',
      });
    }

    const node = nodeOf(state, entry.nodeId);
    if (!node) return fail('ESCALATION_NOT_FOUND', { escalationId });
    const graph = graphForState(state);
    const terminal = terminalNodeId(graph, entry.nodeId);

    // Section 2.9 invariant: every new write entry point validates the table.
    const nodeTo = decision === 'fail' ? 'failed' : decision === 'pass' ? 'done' : 'running';
    const nodeCheck = nodeSM.can(node.state, nodeTo);
    if (!nodeCheck.ok) {
      return { ok: false, code: nodeCheck.code, params: { from: node.state, to: nodeTo } };
    }
    const instanceTo = decision === 'fail'
      ? 'failed'
      : decision === 'pass' && terminal
        ? 'completed'
        : 'running';
    const instanceCheck = instanceSM.can(state.state, instanceTo);
    if (!instanceCheck.ok) {
      return { ok: false, code: instanceCheck.code, params: { from: state.state, to: instanceTo } };
    }

    const expected = expectedOf(state);
    const at = iso();
    const events = [];

    // ONE CAS: adjudication + node/instance/session moves + (retry) extraRounds.
    entry.state = 'resolved';
    entry.resolution = decision;
    entry.resolvedAt = at;
    events.push({
      object: 'escalation',
      objectId: escalationId,
      from: 'pending',
      to: 'resolved',
      result: 'applied',
      reason: 'escalation.resolved',
      detail: { escalationId, resolution: decision },
    });

    for (const session of state.sessions) {
      if (session.state === 'idle' && session.quarantined) continue;
      const from = session.state;
      session.state = 'idle';
      session.quarantined = true;
      session.stateSince = at;
      events.push({
        object: 'session', objectId: session.sessionId,
        from, to: 'idle', result: 'applied', reason: 'state.change', detail: null,
      });
    }

    if (decision === 'retry') {
      // D-6.6 / D-6.8: grant exactly ONE extra round by persisting it here, in
      // the adjudication CAS. No explicit `extraRounds` argument is EVER passed
      // to advance/planAdvance, so `extraOf` reads persisted(1) + explicit(0)
      // = 1 (no double counting, WP-4 review MINOR).
      node.extraRounds = (Number.isInteger(node.extraRounds) ? node.extraRounds : 0) + 1;
      // The node stays `escalated` in this write; the dispatch CAS below
      // performs escalated -> running and bumps the round exactly once.
      state.state = 'running';
    } else {
      const from = node.state;
      node.state = nodeTo;
      node.note = null;
      node.endedAt = at;
      node.stateSince = at;
      events.push({
        object: 'node', objectId: node.nodeId,
        from, to: nodeTo, result: 'applied', reason: 'state.change', detail: null,
      });
      state.state = instanceTo;
    }
    state.paused = false; // D-7.6
    state.stateSince = at;
    events.push({
      object: 'instance', objectId: id,
      from: 'suspended', to: state.state,
      result: 'applied', reason: 'state.change', detail: null,
    });

    const saved = await saveState(id, state, { expectedState: expected });
    if (!saved.ok) return fail(saved.code, saved.params ?? {});
    state.rev = saved.rev;
    // Events are broadcast only AFTER the state write (section 2.9 invariant).
    const emit = makeEmitter(id, null);
    for (const event of events) await emit(event);

    const hostId = latestSession(state)?.hostId ?? null;
    let outcome;

    if (decision === 'retry') {
      // D-6.9: dispatch directly (never call advance() afterwards: the target
      // is already running and would be judged busy). Adjudication is already
      // on disk, so a failed dispatch degrades to "verdict persisted + a new
      // escalation by dispatchInState".
      const dispatched = await dispatchInState(state, entry.nodeId, {
        handoffId: null,
        promptText: retryPromptText(state, entry, graph),
        hostId,
        emit,
        onProgress: null,
      });
      if (dispatched.ok && dispatched.ctx) {
        const handle = attachToDrive(id, state, dispatched.ctx);
        driveGraph(handle).catch(() => {});
        outcome = { ok: true, dispatched: true, sessionId: dispatched.sessionId };
      } else {
        outcome = { ok: true, dispatched: false, suspended: true, code: dispatched.code ?? null };
      }
    } else if (decision === 'pass' && !terminal) {
      // D-6.4 / D-6.9: claim a handle then advance() ONCE, outside any held
      // lock (withLock is not reentrant). Hand a dispatch to driveGraph.
      const handle = attachToDrive(id, state, null);
      const next = await advance(id, { hostId });
      if (next.action === 'dispatch' && next.ctx) {
        handle.currentCtx = next.ctx;
        driveGraph(handle).catch(() => {});
        outcome = { ok: true, dispatched: true };
      } else {
        handle.finished = true;
        if (activeRuns.get(id) === handle) activeRuns.delete(id);
        outcome = { ok: true, dispatched: false };
      }
    } else {
      // fail / terminal pass: no further advance.
      outcome = { ok: true, dispatched: false };
    }

    return {
      ok: true,
      escalationId,
      resolution: decision,
      state: state.state,
      instanceId: id,
      snapshot: snapshotOf(state),
      ...outcome,
    };
  }

  return {
    startRun,
    waitForRun,
    cancel,
    getStatus,
    listInstances,
    reconcileOnBoot,
    interruptAll,
    dispose,
    pause,
    resume,
    abort,
    resolveEscalation,
    listApprovals,
    resolveApproval,
    locateSession,
    setApprovalPolicy,
    ...(isTest ? {
      dispatchToNode: seamDispatch,
      escalateOnce,
      seamHandoff,
      holdDelivery,
      whenDeliveryHeld,
    } : {}),
  };
}
