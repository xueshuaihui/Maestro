/**
 * I1.10a WP-9 · AC-27 只读与本地性（批次 6，DAG 汇合点）。
 *
 * 主责 AC-27：不写实例、只绑回环、无凭据拒绝。断言面：
 * 1) 两组文件哈希不变：`.orch/instances/INST-001/state.json` 与
 *    `events.jsonl` 在整套读操作前后 `sha256` 相等；整个 `.orch` 文件面只允许
 *    新增 `.orch/desktop/views/INST-001.json`（拖拽偏好的唯一落点）。
 * 2) 四组状态深比较相等：读前/读后的 `nodes` / `sessions` / `handoffs` /
 *    `escalations` 逐字段 `deepEqual`。
 * 3) 无凭据 401；`/ui/` 静态资源匿名 200（裁决 R 口径），但数据面
 *    `/ui/labels`、`/instances`、SSE、图快照全部 401（含 `?token=` 仍 401）。
 * 4) `lsof -nP -iTCP:<port> -sTCP:LISTEN` 的每一行本地地址都是
 *    `127.0.0.1:<port>`；`0.0.0.0` / `*:<port>` 零命中。
 *
 * 夹具：项目根 `os.tmpdir()`；`NODE_ENV=test` 必注入；端口与令牌从
 * `.orch/desktop.json` 读取，绝不硬编码；先空根拉起核心再写快照（§3.3）。
 * 渲染/视图/看板全部调用 `desktop/ui` 的纯模块，不写实例文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createViewState } from '../../desktop/ui/graph/view.js';
import { hoverSet } from '../../desktop/ui/graph/highlight.js';
import { edgeHidden } from '../../src/daemon/graph.js';
import { projectBoard } from '../../desktop/ui/board/board.js';
import { renderListRow, sortInstances } from '../../desktop/ui/list/list.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BIN = path.join(REPO, 'bin', 'orch.js');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(makeValue, timeoutMs = 30_000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

function envFor(root) {
  return { ...process.env, NODE_ENV: 'test', MAESTRO_CONFIG_DIR: path.join(root, 'config') };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeHostConfig(root) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK] },
    limits: { ...LIMITS },
  }, null, 2), 'utf8');
}

function writeFixtures(root) {
  const workflowDir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(path.join(workflowDir, 'readonly-flow.yaml'), [
    'workflow: readonly-flow',
    'nodes:',
    '  - id: T-001',
    '    node_type: role',
    '    role: dev',
    '    order: 0',
    '  - id: T-002',
    '    node_type: role',
    '    role: qa',
    '    order: 1',
    '  - id: H-001',
    '    node_type: human',
    '    title: 人工验收',
    '    order: 2',
    'edges:',
    '  - from: T-001',
    '    to: T-002',
    '  - from: T-002',
    '    to: H-001',
  ].join('\n'), 'utf8');

  const dir = path.join(root, '.orch', 'instances', 'INST-001');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({
    schemaVersion: 2,
    instanceId: 'INST-001',
    template: 'code-loop',
    state: 'running',
    workflowRef: 'readonly-flow',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes: [
      { nodeId: 'T-001', roleId: 'dev', state: 'done', round: 1 },
      { nodeId: 'T-002', roleId: 'qa', state: 'running', round: 1 },
    ],
    sessions: [
      { sessionId: 'SESS-1', nodeId: 'T-002', state: 'tool_running', hostId: 'mock', createdAt: '2026-01-01T00:02:10.000Z' },
    ],
    handoffs: [
      { handoffId: 'HO-001', edge: { from: 'T-001', to: 'T-002', kind: 'forward' }, state: 'delivered', round: 1 },
    ],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-001', round: 1, state: 'pending' },
    ],
    health: { level: 'attention', reasons: ['pending_escalation'], nodeTimeoutMs: 30000 },
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'events.jsonl'), [
    JSON.stringify({ seq: 1, object: 'node', reason: 'state.change', ts: '2026-01-01T00:02:00.000Z' }),
    JSON.stringify({ seq: 2, object: 'handoff', reason: 'handoff.delivered', ts: '2026-01-01T00:03:00.000Z' }),
    JSON.stringify({ seq: 3, object: 'session', reason: 'session.state', ts: '2026-01-01T00:04:00.000Z' }),
  ].join('\n') + '\n', 'utf8');
  return {
    stateFile: path.join(dir, 'state.json'),
    eventsFile: path.join(dir, 'events.jsonl'),
  };
}

/** Regular-file snapshot of `.orch` (sockets and directories excluded). */
function snapshotTree(root) {
  const out = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = path.relative(path.join(root, '.orch'), full);
        out.set(rel, sha256File(full));
      }
    }
  };
  walk(path.join(root, '.orch'));
  return out;
}

function fourGroups(state) {
  return {
    nodes: state?.nodes ?? null,
    sessions: state?.sessions ?? null,
    handoffs: state?.handoffs ?? null,
    escalations: state?.escalations ?? null,
  };
}

/** lsof first (macOS), `netstat` fallback; both lines carry the local address. */
function listeningLines(port) {
  const lsof = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 20_000 });
  if (lsof.status === 0 && (lsof.stdout ?? '').trim().length > 0) {
    return {
      tool: 'lsof',
      lines: lsof.stdout.split('\n').filter((line) => line.trim().length > 0 && !line.startsWith('COMMAND')),
    };
  }
  const netstat = spawnSync('netstat', ['-an', '-p', 'tcp'], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(netstat.status, 0, `lsof 与 netstat 均不可用：\n${lsof.stderr}\n${netstat.stderr}`);
  return {
    tool: 'netstat',
    lines: (netstat.stdout ?? '')
      .split('\n')
      .filter((line) => line.includes(`.${port} `) && line.includes('LISTEN')),
  };
}

test('AC-27：读操作不写实例、四组状态不变、仅回环监听、数据面无凭据 401', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-readonly-'));
  writeHostConfig(root);

  const daemon = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env: envFor(root),
    stdio: 'ignore',
  });
  t.after(async () => {
    if (daemon.exitCode === null && daemon.signalCode === null) {
      daemon.kill('SIGTERM');
      await waitFor(() => daemon.exitCode !== null || daemon.signalCode !== null, 10_000);
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  const meta = await waitFor(() => readJson(path.join(root, '.orch', 'desktop.json')), 30_000);
  assert.ok(meta, 'desktop.json 未落盘');

  // §3.3 铁序：先空根拉起核心（instance status 返回不存在），再写快照。
  const empty = spawnSync(process.execPath, [BIN, 'instance', 'status', 'INST-001'], {
    cwd: root, env: envFor(root), encoding: 'utf8', timeout: 30_000, windowsHide: true,
  });
  assert.equal(empty.status, 1);
  assert.equal((empty.stdout ?? '').trim(), '实例 INST-001 · 不存在');

  const files = writeFixtures(root);
  const stateBefore = readJson(files.stateFile);
  const groupsBefore = fourGroups(stateBefore);
  const hashBefore = {
    state: sha256File(files.stateFile),
    events: sha256File(files.eventsFile),
  };
  const treeBefore = snapshotTree(root);

  const base = `http://127.0.0.1:${meta.port}`;
  const headers = { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' };
  const get = async (pathname) => {
    const res = await fetch(`${base}${pathname}`, { headers });
    return { status: res.status, body: await res.json() };
  };

  // ---- 读序列：列表 → 流程图 → 缩放/拖拽/聚焦 → 切看板 → 未开始开关 → 重复刷新三次
  const labels = (await get('/ui/labels')).body.keys;
  const list = await get('/instances');
  assert.equal(list.status, 200);
  const graphBody = await get('/instances/INST-001/graph');
  assert.equal(graphBody.status, 200);
  const graph = graphBody.body;
  assert.ok(graph.nodes.length > 0 && graph.edges.length > 0);

  // 列表行（同一渲染模块）
  const rows = sortInstances(list.body.items).map((item) => renderListRow(item, labels));
  assert.equal(rows.length, 1);
  assert.match(rows[0], /^实例 INST-001 · 编码闭环 · 运行中/);

  // 缩放 / 平移 / 拖拽 / 聚焦 / 退出聚焦（纯模块，不触盘）
  const view = createViewState({ nodes: graph.nodes, edges: graph.edges });
  view.setZoom(1.5);
  view.setPan(120, -40);
  view.applyOffsets({ 'role:dev': { dx: 40, dy: 60 } });
  const focused = view.focus('role:dev', 2);
  assert.ok(Array.isArray(focused) && focused.length > 0);
  view.exitFocus();
  assert.deepEqual(view.getOffsets(), { 'role:dev': { dx: 40, dy: 60 } });

  // 「显示未开始连接线」开/关：只影响纯投影，不改图数据。
  const notStarted = graph.edges.find((edge) => edge.aggregateStatus === 'not_started') ?? null;
  if (notStarted !== null) {
    assert.equal(edgeHidden(notStarted), true);
    assert.equal(edgeHidden(notStarted, { showNotStarted: true }), false);
  }

  // 切看板（纯派生）
  const board = projectBoard({ state: { nodes: graph.stateNodes }, graph, labels });
  assert.ok(Array.isArray(board.columns) && board.columns.length === 7);

  // 悬停高亮（纯派生）
  const hover = hoverSet(graph, graph.nodes.find((node) => node.type === 'role').id);
  assert.ok(hover.opaqueIds.length > 0 && hover.dimIds.length > 0);

  // 重复刷新三次（列表 + 图）
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await get('/instances')).status, 200);
    assert.equal((await get('/instances/INST-001/graph')).status, 200);
    assert.equal((await get('/workflows')).status, 200);
  }

  // ---- 拖拽偏好只写 `.orch/desktop/views/`（壳层写路径；纯模块零 fs）
  const viewsDir = path.join(root, '.orch', 'desktop', 'views');
  const viewsFile = path.join(viewsDir, 'INST-001.json');
  fs.mkdirSync(viewsDir, { recursive: true });
  fs.writeFileSync(viewsFile, JSON.stringify({
    offsets: view.getOffsets(),
    updatedAt: '2026-01-01T00:30:00Z',
  }, null, 2), 'utf8');
  assert.deepEqual(readJson(viewsFile).offsets, { 'role:dev': { dx: 40, dy: 60 } });
  assert.equal(fs.existsSync(path.join(viewsDir, 'INST-002.json')), false, '不得为其它实例写视图偏好');

  // 结构性兜底：拖拽偏好的唯一产品写路径是壳层 `write_view_command`，目标
  // 目录必须是 `.orch/desktop/views/`；`desktop/ui` 纯模块不得自行落盘。
  const configRs = fs.readFileSync(path.join(REPO, 'desktop', 'src-tauri', 'src', 'config.rs'), 'utf8');
  assert.match(configRs, /join\("\.orch"\)[\s\S]{0,120}join\("desktop"\)[\s\S]{0,120}join\("views"\)/,
    '壳层视图偏好路径必须落在 .orch/desktop/views/');
  assert.match(configRs, /fn write_view\(/, '壳层必须保留 write_view 作为唯一写入口');
  const uiFsWriters = [];
  const walkUi = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkUi(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        fs.readFileSync(full, 'utf8').split('\n').forEach((line, index) => {
          if (/\bwriteFile|writeFileSync\b/.test(line)) {
            uiFsWriters.push(`${path.relative(REPO, full)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  };
  walkUi(path.join(REPO, 'desktop', 'ui'));
  assert.deepEqual(uiFsWriters, [], `desktop/ui 不得直接写文件：\n${uiFsWriters.join('\n')}`);

  // ---- 1) 两组文件哈希不变
  assert.equal(sha256File(files.stateFile), hashBefore.state, 'state.json 读操作后哈希必须不变');
  assert.equal(sha256File(files.eventsFile), hashBefore.events, 'events.jsonl 读操作后哈希必须不变');

  // 整个 `.orch` 文件面：只允许新增 views/INST-001.json
  const treeAfter = snapshotTree(root);
  const added = [...treeAfter.keys()].filter((key) => !treeBefore.has(key)).sort();
  const removed = [...treeBefore.keys()].filter((key) => !treeAfter.has(key)).sort();
  const changed = [...treeBefore.keys()]
    .filter((key) => treeAfter.has(key) && treeAfter.get(key) !== treeBefore.get(key))
    .sort();
  assert.deepEqual(added, [path.join('desktop', 'views', 'INST-001.json')], `只允许新增拖拽偏好文件：${added}`);
  assert.deepEqual(removed, [], `读操作不得删除文件：${removed}`);
  assert.deepEqual(changed, [], `读操作不得改写任何文件：${changed}`);

  // ---- 2) 四组状态深比较相等
  const stateAfter = readJson(files.stateFile);
  assert.deepEqual(fourGroups(stateAfter), groupsBefore, 'nodes/sessions/handoffs/escalations 必须逐字段不变');
  assert.deepEqual(stateAfter, stateBefore, '实例快照必须整体不变');

  // ---- 3) 静态面匿名 200、数据面全部 401（裁决 R 口径）
  const anonRoot = await fetch(`${base}/ui/`);
  assert.equal(anonRoot.status, 200, '/ui/ 静态资源必须匿名可达');
  assert.match(anonRoot.headers.get('content-type') ?? '', /text\/html/);
  const anonApp = await fetch(`${base}/ui/app.js`);
  assert.equal(anonApp.status, 200, '/ui/app.js 静态资源必须匿名可达');
  const bearerApp = await fetch(`${base}/ui/app.js`, { headers });
  assert.equal(bearerApp.status, 200);
  assert.equal(await anonApp.text(), await bearerApp.text(), '匿名与 Bearer 的静态正文必须逐字相同');

  const dataPlane = [
    '/ui/labels',
    `/ui/labels?token=${meta.token}`,
    '/instances',
    '/instances/stream',
    '/instances/INST-001/graph',
    '/instances/INST-001/graph/stream',
    '/workflows',
  ];
  for (const pathname of dataPlane) {
    const res = await fetch(`${base}${pathname}`);
    assert.equal(res.status, 401, `数据面 ${pathname} 无凭据必须 401`);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: 'UNAUTHORIZED' }, `401 正文只允许错误码：${pathname}`);
    assert.equal(text.includes('INST-001'), false, `401 正文不得包含实例数据：${pathname}`);
  }
  const postAnon = await fetch(`${base}/instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template: 'single', task: 'x' }),
  });
  assert.equal(postAnon.status, 401, 'POST /instances 无凭据必须 401');

  // ---- 4) 仅回环监听：全部 127.0.0.1:<port>，0.0.0.0 / 通配零命中
  const listen = listeningLines(meta.port);
  assert.ok(listen.lines.length > 0, `${listen.tool} 未显示监听行`);
  for (const line of listen.lines) {
    assert.ok(
      line.includes(`127.0.0.1:${meta.port}`),
      `${listen.tool} 监听地址不是 127.0.0.1:${meta.port}：${line}`,
    );
    assert.equal(line.includes('0.0.0.0'), false, `${listen.tool} 出现 0.0.0.0 通配：${line}`);
    assert.equal(line.includes(`*:${meta.port}`), false, `${listen.tool} 出现通配监听：${line}`);
    assert.equal(line.includes('[::]'), false, `${listen.tool} 出现 IPv6 通配监听：${line}`);
  }
});
