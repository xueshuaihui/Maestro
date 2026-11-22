/**
 * Drill layer renderers (beta.2): role drill, node detail, escalation panel,
 * handoff panel and sub-workflow.
 *
 * All content comes from the frozen `createDrillView` description
 * (`model.drill`), whose parts already carry label-resolved lines. This module
 * arranges those lines into the drawer / page layout and binds actions; it
 * never re-derives states, rounds or wording.
 */

import {
  append, badge, button, card, divider, el, emptyBox, fieldLine, logBlock,
  pageHead, sectionTitle, tag, timeline,
} from './kit.js';

const STATUS_TONE = Object.freeze({ green: 'done', blue: 'run', gray: 'gray', red: 'fail', amber: 'wait' });

function actionButton(label, action, arg, variant = 'ghost') {
  return button(label ?? '', { variant, size: 'sm', action, arg });
}

function backButton(ctx, fallback = 'graph') {
  return button(ctx.t('DESKTOP_V2_BACK'), { size: 'sm', action: 'drill-back', arg: fallback });
}

/** Local DAG: three relation lanes (upstream / self / downstream). */
function dagBlock(ctx, dag) {
  const box = card([]);
  box.appendChild(el('div', 'tiny muted mb10', ctx.t('DESKTOP_V2_LOCAL_DAG')));
  const nodes = Array.isArray(dag?.nodes) ? dag.nodes : [];
  if (nodes.length === 0) {
    box.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_V2_EMPTY')));
    return box;
  }
  const lanes = [['upstream', '\u2191'], ['self', '\u25cf'], ['downstream', '\u2193']];
  for (const [relation, glyph] of lanes) {
    const lane = nodes.filter((node) => (node.relation ?? 'downstream') === relation);
    if (lane.length === 0) continue;
    for (const node of lane) {
      const row = el('button', node.bold ? 'dag-node on' : 'dag-node');
      row.type = 'button';
      row.setAttribute('data-action', 'dag-node');
      row.setAttribute('data-arg', JSON.stringify({ nodeId: node.nodeId }));
      row.appendChild(el('span', 'dag-glyph', glyph));
      const body = el('span', 'grow');
      body.appendChild(el('span', 'small', node.title || node.nodeId || ''));
      body.appendChild(el('span', 'tiny muted ml6', node.status ?? ''));
      row.appendChild(body);
      row.style.borderLeft = `3px solid var(--${node.statusColor === 'green' ? 'green' : node.statusColor === 'blue' ? 'primary' : node.statusColor === 'red' ? 'red' : 'muted'})`;
      box.appendChild(row);
    }
  }
  const edges = Array.isArray(dag?.edges) ? dag.edges : [];
  if (edges.length > 0) {
    box.appendChild(divider());
    box.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_V2_TIMELINE')));
    for (const edge of edges) {
      box.appendChild(el('div', 'tiny muted mt6', `${edge.from ?? ''} \u2192 ${edge.to ?? ''}${edge.direction === 'backflow' ? ' \u21b4' : ''}`));
    }
  }
  return box;
}

/** Role drill page. */
export function drillPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.drill ?? {};
  const bar = view.roleBar ?? {};
  frag.appendChild(pageHead(
    ctx.t('DESKTOP_V2_ROLE_BAR'),
    view.breadcrumb || ctx.instanceId || null,
    [backButton(ctx, 'graph')],
  ));

  const barCard = card([], { className: 'role-bar-card' });
  const head = el('div', 'between');
  const left = el('div', 'row');
  left.appendChild(el('b', null, bar.roleTitle ?? ctx.state.drill?.roleId ?? ''));
  if (bar.status) left.appendChild(badge(bar.status, 'wait'));
  for (const host of bar.hostIcons ?? []) left.appendChild(tag(String(host)));
  head.appendChild(left);
  const right = el('div', 'row');
  right.appendChild(el('span', 'tiny muted', bar.lastAction ?? ''));
  right.appendChild(actionButton(ctx.t('DRILL_HOST_OPEN'), 'jump-host'));
  head.appendChild(right);
  barCard.appendChild(head);
  if (bar.line) barCard.appendChild(el('div', 'tiny muted mt6', bar.line));
  frag.appendChild(barCard);

  const grid = el('div', 'split3 mt14');
  grid.appendChild(dagBlock(ctx, view.dag));

  const list = el('div');
  const cards = Array.isArray(view.cards) ? view.cards : [];
  const listHead = el('div', 'between mb10');
  listHead.appendChild(el('b', 'small', ctx.t('DESKTOP_V2_CARDS')));
  listHead.appendChild(actionButton(ctx.t('DRILL_VIEW_ALL_NODES'), 'drill-all-nodes'));
  list.appendChild(listHead);
  if (cards.length === 0) {
    list.appendChild(emptyBox('\u25c7', view.cardsEmptyText ?? ctx.t('DESKTOP_V2_EMPTY')));
  }
  for (const item of cards) {
    const node = el('div', item.rank === 1 ? 'card-row hl' : 'card-row');
    node.setAttribute('data-action', 'open-node');
    node.setAttribute('data-arg', JSON.stringify({ nodeId: item.nodeId, from: 'drill' }));
    const lines = Array.isArray(item.lines) ? item.lines : [];
    const title = el('div', 'between');
    title.appendChild(el('b', 'small', lines[0] ?? item.nodeId ?? ''));
    const indicator = item.indicator ?? {};
    title.appendChild(badge(indicator.label ?? '', STATUS_TONE[indicator.color] ?? 'gray', indicator.color === 'blue'));
    node.appendChild(title);
    if (lines[1]) node.appendChild(el('div', 'tiny muted mt6', lines[1]));
    if (lines[2]) node.appendChild(el('div', 'tiny muted mt6', lines[2]));
    list.appendChild(node);
  }
  grid.appendChild(list);
  frag.appendChild(grid);
  return frag;
}

/** Node detail page (also used inside the drawer). */
export function nodeDetailBody(ctx) {
  const detail = ctx.model.drill?.detail ?? null;
  const frag = document.createDocumentFragment();
  if (detail === null) {
    frag.appendChild(emptyBox('\u25c7', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  if (detail.head) frag.appendChild(el('div', 'small muted mb14', detail.head));
  for (const section of detail.sections ?? []) {
    const box = card([], { className: 'mt10' });
    box.appendChild(sectionTitle(section.title ?? ''));
    if (section.key === 'timeline') {
      const items = (section.lines ?? []).map((line) => ({ title: line, tone: '' }));
      box.appendChild(timeline(items));
    } else {
      for (const line of section.lines ?? []) box.appendChild(el('p', 'small mono mt6', line));
    }
    frag.appendChild(box);
  }
  return frag;
}

/** Node detail page shell. */
export function nodeDetailPage(ctx) {
  const frag = document.createDocumentFragment();
  frag.appendChild(pageHead(ctx.t('DESKTOP_V2_DETAIL'), ctx.instanceId ?? null, [backButton(ctx, 'drill')]));
  frag.appendChild(nodeDetailBody(ctx));
  const actions = el('div', 'row mt14');
  actions.appendChild(button(ctx.t('DRILL_HOST_OPEN'), { size: 'sm', action: 'jump-host' }));
  actions.appendChild(button(ctx.t('DESKTOP_V2_COPY'), { size: 'sm', action: 'copy-evidence' }));
  frag.appendChild(actions);
  return frag;
}

/** Escalation panel page. */
export function escalationPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.drill?.escalations ?? null;
  if (!ctx.inDrawer) {
    frag.appendChild(pageHead(view?.title ?? ctx.t('DRILL_ESC_TITLE'), view?.countLine ?? null, [backButton(ctx, 'drill')]));
  } else if (view?.countLine) {
    frag.appendChild(el('div', 'small muted mb14', view.countLine));
  }
  if (view === null || (view.items ?? []).length === 0) {
    frag.appendChild(emptyBox('\u26a0', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  for (const item of view.items ?? []) {
    const box = card([], { className: 'queue-item' });
    box.style.borderLeft = '4px solid var(--amber)';
    box.appendChild(el('b', 'small', item.line ?? ''));
    if (item.reasonLine) box.appendChild(el('div', 'tiny muted mt6', item.reasonLine));
    for (const line of item.defectLines ?? []) box.appendChild(el('div', 'tiny muted mt6', line));
    const actions = el('div', 'row mt14');
    const cont = button(ctx.t('DRILL_ESC_CONTINUE'), {
      variant: 'primary', size: 'sm', action: 'continue-escalation',
      arg: { escalationId: item.escalationId }, disabled: view.continueDisabled === true,
    });
    actions.appendChild(cont);
    actions.appendChild(actionButton(ctx.t('DRILL_ESC_CANCEL'), 'drill-back', 'graph'));
    box.appendChild(actions);
    frag.appendChild(box);
  }
  if (ctx.model.escalationNotice?.text) {
    frag.appendChild(el('div', 'notice mt14', ctx.model.escalationNotice.text));
  }
  return frag;
}

/** Handoff / connection panel page. */
export function connectionPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.drill?.connection ?? null;
  const title = view?.title ?? ctx.t('DESKTOP_V2_DETAIL');
  if (!ctx.inDrawer) frag.appendChild(pageHead(title, ctx.instanceId ?? null, [backButton(ctx, 'graph')]));
  if (view === null || (view.rows ?? []).length === 0) {
    frag.appendChild(emptyBox('\u21c4', view?.emptyText ?? ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  for (const row of view.rows ?? []) {
    const box = card([], { className: 'queue-item' });
    const head = el('div', 'between');
    head.appendChild(el('b', 'small', row.line ?? ''));
    head.appendChild(tag(row.id ?? '', true));
    box.appendChild(head);
    if (row.reason) box.appendChild(el('div', 'tiny muted mt6', row.reason));
    if (Array.isArray(row.timeline) && row.timeline.length > 0) {
      box.appendChild(divider());
      for (const entry of row.timeline) {
        box.appendChild(el('div', 'tiny muted mt6', `${entry.ts ?? ''} ${entry.state ?? ''}`));
      }
    }
    frag.appendChild(box);
  }
  return frag;
}

/** Sub-workflow page. */
export function subflowPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.drill?.subflow ?? null;
  const crumb = Array.isArray(view?.breadcrumb) ? view.breadcrumb.join(' / ') : '';
  frag.appendChild(pageHead(ctx.t('DRILL_VIEW_BACK_LEVEL'), crumb || ctx.instanceId || null, [backButton(ctx, 'drill')]));
  if (view === null) {
    frag.appendChild(emptyBox('\u2317', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  if (view.degraded?.text) frag.appendChild(el('div', 'notice', view.degraded.text));
  const grid = el('div', 'split3');
  const left = card([], { flat: true });
  const rows = (view.nodes ?? []).map((node) => [node.nodeId ?? node.id ?? '', node.title ?? '', node.status ?? '']);
  if (rows.length === 0) left.appendChild(emptyBox('\u2317', ctx.t('DESKTOP_V2_EMPTY')));
  else {
    left.appendChild(el('div', 'card-head', ctx.t('DESKTOP_V2_NODE')));
    const body = el('div', 'asset-list');
    for (const row of rows) body.appendChild(el('div', 'asset-row', row.filter(Boolean).join(' \u00b7 ')));
    left.appendChild(body);
  }
  grid.appendChild(left);
  const right = card([]);
  right.appendChild(sectionTitle(ctx.t('DESKTOP_V2_DETAIL')));
  for (const line of view.legend ?? []) right.appendChild(el('p', 'tiny muted mt6', line));
  grid.appendChild(right);
  frag.appendChild(grid);
  return frag;
}

export { append, logBlock, fieldLine };
