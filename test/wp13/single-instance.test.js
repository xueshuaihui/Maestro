/**
 * WP-1 契约测试 · single-instance（AC-36）。
 *
 * 断言面：第二次直接执行壳二进制（模拟重复双击，禁 `open -na`）后：
 * - 探针不出现第二个 ready；
 * - 探针出现 activated；
 * - daemon.pid 前后相等（core.json）；
 * - close-window 隐藏后经 tray-open 打开：探针 tray-open {window.visible=true}
 *   且视图仍为 instances。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD_SCRIPT = path.join(REPO, 'scripts', 'desktop', 'build.mjs');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const SHELL = path.join(APP, 'Contents', 'MacOS', 'maestro');

// Cross-process mutex around shell launches: the single-instance plugin keys
// the lock on the bundle identifier, so parallel node --test files must
// serialize shell launches. Zero dependencies (mkdir lock + stale TTL).
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

function ensureBundle(t) {
  if (fs.existsSync(SHELL)) return;
  const result = spawnSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf8', timeout: 900_000 });
  assert.equal(result.status, 0, `desktop build failed:\n${result.stdout}\n${result.stderr}`);
}

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function readProbe(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function countEvent(events, name) {
  return events.filter((e) => e.event === name).length;
}

async function waitFor(makeValue, timeoutMs = 30_000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function runCtl(ctlDir, name) {
  fs.mkdirSync(path.join(ctlDir, name), { recursive: true });
}

function exitAndWait(child, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(child.exitCode);
    });
  });
}

test('single-instance: no second ready, activated, pid equal, tray-open reopens (AC-36)', (t) => withShellLock(async () => {
  ensureBundle(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-single-'));
  const probeFile = path.join(root, 'probe.jsonl');
  const ctlDir = path.join(root, 'ctl');
  fs.mkdirSync(ctlDir, { recursive: true });

  const argv = ['--project', root, '--probe', probeFile, '--ctl', ctlDir];
  const first = spawn(SHELL, argv, { env: envFor(), stdio: 'ignore' });
  let stopped = false;
  const stopOnce = () => {
    if (stopped) return;
    stopped = true;
    if (first.exitCode === null && first.signalCode === null) first.kill('SIGKILL');
    fs.rmSync(root, { recursive: true, force: true });
  };
  t.after(stopOnce);

  const ready = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'ready'));
  assert.ok(ready, 'first launch ready missing');
  assert.equal(countEvent(readProbe(probeFile), 'ready'), 1);

  const core1 = await waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
    } catch {
      return null;
    }
  });
  assert.ok(core1, 'core.json missing after first launch');
  const daemonPid = core1.pid;

  // 第二次启动（模拟重复双击）：第二进程自行退出，退出码不作判定
  const second = spawn(SHELL, argv, { env: envFor(), stdio: 'ignore' });
  const secondExit = await exitAndWait(second);
  assert.notEqual(secondExit, 'timeout', 'second launch did not exit');

  const activated = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'activated'));
  assert.ok(activated, 'activated event missing');
  assert.equal(countEvent(readProbe(probeFile), 'ready'), 1, 'second ready appeared (AC-36)');

  const core2 = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
  assert.equal(core2.pid, daemonPid, 'daemon pid changed after second launch');

  // close-window 隐藏 → tray-open 激活（visible=true，视图仍 instances）
  runCtl(ctlDir, 'close-window');
  await waitFor(() => readProbe(probeFile).find((e) => e.event === 'close-window'));
  runCtl(ctlDir, 'tray-open');
  const reopen = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-open'));
  assert.ok(reopen, 'tray-open event missing');
  assert.equal(reopen.window.visible, true);
  assert.equal(reopen.view, 'instances');

  // 收尾：0 运行实例 → 直接退出
  runCtl(ctlDir, 'tray-quit');
  const exitCode = await exitAndWait(first);
  assert.notEqual(exitCode, 'timeout', 'first shell did not exit after tray-quit');
  stopOnce();
}));
