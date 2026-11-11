// I1.9 S3 验收（A 组 AC-01~AC-14）脚手架 —— 公共工具。
//
// 纪律（任务书 + D-3）：
// - 只读产品：不改 src/**、test/**、任何夹具、package.json；本目录只新增 `acc9-a-*.mjs`。
// - 夹具根一律在 os.tmpdir() 下的独立目录（绝不放进仓库，否则 DSH 会触发权限修复）。
// - NODE_ENV=test；宿主统一 `--host mock` 且 `.orch/hosts/mock.json` 指向仓库内 mock agent。
// - 快照类夹具：先在空目录执行一次 `instance status INST-001`（返回「不存在」）再写快照，
//   避免核心启动对账把 running 判成 interrupted（requirement §3.3）。
// - 证据一律落 `docs/iterations/iteration-9/evidence/acc9/<AC>/`，含 stdout / JSON / 哈希。
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const CODE_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
export const TASK_DRIVER = path.join(REPO, 'test', 'fixtures', 'task-loop-driver.mjs');
export const EVID_ACC9 = path.join(REPO, 'docs', 'iterations', 'iteration-9', 'evidence', 'acc9');
export const BASE = path.join(os.tmpdir(), 'maestro-acc9a');

export const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

export const ZERO_HASH = '0'.repeat(64);

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 每个 AC 一个干净夹具根（os.tmpdir() 下独立目录）。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

export function evidenceDir(ac) {
  const dir = path.join(EVID_ACC9, ac);
  ensureDir(dir);
  return dir;
}

/** 写一份证据文件；返回写入的字节数。 */
export function writeEvidence(ac, name, content) {
  const dir = evidenceDir(ac);
  const file = path.join(dir, name);
  ensureDir(path.dirname(file));
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  fs.writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  return { file: path.relative(REPO, file), bytes: Buffer.byteLength(text) };
}

export function envFor(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', ...extra };
  for (const k of [
    'ELECTRON_RUN_AS_NODE',
    'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'DSH_HOME',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT',
    'MAESTRO_PERMISSION_POLICY',
  ]) delete env[k];
  env.NODE_ENV = 'test';
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  env.NODE_ENV = 'test';
  return env;
}

/** 在夹具根内执行产品 CLI（同步）；`orch` 可指向另一棵树（AC-03 基线对照）。 */
export function runCli(root, args, { timeout = 120_000, env = {}, orch = ORCH } = {}) {
  const startedAt = new Date().toISOString();
  const r = spawnSync(NODE, [orch, ...args], {
    cwd: root,
    env: envFor(env),
    timeout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    argv: [NODE, orch, ...args],
    cwd: root,
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode: r.status,
    signal: r.signal ?? null,
    timedOut: r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM'),
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

/** 异步启动 `orch run`（需要「边跑边看」的 AC）。 */
export function spawnCli(root, args, { env = {} } = {}) {
  const child = spawn(NODE, [ORCH, ...args], {
    cwd: root,
    env: envFor(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const out = [];
  const err = [];
  child.stdout.on('data', (chunk) => out.push(chunk));
  child.stderr.on('data', (chunk) => err.push(chunk));
  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({
      exitCode: code,
      signal: signal ?? null,
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8'),
    }));
  });
  return { child, done };
}

/** 运行 driver（code-loop / task-loop）：cwd 固定仓库根，`--root` 指夹具根。 */
export function runDriver(driver, root, args, { timeout = 180_000 } = {}) {
  const startedAt = new Date().toISOString();
  const r = spawnSync(NODE, [driver, '--root', root, ...args], {
    cwd: REPO,
    env: envFor(),
    timeout,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return {
    argv: ['node', path.relative(REPO, driver), '--root', root, ...args],
    startedAt,
    endedAt: new Date().toISOString(),
    exitCode: r.status,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

export function spawnDriver(driver, root, args) {
  const child = spawn(NODE, [driver, '--root', root, ...args], {
    cwd: REPO,
    env: envFor(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const out = [];
  const err = [];
  child.stdout.on('data', (c) => out.push(c));
  child.stderr.on('data', (c) => err.push(c));
  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({
      exitCode: code,
      signal: signal ?? null,
      stdout: Buffer.concat(out).toString('utf8'),
      stderr: Buffer.concat(err).toString('utf8'),
    }));
  });
  return { child, done };
}

/** 宿主夹具：`.orch/hosts/mock.json` 指向仓库内 mock agent（D-3）。 */
export function writeMockConfig(root, switches = [], limits = LIMITS) {
  const dir = path.join(root, '.orch', 'hosts');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'mock.json'), `${JSON.stringify({
    transport: 'stdio',
    launch: { command: NODE, args: [MOCK, ...switches] },
    limits: { ...limits },
  }, null, 2)}\n`, 'utf8');
}

/** 先在空目录拉起核心：返回「不存在」才算现场就绪（§3.3 快照夹具启动顺序）。 */
export function startCoreOnEmptyRoot(root) {
  const res = runCli(root, ['instance', 'status', 'INST-001'], { timeout: 40_000 });
  const ok = res.exitCode === 1 && res.stdout.trim() === '实例 INST-001 · 不存在';
  return { ok, res };
}

export function stopCore(root) {
  return spawnSync(NODE, [ORCH, 'core', 'stop'], {
    cwd: root,
    env: envFor(),
    timeout: 25_000,
    encoding: 'utf8',
    windowsHide: true,
  });
}

export function removeProject(root) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      return;
    } catch (err) {
      const transient = err?.code === 'ENOTEMPTY' || err?.code === 'EBUSY' || err?.code === 'EPERM';
      if (!transient || Date.now() >= deadline) return;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
}

export function instanceDir(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id);
}

export function statePath(root, id = 'INST-001') {
  return path.join(instanceDir(root, id), 'state.json');
}

export function eventsPath(root, id = 'INST-001') {
  return path.join(instanceDir(root, id), 'events.jsonl');
}

export function tracesPath(root, id = 'INST-001') {
  return path.join(instanceDir(root, id), 'state', 'traces.jsonl');
}

export function writeSnapshot(root, state, id = 'INST-001') {
  const dir = instanceDir(root, id);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function writeTraces(root, records, id = 'INST-001') {
  const file = tracesPath(root, id);
  ensureDir(path.dirname(file));
  const body = records.map((r) => JSON.stringify(r)).join('\n');
  fs.writeFileSync(file, `${body}\n`, 'utf8');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function sha256File(file) {
  if (!exists(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function sha256Text(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 与 `instance-store.js` 同口径的规范化 JSON（递归按键名排序、无多余空白）。 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

export function recordHash(record) {
  return sha256Text(canonicalize(record));
}

/**
 * 读 `instance log --format json` 的 stdout。
 * 实测该命令输出的是一个 pretty-printed JSON **数组**（不是 NDJSON）；
 * 这里同时兼容数组与逐行 NDJSON 两种形态，避免口径写死。
 */
export function parseEventJson(stdout) {
  const text = String(stdout).trim();
  if (text === '') return [];
  if (text.startsWith('[')) return JSON.parse(text);
  const out = [];
  for (const line of text.split('\n')) {
    const row = line.trim();
    if (row === '' || !row.startsWith('{')) continue;
    out.push(JSON.parse(row));
  }
  return out;
}

/** A-0 归一化（与 `test/wp9/i19-regression.test.js:161-168` 同口径）。 */
export function normalizeLine(line) {
  return line
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-PID-SEQ')
    .replace(/INST-\d+/g, 'INST-N')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')
    .replace(/已运行 \d+s/g, '已运行 Ns')
    .replace(/耗时 \d+s/g, '耗时 Ns')
    .replace(/TRC-[0-9a-f]{8}/g, 'TRC-XXXXXXXX');
}

export function normalizeStdout(stdout) {
  return String(stdout).replace(/\n$/, '').split('\n').map(normalizeLine);
}

/**
 * 折叠「会话 执行中 · 已运行 Ns」的刷新重复行（只保留第一条）。
 *
 * 该行由 CLI 的 1s 轮询刷新节流产生：同一次运行跑得久一点就会多打一条
 * （`render.js` 的 `已运行 [^·]+` 去重键只在时长变化时放行）。I1.7 / S2 的
 * 三链基线里本就只出现一次，属于**运行时长敏感的既有刷新行为**，不是文案变化；
 * 归一化后两条会变成同一串，简单 diff 会把它误判成「多了一行」。
 * 这里只折叠这一种行的重复，其余任何行（文字/顺序/条数）一律逐字比对。
 */
export function collapseRefresh(lines) {
  const out = [];
  for (const line of lines) {
    if (line === '会话 执行中 · 已运行 Ns' && out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out;
}

/** 轮询直到 `predicate()` 真或超时（不使用固定 sleep 凑时序，只轮询现场）。 */
export async function waitFor(predicate, { timeoutMs = 60_000, intervalMs = 50, label = 'waitFor' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const got = await predicate();
    if (got) return { ok: true, value: got };
    if (Date.now() >= deadline) return { ok: false, label };
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export function nowIso() {
  return new Date().toISOString();
}

/** 统一的小结打印 + 落盘，便于复跑时肉眼扫。 */
export function report(ac, payload, name = 'result.json') {
  const text = JSON.stringify({ ac, at: nowIso(), ...payload }, null, 2);
  writeEvidence(ac, name, text);
  process.stdout.write(`${text}\n`);
  return text;
}

/** 简易断言器：失败不抛，只记一条 fail（验收要按条给结论，不中途中断）。 */
export function makeChecks() {
  const checks = [];
  const check = (name, ok, detail = null) => {
    checks.push({ name, ok: Boolean(ok), detail });
    return ok;
  };
  return { checks, check };
}
