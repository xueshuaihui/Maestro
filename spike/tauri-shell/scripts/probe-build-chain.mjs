#!/usr/bin/env node
/**
 * ENV-5 / VP-8：桌面壳构建链探测。
 *
 * 区分两件事：
 *   - **运行时可用**：目标机是否装了 WebView2（Tauri 与 Electron 都依赖 webview 运行时/内核）
 *   - **本机可编译**：是否有 Rust + MSVC + Windows SDK（Tauri 编译必需）
 *
 *   node scripts/probe-build-chain.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(HERE, '../../..');
const OUT_DIR = path.join(WORKSPACE, '.orch-spike/runs/vp8');
fs.mkdirSync(OUT_DIR, { recursive: true });

const run = (cmd, args = []) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() };
  } catch (err) {
    return { ok: false, error: err.code === 'ENOENT' ? 'not found' : String(err.message).slice(0, 200) };
  }
};

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

const pf = process.env.ProgramFiles ?? 'C:\\Program Files';
const pf86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
const local = process.env.LOCALAPPDATA ?? '';

const webviewDirs = [path.join(pf86, 'Microsoft\\EdgeWebView\\Application'), path.join(pf, 'Microsoft\\EdgeWebView\\Application')].filter(exists);
const webviewVersions = webviewDirs
  .flatMap((d) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name))
  .filter((v) => /^\d+\./.test(v));

const vswhere = path.join(pf86, 'Microsoft Visual Studio\\Installer\\vswhere.exe');

const evidence = {
  at: new Date().toISOString(),
  platform: `${process.platform} ${process.arch}`,
  node: process.version,
  webview2: { installed: webviewVersions.length > 0, versions: webviewVersions, dirs: webviewDirs },
  rust: {
    rustc: run('rustc', ['--version']),
    cargo: run('cargo', ['--version']),
    cargoHome: exists(path.join(process.env.USERPROFILE ?? '', '.cargo')) ? path.join(process.env.USERPROFILE ?? '', '.cargo') : null,
  },
  msvc: {
    vswhere: exists(vswhere) ? run(vswhere, ['-products', '*', '-property', 'displayName']) : { ok: false, error: 'vswhere missing' },
    linkExeInPath: run('where', ['link.exe']),
    windowsSdkBins: exists(path.join(pf86, 'Windows Kits\\10\\bin'))
      ? fs.readdirSync(path.join(pf86, 'Windows Kits\\10\\bin')).filter((d) => /^\d+\./.test(d))
      : [],
  },
};

evidence.canBuildTauriLocally =
  evidence.rust.rustc.ok && evidence.rust.cargo.ok && evidence.msvc.vswhere.ok && evidence.msvc.windowsSdkBins.length > 0;
evidence.canRunWebviewShellLocally = evidence.webview2.installed;

evidence.conclusion = evidence.canBuildTauriLocally
  ? '本机可直接 tauri build'
  : `本机不能编译 Tauri（缺 ${[
      !evidence.rust.rustc.ok ? 'Rust' : null,
      !evidence.msvc.vswhere.ok ? 'MSVC 构建工具' : null,
      !evidence.msvc.windowsSdkBins.length ? 'Windows SDK' : null,
    ]
      .filter(Boolean)
      .join(' + ')}）；构建归属 GitHub Actions，本机只做运行时验证`;

fs.writeFileSync(path.join(OUT_DIR, 'build-chain.json'), JSON.stringify(evidence, null, 2));
process.stdout.write(JSON.stringify(evidence, null, 2) + '\n');
