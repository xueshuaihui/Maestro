/**
 * v2 workflow canvas: visible progress + editable Studio flow.
 *
 * Grounded at three seams:
 * 1. `canvasEdgePath` turns the frozen layout shape into a real SVG `d`
 *    string (the old canvas passed an object straight to setAttribute).
 * 2. `buildCanvas` projects a Studio flow with its latest run status.
 * 3. Flow edit domain functions mutate through one validation gate; invalid
 *    graphs are refused before the caller persists anything.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { canvasEdgePath } from '../../desktop/ui/canvas/canvas.js';
import { buildCanvas, studioCanvas } from '../../src/daemon/canvas.js';
import { STUDIO_TEXT } from '../../src/cli/labels.js';
import {
  emptyStudio,
  addStage,
  updateStage,
  removeStage,
  addFlowEdge,
  removeFlowEdge,
  updateFlow,
  validateFlow,
} from '../../src/studio/index.js';

const dirs = [];
function root(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp18-${tag}-`));
  dirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});

function writeStudio(where, doc) {
  fs.mkdirSync(path.join(where, '.orch'), { recursive: true });
  fs.writeFileSync(path.join(where, '.orch', 'studio.json'), JSON.stringify(doc), 'utf8');
}

function fixture() {
  const doc = emptyStudio();
  doc.flows.push({
    id: 'demo-flow',
    name: '演示流程',
    kind: 'custom',
    runMode: 'semi',
    gates: [],
    stages: [
      { id: 's01', name: '第一步', titleKey: null, roleCodes: ['eng-lead'], parallel: false, gate: null, artifacts: [] },
      { id: 's02', name: '第二步', titleKey: null, roleCodes: ['qa-lead'], parallel: false, gate: null, artifacts: [] },
    ],
    edges: [{ from: 's01', to: 's02' }],
  });
  doc.runs.push({
    id: 'RUN-1',
    flowId: 'demo-flow',
    status: 'running',
    stages: [
      { stageId: 's01', status: 'done' },
      { stageId: 's02', status: 'running' },
    ],
  });
  return doc;
}

// ------------------------------------------------------------------ rendering

test('canvasEdgePath renders straight and arc paths as SVG strings', () => {
  const placed = [
    { id: 'a', x: 0, y: 0, width: 180, height: 80 },
    { id: 'b', x: 240, y: 140, width: 180, height: 80 },
  ];
  const straight = canvasEdgePath({ from: 'a', to: 'b', path: { kind: 'straight' } }, placed);
  assert.equal(straight.d, 'M 90 40 L 330 180');
  assert.deepEqual(straight.mid, { x: 210, y: 110 });

  const arc = canvasEdgePath({
    from: 'b', to: 'a', path: { kind: 'arc', ctrl: { x: 210, y: 70 } },
  }, placed);
  assert.equal(arc.d, 'M 330 180 Q 210 70 90 40');

  assert.deepEqual(canvasEdgePath({ from: 'a', to: 'ghost' }, placed), {
    d: '', mid: { x: 0, y: 0 },
  });
});

// ------------------------------------------------------------------ projection

test('Studio canvas shows named stages, status and progress', () => {
  const where = root('studio');
  writeStudio(where, fixture());
  const view = buildCanvas(where, 'demo-flow');
  assert.equal(view.source, 'studio');
  assert.equal(view.editable, true);
  assert.deepEqual(view.progress, { done: 1, total: 2 });
  assert.equal(view.runId, 'RUN-1');
  assert.deepEqual(view.nodes.map((node) => node.label), ['第一步', '第二步']);
  assert.deepEqual(view.nodes.map((node) => node.statusKey), ['STAGE_DONE', 'STAGE_RUNNING']);
  assert.deepEqual(view.nodes.map((node) => node.status), [STUDIO_TEXT.STAGE_DONE, STUDIO_TEXT.STAGE_RUNNING]);
  assert.deepEqual(view.nodes.map((node) => node.progress), [100, 0]);
  assert.deepEqual(view.edges, [{ from: 's01', to: 's02', kind: 'forward' }]);
  assert.equal(studioCanvas(where, 'missing'), null);
});

test('a missing Studio flow still falls through to the frozen builtin projection', () => {
  const where = root('fallback');
  writeStudio(where, fixture());
  const view = buildCanvas(where, 'task-loop');
  assert.equal(view.source, undefined);
  assert.equal(view.editable, undefined);
  assert.equal(view.nodes.length, 3);
});

// ------------------------------------------------------------------ editing

test('stage and edge edits persist through one validated gate', () => {
  const doc = fixture();
  const added = addStage(doc, 'demo-flow', { name: '第三步' });
  assert.equal(added.ok, true);
  assert.equal(added.stage.id, 's03');
  assert.equal(doc.flows[0].stages.length, 3);

  const renamed = updateStage(doc, 'demo-flow', 's03', { name: '复核' });
  assert.equal(renamed.ok, true);
  assert.equal(doc.flows[0].stages[2].name, '复核');
  assert.equal(doc.flows[0].stages[2].titleKey, null);

  const linked = addFlowEdge(doc, 'demo-flow', 's02', 's03');
  assert.equal(linked.ok, true);
  assert.equal(doc.flows[0].edges.length, 2);

  const duplicate = addFlowEdge(doc, 'demo-flow', 's02', 's03');
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.code, 'STUDIO_FLOW_EDGE_EXISTS');
  assert.equal(doc.flows[0].edges.length, 2);

  const cycle = addFlowEdge(doc, 'demo-flow', 's03', 's01');
  assert.equal(cycle.ok, false);
  assert.equal(cycle.code, 'STUDIO_FLOW_INVALID');

  const unlinked = removeFlowEdge(doc, 'demo-flow', 's02', 's03');
  assert.equal(unlinked.ok, true);
  assert.equal(doc.flows[0].edges.length, 1);

  const removed = removeStage(doc, 'demo-flow', 's03');
  assert.equal(removed.ok, true);
  assert.equal(doc.flows[0].stages.length, 2);
  assert.equal(validateFlow(doc.flows[0]).ok, true);

  const renamedFlow = updateFlow(doc, 'demo-flow', { name: '新名字' });
  assert.equal(renamedFlow.ok, true);
  assert.equal(doc.flows[0].name, '新名字');
});

test('rejected edits leave the document byte-equal', () => {
  const doc = fixture();
  const before = JSON.stringify(doc);
  assert.equal(addStage(doc, 'unknown', { name: 'x' }).ok, false);
  assert.equal(updateStage(doc, 'demo-flow', 'ghost', { name: 'x' }).ok, false);
  assert.equal(addFlowEdge(doc, 'demo-flow', 's01', 's01').ok, false);
  assert.equal(removeFlowEdge(doc, 'demo-flow', 'ghost', 's01').ok, false);
  assert.equal(JSON.stringify(doc), before);
});
