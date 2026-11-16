/**
 * Drill view assembly entry (I1.10b WP-3, contract D15).
 *
 * Aggregates the pure drill modules into one description object consumed by
 * the host. It never performs transport work and never starts a process; the
 * interaction callbacks only change the returned view's own state. Everything
 * is derived from the frozen projections supplied in `data`.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

import { buildCards } from './cards.js';
import { buildDag } from './dag.js';
import { buildEscalationPanel } from './escalation-panel.js';
import { buildHandoffPanel } from './handoff-panel.js';
import { buildHostJump } from './host-jump.js';
import { buildNodeDetail } from './node-detail.js';
import { renderRoleBar } from './role-bar.js';
import { buildSubflow } from './subflow.js';

function labelOf(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

export function createDrillView({ labels, data, interactions } = {}) {
  const resolver = resolveLabels(labels);
  const payload = data !== null && typeof data === 'object' ? data : {};
  const actions = interactions !== null && typeof interactions === 'object' ? interactions : {};
  const clock = typeof actions.clock === 'function' ? actions.clock : () => 0;
  const missingLabels = [];

  const breadcrumbInput = payload.breadcrumb ?? {};
  let breadcrumb = '';
  if (typeof breadcrumbInput.key === 'string' && breadcrumbInput.key.length > 0) {
    const template = resolver.get(breadcrumbInput.key);
    if (template === null) {
      if (!missingLabels.includes(breadcrumbInput.key)) missingLabels.push(breadcrumbInput.key);
    } else {
      breadcrumb = fillTemplate(template, {
        id: breadcrumbInput.instanceId ?? '',
        role: breadcrumbInput.roleTitle ?? breadcrumbInput.roleId ?? '',
      });
    }
  }

  const barInput = payload.roleBar ?? {};
  const roleBar = renderRoleBar({
    ...barInput,
    roleTitle: breadcrumbInput.roleTitle ?? barInput.roleTitle ?? null,
  }, labels);

  const dagInput = payload.dag ?? {};
  const dag = buildDag(dagInput, labels, { boldRoleNodeIds: actions.boldRoleNodeIds });
  const cards = buildCards(payload.cards, labels, { now: payload.now ?? actions.now });
  const detail = payload.detail ? buildNodeDetail(payload.detail, labels) : null;
  const connection = payload.connection
    ? buildHandoffPanel(payload.connection, labels, {
      expandedId: actions.expandedId ?? payload.connection.expandedId ?? null,
      anchorRowTop: actions.anchorRowTop,
      clock,
    })
    : null;
  const escalations = payload.escalations
    ? buildEscalationPanel(payload.escalations, labels)
    : null;
  const hostJump = payload.hostJump
    ? buildHostJump(payload.hostJump, labels, { clock })
    : null;
  const subflow = payload.subflow
    ? buildSubflow(payload.subflow, labels, { levels: actions.levels })
    : null;

  for (const part of [roleBar, dag, cards, detail, connection, escalations, hostJump, subflow]) {
    if (part && Array.isArray(part.missingLabels)) {
      for (const key of part.missingLabels) {
        if (!missingLabels.includes(key)) missingLabels.push(key);
      }
    }
  }

  const view = {
    breadcrumb,
    roleBar,
    dag,
    cards,
    detail,
    connection,
    escalations,
    hostJump,
    subflow,
    scrollTarget: null,
    highlight: null,
    lastElapsed: 0,
    missingLabels,
    clickNode(nodeId) {
      const started = clock();
      view.scrollTarget = nodeId;
      view.highlight = nodeId;
      view.lastElapsed = clock() - started;
      return view;
    },
    clickCard(nodeId) {
      return view.clickNode(nodeId);
    },
    scrollToEnd() {
      if (view.connection !== null && typeof view.connection.scrollToEnd === 'function') {
        view.connection.scrollToEnd();
      }
      return view;
    },
    back() {
      if (view.subflow !== null && typeof view.subflow.back === 'function') {
        view.subflow = view.subflow.back();
      }
      return view;
    },
    viewControl(key) {
      return labelOf(resolver, key, {}, missingLabels);
    },
  };
  return view;
}

export default createDrillView;
