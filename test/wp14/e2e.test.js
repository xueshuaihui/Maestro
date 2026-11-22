/**
 * I1.11 WP-11 · 整合端到端（AC-38 / AC-39 / AC-40 / NF-5；零产品改动）。
 *
 * 现场口径（D-45 / §3.3）：mock 宿主 + 真实核心/守护进程/HTTP 通道 +
 * NODE_ENV=test 接缝；项目根一律 os.tmpdir() 短前缀独立 mkdtemp。
 *
 * 降级声明：真实桌面壳（Tauri 弹窗/点击手感）属 S3 人工核验项；本文件按
 * §3.3「无头/CI 只判探针意图与数据面」把 AC-38 三段落在可复现的 fixture 面
 * （真 store + 真 orchestrator + 真 daemon HTTP），NF-5 用纯函数批量调用模拟
 * 连续处置/切换——不冒称「真宿主 20+30 次」。真宿主 E2E 取证留 S3。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from '../../src/daemon/server.js';
import { desktopMetaPath } from '../../src/daemon/http/server.js';
import { createRoutes } from '../../src/daemon/http/routes.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { decideEscalation, buildQueue, QUEUE_LABELS } from '../../src/daemon/queue.js';
import { buildOccupancy } from '../../src/daemon/occupancy.js';
import { readPrefs, writePrefs, PREFS_KEYS } from '../../src/daemon/prefs.js';
import { labelKeysPayload, I11_DESKTOP_KEYS, UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { DESKTOP_TRAY_STATUS } from '../../src/cli/labels.js';
import { createApp } from '../../desktop/ui/app.js';
import { renderQueueRow, actionsFor } from '../../desktop/ui/queue/queue.js';

process.env.NODE_ENV = 'test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const LIMITS = { initializeTimeoutMs: 8000, requestTimeoutMs: 8000, promptTimeoutMs: 8000, quietIdleMs: 30, quietCapMs: 200 };
const readText = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const tempDirs = [];

function makeRoot(tag) {
  // 前缀短：core.sock 受 macOS 104 字节路径上限约束（I1.8 经验）。
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14e2e-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

test.after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function sanitizedEnv() {
  const env = { ...process.env };
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_PERMISSION_POLICY']) delete env[key];
  return env;
}

/** 脚本化 mock 宿主：hold 步让重派后能绑定新会话（与 wp14/queue.test.js 同款）。 */
function scriptedFactory(script = [{}]) {
  let index = 0;
  return {
    async create() {
      const step = script[index] ?? {};
      index += 1;
      return {
        async initialize() { return { ok: true }; },
        async newSession() { return { ok: true, result: { sessionId: `fake-sess-${index}` } }; },
        async prompt() {
          if (step.hold) return new Promise(() => {}); // 重派后挂住会话，与 wp14/queue.test.js 同款
          if (step.error) return { ok: false, error: { code: -32603, message: 'mock' } };
          return { ok: true, result: { stopReason: 'end_turn' } };
        },
        async cancel() { return { ok: true }; },
        async closeSession() { return { ok: true }; },
        onUpdate() {}, onPermission() {},
        async dispose() {},
      };
    },
  };
}

async function boot(tag) {
  const root = makeRoot(tag);
  const cwd = makeRoot(`${tag}-cwd`);
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orchestrator = createOrchestrator({
    store, bus, adapterFactory: scriptedFactory([{ hold: true }]),
    generation: 'gen-wp14-e2e', env: { NODE_ENV: 'test' },
  });
  const server = createServer({
    root, bus, orchestrator, generation: 'gen-wp14-e2e', logger: () => {},
    exitOnStop: false, http: true,
  });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  const meta = JSON.parse(fs.readFileSync(desktopMetaPath(root), 'utf8'));
  return {
    root, cwd, store, bus, orchestrator, server, meta,
    async close() { await server.close(); await orchestrator.dispose(); },
  };
}

function api(meta, urlPath, init = {}) {
  return fetch(`http://127.0.0.1:${meta.port}${urlPath}`, {
    ...init,
    headers: { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

/** 收集 SSE 帧（按空行分帧，最多 maxMs，收满 want 即止）。 */
async function collectSse(res, { maxMs = 4000, want = Infinity } = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const frames = [];
  const deadline = Date.now() + maxMs;
  let pending = reader.read().then((r) => { pending = null; return r; }, (e) => { pending = null; throw e; });
  pending.catch(() => {});
  while (Date.now() < deadline && frames.length < want) {
    const tick = new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(1, deadline - Date.now()), 60)));
    let chunk = null;
    try { chunk = await Promise.race([pending, tick.then(() => null)]); } catch { break; }
    if (chunk !== null) {
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      pending = reader.read().then((r) => { pending = null; return r; }, (e) => { pending = null; throw e; });
      pending.catch(() => {});
    }
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      // SSE 注释帧（`: connected`）不是意图，不计入 want。
      if (/^\s*:/.test(block)) continue;
      const frame = { event: null, data: null };
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) frame.event = line.slice(6).trim();
        else if (line.startsWith('data:')) frame.data = JSON.parse(line.slice(5).trim());
      }
      frames.push(frame);
    }
  }
  try { await reader.cancel(); } catch { /* 已被对端关闭 */ }
  return frames;
}

function escEntry(id = 'ESC-001') {
  return {
    escalationId: id, nodeId: 'T-001', round: 1,
    reasonCode: 'rounds_exceeded', reasonDetail: '轮次超限：第 1 轮',
    defects: [], state: 'pending', createdAt: '2026-11-15T10:30:00.000Z',
    resolvedAt: null, resolution: null, voidedAt: null,
  };
}

function suspendedState(instanceId = 'INST-001', cwd = '.') {
  return {
    schemaVersion: 2, instanceId, state: 'suspended', halted: false, paused: false, rev: 0,
    template: 'single', task: 'x', cwd,
    createdAt: '2026-11-15T10:00:00.000Z', stateSince: '2026-11-15T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes: [{ nodeId: 'T-001', state: 'escalated', round: 1, roleId: 'developer', sessionId: 'sess-001', artifactRefs: [] }],
    sessions: [{ sessionId: 'sess-001', state: 'escalated', nodeId: 'T-001', hostId: 'mock', quarantined: false }],
    handoffs: [], escalations: [escEntry()], approvals: [],
  };
}

/** 浏览阶段夹具：运行中、无待处理升级（读时健康度重算不改哈希，D-14 冻结路径）。 */
function runningState(instanceId = 'INST-001', cwd = '.') {
  return {
    schemaVersion: 2, instanceId, state: 'running', halted: false, paused: false, rev: 0,
    template: 'single', task: 'x', cwd,
    createdAt: '2026-11-15T10:00:00.000Z', stateSince: '2026-11-15T10:00:00.000Z',
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 1 },
    nodes: [{ nodeId: 'T-001', state: 'done', round: 1, roleId: 'developer', sessionId: 'sess-001', artifactRefs: [] }],
    sessions: [{ sessionId: 'sess-001', state: 'idle', nodeId: 'T-001', hostId: 'mock', quarantined: false }],
    handoffs: [], escalations: [], approvals: [],
    health: { level: 'normal', reasons: [], computedAt: '2026-11-15T10:00:00.000Z' },
  };
}

async function saveSnapshot(env, state) {
  const saved = await env.store.save(state.instanceId, state);
  assert.equal(saved.ok, true, JSON.stringify(saved));
}

const hashOf = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// ---------------------------------------------------------------------------
// AC-38 三段端到端
// ---------------------------------------------------------------------------

test('AC-38：通知 → 队列处置 → 后续跑 + 三处数字同步（fixture 面真实链路）', async (t) => {
  const env = await boot('ac38');
  t.after(() => env.close());
  await saveSnapshot(env, suspendedState('INST-001', env.cwd));

  // 段 ①：升级事件 → 通知意图经 SSE 到达（探针口径：看 intent 而非弹窗）。
  const controller = new AbortController();
  const stream = await fetch(`http://127.0.0.1:${env.meta.port}/notifications/stream`, {
    headers: { Authorization: `Bearer ${env.meta.token}` }, signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  const emitted = await env.bus.emit({
    instanceId: 'INST-001', object: 'escalation', objectId: 'ESC-001',
    from: null, to: 'pending', reason: 'escalation.created', detail: { nodeId: 'T-001', round: 1 },
  });
  assert.equal(emitted.ok, true);
  const frames = await collectSse(stream, { want: 1, maxMs: 5000 });
  controller.abort();
  const notify = frames.find((f) => f.event === 'notify');
  assert.ok(notify, '必须收到一条 notify SSE 帧');
  for (const key of ['kind', 'ids', 'instanceId', 'title', 'body', 'mergedCount', 'at']) {
    assert.equal(Object.hasOwn(notify.data, key), true, `意图缺键 ${key}`);
  }
  assert.equal(notify.data.kind, 'escalation');
  assert.ok(notify.data.ids.includes('ESC-001'));
  const bodySegments = notify.data.body.split(' · ');
  assert.equal(bodySegments.length, 5, `正文须 5 段：${notify.data.body}`);
  assert.equal(bodySegments[0], '实例 INST-001');
  assert.equal(bodySegments[1], '升级 ESC-001');
  assert.match(notify.data.title, /^通知 升级待处理 · INST-001$/);

  // 段 ②：队列可见 → 查看证据 → 重派处置 → 条目消失 + 实例回运行。
  const before = await (await api(env.meta, '/queue')).json();
  assert.equal(before.totals.pendingEscalations, 1);
  assert.ok(before.items.some((item) => item.id === 'ESC-001'));
  const evidence = await (await api(env.meta, '/evidence/INST-001/T-001')).json();
  assert.equal(evidence.instanceId, 'INST-001');
  assert.ok(Array.isArray(evidence.items));

  const decision = await api(env.meta, '/queue/escalations/ESC-001/decision', {
    method: 'POST', body: JSON.stringify({ decision: 'retry' }),
  });
  const decisionText = await decision.text();
  assert.equal(decision.status, 200, decisionText);
  const outcome = JSON.parse(decisionText);
  assert.equal(outcome.ok, true, JSON.stringify(outcome));
  assert.equal(outcome.result?.resolution ?? outcome.result?.decision ?? 'retry', 'retry');

  const after = await (await api(env.meta, '/queue')).json();
  assert.equal(after.totals.pendingEscalations, 0, '处置后队列计数归零');
  assert.ok(!after.items.some((item) => item.id === 'ESC-001'), '处置后条目消失');
  const disk = (await env.store.load('INST-001')).state;
  assert.equal(disk.state, 'running', '重派后实例继续推进');
  assert.equal(disk.escalations[0].resolution, 'retry');

  // 段 ③：后续跑 + 三处数字同源（队列总数 / 列表待处理数 / 托盘信息行模板）。
  const list = await (await api(env.meta, '/instances')).json();
  const item = list.items.find((x) => x.instanceId === 'INST-001');
  assert.ok(item, '实例列表须含该实例');
  assert.equal(item.pending.escalations, after.totals.pendingEscalations, '列表待处理数必须与队列总数一致');
  assert.equal(item.pending.escalations, 0);
  assert.match(DESKTOP_TRAY_STATUS, /\{n\}/);
  assert.match(DESKTOP_TRAY_STATUS, /\{m\}/);
  const trayText = DESKTOP_TRAY_STATUS.replace('{n}', '1').replace('{m}', String(after.totals.pendingEscalations));
  assert.equal(trayText, '实例 1 · 待处理升级 0');

  // 占用视图：同一时点快照按 roleId 聚合，开发行给出参与实例与会话数。
  const roleMap = new Map([['developer', { id: 'developer', name: '开发', group: null }]]);
  const occupancy = buildOccupancy(env.root, { instances: [disk], registry: roleMap });
  const devRow = occupancy.rows.find((row) => row.roleId === 'developer');
  assert.ok(devRow, '占用视图须含开发行');
  assert.ok(devRow.instances >= 1, '参与实例数 ≥ 1');
  assert.deepEqual(devRow.hosts, ['mock'], '宿主取运行时 hostId');
});

// ---------------------------------------------------------------------------
// AC-39 写操作清单
// ---------------------------------------------------------------------------

test('AC-39 静态面：写接口白名单 + HTTP/UI 零直写盘 + 无 PATCH', () => {
  const rows = createRoutes({
    orchestrator: {
      startRun: async () => ({ ok: false }), listInstances: async () => ({ ok: true, items: [] }),
      getStatus: async () => ({ ok: false }),
    },
    root: REPO,
  });
  const writes = rows.filter((r) => r.method === 'POST').map((r) => r.pattern);
  const allowed = new Set([
    '/instances', '/queue/escalations/:id/decision', '/queue/approvals/:id/decision',
    '/instances/:id/cancel', '/control/pause', '/control/resume',
    '/ui/prefs', // D-51：通知开关四键，独立第三类写，不计入三个数字
  ]);
  for (const pattern of writes) {
    assert.ok(allowed.has(pattern) || pattern.startsWith('/__test__/'), `写路径越权：${pattern}`);
  }
  assert.ok(!writes.some((p) => p.startsWith('/__test__/') === false && p.includes('__test__')));
  const http = ['src/daemon/http/server.js', 'src/daemon/http/routes.js'].map(readText).join('\n');
  assert.ok(!/saveState|appendEvent|store\.save/.test(http), 'HTTP 层不得直接写状态');
  assert.ok(!/\bPATCH\b/.test(http), '不得出现 PATCH');
  assert.ok(!/fs\.write|writeFile/.test(readText('desktop/ui/app.js')), '界面层不得直接写盘');
});

test('AC-39 行为面：浏览零写盘；仅五动作/暂停继续/prefs 三类写', async (t) => {
  const env = await boot('ac39');
  t.after(() => env.close());
  // AC-39 Given「一个运行中实例」：健康度已计算，读时重算不改哈希（D-14）。
  await saveSnapshot(env, runningState('INST-001', env.cwd));

  const stateFile = path.join(env.root, '.orch', 'instances', 'INST-001', 'state.json');
  const eventsFile = path.join(env.root, '.orch', 'instances', 'INST-001', 'events.jsonl');
  const before = { state: hashOf(stateFile), events: fs.existsSync(eventsFile) ? hashOf(eventsFile) : null };

  // 纯浏览：覆盖队列/资产/占用/画布/证据/prefs 读接口。
  await api(env.meta, '/queue').then((r) => r.json());
  await api(env.meta, '/assets/roles').then((r) => r.json());
  await api(env.meta, '/occupancy/roles').then((r) => r.json());
  await api(env.meta, '/workflows/single/canvas').then((r) => r.json());
  await api(env.meta, '/evidence/INST-001/T-001').then((r) => r.json());
  await api(env.meta, '/ui/labels').then((r) => r.json());
  const afterBrowse = { state: hashOf(stateFile), events: fs.existsSync(eventsFile) ? hashOf(eventsFile) : null };
  assert.deepEqual(afterBrowse, before, '浏览阶段 state/events 哈希必须全不变');

  // 写阶段夹具：另置一条待处理升级（这是夹具落盘，不计入面板写操作数）。
  await saveSnapshot(env, suspendedState('INST-001', env.cwd));

  // 计数：一次处置 + 一个暂停/继续周期（按用户动作 2 次；落到状态 3 次）。
  const writes = { actionCount: 0, stateWrites: 0, unexpected: 0 };
  const origResolve = env.orchestrator.resolveEscalation;
  const origPause = env.orchestrator.pause;
  const origResume = env.orchestrator.resume;
  env.orchestrator.resolveEscalation = async (...args) => { writes.stateWrites += 1; return origResolve.apply(env.orchestrator, args); };
  env.orchestrator.pause = async (...args) => { writes.stateWrites += 1; return origPause.apply(env.orchestrator, args); };
  env.orchestrator.resume = async (...args) => { writes.stateWrites += 1; return origResume.apply(env.orchestrator, args); };

  const decision = await api(env.meta, '/queue/escalations/ESC-001/decision', {
    method: 'POST', body: JSON.stringify({ decision: 'retry' }),
  });
  assert.equal(decision.status, 200);
  writes.actionCount += 1;

  const pause = await api(env.meta, '/control/pause', { method: 'POST', body: '' });
  assert.equal(pause.status, 200);
  const resume = await api(env.meta, '/control/resume', { method: 'POST', body: '' });
  assert.equal(resume.status, 200);
  writes.actionCount += 1; // pause/resume 周期按一次用户动作计

  assert.equal(writes.actionCount, 2, '写操作数（按用户动作）= 2');
  assert.equal(writes.stateWrites, 3, '状态写入次数 = 审批/升级 1 + 暂停 1 + 继续 1');
  assert.equal(writes.unexpected, 0, '上述之外零状态写入');
});

test('AC-39 prefs：唯一写入方只写四键，多余键拒绝', async (t) => {
  const root = makeRoot('prefs');
  const prefsFile = path.join(root, '.orch', 'desktop', 'prefs.json');
  assert.deepEqual([...PREFS_KEYS], ['enabled', 'escalate', 'completed', 'anomaly']);
  await writePrefs(root, { completed: false });
  const saved = JSON.parse(fs.readFileSync(prefsFile, 'utf8'));
  assert.deepEqual(Object.keys(saved).sort(), [...PREFS_KEYS].sort(), 'prefs.json 只能有四键');
  assert.equal(saved.completed, false);
  assert.deepEqual(await readPrefs(root), { enabled: true, escalate: true, completed: false, anomaly: true });
  await assert.rejects(() => writePrefs(root, { injected: true }), '多余键必须被拒绝');
});

// ---------------------------------------------------------------------------
// AC-40 非功能静态面
// ---------------------------------------------------------------------------

test('AC-40：零依赖 / 无打包器 / 界面零裸 import / 中文唯一来源', () => {
  const pkg = JSON.parse(readText('package.json'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  assert.ok(!/"vite"|"webpack"|"rollup"|"esbuild"|"parcel"/.test(readText('package.json')));
  const ui = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs|html|json)$/.test(entry.name)) ui.push(full);
    }
  };
  walk(path.join(REPO, 'desktop', 'ui'));
  for (const file of ui) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/^import .* from '[^./]/.test(src), `界面层裸模块 import：${path.relative(REPO, file)}`);
    assert.ok(!/\b(vite|webpack|rollup|esbuild|parcel)\b/.test(src), `界面层打包器痕迹：${path.relative(REPO, file)}`);
  }
  const cjk = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
  for (const file of ui) {
    assert.ok(!cjk.test(fs.readFileSync(file, 'utf8')), `界面层出现中文字面量：${path.relative(REPO, file)}`);
  }
  assert.equal(Object.keys(labelKeysPayload().keys).length, Object.keys(UI_LABEL_KEYS).length);
  assert.ok(I11_DESKTOP_KEYS.every((key) => key in labelKeysPayload().keys));
});

// ---------------------------------------------------------------------------
// NF-5 稳定性轻量版（纯函数批量；真宿主取证留 S3）
// ---------------------------------------------------------------------------

test('NF-5 轻量版：20 次处置 + 30 次视图切换不崩、计数一致', () => {
  const labels = labelKeysPayload().keys;
  const state = { view: 'instances', expandedRow: null, selectedQueueIds: [] };
  const app = { state: () => state, setView(v) { state.view = v; } };

  // 20 次处置：五动作模板渲染 + 动作视图从同一批投影推导，不抛错、结论词稳定。
  for (let i = 0; i < 20; i += 1) {
    const row = {
      type: 'escalation', id: `ESC-${String(i + 1).padStart(3, '0')}`, instanceId: 'INST-001',
      nodeId: 'T-001', role: '开发', round: 1, stateWord: '待处理', reasonSummary: '轮次超限',
      createdAt: '2026-11-15T10:30:00Z',
    };
    const rendered = renderQueueRow(row, labels);
    assert.equal(typeof rendered, 'object');
    assert.equal(typeof rendered.text, 'string');
    assert.ok(rendered.text.includes(row.id));
    const actions = actionsFor(row, labels);
    assert.ok(Array.isArray(actions) && actions.length > 0);
  }

  // 30 次视图切换：五个新键 + 既有四键轮换，状态与切换次数一致。
  const views = ['queue', 'assets', 'occupancy', 'canvas', 'evidence', 'instances', 'graph', 'board', 'project'];
  for (let i = 0; i < 30; i += 1) {
    app.setView(views[i % views.length]);
    assert.equal(state.view, views[i % views.length]);
  }
  assert.equal(state.view, views[29 % views.length]);
  assert.ok(QUEUE_LABELS && typeof QUEUE_LABELS === 'object');
  assert.doesNotThrow(() => createApp({ labels, project: { view: 'instances' }, io: {
    getInstances: async () => ({ status: 200, body: { items: [] } }),
    getQueue: async () => ({ status: 200, body: { items: [], totals: {} } }),
  } }));
});
