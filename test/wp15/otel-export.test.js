/**
 * I1.12 WP-5 / AC-18 contract: events and spans exported to the frozen OTLP
 * shape, source files and instance state untouched, no-data and bad-line
 * tolerance, and the `orch export <type>` carrier dispatch.
 *
 * Fixtures live under os.tmpdir() (%TEMP%) with NODE_ENV=test; all writes go
 * through fs.writeFile on Windows (no shell, no hardcoded bash). Every new
 * file stays ASCII-only: user-facing text belongs to labels.js.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { exportOtel, EXPORT_CODES } from '../../src/core/otel-export.js';
import { exportCommand, EXPORT_LABEL_KEYS } from '../../src/cli/otel.js';

const INSTANCE = 'INST-001';
const sha = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
const noCjk = (text) => assert.equal(/[\u3400-\u9fff]/.test(String(text)), false, 'CJK literal leaked into output');

const T0 = '2026-11-18T00:00:00.000Z';
const T1 = '2026-11-18T00:00:01.000Z';
const T2 = '2026-11-18T00:00:02.000Z';

const EVENTS = [
  { seq: 1, ts: T0, object: 'run', result: 'applied', reason: 'run.started' },
  { seq: 2, ts: T1, object: 'node', objectId: 'T-002', from: 'ready', to: 'running', result: 'applied', reason: 'state.change' },
  {
    seq: 3, ts: T2, object: 'handoff', objectId: 'HO-003', from: null, to: 'delivered',
    result: 'applied', reason: 'handoff.delivered', detail: { nodeId: 'T-002', round: 1 }
  }
];
const SPANS = [
  {
    trace_id: 'TRC-001', instance_id: INSTANCE, node_id: 'T-002', round: 1,
    start_time: T1, end_time: T2, status: 'done'
  }
];
const lines = (records) => records.map((record) => JSON.stringify(record));

function tempRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function instanceFixture(t) {
  const root = tempRoot(t, 'maestro-i112-otel-');
  const base = path.join(root, '.orch', 'instances', INSTANCE);
  const eventsFile = path.join(base, 'events.jsonl');
  const stateFile = path.join(base, 'state.json');
  const tracesFile = path.join(base, 'state', 'traces.jsonl');
  const state = { instanceId: INSTANCE, state: 'running', rev: 3, nodes: [{ nodeId: 'T-002', state: 'done' }] };
  fs.mkdirSync(path.dirname(tracesFile), { recursive: true });
  fs.writeFileSync(eventsFile, `${lines(EVENTS).join('\n')}\n`, 'utf8');
  fs.writeFileSync(tracesFile, `${lines(SPANS).join('\n')}\n`, 'utf8');
  fs.writeFileSync(stateFile, `${JSON.stringify(state)}\n`, 'utf8');
  return { root, base, eventsFile, stateFile, tracesFile, state };
}

function snapshot(files) {
  const result = {};
  for (const file of files) result[file] = sha(fs.readFileSync(file, 'utf8'));
  return result;
}

function spyFs() {
  const calls = [];
  return {
    calls,
    readFile: async (target, encoding) => {
      calls.push({ op: 'readFile', target });
      return fsp.readFile(target, encoding);
    },
    writeFile: async (target, data, encoding) => {
      calls.push({ op: 'writeFile', target });
      return fsp.writeFile(target, data, encoding);
    }
  };
}

test('exports events and spans into the frozen OTLP document', async (t) => {
  const out = path.join(tempRoot(t, 'maestro-i112-otel-out-'), 'otel.json');
  const result = await exportOtel({
    events: lines(EVENTS), spans: lines(SPANS), instanceId: INSTANCE, out, fs: fsp
  });
  assert.deepEqual(result, { ok: true, count: { events: 3, spans: 1 }, out });

  const document = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(document.resource, { instance_id: INSTANCE });
  assert.equal(document.logRecords.length, 3);
  assert.equal(document.traceSpans.length, 1);
  assert.equal(document.skipped.badLines, 0);

  const span = document.traceSpans[0];
  for (const field of ['trace_id', 'span_id', 'start_time', 'end_time', 'status', 'handoff_ids']) {
    assert.ok(Object.prototype.hasOwnProperty.call(span, field), `missing span field ${field}`);
  }
  assert.equal(span.trace_id, 'TRC-001');
  assert.equal(span.status, 'done');
  assert.deepEqual(span.handoff_ids, ['HO-003']);

  assert.equal(document.logRecords[0].severity, 'INFO');
  assert.equal(document.logRecords[0].body, 'run.started');
  assert.equal(document.logRecords[0].attributes.seq, 1);
  assert.equal(document.logRecords[2].attributes.handoffId, 'HO-003');
});

test('source files, byte hashes, event count and state are unchanged after export', async (t) => {
  const fixture = instanceFixture(t);
  const watched = [fixture.eventsFile, fixture.tracesFile, fixture.stateFile];
  const before = snapshot(watched);
  const beforeState = JSON.parse(fs.readFileSync(fixture.stateFile, 'utf8'));
  const eventCount = fs.readFileSync(fixture.eventsFile, 'utf8').split('\n').filter((l) => l.trim()).length;
  const out = path.join(fixture.root, 'export.json');
  const io = spyFs();

  const result = await exportOtel({
    events: fixture.eventsFile, spans: fixture.tracesFile,
    instanceId: INSTANCE, out, fs: io
  });
  assert.equal(result.ok, true);
  assert.deepEqual(snapshot(watched), before);
  assert.deepEqual(JSON.parse(fs.readFileSync(fixture.stateFile, 'utf8')), beforeState);
  assert.equal(
    fs.readFileSync(fixture.eventsFile, 'utf8').split('\n').filter((l) => l.trim()).length,
    eventCount
  );

  // Read-only evidence: only out is written, never an event or trace source.
  const writes = io.calls.filter((call) => call.op === 'writeFile');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].target, out);
  assert.equal(io.calls.some((call) => call.op === 'writeFile' &&
    (call.target === fixture.eventsFile || call.target === fixture.tracesFile)), false);
});

test('missing trace data yields zero spans and does not interrupt', async (t) => {
  const out = path.join(tempRoot(t, 'maestro-i112-otel-empty-'), 'otel.json');
  for (const spans of [[], null]) {
    const result = await exportOtel({ events: lines(EVENTS), spans, instanceId: INSTANCE, out, fs: fsp });
    assert.deepEqual(result, { ok: true, count: { events: 3, spans: 0 }, out });
    const document = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(document.traceSpans, []);
    assert.equal(document.logRecords.length, 3);
  }
});

test('unreadable lines are skipped and counted instead of crashing', async (t) => {
  const out = path.join(tempRoot(t, 'maestro-i112-otel-bad-'), 'otel.json');
  const brokenEvents = [JSON.stringify(EVENTS[0]), 'NOT JSON{', JSON.stringify(EVENTS[1]), '[]', 'null'];
  const brokenSpans = [JSON.stringify(SPANS[0]), 'oops'];
  const result = await exportOtel({
    events: brokenEvents, spans: brokenSpans, instanceId: INSTANCE, out, fs: fsp
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.count, { events: 2, spans: 1 });
  const document = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(document.skipped.badLines, 4);
  assert.equal(document.logRecords.length, 2);
  assert.equal(document.traceSpans.length, 1);
});

test('a missing out path is reported as a machine code, not a crash', async () => {
  const result = await exportOtel({ events: lines(EVENTS), spans: [], instanceId: INSTANCE, out: '', fs: fsp });
  assert.deepEqual(result, { ok: false, code: EXPORT_CODES.outRequired, badLines: 0 });
});

test('exportCommand dispatches events / traces / pack with labels keys only', async (t) => {
  const root = tempRoot(t, 'maestro-i112-otel-cli-');
  for (const [type, expected] of [
    ['events', { events: 3, spans: 0 }],
    ['traces', { events: 0, spans: 1 }],
    ['pack', { events: 3, spans: 1 }]
  ]) {
    const outFile = path.join(root, `${type}.json`);
    const printed = [];
    const code = await exportCommand(
      { sub: type, flags: {} },
      { cwd: root, out: (line) => printed.push(line), events: lines(EVENTS), spans: lines(SPANS), outFile, fs: fsp }
    );
    assert.equal(code, 0);
    noCjk(printed.join('\n'));
    assert.ok(printed.some((line) => line.startsWith('EXPORT OK') &&
      line.includes(`EVENTS ${expected.events}`) && line.includes(`SPANS ${expected.spans}`)));
    const document = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.equal(document.logRecords.length, expected.events);
    assert.equal(document.traceSpans.length, expected.spans);
  }
  assert.deepEqual(Object.values(EXPORT_LABEL_KEYS), ['EXPORT_DONE', 'EXPORT_FAILED', 'EXPORT_USAGE']);
});

test('exportCommand rejects an unknown type with exit 1 and no file write', async (t) => {
  const root = tempRoot(t, 'maestro-i112-otel-cli-bad-');
  const printed = [];
  const code = await exportCommand({ sub: 'nope', flags: {} }, {
    cwd: root, out: (line) => printed.push(line), fs: fsp
  });
  assert.equal(code, 1);
  noCjk(printed.join('\n'));
  assert.ok(printed.some((line) => line.startsWith('EXPORT USAGE')));
  assert.deepEqual(fs.readdirSync(root), []);
});
