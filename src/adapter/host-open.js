// 打开宿主会话适配器（I1.10b WP-2；需求 D-4 / §3.7 + AC-26 Then）。
//
// 配置驱动：`<root>/.orch/hosts/<hostId>.json` 的 `open: {command, args}` 段
// 是唯一命令来源；宿主配置存在但缺 `open` 段 → `HOST_UNSUPPORTED`
// （「宿主 <host> 不支持跳转」）；宿主配置文件不存在时按 D-4 的缺省顺序
// 复用 `src/adapter/dsh-launch.js` 的 exe 推导（只 import 不改）。
//
// 与 dsh-launch 相同的纪律：只做 spawn 与结果映射，不等待、不轮询、
// 不做窗口控制、不写 `~/.dsh`；daemon/http 层不出现宿主类型分支，
// 宿主语义全部收敛在本文件。
//
// 去重（D-4 / BR-33）：同一 `(instanceId, sessionId)` 在 500ms 窗口内只
// 执行一次，第二次直接复用第一次的结果对象。

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { resolveDshLaunch } from './dsh-launch.js';

const DEDUP_WINDOW_MS = 500;

/** 同一 (instanceId, sessionId) 的最近一次结果，窗口内直接复用。 */
const lastOpenByKey = new Map();

function nowMs(clock) {
  return typeof clock === 'function' ? clock() : Date.now();
}

async function readHostConfig(root, hostId) {
  if (typeof root !== 'string' || root.length === 0) return null;
  if (typeof hostId !== 'string' || hostId.length === 0) return null;
  // basename 防御：hostId 只用于在 hosts/ 目录下定位同名 json。
  const file = path.join(root, '.orch', 'hosts', `${path.basename(hostId)}.json`);
  let text;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function unsupported(hostId) {
  return {
    ok: false,
    code: 'HOST_UNSUPPORTED',
    message: `宿主 ${hostId} 不支持跳转`,
  };
}

/** spawn 失败的结果映射（D-4）：路径不存在 → 「未找到 DeepSeek Harness」。 */
function spawnFailure(err) {
  const cause = err?.code ?? err?.message ?? String(err ?? 'unknown');
  if (err?.code === 'ENOENT') {
    return { ok: false, code: 'DSH_SPAWN_FAILED', message: '未找到 DeepSeek Harness' };
  }
  return { ok: false, code: 'DSH_SPAWN_FAILED', message: `跳转失败 · ${cause}` };
}

function missingLaunchFailure() {
  return { ok: false, code: 'DSH_SPAWN_FAILED', message: '未找到 DeepSeek Harness' };
}

/**
 * 解析打开命令（D-4 解析顺序）：宿主配置 `open` 段 → 宿主配置存在但无
 * `open` 段 → HOST_UNSUPPORTED → 宿主配置文件不存在 → resolveDshLaunch
 * 缺省推导。
 */
async function resolveOpenCommand({ root, hostId, env }) {
  const config = await readHostConfig(root, hostId);
  if (config !== null) {
    const open = config.open;
    if (open !== null && typeof open === 'object' && typeof open.command === 'string'
      && open.command.trim().length > 0) {
      return {
        command: open.command,
        args: Array.isArray(open.args) ? open.args.map(String) : [],
      };
    }
    return { unsupported: unsupported(hostId) };
  }
  const resolved = resolveDshLaunch({ env });
  if (!resolved || resolved.ok !== true) {
    return { unsupported: missingLaunchFailure() };
  }
  return { command: resolved.launch.command, args: resolved.launch.args, env: resolved.launch.env };
}

/**
 * 打开宿主会话：解析命令 → 预检存在性 → detached spawn → 结果映射。
 * 返回体（成功 / 业务错误）即 §3.7 的响应形状；请求形状问题由调用方
 * （HTTP 层）在进入本函数前拦截。
 *
 * @param {object} options
 * @param {string} options.root 项目根（hosts/ 目录解析基准）
 * @param {string} options.hostId 会话的宿主标识（来自实例状态 sessions[].hostId）
 * @param {string} [options.instanceId] 去重键的一部分
 * @param {string} [options.sessionId] 去重键的一部分
 * @param {object} [options.env] spawn 环境变量（缺省 process.env）
 * @param {Function} [options.clock] 注入时钟（测试去重窗口用）
 * @returns {Promise<object>} `{ok:true, host, sessionId, sessionChoice}` 或
 *   `{ok:false, code, message}`
 */
export async function openHost({
  root,
  hostId,
  instanceId,
  sessionId,
  env = process.env,
  clock,
} = {}) {
  const at = nowMs(clock);
  const key = `${instanceId ?? ''}\u0000${sessionId ?? ''}`;
  const cached = lastOpenByKey.get(key);
  if (cached !== undefined && at - cached.at < DEDUP_WINDOW_MS) {
    return cached.result;
  }

  let result;
  if (typeof hostId !== 'string' || hostId.length === 0) {
    result = unsupported(hostId ?? '');
  } else {
    const resolved = await resolveOpenCommand({ root, hostId, env });
    if (resolved.unsupported) {
      result = resolved.unsupported;
    } else {
      result = await launchOpen(resolved, { hostId, sessionId, env });
    }
  }

  lastOpenByKey.set(key, { at, result });
  return result;
}

async function launchOpen({ command, args, env: commandEnv }, { hostId, sessionId, env }) {
  // 预检：目标不存在时直接给「未找到」，不等 spawn 的异步 error。
  if (commandEnv?.source !== 'config') {
    try {
      await fs.access(command);
    } catch (err) {
      return spawnFailure(err?.code === 'ENOENT' ? { code: 'ENOENT' } : err);
    }
  }
  // 配置来源的命令不做存在性预检（可能是 shell 内建 / PATH 解析），交给 spawn。

  const mergedEnv = commandEnv ?? env;
  let child;
  try {
    child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      ...(mergedEnv !== undefined ? { env: mergedEnv } : {}),
    });
  } catch (err) {
    return spawnFailure(err);
  }

  // spawn 的 ENOENT / EACCES 走异步 error 事件；给出一个窄窗口观察，
  // 未触发即视为已拉起（不等待、不轮询进程存续，D-4 纪律）。
  const failure = await Promise.race([
    new Promise((resolve) => {
      child.once('error', (err) => resolve(err));
    }),
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 120);
      if (typeof timer.unref === 'function') timer.unref();
    }),
  ]);
  if (typeof child.unref === 'function') child.unref();
  if (failure) return spawnFailure(failure);

  return {
    ok: true,
    host: hostId,
    sessionId: sessionId ?? null,
    sessionChoice: 'most-recent-active',
  };
}

/** 测试专用：清空去重缓存（不属于产品面）。 */
export function resetOpenHostDedup() {
  lastOpenByKey.clear();
}
