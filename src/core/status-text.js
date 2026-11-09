/**
 * 核心侧中文词表与 `status.md` 渲染（拆分文档 §2.7 / 需求 M-2、A-1）。
 *
 * 这里只放**状态词与字段名**：图标题、节点标题一律由调用方注入的图对象提供
 * （`graph.title` / `node.title`），本模块不持有任何模板名/角色字面量。
 *
 * 状态词与 `src/cli/labels.js` 的对应表逐字一致（`test/wp11/labels-sync.test.js`
 * 两侧同键深比较锁定）；核心不 import CLI，两张表各自维护、由测试防止漂移。
 *
 * 依赖方向：无（纯数据 + 纯函数）。
 */

// I1.7 WP-5（AC-12）：code 角色节点的分支名 / 合并状态文案一律取自 labels.js 键，本文件零中文硬编码。
// 纯净扫描（src/core）约束：import 语句与本文件均不出现 31 禁词；中文文案只在 labels.js。
import {
  CODE_ROLE_BRANCH,
  MERGE_PENDING,
  MERGE_MERGING,
  MERGE_MERGED,
  MERGE_CONFLICT,
} from '../cli/labels.js';

/** 状态词表：键与 `src/cli/labels.js` 的六张表一一对应。 */
export const CORE_TEXT = Object.freeze({
  instance: Object.freeze({
    created: '已创建',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断',
    suspended: '已挂起'
  }),
  node: Object.freeze({
    pending: '待执行',
    running: '执行中',
    review: '待校验',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消',
    escalated: '已升级'
  }),
  session: Object.freeze({
    idle: '空闲',
    thinking: '执行中',
    tool_running: '执行中',
    waiting_input: '等待审批',
    waiting_dependency: '等待下游',
    escalated: '已升级'
  }),
  handoff: Object.freeze({
    created: '已构造',
    delivered: '已投递',
    pending: '待投递',
    accepted: '已接受',
    consumed: '已完成',
    rejected: '已拒绝',
    expired: '已过期'
  }),
  escalation: Object.freeze({
    pending: '待处理',
    resolved: '已处理',
    voided: '已作废'
  }),
  approval: Object.freeze({
    pending: '待处理',
    approved: '已通过',
    denied: '已拒绝',
    withdrawn: '已作废'
  }),
  /** `status.md` 的字段名与段名（A-1）。 */
  doc: Object.freeze({
    status: '状态',
    paused: '暂停',
    task: '任务',
    currentNode: '当前节点',
    updated: '更新',
    workspace: '工作区',
    nodes: '节点',
    handoffs: '交接包',
    escalations: '升级',
    approvals: '审批',
    none: '无',
    yes: '是',
    no: '否',
    roundPrefix: '第',
    roundSuffix: '轮',
    input: '输入',
    node: '节点',
    action: '动作'
  }),
  /** 坏包 detail（D-3.4）：码机读，文案集中在核心侧。 */
  handoffInvalid: Object.freeze({
    prefix: '交接包 {id} 内容不合规：',
    fieldMissing: '缺少字段 {field}',
    edgeInvalid: '交接未关联有效交接边',
    evidenceMissing: '缺少证据引用 {ref}',
    evidenceUnreadable: '证据不可读 {ref}',
    evidenceEmpty: '证据为空 {ref}',
    evidenceEscape: '证据越界 {ref}',
    hashMismatch: '证据哈希不符 {ref}',
    backflowIncomplete: '回流缺少{field}'
  }),
  /** 投递耗尽后的升级原因（D-4.9）。 */
  deliveryFailed: '交接包 {id} 投递失败（已尝试 {n} 次）：{lastError}'
});

/** 校验码 → `CORE_TEXT.handoffInvalid` 的键。 */
const HANDOFF_INVALID_KEYS = Object.freeze({
  HANDOFF_FIELD_MISSING: 'fieldMissing',
  HANDOFF_EDGE_INVALID: 'edgeInvalid',
  HANDOFF_EVIDENCE_MISSING: 'evidenceMissing',
  HANDOFF_EVIDENCE_UNREADABLE: 'evidenceUnreadable',
  HANDOFF_EVIDENCE_EMPTY: 'evidenceEmpty',
  HANDOFF_EVIDENCE_ESCAPE: 'evidenceEscape',
  HANDOFF_HASH_MISMATCH: 'hashMismatch',
  HANDOFF_BACKFLOW_INCOMPLETE: 'backflowIncomplete'
});

/**
 * 占位符替换：`{name}` 取 `vars[name]`，缺失时填空串（不抛、不留 `undefined`）。
 *
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @returns {string}
 */
export function applyPlaceholders(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * 坏包 detail：`交接包 HO-002 内容不合规：缺少证据引用 calc.js`。
 *
 * 未知码不抛：退化成 `<前缀><码>`，保证日志里仍有可定位信息。
 *
 * @param {string} code  `HANDOFF_*` 校验码
 * @param {Record<string, unknown>} [params]  `{ id, field, ref }`
 * @returns {string}
 */
export function handoffInvalidDetail(code, params = {}) {
  const text = CORE_TEXT.handoffInvalid;
  const key = HANDOFF_INVALID_KEYS[code] ?? null;
  const body = key ? applyPlaceholders(text[key], params) : String(code ?? '');
  return `${applyPlaceholders(text.prefix, params)}${body}`;
}

/** `是` / `否`。 */
export function yesNo(flag) {
  return flag === true ? CORE_TEXT.doc.yes : CORE_TEXT.doc.no;
}

const SEP = ' · ';

function wordOf(table, value) {
  if (value === undefined || value === null) return '';
  return Object.prototype.hasOwnProperty.call(table, value) ? table[value] : String(value);
}

function graphNodeOf(graph, nodeId) {
  if (typeof nodeId !== 'string' || !Array.isArray(graph?.nodes)) return null;
  return graph.nodes.find((node) => node?.id === nodeId || node?.nodeId === nodeId) ?? null;
}

function titleOf(graph, nodeId) {
  return graphNodeOf(graph, nodeId)?.title ?? nodeId ?? '';
}

function stateNodeOf(state, nodeId) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  return nodes.find((node) => node?.nodeId === nodeId) ?? null;
}

function roundText(round) {
  const value = Number.isInteger(round) ? round : 0;
  return `${CORE_TEXT.doc.roundPrefix} ${value} ${CORE_TEXT.doc.roundSuffix}`;
}

/**
 * code 角色节点的「分支名 + 合并状态」片段（AC-12）。仅在节点含 `branch` 字段时追加，
 * 文案来自 labels.js 键（`CODE_ROLE_BRANCH` / `MERGE_*`），本文件零中文硬编码。
 *
 * @param {object} node  节点对象（含 `branch` / `mergeStatus`）
 * @param {string} title 节点标题（图声明里的角色名，作为 `{role}` 占位）
 * @returns {string|null} 形如 `开发 分支 maestro/INST-001/role · 已合并`，无分支时 null
 */
function codeBranchFragment(node, title) {
  if (!node || typeof node.branch !== 'string' || node.branch.length === 0) return null;
  const role = typeof title === 'string' && title.length > 0 ? title : '';
  const branchText = applyPlaceholders(CODE_ROLE_BRANCH, { role, branch: node.branch }).replace(/^\s+/, '');
  const merge = node?.mergeStatus;
  const mergeText =
    merge === 'pending' ? MERGE_PENDING
    : merge === 'merging' ? MERGE_MERGING
    : merge === 'merged' ? MERGE_MERGED
    : merge === 'conflict' ? MERGE_CONFLICT
    : null;
  return mergeText ? `${branchText} · ${mergeText}` : branchText;
}

/** 多节点图：按图声明顺序列出节点行；状态里多出来的节点追加在末尾。 */
function nodeRows(state, graph) {
  const declared = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rows = [];
  const seen = new Set();
  for (const def of declared) {
    const nodeId = def?.id ?? def?.nodeId;
    if (typeof nodeId !== 'string') continue;
    seen.add(nodeId);
    const node = stateNodeOf(state, nodeId);
    let row =
      `${nodeId} ${def?.title ?? nodeId}：${wordOf(CORE_TEXT.node, node?.state)}` +
      `${SEP}${roundText(node?.round)}`;
    // F-03：仅 `status.md` 视图（`renderStatusDoc` 产出）追加分支/合并状态，绝不进三主链运行期输出。
    const frag = codeBranchFragment(node, def?.title ?? nodeId);
    if (frag) row += `${SEP}${frag}`;
    rows.push(row);
  }
  for (const node of Array.isArray(state?.nodes) ? state.nodes : []) {
    const nodeId = node?.nodeId;
    if (typeof nodeId !== 'string' || seen.has(nodeId)) continue;
    let row = `${nodeId} ${nodeId}：${wordOf(CORE_TEXT.node, node.state)}${SEP}${roundText(node.round)}`;
    const frag = codeBranchFragment(node, nodeId);
    if (frag) row += `${SEP}${frag}`;
    rows.push(row);
  }
  return rows;
}

/** 当前节点：运行中/待校验 > 已升级 > 失败 > 最后一个非待执行节点 > 图入口。 */
function currentNodeOf(state, graph) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const pick = (predicate) => nodes.find(predicate) ?? null;
  const chosen =
    pick((node) => node?.state === 'running' || node?.state === 'review') ??
    pick((node) => node?.state === 'escalated') ??
    pick((node) => node?.state === 'failed') ??
    [...nodes].reverse().find((node) => typeof node?.state === 'string' && node.state !== 'pending') ??
    null;
  const nodeId = chosen?.nodeId ?? (Array.isArray(graph?.nodes) ? graph.nodes[0]?.id ?? null : null);
  if (typeof nodeId !== 'string') return null;
  return { nodeId, title: titleOf(graph, nodeId) };
}

/** 交接包行：方向段只对多节点图输出（A-1 / §3.3）。 */
function handoffRows(state, graph, multi) {
  const rows = [];
  for (const handoff of Array.isArray(state?.handoffs) ? state.handoffs : []) {
    const handoffId = handoff?.handoffId;
    if (typeof handoffId !== 'string') continue;
    const fromId = handoff?.edge?.from ?? null;
    const toId = handoff?.edge?.to ?? null;
    const direction =
      multi && typeof fromId === 'string' && typeof toId === 'string'
        ? `${titleOf(graph, fromId)}→${titleOf(graph, toId)}`
        : '';
    const head = `${handoffId}${direction ? ` ${direction}` : ''}：${wordOf(CORE_TEXT.handoff, handoff?.state)}`;
    const input = Array.isArray(handoff?.artifactRefs?.input)
      ? handoff.artifactRefs.input.filter((ref) => typeof ref === 'string' && ref.length > 0)
      : [];
    rows.push(input.length > 0 ? `${head}${SEP}${CORE_TEXT.doc.input} ${input.join(' ')}` : head);
  }
  return rows;
}

function escalationRows(state, graph) {
  const rows = [];
  for (const item of Array.isArray(state?.escalations) ? state.escalations : []) {
    const id = item?.escalationId;
    if (typeof id !== 'string') continue;
    const head =
      `${id} ${wordOf(CORE_TEXT.escalation, item?.state)}` +
      `${SEP}${CORE_TEXT.doc.node} ${item?.nodeId ?? ''} ${titleOf(graph, item?.nodeId)}` +
      `${SEP}${roundText(item?.round)}`;
    const detail = typeof item?.reasonDetail === 'string' && item.reasonDetail.length > 0
      ? `${SEP}${item.reasonDetail}`
      : '';
    rows.push(`${head}${detail}`);
  }
  return rows;
}

function approvalRows(state, graph) {
  const rows = [];
  for (const item of Array.isArray(state?.approvals) ? state.approvals : []) {
    const id = item?.approvalId;
    if (typeof id !== 'string') continue;
    rows.push(
      `${id} ${wordOf(CORE_TEXT.approval, item?.state)}` +
        `${SEP}${CORE_TEXT.doc.node} ${item?.nodeId ?? ''} ${titleOf(graph, item?.nodeId)}` +
        `${SEP}${CORE_TEXT.doc.action} ${item?.action ?? ''}`
    );
  }
  return rows;
}

/**
 * 渲染整份 `status.md`（A-1）。纯函数：不读盘、不取当前时间。
 *
 * `single`（图只有一个节点）省略 `## 节点` 段与"当前节点"行；交接包行不带方向段。
 *
 * @param {object} state   实例快照：`instanceId / state / paused / task / updatedAt / nodes[] /
 *                         handoffs[] / escalations[] / approvals[]`
 * @param {object|null} graph  注入的图对象：`title / nodes[].{id,nodeId,title}`
 * @param {{workspaceDir?:string|null}} [options]  工作区绝对路径（写入"工作区"行）
 * @returns {string} 整份 Markdown（以单个换行结尾）
 */
export function renderStatusDoc(state, graph = null, options = {}) {
  const instanceId = typeof state?.instanceId === 'string' ? state.instanceId : '';
  const title = typeof graph?.title === 'string' ? graph.title : '';
  const multi = Array.isArray(graph?.nodes) && graph.nodes.length > 1;
  const workspaceDir = typeof options?.workspaceDir === 'string' ? options.workspaceDir : '';
  const paused = state?.paused === true;

  const lines = [];
  lines.push(`# ${instanceId}${title ? ` ${title}` : ''}`, '');
  lines.push(`- ${CORE_TEXT.doc.status}：${wordOf(CORE_TEXT.instance, state?.state)}`);
  lines.push(`- ${CORE_TEXT.doc.paused}：${yesNo(paused)}`);
  lines.push(`- ${CORE_TEXT.doc.task}：${typeof state?.task === 'string' ? state.task : ''}`);
  if (multi) {
    const current = currentNodeOf(state, graph);
    if (current) lines.push(`- ${CORE_TEXT.doc.currentNode}：${current.nodeId} ${current.title}`);
  }
  lines.push(`- ${CORE_TEXT.doc.updated}：${typeof state?.updatedAt === 'string' ? state.updatedAt : ''}`);
  lines.push(`- ${CORE_TEXT.doc.workspace}：${workspaceDir}`);

  const sections = [];
  if (multi) sections.push([CORE_TEXT.doc.nodes, nodeRows(state, graph)]);
  sections.push([CORE_TEXT.doc.handoffs, handoffRows(state, graph, multi)]);
  sections.push([CORE_TEXT.doc.escalations, escalationRows(state, graph)]);
  sections.push([CORE_TEXT.doc.approvals, approvalRows(state, graph)]);

  for (const [heading, rows] of sections) {
    lines.push('', `## ${heading}`, '');
    if (rows.length === 0) lines.push(`- ${CORE_TEXT.doc.none}`);
    else for (const row of rows) lines.push(`- ${row}`);
  }

  return `${lines.join('\n')}\n`;
}
