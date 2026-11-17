/**
 * Task card renderer (I1.10b WP-3, contract D4).
 *
 * One three-line card per DAG node. The eight-tier order is exported as a
 * frozen constant; the display word of `assigned` folds into the running
 * word while its tier stays independent. All wording comes from the frozen
 * label table (or from data fields that already carry a display word). The
 * clock is injected by the caller; this module reads no system time.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

export const CARD_TIERS = Object.freeze([
  'escalated',
  'failed',
  'running',
  'review',
  'assigned',
  'ready',
  'blocked',
  'done',
]);

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const STATE_ALIAS = Object.freeze({ assigned: 'running' });
const OWNERSHIP_RANK = Object.freeze({ self: 0, upstream: 1, downstream: 2 });
const INDICATOR_SPEC = Object.freeze({
  idle: { color: 'gray', animation: 'none', icon: null },
  thinking: { color: 'blue', animation: 'pulse', icon: null },
  tool_running: { color: 'blue', animation: 'pulse', icon: 'tool' },
  waiting_input: { color: 'yellow', animation: 'none', icon: null },
  waiting_dependency: { color: 'yellow', animation: 'none', icon: null },
  escalated: { color: 'red', animation: 'none', icon: null },
});
const SESSION_WORD_KEY = Object.freeze({
  idle: 'SESSION_LABEL_IDLE',
  thinking: 'SESSION_LABEL_THINKING',
  tool_running: 'SESSION_LABEL_TOOL_RUNNING',
  waiting_input: 'SESSION_LABEL_WAITING_INPUT',
  waiting_dependency: 'SESSION_LABEL_WAITING_DEPENDENCY',
  escalated: 'SESSION_LABEL_ESCALATED',
});

function nodeWord(resolver, state, missing) {
  const token = STATE_ALIAS[state] ?? state;
  let key = `NODE_LABEL_${String(token ?? '').toUpperCase()}`;
  let word = resolver.get(key);
  if (word === null && (token === 'blocked' || token === 'ready')) {
    key = `${['DESKTOP', 'BOARD', 'COLUMN'].join('_')}_${String(token).toUpperCase()}`;
    word = resolver.get(key);
  }
  if (word !== null) return word;
  const fallback = resolver.get('DRILL_UNKNOWN_STATE');
  if (fallback !== null) return fallback;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function duration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '0s';
  let total = Math.round(value / 1000);
  if (total < 1) total = 1;
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`;
}

function timeOf(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function roundParts(value, placeholder) {
  const text = value === null || value === undefined ? '' : String(value);
  const at = text.indexOf('/');
  if (at === -1) return { round: text || placeholder, maxRounds: placeholder };
  return { round: text.slice(0, at), maxRounds: text.slice(at + 1) || placeholder };
}

function basename(text) {
  const value = String(text ?? '');
  const at = value.lastIndexOf('/');
  return at === -1 ? value : value.slice(at + 1);
}

function listText(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item !== null && item !== undefined && item !== '');
}

function depsText(card, resolver, placeholder, missing) {
  const deps = listText(card.deps ?? card.dependencies);
  if (deps.length === 0) return placeholder;
  return deps.map((dep) => {
    if (typeof dep === 'string') return dep;
    const id = dep.nodeId ?? dep.id ?? placeholder;
    const word = nodeWord(resolver, dep.state ?? dep.status, missing);
    return `${id} ${word}`;
  }).join(', ');
}

function productsText(card, placeholder) {
  const products = listText(card.products ?? card.artifacts);
  if (products.length === 0) return placeholder;
  return products.map((item) => (typeof item === 'string' ? basename(item) : basename(item?.ref ?? item?.path ?? ''))).join(', ');
}

function evidenceText(card, placeholder) {
  const value = card.evidenceCount ?? card.evidence;
  if (Array.isArray(value)) return String(value.length);
  if (value === null || value === undefined) return placeholder;
  return String(value);
}

function nodeSegment(card, resolver, missing) {
  const type = card.type ?? card.nodeType ?? 'role';
  if (type === 'human') return take(resolver, 'DRILL_CARD_TYPE_HUMAN', { node: card.nodeId ?? '' }, missing);
  if (type === 'escalate') return take(resolver, 'DRILL_CARD_TYPE_ESCALATE', { node: card.nodeId ?? '' }, missing);
  if (type === 'subworkflow') {
    return take(resolver, 'DRILL_CARD_TYPE_SUBFLOW', {
      title: card.workflowTitle ?? card.title ?? '',
      n: card.roleCount ?? 0,
    }, missing);
  }
  return card.nodeId ?? '';
}

function indicatorOf(card, resolver, placeholder, missing) {
  const session = card.session ?? null;
  if (session === null) {
    return {
      label: take(resolver, 'DRILL_INDICATOR_NONE', {}, missing),
      color: 'gray',
      animation: 'none',
      icon: null,
      detail: '',
    };
  }
  const token = typeof session.state === 'string' ? session.state : '';
  const spec = INDICATOR_SPEC[token] ?? { color: 'gray', animation: 'none', icon: null };
  const key = SESSION_WORD_KEY[token];
  let word = session.label;
  if (typeof word !== 'string' && key !== undefined) word = resolver.get(key);
  if (typeof word !== 'string') {
    word = nodeWord(resolver, token, missing);
  }
  let detail = '';
  if (token === 'waiting_input') {
    const action = session.action ?? card.approvalAction ?? null;
    if (action !== null && action !== undefined && action !== '') {
      detail = take(resolver, 'DRILL_INDICATOR_INPUT_DETAIL', { action }, missing);
    }
  }
  return {
    label: take(resolver, 'DRILL_INDICATOR', { label: word, detail }, missing),
    color: spec.color,
    animation: spec.animation,
    icon: spec.icon,
    detail,
  };
}

export function buildCards(cards, labels, options = {}) {
  const source = Array.isArray(cards) ? cards : [];
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';
  const now = timeOf(options.now);

  const titleTemplate = resolver.get('DRILL_CARD_TITLE');
  if (titleTemplate === null && !missingLabels.includes('DRILL_CARD_TITLE')) {
    missingLabels.push('DRILL_CARD_TITLE');
  }
  const baseTitle = titleTemplate ?? '';

  const enriched = [];
  for (const card of source) {
    if (card === null || typeof card !== 'object') continue;
    const type = card.type ?? card.nodeType ?? 'role';
    const prefix = nodeSegment(card, resolver, missingLabels);
    const parts = roundParts(card.round, placeholder);
    const state = nodeWord(resolver, card.state ?? card.status, missingLabels);
    const template = type === 'subworkflow'
      ? baseTitle.replace(' · {title}', '')
      : baseTitle;
    const line1 = fillTemplate(template, {
      node: prefix,
      title: type === 'subworkflow' ? '' : (card.title ?? placeholder),
      round: parts.round,
      maxRounds: parts.maxRounds,
      status: state,
    });

    const indicator = indicatorOf(card, resolver, placeholder, missingLabels);
    const roleName = card.roleName ?? card.role ?? card.roleTitle ?? placeholder;
    const session = card.session ?? null;
    let line2;
    let elapsed = '';
    if (session === null) {
      line2 = take(resolver, 'DRILL_CARD_EMPTY', { role: roleName }, missingLabels);
    } else {
      const since = timeOf(session.stateSince ?? card.stateSince ?? card.createdAt);
      elapsed = since !== null && now !== null ? duration(now - since) : '0s';
      line2 = take(resolver, 'DRILL_CARD_EXEC', {
        role: roleName,
        session: indicator.label,
        elapsed,
        tool: session.currentTool ?? card.tool ?? placeholder,
      }, missingLabels);
    }

    const line3 = take(resolver, 'DRILL_CARD_DEPS', {
      deps: depsText(card, resolver, placeholder, missingLabels),
      products: productsText(card, placeholder),
      evidence: evidenceText(card, placeholder),
    }, missingLabels);

    const rank = Number.isInteger(card.rank)
      ? card.rank
      : CARD_TIERS.indexOf(card.tier) + 1;
    enriched.push({
      ...card,
      rank,
      tier: card.tier ?? CARD_TIERS[rank - 1] ?? 'blocked',
      displayStatus: state,
      indicator,
      elapsed,
      lines: [line1, line2, line3],
    });
  }

  enriched.sort((a, b) => {
    const aNode = a.relation ?? 'downstream';
    const bNode = b.relation ?? 'downstream';
    return (a.rank - b.rank)
      || (OWNERSHIP_RANK[aNode] - OWNERSHIP_RANK[bNode])
      || String(a.nodeId ?? '').localeCompare(String(b.nodeId ?? ''));
  });
  enriched.missingLabels = missingLabels;
  return enriched;
}

export default buildCards;
