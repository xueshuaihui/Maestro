/**
 * Local one-hop DAG renderer (I1.10b WP-3, contract D3).
 *
 * The projection handed in already contains the one-hop node/edge set, so this
 * module only projects it into display rows. It never walks the graph, never
 * fetches data and never mutates its input. Layout stability is a property of
 * the deterministic projection order: the same input always yields byte-equal
 * output.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';
const FULL_COLON = String.fromCharCode(0xFF1A);
const STATE_ALIAS = Object.freeze({ assigned: 'running' });
const RELATION_KEY = Object.freeze({
  self: 'DRILL_DAG_REL_SELF',
  upstream: 'DRILL_DAG_REL_UP',
  downstream: 'DRILL_DAG_REL_DOWN',
});
const STATE_COLOR = Object.freeze({
  pending: 'gray',
  running: 'blue',
  review: 'yellow',
  done: 'green',
  failed: 'red',
  cancelled: 'gray',
  escalated: 'red',
  assigned: 'blue',
});

function nodeWord(resolver, state, missing) {
  const token = STATE_ALIAS[state] ?? state;
  let key = `NODE_LABEL_${String(token ?? '').toUpperCase()}`;
  let word = resolver.get(key);
  if (word === null && (token === 'blocked' || token === 'ready')) {
    key = `${['DESKTOP', 'BOARD', 'COLUMN'].join('_')}_${String(token).toUpperCase()}`;
    word = resolver.get(key);
  }
  if (word === null) {
    const handoffKey = `HANDOFF_LABEL_${String(token ?? '').toUpperCase()}`;
    word = resolver.get(handoffKey);
    if (word === null && !missing.includes(handoffKey)) missing.push(handoffKey);
  }
  if (word !== null) return word;
  const fallback = resolver.get('DRILL_UNKNOWN_STATE');
  if (fallback !== null) return fallback;
  if (!missing.includes(key)) missing.push(key);
  return resolver.get(PLACEHOLDER_KEY) ?? '';
}

function templateWord(resolver, key, marker, missing) {
  const text = resolver.get(key);
  if (text === null) {
    if (!missing.includes(key)) missing.push(key);
    return resolver.get(PLACEHOLDER_KEY) ?? '';
  }
  if (marker === undefined) return text;
  const at = text.indexOf(marker);
  return at === -1 ? text : text.slice(0, at);
}

function typeWord(resolver, type, missing) {
  if (type === 'human') return templateWord(resolver, 'DRILL_CARD_TYPE_HUMAN', ' {node}', missing);
  if (type === 'escalate') return templateWord(resolver, 'DRILL_CARD_TYPE_ESCALATE', ' {node}', missing);
  if (type === 'subworkflow') return templateWord(resolver, 'DRILL_CARD_TYPE_SUBFLOW', FULL_COLON, missing);
  const sub = resolver.get('DRILL_CARD_TYPE_SUBFLOW');
  if (sub !== null) {
    const start = sub.indexOf(' · ');
    const end = sub.indexOf(' {n}', start === -1 ? 0 : start);
    if (start !== -1 && end !== -1) return sub.slice(start + 3, end);
  }
  return templateWord(resolver, 'DRILL_CARD_TYPE_SUBFLOW', FULL_COLON, missing);
}

function take(resolver, key, params, missing) {
  const text = resolver.text(key, params);
  if (text === null && !missing.includes(key)) missing.push(key);
  return text ?? '';
}

export function buildDag(dag, labels, options = {}) {
  const source = dag !== null && typeof dag === 'object' ? dag : {};
  const resolver = resolveLabels(labels);
  const missingLabels = [];
  const boldInput = options.boldRoleNodeIds;
  const boldSet = boldInput instanceof Set
    ? boldInput
    : new Set(Array.isArray(boldInput) ? boldInput : []);

  const nodes = [];
  const lines = [];
  for (const item of Array.isArray(source.nodes) ? source.nodes : []) {
    if (item === null || typeof item !== 'object') continue;
    const relation = Object.prototype.hasOwnProperty.call(RELATION_KEY, item.relation)
      ? item.relation
      : 'downstream';
    const status = nodeWord(resolver, item.status, missingLabels);
    const relationWord = take(resolver, RELATION_KEY[relation], {}, missingLabels);
    const kindWord = typeWord(resolver, item.type, missingLabels);
    nodes.push({
      nodeId: item.nodeId ?? null,
      relation,
      type: item.type ?? 'role',
      status,
      statusColor: STATE_COLOR[STATE_ALIAS[item.status] ?? item.status] ?? 'gray',
      bold: boldSet.size > 0 ? boldSet.has(item.nodeId) : relation === 'self',
      title: item.title ?? null,
      roleId: item.roleId ?? null,
    });
    lines.push(take(resolver, 'DRILL_DAG_NODE', {
      node: item.nodeId ?? '',
      relation: relationWord,
      type: kindWord,
      status,
    }, missingLabels));
  }

  const edges = [];
  for (const item of Array.isArray(source.edges) ? source.edges : []) {
    if (item === null || typeof item !== 'object') continue;
    const back = item.direction === 'backflow';
    const directionKey = back ? 'DESKTOP_EDGE_DIRECTION_BACKFLOW' : 'DESKTOP_EDGE_DIRECTION_FORWARD';
    const direction = take(resolver, directionKey, {}, missingLabels);
    const status = nodeWord(resolver, item.aggregateStatus ?? item.status, missingLabels);
    edges.push({
      id: item.id ?? null,
      from: item.from ?? null,
      to: item.to ?? null,
      direction: item.direction ?? 'forward',
      style: back ? 'dashed' : 'solid',
      aggregateStatus: item.aggregateStatus ?? null,
    });
    lines.push(take(resolver, 'DRILL_DAG_EDGE', {
      from: item.from ?? '',
      to: item.to ?? '',
      direction,
      status,
    }, missingLabels));
  }

  return {
    nodes,
    edges,
    lines,
    bounds: source.bounds ?? { width: 240, height: 80 },
    dangling: source.dangling ?? 0,
    missingLabels,
  };
}

export default buildDag;
