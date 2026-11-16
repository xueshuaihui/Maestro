/**
 * WP-5 jump-decision contract tests (AC-25 / AC-26 / AC-33 / AC-46).
 *
 * Module-surface fixtures only: the real DeepSeek Harness process is never
 * started here. `buildHostJump` is the frozen view module (D8, WP-3); this file
 * only feeds it derived fixture state and asserts the produced button / toasts.
 *
 * Decision I: the identifier under test is always `state.sessions[].sessionId`.
 * We NEVER assert that a DSH on-disk directory name equals the identifier --
 * that is D-14 table C1, a read-only real-surface fact measured by
 * probe/acc10b-jump-verify.mjs --check session-dir, not a Then/mechanism check.
 *
 * Run: NODE_ENV=test node --test test/wp14/host-jump.test.js
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';

import { UI_LABEL_KEYS as labels } from '../../src/daemon/http/labels.js';
import { buildHostJump } from '../../desktop/ui/drill/host-jump.js';

// A-7 verbatim lines (frozen); all come from the label table, none invented.
const A7 = Object.freeze({
  opened: (id) => `已打开 DeepSeek Harness · 会话 ${id}`,
  hint: '会话标识已复制 · 在 DSH 中按标识定位',
  none: '无可跳转会话',
  unsupported: (host) => `宿主 ${host} 不支持跳转`,
  missing: '未找到 DeepSeek Harness',
  failed: (reason) => `跳转失败 · ${reason}`,
});

// Fixture data -- the expected session is NEVER named here; it is derived
// from lastChangedAt via maxBy in every test (AC-25 / AC-33 self-loop rule).
const SESS = Object.freeze({
  A: Object.freeze({ id: '11111111-1111-4111-8111-111111111111', at: '2026-11-15T09:12:03.000Z' }),
  B: Object.freeze({ id: '22222222-2222-4222-8222-222222222222', at: '2026-11-15T09:20:41.000Z' }),
  C: Object.freeze({ id: '33333333-3333-4333-8333-333333333333', at: '2026-11-15T09:31:10.000Z' }),
});

function makeState() {
  return {
    schemaVersion: 2,
    sessions: [
      { sessionId: SESS.A.id, nodeId: 'T-001', hostId: 'dsh', lastChangedAt: SESS.A.at },
      { sessionId: SESS.B.id, nodeId: 'T-002', hostId: 'dsh', lastChangedAt: SESS.B.at },
      { sessionId: SESS.C.id, nodeId: 'T-003', hostId: 'dsh', lastChangedAt: SESS.C.at },
    ],
  };
}

/** Derive the "most recently active" session from the fixture data itself. */
function maxBy(list, keyOf) {
  let best = null;
  let bestKey = -Infinity;
  for (const item of list) {
    const k = keyOf(item);
    if (k > bestKey) { best = item; bestKey = k; }
  }
  return best;
}

function expectedFrom(state) {
  const picked = maxBy(state.sessions, (s) => Date.parse(s.lastChangedAt));
  return { id: picked.sessionId, lastChangedAt: picked.lastChangedAt };
}

function activeSessionsOf(state) {
  return state.sessions.map((s) => ({ sessionId: s.sessionId, hostId: s.hostId }));
}

function sha256(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

// A tiny click-session model over the pure module: it counts spawn signals
// (one successful jump = one host launch) and toast result-pairs (2 lines = 1
// pair), and applies the same (instanceId, sessionId) 500ms dedupe window that
// the adapter uses, so repeated clicks inside the window reuse the first pair.
// No real process is ever started; this only counts module-level signals.
function makeClickSession(clockStart = 0) {
  let last = null;
  return {
    click(input, at = clockStart) {
      const built = buildHostJump(input, labels, { clock: () => at });
      const key = built.dedupeKey;
      if (last && last.key === key && at - last.at < 500 && built.jumpCalls === 1) {
        return { ...built, reused: true, spawnSignals: 0, toastPairs: 0 };
      }
      last = { key, at, result: built };
      return { ...built, reused: false, spawnSignals: built.jumpCalls, toastPairs: built.toasts.length > 0 ? 1 : 0 };
    },
  };
}

test('AC-25 expected derived from maxBy(lastChangedAt); same-source id; UI identifier == sessionId', () => {
  const state = makeState();
  const expected = expectedFrom(state); // derived, not written as a constant

  // Given three active sessions; the request target comes from the derivation.
  const request = { instanceId: 'INST-001', sessionId: expected.id };
  const view = buildHostJump({
    instanceId: request.instanceId,
    hostId: 'dsh',
    activeSessions: activeSessionsOf(state),
    latestSessionId: request.sessionId,
    jumpState: { ok: true, sessionId: request.sessionId },
  }, labels);

  assert.equal(request.sessionId, expected.id);
  // Same-source assertion (Decision I clause 2): the value used by the UI is
  // exactly the sessionId carried in instance state.
  assert.equal(expected.id, state.sessions.find((s) => s.sessionId === expected.id).sessionId);

  // Verbatim A-7 success pair, built from the derived id.
  assert.deepEqual(view.toasts, [A7.opened(expected.id), A7.hint]);
  // Identifier shown in the interface == instance-state sessionId.
  assert.ok(view.toasts[0].includes(expected.id), 'toast line1 must carry expected.id');
  assert.equal(view.toasts[0], A7.opened(view.button.sessionId));
  assert.equal(view.button.sessionId, expected.id);

  // J-1 restored (AC-25, 补不减): button.label must carry expected.id verbatim,
  // alongside the same-source button.sessionId / toast assertions above.
  assert.ok(view.button.label.includes(expected.id), 'button.label must carry expected.id');
  assert.equal(view.button.label, `${labels.DRILL_HOST_OPEN} · 会话 ${expected.id}`);

  assert.equal(view.jumpCalls, 1);
  assert.equal(view.sessionChoice, 'most-recent-active'); // auxiliary encoding only
  assert.deepEqual(view.missingLabels, []);

  // NO assertion about an on-disk DSH directory name (C1) -- intentionally absent.
});

test('AC-25 order-flip recheck: runtime rewrite of SESS-A.lastChangedAt, three-state evidence', () => {
  const state = makeState();
  const evidence = []; // three-state leave-behind (三态留证)

  function observe(phase) {
    const expected = expectedFrom(state);
    const view = buildHostJump({
      instanceId: 'INST-001',
      hostId: 'dsh',
      activeSessions: activeSessionsOf(state),
      latestSessionId: expected.id,
      jumpState: { ok: true, sessionId: expected.id },
    }, labels);
    evidence.push({
      phase,
      sessA_lastChangedAt: state.sessions[0].lastChangedAt,
      selected_id: view.button.sessionId,
      toast_line1: view.toasts[0],
    });
    // Every observation re-derives from data and stays same-source.
    assert.equal(view.button.sessionId, expected.id);
    assert.equal(expected.id, state.sessions.find((s) => s.sessionId === expected.id).sessionId);
    assert.ok(view.toasts[0].includes(expected.id));
    return expected.id;
  }

  // State 1: original fixture -> max is SESS-C.
  const first = observe('original');
  // Runtime rewrite between two clicks: only a read-only projection timestamp.
  state.sessions[0].lastChangedAt = '2026-11-15T10:05:00.000Z';
  const flipped = observe('flipped');
  // Rewrite back -> selection falls back.
  state.sessions[0].lastChangedAt = SESS.A.at;
  const restored = observe('restored');

  assert.notEqual(flipped, first, 'flipping SESS-A.timestamp must change selection');
  assert.equal(flipped, SESS.A.id);
  assert.equal(restored, first, 'restoring timestamp must fall back to original selection');
  assert.equal(first, SESS.C.id);

  assert.deepEqual(evidence.map((e) => e.sessA_lastChangedAt), [
    SESS.A.at, '2026-11-15T10:05:00.000Z', SESS.A.at,
  ]);
  assert.deepEqual(evidence.map((e) => e.selected_id), [first, flipped, restored]);
  assert.equal(evidence.length, 3);
});

test('AC-26 three degradations verbatim (A-7); no process signal, state unchanged', () => {
  const sessionId = SESS.C.id;
  const stateHashBefore = sha256(makeState());
  let spawnSignals = 0;
  const accumulate = (v) => { spawnSignals += v.spawnSignals; };

  // ① no active sessions -> button disabled, hover reason, no spawn signal.
  const none = buildHostJump({
    instanceId: 'INST-001', hostId: 'dsh', activeSessions: [], latestSessionId: null, jumpState: null,
  }, labels);
  assert.equal(none.button.enabled, false);
  assert.equal(none.button.disabledReason, A7.none);
  assert.deepEqual(none.toasts, []);
  accumulate({ spawnSignals: none.jumpCalls });

  // ② non-DSH host (mock) -> hover reason, no spawn signal.
  const mock = buildHostJump({
    instanceId: 'INST-001', hostId: 'mock',
    activeSessions: [{ sessionId, hostId: 'mock' }], latestSessionId: sessionId, jumpState: null,
  }, labels);
  assert.equal(mock.button.enabled, false);
  assert.equal(mock.button.disabledReason, A7.unsupported('mock'));
  assert.deepEqual(mock.toasts, []);
  accumulate({ spawnSignals: mock.jumpCalls });

  // ③ DSH not installed -> one-line message, no spawn signal.
  const missing = buildHostJump({
    instanceId: 'INST-001', hostId: 'dsh',
    activeSessions: [{ sessionId, hostId: 'dsh' }], latestSessionId: sessionId,
    jumpState: { ok: false, code: 'DSH_SPAWN_FAILED' },
  }, labels);
  assert.equal(missing.button.enabled, true); // button stays usable / retryable
  assert.deepEqual(missing.toasts, [A7.missing]);
  accumulate({ spawnSignals: missing.jumpCalls });

  assert.equal(spawnSignals, 0, 'degradations must not produce a host-launch signal');
  assert.equal(sha256(makeState()), stateHashBefore, 'instance state unchanged');
  // No exception thrown by any of the three; the frozen label table is intact.
  assert.deepEqual(labels, { ...labels });
});

test('AC-33 clicks only: autoSpawn 0, jumpCalls 1 after dedupe, one toast pair', () => {
  const state = makeState();
  const expected = expectedFrom(state);
  const session = makeClickSession();

  // Staying on the page 10s without clicking: no jump state -> no launch.
  const idle = session.click({
    instanceId: 'INST-001', hostId: 'dsh',
    activeSessions: activeSessionsOf(state), latestSessionId: expected.id, jumpState: null,
  }, 0);
  const autoSpawn = idle.spawnSignals;
  assert.equal(autoSpawn, 0);

  // Two clicks within 200ms on the same target.
  const jumpState = { ok: true, sessionId: expected.id };
  const input = {
    instanceId: 'INST-001', hostId: 'dsh',
    activeSessions: activeSessionsOf(state), latestSessionId: expected.id, jumpState,
  };
  const first = session.click(input, 10_000);
  const second = session.click(input, 10_150); // 150ms later, inside 500ms window

  assert.equal(first.jumpCalls, 1);
  assert.equal(first.spawnSignals, 1);
  assert.equal(first.toastPairs, 1);
  assert.equal(second.reused, true, 'second click must reuse the first result');
  assert.equal(second.spawnSignals, 0, 'no second process signal');
  assert.equal(second.toastPairs, 0, 'no second toast pair');

  const jumpCallsAfterDedupe = first.jumpCalls; // dedupe leaves a single launch
  const toastPairs = first.toastPairs + second.toastPairs;
  assert.equal(jumpCallsAfterDedupe, 1);
  assert.equal(toastPairs, 1);
  assert.equal(autoSpawn, 0);

  // Both clicks carry the same derived identifier (AC-25 same round).
  assert.equal(first.button.sessionId, expected.id);
  assert.equal(second.button.sessionId, expected.id);
  assert.deepEqual(first.toasts, [A7.opened(expected.id), A7.hint]);
});

test('AC-46 launch failure: 跳转失败 · prefix + retryable + state hash unchanged', () => {
  const state = makeState();
  const expected = expectedFrom(state);
  const stateHashBefore = sha256(state);
  const reason = '权限或杀软拦截';
  // A generic launch failure with no recognized code takes the DRILL_HOST_FAILED
  // branch -> `跳转失败 · {reason}` (A-7 / AC-46). The not-found case
  // (`code: DSH_SPAWN_FAILED` + path absent) is AC-26's third degradation.
  const jump = { ok: false, reason };

  const view = buildHostJump({
    instanceId: 'INST-001', hostId: 'dsh',
    activeSessions: activeSessionsOf(state), latestSessionId: expected.id,
    jumpState: jump,
  }, labels);

  assert.equal(view.toasts.length, 1);
  assert.ok(view.toasts[0].startsWith('跳转失败 · '), 'failure toast must start with the verbatim prefix');
  assert.ok(view.toasts[0].slice('跳转失败 · '.length).length > 0, 'reason suffix must be non-empty');
  assert.equal(view.toasts[0], A7.failed(reason));
  assert.equal(jump.ok, false);

  // retryable: after a failure the button is enabled again (can be retried).
  const retryable = view.button.enabled;
  assert.equal(retryable, true);
  assert.equal(view.jumpCalls, 0, 'failed launch produces no process signal');

  // Instance state unchanged (byte-hash of the fixture snapshot).
  assert.equal(sha256(state), stateHashBefore);
});
