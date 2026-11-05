// I1.2 夹具面验收探针 —— 公用库（只读产品，不写 src/test/bin）。
// 纪律：所有项目根放 %TEMP%/maestro-acc-f2/proj/<case>/；证据脚本落盘。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

export const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export const NODE = process.execPath;
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');
export const SEAM = path.join(REPO, 'test', 'fixtures', 'call-seam.mjs');
export const TRANSITION = path.join(REPO, 'test', 'fixtures', 'attempt-transition.mjs');
export const BASE = path.join(os.tmpdir(), 'maestro-acc-f2', 'proj');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-2', 'evidence');

export const TASK = '给 calc.js 补一个 div 函数，让 node --test 全绿。\n改动写在 calc.js\n产物：calc.js';

export function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

export function freshRoot(caseName) {
  const root = path.join(BASE, caseName);
  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(path.join(root, 'demo-code-pass'));
  return root;
}

export function baseEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', ...extra };
  delete env.MAESTRO_DSH_EXE;
  delete env.MAESTRO_DSH_BIN;
  delete env.MAESTRO_DSH_ARGS;
  delete env.MAESTRO_TEST_PAUSE;
  delete env.MAESTRO_TEST_STOP_AFTER;
  delete env.MAESTRO_FAULT;
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = v;
  return env;
}

export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function runCmd(argv, { cwd = REPO, env = baseEnv(), timeout = 120000, label = null } = {}) {
  const started = Date.now();
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, env, timeout, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  });
  return {
    label,
    argv,
    cwd,
    exitCode: r.status,
    signal: r.signal ?? null,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM' && r.status === null,
    durationMs: Date.now() - started
  };
}

export function orch(root, args, opts = {}) {
  return runCmd([NODE, ORCH, ...args], { cwd: root, ...opts, label: opts.label ?? `orch ${args.join(' ')}` });
}

export function driver(root, args, opts = {}) {
  return runCmd([NODE, DRIVER, '--root', root, ...args], { cwd: REPO, ...opts, label: opts.label ?? `driver ${args.join(' ')}` });
}

export function out(res) { return `${res.stdout}${res.stderr}`; }

export function statePath(root, id = 'INST-001') { return path.join(root, '.orch', 'instances', id, 'state.json'); }
export function eventsPath(root, id = 'INST-001') { return path.join(root, '.orch', 'instances', id, 'events.jsonl'); }

export function readState(root, id = 'INST-001') {
  try { return JSON.parse(fs.readFileSync(statePath(root, id), 'utf8')); } catch { return null; }
}
export function readEvents(root, id = 'INST-001') {
  try {
    return fs.readFileSync(eventsPath(root, id), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch { return []; }
}
export function eventCount(root, id = 'INST-001') { return readEvents(root, id).length; }

export function sha256File(file) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; }
}

export function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

export function instanceIds(root) {
  try { return fs.readdirSync(path.join(root, '.orch', 'instances')).sort(); } catch { return []; }
}

export async function waitUntil(fn, { timeout = 60000, interval = 100, label = '条件' } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeout) return null;
    await sleep(interval);
  }
}

export function parseSummary(res) {
  const lines = res.stdout.split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try { return JSON.parse(lines[i]); } catch { /* 继续找 */ }
  }
  return null;
}

/** 长驻 driver（--keep）：等标记 / 状态，测试完清理。 */
export function startDriver(root, args, { env = baseEnv() } = {}) {
  const argv = [NODE, DRIVER, '--root', root, ...args];
  const child = spawn(argv[0], argv.slice(1), { cwd: REPO, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const h = {
    argv, root, child,
    stdout: '', stderr: '',
    exited: false, exitCode: null,
    summary: null
  };
  child.stdout.on('data', (c) => {
    h.stdout += c.toString('utf8');
    const lines = h.stdout.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try { const s = JSON.parse(lines[i]); if (s && s.target) { h.summary = s; break; } } catch { /* ignore */ }
    }
  });
  child.stderr.on('data', (c) => { h.stderr += c.toString('utf8'); });
  h.done = new Promise((resolve) => {
    child.once('exit', (code, signal) => { h.exited = true; h.exitCode = code; h.signal = signal; resolve(code); });
    child.once('error', () => { h.exited = true; h.exitCode = -1; resolve(-1); });
  });
  h.waitFile = (name, timeout = 60000) => waitUntil(() => exists(path.join(root, '.mock', name)), { timeout, label: name });
  h.waitState = (pred, timeout = 60000) => waitUntil(() => {
    const s = readState(root);
    return s && pred(s) ? s : null;
  }, { timeout, label: 'state' });
  h.release = () => { ensureDir(path.join(root, '.mock')); fs.writeFileSync(path.join(root, '.mock', 'release'), '', 'utf8'); };
  h.stop = async () => {
    h.release();
    orch(root, ['core', 'stop'], { timeout: 15000 });
    await forceKillCore(root);
    if (!h.exited) {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
    }
    await Promise.race([h.done, sleep(5000)]);
  };
  return h;
}

/** 兜底：core.json 里还有存活 pid 就 taskkill。 */
export async function forceKillCore(root) {
  const coreFile = path.join(root, '.orch', 'core.json');
  let pid = null;
  try { pid = JSON.parse(fs.readFileSync(coreFile, 'utf8')).pid; } catch { return; }
  if (!Number.isInteger(pid) || pid <= 0) return;
  const probe = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8', windowsHide: true });
  if (!String(probe.stdout ?? '').includes(String(pid))) return;
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  await sleep(200);
}

/** 断言收集器。 */
export function makeCase(ac, { face = '夹具', roots = [] } = {}) {
  return {
    ac, face, roots: [...roots],
    assertions: [], commands: [], notes: [], startedAt: new Date().toISOString(),
    add(root) { if (!this.roots.includes(root)) this.roots.push(root); return root; },
    cmd(res, note = null) {
      this.commands.push({
        label: res.label ?? null, argv: res.argv, cwd: res.cwd,
        exitCode: res.exitCode, durationMs: res.durationMs,
        stdout: res.stdout, stderr: res.stderr, note
      });
      return res;
    },
    assert(text, ok, actual = null) {
      this.assertions.push({ text, ok: Boolean(ok), actual: actual === null ? null : String(actual).slice(0, 4000) });
      return Boolean(ok);
    },
    // 便捷断言
    eq(text, actual, expected) { return this.assert(`${text}（期望 ${JSON.stringify(expected)}）`, Object.is(actual, expected), JSON.stringify(actual)); },
    includes(text, haystack, needle) { return this.assert(`${text}（期望包含 ${JSON.stringify(needle)}）`, String(haystack).includes(needle), String(haystack).slice(0, 3000)); },
    notIncludes(text, haystack, needle) { return this.assert(`${text}（期望不含 ${JSON.stringify(needle)}）`, !String(haystack).includes(needle), String(haystack).slice(0, 3000)); },
    matches(text, haystack, re) { return this.assert(`${text}（期望匹配 ${re}）`, re.test(haystack), String(haystack).slice(0, 3000)); }
  };
}

/** 写证据：AC-xx.{meta,output,state,events}。多根时用 __root 哨兵分隔。 */
export function saveEvidence(c, extra = {}) {
  ensureDir(EVID);
  const allStates = [];
  const allEvents = [];
  const multi = c.roots.length > 1;
  for (const root of c.roots) {
    const ids = instanceIds(root);
    for (const id of ids) {
      const st = readState(root, id);
      if (st) allStates.push({ __root: path.basename(root), instanceId: id, state: st });
    }
    const evs = [];
    for (const id of ids) {
      const list = readEvents(root, id);
      for (const e of list) evs.push({ __root: path.basename(root), instanceId: id, ...e });
    }
    if (evs.length > 0) allEvents.push({ __root: path.basename(root), events: evs });
  }

  const meta = {
    ac: c.ac,
    face: c.face,
    startedAt: c.startedAt,
    finishedAt: new Date().toISOString(),
    platform: process.platform,
    node: process.version,
    repo: REPO,
    roots: c.roots.map((r) => ({ case: path.basename(r), path: r })),
    env: { NODE_ENV: 'test' },
    notes: c.notes,
    ...extra
  };

  const output = {
    ac: c.ac,
    face: c.face,
    assertions: c.assertions,
    commands: c.commands
  };

  fs.writeFileSync(path.join(EVID, `${c.ac}.meta.json`), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(EVID, `${c.ac}.output.json`), JSON.stringify(output, null, 2) + '\n', 'utf8');

  if (c.roots.length === 1 && allStates.length === 1) {
    fs.writeFileSync(path.join(EVID, `${c.ac}.state.json`), JSON.stringify(allStates[0].state, null, 2) + '\n', 'utf8');
  } else {
    fs.writeFileSync(path.join(EVID, `${c.ac}.state.json`), JSON.stringify({ instances: allStates }, null, 2) + '\n', 'utf8');
  }

  if (!multi && allEvents.length === 1) {
    fs.writeFileSync(path.join(EVID, `${c.ac}.events.jsonl`), allEvents[0].events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  } else {
    const lines = [];
    for (const block of allEvents) {
      lines.push(JSON.stringify({ __root: block.__root }));
      for (const e of block.events) lines.push(JSON.stringify(e));
    }
    fs.writeFileSync(path.join(EVID, `${c.ac}.events.jsonl`), lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  }

  return { meta, output };
}

export function summarize(c) {
  return {
    ac: c.ac,
    pass: c.assertions.length > 0 && c.assertions.every((a) => a.ok),
    assertions: c.assertions.map((a) => ({ ok: a.ok, text: a.text, actual: a.actual })),
    durationMs: Date.now() - new Date(c.startedAt).getTime()
  };
}

export function countLines(text, re) { return text.split('\n').filter((l) => re.test(l)).length; }
export function lines(text) { return text.split('\n'); }
