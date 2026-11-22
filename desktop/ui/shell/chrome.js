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
    { view: 'project', key: 'DESKTOP_V2_SETTINGS_PROJECT', glyph: '\u25a6' },
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
 * Build the sidebar once per host. Every later paint updates these nodes in
 * place: replacing them on a live frame would drop a click whose press and
 * release straddle the repaint (the browser only fires `click` when both ends
 * resolve to the same node), which is exactly the "nav sometimes does nothing"
 * symptom.
 */
function buildSidebar(refs) {
  const box = clear(refs.sidebar);
  const brand = el('button', 'brand');
  brand.type = 'button';
  brand.setAttribute('data-action', 'nav');
  brand.setAttribute('data-arg', 'instances');
  const mark = document.createElement('img');
  mark.className = 'brand-mark';
  mark.src = './brand/mark.svg';
  mark.alt = '';
  const brandLabel = el('span', 'brand-name', 'Maestro');
  append(brand, mark, brandLabel);
  box.appendChild(brand);

  const items = [];
  for (const group of NAV_GROUPS) {
    box.appendChild(el('div', 'nav-sep'));
    for (const item of group) {
      const node = el('button', 'nav-item');
      node.type = 'button';
      node.setAttribute('data-action', 'nav');
      node.setAttribute('data-arg', item.view);
      node.appendChild(el('span', 'ico', item.glyph));
      const label = el('span', 'nav-text');
      node.appendChild(label);
      box.appendChild(node);
      items.push({
        view: item.view,
        key: item.key,
        counter: item.count ?? null,
        node,
        label,
        badge: null,
      });
    }
  }

  const foot = el('div', 'sidebar-foot');
  const projectBox = el('div');
  const projectTitle = el('div', 't');
  const projectPath = el('div', 'p');
  append(projectBox, projectTitle, projectPath);
  const status = el('div', 'c');
  const statusText = el('span');
  append(status, el('span', 'dot-sm'), statusText);
  append(foot, projectBox, status);
  box.appendChild(foot);

  const ui = { brand, brandLabel, items, foot, projectBox, projectTitle, projectPath, status, statusText };
  refs.sidebarUi = ui;
  return ui;
}

/**
 * Sidebar. `ctx` supplies `t`, the active view and the two counters
 * (`queueCount`, `notifyCount`); counters at zero render no badge.
 */
export function paintSidebar(refs, ctx) {
  const ui = refs.sidebarUi ?? buildSidebar(refs);

  // The brand is the product name, not a projection: it never changes with the
  // active project or the label table.
  if (ui.brandLabel.textContent !== 'Maestro') ui.brandLabel.textContent = 'Maestro';

  for (const item of ui.items) {
    const label = item.key === null ? (ctx.instancesLabel ?? 'Maestro') : ctx.t(item.key);
    if (item.label.textContent !== label) item.label.textContent = label;

    const active = ctx.view === item.view
      || (item.view === 'instances' && ['graph', 'board', 'drill', 'node-detail', 'escalation-panel', 'connection-panel', 'subflow', 'evidence'].includes(ctx.view));
    item.node.classList.toggle('on', active);
    if (active) item.node.setAttribute('aria-current', 'page');
    else item.node.removeAttribute('aria-current');

    const raw = item.counter === 'queue' ? ctx.queueCount
      : item.counter === 'notify' ? ctx.notifyCount
        : 0;
    const count = Number.isFinite(raw) ? raw : 0;
    if (count > 0) {
      if (item.badge === null) {
        item.badge = el('span', 'badge-n');
        item.node.appendChild(item.badge);
      }
      const value = String(count);
      if (item.badge.textContent !== value) item.badge.textContent = value;
    } else if (item.badge !== null) {
      item.node.removeChild(item.badge);
      item.badge = null;
    }
  }

  // `hidden` alone loses to the module's own `display` rules, so the empty
  // project card and the status line are hidden through `style`.
  ui.projectBox.style.display = ctx.projectRoot ? '' : 'none';
  if (ctx.projectRoot) {
    const title = ctx.t('DESKTOP_V2_SETTINGS_PROJECT');
    if (ui.projectTitle.textContent !== title) ui.projectTitle.textContent = title;
    if (ui.projectPath.textContent !== ctx.projectRoot) {
      ui.projectPath.textContent = ctx.projectRoot;
      ui.projectPath.title = ctx.projectRoot;
    }
  }

  ui.status.style.display = ctx.statusText ? '' : 'none';
  if (ctx.statusText) {
    const tone = typeof ctx.statusTone === 'string' ? ctx.statusTone : '';
    ui.status.className = tone.length > 0 ? `c ${tone}` : 'c';
    if (ui.statusText.textContent !== ctx.statusText) ui.statusText.textContent = ctx.statusText;
  }
}

/**
 * Build the top bar once per host. The search and notification buttons keep
 * their identity across paints for the same reason as the sidebar: a live
 * frame must never swap out the node under the pointer.
 */
function buildTopbar(refs, ctx) {
  const box = clear(refs.topbar);
  const crumb = el('div', 'crumb');
  box.appendChild(crumb);
  box.appendChild(el('div', 'spacer'));

  const search = el('button', 'searchbox');
  search.type = 'button';
  search.setAttribute('data-action', 'palette');
  search.appendChild(el('span', null, '\u2315'));
  const searchLabel = el('span');
  search.appendChild(searchLabel);
  search.appendChild(el('span', 'kbd', '\u2318K'));
  box.appendChild(search);

  const notify = iconButton('\u2662', { action: 'nav', arg: 'notifications', title: ctx.t('DESKTOP_NOTIFY_TOGGLE') });
  box.appendChild(notify);
  box.appendChild(el('div', 'avatar', 'M'));

  const ui = { crumb, search, searchLabel, notify, notifyDot: null };
  refs.topbarUi = ui;
  return ui;
}

/** Top bar: breadcrumb, search, notification dot, avatar. */
export function paintTopbar(refs, ctx) {
  const ui = refs.topbarUi ?? buildTopbar(refs, ctx);

  clear(ui.crumb);
  for (const segment of ctx.crumbs) {
    if (segment.bold) ui.crumb.appendChild(el('b', null, segment.text));
    else ui.crumb.appendChild(el('span', null, segment.text));
    ui.crumb.appendChild(el('span', 'sep', '/'));
  }
  if (ui.crumb.lastChild) ui.crumb.removeChild(ui.crumb.lastChild);

  const searchText = ctx.t('DESKTOP_V2_SEARCH');
  if (ui.searchLabel.textContent !== searchText) ui.searchLabel.textContent = searchText;

  const notifyTitle = ctx.t('DESKTOP_NOTIFY_TOGGLE');
  if (ui.notify.title !== notifyTitle) {
    ui.notify.title = notifyTitle;
    ui.notify.setAttribute('aria-label', notifyTitle);
  }
  const dot = ctx.notifyCount > 0;
  if (dot && ui.notifyDot === null) {
    ui.notifyDot = el('i', 'dot');
    ui.notify.appendChild(ui.notifyDot);
  } else if (!dot && ui.notifyDot !== null) {
    ui.notify.removeChild(ui.notifyDot);
    ui.notifyDot = null;
  }
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
