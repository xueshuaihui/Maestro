/**
 * 渲染层：把结构化快照 / 事件变成**给用户看的那一行**（拆分文档 §2.14）。
 *
 * 纪律：
 * 1. 状态名一律取自 `labels.js`，本文件不复制状态名表；这里只保留层名前缀
 *    （实例 / 节点 / 会话 / 交接包，需求附录 A 的“避免混读”）与格式模板。
 * 2. 时间戳一律本地时区 `HH:mm:ss`；时长一律走 `labels.formatDuration`。
 * 3. 失败原因里的宿主原文（`params.raw`）原样拼入，不截断、不改写（BR-12 / AC-22）。
 * 4. 任何函数都不读文件、不发 IPC，纯函数，便于单测。
 */
import {
  CLI_NOTE,
  ERROR_TEMPLATE,
  HANDOFF_LABEL,
  INSTANCE_LABEL,
  NODE_LABEL,
  SESSION_LABEL,
  formatDuration,
} from './labels.js';

/** 层名前缀（需求附录 A）。中文只此一处，其余状态名全部来自 labels.js。 */
const LAYER = Object.freeze({ instance: '实例', node: '节点', session: '会话', handoff: '交接包' });

const STATE_LABEL = Object.freeze({
  instance: INSTANCE_LABEL,
  node: NODE_LABEL,
  session: SESSION_LABEL,
  handoff: HANDOFF_LABEL,
});

/** 交接包拒绝原因的人话（是原因词，不是状态名；labels.js 里没有原因词）。 */
const REJECT_REASON = Object.freeze({
  withdrawn: '已撤回',
  permission_denied: '审批被拒',
  target_rejected: '目标拒绝',
});

const TERMINAL_INSTANCE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

const USAGE_LINES = Object.freeze([
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>]',
  '  orch status [--instance <实例号>] [--events]',
  '  orch cancel --instance <实例号>',
  '  orch core stop',
]);

// ---------------------------------------------------------------- 基础工具

function pad2(value) {
  return String(value).padStart(2, '0');
}

/** 本地时区 `HH:mm:ss`；无法解析返回 null。 */
export function formatClock(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value ?? '');
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function stateLabel(object, state) {
  if (typeof state !== 'string' || state.length === 0) return null;
  const table = STATE_LABEL[object];
  return table?.[state] ?? state;
}

function layerName(object) {
  return LAYER[object] ?? String(object ?? '?');
}

function durationBetween(fromIso, toIso) {
  const from = Date.parse(fromIso ?? '');
  const to = Date.parse(toIso ?? '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, to - from);
}

/** “已运行 Ns”：优先用快照里的 elapsedMs，缺失时按 stateSince 回算（不自己记时间）。 */
function sessionElapsed(snapshot, nowMs) {
  if (Number.isFinite(snapshot?.elapsedMs)) return formatDuration(snapshot.elapsedMs);
  const since = Date.parse(snapshot?.session?.stateSince ?? snapshot?.stateSince ?? '');
  if (Number.isFinite(since) && Number.isFinite(nowMs)) return formatDuration(nowMs - since);
  return formatDuration(0);
}

/**
 * 同上，但“取不到时长”时返回 null 而不是 `0s`。
 * 用于工具调用行：没有时长信息时不硬造 `已运行 0s`（AC-03 的时长必须来自快照）。
 */
function sessionElapsedOrNull(snapshot, nowMs) {
  if (Number.isFinite(snapshot?.elapsedMs)) return formatDuration(snapshot.elapsedMs);
  const since = Date.parse(snapshot?.session?.stateSince ?? snapshot?.stateSince ?? '');
  if (Number.isFinite(since) && Number.isFinite(nowMs)) return formatDuration(nowMs - since);
  return null;
}

// ---------------------------------------------------------------- 实例

/** '实例 INST-001 · 运行中' */
export function renderInstanceLine(snapshot) {
  const id = snapshot?.instanceId ?? '?';
  const label = stateLabel('instance', snapshot?.state) ?? '?';
  return `${LAYER.instance} ${id} · ${label}`;
}

/** `orch status` 无参数时的一行摘要：实例号、状态、节点、会话、耗时、更新时间。 */
export function renderInstanceListRow(item, snapshot) {
  const id = item?.instanceId ?? snapshot?.instanceId ?? '?';
  const instanceState = stateLabel('instance', snapshot?.state ?? item?.state) ?? '?';
  const nodeState = stateLabel('node', snapshot?.node?.state ?? item?.nodeState) ?? '-';
  const sessionState = stateLabel('session', snapshot?.session?.state ?? item?.sessionState) ?? '-';
  // 耗时优先取节点真实执行区间；运行中的实例退回快照的 elapsedMs。
  const nodeMs = durationBetween(snapshot?.node?.startedAt, snapshot?.node?.endedAt);
  const rawMs = nodeMs ?? (Number.isFinite(snapshot?.elapsedMs) ? snapshot.elapsedMs : null);
  const elapsed = rawMs === null ? '-' : formatDuration(rawMs);
  const updated = formatClock(snapshot?.updatedAt ?? item?.updatedAt) ?? '-';
  return `${LAYER.instance} ${id} · ${instanceState} · ${LAYER.node} ${nodeState} · ${LAYER.session} ${sessionState} · 耗时 ${elapsed} · 更新 ${updated}`;
}

/** 快照损坏的实例仍然出现在列表里，不能假装“没有这个实例”（AC-13 的反面）。 */
export function renderInstanceUnreadable(item) {
  const id = item?.instanceId ?? '?';
  return `${LAYER.instance} ${id} · 状态不可读`;
}

export function renderInstanceMissing(instanceId) {
  return `${LAYER.instance} ${instanceId ?? '?'} · 不存在`;
}

export function renderNoInstances() {
  return `${LAYER.instance} 无`;
}

/** '实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中'（AC-12） */
export function renderInterruptedNote(snapshot) {
  const id = snapshot?.instanceId ?? '?';
  const nodeState = stateLabel('node', snapshot?.node?.state) ?? '-';
  const sessionState = stateLabel('session', snapshot?.session?.state) ?? '-';
  return `${LAYER.instance} ${id} · ${INSTANCE_LABEL.interrupted} ｜ 停在节点 ${nodeState} / ${LAYER.session} ${sessionState}`;
}

/**
 * '实例 INST-001 · 已中断 ｜ 核心已停止'
 * 用于 `orch run` 等不到核心回包、且重连也取不到快照时（C-3）。
 */
export function renderCoreGoneNote(instanceId) {
  return CLI_NOTE.CORE_GONE_NOTE.replace('{id}', instanceId ?? '?');
}

// ---------------------------------------------------------------- 会话

/**
 * '会话 执行中 · 已运行 3s' | '会话 执行中 · 调用工具（write）· 已运行 3s'
 * | '会话 等待审批：write' | '会话 等待下游' | '会话 空闲'
 * 没有会话时返回 null（由调用方决定是否跳过这一行）。
 */
export function renderSessionLine(snapshot, nowMs) {
  const session = snapshot?.session;
  if (!session) return null;
  const label = stateLabel('session', session.state);
  if (!label) return null;

  if (session.state === 'thinking') {
    return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs)}`;
  }
  if (session.state === 'tool_running') {
    const tool = typeof session.toolName === 'string' && session.toolName.trim() ? session.toolName.trim() : null;
    if (!tool) return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs)}`;
    // 工具名段保持 AC-16 的 `执行中 · 调用工具（<工具名>）`，再补时长满足 AC-03。
    const elapsed = sessionElapsedOrNull(snapshot, nowMs);
    return elapsed
      ? `${LAYER.session} ${label} · 调用工具（${tool}） · 已运行 ${elapsed}`
      : `${LAYER.session} ${label} · 调用工具（${tool}）`;
  }
  if (session.state === 'waiting_input') {
    // 契约里 `pendingPermission` 允许是动作名，也可能是 `{action}` 结构（核心两种都出现过）
    const pending = session.pendingPermission;
    const action =
      (typeof pending === 'string' && pending.length > 0 ? pending : null) ??
      (pending && typeof pending === 'object' ? pending.action ?? null : null) ??
      session.permissionAction ??
      null;
    return action ? `${LAYER.session} ${label}：${action}` : `${LAYER.session} ${label}`;
  }
  return `${LAYER.session} ${label}`;
}

/**
 * '会话 执行中 · 已运行 8m · 无新事件'
 * 只在 `snapshot.sessionStalled === true` 时返回，否则 null（AC-23：不擅自判失败）。
 */
export function renderSessionStall(snapshot, nowMs) {
  if (snapshot?.sessionStalled !== true) return null;
  const state = snapshot?.session?.state;
  // “无新事件”只对执行中的会话有意义；空闲/等待下游不该被说成卡住。
  if (state !== 'thinking' && state !== 'tool_running') return null;
  const label = stateLabel('session', state) ?? '?';
  return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs)} · 无新事件`;
}

/** '会话已创建 sess-xxxx'（需求 2.2 第 2 行，原文不带间隔号） */
export function renderSessionCreated(sessionId) {
  return `${LAYER.session}已创建 ${sessionId ?? '?'}`;
}

export function renderTaskSubmitted() {
  return '任务已投递';
}

/** '会话 等待下游 · 产出已提交'（需求 2.2 第 5 行） */
export function renderSessionSubmitted(snapshot, nowMs) {
  const line = renderSessionLine(snapshot, nowMs);
  return line ? `${line} · 产出已提交` : null;
}

// ---------------------------------------------------------------- 节点

/** '节点 已完成 · 耗时 1m12s' | '节点 待校验' | '节点 失败 · 核对失败：…' */
export function renderNodeLine(snapshot) {
  const node = snapshot?.node;
  if (!node) return null;
  const label = stateLabel('node', node.state);
  if (!label) return null;

  if (node.state === 'done') {
    const ms = durationBetween(node.startedAt, node.endedAt ?? snapshot?.updatedAt);
    return ms === null
      ? `${LAYER.node} ${label}`
      : `${LAYER.node} ${label} · 耗时 ${formatDuration(ms)}`;
  }
  if (node.state === 'failed') {
    const failure = renderNodeFailure(snapshot);
    return failure ? `${LAYER.node} ${label} · ${failure}` : `${LAYER.node} ${label}`;
  }
  return `${LAYER.node} ${label}`;
}

/**
 * 节点失败原因（不含层名前缀）：核对失败 / 会话失效 / 执行失败 / 审批被拒 / 未知错误。
 * 只做归类与文案拼接，判定仍是核心的责任。
 */
export function renderNodeFailure(snapshot) {
  const failure = snapshot?.node?.failure;
  if (!failure || typeof failure !== 'object') return null;
  const message = typeof failure.message === 'string' ? failure.message : null;
  const code = failure.code;

  if (code === 'MISSING' || code === 'EMPTY' || code === 'VERIFY_FAILED') {
    return renderErrorBody('VERIFY_FAILED', { reason: message });
  }
  // 会话失效是"跑起来之后"的独立原因，不能落进未知错误（AC-20 / BR-13）。
  if (code === 'SESSION_INVALID') {
    return renderErrorBody('SESSION_INVALID', {});
  }
  // 主路径在 run.start 就拦住 NODE_BUSY 并直接返回；这里只是防御（AC-07）。
  if (code === 'NODE_BUSY') {
    return renderErrorBody('NODE_BUSY', {});
  }
  if (code === 'PERMISSION_DENIED') {
    return renderErrorBody('PERMISSION_DENIED', {
      step: failure.step ?? snapshot?.session?.toolName ?? message,
    });
  }
  if (code === 'HOST_ERROR' || code === 'UNKNOWN_ERROR') {
    return renderErrorBody(code, { raw: message });
  }
  return renderErrorBody('UNKNOWN_ERROR', { raw: message ?? code });
}

// ---------------------------------------------------------------- 交接包

/**
 * 四行（或更少），按 created → delivered → accepted → consumed → rejected 的时间戳依次输出：
 *   '交接包 HO-001  已构造   10:30:02'
 */
export function renderHandoffLines(snapshot) {
  const handoff = snapshot?.handoff;
  if (!handoff) return [];
  const order = [
    ['createdAt', 'created'],
    ['deliveredAt', 'delivered'],
    ['acceptedAt', 'accepted'],
    ['consumedAt', 'consumed'],
    ['rejectedAt', 'rejected'],
  ];

  const lines = [];
  for (const [field, state] of order) {
    const time = formatClock(handoff[field]);
    if (!time) continue;
    const label = HANDOFF_LABEL[state] ?? state;
    let suffix = '';
    if (state === 'rejected') {
      const reason = REJECT_REASON[handoff.rejectReason] ?? handoff.rejectReason ?? null;
      if (reason) suffix = `  原因 ${reason}`;
    }
    lines.push(`${LAYER.handoff} ${handoff.handoffId}  ${label}   ${time}${suffix}`);
  }
  return lines;
}

/**
 * '交接包 HO-001  已投递   等待目标响应 · 已等待 2m'
 * 仅在 `handoff.state === 'delivered'` 且实例未终态时出现（AC-24：绝不显示“已过期”）。
 */
export function renderHandoffWait(snapshot, nowMs) {
  const handoff = snapshot?.handoff;
  if (!handoff || handoff.state !== 'delivered') return null;
  if (TERMINAL_INSTANCE.has(snapshot?.state)) return null;

  let waitMs = snapshot?.handoffWaitMs;
  if (!Number.isFinite(waitMs)) {
    const deliveredAt = Date.parse(handoff.deliveredAt ?? '');
    waitMs = Number.isFinite(deliveredAt) && Number.isFinite(nowMs) ? nowMs - deliveredAt : 0;
  }
  const label = HANDOFF_LABEL.delivered;
  return `${LAYER.handoff} ${handoff.handoffId}  ${label}   等待目标响应 · 已等待 ${formatDuration(waitMs)}`;
}

/** `orch cancel` 的三行：会话空闲 / 节点已取消 / 交接包已拒绝（已撤回）。 */
export function renderCancelLines({ session, node, handoff } = {}) {
  const lines = [];

  if (session) {
    const label = stateLabel('session', session.state) ?? '?';
    lines.push(`${LAYER.session} ${label}`);
  }
  if (node) {
    const label = stateLabel('node', node.state) ?? '?';
    lines.push(`${LAYER.node} ${label}`);
  }
  if (handoff) {
    const label = HANDOFF_LABEL[handoff.state] ?? handoff.state ?? '?';
    let line = `${LAYER.handoff} ${handoff.handoffId ?? '?'} ${label}`;
    const reason = REJECT_REASON[handoff.rejectReason];
    if (handoff.state === 'rejected' && reason) line += `（${reason}）`;
    lines.push(line);
  }
  return lines;
}

// ---------------------------------------------------------------- 事件

/** '10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event' */
export function renderEventLine(event) {
  if (!event || typeof event !== 'object') return null;
  const ts = formatClock(event.ts) ?? '--:--:--';
  const layer = layerName(event.object);
  const id = event.objectId ?? '?';

  const from = stateLabel(event.object, event.from);
  const to = stateLabel(event.object, event.to);

  let middle;
  if (from && to) {
    if (from !== to) {
      middle = `${from} → ${to}`;
    } else {
      // thinking 与 tool_running 都显示“执行中”：原样打会变成“执行中 → 执行中”，
      // 补上触发事件名才看得出这一条发生了什么（AC-14 / BR-10）。
      const trigger = event.detail?.event;
      middle = typeof trigger === 'string' && trigger.length > 0 ? `${from} → ${to}（${trigger}）` : from;
    }
  } else if (to) {
    middle = to;
  } else if (from) {
    middle = from;
  } else {
    const note = event.detail?.note;
    middle = typeof note === 'string' && note.length > 0 ? note : String(event.reason ?? '');
  }

  const reason = typeof event.reason === 'string' && event.reason.length > 0 ? `  原因 ${event.reason}` : '';
  return `${ts}  ${layer} ${id}  ${middle}${reason}`;
}

/** '10:31:20  节点 T-001  拒绝的迁移：已完成 → 执行中' */
export function renderRejectedTransition(event) {
  if (!event || typeof event !== 'object') return null;
  const ts = formatClock(event.ts) ?? '--:--:--';
  const layer = layerName(event.object);
  const id = event.objectId ?? '?';
  const from = stateLabel(event.object, event.from) ?? String(event.from ?? '?');
  const to = stateLabel(event.object, event.to) ?? String(event.to ?? '?');
  return `${ts}  ${layer} ${id}  拒绝的迁移：${from} → ${to}`;
}

// ---------------------------------------------------------------- 错误

const PLACEHOLDERS = ['cause', 'path', 'step', 'raw', 'reason', 'state'];

function placeholderValue(name, params) {
  const value = params?.[name];
  if (value === undefined || value === null) return null;
  if (name === 'state') return stateLabel('instance', value) ?? String(value);
  const text = typeof value === 'string' ? value : String(value);
  return text.length > 0 ? text : null;
}

/** 只拼文案，不做附加（`renderError` 的公共内核，节点行也复用）。 */
function renderErrorBody(code, params = {}) {
  const template = ERROR_TEMPLATE[code] ?? ERROR_TEMPLATE.UNKNOWN_ERROR;
  let raw = params?.raw ?? params?.message ?? params?.cause ?? null;
  // 未知失败码（如 IPC_CLOSED）至少把 code 透出来，不显示成 “未知错误：?”
  if ((raw === null || raw === undefined) && !Object.prototype.hasOwnProperty.call(ERROR_TEMPLATE, code)) {
    raw = code ?? null;
  }
  const filled = { ...params, raw };

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    if (!PLACEHOLDERS.includes(name)) return match;
    const value = placeholderValue(name, filled);
    return value === null ? '?' : value;
  });
}

/**
 * 9 条失败文案 + `STATE_CORRUPT` + `INSTANCE_TERMINAL`。
 * `params.raw` 原样拼入（含换行与长文本），不截断、不改写。
 * `STATE_CORRUPT` 若带 `backupPath`，追加实际备份路径（AC-13）。
 */
export function renderError({ code, params = {} } = {}) {
  let text = renderErrorBody(code, params);
  if (code === 'STATE_CORRUPT' && typeof params?.backupPath === 'string' && params.backupPath.length > 0) {
    text += `（${params.backupPath}）`;
  }
  return text;
}

// ---------------------------------------------------------------- 核心进程

/** '核心已停止（pid 1234，运行 8m）' */
export function renderCoreStopped({ pid, startedAt } = {}, nowMs = Date.now()) {
  const since = Date.parse(startedAt ?? '');
  const uptime = Number.isFinite(since) ? formatDuration(nowMs - since) : null;
  const id = pid ?? '?';
  return uptime === null ? `核心已停止（pid ${id}）` : `核心已停止（pid ${id}，运行 ${uptime}）`;
}

/** '核心未在 5s 内退出（pid …），可再次执行 orch core stop' */
export function renderCoreStopTimeout(pid) {
  return `核心未在 5s 内退出（pid ${pid ?? '?'}），可再次执行 orch core stop`;
}

export function renderCoreNotRunning() {
  return '核心未在运行';
}

// ---------------------------------------------------------------- 用法

export function renderUsage(message) {
  const lines = message ? [...USAGE_LINES, `  （${message}）`] : [...USAGE_LINES];
  return lines.join('\n');
}
