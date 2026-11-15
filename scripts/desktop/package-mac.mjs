#!/usr/bin/env node
/**
 * macOS 安装包生成（`.dmg`）——需求 AC-39 / AC-44。
 *
 * 步骤（参考实现同构，但不引入任何 npm 依赖）：
 *   1. 清理残留挂载点（hdiutil detach；残留会让 create 报 "Resource busy"）
 *   2. 校验版本三处对齐（AC-41）
 *   3. 组装 staging（只放已签名的 Maestro.app）
 *   4. codesign --verify --deep --strict（签名不到位就不打包）
 *   5. hdiutil create → hdiutil verify（镜像完整性）
 *   6. 输出 SHA-256
 *
 * 每个架构只生成一次镜像（二次生成会挤爆 runner 磁盘）。
 *
 * 用法：node scripts/desktop/package-mac.mjs [--skip-build] [--out <dir>]
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { REPO, artifactName, assertAligned, archLabel } from './version.mjs';

const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const DEFAULT_OUT = path.join(REPO, 'dist', 'release');

function log(msg) {
  process.stdout.write(`[package-mac] ${msg}\n`);
}

function die(msg) {
  process.stderr.write(`[package-mac] FAIL: ${msg}\n`);
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

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

/** 卸载所有挂载点里指向本仓 target 的镜像（幂等；失败不致命）。 */
function detachStaleMounts() {
  const info = spawnSync('hdiutil', ['info'], { encoding: 'utf8' });
  if (info.status !== 0) return;
  const blocks = String(info.stdout ?? '').split(/\n={4,}\n/);
  for (const block of blocks) {
    if (!block.includes('Maestro.app') && !block.includes('Maestro_')) continue;
    for (const line of block.split('\n')) {
      if (!line.includes('/Volumes/')) continue;
      const mount = line.slice(line.indexOf('/Volumes/')).trim().split(/\s{2,}/)[0];
      log(`cleanup: hdiutil detach ${mount}`);
      spawnSync('hdiutil', ['detach', mount, '-force'], { stdio: 'ignore' });
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  const skipBuild = argv.includes('--skip-build');
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : DEFAULT_OUT;

  if (process.platform !== 'darwin') {
    die(`本脚本只负责 macOS 产物；当前平台为 ${process.platform}（Windows 见 package-win.mjs）`);
  }

  const version = assertAligned();
  const arch = archLabel();
  const dmgName = artifactName(version, arch, 'darwin');
  const dmgPath = path.join(outDir, dmgName);

  if (!skipBuild) {
    run(process.execPath, [path.join(REPO, 'scripts', 'desktop', 'build.mjs')]);
  }
  if (!fs.existsSync(APP)) die(`未找到 .app：${APP}（先跑 build.mjs）`);

  detachStaleMounts();

  // 签名不到位不打包：AC-44 要求「双击不报已损坏」。
  run('codesign', ['--force', '--deep', '--sign', '-', APP]);
  run('codesign', ['--verify', '--deep', '--strict', APP]);

  fs.mkdirSync(outDir, { recursive: true });
  fs.rmSync(dmgPath, { force: true });

  const staging = path.join(outDir, '.staging-mac');
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  run('cp', ['-R', APP, path.join(staging, 'Maestro.app')]);

  run('hdiutil', [
    'create',
    '-volname', 'Maestro',
    '-srcfolder', staging,
    '-ov',
    '-format', 'UDZO',
    dmgPath,
  ]);
  fs.rmSync(staging, { recursive: true, force: true });

  run('hdiutil', ['verify', dmgPath]);

  const digest = sha256(dmgPath);
  const sums = path.join(outDir, 'SHA256SUMS.txt');
  fs.appendFileSync(sums, `${digest}  ${dmgName}\n`);
  log(`产物 ${dmgPath}（${fs.statSync(dmgPath).size} bytes）`);
  log(`sha256 ${digest}`);
}

main();
