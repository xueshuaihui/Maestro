/**
 * I1.11 S3 验收脚手架 · 常量与底层工具（只读产品：不改 src/**、desktop/**、test/**）。
 *
 * 判据来源：docs/iterations/iteration-11/requirement.md v10 §3.1（AC-01~49）、
 *           docs/templates/execution-template.md §3（S3 四件套 / 证据规范 / 判定纪律）。
 *
 * 职责：REPO / EVID / BASE / ORCH / DRIVER 路径常量；命令执行（保留原始 stdout/stderr、
 * 注入 NODE_ENV=test、独立 TMPDIR）；TAP 解析与 F-16 判定；state/events 读取；长驻 driver
 * 管理；证据落盘（test-stdout / meta / state / check / output 五件套）。
 *
 * 纪律：文本扫描一律 ERE（grep -E / grep -RE），禁 BRE `\|` 交替（需求判定口径 4）。
 * 每条机检点名测试文件「先断言存在再运行」（判定口径 5）。证据分级：
 * 已实测（真实宿主） / mock 实测 / 阻塞。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const DRIVER = path.join(REPO, 'test', 'fixtures', 'task-loop-driver.mjs');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-11', 'evidence');
export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-11', 'acceptance-fixture.md');
export const PARTS = path.join(HERE, 'acc11-f-parts');
export const RESULTS = path.join(HERE, 'acc11-f-results.jsonl');
export const SUMMARY = path.join(HERE, 'acc11-f-summary.json');
export const BLOCKERS = path.join(HERE, 'acc11-f-blockers.md');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-11', 'requirement.md');
// 每个 AC 独立项目根，短前缀（macOS core.sock 104 字节路径上限）。绝不进仓库。
export const BASE = path.join(os.tmpdir(), 'maestro-i11-acc');

/** 脚手架路径总表（命名 ACC11_PATHS，不沿用 ACC3_PATHS）。 */
export const ACC11_PATHS = {
  REPO, NODE, ORCH, DRIVER, EVID, REPORT, PARTS, RESULTS, SUMMARY, BLOCKERS,
  REQUIREMENT, BASE
};

// ---------------------------------------------------------------- 基础工具

export function iso() { return new Date().toISOString(); }
export function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch { /* ignore */ } return p; }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
export function sha256(buf) {
  return crypto.createHash('sha256').update(typeof buf === 'string' ? Buffer.from(buf) : buf).digest('hex');
}
export function writeText(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, String(s)); return p; }
export function writeJson(p, v) { return writeText(p, JSON.stringify(v, null, 2) + '\n'); }
export function readJson(p, dflt = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
export function appendLine(p, s) { ensureDir(path.dirname(p)); fs.appendFileSync(p, String(s).replace(/\n$/, '') + '\n'); }
export function countLines(s) { return String(s ?? '').split('\n').filter((l) => l.length).length; }
export function grepCount(text, re) { return String(text ?? '').split('\n').filter((l) => re.test(l)).length; }

/** 每个 AC 一个干净独立根；名字直接用 AC 号，便于 evidence/meta 回溯。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/** 基线环境：强制 NODE_ENV=test；清掉 I1.2/DSH/Electron 注入残留。 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const k of [
    'ELECTRON_RUN_AS_NODE',
    'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'DSH_HOME',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT'
  ]) delete env[k];
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  env.NODE_ENV = 'test';
  return env;
}

/**
 * 执行一条 shell 命令并保留全部原始帧。
 * 默认注入 NODE_ENV=test / MAESTRO_REPO / 独立 TMPDIR；commands 多为需求 §3.1 的机检原文。
 * 返回 {cmd,cwd,env,exit,signal,timedOut,stdout,stderr,durationMs,startedAt,endedAt}。
 */
export function runCmd(cmd, opts = {}) {
  const tmpdir = opts.tmpdir || path.join(BASE, '_tmpenv');
  ensureDir(tmpdir);
  const env = baseEnv({
    TMPDIR: tmpdir,
    MAESTRO_REPO: REPO,
    ...(opts.env || {})
  });
  if (opts.stripNodeOptions) delete env.NODE_OPTIONS;
  const startedAt = iso();
  const t0 = Date.now();
  let r;
  try {
    r = spawnSync('/bin/zsh', ['-c', cmd], {
      cwd: opts.cwd || REPO, env, encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024, timeout: opts.timeoutMs || 120_000, windowsHide: true
    });
  } catch (e) {
    r = { status: -1, signal: null, stdout: '', stderr: String(e?.message || e), error: e };
  }
  return {
    cmd,
    cwd: opts.cwd || REPO,
    env: { NODE_ENV: env.NODE_ENV, TMPDIR: env.TMPDIR, MAESTRO_REPO: env.MAESTRO_REPO, NODE_OPTIONS: env.NODE_OPTIONS ? '<inherited>' : null },
    exit: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal || null,
    timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message || r.error) : null,
    durationMs: Date.now() - t0,
    startedAt,
    endedAt: iso()
  };
}

/** argv 形式的 orch 调用（夹具类用例用）。 */
export function orch(root, args, opts = {}) {
  const argv = [NODE, ORCH, ...args];
  const env = baseEnv(opts.env || {});
  const t0 = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: opts.timeoutMs || 120_000, windowsHide: true
  });
  return {
    argv, cwd: root, exit: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal || null, timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    stdout: r.stdout || '', stderr: r.stderr || '', durationMs: Date.now() - t0,
    label: opts.label || `orch ${args.join(' ')}`
  };
}
/** argv 形式的 driver 调用（夹具类用例用）。 */
export function driver(root, args, opts = {}) {
  const argv = [NODE, DRIVER, '--root', root, ...args];
  const env = baseEnv(opts.env || {});
  const t0 = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd: REPO, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    timeout: opts.timeoutMs || 120_000, windowsHide: true
  });
  return {
    argv, cwd: REPO, exit: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal || null, timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    stdout: r.stdout || '', stderr: r.stderr || '', durationMs: Date.now() - t0,
    label: opts.label || `driver ${args.join(' ')}`
  };
}

// ---------------------------------------------------------------- 状态/事件读取

export function statePath(root, id = 'INST-001') { return path.join(root, '.orch', 'instances', id, 'state.json'); }
export function eventsPath(root, id = 'INST-001') { return path.join(root, '.orch', 'instances', id, 'events.jsonl'); }
export function readState(root, id = 'INST-001') { return readJson(statePath(root, id)); }
export function readEvents(root, id = 'INST-001') {
  try {
    return fs.readFileSync(eventsPath(root, id), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}
export function instanceIds(root) {
  try { return fs.readdirSync(path.join(root, '.orch', 'instances')).sort(); } catch { return []; }
}
export function waitUntil(fn, { timeout = 30000, interval = 100, label = '条件' } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) return null;
    // 同步等待：用 Atomics.wait 避免忙轮询占用事件循环。
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, interval);
  }
}

// ---------------------------------------------------------------- 长驻 driver / 核心回收

const LIVE = new Set();
export function startDriver(root, args, { env = baseEnv(), timeout = 60000 } = {}) {
  const argv = [NODE, DRIVER, '--root', root, ...args];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: REPO, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  const h = {
    argv, root, child, timeout,
    stdout: '', stderr: '', exited: false, exitCode: null, signal: null, startedAt: Date.now()
  };
  LIVE.add(h);
  child.stdout.on('data', (c) => { h.stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => {
    const finish = (code, sig) => {
      h.exited = true; h.exitCode = code; h.signal = sig ?? null;
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
    orch(root, ['core', 'stop'], { timeoutMs: 20000 });
    await forceKillCore(root);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
    await Promise.race([h.done, sleep(5000)]);
  };
  return h;
}
export async function killAllDrivers() {
  for (const h of [...LIVE]) {
    try { h.child.kill('SIGKILL'); } catch { /* ignore */ }
    try { await forceKillCore(h.root); } catch { /* ignore */ }
    LIVE.delete(h);
  }
  await sleep(100);
}
/** 等 .mock/stopped-after-<n> 标记。 */
export function waitMarker(root, n, { timeout = 60000 } = {}) {
  return waitUntil(() => exists(path.join(root, '.mock', `stopped-after-${n}`)), { timeout, label: `stopped-after-${n}` });
}
/** 兜底：core.json 里还活着的 pid 就 SIGKILL（macOS/Linux）。 */
export async function forceKillCore(root) {
  const coreFile = path.join(root, '.orch', 'core.json');
  const meta = readJson(coreFile, {}) || {};
  const pid = meta.pid;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    const probe = spawnSync('kill', ['-0', String(pid)], { encoding: 'utf8', windowsHide: true });
    if (probe.status !== 0) return false;
    spawnSync('kill', ['-9', String(pid)], { windowsHide: true });
    await sleep(150);
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------- TAP / F-16

/** 解析 node --test 的 TAP 输出（Node 22）。 */
export function parseTap(stdout = '') {
  const num = (re, d = 0) => { const m = String(stdout).match(re); return m ? Number(m[1]) : d; };
  return {
    tests: num(/^# tests\s+(\d+)/m),
    pass: num(/^# pass\s+(\d+)/m),
    fail: num(/^# fail\s+(\d+)/m),
    skipped: num(/^# skipped\s+(\d+)/m),
    cancelled: num(/^# cancelled\s+(\d+)/m),
    todo: num(/^# todo\s+(\d+)/m),
    durationMs: num(/^# duration_ms\s+([\d.]+)/m),
    notOk: [...String(stdout).matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]),
    skips: [...String(stdout).matchAll(/^ok \d+ - (.+?) # SKIP(.*)$/gm)].map((m) => ({ name: m[1], note: m[2].trim() })),
    subtests: [...String(stdout).matchAll(/^# Subtest: (.+)$/gm)].map((m) => m[1])
  };
}
/** F-16：文件存在前置断言 + exit 0 + # pass ≥ 1 + # fail 0。 */
export function f16Verdict(r) {
  const tap = parseTap(r.stdout);
  const fileMissing = /No such file|not found|TAP version/i.test(r.stderr) && r.exit !== 0
    && /test: .*(No such file|not found)|Cannot find module/i.test(r.stderr + r.stdout);
  return {
    exitOk: r.exit === 0,
    passAtLeastOne: tap.pass >= 1,
    failZero: tap.fail === 0,
    fileMissing,
    ok: r.exit === 0 && tap.pass >= 1 && tap.fail === 0 && !fileMissing,
    tap
  };
}

// ---------------------------------------------------------------- 证据目录 / 夹具根 / HEAD

export function evidenceDir(ac) { return ensureDir(path.join(EVID, ac)); }
export function caseTmp(ac) { return ensureDir(path.join(BASE, '_tmp', ac)); }
export function fixtureRoots(ac) {
  const r = caseTmp(ac);
  try {
    return fs.readdirSync(r, { withFileTypes: true }).filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(r, d.name) })).slice(0, 200);
  } catch { return []; }
}
export function gitHead() {
  const r = runCmd('git rev-parse --short HEAD', { timeoutMs: 15_000 });
  return r.exit === 0 ? r.stdout.trim() : 'unknown';
}
export function lastResults() {
  let lines = [];
  try { lines = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean); } catch { return new Map(); }
  const m = new Map();
  for (const l of lines) {
    try { const o = JSON.parse(l); if (o && o.ac) m.set(o.ac, o); } catch { /* 坏行跳过 */ }
  }
  return m;
}

/** 从 requirement.md §3.1 抽取一条 AC 的逐字原文（Given/When/Then/机检/夹具/架构检查）。 */
export function requirementBlocks() {
  let src = '';
  try { src = fs.readFileSync(REQUIREMENT, 'utf8'); } catch { return new Map(); }
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.startsWith('### 3.1 功能验收标准'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('### 3.2'));
  const sec = lines.slice(start, end < 0 ? lines.length : end);
  const blocks = new Map();
  let cur = null;
  for (const line of sec) {
    const m = line.match(/^\*\*(AC-\d+) · (.+?)\*\*/);
    if (m) {
      cur = {
        ac: m[1], title: m[2], given: '', when: '', then: [], jijian: '', fixture: '', archText: '', refs: '', risk: ''
      };
      blocks.set(m[1], cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('- 引用：')) cur.refs = line.slice('- 引用：'.length);
    if (line.startsWith('- 风险：')) cur.risk = line.slice('- 风险：'.length);
    if (line.startsWith('- **Given**')) cur.given = line.slice('- **Given**'.length).trim();
    if (line.startsWith('- **When**')) cur.when = line.slice('- **When**'.length).trim();
    if (line.startsWith('- 机检：')) cur.jijian = line.slice('- 机检：'.length);
    if (line.startsWith('- 夹具：')) cur.fixture = line.slice('- 夹具：'.length);
    if (line.startsWith('- 架构检查：')) cur.archText = line.slice('- 架构检查：'.length);
    if (line.startsWith('- **Then**')) cur.then.push(line.slice('- **Then**'.length).trim());
    else if (cur.then.length && /^\s+- /.test(line)) cur.then.push(line.trim());
  }
  return blocks;
}

/**
 * 证据落盘通用助手：把 {name: content} 写入 evidence/<AC>/ 下。
 * 判定用的五件套（test-stdout/meta/state/check/output）由 common.finish 调用本助手落盘。
 */
export function saveEvidence(ac, files = {}) {
  const dir = evidenceDir(ac);
  const out = [];
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(dir, `${ac}.${name}`);
    fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n', 'utf8');
    out.push(p);
  }
  return out;
}

export function jsq(s) { return JSON.stringify(String(s ?? '')); }
