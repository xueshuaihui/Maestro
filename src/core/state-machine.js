/**
 * State machines: instance, node, handoff, escalation, approval, session.
 *
 * Consistency rules (see iteration doc 2.3 / 1.8):
 *   - can() never throws
 *   - assert() throws IllegalTransitionError only
 *   - apply() never throws for transition verdicts; it awaits emit before returning
 *
 * Node status mapping (6 observable states <-> baseline 9 states):
 *   pending  <-> blocked + ready      (merged display)
 *   running  <-> assigned + running   (merged display)
 *   review / done / failed / cancelled / escalated keep the same name.
 * A baseline step such as blocked -> ready or assigned -> running is deliberately
 * not an edge here: the tables below are the only authority.
 *
 * I1.2 extension (requirement D-1): `escalated` is a real state, `done` can be
 * reopened by a backflow wake-up, `failed` can be reopened by a retest dispatch,
 * and every "cannot continue" verdict lands on `escalated`. `DEFINED_ONLY.node`
 * is now empty.
 *
 * I1.4 extension (requirement D-2): `escalated` gains the three human-adjudication
 * exits (`running` / `done` / `failed`) plus the existing cancel edge, `suspended`
 * can leave for `running` / `completed` / `failed` besides cancel, and the handoff
 * table gains `delivered -> pending`, `pending -> delivered/rejected/expired`.
 * `resolved` is the terminal escalation state for a human decision; approvals get
 * their own four-state table.
 *
 * `done` deliberately has no `cancelled` edge: a finished node is never rolled back
 * by cancel. `running -> failed` and `review -> failed` are kept because the
 * `single` template still lands failures there.
 */

export const INSTANCE_STATES = Object.freeze([
  'created',
  'running',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
  'suspended'
]);

export const NODE_STATES = Object.freeze([
  'pending',
  'running',
  'review',
  'done',
  'failed',
  'cancelled',
  'escalated'
]);

export const HANDOFF_STATES = Object.freeze([
  'created',
  'delivered',
  'pending',
  'accepted',
  'consumed',
  'rejected',
  'expired'
]);

export const ESCALATION_STATES = Object.freeze(['pending', 'resolved', 'voided']);

/** Approval lifecycle (requirement D-2 / D-5). Memory-only rows, persisted by one CAS. */
export const APPROVAL_STATES = Object.freeze(['pending', 'approved', 'denied', 'withdrawn']);

/**
 * Session states used by the guard only (requirement D-6). The engine's direct
 * writes keep their I1.1 behaviour; this table only serves `transit('session', ...)`
 * plus the escalation and cancel paths.
 */
export const SESSION_STATES = Object.freeze([
  'idle',
  'thinking',
  'tool_running',
  'waiting_input',
  'waiting_dependency',
  'escalated'
]);

/** Transition tables, one row per source state. Terminal states carry an empty row. */
const TABLES = {
  instance: {
    created: ['running', 'cancelled'],
    running: ['completed', 'failed', 'cancelled', 'interrupted', 'suspended'],
    completed: [],
    failed: [],
    cancelled: [],
    interrupted: [],
    // A suspended instance is resumed by an escalation verdict (D-2 / D-6).
    suspended: ['running', 'completed', 'failed', 'cancelled']
  },
  node: {
    pending: ['running', 'escalated', 'cancelled'],
    running: ['review', 'failed', 'escalated', 'cancelled'],
    review: ['done', 'failed', 'escalated', 'cancelled'],
    // Reopened by a backflow wake-up or by a failed backflow dispatch.
    done: ['running', 'escalated'],
    // Reopened by a retest dispatch or by a failed retest dispatch.
    failed: ['running', 'escalated', 'cancelled'],
    // Adjudication exits (retry / pass / fail) plus the cancel path.
    escalated: ['running', 'done', 'failed', 'cancelled'],
    cancelled: []
  },
  handoff: {
    created: ['delivered', 'rejected'],
    // Delivery failure falls back to `pending` before the retry window.
    delivered: ['accepted', 'rejected', 'pending'],
    accepted: ['consumed', 'rejected'],
    pending: ['delivered', 'expired', 'rejected'],
    consumed: [],
    rejected: [],
    expired: []
  },
  escalation: {
    pending: ['resolved', 'voided'],
    resolved: [],
    voided: []
  },
  approval: {
    pending: ['approved', 'denied', 'withdrawn'],
    approved: [],
    denied: [],
    withdrawn: []
  },
  session: {
    idle: ['thinking', 'escalated'],
    thinking: ['tool_running', 'waiting_dependency', 'waiting_input', 'idle', 'escalated'],
    tool_running: ['thinking', 'waiting_dependency', 'waiting_input', 'idle', 'escalated'],
    waiting_input: ['thinking', 'idle', 'escalated'],
    waiting_dependency: ['idle', 'escalated'],
    // Escalated has no outbound edge except cancel.
    escalated: ['idle']
  }
};

const STATE_SETS = {
  instance: INSTANCE_STATES,
  node: NODE_STATES,
  handoff: HANDOFF_STATES,
  escalation: ESCALATION_STATES,
  approval: APPROVAL_STATES,
  session: SESSION_STATES
};

const DEFINED_ONLY = {
  instance: Object.freeze([]),
  node: Object.freeze([]),
  handoff: Object.freeze([]),
  escalation: Object.freeze([]),
  approval: Object.freeze([]),
  session: Object.freeze([])
};

/**
 * Constant groups for I1.2 / I1.4 (requirement D-4 / D-2). They are exported as frozen
 * arrays so they serialise and compare cheaply; wrap them in a Set when a membership
 * test is hot. Never merge one group into another: `suspended` must stay out of
 * TERMINAL_INSTANCE, otherwise cancel would answer "already finished" for a
 * suspended instance and the only exit would disappear.
 */
export const TERMINAL_INSTANCE = Object.freeze([
  'completed',
  'failed',
  'cancelled',
  'interrupted'
]);

/** Only for reconcileOnBoot / interruptAll: `core stop` must not rewrite a suspended instance. */
export const CORE_IMMUTABLE_INSTANCE = Object.freeze([...TERMINAL_INSTANCE, 'suspended']);

/** waitForRun completion plus the "refuse to reuse this instance" check. */
export const RUN_DONE_INSTANCE = Object.freeze([...TERMINAL_INSTANCE, 'suspended']);

export const CANCELABLE_NODE = Object.freeze(['pending', 'running', 'review', 'failed', 'escalated']);

/** `pending` is cancelable too: a withdrawn retry lands on `rejected` / `withdrawn` (D-2). */
export const CANCELABLE_HANDOFF = Object.freeze(['created', 'delivered', 'pending', 'accepted']);

export class IllegalTransitionError extends Error {
  constructor(from, to, code, message) {
    super(message || `${String(from)} -> ${String(to)} (${String(code)})`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
    this.code = code;
  }
}

function createSM(object, { emit } = {}) {
  const states = STATE_SETS[object];
  const table = TABLES[object];
  const definedOnlyStates = DEFINED_ONLY[object];
  const known = new Set(states);

  async function emitOne(event) {
    if (typeof emit === 'function') {
      await emit(event);
    }
  }

  function can(from, to) {
    if (!known.has(from) || !known.has(to)) {
      const bad = !known.has(from) ? from : to;
      return {
        ok: false,
        code: 'UNKNOWN_STATE',
        message: `${object}: unknown state ${String(bad)}`
      };
    }
    if (definedOnlyStates.includes(from)) {
      return {
        ok: false,
        code: 'DEFINED_ONLY',
        message: `${object}: ${String(from)} is defined-only and accepts no transitions`
      };
    }
    if (from === to) {
      return {
        ok: false,
        code: 'ILLEGAL_TRANSITION',
        message: `${object}: ${String(from)} -> ${String(to)} is a repeat, not a transition`
      };
    }
    const targets = table[from] || [];
    if (!targets.includes(to)) {
      return {
        ok: false,
        code: 'ILLEGAL_TRANSITION',
        message: `${object}: ${String(from)} -> ${String(to)} is not in the transition table`
      };
    }
    return { ok: true };
  }

  function assert(from, to) {
    const verdict = can(from, to);
    if (!verdict.ok) {
      throw new IllegalTransitionError(from, to, verdict.code, verdict.message);
    }
  }

  async function apply(from, to, meta = {}) {
    const verdict = can(from, to);
    const base = { object, objectId: meta.objectId, from, to };

    if (verdict.ok) {
      await emitOne({
        ...base,
        result: 'applied',
        reason: meta.reason,
        detail: meta.detail
      });
      return { ok: true, from, to };
    }

    // A repeat set (from === to) is illegal but writes no event, to avoid noise.
    if (from !== to) {
      await emitOne({
        ...base,
        result: 'rejected',
        reason: 'illegal_transition',
        detail: { ...(meta.detail || {}), message: verdict.message }
      });
    }

    return { ok: false, code: verdict.code, from, to, message: verdict.message };
  }

  function isTerminal(state) {
    if (!known.has(state)) return false;
    if (definedOnlyStates.includes(state)) return false;
    const targets = table[state];
    return Array.isArray(targets) && targets.length === 0;
  }

  function definedOnly() {
    return [...definedOnlyStates];
  }

  return { object, states: [...states], can, assert, apply, isTerminal, definedOnly };
}

export function createInstanceSM(options = {}) {
  return createSM('instance', options);
}

export function createNodeSM(options = {}) {
  return createSM('node', options);
}

export function createHandoffSM(options = {}) {
  return createSM('handoff', options);
}

export function createEscalationSM(options = {}) {
  return createSM('escalation', options);
}

export function createApprovalSM(options = {}) {
  return createSM('approval', options);
}

export function createSessionSM(options = {}) {
  return createSM('session', options);
}
