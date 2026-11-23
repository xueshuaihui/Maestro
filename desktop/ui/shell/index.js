/**
 * Shell entry: one paint pass over the persistent chrome plus the active page.
 *
 * `renderShell(host, ctx)` is the only renderer contract the assembly uses.
 * It never fetches, never mutates app state and never authors wording: it
 * arranges the projections passed in `ctx` and binds `data-action` hooks that
 * the assembly resolves.
 */

import {
  closeDrawer, closePalette, crumbsFor, drawerOpen, openDrawer, paintSidebar, paintTopbar,
  paletteOpen, shellRefs, showToast,
} from './chrome.js';
import {
  assetsPage, canvasPage, evidencePage, fallbackPage, governancePage, instancesPage,
  newPage, notificationsPage, occupancyPage, overviewPage, projectPage, queuePage,
  settingsPage, studioPage,
} from './pages.js';
import { boardPage, flowPage } from './graph.js';
import {
  connectionPage, drillPage, escalationPage, nodeDetailBody, nodeDetailPage, subflowPage,
} from './drill.js';
import { append, badge, button, clear, el, emptyBox } from './kit.js';

const PAGE_BY_VIEW = Object.freeze({
  project: projectPage,
  instances: instancesPage,
  new: newPage,
  overview: overviewPage,
  graph: flowPage,
  board: boardPage,
  drill: drillPage,
  'node-detail': nodeDetailPage,
  'escalation-panel': escalationPage,
  'connection-panel': connectionPage,
  subflow: subflowPage,
  queue: queuePage,
  assets: assetsPage,
  occupancy: occupancyPage,
  canvas: canvasPage,
  evidence: evidencePage,
  governance: governancePage,
  settings: settingsPage,
  studio: studioPage,
  notifications: notificationsPage,
});

/** Render one pass. Returns the refs so the caller can wire the palette. */
export function renderShell(host, ctx) {
  const refs = shellRefs(host);
  const previousScroll = refs.content.scrollTop;
  const previousKey = refs.content.dataset.key ?? '';

  paintSidebar(refs, ctx);
  paintTopbar(refs, ctx);

  clear(refs.content);
  const key = `${ctx.view}:${ctx.instanceId ?? ''}:${ctx.detailKey ?? ''}`;
  let page = null;
  try {
    const render = PAGE_BY_VIEW[ctx.view] ?? fallbackPage;
    page = render(ctx);
  } catch (error) {
    const box = el('div');
    box.appendChild(el('div', 'notice', ctx.degradedText ?? ''));
    box.appendChild(emptyBox('\u25c7', ctx.t('DESKTOP_V2_EMPTY')));
    page = box;
  }
  refs.content.appendChild(page);
  refs.content.dataset.key = key;
  // Keep the reading position only when the same page is repainted by a live
  // frame; a navigation starts at the top.
  refs.content.scrollTop = key === previousKey ? previousScroll : 0;

  syncDrawer(refs, ctx);
  return refs;
}

/** Open / close / refresh the right-hand drawer from `ctx.drawer`. */
export function syncDrawer(refs, ctx) {
  const spec = ctx.drawer ?? null;
  if (spec === null) {
    if (drawerOpen(refs)) closeDrawer(refs);
    return;
  }
  const signature = `${spec.kind}:${spec.id ?? ''}`;
  if (drawerOpen(refs) && refs.drawerSignature === signature) return;

  let body = null;
  let footer = [];
  if (spec.kind === 'node') {
    body = nodeDetailBody(ctx);
    footer = [button(ctx.t('DRILL_HOST_OPEN'), { variant: 'primary', action: 'jump-host' })];
  } else if (spec.kind === 'connection') {
    body = connectionPage(ctx);
    footer = [button(ctx.t('DESKTOP_V2_CLOSE'), { action: 'close-drawer' })];
  } else if (spec.kind === 'escalation') {
    body = escalationPage(ctx);
  } else {
    body = emptyBox('\u25c7', ctx.t('DESKTOP_V2_EMPTY'));
  }
  openDrawer(refs, {
    title: spec.title ?? '',
    subtitle: spec.subtitle ?? '',
    badges: spec.badges ?? [],
    body,
    footer,
    closeLabel: ctx.t('DESKTOP_V2_CLOSE'),
  });
  refs.drawerSignature = signature;
}

/** Reset the cached drawer signature (called on close). */
export function forgetDrawer(refs) {
  refs.drawerSignature = null;
  closeDrawer(refs);
}

export { closePalette, crumbsFor, paletteOpen, shellRefs, showToast, badge, append };
