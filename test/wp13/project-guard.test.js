/**
 * WP-1 契约测试 · project-guard（AC-31）。
 *
 * 三次启动（直接执行 bundle 内二进制，禁 `open -na`）：
 * 1. 无 --project、配置目录无 projects.json → view = project-missing，
 *    提示文本逐字 A-3「项目 未指定 · 请填写项目目录」；
 * 2. --project 指向不存在目录 → view = project-invalid，
 *    提示文本逐字「项目 不可用 · <path>」（可变值按 A-0 替换）；
 * 3. --project 可用目录 → view = instances。
 * 每次窗口 visible === true；无未捕获异常事件；收尾经 tray-quit 直接退出
 * （0 运行实例不弹确认）。
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

function readProbe(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
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

function exitAndWait(child, timeoutMs = 60_000) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(child.exitCode);
    });
  });
}

/** 诊断：壳超时未退时抓一份调用栈（macOS `sample`，写 /tmp 供排查）。 */
function sampleShell(pid) {
  const outFile = `/tmp/maestro-shell-sample-${pid}.txt`;
  try {
    const result = spawnSync('/usr/bin/sample', [String(pid), '2', '-file', outFile], {
      encoding: 'utf8',
      timeout: 15_000,
    });
    return result.status === 0 ? `(full stack written to ${outFile})` : `(sample exit ${result.status})`;
  } catch (err) {
    return `(sample failed: ${err.message})`;
  }
}

/** 启动一次壳，断言 ready 的 view 与 message，最后经 tray-quit 收尾。 */
async function launchAndCheck(t, { argvExtra, configDir, expectedView, expectedMessage }) {
  const probeFile = path.join(configDir, `probe-${expectedView}.jsonl`);
  const ctlDir = path.join(configDir, `ctl-${expectedView}`);
  fs.mkdirSync(ctlDir, { recursive: true });
  const argv = ['--probe', probeFile, '--ctl', ctlDir, ...argvExtra];
  const child = spawn(SHELL, argv, {
    env: { ...process.env, NODE_ENV: 'test', MAESTRO_CONFIG_DIR: configDir },
    stdio: 'ignore',
  });
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });

  const ready = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'ready'));
  assert.ok(ready, `ready missing for view=${expectedView}`);
  assert.equal(ready.view, expectedView);
  assert.equal(ready.window.visible, true, `window not visible for view=${expectedView}`);
  assert.equal(ready.message, expectedMessage, `message mismatch for view=${expectedView}`);

  // 无未捕获异常事件（探针里不应有 crash/error 类事件）
  const bad = readProbe(probeFile).find(
    (e) => e.event === 'uncaught-exception' || e.event === 'crash' || e.event === 'error',
  );
  assert.equal(bad, undefined, 'unexpected failure event in probe');

  // 收尾：无运行实例 → 直接退出（退出码不作判定）
  runCtl(ctlDir, 'tray-quit');
  const exitCode = await exitAndWait(child);
  if (exitCode === 'timeout') {
    const tail = readProbe(probeFile).slice(-14).map((e) => JSON.stringify(e)).join('\n');
    const ctlList = fs.existsSync(ctlDir) ? fs.readdirSync(ctlDir).join(', ') : '(missing)';
    const stack = sampleShell(child.pid);
    const stackHead = stack.split('\n').filter((l) => /maestro|quit|lock|wait|call|Thread|private|start_wqthread|read|poll|select|__psynch|kevent/.test(l)).slice(0, 60).join('\n');
    assert.fail(`shell did not exit for view=${expectedView}; probe tail:\n${tail}\nctl dir: ${ctlList}\n--- sample(pid=${child.pid}) ---\n${stackHead}`);
  }
  const quit = readProbe(probeFile).find((e) => e.event === 'quit');
  assert.ok(quit, `quit event missing for view=${expectedView}`);
}

// 夹具走 macOS bundle 启动壳进程；非 darwin 无 `.app`，显式 SKIP（不冒充通过）。
test('project-guard: missing / invalid / valid views (AC-31)', { skip: process.platform !== 'darwin' }, (t) => withShellLock(async () => {
  ensureBundle(t);
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-proj-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));

  // 现场一：配置目录为空、不带 --project → project-missing
  const cfgA = path.join(fixture, 'config-empty');
  fs.mkdirSync(cfgA, { recursive: true });
  await launchAndCheck(t, {
    argvExtra: [],
    configDir: cfgA,
    expectedView: 'project-missing',
    expectedMessage: '项目 未指定 · 请填写项目目录',
  });

  // 现场二：--project 指向不存在目录 → project-invalid（可变值 = 实际路径）
  const nope = path.join(fixture, 'nope');
  const cfgB = path.join(fixture, 'config-invalid');
  fs.mkdirSync(cfgB, { recursive: true });
  await launchAndCheck(t, {
    argvExtra: ['--project', nope],
    configDir: cfgB,
    expectedView: 'project-invalid',
    expectedMessage: `项目 不可用 · ${nope}`,
  });

  // 现场三：--project 可用目录 → instances
  const valid = path.join(fixture, 'valid');
  fs.mkdirSync(valid, { recursive: true });
  const cfgC = path.join(fixture, 'config-valid');
  fs.mkdirSync(cfgC, { recursive: true });
  await launchAndCheck(t, {
    argvExtra: ['--project', valid],
    configDir: cfgC,
    expectedView: 'instances',
    expectedMessage: '',
  });
}));
