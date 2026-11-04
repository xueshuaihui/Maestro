// 交接包状态推导。
//
// 硬约束（requirement 2.5 / AC-19 / AC-24 / BR-15）：
// - accepted 的唯一入口是 observeTurnEvent，且 name ∈ TURN_UPDATES；
// - 噪声帧（usage_update / available_commands_update）即便先到也不改变状态；
// - 本迭代禁止任何 TTL / 定时器 / 超时判 expired —— expired 零产生路径；
// - rejected 的三种原因必须可区分（AC-11 要求“已撤回”不能与“目标拒绝”混为一条）。
//
// 适配器不认识核心：emit 由调用方注入，这里只产出与 events.jsonl 同构的迁移描述。

import { TURN_UPDATES } from './session-state.js';

export const HANDOFF_STATES = [
  'created',
  'delivered',
  'pending',
  'accepted',
  'consumed',
  'rejected',
  'expired',
];

export const REJECT_REASONS = ['target_rejected', 'permission_denied', 'withdrawn'];

const LEGAL = {
  created: ['delivered'],
  delivered: ['accepted', 'rejected'],
  accepted: ['consumed', 'rejected'],
  pending: ['delivered', 'expired'], // 本迭代无 pending 产生路径
  consumed: [],
  rejected: [],
  expired: [],
};

function illegal(from, to) {
  return {
    ok: false,
    code: 'ILLEGAL_TRANSITION',
    from,
    to,
    message: `handoff: ${from} → ${to} 不在迁移表内`,
  };
}

/**
 * @param {{
 *   handoffId: string,
 *   startedAt?: number,
 *   emit?: (event: object) => void,
 *   clock?: () => number,
 * }} options
 */
export function createHandoffTracker({
  handoffId,
  startedAt = null,
  emit = () => {},
  clock = () => Date.now(),
} = {}) {
  if (!handoffId) throw new TypeError('createHandoffTracker: handoffId 必填');

  let state = 'created';
  let createdAt = startedAt;
  let createdMeta = null;
  const timestamps = {
    createdAt: startedAt,
    deliveredAt: null,
    acceptedAt: null,
    consumedAt: null,
    rejectedAt: null,
  };
  let acceptedSignal = null;
  let ambiguityWindowMs = null;
  let rejectReason = null;

  const at = (atMs) => (Number.isFinite(atMs) ? atMs : clock());
  const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

  function apply(to, reason, detail, atMs) {
    const from = state;
    state = to;
    try {
      emit({
        object: 'handoff',
        objectId: handoffId,
        from,
        to,
        result: 'applied',
        reason,
        at: iso(atMs),
        detail: detail ?? null,
      });
    } catch {
      // 事件总线异常不影响状态推进
    }
    return from;
  }

  let createdCalled = false;
  function created(meta = {}) {
    const atMs = at(meta.atMs);
    createdAt = timestamps.createdAt ?? atMs;
    timestamps.createdAt = createdAt;
    createdMeta = meta.meta ?? null;
    if (!createdCalled) {
      createdCalled = true;
      try {
        emit({
          object: 'handoff',
          objectId: handoffId,
          from: null,
          to: 'created',
          result: 'applied',
          reason: 'handoff.created',
          at: iso(createdAt),
          detail: createdMeta,
        });
      } catch {
        // 事件总线异常不影响状态推进
      }
    }
    return { ok: true, state: 'created', createdAt: iso(createdAt) };
  }

  function delivered({ atMs } = {}) {
    if (state === 'delivered') {
      return { ok: true, state, deliveredAt: iso(timestamps.deliveredAt), duplicate: true };
    }
    if (!LEGAL[state]?.includes('delivered')) return illegal(state, 'delivered');
    timestamps.deliveredAt = at(atMs);
    apply('delivered', 'handoff.delivered', { atMs: timestamps.deliveredAt }, timestamps.deliveredAt);
    return { ok: true, state: 'delivered', deliveredAt: iso(timestamps.deliveredAt) };
  }

  // accepted 的唯一入口：只认 6 类 turn 内事件（严格白名单）
  function observeTurnEvent({ name, atMs } = {}) {
    const known = typeof name === 'string' && TURN_UPDATES.has(name);
    if (!known) {
      // 噪声帧 / 未知帧：状态不变，不写迁移事件
      return { ok: true, state, ignored: true, noise: true };
    }
    if (state === 'accepted' || state === 'consumed') {
      return { ok: true, state, ignored: true, duplicate: true };
    }
    if (state !== 'delivered') {
      return { ok: true, state, ignored: true, pending: true };
    }
    const acceptedAt = at(atMs);
    timestamps.acceptedAt = acceptedAt;
    acceptedSignal = name;
    ambiguityWindowMs = Math.max(0, acceptedAt - (timestamps.deliveredAt ?? acceptedAt));
    apply(
      'accepted',
      'turn.first_event',
      { event: name, ambiguityWindowMs },
      acceptedAt,
    );
    return {
      ok: true,
      state: 'accepted',
      acceptedAt: iso(acceptedAt),
      acceptedSignal,
      ambiguityWindowMs,
    };
  }

  function consumed({ atMs } = {}) {
    if (state === 'consumed') return { ok: true, state, consumedAt: iso(timestamps.consumedAt) };
    if (!LEGAL[state]?.includes('consumed')) return illegal(state, 'consumed');
    timestamps.consumedAt = at(atMs);
    apply('consumed', 'handoff.consumed', { atMs: timestamps.consumedAt }, timestamps.consumedAt);
    return { ok: true, state: 'consumed', consumedAt: iso(timestamps.consumedAt) };
  }

  function rejected({ reason, atMs } = {}) {
    if (!REJECT_REASONS.includes(reason)) {
      return {
        ok: false,
        code: 'INVALID_REASON',
        reason: reason ?? null,
        message: `handoff.rejected 的 reason 只允许 ${REJECT_REASONS.join(' | ')}`,
      };
    }
    if (!LEGAL[state]?.includes('rejected')) return illegal(state, 'rejected');
    rejectReason = reason;
    timestamps.rejectedAt = at(atMs);
    apply('rejected', 'handoff.rejected', { reason }, timestamps.rejectedAt);
    return { ok: true, state: 'rejected', reason, rejectedAt: iso(timestamps.rejectedAt) };
  }

  function snapshot() {
    return {
      handoffId,
      state,
      createdAt: iso(timestamps.createdAt),
      timestamps: {
        createdAt: iso(timestamps.createdAt),
        deliveredAt: iso(timestamps.deliveredAt),
        acceptedAt: iso(timestamps.acceptedAt),
        consumedAt: iso(timestamps.consumedAt),
        rejectedAt: iso(timestamps.rejectedAt),
      },
      acceptedSignal,
      ambiguityWindowMs,
      rejectReason,
      createdMeta,
    };
  }

  return {
    created,
    delivered,
    observeTurnEvent,
    consumed,
    rejected,
    state: () => state,
    snapshot,
    can: (to) => Boolean(LEGAL[state]?.includes(to)),
  };
}
