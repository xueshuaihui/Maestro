/**
 * WP-3 contract tests for the local one-hop DAG (AC-05 / AC-06 / AC-38 / AC-39 / AC-40).
 *
 * Pure module surface only: no app.js, no transport, no DOM. Labels are the
 * real frozen table; display words that have no dedicated key arrive as data.
 * Run: NODE_ENV=test node --test test/wp14/drill-dag.test.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { buildDag } from '../../desktop/ui/drill/dag.js';
import { createDrillView } from '../../desktop/ui/drill/index.js';

const labels = { ...UI_LABEL_KEYS };

function fiveNodeDag() {
  return {
    nodes: [
      { nodeId: 'A', relation: 'self', type: 'role', status: 'done' },
      { nodeId: 'B', relation: 'self', type: 'role', status: 'running' },
      { nodeId: 'D', relation: 'self', type: 'role', status: 'pending' },
      { nodeId: 'C', relation: 'upstream', type: 'role', status: 'pending' },
      { nodeId: 'E', relation: 'downstream', type: 'role', status: 'done' },
    ],
    edges: [
      { id: 'E1', from: 'A', to: 'B', direction: 'forward', aggregateStatus: 'done' },
      { id: 'E2', from: 'B', to: 'C', direction: 'forward' },
      { id: 'E3', from: 'C', to: 'D', direction: 'forward' },
      { id: 'E4', from: 'B', to: 'E', direction: 'forward' },
      { id: 'E5', from: 'D', to: 'B', direction: 'backflow', aggregateStatus: 'pending' },
    ],
    bounds: { width: 240, height: 80 },
    dangling: 0,
  };
}

test('AC-05 1-hop set: exactly A/B/C/D/E, bold only for own-role nodes', () => {
  const dag = fiveNodeDag();
  const result = buildDag(dag, labels, { boldRoleNodeIds: ['A', 'B', 'D'] });
  assert.deepEqual(result.nodes.map((n) => n.nodeId), ['A', 'B', 'D', 'C', 'E']);
  assert.deepEqual(result.edges.map((e) => `${e.from}->${e.to}`), [
    'A->B', 'B->C', 'C->D', 'B->E', 'D->B',
  ]);
  assert.deepEqual(result.nodes.filter((n) => n.bold).map((n) => n.nodeId), ['A', 'B', 'D']);
  assert.equal(result.dangling, 0);
});

test('AC-05 solid vs dashed lines, direction words, and byte-equal repeat layouts', () => {
  const dag = fiveNodeDag();
  const a = buildDag(dag, labels, { boldRoleNodeIds: ['A', 'B', 'D'] });
  const b = buildDag(dag, labels, { boldRoleNodeIds: ['A', 'B', 'D'] });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const back = a.edges.find((e) => `${e.from}->${e.to}` === 'D->B');
  assert.equal(back.style, 'dashed');
  assert.equal(a.lines.find((line) => line.includes('D→B')), '局部连线 D→B · 回流 · 待执行');
  for (const edge of a.edges.filter((e) => e.direction === 'forward')) {
    assert.equal(edge.style, 'solid');
  }
  assert.ok(a.lines.includes('局部连线 A→B · 正向 · 已完成'));
});

test('AC-06 clicking DAG nodes drives scrollTarget/highlight through createDrillView', () => {
  const dag = fiveNodeDag();
  const cards = dag.nodes.map((node) => ({ nodeId: node.nodeId, tier: 'blocked', rank: 7 }));
  let tick = 0;
  const view = createDrillView({
    labels,
    data: { dag, cards },
    interactions: { clock: () => { tick += 1; return tick; } },
  });
  assert.equal(view.scrollTarget, null);
  assert.equal(view.highlight, null);
  for (const target of ['A', 'C', 'E']) {
    view.clickNode(target);
    assert.equal(view.scrollTarget, target);
    assert.equal(view.highlight, target);
    assert.ok(view.lastElapsed <= 200);
  }
  assert.equal(view.cards.length, view.dag.nodes.length);
});

test('AC-38 single node with zero edges does not collapse', () => {
  const dag = {
    nodes: [{ nodeId: 'T-030', relation: 'self', type: 'role', status: 'running' }],
    edges: [],
    bounds: { width: 240, height: 80 },
    dangling: 0,
  };
  const result = buildDag(dag, labels, {});
  assert.equal(result.nodes.length, 1);
  assert.equal(result.edges.length, 0);
  assert.ok(result.bounds.width > 0 && result.bounds.height > 0);
  assert.equal(result.dangling, 0);
});

test('AC-39 missing runtime state defaults to pending and follows the projection on source swap', () => {
  const base = {
    nodes: [{ nodeId: 'T-031', relation: 'downstream', type: 'role', status: 'pending' }],
    edges: [],
    bounds: { width: 240, height: 80 },
    dangling: 0,
  };
  const pending = buildDag(base, labels, {});
  assert.equal(pending.nodes[0].status, '待执行');
  assert.ok(pending.lines.includes('局部节点 T-031 · 下游 · 角色 · 待执行'));

  const swapped = { ...base, nodes: [{ ...base.nodes[0], status: 'blocked' }] };
  const blocked = buildDag(swapped, labels, {});
  assert.ok(blocked.lines.includes('局部节点 T-031 · 下游 · 角色 · 被阻塞'));

  const cards = [{ nodeId: 'T-031', relation: 'downstream', state: 'pending', tier: 'blocked', rank: 7 }];
  const viewPending = createDrillView({ labels, data: { dag: base, cards } });
  assert.equal(viewPending.cards[0].displayStatus, '待执行');
  const viewBlocked = createDrillView({
    labels,
    data: { dag: base, cards: [{ ...cards[0], state: 'blocked' }] },
  });
  assert.equal(viewBlocked.cards[0].displayStatus, '被阻塞');
});

test('AC-40 unknown role id keeps the node and renders it as a role node', () => {
  const dag = {
    nodes: [{ nodeId: 'T-032', relation: 'upstream', type: 'role', status: 'running', roleId: 'ghost-role' }],
    edges: [],
    bounds: { width: 240, height: 80 },
    dangling: 0,
  };
  const result = buildDag(dag, labels, {});
  const node = result.nodes.find((n) => n.nodeId === 'T-032');
  assert.equal(node.type, 'role');
  assert.ok(result.lines.includes('局部节点 T-032 · 上游 · 角色 · 执行中'));

  const view = createDrillView({
    labels,
    data: {
      dag,
      cards: [{ nodeId: 'T-032', relation: 'upstream', type: 'role', state: 'running' }],
    },
  });
  assert.ok(view.cards.some((c) => c.nodeId === 'T-032'));
  assert.equal(view.cards.length, view.dag.nodes.length);
});
