/**
 * 版本号唯一来源（需求 v4 裁决 U-13 / AC-41）。
 *
 * 规则（三条，全部可机检）：
 * 1. 唯一来源 = `package.json` 的 `version`。本文件是**唯一**读取它并对外派生的模块。
 * 2. `Cargo.toml` / `tauri.conf.json` 的 version 必须与来源**逐字相等**。
 *    （Cargo 的 version 是必需元数据、无法省略，所以口径是「值相等」而不是「零字面量」。）
 * 3. `scripts/desktop/**` 内不得再出现版本字面量；一律调用本模块。
 *
 * 产物命名契约（AC-39「文件名带版本与架构」）：
 *   macOS   Maestro_<version>_x64.dmg / Maestro_<version>_arm64.dmg
 *   Windows Maestro_<version>_win-x64-setup.exe
 *   清单     SHA256SUMS.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKAGE_JSON = path.join(REPO, 'package.json');
export const CARGO_TOML = path.join(REPO, 'desktop', 'src-tauri', 'Cargo.toml');
export const TAURI_CONF = path.join(REPO, 'desktop', 'src-tauri', 'tauri.conf.json');

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/** 读取唯一来源。缺失或非法直接抛错（不允许静默回退到默认值）。 */
export function readVersion() {
  const meta = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const version = meta.version;
  if (typeof version !== 'string' || !SEMVER.test(version)) {
    throw new Error(`package.json version 非法：${JSON.stringify(version)}`);
  }
  return version;
}

/** 从 Cargo.toml 的 `[package]` 段解析 version（不做完整 TOML 解析，避免引入依赖）。 */
export function readCargoVersion(text = fs.readFileSync(CARGO_TOML, 'utf8')) {
  let inPackage = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inPackage = trimmed === '[package]';
      continue;
    }
    if (!inPackage) continue;
    const m = trimmed.match(/^version\s*=\s*"([^"]+)"/);
    if (m) return m[1];
  }
  throw new Error('Cargo.toml 的 [package] 段没有 version');
}

/** 从 tauri.conf.json 解析 version。 */
export function readTauriVersion(text = fs.readFileSync(TAURI_CONF, 'utf8')) {
  const conf = JSON.parse(text);
  if (typeof conf.version !== 'string' || conf.version === '') {
    throw new Error('tauri.conf.json 没有 version');
  }
  return conf.version;
}

/** 三处取值（用于对齐断言与证据留档，不抛错）。 */
export function readAll() {
  return { version: readVersion(), cargo: readCargoVersion(), tauri: readTauriVersion() };
}

/**
 * 断言三处值一致。返回 `{ ok, version, details }`，不抛错——
 * 让调用方决定「报错退出」还是「作为契约测试的断言」。
 */
export function checkAligned() {
  let version;
  try {
    version = readVersion();
  } catch (err) {
    return { ok: false, version: null, details: { error: err.message } };
  }
  const details = { packageJson: version, cargo: null, tauri: null };
  try {
    details.cargo = readCargoVersion();
  } catch (err) {
    details.cargoError = err.message;
  }
  try {
    details.tauri = readTauriVersion();
  } catch (err) {
    details.tauriError = err.message;
  }
  const ok = details.cargo === version && details.tauri === version;
  return { ok, version, details };
}

/** 断言并抛错版本（构建/打包脚本入口用）。 */
export function assertAligned() {
  const { ok, version, details } = checkAligned();
  if (!ok) {
    throw new Error(
      `版本不一致（唯一来源 package.json = ${version}）：` +
        `Cargo.toml = ${details.cargo ?? details.cargoError}，` +
        `tauri.conf.json = ${details.tauri ?? details.tauriError}`,
    );
  }
  return version;
}

/** 平台架构标签：`x64` / `arm64`（macOS 与 Windows 共用同一套判定）。 */
export function archLabel(arch = process.arch) {
  if (arch === 'x64') return 'x64';
  if (arch === 'arm64') return 'arm64';
  throw new Error(`不支持的架构：${arch}`);
}

/** 产物文件名（AC-39 的「带版本与架构」契约）。 */
export function artifactName(version, arch, platform = process.platform) {
  const label = archLabel(arch);
  if (platform === 'darwin') return `Maestro_${version}_${label}.dmg`;
  if (platform === 'win32') return `Maestro_${version}_win-${label}-setup.exe`;
  throw new Error(`不支持的平台：${platform}`);
}

export const SUMS_NAME = 'SHA256SUMS.txt';
