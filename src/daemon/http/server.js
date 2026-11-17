/**
 * Desktop HTTP transport (I1.10a WP-2; requirement D-1/D-2, split doc 2.1
 * S-02). Loopback-only HTTP server carrying the desktop channel:
 *
 * - binds `127.0.0.1:0` (ephemeral port, loopback only, AC-27);
 * - generates a 32-byte random hex Bearer token; every data-plane request
 *   without the exact `Authorization: Bearer <token>` header gets `401` with a
 *   body that contains only the error code (D-1);
 * - the single exception (decision R, superseding decision M): the static face
 *   is public. A `GET` that resolves to a real file inside the static root and
 *   is not claimed by a handler needs no credential at all, because the
 *   WebView's ES module imports (`import './app.js'`) cannot carry either the
 *   header or a query. Every handler-owned path (`/ui/labels`, REST, SSE)
 *   stays Bearer-only, so `/ui/labels?token=` is still `401`;
 * - writes `<root>/.orch/desktop.json` (`{port, token, pid, generation,
 *   startedAt}`) atomically AFTER listen succeeds, and removes it on close
 *   (D-1; the path constant lives here because `src/persistence/paths.js` is
 *   frozen by D-10);
 * - serves `GET /ui/*` static resources read-only from `desktop/ui` (bundle
 *   `resources/desktop/ui` and the dev repository resolve to the same
 *   relative location);
 * - carries the WP-2 built-in routes: `GET /instances/:id/graph` (snapshot
 *   projection reusing `buildGraph`), the two SSE streams and the test-only
 *   `POST /__test__/graph/pulse`;
 * - exposes the S-02 tolerant seam: `registerRoutes(table)` /
 *   `registerLabels(fn)` accept injected handlers, with lazy dynamic
 *   `import('./routes.js')` (WP-3) / `import('./labels.js')` (WP-7) as the
 *   fallback. Until `routes.js` lands, REST endpoints that are not built in
 *   degrade to a structured `503 {"error":"NOT_READY"}` with no instance
 *   data; static resources and the desktop.json lifecycle stay available.
 *
 * Read-only discipline (AC-27): this layer never touches the store, never
 * appends spans and never saves state; the only write-capable route is
 * `POST /instances`, which belongs to WP-3 `routes.js` and reaches the
 * orchestrator exclusively through the existing `run.start` seam.
 *
 * Zero Chinese, zero npm dependencies, no second event source.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { writeJsonAtomic } from '../../persistence/atomic-write.js';
import { parseYaml } from '../../registry/yaml-lite.js';
import { GRAPHS } from '../../templates/index.js';
import { buildGraph } from '../graph.js';
import { openHost } from '../../adapter/host-open.js';
import { COMMAND_ERROR, ERROR_TEMPLATE, ESCALATION_LABEL } from '../../cli/labels.js';
import { createStreamHub, readBody } from './stream.js';

/**
 * I1.10b WP-2 (AC-23 / D-3): the escalation-continue route maps the existing
 * core error codes to frozen label keys. The raw codes stay daemon-side; the
 * UI branches on `messageKey` only (the mapping literals are frozen by the
 * A-10 key contract, same source as WP-1's label table).
 */
const ESC_MESSAGE_KEYS = Object.freeze({
  ESCALATION_NOT_PENDING: 'DRILL_ESC_ALREADY',
  INSTANCE_NOT_SUSPENDED: 'DRILL_ESC_NOT_SUSPENDED',
});

/**
 * Existing core error code -> CLI wording (the same source the CLI uses).
 *
 * Command-level codes (`ESCALATION_NOT_PENDING` / `INSTANCE_NOT_SUSPENDED`) live
 * only in `COMMAND_ERROR`, never in `ERROR_TEMPLATE`; looking them up there
 * made them fall through to `UNKNOWN_ERROR`. Resolve them from `COMMAND_ERROR`
 * first so the response carries the CLI's verbatim wording (D-3). No Chinese
 * literal lives in this layer: templates and state words both come from
 * `src/cli/labels.js`, the project's single source of user-visible Chinese.
 */
export function escalationErrorText(code, params = {}) {
  const isCommandError = typeof code === 'string'
    && Object.prototype.hasOwnProperty.call(COMMAND_ERROR, code);
  const known = isCommandError || (typeof code === 'string'
    && Object.prototype.hasOwnProperty.call(ERROR_TEMPLATE, code));
  const template = isCommandError ? COMMAND_ERROR[code]
    : known ? ERROR_TEMPLATE[code]
      : ERROR_TEMPLATE.UNKNOWN_ERROR;
  const filled = { ...params };
  if (isCommandError) {
    // The CLI fills `{id}` with the escalation id (instance id only for
    // INSTANCE_NOT_SUSPENDED); core params arrive as escalationId/instanceId.
    if (filled.id === undefined || filled.id === null) {
      filled.id = filled.escalationId ?? filled.instanceId ?? null;
    }
    // Mirror render.js COMMAND_ERROR_STATE_TABLE: `{state}` is a Chinese state
    // word there, so the daemon returns the wording the CLI actually prints.
    if (code === 'ESCALATION_NOT_PENDING' && typeof filled.state === 'string') {
      filled.state = ESCALATION_LABEL[filled.state] ?? filled.state;
    }
  }
  if (!known) filled.raw = code ?? null;
  return String(template).replace(/\{(\w+)\}/g, (raw, name) => {
    const value = filled[name];
    if (value === undefined || value === null) return raw;
    return String(value);
  });
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * `<root>/.orch/desktop.json` path constant (C-02: paths.js is frozen, so the
 * constant lives in this file per the split doc).
 */
export function desktopMetaPath(root) {
  return path.join(root, '.orch', 'desktop.json');
}

/** Static resources root: `desktop/ui`, resolved for both dev and bundle layouts. */
const DEFAULT_STATIC_ROOT = path.resolve(HERE, '..', '..', '..', 'desktop', 'ui');

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
});

const BODY_LIMIT_BYTES = 32 * 1024;

function sendJson(res, status, payload) {
  if (res.writableEnded || res.destroyed) return res;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
  return res;
}

function sendError(res, status, code) {
  return sendJson(res, status, { error: code });
}

/**
 * Matches `{method, pattern, handler}` table entries; `:name` segments are
 * captured as params. Returns params or `null`.
 */
export function matchPattern(pattern, pathname) {
  const expected = pattern.split('/').filter((segment) => segment.length > 0);
  const actual = pathname.split('/').filter((segment) => segment.length > 0);
  if (expected.length !== actual.length) return null;
  const params = {};
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index];
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(actual[index]);
    } else if (segment !== actual[index]) {
      return null;
    }
  }
  return params;
}

/**
 * @param {object} options
 * @param {string} options.root project root (desktop.json lives under it)
 * @param {object} options.orchestrator forwarded to the WP-3 routes seam
 * @param {object} options.bus the event bus (frame source, D-8)
 * @param {object} options.graph injected read-only readers:
 *   `{ loadState(id), replayEvents(id), readTraces(id) }`
 * @param {Function} [options.logger] async (level, message, extra) logger
 * @param {Function} [options.clock] injected clock (ms)
 * @param {string} [options.generation] core generation for desktop.json
 * @param {string} [options.startedAt] core start time for desktop.json
 * @param {string} [options.staticRoot] static resources root override (tests)
 */
export function createHttpServer({
  root,
  orchestrator,
  bus,
  graph,
  logger,
  clock,
  generation,
  startedAt,
  staticRoot,
} = {}) {
  if (typeof root !== 'string' || root.length === 0) {
    throw new TypeError('createHttpServer: root is required');
  }
  if (!graph || typeof graph.loadState !== 'function') {
    throw new TypeError('createHttpServer: graph.loadState is required');
  }
  const log = typeof logger === 'function' ? logger : () => Promise.resolve();
  const now = () => (typeof clock === 'function' ? clock() : Date.now());
  const uiRoot = path.resolve(staticRoot ?? DEFAULT_STATIC_ROOT);

  let server = null;
  let meta = null; // { port, token }
  let lazySeamsAttached = false;
  let fallbackDispatcher = null; // WP-3 routes.handle(req, res, url)

  /** @type {Array<{method: string, pattern: string, handler: Function}>} */
  const injectedRoutes = [];

  const hub = createStreamHub({ bus, buildGraphSnapshot, clock: now });

  // ---------------------------------------------------------------- S-02 seam

  /** Injects a handler table (`{method, pattern, handler}[]`); injected
   * entries take precedence over built-in routes. */
  function registerRoutes(table) {
    if (!Array.isArray(table)) {
      throw new TypeError('registerRoutes: table must be an array');
    }
    for (const entry of table) {
      if (!entry || typeof entry.method !== 'string' || typeof entry.pattern !== 'string'
        || typeof entry.handler !== 'function') {
        throw new TypeError('registerRoutes: entries must be {method, pattern, handler}');
      }
      injectedRoutes.push(entry);
    }
  }

  /** Injects the `GET /ui/labels` handler (WP-7). */
  function registerLabels(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('registerLabels: handler must be a function');
    }
    labelsHandler = fn;
  }

  let labelsHandler = null;

  /**
   * Lazy dynamic-import fallback for the S-02 seam: WP-7 labels.js (batch 1)
   * is already on disk and attaches itself; WP-3 routes.js (batch 3) will do
   * the same once it lands. A missing module degrades gracefully and never
   * blocks the channel.
   */
  async function attachLazySeams() {
    if (lazySeamsAttached) return;
    lazySeamsAttached = true;
    if (labelsHandler === null) {
      try {
        const mod = await import('./labels.js');
        if (typeof mod?.createLabelsRoute === 'function') {
          const route = mod.createLabelsRoute();
          if (route && typeof route.handler === 'function') {
            labelsHandler = route.handler;
          }
        }
      } catch {
        // WP-7 not landed: /ui/labels degrades to 503.
      }
    }
    if (fallbackDispatcher === null) {
      try {
        const mod = await import('./routes.js');
        const factory = typeof mod?.createRoutes === 'function' ? mod.createRoutes : mod?.default;
        if (typeof factory === 'function') {
          // Split doc §1.1: the drill data plane receives the shared stream hub
          // (contract A2 second call site) and the read-only instance readers
          // through this same S-02 lazy seam; the overlay semantics themselves
          // are untouched.
          const routes = factory({
            orchestrator,
            loadWorkflowDef: resolveWorkflowDef,
            root,
            hub,
            graph,
          });
          if (typeof routes?.handle === 'function') {
            fallbackDispatcher = (req, res, url) => routes.handle(req, res, url);
          } else if (Array.isArray(routes)) {
            registerRoutes(routes);
          }
        }
      } catch {
        // WP-3 not landed: REST degrades to structured 503.
      }
    }
  }

  // ------------------------------------------------------- graph snapshot source

  async function loadProjectWorkflowDef(ref) {
    if (typeof ref !== 'string' || ref.length === 0) return null;
    const safeRef = path.basename(ref);
    const file = path.join(root, '.orch', 'workflows', `${safeRef}.yaml`);
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch {
      return null;
    }
    try {
      const parsed = parseYaml(text);
      const def = parsed?.ok === true ? parsed.value : null;
      if (def && typeof def === 'object' && !Array.isArray(def)) return def;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Definition resolution order (D-3): project yaml by `workflowRef`, then
   * the built-in template, then an empty graph with `workflow.readable=false`.
   */
  async function resolveWorkflowDef(state) {
    const ref = typeof state?.workflowRef === 'string' && state.workflowRef.length > 0
      ? state.workflowRef
      : null;
    if (ref !== null) {
      const fromProject = await loadProjectWorkflowDef(ref);
      if (fromProject) return fromProject;
      if (Object.prototype.hasOwnProperty.call(GRAPHS, ref)) return GRAPHS[ref];
    }
    const template = typeof state?.template === 'string' && state.template.length > 0
      ? state.template
      : null;
    if (template !== null && Object.prototype.hasOwnProperty.call(GRAPHS, template)) {
      return GRAPHS[template];
    }
    return null;
  }

  async function resolveSubWorkflows(def, depth = 0) {
    const subWorkflows = new Map();
    if (!def || depth > 3) return subWorkflows;
    const refs = new Set();
    for (const node of Array.isArray(def.nodes) ? def.nodes : []) {
      const ref = typeof node?.workflow === 'string' && node.workflow.length > 0 ? node.workflow : null;
      if (ref !== null && !subWorkflows.has(ref)) refs.add(ref);
    }
    for (const ref of refs) {
      let child = await loadProjectWorkflowDef(ref);
      if (!child && Object.prototype.hasOwnProperty.call(GRAPHS, ref)) child = GRAPHS[ref];
      if (child) {
        subWorkflows.set(ref, child);
        const nested = await resolveSubWorkflows(child, depth + 1);
        for (const [nestedRef, nestedDef] of nested) {
          if (!subWorkflows.has(nestedRef)) subWorkflows.set(nestedRef, nestedDef);
        }
      }
    }
    return subWorkflows;
  }

  /** Builds the graph payload for one instance from the injected readers. */
  async function buildGraphSnapshot({ instanceId } = {}) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) {
      return { ok: false, code: 'NOT_FOUND' };
    }
    const loaded = await graph.loadState(instanceId);
    if (!loaded || loaded.ok !== true) {
      return { ok: false, code: loaded?.code ?? 'NOT_FOUND' };
    }
    const state = loaded.state ?? {};
    const replayed = await graph.replayEvents(instanceId);
    const events = Array.isArray(replayed)
      ? replayed
      : Array.isArray(replayed?.events)
        ? replayed.events
        : [];
    let traces = [];
    try {
      const read = await graph.readTraces(instanceId);
      if (Array.isArray(read?.spans)) traces = read.spans;
    } catch {
      traces = [];
    }
    const def = await resolveWorkflowDef(state);
    const subWorkflows = await resolveSubWorkflows(def);
    const graphPayload = buildGraph({
      state,
      workflowDef: def,
      roles: null, // absent registry -> declared roles stay known (D-3)
      traces,
      events,
      subWorkflows,
    });
    hub.applyTestOverlay(graphPayload, instanceId);
    graphPayload.rev = Math.max(graphPayload.rev, hub.testRev(instanceId));
    return { ok: true, graph: graphPayload, raw: state };
  }

  // ---------------------------------------------------------------- routing

  /** Parses `req.url`; `null` when it is not a valid URL (answers 404 later). */
  function safeUrl(rawUrl) {
    try {
      return new URL(rawUrl ?? '/', 'http://127.0.0.1');
    } catch {
      return null;
    }
  }

  /**
   * Whether the request is owned by a handler instead of the static branch:
   * the injected table (S-02), the WP-2 built-ins and the whole-path WP-3
   * dispatcher. `/ui/labels` also starts with `/ui/`, so the public static
   * exception must never be decided by a path prefix (decision R).
   */
  function claimedByHandler(method, pathname) {
    for (const entry of injectedRoutes) {
      if (entry.method !== method) continue;
      if (matchPattern(entry.pattern, pathname) !== null) return true;
    }
    if (method === 'GET') {
      if (pathname === '/ui/labels') return true;
      if (pathname === '/instances/stream') return true;
      if (matchPattern('/instances/:id/graph/stream', pathname) !== null) return true;
      if (matchPattern('/instances/:id/graph', pathname) !== null) return true;
    }
    if (method === 'POST' && pathname === '/__test__/graph/pulse') return true;
    // I1.10b WP-2 drill data plane: the two POST endpoints below are
    // handler-owned (D-3), so the public static exception can never claim them.
    if (method === 'POST' && matchPattern('/instances/:id/escalations/:escalationId/continue', pathname) !== null) return true;
    if (method === 'POST' && pathname === '/hosts/open') return true;
    // Decision W: window-side probe events are handler-owned too, so the
    // public static exception can never swallow them.
    if (method === 'POST' && pathname === '/__test__/window-probe') return true;
    // A whole-path dispatcher takes every request before the static branch.
    return fallbackDispatcher !== null;
  }

  /** Whether `pathname` resolves to an existing file inside the static root. */
  async function isStaticFile(pathname) {
    const target = resolveStaticPath(pathname);
    if (target === null) return false;
    try {
      const stat = await fs.stat(target);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Decision R: the static face is public. A `GET` that resolves to a real
   * file inside the static root and is not claimed by a handler is allowed
   * without any credential — the WebView's `import './app.js'` cannot carry the
   * header, and a query would only survive the first hop. The data plane is
   * unchanged: the Bearer header stays the only accepted credential for every
   * handler-owned path (`/ui/labels`, REST, SSE), and `?token=` is not one.
   */
  async function authorized(req, url) {
    if (req.method === 'GET' && url !== null
      && !claimedByHandler(req.method, url.pathname)
      && await isStaticFile(url.pathname)) {
      return true;
    }
    if (!meta) return false;
    const header = req.headers.authorization ?? '';
    return header === `Bearer ${meta.token}`;
  }

  // ------------------------------------------------- drill data plane (I1.10b WP-2)
  //
  // D-10 authorized dispatch additions: the only write route of the iteration
  // (escalation continue, forwarding the existing orchestrator seam) and the
  // host-open route (config-driven adapter). No state is written here directly.

  /**
   * `POST /instances/:id/escalations/:escalationId/continue`: forwards the
   * existing `resolveEscalation({decision:'retry'})` seam (decision C — the
   * same core path as `orch escalate resolve --decision retry`); this layer
   * never mutates state fields itself (AC-22 architecture gate).
   */
  async function handleEscalationContinue(res, instanceId, escalationId) {
    let result = null;
    try {
      result = await orchestrator.resolveEscalation({ instanceId, escalationId, decision: 'retry' });
    } catch (err) {
      result = {
        ok: false,
        code: typeof err?.code === 'string' && /^[A-Z0-9_]+$/.test(err.code) ? err.code : 'UNKNOWN_ERROR',
        params: { cause: err?.message ?? String(err) },
      };
    }
    if (result && result.ok === true) {
      sendJson(res, 200, { ok: true, escalationId: result.escalationId ?? escalationId });
      return;
    }
    const code = result?.code ?? 'UNKNOWN_ERROR';
    const messageKey = Object.prototype.hasOwnProperty.call(ESC_MESSAGE_KEYS, code)
      ? ESC_MESSAGE_KEYS[code]
      : null;
    sendJson(res, messageKey !== null ? 409 : 422, {
      ok: false,
      code,
      ...(messageKey !== null ? { messageKey } : {}),
      // J-2 (adjudication): structural state word for the frozen DRILL_ESC_ALREADY {state}
      // placeholder. The value comes from the CLI labels (the single Chinese
      // source); the verbatim COMMAND_ERROR `message`, the four existing fields
      // and HTTP 409 are all unchanged. The UI fills {state} from this field
      // instead of a key that is not in the frozen 63-key table.
      ...(code === 'ESCALATION_NOT_PENDING' ? { stateLabel: ESCALATION_LABEL.resolved } : {}),
      message: escalationErrorText(code, result?.params ?? {}),
    });
  }

  /**
   * `POST /hosts/open` (§3.7): body `{instanceId, sessionId}`. The host id is
   * read from the instance state (`sessions[].hostId`); the daemon layer never
   * branches on a host name. The adapter is config-driven and answers the
   * contract error shapes (`HOST_UNSUPPORTED`, `DSH_SPAWN_FAILED`).
   */
  async function handleHostsOpen(req, res) {
    let body;
    try {
      body = await readBody(req, BODY_LIMIT_BYTES);
    } catch {
      sendError(res, 413, 'PAYLOAD_TOO_LARGE');
      return;
    }
    let params = null;
    try {
      params = body.length > 0 ? JSON.parse(body.toString('utf8')) : null;
    } catch {
      params = null;
    }
    if (!params || typeof params !== 'object' || Array.isArray(params)
      || typeof params.instanceId !== 'string' || params.instanceId.length === 0
      || typeof params.sessionId !== 'string' || params.sessionId.length === 0) {
      sendError(res, 400, 'IPC_BAD_PARAMS');
      return;
    }
    let hostId = null;
    try {
      const loaded = await graph.loadState(params.instanceId);
      if (loaded && loaded.ok === true) {
        const sessions = Array.isArray(loaded.state?.sessions) ? loaded.state.sessions : [];
        const session = sessions.find((entry) => entry?.sessionId === params.sessionId) ?? null;
        hostId = typeof session?.hostId === 'string' && session.hostId.length > 0 ? session.hostId : null;
      }
    } catch {
      hostId = null;
    }
    if (hostId === null) {
      sendError(res, 404, 'NOT_FOUND');
      return;
    }
    let result;
    try {
      result = await openHost({
        root,
        hostId,
        instanceId: params.instanceId,
        sessionId: params.sessionId,
        env: process.env,
        clock: now,
      });
    } catch (err) {
      result = { ok: false, code: 'DSH_SPAWN_FAILED', message: `跳转失败 · ${err?.message ?? String(err)}` };
    }
    sendJson(res, 200, result);
  }

  async function handleRequest(req, res) {
    try {
      const url = safeUrl(req.url);
      if (!(await authorized(req, url))) {
        sendError(res, 401, 'UNAUTHORIZED');
        return;
      }
      if (url === null) {
        sendError(res, 404, 'NOT_FOUND');
        return;
      }
      const pathname = url.pathname;

      // 1. Injected handler table (S-02) wins over everything built in.
      for (const entry of injectedRoutes) {
        if (entry.method !== req.method) continue;
        const params = matchPattern(entry.pattern, pathname);
        if (params !== null) {
          await entry.handler(req, res, url, params);
          return;
        }
      }

      // 2. Built-in WP-2 routes.
      if (req.method === 'GET' && pathname === '/ui/labels') {
        if (labelsHandler !== null) {
          labelsHandler(req, res);
          return;
        }
        sendError(res, 503, 'NOT_READY');
        return;
      }
      if (req.method === 'GET' && pathname === '/instances/stream') {
        hub.handleListStream(res);
        return;
      }
      const graphStreamMatch = req.method === 'GET'
        ? matchPattern('/instances/:id/graph/stream', pathname)
        : null;
      if (graphStreamMatch !== null) {
        const sinceRaw = url.searchParams.get('sinceRev');
        const sinceRev = sinceRaw === null ? undefined : Number(sinceRaw);
        await hub.handleGraphStream(res, {
          instanceId: graphStreamMatch.id,
          sinceRev: Number.isFinite(sinceRev) ? sinceRev : undefined,
        });
        return;
      }
      const graphMatch = req.method === 'GET'
        ? matchPattern('/instances/:id/graph', pathname)
        : null;
      if (graphMatch !== null) {
        const built = await buildGraphSnapshot({ instanceId: graphMatch.id });
        if (!built || built.ok !== true) {
          const code = built?.code === 'STATE_CORRUPT' ? 'STATE_CORRUPT' : 'NOT_FOUND';
          sendError(res, code === 'STATE_CORRUPT' ? 422 : 404, code);
          return;
        }
        sendJson(res, 200, built.graph);
        return;
      }
      if (req.method === 'POST' && pathname === '/__test__/graph/pulse') {
        if (process.env.NODE_ENV !== 'test') {
          sendError(res, 404, 'NOT_FOUND');
          return;
        }
        await hub.handlePulse(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/__test__/window-probe') {
        // Decision W: on an external http origin the WebView has no Tauri IPC,
        // so the window posts the very same probe event it built. The daemon
        // only mirrors it; the shell copies it into the --probe file.
        if (process.env.NODE_ENV !== 'test') {
          sendError(res, 404, 'NOT_FOUND');
          return;
        }
        let event = null;
        try {
          event = JSON.parse(await readBody(req, 65536));
        } catch {
          event = null;
        }
        if (event === null || typeof event !== 'object' || Array.isArray(event)) {
          sendError(res, 400, 'BAD_REQUEST');
          return;
        }
        const sink = path.join(root, '.orch', 'window-probe.jsonl');
        await fs.mkdir(path.dirname(sink), { recursive: true });
        await fs.appendFile(sink, `${JSON.stringify(event)}\n`, 'utf8');
        sendJson(res, 200, { ok: true });
        return;
      }

      // I1.10b WP-2 drill data plane dispatch additions (D-3): escalation
      // continue (the single write route) and host open.
      const continueMatch = req.method === 'POST'
        ? matchPattern('/instances/:id/escalations/:escalationId/continue', pathname)
        : null;
      if (continueMatch !== null) {
        await handleEscalationContinue(res, continueMatch.id, continueMatch.escalationId);
        return;
      }
      if (req.method === 'POST' && pathname === '/hosts/open') {
        await handleHostsOpen(req, res);
        return;
      }

      // 3. Lazy WP-3 routes dispatcher (absent in batch 2 -> skip).
      if (fallbackDispatcher !== null) {
        await fallbackDispatcher(req, res, url);
        return;
      }

      // 4. Static UI resources.
      if (req.method === 'GET' && (pathname === '/ui' || pathname.startsWith('/ui/'))) {
        await serveStatic(res, pathname === '/ui' ? '/ui/' : pathname);
        return;
      }

      // 5. Structured degradation for routes owned by WP-3 (S-02): the seam
      //    is in place but routes.js has not landed yet in this batch, so the
      //    exact WP-3 paths answer a data-free 503. Anything else is unknown.
      const wp3Owned =
        (pathname === '/instances' && (req.method === 'GET' || req.method === 'POST')) ||
        (pathname === '/workflows' && req.method === 'GET');
      sendError(res, wp3Owned ? 503 : 404, wp3Owned ? 'NOT_READY' : 'NOT_FOUND');
    } catch (err) {
      if (!res.writableEnded && !res.destroyed) {
        sendError(res, 500, 'INTERNAL_ERROR');
      }
      Promise.resolve(log('warn', 'DESKTOP_HANDLER_FAILED', {
        cause: err?.message ?? String(err),
      })).catch(() => {});
    }
  }

  /**
   * Single source of truth for the static branch: maps `/ui/*` to a file path
   * inside `uiRoot`, `null` outside it. Traversal protection lives here and is
   * shared by the auth exception and the serving path, so the query token can
   * never reach a file the Bearer path would refuse to serve.
   */
  function resolveStaticPath(pathname) {
    if (pathname !== '/ui' && !pathname.startsWith('/ui/')) return null;
    const rel = pathname.slice('/ui/'.length);
    const target = path.resolve(uiRoot, rel.length > 0 ? rel : 'index.html');
    if (target !== uiRoot && !target.startsWith(uiRoot + path.sep)) return null;
    return target;
  }

  async function serveStatic(res, pathname) {
    const target = resolveStaticPath(pathname);
    if (target === null) {
      sendError(res, 404, 'NOT_FOUND');
      return;
    }
    let content;
    try {
      content = await fs.readFile(target);
    } catch {
      sendError(res, 404, 'NOT_FOUND');
      return;
    }
    const type = CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(content);
  }

  // ---------------------------------------------------------------- lifecycle

  function listenOnce() {
    return new Promise((resolve) => {
      const onError = (error) => {
        server.off('listening', onListening);
        resolve({ ok: false, error });
      };
      const onListening = () => {
        server.off('error', onError);
        resolve({ ok: true });
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(0, '127.0.0.1');
    });
  }

  async function listen() {
    await attachLazySeams();
    server = http.createServer((req, res) => {
      handleRequest(req, res);
    });
    const first = await listenOnce();
    if (!first.ok) {
      server = null;
      return { ok: false, code: 'DESKTOP_LISTEN_FAILED', params: { cause: first.error?.message ?? null } };
    }
    const port = server.address().port;
    const token = crypto.randomBytes(32).toString('hex');
    meta = { port, token };
    try {
      // D-1: listen first, then write desktop.json; a write failure fails the
      // desktop channel only and never touches the IPC main channel.
      await writeJsonAtomic(desktopMetaPath(root), {
        port,
        token,
        pid: process.pid,
        generation: generation ?? null,
        startedAt: startedAt ?? new Date(now()).toISOString(),
      });
    } catch (err) {
      await closeListener();
      meta = null;
      return {
        ok: false,
        code: 'DESKTOP_META_WRITE_FAILED',
        params: { cause: err?.message ?? String(err) },
      };
    }
    return { ok: true, port, token };
  }

  async function closeListener() {
    const current = server;
    server = null;
    if (!current) return;
    await new Promise((resolve) => current.close(() => resolve()));
  }

  async function close() {
    hub.close();
    await closeListener();
    meta = null;
    // D-1: desktop.json is removed when the channel closes (including
    // core.stop and SIGTERM, which both route through server.close()).
    try {
      await fs.rm(desktopMetaPath(root), { force: true });
    } catch {
      // removal failure must not break the shutdown path
    }
  }

  return {
    listen,
    close,
    registerRoutes,
    registerLabels,
    // Test/diagnostic accessor (not part of the frozen surface).
    get meta() {
      return meta === null ? null : { ...meta };
    },
  };
}
