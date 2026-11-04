#!/usr/bin/env node
/**
 * mock ACP agent — stdio transport（NDJSON，一行一帧）
 *
 * 用法：
 *   node stdio-agent.mjs [--dialect=resume-no-replay|load-only|none]
 *                        [--permission=auto|ask|deny] [--turn-delay-ms=25]
 *
 * 与真实 stdio ACP agent（DSH / codex-acp / cursor agent acp）的差异只在「智能」，
 * 不在「帧格式」：同一份 harness 代码可以直接指向真实宿主。
 */
import readline from 'node:readline';
import { createEngine } from './session-engine.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);

const engine = createEngine({
  dialect: args.dialect ?? 'resume-no-replay',
  permission: args.permission ?? 'auto',
  turnDelayMs: Number(args['turn-delay-ms'] ?? 25),
  acceptDelayMs: Number(args['accept-delay-ms'] ?? 0),
  busyPolicy: args['busy-policy'] ?? 'error',
  noiseOnSessionNew: args['noise-on-session-new'] === 'true',
  noiseDelayMs: Number(args['noise-delay-ms'] ?? 0),
  noiseAtTurnEnd: args['noise-at-turn-end'] === 'true',
  stateFile: args['state-file'] ?? null,
  log: (m) => process.stderr.write(`${m}\n`),
});

const write = (frame) => process.stdout.write(JSON.stringify(frame) + '\n');
const pending = new Map();
let serverReqSeq = 0;

engine.setEmitter((method, params) => write({ jsonrpc: '2.0', method, params }));

engine.setClientRequester(
  (method, params) =>
    new Promise((resolve, reject) => {
      const id = `srv-${++serverReqSeq}`;
      pending.set(id, { resolve, reject });
      write({ jsonrpc: '2.0', id, method, params });
    }),
);

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
    return;
  }

  // client -> agent 的响应（回应 session/request_permission）
  if (msg.id !== undefined && msg.method === undefined) {
    const p = pending.get(String(msg.id));
    if (!p) return;
    pending.delete(String(msg.id));
    msg.error ? p.reject(msg.error) : p.resolve(msg.result ?? {});
    return;
  }

  if (msg.method && msg.id !== undefined) {
    try {
      const result = await engine.handleRequest(msg.method, msg.params ?? {});
      write({ jsonrpc: '2.0', id: msg.id, result });
    } catch (err) {
      write({ jsonrpc: '2.0', id: msg.id, error: { code: err.code ?? -32603, message: err.message ?? String(err) } });
    }
    return;
  }

  if (msg.method && msg.id === undefined) {
    await engine.handleNotification(msg.method, msg.params ?? {});
  }
});

rl.on('close', () => process.exit(0));
