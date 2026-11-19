/**
 * I1.12 S3 验收脚手架 · 常量与底层工具（批次 A：AC-01~AC-12）。
 *
 * 纪律：
 * - 只新增 probe/** 与 evidence/**，不改 src/**、test/**、bin/** 与任何过程文档；
 * - 夹具根一律 %TEMP%/maestro-i112-<场景>，每条 AC 一个独立根；
 * - 命令一律 execPath + 参数数组（跨平台），**禁止硬编码 bash / bash -c**；
 * - 环境必注入 NODE_ENV=test；原始帧一律落 evidence/，空证据视为无效。
 *
 * 中文期望值不在此硬编码：labels.js 为唯一来源，requirement.md 为逐字基准。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const DRIVER = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const BASE = os.tmpdir();

export const ACC12_PATHS = Object.freeze({
  REPO,
  NODE,
  ORCH,
  DRIVER,
  BASE,
  EVID: path.join(REPO, 'docs', 'iterations', 'iteration-12', 'evidence'),
  CASES: path.join(HERE, 'acc12-cases'),
  PARTS: path.join(HERE, 'acc12-f-parts'),
  RESULTS: path.join(HERE, 'acc12-f-results.jsonl'),
  SUMMARY: path.join(HERE, 'acc12-f-summary.json'),
  BLOCKERS: path.join(HERE, 'acc12-f-blockers.md'),
  REPORT: path.join(REPO, 'docs', 'iterations', 'iteration-12', 'acceptance-fixture.md'),
  REQUIREMENT: path.join(REPO, 'docs', 'iterations', 'iteration-12', 'requirement.md'),
  SPLIT: path.join(REPO, 'docs', 'iterations', 'iteration-12.md'),
  DECISIONS: path.join(REPO, 'docs', 'iterations', 'iteration-12', 'decisions.md'),
  LABELS: path.join(REPO, 'src', 'cli', 'labels.js'),
});

export const EVID = ACC12_PATHS.EVID;
export const PARTS = ACC12_PATHS.PARTS;
export const RESULTS = ACC12_PATHS.RESULTS;
export const SUMMARY = ACC12_PATHS.SUMMARY;
export const BLOCKERS = ACC12_PATHS.BLOCKERS;
export const REQUIREMENT = ACC12_PATHS.REQUIREMENT;
export const REPORT = ACC12_PATHS.REPORT;

/** 证据分级：批次 A 全部为 mock / 夹具面，禁止写成真实宿主。 */
export const GRADING_MOCK = 'mock 实测';
export const VERDICT_PASS = '通过';
export const VERDICT_FAIL = '不通过';
export const VERDICT_BLOCK = '阻塞';

export const iso = () => new Date().toISOString();
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function sha256(buf) {
  return crypto.createHash('sha256')
    .update(typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf)
    .digest('hex');
}

export function sha256File(file) {
  try { return sha256(fs.readFileSync(file)); } catch { return null; }
}

export function writeText(p, s) {
  ensureDir(path.dirname(p));
  const text = String(s ?? '');
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

export function writeJson(p, v) {
  return writeText(p, JSON.stringify(v, null, 2) + '\n');
}

export function readJson(p, dflt = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}

export function readText(p, dflt = '') {
  try { return fs.readFileSync(p, 'utf8'); } catch { return dflt; }
}

export function appendLine(p, s) {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, String(s).replace(/\n+$/, '') + '\n', 'utf8');
  return p;
}

/** 独立项目根：%TEMP%/maestro-i112-<场景>，先删后建。 */
export function freshRoot(scenario) {
  const root = path.join(BASE, `maestro-i112-${scenario}`);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/** 基础环境：NODE_ENV=test 强制注入，清理可能污染夹具的宿主/故障注入变量。 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const key of [
    'ELECTRON_RUN_AS_NODE',
    'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'DSH_HOME',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT'
  ]) delete env[key];
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = String(value);
  }
  env.NODE_ENV = 'test';
  env.MAESTRO_REPO = REPO;
  return env;
}

/**
 * 统一命令执行：只接受 argv 数组，spawnSync 直接执行，绝不经过 shell。
 * 返回 {argv, cmd, cwd, exitCode, signal, stdout, stderr, timedOut, durationMs}。
 */
export function runCmd(argv, opts = {}) {
  const args = Array.isArray(argv) ? argv : [];
  if (args.length === 0) throw new Error('runCmd: empty argv');
  const started = Date.now();
  const cwd = opts.cwd || REPO;
  const env = opts.env || baseEnv();
  const r = spawnSync(args[0], args.slice(1), {
    cwd,
    env,
    timeout: opts.timeout ?? 60_000,
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM');
  return {
    argv: args,
    cmd: [args[0], ...args.slice(1)].map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' '),
    cwd,
    exitCode: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ? String(r.error.message || r.error) : null,
    timedOut,
    durationMs: Date.now() - started,
  };
}

/** 跨平台 orch 调用：node "$MAESTRO_REPO/bin/orch.js" ...（cwd = 独立根）。 */
export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH, ...args], {
    cwd: root,
    ...opts,
    env: opts.env || baseEnv(opts.extraEnv),
    label: opts.label ?? `orch ${args.join(' ')}`,
  });
}

export function statePath(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id, 'state.json');
}

export function eventsPath(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id, 'events.jsonl');
}

export function readState(root, id = 'INST-001') {
  return readJson(statePath(root, id));
}

export function readEvents(root, id = 'INST-001') {
  try {
    return readText(eventsPath(root, id))
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function instanceIds(root) {
  try {
    return fs.readdirSync(path.join(root, '.orch', 'instances')).sort();
  } catch {
    return [];
  }
}

export function fileInfo(p) {
  try {
    const st = fs.statSync(p);
    return { path: p, exists: true, bytes: st.size, sha256: sha256File(p) };
  } catch {
    return { path: p, exists: false, bytes: 0, sha256: null };
  }
}

/**
 * 落原始证据：docs/iterations/iteration-12/evidence/AC-XX.<阶段>.<类型>。
 * 空内容直接抛错（空文件不算证据）。
 */
export function saveEvidence(ac, phase, type, content) {
  const file = path.join(EVID, `${ac}.${phase}.${type}`);
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content ?? '');
  if (text.length === 0) throw new Error(`saveEvidence: empty evidence ${file}`);
  writeText(file, text);
  return { file, bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) };
}

/** 动态加载 labels.js（用户可见中文唯一来源）。 */
export async function loadLabels() {
  return import(pathToFileURL(ACC12_PATHS.LABELS).href);
}

/** 从 requirement.md 抽取一条 AC 的原文块，供逐字比对，不在脚本里硬编码中文期望。 */
export function acBlockFromRequirement(ac) {
  const text = readText(REQUIREMENT);
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`**${ac} ·`));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\*\*AC-\d+ ·/.test(lines[i])) { end = i; break; }
    if (lines[i].startsWith('### 3.2')) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

/** 从 requirement.md 附录 A 读取 A-X 模板原文（逐字，不硬编码）。 */
export function appendixBlockFromRequirement(code) {
  const text = readText(REQUIREMENT);
  const m = text.match(new RegExp(`### ${code} [^\\n]*\\n+([\\s\\S]*?)\\n+\`\`\``));
  return m ? m[1] : '';
}

/** 把 A-0 占位符 [N] / {N} 替换成实际值。 */
export function fillCount(template, n) {
  return String(template).replace(/\[N\]/g, String(n)).replace(/\{N\}/g, String(n));
}

export async function waitUntil(fn, { timeout = 30_000, interval = 100, label = 'condition' } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeout) return null;
    await sleep(interval);
  }
}

export function cleanupRoot(root) {
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* 清理失败不掩盖判定 */ }
}
