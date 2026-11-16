/**
 * Host-jump view module (I1.10b WP-3, contract D8).
 *
 * This module only describes what the button and the result lines should say.
 * It never starts a process and never polls: all state comes from the injected
 * jump result and clock. Repeated clicks with the same target reuse the first
 * result instead of producing a second launch signal.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const CODE_KEY = Object.freeze({
  HOST_UNSUPPORTED: 'DRILL_HOST_UNSUPPORTED',
  DSH_SPAWN_FAILED: 'DRILL_HOST_MISSING',
});
const HOST_TOKEN = 'dsh';

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function sessionTag(resolver, id, missing) {
  const text = resolver.get('DRILL_HOST_OPENED');
  if (text === null) {
    if (!missing.includes('DRILL_HOST_OPENED')) missing.push('DRILL_HOST_OPENED');
    return id;
  }
  const at = text.indexOf('{id}');
  if (at === -1) return text;
  const sep = text.lastIndexOf(' · ', at);
  // Keep the `{id}` placeholder in the extracted part so fillTemplate can
  // substitute it; slicing up to `at` truncated the placeholder and dropped
  // the identifier from button.label (decision J-1).
  const part = sep === -1 ? text.slice(0) : text.slice(sep + 3);
  return fillTemplate(part, { id });
}

export function buildHostJump(input, labels, options = {}) {
  const source = input !== null && typeof input === 'object' ? input : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const clock = typeof options.clock === 'function' ? options.clock : () => 0;
  const sessions = Array.isArray(source.activeSessions) ? source.activeSessions : [];
  const hostId = typeof source.hostId === 'string' ? source.hostId : '';
  const jumpState = source.jumpState ?? null;
  const sessionId = typeof source.latestSessionId === 'string'
    ? source.latestSessionId
    : (sessions.length > 0 ? (sessions[0]?.sessionId ?? null) : null);

  const toasts = [];
  let disabledReason = null;
  let enabled = false;

  if (sessions.length === 0) {
    disabledReason = take(resolver, 'DRILL_HOST_NONE', {}, missingLabels);
  } else if (hostId !== HOST_TOKEN) {
    disabledReason = take(resolver, 'DRILL_HOST_UNSUPPORTED', { host: hostId }, missingLabels);
  } else {
    enabled = true;
  }

  const code = jumpState && typeof jumpState.code === 'string' ? jumpState.code : null;
  if (jumpState !== null && jumpState.ok === true) {
    toasts.push(take(resolver, 'DRILL_HOST_OPENED', { id: jumpState.sessionId ?? sessionId ?? '' }, missingLabels));
    toasts.push(take(resolver, 'DRILL_HOST_HINT', {}, missingLabels));
  } else if (code !== null && code !== 'DSH_SPAWN_FAILED') {
    toasts.push(take(resolver, CODE_KEY[code] ?? 'DRILL_HOST_FAILED', {
      host: hostId,
      reason: jumpState?.reason ?? '',
    }, missingLabels));
  } else if (code === 'DSH_SPAWN_FAILED') {
    toasts.push(take(resolver, 'DRILL_HOST_MISSING', {}, missingLabels));
  } else if (jumpState !== null && jumpState.ok === false) {
    toasts.push(take(resolver, 'DRILL_HOST_FAILED', {
      reason: jumpState.reason ?? '',
    }, missingLabels));
  }

  const openText = take(resolver, 'DRILL_HOST_OPEN', {}, missingLabels);
  const label = enabled && sessionId !== null
    ? `${openText} · ${sessionTag(resolver, sessionId, missingLabels)}`
    : openText;

  const key = `${source.instanceId ?? ''}:${sessionId ?? ''}`;
  return {
    button: {
      enabled,
      disabledReason,
      label,
      sessionId: sessionId ?? null,
    },
    toasts,
    jumpCalls: jumpState !== null && jumpState.ok === true ? 1 : 0,
    sessionChoice: 'most-recent-active',
    dedupeKey: key,
    dedupeAt: clock(),
    missingLabels,
  };
}

export default buildHostJump;
