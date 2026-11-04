/**
 * CLI 侧客户端：连接 / 请求 / 订阅 / 自动拉起核心（§1.3 / §2.13）。
 *
 * 自动拉起的三件套**缺一不可**（NFR-07 / AC-12）：`detached:true` + `child.unref()`
 * + `stdio:'ignore'`。少任何一条，关掉命令窗口就会把核心一起带走。
 *
 * 本模块不渲染任何用户文案、不写日志到终端：核心日志归 core 自己写 `.orch/core.log`，
 * 客户端把结构化结果原样交给 CLI。
 */
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeName as defaultPipeName } from '../persistence/paths.js';
import { createFrameDecoder, encodeFrame } from './ipc-frames.js';

/** 单个探活连接的超时：热连接正常在毫秒级完成，1s 足够区分“没在跑”。 */
const ATTEMPT_TIMEOUT_MS = 1000;
const DEFAULT_COLD_START_TIMEOUT_MS = 30000;
const DEFAULT_HOT_RETRY_MS = 5000;
const POLL_INTERVAL_MS = 100;
const COLD_START_PARAM_CAUSE = '30s 内未能连接核心';

/** 可以“拉起核心后重试”的 errno；其余（权限 / 非法名字）一律直接失败，绝不反复拉起（R6）。 */
const RETRYABLE_ERRORS = new Set(['ENOENT', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND']);

export function createClient({ root, clock, pipeName, connectImpl, spawnImpl, repoRoot } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('createClient: root 必填');
  }

  const pipe = pipeName ?? defaultPipeName(root);
  const now = () => (typeof clock === 'function' ? clock() : Date.now());
  const connectSocket = typeof connectImpl === 'function' ? connectImpl : (name) => net.connect(name);
  const doSpawn = typeof spawnImpl === 'function' ? spawnImpl : spawn;

  let socket = null;
  let decoder = createFrameDecoder();
  let connected = false;
  let closedByUser = false;
  let requestSeq = 0;
  let connecting = null;
  let lastError = null;

  /** @type {Map<string, {resolve: Function, timer: NodeJS.Timeout}>} */
  const pending = new Map();
  /** @type {Set<{instanceId: string, handler: Function}>} */
  const subscriptions = new Set();
  /** @type {Array<Function>} */
  const closeWaiters = new Set();

  // ---------------------------------------------------------------- 连接

  async function connect(options = {}) {
    const {
      ensure = true,
      coldStartTimeoutMs = DEFAULT_COLD_START_TIMEOUT_MS,
      hotRetryMs = DEFAULT_HOT_RETRY_MS,
    } = options;

    if (socket && !socket.destroyed && connected) {
      return { ok: true, coldStart: false, elapsedMs: 0, pid: null, generation: null, reconnected: true };
    }
    if (connecting) return connecting;

    connecting = doConnect({ ensure, coldStartTimeoutMs, hotRetryMs }).finally(() => {
      connecting = null;
    });
    return connecting;
  }

  async function doConnect({ ensure, coldStartTimeoutMs, hotRetryMs }) {
    const t0 = now();
    const hot = await attemptConnect(Math.min(hotRetryMs, ATTEMPT_TIMEOUT_MS));
    if (hot.ok) {
      adopt(hot.socket);
      return { ok: true, coldStart: false, elapsedMs: now() - t0, ...(await handshake()) };
    }

    lastError = hot;
    if (isFatal(hot.code)) {
      return fatal(hot);
    }
    if (!ensure) {
      return { ok: false, code: 'CORE_NOT_RUNNING', params: { pipeName: pipe, errno: hot.code ?? null } };
    }

    const spawned = spawnCore();
    if (!spawned.ok) return spawned;

    const deadline = t0 + coldStartTimeoutMs;
    // 每 100ms 一次，直到冷启动上限。第一次探活已经消耗一次，这里从下一次开始。
    while (now() < deadline) {
      await delay(POLL_INTERVAL_MS);
      if (spawned.exitInfo) {
        const exit = spawned.exitInfo;
        return {
          ok: false,
          code: 'CORE_START_FAILED',
          params: {
            cause: exit.message
              ? `无法启动核心进程：${exit.message}`
              : `核心进程启动后立即退出（code=${exit.code ?? 'null'}, signal=${exit.signal ?? 'null'}）`,
            pipeName: pipe,
            pid: spawned.pid ?? null,
            elapsedMs: now() - t0,
          },
        };
      }

      const attempt = await attemptConnect(ATTEMPT_TIMEOUT_MS);
      if (attempt.ok) {
        adopt(attempt.socket);
        return {
          ok: true,
          // 冷 / 热口径（NFR-01）：首次探活成功才是热启动，本分支必然走过 spawn。
          coldStart: true,
          elapsedMs: now() - t0,
          ...(await handshake()),
        };
      }
      lastError = attempt;
      if (isFatal(attempt.code)) return fatal(attempt);
    }

    return {
      ok: false,
      code: 'CORE_START_FAILED',
      params: {
        cause: COLD_START_PARAM_CAUSE,
        pipeName: pipe,
        pid: spawned.pid ?? null,
        elapsedMs: now() - t0,
      },
    };
  }

  function fatal(error) {
    return {
      ok: false,
      code: 'CORE_START_FAILED',
      params: {
        cause: error.code === 'EACCES' || error.code === 'EPERM' ? '管道存在但无访问权限' : `${error.code ?? 'UNKNOWN'}: ${error.message ?? ''}`.trim(),
        pipeName: pipe,
        errno: error.code ?? null,
      },
    };
  }

  async function handshake() {
    const pong = await request('core.ping', {}, { timeoutMs: 3000 });
    if (!pong.ok) return { pid: null, generation: null, ping: pong };
    return { pid: pong.result?.pid ?? null, generation: pong.result?.generation ?? null };
  }

  function attemptConnect(timeoutMs) {
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      let candidate;
      try {
        candidate = connectSocket(pipe);
      } catch (err) {
        resolve({ ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? String(err) });
        return;
      }

      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        candidate.removeAllListeners?.('connect');
        if (value.ok !== true) {
          candidate.removeAllListeners?.('error');
          candidate.destroy?.();
        }
        // 成功分支保留 error 监听（settled 后为 no-op），避免 adopt 之前的空窗期
        // 出现无监听 'error' 直接炸掉宿主进程。
        resolve(value);
      };

      timer = setTimeout(() => finish({ ok: false, code: 'ETIMEDOUT', message: '连接管道超时' }), timeoutMs);

      candidate.once('connect', () => finish({ ok: true, socket: candidate }));
      candidate.once('error', (err) => finish({ ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? String(err) }));
    });
  }

  function adopt(nextSocket) {
    socket = nextSocket;
    decoder = createFrameDecoder();
    connected = true;
    closedByUser = false;

    socket.on('data', (chunk) => {
      for (const frame of decoder.push(chunk)) onFrame(frame);
    });
    socket.on('error', (err) => {
      lastError = { ok: false, code: err?.code ?? 'UNKNOWN', message: err?.message ?? String(err) };
    });
    socket.on('close', () => {
      connected = false;
      failPending('IPC_CLOSED', { pipeName: pipe });
      for (const waiter of closeWaiters) safeCall(() => waiter({ ok: true }));
      closeWaiters.clear();
    });
  }

  function spawnCore() {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repo = repoRoot ?? path.resolve(here, '..', '..');
    // WP-6 的 `bin/orch.js` 未落地时，直接拉起本工作包的 serve-entry，避免自动拉起被阻塞。
    const binEntry = path.join(repo, 'bin', 'orch.js');
    const fallbackEntry = path.join(here, 'serve-entry.js');
    const useBin = fs.existsSync(binEntry);
    const entry = useBin ? binEntry : fallbackEntry;
    const args = useBin ? [entry, 'core', 'serve', '--project', root] : [entry, '--project', root];

    try {
      const child = doSpawn(process.execPath, args, {
        // NFR-07 三件套：detached + unref + stdio:'ignore'，一个都不能少。
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: root,
        env: process.env,
      });
      const state = { ok: true, pid: child?.pid ?? null, exitInfo: null };
      child?.once?.('error', (err) => {
        state.exitInfo = { code: err?.code ?? null, signal: null, message: err?.message ?? String(err) };
      });
      child?.once?.('exit', (code, signal) => {
        state.exitInfo = { code, signal };
      });
      // 必须 unref：否则 CLI 进程会等这个子进程，`detached` 的效果也被抵消。
      child?.unref?.();
      if (child?.on) child.on('error', () => {});
      return state;
    } catch (err) {
      return {
        ok: false,
        code: 'CORE_START_FAILED',
        params: { cause: err?.message ?? String(err), pipeName: pipe },
      };
    }
  }

  // ---------------------------------------------------------------- 请求 / 订阅

  function request(method, params, { timeoutMs = 30000 } = {}) {
    if (!socket || socket.destroyed || !connected) {
      return Promise.resolve({ ok: false, code: 'CORE_NOT_RUNNING', params: { pipeName: pipe } });
    }
    const id = `c-${++requestSeq}`;
    const frame = { v: 1, kind: 'req', id, method, params: params ?? {} };

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, code: 'IPC_TIMEOUT', params: { method, timeoutMs } });
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      pending.set(id, { resolve, timer });

      try {
        socket.write(encodeFrame(frame));
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        resolve({ ok: false, code: 'IPC_CLOSED', params: { message: err?.message ?? String(err) } });
      }
    });
  }

  /**
   * 订阅某实例的事件流；返回取消函数（同步）。
   * 若已连接，会顺带发出 `instance.subscribe` 请求；服务端对同一连接重复订阅是幂等的。
   */
  function subscribe(instanceId, handler) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      throw new TypeError('subscribe: instanceId 必填');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('subscribe: handler 必须是函数');
    }
    const entry = { instanceId, handler };
    subscriptions.add(entry);
    if (connected) {
      request('instance.subscribe', { instanceId }, { timeoutMs: 15000 });
    }
    return () => {
      subscriptions.delete(entry);
    };
  }

  function onFrame(frame) {
    if (frame?.__error === 'IPC_FRAME_TOO_LARGE') {
      socket?.destroy();
      return;
    }
    if (frame?.__error === 'IPC_BAD_FRAME') return;

    if (frame?.kind === 'res') {
      const waiting = pending.get(frame.id);
      if (!waiting) return;
      pending.delete(frame.id);
      clearTimeout(waiting.timer);
      waiting.resolve(
        frame.ok === true
          ? { ok: true, result: frame.result }
          : { ok: false, code: frame.code ?? 'UNKNOWN_ERROR', params: frame.params },
      );
      return;
    }

    if (frame?.kind === 'evt') {
      const instanceId = streamInstanceId(frame.stream);
      if (!instanceId) return;
      for (const entry of subscriptions) {
        if (entry.instanceId !== instanceId) continue;
        safeCall(() => entry.handler(frame.event));
      }
    }
  }

  function failPending(code, params) {
    for (const [id, waiting] of pending) {
      clearTimeout(waiting.timer);
      waiting.resolve({ ok: false, code, params });
      pending.delete(id);
    }
  }

  async function ping() {
    return request('core.ping', {}, { timeoutMs: 3000 });
  }

  function waitForClose(timeoutMs = 5000) {
    if (!socket || socket.destroyed || !connected) return Promise.resolve({ ok: true });
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        closeWaiters.delete(finish);
        resolve(value);
      };
      const timer = setTimeout(() => finish({ ok: false, code: 'IPC_TIMEOUT' }), timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      closeWaiters.add(finish);
      socket.once('close', () => finish({ ok: true }));
    });
  }

  async function close() {
    closedByUser = true;
    failPending('IPC_CLOSED', { pipeName: pipe });
    connected = false;
    const current = socket;
    socket = null;
    for (const waiter of closeWaiters) safeCall(() => waiter({ ok: true }));
    closeWaiters.clear();
    if (current && !current.destroyed) {
      await new Promise((resolve) => {
        current.once('close', resolve);
        current.destroy();
        // destroy 后 close 事件在下一 tick 必到；不额外挂定时器以免拖住宿主进程。
      });
    }
  }

  return {
    connect,
    request,
    subscribe,
    close,
    ping,
    waitForClose,
    get connected() {
      return connected;
    },
    get pipeName() {
      return pipe;
    },
    get lastError() {
      return lastError;
    },
    get closedByUser() {
      return closedByUser;
    },
  };
}

function streamInstanceId(stream) {
  if (typeof stream !== 'string') return null;
  const prefix = 'instance:';
  return stream.startsWith(prefix) ? stream.slice(prefix.length) : null;
}

function isFatal(code) {
  if (!code) return true;
  return !RETRYABLE_ERRORS.has(code);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeCall(fn) {
  try {
    fn();
  } catch {
    // 订阅者与等待者的异常不得反向影响客户端。
  }
}
