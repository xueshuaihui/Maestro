/**
 * Flow graph and node board renderers (beta.2).
 *
 * Geometry comes exclusively from `model.graph` (layout + view state already
 * applied). This module never re-lays-out: it draws the coordinates it is
 * given, so zoom / pan / drag keep a single source of truth.
 */

import { append, badge, button, card, el, emptyBox, pageHead, tag } from './kit.js';
import { workspaceTabs } from './pages.js';

const NS = 'http://www.w3.org/2000/svg';

/** Status colour token -> CSS custom property. */
const COLOR = Object.freeze({
  green: 'var(--green)',
  blue: 'var(--primary)',
  gray: 'var(--muted)',
  red: 'var(--red)',
  amber: 'var(--amber)',
});

/** Status colour token -> ROLE_INSTANCE_STATUS_LABEL_* key. */
const STATUS_KEY = Object.freeze({
  green: 'ROLE_INSTANCE_STATUS_LABEL_AVAILABLE',
  blue: 'ROLE_INSTANCE_STATUS_LABEL_BUSY',
  gray: 'ROLE_INSTANCE_STATUS_LABEL_COOLDOWN',
  red: 'ROLE_INSTANCE_STATUS_LABEL_UNAVAILABLE',
});

const CARD_WIDTH = 168;
const CARD_HEIGHT = 74;

function roleTitles(ctx) {
  const map = new Map();
  for (const node of ctx.state.graph?.nodes ?? []) {
    if (node !== null && typeof node === 'object' && typeof node.id === 'string') {
      map.set(node.id, node);
    }
  }
  return map;
}

function statusText(ctx, visual) {
  const key = STATUS_KEY[visual?.statusColor ?? 'gray'];
  return key ? ctx.t(key) : '';
}

function svgText(x, y, value, attrs = {}) {
  const node = document.createElementNS(NS, 'text');
  node.setAttribute('x', String(x));
  node.setAttribute('y', String(y));
  for (const [key, val] of Object.entries(attrs)) {
    if (val !== null && val !== undefined) node.setAttribute(key, String(val));
  }
  node.textContent = value ?? '';
  return node;
}

/** Shared head actions: view switch, retry when the channel/graph failed, back. */
function instanceHeadActions(ctx) {
  const actions = [];
  if (ctx.view === 'graph') {
    actions.push(button(ctx.t('DESKTOP_VIEW_BOARD'), { size: 'sm', action: 'nav', arg: 'board' }));
  } else {
    actions.push(button(ctx.t('DESKTOP_VIEW_GRAPH'), { size: 'sm', action: 'nav', arg: 'graph' }));
  }
  if (ctx.model?.connection?.canRetry === true) {
    actions.push(button(ctx.t('DESKTOP_V2_RETRY'), { size: 'sm', action: 'retry-connection' }));
  } else if (ctx.model?.notice?.retryable === true) {
    actions.push(button(ctx.t('DESKTOP_V2_RETRY'), { size: 'sm', action: 'retry-graph' }));
  }
  actions.push(button(ctx.t('DESKTOP_V2_BACK'), { size: 'sm', action: 'nav', arg: 'instances' }));
  return actions;
}

/** Flow graph page (instance layer). */
export function flowPage(ctx) {
  const frag = document.createDocumentFragment();
  const graph = ctx.model.graph ?? { nodes: [], edges: [] };
  const headActions = instanceHeadActions(ctx);
  frag.appendChild(pageHead(ctx.instanceTitle ?? ctx.instanceId ?? '', ctx.instanceId ?? null, headActions));
  frag.appendChild(workspaceTabs(ctx));

  const toolbar = el('div', 'sb mb14');
  const zoomOut = button('\u2212', { size: 'sm', action: 'zoom', arg: 'out' });
  const zoomIn = button('+', { size: 'sm', action: 'zoom', arg: 'in' });
  toolbar.appendChild(zoomOut);
  toolbar.appendChild(el('span', 'tiny muted', `${Math.round((graph.zoom ?? 1) * 100)}%`));
  toolbar.appendChild(zoomIn);
  toolbar.appendChild(button(ctx.t('DESKTOP_VIEW_RESET'), { size: 'sm', action: 'reset-view' }));
  if (ctx.state.focus !== null && ctx.state.focus !== undefined) {
    toolbar.appendChild(button(ctx.t('DESKTOP_VIEW_FOCUS_EXIT'), { size: 'sm', action: 'exit-focus' }));
  }
  toolbar.appendChild(el('span', 'spacer'));
  if (graph.legend?.role) toolbar.appendChild(el('span', 'tiny muted', graph.legend.role));
  frag.appendChild(toolbar);

  const wrap = el('div', 'graphwrap');
  wrap.setAttribute('data-graph', '1');
  const nodes = (graph.nodes ?? []).filter((node) => node !== null);
  if (nodes.length === 0) {
    // Never a dead end: the empty graph offers a re-read and a way back.
    const retry = ctx.model?.connection?.canRetry === true || ctx.model?.notice?.retryable === true
      ? button(ctx.t('DESKTOP_V2_RETRY'), {
        variant: 'primary',
        size: 'sm',
        action: ctx.model?.connection?.canRetry === true ? 'retry-connection' : 'retry-graph',
      })
      : null;
    wrap.appendChild(emptyBox(
      '\u25c7',
      ctx.model?.notice?.text ?? ctx.t('DESKTOP_V2_EMPTY'),
      retry,
    ));
    frag.appendChild(wrap);
    return frag;
  }

  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    maxX = Math.max(maxX, Number(node.x) + Number(node.width ?? CARD_WIDTH));
    maxY = Math.max(maxY, Number(node.y) + Number(node.height ?? CARD_HEIGHT));
  }
  const width = Math.max(760, maxX + 80);
  const height = Math.max(300, maxY + 90);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(Math.min(720, Math.max(320, height))));
  svg.classList.add('flow-svg');

  const defs = document.createElementNS(NS, 'defs');
  for (const [id, color] of [['arrow', '#cbd5e1'], ['arrow-red', 'var(--red)'], ['arrow-amber', 'var(--amber)']]) {
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto-start-reverse');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M2 1L8 5L2 9');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '1.5');
    marker.appendChild(path);
    defs.appendChild(marker);
  }
  svg.appendChild(defs);

  const layers = document.createElementNS(NS, 'g');
  layers.setAttribute('class', 'graph-layer');

  for (const edge of graph.edges ?? []) {
    if (typeof edge?.path !== 'string' || edge.path.length === 0) continue;
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', edge.path);
    path.setAttribute('fill', 'none');
    const bad = edge.visual?.abnormal === true || ['rejected', 'expired'].includes(edge.visual?.status);
    const warn = edge.visual?.status === 'pending' || edge.visual?.status === 'accepted';
    path.setAttribute('stroke', bad ? 'var(--red)' : warn ? 'var(--amber)' : '#cbd5e1');
    path.setAttribute('stroke-width', '2');
    if (edge.visual?.dash === true || edge.visual?.direction === 'backflow') path.setAttribute('stroke-dasharray', '5 4');
    path.setAttribute('marker-end', bad ? 'url(#arrow-red)' : warn ? 'url(#arrow-amber)' : 'url(#arrow)');
    path.setAttribute('opacity', String(edge.opacity ?? 1));
    path.setAttribute('data-action', 'open-connection');
    path.setAttribute('data-arg', JSON.stringify({ edgeId: edge.id }));
    layers.appendChild(path);
    if (typeof edge.text === 'string' && edge.text.length > 0 && edge.control !== null) {
      const cx = Number(edge.control?.x);
      const cy = Number(edge.control?.y);
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        layers.appendChild(svgText(cx, cy - 6, edge.text, {
          'font-size': '10', fill: 'var(--muted)', 'text-anchor': 'middle',
        }));
      }
    }
  }

  const titles = roleTitles(ctx);
  for (const node of nodes) {
    const visual = node.visual ?? {};
    const color = COLOR[visual.statusColor ?? visual.color ?? 'gray'] ?? 'var(--muted)';
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', `gnode ${node.abnormal ? 'abnormal' : ''}`.trim());
    group.setAttribute('opacity', String(node.opacity ?? 1));
    group.style.cursor = 'pointer';
    const isRole = (node.type ?? 'role') === 'role';
    group.setAttribute('data-action', isRole ? 'open-drill' : 'open-special');
    group.setAttribute('data-arg', JSON.stringify({ nodeId: node.id, type: node.type ?? 'role' }));

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(node.x));
    rect.setAttribute('y', String(node.y));
    rect.setAttribute('width', String(node.width ?? CARD_WIDTH));
    rect.setAttribute('height', String(node.height ?? CARD_HEIGHT));
    rect.setAttribute('rx', '13');
    const emphasis = node.abnormal === true;
    rect.setAttribute('fill', emphasis ? 'var(--amber-bg)' : '#fff');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', emphasis ? '2.2' : '1.6');
    group.appendChild(rect);

    const source = titles.get(node.id) ?? null;
    const title = typeof source?.title === 'string' && source.title.length > 0 ? source.title : node.id;
    group.appendChild(svgText(Number(node.x) + 14, Number(node.y) + 26, title, { 'font-size': '13', 'font-weight': '600', fill: 'var(--ink)' }));
    if (isRole) {
      group.appendChild(svgText(Number(node.x) + 14, Number(node.y) + 45, statusText(ctx, visual), { 'font-size': '11', fill: 'var(--muted)' }));
      const sessions = Number(source?.sessions ?? visual.sessionStack ?? 0);
      if (Number.isFinite(sessions) && sessions > 0) {
        group.appendChild(svgText(Number(node.x) + 14, Number(node.y) + 62, `${ctx.t('DESKTOP_V2_SESSIONS')} ${sessions}`, { 'font-size': '10', fill: 'var(--faint)' }));
      }
    } else {
      const shape = visual.shape === 'shield' ? '\u25a1' : visual.shape === 'alert' ? '!' : '\u2317';
      group.appendChild(svgText(Number(node.x) + 14, Number(node.y) + 45, `${shape} ${node.id}`, { 'font-size': '11', fill: 'var(--muted)' }));
    }
    if (visual.badge === 'escalated') {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', String(Number(node.x) + Number(node.width ?? CARD_WIDTH) - 16));
      circle.setAttribute('cy', String(Number(node.y) + 16));
      circle.setAttribute('r', '9');
      circle.setAttribute('fill', 'var(--red)');
      group.appendChild(circle);
      group.appendChild(svgText(Number(node.x) + Number(node.width ?? CARD_WIDTH) - 16, Number(node.y) + 20, '!', { 'font-size': '11', 'text-anchor': 'middle', fill: '#fff' }));
    }
    layers.appendChild(group);
  }

  svg.appendChild(layers);
  wrap.appendChild(svg);
  frag.appendChild(wrap);

  const strip = el('div', 'row mt14 wrap');
  strip.appendChild(tag(ctx.t('DESKTOP_VIEW_GRAPH')));
  strip.appendChild(tag(ctx.t('DESKTOP_V2_CARDS')));
  strip.appendChild(el('span', 'tiny muted', graph.legend?.special ?? ''));
  frag.appendChild(strip);
  return frag;
}

/** Node board page (seven columns). */
export function boardPage(ctx) {
  const frag = document.createDocumentFragment();
  const board = ctx.model.board ?? { columns: [] };
  const headActions = instanceHeadActions(ctx);
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_BOARD'), ctx.instanceId ?? null, headActions));
  frag.appendChild(workspaceTabs(ctx));

  // The board model is `{columns: [key...], columnNames: [name...], cards}`
  // where every card carries its own `column`. Reading `column.title` off a
  // string key produced seven empty headings with a literal `0` count each.
  const keys = Array.isArray(board.columns) ? board.columns : [];
  if (keys.length === 0) {
    frag.appendChild(emptyBox('\u25a4', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  const names = Array.isArray(board.columnNames) ? board.columnNames : [];
  const cards = Array.isArray(board.cards) ? board.cards : [];
  const wrap = el('div', 'board-scroll');
  const grid = el('div', 'board');
  keys.forEach((key, index) => {
    const name = typeof names[index] === 'string' && names[index].length > 0 ? names[index] : String(key);
    const columnCards = cards.filter((card) => card?.column === key);
    const col = el('div', 'board-col');
    const head = el('h4');
    head.appendChild(el('span', null, name));
    head.appendChild(el('span', null, String(columnCards.length)));
    col.appendChild(head);
    for (const item of columnCards) {
      const mini = el('div', 'mini-card');
      mini.setAttribute('data-action', 'open-node');
      mini.setAttribute('data-arg', JSON.stringify({ nodeId: item.id }));
      mini.appendChild(el('div', 'id', item.id ?? ''));
      mini.appendChild(el('div', 'mt6', item.title ?? ''));
      if (item.unknown === true && board.unknownTag) {
        mini.appendChild(el('div', 'tiny muted mt6', board.unknownTag));
      }
      col.appendChild(mini);
    }
    grid.appendChild(col);
  });
  wrap.appendChild(grid);
  frag.appendChild(wrap);
  if (board.cancelledFold) frag.appendChild(el('div', 'tiny muted mt10', board.cancelledFold));
  return frag;
}

export { append, badge, card };
