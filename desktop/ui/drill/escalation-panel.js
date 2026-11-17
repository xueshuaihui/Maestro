/**
 * Instance-scoped escalation panel (I1.10b WP-3, contract D7).
 *
 * The pending list is instance-scoped by construction: the caller passes one
 * snapshot's projection and this module never looks at other snapshots. The
 * only write action surfaced here is "continue"; the cancel entry is a view
 * action. Result lines are selected by the message key carried in a transport
 * response, never by a raw transport code.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const STATE_WORD_KEY = Object.freeze({
  pending: 'ESCALATION_LABEL_PENDING',
  resolved: 'ESCALATION_LABEL_RESOLVED',
  voided: 'ESCALATION_LABEL_VOIDED',
});

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function stateWord(resolver, state, dataWord, missing) {
  if (typeof dataWord === 'string' && dataWord.length > 0) return dataWord;
  const key = STATE_WORD_KEY[state] ?? null;
  if (key !== null) {
    const word = resolver.get(key);
    if (word !== null) return word;
    if (!missing.includes(key)) missing.push(key);
  }
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

function rowOf(item, resolver, placeholder, missing) {
  const round = Number.isInteger(item.round) ? item.round : placeholder;
  return {
    escalationId: item.escalationId ?? null,
    state: item.state ?? null,
    nodeId: item.nodeId ?? null,
    round: item.round ?? null,
    line: take(resolver, 'DRILL_ESC_ROW', {
      id: item.escalationId ?? placeholder,
      state: stateWord(resolver, item.state, item.stateLabel, missing),
      node: item.nodeId ?? placeholder,
      role: item.roleLabel ?? item.roleId ?? placeholder,
      round,
    }, missing),
    reasonLine: take(resolver, 'DRILL_ESC_REASON', {
      reason: item.reasonDetail ?? placeholder,
    }, missing),
    defectLines: (Array.isArray(item.defects) ? item.defects : []).map((defect) =>
      take(resolver, 'DRILL_ESC_DEFECT', {
        summary: defect?.summary ?? placeholder,
        evidence: defect?.evidence ?? placeholder,
      }, missing)),
  };
}

export function buildEscalationPanel(list, labels) {
  const source = list !== null && typeof list === 'object' ? list : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';
  const pending = Array.isArray(source.items) ? source.items : [];
  const closedItems = Array.isArray(source.resolved) ? source.resolved : [];

  const title = take(resolver, 'DRILL_ESC_TITLE', {}, missingLabels);
  const countLine = take(resolver, 'DRILL_ESC_COUNT', { n: pending.length }, missingLabels);
  const items = pending
    .filter((item) => item !== null && typeof item === 'object')
    .map((item) => rowOf(item, resolver, placeholder, missingLabels));
  const resolved = closedItems
    .filter((item) => item !== null && typeof item === 'object')
    .map((item) => rowOf(item, resolver, placeholder, missingLabels));

  const continueDisabled = items.length === 0;
  const actions = [
    resolver.get('DRILL_ESC_CONTINUE') ?? '',
    resolver.get('DRILL_ESC_CANCEL') ?? '',
  ];
  for (const key of ['DRILL_ESC_CONTINUE', 'DRILL_ESC_CANCEL']) {
    if (resolver.get(key) === null && !missingLabels.includes(key)) missingLabels.push(key);
  }

  const messageKeys = Object.freeze({
    done: 'DRILL_ESC_DONE',
    already: 'DRILL_ESC_ALREADY',
    notSuspended: 'DRILL_ESC_NOT_SUSPENDED',
    failed: 'DRILL_ESC_FAILED',
  });

  return {
    title,
    countLine,
    items,
    resolved,
    actions,
    continueDisabled,
    messageKeys,
    messageFor(kind, params = {}) {
      const key = messageKeys[kind] ?? messageKeys.failed;
      return take(resolver, key, params, missingLabels);
    },
    missingLabels,
  };
}

export default buildEscalationPanel;
