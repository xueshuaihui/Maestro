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

import path from 'node:path';

import { readBody } from './stream.js';
import { ERROR_TEMPLATE, ROLE_LABEL, TEMPLATE_LABEL } from '../../cli/labels.js';

/** D-2: request body cap for `POST /instances`. */
const BODY_LIMIT_BYTES = 32 * 1024;

/** Terminal state codes for node progress; `done` settles a node. */
const DONE_NODE_STATE = 'done';

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
  return res;
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
 *   by `http/server.js`; kept for signature compatibility — the graph route
 *   stays a WP-2 built-in, so the WP-3 table does not consume it.
 * @param {string} [options.root] project root override (tests; production
 *   resolves it from the daemon argv)
 * @returns {Array<{method: string, pattern: string, handler: Function}>}
 */
export function createRoutes({ orchestrator, loadWorkflowDef, root } = {}) {
  void loadWorkflowDef; // reserved by the frozen seam signature; see docblock
  const projectRoot = resolveProjectRoot(root);
  if (!orchestrator || typeof orchestrator.startRun !== 'function') {
    throw new TypeError('createRoutes: orchestrator.startRun is required');
  }

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
      sendJson(res, 200, { ok: true, instanceId: started.instanceId });
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
  ];
}
