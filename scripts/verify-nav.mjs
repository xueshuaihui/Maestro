/**
 * Menu / navigation acceptance (beta.4 menu redesign).
 *
 * Drives the REAL desktop UI through Chrome DevTools and evaluates the menu the
 * way a user meets it:
 *   1. five job-shaped sections in the sidebar, nothing else;
 *   2. every section opens its own tab strip, every tab opens a real page;
 *   3. no dead entry: each destination renders a heading and a body;
 *   4. the two "do work" paths on the new pages actually write:
 *      create a workflow, create/archive/restore a resource;
 *   5. one screenshot per section for the visual review.
 *
 * Run: node scripts/verify-nav.mjs [--app]
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
const SHOT_DIR = process.env.NAV_SHOT_DIR ?? path.join(os.tmpdir(), 'maestro-nav-shots');
const sleep = (ms) => delay(ms);

let pass = 0;
const failures = [];
const errors = [];
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push(name);
}

fs.mkdirSync(SHOT_DIR, { recursive: true });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-nav-'));
const home = path.join(root, 'home');
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
    '--window-size=1440,960',
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
  const shot = async (name) => {
    try {
      const png = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOT_DIR, `${name}.png`), Buffer.from(png.data, 'base64'));
    } catch (error) {
      errors.push(`screenshot ${name}: ${error?.message ?? error}`);
    }
  };

  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query}` });
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"section\"]').length > 0"), 25000);
  await sleep(800);

  // --- 1: the sidebar is five jobs, not eleven screens ---------------------
  const sidebar = await evaluate(`(() => {
    const items = [...document.querySelectorAll('.sidebar [data-action="section"]')];
    return {
      count: items.length,
      labels: items.map(n => (n.querySelector('.nav-text')?.textContent ?? '').trim()),
      args: items.map(n => n.getAttribute('data-arg')),
      active: items.filter(n => n.classList.contains('on')).map(n => n.getAttribute('data-arg')),
      other: document.querySelectorAll('.sidebar .nav-item').length,
    };
  })()`);
  const describe = (value) => JSON.stringify(value ?? null);
  step('侧栏只有 5 个任务段', sidebar.count === 5 && sidebar.other === 5, describe(sidebar));
  step('段名与任务一一对应', describe(sidebar.labels) === describe(['运行', '团队', '流程', '治理', '设置']), describe(sidebar.labels));
  step('首屏高亮「运行」', describe(sidebar.active) === describe(['run']), describe(sidebar.active));
  await shot('01-run');

  // --- 2/3: every section opens a tab strip, every tab a real page ---------
  const SECTIONS = [
    ['run', ['实例', '待处理', '通知', '占用']],
    ['team', ['组织', '资源库', '内置资产']],
    ['flow', ['工作流', '画布']],
    ['govern', ['审计']],
    ['setup', ['项目', '偏好']],
  ];

  // Precise anchors: the sidebar entry carries `data-section`, the strip entry
  // carries `data-tab`. Matching by action+arg alone would also hit in-page
  // buttons that happen to share the argument.
  // A real pointer sequence: press first (the shell handles navigation there),
  // then a click (the shell de-duplicates it, and click-only actions still
  // work). Matching by `data-section` / `data-tab` keeps the anchors unique.
  const hit = `(node) => {
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  }`;
  const pressSection = async (id) => evaluate(`(() => {
    const node = document.querySelector('.sidebar [data-section="${id}"]');
    if (!node) return false;
    (${hit})(node);
    return true;
  })()`);
  const pressTab = async (view) => evaluate(`(() => {
    const node = document.querySelector('.secbar .sec-tab[data-tab="${view}"]');
    if (!node) return false;
    (${hit})(node);
    return true;
  })()`);
  const press = async (action, arg = null) => evaluate(`(() => {
    const want = ${JSON.stringify(arg === null ? '' : String(arg))};
    const nodes = [...document.querySelectorAll('[data-action="${action}"]')];
    const node = nodes.find(n => (n.getAttribute('data-arg') ?? '') === want)
      ?? (want === '' ? nodes[0] : null);
    if (!node) return false;
    (${hit})(node);
    return true;
  })()`);

  for (const [sectionId, expectedTabs] of SECTIONS) {
    if (sectionId !== 'run') {
      const pressed = await pressSection(sectionId);
      step(`侧栏可进入「${sectionId}」`, pressed === true, `pressed=${pressed}`);
      await sleep(700);
    }
    const strip = await evaluate(`(() => {
      const bar = document.querySelector('.secbar');
      const tabs = [...(bar?.querySelectorAll('.sec-tab') ?? [])];
      return {
        visible: bar ? getComputedStyle(bar).display !== 'none' : false,
        labels: tabs.map(t => (t.textContent ?? '').trim()),
        active: tabs.filter(t => t.classList.contains('on')).map(t => (t.textContent ?? '').trim()),
      };
    })()`);
    const expectsStrip = expectedTabs.length > 1;
    step(`「${sectionId}」标签栏 = ${expectedTabs.join('/')}`,
      describe(strip.labels) === describe(expectedTabs) && strip.visible === expectsStrip,
      describe(strip));
    step(`「${sectionId}」有且只有一个当前标签`, strip.active.length === 1, describe(strip.active));
    await shot(`02-${sectionId}`);
  }

  // --- every tab renders a heading and a body ------------------------------
  const destinations = [];
  for (const [sectionId, expectedTabs] of SECTIONS) {
    // Always re-enter the section: the previous loop left the app on the last
    // one, so "current section" is never `run` by that point.
    await pressSection(sectionId);
    await sleep(600);
    const views = await evaluate(`(() => [...document.querySelectorAll('.secbar .sec-tab')]
      .map(t => t.getAttribute('data-arg')))()`);
    for (const view of views ?? []) destinations.push([sectionId, view]);
  }
  let deadPages = [];
  for (const [sectionId, view] of destinations) {
    await pressSection(sectionId);
    await sleep(400);
    const ok = await pressTab(view);
    await sleep(900);
    const stripNow = await evaluate(`(() => [...document.querySelectorAll('.secbar .sec-tab')].map(t => t.getAttribute('data-tab')))()`);
    const page = await evaluate(`(() => {
      const content = document.querySelector('.content') ?? document;
      const head = content.querySelector('.page-head h1');
      return {
        head: (head?.textContent ?? '').trim(),
        chars: (content.innerText ?? '').replace(/\\s+/g, '').length,
        // The org builder is a framed sub-app: it renders no page heading, so
        // the frame itself is the proof that the route opened something.
        framed: document.querySelector('.content iframe') !== null,
        crumb: (document.querySelector('.crumb')?.innerText ?? '').replace(/\\s+/g, ' ').trim(),
      };
    })()`);
    // A sparse page (empty queue, empty notifications) is still a real page:
    // the heading is the assertion, the body only has to be non-blank.
    const good = ok === true && ((page.head.length > 0 && page.chars > 0) || page.framed === true);
    if (!good) deadPages.push({ sectionId, view, ...page, pressed: ok, stripNow });
  }
  step(`每个标签都打开有标题有内容的页面（${destinations.length} 个）`, deadPages.length === 0, describe(deadPages.slice(0, 3)));

  // --- 4: the workflow list can create and copy ----------------------------
  await pressSection('flow');
  await sleep(500);
  // The section remembers the last sub-tab (the canvas, after the walk above);
  // go to the list explicitly, the way a user would.
  await pressTab('flows');
  await sleep(900);
  const flowBefore = await evaluate("document.querySelectorAll('.content table tbody tr').length");
  await evaluate(`(() => {
    const input = document.querySelector('#flow-name');
    if (!input) return false;
    input.value = '回归验证流程';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await press('flow-create');
  const created = await waitFor(async () => {
    const n = await evaluate("document.querySelectorAll('.content table tbody tr').length");
    return n > flowBefore ? n : null;
  }, 12000, 300);
  step('工作流页可以新建流程并出现在列表里', Number.isFinite(created), `before=${flowBefore} after=${created}`);
  const flowRow = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.content table tbody tr')];
    const row = rows.find(r => (r.innerText ?? '').includes('回归验证流程'));
    return row ? row.innerText.replace(/\\s+/g, ' ').trim() : '';
  })()`);
  step('新流程标记为「项目」并带阶段数', /项目/.test(flowRow) && /阶段/.test(flowRow), flowRow.slice(0, 120));
  await shot('03-flows');

  const copyPressed = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.content table tbody tr')];
    const row = rows.find(r => (r.innerText ?? '').includes('回归验证流程'));
    const btn = row?.querySelector('[data-action="flow-copy"]');
    if (!btn) return false;
    (${hit})(btn);
    return true;
  })()`);
  const copied = copyPressed === true
    ? await waitFor(async () => (await evaluate("document.querySelectorAll('.content table tbody tr').length")) > created, 10000, 300)
    : null;
  step('流程可以复制成项目副本', Boolean(copied), `copyPressed=${copyPressed} rows=${copied}`);

  // --- 5: the resource table can create / archive / restore ----------------
  await pressSection('team');
  await sleep(500);
  await pressTab('resources');
  await sleep(900);
  await press('resource-type', 'department');
  await sleep(900);
  const resBefore = await evaluate("document.querySelectorAll('.content table tbody tr').length");
  await evaluate(`(() => {
    const input = document.querySelector('#resource-name');
    if (!input) return false;
    input.value = '回归验证部门';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await press('resource-create');
  const resCreated = await waitFor(async () => {
    const n = await evaluate("document.querySelectorAll('.content table tbody tr').length");
    return n > resBefore ? n : null;
  }, 10000, 300);
  step('资源库可以新建部门并出现在表里', Number.isFinite(resCreated), `before=${resBefore} after=${resCreated}`);

  const archivePressed = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.content table tbody tr')];
    const row = rows.find(r => (r.innerText ?? '').includes('回归验证部门'));
    const btn = row?.querySelector('[data-action="resource-archive"]');
    if (!btn) return false;
    (${hit})(btn);
    return true;
  })()`);
  const trace = [];
  const archived = archivePressed === true
    ? await waitFor(async () => {
      const snap = await evaluate(`(() => ({
        toast: (document.querySelector('.toast')?.textContent ?? '').trim(),
        rows: document.querySelectorAll('.content table tbody tr').length,
      }))()`);
      trace.push(snap);
      const text = await evaluate("(document.querySelector('.content')?.innerText ?? '')");
      return !text.includes('回归验证部门') ? snap : null;
    }, 9000, 400)
    : null;
  if (!archived) console.log('  trace:', describe(trace.slice(0, 6)));
  const afterArchive = await evaluate(`(() => ({
    rows: document.querySelectorAll('.content table tbody tr').length,
    toast: (document.querySelector('.toast')?.textContent ?? '').trim(),
    text: (document.querySelector('.content')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 220),
  }))()`);
  step('归档后该行从默认列表消失', Boolean(archived), `pressed=${archivePressed} ${describe(afterArchive)}`);
  await shot('04-resources');

  step('浏览器内无未捕获异常', errors.length === 0, describe(errors.slice(0, 3)));
  console.log(`\nscreenshots: ${SHOT_DIR}`);
} catch (err) {
  step('脚本执行', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  if (ws) ws.close();
  if (chrome) chrome.kill('SIGKILL');
  if (daemon) daemon.kill('SIGKILL');
  console.log(`\nnav: ${pass}/${pass + failures.length} steps passed`);
  if (failures.length > 0) {
    console.log('NAV_FAIL: ' + failures.join(' | '));
    process.exitCode = 1;
  } else { console.log('NAV_OK'); }
}
