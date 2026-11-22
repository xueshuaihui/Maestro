/**
 * mountApp boot smoke (beta.2 regression guard).
 *
 * Why this file exists: `mountApp` is the only entry the real window uses
 * (`index.html` -> `mountApp` -> `app.start()`), and until beta.2 nothing in
 * the suite called it. A single identifier resolved from the wrong scope threw
 * on the first paint, which silently stopped `start()` from ever loading the
 * label table: the window stayed on an empty list forever while every
 * `createApp`-level test stayed green. The gate only caught it in the real
 * macOS shell (AC-26).
 *
 * So this test drives the real mount path against a minimal DOM shim and pins
 * the two properties AC-26 depends on:
 *   1. a first paint with no label table must not throw;
 *   2. once labels + instances arrive, the window announces the rendered rows.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { labelKeysPayload } from '../../src/daemon/http/labels.js';

const LABELS = labelKeysPayload().keys;

/** Minimal selector match used by `FakeNode.closest`. */
function matchesSelector(node, selector) {
  const attr = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(selector);
  if (attr) {
    const value = node.attributes?.[attr[1]];
    if (value === undefined) return false;
    return attr[2] === undefined ? true : value === attr[2];
  }
  if (selector.startsWith('.')) {
    return String(node.className ?? '').split(/\s+/).includes(selector.slice(1));
  }
  if (selector.startsWith('#')) {
    return node.attributes?.id === selector.slice(1);
  }
  return String(node.tagName) === selector;
}

/** Depth-first walk over the fake tree. */
function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/** First node carrying `data-action="<action>"` (optionally matching `data-arg`). */
function actionNode(root, action, arg) {
  let found = null;
  walk(root, (node) => {
    if (found !== null) return;
    if (node.attributes?.['data-action'] !== action) return;
    if (arg !== undefined && node.attributes?.['data-arg'] !== String(arg)) return;
    found = node;
  });
  return found;
}

/** Fire the recorded click listener with `node` as the event target. */
function click(host, node) {
  const handlers = host._listeners?.get('click') ?? [];
  assert.ok(handlers.length > 0, 'click listener was never registered on the host');
  const event = { target: node, preventDefault() {}, stopPropagation() {} };
  for (const handler of handlers) handler(event);
}

/** Minimal element: enough for the renderers, no layout, no CSS. */
class FakeNode {
  constructor(tag) {
    this.tagName = String(tag ?? 'div');
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this.className = '';
    this._text = '';
    this.parentNode = null;
    this.classList = {
      _set: new Set(),
      add: (...names) => names.forEach((name) => this.classList._set.add(name)),
      remove: (...names) => names.forEach((name) => this.classList._set.delete(name)),
      contains: (name) => this.classList._set.has(name) || String(this.className).split(/\s+/).includes(name),
      toggle: (name, on) => {
        const next = on === undefined ? !this.classList._set.has(name) : on;
        if (next) this.classList.add(name);
        else this.classList.remove(name);
      },
    };
  }

  get firstChild() { return this.children[0] ?? null; }
  get lastChild() { return this.children[this.children.length - 1] ?? null; }

  appendChild(child) {
    if (child && child.__fragment) {
      for (const item of child.children.slice()) this.appendChild(item);
      return child;
    }
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  append(...kids) { kids.forEach((kid) => this.appendChild(kid)); }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    return child;
  }

  replaceChildren(...kids) {
    this.children = [];
    this._text = '';
    kids.forEach((kid) => this.appendChild(kid));
  }

  insertBefore(child) { return this.appendChild(child); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, handler) {
    if (!this._listeners) this._listeners = new Map();
    const list = this._listeners.get(type) ?? [];
    list.push(handler);
    this._listeners.set(type, list);
  }

  removeEventListener(type, handler) {
    const list = this._listeners?.get(type) ?? [];
    const at = list.indexOf(handler);
    if (at >= 0) list.splice(at, 1);
  }

  focus() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }

  /** Subset of `closest`: `.class`, `#id`, `[attr]`, `[attr="value"]`. */
  closest(selector) {
    if (typeof selector !== 'string' || selector.length === 0) return null;
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0 }; }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join('');
  }

  get innerHTML() { return ''; }
  set innerHTML(value) { this._text = String(value); }
}

/** Install the global surface `mountApp` reads, then import it lazily. */
async function mountWith(io, { labels = null } = {}) {  const doc = {
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (value) => {
      const node = new FakeNode('#text');
      node._text = String(value);
      return node;
    },
    createDocumentFragment: () => {
      const frag = new FakeNode('#fragment');
      frag.__fragment = true;
      return frag;
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    activeElement: null,
    body: new FakeNode('body'),
  };

  const host = new FakeNode('div');
  globalThis.document = doc;
  globalThis.window = {
    __MAESTRO_DESKTOP__: { project: { root: '/tmp/maestro-mount-smoke', view: 'instances' } },
    document: doc,
    location: { reload() {} },
  };
  globalThis.window.EventSource = class {
    constructor() {}
    close() {}
    addEventListener() {}
  };
  globalThis.EventSource = globalThis.window.EventSource;
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  globalThis.fetch = async () => ({ status: 500, json: async () => null });
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};

  // The shim stays installed for the rest of this file: `mountApp` repaints on
  // `paint()` after the test regains control, so tearing the globals down here
  // would break the very call the test is about to make. Node runs each test
  // file in its own process, so nothing leaks into other suites.
  const { mountApp } = await import('../../desktop/ui/app.js');
  const mounted = mountApp({
    root: host,
    labels,
    project: { root: '/tmp/maestro-mount-smoke', view: 'instances' },
    io,
  });
  return { mounted, host };
}

test('mountApp：标签表未到达时首帧不抛（不阻断 start 加载文案）', async () => {
  const probes = [];
  const io = {
    getLabels: async () => ({ status: 500, body: null }),
    getInstances: async () => ({ status: 200, body: { items: [{ instanceId: 'INST-001', state: 'running' }] } }),
    getWorkflows: async () => ({ status: 200, body: { items: [] } }),
    openStream: () => ({ close() {}, addEventListener() {} }),
    probe: (event) => probes.push(event),
  };
  const { mounted } = await mountWith(io, { labels: null });
  // The first paint already happened inside mountApp; reaching here means it
  // did not throw. A throw there is what starved the real window of labels.
  await mounted.app.start();
  assert.equal(mounted.app.hasLabels(), false);
  // The window still explains itself instead of painting a blank list.
  assert.ok(probes.some((event) => event.event === 'rows-empty'), '空列表必须留下 rows-empty 诊断');
  const diag = probes.filter((event) => event.event === 'rows-empty').pop();
  assert.equal(diag.ready, false);
  assert.equal(diag.view, 'instances');
});

test('mountApp：文案与实例到位后，窗口自己宣告渲染出的行（AC-26 口径）', async () => {
  const probes = [];
  const items = [
    {
      instanceId: 'INST-001', template: 'code-loop', state: 'running', phase: 'coding',
      pendingEscalations: 1, health: { level: 'attention' },
      nodes: [{ nodeId: 'T-001', state: 'done' }, { nodeId: 'T-002', state: 'running' }],
    },
    {
      instanceId: 'INST-002', template: 'single', state: 'completed', phase: 'done',
      pendingEscalations: 0, health: { level: 'ended' },
      nodes: [{ nodeId: 'T-001', state: 'done' }],
    },
  ];
  const io = {
    getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
    getInstances: async () => ({ status: 200, body: { items } }),
    getWorkflows: async () => ({ status: 200, body: { items: [{ id: 'code-loop', title: 'code-loop' }] } }),
    openStream: () => ({ close() {}, addEventListener() {} }),
    probe: (event) => probes.push(event),
  };
  const { mounted, host } = await mountWith(io, { labels: null });
  await mounted.app.start();
  mounted.paint();

  assert.equal(mounted.app.hasLabels(), true);
  assert.equal(mounted.app.state().view, 'instances');

  const rows = probes.filter((event) => event.event === 'rows');
  assert.ok(rows.length > 0, '渲染出列表后必须发 rows 探针');
  const last = rows[rows.length - 1];
  assert.equal(last.rows.length, 2);
  for (const line of last.rows) {
    assert.equal(typeof line, 'string');
    assert.ok(line.length > 0);
  }
  // The shell really rendered: a sidebar plus a content area exist in the host.
  assert.equal(host.children.length > 0, true);
  assert.ok(host.children.some((child) => child.className.includes('app-shell')), '未挂载外壳骨架');
});

test('mountApp：侧栏九项都能跳到对应视图（无死链、不抛异常）', async () => {
  const probes = [];
  const io = {
    getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
    getInstances: async () => ({
      status: 200,
      body: { items: [{ instanceId: 'INST-001', template: 'code-loop', state: 'running', phase: 'coding', nodes: [] }] },
    }),
    getWorkflows: async () => ({ status: 200, body: { items: [{ id: 'code-loop', title: 'code-loop' }] } }),
    getQueue: async () => ({ status: 200, body: { items: [], totals: {} } }),
    getAssets: async () => ({ status: 200, body: { items: [] } }),
    getOccupancy: async () => ({ status: 200, body: { rows: [], skipped: [] } }),
    getCanvas: async () => ({ status: 200, body: { nodes: [], edges: [] } }),
    getEvidence: async () => ({ status: 200, body: { items: [] } }),
    getPrefs: async () => ({ status: 200, body: { escalation: true, anomaly: true, approval: true, handoff: true } }),
    openStream: () => ({ close() {}, addEventListener() {} }),
    probe: (event) => probes.push(event),
  };
  const { mounted, host } = await mountWith(io, { labels: null });
  await mounted.app.start();
  mounted.paint();

  const views = ['queue', 'notifications', 'assets', 'occupancy', 'canvas', 'governance', 'settings', 'instances'];
  for (const view of views) {
    const entry = actionNode(host, 'nav', view);
    assert.ok(entry !== null, `侧栏缺少入口：${view}`);
    click(host, entry);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(mounted.app.state().view, view, `点击「${view}」后视图没有切换`);
    assert.ok(
      host.children.some((child) => String(child.className).includes('app-shell')),
      `跳到「${view}」后外壳骨架丢失`,
    );
  }

  // 「新建实例」不在侧栏，是列表页的主操作：回到列表后必须能点到。
  const create = actionNode(host, 'nav', 'new');
  assert.ok(create !== null, '实例列表页缺少「新建实例」入口');
  click(host, create);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(mounted.app.state().view, 'new', '点击「新建实例」后没有进入新建页');
  assert.equal(mounted.app.state().newPanel.open, true, '新建页没有打开表单状态');
  assert.equal(mounted.app.state().newPanel.template, 'code-loop', '新建页没有预选第一个工作流');
});

test('侧栏导航按钮跨重绘复用同一节点（按下与抬起不会被换掉）', async () => {
  const io = {
    getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
    getInstances: async () => ({
      status: 200,
      body: { items: [{ instanceId: 'INST-001', template: 'code-loop', state: 'running', phase: 'coding', nodes: [] }] },
    }),
    getWorkflows: async () => ({ status: 200, body: { items: [] } }),
    getQueue: async () => ({ status: 200, body: { items: [], totals: {} } }),
    openStream: () => ({ close() {}, addEventListener() {} }),
    probe: () => {},
  };
  const { mounted, host } = await mountWith(io, { labels: null });
  await mounted.app.start();
  mounted.paint();

  const before = actionNode(host, 'nav', 'queue');
  assert.ok(before !== null, '侧栏缺少队列入口');
  mounted.paint();
  mounted.paint();
  const after = actionNode(host, 'nav', 'queue');

  assert.equal(
    after,
    before,
    '一次重绘就换掉了侧栏按钮：按下与抬起落在不同节点，浏览器不会派发 click',
  );
});

test('侧栏按下即切换视图（不等 click，实时帧重绘也抢不走这次操作）', async () => {
  const io = {
    getLabels: async () => ({ status: 200, body: { keys: LABELS } }),
    getInstances: async () => ({ status: 200, body: { items: [] } }),
    getWorkflows: async () => ({ status: 200, body: { items: [] } }),
    getQueue: async () => ({ status: 200, body: { items: [], totals: {} } }),
    openStream: () => ({ close() {}, addEventListener() {} }),
    probe: () => {},
  };
  const { mounted, host } = await mountWith(io, { labels: null });
  await mounted.app.start();
  mounted.paint();

  const node = actionNode(host, 'nav', 'queue');
  assert.ok(node !== null, '侧栏缺少队列入口');
  const handlers = host._listeners?.get('pointerdown') ?? [];
  assert.ok(handlers.length > 0, 'pointerdown listener was never registered');
  for (const handler of handlers) handler({ button: 0, target: node, preventDefault() {}, stopPropagation() {} });

  assert.equal(mounted.app.state().view, 'queue', '按下侧栏没有切换视图');
});
