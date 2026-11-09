/**
 * WP-5 实例图视图：`instance graph --format json/text`（§1.9 / A-4 / AC-41~43、AC-58）。
 *
 * 覆盖：固定键顺序、无 rev/generatedAt、两次逐字一致、节点按图声明顺序、
 * handoffs/escalations/approvals 稳定升序、current 派生、paused 投影、text 结构、
 * 以及经 `main()` 的只读性。全部为纯函数 / 注入式假客户端，不连真核心。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { main } from '../../src/cli/main.js';
import * as render from '../../src/cli/render.js';
import { getGraph } from '../../src/templates/index.js';

const AT = (h, m, s) => new Date(2026, 10, 4, h, m, s).toISOString();

const GRAPH_KEYS = [
  'graphVersion', 'instanceId', 'template', 'state', 'paused',
  'nodes', 'edges', 'handoffs', 'escalations', 'approvals', 'current',
];

function completedSnapshot(overrides = {}) {
  return {
    instanceId: 'INST-001',
    schemaVersion: 2,
    state: 'completed',
    template: 'code-loop',
    paused: false,
    updatedAt: AT(10, 31, 14),
    rev: 7,
    generatedAt: AT(10, 31, 15),
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1 },
      { nodeId: 'T-002', roleId: 'tester', state: 'done', round: 1 },
    ],
    sessions: [{ sessionId: 'SES-002', state: 'idle' }],
    handoffs: [
      { handoffId: 'HO-001', state: 'consumed', round: 1, edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
    ],
    escalations: [
      { escalationId: 'ESC-002', nodeId: 'T-002', state: 'pending', reasonDetail: '原因 B' },
      { escalationId: 'ESC-001', nodeId: 'T-001', state: 'resolved', resolution: 'pass', reasonDetail: '原因 A' },
    ],
    approvals: [
      { approvalId: 'APR-002', nodeId: 'T-002', state: 'pending', action: 'write' },
      { approvalId: 'APR-001', nodeId: 'T-001', state: 'approved', action: 'write' },
    ],
    ...overrides,
  };
}

function fakeGraphClient(snapshot) {
  const calls = [];
  return {
    calls,
    async connect() { return { ok: true }; },
    async request(method, params) {
      calls.push({ method, params });
      if (method === 'instance.get') return { ok: true, result: snapshot };
      return { ok: true, result: {} };
    },
    subscribe() { return () => {}; },
    async close() {},
  };
}

async function runGraph(argv, snapshot) {
  const lines = [];
  const client = fakeGraphClient(snapshot);
  const code = await main(argv, {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => client,
  });
  return { code, lines, text: lines.join('\n'), client };
}

// ================================================================ JSON 契约（A-4 / §1.9）

test('A-4：固定键顺序恰好 11 键，元素形状与图声明一致', () => {
  const obj = JSON.parse(render.renderGraphJson(completedSnapshot(), getGraph('code-loop')));
  assert.deepEqual(Object.keys(obj), GRAPH_KEYS);
  assert.equal(obj.graphVersion, 1);
  assert.equal(obj.instanceId, 'INST-001');
  assert.equal(obj.template, 'code-loop');
  assert.equal(obj.state, 'completed');
  assert.equal(obj.paused, false);

  // 节点按图声明顺序；title 来自图定义，roleId 保留英文标识
  assert.deepEqual(obj.nodes, [
    { nodeId: 'T-001', title: '开发', roleId: 'developer', state: 'done', round: 1 },
    { nodeId: 'T-002', title: '测试', roleId: 'tester', state: 'done', round: 1 },
  ]);
  assert.deepEqual(obj.edges, [
    { from: 'T-001', to: 'T-002', kind: 'forward' },
    { from: 'T-002', to: 'T-001', kind: 'backflow' },
    { from: 'T-001', to: 'T-002', kind: 'retest' },
  ]);
  assert.deepEqual(obj.handoffs, [
    { handoffId: 'HO-001', from: 'T-001', to: 'T-002', kind: 'forward', state: 'consumed', round: 1 },
  ]);
  assert.equal(obj.current, null);
});

test('§1.9：不输出 rev / generatedAt / updatedAt 或任何 now() 派生字段', () => {
  const snapshot = completedSnapshot(); // 故意带 rev=7、generatedAt、updatedAt
  const obj = JSON.parse(render.renderGraphJson(snapshot, getGraph('code-loop')));
  assert.ok(!('rev' in obj), '不得输出 rev');
  assert.ok(!('generatedAt' in obj), '不得输出 generatedAt');
  assert.ok(!('updatedAt' in obj), '不得输出 updatedAt');
  const text = render.renderGraphJson(snapshot, getGraph('code-loop'));
  assert.ok(!/"rev"\s*:/.test(text), text);
  assert.ok(!/"generatedAt"\s*:/.test(text), text);
  assert.ok(!/"updatedAt"\s*:/.test(text), text);
});

test('AC-41：同一快照两次执行逐字一致（可作为回归基线）', () => {
  const snapshot = completedSnapshot();
  const graph = getGraph('code-loop');
  const a = render.renderGraphJson(snapshot, graph);
  const b = render.renderGraphJson(snapshot, graph);
  assert.equal(a, b);

  // 经 main() 两次命令同样逐字一致
  return (async () => {
    const first = await runGraph(['instance', 'graph', 'INST-001', '--format', 'json'], snapshot);
    const second = await runGraph(['instance', 'graph', 'INST-001', '--format', 'json'], snapshot);
    assert.equal(first.code, 0);
    assert.equal(second.code, 0);
    assert.equal(first.text, second.text);
    assert.deepEqual(JSON.parse(first.text), JSON.parse(a));
  })();
});

test('AC-41/BR-43：快照数组顺序打乱不影响输出（handoffs/escalations/approvals 稳定升序）', () => {
  const snapshot = completedSnapshot({
    handoffs: [
      { handoffId: 'HO-003', state: 'created', round: 3, edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
      { handoffId: 'HO-001', state: 'consumed', round: 1, edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
      { handoffId: 'HO-002', state: 'delivered', round: 2, edge: { from: 'T-001', to: 'T-002', kind: 'retest' } },
    ],
  });
  const obj = JSON.parse(render.renderGraphJson(snapshot, getGraph('code-loop')));
  assert.deepEqual(obj.handoffs.map((entry) => entry.handoffId), ['HO-001', 'HO-002', 'HO-003']);
  assert.deepEqual(obj.escalations.map((entry) => entry.escalationId), ['ESC-001', 'ESC-002']);
  assert.deepEqual(obj.approvals.map((entry) => entry.approvalId), ['APR-001', 'APR-002']);

  // escalations / approvals 是快照条目的原样投影：字段与 state.json 一致、不含渲染用中文
  assert.deepEqual(obj.escalations[0], {
    escalationId: 'ESC-001', nodeId: 'T-001', state: 'resolved', resolution: 'pass', reasonDetail: '原因 A',
  });
  assert.deepEqual(obj.approvals[0], {
    approvalId: 'APR-001', nodeId: 'T-001', state: 'approved', action: 'write',
  });
  assert.ok(!obj.escalations[0].label && !obj.approvals[0].label);

  // 与"数组本就有序"的快照输出逐字一致
  const sorted = completedSnapshot({
    handoffs: [
      { handoffId: 'HO-001', state: 'consumed', round: 1, edge: { from: 'T-001', to: 'T-002', kind: 'forward' } },
      { handoffId: 'HO-002', state: 'delivered', round: 2, edge: { from: 'T-001', to: 'T-002', kind: 'retest' } },
      { handoffId: 'HO-003', state: 'created', round: 3, edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
    ],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-001', state: 'resolved', resolution: 'pass', reasonDetail: '原因 A' },
      { escalationId: 'ESC-002', nodeId: 'T-002', state: 'pending', reasonDetail: '原因 B' },
    ],
    approvals: [
      { approvalId: 'APR-001', nodeId: 'T-001', state: 'approved', action: 'write' },
      { approvalId: 'APR-002', nodeId: 'T-002', state: 'pending', action: 'write' },
    ],
  });
  assert.equal(
    render.renderGraphJson(snapshot, getGraph('code-loop')),
    render.renderGraphJson(sorted, getGraph('code-loop')),
  );
});

test('current：无活动节点为 null；运行节点带 sessionId；interruptedNodeId 优先', () => {
  const graph = getGraph('code-loop');
  assert.equal(JSON.parse(render.renderGraphJson(completedSnapshot(), graph)).current, null);

  const running = completedSnapshot({
    state: 'running',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1 },
      { nodeId: 'T-002', roleId: 'tester', state: 'running', round: 1, sessionId: 'SES-002' },
    ],
  });
  assert.deepEqual(JSON.parse(render.renderGraphJson(running, graph)).current, {
    nodeId: 'T-002', sessionId: 'SES-002', state: 'running',
  });

  const interrupted = completedSnapshot({
    state: 'interrupted',
    interruptedNodeId: 'T-001',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'running', round: 1 },
      { nodeId: 'T-002', roleId: 'tester', state: 'pending', round: 0 },
    ],
  });
  const current = JSON.parse(render.renderGraphJson(interrupted, graph)).current;
  assert.equal(current.nodeId, 'T-001');
  assert.equal(current.state, 'running');
});

test('AC-43：paused / escalations / approvals 在 json 中原样反映', () => {
  const graph = getGraph('code-loop');
  const a = JSON.parse(render.renderGraphJson(
    completedSnapshot({
      state: 'running', paused: true,
      approvals: [{ approvalId: 'APR-001', nodeId: 'T-001', state: 'pending', action: 'write' }],
      escalations: [],
    }),
    graph,
  ));
  assert.equal(a.paused, true);
  assert.equal(a.approvals.length, 1);
  assert.equal(a.approvals[0].state, 'pending');
  assert.deepEqual(Object.keys(a), GRAPH_KEYS);

  const b = JSON.parse(render.renderGraphJson(
    completedSnapshot({
      state: 'suspended', paused: false,
      escalations: [{ escalationId: 'ESC-001', nodeId: 'T-002', state: 'pending', reasonDetail: '原因' }],
      approvals: [],
    }),
    graph,
  ));
  assert.equal(b.paused, false);
  assert.equal(b.escalations.length, 1);
  assert.equal(b.escalations[0].state, 'pending');
});

test('AC-55：旧格式 v1 / single 实例的 template 为 single，边为空', () => {
  const single = {
    instanceId: 'INST-002',
    state: 'running',
    template: 'single',
    node: { state: 'running' },
    session: { state: 'thinking' },
    handoff: null,
  };
  const obj = JSON.parse(render.renderGraphJson(single, getGraph('single')));
  assert.deepEqual(Object.keys(obj), GRAPH_KEYS);
  assert.equal(obj.template, 'single');
  assert.deepEqual(obj.edges, []);
  assert.equal(obj.nodes[0].nodeId, 'T-001');
  assert.equal(obj.nodes[0].title, null);
  const text = render.renderGraphText(single, getGraph('single'));
  assert.equal(text[0], '实例 INST-002 · 单节点 · 运行中');
  assert.equal(text[text.length - 2], '边：');
  assert.equal(text[text.length - 1], '  无');
});

// ================================================================ text 结构（A-3 / AC-42）

test('A-3/AC-42：graph text 首行/节点行/边段落/升级审批摘要逐字', () => {
  const lines = render.renderGraphText(completedSnapshot(), getGraph('code-loop'));
  assert.equal(lines[0], '实例 INST-001 · 编码闭环 · 已完成');
  assert.equal(lines[1], 'T-001 开发 · 已完成 · 第 1 轮');
  assert.equal(lines[2], 'T-002 测试 · 已完成 · 第 1 轮');
  assert.equal(lines[3], '边：');
  assert.equal(lines[4], '  T-001 -> T-002 正向');
  assert.equal(lines[5], '  T-002 -> T-001 回流');
  assert.equal(lines[6], '  T-001 -> T-002 复测');
  assert.ok(lines.includes('升级：ESC-001 T-001 已处理'), lines.join('\n'));
  assert.ok(lines.includes('升级：ESC-002 T-002 待处理'), lines.join('\n'));
  assert.ok(lines.includes('审批：APR-001 T-001 已通过'), lines.join('\n'));
  assert.ok(lines.includes('审批：APR-002 T-002 待处理'), lines.join('\n'));
  // 结构字符为 ASCII（中文仅来自标签/状态）
  assert.ok(!/[↑↓→]/.test(lines.join('\n')));
});

test('A-3/AC-42：暂停时 text 首行带（已暂停），经 main() 输出一致', async () => {
  const paused = completedSnapshot({ state: 'running', paused: true });
  assert.equal(
    render.renderGraphText(paused, getGraph('code-loop'))[0],
    '实例 INST-001 · 编码闭环 · 运行中（已暂停）',
  );

  const textRun = await runGraph(['instance', 'graph', 'INST-001'], paused);
  assert.equal(textRun.code, 0);
  assert.equal(textRun.lines[0], '实例 INST-001 · 编码闭环 · 运行中（已暂停）');

  const jsonRun = await runGraph(['instance', 'graph', 'INST-001', '--format', 'json'], paused);
  assert.equal(jsonRun.code, 0);
  assert.equal(JSON.parse(jsonRun.text).paused, true);
});

// ================================================================ 只读（AC-58）

test('AC-58：instance graph json/text 都严格只读，不调用任何写 RPC', async () => {
  const snapshot = completedSnapshot();
  for (const argv of [
    ['instance', 'graph', 'INST-001'],
    ['instance', 'graph', 'INST-001', '--format', 'json'],
  ]) {
    const { code, client } = await runGraph(argv, snapshot);
    assert.equal(code, 0);
    const methods = client.calls.map((call) => call.method);
    assert.ok(methods.includes('instance.get'), methods.join(','));
    for (const method of methods) {
      assert.ok(
        !['run.start', 'instance.cancel', 'escalation.resolve', 'approval.resolve',
          'workflow.pause', 'workflow.resume', 'workflow.abort', 'core.stop'].includes(method),
        `不得调用写 RPC：${method}`,
      );
    }
  }
});

test('instance graph：实例不存在沿用 I1.1 的 实例 X · 不存在 与退出码 1', async () => {
  const lines = [];
  const code = await main(['instance', 'graph', 'INST-999'], {
    cwd: process.cwd(),
    out: (line) => lines.push(line),
    createClient: () => ({
      async connect() { return { ok: true }; },
      async request() { return { ok: false, code: 'NOT_FOUND', params: {} }; },
      async close() {},
    }),
  });
  assert.equal(code, 1);
  assert.deepEqual(lines, ['实例 INST-999 · 不存在']);
});
