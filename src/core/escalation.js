/**
 * Escalation construction and the one-shot CAS committer (D-3).
 *
 * Four in-memory changes land in a single `save`:
 *   escalations[] += pending entry, node -> escalated, session -> escalated
 *   (when it exists), instance -> suspended.
 * If that write fails, nothing is rolled back step by step: the caller re-loads and
 * makes one *independent* write that only sets `halted: true` (`markHalted`).
 * The injected `fault === 'state_write:escalation'` affects only the escalation write.
 *
 * No display text lives here: `reasonDetail` is supplied by the verdict reader.
 */

const defaultNow = () => Date.now();

function isoOf(now) {
  const value = typeof now === 'function' ? now() : Date.now();
  return new Date(value).toISOString();
}

function normalizeDefects(defects) {
  if (!Array.isArray(defects)) return [];
  return defects
    .filter((defect) => defect && typeof defect === 'object')
    .map((defect) => ({
      summary: typeof defect.summary === 'string' ? defect.summary : '',
      evidence: typeof defect.evidence === 'string' ? defect.evidence : ''
    }));
}

/** Globally increasing escalation id: ESC-001, ESC-002, … (never reused). */
export function nextEscalationId(escalations) {
  let max = 0;
  for (const escalation of Array.isArray(escalations) ? escalations : []) {
    const match = /^ESC-(\d+)$/.exec(escalation?.escalationId ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `ESC-${String(max + 1).padStart(3, '0')}`;
}

/** Idempotency key `(nodeId, round)` — only a pending entry counts. */
export function findPending(escalations, { nodeId = null, round = null } = {}) {
  if (nodeId === null || round === null) return null;
  return (
    (Array.isArray(escalations) ? escalations : []).find(
      (escalation) =>
        escalation?.state === 'pending' &&
        escalation?.nodeId === nodeId &&
        escalation?.round === round
    ) ?? null
  );
}

/**
 * Build a pending escalation entry in the D-6 shape.
 * `defects` is the same shape as a backflow handoff's defects; non-verdict causes
 * pass `[]` (never omit the field).
 */
export function buildEscalation({
  instanceId = null,
  escalations = [],
  nodeId = null,
  round = 1,
  reasonCode = 'execution_failed',
  reasonDetail = '',
  defects = [],
  now = defaultNow
} = {}) {
  return {
    escalationId: nextEscalationId(escalations),
    nodeId,
    round,
    reasonCode,
    reasonDetail,
    defects: normalizeDefects(defects),
    state: 'pending',
    createdAt: isoOf(now),
    resolvedAt: null,
    resolution: null,
    voidedAt: null
  };
}

/**
 * Adjudicate a pending escalation in memory (D-6.1). The caller owns the single
 * CAS write; this function never persists. Non-pending entries are refused.
 */
export function applyResolution(entry, { decision = null, atIso = null } = {}) {
  if (!entry || entry.state !== 'pending') return { ok: false, code: 'ESCALATION_NOT_PENDING' };
  entry.state = 'resolved';
  entry.resolution = decision;
  entry.resolvedAt = atIso ?? isoOf(defaultNow);
  return { ok: true, state: entry.state, resolution: entry.resolution };
}

async function callSave(saveState, instanceId, state, expectedState) {
  try {
    const result = await saveState(instanceId, state, { expectedState });
    return result && typeof result === 'object' ? result : { ok: false, code: 'STORE_WRITE_FAILED' };
  } catch (err) {
    return { ok: false, code: 'STORE_WRITE_FAILED', params: { errno: err?.code ?? null } };
  }
}

async function callLoad(load, instanceId) {
  try {
    const result = await load(instanceId);
    return result && typeof result === 'object' ? result : { ok: false, code: 'STORE_READ_FAILED' };
  } catch (err) {
    return { ok: false, code: 'STORE_READ_FAILED', params: { errno: err?.code ?? null } };
  }
}

function applyInMemory(state, entry, nowIso, sessionTerminal = 'escalated') {
  if (!Array.isArray(state.escalations)) state.escalations = [];
  state.escalations.push(entry);

  const node =
    (Array.isArray(state.nodes) ? state.nodes : []).find((item) => item?.nodeId === entry.nodeId) ?? null;
  const nodeFrom = node?.state ?? null;
  if (node) {
    node.state = 'escalated';
    node.note = null;
    node.endedAt = nowIso;
    node.stateSince = nowIso;
    // D-6 invariant: `reviewReason` may only exist while the node is in `review`.
    // Cleared in the same single CAS as the escalation itself; graphs without the field
    // keep their exact I1.2 shape.
    if (Object.prototype.hasOwnProperty.call(node, 'reviewReason')) node.reviewReason = null;
  }

  const sessions = Array.isArray(state.sessions) ? state.sessions : [];
  // The node's session id is authoritative; a snapshot written before the session
  // id was stamped still resolves to the newest session of that node.
  const own = sessions.filter((item) => item?.nodeId === entry.nodeId);
  const newest =
    own.length === 0
      ? null
      : own.reduce((latest, item) =>
          String(item?.createdAt ?? '') >= String(latest?.createdAt ?? '') ? item : latest
        );
  const session =
    (node?.sessionId
      ? sessions.find((item) => item?.sessionId === node.sessionId)
      : null) ?? newest;
  const sessionFrom = session?.state ?? null;
  if (session) {
    session.state = sessionTerminal;
    session.quarantined = true;
    session.stateSince = nowIso;
  }

  state.state = 'suspended';
  state.stateSince = nowIso;

  return { node, nodeFrom, session, sessionFrom };
}

function emitMany(emit, events) {
  if (typeof emit !== 'function') return;
  for (const event of events) {
    try {
      const maybe = emit(event);
      if (maybe && typeof maybe.catch === 'function') maybe.catch(() => {});
    } catch {
      // Auditing must never roll back a committed escalation.
    }
  }
}

/**
 * Commit one escalation with a single CAS write.
 *
 * @param {{store?:object, load?:Function, saveState?:Function, emit?:Function,
 *          instanceId:string, escalation:object, fault?:string|null, now?:Function}} options
 * @returns {Promise<{ok:true, escalationId:string, reused:boolean}
 *                  |{ok:false, code:string, params?:object}>}
 */
export async function commitEscalation({
  store = null,
  load = null,
  saveState = null,
  emit = null,
  instanceId,
  escalation,
  pendingHandoff = null,
  overlaySession = null,
  sessionTerminal = 'escalated',
  fault = null,
  retryOnConflict = 1,
  now = defaultNow
} = {}) {
  const doLoad = typeof load === 'function' ? load : store?.load;
  const doSave = typeof saveState === 'function' ? saveState : store?.save;
  if (typeof doLoad !== 'function' || typeof doSave !== 'function') {
    return { ok: false, code: 'ESCALATION_WRITE_FAILED', params: { cause: 'io_missing' } };
  }
  if (!escalation || typeof escalation !== 'object') {
    return { ok: false, code: 'ESCALATION_WRITE_FAILED', params: { cause: 'escalation_missing' } };
  }

  const nowIso = isoOf(now);
  const attempts = Number.isInteger(retryOnConflict) && retryOnConflict > 0 ? retryOnConflict + 1 : 1;
  let lastConflict = null;

  // D-6.9: a pause/resume write may land between this read and the CAS. Replay
  // once on the fresh disk state instead of degrading the escalation to `halted`.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const loaded = await callLoad(doLoad, instanceId);
    if (!loaded.ok) {
      return {
        ok: false,
        code: 'ESCALATION_WRITE_FAILED',
        params: { cause: loaded.code ?? 'load_failed' }
      };
    }
    const state = loaded.state;

    // Idempotency: the same (nodeId, round) pending entry is reused untouched.
    const existing = findPending(state.escalations, {
      nodeId: escalation.nodeId,
      round: escalation.round
    });
    if (existing) {
      return { ok: true, escalationId: existing.escalationId, reused: true };
    }

    // D-4.2: fold a session created but not yet persisted into the reloaded
    // state, and stamp the target node so the escalation isolates that session.
    if (overlaySession && typeof overlaySession === 'object') {
      if (!Array.isArray(state.sessions)) state.sessions = [];
      const idx = state.sessions.findIndex((item) => item?.sessionId === overlaySession.sessionId);
      if (idx >= 0) state.sessions[idx] = { ...state.sessions[idx], ...overlaySession };
      else state.sessions.push({ ...overlaySession });
      const target = (Array.isArray(state.nodes) ? state.nodes : []).find(
        (item) => item?.nodeId === overlaySession.nodeId
      ) ?? null;
      if (target) {
        target.sessionId = overlaySession.sessionId;
        if (Number.isInteger(overlaySession.round)) target.round = overlaySession.round;
      }
    }

    // D-3.5 / D-4.7: the rejected handoff lands in the SAME CAS as the
    // escalation. It is a draft that was never committed as `created`, so it is
    // pushed straight to `rejected` and never emits `handoff.created`.
    let rejectedDetail = null;
    if (pendingHandoff && typeof pendingHandoff === 'object' && pendingHandoff.handoffId) {
      if (!Array.isArray(state.handoffs)) state.handoffs = [];
      const reason = pendingHandoff.rejectReason ?? 'invalid_payload';
      const row = {
        ...pendingHandoff,
        state: 'rejected',
        rejectReason: reason,
        rejectedAt: nowIso,
        deliveredAt: null
      };
      const idx = state.handoffs.findIndex((item) => item?.handoffId === row.handoffId);
      if (idx >= 0) state.handoffs[idx] = { ...state.handoffs[idx], ...row };
      else state.handoffs.push(row);
      rejectedDetail = { reason, handoffId: row.handoffId };
    }

    const entry = {
      ...escalation,
      escalationId: nextEscalationId(state.escalations),
      state: 'pending',
      defects: normalizeDefects(escalation.defects),
      resolvedAt: null,
      resolution: null,
      voidedAt: null
    };
    const { nodeFrom, session, sessionFrom } = applyInMemory(state, entry, nowIso, sessionTerminal);

    const expectedState = {
      state: 'running',
      halted: false,
      rev: Number.isInteger(state.rev) ? state.rev : 0,
      paused: false
    };

    const saved =
      fault === 'state_write:escalation'
        ? { ok: false, code: 'STORE_WRITE_FAILED', params: { cause: 'state_write:escalation' } }
        : await callSave(doSave, instanceId, state, expectedState);

    if (!saved.ok) {
      if (saved.code === 'STORE_CONFLICT' && attempt + 1 < attempts) {
        lastConflict = saved;
        continue;
      }
      return {
        ok: false,
        code: saved.code === 'STORE_CONFLICT' ? 'STORE_CONFLICT' : 'ESCALATION_WRITE_FAILED',
        params: saved.params ?? {}
      };
    }

    const events = [];
    if (rejectedDetail) {
      events.push({
        object: 'handoff',
        objectId: rejectedDetail.handoffId,
        from: null,
        to: 'rejected',
        result: 'applied',
        reason: 'handoff.rejected',
        detail: { reason: rejectedDetail.reason }
      });
    }
    events.push(
      {
        object: 'escalation',
        objectId: entry.escalationId,
        from: null,
        to: 'pending',
        result: 'applied',
        reason: 'escalation.created',
        detail: { nodeId: entry.nodeId, round: entry.round, reasonCode: entry.reasonCode }
      },
      {
        object: 'node',
        objectId: entry.nodeId,
        from: nodeFrom,
        to: 'escalated',
        result: 'applied',
        reason: 'state.change'
      }
    );
    if (session) {
      events.push({
        object: 'session',
        objectId: session.sessionId,
        from: sessionFrom,
        to: sessionTerminal,
        result: 'applied',
        reason: 'state.change'
      });
    }
    events.push({
      object: 'instance',
      objectId: instanceId,
      from: 'running',
      to: 'suspended',
      result: 'applied',
      reason: 'core.suspend'
    });
    emitMany(emit, events);

    return { ok: true, escalationId: entry.escalationId, reused: false, rev: saved.rev };
  }
  return { ok: false, code: 'STORE_CONFLICT', params: lastConflict?.params ?? {} };
}

/**
 * Independent CAS that only sets `halted: true`. Must succeed even when
 * `commitEscalation` was faulted: the instance stays `running`, so this is the only
 * marker that stops further advances.
 */
export async function markHalted({
  store = null,
  load = null,
  saveState = null,
  emit = null,
  instanceId,
  cause = null,
  now = defaultNow
} = {}) {
  const doLoad = typeof load === 'function' ? load : store?.load;
  const doSave = typeof saveState === 'function' ? saveState : store?.save;
  if (typeof doLoad !== 'function' || typeof doSave !== 'function') {
    return { ok: false, code: 'ESCALATION_WRITE_FAILED', params: { cause: 'io_missing' } };
  }

  const loaded = await callLoad(doLoad, instanceId);
  if (!loaded.ok) {
    return {
      ok: false,
      code: 'ESCALATION_WRITE_FAILED',
      params: { cause: loaded.code ?? 'load_failed' }
    };
  }
  const state = loaded.state;
  state.halted = true;
  // D-3：这次写入独立于升级事务，只负责 stopped 标记；原因随同落盘，
  // 供 `orch run` / `orch status` 渲染「无法记录升级：<cause>」。
  if (typeof cause === 'string' && cause.length > 0) state.haltCause = cause;

  const saved = await callSave(doSave, instanceId, state, {
    state: state.state,
    halted: false,
    rev: Number.isInteger(loaded.state.rev) ? loaded.state.rev : 0
  });
  if (!saved.ok) {
    return { ok: false, code: 'ESCALATION_WRITE_FAILED', params: saved.params ?? {} };
  }

  emitMany(emit, [
    {
      object: 'instance',
      objectId: instanceId,
      result: 'applied',
      reason: 'run.halted',
      detail: { halted: true, cause: state.haltCause ?? null, at: isoOf(now) }
    }
  ]);

  return { ok: true, halted: true, rev: saved.rev };
}

/**
 * Split-doc form: a committer bound to injected IO. `commitEscalation` there takes
 * the verdict instead of a pre-built entry.
 */
export function createEscalationCommitter({
  load = null,
  save = null,
  emit = null,
  clock = defaultNow,
  fault = null
} = {}) {
  return async function commit(args = {}) {
    const {
      instanceId,
      nodeId,
      round = 1,
      reasonCode = 'execution_failed',
      reasonDetail = '',
      defects = null,
      verdict = null,
      liveState = null
    } = args;
    const list = Array.isArray(liveState?.escalations) ? liveState.escalations : [];
    const escalation = buildEscalation({
      instanceId,
      escalations: list,
      nodeId,
      round,
      reasonCode,
      reasonDetail,
      defects: defects ?? verdict?.defects ?? [],
      now: clock
    });
    return commitEscalation({
      instanceId,
      escalation,
      load,
      saveState: save,
      emit,
      fault,
      now: clock
    });
  };
}
