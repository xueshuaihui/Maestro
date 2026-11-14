/**
 * WP-1 契约测试 · bundle（最短打包验证 / AC-29 机检承载）。
 *
 * 断言面：
 * 1. 构建产物存在且可执行：Maestro.app/Contents/MacOS/maestro。
 * 2. 包内解释器可执行：Contents/Resources/runtime/node 真跑通。
 * 3. 包内运行时源码齐备：src/daemon/serve-entry.js、bin/orch.js。
 * 4. 收窄环境（PATH=/usr/bin:/bin、无 NODE_ENV/MAESTRO_*）下 `which node` 非零，
 *    且直接执行壳二进制（黄色警示 1：禁 `open -na`）能起来：
 *    探针 ready ≤ 3000ms + tray-created + view === 'instances'。
 * 5. daemon 子进程拉起：`<root>/.orch/core.json` 出现（pid 字段）。
 * 6. ctl open-instance 接缝：探针 view === 'graph'。
 * 7. 托盘退出：0 运行实例时直接退出，探针 quit(daemonStopped=true)。
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
const BUNDLED_NODE = path.join(APP, 'Contents', 'Resources', 'runtime', 'node');

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
  t.after(() => {});
}

function tmpRoot(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i10a-bundle-${tag}-`));
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

function exitAndWait(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
    child.once('exit', (code) => resolve(code));
  });
}

test('bundle: artifacts + bundled node + narrowed-env launch + seams + quit', (t) => withShellLock(async () => {
  ensureBundle(t);
  assert.equal(fs.existsSync(APP), true, 'Maestro.app missing');
  assert.equal(fs.existsSync(SHELL), true, 'shell binary missing');
  const mode = fs.statSync(SHELL).mode & 0o111;
  assert.notEqual(mode, 0, 'shell binary not executable');

  // 包内解释器可执行且真跑通
  assert.equal(fs.existsSync(BUNDLED_NODE), true, 'bundled runtime node missing');
  const nodeRun = spawnSync(BUNDLED_NODE, ['-e', "process.stdout.write('bundled-ok')"], {
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(nodeRun.status, 0, nodeRun.stderr);
  assert.equal(nodeRun.stdout, 'bundled-ok');

  // 包内运行时源码齐备
  assert.equal(
    fs.existsSync(path.join(APP, 'Contents', 'Resources', 'src', 'daemon', 'serve-entry.js')),
    true,
    'serve-entry.js not bundled',
  );
  assert.equal(
    fs.existsSync(path.join(APP, 'Contents', 'Resources', 'bin', 'orch.js')),
    true,
    'bin/orch.js not bundled',
  );

  // 收窄环境下 which node 非零（该环境确实没有 node）
  const narrowEnv = { PATH: '/usr/bin:/bin', HOME: os.tmpdir(), TMPDIR: os.tmpdir() };
  const which = spawnSync('/usr/bin/which', ['node'], { env: narrowEnv, encoding: 'utf8' });
  assert.notEqual(which.status, 0, 'PATH=/usr/bin:/bin unexpectedly resolves node');

  // 收窄环境直接执行壳二进制（禁 open -na）
  const root = tmpRoot('run');
  const probeFile = path.join(root, 'probe.jsonl');
  const ctlDir = path.join(root, 'ctl');
  fs.mkdirSync(ctlDir, { recursive: true });
  const child = spawn(SHELL, ['--project', root, '--probe', probeFile, '--ctl', ctlDir], {
    env: narrowEnv,
    stdio: 'ignore',
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  const events = await waitFor(() => {
    const list = readProbe(probeFile);
    return list.find((e) => e.event === 'ready');
  });
  assert.ok(events, 'probe ready event never appeared');
  const launch = readProbe(probeFile).find((e) => e.event === 'launch');
  assert.ok(launch, 'launch event missing');
  assert.ok(events.t - launch.t <= 3000, `ready.t - launch.t = ${events.t - launch.t} > 3000`);
  assert.equal(events.window.visible, true);
  assert.equal(events.window.title, 'Maestro');
  assert.equal(events.view, 'instances');

  const created = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-created'));
  assert.ok(created, 'tray-created missing');
  assert.equal(created.created, true);

  // daemon 子进程被壳拉起（core.json 有 pid）
  const coreMeta = await waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
    } catch {
      return null;
    }
  });
  assert.ok(coreMeta, 'daemon core.json never appeared');
  assert.ok(Number.isInteger(coreMeta.pid) && coreMeta.pid > 0, 'core.json pid invalid');

  // ctl open-instance seam -> the shell records a request and asks the live
  // window to open the graph (decision T/W). The counted `graph-shown` event
  // is emitted by the window after rendering and is covered by the shell case
  // in `acceptance-e2e.test.js`, not by this ctl-only probe check.
  fs.mkdirSync(path.join(ctlDir, 'open-instance'), { recursive: true });
  fs.mkdirSync(path.join(ctlDir, 'open-instance', 'INST-999'), { recursive: true });
  const graph = await waitFor(() => {
    return readProbe(probeFile).find((e) => e.event === 'graph-open-request');
  });
  assert.ok(graph, 'graph-open-request missing');
  assert.equal(graph.view, 'graph');
  assert.equal(graph.instanceId, 'INST-999');

  // 0 运行实例 → 托盘退出直接退出
  runCtl(ctlDir, 'tray-quit');
  const exitCode = await Promise.race([
    exitAndWait(child),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 30_000)),
  ]);
  assert.notEqual(exitCode, 'timeout', 'shell did not exit after tray-quit');
  const quit = readProbe(probeFile).find((e) => e.event === 'quit');
  assert.ok(quit, 'quit event missing');
  assert.equal(quit.daemonStopped, true, 'daemonStopped not true');
}));
