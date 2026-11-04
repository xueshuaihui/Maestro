#!/usr/bin/env node
/**
 * VP-8 用的最小 daemon 桩：只实现 docs/index.md §5.7 的两个数据接口
 *
 *   GET /instances                       → 实例列表（含健康度）
 *   GET /instances/:id/graph             → 角色流程图全量快照
 *   WS  /instances/:id/graph/stream      → 增量推送（role_instance.updated / connection.updated）
 *
 * 零依赖（手写 WebSocket 握手与帧编解码），避免为 spike 引入运行时依赖。
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.STUB_PORT ?? 4319);

const graph = {
  instance_id: 'INST-001',
  workflow: 'general-task-loop',
  health: 'slow',
  roles: [
    { instance_id: 'INST-001', role_id: 'researcher', status: 'available', active_sessions: 0, serving_nodes: [], host_icons: ['dsh'] },
    { instance_id: 'INST-001', role_id: 'writer', status: 'busy', active_sessions: 1, serving_nodes: ['T-002'], host_icons: ['dsh'] },
    { instance_id: 'INST-001', role_id: 'reviewer', status: 'cooldown', active_sessions: 0, serving_nodes: ['T-003'], host_icons: ['dsh'] },
  ],
  connections: [
    { from_role: 'researcher', to_role: 'writer', direction: 'forward', aggregate_status: 'consumed', handoff_ids: ['HO-001'], latest_round: 1 },
    { from_role: 'writer', to_role: 'reviewer', direction: 'forward', aggregate_status: 'delivered', handoff_ids: ['HO-002'], latest_round: 1 },
    { from_role: 'reviewer', to_role: 'writer', direction: 'backflow', aggregate_status: 'pending', handoff_ids: ['HO-003'], latest_round: 1 },
  ],
};

const clients = new Set();

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/instances') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ instances: [{ id: graph.instance_id, workflow: graph.workflow, health: graph.health, pending: 1 }] }));
    return;
  }
  const m = url.pathname.match(/^\/instances\/([^/]+)\/graph$/);
  if (m) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(graph));
    return;
  }
  res.writeHead(404).end('not found');
});

server.on('upgrade', (req, socket) => {
  if (!req.url.startsWith('/instances/')) return socket.destroy();
  const key = req.headers['sec-websocket-key'];
  socket.write(
    ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${wsAccept(key)}`, '\r\n'].join('\r\n'),
  );
  clients.add(socket);
  socket.write(encodeFrame(JSON.stringify({ type: 'graph.snapshot', graph })));

  socket.on('data', () => {
    /* 只发不收，占位以消费客户端帧 */
  });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});

let tick = 0;
const timer = setInterval(() => {
  tick += 1;
  const evt = {
    type: 'role_instance.updated',
    role_instance: { instance_id: 'INST-001', role_id: 'writer', status: tick % 4 === 0 ? 'busy' : 'cooldown', active_sessions: tick % 4 === 0 ? 1 : 0, serving_nodes: ['T-002'] },
    seq: tick,
    at: new Date().toISOString(),
  };
  const frame = encodeFrame(JSON.stringify(evt));
  for (const c of clients) {
    try {
      c.write(frame);
    } catch {
      clients.delete(c);
    }
  }
}, 120);

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(JSON.stringify({ ready: true, port: PORT }) + '\n');
});

const shutdown = () => {
  clearInterval(timer);
  for (const c of clients) c.destroy();
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
