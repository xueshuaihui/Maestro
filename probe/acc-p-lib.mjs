// 验收采集工具（产品命令面）。只读产品，不碰 src/。
// 用途：跑 orch 命令 → 逐行打时间戳 → 落 evidence/{AC-xx.output.txt,state.json,events.jsonl,meta.json}
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const REPO = 'D:/WWW/Maestro';
export const ORCH_ENTRY = path.join(REPO, 'bin', 'orch.js');
export const BASE = path.join(process.env.TEMP ?? 'C:/Users/xuesh/AppData/Local/Temp', 'maestro-acc-p');
export const ROOT = path.join(BASE, 'proj');
export const TASK_CWD = path.join(ROOT, 'demo');
export const DSH_HOME = path.join(BASE, 'dsh-home');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-1', 'evidence');
export const ORCH_CMD = 'node D:/WWW/Maestro/bin/orch.js';

export function orchEnv(extra = {}) {
  return { ...process.env, DSH_HOME: DSH_HOME.replace(/\\/g, '/'), ...extra };
}

/** 启动一次 orch（异步，返回句柄，可中途 kill）。 */
export function startOrch(args, { cwd = ROOT, env = orchEnv(), label = '' } = {}) {
  const startedAt = Date.now();
  const child = spawn(process.execPath, [ORCH_ENTRY, ...args], {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = [];
  const push = (stream) => (chunk) => {
    const text = chunk.toString('utf8');
    const at = Date.now() - startedAt;
    for (const piece of text.split(/\r?\n/)) {
      if (piece.length > 0) lines.push({ at, stream, text: piece });
    }
  };
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => {
    stdout += c.toString('utf8');
    push('stdout')(c);
  });
  child.stderr.on('data', (c) => {
    stderr += c.toString('utf8');
    push('stderr')(c);
  });

  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => {
      resolve({ label, args, argv: [ORCH_CMD, ...args].join(' '), cwd, code, signal, startedAt, endedAt: Date.now(), durationMs: Date.now() - startedAt, stdout, stderr, lines });
    });
  });
  return { child, pid: child.pid, startedAt, lines, done, kill: () => killPid(child.pid) };
}

export async function runOrch(args, opts = {}) {
  const handle = startOrch(args, opts);
  return handle.done;
}

export function killPid(pid) {
  try {
    // 注意：Node 的 spawn 不经过 MSYS 路径转换，这里必须用 /PID 单斜杠（`//PID` 会被 taskkill 拒绝）
    spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function instanceDir(root, id) {
  return path.join(root, '.orch', 'instances', id);
}

export async function readInstanceState(root, id) {
  try {
    const raw = await fsp.readFile(path.join(instanceDir(root, id), 'state.json'), 'utf8');
    return { raw, json: JSON.parse(raw) };
  } catch (err) {
    return { raw: null, json: null, error: String(err?.message ?? err) };
  }
}

export async function readEvents(root, id) {
  try {
    const raw = await fsp.readFile(path.join(instanceDir(root, id), 'events.jsonl'), 'utf8');
    const rows = raw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return { _unparsable: l };
        }
      });
    return { raw, rows };
  } catch (err) {
    return { raw: null, rows: [], error: String(err?.message ?? err) };
  }
}

/** 等某一行的文本满足条件；超时返回 null。 */
export async function waitForLine(handle, predicate, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  let idx = 0;
  while (Date.now() < deadline) {
    for (; idx < handle.lines.length; idx += 1) {
      if (predicate(handle.lines[idx].text)) return handle.lines[idx];
    }
    await sleep(50);
  }
  return null;
}

export async function pidAlive(pid) {
  const r = await runShell('tasklist', ['/FI', `PID eq ${pid}`, '/NH']);
  return r.stdout.includes(String(pid));
}

export function runShell(cmd, args, opts = {}) {
  const startedAt = Date.now();
  const child = spawn(cmd, args, { cwd: opts.cwd ?? ROOT, env: opts.env ?? process.env, windowsHide: true });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c) => (stdout += c.toString('utf8')));
  child.stderr.on('data', (c) => (stderr += c.toString('utf8')));
  return new Promise((resolve) => {
    child.on('close', (code) => resolve({ argv: [cmd, ...args].join(' '), code, stdout, stderr, startedAt, endedAt: Date.now() }));
  });
}

// ---------------------------------------------------------------- 证据落盘

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} ac  'AC-01'
 * @param {object} payload
 *  - steps: [{label, result}]  result 为 runOrch / runShell 的返回
 *  - instanceId
 *  - assertions: [{name, expected, actual, pass}]
 *  - notes: string[]
 *  - extra: {name: content} 额外文件（如 corrupt 前后原文）
 */
export async function writeEvidence(ac, payload) {
  ensureDir(EVID);
  const { steps = [], instanceId = null, assertions = [], notes = [], extra = {} } = payload;

  const chunks = [];
  chunks.push(`# ${ac} 原始输出（采集于 ${new Date().toISOString()}）`);
  chunks.push(`# 项目根：${ROOT}`);
  chunks.push(`# 任务工作目录：${TASK_CWD}`);
  for (const step of steps) {
    const r = step.result ?? {};
    chunks.push('');
    chunks.push(`## ${step.label}`);
    chunks.push(`$ (cwd=${r.cwd ?? ROOT}) ${r.argv ?? ''}`);
    chunks.push(`[started ${new Date(r.startedAt ?? Date.now()).toISOString()}  duration ${r.durationMs ?? '?'}ms  exit ${r.code ?? '?'}${r.signal ? ` signal ${r.signal}` : ''}]`);
    if (Array.isArray(r.lines) && r.lines.length > 0) {
      for (const l of r.lines) chunks.push(`+${String(l.at).padStart(7, ' ')}ms  ${l.text}`);
    } else {
      if (r.stdout) chunks.push(r.stdout.replace(/\s+$/, ''));
      if (r.stderr) chunks.push(`[stderr]\n${r.stderr.replace(/\s+$/, '')}`);
    }
    chunks.push(`[exit ${r.code ?? '?'}]`);
  }
  for (const [name, content] of Object.entries(extra)) {
    chunks.push('');
    chunks.push(`## ${name}`);
    chunks.push(content);
  }
  fs.writeFileSync(path.join(EVID, `${ac}.output.txt`), `${chunks.join('\n')}\n`);

  // state.json / events.jsonl 原样复制（不做任何改写）
  const dir = instanceId ? instanceDir(ROOT, instanceId) : null;
  const statePath = dir ? path.join(dir, 'state.json') : null;
  const eventsPath = dir ? path.join(dir, 'events.jsonl') : null;
  if (statePath && fs.existsSync(statePath)) {
    fs.copyFileSync(statePath, path.join(EVID, `${ac}.state.json`));
  } else {
    fs.writeFileSync(
      path.join(EVID, `${ac}.state.json`),
      `${JSON.stringify({ _absent: true, instanceId, note: '该实例在 .orch/instances 下不存在（本次未产生实例或已被清理）' }, null, 2)}\n`,
    );
  }
  if (eventsPath && fs.existsSync(eventsPath)) {
    fs.copyFileSync(eventsPath, path.join(EVID, `${ac}.events.jsonl`));
  } else {
    fs.writeFileSync(path.join(EVID, `${ac}.events.jsonl`), '');
  }

  const meta = {
    ac,
    instanceId,
    collectedAt: new Date().toISOString(),
    projectRoot: ROOT,
    taskCwd: TASK_CWD,
    dshHome: DSH_HOME,
    node: process.version,
    steps: steps.map((s) => ({
      label: s.label,
      argv: s.result?.argv ?? null,
      cwd: s.result?.cwd ?? null,
      exit: s.result?.code ?? null,
      durationMs: s.result?.durationMs ?? null,
      startedAt: s.result?.startedAt ?? null,
      endedAt: s.result?.endedAt ?? null,
    })),
    assertions,
    notes,
  };
  fs.writeFileSync(path.join(EVID, `${ac}.meta.json`), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

export function lineIndex(lines, predicate) {
  return lines.findIndex((l) => predicate(l.text));
}

export async function stopCore(label = 'core stop') {
  const r = await runOrch(['core', 'stop'], { label });
  return r;
}

export async function corePing() {
  // 用最小脚本问核心是否活着（ensure:false，绝不拉起）
  const r = await runShell(process.execPath, [path.join(REPO, 'probe', 'acc-p-ping.mjs')], { env: orchEnv() });
  try {
    return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
  } catch {
    return { ok: false, raw: r.stdout + r.stderr };
  }
}
