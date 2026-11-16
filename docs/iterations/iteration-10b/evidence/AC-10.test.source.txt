/**
 * WP-3 contract tests for task cards (AC-07 / AC-08 / AC-09 / AC-10 / AC-35 / AC-41).
 *
 * The clock is injected; display words that have no frozen label key arrive as
 * data fields, never as literals in the module. Pure module surface only.
 * Run: NODE_ENV=test node --test test/wp14/drill-cards.test.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { SESSION_LABEL } from '../../src/cli/labels.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { CARD_TIERS, buildCards } from '../../desktop/ui/drill/cards.js';

const labels = { ...UI_LABEL_KEYS };
const NOW = Date.parse('2026-11-15T10:12:00.000Z');
const MINUS_12M = '2026-11-15T10:00:00.000Z';

function session(state, extra = {}) {
  return {
    state,
    label: SESSION_LABEL[state],
    stateSince: MINUS_12M,
    currentTool: null,
    ...extra,
  };
}

test('AC-07 A-3 six lines verbatim for a normal and an empty card', () => {
  const cards = [
    {
      nodeId: 'T-003', title: '实现登录', round: '1/2', state: 'running',
      tier: 'running', rank: 3, relation: 'self', roleName: '开发',
      session: session('thinking', { currentTool: 'write' }),
      deps: [{ nodeId: 'T-001', state: 'done' }],
      products: ['artifacts/code/calc.js'], evidence: 2,
    },
    {
      nodeId: 'T-001', title: '需求澄清', round: '1/1', state: 'done',
      tier: 'done', rank: 8, relation: 'self', roleName: '协调者',
      session: null, deps: [], products: [], evidence: 0,
    },
  ];
  const result = buildCards(cards, labels, { now: NOW });
  assert.deepEqual(result[0].lines, [
    '卡片 T-003 · 实现登录 · 轮次 1/2 · 执行中',
    '执行 开发 · 执行中 · 已运行 12m · 工具 write',
    '依赖 T-001 已完成 · 产物 calc.js · 证据 2',
  ]);
  assert.deepEqual(result[1].lines, [
    '卡片 T-001 · 需求澄清 · 轮次 1/1 · 已完成',
    '执行 协调者 · 无会话 · — · 工具 —',
    '依赖 — · 产物 — · 证据 0',
  ]);
});

test('AC-08 eight-tier ordering: ranks [1..8,8], assigned folded only in display', () => {
  const spec = [
    ['T-010', 'escalated', 1, 'self'],
    ['T-011', 'failed', 2, 'downstream'],
    ['T-012', 'assigned', 5, 'upstream'],
    ['T-013', 'running', 3, 'self'],
    ['T-014', 'review', 4, 'downstream'],
    ['T-015', 'ready', 6, 'upstream'],
    ['T-016', 'blocked', 7, 'self'],
    ['T-017', 'done', 8, 'self'],
    ['T-018', 'done', 8, 'downstream'],
  ];
  const cards = spec.map(([nodeId, tier, rank, relation]) => ({
    nodeId, tier, rank, relation, state: tier, title: nodeId, round: '1/1', session: null,
  }));
  const result = buildCards(cards, labels, { now: NOW });
  assert.deepEqual(result.map((c) => c.nodeId), [
    'T-010', 'T-011', 'T-013', 'T-014', 'T-012', 'T-015', 'T-016', 'T-017', 'T-018',
  ]);
  assert.deepEqual(result.map((c) => c.rank), [1, 2, 3, 4, 5, 6, 7, 8, 8]);
  assert.equal(result.find((c) => c.nodeId === 'T-012').tier, 'assigned');
  assert.equal(result.find((c) => c.nodeId === 'T-012').displayStatus, '执行中');
  assert.deepEqual(CARD_TIERS, [
    'escalated', 'failed', 'running', 'review', 'assigned', 'ready', 'blocked', 'done',
  ]);
});

test('AC-09 seven indicator groups with exact token triples', () => {
  const states = ['idle', 'thinking', 'tool_running', 'waiting_input', 'waiting_dependency', 'escalated'];
  const cards = states.map((state, i) => ({
    nodeId: `N-${i}`, state: 'running', tier: 'running', rank: 3,
    session: session(state, state === 'waiting_input' ? { action: 'git_push' } : {}),
  }));
  cards.push({ nodeId: 'N-none', state: 'running', tier: 'running', rank: 3, session: null });
  const result = buildCards(cards, labels, { now: NOW });
  const expect = [
    ['空闲', 'gray', 'none', null, ''],
    ['执行中', 'blue', 'pulse', null, ''],
    ['执行中', 'blue', 'pulse', 'tool', ''],
    ['等待审批：git_push', 'yellow', 'none', null, '：git_push'],
    ['等待下游', 'yellow', 'none', null, ''],
    ['已升级', 'red', 'none', null, ''],
    ['无会话', 'gray', 'none', null, ''],
  ];
  assert.equal(result.length, 7);
  for (let i = 0; i < expect.length; i += 1) {
    const ind = result[i].indicator;
    assert.deepEqual([ind.label, ind.color, ind.animation, ind.icon, ind.detail], expect[i]);
  }
});

test('AC-10 five special/exception lines verbatim', () => {
  const cards = [
    { nodeId: 'H-001', type: 'human', title: '人工验收', round: '0/1', state: 'pending', tier: 'ready', rank: 6, session: null },
    { nodeId: 'X-001', type: 'escalate', title: '人工裁决', round: '2/2', state: 'escalated', tier: 'escalated', rank: 1, session: null },
    { nodeId: 'S-001', type: 'subworkflow', workflowTitle: '发布子流程', roleCount: 3, round: '1/1', state: 'pending', tier: 'ready', rank: 6, session: null },
    { nodeId: 'U-001', type: 'notify-broadcast', title: '播报确认', round: '1/1', state: 'pending', tier: 'ready', rank: 6, session: null },
    { nodeId: 'Z-001', type: 'role', title: '未知任务', round: '1/1', state: 'mystery', tier: 'blocked', rank: 7, boardColumn: 'blocked', session: null },
  ];
  const result = buildCards(cards, labels, { now: NOW });
  assert.equal(result.length, 5);
  const firstLines = Object.fromEntries(result.map((c) => [c.nodeId, c.lines[0]]));
  assert.equal(firstLines['H-001'], '卡片 人工节点 H-001 · 人工验收 · 轮次 0/1 · 待执行');
  assert.equal(firstLines['X-001'], '卡片 升级节点 X-001 · 人工裁决 · 轮次 2/2 · 已升级');
  assert.equal(firstLines['S-001'], '卡片 子工作流：发布子流程 · 角色 3 · 轮次 1/1 · 待执行');
  assert.equal(firstLines['U-001'], '卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行');
  assert.equal(firstLines['Z-001'], '卡片 Z-001 · 未知任务 · 轮次 1/1 · 状态未知');
  const z = result.find((c) => c.nodeId === 'Z-001');
  assert.equal(z.tier, 'blocked');
  assert.equal(z.boardColumn, 'blocked');
});

test('AC-35 elapsed from injected clock: 12m stable, 13m after 60s', () => {
  const cards = [{
    nodeId: 'T-003', title: 'n', round: '1/2', state: 'running', tier: 'running', rank: 3,
    roleName: 'r', session: session('thinking', { currentTool: 'write' }), deps: [], products: [], evidence: 0,
  }];
  const before = JSON.stringify(cards[0].session.stateSince);
  const a = buildCards(cards, labels, { now: NOW });
  const b = buildCards(cards, labels, { now: NOW });
  const c = buildCards(cards, labels, { now: NOW + 60_000 });
  assert.equal(a[0].elapsed, '12m');
  assert.equal(b[0].elapsed, '12m');
  assert.equal(c[0].elapsed, '13m');
  assert.ok(a[0].lines[1].includes('已运行 12m'));
  assert.ok(c[0].lines[1].includes('已运行 13m'));
  assert.equal(JSON.stringify(cards[0].session.stateSince), before);
});

test('AC-41 missing values use placeholder; TBD from projection passes through', () => {
  const cards = [
    {
      nodeId: 'T-033', round: '1/1', state: 'pending', tier: 'ready', rank: 6,
      session: null, deps: [], products: [], evidence: 0,
    },
    {
      nodeId: 'T-034', round: '1/1', state: 'running', tier: 'running', rank: 3,
      session: {
        state: 'thinking', label: SESSION_LABEL.thinking,
        stateSince: new Date(NOW - 3 * 60_000).toISOString(), currentTool: null,
      },
    },
  ];
  const result = buildCards(cards, labels, { now: NOW });
  const t033 = result.find((c) => c.nodeId === 'T-033');
  const t034 = result.find((c) => c.nodeId === 'T-034');
  assert.equal(t033.lines[0], '卡片 T-033 · — · 轮次 1/1 · 待执行');
  assert.equal(t034.lines[1], '执行 — · 执行中 · 已运行 3m · 工具 —');
  for (const card of result) {
    for (const line of card.lines) {
      assert.ok(!/undefined|null/.test(line), line);
    }
  }
  const swapped = buildCards([{ ...cards[0], title: 'TBD' }], labels, { now: NOW });
  assert.equal(swapped[0].lines[0], '卡片 T-033 · TBD · 轮次 1/1 · 待执行');
});
