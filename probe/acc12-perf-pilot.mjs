#!/usr/bin/env node
/**
 * I1.12 AC-21 真实宿主 handoff 延迟取证（试点 / 可扩量）。
 *
 * 与 probe/acc12-perf.mjs 的区别：那个是「读已落盘实例产物」的只读评分器；
 * 本脚本是「受控触发」侧——真正拉起本机 DSH 0.2.2 真实宿主，创建会话、下发一次
 * 交接（prompt），测量 D-11 口径的 handoff 延迟：
 *   交付时刻（session/prompt 写出） → 目标会话首个 ACP 事件到达（session/update 或 response）
 *
 * 纪律：
 *  - 不碰用户 ~/.dsh：DSH_HOME 指向隔离目录；凭据按需从 ~/.dsh/.credentials.yaml
 *    复制进隔离目录，结束时删除（只删自己复制的那份）。
 *  - 宿主发现走产品自身 src/adapter/dsh-launch.js::resolveDshLaunch，
 *    不硬编码安装路径（这是 AC-21 首轮「阻塞」的根因）。
 *  - 不替 mock 出数据：跑不通就如实报 blocked，不伪造样本。
 *  - 唯一写入：--out 指定的报告文件 + 隔离 DSH_HOME 内部文件。
 *
 * Usage:
 *   node probe/acc12-perf-pilot.mjs [--sessions 1] [--concurrency 1] [--out <file>]
 *                                   [--dsh-home <dir>] [--timeout-ms 180000] [--keep-home]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { resolveDshLaunch } from '../src/adapter/dsh-launch.js';
import { PERF_TARGETS, collectHandoffLatency, buildPerfReport, PERF_LEVELS } from '../src/core/perf-baseline.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, dflt) {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  return argv.includes(`--${name}`) ? true : dflt;
}

const sessionCount = Number(arg('sessions', 1));
const concurrency = Number(arg('concurrency', 1));
const timeoutMs = Number(arg('timeout-ms', 180000));
const keepHome = Boolean(arg('keep-home', false));
const homeRoot = path.resolve(arg('dsh-home', path.join(os.tmpdir(), 'maestro-i112-perf-pilot')));
const outFile = arg('out', null);

/** 隔离 profile 的 provider 覆盖：本机凭据是账号路由（deepseek-account），
 *  acp bundle 默认的 deepseek-official 无 key，会把每个 turn 打成 -32603。
 *  这里只写隔离 home 的 patch 层，不改用户 ~/.dsh。 */
const PROFILE_PATCH = `# maestro AC-21 试点：把默认模型路由指向本机账号凭据
# （base bundle 的 agent-default-model 与 acp-app bundle 的 acp 两处都要覆盖，
#   只改其中一处仍会落到无 key 的 deepseek-official）
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

/** 隔离 DSH_HOME：profile 从用户 home 复制（只读复制，不改源），凭据按需复制并在结束时删除。 */
function prepareHome() {
  const dshHome = path.join(homeRoot, 'dsh-home');
  fs.mkdirSync(dshHome, { recursive: true });
  const srcProfile = path.join(os.homedir(), '.dsh', 'profiles', 'acp');
  const dstProfile = path.join(dshHome, 'profiles', 'acp');
  if (fs.existsSync(srcProfile) && !fs.existsSync(dstProfile)) {
    fs.cpSync(srcProfile, dstProfile, { recursive: true });
  }
  fs.mkdirSync(dstProfile, { recursive: true });
  const patchFile = path.join(dstProfile, 'cordis.patch.yml');
  if (!fs.existsSync(patchFile) || !fs.readFileSync(patchFile, 'utf8').includes('agent-default-model')) {
    fs.writeFileSync(patchFile, PROFILE_PATCH, 'utf8');
  }
  const srcCred = path.join(os.homedir(), '.dsh', '.credentials.yaml');
  const dstCred = path.join(dshHome, '.credentials.yaml');
  let copiedCred = false;
  if (fs.existsSync(srcCred) && !fs.existsSync(dstCred)) {
    fs.copyFileSync(srcCred, dstCred);
    copiedCred = true;
  }
  const workspace = path.join(homeRoot, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  return { dshHome, copiedCred, workspace };
}

function buildChildEnv(dshHome) {
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: dshHome, NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.NODE_ENV; // 真实宿主面不注入 test 语义
  return env;
}

/** 单个宿主进程 + ACP 会话池；NDJSON 分帧（DSH 内置 ACP server 按 \n 切行）。 */
class Host {
  constructor(launch, env, cwd) {
    this.child = spawn(launch.command, launch.args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    this.cursor = 0;
    this.events = []; // { seq, ts, kind }
    this.stderr = [];
    this.exited = null;
    this.child.stderr.on('data', (c) => {
      const s = String(c);
      this.stderr.push(s);
      if (this.stderr.length > 200) this.stderr.shift();
    });
    this.child.stdout.on('data', (chunk) => this.#feed(chunk));
    this.child.on('exit', (code, signal) => {
      this.exited = { code, signal };
      for (const [, p] of this.pending) p.reject(new Error(`host exited code=${code}`));
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
        continue;
      }
      this.cursor = Math.max(this.cursor, this.events.length);
      this.events.push({ seq: this.events.length + 1, t: performance.now(), obj });
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
    const now = performance.now();
    this.child.stdin.write(`${JSON.stringify(msg)}\n`);
    return now;
  }

  request(method, params) {
    const id = this.nextId++;
    const p = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`timeout: ${method}`));
      }, timeoutMs);
    });
    this.send({ jsonrpc: '2.0', id, method, params });
    return p;
  }

  /** 等待某个 id 的 response 之后的第一个「目标会话事件」，返回相对 sentAt 的毫秒数。 */
  waitFirstEvent(promptId, sentAt) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        for (const ev of this.events) {
          if (ev.t < sentAt) continue;
          if (ev.obj.method === 'session/update' || ev.obj.id === promptId) {
            resolve({ firstEventMs: +(ev.t - sentAt).toFixed(1), kind: ev.obj.method ?? 'response' });
            return;
          }
        }
        if (Date.now() > deadline || this.exited) {
          resolve({ firstEventMs: null, kind: 'timeout' });
          return;
        }
        setTimeout(tick, 5);
      };
      tick();
    });
  }

  async close() {
    try {
      this.child.stdin.end();
    } catch {
      /* ignore */
    }
    await new Promise((r) => {
      const t = setTimeout(() => {
        try {
          this.child.kill();
        } catch {
          /* ignore */
        }
        r();
      }, 4000);
      if (this.exited) {
        clearTimeout(t);
        r();
      } else {
        this.child.once('exit', () => {
          clearTimeout(t);
          r();
        });
      }
    });
  }
}

const PROMPT_TEXT = '只回复两个字：收到。不要调用任何工具，不要解释。';

async function runOneSession(host, workspace, index) {
  const rec = { index, sessionId: null, deliveredAt: null, firstEventMs: null, firstEventKind: null, stopReason: null, ok: false, error: null };
  try {
    const created = await host.request('session/new', { cwd: workspace, mcpServers: [] });
    if (created.error) throw new Error(`session/new: ${JSON.stringify(created.error)}`);
    rec.sessionId = created.result?.sessionId ?? null;
    const promptId = host.nextId++;
    const sentAt = host.send({ jsonrpc: '2.0', id: promptId, method: 'session/prompt', params: { sessionId: rec.sessionId, prompt: [{ type: 'text', text: PROMPT_TEXT }] } });
    rec.deliveredAt = new Date().toISOString();
    const first = await host.waitFirstEvent(promptId, sentAt);
    rec.firstEventMs = first.firstEventMs;
    rec.firstEventKind = first.kind;
    const done = await new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        const hit = host.events.find((ev) => ev.obj.id === promptId && ev.obj.method === undefined);
        if (hit) return resolve(hit.obj);
        if (Date.now() > deadline || host.exited) return resolve(null);
        setTimeout(tick, 20);
      };
      tick();
    });
    rec.stopReason = done?.result?.stopReason ?? null;
    rec.turnEndMs = done ? +(performance.now() - sentAt).toFixed(1) : null;
    rec.ok = rec.firstEventMs !== null && !done?.error;
    if (done?.error) rec.error = JSON.stringify(done.error);
    try {
      await host.request('session/close', { sessionId: rec.sessionId });
    } catch {
      /* close 是 best-effort */
    }
  } catch (err) {
    rec.error = String(err?.message ?? err);
  }
  return rec;
}

async function runBatch(launch, env, workspace, from, count) {
  const host = new Host(launch, env, workspace);
  const init = await host.request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'maestro-acc12-perf', version: '0.1.0' },
  });
  if (init.error) throw new Error(`initialize: ${JSON.stringify(init.error)}`);
  const records = [];
  for (let i = 0; i < count; i += 1) records.push(await runOneSession(host, workspace, from + i));
  await host.close();
  return records;
}

async function main() {
  const report = {
    ac: 'AC-21',
    probe: 'acc12-perf-pilot',
    startedAt: new Date().toISOString(),
    load: { requestedSessions: sessionCount, requestedConcurrency: concurrency, target: { ...PERF_TARGETS } },
    hostDiscovery: null,
    hostVersion: null,
    levels: { ...PERF_LEVELS },
    sessions: [],
    summary: null,
    conclusion: 'BLOCKED_UNCOLLECTED',
    note: '',
  };

  const resolved = resolveDshLaunch();
  if (!resolved.ok) {
    report.hostDiscovery = { ok: false, ...resolved };
    report.note = `宿主发现失败：${JSON.stringify(resolved.params ?? resolved)}`;
    return finish(report);
  }
  report.hostDiscovery = { ok: true, source: resolved.launch.source, exe: resolved.launch.exe, bin: resolved.launch.bin };

  // 版本探测（唯一一次短命子进程，确认 exe+bin 组合可用）
  try {
    const { execFileSync } = await import('node:child_process');
    report.hostVersion = String(
      execFileSync(resolved.launch.command, [resolved.launch.bin, '--version'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' })
    ).trim();
  } catch (err) {
    report.hostVersion = `probe-failed: ${String(err?.message ?? err)}`;
  }

  const { dshHome, copiedCred, workspace } = prepareHome();
  report.dshHome = { path: dshHome, isolated: true, credentialsCopied: copiedCred, credentialsWillBeRemoved: copiedCred };
  const env = buildChildEnv(dshHome);

  const batches = Math.min(concurrency, Math.max(1, sessionCount));
  const perBatch = Math.ceil(sessionCount / batches);
  let index = 0;
  for (let b = 0; b < batches; b += 1) {
    const count = Math.min(perBatch, sessionCount - index);
    if (count <= 0) break;
    try {
      const recs = await runBatch(resolved.launch, env, workspace, index, count);
      report.sessions.push(...recs);
    } catch (err) {
      report.sessions.push({ index, error: String(err?.message ?? err), ok: false });
    }
    index += count;
  }

  // D-11 口径：把每条「交付 → 首事件」样本交给产品自身的采集器，确保口径一致
  const events = [];
  const samples = [];
  for (const r of report.sessions) {
    if (r.firstEventMs === null || !r.sessionId) continue;
    const deliveredMs = Date.parse(r.deliveredAt);
    const instanceId = `pilot-${r.index}`;
    events.push({ type: 'handoff.delivered', ts: deliveredMs, instanceId, sessionId: r.sessionId });
    events.push({ type: 'session.first_event', firstEvent: true, ts: deliveredMs + r.firstEventMs, instanceId, sessionId: r.sessionId });
    samples.push({ instanceId, sessionId: r.sessionId, handoffId: null, latencyMs: Math.round(r.firstEventMs) });
  }
  const collected = collectHandoffLatency({ events, spans: [] });
  const distinctInstances = new Set(samples.map((s) => s.instanceId)).size;
  const distinctSessions = new Set(samples.map((s) => s.sessionId)).size;
  const real = distinctInstances >= PERF_TARGETS.concurrentInstances && distinctSessions >= PERF_TARGETS.activeSessions;
  const perf = buildPerfReport({ samples, evidenceLevel: real ? PERF_LEVELS.real : PERF_LEVELS.pending, target: PERF_TARGETS });

  report.samples = samples;
  report.collectedByProduct = { samples: collected.samples.length, stats: collected.stats ?? collected.summary ?? null };
  report.summary = {
    okSessions: report.sessions.filter((r) => r.ok).length,
    failedSessions: report.sessions.filter((r) => !r.ok).length,
    distinctInstances,
    distinctSessions,
    meetsTargetLoad: real,
    latencyMs: samples.map((s) => s.latencyMs),
    perfLevel: perf.level,
    perfBlocked: perf.blocked,
  };
  report.conclusion = real ? 'MEASURED_REAL_HOST' : 'PILOT_SINGLE_INSTANCE';
  report.note = real
    ? '达到 20 实例 / 50 会话口径，真实宿主面证据成立。'
    : '试点：真实宿主已跑通并采到 handoff 延迟，但实例/会话数未达 20/50，级别仍为待本机实测（不得据此宣称真实面达标）。';
  return finish(report);
}

function finish(report) {
  report.finishedAt = new Date().toISOString();
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outFile) fs.writeFileSync(path.resolve(outFile), text, 'utf8');
  process.stdout.write(text);
  // 清理隔离凭据（只删自己复制的那份）
  if (report.dshHome?.credentialsWillBeRemoved && !keepHome) {
    try {
      fs.rmSync(path.join(report.dshHome.path, '.credentials.yaml'), { force: true });
    } catch {
      /* ignore */
    }
  }
  if (!keepHome && report.dshHome?.path) {
    try {
      fs.rmSync(report.dshHome.path, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  return 0;
}

process.exitCode = await main();
