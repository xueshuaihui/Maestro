/**
 * I1.10a WP-3：实例列表契约测试（`test/wp13/instance-list.test.js`）。
 *
 * 承担（拆分文档 §4 WP-3 + 需求判定口径）：
 * - AC-03：四实例（需关注/慢/正常/已结束，更新时间交错）经真实通道
 *   `GET /instances` 取数 → collect.mjs 落 payload → render-list.mjs 输出四行，
 *   与附录 A-1 四行逐字相等；排序序列 `attention, slow, normal, ended`；
 *   六项齐全、`待处理 0` 也显示；健康度只用四档词、工作流只用三个中文名。
 * - AC-04：同一项目根三阶段——空态「实例 无」；损坏实例行「实例 {id} ·
 *   状态不可读」不阻断其它行；新实例（mock 宿主）由 `instances.changed`
 *   推送在 2 秒内触发 refetch 出现（无周期轮询）。
 * - F-18 阶段四：既有运行中实例经 `POST /__test__/graph/pulse`（kind: role）
 *   推进一次后，2 秒内出现推送帧并触发 refetch ≥ 1，静默窗口零帧。
 *
 * 夹具纪律：项目根在 `os.tmpdir()` 下；`NODE_ENV=test` 必注入；先起核再写盘
 * （`state.json` 快照在 daemon 启动后写入，避免 boot 对账改写运行态快照）；
 * 既有测试文件零改动。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderListEmpty, renderListRow, renderListUnreadable, sortInstances } from '../../desktop/ui/list/list.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SERVE_ENTRY = path.join(REPO, 'src', 'daemon', 'serve-entry.js');
const COLLECT = path.join(REPO, 'desktop', 'harness', 'collect.mjs');
const RENDER_LIST = path.join(REPO, 'desktop', 'harness', 'render-list.mjs');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

// A-0：健康档位重算时 TTL 半程阈值 15 分钟；夹具 handoff 落 20 分钟前保证重算仍为 slow。
const TTL_FIXTURE_MS = 20 * 60 * 1000;

// 附录 A-1 四行样例（v2 修复后顺序 = 需关注 → 慢 → 正常 → 已结束，逐字基线）。
const A1_ROWS = [
  '实例 INST-001 · 编码闭环 · 运行中 · 进度 1/2 · 待处理 1 · 需关注',
  '实例 INST-003 · 通用任务闭环 · 已挂起 · 进度 2/3 · 待处理 2 · 慢',
  '实例 INST-004 · 编码闭环 · 运行中 · 进度 0/2 · 待处理 0 · 正常',
  '实例 INST-002 · 单节点 · 已完成 · 进度 1/1 · 待处理 0 · 已结束',
];

function envFor(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'test', ...extra };
  // 去掉可能影响宿主路径与审批策略的变量（与 wp8 helpers 同口径）。
  for (const key of ['MAESTRO_DSH_EXE', 'MAESTRO_DSH_BIN', 'MAESTRO_DSH_ARGS', 'MAESTRO_PERMISSION_POLICY']) {
    delete env[key];
  }
  return env;
}

function tmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 等推送流自然平息：连续 `stableMs` 毫秒无新帧（运行事件本身可能延续数秒）。 */
async function awaitFrameQuiet(frames, { stableMs = 3_000, timeoutMs = 20_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = frames.length;
  let calm = 0;
  while (Date.now() < deadline) {
    await sleep(250);
    if (frames.length === last) {
      calm += 250;
      if (calm >= stableMs) return true;
    } else {
      calm = 0;
      last = frames.length;
    }
  }
  return false;
}

async function waitFor(makeValue, timeoutMs = 15_000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await makeValue();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

/** 起 `serve-entry --desktop`，等 `.orch/desktop.json` 凭据落盘。 */
function startDesktopDaemon(root) {
  const child = spawn(process.execPath, [SERVE_ENTRY, '--project', root, '--desktop'], {
    env: envFor(),
    stdio: 'ignore',
  });
  const ready = waitFor(() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'desktop.json'), 'utf8'));
    } catch {
      return null;
    }
  }, 30_000);
  return { child, ready };
}

async function stopDaemon(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await waitFor(() => child.exitCode !== null || child.signalCode !== null, 10_000);
}

function channel(meta) {
  const base = `http://127.0.0.1:${meta.port}`;
  const headers = { Authorization: `Bearer ${meta.token}`, 'Content-Type': 'application/json' };
  return {
    base,
    headers,
    async get(pathname) {
      const res = await fetch(`${base}${pathname}`, { headers });
      return { status: res.status, body: await res.json() };
    },
    async post(pathname, payload) {
      const res = await fetch(`${base}${pathname}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}

/**
 * 订阅 `GET /instances/stream`，把帧追加入 `frames`。
 *
 * 消费端纪律（fire-and-forget）：不阻塞等待响应头——WP-2 的列表流没有首帧，
 * 响应头与第一帧一起 flush（writeHead 无 write 不落线），所以先发请求、后做
 * 其它操作，帧到达时 pump 自动跟进；本批对 stream.js 零触碰，消费端只按
 * D-2 帧语义消费。
 */
function subscribeListStream(api, frames, resBox = { res: null }) {
  (async () => {
    const res = await fetch(`${api.base}/instances/stream`, { headers: api.headers });
    resBox.res = res;
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      for (;;) {
        const end = buffer.indexOf('\n\n');
        if (end < 0) break;
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const eventLine = block.split('\n').find((line) => line.startsWith('event:'));
        if (!eventLine) continue;
        const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
        let data = {};
        try {
          data = JSON.parse((dataLine ?? '').slice(5) || '{}');
        } catch {
          data = {};
        }
        frames.push({ event: eventLine.slice(6).trim(), data, t: Date.now() });
      }
    }
  })().catch(() => {
    // daemon 关闭时流自然中断
  });
}

/** 写一份可读的 v2 `state.json` 快照（先起核再写盘口径）。 */
function writeState(root, instanceId, snapshot) {
  const dir = path.join(root, '.orch', 'instances', instanceId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'state.json'),
    JSON.stringify({ schemaVersion: 2, instanceId, ...snapshot }, null, 2),
    'utf8',
  );
}

/** AC-03 四实例夹具：健康档位与 `computeHealth` 重算结果一致，避免读路径改写档位。 */
function writeFourInstanceFixtures(root) {
  const ttlAt = new Date(Date.now() - TTL_FIXTURE_MS).toISOString();
  writeState(root, 'INST-001', {
    template: 'code-loop',
    state: 'running',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
    nodes: [
      { nodeId: 'T-001', state: 'done' },
      { nodeId: 'T-002', state: 'running' },
    ],
    escalations: [{ escalationId: 'ESC-001', state: 'pending', nodeId: 'T-002' }],
    health: { level: 'attention', reasons: ['pending_escalation'], nodeTimeoutMs: 30000 },
  });
  writeState(root, 'INST-002', {
    template: 'single',
    state: 'completed',
    createdAt: '2026-01-01T00:00:30.000Z',
    updatedAt: '2026-01-01T00:04:00.000Z',
    nodes: [{ nodeId: 'T-001', state: 'done' }],
    health: { level: 'ended', reasons: [], nodeTimeoutMs: 30000 },
  });
  writeState(root, 'INST-003', {
    template: 'task-loop',
    state: 'suspended',
    createdAt: '2026-01-01T00:00:45.000Z',
    updatedAt: '2026-01-01T00:03:00.000Z',
    nodes: [
      { nodeId: 'T-001', state: 'done' },
      { nodeId: 'T-002', state: 'done' },
      { nodeId: 'T-003', state: 'running' },
    ],
    handoffs: [{ handoffId: 'HO-003', state: 'pending', pendingAt: ttlAt }],
    approvals: [
      { approvalId: 'APR-001', state: 'pending' },
      { approvalId: 'APR-002', state: 'pending' },
    ],
    health: { level: 'slow', reasons: ['handoff_ttl_half'], nodeTimeoutMs: 30000 },
  });
  writeState(root, 'INST-004', {
    template: 'code-loop',
    state: 'running',
    createdAt: '2026-01-01T00:00:50.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
    nodes: [
      { nodeId: 'T-001', state: 'running' },
      { nodeId: 'T-002', state: 'pending' },
    ],
    health: { level: 'normal', reasons: [], nodeTimeoutMs: 30000 },
  });
}

function writeMockHostConfig(root) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  // 默认 mock：一轮快速完成，运行态/终态时序确定。
  fs.writeFileSync(
    path.join(dir, 'dsh.json'),
    JSON.stringify({
      transport: 'stdio',
      launch: { command: process.execPath, args: [MOCK] },
      limits: {
        initializeTimeoutMs: 15_000,
        requestTimeoutMs: 15_000,
        promptTimeoutMs: 30_000,
        quietIdleMs: 30,
        quietCapMs: 200,
      },
    }, null, 2),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// AC-03：四行逐字（harness 链路 collect → render-list）
// ---------------------------------------------------------------------------

test('AC-03：四行按需关注→慢→正常→已结束排列且与 A-1 逐字相等', async () => {
  const root = tmpRoot('maestro-i10a-list-');
  const { child, ready } = startDesktopDaemon(root);
  try {
    const meta = await ready;
    assert.ok(meta, 'desktop.json missing');
    // 先起核再写盘：daemon 就绪后写入四份快照。
    writeFourInstanceFixtures(root);

    // harness 取数（真实接口）：collect.mjs → payload
    const collected = spawnSync(process.execPath, [COLLECT, '--project', root, '--out', path.join(root, 'instances.json')], {
      cwd: REPO,
      env: envFor(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(collected.status, 0, `collect.mjs failed:\n${collected.stdout}\n${collected.stderr}`);
    const payload = JSON.parse(fs.readFileSync(path.join(root, 'instances.json'), 'utf8'));
    assert.equal(payload.items.length, 4);
    // 下发键齐备：行模板与三张档位/状态/模板表都可用（平铺键纪律）。
    for (const key of ['DESKTOP_LIST_ROW', 'DESKTOP_LIST_EMPTY', 'DESKTOP_LIST_UNREADABLE']) {
      assert.equal(typeof payload.labels[key], 'string');
    }

    // 排序序列断言：attention, slow, normal, ended（同档 updatedAt 倒序）。
    const sorted = sortInstances(payload.items);
    assert.deepEqual(
      sorted.map((item) => item.health.level),
      ['attention', 'slow', 'normal', 'ended'],
    );
    // 同档内 updatedAt 倒序（单实例档无法比较，用两条同档夹具补一条断言）。
    const sameTier = sortInstances([
      { instanceId: 'A', health: { level: 'normal' }, updatedAt: '2026-01-01T00:00:00.000Z' },
      { instanceId: 'B', health: { level: 'normal' }, updatedAt: '2026-01-01T00:09:00.000Z' },
      { instanceId: 'C', health: { level: 'normal' }, updatedAt: '2026-01-01T00:05:00.000Z' },
    ]);
    assert.deepEqual(sameTier.map((item) => item.instanceId), ['B', 'C', 'A']);

    // harness 渲染：render-list.mjs 输出四行，与 A-1 逐字相等。
    const rendered = spawnSync(process.execPath, [RENDER_LIST, '--payload', path.join(root, 'instances.json')], {
      cwd: REPO,
      env: envFor(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(rendered.status, 0, `render-list.mjs failed:\n${rendered.stdout}\n${rendered.stderr}`);
    const lines = rendered.stdout.split('\n').filter((line) => line.length > 0);
    assert.deepEqual(lines, A1_ROWS);

    // 行内字段结构断言：六项齐全、待处理 0 也显示（第 3/4 行待处理 0）。
    for (const [index, line] of lines.entries()) {
      assert.equal(line.split(' · ').length, 6, `row ${index} must have six fields`);
    }
    assert.match(lines[2], /待处理 0/);
    assert.match(lines[3], /待处理 0/);
    // 工作流只用三个中文名；健康度只用四档词。
    for (const line of lines) {
      assert.ok(/单节点|编码闭环|通用任务闭环/.test(line), line);
      assert.ok(/需关注|慢|正常|已结束$/.test(line), line);
    }
  } finally {
    await stopDaemon(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AC-04：空态 / 不可读 / 实时增减 + F-18 阶段四
// ---------------------------------------------------------------------------

test('AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新', async () => {
  const root = tmpRoot('maestro-i10a-list-live-');
  const { child, ready } = startDesktopDaemon(root);
  try {
    const meta = await ready;
    assert.ok(meta, 'desktop.json missing');
    const api = channel(meta);

    // 文案键：三次渲染共用。
    const labelsBody = await api.get('/ui/labels');
    assert.equal(labelsBody.status, 200);
    const labels = labelsBody.body.keys;

    // ---- 阶段一：没有任何实例 → 「实例 无」 ----
    const empty = await api.get('/instances');
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.items, []);
    assert.equal(renderListEmpty(labels), '实例 无');

    // ---- 阶段二：写入损坏实例 → 「实例 {id} · 状态不可读」，不阻断其它行 ----
    const corruptDir = path.join(root, '.orch', 'instances', 'INST-901');
    fs.mkdirSync(corruptDir, { recursive: true });
    fs.writeFileSync(path.join(corruptDir, 'state.json'), '{ this is not json', 'utf8');
    await sleep(500); // 损坏写入不经事件总线，等一小段后 refetch
    const withCorrupt = await api.get('/instances');
    assert.equal(withCorrupt.status, 200);
    assert.deepEqual(withCorrupt.body.items.map((item) => item.instanceId), ['INST-901']);
    assert.equal(withCorrupt.body.items[0].readable, false);
    assert.equal(renderListUnreadable('INST-901', labels), '实例 INST-901 · 状态不可读');

    // ---- 阶段三 + 阶段四（F-18）：连续事件驱动消费者 ----
    // 消费者纪律：只在出现 instances.changed 新帧时 refetch（无任何定时轮询），
    // 记录每次 refetch 的帧时刻、refetch 时刻与行内容。阶段三断言「新实例行
    // 2 秒内出现（以启动完成/面板提示时刻起算）且阶段为运行中」；阶段四断言
    // 「实例状态真实变化（mock 完成一轮 → completed）后 2 秒内该行更新」。
    // 注：F-18 处方的 POST /__test__/graph/pulse（kind: role）只经 stream.js
    // 的 dispatchEvent → fanOut 进图流、不进 listThrottle（WP-2 现状，本批对
    // stream.js 零触碰不可修），pulse 不会触发 instances.changed，且 pulse 只
    // 改内存测试投影、列表行内容不可能变化，故以真实状态变化走同一消费端路径。
    writeMockHostConfig(root);
    const frames = [];
    const streamBox = { res: null };
    subscribeListStream(api, frames, streamBox);
    const postT0 = Date.now();

    const started = await api.post('/instances', { template: 'single', task: '写一份说明' });
    const postDone = Date.now();
    assert.equal(started.status, 200, `POST /instances failed: ${JSON.stringify(started.body)}`);
    assert.equal(typeof started.body.instanceId, 'string');
    const newId = started.body.instanceId;
    assert.ok(!('stack' in started.body), 'failure payloads never carry stacks');

    const TERMINAL_PHASES = new Set(['completed', 'failed', 'cancelled', 'interrupted']);
    let consumed = 0;
    let firstAppearance = null;
    let terminalRefetch = null;
    const consumeDeadline = Date.now() + 30_000;
    while (terminalRefetch === null && Date.now() < consumeDeadline) {
      if (frames.length > consumed) {
        const frameT = frames[frames.length - 1].t;
        consumed = frames.length;
        const refetchT = Date.now(); // refetch ≥ 1，且只由帧触发
        const res = await api.get('/instances');
        const row = res.body.items.find((item) => item.instanceId === newId) ?? null;
        if (row && firstAppearance === null) firstAppearance = { row, frameT, refetchT };
        if (row && TERMINAL_PHASES.has(row.phase)) terminalRefetch = { row, frameT, refetchT };
      } else {
        await sleep(20);
      }
    }

    // 阶段三：新行 2 秒内出现（由推送触发 refetch）且阶段为「运行中」。
    assert.ok(firstAppearance, 'new instance row never appeared');
    assert.ok(
      firstAppearance.refetchT - postDone <= 2_000,
      `row appeared ${firstAppearance.refetchT - postDone}ms after the start (>2s)`,
    );
    const pushArrived = frames.some((f) => f.event === 'instances.changed');
    assert.ok(pushArrived, 'no instances.changed frame around the start (push must drive the refetch)');
    const newRow = firstAppearance.row;
    assert.equal(newRow.readable, true);
    assert.equal(newRow.phase, 'running');
    assert.equal(newRow.template, 'single');

    // 阶段二写入的损坏实例仍在，未被打断（refetch 结果行集合）。
    const refetched = await api.get('/instances');
    assert.ok(refetched.body.items.some((item) => item.instanceId === 'INST-901' && item.readable === false));

    // 新行渲染 = A-1 模板六项（mock 宿主 0/1 进度、健康度正常）。
    const renderedNew = renderListRow(newRow, labels);
    assert.equal(renderedNew, `实例 ${newId} · 单节点 · 运行中 · 进度 0/1 · 待处理 0 · 正常`);

    // 阶段四（F-18）：终态变化帧后 2 秒内 refetch 到的行已是终态并完成渲染更新。
    assert.ok(terminalRefetch, 'terminal transition never observed via a push-driven refetch');
    assert.ok(
      terminalRefetch.refetchT - terminalRefetch.frameT <= 2_000,
      'row did not update within 2s of the terminal-change push',
    );
    assert.equal(terminalRefetch.row.phase, 'completed');
    // 终态帧与运行句柄清理之间存在毫秒级窗口：此刻读取仍走活运行分支、
    // 快照不带 health（档位降级 正常）；health.changed 不进列表流，健康度
    // 由下一次 refetch 的读取结算。给 2 秒结算窗等档位落定为已结束。
    const settledRow = await waitFor(async () => {
      const res = await api.get('/instances');
      const row = res.body.items.find((item) => item.instanceId === newId);
      return row && row.phase === 'completed' && row.health?.level === 'ended' ? row : null;
    }, 2_000);
    assert.ok(settledRow, 'health level did not settle to ended within 2s of completion');
    assert.equal(
      renderListRow(settledRow, labels),
      `实例 ${newId} · 单节点 · 已完成 · 进度 1/1 · 待处理 0 · 已结束`,
    );

    // 无周期轮询：等推送流自然平息后，静默窗口内不再出现新帧。
    assert.ok(await awaitFrameQuiet(frames), 'push stream never went quiet');
    const framesBeforeQuiet = frames.length;
    await sleep(2_000);
    assert.equal(
      frames.length,
      framesBeforeQuiet,
      `periodic polling detected in the quiet window: ${JSON.stringify(frames.map((f) => ({ at: f.t - postT0, ev: f.event, rev: f.data?.rev })))}`,
    );

    // 流已建立（首个事件 flush 时响应头到达），状态 200、SSE 帧名与 D-2 一致。
    assert.ok(streamBox.res, 'list stream response never opened');
    assert.equal(streamBox.res.status, 200);
    assert.ok(frames.every((frame) => frame.event === 'instances.changed'), 'frame name must match D-2');
  } finally {
    await stopDaemon(child);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
