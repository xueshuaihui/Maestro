/**
 * WP-3 contract tests for node detail (AC-11 / AC-12 / AC-13 / AC-14 / AC-15).
 *
 * Four sections are always present; empty sections keep their title. Display
 * words without a frozen key arrive as data fields. Pure module surface only.
 * Run: NODE_ENV=test node --test test/wp14/node-detail.test.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { SESSION_LABEL } from '../../src/cli/labels.js';
import { UI_LABEL_KEYS } from '../../src/daemon/http/labels.js';
import { buildNodeDetail } from '../../desktop/ui/drill/node-detail.js';

const sessionKeys = Object.fromEntries(
  Object.entries(SESSION_LABEL).map(([name, value]) => [`SESSION_LABEL_${name.toUpperCase()}`, value]),
);
const labels = { ...UI_LABEL_KEYS, ...sessionKeys };

function fullDetail() {
  return {
    node: { nodeId: 'T-003', title: '实现登录', state: 'running', round: 1, maxRounds: 2, nodeType: 'role' },
    timeline: [
      { ts: '2026-11-15T09:12:03.000Z', sessionState: 'running' },
      { ts: '2026-11-15T09:15:41.000Z', sessionState: 'review' },
      { ts: '2026-11-15T09:20:12.000Z', sessionState: 'escalated' },
    ],
    summary: { command: 'npm test', exitCode: 1, keyOutputLines: 12, logRef: 'logs/T-003.log' },
    evidence: [
      { index: 1, ref: 'artifacts/code/calc.js', type: 'artifact', typeLabel: '产物', status: 'resolvable', statusLabel: '可解析' },
      { index: 2, ref: 'defects/d1.md', type: 'defect', typeLabel: '缺陷', status: 'missing', statusLabel: '缺失' },
      { index: 3, ref: 'logs/T-003.log', type: 'artifactRef', typeLabel: '产物引用', status: 'resolvable', statusLabel: '可解析' },
    ],
    handoffs: [
      { handoffId: 'HO-006', direction: 'forward', round: 1, state: 'consumed', lastActivity: '2026-11-15T09:20:11.000Z' },
    ],
  };
}

test('AC-11 four sections verbatim, plus an all-empty detail preserving titles', () => {
  const result = buildNodeDetail(fullDetail(), labels);
  assert.equal(result.sections.length, 4);
  assert.equal(result.head, '节点 T-003 · 实现登录 · 执行中 · 轮次 1/2');
  assert.deepEqual(result.sections.map((s) => s.title), ['时间线', '摘要', '证据', '交接']);
  assert.deepEqual(result.sections[0].lines, [
    '时间线 09:12:03 执行中',
    '时间线 09:15:41 待校验',
    '时间线 09:20:12 已升级',
  ]);
  assert.deepEqual(result.sections[1].lines, [
    '摘要 命令 npm test · 退出码 1 · 关键输出 12 行 · 日志 logs/T-003.log',
  ]);
  assert.deepEqual(result.sections[2].lines, [
    '证据 1 · artifacts/code/calc.js · 产物 · 可解析',
    '证据 2 · defects/d1.md · 缺陷 · 缺失',
    '证据 3 · logs/T-003.log · 产物引用 · 可解析',
  ]);
  assert.deepEqual(result.sections[3].lines, [
    '交接 HO-006 · 正向 · 第 1 轮 · 已完成 · 09:20:11',
  ]);

  const empty = buildNodeDetail({
    node: { nodeId: 'T-004', state: 'pending' },
    timeline: [], summary: null, evidence: [], handoffs: [],
  }, labels);
  assert.equal(empty.sections.length, 4);
  assert.deepEqual(empty.sections.map((s) => s.lines[0]), [
    '时间线 无记录', '摘要 无记录', '证据 无记录', '交接 无记录',
  ]);
});

test('AC-12 timeline merges in chronological order regardless of input order', () => {
  const detail = fullDetail();
  detail.timeline = [
    { ts: '2026-11-15T09:15:41.000Z', sessionState: 'review' },
    { ts: '2026-11-15T09:13:40.000Z', sessionState: 'escalated' },
    { ts: '2026-11-15T09:12:03.000Z', sessionState: 'running' },
    { ts: '2026-11-15T09:14:02.000Z', sessionState: 'idle' },
    { ts: '2026-11-15T09:13:10.000Z', sessionState: 'thinking' },
  ];
  const lines = buildNodeDetail(detail, labels).sections[0].lines;
  const times = lines.map((line) => line.slice(4, 12));
  assert.deepEqual(lines, [
    '时间线 09:12:03 执行中',
    '时间线 09:13:10 执行中',
    '时间线 09:13:40 已升级',
    '时间线 09:14:02 空闲',
    '时间线 09:15:41 待校验',
  ]);
  assert.deepEqual(times, ['09:12:03', '09:13:10', '09:13:40', '09:14:02', '09:15:41']);
  for (const time of times) assert.match(time, /^\d{2}:\d{2}:\d{2}$/);
});

test('AC-13 summary missing fields use placeholder, no undefined', () => {
  const detail = fullDetail();
  detail.summary = { command: 'npm test', exitCode: 1 };
  const line = buildNodeDetail(detail, labels).sections[1].lines[0];
  assert.equal(line, '摘要 命令 npm test · 退出码 1 · 关键输出 — 行 · 日志 —');
  assert.ok(!/undefined/.test(line));
});

test('AC-14 evidence three states and copy action', () => {
  const result = buildNodeDetail(fullDetail(), labels);
  assert.deepEqual(result.sections[2].lines, [
    '证据 1 · artifacts/code/calc.js · 产物 · 可解析',
    '证据 2 · defects/d1.md · 缺陷 · 缺失',
    '证据 3 · logs/T-003.log · 产物引用 · 可解析',
  ]);
  assert.equal(result.copyEvidence(1).copied, 'artifacts/code/calc.js');
  assert.equal(result.copyEvidence(2).copied, 'defects/d1.md');
});

test('AC-15 direction comes from definition edge kind, not handoff state', () => {
  const detail = fullDetail();
  detail.handoffs = [
    { handoffId: 'HO-007', direction: 'backflow', round: 2, state: 'consumed', lastActivity: '2026-11-15T09:20:00.000Z' },
    { handoffId: 'HO-006', direction: 'forward', round: 1, state: 'rejected', lastActivity: '2026-11-15T09:14:00.000Z' },
  ];
  const first = buildNodeDetail(detail, labels).sections[3].lines;
  assert.equal(first[0], '交接 HO-007 · 回流 · 第 2 轮 · 已完成 · 09:20:00');
  assert.equal(first[1], '交接 HO-006 · 正向 · 第 1 轮 · 已拒绝 · 09:14:00');

  detail.handoffs[0].state = 'rejected';
  detail.handoffs[1].state = 'consumed';
  const second = buildNodeDetail(detail, labels).sections[3].lines;
  assert.ok(second[0].includes('回流'));
  assert.ok(second[1].includes('正向'));
});
