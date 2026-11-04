// 宿主配置解析：<root>/.orch/hosts/<hostId>.json
//
// 优先级（与 dsh-launch.js 一致）：env > 配置文件 > 内置默认。
// transport 本迭代只接受 'stdio'；其他值在启动前报 HOST_UNSUPPORTED（不做半成品双实现）。
//
// 注意：配置里的 launch.command/args 可以指向任意命令 —— 夹具（mock-acp-agent.js）
// 正是通过这一入口被当成“另一个 host 命令”拉起，适配器不需要知道它是 mock。

import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveDshLaunch } from './dsh-launch.js';

export const DEFAULT_LIMITS = {
  initializeTimeoutMs: 60_000,
  promptIdleWarnMs: 30_000,
  promptTimeoutMs: 1_800_000,
  requestTimeoutMs: 120_000,
  quietIdleMs: 40,
  quietCapMs: 400,
  permissionPolicy: 'allow',
};

export const DIALECT_RECOVERIES = ['resume', 'load', 'none'];

/**
 * 审批策略：allow（自动放行）/ reject（自动拒绝）/ hold（挂起等外部决定）。
 * 兼容旧值 allow-once / reject-once。
 */
export const PERMISSION_POLICIES = Object.freeze(['allow', 'reject', 'hold']);

export function normalizePermissionPolicy(value) {
  if (value === 'allow' || value === 'allow-once') return 'allow';
  if (value === 'reject' || value === 'reject-once') return 'reject';
  if (value === 'hold') return 'hold';
  return null;
}

export function hostConfigPath(root, hostId = 'dsh') {
  return path.join(root, '.orch', 'hosts', `${hostId}.json`);
}

function invalid(filePath, cause) {
  return { ok: false, code: 'HOST_CONFIG_INVALID', params: { path: filePath, cause: String(cause) } };
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function mergeLimits(raw, env) {
  const limits = { ...DEFAULT_LIMITS };
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'permissionPolicy') {
        const policy = normalizePermissionPolicy(value);
        if (policy) limits.permissionPolicy = policy;
        continue;
      }
      limits[key] = numberOr(value, limits[key]);
    }
  }
  // env 覆盖配置文件：MAESTRO_PERMISSION_POLICY
  const fromEnv = normalizePermissionPolicy(env?.MAESTRO_PERMISSION_POLICY);
  if (fromEnv) limits.permissionPolicy = fromEnv;
  return limits;
}

/**
 * 只解析审批策略（不校验 launch）：给编排层按宿主配置取 policy 用。
 * 优先级：env > `<root>/.orch/hosts/<hostId>.json` 的 limits.permissionPolicy > 默认 allow。
 */
export async function resolvePermissionPolicy({ root, hostId = 'dsh', env = process.env } = {}) {
  const fromEnv = normalizePermissionPolicy(env?.MAESTRO_PERMISSION_POLICY);
  if (fromEnv) return { ok: true, policy: fromEnv, source: 'env' };

  if (typeof root === 'string' && root.length > 0) {
    const filePath = hostConfigPath(root, hostId);
    try {
      const text = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(text);
      const policy = normalizePermissionPolicy(parsed?.limits?.permissionPolicy);
      if (policy) return { ok: true, policy, source: 'config' };
    } catch {
      // 无配置 / 坏 JSON：退回默认（launch 校验在 adapterFactory 里负责报错）
    }
  }
  return { ok: true, policy: DEFAULT_LIMITS.permissionPolicy, source: 'default' };
}

/**
 * @param {{root: string, hostId?: string, env?: Record<string,string|undefined>}} options
 */
export async function loadHostConfig({ root, hostId = 'dsh', env = process.env } = {}) {
  if (!root) return { ok: false, code: 'HOST_CONFIG_INVALID', params: { cause: 'root 必填' } };
  const filePath = hostConfigPath(root, hostId);

  let config = {};
  let configFound = false;
  try {
    const text = await fs.readFile(filePath, 'utf8');
    configFound = true;
    try {
      config = JSON.parse(text);
    } catch (err) {
      return invalid(filePath, `JSON 解析失败：${err.message}`);
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') return invalid(filePath, err?.message ?? String(err));
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return invalid(filePath, '配置文件必须是 JSON 对象');
  }

  const transport = config.transport ?? 'stdio';
  if (transport !== 'stdio') {
    return {
      ok: false,
      code: 'HOST_UNSUPPORTED',
      params: { transport, supported: ['stdio'] },
      message: `本迭代只支持 stdio transport，收到 ${transport}`,
    };
  }

  const dialectRaw = config.dialect ?? {};
  const recovery = dialectRaw.recovery ?? 'resume';
  if (!DIALECT_RECOVERIES.includes(recovery)) {
    return invalid(filePath, `dialect.recovery 只允许 ${DIALECT_RECOVERIES.join(' | ')}`);
  }

  const resolved = resolveDshLaunch({ env, config });
  if (!resolved.ok) return resolved;

  return {
    ok: true,
    id: hostId,
    transport: 'stdio',
    launch: resolved.launch,
    dialect: { ...dialectRaw, recovery },
    limits: mergeLimits(config.limits, env),
    configPath: configFound ? filePath : null,
    source: resolved.launch.source,
  };
}
