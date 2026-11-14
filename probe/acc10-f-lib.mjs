/**
 * I1.10a S3 验收脚手架 · 公共原语（只新增，不改产品代码）。
 *
 * 判据来源：docs/iterations/iteration-10a/requirement.md v2 §3.1 / §3.3、
 * docs/iterations/iteration-10a.md §4（F-16 固化模板）与 §5（交付物清单）。
 *
 * 职责：
 * - 统一的命令执行（捕获原始 stdout/stderr/退出码/耗时，注入 NODE_ENV=test 与独立 TMPDIR）；
 * - TAP 摘要解析（# pass / # fail / # skipped、not ok 行、Subtest 名称）；
 * - 证据目录与 JSON/文本落盘、sha256、时间戳。
 *
 * 纪律：所有文本扫描走 grep -E / grep -RE（ERE）或等价 Node 扫描，
 * 禁止 BRE `\|` 交替（本机 toybox shim 会假通过，需求判定口径 4）。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-10a', 'evidence');
export const PARTS = path.join(HERE, 'acc10-f-parts');
export const RESULTS = path.join(HERE, 'acc10-f-results.jsonl');
export const SUMMARY = path.join(HERE, 'acc10-f-summary.json');
export const BLOCKERS = path.join(HERE, 'acc10-f-blockers.md');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-10a', 'requirement.md');
export const SPLIT = path.join(REPO, 'docs', 'iterations', 'iteration-10a.md');
export const BASELINE = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt');
export const BUNDLE_APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
export const TMP_ROOT = '/tmp/maestro-i10a-acc10';

/** 31 词全表（需求附录 D-7 / 拆分文档 §4 门禁四件套，逐字复制，不改写）。 */
export const WORDS_31 = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';

export function iso() { return new Date().toISOString(); }

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }

export function sha256(buf) {
  return crypto.createHash('sha256').update(typeof buf === 'string' ? Buffer.from(buf) : buf).digest('hex');
}

export function writeText(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, String(s)); return p; }
export function writeJson(p, v) { return writeText(p, JSON.stringify(v, null, 2) + '\n'); }
export function readJson(p, dflt = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
export function appendLine(p, s) { ensureDir(path.dirname(p)); fs.appendFileSync(p, String(s).replace(/\n$/, '') + '\n'); }

/**
 * 执行一条命令并保留全部原始帧。
 * - 默认 cwd = 仓库根；env 注入 NODE_ENV=test / MAESTRO_REPO / 独立 TMPDIR；
 * - **保留平台注入的 NODE_OPTIONS**：需求 §3.3 只强制 NODE_ENV=test，未要求剥离；
 *   剥离后 mock 宿主一轮完成过快，会触发 R-08 已登记时序竞态（AC-04 的 phase
 *   running → completed）。全量回归门禁仍按裁决 V 用 `env -u NODE_OPTIONS`，
 *   两种环境的原始帧分别留证，差集口径不变。仅清除 ELECTRON_RUN_AS_NODE；
 * - opts.stripNodeOptions = true 时显式剥离（供需要纯净环境的命令使用）；
 * - 返回 {cmd, cwd, envKeys, exit, signal, stdout, stderr, durationMs, startedAt, endedAt}。
 */
export function runCmd(cmd, opts = {}) {
  const env = { ...process.env, ...(opts.env || {}) };
  if (opts.stripNodeOptions) delete env.NODE_OPTIONS;
  delete env.ELECTRON_RUN_AS_NODE;
  env.NODE_ENV = env.NODE_ENV || 'test';
  env.MAESTRO_REPO = env.MAESTRO_REPO || REPO;
  const startedAt = iso();
  const t0 = Date.now();
  const r = spawnSync('/bin/zsh', ['-c', cmd], {
    cwd: opts.cwd || REPO,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeoutMs || 240_000,
  });
  const durationMs = Date.now() - t0;
  return {
    cmd,
    cwd: opts.cwd || REPO,
    envKeys: { NODE_ENV: env.NODE_ENV, TMPDIR: env.TMPDIR || null, MAESTRO_REPO: env.MAESTRO_REPO, NODE_OPTIONS: env.NODE_OPTIONS ? '<inherited>' : null },
    exit: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal || null,
    timedOut: r.error?.code === 'ETIMEDOUT' || Boolean(r.signal === 'SIGTERM'),
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error.message || r.error) : null,
    durationMs,
    startedAt,
    endedAt: iso(),
  };
}

/** 解析 node --test 的 TAP 输出（Node 22）。 */
export function parseTap(stdout = '') {
  const num = (re, dflt = 0) => {
    const m = stdout.match(re);
    return m ? Number(m[1]) : dflt;
  };
  return {
    tests: num(/^# tests\s+(\d+)/m),
    pass: num(/^# pass\s+(\d+)/m),
    fail: num(/^# fail\s+(\d+)/m),
    skipped: num(/^# skipped\s+(\d+)/m),
    cancelled: num(/^# cancelled\s+(\d+)/m),
    todo: num(/^# todo\s+(\d+)/m),
    durationMs: num(/^# duration_ms\s+([\d.]+)/m),
    notOk: [...stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]),
    skips: [...stdout.matchAll(/^ok \d+ - (.+?) # SKIP(.*)$/gm)].map((m) => ({ name: m[1], note: m[2].trim() })),
    subtests: [...stdout.matchAll(/^# Subtest: (.+)$/gm)].map((m) => m[1]),
  };
}

/** F-16：文件存在前置断言 + # pass ≥ 1 + # fail 0。 */
export function f16Verdict(r) {
  const tap = parseTap(r.stdout);
  const fileMissing = /test: .*No such file|not found/i.test(r.stderr) && r.exit !== 0;
  return {
    exitOk: r.exit === 0,
    passAtLeastOne: tap.pass >= 1,
    failZero: tap.fail === 0,
    fileMissing,
    ok: r.exit === 0 && tap.pass >= 1 && tap.fail === 0 && !fileMissing,
    tap,
  };
}

export function evidenceDir(ac) { return ensureDir(path.join(EVID, ac)); }
export function caseTmp(ac) { return ensureDir(path.join(TMP_ROOT, ac)); }

/** 列出该 AC 独立 TMPDIR 下实际生成的夹具根（证明「一个 AC 一个独立项目根」）。 */
export function fixtureRoots(ac) {
  const root = caseTmp(ac);
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: path.join(root, d.name) }))
      .slice(0, 200);
  } catch { return []; }
}

/** 取 results.jsonl 中每个 AC 的最后一条（runner 追加写，final 按 AC 取最后一条）。 */
export function lastResults() {
  let lines = [];
  try { lines = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean); } catch { return new Map(); }
  const m = new Map();
  for (const l of lines) {
    try { const o = JSON.parse(l); if (o && o.ac) m.set(o.ac, o); } catch { /* 坏行跳过 */ }
  }
  return m;
}

/** 从 requirement.md §3.1 抽取一条 AC 的原文（供 gen / check 使用，保证逐字）。 */
export function requirementBlocks() {
  const lines = fs.readFileSync(REQUIREMENT, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('### 3.1 功能验收标准'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('### 3.2'));
  const sec = lines.slice(start, end);
  const blocks = [];
  let cur = null;
  for (const line of sec) {
    const m = line.match(/^\*\*(AC-\d+) · (.+?)\*\*/);
    if (m) {
      cur = { ac: m[1], title: m[2], lines: [line], then: [], scene: '', refs: '', risk: '', given: '', when: '', jijian: '', fixture: '', archText: '', judgement: '' };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    cur.lines.push(line);
    if (line.startsWith('- 场景类型：')) cur.scene = line.slice('- 场景类型：'.length);
    if (line.startsWith('- 引用：')) cur.refs = line.slice('- 引用：'.length);
    if (line.startsWith('- 风险：')) cur.risk = line.slice('- 风险：'.length);
    if (line.startsWith('- 判据（规划逐字）：')) cur.judgement = line.slice('- 判据（规划逐字）：'.length);
    if (line.startsWith('- **Given**')) cur.given = line.slice('- **Given**'.length).trim();
    if (line.startsWith('- **When**')) cur.when = line.slice('- **When**'.length).trim();
    if (line.startsWith('- 机检：')) cur.jijian = line.slice('- 机检：'.length);
    if (line.startsWith('- 夹具：')) cur.fixture = line.slice('- 夹具：'.length);
    if (line.startsWith('- 架构检查：')) cur.archText = line.slice('- 架构检查：'.length);
    if (line.startsWith('- **Then**')) cur.then.push(line.slice('- **Then**'.length).trim());
    else if (cur.then.length && /^  - /.test(line)) cur.then.push(line.trim());
  }
  return blocks;
}

/** 用 JS 字符串生成可安全嵌入 .mjs 的字面量（反引号内容里含反引号时转义）。 */
export function jsq(s) { return JSON.stringify(String(s ?? '')); }
