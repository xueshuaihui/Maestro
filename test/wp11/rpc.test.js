/**
 * WP-6 / §2.18 / AC-57: the 6 lifecycle RPCs, the `approvalPolicy` run.start
 * whitelist, the 3 test-only seams (NODE_ENV=test gate), and the audit-reason
 * contract. Uses a recording fake orchestrator over the real named pipe, the
 * same harness shape as test/wp5/ipc-server.test.js.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { createClient } from '../../src/daemon/client.js';
import { createServer } from '../../src/daemon/server.js';
import { createEventBus } from '../../src/core/event-bus.js';
import { createOrchestrator } from '../../src/core/orchestrator.js';
import { handoffInvalidDetail } from '../../src/core/status-text.js';
import { createStore } from '../../src/persistence/instance-store.js';
import { eventsPath } from '../../src/persistence/paths.js';

const tempDirs = [];

async function makeRoot(tag) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `maestro-wp6-rpc-${tag}-`));
  tempDirs.push(dir);
  return dir;
}

after(async () => {
  for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
});

/** Fake orchestrator implementing every method the new RPCs route to. */
function createFakeOrchestrator(overrides = {}) {
  const calls = [];
  const base = {
    calls,
    mode: 'stub',
    async startRun(args) { calls.push({ method: 'startRun', ...args }); return { ok: true, instanceId: 'INST-001', nodeId: 'T-001', sessionId: 'sess-001' }; },
    async cancel({ instanceId }) { calls.push({ method: 'cancel', instanceId }); return { ok: true, nodes: [], sessions: [], handoffs: [], escalations: [] }; },
    async getStatus({ instanceId }) { calls.push({ method: 'getStatus', instanceId }); return { ok: true, snapshot: { instanceId, state: 'running', nodes: [] } }; },
    async listInstances() { return { ok: true, items: [] }; },
    async waitForRun({ instanceId }) { return { ok: true, snapshot: { instanceId, state: 'running' } }; },
    async reconcileOnBoot() { return { ok: true, interrupted: [] }; },
    async interruptAll() { return { ok: true, interrupted: [] }; },
    async dispose() {},
    // WP-6 lifecycle
    async resolveEscalation(p) { calls.push({ method: 'resolveEscalation', ...p }); return { ok: true, escalationId: p.escalationId, resolution: p.decision }; },
    async listApprovals(p) { calls.push({ method: 'listApprovals', ...p }); return { ok: true, approvals: [] }; },
    async resolveApproval(p) { calls.push({ method: 'resolveApproval', ...p }); return { ok: true, approvalId: p.approvalId, state: 'approved' }; },
    async pause({ instanceId }) { calls.push({ method: 'pause', instanceId }); return { ok: true, paused: true, idempotent: false }; },
    async resume({ instanceId }) { calls.push({ method: 'resume', instanceId }); return { ok: true, paused: false, idempotent: false }; },
    async abort({ instanceId }) { calls.push({ method: 'abort', instanceId }); return { ok: true }; },
    async locateSession({ sessionId }) { calls.push({ method: 'locateSession', sessionId }); return { ok: true, instanceId: 'INST-001', sessionId }; },
    async setApprovalPolicy(policy) { calls.push({ method: 'setApprovalPolicy', policy }); return { ok: true, policy }; },
    // test-only seams
    async dispatchToNode(instanceId, nodeId) { calls.push({ method: 'dispatchToNode', instanceId, nodeId }); return { ok: true, nodeId }; },
    async escalateOnce(instanceId, nodeId, options) { calls.push({ method: 'escalateOnce', instanceId, nodeId, options }); return { ok: true, escalationId: 'ESC-001', reused: true }; },
    async seamHandoff(p) { calls.push({ method: 'seamHandoff', ...p }); return { ok: true, registered: true, ...p }; },
    async holdDelivery(p) { calls.push({ method: 'holdDelivery', ...p }); return { ok: true, action: p.action }; },
    async whenDeliveryHeld() { calls.push({ method: 'whenDeliveryHeld' }); return undefined; },
  };
  return { ...base, ...overrides };
}

async function boot(tag, { env = 'test', overrides = {} } = {}) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  const root = await makeRoot(tag);
  const bus = createEventBus({ store: createStore({ root }) });
  const orchestrator = createFakeOrchestrator(overrides);
  const server = createServer({ root, bus, orchestrator, generation: 'gen-wp6', logger: () => {} });
  const listened = await server.listen();
  assert.equal(listened.ok, true, JSON.stringify(listened));
  const client = createClient({ root });
  const connected = await client.connect({ ensure: false });
  assert.equal(connected.ok, true, JSON.stringify(connected));
  return {
    root, bus, orchestrator, server, client,
    async teardown() {
      await client.close();
      await server.close();
      process.env.NODE_ENV = previous;
    },
  };
}

// ------------------------------------------------------------------ 6 lifecycle RPCs

test('6 个生命周期 RPC 注册并转发正确参数，结果原样放在 result', async () => {
  const b = await boot('lifecycle');
  const { client, orchestrator } = b;
  try {
    const resolved = await client.request('escalation.resolve', {
      instanceId: 'INST-001', escalationId: 'ESC-001', decision: 'fail',
    });
    assert.equal(resolved.ok, true);
    assert.equal(resolved.result.resolution, 'fail');
    assert.ok(orchestrator.calls.some((c) => c.method === 'resolveEscalation' && c.escalationId === 'ESC-001' && c.decision === 'fail'));

    const listed = await client.request('approval.list', { instanceId: 'INST-001' });
    assert.equal(listed.ok, true);
    assert.deepEqual(listed.result.approvals, []);

    const approved = await client.request('approval.resolve', {
      instanceId: 'INST-001', approvalId: 'APR-001', decision: 'allow',
    });
    assert.equal(approved.result.state, 'approved');

    const paused = await client.request('workflow.pause', { instanceId: 'INST-001' });
    assert.equal(paused.result.paused, true);
    const resumed = await client.request('workflow.resume', { instanceId: 'INST-001' });
    assert.equal(resumed.result.paused, false);
    const aborted = await client.request('workflow.abort', { instanceId: 'INST-001' });
    assert.equal(aborted.ok, true);

    const located = await client.request('session.locate', { sessionId: 'sess-001' });
    assert.equal(located.result.sessionId, 'sess-001');

    const routed = orchestrator.calls.filter((c) => ['pause', 'resume', 'abort', 'locateSession', 'listApprovals', 'resolveApproval'].includes(c.method));
    assert.equal(routed.length, 6, '每个 RPC 恰好转发一次');
  } finally {
    await b.teardown();
  }
});

test('参数边界校验：缺必填字段 → IPC_BAD_PARAMS，编排层语义码原样透传', async () => {
  const b = await boot('params', {
    overrides: {
      async resolveApproval() { return { ok: false, code: 'APPROVAL_NOT_FOUND', params: { approvalId: 'APR-404' } }; },
    },
  });
  try {
    for (const [method, params, field] of [
      ['escalation.resolve', { decision: 'fail' }, 'escalationId'],
      ['approval.resolve', { decision: 'allow' }, 'approvalId'],
      ['workflow.pause', {}, 'instanceId'],
      ['workflow.resume', {}, 'instanceId'],
      ['workflow.abort', {}, 'instanceId'],
      ['session.locate', {}, 'sessionId'],
    ]) {
      const res = await b.client.request(method, params);
      assert.equal(res.ok, false, method);
      assert.equal(res.code, 'IPC_BAD_PARAMS', method);
      assert.equal(res.params.field, field, method);
    }
    const semantic = await b.client.request('approval.resolve', {
      instanceId: 'INST-001', approvalId: 'APR-404', decision: 'allow',
    });
    assert.equal(semantic.code, 'APPROVAL_NOT_FOUND', '命令级错误码由编排层透传');
  } finally {
    await b.teardown();
  }
});

test('生命周期 RPC 不随 NODE_ENV 门控：production 下仍可用', async () => {
  const b = await boot('lifecycle-prod', { env: 'production' });
  try {
    const paused = await b.client.request('workflow.pause', { instanceId: 'INST-001' });
    assert.equal(paused.ok, true);
    assert.equal(paused.result.paused, true);
    const pong = await b.client.ping();
    assert.equal(pong.ok, true);
  } finally {
    await b.teardown();
  }
});

// ------------------------------------------------------------------ run.start approvalPolicy

test('run.start 白名单透传 approvalPolicy（D-5.2 / G9），非法取值在边界拒绝', async () => {
  const b = await boot('approvalPolicy');
  try {
    const ok = await b.client.request('run.start', {
      cwd: '.', task: '写一段说明', approvalPolicy: 'hold',
    });
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.ok(b.orchestrator.calls.some((c) => c.method === 'setApprovalPolicy' && c.policy === 'hold'));
    assert.ok(b.orchestrator.calls.some((c) => c.method === 'startRun' && c.approvalPolicy === 'hold'));

    const bad = await b.client.request('run.start', {
      cwd: '.', task: '写一段说明', approvalPolicy: 'maybe',
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 'IPC_BAD_PARAMS');
    assert.equal(bad.params.field, 'approvalPolicy');
  } finally {
    await b.teardown();
  }
});

test('run.start 不传 approvalPolicy 时沿用宿主配置，不调用 setApprovalPolicy', async () => {
  const b = await boot('approvalPolicy-absent');
  try {
    const ok = await b.client.request('run.start', { cwd: '.', task: '写一段说明' });
    assert.equal(ok.ok, true);
    assert.equal(b.orchestrator.calls.some((c) => c.method === 'setApprovalPolicy'), false);
  } finally {
    await b.teardown();
  }
});

// ------------------------------------------------------------------ 3 test seams

test('3 个接缝仅 NODE_ENV=test 挂载：test.handoff / test.delivery / test.escalate', async () => {
  const b = await boot('seams');
  try {
    const handoff = await b.client.request('test.handoff', {
      instanceId: 'INST-001', nodeId: 'T-001', mutate: 'no-evidence',
    });
    assert.equal(handoff.ok, true, JSON.stringify(handoff));
    assert.equal(handoff.result.mutate, 'no-evidence');
    assert.ok(b.orchestrator.calls.some((c) => c.method === 'seamHandoff' && c.mutate === 'no-evidence'));

    const delivery = await b.client.request('test.delivery', {
      instanceId: 'INST-001', action: 'hold',
    });
    assert.equal(delivery.ok, true);
    assert.equal(delivery.result.action, 'hold');
    assert.ok(b.orchestrator.calls.some((c) => c.method === 'holdDelivery' && c.action === 'hold'));

    // D-10 / G10: reasonCode + artifactRefs forwarded to escalateOnce.
    const escalated = await b.client.request('test.escalate', {
      instanceId: 'INST-001', nodeId: 'T-001',
      reasonCode: 'rounds_exceeded', artifactRefs: [{ ref: 'calc.js', sha256: 'abc' }],
    });
    assert.equal(escalated.ok, true);
    const escCall = b.orchestrator.calls.find((c) => c.method === 'escalateOnce');
    assert.equal(escCall.options.reasonCode, 'rounds_exceeded');
    assert.deepEqual(escCall.options.artifactRefs, [{ ref: 'calc.js', sha256: 'abc' }]);

    const bad = await b.client.request('test.handoff', { instanceId: 'INST-001', nodeId: 'T-001' });
    assert.equal(bad.ok, false);
    assert.equal(bad.params.field, 'mutate');
  } finally {
    await b.teardown();
  }
});

test('production 下 3 个接缝一律 IPC_BAD_METHOD，核心不崩', async () => {
  const b = await boot('seams-prod', { env: 'production' });
  try {
    for (const method of ['test.handoff', 'test.delivery', 'test.escalate', 'test.dispatch', 'test.delivery.whenHeld']) {
      const res = await b.client.request(method, { instanceId: 'INST-001', nodeId: 'T-001', action: 'hold', mutate: 'no-evidence' });
      assert.equal(res.ok, false, method);
      assert.equal(res.code, 'IPC_BAD_METHOD', method);
    }
    const pong = await b.client.ping();
    assert.equal(pong.ok, true);
  } finally {
    await b.teardown();
  }
});

// ------------------------------------------------------------------ AC-57 reason set (behavioral)

/**
 * WP-6 M-01：旧版用正则扫源码断言 reason 字面量存在，属"源码自证"——源码里
 * 有字面量不等于事件真的落进 events.jsonl、也不等于广播到总线。这里换成行为
 * 断言：真实 store + 真实 orchestrator（无宿主），在一份"校验失败升级 / 待处理
 * 审批 / 待处理交接包"的快照上跑一次 暂停 → 恢复 → 取消 的流程，覆盖校验
 * (handoff.rejected) / 审批 (approval.withdrawn) / 暂停 / 恢复；随后分别读
 * events.jsonl 原始磁盘文件、store.readEvents、总线广播，断言 reason 序列与
 * detail 逐条等于需求基线（AC-57 requirement.md:884-890、§3.2 的 detail 结构
 * iteration-4.md:550-563、D-3.4 固定文案 iteration-4.md:72 / requirement.md:1557），
 * 而不是"包含某字符串"。
 */
test('AC-57：校验/审批/暂停/恢复 流程的 reason 序列与 detail 落盘并可复盘（行为断言）', async () => {
  const ID = 'INST-AC57';
  const root = await makeRoot('ac57');
  const store = createStore({ root });
  const bus = createEventBus({ store });
  const broadcast = [];
  bus.subscribe((event) => broadcast.push(event));
  const orch = createOrchestrator({
    store,
    bus,
    env: { NODE_ENV: 'test' },
    adapterFactory: { async create() { throw new Error('no host in unit test'); } },
  });

  const T = '2026-01-01T00:00:00.000Z';
  // 校验失败升级的 reasonDetail 固定含 D-3.4 的"缺少证据引用"（文案单源）。
  // 基线逐字取自需求：`交接包 {id} 内容不合规：{detail}`（requirement.md:1557）+
  // D-3.4 固定含"缺少证据引用"（iteration-4.md:72）+ calc.js 样例（iteration-4.md:306）。
  // 先证产品校验器 handoffInvalidDetail 确实产出该基线，再播种进快照，
  // 避免"播种什么就断言什么"的自证。
  const D34 = '交接包 HO-001 内容不合规：缺少证据引用 calc.js';
  assert.equal(
    handoffInvalidDetail('HANDOFF_EVIDENCE_MISSING', { id: 'HO-001', ref: 'calc.js' }),
    D34,
    'D-3.4 校验失败文案必须与需求基线逐字一致'
  );
  await store.save(ID, {
    schemaVersion: 2,
    instanceId: ID,
    state: 'running',
    halted: false,
    rev: 0,
    paused: false,
    task: '写 calc.js',
    cwd: '/tmp/maestro-ac57-work',
    createdAt: T,
    stateSince: T,
    counters: { dispatchCount: 1, eventSeq: 0 },
    nodes: [{ nodeId: 'T-001', state: 'running', round: 1, sessionId: 'sess-001', endedAt: null }],
    sessions: [{ sessionId: 'sess-001', state: 'thinking', nodeId: 'T-001', hostId: null, quarantined: false }],
    handoffs: [{ handoffId: 'HO-001', state: 'created', createdAt: T }],
    escalations: [{
      escalationId: 'ESC-001', nodeId: 'T-001', round: 1, state: 'pending',
      reasonCode: 'handoff_invalid', reasonDetail: D34, defects: [],
      createdAt: T, resolvedAt: null, resolution: null,
    }],
    approvals: [{
      approvalId: 'APR-001', instanceId: ID, nodeId: 'T-001', sessionId: 'sess-001',
      action: 'write', toolCallId: 'tc-1', state: 'pending',
      createdAt: T, resolvedAt: null, resolution: null,
    }],
  });

  try {
    // 一次流程：暂停 / 恢复 / 取消（取消同时作废旧升级、作废待处理审批、拒绝交接包）。
    assert.equal((await orch.pause({ instanceId: ID })).ok, true);
    assert.equal((await orch.resume({ instanceId: ID })).ok, true);
    const cancelled = await orch.cancel({ instanceId: ID });
    assert.equal(cancelled.ok, true, JSON.stringify(cancelled));

    // A-5 / §3.2 / D-3.4 硬编码基线：9 条事件的 reason 序列与逐条 detail。
    // 前 8 条为 I1.3 既有序列；第 9 条是 I1.9 AC-26 要求的取消路径执行摘要
    // （D-27：取消的会话也要有摘要，四项全 null；round 取自取消会话的收尾上下文）。
    const EXPECTED = [
      ['workflow.paused', { paused: true }],
      ['workflow.resumed', { paused: false }],
      ['run.cancelled', null],
      ['run.cancelled', null],
      ['handoff.rejected', { reason: 'withdrawn' }],
      ['escalation.voided', { escalationId: 'ESC-001' }],
      ['approval.withdrawn', { approvalId: 'APR-001' }],
      ['run.cancelled', null],
      ['execution.summary', {
        nodeId: 'T-001',
        round: null,
        summary: { command: null, exitCode: null, keyOutputLines: null, logRef: null },
      }],
    ];
    const expectedReasons = EXPECTED.map(([reason]) => reason);
    const expectedDetails = EXPECTED.map(([, detail]) => detail);

    // (1) 落盘：直接读 events.jsonl 原始磁盘文件，逐行解析、逐字对齐。
    const raw = await fs.readFile(eventsPath(root, ID), 'utf8');
    const disk = raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(disk.length, EXPECTED.length, `events.jsonl 行数应为 ${EXPECTED.length}，实际 ${disk.length}`);
    assert.deepEqual(disk.map((e) => e.reason), expectedReasons);
    assert.deepEqual(disk.map((e) => e.detail ?? null), expectedDetails);

    // (2) 复盘：store.readEvents 与磁盘同序、seq 连续、无坏行。
    const replay = await store.readEvents(ID);
    assert.equal(replay.ok, true);
    assert.equal(replay.badLines, 0);
    assert.deepEqual(replay.events.map((e) => e.seq), EXPECTED.map((_, i) => i + 1));
    assert.deepEqual(replay.events.map((e) => e.reason), expectedReasons);
    assert.deepEqual(replay.events.map((e) => e.detail ?? null), expectedDetails);

    // (3) 广播：总线订阅到的事件与落盘事件同序同 detail（先落盘再广播）。
    assert.deepEqual(broadcast.map((e) => e.reason), expectedReasons);
    assert.deepEqual(broadcast.map((e) => e.detail ?? null), expectedDetails);

    // (4) 校验阶段：流程确实经过一次 D-3.4 校验失败升级，文案逐字保留在快照。
    const loaded = (await store.load(ID)).state;
    assert.equal(loaded.escalations[0].reasonDetail, D34);
  } finally {
    await orch.dispose();
  }
});
