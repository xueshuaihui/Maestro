/**
 * Desktop view assembly (I1.10a WP-8; split doc 2.2 / requirement AC-01 /
 * AC-26 / AC-30 / AC-31, collaboration AC-08 / AC-15 / AC-21 / AC-24 / AC-37).
 *
 * This module owns the seam between the pure modules and the window: it
 * decides which page is on screen (instance list, flow graph, node board or
 * project prompt), consumes the push stream by event type, binds the toolbar
 * and the keyboard, and hands drag offsets to the shell-side preference
 * store. It deliberately renders nothing itself:
 *
 * - list rows and the empty / unreadable lines come from `list/list.js`;
 * - health hover lines come from `list/health-hover.js`;
 * - the new-instance panel validation, start body and feedback come from
 *   `list/new-instance.js`;
 * - node positions come from `graph/layout.js` and the view transform from
 *   `graph/view.js` (no second layout here);
 * - folding comes from `graph/collapse.js` (the model, never the raw graph);
 * - opacity / stacking / pulse tokens come from `graph/style.js`;
 * - hover sets come from `graph/highlight.js`, always after folding;
 * - role / special / connection rows come from `graph/node-rows.js` and
 *   `graph/edge-rows.js`; connection names are annotated on the caller side
 *   (`fromTitle` / `toTitle`) because the projection carries ids only;
 * - the legend comes from `graph/legend.js`;
 * - label visibility comes from `labels/labels.js`;
 * - board columns and cards come from `board/board.js`.
 *
 * Stacking has one source only: `elementStyle().z`. The layout `z` is not
 * added on top (that would double-lift abnormal elements).
 *
 * Degradation discipline (AC-30): every failure becomes a notice object plus
 * at least one action (`back-to-list`, `retry-graph`, `retry-connection`).
 * The page never blanks, never prints a stack, and the last good content is
 * kept while a channel recovers.
 *
 * Zero CJK literals: all visible wording is read from the `/ui/labels` table.
 * The only authored glyphs are the two ASCII controls (back and retry).
 */

import { renderListEmpty, renderListRow, renderListUnreadable, sortInstances } from './list/list.js';
import { renderHealthHover } from './list/health-hover.js';
import {
  buildStartRequest,
  renderStartFailure,
  renderStarted,
  validateNewInstance,
} from './list/new-instance.js';
import { computeLayout } from './graph/layout.js';
import { createViewState } from './graph/view.js';
import { autoCollapse, toggleGroup } from './graph/collapse.js';
import { elementStyle } from './graph/style.js';
import { hoverSet } from './graph/highlight.js';
import { renderRoleRow, renderSpecialRow } from './graph/node-rows.js';
import { renderEdgeRow } from './graph/edge-rows.js';
import { renderLegend } from './graph/legend.js';
import { resolveLabels, visibleLabels } from './labels/labels.js';
import { projectBoard } from './board/board.js';
import { createConnectionState } from './connection.js';
import { isProjectBlocked, projectMessage, resolveProject } from './project.js';
import {
  CONTROLS,
  renderQueueRow,
  actionsFor,
  emptyText as queueEmptyText,
  disconnectedText as queueDisconnectedText,
  confirmTexts,
  outcomeOf,
  prefsRows,
} from './queue/queue.js';
import { ASSET_KINDS, tabText, countText, rowText as assetRowText,
  dirUnreadableText, detailLines } from './assets/assets.js';
import { renderOccupancyRow, emptyText as occupancyEmptyText,
  skippedText, disconnectedText as occupancyDisconnectedText } from './occupancy/occupancy.js';
import { titleText as canvasTitleText, validationBadge, degradeText as canvasDegradeText,
  nodeRow as canvasNodeRow, edgeRow as canvasEdgeRow, graphEdges } from './canvas/canvas.js';
import { renderEvidence, RENDER_LIMIT_BYTES } from './evidence/evidence.js';
import { replaceIntent, queueTargetOf, stripEntryOf } from './notify/notify.js';

const DEFAULT_MODULES = Object.freeze({
  renderListEmpty,
  renderListRow,
  renderListUnreadable,
  sortInstances,
  renderHealthHover,
  buildStartRequest,
  renderStartFailure,
  renderStarted,
  validateNewInstance,
  computeLayout,
  createViewState,
  autoCollapse,
  toggleGroup,
  elementStyle,
  hoverSet,
  renderRoleRow,
  renderSpecialRow,
  renderEdgeRow,
  renderLegend,
  resolveLabels,
  visibleLabels,
  projectBoard,
  createConnectionState,
  CONTROLS,
  renderQueueRow,
  actionsFor,
  queueEmptyText,
  queueDisconnectedText,
  confirmTexts,
  outcomeOf,
  prefsRows,
  ASSET_KINDS,
  tabText,
  countText,
  assetRowText,
  dirUnreadableText,
  detailLines,
  renderOccupancyRow,
  occupancyEmptyText,
  skippedText,
  occupancyDisconnectedText,
  canvasTitleText,
  validationBadge,
  canvasDegradeText,
  canvasNodeRow,
  canvasEdgeRow,
  graphEdges,
  renderEvidence,
  replaceIntent,
  queueTargetOf,
  stripEntryOf,
});

/** Navigation entries for the five I1.11 views (view id -> label key). */
const VIEW_NAV_KEYS = Object.freeze([
  ['queue', 'DESKTOP_VIEW_QUEUE'],
  ['assets', 'DESKTOP_VIEW_ASSETS'],
  ['occupancy', 'DESKTOP_VIEW_OCCUPANCY'],
  ['canvas', 'DESKTOP_VIEW_CANVAS'],
  ['evidence', 'DESKTOP_VIEW_EVIDENCE'],
]);

/**
 * Pure view-navigation items derived from the delivered label table (D-51).
 * A key whose text is not a delivered string is skipped, so a missing label
 * never renders a broken button. No DOM and no wording is authored here.
 */
export function viewNavItems(labels) {
  const items = [];
  for (const [view, key] of VIEW_NAV_KEYS) {
    const text = labels?.[key];
    if (typeof text !== 'string') continue;
    items.push({ view, key, text });
  }
  return items;
}

/** Controls that carry no wording of their own (ASCII glyphs only). */
const CONTROL_BACK = '\u2190';
const CONTROL_RETRY = '\u21BB';

/** Aggregate states whose line label is visible without hovering (A-11). */
const NOT_STARTED = 'not_started';

/**
 * Snapshot cards fed to the board projection (decision O / B-26).
 *
 * The graph payload carries `stateNodes: [{ nodeId, roleId, state }]` — the
 * orchestration nine-state vocabulary the board reads plus the role binding
 * the board uses to resolve display nodes (decision Q / Q-2). The role status
 * tokens are five and never stand in for those states, so a payload without
 * `stateNodes` degrades to an empty board instead of inventing states.
 */
function boardStateNodes(graph) {
  return Array.isArray(graph?.stateNodes) ? graph.stateNodes : [];
}

function nodeIndex(graph) {
  const out = new Map();
  for (const node of Array.isArray(graph?.nodes) ? graph.nodes : []) {
    if (typeof node?.id === 'string') out.set(node.id, node);
  }
  return out;
}

function edgeIndex(graph) {
  const out = new Map();
  for (const edge of Array.isArray(graph?.edges) ? graph.edges : []) {
    if (typeof edge?.id === 'string') out.set(edge.id, edge);
  }
  return out;
}

/**
 * Probe payload the shell and the end-to-end acceptance run read when the
 * graph page is assembled (`graph-shown(nodes, edges, dangling=0)`).
 */
export function buildGraphShownProbe(graph, instanceId) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const ids = new Set(nodes.map((node) => node?.id).filter((id) => typeof id === 'string'));
  let dangling = 0;
  for (const edge of edges) {
    if (!ids.has(edge?.from) || !ids.has(edge?.to)) dangling += 1;
  }
  return {
    event: 'graph-shown',
    instanceId: instanceId ?? graph?.instanceId ?? null,
    view: 'graph',
    nodes: nodes.length,
    edges: edges.length,
    dangling,
  };
}

/** Probe payload for the hide-to-tray step (AC-26 tail). */
export function buildClosedProbe() {
  return { event: 'closed', view: 'instances', window: { visible: false } };
}

function emptyGraph(instanceId) {
  return {
    rev: 0,
    instanceId: instanceId ?? null,
    template: null,
    state: null,
    workflow: { ref: null, readable: false },
    nodes: [],
    edges: [],
  };
}

function asText(value) {
  return typeof value === 'string' ? value : null;
}

/**
 * First-screen project summary (decision R / R-06). A missing summary — no
 * argument at all, `null`, or an object that carries neither a view nor a
 * usable root — resolves to the project prompt page instead of the instance
 * list, so a window without a project root can never show the empty list.
 */
function initialProject(project, labels) {
  if (project === null || project === undefined || typeof project !== 'object') {
    return resolveProject({ labels });
  }
  const view = typeof project.view === 'string' && project.view.length > 0;
  const root = typeof project.root === 'string' && project.root.trim().length > 0;
  if (!view && !root) return resolveProject({ labels });
  return project;
}

/**
 * Create the assembly model. No DOM is touched here: `compose()` returns the
 * full view model and `mountApp()` paints it.
 *
 * @param {object} [options]
 * @param {unknown} [options.labels] `/ui/labels` body or flat table
 * @param {object} [options.project] summary from `resolveProject`; absent or
 *   empty resolves to the project prompt page (decision R / R-06)
 * @param {object} [options.io] transport seam (see `mountApp`)
 * @param {object} [options.modules] module overrides (same shapes)
 */
export function createApp({ labels, project, io = {}, modules = {} } = {}) {
  const m = { ...DEFAULT_MODULES, ...(modules ?? {}) };
  const transport = io ?? {};
  const labelKeys = m.resolveLabels(labels ?? {}).keys;

  const state = {
    labels: labelKeys,
    project: initialProject(project, labelKeys),
    view: 'instances',
    connection: m.createConnectionState({
      connect: typeof transport.connect === 'function' ? transport.connect : undefined,
      now: transport.now,
      timeoutMs: transport.timeoutMs,
    }),
    instances: [],
    instancesLoaded: false,
    instancesError: null,
    graph: null,
    graphId: null,
    collapse: null,
    layout: null,
    viewState: null,
    offsets: {},
    hoveredKey: null,
    showNotStarted: false,
    focus: null,
    indicator: {},
    notice: null,
    templates: [],
    newPanel: { open: false, template: '', task: '', message: null, success: null },
    refetches: 0,
    frames: { role: 0, connection: 0, special: 0, session: 0, list: 0 },
    probes: [],
    lastError: null,
    // ---- I1.11 WP-8 new views ----
    queue: null,          // last buildQueue projection (kept on disconnect)
    queuePrefs: null,     // last /ui/prefs read
    queueNotice: null,    // outcome text of a decision / result line
    queueConfirm: null,   // pending cancel confirmation { id, texts }
    expandedRow: null,    // expanded queue row id (AC-43)
    selectedQueueIds: [], // ids selected by a notification click (AC-04)
    assets: null,         // last assets projection for the active kind
    assetKind: ASSET_KINDS[0],
    assetDetail: null,    // last showAsset projection
    occupancy: null,      // last buildOccupancy projection
    canvas: null,         // last buildCanvas projection
    canvasLayout: null,   // computeLayout(graphEdges(canvas)) result
    canvasId: null,
    evidence: null,       // last buildEvidence projection
    evidenceId: null,
    notifications: [],    // replaceIntent entries keyed (kind, instanceId)
  };

  if (isProjectBlocked(state.project)) state.view = 'project';

  const api = {
    /** Read-only view of the internal state (tests and the DOM painter). */
    state: () => state,
    probes: () => state.probes.slice(),

    setLabels(payload) {
      state.labels = m.resolveLabels(payload ?? {}).keys;
      return api;
    },

    setProject(summary) {
      state.project = summary ?? resolveProject({});
      state.view = isProjectBlocked(state.project) ? 'project' : 'instances';
      return api;
    },

    hasLabels() {
      return typeof state.labels?.DESKTOP_LIST_ROW === 'string'
        && typeof state.labels?.DESKTOP_VIEW_GRAPH === 'string'
        && typeof state.labels?.DESKTOP_LEGEND_ROLE === 'string';
    },

    // ------------------------------------------------------------- transports

    /**
     * Cold start: show the connecting transient first, then load the label
     * table, the project list and (when a graph is already open) the graph.
     * A rejected transport keeps the transient until `tick()` fails it, so
     * the F-17 line is never skipped.
     */
    async start() {
      state.connection.begin();
      try {
        const labelsAnswer = await transport.getLabels?.();
        if (!labelsAnswer || labelsAnswer.status !== 200) throw new Error('labels unavailable');
        api.setLabels(labelsAnswer.body);
        if (state.view !== 'project') {
          await api.loadInstances();
          await api.loadTemplates();
        }
        state.connection.markReady();
      } catch (error) {
        state.lastError = error?.message ?? String(error);
        // Stay connecting: the visible line is owned by the state machine.
      }
      return api;
    },

    async loadInstances() {
      if (typeof transport.getInstances !== 'function') return api;
      state.refetches += 1;
      try {
        const answer = await transport.getInstances();
        if (!answer || answer.status !== 200) throw new Error('instances unavailable');
        state.instances = Array.isArray(answer.body?.items) ? answer.body.items : [];
        state.instancesLoaded = true;
        state.instancesError = null;
      } catch (error) {
        state.instancesError = error?.message ?? String(error);
      }
      return api;
    },

    async loadTemplates() {
      if (typeof transport.getWorkflows !== 'function') return api;
      try {
        const answer = await transport.getWorkflows();
        if (answer?.status === 200 && Array.isArray(answer.body?.items)) {
          state.templates = answer.body.items;
        }
      } catch (error) {
        state.templates = state.templates;
      }
      return api;
    },

    /**
     * Open one instance graph. A missing instance or a corrupt snapshot is a
     * notice, not an exception; the list stays one action away.
     */
    async openGraph(instanceId) {
      const id = typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
      if (id !== state.graphId) state.offsets = {}; // preferences are per instance (AC-22)
      state.graphId = id;
      state.notice = null;
      state.focus = null;
      state.hoveredKey = null;
      if (id === null) {
        state.view = 'instances';
        return api;
      }
      // Replay the stored drag offsets of this instance before the projection
      // lands, so the first paint already carries them (AC-22). A missing file,
      // a foreign instance id or a failed read is "no preferences", never an
      // error and never a blocked render.
      const stored = await readOffsets(id);
      if (stored !== null) state.offsets = stored;
      let answer = null;
      try {
        answer = await transport.getGraph?.(id);
      } catch (error) {
        state.lastError = error?.message ?? String(error);
        answer = null;
      }
      if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
        api.setGraph(answer.body, id);
      } else {
        state.graph = emptyGraph(id);
        api.rebuildGraph();
        const status = Number(answer?.status);
        if (status === 404) {
          state.notice = {
            key: 'DESKTOP_GRAPH_MISSING',
            text: noticeText('DESKTOP_GRAPH_MISSING', { id }),
            retryable: true,
            returnable: true,
          };
        } else if (status === 422) {
          state.notice = {
            key: 'DESKTOP_LIST_UNREADABLE',
            text: noticeText('DESKTOP_LIST_UNREADABLE', { id }),
            retryable: true,
            returnable: true,
          };
        } else {
          state.notice = {
            key: 'DESKTOP_CONN_FAILED',
            text: asText(state.labels?.DESKTOP_CONN_FAILED),
            retryable: true,
            returnable: true,
          };
        }
      }
      state.view = 'graph';
      if (answer && answer.status === 200) emitGraphProbe();
      return api;
    },

    /** Replace the open graph and rebuild the fold / layout / view transform. */
    setGraph(payload, instanceId) {
      state.graph = payload && typeof payload === 'object' ? payload : emptyGraph(instanceId);
      state.graphId = instanceId ?? state.graph?.instanceId ?? state.graphId;
      api.rebuildGraph();
      state.notice = state.graph?.workflow?.readable === false
        ? {
          key: 'DESKTOP_DEF_UNREADABLE',
          text: asText(state.labels?.DESKTOP_DEF_UNREADABLE),
          retryable: false,
          returnable: true,
        }
        : null;
      return api;
    },

    /**
     * Fold the projection, lay the visible view out and seed the view state.
     * The fold model is rebuilt from the projection, so an expanded set is
     * replayed through `toggleGroup` (the model is the only accepted input).
     */
    rebuildGraph({ expanded = [] } = {}) {
      const graph = state.graph ?? emptyGraph(state.graphId);
      const previous = state.viewState;
      let collapse = m.autoCollapse({ nodes: graph.nodes, edges: graph.edges });
      for (const groupId of expanded) collapse = m.toggleGroup(collapse, groupId);
      state.collapse = collapse;
      state.layout = m.computeLayout({ nodes: collapse.nodes, edges: collapse.edges });
      const next = m.createViewState({
        nodes: collapse.nodes,
        edges: collapse.edges,
        zoom: previous?.getZoom?.() ?? 1,
        pan: previous?.getPan?.() ?? { x: 0, y: 0 },
      });
      next.applyOffsets(state.offsets);
      state.viewState = next;
      state.focus = null;
      return api;
    },

    // --------------------------------------------------------------- gestures

    backToList() {
      state.view = 'instances';
      state.notice = null;
      state.graphId = null;
      state.graph = null;
      state.collapse = null;
      state.layout = null;
      state.viewState = null;
      state.focus = null;
      state.hoveredKey = null;
      return api;
    },

    retryConnection() {
      state.connection.retry();
      return api;
    },

    async retryGraph() {
      if (state.graphId !== null) await api.openGraph(state.graphId);
      return api;
    },

    setView(view) {
      if (view === 'graph' && state.graph !== null) state.view = 'graph';
      if (view === 'board' && state.graph !== null) state.view = 'board';
      if (view === 'instances') state.view = 'instances';
      // I1.11 WP-8: the five new views switch unconditionally; their data is
      // loaded through the seam methods below and the last projection is kept
      // while a channel recovers (AC-47 / BR-36).
      if (['queue', 'assets', 'occupancy', 'canvas', 'evidence'].includes(view)) {
        state.view = view;
      }
      return api;
    },

    // --------------------------------------------- I1.11 WP-8 view seams

    /**
     * Load one projection through the HTTP seam. On a failed / non-200 answer
     * the last projection is kept (AC-47): the view repaints with the stale
     * rows and the connection state owns the "disconnected" line.
     */
    async loadProjection(name, key, transportFn) {
      if (typeof transportFn !== 'function') return api;
      try {
        const answer = await transportFn();
        if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
          state[key] = answer.body;
          state.lastError = null;
        }
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
      return api;
    },

    async loadQueue() {
      return api.loadProjection('queue', 'queue', () => transport.getQueue?.());
    },

    async loadQueuePrefs() {
      return api.loadProjection('prefs', 'queuePrefs', () => transport.getPrefs?.());
    },

    async saveQueuePrefs(patch) {
      if (typeof transport.postPrefs !== 'function') return api;
      try {
        const answer = await transport.postPrefs(patch);
        if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
          state.queuePrefs = answer.body;
        }
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
      return api;
    },

    async loadAssets(kind) {
      const active = ASSET_KINDS.includes(kind) ? kind : ASSET_KINDS[0];
      state.assetKind = active;
      state.assetDetail = null;
      return api.loadProjection('assets', 'assets', () => transport.getAssets?.(active));
    },

    async loadAssetDetail(kind, id) {
      const active = ASSET_KINDS.includes(kind) ? kind : ASSET_KINDS[0];
      state.assetKind = active;
      if (typeof transport.getAsset !== 'function') return api;
      try {
        const answer = await transport.getAsset(active, id);
        if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
          state.assetDetail = answer.body;
        } else if (answer && answer.status === 404) {
          state.assetDetail = { found: false, kind: active, id };
        }
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
      return api;
    },

    async loadOccupancy() {
      return api.loadProjection('occupancy', 'occupancy', () => transport.getOccupancy?.());
    },

    async loadCanvas(id) {
      const canvasId = typeof id === 'string' && id.length > 0 ? id : state.canvasId;
      state.canvasId = canvasId;
      if (canvasId === null || typeof transport.getCanvas !== 'function') return api;
      try {
        const answer = await transport.getCanvas(canvasId);
        if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
          state.canvas = answer.body;
          // Reuse the one layout module; never copy a second layout here.
          state.canvasLayout = m.computeLayout({
            nodes: Array.isArray(answer.body.nodes) ? answer.body.nodes : [],
            edges: m.graphEdges(answer.body),
          });
        }
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
      return api;
    },

    async loadEvidence(instanceId, nodeId) {
      const id = typeof instanceId === 'string' && instanceId.length > 0
        ? instanceId
        : state.evidenceId;
      state.evidenceId = id;
      if (id === null || typeof transport.getEvidence !== 'function') return api;
      try {
        const answer = await transport.getEvidence(id, nodeId ?? null);
        if (answer && answer.status === 200 && answer.body && typeof answer.body === 'object') {
          state.evidence = answer.body;
        }
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
      return api;
    },

    /** Enter a new view and eagerly load its projection (and prefs for queue). */
    async openView(view, arg) {
      api.setView(view);
      if (view === 'queue') {
        await api.loadQueue();
        await api.loadQueuePrefs();
      } else if (view === 'assets') {
        await api.loadAssets(arg ?? state.assetKind);
      } else if (view === 'occupancy') {
        await api.loadOccupancy();
      } else if (view === 'canvas') {
        await api.loadCanvas(arg ?? state.canvasId ?? state.templates?.[0]?.id ?? null);
      } else if (view === 'evidence') {
        await api.loadEvidence(arg ?? state.evidenceId ?? state.instances?.[0]?.instanceId ?? null);
      }
      return api;
    },

    /**
     * Apply one queue decision through the HTTP write seam and map the answer
     * to a visible outcome line (A-4 / AC-15 / AC-16). Cancel is two-step and
     * therefore handled by `beginCancel` / `cancelConfirmed` below.
     */
    async decide(kind, id, decision, context) {
      const path = kind === 'approval'
        ? 'postApprovalDecision'
        : kind === 'escalation'
          ? 'postEscalationDecision'
          : 'postCancel';
      if (typeof transport[path] !== 'function') return api;
      let answer;
      try {
        answer = await transport[path](id, decision);
      } catch (error) {
        answer = { status: 0, body: { message: error?.message ?? String(error) } };
      }
      const outcome = m.outcomeOf(answer?.body ?? {}, context ?? {}, state.labels);
      state.queueNotice = {
        kind: outcome.kind,
        text: outcome.text,
        passHint: outcome.passHint,
        id,
      };
      if (outcome.kind === 'denied') {
        const rows = Array.isArray(state.queue?.items) ? state.queue.items : [];
        const row = rows.find((item) => item?.id === id);
        if (row) row.passHint = outcome.passHint;
      }
      await api.loadQueue();
      return outcome;
    },

    beginCancel(id) {
      state.queueConfirm = {
        id,
        texts: m.confirmTexts(id, state.labels),
      };
      return api;
    },

    dismissCancel() {
      state.queueConfirm = null;
      return api;
    },

    async cancelConfirmed() {
      const confirm = state.queueConfirm;
      state.queueConfirm = null;
      if (confirm === null) return api;
      return api.decide('cancel', confirm.id, 'cancel', {
        type: 'cancel', id: confirm.id, decision: 'cancel', action: 'cancel',
      });
    },

    toggleRow(id) {
      state.expandedRow = state.expandedRow === id ? null : id;
      return api;
    },

    /** Replace the notification strip by one incoming intent (D-46). */
    pushNotification(intent) {
      state.notifications = m.replaceIntent(state.notifications, intent);
      return api;
    },

    /**
     * Click routing (AC-04 / AC-49): navigate to the queue and select the rows
     * the notification points at, then reload the freshest snapshot.
     */
    async followNotification(intent) {
      const target = m.queueTargetOf(intent);
      await api.openView('queue');
      if (target.selectable) {
        state.expandedRow = target.ids[0] ?? null;
        state.selectedQueueIds = target.ids.slice();
      }
      return target;
    },

    resetView() {
      state.viewState?.reset?.();
      state.offsets = {};
      state.focus = null;
      void persistOffsets(state.offsets);
      return api;
    },

    toggleNotStarted() {
      state.showNotStarted = !state.showNotStarted;
      return api;
    },

    toggleGroup(groupId) {
      if (state.collapse === null) return api;
      const expanded = new Set(state.collapse.expanded ?? []);
      if (expanded.has(groupId)) expanded.delete(groupId);
      else expanded.add(groupId);
      const zoom = state.viewState?.getZoom?.() ?? 1;
      const pan = state.viewState?.getPan?.() ?? { x: 0, y: 0 };
      state.collapse = m.toggleGroup(state.collapse, groupId);
      state.layout = m.computeLayout({ nodes: state.collapse.nodes, edges: state.collapse.edges });
      const next = m.createViewState({
        nodes: state.collapse.nodes,
        edges: state.collapse.edges,
        zoom,
        pan,
      });
      next.applyOffsets(state.offsets);
      state.viewState = next;
      state.focus = null;
      return api;
    },

    focusNode(nodeId) {
      const visible = state.viewState?.focus?.(nodeId, 2) ?? null;
      state.focus = state.viewState?.getFocus?.() ?? null;
      return visible;
    },

    escape() {
      state.viewState?.exitFocus?.();
      state.focus = null;
      return api;
    },

    /** Store one node drag and hand the offsets to the shell preference store. */
    dragEnd(nodeId, dx, dy) {
      if (typeof nodeId !== 'string') return api;
      state.viewState?.applyOffsets?.({ [nodeId]: { dx, dy } });
      state.offsets = state.viewState?.getOffsets?.() ?? {};
      void persistOffsets(state.offsets);
      return api;
    },

    /** Hover without repaint: returns the highlight sets for the painter. */
    setHover(key) {
      const graph = state.collapse ?? { nodes: [], edges: [] };
      const hovered = typeof key === 'string' && key.length > 0 ? key : null;
      state.hoveredKey = hovered;
      return m.hoverSet({ nodes: graph.nodes, edges: graph.edges }, hovered);
    },

    // ----------------------------------------------------------- push stream

    /**
     * Route one SSE frame (D-5 / AC-37). Element frames repaint the graph,
     * `session.indicator` only stores the indicator, `instances.changed`
     * asks the caller to refetch the list. Nothing here re-layouts geometry.
     */
    handleFrame(frame) {
      const type = asText(frame?.type) ?? asText(frame?.event);
      const data = frame?.data !== null && typeof frame?.data === 'object' ? frame.data : frame;
      const key = asText(data?.key);
      const payload = data?.payload !== null && typeof data?.payload === 'object' ? data.payload : {};
      const rev = Number.isFinite(data?.rev) ? Number(data.rev) : null;

      // D-2: the first frame (and every reconnect frame) is
      // `event: graph.snapshot` with `data.type: "snapshot"`; a frame that
      // already carries the event name must land here as well (B-23).
      if (type === 'graph.snapshot' || type === 'snapshot') {
        api.setGraph(payload, asText(data?.instanceId) ?? state.graphId);
        if (state.view === 'graph') emitGraphProbe();
        return { type, repaint: 'graph', refetch: false, indicatorOnly: false, rev: state.graph?.rev ?? null };
      }

      if (type === 'queue.snapshot') {
        // The queue SSE carries the full buildQueue projection as its data.
        const snapshot = data?.payload !== undefined && data?.payload !== null ? data.payload : data;
        if (snapshot && typeof snapshot === 'object' && Array.isArray(snapshot.items)) {
          state.queue = snapshot;
        }
        return { type, repaint: 'queue', refetch: false, indicatorOnly: false, rev: null };
      }

      if (type === 'notify') {
        api.pushNotification(data && typeof data === 'object' ? data : {});
        return { type, repaint: 'notify', refetch: false, indicatorOnly: false, rev: null };
      }

      if (type === 'instances.changed') {
        state.frames.list += 1;
        return { type, repaint: 'list', refetch: true, indicatorOnly: false, rev };
      }

      if (type === 'session.indicator') {
        const sessionKey = key ?? 'session';
        state.frames.session += 1;
        state.indicator[sessionKey] = { ...payload, rev };
        return { type, repaint: 'none', refetch: false, indicatorOnly: true, rev };
      }

      if (type === 'role_instance.updated' || type === 'special_node.updated') {
        const patched = patchNode(state.graph, key, payload);
        if (patched && rev !== null) state.graph.rev = Math.max(state.graph.rev ?? 0, rev);
        if (type === 'role_instance.updated') state.frames.role += 1;
        else state.frames.special += 1;
        return { type, repaint: patched ? 'graph' : 'none', refetch: false, indicatorOnly: false, rev };
      }

      if (type === 'connection.updated') {
        const patched = patchEdge(state.graph, key, payload);
        if (patched && rev !== null) state.graph.rev = Math.max(state.graph.rev ?? 0, rev);
        state.frames.connection += 1;
        return { type, repaint: patched ? 'graph' : 'none', refetch: false, indicatorOnly: false, rev };
      }

      return { type, repaint: 'none', refetch: false, indicatorOnly: false, rev };
    },

    // ------------------------------------------------------------- new panel

    openNewPanel() {
      state.newPanel.open = true;
      state.newPanel.message = null;
      state.newPanel.success = null;
      if (state.newPanel.template.length === 0 && state.templates.length > 0) {
        state.newPanel.template = state.templates[0].id;
      }
      return api;
    },

    closeNewPanel() {
      state.newPanel.open = false;
      return api;
    },

    updateNewPanel(patch) {
      state.newPanel = { ...state.newPanel, ...(patch ?? {}) };
      return api;
    },

    async submitNewPanel() {
      const panel = state.newPanel;
      const verdict = m.validateNewInstance(
        { template: panel.template, task: panel.task },
        state.labels,
      );
      if (!verdict.ok) {
        state.newPanel = { ...panel, message: verdict.message, success: null };
        return { ok: false, message: verdict.message };
      }
      let answer = null;
      try {
        answer = await transport.postInstance?.(m.buildStartRequest({ template: panel.template, task: panel.task }));
      } catch (error) {
        answer = { status: 0, body: { error: 'UNKNOWN_ERROR', message: error?.message ?? String(error) } };
      }
      if (answer && (answer.status === 200 || answer.status === 201) && answer.body?.instanceId) {
        const message = m.renderStarted(answer.body.instanceId, state.labels);
        state.newPanel = { ...panel, open: false, message: null, success: message };
        await api.loadInstances();
        return { ok: true, message };
      }
      const body = answer?.body ?? {};
      const message = m.renderStartFailure(
        { code: body.error, params: body.params, message: body.message },
        state.labels,
      );
      state.newPanel = { ...panel, message, success: null };
      return { ok: false, message };
    },

    // --------------------------------------------------------------- view model

    /**
     * Build the whole view model. Pure with respect to the caller: it reads
     * the state and never changes it (the panel state is copied).
     */
    compose() {
      const connectionText = state.connection.text(state.labels);
      const statusKey = state.connection.textKey();
      const notice = state.notice;
      const projectBlocked = state.view === 'project' || isProjectBlocked(state.project);
      const ready = api.hasLabels();

      const actions = [];
      if (!projectBlocked) {
        if (state.view === 'graph' || state.view === 'board') {
          actions.push({ id: 'back-to-list', text: CONTROL_BACK, title: 'back' });
        }
        if (state.connection.canRetry()) {
          actions.push({ id: 'retry-connection', text: CONTROL_RETRY, title: 'retry' });
        } else if (notice?.retryable) {
          actions.push({ id: 'retry-graph', text: CONTROL_RETRY, title: 'retry' });
        }
      }

      const view = projectBlocked ? 'project' : state.view;
      const model = {
        ready,
        view,
        labels: state.labels,
        statusKey,
        statusText: connectionText,
        notice,
        actions,
        operable: view === 'instances' || actions.length > 0,
        connection: {
          status: state.connection.status(),
          canRetry: state.connection.canRetry(),
          keepsContent: state.connection.keepsContent(),
        },
        projectMessage: projectBlocked
          ? (state.project?.message ?? projectMessage(state.project, state.labels))
          : null,
        rows: [],
        emptyText: null,
        toolbar: [],
        graph: { nodes: [], edges: [], legend: null, focusTitle: null, rows: [], zoom: 1 },
        board: null,
        indicator: { ...state.indicator },
        refetches: state.refetches,
        showNotStarted: state.showNotStarted,
        frames: { ...state.frames },
        panel: {
          ...state.newPanel,
          options: state.templates.slice(),
          title: state.labels.DESKTOP_NEW_TITLE,
          newLabel: state.labels.DESKTOP_NEW_TITLE,
          startText: state.labels.DESKTOP_NEW_ACTION_START,
          cancelText: state.labels.DESKTOP_NEW_ACTION_CANCEL,
        },
        probe: state.graph === null ? null : buildGraphShownProbe(state.graph, state.graphId),
      };

      if (!ready) return model;

      if (view === 'instances') {
        const rows = m.sortInstances(state.instances).map((item) => {
          const readable = item?.readable !== false;
          const row = {
            instanceId: item?.instanceId ?? '',
            readable,
            text: readable
              ? m.renderListRow(item, state.labels)
              : m.renderListUnreadable(item?.instanceId ?? '', state.labels),
            healthText: readable ? m.renderHealthHover(item?.health ?? {}, state.labels) : null,
          };
          return row;
        });
        model.rows = rows;
        model.emptyText = rows.length === 0 ? m.renderListEmpty(state.labels) : null;
        return model;
      }

      if (view === 'board') {
        model.toolbar = toolbar(state);
        model.board = m.projectBoard({
          state: { nodes: boardStateNodes(state.graph) },
          graph: state.graph,
          labels: state.labels,
        });
        return model;
      }

      if (view === 'graph') {
        model.toolbar = toolbar(state);
        model.graph = composeGraph(state, m);
        return model;
      }

      if (view === 'queue') {
        model.queue = composeQueue(state, m);
        return model;
      }
      if (view === 'assets') {
        model.assets = composeAssets(state, m);
        return model;
      }
      if (view === 'occupancy') {
        model.occupancy = composeOccupancy(state, m);
        return model;
      }
      if (view === 'canvas') {
        model.canvas = composeCanvas(state, m);
        return model;
      }
      if (view === 'evidence') {
        model.evidence = composeEvidence(state, m);
        return model;
      }

      return model;
    },
  };

  // ---------------------------------------------------------------- helpers

  /** One label line through the shared resolver (no local template dialect). */
  function noticeText(key, params) {
    return m.resolveLabels(state.labels).text(key, params);
  }

  /**
   * Read the stored view offsets of one instance through the transport seam
   * (AC-22). A missing file, a foreign instance id or a failed read is
   * "no preferences": `null`, never an error.
   */
  async function readOffsets(instanceId) {
    if (typeof transport.readViewOffsets !== 'function') return null;
    const root = typeof state.project?.root === 'string' ? state.project.root : null;
    if (root === null) return null;
    try {
      const stored = await transport.readViewOffsets({ root, instance_id: instanceId });
      if (stored === null || typeof stored !== 'object') return null;
      if (typeof stored.instanceId === 'string' && stored.instanceId !== instanceId) return null;
      const offsets = stored.offsets;
      return offsets !== null && typeof offsets === 'object' && !Array.isArray(offsets) ? offsets : null;
    } catch (error) {
      state.lastError = error?.message ?? String(error);
      return null;
    }
  }

  /**
   * Hand the drag offsets to the shell as `{ root, instance_id, offsets }`
   * (AC-22 / split 3.2): the shell adds `updatedAt` and writes the single-layer
   * file, so the offsets map is never wrapped a second time here.
   */
  async function persistOffsets(offsets) {
    if (typeof transport.writeViewOffsets !== 'function') return;
    const instanceId = state.graphId;
    if (typeof instanceId !== 'string' || instanceId.length === 0) return;
    const root = typeof state.project?.root === 'string' ? state.project.root : null;
    try {
      await transport.writeViewOffsets({ root, instance_id: instanceId, offsets });
    } catch (error) {
      state.lastError = error?.message ?? String(error);
    }
  }

  function emitGraphProbe() {
    const probe = buildGraphShownProbe(state.graph, state.graphId);
    state.probes.push(probe);
    if (typeof transport.probe === 'function') {
      try {
        transport.probe(probe);
      } catch (error) {
        state.lastError = error?.message ?? String(error);
      }
    }
  }

  function toolbar(current) {
    const labels = state.labels;
    const collapse = current.collapse;
    const anyGroup = Array.isArray(collapse?.groups) && collapse.groups.length > 0;
    const allCollapsed = anyGroup
      ? (collapse.collapsedGroupIds ?? []).length === collapse.groups.length
      : false;
    const items = [
      { id: 'view-graph', text: labels.DESKTOP_VIEW_GRAPH, active: current.view === 'graph' },
      { id: 'view-board', text: labels.DESKTOP_VIEW_BOARD, active: current.view === 'board' },
      { id: 'reset-view', text: labels.DESKTOP_VIEW_RESET },
      {
        id: 'toggle-not-started',
        text: current.showNotStarted
          ? labels.DESKTOP_VIEW_HIDE_NOT_STARTED
          : labels.DESKTOP_VIEW_SHOW_NOT_STARTED,
        active: current.showNotStarted,
      },
    ];
    if (anyGroup) {
      items.push({
        id: allCollapsed ? 'expand-groups' : 'collapse-groups',
        text: allCollapsed ? labels.DESKTOP_VIEW_EXPAND_GROUPS : labels.DESKTOP_VIEW_COLLAPSE_GROUPS,
        groupId: allCollapsed ? (collapse.collapsedGroupIds ?? [])[0] ?? null : (collapse.expanded ?? [])[0] ?? null,
      });
    }
    if (current.focus !== null) {
      items.push({ id: 'exit-focus', text: labels.DESKTOP_VIEW_FOCUS_EXIT });
    }
    return items;
  }

  function composeGraph(current, modules) {
    const collapse = current.collapse;
    const layout = current.layout;
    const view = current.viewState;
    if (collapse === null || layout === null || view === null) {
      return { nodes: [], edges: [], legend: null, focusTitle: null, rows: [], zoom: 1 };
    }

    const projections = nodeIndex(current.graph);
    const projectionEdges = edgeIndex(current.graph);
    const displayNodes = new Map();
    for (const node of collapse.nodes) displayNodes.set(node.id, node);

    const highlight = modules.hoverSet(
      { nodes: collapse.nodes, edges: collapse.edges },
      current.hoveredKey,
    );
    const opaque = new Set(highlight.opaqueIds);
    const hovered = current.hoveredKey;
    const visibleNodes = new Set(view.visibleNodeIds());
    const visibleEdges = new Set(view.visibleEdges().map((edge) => edge.id));

    const nodes = [];
    for (const placed of layout.nodes) {
      if (!visibleNodes.has(placed.id)) continue;
      const display = displayNodes.get(placed.id) ?? projections.get(placed.id);
      if (!display) continue;
      const source = projections.get(placed.id) ?? display;
      const style = modules.elementStyle(source, { hoveredKey: hovered, opaqueIds: opaque });
      let row = null;
      try {
        row = display.type === 'role'
          ? modules.renderRoleRow(display, current.labels)
          : modules.renderSpecialRow(display, current.labels);
      } catch {
        row = null;
      }
      if (row === null) {
        row = modules.renderRoleRow(display, current.labels);
      }
      const screen = view.screen(placed);
      nodes.push({
        id: placed.id,
        type: display.type ?? 'role',
        x: screen.x,
        y: screen.y,
        width: screen.width,
        height: screen.height,
        opacity: style.opacity,
        z: style.z,
        animation: style.animation,
        text: row.text,
        visual: row.visual ?? null,
        abnormal: display.abnormal === true,
        collapsed: display.collapsed === true,
      });
    }
    nodes.sort((a, b) => a.z - b.z);

    const labelKeys = new Set(modules.visibleLabels(collapse.edges, hovered));
    const edges = [];
    const edgeRows = [];
    for (const placed of layout.edges) {
      if (!visibleEdges.has(placed.id)) continue;
      const display = collapse.edges.find((edge) => edge.id === placed.id) ?? projectionEdges.get(placed.id);
      if (!display) continue;
      if (!current.showNotStarted && display.aggregateStatus === NOT_STARTED) continue;
      const fromNode = displayNodes.get(display.from) ?? projections.get(display.from) ?? null;
      const toNode = displayNodes.get(display.to) ?? projections.get(display.to) ?? null;
      const annotated = {
        ...display,
        fromTitle: displayNameOf(fromNode, current.labels),
        toTitle: displayNameOf(toNode, current.labels),
      };
      let row;
      try {
        row = modules.renderEdgeRow(annotated, current.labels);
      } catch {
        continue;
      }
      const source = projectionEdges.get(placed.id) ?? display;
      const style = modules.elementStyle(source, { hoveredKey: hovered, opaqueIds: opaque });
      edges.push({
        id: placed.id,
        path: placed.path,
        control: pathControl(view, placed.path),
        from: display.from,
        to: display.to,
        text: labelKeys.has(placed.id) ? row.text : '',
        hoverText: row.hoverText,
        visual: row.visual,
        opacity: style.opacity,
        z: style.z,
      });
      edgeRows.push(row.text);
    }
    edges.sort((a, b) => a.z - b.z);

    const legend = modules.renderLegend(current.labels);
    let focusTitle = null;
    if (current.focus !== null) {
      const target = displayNodes.get(current.focus.nodeId) ?? projections.get(current.focus.nodeId);
      const name = asText(target?.title) ?? current.focus.nodeId;
      focusTitle = noticeText('DESKTOP_VIEW_FOCUS', {
        node: name,
        hops: current.focus.hops ?? 2,
      });
    }

    const rows = [];
    for (const node of collapse.nodes) {
      if (node.type === 'role') rows.push(modules.renderRoleRow(node, current.labels));
      else {
        const special = modules.renderSpecialRow(node, current.labels);
        if (special !== null) rows.push(special);
      }
    }
    for (const text of edgeRows) rows.push({ id: null, type: 'edge', text });

    return { nodes, edges, legend, focusTitle, rows, zoom: view.getZoom() };
  }

  /** Queue page: rows, A-4 actions, prefs toggles, notice and confirm. */
  function composeQueue(current, modules) {
    const labels = current.labels;
    const disconnected = current.connection.status() === 'reconnecting'
      || current.connection.status() === 'failed'
      || current.queue?.disconnected === true;
    const items = Array.isArray(current.queue?.items) ? current.queue.items : [];
    const rows = items.map((item) => {
      const row = modules.renderQueueRow(item, labels);
      return {
        ...row,
        actions: modules.actionsFor(row, labels),
        expanded: current.expandedRow !== null && current.expandedRow === row.key,
        selected: current.selectedQueueIds.includes(row.id) && row.id !== null,
      };
    });
    const strip = modules.stripEntryOf(current.notifications);
    return {
      rows,
      emptyText: rows.length === 0 ? modules.queueEmptyText(labels) : null,
      disconnectedText: disconnected ? modules.queueDisconnectedText(labels) : null,
      prefs: modules.prefsRows(current.queuePrefs, labels),
      notice: current.queueNotice,
      confirm: current.queueConfirm,
      strip,
      controls: CONTROLS.slice(),
    };
  }

  /** Asset library: three tabs, count line, rows and the detail block. */
  function composeAssets(current, modules) {
    const labels = current.labels;
    const kind = current.assetKind;
    const tabs = modules.ASSET_KINDS.map((entry) => ({
      kind: entry,
      text: modules.tabText(entry, labels),
      active: entry === kind,
    }));
    const projection = current.assets ?? {};
    const items = Array.isArray(projection.items) ? projection.items : [];
    const rows = items.map((item) => modules.assetRowText(kind, item, labels));
    return {
      tabs,
      kind,
      countText: projection.dirUnreadable === true
        ? null
        : modules.countText(kind, projection.counts ?? {}, labels),
      dirUnreadableText: projection.dirUnreadable === true
        ? modules.dirUnreadableText(kind, labels)
        : null,
      rows,
      detail: current.assetDetail && current.assetDetail.found !== false
        ? { id: current.assetDetail.id, lines: modules.detailLines(kind, current.assetDetail, labels) }
        : null,
      disconnectedText: current.connection.status() === 'reconnecting' || current.connection.status() === 'failed'
        ? modules.queueDisconnectedText(labels)
        : null,
    };
  }

  /** Occupancy page: one row per role, skipped line and disconnect line. */
  function composeOccupancy(current, modules) {
    const labels = current.labels;
    const rows = Array.isArray(current.occupancy?.rows)
      ? current.occupancy.rows.map((row) => modules.renderOccupancyRow(row, labels))
      : [];
    return {
      rows,
      emptyText: rows.length === 0 ? modules.occupancyEmptyText(labels) : null,
      skippedText: modules.skippedText(current.occupancy?.skipped, labels),
      disconnectedText: current.occupancy?.disconnected === true
        || current.connection.status() === 'reconnecting'
        || current.connection.status() === 'failed'
        ? modules.occupancyDisconnectedText(labels)
        : null,
    };
  }

  /** Canvas page: title, badge, degradation branch and placed rows. */
  function composeCanvas(current, modules) {
    const labels = current.labels;
    const projection = current.canvas;
    if (projection === null) {
      return { title: null, badge: null, rows: [], degrade: modules.canvasDegradeText({ nodes: [] }, labels) };
    }
    const degrade = modules.canvasDegradeText(projection, labels);
    const nodeRows = (Array.isArray(projection.nodes) ? projection.nodes : [])
      .filter((node) => !(degrade.key !== ''))
      .map((node) => modules.canvasNodeRow(node, labels));
    const edgeRows = (Array.isArray(projection.edges) ? projection.edges : [])
      .map((edge) => modules.canvasEdgeRow(edge, labels));
    // Placement comes from the single layout module; the pure view model only
    // maps edges to its input shape (D-23 / D-36).
    const layout = current.canvasLayout ?? { nodes: [], edges: [] };
    const placed = [];
    for (const pos of Array.isArray(layout.nodes) ? layout.nodes : []) {
      const row = nodeRows.find((entry) => entry.id === pos.id);
      if (row) placed.push({ ...row, x: pos.x, y: pos.y, layer: pos.layer });
    }
    return {
      title: modules.canvasTitleText(projection, labels),
      badge: modules.validationBadge(projection, labels),
      degrade,
      nodes: placed,
      edges: edgeRows,
      rows: [...nodeRows.map((row) => row.text), ...edgeRows.map((row) => row.text)].filter((text) => typeof text === 'string'),
    };
  }

  /** Evidence page: A-8 rendered text plus the 64 KB gate result. */
  function composeEvidence(current, modules) {
    const labels = current.labels;
    if (current.evidence === null) {
      return { instanceId: current.evidenceId, text: '', capped: false, bytes: 0, items: [] };
    }
    // RENDER_LIMIT_BYTES is exported for the harness / tests; the view model
    // applies the same default cap itself.
    void RENDER_LIMIT_BYTES;
    return modules.renderEvidence(current.evidence, labels);
  }

  return api;
}

/**
 * Screen position of a layout control point (decision N / B-24): the arc
 * geometry belongs to `layout.js`, the assembly only applies the same linear
 * `zoom` / `pan` transform it applies to the node boxes.
 */
function pathControl(view, path) {
  const ctrl = path?.ctrl;
  if (!ctrl || !Number.isFinite(ctrl.x) || !Number.isFinite(ctrl.y)) return null;
  const point = view.screen({ x: ctrl.x, y: ctrl.y, width: 0, height: 0 });
  return { x: point.x, y: point.y };
}

/**
 * Display name of one edge endpoint (B-29). Group containers carry the raw
 * group id in `title`, so they resolve through the same `GROUP_LABEL_*` keys
 * the group row uses (decision K): `GROUP_LABEL_<UPPER(group)>`, then
 * `GROUP_LABEL_UNGROUPED` for a group without a name, then the raw id.
 */
function displayNameOf(node, labels) {
  if (node === null || typeof node !== 'object') return undefined;
  if (node.type !== 'group') return asText(node.title) ?? undefined;
  const table = labels !== null && typeof labels === 'object' ? labels : {};
  const group = typeof node.group === 'string' && node.group.length > 0 ? node.group : null;
  const key = group === null
    ? 'GROUP_LABEL_UNGROUPED'
    : `GROUP_LABEL_${group.replaceAll('-', '_').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`;
  const name = table[key];
  if (typeof name === 'string' && name.length > 0) return name;
  return asText(node.title) ?? undefined;
}

function patchNode(graph, key, payload) {
  if (graph === null || key === null || !Array.isArray(graph.nodes)) return false;
  const target = graph.nodes.find((node) => node.id === key);
  if (!target) return false;
  Object.assign(target, payload);
  return true;
}

function patchEdge(graph, key, payload) {
  if (graph === null || key === null || !Array.isArray(graph.edges)) return false;
  const target = graph.edges.find((edge) => edge.id === key);
  if (!target) return false;
  Object.assign(target, payload);
  return true;
}

// ---------------------------------------------------------------------------
// DOM painter. `mountApp` is the only entry point the page uses; the painter
// reads `compose()` and writes elements. No wording is authored here.
// ---------------------------------------------------------------------------

const COLOR_TOKENS = Object.freeze({
  red: '#d9483b',
  orange: '#e08a2e',
  yellow: '#cfa62a',
  blue: '#2f6fd0',
  green: '#2f9e6a',
  gray: '#9aa0a6',
});

function paintText(parent, tag, text, attrs = {}) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(name, String(value));
  }
  element.textContent = text ?? '';
  parent.appendChild(element);
  return element;
}

function paintSvgText(parent, x, y, text, attrs = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  element.setAttribute('x', String(x));
  element.setAttribute('y', String(y));
  for (const [name, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(name, String(value));
  }
  element.textContent = text ?? '';
  parent.appendChild(element);
  return element;
}

/**
 * Mount the assembly into the window. `root` is a selector or an element.
 *
 * @param {object} options
 * @param {string|Element} options.root
 * @param {unknown} [options.labels] already fetched label payload
 * @param {object} [options.modules]
 * @param {object} [options.io] transport seam; defaults to loopback fetch
 * @param {{port:number, token:string, project:(string|null)}} [options.credentials]
 * @param {object} [options.project] explicit summary (highest priority)
 */
export function mountApp({
  root,
  labels = null,
  modules = {},
  io = {},
  credentials = null,
  project = null,
} = {}) {
  if (typeof document === 'undefined') {
    throw new TypeError('mountApp: document is not available');
  }
  const host = typeof root === 'string' ? document.querySelector(root) : root;
  if (!host) throw new TypeError('mountApp: root element not found');

  const creds = credentials ?? takeLocationCredentials();
  const injected = typeof window === 'undefined' ? null : (window.__MAESTRO_DESKTOP__ ?? null);
  const mountProject = resolveMountProject({ project, injected, credentials: creds, labels });
  const transport = { ...createLoopbackTransport(creds), ...(io ?? {}) };
  const app = createApp({ labels, project: mountProject ?? undefined, io: transport, modules });

  let lastRowsSignature = '[]';
  function emitProbe(event) {
    if (typeof transport.probe !== 'function') return;
    try {
      transport.probe(event);
    } catch {
      // A broken probe sink must never break painting.
    }
  }

  function paint() {
    const model = app.compose();
    host.replaceChildren();

    const header = document.createElement('header');
    paintText(header, 'h1', 'Maestro', { class: 'title' });
    host.appendChild(header);

    if (model.statusText) {
      paintText(host, 'p', model.statusText, { class: 'status' });
    }
    if (model.notice?.text) {
      const notice = document.createElement('div');
      notice.className = 'notice';
      paintText(notice, 'span', model.notice.text);
      for (const action of model.actions) {
        paintText(notice, 'button', action.text, {
          type: 'button',
          'data-action': action.id,
          title: action.title,
        });
      }
      host.appendChild(notice);
    } else if (model.actions.length > 0 && model.view !== 'instances') {
      const controls = document.createElement('div');
      controls.className = 'controls';
      for (const action of model.actions) {
        paintText(controls, 'button', action.text, {
          type: 'button',
          'data-action': action.id,
          title: action.title,
        });
      }
      host.appendChild(controls);
    }

    if (model.view === 'project') {
      const prompt = document.createElement('section');
      prompt.className = 'prompt';
      paintText(prompt, 'p', model.projectMessage ?? '');
      host.appendChild(prompt);
      return;
    }

    if (model.view === 'instances') {
      const texts = model.rows.map((row) => row.text);
      const signature = JSON.stringify(texts);
      if (texts.length > 0 && signature !== lastRowsSignature) {
        lastRowsSignature = signature;
        emitProbe({ event: 'rows', rows: texts });
      }
      paintList(host, model);
      if (model.panel.open) paintPanel(host, model);
      return;
    }

    if (['queue', 'assets', 'occupancy', 'canvas', 'evidence'].includes(model.view)) {
      paintViewNav(host, model);
      if (model.view === 'queue') paintQueue(host, model);
      else if (model.view === 'assets') paintAssets(host, model);
      else if (model.view === 'occupancy') paintOccupancy(host, model);
      else if (model.view === 'canvas') paintCanvas(host, model);
      else if (model.view === 'evidence') paintEvidence(host, model);
      return;
    }

    paintToolbar(host, model);
    if (model.view === 'board') paintBoard(host, model);
    else paintGraph(host, model);
  }

  /** Shared navigation for the five new views (labels carry all wording). */
  function paintViewNav(container, model) {
    const nav = document.createElement('nav');
    nav.className = 'view-nav';
    for (const { view, text } of viewNavItems(model.labels)) {
      const button = paintText(nav, 'button', text, {
        type: 'button',
        'data-nav': view,
        'aria-pressed': model.view === view ? 'true' : 'false',
      });
      if (model.view === view) button.className = 'active';
    }
    container.appendChild(nav);
  }

  function paintQueue(container, model) {
    const view = model.queue;
    const section = document.createElement('section');
    section.className = 'queue';
    if (view.disconnectedText) paintText(section, 'p', view.disconnectedText, { class: 'disconnected' });
    if (view.strip?.title) {
      paintText(section, 'p', view.strip.title, { class: 'notify-title', 'data-nav': 'queue' });
      if (view.strip.body) paintText(section, 'p', view.strip.body, { class: 'notify-body', 'data-nav': 'queue' });
    }
    // Notification preferences strip at the top of the queue page (U-10).
    const prefs = document.createElement('div');
    prefs.className = 'prefs';
    for (const row of view.prefs) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = row.checked;
      input.setAttribute('data-pref', row.key);
      label.appendChild(input);
      if (row.text) label.appendChild(document.createTextNode(row.text));
      prefs.appendChild(label);
    }
    section.appendChild(prefs);
    if (view.rows.length === 0) {
      paintText(section, 'p', view.emptyText ?? '', { class: 'empty' });
    } else {
      const list = document.createElement('ul');
      for (const row of view.rows) {
        const item = document.createElement('li');
        item.setAttribute('data-queue-row', row.key);
        if (row.selected) item.className = 'selected';
        paintText(item, 'span', row.text ?? '', { class: 'queue-row' });
        if (row.expanded) {
          const controls = document.createElement('div');
          controls.className = 'controls';
          for (const action of row.actions) {
            const button = paintText(controls, 'button', action.text ?? '', {
              type: 'button',
              'data-decision': action.id,
              'data-row': row.key,
              'data-type': row.type ?? '',
              'title': action.hint ?? '',
              disabled: action.disabled ? 'disabled' : null,
            });
            if (action.hint) button.setAttribute('title', action.hint);
          }
          item.appendChild(controls);
        }
        list.appendChild(item);
      }
      section.appendChild(list);
    }
    if (view.confirm) {
      const box = document.createElement('div');
      box.className = 'confirm';
      if (view.confirm.texts.line) paintText(box, 'p', view.confirm.texts.line);
      if (view.confirm.texts.ok) paintText(box, 'button', view.confirm.texts.ok, {
        type: 'button', 'data-confirm': 'ok',
      });
      if (view.confirm.texts.dismiss) paintText(box, 'button', view.confirm.texts.dismiss, {
        type: 'button', 'data-confirm': 'dismiss',
      });
      section.appendChild(box);
    }
    if (view.notice?.text) paintText(section, 'p', view.notice.text, { class: 'queue-notice' });
    container.appendChild(section);
  }

  function paintAssets(container, model) {
    const view = model.assets;
    const section = document.createElement('section');
    section.className = 'assets';
    if (view.disconnectedText) paintText(section, 'p', view.disconnectedText, { class: 'disconnected' });
    const tabs = document.createElement('nav');
    tabs.className = 'asset-tabs';
    for (const tab of view.tabs) {
      const button = paintText(tabs, 'button', tab.text ?? '', {
        type: 'button', 'data-asset-kind': tab.kind,
        'aria-pressed': tab.active ? 'true' : 'false',
      });
      if (tab.active) button.className = 'active';
    }
    section.appendChild(tabs);
    if (view.countText) paintText(section, 'p', view.countText, { class: 'asset-count' });
    if (view.dirUnreadableText) paintText(section, 'p', view.dirUnreadableText, { class: 'dir-unreadable' });
    const list = document.createElement('ul');
    for (const row of view.rows) {
      const item = document.createElement('li');
      item.setAttribute('data-asset', row.id ?? '');
      item.textContent = row.text ?? '';
      list.appendChild(item);
    }
    section.appendChild(list);
    if (view.detail) {
      const detail = document.createElement('section');
      detail.className = 'asset-detail';
      for (const line of view.detail.lines) paintText(detail, 'p', line);
      section.appendChild(detail);
    }
    container.appendChild(section);
  }

  function paintOccupancy(container, model) {
    const view = model.occupancy;
    const section = document.createElement('section');
    section.className = 'occupancy';
    if (view.disconnectedText) paintText(section, 'p', view.disconnectedText, { class: 'disconnected' });
    if (view.rows.length === 0) {
      paintText(section, 'p', view.emptyText ?? '', { class: 'empty' });
    } else {
      const list = document.createElement('ul');
      for (const row of view.rows) paintText(list, 'li', row.text ?? '', { 'data-role': row.roleId });
      section.appendChild(list);
    }
    if (view.skippedText) paintText(section, 'p', view.skippedText, { class: 'skipped' });
    container.appendChild(section);
  }

  function paintCanvas(container, model) {
    const view = model.canvas;
    const section = document.createElement('section');
    section.className = 'canvas-view';
    if (view.title) paintText(section, 'h2', view.title);
    if (view.badge) paintText(section, 'span', view.badge, { class: 'badge' });
    if (view.degrade?.text) {
      paintText(section, 'p', view.degrade.text, { class: 'degrade' });
      for (const reason of view.degrade.reasons ?? []) paintText(section, 'p', reason, { class: 'reason' });
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'definition-canvas');
    svg.setAttribute('width', '100%');
    for (const edge of view.edges) {
      paintSvgText(svg, 0, 0, edge.text ?? '', { 'data-edge': `${edge.from}->${edge.to}` });
    }
    for (const node of view.nodes) {
      paintSvgText(svg, node.x, node.y + 20, node.text ?? '', { 'data-node': node.id });
    }
    section.appendChild(svg);
    container.appendChild(section);
  }

  function paintEvidence(container, model) {
    const view = model.evidence;
    const section = document.createElement('section');
    section.className = 'evidence';
    const pre = document.createElement('pre');
    pre.textContent = view.text ?? '';
    section.appendChild(pre);
    container.appendChild(section);
  }

  function paintList(container, model) {
    const section = document.createElement('section');
    section.className = 'list';
    if (model.rows.length === 0) {
      paintText(section, 'p', model.emptyText ?? '', { class: 'empty' });
    } else {
      const list = document.createElement('ul');
      for (const row of model.rows) {
        const item = document.createElement('li');
        item.setAttribute('data-instance', row.instanceId);
        if (row.healthText) item.setAttribute('title', row.healthText);
        item.textContent = row.text;
        list.appendChild(item);
      }
      section.appendChild(list);
    }
    paintText(section, 'button', model.panel.newLabel ?? '', {
      type: 'button',
      'data-action': 'open-new',
      hidden: model.panel.options.length > 0 ? null : 'hidden',
    });
    container.appendChild(section);
  }

  function paintPanel(container, model) {
    const panel = document.createElement('section');
    panel.className = 'panel';
    paintText(panel, 'h2', model.panel.title ?? '');
    const select = document.createElement('select');
    select.setAttribute('data-field', 'template');
    for (const option of model.panel.options) {
      const entry = document.createElement('option');
      entry.value = option.id;
      entry.textContent = option.title ?? option.id;
      if (option.id === model.panel.template) entry.selected = true;
      select.appendChild(entry);
    }
    panel.appendChild(select);
    const task = document.createElement('textarea');
    task.setAttribute('data-field', 'task');
    task.value = model.panel.task ?? '';
    panel.appendChild(task);
    paintText(panel, 'button', model.panel.startText ?? '', {
      type: 'button',
      'data-action': 'submit-new',
    });
    paintText(panel, 'button', model.panel.cancelText ?? '', {
      type: 'button',
      'data-action': 'close-new',
    });
    if (model.panel.message) paintText(panel, 'p', model.panel.message, { class: 'message' });
    container.appendChild(panel);
  }

  function paintToolbar(container, model) {
    const bar = document.createElement('nav');
    bar.className = 'toolbar';
    for (const item of model.toolbar) {
      const button = paintText(bar, 'button', item.text, {
        type: 'button',
        'data-action': item.id,
        'data-group': item.groupId,
        'aria-pressed': item.active === true ? 'true' : 'false',
      });
      if (item.active === true) button.className = 'active';
    }
    container.appendChild(bar);
    if (model.graph.focusTitle) paintText(container, 'p', model.graph.focusTitle, { class: 'focus' });
  }

  function paintGraph(container, model) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '620');
    svg.setAttribute('class', 'canvas');

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    for (const [name, refX] of [['arrow-forward', 10], ['arrow-back', 0]]) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', name);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', String(refX));
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto');
      const tip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      tip.setAttribute('fill', '#5b6573');
      marker.appendChild(tip);
      defs.appendChild(marker);
    }
    svg.appendChild(defs);

    const edgeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const edge of model.graph.edges) {
      const visual = edge.visual ?? {};
      const color = COLOR_TOKENS[visual.color] ?? '#5b6573';
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const geometry = edgeGeometry(edge, model.graph.nodes);
      path.setAttribute('d', geometry.d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      if (visual.dash === 'dashed') path.setAttribute('stroke-dasharray', '6 4');
      if (visual.arrow === 'back') path.setAttribute('marker-start', 'url(#arrow-back)');
      else path.setAttribute('marker-end', 'url(#arrow-forward)');
      path.setAttribute('opacity', String(edge.opacity ?? 1));
      path.setAttribute('data-element', edge.id);
      path.setAttribute('data-hover', edge.id);
      edgeLayer.appendChild(path);
      if (edge.text) {
        paintSvgText(edgeLayer, geometry.mid.x, geometry.mid.y - 4, edge.text, {
          'font-size': '10',
          fill: color,
          'data-element': edge.id,
        });
      }
    }
    for (const node of model.graph.nodes) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('data-element', node.id);
      group.setAttribute('data-hover', node.id);
      group.setAttribute('data-node', node.id);
      group.setAttribute('opacity', String(node.opacity ?? 1));
      if (node.animation === 'pulse') group.setAttribute('class', 'pulse');
      // Stroke and tint come from the A-9 / A-10 colour token the row
      // renderers produced; abnormality only owns the badge and the pulse.
      const visual = node.visual ?? {};
      const token = visual.statusColor ?? visual.color ?? null;
      const color = COLOR_TOKENS[token] ?? '#c7ced8';
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(node.x));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(node.width));
      rect.setAttribute('height', String(node.height));
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', color);
      rect.setAttribute('fill-opacity', '0.08');
      rect.setAttribute('stroke', color);
      rect.setAttribute('stroke-width', '2');
      group.appendChild(rect);
      if (visual.badge !== null && visual.badge !== undefined) {
        const badge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        badge.setAttribute('cx', String(node.x + node.width - 10));
        badge.setAttribute('cy', String(node.y + 10));
        badge.setAttribute('r', '5');
        badge.setAttribute('fill', color);
        badge.setAttribute('data-badge', String(visual.badge));
        group.appendChild(badge);
      }
      paintSvgText(group, node.x + 10, node.y + 24, node.text, {
        'font-size': '10',
        fill: '#28303b',
      });
      nodeLayer.appendChild(group);
    }
    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);
    container.appendChild(svg);

    const legend = document.createElement('div');
    legend.className = 'legend';
    for (const line of model.graph.legend?.lines ?? []) paintText(legend, 'p', line);
    container.appendChild(legend);

    const rows = document.createElement('ul');
    rows.className = 'rows';
    for (const row of model.graph.rows) paintText(rows, 'li', row.text);
    container.appendChild(rows);
  }

  /**
   * Path data of one edge. The arc control point is already the layout one
   * mapped through the view transform (`edge.control`), so this function
   * draws, never computes geometry (decision N / B-24).
   */
  function edgeGeometry(edge, nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return { d: '', mid: { x: 0, y: 0 } };
    const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    const ctrl = edge.control;
    if (edge.path?.kind === 'arc' && ctrl && Number.isFinite(ctrl.x) && Number.isFinite(ctrl.y)) {
      return {
        d: `M ${a.x} ${a.y} Q ${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`,
        mid: { x: (a.x + 2 * ctrl.x + b.x) / 4, y: (a.y + 2 * ctrl.y + b.y) / 4 },
      };
    }
    return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function paintBoard(container, model) {
    const board = model.board;
    const section = document.createElement('section');
    section.className = 'board';
    if (!board) {
      container.appendChild(section);
      return;
    }
    for (let index = 0; index < board.columns.length; index += 1) {
      const column = document.createElement('div');
      column.className = 'column';
      paintText(column, 'h3', board.columnNames[index] ?? board.columns[index]);
      for (const card of board.cards.filter((entry) => entry.column === board.columns[index])) {
        const line = document.createElement('p');
        line.className = 'card';
        line.textContent = card.title;
        if (card.unknown) line.textContent = `${card.title} ${board.unknownTag ?? ''}`.trim();
        if (card.folded) line.classList.add('folded');
        column.appendChild(line);
      }
      if (board.columns[index] === 'done' && board.cancelledFold) {
        paintText(column, 'p', board.cancelledFold, { class: 'fold' });
      }
      section.appendChild(column);
    }
    container.appendChild(section);
  }

  function handleAction(action, groupId) {
    switch (action) {
      case 'back-to-list':
        app.backToList();
        break;
      case 'retry-connection':
        app.retryConnection();
        void app.start().then(paint);
        return;
      case 'retry-graph':
        void app.retryGraph().then(paint);
        return;
      case 'submit-new':
        void app.submitNewPanel().then(paint);
        return;
      case 'reset-view':
        app.resetView();
        break;
      case 'toggle-not-started':
        app.toggleNotStarted();
        break;
      case 'expand-groups':
      case 'collapse-groups':
        if (groupId) app.toggleGroup(groupId);
        break;
      case 'exit-focus':
        app.escape();
        break;
      case 'view-graph':
        app.setView('graph');
        break;
      case 'view-board':
        app.setView('board');
        break;
      case 'open-new':
        app.openNewPanel();
        break;
      case 'close-new':
        app.closeNewPanel();
        break;
      case 'submit-new':
        void app.submitNewPanel();
        break;
      default:
        return;
    }
    paint();
  }

  host.addEventListener('click', (event) => {
    const nav = event.target.closest?.('[data-nav]') ?? null;
    if (nav) {
      void app.openView(nav.getAttribute('data-nav')).then(paint);
      return;
    }
    const tab = event.target.closest?.('[data-asset-kind]') ?? null;
    if (tab) {
      void app.loadAssets(tab.getAttribute('data-asset-kind')).then(paint);
      return;
    }
    const asset = event.target.closest?.('[data-asset]') ?? null;
    if (asset && asset.getAttribute('data-asset')) {
      void app.loadAssetDetail(app.state().assetKind, asset.getAttribute('data-asset')).then(paint);
      return;
    }
    const confirm = event.target.closest?.('[data-confirm]') ?? null;
    if (confirm) {
      if (confirm.getAttribute('data-confirm') === 'ok') void app.cancelConfirmed().then(paint);
      else app.dismissCancel(), paint();
      return;
    }
    const decision = event.target.closest?.('[data-decision]') ?? null;
    if (decision) {
      void handleQueueDecision(decision);
      return;
    }
    const queueRow = event.target.closest?.('[data-queue-row]') ?? null;
    if (queueRow) {
      app.toggleRow(queueRow.getAttribute('data-queue-row'));
      paint();
      return;
    }
    const button = event.target.closest?.('[data-action]') ?? null;
    if (button) {
      handleAction(button.getAttribute('data-action'), button.getAttribute('data-group'));
      return;
    }
    const row = event.target.closest?.('[data-instance]') ?? null;
    if (row) {
      void app.openGraph(row.getAttribute('data-instance')).then(paint);
    }
  });

  /** Map a decision button to its kind, id and outcome context. */
  async function handleQueueDecision(button) {
    const id = button.getAttribute('data-row');
    const action = button.getAttribute('data-decision');
    const type = button.getAttribute('data-type');
    const items = Array.isArray(app.state().queue?.items) ? app.state().queue.items : [];
    const row = items.find((item) => item?.id === id) ?? {};
    if (action === 'cancel') {
      app.beginCancel(id);
      paint();
      return;
    }
    const kind = type === 'approval' ? 'approval' : 'escalation';
    const decision = action === 'pass' ? 'pass'
      : action === 'retry' ? 'retry'
        : action === 'allow' ? 'allow'
          : 'deny';
    await app.decide(kind, id, decision, {
      type, id, decision, action: row.reasonSummary ?? decision,
    });
    paint();
  }

  host.addEventListener('change', (event) => {
    const pref = event.target.closest?.('[data-pref]') ?? null;
    if (!pref) return;
    void app.saveQueuePrefs({ [pref.getAttribute('data-pref')]: pref.checked }).then(paint);
  });

  host.addEventListener('mouseover', (event) => {
    const element = event.target.closest?.('[data-hover]') ?? null;
    if (!element) return;
    const sets = app.setHover(element.getAttribute('data-hover'));
    const opaque = new Set(sets.opaqueIds);
    for (const painted of host.querySelectorAll('[data-element]')) {
      const id = painted.getAttribute('data-element');
      painted.setAttribute('opacity', opaque.has(id) ? '1' : '0.35');
    }
  });

  host.addEventListener('mouseout', (event) => {
    const element = event.target.closest?.('[data-hover]') ?? null;
    if (!element) return;
    app.setHover(null);
    for (const painted of host.querySelectorAll('[data-element]')) {
      painted.setAttribute('opacity', '1');
    }
  });

  host.addEventListener('dblclick', (event) => {
    const node = event.target.closest?.('[data-node]') ?? null;
    if (!node) return;
    app.focusNode(node.getAttribute('data-node'));
    paint();
  });

  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    app.escape();
    paint();
  };
  document.addEventListener('keydown', onKeyDown);

  // ------------------------------------------------------------------ streams
  let listClose = null;
  let graphClose = null;
  let graphStreamId = null;
  let queueClose = null;
  let notifyClose = null;
  let reconnectTimer = null;

  const stopStreams = () => {
    if (listClose) listClose();
    if (graphClose) graphClose();
    if (queueClose) queueClose();
    if (notifyClose) notifyClose();
    listClose = null;
    graphClose = null;
    graphStreamId = null;
    queueClose = null;
    notifyClose = null;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const scheduleReconnect = () => {
    if (reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      ensureStreams();
    }, 1000);
  };

  function ensureStreams() {
    if (typeof transport.openStream !== 'function') return;
    if (!app.hasLabels()) return;
    if (listClose === null) {
      listClose = transport.openStream(`${origin()}/instances/stream`, {
        onFrame(frame) {
          if (app.state().connection.isPending()) app.state().connection.markReady();
          const result = app.handleFrame(frame);
          if (result.refetch) void app.loadInstances().then(paint);
          else if (result.repaint === 'list') paint();
        },
        onStatus(status) {
          // A graceful EOF is a drop like an error: keep the last frame,
          // show the reconnecting line and retry. An active `destroy()`
          // aborts without reporting, so it never reconnects (B-30).
          if (status === 'error' || status === 'closed') {
            listClose = null;
            app.state().connection.disconnect();
            paint();
            scheduleReconnect();
          }
        },
      });
    }
    const current = app.state();
    if (current.view === 'graph' && current.graphId !== null && current.graphId !== graphStreamId) {
      if (graphClose) graphClose();
      graphStreamId = current.graphId;
      graphClose = transport.openStream(
        `${origin()}/instances/${encodeURIComponent(current.graphId)}/graph/stream`,
        {
          onFrame(frame) {
            if (app.state().connection.isPending()) app.state().connection.markReady();
            const result = app.handleFrame(frame);
            if (result.repaint === 'graph') paint();
          },
          onStatus(status) {
            if (status === 'error' || status === 'closed') {
              graphClose = null;
              graphStreamId = null;
              app.state().connection.disconnect();
              paint();
              scheduleReconnect();
            }
          },
        },
      );
    }
    // Queue snapshot stream (event: queue.snapshot). Kept open for the whole
    // session so the freshest snapshot is always in state when a notification
    // is clicked; the last content is kept on a drop (AC-47 / BR-36).
    if (queueClose === null) {
      queueClose = transport.openStream(`${origin()}/queue/stream`, {
        onFrame(frame) {
          if (app.state().connection.isPending()) app.state().connection.markReady();
          const result = app.handleFrame(frame);
          if (result.repaint === 'queue' && app.state().view === 'queue') paint();
        },
        onStatus(status) {
          if (status === 'error' || status === 'closed') {
            queueClose = null;
            app.state().connection.disconnect();
            paint();
            scheduleReconnect();
          }
        },
      });
    }
    // Notification stream (event: notify). Each intent replaces the previous
    // entry with the same (kind, instanceId) key (D-46).
    if (notifyClose === null) {
      notifyClose = transport.openStream(`${origin()}/notifications/stream`, {
        onFrame(frame) {
          app.handleFrame(frame);
          if (app.state().view === 'queue') paint();
        },
        onStatus(status) {
          if (status === 'error' || status === 'closed') {
            notifyClose = null;
            scheduleReconnect();
          }
        },
      });
    }
  }

  function origin() {
    if (creds) return `http://127.0.0.1:${creds.port}`;
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  }

  const ticker = setInterval(() => {
    const before = app.state().connection.status();
    const after = app.state().connection.tick();
    if (after !== before) {
      paint();
      if (after === 'failed') stopStreams();
    }
  }, 1000);

  // ctl seam (requirement 3.3): the shell asks the live window to refresh the
  // list or open an instance; the window then emits its own probe events. This
  // is a capability probe on the host object, never a test-only branch.
  if (typeof window !== 'undefined') {
    window.__MAESTRO_CTL__ = (action, arg) => {
      if (action === 'refresh-list') {
        void app.loadInstances().then(paint);
      } else if (action === 'open-instance' && typeof arg === 'string') {
        void app.openGraph(arg).then(paint);
      } else if (action === 'open-queue') {
        // I1.11 D-52: shell notify click / tray queue-open lands on the
        // queue view, selecting the entry the shell supplied (AC-04 / AC-49).
        const selected = arg && typeof arg === 'object' && typeof arg.selected === 'string'
          ? [arg.selected] : [];
        void app.followNotification({ kind: 'escalation', ids: selected }).then(paint);
      }
    };
  }

  paint();
  ensureStreams();

  return {
    app,
    paint() {
      paint();
      ensureStreams();
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      clearInterval(ticker);
      stopStreams();
      host.replaceChildren();
    },
  };
}

// ---------------------------------------------------------------------------
// Loopback transport (default). The page is served by the daemon, so the
// origin already points at the loopback port; the bearer token arrives from
// the shell (query string or injected global).
// ---------------------------------------------------------------------------

/**
 * Bearer token kept in memory for this page instance (decision R.3). It is
 * also persisted under one `sessionStorage` key so a reload or a second
 * navigation recovers it; no persistent web storage and no printed token.
 */
let locationToken = null;

/** The single sessionStorage key that may hold the desktop token. */
const TOKEN_STORAGE_KEY = 'maestro.desktop.token';

/** The single sessionStorage key that may hold the shell-supplied project root. */
const PROJECT_STORAGE_KEY = 'maestro.desktop.project';

/** Read the stored token; absent storage or a throwing getter is "none". */
function readStoredToken() {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    if (storage === null || typeof storage.getItem !== 'function') return null;
    const value = storage.getItem(TOKEN_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the token best-effort; a blocked storage is a silent no-op. */
function writeStoredToken(token) {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    if (storage === null || typeof storage.setItem !== 'function') return;
    storage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // A disabled / private storage must never break the page.
  }
}

/** Read the stored project root; absent storage or a throwing getter is "none". */
function readStoredProject() {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    if (storage === null || typeof storage.getItem !== 'function') return null;
    const value = storage.getItem(PROJECT_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the project root best-effort; a blocked storage is a silent no-op. */
function writeStoredProject(root) {
  try {
    const storage = typeof globalThis.sessionStorage === 'undefined' ? null : globalThis.sessionStorage;
    if (storage === null || typeof storage.setItem !== 'function') return;
    storage.setItem(PROJECT_STORAGE_KEY, root);
  } catch {
    // A disabled / private storage must never break the page.
  }
}

/**
 * Read the credential once: `?token=` from the page URL (decision M), then the
 * sessionStorage copy (decision R.3 / R-04), then the injected
 * `__MAESTRO_DESKTOP__.token` global. A query value is written back to memory
 * and to the single sessionStorage key, then scrubbed from the address bar
 * (`history.replaceState`). The shell-supplied `?project=` (decision Q) is
 * captured in the same pass.
 *
 * Safe without a DOM or a storage implementation: a test process that merely
 * imports this module calls nothing here.
 */
export function takeLocationCredentials() {
  const injected = typeof window === 'undefined' ? {} : (window.__MAESTRO_DESKTOP__ ?? {});
  const location = typeof window === 'undefined' ? null : window.location ?? null;
  let queryPort = null;
  let queryProject = null;
  let queryToken = null;
  if (location !== null) {
    try {
      const params = new URLSearchParams(typeof location.search === 'string' ? location.search : '');
      const token = params.get('token');
      queryPort = params.get('port');
      // Decision Q (Q-1): the shell also hands over the project root it opened,
      // so the window assembles with a real `project.root` instead of null.
      const project = params.get('project');
      if (typeof project === 'string' && project.trim().length > 0) queryProject = project.trim();
      if (typeof token === 'string' && token.length > 0) queryToken = token;
      if (params.has('token') || params.has('project')) {
        params.delete('token');
        params.delete('project');
        const rest = params.toString();
        const path = typeof location.pathname === 'string' ? location.pathname : '';
        const hash = typeof location.hash === 'string' ? location.hash : '';
        const next = `${path}${rest.length > 0 ? `?${rest}` : ''}${hash}`;
        window.history?.replaceState?.(null, '', next);
      }
    } catch {
      // A hostile URL or a missing history must never block the page.
    }
  }
  // Priority: query > sessionStorage > injected global > in-memory cache. The
  // cache is the last resort for environments without a usable storage; a real
  // source (query / storage / injected) always outranks a stale cached value.
  const token = queryToken ?? readStoredToken() ?? injected.token ?? locationToken ?? null;
  if (token !== null) {
    locationToken = token;
    if (queryToken !== null) writeStoredToken(queryToken);
  }
  // Decision R.10: a reload keeps the project root too, not only the token.
  const project = queryProject ?? readStoredProject();
  if (project !== null && queryProject !== null) writeStoredProject(queryProject);
  const port = queryPort ?? injected.port ?? (location === null ? null : location.port || null);
  if (port === null || token === null) return null;
  return { port: Number(port), token: String(token), project };
}

/**
 * Project summary the window mounts with (decision Q / Q-1). Priority is the
 * explicit argument, then the injected `__MAESTRO_DESKTOP__` global, then the
 * `project` query value the shell appended to the navigation URL. The query
 * value is a bare root, so it goes through the same resolver as `--project`
 * (only the syntactic shape is checked here; the shell already validated the
 * directory before navigating).
 */
export function resolveMountProject({
  project = null,
  injected = null,
  credentials = null,
  labels = null,
} = {}) {
  const direct = project ?? injected?.project ?? null;
  if (direct !== null && direct !== undefined) return direct;
  const root = typeof credentials?.project === 'string' ? credentials.project : null;
  if (root === null || root.length === 0) return null;
  return resolveProject({ argRoot: root, labels });
}

/**
 * Parse one SSE block into a frame. The event name wins over `data.type`:
 * the daemon sends the first frame as `event: graph.snapshot` with
 * `data.type: "snapshot"`, and the dispatch table keys on event names (B-23).
 */
export function parseSseBlock(block) {
  let eventName = null;
  let dataLine = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
  }
  if (eventName === null) return null;
  let payload = {};
  try {
    payload = JSON.parse(dataLine || '{}');
  } catch {
    payload = {};
  }
  return { event: eventName, data: payload, type: eventName };
}

function openStream(url, token, { onFrame, onStatus } = {}) {
  const controller = new AbortController();
  let finished = false;
  const finish = (status, error) => {
    if (finished) return;
    finished = true;
    onStatus?.(status, error);
  };
  (async () => {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const index = buffer.indexOf('\n\n');
        if (index < 0) break;
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const frame = parseSseBlock(block);
        if (frame) onFrame?.(frame);
      }
    }
    finish('closed');
  })().catch((error) => {
    if (controller.signal.aborted) finish('closed');
    else finish('error', error);
  });
  return () => {
    finished = true;
    controller.abort();
  };
}

/**
 * The shell bridge when the page runs inside the WebView. Tauri 2 injects
 * `window.__TAURI__` only with `app.withGlobalTauri`; the internals object is
 * the fallback for builds where that flag is absent (decision V).
 */
function tauriInvoke() {
  const win = globalThis.window;
  if (!win) return null;
  const bridge = win.__TAURI__;
  const invoke = bridge?.core?.invoke
    ?? bridge?.invoke
    ?? win.__TAURI_INTERNALS__?.invoke;
  return typeof invoke === 'function' ? invoke : null;
}

/**
 * Loopback transport used by the window. Every REST call carries the Bearer
 * token; the two view-preference calls go through the shell so the file lives
 * under `.orch/desktop/views/` (AC-22).
 *
 * @param {{port: number, token: string}|null} creds
 * @returns {object} the transport seam consumed by `createApp`
 */
export function createLoopbackTransport(creds) {
  const base = creds ? `http://127.0.0.1:${creds.port}` : '';
  const headers = creds
    ? { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const request = async (pathname, init = {}) => {
    try {
      const res = await fetch(`${base}${pathname}`, { headers, ...init });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    } catch (error) {
      return { status: 0, body: null, error: error?.message ?? String(error) };
    }
  };
  return {
    getLabels: () => request('/ui/labels'),
    getInstances: () => request('/instances'),
    getWorkflows: () => request('/workflows'),
    getGraph: (instanceId) => request(`/instances/${encodeURIComponent(instanceId)}/graph`),
    postInstance: (payload) => request('/instances', { method: 'POST', body: JSON.stringify(payload) }),
    // ---- I1.11 WP-8 read projections and single-item write seam ----
    getQueue: () => request('/queue'),
    getAssets: (kind) => request(`/assets/${encodeURIComponent(kind)}`),
    getAsset: (kind, id) => request(`/assets/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`),
    getOccupancy: () => request('/occupancy/roles'),
    getCanvas: (id) => request(`/workflows/${encodeURIComponent(id)}/canvas`),
    getEvidence: (instanceId, nodeId) => nodeId
      ? request(`/evidence/${encodeURIComponent(instanceId)}/${encodeURIComponent(nodeId)}`)
      : request(`/evidence/${encodeURIComponent(instanceId)}`),
    getPrefs: () => request('/ui/prefs'),
    postPrefs: (patch) => request('/ui/prefs', { method: 'POST', body: JSON.stringify(patch) }),
    postEscalationDecision: (id, decision) => request(
      `/queue/escalations/${encodeURIComponent(id)}/decision`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    ),
    postApprovalDecision: (id, decision) => request(
      `/queue/approvals/${encodeURIComponent(id)}/decision`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    ),
    postCancel: (id) => request(`/instances/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
    // The shell wraps the map into `{ offsets, updatedAt }` (split 3.2), so
    // the invoke argument is the offsets map itself, never a second envelope.
    writeViewOffsets: async ({ root, instance_id: instanceId, offsets } = {}) => {
      const invoke = tauriInvoke();
      if (invoke === null || typeof root !== 'string') return;
      await invoke('write_view_command', { root, instance_id: instanceId, offsets });
    },
    readViewOffsets: async ({ root, instance_id: instanceId } = {}) => {
      const invoke = tauriInvoke();
      if (invoke === null || typeof root !== 'string') return null;
      return invoke('read_view_command', { root, instance_id: instanceId });
    },
    probe: (event) => {
      const sink = globalThis.window?.__MAESTRO_PROBE__;
      if (typeof sink === 'function') sink(event);
      const payload = JSON.stringify(event);
      const invoke = tauriInvoke();
      if (invoke !== null) {
        try {
          const result = invoke('probe_emit', { payload });
          if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch {
          // A missing bridge must never break rendering.
        }
      }
      // Decision W: a WebView served from the loopback http origin has no
      // Tauri IPC, so the same window-built event is mirrored through the
      // daemon. That endpoint exists only in the acceptance environment.
      void request('/__test__/window-probe', { method: 'POST', body: payload });
    },
    openStream: (url, handlers) => openStream(url, creds?.token ?? '', handlers),
  };
}

// The page entry lives in `index.html`: it imports `mountApp` and starts the
// assembly. This module stays free of a document-presence branch so the same
// code path is imported directly by tests and by the window.
