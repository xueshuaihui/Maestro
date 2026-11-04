/**
 * 会话状态归一化（适配器层，对应 docs/index.md §3.2 的 6 个会话状态）。
 *
 * 输入只有两类：
 *   - ACP `session/update` 帧（agent → client 通知）
 *   - 客户端侧信号（request_permission 请求、permission 结果、核心的产出提交/升级）
 *
 * 输出：当前会话状态 + 迁移时间线。核心只消费状态，不消费 ACP 事件名。
 *
 * 重要：本文件属于**适配器层**，允许出现协议字段名；核心 `core/` 仍受纯度检查约束。
 */

export const SESSION_STATE = Object.freeze({
  IDLE: 'idle',
  THINKING: 'thinking',
  TOOL_RUNNING: 'tool_running',
  WAITING_INPUT: 'waiting_input',
  WAITING_DEPENDENCY: 'waiting_dependency',
  ESCALATED: 'escalated',
});

export const ALL_STATES = Object.freeze(Object.values(SESSION_STATE));

/** 会话级噪声：不表示 turn 内进展，但会被朴素实现误判为「会话有反应」 */
export const NOISE_UPDATES = Object.freeze(
  new Set(['usage_update', 'available_commands_update', 'current_mode_update', 'config_option_update']),
);

/** turn 内事件（出现即证明目标会话确实开始处理任务） */
export const TURN_UPDATES = Object.freeze(
  new Set(['user_message_chunk', 'agent_message_chunk', 'agent_thought_chunk', 'tool_call', 'tool_call_update', 'plan']),
);

export function isNoiseUpdate(update) {
  return NOISE_UPDATES.has(update?.sessionUpdate);
}

export function isTurnUpdate(update) {
  return TURN_UPDATES.has(update?.sessionUpdate);
}

/**
 * 单条 session/update → 状态（null 表示不改变状态）。
 * 返回 { state, evidence } 便于报告里逐条追溯「哪条帧导致哪个状态」。
 */
export function stateFromUpdate(update) {
  const kind = update?.sessionUpdate;
  switch (kind) {
    case 'user_message_chunk':
      return { state: SESSION_STATE.THINKING, evidence: 'prompt-echo' };
    case 'agent_thought_chunk':
      return { state: SESSION_STATE.THINKING, evidence: 'reasoning-chunk' };
    case 'agent_message_chunk':
      return { state: SESSION_STATE.THINKING, evidence: 'message-chunk' };
    case 'plan':
      return { state: SESSION_STATE.THINKING, evidence: 'plan' };
    case 'tool_call':
      return { state: SESSION_STATE.TOOL_RUNNING, evidence: 'tool-call' };
    case 'tool_call_update': {
      const st = update?.status;
      if (st === 'completed' || st === 'failed') return { state: SESSION_STATE.THINKING, evidence: `tool-${st}` };
      return { state: SESSION_STATE.TOOL_RUNNING, evidence: `tool-${st ?? 'update'}` };
    }
    default:
      return { state: null, evidence: isNoiseUpdate(update) ? 'noise' : 'unknown' };
  }
}

export function createSessionStateNormalizer({ now = () => Date.now(), onTransition } = {}) {
  /** @type {Map<string, {state:string, since:number, transitions:Array, unknownKinds:Record<string,number>}>} */
  const sessions = new Map();

  function ensure(sessionId) {
    let s = sessions.get(sessionId);
    if (!s) {
      s = { state: SESSION_STATE.IDLE, since: now(), transitions: [], unknownKinds: {} };
      s.transitions.push({ state: SESSION_STATE.IDLE, at: now(), evidence: 'session-created' });
      sessions.set(sessionId, s);
    }
    return s;
  }

  function move(sessionId, state, evidence) {
    const s = ensure(sessionId);
    if (!state || s.state === state) return { changed: false, state: s.state };
    const prev = s.state;
    s.state = state;
    s.since = now();
    const t = { from: prev, state, at: s.since, evidence };
    s.transitions.push(t);
    onTransition?.({ sessionId, ...t });
    return { changed: true, ...t };
  }

  return {
    /** 会话创建（session/new 或 resume 成功） */
    sessionCreated(sessionId) {
      ensure(sessionId);
    },

    /** 消费一条 session/update */
    applyUpdate(sessionId, update) {
      const s = ensure(sessionId);
      const mapped = stateFromUpdate(update);
      if (mapped.state === null && mapped.evidence === 'unknown') {
        const k = String(update?.sessionUpdate ?? 'undefined');
        s.unknownKinds[k] = (s.unknownKinds[k] ?? 0) + 1;
      }
      return move(sessionId, mapped.state, mapped.evidence);
    },

    /** session/request_permission 到达（客户端侧请求，不进 session/update 流） */
    permissionRequested(sessionId, { toolCallId, kind } = {}) {
      return move(sessionId, SESSION_STATE.WAITING_INPUT, `permission-request${kind ? `:${kind}` : ''}${toolCallId ? `:${toolCallId}` : ''}`);
    },

    /** 审批结果已回给 agent */
    permissionResolved(sessionId, outcome) {
      return move(sessionId, SESSION_STATE.THINKING, `permission-${outcome ?? 'resolved'}`);
    },

    /** turn 结束（stopReason 决定后续状态） */
    turnSettled(sessionId, stopReason) {
      if (stopReason === 'cancelled' || stopReason === 'refusal') return move(sessionId, SESSION_STATE.IDLE, `stop-${stopReason}`);
      return move(sessionId, SESSION_STATE.IDLE, `stop-${stopReason ?? 'unknown'}`);
    },

    /** 核心侧：产物已提交，等待证据校验 / 下游接收 */
    outputSubmitted(sessionId) {
      return move(sessionId, SESSION_STATE.WAITING_DEPENDENCY, 'core-output-submitted');
    },

    /** 核心侧：生成升级 */
    escalated(sessionId) {
      return move(sessionId, SESSION_STATE.ESCALATED, 'core-escalation');
    },

    /** 会话关闭 */
    closed(sessionId) {
      const s = sessions.get(sessionId);
      if (s) s.transitions.push({ state: 'removed', at: now(), evidence: 'session-closed' });
      sessions.delete(sessionId);
    },

    snapshot(sessionId) {
      const s = sessions.get(sessionId);
      return s ? { state: s.state, since: s.since, transitions: s.transitions.length } : null;
    },

    timeline(sessionId) {
      return sessions.get(sessionId)?.transitions ?? [];
    },

    all() {
      return [...sessions.entries()].map(([id, s]) => ({ id, state: s.state, transitions: s.transitions, unknownKinds: s.unknownKinds }));
    },
  };
}
