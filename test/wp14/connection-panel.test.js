/**
 * WP-3 contract tests for the connection-line handoff panel
 * (AC-19 / AC-42 / AC-43 / AC-51). Pure module surface only.
 *
 * Run: NODE_ENV=test node --test test/wp14/connection-panel.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { buildHandoffPanel } from '../../desktop/ui/drill/handoff-panel.js';
import { createApp } from '../../desktop/ui/app.js';

const labels = { ...UI_LABEL_KEYS };
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function ho(id, round, state, time, extra = {}) {
  return {
    handoffId: id,
    round,
    state,
    lastActivity: `2026-11-15T${time}.000Z`,
    timeline: [],
    ...extra,
  };
}

function fourPackagePanel() {
  return {
    edge: {
      id: 'E-01', fromRole: '开发', toRole: '测试', direction: 'forward',
      aggregateStatus: 'rejected', parallelCount: 2,
    },
    handoffs: [
      ho('HO-008', 1, 'rejected', '08:58:02', { rejectReason: '下游拒绝' }),
      ho('HO-009', 2, 'expired', '09:05:10', { rejectReason: '交接已过期' }),
      ho('HO-010', 3, 'delivered', '09:12:41', {
        timeline: [
          { ts: '2026-11-15T09:12:40.000Z', state: 'built' },
          { ts: '2026-11-15T09:12:41.000Z', state: 'delivered' },
        ],
      }),
      ho('HO-011', 3, 'delivered', '09:12:39'),
    ],
  };
}

test('AC-19 title line verbatim, four packages, descending last-activity order', () => {
  const panel = buildHandoffPanel(fourPackagePanel(), labels, {});
  assert.equal(panel.title, '连接 开发→测试 · 正向 · 已拒绝 · 2 并行交接');
  assert.equal(panel.rows.length, 4);
  assert.deepEqual(panel.rows.map((r) => r.id), ['HO-010', 'HO-011', 'HO-009', 'HO-008']);
  assert.deepEqual(panel.rows.map((r) => r.time), ['09:12:41', '09:12:39', '09:05:10', '08:58:02']);
  assert.deepEqual(panel.rows.map((r) => r.line), [
    '交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41',
    '交接 HO-011 · 第 3 轮 · 已投递 · 09:12:39',
    '交接 HO-009 · 第 2 轮 · 已过期 · 09:05:10',
    '交接 HO-008 · 第 1 轮 · 已拒绝 · 08:58:02',
  ]);
});

test('AC-19 HO-010 expanded timeline has exactly two reached states', () => {
  const panel = buildHandoffPanel(fourPackagePanel(), labels, { expandedId: 'HO-010' });
  assert.deepEqual(panel.timelineRows, [
    '时间线 09:12:40 已构造',
    '时间线 09:12:41 已投递',
  ]);
  assert.equal(panel.expandedId, 'HO-010');
  assert.equal(panel.rows.find((r) => r.id === 'HO-010').time, '09:12:41');
  const empty = buildHandoffPanel({ edge: { fromRole: '测试', toRole: '协调者', direction: 'forward', aggregateStatus: 'delivered' }, handoffs: [] }, labels, {});
  assert.equal(empty.emptyText, '交接 无');
  assert.equal(empty.rows.length, 0);
});

test('AC-42 sixty handoffs: browse to the last row without blank lines', () => {
  const handoffs = [];
  for (let i = 1; i <= 60; i += 1) {
    const sec = String(60 - i).padStart(2, '0');
    handoffs.push(ho(`HO-${String(i).padStart(3, '0')}`, 1, 'delivered', `09:${sec}:00`));
  }
  handoffs.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  let tick = 0;
  const panel = buildHandoffPanel({
    edge: { fromRole: '开发', toRole: '测试', direction: 'forward', aggregateStatus: 'delivered', parallelCount: 1 },
    handoffs,
  }, labels, { clock: () => { tick += 10; return tick; } });
  assert.ok(panel.visibleIds.includes('HO-001'));
  assert.ok(panel.rows.every((r) => r.id.startsWith('HO-')));
  panel.scrollToEnd();
  assert.ok(panel.visibleIds.includes('HO-060'));
  const last = panel.rows.find((r) => r.id === 'HO-060');
  assert.match(last.line, /^交接 HO-060 · 第 1 轮 · 已投递 · \d{2}:\d{2}:\d{2}$/);
  assert.ok(panel.renderedRows < 60);
  assert.ok(panel.scrollElapsed <= 200);
});

test('AC-43 expanded row stays expanded across a title refresh; anchor stays put', () => {
  const panelBefore = buildHandoffPanel(fourPackagePanel(), labels, {
    expandedId: 'HO-010', anchorRowTop: 100, clock: () => 0,
  });
  const timelineBefore = panelBefore.timelineRows.slice();
  const changed = fourPackagePanel();
  changed.edge.aggregateStatus = 'rejected';
  const panelAfter = buildHandoffPanel(changed, labels, {
    expandedId: panelBefore.expandedId, anchorRowTop: 100, clock: () => 0,
  });
  assert.ok(panelAfter.title.includes('已拒绝'));
  assert.equal(panelAfter.expandedId, 'HO-010');
  assert.deepEqual(panelAfter.timelineRows, timelineBefore);
  assert.ok(Math.abs(panelAfter.anchorRowTop - panelBefore.anchorRowTop) <= 1);
});

test('AC-51 three connection lines always land on the handoff panel, never a write panel', () => {
  const states = [
    ['rejected', '已拒绝', '下游拒绝'],
    ['expired', '已过期', '交接已过期'],
    ['delivered', '已投递', ''],
  ];
  for (const [aggregate, word, reason] of states) {
    const panel = buildHandoffPanel({
      edge: { fromRole: '开发', toRole: '测试', direction: 'forward', aggregateStatus: aggregate, parallelCount: 1 },
      handoffs: [ho('HO-001', 1, aggregate, '09:00:00', { rejectReason: reason })],
    }, labels, {});
    assert.equal(panel.target, 'connection-panel');
    assert.ok(panel.title.includes(word));
    assert.equal(panel.rows[0].reason, reason);
  }
  const source = fs.readFileSync(
    path.join(REPO, 'desktop/ui/drill/handoff-panel.js'), 'utf8',
  );
  assert.ok(!source.includes('escalation'));
});

// AC-51 view-level landing (the missing half of the module-only case above).
// Drives the REAL createApp seam: the CTL `open-connection` action dispatches to
// app.openConnectionPanel(arg). We mirror that dispatch here (same method, same
// arg) and assert the landing on the view state, never escalation/drill.
test('AC-51 view: red / orange / delivered lines land on connection-panel, never escalation-panel / drill, state hash unchanged', () => {
  // Fixture state.json — read + hashed before/after the three clicks (internal
  // assertion, never user-visible). Mirrors the AC-49 badge-jump hash seam.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i10b-conn-'));
  const stateFile = path.join(dir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({
    schemaVersion: 2, rev: 9, state: 'running',
    handoffs: [
      { handoffId: 'HO-C1', state: 'rejected', rejectReason: '下游拒绝' },
      { handoffId: 'HO-E1', state: 'expired', rejectReason: '交接已过期' },
      { handoffId: 'HO-D1', state: 'delivered', rejectReason: '' },
    ],
  }));
  const stateHashBefore = createHash('sha256').update(fs.readFileSync(stateFile)).digest('hex');

  const app = createApp({
    labels: { keys: UI_LABEL_KEYS },
    project: { view: 'graph', root: dir, source: 'test' },
    io: { now: () => 0 },
  });

  // The assembly must expose the open-connection CTL route (the click -> panel
  // routing that AC-51 requires); same seam as open-escalation, no new channel.
  const appSource = fs.readFileSync(path.join(REPO, 'desktop/ui/app.js'), 'utf8');
  assert.ok(appSource.includes("action === 'open-connection'"));
  const ctl = (action, arg) => {
    if (action === 'open-connection') app.openConnectionPanel(arg);
  };

  const cases = [
    { edgeId: 'E-RED', aggregate: 'rejected', word: '已拒绝', reason: '下游拒绝', reasonWord: '拒绝' },
    { edgeId: 'E-ORANGE', aggregate: 'expired', word: '已过期', reason: '交接已过期', reasonWord: '过期' },
    { edgeId: 'E-GREEN', aggregate: 'delivered', word: '已投递', reason: '', reasonWord: null },
  ];
  for (const c of cases) {
    const data = {
      edge: {
        id: c.edgeId, fromRole: '开发', toRole: '测试', direction: 'forward',
        aggregateStatus: c.aggregate, parallelCount: 1,
      },
      handoffs: [ho('HO-001', 1, c.aggregate, '09:00:00', { rejectReason: c.reason })],
    };
    ctl('open-connection', { edgeId: c.edgeId, data });

    const st = app.state();
    assert.ok(st.view === 'connection-panel');
    assert.ok(st.view !== 'escalation-panel');
    assert.ok(st.view !== 'drill');

    const panel = buildHandoffPanel(st.connectionPanel.data, UI_LABEL_KEYS, {});
    assert.ok(panel.target === 'connection-panel');
    assert.ok(panel.title.includes(c.word));
    assert.ok(panel.rows[0].reason === c.reason);
    if (c.reasonWord !== null) assert.ok(panel.rows[0].reason.includes(c.reasonWord));
  }

  const stateHashAfter = createHash('sha256').update(fs.readFileSync(stateFile)).digest('hex');
  assert.ok(stateHashBefore === stateHashAfter);
  fs.rmSync(dir, { recursive: true, force: true });
});
