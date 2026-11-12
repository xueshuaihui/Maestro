/**
 * Layout contract tests (I1.10a WP-5).
 *
 * AC-17 anchor: hierarchical layout over the pure graph A->B, A->C, B->D,
 * D->B (backflow), C->D — layers A=0/B=1/C=1/D=2, x = 0/240/240/480, B and C
 * y differ, the backflow keeps B on layer 1 and renders as an arc, and two
 * consecutive layouts are byte-equal. Gate: `grep -REn "Date[.]now|fs[.]"
 * desktop/ui/graph/layout.js` must stay at zero hits.
 *
 * AC-18 anchor: the same graph with only B escalated — per-node diff shows
 * an empty coordinate/size diff set, z diff exactly {B: 1}, edges connected
 * to B lift to z 1, and clearing the abnormality restores z 0 with the same
 * coordinates.
 *
 * AC-14 collaboration: layers over a real buildGraph projection stay
 * monotone along forward edges, and the phased graph-dump -> layout-dump
 * harness roundtrip reproduces the in-process layout byte for byte.
 *
 * Fixtures are pure payloads under the OS temp dir (never inside the repo).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { computeLayout, ARC_LIFT, LAYER_GAP, NODE_HEIGHT, NODE_WIDTH, ROW_GAP } from '../../desktop/ui/graph/layout.js';
import { buildGraph } from '../../src/daemon/graph.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** AC-17 fixture: pure graph data, four nodes, one backflow. */
function ac17Graph({ bAbnormal = false } = {}) {
  return {
    rev: 3,
    nodes: [
      { id: 'A', type: 'role', abnormal: false },
      { id: 'B', type: 'role', abnormal: bAbnormal },
      { id: 'C', type: 'role', abnormal: false },
      { id: 'D', type: 'role', abnormal: false },
    ],
    edges: [
      { id: 'E-01', from: 'A', to: 'B', direction: 'forward' },
      { id: 'E-02', from: 'A', to: 'C', direction: 'forward' },
      { id: 'E-03', from: 'B', to: 'D', direction: 'forward' },
      { id: 'E-04', from: 'D', to: 'B', direction: 'backflow' },
      { id: 'E-05', from: 'C', to: 'D', direction: 'forward' },
    ],
  };
}

function layoutOf(graph) {
  return computeLayout(graph);
}

test('AC-17: layer numbers A=0 B=1 C=1 D=2 on the anchor fixture', () => {
  const layout = layoutOf(ac17Graph());
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.equal(byId.get('A').layer, 0);
  assert.equal(byId.get('B').layer, 1);
  assert.equal(byId.get('C').layer, 1);
  assert.equal(byId.get('D').layer, 2);
});

test('AC-17: x follows the layer, same-layer y differs, constants hold', () => {
  const layout = layoutOf(ac17Graph());
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.equal(byId.get('A').x, 0);
  assert.equal(byId.get('B').x, 240);
  assert.equal(byId.get('C').x, 240);
  assert.equal(byId.get('D').x, 480);
  assert.notEqual(byId.get('B').y, byId.get('C').y);
  assert.equal(byId.get('B').y, 0);
  assert.equal(byId.get('C').y, ROW_GAP);
  for (const node of layout.nodes) {
    assert.equal(node.width, NODE_WIDTH);
    assert.equal(node.height, NODE_HEIGHT);
    assert.equal(node.x, node.layer * LAYER_GAP);
    assert.equal(node.y, (node.y / ROW_GAP) * ROW_GAP); // row grid alignment
  }
});

test('AC-17: the backflow keeps its layer and renders as an arc', () => {
  const layout = layoutOf(ac17Graph());
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.equal(byId.get('B').layer, 1); // D->B never pushes B deeper
  const backflow = layout.edges.find((edge) => edge.id === 'E-04');
  assert.equal(backflow.path.kind, 'arc');
  const from = byId.get('D');
  const to = byId.get('B');
  const midX = (from.x + to.x + NODE_WIDTH) / 2;
  const midY = (from.y + to.y + NODE_HEIGHT) / 2;
  assert.equal(backflow.path.ctrl.x, midX);
  assert.equal(backflow.path.ctrl.y, midY - ARC_LIFT);
  for (const id of ['E-01', 'E-02', 'E-03', 'E-05']) {
    assert.equal(layout.edges.find((edge) => edge.id === id).path.kind, 'straight');
  }
});

test('AC-17: two consecutive layouts are byte-equal', () => {
  const graph = ac17Graph();
  const first = layoutOf(graph);
  const second = layoutOf(graph);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(graph), JSON.stringify(ac17Graph())); // inputs untouched
});

test('AC-18: escalation lifts only z; coordinates and sizes are unchanged', () => {
  const normal = layoutOf(ac17Graph());
  const escalated = layoutOf(ac17Graph({ bAbnormal: true }));
  const normalById = new Map(normal.nodes.map((node) => [node.id, node]));
  const escalatedById = new Map(escalated.nodes.map((node) => [node.id, node]));

  const geometryDiff = [];
  const zDiff = {};
  for (const [id, base] of normalById) {
    const other = escalatedById.get(id);
    for (const key of ['x', 'y', 'width', 'height']) {
      if (base[key] !== other[key]) geometryDiff.push(`${id}.${key}`);
    }
    if (base.z !== other.z) zDiff[id] = other.z - base.z;
  }
  assert.deepEqual(geometryDiff, []); // coordinate and size diff set is empty
  assert.deepEqual(zDiff, { B: 1 }); // z diff set is exactly {B: 1}

  // Edges connected to B lift with it; the others stay at 0.
  const normalEdges = new Map(normal.edges.map((edge) => [edge.id, edge]));
  for (const edge of escalated.edges) {
    const base = normalEdges.get(edge.id);
    const touchesB = edge.id === 'E-01' || edge.id === 'E-03' || edge.id === 'E-04';
    assert.equal(edge.z, touchesB ? 1 : 0, `edge ${edge.id} z`);
    assert.deepEqual(edge.path, base.path); // arc geometry untouched
  }
});

test('AC-18: clearing the abnormality restores z 0 and the same coordinates', () => {
  const normal = layoutOf(ac17Graph());
  const escalated = layoutOf(ac17Graph({ bAbnormal: true }));
  const restored = layoutOf(ac17Graph({ bAbnormal: false }));
  assert.equal(JSON.stringify(normal), JSON.stringify(restored));
  assert.notEqual(JSON.stringify(normal), JSON.stringify(escalated));
});

test('AC-14 collaboration: forward edges are strictly layered on a real projection', () => {
  const def = {
    id: 'layout-flow',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'alpha', order: 0 },
      { id: 'T-002', node_type: 'role', role: 'beta', order: 1 },
      { id: 'H-001', node_type: 'human', order: 2, title: '人工验收' },
      { id: 'T-003', node_type: 'role', role: 'gamma', order: 3 },
    ],
    edges: [
      { from: 'T-001', to: 'T-002' },
      { from: 'T-002', to: 'H-001' },
      { from: 'H-001', to: 'T-003' },
      { from: 'T-003', to: 'T-001', kind: 'backflow' },
    ],
  };
  const graph = buildGraph({
    state: {
      schemaVersion: 2,
      instanceId: 'INST-L',
      template: 'layout-flow',
      state: 'running',
      workflowRef: 'layout-flow',
      updatedAt: '2026-01-01T00:00:00.000Z',
      nodes: [
        { nodeId: 'T-001', roleId: 'alpha', state: 'done', round: 1 },
        { nodeId: 'T-002', roleId: 'beta', state: 'running', round: 1 },
        { nodeId: 'T-003', roleId: 'gamma', state: 'pending', round: 0 },
      ],
      sessions: [],
      handoffs: [],
      escalations: [],
    },
    workflowDef: def,
    roles: {},
    traces: [],
    events: [],
  });
  const layout = layoutOf(graph);
  assert.equal(layout.nodes.length, 4);
  const layerById = new Map(layout.nodes.map((node) => [node.id, node.layer]));
  for (const edge of graph.edges) {
    if (edge.direction === 'forward') {
      assert.ok(layerById.get(edge.to) > layerById.get(edge.from), `forward ${edge.id} layers`);
    } else {
      assert.ok(layerById.get(edge.to) <= layerById.get(edge.from), `backflow ${edge.id} layers`);
    }
  }
});

test('harness roundtrip: layout-dump.mjs reproduces the in-process layout', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-layout-'));
  const graphFile = path.join(dir, 'graph.json');
  const outFile = path.join(dir, 'layout.json');
  fs.writeFileSync(graphFile, JSON.stringify(ac17Graph()), 'utf8');

  const result = spawnSync(
    process.execPath,
    [path.join(REPO, 'desktop', 'harness', 'layout-dump.mjs'), '--payload', graphFile, '--out', outFile],
    { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } },
  );
  assert.equal(result.status, 0, result.stderr);
  const dumped = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  assert.deepEqual(dumped.nodes, layoutOf(ac17Graph()).nodes);
  assert.deepEqual(dumped.edges, layoutOf(ac17Graph()).edges);
  fs.rmSync(dir, { recursive: true, force: true });
});
