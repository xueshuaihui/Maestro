/**
 * WP-7 / I1.9：orchestrator 集成钩子契约测试。
 *
 * 覆盖 newState / saveState / handleUpdate 摘要缓存 / 三收尾函数共享摘要 /
 * 节点收尾跨度 / getStatus 重算与档位变化 六段改动，以及两条冻结基线
 * （grep -c ≤ 13、三主链运行期输出逐字不回灌）。
 *
 * 夹具统一 `--host mock`（D-3）、项目根一律 os.tmpdir() 下独立目录、
 * NODE_ENV=test、测完 t.after 清理。两个 `--fail-tool*` 开关不与
 * --permission / --host-error / --hold-session / --turn-delay-ms 组合（D-13）。
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createAdapterFactory } from '../../src/adapter/factory.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { deriveHandoffIds } from '../../src/core/trace.js';
import { createStore } from '../../src/persistence/instance-store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const MOCK = path.join(REPO, 'test', 'fixtures', 'mock-acp-agent.js');
const ORCH = path.join(REPO, 'bin', 'orch.js');
const DRIVER = path.join(REPO, 'test', 'fixtures', 'code-loop-driver.mjs');

function envFor() {
  return { ...process.env, NODE_ENV: 'test' };
}

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-wp7-orch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeMockConfig(root, switches = []) {
  const dir = path.join(root, '.orch', 'hosts');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'mock.json'), JSON.stringify({
    transport: 'stdio',
    launch: { command: process.execPath, args: [MOCK, ...switches] },
    limits: {
      initializeTimeoutMs: 8000, requestTimeoutMs: 8000, promptTimeoutMs: 8000,
      quietIdleMs: 30, quietCapMs: 200,
    },
  }));
}

function instanceDir(root, id = 'INST-001') {
  return path.join(root, '.orch', 'instances', id);
}

function readState(root, id = 'INST-001') {
  return JSON.parse(fs.readFileSync(path.join(instanceDir(root, id), 'state.json'), 'utf8'));
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim())
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

function readEvents(root, id = 'INST-001') {
  return readJsonLines(path.join(instanceDir(root, id), 'events.jsonl'));
}

function readTraces(root, id = 'INST-001') {
  return readJsonLines(path.join(instanceDir(root, id), 'state', 'traces.jsonl'));
}

function runCli(root, { switches = [], task = '写一份说明', template = 'single', extra = [] } = {}) {
  writeMockConfig(root, switches);
  return spawnSync(process.execPath, [
    ORCH, 'run', '--cwd', '.', '--template', template, '--host', 'mock', '--task', task, ...extra,
  ], { cwd: root, env: envFor(), encoding: 'utf8', timeout: 90000 });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, { timeoutMs = 15000, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) throw new Error('waitFor 超时');
    await sleep(intervalMs);
  }
}

function makeOrch(root) {
  const env = envFor();
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const orch = createOrchestrator({
    store, bus,
    adapterFactory: createAdapterFactory({ root, env }),
    env,
  });
  return { store, bus, orch };
}

/** 一份最小的运行中历史快照（schemaVersion 2），故意不带 health。 */
function historySnapshot(root, id, { nodeTimeoutMs = null } = {}) {
  const at = new Date().toISOString();
  const state = {
    schemaVersion: 2, instanceId: id, coreGeneration: 'gen-1',
    createdAt: at, updatedAt: at, state: 'running', stateSince: at,
    template: 'code-loop', cwd: root, task: 'x', halted: false, rev: 0,
    counters: { eventSeq: 0, runCount: 1, dispatchCount: 0 },
    hostRaw: { stopReason: null, lastError: null, agentInfo: null },
    nodes: [
      { nodeId: 'T-001', round: 1, state: 'done', startedAt: at, endedAt: at },
      { nodeId: 'T-002', round: 0, state: 'pending' },
    ],
    sessions: [], handoffs: [], escalations: [],
  };
  if (nodeTimeoutMs !== null) state.health = { nodeTimeoutMs };
  return state;
}

// ---------------------------------------------------------------- 1) newState

test('newState 只追加 health 与 traceId 两个字段、既有初始字段与顺序不动；缺 health 按 30000 缺省且不批量回填', async (t) => {
  const root = makeRoot(t);
  const res = runCli(root, { task: '写一份说明' });
  assert.ok(res.status === 0 || res.status === 1, `run 退出码异常：${res.status}`);

  const keys = Object.keys(readState(root));
  const frozen = [
    'schemaVersion', 'instanceId', 'coreGeneration', 'createdAt', 'updatedAt',
    'state', 'stateSince', 'template', 'cwd', 'task', 'halted', 'rev',
    'counters', 'hostRaw', 'nodes', 'sessions', 'handoffs', 'escalations',
  ];
  // 既有 18 个字段顺序逐字不变，health / traceId 依次紧跟其后（唯一两个新增顶层字段）。
  assert.deepEqual(keys.slice(0, frozen.length), frozen);
  assert.equal(keys[frozen.length], 'health');
  assert.equal(keys[frozen.length + 1], 'traceId');
  assert.equal(keys.length, frozen.length + 2, '顶层字段只多 health 与 traceId');
  assert.equal(readState(root).health.nodeTimeoutMs, 30000);
  assert.match(readState(root).traceId, /^TRC-[0-9a-f]{8}$/, 'traceId 由 newTraceId 生成');

  // 历史快照缺 health：只查看一个实例时，另一个实例不被批量回填。
  const root2 = makeRoot(t);
  const { store, orch } = makeOrch(root2);
  await store.save('INST-001', historySnapshot(root2, 'INST-001'));
  await store.save('INST-002', historySnapshot(root2, 'INST-002'));
  const seen = await orch.getStatus({ instanceId: 'INST-001' });
  assert.equal(seen.snapshot.health.nodeTimeoutMs, 30000, '缺 health 时按缺省 30000 处理');
  assert.equal(seen.snapshot.health.level, 'normal');
  assert.equal((await store.load('INST-002')).state.health, undefined,
    '未查看的历史快照不得被批量回填');
  // 被查看的实例首次补写落盘，且形状完整。
  const written = (await store.load('INST-001')).state.health;
  assert.equal(written.nodeTimeoutMs, 30000);
  assert.equal(typeof written.level, 'string');
  assert.ok(Array.isArray(written.reasons));
  assert.equal(typeof written.computedAt, 'string');
  await orch.dispose();
});

// ------------------------------------------- 1b) 创建即落 traceId（D-19）

test('实例创建即有 state.traceId，且此早于任何跨度落地（不是首条跨度反推）', async (t) => {
  const root = makeRoot(t);
  writeMockConfig(root, ['--turn-delay-ms', '30000']);
  const { bus, orch } = makeOrch(root);
  t.after(async () => { try { await orch.dispose(); } catch { /* best effort */ } });
  const id = 'INST-001';
  const pending = orch.startRun({
    cwd: root, task: '执行 out/run.js', template: 'single', hostId: 'mock',
  });
  pending.catch(() => {});
  await waitFor(async () => (await bus.replay(id)).some(
    (e) => e.reason === 'session.state' && e.to === 'tool_running',
  ));
  const created = readState(root);
  assert.match(created.traceId, /^TRC-[0-9a-f]{8}$/, '创建时的 traceId 形如 TRC-xxxxxxxx');
  assert.equal(readTraces(root).length, 0,
    '节点仍在运行、尚无跨度落地时 state.json 已带 traceId');
  await orch.cancel({ instanceId: id });
  await Promise.race([pending, sleep(6000)]).catch(() => {});
});

// ------------------------------------------------------------- 2) saveState

test('saveState 写回 health：保留 nodeTimeoutMs，level/reasons/computedAt 齐全', async (t) => {
  const root = makeRoot(t);
  const { store, orch } = makeOrch(root);
  await store.save('INST-001', historySnapshot(root, 'INST-001', { nodeTimeoutMs: 300000 }));
  // getStatus 触发一次 saveState 路径的窄 CAS 写入。
  await orch.getStatus({ instanceId: 'INST-001' });
  const health = (await store.load('INST-001')).state.health;
  assert.equal(health.nodeTimeoutMs, 300000, '回写不得覆盖实例级阈值');
  assert.equal(health.level, 'normal');
  assert.deepEqual(health.reasons, []);
  assert.equal(typeof health.computedAt, 'string');
  assert.equal(Number.isNaN(Date.parse(health.computedAt)), false);

  // 再次保存仍保留该阈值（例如一次取消之外的状态写入）。
  const disk = (await store.load('INST-001')).state;
  await store.save('INST-001', { ...disk, health: { nodeTimeoutMs: 300000 } });
  await orch.getStatus({ instanceId: 'INST-001' });
  assert.equal((await store.load('INST-001')).state.health.nodeTimeoutMs, 300000);
  await orch.dispose();
});

// ------------------------------------------------------------- 3) getStatus

test('getStatus：首次补写不追加事件；档位变化恰一次窄 CAS + 一条 health.changed；档位未变不重复', async (t) => {
  const root = makeRoot(t);
  const { store, bus, orch } = makeOrch(root);
  await store.save('INST-001', historySnapshot(root, 'INST-001', { nodeTimeoutMs: 300000 }));
  const id = 'INST-001';
  const eventCount = async () => (await bus.replay(id)).length;

  // 首次：缺 level → 补写，不追加事件。
  const first = await orch.getStatus({ instanceId: id });
  assert.equal(first.snapshot.health.level, 'normal');
  assert.equal(await eventCount(), 0, '首次写入不算档位变化');
  assert.equal(typeof (await store.load(id)).state.health.level, 'string');

  // 追加一条待处理升级 → 档位 正常 → 需关注。
  const disk = (await store.load(id)).state;
  disk.escalations = [{ escalationId: 'ESC-001', nodeId: 'T-002', state: 'pending' }];
  await store.save(id, disk);
  const midRev = (await store.load(id)).state.rev;
  const second = await orch.getStatus({ instanceId: id });
  assert.equal(second.snapshot.health.level, 'attention');
  assert.equal((await store.load(id)).state.rev - midRev, 1, '档位变化只做一次窄 CAS');

  const events = await bus.replay(id);
  const changed = events.filter((e) => e.reason === 'health.changed');
  assert.equal(changed.length, 1, '档位变化恰一条 health.changed');
  const ev = changed[0];
  assert.equal(ev.object, 'health');
  assert.equal(ev.objectId, id);
  assert.equal(ev.from, 'normal');
  assert.equal(ev.to, 'attention');
  assert.equal(ev.result, 'applied');
  assert.deepEqual(ev.detail.reasons, ['pending_escalation'], 'reasons 恒为纯码值数组');
  assert.ok(ev.detail.reasons.every((r) => typeof r === 'string'));
  assert.equal(typeof ev.seq, 'number');
  assert.equal(typeof ev.ts, 'string');
  assert.equal(typeof ev.prev_event_hash, 'string');
  assert.equal(ev.prev_event_hash.length, 64);

  // 同档位连续再读两次：不写、不追加事件。
  const beforeRev = (await store.load(id)).state.rev;
  const beforeEvents = await eventCount();
  await orch.getStatus({ instanceId: id });
  await orch.getStatus({ instanceId: id });
  assert.equal((await store.load(id)).state.rev, beforeRev);
  assert.equal(await eventCount(), beforeEvents);
  await orch.dispose();
});

// ------------------------------------------- 4) execution.summary 每会话一条

test('execution.summary 每会话恰一条，成功/失败/取消三种收尾都有，缺项为 null', async (t) => {
  // 失败收尾（--fail-tool）：四项完整。
  const failRoot = makeRoot(t);
  runCli(failRoot, { switches: ['--fail-tool'], task: '执行 out/run.js' });
  const failSummaries = readEvents(failRoot).filter((e) => e.reason === 'execution.summary');
  assert.equal(failSummaries.length, 1);
  assert.equal(failSummaries.length, readState(failRoot).sessions.length,
    '全文摘要条数等于会话数（重复收尾不重复写）');
  assert.equal(failSummaries[0].detail.summary.command, 'node out/run.js');

  // 成功收尾：同样有且仅有一条摘要。
  const okRoot = makeRoot(t);
  runCli(okRoot, { task: '写一份说明' });
  const okSummaries = readEvents(okRoot).filter((e) => e.reason === 'execution.summary');
  assert.equal(okSummaries.length, 1, '成功完成的节点同样有摘要');
  assert.equal(okSummaries.length, readState(okRoot).sessions.length);

  // 事件形状：object/objectId/result/reason/detail + 链字段。
  for (const ev of [...failSummaries, ...okSummaries]) {
    assert.equal(ev.object, 'session');
    assert.equal(typeof ev.objectId, 'string');
    assert.equal(ev.result, 'note');
    assert.equal(typeof ev.detail.nodeId, 'string');
    assert.equal(typeof ev.detail.round, 'number');
    assert.ok('summary' in ev.detail);
    assert.equal(typeof ev.seq, 'number');
    assert.equal(typeof ev.ts, 'string');
    assert.equal(typeof ev.prev_event_hash, 'string');
  }
  // 成功节点宿主未上报四项 → 缺项一律 null（不冒充）。
  for (const key of ['command', 'exitCode', 'keyOutputLines', 'logRef']) {
    assert.ok(key in okSummaries[0].detail.summary);
    if (okSummaries[0].detail.summary[key] !== null) {
      assert.ok(typeof okSummaries[0].detail.summary[key] === 'number'
        || typeof okSummaries[0].detail.summary[key] === 'string');
    }
  }
});

// ------------------------------------------- 5) D-10 四项合并 / 缺项变体

test('--fail-tool 合并四项；--fail-tool-no-refs 缺项为 null 且 command 不被工具名冒充', async (t) => {
  const fullRoot = makeRoot(t);
  runCli(fullRoot, { switches: ['--fail-tool'], task: '执行 out/run.js' });
  const full = readEvents(fullRoot).find((e) => e.reason === 'execution.summary');
  assert.deepEqual(full.detail.summary, {
    command: 'node out/run.js', exitCode: 1, keyOutputLines: 3, logRef: 'host-logs/T-001.log',
  });

  const noRefsRoot = makeRoot(t);
  runCli(noRefsRoot, { switches: ['--fail-tool-no-refs'], task: '执行 out/run.js' });
  const noRefs = readEvents(noRefsRoot).find((e) => e.reason === 'execution.summary');
  assert.equal(noRefs.detail.summary.command, 'node out/run.js', 'command 不得缺席');
  assert.equal(noRefs.detail.summary.exitCode, 1);
  assert.equal(noRefs.detail.summary.keyOutputLines, null, '缺项存 null，不补齐');
  assert.equal(noRefs.detail.summary.logRef, null, '缺项存 null，不补齐');
  assert.notEqual(noRefs.detail.summary.command, 'write', '不得用工具名冒充 command');
  assert.notEqual(noRefs.detail.summary.command, readState(noRefsRoot).sessions[0].toolName);
});

// ------------------------------------------------------- 6) live 取消路径

test('live 取消：四项全 null、终态 cancelled/ended、不阻断取消', async (t) => {
  const root = makeRoot(t);
  writeMockConfig(root, ['--turn-delay-ms', '30000']);
  const { store, bus, orch } = makeOrch(root);
  t.after(async () => { try { await orch.dispose(); } catch { /* best effort */ } });
  const id = 'INST-001';
  const pending = orch.startRun({
    cwd: root, task: '执行 out/run.js', template: 'single', hostId: 'mock',
  });
  pending.catch(() => {});
  await waitFor(async () => (await bus.replay(id)).some(
    (e) => e.reason === 'session.state' && e.to === 'tool_running',
  ));
  const cancelled = await orch.cancel({ instanceId: id });
  assert.equal(cancelled.ok, true, '取消不得被摘要写入阻断');
  await Promise.race([pending, sleep(6000)]).catch(() => {});
  // 重复收尾：再取消一次，摘要仍不得重复写入。
  await orch.cancel({ instanceId: id });

  const summaries = (await bus.replay(id)).filter((e) => e.reason === 'execution.summary');
  assert.equal(summaries.length, 1, '取消同样且仅写一条摘要（重复收尾不重复写）');
  assert.deepEqual(summaries[0].detail.summary, {
    command: null, exitCode: null, keyOutputLines: null, logRef: null,
  }, '取消四项一律 null');
  const disk = (await store.load(id)).state;
  assert.equal(disk.state, 'cancelled');
  assert.equal(disk.sessions[0].state, 'idle');
  assert.equal(disk.sessions[0].toolName, null);
  // D-17: the write path only keeps the existing health metadata; the level is
  // recomputed on the status read path and written back there (AC-17).
  assert.equal(disk.health.nodeTimeoutMs, 30000);
  const viewed = await orch.getStatus({ instanceId: id });
  assert.equal(viewed.snapshot.health.level, 'ended');
  assert.equal((await store.load(id)).state.health.level, 'ended');
});

// --------------------------------------- 7) --stop-after 3 冻结窗口跨度

test('--stop-after 3 冻结窗口恰 3 条跨度、7 字段、无 handoff_ids、HO-002 读取时推导', async (t) => {
  const root = makeRoot(t);
  const drv = spawn(process.execPath, [
    DRIVER, '--root', root, '--scenario', 'backflow-once', '--stop-after', '3', '--keep',
  ], { cwd: root, env: envFor(), stdio: 'ignore' });
  t.after(() => { try { drv.kill('SIGINT'); } catch { /* already gone */ } });
  const marker = path.join(root, '.mock', 'stopped-after-3');
  await waitFor(() => fs.existsSync(marker), { timeoutMs: 30000, intervalMs: 30 });

  const spans = readTraces(root);
  assert.equal(spans.length, 3, '冻结窗口恰 3 条已完成跨度');
  const seven = ['trace_id', 'instance_id', 'node_id', 'round', 'start_time', 'end_time', 'status'];
  for (const span of spans) {
    assert.deepEqual(Object.keys(span).sort(), [...seven].sort(), '每行恰 7 字段');
    assert.ok(!('handoff_ids' in span), 'handoff_ids 不落盘');
    assert.equal(typeof span.trace_id, 'string');
    assert.ok(span.trace_id.startsWith('TRC-'));
    assert.equal(span.instance_id, 'INST-001');
    assert.equal(typeof span.end_time, 'string', '冻结窗口无进行中行');
    assert.equal(typeof span.status, 'string', 'status 用节点状态英文原值');
  }
  // 实例级追踪号复用：三条跨度同一个 trace_id。
  assert.equal(new Set(spans.map((s) => s.trace_id)).size, 1);
  assert.deepEqual(spans.map((s) => s.node_id), ['T-001', 'T-002', 'T-001']);
  assert.deepEqual(spans.map((s) => s.round), [1, 1, 2]);

  // HO-002 不落盘，但读取时由 deriveHandoffIds 从当前快照仍能推导。
  const state = readState(root);
  assert.match(state.traceId, /^TRC-[0-9a-f]{8}$/);
  assert.equal(spans[0].trace_id, state.traceId,
    '首条跨度复用创建时的 state.traceId（不是首条跨度反推）');
  assert.ok(deriveHandoffIds(state, 'T-002', 1).includes('HO-002'),
    'T-002 第 1 轮跨度读取时仍带 HO-002');
  assert.ok(deriveHandoffIds(state, 'T-001', 2).includes('HO-002'));

  fs.writeFileSync(path.join(root, '.mock', 'release'), '');
  drv.kill('SIGINT');
});

// ------------------------------------- 8) 冻结基线：grep 与会话级事件类型

test('grep -c "object: \'session\'" ≤ 13；会话级新增事件类型只有 execution.summary', async (t) => {
  const src = fs.readFileSync(path.join(REPO, 'src', 'core', 'orchestrator.js'), 'utf8');
  const count = src.split('\n').filter((line) => line.includes("object: 'session'")).length;
  assert.ok(count <= 13, `实际 ${count} 处，超过上限 13`);

  const root = makeRoot(t);
  runCli(root, { switches: ['--fail-tool'], task: '执行 out/run.js' });
  const sessionEvents = readEvents(root).filter((e) => e.object === 'session');
  // 存量 12 处是状态迁移事件（result='applied'，reason 随收尾原因动态变化），
  // 本迭代唯一新增的会话级类型是 result='note' 的 execution.summary。
  const notes = sessionEvents.filter((e) => e.result === 'note');
  assert.ok(notes.length > 0, '存在新增的会话级 note 事件');
  assert.ok(notes.every((e) => e.reason === 'execution.summary'),
    '会话级新增事件类型只有 execution.summary 一种');
  const extraTypes = sessionEvents
    .map((e) => e.reason)
    .filter((r) => r.startsWith('execution.') && r !== 'execution.summary');
  assert.equal(extraTypes.length, 0, '不得出现第三类逐条会话审计');
  assert.ok(sessionEvents.some((e) => e.result === 'applied'),
    '12 处存量会话发射点仍在发射');
});

// ---------------------------------------- 9) 三主链运行期输出逐字红线

test('single / code-loop / task-loop 三主链运行期输出不出现健康度 / 追踪新行', async (t) => {
  const cases = [
    { template: 'single', task: '写一份说明' },
    { template: 'code-loop', task: '实现并测试' },
    { template: 'task-loop', task: '产物：demo.md\n正文一句话' },
  ];
  for (const { template, task } of cases) {
    const root = makeRoot(t);
    const res = runCli(root, { template, task });
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    assert.equal(/健康度/.test(out), false, `${template} 运行期不得打印健康度行`);
    assert.equal(/追踪|跨度|回流链|TRC-/.test(out), false, `${template} 运行期不得打印追踪行`);
  }
});
