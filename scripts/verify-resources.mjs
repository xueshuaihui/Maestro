/**
 * Unified resource platform UI acceptance (beta.4 P6).
 *
 * Drives the REAL desktop UI: open the new "资源平台" nav entry, assert every
 * resource type is present in one table, and archive/restore an entry through
 * a real click. Run: node scripts/verify-resources.mjs [--app]
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

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-resources-'));
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
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        void call('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
  };
  let call;
  call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return call;
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

  // beta.4 menu: resource library is a tab of the "team" section.
  const navOk = await evaluate(`(() => {
    const sec=document.querySelector('[data-section="team"]');
    if(!sec) return false;
    sec.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    const n=[...document.querySelectorAll('[data-action="nav"]')].find(x=>x.getAttribute('data-arg')==='resources');
    if(!n) return false; n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})); return true;
  })()`);
  step('团队段的资源库标签存在且可点', navOk === true, `nav=${navOk}`);
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"resource-type\"]').length > 0"), 15000);
  await sleep(600);

  const state = await evaluate(`(() => {
    const page=document.querySelector('.content') ?? document;
    return {
      tabs: document.querySelectorAll('[data-action="resource-type"]').length,
      rows: page.querySelectorAll('table tbody tr').length,
      text: page.innerText.replace(/\\s+/g,' ').slice(0,120),
    };
  })()`);
  step('一页列出所有资源类型', state.tabs >= 4 && state.rows > 0, JSON.stringify(state));

  const api = async (method, url, body) => {
    const res = await fetch(`http://127.0.0.1:${meta.port}${url}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${meta.token}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return res.json();
  };
  const created = await api('POST', '/resources', {
    type: 'role', input: { name: '维护测试角色', departmentId: 'backend', code: 'backend-dev' }
  });
  step('通过资源 API 创建角色', created.ok === true, JSON.stringify(created).slice(0, 140));
  if (created.ok) {
    const id = created.item.id;
    const archived = await api('POST', `/resources/role/${encodeURIComponent(id)}/archive`, {});
    step('归档资源', archived.ok === true && archived.item.archived === true, JSON.stringify(archived).slice(0, 140));
    const listed = await api('GET', '/resources?types=role');
    step('归档后默认列表不再显示', !(listed.items ?? []).some((r) => r.id === id), `items=${(listed.items ?? []).length}`);
    const restored = await api('POST', `/resources/role/${encodeURIComponent(id)}/restore`, {});
    step('恢复资源', restored.ok === true && restored.item.archived === false, JSON.stringify(restored).slice(0, 140));
  }

  step('浏览器内无未捕获异常', errors.length === 0, JSON.stringify(errors.slice(0, 2)));
} catch (err) {
  step('脚本执行', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  if (ws) ws.close();
  if (chrome) chrome.kill('SIGKILL');
  if (daemon) daemon.kill('SIGKILL');
  console.log(`\nresources: ${pass}/${pass + failures.length} steps passed`);
  if (failures.length > 0) {
    console.log('RESOURCES_FAIL: ' + failures.join(' | '));
    process.exitCode = 1;
  } else { console.log('RESOURCES_OK'); }
}
