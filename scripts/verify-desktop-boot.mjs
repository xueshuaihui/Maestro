/**
 * Real-browser boot verification.
 *
 * The other verification scripts drive the HTTP surface directly. This one
 * starts the daemon through the same entry the desktop shell uses
 * (`serve-entry.js --desktop`), then drives the shipped UI in headless Chrome:
 * cold start -> connection ready -> Studio nav -> in-app wizard loaded.
 *
 * It exists because a route-level 200 does not prove that the page can read
 * the credentials the shell handed it.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => delay(ms);

let failures = 0;
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-boot-'));
const daemonLog = path.join(root, 'daemon.log');
let daemon = null;
let chrome = null;
let ws = null;

async function waitFor(predicate, timeoutMs, intervalMs = 100) {
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
  const events = [];
  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id === undefined) {
      if (msg.method === 'Runtime.exceptionThrown') {
        const detail = msg.params.exceptionDetails;
        const frames = (detail?.stackTrace?.callFrames ?? [])
          .slice(0, 4)
          .map((f) => `${f.url}:${f.lineNumber + 1}`)
          .join(' <- ');
        events.push(`exception: ${detail?.exception?.description ?? detail?.text} @ ${frames}`);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        events.push(`console: ${msg.params.args?.map((a) => a.value ?? a.description).join(' ')}`);
      }
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  };
  return Object.assign((method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  }), { events });
}

try {
  // ---- daemon: exactly what the Rust shell spawns -------------------------
  const logFd = fs.openSync(daemonLog, 'w');
  daemon = spawn(process.execPath, [
    path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop',
  ], { cwd: root, stdio: ['ignore', logFd, logFd] });

  const metaPath = path.join(root, '.orch', 'desktop.json');
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return null; }
  }, 20_000);
  step('壳入口起 daemon 并写出 desktop.json', Boolean(meta?.port && meta?.token),
    meta ? `port ${meta.port}` : fs.readFileSync(daemonLog, 'utf8').slice(0, 200));
  if (!meta) throw new Error('daemon did not become ready');

  // ---- headless Chrome with a CDP port -----------------------------------
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${path.join(root, 'chrome-profile')}`,
    '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let devPort = null;
  chrome.stderr.on('data', (chunk) => {
    const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(String(chunk));
    if (match) devPort = Number(match[1]);
  });
  devPort = await waitFor(() => devPort, 20_000, 50);
  step('无头浏览器 CDP 就绪', Boolean(devPort), devPort ? `:${devPort}` : '');
  if (!devPort) throw new Error('CDP port never appeared');

  const listUrl = `http://127.0.0.1:${devPort}/json/list`;
  const targets = await waitFor(async () => {
    try {
      const answer = await fetch(listUrl, { signal: AbortSignal.timeout(3000) });
      return answer.ok ? await answer.json() : null;
    } catch { return null; }
  }, 15_000, 200);
  if (!targets) throw new Error('CDP /json/list unavailable');
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await Promise.race([
    new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    }),
    sleep(8000).then(() => { throw new Error('CDP websocket open timeout'); }),
  ]);
  const call = cdp();
  await call('Page.enable');
  await call('Runtime.enable');

  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed');
    }
    return result.result?.value;
  };

  // ---- cold start through the real UI ------------------------------------
  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', {
    url: `http://127.0.0.1:${meta.port}/ui/?${query.toString()}`,
  });
  const painted = await waitFor(async () => evaluate(
    "Boolean(document.querySelector('#app')?.textContent?.trim())",
  ), 20_000);
  step('冷启动首屏绘制（非空白）', painted === true);

  await sleep(1500);
  const boot = await evaluate(`(() => ({
    text: document.body.innerText.slice(0, 400),
    tokenInSession: sessionStorage.getItem('maestro.desktop.token'),
    tokenInLocal: localStorage.getItem('maestro.desktop.token'),
    navStudio: [...document.querySelectorAll('[data-action="nav"]')]
      .some((n) => n.getAttribute('data-arg') === 'studio'),
  }))()`);
  step('壳把 token 存进 sessionStorage', typeof boot.tokenInSession === 'string'
    && boot.tokenInSession.length > 0, `session=${boot.tokenInSession ? 'yes' : 'no'} / local=${boot.tokenInLocal ? 'yes' : 'no'}`);
  step('冷启动未卡在「正在连接守护进程」', !boot.text.includes('正在连接守护进程'),
    boot.text.split('\n').filter(Boolean).slice(0, 3).join(' | '));
  step('搭建台导航项存在', boot.navStudio === true);

  // ---- click the Studio nav, then inspect the iframe ----------------------
  const clicked = await evaluate(`(() => {
    const node = [...document.querySelectorAll('[data-action="nav"]')]
      .find((n) => n.getAttribute('data-arg') === 'studio');
    if (!node) return false;
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    return true;
  })()`);
  step('点击「搭建台」导航', clicked === true);

  const frame = await waitFor(async () => evaluate(`(() => {
    const f = document.querySelector('iframe.studio-iframe');
    if (!f) return null;
    const d = f.contentDocument;
    if (!d || !d.body || !d.body.innerText.trim()) return null;
    return {
      text: d.body.innerText.slice(0, 400),
      appChildren: d.getElementById('app')?.children.length ?? -1,
      loading: d.getElementById('loading')?.textContent ?? '',
      buttons: d.querySelectorAll('button').length,
    };
  })()`), 15_000);
  step('搭建台 iframe 真正加载出内容', Boolean(frame && frame.appChildren > 0 && frame.buttons > 0),
    frame ? `${frame.buttons} 按钮 / ${frame.appChildren} 区块 / loading=${JSON.stringify(frame.loading)}`
      : JSON.stringify(await evaluate(`(() => {
          const f = document.querySelector('iframe');
          const d = f?.contentDocument;
          return {
            mainText: document.body.innerText.slice(0, 120),
            iframeCount: document.querySelectorAll('iframe').length,
            src: f?.getAttribute('src') ?? null,
            resolved: f?.src ?? null,
            readyState: d?.readyState ?? null,
            frameText: d?.body?.innerText?.slice(0, 120) ?? null,
          };
        })()`)));
  step('浏览器内无未捕获异常', call.events.length === 0, call.events.slice(0, 3).join(' | '));
  step('搭建台未停在 TOKEN/加载中', Boolean(frame)
    && !frame.text.includes('TOKEN') && frame.loading !== '加载中',
  frame ? frame.text.split('\n').filter(Boolean).slice(0, 3).join(' | ') : '');

  const stateStatus = await evaluate(`(async () => {
    const t = sessionStorage.getItem('maestro.desktop.token');
    const res = await fetch('/studio/state', { headers: { Authorization: 'Bearer ' + t } });
    return res.status;
  })()`);
  step('浏览器内用壳 token 读 /studio/state', stateStatus === 200, `HTTP ${stateStatus}`);

  // ---- the actual wizard button must configure the whole form ------------
  const clickedDemo = await evaluate(`(() => {
    const frame = document.querySelector('iframe.studio-iframe');
    const button = frame?.contentDocument?.getElementById('btn-demo');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  step('页面按钮已触发', clickedDemo === true);
  const configured = await waitFor(async () => evaluate(`(async () => {
    const token = sessionStorage.getItem('maestro.desktop.token');
    const res = await fetch('/studio/state', { headers: { Authorization: 'Bearer ' + token } });
    const body = await res.json();
    const counts = {
      roles: body.roles?.length ?? 0,
      flows: body.flows?.length ?? 0,
      teams: body.teams?.length ?? 0,
      runs: body.runs?.length ?? 0,
    };
    return counts.roles > 0 && counts.flows > 0 && counts.teams > 0 && counts.runs > 0
      ? counts
      : null;
  })()`), 45_000, 300);
  step('页面按钮可配出组织/流程/团队并启动运行', Boolean(configured
    && configured.roles > 0 && configured.flows > 0
    && configured.teams > 0 && configured.runs > 0),
  JSON.stringify(configured));
  const toast = await evaluate(`(() => document.querySelector('iframe.studio-iframe')
    ?.contentDocument?.getElementById('toast')?.textContent ?? '')()`);
  step('完成提示无未填充占位符', !toast.includes('{'), toast.slice(0, 120));
  step('按钮操作后仍无未捕获异常', call.events.length === 0, call.events.slice(0, 3).join(' | '));

  // ---- first launch without credentials must not hang on "connecting" ----
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/` });
  await sleep(12_000);
  const noCreds = await evaluate("document.body.innerText.slice(0, 300)");
  step('无凭据首启不会永远停在「正在连接」', !noCreds.includes('正在连接守护进程'),
    noCreds.split('\n').filter(Boolean).slice(0, 3).join(' | '));
} catch (error) {
  console.log(`[FAIL] 验证进程异常 — ${error?.message ?? String(error)}`);
  failures += 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill('SIGTERM'); } catch { /* ignore */ }
  try { daemon?.kill('SIGTERM'); } catch { /* ignore */ }
  await sleep(500);
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
}

console.log(failures === 0 ? 'DESKTOP_BOOT_OK' : `DESKTOP_BOOT_FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
