/**
 * 单节点任务主流程（拆分文档 §2.12）。
 *
 * 职责边界：
 * - 本文件只做“裁决”：调状态机、调事件总线、调核对器；宿主细节全部由注入的
 *   `adapterFactory` 提供（本层不认识具体宿主、协议或进程）。
 * - 三层状态（实例 / 节点 / 会话 / 交接包）每次变化都先落事件再推进内存状态，
 *   所有 `save` 与 `emit` 都被 await，不允许 fire-and-forget。
 * - `stopReason` 只用于判定“turn 结束”，绝不用于判定成功/失败（探针 §1.0 F3）：
 *   失败只来自 ① prompt 返回 JSON-RPC error，② 产出核对不通过。
 *
 * 状态字段名 `hostId` / `hostRaw` 来自 §3.1 的 state.json 契约，是数据字段而非宿主分支。
 */
import fs from 'node:fs/promises';

import { createHandoffTracker } from '../adapter/handoff-tracker.js';
import { normalizePermissionPolicy, resolvePermissionPolicy } from '../adapter/host-config.js';
import { createNormalizer } from '../adapter/session-state.js';
import { CODES, classifyPromptError } from './error-map.js';
import { createHandoffSM, createInstanceSM, createNodeSM } from './state-machine.js';
import { extractDeclaredArtifacts, verifyArtifacts as defaultVerify } from './verify-artifact.js';

const ROLE_ID = 'worker';
const DEFAULT_HOST_ID = 'dsh';
const NODE_ID = 'T-001';
const HANDOFF_ID = 'HO-001';
const TURN_ID = 'turn-1';

/** 会话“无新事件”阈值（主 Agent 定 10s，只影响展示，不触发失败判定）。 */
const STALL_MS = 10_000;
/** cancel 通知的 best-effort 超时：宿主无响应也不阻塞终态落地（探针 §5.3）。 */
const CANCEL_TIMEOUT_MS = 1000;

const TERMINAL_INSTANCE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
const ACTIVE_NODE = new Set(['pending', 'running', 'review']);

/** waitForRun 超时哨兵：与任何业务返回值都不相等。 */
const WAIT_TIMEOUT = Symbol('run.wait.timeout');

function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

function fail(code, params = {}) {
  return { ok: false, code, params };
}

function buildPrompt(task) {
  return `${task}\n\n完成后直接结束，不需要额外说明。`;
}

function handoffToState(snapshot) {
  return {
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
}

/**
 * @param {{
 *   store: object,
 *   bus: object,
 *   adapterFactory: {create: (args:{hostId:string,cwd:string}) => Promise<object>},
 *   verify?: Function,
 *   clock?: () => number,
 *   generation?: string,
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

  const instanceSM = createInstanceSM();
  const nodeSM = createNodeSM();
  const handoffSM = createHandoffSM();

  /** 审批策略：显式参数 > env > 宿主配置 > 默认 allow（宿主细节不进入核心分支）。 */
  const explicitPermissionPolicy = normalizePermissionPolicy(permissionPolicy);
  const policyCache = new Map();
  async function policyFor(hostId) {
    if (explicitPermissionPolicy) return explicitPermissionPolicy;
    const key = typeof hostId === 'string' && hostId.length > 0 ? hostId : DEFAULT_HOST_ID;
    if (policyCache.has(key)) return policyCache.get(key);
    const resolved = await resolvePermissionPolicy({ root: store.root, hostId: key, env });
    policyCache.set(key, resolved.policy);
    return resolved.policy;
  }

  /** 同一实例的“抢占”互斥：claim 阶段的串行化 + 运行期禁止二次发起（BR-01）。 */
  const locks = new Map();
  /** 运行中的实例上下文：cancel 需要拿到 adapter / tracker / state。 */
  const activeRuns = new Map();
  /** 运行终态等待器：instanceId → {promise, resolve}，run 结束时 resolve。 */
  const runWaiters = new Map();
  /** 已分配的实例号（防止并发自动分配撞号）。 */
  const reserved = new Set();
  /** 已创建的 adapter，dispose 时统一关闭。 */
  const adapters = new Set();

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
    return opts ? store.save(instanceId, state, opts) : store.save(instanceId, state);
  }

  /** 把磁盘快照灌回内存副本（保持引用不变，ctx 里的 state 仍然有效）。 */
  function adoptState(live, disk) {
    if (!live || !disk) return;
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, disk);
  }

  function smFor(object) {
    if (object === 'node') return nodeSM;
    if (object === 'handoff') return handoffSM;
    return instanceSM;
  }

  function objectIdOf(object, state, instanceId) {
    if (object === 'node') return state.node?.nodeId ?? NODE_ID;
    if (object === 'handoff') return state.handoff?.handoffId ?? HANDOFF_ID;
    return instanceId;
  }

  /**
   * 统一迁移入口（比较并交换）。
   *
   * 1. 每次都以磁盘最新快照为 `from` 重新校验；内存与磁盘分叉时先按磁盘校正；
   * 2. 非法 → 落一条 `rejected / illegal_transition` 事件，磁盘不动；
   * 3. 合法 → 改内存副本，再 `save(..., {expectedState: 磁盘实例状态})`；
   * 4. STORE_CONFLICT → 重新 load 再走一遍（最多 3 次），仍冲突则落
   *    `rejected / store.conflict` 事件并放弃（不覆盖终态）。
   */
  async function transit(instanceId, object, to, { emit, state, reason, detail } = {}) {
    if (!state) return { ok: false, code: 'UNKNOWN_STATE', from: null, to };
    const sm = smFor(object);
    let lastFrom = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const disk = await store.load(instanceId);
      if (!disk.ok) {
        return { ok: false, code: disk.code ?? 'NOT_FOUND', from: lastFrom, to };
      }
      // 磁盘是唯一事实来源：外部把实例判成 interrupted 后，内存里的 running 不得覆盖它。
      if (state.state !== disk.state.state) adoptState(state, disk.state);

      const holder = object === 'instance' ? state : state[object];
      if (!holder || typeof holder.state !== 'string') {
        return { ok: false, code: 'UNKNOWN_STATE', from: null, to };
      }
      const from = holder.state;
      lastFrom = from;
      const objectId = objectIdOf(object, state, instanceId);

      if (from === to) return { ok: true, from, to, repeat: true };

      const verdict = sm.can(from, to);
      if (!verdict.ok) {
        await emit({
          object,
          objectId,
          from,
          to,
          result: 'rejected',
          reason: 'illegal_transition',
          detail: { ...(detail || {}), message: verdict.message },
        });
        return { ok: false, code: verdict.code, from, to };
      }

      holder.state = to;
      holder.stateSince = iso();
      const saved = await saveState(instanceId, state, { expectedState: disk.state.state });
      if (saved.ok) {
        await emit({ object, objectId, from, to, result: 'applied', reason, detail });
        return { ok: true, from, to };
      }

      // 冲突：回滚到磁盘快照，重读后重试；其它写失败直接放弃。
      adoptState(state, disk.state);
      if (saved.code !== 'STORE_CONFLICT') {
        await emit({
          object,
          objectId,
          from,
          to,
          result: 'rejected',
          reason: 'store.write_failed',
          detail: { ...(detail || {}), code: saved.code },
        });
        return { ok: false, code: saved.code, from, to };
      }
    }

    const disk = await store.load(instanceId);
    const from = disk.ok
      ? object === 'instance'
        ? disk.state.state
        : disk.state?.[object]?.state ?? null
      : lastFrom;
    await emit({
      object,
      objectId: disk.ok ? objectIdOf(object, disk.state, instanceId) : instanceId,
      from,
      to,
      result: 'rejected',
      reason: 'store.conflict',
      detail: { ...(detail || {}), expected: lastFrom, actual: from },
    });
    return { ok: false, code: 'STORE_CONFLICT', from, to };
  }

  function makeTransitioner(emit, instanceId, state) {
    return function transition(object, to, reason, detail) {
      return transit(instanceId, object, to, { emit, state, reason, detail });
    };
  }

  /** 落盘内存快照（CAS 到内存当前的实例状态）；外部已分叉时不覆盖。 */
  async function saveLive(ctx) {
    const res = await saveState(ctx.instanceId, ctx.state, { expectedState: ctx.state.state });
    if (!res.ok && res.code === 'STORE_CONFLICT') ctx.conflicted = true;
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

  /** 第 4 步（拉起 + 建会话）失败的统一分类。 */
  function preflightFailure(error) {
    const message = error?.message ?? String(error ?? '未知错误');
    if (error?.code === 'REQUEST_TIMEOUT' || error?.code === 'CORE_START_FAILED') {
      return fail(CODES.CORE_START_FAILED, { cause: message });
    }
    return fail(CODES.DSH_SPAWN_FAILED, { cause: message });
  }

  function buildSession({ sessionId, hostId }) {
    const at = iso();
    return {
      sessionId,
      hostId,
      state: 'idle',
      stateSince: at,
      createdAt: at,
      lastEventAt: at,
      toolName: null,
      turnId: null,
      pendingPermission: null,
      quarantined: false,
    };
  }

  function newState({ instanceId, cwd, task }) {
    const at = iso();
    return {
      schemaVersion: 1,
      instanceId,
      coreGeneration: generation,
      createdAt: at,
      updatedAt: at,
      state: 'created',
      stateSince: at,
      cwd,
      task,
      roleId: ROLE_ID,
      node: {
        nodeId: NODE_ID,
        state: 'pending',
        stateSince: at,
        startedAt: null,
        endedAt: null,
        failure: null,
        note: null,
      },
      session: null,
      handoff: null,
      artifactRefs: [],
      hostRaw: { stopReason: null, lastError: null, agentInfo: null },
      counters: { eventSeq: 0, runCount: 1 },
    };
  }

  /**
   * 第 1~6 步的“抢占”段：cwd 校验 → 实例/节点检查 → 拉起宿主 → 建会话 →
   * 首次落盘 → 事件 → 交接包 created → 投递。
   *
   * 该段在 per-instance 锁内执行；成功返回后立刻登记 activeRuns，锁释放，
   * 后续 turn 与核对在 finishRun 中执行（此时有新发起请求会被 NODE_BUSY 拦下）。
   */
  async function claimRun({ cwd, task, instanceId, hostId, onProgress }) {
    if (activeRuns.has(instanceId)) return { ok: false, result: fail(CODES.NODE_BUSY, {}) };

    // 1) cwd 归一 + 可写（失败不建实例、不建会话，AC-10）
    let resolvedCwd;
    try {
      resolvedCwd = await fs.realpath(cwd);
    } catch {
      return { ok: false, result: fail(CODES.CWD_NOT_WRITABLE, { path: cwd }) };
    }
    try {
      await fs.access(resolvedCwd, fs.constants.W_OK);
    } catch {
      return { ok: false, result: fail(CODES.CWD_NOT_WRITABLE, { path: resolvedCwd }) };
    }

    // 2) 实例号分配 / 复用判定
    let state = null;
    if (instanceId) {
      const loaded = await store.load(instanceId);
      if (loaded.ok) {
        state = loaded.state;
        if (TERMINAL_INSTANCE.has(state.state)) {
          return { ok: false, result: fail(CODES.INSTANCE_TERMINAL, { state: state.state }) };
        }
        const nodeState = state.node?.state;
        if (nodeState === 'running' || nodeState === 'review') {
          // 不建会话、不写状态（AC-07 / BR-01）
          return { ok: false, result: fail(CODES.NODE_BUSY, {}) };
        }
        if (nodeState !== 'pending') {
          return { ok: false, result: fail(CODES.INSTANCE_TERMINAL, { state: state.state }) };
        }
      } else if (loaded.code === 'STATE_CORRUPT') {
        return { ok: false, result: { ok: false, code: 'STATE_CORRUPT', backupPath: loaded.backupPath, params: loaded.params } };
      } else if (loaded.code !== 'NOT_FOUND') {
        return { ok: false, result: fail(loaded.code, loaded.params ?? {}) };
      }
    }

    const fresh = !state;
    if (fresh) {
      state = newState({ instanceId, cwd: resolvedCwd, task });
    } else {
      state.cwd = resolvedCwd;
      state.task = task;
      state.coreGeneration = generation;
      state.counters = state.counters ?? { eventSeq: 0, runCount: 0 };
      state.counters.runCount = (state.counters.runCount ?? 0) + 1;
    }

    // 3) 半截实例规则：内存里先走 created → running / pending → running，暂不落盘
    const instanceFrom = fresh ? 'created' : state.state;
    const nodeFrom = state.node.state;
    // 已有实例的首次落盘做一次 CAS：别的核心若已改过它，本次直接放弃（不覆盖）。
    const expectedOnFirstSave = fresh ? undefined : state.state;
    const at = iso();
    state.state = 'running';
    state.stateSince = at;
    state.node.state = 'running';
    state.node.stateSince = at;
    state.node.startedAt = at;
    state.node.endedAt = null;
    state.node.failure = null;
    state.node.note = null;
    state.handoff = null;
    state.artifactRefs = [];
    state.session = null;
    state.counters.runCount = Math.max(1, state.counters.runCount ?? 1);

    const emit = makeEmitter(instanceId, onProgress);
    let adapter = null;

    // 4) 拉起 + 建会话；任一步失败都不落 state.json（AC-09）
    try {
      const created = await adapterFactory.create({ hostId, cwd: resolvedCwd });
      if (created && created.ok === false) throw created.error ?? created;
      adapter = created && created.ok === true && created.adapter ? created.adapter : created;
      if (!adapter || typeof adapter.initialize !== 'function') {
        throw new Error('adapterFactory.create 未返回可用适配器');
      }
      adapters.add(adapter);

      const initialized = await adapter.initialize();
      if (!initialized || initialized.ok !== true) {
        throw initialized?.error ?? new Error('initialize 失败');
      }
      const session = await adapter.newSession({ cwd: resolvedCwd, mcpServers: [] });
      if (!session || session.ok !== true) {
        throw session?.error ?? new Error('newSession 失败');
      }
      state.session = buildSession({ sessionId: session.result.sessionId, hostId });
    } catch (error) {
      if (adapter) {
        adapters.delete(adapter);
        try {
          await adapter.dispose();
        } catch {
          // 清理失败不改变错误分类
        }
      }
      if (state.session) state.session = null;
      return { ok: false, result: preflightFailure(error) };
    }

    // 5) 首次落盘；失败即放弃，不留半截
    const saved = await saveState(
      instanceId,
      state,
      expectedOnFirstSave === undefined ? undefined : { expectedState: expectedOnFirstSave },
    );
    if (!saved.ok) {
      adapters.delete(adapter);
      try {
        await adapter.dispose();
      } catch {
        // ignore
      }
      return { ok: false, result: fail(saved.code, saved.params ?? {}) };
    }

    if (instanceFrom !== 'running') {
      await emit({
        object: 'instance',
        objectId: instanceId,
        from: instanceFrom,
        to: 'running',
        result: 'applied',
        reason: 'run.started',
        detail: null,
      });
    }
    await emit({
      object: 'node',
      objectId: state.node.nodeId,
      from: nodeFrom,
      to: 'running',
      result: 'applied',
      reason: 'run.started',
      detail: null,
    });

    // 6) 交接包 created → 投递
    const normalizer = createNormalizer({ clock });
    const handoffEmits = [];
    const tracker = createHandoffTracker({
      handoffId: HANDOFF_ID,
      startedAt: now(),
      clock,
      emit: (ev) => handoffEmits.push(ev),
    });

    const ctx = {
      instanceId,
      state,
      adapter,
      tracker,
      normalizer,
      sessionId: state.session.sessionId,
      nodeId: state.node.nodeId,
      cancelled: false,
      finished: false,
      quiescing: false,
      conflicted: false,
      permission: null,
      permissionPolicy: 'allow',
      chain: Promise.resolve(),
      observedRefs: [],
      handoffEmits,
      emit,
    };
    ctx.permissionPolicy = await policyFor(hostId);

    // 会话初值保持 idle（BR-05 / AC-15）：只有宿主真的发出 turn 内帧才进入 thinking。
    // prompt 发出本身只是“使能”，不替宿主宣布“已开始干活”（BR-04）。
    normalizer.onPromptSent(ctx.sessionId, TURN_ID);
    state.session.turnId = TURN_ID;

    tracker.created({ atMs: now() });
    state.handoff = handoffToState(tracker.snapshot());
    await flushHandoff(ctx);
    await saveState(instanceId, state, { expectedState: state.state });

    // 7) 订阅 update：状态归并 + 交接包接受判定
    // 审批请求由本核心接管：落 waiting_input 事件后按宿主配置的策略应答
    // （allow / reject / hold），适配器不再自行猜测。
    adapter.onUpdate((payload) => {
      if (ctx.finished || ctx.quiescing) return;
      if (payload?.sessionId !== ctx.sessionId) return;
      handleUpdate(ctx, payload.update);
    });
    if (typeof adapter.onPermission === 'function') {
      ctx.offPermission = adapter.onPermission((permission) => handlePermission(ctx, permission));
    }

    activeRuns.set(instanceId, ctx);

    // 开始投递；先记 delivered 再等 turn 结束（prompt 是阻塞请求）
    const promptPromise = Promise.resolve().then(() =>
      adapter.prompt(ctx.sessionId, [{ type: 'text', text: buildPrompt(task) }]),
    );
    // 早返回模式下后台要在稍后才 await 它；先挂一个空处理，避免中间窗口出现
    // unhandledRejection（不改变 promptPromise 本身的取值）。
    promptPromise.catch(() => {});
    tracker.delivered({ atMs: now() });
    state.handoff = handoffToState(tracker.snapshot());
    await flushHandoff(ctx);
    await saveState(instanceId, state, { expectedState: state.state });
    ctx.promptPromise = promptPromise;

    return { ok: true, ctx };
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

  function enqueue(ctx, fn) {
    ctx.chain = ctx.chain.then(fn, fn);
    return ctx.chain;
  }

  /** 被审批动作名：tool_call.title（已记进会话）> toolCallId > 固定串。 */
  function permissionAction(ctx, permission) {
    const remembered = ctx.state.session?.toolName;
    if (typeof remembered === 'string' && remembered.trim().length > 0) return remembered.trim();
    if (typeof permission?.toolCallId === 'string' && permission.toolCallId.length > 0) {
      return permission.toolCallId;
    }
    return 'unknown-tool';
  }

  /**
   * session/request_permission 到达（应答之前）：
   * 落一条 `session → waiting_input` 事件，节点保持 running（BR-03），
   * 然后按策略 allow / reject / hold 决定是否应答。
   */
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

    if (ctx.state.session) {
      const from = ctx.state.session.state;
      // 先改内存再发事件：避免 await 期间到达的 update 用旧状态做 from。
      ctx.state.session.state = 'waiting_input';
      ctx.state.session.stateSince = iso();
      ctx.state.session.pendingPermission = { toolCallId: permission.toolCallId ?? null, action };
      // 会话只作指示：节点不得因等待审批而变化（BR-03）。
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

    if (ctx.permissionPolicy === 'allow') {
      permission.respond({ outcome: { outcome: 'selected', optionId: 'allow-once' } });
      await settlePermission(ctx, 'allow');
      return;
    }
    if (ctx.permissionPolicy === 'reject') {
      permission.respond({ outcome: { outcome: 'selected', optionId: 'reject-once' } });
      await settlePermission(ctx, 'reject');
      return;
    }
    // hold：一直不回，等外部决定（I1.1 的外部决定就是 orch cancel）。
  }

  /** 审批应答后的会话状态：allow → thinking，reject → idle。 */
  async function settlePermission(ctx, decision) {
    ctx.normalizer.onPermissionSettled({ sessionId: ctx.sessionId, decision });
    const to = decision === 'allow' ? 'thinking' : 'idle';
    if (ctx.state.session) {
      const from = ctx.state.session.state;
      // reject 的迟到帧必须立刻丢弃，否则会话会被翻回 tool_running。
      if (decision !== 'allow') {
        ctx.quiescing = true;
        ctx.state.session.quarantined = true;
      }
      ctx.state.session.state = to;
      ctx.state.session.stateSince = iso();
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
  }

  /** 单条 session/update：归并会话状态（节流）、判定 accepted、抓 artifactRef。 */
  function handleUpdate(ctx, update) {
    const { state, normalizer, tracker, sessionId } = ctx;
    if (!state.session) return;
    const name = update?.sessionUpdate;
    const before = state.session.state;

    const reduced = normalizer.reduce(state.session, update, {
      sessionId,
      turnId: state.session.turnId,
      toolName: state.session.toolName,
    });

    // 每条 update 都刷新 lastEventAt（节流只针对事件与 save，不针对该字段）
    state.session.lastEventAt = iso();

    const pendingEvents = [];
    if (!reduced.dropped) {
      if (reduced.state !== before) {
        pendingEvents.push({
          object: 'session',
          objectId: sessionId,
          from: before,
          to: reduced.state,
          result: 'applied',
          reason: 'session.state',
          detail: { event: typeof name === 'string' ? name : null },
        });
        state.session.state = reduced.state;
        state.session.stateSince = iso();
      }
      if (reduced.state === 'tool_running') {
        state.session.toolName = reduced.toolName ?? state.session.toolName ?? null;
      } else {
        state.session.toolName = null;
      }
    }

    if (name === 'tool_call') {
      if (typeof update?.title === 'string' && update.title.trim()) {
        state.session.toolName = update.title.trim();
      }
      const filePath = update?.rawInput?.file_path;
      if (typeof filePath === 'string' && filePath.length > 0) {
        state.session.artifactRef = filePath;
        if (!ctx.observedRefs.includes(filePath)) ctx.observedRefs.push(filePath);
      }
    }

    tracker.observeTurnEvent({ name, atMs: now() });
    const handoffEvents = ctx.handoffEmits.splice(0);
    state.handoff = handoffToState(tracker.snapshot());
    state.session.quarantined = Boolean(normalizer.getSession(sessionId)?.quarantined);

    if (pendingEvents.length === 0 && handoffEvents.length === 0) return;
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
      await saveLive(ctx);
    });
  }

  /**
   * 失败收尾统一把会话拉回 idle（BR-12 / AC-21）：不允许 thinking / tool_running /
   * waiting_input 跨到终态之后。quiescing 之后的迟到帧一律丢弃。
   */
  async function quiesceSession(ctx, reason) {
    ctx.quiescing = true;
    if (!ctx.state.session) return;
    try {
      ctx.normalizer.onCancelled(ctx.sessionId);
    } catch {
      // 归一化器异常不影响收尾
    }
    const from = ctx.state.session.state;
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
    ctx.state.session.state = 'idle';
    ctx.state.session.stateSince = iso();
    ctx.state.session.toolName = null;
    ctx.state.session.pendingPermission = null;
    ctx.state.session.quarantined = true;
  }

  /** 第 8~9 步：turn 结束 → 会话等待下游 → 节点待校验 → 产出核对 → 收敛。 */
  async function finishRun(ctx) {
    const { instanceId, nodeId, sessionId, state } = ctx;
    let prompted = null;
    try {
      prompted = await ctx.promptPromise;
    } catch (error) {
      prompted = { ok: false, error: { code: 'UNKNOWN_ERROR', message: String(error?.message ?? error) } };
    }
    // 等待所有 update 派生的事件/快照落盘；单条失败不阻断收尾裁决
    await ctx.chain.catch(() => {});

    if (ctx.cancelled) {
      await cleanup(ctx);
      return { ok: true, instanceId, nodeId, sessionId, cancelled: true, snapshot: snapshotOf(state) };
    }

    // 失败判定只认 JSON-RPC error 与核对不通过（stopReason 不判失败）
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
          params: { step: ctx.permission?.action ?? state.session?.toolName ?? 'unknown-tool' },
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

    const transition = makeTransitioner(ctx.emit, instanceId, state);

    // 会话 → waiting_dependency（onOutputSubmitted）；节点 running → review
    ctx.normalizer.onOutputSubmitted(sessionId);
    const sessionFrom = state.session.state;
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
      state.session.state = 'waiting_dependency';
      state.session.stateSince = iso();
    }
    await transition('node', 'review', 'output.submitted');
    await saveLive(ctx);

    // 9) 产出核对
    const declared = extractDeclaredArtifacts(state.task ?? '');
    const verified = await verify({ cwd: state.cwd, declared, observedRefs: ctx.observedRefs });
    state.artifactRefs = (verified.refs ?? []).map((ref) => ({ ...ref, verifiedAt: iso() }));

    if (verified.note === 'NO_DECLARATION') {
      // 需求 2.4 边界说明：未声明产出 → 跳过存在性检查，但必须留痕
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
      // 交接包 accepted → consumed（仅核对通过后，X3 取需求口径）
      if (state.handoff?.state === 'accepted') {
        ctx.tracker.consumed({ atMs: now() });
        state.handoff = handoffToState(ctx.tracker.snapshot());
        await flushHandoff(ctx);
      }
      const completed = await transition('instance', 'completed', 'run.completed');
      if (!completed.ok) {
        // 磁盘上的实例已不是 running（例如被外部判成 interrupted）：拒绝表外迁移后
        // 不把内存里的 running 当成成功落盘，会话同样回到 idle。
        ctx.state.node.endedAt = iso();
        await quiesceSession(ctx, 'run.failed');
        await saveLive(ctx);
        await cleanup(ctx);
        return fail(completed.code ?? 'ILLEGAL_TRANSITION', {
          from: completed.from ?? null,
          to: 'completed',
        });
      }
      await quiesceSession(ctx, 'run.completed');
      state.node.endedAt = iso();
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

    // 核对不通过：节点 review → failed、实例 → failed；交接包停在 accepted（AC-21）
    const failure = verified.failure ?? { code: 'MISSING', ref: null, message: '产出核对未通过' };
    state.node.failure = { code: failure.code, ref: failure.ref ?? null, message: failure.message };
    state.node.endedAt = iso();
    await transition('node', 'failed', 'verification.failed', {
      code: failure.code,
      ref: failure.ref ?? null,
      message: failure.message,
    });
    await transition('instance', 'failed', 'verification.failed');
    // 交接包按 F-4 停在 accepted，但必须留痕（S-3：失败实例上不挂“干净”的已接受）。
    if (state.handoff) state.handoff.note = 'verification_failed';
    await quiesceSession(ctx, 'run.failed');
    await saveLive(ctx);
    await cleanup(ctx);
    return fail(CODES.VERIFY_FAILED, { reason: failure.message });
  }

  async function finishPromptError(ctx, classified, rawMessage, rawCode) {
    const { instanceId, state } = ctx;
    const code = classified?.code ?? CODES.UNKNOWN_ERROR;
    const params = { ...(classified?.params ?? {}) };

    // 失败收尾一开始就停止接受迟到帧，避免会话被翻回执行中。
    ctx.quiescing = true;

    if (code === CODES.HOST_ERROR || code === CODES.UNKNOWN_ERROR) {
      // 宿主原文不吞、不改写、不截断（BR-12）
      state.hostRaw = state.hostRaw ?? {};
      state.hostRaw.lastError = {
        code: rawCode ?? null,
        message: rawMessage ?? params.raw ?? '',
        at: iso(),
      };
      params.raw = rawMessage ?? params.raw ?? '';
    }
    if (code === CODES.PERMISSION_DENIED) {
      // step 必须可读：tool_call.title（write 之类）> toolCallId > unknown-tool
      const step = ctx.permission?.action ?? state.session?.toolName ?? 'unknown-tool';
      params.step = typeof step === 'string' && step.length > 0 ? step : 'unknown-tool';
    }
    state.node.failure = { code, message: params.raw ?? params.step ?? code };

    const transition = makeTransitioner(ctx.emit, instanceId, state);
    await transition('node', 'failed', 'run.failed', { code, message: params.raw ?? params.step ?? null });
    await transition('instance', 'failed', 'run.failed');
    state.node.endedAt = iso();

    // 交接包：目标拒绝 / 审批被拒 → rejected；NODE_BUSY 保持原状态
    const rejectReason =
      code === CODES.PERMISSION_DENIED
        ? 'permission_denied'
        : code === CODES.NODE_BUSY
          ? null
          : 'target_rejected';
    if (rejectReason) {
      const rejected = ctx.tracker.rejected({ reason: rejectReason, atMs: now() });
      if (rejected.ok) {
        state.handoff = handoffToState(ctx.tracker.snapshot());
        await flushHandoff(ctx);
      }
    }

    // 会话必须收敛到 idle：失败实例不允许配“会话执行中”（BR-12 / AC-21）。
    await quiesceSession(ctx, code === CODES.PERMISSION_DENIED ? 'permission.denied' : 'run.failed');
    await saveLive(ctx);
    await cleanup(ctx);
    return fail(code, params);
  }

  async function cleanup(ctx) {
    if (ctx.finished) return;
    ctx.finished = true;
    activeRuns.delete(ctx.instanceId);
    try {
      await ctx.chain;
    } catch {
      // 收尾链路的异常不改变已落盘结果
    }
    if (ctx.adapter) {
      adapters.delete(ctx.adapter);
      try {
        await ctx.adapter.dispose();
      } catch {
        // dispose 失败不影响终态
      }
    }
  }

  /**
   * 后台收尾保护：finishRun 之外的意外异常只落终态 + 记事件，绝不向调用方抛。
   * （早返回模式里这些异常发生在没人 await 的后台链路，抛出去会杀核心进程。）
   */
  async function failRunUnexpected(ctx, error) {
    const message = error?.message ?? String(error ?? '未知错误');
    try {
      if (!ctx.finished) {
        const transition = makeTransitioner(ctx.emit, ctx.instanceId, ctx.state);
        const nodeState = ctx.state.node?.state;
        ctx.state.node.failure = { code: CODES.HOST_ERROR, message };
        if (nodeState === 'pending') await transition('node', 'running', 'run.failed');
        if (nodeState !== 'failed' && nodeState !== 'done' && nodeState !== 'cancelled') {
          await transition('node', 'failed', 'run.failed', { code: CODES.HOST_ERROR, message });
        }
        if (ctx.state.state !== 'failed') {
          await transition('instance', 'failed', 'run.failed');
        }
        ctx.state.node.endedAt = iso();
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
    return fail(CODES.HOST_ERROR, { raw: message });
  }

  /** 驱动一次 run 到终态，并把结果交给 waitForRun 的等待者。 */
  async function driveRun(ctx) {
    let resolveWaiter = null;
    const waited = new Promise((resolve) => {
      resolveWaiter = resolve;
    });
    runWaiters.set(ctx.instanceId, { promise: waited, resolve: resolveWaiter });

    let outcome;
    try {
      outcome = await finishRun(ctx);
    } catch (error) {
      outcome = await failRunUnexpected(ctx, error);
    }
    resolveWaiter(outcome);
    if (runWaiters.get(ctx.instanceId)?.resolve === resolveWaiter) {
      runWaiters.delete(ctx.instanceId);
    }
    return outcome;
  }

  /** 早返回：会话已建立、交接包已投递，后续推进交给后台。 */
  function earlyResult(ctx) {
    driveRun(ctx).catch(() => {});
    return {
      ok: true,
      instanceId: ctx.instanceId,
      nodeId: ctx.nodeId,
      sessionId: ctx.sessionId,
    };
  }

  /**
   * 发起一次单节点任务。
   *
   * `earlyReturn=false`（默认）时行为与旧实现完全一致：resolve 即终态快照。
   * `earlyReturn=true` 时在会话建立 + 交接包 delivered 后立即返回
   * `{ok:true, instanceId, nodeId, sessionId}`，turn 与产出核对在后台继续。
   *
   * 返回：{ok:true, instanceId, nodeId, sessionId, ...} 或 {ok:false, code, params}。
   */
  async function startRun({
    cwd,
    task,
    instanceId = null,
    hostId = DEFAULT_HOST_ID,
    onProgress,
    earlyReturn = false,
  } = {}) {
    if (typeof cwd !== 'string' || cwd.length === 0) {
      return fail(CODES.CWD_NOT_WRITABLE, { path: String(cwd ?? '') });
    }
    if (typeof task !== 'string' || task.trim().length === 0) {
      return fail(CODES.UNKNOWN_ERROR, { raw: '任务描述为空' });
    }

    if (instanceId) {
      // 快速拒绝：运行中的实例不再进入锁，避免把 NODE_BUSY 变成“排队等前一次跑完”
      if (activeRuns.has(instanceId)) return fail(CODES.NODE_BUSY, {});
      const claimed = await withLock(instanceId, () =>
        claimRun({ cwd, task, instanceId, hostId, onProgress }),
      );
      if (!claimed.ok) return claimed.result;
      return earlyReturn ? earlyResult(claimed.ctx) : driveRun(claimed.ctx);
    }

    const allocated = await withLock('@allocate', async () => {
      const id = await allocateInstanceId();
      // 分配与占位放在同一临界区，避免两个并发请求看到同一个 max（S-10）。
      reserved.add(id);
      return id;
    });
    try {
      const claimed = await withLock(allocated, () =>
        claimRun({ cwd, task, instanceId: allocated, hostId, onProgress }),
      );
      if (!claimed.ok) return claimed.result;
      return earlyReturn ? earlyResult(claimed.ctx) : driveRun(claimed.ctx);
    } finally {
      reserved.delete(allocated);
    }
  }

  /**
   * 等待某个实例的 run 到终态（不轮询）。
   * - 已终态 → 立刻返回当前快照；
   * - 运行中 → 挂起，终态出现后返回；
   * - 不认识的实例 → NOT_RUNNING；超时 → WAIT_TIMEOUT（不改变任何状态）。
   */
  async function waitForRun({ instanceId, timeoutMs = 120_000 } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_RUNNING', { instanceId: instanceId ?? null });
    }
    const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000;
    const waiter = runWaiters.get(instanceId);

    if (!waiter) {
      const loaded = await store.load(instanceId);
      if (!loaded.ok) return fail('NOT_RUNNING', { instanceId });
      if (!TERMINAL_INSTANCE.has(loaded.state.state)) return fail('NOT_RUNNING', { instanceId });
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

    const status = await getStatus({ instanceId });
    if (status.ok) return { ok: true, snapshot: status.snapshot };
    return { ok: true, snapshot: outcome?.snapshot ?? null };
  }

  /** 取消：先发 best-effort 通知（1s 超时），随后**立即**落终态，不等宿主确认。 */
  async function cancel({ instanceId } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return fail('NOT_FOUND', { instanceId: instanceId ?? null });
    }
    const live = activeRuns.get(instanceId);
    if (live && !live.finished) return cancelLive(live);

    const loaded = await store.load(instanceId);
    if (!loaded.ok) {
      if (loaded.code === 'STATE_CORRUPT') {
        return { ok: false, code: 'STATE_CORRUPT', backupPath: loaded.backupPath, params: loaded.params };
      }
      return fail(loaded.code === 'NOT_FOUND' ? 'NOT_FOUND' : loaded.code, loaded.params ?? {});
    }
    const state = loaded.state;
    if (TERMINAL_INSTANCE.has(state.state)) {
      return fail(CODES.INSTANCE_TERMINAL, { state: state.state });
    }
    const emit = makeEmitter(instanceId, null);
    return applyCancel(instanceId, state, emit, null);
  }

  async function cancelLive(ctx) {
    ctx.cancelled = true;
    // 取消一旦开始，宿主补发的 tool_call/update 不得再把会话翻回执行中。
    ctx.quiescing = true;
    // hold 中的审批请求先明确回 cancelled，再走取消收尾（AC-17 / F-1）。
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
    return applyCancel(ctx.instanceId, ctx.state, ctx.emit, ctx);
  }

  async function applyCancel(instanceId, state, emit, ctx) {
    const at = iso();

    // 会话 → idle（进 quarantine，迟到帧被隔离）
    if (state.session) {
      if (ctx?.normalizer) ctx.normalizer.onCancelled(state.session.sessionId);
      const from = state.session.state;
      if (from !== 'idle') {
        await emit({
          object: 'session',
          objectId: state.session.sessionId,
          from,
          to: 'idle',
          result: 'applied',
          reason: 'run.cancelled',
          detail: null,
        });
      }
      state.session.state = 'idle';
      state.session.stateSince = at;
      state.session.toolName = null;
      state.session.quarantined = true;
    }

    // 节点 → cancelled；review 状态在迁移表里没有 →cancelled，按 review→failed 收口，
    // 不让节点成为“实例已取消、节点还挂着待校验”的孤儿（S-8）。
    if (state.node && state.node.state === 'review') {
      state.node.note = 'cancelled_in_review';
      await transit(instanceId, 'node', 'failed', {
        emit,
        state,
        reason: 'run.cancelled',
        detail: { note: 'cancelled_in_review' },
      });
      state.node.endedAt = iso();
    } else if (state.node && ACTIVE_NODE.has(state.node.state)) {
      await transit(instanceId, 'node', 'cancelled', { emit, state, reason: 'run.cancelled', detail: null });
      state.node.endedAt = iso();
    }

    // 交接包 → rejected（withdrawn：显示“已撤回”，不得与目标拒绝混读）
    if (state.handoff && (state.handoff.state === 'delivered' || state.handoff.state === 'accepted')) {
      if (ctx?.tracker) {
        ctx.tracker.rejected({ reason: 'withdrawn', atMs: now() });
        state.handoff = handoffToState(ctx.tracker.snapshot());
        await flushHandoff(ctx);
      } else {
        await transit(instanceId, 'handoff', 'rejected', {
          emit,
          state,
          reason: 'handoff.rejected',
          detail: { reason: 'withdrawn' },
        });
        state.handoff.rejectReason = 'withdrawn';
        state.handoff.rejectedAt = at;
      }
    }

    // 实例 → cancelled
    if (state.state !== 'cancelled') {
      await transit(instanceId, 'instance', 'cancelled', {
        emit,
        state,
        reason: 'run.cancelled',
        detail: null,
      });
    }

    await saveState(instanceId, state, { expectedState: state.state });
    if (ctx) await cleanup(ctx);
    return {
      ok: true,
      session: state.session,
      node: state.node,
      handoff: state.handoff,
    };
  }

  function snapshotOf(state) {
    const at = now();
    const since = Date.parse(state?.stateSince ?? state?.createdAt ?? '') || at;
    const snapshot = { ...state };
    snapshot.elapsedMs = Math.max(0, at - since);

    const session = state?.session;
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

    const handoff = state?.handoff;
    snapshot.handoffWaitMs =
      handoff && handoff.state === 'delivered' && handoff.deliveredAt
        ? Math.max(0, at - (Date.parse(handoff.deliveredAt) || at))
        : null;

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
    // 运行中的实例优先用内存状态（含尚未落盘的 lastEventAt）
    const live = activeRuns.get(instanceId);
    return { ok: true, snapshot: snapshotOf(live ? live.state : loaded.state) };
  }

  function listInstances() {
    return store.list();
  }

  /**
   * 启动对账：只判“上次中断”，不重跑、不重连（BR-11 / AC-12）。
   * 节点与交接包保持原状态，只附 note 说明停在哪一步。
   */
  async function reconcileOnBoot({ generation: current } = {}) {
    const currentGeneration = current ?? generation;
    const listed = await store.list();
    const interrupted = [];
    for (const item of listed?.items ?? []) {
      if (!item?.readable) continue;
      if (item.state !== 'created' && item.state !== 'running') continue;
      const loaded = await store.load(item.instanceId);
      if (!loaded.ok) continue;
      if (loaded.state.coreGeneration === currentGeneration) continue;
      await markInterrupted(loaded.state, 'core.gone');
      interrupted.push(item.instanceId);
    }
    return { ok: true, interrupted };
  }

  /** core.stop：把所有非终态实例判“已中断”，reason 固定 core.stop。 */
  async function interruptAll({ reason = 'core.stop' } = {}) {
    const listed = await store.list();
    const interrupted = [];
    for (const item of listed?.items ?? []) {
      if (!item?.readable) continue;
      if (TERMINAL_INSTANCE.has(item.state)) continue;
      const loaded = await store.load(item.instanceId);
      if (!loaded.ok) continue;
      await markInterrupted(loaded.state, reason);
      interrupted.push(item.instanceId);
    }
    return { ok: true, interrupted };
  }

  async function markInterrupted(state, reason) {
    const emit = makeEmitter(state.instanceId, null);
    const nodeState = state.node?.state ?? null;
    const sessionState = state.session?.state ?? null;
    const note = `停在节点 ${nodeState ?? '-'} / 会话 ${sessionState ?? '-'}`;

    if (state.state !== 'running' && state.state !== 'created') {
      return { ok: false, code: 'ILLEGAL_TRANSITION', from: state.state, to: 'interrupted' };
    }
    // 先写 note，再走唯一迁移入口落盘（transit 会一并保存内存快照）。
    if (state.node) state.node.note = `stopped at node ${nodeState ?? '-'} / session ${sessionState ?? '-'}`;
    if (state.handoff) state.handoff.note = `stopped at handoff ${state.handoff.state}`;

    // created 是“已落盘但未开跑”的极端情形：迁移表没有 created→interrupted，
    // 先按 created→running 补齐事实，再判 interrupted（不新增表外迁移）。
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

  async function dispose() {
    const list = [...adapters];
    adapters.clear();
    for (const ctx of [...activeRuns.values()]) {
      ctx.cancelled = true;
      ctx.finished = true;
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

  return {
    startRun,
    waitForRun,
    cancel,
    getStatus,
    listInstances,
    reconcileOnBoot,
    interruptAll,
    dispose,
  };
}
