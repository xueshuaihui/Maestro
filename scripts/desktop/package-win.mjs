#!/usr/bin/env node
/**
 * Windows 安装包生成（NSIS `.exe`）——需求 AC-39 / AC-44。
 *
 * 前置：必须在 Windows 上运行（`windows-latest` runner）。本机 macOS 既没有
 * `makensis` 也无法产出 Windows 二进制，**脚本遇到非 win32 平台必须显式报错退出**，
 * 不允许静默跳过把「没构建」伪装成「构建成功」。
 *
 * 资源布局（与 Rust 侧 `resource_dir()` 对齐）：Windows 无 bundle 时 resource_dir
 * 返回可执行文件所在目录，因此运行时资源直接放在 exe 同级：
 *   Maestro.exe
 *   runtime/node.exe
 *   bin/  src/  desktop/ui/
 *
 * 用法：node scripts/desktop/package-win.mjs [--skip-build] [--out <dir>]
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { REPO, artifactName, assertAligned, archLabel } from './version.mjs';

const SRC_TAURI = path.join(REPO, 'desktop', 'src-tauri');
const EXE = path.join(SRC_TAURI, 'target', 'release', 'maestro.exe');
const DEFAULT_OUT = path.join(REPO, 'dist', 'release');

function log(msg) {
  process.stdout.write(`[package-win] ${msg}\n`);
}

function die(msg) {
  process.stderr.write(`[package-win] FAIL: ${msg}\n`);
  process.exit(1);
}

function run(cmd, args, options = {}) {
  log(`${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  if (r.status !== 0) {
    die(`${cmd} 退出 ${r.status}\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  }
  return r;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

/**
 * NSIS 的 `VIProductVersion` 只接受四段纯数字（X.X.X.X），prerelease / build 后缀非法。
 * 例：`X.Y.Z-<tag>.<n>` → `X.Y.Z.0`；纯数字 `X.Y.Z` → `X.Y.Z.0`。
 * 完整版本串仍由 `VIAddVersionKey "ProductVersion"` 原样保留，不丢信息。
 * （本文件不得出现具体版本号字面量，版本只从 version.mjs 派生。）
 */
function nsisNumericVersion(version) {
  const core = String(version).split(/[-+]/)[0];
  const nums = core.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  while (nums.length < 4) nums.push(0);
  return nums.slice(0, 4).join('.');
}

/** NSIS 脚本：安装到 %LOCALAPPDATA%，建开始菜单与桌面快捷方式，可卸载。 */
function nsiScript({ outFile, stagingDir, version }) {
  const numeric = nsisNumericVersion(version);
  return `Unicode true
!include "MUI2.nsh"
Name "Maestro"
OutFile "${outFile}"
InstallDir "$LOCALAPPDATA\\Maestro"
InstallDirRegKey HKCU "Software\\Maestro" "InstallDir"
RequestExecutionLevel user
VIProductVersion "${numeric}"
VIAddVersionKey "ProductName" "Maestro"
VIAddVersionKey "FileVersion" "${numeric}"
VIAddVersionKey "ProductVersion" "${version}"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${path.join(stagingDir, '*')}"
  WriteRegStr HKCU "Software\\Maestro" "InstallDir" "$INSTDIR"
  CreateShortcut "$SMPROGRAMS\\Maestro.lnk" "$INSTDIR\\Maestro.exe"
  CreateShortcut "$DESKTOP\\Maestro.lnk" "$INSTDIR\\Maestro.exe"
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\\Maestro.lnk"
  Delete "$DESKTOP\\Maestro.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\\Maestro"
SectionEnd
`;
}

/**
 * 定位 makensis。
 *
 * windows-latest 预装 NSIS，但**不在 PATH**（首轮 CI 实测：`makensis` 直接 spawn 失败，
 * 安装目录是 `C:\Program Files (x86)\NSIS\makensis.exe`）。这里先试 PATH，
 * 再按标准安装目录探测；全都找不到才算环境缺失。
 */
function resolveMakensis() {
  const fromPath = spawnSync('makensis', ['/VERSION'], { encoding: 'utf8' });
  if (fromPath.status === 0) return fromPath.stdout.trim() || 'makensis';

  const roots = [
    process.env['ProgramFiles(x86)'],
    process.env.ProgramFiles,
    process.env.ProgramW6432,
    'C:\\Program Files (x86)',
    'C:\\Program Files',
  ].filter(Boolean);
  const candidates = roots.flatMap((root) => [
    path.join(root, 'NSIS', 'makensis.exe'),
    path.join(root, 'NSIS', 'Bin', 'makensis.exe'),
  ]);
  for (const exe of candidates) {
    if (!fs.existsSync(exe)) continue;
    const probe = spawnSync(exe, ['/VERSION'], { encoding: 'utf8' });
    if (probe.status === 0) return exe;
  }
  return null;
}

function main() {
  const argv = process.argv.slice(2);
  const skipBuild = argv.includes('--skip-build');
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;

  if (process.platform !== 'win32') {
    die(
      `本脚本只负责 Windows 产物；当前平台为 ${process.platform}。` +
        `Windows 包只能在 windows-latest 上产出（本机无 makensis、也无法产出 Windows 二进制）；` +
        `需求 §3.3 已把「唯一证明面是 CI」写成硬口径，禁止静默跳过。`,
    );
  }

  const version = assertAligned();
  const arch = archLabel();
  const exeName = artifactName(version, arch, 'win32');
  const exePath = path.join(outDir, exeName);

  const makensis = resolveMakensis();
  if (!makensis) {
    die(
      '未找到 makensis（NSIS）。windows-latest 预装但不在 PATH，本脚本会探测标准安装目录；' +
        '仍找不到说明环境确实缺，属环境缺失，不是跳过理由（CI 里由工作流的安装步骤兜底）。',
    );
  }

  if (!skipBuild) {
    run(process.execPath, [path.join(REPO, 'scripts', 'desktop', 'build.mjs')]);
  }
  if (!fs.existsSync(EXE)) die(`未找到 maestro.exe：${EXE}（先跑 build.mjs）`);

  const staging = path.join(outDir, '.staging-win');
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });

  fs.copyFileSync(EXE, path.join(staging, 'Maestro.exe'));
  const runtimeDir = path.join(staging, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(process.execPath, path.join(runtimeDir, 'node.exe'));
  copyDir(path.join(REPO, 'bin'), path.join(staging, 'bin'));
  copyDir(path.join(REPO, 'src'), path.join(staging, 'src'));
  const uiSrc = path.join(REPO, 'desktop', 'ui');
  if (fs.existsSync(uiSrc)) copyDir(uiSrc, path.join(staging, 'desktop', 'ui'));

  fs.mkdirSync(outDir, { recursive: true });
  const nsiPath = path.join(outDir, '.maestro-installer.nsi');
  fs.writeFileSync(nsiPath, nsiScript({ outFile: exePath, stagingDir: staging, version }), 'utf8');
  run(makensis, ['/V2', nsiPath]);
  fs.rmSync(staging, { recursive: true, force: true });
  fs.rmSync(nsiPath, { force: true });

  if (!fs.existsSync(exePath)) die(`makensis 未产出安装包：${exePath}`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(exePath)).digest('hex');
  fs.appendFileSync(path.join(outDir, 'SHA256SUMS.txt'), `${digest}  ${exeName}\n`);
  log(`产物 ${exePath}（${fs.statSync(exePath).size} bytes）`);
  log(`sha256 ${digest}`);
}

main();
