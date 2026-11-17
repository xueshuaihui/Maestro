/**
 * I1.12 WP-6 / AC-20 contract: mock-surface performance baseline.
 *
 * Uses the repository's read-only mock ACP fixture (test/fixtures/mock-acp-agent.js)
 * as the event/session-id shape source. Builds 20 concurrent instances and 50
 * active sessions under os.tmpdir() with NODE_ENV=test, collects handoff
 * latency via the frozen D-11 primitive, and asserts the graded report.
 *
 * This suite never contacts a real host and never touches user ~/.dsh. All
 * authored text is ASCII; grading values come from the frozen PERF_LEVELS keys.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PERF_LEVELS,
  PERF_TARGETS,
  PERF_BOTTLENECKS,
  collectHandoffLatency,
  buildPerfReport
} from '../../src/core/perf-baseline.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOCK_FIXTURE = path.join(REPO_ROOT, 'test', 'fixtures', 'mock-acp-agent.js');
const MOCK_AGENT = 'mock-acp-agent';
const MOCK_PID = 4242; // stable stand-in for fixture newSessionId()'s process.pid
const SESSION_PREFIX = `mock-sess-${MOCK_PID}-`;
const INSTANCE_COUNT = 20;
const SESSION_COUNT = 50;
const ROUND = 1;
const BASE_MS = Date.parse('2026-11-18T00:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const pad = (n) => String(n).padStart(3, '0');

/** Deterministic fixture latencies, all below the 2s budget. */
const LATENCIES = Array.from(
  { length: SESSION_COUNT },
  (_, s) => 120 + ((s * 137) % 1400)
);

function expectedStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (fraction) => {
    const index = (sorted.length - 1) * fraction;
    const lo = Math.floor(index);
    const hi = Math.ceil(index);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
  };
  return {
    median: Math.round(q(0.5)),
    p95: Math.round(q(0.95)),
    max: sorted[sorted.length - 1]
  };
}

function buildFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-perf-mock-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const events = [];
  const spans = [];
  let seq = 1;
  for (let s = 0; s < SESSION_COUNT; s += 1) {
    const instanceId = `INST-${pad((s % INSTANCE_COUNT) + 1)}`;
    const sessionId = `${SESSION_PREFIX}${s + 1}`;
    const handoffId = `HO-${pad(s + 1)}`;
    const deliveredAt = BASE_MS + s * 1000;
    const arrivalAt = deliveredAt + LATENCIES[s];
    events.push({
      seq: seq++, ts: iso(deliveredAt), object: 'handoff', objectId: handoffId,
      from: null, to: 'delivered', result: 'applied', reason: 'handoff.delivered',
      detail: { instanceId, sessionId, handoffId, round: ROUND }
    });
    events.push({
      seq: seq++, ts: iso(arrivalAt), object: 'session', objectId: sessionId,
      reason: 'session.started', result: 'applied',
      detail: { instanceId, sessionId, handoffId, firstEvent: true, round: ROUND }
    });
    spans.push({
      trace_id: `TRC-${pad(s + 1)}`, instance_id: instanceId, node_id: `T-${pad(s + 1)}`,
      round: ROUND, start_time: iso(arrivalAt), end_time: null, status: 'running'
    });
  }

  const eventsFile = path.join(root, 'events.jsonl');
  const tracesFile = path.join(root, 'traces.jsonl');
  fs.writeFileSync(eventsFile, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(tracesFile, `${spans.map((s) => JSON.stringify(s)).join('\n')}\n`, 'utf8');
  return { root, eventsFile, tracesFile, events, spans };
}

function collected(fixture) {
  const events = fs.readFileSync(fixture.eventsFile, 'utf8').split(/\r?\n/).filter(Boolean);
  const spans = fs.readFileSync(fixture.tracesFile, 'utf8').split(/\r?\n/).filter(Boolean);
  return collectHandoffLatency({ events, spans, round: ROUND });
}

test('fixture-backed load lives under %TEMP% with NODE_ENV=test', (t) => {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(fs.existsSync(MOCK_FIXTURE), true, 'read-only mock ACP fixture must exist');
  const fixtureSource = fs.readFileSync(MOCK_FIXTURE, 'utf8');
  assert.ok(fixtureSource.includes(MOCK_AGENT), 'fixture must declare the mock agent name');
  const fixture = buildFixture(t);
  assert.equal(path.dirname(fixture.root), os.tmpdir());
  assert.equal(fixture.events.length, SESSION_COUNT * 2);
  assert.equal(fixture.spans.length, SESSION_COUNT);
  assert.equal(fs.existsSync(fixture.eventsFile), true);
});

test('AC-20: 20 concurrent instances and 50 active sessions', (t) => {
  const { samples } = collected(buildFixture(t));
  assert.equal(new Set(samples.map((s) => s.instanceId)).size, 20);
  assert.ok(new Set(samples.map((s) => s.sessionId)).size >= 50);
  assert.equal(samples.length, SESSION_COUNT);
});

test('AC-20: handoff latency under 2s and per-quantile data', (t) => {
  const result = collected(buildFixture(t));
  const numbers = result.samples.map((s) => s.latencyMs);
  assert.ok(result.stats.p95 < 2000, `P95 ${result.stats.p95}ms must be < 2s`);
  assert.ok(numbers.every((ms) => ms < 2000), 'every handoff must be under 2s');
  assert.deepEqual(result.stats, expectedStats(numbers));
  assert.ok(result.stats.median <= result.stats.p95);
  assert.ok(result.stats.p95 <= result.stats.max);
  for (const sample of result.samples) {
    assert.deepEqual(
      Object.keys(sample).sort(),
      ['handoffId', 'instanceId', 'latencyMs', 'sessionId']
    );
  }
});

test('AC-20: graded report carries mock level, ok, not blocked, no bottleneck', (t) => {
  const result = collected(buildFixture(t));
  const report = buildPerfReport({
    samples: result.samples,
    evidenceLevel: PERF_LEVELS.mock,
    target: PERF_TARGETS
  });
  assert.deepEqual(Object.keys(report).sort(), ['blocked', 'bottleneck', 'level', 'ok', 'stats']);
  assert.equal(report.level, PERF_LEVELS.mock);
  assert.equal(report.level, 'PERF_LEVEL_MOCK');
  assert.notEqual(report.level, PERF_LEVELS.real);
  assert.notEqual(report.level, 'PERF_LEVEL_REAL');
  assert.equal(report.ok, true);
  assert.equal(report.blocked, false);
  assert.equal(report.bottleneck, null);
  assert.deepEqual(report.stats, result.stats);
});

test('AC-21: three levels never mix; only uncollected real host blocks', (t) => {
  const { samples } = collected(buildFixture(t));
  const levels = [PERF_LEVELS.mock, PERF_LEVELS.real, PERF_LEVELS.pending];
  assert.equal(new Set(levels).size, 3);
  // Levels are ASCII machine keys; no user-facing Chinese value lives here.
  assert.deepEqual(PERF_LEVELS, {
    mock: 'PERF_LEVEL_MOCK',
    real: 'PERF_LEVEL_REAL',
    pending: 'PERF_LEVEL_PENDING'
  });
  const reports = levels.map((evidenceLevel) => buildPerfReport({ samples, evidenceLevel }));
  assert.deepEqual(reports.map((r) => r.blocked), [false, false, true]);
  assert.deepEqual(reports.map((r) => r.level), [
    'PERF_LEVEL_MOCK', 'PERF_LEVEL_REAL', 'PERF_LEVEL_PENDING'
  ]);
  assert.equal(reports[0].level, PERF_LEVELS.mock);
  assert.equal(reports[1].level, PERF_LEVELS.real);
  assert.equal(reports[2].level, PERF_LEVELS.pending);
  // A mock sample set never produces the real-host level on its own.
  assert.equal(buildPerfReport({ samples, evidenceLevel: PERF_LEVELS.mock }).level, PERF_LEVELS.mock);
  // Unknown level fails closed to pending -> blocked (never a false pass).
  const unknown = buildPerfReport({ samples, evidenceLevel: 'UNKNOWN' });
  assert.equal(unknown.level, PERF_LEVELS.pending);
  assert.equal(unknown.level, 'PERF_LEVEL_PENDING');
  assert.equal(unknown.blocked, true);
});

test('unmet targets localize a bottleneck without fabricating a pass', (t) => {
  const { samples } = collected(buildFixture(t));
  const fewInstances = samples.filter((s) => s.instanceId <= 'INST-010');
  assert.equal(
    buildPerfReport({ samples: fewInstances, evidenceLevel: PERF_LEVELS.mock }).bottleneck,
    PERF_BOTTLENECKS.concurrentInstancesBelowTarget
  );
  const fewSessions = samples.filter((_, i) => i < 10).map((s) => ({ ...s, instanceId: s.instanceId }));
  const distinctInstances = new Set(fewSessions.map((s) => s.instanceId)).size;
  assert.ok(distinctInstances >= 10);
  const padded = [
    ...fewSessions,
    ...Array.from({ length: 10 }, (_, i) => ({
      instanceId: `INST-${pad(i + 11)}`, sessionId: `SES-X-${pad(i)}`, latencyMs: 200
    }))
  ];
  assert.equal(
    buildPerfReport({ samples: padded, evidenceLevel: PERF_LEVELS.mock }).bottleneck,
    PERF_BOTTLENECKS.activeSessionsBelowTarget
  );
  const slow = [
    ...samples,
    ...Array.from({ length: 6 }, (_, i) => ({
      instanceId: `INST-${pad((i % 20) + 1)}`, sessionId: `SES-SLOW-${pad(i)}`, latencyMs: 2500
    }))
  ];
  assert.equal(
    buildPerfReport({ samples: slow, evidenceLevel: PERF_LEVELS.mock }).bottleneck,
    PERF_BOTTLENECKS.handoffLatencyOverBudget
  );
});

test('handoff without an arrival observation is not reported as zero', () => {
  const deliveredOnly = [
    {
      seq: 1, ts: iso(BASE_MS), object: 'handoff', objectId: 'HO-X', to: 'delivered',
      reason: 'handoff.delivered', detail: { instanceId: 'INST-001', sessionId: 'SES-X', round: 1 }
    }
  ];
  const result = collectHandoffLatency({ events: deliveredOnly, round: 1 });
  assert.deepEqual(result.samples, []);
  assert.deepEqual(result.stats, { median: null, p95: null, max: null });
});

test('span-only arrival path still produces a sample', () => {
  const events = [
    {
      seq: 1, ts: iso(BASE_MS), object: 'handoff', objectId: 'HO-S', to: 'delivered',
      reason: 'handoff.delivered', detail: { instanceId: 'INST-S', sessionId: 'SES-S', round: 2 }
    }
  ];
  const spans = [
    {
      trace_id: 'TRC-S', instance_id: 'INST-S', node_id: 'T-S', round: 2,
      start_time: iso(BASE_MS + 333), end_time: null, status: 'running'
    }
  ];
  const result = collectHandoffLatency({ events, spans, round: 2 });
  assert.equal(result.samples.length, 1);
  assert.equal(result.samples[0].latencyMs, 333);
});

test('authored perf-baseline module stays read-only and host-agnostic', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'src', 'core', 'perf-baseline.js'), 'utf8');
  for (const forbidden of ['writeFile', 'appendFile', 'unlink', '.dsh', 'bash', 'spawn(', 'exec(']) {
    assert.equal(source.includes(forbidden), false, `forbidden token in core module: ${forbidden}`);
  }
  const testSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.equal(testSource.includes('~/.dsh'), true, 'suite states the no-host boundary');
  const cjkPattern = new RegExp(`[${String.fromCharCode(0x3400)}-${String.fromCharCode(0x9fff)}]`);
  assert.equal(cjkPattern.test(testSource), false, 'no CJK literal in authored file');
});
