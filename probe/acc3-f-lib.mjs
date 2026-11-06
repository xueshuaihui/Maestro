// I1.3 验收脚手架 —— 常量与底层工具（只读产品：不改 src/**、test/**、bin/**）。
// 纪律：每个 AC 一个独立项目根 %TEMP%/maestro-acc-p3/AC-xx；原始输出一律落盘到 evidence/。
// 本文件不 import 任何 acc2-* 模块，形状对齐 I1.2 验收脚手架但独立实现。
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
export const SEAM = path.join(REPO, 'test', 'fixtures', 'call-seam.mjs');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-3', 'requirement.md');
export const SCENARIO_DIR = path.join(REPO, 'test', 'fixtures', 'scenarios', 'task-loop');

export const BASE = path.join(os.tmpdir(), 'maestro-acc-p3');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-3', 'evidence');
export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-3', 'acceptance-fixture.md');
export const PARTS = path.join(REPO, 'probe', 'acc3-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'acc3-f-results.jsonl');
export const SUMMARY = path.join(REPO, 'probe', 'acc3-f-summary.json');

/** 默认任务文本（与 task-loop-driver 的 DEFAULT_TASK 同形，AC 里要别的话术自己传 --task）。 */
export const DEFAULT_TASK = [
  '写一篇发布说明，覆盖背景、变更与回滚方案。',
  '产物：release-notes.md'
].join('\n');

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 每个 AC 一个干净根；名字直接用 AC 号，便于 evidence/meta 回溯。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/**
 * 基线环境：强制 NODE_ENV=test（MAESTRO_TEST_* / MAESTRO_FAULT 只在测试模式生效），
 * 清掉 ELECTRON_RUN_AS_NODE 与 I1.2 的 DSH / 注入残留，extra 覆盖在最后。
 */
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

/** 统一命令结果：exitCode / stdout / stderr / durationMs / timedOut。 */
export function runCmd(argv, { cwd = REPO, env = baseEnv(), timeout = 120000, label = null } = {}) {
  const started = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, env, timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
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

export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH, ...args], {
    cwd: root, ...opts, label: opts.label ?? `orch ${args.join(' ')}`
  });
}

export function driver(root, args, opts = {}) {
  return runCmd([NODE, DRIVER, '--root', root, ...args], {
    cwd: REPO, ...opts, label: opts.label ?? `driver ${args.join(' ')}`
  });
}

export function statePath(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id, 'state.json');
}
export function eventsPath(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id, 'events.jsonl');
}
export function workspacePath(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id, 'workspace');
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
export function readState(root, id = 'INST-001') { return readJson(statePath(root, id)); }
export function readEvents(root, id = 'INST-001') {
  try {
    return fs.readFileSync(eventsPath(root, id), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
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
    return { path: file, exists: true, bytes: st.size, mtimeMs: st.mtimeMs, sha256: sha256File(file) };
  } catch { return { path: file, exists: false, bytes: 0, mtimeMs: null, sha256: null }; }
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

// ---------------------------------------------------------------- 长驻 driver

const LIVE = new Set();

/** 长驻（--keep）driver：stdout 累积，可等标记文件 / 等输出片段。 */
export function startDriver(root, args, { env = baseEnv(), timeout = 60000 } = {}) {
  const argv = [NODE, DRIVER, '--root', root, ...args];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: REPO, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
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
  /** 等 .mock/<name> */
  h.waitFile = (name, ms = timeout) => waitUntil(() => exists(path.join(root, '.mock', name)), { timeout: ms, label: name });
  /** 等 stdout 出现 pred（默认字符串包含） */
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
    orch(root, ['core', 'stop'], { timeout: 20000 });
    await forceKillCore(root);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
    await Promise.race([h.done, sleep(5000)]);
  };
  return h;
}

/** 全量兜底：超时 / 异常时把所有还活着的 driver 与核心掐掉。 */
export async function killAllDrivers() {
  for (const h of [...LIVE]) {
    try { h.child.kill('SIGKILL'); } catch { /* ignore */ }
    try { await forceKillCore(h.root); } catch { /* ignore */ }
    LIVE.delete(h);
  }
  await sleep(200);
}

/** 等 .mock/stopped-after-<n>（驱动/核心侧的停止标记）。 */
export function waitMarker(root, n, { timeout = 60000 } = {}) {
  return waitUntil(() => exists(path.join(root, '.mock', `stopped-after-${n}`)), { timeout, label: `stopped-after-${n}` });
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
  await sleep(200);
  return true;
}

// ---------------------------------------------------------------- 场景串行计数

let scenarioRuns = 0;
export function noteScenario() { scenarioRuns += 1; return scenarioRuns; }
export function scenariosSinceRecycle() { return scenarioRuns; }
export function resetScenarioCounter() { scenarioRuns = 0; }
/** 已知：同进程连跑 20+ 个场景会让 mock 的 session/new 全部失败；满 10 个就回收一次。 */
export const SCENARIO_RECYCLE_AT = 10;

// ---------------------------------------------------------------- 证据落盘

function rootOf(c) { return c.roots?.[0] ?? null; }

/**
 * 写 evidence/<AC>.{state.json,events.jsonl,meta.json,output.json,status.txt}。
 * state/events 多根时用 {__root, instanceId} 包一层，单根单实例保持产品原文。
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
      const list = readEvents(root, id);
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
    face: c.face ?? '夹具',
    verdict: c.verdict ?? null,
    startedAt: c.startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(c.startedAt).getTime(),
    platform: process.platform,
    node: process.version,
    repo: REPO,
    base: BASE,
    env: { NODE_ENV: 'test' },
    roots: roots.map((r) => ({ case: path.basename(r), path: r })),
    instances: states.map((s) => ({ __root: s.__root, instanceId: s.instanceId, state: s.state.state })),
    checks: c.checks?.length ?? 0,
    notes: c.notes ?? [],
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
  put('events.jsonl', evLines.length ? evLines.join('\n') + '\n' : '');
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
