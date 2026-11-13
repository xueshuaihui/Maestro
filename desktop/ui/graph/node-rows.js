/**
 * Role node and special node row projection (I1.10a WP-6; A-9 / A-10 / AC-11 /
 * AC-12 / AC-13, collaboration AC-14 / AC-30).
 *
 * Contract (split doc 2.2):
 * - `renderRoleRow(node, labels)` projects one role node into the fixed five
 *   element row of A-9: status colour token, active session count, serving
 *   nodes, host icons and the abnormality badge. Text comes verbatim from the
 *   frozen label keys (`DESKTOP_ROLE_ROW`, `_SERVING_MORE`, `_SESSION_STACK`,
 *   `DESKTOP_PLACEHOLDER`, `ROLE_INSTANCE_STATUS_LABEL_*`):
 *   - sessions render as the active-session count sentence; more than one also
 *     yields the stacked badge `xN` (`visual.sessionStack`), the text keeps
 *     the plain count;
 *   - serving nodes join with `, `; more than two collapse into the
 *     the "first, plus N more" folding form; none renders the placeholder;
 *   - host icons join with one space, in first-seen order, de-duplicated by
 *     the projection (this module never reorders them);
 *   - `width` / `height` come from the layout constants, so richer content
 *     never widens the node (AC-12).
 * - `renderSpecialRow(node, labels)` projects A-10 rows for the `human`,
 *   `escalate`, `subworkflow` and `group` node types plus the degraded
 *   "member count unknown" form. The type is read from `node.type` (the
 *   projection layer's `node_type`) only — never guessed from the title.
 * - Both renderers accept either label shape: the flat key table or the
 *   `GET /ui/labels` body `{ keys: { "<KEY>": "<template>" } }` (B-18, same
 *   seam as `renderLegend`). A table that lacks the required row template
 *   throws a `TypeError` naming the key instead of degrading to `text: null`.
 * - Group rows need the display name of the role group. The lookup order is
 *   `GROUP_LABEL_<GROUP>` (the same table_member flattening the daemon uses)
 *   → `GROUP_LABEL_UNGROUPED` when the node carries no group → the raw group
 *   id. This module never hardcodes a group name, and groups without a
 *   registered name keep their id (A-14 supplement, decision K).
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

import { NODE_HEIGHT, NODE_WIDTH } from './layout.js';
import { fillTemplate, resolveLabels } from '../labels/labels.js';

/** Role status token (A-9 five tokens) -> status word key (ROLE_INSTANCE_STATUS_LABEL_*). */
const STATUS_WORD_KEY = Object.freeze({
  available: 'ROLE_INSTANCE_STATUS_LABEL_AVAILABLE',
  serving: 'ROLE_INSTANCE_STATUS_LABEL_BUSY',
  cooldown: 'ROLE_INSTANCE_STATUS_LABEL_COOLDOWN',
  unavailable: 'ROLE_INSTANCE_STATUS_LABEL_UNAVAILABLE',
  inactive: 'ROLE_INSTANCE_STATUS_LABEL_INACTIVE',
});

/** Role status token -> colour token (A-9: green / blue / gray / red / gray). */
const STATUS_COLOR = Object.freeze({
  available: 'green',
  serving: 'blue',
  cooldown: 'gray',
  unavailable: 'red',
  inactive: 'gray',
});

/** Orchestration node state -> state word key (NODE_LABEL_*). */
const NODE_WORD_KEY = Object.freeze({
  pending: 'NODE_LABEL_PENDING',
  running: 'NODE_LABEL_RUNNING',
  review: 'NODE_LABEL_REVIEW',
  done: 'NODE_LABEL_DONE',
  failed: 'NODE_LABEL_FAILED',
  cancelled: 'NODE_LABEL_CANCELLED',
  escalated: 'NODE_LABEL_ESCALATED',
});

/** A-10 node types handled here (anything else belongs to renderRoleRow). */
const SPECIAL_TYPES = new Set(['human', 'escalate', 'subworkflow', 'group']);

function textOf(labels, key) {
  if (labels === null || typeof labels !== 'object' || typeof key !== 'string') return null;
  const value = labels[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Normalise either accepted label shape to the flat key table and assert the
 * keys this projection cannot render without.
 *
 * Shape handling is delegated to `resolveLabels` (`{ keys: {...} }` payload or
 * flat table) — the same seam the legend uses — so no second dialect exists.
 * A missing required key throws instead of silently yielding `text: null`.
 *
 * @param {unknown} labels flat key table or `{ keys: {...} }` payload
 * @param {string} owner renderer name for the error message
 * @param {string[]} required key names the row cannot be built without
 * @returns {Record<string, string>} the flat key table
 * @throws {TypeError} naming every missing key
 */
function requireLabelTable(labels, owner, required) {
  const table = resolveLabels(labels).keys;
  const missing = required.filter((key) => textOf(table, key) === null);
  if (missing.length > 0) {
    throw new TypeError(
      `${owner}: label table (flat keys or { keys } payload) is missing ${missing.join(', ')}`,
    );
  }
  return table;
}

function placeholderOf(labels) {
  return textOf(labels, 'DESKTOP_PLACEHOLDER') ?? '';
}

function numberOr(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function listOf(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.length > 0);
}

/**
 * Project one role node into the A-9 row.
 *
 * @param {object} node the frozen projection role node (read-only)
 * @param {Record<string, string> | { keys: Record<string, string> }} labels
 *        the frozen label key table, flat or wrapped in a `/ui/labels` payload
 * @returns {{ id: string|null, type: 'role', text: string,
 *             role: string|null, status: string|null, statusText: string|null,
 *             sessions: number, servingNodes: string[], hostIcons: string[],
 *             abnormalCount: number, width: number, height: number,
 *             visual: { statusColor: string, badge: string|null,
 *                       badgeCount: number, sessionStack: number,
 *                       stackBadge: string|null, animation: string } }}
 * @throws {TypeError} when the resolved table lacks `DESKTOP_ROLE_ROW`
 */
export function renderRoleRow(node, labels) {
  const table = requireLabelTable(labels, 'renderRoleRow', ['DESKTOP_ROLE_ROW']);
  const placeholder = placeholderOf(table);
  const status = typeof node?.status === 'string' ? node.status : null;
  const statusKey = status === null ? null : STATUS_WORD_KEY[status] ?? null;
  const statusText = statusKey === null ? null : textOf(table, statusKey);

  const role = typeof node?.title === 'string' && node.title.length > 0
    ? node.title
    : (typeof node?.roleId === 'string' && node.roleId.length > 0 ? node.roleId : node?.id ?? null);

  const sessions = numberOr(node?.activeSessions, 0);

  const servingNodes = listOf(node?.servingNodes);
  let servingText;
  if (servingNodes.length === 0) {
    servingText = placeholder;
  } else if (servingNodes.length > 2) {
    servingText = fillTemplate(textOf(table, 'DESKTOP_ROLE_ROW_SERVING_MORE') ?? '', {
      first: servingNodes[0],
      n: servingNodes.length,
    });
  } else {
    servingText = servingNodes.join(', ');
  }

  const hostIcons = listOf(node?.hostIcons);
  const hostsText = hostIcons.length === 0 ? placeholder : hostIcons.join(' ');

  const abnormalCount = Number.isInteger(node?.abnormalCount)
    ? node.abnormalCount
    : (node?.abnormal === true ? 1 : 0);

  const text = fillTemplate(table.DESKTOP_ROLE_ROW, {
    role: role ?? placeholder,
    status: statusText ?? placeholder,
    sessions,
    serving: servingText,
    hosts: hostsText,
    abnormal: abnormalCount,
  });

  const stackBadge = sessions > 1
    ? fillTemplate(textOf(table, 'DESKTOP_ROLE_ROW_SESSION_STACK') ?? '', { n: sessions })
    : null;

  return {
    id: typeof node?.id === 'string' ? node.id : null,
    type: 'role',
    text,
    role,
    status,
    statusText,
    sessions,
    servingNodes: servingNodes.slice(),
    hostIcons: hostIcons.slice(),
    abnormalCount,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    visual: {
      statusColor: status === null ? 'gray' : STATUS_COLOR[status] ?? 'gray',
      badge: abnormalCount > 0 ? 'escalated' : null,
      badgeCount: abnormalCount,
      sessionStack: sessions > 1 ? sessions : 0,
      stackBadge,
      animation: abnormalCount > 0 ? 'pulse' : 'none',
    },
  };
}

/**
 * Display name of the role group of one group node.
 *
 * Lookup order (decision K / B-16): the flattened `GROUP_LABEL_<GROUP>` key
 * when the table carries it; `GROUP_LABEL_UNGROUPED` when the node has no
 * group; otherwise the raw group id (groups without a registered name are a
 * known limitation, never invented here).
 */
function groupNameOf(node, table, placeholder) {
  const raw = typeof node?.group === 'string' && node.group.length > 0 ? node.group : null;
  if (raw === null) return textOf(table, 'GROUP_LABEL_UNGROUPED') ?? placeholder;
  const key = `GROUP_LABEL_${raw.replaceAll('-', '_').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
  return textOf(table, key) ?? raw;
}

/** Row template key of one A-10 node type (subworkflow degrades on an unknown member count). */
function templateKeyOf(type, memberCount) {
  if (type === 'human') return 'DESKTOP_HUMAN_ROW';
  if (type === 'escalate') return 'DESKTOP_ESCALATE_ROW';
  if (type === 'subworkflow') {
    return memberCount === null ? 'DESKTOP_SUBFLOW_UNKNOWN' : 'DESKTOP_SUBFLOW_ROW';
  }
  return 'DESKTOP_GROUP_ROW';
}

/**
 * Project one special node into the A-10 row.
 *
 * The type comes from `node.type` only (the definition layer `node_type`);
 * a title that happens to read like another type never changes the row.
 *
 * @param {object} node the frozen projection node (read-only)
 * @param {Record<string, string> | { keys: Record<string, string> }} labels
 *        the frozen label key table, flat or wrapped in a `/ui/labels` payload
 * @returns {{ id: string|null, type: string, text: string,
 *             title: string|null, status: string|null, statusText: string|null,
 *             memberCount: number|null, group: string|null, width: number,
 *             height: number,
 *             visual: { shape: string, color: string, animation: string,
 *                       badge: string|null, badgeCount: number } } | null}
 *        `null` only when the node type is not an A-10 type (it then belongs to
 *        `renderRoleRow`).
 * @throws {TypeError} when the resolved table lacks the row template key of
 *         the given node type
 */
export function renderSpecialRow(node, labels) {
  const type = typeof node?.type === 'string' ? node.type : null;
  if (type === null || !SPECIAL_TYPES.has(type)) return null;

  let memberCount = Number.isInteger(node?.memberCount) ? node.memberCount : null;
  const templateKey = templateKeyOf(type, memberCount);
  const table = requireLabelTable(labels, 'renderSpecialRow', [templateKey]);
  const template = table[templateKey];

  const placeholder = placeholderOf(table);
  const title = typeof node?.title === 'string' && node.title.length > 0 ? node.title : null;
  const status = typeof node?.status === 'string' ? node.status : null;
  const statusKey = status === null ? null : NODE_WORD_KEY[status] ?? null;
  const statusText = statusKey === null ? null : textOf(table, statusKey);
  const abnormal = node?.abnormal === true;
  const abnormalCount = Number.isInteger(node?.abnormalCount)
    ? node.abnormalCount
    : (abnormal ? 1 : 0);

  let shape = 'group';
  let color = 'green';
  let animation = 'none';
  let text;

  if (type === 'human') {
    shape = 'shield';
    color = 'gray';
    text = fillTemplate(template, { title: title ?? placeholder, status: statusText ?? placeholder });
  } else if (type === 'escalate') {
    shape = 'alert';
    color = 'red';
    animation = abnormal || status === 'escalated' ? 'pulse' : 'none';
    text = fillTemplate(template, { title: title ?? placeholder, status: statusText ?? placeholder });
  } else if (type === 'subworkflow') {
    shape = 'group';
    if (memberCount === null) {
      // D-3: an unreadable child definition keeps the group, gray, no pulse.
      color = 'gray';
      animation = 'none';
      const ref = typeof node?.workflow === 'string' && node.workflow.length > 0
        ? node.workflow
        : (node?.id ?? placeholder);
      text = fillTemplate(template, { id: ref });
    } else {
      color = abnormal ? 'red' : 'green';
      animation = abnormal ? 'pulse' : 'none';
      text = fillTemplate(template, { title: title ?? placeholder, n: memberCount });
    }
  } else {
    // Automatic collapse group (> 12 visible roles, A-10 row four).
    shape = 'group';
    color = abnormal ? 'red' : 'green';
    if (memberCount === null) {
      const ids = listOf(node?.nodeIds);
      memberCount = ids.length;
    }
    text = fillTemplate(template, { group: groupNameOf(node, table, placeholder), n: memberCount });
  }

  return {
    id: typeof node?.id === 'string' ? node.id : null,
    type,
    text,
    title,
    status,
    statusText,
    memberCount,
    group: typeof node?.group === 'string' ? node.group : null,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    visual: {
      shape,
      color,
      animation,
      badge: abnormal ? 'escalated' : null,
      badgeCount: abnormalCount,
    },
  };
}
