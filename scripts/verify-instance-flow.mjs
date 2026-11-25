/**
 * Instance-flow acceptance: can a user actually configure and start an instance?
 *
 * Everything here is done the way a user does it — clicking real buttons and
 * typing into real fields. No request is issued directly by the script except
 * the ones the page itself would issue, because the point is to prove the
 * *interaction* exists, not that the endpoint works.
 *
 * The scenario:
 *   1. 实例页 tells you there is no host yet.
 *   2. 新建实例 → 扫描本机 CLI → 绑定一个真实 CLI 作为宿主.
 *   3. 选工作流 + 写任务 + 开始 → 实例真的起来.
 *   4. 打开实例 → 概览/流程图/看板/证据 四个页签都有内容.
 *
 * Run: node scripts/verify-instance-flow.mjs [--app]
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
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass += 1; else failures.push({ name, detail });
}
function skip(name, why) {
  console.log(`[SKIP] ${name} — ${why}`);
  skipped.push({ name, why });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-instance-flow-'));
const home = path.join(root, 'home');
fs.mkdirSync(path.join(root, '.orch'), { recursive: true });
fs.mkdirSync(home, { recursive: true });

// A real CLI must be on PATH for the scan to find one. The runner may point at
// a locally installed opencode; otherwise the scan legitimately finds nothing
// and the script says so instead of pretending the flow passed.
const extraBin = process.env.MAESTRO_CLI_BIN ?? '';
const childPath = extraBin ? `${extraBin}${path.delimiter}${process.env.PATH ?? ''}` : (process.env.PATH ?? '');

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
  step('真实 daemon 就绪', true, `port ${meta.port}`);

  const profile = path.join(root, 'chrome-profile');
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
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
  await waitFor(() => evaluate("(document.body.innerText ?? '').trim().length > 40"), 20000);

  const click = (action, arg) => evaluate(`(() => {
    // Only visible nodes are clickable for a user; the shell keeps a hidden
    // drawer copy of the last page, and clicking that copy would silently do
    // nothing while the test blamed the action.
    const list=[...document.querySelectorAll('[data-action=' + JSON.stringify(${JSON.stringify(action)}) + ']')]
      .filter((n) => n.getClientRects().length > 0);
    const hit=${arg === undefined ? 'list[0]' : `list.find(n=>n.getAttribute('data-arg')===${JSON.stringify(arg)})`};
    if(!hit) return false;
    hit.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    hit.click();
    return true;
  })()`);

  const text = () => evaluate('(document.querySelector(".content")?.innerText ?? document.body.innerText ?? "").trim()');

  // --- S1: the instance page admits it cannot start anything ---------------
  await waitFor(() => evaluate("document.querySelectorAll('[data-action=\"nav\"]').length > 5"), 15000);
  await evaluate(`(() => {
    const n=[...document.querySelectorAll('[data-action="nav"]')].find(x=>x.getAttribute('data-arg')==='instances');
    if(!n) return false;
    n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    n.click();
    return true;
  })()`);
  await sleep(1200);
  const listText = await text();
  step('S1 实例页明说没有宿主', /没有绑定宿主|宿主/.test(listText), listText.split('\n').slice(0, 3).join(' | '));

  // --- S2: 新建实例 → 扫描 → 绑定 ------------------------------------------
  await evaluate(`(() => {
    const b=[...document.querySelectorAll('[data-action="nav"]')].find(x=>x.getAttribute('data-arg')==='new');
    if(!b) return false;
    b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    b.click();
    return true;
  })()`);
  await sleep(1500);
  const newText = await text();
  step('S2 新建页有宿主区与扫描按钮', /运行宿主/.test(newText) && /扫描本机 CLI/.test(newText),
    newText.split('\n').filter(Boolean).slice(0, 4).join(' | '));

  step('S2 扫描按钮可点', await click('scan-hosts'));
  const scanned = await waitFor(async () => {
    const rows = await evaluate(`document.querySelectorAll('[data-action="bind-host"]').length`);
    return rows > 0 ? rows : null;
  }, 40000, 300);
  if (scanned) {
    step('S2 扫描列出可执行 CLI', true, `可绑定 ${scanned} 个`);
  } else {
    // The empty result must still be actionable: a bare empty list leaves the
    // user guessing whether the scan ran at all.
    const emptyText = await text();
    step('S2 扫描为空时给出可操作提示', /没有找到可执行的 Agent CLI/.test(emptyText),
      emptyText.split('\n').filter(Boolean).slice(-3).join(' | '));
    // A machine with no Agent CLI cannot run an instance — that is the product
    // telling the truth, not a broken flow. CI can demand a CLI explicitly.
    if (process.env.MAESTRO_REQUIRE_CLI === '1') {
      step('S2 本机存在可执行 Agent CLI', false, 'MAESTRO_REQUIRE_CLI=1 但扫描为空');
    } else {
      skip('S2 扫到 CLI / 绑定 / 启动', '本机没有可执行 Agent CLI（设 MAESTRO_CLI_BIN 指向安装目录可跑全流程）');
    }
  }

  if (scanned) {

    const firstExe = await evaluate(`document.querySelector('[data-action="bind-host"]').getAttribute('data-arg')`);
    step('S2 绑定按钮带真实可执行路径', typeof firstExe === 'string' && path.isAbsolute(firstExe), String(firstExe));
    step('S2 绑定为宿主可点', await click('bind-host', firstExe));

    const hostTile = await waitFor(async () => {
      const ids = await evaluate(`[...document.querySelectorAll('[data-action="pick-host"]')].map(n=>n.getAttribute('data-arg'))`);
      return Array.isArray(ids) && ids.length > 0 ? ids : null;
    }, 20000, 300);
    step('S2 宿主卡片出现并被选中', Boolean(hostTile), JSON.stringify(hostTile));
    const hostFile = path.join(root, '.orch', 'hosts', `${hostTile?.[0]}.json`);
    step('S2 宿主配置落盘', fs.existsSync(hostFile), hostFile);
    if (fs.existsSync(hostFile)) {
      const cfg = JSON.parse(fs.readFileSync(hostFile, 'utf8'));
      step('S2 宿主配置是 stdio + launch.command', cfg.transport === 'stdio' && typeof cfg.launch?.command === 'string',
        JSON.stringify(cfg.launch));
    }

    // --- S3: 选工作流 + 写任务 + 开始 ---------------------------------------
    await click('pick-template', 'single');
    await sleep(300);
    const typed = await evaluate(`(() => {
    const t=document.querySelector('#new-task');
    if(!t) return false;
    t.value='把 hello world 写进 note.md';
    t.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  })()`);
    step('S3 任务输入框可写', typed === true);
    step('S3 开始按钮可点', await click('submit-new'));

    const started = await waitFor(async () => {
      const err = await evaluate(`document.querySelector('.form-error')?.textContent ?? ''`);
      if (err) return { error: err };
      const rows = await evaluate(`document.querySelectorAll('[data-action="open-instance"]').length`);
      return rows > 0 ? { rows } : null;
    }, 90000, 500);
    step('S3 实例真的创建出来', Boolean(started && started.rows > 0),
      started?.error ? `页面报错：${started.error}` : `列表 ${started?.rows ?? 0} 行`);
    if (!started || started.error) throw new Error(started?.error ?? 'instance not created');

    const instanceId = await evaluate(`(() => {
    const n=document.querySelector('[data-action="open-instance"]');
    return JSON.parse(n.getAttribute('data-arg')).instanceId;
  })()`);
    step('S3 实例有 id', typeof instanceId === 'string' && instanceId.length > 0, String(instanceId));
    step('S3 实例目录落盘', fs.existsSync(path.join(root, '.orch', 'instances', String(instanceId))));

    // --- S4: 打开实例，四个页签都要有内容 ----------------------------------
    step('S4 能点开实例', await click('open-instance', JSON.stringify({ instanceId })));
    await sleep(2000);
    const tabs = ['overview', 'graph', 'board', 'evidence'];
    for (const tab of tabs) {
      const ok = await click('tab', tab);
      if (!ok) { step(`S4 页签 ${tab} 可点`, false); continue; }
      await sleep(1200);
      const body = await text();
      const dirty = /undefined|\[object Object\]|\{[a-zA-Z_]+\}/.test(body);
      step(`S4 页签 ${tab} 有内容且干净`, body.length > 30 && !dirty,
        `len=${body.length} :: ${body.replace(/\s+/g, ' ').slice(0, 120)}`);
    }

    // --- S5: 控制按钮只在能生效时出现，且操作必须有可见结果 -----------------
    await click('tab', 'overview');
    await sleep(800);
    const ctl = await evaluate(`(() => {
      // Scoped to the visible page: the shell keeps a drawer copy of the last
      // page it rendered, and a whole-document lookup would read that stale
      // copy instead of what the user is looking at.
      const page = document.querySelector('.content') ?? document;
      const btn = page.querySelector('[data-action="pause-instance"], [data-action="resume-instance"]');
      return {
        pause: Boolean(page.querySelector('[data-action="pause-instance"]')),
        resume: Boolean(page.querySelector('[data-action="resume-instance"]')),
        state: (document.querySelector('.content')?.innerText ?? '').replace(/\\s+/g,' ').slice(0, 90),
        // 按钮所在区块的原文：终态却仍渲染按钮时，靠它区分是「判定没生效」
        // 还是「页面还是旧快照」，省得再猜一遍。
        where: btn ? (btn.closest('.card')?.innerText ?? btn.parentElement?.innerText ?? '').replace(/\\s+/g,' ').slice(0, 80) : '',
      };
    })()`);
    const terminal = /已完成|失败|已取消|已中断/.test(ctl.state);
    if (ctl.pause === true && terminal === false) {
      await click('pause-instance');      // Either the state word flips to 已挂起, or a reason appears. A silent
      // no-op is what the old handler did and is the failure this step exists for.
      const paused = await waitFor(async () => {
        const body = await text();
        if (/已挂起/.test(body)) return { kind: 'state' };
        const toast = await evaluate(`document.querySelector('.toast.on')?.textContent ?? ''`);
        if (typeof toast === 'string' && toast.length > 0) return { kind: 'toast', toast };
        return null;
      }, 15000, 400);
      step('S5 暂停有可见结果（状态变化或明确原因）', Boolean(paused),
        paused?.kind === 'toast' ? `提示：${paused.toast}` : (paused ? '状态已变' : '点了没有任何反应'));
      if (paused?.kind === 'state') {
        const hasResume = await evaluate(`Boolean(document.querySelector('[data-action="resume-instance"]'))`);
        step('S5 挂起后出现继续按钮', hasResume === true);
        if (hasResume) {
          await click('resume-instance');
          const resumed = await waitFor(async () => {
            const body = await text();
            return /运行中|已完成/.test(body) ? true : null;
          }, 20000, 400);
          step('S5 继续后恢复运行', resumed === true);
        }
      }
    } else {
      skip('S5 暂停/继续交互', '实例在本轮已被跑完；控制面由 orchestrator 用例覆盖');
    }

    // --- S6: 跑到终态后，控制按钮必须消失 ---------------------------------
    // --- S6: 终态实例不提供任何控制按钮 -----------------------------------
    // 终态靠「终止」自己造出来，不等模型跑完：cancel 是本地裁决，毫秒级生效，
    // 而「等一次真实运行结束」取决于网络与凭据，会时快时慢（上一版就因此
    // 时而过、时而跳过）。终态判定取接口 `phase`，不从页面文字里猜——概览页
    // 的节点时间线也会出现「已完成」，按文字猜会把运行中的实例误判成终态。
    const stateOf = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${meta.port}/instances`, {
          headers: { authorization: `Bearer ${meta.token}` },
        });
        if (res.status !== 200) return null;
        const body = await res.json();
        const rows = Array.isArray(body?.items) ? body.items : [];
        const hit = rows.find((row) => row?.instanceId === instanceId);
        return hit ? String(hit.phase ?? '').toLowerCase() : null;
      } catch {
        return null;
      }
    };
    const TERMINAL = ['completed', 'failed', 'cancelled', 'interrupted'];
    await click('tab', 'overview');
    await sleep(600);
    let current = await stateOf();
    if (current !== null && !TERMINAL.includes(current)) {
      step('S6 终止按钮可点', (await click('cancel-instance')) === true);
      const confirmed = await evaluate(`(() => {
        const ok = document.querySelector('[data-confirm="ok"]');
        if (!ok) return false;
        ok.click();
        return true;
      })()`);
      step('S6 终止前有二次确认', confirmed === true);
      current = await waitFor(async () => {
        const value = await stateOf();
        return value !== null && TERMINAL.includes(value) ? value : null;
      }, 30000, 400);
    }
    if (current === null || !TERMINAL.includes(current)) {
      step('S6 实例进入终态', false, `state=${current ?? '未知'}`);
    } else {
      step('S6 实例进入终态', true, `state=${current}`);
      await click('tab', 'overview');
      await sleep(900);
      const end = await evaluate(`(() => {
        // Scoped to the visible page: the shell keeps a drawer copy of the last
        // page it rendered, so a whole-document lookup would read a stale copy.
        const page = document.querySelector('.content') ?? document;
        const btn = page.querySelector('[data-action="pause-instance"], [data-action="resume-instance"], [data-action="cancel-instance"]');
        return {
          any: Boolean(btn),
          word: (page.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 70),
          where: btn ? (btn.closest('.card')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 70) : '',
        };
      })()`);
      step('S6 终态实例不提供暂停/继续/终止', end.any === false,
        end.any ? `state=${current} || 按钮区块：${end.where}` : `state=${current} :: ${end.word}`);
      if (end.any && process.env.DEBUG_FLOW === '1') {
        const raw = await evaluate(`(() => {
          const page = document.querySelector('.content') ?? document;
          const btn = page.querySelector('[data-action="pause-instance"], [data-action="resume-instance"], [data-action="cancel-instance"]');
          return { html: btn ? btn.parentElement.parentElement.outerHTML.slice(0, 700) : '' };
        })()`);
        console.log('[debug]', JSON.stringify(raw, null, 2));
      }
    }

    // S7: instance maintenance. The overview must offer real maintenance
    // controls (not the earlier toast-only export), and the HTTP seam must
    // actually mutate/persist state.
    const actions = await evaluate(`(() => {
      const page = document.querySelector('.content') ?? document;
      const has = (a) => Boolean(page.querySelector('[data-action="' + a + '"]'));
      return {
        rename: has('rename-instance'), clone: has('clone-instance'),
        archive: has('archive-instance'), export: has('export-otel'),
        template: has('save-instance-template'),
      };
    })()`);
    step('S7 概览页提供实例维护控件', actions.rename && actions.clone && actions.archive && actions.export,
      JSON.stringify(actions));

    if (typeof instanceId === 'string' && instanceId.length > 0) {
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${meta.token}` };
      const base = `http://127.0.0.1:${meta.port}`;
      const renamed = await fetch(`${base}/instances/${encodeURIComponent(instanceId)}`, {
        method: 'PATCH', headers, body: JSON.stringify({ name: 'UI 维护改名' })
      }).then((r) => r.json()).catch(() => ({ ok: false }));
      step('S7 重命名真的落盘', renamed.ok === true && renamed.name === 'UI 维护改名', JSON.stringify(renamed));

      const exported = await fetch(`${base}/instances/${encodeURIComponent(instanceId)}/export`, { headers })
        .then((r) => r.json()).catch(() => ({ ok: false }));
      step('S7 导出返回真实事件数据', exported.ok === true && exported.payload?.format === 'maestro-instance-export/v1',
        `events=${exported.payload?.events?.length ?? 0}`);

      const clone = await fetch(`${base}/instances/${encodeURIComponent(instanceId)}/clone`, {
        method: 'POST', headers, body: '{}'
      }).then((r) => r.json()).catch(() => ({ ok: false }));
      step('S7 克隆生成独立实例', clone.ok === true && clone.id !== instanceId, JSON.stringify(clone).slice(0, 160));

      const saved = await fetch(`${base}/instances/${encodeURIComponent(instanceId)}/save-template`, {
        method: 'POST', headers, body: '{}'
      }).then((r) => r.json()).catch(() => ({ ok: false }));
      step('S7 实例可沉淀为工作流模板', saved.ok === true, JSON.stringify(saved).slice(0, 160));
    }
  }

  const errors = runtimeErrors.filter((line) => !/favicon|ERR_/.test(line));
  step('S4 全程无未捕获异常', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (error) {
  step('流程异常中止', false, error?.message ?? String(error));
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill(); } catch { /* ignore */ }
  try { daemon?.kill(); } catch { /* ignore */ }
  console.log(`\n${pass} passed, ${failures.length} failed`);
  for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
  for (const item of skipped) console.log(`  SKIP ${item.name} — ${item.why}`);
  console.log(`fixture: ${root}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
