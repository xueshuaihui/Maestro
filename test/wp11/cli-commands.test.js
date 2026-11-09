/**
 * WP-5 CLI 命令面单测：命令树解析、六组命令输出、AC-64、attach 只读、
 * `single` 逐字红线、暂停后缀插入条件、COMMAND_ERROR 命令级错误。
 *
 * 全部走注入式假客户端（`main()` 的 `createClient`），不连真核心、不写任何 `state.json`。
 * 真实三进程路径见 `test/wp9/cli-e2e.test.js`；graph 的字段/稳定性见 `graph-view.test.js`。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { main, parseArgs, exitCodeFor } from '../../src/cli/main.js';
import * as render from '../../src/cli/render.js';
import { COMMAND_ERROR, INSTANCE_PAUSED_SUFFIX, PENDING_APPROVAL_SUFFIX } from '../../src/cli/labels.js';

const AT = (h, m, s) => new Date(2026, 10, 4, h, m, s).toISOString();

// ---------------------------------------------------------------- 假客户端 / 运行器

/** 通用假客户端：router(method, params, calls) 返回响应；缺省成功空结果。 */
function fakeClient(router = () => undefined, calls = []) {
  return {
    calls,
    async connect(opts) {
      calls.push({ method: 'connect', opts });
      return { ok: true };
    },
    async request(method, params) {
      calls.push({ method, params });
      return router(method, params, calls) ?? { ok: true, result: {} };
    },
    subscribe(instanceId) {
      calls.push({ method: 'subscribe', params: { instanceId } });
      return () => {};
    },
    async close() {
      calls.push({ method: 'close' });
    },
    async ping() {
      return { ok: true, result: {} };
    },
    async waitForClose() {
      return { ok: true };
    },
  };
}

/** 多实例场景：instance.list + instance.get + instance.events 全部按内存表回，写动作可覆盖。 */
function scenarioClient(instances, { events = {}, extra = {} } = {}) {
  const byId = new Map(instances.map((entry) => [entry.instanceId, entry.snapshot]));
  const calls = [];
  const router = (method, params) => {
    if (method === 'instance.list') {
      return {
        ok: true,
        result: { items: instances.map((entry) => ({ instanceId: entry.instanceId, readable: true })) },
      };
    }
    if (method === 'instance.get') {
      const snapshot = byId.get(params.instanceId);
      return snapshot ? { ok: true, result: snapshot } : { ok: false, code: 'NOT_FOUND', params: {} };
    }
    if (method === 'instance.events') {
      return { ok: true, result: { events: events[params.instanceId] ?? [] } };
    }
    const handler = extra[method];
    if (typeof handler === 'function') return handler(params, { byId, calls });
    if (handler !== undefined) return handler;
    return { ok: true, result: {} };
  };
  const client = fakeClient(router, calls);
  client.byId = byId;
  return client;
}

async function run(argv, client, options = {}) {
  const lines = [];
  const code = await main(argv, {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
    ...options,
  });
  return { code, lines, text: lines.join('\n') };
}

/** 只读方法白名单：查看类命令绝不能出现任何写 RPC。 */
const WRITE_METHODS = new Set([
  'run.start', 'instance.cancel', 'escalation.resolve', 'approval.resolve',
  'workflow.pause', 'workflow.resume', 'workflow.abort', 'core.stop',
]);

function assertReadOnly(client) {
  for (const call of client.calls) {
    assert.ok(!WRITE_METHODS.has(call.method), `查看类命令不得调用写 RPC：${call.method}`);
  }
}

// ---------------------------------------------------------------- 快照夹具

function baseSnapshot(overrides = {}) {
  return {
    instanceId: 'INST-001',
    schemaVersion: 2,
    state: 'running',
    template: 'code-loop',
    paused: false,
    elapsedMs: 60_000,
    updatedAt: AT(10, 30, 5),
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1, startedAt: AT(10, 29, 0), endedAt: AT(10, 30, 2) },
      { nodeId: 'T-002', roleId: 'tester', state: 'running', round: 1, startedAt: AT(10, 30, 3) },
    ],
    sessions: [{ sessionId: 'SES-001', state: 'waiting_input', pendingPermission: 'write' }],
    handoffs: [
      {
        handoffId: 'HO-001', state: 'consumed', createdAt: AT(10, 30, 2), deliveredAt: AT(10, 30, 3),
        consumedAt: AT(10, 30, 40), edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      },
    ],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限：测试已派发 2 次仍未通过' },
    ],
    approvals: [
      { approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' },
    ],
    ...overrides,
  };
}

function escalateFixtures() {
  const inst1 = baseSnapshot({
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限：测试已派发 2 次仍未通过' },
      { escalationId: 'ESC-002', nodeId: 'T-002', round: 1, state: 'resolved', resolution: 'pass', reasonDetail: '已通过' },
      { escalationId: 'ESC-003', nodeId: 'T-001', round: 1, state: 'voided', reasonDetail: '已作废' },
    ],
  });
  const inst2 = baseSnapshot({
    instanceId: 'INST-002',
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 1, state: 'pending', reasonDetail: '另一实例的待处理' },
    ],
  });
  return [inst1, inst2];
}

function handoffFixtures() {
  const inst1 = baseSnapshot({
    handoffs: [
      {
        handoffId: 'HO-001', state: 'consumed', createdAt: AT(10, 30, 2), deliveredAt: AT(10, 30, 3),
        consumedAt: AT(10, 30, 40), edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      },
      {
        handoffId: 'HO-002', state: 'rejected', rejectReason: 'invalid_payload',
        createdAt: AT(10, 30, 2), rejectedAt: AT(10, 30, 6),
        edge: { from: 'T-002', to: 'T-001', kind: 'backflow' },
        artifactRefs: { input: [{ ref: 'out/verdict.json' }] },
        defects: [{ summary: '除零边界缺失', evidence: 'out/missing-log.txt' }],
        revisionRequirement: '请补除零分支',
        deliveryAttempts: 0, lastError: null, inboxPath: null,
      },
    ],
  });
  const inst2 = baseSnapshot({
    instanceId: 'INST-002',
    handoffs: [
      { handoffId: 'HO-001', state: 'created', createdAt: AT(10, 31, 0), edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
    ],
  });
  return [inst1, inst2];
}

function approvalFixtures() {
  const inst1 = baseSnapshot({
    approvals: [
      { approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' },
      { approvalId: 'APR-002', nodeId: 'T-001', state: 'approved', action: 'write' },
      { approvalId: 'APR-003', nodeId: 'T-001', state: 'denied', action: 'write' },
      { approvalId: 'APR-004', nodeId: 'T-001', state: 'withdrawn', action: 'write' },
    ],
  });
  const inst2 = baseSnapshot({
    instanceId: 'INST-002',
    approvals: [{ approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' }],
  });
  return [inst1, inst2];
}

// ================================================================ 命令树解析

test('parseArgs：两层命令 + 子命令 + 位置参数 + 新 flag', () => {
  const cases = [
    [['instance', 'status', 'INST-001'], 'instance', 'status', ['INST-001'], {}],
    [['instance', 'log', 'INST-001', '--format', 'json'], 'instance', 'log', ['INST-001'], { format: 'json' }],
    [['instance', 'graph', 'INST-001', '--format', 'text'], 'instance', 'graph', ['INST-001'], { format: 'text' }],
    [['attach', 'SES-001'], 'attach', null, ['SES-001'], {}],
    [['escalate', 'list', '--all'], 'escalate', 'list', [], { all: true }],
    [['escalate', 'resolve', 'ESC-001', '--decision', 'pass', '--instance', 'INST-001'], 'escalate', 'resolve', ['ESC-001'], { decision: 'pass', instance: 'INST-001' }],
    [['approve', 'APR-001', '--decision', 'deny'], 'approve', null, ['APR-001'], { decision: 'deny' }],
    [['handoff', 'list'], 'handoff', 'list', [], {}],
    [['handoff', 'show', 'HO-002', '--instance', 'INST-001'], 'handoff', 'show', ['HO-002'], { instance: 'INST-001' }],
    [['workflow', 'pause', 'INST-001'], 'workflow', 'pause', ['INST-001'], {}],
    [['workflow', 'resume', 'INST-001'], 'workflow', 'resume', ['INST-001'], {}],
    [['workflow', 'abort', 'INST-001'], 'workflow', 'abort', ['INST-001'], {}],
  ];
  for (const [argv, command, sub, positionals, flags] of cases) {
    const parsed = parseArgs(argv);
    assert.equal(parsed.ok, true, JSON.stringify(argv));
    assert.equal(parsed.command, command);
    assert.equal(parsed.sub, sub);
    assert.deepEqual(parsed.positionals, positionals, JSON.stringify(argv));
    assert.deepEqual(parsed.flags, flags, JSON.stringify(argv));
  }
});

test('parseArgs：--instance 可替代位置参数（C-12）', () => {
  const a = parseArgs(['instance', 'status', '--instance', 'INST-001']);
  assert.equal(a.ok, true);
  assert.deepEqual(a.positionals, []);
  assert.equal(a.flags.instance, 'INST-001');

  const b = parseArgs(['workflow', 'resume', '--instance', 'INST-001']);
  assert.equal(b.ok, true);
  assert.deepEqual(b.positionals, []);
});

test('parseArgs：旧命令与旧参数逐字兼容', () => {
  const run = parseArgs(['run', '--cwd', './demo', '--task', '写一段说明', '--instance', 'INST-001', '--template', 'code-loop', '--host', 'mock']);
  assert.equal(run.ok, true);
  assert.deepEqual(run.flags, { cwd: './demo', task: '写一段说明', instance: 'INST-001', template: 'code-loop', host: 'mock' });
  assert.equal(run.sub, null);

  const status = parseArgs(['status', '--instance', 'INST-001', '--events']);
  assert.deepEqual(status.flags, { instance: 'INST-001', events: true });

  assert.equal(parseArgs(['cancel', '--instance', 'INST-001']).ok, true);
  assert.equal(parseArgs(['core', 'stop']).ok, true);
  assert.equal(parseArgs(['run', '--cwd=./demo', '--task=hello world']).ok, true);
  assert.deepEqual(parseArgs(['run', '--cwd=./demo', '--task=hello world']).flags, {
    cwd: './demo', task: 'hello world',
  });
});

test('parseArgs：未知命令 / 多余参数 / 缺子命令 / 缺编号 → 用法错误', () => {
  const bad = [
    [], ['bogus'], ['status', '--nope'], ['status', '--instance'], ['run', '--cwd'],
    ['cancel'], ['core'], ['core', 'serve', '--project', 'D:/x'], ['status', 'extra'],
    ['instance'], ['instance', 'bogus', 'INST-001'], ['instance', 'status'],
    ['attach'], ['approve'], ['escalate', 'resolve'], ['handoff', 'show'],
    ['escalate', 'list', 'extra'], ['escalate'], ['handoff'], ['workflow'],
  ];
  for (const argv of bad) {
    assert.equal(parseArgs(argv).ok, false, JSON.stringify(argv));
  }
});

test('未知命令退出码 2，且不连核心', async () => {
  for (const argv of [[], ['bogus'], ['instance', 'bogus'], ['status', 'extra']]) {
    const lines = [];
    const code = await main(argv, {
      out: (line) => lines.push(line),
      createClient: () => assert.fail('用法错误不得连核心'),
    });
    assert.equal(code, 2, JSON.stringify(argv));
    assert.ok(lines.join('\n').includes('orch run|status|cancel|core'));
  }
});

test('exitCodeFor：命令级错误码一律 1、用法 2、预检 3', () => {
  for (const code of [
    'SESSION_NOT_FOUND', 'ESCALATION_NOT_FOUND', 'ESCALATION_NOT_PENDING', 'ESCALATION_DECISION_INVALID',
    'ESCALATION_AMBIGUOUS', 'INSTANCE_NOT_SUSPENDED', 'APPROVAL_NOT_FOUND', 'APPROVAL_NOT_PENDING',
    'APPROVAL_AMBIGUOUS', 'APPROVAL_SESSION_GONE', 'HANDOFF_NOT_FOUND', 'HANDOFF_AMBIGUOUS',
    'INSTANCE_NOT_PAUSABLE', 'INSTANCE_NOT_RESUMABLE', 'STORE_CONFLICT',
  ]) {
    assert.equal(exitCodeFor(code), 1, code);
  }
  assert.equal(exitCodeFor('USAGE'), 2);
  assert.equal(exitCodeFor('WORKSPACE_INIT_FAILED'), 3);
});

// ================================================================ AC-64 非法参数

test('AC-64：四条非法参数退出 2、含允许值说明、不连核心、不写状态', async () => {
  const cases = [
    [['run', '--cwd', './demo', '--task', 't', '--approval', 'maybe'], 'allow|reject|hold'],
    [['instance', 'graph', 'INST-001', '--format', 'yaml'], 'text|json'],
    [['escalate', 'resolve', 'ESC-001', '--decision', 'maybe'], 'pass|fail|retry'],
    [['approve', 'APR-001', '--decision', 'maybe'], 'allow|deny'],
  ];
  for (const [argv, allowed] of cases) {
    const lines = [];
    let connected = false;
    const code = await main(argv, {
      out: (line) => lines.push(line),
      createClient: () => {
        connected = true;
        throw new Error('非法参数不得连核心');
      },
    });
    assert.equal(code, 2, JSON.stringify(argv));
    assert.equal(connected, false, JSON.stringify(argv));
    assert.ok(lines.join('\n').includes(allowed), `${JSON.stringify(argv)} 应含 ${allowed}\n${lines.join('\n')}`);
    assert.ok(lines.join('\n').includes('orch run|status|cancel|core'));
  }
});

test('AC-64：合法取值组合在解析层放行', () => {
  assert.equal(parseArgs(['run', '--cwd', '.', '--task', 't', '--approval', 'hold']).ok, true);
  assert.equal(parseArgs(['instance', 'graph', 'I', '--format', 'json']).ok, true);
  assert.equal(parseArgs(['escalate', 'resolve', 'E', '--decision', 'retry']).ok, true);
  assert.equal(parseArgs(['approve', 'A', '--decision', 'allow']).ok, true);
  assert.equal(parseArgs(['approve', 'A', '--decision', 'deny']).ok, true);
});

// ================================================================ instance status|log|graph

test('AC-38：instance status 与 status --instance 逐字一致（含不存在分支）', async () => {
  const snapshot = baseSnapshot();
  const a = await run(['instance', 'status', 'INST-001'], scenarioClient([{ instanceId: 'INST-001', snapshot }]));
  const b = await run(['status', '--instance', 'INST-001'], scenarioClient([{ instanceId: 'INST-001', snapshot }]));
  assert.equal(a.code, 0);
  assert.equal(b.code, 0);
  assert.deepEqual(a.lines, b.lines);

  const missingA = await run(['instance', 'status', 'INST-999'], scenarioClient([]));
  const missingB = await run(['status', '--instance', 'INST-999'], scenarioClient([]));
  assert.equal(missingA.code, 1);
  assert.equal(missingB.code, 1);
  assert.deepEqual(missingA.lines, ['实例 INST-999 · 不存在']);
  assert.deepEqual(missingB.lines, ['实例 INST-999 · 不存在']);
});

test('instance status：升级块之后按审批号逐条列出审批（AC-36）', async () => {
  const [inst1] = approvalFixtures();
  const client = scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]);
  const { code, lines } = await run(['instance', 'status', 'INST-001'], client);
  assert.equal(code, 0);
  const text = lines.join('\n');
  assert.ok(text.includes('升级 ESC-001 待处理'), text);
  assert.ok(text.includes('审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write'), text);
  assert.ok(text.includes('审批 APR-002 已通过 · 节点 T-001 开发 · 动作 write'), text);
  assert.ok(text.includes('审批 APR-003 已拒绝 · 节点 T-001 开发 · 动作 write'), text);
  assert.ok(text.includes('审批 APR-004 已作废 · 节点 T-001 开发 · 动作 write'), text);
  // 审批行排在升级块之后（升级块最后一行是「下一步」）
  const escIndex = lines.findIndex((line) => line.startsWith('升级 ESC-001 待处理'));
  const nextIndex = lines.findIndex((line) => line.includes('下一步：'));
  const aprIndex = lines.findIndex((line) => line.startsWith('审批 APR-001'));
  assert.ok(escIndex >= 0 && nextIndex > escIndex && aprIndex > nextIndex, text);
  assertReadOnly(client);
});

test('instance log：文本按 seq 顺序、json 为原始数组、空事件打印 事件 —', async () => {
  const events = [
    { seq: 12, ts: AT(10, 30, 5), object: 'handoff', objectId: 'HO-001', from: 'delivered', to: 'accepted', result: 'applied', reason: 'turn.first_event' },
    { seq: 5, ts: AT(10, 30, 1), object: 'node', objectId: 'T-002', from: 'pending', to: 'running', result: 'applied', reason: 'node.dispatch', detail: { round: 1 } },
  ];
  const client = scenarioClient(
    [{ instanceId: 'INST-001', snapshot: baseSnapshot() }],
    { events: { 'INST-001': events } },
  );
  const textRun = await run(['instance', 'log', 'INST-001'], client);
  assert.equal(textRun.code, 0);
  assert.equal(
    textRun.lines[0],
    '[#5] 10:30:01  节点 T-002  派发 → 执行中  原因 派发 · 第 1 轮',
    textRun.text,
  );
  assert.equal(
    textRun.lines[1],
    '[#12] 10:30:05  交接包 HO-001  已投递 → 已接受  原因 首个事件',
    textRun.text,
  );

  const jsonClient = scenarioClient(
    [{ instanceId: 'INST-001', snapshot: baseSnapshot() }],
    { events: { 'INST-001': events } },
  );
  const jsonRun = await run(['instance', 'log', 'INST-001', '--format', 'json'], jsonClient);
  assert.equal(jsonRun.code, 0);
  const parsed = JSON.parse(jsonRun.text);
  assert.ok(Array.isArray(parsed));
  assert.deepEqual(parsed.map((event) => event.seq), [5, 12]);
  assert.equal(parsed[0].object, 'node');

  const emptyClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }], { events: {} });
  const emptyRun = await run(['instance', 'log', 'INST-001'], emptyClient);
  assert.deepEqual(emptyRun.lines, ['事件 —']);
  assertReadOnly(client);
});

test('instance graph：text 结构 / json 字段，且都是只读（字段细节见 graph-view.test.js）', async () => {
  const graphClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }]);
  const textRun = await run(['instance', 'graph', 'INST-001'], graphClient);
  assert.equal(textRun.code, 0);
  assert.equal(textRun.lines[0], '实例 INST-001 · 编码闭环 · 运行中');
  assert.ok(textRun.text.includes('边：'), textRun.text);
  assert.ok(textRun.text.includes('T-001 -> T-002 正向'), textRun.text);
  assertReadOnly(graphClient);

  const jsonClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }]);
  const jsonRun = await run(['instance', 'graph', 'INST-001', '--format', 'json'], jsonClient);
  assert.equal(jsonRun.code, 0);
  assert.equal(JSON.parse(jsonRun.text).template, 'code-loop');
  assertReadOnly(jsonClient);
});

// ================================================================ escalate list|resolve

test('AC-21/22：escalate list 默认待处理 / --instance 过滤 / --all 放开 / 组合 / 空态', async () => {
  const [inst1, inst2] = escalateFixtures();
  const client = scenarioClient([
    { instanceId: 'INST-001', snapshot: inst1 },
    { instanceId: 'INST-002', snapshot: inst2 },
  ]);

  const def = await run(['escalate', 'list'], client);
  assert.equal(def.code, 0);
  assert.equal(def.lines.length, 2, def.text);
  assert.ok(def.text.includes('升级 ESC-001  实例 INST-001'), def.text);
  assert.ok(def.text.includes('升级 ESC-001  实例 INST-002'), def.text);
  assert.ok(!def.text.includes('ESC-002') && !def.text.includes('ESC-003'), def.text);
  assert.ok(def.text.includes('节点 T-002 测试 · 第 2 轮  待处理  回流超上限'), def.text);

  const all = await run(['escalate', 'list', '--all'], client);
  assert.equal(all.lines.length, 4, all.text);
  assert.ok(all.text.includes('已处理（通过）'), all.text);
  assert.ok(all.text.includes('已作废'), all.text);

  const one = await run(['escalate', 'list', '--instance', 'INST-001'], client);
  assert.ok(!one.text.includes('INST-002'), one.text);
  assert.equal(one.lines.length, 1);

  const combo = await run(['escalate', 'list', '--instance', 'INST-001', '--all'], client);
  assert.equal(combo.lines.length, 3, combo.text);
  assert.ok(!combo.text.includes('INST-002'), combo.text);

  const empty = await run(['escalate', 'list'], scenarioClient([]));
  assert.deepEqual(empty.lines, ['升级 —']);
  assertReadOnly(client);
});

test('escalate resolve：成功打印结果行 + 当前实例行，退出 0 / 再次挂起退出 4', async () => {
  const [inst1] = escalateFixtures();
  const client = scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }], {
    extra: {
      'escalation.resolve': (params, { byId }) => {
        byId.set(params.instanceId, { ...byId.get(params.instanceId), state: 'completed' });
        return { ok: true, result: {} };
      },
    },
  });
  const { code, lines } = await run(
    ['escalate', 'resolve', 'ESC-002', '--decision', 'pass', '--instance', 'INST-001'],
    client,
  );
  assert.equal(code, 0);
  assert.equal(lines[0], '升级 ESC-002 已处理（通过）');
  assert.ok(lines[1].startsWith('实例 INST-001 · 已完成'), lines.join('\n'));
  assert.ok(client.calls.some((call) => call.method === 'escalation.resolve' && call.params.decision === 'pass'));

  // 处理后又挂起 → 4
  const again = scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }], {
    extra: {
      'escalation.resolve': (params, { byId }) => {
        byId.set(params.instanceId, { ...byId.get(params.instanceId), state: 'suspended' });
        return { ok: true, result: {} };
      },
    },
  });
  const suspended = await run(
    ['escalate', 'resolve', 'ESC-001', '--decision', 'retry', '--instance', 'INST-001'],
    again,
  );
  assert.equal(suspended.code, 4);
  assert.ok(suspended.text.includes('下一步：'), suspended.text);
});

test('escalate resolve：COMMAND_ERROR 命令级错误（不存在 / 歧义 / 已处理 / 决策不允许）', async () => {
  const [inst1, inst2] = escalateFixtures();
  const client = scenarioClient([
    { instanceId: 'INST-001', snapshot: inst1 },
    { instanceId: 'INST-002', snapshot: inst2 },
  ], {
    extra: {
      'escalation.resolve': () => ({ ok: false, code: 'ESCALATION_DECISION_INVALID', params: { allowed: 'fail|retry' } }),
    },
  });

  const missing = await run(['escalate', 'resolve', 'ESC-999', '--decision', 'pass'], client);
  assert.equal(missing.code, 1);
  assert.deepEqual(missing.lines, [`未找到升级 ESC-999`]);

  const ambiguous = await run(['escalate', 'resolve', 'ESC-001', '--decision', 'pass'], client);
  assert.equal(ambiguous.code, 1);
  assert.deepEqual(ambiguous.lines, ['升级号 ESC-001 在多个实例中存在，请加 --instance']);

  const invalid = await run(
    ['escalate', 'resolve', 'ESC-001', '--instance', 'INST-001', '--decision', 'pass'],
    client,
  );
  assert.equal(invalid.code, 1);
  assert.deepEqual(invalid.lines, ['升级 ESC-001 不支持「pass」；可选：fail|retry']);
});

// ================================================================ approve

test('approve：成功打印审批结果行，allow=已通过 / deny=已拒绝', async () => {
  const [inst1] = approvalFixtures();
  const allowClient = scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]);
  const allow = await run(['approve', 'APR-001', '--instance', 'INST-001', '--decision', 'allow'], allowClient);
  assert.equal(allow.code, 0);
  assert.deepEqual(allow.lines, ['审批 APR-001 已通过 · 动作 write']);

  const denyClient = scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]);
  const deny = await run(['approve', 'APR-001', '--instance', 'INST-001', '--decision', 'deny'], denyClient);
  assert.equal(deny.code, 0);
  assert.deepEqual(deny.lines, ['审批 APR-001 已拒绝 · 动作 write']);
});

test('approve：不存在 / 歧义 / 会话失效都复用 COMMAND_ERROR，退出 1', async () => {
  const [inst1, inst2] = approvalFixtures();
  const missing = await run(
    ['approve', 'APR-999', '--decision', 'allow'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]),
  );
  assert.equal(missing.code, 1);
  assert.deepEqual(missing.lines, ['未找到审批 APR-999']);

  const ambiguous = await run(
    ['approve', 'APR-001', '--decision', 'allow'],
    scenarioClient([
      { instanceId: 'INST-001', snapshot: inst1 },
      { instanceId: 'INST-002', snapshot: inst2 },
    ]),
  );
  assert.equal(ambiguous.code, 1);
  assert.deepEqual(ambiguous.lines, ['审批号 APR-001 在多个实例中存在，请加 --instance']);

  const gone = await run(
    ['approve', 'APR-001', '--instance', 'INST-001', '--decision', 'allow'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }], {
      extra: { 'approval.resolve': () => ({ ok: false, code: 'APPROVAL_SESSION_GONE', params: {} }) },
    }),
  );
  assert.equal(gone.code, 1);
  assert.deepEqual(gone.lines, ['审批 APR-001 已失效：会话不在运行']);
});

// ================================================================ handoff list|show

test('AC-46：handoff list 跨实例稳定排序 / --instance 过滤 / 空态', async () => {
  const [inst1, inst2] = handoffFixtures();
  const client = scenarioClient([
    { instanceId: 'INST-001', snapshot: inst1 },
    { instanceId: 'INST-002', snapshot: inst2 },
  ]);
  const all = await run(['handoff', 'list'], client);
  assert.equal(all.code, 0);
  assert.equal(all.lines.length, 3, all.text);
  assert.ok(all.text.includes('交接包 HO-001  实例 INST-001  开发→测试  已完成  10:30:40'), all.text);
  assert.ok(all.text.includes('已拒绝（内容不合规）'), all.text);
  assert.ok(all.text.indexOf('实例 INST-001') < all.text.indexOf('实例 INST-002'), all.text);

  const one = await run(['handoff', 'list', '--instance', 'INST-001'], client);
  assert.equal(one.lines.length, 2, one.text);
  assert.ok(!one.text.includes('INST-002'), one.text);

  const empty = await run(['handoff', 'list'], scenarioClient([]));
  assert.deepEqual(empty.lines, ['交接包 —']);
  assertReadOnly(client);
});

test('AC-47/48/70：handoff show 完整字段 / 唯一编号省略 --instance / 找不到 / 歧义', async () => {
  const [inst1, inst2] = handoffFixtures();
  const client = scenarioClient([
    { instanceId: 'INST-001', snapshot: inst1 },
    { instanceId: 'INST-002', snapshot: inst2 },
  ]);
  const show = await run(['handoff', 'show', 'HO-002'], client);
  assert.equal(show.code, 0);
  assert.equal(show.lines[0], '交接包 HO-002');
  const text = show.text;
  assert.ok(text.includes('  实例：INST-001'), text);
  assert.ok(text.includes('  方向：测试→开发（回流）'), text);
  assert.ok(text.includes('  状态：已拒绝（内容不合规）'), text);
  assert.ok(text.includes('  证据：out/verdict.json'), text);
  assert.ok(text.includes('  缺陷：除零边界缺失（证据 out/missing-log.txt）'), text);
  assert.ok(text.includes('  修改要求：请补除零分支'), text);
  assert.ok(text.includes('  尝试：0/3'), text);
  assert.ok(text.includes('  最后错误：—'), text);
  assert.ok(text.includes('  信箱：—'), text);

  const missing = await run(['handoff', 'show', 'HO-999', '--instance', 'INST-001'], client);
  assert.equal(missing.code, 1);
  assert.deepEqual(missing.lines, ['未找到交接包 HO-999']);

  const ambiguous = await run(['handoff', 'show', 'HO-001'], client);
  assert.equal(ambiguous.code, 1);
  assert.deepEqual(ambiguous.lines, ['交接包号 HO-001 在多个实例中存在，请加 --instance']);
  assertReadOnly(client);
});

// ================================================================ workflow

test('workflow pause/resume：打印当前实例行，暂停带（已暂停），退出 0', async () => {
  const pausedClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }], {
    extra: {
      'workflow.pause': (params, { byId }) => {
        byId.set(params.instanceId, { ...byId.get(params.instanceId), paused: true });
        return { ok: true, result: {} };
      },
    },
  });
  const paused = await run(['workflow', 'pause', 'INST-001'], pausedClient);
  assert.equal(paused.code, 0);
  assert.deepEqual(paused.lines, ['实例 INST-001 · 运行中（已暂停） · 模板 编码闭环']);

  const resumeClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot({ paused: true }) }], {
    extra: {
      'workflow.resume': (params, { byId }) => {
        byId.set(params.instanceId, { ...byId.get(params.instanceId), paused: false });
        return { ok: true, result: {} };
      },
    },
  });
  const resumed = await run(['workflow', 'resume', 'INST-001'], resumeClient);
  assert.equal(resumed.code, 0);
  assert.deepEqual(resumed.lines, ['实例 INST-001 · 运行中 · 模板 编码闭环']);
});

test('workflow abort：与 cancel 一致的结果行；不适用动作复用 INSTANCE_NOT_*', async () => {
  const abortClient = scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }], {
    extra: {
      'workflow.abort': () => ({
        ok: true,
        result: {
          sessions: [{ state: 'idle' }],
          nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'cancelled' }],
          handoffs: [], escalations: [],
        },
      }),
    },
  });
  const aborted = await run(['workflow', 'abort', 'INST-001'], abortClient);
  assert.equal(aborted.code, 0);
  assert.ok(aborted.text.includes('会话 空闲'), aborted.text);
  assert.ok(aborted.text.includes('节点 T-001 开发 已取消'), aborted.text);

  const notPausable = await run(
    ['workflow', 'pause', 'INST-001'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }], {
      extra: { 'workflow.pause': () => ({ ok: false, code: 'INSTANCE_NOT_PAUSABLE', params: { state: 'completed' } }) },
    }),
  );
  assert.equal(notPausable.code, 1);
  assert.deepEqual(notPausable.lines, ['实例 INST-001 当前为已完成，不能暂停']);

  const notResumable = await run(
    ['workflow', 'resume', 'INST-001'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: baseSnapshot() }], {
      extra: { 'workflow.resume': () => ({ ok: false, code: 'INSTANCE_NOT_RESUMABLE', params: { state: 'failed' } }) },
    }),
  );
  assert.equal(notResumable.code, 1);
  assert.deepEqual(notResumable.lines, ['实例 INST-001 当前为失败，不能恢复']);
});

// ================================================================ attach

test('A-3/AC-44：attach 首屏 + 待审批行 + 事件跟随 + Ctrl-C 脱离，全程只读', async () => {
  const events = [
    { seq: 1, ts: AT(10, 30, 1), object: 'session', objectId: 'SES-001', from: 'idle', to: 'thinking', result: 'applied', reason: 'session.state' },
    { seq: 2, ts: AT(10, 30, 2), object: 'session', objectId: 'SES-001', from: 'thinking', to: 'waiting_input', result: 'applied', reason: 'permission.requested' },
    { seq: 3, ts: AT(10, 30, 3), object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', result: 'applied', reason: 'handoff.delivered' },
  ];
  const snapshot = baseSnapshot();
  const client = fakeClient((method, params) => {
    if (method === 'session.locate') {
      return { ok: true, result: { instanceId: 'INST-001', nodeId: 'T-001', session: { sessionId: 'SES-001' } } };
    }
    if (method === 'instance.get') return { ok: true, result: snapshot };
    if (method === 'approval.list') {
      return { ok: true, result: { approvals: [{ approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' }] } };
    }
    if (method === 'instance.events') return { ok: true, result: { events } };
    return { ok: true, result: {} };
  });

  const { code, lines, text } = await run(['attach', 'SES-001'], client, {
    waitForDetach: async () => {},
  });
  assert.equal(code, 0);
  assert.equal(lines[0], '已附着会话 SES-001（实例 INST-001 · 节点 T-001 开发）');
  assert.ok(text.includes('审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write'), text);
  assert.ok(text.includes('会话 SES-001'), text);
  assert.equal(lines[lines.length - 1], '已脱离会话 SES-001');
  assertReadOnly(client);
});

test('A-3/AC-45：attach 找不到会话 → 未找到会话 + 退出 1，且无状态写入', async () => {
  const client = fakeClient((method) => {
    if (method === 'session.locate') return { ok: false, code: 'SESSION_NOT_FOUND', params: {} };
    return { ok: true, result: {} };
  });
  const { code, lines } = await run(['attach', 'SES-999'], client, { waitForDetach: async () => {} });
  assert.equal(code, 1);
  assert.deepEqual(lines, ['未找到会话 SES-999']);
  assertReadOnly(client);
});

test('A-3：attach 首屏最多 20 条事件且只取该会话', async () => {
  const events = [];
  for (let seq = 1; seq <= 40; seq += 1) {
    events.push({
      seq, ts: AT(10, 30, seq % 60), object: 'session', objectId: seq % 2 === 0 ? 'SES-001' : 'OTHER',
      from: 'idle', to: 'thinking', result: 'applied', reason: 'session.state',
    });
  }
  const client = fakeClient((method) => {
    if (method === 'session.locate') return { ok: true, result: { instanceId: 'INST-001', nodeId: 'T-001' } };
    if (method === 'instance.get') return { ok: true, result: baseSnapshot() };
    if (method === 'approval.list') return { ok: true, result: { approvals: [] } };
    if (method === 'instance.events') return { ok: true, result: { events } };
    return { ok: true, result: {} };
  });
  let followCalls = 0;
  const wrapped = {
    ...client,
    request: async (method, params) => {
      if (method === 'instance.events' && params.sinceSeq !== undefined) followCalls += 1;
      return client.request(method, params);
    },
  };
  const { lines } = await run(['attach', 'SES-001'], wrapped, { waitForDetach: async () => {} });
  // 只数 `[#n]` 开头的事件行（首屏头行与脱离行不算事件）
  const eventLines = lines.filter((line) => line.startsWith('[#'));
  assert.ok(eventLines.length >= 1 && eventLines.length <= 20, `事件行数=${eventLines.length}`);
  assert.ok(!lines.some((line) => line.includes('会话 OTHER')), '只打印该会话事件');
});

// ================================================================ single 逐字红线 / 暂停后缀

test('single 逐字红线：无新能力时不打印任何新段，paused 是纯后缀', () => {
  const single = { instanceId: 'INST-001', state: 'running', template: 'single' };
  assert.equal(render.renderInstanceLine(single), '实例 INST-001 · 运行中');
  assert.equal(render.renderInstanceLine({ ...single, paused: true }), `实例 INST-001 · 运行中${INSTANCE_PAUSED_SUFFIX}`);
  // 暂停后缀贴在状态词后、模板段之前 → 既有 parts 顺序不变
  const loop = { instanceId: 'INST-001', state: 'running', template: 'code-loop' };
  assert.equal(render.renderInstanceLine(loop), '实例 INST-001 · 运行中 · 模板 编码闭环');
  assert.equal(
    render.renderInstanceLine({ ...loop, paused: true }),
    `实例 INST-001 · 运行中${INSTANCE_PAUSED_SUFFIX} · 模板 编码闭环`,
  );
});

test('暂停后缀插入条件：仅 paused === true 时插入', () => {
  const base = { instanceId: 'INST-001', state: 'running', template: 'single' };
  for (const paused of [false, undefined, null, 'true', 1, 0]) {
    assert.equal(
      render.renderInstanceLine({ ...base, paused }),
      '实例 INST-001 · 运行中',
      `paused=${String(paused)}`,
    );
  }
  assert.equal(render.renderInstanceLine({ ...base, paused: true }), '实例 INST-001 · 运行中（已暂停）');
  // 列表行同口径
  assert.equal(
    render.renderInstanceListRow({ instanceId: 'INST-001', state: 'running' }, { ...base, paused: true }),
    '实例 INST-001 · 运行中（已暂停） · 节点 - · 会话 - · 耗时 - · 更新 -',
  );
});

test('列表行：无暂停/无审批时逐字不变；有审批计数仅 >0 时追加', () => {
  const item = { instanceId: 'INST-001', state: 'running', template: 'code-loop', nodeState: 'running', sessionState: 'thinking', pendingEscalations: 1 };
  const snapshot = { ...baseSnapshot(), paused: false, approvals: [] };
  const plain = render.renderInstanceListRow(item, snapshot);
  assert.ok(plain.includes('待处理升级 1'), plain);
  assert.ok(!plain.includes('待处理审批'), plain);
  assert.ok(!plain.includes('已暂停'), plain);

  const withApprovals = render.renderInstanceListRow(
    { ...item, pendingApprovals: 2, paused: true },
    { ...snapshot, paused: true },
  );
  assert.ok(withApprovals.includes('运行中（已暂停）'), withApprovals);
  assert.ok(withApprovals.includes(PENDING_APPROVAL_SUFFIX.replace('{n}', '2')), withApprovals);
});

test('前台 run 遇暂停：退出 0，收尾正好实例行 + 恢复提示（A-2 #6）', async () => {
  const waitSnapshot = { instanceId: 'INST-001', state: 'running', paused: true, template: 'code-loop' };
  const client = {
    calls: [],
    async connect() { return { ok: true }; },
    async request(method) {
      this.calls.push(method);
      if (method === 'run.start') return { ok: true, result: { instanceId: 'INST-001', sessionId: 'SES-001' } };
      if (method === 'instance.get') return { ok: true, result: { instanceId: 'INST-001', state: 'running', template: 'code-loop' } };
      if (method === 'run.wait') return { ok: true, result: waitSnapshot };
      return { ok: true, result: {} };
    },
    subscribe() { return () => {}; },
    async close() {},
  };
  const { code, lines } = await run(['run', '--cwd', '.', '--task', 't', '--template', 'code-loop'], client);
  assert.equal(code, 0);
  assert.deepEqual(lines.slice(-2), [
    '实例 INST-001 · 运行中（已暂停） · 模板 编码闭环',
    '下一步：恢复推进 orch workflow resume INST-001',
  ]);
});

test('AC-37：run 等待期间出现待审批立即打印审批行，且 --approval 透传为 approvalPolicy', async () => {
  const initial = baseSnapshot({
    state: 'running',
    sessions: [{ sessionId: 'SES-001', state: 'waiting_input', pendingPermission: 'write' }],
  });
  const final = { ...initial, state: 'completed' };
  const client = {
    calls: [],
    async connect() { return { ok: true }; },
    async request(method, params) {
      this.calls.push({ method, params });
      if (method === 'run.start') return { ok: true, result: { instanceId: 'INST-001', sessionId: 'SES-001' } };
      if (method === 'instance.get') return { ok: true, result: initial };
      if (method === 'run.wait') return { ok: true, result: final };
      return { ok: true, result: {} };
    },
    subscribe() { return () => {}; },
    async close() {},
  };
  const { code, text } = await run(
    ['run', '--cwd', '.', '--task', 't', '--template', 'code-loop', '--approval', 'hold'],
    client,
  );
  assert.equal(code, 0);
  assert.ok(text.includes('审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write'), text);
  const started = client.calls.find((call) => call.method === 'run.start');
  assert.equal(started.params.approvalPolicy, 'hold');
});

// ================================================================ COMMAND_ERROR 单源

test('COMMAND_ERROR：14 条命令级文案全部来自 labels.js，renderCommandError 不另造中文', () => {
  const cases = [
    ['SESSION_NOT_FOUND', { id: 'SES-999' }, '未找到会话 SES-999'],
    ['ESCALATION_NOT_FOUND', { id: 'ESC-999' }, '未找到升级 ESC-999'],
    ['ESCALATION_AMBIGUOUS', { id: 'ESC-001' }, '升级号 ESC-001 在多个实例中存在，请加 --instance'],
    ['INSTANCE_NOT_SUSPENDED', { id: 'INST-001' }, '实例 INST-001 当前不是挂起状态，不能处理升级'],
    ['APPROVAL_NOT_FOUND', { id: 'APR-999' }, '未找到审批 APR-999'],
    ['APPROVAL_AMBIGUOUS', { id: 'APR-001' }, '审批号 APR-001 在多个实例中存在，请加 --instance'],
    ['APPROVAL_SESSION_GONE', { id: 'APR-001' }, '审批 APR-001 已失效：会话不在运行'],
    ['HANDOFF_NOT_FOUND', { id: 'HO-999' }, '未找到交接包 HO-999'],
    ['HANDOFF_AMBIGUOUS', { id: 'HO-001' }, '交接包号 HO-001 在多个实例中存在，请加 --instance'],
  ];
  for (const [code, params, expected] of cases) {
    assert.ok(typeof COMMAND_ERROR[code] === 'string', `${code} 必须在 COMMAND_ERROR`);
    assert.equal(render.renderCommandError(code, params), expected, code);
  }

  // 带状态本地化的两条：{state} 走 labels.js 的状态表
  assert.equal(
    render.renderCommandError('INSTANCE_NOT_PAUSABLE', { id: 'INST-001', state: 'completed' }),
    '实例 INST-001 当前为已完成，不能暂停',
  );
  assert.equal(
    render.renderCommandError('INSTANCE_NOT_RESUMABLE', { id: 'INST-001', state: 'suspended' }),
    '实例 INST-001 当前为已挂起，不能恢复',
  );
  assert.equal(
    render.renderCommandError('ESCALATION_NOT_PENDING', { id: 'ESC-001', state: 'resolved' }),
    '升级 ESC-001 已处理（已处理），无需再次处理',
  );
  assert.equal(
    render.renderCommandError('ESCALATION_DECISION_INVALID', { id: 'ESC-001', decision: 'pass', allowed: 'fail|retry' }),
    '升级 ESC-001 不支持「pass」；可选：fail|retry',
  );
  assert.equal(
    render.renderCommandError('APPROVAL_NOT_PENDING', { id: 'APR-001', state: 'approved' }),
    '审批 APR-001 已处理（已通过），无需再次处理',
  );

  // 通用码仍走 renderError，不进 COMMAND_ERROR
  assert.equal(render.renderCommandError('STORE_CONFLICT', {}), '操作冲突，请重试');
  assert.equal(COMMAND_ERROR.STORE_CONFLICT, undefined);
});

// ================================================================ A-2 / A-3 逐字整串基线（WP-5 M-01）

/**
 * WP-5 M-01：`assert.ok(text.includes(...))` 只锁子串，锁不住 A-2 / A-3 的
 * 逐字整串——增删行、换词、改字段顺序都可能从 includes 漏过。下面把六类命令
 * 的输出按需求 A-2 / A-3 的样例整串硬编码（基线抄自 requirement.md，非从实现
 * 反推），用 deepEqual(lines, 基线数组) 锁死；原有 includes 断言一律保留。
 * 夹具数据刻意对齐需求样例，故基线可与需求逐字一致。
 */

test('A-3 逐字：escalate list 单行（requirement.md:1202）', async () => {
  const snapshot = baseSnapshot({
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限：测试已派发 2 次仍未通过' },
    ],
  });
  const { code, lines } = await run(['escalate', 'list'], scenarioClient([{ instanceId: 'INST-001', snapshot }]));
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    '升级 ESC-001  实例 INST-001  节点 T-002 测试 · 第 2 轮  待处理  回流超上限：测试已派发 2 次仍未通过',
  ]);
});

test('A-3 逐字：escalate resolve 结果行 + 实例行（requirement.md:1220-1221）', async () => {
  const snapshot = baseSnapshot({
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限：测试已派发 2 次仍未通过' },
    ],
  });
  const client = scenarioClient([{ instanceId: 'INST-001', snapshot }], {
    extra: {
      'escalation.resolve': (params, { byId }) => {
        byId.set(params.instanceId, { ...byId.get(params.instanceId), state: 'completed' });
        return { ok: true, result: {} };
      },
    },
  });
  const { code, lines } = await run(
    ['escalate', 'resolve', 'ESC-001', '--decision', 'pass', '--instance', 'INST-001'],
    client,
  );
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    '升级 ESC-001 已处理（通过）',
    '实例 INST-001 · 已完成 · 模板 编码闭环',
  ]);
});

test('A-3 逐字：handoff list 两行（requirement.md:1241-1242）', async () => {
  const snapshot = baseSnapshot({
    handoffs: [
      { handoffId: 'HO-001', state: 'consumed', createdAt: AT(10, 30, 2), deliveredAt: AT(10, 30, 3), consumedAt: AT(10, 30, 5), edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
      { handoffId: 'HO-002', state: 'rejected', rejectReason: 'invalid_payload', createdAt: AT(10, 30, 2), rejectedAt: AT(10, 30, 6), edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
    ],
  });
  const { code, lines } = await run(['handoff', 'list'], scenarioClient([{ instanceId: 'INST-001', snapshot }]));
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    '交接包 HO-001  实例 INST-001  开发→测试  已完成  10:30:05',
    '交接包 HO-002  实例 INST-001  测试→开发（回流）  已拒绝（内容不合规）  10:30:06',
  ]);
});

test('A-3 逐字：handoff show 完整 12 行（requirement.md:1256-1267）', async () => {
  const [inst1] = handoffFixtures();
  const { code, lines } = await run(
    ['handoff', 'show', 'HO-002', '--instance', 'INST-001'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]),
  );
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    '交接包 HO-002',
    '  实例：INST-001',
    '  方向：测试→开发（回流）',
    '  状态：已拒绝（内容不合规）',
    '  构造：10:30:02  待投递：—  投递：—  接受：—  完成：—  拒绝：10:30:06  过期：—',
    '  证据：out/verdict.json',
    '  缺陷：除零边界缺失（证据 out/missing-log.txt）',
    '  修改要求：请补除零分支',
    '  复测要求：—',
    '  尝试：0/3',
    '  最后错误：—',
    '  信箱：—',
  ]);
});

test('A-3 逐字：approve allow / deny 单行（requirement.md:1229 / 1235）', async () => {
  const [inst1] = approvalFixtures();
  const allow = await run(
    ['approve', 'APR-001', '--instance', 'INST-001', '--decision', 'allow'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]),
  );
  assert.equal(allow.code, 0);
  assert.deepEqual(allow.lines, ['审批 APR-001 已通过 · 动作 write']);

  const deny = await run(
    ['approve', 'APR-001', '--instance', 'INST-001', '--decision', 'deny'],
    scenarioClient([{ instanceId: 'INST-001', snapshot: inst1 }]),
  );
  assert.equal(deny.code, 0);
  assert.deepEqual(deny.lines, ['审批 APR-001 已拒绝 · 动作 write']);
});

test('A-3 逐字：attach 无事件时首屏 + 待审批行 + 脱离行（requirement.md:1275-1282）', async () => {
  const client = fakeClient((method) => {
    if (method === 'session.locate') {
      return { ok: true, result: { instanceId: 'INST-001', nodeId: 'T-001', session: { sessionId: 'SES-001' } } };
    }
    if (method === 'instance.get') return { ok: true, result: baseSnapshot() };
    if (method === 'approval.list') {
      return { ok: true, result: { approvals: [{ approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' }] } };
    }
    if (method === 'instance.events') return { ok: true, result: { events: [] } };
    return { ok: true, result: {} };
  });
  const { code, lines } = await run(['attach', 'SES-001'], client, { waitForDetach: async () => {} });
  assert.equal(code, 0);
  assert.deepEqual(lines, [
    '已附着会话 SES-001（实例 INST-001 · 节点 T-001 开发）',
    '审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write',
    '已脱离会话 SES-001',
  ]);
});
