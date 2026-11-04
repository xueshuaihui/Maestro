// 夹具面验收公共库（AC-15 ~ AC-26 / NFR-03/04/06）。
// 只做「准备项目根 + 起 orch + 采样 state/events + 落 evidence」，不修改产品代码。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ACC_ROOT = path.join(os.tmpdir(), 'maestro-acc-f');
export const PROJ_ROOT = path.join(ACC_ROOT, 'proj');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-1', 'evidence');
export const ORCH = path.join(REPO, 'bin', 'orch.js');
export const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
export const PROBE = path.join(REPO, 'test', 'fixtures', 'probe-adapter.mjs');
export const ATTEMPT = path.join(REPO, 'test', 'fixtures', 'attempt-transition.mjs');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function rimraf(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // 清理失败不阻断验收
  }
}

/** 建一个独立项目根：<TEMP>/maestro-acc-f/proj/<case>/，并写入夹具宿主配置。 */
export function prepareCase(name, switches = [], { task } = {}) {
  const root = path.join(PROJ_ROOT, name);
  rimraf(root);
  fs.mkdirSync(path.join(root, 'demo'), { recursive: true });
  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  writeHostConfig(root, switches);
  if (typeof task === 'string') fs.writeFileSync(path.join(root, 'TASK.txt'), `${task}\n`, 'utf8');
  return root;
}

export function writeHostConfig(root, switches = []) {
  const cfg = {
    transport: 'stdio',
    launch: {
      command: process.execPath,
      args: [MOCK, ...switches],
    },
  };
  fs.mkdirSync(path.join(root, '.orch', 'hosts'), { recursive: true });
  fs.writeFileSync(path.join(root, '.orch', 'hosts', 'dsh.json'), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  return cfg;
}

export function readState(root, instanceId) {
  const file = path.join(root, '.orch', 'instances', instanceId, 'state.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function statePathOf(root, instanceId) {
  return path.join(root, '.orch', 'instances', instanceId, 'state.json');
}

export function eventsPathOf(root, instanceId) {
  return path.join(root, '.orch', 'instances', instanceId, 'events.jsonl');
}

export function readEvents(root, instanceId) {
  const file = eventsPathOf(root, instanceId);
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      out.push({ __badLine: t });
    }
  }
  return out;
}

export function readEventsRaw(root, instanceId) {
  try {
    return fs.readFileSync(eventsPathOf(root, instanceId), 'utf8');
  } catch {
    return '';
  }
}

/** 跑一条 orch 命令（前台，等退出）。cwd 固定为项目根。 */
export function runOrch(root, args, { env = {}, timeoutMs = 90_000 } = {}) {
  const command = [process.execPath, ORCH, ...args];
  const started = Date.now();
  const res = spawnSync(process.execPath, [ORCH, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });
  return {
    command: command.join(' '),
    cwd: root,
    env: Object.keys(env).length ? env : undefined,
    exitCode: res.status,
    signal: res.signal ?? null,
    elapsedMs: Date.now() - started,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

/** 后台起一条 orch 命令（用于 hold / 长 turn 期间采样）。 */
export function startOrch(root, args, { env = {} } = {}) {
  const command = [process.execPath, ORCH, ...args];
  const child = spawn(process.execPath, [ORCH, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  const rec = {
    command: command.join(' '),
    cwd: root,
    env: Object.keys(env).length ? env : undefined,
    stdout: '',
    stderr: '',
    exitCode: null,
    signal: null,
    startedAt: Date.now(),
    endedAt: null,
  };
  child.stdout.on('data', (d) => {
    rec.stdout += d.toString('utf8');
  });
  child.stderr.on('data', (d) => {
    rec.stderr += d.toString('utf8');
  });
  const done = new Promise((resolve) => {
    child.on('close', (code, signal) => {
      rec.exitCode = code;
      rec.signal = signal ?? null;
      rec.endedAt = Date.now();
      rec.elapsedMs = rec.endedAt - rec.startedAt;
      resolve(rec);
    });
  });
  return { child, done, rec };
}

export async function waitFor(fn, { timeoutMs = 20_000, intervalMs = 40, label = 'condition' } = {}) {
  const t0 = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - t0 > timeoutMs) throw new Error(`等待超时：${label}（${timeoutMs}ms）`);
    await sleep(intervalMs);
  }
}

export async function waitSession(root, instanceId, pred, label) {
  return waitFor(() => {
    const s = readState(root, instanceId);
    return s && s.session && pred(s, s.session) ? s : null;
  }, { label });
}

export async function waitHandoff(root, instanceId, pred, label) {
  return waitFor(() => {
    const s = readState(root, instanceId);
    return s && s.handoff && pred(s.handoff, s) ? s : null;
  }, { label });
}

export function stopCore(root) {
  return runOrch(root, ['core', 'stop'], { timeoutMs: 25_000 });
}

/** 强杀核心（NFR-04），返回 taskkill 的原始结果。 */
export function killCore(root) {
  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(root, '.orch', 'core.json'), 'utf8'));
  } catch {
    return { ok: false, meta: null, output: '未读到 core.json' };
  }
  const res = spawnSync('taskkill', ['/F', '/PID', String(meta.pid)], { encoding: 'utf8' });
  return {
    ok: res.status === 0,
    meta,
    exitCode: res.status,
    output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim(),
  };
}

/** 跑夹具探针（probe-adapter.mjs），返回解析后的一行 JSON。 */
export function runProbe({ switches, observe, cwd, timeoutMs = 30_000 }) {
  const args = [PROBE, '--mock', MOCK, '--switches', switches, '--observe', observe];
  const command = [process.execPath, ...args];
  const res = spawnSync(process.execPath, args, {
    cwd: cwd ?? REPO,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
  });
  let json = null;
  const line = (res.stdout ?? '').trim().split('\n').filter(Boolean).pop() ?? '';
  try {
    json = JSON.parse(line);
  } catch {
    json = null;
  }
  return {
    command: command.join(' '),
    exitCode: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    json,
  };
}

export function runAttemptTransition(root, instanceId, object, from, to) {
  const args = [ATTEMPT, '--root', root, '--instance', instanceId, '--object', object, '--from', from, '--to', to];
  const res = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  return {
    command: [process.execPath, ...args].join(' '),
    exitCode: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

/** state.json 的验收摘要（不复制全量事件，保持可读）。 */
export function stateExcerpt(state) {
  if (!state) return null;
  return {
    schemaVersion: state.schemaVersion,
    instanceId: state.instanceId,
    state: state.state,
    stateSince: state.stateSince,
    updatedAt: state.updatedAt,
    cwd: state.cwd,
    node: state.node
      ? {
          nodeId: state.node.nodeId,
          state: state.node.state,
          startedAt: state.node.startedAt,
          endedAt: state.node.endedAt,
          failure: state.node.failure,
          note: state.node.note,
        }
      : null,
    session: state.session
      ? {
          sessionId: state.session.sessionId,
          hostId: state.session.hostId,
          state: state.session.state,
          stateSince: state.session.stateSince,
          lastEventAt: state.session.lastEventAt,
          toolName: state.session.toolName,
          pendingPermission: state.session.pendingPermission,
          quarantined: state.session.quarantined,
          turnId: state.session.turnId,
        }
      : null,
    handoff: state.handoff
      ? {
          handoffId: state.handoff.handoffId,
          state: state.handoff.state,
          createdAt: state.handoff.createdAt,
          deliveredAt: state.handoff.deliveredAt,
          acceptedAt: state.handoff.acceptedAt,
          consumedAt: state.handoff.consumedAt,
          rejectedAt: state.handoff.rejectedAt,
          rejectReason: state.handoff.rejectReason,
          acceptedSignal: state.handoff.acceptedSignal,
        }
      : null,
    hostRaw: state.hostRaw,
    artifactRefs: state.artifactRefs,
    counters: state.counters,
  };
}

export function pickEvents(events, pred) {
  return events.filter((ev) => (typeof pred === 'function' ? pred(ev) : true));
}

export function ensureEvidenceDir() {
  fs.mkdirSync(EVID, { recursive: true });
}

/**
 * 落 evidence。每个 AC 四份：
 *   <id>.meta.json    场景/开关/判定/证据指针
 *   <id>.output.json  命令原文 + 原始 stdout/stderr + 退出码
 *   <id>.state.json   state.json 摘要（按实例）
 *   <id>.events.jsonl 相关实例的 events.jsonl 原文（逐行原样）
 */
export function saveEvidence(id, { meta, commands = [], states = {}, eventsRaw = {} }) {
  ensureEvidenceDir();
  const files = [];
  const write = (suffix, text) => {
    const file = path.join(EVID, `${id}.${suffix}`);
    fs.writeFileSync(file, text, 'utf8');
    files.push(path.relative(REPO, file).split(path.sep).join('/'));
  };
  write('meta.json', `${JSON.stringify(meta, null, 2)}\n`);
  write('output.json', `${JSON.stringify({ commands }, null, 2)}\n`);
  write('state.json', `${JSON.stringify(states, null, 2)}\n`);
  const blocks = Object.entries(eventsRaw)
    .map(([instanceId, text]) => `# instance ${instanceId}\n${text}`)
    .join('');
  write('events.jsonl', blocks);
  return files;
}

/** 进程自查：列出 node 进程（排除本进程）。 */
export function listNodeProcesses() {
  const res = spawnSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  const lines = `${res.stdout ?? ''}`
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'));
  return lines.map((l) => {
    const cols = l.split('","').map((c) => c.replace(/^"|"$/g, ''));
    return { image: cols[0], pid: Number(cols[1]), mem: cols[4] };
  });
}

export function makeJudgment(checks) {
  const failed = checks.filter((c) => !c.ok);
  return {
    verdict: failed.length === 0 ? '通过' : '不通过',
    checks,
    failed: failed.map((c) => c.id),
  };
}

export function contains(haystack, needle) {
  return typeof haystack === 'string' && haystack.includes(needle);
}
