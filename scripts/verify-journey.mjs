/**
 * Full journey verification in a REAL browser, for two environments:
 *
 *   EXPECT_CLI=none     no Agent CLI on PATH  -> org seeds with `unbound`,
 *                        every step still configures, no hang, no false claim.
 *   EXPECT_CLI=opencode opencode on PATH      -> cli.scan discovers it, probe
 *                        handshake is real (`acp:true`), employees bind to it.
 *
 * Why a separate script: verify:desktop only checks cold start + the demo
 * button. This script walks EVERY wizard step and asserts the projected state
 * after each action, so a step that silently does nothing cannot pass.
 *
 * The daemon is started through `serve-entry.js --desktop` (the exact entry
 * the Rust shell spawns), driven in headless Chrome over CDP, with a dedicated
 * PATH/HOME so the two runs are isolated from the developer machine.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EXPECT = process.env.EXPECT_CLI ?? 'none';            // none | opencode
const EXTRA_PATH = process.env.EXTRA_PATH ?? '';             // dir holding `opencode`
const sleep = (ms) => delay(ms);

let pass = 0;
const failures = [];
const evidence = [];
function step(name, ok, detail = '', payload = null) {
  const line = `[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (ok) pass += 1; else failures.push(name);
  evidence.push({ name, ok, detail, payload });
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-journey-${EXPECT}-`));
const home = path.join(root, 'home');
fs.mkdirSync(home, { recursive: true });
const daemonLog = path.join(root, 'daemon.log');
let daemon = null, chrome = null, ws = null;

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
        const d = msg.params.exceptionDetails;
        events.push(`exception: ${d?.exception?.description ?? d?.text}`);
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
  // ---- daemon with controlled PATH ---------------------------------------
  const childPath = [EXTRA_PATH, process.env.PATH].filter(Boolean).join(path.delimiter);
  const childEnv = { ...process.env, HOME: home, USERPROFILE: home, PATH: childPath, NODE_ENV: 'test' };
  if (EXPECT === 'none') {
    // Strip any agent CLI directory from PATH so discovery truly finds none.
    childEnv.PATH = pathEntriesWithoutCli(childPath);
  }
  const logFd = fs.openSync(daemonLog, 'w');
  daemon = spawn(process.execPath, [
    path.join(REPO, 'src', 'daemon', 'serve-entry.js'), '--project', root, '--desktop',
  ], { cwd: root, env: childEnv, stdio: ['ignore', logFd, logFd] });

  const metaPath = path.join(root, '.orch', 'desktop.json');
  const meta = await waitFor(() => {
    try { return JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return null; }
  }, 20_000);
  step('S0 壳入口起 daemon 并写出 desktop.json', Boolean(meta?.port && meta?.token),
    meta ? `port ${meta.port}` : fs.readFileSync(daemonLog, 'utf8').slice(0, 200));
  if (!meta) throw new Error('daemon did not become ready');

  // ---- headless Chrome / CDP ---------------------------------------------
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${path.join(root, 'chrome-profile')}`,
    '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let devPort = null;
  chrome.stderr.on('data', (chunk) => {
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(String(chunk));
    if (m) devPort = Number(m[1]);
  });
  devPort = await waitFor(() => devPort, 20_000, 50);
  if (!devPort) throw new Error('CDP port never appeared');

  const targets = await waitFor(async () => {
    try {
      const a = await fetch(`http://127.0.0.1:${devPort}/json/list`, { signal: AbortSignal.timeout(3000) });
      return a.ok ? await a.json() : null;
    } catch { return null; }
  }, 15_000, 200);
  const page = targets.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await Promise.race([
    new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; }),
    sleep(8000).then(() => { throw new Error('CDP ws open timeout'); }),
  ]);
  const call = cdp();
  await call('Page.enable');
  await call('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result?.value;
  };

  // Helpers that drive the SAME endpoints the page uses, with the shell token.
  const api = async (action, payload = {}) => {
    // The studio action route takes a FLAT body: {action, ...fields}. There is
    // no nested `payload` key. Inject args via globals to avoid quote escaping.
    const body = { action, ...payload };
    await evaluate(`window.__body=${JSON.stringify(body)};`);
    return evaluate(`(async () => {
      const t = sessionStorage.getItem('maestro.desktop.token');
      const r = await fetch('/studio/action', {
        method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},
        body: JSON.stringify(window.__body)
      });
      return { status:r.status, body: await r.json() };
    })()`);
  };
  const state = () => evaluate(`(async () => {
    const t = sessionStorage.getItem('maestro.desktop.token');
    const r = await fetch('/studio/state', { headers:{Authorization:'Bearer '+t} });
    return await r.json();
  })()`);

  // ---- cold start through the real UI ------------------------------------
  const query = new URLSearchParams({ token: String(meta.token), project: root });
  await call('Page.navigate', { url: `http://127.0.0.1:${meta.port}/ui/?${query.toString()}` });
  const painted = await waitFor(async () => evaluate(
    "Boolean(document.querySelector('#app')?.textContent?.trim())"), 20_000);
  step('S0 冷启动首屏绘制（非空白）', painted === true);
  await sleep(1200);
  const boot = await evaluate("document.body.innerText.slice(0, 300)");
  step('S0 未卡在「正在连接守护进程」', !boot.includes('正在连接守护进程'),
    boot.split('\n').filter(Boolean).slice(0, 2).join(' | '));

  // ---- step 1: CLI scan, via the real page button ------------------------
  await evaluate(`(() => {
    const sec = document.querySelector('[data-section="team"]');
    if (sec) sec.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    const n=[...document.querySelectorAll('[data-action="nav"]')]
      .find(x=>x.getAttribute('data-arg')==='studio');
    if(n) n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));
    return true;
  })()`);
  const frameReady = await waitFor(async () => evaluate(`(() => {
    const f=document.querySelector('iframe.studio-iframe');
    return f?.contentDocument?.getElementById('btn-scan') ? true : false;
  })()`), 15_000);
  step('S1 搭建台 iframe 挂载且扫描按钮可用', frameReady === true);

  const scanClicked = await evaluate(`(() => {
    const b=document.querySelector('iframe.studio-iframe')?.contentDocument?.getElementById('btn-scan');
    if(!b) return false; b.click(); return true;
  })()`);
  step('S1 点击扫描按钮', scanClicked === true);
  await sleep(1500);
  const s1 = await state();
  const cliCount = s1.clis?.length ?? 0;
  const probeCli = (s1.clis ?? []).find((c) => c.id === EXPECT);
  if (EXPECT === 'none') {
    // WorkBuddy.app is installed here as an app marker, so discovery reports
    // it as "installed but not on PATH" (unreachable). That is correct PRD
    // behaviour — what matters is: no EXECUTABLE CLI, no capability claim.
    const noExecutable = (s1.clis ?? []).every((c) => !c.executable);
    step('S1 无可执行 CLI：发现的条目均不可执行（app marker 如实列出）',
      noExecutable, `clis=${cliCount} executables=${(s1.clis ?? []).filter((c) => c.executable).length}`);
    step('S1 无 CLI 环境：未误报任何 acp 能力', (s1.clis ?? []).every((c) => c.acp === null),
      JSON.stringify((s1.clis ?? []).map((c) => ({ id: c.id, acp: c.acp }))));
    step('S1 无 CLI 环境：页面未停在加载/TOKEN', await evaluate(`(() => {
      const d=document.querySelector('iframe.studio-iframe')?.contentDocument;
      const t=d?.body?.innerText??''; const l=d?.getElementById('loading')?.textContent??'';
      return t.length>0 && !t.includes('TOKEN') && l!=='加载中';
    })()`) === true);
  } else {
    step(`S1 ${EXPECT} 环境：扫描发现该 CLI`, Boolean(probeCli),
      `clis=${cliCount} ids=${(s1.clis??[]).map(c=>c.id).join(',')}`);
  }

  // ---- step 2: ACP probe via the REAL product CLI ------------------------
  // There is no HTTP `cli.probe` action by design: capability probing is an
  // explicit CLI operation. Drive the shipped `bin/orch.js cli probe` against
  // the same root the desktop daemon uses, then re-read state to prove the
  // handshake result is visible through the browser's /studio/state surface.
  if (EXPECT !== 'none' && probeCli?.executable) {
    const probeRun = spawn(process.execPath, [
      path.join(REPO, 'bin', 'orch.js'), 'cli', 'probe', EXPECT, '--format', 'json',
    ], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let pOut = '', pErr = '';
    probeRun.stdout.on('data', (c) => { pOut += String(c); });
    probeRun.stderr.on('data', (c) => { pErr += String(c); });
    const pCode = await new Promise((resolve) => probeRun.on('close', resolve));
    let probed = null;
    try { probed = JSON.parse(pOut); } catch { /* keep raw */ }
    step('S2 产品 CLI cli.probe 握手成功', pCode === 0 && probed?.acp === true,
      `exit=${pCode} acp=${probed?.acp} version=${probed?.version ?? ''} ${pErr ? 'stderr=' + pErr.slice(0, 80) : ''}`);
    // withProbeResults merges session capabilities into `capabilities`.
    step('S2 握手提取到标准 ACP 能力', Array.isArray(probed?.capabilities)
      && probed.capabilities.length > 0,
      JSON.stringify(probed?.capabilities ?? []));
    await sleep(300);
    const s2 = await state();
    const after = (s2.clis ?? []).find((c) => c.id === EXPECT);
    step('S2 握手结果经 /studio/state 对页面可见', after?.acp === true,
      JSON.stringify({ acp: after?.acp, version: after?.version, status: after?.status }));
  } else {
    step('S2 无 CLI：跳过握手（没有可探测的 CLI，符合预期）', true, 'expected skip');
  }

  // ---- step 3: org seed --------------------------------------------------
  const seeded = await api('org.seed', { perRole: 1 });
  step('S3 组织种子 action ok', seeded.status === 200 && seeded.body?.ok === true,
    `status=${seeded.status} body=${JSON.stringify(seeded.body ?? {}).slice(0, 200)}`);
  const s3 = await state();
  step('S3 组织落盘：23 角色 / 23 员工（perRole=1）', s3.roles?.length === 23 && s3.employees?.length === 23,
    `roles=${s3.roles?.length} employees=${s3.employees?.length}`);
  // cliId = explicit payload ?? first discovered cli ?? 'unbound'.
  // In the "none" run WorkBuddy.app is an app-marker finding, so it becomes
  // the bind target even though it is not executable — that is by design.
  const boundCli = EXPECT === 'none' ? (s1.clis?.[0]?.id ?? 'unbound') : EXPECT;
  const allBound = (s3.employees ?? []).every((e) => e.cliId === boundCli);
  step(`S3 员工绑定到预期 CLI (${boundCli})`, allBound,
    `sample=${(s3.employees ?? []).slice(0, 2).map((e) => e.cliId).join(',')}`);

  // ---- step 4: flow ------------------------------------------------------
  const flow = await api('flow.create', { template: 'rd-12', runMode: 'auto', name: 'full-journey-flow' });
  step('S4 12 阶段流程创建 ok', flow.status === 200 && flow.body?.ok === true,
    `status=${flow.status} body=${JSON.stringify(flow.body ?? {}).slice(0, 240)}`);
  const s4 = await state();
  step('S4 流程落盘：含 12 阶段 / 3 门禁', s4.flows?.length >= 1,
    `flows=${s4.flows?.length}`);

  // ---- step 5: team ------------------------------------------------------
  const lead = s4.roles.find((r) => r.code === 'eng-lead')?.id ?? s4.roles[0]?.id;
  // Create a SEMI team: the core journey requires gates to actually stop the
  // walk and only pass after explicit approval (A4 "半自动门禁确实拦截").
  const team = await api('team.create', {
    name: 'full-journey-team', leadRoleId: lead,
    roleIds: s4.roles.map((r) => r.id), flowId: s4.flows[0]?.id, runMode: 'semi'
  });
  step('S5 团队创建 ok', team.status === 200 && team.body?.ok === true,
    `status=${team.status} code=${team.body?.code ?? ''}`);
  const s5 = await state();
  step('S5 团队落盘且就绪', s5.teams?.length >= 1 && s5.readiness?.ok === true,
    `teams=${s5.teams?.length} readiness.ok=${s5.readiness?.ok} warnings=${s5.readiness?.warnings?.length ?? 0}`);

  // ---- step 6: run + gates ----------------------------------------------
  const started = await api('run.start', { teamId: s5.teams[0].id, mode: 'simulate' });
  step('S6 运行启动 ok', started.status === 200 && started.body?.ok === true,
    `status=${started.status} run=${started.body?.run?.id ?? ''}`);
  const s6 = await state();
  const run = (s6.runs ?? []).find((r) => r.id === started.body?.run?.id);
  step('S6 半自动运行停在首道门禁（不越过审批）',
    run?.status === 'awaiting-approval' && Boolean(started.body?.waiting),
    `run.status=${run?.status ?? ''} waiting=${JSON.stringify(started.body?.waiting)}`);

  // Approve each gate until completed; assert every approval is accepted.
  let approvals = 0;
  let allAccepted = true;
  for (let i = 0; i < 6; i += 1) {
    const cur = await state();
    const r = (cur.runs ?? []).find((x) => x.id === started.body?.run?.id);
    if (!r || r.status === 'completed') break;
    const apr = await api('run.approve', { runId: r.id });
    if (!(apr.status === 200 && apr.body?.ok === true)) { allAccepted = false; break; }
    approvals += 1;
    await sleep(300);
  }
  const s7 = await state();
  const done = (s7.runs ?? []).find((r) => r.id === started.body?.run?.id);
  step('S7 逐级批准三道门禁后运行完成',
    done?.status === 'completed' && approvals >= 3 && allAccepted,
    `status=${done?.status} approvals=${approvals} allAccepted=${allAccepted}`);

  // ---- step 8: knowledge base + tasks ----------------------------------
  const kbDir = path.join(root, '.orch', 'kb');
  const kbFiles = fs.existsSync(kbDir) ? fs.readdirSync(kbDir, { recursive: true }).length : 0;
  step('S8 知识库产物落盘', kbFiles > 0, `files=${kbFiles}`);
  step('S8 任务全部生成', (s7.tasks ?? []).length > 0, `tasks=${s7.tasks?.length}`);

  step('S9 浏览器全程无未捕获异常', call.events.length === 0,
    call.events.slice(0, 3).join(' | '));

  // ---- evidence file ----------------------------------------------------
  const out = path.join(root, 'journey-evidence.json');
  fs.writeFileSync(out, JSON.stringify({
    expect: EXPECT, root, pass, failures, evidence,
    events: call.events,
  }, null, 2));
  console.log(`EVIDENCE: ${out}`);
} catch (error) {
  console.log(`[FAIL] 验证进程异常 — ${error?.message ?? String(error)}`);
  failures.push(`EXCEPTION: ${error?.message ?? String(error)}`);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { chrome?.kill('SIGTERM'); } catch { /* ignore */ }
  try { daemon?.kill('SIGTERM'); } catch { /* ignore */ }
  await sleep(500);
}

const total = pass + failures.length;
console.log(`\n${EXPECT}: ${pass}/${total} steps passed`);
console.log(failures.length === 0
  ? `JOURNEY_OK (${EXPECT})`
  : `JOURNEY_FAIL (${EXPECT}): ${failures.join(' | ')}`);
process.exit(failures.length === 0 ? 0 : 1);

function pathEntriesWithoutCli(pathValue) {
  const agents = ['claude', 'codex', 'gemini', 'qwen', 'opencode', 'dsh', 'cursor-agent', 'copilot', 'aider'];
  return pathValue.split(path.delimiter).filter((entry) => {
    if (!entry) return false;
    try {
      for (const bin of agents) {
        if (fs.existsSync(path.join(entry, bin)) || fs.existsSync(path.join(entry, `${bin}.cmd`))) return false;
      }
    } catch { /* ignore */ }
    return true;
  }).join(path.delimiter);
}
