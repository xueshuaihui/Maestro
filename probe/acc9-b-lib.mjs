/**
 * I1.9 / S3 验收 B 组（AC-15 ~ AC-27）公共脚手架。
 *
 * 只做验收取证：临时根一律在 os.tmpdir() 下，NODE_ENV=test，宿主一律
 * `.orch/hosts/mock.json` -> test/fixtures/mock-acp-agent.js（driver 内部注入的
 * `--host mock` / `dsh.json` 同样指向该 mock agent）。
 *
 * 本文件不 import 任何产品模块，避免与实现共享推理；CLI 一律通过 spawn 调用
 * `bin/orch.js`，用真实核心 + 真实 IPC 观察用户可见输出。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const BIN = path.join(REPO, 'bin', 'orch.js');
export const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const EVIDENCE_ROOT = path.join(REPO, 'docs', 'iterations', 'iteration-9', 'evidence', 'acc9');

export const MOCK_LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 40_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

export function envFor(extra = {}) {
  return { ...process.env, NODE_ENV: 'test', ...extra };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mkroot(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `acc9-b-${tag}-`));
}

export function writeMockConfig(root, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, ...switches] },
    limits: { ...MOCK_LIMITS },
  }, null, 2), 'utf8');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function sha256(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
}

export function chainHash(record) {
  return crypto.createHash('sha256').update(canonicalize(record), 'utf8').digest('hex');
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

export function statusDocPath(root, id = 'INST-001') {
  return path.join(instanceDir(root, id), 'workspace', 'status.md');
}

export function writeSnapshot(root, state, id = 'INST-001') {
  writeJson(statePath(root, id), state);
}

export function writeTraces(root, records, id = 'INST-001') {
  const file = tracesPath(root, id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = records.map((record) => (typeof record === 'string' ? record : JSON.stringify(record))).join('\n');
  fs.writeFileSync(file, records.length > 0 ? `${body}\n` : '', 'utf8');
}

export function readEvents(root, id = 'INST-001') {
  const file = eventsPath(root, id);
  if (!fs.existsSync(file)) return [];
  const events = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // 坏行由调用方另行计数
    }
  }
  return events;
}

export function runCli(root, args, { timeout = 120_000, env = {} } = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: root,
    env: envFor(env),
    timeout,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    code: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    lines: (result.stdout ?? '').replace(/\n$/, '').split('\n'),
  };
}

export function runNode(root, script, args = [], { timeout = 180_000, env = {} } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: envFor(env),
    timeout,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    code: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    lines: (result.stdout ?? '').replace(/\n$/, '').split('\n'),
  };
}

export function spawnNode(root, script, args = [], { env = {} } = {}) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    env: envFor(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  const exited = new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: String(err?.message ?? err), stdout, stderr }));
    child.once('exit', (code, signal) => resolve({ code, signal, error: null, stdout, stderr }));
  });
  return {
    child,
    exited,
    get stdout() { return stdout; },
    get stderr() { return stderr; },
  };
}

export function spawnCli(root, args, { env = {} } = {}) {
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd: root,
    env: envFor(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
  const exited = new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: String(err?.message ?? err), stdout, stderr }));
    child.once('exit', (code, signal) => resolve({ code, signal, error: null, stdout, stderr }));
  });
  return {
    child,
    exited,
    get stdout() { return stdout; },
    get stderr() { return stderr; },
  };
}

/** 先起核心再写快照，避免启动对账把写进去的 running 判成 interrupted（§3.3）。 */
export function startCoreOnEmptyRoot(root, id = 'INST-001') {
  const res = runCli(root, ['instance', 'status', id], { timeout: 40_000 });
  return { ...res, ok: res.code === 1 && res.stdout.trim() === `实例 ${id} · 不存在` };
}

export function stopCore(root) {
  try {
    spawnSync(process.execPath, [BIN, 'core', 'stop'], {
      cwd: root,
      env: envFor(),
      timeout: 25_000,
      windowsHide: true,
      stdio: 'ignore',
    });
  } catch {
    // best effort
  }
}

export async function waitFor(predicate, { timeoutMs = 60_000, intervalMs = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() >= deadline) throw new Error(`等待超时：${label}`);
    await sleep(intervalMs);
  }
}

export function waitFile(file, timeoutMs = 60_000) {
  return waitFor(() => fs.existsSync(file), { timeoutMs, label: `文件出现 ${file}` });
}

export function waitEvent(root, predicate, { id = 'INST-001', timeoutMs = 60_000 } = {}) {
  return waitFor(() => readEvents(root, id).find(predicate) ?? null, {
    timeoutMs,
    label: '事件出现',
  });
}

/** 固定本地时钟 ISO（用于快照渲染的逐字断言）。 */
export function localIso(h, m, s, day = 11) {
  return new Date(2026, 10, day, h, m, s).toISOString();
}

export function save(ac, name, content) {
  const dir = path.join(EVIDENCE_ROOT, ac);
  fs.mkdirSync(dir, { recursive: true });
  const body = typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, name), body, 'utf8');
  return path.join(dir, name);
}

/** 一个 AC 的断言收集器：所有 check 结果进 result.json，失败不抛、最后统一判定。 */
export function collector(ac, meta = {}) {
  const checks = [];
  return {
    ac,
    meta,
    check(name, ok, detail = '') {
      const item = { name, ok: Boolean(ok), detail: String(detail ?? '') };
      checks.push(item);
      if (!ok) process.stderr.write(`[${ac}] FAIL ${name}${detail ? ` :: ${detail}` : ''}\n`);
      return Boolean(ok);
    },
    eq(name, actual, expected) {
      return this.check(name, actual === expected, `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
    },
    finish(extra = {}) {
      const failed = checks.filter((item) => !item.ok);
      const result = {
        ac,
        generatedAt: new Date().toISOString(),
        ...meta,
        passed: failed.length === 0,
        total: checks.length,
        failed: failed.length,
        checks,
        ...extra,
      };
      save(ac, 'result.json', result);
      return result;
    },
  };
}

/** 去掉空白行的行数组（读 CLI 输出用）。 */
export function nonEmptyLines(text) {
  return (text ?? '').replace(/\n$/, '').split('\n').filter((line) => line.length > 0);
}
