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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-shell-boot-'));
const probePath = path.join(root, 'shell-probe.jsonl');
const stdoutPath = path.join(root, 'shell-stdout.log');
const outFd = fs.openSync(stdoutPath, 'w');
let child = null;

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
  child = spawn(BIN, ['--project', root, '--probe', probePath], {
    cwd: root, env: process.env, stdio: ['ignore', outFd, outFd],
  });
  step('真实 .app 二进制启动', Boolean(child.pid), `pid=${child.pid}`);

  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
    catch { return null; }
  }, 25_000);
  let activated = false;
  try { activated = fs.readFileSync(probePath, 'utf8').includes('"event":"activated"'); } catch { /* ignore */ }
  const metaDetail = meta ? `port=${meta.port} daemonPid=${meta.pid}`
    : activated ? 'no desktop.json — second launch was only "activated" (stale single-instance lock)'
    : 'no desktop.json';
  step('shell 拉起 bundled node daemon 并写出 desktop.json',
    Boolean(meta?.port && meta?.token && meta?.generation), metaDetail);

  const events = await waitFor(() => {
    try {
      return fs.readFileSync(probePath, 'utf8').split('\n').filter(Boolean)
        .map((line) => JSON.parse(line));
    } catch { return null; }
  }, 10_000);
  const has = (name) => (events ?? []).some((e) => e.event === name);
  const ready = (events ?? []).find((e) => e.event === 'ready');
  step('probe 记录 launch 事件', has('launch'));
  step('probe 记录 ready 事件（含 daemon pid + 可见窗口）',
    Boolean(ready?.daemon?.pid && ready?.window?.visible === true),
    JSON.stringify(ready?.daemon ?? {}));
  step('probe 记录 tray-created 事件', has('tray-created'));

  const stderr = fs.readFileSync(stdoutPath, 'utf8').trim();
  step('shell 启动无 stderr 错误输出', !/error|panic|incomplete/i.test(stderr),
    stderr.slice(0, 160) || 'clean');
} catch (error) {
  console.log(`[FAIL] 验证进程异常 — ${error?.message ?? String(error)}`);
  failures.push(error?.message ?? String(error));
} finally {
  try { child?.kill('SIGTERM'); } catch { /* ignore */ }
  await sleep(600);
  try { fs.closeSync(outFd); } catch { /* ignore */ }
}

const total = pass + failures.length;
console.log(`\nshell boot: ${pass}/${total} checks passed`);
console.log(failures.length === 0
  ? 'SHELL_BOOT_OK'
  : `SHELL_BOOT_FAIL: ${failures.join(' | ')}`);
process.exit(failures.length === 0 ? 0 : 1);
