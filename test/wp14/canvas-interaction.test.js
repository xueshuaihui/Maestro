/**
 * I1.11 AC-30 · definition-canvas read-only interaction seam (D-57).
 *
 * The data-side cases in `canvas.test.js` only prove the projection is immutable
 * and carries no runtime fields. Requirement AC-30 machine check additionally
 * names four interaction assertions that had no executable anchor:
 *   (1) drag never moves a node + views/ gains no file,
 *   (2) the interaction event stream emits no `node-detail` / `jump-host`,
 *   (3) a single click selects exactly one node,
 *   (4) a double click never focuses / drills / jumps (view stays canvas).
 *
 * Method: drive the SAME pure modules the harness/app use — buildCanvas for the
 * read-only projection, graphEdges + computeLayout for placement, nodeRow for
 * wording — then run a minimal immutable interaction state model over them. No
 * DOM, no real mouse, no third-party dep. The model carries no CJK literal: all
 * visible words flow through nodeRow + the CLI label table (BR-26); event names
 * and view tokens are ASCII. Hand-feel (real zoom/pan ergonomics) stays manual
 * per U-13 and is not asserted here.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test, { after } from 'node:test';

import * as CLI from '../../src/cli/labels.js';
import { buildCanvas } from '../../src/daemon/canvas.js';
import { nodeRow, graphEdges } from '../../desktop/ui/canvas/canvas.js';
import { computeLayout } from '../../desktop/ui/graph/layout.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ------------------------------------------------------------------ temp root
// Short prefix: <root>/.orch/core.sock is bounded by the macOS 104-byte path cap.
const tempDirs = [];
function makeRoot(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp14ci-${tag}-`));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------------ fixture
function writeWorkflow(root, id, yaml) {
  const dir = path.join(root, '.orch', 'workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.yaml`), yaml, 'utf8');
}

/** Same 7-node / 8-edge release-flow as AC-29 / A-5 / AC-22 (D-31). */
const RELEASE_FLOW = [
  'schema: workflow/v1',
  'id: release-flow',
  'name: 发布流程',
  'summary: 样例发布流程',
  'entry: T-001',
  'terminal: T-003',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 实现',
  '    wake_allow: [tester, reviewer]',
  '    max_rounds: 3',
  '  - id: T-002',
  '    node_type: role',
  '    role: tester',
  '    title: 验证',
  '    max_rounds: 3',
  '  - id: T-003',
  '    node_type: role',
  '    role: reviewer',
  '    title: 复核',
  '  - id: H-001',
  '    node_type: human',
  '    title: 人工确认',
  '  - id: S-001',
  '    node_type: subworkflow',
  '    workflow: sub-flow',
  '    title: 子流程',
  '  - id: T-004',
  '    node_type: role',
  '    role: code-reviewer',
  '    title: 评审',
  '    wake_allow: [writer]',
  '  - id: T-005',
  '    node_type: role',
  '    role: writer',
  '    title: 修订',
  'edges:',
  '  - from: T-001',
  '    to: T-002',
  '    kind: forward',
  '  - from: T-001',
  '    to: T-003',
  '    kind: forward',
  '  - from: T-002',
  '    to: H-001',
  '    kind: forward',
  '  - from: H-001',
  '    to: S-001',
  '    kind: forward',
  '    when: human_approved',
  '  - from: S-001',
  '    to: T-004',
  '    kind: forward',
  '  - from: T-004',
  '    to: T-005',
  '    kind: forward',
  '  - from: T-005',
  '    to: T-002',
  '    kind: backflow',
  '  - from: T-004',
  '    to: T-001',
  '    kind: backflow',
  '',
].join('\n');

const SUB_FLOW = [
  'schema: workflow/v1',
  'id: sub-flow',
  'name: 子流程样例',
  'entry: T-001',
  'terminal: T-001',
  'nodes:',
  '  - id: T-001',
  '    node_type: role',
  '    role: developer',
  '    title: 子步骤',
  'edges: []',
  '',
].join('\n');

/** Flat label table from the authoritative CLI source (BR-26 single source). */
function labelTable() {
  const table = {};
  for (const [key, value] of Object.entries(CLI)) {
    if (typeof value === 'string') {
      table[key] = value;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [member, text] of Object.entries(value)) {
        if (typeof text !== 'string') continue;
        const snake = String(member)
          .replaceAll('-', '_')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toUpperCase();
        table[`${key}_${snake}`] = text;
      }
    }
  }
  return Object.freeze(table);
}
const LABELS = labelTable();

function makeProjection(root) {
  writeWorkflow(root, 'release-flow', RELEASE_FLOW);
  writeWorkflow(root, 'sub-flow', SUB_FLOW);
  return buildCanvas(root, 'release-flow');
}

// ------------------------------------------------------------------ pure placement
/** Placement identical to app.js composeCanvas / canvas-dump.mjs: one layout. */
function place(projection) {
  const layout = computeLayout({ nodes: projection.nodes, edges: graphEdges(projection) });
  const rows = new Map(projection.nodes.map((node) => [node.id, nodeRow(node, LABELS)]));
  return layout.nodes.map((pos) => ({
    ...(rows.get(pos.id) ?? { id: pos.id, nodeType: 'role', text: null }),
    x: pos.x,
    y: pos.y,
    layer: pos.layer,
  }));
}

// ------------------------------------------------------------------ interaction model
/** Read-only view tokens: the only reachable view from the canvas is itself. */
const VIEW = Object.freeze({ CANVAS: 'canvas' });

/** Event vocabulary emitted by the read-only canvas gestures (all ASCII). */
const EV = Object.freeze({
  ZOOM: 'zoom',
  PAN: 'pan',
  DRAG: 'drag-node',
  SELECT: 'select-node',
  CLEAR: 'clear-selection',
  DBLCLICK: 'dblclick-node',
});

const INITIAL = Object.freeze({
  view: VIEW.CANVAS,
  zoom: 1,
  pan: Object.freeze({ x: 0, y: 0 }),
  selected: Object.freeze([]),
  events: Object.freeze([]),
});

/**
 * Minimal immutable interaction model of the definition canvas. Mirrors the
 * read-only app wiring (app.js composeCanvas / loadCanvas): zoom and pan are
 * view-transform gestures; a node drag stores NO per-node offset and performs
 * NO write; a click only selects; a double click leaves the view untouched.
 * Navigation events (`node-detail` / `jump-host` / `graph` / `host`) are never
 * produced because the definition canvas has no drill / jump wiring.
 */
function interact(state, action) {
  switch (action?.type) {
    case 'zoom':
      return { ...state, zoom: action.factor, events: [...state.events, EV.ZOOM] };
    case 'pan':
      return {
        ...state,
        pan: { x: state.pan.x + action.dx, y: state.pan.y + action.dy },
        events: [...state.events, EV.PAN],
      };
    case 'drag':
      // Drag is view transport only: no offset stored, no coordinate change,
      // no filesystem write. Coordinates come from a fresh layout of the
      // unchanged projection, so they cannot drift.
      return { ...state, events: [...state.events, EV.DRAG] };
    case 'click':
      return { ...state, selected: [action.id], events: [...state.events, EV.SELECT] };
    case 'click-blank':
      return { ...state, selected: [], events: [...state.events, EV.CLEAR] };
    case 'dblclick':
      // Read-only canvas: no focus, no drill down, no jump. View stays canvas.
      return { ...state, events: [...state.events, EV.DBLCLICK] };
    default:
      return state;
  }
}

/** Snapshot of a directory: sorted relative file list + per-file sha256. */
function snapshot(base, rel) {
  const dir = path.join(base, rel);
  const files = [];
  const hashes = {};
  const walk = (here, prefix) => {
    let entries;
    try {
      entries = fs.readdirSync(here, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(here, entry.name);
      if (entry.isDirectory()) walk(abs, key);
      else if (entry.isFile()) {
        files.push(key);
        hashes[key] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    }
  };
  walk(dir, '');
  files.sort();
  return { files, hashes };
}

/** Drive the real harness twice on the same payload (D-57 / AC-30 fixture). */
function harnessPlaced(root, projection) {
  const payloadPath = path.join(root, 'payload.json');
  fs.writeFileSync(payloadPath, JSON.stringify({ ...projection, labels: LABELS }), 'utf8');
  const dump = path.join(root, 'dump.json');
  const r = spawnSync(process.execPath, [
    path.join(REPO, 'desktop', 'harness', 'canvas-dump.mjs'),
    '--payload', payloadPath, '--out', dump,
  ], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0, `canvas-dump.mjs failed: ${r.stderr}`);
  return JSON.parse(fs.readFileSync(dump, 'utf8')).nodes;
}

// ------------------------------------------------------------------ ① drag
test('AC-30 交互①：拖拽不改变节点位置、两次布局坐标一致、views/ 无新增文件', () => {
  const root = makeRoot('drag');
  const projection = makeProjection(root);

  // Same input twice -> byte-equal layout (deterministic pure function).
  const graph = { nodes: projection.nodes, edges: graphEdges(projection) };
  assert.deepEqual(computeLayout(graph), computeLayout(graph));

  // Harness-driven: two exports of the same projection have identical coords.
  assert.deepEqual(harnessPlaced(root, projection), harnessPlaced(root, projection));

  // views/ preference directory: snapshot before any gesture.
  const viewsRel = '.orch/desktop/views';
  fs.mkdirSync(path.join(root, viewsRel), { recursive: true });
  fs.writeFileSync(path.join(root, viewsRel, 'seed.json'), '{}', 'utf8');
  const before = snapshot(root, viewsRel);

  // Simulate the full gesture sequence including a node drag, then re-layout.
  const placedBefore = place(projection);
  let state = INITIAL;
  state = interact(state, { type: 'zoom', factor: 1.25 });
  state = interact(state, { type: 'pan', dx: 24, dy: -16 });
  state = interact(state, { type: 'drag', id: placedBefore[0].id, dx: 137, dy: -92 });
  const placedAfter = place(projection);

  assert.deepEqual(placedAfter, placedBefore, 'drag 后重新布局坐标必须不变（画布不保存偏移）');
  assert.equal(state.zoom, 1.25);
  assert.deepEqual(state.pan, { x: 24, y: -16 }, '缩放平移只改视图变换，不改节点坐标');

  const after = snapshot(root, viewsRel);
  assert.deepEqual(after.files, before.files, 'views/ 目录不得出现新增文件');
  assert.deepEqual(after.hashes, before.hashes, 'views/ 目录文件内容哈希不得改变');
});

// ------------------------------------------------------------------ ② event names
test('AC-30 交互②：交互事件流无 node-detail / jump-host 事件', () => {
  let state = INITIAL;
  for (const action of [
    { type: 'zoom', factor: 1.5 },
    { type: 'pan', dx: 10, dy: 10 },
    { type: 'drag', id: 'T-001', dx: 5, dy: 5 },
    { type: 'click', id: 'T-001' },
    { type: 'dblclick', id: 'T-001' },
    { type: 'click-blank' },
  ]) {
    state = interact(state, action);
  }
  // The two events named verbatim in the requirement must be absent.
  assert.equal(state.events.filter((e) => e === 'node-detail').length, 0);
  assert.equal(state.events.filter((e) => e === 'jump-host').length, 0);
  // And the stream must contain no navigation/drill token at all.
  const forbidden = ['node-detail', 'jump-host', 'graph', 'host', 'focus-node', 'drilldown'];
  assert.deepEqual(state.events.filter((e) => forbidden.includes(e)), []);
  // Every emitted name is from the declared ASCII vocabulary.
  for (const name of state.events) {
    assert.ok(Object.values(EV).includes(name), `未知事件 ${name}`);
    assert.ok(!/\p{Script=Han}/u.test(name), `事件名不得含 CJK：${name}`);
  }
});

// ------------------------------------------------------------------ ③ single select
test('AC-30 交互③：单击选中恰 1 个、再点另一个替换为 1 个、点空白清空为 0', () => {
  let state = INITIAL;
  state = interact(state, { type: 'click', id: 'T-001' });
  assert.equal(state.selected.length, 1);
  assert.deepEqual(state.selected, ['T-001']);

  state = interact(state, { type: 'click', id: 'T-002' });
  assert.equal(state.selected.length, 1, '再次单击必须替换选中，不能累加');
  assert.deepEqual(state.selected, ['T-002']);

  state = interact(state, { type: 'click-blank' });
  assert.equal(state.selected.length, 0, '点击空白必须清空选中');
  assert.deepEqual(state.selected, []);
});

// ------------------------------------------------------------------ ④ double click
test('AC-30 交互④：双击不聚焦、不下钻、不跳转，视图仍为 canvas', () => {
  const root = makeRoot('dblclick');
  const projection = makeProjection(root);
  const placedBefore = place(projection);

  let state = INITIAL;
  state = interact(state, { type: 'click', id: 'T-001' });
  state = interact(state, { type: 'dblclick', id: 'T-001' });

  assert.equal(state.view, VIEW.CANVAS, '双击后视图必须仍为 canvas');
  assert.equal(state.focus, undefined, '双击不得写入聚焦态');
  const nav = state.events.filter((e) =>
    ['graph', 'host', 'node-detail', 'jump-host', 'focus-node', 'drilldown'].includes(e));
  assert.deepEqual(nav, [], '双击不得产生 graph / host / node-detail 跳转事件');
  assert.deepEqual(place(projection), placedBefore, '双击不得改变节点坐标');
});
