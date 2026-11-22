/**
 * Global and instance pages (beta.2).
 *
 * Every renderer takes `ctx`:
 *   { state, model, labels, t, view, instanceId, instanceRow, graph, actions }
 * and returns a DocumentFragment. Data comes from the frozen projections
 * already computed by `createApp` (`model.rows / queue / assets / occupancy /
 * canvas / evidence / board`); this layer only arranges them. A missing
 * projection degrades to an explicit empty state instead of a blank page.
 */

import {
  append, badge, button, callout, card, divider, el, emptyBox, fieldLine,
  kv, logBlock, metric, pageHead, progress, sectionTitle, table, tag, timeline,
} from './kit.js';

/** Instance status word -> badge tone. */
const STATE_TONE = Object.freeze({
  running: 'run',
  suspended: 'wait',
  completed: 'done',
  failed: 'fail',
  cancelled: 'gray',
  interrupted: 'fail',
  created: 'cyan',
});

/** Health level -> badge tone. */
const HEALTH_TONE = Object.freeze({ attention: 'fail', slow: 'wait', normal: 'done', ended: 'gray' });

/** Node state -> badge tone (nine-state vocabulary). */
const NODE_TONE = Object.freeze({
  done: 'done',
  running: 'run',
  review: 'wait',
  escalated: 'wait',
  failed: 'fail',
  blocked: 'gray',
  ready: 'cyan',
  assigned: 'cyan',
  pending: 'gray',
  cancelled: 'gray',
});

/** Node state -> NODE_LABEL_* key. */
const NODE_KEY = Object.freeze({
  done: 'NODE_LABEL_DONE',
  running: 'NODE_LABEL_RUNNING',
  review: 'NODE_LABEL_REVIEW',
  escalated: 'NODE_LABEL_ESCALATED',
  failed: 'NODE_LABEL_FAILED',
  cancelled: 'NODE_LABEL_CANCELLED',
  pending: 'NODE_LABEL_PENDING',
});

const ROLE_TONE = Object.freeze({ green: 'done', blue: 'run', gray: 'gray', red: 'fail' });

/** Instance workspace tabs (overview / flow / board / queue / evidence). */
const WORKSPACE_TABS = Object.freeze([
  ['overview', 'DESKTOP_V2_TAB_OVERVIEW'],
  ['graph', 'DESKTOP_VIEW_GRAPH'],
  ['board', 'DESKTOP_VIEW_BOARD'],
  ['queue', 'DESKTOP_VIEW_QUEUE'],
  ['evidence', 'DESKTOP_VIEW_EVIDENCE'],
]);

export function workspaceTabs(ctx) {
  const bar = el('div', 'tabs');
  for (const [view, key] of WORKSPACE_TABS) {
    const active = ctx.view === view
      || (view === 'graph' && ['graph', 'drill', 'node-detail', 'escalation-panel', 'connection-panel', 'subflow'].includes(ctx.view));
    const node = el('button', active ? 'tab on' : 'tab', ctx.t(key));
    node.type = 'button';
    node.setAttribute('data-action', 'tab');
    node.setAttribute('data-arg', view);
    bar.appendChild(node);
  }
  return bar;
}

function stateWord(ctx, state) {
  const key = `INSTANCE_LABEL_${String(state ?? '').toUpperCase()}`;
  const word = ctx.labels[key];
  return typeof word === 'string' ? word : String(state ?? '');
}

function nodeWord(ctx, state) {
  const key = NODE_KEY[state] ?? null;
  const word = key === null ? null : ctx.labels[key];
  return typeof word === 'string' ? word : String(state ?? '');
}

function healthWord(ctx, level) {
  const word = ctx.labels[`HEALTH_LABEL_${String(level ?? '').toUpperCase()}`];
  return typeof word === 'string' ? word : null;
}

function pluralCount(ctx, n) {
  return ctx.t('DESKTOP_V2_COUNT', { n: String(n ?? 0) });
}

/** Split one projection row text into readable pieces (never re-authors). */
function textOf(row) {
  return typeof row?.text === 'string' ? row.text : '';
}

// ---------------------------------------------------------------------------
// project
// ---------------------------------------------------------------------------

export function projectPage(ctx) {
  const frag = document.createDocumentFragment();
  // `projectMessage` is non-null only when the project is missing or invalid.
  // A user who simply clicks the sidebar entry gets the project facts instead
  // of a dead "retry" button.
  const message = ctx.model.projectMessage ?? null;
  frag.appendChild(pageHead(ctx.t('DESKTOP_V2_SETTINGS_PROJECT'), message));

  const box = card([], { className: 'prompt-card' });
  const mark = document.createElement('img');
  mark.className = 'prompt-mark';
  mark.src = './brand/mark.svg';
  mark.alt = '';
  box.appendChild(mark);

  if (message !== null) {
    box.appendChild(el('p', 'prompt-text', message));
    const actions = el('div', 'row mt14');
    actions.appendChild(button(ctx.t('DESKTOP_V2_RETRY'), { variant: 'primary', action: 'retry-connection' }));
    actions.appendChild(button(ctx.t('DESKTOP_V2_SWITCH_PROJECT'), { action: 'pick-project' }));
    box.appendChild(actions);
  } else {
    box.appendChild(el('p', 'prompt-text', ctx.projectRoot ?? ''));
    box.appendChild(fieldLine(ctx.t('DESKTOP_V2_SETTINGS_DATA'), ctx.dataDir ?? ''));
    const actions = el('div', 'row mt14');
    actions.appendChild(button(ctx.t('DESKTOP_V2_SWITCH_PROJECT'), { variant: 'primary', action: 'pick-project' }));
    actions.appendChild(button(ctx.instancesLabel ?? 'Maestro', { action: 'nav', arg: 'instances' }));
    box.appendChild(actions);
  }
  frag.appendChild(box);
  return frag;
}

// ---------------------------------------------------------------------------
// instances (global layer)
// ---------------------------------------------------------------------------

const FILTERS = Object.freeze([
  ['all', 'DESKTOP_V2_FILTER_ALL'],
  ['pending', 'DESKTOP_V2_PENDING'],
  ['running', 'INSTANCE_LABEL_RUNNING'],
  ['suspended', 'INSTANCE_LABEL_SUSPENDED'],
  ['completed', 'INSTANCE_LABEL_COMPLETED'],
  ['failed', 'INSTANCE_LABEL_FAILED'],
]);

export function instancesPage(ctx) {
  const frag = document.createDocumentFragment();
  const headActions = [button(`+ ${ctx.t('DESKTOP_NEW_TITLE')}`, { variant: 'primary', action: 'nav', arg: 'new' })];
  frag.appendChild(pageHead(ctx.instancesLabel ?? 'Maestro', ctx.projectRoot ?? null, headActions));

  const chips = el('div', 'sb mb14');
  for (const [key, labelKey] of FILTERS) {
    const active = (ctx.state.listFilter ?? 'all') === key;
    const chip = el('button', active ? 'chip on' : 'chip', ctx.t(labelKey));
    chip.type = 'button';
    chip.setAttribute('data-action', 'filter');
    chip.setAttribute('data-arg', key);
    chips.appendChild(chip);
  }
  frag.appendChild(chips);

  const rows = (ctx.model.rows ?? []).filter((row) => {
    const filter = ctx.state.listFilter ?? 'all';
    if (filter === 'all') return true;
    if (filter === 'pending') return (Number(row.pending) || 0) > 0;
    return String(row.state ?? '').toLowerCase() === filter;
  });

  const grid = el('div', 'split');
  const listBox = el('div');
  const empty = rows.length === 0;
  if (empty) {
    // The right rail already carries the create entry, so the empty state
    // explains what to do instead of repeating the same button a second time.
    listBox.appendChild(emptyBox('\u25c8', ctx.t('DESKTOP_V2_NO_INSTANCE')));
  } else {
    for (const row of rows) {
      listBox.appendChild(instanceRow(ctx, row));
    }
  }
  grid.appendChild(listBox);

  const rail = el('div');
  const quick = card([], {});
  quick.appendChild(sectionTitle(ctx.t('DESKTOP_NEW_TITLE'), tag('\u2318K', true)));
  quick.appendChild(button(`+ ${ctx.t('DESKTOP_NEW_TITLE')}`, { variant: 'primary', size: 'sm', action: 'nav', arg: 'new' }));
  quick.lastChild.style.width = '100%';
  quick.appendChild(divider());
  quick.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_NEW_FIELD_WORKFLOW')));
  for (const item of (ctx.state.templates ?? []).slice(0, 4)) {
    const name = typeof item?.title === 'string' ? item.title : (typeof item?.id === 'string' ? item.id : '');
    const line = el('button', 'link-row', name);
    line.type = 'button';
    line.setAttribute('data-action', 'nav');
    line.setAttribute('data-arg', 'new');
    quick.appendChild(line);
  }
  if ((ctx.state.templates ?? []).length === 0) quick.appendChild(el('div', 'tiny muted mt6', ctx.t('DESKTOP_V2_EMPTY')));
  rail.appendChild(quick);

  if (!empty) {
    const healthCard = card([]);
    healthCard.appendChild(sectionTitle(ctx.t('DESKTOP_V2_HEALTH')));
    const buckets = new Map();
    for (const row of ctx.model.rows ?? []) {
      const level = row.healthLevel ?? 'normal';
      buckets.set(level, (buckets.get(level) ?? 0) + 1);
    }
    for (const level of ['attention', 'slow', 'normal', 'ended']) {
      const line = el('div', 'between mt10');
      line.appendChild(el('span', 'small muted', healthWord(ctx, level) ?? level));
      line.appendChild(badge(String(buckets.get(level) ?? 0), HEALTH_TONE[level] ?? 'gray'));
      healthCard.appendChild(line);
    }
    rail.appendChild(healthCard);
  }
  grid.appendChild(rail);
  frag.appendChild(grid);
  return frag;
}

function instanceRow(ctx, row) {
  const node = el('div', 'listrow');
  node.setAttribute('data-action', 'open-instance');
  node.setAttribute('data-arg', JSON.stringify({ instanceId: row.instanceId }));
  const body = el('div', 'grow');

  const line1 = el('div', 'between');
  const left = el('div', 'row');
  left.appendChild(el('b', 'small', row.templateTitle || row.instanceId));
  left.appendChild(badge(stateWord(ctx, row.state), STATE_TONE[String(row.state ?? '').toLowerCase()] ?? 'gray', String(row.state ?? '').toLowerCase() === 'running'));
  line1.appendChild(left);
  line1.appendChild(tag(row.instanceId, true));
  body.appendChild(line1);

  const meta = el('div', 'row mt6 meta');
  meta.appendChild(el('span', 'mini', row.phase ? `${row.phase}` : ''));
  if (row.total > 0) meta.appendChild(el('span', 'mini', `${row.done ?? 0}/${row.total}`));
  if (row.pending > 0) meta.appendChild(badge(String(row.pending), 'wait'));
  const health = healthWord(ctx, row.healthLevel);
  if (health) meta.appendChild(badge(health, HEALTH_TONE[row.healthLevel] ?? 'gray'));
  body.appendChild(meta);

  if (row.total > 0) {
    const pct = Math.round(((row.done ?? 0) / row.total) * 100);
    body.appendChild(progress(pct, true));
  }
  node.appendChild(body);
  return node;
}

// ---------------------------------------------------------------------------
// new instance
// ---------------------------------------------------------------------------

export function newPage(ctx) {
  const frag = document.createDocumentFragment();
  const panel = ctx.model.panel ?? {};
  frag.appendChild(pageHead(ctx.t('DESKTOP_NEW_TITLE'), panel.title ?? null));

  const grid = el('div', 'split');
  const main = card([]);
  main.appendChild(sectionTitle(ctx.t('DESKTOP_NEW_FIELD_WORKFLOW')));

  const templates = (ctx.state.templates ?? []);
  const list = el('div', 'tile-grid');
  if (templates.length === 0) {
    list.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_V2_EMPTY')));
  }
  // The form state lives in the assembly's new-panel object (`model.panel`);
  // the renderer only mirrors it, so a pick survives every repaint.
  const chosen = panel.template ?? templates[0]?.id ?? '';
  templates.forEach((item, index) => {
    const id = typeof item?.id === 'string' ? item.id : String(index);
    const title = typeof item?.title === 'string' ? item.title : id;
    const tile = el('button', chosen === id ? 'tile-card on' : 'tile-card');
    tile.type = 'button';
    tile.setAttribute('data-action', 'pick-template');
    tile.setAttribute('data-arg', id);
    tile.appendChild(el('b', 'small', title));
    if (typeof item?.description === 'string') tile.appendChild(el('div', 'tiny muted mt6', item.description));
    list.appendChild(tile);
  });
  main.appendChild(list);

  main.appendChild(el('h3', 'section-title mt20', ctx.t('DESKTOP_NEW_FIELD_TASK')));
  const area = el('textarea', 'input-area');
  area.rows = 4;
  area.id = 'new-task';
  area.value = panel.task ?? '';
  main.appendChild(area);

  if (panel.message) {
    main.appendChild(el('div', 'form-error', panel.message));
  }
  if (panel.success) {
    main.appendChild(el('div', 'form-ok', panel.success));
  }
  const actions = el('div', 'row mt14');
  const start = button(ctx.t('DESKTOP_NEW_ACTION_START'), { variant: 'primary', action: 'submit-new' });
  if (panel.submitting) start.disabled = true;
  actions.appendChild(start);
  actions.appendChild(button(ctx.t('DESKTOP_NEW_ACTION_CANCEL'), { action: 'nav', arg: 'instances' }));
  main.appendChild(actions);
  grid.appendChild(main);

  const side = el('div');
  const checks = card([]);
  checks.appendChild(el('div', 'small muted', ctx.t('DESKTOP_V2_NEXT')));
  checks.appendChild(el('div', 'mt10', badge(ctx.statusText ?? '', 'done')));
  checks.appendChild(divider());
  checks.appendChild(el('div', 'tiny muted', ctx.t('DESKTOP_V2_SETTINGS_HOST')));
  checks.appendChild(el('div', 'small mt6', ctx.hostText ?? ''));
  side.appendChild(checks);
  grid.appendChild(side);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// overview
// ---------------------------------------------------------------------------

export function overviewPage(ctx) {
  const frag = document.createDocumentFragment();
  const row = ctx.instanceRow;
  const nodes = Array.isArray(ctx.graph?.nodes) ? ctx.graph.nodes : [];
  const done = nodes.filter((node) => node.state === 'done' || node.status === 'done').length;
  const pending = row?.pending ?? 0;

  frag.appendChild(pageHead(
    row?.templateTitle || ctx.instanceId || '',
    [ctx.instanceId, stateWord(ctx, row?.state)].filter(Boolean).join(' \u00b7 '),
    [button(ctx.t('DESKTOP_V2_BACK'), { action: 'nav', arg: 'instances' })],
  ));
  frag.appendChild(workspaceTabs(ctx));

  const metrics = el('div', 'metric-grid');
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_STAGE'), row?.phase ?? ctx.t('DESKTOP_PLACEHOLDER')));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_PENDING'), String(pending), { tone: pending > 0 ? 'amber' : 'green' }));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_NODE'), `${done}/${nodes.length || 0}`));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_HEALTH'), healthWord(ctx, row?.healthLevel) ?? ctx.t('DESKTOP_PLACEHOLDER'), { tone: row?.healthLevel === 'attention' ? 'red' : 'green' }));
  frag.appendChild(metrics);

  const grid = el('div', 'split mt14');
  const line = card([]);
  line.appendChild(sectionTitle(ctx.t('DESKTOP_V2_TIMELINE'), badge(stateWord(ctx, row?.state), STATE_TONE[String(row?.state ?? '').toLowerCase()] ?? 'gray')));
  const items = nodes.slice(0, 8).map((node) => ({
    title: node.title ?? node.id ?? '',
    detail: [node.role ?? node.roleId, node.state ? nodeWord(ctx, node.state) : null].filter(Boolean).join(' \u00b7 '),
    tone: node.state === 'done' ? 'done' : node.state === 'running' || node.state === 'escalated' ? 'wait' : node.state === 'failed' ? 'fail' : '',
  }));
  if (items.length === 0) line.appendChild(emptyBox('\u25c7', ctx.t('DESKTOP_V2_EMPTY')));
  else line.appendChild(timeline(items));
  grid.appendChild(line);

  const side = el('div');
  const next = card([]);
  next.appendChild(sectionTitle(ctx.t('DESKTOP_V2_NEXT')));
  next.appendChild(el('p', 'small muted mt6', ctx.instanceHint ?? ''));
  const goQueue = button(ctx.t('DESKTOP_VIEW_QUEUE'), { variant: 'primary', action: 'nav', arg: 'queue' });
  goQueue.style.width = '100%';
  next.appendChild(goQueue);
  const goFlow = button(ctx.t('DESKTOP_VIEW_GRAPH'), { action: 'nav', arg: 'graph' });
  goFlow.style.width = '100%';
  goFlow.classList.add('mt10');
  next.appendChild(goFlow);
  side.appendChild(next);

  const controls = card([]);
  controls.appendChild(sectionTitle(ctx.t('DESKTOP_V2_CHECKPOINT'), badge(ctx.t('DESKTOP_V2_STATE'), 'cyan')));
  controls.appendChild(kv(ctx.t('DESKTOP_V2_STATE'), stateWord(ctx, row?.state)));
  const rowActions = el('div', 'row mt10');
  rowActions.appendChild(button(ctx.t('DESKTOP_V2_PAUSE'), { size: 'sm', action: 'pause-instance', arg: ctx.instanceId }));
  rowActions.appendChild(button(ctx.t('DESKTOP_QUEUE_ACTION_CANCEL'), { size: 'sm', action: 'cancel-instance', arg: ctx.instanceId }));
  controls.appendChild(rowActions);
  side.appendChild(controls);
  grid.appendChild(side);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// queue
// ---------------------------------------------------------------------------

export function queuePage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.queue ?? { rows: [], prefs: [] };
  const prefs = Array.isArray(ctx.prefs) && ctx.prefs.length > 0 ? ctx.prefs : (view.prefs ?? []);
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_QUEUE'), ctx.queueSubtitle ?? null));
  if (ctx.instanceId) frag.appendChild(workspaceTabs(ctx));

  if (view.disconnectedText) frag.appendChild(el('div', 'notice', view.disconnectedText));

  if (prefs.length > 0) {
    // These four switches are notification preferences, not queue filters.
    // Labelling them keeps the queue page from looking like a filter bar.
    frag.appendChild(el('div', 'tiny muted mb6', ctx.t('DESKTOP_V2_SETTINGS_NOTIFY')));
    const prefsRow = el('div', 'prefs');
    for (const pref of prefs) {
      const label = el('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = pref.checked === true;
      input.setAttribute('data-action', 'toggle-pref');
      input.setAttribute('data-arg', pref.key);
      label.appendChild(input);
      label.appendChild(el('span', 'small', pref.text ?? ''));
      prefsRow.appendChild(label);
    }
    frag.appendChild(prefsRow);
  }

  if ((view.rows ?? []).length === 0) {
    frag.appendChild(emptyBox('\u2637', view.emptyText ?? ctx.t('DESKTOP_V2_EMPTY')));
  } else {
    for (const row of view.rows) {
      const tone = row.type === 'escalation' ? 'amber' : 'cyan';
      const box = card([], { className: 'queue-item' });
      box.style.borderLeft = `4px solid var(--${tone})`;
      const head = el('div', 'between');
      const left = el('div', 'row');
      left.appendChild(tag(row.type === 'escalation' ? ctx.t('DESKTOP_NOTIFY_CATEGORY_ESCALATION') : ctx.t('APPROVAL_LABEL_PENDING')));
      left.appendChild(el('b', 'small', textOf(row)));
      head.appendChild(left);
      head.appendChild(tag(row.id ?? '', true));
      box.appendChild(head);
      if (row.expanded) {
        const controls = el('div', 'row mt14');
        for (const action of row.actions ?? []) {
          const node = button(action.text ?? '', {
            variant: action.id === 'allow' || action.id === 'pass' ? 'primary' : 'ghost',
            size: 'sm',
            action: 'decide',
            arg: { rowKey: row.key, decision: action.id, type: row.type },
            disabled: action.disabled === true,
            title: action.hint ?? null,
          });
          controls.appendChild(node);
        }
        box.appendChild(controls);
      } else {
        const open = button(ctx.t('DESKTOP_V2_DETAIL'), { size: 'sm', action: 'select-row', arg: row.key });
        box.appendChild(el('div', 'row mt10')).appendChild(open);
      }
      frag.appendChild(box);
    }
  }

  if (view.notice?.text) frag.appendChild(callout(view.notice.text, { tone: 'primary' }));
  return frag;
}

// ---------------------------------------------------------------------------
// assets
// ---------------------------------------------------------------------------

export function assetsPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.assets ?? { tabs: [], rows: [], detail: null };
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_ASSETS'), ctx.assetsSubtitle ?? null));

  const tabs = el('div', 'tabs');
  for (const tab of view.tabs ?? []) {
    const node = el('button', tab.active ? 'tab on' : 'tab', tab.text ?? '');
    node.type = 'button';
    node.setAttribute('data-action', 'asset-kind');
    node.setAttribute('data-arg', tab.kind);
    tabs.appendChild(node);
  }
  frag.appendChild(tabs);
  if (view.countText) frag.appendChild(el('div', 'small muted mb10', view.countText));
  if (view.dirUnreadableText) frag.appendChild(el('div', 'notice', view.dirUnreadableText));

  const grid = el('div', 'split');
  const listCard = card([], { flat: true });
  const rows = (view.rows ?? []);
  if (rows.length === 0) listCard.appendChild(emptyBox('\u25a4', ctx.t('DESKTOP_V2_EMPTY')));
  else {
    const box = el('div', 'asset-list');
    for (const row of rows) {
      const node = el('div', 'asset-row');
      node.setAttribute('data-action', 'asset-row');
      node.setAttribute('data-arg', JSON.stringify({ kind: ctx.state.assetKind, id: row.id }));
      node.appendChild(el('span', 'grow', textOf(row)));
      node.appendChild(el('span', 'tiny muted', '\u2192'));
      box.appendChild(node);
    }
    listCard.appendChild(box);
  }
  grid.appendChild(listCard);

  const detail = card([]);
  detail.appendChild(sectionTitle(ctx.t('DESKTOP_V2_DETAIL')));
  const lines = view.detail?.lines ?? [];
  if (lines.length === 0) detail.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_SELECT_ITEM')));
  for (const line of lines) detail.appendChild(el('p', 'small mt6', line));
  grid.appendChild(detail);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// occupancy
// ---------------------------------------------------------------------------

export function occupancyPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.occupancy ?? { rows: [], skipped: [] };
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_OCCUPANCY'), null));
  if (view.disconnectedText) frag.appendChild(el('div', 'notice', view.disconnectedText));
  const rows = view.rows ?? [];
  if (rows.length === 0) {
    frag.appendChild(emptyBox('\u25cd', ctx.t('DESKTOP_V2_OCCUPANCY_HINT')));
  } else {
    const box = card([], { flat: true });
    for (const row of rows) {
      const line = el('div', 'listrow');
      line.appendChild(el('div', 'grow small', textOf(row)));
      box.appendChild(line);
    }
    frag.appendChild(box);
  }
  if (view.skippedText) frag.appendChild(el('div', 'tiny muted mt10', view.skippedText));
  return frag;
}

// ---------------------------------------------------------------------------
// canvas
// ---------------------------------------------------------------------------

export function canvasPage(ctx) {
  const frag = document.createDocumentFragment();
  const view = ctx.model.canvas ?? { nodes: [], edges: [] };
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_CANVAS'), view.title ?? null));

  // Workflow switch: the canvas is a projection of ONE workflow, so the page
  // needs its own selector instead of depending on whichever id loaded first.
  const templates = Array.isArray(ctx.state.templates) ? ctx.state.templates : [];
  if (templates.length > 0) {
    const chips = el('div', 'sb mb14');
    for (const item of templates) {
      const id = typeof item?.id === 'string' ? item.id : null;
      if (id === null) continue;
      const active = (ctx.state.canvasId ?? templates[0]?.id) === id;
      const chip = el('button', active ? 'chip on' : 'chip', typeof item?.title === 'string' ? item.title : id);
      chip.type = 'button';
      chip.setAttribute('data-action', 'canvas-pick');
      chip.setAttribute('data-arg', id);
      chips.appendChild(chip);
    }
    frag.appendChild(chips);
  }

  if (view.badge) frag.appendChild(el('div', 'mb14', badge(view.badge, 'cyan')));
  if (view.degrade?.text) {
    const box = callout(view.degrade.text, { tone: 'amber' });
    for (const reason of view.degrade.reasons ?? []) box.appendChild(el('div', 'tiny muted mt6', reason));
    frag.appendChild(box);
  }
  const layout = ctx.state.canvasLayout ?? null;
  const wrap = el('div', 'graphwrap');
  const ns = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(ns, 'svg');
  node.setAttribute('viewBox', '0 0 960 360');
  node.setAttribute('width', '100%');
  if (layout !== null) {
    for (const edge of layout.edges ?? []) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', edge.path);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#cbd5e1');
      path.setAttribute('stroke-width', '2');
      node.appendChild(path);
    }
    for (const placed of layout.nodes ?? []) {
      const g = document.createElementNS(ns, 'g');
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', placed.x);
      rect.setAttribute('y', placed.y);
      rect.setAttribute('width', placed.width ?? 160);
      rect.setAttribute('height', placed.height ?? 64);
      rect.setAttribute('rx', '12');
      rect.setAttribute('fill', '#fff');
      rect.setAttribute('stroke', '#c7d2fe');
      g.appendChild(rect);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', Number(placed.x) + 14);
      label.setAttribute('y', Number(placed.y) + 30);
      label.setAttribute('font-size', '12');
      label.textContent = placed.id ?? '';
      g.appendChild(label);
      node.appendChild(g);
    }
  } else {
    for (const item of view.nodes ?? []) {
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', item.x ?? 10);
      label.setAttribute('y', item.y ?? 10);
      label.setAttribute('font-size', '12');
      label.textContent = item.text ?? item.id ?? '';
      node.appendChild(label);
    }
  }
  wrap.appendChild(node);
  frag.appendChild(wrap);

  const rows = (view.nodes ?? []).map((item) => [item.id ?? '', item.text ?? '']);
  if (rows.length > 0) {
    const box = card([], { flat: true, className: 'mt14' });
    box.appendChild(table([ctx.t('DESKTOP_V2_NODE'), ctx.t('DESKTOP_V2_DETAIL')], rows));
    frag.appendChild(box);
  }
  return frag;
}

// ---------------------------------------------------------------------------
// evidence
// ---------------------------------------------------------------------------

export function evidencePage(ctx) {
  const frag = document.createDocumentFragment();
  const items = Array.isArray(ctx.state.evidence?.items) ? ctx.state.evidence.items : [];
  frag.appendChild(pageHead(ctx.t('DESKTOP_VIEW_EVIDENCE'), ctx.instanceId ?? null));
  frag.appendChild(workspaceTabs(ctx));
  if (ctx.model.evidence?.text) {
    frag.appendChild(logBlock(ctx.model.evidence.text));
    return frag;
  }
  if (items.length === 0) {
    frag.appendChild(emptyBox('\u25a4', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  const grid = el('div', 'split3');
  const nav = el('div', 'card');
  nav.appendChild(el('div', 'tiny muted mb10', ctx.t('DESKTOP_V2_NODE')));
  const selected = ctx.state.evidenceNode ?? items[0]?.nodeId ?? null;
  for (const item of items) {
    const active = item.nodeId === selected;
    const node = el('button', active ? 'nav-item on' : 'nav-item', item.nodeId ?? '');
    node.type = 'button';
    node.setAttribute('data-action', 'evidence-node');
    node.setAttribute('data-arg', item.nodeId ?? '');
    nav.appendChild(node);
  }
  grid.appendChild(nav);

  const detail = el('div');
  const item = items.find((entry) => entry.nodeId === selected) ?? items[0];
  const box = card([]);
  box.appendChild(sectionTitle(item.nodeId ?? '', badge(ctx.t('DESKTOP_V2_STATE'), 'cyan')));
  box.appendChild(kv(ctx.t('DESKTOP_V2_SUMMARY'), item.command ?? ctx.t('DESKTOP_PLACEHOLDER')));
  if (item.exitCode !== null && item.exitCode !== undefined) box.appendChild(kv('exit', String(item.exitCode)));
  const refs = Array.isArray(item.artifactRefs) ? item.artifactRefs : [];
  box.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_ARTIFACTS')));
  if (refs.length === 0) box.appendChild(el('div', 'small mt6', ctx.t('DESKTOP_PLACEHOLDER')));
  for (const ref of refs) {
    const line = el('div', 'ref-line');
    line.appendChild(el('span', 'mono tiny', ref.ref ?? ''));
    if (ref.sha256) line.appendChild(el('span', 'tiny muted', String(ref.sha256).slice(0, 12)));
    box.appendChild(line);
  }
  if (Array.isArray(item.unreadable) && item.unreadable.length > 0) {
    box.appendChild(el('div', 'tiny muted mt10', item.unreadable.join(' \u00b7 ')));
  }
  detail.appendChild(box);
  grid.appendChild(detail);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// governance (read-only summary of the audit-facing projections)
// ---------------------------------------------------------------------------

export function governancePage(ctx) {
  const frag = document.createDocumentFragment();
  frag.appendChild(pageHead(ctx.t('DESKTOP_V2_NAV_AUDIT'), null));

  const rows = ctx.model.rows ?? [];
  // Governance counters have no projection behind them yet. Showing a health
  // count under a governance label would be a fabricated number, so the tiles
  // stay empty and the line below says where the numbers come from.
  const na = ctx.t('DESKTOP_V2_NOT_AVAILABLE');
  const metrics = el('div', 'metric-grid');
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_HASH_CHAIN'), na, { tone: 'gray' }));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_PERMISSION_DENY'), na, { tone: 'gray' }));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_EVIDENCE_EXPIRED'), na, { tone: 'gray' }));
  metrics.appendChild(metric(ctx.t('DESKTOP_V2_BUDGET'), na, { tone: 'gray' }));
  frag.appendChild(metrics);
  frag.appendChild(el('div', 'tiny muted mb14', ctx.t('DESKTOP_V2_GOVERNANCE_HINT')));

  const grid = el('div', 'split mt14');
  const stream = card([], { flat: true });
  stream.appendChild(el('div', 'card-head', ctx.t('DESKTOP_V2_AUDIT_STREAM')));
  const tableRows = rows.map((row) => [
    row.instanceId ?? '',
    stateWord(ctx, row.state),
    healthWord(ctx, row.healthLevel) ?? ctx.t('DESKTOP_PLACEHOLDER'),
    String(row.pending ?? 0),
  ]);
  if (tableRows.length === 0) stream.appendChild(emptyBox('\u26e8', ctx.t('DESKTOP_V2_EMPTY')));
  else {
    stream.appendChild(table(
      [ctx.t('DESKTOP_NOTIFY_SEG_INSTANCE'), ctx.t('DESKTOP_V2_STATE'), ctx.t('DESKTOP_V2_HEALTH'), ctx.t('DESKTOP_V2_PENDING')],
      tableRows,
    ));
  }
  grid.appendChild(stream);

  const side = el('div');
  const anti = card([]);
  anti.appendChild(sectionTitle(ctx.t('DESKTOP_V2_ANTIPATTERN')));
  const anomalies = rows.filter((row) => row.healthLevel === 'attention' || row.healthLevel === 'slow');
  if (anomalies.length === 0) {
    anti.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_NO_ANOMALY')));
  }
  for (const row of anomalies) {
    const line = el('div', 'between mt10');
    line.appendChild(el('span', 'small', row.instanceId ?? ''));
    line.appendChild(badge(healthWord(ctx, row.healthLevel) ?? '', HEALTH_TONE[row.healthLevel] ?? 'gray'));
    anti.appendChild(line);
  }
  side.appendChild(anti);

  const exp = card([], { className: 'mt14' });
  exp.appendChild(sectionTitle(ctx.t('DESKTOP_V2_EXPORT_OTEL')));
  exp.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_EXPORT')));
  const row = el('div', 'row mt10');
  const exportBtn = button(ctx.t('DESKTOP_V2_EXPORT_OTEL'), { size: 'sm', action: 'export-otel' });
  if (rows.length === 0) exportBtn.disabled = true;
  row.appendChild(exportBtn);
  exp.appendChild(row);
  side.appendChild(exp);
  grid.appendChild(side);
  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

export function settingsPage(ctx) {
  const frag = document.createDocumentFragment();
  frag.appendChild(pageHead(ctx.t('DESKTOP_V2_NAV_SETTINGS'), null));
  const grid = el('div', 'grid-2');

  const project = card([]);
  project.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_PROJECT')));
  project.appendChild(fieldLine(ctx.t('DESKTOP_V2_SETTINGS_DATA'), ctx.projectRoot ?? ctx.t('DESKTOP_PLACEHOLDER')));
  const projectActions = el('div', 'row mt14');
  projectActions.appendChild(button(ctx.t('DESKTOP_V2_SWITCH_PROJECT'), { size: 'sm', action: 'pick-project' }));
  project.appendChild(projectActions);
  grid.appendChild(project);

  const host = card([]);
  host.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_HOST')));
  const hostRow = el('div', 'row mt10');
  hostRow.appendChild(badge(ctx.statusText ?? '', ctx.statusTone === 'ok' ? 'done' : 'wait'));
  host.appendChild(hostRow);
  host.appendChild(fieldLine(ctx.t('DESKTOP_V2_SESSIONS'), String((ctx.state.instances ?? []).length)));
  host.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_HOST_NOTE')));
  grid.appendChild(host);

  const notify = card([]);
  notify.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_NOTIFY')));
  const prefs = Array.isArray(ctx.prefs) && ctx.prefs.length > 0 ? ctx.prefs : (ctx.model.queue?.prefs ?? []);
  if (prefs.length === 0) notify.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_EMPTY')));
  for (const pref of prefs) {
    const row = el('div', 'between mt10');
    row.appendChild(el('span', 'small', pref.text ?? ''));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = pref.checked === true;
    input.setAttribute('data-action', 'toggle-pref');
    input.setAttribute('data-arg', pref.key);
    row.appendChild(input);
    notify.appendChild(row);
  }
  grid.appendChild(notify);

  const interaction = card([]);
  interaction.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_INTERACTION')));
  const shortcuts = [
    [ctx.t('DESKTOP_V2_COMMAND'), '\u2318K'],
    [ctx.t('DESKTOP_V2_CLOSE'), 'Esc'],
    [ctx.t('DESKTOP_V2_BACK'), '\u2190'],
  ];
  for (const [label, keys] of shortcuts) {
    const row = el('div', 'between mt10');
    row.appendChild(el('span', 'small', label));
    row.appendChild(tag(keys, true));
    interaction.appendChild(row);
  }
  grid.appendChild(interaction);

  const recovery = card([]);
  recovery.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_RECOVERY')));
  recovery.appendChild(el('div', 'mt10', badge(ctx.t('DESKTOP_V2_CHECKPOINT'), 'cyan')));
  recovery.appendChild(el('div', 'tiny muted mt10', ctx.t('DESKTOP_V2_RECOVERY_TEXT')));
  grid.appendChild(recovery);

  const data = card([]);
  data.appendChild(sectionTitle(ctx.t('DESKTOP_V2_SETTINGS_DATA')));
  data.appendChild(fieldLine(ctx.t('DESKTOP_V2_SETTINGS_DATA'), ctx.dataDir ?? '.orch/instances/'));
  grid.appendChild(data);

  frag.appendChild(grid);
  return frag;
}

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export function notificationsPage(ctx) {
  const frag = document.createDocumentFragment();
  const entries = Array.isArray(ctx.state.notifications) ? ctx.state.notifications : [];
  const readAll = button(ctx.t('DESKTOP_V2_READ_ALL'), { size: 'sm', action: 'read-all' });
  if (entries.length === 0) readAll.disabled = true;
  frag.appendChild(pageHead(ctx.t('DESKTOP_NOTIFY_TOGGLE'), null, [readAll]));
  if (entries.length === 0) {
    frag.appendChild(emptyBox('\u2662', ctx.t('DESKTOP_V2_EMPTY')));
    return frag;
  }
  const box = card([], { flat: true });
  for (const entry of entries) {
    const row = el('div', 'notify-row');
    row.setAttribute('data-action', 'follow-notify');
    row.setAttribute('data-arg', JSON.stringify({ kind: entry.kind, ids: entry.ids ?? [] }));
    row.appendChild(el('span', `notify-dot ${entry.kind ?? ''}`.trim()));
    const body = el('div', 'grow');
    body.appendChild(el('b', 'small', entry.title ?? ''));
    body.appendChild(el('div', 'tiny muted mt6', entry.body ?? ''));
    row.appendChild(body);
    if (entry.mergedCount > 1) row.appendChild(badge(String(entry.mergedCount), 'wait'));
    box.appendChild(row);
  }
  frag.appendChild(box);
  return frag;
}

/** Fallback page: explicit line + one escape action, never a blank screen. */
export function fallbackPage(ctx) {
  const frag = document.createDocumentFragment();
  frag.appendChild(pageHead(ctx.viewTitle ?? 'Maestro', null));
  frag.appendChild(emptyBox('\u25c7', ctx.t('DESKTOP_V2_EMPTY'), button(ctx.t('DESKTOP_V2_BACK'), { action: 'nav', arg: 'instances' })));
  return frag;
}

export { append, ROLE_TONE, STATE_TONE, HEALTH_TONE, NODE_TONE, nodeWord, stateWord, healthWord };
