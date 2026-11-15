/**
 * WP-11 契约测试 · 产物冒烟（AC-44 机检承载）。
 *
 * 断言面：
 * 1. macOS 面（本机可跑）：构建产物存在 → `smoke.mjs` 四件套全过（exit 0）。
 *    报文逐项断言，避免「脚本 exit 0 但其实一项没跑」。
 * 2. `.dmg` 若已生成：`hdiutil verify` 通过。
 * 3. 跨平台口径：`package-win.mjs` 在非 Windows 平台**必须显式失败**（非零退出 +
 *    可读原因），不允许静默跳过把「没构建」伪装成「成功」。
 * 4. 冒烟脚本不含固定 sleep 判就绪（需求 §3.3「条件成立即继续」）。
 *
 * Windows runner 上第 1/2 条按平台跳过；第 3/4 条在任意平台都跑。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SMOKE = path.join(REPO, 'scripts', 'desktop', 'smoke.mjs');
const PACKAGE_WIN = path.join(REPO, 'scripts', 'desktop', 'package-win.mjs');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');

// 与 bundle.test.js 共用同一把跨进程锁：单实例插件按 bundle identifier 上锁，
// 并行 node --test 文件必须串行启动壳，否则第二个实例立刻 activated 退出、
// 探针永远等不到 ready（全量并发下实测复现）。
const SHELL_LOCK_DIR = path.join(os.tmpdir(), 'maestro-wp1-shell.lock');
const SHELL_LOCK_TTL_MS = 10 * 60 * 1000;

async function withShellLock(fn) {
  for (;;) {
    try {
      fs.mkdirSync(SHELL_LOCK_DIR);
      break;
    } catch {
      try {
        const stat = fs.statSync(SHELL_LOCK_DIR);
        if (Date.now() - stat.mtimeMs > SHELL_LOCK_TTL_MS) {
          fs.rmSync(SHELL_LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(SHELL_LOCK_DIR, { recursive: true, force: true });
  }
}

function findDmg() {
  const dir = path.join(REPO, 'dist', 'release');
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((name) => name.endsWith('.dmg'));
  return hit ? path.join(dir, hit) : null;
}

test('AC-44 macOS 面：冒烟四件套全过', { skip: process.platform !== 'darwin' }, async () => {
  if (!fs.existsSync(APP)) {
    // 未构建则跳过（CI 的构建步骤会先产出；本机跑测试前先 npm run desktop:build）
    return;
  }
  const dmg = findDmg();
  const result = await withShellLock(() => {
    const args = [SMOKE, '--app', APP];
    if (dmg) args.push('--dmg', dmg);
    return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180_000 });
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  assert.equal(result.status, 0, `冒烟应全过，实际 exit ${result.status}\n${output}`);
  for (const label of ['1. 应用可启动', '2. 鉴权守卫', '3. 签名验签']) {
    assert.match(output, new RegExp(`PASS ${label}`), `缺少通过项：${label}\n${output}`);
  }
  if (dmg) {
    assert.match(output, /PASS 4a\. 镜像完整性/, output);
    assert.match(output, /PASS 4b\. 镜像内应用复验/, output);
  }
});

test('AC-44 安装包：dmg 镜像完整性可独立复核', { skip: process.platform !== 'darwin' }, () => {
  const dmg = findDmg();
  if (!dmg) return;
  const r = spawnSync('hdiutil', ['verify', dmg], { encoding: 'utf8' });
  assert.equal(r.status, 0, `hdiutil verify 失败：${r.stderr ?? ''}`);
});

test('AC-44 跨平台口径：非 Windows 平台打包脚本必须显式失败', { skip: process.platform === 'win32' }, () => {
  const r = spawnSync(process.execPath, [PACKAGE_WIN], { encoding: 'utf8', timeout: 60_000 });
  const output = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  assert.notEqual(r.status, 0, '非 Windows 平台必须非零退出，不得静默跳过');
  assert.match(output, /只负责 Windows 产物/, `失败原因必须可读，实际：${output.slice(0, 300)}`);
});

test('AC-40 冒烟脚本不使用固定 sleep 判定就绪', () => {
  const text = fs.readFileSync(SMOKE, 'utf8');
  const offenders = text.split('\n').filter((line) => /sleep\s+\d/.test(line) || /SIGSTOP/.test(line));
  assert.deepEqual(offenders, [], `不得用固定 sleep 判就绪：${offenders.join(' | ')}`);
  assert.match(text, /waitFor|atomex|setTimeout/, '就绪判定必须是条件轮询');
});
