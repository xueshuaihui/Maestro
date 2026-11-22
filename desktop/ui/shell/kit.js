/**
 * Shell kit: DOM helpers and presentational primitives (beta.2).
 *
 * Zero CJK: every visible string is either a caller-supplied label (from
 * `/ui/labels`) or a caller-supplied projection text. This module authors no
 * wording, no state and no data access.
 */

/** Create an element with an optional class and text child. */
export function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (typeof cls === 'string' && cls.length > 0) node.className = cls;
  if (typeof text === 'string' && text.length > 0) node.textContent = text;
  return node;
}

/** Create an SVG element inside the SVG namespace. */
export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
  }
  return node;
}

/** Append children in order, skipping null / undefined. */
export function append(parent, ...children) {
  for (const child of children) {
    if (child === null || child === undefined) continue;
    parent.appendChild(child);
  }
  return parent;
}

/** Replace all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Text node helper. */
export function text(value) {
  return document.createTextNode(typeof value === 'string' ? value : '');
}

const TONES = new Set(['run', 'wait', 'done', 'fail', 'cyan', 'gray']);

/**
 * Status badge. `tone` is one of run / wait / done / fail / cyan / gray;
 * an unknown tone degrades to gray so a projection typo never renders an
 * unstyled pill.
 */
export function badge(label, tone = 'gray', pulse = false) {
  const span = el('span', `badge ${TONES.has(tone) ? tone : 'gray'}`);
  if (pulse) span.appendChild(el('i', 'pulse'));
  span.appendChild(text(label ?? ''));
  return span;
}

/** Tag: a neutral, non-status chip (ids, types, counts). */
export function tag(label, mono = false) {
  return el('span', mono ? 'tag mono' : 'tag', label ?? '');
}

/** Round button. `variant` is primary / ghost / coral / plain. */
export function button(label, { variant = 'ghost', action = null, arg = null, size = '', disabled = false, title = null } = {}) {
  const node = el('button', `btn ${variant}${size === 'sm' ? ' sm' : ''}`.trim(), label ?? '');
  node.type = 'button';
  if (action) node.setAttribute('data-action', action);
  if (arg !== null && arg !== undefined) node.setAttribute('data-arg', typeof arg === 'string' ? arg : JSON.stringify(arg));
  if (title) node.title = title;
  if (disabled) node.disabled = true;
  return node;
}

/** Square icon button carrying one ASCII glyph. */
export function iconButton(glyph, { action = null, arg = null, title = null, dot = false } = {}) {
  const node = el('button', 'iconbtn', glyph);
  node.type = 'button';
  if (action) node.setAttribute('data-action', action);
  if (arg !== null && arg !== undefined) node.setAttribute('data-arg', typeof arg === 'string' ? arg : JSON.stringify(arg));
  if (title) {
    node.title = title;
    node.setAttribute('aria-label', title);
  }
  if (dot) node.appendChild(el('i', 'dot'));
  return node;
}

/** Page heading: title, optional description, optional right-hand actions. */
export function pageHead(title, description, actions = []) {
  const head = el('div', 'page-head');
  const left = el('div');
  left.appendChild(el('h1', null, title ?? ''));
  if (description) left.appendChild(el('p', null, description));
  head.appendChild(left);
  head.appendChild(el('div', 'spacer'));
  for (const action of actions) head.appendChild(action);
  return head;
}

/** Plain card container. */
export function card(children = [], { flat = false, hover = false, className = '' } = {}) {
  const node = el('div', `card${flat ? ' flat' : ''}${hover ? ' hover' : ''}${className ? ` ${className}` : ''}`);
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

/** Metric tile. */
export function metric(label, value, { tone = null, sub = null } = {}) {
  const node = el('div', 'metric');
  node.appendChild(el('div', 'l', label ?? ''));
  const v = el('div', 'v', value ?? '');
  if (tone) v.style.color = `var(--${tone})`;
  node.appendChild(v);
  if (sub) node.appendChild(el('div', 's', sub));
  return node;
}

/** Section title line with optional right-hand element. */
export function sectionTitle(label, right = null) {
  const row = el('div', 'between');
  row.appendChild(el('h3', 'section-title', label ?? ''));
  if (right) row.appendChild(right);
  return row;
}

/** Divider line. */
export function divider() {
  return el('div', 'divider');
}

/** Horizontal progress bar. */
export function progress(pct, small = false) {
  const wrap = el('div', small ? 'progress sm' : 'progress');
  const fill = el('i');
  const value = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  fill.style.width = `${value}%`;
  wrap.appendChild(fill);
  return wrap;
}

/** Empty state block: glyph, text, optional action button. */
export function emptyBox(glyph, label, action = null) {
  const box = el('div', 'empty');
  box.appendChild(el('div', 'ico', glyph ?? '\u25c7'));
  box.appendChild(el('div', null, label ?? ''));
  if (action) box.appendChild(action);
  return box;
}

/**
 * Simple table. `headers` is an array of strings; `rows` is an array of
 * arrays of (string | Node). A null cell renders an em dash placeholder that
 * the caller supplies.
 */
export function table(headers, rows, { onRow = null, rowAttr = null } = {}) {
  const box = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const header of headers) headRow.appendChild(el('th', null, header ?? ''));
  thead.appendChild(headRow);
  box.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const cells of rows) {
    const tr = document.createElement('tr');
    if (onRow) {
      tr.style.cursor = 'pointer';
      if (rowAttr) tr.setAttribute(rowAttr.name, rowAttr.value(cells));
    }
    for (const cell of cells) {
      const td = document.createElement('td');
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = cell === null || cell === undefined ? '' : String(cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  box.appendChild(tbody);
  return box;
}

/**
 * Timeline. `items` entries: `{ title, detail, tone, extra }` where tone is
 * '' / done / wait / fail.
 */
export function timeline(items) {
  const list = el('div', 'timeline');
  for (const item of items) {
    const row = el('div', `tl-item ${item.tone ?? ''}`.trim());
    row.appendChild(el('b', 'small', item.title ?? ''));
    if (item.detail) row.appendChild(el('div', 'tiny muted', item.detail));
    if (item.extra) row.appendChild(item.extra);
    list.appendChild(row);
  }
  return list;
}

/** Key/value line pair. */
export function kv(key, value) {
  const row = el('div', 'between mt6');
  row.appendChild(el('span', 'mini muted', key ?? ''));
  const v = el('span', 'small', value ?? '');
  row.appendChild(v);
  return row;
}

/** Monospace log block; `text` is rendered verbatim. */
export function logBlock(value, { maxHeight = null } = {}) {
  const pre = el('pre', 'log');
  pre.textContent = value ?? '';
  if (maxHeight) pre.style.maxHeight = maxHeight;
  return pre;
}

/** Inline field line used by panels and drawers. */
export function fieldLine(label, value) {
  const wrap = el('div', 'field');
  wrap.appendChild(el('div', 'tiny muted', label ?? ''));
  wrap.appendChild(el('div', 'small', value ?? ''));
  return wrap;
}

/** Callout box (used for queue hints and degradation notices). */
export function callout(label, { tone = 'primary' } = {}) {
  const node = el('div', 'callout');
  node.style.borderColor = `var(--${tone}-2, var(--line))`;
  node.style.background = `var(--${tone}-bg, var(--surface-2))`;
  node.appendChild(el('div', 'small', label ?? ''));
  return node;
}
