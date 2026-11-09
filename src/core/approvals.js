/**
 * Approval rows (requirement D-5 / split-doc section 2.8).
 *
 * Pure in-memory helpers: they never touch disk. The caller owns the single CAS
 * that persists the row together with the session change (section 1.5). Judging
 * whether a session can still answer lives here too, so a core restart never
 * writes `approved` without the in-memory `respond` handle (AC-67 / D-5.9).
 *
 * No display text, no graph literal and no host literal lives in this module.
 */

const defaultNow = () => Date.now();

export const APPROVAL_SESSION_GONE = 'APPROVAL_SESSION_GONE';
export const APPROVAL_NOT_PENDING = 'APPROVAL_NOT_PENDING';
export const APPROVAL_DECISION_INVALID = 'APPROVAL_DECISION_INVALID';

function isoOf(now) {
  const value = typeof now === 'function' ? now() : now;
  const ms = typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
  return new Date(ms).toISOString();
}

/** APR-nnn, monotonic inside one instance, never reused (C-11). */
export function nextApprovalId(approvals) {
  let max = 0;
  for (const entry of Array.isArray(approvals) ? approvals : []) {
    const match = /^APR-(\d+)$/.exec(entry?.approvalId ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `APR-${String(max + 1).padStart(3, '0')}`;
}

export function buildApproval({
  approvals = [],
  instanceId = null,
  nodeId = null,
  sessionId = null,
  action = null,
  toolCallId = null,
  now = defaultNow,
} = {}) {
  return {
    approvalId: nextApprovalId(approvals),
    instanceId,
    nodeId,
    sessionId,
    action,
    toolCallId: toolCallId ?? null,
    state: 'pending',
    createdAt: isoOf(now),
    resolvedAt: null,
    resolution: null,
  };
}

export function findApproval(approvals, approvalId) {
  if (typeof approvalId !== 'string' || approvalId.length === 0) return null;
  return (
    (Array.isArray(approvals) ? approvals : []).find(
      (entry) => entry?.approvalId === approvalId,
    ) ?? null
  );
}

export function pendingForSession(approvals, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return [];
  return (Array.isArray(approvals) ? approvals : []).filter(
    (entry) => entry?.state === 'pending' && entry?.sessionId === sessionId,
  );
}

/** Decide one pending row in memory. Returns a code on any invalid move. */
export function decideApproval(entry, decision, atIso = null) {
  if (!entry || entry.state !== 'pending') return { ok: false, code: APPROVAL_NOT_PENDING };
  const state = decision === 'allow' ? 'approved' : decision === 'deny' ? 'denied' : null;
  if (state === null) return { ok: false, code: APPROVAL_DECISION_INVALID };
  entry.state = state;
  entry.resolution = decision;
  entry.resolvedAt = atIso ?? isoOf(defaultNow);
  return { ok: true, state, resolution: decision };
}

/** All pending rows become withdrawn (cancel). Returns the changed rows. */
export function withdrawPending(approvals, atIso = null) {
  const changed = [];
  for (const entry of Array.isArray(approvals) ? approvals : []) {
    if (entry?.state !== 'pending') continue;
    entry.state = 'withdrawn';
    entry.resolvedAt = atIso ?? isoOf(defaultNow);
    changed.push(entry);
  }
  return changed;
}

/**
 * Section 1.5 / D-5.9: the in-memory `respond` handle is the ONLY thing that
 * can actually release the host. Without it (core restart) an approval must
 * stay pending and the caller returns APPROVAL_SESSION_GONE.
 */
export function approvalSessionCheck(entry, ctxPermission) {
  if (!entry || entry.state !== 'pending') return { ok: false, code: APPROVAL_NOT_PENDING };
  if (!ctxPermission || typeof ctxPermission.respond !== 'function') {
    return { ok: false, code: APPROVAL_SESSION_GONE };
  }
  return { ok: true };
}
