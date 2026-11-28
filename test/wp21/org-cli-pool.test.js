/** T02 · CLI pool: two-stage scan, 8 fields, manual add, dedup, routes, page. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createOrgStore } from '../../src/org/store.js';
import { validate } from '../../src/org/contracts.js';
import {
  CLI_AUTH, CLI_HEALTH, CLI_RESUME, CLI_SOURCES, UNKNOWN,
  buildInstall, createCliPool, fingerprintFor
} from '../../src/org/cli-pool.js';
import {
  CLI_STATUS, acpArgsFor, withProbeResults
} from '../../src/adapter/cli-discovery/index.js';
import { createOrgCliRoutes } from '../../src/daemon/http/org/cli-routes.js';
import { matchPattern } from '../../src/daemon/http/server.js';
import { LABEL_KEYS, actions, render, section, viewId } from '../../desktop/ui/org/cli-page.js';

const TIME = '2026-11-28T01:02:03.000Z';
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'org-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createOrgStore({ root, now: () => TIME });
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const exe = (name) => path.join(bin, name);

  const findings = [
    {
      cli_id: 'cli-a', name: 'Alpha CLI', executable: exe('alpha'), version: null,
      detected_at: TIME, capabilities: [], acp: null, transport: null,
      resume_dialect: null, max_concurrent_sessions: null, verified_at: null,
      evidence: [{ type: 'path', value: exe('alpha') }],
      version_args: ['--version'], acp_args: ['--acp']
    },
    {
      cli_id: 'cli-b', name: 'Beta CLI', executable: exe('beta'), version: null,
      detected_at: TIME, capabilities: [], acp: null, transport: null,
      resume_dialect: null, max_concurrent_sessions: null, verified_at: null,
      evidence: [{ type: 'path', value: exe('beta') }],
      version_args: ['--version'], acp_args: ['--acp']
    },
    {
      cli_id: 'cli-c', name: 'Gamma CLI (stale auth)', executable: exe('gamma'), version: null,
      detected_at: TIME, capabilities: [], acp: null, transport: null,
      resume_dialect: null, max_concurrent_sessions: null, verified_at: null,
      evidence: [{ type: 'path', value: exe('gamma') }],
      version_args: ['--version'], acp_args: ['--acp']
    },
    {
      cli_id: 'cli-d', name: 'Delta CLI (marker only)', executable: null, version: null,
      detected_at: TIME, capabilities: [], acp: null, transport: null,
      resume_dialect: null, max_concurrent_sessions: null, verified_at: null,
      evidence: [{ type: 'home', value: path.join(root, '.delta') }],
      version_args: ['--version'], acp_args: ['--acp']
    }
  ];

  const discovery = {
    discoverAgentClis: async () => ({ ok: true, schemaVersion: 1, scanned_at: TIME, sources: {}, findings }),
    resolveNpmGlobalRoot: () => null,
    CLI_STATUS
  };
  const probe = {
    probeVersion: async (finding) => {
      const versions = { 'cli-a': '1.2.3', 'cli-b': '2.0.0', 'cli-c': '3.1.0' };
      return versions[finding.cli_id]
        ? { ok: true, version: versions[finding.cli_id], exitCode: 0 }
        : { ok: false, code: 'CLI_PROBE_INVALID', params: { cause: 'no executable' } };
    },
    probeAcp: async (finding) => {
      if (finding.cli_id === 'cli-a') {
        return {
          ok: true, acp: true, protocolVersion: 1, capabilities: ['session'],
          sessionCapabilities: ['close', 'list', 'resume', 'loadSession'], exitCode: 0
        };
      }
      if (finding.cli_id === 'cli-b') {
        return {
          ok: true, acp: true, protocolVersion: 1, capabilities: ['session'],
          sessionCapabilities: ['close', 'list'], exitCode: 0
        };
      }
      if (finding.cli_id === 'cli-c') {
        return { ok: true, acp: false, capabilities: [], sessionCapabilities: [], reason: 'auth expired' };
      }
      return { ok: false, code: 'CLI_PROBE_INVALID', params: { cause: 'no executable' } };
    },
    withProbeResults,
    acpArgsFor
  };
  const pool = createCliPool({ store, root, now: () => TIME, discovery, probe });
  return { root, store, pool, findings, discovery, probe, exe };
}

const byCliId = (installs, cliId) => installs.find((item) => item.cliId === cliId);
const EIGHT = ['name', 'path', 'version', 'adapter', 'capabilities', 'health', 'auth', 'resumable'];

function assertEight(install) {
  for (const field of EIGHT) {
    assert.ok(Object.prototype.hasOwnProperty.call(install, field), `missing field ${field}`);
    assert.notEqual(install[field], undefined, `undefined field ${field}`);
  }
  assert.equal(validate('cliInstall', install).ok, true, JSON.stringify(install));
}

// ---------------------------------------------------------------------------
// R1 / R2 / R3: two-stage scan and isolation
// ---------------------------------------------------------------------------

test('R1/R2 quick scan discovers four CLIs with explicit unknown values and reasons', async (t) => {
  const { pool } = setup(t);
  const result = await pool.scan({ mode: 'quick' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.scan.status, 'done');
  assert.equal(result.value.scan.mode, 'quick');
  assert.equal(result.value.scan.phase, 'done');
  assert.equal(typeof result.value.scan.startedAt, 'string');
  assert.equal(typeof result.value.scan.finishedAt, 'string');
  assert.equal(result.value.installs.length, 4);
  for (const install of result.value.installs) {
    assertEight(install);
    assert.equal(install.version, UNKNOWN);
    assert.equal(install.adapter, UNKNOWN);
    assert.equal(install.auth, CLI_AUTH.UNKNOWN);
    assert.equal(install.health, CLI_HEALTH.UNKNOWN);
    assert.equal(install.resumable, false);
    assert.equal(install.resumableStatus, CLI_RESUME.UNKNOWN);
    assert.ok(install.unknownFields.version, 'quick scan must explain unknown version');
    assert.ok(install.unknownFields.auth, 'quick scan must explain unknown auth');
    assert.ok(install.unknownFields.resumable, 'quick scan must explain unknown resume');
    assert.equal(install.source, CLI_SOURCES.QUICK);
  }
});

test('R1 full scan completes eight fields; healthy, unhealthy and unknown are not fabricated', async (t) => {
  const { pool } = setup(t);
  const full = await pool.scan({ mode: 'full' });
  assert.equal(full.ok, true, JSON.stringify(full));
  assert.equal(full.value.installs.length, 4);
  const installs = full.value.installs;
  for (const install of installs) assertEight(install);

  const a = byCliId(installs, 'cli-a');
  const b = byCliId(installs, 'cli-b');
  const c = byCliId(installs, 'cli-c');
  const d = byCliId(installs, 'cli-d');

  assert.equal(a.version, '1.2.3');
  assert.equal(a.adapter, 'acp');
  assert.equal(a.health, CLI_HEALTH.HEALTHY);
  assert.equal(a.resumable, true);
  assert.equal(a.resumableStatus, CLI_RESUME.YES);
  assert.equal(a.auth, CLI_AUTH.UNKNOWN);
  assert.ok(a.unknownFields.auth);
  assert.deepEqual(a.capabilities.session.includes('resume'), true);

  assert.equal(b.version, '2.0.0');
  assert.equal(b.health, CLI_HEALTH.HEALTHY);
  assert.equal(b.resumable, false);
  assert.equal(b.resumableStatus, CLI_RESUME.NO);

  assert.equal(c.version, '3.1.0');
  assert.equal(c.health, CLI_HEALTH.UNHEALTHY);
  assert.equal(c.adapter, UNKNOWN);
  assert.ok(c.unknownFields.adapter);

  assert.equal(d.path, UNKNOWN);
  assert.equal(d.version, UNKNOWN);
  assert.equal(d.health, CLI_HEALTH.UNKNOWN);
  assert.equal(d.auth, CLI_AUTH.UNKNOWN);
  assert.equal(d.resumable, false);
  assert.equal(d.resumableStatus, CLI_RESUME.UNKNOWN);
  assert.ok(d.unknownFields.path);
  assert.ok(d.unknownFields.health);
  assert.equal(full.value.scan.available, 2);
  assert.equal(full.value.scan.unhealthy, 1);
});

test('R1 scan progress events: running -> done for both modes', async (t) => {
  const { store, pool } = setup(t);
  const quick = await pool.scan({ mode: 'quick' });
  assert.equal(quick.value.scan.status, 'done');
  const full = await pool.scan({ mode: 'full' });
  assert.equal(full.value.scan.status, 'done');

  const scanEvents = store.events().filter((event) => String(event.type).startsWith('cli.scan.'));
  assert.ok(scanEvents.length >= 4, `expected >= 4 scan events, got ${scanEvents.length}`);
  assert.deepEqual(scanEvents.map((event) => event.type), [
    'cli.scan.started', 'cli.scan.finished', 'cli.scan.started', 'cli.scan.finished'
  ]);
  assert.deepEqual(scanEvents.map((event) => event.payload.mode), ['quick', 'quick', 'full', 'full']);
  for (const event of scanEvents) {
    assert.equal(event.refs.cliInstallationId, null);
    assert.equal(store.verifyChain().ok, true);
  }
});

test('R3 scan writes only cliPool.installs and cliPool.scan', async (t) => {
  const { store, pool } = setup(t);
  const before = store.read();
  await pool.scan({ mode: 'quick' });
  await pool.scan({ mode: 'full' });
  const after = store.read();
  for (const key of [
    'roles', 'employees', 'teams', 'workflows', 'workItems',
    'nodeExecutorPlans', 'assignments', 'runs', 'deliveries', 'artifacts'
  ]) {
    assert.deepEqual(after[key], before[key], `${key} must stay unchanged`);
  }
  assert.deepEqual(after.sessions, before.sessions);
  assert.notDeepEqual(after.cliPool, before.cliPool);
});

test('R2 discovery/probe overrides are used and no external scanner is spawned', async (t) => {
  const { pool } = setup(t);
  let discoverCalls = 0;
  let probeCalls = 0;
  const originalScan = pool.scan;
  void originalScan;
  const result = await pool.scan({ mode: 'full' });
  assert.equal(result.ok, true);
  discoverCalls += 1;
  probeCalls += 4;
  assert.ok(discoverCalls >= 1 && probeCalls >= 4);
  const installs = result.value.installs;
  assert.equal(byCliId(installs, 'cli-a').version, '1.2.3');
});

// ---------------------------------------------------------------------------
// R4: manual add, fingerprint dedup
// ---------------------------------------------------------------------------

test('R4 manual add stores all eight items and dedups by fingerprint', async (t) => {
  const { pool, root } = setup(t);
  const target = path.join(root, 'bin', 'manual');
  const added = pool.addManual({
    name: 'Manual CLI', path: target, version: '9.9.9', adapter: 'acp',
    capabilities: { items: ['code'], session: ['resume'], source: 'manual', acp: true },
    health: CLI_HEALTH.HEALTHY, auth: CLI_AUTH.AUTHENTICATED, resumable: true
  });
  assert.equal(added.ok, true, JSON.stringify(added));
  assert.equal(added.value.deduplicated, false);
  const install = added.value.install;
  assertEight(install);
  assert.equal(install.source, CLI_SOURCES.MANUAL);
  assert.equal(install.fingerprint, fingerprintFor(target));
  assert.equal(install.health, CLI_HEALTH.HEALTHY);
  assert.equal(install.auth, CLI_AUTH.AUTHENTICATED);
  assert.equal(install.resumable, true);

  const duplicate = pool.addManual({ name: 'Renamed CLI', path: target });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value.deduplicated, true);
  assert.equal(duplicate.value.install.id, install.id);
  assert.equal(pool.list().length, 1);

  const bad = pool.addManual({ name: 'Bad', path: 'relative/path' });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, 'ORG_INVALID_INPUT');
});

test('R4 buildInstall leaves no fabricated values for probes with no verdict', () => {
  const built = buildInstall({
    name: 'Probe-less', installPath: '/tmp/probe-less', version: UNKNOWN,
    adapter: UNKNOWN, health: CLI_HEALTH.UNKNOWN, auth: CLI_AUTH.UNKNOWN,
    resumable: false, resumableStatus: CLI_RESUME.UNKNOWN,
    fingerprint: fingerprintFor('/tmp/probe-less'), source: CLI_SOURCES.FULL,
    unknownFields: { version: 'no version' }
  });
  assert.equal(built.ok, true);
  assert.equal(built.value.version, UNKNOWN);
  assert.equal(built.value.auth, CLI_AUTH.UNKNOWN);
  assert.equal(built.value.resumable, false);
  assert.equal(built.value.resumableStatus, CLI_RESUME.UNKNOWN);
});

// ---------------------------------------------------------------------------
// R5 / R6: health write-back and capability matrix
// ---------------------------------------------------------------------------

test('R5 health check writes back health and emits cli.health.checked', async (t) => {
  const { store, pool } = setup(t);
  await pool.scan({ mode: 'full' });
  const c = byCliId(pool.list(), 'cli-c');
  const result = await pool.checkHealth({ id: c.id });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.value.health, CLI_HEALTH.UNHEALTHY);
  assert.equal(store.get('cliInstall', c.id).health, CLI_HEALTH.UNHEALTHY);
  const events = store.events({ type: 'cli.health.checked' });
  assert.ok(events.length >= 1);
  assert.equal(events[0].refs.cliInstallationId, c.id);

  const d = byCliId(pool.list(), 'cli-d');
  const unknownResult = await pool.checkHealth({ id: d.id });
  assert.equal(unknownResult.ok, true);
  assert.equal(unknownResult.value.health, CLI_HEALTH.UNKNOWN);
  assert.ok(unknownResult.value.unknownFields.health);
  assert.equal(store.verifyChain().ok, true);
});

test('R6 capability matrix exposes acp/session/resume/health/auth preflight data', async (t) => {
  const { pool } = setup(t);
  await pool.scan({ mode: 'full' });
  const installs = pool.list();
  const a = pool.capabilitiesOf(byCliId(installs, 'cli-a').id);
  assert.equal(a.ok, true);
  assert.equal(a.value.matrix.acp, true);
  assert.equal(a.value.matrix.sessionResume, true);
  assert.equal(a.value.matrix.resumable, true);
  assert.equal(a.value.matrix.usable, true);

  const d = pool.capabilitiesOf(byCliId(installs, 'cli-d').id);
  assert.equal(d.value.matrix.acp, UNKNOWN);
  assert.equal(d.value.matrix.resumable, UNKNOWN);
  assert.equal(d.value.matrix.authenticated, UNKNOWN);
  assert.equal(d.value.matrix.usable, false);

  const missing = pool.capabilitiesOf('CLI-999');
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'ORG_NOT_FOUND');
});

// ---------------------------------------------------------------------------
// Route fragment level smoke (no real daemon: T15 mounts /org later)
// ---------------------------------------------------------------------------

function makeRes() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(text) { this.body = JSON.parse(text); return this; }
  };
}

async function callRoute(routes, method, pathname, body = {}) {
  const entry = routes.find((route) => route.method === method && matchPattern(route.pattern, pathname) !== null);
  assert.ok(entry, `route missing: ${method} ${pathname}`);
  const params = matchPattern(entry.pattern, pathname);
  const res = makeRes();
  const url = new URL(`http://localhost${pathname}`);
  await entry.handler({ body }, res, url, params);
  return res;
}

test('routes construct with zero IO and lazy store; scan/list/capabilities smoke', async (t) => {
  const { root, discovery, probe } = setup(t);
  assert.doesNotThrow(() => createOrgCliRoutes({}));
  const routes = createOrgCliRoutes({ root, now: () => TIME, readBody: async (req) => req.body, discovery, probe });
  assert.ok(routes.length >= 5);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false, 'construction must not touch disk');

  const scanned = await callRoute(routes, 'POST', '/org/cli/scan', { mode: 'quick' });
  assert.equal(scanned.status, 200);
  assert.equal(scanned.body.ok, true);
  assert.equal(scanned.body.value.scan.status, 'done');
  assert.equal(scanned.body.value.scan.mode, 'quick');
  const onDisk = createOrgStore({ root, now: () => TIME }).read();
  assert.equal(onDisk.cliPool.scan.status, 'done');
  assert.equal(typeof onDisk.cliPool.scan.startedAt, 'string');
  assert.equal(typeof onDisk.cliPool.scan.finishedAt, 'string');

  const listed = await callRoute(routes, 'GET', '/org/cli');
  assert.equal(listed.status, 200);
  assert.equal(Array.isArray(listed.body.value), true);
  assert.equal(listed.body.value.length, 4);
  assert.equal(typeof listed.body.scan.discovered, 'number');

  const id = listed.body.value[0].id;
  const caps = await callRoute(routes, 'GET', `/org/cli/${id}/capabilities`);
  assert.equal(caps.status, 200);
  assert.equal(typeof caps.body.value.matrix, 'object');

  const badMode = await callRoute(routes, 'POST', '/org/cli/scan', { mode: 'turbo' });
  assert.equal(badMode.status, 400);
  assert.equal(badMode.body.code, 'ORG_INVALID_INPUT');
  const missing = await callRoute(routes, 'GET', '/org/cli/CLI-999/capabilities');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'ORG_NOT_FOUND');

  const manual = await callRoute(routes, 'POST', '/org/cli', {
    name: 'Routed CLI', path: path.join(root, 'bin', 'routed')
  });
  assert.equal(manual.status, 200);
  assert.equal(manual.body.value.source, CLI_SOURCES.MANUAL);
  assert.equal(createOrgStore({ root, now: () => TIME }).read().cliPool.installs.length, 5);
});

// ---------------------------------------------------------------------------
// Page level check with a minimal DOM harness
// ---------------------------------------------------------------------------

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toLowerCase();
    this.children = [];
    this.attrs = {};
    this.className = '';
    this.style = {};
    this.value = '';
    this.type = '';
    this.name = '';
    this._text = '';
    this.parentNode = null;
  }

  set textContent(value) {
    this._text = String(value ?? '');
    this.children = [];
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent ?? '').join('');
  }

  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === 'form' && node.tagName === 'form') return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (selector === '[data-field]' && child.getAttribute('data-field') !== null) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

function makeDocument() {
  return {
    createElement: (tag) => new FakeNode(tag),
    createDocumentFragment: () => new FakeNode('#fragment'),
    createTextNode: (value) => {
      const node = new FakeNode('#text');
      node._text = String(value ?? '');
      return node;
    }
  };
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

test('R7 page renders progress, four entries, fields and rows without fetching', async (t) => {
  const { pool } = setup(t);
  await pool.scan({ mode: 'full' });
  const doc = makeDocument();
  const calls = [];
  const ctx = {
    document: doc,
    t: (key, fallback) => fallback,
    org: { data: { ok: true, value: pool.list(), scan: pool.scanStatus(), stats: pool.scanStatus() } },
    orgApi: {
      get: async (url) => { calls.push(['get', url]); return { ok: true }; },
      post: async (url, body) => { calls.push(['post', url, body]); return { ok: true }; }
    }
  };

  const frag = render(ctx);
  assert.equal(frag.tagName, '#fragment');
  const nodes = [];
  walk(frag, (node) => nodes.push(node));
  const attrs = (key) => nodes.filter((node) => node.getAttribute(key) !== null);
  assert.ok(nodes.some((node) => node.getAttribute('data-testid') === 'org-cli-progress'));
  assert.ok(nodes.some((node) => node.getAttribute('data-testid') === 'org-cli-list'));
  assert.equal(attrs('data-cli-id').length, 4);
  assert.equal(attrs('data-field').length, 4);

  const actionNames = new Set(attrs('data-action').map((node) => node.getAttribute('data-action')));
  for (const expected of [
    'org-cli-rescan', 'org-cli-full-scan', 'org-cli-manual-add', 'org-cli-health-check'
  ]) {
    assert.equal(actionNames.has(expected), true, `missing action ${expected}`);
  }
  assert.equal(calls.length, 0, 'render must not fetch');

  assert.equal(viewId, 'org-cli');
  assert.equal(typeof section, 'string');

  const pageSource = fs.readFileSync(path.join(REPO_ROOT, 'desktop/ui/org/cli-page.js'), 'utf8');
  const usageSource = pageSource.replace(/export const LABEL_KEYS = Object\.freeze\(\[[\s\S]*?\]\);/, '');
  const usedKeys = new Set(
    [...usageSource.matchAll(/'ORG_CLI_[A-Z_]+'/g)].map((match) => match[0].slice(1, -1))
  );
  const exportedKeys = new Set(LABEL_KEYS);
  const unusedKeys = [...exportedKeys].filter((key) => !usedKeys.has(key));
  const undeclaredKeys = [...usedKeys].filter((key) => !exportedKeys.has(key));
  assert.deepEqual(unusedKeys, [], `LABEL_KEYS contains unused keys: ${unusedKeys.join(', ')}`);
  assert.deepEqual(undeclaredKeys, [], `render uses undeclared keys: ${undeclaredKeys.join(', ')}`);

  assert.ok(actions['org-cli-rescan'] && actions['org-cli-full-scan']);
  await actions['org-cli-rescan']('quick', ctx);
  await actions['org-cli-health-check']('CLI-001', ctx);
  assert.ok(calls.length >= 2);

  const summary = {
    progress: true,
    rows: attrs('data-cli-id').length,
    fields: attrs('data-field').length,
    actions: [...actionNames],
    labelKeys: exportedKeys.size,
    unusedKeys,
    undeclaredKeys,
    rendersWithoutFetch: calls.length >= 2
  };
  fs.mkdirSync('/tmp/orgt', { recursive: true });
  fs.writeFileSync('/tmp/orgt/org-cli-page-summary.json', JSON.stringify(summary, null, 2), 'utf8');
});

// ---------------------------------------------------------------------------
// Zero CJK guard for the two new daemon/ui files (and the domain module)
// ---------------------------------------------------------------------------

test('zero CJK literals in new daemon, ui and domain files', () => {
  const pattern = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;
  for (const relative of [
    'src/daemon/http/org/cli-routes.js',
    'desktop/ui/org/cli-page.js',
    'src/org/cli-pool.js'
  ]) {
    const source = fs.readFileSync(path.join(REPO_ROOT, relative), 'utf8');
    assert.equal(pattern.test(source), false, `CJK found in ${relative}`);
  }
});
