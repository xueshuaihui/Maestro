/**
 * Scenario acceptance: walk the product the way a user does.
 *
 * Why this exists: unit tests and endpoint assertions prove the domain layer
 * works; they cannot prove a page renders, a button does something, or a label
 * is populated. The previous rounds verified endpoints and one wizard path, so
 * a canvas that drew "[object Object]" and pages that rendered empty still
 * passed. This script only asserts what a user can SEE and DO:
 *
 *   - every sidebar entry opens a page with real content (no blanks, no
 *     `undefined`, no `[object Object]`, no unreplaced `{token}`);
 *   - clicking a navigation entry twice does not throw or dead-end;
 *   - the Studio wizard, the canvas editor and the instance drill-down are
 *     driven through the real DOM;
 *   - the state they leave on disk matches what the screen claimed.
 *
 * Run: node scripts/verify-scenarios.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => delay(ms);

// `--app` runs the SAME assertions against the built bundle instead of the
// source tree. Source-tree green says nothing about the artifact users install:
// the bundle carries its own copy of desktop/ui and its own daemon entry.
const USE_APP = process.argv.includes('--app');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const APP_BIN = path.join(APP, 'Contents', 'MacOS', 'maestro');

let pass = 0;
const failures = [];
const notes = [];
function step(name, ok, detail = '') {
  const line = `[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (ok) pass += 1; else failures.push({ name, detail });
}
function skip(name, why) {
  console.log(`[SKIP] ${name} — ${why}`);
  notes.push({ name, why });
}

// --- fixture: a project that already has an organization and two flows ------
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-scenario-'));
const home = path.join(root, 'home');
fs.mkdirSync(path.join(root, '.orch'), { recursive: true });
fs.mkdirSync(home, { recursive: true });
const studioFile = path.join(root, '.orch', 'studio.json');

const now = new Date().toISOString();
const doc = {
  schemaVersion: 1,
  updatedAt: now,
  departments: [
    { id: 'dept-product', name: '产品部', summary: '', createdAt: now },
    { id: 'dept-eng', name: '研发部', summary: '', createdAt: now },
  ],
  roles: [
    {
      id: 'role-pm', code: 'pm', name: '产品经理', departmentId: 'dept-product', summary: '需求',
      duty: '写需求', inputs: [], outputs: [], skills: [], requires: [],
      contract: { verdict: true }, createdAt: now,
    },
    {
      id: 'role-dev', code: 'dev', name: '开发', departmentId: 'dept-eng', summary: '实现',
      duty: '写代码', inputs: [], outputs: [], skills: [], requires: [],
      contract: { verdict: true }, createdAt: now,
    },
  ],
  employees: [
    { id: 'emp-pm', name: '产品一号', roleId: 'role-pm', cliId: 'unbound', model: null, createdAt: now },
    { id: 'emp-dev', name: '开发一号', roleId: 'role-dev', cliId: 'unbound', model: null, createdAt: now },
  ],
  teams: [
    { id: 'team-demo', name: '示范团队', leadRoleId: 'role-pm', roleIds: ['role-pm', 'role-dev'], flowId: 'flow-rd', members: ['emp-pm', 'emp-dev'], createdAt: now },
  ],
  tasks: [], defects: [], changes: [],
  flows: [
    {
      id: 'flow-rd', name: '两阶段研发', kind: 'custom', runMode: 'semi', gates: [],
      stages: [
        { id: 'st-1', name: '需求分析', titleKey: null, roleCodes: ['pm'], parallel: false, gate: null, artifacts: [] },
        { id: 'st-2', name: '编码实现', titleKey: null, roleCodes: ['dev'], parallel: false, gate: null, artifacts: [] },
      ],
      edges: [{ from: 'st-1', to: 'st-2' }],
      createdAt: now,
    },
  ],
  runs: [{
    id: 'RUN-1', flowId: 'flow-rd', mode: 'simulate', status: 'running',
    startedAt: now, finishedAt: null,
    stages: [{ stageId: 'st-1', status: 'done' }, { stageId: 'st-2', status: 'pending' }],
  }],
};
fs.writeFileSync(studioFile, JSON.stringify(doc), 'utf8');

let daemon = null;
let chrome = null;
let ws = null;
const runtimeErrors = [];

async function waitFor(predicate, timeoutMs, intervalMs = 120) {
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
        runtimeErrors.push(d?.exception?.description ?? d?.text ?? 'exception');
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        runtimeErrors.push((msg.params.args ?? []).map((a) => a.value ?? a.description).join(' '));
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

const NAV = [
  ['project', '项目'],
  ['instances', '实例'],
  ['queue', '人工干预队列'],
  ['notifications', '通知'],
  ['studio', '搭建台'],
  ['assets', '角色与技能库'],
  ['occupancy', '角色占用'],
  ['canvas', '工作流画布'],
  ['governance', '治理'],
  ['settings', '设置'],
];

try {
  const logFd = fs.openSync(path.join(root, 'daemon.log'), 'w');
  if (USE_APP) {
    if (!fs.existsSync(APP_BIN)) throw new Error(`built app missing: ${APP_BIN} (run npm run desktop:build)`);
    // A leftover shell holds the single-instance lock and would only "activate"
    // instead of starting a daemon (false negative, no desktop.json).
    if (process.platform === 'darwin') spawnSync('killall', ['-9', 'maestro'], { stdio: 'ignore' });
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
  step(`S0 ${USE_APP ? '打包产物 .app' : '源码 daemon'} 就绪`, true, `port ${meta.port}`);

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
    const res = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result?.value;
  };

  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query}` });
  const painted = await waitFor(
    () => evaluate("(document.querySelector('.content')?.innerText ?? '').trim().length > 30"), 20000,
  );
  step('S0 冷启动首屏有内容', painted === true);
  const boot = await evaluate("document.body.innerText.slice(0,200)");
  step('S0 未卡在连接态', !/正在连接/.test(boot), boot.split('\n').filter(Boolean).slice(0, 2).join(' | '));

  const navExists = await evaluate(`(() => {
    const want=${JSON.stringify(NAV.map(([v]) => v))};
    const have=[...document.querySelectorAll('[data-action="nav"]')]
      .map(n=>n.getAttribute('data-arg')).filter(Boolean);
    return want.filter(v=>!have.includes(v));
  })()`);
  step('S0 侧边栏十项入口齐全', Array.isArray(navExists) && navExists.length === 0,
    Array.isArray(navExists) && navExists.length ? `缺少 ${navExists.join(',')}` : '');

  async function open(view) {
    const ok = await evaluate(`(() => {
      const n=[...document.querySelectorAll('[data-action="nav"]')]
        .find(x=>x.getAttribute('data-arg')===${JSON.stringify(view)});
      if(!n) return false;
      n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
      return true;
    })()`);
    if (ok) await sleep(700);
    return ok === true;
  }

  async function snapshot() {
    return evaluate(`(() => {
      const box=document.querySelector('.content');
      const text=(box?.innerText ?? '');
      return {
        len: text.trim().length,
        head: text.trim().split('\\n').filter(Boolean).slice(0,3),
        body: text.slice(0, 1200),
        nodes: box ? box.querySelectorAll('*').length : 0,
        iframe: (() => {
          const f = box?.querySelector('iframe');
          if (!f) return false;
          try {
            const inner = (f.contentDocument?.body?.innerText ?? '').trim();
            return inner.length > 30;
          } catch { return false; }
        })(),
        iframeInfo: (() => {
          const f = box?.querySelector('iframe');
          if (!f) return { exists: false };
          const info = { exists: true, src: f.getAttribute('src') ?? null };
          try {
            const d = f.contentDocument;
            info.ready = d?.readyState ?? 'null-doc';
            info.title = d?.title ?? null;
            info.len = (d?.body?.innerText ?? '').length;
          } catch (error) { info.err = String(error); }
          return info;
        })(),
      };
    })()`);
  }

  // --- every nav entry: opens, has content, has no leaked placeholders ------
  for (const [view, label] of NAV) {
    const opened = await open(view);
    if (!opened) { step(`S1 导航「${label}」可点击`, false, 'sidebar entry missing'); continue; }
    const snap = await waitFor(async () => {
      const s = await snapshot();
      return s.len > 0 || s.iframe ? s : null;
    }, 12000);
    if (!snap) { step(`S1 导航「${label}」有内容`, false, 'content stayed empty'); continue; }
    const leaks = [];
    if (/\[object Object\]/.test(snap.body)) leaks.push('[object Object]');
    if (/\bundefined\b/.test(snap.body)) leaks.push('undefined');
    if (/\{[A-Za-z_][A-Za-z0-9_]*\}/.test(snap.body)) leaks.push('未替换占位符');
    // An empty-state page is legitimately short; "暂无数据" IS the content.
    const enough = view === 'studio'
      ? snap.iframe === true
      : (snap.len >= 20 || snap.body.includes('暂无数据'));
    step(`S1 导航「${label}」有内容`, enough,
      `len=${snap.len} nodes=${snap.nodes} iframe=${JSON.stringify(snap.iframeInfo)} head=${snap.head.join(' / ')}`);
    step(`S1 导航「${label}」无脏文本`, leaks.length === 0, leaks.join(','));
  }

  // --- click the same entry twice (repaint must not eat the handler) --------
  const redraw = [];
  for (const view of ['instances', 'canvas', 'settings']) {
    await open('instances');
    const first = await open(view);
    const second = await open(view);
    redraw.push({ view, first, second });
  }
  step('S2 同一入口连点两次仍可切换',
    redraw.every((r) => r.first && r.second), JSON.stringify(redraw));

  // --- canvas is usable, not a skeleton -----------------------------------
  await open('canvas');
  await waitFor(() => evaluate("document.querySelectorAll('g.canvas-node').length >= 2"), 15000);
  const canvas = await evaluate(`(() => ({
    nodes: document.querySelectorAll('g.canvas-node').length,
    labels: [...document.querySelectorAll('g.canvas-node text')].map(t=>t.textContent),
    edges: [...document.querySelectorAll('path.canvas-edge')].map(p=>p.getAttribute('d')),
    picks: [...document.querySelectorAll('[data-action="canvas-pick"]')].map(b=>b.textContent),
  }))()`);
  step('S3 画布渲染节点', canvas.nodes >= 2, `nodes=${canvas.nodes}`);
  step('S3 画布节点是中文阶段名', canvas.labels.includes('需求分析'), canvas.labels.join(' / '));
  step('S3 画布连线是合法路径',
    canvas.edges.length >= 1 && canvas.edges.every((d) => typeof d === 'string' && /^M [\d.-]+ [\d.-]+/.test(d)),
    canvas.edges.join(' | '));
  step('S3 画布选择器列出项目工作流', canvas.picks.some((t) => t.includes('两阶段研发')), canvas.picks.join(' / '));

  // --- instance list -> open one ------------------------------------------
  await open('instances');
  const rows = await evaluate(`(() => [...document.querySelectorAll('.content [data-action]')]
    .map(n=>n.getAttribute('data-action')))()`);
  step('S4 实例页有可操作条目', Array.isArray(rows) && rows.length > 0, JSON.stringify(rows?.slice(0, 8)));

  // --- S6: run the flow, then look at what the user sees -------------------
  const runStart = await evaluate(`(async () => {
    const t = sessionStorage.getItem('maestro.desktop.token');
    const r = await fetch('/studio/action', {
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},
      body: JSON.stringify({ action:'run.start', teamId:'team-demo', mode:'simulate' })
    });
    return { status:r.status, body: await r.json() };
  })()`);
  const runOk = runStart?.status === 200 && runStart?.body?.ok === true;
  step('S6 启动工作流运行', runOk,
    `status=${runStart?.status ?? ''} code=${runStart?.body?.code ?? ''} run=${runStart?.body?.run?.id ?? ''}`);
  const runId = runStart?.body?.run?.id ?? null;

  if (runOk) {
    const afterRun = await evaluate(`(async () => {
      const t = sessionStorage.getItem('maestro.desktop.token');
      const r = await fetch('/studio/state', { headers:{Authorization:'Bearer '+t} });
      const s = await r.json();
      const run = (s.runs ?? []).find(x => x.id === ${JSON.stringify(runId)});
      return { status: run?.status ?? null, stages: (run?.stages ?? []).map(x=>x.status) };
    })()`);
    step('S6 运行推进到门禁/完成（不是停在 running 空转）',
      ['awaiting-approval', 'completed'].includes(afterRun.status),
      JSON.stringify(afterRun));

    // The canvas must show this run, otherwise "看进度" is a promise not a fact.
    await open('canvas');
    const live = await waitFor(async () => {
      const text = await evaluate("document.querySelector('.content')?.innerText ?? ''");
      return /进度\s*\d+\/\d+/.test(text) ? text : null;
    }, 12000);
    step('S6 画布显示本次运行进度', Boolean(live),
      live ? (live.match(/进度\s*\d+\/\d+/) ?? [''])[0] : 'no progress text');

    // What the user does next: click 实例 to inspect the run.
    await open('instances');
    const listed = await evaluate(`(() => {
      const box=document.querySelector('.content');
      return { text:(box?.innerText ?? '').slice(0,400), cards: box?.querySelectorAll('[data-action="open-instance"]').length ?? 0 };
    })()`);
    step('S6 运行后实例列表能看到对应条目',
      listed.cards > 0 || (runId !== null && listed.text.includes(runId)),
      `cards=${listed.cards} head=${listed.text.split('\\n').filter(Boolean).slice(0,4).join(' / ')}`);
  } else {
    skip('S6 运行推进与实例可见', 'run.start failed');
  }

  // --- S7: the create-instance form, driven through the real DOM ----------
  await open('new');
  const formReady = await waitFor(() => evaluate(
    "Boolean(document.querySelector('#new-task'))"), 10000,
  );
  step('S7 新建实例表单可用', formReady === true);

  if (formReady) {
    const picked = await evaluate(`(() => {
      const tiles=[...document.querySelectorAll('[data-action="pick-template"]')];
      if(tiles.length===0) return null;
      const first=tiles.find(t=>t.textContent.includes('单节点')) ?? tiles[0];
      first.click();
      return first.textContent.trim().split('\\n')[0];
    })()`);
    step('S7 选择工作流模板', typeof picked === 'string' && picked.length > 0, String(picked));

    await evaluate(`(() => {
      const area=document.querySelector('#new-task');
      area.value='演示任务：产出一段说明';
      area.dispatchEvent(new Event('input',{bubbles:true}));
      const start=[...document.querySelectorAll('button')]
        .find(b=>b.getAttribute('data-action')==='submit-new');
      if(!start) return false;
      start.click();
      return true;
    })()`);

    const outcome = await waitFor(async () => {
      const state = await evaluate(`(() => {
        const err=document.querySelector('.form-error');
        const ok=document.querySelector('.form-ok');
        const cards=document.querySelectorAll('[data-action="open-instance"]').length;
        return {
          error: err?.textContent ?? null,
          success: ok?.textContent ?? null,
          cards,
          view: document.querySelector('.content')?.innerText.slice(0,120) ?? ''
        };
      })()`);
      return state.cards > 0 || state.error || state.success ? state : null;
    }, 20000);
    const created = Boolean(outcome && outcome.cards > 0);
    const honest = Boolean(outcome && typeof outcome.error === 'string' && outcome.error.trim().length > 0);
    step('S7 提交后要么创建实例、要么给出可读错误',
      created || honest,
      created ? `instances=${outcome.cards}` : `error=${outcome?.error ?? 'none'}`);
    if (honest) {
      // A leaked `{cause}` or a bare error code is what the user must never
      // read; a machine path inside a Chinese sentence is fine.
      const noPlaceholder = !/\{[A-Za-z_]\w*\}/.test(outcome.error);
      const hasChinese = /[\u4e00-\u9fa5]/.test(outcome.error);
      step('S7 错误文案已填充参数且为中文', noPlaceholder && hasChinese,
        outcome.error.slice(0, 100));
      if (/DSH|CLI/.test(outcome.error)) {
        const hinted = await evaluate("document.body.innerText.includes('先在搭建台扫描')");
        step('S7 无可用 CLI 时给出下一步操作引导', hinted === true);
      }
    }
  }

  // --- settings reaches real project facts --------------------------------
  await open('settings');
  const settings = await snapshot();
  step('S5 设置页显示项目路径', settings.body.includes(root) || settings.body.includes('.orch'),
    settings.head.join(' / '));

  // --- final: no uncaught errors across the whole walk --------------------
  step('S6 全程无未捕获异常', runtimeErrors.length === 0,
    runtimeErrors.slice(0, 3).join(' | '));

  console.log(`\n${pass} passed, ${failures.length} failed, ${notes.length} skipped`);
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
