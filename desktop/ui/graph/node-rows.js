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
 * - Group rows need the display name of the role group. The frozen label
 *   table carries the row template but not the five group names, so the lookup
 *   is `GROUP_LABEL_<GROUP>` (the same table_member flattening the daemon uses);
 *   when the table does not carry it, the raw group id from the node is used.
 *   This module never hardcodes a group name.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 */

import { NODE_HEIGHT, NODE_WIDTH } from './layout.js';
import { fillTemplate } from '../labels/labels.js';

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
 * @param {Record<string, string>} labels the frozen label key table
 * @returns {{ id: string|null, type: 'role', text: string|null,
 *             role: string|null, status: string|null, statusText: string|null,
 *             sessions: number, servingNodes: string[], hostIcons: string[],
 *             abnormalCount: number, width: number, height: number,
 *             visual: { statusColor: string, badge: string|null,
 *                       badgeCount: number, sessionStack: number,
 *                       stackBadge: string|null, animation: string } }}
 */
export function renderRoleRow(node, labels) {
  const placeholder = placeholderOf(labels);
  const status = typeof node?.status === 'string' ? node.status : null;
  const statusKey = status === null ? null : STATUS_WORD_KEY[status] ?? null;
  const statusText = statusKey === null ? null : textOf(labels, statusKey);

  const role = typeof node?.title === 'string' && node.title.length > 0
    ? node.title
    : (typeof node?.roleId === 'string' && node.roleId.length > 0 ? node.roleId : node?.id ?? null);

  const sessions = numberOr(node?.activeSessions, 0);

  const servingNodes = listOf(node?.servingNodes);
  let servingText;
  if (servingNodes.length === 0) {
    servingText = placeholder;
  } else if (servingNodes.length > 2) {
    servingText = fillTemplate(textOf(labels, 'DESKTOP_ROLE_ROW_SERVING_MORE') ?? '', {
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

  const template = textOf(labels, 'DESKTOP_ROLE_ROW');
  const text = template === null
    ? null
    : fillTemplate(template, {
      role: role ?? placeholder,
      status: statusText ?? placeholder,
      sessions,
      serving: servingText,
      hosts: hostsText,
      abnormal: abnormalCount,
    });

  const stackBadge = sessions > 1
    ? fillTemplate(textOf(labels, 'DESKTOP_ROLE_ROW_SESSION_STACK') ?? '', { n: sessions })
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
 * Display name of the role group of one group node. Looked up through the
 * flattened `GROUP_LABEL_<GROUP>` key when the table carries it; the raw group
 * id is the fallback so no Chinese literal ever lives in this module.
 */
function groupNameOf(node, labels, placeholder) {
  const raw = typeof node?.group === 'string' && node.group.length > 0 ? node.group : null;
  if (raw === null) return placeholder;
  const key = `GROUP_LABEL_${raw.replaceAll('-', '_').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
  return textOf(labels, key) ?? (typeof node?.title === 'string' && node.title.length > 0 ? node.title : raw);
}

/**
 * Project one special node into the A-10 row.
 *
 * The type comes from `node.type` only (the definition layer `node_type`);
 * a title that happens to read like another type never changes the row.
 *
 * @param {object} node the frozen projection node (read-only)
 * @param {Record<string, string>} labels the frozen label key table
 * @returns {{ id: string|null, type: string, text: string|null,
 *             title: string|null, status: string|null, statusText: string|null,
 *             memberCount: number|null, group: string|null, width: number,
 *             height: number,
 *             visual: { shape: string, color: string, animation: string,
 *                       badge: string|null, badgeCount: number } } | null}
 */
export function renderSpecialRow(node, labels) {
  const type = typeof node?.type === 'string' ? node.type : null;
  if (type === null || !SPECIAL_TYPES.has(type)) return null;

  const placeholder = placeholderOf(labels);
  const title = typeof node?.title === 'string' && node.title.length > 0 ? node.title : null;
  const status = typeof node?.status === 'string' ? node.status : null;
  const statusKey = status === null ? null : NODE_WORD_KEY[status] ?? null;
  const statusText = statusKey === null ? null : textOf(labels, statusKey);
  const abnormal = node?.abnormal === true;
  const abnormalCount = Number.isInteger(node?.abnormalCount)
    ? node.abnormalCount
    : (abnormal ? 1 : 0);

  let text = null;
  let shape = 'group';
  let color = 'green';
  let animation = 'none';
  let memberCount = Number.isInteger(node?.memberCount) ? node.memberCount : null;

  if (type === 'human') {
    shape = 'shield';
    color = 'gray';
    const template = textOf(labels, 'DESKTOP_HUMAN_ROW');
    text = template === null
      ? null
      : fillTemplate(template, { title: title ?? placeholder, status: statusText ?? placeholder });
  } else if (type === 'escalate') {
    shape = 'alert';
    color = 'red';
    animation = abnormal || status === 'escalated' ? 'pulse' : 'none';
    const template = textOf(labels, 'DESKTOP_ESCALATE_ROW');
    text = template === null
      ? null
      : fillTemplate(template, { title: title ?? placeholder, status: statusText ?? placeholder });
  } else if (type === 'subworkflow') {
    shape = 'group';
    if (memberCount === null) {
      // D-3: an unreadable child definition keeps the group, gray, no pulse.
      color = 'gray';
      animation = 'none';
      const template = textOf(labels, 'DESKTOP_SUBFLOW_UNKNOWN');
      const ref = typeof node?.workflow === 'string' && node.workflow.length > 0
        ? node.workflow
        : (node?.id ?? placeholder);
      text = template === null
        ? null
        : fillTemplate(template, { id: ref });
    } else {
      color = abnormal ? 'red' : 'green';
      animation = abnormal ? 'pulse' : 'none';
      const template = textOf(labels, 'DESKTOP_SUBFLOW_ROW');
      text = template === null
        ? null
        : fillTemplate(template, { title: title ?? placeholder, n: memberCount });
    }
  } else {
    // Automatic collapse group (> 12 visible roles, A-10 row four).
    shape = 'group';
    color = abnormal ? 'red' : 'green';
    if (memberCount === null) {
      const ids = listOf(node?.nodeIds);
      memberCount = ids.length;
    }
    const template = textOf(labels, 'DESKTOP_GROUP_ROW');
    text = template === null
      ? null
      : fillTemplate(template, { group: groupNameOf(node, labels, placeholder), n: memberCount });
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
