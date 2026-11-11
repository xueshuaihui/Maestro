/**
 * WP-8 / I1.9：CLI 命令面契约测试（真实 `bin/orch.js` + 真核心 + mock 宿主）。
 *
 * 覆盖：
 * - AC-09：`trace show` 三形态（A-1 / A-2 / A-5）与退出码；
 * - AC-10：`trace show` 只读（三次输出字节一致、state / events 哈希不变）；
 * - AC-19：`instance status` 只多一行健康度，删掉该行后与 I1.7 基线逐字相等；
 * - AC-21/24/25：`instance log` 的 A-12 / A-8 / A-13 三类行与坏行跳过；
 * - AC-19：`graph` 文本 / JSON 不含健康度字段，`orch status` 列表行不变。
 *
 * 夹具统一：项目根在 `os.tmpdir()` 下、`NODE_ENV=test`、`.orch/hosts/mock.json`
 * 指向仓库内 `test/fixtures/mock-acp-agent.js`；核心一律由真实 CLI 拉起并在
 * `t.after` 里 `core stop` 后清理目录。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '../../src/daemon/client.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const BIN = path.join(REPO, 'bin', 'orch.js');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');

const LIMITS = {
  initializeTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  promptTimeoutMs: 30_000,
  quietIdleMs: 30,
  quietCapMs: 200,
};

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function makeProject(t, tag, switches = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-i19-cli-${tag}-`));
  t.after(async () => {
    stopCore(root);
    await removeProject(root);
  });
  writeMockConfig(root, switches);
  return root;
}

function writeMockConfig(root, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, ...switches] },
    limits: { ...LIMITS },
  }, null, 2), 'utf8');
}

function stopCore(root) {
  spawnSync(process.execPath, [BIN, 'core', 'stop'], {
    cwd: root,
    env: envFor(),
    timeout: 20_000,
    windowsHide: true,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 核心是 detached 进程：`core stop` 回包后可能仍在 flush，删目录按瞬态错误重试。 */
async function removeProject(root) {
  const deadline = Date.now() + 8000;
  for (;;) {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      return;
    } catch (err) {
      const transient = err?.code === 'ENOTEMPTY' || err?.code === 'EBUSY' || err?.code === 'EPERM';
      if (!transient || Date.now() >= deadline) throw err;
      await sleep(150);
    }
  }
}

function runCli(root, args, timeout = 90_000) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: root,
    env: envFor(),
    timeout,
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    code: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    lines: (result.stdout ?? '').replace(/\n$/, '').split('\n'),
  };
}

function instanceDir(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id);
}

/** 先起核心再写快照：避免启动对账把写进去的 running 快照判成 interrupted（§3.3）。 */
function startCoreOnEmptyRoot(root) {
  const res = runCli(root, ['instance', 'status', 'INST-001'], 30_000);
  assert.equal(res.code, 1, res.stdout + res.stderr);
  assert.equal(res.stdout.trim(), '实例 INST-001 · 不存在');
}

function writeSnapshot(root, state, id = 'INST-001') {
  const dir = instanceDir(root, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
}

function writeJsonLines(root, file, records, tail = '') {
  const dir = instanceDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join('\n');
  fs.writeFileSync(path.join(dir, file), tail ? `${body}\n${tail}` : `${body}\n`, 'utf8');
}

/** `traces.jsonl` 位于实例的 `state/` 子目录（D-6 / 附录 B-1）。 */
function writeTraces(root, records) {
  const dir = path.join(instanceDir(root), 'state');
  fs.mkdirSync(dir, { recursive: true });
  const body = records.map((record) => JSON.stringify(record)).join('\n');
  fs.writeFileSync(path.join(dir, 'traces.jsonl'), `${body}\n`, 'utf8');
}

function sha256(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** 本地时刻构造 ISO：`formatClock` 用本地时区，固定本地时钟才能逐字断言。 */
function localIso(h, m, s) {
  return new Date(2026, 10, 11, h, m, s).toISOString();
}

/** 单节点实例的「已创建 / 无跨度」快照（A-1 夹具；故意不带 `health.level`）。 */
function createdSnapshot() {
  const at = localIso(10, 0, 0);
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i19-cli',
    createdAt: at,
    updatedAt: at,
    state: 'created',
    stateSince: at,
    template: 'single',
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [{ nodeId: 'T-001', roleId: 'worker', round: 0, state: 'pending' }],
    sessions: [],
    handoffs: [],
    escalations: [],
    health: { nodeTimeoutMs: 30000 },
  };
}

/**
 * 冻结快照：`single` 运行中、T-001 已完成（2s）、HO-001 已构造。
 * 时刻用本地 10:00:00 ~ 10:00:05，`instance status` 因此可逐字比对。
 */
function frozenSnapshot({ healthLevel = null } = {}) {
  const health = { nodeTimeoutMs: 30000 };
  if (healthLevel !== null) {
    health.level = healthLevel;
    health.reasons = [];
    health.computedAt = localIso(10, 0, 0);
  }
  return {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i19-cli',
    createdAt: localIso(10, 0, 0),
    updatedAt: localIso(10, 0, 5),
    state: 'running',
    stateSince: localIso(10, 0, 0),
    template: 'single',
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [{
      nodeId: 'T-001',
      roleId: 'worker',
      round: 1,
      state: 'done',
      startedAt: localIso(10, 0, 0),
      endedAt: localIso(10, 0, 2),
    }],
    sessions: [],
    handoffs: [{
      handoffId: 'HO-001',
      edge: null,
      state: 'created',
      createdAt: localIso(10, 0, 3),
      deliveredAt: null,
      acceptedAt: null,
      consumedAt: null,
    }],
    escalations: [],
    health,
  };
}

/** 首轮节点停在运行中、尚无已落地跨度；快照带 `traceId`（D-19 的 A-10 场景）。 */
function runningSnapshot({ traceId = null } = {}) {
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-001',
    coreGeneration: 'gen-i19-cli',
    createdAt: localIso(10, 0, 0),
    updatedAt: localIso(10, 0, 0),
    state: 'running',
    stateSince: localIso(10, 0, 0),
    template: 'single',
    cwd: '.',
    task: 'x',
    halted: false,
    rev: 0,
    nodes: [{
      nodeId: 'T-001',
      roleId: 'worker',
      round: 1,
      state: 'running',
      startedAt: localIso(10, 0, 0),
      endedAt: null,
    }],
    sessions: [],
    handoffs: [{
      handoffId: 'HO-001',
      edge: null,
      state: 'delivered',
      createdAt: localIso(10, 0, 0),
      deliveredAt: localIso(10, 0, 1),
    }],
    escalations: [],
    health: { level: 'normal', reasons: [], computedAt: localIso(10, 0, 0), nodeTimeoutMs: 300000 },
  };
  if (traceId !== null) state.traceId = traceId;
  return state;
}

/** 三条合法事件 + 一条截断行：覆盖 A-12 / A-8 / A-13。 */
function logEvents() {
  return [
    {
      object: 'instance',
      objectId: 'INST-001',
      from: 'created',
      to: 'running',
      result: 'applied',
      reason: 'run.started',
      seq: 1,
      ts: localIso(10, 0, 0),
      prev_event_hash: '0'.repeat(64),
    },
    {
      object: 'session',
      objectId: 'mock-sess-12345-1',
      result: 'note',
      reason: 'execution.summary',
      detail: {
        nodeId: 'T-001',
        round: 1,
        summary: {
          command: 'node out/run.js',
          exitCode: 1,
          keyOutputLines: 3,
          logRef: 'host-logs/T-001.log',
        },
      },
      seq: 2,
      ts: localIso(10, 2, 10),
      prev_event_hash: 'a',
    },
    {
      object: 'health',
      objectId: 'INST-001',
      from: 'normal',
      to: 'attention',
      result: 'applied',
      reason: 'health.changed',
      detail: { reasons: ['pending_escalation'] },
      seq: 3,
      ts: localIso(10, 3, 0),
      prev_event_hash: 'b',
    },
  ];
}

// ---------------------------------------------------------------- AC-09

test('trace show：空追踪 → A-1，退出 0', async (t) => {
  const root = makeProject(t, 'empty');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, createdSnapshot());

  const res = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(res.code, 0, res.stderr);
  assert.equal(res.stdout, '实例 INST-001 · 暂无追踪记录\n');
  assert.equal(res.stderr, '');
});

test('trace show：跑完的单节点实例 → A-2（含回流链 / 无），退出 0', async (t) => {
  const root = makeProject(t, 'single');

  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  assert.equal(run.code, 0, run.stdout + run.stderr);

  const res = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(res.code, 0, res.stderr);
  assert.equal(res.stderr, '');
  assert.equal(res.lines.length, 7, res.stdout);
  assert.match(res.lines[0], /^实例 INST-001 · 追踪 TRC-[0-9a-f]{8}$/);
  assert.equal(res.lines[1], '跨度 1 条 · 回流 0 次');
  assert.equal(res.lines[2], '');
  assert.match(res.lines[3], /^\d{2}:\d{2}:\d{2} → \d{2}:\d{2}:\d{2}  T-001  已完成  交接 HO-001$/);
  assert.equal(res.lines[4], '');
  assert.equal(res.lines[5], '回流链');
  assert.equal(res.lines[6], '无');
});

test('trace show：进行中且尚无落地跨度 → 首行取快照 traceId（A-10）', async (t) => {
  const root = makeProject(t, 'running');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, runningSnapshot({ traceId: 'TRC-1a2b3c4d' }));

  const res = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(res.code, 0, res.stderr);
  assert.equal(res.stderr, '');
  assert.equal(res.lines[0], '实例 INST-001 · 追踪 TRC-1a2b3c4d');
  assert.equal(res.lines[1], '跨度 0 条 · 回流 0 次');
  assert.equal(res.lines[2], '');
  assert.equal(res.lines[3], '10:00:00 → —  T-001  进行中  交接 HO-001');
  assert.equal(res.lines[4], '');
  assert.equal(res.lines[5], '回流链');
  assert.equal(res.lines[6], '无');

  const persisted = JSON.parse(fs.readFileSync(path.join(instanceDir(root), 'state.json'), 'utf8'));
  assert.equal(persisted.traceId, 'TRC-1a2b3c4d');
  assert.ok(res.lines[0].endsWith(persisted.traceId), '首行追踪号必须与 state.json 一致');
});

test('trace show：历史实例运行中但无号 → A-1；补 traceId 后恢复 A-10（D-23）', async (t) => {
  const root = makeProject(t, 'legacy-running');
  startCoreOnEmptyRoot(root);
  // 升级前创建：无 traceId、无 traces.jsonl、节点仍在运行。
  writeSnapshot(root, runningSnapshot());

  const legacy = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(legacy.code, 0, legacy.stderr);
  assert.equal(legacy.stdout, '实例 INST-001 · 暂无追踪记录\n');
  assert.ok(!legacy.stdout.includes('进行中'), legacy.stdout);
  assert.ok(
    !legacy.lines.some((line) => line.startsWith('实例 INST-001 · 追踪') && line.trimEnd() === '实例 INST-001 · 追踪'),
    `不得出现空号行：\n${legacy.stdout}`,
  );

  // 同一夹具补上编号：降级只针对空号，A-10 形态恢复。
  writeSnapshot(root, runningSnapshot({ traceId: 'TRC-11112222' }));
  const fresh = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(fresh.code, 0, fresh.stderr);
  assert.equal(fresh.lines.length, 7, fresh.stdout);
  assert.equal(fresh.lines[0], '实例 INST-001 · 追踪 TRC-11112222');
  assert.equal(fresh.lines[1], '跨度 0 条 · 回流 0 次');
  assert.equal(fresh.lines[3], '10:00:00 → —  T-001  进行中  交接 HO-001');
});

test('trace show：single 的无边交接包归属到同轮跨度（交接 HO-001）', async (t) => {
  const root = makeProject(t, 'single-handoff');
  startCoreOnEmptyRoot(root);
  // 历史实例没有 traceId：追踪号回落到首条已落地跨度。
  writeSnapshot(root, frozenSnapshot());
  writeTraces(root, [{
    trace_id: 'TRC-0a0b0c0d',
    instance_id: 'INST-001',
    node_id: 'T-001',
    round: 1,
    start_time: localIso(10, 0, 0),
    end_time: localIso(10, 0, 2),
    status: 'done',
  }]);

  const res = runCli(root, ['trace', 'show', 'INST-001']);
  assert.equal(res.code, 0, res.stderr);
  assert.equal(res.lines[0], '实例 INST-001 · 追踪 TRC-0a0b0c0d');
  assert.equal(res.lines[1], '跨度 1 条 · 回流 0 次');
  assert.equal(res.lines[3], '10:00:00 → 10:00:02  T-001  已完成  交接 HO-001');
});

test('trace show：实例不存在 → A-5，退出 1，stderr 无堆栈', async (t) => {
  const root = makeProject(t, 'missing');

  const res = runCli(root, ['trace', 'show', 'INST-999']);
  assert.equal(res.code, 1, res.stderr);
  assert.equal(res.stdout, '实例 INST-999 · 不存在\n');
  assert.equal(res.stderr, '');
  assert.ok(!/at\s.+\:\d+:\d+/.test(res.stdout + res.stderr), '不应打印堆栈');
});

test('trace show：不认 --format（按未知参数退出 2，不连核心）', async (t) => {
  const root = makeProject(t, 'usage-noformat');

  const res = runCli(root, ['trace', 'show', 'INST-001', '--format', 'json']);
  assert.equal(res.code, 2, res.stdout + res.stderr);
  assert.ok(res.stdout.includes('未知参数：--format'), res.stdout);
  assert.equal(fs.existsSync(path.join(root, '.orch', 'core.json')), false);
});

// ---------------------------------------------------------------- AC-10

test('trace show：三次输出字节一致，state / events 哈希不变（含无 health.level 的快照）', async (t) => {
  // ① 空实例快照：没有 health.level；若走 `instance.get` 的健康度写路径，
  //    state.json 会被首次写入改写，本断言直接失败。
  const trap = makeProject(t, 'readonly-empty');
  startCoreOnEmptyRoot(trap);
  writeSnapshot(trap, createdSnapshot());
  const trapState = path.join(instanceDir(trap), 'state.json');
  const trapEvents = path.join(instanceDir(trap), 'events.jsonl');

  const beforeTrapState = sha256(trapState);
  const beforeTrapEvents = sha256(trapEvents);
  const trapRuns = [0, 1, 2].map(() => runCli(trap, ['trace', 'show', 'INST-001']));
  for (const res of trapRuns) assert.equal(res.code, 0, res.stderr);
  assert.equal(new Set(trapRuns.map((res) => res.stdout)).size, 1, '三次输出必须字节一致');
  assert.equal(sha256(trapState), beforeTrapState, 'state.json 不得变化');
  assert.equal(sha256(trapEvents), beforeTrapEvents, 'events.jsonl 不得变化');
  assert.equal(JSON.parse(fs.readFileSync(trapState, 'utf8')).health.level, undefined, 'health.level 未被写回');

  // ② 跑完的两进程实例：同样三次一致、哈希不变。
  const root = makeProject(t, 'readonly-run');
  const run = runCli(root, ['run', '--cwd', '.', '--template', 'single', '--host', 'mock', '--task', '写一份说明']);
  assert.equal(run.code, 0, run.stdout + run.stderr);

  const state = path.join(instanceDir(root), 'state.json');
  const events = path.join(instanceDir(root), 'events.jsonl');
  const beforeState = sha256(state);
  const beforeEvents = sha256(events);
  const runs = [0, 1, 2].map(() => runCli(root, ['trace', 'show', 'INST-001']));
  for (const res of runs) assert.equal(res.code, 0, res.stderr);
  assert.equal(new Set(runs.map((res) => res.stdout)).size, 1, '三次输出必须字节一致');
  assert.equal(sha256(state), beforeState, 'state.json 不得变化');
  assert.equal(sha256(events), beforeEvents, 'events.jsonl 不得变化');
});

// ---------------------------------------------------------------- AC-19 / status

test('instance status：只多一行健康度；删掉后与既有基线逐字相等', async (t) => {
  const root = makeProject(t, 'status');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSnapshot());

  const res = runCli(root, ['instance', 'status', 'INST-001']);
  assert.equal(res.code, 0, res.stdout + res.stderr);

  const healthIndex = res.lines.findIndex((line) => line.startsWith('健康度'));
  assert.equal(healthIndex, 1, res.stdout);
  assert.equal(res.lines[1], '健康度 正常');

  // I1.7 基线（`single` 运行中：实例行 / 节点行 / 交接包行），健康度行是唯一新增。
  const baseline = [
    '实例 INST-001 · 运行中',
    '节点 已完成 · 耗时 2s',
    '交接包 HO-001  已构造   10:00:03',
  ];
  assert.deepEqual(res.lines.filter((_, index) => index !== healthIndex), baseline);

  // `status --instance` 与 `instance status` 逐字一致（AC-38 既有等价关系不受影响）。
  const same = runCli(root, ['status', '--instance', 'INST-001']);
  assert.equal(same.code, 0, same.stdout + same.stderr);
  assert.deepEqual(same.lines, res.lines);
});

test('instance graph 文本 / JSON 均不含健康度字段；orch status 列表行不变', async (t) => {
  const root = makeProject(t, 'graph');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSnapshot());

  const text = runCli(root, ['instance', 'graph', 'INST-001']);
  assert.equal(text.code, 0, text.stdout + text.stderr);
  assert.ok(!text.stdout.includes('健康度'), text.stdout);
  assert.ok(!text.stdout.includes('health'), text.stdout);

  const json = runCli(root, ['instance', 'graph', 'INST-001', '--format', 'json']);
  assert.equal(json.code, 0, json.stdout + json.stderr);
  assert.ok(!json.stdout.includes('健康度'), json.stdout);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(
    Object.keys(parsed),
    ['graphVersion', 'instanceId', 'template', 'state', 'paused', 'nodes', 'edges', 'handoffs', 'escalations', 'approvals', 'current'],
  );

  const list = runCli(root, ['status']);
  assert.equal(list.code, 0, list.stdout + list.stderr);
  assert.equal(list.lines.length, 1, list.stdout);
  assert.ok(!list.stdout.includes('健康度'), list.stdout);
  // 列表行的耗时来自节点区间、更新时间来自实例文件元数据；只固定与健康度无关的字段骨架。
  assert.match(
    list.lines[0],
    /^实例 INST-001 · 运行中 · 节点 已完成 · 会话 - · 耗时 2s · 更新 \d{2}:\d{2}:\d{2}$/,
  );
});

// ---------------------------------------------------------------- instance log

test('instance log：A-12 摘要行与 A-8 健康度行出现且不乱序，A-13 跳过行在末尾', async (t) => {
  const root = makeProject(t, 'log');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSnapshot({ healthLevel: 'normal' }));
  writeJsonLines(root, 'events.jsonl', logEvents(), '{"object":"handoff"\n');

  const res = runCli(root, ['instance', 'log', 'INST-001']);
  assert.equal(res.code, 0, res.stdout + res.stderr);
  assert.equal(res.lines.length, 4, res.stdout);

  assert.equal(res.lines[0], '10:00:00  实例 INST-001  已创建 → 运行中  原因 run.started');
  assert.equal(
    res.lines[1],
    '10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log',
  );
  assert.equal(res.lines[2], '10:03:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级');
  assert.equal(res.lines[3], '已跳过 1 行不可读记录');
  assert.ok(!/^\d{2}:\d{2}:\d{2}/.test(res.lines[3]), 'A-13 行不带时刻前缀');
});

test('instance log --format json：原始数组不变，RPC 的 result.badLines 与文本跳过行一致', async (t) => {
  const root = makeProject(t, 'log-json');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSnapshot({ healthLevel: 'normal' }));
  writeJsonLines(root, 'events.jsonl', logEvents(), '{"object":"handoff"\n');

  const text = runCli(root, ['instance', 'log', 'INST-001']);
  assert.equal(text.code, 0, text.stdout + text.stderr);
  const skipped = text.lines[text.lines.length - 1];
  assert.equal(skipped, '已跳过 1 行不可读记录');

  const json = runCli(root, ['instance', 'log', 'INST-001', '--format', 'json']);
  assert.equal(json.code, 0, json.stdout + json.stderr);
  const list = JSON.parse(json.stdout);
  assert.ok(Array.isArray(list), 'json 视图仍是原始事件数组');
  assert.deepEqual(list.map((event) => event.seq), [1, 2, 3]);

  // `badLines` 是数组上的非枚举属性，IPC 会丢；必须由 `instance.events.result` 显式透出（D-6）。
  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: true });
    assert.equal(connected.ok, true, JSON.stringify(connected));
    const res = await client.request('instance.events', { instanceId: 'INST-001' });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.equal(res.result.badLines, 1);
    assert.equal(res.result.events.length, 3);
  } finally {
    await client.close?.();
  }
});

// ---------------------------------------------------------------- 既有命令

test('status --events 仍按 seq 逐条渲染，健康度只占实例行后一行', async (t) => {
  const root = makeProject(t, 'status-events');
  startCoreOnEmptyRoot(root);
  writeSnapshot(root, frozenSnapshot({ healthLevel: 'normal' }));
  writeJsonLines(root, 'events.jsonl', logEvents());

  const res = runCli(root, ['status', '--instance', 'INST-001', '--events']);
  assert.equal(res.code, 0, res.stdout + res.stderr);
  assert.equal(res.lines[0], '实例 INST-001 · 运行中');
  assert.equal(res.lines[1], '健康度 正常');
  const eventLines = res.lines.filter((line) => /^\d{2}:\d{2}:\d{2}  /.test(line));
  assert.equal(eventLines.length, 3, res.stdout);
  assert.equal(eventLines[0], '10:00:00  实例 INST-001  已创建 → 运行中  原因 run.started');
});
