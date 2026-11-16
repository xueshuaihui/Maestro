/**
 * I1.11 WP-7 HTTP 契约测试（D-1 / D-10 / A-11 / BR-26 / BR-37）。
 *
 * 覆盖：
 * - D-1 路由表形状（只读九组 + 写五条 + 两条 SSE；POST 行全部落在名单内）；
 * - 只读投影挂接（/queue、/assets、/occupancy、/workflows/:id/canvas、/evidence）；
 * - 五条写接口的参数校验与错误形状（HTTP 层零业务逻辑，错误码由核心/映射层给出）；
 * - D-10 三个 `__test__` 接缝（NODE_ENV=test 才注册；escalations 校验 + 委派、
 *   approvals 覆盖层入队、notify-trigger 只推意图）；
 * - /queue/stream（500ms 合并 + 变化检出，BR-37 ≤2s）与 /notifications/stream
 *   （(kind, instanceId) 合并语义，D-46）；
 * - 通知器生产接线（daemon server.js 创建 → 意图经 SSE 到达 → dispose 停止产意图）；
 * - A-11 文案键逐字与 BR-26（六模块代码行零中文字面量）。
 *
 * 既有 8 条路径与 shapeSnapshot 的逐字回归由 test/wp13/http-channel.test.js 等既有
 * 套件承载；本文件只断言新面的契约与既有面的共存。
 */

process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createServer } from '../../src/daemon/server.js';
import { desktopMetaPath } from '../../src/daemon/http/server.js';
import { createHttpServer } from '../../src/daemon/http/server.js';
import { createRoutes } from '../../src/daemon/http/routes.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createNotifier } from '../../src/daemon/notify.js';
import { QUEUE_LABELS } from '../../src/daemon/queue.js';
import { OCCUPANCY_STATUS_ORDER } from '../../src/daemon/occupancy.js';
import { ROLE_INSTANCE_STATUS_LABEL, TEMPLATE_LABEL } from '../../src/cli/labels.js';
import {
  DESKTOP_QUEUE_ACTION_UNSUPPORTED,
  DESKTOP_QUEUE_ALREADY_RESOLVED,
  DESKTOP_QUEUE_DISABLED_HINT,
  DESKTOP_QUEUE_DISCONNECTED,
  DESKTOP_QUEUE_EMPTY,
  DESKTOP_QUEUE_ROW_APR,
  DESKTOP_QUEUE_ROW_ESC,
  DESKTOP_QUEUE_ROW_STATE_UNREADABLE,
  DESKTOP_ASSET_UNREADABLE,
  DESKTOP_ASSET_ITEM_UNREADABLE,
  DESKTOP_ASSET_MISSING,
  DESKTOP_OCCUPANCY_EMPTY,
  DESKTOP_OCCUPANCY_SKIPPED,
  DESKTOP_CANVAS_TITLE,
  DESKTOP_CANVAS_INVALID,
  DESKTOP_CANVAS_UNREADABLE,
  DESKTOP_CANVAS_EMPTY,
  DESKTOP_EVIDENCE_NODE_ROW,
  DESKTOP_EVIDENCE_UNPROVIDED,
  DESKTOP_EVIDENCE_LOG_ON_HOST,
  DESKTOP_EVIDENCE_UNREADABLE,
  DESKTOP_EVIDENCE_TRUNCATED,
  DESKTOP_TRAY_STATUS,
  DESKTOP_TRAY_STATUS_DISCONNECTED,
  DESKTOP_TRAY_PAUSE,
  DESKTOP_TRAY_RESUME,
  DESKTOP_TRAY_PAUSE_SUMMARY,
  DESKTOP_TRAY_PAUSE_NONE,
  DESKTOP_NOTIFY_TITLE_PREFIX,
  DESKTOP_NOTIFY_CATEGORY_ESCALATION,
  DESKTOP_NOTIFY_CATEGORY_COMPLETED,
  DESKTOP_NOTIFY_CATEGORY_ANOMALY,
  DESKTOP_NOTIFY_TOGGLE,
  DESKTOP_NOTIFY_UNAVAILABLE,
  DESKTOP_NOTIFY_SEG_MISSING,
  DESKTOP_NOTIFY_SEG_SEPARATOR,
} from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

function makeRoot(prefix = 'maestro-i11-wp7-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

async function until(fn, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

/** 带凭据的请求助手。 */
function api(meta, urlPath, init = {}) {
  return fetch(`http://127.0.0.1:${meta.port}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${meta.token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** SSE 增量读取：按 `\n\n` 分帧，最多等到 maxMs 或收满 want 帧；onFrame 逐帧回调。 */
async function collectSse(res, { maxMs = 3000, want = Infinity, onFrame = null } = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const frames = [];
  const deadline = Date.now() + maxMs;
  const drain = async () => {
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      let event = null;
      let data = null;
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data = line.slice(5).trim();
      }
      frames.push({ event, data: data !== null ? JSON.parse(data) : null });
      if (onFrame !== null) await onFrame(frames[frames.length - 1], frames);
    }
  };
  // 单一未决 read：race 超时后保留同一个 promise，绝不丢弃已排队的读取结果
  // （丢一次 read 就会静默吞掉一帧）；每消费一块立即重新挂起下一次 read。
  // 静默 catch 兜底：rejection 在被 race 消费前（如 onFrame 内 await 期间）
  // 不得触发 unhandledRejection。
  let pendingRead = null;
  const armRead = () => {
    pendingRead = reader.read().then(
      (result) => {
        pendingRead = null;
        return result;
      },
      (err) => {
        pendingRead = null;
        throw err;
      },
    );
    pendingRead.catch(() => {});
  };
  armRead();
  while (Date.now() < deadline && frames.length < want) {
    const remaining = Math.max(1, deadline - Date.now());
    const tick = new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 60)));
    let chunk = null;
    try {
      chunk = await Promise.race([pendingRead, tick.then(() => null)]);
    } catch {
      break; // 流被对端终止（如主动 close / 中断）→ 视为收集结束
    }
    if (chunk !== null) {
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      armRead();
    }
    await drain();
  }
  try {
    await reader.cancel();
  } catch {
    // 已被对端关闭
  }
  return frames;
}

function stubOrchestrator(overrides = {}) {
  return {
    mode: 'real',
    async startRun() {
      return { ok: false, code: 'IPC_BAD_PARAMS' };
    },
    async listInstances() {
      return { ok: true, items: [] };
    },
    async getStatus() {
      return { ok: false, code: 'NOT_FOUND' };
    },
    async reconcileOnBoot() {
      return { ok: true, interrupted: [] };
    },
    async interruptAll() {
      return { ok: true, interrupted: [] };
    },
    async dispose() {},
    ...overrides,
  };
}

/** 独立 HTTP 通道（不经 daemon server）：S-02 懒挂接 routes.js。 */
async function startChannel(root, orchestrator, { notifier } = {}) {
  const bus = createEventBus({ store: createStore({ root }) });
  const httpServer = createHttpServer({
    root,
    orchestrator,
    bus,
    graph: {
      loadState: async (id) => ({ ok: true, state: { instanceId: id } }),
      replayEvents: async () => [],
      readTraces: async () => ({ spans: [] }),
    },
    notifier,
  });
  const listened = await httpServer.listen();
  assert.equal(listened.ok, true);
  return { httpServer, meta: httpServer.meta };
}

function queueSnapshot({ withEscalation = false, withApproval = false } = {}) {
  return {
    instanceId: 'INST-001',
    schemaVersion: 2,
    template: 'single',
    state: 'suspended',
    cwd: '/tmp/x',
    nodes: [{ nodeId: 'T-001', roleId: 'developer', round: 1, state: 'running' }],
    sessions: [],
    handoffs: [],
    escalations: withEscalation
      ? [
          {
            escalationId: 'ESC-001',
            state: 'pending',
            nodeId: 'T-001',
            round: 1,
            reasonCode: 'rounds_exceeded',
            reasonDetail: '轮次超限',
            createdAt: '2026-11-15T10:30:00Z',
          },
        ]
      : [],
    approvals: withApproval
      ? [
          {
            approvalId: 'APR-001',
            state: 'pending',
            nodeId: 'T-001',
            action: 'write',
            createdAt: '2026-11-15T10:31:00Z',
          },
        ]
      : [],
    pendingEscalations: withEscalation ? 1 : 0,
    pendingApprovals: withApproval ? 1 : 0,
    health: { level: 'attention', reasons: ['pending_escalation'] },
  };
}

// ------------------------------------------------------------------ 路由表形状

test('D-1 路由表：GET 覆盖九组只读面，POST 全部落在写名单内（AC-39 机检形态）', async () => {
  const spawned = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const m = await import('${REPO}/src/daemon/http/routes.js'.replace(/\\\\/g, '/'));
       const rows = m.createRoutes({
         orchestrator: { startRun: async () => ({ ok: false }) },
         root: process.cwd(),
       });
       console.log(JSON.stringify(rows.map((r) => [r.method, r.pattern])));`,
    ],
    {
      encoding: 'utf8',
      cwd: REPO,
      // 子进程必须模拟无 NODE_ENV 的生产环境（spawnSync 默认继承父进程变量）。
      env: { ...process.env, NODE_ENV: '' },
    },
  );
  assert.equal(spawned.status, 0, spawned.stderr);
  const rows = JSON.parse(spawned.stdout);
  const postPatterns = rows.filter(([method]) => method === 'POST').map(([, pattern]) => pattern);
  const allowedWrites = new Set([
    '/instances',
    '/ui/prefs',
    '/queue/escalations/:id/decision',
    '/queue/approvals/:id/decision',
    '/instances/:id/cancel',
    '/control/pause',
    '/control/resume',
  ]);
  for (const pattern of postPatterns) {
    assert.ok(
      allowedWrites.has(pattern) || pattern.startsWith('/__test__/'),
      `POST 路径越权：${pattern}`,
    );
  }
  // 无 NODE_ENV（本子进程显式剥离）时 D-10 接缝不注册。
  assert.equal(rows.some(([, p]) => p.startsWith('/__test__/')), false, '生产进程不得注册测试接缝');

  const gets = rows.filter(([method]) => method === 'GET').map(([, pattern]) => pattern);
  for (const expected of [
    '/instances',
    '/workflows',
    '/ui/prefs',
    '/queue',
    '/queue/stream',
    '/assets/roles',
    '/assets/skills',
    '/assets/workflows',
    '/assets/roles/:id',
    '/assets/skills/:id',
    '/assets/workflows/:id',
    '/occupancy/roles',
    '/workflows/:id/canvas',
    '/evidence/:instanceId',
    '/evidence/:instanceId/:nodeId',
    '/notifications/stream',
  ]) {
    assert.ok(gets.includes(expected), `缺少 GET ${expected}`);
  }
});

test('D-10：NODE_ENV=test 时三个 __test__ 接缝出现在路由表', () => {
  const rows = createRoutes({ orchestrator: stubOrchestrator(), root: '/tmp' });
  const posts = rows.filter((r) => r.method === 'POST').map((r) => r.pattern);
  for (const seam of ['/__test__/escalations', '/__test__/approvals', '/__test__/notify-trigger']) {
    assert.ok(posts.includes(seam), `缺少测试接缝 ${seam}`);
  }
});

// ------------------------------------------------------------------ 文案键（A-11 / BR-26）

test('A-11 文案键逐字（抽查 + 键存在性）', () => {
  // 队列（A-3 / A-2 / A-4 / A-5）
  assert.equal(DESKTOP_QUEUE_ROW_ESC, '升级 {id} · 实例 {instanceId} · 节点 {nodeId} {role} · 第 {round} 轮 · {state} · {reason} · {createdAt}');
  assert.equal(DESKTOP_QUEUE_ROW_APR, '审批 {id} · 实例 {instanceId} · 节点 {nodeId} {role} · 第 {round} 轮 · {state} · 动作 {action} · {createdAt}');
  assert.equal(DESKTOP_QUEUE_EMPTY, '待处理 无');
  assert.equal(DESKTOP_QUEUE_DISCONNECTED, '已断开 · 正在重连…');
  assert.equal(DESKTOP_QUEUE_ROW_STATE_UNREADABLE, '实例 {id} · 状态不可读');
  assert.equal(DESKTOP_QUEUE_ALREADY_RESOLVED, '已处理（{conclusion}），无需再次处理');
  assert.equal(DESKTOP_QUEUE_DISABLED_HINT, '该升级只能重派或终止');
  assert.equal(DESKTOP_QUEUE_ACTION_UNSUPPORTED, '升级 {id} 不支持该动作');
  // 资产（A-5）
  assert.equal(DESKTOP_ASSET_UNREADABLE, '资产不可读 · {dir}');
  assert.equal(DESKTOP_ASSET_ITEM_UNREADABLE, '{kind} {id} · 不可读');
  assert.equal(DESKTOP_ASSET_MISSING, '缺失');
  // 占用（A-6）
  assert.equal(DESKTOP_OCCUPANCY_EMPTY, '角色占用 无');
  assert.equal(DESKTOP_OCCUPANCY_SKIPPED, '{n} 个实例状态不可读，已跳过');
  // 画布（A-7）
  assert.equal(DESKTOP_CANVAS_TITLE, '工作流 {name} · 定义态 · {n} 节点 · {m} 条边');
  assert.equal(DESKTOP_CANVAS_INVALID, '校验不通过');
  assert.equal(DESKTOP_CANVAS_UNREADABLE, '定义不可读 · 仅显示可解析部分');
  assert.equal(DESKTOP_CANVAS_EMPTY, '定义 空');
  // 证据（A-8）
  assert.equal(DESKTOP_EVIDENCE_NODE_ROW, '节点 {id} · 第 {n} 轮');
  assert.equal(DESKTOP_EVIDENCE_UNPROVIDED, '未提供');
  assert.equal(DESKTOP_EVIDENCE_LOG_ON_HOST, '完整日志留在宿主');
  assert.equal(DESKTOP_EVIDENCE_UNREADABLE, '引用不可读');
  assert.equal(DESKTOP_EVIDENCE_TRUNCATED, '体积超限已截断');
  // 托盘（A-9）
  assert.equal(DESKTOP_TRAY_STATUS, '实例 {n} · 待处理升级 {m}');
  assert.equal(DESKTOP_TRAY_STATUS_DISCONNECTED, '实例 — · 待处理升级 —');
  assert.equal(DESKTOP_TRAY_PAUSE, '暂停');
  assert.equal(DESKTOP_TRAY_RESUME, '继续');
  assert.equal(DESKTOP_TRAY_PAUSE_SUMMARY, '{n} 个实例已暂停，{m} 个已跳过');
  assert.equal(DESKTOP_TRAY_PAUSE_NONE, '没有可暂停的实例');
  // 通知（A-1 / A-2）
  assert.equal(DESKTOP_NOTIFY_TITLE_PREFIX, '通知');
  assert.equal(DESKTOP_NOTIFY_CATEGORY_ESCALATION, '升级待处理');
  assert.equal(DESKTOP_NOTIFY_CATEGORY_COMPLETED, '实例完成');
  assert.equal(DESKTOP_NOTIFY_CATEGORY_ANOMALY, '实例异常');
  assert.equal(DESKTOP_NOTIFY_TOGGLE, '通知');
  assert.equal(DESKTOP_NOTIFY_UNAVAILABLE, '通知不可用 · 队列仍可用');
  assert.equal(DESKTOP_NOTIFY_SEG_MISSING, '—');
  assert.equal(DESKTOP_NOTIFY_SEG_SEPARATOR, ' · ');
});

test('BR-26：六个守护进程投影模块的代码行零中文字面量（中文只在 labels.js）', () => {
  const CJK = /[\u4e00-\u9fff]/;
  const files = [
    'src/daemon/notify.js',
    'src/daemon/queue.js',
    'src/daemon/occupancy.js',
    'src/daemon/canvas.js',
    'src/daemon/evidence.js',
    'src/daemon/assets-view.js',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    const hits = codeOnly
      .split('\n')
      .map((line, index) => [index + 1, line])
      .filter(([, line]) => CJK.test(line));
    assert.deepEqual(hits, [], `${rel} 代码行仍含中文：${hits.map((h) => h.join(':')).join(' | ')}`);
  }
});

// ------------------------------------------------------------------ 既有面共存

test('既有面共存：/ui/labels、/instances、/workflows 行为不变', async () => {
  const root = makeRoot();
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      const labels = await api(meta, '/ui/labels');
      assert.equal(labels.status, 200);
      const labelBody = await labels.json();
      assert.ok(labelBody.keys && typeof labelBody.keys === 'object');

      const list = await api(meta, '/instances');
      assert.equal(list.status, 200);
      assert.deepEqual(await list.json(), { items: [] });

      const workflows = await api(meta, '/workflows');
      assert.equal(workflows.status, 200);
      const wfBody = await workflows.json();
      assert.deepEqual(wfBody.items.map((item) => item.id), Object.keys(TEMPLATE_LABEL));

      const missing = await fetch(`http://127.0.0.1:${meta.port}/queue`);
      assert.equal(missing.status, 401, '无凭据的处理器路径仍 401');
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ /queue

test('GET /queue：条目排序、totals 透传与单行状态不可读降级', async () => {
  const root = makeRoot();
  try {
    const orchestrator = stubOrchestrator({
      async listInstances() {
        return {
          ok: true,
          items: [
            { instanceId: 'INST-001', readable: true },
            { instanceId: 'INST-004', readable: false, pendingEscalations: 2, pendingApprovals: 1 },
          ],
        };
      },
      async getStatus({ instanceId }) {
        if (instanceId !== 'INST-001') return { ok: false, code: 'STATE_CORRUPT' };
        return {
          ok: true,
          snapshot: queueSnapshot({ withEscalation: true, withApproval: true }),
        };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const res = await api(meta, '/queue');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.items.length, 3);
      // 排序：type 优先（escalation < approval）→ ESC-001 与 INST-004 降级行
      // （pendingEscalations=2 → type 'escalation'）在前，APR-001 在后。
      assert.equal(body.items[0].type, 'escalation');
      assert.equal(body.items[0].id, 'ESC-001');
      const aprRow = body.items.find((row) => row.id === 'APR-001');
      assert.ok(aprRow, 'APR-001 应在队列中');
      assert.equal(aprRow.type, 'approval');
      const degraded = body.items.find((row) => row.instanceId === 'INST-004');
      assert.ok(degraded, 'INST-004 降级行应在队列中');
      assert.equal(degraded.stateWord, QUEUE_LABELS.STATE_UNREADABLE);
      assert.equal(degraded.instanceId, 'INST-004');
      assert.deepEqual(body.totals, { pendingEscalations: 3, pendingApprovals: 2 });

      const empty = await startChannel(root, stubOrchestrator());
      try {
        const res2 = await api(empty.meta, '/queue');
        const body2 = await res2.json();
        assert.deepEqual(body2.items, []);
        assert.deepEqual(body2.totals, { pendingEscalations: 0, pendingApprovals: 0 });
      } finally {
        await empty.httpServer.close();
      }
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ /assets

test('GET /assets：三类列表结构与详情 404 形状、穿越 id 拒绝', async () => {
  const root = makeRoot();
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      for (const kind of ['roles', 'skills', 'workflows']) {
        const res = await api(meta, `/assets/${kind}`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body.items));
        assert.ok(Array.isArray(body.unreadable));
        assert.equal(body.counts.total, body.counts.builtin + body.counts.project);
        assert.equal(body.dirUnreadable, false);
        for (const row of body.items) {
          assert.ok(['内置', '项目'].includes(row.source));
          assert.ok(['通过', '不通过', '未校验', '不可读'].includes(row.validation));
        }
      }
      const missing = await api(meta, '/assets/roles/definitely-missing-id');
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), {
        found: false,
        kind: 'roles',
        id: 'definitely-missing-id',
      });
      const traversal = await api(meta, '/assets/roles/x%5Cy');
      assert.equal(traversal.status, 404);
      const traversalBody = await traversal.json();
      assert.equal(traversalBody.found, false);
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ /occupancy

test('GET /occupancy/roles：跨实例聚合行 + 不可读实例跳过登记', async () => {
  const root = makeRoot();
  try {
    const snapshot = {
      ...queueSnapshot(),
      sessions: [{ sessionId: 's1', state: 'thinking', hostId: 'mock' }],
    };
    const orchestrator = stubOrchestrator({
      async listInstances() {
        return {
          ok: true,
          items: [
            { instanceId: 'INST-001', readable: true },
            { instanceId: 'INST-009', readable: false },
          ],
        };
      },
      async getStatus({ instanceId }) {
        if (instanceId !== 'INST-001') return { ok: false, code: 'STATE_CORRUPT' };
        return { ok: true, snapshot };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const res = await api(meta, '/occupancy/roles');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.rows) && body.rows.length >= 1);
      for (const row of body.rows) {
        assert.equal(typeof row.roleId, 'string');
        assert.ok(OCCUPANCY_STATUS_ORDER.includes(row.status));
        assert.ok(Array.isArray(row.hosts));
        assert.ok(Array.isArray(row.servingNodes));
      }
      const serving = body.rows.find((row) => row.roleId === 'developer');
      assert.ok(serving, '绑定节点的内置角色应有聚合行');
      assert.deepEqual(body.skipped, [{ instanceId: 'INST-009', reason: null }]);
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ /workflows/:id/canvas

test('GET /workflows/:id/canvas：合法定义投影、未命中与穿越 id 按「定义 空」降级', async () => {
  const root = makeRoot();
  const wfDir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(
    path.join(wfDir, 'mini.yaml'),
    ['name: mini', 'nodes:', '  - id: T-001', '    node_type: role', '    role: developer', '  - id: T-002', '    node_type: role', '    role: developer', 'edges:', '  - from: T-001', '    to: T-002'].join('\n'),
    'utf8',
  );
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      const res = await api(meta, '/workflows/mini/canvas');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.title, 'mini');
      assert.equal(body.readable, true);
      assert.equal(body.nodes.length, 2);
      assert.deepEqual(body.edges, [{ from: 'T-001', to: 'T-002', kind: 'forward' }]);
      for (const node of body.nodes) {
        assert.deepEqual(Object.keys(node).sort(), ['id', 'label', 'nodeType', 'roleId']);
      }

      const blank = await api(meta, '/workflows/nope/canvas');
      assert.equal(blank.status, 200);
      const blankBody = await blank.json();
      assert.equal(blankBody.readable, true);
      assert.deepEqual(blankBody.nodes, []);

      const traversal = await api(meta, '/workflows/..%2Fescape/canvas');
      assert.equal(traversal.status, 200);
      const traversalBody = await traversal.json();
      assert.equal(traversalBody.readable, true);
      assert.deepEqual(traversalBody.nodes, []);
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ /evidence

test('GET /evidence：五项 + 轮次、缺项 null、节点过滤与未知实例空投影', async () => {
  const root = makeRoot();
  const store = createStore({ root });
  await store.save('INST-003', {
    schemaVersion: 2,
    instanceId: 'INST-003',
    state: 'running',
    rev: 0,
    cwd: root,
    nodes: [
      { nodeId: 'T-001', round: 2, state: 'running', artifactRefs: [] },
      { nodeId: 'T-002', round: 1, state: 'pending', artifactRefs: [] },
    ],
  });
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      const one = await api(meta, '/evidence/INST-003/T-001');
      assert.equal(one.status, 200);
      const oneBody = await one.json();
      assert.equal(oneBody.instanceId, 'INST-003');
      assert.equal(oneBody.items.length, 1);
      assert.equal(oneBody.items[0].nodeId, 'T-001');
      assert.equal(oneBody.items[0].round, 2);
      assert.equal(oneBody.items[0].command, null);
      assert.equal(oneBody.items[0].exitCode, null);
      assert.equal(oneBody.items[0].logRef, null);
      assert.deepEqual(oneBody.items[0].artifactRefs, null);
      assert.deepEqual(oneBody.items[0].unreadable, []);

      const all = await api(meta, '/evidence/INST-003');
      const allBody = await all.json();
      assert.deepEqual(
        allBody.items.map((item) => item.nodeId),
        ['T-001', 'T-002'],
      );

      const unknown = await api(meta, '/evidence/INST-999');
      assert.equal(unknown.status, 200);
      assert.deepEqual(await unknown.json(), { instanceId: 'INST-999', items: [] });
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ 写接口

test('POST /queue/escalations/:id/decision：缺 decision 400，非 pass/retry 422 ACTION_NOT_SUPPORTED', async () => {
  const root = makeRoot();
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      const noBody = await api(meta, '/queue/escalations/ESC-001/decision', {
        method: 'POST',
        body: '{}',
      });
      assert.equal(noBody.status, 400);
      assert.deepEqual(await noBody.json(), { error: 'IPC_BAD_PARAMS', params: { field: 'decision' } });

      const badJson = await api(meta, '/queue/escalations/ESC-001/decision', {
        method: 'POST',
        body: 'not-json',
      });
      assert.equal(badJson.status, 400);

      const mismatch = await api(meta, '/queue/escalations/ESC-001/decision', {
        method: 'POST',
        body: JSON.stringify({ decision: 'fail' }),
      });
      assert.equal(mismatch.status, 422);
      const mismatchBody = await mismatch.json();
      assert.equal(mismatchBody.ok, false);
      assert.equal(mismatchBody.error, 'ACTION_NOT_SUPPORTED');
      assert.equal(mismatchBody.params.decision, 'fail');
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

test('POST /queue/approvals/:id/decision 与 /instances/:id/cancel：核心不在时 503（错误码透传）', async () => {
  const root = makeRoot();
  try {
    const { httpServer, meta } = await startChannel(root, stubOrchestrator());
    try {
      const approval = await api(meta, '/queue/approvals/APR-001/decision', {
        method: 'POST',
        body: JSON.stringify({ decision: 'allow' }),
      });
      assert.equal(approval.status, 503);
      const approvalBody = await approval.json();
      assert.equal(approvalBody.ok, false);
      assert.equal(approvalBody.error, 'CORE_NOT_RUNNING');

      const cancel = await api(meta, '/instances/INST-001/cancel', { method: 'POST', body: '' });
      assert.equal(cancel.status, 503);
      const cancelBody = await cancel.json();
      assert.equal(cancelBody.error, 'CORE_NOT_RUNNING');

      const traversal = await api(meta, '/instances/..%2Fx/cancel', { method: 'POST', body: '' });
      assert.equal(traversal.status, 404);
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

test('POST /control/pause|resume：逐实例汇总，单个失败跳过、全量失败不报错（D-8）', async () => {
  const root = makeRoot();
  try {
    const orchestrator = stubOrchestrator({
      async listInstances() {
        return {
          ok: true,
          items: [
            { instanceId: 'INST-001', readable: true },
            { instanceId: 'INST-002', readable: true },
            { instanceId: 'INST-003', readable: false },
          ],
        };
      },
      async pause({ instanceId }) {
        if (instanceId === 'INST-002') throw new Error('boom');
        return { ok: true };
      },
      async resume({ instanceId }) {
        if (instanceId === 'INST-002') return { ok: false, code: 'INSTANCE_NOT_RESUMABLE' };
        return { ok: true };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const paused = await api(meta, '/control/pause', { method: 'POST', body: '' });
      assert.equal(paused.status, 200);
      assert.deepEqual(await paused.json(), { ok: true, paused: 1, skipped: 2 });

      const resumed = await api(meta, '/control/resume', { method: 'POST', body: '' });
      assert.equal(resumed.status, 200);
      assert.deepEqual(await resumed.json(), { ok: true, paused: 1, skipped: 2 });

      const bare = await startChannel(root, stubOrchestrator());
      try {
        const res = await api(bare.meta, '/control/pause', { method: 'POST', body: '' });
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { ok: true, paused: 0, skipped: 0 });
      } finally {
        await bare.httpServer.close();
      }
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ D-10 接缝

test('POST /__test__/escalations：参数校验 400、委派既有 escalateOnce、无接缝 503', async () => {
  const root = makeRoot();
  try {
    const calls = [];
    const orchestrator = stubOrchestrator({
      async escalateOnce(instanceId, nodeId, options) {
        calls.push({ instanceId, nodeId, options });
        return { ok: true, escalationId: 'ESC-001', reused: false };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const missing = await api(meta, '/__test__/escalations', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-001' }),
      });
      assert.equal(missing.status, 400);
      assert.deepEqual(await missing.json(), { error: 'IPC_BAD_PARAMS', params: { field: 'nodeId' } });

      const ok = await api(meta, '/__test__/escalations', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-001', nodeId: 'T-001', reasonCode: 'rounds_exceeded' }),
      });
      assert.equal(ok.status, 200);
      const okBody = await ok.json();
      assert.equal(okBody.ok, true);
      assert.equal(okBody.result.escalationId, 'ESC-001');
      assert.deepEqual(calls[0], {
        instanceId: 'INST-001',
        nodeId: 'T-001',
        options: { reasonCode: 'rounds_exceeded' },
      });

      const fail = await api(meta, '/__test__/escalations', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-001', nodeId: 'T-XXX' }),
      });
      assert.equal(fail.status, 200);
    } finally {
      await httpServer.close();
    }

    const bare = await startChannel(root, stubOrchestrator());
    try {
      const res = await api(bare.meta, '/__test__/escalations', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-001', nodeId: 'T-001' }),
      });
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'NOT_READY' });
    } finally {
      await bare.httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

test('POST /__test__/approvals：构造待审批只进内存覆盖层并入队列投影（不写盘）', async () => {
  const root = makeRoot();
  const store = createStore({ root });
  await store.save('INST-002', {
    schemaVersion: 2,
    instanceId: 'INST-002',
    state: 'running',
    rev: 0,
    nodes: [],
    escalations: [],
    approvals: [],
  });
  try {
    const orchestrator = stubOrchestrator({
      async listInstances() {
        return { ok: true, items: [{ instanceId: 'INST-002', readable: true }] };
      },
      async getStatus() {
        const loaded = await store.load('INST-002');
        return { ok: true, snapshot: loaded.state };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const first = await api(meta, '/__test__/approvals', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-002', action: 'write', nodeId: 'T-001' }),
      });
      assert.equal(first.status, 200);
      const firstBody = await first.json();
      assert.equal(firstBody.result.approvalId, 'APR-001');
      assert.equal(firstBody.result.approval.state, 'pending');

      const second = await api(meta, '/__test__/approvals', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-002', action: 'bash' }),
      });
      assert.equal((await second.json()).result.approvalId, 'APR-002');

      const queue = await api(meta, '/queue');
      const queueBody = await queue.json();
      const ids = queueBody.items.filter((item) => item.type === 'approval').map((item) => item.id);
      assert.deepEqual(ids, ['APR-001', 'APR-002']);

      // 不写盘：state.json 的 approvals 仍为空（D-10 接缝不落盘）。
      const disk = (await store.load('INST-002')).state;
      assert.deepEqual(disk.approvals, []);

      const bad = await api(meta, '/__test__/approvals', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'INST-002' }),
      });
      assert.equal(bad.status, 400);
    } finally {
      await httpServer.close();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ SSE

test('GET /queue/stream：首帧快照 + 变化后 ≤2s 推送（BR-37）', async () => {
  const root = makeRoot();
  const controller = new AbortController();
  try {
    const rows = [];
    const orchestrator = stubOrchestrator({
      async listInstances() {
        return { ok: true, items: rows.map((row) => ({ instanceId: row.instanceId, readable: true })) };
      },
      async getStatus({ instanceId }) {
        const row = rows.find((item) => item.instanceId === instanceId);
        if (!row) return { ok: false, code: 'NOT_FOUND' };
        return { ok: true, snapshot: row.snapshot };
      },
    });
    const { httpServer, meta } = await startChannel(root, orchestrator);
    try {
      const res = await fetch(`http://127.0.0.1:${meta.port}/queue/stream`, {
        headers: { Authorization: `Bearer ${meta.token}` },
        signal: controller.signal,
      });
      assert.equal(res.status, 200);

      // 第一帧（空队列快照）到达后立即写入变化，计时刻度从这一刻起算。
      let t0 = null;
      const frames = await collectSse(res, {
        maxMs: 5000,
        want: 2,
        onFrame(_frame, collected) {
          if (collected.length === 1 && rows.length === 0) {
            t0 = Date.now();
            rows.push({ instanceId: 'INST-001', snapshot: queueSnapshot({ withEscalation: true }) });
          }
        },
      });

      assert.ok(frames.length >= 2, `应有两帧（首帧 + 变化帧），实收 ${frames.length}`);
      assert.ok(frames.every((frame) => frame.event === 'queue.snapshot'));
      assert.deepEqual(frames[0].data.items, [], '首帧是空队列快照');
      const pushed = frames[frames.length - 1].data;
      assert.equal(pushed.items.length, 1);
      assert.equal(pushed.items[0].id, 'ESC-001');
      assert.ok(t0 !== null && Date.now() - t0 < 2500, '变化帧未在 2 秒内到达（BR-37）');
    } finally {
      await httpServer.close();
      controller.abort();
    }
  } finally {
    cleanup(root);
  }
});

test('GET /notifications/stream 与 /__test__/notify-trigger：意图推送 + (kind, instanceId) 合并', async () => {
  const root = makeRoot();
  const controller = new AbortController();
  try {
    const fakeBus = { subscribe() {
      return () => {};
    } };
    const notifier = createNotifier({ bus: fakeBus });
    const { httpServer, meta } = await startChannel(root, stubOrchestrator(), { notifier });
    try {
      const res = await fetch(`http://127.0.0.1:${meta.port}/notifications/stream`, {
        headers: { Authorization: `Bearer ${meta.token}` },
        signal: controller.signal,
      });
      assert.equal(res.status, 200);

      const bad = await api(meta, '/__test__/notify-trigger', {
        method: 'POST',
        body: JSON.stringify({ kind: 'nope', instanceId: 'INST-001' }),
      });
      assert.equal(bad.status, 400);

      // 同目标两条在 500ms 合并窗内 → 只发一条（后者替换前者，D-46）。
      const first = await api(meta, '/__test__/notify-trigger', {
        method: 'POST',
        body: JSON.stringify({ kind: 'anomaly', instanceId: 'INST-001', reason: '第一次' }),
      });
      assert.equal(first.status, 200);
      const second = await api(meta, '/__test__/notify-trigger', {
        method: 'POST',
        body: JSON.stringify({ kind: 'anomaly', instanceId: 'INST-001', reason: '第二次' }),
      });
      assert.equal(second.status, 200);
      const third = await api(meta, '/__test__/notify-trigger', {
        method: 'POST',
        body: JSON.stringify({ kind: 'anomaly', instanceId: 'INST-002', reason: '另一实例' }),
      });
      assert.equal(third.status, 200);

      const frames = await collectSse(res, { maxMs: 2500, want: 2 });
      const notifyFrames = frames.filter((frame) => frame.event === 'notify');
      assert.equal(notifyFrames.length, 2, `同目标应合并为一帧，实收 ${notifyFrames.length}`);
      const merged = notifyFrames.find((frame) => frame.data.instanceId === 'INST-001');
      assert.ok(merged, 'INST-001 的合并帧应到达');
      assert.equal(merged.data.kind, 'anomaly');
      assert.equal(merged.data.body.includes('第二次'), true, '合并窗内后者替换前者');
      assert.equal(merged.data.body.split(' · ').length, 5, '正文恒为五段');
      assert.equal(
        merged.data.title,
        `${DESKTOP_NOTIFY_TITLE_PREFIX} 实例异常 · INST-001`,
        '标题 = 通知 <类别> · <实例号>',
      );
      const other = notifyFrames.find((frame) => frame.data.instanceId === 'INST-002');
      assert.ok(other, '不同目标的意图不得被合并掉');
    } finally {
      await httpServer.close();
      controller.abort();
    }
  } finally {
    cleanup(root);
  }
});

// ------------------------------------------------------------------ 通知器生产接线

test('daemon server 生产接线：升级事件 → SSE 通知意图；close 后 dispose 停止产意图', async () => {
  const root = makeRoot();
  const controller = new AbortController();
  try {
    const store = createStore({ root });
    const bus = createEventBus({ store });
    const orchestrator = stubOrchestrator();
    const server = createServer({
      root,
      orchestrator,
      bus,
      generation: 'gen-wp7-notify',
      exitOnStop: false,
      http: true,
    });
    const listened = await server.listen();
    assert.equal(listened.ok, true);
    const meta = JSON.parse(fs.readFileSync(desktopMetaPath(root), 'utf8'));

    await store.save('INST-001', {
      schemaVersion: 2,
      instanceId: 'INST-001',
      state: 'running',
      rev: 0,
      template: 'single',
      nodes: [{ nodeId: 'T-001', roleId: 'developer', round: 1, state: 'running' }],
      escalations: [
        {
          escalationId: 'ESC-001',
          state: 'pending',
          nodeId: 'T-001',
          round: 1,
          reasonCode: 'execution_failed',
          reasonDetail: '执行失败：测试未通过',
          createdAt: '2026-11-15T10:30:00Z',
        },
      ],
    });

    const res = await fetch(`http://127.0.0.1:${meta.port}/notifications/stream`, {
      headers: { Authorization: `Bearer ${meta.token}` },
      signal: controller.signal,
    });
    assert.equal(res.status, 200);

    const emitted = await bus.emit({
      instanceId: 'INST-001',
      object: 'escalation',
      objectId: 'ESC-001',
      from: null,
      to: 'pending',
      reason: 'escalation.created',
      detail: { nodeId: 'T-001', round: 1 },
    });
    assert.equal(emitted.ok, true);

    // 收到首条意图后立即走 daemon 的停止路径（dispose），再发第二条升级事件：
    // 若 dispose 生效，后续 1.2s 内不会再出现任何通知帧。
    let lifecycleClosed = false;
    const frames = await collectSse(res, {
      maxMs: 9000,
      onFrame: async (frame) => {
        if (frame.event === 'notify' && !lifecycleClosed) {
          lifecycleClosed = true;
          await server.close();
          await bus.emit({
            instanceId: 'INST-001',
            object: 'escalation',
            objectId: 'ESC-002',
            from: null,
            to: 'pending',
            reason: 'escalation.created',
            detail: { nodeId: 'T-001', round: 2 },
          });
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      },
    });

    const notifyFrames = frames.filter((frame) => frame.event === 'notify');
    const first = notifyFrames.find((frame) => frame.data.ids.includes('ESC-001'));
    assert.ok(first, '升级事件应在合并窗内变成一条通知意图');
    const intent = first.data;
    assert.equal(intent.kind, 'escalation');
    assert.deepEqual(intent.ids, ['ESC-001']);
    assert.equal(intent.instanceId, 'INST-001');
    assert.equal(intent.title, `${DESKTOP_NOTIFY_TITLE_PREFIX} ${DESKTOP_NOTIFY_CATEGORY_ESCALATION} · INST-001`);
    assert.equal(
      intent.body,
      '实例 INST-001 · 升级 ESC-001 · 节点 T-001 开发 · 第 1 轮 · 执行失败：测试未通过',
    );
    assert.equal(intent.mergedCount, 1);
    assert.ok(Number.isFinite(intent.at));
    assert.ok(lifecycleClosed, '生命周期停止路径已执行');
    assert.equal(
      notifyFrames.some((frame) => frame.data.ids.includes('ESC-002')),
      false,
      'dispose 后不得再产生通知意图',
    );
    controller.abort();
  } finally {
    controller.abort();
    cleanup(root);
  }
});
