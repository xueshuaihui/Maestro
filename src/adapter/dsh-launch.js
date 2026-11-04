// DSH 启动 shim：配置驱动，不硬编码安装路径、不写死用户名。
//
// 本机事实（dsh-probe.md §1 / iteration-0 报告）：
// - Windows 上没有 dsh.cmd；CLI 入口在 app.asar 内，纯 Node 读不了 asar，
//   必须用 Electron 的 node 模式（ELECTRON_RUN_AS_NODE=1）跑 asar 内 bin.js；
// - 该变量在本机父 shell 里可能已常驻，因此这里“显式设置”而不是沿用；
// - 不碰 ~/.dsh：不写 profile、不复制凭据。需要隔离 home 时由外部注入 DSH_HOME。

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_PROFILE_ARGS = ['--profile', 'acp'];

const asarBinRelative = path.join(
  'resources',
  'app.asar',
  'dsh',
  'node_modules',
  '@deepseek-ai',
  'dsh',
  'lib',
  'bin.js',
);

function trimOrUndefined(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function splitArgs(value) {
  return String(value)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 默认推导：%LOCALAPPDATA%\Programs\DeepSeek Harness\{DeepSeek Harness.exe, resources/app.asar/.../bin.js} */
export function deriveDshPaths(env = process.env) {
  const localAppData = trimOrUndefined(env.LOCALAPPDATA);
  if (!localAppData) {
    return { exe: null, bin: null, cause: '未找到 LOCALAPPDATA（无法推导 DSH 安装路径）' };
  }
  const exe = path.join(localAppData, 'Programs', 'DeepSeek Harness', 'DeepSeek Harness.exe');
  const bin = path.join(path.dirname(exe), asarBinRelative);
  return { exe, bin, cause: null };
}

function deriveBinFromExe(exe) {
  if (!exe) return null;
  return path.join(path.dirname(exe), asarBinRelative);
}

function withElectronNode(env) {
  const merged = { ...(env ?? process.env) };
  // 显式覆盖：不能“有就沿用”，否则桌面 Electron 场景会退化
  merged.ELECTRON_RUN_AS_NODE = '1';
  return merged;
}

/**
 * 覆盖优先级（高 → 低）：env(MAESTRO_DSH_EXE/MAESTRO_DSH_BIN/MAESTRO_DSH_ARGS)
 *   > <root>/.orch/hosts/dsh.json 的 launch
 *   > 内置默认。
 *
 * config 的 launch.command/args 可指向任意命令 —— 这是夹具接管 host 的唯一入口
 * （把 mock-acp-agent.js 当“另一个 host 命令”拉起）。
 */
export function resolveDshLaunch({ env = process.env, config = null } = {}) {
  const exeOverride = trimOrUndefined(env.MAESTRO_DSH_EXE);
  const binOverride = trimOrUndefined(env.MAESTRO_DSH_BIN);
  const argsOverride = trimOrUndefined(env.MAESTRO_DSH_ARGS);
  const hasEnvOverride = Boolean(exeOverride || binOverride || argsOverride);

  const derived = deriveDshPaths(env);

  if (hasEnvOverride) {
    const command = exeOverride ?? derived.exe;
    if (!command) {
      return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: derived.cause } };
    }
    const bin = binOverride ?? deriveBinFromExe(command) ?? derived.bin;
    if (!bin && !argsOverride) {
      return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: '未找到 bin.js' } };
    }
    const extraArgs = argsOverride ? splitArgs(argsOverride) : DEFAULT_PROFILE_ARGS;
    return {
      ok: true,
      launch: {
        command,
        args: bin ? [bin, ...extraArgs] : extraArgs,
        env: withElectronNode(env),
        source: 'env',
        exe: command,
        bin,
      },
    };
  }

  const configLaunch = config?.launch;
  if (configLaunch && typeof configLaunch === 'object' && trimOrUndefined(configLaunch.command)) {
    const command = String(configLaunch.command);
    const args = Array.isArray(configLaunch.args) ? configLaunch.args.map(String) : [];
    const launchEnv = withElectronNode({ ...(env ?? process.env), ...(configLaunch.env ?? {}) });
    return {
      ok: true,
      launch: {
        command,
        args,
        env: launchEnv,
        source: 'config',
        exe: configLaunch.exe ?? command,
        bin: configLaunch.bin ?? null,
      },
    };
  }

  if (!derived.exe || !derived.bin) {
    return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: derived.cause } };
  }

  return {
    ok: true,
    launch: {
      command: derived.exe,
      args: [derived.bin, ...DEFAULT_PROFILE_ARGS],
      env: withElectronNode(env),
      source: 'default',
      exe: derived.exe,
      bin: derived.bin,
    },
  };
}

/** 夹具启动：mock agent 被当作“另一个 host 命令”，走与 DSH 完全相同的路径 */
export function resolveMockLaunch({ switches = [], mockPath, env = process.env } = {}) {
  if (!mockPath) {
    return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: '未找到 mock agent 路径' } };
  }
  const list = Array.isArray(switches) ? switches.map(String) : splitArgs(switches);
  return {
    ok: true,
    launch: {
      command: process.execPath,
      args: [mockPath, ...list],
      env: withElectronNode(env),
      source: 'config',
      exe: process.execPath,
      bin: mockPath,
    },
  };
}

export async function probeDshInstalled({ env = process.env } = {}) {
  const resolved = resolveDshLaunch({ env });
  if (!resolved.ok) return resolved;
  const { exe, bin } = resolved.launch;
  // 配置/夹具指向任意命令时，不假设 DSH 布局
  if (resolved.launch.source === 'config') {
    return { ok: true, exe, bin, source: 'config' };
  }
  for (const target of [exe, bin]) {
    if (!target) continue;
    try {
      await fs.access(target);
    } catch {
      return { ok: false, code: 'DSH_SPAWN_FAILED', params: { cause: `未找到 ${target}` } };
    }
  }
  return { ok: true, exe, bin, source: resolved.launch.source };
}
