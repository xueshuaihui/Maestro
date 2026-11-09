/**
 * AC-28, graph side: an injected graph (3 nodes, in order, with a backflow edge and
 * a round cap of 2) must drive all four plan outcomes without touching disk, and the
 * engine directory must not carry built-in template/role literals.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  firstNode,
  getGraph,
  isTerminalNode,
  maxRoundsOf,
  nextNode,
  nodeById,
  outgoingEdges,
  validateGraph
} from '../../src/core/graph.js';
import {
  buildBackflowHandoff,
  buildHandoff,
  checkWakeGate,
  classifyNodeOutcome,
  nextHandoffId,
  planAdvance,
  shouldWake
} from '../../src/core/advance.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CORE_DIR = path.resolve(HERE, '../../src/core');
const NOW = () => 1_760_000_000_000;

/** A fake injected graph: A -> B -> C, C backflows to A, C may be dispatched twice. */
const fakeGraph = {
  id: 'fake-3',
  entry: 'N-1',
  terminal: 'N-3',
  terminals: ['N-3'],
  maxRounds: { 'N-3': 2 },
  nodes: [
    { id: 'N-1', roleId: 'alpha', order: 1, products: ['out/a.txt'], prompt: 'forward' },
    { id: 'N-2', roleId: 'beta', order: 2, products: [], prompt: 'forward' },
    { id: 'N-3', roleId: 'gamma', order: 3, products: [], prompt: 'forward' }
  ],
  edges: [
    { from: 'N-1', to: 'N-2', kind: 'forward' },
    { from: 'N-2', to: 'N-3', kind: 'forward' },
    { from: 'N-3', to: 'N-1', kind: 'backflow' }
  ]
};

function nodes(overrides = {}) {
  const base = [
    { nodeId: 'N-1', state: 'done', round: 1, endedAt: '2026-01-01T00:00:01.000Z', verdict: null },
    { nodeId: 'N-2', state: 'pending', round: 0, endedAt: null, verdict: null },
    { nodeId: 'N-3', state: 'pending', round: 0, endedAt: null, verdict: null }
  ];
  return base.map((node) => ({ ...node, ...(overrides[node.nodeId] ?? {}) }));
}

function snapshot(overrides = {}, extra = {}) {
  return { instanceId: 'INST-900', task: 'fake task', handoffs: [], ...extra, nodes: nodes(overrides) };
}

test('注入图的查询函数：入口 / 节点 / 出边 / 终节点 / 轮次上限', () => {
  assert.deepEqual(validateGraph(fakeGraph), { ok: true });
  assert.equal(firstNode(fakeGraph).id, 'N-1');
  assert.equal(nodeById(fakeGraph, 'N-3').roleId, 'gamma');
  assert.equal(nextNode(fakeGraph, 'N-1', { kind: 'forward' }).id, 'N-2');
  assert.equal(nextNode(fakeGraph, 'N-3', { kind: 'backflow' }).id, 'N-1');
  assert.equal(outgoingEdges(fakeGraph, 'N-3').length, 1);
  assert.equal(outgoingEdges(fakeGraph, 'N-3', 'forward').length, 0);
  assert.equal(isTerminalNode(fakeGraph, 'N-3'), true);
  assert.equal(isTerminalNode(fakeGraph, 'N-2'), false);
  assert.equal(maxRoundsOf(fakeGraph, 'N-3'), 2);
  assert.equal(getGraph({ 'fake-3': fakeGraph }, 'fake-3'), fakeGraph);
  assert.equal(getGraph({ 'fake-3': fakeGraph }, 'missing'), null);
});

test('planAdvance：顺序推进 → dispatch（目标轮次 = 派发前 +1）', () => {
  const plan = planAdvance({ graph: fakeGraph, snapshot: snapshot(), now: NOW });
  assert.equal(plan.action, 'dispatch');
  assert.equal(plan.nodeId, 'N-2');
  assert.equal(plan.edge.kind, 'forward');
  assert.equal(plan.round, 1);
  assert.equal(plan.handoffDraft.state, 'created');
  assert.equal(plan.handoffDraft.wakeConsumedAt, null);
});

test('planAdvance：判定不通过且未超上限 → backflow（回开发第 2 轮）', () => {
  const state = snapshot({
    'N-1': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:01.000Z' },
    'N-2': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z' },
    'N-3': {
      state: 'failed',
      round: 1,
      endedAt: '2026-01-01T00:00:03.000Z',
      verdict: { value: 'fail' }
    }
  });
  const verdict = {
    result: 'fail',
    defects: [{ summary: 'division by zero', evidence: 'out/log.txt' }]
  };
  const plan = planAdvance({ graph: fakeGraph, snapshot: state, verdict, now: NOW });
  assert.equal(plan.action, 'backflow');
  assert.equal(plan.nodeId, 'N-1');
  assert.equal(plan.edge.kind, 'backflow');
  assert.equal(plan.round, 2);
  assert.equal(plan.handoffDraft.defects.length, 1);
  assert.equal(plan.handoffDraft.defects[0].evidence, 'out/log.txt');
});

test('planAdvance：第 2 轮仍不通过 → escalate（超上限，不回流）', () => {
  const state = snapshot({
    'N-1': { state: 'done', round: 2, endedAt: '2026-01-01T00:00:04.000Z' },
    'N-2': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z' },
    'N-3': {
      state: 'failed',
      round: 2,
      endedAt: '2026-01-01T00:00:05.000Z',
      verdict: { value: 'fail' }
    }
  });
  const plan = planAdvance({
    graph: fakeGraph,
    snapshot: state,
    verdict: { result: 'fail', defects: [{ summary: 'still broken', evidence: 'out/log.txt' }] },
    now: NOW
  });
  assert.equal(plan.action, 'escalate');
  assert.equal(plan.reason, 'rounds_exceeded');
  assert.equal(plan.nodeId, 'N-3');
  assert.equal(plan.round, 2);
});

test('planAdvance：终节点完成 → complete', () => {
  const state = snapshot({
    'N-1': { state: 'done', round: 2, endedAt: '2026-01-01T00:00:04.000Z' },
    'N-2': { state: 'done', round: 1, endedAt: '2026-01-01T00:00:02.000Z' },
    'N-3': { state: 'done', round: 2, endedAt: '2026-01-01T00:00:06.000Z' }
  });
  const plan = planAdvance({ graph: fakeGraph, snapshot: state, now: NOW });
  assert.equal(plan.action, 'complete');
  assert.equal(plan.nodeId, 'N-3');
});

test('planAdvance：halted 优先于一切，且结果可复现、入参不被修改', () => {
  const state = snapshot({}, { halted: true });
  const before = JSON.stringify(state);
  const first = planAdvance({ graph: fakeGraph, snapshot: state, now: NOW });
  const second = planAdvance({ graph: fakeGraph, snapshot: state, now: NOW });
  assert.equal(first.action, 'halt');
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(state), before);
});

test('shouldWake：缺包 / 轮次超限 / 目标不合法三种拒绝', () => {
  const handoff = {
    handoffId: 'HO-009',
    edge: { from: 'N-3', to: 'N-1', kind: 'backflow' },
    state: 'created',
    wakeConsumedAt: null
  };
  assert.equal(shouldWake({ handoff: null, node: { state: 'done', round: 1 } }).detail.code, 'NO_PENDING_BACKFLOW');
  assert.equal(
    shouldWake({ handoff: { ...handoff, state: 'accepted' }, node: { state: 'done', round: 1 } }).detail.code,
    'NO_PENDING_BACKFLOW'
  );
  assert.equal(
    shouldWake({ handoff, node: { state: 'done', round: 2 }, maxRounds: 2 }).detail.code,
    'ROUNDS_EXCEEDED'
  );
  assert.equal(
    shouldWake({ handoff, node: { state: 'running', round: 1 }, maxRounds: 2 }).detail.code,
    'TARGET_NOT_ELIGIBLE'
  );
  const allowed = shouldWake({ handoff, node: { state: 'done', round: 1 }, maxRounds: 2 });
  assert.deepEqual(allowed, { ok: true, wakeHandoffId: 'HO-009' });
});

test('checkWakeGate：从快照里找到待唤醒包才算通过', () => {
  const handoff = {
    handoffId: 'HO-001',
    edge: { from: 'N-3', to: 'N-1', kind: 'backflow' },
    state: 'delivered',
    wakeConsumedAt: null
  };
  const edge = { from: 'N-3', to: 'N-1', kind: 'backflow' };
  assert.equal(checkWakeGate({ graph: fakeGraph, state: snapshot(), edge }).detail.code, 'NO_PENDING_BACKFLOW');
  const state = snapshot({}, { handoffs: [handoff] });
  assert.deepEqual(checkWakeGate({ graph: fakeGraph, state, edge }), {
    ok: true,
    wakeHandoffId: 'HO-001'
  });
});

test('buildHandoff / buildBackflowHandoff：D-6 字段齐全且缺陷带证据', () => {
  const handoff = buildHandoff({
    instanceId: 'INST-900',
    edge: { from: 'N-1', to: 'N-2', kind: 'forward' },
    round: 1,
    fromNode: { id: 'N-1' },
    toNode: { id: 'N-2' },
    task: 'fake task',
    products: ['out/a.txt'],
    handoffs: [{ handoffId: 'HO-004' }],
    now: NOW
  });
  assert.equal(handoff.handoffId, 'HO-005');
  // D-10.7 授权变更：图驱动交接包在 I1.3 的 16 键之上追加 9 个落盘字段。
  assert.deepEqual(Object.keys(handoff).sort(), [
    'acceptedAt',
    'acceptedSignal',
    'ambiguityWindowMs',
    'artifactRefs',
    'consumedAt',
    'createdAt',
    'defects',
    'deliveredAt',
    'deliveryAttempts',
    'edge',
    'expiredAt',
    'fromNodeId',
    'handoffId',
    'instanceId',
    'lastError',
    'note',
    'pendingAt',
    'rejectReason',
    'rejectedAt',
    'retestRequirement',
    'revisionRequirement',
    'round',
    'state',
    'toNodeId',
    'wakeConsumedAt'
  ]);

  const backflow = buildBackflowHandoff({
    instanceId: 'INST-900',
    edge: { from: 'N-3', to: 'N-1', kind: 'backflow' },
    round: 2,
    fromNode: { id: 'N-3' },
    toNode: { id: 'N-1' },
    task: 'fake task',
    products: ['out/a.txt'],
    defects: [{ summary: 'division by zero', evidence: 'out/log.txt' }],
    retestRequirement: 'guard b === 0',
    handoffs: [],
    now: NOW
  });
  assert.equal(backflow.handoff.edge.kind, 'backflow');
  assert.deepEqual(backflow.handoff.defects, [
    { summary: 'division by zero', evidence: 'out/log.txt' }
  ]);
  assert.equal(backflow.retestRequirement, 'guard b === 0');
  assert.ok(backflow.promptText.includes('division by zero'));
  assert.ok(backflow.promptText.includes('out/log.txt'));
  assert.ok(backflow.promptText.includes('guard b === 0'));
});

test('classifyNodeOutcome 与 nextHandoffId', () => {
  const state = snapshot({
    'N-3': { state: 'failed', round: 1, endedAt: '2026-01-01T00:00:03.000Z', verdict: null }
  });
  assert.equal(classifyNodeOutcome(state, 'N-1'), 'passed');
  assert.equal(classifyNodeOutcome(state, 'N-3'), 'error');
  assert.equal(classifyNodeOutcome(state, 'N-3', { result: 'fail' }), 'verdict-fail');
  assert.equal(classifyNodeOutcome(state, 'N-2'), 'error');
  assert.equal(nextHandoffId([]), 'HO-001');
  assert.equal(nextHandoffId([{ handoffId: 'HO-001' }, { handoffId: 'HO-007' }]), 'HO-008');
});

function scanSources(dir) {
  const hits = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hits.push(...scanSources(full));
      continue;
    }
    if (!entry.name.endsWith('.js') && !entry.name.endsWith('.mjs')) continue;
    const text = fs.readFileSync(full, 'utf8');
    hits.push({ file: entry.name, text });
  }
  return hits;
}

test('src/core 不含编码模板 / 角色字面量（注释也算）', () => {
  const forbidden = ['code-loop', 'developer', 'tester', 'coordinator'];
  const hits = [];
  for (const { file, text } of scanSources(CORE_DIR)) {
    for (const word of forbidden) {
      if (text.includes(word)) hits.push(`${file}:${word}`);
    }
  }

  // AC-28: no file in src/core may carry template/role literals, comments included.
  // purity-check.mjs applies the same rule to src/daemon. No per-file whitelist.
  assert.deepEqual(hits, [], `src/core 出现模板/角色字面量: ${hits.join(', ')}`);
});

test('AC-38：src/core + src/daemon 全目录 7 词扫描零命中', () => {
  const forbid = ['task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者'];
  const script = path.join(REPO_ROOT, 'test', 'fixtures', 'purity-check.mjs');
  const result = spawnSync(process.execPath, [
    script,
    '--dirs', 'src/core,src/daemon',
    '--forbid', forbid.join(','),
  ], { encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    `7 词扫描未通过：\n${result.stdout || ''}${result.stderr || ''}`,
  );
  assert.match(result.stdout, /零命中/);
});

test('图查询与推进规划不读文件、不写状态', () => {
  const files = ['graph.js', 'advance.js'];
  for (const file of files) {
    const text = fs.readFileSync(path.join(CORE_DIR, file), 'utf8');
    assert.equal(text.includes("node:fs"), false, `${file} 不应引入文件系统`);
    assert.equal(/writeFile|readFile|appendFile/.test(text), false, `${file} 不应调用 IO`);
  }
});
