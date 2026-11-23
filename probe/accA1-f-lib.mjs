// A1 验收脚手架 —— 常量与底层工具（只读产品：不改 src/**、test/**、bin/**、需求）。
// 纪律：每条 AC 一个 os.tmpdir() 独立项目根；NODE_ENV=test；原始帧一律落盘 evidence/。
// A1 是 CLI 命令面，不启 core 进程、不照搬 acc3 的 driver/core 逻辑。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLI_DISCOVERY_TEXT as T } from '../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO = path.resolve(HERE, '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-A1', 'requirement.md');
export const BASE = path.join(os.tmpdir(), 'maestro-acc-a1');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-A1', 'evidence');
export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-A1', 'acceptance-fixture.md');
export const BLOCKERS = path.join(REPO, 'docs', 'iterations', 'iteration-A1', 'blockers.md');
export const PARTS = path.join(REPO, 'probe', 'accA1-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'accA1-f-results.jsonl');
export const SUMMARY = path.join(REPO, 'probe', 'accA1-f-summary.json');

// 三态证据分级：文案逐字取 CLI_DISCOVERY_TEXT（附录 A-7 / NF-3）。
export const EVIDENCE_LEVELS = Object.freeze({
  mock: T.EVIDENCE_LEVEL_MOCK,
  pending: T.EVIDENCE_LEVEL_PENDING,
  real: T.EVIDENCE_LEVEL_REAL
});
export const VERDICTS = Object.freeze({ PASS: '通过', FAIL: '不通过', BLOCK: '阻塞' });

/** 三态文案，未识别一律落「待本机实测」（AD-08：观测不到不判通过）。 */
export function evidenceLevel(tag) {
  if (tag === 'real' || tag?.realHost === true) return T.EVIDENCE_LEVEL_REAL;
  if (tag === 'mock' || tag?.mock === true) return T.EVIDENCE_LEVEL_MOCK;
  return T.EVIDENCE_LEVEL_PENDING;
}

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
 * 基线环境：强制 NODE_ENV=test，清掉宿主注入残留，extra 覆盖在最后。
 * 注意：PATH/HOME 默认保留；需要隔离来源的 AC 自行用 extra 注入（P-2/P-3）。
 */
export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const k of ['ELECTRON_RUN_AS_NODE', 'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN',
    'MAESTRO_DSH_ARGS', 'DSH_HOME', 'MAESTRO_TEST_PAUSE', 'MAESTRO_FAULT']) delete env[k];
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  env.NODE_ENV = 'test';
  return env;
}

/** 统一命令结果：exitCode / stdout / stderr / durationMs / timedOut。 */
export function runCmd(argv, { cwd = REPO, env = baseEnv(), timeout = 60000, label = null } = {}) {
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

/** 子进程级 orch cli 命令（用户可见操作面，P-1）：自动前置 cli 子命令。 */
export function orch(root, args, opts = {}) {
  const full = ['cli', ...args];
  return runCmd([NODE, ORCH, ...full], {
    cwd: root, ...opts, label: opts.label ?? `orch cli ${args.join(' ')}`
  });
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
export function countLines(textValue, re) {
  return String(textValue).split('\n').filter((l) => re.test(l)).length;
}
export function sha256File(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; }
}
export function fileInfo(file) {
  try {
    const st = fs.statSync(file);
    return { path: file, exists: true, bytes: st.size, sha256: sha256File(file) };
  } catch { return { path: file, exists: false, bytes: 0, sha256: null }; }
}
export function text(res) { return `${res?.stdout ?? ''}${res?.stderr ?? ''}`; }
export function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }

/**
 * A1 证据落盘：每条 AC 至少 5 个文件（stdout 原始帧 / output.json / registry.json /
 * mid.json 中间态 / meta.json），命名 AC-XX.<阶段>.<类型>。原始帧逐字保留，不写「已确认」。
 * - c.registryDoc 可覆盖最终 registry（注入接缝类 AC 用）；
 * - c.mid 提供中间态快照（探测前/重扫前/注入结果），由用例显式写入；
 * - c.snap(label, data) 落额外阶段快照。
 */
export function saveEvidence(c, extra = {}) {
  ensureDir(EVID);
  const phase = c.phase || 'flow';
  const root = c.roots?.[0] ?? null;
  const registryDoc = c.registryDoc ?? (root
    ? readJson(path.join(root, '.orch', 'cli-registry.json')) : null);
  const cmds = c.commands ?? [];

  const stdoutDoc = cmds.map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return [
      `$ ${argv}`,
      `# cwd=${cmd.cwd ?? '-'} exit=${cmd.exitCode ?? '-'} ${cmd.durationMs ?? 0}ms`,
      String(cmd.stdout ?? ''),
      String(cmd.stderr ?? '').trim() ? `--- stderr ---\n${String(cmd.stderr).trim()}` : ''
    ].filter((x) => x !== '').join('\n');
  }).join('\n\n');

  const files = [];
  const put = (name, content) => {
    const p = path.join(EVID, `${c.ac}.${name}`);
    fs.writeFileSync(p, content, 'utf8');
    files.push(p);
    return p;
  };

  put(`${phase}.stdout.txt`, stdoutDoc ? stdoutDoc + '\n' : '（无命令输出）\n');
  put(`${phase}.output.json`, JSON.stringify({ ac: c.ac, commands: cmds, checks: c.checks ?? [] }, null, 2) + '\n');
  put(`${phase}.registry.json`, JSON.stringify(registryDoc, null, 2) + '\n');
  put(`${phase}.mid.json`, JSON.stringify(c.mid ?? { note: '（用例未提供中间态）' }, null, 2) + '\n');

  const meta = {
    ac: c.ac,
    title: c.title ?? null,
    face: c.face ?? 'mock 面',
    phase,
    verdict: c.verdict ?? null,
    evidenceLevel: c.evidenceLevel ?? evidenceLevel('pending'),
    startedAt: c.startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(c.startedAt).getTime(),
    platform: process.platform,
    node: process.version,
    repo: REPO,
    base: BASE,
    env: { NODE_ENV: 'test' },
    roots: (c.roots ?? []).map((r) => ({ case: path.basename(r), path: r })),
    checks: c.checks?.length ?? 0,
    notes: c.notes ?? [],
    evidence: files.map(rel),
    ...extra
  };
  put('meta.json', JSON.stringify(meta, null, 2) + '\n');

  if (Array.isArray(c.evidence)) for (const f of files) if (!c.evidence.includes(f)) c.evidence.push(f);
  return files;
}
