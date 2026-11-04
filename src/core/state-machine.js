/**
 * Three state machines for I1.1: instance, node, handoff.
 *
 * Consistency rules (see iteration doc 2.3 / 1.8):
 *   - can() never throws
 *   - assert() throws IllegalTransitionError only
 *   - apply() never throws for transition verdicts; it awaits emit before returning
 *
 * Node status mapping (6 observable states <-> baseline 9 states), kept for I1.2:
 *   pending  <-> blocked + ready      (merged display)
 *   running  <-> assigned + running   (merged display)
 *   review / done / failed / cancelled / escalated keep the same name.
 * The 6-state table is the only authority this iteration: a baseline step such as
 * blocked -> ready or assigned -> running is deliberately not an edge here.
 *
 * `escalated` is defined-only in this iteration: no inbound edge, no outbound edge,
 * every verdict is DEFINED_ONLY.
 */

export const INSTANCE_STATES = Object.freeze([
  'created',
  'running',
  'completed',
  'failed',
  'cancelled',
  'interrupted'
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

/** Transition tables, one row per source state. Terminal states carry an empty row. */
const TABLES = {
  instance: {
    created: ['running', 'cancelled'],
    running: ['completed', 'failed', 'cancelled', 'interrupted'],
    completed: [],
    failed: [],
    cancelled: [],
    interrupted: []
  },
  node: {
    pending: ['running', 'cancelled'],
    running: ['review', 'failed', 'cancelled'],
    review: ['done', 'failed'],
    done: [],
    failed: [],
    cancelled: []
  },
  handoff: {
    created: ['delivered'],
    delivered: ['accepted', 'rejected'],
    accepted: ['consumed', 'rejected'],
    pending: ['delivered', 'expired'],
    consumed: [],
    rejected: [],
    expired: []
  }
};

const STATE_SETS = {
  instance: INSTANCE_STATES,
  node: NODE_STATES,
  handoff: HANDOFF_STATES
};

const DEFINED_ONLY = {
  instance: Object.freeze([]),
  node: Object.freeze(['escalated']),
  handoff: Object.freeze([])
};

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
