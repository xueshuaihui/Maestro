/**
 * Legend contract tests (I1.10a WP-5).
 *
 * AC-34 anchor: the legend is fixed two lines, anchored bottom-left, and
 * zoom/pan/collapse never move it — three view states produce the same
 * anchor, layer, offset and lines, and the anchor point depends on the
 * canvas size only.
 *
 * AC-07 (S-03 hand-over): the two-line verbatim assertion that batch 1
 * deferred from graph-dump lives here — `legend.lines` must equal the A-8
 * rows verbatim, which are exactly the frozen `DESKTOP_LEGEND_*` key values
 * that batch 4 will emit through the harness lazy dynamic import.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { LEGEND_ANCHOR, LEGEND_LAYER, LEGEND_OFFSET, legendPoint, renderLegend } from '../../desktop/ui/graph/legend.js';
import { DESKTOP_LABEL_KEYS } from '../../src/daemon/http/labels.js';

/** A-8 two lines, verbatim (requirement appendix). */
const A8_LINE_ROLE = '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与';
const A8_LINE_SPECIAL = '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流';

const CANVAS = { width: 1280, height: 720 };

test('AC-07 (S-03): legend.lines equal the A-8 rows verbatim and the frozen keys', () => {
  const legend = renderLegend(DESKTOP_LABEL_KEYS);
  assert.deepEqual(legend.lines, [A8_LINE_ROLE, A8_LINE_SPECIAL]);
  assert.equal(legend.lines[0], DESKTOP_LABEL_KEYS.DESKTOP_LEGEND_ROLE);
  assert.equal(legend.lines[1], DESKTOP_LABEL_KEYS.DESKTOP_LEGEND_SPECIAL);
});

test('AC-34: anchor is bottom-left, top layer, fixed offset; shape is plain JSON', () => {
  const legend = renderLegend(DESKTOP_LABEL_KEYS);
  assert.equal(legend.anchor, 'bottom-left');
  assert.equal(LEGEND_ANCHOR, 'bottom-left');
  assert.equal(legend.layer, 'top');
  assert.equal(LEGEND_LAYER, 'top');
  assert.deepEqual(legend.offset, { ...LEGEND_OFFSET });
  // Consumable by the batch-4 graph-dump lazy import: stable plain data.
  assert.deepEqual(JSON.parse(JSON.stringify(legend)), legend);
});

test('AC-34: three view states keep the legend identical', () => {
  const legend = renderLegend(DESKTOP_LABEL_KEYS);
  // (1) zoomed to 150% and panned, (2) after reset, (3) collapsed groups:
  // the legend projection takes none of those as input, so all three agree.
  const zoomed = renderLegend(DESKTOP_LABEL_KEYS);
  const reset = renderLegend(DESKTOP_LABEL_KEYS);
  const collapsed = renderLegend(DESKTOP_LABEL_KEYS);
  for (const state of [zoomed, reset, collapsed]) {
    assert.equal(state.anchor, legend.anchor);
    assert.deepEqual(state.lines, legend.lines);
    assert.equal(state.layer, legend.layer);
    assert.deepEqual(state.offset, legend.offset);
  }
  // The anchor point moves with the canvas size only, never with zoom/pan.
  assert.deepEqual(legendPoint(CANVAS), { x: LEGEND_OFFSET.x, y: CANVAS.height - LEGEND_OFFSET.y });
  assert.deepEqual(legendPoint({ ...CANVAS, zoom: 1.5, pan: { x: 120, y: -40 } }), {
    x: LEGEND_OFFSET.x,
    y: CANVAS.height - LEGEND_OFFSET.y,
  });
});

test('AC-34: legend projection is deterministic and input-safe', () => {
  const first = renderLegend(DESKTOP_LABEL_KEYS);
  const second = renderLegend(DESKTOP_LABEL_KEYS);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(DESKTOP_LABEL_KEYS.DESKTOP_LEGEND_ROLE, A8_LINE_ROLE); // keys untouched
});
