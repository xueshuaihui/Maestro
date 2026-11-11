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
  APPROVAL_LABEL,
  CLI_NOTE,
  COMMAND_ERROR,
  CONDITION_LABEL,
  DIFF_TEXT,  ERROR_TEMPLATE,
  ESCALATION_BLOCK,
  ESCALATION_LABEL,
  ESCALATION_SUMMARY_LINE,
  HANDOFF_DIRECTION,
  HANDOFF_LABEL,
  HANDOFF_REJECT_REASON,
  HANDOFF_RETRY_SUFFIX,
  INSTANCE_LABEL,
  INSTANCE_PAUSED_SUFFIX,
  INSTANCE_STOPPED_SUFFIX,
  LAYER,
  NEXT_STEP_HALTED,
  NEXT_STEP_PAUSED,
  NEXT_STEP_SUSPENDED,
  NODE_LABEL,
  NODE_QUALIFIER,
  NODE_SUFFIX,
  PENDING_APPROVAL_SUFFIX,
  REASON_LABEL,
  RESOLUTION_LABEL,
  NODE_TYPE_LABEL,
  ROLE_CLI_TEXT,
  ROLE_INSTANCE_STATUS_LABEL,  ROLE_LABEL,
  ROLE_WRITE_TEXT,
  SESSION_LABEL,
  SKILL_CLI_TEXT,
  USAGE_LINES,
  TEMPLATE_LABEL,
  WORKFLOW_CLI_TEXT,
  BACKFLOW_DEFECT_LINE,
  BACKFLOW_RETEST_LINE,
  CODE_ROLE_BRANCH,
  MERGE_PENDING,
  MERGE_MERGING,
  MERGE_MERGED,
  MERGE_CONFLICT,
  ESCALATION_REASON_MERGE_CONFLICT,
  ESCALATION_REASON_WORKTREE_INIT_FAILED,
  formatDuration,
  formatHandoffDirection,
  // I1.9 WP-6：健康度 / 追踪 / 执行摘要 / 事件跳过行的文案键（D-9 实际导出名）。
  HEALTH_LABEL,
  HEALTH_LINE,
  HEALTH_REASON,
  HEALTH_EVENT_LINE,
  LAYER_HEALTH,
  TRACE_HEADER,
  TRACE_EMPTY_LINE,
  TRACE_MISSING_LINE,
  TRACE_SUMMARY,
  TRACE_SPAN,
  TRACE_BACKFLOW_HEADER,
  TRACE_BACKFLOW_ROW,
  TRACE_NO_BACKFLOW,
  TRACE_RUNNING,
  TRACE_NO_END,
  TRACE_DEGRADED,
  SUMMARY_LABEL,
  SUMMARY_OUTPUT_LINES,
  SUMMARY_FAIL_LINE,
  SUMMARY_LOG_LINE,
  EVENTS_SKIPPED,
} from './labels.js';

const STATE_LABEL = Object.freeze({
  instance: INSTANCE_LABEL,
  node: NODE_LABEL,
  session: SESSION_LABEL,
  handoff: HANDOFF_LABEL,
  escalation: ESCALATION_LABEL,
  health: HEALTH_LABEL,
});

/** 交接包拒绝原因的人话（labels.js 的 `HANDOFF_REJECT_REASON`，D-5）。 */
const REJECT_REASON = HANDOFF_REJECT_REASON;

/** D-4：`suspended` 不在这里——它决定是否打“等待目标响应”，挂起仍然可以等。 */
const TERMINAL_INSTANCE = new Set(['completed', 'failed', 'cancelled', 'interrupted']);

const BACKFLOW_DETAIL_INDENT = '      ';
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

  // WP-5 红线：暂停限定词是「仅 paused === true 时插入」的纯后缀，直接贴在状态词后，
  // 不进 parts 数组、不改既有 parts 顺序；无新能力时本行逐字不变（A-2 #1 / §4 风险回退）。
  const pausedSuffix = snapshot?.paused === true ? INSTANCE_PAUSED_SUFFIX : '';
  const parts = [`${LAYER.instance} ${id} · ${label}${pausedSuffix}`];
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

  // 暂停限定词同样是「仅 paused === true 时插入」的纯后缀：不进 parts、不改顺序。
  const paused = item?.paused === true || snapshot?.paused === true;
  const pausedSuffix = paused ? INSTANCE_PAUSED_SUFFIX : '';
  const parts = [`${LAYER.instance} ${id} · ${instanceState}${pausedSuffix}`];
  if (showTemplate) {
    const name = templateLabel(template);
    if (name) parts.push(`模板 ${name}`);
    const pending = pendingEscalationCount(item, snapshot);
    if (pending > 0) parts.push(`待处理升级 ${pending}`);
  }
  // 待审批计数仅在 > 0 时追加（A-2 #5）；无审批记录的旧流程逐字不变。
  const pendingApprovals = pendingApprovalCount(item, snapshot);
  if (pendingApprovals > 0) parts.push(replaceAll(PENDING_APPROVAL_SUFFIX, { n: pendingApprovals }));
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

function pendingApprovalCount(item, snapshot) {
  if (Number.isInteger(item?.pendingApprovals)) return item.pendingApprovals;
  const approvals = Array.isArray(snapshot?.approvals) ? snapshot.approvals : [];
  return approvals.filter((entry) => entry?.state === 'pending').length;
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
 * code 角色节点的「分支名 + 合并状态」片段（AC-12）。仅在节点含 `branch` 字段时追加，
 * 沿用 `NODE_QUALIFIER` 的全角括号包裹口径；文案一律来自 labels.js 键（`CODE_ROLE_BRANCH` /
 * `MERGE_*`），本文件零中文硬编码。
 *
 * @param {object} node  节点对象（含 `roleId` / `branch` / `mergeStatus`）
 * @returns {string|null} 形如 `（开发 分支 maestro/INST-001/developer · 已合并）`，无分支时 null
 */
function codeBranchFragment(node) {
  if (!node || typeof node.branch !== 'string' || node.branch.length === 0) return null;
  const role = roleLabel(node.roleId) ?? '';
  const branchText = replaceAll(CODE_ROLE_BRANCH, { role, branch: node.branch }).replace(/^\s+/, '');
  const merge = node?.mergeStatus;
  const mergeText =
    merge === 'pending' ? MERGE_PENDING
    : merge === 'merging' ? MERGE_MERGING
    : merge === 'merged' ? MERGE_MERGED
    : merge === 'conflict' ? MERGE_CONFLICT
    : null;
  const body = mergeText ? `${branchText} · ${mergeText}` : branchText;
  return `（${body}）`;
}

/**
 * `code-loop` 的节点行：
 * `节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s · 判定 通过`
 * 字段间单空格、不对齐；未派发节点不带轮次与耗时（A-2）。
 */
function renderNodeRow(node, snapshot, template, { forceQualifier = null, noDuration = false, includeBranch = false } = {}) {
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

  // F-03：code 角色的分支/合并状态片段仅在 instance status / graph 视图追加（`includeBranch` 为 true），
  // `run` 路径传 false，绝不回灌到三主链运行期输出（AC-11 / R-1）。
  if (includeBranch) {
    const frag = codeBranchFragment(node);
    if (frag) parts.push(frag);
  }

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
export function renderNodeLines(snapshot, { template, includeBranch = false } = {}) {
  const tpl = templateOf(snapshot, template);
  const view = snapshotView(snapshot);
  if (view.nodes.length === 0) return [];
  if (tpl === 'single') {
    const line = renderNodeLine(snapshot);
    return line ? [line] : [];
  }
  const rows = view.nodes
    .map((node) => renderNodeRow(node, snapshot, tpl, { includeBranch }))
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
  ['pendingAt', 'pending'],
  ['deliveredAt', 'delivered'],
  ['acceptedAt', 'accepted'],
  ['consumedAt', 'consumed'],
  ['rejectedAt', 'rejected'],
  ['expiredAt', 'expired'],
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
    let label = HANDOFF_LABEL[state] ?? state;
    let suffix = '';
    if (state === 'pending') {
      // 待投递重试行（A-2 #3）：`待投递 · 重试 {n}/2`，n 取已尝试次数。
      const attempts = Number.isInteger(handoff?.deliveryAttempts) ? handoff.deliveryAttempts : 0;
      label = `${label} · ${replaceAll(HANDOFF_RETRY_SUFFIX, { n: attempts })}`;
    }
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
export function renderEscalationBlock(snapshot, { template, includeBranch = false } = {}) {
  const tpl = templateOf(snapshot, template);
  if (tpl === 'single') return [];
  const { escalations } = snapshotView(snapshot);
  if (escalations.length === 0) return [ESCALATION_BLOCK.none];

  const instanceId = snapshot?.instanceId ?? '?';
  const lines = [];
  for (const escalation of escalations) {
    const state = ESCALATION_LABEL[escalation?.state] ?? escalation?.state ?? '?';
    lines.push(replaceAll(ESCALATION_BLOCK.header, { id: escalation?.escalationId ?? '?', state }));
    // F-03：仅 instance status / graph 视图（`includeBranch` 为 true）把合并类升级原因码映射为 labels.js 中文；
    // `run` 路径保持默认 false，沿用既有 `reasonDetail`，运行期输出逐字不变。
    const reasonCode = escalation?.reasonCode;
    const detail =
      includeBranch && (reasonCode === 'merge_conflict' || reasonCode === 'worktree_init_failed')
        ? (reasonCode === 'merge_conflict'
            ? ESCALATION_REASON_MERGE_CONFLICT
            : ESCALATION_REASON_WORKTREE_INIT_FAILED)
        : (escalation?.reasonDetail ?? '?');
    lines.push(replaceAll(ESCALATION_BLOCK.reason, { detail }));
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

  // 前台 `orch run` 遇暂停的收尾（A-2 #6 / D-7.9）：只有实例行 + NEXT_STEP_PAUSED 两行，
  // 不打印节点表、交接包行与升级块；退出码由 main.js 按 0 返回。
  if (snapshot?.state === 'running' && snapshot?.paused === true && snapshot?.halted !== true) {
    return [
      renderInstanceLine({ ...snapshot, template: tpl }),
      replaceAll(NEXT_STEP_PAUSED, { id }),
    ];
  }

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
 * `task-loop` 的 note 行中段（A-2 第 7 段 / D-5）：直接用中文原因词，不再追加「原因」段。
 * 例：`[#12] 10:00:10  节点 T-003  读取审核`。标签缺失时退回旧中段（`从 → 到` 或 `detail.note`），
 * 不新造英文兜底。
 */
function noteMiddle(event) {
  const label = REASON_LABEL[event.reason];
  if (typeof label === 'string' && label.length > 0) return label;
  return legacyMiddle(event);
}

/**
 * 事件行（C-10）：
 *   `single`    `10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event`（I1.1 逐字）
 *   `code-loop` `[#18] 10:30:05  交接包 HO-001  已投递 → 已接受  原因 首个事件`
 *   `task-loop` 同上；但 `result === 'note'` 的行中段只放中文原因词（不带「原因」段）。
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
  // 只有 `task-loop` 的 note 行改版式；`code-loop` 逐字不变（AC-36）。
  if (tpl === 'task-loop' && event.result === 'note') {
    return `${seq}${ts}  ${layer} ${id}  ${noteMiddle(event)}`;
  }
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
  // I1.9 WP-6：只对两种新记录委托专用行渲染；其余事件一律走原逻辑，既有行格式与相对顺序零改。
  const reason = event?.reason;
  if (reason === 'execution.summary') return [renderSummaryLogLine(event)];
  if (reason === 'health.changed') return [renderHealthEventLine(event)];

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

// ---------------------------------------------------------------- WP-5 新命令渲染

/** 稳定字符串升序（跨实例列表 / graph 排序键复用，BR-43 / A-4）。 */
function asc(a, b) {
  const ka = String(a ?? '');
  const kb = String(b ?? '');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** 空态行（BR-32）：升级 — / 交接包 — / 事件 —。 */
export function renderEmptyLine(kind) {
  if (kind === 'escalation') return ESCALATION_BLOCK.none;
  if (kind === 'handoff') return `${LAYER.handoff} —`;
  return '事件 —';
}

/**
 * 命令级错误（A-5）：文案全部取自 `COMMAND_ERROR`，不走 `renderError`、不进 ERROR_TEMPLATE。
 * `{state}` 若传的是英文状态枚举，按错误码对应的状态表本地化（CLI 侧唯一中文来源）。
 */
const COMMAND_ERROR_STATE_TABLE = Object.freeze({
  ESCALATION_NOT_PENDING: ESCALATION_LABEL,
  APPROVAL_NOT_PENDING: APPROVAL_LABEL,
  INSTANCE_NOT_PAUSABLE: INSTANCE_LABEL,
  INSTANCE_NOT_RESUMABLE: INSTANCE_LABEL,
});

export function renderCommandError(code, params = {}) {
  const template = COMMAND_ERROR[code];
  if (typeof template !== 'string') return renderError({ code, params });
  const filled = { ...params };
  const table = COMMAND_ERROR_STATE_TABLE[code];
  if (table && typeof filled.state === 'string') {
    filled.state = table[filled.state] ?? filled.state;
  }
  return replaceAll(template, filled);
}

/** 审批行（A-2 #2）：`审批 APR-001 待处理 · 节点 T-001 开发 · 动作 write`；single 省节点段。 */
export function renderApprovalLine(approval, snapshot, { template } = {}) {
  const id = approval?.approvalId ?? '?';
  const state = APPROVAL_LABEL[approval?.state] ?? approval?.state ?? '?';
  const action = approval?.action ?? '?';
  const tpl = templateOf(snapshot, template);
  const parts = [`${LAYER.approval} ${id} ${state}`];
  if (tpl !== 'single') {
    const nodeId = typeof approval?.nodeId === 'string' && approval.nodeId.length > 0 ? approval.nodeId : null;
    const role = nodeId ? roleOfNode(snapshot, nodeId) : null;
    if (nodeId) parts.push(`节点 ${nodeId}${role ? ` ${role}` : ''}`);
  }
  parts.push(`动作 ${action}`);
  return parts.join(' · ');
}

/** 按审批号逐条列出全部审批（status --instance / instance status）。 */
export function renderApprovalLines(snapshot, { template } = {}) {
  const approvals = Array.isArray(snapshot?.approvals) ? snapshot.approvals : [];
  return approvals
    .slice()
    .sort((a, b) => asc(a?.approvalId, b?.approvalId))
    .map((approval) => renderApprovalLine(approval, snapshot, { template }));
}

/** `orch approve` 结果行（A-3）：`审批 APR-001 已通过 · 动作 write`。 */
export function renderApprovalResult({ approvalId, state, action } = {}) {
  const label = APPROVAL_LABEL[state] ?? state ?? '?';
  return `${LAYER.approval} ${approvalId ?? '?'} ${label} · 动作 ${action ?? '?'}`;
}

/** 无对应项一律打印 —，不省略行（A-3 handoff show）。 */
function textOrDash(value) {
  return typeof value === 'string' && value.length > 0 ? value : '—';
}

/** 交接包"最后时间"：7 个时间字段取最近（最大）的一个（A-3）。 */
function handoffLastClock(handoff) {
  const fields = ['expiredAt', 'pendingAt', 'consumedAt', 'rejectedAt', 'acceptedAt', 'deliveredAt', 'createdAt'];
  let max = null;
  for (const field of fields) {
    const ms = Date.parse(handoff?.[field] ?? '');
    if (Number.isFinite(ms) && (max === null || ms > max)) max = ms;
  }
  return formatClock(max) ?? '—';
}

function handoffStateLabel(handoff) {
  let state = HANDOFF_LABEL[handoff?.state] ?? handoff?.state ?? '?';
  if (handoff?.state === 'rejected') {
    const reason = REJECT_REASON[handoff?.rejectReason] ?? handoff?.rejectReason ?? null;
    if (reason) state = `${state}（${reason}）`;
  }
  return state;
}

function evidenceSummary(handoff) {
  const refs = handoff?.artifactRefs;
  if (!refs || typeof refs !== 'object') return null;
  const parts = [];
  for (const ref of Array.isArray(refs.input) ? refs.input : []) {
    if (typeof ref === 'string' && ref.length > 0) parts.push(ref);
    else if (ref && typeof ref === 'object' && typeof ref.ref === 'string') parts.push(ref.ref);
  }
  const previous = refs.previous?.ref ?? (typeof refs.previous === 'string' ? refs.previous : null);
  if (typeof previous === 'string' && previous.length > 0) parts.push(previous);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** `orch handoff list` 一行（A-3）：号/实例/方向/状态/最后时间，各段 2 空格。 */
export function renderHandoffListRow(handoff, snapshot) {
  const id = handoff?.handoffId ?? '?';
  const instanceId = handoff?.instanceId ?? snapshot?.instanceId ?? '?';
  const direction = handoffDirection(handoff, snapshot);
  const segments = [`${LAYER.handoff} ${id}`, `${LAYER.instance} ${instanceId}`];
  if (direction) segments.push(direction);
  segments.push(handoffStateLabel(handoff));
  segments.push(handoffLastClock(handoff));
  return segments.join('  ');
}

/** `orch handoff show`（A-3）：字段、时间、证据、缺陷、要求、尝试、错误、信箱逐行展示。 */
export function renderHandoffShow(handoff, snapshot) {
  const dash = '—';
  const clock = (value) => formatClock(value) ?? dash;
  const direction = handoffDirection(handoff, snapshot);
  const lines = [];
  lines.push(`${LAYER.handoff} ${handoff?.handoffId ?? '?'}`);
  lines.push(`  ${LAYER.instance}：${textOrDash(handoff?.instanceId ?? snapshot?.instanceId)}`);
  lines.push(`  方向：${textOrDash(direction)}`);
  lines.push(`  状态：${handoffStateLabel(handoff)}`);
  lines.push(
    `  构造：${clock(handoff?.createdAt)}  待投递：${clock(handoff?.pendingAt)}  投递：${clock(handoff?.deliveredAt)}` +
      `  接受：${clock(handoff?.acceptedAt)}  完成：${clock(handoff?.consumedAt)}  拒绝：${clock(handoff?.rejectedAt)}  过期：${clock(handoff?.expiredAt)}`,
  );
  lines.push(`  证据：${textOrDash(evidenceSummary(handoff))}`);
  const defects = Array.isArray(handoff?.defects) ? handoff.defects : [];
  if (defects.length === 0) {
    lines.push(`  缺陷：${dash}`);
  } else {
    for (const defect of defects) {
      lines.push(`  缺陷：${defect?.summary ?? ''}（证据 ${defect?.evidence ?? ''}）`);
    }
  }
  lines.push(`  修改要求：${textOrDash(handoff?.revisionRequirement)}`);
  lines.push(`  复测要求：${textOrDash(handoff?.retestRequirement)}`);
  const attempts = Number.isInteger(handoff?.deliveryAttempts) ? handoff.deliveryAttempts : 0;
  lines.push(`  尝试：${attempts}/3`);
  lines.push(`  最后错误：${textOrDash(handoff?.lastError)}`);
  lines.push(`  信箱：${textOrDash(handoff?.inboxPath)}`);
  return lines;
}

/** `orch escalate list` 一行（A-3）：号/实例/节点与角色/轮次/状态/原因摘要。 */
export function renderEscalationListRow(escalation, snapshot) {
  const id = escalation?.escalationId ?? '?';
  const instanceId = escalation?.instanceId ?? snapshot?.instanceId ?? '?';
  const nodeId = escalation?.nodeId ?? '?';
  const role = roleOfNode(snapshot, nodeId);
  const round = Number.isInteger(escalation?.round) ? escalation.round : 0;
  let state = ESCALATION_LABEL[escalation?.state] ?? escalation?.state ?? '?';
  if (escalation?.state === 'resolved') {
    const resolution = RESOLUTION_LABEL[escalation?.resolution] ?? null;
    if (resolution) state = `${state}（${resolution}）`;
  }
  const nodePart = role
    ? `${LAYER.node} ${nodeId} ${role} · 第 ${round} 轮`
    : `${LAYER.node} ${nodeId} · 第 ${round} 轮`;
  return [
    `${LAYER.escalation} ${id}`,
    `${LAYER.instance} ${instanceId}`,
    nodePart,
    state,
    escalation?.reasonDetail ?? '?',
  ].join('  ');
}

/** `orch escalate resolve` 结果（A-3）：结果行 + 当前实例行（再次升级则为挂起收尾）。 */
export function renderEscalationResult(escalationId, decision, snapshot, { template } = {}) {
  const resolution = RESOLUTION_LABEL[decision] ?? decision ?? '?';
  const tpl = templateOf(snapshot, template);
  const lines = [`${LAYER.escalation} ${escalationId ?? '?'} ${ESCALATION_LABEL.resolved}（${resolution}）`];
  const full = { ...(snapshot ?? {}), template: tpl };
  if (snapshot?.state === 'suspended' || snapshot?.halted === true) {
    lines.push(...renderRunTail(full, { template: tpl }));
  } else {
    lines.push(renderInstanceLine(full));
  }
  return lines;
}

/** 图节点：按图声明顺序，与快照节点按 nodeId 对齐（A-4 "按图声明顺序"）。 */
function graphNodes(snapshot, graph) {
  const view = snapshotView(snapshot);
  const byId = new Map();
  for (const node of view.nodes) {
    const id = nodeIdOf(node);
    if (id) byId.set(id, node);
  }
  const declared = graph?.nodes ?? [];
  if (declared.length === 0) {
    return view.nodes.map((node) => {
      const out = {
        nodeId: nodeIdOf(node) ?? '?',
        title: null,
        roleId: node?.roleId ?? null,
        state: node?.state ?? 'pending',
        round: Number.isInteger(node?.round) ? node.round : 0,
      };
      if (typeof node?.branch === 'string' && node.branch.length > 0) out.branch = node.branch;
      if (typeof node?.mergeStatus === 'string' && node.mergeStatus.length > 0) out.mergeStatus = node.mergeStatus;
      return out;
    });
  }
  return declared.map((def, index) => {
    const id = def?.nodeId ?? def?.id ?? null;
    const live = (id && byId.get(id)) ?? view.nodes[index] ?? null;
    const node = {
      nodeId: id ?? '?',
      title: typeof def?.title === 'string' ? def.title : null,
      roleId: def?.roleId ?? live?.roleId ?? null,
      state: live?.state ?? 'pending',
      round: Number.isInteger(live?.round) ? live.round : 0,
    };
    // AC-12：把 code 角色节点的分支名与合并状态透出到图视图（仅 `orch instance graph`，非 run 路径）。
    if (typeof live?.branch === 'string' && live.branch.length > 0) node.branch = live.branch;
    if (typeof live?.mergeStatus === 'string' && live.mergeStatus.length > 0) node.mergeStatus = live.mergeStatus;
    return node;
  });
}

function graphEdges(graph) {
  return (graph?.edges ?? []).map((edge) => ({ from: edge?.from, to: edge?.to, kind: edge?.kind }));
}

function graphHandoffs(snapshot) {
  const { handoffs } = snapshotView(snapshot);
  return handoffs
    .slice()
    .sort((a, b) => asc(a?.handoffId, b?.handoffId))
    .map((handoff) => ({
      handoffId: handoff?.handoffId ?? '?',
      from: handoff?.edge?.from ?? handoff?.fromNodeId ?? null,
      to: handoff?.edge?.to ?? handoff?.toNodeId ?? null,
      kind: handoff?.edge?.kind ?? 'forward',
      state: handoff?.state ?? null,
      round: Number.isInteger(handoff?.round) ? handoff.round : 0,
    }));
}

function projectById(list, idKey) {
  const items = Array.isArray(list) ? list : [];
  return items
    .slice()
    .sort((a, b) => asc(a?.[idKey], b?.[idKey]))
    .map((entry) => ({ ...entry }));
}

/** `current`：优先 interruptedNodeId，否则取最后一个 running/review 节点；无活动节点为 null。 */
function graphCurrent(snapshot) {
  const view = snapshotView(snapshot);
  const nominated = typeof snapshot?.interruptedNodeId === 'string' ? snapshot.interruptedNodeId : null;
  let node = nominated ? view.nodes.find((item) => nodeIdOf(item) === nominated) ?? null : null;
  if (!node) {
    for (let i = view.nodes.length - 1; i >= 0; i -= 1) {
      const state = view.nodes[i]?.state;
      if (state === 'running' || state === 'review') {
        node = view.nodes[i];
        break;
      }
    }
  }
  if (!node) return null;
  const sessionId = typeof node?.sessionId === 'string'
    ? node.sessionId
    : typeof view.session?.sessionId === 'string' ? view.session.sessionId : null;
  return { nodeId: nodeIdOf(node) ?? '?', sessionId, state: node?.state ?? null };
}

/**
 * `instance graph --format json`（§1.9 / A-4）：键顺序固定；不输出 rev、generatedAt、
 * updatedAt 或任何 now() 派生字段，两次执行逐字一致（AC-41）。行尾换行由 main.js 的 out() 提供。
 */
export function renderGraphJson(snapshot, graph) {
  const obj = {
    graphVersion: 1,
    instanceId: snapshot?.instanceId ?? '?',
    template: templateOf(snapshot),
    state: snapshot?.state ?? null,
    paused: snapshot?.paused === true,
    // AC-12：code 角色节点的分支名与合并状态由 `graphNodes` 条件透出（仅 `graph` 视图，非 run 路径）。
    nodes: graphNodes(snapshot, graph),
    edges: graphEdges(graph),
    handoffs: graphHandoffs(snapshot),
    escalations: projectById(snapshot?.escalations, 'escalationId'),
    approvals: projectById(snapshot?.approvals, 'approvalId'),
    current: graphCurrent(snapshot),
  };
  return JSON.stringify(obj, null, 2);
}

const EDGE_KIND_TEXT = Object.freeze({
  forward: '正向',
  backflow: HANDOFF_DIRECTION.backflow,
  retest: HANDOFF_DIRECTION.retest,
});

/** `instance graph`（text）：实例/模板/状态 + 节点逐行 + 边：段落 + 升级/审批摘要（A-3）。 */
export function renderGraphText(snapshot, graph) {
  const tpl = templateOf(snapshot);
  const id = snapshot?.instanceId ?? '?';
  const templateName = templateLabel(tpl) ?? tpl;
  const state = stateLabel('instance', snapshot?.state) ?? '?';
  const pausedSuffix = snapshot?.paused === true ? INSTANCE_PAUSED_SUFFIX : '';
  const lines = [`${LAYER.instance} ${id} · ${templateName} · ${state}${pausedSuffix}`];

  for (const node of graphNodes(snapshot, graph)) {
    const role = node.title ?? roleLabel(node.roleId) ?? '';
    const nodeState = stateLabel('node', node.state) ?? '-';
    // A-3：节点号与角色之间用空格，其余字段之间用 ` · `。
    const head = [node.nodeId, role].filter((part) => typeof part === 'string' && part.length > 0).join(' ');
    const rest = [nodeState, `第 ${node.round} 轮`].filter((part) => typeof part === 'string' && part.length > 0).join(' · ');
    let line = rest ? `${head} · ${rest}` : head;
    // AC-12：code 角色节点追加分支名 + 合并状态片段（`graph` 视图专属，不进 run 路径）。
    const frag = codeBranchFragment(node);
    if (frag) line += ` ${frag}`;
    lines.push(line);
  }

  lines.push('边：');
  const edges = graphEdges(graph);
  if (edges.length === 0) {
    lines.push('  无');
  } else {
    for (const edge of edges) {
      const kind = EDGE_KIND_TEXT[edge.kind] ?? edge.kind ?? '';
      lines.push(`  ${edge.from} -> ${edge.to} ${kind}`.trimEnd());
    }
  }

  const escalations = Array.isArray(snapshot?.escalations) ? snapshot.escalations : [];
  for (const esc of escalations.slice().sort((a, b) => asc(a?.escalationId, b?.escalationId))) {
    lines.push(
      `${LAYER.escalation}：${esc?.escalationId ?? '?'} ${esc?.nodeId ?? '?'} ${ESCALATION_LABEL[esc?.state] ?? esc?.state ?? '?'}`,
    );
  }
  const approvals = Array.isArray(snapshot?.approvals) ? snapshot.approvals : [];
  for (const apr of approvals.slice().sort((a, b) => asc(a?.approvalId, b?.approvalId))) {
    lines.push(
      `${LAYER.approval}：${apr?.approvalId ?? '?'} ${apr?.nodeId ?? '?'} ${APPROVAL_LABEL[apr?.state] ?? apr?.state ?? '?'}`,
    );
  }
  return lines;
}

/** `orch attach` 首屏首行（A-3）：已附着会话 <id>（实例 … · 节点 … 角色）。 */
export function renderAttachHeader({ sessionId, instanceId, nodeId } = {}, snapshot) {
  const role = nodeId ? roleOfNode(snapshot, nodeId) : null;
  const nodePart = role ? `${LAYER.node} ${nodeId} ${role}` : `${LAYER.node} ${nodeId ?? '?'}`;
  return `已附着会话 ${sessionId ?? '?'}（${LAYER.instance} ${instanceId ?? '?'} · ${nodePart}）`;
}

/** `orch attach` Ctrl-C 脱离行（A-3）。 */
export function renderDetached(sessionId) {
  return `已脱离会话 ${sessionId ?? '?'}`;
}

/** `instance log --format json`：原始事件数组，缩进 2 空格（A-3）。 */
export function renderLogJson(events) {
  return JSON.stringify(Array.isArray(events) ? events : [], null, 2);
}


// ---------------------------------------------------------------- role（I1.5）

/**
 * `orch role list` 的文本：首行 + 每角色一行 +（有坏资产时的）末行。
 *
 * `counts` 必须是 `roles.js` 的 `listCounts()` 产物（角色级 4 键）。传注册表的
 * 资产级 6 键不会报错——`total` 为 `undefined` 会渲染成空串——所以这条约束没法靠
 * 运行时兜住，只能在这里写死口径（A-2 的首行是逐字断言）。
 *
 * @param {{counts:{total:number,builtin:number,project:number,invalid:number},
 *          groups:Array<{group:string,label:string,count:number}>,
 *          rows:Array<object>}} input
 * @returns {string[]}
 */
export function renderRoleList({ counts, groups, rows }) {
  const lines = [replaceAll(ROLE_CLI_TEXT.listHeader, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(replaceAll(ROLE_CLI_TEXT.listRow, row));
  }
  if (Number(counts?.invalid) > 0) {
    lines.push(replaceAll(ROLE_CLI_TEXT.listInvalidTail, { n: counts.invalid }));
  }
  return lines;
}

/**
 * `orch role show` 的文本：契约行 + 职责 / 技能 / 工具 / 可唤醒 / 来源，共 6 行；
 * `instanceLine` 非空时追加第 7 行。
 *
 * `roleRow` 必须由 `ROLE_CLI_TEXT.listRow` 渲染（A-3 要求与 list 行逐字相同，含 `- `）。
 * 三种空态一律用 `ROLE_CLI_TEXT.placeholder`（`—`），不各自造占位符。
 *
 * @param {{roleRow:string, duty:string, skills:string[], tools:string[], wake:string[],
 *          source:{kind:'builtin'|'project', file:string}, instanceLine?:string|null}} input
 * @returns {string[]}
 */
export function renderRoleShow({ roleRow, duty, skills, tools, wake, source, instanceLine }) {
  const placeholder = ROLE_CLI_TEXT.placeholder;
  const join = (values) => {
    const list = Array.isArray(values) ? values : [];
    return list.length > 0 ? list.join(', ') : placeholder;
  };
  const template =
    source?.kind === 'project' ? ROLE_CLI_TEXT.showSourceProject : ROLE_CLI_TEXT.showSourceBuiltin;

  const lines = [
    roleRow,
    replaceAll(ROLE_CLI_TEXT.showDuty, { summary: duty ?? '' }),
    replaceAll(ROLE_CLI_TEXT.showSkills, { skills: join(skills) }),
    replaceAll(ROLE_CLI_TEXT.showTools, { tools: join(tools) }),
    replaceAll(ROLE_CLI_TEXT.showWake, { wake: join(wake) }),
    replaceAll(template, { file: source?.file ?? placeholder })
  ];
  if (typeof instanceLine === 'string' && instanceLine.length > 0) lines.push(instanceLine);
  return lines;
}

/**
 * `orch role validate` 的文本：全通过一行；有错时首行 + 每资产一行（A-4）。
 *
 * `counts` 是 A-7 的**资产级** 6 键（首行要 assets / roles / skills）；与
 * `renderRoleList` 的角色级 4 键不是同一张表，切勿互换。
 *
 * @param {{counts:object, rows:Array<{file:string,detail:string,code:string}>}} input
 * @returns {string[]}
 */
export function renderRoleValidate({ counts, rows }) {
  if (!(Number(counts?.invalid) > 0)) {
    return [replaceAll(ROLE_CLI_TEXT.validateOk, counts)];
  }
  const lines = [replaceAll(ROLE_CLI_TEXT.validateFail, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(replaceAll(ROLE_CLI_TEXT.validateRow, row));
  }
  return lines;
}

/**
 * `orch run` 预检失败：`注册表不合法：<第一条明细>`（A-5）。明细由 `roles.js` 组装，
 * 与 A-4 的行内容相同但**不带** `- ` 前缀。
 *
 * @param {string|null} detail
 * @returns {string}
 */
export function renderRegistryInvalid(detail) {
  return replaceAll(ROLE_CLI_TEXT.runRegistryInvalid, { detail: detail ?? ROLE_CLI_TEXT.placeholder });
}

/**
 * 最近动作段。A-3 的基线 `最近 T-002 · 轮次 1/2` 逐字不变；只在图取不到
 * （`maxRounds` 缺省）或轮次缺省时降级，避免打出 `轮次 1/` 这种悬空斜杠。
 */
function renderLastAction(lastAction) {
  if (!lastAction) return ROLE_CLI_TEXT.lastActionMissing;
  const present = (value) => value !== null && value !== undefined && value !== '';
  if (!present(lastAction.round)) {
    return replaceAll(ROLE_CLI_TEXT.lastActionNodeOnly, lastAction);
  }
  const template = present(lastAction.maxRounds)
    ? ROLE_CLI_TEXT.lastAction
    : ROLE_CLI_TEXT.lastActionNoMax;
  return replaceAll(template, lastAction);
}

/**
 * `role show|list --instance` 的那一行（A-3）。状态名取六态表；服务节点 / 宿主 /
 * 最近为空时写 `—`；未注册角色的并发上限为 `null`，该位置也写 `—` 并在行尾追加说明。
 *
 * @param {{instanceId:string, view:object, unused?:boolean}} input
 * @returns {string}
 */
export function renderRoleInstanceLine({ instanceId, view }) {
  const placeholder = ROLE_CLI_TEXT.placeholder;
  const last = renderLastAction(view.lastAction);
  const status = ROLE_INSTANCE_STATUS_LABEL[view.status] ?? view.status;
  const nodes = Array.isArray(view.servingNodes) && view.servingNodes.length > 0
    ? view.servingNodes.join(', ')
    : placeholder;
  const hosts = Array.isArray(view.hostIcons) && view.hostIcons.length > 0
    ? view.hostIcons.join(', ')
    : placeholder;
  const max =
    view.maxConcurrentSessions === null || view.maxConcurrentSessions === undefined
      ? placeholder
      : String(view.maxConcurrentSessions);
  const line = replaceAll(ROLE_CLI_TEXT.instanceLine, {
    instanceId,
    status,
    active: Array.isArray(view.activeSessions) ? view.activeSessions.length : 0,
    max,
    nodes,
    host: hosts,
    last
  });
  return view.statusReason === 'unknown-role'
    ? `${line}${ROLE_CLI_TEXT.unknownRoleNote}`
    : line;
}

/** 该角色不属于本实例时的那一行（A-3）。 */
export function renderRoleInstanceUnused(instanceId) {
  return replaceAll(ROLE_CLI_TEXT.instanceUnused, { instanceId });
}

// ---------------------------------------------------------------- I1.6 asset families (ruling 9)

// This section holds the I1.6 renderers for the three asset families (WP-5, §2.7).
// Discipline:
// 1. Every pre-existing I1.5 function above is byte-frozen; this section only appends.
// 2. Zero Chinese: all wording comes from the new `labels.js` tables (`SKILL_CLI_TEXT`,
//    `WORKFLOW_CLI_TEXT`, `ROLE_WRITE_TEXT`, `DIFF_TEXT`, `CONDITION_LABEL`,
//    `NODE_TYPE_LABEL`).
// 3. No imports from other CLI modules; pure functions taking assembled data objects
//    and returning `string[]`.

/** The shared empty-state placeholder (`—`) for the family renderers. */
function dashOf() {
  return SKILL_CLI_TEXT.placeholder;
}

/** Text form of a diff value (A-5 / §3.5): arrays join with `, `, empty array and `null` print the dash. */
function diffValue(value) {
  if (value === null || value === undefined) return dashOf();
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : dashOf();
  const text = String(value);
  return text.length > 0 ? text : dashOf();
}

function diffChangeLines(changes) {
  const lines = [];
  for (const change of Array.isArray(changes) ? changes : []) {
    if (change?.kind === 'added') {
      lines.push(replaceAll(DIFF_TEXT.added, { field: change.field, value: diffValue(change.target) }));
    } else if (change?.kind === 'removed') {
      lines.push(replaceAll(DIFF_TEXT.removed, { field: change.field, value: diffValue(change.base) }));
    } else {
      lines.push(
        replaceAll(DIFF_TEXT.changed, {
          field: change?.field,
          base: diffValue(change?.base),
          target: diffValue(change?.target),
        }),
      );
    }
  }
  return lines;
}

function diffTail(changes) {
  return Array.isArray(changes) && changes.length > 0
    ? replaceAll(DIFF_TEXT.count, { n: changes.length })
    : DIFF_TEXT.none;
}

function sourceLabelOf(kind, text) {
  return kind === 'project' ? text.sourceProject : text.sourceBuiltin;
}

/**
 * `orch role diff` text (A-5):
 *   header (A-5 verbatim, assembled from labels) with one `+`/`-`/`~` row per change,
 *   tail: the change count, or the no-difference line (both from labels).
 *
 * @param {{id:string, idSource:'builtin'|'project', base:string,
 *          baseSource:'builtin'|'project', changes:Array<{field:string,kind:string,base:object,target:object}>}} input
 * @returns {string[]}
 */
export function renderRoleDiff({ id, idSource, base, baseSource, changes }) {
  const header = replaceAll(ROLE_WRITE_TEXT.diffHeader, {
    id,
    source: sourceLabelOf(idSource, ROLE_WRITE_TEXT),
    base,
    baseSource: sourceLabelOf(baseSource, ROLE_WRITE_TEXT),
  });
  return [header, ...diffChangeLines(changes), diffTail(changes)];
}

/**
 * `orch workflow diff` text (A-11). Shares the row layouts (`DIFF_TEXT`) with
 * `renderRoleDiff`, but the header and the field-path convention stay separate
 * (BR-37: the two diff semantics never share comparison logic).
 *
 * @param {{id:string, idSource:'builtin'|'project', base:string,
 *          baseSource:'builtin'|'project', changes:Array<{field:string,kind:string,base:object,target:object}>}} input
 * @returns {string[]}
 */
export function renderWorkflowDiff({ id, idSource, base, baseSource, changes }) {
  const header = replaceAll(WORKFLOW_CLI_TEXT.diffHeader, {
    id,
    source: sourceLabelOf(idSource, WORKFLOW_CLI_TEXT),
    base,
    baseSource: sourceLabelOf(baseSource, WORKFLOW_CLI_TEXT),
  });
  return [header, ...diffChangeLines(changes), diffTail(changes)];
}

/**
 * `orch skill list` text (A-6): counts header + one row per skill + (bad assets) tail.
 * `counts` is the skill-level 4-key `{total, builtin, project, invalid}`; the
 * display strings in `rows[]` (`appliesTo` etc.) are pre-assembled by `skills.js`
 * (groups joined with `, `, empty state as the dash).
 *
 * @param {{counts:object, rows:Array<{id:string,name:string,appliesTo:string,commands:number|string}>}} input
 * @returns {string[]}
 */
export function renderSkillList({ counts, rows }) {
  const lines = [replaceAll(SKILL_CLI_TEXT.listHeader, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(replaceAll(SKILL_CLI_TEXT.listRow, row));
  }
  if (Number(counts?.invalid) > 0) {
    lines.push(replaceAll(SKILL_CLI_TEXT.listInvalidTail, { n: counts.invalid }));
  }
  return lines;
}

/**
 * `orch skill show` text (A-6): contract row + summary / commands / applies-to /
 * source / body header, then the body with two leading spaces per line and leading
 * blank lines skipped.
 *
 * `row` is the contract line rendered from `SKILL_CLI_TEXT.listRow` (byte-identical
 * to the list row, A-6); `summary` / `commands` / `appliesTo` are pre-assembled
 * display strings (empty state filled by the caller).
 *
 * @param {{row:string, summary:string, commands:string, appliesTo:string,
 *          source:{kind:'builtin'|'project', file:string}, body:string|string[]}} input
 * @returns {string[]}
 */
export function renderSkillShow({ row, summary, commands, appliesTo, source, body }) {
  const sourceTemplate =
    source?.kind === 'project' ? SKILL_CLI_TEXT.showSourceProject : SKILL_CLI_TEXT.showSourceBuiltin;
  const lines = [
    row,
    replaceAll(SKILL_CLI_TEXT.showSummary, { summary: summary ?? dashOf() }),
    replaceAll(SKILL_CLI_TEXT.showCommands, { commands: commands ?? dashOf() }),
    replaceAll(SKILL_CLI_TEXT.showAppliesTo, { appliesTo: appliesTo ?? dashOf() }),
    replaceAll(sourceTemplate, { file: source?.file ?? dashOf() }),
    SKILL_CLI_TEXT.showBodyHeader,
  ];
  const raw = Array.isArray(body) ? body : String(body ?? '').split('\n');
  let index = 0;
  while (index < raw.length && String(raw[index]).length === 0) index += 1;
  for (; index < raw.length; index += 1) lines.push(`  ${raw[index]}`);
  return lines;
}

/**
 * `orch skill validate` text (A-7): one line when all pass; header + one row per
 * bad asset otherwise. `counts` is the 5-key skill validation counts
 * `{assets, skills, builtin, project, invalid}` (A-14).
 *
 * @param {{counts:object, rows:Array<{file:string,detail:string,code:string}>}} input
 * @returns {string[]}
 */
export function renderSkillValidate({ counts, rows }) {
  if (!(Number(counts?.invalid) > 0)) {
    return [replaceAll(SKILL_CLI_TEXT.validateOk, counts)];
  }
  const lines = [replaceAll(SKILL_CLI_TEXT.validateFail, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(replaceAll(SKILL_CLI_TEXT.validateRow, row));
  }
  return lines;
}

/** Workflow source segment (A-8): builtin vs project wording, from labels. */
function workflowSourceLabel(source) {
  return source === 'project' ? WORKFLOW_CLI_TEXT.sourceProject : WORKFLOW_CLI_TEXT.sourceBuiltin;
}

/** Node-type segment (A-8): role appends {role}; subworkflow appends {id} and {nodes}. */
function workflowNodeTypeText(node) {
  if (node?.nodeType === 'role') {
    return replaceAll(WORKFLOW_CLI_TEXT.nodeTypeRole, { role: node.role ?? dashOf() });
  }
  if (node?.nodeType === 'subworkflow') {
    return replaceAll(WORKFLOW_CLI_TEXT.nodeTypeSub, {
      id: node.workflow ?? dashOf(),
      nodes: node.subNodeCount ?? 0,
    });
  }
  return NODE_TYPE_LABEL[node?.nodeType] ?? String(node?.nodeType ?? dashOf());
}

/**
 * `orch workflow list` text (A-8): counts header + one row per workflow + (bad
 * assets) tail. `rows[].source` is `builtin` / `project`; the in-row text is
 * mapped here.
 *
 * @param {{counts:object, rows:Array<{id:string,name:string,nodeCount:number,edgeCount:number,source:string}>}} input
 * @returns {string[]}
 */
export function renderWorkflowList({ counts, rows }) {
  const lines = [replaceAll(WORKFLOW_CLI_TEXT.listHeader, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(
      replaceAll(WORKFLOW_CLI_TEXT.listRow, {
        id: row?.id,
        name: row?.name,
        nodes: row?.nodeCount ?? 0,
        edges: row?.edgeCount ?? 0,
        source: workflowSourceLabel(row?.source),
      }),
    );
  }
  if (Number(counts?.invalid) > 0) {
    lines.push(replaceAll(WORKFLOW_CLI_TEXT.listInvalidTail, { n: counts.invalid }));
  }
  return lines;
}

/**
 * `orch workflow show` text (A-8): summary row (byte-identical to the list row) +
 * entry/terminal + one row per node + one row per edge.
 *
 * `nodes[]` elements: `{id, title, nodeType, role?, workflow?, subNodeCount?,
 * timeout?, retry?}` (missing `timeout` prints the dash, missing `retry` prints 0);
 * `edges[]` elements: `{from, to, kind, when?, rounds?, mapCount?}` (`rounds` is
 * appended for `backflow` only, missing limit prints the dash; a non-`always`
 * `when` appends the condition name; `mapCount` > 0 appends the mapping count).
 *
 * @param {{row:string, entry:string, terminal:string, nodes:Array<object>, edges:Array<object>}} input
 * @returns {string[]}
 */
export function renderWorkflowShow({ row, entry, terminal, nodes, edges }) {
  const lines = [
    row,
    replaceAll(WORKFLOW_CLI_TEXT.showEntry, { entry, terminal }),
    WORKFLOW_CLI_TEXT.nodesHeader,
  ];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const timeout =
      node?.timeout === null || node?.timeout === undefined
        ? dashOf()
        : `${node.timeout}s`;
    const retry = node?.retry === null || node?.retry === undefined ? 0 : node.retry;
    lines.push(
      replaceAll(WORKFLOW_CLI_TEXT.nodeRow, {
        id: node?.id ?? dashOf(),
        title: node?.title ?? dashOf(),
        type: workflowNodeTypeText(node),
        timeout,
        retry,
      }),
    );
  }
  lines.push(WORKFLOW_CLI_TEXT.edgesHeader);
  for (const edge of Array.isArray(edges) ? edges : []) {
    let line = replaceAll(WORKFLOW_CLI_TEXT.edgeRow, {
      from: edge?.from ?? dashOf(),
      to: edge?.to ?? dashOf(),
      kind: WORKFLOW_CLI_TEXT.edgeKind[edge?.kind] ?? String(edge?.kind ?? dashOf()),
    });
    if (edge?.kind === 'backflow') {
      line += replaceAll(WORKFLOW_CLI_TEXT.edgeRounds, {
        rounds: edge?.rounds === null || edge?.rounds === undefined ? dashOf() : String(edge.rounds),
      });
    }
    if (typeof edge?.when === 'string' && edge.when !== 'always') {
      line += replaceAll(WORKFLOW_CLI_TEXT.edgeCondition, {
        when: CONDITION_LABEL[edge.when] ?? edge.when,
      });
    }
    if (Number(edge?.mapCount) > 0) {
      line += replaceAll(WORKFLOW_CLI_TEXT.edgeMappings, { n: edge.mapCount });
    }
    lines.push(line);
  }
  return lines;
}

/**
 * `orch workflow validate` text (A-9): one line when all pass; header + one row per
 * file otherwise. `counts` is the 4-key `{assets, builtin, project, invalid}`; the
 * the builtin-file text in `rows[].file` is assembled by `workflows.js` via
 * `WORKFLOW_CLI_TEXT.builtinFile`.
 *
 * @param {{counts:object, rows:Array<{file:string,detail:string,code:string}>}} input
 * @returns {string[]}
 */
export function renderWorkflowValidate({ counts, rows }) {
  if (!(Number(counts?.invalid) > 0)) {
    return [replaceAll(WORKFLOW_CLI_TEXT.validateOk, counts)];
  }
  const lines = [replaceAll(WORKFLOW_CLI_TEXT.validateFail, counts)];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(replaceAll(WORKFLOW_CLI_TEXT.validateRow, row));
  }
  return lines;
}

/**
 * `orch workflow dry-run` text (A-10).
 *
 * @param {{
 *   plan: object,          // the 8-key `planWorkflow` plan (`layers[].nodes` hold node
 *                          // ids, `mappings[]` is the 3-key `{from,to,edge}`, optional `warnings`)
 *   nodes: Array<object>,  // workflow node objects (id/title/nodeType/role/workflow/
 *                          // subNodeCount/parallelScope), turning ids into node descriptions
 *   joins?: Array<string>, // fan-in condition per layer ('all'|'any'), defaults to 'all'
 * }} input
 * @returns {string[]}
 */
export function renderWorkflowDryRun({ plan, nodes, joins }) {
  const text = WORKFLOW_CLI_TEXT.plan;
  const nodeById = new Map((Array.isArray(nodes) ? nodes : []).map((node) => [node?.id, node]));
  const nodeDesc = (id) => {
    const node = nodeById.get(id) ?? {};
    return replaceAll(text.nodeDesc, {
      id,
      title: node.title ?? dashOf(),
      type: workflowNodeTypeText(node),
    });
  };

  const layers = Array.isArray(plan?.layers) ? plan.layers : [];
  const parallelCount = layers.filter((layer) => layer?.parallel === true).length;
  const subCount = (Array.isArray(nodes) ? nodes : []).filter(
    (node) => node?.nodeType === 'subworkflow',
  ).length;

  const lines = [
    replaceAll(text.header, {
      id: plan?.id,
      nodes: plan?.nodeCount ?? 0,
      edges: plan?.edgeCount ?? 0,
      groups: parallelCount,
      subs: subCount,
    }),
  ];
  layers.forEach((layer, index) => {
    if (layer?.parallel === true) {
      const first = nodeById.get(layer.nodes?.[0]) ?? {};
      lines.push(
        replaceAll(text.layerParallel, {
          index: index + 1,
          name: first.parallelScope ?? dashOf(),
          nodes: (Array.isArray(layer.nodes) ? layer.nodes : []).map(nodeDesc).join('｜ '),
          join: Array.isArray(joins) ? joins[index] ?? 'all' : 'all',
        }),
      );
    } else {
      lines.push(replaceAll(text.layerNode, { index: index + 1, node: nodeDesc(layer?.nodes?.[0]) }));
    }
  });

  const branches = Array.isArray(plan?.branches) ? plan.branches : [];
  if (branches.length > 0) {
    lines.push(text.branchesHeader);
    for (const branch of branches) {
      lines.push(
        replaceAll(text.branchRow, {
          from: branch?.from,
          to: branch?.to,
          when: CONDITION_LABEL[branch?.when] ?? String(branch?.when ?? dashOf()),
        }),
      );
    }
  }

  const mappings = Array.isArray(plan?.mappings) ? plan.mappings : [];
  if (mappings.length > 0) {
    lines.push(text.mappingsHeader);
    for (const mapping of mappings) {
      // A-10 renders the target as `<edge target node>.<field>`; `edge` looks like `T-001→T-002`.
      const edgeTo = String(mapping?.edge ?? '').split('→').pop() ?? '';
      lines.push(
        replaceAll(text.mappingRow, {
          from: mapping?.from ?? dashOf(),
          to: `${edgeTo}.${mapping?.to ?? ''}`,
        }),
      );
    }
  }

  const policies = Array.isArray(plan?.policies) ? plan.policies : [];
  if (policies.length > 0) {
    lines.push(text.policiesHeader);
    for (const policy of policies) {
      lines.push(
        replaceAll(text.policyRow, {
          node: policy?.nodeId ?? dashOf(),
          timeout: policy?.timeout ?? dashOf(),
          retry: policy?.retry ?? 0,
        }),
      );
    }
  }

  const warnings = Array.isArray(plan?.warnings) ? plan.warnings.length : 0;
  lines.push(
    warnings > 0 ? replaceAll(text.conclusionWarned, { n: warnings }) : text.conclusion,
  );
  return lines;
}

// ---------------------------------------------------------------- I1.9 WP-6 渲染纯函数（只追加，既有函数零改）
//
// 中文全部来自 labels.js 的实际导出名（D-9）；本段不写任何中文字面量。
// `renderEventLines` 的按 reason 分派分支在函数开头，其余事件行格式 / 相对顺序不动。

/** 档位词：缺 `level` 降级 normal（不抛错）。 */
function healthLevelWord(health) {
  const level = typeof health?.level === 'string' && health.level.length > 0 ? health.level : 'normal';
  return HEALTH_LABEL[level] ?? HEALTH_LABEL.normal;
}

/**
 * D-12：按原因码从快照既有字段推导占位符实参（纯函数）。
 * 主契约为纯码值 `reasons: string[]`；优先读可选 `health.reasonVars?.[code]`（若 WP-7 提供），
 * 缺失时按推导表取快照字段；找不到匹配对象降级为空串（不抛错、不硬编码中文兜底）。
 * 角色中文取 labels.js 既有 ROLE_LABEL（节点 roleId → 中文）；`→` 为格式符号（既有 handoffRows 用法）。
 * 与 src/core/status-text.js 的 deriveHealthReasonVars 规则逐字对应（由 i19-render.test.js 锁定一致）。
 */
function deriveHealthReasonVars(snapshot, code) {
  const health = snapshot?.health ?? {};
  const provided = health?.reasonVars?.[code];
  if (provided && typeof provided === 'object') return provided;

  const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  const sessions = Array.isArray(snapshot?.sessions) ? snapshot.sessions : [];
  const handoffs = Array.isArray(snapshot?.handoffs) ? snapshot.handoffs : [];
  const nodeIdOf = (node) => node?.nodeId ?? node?.id ?? '';
  const roleWordOf = (id) => {
    const node = nodes.find((item) => nodeIdOf(item) === id) ?? null;
    return ROLE_LABEL[node?.roleId] ?? '';
  };
  const fromIdOf = (handoff) => handoff?.fromNodeId ?? handoff?.edge?.from ?? '';
  const toIdOf = (handoff) => handoff?.toNodeId ?? handoff?.edge?.to ?? '';
  const connectionOf = (handoff) => `${roleWordOf(fromIdOf(handoff))}→${roleWordOf(toIdOf(handoff))}`;

  switch (code) {
    case 'node_timeout':
    case 'p90_exceeded': {
      const node = nodes.find((item) => item?.state === 'running') ?? null;
      return { nodeId: node ? nodeIdOf(node) : '' };
    }
    case 'session_crash': {
      const session = sessions.find((item) => item?.quarantined === true) ?? null;
      return { sessionId: session ? (session?.sessionId ?? session?.id ?? '') : '' };
    }
    case 'role_unavailable': {
      const session = sessions.find((item) => item?.state === 'escalated' && item?.quarantined !== true) ?? null;
      return { role: session ? roleWordOf(session?.nodeId) : '' };
    }
    case 'connection_rejected': {
      const handoff = handoffs.find((item) => item?.state === 'rejected') ?? null;
      return { connection: handoff ? connectionOf(handoff) : '' };
    }
    case 'connection_expired': {
      const handoff = handoffs.find((item) => item?.state === 'expired') ?? null;
      return { connection: handoff ? connectionOf(handoff) : '' };
    }
    case 'handoff_ttl_half': {
      const handoff = handoffs.find((item) => item?.state === 'pending') ?? null;
      return { handoffId: handoff?.handoffId ?? '' };
    }
    default:
      return {};
  }
}

/**
 * 原因句拼接（D-8 / D-12）：遍历 `reasons`（已按 8 码固定顺序），逐码查 HEALTH_REASON 单表，
 * 用 HEALTH_LINE.sep 拼接；不硬编码中文、不重排、不追加别名。
 * 主契约：元素为码值字符串，实参由 `varsFor(code)` 从快照推导；对象元素 `{code,...}` 兼容保留（非主契约）。
 */
function healthReasonSentences(reasons, varsFor) {
  const list = Array.isArray(reasons) ? reasons : [];
  return list
    .map((reason) => {
      if (reason && typeof reason === 'object') {
        const template = HEALTH_REASON[reason.code];
        return typeof template === 'string' ? replaceAll(template, reason) : '';
      }
      const template = HEALTH_REASON[reason];
      if (typeof template !== 'string') return '';
      return replaceAll(template, varsFor(reason));
    })
    .join(HEALTH_LINE.sep);
}

/** A-6 四组四档 / A-6 附 8 行原因句：单行 `健康度 …[ · 原因]`；`now` 签名冻结、兼容保留。 */
export function renderHealthLine(snapshot, now) {
  void now;
  const health = snapshot?.health ?? {};
  const level = healthLevelWord(health);
  const reasons = healthReasonSentences(health.reasons, (code) => deriveHealthReasonVars(snapshot, code));
  if (reasons.length === 0) return replaceAll(HEALTH_LINE.base, { level });
  return replaceAll(HEALTH_LINE.withReasons, { level, reasons });
}

/**
 * A-8 健康度变化事件文本行：中文档位（from → to）+ 中文原因（HEALTH_REASON 查表）。
 * HEALTH_EVENT_LINE 不含 {ts}（F-01），须在行体前自补 `HH:MM:SS` + 两个半角空格。
 * D-12 ④：事件无快照，带占位符码只允许从 event.detail.reasonVars?.[code] 取值，缺失时降级；
 * A-8 判据只用 pending_escalation（无占位符），逐字基线不变。
 */
export function renderHealthEventLine(event) {
  const ts = formatClock(event?.ts) ?? '--:--:--';
  const reasonVars = event?.detail?.reasonVars ?? {};
  const segment = replaceAll(HEALTH_EVENT_LINE, {
    layer: LAYER_HEALTH.health,
    instanceId: event?.objectId ?? '?',
    from: HEALTH_LABEL[event?.from] ?? event?.from ?? '',
    to: HEALTH_LABEL[event?.to] ?? event?.to ?? '',
    reasons: healthReasonSentences(event?.detail?.reasons, (code) => reasonVars[code] ?? {}),
  });
  return `${ts}  ${segment}`;
}

/** 摘要四项 → `{command, exitCode, keyOutput, log}`；缺项（null/undefined）用 SUMMARY_LABEL.unavailable。 */
function summaryFour(summary) {
  const unavailable = SUMMARY_LABEL.unavailable;
  const present = (value) => value !== null && value !== undefined;
  const command = present(summary?.command) ? String(summary.command) : unavailable;
  const exitCode = present(summary?.exitCode) ? String(summary.exitCode) : unavailable;
  const keyOutput = present(summary?.keyOutputLines)
    ? replaceAll(SUMMARY_OUTPUT_LINES, { n: summary.keyOutputLines })
    : unavailable;
  const log = present(summary?.logRef) ? String(summary.logRef) : unavailable;
  return { command, exitCode, keyOutput, log };
}

/**
 * A-12 / A-14 执行摘要行：层名 / 会话号取法与 renderEventLine 保持一致
 * （LAYER 既有表 + event.objectId）；时刻取 event.ts 经 formatClock；
 * 取消四项全"未提供"复用同一行模板 SUMMARY_LOG_LINE。
 */
export function renderSummaryLogLine(event) {
  const ts = formatClock(event?.ts) ?? '--:--:--';
  return replaceAll(SUMMARY_LOG_LINE, {
    ts,
    layer: layerName(event?.object),
    sessionId: event?.objectId ?? '?',
    ...summaryFour(event?.detail?.summary),
  });
}

/** A-13 事件不可读行提示：填 {n}，单独成行、不带时刻前缀。 */
export function renderEventsSkippedLine(badLines) {
  return replaceAll(EVENTS_SKIPPED, { n: badLines });
}

/** 跨度节点列：`graphNode.title ?? nodeId` —— 有 title 输出 `节点号 标题`，无 title 只输出节点号。 */
function spanNodeColumn(span) {
  const nodeId = span?.node_id ?? '?';
  const title = span?.title;
  return typeof title === 'string' && title.length > 0 ? `${nodeId} ${title}` : nodeId;
}

/** 一条跨度行（A-2 / A-3 / A-10）；end_time 为 null 时进行中，结束位 `—`、结果位 `进行中`。 */
function traceSpanLine(span) {
  const running = span?.end_time === null || span?.end_time === undefined;
  const start = formatClock(span?.start_time) ?? '--:--:--';
  const end = running ? TRACE_NO_END : (formatClock(span?.end_time) ?? '--:--:--');
  const result = running ? TRACE_RUNNING : (span?.result ?? '');
  const ids = Array.isArray(span?.handoff_ids) ? span.handoff_ids : [];
  const handoffs = ids.length > 0 ? ids.join(' ') : TRACE_NO_BACKFLOW;
  return replaceAll(TRACE_SPAN, { start, end, node: spanNodeColumn(span), result, handoffs });
}

/** A-4 失败摘要行（缩进 2 半角空格由 SUMMARY_FAIL_LINE 模板提供）。 */
function failSummaryLine(summary) {
  return replaceAll(SUMMARY_FAIL_LINE, summaryFour(summary));
}

/** D-25：四项中至少一项非 null 才算"有摘要数据"（0 与空串算有值，只有 null/undefined 算缺）。 */
function hasSummaryData(summary) {
  if (!summary || typeof summary !== 'object') return false;
  return ['command', 'exitCode', 'keyOutputLines', 'logRef'].some(
    (key) => summary[key] !== null && summary[key] !== undefined
  );
}

/**
 * A-1 / A-2 / A-3 / A-4 / A-5 / A-10 / A-11 `orch trace show` 多行输出。
 * 消费已组装好的 payload（见交付回执 D-11），不读盘、不写状态、不追加事件。
 */
export function renderTraceShow(payload) {
  const instanceId = payload?.instanceId ?? '?';
  if (payload?.exists === false) return replaceAll(TRACE_MISSING_LINE, { instanceId });

  const spans = Array.isArray(payload?.spans) ? payload.spans : [];
  const backflows = Array.isArray(payload?.backflows) ? payload.backflows : [];
  const badLines = Number(payload?.badLines) || 0;
  const traceId = payload?.traceId;
  // D-26：空态只看跨度数组（含进行中叠加）是否非空；traceId 只在有跨度行时用于首行。
  const hasTrace = spans.length > 0;
  if (!hasTrace) return replaceAll(TRACE_EMPTY_LINE, { instanceId });

  // 进行中跨度不计入"跨度 N 条"（trace.js overlayRunningSpans 的口径）。
  const landed = spans.filter((span) => span?.end_time !== null && span?.end_time !== undefined).length;
  const lines = [];
  lines.push(replaceAll(TRACE_HEADER, { instanceId, traceId }));
  if (badLines > 0) lines.push(replaceAll(TRACE_DEGRADED, { n: badLines })); // A-11：汇总行之前
  lines.push(replaceAll(TRACE_SUMMARY, { spans: landed, backflows: backflows.length }));
  lines.push('');
  for (const span of spans) {
    lines.push(traceSpanLine(span));
    // D-25：四项全 null 不渲染失败摘要行（A-3 无此行）；任一项有值才渲染（A-4）。
    if (hasSummaryData(span?.summary)) lines.push(failSummaryLine(span.summary));
  }
  lines.push('');
  lines.push(TRACE_BACKFLOW_HEADER);
  if (backflows.length === 0) {
    lines.push(TRACE_NO_BACKFLOW);
  } else {
    for (const item of backflows) {
      lines.push(replaceAll(TRACE_BACKFLOW_ROW, {
        round: item?.round ?? 0,
        from: item?.from ?? '',
        to: item?.to ?? '',
        handoff: item?.handoff ?? '',
        state: item?.state ?? '',
      }));
    }
  }
  return lines.join('\n');
}

