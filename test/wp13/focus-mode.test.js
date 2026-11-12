/**
 * Focus mode contract tests (I1.10a WP-5).
 *
 * AC-21 anchor: on the chain A->B->C->D->E plus the skip edge A->E, double-
 * clicking C makes exactly B, C, D visible; only edges with both ends
 * visible survive (the A->E skip edge is hidden); the title renders the
 * frozen `DESKTOP_VIEW_FOCUS` template; Esc restores all five nodes and all
 * five edges; and no layout coordinate ever changes.
 *
 * Focus window caliber (see view.js JSDoc): the fixed 2-hop budget splits
 * over both directions, so the visible set is the focused node plus its
 * direct neighbors (undirected BFS depth floor(hops / 2)). The anchor's
 * Then ([B, C, D] with A and E hidden) is the governing baseline.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createViewState } from '../../desktop/ui/graph/view.js';
import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js';

function ac21Graph() {
  return {
    nodes: [
      { id: 'A', x: 0, y: 0, width: 180, height: 80, layer: 0, z: 0 },
      { id: 'B', x: 240, y: 0, width: 180, height: 80, layer: 1, z: 0 },
      { id: 'C', x: 480, y: 0, width: 180, height: 80, layer: 2, z: 0 },
      { id: 'D', x: 720, y: 0, width: 180, height: 80, layer: 3, z: 0 },
      { id: 'E', x: 960, y: 0, width: 180, height: 80, layer: 4, z: 0 },
    ],
    edges: [
      { id: 'E-01', from: 'A', to: 'B', direction: 'forward' },
      { id: 'E-02', from: 'B', to: 'C', direction: 'forward' },
      { id: 'E-03', from: 'C', to: 'D', direction: 'forward' },
      { id: 'E-04', from: 'D', to: 'E', direction: 'forward' },
      { id: 'E-05', from: 'A', to: 'E', direction: 'forward' },
    ],
  };
}

function makeView() {
  const graph = ac21Graph();
  return { graph, view: createViewState({ nodes: graph.nodes, edges: graph.edges }) };
}

test('AC-21: double-click C shows exactly B, C, D', () => {
  const { view } = makeView();
  view.focus('C');
  assert.deepEqual(view.visibleNodeIds(), ['B', 'C', 'D']);
});

test('AC-21: only edges with both ends visible survive; the A->E skip edge hides', () => {
  const { view } = makeView();
  view.focus('C');
  const visibleEdges = view.visibleEdges();
  assert.deepEqual(
    visibleEdges.map((edge) => edge.id),
    ['E-02', 'E-03'], // B->C and C->D; A->B, D->E and the A->E skip edge hide
  );
});

test('AC-21: the title renders the frozen 2-hop template verbatim', () => {
  const { view } = makeView();
  view.focus('C');
  const focusState = view.getFocus();
  assert.equal(focusState.nodeId, 'C');
  const title = DESKTOP_LABEL_KEYS.DESKTOP_VIEW_FOCUS
    .replace('{node}', focusState.nodeId)
    .replace('{hops}', String(focusState.hops));
  assert.equal(title, '聚焦 C（2 跳）');
});

test('AC-21: Esc restores the full node and edge set', () => {
  const { graph, view } = makeView();
  view.focus('C');
  assert.equal(view.visibleNodeIds().length, 3);
  view.exitFocus();
  assert.deepEqual(view.visibleNodeIds(), graph.nodes.map((node) => node.id));
  assert.equal(view.visibleEdges().length, graph.edges.length);
});

test('AC-21: focus never changes screen coordinates', () => {
  const { graph, view } = makeView();
  const before = graph.nodes.map((node) => view.screen(node));
  view.focus('C');
  const during = graph.nodes.map((node) => view.screen(node));
  view.exitFocus();
  const after = graph.nodes.map((node) => view.screen(node));
  assert.deepEqual(before, during);
  assert.deepEqual(before, after);
});
