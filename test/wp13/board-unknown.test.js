/**
 * Board unknown-state contract tests (I1.10a WP-5).
 *
 * AC-35 anchor: an instance with three snapshot nodes — running, done, and
 * one historical value outside the nine-state mapping (`mystery`). The board
 * keeps all seven columns; the running and done cards land in their columns;
 * the unknown card falls into blocked carrying the frozen `状态未知` tag;
 * three cards are shown (nothing dropped, no exception); switching back to
 * the graph view leaves the view-state object unchanged. The projection runs
 * through `desktop/harness/board-dump.mjs` (the anchor's fixture path), plus
 * an in-process case for the explicit default branch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { projectBoard } from '../../desktop/ui/board/board.js';
import { createViewState } from '../../desktop/ui/graph/view.js';
import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

function ac35Payload() {
  return {
    state: {
      schemaVersion: 2,
      instanceId: 'INST-X',
      nodes: [
        { nodeId: 'R-001', state: 'running', round: 1 },
        { nodeId: 'D-001', state: 'done', round: 1 },
        { nodeId: 'M-001', status: 'mystery' }, // outside the nine-state mapping
      ],
    },
    graph: {
      rev: 1,
      nodes: [
        { id: 'R-001', type: 'role', title: '执行中' },
        { id: 'D-001', type: 'role', title: '已完成' },
        { id: 'M-001', type: 'role', title: '历史节点' },
      ],
      edges: [],
    },
  };
}

test('AC-35 (harness): the unknown card lands in blocked tagged with the frozen text', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-board-x-'));
  const payloadFile = path.join(dir, 'board.json');
  const labelsFile = path.join(dir, 'labels.json');
  const outFile = path.join(dir, 'board-out.json');
  fs.writeFileSync(payloadFile, JSON.stringify(ac35Payload()), 'utf8');
  // The harness no longer imports the daemon key table (B-12): feed it the
  // `GET /ui/labels` body shape through --labels.
  fs.writeFileSync(labelsFile, JSON.stringify({ keys: DESKTOP_LABEL_KEYS }), 'utf8');

  const result = spawnSync(
    process.execPath,
    [
      path.join(REPO, 'desktop', 'harness', 'board-dump.mjs'),
      '--payload',
      payloadFile,
      '--labels',
      labelsFile,
      '--out',
      outFile,
    ],
    { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'test' } },
  );
  assert.equal(result.status, 0, result.stderr);
  const board = JSON.parse(fs.readFileSync(outFile, 'utf8'));

  assert.equal(board.columns.length, 7); // all seven columns render as usual
  assert.deepEqual(board.columnNames, ['被阻塞', '可调度', '执行中', '待校验', '已完成', '失败', '已升级']);

  assert.equal(board.cards.length, 3); // no card dropped
  const byId = new Map(board.cards.map((card) => [card.id, card]));
  assert.equal(byId.get('R-001').column, 'running');
  assert.equal(byId.get('D-001').column, 'done');
  const unknown = byId.get('M-001');
  assert.equal(unknown.column, 'blocked');
  assert.equal(unknown.unknown, true);
  assert.ok(String(unknown.unknownTag ?? board.unknownTag).includes('状态未知'));
  assert.equal(board.unknownTag, DESKTOP_LABEL_KEYS.DESKTOP_BOARD_UNKNOWN_STATE);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('AC-35 (in-process): the explicit default branch never throws on any alien value', () => {
  const payload = ac35Payload();
  payload.state.nodes[2].state = 'mystery'; // also present via `state`
  const board = projectBoard({ ...payload, labels: DESKTOP_LABEL_KEYS });
  const unknown = board.cards.find((card) => card.id === 'M-001');
  assert.equal(unknown.column, 'blocked');
  assert.equal(unknown.unknown, true);
  assert.equal(unknown.state, 'mystery');
  assert.equal(board.unknownCount, 1);
  assert.deepEqual(board.columns, ['blocked', 'ready', 'running', 'review', 'done', 'failed', 'escalated']);
});

test('AC-35: switching back to the graph view keeps the view-state object unchanged', () => {
  const payload = ac35Payload();
  const view = createViewState({ nodes: payload.graph.nodes, edges: payload.graph.edges });
  view.setZoom(0.75);
  view.setPan(-30, 15);
  view.applyOffsets({ 'D-001': { dx: 5, dy: 5 } });
  view.focus('R-001');
  const before = {
    zoom: view.getZoom(),
    pan: view.getPan(),
    offsets: view.getOffsets(),
    focus: view.getFocus(),
    visible: view.visibleNodeIds(),
    edges: view.visibleEdges().map((edge) => edge.id),
  };
  projectBoard({ ...payload, labels: DESKTOP_LABEL_KEYS });
  assert.deepEqual(
    {
      zoom: view.getZoom(),
      pan: view.getPan(),
      offsets: view.getOffsets(),
      focus: view.getFocus(),
      visible: view.visibleNodeIds(),
      edges: view.visibleEdges().map((edge) => edge.id),
    },
    before,
  );
});
