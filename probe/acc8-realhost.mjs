#!/usr/bin/env node
/**
 * I1.8 AC-25 / AC-26 / AC-27 / AC-57 真实宿主取证脚本。
 *
 * 纪律（需求 §3.3#6~#7、BR-48）：
 *  - 不碰用户 `~/.dsh`：`DSH_HOME` 指向 `%TEMP%/maestro-i18-realhost/dsh-home`；
 *    profile 与 `.credentials.yaml` **只读复制**，结束删除隔离目录；
 *    用户 `~/.dsh` 只读 `stat`，前后 mtime 必须相同（AC-57）。
 *  - 项目根一律 `%TEMP%`，不放仓库内（AC-57 第三条机检：仓库 `git status` 不得出现新根）。
 *  - 真实宿主发现走产品自身 `src/adapter/dsh-launch.js::resolveDshLaunch`，不硬编码路径。
 *  - 唯一写入：隔离目录内部 + `docs/iterations/iteration-8/evidence/wp7/**`。
 *  - 任何真实调用失败**如实留帧**，不伪造、不用夹具冒充真实面（NFR-08）。
 *
 * Usage:
 *   node probe/acc8-realhost.mjs [--mode probe|recover] [--keep-home]
 *                                [--timeout-ms 180000] [--out <file>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveDshLaunch } from '../src/adapter/dsh-launch.js';
import { normalizeCapabilities } from '../src/adapter/acp-client.js';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EVID = path.join(REPO, 'docs', 'iterations', 'iteration-8', 'evidence', 'wp7');
export const HOME_ROOT = path.join(os.tmpdir(), 'maestro-i18-realhost');

/** 隔离 profile 的 provider 覆盖：本机凭据是账号路由（deepseek-account）。
 *  必须同时覆盖 `agent-default-model` 与 `acp` 两个条目，只改一处会落到无 key 的 deepseek-official。 */
const PROFILE_PATCH = `# maestro I1.8 AC-25/26/27/57：把默认模型路由指向本机账号凭据
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: deepseek-account
    model: deepseek-flash
- id: acp
  name: "@deepseek-ai/dsh-acp"
  config:
    provider: deepseek-account
    model: deepseek-v4-flash
`;

function arg(name, dflt) {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return argv.includes(`--${name}`) ? true : dflt;
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function saveFrame(name, content) {
  ensureDir(EVID);
  const file = path.join(EVID, name);
  const text = Buffer.isBuffer(content) ? content.toString('utf8') : String(content ?? '');
  if (text.length === 0) throw new Error(`saveFrame: empty frame ${file}`);
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

/** ~/.dsh 只读指纹：mtime(秒) + 目录条目摘要，用于 AC-57「用户目录未被改动」。 */
export function userHomeFingerprint() {
  const dir = path.join(os.homedir(), '.dsh');
  const out = { path: dir, exists: false, mtimeSec: null, entries: [] };
  try {
    const st = fs.statSync(dir);
    out.exists = true;
    out.mtimeSec = Math.floor(st.mtimeMs / 1000);
    out.entries = fs.readdirSync(dir).sort();
  } catch {
    /* 不存在时保留 exists:false */
  }
  return out;
}

/** 隔离 DSH_HOME：profile 只读复制 + patch 层 + 凭据只读复制。 */
export function prepareHome(homeRoot = HOME_ROOT) {
  fs.rmSync(homeRoot, { recursive: true, force: true });
  const dshHome = path.join(homeRoot, 'dsh-home');
  ensureDir(dshHome);
  const srcProfile = path.join(os.homedir(), '.dsh', 'profiles', 'acp');
  const dstProfile = path.join(dshHome, 'profiles', 'acp');
  if (fs.existsSync(srcProfile)) fs.cpSync(srcProfile, dstProfile, { recursive: true });
  ensureDir(dstProfile);
  const patchFile = path.join(dstProfile, 'cordis.patch.yml');
  fs.writeFileSync(patchFile, PROFILE_PATCH, 'utf8');
  const srcCred = path.join(os.homedir(), '.dsh', '.credentials.yaml');
  const dstCred = path.join(dshHome, '.credentials.yaml');
  let copiedCred = false;
  if (fs.existsSync(srcCred)) {
    fs.copyFileSync(srcCred, dstCred);
    copiedCred = true;
  }
  const workspace = ensureDir(path.join(homeRoot, 'workspace'));
  const projectRoot = ensureDir(path.join(homeRoot, 'project'));
  return { homeRoot, dshHome, workspace, projectRoot, copiedCred, profileCopied: fs.existsSync(srcProfile) };
}

export function cleanupHome(homeRoot = HOME_ROOT) {
  // Windows 上刚 SIGKILL 完核心时目录常有瞬时锁（EBUSY / ENOTEMPTY / EPERM），按 wp9 回归的
  // 同一处置重试到 10s，不做无限等待、也不把「删不掉」误报成删掉了。
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      fs.rmSync(homeRoot, { recursive: true, force: true });
      break;
    } catch (err) {
      const transient = err?.code === 'ENOTEMPTY' || err?.code === 'EBUSY' || err?.code === 'EPERM' || err?.code === 'EACCES';
      if (!transient || Date.now() >= deadline) break;
      // 同步退避（同 `test/wp9/i19-regression.test.js` 的 syncSleep）：不在清理里 await。
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150);
    }
  }
  return { removed: !fs.existsSync(homeRoot) };
}

export function childEnv(dshHome, extra = {}) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: dshHome, NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.NODE_ENV; // 真实宿主面不注入 test 语义
  for (const key of ['MAESTRO_TEST_PAUSE', 'MAESTRO_TEST_RECOVERY_HOLD', 'MAESTRO_FAULT', 'MAESTRO_MOCK_CAPS']) delete env[key];
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) env[k] = String(v);
  return env;
}

/** 单个真实宿主进程 + NDJSON(ACP) 分帧；raw 收全部收发帧供取证。 */
export class RealHost {
  constructor(launch, env, cwd, { timeoutMs = 180_000 } = {}) {
    this.launch = launch;
    this.timeoutMs = timeoutMs;
    this.raw = [];
    this.pending = new Map();
    this.nextId = 1;
    this.events = [];
    this.stderr = [];
    this.exited = null;
    this.buf = Buffer.alloc(0);
    this.child = spawn(launch.command, launch.args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.child.stderr.on('data', (c) => {
      const s = String(c);
      this.stderr.push(s);
      if (this.stderr.length > 400) this.stderr.shift();
    });
    this.child.stdout.on('data', (chunk) => this.#feed(chunk));
    this.child.on('exit', (code, signal) => {
      this.exited = { code, signal };
      for (const [, p] of this.pending) p.reject(new Error(`host exited code=${code} signal=${signal}`));
      this.pending.clear();
    });
  }

  #feed(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const nl = this.buf.indexOf(0x0a);
      if (nl < 0) return;
      const line = this.buf.subarray(0, nl).toString('utf8').replace(/\r$/, '');
      this.buf = this.buf.subarray(nl + 1);
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        this.raw.push({ dir: 'in', t: Date.now(), raw: line.slice(0, 4000) });
        continue;
      }
      this.raw.push({ dir: 'in', t: Date.now(), obj });
      this.events.push({ t: Date.now(), obj });
      if (obj.id !== undefined && obj.method === undefined) {
        const p = this.pending.get(obj.id);
        if (p) {
          this.pending.delete(obj.id);
          p.resolve(obj);
        }
      }
    }
  }

  send(msg) {
    this.raw.push({ dir: 'out', t: Date.now(), obj: msg });
    this.child.stdin.write(`${JSON.stringify(msg)}\n`);
    return Date.now();
  }

  request(method, params) {
    const id = this.nextId++;
    const p = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`timeout: ${method}`));
      }, this.timeoutMs);
    });
    this.send({ jsonrpc: '2.0', id, method, params });
    return p;
  }

  async initialize(clientName = 'maestro-acc8-realhost') {
    const res = await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: clientName, version: '0.1.0' },
    });
    return res;
  }

  /** 强杀（SIGKILL / Windows TerminateProcess），模拟 daemon 崩溃，不用 core stop。 */
  async kill() {
    if (this.exited) return this.exited;
    try {
      this.child.kill('SIGKILL');
    } catch {
      /* 已退出 */
    }
    await new Promise((r) => {
      if (this.exited) return r();
      const t = setTimeout(r, 5000);
      this.child.once('exit', () => {
        clearTimeout(t);
        r();
      });
    });
    return this.exited;
  }

  async close() {
    try {
      this.child.stdin.end();
    } catch {
      /* ignore */
    }
    await new Promise((r) => {
      if (this.exited) return r();
      const t = setTimeout(() => {
        try {
          this.child.kill();
        } catch {
          /* ignore */
        }
        r();
      }, 4000);
      this.child.once('exit', () => {
        clearTimeout(t);
        r();
      });
    });
  }
}

/** 宿主发现 + 版本探测（唯一一次短命子进程）。 */
export function discoverHost() {
  const resolved = resolveDshLaunch();
  if (!resolved.ok) return { ok: false, discovery: resolved };
  let version = null;
  try {
    version = String(
      execFileSync(resolved.launch.command, [resolved.launch.bin, '--version'], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        encoding: 'utf8',
        timeout: 60_000,
      }),
    ).trim();
  } catch (err) {
    version = `probe-failed: ${String(err?.message ?? err)}`;
  }
  return {
    ok: true,
    exe: resolved.launch.exe,
    bin: resolved.launch.bin,
    source: resolved.launch.source,
    version,
    hasDshExe: fs.existsSync(path.join(path.dirname(resolved.launch.exe ?? ''), 'dsh.exe')),
  };
}

/** 探针：initialize 的会话能力键集（AC-25 机检主体）。 */
export function capsReport(initializeResult) {
  const caps = normalizeCapabilities(initializeResult);
  const keys = Object.keys(caps.sessionCapabilities ?? {}).sort();
  return {
    keys,
    hasClose: keys.includes('close'),
    hasList: keys.includes('list'),
    hasResume: keys.includes('resume'),
    hasLoad: keys.includes('load'),
    canResume: caps.canResume,
    canLoad: caps.canLoad,
    raw: initializeResult?.result ?? initializeResult,
  };
}

const TINY_PROMPT = '只回复两个字：收到';

/** 真实会话一轮：session/new → session/prompt(极小提示词) → 等 response。 */
export async function tinyTurn(host, cwd, { label = '' } = {}) {
  const rec = { label, sessionId: null, stopReason: null, error: null, firstUpdateMs: null, turnMs: null };
  const created = await host.request('session/new', { cwd, mcpServers: [] });
  if (created.error) {
    rec.error = `session/new: ${JSON.stringify(created.error)}`;
    return rec;
  }
  rec.sessionId = created.result?.sessionId ?? null;
  const promptId = host.nextId++;
  const sentAt = host.send({
    jsonrpc: '2.0',
    id: promptId,
    method: 'session/prompt',
    params: { sessionId: rec.sessionId, prompt: [{ type: 'text', text: TINY_PROMPT }] },
  });
  const done = await new Promise((resolve) => {
    const deadline = Date.now() + host.timeoutMs;
    const tick = () => {
      const hit = host.events.find((ev) => ev.obj.id === promptId && ev.obj.method === undefined);
      if (hit) return resolve(hit.obj);
      if (Date.now() > deadline || host.exited) return resolve(null);
      setTimeout(tick, 50);
    };
    tick();
  });
  const firstUpdate = host.events.find((ev) => ev.t >= sentAt && ev.obj.method === 'session/update');
  rec.firstUpdateMs = firstUpdate ? firstUpdate.t - sentAt : null;
  rec.turnMs = Date.now() - sentAt;
  rec.stopReason = done?.result?.stopReason ?? null;
  if (done?.error) rec.error = JSON.stringify(done.error);
  return rec;
}

/* ---------------------------------------------------------------- CLI 模式 */

async function main() {
  const mode = String(arg('mode', 'probe'));
  const keepHome = Boolean(arg('keep-home', false));
  const timeoutMs = Number(arg('timeout-ms', 180_000));
  const outFile = arg('out', null);

  const startedAt = new Date().toISOString();
  const report = {
    ac: ['AC-25', 'AC-26', 'AC-27', 'AC-57'],
    probe: 'acc8-realhost',
    mode,
    startedAt,
    host: null,
    isolatedHome: null,
    userHomeBefore: userHomeFingerprint(),
    caps: null,
    sessions: [],
    resume: null,
    guards: null,
    conclusion: 'BLOCKED_UNCOLLECTED',
    note: '',
  };

  const host = discoverHost();
  report.host = host;
  if (!host.ok) {
    report.note = `宿主发现失败：${JSON.stringify(host.discovery?.params ?? host.discovery)}`;
    return finish(report, { keepHome, outFile });
  }

  const home = prepareHome();
  report.isolatedHome = {
    path: home.dshHome,
    root: home.homeRoot,
    credentialsCopied: home.copiedCred,
    profileCopied: home.profileCopied,
    workspace: home.workspace,
  };
  const launch = resolveDshLaunch();
  const env = childEnv(home.dshHome);

  let h1 = null;
  let h2 = null;
  try {
    h1 = new RealHost(launch.launch, env, home.workspace, { timeoutMs });
    const init = await h1.initialize('maestro-acc8-realhost-1');
    if (init.error) throw new Error(`initialize: ${JSON.stringify(init.error)}`);
    report.caps = capsReport(init);
    const turn = await tinyTurn(h1, home.workspace, { label: 'before-kill' });
    report.sessions.push(turn);
    report.sessionId = turn.sessionId;

    // 强杀宿主（模拟 daemon 崩溃），重启后对同一 sessionId 走 session/resume。
    report.kill = await h1.kill();

    h2 = new RealHost(launch.launch, env, home.workspace, { timeoutMs });
    const init2 = await h2.initialize('maestro-acc8-realhost-2');
    if (init2.error) throw new Error(`initialize#2: ${JSON.stringify(init2.error)}`);
    report.capsAfterRestart = capsReport(init2);
    if (turn.sessionId) {
      const res = await h2.request('session/resume', { sessionId: turn.sessionId, cwd: home.workspace, mcpServers: [] });
      report.resume = { sessionId: turn.sessionId, ok: !res.error, error: res.error ?? null, result: res.result ?? null };
    }
  } catch (err) {
    report.conclusion = 'BLOCKED_REAL_HOST_ERROR';
    report.note = `真实宿主调用失败：${String(err?.message ?? err)}`;
    report.stderrTail = (h1?.stderr ?? []).concat(h2?.stderr ?? []).join('').slice(-8000);
  } finally {
    if (h1) await h1.close().catch(() => {});
    if (h2) await h2.close().catch(() => {});
    report.rawFrames = {
      host1: h1?.raw ?? [],
      host2: h2?.raw ?? [],
    };
  }

  report.userHomeAfter = userHomeFingerprint();
  report.guards = {
    userHomeUntouched:
      report.userHomeBefore.exists === report.userHomeAfter.exists
      && report.userHomeBefore.mtimeSec === report.userHomeAfter.mtimeSec,
    isolatedDirRemoved: keepHome ? 'kept' : null,
  };
  if (!keepHome) {
    report.cleanup = cleanupHome();
    report.guards.isolatedDirRemoved = report.cleanup.removed;
  }
  if (!report.note) report.conclusion = report.resume?.ok ? 'REAL_HOST_RESUME_OK' : 'REAL_HOST_NO_RESUME';
  return finish(report, { keepHome, outFile });
}

function finish(report, { keepHome, outFile }) {
  report.finishedAt = new Date().toISOString();
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outFile) fs.writeFileSync(path.resolve(outFile), text, 'utf8');
  else {
    try {
      saveFrame('AC-57.realhost.probe.json', text);
    } catch {
      /* 证据写入失败不掩盖判定 */
    }
  }
  process.stdout.write(`${JSON.stringify({
    conclusion: report.conclusion,
    hostVersion: report.host?.version ?? null,
    capsKeys: report.caps?.keys ?? null,
    resume: report.resume ?? null,
    guards: report.guards ?? null,
  }, null, 2)}\n`);
  return 0;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  process.exitCode = await main();
}
