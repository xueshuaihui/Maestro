/**
 * Shell chrome: sidebar, top bar, drawer, toast and command palette (beta.2).
 *
 * The chrome is created once per host and reused across paints, so a drawer or
 * the palette keeps focus while live frames repaint the content area. Every
 * visible string is read from the label table through `ctx.t`; this module
 * authors no wording.
 */

import { append, badge, button, clear, el, iconButton, text } from './kit.js';

const SHELLS = new WeakMap();

const NAV_GROUPS = Object.freeze([
  [
    { view: 'projects', key: 'DESKTOP_V2_SETTINGS_PROJECT', glyph: '\u25a6' },
    { view: 'instances', key: null, glyph: '\u25c8' },
    { view: 'queue', key: 'DESKTOP_VIEW_QUEUE', glyph: '\u2637', count: 'queue' },
    { view: 'notifications', key: 'DESKTOP_NOTIFY_TOGGLE', glyph: '\u2662', count: 'notify' },
  ],
  [
    { view: 'assets', key: 'DESKTOP_VIEW_ASSETS', glyph: '\u25a4' },
    { view: 'occupancy', key: 'DESKTOP_VIEW_OCCUPANCY', glyph: '\u25cd' },
    { view: 'canvas', key: 'DESKTOP_VIEW_CANVAS', glyph: '\u2317' },
  ],
  [
    { view: 'governance', key: 'DESKTOP_V2_NAV_AUDIT', glyph: '\u26e8' },
    { view: 'settings', key: 'DESKTOP_V2_NAV_SETTINGS', glyph: '\u2699' },
  ],
]);

function buildSkeleton(host) {
  const root = el('div', 'app-shell');
  const sidebar = el('aside', 'sidebar');
  const main = el('main', 'main');
  const topbar = el('header', 'topbar');
  const content = el('div', 'content');
  append(main, topbar, content);
  append(root, sidebar, main);

  const mask = el('div', 'mask');
  const drawer = el('div', 'drawer');
  const toast = el('div', 'toast');
  const palette = el('div', 'palette');
  const paletteBox = el('div', 'palette-box');
  const paletteInput = document.createElement('input');
  paletteInput.className = 'palette-input';
  paletteInput.type = 'text';
  const paletteList = el('div', 'palette-list');
  append(paletteBox, paletteInput, paletteList);
  palette.appendChild(paletteBox);

  append(host, root, mask, drawer, toast, palette);
  const refs = { root, sidebar, main, topbar, content, mask, drawer, toast, palette, paletteInput, paletteList };
  SHELLS.set(host, refs);
  return refs;
}

/** Get (or lazily create) the persistent chrome of one host. */
export function shellRefs(host) {
  return SHELLS.get(host) ?? buildSkeleton(host);
}

/**
 * Sidebar. `ctx` supplies `t`, the active view and the two counters
 * (`queueCount`, `notifyCount`); counters at zero render no badge.
 */
export function paintSidebar(refs, ctx) {
  const box = clear(refs.sidebar);
  const brand = el('button', 'brand');
  brand.type = 'button';
  brand.setAttribute('data-action', 'nav');
  brand.setAttribute('data-arg', 'instances');
  const mark = document.createElement('img');
  mark.className = 'brand-mark';
  mark.src = './brand/mark.svg';
  mark.alt = '';
  append(brand, mark, el('span', 'brand-name', 'Maestro'));
  box.appendChild(brand);

  for (const group of NAV_GROUPS) {
    box.appendChild(el('div', 'nav-sep'));
    for (const item of group) {
      const node = el('button', 'nav-item');
      node.type = 'button';
      node.setAttribute('data-action', 'nav');
      node.setAttribute('data-arg', item.view);
      node.appendChild(el('span', 'ico', item.glyph));
      const label = item.key === null ? (ctx.instancesLabel ?? 'Maestro') : ctx.t(item.key);
      node.appendChild(el('span', 'nav-text', label));
      const active = ctx.view === item.view
        || (item.view === 'instances' && ['graph', 'board', 'drill', 'node-detail', 'escalation-panel', 'connection-panel', 'subflow', 'evidence'].includes(ctx.view))
        || (item.view === 'projects' && ctx.view === 'project');
      if (active) {
        node.classList.add('on');
        node.setAttribute('aria-current', 'page');
      }
      const count = item.count === 'queue' ? ctx.queueCount : item.count === 'notify' ? ctx.notifyCount : 0;
      if (count > 0) node.appendChild(el('span', 'badge-n', String(count)));
      box.appendChild(node);
    }
  }

  const foot = el('div', 'sidebar-foot');
  if (ctx.projectRoot) {
    foot.appendChild(el('div', 't', ctx.t('DESKTOP_V2_SETTINGS_PROJECT')));
    const path = el('div', 'p', ctx.projectRoot);
    path.title = ctx.projectRoot;
    foot.appendChild(path);
  }
  if (ctx.statusText) {
    const conn = el('div', `c ${ctx.statusTone ?? ''}`.trim());
    conn.appendChild(el('span', 'dot-sm'));
    conn.appendChild(el('span', null, ctx.statusText));
    foot.appendChild(conn);
  }
  box.appendChild(foot);
}

/** Top bar: breadcrumb, search, notification dot, avatar. */
export function paintTopbar(refs, ctx) {
  const box = clear(refs.topbar);
  const crumb = el('div', 'crumb');
  for (const segment of ctx.crumbs) {
    if (segment.bold) crumb.appendChild(el('b', null, segment.text));
    else crumb.appendChild(el('span', null, segment.text));
    crumb.appendChild(el('span', 'sep', '/'));
  }
  if (crumb.lastChild) crumb.removeChild(crumb.lastChild);
  box.appendChild(crumb);
  box.appendChild(el('div', 'spacer'));

  const search = el('button', 'searchbox');
  search.type = 'button';
  search.setAttribute('data-action', 'palette');
  search.appendChild(el('span', null, '\u2315'));
  search.appendChild(el('span', null, ctx.t('DESKTOP_V2_SEARCH')));
  search.appendChild(el('span', 'kbd', '\u2318K'));
  box.appendChild(search);

  box.appendChild(iconButton('\u2662', { action: 'nav', arg: 'notifications', title: ctx.t('DESKTOP_NOTIFY_TOGGLE'), dot: ctx.notifyCount > 0 }));
  box.appendChild(el('div', 'avatar', 'M'));
}

/** Show one transient line; repeated calls restart the timer. */
export function showToast(refs, message) {
  if (typeof message !== 'string' || message.length === 0) return;
  refs.toast.textContent = message;
  refs.toast.classList.add('on');
  clearTimeout(refs.toastTimer);
  refs.toastTimer = setTimeout(() => refs.toast.classList.remove('on'), 2600);
}

/**
 * Drawer. `spec` = `{ title, subtitle, badges, body, footer, onClose }`.
 * The body is a Node; the footer is an array of Nodes.
 */
export function openDrawer(refs, spec) {
  const box = clear(refs.drawer);
  const head = el('div', 'drawer-head');
  const left = el('div', 'drawer-title');
  const row = el('div', 'row');
  row.appendChild(el('b', null, spec.title ?? ''));
  for (const item of spec.badges ?? []) row.appendChild(item);
  left.appendChild(row);
  if (spec.subtitle) left.appendChild(el('div', 'tiny muted mt6', spec.subtitle));
  append(head, left, iconButton('\u2715', { action: 'close-drawer', title: spec.closeLabel ?? '' }));
  box.appendChild(head);

  const body = el('div', 'drawer-body');
  if (spec.body) body.appendChild(spec.body);
  box.appendChild(body);

  if (Array.isArray(spec.footer) && spec.footer.length > 0) {
    const foot = el('div', 'drawer-foot');
    for (const node of spec.footer) foot.appendChild(node);
    box.appendChild(foot);
  }
  box.classList.add('open');
  refs.mask.classList.add('on');
  refs.drawerSpec = spec;
}

/** Close the drawer and drop the previous spec. */
export function closeDrawer(refs) {
  refs.drawer.classList.remove('open');
  refs.mask.classList.remove('on');
  refs.drawerSpec = null;
}

/** True when the drawer is visible. */
export function drawerOpen(refs) {
  return refs.drawer.classList.contains('open');
}

/**
 * Command palette. `entries` is `[{ section, label, action, arg }]`;
 * `onPick(action, arg)` is called on click or Enter.
 */
export function openPalette(refs, ctx, entries, onPick) {
  refs.palette.classList.add('on');
  refs.paletteInput.value = '';
  refs.paletteInput.placeholder = ctx.t('DESKTOP_V2_CMD_HINT');
  refs.paletteInput.focus();
  const render = (query) => {
    const needle = String(query ?? '').toLowerCase();
    const hits = entries.filter((entry) => needle.length === 0 || String(entry.label).toLowerCase().includes(needle));
    const list = clear(refs.paletteList);
    if (hits.length === 0) {
      list.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_V2_NO_MATCH')));
      return [];
    }
    const nodes = [];
    for (const entry of hits) {
      const node = el('button', 'palette-item');
      node.type = 'button';
      node.appendChild(el('span', 'tag', entry.section));
      node.appendChild(el('span', null, entry.label));
      node.addEventListener('click', () => {
        closePalette(refs);
        onPick(entry.action, entry.arg);
      });
      list.appendChild(node);
      nodes.push(node);
    }
    return nodes;
  };
  refs.paletteSelect = 0;
  refs.paletteRender = render;
  refs.palettePick = (index) => {
    const needle = refs.paletteInput.value;
    const needleLower = String(needle ?? '').toLowerCase();
    const hits = entries.filter((entry) => needleLower.length === 0 || String(entry.label).toLowerCase().includes(needleLower));
    const target = hits[index];
    if (!target) return false;
    closePalette(refs);
    onPick(target.action, target.arg);
    return true;
  };
  render('');
  refs.paletteInput.oninput = () => {
    refs.paletteSelect = 0;
    render(refs.paletteInput.value);
  };
  refs.paletteInput.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      refs.palettePick(refs.paletteSelect ?? 0);
    }
  };
}

export function closePalette(refs) {
  refs.palette.classList.remove('on');
}

export function paletteOpen(refs) {
  return refs.palette.classList.contains('on');
}

/** Breadcrumb segments for the active view. */
export function crumbsFor(ctx) {
  const parts = [];
  if (ctx.view === 'project') {
    parts.push({ text: ctx.t('DESKTOP_V2_SETTINGS_PROJECT'), bold: true });
    return parts;
  }
  if (['instances'].includes(ctx.view)) {
    parts.push({ text: ctx.instancesLabel ?? 'Maestro', bold: true });
    return parts;
  }
  if (['graph', 'board', 'drill', 'node-detail', 'escalation-panel', 'connection-panel', 'subflow', 'evidence'].includes(ctx.view)) {
    parts.push({ text: ctx.instancesLabel ?? 'Maestro' });
    parts.push({ text: ctx.instanceId ?? '', bold: !ctx.detailLabel });
    if (ctx.detailLabel) parts.push({ text: ctx.detailLabel, bold: true });
    return parts;
  }
  const nav = {
    projects: 'DESKTOP_V2_SETTINGS_PROJECT',
    queue: 'DESKTOP_VIEW_QUEUE',
    assets: 'DESKTOP_VIEW_ASSETS',
    occupancy: 'DESKTOP_VIEW_OCCUPANCY',
    canvas: 'DESKTOP_VIEW_CANVAS',
    governance: 'DESKTOP_V2_NAV_AUDIT',
    settings: 'DESKTOP_V2_NAV_SETTINGS',
    notifications: 'DESKTOP_NOTIFY_TOGGLE',
    new: 'DESKTOP_NEW_TITLE',
  }[ctx.view];
  parts.push({ text: nav ? ctx.t(nav) : 'Maestro', bold: true });
  return parts;
}

/** Mask / drawer close wiring helper used by the app click handler. */
export function isMaskClick(refs, target) {
  return target === refs.mask;
}

export { badge, button, text };
