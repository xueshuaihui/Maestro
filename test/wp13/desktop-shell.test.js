/**
 * WP-1 契约测试 · desktop-shell（AC-01 / AC-02 探针序列 + pid + updatedAt 推进）。
 *
 * 断言面：
 * - AC-01：ready（window.visible === true、title === 'Maestro'、view === 'instances'）、
 *   ready.t - launch.t ≤ 3000、tray-created。
 * - AC-02：close-window(visible=false) → tray-still-present(created=true) →
 *   quit-confirm-shown（文案逐字 A-6）→ quit(daemonStopped=true)；
 *   关闭前后 core.json 的 daemon.pid 相等；运行中实例 updatedAt 推进；
 *   退出后核心管道不可连。
 *
 * 夹具纪律（黄色警示 1）：一律直接执行 bundle 内二进制，禁 `open -na`。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILD_SCRIPT = path.join(REPO, 'scripts', 'desktop', 'build.mjs');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const SHELL = path.join(APP, 'Contents', 'MacOS', 'maestro');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

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

function envFor(extra = {}) {
  return { ...process.env, NODE_ENV: 'test', ...extra };
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

/** 只读实例快照：`<root>/.orch/instances/<id>/state.json`（updatedAt / state）。 */
function readState(root, instanceId) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(root, '.orch', 'instances', instanceId, 'state.json'), 'utf8'),
    );
  } catch {
    return null;
  }
}

function pipeAlive(root) {
  return new Promise((resolve) => {
    const socket = net.connect(path.join(root, '.orch', 'core.sock'));
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    setTimeout(() => done(false), 500).unref();
  });
}

// 本条走 `.app` 启动 + Unix socket（`.orch/core.sock`）观测；Windows 侧通道是 HTTP，
// 故非 darwin 显式 SKIP，不冒充通过（AC-44 分区记账）。
test(
  'desktop-shell: ready probe + close-to-tray + quit confirm flow (AC-01/02)',
  { skip: process.platform !== 'darwin' },
  (t) => withShellLock(async () => {
  ensureBundle(t);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-shell-'));
  const probeFile = path.join(root, 'probe.jsonl');
  const ctlDir = path.join(root, 'ctl');
  fs.mkdirSync(ctlDir, { recursive: true });

  // mock 宿主两份：mock（默认，快速推进）+ slow（accept-delay 60s，保持运行中）。
  const hostDir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(hostDir, { recursive: true });
  fs.writeFileSync(
    path.join(hostDir, 'mock.json'),
    JSON.stringify({
      transport: 'stdio',
      launch: { command: process.execPath, args: [MOCK] },
      limits: { ...LIMITS },
    }, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(hostDir, 'slow.json'),
    JSON.stringify({
      transport: 'stdio',
      launch: { command: process.execPath, args: [MOCK, '--accept-delay-ms', '60000'] },
      // accept-delay 60s 必须长于宿主等待预算，否则实例会被判超时而离开运行态
      limits: { ...LIMITS, initializeTimeoutMs: 120_000, requestTimeoutMs: 120_000, promptTimeoutMs: 180_000 },
    }, null, 2),
    'utf8',
  );

  const child = spawn(SHELL, ['--project', root, '--probe', probeFile, '--ctl', ctlDir], {
    env: envFor(),
    stdio: 'ignore',
  });
  let quitRequested = false;
  t.after(async () => {
    if (quitRequested) return;
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    spawnSync(process.execPath, [BIN, 'core', 'stop'], { cwd: root, env: envFor(), timeout: 20_000, windowsHide: true });
    fs.rmSync(root, { recursive: true, force: true });
  });

  // AC-01：探针 ready（visible/title/view + 3s 预算）
  const ready = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'ready'));
  assert.ok(ready, 'ready event missing');
  const launch = readProbe(probeFile).find((e) => e.event === 'launch');
  assert.ok(launch, 'launch event missing');
  assert.ok(ready.t - launch.t <= 3000, `ready.t - launch.t = ${ready.t - launch.t} > 3000`);
  assert.equal(ready.window.visible, true);
  assert.equal(ready.window.title, 'Maestro');
  assert.equal(ready.view, 'instances');
  const created = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-created'));
  assert.ok(created && created.created === true, 'tray-created missing');

  // 等 daemon 就绪，记 pid
  const coreBefore = await waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
    } catch {
      return null;
    }
  });
  assert.ok(coreBefore, 'core.json missing');
  const daemonPid = coreBefore.pid;

  // 等核心管道真正可连（core.json 落盘与 accept 之间仍有窗口）
  const pipeReady = await waitFor(() => pipeAlive(root), 15_000);
  assert.ok(pipeReady, 'core pipe never became connectable');

  // 启动 INST-001（mock）：多轮状态写入，驱动 updatedAt 推进断言。
  const runChild = spawn(process.execPath, [BIN, 'run', '--cwd', root, '--template', 'single', '--host', 'mock', '--task', '写一份说明'], {
    cwd: root,
    env: envFor(),
    stdio: 'ignore',
  });
  t.after(() => {
    if (runChild.exitCode === null && runChild.signalCode === null) runChild.kill('SIGKILL');
  });

  // 关闭前基准：INST-001 的 updatedAt（U1）
  const status1 = await waitFor(() => {
    const snapshot = readState(root, 'INST-001');
    return snapshot && snapshot.updatedAt ? snapshot : null;
  });
  assert.ok(status1, 'instance state.json missing before close');

  // 关窗缩托盘：close-window → tray-still-present；daemon.pid 不变
  runCtl(ctlDir, 'close-window');
  const closed = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'close-window'));
  assert.ok(closed, 'close-window event missing');
  assert.equal(closed.window.visible, false);
  const still = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-still-present'));
  assert.ok(still && still.created === true, 'tray-still-present missing');
  const coreAfterClose = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
  assert.equal(coreAfterClose.pid, daemonPid, 'daemon.pid changed across close-window');

  // 关闭后 updatedAt 仍推进（U2 ≠ U1）：后台 daemon 没有被打断
  const updated = await waitFor(() => {
    const snapshot = readState(root, 'INST-001');
    return snapshot && snapshot.updatedAt && snapshot.updatedAt !== status1.updatedAt ? snapshot : null;
  }, 30_000);
  assert.ok(updated, 'updatedAt did not advance after close-window (AC-02)');

  // 等 INST-001 终局（消除实例号/宿主竞态），再串行启动 INST-002（slow，60s
  // accept-delay 使其保持运行中），驱动退出确认计数——窗口隐藏期间 daemon
  // 继续接受新任务，正是 AC-02 的用户语义。
  await waitFor(() => {
    const snapshot = readState(root, 'INST-001');
    return snapshot && ['completed', 'failed', 'cancelled', 'interrupted'].includes(snapshot.state);
  }, 60_000);
  const runChildSlow = spawn(process.execPath, [BIN, 'run', '--cwd', root, '--template', 'single', '--host', 'slow', '--task', '写一份说明'], {
    cwd: root,
    env: envFor(),
    stdio: 'ignore',
  });
  t.after(() => {
    if (runChildSlow.exitCode === null && runChildSlow.signalCode === null) runChildSlow.kill('SIGKILL');
  });
  const inst2 = await waitFor(() => {
    const snapshot = readState(root, 'INST-002');
    return snapshot && ['running', 'created', 'suspended'].includes(snapshot.state) ? snapshot : null;
  });
  assert.ok(inst2, `INST-002 (slow) not in a running state before quit: ${JSON.stringify(readState(root, 'INST-002'))}`);

  // 托盘退出：运行中实例 → 确认句（A-6 逐字）→ 确认 → quit(daemonStopped=true)
  runCtl(ctlDir, 'tray-quit');
  const confirm = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'quit-confirm-shown'));
  assert.ok(confirm, 'quit-confirm-shown missing');
  assert.equal(confirm.text, '有 1 个实例正在运行，退出将停止守护进程');

  quitRequested = true;
  runCtl(ctlDir, 'tray-quit-confirm');
  const exitCode = await Promise.race([
    new Promise((resolve) => child.once('exit', (code) => resolve(code))),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 30_000)),
  ]);
  assert.notEqual(exitCode, 'timeout', 'shell did not exit after confirmed quit');
  const quit = readProbe(probeFile).find((e) => e.event === 'quit');
  assert.ok(quit, 'quit event missing');
  assert.equal(quit.daemonStopped, true, 'daemonStopped not true');

  // 退出后核心管道不可连（daemon.alive === false）
  assert.equal(await pipeAlive(root), false, 'core pipe still alive after quit');
  if (runChild.exitCode === null && runChild.signalCode === null) {
    runChild.kill('SIGKILL');
  }
  fs.rmSync(root, { recursive: true, force: true });
}));
