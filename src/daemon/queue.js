/**
 * 人工干预队列：跨实例合并投影与五动作决策映射（I1.11 WP-2 / 拆分文档 §2.3 /
 * 需求附录 D-3）。
 *
 * - `buildQueue` 是纯只读投影：条目从调用方传入的实例快照（`instance.get` 经
 *   `shapeSnapshot` 的形态）合并而来；本模块不读盘写盘、不发事件、不自行判重。
 * - totals 只聚合既有快照的 pending 计数字段（D-36：本模块不新增任何计数表达式，
 *   计数只留在核心、持久化与 shapeSnapshot 的既有实现内，这里逐字透传求和）。
 * - 决策一律转发既有裁决入口：pass/retry 走 IPC `escalation.resolve`（编排层
 *   的单 CAS 裁决），allow/deny 走 `approval.resolve`（含会话存活校验），
 *   终止走 `instance.cancel`（实例级取消，D-08）。核心错误码兜底，这里只把
 *   D-3 映射表里的固定结论附带返回，不自己判断条目状态。
 * - 中文文案集中在 QUEUE_LABELS / QUEUE_ERROR_CONCLUSIONS，供 WP-7 搬运进
 *   labels.js、WP-8 直接消费；模块内不散落硬编码。
 *
 * 零第三方依赖；不出现对升级/审批数组的任何计数表达式。
 */

import { createClient } from './client.js';
import { createStore } from '../persistence/instance-store.js';
import {
  DESKTOP_QUEUE_ACTION_PREFIX,
  DESKTOP_QUEUE_CONCLUSIONS,
  DESKTOP_QUEUE_DISABLED_HINT,
  DESKTOP_QUEUE_DISCONNECTED,
  DESKTOP_QUEUE_EMPTY,
  DESKTOP_QUEUE_STATE_UNREADABLE,
  ESCALATION_LABEL,
  APPROVAL_LABEL,
  ROLE_LABEL,
} from '../cli/labels.js';

/**
 * 队列侧中文文案键（附录 A-3 / A-4 / A-5 逐字；中文唯一来源 = src/cli/labels.js，
 * 本模块零中文字面量）。导出名保持不变，供既有测试与界面直接消费。
 */
export const QUEUE_LABELS = Object.freeze({
  EMPTY: DESKTOP_QUEUE_EMPTY,
  DISCONNECTED: DESKTOP_QUEUE_DISCONNECTED,
  STATE_UNREADABLE: DESKTOP_QUEUE_STATE_UNREADABLE,
  ACTION_PREFIX: DESKTOP_QUEUE_ACTION_PREFIX,
  PASS_UNAVAILABLE: DESKTOP_QUEUE_DISABLED_HINT,
});

/**
 * D-3 错误映射表：核心错误码 → 面向用户的固定结论词（labels.js 的
 * DESKTOP_QUEUE_CONCLUSIONS 同源引用）。结论词供「已处理（{结论}），无需再次
 * 处理」一类模板取值（D-13）。
 */
export const QUEUE_ERROR_CONCLUSIONS = DESKTOP_QUEUE_CONCLUSIONS;

const ESCALATION_DECISIONS = new Set(['pass', 'retry']);
const APPROVAL_DECISIONS = new Set(['allow', 'deny']);
const TYPE_ORDER = { escalation: 0, approval: 1 };
const CONNECT_HOT_RETRY_MS = 1500;
const RPC_TIMEOUT_MS = 30_000;

/** 明细排序键：纯字典序，跨环境稳定。 */
function compareText(a, b) {
  const left = typeof a === 'string' && a.length > 0 ? a : null;
  const right = typeof b === 'string' && b.length > 0 ? b : null;
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function compareQueueRows(a, b) {
  const typeDiff = (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  if (typeDiff !== 0) return typeDiff;
  const idDiff = compareText(a.id, b.id);
  if (idDiff !== 0) return idDiff;
  return compareText(a.instanceId, b.instanceId);
}

function nodeOfSnapshot(snapshot, nodeId) {
  const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  if (typeof nodeId !== 'string' || nodeId.length === 0) return null;
  return nodes.find((item) => item?.nodeId === nodeId) ?? null;
}

function roleWordOf(node) {
  const roleId = typeof node?.roleId === 'string' ? node.roleId : null;
  if (roleId === null || roleId.length === 0) return null;
  return ROLE_LABEL[roleId] ?? roleId;
}

/**
 * 轮次取值：升级条目自带 round；审批行没有轮次字段，只能由 nodeId 反查所属
 * 节点当前轮次（D-19）。两处都取不到时返回 null（界面渲染 `—`，段不省略）。
 */
function roundOfEntry(entry, node) {
  if (Number.isInteger(entry?.round)) return entry.round;
  if (Number.isInteger(node?.round)) return node.round;
  return null;
}

function reasonTextOf(detail) {
  return typeof detail === 'string' && detail.length > 0 ? detail : null;
}

function escalationRow(snapshot, entry) {
  const node = nodeOfSnapshot(snapshot, entry?.nodeId);
  return {
    type: 'escalation',
    id: entry?.escalationId ?? null,
    instanceId: snapshot?.instanceId ?? null,
    nodeId: entry?.nodeId ?? null,
    role: roleWordOf(node),
    round: roundOfEntry(entry, node),
    stateWord: ESCALATION_LABEL[entry?.state] ?? entry?.state ?? null,
    reasonSummary: reasonTextOf(entry?.reasonDetail),
    createdAt: entry?.createdAt ?? null,
  };
}

function approvalRow(snapshot, row) {
  const node = nodeOfSnapshot(snapshot, row?.nodeId);
  const action = row?.action ?? '?';
  return {
    type: 'approval',
    id: row?.approvalId ?? null,
    instanceId: snapshot?.instanceId ?? null,
    nodeId: row?.nodeId ?? null,
    role: roleWordOf(node),
    round: roundOfEntry(row, node),
    stateWord: APPROVAL_LABEL[row?.state] ?? row?.state ?? null,
    reasonSummary: `${QUEUE_LABELS.ACTION_PREFIX} ${action}`,
    createdAt: row?.createdAt ?? null,
  };
}

/**
 * 单行降级（A-3）：实例状态不可读时该行仍出现、标注「状态不可读」，其余行
 * 照常处置。行是否存在以调用方带来的既有 pending 计数为准（计数本身就是
 * 既有快照字段，这里不做任何重算）。
 */
function degradedRow(snapshot) {
  const escalations = Number.isInteger(snapshot.pendingEscalations)
    ? snapshot.pendingEscalations
    : 0;
  const approvals = Number.isInteger(snapshot.pendingApprovals)
    ? snapshot.pendingApprovals
    : 0;
  if (escalations <= 0 && approvals <= 0) return null;
  return {
    type: escalations > 0 ? 'escalation' : 'approval',
    id: null,
    instanceId: snapshot?.instanceId ?? null,
    nodeId: null,
    role: null,
    round: null,
    stateWord: QUEUE_LABELS.STATE_UNREADABLE,
    reasonSummary: null,
    createdAt: null,
  };
}

/** totals 只对既有计数字段求和（D-36：投影层零计数）。 */
function sumSnapshotField(instances, field) {
  let total = 0;
  for (const snapshot of instances) {
    const value = snapshot?.[field];
    if (Number.isInteger(value) && value > 0) total += value;
  }
  return total;
}

/**
 * 跨实例统一队列投影（只读）。`instances` 的每个元素是实例快照（含
 * instanceId / nodes / escalations / approvals 与既有 pending 计数字段）；
 * 元素带 `unreadable: true` 时按 A-3 降级行处理。`instances` 缺失（调用方
 * 连实例清单都取不到，例如守护进程断连）时返回断线位，条目保留由调用方负责。
 */
export function buildQueue(root, { instances } = {}) {
  if (!Array.isArray(instances)) {
    return {
      items: [],
      totals: { pendingEscalations: 0, pendingApprovals: 0 },
      disconnected: true,
    };
  }
  const items = [];
  for (const snapshot of instances) {
    if (!snapshot || typeof snapshot !== 'object') continue;
    if (snapshot.unreadable === true) {
      const row = degradedRow(snapshot);
      if (row) items.push(row);
      continue;
    }
    const escalations = Array.isArray(snapshot.escalations) ? snapshot.escalations : [];
    for (const entry of escalations) {
      if (entry?.state === 'pending') items.push(escalationRow(snapshot, entry));
    }
    const approvals = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];
    for (const row of approvals) {
      if (row?.state === 'pending') items.push(approvalRow(snapshot, row));
    }
  }
  items.sort(compareQueueRows);
  return {
    items,
    totals: {
      pendingEscalations: sumSnapshotField(instances, 'pendingEscalations'),
      pendingApprovals: sumSnapshotField(instances, 'pendingApprovals'),
    },
  };
}

/**
 * 只读定位：跨实例找一个条目。主类型未命中但另一类型命中时返回另一类型
 * （供动作错配判定）；不抛错、不写盘。返回 null 表示两类条目里都不存在。
 */
async function locateEntry(root, primaryKind, id) {
  if (typeof id !== 'string' || id.length === 0) return null;
  const store = createStore({ root });
  const listed = await store.list();
  const items = Array.isArray(listed?.items) ? listed.items : [];
  const primaryField = primaryKind === 'escalation' ? 'escalationId' : 'approvalId';
  const otherField = primaryKind === 'escalation' ? 'approvalId' : 'escalationId';
  let otherHit = null;
  for (const item of items) {
    const instanceId = item?.instanceId;
    if (typeof instanceId !== 'string' || instanceId.length === 0) continue;
    const loaded = await store.load(instanceId);
    if (!loaded?.ok) continue;
    const escalations = Array.isArray(loaded.state?.escalations) ? loaded.state.escalations : [];
    const approvals = Array.isArray(loaded.state?.approvals) ? loaded.state.approvals : [];
    const primaryRows = primaryKind === 'escalation' ? escalations : approvals;
    const otherRows = primaryKind === 'escalation' ? approvals : escalations;
    const primary = primaryRows.find((row) => row?.[primaryField] === id);
    if (primary) return { kind: primaryKind, instanceId, entry: primary };
    if (otherHit === null) {
      const hit = otherRows.find((row) => row?.[otherField] === id);
      if (hit) {
        otherHit = {
          kind: primaryKind === 'escalation' ? 'approval' : 'escalation',
          instanceId,
          entry: hit,
        };
      }
    }
  }
  return otherHit;
}

/** 经 IPC 客户端转发到核心；错误码按 D-3 映射表附带固定结论词。 */
async function forward(root, method, params) {
  const client = createClient({ root });
  try {
    const connected = await client.connect({ ensure: false, hotRetryMs: CONNECT_HOT_RETRY_MS });
    if (!connected?.ok) {
      return { ok: false, code: 'CORE_NOT_RUNNING' };
    }
    const res = await client.request(method, params, { timeoutMs: RPC_TIMEOUT_MS });
    if (res?.ok === true) {
      return { ok: true, result: res.result ?? null };
    }
    const code = res?.code ?? 'UNKNOWN_ERROR';
    const conclusion = QUEUE_ERROR_CONCLUSIONS[code] ?? null;
    return {
      ok: false,
      code,
      params: res?.params ?? {},
      ...(conclusion !== null ? { conclusion } : {}),
    };
  } finally {
    await client.close();
  }
}

function notSupported(decision) {
  return { ok: false, code: 'ACTION_NOT_SUPPORTED', params: { decision: decision ?? null } };
}

/**
 * 升级决策：pass（判该轮通过）/ retry（重派）。
 * - pass 仅对轮次超限类升级可用（U-5 / AC-44 数据侧依据）：其余 reasonCode
 *   返回显式 ACTION_NOT_SUPPORTED 并携带 hint 与原因码，不触碰核心。
 * - 条目实际是审批（行被数据错配刷新）时同样返回 ACTION_NOT_SUPPORTED（D-3）。
 * - 判重由核心错误码兜底（不写第二条判定），这里只映射固定结论。
 */
export async function decideEscalation(root, id, decision) {
  if (!ESCALATION_DECISIONS.has(decision)) {
    return notSupported(decision);
  }
  const located = await locateEntry(root, 'escalation', id);
  if (located?.kind === 'approval') {
    return {
      ok: false,
      code: 'ACTION_NOT_SUPPORTED',
      params: { decision, instanceId: located.instanceId },
    };
  }
  if (decision === 'pass' && located?.entry && located.entry.reasonCode !== 'rounds_exceeded') {
    return {
      ok: false,
      code: 'ACTION_NOT_SUPPORTED',
      hint: QUEUE_LABELS.PASS_UNAVAILABLE,
      params: {
        decision,
        reasonCode: located.entry.reasonCode ?? null,
        instanceId: located.instanceId,
      },
    };
  }
  // 经既有裁决入口（IPC `escalation.resolve` → orchestrator.resolveEscalation
  // 的单 CAS：裁决 + 节点/实例/会话迁移一次落盘），按条目所属实例显式路由。
  return forward(root, 'escalation.resolve', {
    instanceId: located?.instanceId ?? null,
    escalationId: id,
    decision,
  });
}

/**
 * 审批决策：allow（允许）/ deny（拒绝）。会话失效判定由核心的既有路径完成
 * （内存 respond 句柄不在就拒，绝不假放行），这里不做任何本地判断。
 */
export async function decideApproval(root, id, decision) {
  if (!APPROVAL_DECISIONS.has(decision)) {
    return notSupported(decision);
  }
  const located = await locateEntry(root, 'approval', id);
  if (located?.kind === 'escalation') {
    return {
      ok: false,
      code: 'ACTION_NOT_SUPPORTED',
      params: { decision, instanceId: located.instanceId },
    };
  }
  return forward(root, 'approval.resolve', {
    instanceId: located?.instanceId ?? null,
    approvalId: id,
    decision,
  });
}

/**
 * 终止（D-08：实例级取消）。走既有取消入口，由核心在同一 CAS 里作废全部
 * 待处理升级与待审批；队列层不改任何状态字段。
 */
export async function cancelInstance(root, instanceId) {
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, code: 'IPC_BAD_PARAMS', params: { field: 'instanceId' } };
  }
  return forward(root, 'instance.cancel', { instanceId });
}
