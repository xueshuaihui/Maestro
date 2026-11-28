/**
 * V3.2 CLI pool page (P00). Pure renderer: consumes ctx.v32.data and returns a
 * DocumentFragment without fetching. All user-visible text goes through
 * ctx.t('V32_CLI_*', asciiFallback); keys are listed in LABEL_KEYS for T16.
 *
 * Zero CJK in this file by design (plan section 0.7 red line 5).
 */

export const viewId = 'v32-cli';
export const section = 'startup_resources';

export const LABEL_KEYS = Object.freeze([
  'V32_CLI_TITLE',
  'V32_CLI_SUBTITLE',
  'V32_CLI_SCAN_PROGRESS',
  'V32_CLI_SCAN_PHASE',
  'V32_CLI_SCAN_MODE',
  'V32_CLI_STAT_DISCOVERED',
  'V32_CLI_STAT_AVAILABLE',
  'V32_CLI_STAT_UNHEALTHY',
  'V32_CLI_RESCAN',
  'V32_CLI_FULL_SCAN',
  'V32_CLI_MANUAL_ADD',
  'V32_CLI_HEALTH_CHECK',
  'V32_CLI_FIELD_NAME',
  'V32_CLI_FIELD_PATH',
  'V32_CLI_FIELD_VERSION',
  'V32_CLI_FIELD_ADAPTER',
  'V32_CLI_FIELD_CAPABILITIES',
  'V32_CLI_FIELD_HEALTH',
  'V32_CLI_FIELD_AUTH',
  'V32_CLI_FIELD_RESUMABLE',
  'V32_CLI_FIELD_FINGERPRINT',
  'V32_CLI_FIELD_SOURCE',
  'V32_CLI_FIELD_STALE',
  'V32_CLI_UNKNOWN',
  'V32_CLI_REASON',
  'V32_CLI_EMPTY',
  'V32_CLI_FORM_NAME',
  'V32_CLI_FORM_PATH',
  'V32_CLI_FORM_VERSION',
  'V32_CLI_FORM_ADAPTER',
  'V32_CLI_FORM_SUBMIT'
]);

const UNKNOWN_TEXT = 'unknown';

function tr(ctx, key, fallback) {
  if (!ctx || typeof ctx.t !== 'function') return fallback;
  try {
    const value = ctx.t(key, fallback);
    if (typeof value === 'string' && value.length > 0 && value !== key) return value;
  } catch { /* label service not ready yet */ }
  return fallback;
}

function el(doc, tag, cls, text) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (typeof text === 'string' && text.length > 0) node.textContent = text;
  return node;
}

function button(doc, label, action, arg) {
  const node = el(doc, 'button', 'btn ghost', label);
  node.type = 'button';
  node.setAttribute('data-action', action);
  if (arg !== undefined && arg !== null) node.setAttribute('data-arg', String(arg));
  return node;
}

function fieldLine(doc, ctx, label, value, reason) {
  const row = el(doc, 'div', 'v32-cli-field');
  row.appendChild(el(doc, 'span', 'k', label));
  row.appendChild(el(doc, 'span', 'v', value ?? UNKNOWN_TEXT));
  if (reason) row.appendChild(el(doc, 'small', 'why', `${tr(ctx, 'V32_CLI_REASON', 'reason')}: ${reason}`));
  return row;
}

function statsOf(installs) {
  return {
    discovered: installs.length,
    available: installs.filter((item) => item.health === 'healthy').length,
    unhealthy: installs.filter((item) => item.health === 'unhealthy').length
  };
}

function dataOf(ctx) {
  const data = (ctx && ctx.v32 && ctx.v32.data) || {};
  const installs = Array.isArray(data.value)
    ? data.value
    : (Array.isArray(data.installs) ? data.installs : []);
  return {
    installs,
    scan: data.scan && typeof data.scan === 'object' ? data.scan : {},
    stats: data.stats && typeof data.stats === 'object' ? data.stats : statsOf(installs)
  };
}

function progressPercent(scan) {
  if (scan.status === 'done') return 100;
  if (scan.status === 'running') return scan.mode === 'full' ? 60 : 30;
  return 0;
}

function renderProgress(doc, ctx, scan) {
  const box = el(doc, 'div', 'v32-cli-progress-box');
  box.setAttribute('data-testid', 'v32-cli-progress');
  box.appendChild(el(doc, 'div', 'v32-cli-progress-label',
    tr(ctx, 'V32_CLI_SCAN_PROGRESS', 'Scan progress')));
  const bar = el(doc, 'div', 'progress');
  const fill = el(doc, 'i', null);
  fill.style.width = `${progressPercent(scan)}%`;
  bar.appendChild(fill);
  box.appendChild(bar);
  const meta = el(doc, 'div', 'v32-cli-progress-meta');
  meta.appendChild(el(doc, 'span', 'phase',
    `${tr(ctx, 'V32_CLI_SCAN_PHASE', 'Phase')}: ${scan.phase ?? scan.status ?? 'idle'}`));
  meta.appendChild(el(doc, 'span', 'mode',
    `${tr(ctx, 'V32_CLI_SCAN_MODE', 'Mode')}: ${scan.mode ?? UNKNOWN_TEXT}`));
  meta.appendChild(el(doc, 'span', 'status', String(scan.status ?? 'idle')));
  box.appendChild(meta);
  return box;
}

function renderStats(doc, ctx, stats) {
  const row = el(doc, 'div', 'v32-cli-stats');
  const tiles = [
    ['V32_CLI_STAT_DISCOVERED', 'Discovered', stats.discovered],
    ['V32_CLI_STAT_AVAILABLE', 'Available', stats.available],
    ['V32_CLI_STAT_UNHEALTHY', 'Unhealthy', stats.unhealthy]
  ];
  for (const [key, fallback, value] of tiles) {
    const tile = el(doc, 'div', 'metric v32-cli-stat');
    tile.setAttribute('data-stat', key);
    tile.appendChild(el(doc, 'div', 'l', tr(ctx, key, fallback)));
    tile.appendChild(el(doc, 'div', 'v', String(value ?? 0)));
    row.appendChild(tile);
  }
  return row;
}

function renderActions(doc, ctx) {
  const row = el(doc, 'div', 'v32-cli-actions');
  row.appendChild(button(doc, tr(ctx, 'V32_CLI_RESCAN', 'Rescan'), 'v32-cli-rescan', 'quick'));
  row.appendChild(button(doc, tr(ctx, 'V32_CLI_FULL_SCAN', 'Full scan'), 'v32-cli-full-scan', 'full'));
  row.appendChild(button(doc, tr(ctx, 'V32_CLI_MANUAL_ADD', 'Manual add'), 'v32-cli-manual-add'));
  row.appendChild(button(doc, tr(ctx, 'V32_CLI_HEALTH_CHECK', 'Health check'), 'v32-cli-health-check'));
  return row;
}

function renderForm(doc, ctx) {
  const form = el(doc, 'form', 'v32-cli-form');
  form.setAttribute('data-form', 'v32-cli-manual-add');
  const specs = [
    ['name', 'V32_CLI_FORM_NAME', 'Name'],
    ['path', 'V32_CLI_FORM_PATH', 'Path'],
    ['version', 'V32_CLI_FORM_VERSION', 'Version'],
    ['adapter', 'V32_CLI_FORM_ADAPTER', 'Adapter']
  ];
  for (const [name, key, fallback] of specs) {
    const label = el(doc, 'label', 'v32-cli-form-label', tr(ctx, key, fallback));
    const input = el(doc, 'input', 'v32-cli-form-input');
    input.type = 'text';
    input.name = name;
    input.setAttribute('data-field', name);
    label.appendChild(input);
    form.appendChild(label);
  }
  const submit = button(doc, tr(ctx, 'V32_CLI_FORM_SUBMIT', 'Add CLI'), 'v32-cli-manual-add');
  submit.type = 'submit';
  form.appendChild(submit);
  return form;
}

function displayValue(ctx, install, field, value) {
  if (value !== undefined && value !== null && value !== '' && value !== UNKNOWN_TEXT) return String(value);
  const reason = install.unknownFields && install.unknownFields[field];
  return reason ? `${tr(ctx, 'V32_CLI_UNKNOWN', UNKNOWN_TEXT)} (${reason})` : tr(ctx, 'V32_CLI_UNKNOWN', UNKNOWN_TEXT);
}

function renderRow(doc, ctx, install) {
  const row = el(doc, 'article', 'v32-cli-row');
  row.setAttribute('data-cli-id', String(install.id ?? ''));
  row.appendChild(el(doc, 'h4', 'v32-cli-row-title', install.name ?? UNKNOWN_TEXT));

  const caps = install.capabilities && typeof install.capabilities === 'object' ? install.capabilities : {};
  const capText = Array.isArray(caps.items) && caps.items.length > 0
    ? caps.items.join(', ')
    : displayValue(ctx, install, 'capabilities', null);
  const fields = [
    ['V32_CLI_FIELD_NAME', 'Name', install.name],
    ['V32_CLI_FIELD_PATH', 'Path', install.path],
    ['V32_CLI_FIELD_VERSION', 'Version', install.version],
    ['V32_CLI_FIELD_ADAPTER', 'Adapter/Protocol', install.adapter !== UNKNOWN_TEXT
      ? `${install.adapter}${install.protocol && install.protocol !== UNKNOWN_TEXT ? ` / ${install.protocol}` : ''}`
      : UNKNOWN_TEXT],
    ['V32_CLI_FIELD_CAPABILITIES', 'Capabilities', capText],
    ['V32_CLI_FIELD_HEALTH', 'Health', install.health],
    ['V32_CLI_FIELD_AUTH', 'Auth', install.auth],
    ['V32_CLI_FIELD_RESUMABLE', 'Resumable', install.resumableStatus ?? String(Boolean(install.resumable))],
    ['V32_CLI_FIELD_FINGERPRINT', 'Fingerprint', install.fingerprint],
    ['V32_CLI_FIELD_SOURCE', 'Source', install.source],
    ['V32_CLI_FIELD_STALE', 'Stale', String(Boolean(install.stale))]
  ];
  for (const [key, fallback, value] of fields) {
    const label = tr(ctx, key, fallback);
    const reason = install.unknownFields && install.unknownFields[fieldNameOf(key)];
    row.appendChild(fieldLine(doc, ctx, label, displayValue(ctx, install, fieldNameOf(key), value), reason));
  }
  row.appendChild(button(doc, tr(ctx, 'V32_CLI_HEALTH_CHECK', 'Health check'),
    'v32-cli-health-check', install.id));
  return row;
}

function fieldNameOf(key) {
  const map = {
    V32_CLI_FIELD_NAME: 'name',
    V32_CLI_FIELD_PATH: 'path',
    V32_CLI_FIELD_VERSION: 'version',
    V32_CLI_FIELD_ADAPTER: 'adapter',
    V32_CLI_FIELD_CAPABILITIES: 'capabilities',
    V32_CLI_FIELD_HEALTH: 'health',
    V32_CLI_FIELD_AUTH: 'auth',
    V32_CLI_FIELD_RESUMABLE: 'resumable',
    V32_CLI_FIELD_FINGERPRINT: 'fingerprint',
    V32_CLI_FIELD_SOURCE: 'source',
    V32_CLI_FIELD_STALE: 'stale'
  };
  return map[key] ?? '';
}

/** Returns a DocumentFragment. No network access from this function. */
export function render(ctx) {
  const doc = (ctx && ctx.document) || globalThis.document;
  if (!doc || typeof doc.createDocumentFragment !== 'function') {
    throw new TypeError('cli-page: document is unavailable');
  }
  const frag = doc.createDocumentFragment();
  const { installs, scan, stats } = dataOf(ctx);

  const head = el(doc, 'header', 'page-head v32-cli-head');
  head.appendChild(el(doc, 'h1', null, tr(ctx, 'V32_CLI_TITLE', 'Agent CLI pool')));
  head.appendChild(el(doc, 'p', null, tr(ctx, 'V32_CLI_SUBTITLE',
    'Scan local agents, inspect capabilities and check health')));
  frag.appendChild(head);

  frag.appendChild(renderProgress(doc, ctx, scan));
  frag.appendChild(renderStats(doc, ctx, stats));
  frag.appendChild(renderActions(doc, ctx));
  frag.appendChild(renderForm(doc, ctx));

  const list = el(doc, 'section', 'v32-cli-list');
  list.setAttribute('data-testid', 'v32-cli-list');
  if (installs.length === 0) {
    list.appendChild(el(doc, 'p', 'v32-cli-empty', tr(ctx, 'V32_CLI_EMPTY', 'No CLI installed yet')));
  }
  for (const install of installs) list.appendChild(renderRow(doc, ctx, install));
  frag.appendChild(list);
  return frag;
}

function fieldsFrom(ctx, arg) {
  if (arg && typeof arg === 'object' && !Array.isArray(arg)) return { ...arg };
  const source = (ctx && ctx.event && ctx.event.target) || (ctx && ctx.actionEl) || null;
  if (!source || typeof source.closest !== 'function') return {};
  const form = source.closest('form');
  if (!form) return {};
  const out = {};
  for (const input of form.querySelectorAll('[data-field]')) {
    const name = input.getAttribute('data-field');
    if (name) out[name] = input.value ?? '';
  }
  return out;
}

async function callApi(ctx, method, url, body) {
  const api = ctx && ctx.v32Api;
  if (!api || typeof api[method] !== 'function') return { ok: false, code: 'V32_INVALID_INPUT' };
  const result = method === 'get' ? await api.get(url) : await api[method](url, body);
  if (ctx && typeof ctx.reloadV32 === 'function') await ctx.reloadV32();
  else if (ctx && typeof ctx.refresh === 'function') await ctx.refresh();
  return result;
}

export const actions = Object.freeze({
  'v32-cli-rescan': async (arg, ctx) => callApi(ctx, 'post', '/v32/cli/scan', { mode: 'quick' }),
  'v32-cli-full-scan': async (arg, ctx) => callApi(ctx, 'post', '/v32/cli/scan', { mode: 'full' }),
  'v32-cli-manual-add': async (arg, ctx) => callApi(ctx, 'post', '/v32/cli', fieldsFrom(ctx, arg)),
  'v32-cli-health-check': async (arg, ctx) => {
    const id = typeof arg === 'string' ? arg : (arg && arg.id);
    if (!id) return { ok: false, code: 'V32_INVALID_INPUT' };
    return callApi(ctx, 'post', `/v32/cli/${encodeURIComponent(id)}/health`, {});
  }
});
