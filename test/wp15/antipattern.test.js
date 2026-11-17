/**
 * I1.12 WP-5 / AC-19 contract: the three frozen anti-pattern signals carry a
 * node location, insufficient data never raises a false signal, and detection
 * is read-only (no state transition, no upgrade notice, no input mutation).
 *
 * Fixtures live under os.tmpdir() (%TEMP%) with NODE_ENV=test. All text stays
 * ASCII: human wording is a detailKey resolved by src/cli/labels.js.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  detectAntipatterns, SIGNAL_TYPES, SIGNAL_DETAIL_KEYS
} from '../../src/core/antipattern.js';

const T0 = '2026-11-18T00:00:00.000Z';
const T1 = '2026-11-18T00:01:00.000Z';
const T2 = '2026-11-18T00:02:00.000Z';
const T30 = '2026-11-18T00:30:00.000Z';
const HIGH = 10 * 60 * 60 * 1000;

const noCjk = (source) => assert.equal(/[\u3400-\u9fff]/.test(String(source)), false, 'CJK literal in new file');
const genericEvents = () => [
  { seq: 1, ts: T0, object: 'run', result: 'applied', reason: 'run.started' },
  { seq: 2, ts: T1, object: 'node', objectId: 'A', result: 'applied', reason: 'state.change' }
];

function docFixture() {
  return {
    graph: { nodes: [{ id: 'T-001', node_type: 'document' }], edges: [] },
    state: {
      instanceId: 'INST-DOC', nodes: [{ nodeId: 'T-001', state: 'review', artifact_type: 'document', startedAt: T0 }]
    },
    traces: [
      { node_id: 'T-001', round: 1, start_time: T0, end_time: T1, status: 'running' },
      { node_id: 'T-001', round: 2, start_time: T1, end_time: T2, status: 'done' }
    ],
    events: genericEvents(),
    config: { now: T30, docDwellMs: 10 * 60 * 1000, minSamples: 2, agreementCount: 99 }
  };
}

function serializationFixture() {
  return {
    graph: { nodes: [{ id: 'A' }, { id: 'B' }], edges: [] },
    state: {
      instanceId: 'INST-SER',
      nodes: [{ nodeId: 'A', state: 'done' }, { nodeId: 'B', state: 'done' }]
    },
    traces: [
      { node_id: 'A', round: 1, start_time: T0, end_time: T1, status: 'done' },
      { node_id: 'B', round: 1, start_time: T1, end_time: T2, status: 'done' },
      { node_id: 'A', round: 2, start_time: T2, end_time: T30, status: 'done' }
    ],
    events: genericEvents(),
    config: { minSamples: 2, agreementCount: 99, docDwellMs: HIGH }
  };
}

function confirmationFixture() {
  const agree = (seq) => ({
    seq, ts: T0, object: 'node', objectId: 'T-004', reason: 'verdict.recorded',
    detail: { verdict: 'approve', upstreamVerdict: 'approve', evidenceRefs: [] }
  });
  return {
    graph: { nodes: [{ id: 'T-004', node_type: 'review' }], edges: [] },
    state: { instanceId: 'INST-CONF', nodes: [{ nodeId: 'T-004', state: 'done' }] },
    traces: [{ node_id: 'T-004', round: 1, start_time: T0, end_time: T1, status: 'done' }],
    events: [agree(1), agree(2), agree(3), genericEvents()[0]],
    config: { minSamples: 2, agreementCount: 3, docDwellMs: HIGH, now: T1 }
  };
}

test('document bottleneck hits exactly once with instance and node location', () => {
  const result = detectAntipatterns(docFixture());
  assert.equal(result.insufficientData, false);
  assert.deepEqual(result.signals, [{
    type: SIGNAL_TYPES.docBottleneck,
    instanceId: 'INST-DOC',
    nodeId: 'T-001',
    detailKey: SIGNAL_DETAIL_KEYS.docBottleneck
  }]);
});

test('serialization regression hits the later independent node with location', () => {
  const result = detectAntipatterns(serializationFixture());
  assert.equal(result.insufficientData, false);
  assert.deepEqual(result.signals, [{
    type: SIGNAL_TYPES.serializationRegression,
    instanceId: 'INST-SER',
    nodeId: 'B',
    detailKey: SIGNAL_DETAIL_KEYS.serializationRegression
  }]);
});

test('confirmation bias hits the review node after repeated agreement', () => {
  const result = detectAntipatterns(confirmationFixture());
  assert.equal(result.insufficientData, false);
  assert.deepEqual(result.signals, [{
    type: SIGNAL_TYPES.confirmationBias,
    instanceId: 'INST-CONF',
    nodeId: 'T-004',
    detailKey: SIGNAL_DETAIL_KEYS.confirmationBias
  }]);
});

test('insufficient data produces the prompt shape and no signal', () => {
  const result = detectAntipatterns({
    graph: { nodes: [{ id: 'T-001', node_type: 'document' }], edges: [] },
    state: { instanceId: 'INST-FEW', nodes: [{ nodeId: 'T-001', state: 'review' }] },
    traces: [],
    events: [genericEvents()[0]],
    config: { minSamples: 2, now: T30 }
  });
  assert.equal(result.insufficientData, true);
  assert.deepEqual(result.signals, []);
  assert.equal(result.signals.some((s) => Object.values(SIGNAL_TYPES).includes(s.type)), false);
});

test('all three signals coexist with their own node locations', () => {
  const agree = (seq) => ({
    seq, ts: T0, object: 'node', objectId: 'R', reason: 'verdict.recorded',
    detail: { verdict: 'yes', upstreamVerdict: 'yes', independentEvidence: false }
  });
  const result = detectAntipatterns({
    graph: {
      nodes: [
        { id: 'D', node_type: 'document' }, { id: 'A' }, { id: 'B' }, { id: 'R', node_type: 'review' }
      ],
      edges: []
    },
    state: {
      instanceId: 'INST-MIX',
      nodes: [
        { nodeId: 'D', state: 'review', artifact_type: 'document', startedAt: T0 },
        { nodeId: 'A', state: 'done' }, { nodeId: 'B', state: 'done' }, { nodeId: 'R', state: 'done' }
      ]
    },
    traces: [
      { node_id: 'A', round: 1, start_time: T0, end_time: T1, status: 'done' },
      { node_id: 'B', round: 1, start_time: T1, end_time: T2, status: 'done' },
      { node_id: 'D', round: 2, start_time: T2, end_time: T30, status: 'done' },
      { node_id: 'R', round: 3, start_time: T2, end_time: T30, status: 'done' }
    ],
    events: [agree(1), agree(2), agree(3)],
    config: { minSamples: 2, agreementCount: 3, docDwellMs: 10 * 60 * 1000, now: T30 }
  });
  assert.equal(result.insufficientData, false);
  assert.deepEqual(result.signals.map((s) => s.type).sort(), Object.values(SIGNAL_TYPES).sort());
  for (const signal of result.signals) {
    assert.equal(signal.instanceId, 'INST-MIX');
    assert.ok(typeof signal.nodeId === 'string' && signal.nodeId.length > 0);
    assert.ok(Object.values(SIGNAL_DETAIL_KEYS).includes(signal.detailKey));
  }
});

test('detection is read-only and the source carries no transition call', () => {
  const fixture = docFixture();
  const before = JSON.stringify({
    graph: fixture.graph, state: fixture.state, traces: fixture.traces, events: fixture.events
  });
  const result = detectAntipatterns(fixture);
  assert.equal(result.signals.length, 1);
  assert.equal(JSON.stringify({
    graph: fixture.graph, state: fixture.state, traces: fixture.traces, events: fixture.events
  }), before);

  const source = fs.readFileSync(new URL('../../src/core/antipattern.js', import.meta.url), 'utf8');
  assert.equal(/emit\(|transit\(|escalat/.test(source), false, 'forbidden transition call in signal module');
  noCjk(source);
});
