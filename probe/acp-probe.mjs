#!/usr/bin/env node
// Minimal ACP stdio probe for the DSH built-in ACP server (Windows).
// Usage: node probe/acp-probe.mjs --mode=write|busy|cancel [--run-id=...]
// Writes: probe/runs/frames.jsonl (append, every frame both directions)
//         probe/runs/<runId>/frames.jsonl, stderr.log, result.json
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = path.join(ROOT, 'probe', 'runs');
const MASTER = path.join(RUNS, 'frames.jsonl');
const DSH_HOME = path.join(ROOT, 'probe', 'dsh-home');
const DSH_DIR = process.env.DSH_DIR ?? 'C:/Users/xuesh/AppData/Local/Programs/DeepSeek Harness';
const DSH_EXE = path.join(DSH_DIR, 'DeepSeek Harness.exe');
const DSH_BIN = path.join(DSH_DIR, 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js');

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const eq = argv.find((a) => a.startsWith('--' + n + '='));
  if (eq) return eq.slice(n.length + 3);
  const i = argv.indexOf('--' + n);
  return i >= 0 ? argv[i + 1] : d;
};
const mode = arg('mode', 'write');
const runId = arg('run-id', new Date().toISOString().replace(/[:.]/g, '-'));
const cancelAfterMs = Number(arg('cancel-after-ms', '2500'));
const runDir = path.join(RUNS, runId);
// Windows: DSH's shell sandbox cannot grant ACLs on repo paths (Win32 5), so the
// default workspace is under %TEMP%. --cwd overrides it for the ACL repro run.
const wsDir = path.resolve(arg('cwd', path.join(os.tmpdir(), 'maestro-i11-probe', runId, 'workspace')));

fs.mkdirSync(RUNS, { recursive: true });
fs.mkdirSync(runDir, { recursive: true });
fs.mkdirSync(wsDir, { recursive: true });
fs.writeFileSync(path.join(runDir, 'frames.jsonl'), '');
fs.writeFileSync(path.join(runDir, 'stderr.log'), '');

const EXPECTED = '# DSH ACP 探针\n探针写入成功：你好，Maestro。';
const PROMPTS = {
  write: `请使用名为 write 的文件写入工具（参数 file_path 与 content），把下面的内容原样写入当前工作目录下的 out/probe.md。必须使用 write 工具，禁止使用 pwsh、bash 或任何 shell 命令，禁止改写内容、禁止添加任何额外文字、末尾不要添加换行：\n\n${EXPECTED}`,
  busy: '请用 pwsh 工具执行命令 Start-Sleep -Seconds 6，真正等待 6 秒后回答 done。不要跳过命令。',
  cancel: '请用 pwsh 工具执行命令 Start-Sleep -Seconds 20，真正等待 20 秒后回答 done。不要跳过命令。',
};

// ---------- frame log ----------
let seq = 0;
const t0 = performance.now();
const t0Iso = new Date().toISOString();
const masterFd = fs.openSync(MASTER, 'a');
const runFd = fs.openSync(path.join(runDir, 'frames.jsonl'), 'a');
function logFrame(dir, kind, raw, extra = {}) {
  const rec = { runId, seq: seq++, ts: new Date().toISOString(), tMs: +(performance.now() - t0).toFixed(3), dir, kind, bytes: Buffer.byteLength(raw), raw, ...extra };
  const line = JSON.stringify(rec) + '\n';
  fs.writeSync(masterFd, line);
  fs.writeSync(runFd, line);
}

// ---------- child ----------
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME, NO_COLOR: '1', FORCE_COLOR: '0' };
const child = spawn(DSH_EXE, [DSH_BIN, '--profile', 'acp'], { cwd: ROOT, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
const timings = { spawnAtMs: 0 };

child.stderr.on('data', (c) => {
  const s = c.toString('utf8');
  logFrame('stderr', 'log', s.replace(/\n$/, ''));
  fs.appendFileSync(path.join(runDir, 'stderr.log'), s);
});

// ---------- framing: sniff then parse (NDJSON expected; Content-Length kept as fallback) ----------
let buf = Buffer.alloc(0);
let framing = null; // 'ndjson' | 'content-length'
let firstChunkSniff = null;
const pending = new Map();
let nextId = 1;
const updates = [];
const toolCalls = new Map();
let permissionCount = 0;
let firstPromptFrame = null;
let turnDone = null;

function handle(obj, raw) {
  if (obj.id !== undefined && obj.method === undefined) {
    const p = pending.get(obj.id);
    if (p) { pending.delete(obj.id); p.resolve(obj); }
    return;
  }
  if (obj.id !== undefined && obj.method !== undefined) {
    // agent -> client request
    if (obj.method === 'session/request_permission') {
      permissionCount++;
      const opts = obj.params?.options ?? [];
      const pick = opts.find((o) => o.kind === 'allow_once') ?? opts.find((o) => o.optionId === 'allow-once') ?? opts[0];
      send({ jsonrpc: '2.0', id: obj.id, result: { outcome: { outcome: 'selected', optionId: pick?.optionId } } }, 'response', 'permission-result');
      return;
    }
    send({ jsonrpc: '2.0', id: obj.id, error: { code: -32601, message: 'probe: method not supported: ' + obj.method } }, 'response', 'unsupported-result');
    return;
  }
  if (obj.method === 'session/update') {
    const u = obj.params?.update ?? {};
    updates.push({ tMs: +(performance.now() - t0).toFixed(3), sessionUpdate: u.sessionUpdate, status: u.status, title: u.title, toolCallId: u.toolCallId });
    if (u.toolCallId) {
      const cur = toolCalls.get(u.toolCallId) ?? { toolCallId: u.toolCallId, title: u.title, kind: u.kind, statuses: [] };
      if (u.title) cur.title = u.title;
      if (u.kind) cur.kind = u.kind;
      if (u.rawInput) cur.rawInput = u.rawInput;
      if (u.status) cur.statuses.push(u.status);
      cur.status = u.status ?? cur.status;
      toolCalls.set(u.toolCallId, cur);
    }
  }
}

function onLine(raw) {
  const text = raw.replace(/\r$/, '');
  let obj;
  try { obj = JSON.parse(text); } catch (e) { logFrame('in', 'unparsable', raw); return; }
  const kind = obj.method ? (obj.id !== undefined ? 'request' : 'notification') : 'response';
  logFrame('in', kind, raw);
  handle(obj, raw);
  if (firstPromptFrame === null && promptedAt !== null && (obj.method === 'session/update' || obj.id === promptId)) {
    firstPromptFrame = { tMs: +(performance.now() - t0).toFixed(3), kind: obj.method ?? 'response', sessionUpdate: obj.params?.update?.sessionUpdate };
  }
  if (obj.id === promptId && !turnDone) {
    turnDone = obj;
    timings.turnEnd = +(performance.now() - t0).toFixed(3);
  }
}

child.stdout.on('data', (chunk) => {
  if (firstChunkSniff === null) {
    firstChunkSniff = {
      firstBytesHex: chunk.subarray(0, 48).toString('hex'),
      firstBytesUtf8: chunk.subarray(0, 64).toString('utf8'),
      startsWithContentLength: /^Content-Length:/i.test(chunk.toString('utf8', 0, 32)),
      startsWithJson: chunk.toString('utf8', 0, 1) === '{',
      hasCrLfCrLf: chunk.includes('\r\n\r\n'),
    };
  }
  buf = Buffer.concat([buf, chunk]);
  if (framing === null) framing = firstChunkSniff.startsWithContentLength ? 'content-length' : 'ndjson';
  for (;;) {
    if (framing === 'content-length') {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const m = /Content-Length:\s*(\d+)/i.exec(buf.subarray(0, headerEnd).toString('ascii'));
      if (!m) { framing = 'ndjson'; continue; }
      const len = Number(m[1]);
      if (buf.length < headerEnd + 4 + len) return;
      const body = buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8');
      buf = buf.subarray(headerEnd + 4 + len);
      onLine(body);
    } else {
      const nl = buf.indexOf(0x0a);
      if (nl < 0) return;
      const line = buf.subarray(0, nl).toString('utf8');
      buf = buf.subarray(nl + 1);
      if (line.trim()) onLine(line);
    }
  }
});

// ---------- rpc ----------
function send(msg, kind = 'request', label = '') {
  const raw = JSON.stringify(msg);
  child.stdin.write(raw + '\n');
  logFrame('out', kind, raw, label ? { label } : {});
}
function request(method, params, label) {
  const id = nextId++;
  const p = new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.delete(id)) reject(new Error(`timeout waiting ${method}`)); }, 120000);
  });
  send({ jsonrpc: '2.0', id, method, params }, 'request', label ?? method);
  return p;
}
let promptedAt = null;
let promptId = null;

child.on('exit', (code, signal) => {
  logFrame('lifecycle', 'exit', JSON.stringify({ code, signal }));
  for (const [, p] of pending) p.reject(new Error(`child exited code=${code} signal=${signal}`));
  pending.clear();
});

// ---------- scenario ----------
const result = { runId, mode, startedAt: t0Iso, dshDir: DSH_DIR, dshHome: DSH_HOME, cwd: wsDir, framing: null, timingsMs: {}, framingSniff: null, updates: [], toolCalls: [], stopReason: null, sessionId: null, assertions: {}, errors: [] };

async function main() {
  const init = await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'maestro-probe', version: '0.1.0' },
  }, 'initialize');
  timings.initializeResult = +(performance.now() - t0).toFixed(3);
  result.initialize = init.result ?? init.error;
  if (init.error) throw new Error('initialize failed: ' + JSON.stringify(init.error));

  const newSess = await request('session/new', { cwd: wsDir, mcpServers: [] }, 'session/new');
  timings.sessionNewResult = +(performance.now() - t0).toFixed(3);
  result.sessionNew = { sessionId: newSess.result?.sessionId, configOptionsCount: newSess.result?.configOptions?.length ?? 0, error: newSess.error };
  if (newSess.error) throw new Error('session/new failed: ' + JSON.stringify(newSess.error));
  const sessionId = newSess.result.sessionId;
  result.sessionId = sessionId;

  promptId = nextId++;
  promptedAt = +(performance.now() - t0).toFixed(3);
  timings.promptSent = promptedAt;
  send({ jsonrpc: '2.0', id: promptId, method: 'session/prompt', params: { sessionId, prompt: [{ type: 'text', text: PROMPTS[mode] }] } }, 'request', 'session/prompt');

  if (mode === 'busy') {
    await new Promise((r) => setTimeout(r, 300));
    const t2 = +(performance.now() - t0).toFixed(3);
    const second = await request('session/prompt', { sessionId, prompt: [{ type: 'text', text: '任务 B：直接回答 ok，不要执行任何工具。' }] }, 'session/prompt-busy');
    result.busy = { sentAtMs: t2, respondedAtMs: +(performance.now() - t0).toFixed(3), latencyMs: +(performance.now() - t0 - t2).toFixed(3), error: second.error ?? null };
  }

  let cancelSentAt = null;
  if (mode === 'cancel') {
    const waitUntil = Date.now() + cancelAfterMs;
    while (Date.now() < waitUntil && !updates.some((u) => u.sessionUpdate === 'tool_call')) await new Promise((r) => setTimeout(r, 20));
    const afterTool = Number(arg('cancel-after-tool-ms', '0'));
    if (afterTool > 0) await new Promise((r) => setTimeout(r, afterTool));
    cancelSentAt = +(performance.now() - t0).toFixed(3);
    send({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId } }, 'notification', 'session/cancel');
    timings.cancelSent = cancelSentAt;
  }

  const deadline = Date.now() + 150000;
  while (!turnDone && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25));
  if (!turnDone) throw new Error('turn did not finish within 150s');
  result.stopReason = turnDone.result?.stopReason ?? null;
  result.promptError = turnDone.error ?? null;

  await new Promise((r) => setTimeout(r, 300)); // let trailing noise frames land
  result.framing = framing;
  result.framingSniff = firstChunkSniff;
  result.firstPromptFrame = firstPromptFrame;
  result.permissionsRequested = permissionCount;
  result.timingsMs = timings;
  result.updates = updates.map((u) => u.sessionUpdate);
  result.updateSequence = updates;
  result.toolCalls = [...toolCalls.values()];

  // assertions (write mode only)
  if (mode === 'write') {
    const target = path.join(wsDir, 'out', 'probe.md');
    const exists = fs.existsSync(target);
    const bytes = exists ? fs.readFileSync(target) : null;
    const text = bytes ? bytes.toString('utf8') : null;
    const writeTools = [...toolCalls.values()].filter((t) => (t.title ?? '').toLowerCase().includes('write'));
    result.writeAttempts = writeTools.map((t) => ({ toolCallId: t.toolCallId, statuses: t.statuses }));
    result.file = exists ? { path: target, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), content: text } : { path: target, exists: false };
    result.assertions = {
      toolCompleted: writeTools.some((t) => t.statuses.includes('completed')),
      fileExists: exists,
      contentExact: text === EXPECTED,
      contentTrimmedEqual: text !== null && text.replace(/\r?\n$/, '') === EXPECTED.replace(/\r?\n$/, ''),
      stopReasonEndTurn: result.stopReason === 'end_turn',
    };
    result.assertions.allPassed = Object.values(result.assertions).every(Boolean);
    if (exists) fs.copyFileSync(target, path.join(runDir, 'artifact-probe.md'));
  }
  if (mode === 'cancel') {
    result.cancel = { sentAtMs: cancelSentAt, turnEndMs: timings.turnEnd, effectiveLatencyMs: +(timings.turnEnd - cancelSentAt).toFixed(3), stopReason: result.stopReason };
  }
  result.ok = result.errors.length === 0 && !result.promptError;
}

main()
  .catch((e) => { result.errors.push(String(e?.stack ?? e)); result.ok = false; })
  .finally(async () => {
    try { child.stdin.end(); } catch {}
    await new Promise((r) => { const t = setTimeout(() => { try { child.kill(); } catch {} r(); }, 4000); child.once('exit', () => { clearTimeout(t); r(); }); });
    result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2));
    fs.closeSync(masterFd); fs.closeSync(runFd);
    console.log(JSON.stringify({ runId, mode, ok: result.ok, framing: result.framing, stopReason: result.stopReason, timingsMs: result.timingsMs, assertions: result.assertions, busy: result.busy, cancel: result.cancel, errors: result.errors }, null, 2));
  });
