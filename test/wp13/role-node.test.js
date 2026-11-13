/**
 * Role node row tests (I1.10a WP-6; AC-11 / AC-12).
 *
 * AC-11 anchor: the serving example of A-9 is reproduced verbatim from a real
 * projection (status colour blue, abnormality badge `escalated` with count 1,
 * host icons in first-seen order) — five elements, no more, no less.
 *
 * AC-12 anchor: three serving nodes collapse into `{first} 等 3 个`, three
 * active sessions keep the plain count plus the `x3` stacked badge, and the
 * node width stays the layout constant (180) so richer content never widens
 * it.
 *
 * The architecture gate of AC-11 (`grep -R decideStatus desktop/` must be
 * empty) is asserted here as a directory scan: the desktop layer consumes the
 * projected role status and never re-runs the status state machine.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NODE_HEIGHT, NODE_WIDTH } from '../../desktop/ui/graph/layout.js';
import { renderRoleRow } from '../../desktop/ui/graph/node-rows.js';
import { buildGraph } from '../../src/daemon/graph.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const LABELS = UI_LABEL_KEYS;

/** A-9 serving row, verbatim. */
const A9_SERVING_ROW =
  '角色 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 异常 1';
/** A-9 folding + stacking form, verbatim. */
const A9_FOLDED_ROW =
  '角色 开发 · 服务中 · 3 个活跃会话 · 服务 T-001 等 3 个 · 宿主 mock · 异常 0';

/** Three nodes of one role, chained so the role instance binds all three. */
function roleFlowDef(nodeCount) {
  const nodes = [];
  const edges = [];
  for (let i = 1; i <= nodeCount; i += 1) {
    const id = `T-${String(i).padStart(3, '0')}`;
    nodes.push({ id, node_type: 'role', role: 'dev', order: i - 1 });
    if (i > 1) edges.push({ from: `T-${String(i - 1).padStart(3, '0')}`, to: id });
  }
  return { id: 'role-flow', nodes, edges };
}

/**
 * Project one role that serves `nodeCount` running nodes with `hosts.length`
 * sessions (one per serving node) and an optional escalated node.
 */
function projectRole({ nodeCount = 2, hosts = ['dsh', 'cursor'], escalated = 0 } = {}) {
  const def = roleFlowDef(nodeCount + escalated);
  const stateNodes = [];
  const sessions = [];
  for (let i = 1; i <= nodeCount; i += 1) {
    const nodeId = `T-${String(i).padStart(3, '0')}`;
    stateNodes.push({ nodeId, roleId: 'dev', state: 'running', round: 1 });
    sessions.push({
      sessionId: `SESS-${i}`,
      nodeId,
      state: 'thinking',
      hostId: hosts[i - 1] ?? hosts[0],
      createdAt: `2026-01-01T00:00:0${i}.000Z`,
    });
  }
  for (let i = 1; i <= escalated; i += 1) {
    stateNodes.push({
      nodeId: `T-${String(nodeCount + i).padStart(3, '0')}`,
      roleId: 'dev',
      state: 'escalated',
      round: 1,
    });
  }
  const state = {
    schemaVersion: 2,
    instanceId: 'INST-ROLE',
    template: 'role-flow',
    state: 'running',
    workflowRef: 'role-flow',
    updatedAt: '2026-01-01T00:10:00.000Z',
    nodes: stateNodes,
    sessions,
    handoffs: [],
    escalations: [],
  };
  const roles = { dev: { id: 'dev', name: '开发', group: 'coding' } };
  const graph = buildGraph({ state, workflowDef: def, roles });
  return graph.nodes.find((node) => node.type === 'role' && node.roleId === 'dev');
}

test('AC-11: the A-9 serving row is reproduced verbatim from the projection', () => {
  const node = projectRole({ nodeCount: 2, hosts: ['dsh', 'cursor'], escalated: 1 });
  const row = renderRoleRow(node, LABELS);
  assert.equal(row.text, A9_SERVING_ROW);
  assert.equal(row.visual.statusColor, 'blue');
  assert.equal(row.visual.badge, 'escalated');
  assert.equal(row.visual.badgeCount, 1);
  assert.deepEqual(row.hostIcons, ['dsh', 'cursor']);
  // Five elements: colour, sessions, serving nodes, hosts, abnormality badge.
  assert.equal(row.status, 'serving');
  assert.equal(row.sessions, 2);
  assert.deepEqual(row.servingNodes, ['T-001', 'T-002']);
  assert.equal(row.abnormalCount, 1);
});

test('AC-11: every role status token maps to its A-9 colour and word', () => {
  const cases = [
    ['available', 'green', '可用'],
    ['serving', 'blue', '服务中'],
    ['cooldown', 'gray', '冷却中'],
    ['unavailable', 'red', '不可用'],
    ['inactive', 'gray', '未参与'],
  ];
  for (const [status, color, word] of cases) {
    const row = renderRoleRow({ id: `role:${status}`, type: 'role', title: '协调者', status }, LABELS);
    assert.equal(row.visual.statusColor, color, `colour of ${status}`);
    assert.equal(row.statusText, word, `word of ${status}`);
    assert.equal(row.text.includes(word), true, `row of ${status} carries ${word}`);
  }
});

test('AC-11: empty serving set and empty host set render the placeholder', () => {
  const row = renderRoleRow(
    { id: 'role:x', type: 'role', title: '协调者', status: 'inactive', activeSessions: 0, servingNodes: [], hostIcons: [] },
    LABELS,
  );
  assert.equal(row.text, '角色 协调者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 异常 0');
  assert.equal(row.visual.badge, null);
  assert.equal(row.visual.badgeCount, 0);
  assert.equal(row.visual.animation, 'none');
});

test('AC-12: three serving nodes fold into "{first} 等 3 个" and keep the width', () => {
  const node = projectRole({ nodeCount: 3, hosts: ['mock'], escalated: 0 });
  const row = renderRoleRow(node, LABELS);
  assert.equal(row.text, A9_FOLDED_ROW);
  assert.equal(row.visual.sessionStack, 3);
  assert.equal(row.visual.stackBadge, '×3');
  assert.equal(row.width, 180);
  assert.equal(row.width, NODE_WIDTH);
  assert.equal(row.height, NODE_HEIGHT);
  assert.deepEqual(row.hostIcons, ['mock']);
  // The very same width as a node that serves a single node.
  const single = renderRoleRow(projectRole({ nodeCount: 1, hosts: ['mock'] }), LABELS);
  assert.equal(single.width, row.width);
  assert.equal(single.text.includes('等 3 个'), false);
});

test('AC-12: session text keeps the plain count while the badge stacks', () => {
  const row = renderRoleRow(
    { id: 'role:d', type: 'role', title: '开发', status: 'serving', activeSessions: 2, servingNodes: ['T-001'], hostIcons: ['mock'] },
    LABELS,
  );
  assert.equal(row.text.includes('2 个活跃会话'), true);
  assert.equal(row.visual.sessionStack, 2);
  assert.equal(row.visual.stackBadge, '×2');
  const single = renderRoleRow(
    { id: 'role:d', type: 'role', title: '开发', status: 'serving', activeSessions: 1, servingNodes: ['T-001'], hostIcons: ['mock'] },
    LABELS,
  );
  assert.equal(single.visual.sessionStack, 0);
  assert.equal(single.visual.stackBadge, null);
});

test('AC-11: the desktop layer never re-runs the role status state machine', () => {
  const roots = ['desktop/ui', 'desktop/harness', 'desktop/src-tauri/src'];
  const hits = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'target' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /\.(js|mjs|rs|html)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes(['decide', 'Status'].join(''))) hits.push(path.relative(REPO, full));
      }
    }
  };
  for (const rel of roots) walk(path.join(REPO, rel));
  assert.deepEqual(hits, []);
});
