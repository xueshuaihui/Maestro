/**
 * Desktop daemon connection state machine (I1.10a WP-8; requirement A-4 /
 * AC-30 / F-17, split doc 2.2).
 *
 * Four visible states plus the initial idle state:
 *   idle -> connecting -> ready
 *                  \-> failed          (timeout, A-4 third line)
 *   ready -> reconnecting -> ready      (drop and recover)
 *                        \-> failed      (timeout while recovering)
 *
 * The first visible line of a cold start is always `connecting`
 * (`DESKTOP_CONN_CONNECTING`), even when the transport rejects at once: a
 * refused socket records the error and keeps the transient line until the
 * injected clock reports more than `timeoutMs` (10 s) elapsed, and only then
 * flips to `failed` (`DESKTOP_CONN_FAILED`). That is the F-17 transient:
 * the wording is a state of this machine, not a timer living in the view.
 *
 * The clock is injected (`now`), so tests advance time instead of waiting:
 * at `timeoutMs` the state is still `connecting`, at `timeoutMs + 1` it is
 * `failed`. No `setTimeout` lives here and no wall clock is read when a clock
 * is supplied.
 *
 * Content preservation is a state property, not a buffer: `reconnecting` and
 * `failed` report `keepsContent() === true`, so the view keeps the last graph
 * on screen while the channel recovers and replaces it with the next full
 * snapshot. This module owns no DOM and no network: `connect` is an injected
 * attempt hook and every transition is also reachable explicitly.
 *
 * Zero CJK: the three lines are read from the `/ui/labels` table at render
 * time through `resolveLabels`, never copied into this file.
 */

import { resolveLabels } from './labels/labels.js';

/** F-17 / A-4: a cold start degrades to `failed` after ten seconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Label key per visible state (`null` means "no line"). */
export const CONNECTION_TEXT_KEY = Object.freeze({
  idle: null,
  connecting: 'DESKTOP_CONN_CONNECTING',
  ready: null,
  reconnecting: 'DESKTOP_CONN_RECONNECTING',
  failed: 'DESKTOP_CONN_FAILED',
});

const PENDING = new Set(['connecting', 'reconnecting']);

function asClock(now) {
  return typeof now === 'function' ? now : () => Date.now();
}

/**
 * @param {object} [options]
 * @param {Function} [options.connect] optional attempt hook; a rejection is
 *        recorded but never short-circuits the `connecting` transient
 * @param {Function} [options.now] injected clock in milliseconds
 * @param {number} [options.timeoutMs] transient budget (default 10 s)
 * @returns {object} the state machine
 */
export function createConnectionState({ connect, now, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const clock = asClock(now);
  const budget = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

  let status = 'idle';
  let startedAt = null;
  let attempts = 0;
  let reconnects = 0;
  let lastError = null;

  function attempt() {
    if (typeof connect !== 'function') return;
    Promise.resolve()
      .then(() => connect())
      .then(() => {
        // A late success only counts while the machine is still waiting.
        if (PENDING.has(status)) markReady();
      })
      .catch((error) => {
        lastError = error?.message ?? String(error);
        // Deliberately keep the pending state: the visible transient owns
        // the first ten seconds (F-17), `tick()` performs the transition.
      });
  }

  function markReady() {
    status = 'ready';
    startedAt = null;
    return status;
  }

  function markFailed() {
    status = 'failed';
    startedAt = null;
    return status;
  }

  return {
    /** Current state name. */
    status: () => status,
    /** Epoch of the current waiting window (`null` outside a wait). */
    startedAt: () => startedAt,
    /** Number of cold attempts. */
    attempts: () => attempts,
    /** Number of recovery windows entered. */
    reconnects: () => reconnects,
    /** Last transport error text, for diagnostics only. */
    lastError: () => lastError,
    /** Waiting for a first (or next) connection. */
    isPending: () => PENDING.has(status),
    /** The failure line offers a retry. */
    canRetry: () => status === 'failed',
    /** Last content stays on screen (no blank page on a drop). */
    keepsContent: () => status === 'reconnecting' || status === 'failed',
    /** Label key of the current line, or `null` when there is nothing to show. */
    textKey: () => CONNECTION_TEXT_KEY[status] ?? null,

    /**
     * Enter the first waiting window. A second call while connecting or
     * ready is a no-op, so a remount never resets a live channel.
     */
    begin() {
      if (status === 'connecting' || status === 'ready') return status;
      status = 'connecting';
      startedAt = clock();
      attempts += 1;
      lastError = null;
      attempt();
      return status;
    },

    /** Transport confirmed the channel (full snapshot may follow). */
    markReady() {
      return markReady();
    },

    /** Force the failure line (used by the caller for terminal errors). */
    markFailed() {
      return markFailed();
    },

    /**
     * The stream dropped after a ready state: keep the content and show the
     * reconnecting line (A-4 second line, AC-08 / AC-30).
     */
    disconnect() {
      if (status !== 'ready') return status;
      status = 'reconnecting';
      startedAt = clock();
      reconnects += 1;
      // No automatic attempt here: the caller owns the transport and calls
      // `retry()` (or `markReady()` when the stream reconnects by itself).
      return status;
    },

    /**
     * Advance the waiting window. Returns the state after the check so a
     * caller can decide whether to repaint. At exactly `timeoutMs` the state
     * is unchanged; only a strictly greater elapsed time fails (F-17).
     */
    tick(at) {
      if (!PENDING.has(status) || startedAt === null) return status;
      const moment = Number.isFinite(at) ? at : clock();
      if (moment - startedAt > budget) {
        status = 'failed';
        startedAt = null;
      }
      return status;
    },

    /** Failure -> connecting, with a fresh window (retry control). */
    retry() {
      if (status !== 'failed') return status;
      status = 'connecting';
      startedAt = clock();
      attempts += 1;
      lastError = null;
      attempt();
      return status;
    },

    /**
     * Visible line for the current state, resolved through the label table
     * (`flat keys` or `{ keys }` payload). `null` when there is no line.
     */
    text(labels) {
      const key = CONNECTION_TEXT_KEY[status] ?? null;
      if (key === null) return null;
      return resolveLabels(labels).get(key);
    },
  };
}
