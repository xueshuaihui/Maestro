/**
 * 核心侧管道服务端：监听命名管道、路由方法、把异常一律转成错误帧（§1.3 / §2.13）。
 *
 * 三条不可动摇的纪律：
 * 1. 任何未捕获异常都不得杀掉核心。方法处理器的异常 → `{ok:false, code, params}` 帧；
 *    进程级 `uncaughtException` / `unhandledRejection` 只写 `.orch/core.log`，不退出。
 * 2. 核心日志只写 `.orch/core.log`，绝不 console.log 到继承来的终端（`stdio:'ignore'` 前提）。
 * 3. `core.stop` 先回包再退出；优雅退出有 5s 上限，超时也退并记 `CORE_STOP_TIMEOUT`。
 */
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import {
  coreLogPath,
  coreMetaPath,
  ensureLayout,
  isWindows,
  pipeName as defaultPipeName,
} from '../persistence/paths.js';
import { writeJsonAtomic } from '../persistence/atomic-write.js';
import { createStore } from '../persistence/instance-store.js';
import { createEventBus } from '../core/event-bus.js';
import * as traceLog from '../core/trace.js';
import { createFrameDecoder, encodeFrame, validateFrame } from './ipc-frames.js';

/** 核心协议版本（写进 `core.json` 与 `core.ping`，不是产品版本号）。 */
const CORE_SCHEMA_VERSION = 1;

const DEFAULT_STOP_TIMEOUT_MS = 5000;

const PACKAGE_VERSION = readPackageVersion();

function readPackageVersion() {
  try {
    const require = createRequire(import.meta.url);
    return require('../../package.json')?.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export function createServer({
  root,
  orchestrator,
  bus,
  generation,
  pipeName,
  logger,
  clock,
  exitOnStop = true,
} = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('createServer: root 必填');
  }
  if (!orchestrator || typeof orchestrator !== 'object') {
    throw new TypeError('createServer: orchestrator 必填（可用注入的假实现）');
  }

  const pipe = pipeName ?? defaultPipeName(root);
  const gen = generation ?? `gen-${randomHex(8)}`;
  const now = () => new Date(typeof clock === 'function' ? clock() : Date.now()).toISOString();
  const startedAt = now();
  const log = normalizeLogger(logger, root);

  // bus 可省略：省略时用 WP-1 的 store + 总线自建，便于 serve-entry 直接挂载。
  const activeBus = bus ?? createEventBus({ store: createStore({ root }) });
  if (!activeBus || typeof activeBus.subscribe !== 'function') {
    throw new TypeError('createServer: bus 必须实现 subscribe');
  }
  // Read-only store for `instance.trace`: it never writes state and never enters the
  // health write path that `instance.get` owns.
  const traceStore = createStore({ root });

  /** @type {Set<{socket: net.Socket, decoder: ReturnType<typeof createFrameDecoder>, unsubscribes: Set<Function>}>} */
  const connections = new Set();
  const sockets = new Set();

  let server = null;
  let listening = false;
  let closing = null;
  let stopTimer = null;

  // boot 对账结果（AC-12 的关键路径），`core.ping` 回显 interrupted 数量。
  const boot = { attempted: false, ok: false, interrupted: [], code: null, error: null };

  const methods = {
    'core.ping': async () => ({
      ok: true,
      result: {
        generation: gen,
        pid: process.pid,
        startedAt,
        version: PACKAGE_VERSION,
        schemaVersion: CORE_SCHEMA_VERSION,
        interrupted: boot.interrupted.length,
        boot: { ok: boot.ok, code: boot.code },
        // 现有字段保持不变，只追加“当前编排器是真实现还是降级桩”。
        mode: typeof orchestrator.mode === 'string' ? orchestrator.mode : orchestrator.isStub ? 'stub' : 'real',
      },
    }),

    'core.info': async () => ({
      ok: true,
      result: {
        root,
        pipeName: pipe,
        generation: gen,
        pid: process.pid,
        startedAt,
        version: PACKAGE_VERSION,
        dsh: typeof orchestrator.info === 'function' ? safeCall(() => orchestrator.info()) : null,
        limits: typeof orchestrator.limits === 'object' && orchestrator.limits !== null ? orchestrator.limits : {},
        interrupted: boot.interrupted.slice(),
      },
    }),

    'core.stop': async (_params, ctx) => {
      // 先回包，再做任何收尾动作；否则客户端会先看到连接断而不是 res。
      const payload = { pid: process.pid };
      ctx.respond(payload);
      scheduleShutdown('core.stop');
      return SKIP_RESPONSE;
    },

    'run.start': async (params) => {
      const cwd = typeof params?.cwd === 'string' && params.cwd.length > 0 ? params.cwd : root;
      const task = params?.task;
      if (typeof task !== 'string' || task.length === 0) {
        return { ok: false, code: 'IPC_BAD_PARAMS', params: { field: 'task' } };
      }

      // D-5.2 / G9: `run --approval <policy>` overrides the host policy. Validate
      // the value at the IPC boundary (never build Chinese here), then hand it to
      // the orchestrator. Absent -> keep whatever the host config resolved.
      const approvalPolicy = params?.approvalPolicy;
      if (approvalPolicy !== undefined && approvalPolicy !== null) {
        if (!['allow', 'reject', 'hold'].includes(approvalPolicy)) {
          return { ok: false, code: 'IPC_BAD_PARAMS', params: { field: 'approvalPolicy' } };
        }
        if (typeof orchestrator.setApprovalPolicy === 'function') {
          orchestrator.setApprovalPolicy(approvalPolicy);
        }
      }

      // 早返回契约：orchestrator.startRun 必须在会话建立后立即 resolve，
      // 之后的进展通过返回的 `stream`（遍历后转 bus）或它自己往 bus 里 emit 推进。
      // 白名单固定为 `{cwd,task,earlyReturn,instanceId,hostId,template}`：`template`
      // 以前被静默丢弃（C-05），现在全链路透传。`approvalPolicy` 按 D-5.2 追加。
      const started = await withProgress(orchestrator, {
        cwd: path.resolve(cwd),
        task,
        // 早返回：会话建立 + 任务投递后立刻 resolve，turn 与产出核对在后台继续。
        earlyReturn: true,
        ...(params?.instanceId ? { instanceId: params.instanceId } : {}),
        ...(typeof params?.hostId === 'string' ? { hostId: params.hostId } : {}),
        ...(typeof params?.template === 'string' ? { template: params.template } : {}),
        ...(typeof approvalPolicy === 'string' ? { approvalPolicy } : {}),
      });

      if (!started || started.ok !== true) {
        return {
          ok: false,
          code: started?.code ?? 'UNKNOWN_ERROR',
          params: started?.params,
        };
      }

      const instanceId = started.instanceId;
      const stream = started.stream;
      if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        drainStream(stream, instanceId);
      }
      return {
        ok: true,
        result: {
          instanceId,
          nodeId: started.nodeId ?? null,
          sessionId: started.sessionId ?? null,
          // 首派就失败时（I1.3 / AC-42）核心已经把实例收成挂起，终局快照随早返回一起给，
          // CLI 才能按 A-3 直接收尾而不是打出一条与事实相反的「运行中」。
          ...(started.snapshot ? { snapshot: started.snapshot } : {}),
        },
      };
    },

    'run.wait': async (params) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      if (typeof orchestrator.waitForRun !== 'function') {
        return { ok: false, code: 'NOT_RUNNING', params: { instanceId: instanceId.value } };
      }
      const timeoutMs = Number.isFinite(params?.timeoutMs) && params.timeoutMs > 0 ? params.timeoutMs : undefined;
      const res = await orchestrator.waitForRun({
        instanceId: instanceId.value,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });
      if (!res || res.ok !== true) {
        return { ok: false, code: res?.code ?? 'UNKNOWN_ERROR', params: res?.params };
      }
      return { ok: true, result: res.snapshot ?? res.result ?? res };
    },

    'instance.get': async (params) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      const res = await orchestrator.getStatus({ instanceId: instanceId.value });
      if (!res || res.ok !== true) {
        // `getStatus` 把 STATE_CORRUPT 的备份路径放在顶层（AC-13）。丢掉它，CLI 就只能现算。
        const backupPath = typeof res?.backupPath === 'string' && res.backupPath.length > 0 ? res.backupPath : null;
        return {
          ok: false,
          code: res?.code ?? 'NOT_FOUND',
          params: backupPath === null ? res?.params : { ...(res?.params ?? {}), backupPath },
        };
      }
      return { ok: true, result: shapeSnapshot(res.snapshot ?? res.result ?? res) };
    },

    'instance.list': async () => {
      const res = await orchestrator.listInstances();
      if (!res || res.ok !== true) {
        return { ok: false, code: res?.code ?? 'STORE_READ_FAILED', params: res?.params };
      }
      return { ok: true, result: { items: res.items ?? [] } };
    },

    'instance.events': async (params) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      const sinceSeq = Number.isInteger(params?.sinceSeq) ? params.sinceSeq : null;
      const events = await activeBus.replay(instanceId.value);
      const filtered = sinceSeq === null ? events : events.filter((ev) => Number.isInteger(ev?.seq) && ev.seq > sinceSeq);
      // `replay` keeps the array shape; `badLines` is a non-enumerable property that
      // IPC serialization would drop, so expose it explicitly on the result (D-6).
      const badLines = Number.isInteger(events.badLines) && events.badLines > 0 ? events.badLines : 0;
      return { ok: true, result: { events: filtered, badLines } };
    },

    // Read-only trace view: landed spans from disk plus in-memory running overlays.
    // It never writes a file, never emits, and never recomputes health.
    'instance.trace': async (params) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      const loaded = await traceStore.load(instanceId.value);
      if (!loaded || loaded.ok !== true) {
        const backupPath = typeof loaded?.backupPath === 'string' && loaded.backupPath.length > 0
          ? loaded.backupPath
          : null;
        return {
          ok: false,
          code: loaded?.code ?? 'NOT_FOUND',
          params: backupPath === null ? loaded?.params : { ...(loaded?.params ?? {}), backupPath },
        };
      }
      const state = loaded.state ?? {};
      const read = await traceLog.readTraces(root, instanceId.value);
      const landed = Array.isArray(read.spans) ? read.spans : [];
      // D-19: the snapshot id is authoritative; older instances fall back to the
      // first landed span, then to null (A-1 shows no id).
      const stored = typeof state.traceId === 'string' && state.traceId.length > 0 ? state.traceId : null;
      const first = landed.length > 0 ? landed[0]?.trace_id : null;
      const traceId = stored ?? (typeof first === 'string' && first.length > 0 ? first : null);
      // D-23: an older instance with no id and no landed span has no legal header
      // (A-1 / A-10 are the only shapes); drop the running overlay and fall to A-1.
      const noTrace = stored === null && landed.length === 0;
      const spans = noTrace ? [] : [...landed, ...traceLog.overlayRunningSpans(state, landed)];
      return {
        ok: true,
        result: {
          traceId,
          spans,
          badLines: Number.isInteger(read.badLines) && read.badLines > 0 ? read.badLines : 0,
          // Minimal read-only projection so the CLI can derive handoff ids and title
          // columns without touching the health write path.
          view: {
            instanceId: instanceId.value,
            template: typeof state.template === 'string' ? state.template : null,
            nodes: Array.isArray(state.nodes) ? state.nodes : [],
            handoffs: Array.isArray(state.handoffs) ? state.handoffs : [],
          },
        },
      };
    },

    'instance.cancel': async (params) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      const res = await orchestrator.cancel({ instanceId: instanceId.value });
      if (!res || res.ok !== true) {
        return { ok: false, code: res?.code ?? 'UNKNOWN_ERROR', params: res?.params };
      }
      // C-05：结果原样透传 `{nodes,sessions,handoffs,escalations}`，IPC 层不重建单对象。
      // v1 兼容：orchestrator 仍返回 `{session,node,handoff}` 时按原键透传。
      const { ok: _ok, ...result } = res;
      return { ok: true, result };
    },

    'instance.subscribe': async (params, ctx) => {
      const instanceId = requireInstanceId(params);
      if (!instanceId.ok) return instanceId;
      ctx.subscribe(instanceId.value);
      return { ok: true, result: { stream: `instance:${instanceId.value}` } };
    },
  };

  // ---------------------------------------------------------------- WP-6 生命周期 RPC
  // §2.18: 参数在边界校验（不拼中文），语义错误码（*_NOT_FOUND / *_NOT_PENDING /
  // *_AMBIGUOUS / *_INVALID …）由编排层给出，IPC 原样透传。
  const lifecycle = (method, required) => async (params) => {
    for (const field of required) {
      if (typeof params?.[field] !== 'string' || params[field].length === 0) {
        return { ok: false, code: 'IPC_BAD_PARAMS', params: { field } };
      }
    }
    if (typeof orchestrator[method] !== 'function') {
      return { ok: false, code: 'IPC_BAD_METHOD', params: { method } };
    }
    const res = await orchestrator[method](params ?? {});
    if (!res || res.ok !== true) {
      return { ok: false, code: res?.code ?? 'UNKNOWN_ERROR', params: res?.params ?? {} };
    }
    return { ok: true, result: res };
  };

  methods['escalation.resolve'] = lifecycle('resolveEscalation', ['escalationId', 'decision']);
  methods['approval.list'] = lifecycle('listApprovals', []);
  methods['approval.resolve'] = lifecycle('resolveApproval', ['approvalId', 'decision']);
  methods['workflow.pause'] = lifecycle('pause', ['instanceId']);
  methods['workflow.resume'] = lifecycle('resume', ['instanceId']);
  methods['workflow.abort'] = lifecycle('abort', ['instanceId']);
  methods['session.locate'] = lifecycle('locateSession', ['sessionId']);

  // 仅 test 接缝（§1.8 / M-14 / D-10）：生产进程的 methods 表里没有这些键。
  // 非 test 环境调用走通用未知方法分支，返回 `{ok:false, code:'IPC_BAD_METHOD'}`。
  if (process.env.NODE_ENV === 'test') {
    if (typeof orchestrator.dispatchToNode === 'function') {
      methods['test.dispatch'] = async (params) =>
        callSeam('test.dispatch', params, () => orchestrator.dispatchToNode(params?.instanceId, params?.nodeId));
    }
    if (typeof orchestrator.escalateOnce === 'function') {
      // D-10 / G10: forward reasonCode / artifactRefs to the escalation seam.
      methods['test.escalate'] = async (params) =>
        callSeam('test.escalate', params, () => orchestrator.escalateOnce(
          params?.instanceId,
          params?.nodeId,
          {
            ...(typeof params?.reasonCode === 'string' ? { reasonCode: params.reasonCode } : {}),
            ...(Array.isArray(params?.artifactRefs) ? { artifactRefs: params.artifactRefs } : {}),
          },
        ));
    }
    if (typeof orchestrator.seamHandoff === 'function') {
      methods['test.handoff'] = async (params) =>
        testSeam('test.handoff', params, ['instanceId', 'nodeId', 'mutate'],
          () => orchestrator.seamHandoff(params));
    }
    if (typeof orchestrator.holdDelivery === 'function') {
      methods['test.delivery'] = async (params) =>
        testSeam('test.delivery', params, ['instanceId', 'action'],
          () => orchestrator.holdDelivery({ instanceId: params?.instanceId, action: params?.action }));
    }
    if (typeof orchestrator.whenDeliveryHeld === 'function') {
      methods['test.delivery.whenHeld'] = async () => {
        await orchestrator.whenDeliveryHeld();
        return { ok: true, result: { held: true } };
      };
    }
  }

  // ---------------------------------------------------------------- 生命周期

  async function listen() {
    await ensureLayout(root);
    installProcessGuards();

    server = net.createServer({ allowHalfOpen: false }, (socket) => acceptConnection(socket));

    const first = await listenOnce();
    if (!first.ok) {
      if (first.error?.code === 'EADDRINUSE' || first.error?.code === 'EEXIST') {
        const occupied = await probeAlive();
        if (occupied) {
          await log('warn', 'CORE_ALREADY_RUNNING', { pipeName: pipe });
          return { ok: false, code: 'CORE_ALREADY_RUNNING', params: { pipeName: pipe } };
        }
        // Windows 命名管道没有文件残留；POSIX 兜底需要先删掉旧 socket 文件再重试一次。
        if (!isWindows) {
          await fs.unlink(pipe).catch(() => {});
        }
        const retry = await listenOnce();
        if (!retry.ok) {
          await log('error', 'CORE_LISTEN_FAILED', { pipeName: pipe, cause: retry.error?.message ?? null });
          return { ok: false, code: 'CORE_START_FAILED', params: { pipeName: pipe, cause: retry.error?.message ?? null } };
        }
      } else {
        await log('error', 'CORE_LISTEN_FAILED', { pipeName: pipe, cause: first.error?.message ?? null });
        return { ok: false, code: 'CORE_START_FAILED', params: { pipeName: pipe, cause: first.error?.message ?? null } };
      }
    }

    listening = true;
    // 只有确认自己拥有这条管道之后才对账：否则第二个核心会在 EADDRINUSE 之前
    // 把第一个核心正在跑的实例误判成“已中断”（B-2）。CORE_ALREADY_RUNNING
    // 分支在上面已经 return，零副作用。
    await reconcileOnBoot();
    // `.orch/core.json` 只用于诊断 / `core stop` 超时提示；客户端禁止据此决定连接地址。
    await writeJsonAtomic(coreMetaPath(root), {
      version: CORE_SCHEMA_VERSION,
      pipeName: pipe,
      pid: process.pid,
      generation: gen,
      startedAt,
    });
    await log('info', 'CORE_LISTENING', { pipeName: pipe, generation: gen, pid: process.pid, boot });
    return { ok: true, pipeName: pipe, generation: gen, pid: process.pid, startedAt };
  }

  function listenOnce() {
    return new Promise((resolve) => {
      const onError = (error) => {
        server.off('listening', onListening);
        resolve({ ok: false, error });
      };
      const onListening = () => {
        server.off('error', onError);
        resolve({ ok: true });
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(pipe);
    });
  }

  async function probeAlive() {
    const socket = net.connect(pipe);
    return new Promise((resolve) => {
      const done = (value) => {
        clearTimeout(timer);
        socket.removeAllListeners();
        socket.destroy();
        resolve(value);
      };
      const timer = setTimeout(() => done(false), 500);
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  }

  async function reconcileOnBoot() {
    boot.attempted = true;
    try {
      const res = await orchestrator.reconcileOnBoot({ generation: gen });
      if (res && res.ok === true) {
        boot.ok = true;
        boot.interrupted = Array.isArray(res.interrupted) ? res.interrupted.slice() : [];
      } else {
        boot.ok = false;
        boot.code = res?.code ?? 'UNKNOWN_ERROR';
      }
    } catch (err) {
      boot.ok = false;
      boot.code = err?.code ?? 'UNKNOWN_ERROR';
      boot.error = err?.message ?? String(err);
    }
    await log(boot.ok ? 'info' : 'warn', 'CORE_BOOT_RECONCILE', {
      ok: boot.ok,
      code: boot.code,
      interrupted: boot.interrupted,
      error: boot.error,
    });
  }

  async function close({ mode = 'graceful', timeoutMs = DEFAULT_STOP_TIMEOUT_MS } = {}) {
    if (closing) return closing;
    closing = (async () => {
      const t0 = Date.now();
      const deadline = t0 + timeoutMs;
      let interrupted = [];

      try {
        // 给 interrupt 留出的预算必须小于整个 `core stop` 的 5s 上限，
        // 否则“优雅退出 ≤5s”会被上游一步拖穿。
        const interruptBudget = Math.max(500, timeoutMs - 800);
        const res = await withDeadline(
          Promise.resolve().then(() => orchestrator.interruptAll({ reason: 'core.stop' })),
          interruptBudget,
        );
        if (res && res.ok === true && Array.isArray(res.interrupted)) interrupted = res.interrupted.slice();
      } catch (err) {
        await log('warn', 'CORE_STOP_INTERRUPT_FAILED', { cause: err?.message ?? String(err) });
      }

      // 先掐掉所有连接，再关 accept —— 否则 server.close() 会等客户端主动断开。
      destroyConnections();
      if (server) {
        await new Promise((resolve) => server.close(() => resolve()));
      }

      try {
        if (typeof orchestrator.dispose === 'function') {
          await withDeadline(Promise.resolve().then(() => orchestrator.dispose()), 1000);
        }
      } catch (err) {
        await log('warn', 'CORE_DISPOSE_FAILED', { cause: err?.message ?? String(err) });
      }

      const elapsedMs = Date.now() - t0;
      const timedOut = Date.now() > deadline;
      if (timedOut) await log('error', 'CORE_STOP_TIMEOUT', { mode, elapsedMs, timeoutMs });
      else await log('info', 'CORE_STOPPED', { mode, elapsedMs, interrupted });
      listening = false;
      return { ok: true, interrupted, elapsedMs, timedOut };
    })();
    return closing;
  }

  function scheduleShutdown(reason) {
    if (stopTimer) return;
    // 给 res 帧一个刷出机会：立刻 destroy 会把尚未写出的字节一起丢掉。
    stopTimer = setTimeout(async () => {
      let timedOut = false;
      try {
        const res = await close({ mode: reason, timeoutMs: DEFAULT_STOP_TIMEOUT_MS });
        timedOut = Boolean(res?.timedOut);
      } catch (err) {
        timedOut = true;
        await log('error', 'CORE_STOP_FAILED', { cause: err?.message ?? String(err) });
      }
      if (!timedOut) {
        if (exitOnStop) process.exit(0);
        return;
      }
      // 超时也退（§1.3“超时也要退”），先把原因落到 core.log。
      if (exitOnStop) process.exit(0);
    }, 25);
    // 允许 CLI 进程先断开而不再阻塞测试进程。
    if (typeof stopTimer.unref === 'function') stopTimer.unref();
  }

  function address() {
    return { pipeName: pipe, generation: gen, pid: process.pid, startedAt };
  }

  // ---------------------------------------------------------------- 连接处理

  function acceptConnection(socket) {
    socket.setNoDelay(true);
    const conn = {
      socket,
      decoder: createFrameDecoder(),
      unsubscribes: new Set(),
      subscriptions: new Map(),
    };
    connections.add(conn);
    sockets.add(socket);

    socket.on('data', (chunk) => {
      for (const frame of conn.decoder.push(chunk)) {
        handleFrame(conn, frame).catch(async (err) => {
          await log('error', 'IPC_HANDLER_CRASH', { cause: err?.message ?? String(err) });
          sendFrame(conn, { v: 1, kind: 'res', id: null, ok: false, code: 'IPC_INTERNAL', params: { message: err?.message ?? String(err) } });
        });
      }
    });
    socket.on('error', (err) => {
      log('warn', 'IPC_SOCKET_ERROR', { code: err?.code ?? null, message: err?.message ?? null });
    });
    socket.on('close', () => {
      connections.delete(conn);
      sockets.delete(socket);
      for (const off of conn.unsubscribes) safeCall(off);
      conn.unsubscribes.clear();
      conn.subscriptions.clear();
    });
  }

  async function handleFrame(conn, frame) {
    if (frame?.__error === 'IPC_BAD_FRAME') {
      // 单行坏帧不断连接（与 ACP 行为一致）；记录后继续。
      await log('warn', 'IPC_BAD_FRAME', frame.detail ?? {});
      return;
    }
    if (frame?.__error === 'IPC_FRAME_TOO_LARGE') {
      await log('error', 'IPC_FRAME_TOO_LARGE', { bytes: frame.bytes ?? null });
      conn.socket.destroy();
      return;
    }

    const valid = validateFrame(frame);
    if (!valid.ok) {
      await log('warn', 'IPC_BAD_FRAME', { reason: valid.params?.reason ?? null });
      if (typeof frame?.id === 'string') {
        sendFrame(conn, { v: 1, kind: 'res', id: frame.id, ok: false, code: 'IPC_BAD_FRAME', params: valid.params });
      }
      return;
    }
    if (frame.kind !== 'req') return; // 服务端只消费 req；收到 res/evt 一律忽略。

    const handler = methods[frame.method];
    if (!handler) {
      sendFrame(conn, {
        v: 1,
        kind: 'res',
        id: frame.id,
        ok: false,
        code: 'IPC_BAD_METHOD',
        params: { method: frame.method },
      });
      return;
    }

    let responded = false;
    const ctx = {
      conn,
      respond(payload) {
        if (responded) return;
        responded = true;
        sendFrame(conn, { v: 1, kind: 'res', id: frame.id, ok: true, result: payload });
      },
      subscribe(instanceId) {
        if (conn.subscriptions.has(instanceId)) return;
        const off = activeBus.subscribe(
          (event) => {
            sendFrame(conn, {
              v: 1,
              kind: 'evt',
              stream: `instance:${instanceId}`,
              seq: Number.isInteger(event?.seq) ? event.seq : null,
              event,
            });
          },
          { instanceId },
        );
        conn.subscriptions.set(instanceId, off);
        conn.unsubscribes.add(off);
      },
    };

    try {
      const out = await handler(frame.params ?? {}, ctx);
      if (out === SKIP_RESPONSE) return;
      if (!out || out.ok !== true) {
        if (responded) return;
        responded = true;
        sendFrame(conn, {
          v: 1,
          kind: 'res',
          id: frame.id,
          ok: false,
          code: out?.code ?? 'UNKNOWN_ERROR',
          params: out?.params,
        });
        return;
      }
      if (responded) return;
      responded = true;
      sendFrame(conn, { v: 1, kind: 'res', id: frame.id, ok: true, result: out.result });
    } catch (err) {
      await log('error', 'IPC_HANDLER_FAILED', {
        method: frame.method,
        code: err?.code ?? null,
        message: err?.message ?? String(err),
      });
      if (responded) return;
      responded = true;
      sendFrame(conn, {
        v: 1,
        kind: 'res',
        id: frame.id,
        ok: false,
        code: typeof err?.code === 'string' && /^[A-Z0-9_]+$/.test(err.code) ? err.code : 'IPC_INTERNAL',
        params: { message: err?.message ?? String(err) },
      });
    }
  }

  function sendFrame(conn, frame) {
    const socket = conn.socket;
    if (!socket || socket.destroyed || socket.writableEnded) return;
    try {
      socket.write(encodeFrame(frame));
    } catch {
      socket.destroy();
    }
  }

  function destroyConnections() {
    const live = [...sockets];
    for (const socket of live) {
      try {
        // 先半关：让已排队的 res 帧写出去，对端读到 FIN 后自行断开。
        socket.end();
      } catch {
        // 已断开的 socket 不需要再处理。
      }
    }
    sockets.clear();
    connections.clear();

    // 对端迟迟不关时兜底强拆，避免 `server.close()` 卡到超时。
    const force = setTimeout(() => {
      for (const socket of live) {
        try {
          socket.destroy();
        } catch {
          // 忽略。
        }
      }
    }, 250);
    if (typeof force.unref === 'function') force.unref();
  }

  // ---------------------------------------------------------------- run.start 辅助

  /**
   * 调 `startRun` 并附带 `onProgress`。若实现签名不接受该字段，多传一个键也无副作用。
   * 早返回契约见 §2.12：resolve 时只保证会话已建立（sessionId 可用）。
   */
  async function withProgress(orch, args) {
    const onProgress = (event) => {
      // 只做记录：进展事件的权威来源是 stream / bus，避免重复落盘。
      Promise.resolve(log('info', 'RUN_PROGRESS', summarizeEvent(event))).catch(() => {});
    };
    return orch.startRun({ ...args, onProgress });
  }

  /**
   * 后台消费 `stream`：带 seq 的事件视为已落盘（由 orchestrator 走 bus 广播），跳过；
   * 不带 seq 的事件才由 server 补落盘并广播。这样两种 orchestrator 实现都能工作。
   */
  function drainStream(stream, fallbackInstanceId) {
    (async () => {
      try {
        for await (const item of stream) {
          if (!item || typeof item !== 'object') continue;
          if (Number.isInteger(item.seq)) continue;
          const { instanceId, ...rest } = item;
          if (rest.object === undefined) continue;
          const emitted = await activeBus.emit({ instanceId: instanceId ?? fallbackInstanceId, ...rest });
          if (!emitted || emitted.ok !== true) {
            await log('warn', 'RUN_EVENT_EMIT_FAILED', { code: emitted?.code ?? null, instanceId: instanceId ?? fallbackInstanceId });
          }
        }
      } catch (err) {
        await log('error', 'RUN_STREAM_FAILED', { cause: err?.message ?? String(err) });
      }
    })();
  }

  // ---------------------------------------------------------------- 进程级兜底

  function installProcessGuards() {
    if (process.__maestroCoreGuardsInstalled) return;
    process.__maestroCoreGuardsInstalled = true;
    process.on('uncaughtException', (err) => {
      log('error', 'CORE_UNCAUGHT_EXCEPTION', { message: err?.message ?? String(err), stack: err?.stack ?? null });
    });
    process.on('unhandledRejection', (reason) => {
      log('error', 'CORE_UNHANDLED_REJECTION', {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : null,
      });
    });
  }

  return {
    listen,
    close,
    address,
    // 供测试断言 / CLI 诊断，不属于 §2.13 的冻结面。
    get pipeName() {
      return pipe;
    },
    get generation() {
      return gen;
    },
    get bootInfo() {
      return { ...boot, interrupted: boot.interrupted.slice() };
    },
    get isListening() {
      return listening;
    },
  };
}

const SKIP_RESPONSE = Symbol('skip-response');

function requireInstanceId(params) {
  if (typeof params?.instanceId !== 'string' || params.instanceId.length === 0) {
    return { ok: false, code: 'IPC_BAD_PARAMS', params: { field: 'instanceId' } };
  }
  return { ok: true, value: params.instanceId };
}

/**
 * 仅 test 的接缝调用：只做参数校验与包装，返回值原样放在 `result` 里，
 * 让 `call-seam.mjs` 能直接 `JSON.stringify` 出 `{ok:true,…}`。
 */
async function callSeam(method, params, invoke) {
  const instanceId = requireInstanceId(params);
  if (!instanceId.ok) return instanceId;
  if (typeof params?.nodeId !== 'string' || params.nodeId.length === 0) {
    return { ok: false, code: 'IPC_BAD_PARAMS', params: { method, field: 'nodeId' } };
  }
  const res = await invoke();
  if (!res || res.ok !== true) {
    return { ok: false, code: res?.code ?? 'UNKNOWN_ERROR', params: res?.detail ?? res?.params ?? { method } };
  }
  return { ok: true, result: res };
}

/** WP-6 test-only seam wrapper: boundary-check the named string fields, then forward. */
async function testSeam(method, params, required, invoke) {
  for (const field of required) {
    if (typeof params?.[field] !== 'string' || params[field].length === 0) {
      return { ok: false, code: 'IPC_BAD_PARAMS', params: { method, field } };
    }
  }
  const res = await invoke();
  if (!res || res.ok !== true) {
    return { ok: false, code: res?.code ?? 'UNKNOWN_ERROR', params: res?.params ?? res?.detail ?? { method } };
  }
  return { ok: true, result: res };
}

/**
 * `instance.get` 的只读投影：补齐渲染层需要的 `template` / `pendingEscalations`，
 * 其余字段（`cwd` / `backupPath` / `nodes[]` …）原样透传，不改写核心的对象。
 */
function shapeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot ?? null;
  const escalations = Array.isArray(snapshot.escalations) ? snapshot.escalations : [];
  const pendingEscalations = Number.isInteger(snapshot.pendingEscalations)
    ? snapshot.pendingEscalations
    : escalations.filter((entry) => entry?.state === 'pending').length;
  return {
    ...snapshot,
    // 未知 / 缺省模板按 `single`：`single` 实例行不打印模板，旧格式因此不会多出一段。
    template: typeof snapshot.template === 'string' && snapshot.template.length > 0 ? snapshot.template : 'single',
    pendingEscalations,
  };
}

function summarizeEvent(event) {
  if (!event || typeof event !== 'object') return { event: String(event) };
  return {
    object: event.object ?? null,
    objectId: event.objectId ?? null,
    from: event.from ?? null,
    to: event.to ?? null,
    phase: event.phase ?? null,
  };
}

function normalizeLogger(logger, root) {
  if (typeof logger === 'function') {
    return async (level, message, extra) => {
      try {
        await logger(level, message, extra);
      } catch {
        // 日志失败不得影响主流程。
      }
    };
  }
  const file = coreLogPath(root);
  let chain = Promise.resolve();
  return (level, message, extra) => {
    const line = `${new Date().toISOString()} [${level}] ${message} ${extra === undefined ? '' : safeJson(extra)}\n`;
    chain = chain
      .then(() => fs.appendFile(file, line, 'utf8'))
      .catch(() => {})
      .then(() => {});
    return chain;
  };
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"<unserializable>"';
  }
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function withDeadline(promise, ms) {
  const guarded = promise.catch((err) => ({
    ok: false,
    code: err?.code ?? 'FAILED',
    params: { message: err?.message ?? String(err) },
  }));
  return Promise.race([
    guarded,
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, code: 'TIMEOUT' }), ms);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}
