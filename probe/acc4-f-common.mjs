// WP-8 / I1.4 验收脚手架 —— 公共工具（独立实现，不 import acc3-*，形态对齐 I1.3）。
// 纪律：每个 AC 一个全新项目根（os.tmpdir()/maestro-acc-p4/<AC>），绝不在仓库目录里跑；
// 只读产品（不改 src/**），所有原始输出落 docs/iterations/iteration-4/evidence/。
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
export const MOCK_AGENT = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const CALL_SEAM = path.join(REPO, 'test', 'fixtures', 'call-seam.mjs');
export const PURITY_CHECK = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');
export const CODE_DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
export const LEGACY_V1 = path.join(REPO, 'test', 'fixtures', 'legacy-v1');
export const TASK_SCEN_DIR = path.join(REPO, 'test', 'fixtures', 'scenarios', 'task-loop');
export const REQUIREMENT = path.join(REPO, 'docs', 'iterations', 'iteration-4', 'requirement.md');

export const BASE = path.join(os.tmpdir(), 'maestro-acc-p4');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-4', 'evidence');
export const REPORT = path.join(REPO, 'docs', 'iterations', 'iteration-4', 'acceptance-fixture.md');
export const REPORT_MD = path.join(REPO, 'docs', 'iterations', 'iteration-4', 'report.md');
export const PARTS = path.join(REPO, 'probe', 'acc4-f-parts');
export const RESULTS = path.join(REPO, 'probe', 'acc4-f-results.jsonl');
export const SUMMARY = path.join(REPO, 'probe', 'acc4-f-summary.json');

export const CODE_TASK = '实现 calc.js，产物：calc.js';
export const DOC_TASK = '写发布说明，产物：release-notes.md';
export const SINGLE_TASK = '写下说明';

// ---------------------------------------------------------------- 本地场景夹具（零仓库污染）
//
// task-loop 的场景表固定从 REPO/test/fixtures/scenarios/task-loop/<name>.json 读取。
// 验收禁止把临时夹具写进仓库，所以用「相对场景名」把自定义场景文件落在临时项目根的
// .mock/ 下：name 里带 ../..，getTaskScenario 的 path.join 会归一到该临时文件。
// 已实测：投递重试（promptFailures）等自定义步字段完全生效。

/** 在 <root>/.mock/ 写一份 task-loop 场景，返回可传给 --scenario 的相对名。 */
export function writeLocalTaskScenario(root, name, steps) {
  const mockDir = path.join(root, '.mock');
  ensureDir(path.join(mockDir, 'prompts'));
  ensureDir(path.join(mockDir, 'history'));
  fs.writeFileSync(path.join(mockDir, `${name}.json`),
    JSON.stringify({ name, steps }, null, 2) + '\n', 'utf8');
  const rel = path.relative(TASK_SCEN_DIR, mockDir);
  return path.join(rel, name).split(path.sep).join('/');
}

/** 用临时根内的自定义 task-loop 场景跑完一轮（同步）。 */
export function runLocalTaskScene(root, {
  name, steps, task = DOC_TASK, cwd = 'demo', env = {}, timeout = 120000,
} = {}) {
  const scenario = writeLocalTaskScenario(root, name, steps);
  prepareScene(root, { scenario, suite: 'task-loop', cwd });
  const args = ['run', '--cwd', `./${cwd}`, '--task', task, '--template', 'task-loop'];
  return orch(root, args, { env: baseEnv(env), timeout, label: `orch run task-loop ${name}` });
}

/** 构造「第 2 步投递失败 N 次」的通用 task-loop 场景步。 */
export function retrySteps(failures) {
  return [
    { nodeId: 'T-001', round: 1, artifact: 'artifacts/reports/research-notes.v1.md', content: '# 研究笔记\n\n背景与约束。\n' },
    { nodeId: 'T-002', round: 1, artifact: 'artifacts/docs/release-notes.v1.md', content: '# 发布说明 v1\n\n背景与变更。\n', ...(failures ? { promptFailures: failures } : {}) },
    { nodeId: 'T-003', round: 1, review: { decision: 'pass', artifact: 'artifacts/docs/release-notes.v1.md', defects: [], revisionRequirement: '' } },
  ];
}

// ---------------------------------------------------------------- 观察工具

export function wsDir(root, id = 'INST-001') { return workspacePath(root, id); }

export function readPrompts(root) {
  const dir = path.join(root, '.mock', 'prompts');
  const out = {};
  try {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      out[f] = readJson(path.join(dir, f));
    }
  } catch { /* 无 prompts */ }
  return out;
}

export function readInboxAll(root) {
  const base = path.join(root, '.orch', 'inbox');
  const out = {};
  try {
    for (const iid of fs.readdirSync(base)) {
      const dp = path.join(base, iid);
      for (const f of fs.readdirSync(dp).filter((x) => x.endsWith('.json'))) {
        out[`${iid}/${f}`] = readJson(path.join(dp, f));
      }
    }
  } catch { /* 无 inbox */ }
  return out;
}

export function readAttemptFiles(root, dir = null) {
  const d = dir ?? path.join(root, '.mock');
  const out = {};
  try {
    for (const f of fs.readdirSync(d).filter((x) => /^prompt-(attempts|failures)-/.test(x))) {
      out[f] = readJson(path.join(d, f));
    }
  } catch { /* 无计数文件 */ }
  return out;
}

export function readMockMarkers(root) {
  const d = path.join(root, '.mock');
  const out = {};
  try {
    for (const f of fs.readdirSync(d)) {
      if (/\.json$/.test(f) && /^(cursor|exhausted|history-leak|bad-|stopped-after|dispatch-failed)/.test(f)) {
        out[f] = readJson(path.join(d, f));
      }
      if (/^(paused|release|exhausted|history-leak)$/.test(f)) out[`${f}.marker`] = true;
    }
  } catch { /* 无标记 */ }
  return out;
}

/** 每个暂停周期推进前清掉上一轮 release/paused，避免直接放行。 */
export function purgePauseMarkers(root) {
  for (const f of ['paused', 'release']) {
    try { fs.rmSync(path.join(root, '.mock', f), { force: true }); } catch { /* ignore */ }
  }
}

/** A-6 工作区上下文的四行（入口只取前三行）。 */
export function wsContextLines(root, id, nodeId, upNodeId = null) {
  const ws = workspacePath(root, id);
  const arr = [
    `工作区：${ws}`,
    `共享区（只读）：${ws}/shared`,
    `本节点阶段区：${ws}/stage/${nodeId}`,
  ];
  if (upNodeId) arr.push(`上游阶段区（只读）：${ws}/stage/${upNodeId}`);
  return arr;
}

/** 去掉易变片段（会话号 / 时间戳 / 耗时秒数）后比较两段输出是否逐字一致。 */
export function normalizeVolatile(t) {
  return String(t ?? '')
    .replace(/mock-sess-\d+-\d+/g, 'mock-sess-<sid>')
    .replace(/\d{2}:\d{2}:\d{2}/g, '<time>')
    .replace(/耗时 \d+s/g, '耗时 <n>s')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<iso>')
    .replace(/\r/g, '');
}

export const PATHS = {
  REPO, BASE, EVID, REPORT, PARTS, RESULTS, SUMMARY, REQUIREMENT,
  ORCH, MOCK_AGENT, CALL_SEAM, PURITY_CHECK, TASK_SCEN_DIR,
};

// ---------------------------------------------------------------- 基础工具

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** 每个 AC 一个干净根；名字直接用 AC 号。 */
export function freshRoot(name) {
  const root = path.join(BASE, name);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  return root;
}

/**
 * 基线环境：强制 NODE_ENV=test（MAESTRO_TEST_* / MAESTRO_FAULT 只在测试模式生效），
 * 清掉 DSH / ELECTRON / I1.2 注入残留，extra 覆盖在最后。
 */
export function baseEnv(extra = {}) {
  const env = { ...process.env };
  for (const k of [
    'ELECTRON_RUN_AS_NODE', 'MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'DSH_HOME',
    'MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_STOP_AFTER', 'MAESTRO_FAULT', 'MAESTRO_PERMISSION_POLICY',
  ]) delete env[k];
  env.NODE_ENV = 'test';
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null) env[k] = String(v);
  env.NODE_ENV = 'test';
  return env;
}

/** 统一命令结果：exitCode / stdout / stderr / durationMs / timedOut。 */
export function runCmd(argv, { cwd = REPO, env = baseEnv(), timeout = 120000, label = null } = {}) {
  const started = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, env, timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal === 'SIGTERM');
  return {
    label, argv, cwd, exitCode: r.status, signal: r.signal ?? null,
    stdout: r.stdout ?? '', stderr: r.stderr ?? '', timedOut, durationMs: Date.now() - started,
  };
}

export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH, ...args], {
    cwd: root, ...opts, label: opts.label ?? `orch ${args.join(' ')}`,
  });
}

export function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
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
export function statusMdPath(root, id = 'INST-001') {
  return path.join(workspacePath(root, id), 'status.md');
}
export function inboxPath(root, id, handoffId) {
  return path.join(root, '.orch', 'inbox', id, `${handoffId}.json`);
}
export function readState(root, id = 'INST-001') { return readJson(statePath(root, id)); }
export function readEvents(root, id = 'INST-001') {
  try {
    return fs.readFileSync(eventsPath(root, id), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}
export function readStatusMd(root, id = 'INST-001') {
  try { return fs.readFileSync(statusMdPath(root, id), 'utf8'); } catch { return null; }
}
export function readInbox(root, id, handoffId) { return readJson(inboxPath(root, id, handoffId)); }
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

// ---------------------------------------------------------------- 现场准备 / mock host

/**
 * 备现场：写 .mock/cursor.json 与 <root>/.orch/hosts/dsh.json（默认 hostId='dsh'）。
 * scenario=null 时 mock 走非场景模式（不写 --root/--scenario），供 --approval hold /
 * --host-error 等 I1.1 开关使用。
 */
export function prepareScene(root, { scenario = null, suite = null, mockArgs = [], cwd = 'demo' } = {}) {
  for (const d of ['.mock/prompts', '.mock/history', '.orch/hosts', cwd]) ensureDir(path.join(root, d));
  fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), JSON.stringify({ next: 1 }), 'utf8');
  const args = [MOCK_AGENT];
  if (scenario) args.push('--root', root, '--scenario', scenario);
  if (suite) args.push('--suite', suite);
  args.push(...mockArgs);
  fs.writeFileSync(path.join(root, '.orch', 'hosts', 'dsh.json'), JSON.stringify({
    transport: 'stdio', launch: { command: NODE, args },
  }, null, 2) + '\n', 'utf8');
  return { root, host: path.join(root, '.orch', 'hosts', 'dsh.json'), args };
}

/** 多实例 AC：两次 run 之间重置场景游标（mock 场景是项目根级共享的）。 */
export function resetCursor(root) {
  fs.writeFileSync(path.join(root, '.mock', 'cursor.json'), JSON.stringify({ next: 1 }), 'utf8');
}

/** taskDir（任务目录，orch run --cwd 指的地方）。 */
export function taskDir(root, name = 'demo') { return path.join(root, name); }

/** 在任务目录放一份非空文件（证据 / 产物）。 */
export function putTaskFile(root, rel, content, name = 'demo') {
  const p = path.join(taskDir(root, name), rel);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/** 把 I1.1 旧格式实例（schemaVersion=1）拷进项目根。 */
export function installLegacyV1(root, id = 'OLD-001') {
  const dest = path.join(root, '.orch', 'instances', id);
  ensureDir(dest);
  for (const f of ['state.json', 'events.jsonl']) {
    const src = path.join(LEGACY_V1, id, f);
    if (exists(src)) fs.copyFileSync(src, path.join(dest, f));
  }
  return dest;
}

// ---------------------------------------------------------------- 长驻进程 / 核心回收

const LIVE = new Set();

/** 长驻命令（默认 orch run）：stdout 累积，可等输出片段 / 等状态 / 等标记文件 / 放行。 */
export function launch(root, args, { env = baseEnv(), timeout = 60000 } = {}) {
  const argv = [NODE, ORCH, ...args];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const h = {
    argv, root, child, timeout, stdout: '', stderr: '', exited: false, exitCode: null,
    startedAt: Date.now(),
  };
  LIVE.add(h);
  child.stdout.on('data', (c) => { h.stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => {
    const finish = (code) => { h.exited = true; h.exitCode = code; LIVE.delete(h); resolve(code); };
    child.once('exit', finish);
    child.once('error', () => finish(-1));
  });
  h.output = () => `${h.stdout}${h.stderr}`;
  h.waitOutput = (needle, ms = timeout) => waitUntil(
    () => (typeof needle === 'function' ? needle(h.stdout) : h.stdout.includes(needle)),
    { timeout: ms, label: String(needle).slice(0, 40) },
  );
  h.waitState = (pred, id = 'INST-001', ms = timeout) => waitUntil(() => {
    const s = readState(root, id);
    return s && pred(s) ? s : null;
  }, { timeout: ms, label: 'state' });
  h.waitFile = (rel, ms = timeout) => waitUntil(() => exists(path.join(root, rel)), { timeout: ms, label: rel });
  h.release = () => { fs.writeFileSync(path.join(root, '.mock', 'release'), '', 'utf8'); };
  h.stop = async () => {
    h.release();
    orch(root, ['core', 'stop'], { timeout: 20000 });
    await forceKillCore(root);
    if (!h.exited) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
    await Promise.race([h.done, sleep(5000)]);
  };
  return h;
}

/** core.json 里还活着的 pid 就 SIGKILL（macOS / POSIX）。I1.3 的 taskkill 是 Windows 专用。 */
export async function forceKillCore(root) {
  const meta = readJson(path.join(root, '.orch', 'core.json')) ?? {};
  const pid = meta.pid;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); } catch { return false; }
  try { process.kill(pid, 'SIGKILL'); } catch { return false; }
  await sleep(150);
  return true;
}

export async function killAllLive() {
  for (const h of [...LIVE]) {
    try { h.child.kill('SIGKILL'); } catch { /* ignore */ }
    try { await forceKillCore(h.root); } catch { /* ignore */ }
    LIVE.delete(h);
  }
  await sleep(150);
}

// ---------------------------------------------------------------- 产品命令封装

export function runProduct(root, {
  task = CODE_TASK, cwd = './demo', template = 'code-loop', instance = null,
  approval = null, env = {}, timeout = 120000, host = null,
} = {}) {
  const args = ['run', '--cwd', cwd, '--task', task];
  if (template !== null) args.push('--template', template);
  if (instance) args.push('--instance', instance);
  if (approval) args.push('--approval', approval);
  if (host) args.push('--host', host);
  return orch(root, args, { env: baseEnv(env), timeout, label: `orch run ${template} ${instance ?? ''}` });
}

export const statusText = (root, id = 'INST-001', opts = {}) =>
  orch(root, ['status', '--instance', id], opts);
export const statusEvents = (root, id = 'INST-001', opts = {}) =>
  orch(root, ['status', '--instance', id, '--events'], opts);
export const statusAll = (root, opts = {}) => orch(root, ['status'], opts);
export const instanceStatus = (root, id = 'INST-001', opts = {}) =>
  orch(root, ['instance', 'status', id], opts);
export const instanceLog = (root, id = 'INST-001', format = null, opts = {}) =>
  orch(root, ['instance', 'log', id, ...(format ? ['--format', format] : [])], opts);
export const instanceGraph = (root, id = 'INST-001', format = null, opts = {}) =>
  orch(root, ['instance', 'graph', id, ...(format ? ['--format', format] : [])], opts);
export const escalateList = (root, { instance = null, all = false } = {}, opts = {}) =>
  orch(root, ['escalate', 'list', ...(instance ? ['--instance', instance] : []), ...(all ? ['--all'] : [])], opts);
export const escalateResolve = (root, id, decision, instance = 'INST-001', opts = {}) =>
  orch(root, ['escalate', 'resolve', id, '--decision', decision, '--instance', instance], opts);
export const approve = (root, id, decision, instance = null, opts = {}) =>
  orch(root, ['approve', id, '--decision', decision, ...(instance ? ['--instance', instance] : [])], opts);
export const handoffList = (root, instance = null, opts = {}) =>
  orch(root, ['handoff', 'list', ...(instance ? ['--instance', instance] : [])], opts);
export const handoffShow = (root, id, instance = null, opts = {}) =>
  orch(root, ['handoff', 'show', id, ...(instance ? ['--instance', instance] : [])], opts);
export const workflow = (root, sub, id = 'INST-001', opts = {}) =>
  orch(root, ['workflow', sub, id], opts);
export const cancel = (root, id = 'INST-001', opts = {}) =>
  orch(root, ['cancel', '--instance', id], opts);
export const coreStop = (root, opts = {}) => orch(root, ['core', 'stop'], opts);

/** 解析 `instance graph --format json` 的 stdout（单条 JSON）。 */
export function graphJson(res) {
  try { return JSON.parse(String(res?.stdout ?? '')); } catch { return null; }
}

// ---------------------------------------------------------------- 接缝封装

/** call-seam.mjs 包装：返回 runCmd 结果（stdout 是单行 JSON）。 */
export function seam(root, call, {
  instance = 'INST-001', node = null, mutate = null, reasonCode = null,
  artifactRefs = [], edgeKind = null, round = null, action = null, dryRun = false,
} = {}) {
  const args = ['--root', root, '--call', call];
  if (instance) args.push('--instance', instance);
  if (node) args.push('--node', node);
  if (mutate) args.push('--mutate', mutate);
  if (reasonCode) args.push('--reason-code', reasonCode);
  for (const r of artifactRefs) args.push('--artifact-ref', r);
  if (edgeKind) args.push('--edge-kind', edgeKind);
  if (round !== null && round !== undefined) args.push('--round', String(round));
  if (action) args.push('--action', action);
  if (dryRun) args.push('--dry-run');
  return runCmd([NODE, CALL_SEAM, ...args], { cwd: root, label: `call-seam ${call} ${mutate ?? action ?? reasonCode ?? ''}` });
}
export function seamJson(res) {
  try { return JSON.parse(String(res?.stdout ?? '').trim().split('\n').at(-1)); } catch { return null; }
}
export const delivery = (root, action, instance = 'INST-001') =>
  seam(root, 'test.delivery', { instance, action });
export const whenDeliveryHeld = (root) => seam(root, 'test.delivery.whenHeld', { instance: null });

/**
 * attach：spawn orch attach → 收首屏 → SIGINT → 收尾行。返回 { stdout, exitCode }。
 * 会话号由调用方给（orch run 的「会话已创建」行 / instance log json 的 objectId）。
 */
export async function attachHold(root, sessionId, ms = 3000) {
  const argv = [NODE, ORCH, 'attach', sessionId];
  const child = spawn(argv[0], argv.slice(1), {
    cwd: root, env: baseEnv(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => { stdout += c.toString('utf8'); });
  child.stderr.on('data', (c) => { stderr += c.toString('utf8'); });
  const done = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  const seen = await waitUntil(() => stdout.includes('已附着会话') || stdout.includes('未找到会话'), { timeout: ms });
  await sleep(300);
  try { child.kill('SIGINT'); } catch { /* ignore */ }
  const code = await Promise.race([done, sleep(ms).then(() => -9)]);
  if (code === -9) { try { child.kill('SIGKILL'); } catch { /* ignore */ } }
  return { label: `orch attach ${sessionId}`, argv, cwd: root, exitCode: code,
    stdout, stderr, timedOut: false, durationMs: ms, seen: Boolean(seen) };
}

// ---------------------------------------------------------------- 状态读取 helper

export const nodeOf = (state, id) => (state?.nodes ?? []).find((n) => n.nodeId === id) ?? null;
export const handoffOf = (state, id) => (state?.handoffs ?? []).find((h) => h.handoffId === id) ?? null;
export const escalationOf = (state, i = 0) => (state?.escalations ?? [])[i] ?? null;
export const approvalOf = (state, id) => (state?.approvals ?? []).find((a) => a.approvalId === id) ?? null;
export const eventsOf = (events, pred) => (events ?? []).filter(pred);
export const reasonsOf = (events) => (events ?? []).map((e) => e.reason);
export const text = (res) => `${res?.stdout ?? ''}${res?.stderr ?? ''}`;
export const lines = (t) => String(t).split('\n');
export const nonEmptyLines = (t) => lines(t).filter((l) => l.trim().length > 0);

/** 会话号：优先从 orch run stdout 的「会话已创建 <id>」取，否则从 instance log json 的会话事件取。 */
export function sessionIdFrom(res) {
  const m = /会话已创建\s+(\S+)/.exec(String(res?.stdout ?? ''));
  return m ? m[1] : null;
}
export function sessionIdFromLog(res) {
  try {
    const arr = JSON.parse(String(res?.stdout ?? ''));
    const hit = (arr ?? []).find((e) => e.object === 'session' && typeof e.objectId === 'string');
    return hit?.objectId ?? null;
  } catch { return null; }
}

// ---------------------------------------------------------------- 高级构造 helper

/** 同步跑完一个场景（spawnSync orch run，等它退出）。返回 runCmd 结果。 */
export function runScene(root, {
  scenario, suite = null, mockArgs = [], task = CODE_TASK, template = 'code-loop',
  approval = null, instance = null, env = {}, cwd = 'demo', timeout = 120000, coreStopAfter = false,
} = {}) {
  prepareScene(root, { scenario, suite, mockArgs, cwd });
  const res = runProduct(root, { task, cwd: `./${cwd}`, template, approval, instance, env, timeout });
  if (coreStopAfter) coreStop(root);
  return res;
}

/** 长驻跑一个场景（orch run 不会自己退出：hold / 暂停 / 等审批时用）。 */
export function liveScene(root, {
  scenario, suite = null, mockArgs = [], task = CODE_TASK, template = 'code-loop',
  approval = null, instance = null, env = {}, cwd = 'demo',
} = {}) {
  prepareScene(root, { scenario, suite, mockArgs, cwd });
  const args = ['run', '--cwd', `./${cwd}`, '--task', task];
  if (template !== null) args.push('--template', template);
  if (approval) args.push('--approval', approval);
  if (instance) args.push('--instance', instance);
  return launch(root, args, { env: baseEnv(env), timeout: 60000 });
}

/** 在 after_output:<node> 停住（返回长驻 handle；已等 .mock/paused）。 */
export async function pauseAtOutput(root, nodeId, opts = {}) {
  const h = liveScene(root, { ...opts, env: { ...(opts.env ?? {}), MAESTRO_TEST_PAUSE: `after_output:${nodeId}` } });
  const hit = await h.waitFile('.mock/paused', 30000);
  return { h, paused: Boolean(hit) };
}

/** 一次坏包流程：after_output:T-001 停住 → 注册 mutate → 放行 → 等 run 以挂起收尾。 */
export async function badHandoff(root, mutate, {
  node = 'T-001', extraMutateArgs = {}, scenario = 'pass', task = CODE_TASK,
  template = 'code-loop', beforeRelease = null, env = {},
} = {}) {
  const { h, paused } = await pauseAtOutput(root, node, { scenario, task, template, env });
  const seamRes = seam(root, 'test.handoff', {
    instance: 'INST-001', node, mutate,
    edgeKind: extraMutateArgs.edgeKind ?? null, round: extraMutateArgs.round ?? null,
  });
  if (beforeRelease) await beforeRelease(root);
  h.release();
  await Promise.race([h.done, sleep(40000)]);
  await h.stop();
  return { h, paused, seamRes, stdout: h.stdout, exitCode: h.exitCode };
}

/** 构造一个"实例挂起 + 待处理升级"的现场（rounds-exceeded 跑完，核心仍在）。 */
export function suspendedRounds(root, { instance = null, task = CODE_TASK } = {}) {
  return runScene(root, { scenario: 'rounds-exceeded', task, instance });
}

/** 非场景 single + --approval hold：返回 { h, approvalSeen }，核心仍在、等审批。 */
export async function holdApproval(root, { mockArgs = ['--permission=ask', '--write-ref=note.md'], task = SINGLE_TASK, approval = 'hold' } = {}) {
  prepareScene(root, { scenario: null, mockArgs });
  const args = ['run', '--cwd', './demo', '--task', task];
  if (approval) args.push('--approval', approval);
  const h = launch(root, args, { env: baseEnv(), timeout: 30000 });
  const seen = await h.waitOutput('APR-', 25000);
  return { h, approvalSeen: Boolean(seen) };
}

// ---------------------------------------------------------------- 用例结构

/**
 * 统一用例：{ac,title,face,grade,verdict,checks[],evidence[],notes[],commands[],roots[]}。
 * grade 是证据分级：'已实测（真实宿主）' / 'mock 实测' / '阻塞'。
 * check / block / eq / includes / notIncludes / matches / cmd / snap 与 I1.3 同形。
 */
export function makeCase(ac, { title = '', face = 'mock 夹具面', grade = 'mock 实测', root = null } = {}) {
  return {
    ac, title, face, grade,
    token: currentToken(),
    verdict: null,
    checks: [], evidence: [], notes: [], commands: [], roots: [],
    startedAt: new Date().toISOString(),
    add(r) { if (r && !this.roots.includes(r)) this.roots.push(r); return r; },
    note(msg) { this.notes.push(String(msg)); return this; },
    check(label, ok, actual = null) {
      this.checks.push({
        text: label, ok: Boolean(ok), blocked: false,
        actual: actual === null || actual === undefined ? null : String(actual).slice(0, 4000),
      });
      return Boolean(ok);
    },
    block(label, reason) {
      this.checks.push({ text: label, ok: false, blocked: true, actual: String(reason ?? '无法在夹具上观测').slice(0, 4000) });
      return false;
    },
    eq(label, actual, expected) {
      return this.check(`${label}（期望 ${JSON.stringify(expected)}）`, Object.is(actual, expected), JSON.stringify(actual));
    },
    includes(label, haystack, needle) {
      return this.check(`${label}（期望含 ${JSON.stringify(needle)}）`, String(haystack).includes(needle), String(haystack).slice(0, 3000));
    },
    notIncludes(label, haystack, needle) {
      return this.check(`${label}（期望不含 ${JSON.stringify(needle)}）`, !String(haystack).includes(needle), String(haystack).slice(0, 3000));
    },
    matches(label, haystack, re) {
      return this.check(`${label}（期望匹配 ${re}）`, re.test(String(haystack)), String(haystack).slice(0, 3000));
    },
    cmd(res, label = null) {
      if (!res) return res;
      this.commands.push({
        label: label ?? res.label ?? null, argv: res.argv ?? [], cwd: res.cwd ?? null,
        exitCode: res.exitCode ?? null, timedOut: Boolean(res.timedOut),
        durationMs: res.durationMs ?? 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '',
      });
      return res;
    },
    /** 追加一份「断言时刻」的原始快照（state.live.json）。 */
    snap(root, label) {
      ensureDir(EVID);
      const ids = instanceIds(root);
      const doc = ids.length === 0 ? null
        : ids.length === 1 ? readState(root, ids[0])
          : { instances: ids.map((id) => ({ instanceId: id, state: readState(root, id) })) };
      const p = path.join(EVID, `${this.ac}.${label}.json`);
      fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n', 'utf8');
      this.evidence.push(p);
      return p;
    },
    /** 记录长驻进程输出（exitCode 可能未知）。 */
    keep(label, handle, argv = null) {
      this.commands.push({
        label, argv: argv ?? handle?.argv ?? [], cwd: handle?.root ?? REPO,
        exitCode: handle?.exitCode ?? null, timedOut: false,
        durationMs: Date.now() - (handle?.startedAt ?? Date.now()),
        stdout: handle?.stdout ?? '', stderr: handle?.stderr ?? '',
      });
      return handle;
    },
  };
}

/** 收敛成三档：任一阻塞 → 阻塞；否则全通过且非空 → 通过；其余 → 不通过。 */
export function summarize(c) {
  const checks = c.checks ?? [];
  const blocked = checks.filter((x) => x.blocked);
  const failed = checks.filter((x) => !x.ok && !x.blocked);
  let verdict = '不通过';
  if (checks.length === 0) verdict = '阻塞';
  else if (blocked.length > 0) verdict = '阻塞';
  else if (failed.length === 0) verdict = '通过';
  return {
    verdict, pass: verdict === '通过', total: checks.length,
    ok: checks.filter((x) => x.ok).length, failed, blocked,
  };
}

// ---------------------------------------------------------------- 需求原文

const AC_HEAD_RE = /^#### (AC-\d+)[^\n]*\n([\s\S]*?)(?=^#### AC-\d+|^### )/gm;

function requirementText() {
  try { return fs.readFileSync(REQUIREMENT, 'utf8'); } catch { return ''; }
}
/** 抽取某条 AC 的需求原文 gherkin（Given/When/Then/And/机检/夹具/架构检查 逐字行）。 */
export function requirementLines(ac) {
  const src = requirementText();
  AC_HEAD_RE.lastIndex = 0;
  for (const m of src.matchAll(AC_HEAD_RE)) {
    if (m[1] !== ac) continue;
    const body = m[2];
    const fence = body.match(/```gherkin\n([\s\S]*?)```/);
    const gherkin = fence ? fence[1] : body;
    // AC 正文是「- **Given** … / - **机检：** …」项目符号，不是 gherkin 关键字开头。
    return lines(gherkin).map((l) => l.trim()).filter((l) =>
      /\*\*(Given|When|Then|And|机检|夹具|架构检查|补充)/.test(l)
      || /^(Given|When|Then|And|\*)\b/.test(l));
  }
  return [];
}
export function requirementTitle(ac) {
  const src = requirementText();
  const m = new RegExp(`^#### ${ac} ([^\\n]+)$`, 'm').exec(src);
  return m ? m[1].trim() : '';
}

// ---------------------------------------------------------------- parts / results / evidence

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }
function mdCell(s, n = 240) { return String(s ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').slice(0, n); }

export function ensureParts() { ensureDir(PARTS); }

/** 写 probe/acc4-f-parts/<AC>.md（final 直接拼接这一节）。 */
export function writePart(c) {
  ensureParts();
  const sum = summarize(c);
  const thenLines = requirementLines(c.ac);
  const title = c.title || requirementTitle(c.ac) || '';
  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return `${cmd.label ? `[${cmd.label}] ` : ''}${argv}   | cwd=${cmd.cwd} | exit=${cmd.exitCode ?? '-'} | ${cmd.durationMs ?? 0}ms`;
  });
  const evRows = (c.evidence ?? []).map((f) => `| \`${rel(f)}\` | ${fileInfo(f).bytes} B |`);
  const checkRows = (c.checks ?? []).map((x, i) => {
    const mark = x.blocked ? '阻塞' : x.ok ? '通过' : '不通过';
    const actual = x.actual === null ? '-' : `\`${mdCell(x.actual, 260)}\``;
    return `| ${i + 1} | ${mdCell(x.text, 200)} | ${mark} | ${actual} |`;
  });
  const md = [
    `#### ${c.ac} ${title}`.trim(), '',
    `- 判定：**${sum.verdict}**（核对 ${sum.ok}/${sum.total} 通过${sum.blocked.length ? `，阻塞 ${sum.blocked.length}` : ''}）`,
    `- 验证面：${c.face}`,
    `- 证据分级：${c.grade}`,
    `- 项目根：${c.roots.length ? c.roots.map((r) => '`' + r + '`').join('、') : '（无）'}`,
    `- 实例：${c.roots.flatMap((r) => instanceIds(r)).join('、') || '（无）'}`,
    '', '**① 完整命令（逐条可复跑）**', '', '```', ...(cmdLines.length ? cmdLines : ['（无命令）']), '```', '',
    `> 每条命令 stdout+stderr 全文见 \`${rel(path.join(EVID, `${c.ac}.output.json`))}\`；\`status.txt\` 是可读转录。`, '',
    '**② 需求原文（Given / When / Then / 机检，逐字）**', '', '```gherkin', ...(thenLines.length ? thenLines : ['（未抽取到，见 requirement.md §3.1）']), '```', '',
    '**③ 实测证据文件清单**', '',
    evRows.length ? ['| 文件 | 大小 |', '|---|---|', ...evRows].join('\n') : '（未落盘）', '',
    '**④ 逐项核对表**', '',
    checkRows.length ? ['| # | 核对项 | 结果 | 实测 |', '|---|---|---|---|', ...checkRows].join('\n') : '（无用例核对项）', '',
    `**⑤ 判定**：${sum.verdict}`, '',
    ...(c.notes.length ? ['**备注**', '', ...c.notes.map((n) => `- ${n}`), ''] : []),
    '---', '',
  ].join('\n');
  fs.writeFileSync(path.join(PARTS, `${c.ac}.md`), md, 'utf8');
  return md;
}

/** 追加 probe/acc4-f-results.jsonl（一行一条 AC）。 */
export function appendResult(c) {
  ensureParts();
  const sum = summarize(c);
  fs.appendFileSync(RESULTS, JSON.stringify({
    ac: c.ac, title: c.title || requirementTitle(c.ac), face: c.face, grade: c.grade,
    verdict: sum.verdict, pass: sum.pass, total: sum.total, ok: sum.ok,
    blocked: sum.blocked.map((x) => ({ text: x.text, actual: x.actual })),
    failed: sum.failed.map((x) => ({ text: x.text, actual: x.actual })),
    checks: c.checks.map((x) => ({ text: x.text, ok: x.ok, blocked: Boolean(x.blocked) })),
    evidence: (c.evidence ?? []).map(rel), roots: c.roots, notes: c.notes,
    at: new Date().toISOString(),
  }) + '\n', 'utf8');
  return sum;
}

/** 写 evidence/<AC>.{state.json,events.jsonl,meta.json,output.json,status.txt}。 */
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
    : states.length === 0 ? null : { instances: states };
  const cmdLines = (c.commands ?? []).map((cmd) => {
    const argv = (cmd.argv ?? []).map((a) => (String(a).includes(' ') ? JSON.stringify(a) : a)).join(' ');
    return [
      `$ ${argv}`,
      `# label=${cmd.label ?? '-'} cwd=${cmd.cwd ?? '-'} exit=${cmd.exitCode ?? '-'} ${cmd.durationMs ?? 0}ms`,
      String(cmd.stdout ?? ''),
      String(cmd.stderr ?? '').trim() ? `--- stderr ---\n${String(cmd.stderr).trim()}` : '',
    ].filter((x) => x !== '').join('\n');
  }).join('\n\n');
  const meta = {
    ac: c.ac, title: c.title ?? null, face: c.face ?? null, grade: c.grade ?? null,
    verdict: c.verdict ?? null, startedAt: c.startedAt, finishedAt: new Date().toISOString(),
    durationMs: Date.now() - new Date(c.startedAt).getTime(),
    platform: process.platform, node: process.version, repo: REPO, base: BASE,
    env: { NODE_ENV: 'test' },
    roots: roots.map((r) => ({ case: path.basename(r), path: r })),
    instances: states.map((s) => ({ __root: s.__root, instanceId: s.instanceId, state: s.state?.state })),
    checks: c.checks?.length ?? 0, notes: c.notes ?? [], ...extra,
  };
  const output = { ac: c.ac, title: c.title ?? null, grade: c.grade ?? null,
    verdict: c.verdict ?? null, checks: c.checks ?? [], commands: c.commands ?? [] };
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
  // 原始帧：workspace/status.md（A-1）、.mock/prompts（A-6）、inbox（BR-10）、尝试计数（D-10）。
  const statusMdDoc = {};
  const promptsDoc = {};
  const inboxDoc = {};
  const attemptsDoc = {};
  for (const root of roots) {
    const tag = path.basename(root);
    for (const id of instanceIds(root)) {
      const md = readStatusMd(root, id);
      if (md !== null) statusMdDoc[`${tag}/${id}`] = md;
      const ib = path.join(root, '.orch', 'inbox', id);
      try {
        for (const f of fs.readdirSync(ib).filter((x) => x.endsWith('.json'))) {
          inboxDoc[`${tag}/${id}/${f}`] = readJson(path.join(ib, f));
        }
      } catch { /* ignore */ }
    }
    const pDir = path.join(root, '.mock', 'prompts');
    try {
      for (const f of fs.readdirSync(pDir).filter((x) => x.endsWith('.json')).sort()) {
        promptsDoc[`${tag}/${f}`] = readJson(path.join(pDir, f));
      }
    } catch { /* ignore */ }
    const mDir = path.join(root, '.mock');
    try {
      for (const f of fs.readdirSync(mDir).filter((x) => /^prompt-(attempts|failures)-/.test(x))) {
        attemptsDoc[`${tag}/${f}`] = readJson(path.join(mDir, f));
      }
    } catch { /* ignore */ }
  }
  put('status.md.json', JSON.stringify(statusMdDoc, null, 2) + '\n');
  put('prompts.json', JSON.stringify(promptsDoc, null, 2) + '\n');
  put('inbox.json', JSON.stringify(inboxDoc, null, 2) + '\n');
  put('attempts.json', JSON.stringify(attemptsDoc, null, 2) + '\n');
  if (Array.isArray(c.evidence)) {
    for (const f of files) if (!c.evidence.includes(f)) c.evidence.push(f);
  }
  return files;
}

/** runner 每跑一条 AC 换一次 token；超时/异常兜底接管后旧用例不再写结果。 */
let CASE_TOKEN = Symbol('case');
export function newToken() { CASE_TOKEN = Symbol('case'); return CASE_TOKEN; }
export function currentToken() { return CASE_TOKEN; }

/** 一条 AC 的收尾：evidence → parts → results。返回 summarize 结果。 */
export function finish(c, extra = {}) {
  const sum = summarize(c);
  if (c.token && c.token !== CASE_TOKEN) return sum;
  c.verdict = sum.verdict;
  c.title = c.title || requirementTitle(c.ac);
  saveEvidence(c, { verdict: sum.verdict, ...extra });
  writePart(c);
  appendResult(c);
  return sum;
}

// ---------------------------------------------------------------- case 公共断言 helper
// 说明：第二批 Agent 在 ac21.mjs~ac70.mjs 里可直接复用下面这些函数，全部从
// '../acc4-f-common.mjs' 引入，不需要额外文件（acc4-cases/ 只放模板 + acNN.mjs）。

/** 收尾：停核心（稳定快照）→ 回收 → finish（evidence/parts/results 一次落盘）。 */
export async function conclude(c, roots) {
  const list = Array.isArray(roots) ? roots : [roots];
  for (const r of list) {
    try { c.cmd(coreStop(r), 'orch core stop'); } catch { /* ignore */ }
    try { await forceKillCore(r); } catch { /* ignore */ }
  }
  return finish(c);
}

/** A-1 工作区布局：shared / stage/<node> / status.md。single 时 stage 必须不存在。 */
export function checkWorkspace(c, root, { id = 'INST-001', stages = [], single = false } = {}) {
  const ws = workspacePath(root, id);
  const pj = (...parts) => parts.join('/');
  const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
  c.check('机检：workspace/shared 是目录', exists(pj(ws, 'shared')) && isDir(pj(ws, 'shared')), ws);
  for (const nid of stages) {
    const p = pj(ws, 'stage', nid);
    c.check(`机检：workspace/stage/${nid} 是目录`, isDir(p), p);
  }
  if (single) {
    c.check('机检：single 不出现 stage/ 目录', !exists(pj(ws, 'stage')), pj(ws, 'stage'));
  }
  const md = readStatusMd(root, id);
  c.check('机检：status.md 存在且是可读 Markdown', typeof md === 'string' && md.startsWith('# '), String(md).slice(0, 80));
  return { ws, md };
}

/** A-1 status.md 结构：标题行 + 状态/暂停/任务/工作区 + 节点/交接包/升级/审批段。 */
export function checkStatusMd(c, md, { id = 'INST-001', template = '编码闭环', single = false,
  hasNodes, hasCurrentNode } = {}) {
  // single 默认省略「## 节点」段与「当前节点」行（A-1），显式传值可覆盖。
  const wantNodes = hasNodes !== undefined ? hasNodes : !single;
  const wantCurrent = hasCurrentNode !== undefined ? hasCurrentNode : !single;
  const t = String(md ?? '');
  const matchLine = (key) => (String(t).split('\n').find((l) => l.includes(key)) ?? '').trim();
  c.check('A-1：标题行含实例号与模板名', t.split('\n')[0].includes(id) && t.split('\n')[0].includes(template), t.split('\n')[0]);
  c.check('A-1：含「- 状态：」行', /- 状态：\S/.test(t), matchLine('状态'));
  c.check('A-1：含「- 暂停：」行', /- 暂停：\S/.test(t), matchLine('暂停'));
  c.check('A-1：含「- 任务：」行', /- 任务：/.test(t), matchLine('任务'));
  if (wantCurrent) c.check('A-1：含「- 当前节点：」行', /- 当前节点：/.test(t), matchLine('当前节点'));
  else c.check('A-1：single 不含「当前节点」行', !t.includes('- 当前节点：'), '（应省略）');
  c.check('A-1：含「- 工作区：」绝对路径行', /- 工作区：\//.test(t), matchLine('工作区'));
  c.check('A-1：含「## 节点」段', wantNodes ? t.includes('## 节点') : !t.includes('## 节点'), wantNodes ? '应含' : 'single 应省略');
  c.check('A-1：含「## 交接包」段', t.includes('## 交接包'), '应含');
  c.check('A-1：含「## 升级」段', t.includes('## 升级'), '应含');
  c.check('A-1：含「## 审批」段', t.includes('## 审批'), '应含');
}

/**
 * A-6：逐个提示词的「工作区上下文」段。
 * entry=true 表示入口节点（只三行、无上游行）；bodyHasWorkspace=true 表示模板正文
 * 已含「工作区：」行（task-loop 审核），则末尾只追加后三行且「工作区：」恰好一条。
 */
export function checkA6(c, label, prompts, key, {
  id = 'INST-001', nodeId, upstream = null, entry = false, bodyHasWorkspace = false,
  root,
} = {}) {
  const p = prompts[key];
  const task = String(p?.task ?? '');
  // macOS 上 os.tmpdir() 是 /var/folders/...（符号链接），产品写入的是真实路径
  // /private/var/folders/...；提示词逐字比对必须用 fs.realpathSync 归一。
  const rawWs = workspacePath(root, id);
  let ws = rawWs;
  try { ws = fs.realpathSync(rawWs); } catch { /* 目录不存在时退回原值 */ }
  c.check(`夹具：${label} 提示词存在`, Boolean(p) && typeof p.task === 'string', key);
  c.includes(`夹具：${label} 含「工作区：${ws}」`, task, `工作区：${ws}`);
  c.includes(`夹具：${label} 含共享区只读行`, task, `共享区（只读）：${ws}/shared`);
  c.includes(`夹具：${label} 含本节点阶段区行`, task, `本节点阶段区：${ws}/stage/${nodeId}`);
  if (entry) {
    c.notIncludes(`夹具：${label} 入口不含上游阶段区行`, task, '上游阶段区（只读）');
  } else {
    c.includes(`夹具：${label} 含上游阶段区行`, task, `上游阶段区（只读）：${ws}/stage/${upstream}`);
  }
  if (bodyHasWorkspace) {
    const count = (task.match(/^工作区：/gm) ?? []).length;
    c.eq(`机检：${label} 审核提示词「工作区：」行只有一条`, count, 1);
  }
}

/** 坏包八码公共断言（AC-09~14 复用）：rejectReason / 无 created / 零派发 / 升级。 */
export function checkBadPackage(c, root, { id = 'INST-001', expectCode = 'handoff_invalid' } = {}) {
  const s = readState(root, id);
  const ev = readEvents(root, id);
  const reasons = reasonsOf(ev);
  const hs = s?.handoffs ?? [];
  c.eq('机检：实例挂起 suspended', s?.state, 'suspended');
  c.check('机检：交接包以 rejected 出现', hs.length >= 1 && hs.some((h) => h.state === 'rejected'), JSON.stringify(hs.map((h) => ({ id: h.handoffId, state: h.state }))));
  c.eq('机检：rejectReason === invalid_payload', hs.find((h) => h.state === 'rejected')?.rejectReason, 'invalid_payload');
  c.check('机检：events 有 handoff.rejected', reasons.includes('handoff.rejected'), reasons.join(','));
  c.check('机检：events 有 escalation.created', reasons.includes('escalation.created'), reasons.join(','));
  c.eq('机检：escalations[0].reasonCode', (s?.escalations ?? [])[0]?.reasonCode, expectCode);
  const dispatchCount = reasons.filter((r) => r === 'node.dispatch').length;
  c.eq('机检：node.dispatch 只有入口一条（零新派发）', dispatchCount, 1);
  c.check('机检：handoffs 无 created 记录', !hs.some((h) => h.state === 'created'), JSON.stringify(hs.map((h) => h.state)));
  return { s, ev, reasons, hs };
}

/**
 * 查看类 AC 的 Given 夹具：以一份「真实跑出来的 state.json」为母版，克隆出若干
 * 实例目录并只改写快照数组（escalations / approvals / paused / state 等），用于构造
 * 需求里"两个实例各有一个待处理升级"这类静态前置。所有断言仍然是「真实 CLI 命令
 * 输出」，不是把结论写进 state.json 再读——视图 RPC 逐字段渲染，故伪造通过不成立。
 */
export function cloneState(root, srcId, dstId, mutate) {
  const src = readState(root, srcId);
  const next = JSON.parse(JSON.stringify(src));
  next.instanceId = dstId;
  if (mutate) mutate(next);
  const dir = path.dirname(statePath(root, dstId));
  ensureDir(dir);
  fs.writeFileSync(statePath(root, dstId), JSON.stringify(next, null, 2) + '\n', 'utf8');
  fs.writeFileSync(eventsPath(root, dstId), '', 'utf8');
  return next;
}

/** 就地改写某实例 state.json 的数组字段（用于 A/B/C/D 多状态 Given）。 */
export function mutateState(root, id, mutate) {
  const s = readState(root, id);
  mutate(s);
  fs.writeFileSync(statePath(root, id), JSON.stringify(s, null, 2) + '\n', 'utf8');
  return s;
}

/** 通用升级/审批条目（字段与真实 state.json 逐字一致）。 */
export const escalationRow = (id, instanceId, over = {}) => ({
  escalationId: id, nodeId: 'T-002', round: 2, reasonCode: 'rounds_exceeded',
  reasonDetail: '回流超上限：测试已派发 2 次仍未通过',
  defects: [{ summary: 'div 在除数为 0 时返回 Infinity，未抛错', evidence: 'out/test-log.txt' }],
  state: 'pending', createdAt: '2026-11-08T19:00:00.000Z',
  resolvedAt: null, resolution: null, voidedAt: null,
  instanceId, ...over,
});
export const approvalRow = (id, instanceId, over = {}) => ({
  approvalId: id, instanceId, nodeId: 'T-001', sessionId: 'mock-sess-fix',
  action: 'write', toolCallId: 'call_fix', state: 'pending',
  createdAt: '2026-11-08T19:00:00.000Z', resolvedAt: null, resolution: null, ...over,
});
