// I1.10b S3 批次 a 验收脚手架 · 常量与底层工具（只读产品：不改 src/**、test/**、desktop/**）。
// 判据来源：docs/iterations/iteration-10b/requirement.md v6.1 §3.1 / 附录 A-0~A-10、
//           docs/templates/execution-template.md §3.1~§3.5、decisions.md 裁决 G/H/J。
// 纪律：每个 AC 一个独立项目根 %TEMP%/maestro-i10b-acc10b-f/<AC>/，NODE_ENV=test 必注入，
//       宿主 mock（AC-25/33 真实宿主面不在本批），跑完 orch core stop；原始帧一律落 evidence/。
//       文本扫描用 grep -REn（ERE），禁 BRE `\|` 交替（需求 §3.1 判定口径 4）。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const DRIVER = path.join(REPO, 'test', 'fixtures', 'task-loop-driver.mjs');
export const PURITY_CHECK = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');
export const TEST_DIR = path.join(REPO, 'test', 'wp14');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'requirement.md');
export const DECISIONS = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'decisions.md');

export const BASE = path.join(os.tmpdir(), 'maestro-i10b-acc10b-f');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'evidence');
export const PARTS = path.join(REPO, 'probe', 'acc10b-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'acc10b-f-results.jsonl');
export const SUMMARY = path.join(REPO, 'probe', 'acc10b-f-summary.json');
export const BLOCKERS = path.join(REPO, 'probe', 'acc10b-f-blockers.md');
export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-10b', 'acceptance-a.md');
export const CASES_DIR = path.join(REPO, 'probe', 'acc10b-cases');

/** 脚手架路径总表（final 与用例共用；命名约定 ACC10B_PATHS，不沿用 ACC3_PATHS）。 */
export const ACC10B_PATHS = {
  REPO, NODE, ORCH, DRIVER, PURITY_CHECK, TEST_DIR, REQUIREMENT, DECISIONS,
  BASE, EVID, PARTS, RESULTS, SUMMARY, BLOCKERS, REPORT, CASES_DIR
};

/** 31 词全表（需求附录 D-7 / 模板 §0.3，逐字复制，不改写）。 */
export const WORDS_31 = 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check';

export function iso() { return new Date().toISOString(); }
export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
export function sha256(buf) {
  return crypto.createHash('sha256').update(typeof buf === 'string' ? Buffer.from(buf) : buf).digest('hex');
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
export function writeText(p, s) { ensureDir(path.dirname(p)); fs.writeFileSync(p, String(s)); return p; }
export function writeJson(p, v) { return writeText(p, JSON.stringify(v, null, 2) + '\n'); }
export function readJson(p, dflt = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; }
}
export function appendLine(p, s) { ensureDir(path.dirname(p)); fs.appendFileSync(p, String(s).replace(/\n$/, '') + '\n'); }

/** 每个 AC 一个干净根；名字直接用 AC 号。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/** 基线环境：强制 NODE_ENV=test，清 ELECTRON_RUN_AS_NODE（AC-25/33 真实宿主面才需宿主变量）。 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const k of ['ELECTRON_RUN_AS_NODE']) delete env[k];
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
    label, argv, cwd,
    exitCode: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    error: r.error ? String(r.error.message || r.error) : null,
    timedOut,
    durationMs: Date.now() - started,
    startedAt: new Date(started).toISOString(),
    endedAt: iso()
  };
}

/** shell 串执行（grep -REn 等）；保留原始 stdout/stderr/exit。 */
export function runBash(cmd, { cwd = REPO, env = baseEnv(), timeout = 60000, label = null } = {}) {
  const started = Date.now();
  const r = spawnSync('bash', ['-c', cmd], {
    cwd, env, timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  });
  return {
    label, cmd, cwd,
    exitCode: typeof r.status === 'number' ? r.status : 1,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '', stderr: r.stderr ?? '',
    error: r.error ? String(r.error.message || r.error) : null,
    timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    durationMs: Date.now() - started
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
    durationMs: num(/^# duration_ms\s+([\d.]+)/m),
    notOk: [...stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]),
    subtests: [...stdout.matchAll(/^# Subtest: (.+)$/gm)].map((m) => m[1])
  };
}

/** F-16：先断言文件存在，再直接运行，再断言 # pass ≥1 / # fail 0。 */
export function f16Verdict(res) {
  const tap = parseTap(res?.stdout ?? '');
  const fileMissing = res?.exitCode === 1 && /Cannot find module|Could not find|No such file|not found/i.test(`${res.stderr}${res.stdout}`);
  return {
    exitOk: res?.exitCode === 0,
    passAtLeastOne: tap.pass >= 1,
    failZero: tap.fail === 0,
    fileMissing,
    ok: res?.exitCode === 0 && tap.pass >= 1 && tap.fail === 0 && !fileMissing,
    tap
  };
}

/** 运行一个 wp14 机检文件（先 test -f，再 node --test）；同时读回源文件供逐字核对。 */
export function runNodeTest(file, { label = null } = {}) {
  const abs = path.join(TEST_DIR, file);
  const fileExists = fs.existsSync(abs);
  const src = fileExists ? fs.readFileSync(abs, 'utf8') : '';
  const res = fileExists
    ? runCmd([NODE, '--test', abs], { cwd: REPO, timeout: 180000, label: label ?? `node --test test/wp14/${file}` })
    : { label: label ?? file, argv: [], cwd: REPO, exitCode: 1, stdout: '', stderr: `文件缺失：test/wp14/${file}`, timedOut: false, durationMs: 0 };
  return { res, file, fileExists, src, f16: f16Verdict(res) };
}

/**
 * 执行一条架构检查（grep -REn，ERE）。expect: 'zero'（期望零命中 exit 1）/ 'min1'（≥1 命中 exit 0）/ 'exact:N'（恰好 N 命中 exit 0）。
 * 返回可机检的 {label, cmd, expect, exitCode, hits, ok, stdout}。
 */
export function grepCheck(label, pattern, target, expect = 'zero', { cwd = REPO } = {}) {
  const targets = String(target).trim().split(/\s+/).map((t) => JSON.stringify(t)).join(' ');
  const cmd = `grep -REn ${JSON.stringify(pattern)} ${targets}`;
  const res = runBash(cmd, { cwd, label });
  const hits = res.stdout.split('\n').filter((l) => l.trim().length > 0);
  let ok;
  if (expect === 'zero') ok = res.exitCode === 1 && hits.length === 0;
  else if (expect === 'min1') ok = res.exitCode === 0 && hits.length >= 1;
  else if (/^exact:\d+$/.test(expect)) ok = res.exitCode === 0 && hits.length === Number(expect.slice(6));
  else ok = false;
  return { label, cmd, pattern, target, expect, exitCode: res.exitCode, hits: hits.length, lines: hits, ok, stdout: res.stdout, stderr: res.stderr };
}

/** 把一组 grepCheck 结果渲染成可读原始帧文本（保证非空：即使全零命中也写命令与判定）。 */
export function renderArchFrame(checks, heading = '架构检查（需求同号原文，grep -REn / ERE）') {
  const rows = checks.map((x, i) => [
    `[${i + 1}] ${x.label}`,
    `$ ${x.cmd}`,
    `expect=${x.expect} exit=${x.exitCode} hits=${x.hits} ${x.ok ? 'OK' : 'MISMATCH'}`,
    x.lines.length ? x.lines.join('\n') : '(零命中)'
  ].join('\n'));
  return [heading, '', ...rows, ''].join('\n');
}

// ---------------------------------------------------------------- 需求原文

/** 从 requirement.md §3.1 抽取全部 AC 块（标题形态 **AC-xx · …**）。 */
export function requirementBlocks() {
  const lines = fs.readFileSync(REQUIREMENT, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('### 3.1 功能验收标准'));
  const end = lines.findIndex((l, i) => i > start && l.startsWith('### 3.2'));
  const sec = lines.slice(start, end < 0 ? lines.length : end);
  const blocks = [];
  let cur = null;
  for (const line of sec) {
    const m = line.match(/^\*\*(AC-\d+) · (.+?)\*\*/);
    if (m) {
      cur = {
        ac: m[1], title: m[2], lines: [line],
        then: [], given: '', when: '', jijian: '', archText: '', fixture: '', scene: '', refs: '', risk: ''
      };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    cur.lines.push(line);
    if (line.startsWith('- 场景类型：')) cur.scene = line.slice('- 场景类型：'.length).trim();
    if (line.startsWith('- 引用：')) cur.refs = line.slice('- 引用：'.length).trim();
    if (line.startsWith('- 风险：')) cur.risk = line.slice('- 风险：'.length).trim();
    if (line.startsWith('- **Given**')) cur.given = line.slice('- **Given**'.length).trim();
    if (line.startsWith('- **When**')) cur.when = line.slice('- **When**'.length).trim();
    if (line.startsWith('- 机检：')) cur.jijian = line.slice('- 机检：'.length);
    if (line.startsWith('- 夹具：')) cur.fixture = line.slice('- 夹具：'.length);
    if (line.startsWith('- 架构检查')) cur.archText = line.replace(/^- 架构检查(（[^）]*）)?：/, '');
    if (line.startsWith('- **Then**')) cur.then.push(line.slice('- **Then**'.length).trim());
    else if (cur.then.length && /^  - /.test(line)) cur.then.push(line.trim());
  }
  return blocks;
}

const BLOCK_CACHE = new Map();
function blockOf(ac) {
  if (!BLOCK_CACHE.size) for (const b of requirementBlocks()) BLOCK_CACHE.set(b.ac, b);
  return BLOCK_CACHE.get(ac) ?? null;
}
export function requirementTitle(ac) { return blockOf(ac)?.title ?? ''; }
export function requirementThen(ac) { return blockOf(ac)?.then ?? []; }
export function requirementGivenWhenThen(ac) {
  const b = blockOf(ac);
  if (!b) return [];
  return b.lines
    .map((l) => l.trim())
    .filter((l) => /^(- \*\*Given\*\*|- \*\*When\*\*|- \*\*Then\*\*|  - |^- 判据)/.test(l));
}

// ---------------------------------------------------------------- 证据落盘

/** 取 results.jsonl 中每个 AC 的最后一条。 */
export function lastResults() {
  let lines = [];
  try { lines = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean); } catch { return new Map(); }
  const m = new Map();
  for (const l of lines) {
    try { const o = JSON.parse(l); if (o?.ac) m.set(o.ac, o); } catch { /* 坏行跳过 */ }
  }
  return m;
}

/**
 * 落地一个 AC 的全部证据文件。c.frames: [{name, ext, text}] → AC-XX.<name>.<ext>；
 * 另自动写 meta.json / status.txt。所有文件保证非空（空帧写一行说明，绝不留空文件）。
 */
export function saveEvidence(c, extra = {}) {
  ensureDir(EVID);
  const files = [];
  const put = (name, text) => {
    const p = path.join(EVID, `${c.ac}.${name}`);
    let s = String(text ?? '');
    if (s.length === 0) s = `（本帧无内容；AC=${c.ac}，判定=${c.verdict ?? '未定'}）\n`;
    if (!s.endsWith('\n')) s += '\n';
    fs.writeFileSync(p, s, 'utf8');
    if (!c.evidence.includes(p)) c.evidence.push(p);
    files.push(p);
    return p;
  };

  for (const f of (c.frames ?? [])) put(`${f.name}.${f.ext}`, f.text);

  const meta = {
    ac: c.ac,
    title: c.title ?? requirementTitle(c.ac),
    face: c.face ?? 'mock 实测',
    verdict: c.verdict ?? null,
    startedAt: c.startedAt,
    finishedAt: iso(),
    durationMs: Date.now() - new Date(c.startedAt).getTime(),
    platform: process.platform,
    node: process.version,
    repo: REPO,
    base: BASE,
    env: { NODE_ENV: 'test', host: 'mock' },
    roots: (c.roots ?? []).map((r) => ({ case: path.basename(r), path: r })),
    checks: c.checks?.length ?? 0,
    notes: c.notes ?? [],
    ...extra
  };
  put('meta.json', JSON.stringify(meta, null, 2));

  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return [
      `$ ${argv || cmd.cmd || ''}`,
      `# label=${cmd.label ?? '-'} cwd=${cmd.cwd ?? '-'} exit=${cmd.exitCode ?? '-'} ${cmd.durationMs ?? 0}ms`,
      String(cmd.stdout ?? ''),
      String(cmd.stderr ?? '').trim() ? `--- stderr ---\n${String(cmd.stderr).trim()}` : ''
    ].filter((x) => x !== '').join('\n');
  });
  put('status.txt', cmdLines.length ? cmdLines.join('\n\n') : `（无命令输出；AC=${c.ac}）`);

  return files;
}

export function countLines(textValue, re) {
  return String(textValue).split('\n').filter((l) => re.test(l)).length;
}

// ---------------------------------------------------------------- 核心收尾

/** 独立项目根下跑 orch core stop（空根返回「核心未在运行」exit 0）。 */
export function coreStop(root) {
  return runCmd([NODE, ORCH, 'core', 'stop'], { cwd: root, timeout: 30000, label: 'orch core stop' });
}

/** 兜底：core.json 里还活着的 pid 就 taskkill（Windows）。 */
export async function forceKillCore(root) {
  const meta = readJson(path.join(root, '.orch', 'core.json')) ?? {};
  const pid = meta.pid;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  const probe = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true });
  if (!String(probe.stdout ?? '').includes(String(pid))) return false;
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  await sleep(200);
  return true;
}
