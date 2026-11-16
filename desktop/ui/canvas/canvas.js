/**
 * Definition-time workflow canvas view model (I1.11 WP-8; requirement A-7,
 * AC-29 / AC-31 / AC-42 / AC-45).
 *
 * Contract:
 * - Consumes the read-only `buildCanvas` projection
 *   `{ title, readable, valid, nodes, edges, problems? }`. Every visible word
 *   comes from the label table through `fillTemplate` / `resolveLabels`; this
 *   module owns no wording and does no layout (D-36 / D-23).
 * - Title line (A-7): `DESKTOP_CANVAS_TITLE` filled with the projection's own
 *   `title`, node count and edge count. The invalid badge (`DESKTOP_CANVAS_INVALID`)
 *   is a separate line shown only when `valid === false`; the projection owns
 *   the validity decision.
 * - Degradation branch (D-17 / D-23): `readable && nodes.length === 0` is the
 *   empty definition (`DESKTOP_CANVAS_EMPTY`); `!readable && nodes.length === 0`
 *   is the unreadable definition (`DESKTOP_CANVAS_UNREADABLE`, with the daemon
 *   reason line carried through); `!readable && nodes.length > 0` is the partial
 *   case — draw the readable nodes and do NOT show any unreadable banner;
 *   `readable && nodes.length > 0` is the normal case.
 * - Node rows reuse the same shape keys as the instance flow graph
 *   (`DESKTOP_HUMAN_ROW` / `DESKTOP_ESCALATE_ROW` / `DESKTOP_SUBFLOW_ROW` /
 *   `DESKTOP_SUBFLOW_UNKNOWN`); the projection's pre-rendered `label` is the
 *   authority and is passed through verbatim when present (D-36).
 * - Edge rows carry `kind: 'backflow'` unchanged; `graphEdges` maps that onto
 *   the `direction` field the layout module reads, assigning stable ids so the
 *   caller can reuse `graph/layout.js` `computeLayout` without a second layout.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals and zero calculation of counts / coordinates.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

const TITLE_KEY = 'DESKTOP_CANVAS_TITLE';
const INVALID_KEY = 'DESKTOP_CANVAS_INVALID';
const EMPTY_KEY = 'DESKTOP_CANVAS_EMPTY';
const UNREADABLE_KEY = 'DESKTOP_CANVAS_UNREADABLE';
const DIRECTION_FORWARD_KEY = 'DESKTOP_EDGE_DIRECTION_FORWARD';
const DIRECTION_BACKFLOW_KEY = 'DESKTOP_EDGE_DIRECTION_BACKFLOW';

/** Node type -> row template key (same keys the instance graph uses, A-7). */
const NODE_ROW_KEY = Object.freeze({
  human: 'DESKTOP_HUMAN_ROW',
  escalate: 'DESKTOP_ESCALATE_ROW',
  subworkflow: 'DESKTOP_SUBFLOW_ROW',
});

function tableOf(labels) {
  return resolveLabels(labels).keys;
}

function word(labels, key) {
  const value = tableOf(labels)[key];
  return typeof value === 'string' ? value : null;
}

function countOf(nodes) {
  return Array.isArray(nodes) ? nodes.length : 0;
}

function isPlain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Title line of the canvas (A-7). Counts come straight from the projection.
 *
 * @param {object} projection the frozen buildCanvas projection (read-only)
 * @param {unknown} labels
 * @returns {string|null}
 */
export function titleText(projection, labels) {
  const template = word(labels, TITLE_KEY);
  if (template === null) return null;
  const nodes = isPlain(projection) && Array.isArray(projection.nodes) ? projection.nodes : [];
  const edges = isPlain(projection) && Array.isArray(projection.edges) ? projection.edges : [];
  const title = isPlain(projection) && typeof projection.title === 'string' ? projection.title : '';
  return fillTemplate(template, { name: title, n: countOf(nodes), m: countOf(edges) });
}

/**
 * Validation badge line (A-7): present only when `valid === false`.
 *
 * @returns {string|null}
 */
export function validationBadge(projection, labels) {
  if (!isPlain(projection) || projection.valid !== false) return null;
  return word(labels, INVALID_KEY);
}

/**
 * Degradation branch of the projection (D-17 / D-23).
 *
 * @returns {'empty'|'unreadable'|'partial'|'ok'}
 */
export function degradeOf(projection) {
  if (!isPlain(projection)) return 'empty';
  const readable = projection.readable === true;
  const n = countOf(projection.nodes);
  if (readable && n === 0) return 'empty';
  if (!readable && n === 0) return 'unreadable';
  if (!readable && n > 0) return 'partial';
  return 'ok';
}

/**
 * Degradation text to show (A-7). The partial branch shows nothing: the
 * readable nodes are drawn and no unreadable banner appears. The unreadable
 * branch shows the fixed label plus the daemon reason lines (verbatim).
 *
 * @returns {{ key: string, text: string|null, reasons: string[] }}
 */
export function degradeText(projection, labels) {
  const branch = degradeOf(projection);
  if (branch === 'empty') return { key: EMPTY_KEY, text: word(labels, EMPTY_KEY), reasons: [] };
  if (branch === 'unreadable') {
    const reasons = isPlain(projection) && Array.isArray(projection.problems)
      ? projection.problems.filter((line) => typeof line === 'string')
      : [];
    return { key: UNREADABLE_KEY, text: word(labels, UNREADABLE_KEY), reasons };
  }
  return { key: '', text: null, reasons: [] };
}

/**
 * One canvas node row. The projection's pre-rendered `label` (filled by the
 * daemon from the same label source) wins; when absent, the row is generated
 * from the A-7 shape keys using the definition fields.
 *
 * @returns {{ id: string|null, nodeType: string, text: string|null }}
 */
export function nodeRow(node, labels) {
  if (!isPlain(node)) return { id: null, nodeType: 'role', text: null };
  const id = typeof node.id === 'string' ? node.id : null;
  const nodeType = typeof node.nodeType === 'string' ? node.nodeType : 'role';
  if (typeof node.label === 'string' && node.label.length > 0) {
    return { id, nodeType, text: node.label };
  }
  const templateKey = NODE_ROW_KEY[nodeType];
  if (templateKey === undefined) return { id, nodeType, text: null };
  const template = word(labels, templateKey);
  if (template === null) return { id, nodeType, text: null };
  if (nodeType === 'subworkflow') {
    const unknown = word(labels, 'DESKTOP_SUBFLOW_UNKNOWN');
    const n = Number.isInteger(node.memberCount) ? node.memberCount : null;
    const text = n === null
      ? (unknown === null ? null : fillTemplate(unknown, { id: id ?? '' }))
      : fillTemplate(template, { title: typeof node.title === 'string' ? node.title : (id ?? ''), n });
    return { id, nodeType, text };
  }
  const status = typeof node.status === 'string' ? node.status : '';
  const title = typeof node.title === 'string' ? node.title : (id ?? '');
  return { id, nodeType, text: fillTemplate(template, { title, status }) };
}

/**
 * One canvas edge row. `kind === 'backflow'` maps to the backflow direction
 * word; every other kind maps to forward. No aggregate status is rendered on
 * the definition canvas (A-7).
 *
 * @returns {{ from: string, to: string, kind: string, direction: string,
 *             text: string|null }}
 */
export function edgeRow(edge, labels) {
  const from = isPlain(edge) && typeof edge.from === 'string' ? edge.from : '';
  const to = isPlain(edge) && typeof edge.to === 'string' ? edge.to : '';
  const kind = isPlain(edge) && edge.kind === 'backflow' ? 'backflow' : 'forward';
  const direction = kind;
  const key = kind === 'backflow' ? DIRECTION_BACKFLOW_KEY : DIRECTION_FORWARD_KEY;
  return { from, to, kind, direction, text: word(labels, key) };
}

/**
 * Edges shaped for `graph/layout.js` `computeLayout` (D-4): stable ids plus a
 * `direction` field; backflow edges stay arcs. Layout itself is the caller's
 * job — this is pure shape mapping, never coordinate math.
 *
 * @returns {Array<{ id: string, from: string, to: string, direction: string }>}
 */
export function graphEdges(projection) {
  const edges = isPlain(projection) && Array.isArray(projection.edges) ? projection.edges : [];
  return edges.map((edge, index) => ({
    id: isPlain(edge) && typeof edge.id === 'string' ? edge.id : `E-${index + 1}`,
    from: isPlain(edge) && typeof edge.from === 'string' ? edge.from : '',
    to: isPlain(edge) && typeof edge.to === 'string' ? edge.to : '',
    direction: isPlain(edge) && edge.kind === 'backflow' ? 'backflow' : 'forward',
  }));
}
