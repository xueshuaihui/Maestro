/**
 * I1.10a WP-9 · AC-26 端到端验收（批次 6，DAG 汇合点）。
 *
 * 主责 AC-26 规划逐字验收句：
 *   「双击应用图标打开主窗口，能看到所有实例的健康度列表；点击实例进入角色
 *     流程图，含人工节点和子工作流的实例在流程图上拓扑完整；关闭主窗口缩到
 *     托盘，daemon 继续运行。」
 *
 * 两段：
 * 1) daemon 面（恒跑，不依赖 bundle）：先空根拉起核心 → 按 §3.3 铁序写
 *    `INST-001`（4 节点 4 边，含 human + subworkflow）与 `INST-002`（已完成
 *    单节点）→ 经真实回环通道取列表并渲染两行（与 A-1 逐字）→ 取图快照
 *    （nodes/edges 非空、dangling === 0）→ `graph-dump.mjs` 全量导出
 *    （A-8 两行图例、hover 的 opaqueIds/dimIds 非空）→ R-01 回归（输入显式
 *    `legend:null`/`hover:null` 时仍被补齐）。
 * 2) 壳面（仅 bundle 产物存在时跑，否则显式 `t.skip` 并写明原因）：
 *    `ready`（launch→ready ≤ 3000ms）→ `rows` → `graph-shown`（ctl
 *    `open-instance/INST-001`）→ `closed`（`window.visible === false`）；
 *    关窗前后 `daemon.pid` 相等，随后 `orch instance status INST-001` 仍成功。
 *
 * 渲染与 AC-07/14 同批模块：列表走 `desktop/ui/list/list.js`，图走
 * `src/daemon/graph.js` + `desktop/harness/graph-dump.mjs`（legend/highlight
 * 惰性动态 import），不存在测试专用渲染分支。
 *
 * 夹具纪律：项目根 `os.tmpdir()`；`NODE_ENV=test` 必注入；端口/令牌一律从
 * `.orch/desktop.json` 读；壳夹具直接执行 `Contents/MacOS/maestro`（禁
 * `open -na`，LaunchServices 不继承环境变量）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderListRow, sortInstances } from '../../desktop/ui/list/list.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BIN = path.join(REPO, 'bin', 'orch.js');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const HARNESS = path.join(REPO, 'desktop', 'harness', 'graph-dump.mjs');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const APP = path.join(REPO, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Maestro.app');
const SHELL = path.join(APP, 'Contents', 'MacOS', 'maestro');

/** A-8 图例两行（逐字基线）。 */
const A8_LEGEND = [
  '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与',
  '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流',
];

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

// Cross-process mutex shared with the other shell fixtures (the single-instance
// plugin keys its lock on the bundle identifier, so shell launches serialize).
const SHELL_LOCK_DIR = path.join(os.tmpdir(), 'maestro-wp1-shell.lock');
const SHELL_LOCK_TTL_MS = 10 * 60 * 1000;

async function withShellLock(fn) {
  for (;;) {
    try {
      fs.mkdirSync(SHELL_LOCK_DIR);
      break;
    } catch {
      try {
        const stat = fs.statSync(SHELL_LOCK_DIR);
        if (Date.now() - stat.mtimeMs > SHELL_LOCK_TTL_MS) {
          fs.rmSync(SHELL_LOCK_DIR, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      await sleep(100);
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(SHELL_LOCK_DIR, { recursive: true, force: true });
  }
}

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
  return {
    ...process.env,
    NODE_ENV: 'test',
    MAESTRO_CONFIG_DIR: path.join(root, 'config'),
  };
}

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readProbe(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function runCtl(ctlDir, name) {
  fs.mkdirSync(path.join(ctlDir, name), { recursive: true });
}

function cloudChannel(meta) {
  const base = `http://127.0.0.1:${meta.port}`;
  const headers = { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' };
  return {
    base,
    async get(pathname) {
      const res = await fetch(`${base}${pathname}`, { headers });
      return { status: res.status, body: await res.json() };
    },
  };
}

function startDaemon(root) {
  const child = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env: envFor(root),
    stdio: 'ignore',
  });
  const ready = waitFor(() => readJson(path.join(root, '.orch', 'desktop.json')), 30_000);
  return { child, ready };
}

async function stopDaemon(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000, 100);
}

/** 空根拉起核心后先确认实例不存在（§3.3 铁序第一步）。 */
function assertEmptyRoot(root) {
  const res = spawnSync(process.execPath, [BIN, 'instance', 'status', 'INST-001'], {
    cwd: root,
    env: envFor(root),
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(res.status, 1, `空根状态查询必须失败：\n${res.stdout}\n${res.stderr}`);
  assert.equal((res.stdout ?? '').trim(), '实例 INST-001 · 不存在');
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

/**
 * AC-26 夹具：`INST-001` 运行中，定义 4 节点 4 边（2 role + human +
 * subworkflow，含 1 条回流），子工作流 `child-flow` 有 3 个角色；
 * `INST-002` 已完成单节点。快照在核心拉起后写入（避免 boot 对账改写）。
 */
function writeAcceptanceFixtures(root) {
  const workflowDir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });

  fs.writeFileSync(path.join(workflowDir, 'acceptance-flow.yaml'), [
    'workflow: acceptance-flow',
    'title: acceptance',
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
    '  - id: S-001',
    '    node_type: subworkflow',
    '    title: 发布子流程',
    '    workflow: child-flow',
    '    order: 3',
    'edges:',
    '  - from: T-001',
    '    to: T-002',
    '  - from: T-002',
    '    to: H-001',
    '  - from: H-001',
    '    to: S-001',
    '  - from: S-001',
    '    to: T-001',
    '    kind: backflow',
  ].join('\n'), 'utf8');

  fs.writeFileSync(path.join(workflowDir, 'child-flow.yaml'), [
    'workflow: child-flow',
    'nodes:',
    '  - id: C-001',
    '    node_type: role',
    '    role: pack-a',
    '  - id: C-002',
    '    node_type: role',
    '    role: pack-b',
    '  - id: C-003',
    '    node_type: role',
    '    role: pack-c',
  ].join('\n'), 'utf8');

  writeState(root, 'INST-001', {
    schemaVersion: 2,
    instanceId: 'INST-001',
    template: 'code-loop',
    state: 'running',
    workflowRef: 'acceptance-flow',
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
  });

  writeState(root, 'INST-002', {
    schemaVersion: 2,
    instanceId: 'INST-002',
    template: 'single',
    state: 'completed',
    createdAt: '2026-01-01T00:00:30.000Z',
    updatedAt: '2026-01-01T00:20:00.000Z',
    nodes: [{ nodeId: 'T-001', state: 'done' }],
    sessions: [],
    handoffs: [],
    escalations: [],
    health: { level: 'ended', reasons: [], nodeTimeoutMs: 30000 },
  });
}

function writeState(root, instanceId, snapshot) {
  const dir = path.join(root, '.orch', 'instances', instanceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(snapshot, null, 2), 'utf8');
}

function graphSignature(graph) {
  const ids = new Set(graph.nodes.map((node) => node.id));
  let dangling = 0;
  for (const edge of graph.edges) {
    if (!ids.has(edge.from)) dangling += 1;
    if (!ids.has(edge.to)) dangling += 1;
  }
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    dangling,
    types: graph.nodes.map((node) => node.type).sort(),
  };
}

function runHarness(args) {
  const res = spawnSync(process.execPath, [HARNESS, ...args], {
    cwd: REPO,
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.equal(res.status, 0, `graph-dump 失败：\n${res.stdout}\n${res.stderr}`);
  return res;
}

// ---------------------------------------------------------------------------
// 1) daemon 面（恒跑）
// ---------------------------------------------------------------------------

test('AC-26 daemon 面：两行列表、拓扑完整的图快照、graph-dump 全量导出与 R-01 回归', async (t) => {
  const root = tmpRoot('maestro-i10a-accept-daemon-');
  writeHostConfig(root);
  const { child, ready } = startDaemon(root);
  t.after(async () => {
    await stopDaemon(child);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const meta = await ready;
  assert.ok(meta, 'desktop.json 未落盘（回环通道未就绪）');
  assertEmptyRoot(root);
  writeAcceptanceFixtures(root);

  const api = cloudChannel(meta);

  // 文案与列表：与 A-1 逐字（渲染走 desktop/ui 的同一批模块）。
  const labelsBody = await api.get('/ui/labels');
  assert.equal(labelsBody.status, 200);
  const labels = labelsBody.body.keys;
  const list = await api.get('/instances');
  assert.equal(list.status, 200);
  const rows = sortInstances(list.body.items).map((item) => renderListRow(item, labels));
  assert.deepEqual(rows, [
    '实例 INST-001 · 编码闭环 · 运行中 · 进度 1/2 · 待处理 1 · 需关注',
    '实例 INST-002 · 单节点 · 已完成 · 进度 1/1 · 待处理 0 · 已结束',
  ], 'AC-26 列表两行必须与 A-1 逐字相等（需关注置顶）');

  // 图快照：4 节点 4 边、无悬空、human + subworkflow 折叠组齐全。
  const graphBody = await api.get('/instances/INST-001/graph');
  assert.equal(graphBody.status, 200);
  const graph = graphBody.body;
  const sig = graphSignature(graph);
  assert.deepEqual(sig, {
    nodes: 4,
    edges: 4,
    dangling: 0,
    types: ['human', 'role', 'role', 'subworkflow'],
  }, 'AC-26 拓扑必须完整：4 节点 4 边、悬空 0、四类节点齐');
  const sub = graph.nodes.find((node) => node.type === 'subworkflow');
  assert.equal(sub.collapsed, true, '子工作流必须是折叠组');
  assert.equal(sub.memberCount, 3, '子工作流角色数必须来自 child-flow 定义');
  assert.deepEqual(
    graph.stateNodes.map((node) => ({ nodeId: node.nodeId, roleId: node.roleId })),
    [{ nodeId: 'T-001', roleId: 'dev' }, { nodeId: 'T-002', roleId: 'qa' }],
    'stateNodes 必须保留快照 roleId 绑定（Q-2）',
  );

  // graph-dump 全量导出：A-8 两行图例 + hover 集合非空。
  const out1 = path.join(root, 'graph-full.json');
  runHarness(['--project', root, '--instance', 'INST-001', '--payload', out1]);
  const full = readJson(out1);
  assert.ok(full, 'graph-dump 未产出 payload');
  assert.equal(full.legend.anchor, 'bottom-left');
  assert.deepEqual(full.legend.lines, A8_LEGEND, 'A-8 图例两行必须逐字相等');
  assert.ok(Array.isArray(full.hover.opaqueIds) && full.hover.opaqueIds.length > 0, 'hover.opaqueIds 不得为空');
  assert.ok(Array.isArray(full.hover.dimIds) && full.hover.dimIds.length > 0, 'hover.dimIds 不得为空');

  // R-01 回归：输入显式 legend:null / hover:null 时，二次导出仍被补齐。
  const input = path.join(root, 'graph-null.json');
  const nulled = { ...full, legend: null, hover: null };
  fs.writeFileSync(input, JSON.stringify(nulled, null, 2), 'utf8');
  const out2 = path.join(root, 'graph-refilled.json');
  runHarness(['--payload', input, '--project', root, '--out', out2]);
  const refilled = readJson(out2);
  assert.ok(refilled, 'R-01：二次导出未产出 payload');
  assert.deepEqual(refilled.legend?.lines, A8_LEGEND, 'R-01：显式 legend:null 必须被新值覆盖');
  assert.ok(refilled.hover?.opaqueIds?.length > 0, 'R-01：显式 hover:null 必须被新值覆盖');
  assert.deepEqual(refilled.hover?.dimIds, full.hover.dimIds, 'R-01：重导出的 hover 集合必须与首次一致');
  assert.deepEqual(refilled.nodes, full.nodes, 'R-01：重导出必须保留 nodes');
  assert.deepEqual(refilled.edges, full.edges, 'R-01：重导出必须保留 edges');

  // AC-26 架构检查：桌面层零测试专用渲染分支（与 AC-07/14 同批模块）。
  const uiFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) uiFiles.push(fullPath);
    }
  };
  walk(path.join(REPO, 'desktop', 'ui'));
  const testBranches = [];
  for (const file of uiFiles) {
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/NODE_ENV|process\.env|__TEST__|\bisTest\b/.test(line)) {
        testBranches.push(`${path.relative(REPO, file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(testBranches, [], `desktop/ui 出现测试专用分支：\n${testBranches.join('\n')}`);
});

// ---------------------------------------------------------------------------
// 2) 壳面（仅有真实 bundle 时跑）
// ---------------------------------------------------------------------------

test('AC-26 壳面：ready → rows → graph-shown → closed，pid 不变且实例仍可读', async (t) => {
  if (!fs.existsSync(SHELL)) {
    t.skip(`Maestro.app bundle 不存在（${SHELL}），壳面探针无法真跑；daemon 面断言已在上一条用例完成`);
    return;
  }

  await withShellLock(async () => {
    const root = tmpRoot('maestro-i10a-accept-shell-');
    writeHostConfig(root);
    const { child: daemon, ready } = startDaemon(root);
    const probeFile = path.join(root, 'probe.jsonl');
    const ctlDir = path.join(root, 'ctl');
    fs.mkdirSync(ctlDir, { recursive: true });

    let shell = null;
    t.after(async () => {
      if (shell && shell.exitCode === null && shell.signalCode === null) shell.kill('SIGKILL');
      await stopDaemon(daemon);
      fs.rmSync(root, { recursive: true, force: true });
    });

    const meta = await ready;
    assert.ok(meta, 'desktop.json 未落盘');
    assertEmptyRoot(root);
    writeAcceptanceFixtures(root);

    // 壳直接执行二进制（禁 open -na）：继承 NODE_ENV / MAESTRO_CONFIG_DIR。
    shell = spawn(SHELL, ['--project', root, '--probe', probeFile, '--ctl', ctlDir], {
      env: envFor(root),
      stdio: 'ignore',
    });

    // --- ready：launch → ready ≤ 3000ms（需求硬指标；失败时同时给出实测值与负载提示）
    const readyEvent = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'ready'), 30_000);
    assert.ok(readyEvent, 'ready 探针缺失（壳未完成窗口构建）');
    const launchEvent = readProbe(probeFile).find((e) => e.event === 'launch');
    assert.ok(launchEvent, 'launch 探针缺失');
    const readyMs = readyEvent.t - launchEvent.t;
    assert.ok(
      readyMs <= 3000,
      `ready.t - launch.t = ${readyMs}ms > 3000ms（需求硬指标 NF-1；若远超预算请先排查本机残留 orch core serve 负载，而非放宽阈值）`,
    );
    assert.equal(readyEvent.window.visible, true, '主窗口必须真实可见');
    assert.equal(readyEvent.window.title, 'Maestro');
    assert.equal(readyEvent.view, 'instances');
    const trayCreated = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-created'), 10_000);
    assert.ok(trayCreated?.created === true, 'tray-created 缺失');

    // --- rows：列表两行（A-1 逐字，同一渲染模块）
    const api = cloudChannel(meta);
    const labels = (await api.get('/ui/labels')).body.keys;
    const list = await api.get('/instances');
    assert.equal(list.status, 200);
    const rows = sortInstances(list.body.items).map((item) => renderListRow(item, labels));
    assert.deepEqual(rows, [
      '实例 INST-001 · 编码闭环 · 运行中 · 进度 1/2 · 待处理 1 · 需关注',
      '实例 INST-002 · 单节点 · 已完成 · 进度 1/1 · 待处理 0 · 已结束',
    ], 'rows 阶段必须与 A-1 逐字相等');

    // --- graph-shown：ctl 点击 INST-001（等价界面点击行）
    const graphBody = await api.get('/instances/INST-001/graph');
    assert.equal(graphBody.status, 200);
    const sig = graphSignature(graphBody.body);
    assert.equal(sig.nodes, 4);
    assert.equal(sig.edges, 4);
    assert.equal(sig.dangling, 0);

    runCtl(ctlDir, path.join('open-instance', 'INST-001'));
    const shown = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'graph-shown'), 15_000);
    assert.ok(shown, 'graph-shown 探针缺失（ctl open-instance 未生效）');
    assert.equal(shown.instanceId, 'INST-001');
    assert.equal(shown.view, 'graph');

    // --- 关窗前后 daemon.pid 必须相等
    const coreBefore = readJson(path.join(root, '.orch', 'core.json'));
    assert.ok(coreBefore, 'core.json 缺失（daemon 未拥有 IPC 管道）');
    const metaBefore = readJson(path.join(root, '.orch', 'desktop.json'));
    assert.equal(metaBefore.pid, coreBefore.pid, 'desktop.json 与 core.json 的 pid 必须一致');

    // --- closed：ctl close-window → 窗口不可见 + 托盘仍在
    runCtl(ctlDir, 'close-window');
    const closed = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'close-window'), 15_000);
    assert.ok(closed, 'close-window 探针缺失');
    assert.equal(closed.window.visible, false, 'closed 阶段 window.visible 必须为 false');
    const trayStill = await waitFor(() => readProbe(probeFile).find((e) => e.event === 'tray-still-present'), 10_000);
    assert.ok(trayStill?.created === true, '关窗后托盘必须仍在');

    const coreAfter = readJson(path.join(root, '.orch', 'core.json'));
    assert.ok(coreAfter, '关窗后 core.json 消失（daemon 被误停）');
    assert.equal(coreAfter.pid, coreBefore.pid, '关窗前后 daemon.pid 必须相等');

    // --- 关窗后 instance status 仍成功（daemon 未停）
    const status = spawnSync(process.execPath, [BIN, 'instance', 'status', 'INST-001'], {
      cwd: root,
      env: envFor(root),
      encoding: 'utf8',
      timeout: 30_000,
      windowsHide: true,
    });
    assert.equal(status.status, 0, `关窗后 instance status 必须成功：\n${status.stdout}\n${status.stderr}`);
    assert.match(status.stdout, /^实例 INST-001 · 运行中/m, `关窗后实例状态必须仍可读：\n${status.stdout}`);

    // 进程号仍存活（独立核对，不只信文件）。
    assert.doesNotThrow(() => process.kill(coreAfter.pid, 0), '关窗后 daemon 进程不存在');
  });
});
