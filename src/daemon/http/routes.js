/**
 * REST routes for the desktop channel (I1.10a WP-3; requirement D-2, split
 * doc 2.1 S-02). Owns exactly the three endpoints the WP-2 channel degraded
 * to `503 NOT_READY`: `GET /instances`, `POST /instances`, `GET /workflows`.
 *
 * The S-02 seam: `createRoutes({...})` returns a `{method, pattern, handler}`
 * table. `http/server.js` attaches it two ways without any cross-package file
 * change: tests may inject it via `registerRoutes(table)`, and production
 * takes the lazy dynamic `import('./routes.js')` fallback which registers the
 * returned table. Injected table entries are matched before the WP-2 built-in
 * routes, so once this module lands the structured 503 paths are taken over.
 *
 * Read-only discipline (AC-27 / AC-05): every `startRun` hit lives in the
 * `POST /instances` handler below and reaches the orchestrator exclusively
 * through the existing `orchestrator.startRun` seam (`cwd` = project root,
 * `earlyReturn: true`, body limit 32KB). The list route only consumes the
 * existing `listInstances` + `getStatus` surface and never recomputes health:
 * `level` / `reasons` are read straight from `state.health` as returned by the
 * orchestrator; reason placeholder arguments are derived read-only from the
 * same snapshot (mirroring `src/core/status-text.js` deriveHealthReasonVars).
 *
 * `GET /instances/:id/graph` is NOT re-implemented here: the WP-2 channel
 * already carries it as a built-in route (graph snapshot via `buildGraph`).
 *
 * Zero Chinese literals (labels come from `src/cli/labels.js`, the single
 * Chinese source, per split doc C-03), zero npm dependencies, no host branch.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { readBody } from './stream.js';
import { ERROR_TEMPLATE, ROLE_LABEL, TEMPLATE_LABEL } from '../../cli/labels.js';
import { parseYaml } from '../../registry/yaml-lite.js';
import { GRAPHS } from '../../templates/index.js';
import { buildGraph } from '../graph.js';
import {
  buildConnectionPanel,
  buildDrill,
  buildEscalationList,
  buildNodeDetail,
  buildSubflowGraph,
} from '../drill.js';

/** D-2: request body cap for `POST /instances`. */
const BODY_LIMIT_BYTES = 32 * 1024;

/** Terminal state codes for node progress; `done` settles a node. */
const DONE_NODE_STATE = 'done';

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
  return res;
}

/** Error-only JSON body (mirrors the built-in route shape `{error: code}`). */
function sendError(res, status, code) {
  return sendJson(res, status, { error: code });
}

/** Literal placeholder replacement; a missing argument keeps `{xx}` verbatim. */
function fillTemplate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (raw, name) => {
    const value = params?.[name];
    if (value === undefined || value === null) return raw;
    return String(value);
  });
}

/**
 * Renders an orchestrator failure with the existing `ERROR_TEMPLATE` wording
 * (the same source the CLI uses). Unknown codes fall back to
 * `ERROR_TEMPLATE.UNKNOWN_ERROR` with the raw code, mirroring `renderError`.
 */
function errorText(code, params = {}) {
  const template = typeof code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_TEMPLATE, code)
    ? ERROR_TEMPLATE[code]
    : ERROR_TEMPLATE.UNKNOWN_ERROR;
  const filled = { ...params };
  if (!Object.prototype.hasOwnProperty.call(ERROR_TEMPLATE, code)) filled.raw = code ?? null;
  return fillTemplate(template, filled);
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Derives the placeholder arguments for one health reason code from the
 * snapshot's existing fields. Mirrors `src/core/status-text.js`
 * `deriveHealthReasonVars` rule by rule (locked on both sides by the I1.9
 * render regression tests); degrades to empty strings, never throws.
 */
function deriveHealthReasonVars(snapshot, code) {
  const provided = snapshot?.health?.reasonVars?.[code];
  if (provided && typeof provided === 'object') return provided;

  const nodes = arrayOrEmpty(snapshot?.nodes);
  const sessions = arrayOrEmpty(snapshot?.sessions);
  const handoffs = arrayOrEmpty(snapshot?.handoffs);
  const nodeIdOf = (node) => node?.nodeId ?? node?.id ?? '';
  const roleWordOf = (id) => {
    const node = nodes.find((item) => nodeIdOf(item) === id) ?? null;
    return ROLE_LABEL[node?.roleId] ?? '';
  };
  const connectionOf = (handoff) =>
    `${roleWordOf(handoff?.fromNodeId ?? handoff?.edge?.from ?? '')}\u2192${roleWordOf(
      handoff?.toNodeId ?? handoff?.edge?.to ?? '',
    )}`;

  switch (code) {
    case 'node_timeout':
    case 'p90_exceeded': {
      const node = nodes.find((item) => item?.state === 'running') ?? null;
      return { nodeId: node ? nodeIdOf(node) : '' };
    }
    case 'session_crash': {
      const session = sessions.find((item) => item?.quarantined === true) ?? null;
      return { sessionId: session ? (session?.sessionId ?? session?.id ?? '') : '' };
    }
    case 'role_unavailable': {
      const session =
        sessions.find((item) => item?.state === 'escalated' && item?.quarantined !== true) ?? null;
      return { role: session ? roleWordOf(session?.nodeId) : '' };
    }
    case 'connection_rejected': {
      const handoff = handoffs.find((item) => item?.state === 'rejected') ?? null;
      return { connection: handoff ? connectionOf(handoff) : '' };
    }
    case 'connection_expired': {
      const handoff = handoffs.find((item) => item?.state === 'expired') ?? null;
      return { connection: handoff ? connectionOf(handoff) : '' };
    }
    case 'handoff_ttl_half': {
      const handoff = handoffs.find((item) => item?.state === 'pending') ?? null;
      return { handoffId: handoff?.handoffId ?? '' };
    }
    default:
      return {};
  }
}

/** `health` payload for one instance: level verbatim, reasons as `{code, ...vars}`. */
function healthPayload(snapshot) {
  const health = snapshot?.health ?? {};
  const rawReasons = arrayOrEmpty(health.reasons);
  return {
    level: typeof health.level === 'string' && health.level.length > 0 ? health.level : null,
    reasons: rawReasons.map((reason) => {
      if (reason !== null && typeof reason === 'object') return { ...reason };
      return { code: reason, ...deriveHealthReasonVars(snapshot, reason) };
    }),
  };
}

/** D-2 list item projection for one readable instance. */
function projectItem(instanceId, snapshot) {
  const nodes = arrayOrEmpty(snapshot?.nodes);
  const done = nodes.filter((node) => node?.state === DONE_NODE_STATE).length;
  const template =
    typeof snapshot?.template === 'string' && snapshot.template.length > 0 ? snapshot.template : null;
  return {
    instanceId,
    template,
    templateTitle: template !== null && Object.prototype.hasOwnProperty.call(TEMPLATE_LABEL, template)
      ? TEMPLATE_LABEL[template]
      : template,
    phase: typeof snapshot?.state === 'string' ? snapshot.state : null,
    progress: { done, total: nodes.length },
    pending: {
      escalations: Number.isInteger(snapshot?.pendingEscalations) ? snapshot.pendingEscalations : 0,
      approvals: Number.isInteger(snapshot?.pendingApprovals) ? snapshot.pendingApprovals : 0,
    },
    health: healthPayload(snapshot),
    updatedAt: typeof snapshot?.updatedAt === 'string' ? snapshot.updatedAt : null,
    readable: true,
  };
}

function unreadableItem(entry) {
  return {
    instanceId: entry?.instanceId ?? null,
    template: entry?.template ?? null,
    templateTitle: null,
    phase: null,
    progress: null,
    pending: null,
    health: null,
    updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : null,
    readable: false,
  };
}

/**
 * Resolves the project root for `POST /instances` (`cwd` = project root):
 * an explicit `root` option wins; otherwise the daemon process argv is scanned
 * for the `--project` flag that `serve-entry.js` requires (production launch
 * shape; the fallback exists because the S-02 lazy import passes only
 * `{orchestrator, loadWorkflowDef}`).
 */
function resolveProjectRoot(explicit) {
  if (typeof explicit === 'string' && explicit.length > 0) return path.resolve(explicit);
  const argv = process.argv;
  for (let index = 0; index < argv.length - 1; index += 1) {
    const token = argv[index];
    if (token !== '--project' && token !== '--p') continue;
    const value = argv[index + 1];
    if (typeof value === 'string' && value.length > 0 && !value.startsWith('--')) {
      return path.resolve(value);
    }
  }
  return null;
}

/**
 * @param {object} options
 * @param {object} options.orchestrator the existing orchestrator surface
 *   (`listInstances` / `getStatus` / `startRun`)
 * @param {Function} [options.loadWorkflowDef] S-02 seam parameter, injected
 *   by `http/server.js` (`resolveWorkflowDef`); the drill/subflow routes
 *   resolve definitions through it.
 * @param {string} [options.root] project root override (tests; production
 *   resolves it from the daemon argv)
 * @param {object} [options.hub] the stream hub created by `http/server.js`
 *   (split doc §1.1: injected through the same S-02 seam mechanism). The
 *   drill route calls its existing `applyTestOverlay(graph, instanceId)` on
 *   the graph payload it builds (contract A2, second call site) so the pulse
 *   seam reaches the drill projections on the shared in-memory overlay.
 * @param {object} [options.graph] read-only readers `{loadState, replayEvents,
 *   readTraces}` injected by `http/server.js`; drill routes read the instance
 *   exclusively through them (no health recompute, no store write).
 * @returns {Array<{method: string, pattern: string, handler: Function}>}
 */
export function createRoutes({ orchestrator, loadWorkflowDef, root, hub, graph } = {}) {
  void loadWorkflowDef; // reserved by the frozen seam signature; see docblock
  const projectRoot = resolveProjectRoot(root);
  if (!orchestrator || typeof orchestrator.startRun !== 'function') {
    throw new TypeError('createRoutes: orchestrator.startRun is required');
  }
  const drillReaders = graph !== null && typeof graph === 'object'
    && typeof graph.loadState === 'function'
    ? graph
    : null;
  const resolveDef = typeof loadWorkflowDef === 'function' ? loadWorkflowDef : null;

  /** `GET /instances`: `listInstances` + `getStatus` only, health verbatim. */
  async function handleList(res) {
    const listed = await orchestrator.listInstances();
    if (!listed || listed.ok !== true || !Array.isArray(listed.items)) {
      const code = listed?.code ?? 'STORE_READ_FAILED';
      sendJson(res, 500, { error: code, message: errorText(code, listed?.params ?? {}) });
      return res;
    }
    const items = [];
    for (const entry of listed.items) {
      if (!entry || entry.readable !== true) {
        items.push(unreadableItem(entry));
        continue;
      }
      let snapshot = null;
      try {
        const status = await orchestrator.getStatus({ instanceId: entry.instanceId });
        snapshot = status?.ok === true ? (status.snapshot ?? null) : null;
      } catch {
        snapshot = null;
      }
      if (!snapshot) {
        items.push(unreadableItem(entry));
        continue;
      }
      items.push(projectItem(entry.instanceId, snapshot));
    }
    sendJson(res, 200, { items });
    return res;
  }

  /** `GET /workflows`: the three runnable built-in templates (D-2). */
  function handleWorkflows(res) {
    const items = Object.keys(TEMPLATE_LABEL).map((id) => ({ id, title: TEMPLATE_LABEL[id] }));
    sendJson(res, 200, { items });
    return res;
  }

  /**
   * `POST /instances` (D-2): the only write route on the desktop channel.
   * Forwards `{cwd: projectRoot, template, task, earlyReturn: true}` to the
   * existing `orchestrator.startRun` seam; success answers `{instanceId}`,
   * failure answers the existing error code plus its `ERROR_TEMPLATE` wording.
   */
  async function handleCreate(req, res) {
    let body;
    try {
      body = await readBody(req, BODY_LIMIT_BYTES);
    } catch (err) {
      sendJson(res, 413, { error: err?.code ?? 'PAYLOAD_TOO_LARGE' });
      return res;
    }
    let params = null;
    try {
      params = body.length > 0 ? JSON.parse(body.toString('utf8')) : null;
    } catch {
      params = null;
    }
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS', message: errorText('IPC_BAD_PARAMS') });
      return res;
    }
    if (projectRoot === null) {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS', message: errorText('IPC_BAD_PARAMS') });
      return res;
    }
    const task = typeof params.task === 'string' ? params.task : '';
    const template = typeof params.template === 'string' && params.template.length > 0
      ? params.template
      : null;
    const started = await orchestrator.startRun({
      cwd: projectRoot,
      task,
      template,
      earlyReturn: true,
    });
    if (started && started.ok === true && typeof started.instanceId === 'string') {
      sendJson(res, 200, { instanceId: started.instanceId });
      return res;
    }
    const code = started?.code ?? 'UNKNOWN_ERROR';
    sendJson(res, 422, {
      ok: false,
      error: code,
      message: errorText(code, started?.params ?? {}),
    });
    return res;
  }

  // ------------------------------------------------- drill data plane (I1.10b WP-2)
  //
  // Five read-only GET routes (split doc §1.1, requirement D-3). Every handler
  // assembles inputs from the injected read-only readers and the existing
  // projections only; no state write, no event publish, no trace append.

  /** Project-yaml then built-in-template resolution for an arbitrary ref. */
  async function loadRefWorkflowDef(ref) {
    if (typeof ref !== 'string' || ref.length === 0) return null;
    const safeRef = path.basename(ref);
    if (safeRef.length === 0 || projectRoot === null) {
      return Object.prototype.hasOwnProperty.call(GRAPHS, ref) ? GRAPHS[ref] : null;
    }
    const file = path.join(projectRoot, '.orch', 'workflows', `${safeRef}.yaml`);
    let def = null;
    try {
      const text = await fs.readFile(file, 'utf8');
      const parsed = parseYaml(text);
      if (parsed?.ok === true && parsed.value !== null && typeof parsed.value === 'object'
        && !Array.isArray(parsed.value)) {
        def = parsed.value;
      }
    } catch {
      def = null;
    }
    if (!def && Object.prototype.hasOwnProperty.call(GRAPHS, ref)) def = GRAPHS[ref];
    return def;
  }

  /**
   * Child-definition resolution for the graph payload. Mirrors the graph
   * snapshot path's semantics (project yaml by ref, then built-in template,
   * depth limit 3) because that resolver lives inside `http/server.js` and is
   * not importable; the behavior is identical rule by rule.
   */
  async function resolveChildWorkflows(def, depth = 0) {
    const subWorkflows = new Map();
    if (!def || depth > 3) return subWorkflows;
    const refs = new Set();
    for (const node of Array.isArray(def.nodes) ? def.nodes : []) {
      const ref = typeof node?.workflow === 'string' && node.workflow.length > 0 ? node.workflow : null;
      if (ref !== null && !subWorkflows.has(ref)) refs.add(ref);
    }
    for (const ref of refs) {
      const child = await loadRefWorkflowDef(ref);
      if (child) {
        subWorkflows.set(ref, child);
        const nested = await resolveChildWorkflows(child, depth + 1);
        for (const [nestedRef, nestedDef] of nested) {
          if (!subWorkflows.has(nestedRef)) subWorkflows.set(nestedRef, nestedDef);
        }
      }
    }
    return subWorkflows;
  }

  /** Read-only instance load through the injected readers; null on failure. */
  async function loadInstanceState(instanceId) {
    if (drillReaders === null) return null;
    try {
      const loaded = await drillReaders.loadState(instanceId);
      if (!loaded || loaded.ok !== true) return { code: loaded?.code ?? 'NOT_FOUND' };
      return { code: null, state: loaded.state ?? {} };
    } catch {
      return { code: 'NOT_FOUND' };
    }
  }

  /** Read-only event replay with the same normalization as the graph route. */
  async function loadInstanceEvents(instanceId) {
    if (drillReaders === null || typeof drillReaders.replayEvents !== 'function') return [];
    try {
      const replayed = await drillReaders.replayEvents(instanceId);
      return Array.isArray(replayed)
        ? replayed
        : Array.isArray(replayed?.events)
          ? replayed.events
          : [];
    } catch {
      return [];
    }
  }

  /** Read-only trace read; failures degrade to an empty span list. */
  async function loadInstanceTraces(instanceId) {
    if (drillReaders === null || typeof drillReaders.readTraces !== 'function') return [];
    try {
      const read = await drillReaders.readTraces(instanceId);
      return Array.isArray(read?.spans) ? read.spans : [];
    } catch {
      return [];
    }
  }

  /**
   * Shared drill assembly: snapshot + definition + events + traces -> graph
   * payload -> the existing shared test overlay (contract A2, second call
   * site; call only, overlay semantics untouched). Returns null when the
   * readers are not wired (degrades to 503 like the S-02 seam).
   */
  async function assembleDrillContext(instanceId) {
    if (drillReaders === null || resolveDef === null) return null;
    const loaded = await loadInstanceState(instanceId);
    if (loaded.code !== null) return { code: loaded.code };
    const state = loaded.state;
    const def = await resolveDef(state);
    const [events, traces] = await Promise.all([
      loadInstanceEvents(instanceId),
      loadInstanceTraces(instanceId),
    ]);
    const subWorkflows = await resolveChildWorkflows(def);
    const graphPayload = buildGraph({
      state,
      workflowDef: def,
      roles: null, // absent registry -> declared roles stay known (D-3)
      traces,
      events,
      subWorkflows,
    });
    if (hub && typeof hub.applyTestOverlay === 'function') {
      hub.applyTestOverlay(graphPayload, instanceId);
    }
    return { code: null, state, def, events, graphPayload };
  }

  function drillUnavailable(res) {
    sendJson(res, 503, { error: 'NOT_READY' });
    return res;
  }

  function instanceMissing(res, code) {
    sendError(res, code === 'STATE_CORRUPT' ? 422 : 404, code === 'STATE_CORRUPT' ? 'STATE_CORRUPT' : 'NOT_FOUND');
    return res;
  }

  /** `GET /instances/:id/drill/:roleId` (§3.3). */
  async function handleDrill(res, params) {
    const context = await assembleDrillContext(params.id);
    if (context === null) return drillUnavailable(res);
    if (context.code !== null) return instanceMissing(res, context.code);
    const payload = buildDrill({
      state: context.state,
      workflowDef: context.def,
      roleId: params.roleId,
      roles: null,
      graph: context.graphPayload,
    });
    sendJson(res, 200, payload);
    return res;
  }

  /** `GET /instances/:id/nodes/:nodeId` (§3.4). */
  async function handleNodeDetail(res, params, url) {
    const context = await assembleDrillContext(params.id);
    if (context === null) return drillUnavailable(res);
    if (context.code !== null) return instanceMissing(res, context.code);
    void url;
    const workspace = projectRoot === null
      ? null
      : path.join(projectRoot, '.orch', 'instances', params.id, 'workspace');
    const payload = await buildNodeDetail({
      state: context.state,
      workflowDef: context.def,
      events: context.events,
      handoffs: Array.isArray(context.state.handoffs) ? context.state.handoffs : [],
      nodeId: params.nodeId,
      workspace,
      cwd: typeof context.state.cwd === 'string' ? context.state.cwd : projectRoot,
    });
    sendJson(res, 200, payload);
    return res;
  }

  /** `GET /instances/:id/connections/:edgeId` (§3.5). */
  async function handleConnectionPanel(res, params) {
    const context = await assembleDrillContext(params.id);
    if (context === null) return drillUnavailable(res);
    if (context.code !== null) return instanceMissing(res, context.code);
    const payload = buildConnectionPanel({
      state: context.state,
      workflowDef: context.def,
      handoffs: Array.isArray(context.state.handoffs) ? context.state.handoffs : [],
      edgeId: params.edgeId,
      graph: context.graphPayload,
    });
    if (payload === null) {
      sendError(res, 404, 'NOT_FOUND');
      return res;
    }
    sendJson(res, 200, payload);
    return res;
  }

  /** `GET /instances/:id/escalations` (§3.6). */
  async function handleEscalationList(res, params) {
    const loaded = await loadInstanceState(params.id);
    if (loaded === null) return drillUnavailable(res);
    if (loaded.code !== null) return instanceMissing(res, loaded.code);
    sendJson(res, 200, buildEscalationList({ state: loaded.state }));
    return res;
  }

  /** `GET /instances/:id/subworkflow/:ref` (D-3). */
  async function handleSubflowGraph(res, params, url) {
    const loaded = await loadInstanceState(params.id);
    if (loaded === null) return drillUnavailable(res);
    if (loaded.code !== null) return instanceMissing(res, loaded.code);
    const visitedParam = url?.searchParams?.get('visited') ?? '';
    const visited = visitedParam.length > 0
      ? visitedParam.split(',').filter((ref) => ref.length > 0)
      : [];
    const def = await loadRefWorkflowDef(params.ref);
    const payload = buildSubflowGraph({
      workflowDef: def,
      ref: params.ref,
      visited,
      state: loaded.state,
    });
    sendJson(res, 200, payload);
    return res;
  }

  return [
    {
      method: 'GET',
      pattern: '/instances',
      handler(_req, res) {
        return handleList(res);
      },
    },
    {
      method: 'POST',
      pattern: '/instances',
      handler(req, res) {
        return handleCreate(req, res);
      },
    },
    {
      method: 'GET',
      pattern: '/workflows',
      handler(_req, res) {
        return handleWorkflows(res);
      },
    },
    {
      method: 'GET',
      pattern: '/instances/:id/drill/:roleId',
      handler(_req, res, _url, params) {
        return handleDrill(res, params);
      },
    },
    {
      method: 'GET',
      pattern: '/instances/:id/nodes/:nodeId',
      handler(_req, res, url, params) {
        return handleNodeDetail(res, params, url);
      },
    },
    {
      method: 'GET',
      pattern: '/instances/:id/connections/:edgeId',
      handler(_req, res, _url, params) {
        return handleConnectionPanel(res, params);
      },
    },
    {
      method: 'GET',
      pattern: '/instances/:id/escalations',
      handler(_req, res, _url, params) {
        return handleEscalationList(res, params);
      },
    },
    {
      method: 'GET',
      pattern: '/instances/:id/subworkflow/:ref',
      handler(_req, res, url, params) {
        return handleSubflowGraph(res, params, url);
      },
    },
  ];
}
