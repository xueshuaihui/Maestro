/**
 * Asset-library maintenance acceptance (beta.4 resource platform).
 *
 * A built-in asset is read-only by design. This drives the REAL UI: open the
 * asset library, press "join project" on a built-in role, and assert a project
 * copy lands on disk and becomes editable. No CLI shortcuts.
 *
 * Run: node scripts/verify-assets.mjs [--app]
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USE_APP = process.argv.includes('--app');
const APP_BIN = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app', 'Contents', 'MacOS', 'maestro');
const sleep = (ms) => delay(ms);

let pass = 0;
const failures = [];
const errors = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push(name);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-assets-'));
const home = path.join(root, 'home');
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(home, { recursive: true });

let daemon = null;
let chrome = null;
let ws = null;
async function waitFor(predicate, timeoutMs, intervalMs = 150) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}
function cdp() {
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    let msg; try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id === undefined) {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(d?.exception?.description ?? d?.text ?? 'exception');
      }
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
  };
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

try {
  const logFd = fs.openSync(path.join(root, 'daemon.log'), 'w');
  if (USE_APP) {
    if (!fs.existsSync(APP_BIN)) throw new Error(`built app missing: ${APP_BIN}`);
    if (process.platform === 'darwin') spawnSync('killall', ['-9', 'maestro'], { stdio: 'ignore' });
    daemon = spawn(APP_BIN, ['--project', root], { cwd: root, env: { ...process.env, HOME: home }, stdio: ['ignore', logFd, logFd] });
  } else {
    daemon = spawn(process.execPath, [path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop'], {
      cwd: root, env: { ...process.env, HOME: home, USERPROFILE: home, NODE_ENV: 'test' }, stdio: ['ignore', logFd, logFd],
    });
  }
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
    catch { return null; }
  }, 25000);
  if (!meta?.port) throw new Error(`daemon not ready: ${fs.readFileSync(path.join(root, 'daemon.log'), 'utf8').slice(0, 300)}`);
  step('daemon ready', true, `port ${meta.port}`);

  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${path.join(root, 'chrome-profile')}`, '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let devPort = null;
  chrome.stderr.on('data', (chunk) => {
    const found = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(String(chunk));
    if (found) devPort = Number(found[1]);
  });
  devPort = await waitFor(() => devPort, 20000, 50);
  const targets = await waitFor(async () => {
    try { const res = await fetch(`http://127.0.0.1:${devPort}/json/list`); return res.ok ? await res.json() : null; }
    catch { return null; }
  }, 15000, 200);
  if (!targets) throw new Error('CDP targets missing');
  ws = new WebSocket(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const call = cdp();
  await call('Page.enable');
  await call('Runtime.enable');
  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result?.value;
  };
  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query}` });
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"nav\"]').length > 0"), 25000);

  const nav = await evaluate(`(() => {
    const n=[...document.querySelectorAll('[data-action="nav"]')].find(x=>x.getAttribute('data-arg')==='assets');
    if(!n) return false; n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})); return true;
  })()`);
  step('打开资产库', nav === true, `nav=${nav}`);
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"asset-kind\"]').length > 0"), 15000);

  const roleTab = await evaluate(`(() => {
    const t=[...document.querySelectorAll('[data-action="asset-kind"]')].find(x=>x.getAttribute('data-arg')==='roles');
    if(!t) return false; t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})); return true;
  })()`);
  step('切到角色页签', roleTab === true, `tab=${roleTab}`);
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"asset-fork\"]').length > 0"), 15000);

  const before = await evaluate("document.querySelectorAll('[data-action=\"asset-fork\"]').length");
  const rowDiag = await evaluate(`(() => {
    const r=document.querySelector('[data-action="asset-row"]');
    return r ? r.outerHTML.slice(0, 320) : 'no-row';
  })()`);
  step('内置角色显示「加入项目」按钮', before > 0, `buttons=${before} :: row=${rowDiag}`);

  const firstId = await evaluate(`(() => {
    const b=document.querySelector('[data-action="asset-fork"]');
    if(!b) return null;
    const arg=JSON.parse(b.getAttribute('data-arg')||'{}');
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    b.click(); return arg.id;
  })()`);
  step('点击「加入项目」', typeof firstId === 'string' && firstId.length > 0, `id=${firstId}`);
  await sleep(1800);

  const files = fs.existsSync(path.join(root, '.orch', 'roles')) ? fs.readdirSync(path.join(root, '.orch', 'roles')) : [];
  const projectCopy = files.find((f) => f.includes(firstId ?? ' NEVER'));
  step('项目副本写入 .orch/roles', Boolean(projectCopy), `files=${JSON.stringify(files.slice(0, 4))}`);

  if (projectCopy) {
    const text = fs.readFileSync(path.join(root, '.orch', 'roles', projectCopy), 'utf8');
    step('副本带可编辑来源标记', text.includes('derived_from:') && text.includes('schema: role/v1'),
      text.split('\n').slice(0, 8).join(' | '));
  }

  step('浏览器内无未捕获异常', errors.length === 0, JSON.stringify(errors.slice(0, 2)));
} catch (err) {
  step('脚本执行', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  if (ws) ws.close();
  if (chrome) chrome.kill('SIGKILL');
  if (daemon) daemon.kill('SIGKILL');
  console.log(`\nassets: ${pass}/${pass + failures.length} steps passed`);
  if (failures.length > 0) {
    console.log('ASSETS_FAIL: ' + failures.join(' | '));
    process.exitCode = 1;
  } else {
    console.log('ASSETS_OK');
  }
}
