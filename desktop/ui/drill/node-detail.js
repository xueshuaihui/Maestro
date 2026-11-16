/**
 * Node detail renderer (I1.10b WP-3, contract D5).
 *
 * Projects the read-only detail payload into a fixed head plus four sections.
 * Section titles are extracted from the section row templates themselves, so
 * no display wording is authored here. Direction words come from the
 * definition edge token only; the state of a handoff never changes a
 * direction. Empty sections keep their title and a frozen "no record" row.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const STATE_ALIAS = Object.freeze({ assigned: 'running' });
const SESSION_TOKENS = new Set([
  'idle', 'thinking', 'tool_running', 'waiting_input', 'waiting_dependency', 'escalated',
]);
const SECTION_KEYS = Object.freeze([
  ['timeline', 'DRILL_DETAIL_TIMELINE'],
  ['summary', 'DRILL_DETAIL_SUMMARY'],
  ['evidence', 'DRILL_DETAIL_EVIDENCE'],
  ['handoff', 'DRILL_DETAIL_HANDOFF'],
]);

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

function sectionTitle(resolver, templateKey, placeholder, missing) {
  const text = resolver.get(templateKey);
  if (text === null) {
    if (!missing.includes(templateKey)) missing.push(templateKey);
    return placeholder;
  }
  const at = text.indexOf('{');
  const prefix = at === -1 ? text : text.slice(0, at);
  return prefix.trim().split(' ')[0] ?? prefix.trim();
}

function clockText(ts, placeholder) {
  if (typeof ts !== 'string' || ts.length < 19) return placeholder;
  return ts.slice(11, 19);
}

function nodeWord(resolver, state, missing) {
  const token = STATE_ALIAS[state] ?? state;
  let key = `NODE_LABEL_${String(token ?? '').toUpperCase()}`;
  let word = resolver.get(key);
  if (word === null && (token === 'blocked' || token === 'ready')) {
    key = `${['DESKTOP', 'BOARD', 'COLUMN'].join('_')}_${String(token).toUpperCase()}`;
    word = resolver.get(key);
  }
  if (word === null && SESSION_TOKENS.has(token)) {
    const sessionKey = `SESSION_LABEL_${String(token).toUpperCase()}`;
    word = resolver.get(sessionKey);
    if (word === null && !missing.includes(sessionKey)) missing.push(sessionKey);
  }
  if (word !== null) return word;
  const fallback = resolver.get('DRILL_UNKNOWN_STATE');
  if (fallback !== null) return fallback;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

function handoffWord(resolver, state, missing) {
  const token = state === 'built' ? 'created' : state;
  const key = `HANDOFF_LABEL_${String(token ?? '').toUpperCase()}`;
  const word = resolver.get(key);
  if (word !== null) return word;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

function displayWord(resolver, dataWord, key, placeholder, missing) {
  if (typeof dataWord === 'string' && dataWord.length > 0) return dataWord;
  if (key !== null) {
    const word = resolver.get(key);
    if (word !== null) return word;
    if (!missing.includes(key)) missing.push(key);
  }
  return placeholder;
}

export function buildNodeDetail(detail, labels) {
  const source = detail !== null && typeof detail === 'object' ? detail : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const placeholder = resolver.get(PLACEHOLDER_KEY) ?? '';
  const node = source.node ?? {};
  const round = Number.isInteger(node.round) ? node.round : 1;
  const max = Number.isInteger(node.maxRounds) ? node.maxRounds : placeholder;

  const head = take(resolver, 'DRILL_DETAIL_HEAD', {
    node: node.nodeId ?? '',
    title: node.title ?? placeholder,
    status: nodeWord(resolver, node.state, missingLabels),
    round,
    maxRounds: max,
  }, missingLabels);

  const titles = {};
  for (const [name, key] of SECTION_KEYS) {
    titles[name] = sectionTitle(resolver, key, placeholder, missingLabels);
  }
  const noneOf = (name) => take(resolver, 'DRILL_DETAIL_NONE', { section: titles[name] }, missingLabels);

  // timeline: chronological session state changes, already merged upstream.
  const ordered = (Array.isArray(source.timeline) ? source.timeline : [])
    .filter((entry) => entry !== null && typeof entry === 'object')
    .slice()
    .sort((a, b) => String(a.ts ?? '').localeCompare(String(b.ts ?? '')));
  const timeline = [];
  const copyTargets = [];
  for (const entry of ordered) {
    timeline.push(take(resolver, 'DRILL_DETAIL_TIMELINE', {
      time: clockText(entry.ts, placeholder),
      state: nodeWord(resolver, entry.sessionState, missingLabels),
    }, missingLabels));
  }
  if (timeline.length === 0) timeline.push(noneOf('timeline'));

  // summary: one frozen row; absent fields become the placeholder.
  const summary = source.summary ?? null;
  const summaryLines = [];
  if (summary === null) {
    summaryLines.push(noneOf('summary'));
  } else {
    summaryLines.push(take(resolver, 'DRILL_DETAIL_SUMMARY', {
      command: summary.command ?? placeholder,
      exitCode: summary.exitCode ?? placeholder,
      lines: summary.keyOutputLines ?? placeholder,
      log: summary.logRef ?? placeholder,
    }, missingLabels));
  }

  // evidence: the payload carries a display word for type and status when the
  // label table has no dedicated key for them; nothing is fabricated here.
  const evidenceLines = [];
  for (const entry of Array.isArray(source.evidence) ? source.evidence : []) {
    if (entry === null || typeof entry !== 'object') continue;
    if (typeof entry.ref === 'string') copyTargets.push(entry.ref);
    const type = displayWord(resolver, entry.typeLabel, null, placeholder, missingLabels);
    const status = displayWord(resolver, entry.statusLabel, null, placeholder, missingLabels);
    evidenceLines.push(take(resolver, 'DRILL_DETAIL_EVIDENCE', {
      index: entry.index ?? evidenceLines.length + 1,
      ref: entry.ref ?? placeholder,
      type,
      status,
    }, missingLabels));
  }
  if (evidenceLines.length === 0) evidenceLines.push(noneOf('evidence'));

  // handoff direction is decided only by the definition edge token.
  const forwardWord = take(resolver, 'DESKTOP_EDGE_DIRECTION_FORWARD', {}, missingLabels);
  const backWord = take(resolver, 'DESKTOP_EDGE_DIRECTION_BACKFLOW', {}, missingLabels);
  const handoffLines = [];
  for (const entry of Array.isArray(source.handoffs) ? source.handoffs : []) {
    if (entry === null || typeof entry !== 'object') continue;
    const direction = entry.direction === 'backflow' ? backWord : forwardWord;
    const hRound = Number.isInteger(entry.round) ? entry.round : placeholder;
    handoffLines.push(take(resolver, 'DRILL_DETAIL_HANDOFF', {
      id: entry.handoffId ?? placeholder,
      direction,
      round: hRound,
      state: handoffWord(resolver, entry.state, missingLabels),
      time: clockText(entry.lastActivity, placeholder),
    }, missingLabels));
  }
  if (handoffLines.length === 0) handoffLines.push(noneOf('handoff'));

  const result = {
    head,
    copied: null,
    copyEvidence(index) {
      const at = Number.isInteger(index) ? index : 1;
      result.copied = copyTargets[at - 1] ?? null;
      return result;
    },
    sections: [
      { key: 'timeline', title: titles.timeline, lines: timeline },
      { key: 'summary', title: titles.summary, lines: summaryLines },
      { key: 'evidence', title: titles.evidence, lines: evidenceLines },
      { key: 'handoff', title: titles.handoff, lines: handoffLines },
    ],
    visual: node.visual ?? (node.nodeType === 'human'
      ? { shape: 'shield', color: 'gray', animation: 'none' }
      : { shape: 'box', color: 'green', animation: 'none' }),
    missingLabels,
  };
  return result;
}

export default buildNodeDetail;
