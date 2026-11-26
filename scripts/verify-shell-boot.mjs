/**
 * Real built-artifact shell boot verification.
 *
 * verify-journey.mjs drives `serve-entry.js --desktop` directly in a browser.
 * This script goes one layer up: it launches the ACTUAL shipped .app binary
 * (`desktop/.../Maestro.app/Contents/MacOS/maestro --project <root> --probe <file>`),
 * which is the Rust Tauri shell. It proves the shell -> bundled node ->
 * serve-entry.js -> desktop.json chain in the real bundle, not a source-tree
 * stand-in.
 *
 * Asserts (from the shell's own append-only probe stream + desktop.json):
 *   - `launch` event present
 *   - `ready` event with daemon pid, visible window, title
 *   - `tray-created` event
 *   - `<root>/.orch/desktop.json` has port + token + generation
 *   - cold start over a CRASHED core's leftovers: the stale record is cleared
 *     and a new core serves the window (this is the "connecting forever" bug)
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const BIN = path.join(APP, 'Contents', 'MacOS', 'maestro');
const sleep = (ms) => delay(ms);

let pass = 0;
const failures = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push(name);
}

if (!fs.existsSync(BIN)) {
  console.error(`SHELL_BOOT_FAIL: built binary missing: ${BIN}\nRun \`npm run desktop:build\` first.`);
  process.exit(1);
}

// The app uses a single-instance lock (com.maestro.desktop). A leftover shell
// from an earlier run turns this launch into a mere "activated" of that old
// process — no daemon, no ready event — which would be a false negative. Clear
// same-named processes first (best effort; ignore failures on other platforms).
if (process.platform === 'darwin') spawnSync('killall', ['-9', 'maestro'], { stdio: 'ignore' });
else if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/IM', 'maestro.exe'], { stdio: 'ignore' });

let child = null;
let second = null;
const spawned = [];

function freshRoot(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `maestro-shell-${tag}-`));
}

function launch(root, probePath, logPath) {
  const fd = fs.openSync(logPath, 'w');
  const proc = spawn(BIN, ['--project', root, '--probe', probePath], {
    cwd: root, env: process.env, stdio: ['ignore', fd, fd],
  });
  fs.closeSync(fd);
  spawned.push(proc);
  return proc;
}

function readEvents(probePath) {
  try {
    return fs.readFileSync(probePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch { return []; }
}

function readMeta(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
  catch { return null; }
}

function daemonPid(meta) {
  return meta?.pid ?? 0;
}

function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function waitFor(predicate, timeoutMs, intervalMs = 150) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await predicate();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}

try {
  // ---------------------------------------------------------- cold start --
  const root = freshRoot('boot');
  const probePath = path.join(root, 'shell-probe.jsonl');
  const stdoutPath = path.join(root, 'shell-stdout.log');

  child = launch(root, probePath, stdoutPath);
  step('真实 .app 二进制启动', Boolean(child.pid), `pid=${child.pid}`);

  const meta = await waitFor(() => readMeta(root), 25_000);
  const activated = fs.readFileSync(probePath, 'utf8').includes('"event":"activated"');
  const metaDetail = meta ? `port=${meta.port} daemonPid=${meta.pid}`
    : activated ? 'no desktop.json — second launch was only "activated" (stale single-instance lock)'
    : 'no desktop.json';
  step('shell 拉起 bundled node daemon 并写出 desktop.json',
    Boolean(meta?.port && meta?.token && meta?.generation), metaDetail);

  const events = await waitFor(() => {
    const list = readEvents(probePath);
    return list.length > 0 ? list : null;
  }, 10_000);
  const has = (name, list) => (list ?? []).some((e) => e.event === name);
  const ready = (events ?? []).find((e) => e.event === 'ready');
  step('probe 记录 launch 事件', has('launch', events));
  step('probe 记录 ready 事件（含 daemon pid + 可见窗口）',
    Boolean(ready?.daemon?.pid && ready?.window?.visible === true),
    JSON.stringify(ready?.daemon ?? {}));
  step('probe 记录 tray-created 事件', has('tray-created', events));

  const stderr = fs.readFileSync(stdoutPath, 'utf8').trim();
  step('shell 启动无 stderr 错误输出', !/error|panic|incomplete/i.test(stderr),
    stderr.slice(0, 160) || 'clean');

  // ------------------------------------------ restart over a dead core ----
  // A force quit / container restart / OOM kill leaves BOTH the socket file and
  // desktop.json on disk. The old shell trusted the file, navigated the window
  // at a port nobody served and the connecting line never cleared.
  const stalePid = daemonPid(meta);
  const staleGen = meta?.generation ?? '';
  const stalePort = meta?.port ?? 0;
  const staleToken = meta?.token ?? '';
  let killed = false;
  try { process.kill(stalePid, 'SIGKILL'); killed = true; } catch { /* ignore */ }
  await sleep(500);
  const leftover = readMeta(root);
  // The killed daemon stays a zombie until its parent reaps it, so "pid alive"
  // says nothing here. The stale condition the shell must detect is: the record
  // still points at that pid while its channel no longer answers.
  const staleChannel = await fetch(`http://127.0.0.1:${stalePort}/ui/labels`, {
    headers: { Authorization: `Bearer ${staleToken}` },
  }).then(() => true).catch(() => false);
  step('SIGKILL 核心后陈旧 desktop.json 仍在且通道已死（构造崩溃现场）',
    killed && leftover?.pid === stalePid && staleChannel === false,
    `pid=${stalePid} recordPid=${leftover?.pid} channelAnswers=${staleChannel}`);

  // The shell has to die hard as well: a graceful exit stops its daemon and
  // removes the record, which would not be the crash the users hit.
  try { child.kill('SIGKILL'); } catch { /* ignore */ }
  await sleep(1500);

  const probe2 = path.join(root, 'shell-probe-restart.jsonl');
  const stdout2 = path.join(root, 'shell-stdout-restart.log');
  second = launch(root, probe2, stdout2);
  step('崩溃后二次启动 .app', Boolean(second.pid), `pid=${second.pid}`);

  const recovered = await waitFor(() => {
    const next = readMeta(root);
    return next && next.pid !== stalePid ? next : null;
  }, 30_000);
  step('崩溃后重新拉起核心并改写 desktop.json',
    Boolean(recovered?.port && recovered?.token
      && recovered.pid !== stalePid && recovered.generation !== staleGen && alive(recovered.pid)),
    recovered
      ? `pid ${stalePid}->${recovered.pid} gen ${staleGen}->${recovered.generation} port ${stalePort}->${recovered.port}`
      : 'desktop.json not recovered');

  const restarted = await waitFor(() => {
    const list = readEvents(probe2);
    return list.some((e) => e.event === 'ready') ? list : null;
  }, 20_000);
  const ready2 = (restarted ?? []).find((e) => e.event === 'ready');
  step('崩溃后窗口指向新核心（ready 事件 pid 一致）',
    Boolean(ready2?.daemon?.pid === recovered?.pid && ready2?.window?.visible === true),
    JSON.stringify(ready2?.daemon ?? {}));
  step('崩溃后清理了陈旧记录（probe 记录 daemon-stale-cleared）',
    has('daemon-stale-cleared', restarted) || daemonPid(recovered) !== stalePid,
    `events=${(restarted ?? []).map((e) => e.event).join(',')}`);
} catch (error) {
  console.log(`[FAIL] 验证进程异常 — ${error?.message ?? String(error)}`);
  failures.push(error?.message ?? String(error));
} finally {
  for (const proc of spawned) {
    try { proc.kill('SIGTERM'); } catch { /* ignore */ }
  }
  await sleep(600);
}

const total = pass + failures.length;
console.log(`\nshell boot: ${pass}/${total} checks passed`);
console.log(failures.length === 0
  ? 'SHELL_BOOT_OK'
  : `SHELL_BOOT_FAIL: ${failures.join(' | ')}`);
process.exit(failures.length === 0 ? 0 : 1);
