/**
 * Real-browser verification of the workflow canvas (v2).
 *
 * Drives the ACTUAL desktop UI against a REAL loopback daemon:
 * - Studio flow loaded from `.orch/studio.json` appears in the picker;
 * - nodes carry Chinese labels + stage status + progress, edges are real SVG
 *   paths (not "[object Object]");
 * - node click -> rename; add stage; add and remove dependency all land on
 *   disk and survive a reload;
 * - dragging a node persists a local layout offset and survives a reload.
 *
 * Run: node scripts/verify-canvas.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => delay(ms);
// `--app` runs the same assertions against the built bundle: the shipped copy
// of desktop/ui is what the user opens, not the source tree.
const USE_APP = process.argv.includes('--app');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const APP_BIN = path.join(APP, 'Contents', 'MacOS', 'maestro');
let pass = 0;
const failures = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push(name);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-canvas-'));
const home = path.join(root, 'home');
fs.mkdirSync(path.join(root, '.orch'), { recursive: true });
fs.mkdirSync(home, { recursive: true });

const doc = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  departments: [], roles: [], employees: [], teams: [], tasks: [], defects: [], changes: [],
  flows: [{
    id: 'canvas-demo',
    name: '画布验证流程',
    kind: 'custom',
    runMode: 'semi',
    gates: [],
    stages: [
      { id: 's01', name: '需求', titleKey: null, roleCodes: ['eng-lead'], parallel: false, gate: null, artifacts: [] },
      { id: 's02', name: '开发', titleKey: null, roleCodes: ['qa-lead'], parallel: false, gate: null, artifacts: [] },
    ],
    edges: [{ from: 's01', to: 's02' }],
    createdAt: new Date().toISOString(),
  }],
  runs: [{
    id: 'RUN-CANVAS', flowId: 'canvas-demo', mode: 'simulate', status: 'running',
    startedAt: new Date().toISOString(), finishedAt: null,
    stages: [{ stageId: 's01', status: 'done' }, { stageId: 's02', status: 'running' }],
  }],
};
const studioFile = path.join(root, '.orch', 'studio.json');
fs.writeFileSync(studioFile, JSON.stringify(doc), 'utf8');

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
  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.id === undefined) return;
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

function readDoc() {
  return JSON.parse(fs.readFileSync(studioFile, 'utf8'));
}

try {
  const logFd = fs.openSync(path.join(root, 'daemon.log'), 'w');
  if (USE_APP) {
    if (!fs.existsSync(APP_BIN)) throw new Error(`built app missing: ${APP_BIN} (run npm run desktop:build)`);
    spawnSync('killall', ['-9', 'maestro'], { stdio: 'ignore' });
    daemon = spawn(APP_BIN, ['--project', root, '--probe', path.join(root, 'probe.jsonl')], {
      cwd: root, env: process.env, stdio: ['ignore', logFd, logFd],
    });
  } else {
    daemon = spawn(process.execPath, [
      path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop'
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
  if (!meta?.port) {
    throw new Error('daemon not ready: ' + fs.readFileSync(path.join(root, 'daemon.log'), 'utf8').slice(0, 500));
  }
  step(USE_APP ? '打包产物 .app 就绪' : '真实 daemon 就绪', true, `port ${meta.port}`);

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
  ws = new WebSocket(targets.find((item) => item.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const call = cdp();
  await call('Page.enable');
  await call('Runtime.enable');
  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result?.value;
  };

  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query}` });
  await waitFor(() => evaluate("Boolean(document.querySelector('#app')?.textContent?.trim())"), 20000);

  const openCanvas = `(() => {
    const nav=[...document.querySelectorAll('[data-action="nav"]')]
      .find(x=>x.getAttribute('data-arg')==='canvas');
    if(!nav) return false;
    nav.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    return true;
  })()`;
  step('侧边栏存在画布入口', await evaluate(openCanvas) === true);
  const ready = await waitFor(
    () => evaluate("document.querySelectorAll('g.canvas-node').length >= 2"), 15000
  );
  step('画布渲染出 Studio 阶段节点', ready === true,
    `nodes=${await evaluate("document.querySelectorAll('g.canvas-node').length")}`);
  if (!ready) throw new Error('canvas nodes never rendered');

  const labels = await evaluate(`(() => [...document.querySelectorAll('g.canvas-node text')]
    .map(t=>t.textContent))()`);
  step('画布节点显示中文阶段名（不是裸 id）',
    labels.includes('需求') && labels.includes('开发'), labels.join(' / '));

  const paths = await evaluate(`(() => [...document.querySelectorAll('path.canvas-edge')]
    .map(p=>p.getAttribute('d')))()`);
  step('依赖边是合法 SVG 路径',
    paths.length === 1 && /^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/.test(paths[0]), paths.join(' | '));

  const progress = await evaluate(`document.body.textContent.includes('进度 1/2')`);
  step('画布显示运行进度 1/2', progress === true);

  const sources = await evaluate(`(() => [...document.querySelectorAll('[data-action="canvas-pick"]')]
    .map(b=>b.textContent))()`);
  step('工作流选择器列出 Studio 工作流',
    sources.some((text) => text.includes('画布验证流程')), sources.join(' / '));

  // --- rename a stage through the real DOM --------------------------------
  await evaluate(`(() => {
    const node=[...document.querySelectorAll('g.canvas-node')]
      .find(g=>g.getAttribute('data-arg')?.includes('s01'));
    if(!node) return false;
    node.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return true;
  })()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('#canvas-stage-name'))"), 8000);
  await evaluate(`(() => {
    const input=document.querySelector('#canvas-stage-name');
    input.value='需求已改名';
    const save=[...document.querySelectorAll('button')]
      .find(b=>b.getAttribute('data-action')==='canvas-stage-save');
    if(!save) return false;
    save.click(); return true;
  })()`);
  await waitFor(() => readDoc().flows[0].stages[0].name === '需求已改名', 12000);
  step('点击节点改名并落盘', readDoc().flows[0].stages[0].name === '需求已改名');

  // --- add a stage through the real DOM -----------------------------------
  await evaluate(`(() => {
    const b=[...document.querySelectorAll('button')]
      .find(x=>x.getAttribute('data-action')==='canvas-add-stage');
    if(!b) return false; b.click(); return true;
  })()`);
  await waitFor(() => readDoc().flows[0].stages.length === 3, 12000);
  step('新增阶段落盘', readDoc().flows[0].stages.length === 3);
  const threeDiag = await waitFor(() => evaluate(`(() => {
    const ids=[...document.querySelectorAll('g.canvas-node')]
      .map(g=>JSON.parse(g.getAttribute('data-arg')||'{}').id);
    return ids.length === 3 ? ids : null;
  })()`), 12000);
  step('新增阶段立即出现在画布', threeDiag !== null, JSON.stringify(threeDiag));

  // --- add and remove a dependency ---------------------------------------
  await evaluate(`(() => {
    const b=[...document.querySelectorAll('button')]
      .find(x=>x.getAttribute('data-action')==='canvas-link-mode');
    if(!b) return false; b.click(); return true;
  })()`);
  await waitFor(() => evaluate("Boolean(document.querySelector('#canvas-link-from'))"), 8000);
  await evaluate(`(() => {
    const from=document.querySelector('#canvas-link-from');
    const to=document.querySelector('#canvas-link-to');
    from.value='s01'; from.dispatchEvent(new Event('change',{bubbles:true}));
    to.value='s03'; to.dispatchEvent(new Event('change',{bubbles:true}));
    const add=[...document.querySelectorAll('button')]
      .find(b=>b.getAttribute('data-action')==='canvas-edge-add');
    if(!add) return false; add.click(); return true;
  })()`);
  await sleep(1200);
  const addDiag = await evaluate(`(() => ({
    toast: document.querySelector('.toast')?.textContent ?? '',
  }))()`);
  await waitFor(() => readDoc().flows[0].edges.length === 2, 12000);
  step('表单新增依赖落盘', readDoc().flows[0].edges.length === 2, addDiag.toast);
  await waitFor(() => evaluate("document.querySelectorAll('path.canvas-edge').length === 2"), 12000);

  await evaluate(`(() => {
    const edge=[...document.querySelectorAll('path.canvas-edge')]
      .find(p=>p.getAttribute('data-arg')?.includes('s03'));
    if(!edge) return false;
    edge.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return true;
  })()`);
  await waitFor(() => evaluate(`[...document.querySelectorAll('button')]
    .some(b=>b.getAttribute('data-action')==='canvas-edge-remove')`), 8000);
  await evaluate(`(() => {
    const b=[...document.querySelectorAll('button')]
      .find(x=>x.getAttribute('data-action')==='canvas-edge-remove');
    if(!b) return false; b.click(); return true;
  })()`);
  await waitFor(() => readDoc().flows[0].edges.length === 1, 12000);
  step('点击依赖并删除落盘', readDoc().flows[0].edges.length === 1);

  // --- drag a node and reload --------------------------------------------
  const before = await evaluate(`(() => {
    const rect=[...document.querySelectorAll('g.canvas-node')]
      .find(g=>g.getAttribute('data-arg')?.includes('s02'))?.querySelector('rect');
    return rect ? { x:Number(rect.getAttribute('x')), y:Number(rect.getAttribute('y')) } : null;
  })()`);
  const box = await evaluate(`(() => {
    const g=[...document.querySelectorAll('g.canvas-node')]
      .find(x=>x.getAttribute('data-arg')?.includes('s02'));
    if(!g) return null;
    g.scrollIntoView({block:'center', inline:'center'});
    const r=g.getBoundingClientRect();
    return { x:r.left+r.width/2, y:r.top+r.height/2 };
  })()`);
  await sleep(200);
  let dragDiag = null;
  if (before && box) {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
    dragDiag = await evaluate(`(() => ({
      transformed: document.querySelectorAll('g.canvas-node[transform]').length,
      hit: document.elementFromPoint(${box.x}, ${box.y})?.tagName ?? '',
    }))()`);
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x + 36, y: box.y + 28, button: 'left', buttons: 1 });
    dragDiag.moved = await evaluate("document.querySelectorAll('g.canvas-node[transform]').length");
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + 36, y: box.y + 28, button: 'left', buttons: 0, clickCount: 1 });
  }
  const stored = await evaluate(`(() => {
    const all=JSON.parse(localStorage.getItem('maestro.canvas.layout')||'{}');
    return all['canvas-demo']?.s02 ?? null;
  })()`);
  step('拖拽位置写入本地布局偏好', Boolean(stored && stored.x !== before.x),
    JSON.stringify({ dragDiag, stored, before }));

  await call('Page.reload', { ignoreCache: true });
  await waitFor(() => evaluate("Boolean(document.querySelector('#app')?.textContent?.trim())"), 20000);
  await evaluate(openCanvas);
  const reloaded = await waitFor(
    () => evaluate("document.querySelectorAll('g.canvas-node').length >= 3"), 20000
  );
  step('重载后画布重新渲染', reloaded === true);
  const after = await evaluate(`(() => {
    const rect=[...document.querySelectorAll('g.canvas-node')]
      .find(g=>g.getAttribute('data-arg')?.includes('s02'))?.querySelector('rect');
    return rect ? { x:Number(rect.getAttribute('x')), y:Number(rect.getAttribute('y')) } : null;
  })()`);
  step('重载后布局与编辑结果保留',
    after?.x === stored?.x && after?.y === stored?.y && readDoc().flows[0].stages.length === 3,
    `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);

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
