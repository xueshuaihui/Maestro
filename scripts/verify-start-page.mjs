/**
 * Start page verification (P0: environment step -> project list).
 *
 * The page runs inside the Tauri webview, which exposes no CDP endpoint, so the
 * shell boundary is faked instead: every `invoke` is recorded and answered from
 * a fixture. That is enough to prove the behaviour the user asked for —
 * opening the app scans the machine first, the scan result is rendered as three
 * honest groups, and the project list only appears after that.
 *
 * What this does NOT cover (by design): the Rust side of the scan. That is
 * `verify-shell-boot.mjs`, which launches the real .app and asserts the
 * `env-scan` probe line.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const REPO = path.resolve(import.meta.dirname, '..');
const PAGE = path.join(REPO, 'desktop', 'shell-ui', 'index.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => delay(ms);

let failures = 0;
function step(name, ok, detail = '') {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function waitFor(predicate, timeoutMs, intervalMs = 100) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await predicate();
    if (value) return value;
    await sleep(intervalMs);
  }
  return null;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-startpage-'));
let chrome = null;
let ws = null;

const INFO = {
  project: null,
  invalid: null,
  invalidMessage: null,
  missing: '项目 未指定 · 请填写项目目录',
  connecting: '正在连接守护进程…',
  failed: '连接守护进程失败',
  hint: '一个目录就是一个项目：团队、工作流和运行记录都存在其中',
  pathLabel: '项目目录',
  open: '打开项目',
  browse: '选择文件夹…',
  retry: '重试',
  recentLabel: '最近打开',
  recent: ['/tmp/demo-project'],
  knownRoots: ['/tmp/demo-project'],
  env: {
    title: 'Agent CLI',
    scanning: '正在扫描本机 Agent CLI…',
    summary: '{ready} 个可用 · {partial} 个有痕迹 · {total} 个已知',
    groupReady: '可用',
    groupPartial: '已安装但不可用',
    groupMissing: '未安装',
    reasonNotOnPath: '不在 PATH 上，应用包里也没有找到可执行文件',
    reasonNoExec: '只找到配置痕迹，没有可执行文件',
    bind: '指定路径',
    bindOther: '添加其他 CLI',
    bindHint: '知道它在哪？粘贴路径或选择文件，我会记住——不修改你的系统',
    nameLabel: '名称',
    pathLabel: '可执行文件路径',
    pickFile: '选择文件…',
    save: '保存',
    cancel: '取消',
    rescan: '重新扫描',
    continue: '继续',
    why: 'Maestro 的员工绑定具体 CLI：没有可用的 CLI，团队里就没有能干活的人。',
    noneReady: '还没有可用的 CLI。可以先继续，之后在设置里补。',
    pickTitle: '选择 Agent CLI 可执行文件',
    scanFailed: '扫描失败',
    saved: '已登记 {name}',
    back: '上一步'
  },
  projects: {
    title: '选择项目',
    hint: '团队、工作流和运行记录都存在项目目录里，一个目录就是一个项目。',
    open: '打开其他目录…',
    remove: '从列表移除',
    empty: '还没有打开过项目。选一个目录开始。',
    last: '最近打开'
  }
};

const REGISTRY = {
  schemaVersion: 1,
  scanned_at: '2026-11-26T14:00:00.000Z',
  user_config: [],
  clis: [
    {
      cli_id: 'opencode',
      name: 'OpenCode',
      executable: '/opt/homebrew/bin/opencode',
      version: '1.19.6',
      not_on_path: false,
      bundled: false,
      evidence: [{ type: 'path', value: '/opt/homebrew/bin/opencode' }]
    },
    {
      cli_id: 'copilot',
      name: 'GitHub Copilot CLI',
      executable: null,
      not_on_path: true,
      bundled: false,
      evidence: [{ type: 'home', value: '/Users/demo/.copilot' }]
    }
  ],
  known: [
    { cli_id: 'opencode', name: 'OpenCode', bin: ['opencode'], homeDirs: ['.opencode'], appNames: [] },
    { cli_id: 'copilot', name: 'GitHub Copilot CLI', bin: ['copilot'], homeDirs: ['.copilot'], appNames: [] },
    { cli_id: 'dsh', name: 'DeepSeek Harness', bin: ['dsh'], homeDirs: ['.dsh'], appNames: ['DeepSeek Harness.app'] }
  ]
};

const FAKE = `
  window.__TAURI_INTERNALS__ = {
    calls: [],
    invoke: async (cmd, args) => {
      window.__TAURI_INTERNALS__.calls.push({ cmd, args: args ?? null });
      switch (cmd) {
        case 'startup_info': return ${JSON.stringify(INFO)};
        case 'env_scan': return { ok: true, registry: ${JSON.stringify(REGISTRY)} };
        case 'env_add_cli': return { ok: true, message: '已添加 fake  /tmp/fake-cli' };
        case 'open_project': return { ok: true, daemonPid: 4242 };
        case 'startup_status': return { ready: true };
        case 'pick_project': return null;
        case 'pick_file': return '/tmp/fake-cli';
        case 'forget_project': return null;
        default: return null;
      }
    }
  };
`;

try {
  if (!fs.existsSync(PAGE)) throw new Error(`missing page: ${PAGE}`);

  chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files',
    `--user-data-dir=${path.join(root, 'chrome-profile')}`, '--remote-debugging-port=0', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let devPort = null;
  chrome.stderr.on('data', (chunk) => {
    const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(String(chunk));
    if (match) devPort = Number(match[1]);
  });
  devPort = await waitFor(() => devPort, 20000, 50);
  if (!devPort) throw new Error('CDP port missing');

  const targets = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${devPort}/json/list`);
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }, 15000, 200);
  ws = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails?.exception?.description
        ?? msg.params.exceptionDetails?.text ?? 'unknown');
      return;
    }
    if (msg.id === undefined) return;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: FAKE });
  await call('Page.navigate', { url: `file://${PAGE}` });

  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result?.value;
  };

  const loaded = await waitFor(() => evaluate('document.readyState === "complete" && Boolean(document.getElementById("env-step"))'), 15000);
  step('启动页加载', loaded === true);

  // Opening the app scans first: no click, no navigation.
  const scanned = await waitFor(async () => (await evaluate(
    'window.__TAURI_INTERNALS__.calls.filter((c) => c.cmd === "env_scan").length'
  )) > 0, 10000);
  step('打开即自动扫描（无需点击）', scanned === true);

  const groups = await waitFor(() => evaluate(`(() => {
    const ready = document.querySelectorAll('#env-groups .cli-row.ready').length;
    const partial = document.querySelectorAll('#env-groups .cli-row.partial').length;
    const missing = document.querySelectorAll('#env-missing .cli-row.missing').length;
    const summary = document.getElementById('env-summary').textContent;
    return { ready, partial, missing, summary };
  })()`), 10000);
  step('扫描结果分三组呈现（可用 / 有痕迹 / 未安装）',
    groups?.ready === 1 && groups?.partial === 1 && groups?.missing === 1,
    JSON.stringify(groups));

  const projectHidden = await evaluate('document.getElementById("project-step").hidden');
  step('扫描阶段不提前露出项目列表', projectHidden === true);

  await evaluate('document.getElementById("env-continue").click()');
  const projectShown = await waitFor(() => evaluate(`(() => {
    const step = document.getElementById('project-step');
    return {
      hidden: step.hidden,
      cards: document.querySelectorAll('#recent-list li').length
    };
  })()`), 5000);
  step('继续后进入项目列表', projectShown?.hidden === false && projectShown?.cards === 1,
    JSON.stringify(projectShown));

  // Picking a project must call the shell with that root; a silent no-op here
  // was the reported "switch project does nothing".
  await evaluate('document.querySelector("#recent-list .pick").click()');
  const opened = await waitFor(async () => (await evaluate(
    'JSON.stringify(window.__TAURI_INTERNALS__.calls.filter((c) => c.cmd === "open_project"))'
  )), 8000);
  const openCalls = JSON.parse(opened ?? '[]');
  step('点项目卡片触发绑定并带上 root',
    openCalls.length === 1 && openCalls[0]?.args?.root === '/tmp/demo-project',
    opened ?? '');

  step('页面无未捕获异常', exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
} catch (err) {
  step('脚本执行', false, String(err?.stack ?? err).slice(0, 400));
} finally {
  if (ws) ws.close();
  if (chrome) chrome.kill();
}

console.log('');
if (failures === 0) console.log('START_PAGE_OK');
else {
  console.log(`start page: ${failures} check(s) failed`);
  process.exitCode = 1;
}
