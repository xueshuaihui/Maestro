// I1.9 S3 验收 A 组：AC-03 全量回归「失败集合差集 = 0」的差分取证。
//
// 全量实跑（1154 tests）比 I1.7 基线 8 条多出 2 条失败：
//   1) test/wp11/rpc.test.js:346「events.jsonl 行数应为 8，实际 9」（稳定复现）
//   2) test/wp9/cli-e2e.test.js:176 C-2（状态采样错过 4s tool_running 窗口，负载敏感）
// 本探针**只读产品代码**，按 rpc.test.js:269 起的同一流程重建现场（真实 store + 真实
// orchestrator + 真实事件总线），把落盘的 9 条事件逐条打印，证明多出来的那条是新能力
// `execution.summary`（I1.9 / BR-04 要求取消也是会话收尾）。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-ac57-probe.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-03/ac57-events.json
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createEventBus } from '../src/core/event-bus.js';
import { createOrchestrator } from '../src/core/orchestrator.js';
import { createStore } from '../src/persistence/instance-store.js';
import { eventsPath } from '../src/persistence/paths.js';
import { evidenceDir, ensureDir, nowIso, writeEvidence } from './acc9-a-lib.mjs';

const ID = 'INST-AC57';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-acc9-ac57-'));
const T = '2026-01-01T00:00:00.000Z';

const store = createStore({ root });
const bus = createEventBus({ store });
const orch = createOrchestrator({
  store,
  bus,
  env: { NODE_ENV: 'test' },
  adapterFactory: { async create() { throw new Error('no host in unit test'); } },
});

const seed = (id) => ({
  schemaVersion: 2,
  instanceId: id,
  state: 'running',
  halted: false,
  rev: 0,
  paused: false,
  task: '写 calc.js',
  cwd: '/tmp/maestro-ac57-work',
  createdAt: T,
  stateSince: T,
  counters: { dispatchCount: 1, eventSeq: 0 },
  nodes: [{ nodeId: 'T-001', state: 'running', round: 1, sessionId: 'sess-001', endedAt: null }],
  sessions: [{ sessionId: 'sess-001', state: 'thinking', nodeId: 'T-001', hostId: null, quarantined: false }],
  handoffs: [{ handoffId: 'HO-001', state: 'created', createdAt: T }],
  escalations: [{
    escalationId: 'ESC-001', nodeId: 'T-001', round: 1, state: 'pending',
    reasonCode: 'handoff_invalid', reasonDetail: 'x', defects: [], createdAt: T, resolvedAt: null, resolution: null,
  }],
  approvals: [{
    approvalId: 'APR-001', instanceId: id, nodeId: 'T-001', sessionId: 'sess-001',
    action: 'write', toolCallId: 'tc-1', state: 'pending', createdAt: T, resolvedAt: null, resolution: null,
  }],
});

await store.save(ID, seed(ID));

const steps = [];
steps.push({ step: 'pause', result: await orch.pause({ instanceId: ID }) });
steps.push({ step: 'resume', result: await orch.resume({ instanceId: ID }) });
steps.push({ step: 'cancel', result: await orch.cancel({ instanceId: ID }) });

const raw = await fs.readFile(eventsPath(root, ID), 'utf8');
const disk = raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

const EXPECTED = [
  'workflow.paused', 'workflow.resumed', 'run.cancelled', 'run.cancelled',
  'handoff.rejected', 'escalation.voided', 'approval.withdrawn', 'run.cancelled',
];

const payload = {
  at: nowIso(),
  root,
  steps: steps.map((s) => ({ step: s.step, ok: s.result?.ok ?? null })),
  diskCount: disk.length,
  expectedCount: EXPECTED.length,
  diskReasons: disk.map((e) => e.reason),
  expectedReasons: EXPECTED,
  extraEvents: disk.filter((e) => !EXPECTED.includes(e.reason)),
  allEvents: disk.map((e) => ({
    seq: e.seq, object: e.object, objectId: e.objectId, reason: e.reason,
    result: e.result, detail: e.detail ?? null,
  })),
};

// 稳定性：再跑 2 轮，确认不是偶发（每轮独立根）。
const repeats = [];
for (let i = 0; i < 2; i += 1) {
  const r2 = await fs.mkdtemp(path.join(os.tmpdir(), `maestro-acc9-ac57-r${i}-`));
  const s2 = createStore({ root: r2 });
  const b2 = createEventBus({ store: s2 });
  const o2 = createOrchestrator({
    store: s2, bus: b2, env: { NODE_ENV: 'test' },
    adapterFactory: { async create() { throw new Error('no host'); } },
  });
  const id2 = `INST-AC57-R${i}`;
  await s2.save(id2, seed(id2));
  await o2.pause({ instanceId: id2 });
  await o2.resume({ instanceId: id2 });
  await o2.cancel({ instanceId: id2 });
  const raw2 = await fs.readFile(eventsPath(r2, id2), 'utf8');
  const d2 = raw2.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  repeats.push({ round: i, count: d2.length, reasons: d2.map((e) => e.reason) });
}
payload.repeats = repeats;

ensureDir(evidenceDir('AC-03'));
writeEvidence('AC-03', 'ac57-events.json', payload);
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);

await fs.rm(root, { recursive: true, force: true });
