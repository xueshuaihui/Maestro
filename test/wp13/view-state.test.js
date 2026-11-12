/**
 * View state contract tests (I1.10a WP-5).
 *
 * AC-20 anchor: zoom to 150% turns a 180-wide node into 270 screen pixels
 * with the layout coordinates untouched; reset restores 100% / (0,0) / no
 * drag offsets; 10% clamps to 50% and 300% clamps to 200%. The screen
 * transform is invertible over zoom and pan.
 *
 * AC-22 anchor: a drag of (+40, +60) on node B persists as
 * `.orch/desktop/views/INST-001.json` shaped `{ offsets, updatedAt }`;
 * reopening the instance re-derives base + (40, 60); a second instance is
 * unaffected; the byte hashes of `state.json` and `events.jsonl` are equal
 * before and after. The pure view module never touches the filesystem — the
 * fixture writes the preferences file directly (shell/harness layer).
 *
 * Fixture roots live under the OS temp dir, never inside the repository.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { createViewState, ZOOM_MAX, ZOOM_MIN } from '../../desktop/ui/graph/view.js';

const BASE_NODE = { id: 'B', x: 240, y: 0, width: 180, height: 80 };

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function makeInstance(root, instanceId) {
  const dir = path.join(root, '.orch', 'instances', instanceId);
  fs.mkdirSync(dir, { recursive: true });
  const state = path.join(dir, 'state.json');
  const events = path.join(dir, 'events.jsonl');
  fs.writeFileSync(
    state,
    JSON.stringify({ schemaVersion: 2, instanceId, state: 'running', nodes: [] }, null, 2),
    'utf8',
  );
  fs.writeFileSync(events, '{"seq":1,"object":"node","reason":"state.change"}\n', 'utf8');
  return { state, events };
}

test('AC-20: 150% zoom renders 270 screen pixels and leaves layout coordinates alone', () => {
  const view = createViewState();
  assert.equal(view.getZoom(), 1);
  view.setZoom(1.5);
  view.setPan(120, -40);
  const screen = view.screen(BASE_NODE);
  assert.equal(screen.width, 270); // 180 * 1.5
  assert.equal(screen.height, 120); // 80 * 1.5
  assert.equal(screen.x, 240 * 1.5 + 120);
  assert.equal(screen.y, 0 * 1.5 - 40);
  // The transform never rewrites the layout node.
  assert.deepEqual(BASE_NODE, { id: 'B', x: 240, y: 0, width: 180, height: 80 });
});

test('AC-20: the zoom/pan combination is invertible', () => {
  const view = createViewState();
  view.setZoom(1.5);
  view.setPan(120, -40);
  const screen = view.screen(BASE_NODE);
  const recoveredX = (screen.x - view.getPan().x) / view.getZoom();
  const recoveredY = (screen.y - view.getPan().y) / view.getZoom();
  assert.equal(recoveredX, BASE_NODE.x);
  assert.equal(recoveredY, BASE_NODE.y);
});

test('AC-20: reset restores 100% / origin / cleared drag offsets', () => {
  const view = createViewState();
  view.setZoom(1.5);
  view.setPan(120, -40);
  view.applyOffsets({ B: { dx: 40, dy: 60 } });
  view.focus('B');
  view.reset();
  assert.equal(view.getZoom(), 1);
  assert.deepEqual(view.getPan(), { x: 0, y: 0 });
  assert.deepEqual(view.getOffsets(), {});
  assert.equal(view.getFocus(), null);
  const screen = view.screen(BASE_NODE);
  assert.deepEqual(screen, { x: 240, y: 0, width: 180, height: 80 });
});

test('AC-20: zoom clamps to the [0.5, 2.0] window', () => {
  const view = createViewState();
  assert.equal(view.setZoom(0.1), ZOOM_MIN); // 10% clamps to 50%
  assert.equal(view.getZoom(), 0.5);
  assert.equal(view.setZoom(3.0), ZOOM_MAX); // 300% clamps to 200%
  assert.equal(view.getZoom(), 2.0);
  assert.equal(view.setZoom(1.25), 1.25);
});

test('AC-22: drag offsets persist per instance, reopen restores, hashes hold', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10a-drag-'));
  const first = makeInstance(root, 'INST-001');
  const second = makeInstance(root, 'INST-002');

  const hashBefore = { state: sha256(first.state), events: sha256(first.events) };

  // Drag B by (+40, +60): the view state holds the offsets as plain data.
  const dragging = createViewState();
  dragging.applyOffsets({ B: { dx: 40, dy: 60 } });
  const viewsDir = path.join(root, '.orch', 'desktop', 'views');
  fs.mkdirSync(viewsDir, { recursive: true });
  const viewsFile = path.join(viewsDir, 'INST-001.json');
  const preferences = {
    offsets: dragging.getOffsets(),
    updatedAt: '2026-11-12T09:05:00.000Z', // caller-owned timestamp; the module stays pure
  };
  fs.writeFileSync(viewsFile, JSON.stringify(preferences, null, 2), 'utf8');
  assert.deepEqual(preferences, { offsets: { B: { dx: 40, dy: 60 } }, updatedAt: '2026-11-12T09:05:00.000Z' });

  // Reopen INST-001: replay the file into a fresh view state.
  const reopened = createViewState();
  reopened.applyOffsets(JSON.parse(fs.readFileSync(viewsFile, 'utf8')).offsets);
  const screen = reopened.screen(BASE_NODE);
  assert.equal(screen.x, BASE_NODE.x + 40); // base + (40, 60)
  assert.equal(screen.y, BASE_NODE.y + 60);

  // Another instance stays untouched: no views file exists for it, so a
  // fresh view state replays nothing and the transform stays identity.
  assert.equal(fs.existsSync(path.join(viewsDir, 'INST-002.json')), false);
  const other = createViewState();
  assert.deepEqual(other.screen(BASE_NODE), { x: 240, y: 0, width: 180, height: 80 });

  // Instance state files were never written: byte hashes equal before/after.
  assert.equal(sha256(first.state), hashBefore.state);
  assert.equal(sha256(first.events), hashBefore.events);
  fs.rmSync(root, { recursive: true, force: true });
});

test('AC-22: reset clears drag offsets and clearOffsets targets the whole map', () => {
  const view = createViewState();
  view.applyOffsets({ A: { dx: 1, dy: 2 }, B: { dx: 40, dy: 60 } });
  assert.deepEqual(view.getOffsets(), { A: { dx: 1, dy: 2 }, B: { dx: 40, dy: 60 } });
  view.clearOffsets();
  assert.deepEqual(view.getOffsets(), {});
  view.reset();
  assert.deepEqual(view.getOffsets(), {});
});
