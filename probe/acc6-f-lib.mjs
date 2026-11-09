// I1.6 验收脚手架 —— 常量与底层工具（只读产品：不改 src/**、test/**、assets/**）。
// 纪律：每个 AC 一个独立项目根 %TEMP%/maestro-acc-p6/<AC>；原始输出一律落盘到 evidence/。
// 与 I1.5 的 acc5-f-lib.mjs 同形，但**不共用**任何常量（路径、批次映射各自独立）。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const CODE_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
export const TASK_DRIVER = path.join(REPO, 'test', 'fixtures', 'task-loop-driver.mjs');
export const SEAM = path.join(REPO, 'test', 'fixtures', 'call-seam.mjs');
export const PURITY = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');

export const ITERATION_DIR = path.join(REPO, 'docs', 'iterations', 'iteration-6');
export const REQUIREMENT = path.join(ITERATION_DIR, 'requirement.md');
export const REPORT = path.join(ITERATION_DIR, 'acceptance-fixture.md');
export const EVID = path.join(ITERATION_DIR, 'evidence');

export const BASE = path.join(os.tmpdir(), 'maestro-acc-p6');
export const PARTS = path.join(REPO, 'probe', 'acc6-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'acc6-f-results.jsonl');
export const SUMMARY = path.join(REPO, 'probe', 'acc6-f-summary.json');
export const BLOCKERS = path.join(REPO, 'probe', 'acc6-f-blockers.md');
export const CASES_DIR = path.join(REPO, 'probe', 'acc6-cases');

/**
 * 回归基线提交：AC-49（批次 c）三条主链逐字回归的对照基线 = `0cd113b`
 * （I1.5 收口提交，requirement.md AC-49 Then / 附录 D-10 逐字点名）。
 * 当前工作树 HEAD 是 `baf975e`（S2 收口），两者不同属正常：AC-49 比的是输出文本，
 * 不是源码 diff。
 */
export const BASELINE_COMMIT = '0cd113b';

/** 全量测试下限（AC-50 机检：fail===0 && pass===tests && tests>=611）。 */
export const TEST_MIN = 611;

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 每个 AC 一个干净根；名字直接用 AC 号（或 `<AC>-suffix`），便于 evidence/meta 回溯。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/**
 * 基线环境：强制 NODE_ENV=test（I1.6 全部命令面 AC 也要注入，模板 §3.3），
 * 清掉 ELECTRON_RUN_AS_NODE 与历史批次的 DSH / 注入残留，extra 覆盖在最后。
 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const k of [
    'ELECTRON_RUN_AS_NODE',
    'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'DSH_HOME',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT',
    'MAESTRO_PERMISSION_POLICY'
  ]) delete env[k];
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  env.NODE_ENV = 'test';
  return env;
}

/** 统一命令结果：exitCode / stdout / stderr / durationMs / timedOut。 */
export function runCmd(argv, { cwd = REPO, env = baseEnv(), timeout = 120000, label = null } = {}) {
  const started = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, env, timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM');
  return {
    label,
    argv,
    cwd,
    exitCode: r.status,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    timedOut,
    durationMs: Date.now() - started
  };
}

/** 产品 CLI（在项目根里执行）。 */
export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH, ...args], {
    cwd: root, ...opts, label: opts.label ?? `orch ${args.join(' ')}`
  });
}

/** 用**指定代码树**的 CLI（批次 c 拿 0cd113b 基线树跑同一条命令时用）。 */
export function orchOf(tree, root, args, opts = {}) {
  return runCmd([NODE, path.join(tree, 'bin', 'orch.js'), ...args], {
    cwd: root, ...opts, label: opts.label ?? `orch(${path.basename(tree)}) ${args.join(' ')}`
  });
}

export function codeDriver(root, args, opts = {}) {
  return runCmd([NODE, CODE_DRIVER, '--root', root, ...args], {
    cwd: REPO, ...opts, label: opts.label ?? `code-loop-driver ${args.join(' ')}`
  });
}

export function taskDriver(root, args, opts = {}) {
  return runCmd([NODE, TASK_DRIVER, '--root', root, ...args], {
    cwd: REPO, ...opts, label: opts.label ?? `task-loop-driver ${args.join(' ')}`
  });
}

/** 从**已在跑**的核心调测试接缝（批次 c AC-49 备用）。 */
export function seam(root, args, opts = {}) {
  return runCmd([NODE, SEAM, '--root', root, ...args], {
    cwd: REPO, ...opts, label: opts.label ?? `call-seam ${args.join(' ')}`
  });
}

/** 架构扫描（批次 c AC-51 用；给了 files 就只扫这些文件）。 */
export function purity(opts = {}) {
  const args = [NODE, PURITY];
  if (opts.files) args.push('--files', opts.files);
  if (opts.dirs) args.push('--dirs', opts.dirs);
  if (opts.forbid) args.push('--forbid', opts.forbid);
  if (opts.json) args.push('--json');
  return runCmd(args, { cwd: REPO, label: opts.label ?? 'purity-check' });
}

/** 全量测试入口（Node 22 / Windows 下必须传 glob 字符串，不能传目录）。 */
export function nodeTest(globs = ['test/**/*.test.js'], opts = {}) {
  return runCmd([NODE, '--test', '--test-concurrency=4', ...globs], {
    cwd: REPO, timeout: 900000, ...opts, label: `node --test --test-concurrency=4 ${globs.join(' ')}`
  });
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
export function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}
export function readState(root, id = 'INST-001') {
  return readJson(path.join(root, '.orch', 'instances', id, 'state.json'));
}
export function instanceIds(root) {
  try { return fs.readdirSync(path.join(root, '.orch', 'instances')).sort(); } catch { return []; }
}
export function sha256File(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; }
}
export function fileInfo(file) {
  try {
    const st = fs.statSync(file);
    return { path: file, exists: true, bytes: st.size, mtimeMs: st.mtimeMs, mtimeIso: st.mtime.toISOString(), sha256: sha256File(file) };
  } catch { return { path: file, exists: false, bytes: 0, mtimeMs: null, mtimeIso: null, sha256: null }; }
}

/** 递归列文件（相对 dir，正斜杠），按字典序。 */
export function listFiles(dir, { skip = [] } = {}) {
  const out = [];
  const walk = (abs, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const nextRel = rel ? `${rel}/${e.name}` : e.name;
      if (skip.some((s) => nextRel === s || nextRel.startsWith(`${s}/`))) continue;
      const nextAbs = path.join(abs, e.name);
      if (e.isDirectory()) walk(nextAbs, nextRel);
      else out.push(nextRel);
    }
  };
  walk(dir, '');
  return out;
}

/** 目录快照：`{相对路径: {sha256, bytes, mtimeIso}}`。 */
export function dirSnapshot(dir) {
  const map = {};
  for (const rel of listFiles(dir)) {
    const info = fileInfo(path.join(dir, ...rel.split('/')));
    map[rel] = { sha256: info.sha256, bytes: info.bytes, mtimeIso: info.mtimeIso };
  }
  return map;
}

export async function waitUntil(fn, { timeout = 30000, interval = 100, label = '条件' } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeout) return null;
    await sleep(interval);
  }
}

// ---------------------------------------------------------------- 长驻进程（批次 c AC-49 用）

const LIVE = new Set();

function spawnLong(argv, { env = baseEnv(), timeout = 60000, root = null, cwd = REPO } = {}) {
  const child = spawn(argv[0], argv.slice(1), {
    cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const h = {
    argv, root, child, timeout,
    stdout: '', stderr: '', exited: false, exitCode: null, signal: null,
    startedAt: Date.now()
  };
  LIVE.add(h);
  child.stdout.on('data', (c) => { h.stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => {
    const finish = (code, signal) => {
      h.exited = true; h.exitCode = code; h.signal = signal ?? null;
      LIVE.delete(h); resolve(code);
    };
    child.once('exit', finish);
    child.once('error', () => finish(-1, null));
  });
  h.output = () => `${h.stdout}${h.stderr}`;
  h.waitFile = (name, ms = timeout) => waitUntil(() => exists(path.join(root, '.mock', name)), { timeout: ms, label: name });
  h.waitOutput = (needle, ms = timeout) => waitUntil(
    () => (typeof needle === 'function' ? needle(h.stdout) : h.stdout.includes(needle)),
    { timeout: ms, label: String(needle).slice(0, 40) }
  );
  h.waitState = (pred, ms = timeout) => waitUntil(() => {
    const s = readState(root);
    return s && pred(s) ? s : null;
  }, { timeout: ms, label: 'state' });
  h.release = () => {
    ensureDir(path.join(root, '.mock'));
    fs.writeFileSync(path.join(root, '.mock', 'release'), '', 'utf8');
  };
  h.stop = async () => {
    h.release();
    await forceKillCore(root);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
    await Promise.race([h.done, sleep(5000)]);
  };
  return h;
}

/** 长驻（--keep）夹具驱动：`driver` 选 code-loop / task-loop。 */
export function startDriver(root, args, { env = baseEnv(), timeout = 60000, driver = CODE_DRIVER } = {}) {
  return spawnLong([NODE, driver, '--root', root, ...args], { env, timeout, root });
}

/** 长驻产品 CLI（`orch run`）：在项目根里执行。 */
export function startProduct(root, args, { env = baseEnv(), timeout = 60000 } = {}) {
  return spawnLong([NODE, ORCH, ...args], { env, timeout, root, cwd: root });
}

/** 全量兜底：超时 / 异常时把所有还活着的长驻进程与核心掐掉。 */
export async function killAllDrivers() {
  for (const h of [...LIVE]) {
    try { h.child.kill('SIGKILL'); } catch { /* ignore */ }
    try { await forceKillCore(h.root); } catch { /* ignore */ }
    LIVE.delete(h);
  }
  await sleep(150);
}

/**
 * 清扫「不在 LIVE 表里」的残留：mock 夹具进程与指向 `%TEMP%/maestro-acc-p6` 的核心。
 * 同一个 shell 会话里连跑多批 AC 时，产品侧 spawn 出来的宿主是**孙进程**，会活下来；
 * 残留的 `mock-acp-agent.js` 会让全量套件里的 `wp6/loop-fixture.test.js` 永久等待
 * （I1.5 验收期实测踩过）。只杀命令行含 `mock-acp-agent` 或本次验收临时根的两类进程。
 */
export async function sweepStrays() {
  if (process.platform !== 'win32') return 0;
  const script = [
    "$targets = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |",
    "  Where-Object { $_.ProcessId -ne $PID -and",
    "    ($_.CommandLine -match 'mock-acp-agent' -or $_.CommandLine -match 'maestro-acc-p6') }",
    "foreach ($t in $targets) {",
    "  if ($t.ProcessId -ne " + process.pid + ") {",
    "    Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue",
    "    Write-Output $t.ProcessId",
    "  }",
    "}"
  ].join('\n');
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore']
    });
    const killed = out.split('\n').map((s) => s.trim()).filter(Boolean).length;
    if (killed > 0) await sleep(200);
    return killed;
  } catch {
    return 0;
  }
}

/** 兜底：core.json 里还活着的 pid 就 taskkill（Windows）。 */
export async function forceKillCore(root) {
  const coreFile = path.join(root, '.orch', 'core.json');
  const meta = readJson(coreFile) ?? {};
  const pid = meta.pid;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const probe = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true });
  if (!String(probe.stdout ?? '').includes(String(pid))) return false;
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  await sleep(150);
  return true;
}

// ---------------------------------------------------------------- 场景串行计数（批次 c 备用）

let scenarioRuns = 0;
export function noteScenario() { scenarioRuns += 1; return scenarioRuns; }
export function scenariosSinceRecycle() { return scenarioRuns; }
export function resetScenarioCounter() { scenarioRuns = 0; }
/** 已知：同进程连跑 20+ 个场景会让 mock 的 session/new 全部失败；满 10 个就回收一次。 */
export const SCENARIO_RECYCLE_AT = 10;

// ---------------------------------------------------------------- 证据落盘

/**
 * 写 evidence/<AC>.{state.json,events.jsonl,meta.json,output.json,status.txt}。
 * I1.6 的命令面 AC 没有实例 → state 为 null、events 不产文件（空文件不算证据）。
 */
export function saveEvidence(c, extra = {}) {
  ensureDir(EVID);
  const roots = c.roots ?? [];
  const states = [];
  for (const root of roots) {
    for (const id of instanceIds(root)) {
      const st = readState(root, id);
      if (st) states.push({ __root: path.basename(root), instanceId: id, state: st });
    }
  }

  const evLines = [];
  const multi = roots.length > 1 || states.length > 1;
  for (const root of roots) {
    for (const id of instanceIds(root)) {
      const list = (() => {
        try {
          return fs.readFileSync(path.join(root, '.orch', 'instances', id, 'events.jsonl'), 'utf8')
            .split('\n').filter(Boolean).map((l) => JSON.parse(l));
        } catch { return []; }
      })();
      if (!list.length) continue;
      if (multi) evLines.push(JSON.stringify({ __root: path.basename(root), instanceId: id, __marker: true }));
      for (const e of list) evLines.push(JSON.stringify(multi ? { __root: path.basename(root), instanceId: id, ...e } : e));
    }
  }

  const stateDoc = !multi && states.length === 1 ? states[0].state
    : states.length === 0 ? null
      : { instances: states };

  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return [
      `$ ${argv}`,
      `# label=${cmd.label ?? '-'} cwd=${cmd.cwd ?? '-'} exit=${cmd.exitCode ?? '-'} ${cmd.durationMs ?? 0}ms`,
      String(cmd.stdout ?? ''),
      String(cmd.stderr ?? '').trim() ? `--- stderr ---\n${String(cmd.stderr).trim()}` : ''
    ].filter((x) => x !== '').join('\n');
  }).join('\n\n');

  const meta = {
    ac: c.ac,
    title: c.title ?? null,
    face: c.face ?? '机检',
    verdict: c.verdict ?? null,
    startedAt: c.startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(c.startedAt).getTime(),
    platform: process.platform,
    node: process.version,
    repo: REPO,
    base: BASE,
    baselineCommit: BASELINE_COMMIT,
    headCommit: 'baf975e',
    env: { NODE_ENV: 'test' },
    roots: roots.map((r) => ({ case: path.basename(r), path: r })),
    instances: states.map((s) => ({ __root: s.__root, instanceId: s.instanceId, state: s.state.state })),
    events: evLines.length,
    eventsNote: evLines.length ? null : '本条 AC 不启核心，没有实例事件；不产出 events.jsonl（空文件无效）',
    checks: c.checks?.length ?? 0,
    notes: c.notes ?? [],
    extraFiles: (c.evidence ?? []).map((f) => path.basename(f)),
    ...extra
  };

  const output = {
    ac: c.ac,
    title: c.title ?? null,
    verdict: c.verdict ?? null,
    checks: c.checks ?? [],
    commands: c.commands ?? []
  };

  const files = [];
  const put = (name, content) => {
    const p = path.join(EVID, `${c.ac}.${name}`);
    fs.writeFileSync(p, content, 'utf8');
    files.push(p);
    return p;
  };

  put('state.json', JSON.stringify(stateDoc, null, 2) + '\n');
  if (evLines.length) put('events.jsonl', evLines.join('\n') + '\n');
  put('meta.json', JSON.stringify(meta, null, 2) + '\n');
  put('output.json', JSON.stringify(output, null, 2) + '\n');
  put('status.txt', cmdLines ? cmdLines + '\n' : '（无命令输出）\n');

  if (Array.isArray(c.evidence)) {
    for (const f of files) if (!c.evidence.includes(f)) c.evidence.push(f);
  }
  return files;
}

export function countLines(textValue, re) {
  return String(textValue).split('\n').filter((l) => re.test(l)).length;
}
