/**
 * 核心生命周期：探活 / 确保在跑 / 优雅停止（§2.13）。
 *
 * 探活只做一次 300ms 的 connect 试探，**不拉起**；拉起只发生在 `ensureCore` 里
 * （委托给 client.connect 的自动拉起路径）。
 */
import net from 'node:net';
import fs from 'node:fs/promises';
import { coreMetaPath, pipeName as defaultPipeName } from '../persistence/paths.js';
import { createClient } from './client.js';

const PROBE_TIMEOUT_MS = 300;
const DEFAULT_STOP_TIMEOUT_MS = 5000;

export async function isAlive({ root } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('isAlive: root 必填');
  }
  const pipe = defaultPipeName(root);
  return probeOnce(pipe, PROBE_TIMEOUT_MS);
}

export async function ensureCore({ root } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('ensureCore: root 必填');
  }
  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: true });
    if (!connected.ok) {
      return { ok: false, code: connected.code ?? 'CORE_START_FAILED', params: connected.params };
    }
    const pong = await client.ping();
    if (!pong.ok) {
      return { ok: false, code: pong.code ?? 'CORE_START_FAILED', params: pong.params };
    }
    return {
      ok: true,
      pid: pong.result?.pid ?? connected.pid ?? null,
      generation: pong.result?.generation ?? connected.generation ?? null,
      coldStart: connected.coldStart === true,
      elapsedMs: connected.elapsedMs ?? 0,
    };
  } finally {
    await client.close();
  }
}

export async function stopCore({ root, timeoutMs = DEFAULT_STOP_TIMEOUT_MS } = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('stopCore: root 必填');
  }

  const t0 = Date.now();
  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: false });
    if (!connected.ok) {
      // 没在跑也算“已停止”，CLI 幂等执行 `core stop` 不应报错。
      return { ok: true, exit: 'not-running', pid: null, elapsedMs: 0 };
    }

    const res = await client.request('core.stop', {}, { timeoutMs: 2000 });
    if (!res.ok) {
      // 回包都没拿到（管道已断或超时）：仍然按核心是否退出来判定。
      if (res.code === 'IPC_CLOSED') {
        return { ok: true, exit: 'graceful', pid: connected.pid ?? null, elapsedMs: Date.now() - t0 };
      }
      const pid = connected.pid ?? (await readMetaPid(root));
      await client.close();
      return { ok: false, code: 'CORE_STOP_TIMEOUT', params: { pid } };
    }

    const pid = res.result?.pid ?? connected.pid ?? null;
    const closed = await client.waitForClose(timeoutMs);
    if (!closed.ok) {
      const fallbackPid = pid ?? (await readMetaPid(root));
      await client.close();
      return { ok: false, code: 'CORE_STOP_TIMEOUT', params: { pid: fallbackPid } };
    }
    return { ok: true, exit: 'graceful', pid, elapsedMs: Date.now() - t0 };
  } finally {
    await client.close();
  }
}

function probeOnce(pipe, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let socket;
    const finish = (alive) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.removeAllListeners?.();
      socket?.destroy?.();
      resolve(alive);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      socket = net.connect(pipe);
    } catch {
      finish(false);
      return;
    }
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

/** `core.json` 仅用于 `core stop` 超时提示（§1.3），不参与连接地址决策。 */
async function readMetaPid(root) {
  try {
    const text = await fs.readFile(coreMetaPath(root), 'utf8');
    const meta = JSON.parse(text);
    return Number.isInteger(meta?.pid) ? meta.pid : null;
  } catch {
    return null;
  }
}
