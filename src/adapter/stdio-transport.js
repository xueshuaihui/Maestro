// NDJSON over child_process stdio.
//
// 分帧口径以真机实测为准（见 docs/iterations/iteration-1/dsh-probe.md §2）：
// 一帧 = 一行 JSON + '\n'（0x0a），没有 Content-Length，没有 \r\n\r\n。
// 入向自管 Buffer（保留“半行”状态），出向 JSON.stringify + '\n' 串行化写入。
//
// 该文件是唯一允许出现“进程/字节流”细节的地方之一（另一处是 acp-client 的协议语义）。

import { spawn } from 'node:child_process';

const DEFAULT_MAX_FRAME_BYTES = 8 * 1024 * 1024;
const STDERR_KEEP_LINES = 200;

/**
 * @param {{
 *   command: string,
 *   args?: string[],
 *   env?: Record<string,string|undefined>,
 *   cwd?: string,
 *   maxFrameBytes?: number,
 *   settleMs?: number,
 *   clock?: () => number,
 * }} options
 */
export function createStdioTransport(options = {}) {
  const {
    command,
    args = [],
    env,
    cwd,
    maxFrameBytes = DEFAULT_MAX_FRAME_BYTES,
    settleMs = 150,
  } = options;

  if (!command || typeof command !== 'string') {
    throw new TypeError('createStdioTransport: command 必须是字符串');
  }

  const messageHandlers = new Set();
  const parseErrorHandlers = new Set();
  const exitHandlers = new Set();

  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  /** @type {Promise<{ok:true,pid:number}|{ok:false,code:string,params:{cause:string}}> | null} */
  let spawning = null;
  /** @type {Promise<{ok:true,exit:{code:number|null,signal:string|null}}> | null} */
  let disposing = null;
  let exited = false;
  /** @type {{code:number|null,signal:string|null} | null} */
  let exitInfo = null;
  let sawFirstFrame = false;
  let buffer = Buffer.alloc(0);
  let writeChain = Promise.resolve();
  let stderrLines = [];
  let lastError = null;
  let fatal = false;
  let leftoverFlushed = false;

  const subscribers = (set) => {
    const fn = (cb) => {
      if (typeof cb !== 'function') throw new TypeError('callback 必须是函数');
      set.add(cb);
      return () => set.delete(cb);
    };
    return fn;
  };

  const onMessage = subscribers(messageHandlers);
  const onParseError = subscribers(parseErrorHandlers);
  const onExit = subscribers(exitHandlers);

  function emit(set, payload) {
    for (const cb of [...set]) {
      try {
        cb(payload);
      } catch {
        // 订阅者异常不得影响 transport
      }
    }
  }

  function recordStderr(chunk) {
    const text = chunk.toString('utf8');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (!line.trim()) continue;
      stderrLines.push(line);
    }
    if (stderrLines.length > STDERR_KEEP_LINES) {
      stderrLines = stderrLines.slice(-STDERR_KEEP_LINES);
    }
  }

  function stderrTail(n = 20) {
    const size = Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), stderrLines.length) : 0;
    return size === 0 ? [] : stderrLines.slice(-size);
  }

  function causeFromStderr(fallback) {
    const tail = stderrTail(20);
    if (tail.length > 0) return tail.join('\n');
    return fallback;
  }

  function parseLine(lineBuf) {
    const text = lineBuf.toString('utf8').replace(/\r$/, '');
    if (!text.trim()) return;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      const error = new Error(`无法解析的帧：${err.message}`);
      error.cause = err;
      error.code = 'PROTOCOL_PARSE_ERROR';
      lastError = error;
      emit(parseErrorHandlers, { line: text, error });
      return;
    }
    if (parsed === null || typeof parsed !== 'object') {
      const error = new Error('帧不是 JSON 对象');
      error.code = 'PROTOCOL_PARSE_ERROR';
      lastError = error;
      emit(parseErrorHandlers, { line: text, error });
      return;
    }
    sawFirstFrame = true;
    emit(messageHandlers, parsed);
  }

  function handleTooLarge(bytes) {
    if (fatal) return;
    fatal = true;
    const error = new Error(`单行超过 maxFrameBytes（${bytes} > ${maxFrameBytes}）`);
    error.code = 'IPC_FRAME_TOO_LARGE';
    lastError = error;
    emit(parseErrorHandlers, { line: null, error });
    buffer = Buffer.alloc(0);
    void dispose({ timeoutMs: 500 });
  }

  function handleStdoutChunk(chunk) {
    if (fatal) return;
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
    for (;;) {
      const nl = buffer.indexOf(0x0a);
      if (nl < 0) {
        if (buffer.length > maxFrameBytes) handleTooLarge(buffer.length);
        return;
      }
      const lineBuf = buffer.subarray(0, nl);
      buffer = buffer.subarray(nl + 1);
      if (lineBuf.length > maxFrameBytes) {
        handleTooLarge(lineBuf.length);
        return;
      }
      parseLine(lineBuf);
      if (fatal) return;
    }
  }

  // 末尾无换行的最后一帧：EOF 时补一次 flush（实测 DSH 不会这样，但契约要求容忍）
  function flushRemaining() {
    if (leftoverFlushed || fatal) return;
    leftoverFlushed = true;
    if (buffer.length > 0) {
      const rest = buffer;
      buffer = Buffer.alloc(0);
      if (rest.length > maxFrameBytes) handleTooLarge(rest.length);
      else parseLine(rest);
    }
  }

  function handleExit(code, signal) {
    exited = true;
    exitInfo = { code, signal };
    flushRemaining();
    emit(exitHandlers, { code, signal });
  }

  function spawnTransport() {
    if (spawning) return spawning;
    if (exited) {
      spawning = Promise.resolve({
        ok: false,
        code: 'DSH_SPAWN_FAILED',
        params: { cause: '进程已退出，无法重复 spawn' },
      });
      return spawning;
    }

    spawning = new Promise((resolve) => {
      let settled = false;
      let spawned = false;
      let spawnError = null;
      let settleTimer = null;

      const settle = (value) => {
        if (settled) return;
        settled = true;
        if (settleTimer) {
          clearTimeout(settleTimer);
          settleTimer = null;
        }
        resolve(value);
      };

      const settleOk = () => {
        if (!child || typeof child.pid !== 'number') return;
        settle({ ok: true, pid: child.pid });
      };

      const settleFailed = (cause) => {
        settle({
          ok: false,
          code: 'DSH_SPAWN_FAILED',
          params: { cause: causeFromStderr(cause) },
        });
      };

      try {
        child = spawn(command, args, {
          cwd,
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (err) {
        settleFailed(String(err?.message ?? err));
        return;
      }

      child.stdout?.on('data', handleStdoutChunk);
      child.stdout?.on('error', () => {});
      child.stdout?.on('end', flushRemaining);
      child.stderr?.on('data', recordStderr);
      child.stderr?.on('error', () => {});
      child.stdin?.on('error', () => {
        // EPIPE / ERR_STREAM_DESTROYED：由当次 send() 的 write 回调上报
      });

      child.on('spawn', () => {
        spawned = true;
      });

      child.on('error', (err) => {
        spawnError = err;
        if (!settled) settleFailed(err?.message ? `启动失败：${err.message}` : '启动失败');
      });

      child.on('exit', (code, signal) => {
        handleExit(code, signal);
        if (!settled) {
          // 立即退出（未等到首帧）：按 spawn 失败上报，cause 取 stderr 尾部
          if (sawFirstFrame) settleOk();
          else {
            const detail = `进程已退出（code=${code}, signal=${signal}）`;
            settleFailed(spawnError ? `${spawnError.message}；${detail}` : detail);
          }
        }
      });

      // 首帧或静默窗口结束即视为“起来了”。DSH 冷启约 2s，但进程本身立刻存活。
      const firstFrameOff = onMessage(() => {
        if (!settled) settleOk();
        firstFrameOff();
      });

      settleTimer = setTimeout(() => {
        if (settled) return;
        if (exited) return; // exit 分支会 settle
        if (!spawned && spawnError) return;
        settleOk();
      }, settleMs);
      settleTimer.unref?.();
    });

    return spawning;
  }

  function send(obj) {
    let raw;
    try {
      raw = JSON.stringify(obj) + '\n';
    } catch (err) {
      return Promise.reject(err);
    }
    const task = writeChain.then(
      () =>
        new Promise((resolve, reject) => {
          if (!child || !child.stdin) {
            reject(new Error('transport 尚未 spawn'));
            return;
          }
          if (child.stdin.destroyed || child.stdin.writableEnded) {
            const err = new Error('stdin 已关闭');
            err.code = 'STDIN_CLOSED';
            reject(err);
            return;
          }
          if (exited) {
            const err = new Error('进程已退出');
            err.code = 'DSH_SPAWN_FAILED';
            reject(err);
            return;
          }
          child.stdin.write(raw, 'utf8', (err) => (err ? reject(err) : resolve()));
        }),
    );
    // 串行化：前一次失败也不能阻断后续写入
    writeChain = task.then(
      () => {},
      () => {},
    );
    return task;
  }

  function waitForExit(ms) {
    if (exited) return Promise.resolve(true);
    if (!child) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        child?.removeListener('exit', onExitOnce);
        resolve(false);
      }, Math.max(1, ms));
      function onExitOnce() {
        clearTimeout(timer);
        resolve(true);
      }
      child.once('exit', onExitOnce);
    });
  }

  function dispose(opts = {}) {
    if (disposing) return disposing;
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 1000;
    disposing = (async () => {
      if (!child) return { ok: true, exit: null };
      try {
        child.stdin?.end();
      } catch {
        // ignore
      }
      if (!exited) {
        let done = await waitForExit(timeoutMs);
        if (!done) {
          try {
            child.kill('SIGTERM');
          } catch {
            // ignore
          }
          done = await waitForExit(timeoutMs);
        }
        if (!done) {
          // 兜底：不允许留孤儿进程（Windows 上 SIGKILL 等价于 TerminateProcess）
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
          done = await waitForExit(500);
          if (!done && typeof child.pid === 'number') {
            try {
              process.kill(child.pid, 'SIGKILL');
            } catch {
              // 进程可能已经消失
            }
          }
        }
      }
      // 释放管道句柄，避免测试进程挂住
      try {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
      } catch {
        // ignore
      }
      child.unref?.();
      return { ok: true, exit: exitInfo };
    })();
    return disposing;
  }

  return {
    command,
    args,
    get pid() {
      return typeof child?.pid === 'number' ? child.pid : null;
    },
    get lastError() {
      return lastError;
    },
    isExited: () => exited,
    spawn: spawnTransport,
    send,
    onMessage,
    onParseError,
    onExit,
    stderrTail,
    dispose,
  };
}
