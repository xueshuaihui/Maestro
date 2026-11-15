/**
 * WP-2 contract tests for the ACP recovery dialect (split doc 2.4 / freeze
 * point 3 / D-4). Pure in-memory transport stub: no spawn, no core, no
 * ~/.dsh. A %TEMP% root is created for the cwd argument and removed at the
 * end; nothing is written into the repository.
 *
 * Verbatim anchors: AC-19 (resume 1 / load 0 / prompt 0), AC-20 (load 1 /
 * resume 0 / prompt 0, replay frames consumed but not re-delivered), AC-21
 * (new 1 / prompt 1 current round only), AC-22 (order resume -> load, new 0),
 * AC-23 (all fail -> SESSION_RESTORE_FAILED, no new session), AC-25 capability
 * advertisement checks (four groups + no hostId branching).
 */
import test from 'node:test';
import { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createAcpClient,
  normalizeCapabilities,
  canResume,
  canLoad,
} from '../../src/adapter/acp-client.js';

const LIMITS = {
  requestTimeoutMs: 1000,
  initializeTimeoutMs: 1000,
  promptTimeoutMs: 1000,
  quietIdleMs: 1,
  quietCapMs: 3,
};

const SESSION_CAPS_RESUME = { close: {}, list: {}, resume: {} };

// Four capability advertisements, shaped like an initialize RPC result.
const ADS = {
  resume: {
    protocolVersion: 1,
    agentInfo: { name: 'agent', version: '1' },
    agentCapabilities: { sessionCapabilities: SESSION_CAPS_RESUME },
    authMethods: [],
  },
  load: {
    protocolVersion: 1,
    loadSession: true,
    agentCapabilities: { sessionCapabilities: { close: {}, list: {} } },
    authMethods: [],
  },
  both: {
    protocolVersion: 1,
    loadSession: true,
    agentCapabilities: { sessionCapabilities: SESSION_CAPS_RESUME },
    authMethods: [],
  },
  none: {
    protocolVersion: 1,
    agentCapabilities: { sessionCapabilities: { close: {}, list: {} } },
    authMethods: [],
  },
};

let TMP_ROOT;
before(async () => {
  TMP_ROOT = await fs.mkdtemp(path.join(os.tmpdir(), 'maestro-wp2-'));
});
after(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
});

function makeTransport({
  ad = ADS.none,
  resumeFail = false,
  loadFail = false,
  newFail = false,
  replay = 2,
} = {}) {
  const calls = [];
  const messageCbs = new Set();
  const exitCbs = new Set();
  let sessionSeq = 0;

  const hostError = (message) => ({ code: -32603, message });

  function respond(obj) {
    switch (obj.method) {
      case 'initialize':
        return { jsonrpc: '2.0', id: obj.id, result: ad };
      case 'session/resume':
        return resumeFail
          ? { jsonrpc: '2.0', id: obj.id, error: hostError('resume failed') }
          : { jsonrpc: '2.0', id: obj.id, result: { sessionId: obj.params?.sessionId } };
      case 'session/load':
        return loadFail
          ? { jsonrpc: '2.0', id: obj.id, error: hostError('load failed') }
          : { jsonrpc: '2.0', id: obj.id, result: { sessionId: obj.params?.sessionId } };
      case 'session/new':
        return newFail
          ? { jsonrpc: '2.0', id: obj.id, error: hostError('new failed') }
          : {
            jsonrpc: '2.0',
            id: obj.id,
            result: { sessionId: `sess-${(sessionSeq += 1)}`, configOptions: [] },
          };
      case 'session/prompt':
        return { jsonrpc: '2.0', id: obj.id, result: { stopReason: 'end_turn' } };
      case 'session/close':
        return { jsonrpc: '2.0', id: obj.id, result: {} };
      case 'session/list':
        return { jsonrpc: '2.0', id: obj.id, result: { sessions: [] } };
      default:
        return { jsonrpc: '2.0', id: obj.id, error: { code: -32601, message: 'unsupported' } };
    }
  }

  const transport = {
    send(obj) {
      calls.push({ id: obj.id, method: obj.method, params: obj.params });
      if (obj.id === undefined) return Promise.resolve(); // notification (cancel)
      const reply = respond(obj);
      queueMicrotask(() => {
        for (const cb of messageCbs) cb(reply);
        if (obj.method === 'session/load' && !loadFail) {
          for (let i = 0; i < replay; i += 1) {
            const frame = {
              jsonrpc: '2.0',
              method: 'session/update',
              params: {
                sessionId: obj.params?.sessionId,
                update: {
                  sessionUpdate: 'agent_message_chunk',
                  content: { type: 'text', text: `replay-${i}` },
                },
              },
            };
            for (const cb of messageCbs) cb(frame);
          }
        }
      });
      return Promise.resolve();
    },
    onMessage(cb) {
      messageCbs.add(cb);
      return () => messageCbs.delete(cb);
    },
    onExit(cb) {
      exitCbs.add(cb);
      return () => exitCbs.delete(cb);
    },
    dispose() {
      messageCbs.clear();
      exitCbs.clear();
      return Promise.resolve();
    },
  };

  return { transport, calls };
}

async function drive({ ad = ADS.none, policy = 'reuse', caps, currentPrompt, stub = {} } = {}) {
  const { transport, calls } = makeTransport({ ad, ...stub });
  const client = createAcpClient({ transport, limits: LIMITS });
  const updates = [];
  const off = client.onUpdate((u) => updates.push(u));
  const initRes = await client.initialize();
  assert.equal(initRes.ok, true);
  const result = await client.resumeOrCreate({
    cwd: TMP_ROOT,
    sessionId: 'sess-003',
    policy,
    capabilities: caps !== undefined ? caps : initRes.result,
    currentPrompt,
  });
  off();
  const methods = calls.map((c) => c.method);
  const count = (m) => methods.filter((x) => x === m).length;
  await client.dispose();
  return { client, result, calls, methods, count, updates };
}

test('exports: the six dialect capabilities are reachable', () => {
  const { transport } = makeTransport();
  const client = createAcpClient({ transport, limits: LIMITS });
  for (const name of [
    'normalizeCapabilities', 'canResume', 'canLoad',
    'resumeSession', 'loadSession', 'resumeOrCreate',
  ]) {
    assert.equal(typeof client[name], 'function', `missing method: ${name}`);
  }
  assert.equal(typeof normalizeCapabilities, 'function');
  assert.equal(typeof canResume, 'function');
  assert.equal(typeof canLoad, 'function');
});

test('AC-25 capability advertisement checks (four groups)', () => {
  const resume = normalizeCapabilities(ADS.resume);
  assert.equal(resume.canResume, true);
  assert.equal(resume.canLoad, false);
  assert.deepEqual(Object.keys(resume.sessionCapabilities).sort(), ['close', 'list', 'resume']);
  assert.equal(Object.hasOwn(resume.sessionCapabilities, 'load'), false);

  const load = normalizeCapabilities(ADS.load);
  assert.equal(ADS.load.loadSession, true);
  assert.equal(load.canLoad, true);
  assert.equal(load.canResume, false);

  const both = normalizeCapabilities(ADS.both);
  assert.equal(both.canResume, true);
  assert.equal(both.canLoad, true);

  const none = normalizeCapabilities(ADS.none);
  assert.equal(none.canResume, false);
  assert.equal(none.canLoad, false);

  assert.equal(canResume(ADS.resume), resume.canResume);
  assert.equal(canLoad(ADS.load), load.canLoad);
  assert.equal(canResume(ADS.none), false);
  assert.equal(canLoad(ADS.none), false);
});

test('C-07 / BR-23: dialect selection does not branch on hostId', async () => {
  const variants = ['dsh', 'dsh-acp-server', 'third-party', 'anything-else'];
  const results = [];
  for (const hostId of variants) {
    const ad = { ...ADS.both, hostId, agentInfo: { name: hostId, version: '1' } };
    const norm = normalizeCapabilities(ad);
    const run = await drive({ ad });
    results.push({
      canResume: norm.canResume,
      canLoad: norm.canLoad,
      dialect: run.result.dialect,
      methods: run.methods.join(','),
    });
  }
  const baseline = JSON.stringify(results[0]);
  for (const r of results) assert.equal(JSON.stringify(r), baseline);
  assert.equal(results[0].dialect, 'resume');
  assert.equal(results[0].canResume, true);
  assert.equal(results[0].canLoad, true);
});

test('AC-19: resume advertisement -> session/resume once, no load, no prompt', async () => {
  const run = await drive({ ad: ADS.resume });
  assert.deepEqual(run.result, {
    restored: true,
    dialect: 'resume',
    attempts: [{ dialect: 'resume', ok: true }],
  });
  assert.equal(run.count('session/resume'), 1);
  assert.equal(run.count('session/load'), 0);
  assert.equal(run.count('session/new'), 0);
  assert.equal(run.count('session/prompt'), 0);
});

test('AC-19 / C-08: resume never replays history, even with a current prompt supplied', async () => {
  const run = await drive({ ad: ADS.resume, currentPrompt: ['should not be sent'] });
  assert.equal(run.result.dialect, 'resume');
  assert.equal(run.count('session/prompt'), 0);
});

test('AC-20: load advertisement -> load once, replay frames consumed, no re-delivery', async () => {
  const run = await drive({ ad: ADS.load, stub: { replay: 3 } });
  assert.equal(run.result.restored, true);
  assert.equal(run.result.dialect, 'load');
  assert.equal(run.count('session/load'), 1);
  assert.equal(run.count('session/resume'), 0);
  assert.equal(run.count('session/prompt'), 0);
  assert.equal(run.updates.length, 3);
  assert.ok(run.updates.every((u) => String(u.update?.content?.text ?? '').startsWith('replay-')));
});

test('AC-20 / C-08: load never re-delivers, even with a current prompt supplied', async () => {
  const run = await drive({ ad: ADS.load, currentPrompt: ['should not be sent'], stub: { replay: 1 } });
  assert.equal(run.result.dialect, 'load');
  assert.equal(run.count('session/prompt'), 0);
});

test('AC-21: no advertisement -> session/new once + current round prompt once', async () => {
  const currentPrompt = [{ type: 'text', text: 'current round task' }];
  const run = await drive({ ad: ADS.none, currentPrompt });
  assert.equal(run.result.restored, false);
  assert.equal(run.result.dialect, 'new');
  assert.equal(run.count('session/new'), 1);
  assert.equal(run.count('session/prompt'), 1);
  assert.equal(run.count('session/resume'), 0);
  assert.equal(run.count('session/load'), 0);
  const promptCall = run.calls.find((c) => c.method === 'session/prompt');
  assert.equal(promptCall.params.prompt[0].text, 'current round task');
});

test('AC-22: resume fails -> fallback to load, order observable, new never used', async () => {
  const run = await drive({ ad: ADS.both, stub: { resumeFail: true } });
  assert.equal(run.result.restored, true);
  assert.equal(run.result.dialect, 'load');
  assert.deepEqual(run.result.attempts.map((a) => a.dialect), ['resume', 'load']);
  assert.equal(run.count('session/resume'), 1);
  assert.equal(run.count('session/load'), 1);
  assert.equal(run.count('session/new'), 0);
  const detail = run.result.attempts[0].detail;
  assert.deepEqual(Object.keys(detail).sort(), ['from', 'reason', 'to']);
  assert.equal(detail.from, 'resume');
  assert.equal(detail.to, 'load');
  assert.equal(typeof detail.reason, 'string');
});

test('AC-23: all three dialects fail -> SESSION_RESTORE_FAILED, no new session', async () => {
  const run = await drive({
    ad: ADS.both,
    stub: { resumeFail: true, loadFail: true, newFail: true },
  });
  assert.equal(run.result.ok, false);
  assert.equal(run.result.code, 'SESSION_RESTORE_FAILED');
  assert.ok(Array.isArray(run.result.attempts));
  assert.deepEqual(run.result.attempts.map((a) => a.dialect), ['resume', 'load', 'new']);
  assert.equal(run.result.attempts[2].ok, false);
  assert.equal(run.count('session/new'), 1);
  assert.equal(run.count('session/prompt'), 0);
  assert.equal(run.result.restored, undefined);
  assert.equal(run.result.dialect, undefined);
});

test('each rollback produces a serializable {from,to,reason} detail', async () => {
  const run = await drive({ ad: ADS.both, stub: { resumeFail: true, loadFail: true } });
  assert.equal(run.result.dialect, 'new');
  const details = run.result.attempts.filter((a) => a.detail).map((a) => a.detail);
  assert.equal(details.length, 2);
  assert.equal(details[0].from, 'resume');
  assert.equal(details[0].to, 'load');
  assert.equal(details[1].from, 'load');
  assert.equal(details[1].to, 'new');
  for (const d of details) {
    assert.deepEqual(Object.keys(d).sort(), ['from', 'reason', 'to']);
    assert.doesNotThrow(() => JSON.stringify(d));
  }
});

test('D-4: fresh policy goes straight to session/new', async () => {
  const run = await drive({ ad: ADS.both, policy: 'fresh' });
  assert.equal(run.result.dialect, 'new');
  assert.equal(run.result.restored, false);
  assert.equal(run.count('session/resume'), 0);
  assert.equal(run.count('session/load'), 0);
  assert.equal(run.count('session/new'), 1);
});

test('resumeOrCreate falls back to the cached initialize result when capabilities is omitted', async () => {
  const { transport, calls } = makeTransport({ ad: ADS.resume });
  const client = createAcpClient({ transport, limits: LIMITS });
  await client.initialize();
  const result = await client.resumeOrCreate({
    cwd: TMP_ROOT,
    sessionId: 'sess-003',
    policy: 'reuse',
  });
  assert.equal(result.dialect, 'resume');
  assert.equal(calls.filter((c) => c.method === 'session/resume').length, 1);
  await client.dispose();
});

test('normalizeCapabilities: idempotent and tolerant of several input shapes', () => {
  assert.deepEqual(normalizeCapabilities(null), {
    canResume: false,
    canLoad: false,
    sessionCapabilities: {},
  });
  const once = normalizeCapabilities(ADS.both);
  assert.deepEqual(normalizeCapabilities(once), once);
  assert.equal(normalizeCapabilities({ sessionCapabilities: { load: {} } }).canLoad, true);
  assert.equal(
    normalizeCapabilities({ ok: true, result: { raw: ADS.resume, sessionCapabilities: {} } }).canResume,
    true,
  );
});

test('existing newSession/prompt/cancel/closeSession behavior unchanged', async () => {
  const { transport, calls } = makeTransport({ ad: ADS.resume });
  const client = createAcpClient({ transport, limits: LIMITS });
  await client.initialize();
  const ns = await client.newSession({ cwd: TMP_ROOT, mcpServers: [] });
  assert.equal(ns.ok, true);
  assert.equal(typeof ns.result.sessionId, 'string');

  const pr = await client.prompt(ns.result.sessionId, 'hi');
  assert.equal(pr.ok, true);
  assert.equal(pr.result.stopReason, 'end_turn');

  const cc = await client.cancel(ns.result.sessionId);
  assert.equal(cc.ok, true);

  const cl = await client.closeSession(ns.result.sessionId);
  assert.equal(cl.ok, true);

  const methods = calls.map((c) => c.method);
  for (const m of ['session/new', 'session/prompt', 'session/cancel', 'session/close']) {
    assert.ok(methods.includes(m), `missing method: ${m}`);
  }
  const cancelCall = calls.find((c) => c.method === 'session/cancel');
  assert.equal(cancelCall.id, undefined); // notification: no id, no response
  await client.dispose();
});
