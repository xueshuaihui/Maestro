/**
 * REST routes for the desktop channel (I1.10a WP-3 + I1.11 WP-7; requirement
 * D-2 / D-1, split doc 2.1 S-02 / 2.8). Owns the three endpoints the WP-2
 * channel degraded to `503 NOT_READY` (`GET /instances`, `POST /instances`,
 * `GET /workflows`) plus the I1.11 D-1 face: the read-only projections
 * (`/queue`, `/assets/:kind(/:id)`, `/occupancy/roles`, `/workflows/:id/canvas`,
 * `/evidence/...`), the two SSE streams (`/queue/stream`, `/notifications/stream`)
 * and the five single-item write routes that forward to the existing decision
 * paths. HTTP layer carries zero business logic: every route maps 1:1 onto a
 * daemon projection / decision export.
 *
 * The S-02 seam: `createRoutes({...})` returns a `{method, pattern, handler}`
 * table. `http/server.js` attaches it two ways without any cross-package file
 * change: tests may inject it via `registerRoutes(table)`, and production
 * takes the lazy dynamic `import('./routes.js')` fallback which registers the
 * returned table. Injected table entries are matched before the WP-2 built-in
 * routes, so once this module lands the structured 503 paths are taken over.
 *
 * Write discipline (D-1 / AC-39): the five write routes are one item per call
 * (no batch), reach the orchestrator only through the existing decision /
 * control entries (`escalation.resolve` / `approval.resolve` / `instance.cancel`
 * / `workflow.pause` / `workflow.resume` equivalents) and never write
 * `state.json` from this layer. `POST /__test__/{escalations,approvals,
 * notify-trigger}` (D-10) register ONLY when `NODE_ENV=test`; they reuse the
 * existing `test.escalate` seam / `buildApproval` shape and never touch disk
 * (approval rows live in an in-memory overlay until the core reloads state).
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

import { readBody, encodeSseFrame } from './stream.js';
import { readPrefs, writePrefs } from '../prefs.js';
import { buildApproval } from '../../core/approvals.js';
import { buildQueue, decideEscalation, decideApproval, cancelInstance } from '../queue.js';
import { listAssets, showAsset } from '../assets-view.js';
import { buildOccupancy } from '../occupancy.js';
import { buildCanvas } from '../canvas.js';
import { buildEvidence } from '../evidence.js';
import {
  DESKTOP_NOTIFY_CATEGORY_ANOMALY,
  DESKTOP_NOTIFY_CATEGORY_COMPLETED,
  DESKTOP_NOTIFY_CATEGORY_ESCALATION,
  DESKTOP_NOTIFY_SEG_ESCALATION,
  DESKTOP_NOTIFY_SEG_INSTANCE,
  DESKTOP_NOTIFY_SEG_MISSING,
  DESKTOP_NOTIFY_SEG_NODE,
  DESKTOP_NOTIFY_SEG_ROUND_PREFIX,
  DESKTOP_NOTIFY_SEG_ROUND_SUFFIX,
  DESKTOP_NOTIFY_SEG_SEPARATOR,
  DESKTOP_NOTIFY_TITLE_PREFIX,
  ERROR_TEMPLATE,
  ROLE_LABEL,
  TEMPLATE_LABEL,
} from '../../cli/labels.js';

/** D-2: request body cap for `POST /instances` (and every JSON write body). */
const BODY_LIMIT_BYTES = 32 * 1024;

/** SSE response headers (same shape as the WP-2 stream hub). */
const SSE_HEADERS = Object.freeze({
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-store',
  Connection: 'keep-alive',
});

/** Queue snapshot stream tick: rebuild + change-detect every 500ms. */
const QUEUE_STREAM_TICK_MS = 500;

/** Notification merge window: same-target intents collapse within 500ms. */
const NOTIFY_MERGE_MS = 500;

/**
 * Notification fan-out hub (I1.11 D-1 / D-46). `notifier.intents$` is a
 * single-consumer async iterable, so one hub owns the pump and merges
 * same-target intents (`(kind, instanceId)` within 500ms) before writing one
 * SSE frame per intent — the client replaces the previous notification with
 * the same `(kind, instanceId)` key.
 */
function createNotifyHub(source, now) {
  const subscribers = new Set();
  const pending = new Map();
  let flushTimer = null;
  let pumpTask = null;

  function keyOf(intent) {
    return `${intent?.kind ?? ''}|${intent?.instanceId ?? ''}`;
  }

  function flush() {
    flushTimer = null;
    const frames = [...pending.values()];
    pending.clear();
    for (const intent of frames) {
      for (const res of [...subscribers]) {
        if (!res.destroyed && !res.writableEnded) {
          res.write(encodeSseFrame('notify', intent));
        }
      }
    }
  }

  function accept(intent) {
    if (!intent || typeof intent !== 'object') return false;
    pending.set(keyOf(intent), intent);
    if (flushTimer === null) {
      flushTimer = setTimeout(flush, NOTIFY_MERGE_MS);
      if (typeof flushTimer.unref === 'function') flushTimer.unref();
    }
    return true;
  }

  async function pump() {
    if (pumpTask !== null) return pumpTask;
    pumpTask = (async () => {
      try {
        for await (const intent of source.intents$) accept(intent);
      } catch {
        // 意图源结束（dispose）即停止泵；不向任何一条流回写错误。
      }
    })();
    return pumpTask;
  }

  function attach(res) {
    res.writeHead(200, SSE_HEADERS);
    // 立即写一条注释帧：既 flush 响应头（writeHead 是惰性发送，无首写则
    // 客户端永远收不到头），也兼作 SSE 连接建立的确认信号。
    res.write(': connected\n\n');
    subscribers.add(res);
    res.on('close', () => subscribers.delete(res));
    return res;
  }

  function close() {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    subscribers.clear();
    pending.clear();
  }

  return { accept, attach, pump, close, now };
}

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
 *   (`listInstances` / `getStatus` / `startRun` / decision + control entries)
 * @param {Function} [options.loadWorkflowDef] S-02 seam parameter, injected
 *   by `http/server.js`; kept for signature compatibility — the graph route
 *   stays a WP-2 built-in, so the WP-3 table does not consume it.
 * @param {string} [options.root] project root override (tests; production
 *   resolves it from the daemon argv). Required by the I1.11 projections.
 * @param {Function} [options.clock] injected clock (ms) for merge windows
 * @param {object} [options.notifier] the daemon notifier (`{intents$, dispose}`,
 *   split doc 2.1); when absent `/notifications/stream` answers 503 NOT_READY
 * @returns {Array<{method: string, pattern: string, handler: Function}>}
 */
export function createRoutes({ orchestrator, loadWorkflowDef, root, clock, notifier } = {}) {
  void loadWorkflowDef; // reserved by the frozen seam signature; see docblock
  const projectRoot = resolveProjectRoot(root);
  if (!orchestrator || typeof orchestrator.startRun !== 'function') {
    throw new TypeError('createRoutes: orchestrator.startRun is required');
  }
  const clockNow = () => (typeof clock === 'function' ? clock() : Date.now());

  /** 测试接缝的待审批覆盖层（仅内存；instanceId → 行数组）。 */
  const approvalOverlay = new Map();

  /** 通知扇出中枢：notifier 缺席时为 null，通知面降级 503。 */
  const notifyHub =
    notifier && typeof notifier.intents$?.[Symbol.asyncIterator] === 'function'
      ? createNotifyHub(notifier, clockNow)
      : null;
  if (notifyHub !== null) notifyHub.pump();

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
   * Notification preference seam (D-11 / D-42 / BR-25): the desktop window's
   * queue-page toggle strip reads and writes `<root>/.orch/desktop/prefs.json`
   * through `src/daemon/prefs.js` — the single owner of that file. No instance
   * state is touched. A missing root degrades to 503 NOT_READY, same as the
   * other I1.11 read routes.
   */
  async function handleGetPrefs(res) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const prefs = await readPrefs(projectRoot);
    sendJson(res, 200, prefs);
    return res;
  }

  async function handlePostPrefs(req, res) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    try {
      const merged = await writePrefs(projectRoot, body);
      sendJson(res, 200, merged);
    } catch (error) {
      sendJson(res, 422, {
        ok: false,
        error: error?.code ?? 'IPC_BAD_PARAMS',
        message: error?.message ?? String(error),
      });
    }
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

  // ---------------------------------------------------------------- I1.11 D-1 面
  // 只读投影、两条 SSE 与五条单条写接口。HTTP 层零业务逻辑：每条路由 1:1
  // 映射到守护进程投影 / 决策导出；写路径一律转发既有裁决入口，本层不写
  // state.json（AC-39）。

  /** D-1 的路径参数只承载 id；含分隔符或相对段的取值按未找到降级，不做路径拼接。 */
  function safeId(value) {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value !== '.' &&
      value !== '..' &&
      !value.includes('/') &&
      !value.includes('\\')
    );
  }

  /**
   * 收集本机全部实例快照（队列 / 占用投影的入参）。可读实例取 `getStatus`
   * 的既有快照；不可读实例透传清单条目（自带既有 pending 计数字段，由
   * 投影层按 A-3 降级），全部标记 `unreadable: true`。清单取不到返回 null
   * （投影层给断线位）。
   */
  async function collectInstances() {
    const listed = await orchestrator.listInstances();
    if (!listed || listed.ok !== true || !Array.isArray(listed.items)) return null;
    const instances = [];
    for (const entry of listed.items) {
      if (!entry || entry.readable !== true) {
        instances.push({ ...entry, unreadable: true });
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
        instances.push({ ...entry, unreadable: true });
        continue;
      }
      // 测试接缝的待审批行只并入内存投影，不落盘（D-10）。
      const overlayRows = approvalOverlay.get(entry.instanceId);
      if (overlayRows && overlayRows.length > 0) {
        const approvals = Array.isArray(snapshot.approvals) ? snapshot.approvals : [];
        instances.push({
          ...snapshot,
          approvals: [...approvals, ...overlayRows.map((row) => ({ ...row }))],
        });
      } else {
        instances.push(snapshot);
      }
    }
    return instances;
  }

  async function handleQueue(res) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const instances = await collectInstances();
    sendJson(res, 200, buildQueue(projectRoot, { instances }));
    return res;
  }

  async function handleOccupancy(res) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const instances = await collectInstances();
    sendJson(res, 200, buildOccupancy(projectRoot, { instances }));
    return res;
  }

  /**
   * `GET /queue/stream`：队列快照 SSE。500ms 一拍重建快照、内容有变才推
   * （同窗内的多次变化天然合并为一帧），磁盘直写与总线事件都被同一拍覆盖
   * （BR-37 的 ≤2s 时效）。
   */
  async function handleQueueStream(res) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    res.writeHead(200, SSE_HEADERS);
    let lastFrame = null;
    let closed = false;
    res.on('close', () => {
      closed = true;
    });
    const push = async () => {
      if (closed || res.destroyed || res.writableEnded) return;
      try {
        const instances = await collectInstances();
        const payload = buildQueue(projectRoot, { instances });
        const frame = JSON.stringify(payload);
        if (frame !== lastFrame) {
          lastFrame = frame;
          res.write(encodeSseFrame('queue.snapshot', payload));
        }
      } catch {
        // 单拍失败保流：下一拍重试，不让一条坏快照拖断推送。
      }
    };
    await push();
    const timer = setInterval(() => {
      void push();
    }, QUEUE_STREAM_TICK_MS);
    if (typeof timer.unref === 'function') timer.unref();
    res.on('close', () => clearInterval(timer));
    return res;
  }

  async function handleAssetList(res, kind) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const payload = await listAssets(projectRoot, kind);
    sendJson(res, 200, payload);
    return res;
  }

  async function handleAssetShow(res, kind, id) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    if (!safeId(id)) {
      sendJson(res, 404, { found: false, kind, id });
      return res;
    }
    const payload = await showAsset(projectRoot, kind, id);
    if (!payload || payload.found === false) {
      sendJson(res, 404, payload && payload.found === false ? payload : { found: false, kind, id });
      return res;
    }
    sendJson(res, 200, payload);
    return res;
  }

  function handleCanvas(res, workflowId) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    if (!safeId(workflowId)) {
      // 非法 id 与「文件不存在」同口径：定义 空（D-6 取不到输入三态）。
      sendJson(res, 200, { title: workflowId ?? null, readable: true, valid: true, nodes: [], edges: [] });
      return res;
    }
    sendJson(res, 200, buildCanvas(projectRoot, workflowId));
    return res;
  }

  async function handleEvidence(res, instanceId, nodeId) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    if (!safeId(instanceId) || (nodeId !== undefined && !safeId(nodeId))) {
      sendJson(res, 200, { instanceId: instanceId ?? null, items: [] });
      return res;
    }
    const payload = await buildEvidence(projectRoot, instanceId, nodeId ?? null);
    sendJson(res, 200, payload);
    return res;
  }

  async function handleNotifyStream(res) {
    if (notifyHub === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    return notifyHub.attach(res);
  }

  // ---- 五条写接口（一次一条，无批量）----

  function statusForCode(code) {
    if (code === 'CORE_NOT_RUNNING') return 503;
    if (code === 'NOT_FOUND' || /_NOT_FOUND$/.test(String(code ?? ''))) return 404;
    return 422;
  }

  function sendOutcome(res, outcome) {
    if (outcome && outcome.ok === true) {
      sendJson(res, 200, { ok: true, result: outcome.result ?? null });
      return;
    }
    const code = outcome?.code ?? 'UNKNOWN_ERROR';
    const payload = {
      ok: false,
      error: code,
      params: outcome?.params ?? {},
      message: errorText(code, outcome?.params ?? {}),
    };
    if (outcome?.conclusion !== undefined && outcome.conclusion !== null) {
      payload.conclusion = outcome.conclusion;
    }
    if (outcome?.hint !== undefined && outcome.hint !== null) payload.hint = outcome.hint;
    sendJson(res, statusForCode(code), payload);
  }

  /** 读取 JSON 请求体；失败时直接应答 400 / 413 并返回 undefined。 */
  async function readJsonBody(req, res) {
    let body;
    try {
      body = await readBody(req, BODY_LIMIT_BYTES);
    } catch (err) {
      sendJson(res, 413, { error: err?.code ?? 'PAYLOAD_TOO_LARGE' });
      return undefined;
    }
    if (body.length === 0) return {};
    try {
      const parsed = JSON.parse(body.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        sendJson(res, 400, { error: 'IPC_BAD_PARAMS' });
        return undefined;
      }
      return parsed;
    } catch {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS' });
      return undefined;
    }
  }

  async function handleEscalationDecision(req, res, params) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    if (typeof body.decision !== 'string' || body.decision.length === 0) {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS', params: { field: 'decision' } });
      return res;
    }
    sendOutcome(res, await decideEscalation(projectRoot, params.id, body.decision));
    return res;
  }

  async function handleApprovalDecision(req, res, params) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    if (typeof body.decision !== 'string' || body.decision.length === 0) {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS', params: { field: 'decision' } });
      return res;
    }
    sendOutcome(res, await decideApproval(projectRoot, params.id, body.decision));
    return res;
  }

  async function handleCancel(res, instanceId) {
    if (projectRoot === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    if (!safeId(instanceId)) {
      sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
      return res;
    }
    sendOutcome(res, await cancelInstance(projectRoot, instanceId));
    return res;
  }

  /**
   * `POST /control/pause|resume`（D-8）：逐实例调用既有 pause / resume 入口
   * （等价 `workflow.pause` / `workflow.resume` RPC），收集成功 / 跳过并汇
   * 总返回；全量失败不报错（D-8）。
   */
  async function handleControl(res, mode) {
    const method = mode === 'pause' ? 'pause' : 'resume';
    const listed = await orchestrator.listInstances();
    if (!listed || listed.ok !== true || !Array.isArray(listed.items)) {
      sendJson(res, 500, { ok: false, error: listed?.code ?? 'STORE_READ_FAILED' });
      return res;
    }
    let paused = 0;
    let skipped = 0;
    for (const entry of listed.items) {
      if (!entry || entry.readable !== true || typeof orchestrator[method] !== 'function') {
        skipped += 1;
        continue;
      }
      try {
        const outcome = await orchestrator[method]({ instanceId: entry.instanceId });
        if (outcome && outcome.ok === true) paused += 1;
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    }
    sendJson(res, 200, { ok: true, paused, skipped });
    return res;
  }

  // ---- D-10 测试接缝（仅 NODE_ENV=test 注册；不写盘）----

  async function handleTestEscalations(req, res) {
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    for (const field of ['instanceId', 'nodeId']) {
      if (typeof body[field] !== 'string' || body[field].length === 0) {
        sendJson(res, 400, { error: 'IPC_BAD_PARAMS', params: { field } });
        return res;
      }
    }
    if (typeof orchestrator.escalateOnce !== 'function') {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    // 与既有 `test.escalate` RPC 同参同义（可传 reasonCode / artifactRefs）。
    const outcome = await orchestrator.escalateOnce(body.instanceId, body.nodeId, {
      ...(typeof body.reasonCode === 'string' && body.reasonCode.length > 0
        ? { reasonCode: body.reasonCode }
        : {}),
      ...(Array.isArray(body.artifactRefs) ? { artifactRefs: body.artifactRefs } : {}),
    });
    if (outcome && outcome.ok === true) {
      sendJson(res, 200, { ok: true, result: outcome });
      return res;
    }
    sendJson(res, 422, {
      ok: false,
      error: outcome?.code ?? 'UNKNOWN_ERROR',
      params: outcome?.detail ?? outcome?.params ?? {},
    });
    return res;
  }

  /**
   * 构造一条待审批（走既有 `buildApproval` 形状）。行只进内存覆盖层并入队列
   * 投影，不写盘、不改实例状态（D-10）；编号在覆盖层与磁盘既有行之上单调。
   */
  async function handleTestApprovals(req, res) {
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    for (const field of ['instanceId', 'action']) {
      if (typeof body[field] !== 'string' || body[field].length === 0) {
        sendJson(res, 400, { error: 'IPC_BAD_PARAMS', params: { field } });
        return res;
      }
    }
    const instanceId = body.instanceId;
    const rows = approvalOverlay.get(instanceId) ?? [];
    let existing = rows.map((row) => ({ ...row }));
    try {
      const status = await orchestrator.getStatus({ instanceId });
      if (status?.ok === true && Array.isArray(status.snapshot?.approvals)) {
        existing = existing.concat(status.snapshot.approvals);
      }
    } catch {
      // 磁盘真值取不到时只用覆盖层编号，不抛错。
    }
    const approval = buildApproval({
      approvals: existing,
      instanceId,
      nodeId: typeof body.nodeId === 'string' ? body.nodeId : null,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
      action: body.action,
      now: clockNow(),
    });
    rows.push(approval);
    approvalOverlay.set(instanceId, rows);
    sendJson(res, 200, { ok: true, result: { approvalId: approval.approvalId, approval } });
    return res;
  }

  async function handleTestNotifyTrigger(req, res) {
    const body = await readJsonBody(req, res);
    if (body === undefined) return res;
    const kind = body.kind;
    if (
      !['escalation', 'completed', 'anomaly'].includes(kind) ||
      typeof body.instanceId !== 'string' ||
      body.instanceId.length === 0
    ) {
      sendJson(res, 400, { error: 'IPC_BAD_PARAMS' });
      return res;
    }
    if (notifyHub === null) {
      sendJson(res, 503, { error: 'NOT_READY' });
      return res;
    }
    const escalationId =
      typeof body.escalationId === 'string' && body.escalationId.length > 0 ? body.escalationId : null;
    const category =
      kind === 'escalation'
        ? DESKTOP_NOTIFY_CATEGORY_ESCALATION
        : kind === 'completed'
          ? DESKTOP_NOTIFY_CATEGORY_COMPLETED
          : DESKTOP_NOTIFY_CATEGORY_ANOMALY;
    // 只推通知意图，不改任何状态（D-10）：文案按 A-1 的五段固定段序组装，
    // 取不到的段渲染 `—`，与真实意图同形状。
    notifyHub.accept({
      kind,
      ids: escalationId !== null ? [escalationId] : [],
      instanceId: body.instanceId,
      title: `${DESKTOP_NOTIFY_TITLE_PREFIX} ${category} · ${body.instanceId}`,
      body: [
        `${DESKTOP_NOTIFY_SEG_INSTANCE} ${body.instanceId}`,
        `${DESKTOP_NOTIFY_SEG_ESCALATION} ${escalationId ?? DESKTOP_NOTIFY_SEG_MISSING}`,
        `${DESKTOP_NOTIFY_SEG_NODE} ${DESKTOP_NOTIFY_SEG_MISSING}`,
        `${DESKTOP_NOTIFY_SEG_ROUND_PREFIX} ${DESKTOP_NOTIFY_SEG_MISSING} ${DESKTOP_NOTIFY_SEG_ROUND_SUFFIX}`,
        typeof body.reason === 'string' && body.reason.length > 0 ? body.reason : DESKTOP_NOTIFY_SEG_MISSING,
      ].join(DESKTOP_NOTIFY_SEG_SEPARATOR),
      mergedCount: 1,
      at: clockNow(),
    });
    sendJson(res, 200, { ok: true, pushed: true });
    return res;
  }

  const testSeamsEnabled = process.env.NODE_ENV === 'test';

  const routes = [
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
    // ---- 通知开关偏好（D-11 / D-42；经 src/daemon/prefs.js 单一写入方）----
    {
      method: 'GET',
      pattern: '/ui/prefs',
      handler(_req, res) {
        return handleGetPrefs(res);
      },
    },
    {
      method: 'POST',
      pattern: '/ui/prefs',
      handler(req, res) {
        return handlePostPrefs(req, res);
      },
    },
    // ---- I1.11 D-1 只读面 ----
    {
      method: 'GET',
      pattern: '/queue',
      handler(_req, res) {
        return handleQueue(res);
      },
    },
    {
      method: 'GET',
      pattern: '/queue/stream',
      handler(_req, res) {
        return handleQueueStream(res);
      },
    },
    {
      method: 'GET',
      pattern: '/assets/roles',
      handler(_req, res) {
        return handleAssetList(res, 'roles');
      },
    },
    {
      method: 'GET',
      pattern: '/assets/skills',
      handler(_req, res) {
        return handleAssetList(res, 'skills');
      },
    },
    {
      method: 'GET',
      pattern: '/assets/workflows',
      handler(_req, res) {
        return handleAssetList(res, 'workflows');
      },
    },
    {
      method: 'GET',
      pattern: '/assets/roles/:id',
      handler(_req, res, _url, params) {
        return handleAssetShow(res, 'roles', params.id);
      },
    },
    {
      method: 'GET',
      pattern: '/assets/skills/:id',
      handler(_req, res, _url, params) {
        return handleAssetShow(res, 'skills', params.id);
      },
    },
    {
      method: 'GET',
      pattern: '/assets/workflows/:id',
      handler(_req, res, _url, params) {
        return handleAssetShow(res, 'workflows', params.id);
      },
    },
    {
      method: 'GET',
      pattern: '/occupancy/roles',
      handler(_req, res) {
        return handleOccupancy(res);
      },
    },
    {
      method: 'GET',
      pattern: '/workflows/:id/canvas',
      handler(_req, res, _url, params) {
        return handleCanvas(res, params.id);
      },
    },
    {
      method: 'GET',
      pattern: '/evidence/:instanceId',
      handler(_req, res, _url, params) {
        return handleEvidence(res, params.instanceId, undefined);
      },
    },
    {
      method: 'GET',
      pattern: '/evidence/:instanceId/:nodeId',
      handler(_req, res, _url, params) {
        return handleEvidence(res, params.instanceId, params.nodeId);
      },
    },
    {
      method: 'GET',
      pattern: '/notifications/stream',
      handler(_req, res) {
        return handleNotifyStream(res);
      },
    },
    // ---- I1.11 D-1 写面（一次一条）----
    {
      method: 'POST',
      pattern: '/queue/escalations/:id/decision',
      handler(req, res, _url, params) {
        return handleEscalationDecision(req, res, params);
      },
    },
    {
      method: 'POST',
      pattern: '/queue/approvals/:id/decision',
      handler(req, res, _url, params) {
        return handleApprovalDecision(req, res, params);
      },
    },
    {
      method: 'POST',
      pattern: '/instances/:id/cancel',
      handler(_req, res, _url, params) {
        return handleCancel(res, params.id);
      },
    },
    {
      method: 'POST',
      pattern: '/control/pause',
      handler(_req, res) {
        return handleControl(res, 'pause');
      },
    },
    {
      method: 'POST',
      pattern: '/control/resume',
      handler(_req, res) {
        return handleControl(res, 'resume');
      },
    },
  ];

  // D-10 测试接缝：只在 NODE_ENV=test 注册，生产进程的路由表里没有这些键。
  if (testSeamsEnabled) {
    routes.push(
      {
        method: 'POST',
        pattern: '/__test__/escalations',
        handler(req, res) {
          return handleTestEscalations(req, res);
        },
      },
      {
        method: 'POST',
        pattern: '/__test__/approvals',
        handler(req, res) {
          return handleTestApprovals(req, res);
        },
      },
      {
        method: 'POST',
        pattern: '/__test__/notify-trigger',
        handler(req, res) {
          return handleTestNotifyTrigger(req, res);
        },
      },
    );
  }

  return routes;
}
