// 会话状态归一化：session/update → 6 状态。
//
// 只认 ACP 的 sessionUpdate 判别值，不做任何猜测。
// 噪声白名单来自真机实测（dsh-probe.md §4.2 / real-dsh-noise-frames.json）：
//   usage_update             —— turn 中反复出现，占入站流量 36%~50%
//   available_commands_update—— 建会话后 / turn 结束后出现（本批 0 次，仍必须滤）
// 把噪声当进展会让“目标已接受”提前 1s 以上（BR-15 / AC-19）。

export const SESSION_STATES = [
  'idle',
  'thinking',
  'tool_running',
  'waiting_input',
  'waiting_dependency',
  'escalated',
];

export const NOISE_UPDATES = new Set(['usage_update', 'available_commands_update']);

export const TURN_UPDATES = new Set([
  'agent_thought_chunk',
  'agent_message_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'user_message_chunk',
]);

const THINKING_UPDATES = new Set([
  'agent_thought_chunk',
  'agent_message_chunk',
  'plan',
  'user_message_chunk',
]);

/** 严格白名单：只有 6 类 turn 内事件才算“对方开始干活” */
export function isTurnEvent(update) {
  const name = typeof update === 'string' ? update : update?.sessionUpdate;
  return typeof name === 'string' && TURN_UPDATES.has(name);
}

export function createNormalizer({ clock = () => Date.now() } = {}) {
  /** @type {Map<string, object>} */
  const sessions = new Map();
  const counters = { noise: 0, turnEvents: 0, dropped: 0, unknownUpdate: 0 };
  /** 最近一次审批请求所属会话：允许 onPermissionSettled 只带 decision。 */
  let lastPermissionSession = null;

  function record(sessionId) {
    const key = sessionId ?? '<anonymous>';
    let rec = sessions.get(key);
    if (!rec) {
      rec = {
        sessionId: key,
        state: 'idle',
        toolName: null,
        turnId: null,
        quarantined: false,
        lastUpdateAt: null,
        noiseCount: 0,
        turnEventCount: 0,
        unknownUpdate: 0,
      };
      sessions.set(key, rec);
    }
    return rec;
  }

  function reduce(prev, sessionUpdate, ctx = {}) {
    const sessionId = ctx.sessionId ?? (prev && typeof prev === 'object' ? prev.sessionId : undefined);
    const rec = sessionId !== undefined ? record(sessionId) : null;
    const prevState =
      typeof prev === 'string'
        ? prev
        : prevStateOf(prev) ?? rec?.state ?? 'idle';
    const prevTool =
      ctx.toolName ??
      (prev && typeof prev === 'object' ? prev.toolName ?? null : null) ??
      rec?.toolName ??
      null;
    const name =
      typeof sessionUpdate === 'string' ? sessionUpdate : sessionUpdate?.sessionUpdate;

    if (rec) rec.lastUpdateAt = clock();

    // 升级后的终态守卫（C-08）：进入 escalated 后除取消外任何帧都不得改状态，
    // 否则宿主迟到的 agent_message_chunk 会把会话翻回 thinking（AC-39）。
    if (rec?.state === 'escalated') {
      counters.dropped += 1;
      return { state: 'escalated', noise: false, progress: false, dropped: true, reason: 'escalated_guard' };
    }

    // 取消后的迟到帧隔离：cancel 实测 13~56ms 才生效，期间仍会有 turn 内帧到达。
    // quarantined 期间一律丢弃（含同 turn 的收尾帧），否则会话会被翻回“执行中”。
    if (rec?.quarantined) {
      counters.dropped += 1;
      return {
        state: prevState,
        noise: false,
        progress: false,
        dropped: true,
        reason:
          ctx.turnId != null && rec.turnId != null && ctx.turnId !== rec.turnId
            ? 'quarantined_turn_mismatch'
            : 'quarantined',
      };
    }

    if (typeof name !== 'string' || name.length === 0) {
      counters.unknownUpdate += 1;
      if (rec) rec.unknownUpdate += 1;
      return {
        state: prevState,
        noise: true,
        progress: false,
        unknown: true,
        unknownUpdate: rec ? rec.unknownUpdate : counters.unknownUpdate,
      };
    }

    if (NOISE_UPDATES.has(name)) {
      counters.noise += 1;
      if (rec) rec.noiseCount += 1;
      return { state: prevState, noise: true, progress: false };
    }

    if (!TURN_UPDATES.has(name)) {
      // 未登记的判别值原样透传，但不得当作进展
      counters.unknownUpdate += 1;
      if (rec) rec.unknownUpdate += 1;
      return {
        state: prevState,
        noise: true,
        progress: false,
        unknown: true,
        unknownUpdate: rec ? rec.unknownUpdate : counters.unknownUpdate,
      };
    }

    counters.turnEvents += 1;
    if (rec) rec.turnEventCount += 1;

    let state = prevState;
    let toolName = prevTool;

    if (name === 'tool_call') {
      state = 'tool_running';
      toolName =
        (typeof sessionUpdate?.title === 'string' && sessionUpdate.title.trim()) ||
        sessionUpdate?.toolCallId ||
        prevTool ||
        null;
    } else if (name === 'tool_call_update') {
      state = 'tool_running';
      // 实测 tool_call_update 只有 status/text，没有 title —— 沿用上一个工具名
      toolName = prevTool ?? rec?.toolName ?? sessionUpdate?.title ?? sessionUpdate?.toolCallId ?? null;
    } else if (THINKING_UPDATES.has(name)) {
      state = 'thinking';
      toolName = null;
    }

    if (rec) {
      rec.state = state;
      rec.toolName = toolName;
    }

    const out = { state, progress: true, noise: false };
    if (state === 'tool_running' && toolName) out.toolName = toolName;
    return out;
  }

  function onPromptSent(sessionId, turnId) {
    const rec = record(sessionId);
    if (rec.state === 'escalated') return { state: 'escalated', guarded: true };
    rec.state = 'thinking';
    rec.toolName = null;
    rec.turnId = turnId ?? rec.turnId;
    rec.quarantined = false;
    return { state: 'thinking' };
  }

  function onPromptSettled(sessionId, { stopReason } = {}) {
    const rec = record(sessionId);
    // 升级是终态：回合结算不得把它拉回 idle（取消走 onCancelled）。
    if (rec.state === 'escalated') return { state: 'escalated', stopReason: stopReason ?? null, guarded: true };
    rec.state = 'idle';
    rec.toolName = null;
    return { state: 'idle', stopReason: stopReason ?? null };
  }

  function onOutputSubmitted(sessionId) {
    const rec = record(sessionId);
    if (rec.state === 'escalated') return { state: 'escalated', guarded: true };
    rec.state = 'waiting_dependency';
    return { state: 'waiting_dependency' };
  }

  function onWaitingInput(sessionId, permissionAction) {
    const rec = record(sessionId);
    if (rec.state === 'escalated') return { state: 'escalated', guarded: true };
    rec.state = 'waiting_input';
    return { state: 'waiting_input', permissionAction: permissionAction ?? null };
  }

  /**
   * 审批请求到达（应答之前）：会话进入 waiting_input。
   * `action` 是 toolCall.title（如 write），缺省退回 toolCallId。
   * 注意：只改会话，不动节点（BR-03）。
   */
  function onPermissionRequested({ sessionId, toolCallId, action } = {}) {
    const rec = record(sessionId);
    if (rec.state === 'escalated') return { state: 'escalated', guarded: true };
    rec.state = 'waiting_input';
    lastPermissionSession = rec.sessionId;
    return {
      state: 'waiting_input',
      permissionAction: action ?? toolCallId ?? null,
      toolName: rec.toolName ?? null,
    };
  }

  /**
   * 审批应答后：allow → thinking（放行后继续执行），reject → idle（本次放弃）。
   * 允许只传 {decision}，沿用最近一次 requestPermission 的会话。
   */
  function onPermissionSettled({ sessionId, decision } = {}) {
    const rec = record(sessionId ?? lastPermissionSession ?? undefined);
    if (rec.state === 'escalated') return { state: 'escalated', decision: decision ?? null, guarded: true };
    const allowed = decision === 'allow' || decision === 'allowed' || decision === 'allow-once';
    rec.state = allowed ? 'thinking' : 'idle';
    if (!allowed) rec.toolName = null;
    return { state: rec.state, decision: decision ?? null };
  }

  function onCancelled(sessionId) {
    const rec = record(sessionId);
    rec.state = 'idle';
    rec.toolName = null;
    rec.quarantined = true;
    return { state: 'idle', quarantined: true };
  }

  function onEscalated(sessionId) {
    // 升级事务同时置 quarantined：宿主迟到的帧一律丢弃（C-08 / AC-39）。
    const rec = record(sessionId);
    rec.state = 'escalated';
    rec.quarantined = true;
    return { state: 'escalated', quarantined: true };
  }

  function getSession(sessionId) {
    const rec = sessions.get(sessionId);
    return rec ? { ...rec } : null;
  }

  function snapshot() {
    return {
      counters: { ...counters },
      sessions: [...sessions.values()].map((r) => ({ ...r })),
    };
  }

  return {
    reduce,
    isTurnEvent,
    onPromptSent,
    onPromptSettled,
    onOutputSubmitted,
    onWaitingInput,
    onPermissionRequested,
    onPermissionSettled,
    onCancelled,
    onEscalated,
    getSession,
    snapshot,
    stateOf: (sessionId) => sessions.get(sessionId)?.state ?? null,
  };
}

function prevStateOf(prev) {
  return prev && typeof prev === 'object' && typeof prev.state === 'string' ? prev.state : null;
}
