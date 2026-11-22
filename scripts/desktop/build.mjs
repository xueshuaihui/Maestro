#!/usr/bin/env node
/**
 * Maestro desktop build (pure Node, zero npm dependencies).
 *
 * Steps:
 *   1. Copy the compile-time shell UI (first-run project picker) into the
 *      Tauri `frontendDist`.
 *   2. `cargo build --release` in desktop/src-tauri.
 *   3. Hand-assemble the .app bundle:
 *        Maestro.app/Contents/MacOS/maestro            (cargo binary)
 *        Maestro.app/Contents/Resources/runtime/node   (local node binary)
 *        Maestro.app/Contents/Resources/bin/ + src/    (repo runtime sources)
 *        Maestro.app/Contents/Resources/desktop/ui/    (served at /ui/)
 *   4. Ad-hoc codesign (`codesign --sign -`).
 *
 * Output: desktop/src-tauri/target/release/bundle/macos/Maestro.app
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 品牌标识唯一几何来源（窗口 PNG / Windows ICO / 矢量母版共用同一份定义）。
import { writeIconPng, writeIconIco, writeBrandSvg } from './brand.mjs';

// 版本号唯一来源（需求 v4 裁决 U-13 / AC-41）：本文件不得再写版本字面量。
import { readVersion, REPO as VERSION_REPO } from './version.mjs';

const REPO = VERSION_REPO;
const VERSION = readVersion();
const SRC_TAURI = path.join(REPO, 'desktop', 'src-tauri');
const TARGET = path.join(SRC_TAURI, 'target');
const APP = path.join(TARGET, 'release', 'bundle', 'macos', 'Maestro.app');

function log(message) {
  process.stdout.write(`[desktop-build] ${message}\n`);
}

function die(message, result) {
  const detail = result ? `${result.stdout ?? ''}\n${result.stderr ?? ''}` : '';
  process.stderr.write(`[desktop-build] FAIL: ${message}\n${detail}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  log(`${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', ...options });
  if (result.status !== 0) die(`${command} exited ${result.status}`, result);
  return result;
}

// 1. Compile-time shell UI: the first-run project picker. The orchestration UI
// itself is served by the daemon at /ui/; this page only runs before a project
// root is bound and hands the root to the shell.
const placeholderDir = path.join(TARGET, 'ui-placeholder');
const shellUiSrc = path.join(REPO, 'desktop', 'shell-ui', 'index.html');
if (!fs.existsSync(shellUiSrc)) die(`shell UI missing: ${shellUiSrc}`);
fs.rmSync(placeholderDir, { recursive: true, force: true });
fs.mkdirSync(placeholderDir, { recursive: true });
fs.copyFileSync(shellUiSrc, path.join(placeholderDir, 'index.html'));

// 1b. Compile-time window icon (PNG generated in-process, zero dependencies).
writeIconPng(path.join(TARGET, 'icon.png'));

// 1c. Windows resource icon. `tauri-build` requires `icons/icon.ico` for the
// Windows target (missing file fails the build outright); it is generated here
// so no binary is committed and no dependency is added.
writeIconIco(path.join(SRC_TAURI, 'icons', 'icon.ico'));

// 1d. Vector masters for the web UI (favicon + inline brand), written into
// `desktop/ui/brand` so both dev and bundle layouts serve them at /ui/brand/.
writeBrandSvg(path.join(REPO, 'desktop', 'ui', 'brand'));

// 2. cargo build --release
run('cargo', ['build', '--release'], { cwd: SRC_TAURI });

// Windows produces `maestro.exe`; macOS/Linux produce `maestro`.
const binName = process.platform === 'win32' ? 'maestro.exe' : 'maestro';
const binPath = path.join(TARGET, 'release', binName);
if (!fs.existsSync(binPath)) die(`cargo binary missing: ${binPath}`);

if (process.platform !== 'darwin') {
  // Windows / Linux: no `.app`, no macOS-only codesign. The installable package
  // is produced by `package-win.mjs` (Windows) using the binary cargo just built.
  log(`binary ready: ${binPath}`);
} else {
  // 3. Assemble the bundle from scratch.
  fs.rmSync(APP, { recursive: true, force: true });
  const contents = path.join(APP, 'Contents');
  const macosDir = path.join(contents, 'MacOS');
  const resDir = path.join(contents, 'Resources');
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  fs.copyFileSync(binPath, path.join(macosDir, 'maestro'));
  fs.chmodSync(path.join(macosDir, 'maestro'), 0o755);

  fs.writeFileSync(
    path.join(contents, 'Info.plist'),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
      '<plist version="1.0"><dict>',
      '  <key>CFBundleName</key><string>Maestro</string>',
      '  <key>CFBundleDisplayName</key><string>Maestro</string>',
      '  <key>CFBundleIdentifier</key><string>com.maestro.desktop</string>',
      '  <key>CFBundleExecutable</key><string>maestro</string>',
      '  <key>CFBundlePackageType</key><string>APPL</string>',
      `  <key>CFBundleShortVersionString</key><string>${VERSION}</string>`,
      `  <key>CFBundleVersion</key><string>${VERSION}</string>`,
      '  <key>LSMinimumSystemVersion</key><string>10.13</string>',
      '  <key>NSHighResolutionCapable</key><true/>',
      '</dict></plist>',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(contents, 'PkgInfo'), 'APPL????\n', 'utf8');

  // Bundled interpreter: copy the local node binary (build machine needs node;
  // user machines do not). Absolute in-package path is used at spawn time.
  const runtimeDir = path.join(resDir, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.copyFileSync(process.execPath, path.join(runtimeDir, 'node'));
  fs.chmodSync(path.join(runtimeDir, 'node'), 0o755);

  // Runtime sources: bin/ + src/ (+ desktop/ui when the UI batch has landed).
  copyDir(path.join(REPO, 'bin'), path.join(resDir, 'bin'));
  copyDir(path.join(REPO, 'src'), path.join(resDir, 'src'));
  const uiSrc = path.join(REPO, 'desktop', 'ui');
  if (!fs.existsSync(path.join(uiSrc, 'index.html'))) {
    die(`desktop UI missing: ${path.join(uiSrc, 'index.html')}`);
  }
  copyDir(uiSrc, path.join(resDir, 'desktop', 'ui'));

  function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) copyDir(from, to);
      else fs.copyFileSync(from, to);
    }
  }

  // 4. Ad-hoc signature (notarization is not required for this iteration).
  run('codesign', ['--force', '--deep', '--sign', '-', APP]);

  log(`bundle ready: ${APP}`);
}
