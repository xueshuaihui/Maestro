/**
 * 交接包状态推导（适配器 + 核心边界上的最小实现）。
 *
 * 目标问题（docs/index.md §2.5）：能否从 ACP 事件可靠推导 `accepted` / `consumed`？
 *
 * 事实约束（来自 ACP v1 语义）：
 *   `session/prompt` 是**阻塞调用**——它的 Promise 在 turn 结束时才 resolve，返回 stopReason。
 *   因此「目标是否已接受」只能靠事件流观测，不能靠 RPC 返回；而事件流是否可观测，
 *   取决于宿主在 turn 开始时是否发任何 session/update。
 *
 * 本模块把「不可观测窗口」显式建模：delivered → accepted 之间存在 gap，gap 内状态无法区分。
 */
import { isNoiseUpdate, isTurnUpdate } from './session-state.mjs';

export const HANDOFF_STATE = Object.freeze({
  CREATED: 'created',
  DELIVERED: 'delivered',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  CONSUMED: 'consumed',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
});

export const TERMINAL = new Set([HANDOFF_STATE.CONSUMED, HANDOFF_STATE.REJECTED, HANDOFF_STATE.EXPIRED]);

/**
 * @param {object} opts
 * @param {number} opts.ttlMs         delivered 后多久未见接受信号判为 expired
 * @param {'turn-event'|'any-event'} opts.acceptPolicy  接受信号口径（默认排除会话级噪声）
 */
export function createHandoffTracker({ ttlMs = 30_000, acceptPolicy = 'turn-event', now = () => Date.now() } = {}) {
  const items = new Map();
  let seq = 0;

  function ensure(id) {
    if (!items.has(id)) items.set(id, { id, state: HANDOFF_STATE.CREATED, at: {}, transitions: [] });
    return items.get(id);
  }

  function move(h, state, evidence) {
    if (h.state === state) return false;
    h.transitions.push({ from: h.state, state, at: now(), evidence });
    h.state = state;
    h.at[state] = now();
    return true;
  }

  return {
    create(meta = {}) {
      const id = meta.id ?? `HO-${String(++seq).padStart(3, '0')}`;
      const h = ensure(id);
      h.meta = meta;
      move(h, HANDOFF_STATE.CREATED, 'constructed');
      return id;
    },

    /** RPC 已发出、未立即失败（注意：不代表目标已接受） */
    delivered(id) {
      const h = ensure(id);
      move(h, HANDOFF_STATE.DELIVERED, 'prompt-sent');
      return h;
    },

    /** 观测到一条 session/update */
    observeUpdate(id, update) {
      const h = ensure(id);
      if (TERMINAL.has(h.state) || h.state === HANDOFF_STATE.ACCEPTED) return false;
      // 未投递（created）时到达的帧属于上一轮残留，不能算作本次接受
      if (h.state !== HANDOFF_STATE.DELIVERED && h.state !== HANDOFF_STATE.PENDING) return false;
      // any-event：朴素实现「收到任何帧就算接受」——会把会话级噪声误判成接受
      const accept = acceptPolicy === 'any-event' ? true : isTurnUpdate(update);
      if (!accept) {
        h.noiseCount = (h.noiseCount ?? 0) + 1;
        return false;
      }
      return move(h, HANDOFF_STATE.ACCEPTED, `first-${update?.sessionUpdate ?? 'event'}`);
    },

    /** prompt RPC 结束 */
    settle(id, { stopReason, error } = {}) {
      const h = ensure(id);
      if (TERMINAL.has(h.state)) return h;
      if (error) {
        // 会话不存在/已关闭这类确定性错误 → 拒绝；其余（超时、传输中断）→ pending 可重投
        const deterministic = error.code === -32602 || error.code === -32002 || error.code === -32601;
        move(h, deterministic ? HANDOFF_STATE.REJECTED : HANDOFF_STATE.PENDING, `rpc-error:${error.code ?? 'unknown'}`);
        return h;
      }
      if (stopReason === 'refusal') move(h, HANDOFF_STATE.REJECTED, 'stop-refusal');
      else if (stopReason === 'cancelled') move(h, HANDOFF_STATE.REJECTED, 'stop-cancelled');
      else if (stopReason === 'end_turn' || stopReason === 'max_tokens' || stopReason === 'max_turn_requests') {
        move(h, HANDOFF_STATE.CONSUMED, `stop-${stopReason}`);
      } else move(h, HANDOFF_STATE.PENDING, `stop-${stopReason ?? 'unknown'}`);
      return h;
    },

    /** 时间推进：TTL 到期 */
    tick() {
      for (const h of items.values()) {
        if (h.state !== HANDOFF_STATE.DELIVERED) continue;
        const age = now() - (h.at[HANDOFF_STATE.DELIVERED] ?? now());
        if (age >= ttlMs) move(h, HANDOFF_STATE.EXPIRED, `ttl-${ttlMs}ms-unobserved`);
      }
    },

    get(id) {
      const h = items.get(id);
      if (!h) return null;
      const d = h.at[HANDOFF_STATE.DELIVERED];
      const a = h.at[HANDOFF_STATE.ACCEPTED];
      const c = h.at[HANDOFF_STATE.CONSUMED] ?? h.at[HANDOFF_STATE.REJECTED] ?? h.at[HANDOFF_STATE.EXPIRED];
      return {
        id: h.id,
        state: h.state,
        noiseCount: h.noiseCount ?? 0,
        ambiguityWindowMs: d && a ? a - d : null,
        totalMs: d && c ? c - d : null,
        transitions: h.transitions,
      };
    },

    all() {
      return [...items.keys()].map((id) => this.get(id));
    },
  };
}
