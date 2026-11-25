/**
 * First-run acceptance: can a newcomer go from a blank project to a running
 * instance without leaving the landing page or learning the word "host"?
 *
 * This complements verify-instance-flow.mjs, which starts from the advanced
 * page. Here every action is a real click or keystroke in a real browser:
 *   1. 实例 first screen offers a three-step guide.
 *   2. One click scans and connects a usable Agent CLI.
 *   3. Choosing a workflow surfaces its hidden task syntax up front.
 *   4. The canvas can hand its workflow to the same guide.
 *   5. Typing a task and pressing start creates a visible instance here.
 *
 * Run: node scripts/verify-first-run.mjs [--app]
 * A machine without an Agent CLI still passes F1; F2~F5 are skipped unless
 * MAESTRO_REQUIRE_CLI=1 is set.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => delay(ms);
const USE_APP = process.argv.includes('--app');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const APP_BIN = path.join(APP, 'Contents', 'MacOS', 'maestro');

let pass = 0;
const failures = [];
const skipped = [];
const errors = [];
const postInstances = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push({ name, detail });
}
function skip(name, why) {
  console.log(`[SKIP] ${name} — ${why}`);
  skipped.push({ name, why });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-first-run-'));
const home = path.join(root, 'home');
fs.mkdirSync(path.join(root, '.orch'), { recursive: true });
fs.mkdirSync(home, { recursive: true });
const extraBin = process.env.MAESTRO_CLI_BIN ?? '';
const childPath = extraBin ? `${extraBin}${path.delimiter}${process.env.PATH ?? ''}` : (process.env.PATH ?? '');

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
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id === undefined) {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        errors.push(d?.exception?.description ?? d?.text ?? 'exception');
      } else if (msg.method === 'Network.requestWillBeSent') {
        const req = msg.params.request;
        if (req?.method === 'POST' && /\/instances(?:\?|$)/.test(req.url ?? '')) postInstances.push(req.url);
      }
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
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
    daemon = spawn(APP_BIN, ['--project', root], {
      cwd: root, env: { ...process.env, PATH: childPath, HOME: home, USERPROFILE: home },
      stdio: ['ignore', logFd, logFd],
    });
  } else {
    daemon = spawn(process.execPath, [
      path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop',
    ], {
      cwd: root,
      env: { ...process.env, PATH: childPath, HOME: home, USERPROFILE: home, NODE_ENV: 'test' },
      stdio: ['ignore', logFd, logFd],
    });
  }
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
    catch { return null; }
  }, 25000);
  if (!meta?.port) throw new Error(`daemon not ready: ${fs.readFileSync(path.join(root, 'daemon.log'), 'utf8').slice(0, 400)}`);
  step('F0 真实 daemon 就绪', true, `port ${meta.port} root ${root}`);

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
  await call('Network.enable');
  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result?.value;
  };
  const text = () => evaluate('(document.querySelector(".content")?.innerText ?? "").replace(/\\s+/g," ")');
  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query}` });
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"quick-connect\"]').length > 0"), 25000);
  // The packaged daemon can paint the skeleton before both label tables are
  // back. Asserting then would test the fallback words, not the product.
  await waitFor(() => evaluate("(document.querySelector('.content')?.innerText ?? '').includes('从这里开始')"), 15000);

  // beta.4 menu: a page is reached through its section, then its tab.
  const SECTION_OF = {
    instances: 'run', queue: 'run', notifications: 'run', occupancy: 'run', new: 'run',
    studio: 'team', resources: 'team', assets: 'team',
    flows: 'flow', canvas: 'flow', governance: 'govern', project: 'setup', settings: 'setup',
  };
  const clickSection = (id) => evaluate(`(() => {
    const node=document.querySelector('.sidebar [data-section="${id}"]');
    if(!node) return false;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    node.click();
    return true;
  })()`);
  const openView = async (view) => {
    const section = SECTION_OF[view] ?? 'run';
    await clickSection(section);
    await sleep(500);
    const strip = await evaluate("document.querySelectorAll('.secbar .sec-tab').length");
    if (strip <= 1) return true;
    return click('nav', view);
  };
  const click = (action, arg) => evaluate(`(() => {
    const list=[...document.querySelectorAll('[data-action=' + JSON.stringify(${JSON.stringify(action)}) + ']')]
      .filter(n => n.getClientRects().length > 0);
    const hit=${arg === undefined ? 'list[0]' : `list.find(n=>n.getAttribute('data-arg')===${JSON.stringify(arg)})`};
    if(!hit) return false;
    hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    hit.click();
    return true;
  })()`);

  // --- F1: the landing page itself is the guide ----------------------------
  const first = await text();
  step('F1 首屏就是三步引导', /从这里开始/.test(first)
    && /连接本机 Agent/.test(first) && /选工作流/.test(first) && /写任务并启动/.test(first),
  first.slice(0, 160));
  step('F1 引导不需要先懂宿主', /扫描并连接本机 Agent/.test(first), first.slice(0, 120));

  // --- F2: one click connects a CLI and selects it -------------------------
  const connected = await click('quick-connect');
  const linked = await waitFor(() => evaluate("(document.querySelector('.content')?.innerText ?? '').includes('已连接')"), 30000);
  const hostFiles = fs.existsSync(path.join(root, '.orch', 'hosts'))
    ? fs.readdirSync(path.join(root, '.orch', 'hosts')).filter((f) => f.endsWith('.json')) : [];
  if (linked) {
    step('F2 一键扫描并连接真实 CLI', connected && hostFiles.length > 0, hostFiles.join(', '));
  } else {
    const hint = await text();
    if (process.env.MAESTRO_REQUIRE_CLI === '1') {
      step('F2 本机存在可连接的 Agent CLI', false, 'MAESTRO_REQUIRE_CLI=1 但扫描为空');
    } else {
      skip('F2 一键扫描并连接真实 CLI', `无 CLI；页面提示：${hint.includes('没有找到可执行') ? '安装后重新扫描' : hint.slice(0, 60)}`);
    }
  }

  if (linked) {
    // --- F3: hidden syntax is shown before the failure ---------------------
    await click('pick-template', 'code-loop');
    await sleep(400);
    const hinted = await text();
    step('F3 工作流隐藏规则前置可见', /这个工作流要求任务里有一行/.test(hinted), hinted.slice(0, 180));

    // --- F4: canvas can hand its workflow to the guide ---------------------
    await openView('canvas');
    await sleep(700);
    await click('canvas-pick', 'code-loop');
    await sleep(700);
    await click('run-canvas-flow');
    await sleep(900);
    // beta.4: "run this workflow" lands on the new-instance form with the
    // workflow preselected, instead of dropping the user back on a list.
    const handed = await evaluate(`(() => {
      const page = document.querySelector('.content') ?? document;
      const tile = [...page.querySelectorAll('[data-action="pick-template"]')]
        .find(n => n.getAttribute('data-arg') === 'code-loop');
      const head = (page.querySelector('.page-head h1')?.textContent ?? '').trim();
      return { head, selected: tile?.classList.contains('on') === true };
    })()`);
    step('F4 画布工作流直接带入新建页', handed.head === '新建实例' && handed.selected, JSON.stringify(handed));

    // --- F5: type and start without leaving the page -----------------------
    await evaluate(`(() => {
      const t = document.querySelector('[data-field="task"]');
      if (!t) return false;
      t.value = '修复登录页的按钮文案 产物：guide.js';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await click('submit-new');
    const started = await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"open-instance\"]').length > 0"), 30000);
    const after = await text();
    const reason = await evaluate(`(() => {
      const page = document.querySelector('.content') ?? document;
      const err = page.querySelector('.form-error');
      return err ? (err.innerText ?? '') : '';
    })()`);
    step('F5 原地启动并看到实例', Boolean(started), started
      ? `POST /instances ×${postInstances.length}；${after.slice(0, 160)}`
      : `POST /instances ×${postInstances.length}；表单错误：${reason || '(空)'}；${after.slice(0, 200)}`);

    // --- F7: the authoring surface has an exit back to the run surface -----
    await openView('studio');
    await sleep(900);
    const sent = await evaluate(`(() => {
      const frame = document.querySelector('.studio-iframe');
      const btn = frame?.contentDocument?.getElementById('btn-instances');
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    await sleep(1000);
    // beta.4: the run surface is a section ("运行") whose landing tab is the
    // instance list, so the check is on the section strip, not the sidebar.
    const back = await evaluate(`(() => {
      const on = document.querySelector('.secbar .sec-tab.on');
      return (on?.innerText ?? '').includes('实例');
    })()`);
    step('F7 搭建台可回到实例页', sent && back, JSON.stringify({ sent, back }));
  } else {
    skip('F3 工作流隐藏规则前置可见', '没有可连接的 CLI，流程未进入输入步骤');
    skip('F4 画布工作流直接带入引导', '没有可连接的 CLI，流程未进入输入步骤');
    skip('F5 原地启动并看到实例', '没有可连接的 CLI，流程未走到启动步骤');
    skip('F7 搭建台可回到实例页', '没有可连接的 CLI，未进入完整流程');
  }

  step('F8 全程无未捕获异常', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(`\n${pass} passed, ${failures.length} failed, ${skipped.length} skipped`);
} catch (error) {
  console.error('[FAIL] first-run harness', error?.stack ?? error);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  try { chrome?.kill('SIGKILL'); } catch {}
  try { daemon?.kill('SIGKILL'); } catch {}
  if (failures.length > 0) process.exitCode = 1;
}
