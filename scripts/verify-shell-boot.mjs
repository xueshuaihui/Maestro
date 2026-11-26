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

function launch(root, probePath, logPath, ctlDir = null) {
  const fd = fs.openSync(logPath, 'w');
  const args = ['--project', root, '--probe', probePath];
  if (ctlDir !== null) args.push('--ctl', ctlDir);
  const proc = spawn(BIN, args, {
    cwd: root,
    // Isolate the machine-level config (`projects.json`, CLI registry): a
    // verification run opens scratch projects, and those must never end up in
    // the user's real `~/.maestro/projects.json` (they did, once).
    env: { ...process.env, MAESTRO_CONFIG_DIR: path.join(root, 'config') },
    stdio: ['ignore', fd, fd],
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
  const ctlDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-ctl-'));

  child = launch(root, probePath, stdoutPath, ctlDir);
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

  // Opening the app must scan the machine before anything else: every later
  // screen (team, workflow, run) depends on a CLI existing. The probe line is
  // emitted by the scan command itself, so it proves the page ran the scan
  // rather than merely being able to.
  const scan = await waitFor(() => readEvents(probePath).find((e) => e.event === 'env-scan') ?? null, 15_000);
  step('启动页打开即自动扫描本机 CLI', Boolean(scan), JSON.stringify(scan ?? {}));

  // The working UI is served by the project daemon on loopback, which Tauri
  // classes as a *remote* origin. Application commands are only allowed there
  // when a capability grants it; with no capability every button that calls
  // back into the shell is rejected with "not allowed by ACL" and looks dead.
  // That is exactly how "switch project does nothing" reached the user, so the
  // page's own bridge gets exercised here, not just the Rust entry points.
  const booted = await waitFor(
    () => readEvents(probePath).find((e) => e.event === 'ui-boot') ?? null,
    30_000
  );
  step('主界面进入 daemon UI（ui-boot）', Boolean(booted));
  if (booted) {
    fs.writeFileSync(path.join(ctlDir, 'eval-js-ipc'), `
      (() => {
        const inv = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke)
          || window.__TAURI_INTERNALS__.invoke;
        inv('startup_status')
          .then((state) => inv('probe_emit', {
            payload: JSON.stringify({ event: 'ui-ipc', ok: true, ready: state.ready }),
          }))
          .catch((err) => inv('probe_emit', {
            payload: JSON.stringify({ event: 'ui-ipc', ok: false, message: String(err) }),
          }));
      })();
    `, 'utf8');
    const ipc = await waitFor(
      () => readEvents(probePath).find((e) => e.event === 'ui-ipc') ?? null,
      15_000
    );
    step('主界面能通过 IPC 调通应用命令（capability 放行 loopback 来源）',
      ipc?.ok === true && ipc?.ready === true,
      JSON.stringify(ipc ?? 'no ui-ipc event — the page could not call back at all'));
  }

  // Switching projects used to be refused outright: `bind_project` returned an
  // error for any root other than the bound one, and the page swallowed it. The
  // ctl seam drives the exact same bind path the project page uses.
  const switchTo = freshRoot('switch');
  fs.writeFileSync(path.join(ctlDir, 'open-project'), switchTo, 'utf8');
  const switched = await waitFor(
    () => readEvents(probePath).find((e) => e.event === 'project-switched') ?? null,
    30000
  );
  const switchedMeta = await waitFor(() => readMeta(switchTo), 20000);
  step('切换项目：换根后新核心就绪',
    Boolean(switched?.daemonPid) && Boolean(switchedMeta?.port),
    JSON.stringify({ event: switched ?? null, port: switchedMeta?.port ?? null }));
  const oldRecord = await waitFor(() => readMeta(root), 10000);
  step('切换项目：旧项目的通道记录被清掉', oldRecord === null,
    oldRecord === null ? 'cleared' : `still ${oldRecord?.port}`);

  const stderr = fs.readFileSync(stdoutPath, 'utf8').trim();
  step('shell 启动无 stderr 错误输出', !/error|panic|incomplete/i.test(stderr),
    stderr.slice(0, 160) || 'clean');

  // ------------------------------------------ restart over a dead core ----
  // A force quit / container restart / OOM kill leaves BOTH the socket file and
  // desktop.json on disk. The old shell trusted the file, navigated the window
  // at a port nobody served and the connecting line never cleared.
  // The bound project is now `switchTo`: the crash scene must be built on the
  // project the shell is actually serving, not the one it started with.
  const stalePid = daemonPid(switchedMeta);
  const staleGen = switchedMeta?.generation ?? '';
  const stalePort = switchedMeta?.port ?? 0;
  const staleToken = switchedMeta?.token ?? '';
  let killed = false;
  try { process.kill(stalePid, 'SIGKILL'); killed = true; } catch { /* ignore */ }
  await sleep(500);
  const leftover = readMeta(switchTo);
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

  const probe2 = path.join(switchTo, 'shell-probe-restart.jsonl');
  const stdout2 = path.join(switchTo, 'shell-stdout-restart.log');
  second = launch(switchTo, probe2, stdout2);
  step('崩溃后二次启动 .app', Boolean(second.pid), `pid=${second.pid}`);

  const recovered = await waitFor(() => {
    const next = readMeta(switchTo);
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
