/**
 * Hover highlight tests (I1.10a WP-6; AC-33, F-19 landing point).
 *
 * AC-33 anchor: hovering node B keeps B, all of its upstream and downstream
 * lines (A->B, B->C, D->B) and both endpoints of those lines (A, B, C, D)
 * fully opaque; hovering line B->C keeps that line and its two endpoints.
 * Two pointer leaves restore the full set, and the layout coordinates are
 * identical in every state.
 *
 * F-19: the base AC-33 fixture covers the whole graph (four nodes, four lines),
 * which would make the "everything else is dimmed" half of the assertion
 * vacuous. The fixture therefore adds node E and the line C->E, neither of
 * which is adjacent to B: hovering B must dim both, so the dimming half is
 * decidable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeLayout } from '../../desktop/ui/graph/layout.js';
import { hoverSet } from '../../desktop/ui/graph/highlight.js';

function fixture() {
  return {
    rev: 1,
    nodes: [
      { id: 'A', type: 'role', abnormal: false },
      { id: 'B', type: 'role', abnormal: false },
      { id: 'C', type: 'role', abnormal: false },
      { id: 'D', type: 'role', abnormal: false },
      { id: 'E', type: 'role', abnormal: false },
    ],
    edges: [
      { id: 'E-01', from: 'A', to: 'B', direction: 'forward', aggregateStatus: 'consumed' },
      { id: 'E-02', from: 'B', to: 'C', direction: 'forward', aggregateStatus: 'delivered' },
      { id: 'E-03', from: 'C', to: 'D', direction: 'forward', aggregateStatus: 'consumed' },
      { id: 'E-04', from: 'D', to: 'B', direction: 'backflow', aggregateStatus: 'rejected' },
      { id: 'E-05', from: 'C', to: 'E', direction: 'forward', aggregateStatus: 'consumed' },
    ],
  };
}

const ALL_IDS = ['A', 'B', 'C', 'D', 'E', 'E-01', 'E-02', 'E-03', 'E-04', 'E-05'];

function sorted(list) {
  return [...list].sort();
}

test('AC-33: hovering B highlights three lines and their four endpoints', () => {
  const graph = fixture();
  const { opaqueIds, dimIds } = hoverSet(graph, 'B');
  assert.deepEqual(sorted(opaqueIds), sorted(['A', 'B', 'C', 'D', 'E-01', 'E-02', 'E-04']));
  // F-19: the non-adjacent node E and the non-adjacent line C->E dim.
  assert.equal(dimIds.includes('E'), true);
  assert.equal(dimIds.includes('E-05'), true);
  assert.equal(dimIds.includes('E-03'), true);
  assert.deepEqual(sorted(dimIds), ['E', 'E-03', 'E-05']);
  assert.equal(opaqueIds.length, 7);
});

test('AC-33: hovering the line B->C highlights the line and its two endpoints', () => {
  const graph = fixture();
  const { opaqueIds, dimIds } = hoverSet(graph, 'E-02');
  assert.deepEqual(sorted(opaqueIds), sorted(['B', 'C', 'E-02']));
  assert.equal(dimIds.length, 7);
  assert.equal(dimIds.includes('A'), true);
  assert.equal(dimIds.includes('E-01'), true);
});

test('AC-33: two pointer leaves restore the full set', () => {
  const graph = fixture();
  for (const key of [null, undefined]) {
    const first = hoverSet(graph, key);
    assert.deepEqual(sorted(first.opaqueIds), sorted(ALL_IDS));
    assert.deepEqual(first.dimIds, []);
    const second = hoverSet(graph, 'B');
    const left = hoverSet(graph, key);
    assert.deepEqual(sorted(left.opaqueIds), sorted(ALL_IDS));
    assert.deepEqual(left.dimIds, []);
    assert.equal(second.dimIds.length > 0, true);
  }
  // An unknown key behaves exactly like leaving the element.
  const unknown = hoverSet(graph, 'nope');
  assert.deepEqual(sorted(unknown.opaqueIds), sorted(ALL_IDS));
  assert.deepEqual(unknown.dimIds, []);
});

test('AC-33: highlighting never changes coordinates or sizes', () => {
  const graph = fixture();
  const before = computeLayout(graph);
  hoverSet(graph, 'B');
  hoverSet(graph, 'E-02');
  hoverSet(graph, null);
  const after = computeLayout(graph);
  assert.equal(JSON.stringify(after), JSON.stringify(before));
  for (const node of after.nodes) {
    const twin = before.nodes.find((entry) => entry.id === node.id);
    assert.equal(node.x, twin.x);
    assert.equal(node.y, twin.y);
    assert.equal(node.width, twin.width);
    assert.equal(node.height, twin.height);
  }
});

test('AC-33: the set derives from adjacency, not from positions', () => {
  const graph = fixture();
  // Moving every node to the same coordinates does not change the set.
  const moved = {
    nodes: graph.nodes.map((node) => ({ ...node })),
    edges: graph.edges.map((edge) => ({ ...edge })),
  };
  const original = hoverSet(graph, 'B');
  const shifted = hoverSet(moved, 'B');
  assert.deepEqual(shifted.opaqueIds, original.opaqueIds);
  assert.deepEqual(shifted.dimIds, original.dimIds);
  // The input objects were not mutated.
  assert.deepEqual(graph.nodes.map((node) => node.id), ['A', 'B', 'C', 'D', 'E']);
});
