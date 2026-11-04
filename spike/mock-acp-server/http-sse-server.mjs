#!/usr/bin/env node
/**
 * mock ACP agent — HTTP/SSE transport
 *
 * 通道约定（与 harness 的 http-sse transport 一一对应，属「mock 方言」，需在阶段三用真实
 * WorkBuddy sidecar 复核）：
 *   POST /rpc              请求/通知（JSON-RPC body）。带 id 时同步返回响应体；不带 id 返回 202
 *   GET  /events           SSE 长连接，承载 agent -> client 的 session/update 通知与请求
 *   POST /client-response  回应 agent 发起的请求（如 session/request_permission）
 *   GET  /health           就绪探针
 *
 * 鉴权：环境变量 ACP_HTTP_TOKEN 存在时校验 x-acp-token 头；token 不落盘、不进日志。
 *
 * 单连接多会话：sessionId -> connection 绑定，通知只投递给会话所属连接（隔离前提）。
 */
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createEngine } from './session-engine.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);

const PORT = Number(args.port ?? 0);
const TOKEN = process.env.ACP_HTTP_TOKEN ?? '';

const engine = createEngine({
  dialect: args.dialect ?? 'load-only',
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

const als = new AsyncLocalStorage();
const streams = new Map(); // connId -> http.ServerResponse
const sessionConn = new Map(); // sessionId -> connId
const pendingClient = new Map(); // srvId -> {resolve, reject}
let srvSeq = 0;
let connSeq = 0;

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

engine.setEmitter((method, params) => {
  const connId = sessionConn.get(params?.sessionId) ?? als.getStore()?.connId;
  const targets = connId ? [streams.get(connId)] : [...streams.values()];
  for (const res of targets) {
    if (!res || res.writableEnded) continue;
    sseSend(res, 'notification', { jsonrpc: '2.0', method, params });
  }
});

engine.setClientRequester(
  (method, params) =>
    new Promise((resolve, reject) => {
      const connId = sessionConn.get(params?.sessionId) ?? als.getStore()?.connId;
      const res = streams.get(connId) ?? [...streams.values()][0];
      if (!res) return reject({ code: -32603, message: 'no sse connection' });
      const id = `srv-${++srvSeq}`;
      pendingClient.set(id, { resolve, reject });
      sseSend(res, 'request', { jsonrpc: '2.0', id, method, params });
    }),
);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

const json = (res, code, body) => {
  const text = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (TOKEN && req.headers['x-acp-token'] !== TOKEN) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, stats: engine.stats() });
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    // 连接 id 由客户端提供（x-acp-conn），保证 sessionId -> 连接 的绑定可对齐
    const connId = req.headers['x-acp-conn'] ?? `conn-${++connSeq}`;
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    streams.set(connId, res);
    res.write(`event: ready\ndata: ${JSON.stringify({ connId })}\n\n`);
    req.on('close', () => {
      streams.delete(connId);
      for (const [sid, cid] of sessionConn) if (cid === connId) sessionConn.delete(sid);
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/client-response') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const p = pendingClient.get(String(body.id));
    if (p) {
      pendingClient.delete(String(body.id));
      body.error ? p.reject(body.error) : p.resolve(body.result ?? {});
    }
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/rpc') {
    const connId = req.headers['x-acp-conn'] ?? null;
    const msg = JSON.parse((await readBody(req)) || '{}');
    const ctx = { connId };

    if (msg.method === undefined) return json(res, 400, { error: 'method required' });

    if (msg.id === undefined) {
      await als.run(ctx, () => engine.handleNotification(msg.method, msg.params ?? {}));
      res.writeHead(202).end();
      return;
    }

    try {
      const result = await als.run(ctx, () => engine.handleRequest(msg.method, msg.params ?? {}));
      if (msg.method === 'session/new' && result?.sessionId && connId) sessionConn.set(result.sessionId, connId);
      json(res, 200, { jsonrpc: '2.0', id: msg.id, result });
    } catch (err) {
      json(res, 200, {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: err.code ?? -32603, message: err.message ?? String(err) },
      });
    }
    return;
  }

  json(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(JSON.stringify({ port: server.address().port, transport: 'http-sse', mock: true }) + '\n');
});
