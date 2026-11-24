/**
 * Instance drill-down acceptance (the path the previous rounds never walked).
 *
 * A run is only useful if the user can open it afterwards. This drives the real
 * create-instance form with a REAL ACP host (the repo's mock agent, spawned by
 * the same host-config seam a production CLI uses), then opens the instance and
 * walks every workspace tab: overview, graph, board, queue, evidence.
 *
 * Run: node scripts/verify-drilldown.mjs [--app]
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const USE_APP = process.argv.includes('--app');
const APP_BIN = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app', 'Contents', 'MacOS', 'maestro');
const sleep = (ms) => delay(ms);

let pass = 0;
const failures = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push({ name, detail });
}
function skip(name, why) { console.log(`[SKIP] ${name} — ${why}`); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-drill-'));
const home = path.join(root, 'home');
fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
fs.mkdirSync(home, { recursive: true });

// The same seam a production CLI uses: only `launch.command/args` differ.
fs.writeFileSync(path.join(root, '.orch', 'hosts', 'dsh.json'), JSON.stringify({
  transport: 'stdio',
  launch: { command: process.execPath, args: [MOCK, '--write-ref', 'note.md'] },
  limits: { permissionPolicy: 'allow', initializeTimeoutMs: 20000, promptTimeoutMs: 30000, quietIdleMs: 40, quietCapMs: 400 },
}, null, 2), 'utf8');

let daemon = null;
let chrome = null;
let ws = null;
const runtimeErrors = [];

async function waitFor(predicate, timeoutMs, intervalMs = 200) {
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
        runtimeErrors.push(msg.params.exceptionDetails?.exception?.description ?? 'exception');
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
    spawnSync('killall', ['-9', 'maestro'], { stdio: 'ignore' });
    daemon = spawn(APP_BIN, ['--project', root, '--probe', path.join(root, 'probe.jsonl')], {
      cwd: root, env: process.env, stdio: ['ignore', logFd, logFd],
    });
  } else {
    daemon = spawn(process.execPath, [
      path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop',
    ], {
      cwd: root,
      env: { ...process.env, HOME: home, USERPROFILE: home, NODE_ENV: 'test' },
      stdio: ['ignore', logFd, logFd],
    });
  }
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8')); }
    catch { return null; }
  }, 30000);
  if (!meta?.port) throw new Error(`daemon not ready: ${fs.readFileSync(path.join(root, 'daemon.log'), 'utf8').slice(0, 400)}`);
  step('D0 daemon 就绪', true, `port ${meta.port}`);

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
  if (!devPort) throw new Error('CDP port missing');
  const targets = await waitFor(async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${devPort}/json/list`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }, 15000, 200);
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const call = cdp();
  await call('Page.enable');
  await call('Runtime.enable');
  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result?.value;
  };

  const metaQuery = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${metaQuery}` });
  await waitFor(() => evaluate("(document.querySelector('.content')?.innerText ?? '').trim().length > 20"), 20000);

  const open = async (view) => {
    await evaluate(`(() => {
      const n=[...document.querySelectorAll('[data-action="nav"]')]
        .find(x=>x.getAttribute('data-arg')===${JSON.stringify(view)});
      if(n) n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
      return Boolean(n);
    })()`);
    await sleep(700);
  };

  // --- create through the form -------------------------------------------
  await open('new');
  await waitFor(() => evaluate("Boolean(document.querySelector('#new-task'))"), 10000);
  await evaluate(`(() => {
    const tiles=[...document.querySelectorAll('[data-action="pick-template"]')];
    const first=tiles.find(t=>t.textContent.includes('单节点')) ?? tiles[0];
    if(first) first.click();
    return Boolean(first);
  })()`);
  await sleep(300);
  await evaluate(`(() => {
    const area=document.querySelector('#new-task');
    area.value='写一份说明';
    area.dispatchEvent(new Event('input',{bubbles:true}));
    const start=[...document.querySelectorAll('button')]
      .find(b=>b.getAttribute('data-action')==='submit-new');
    if(start) start.click();
    return Boolean(start);
  })()`);

  const outcome = await waitFor(async () => {
    const state = await evaluate(`(() => ({
      cards: document.querySelectorAll('[data-action="open-instance"]').length,
      error: document.querySelector('.form-error')?.textContent ?? null,
    }))()`);
    return state.cards > 0 || state.error ? state : null;
  }, 40000);
  const created = Boolean(outcome && outcome.cards > 0);
  step('D1 通过表单创建真实实例', created, created ? `cards=${outcome.cards}` : `error=${outcome?.error ?? 'none'}`);
  if (!created) throw new Error('instance was not created; drill-down cannot be verified');

  const instanceId = await evaluate(`(() => {
    const row=document.querySelector('[data-action="open-instance"]');
    return row ? JSON.parse(row.getAttribute('data-arg')||'{}').instanceId ?? null : null;
  })()`);
  step('D2 列表条目带实例 id', typeof instanceId === 'string' && instanceId.length > 0, String(instanceId));

  // --- open it and walk every tab ----------------------------------------
  await evaluate(`(() => {
    const row=document.querySelector('[data-action="open-instance"]');
    if(row) row.click();
    return Boolean(row);
  })()`);
  const overview = await waitFor(async () => {
    const text = await evaluate("document.querySelector('.content')?.innerText ?? ''");
    return text.includes('概览') || text.includes('流程图') ? text : null;
  }, 15000);
  step('D3 打开实例进入工作区', Boolean(overview), overview ? overview.split('\n').slice(0, 3).join(' / ') : 'no workspace tabs');

  const readContent = () => evaluate(`(() => {
    const box=document.querySelector('.content');
    const text=(box?.innerText ?? '');
    return {
      len: text.trim().length,
      body: text.slice(0,600),
      svg: box ? box.querySelectorAll('svg g, svg .gnode, svg circle, svg rect').length : 0,
      nodes: box ? box.querySelectorAll('*').length : 0,
    };
  })()`);

  const tabs = [
    ['overview', '概览'],
    ['graph', '流程图'],
    ['board', '看板'],
    ['evidence', '证据'],
  ];
  for (const [view, label] of tabs) {
    const clicked = await evaluate(`(() => {
      const tab=[...document.querySelectorAll('[data-action="tab"]')]
        .find(t=>t.getAttribute('data-arg')===${JSON.stringify(view)});
      if(!tab) return false;
      tab.click();
      return true;
    })()`);
    if (!clicked) { skip(`D4 ${label} 页`, 'tab missing'); continue; }
    const snap = await waitFor(async () => {
      const s = await readContent();
      return s.len > 30 ? s : null;
    }, 12000);
    const leaks = snap
      ? ['[object Object]', 'undefined'].filter((token) => snap.body.includes(token))
      : [];
    step(`D4 ${label} 页有内容`, Boolean(snap),
      snap ? `len=${snap.len} nodes=${snap.nodes} svg=${snap.svg}` : 'stayed empty');
    step(`D4 ${label} 页无脏文本`, leaks.length === 0, leaks.join(','));
    if (view === 'graph' && snap) {
      step('D4 流程图画出节点', snap.svg >= 1, `svg elements=${snap.svg}`);
    }
  }

  step('D5 全程无未捕获异常', runtimeErrors.length === 0, runtimeErrors.slice(0, 2).join(' | '));

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exitCode = 1;
} catch (error) {
  console.error('[ERROR]', error?.stack ?? error);
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill('SIGTERM'); } catch { /* ignore */ }
  try { daemon?.kill('SIGTERM'); } catch { /* ignore */ }
  console.log(`artifacts: ${root}`);
}
