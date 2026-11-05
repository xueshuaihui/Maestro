/**
 * 渲染层：把结构化快照 / 事件变成**给用户看的那一行**（拆分文档 §2.13）。
 *
 * 纪律：
 * 1. 状态名一律取自 `labels.js`，本文件不复制状态名表；这里只保留层名前缀
 *    （实例 / 节点 / 会话 / 交接包 / 升级，需求附录 A 的“避免混读”）与格式模板。
 * 2. 时间戳一律本地时区 `HH:mm:ss`；时长一律走 `labels.formatDuration`。
 * 3. 失败原因里的宿主原文（`params.raw`）原样拼入，不截断、不改写（BR-12 / AC-22）。
 * 4. 任何函数都不读文件、不发 IPC，纯函数，便于单测。
 * 5. `single` 是 I1.1 红线：同一函数按 `template` 分流时，`single` 分支逐字保持
 *    I1.1 版式；`code-loop` 才加模板、轮次、判定、方向、序号与升级块。
 */
import {
  CLI_NOTE,
  ERROR_TEMPLATE,
  ESCALATION_BLOCK,
  ESCALATION_LABEL,
  ESCALATION_SUMMARY_LINE,
  HANDOFF_LABEL,
  HANDOFF_REJECT_REASON,
  INSTANCE_LABEL,
  INSTANCE_STOPPED_SUFFIX,
  LAYER,
  NEXT_STEP_HALTED,
  NEXT_STEP_SUSPENDED,
  NODE_LABEL,
  NODE_QUALIFIER,
  NODE_SUFFIX,
  REASON_LABEL,
  ROLE_LABEL,
  SESSION_LABEL,
  TEMPLATE_LABEL,
  BACKFLOW_DEFECT_LINE,
  BACKFLOW_RETEST_LINE,
  formatDuration,
  formatHandoffDirection,
} from './labels.js';

const STATE_LABEL = Object.freeze({
  instance: INSTANCE_LABEL,
  node: NODE_LABEL,
  session: SESSION_LABEL,
  handoff: HANDOFF_LABEL,
  escalation: ESCALATION_LABEL,
});

/** 交接包拒绝原因的人话（labels.js 的 `HANDOFF_REJECT_REASON`，D-5）。 */
const REJECT_REASON = HANDOFF_REJECT_REASON;

/** D-4：`suspended` 不在这里——它决定是否打“等待目标响应”，挂起仍然可以等。 */
const TERMINAL_INSTANCE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

const BACKFLOW_DETAIL_INDENT = '      ';

const USAGE_LINES = Object.freeze([
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
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

function roleLabel(roleId) {
  if (typeof roleId !== 'string' || roleId.length === 0) return null;
  return ROLE_LABEL[roleId] ?? roleId;
}

function templateLabel(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  return TEMPLATE_LABEL[name] ?? name;
}

function durationBetween(fromIso, toIso) {
  const from = Date.parse(fromIso ?? '');
  const to = Date.parse(toIso ?? '');
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, to - from);
}

function replaceAll(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

// ---------------------------------------------------------------- 快照适配（v2 数组 / v1 单对象）

/**
 * v2 快照读数组，v1 快照读单对象。所有渲染函数都经过这里，
 * 因此 WP-4 尚未落地 `nodes[]` 时 `single` 的旧路径照常工作（契约兼容缺省）。
 */
export function snapshotView(snapshot) {
  const nodes = Array.isArray(snapshot?.nodes)
    ? snapshot.nodes
    : snapshot?.node
      ? [snapshot.node]
      : [];
  const sessions = Array.isArray(snapshot?.sessions)
    ? snapshot.sessions
    : snapshot?.session
      ? [snapshot.session]
      : [];
  const handoffs = Array.isArray(snapshot?.handoffs)
    ? snapshot.handoffs
    : snapshot?.handoff
      ? [snapshot.handoff]
      : [];
  const escalations = Array.isArray(snapshot?.escalations) ? snapshot.escalations : [];
  const template =
    typeof snapshot?.template === 'string' && snapshot.template.length > 0 ? snapshot.template : 'single';
  return {
    nodes,
    sessions,
    handoffs,
    escalations,
    template,
    node: nodes[0] ?? null,
    // 会话只渲染“当前（或最后一个）”一条。
    session: sessions.length > 0 ? sessions[sessions.length - 1] : null,
    handoff: handoffs.length > 0 ? handoffs[handoffs.length - 1] : null,
  };
}

function templateOf(snapshot, explicit) {
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;
  return snapshotView(snapshot).template;
}

/**
 * 产物策略（需求 D-6）：核心把图级 `productPolicy` 放进只读快照；本迭代新增的
 * 限定词、后缀与耗时支只对 `doc-single` 生效，`single` / `code-loop` 逐字不变。
 * 快照没带该字段时按模板兜底，保证裸快照的既有用例（`single` / `code-loop`）走 `declared`。
 */
function productPolicyOf(snapshot, template) {
  const declared = snapshot?.productPolicy;
  if (typeof declared === 'string' && declared.length > 0) return declared;
  return template === 'task-loop' ? 'doc-single' : 'declared';
}

function nodeIdOf(node) {
  const id = node?.nodeId ?? node?.id ?? null;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** 会话行 / 会话收尾行的时长来源：优先 `elapsedMs`，其次 `stateSince` 回算。 */
function sessionElapsed(snapshot, nowMs, session, { nullable = false } = {}) {
  if (Number.isFinite(snapshot?.elapsedMs)) return formatDuration(snapshot.elapsedMs);
  const since = Date.parse(session?.stateSince ?? snapshot?.session?.stateSince ?? snapshot?.stateSince ?? '');
  if (Number.isFinite(since) && Number.isFinite(nowMs)) return formatDuration(nowMs - since);
  return nullable ? null : formatDuration(0);
}

// ---------------------------------------------------------------- 实例

/** '实例 INST-001 · 运行中'；`code-loop` 追加 '· 已停止推进' 与 '· 模板 编码闭环'。 */
export function renderInstanceLine(snapshot) {
  const id = snapshot?.instanceId ?? '?';
  const label = stateLabel('instance', snapshot?.state) ?? '?';
  const template = templateOf(snapshot);

  const parts = [`${LAYER.instance} ${id} · ${label}`];
  if (template !== 'single') {
    if (snapshot?.halted === true) parts.push(INSTANCE_STOPPED_SUFFIX);
    const name = templateLabel(template);
    if (name) parts.push(`模板 ${name}`);
  }
  return parts.join(' · ');
}

/** 列表行耗时：节点真实执行区间的并集起点→终点；运行中退回 `elapsedMs`。 */
function listElapsed(item, snapshot) {
  const { nodes } = snapshotView(snapshot);
  let from = null;
  let to = null;
  for (const node of nodes) {
    const start = Date.parse(node?.startedAt ?? '');
    if (!Number.isFinite(start)) continue;
    if (from === null || start < from) from = start;
    const end = Date.parse(node?.endedAt ?? '');
    if (Number.isFinite(end) && (to === null || end > to)) to = end;
  }
  if (from !== null && to !== null) return formatDuration(Math.max(0, to - from));
  if (Number.isFinite(snapshot?.elapsedMs)) return formatDuration(snapshot.elapsedMs);
  if (item?.elapsedMs !== undefined && Number.isFinite(item.elapsedMs)) return formatDuration(item.elapsedMs);
  return '-';
}

/**
 * `orch status` 无参数时的一行摘要：
 * `实例 <号> · <状态>[ · 模板 <名>][ · 待处理升级 N] · 节点 <状态> · 会话 <状态> · 耗时 <d> · 更新 <时间>`
 * `single` / v1 实例不打印模板与待处理升级（A-2）。
 */
export function renderInstanceListRow(item, snapshot) {
  const view = snapshotView(snapshot);
  const id = item?.instanceId ?? snapshot?.instanceId ?? '?';
  const instanceState = stateLabel('instance', snapshot?.state ?? item?.state) ?? '?';
  const template =
    typeof snapshot?.template === 'string' && snapshot.template.length > 0
      ? snapshot.template
      : typeof item?.template === 'string' && item.template.length > 0
        ? item.template
        : 'single';
  const showTemplate = template !== 'single' && !(Number.isInteger(item?.schemaVersion) && item.schemaVersion < 2);

  const nodeState = stateLabel('node', view.node?.state ?? item?.nodeState) ?? '-';
  const sessionState = stateLabel('session', view.session?.state ?? item?.sessionState) ?? '-';
  const elapsed = listElapsed(item, snapshot);
  const updated = formatClock(snapshot?.updatedAt ?? item?.updatedAt) ?? '-';

  const parts = [`${LAYER.instance} ${id} · ${instanceState}`];
  if (showTemplate) {
    const name = templateLabel(template);
    if (name) parts.push(`模板 ${name}`);
    const pending = pendingEscalationCount(item, snapshot);
    if (pending > 0) parts.push(`待处理升级 ${pending}`);
  }
  parts.push(`${LAYER.node} ${nodeState}`);
  parts.push(`${LAYER.session} ${sessionState}`);
  parts.push(`耗时 ${elapsed}`);
  parts.push(`更新 ${updated}`);
  return parts.join(' · ');
}

function pendingEscalationCount(item, snapshot) {
  if (Number.isInteger(item?.pendingEscalations)) return item.pendingEscalations;
  const { escalations } = snapshotView(snapshot);
  return escalations.filter((entry) => entry?.state === 'pending').length;
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

/**
 * '实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中'（AC-12 / AC-45）
 *
 * 停点必须是真正卡住的那一条：核心在只读快照里点名 `interruptedNodeId`
 * （选取规则与 `markInterrupted` 相同）。旧模板的快照不带该字段，回落 `nodes[0]`。
 */
export function renderInterruptedNote(snapshot) {
  const view = snapshotView(snapshot);
  const id = snapshot?.instanceId ?? '?';
  const nominated = typeof snapshot?.interruptedNodeId === 'string' ? snapshot.interruptedNodeId : null;
  const stuck = nominated === null
    ? view.node
    : view.nodes.find((item) => nodeIdOf(item) === nominated) ?? view.node;
  const nodeState = stateLabel('node', stuck?.state) ?? '-';
  const sessionState = stateLabel('session', view.session?.state) ?? '-';
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
 * 六种分支（需求 A-2 第 4 段 / M-12）：
 *   '会话 空闲' | '会话 执行中 · 已运行 3s' | '会话 执行中 · 调用工具（write） · 已运行 3s'
 *   '会话 等待审批：write' | '会话 等待下游' | '会话 已升级'
 * 只渲染当前（最后一个）会话；没有会话时返回 null。
 */
export function renderSessionLine(snapshot, nowMs, { template } = {}) {
  void template; // 六种分支两模板一致；参数保留是为 §2.13 的签名契约。
  const view = snapshotView(snapshot);
  const session = view.session;
  if (!session) return null;
  const label = stateLabel('session', session.state);
  if (!label) return null;

  if (session.state === 'thinking') {
    return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs, session)}`;
  }
  if (session.state === 'tool_running') {
    const tool = typeof session.toolName === 'string' && session.toolName.trim() ? session.toolName.trim() : null;
    if (!tool) return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs, session)}`;
    const elapsed = sessionElapsed(snapshot, nowMs, session, { nullable: true });
    return elapsed
      ? `${LAYER.session} ${label} · 调用工具（${tool}） · 已运行 ${elapsed}`
      : `${LAYER.session} ${label} · 调用工具（${tool}）`;
  }
  if (session.state === 'waiting_input') {
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
  const session = snapshotView(snapshot).session;
  const state = session?.state;
  if (state !== 'thinking' && state !== 'tool_running') return null;
  const label = stateLabel('session', state) ?? '?';
  return `${LAYER.session} ${label} · 已运行 ${sessionElapsed(snapshot, nowMs, session)} · 无新事件`;
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

/** 升级未记录时“升级前的那个节点”：优先快照点名，其次最后一条待处理升级。 */
function haltTargetId(snapshot) {
  if (typeof snapshot?.haltedNodeId === 'string' && snapshot.haltedNodeId.length > 0) return snapshot.haltedNodeId;
  if (typeof snapshot?.haltNodeId === 'string' && snapshot.haltNodeId.length > 0) return snapshot.haltNodeId;
  const { nodes, escalations } = snapshotView(snapshot);
  const last = escalations[escalations.length - 1];
  if (last && typeof last.nodeId === 'string') return last.nodeId;
  for (const state of ['review', 'running', 'pending', 'failed', 'done']) {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      if (nodes[i]?.state === state) return nodeIdOf(nodes[i]);
    }
  }
  return null;
}

/**
 * 节点限定词（需求 A-2 第 3 段；判定顺序固定，不得重排）。
 *
 *   `single` / `escalated` 短路 → `halted` → `review`（按 `reviewReason`，仅 `doc-single`）
 *   → `failed` + `note === '等待复审'` → 其余 `failed` 兜底 `（等待复测）`
 *
 * `halted` 必须排在 `note` 查表**之前**：带 `note` 的停止推进实例否则会丢掉 `（升级未记录）`。
 * `node.note` 存的是中文原文，不是 `NODE_QUALIFIER` 的键，所以 `等待复审` 走显式分支。
 */
function nodeQualifier(node, snapshot, template, productPolicy) {
  if (template === 'single') return null;
  if (node?.state === 'escalated') return null;

  if (snapshot?.halted === true && nodeIdOf(node) !== null && nodeIdOf(node) === haltTargetId(snapshot)) {
    return NODE_QUALIFIER.escalation_unrecorded;
  }

  if (node?.state === 'review') {
    // 无门控的图该字段恒为 `null`，`review` 渲染为裸「待校验」（B-10，I1.2 逐字不变）
    if (productPolicy !== 'doc-single') return null;
    const reason = node?.reviewReason ?? null;
    if (reason === 'evidence') return NODE_QUALIFIER.evidence_check;
    if (reason === 'downstream') return NODE_QUALIFIER.waiting_downstream;
    return null;
  }

  if (node?.state === 'failed') {
    if (node?.note === '等待复审') return NODE_QUALIFIER.waiting_review;
    // `doc-single` 的 `failed` 只有一个来源且必定带 `等待复审`；兜底在它下面不可达
    if (productPolicy === 'doc-single') return null;
    return NODE_QUALIFIER.waiting_retest;
  }

  return null;
}

/** 节点行后缀（互斥，最多一个；只对 `doc-single` 渲染）。 */
function docSuffix(node, productPolicy) {
  if (productPolicy !== 'doc-single') return null;
  const ref = node?.artifactRefs?.[0]?.ref;
  if (node?.state === 'done' && typeof ref === 'string' && ref.length > 0) {
    return NODE_SUFFIX.artifact.replace('{ref}', ref);
  }
  const decision = node?.review?.decision ?? null;
  if (node?.state === 'done' && decision === 'pass') return NODE_SUFFIX.reviewPassed;
  if (node?.state === 'failed' && decision === 'reject') {
    const review = node.review;
    const count = Number.isInteger(review?.defectCount)
      ? review.defectCount
      : Array.isArray(review?.defects)
        ? review.defects.length
        : 0;
    return NODE_SUFFIX.reviewRejected.replace('{n}', String(count));
  }
  return null;
}

function verdictSuffix(node) {
  const verdict = node?.verdict;
  if (!verdict || typeof verdict !== 'object') return null;
  const value = verdict.value ?? verdict.result ?? verdict.verdict ?? null;
  if (value === 'pass') return '判定 通过';
  if (value === 'fail') {
    const count = Number.isInteger(verdict.defectCount)
      ? verdict.defectCount
      : Array.isArray(verdict.defects)
        ? verdict.defects.length
        : 0;
    return `判定 不通过 · 缺陷 ${count} 条`;
  }
  return null;
}

/**
 * `code-loop` 的节点行：
 * `节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s · 判定 通过`
 * 字段间单空格、不对齐；未派发节点不带轮次与耗时（A-2）。
 */
function renderNodeRow(node, snapshot, template, { forceQualifier = null, noDuration = false } = {}) {
  if (!node) return null;
  const label = stateLabel('node', node.state);
  if (!label) return null;

  const productPolicy = productPolicyOf(snapshot, template);
  const id = nodeIdOf(node);
  const role = roleLabel(node.roleId);
  const qualifier = forceQualifier ?? nodeQualifier(node, snapshot, template, productPolicy);
  const state = qualifier ? `${label}（${qualifier}）` : label;

  const head = [LAYER.node, id, role, state].filter((part) => typeof part === 'string' && part.length > 0).join(' ');

  const parts = [head];
  const round = Number.isInteger(node.round) ? node.round : 0;
  const dispatched = round > 0;
  if (dispatched) parts.push(`第 ${round} 轮`);

  if (!noDuration && dispatched && typeof node.startedAt === 'string' && showsDuration(node, productPolicy)) {
    const ms = durationBetween(node.startedAt, node.endedAt ?? snapshot?.updatedAt);
    if (ms !== null) parts.push(`耗时 ${formatDuration(clampDuration(ms))}`);
  }

  // `declared` 图沿用 I1.2 的判定后缀；`doc-single` 用产物/审核后缀（互斥）
  const suffix = productPolicy === 'doc-single' ? docSuffix(node, productPolicy) : verdictSuffix(node);
  if (suffix) parts.push(suffix.replace(/^·\s*/, ''));

  return parts.join(' · ');
}

/**
 * 是否显示耗时（A-2 第 3 段）。区间来源仍是「首次派发 → endedAt」的累计值。
 * - 基线：`done` / `cancelled`；
 * - `doc-single` 追加：`review(downstream)`（核对通过即写 `endedAt`，等下游那段不计入）
 *   与 `failed` + `等待复审`；
 * - `escalated` 一律抑制（即使 `endedAt` 有值），`review(evidence)` 不显示。
 */
function showsDuration(node, productPolicy) {
  if (node?.state === 'escalated') return false;
  if (node?.state === 'done' || node?.state === 'cancelled') return true;
  if (productPolicy !== 'doc-single') return false;
  if (node?.state === 'review' && node?.reviewReason === 'downstream') return true;
  if (node?.state === 'failed' && node?.note === '等待复审') return true;
  return false;
}

/** 已派发节点的区间接上 `startedAt` 与 `endedAt` 同毫秒时钳到 1s（钳在渲染层）。 */
function clampDuration(ms) {
  return ms === 0 ? 1000 : ms;
}

/** `single` 的 I1.1 节点行（红线，逐字保留）。 */
export function renderNodeLine(snapshot) {
  const node = snapshot?.node ?? snapshotView(snapshot).node;
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

/** 节点表：`single` 1 行（I1.1）、`code-loop` 按节点逐行（A-2 第 3 段）。 */
export function renderNodeLines(snapshot, { template } = {}) {
  const tpl = templateOf(snapshot, template);
  const view = snapshotView(snapshot);
  if (view.nodes.length === 0) return [];
  if (tpl === 'single') {
    const line = renderNodeLine(snapshot);
    return line ? [line] : [];
  }
  const rows = view.nodes
    .map((node) => renderNodeRow(node, snapshot, tpl))
    .filter((line) => typeof line === 'string' && line.length > 0);
  return rows;
}

/**
 * 节点失败原因（不含层名前缀）：核对失败 / 会话失效 / 执行失败 / 审批被拒 / 未知错误。
 * 只做归类与文案拼接，判定仍是核心的责任。
 */
export function renderNodeFailure(snapshot) {
  const view = snapshotView(snapshot);
  const failure = snapshot?.node?.failure ?? view.node?.failure;
  if (!failure || typeof failure !== 'object') return null;
  const message = typeof failure.message === 'string' ? failure.message : null;
  const code = failure.code;

  if (code === 'MISSING' || code === 'EMPTY' || code === 'VERIFY_FAILED') {
    return renderErrorBody('VERIFY_FAILED', { reason: message });
  }
  if (code === 'SESSION_INVALID') {
    return renderErrorBody('SESSION_INVALID', {});
  }
  if (code === 'NODE_BUSY') {
    return renderErrorBody('NODE_BUSY', {});
  }
  if (code === 'PERMISSION_DENIED') {
    return renderErrorBody('PERMISSION_DENIED', {
      step: failure.step ?? view.session?.toolName ?? message,
    });
  }
  if (code === 'HOST_ERROR' || code === 'UNKNOWN_ERROR') {
    return renderErrorBody(code, { raw: message });
  }
  return renderErrorBody('UNKNOWN_ERROR', { raw: message ?? code });
}

// ---------------------------------------------------------------- 交接包

const HANDOFF_ORDER = Object.freeze([
  ['createdAt', 'created'],
  ['deliveredAt', 'delivered'],
  ['acceptedAt', 'accepted'],
  ['consumedAt', 'consumed'],
  ['rejectedAt', 'rejected'],
]);

/** 交接包方向段：`开发→测试` / `测试→开发（回流）` / `开发→测试（复测）`。 */
function handoffDirection(handoff, snapshot) {
  const edge = handoff?.edge;
  if (!edge || typeof edge !== 'object') return null;
  const { nodes } = snapshotView(snapshot);
  const roleOfNodeId = (nodeId) => {
    const node = nodes.find((item) => nodeIdOf(item) === nodeId);
    return roleLabel(node?.roleId) ?? null;
  };
  const from = roleLabel(edge.fromRole) ?? roleOfNodeId(edge.from);
  const to = roleLabel(edge.toRole) ?? roleOfNodeId(edge.to);
  if (!from || !to) return null;
  const kind = typeof edge.kind === 'string' ? edge.kind : 'forward';
  return formatHandoffDirection(from, to, kind);
}

function handoffStateLines(handoff, snapshot, template) {
  const direction = template === 'single' ? null : handoffDirection(handoff, snapshot);
  const lines = [];
  for (const [field, state] of HANDOFF_ORDER) {
    const time = formatClock(handoff?.[field]);
    if (!time) continue;
    const label = HANDOFF_LABEL[state] ?? state;
    let suffix = '';
    if (state === 'rejected') {
      const reason = REJECT_REASON[handoff?.rejectReason] ?? handoff?.rejectReason ?? null;
      if (reason) suffix = `  原因 ${reason}`;
    }
    const segments = [`${LAYER.handoff} ${handoff?.handoffId ?? '?'}`];
    if (direction) segments.push(direction);
    segments.push(label);
    lines.push(`${segments.join('  ')}   ${time}${suffix}`);
  }
  return lines;
}

/**
 * 逐包多状态行（A-2 第 5 段）：
 *   `single`       `交接包 HO-001  已构造   10:30:02`
 *   `code-loop`    `交接包 HO-001  开发→测试  已构造   10:30:02`
 * 按包号、按时间正序；方向只在 `code-loop` 出现（号/方向/状态之间各 2 个空格）。
 */
export function renderHandoffLines(snapshot, { template } = {}) {
  const tpl = templateOf(snapshot, template);
  const handoffs = [...snapshotView(snapshot).handoffs].sort((a, b) => {
    const ka = String(a?.handoffId ?? '');
    const kb = String(b?.handoffId ?? '');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const lines = [];
  for (const handoff of handoffs) {
    for (const line of handoffStateLines(handoff, snapshot, tpl)) lines.push(line);
  }
  return lines;
}

/**
 * '交接包 HO-001  已投递   等待目标响应 · 已等待 2m'
 * 仅在最后一张交接包 `state === 'delivered'` 且实例未终态时出现（AC-24：绝不显示“已过期”）。
 */
export function renderHandoffWait(snapshot, nowMs) {
  const view = snapshotView(snapshot);
  const handoff = view.handoff;
  if (!handoff || handoff.state !== 'delivered') return null;
  if (TERMINAL_INSTANCE.has(snapshot?.state)) return null;

  let waitMs = snapshot?.handoffWaitMs;
  if (!Number.isFinite(waitMs)) {
    const deliveredAt = Date.parse(handoff.deliveredAt ?? '');
    waitMs = Number.isFinite(deliveredAt) && Number.isFinite(nowMs) ? nowMs - deliveredAt : 0;
  }
  const direction = view.template === 'single' ? null : handoffDirection(handoff, snapshot);
  const segments = [`${LAYER.handoff} ${handoff.handoffId ?? '?'}`];
  if (direction) segments.push(direction);
  segments.push(HANDOFF_LABEL.delivered);
  return `${segments.join('  ')}   等待目标响应 · 已等待 ${formatDuration(waitMs)}`;
}

/**
 * `orch cancel` 的结果行：会话 → 节点 → 交接包 → 升级。
 * 接受 v2 数组 `{sessions,nodes,handoffs,escalations}` 与 I1.1 的单对象（兼容保留）。
 */
export function renderCancelLines(result = {}) {
  const lines = [];

  const sessions = Array.isArray(result?.sessions) ? result.sessions : result?.session ? [result.session] : [];
  for (const session of sessions) {
    const label = stateLabel('session', session?.state) ?? '?';
    lines.push(`${LAYER.session} ${label}`);
  }

  const nodes = Array.isArray(result?.nodes) ? result.nodes : result?.node ? [result.node] : [];
  const multi = Array.isArray(result?.nodes);
  for (const node of nodes) {
    const label = stateLabel('node', node?.state) ?? '?';
    if (multi && nodeIdOf(node) !== null) {
      const role = roleLabel(node?.roleId);
      lines.push([LAYER.node, nodeIdOf(node), role, label].filter(Boolean).join(' '));
    } else {
      lines.push(`${LAYER.node} ${label}`);
    }
  }

  const handoffs = Array.isArray(result?.handoffs) ? result.handoffs : result?.handoff ? [result.handoff] : [];
  for (const handoff of handoffs) {
    const label = HANDOFF_LABEL[handoff?.state] ?? handoff?.state ?? '?';
    let line = `${LAYER.handoff} ${handoff?.handoffId ?? '?'} ${label}`;
    const reason = REJECT_REASON[handoff?.rejectReason];
    if (handoff?.state === 'rejected' && reason) line += `（${reason}）`;
    lines.push(line);
  }

  const escalations = Array.isArray(result?.escalations) ? result.escalations : [];
  for (const escalation of escalations) {
    const label = ESCALATION_LABEL[escalation?.state] ?? escalation?.state ?? '?';
    lines.push(`${LAYER.escalation} ${escalation?.escalationId ?? '?'} ${label}`);
  }

  return lines;
}

// ---------------------------------------------------------------- 升级

function roleOfNode(snapshot, nodeId) {
  const node = snapshotView(snapshot).nodes.find((item) => nodeIdOf(item) === nodeId);
  return roleLabel(node?.roleId) ?? null;
}

/**
 * 升级块（A-2 第 6 段）：
 *   `升级 ESC-001 待处理` + `  原因：…` / `  节点：…` /（缺陷行）/ `  下一步：…`
 * `single` 不打印（连 `升级 —` 也不打）；`code-loop` 无升级时打印 `升级 —`。
 */
export function renderEscalationBlock(snapshot, { template } = {}) {
  const tpl = templateOf(snapshot, template);
  if (tpl === 'single') return [];
  const { escalations } = snapshotView(snapshot);
  if (escalations.length === 0) return [ESCALATION_BLOCK.none];

  const instanceId = snapshot?.instanceId ?? '?';
  const lines = [];
  for (const escalation of escalations) {
    const state = ESCALATION_LABEL[escalation?.state] ?? escalation?.state ?? '?';
    lines.push(replaceAll(ESCALATION_BLOCK.header, { id: escalation?.escalationId ?? '?', state }));
    lines.push(replaceAll(ESCALATION_BLOCK.reason, { detail: escalation?.reasonDetail ?? '?' }));
    lines.push(
      replaceAll(ESCALATION_BLOCK.node, {
        nodeId: escalation?.nodeId ?? '?',
        role: roleOfNode(snapshot, escalation?.nodeId) ?? '?',
        round: Number.isInteger(escalation?.round) ? escalation.round : 0,
      }),
    );
    for (const defect of Array.isArray(escalation?.defects) ? escalation.defects : []) {
      lines.push(replaceAll(ESCALATION_BLOCK.defect, { summary: defect?.summary ?? '', evidence: defect?.evidence ?? '' }));
    }
    lines.push(replaceAll(ESCALATION_BLOCK.next, { id: instanceId }));
  }
  return lines;
}

function lastPendingEscalation(snapshot) {
  const { escalations } = snapshotView(snapshot);
  for (let i = escalations.length - 1; i >= 0; i -= 1) {
    if (escalations[i]?.state === 'pending') return escalations[i];
  }
  return escalations.length > 0 ? escalations[escalations.length - 1] : null;
}

/**
 * `orch run` 的挂起 / 停止推进收尾（附录 A-4，逐字）：
 * - 挂起（退出码 4）：实例行 + 升级摘要 + 下一步，正好三行；
 * - 停止推进（退出码 5）：`无法记录升级：…；已停止推进` + 实例行 + 唯一节点行 + 下一步。
 * 两者都不打印交接包行与等待行。
 */
export function renderRunTail(snapshot, { template } = {}) {
  const tpl = templateOf(snapshot, template);
  const id = snapshot?.instanceId ?? '?';

  if (snapshot?.state === 'suspended') {
    const lines = [renderInstanceLine({ ...snapshot, template: tpl })];
    const escalation = lastPendingEscalation(snapshot);
    if (escalation) {
      lines.push(
        replaceAll(ESCALATION_SUMMARY_LINE, {
          id: escalation.escalationId ?? '?',
          state: ESCALATION_LABEL[escalation.state] ?? escalation.state ?? '?',
          nodeId: escalation.nodeId ?? '?',
          role: roleOfNode(snapshot, escalation.nodeId) ?? '?',
          round: Number.isInteger(escalation.round) ? escalation.round : 0,
        }),
      );
    }
    lines.push(replaceAll(NEXT_STEP_SUSPENDED, { id }));
    return lines;
  }

  if (snapshot?.halted === true) {
    const cause =
      snapshot?.haltCause ??
      snapshot?.haltReason ??
      snapshot?.halt?.cause ??
      snapshot?.escalationWriteCause ??
      null;
    const lines = [renderError({ code: 'ESCALATION_WRITE_FAILED', params: { cause } })];
    lines.push(renderInstanceLine({ ...snapshot, template: tpl }));
    const { nodes } = snapshotView(snapshot);
    const targetId = haltTargetId(snapshot);
    const node = nodes.find((item) => nodeIdOf(item) === targetId) ?? null;
    if (node) {
      lines.push(
        renderNodeRow(node, snapshot, tpl, {
          forceQualifier: NODE_QUALIFIER.escalation_unrecorded,
          noDuration: true,
        }),
      );
    }
    lines.push(replaceAll(NEXT_STEP_HALTED, { id }));
    return lines;
  }

  return [];
}

// ---------------------------------------------------------------- 事件

/** `single`（I1.1 版式）：'10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event' */
function legacyMiddle(event) {
  const from = stateLabel(event.object, event.from);
  const to = stateLabel(event.object, event.to);

  if (from && to) {
    if (from !== to) return `${from} → ${to}`;
    // thinking 与 tool_running 都显示“执行中”：补上触发事件名才看得出发生了什么（AC-14 / BR-10）。
    const trigger = event.detail?.event;
    return typeof trigger === 'string' && trigger.length > 0 ? `${from} → ${to}（${trigger}）` : from;
  }
  if (to) return to;
  if (from) return from;
  const note = event.detail?.note;
  return typeof note === 'string' && note.length > 0 ? note : String(event.reason ?? '');
}

function eventMiddle(event) {
  if (event.reason === 'node.dispatch') return '派发 → 执行中';
  if (event.object === 'escalation' && event.to === 'pending') {
    return ESCALATION_LABEL.pending;
  }
  return legacyMiddle(event);
}

function eventReasonText(event) {
  if (event.reason === 'node.dispatch') {
    const round = Number.isInteger(event.detail?.round) ? event.detail.round : 0;
    return `${REASON_LABEL['node.dispatch']} · 第 ${round} 轮`;
  }
  const label = REASON_LABEL[event.reason];
  return typeof label === 'string' && label.length > 0 ? label : String(event.reason ?? '');
}

/**
 * 事件行（C-10）：
 *   `single`    `10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event`（I1.1 逐字）
 *   `code-loop` `[#18] 10:30:05  交接包 HO-001  已投递 → 已接受  原因 首个事件`
 * `result === 'rejected'` 两种模板都走 I1.1 版式（不带 seq、不带原因）。
 */
export function renderEventLine(event, { template } = {}) {
  if (!event || typeof event !== 'object') return null;
  if (event.result === 'rejected') return renderRejectedTransition(event);

  const ts = formatClock(event.ts) ?? '--:--:--';
  const layer = layerName(event.object);
  const id = event.objectId ?? '?';
  const tpl = typeof template === 'string' && template.length > 0 ? template : 'single';

  if (tpl === 'single') {
    const reason = typeof event.reason === 'string' && event.reason.length > 0 ? `  原因 ${event.reason}` : '';
    return `${ts}  ${layer} ${id}  ${legacyMiddle(event)}${reason}`;
  }

  const seq = Number.isInteger(event.seq) ? `[#${event.seq}] ` : '';
  const reason = typeof event.reason === 'string' && event.reason.length > 0 ? `  原因 ${eventReasonText(event)}` : '';
  return `${seq}${ts}  ${layer} ${id}  ${eventMiddle(event)}${reason}`;
}

/** 回流事件行下的缩进明细（6 空格）：缺陷逐条 + 复测要求（AC-24）。 */
export function renderBackflowDetail(event) {
  if (!event || event.reason !== 'backflow.constructed') return [];
  const detail = event.detail ?? {};
  const lines = [];
  const defects = Array.isArray(detail.defects) ? detail.defects : [];
  for (let i = 0; i < defects.length; i += 1) {
    lines.push(
      `${BACKFLOW_DETAIL_INDENT}${replaceAll(BACKFLOW_DEFECT_LINE, {
        i: i + 1,
        summary: defects[i]?.summary ?? '',
        evidence: defects[i]?.evidence ?? '',
      })}`,
    );
  }
  const text = typeof detail.retestRequirement === 'string' ? detail.retestRequirement : '';
  lines.push(`${BACKFLOW_DETAIL_INDENT}${replaceAll(BACKFLOW_RETEST_LINE, { text })}`);
  return lines;
}

/** 一行事件 + 可选的缩进明细；`main.js` 的 `--events` 走这里。 */
export function renderEventLines(event, { template } = {}) {
  const line = renderEventLine(event, { template });
  if (!line) return [];
  const tpl = typeof template === 'string' && template.length > 0 ? template : 'single';
  if (tpl === 'single') return [line]; // I1.1 版式不追加任何行（AC-21/22）
  return [line, ...renderBackflowDetail(event)];
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

/** C-11：`name / instanceId / i / summary / evidence / text` 必须能替换，否则会原样打出占位符。 */
const PLACEHOLDERS = ['cause', 'path', 'step', 'raw', 'reason', 'state', 'name', 'instanceId', 'i', 'summary', 'evidence', 'text'];

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
 * 9 条失败文案 + I1.2 业务码（D-5）。
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
