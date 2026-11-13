/**
 * Label policy and label table resolution tests (I1.10a WP-6; AC-25 / A-14).
 *
 * AC-25 anchor: with six lines (consumed, accepted, delivered, pending,
 * expired, rejected) the default visible label set has three members; hovering
 * the "done" line adds exactly that line (four); moving away returns to three.
 * The role node content (serving nodes, active sessions, hosts) is present in
 * all three states, because the label policy only governs connection labels.
 *
 * The resolver accepts both label shapes (the `GET /ui/labels` body with its
 * `keys` object and the flat table), substitutes placeholders literally, keeps
 * an unknown placeholder untouched, returns `null` for a missing key and never
 * writes into the shared table.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fillTemplate, resolveLabels, visibleLabels } from '../../desktop/ui/labels/labels.js';
import { renderRoleRow } from '../../desktop/ui/graph/node-rows.js';
import { UI_LABEL_KEYS, labelKeysPayload } from '../../src/daemon/http/labels.js';

const LABELS = UI_LABEL_KEYS;

/** Six lines, one per AC-25 state, in the AC-25 order. */
function edges() {
  return [
    { id: 'L-01', from: 'role:a', to: 'role:b', direction: 'forward', aggregateStatus: 'consumed' },
    { id: 'L-02', from: 'role:a', to: 'role:c', direction: 'forward', aggregateStatus: 'accepted' },
    { id: 'L-03', from: 'role:a', to: 'role:d', direction: 'forward', aggregateStatus: 'delivered' },
    { id: 'L-04', from: 'role:b', to: 'role:c', direction: 'forward', aggregateStatus: 'pending' },
    { id: 'L-05', from: 'role:b', to: 'role:d', direction: 'forward', aggregateStatus: 'expired' },
    { id: 'L-06', from: 'role:c', to: 'role:d', direction: 'backflow', aggregateStatus: 'rejected' },
  ];
}

const ROLE_NODE = {
  id: 'role:a',
  type: 'role',
  title: '开发',
  status: 'serving',
  activeSessions: 2,
  servingNodes: ['T-001', 'T-002'],
  hostIcons: ['dsh', 'cursor'],
  abnormal: false,
  abnormalCount: 0,
};

test('AC-25: three label states are 3 / 4 / 3 and the added key is the done line', () => {
  const list = edges();
  const first = visibleLabels(list, null);
  assert.equal(first.length, 3);
  assert.deepEqual(first, ['L-04', 'L-05', 'L-06']);

  const hovered = visibleLabels(list, 'L-01');
  assert.equal(hovered.length, 4);
  assert.deepEqual(hovered, ['L-01', 'L-04', 'L-05', 'L-06']);
  // Exactly the hovered key was added; the other three are untouched.
  assert.deepEqual(hovered.filter((key) => key !== 'L-01'), first);

  const left = visibleLabels(list, null);
  assert.equal(left.length, 3);
  assert.deepEqual(left, first);
});

test('AC-25: the default set is exactly rejected / expired / pending', () => {
  const list = edges();
  const visible = new Set(visibleLabels(list, null));
  for (const edge of list) {
    const expected = ['rejected', 'expired', 'pending'].includes(edge.aggregateStatus);
    assert.equal(visible.has(edge.id), expected, `visibility of ${edge.aggregateStatus}`);
  }
  // A normal state never becomes visible without hovering.
  assert.equal(visibleLabels(list, null).includes('L-01'), false);
  // The not-started state stays out of the default set as well.
  const extra = [{ id: 'L-07', aggregateStatus: 'not_started' }];
  assert.deepEqual(visibleLabels(extra, null), []);
  assert.deepEqual(visibleLabels(extra, 'L-07'), ['L-07']);
});

test('AC-25: the role node content survives all three label states', () => {
  const list = edges();
  for (const hovered of [null, 'L-01', null]) {
    const covered = visibleLabels(list, hovered);
    assert.equal(Array.isArray(covered), true);
    const row = renderRoleRow(ROLE_NODE, LABELS);
    assert.equal(row.text.includes('服务 T-001, T-002'), true);
    assert.equal(row.text.includes('2 个活跃会话'), true);
    assert.equal(row.text.includes('宿主 dsh cursor'), true);
  }
});

test('A-14: the resolver accepts both label shapes and resolves the same text', () => {
  const payload = labelKeysPayload();
  const fromPayload = resolveLabels(payload);
  const fromFlat = resolveLabels(UI_LABEL_KEYS);
  assert.deepEqual(fromPayload.get('DESKTOP_ROLE_ROW'), UI_LABEL_KEYS.DESKTOP_ROLE_ROW);
  assert.equal(fromFlat.get('DESKTOP_ROLE_ROW'), fromPayload.get('DESKTOP_ROLE_ROW'));
  assert.equal(fromPayload.has('DESKTOP_ROLE_ROW'), true);
  assert.equal(fromPayload.has('NOPE_KEY'), false);
  assert.equal(fromPayload.get('NOPE_KEY'), null);
  assert.equal(fromPayload.text('NOPE_KEY', { n: 1 }), null);
  // The table is the shared reference, never a copy.
  assert.equal(fromPayload.keys, payload.keys);
});

test('A-14: placeholder substitution is literal and never fabricates text', () => {
  const labels = resolveLabels(labelKeysPayload());
  assert.equal(
    labels.text('DESKTOP_ROLE_ROW_SERVING_MORE', { first: 'T-001', n: 3 }),
    'T-001 等 3 个',
  );
  assert.equal(labels.text('DESKTOP_ROLE_ROW_SESSION_STACK', { n: 3 }), '×3');
  assert.equal(labels.text('DESKTOP_GROUP_ROW', { group: '编码工程', n: 8 }), '分组 编码工程 · 8 角色');
  // A missing parameter keeps its placeholder verbatim.
  assert.equal(labels.text('DESKTOP_GROUP_ROW', { n: 8 }), '分组 {group} · 8 角色');
  assert.equal(
    fillTemplate('a {x} b {y}', { x: 'X' }),
    'a X b {y}',
  );
  // No escaping / no interpolation of the substituted value.
  assert.equal(fillTemplate('{x}', { x: '{y}' }), '{y}');
});

test('A-14: resolution never mutates the shared label table', () => {
  const snapshot = JSON.stringify(UI_LABEL_KEYS);
  const labels = resolveLabels(labelKeysPayload());
  labels.text('DESKTOP_ROLE_ROW', { role: 'r', status: 's', sessions: 0, serving: '-', hosts: '-', abnormal: 0 });
  labels.get('DESKTOP_EDGE_ROW');
  visibleLabels(edges(), 'L-01');
  assert.equal(JSON.stringify(UI_LABEL_KEYS), snapshot);
  assert.equal(Object.isFrozen(UI_LABEL_KEYS), true); // shared, frozen reference
  assert.equal(UI_LABEL_KEYS.DESKTOP_ROLE_ROW.includes('{role}'), true);
});
