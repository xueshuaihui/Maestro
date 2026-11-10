/**
 * I1.9 WP-1 — path factories and trace log primitives.
 *
 * Every scenario that touches the filesystem uses a throwaway directory under
 * the OS temp dir (never the project tree) and removes it afterwards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  instanceDir,
  instanceStateDir,
  instanceTracesPath,
  statePath,
  eventsPath,
  corruptPath,
  instanceWorkspaceDir,
} from '../../src/persistence/paths.js';
import {
  newTraceId,
  appendSpan,
  readTraces,
  deriveHandoffIds,
  overlayRunningSpans,
} from '../../src/core/trace.js';

const T0 = '2026-11-10T10:00:00.000Z';
const T1 = '2026-11-10T10:00:40.000Z';
const T2 = '2026-11-10T10:01:30.000Z';

function span(nodeId, status, extra = {}) {
  return {
    trace_id: 'TRC-1a2b3c4d',
    instance_id: 'INST-001',
    node_id: nodeId,
    round: 1,
    start_time: T0,
    end_time: T1,
    status,
    ...extra,
  };
}

test('instanceStateDir / instanceTracesPath 形状；既有 statePath / eventsPath 不变', () => {
  const root = path.join('/tmp', 'maestro-i19-shape');
  const id = 'INST-001';

  assert.equal(instanceStateDir(root, id), path.join(instanceDir(root, id), 'state'));
  assert.equal(
    instanceTracesPath(root, id),
    path.join(instanceStateDir(root, id), 'traces.jsonl')
  );
  assert.equal(
    instanceTracesPath(root, id),
    path.join(root, '.orch', 'instances', id, 'state', 'traces.jsonl')
  );
  assert.ok(
    instanceTracesPath(root, id).endsWith(
      path.join('instances', id, 'state', 'traces.jsonl')
    )
  );

  // Existing factories stay byte-for-byte unchanged.
  assert.equal(statePath(root, id), path.join(instanceDir(root, id), 'state.json'));
  assert.equal(eventsPath(root, id), path.join(instanceDir(root, id), 'events.jsonl'));
  assert.equal(corruptPath(root, id), path.join(instanceDir(root, id), 'state.json.corrupt'));
  assert.equal(instanceWorkspaceDir(root, id), path.join(instanceDir(root, id), 'workspace'));
});

test('newTraceId 匹配 /^TRC-[0-9a-f]{8}$/ 且两次调用不同', () => {
  const a = newTraceId();
  const b = newTraceId();
  assert.match(a, /^TRC-[0-9a-f]{8}$/);
  assert.match(b, /^TRC-[0-9a-f]{8}$/);
  assert.notEqual(a, b);
});

test('appendSpan 两次追加 7 字段行；readTraces 读回 2 条；handoff_ids 不落盘', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i19-trace-'));
  try {
    const r1 = await appendSpan(root, 'INST-001', span('T-001', 'done', { handoff_ids: ['HO-001'] }));
    const r2 = await appendSpan(root, 'INST-001', span('T-002', 'failed', { handoff_ids: ['HO-001', 'HO-002'] }));
    assert.deepEqual(r1, { ok: true });
    assert.deepEqual(r2, { ok: true });

    const read = await readTraces(root, 'INST-001');
    assert.equal(read.badLines, 0);
    assert.equal(read.spans.length, 2);
    assert.equal(read.spans[0].node_id, 'T-001');
    assert.equal(read.spans[1].node_id, 'T-002');

    const file = await fs.readFile(instanceTracesPath(root, 'INST-001'), 'utf8');
    const lines = file.split(/\r?\n/).filter((l) => l.trim().length > 0);
    assert.equal(lines.length, 2);
    const seven = ['trace_id', 'instance_id', 'node_id', 'round', 'start_time', 'end_time', 'status'].sort();
    for (const line of lines) {
      const obj = JSON.parse(line); // each line must parse
      assert.deepEqual(Object.keys(obj).sort(), seven);
      assert.equal('handoff_ids' in obj, false);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('readTraces 文件缺失返回空；单行损坏跳过计数；整份损坏不抛错', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i19-trace-'));
  try {
    // Missing file.
    assert.deepEqual(await readTraces(root, 'INST-999'), { spans: [], badLines: 0 });

    const p = instanceTracesPath(root, 'INST-001');
    await fs.mkdir(path.dirname(p), { recursive: true });

    // 1 bad line + 2 valid lines.
    const valid = (nodeId) => JSON.stringify({
      trace_id: 'TRC-1a2b3c4d', instance_id: 'INST-001', node_id: nodeId,
      round: 1, start_time: T0, end_time: T1, status: 'done',
    });
    await fs.writeFile(p, ['NOT_JSON{{{', valid('T-001'), valid('T-002')].join('\n') + '\n', 'utf8');
    const mixed = await readTraces(root, 'INST-001');
    assert.equal(mixed.spans.length, 2);
    assert.equal(mixed.badLines, 1);

    // Every line broken.
    const broken = ['garbage-1', 'garbage-2', 'garbage-3'];
    await fs.writeFile(p, broken.join('\n') + '\n', 'utf8');
    const all = await readTraces(root, 'INST-001');
    assert.equal(all.spans.length, 0);
    assert.equal(all.badLines, broken.length);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('deriveHandoffIds 冻结窗口：HO-002（round=2 回流）不漏', () => {
  const state = {
    handoffs: [
      {
        handoffId: 'HO-001',
        edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
        fromNodeId: 'T-001',
        toNodeId: 'T-002',
        round: 1,
        createdAt: T1,
      },
      {
        handoffId: 'HO-002',
        edge: { from: 'T-002', to: 'T-001', kind: 'backflow' },
        fromNodeId: 'T-002',
        toNodeId: 'T-001',
        round: 2,
        createdAt: T2,
      },
    ],
  };

  // T-002 r1: HO-001 (received) + HO-002 (backflow produced, round = r + 1).
  const t002r1 = deriveHandoffIds(state, 'T-002', 1);
  assert.ok(t002r1.includes('HO-001'));
  assert.ok(t002r1.includes('HO-002'));
  assert.deepEqual(t002r1, ['HO-001', 'HO-002']); // createdAt ascending

  // T-001 r2: HO-002 received.
  const t001r2 = deriveHandoffIds(state, 'T-001', 2);
  assert.ok(t001r2.includes('HO-002'));

  // T-001 r1: HO-001 produced (forward), no HO-002.
  const t001r1 = deriveHandoffIds(state, 'T-001', 1);
  assert.ok(t001r1.includes('HO-001'));
  assert.ok(!t001r1.includes('HO-002'));
});

test('overlayRunningSpans 有 running 返回 1 条进行中、无 running 返回空、不写盘', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'i19-trace-'));
  try {
    const runningState = {
      instanceId: 'INST-001',
      state: 'running',
      nodes: [
        { nodeId: 'T-001', round: 1, state: 'running', startedAt: T0 },
      ],
    };

    const overlay = overlayRunningSpans(runningState, []);
    assert.equal(overlay.length, 1);
    assert.equal(overlay[0].node_id, 'T-001');
    assert.equal(overlay[0].round, 1);
    assert.equal(overlay[0].status, 'running');
    assert.equal(overlay[0].end_time, null);
    assert.equal(overlay[0].running, true);

    // No running nodes -> empty.
    const doneState = {
      instanceId: 'INST-001',
      state: 'completed',
      nodes: [
        { nodeId: 'T-001', round: 1, state: 'done' },
        { nodeId: 'T-002', round: 0, state: 'pending' },
      ],
    };
    assert.equal(overlayRunningSpans(doneState, []).length, 0);

    // A running node that already has a landed span for the same node+round is excluded.
    const withLanded = overlayRunningSpans(runningState, [
      span('T-001', 'done'),
    ]);
    assert.equal(withLanded.length, 0);

    // Pure: no trace file is ever created by the overlay.
    await assert.rejects(
      () => fs.stat(instanceTracesPath(root, 'INST-001')),
      { code: 'ENOENT' }
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
