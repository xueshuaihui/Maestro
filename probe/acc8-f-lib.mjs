/**
 * I1.8 S3 验收脚手架 · 常量与底层工具。
 *
 * 纪律（需求 §3.3、附录 D-10、拆分 §2.15）：
 * - 只新增 `probe/**` 与 `docs/iterations/iteration-8/evidence/<acc8|wp7>/**`；
 *   不改 `src/**`、`test/**`（D-9 两行授权除外，已由 S2 落地）、`bin/**` 与过程文档。
 * - 夹具项目根一律 `%TEMP%/maestro-i18/<AC>`，**不放仓库内**。
 * - 命令一律 `process.execPath` + 参数数组（跨平台），不经 shell；架构扫描例外
 *   （AC-54 必须逐字执行附录 D-11 的五条 bash 命令）。
 * - 环境必注入 `NODE_ENV=test`；真实宿主面走 `probe/acc8-realhost.mjs` 的隔离配方。
 * - **证据根**：默认 `evidence/acc8`（S3 全量 67 条的自洽证据集）；
 *   设 `ACC8_EVID=wp7` 可复现 WP-7 末批那 9 条的原始目录。`results/summary/blockers`
 *   一律与证据根同目录，保证「一次验收 = 一个自洽目录」。
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
export const ORCH_BIN = path.join(REPO, 'bin', 'orch.js');
export const BASE = os.tmpdir();

/** 证据子目录名：`acc8`（默认，S3 全量）或 `wp7`（WP-7 末批原始帧）。 */
const EVID_DIR = String(process.env.ACC8_EVID || 'acc8').trim() || 'acc8';
const EVID_ROOT = path.join(REPO, 'docs', 'iterations', 'iteration-8', 'evidence', EVID_DIR);

export const ACC8_PATHS = Object.freeze({
  REPO,
  NODE,
  ORCH_BIN,
  BASE,
  EVID: EVID_ROOT,
  EVID_DIR,
  CASES: path.join(HERE, 'acc8-cases'),
  RESULTS: path.join(EVID_ROOT, '_acc8-f-results.jsonl'),
  SUMMARY: path.join(EVID_ROOT, '_acc8-f-summary.json'),
  BLOCKERS: path.join(EVID_ROOT, '_acc8-f-blockers.md'),
  REQUIREMENT: path.join(REPO, 'docs', 'iterations', 'iteration-8', 'requirement.md'),
  BASELINE_REDS: path.join(REPO, 'probe', 'i18-s2', 'baseline-014fa6a-reds.txt'),
  BASELINE_FULL: path.join(REPO, 'probe', 'i18-s2', 'baseline-014fa6a-full.log'),
  GIT_BASE: '014fa6a',
});

export const EVID = ACC8_PATHS.EVID;
export const RESULTS = ACC8_PATHS.RESULTS;

export const VERDICT_PASS = '通过';
export const VERDICT_FAIL = '不通过';
export const VERDICT_BLOCK = '阻塞';
export const GRADING_REAL = '真实宿主实测';
export const GRADING_MOCK = 'mock 实测';
export const GRADING_ARCH = '架构门禁实测';

export const iso = () => new Date().toISOString();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function writeText(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, 'utf8');
  return p;
}

export function writeJson(p, v) {
  return writeText(p, `${JSON.stringify(v, null, 2)}\n`);
}

export function readText(p, dflt = '') {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return dflt;
  }
}

export function readJson(p, dflt = null) {
  try {
    return JSON.parse(readText(p));
  } catch {
    return dflt;
  }
}

export function appendLine(p, s) {
  ensureDir(path.dirname(p));
  fs.appendFileSync(p, `${String(s).replace(/\n+$/, '')}\n`, 'utf8');
  return p;
}

/** 独立项目根：`%TEMP%/maestro-i18/<AC 或场景>`，先删后建（§3.3#2）。 */
export function freshRoot(scenario) {
  const root = path.join(BASE, 'maestro-i18', String(scenario).replace(/[^\w.-]/g, '-'));
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

export function cleanupRoot(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch {
    /* 清理失败不掩盖判定 */
  }
}

/** 基础环境：强制 `NODE_ENV=test`，剔除会污染夹具的宿主 / 真实面 / 故障注入变量。 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const key of [
    'ELECTRON_RUN_AS_NODE', 'DSH_HOME',
    'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_RECOVERY_HOLD', 'MAESTRO_FAULT',
    'MAESTRO_MOCK_CAPS', 'MAESTRO_MOCK_RESUME', 'MAESTRO_MOCK_LOAD', 'MAESTRO_MOCK_NEW_FAIL',
  ]) delete env[key];
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  env.NODE_ENV = 'test';
  env.MAESTRO_REPO = REPO;
  return env;
}

/**
 * 统一命令执行（argv 数组，直接 spawnSync，不经 shell）。
 * 返回 {argv, cmd, cwd, exitCode, signal, stdout, stderr, timedOut, durationMs}。
 */
export function runCmd(argv, opts = {}) {
  const argvList = Array.isArray(argv) ? argv.map(String) : [];
  if (argvList.length === 0) throw new Error('runCmd: empty argv');
  const started = Date.now();
  const r = spawnSync(argvList[0], argvList.slice(1), {
    cwd: opts.cwd || REPO,
    env: opts.env || baseEnv(),
    timeout: opts.timeout ?? 120_000,
    windowsHide: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    argv: argvList,
    cmd: argvList.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' '),
    cwd: opts.cwd || REPO,
    exitCode: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ? String(r.error.message || r.error) : null,
    timedOut: r.error?.code === 'ETIMEDOUT',
    durationMs: Date.now() - started,
  };
}

/** `orch` 调用：cwd = 独立项目根。 */
export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH_BIN, ...args], {
    cwd: root,
    ...opts,
    env: opts.env || baseEnv(opts.extraEnv),
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
  return readText(eventsPath(root, id))
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 落原始帧：`evidence/wp7/<AC>.<阶段>.<类型>`。空内容直接抛错（空文件不算证据）。
 */
export function saveEvidence(ac, phase, type, content) {
  const file = path.join(EVID, `${ac}.${phase}.${type}`);
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content ?? '');
  if (text.length === 0) throw new Error(`saveEvidence: empty evidence ${file}`);
  writeText(file, text);
  return { file: path.relative(REPO, file).replace(/\\/g, '/'), bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) };
}

/** 目录下所有文件的 mtime / size / sha 快照（AC-26 产物不变、AC-57 隔离守卫）。 */
export function snapshotTree(dir) {
  const out = [];
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else {
        try {
          const st = fs.statSync(full);
          out.push({
            path: path.relative(dir, full).replace(/\\/g, '/'),
            mtimeMs: st.mtimeMs,
            size: st.size,
            sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'),
          });
        } catch {
          /* 读取失败不进入快照 */
        }
      }
    }
  };
  walk(dir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function statMtime(p) {
  try {
    return Math.floor(fs.statSync(p).mtimeMs / 1000);
  } catch {
    return null;
  }
}

export function git(args, opts = {}) {
  return runCmd(['git', ...args], { cwd: REPO, env: { ...process.env }, timeout: 120_000, ...opts });
}

export function gitStatusPorcelain() {
  const r = git(['status', '--porcelain']);
  return r.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

/**
 * A-0 归一化（与 `test/wp9/i19-regression.test.js:161` 同口径）。
 * 只替换可变值，不改任何文字与顺序。
 */
export function normalizeChainLine(line) {
  return String(line)
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-PID-SEQ')
    .replace(/INST-\d+/g, 'INST-N')
    .replace(/\d{2}:\d{2}:\d{2}/g, 'TIME')
    .replace(/已运行 \d+s/g, '已运行 Ns')
    .replace(/耗时 \d+s/g, '耗时 Ns');
}

export function normalizeChain(text) {
  return String(text)
    .replace(/\n$/, '')
    .split('\n')
    .map(normalizeChainLine);
}

export async function loadModule(absPath) {
  return import(pathToFileURL(absPath).href);
}

/** 从 requirement.md 抽取一条 AC 的原文块（逐字比对用，不在脚本硬编码中文期望以外的措辞）。 */
export function acBlock(ac) {
  const lines = readText(ACC8_PATHS.REQUIREMENT).split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`#### ${ac} `));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^#### AC-\d+ /.test(lines[i]) || /^### 3\.2/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/** 写入 `.orch/hosts/mock.json`：把 mock agent 当作「另一个 host 命令」拉起（与 wp9 回归同口径）。 */
export function createMockHost(root, mockPath, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [mockPath, ...switches] },
    limits: { initializeTimeoutMs: 15_000, requestTimeoutMs: 15_000, promptTimeoutMs: 30_000, quietIdleMs: 30, quietCapMs: 200 },
  }, null, 2), 'utf8');
  return path.join(dir, 'mock.json');
}
