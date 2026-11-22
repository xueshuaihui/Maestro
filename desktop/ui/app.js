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

import {
  describeListRow,
  renderListEmpty,
  renderListRow,
  renderListUnreadable,
  sortInstances,
} from './list/list.js';
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
import { fillTemplate, resolveLabels, visibleLabels } from './labels/labels.js';
import { projectBoard } from './board/board.js';
import { createConnectionState } from './connection.js';
import { isProjectBlocked, projectMessage, resolveProject } from './project.js';
// I1.10b WP-4: the drill layer is a pure module; the assembly only feeds it
// frozen projections plus label keys. No second renderer, no transport inside.
import { createDrillView } from './drill/index.js';
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
// beta.2 shell: presentation layer split into chrome / pages / graph / drill.
// The assembly keeps the seam (`createApp`) and delegates every pixel to it.
import { closePalette, paletteOpen, renderShell, shellRefs, showToast } from './shell/index.js';
import { crumbsFor, openPalette } from './shell/chrome.js';

const DEFAULT_MODULES = Object.freeze({
  describeListRow,
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
  createDrillView,
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

/**
 * The served table has no standalone instances nav label. The row template's
 * leading noun is the authoritative wording (`<noun> {id} · ...`), so derive it
 * instead of authoring a second Chinese literal in the UI layer.
 */
export function instancesTitle(labels) {
  const row = labels?.DESKTOP_LIST_ROW;
  if (typeof row === 'string') {
    const head = row.split('\u00b7')[0].replace(/\{[^}]+\}/g, '').trim();
    if (head.length > 0) return head;
  }
  return 'Maestro';
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
    newPanel: {
      open: false,
      template: '',
      task: '',
      message: null,
      success: null,
      submitting: false,
    },
    refetches: 0,
    frames: { role: 0, connection: 0, special: 0, session: 0, list: 0 },
    probes: [],
    lastError: null,

    // ---- I1.10b WP-4: drill / subflow / detail / escalation-panel assembly ----
    // The drill context is a pure description fed by `createDrillView`; the
    // assembly never renders nor transports on its own.
    drill: null,          // { instanceId, roleId, breadcrumbKey }
    drillData: null,      // frozen projection payload used to build `drillView`
    drillView: null,      // createDrillView output (scrollTarget/highlight/...)
    subflowStack: [],     // sub-workflow level stack (AC-17/36)
    detail: null,         // node detail context { nodeId, breadcrumb }
    escalationPanel: null,// escalation panel context { instanceId, breadcrumb }
    connectionPanel: null,// connection panel context { edgeId }
    returnFromBoard: null,// view to restore after the shared board (AC-16)
    escalationNotice: null,
    // Injected-clock timing (internal assertions only, never user-visible).
    drillTiming: { enteredAt: null, frameAt: null },
    // Read-only / stability counters (AC-28 internal assertions).
    opCount: 0,
    fetchCount: 0,
    fetchesThisView: 0,
    maxFetchesPerView: 1,
    crashCount: 0,
    daemonRestarts: 0,
    // Graph-stream seam (contract A5): tracked so the drill view can observe
    // that the SAME graph stream was kept / reopened, without a new channel.
    graphStreamOpens: 0,
    graphStreamReopened: false,
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
    // ---- beta.2 shell state (appended last so existing snapshots keep order)
    listFilter: 'all',    // instance list filter token
    newForm: null,        // { workflow, task } mirrored from the panel
    evidenceNode: null,   // selected node id on the evidence page
    nodeDrawer: null,     // { nodeId, from, view } right-hand drawer
    connectionDrawer: null, // { edgeId, view }
    escalationDrawer: null, // { escalationId, view }
    drawerOpen: false,    // drawer visibility mirror for the assembler
    routeHistory: [],     // { view, instanceId } stack for the back action
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

    /**
     * One label line, resolved against the delivered table.
     *
     * The shell layer (`mountApp`) lives outside this closure, so it reaches
     * the resolver through this one method instead of re-deriving templates:
     * a missing table yields an empty string, never a throw.
     */
    text(key, params) {
      return noticeText(key, params);
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
     * Contract A4: optional transport seam for the single write action. When
     * a caller injects `io.continueEscalation` (shape identical to the daemon
     * return) it is used verbatim; otherwise a real loopback POST is issued.
     * The raw error codes never reach this layer: only `messageKey` selects a
     * notice branch and `message` is passed through opaquely.
     */
    async continueEscalation({ instanceId, escalationId } = {}) {
      let answer = null;
      try {
        if (typeof transport.continueEscalation === 'function') {
          answer = await transport.continueEscalation({ instanceId, escalationId });
        } else if (typeof transport.postContinueEscalation === 'function') {
          answer = await transport.postContinueEscalation({ instanceId, escalationId });
        }
      } catch (error) {
        answer = { ok: false, message: error?.message ?? String(error) };
      }
      const result = answer !== null && typeof answer === 'object' ? answer : { ok: false };
      const id = result.escalationId ?? escalationId ?? '';
      if (result.ok === true) {
        state.escalationNotice = {
          key: 'DRILL_ESC_DONE',
          text: noticeText('DRILL_ESC_DONE', { id }),
          retryable: false,
        };
      } else if (result.messageKey === 'DRILL_ESC_ALREADY') {
        // Wording comes from the message key; the raw error code never reaches
        // this layer and the daemon `message` is not re-authored here.
        state.escalationNotice = {
          key: result.messageKey,
          text: noticeText('DRILL_ESC_ALREADY', {
            id,
            // J-2: {state} comes from the daemon's structural `stateLabel`
            // (CLI labels is the single source of user-visible wording), not a
            // key that is absent from the frozen 63-key table.
            state: asText(result.stateLabel) ?? '',
          }),
          retryable: false,
        };
      } else if (result.messageKey === 'DRILL_ESC_NOT_SUSPENDED') {
        state.escalationNotice = {
          key: result.messageKey,
          text: noticeText('DRILL_ESC_NOT_SUSPENDED', {}),
          retryable: false,
        };
      } else {
        // Failure passthrough: the `message` is the existing error text, never
        // translated or invented here (AC-45).
        state.escalationNotice = {
          key: 'DRILL_ESC_FAILED',
          text: noticeText('DRILL_ESC_FAILED', { reason: asText(result.message) ?? '' }),
          retryable: true,
        };
      }
      return result;
    },

    /**
     * Graph-stream seam (contract A5). Called by `mountApp.ensureStreams()`
     * whenever the SAME graph stream is opened or reopened,
     * including while `view === 'drill'`. Tracking here lets the drill view
     * observe a reopen without any second channel or new frame type.
     */
    noteGraphStreamOpen() {
      state.graphStreamOpens += 1;
      if (state.graphStreamOpens > 1) state.graphStreamReopened = true;
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

    // --------------------------------------------------- I1.10b drill nav (WP-4)

    /**
     * Enter the role drill-down view. `data` is the frozen drill projection
     * (breadcrumb / roleBar / dag / cards / ...); the assembly only builds the
     * description object. Graph view state is deliberately left untouched so
     * a later `backToGraph()` can restore it verbatim (contract A3 / AC-02).
     */
    openDrill({ instanceId, roleId, data, breadcrumbKey = 'DRILL_CRUMB_ROLE', now } = {}) {
      const id = typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : state.graphId;
      state.drill = {
        instanceId: id ?? null,
        roleId: roleId ?? null,
        breadcrumbKey,
      };
      state.drillData = data !== null && typeof data === 'object' ? data : {};
      if (typeof now !== 'undefined') state.drillData.now = now;
      state.detail = null;
      state.escalationPanel = null;
      state.subflowStack = [];
      state.view = 'drill';
      rebuildDrillView();
      state.drillTiming.enteredAt = typeof transport.now === 'function' ? transport.now() : (now ?? null);
      state.drillTiming.frameAt = state.drillTiming.enteredAt;
      bumpOp();
      beginViewFetch();
      return api;
    },

    /**
     * Contract A3: return from drill to the flow graph while preserving the
     * five groups of view-state values (zoom / pan / offsets / collapse /
     * focus). This is a NEW path; it never calls `backToList()` (which nulls
     * `viewState`) nor `openGraph()` / `rebuildGraph()` (which recreate it).
     */
    backToGraph() {
      state.view = 'graph';
      state.drill = null;
      state.drillData = null;
      state.drillView = null;
      state.detail = null;
      state.escalationPanel = null;
      state.connectionPanel = null;
      state.subflowStack = [];
      state.returnFromBoard = null;
      bumpOp();
      return api;
    },

    /** AC-16: switch to the shared 7-column board, remembering the drill. */
    openAllNodes() {
      if (state.drill !== null) state.returnFromBoard = 'drill';
      state.view = 'board';
      bumpOp();
      beginViewFetch();
      return api;
    },

    /** AC-16: return from the shared board to the drill (not the graph). */
    backToDrill() {
      state.view = state.returnFromBoard === 'drill' && state.drillView !== null ? 'drill' : 'graph';
      state.returnFromBoard = null;
      bumpOp();
      return api;
    },

    /** Enter a node detail view (AC-20 human node / node from card). */
    openNodeDetail({ nodeId, data, breadcrumbKey = 'DRILL_CRUMB_NODE' } = {}) {
      state.detail = { nodeId: nodeId ?? data?.node?.nodeId ?? null, breadcrumbKey };
      state.detail.data = data !== null && typeof data === 'object' ? data : {};
      state.view = 'node-detail';
      state.detail.view = finalizeBreadcrumb(m.createDrillView({
        labels: state.labels,
        data: { ...state.drillData, detail: state.detail.data },
        interactions: { now: state.drillData?.now, clock: transport.now },
      }));
      bumpOp();
      beginViewFetch();
      return api;
    },

    /**
     * Enter the escalation panel. Both entry points (escalate node AC-21 and
     * escalated badge AC-49) land on THIS same view/state; only the breadcrumb
     * differs. `view === 'escalation-panel'` is never `'drill'`.
     */
    openEscalationPanel({ instanceId, data, breadcrumbKey = 'DRILL_CRUMB_NODE' } = {}) {
      state.escalationPanel = {
        instanceId: instanceId ?? state.graphId ?? null,
        breadcrumbKey,
        data: data !== null && typeof data === 'object' ? data : {},
      };
      state.view = 'escalation-panel';
      state.escalationPanel.view = finalizeBreadcrumb(m.createDrillView({
        labels: state.labels,
        data: { escalations: state.escalationPanel.data },
        interactions: { clock: transport.now },
      }));
      state.escalationNotice = null;
      bumpOp();
      beginViewFetch();
      return api;
    },

    /** Enter a connection / handoff panel (AC-19 / AC-51). */
    openConnectionPanel({ edgeId, data } = {}) {
      state.connectionPanel = {
        edgeId: edgeId ?? null,
        data: data !== null && typeof data === 'object' ? data : {},
      };
      state.view = 'connection-panel';
      bumpOp();
      beginViewFetch();
      return api;
    },

    /** Push one sub-workflow level (AC-17 / AC-36). */
    openSubflow({ data } = {}) {
      state.subflowStack.push(data !== null && typeof data === 'object' ? data : {});
      state.view = 'subflow';
      bumpOp();
      beginViewFetch();
      return api;
    },

    /** Pop one sub-workflow level; empty stack returns to the flow graph. */
    backSubflow() {
      state.subflowStack.pop();
      state.view = state.subflowStack.length > 0 ? 'subflow' : 'graph';
      bumpOp();
      return api;
    },

    retryConnection() {
      state.connection.retry();
      return api;
    },

    // --------------------------------------------------- beta.2 user entry points
    // These are the paths a real click uses. They fetch the same frozen
    // projections the acceptance seam receives through `io`, so the DOM and the
    // harness share one data source (`openDrill` / `openNodeDetail` / ...).

    /** Remember the page we came from so `back()` returns verbatim. */
    pushRoute() {
      state.routeHistory.push({ view: state.view, instanceId: state.graphId });
      if (state.routeHistory.length > 24) state.routeHistory.shift();
      return api;
    },

    /** Back one step; unknown history falls back to the instance list. */
    back() {
      const previous = state.routeHistory.pop();
      if (previous === undefined) {
        state.view = 'instances';
        state.graphId = null;
        state.graph = null;
        return api;
      }
      state.view = previous.view;
      if (previous.instanceId !== state.graphId) {
        state.graphId = previous.instanceId ?? null;
      }
      return api;
    },

    /** Open the role drill of one role through the daemon projection. */
    async openRoleDrill(roleId) {
      const instanceId = state.graphId;
      if (instanceId === null || typeof roleId !== 'string' || roleId.length === 0) return api;
      let data = {};
      if (typeof transport.getDrill === 'function') {
        try {
          const answer = await transport.getDrill(instanceId, roleId);
          if (answer?.status === 200 && answer.body !== null && typeof answer.body === 'object') data = answer.body;
        } catch {
          data = {};
        }
      }
      api.pushRoute();
      api.openDrill({ instanceId, roleId, data });
      return api;
    },

    /** Node detail as a right-hand drawer, keeping the page underneath. */
    async openNodeDrawer({ nodeId } = {}) {
      const instanceId = state.graphId ?? state.drill?.instanceId ?? null;
      if (instanceId === null || typeof nodeId !== 'string' || nodeId.length === 0) return api;
      let data = {};
      if (typeof transport.getNode === 'function') {
        try {
          const answer = await transport.getNode(instanceId, nodeId);
          if (answer?.status === 200 && answer.body !== null && typeof answer.body === 'object') data = answer.body;
        } catch {
          data = {};
        }
      }
      state.nodeDrawer = {
        nodeId,
        from: state.view,
        view: m.createDrillView({
          labels: state.labels,
          data: { detail: data, breadcrumb: { key: 'DRILL_CRUMB_NODE', instanceId } },
          interactions: { clock: transport.now },
        }),
      };
      state.drawerOpen = true;
      return api;
    },

    /** Handoff panel as a drawer (never the escalation panel, AC-51). */
    async openConnectionDrawer({ edgeId } = {}) {
      const instanceId = state.graphId ?? state.drill?.instanceId ?? null;
      if (instanceId === null || typeof edgeId !== 'string' || edgeId.length === 0) return api;
      let data = {};
      if (typeof transport.getConnection === 'function') {
        try {
          const answer = await transport.getConnection(instanceId, edgeId);
          if (answer?.status === 200 && answer.body !== null && typeof answer.body === 'object') data = answer.body;
        } catch {
          data = {};
        }
      }
      state.connectionDrawer = {
        edgeId,
        view: m.createDrillView({
          labels: state.labels,
          data: { connection: data },
          interactions: { clock: transport.now },
        }),
      };
      state.drawerOpen = true;
      return api;
    },

    /** Escalation panel as a drawer, fetched per instance. */
    async openEscalationDrawer({ escalationId } = {}) {
      const instanceId = state.graphId ?? state.drill?.instanceId ?? null;
      if (instanceId === null) return api;
      let data = {};
      if (typeof transport.getEscalations === 'function') {
        try {
          const answer = await transport.getEscalations(instanceId);
          if (answer?.status === 200 && answer.body !== null && typeof answer.body === 'object') data = answer.body;
        } catch {
          data = {};
        }
      }
      state.escalationDrawer = {
        escalationId: escalationId ?? null,
        view: m.createDrillView({
          labels: state.labels,
          data: { escalations: data },
          interactions: { clock: transport.now },
        }),
      };
      state.drawerOpen = true;
      return api;
    },

    /** Open one special node: human -> drawer, escalate -> escalation panel. */
    async openSpecialNode({ nodeId, type } = {}) {
      if (typeof nodeId !== 'string' || nodeId.length === 0) return api;
      if (type === 'escalate') {
        await api.openEscalationDrawer({ escalationId: nodeId });
      } else if (type === 'subworkflow') {
        let data = {};
        const instanceId = state.graphId;
        if (instanceId !== null && typeof transport.getSubflow === 'function') {
          try {
            const answer = await transport.getSubflow(instanceId, nodeId);
            if (answer?.status === 200 && answer.body !== null && typeof answer.body === 'object') {
              data = { ...answer.body, instanceId };
            }
          } catch {
            data = {};
          }
        }
        api.pushRoute();
        api.openSubflow({ data });
      } else {
        await api.openNodeDrawer({ nodeId });
      }
      return api;
    },

    /** Close any open drawer and forget its cached signature. */
    closeDrawer() {
      state.nodeDrawer = null;
      state.connectionDrawer = null;
      state.escalationDrawer = null;
      state.drawerOpen = false;
      return api;
    },

    /** Pause / resume through the control endpoints (real server side). */
    async pauseInstance(instanceId) {
      if (typeof transport.postControl === 'function' && typeof instanceId === 'string') {
        try {
          await transport.postControl('pause', instanceId);
        } catch {
          // A failed control call keeps the page; the stream shows the truth.
        }
      }
      return api;
    },

    async resumeInstance(instanceId) {
      if (typeof transport.postControl === 'function' && typeof instanceId === 'string') {
        try {
          await transport.postControl('resume', instanceId);
        } catch {
          // Same degradation rule as pause.
        }
      }
      return api;
    },

    /** Zoom the flow graph by one step (0.4x .. 2.4x clamp lives in view.js). */
    zoom(direction) {
      const view = state.viewState;
      if (view === null || typeof view?.setZoom !== 'function') return api;
      const current = typeof view.getZoom === 'function' ? view.getZoom() : 1;
      view.setZoom(direction === 'in' ? current * 1.2 : current / 1.2);
      return api;
    },

    /** Native folder picker + daemon rebind (first-run project page). */
    async pickProject() {
      const invoke = tauriInvoke();
      if (invoke === null) return api;
      let picked = null;
      try {
        picked = await invoke('pick_project');
      } catch {
        picked = null;
      }
      if (typeof picked !== 'string' || picked.length === 0) return api;
      try {
        await invoke('open_project', { root: picked });
      } catch {
        // A failed bind keeps the current page; the connection line shows it.
        return api;
      }
      state.project = resolveProject({ root: picked, message: null });
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.location.reload();
      }
      return api;
    },

    /** Which host session the current drill / detail points at, if any. */
    hostSession() {
      const view = state.nodeDrawer?.view ?? state.drillView ?? null;
      const jump = view?.hostJump ?? null;
      const id = jump?.sessionId ?? jump?.session ?? null;
      return typeof id === 'string' && id.length > 0 ? id : null;
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
      // beta.2 shell surfaces: these render from projections that are already
      // in memory (rows, notifications, prefs), so they switch unconditionally
      // as well and never leave the sidebar dead.
      if (['new', 'overview', 'governance', 'settings', 'notifications', 'project'].includes(view)) {
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
        await Promise.all([api.loadQueue(), api.loadQueuePrefs()]);
      } else if (view === 'settings') {
        await api.loadQueuePrefs();
      } else if (view === 'new') {
        if (state.templates.length === 0) await api.loadTemplates();
        // Seed the first workflow only when nothing is chosen yet, so a task
        // already typed is never thrown away by a re-visit.
        if (!state.newPanel.template && state.templates.length > 0) {
          api.updateNewPanel({ template: state.templates[0].id, message: null });
        }
        if (state.newPanel.open !== true) api.updateNewPanel({ open: true });
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
      const inDrill = state.view === 'drill' && state.drillData !== null;

      // D-2: the first frame (and every reconnect frame) is
      // `event: graph.snapshot` with `data.type: "snapshot"`; a frame that
      // already carries the event name must land here as well (B-23).
      // In drill view the reconnect first frame is a partial refetch: role
      // bar + cards are replaced, the DAG is kept, and the graph view state
      // is NOT replayed (AC-50 / F4-13). Outside drill the path is unchanged.
      if (type === 'graph.snapshot' || type === 'snapshot') {
        if (inDrill) {
          refetchDrill(payload);
          state.graph = payload && typeof payload === 'object' ? payload : state.graph;
          return { type, repaint: 'drill', refetch: false, indicatorOnly: false, rev };
        }
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
        const drillApplied = inDrill ? applyDrillFrame('session.indicator', payload) : false;
        return { type, repaint: drillApplied ? 'drill' : 'none', refetch: false, indicatorOnly: true, rev };
      }

      if (type === 'role_instance.updated' || type === 'special_node.updated') {
        const patched = patchNode(state.graph, key, payload);
        if (patched && rev !== null) state.graph.rev = Math.max(state.graph.rev ?? 0, rev);
        if (type === 'role_instance.updated') state.frames.role += 1;
        else state.frames.special += 1;
        const drillApplied = inDrill ? applyDrillFrame(type, payload) : false;
        return { type, repaint: drillApplied ? 'drill' : (patched ? 'graph' : 'none'), refetch: false, indicatorOnly: false, rev };
      }

      if (type === 'connection.updated') {
        const patched = patchEdge(state.graph, key, payload);
        if (patched && rev !== null) state.graph.rev = Math.max(state.graph.rev ?? 0, rev);
        state.frames.connection += 1;
        const drillApplied = inDrill ? applyDrillFrame('connection.updated', payload) : false;
        return { type, repaint: drillApplied ? 'drill' : (patched ? 'graph' : 'none'), refetch: false, indicatorOnly: false, rev };
      }

      return { type, repaint: 'none', refetch: false, indicatorOnly: false, rev };
    },

    // ------------------------------------------------------------- new panel

    openNewPanel(template) {
      const fallback = state.templates.length > 0 ? state.templates[0].id : '';
      const chosen = typeof template === 'string' && template.length > 0 ? template : fallback;
      state.newPanel = {
        open: true,
        template: chosen,
        task: '',
        message: null,
        success: null,
        submitting: false,
      };
      return api;
    },

    closeNewPanel() {
      state.newPanel = { ...state.newPanel, open: false, submitting: false };
      return api;
    },

    updateNewPanel(patch) {
      state.newPanel = { ...state.newPanel, ...(patch ?? {}) };
      return api;
    },

    async submitNewPanel() {
      const panel = state.newPanel;
      if (panel.submitting) return { ok: false, message: panel.message };
      const verdict = m.validateNewInstance(
        { template: panel.template, task: panel.task },
        state.labels,
      );
      if (!verdict.ok) {
        state.newPanel = { ...panel, submitting: false, message: verdict.message, success: null };
        return { ok: false, message: verdict.message };
      }
      state.newPanel = { ...panel, submitting: true, message: null, success: null };
      let answer = null;
      try {
        answer = await transport.postInstance?.(m.buildStartRequest({ template: panel.template, task: panel.task }));
      } catch (error) {
        answer = { status: 0, body: { error: 'UNKNOWN_ERROR', message: error?.message ?? String(error) } };
      }
      if (answer && (answer.status === 200 || answer.status === 201) && answer.body?.instanceId) {
        const message = m.renderStarted(answer.body.instanceId, state.labels);
        state.newPanel = {
          ...panel,
          open: false,
          message: null,
          success: message,
          submitting: false,
        };
        await api.loadInstances();
        return { ok: true, message };
      }
      const body = answer?.body ?? {};
      const message = m.renderStartFailure(
        { code: body.error, params: body.params, message: body.message },
        state.labels,
      );
      state.newPanel = { ...panel, submitting: false, message, success: null };
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
      const views = viewNavItems(state.labels);
      const instancesLabel = instancesTitle(state.labels);
      const activeView = views.find((entry) => entry.view === view);
      const viewTitle = view === 'instances' || view === 'project'
        ? instancesLabel
        : view === 'graph' || view === 'board'
          ? state.labels?.DESKTOP_VIEW_GRAPH ?? instancesLabel
          : activeView?.text ?? instancesLabel;
      const model = {
        ready,
        view,
        labels: state.labels,
        instancesLabel,
        views,
        viewTitle,
        viewSubtitle: state.project?.root ?? null,
        projectRoot: state.project?.root ?? null,
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
        drill: null,
        escalationNotice: state.escalationNotice,
      };

      if (!ready) return model;

      // Preferences are global rather than queue-only: the settings page shows
      // the same switches without a prior visit to the queue.
      model.prefs = m.prefsRows(state.queuePrefs, state.labels);

      // Rows are a pure projection of the instance list, so they are built once
      // for every view: the list page, the governance table and the shell
      // counters all read the same rows (beta.2). No extra computation happens
      // here — `describeListRow` / `renderListRow` keep the server wording.
      model.rows = m.sortInstances(state.instances).map((item) => {
        const readable = item?.readable !== false;
        const fields = readable ? m.describeListRow(item, state.labels) : {};
        return {
          instanceId: item?.instanceId ?? '',
          readable,
          templateTitle: '',
          phase: '',
          state: '',
          done: 0,
          total: 0,
          pending: 0,
          healthLevel: null,
          health: '',
          ...fields,
          text: readable
            ? m.renderListRow(item, state.labels)
            : m.renderListUnreadable(item?.instanceId ?? '', state.labels),
          healthText: readable ? m.renderHealthHover(item?.health ?? {}, state.labels) : null,
        };
      });
      model.emptyText = view === 'instances' && model.rows.length === 0
        ? m.renderListEmpty(state.labels)
        : null;

      if (view === 'instances') {
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

      if (view === 'drill' || view === 'node-detail' || view === 'escalation-panel'
          || view === 'connection-panel' || view === 'subflow') {
        const description = view === 'drill' ? state.drillView
          : view === 'node-detail' ? state.detail?.view
            : view === 'escalation-panel' ? state.escalationPanel?.view
              : null;
        model.drill = description ?? null;
        model.breadcrumb = description?.breadcrumb ?? null;
        model.escalationNotice = state.escalationNotice;
        if (description && Array.isArray(description.missingLabels) && description.missingLabels.length > 0) {
          model.notice = {
            key: 'DRILL_EMPTY_RECORD',
            text: noticeText('DRILL_EMPTY_RECORD', {}),
            retryable: false,
            returnable: true,
          };
        }
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
   * A-8 breadcrumb assembly. The pure module fills the role crumb (which
   * already carries the instance root); the node / escalation crumbs carry
   * only their own segment, so the instance root is joined here, in the
   * rendering layer. No Chinese is authored — every segment comes from keys.
   */
  function assembleBreadcrumb() {
    const instanceId = state.escalationPanel?.instanceId ?? state.drill?.instanceId ?? state.graphId ?? '';
    const roleTemplate = noticeText('DRILL_CRUMB_ROLE', { id: instanceId, role: '' });
    const instanceRoot = typeof roleTemplate === 'string' ? roleTemplate.split(' / ')[0] : '';
    const join = (segment) => (instanceRoot.length > 0 ? `${instanceRoot} / ${segment}` : segment);
    if (state.view === 'node-detail' && state.detail) {
      return join(noticeText('DRILL_CRUMB_NODE', { node: state.detail.nodeId ?? '' }) ?? '');
    }
    if (state.view === 'escalation-panel') {
      return join(noticeText('DRILL_ESC_TITLE', {}) ?? '');
    }
    return null;
  }

  /** Apply the assembled breadcrumb to a drill description in place. */
  function finalizeBreadcrumb(description) {
    if (!description) return description;
    const crumb = assembleBreadcrumb();
    if (crumb !== null) description.breadcrumb = crumb;
    return description;
  }

  /** AC-28 stability counters: one navigation action, one structured count. */
  function bumpOp() {
    state.opCount += 1;
  }

  function bumpFetch() {
    state.fetchCount += 1;
    state.fetchesThisView += 1;
    if (state.fetchesThisView > state.maxFetchesPerView) {
      state.maxFetchesPerView = state.fetchesThisView;
    }
  }

  /** One structured data fetch for a freshly entered view (AC-28: per view = 1). */
  function beginViewFetch() {
    state.fetchesThisView = 0;
    bumpFetch();
  }

  /**
   * Rebuild the drill description from the frozen data that backs the active
   * view. Only the named segment is touched by live frames, so a status-word
   * flip (AC-48) never clears serving nodes / hosts / last action or cards,
   * and a reconnect refetch (AC-50) replaces role bar + cards while keeping
   * the previous DAG. No layout / view state is recomputed here.
   */
  function rebuildDrillView() {
    const view = state.view;
    if (view === 'drill') {
      state.drillView = m.createDrillView({
        labels: state.labels,
        data: state.drillData ?? {},
        interactions: { now: state.drillData?.now, clock: transport.now },
      });
      // Empty-card wording comes from the frozen label table, applied at the
      // assembly layer (the pure module carries only structured data).
      state.drillView.cardsEmptyText = state.drillView.cards.length === 0
        ? (noticeText('DRILL_EMPTY_TASK', {}) ?? '') : null;
    } else if (view === 'node-detail' && state.detail) {
      state.detail.view = finalizeBreadcrumb(m.createDrillView({
        labels: state.labels,
        data: { ...state.drillData, detail: state.detail.data },
        interactions: { clock: transport.now },
      }));
    } else if (view === 'escalation-panel' && state.escalationPanel) {
      state.escalationPanel.view = finalizeBreadcrumb(m.createDrillView({
        labels: state.labels,
        data: { escalations: state.escalationPanel.data },
        interactions: { clock: transport.now },
      }));
    }
  }

  /** Apply one live frame to the drill projection (status word / connection). */
  function applyDrillFrame(kind, payload) {
    if (state.drillData === null) return false;
    if (kind === 'role_instance.updated' || kind === 'special_node.updated') {
      const token = asText(payload?.status);
      if (token === null) return false;
      const roleBar = { ...(state.drillData.roleBar ?? {}), statusToken: token };
      state.drillData = { ...state.drillData, roleBar };
      rebuildDrillView();
      state.drillTiming.frameAt = typeof transport.now === 'function' ? transport.now() : null;
      return true;
    }
    if (kind === 'connection.updated') {
      const aggregate = asText(payload?.aggregateStatus);
      if (aggregate === null) return false;
      const connection = { ...(state.drillData.connection ?? {}) };
      if (connection.edge && typeof connection.edge === 'object') {
        connection.edge = { ...connection.edge, aggregateStatus: aggregate };
      } else {
        connection.edge = { aggregateStatus: aggregate };
      }
      state.drillData = { ...state.drillData, connection };
      rebuildDrillView();
      state.drillTiming.frameAt = typeof transport.now === 'function' ? transport.now() : null;
      return true;
    }
    if (kind === 'session.indicator') {
      // Indicator-only: stored on `state.indicator`; never reorders cards.
      rebuildDrillView();
      return true;
    }
    return false;
  }

  /** AC-50: reconnect refetch replaces role bar + cards, keeps the DAG. */
  function refetchDrill(payload) {
    const previous = state.drillData ?? {};
    const next = payload !== null && typeof payload === 'object' ? payload : {};
    state.drillData = {
      ...previous,
      breadcrumb: next.breadcrumb ?? previous.breadcrumb,
      roleBar: next.roleBar ?? previous.roleBar,
      cards: Array.isArray(next.cards) ? next.cards : [],
      // DAG is intentionally NOT replaced: keep the last frame (F4-13).
      dag: previous.dag,
    };
    rebuildDrillView();
    state.drillTiming.frameAt = typeof transport.now === 'function' ? transport.now() : null;
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

const ICON_PATHS = Object.freeze({
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  queue: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  assets: ['M4 7l8-4 8 4-8 4-8-4Z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'],
  occupancy: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1', 'M17 5a3 3 0 0 1 0 6', 'M18 14a4 4 0 0 1 3 3.9V20'],
  canvas: ['M4 5h6v6H4z', 'M14 13h6v6h-6z', 'M10 8h4v8'],
  evidence: ['M7 3h7l4 4v14H7z', 'M14 3v5h5', 'M9 12h7', 'M9 16h5'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  plus: ['M12 5v14', 'M5 12h14'],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  alert: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  check: ['M20 6 9 17l-5-5'],
  chevron: ['M9 18l6-6-6-6'],
  play: ['M8 5v14l11-7z'],
  spinner: ['M12 3a9 9 0 1 0 9 9'],
});

const VIEW_ICONS = Object.freeze({
  instances: 'grid',
  queue: 'queue',
  assets: 'assets',
  occupancy: 'occupancy',
  canvas: 'canvas',
  evidence: 'evidence',
});

const HEALTH_LEVELS = new Set(['attention', 'slow', 'normal', 'ended']);
const PHASES = new Set([
  'created', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'suspended',
]);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[name] ?? []) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function labelText(labels, key, params) {
  const template = labels?.[key];
  if (typeof template !== 'string') return '';
  return fillTemplate(template, params ?? {});
}

function progressLabel(labels, done, total) {
  return labelText(labels, 'DESKTOP_LIST_FIELD_PROGRESS', { done, total });
}

function pendingLabel(labels, n) {
  return labelText(labels, 'DESKTOP_LIST_FIELD_PENDING', { n });
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
  /** Shell-side label resolver: never throws on a missing table. */
  const labelText = (key, params) => app.text(key, params);

  let lastRowsSignature = '[]';
  let lastEmptyDiagAt = 0;
  function emitProbe(event) {
    if (typeof transport.probe !== 'function') return;
    try {
      transport.probe(event);
    } catch {
      // A broken probe sink must never break painting.
    }
  }

  /**
   * Why is the list empty? The acceptance probe already records the rendered
   * rows; when there are none this records the reason (labels missing, the
   * instance read failed, the project is still unresolved) so a blank list is
   * never a silent dead end. Throttled to one event per ~1s: a repaint storm
   * must not flood the probe file.
   */
  function probeEmptyRows(model, state) {
    if (model.view !== 'instances' || model.rows.length > 0) return;
    const now = Date.now();
    if (now - lastEmptyDiagAt < 800) return;
    lastEmptyDiagAt = now;
    emitProbe({
      event: 'rows-empty',
      ready: model.ready === true,
      view: model.view,
      labels: Object.keys(state.labels ?? {}).length,
      instances: Array.isArray(state.instances) ? state.instances.length : -1,
      status: model.connection?.status ?? null,
      error: state.lastError ?? null,
    });
  }

  let toastTimer = null;
  let toastText = null;

  function captureFocus() {
    const active = document.activeElement;
    if (!active || !host.contains(active)) return null;
    const field = active.getAttribute?.('data-field');
    if (!field) return null;
    let start = null;
    let end = null;
    try {
      start = active.selectionStart;
      end = active.selectionEnd;
    } catch {
      // Inputs without a selection range are still focus-restorable.
    }
    return { field, start, end, scrollTop: active.scrollTop ?? 0 };
  }

  function restoreFocus(snapshot, model) {
    if (snapshot) {
      const target = host.querySelector(`[data-field="${snapshot.field}"]`);
      if (target) {
        target.focus({ preventScroll: true });
        if (snapshot.start !== null && typeof target.setSelectionRange === 'function') {
          try {
            target.setSelectionRange(snapshot.start, snapshot.end ?? snapshot.start);
          } catch {
            // Type-mismatched inputs ignore selection restoration.
          }
        }
        target.scrollTop = snapshot.scrollTop ?? 0;
        return;
      }
    }
    if (model.panel.open) {
      const task = host.querySelector('[data-field="task"]');
      if (task) task.focus({ preventScroll: true });
    }
  }

  function paint() {
    const model = app.compose();
    const state = app.state();
    if (model.view === 'instances') {
      const texts = model.rows.map((row) => row.text);
      const signature = JSON.stringify(texts);
      if (texts.length > 0 && signature !== lastRowsSignature) {
        lastRowsSignature = signature;
        emitProbe({ event: 'rows', rows: texts });
      }
    }
    probeEmptyRows(model, state);
    renderShell(host, buildShellContext(model, state));
  }

  let pendingPaint = null;

  /**
   * Coalesce live-frame repaints. Graph/list frames can arrive faster than a
   * pointer press, and a repaint that replaces the node under the pointer
   * costs the browser's `click` (press and release must resolve to the same
   * node). Every frame inside one window shares a single pass.
   */
  function schedulePaint() {
    if (pendingPaint !== null) return;
    pendingPaint = setTimeout(() => {
      pendingPaint = null;
      paint();
    }, 90);
  }

  /**
   * Assembly -> shell context. The shell receives projections only: it never
   * reads the transport and never mutates state. Drawer specs ride along so a
   * live frame can repaint the page underneath an open drawer.
   */
  function buildShellContext(model, state) {
    const instanceId = state.graphId ?? state.drill?.instanceId ?? null;
    let instanceRow = (model.rows ?? []).find((row) => row.instanceId === instanceId) ?? null;
    if (instanceRow === null && instanceId !== null) {
      const item = (state.instances ?? []).find((entry) => entry?.instanceId === instanceId) ?? null;
      if (item !== null) {
        const fields = item.readable === false ? {} : m.describeListRow(item, state.labels);
        instanceRow = {
          instanceId,
          readable: item.readable !== false,
          templateTitle: fields.templateTitle ?? '',
          phase: fields.phase ?? '',
          state: fields.state ?? '',
          done: fields.done ?? 0,
          total: fields.total ?? 0,
          pending: fields.pending ?? 0,
          healthLevel: fields.healthLevel ?? null,
          text: item.readable === false
            ? m.renderListUnreadable(instanceId, state.labels)
            : m.renderListRow(item, state.labels),
        };
      }
    }
    const activeView = model.view;

    let drawer = null;
    let shellModel = model;
    if (state.nodeDrawer !== null) {
      const nodeId = state.nodeDrawer.nodeId ?? '';
      drawer = {
        kind: 'node',
        id: nodeId,
        title: labelText('DRILL_CRUMB_NODE', { node: nodeId }) || nodeId,
        subtitle: model.viewTitle ?? '',
      };
      shellModel = { ...model, drill: state.nodeDrawer.view ?? null };
    } else if (state.connectionDrawer !== null) {
      const view = state.connectionDrawer.view ?? null;
      drawer = { kind: 'connection', id: state.connectionDrawer.edgeId ?? '', title: view?.connection?.title ?? '', subtitle: instanceId ?? '' };
      shellModel = { ...model, drill: view };
    } else if (state.escalationDrawer !== null) {
      const view = state.escalationDrawer.view ?? null;
      drawer = { kind: 'escalation', id: state.escalationDrawer.escalationId ?? '', title: view?.escalations?.title ?? '', subtitle: instanceId ?? '' };
      shellModel = { ...model, drill: view };
    }

    // D-36 zero-computation: the badge count is the projection-supplied item
    // count; no pending field is re-summed here.
    const queueItems = Array.isArray(state.queue?.items) ? state.queue.items : [];
    const queueCount = queueItems.length;

    return {
      state,
      model: shellModel,
      labels: state.labels,
      t: labelText,
      view: activeView,
      inDrawer: drawer !== null,
      detailKey: drawer?.id ?? null,
      drawers: drawer,
      drawer,
      instancesLabel: model.instancesLabel,
      projectRoot: model.projectRoot ?? null,
      statusText: model.statusText ?? (model.connection?.status === 'ready'
        ? labelText('DESKTOP_V2_CONNECTED', {})
        : null),
      statusTone: model.connection?.status === 'ready' ? 'ok' : '',
      queueCount,
      notifyCount: Array.isArray(state.notifications) ? state.notifications.length : 0,
      prefs: Array.isArray(model.prefs) ? model.prefs : [],
      instanceId,
      instanceRow,
      instanceTitle: instanceRow?.templateTitle ?? instanceId ?? '',
      graph: state.graph,
      viewTitle: model.viewTitle ?? '',
      crumbs: crumbsFor({
        view: activeView,
        instanceId,
        instancesLabel: model.instancesLabel,
        detailLabel: activeView === 'node-detail' ? labelText('DESKTOP_V2_DETAIL', {}) : null,
        t: labelText,
      }),
      degradedText: model.notice?.text ?? null,
      hostText: model.statusText ?? '',
      dataDir: model.projectRoot ? `${model.projectRoot}/.orch/instances` : null,
    };
  }

  function paintSidebar(model) {
    const aside = element('aside', 'sidebar');
    const brand = element('button', 'brand');
    brand.type = 'button';
    brand.setAttribute('data-nav', 'instances');
    brand.setAttribute('aria-label', 'Maestro');
    const mark = document.createElement('img');
    mark.className = 'brand-mark';
    mark.src = './brand/mark.svg';
    mark.alt = '';
    brand.appendChild(mark);
    brand.appendChild(element('span', 'brand-name', 'Maestro'));
    aside.appendChild(brand);

    const nav = element('nav', 'nav');
    nav.setAttribute('aria-label', 'views');
    const home = element('button', 'nav-item');
    home.type = 'button';
    home.setAttribute('data-nav', 'instances');
    home.appendChild(icon(VIEW_ICONS.instances));
    home.appendChild(element('span', 'nav-text', model.instancesLabel));
    if (model.view === 'instances' || model.view === 'project') {
      home.classList.add('active');
      home.setAttribute('aria-current', 'page');
    }
    nav.appendChild(home);
    for (const entry of model.views) {
      const button = element('button', 'nav-item');
      button.type = 'button';
      button.setAttribute('data-nav', entry.view);
      button.appendChild(icon(VIEW_ICONS[entry.view] ?? 'grid'));
      button.appendChild(element('span', 'nav-text', entry.text));
      if (model.view === entry.view) {
        button.classList.add('active');
        button.setAttribute('aria-current', 'page');
      }
      nav.appendChild(button);
    }
    aside.appendChild(nav);

    const foot = element('div', 'sidebar-foot');
    if (model.projectRoot) {
      const project = element('div', 'project-card');
      project.setAttribute('title', model.projectRoot);
      project.appendChild(icon('folder', 16));
      project.appendChild(element('code', 'project-path', model.projectRoot));
      foot.appendChild(project);
    }
    const status = model.connection?.status ?? 'idle';
    if (model.statusText) {
      const conn = element('div', `conn conn-${status}`);
      conn.appendChild(element('span', 'conn-dot'));
      conn.appendChild(element('span', 'conn-text', model.statusText));
      foot.appendChild(conn);
    } else if (status === 'ready') {
      const conn = element('div', 'conn conn-ready');
      conn.appendChild(element('span', 'conn-dot'));
      conn.setAttribute('title', 'Maestro');
      foot.appendChild(conn);
    }
    aside.appendChild(foot);
    return aside;
  }

  function paintTopbar(model) {
    const bar = element('header', 'topbar');
    const heading = element('div', 'topbar-heading');
    heading.appendChild(element('h1', 'topbar-title', model.viewTitle));
    if (model.view === 'graph' || model.view === 'board') {
      const instanceId = app.state().graphId;
      if (typeof instanceId === 'string' && instanceId.length > 0) {
        heading.appendChild(element('code', 'topbar-subtitle', instanceId));
      }
    }
    bar.appendChild(heading);

    const actions = element('div', 'topbar-actions');
    for (const action of model.actions) {
      const button = element('button', 'icon-btn');
      button.type = 'button';
      button.setAttribute('data-action', action.id);
      button.title = action.title;
      button.setAttribute('aria-label', action.title);
      button.appendChild(icon(action.id.includes('retry') ? 'refresh' : 'arrowLeft'));
      actions.appendChild(button);
    }
    if (model.ready && model.view !== 'project') {
      const create = element('button', 'btn btn-primary');
      create.type = 'button';
      create.setAttribute('data-action', 'open-new');
      create.appendChild(icon('plus', 16));
      create.appendChild(element('span', 'btn-text', model.panel.newLabel));
      actions.appendChild(create);
    }
    bar.appendChild(actions);
    return bar;
  }

  function paintNotice(container, model) {
    const notice = element('div', 'notice');
    notice.setAttribute('role', 'status');
    notice.appendChild(icon('alert', 18));
    notice.appendChild(element('span', 'notice-text', model.notice.text));
    if (model.actions.length > 0) {
      const actions = element('div', 'notice-actions');
      for (const action of model.actions) {
        const button = element('button', 'btn btn-secondary');
        button.type = 'button';
        button.setAttribute('data-action', action.id);
        button.title = action.title;
        button.appendChild(icon(action.id.includes('retry') ? 'refresh' : 'arrowLeft', 15));
        actions.appendChild(button);
      }
      notice.appendChild(actions);
    }
    container.appendChild(notice);
  }

  function paintProject(container, model) {
    const prompt = element('section', 'prompt');
    const mark = document.createElement('img');
    mark.className = 'prompt-mark';
    mark.src = './brand/mark.svg';
    mark.alt = '';
    prompt.appendChild(mark);
    prompt.appendChild(element('p', 'prompt-text', model.projectMessage ?? ''));
    container.appendChild(prompt);
  }

  function paintToast(container, model) {
    if (!model.panel.success) return;
    const toast = element('div', 'toast');
    toast.setAttribute('role', 'status');
    toast.appendChild(icon('check', 17));
    toast.appendChild(element('span', 'toast-text', model.panel.success));
    container.appendChild(toast);
    if (toastText !== model.panel.success) {
      toastText = model.panel.success;
      if (toastTimer !== null) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastTimer = null;
        toastText = null;
        app.updateNewPanel({ success: null });
        paint();
      }, 5200);
    }
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
    const section = element('section', 'list page');
    if (!model.ready) {
      const state = element('div', 'state-card');
      state.appendChild(element('span', 'spinner'));
      if (model.statusText) state.appendChild(element('p', 'state-text', model.statusText));
      if (model.actions.length > 0) {
        const actions = element('div', 'state-actions');
        for (const action of model.actions) {
          const button = element('button', 'btn btn-secondary');
          button.type = 'button';
          button.setAttribute('data-action', action.id);
          button.appendChild(icon('refresh', 15));
          button.appendChild(element('span', 'btn-text', action.title));
          actions.appendChild(button);
        }
        state.appendChild(actions);
      }
      section.appendChild(state);
      container.appendChild(section);
      return;
    }

    if (model.rows.length === 0) {
      const empty = element('div', 'empty-state');
      const mark = document.createElement('img');
      mark.className = 'empty-mark';
      mark.src = './brand/mark.svg';
      mark.alt = '';
      empty.appendChild(mark);
      empty.appendChild(element('h2', 'empty-title', model.emptyText ?? model.instancesLabel));
      if (model.panel.options.length > 0) {
        const create = element('button', 'btn btn-primary');
        create.type = 'button';
        create.setAttribute('data-action', 'open-new');
        create.appendChild(icon('plus', 16));
        create.appendChild(element('span', 'btn-text', model.panel.newLabel));
        empty.appendChild(create);

        const quick = element('div', 'quickstart');
        quick.appendChild(element(
          'p',
          'section-label',
          model.labels?.DESKTOP_NEW_FIELD_WORKFLOW ?? '',
        ));
        const grid = element('div', 'quick-grid');
        for (const option of model.panel.options) {
          const card = element('button', 'quick-card');
          card.type = 'button';
          card.setAttribute('data-quick-template', option.id);
          card.appendChild(icon('play', 16));
          card.appendChild(element('span', 'quick-title', option.title ?? option.id));
          card.appendChild(element('code', 'quick-code', option.id));
          grid.appendChild(card);
        }
        quick.appendChild(grid);
        empty.appendChild(quick);
      }
      section.appendChild(empty);
      container.appendChild(section);
      return;
    }

    const list = element('ul', 'instance-list');
    for (const row of model.rows) {
      const level = HEALTH_LEVELS.has(row.healthLevel) ? row.healthLevel : 'normal';
      const phase = PHASES.has(row.phase) ? row.phase : '';
      const item = element('li', `instance-card health-${level}${phase ? ` phase-${phase}` : ''}`);
      item.setAttribute('data-instance', row.instanceId);
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', row.text);
      if (row.healthText) item.setAttribute('title', row.healthText);

      item.appendChild(element('span', 'status-dot'));
      const body = element('div', 'instance-main');
      const titleRow = element('div', 'instance-title-row');
      titleRow.appendChild(element(
        'span',
        'instance-template',
        row.readable ? (row.templateTitle || row.instanceId) : row.text,
      ));
      if (row.readable && row.state) {
        titleRow.appendChild(element(
          'span',
          `phase-badge${phase ? ` phase-${phase}` : ''}`,
          row.state,
        ));
      }
      body.appendChild(titleRow);
      if (row.readable) {
        const meta = element('div', 'instance-meta');
        meta.appendChild(element('code', 'instance-id', row.instanceId));
        const progress = element('span', 'instance-progress');
        progress.appendChild(element('span', 'progress-text', progressLabel(
          model.labels,
          row.done,
          row.total,
        )));
        const track = element('span', 'progress-track');
        const fill = element('span', 'progress-fill');
        const ratio = row.total > 0 ? Math.max(0, Math.min(1, row.done / row.total)) : 0;
        fill.style.width = `${Math.round(ratio * 100)}%`;
        track.appendChild(fill);
        progress.appendChild(track);
        meta.appendChild(progress);
        meta.appendChild(element('span', 'meta-pill', pendingLabel(
          model.labels,
          row.pending,
        )));
        body.appendChild(meta);
      }
      item.appendChild(body);
      if (row.readable && row.health) {
        item.appendChild(element('span', `health-chip health-${level}`, row.health));
      }
      const chevron = icon('chevron', 18);
      chevron.classList.add('chevron');
      item.appendChild(chevron);
      list.appendChild(item);
    }
    section.appendChild(list);
    container.appendChild(section);
  }

  function paintPanel(container, model) {
    const backdrop = element('div', 'modal-backdrop');
    const panel = element('section', 'modal');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'new-instance-title');

    const head = element('header', 'modal-head');
    const heading = element('div', 'modal-heading');
    heading.appendChild(icon('plus', 18));
    const title = element('h2', 'modal-title', model.panel.title ?? '');
    title.id = 'new-instance-title';
    heading.appendChild(title);
    head.appendChild(heading);
    const close = element('button', 'icon-btn');
    close.type = 'button';
    close.setAttribute('data-action', 'close-new');
    close.setAttribute('aria-label', model.panel.cancelText ?? '');
    close.appendChild(icon('close', 18));
    head.appendChild(close);
    panel.appendChild(head);

    const body = element('div', 'modal-body');
    if (model.panel.options.length > 0) {
      const field = element('div', 'field');
      field.appendChild(element(
        'span',
        'field-label',
        model.labels?.DESKTOP_NEW_FIELD_WORKFLOW ?? '',
      ));
      const options = element('div', 'workflow-options');
      for (const option of model.panel.options) {
        const choice = element('label', 'workflow-option');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'workflow';
        input.value = option.id;
        input.checked = option.id === model.panel.template;
        input.setAttribute('data-field', 'template');
        if (input.checked) choice.classList.add('selected');
        choice.appendChild(input);
        choice.appendChild(element('span', 'workflow-radio'));
        const copy = element('span', 'workflow-copy');
        copy.appendChild(element('span', 'workflow-title', option.title ?? option.id));
        copy.appendChild(element('code', 'workflow-code', option.id));
        choice.appendChild(copy);
        options.appendChild(choice);
      }
      field.appendChild(options);
      body.appendChild(field);
    }

    const taskField = element('div', 'field');
    taskField.appendChild(element(
      'span',
      'field-label',
      model.labels?.DESKTOP_NEW_FIELD_TASK ?? '',
    ));
    const task = document.createElement('textarea');
    task.className = 'task-input';
    task.setAttribute('data-field', 'task');
    task.rows = 7;
    task.value = model.panel.task ?? '';
    taskField.appendChild(task);
    body.appendChild(taskField);

    if (model.panel.message) {
      const message = element('p', 'message');
      message.setAttribute('role', 'alert');
      message.appendChild(icon('alert', 16));
      message.appendChild(element('span', 'message-text', model.panel.message));
      body.appendChild(message);
    }
    panel.appendChild(body);

    const foot = element('footer', 'modal-foot');
    const cancel = element('button', 'btn btn-secondary');
    cancel.type = 'button';
    cancel.setAttribute('data-action', 'close-new');
    cancel.appendChild(element('span', 'btn-text', model.panel.cancelText ?? ''));
    foot.appendChild(cancel);
    const start = element('button', 'btn btn-primary');
    start.type = 'button';
    start.setAttribute('data-action', 'submit-new');
    if (model.panel.submitting) {
      start.disabled = true;
      start.appendChild(element('span', 'spinner'));
    } else {
      start.appendChild(icon('play', 15));
    }
    start.appendChild(element('span', 'btn-text', model.panel.startText ?? ''));
    foot.appendChild(start);
    panel.appendChild(foot);

    backdrop.appendChild(panel);
    container.appendChild(backdrop);
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

  function handleAction(action, arg, node) {
    const value = arg ?? null;
    switch (action) {
      case 'nav': {
        const view = typeof value === 'string' ? value : 'instances';
        if (view === 'overview' || view === 'graph' || view === 'board') {
          if (app.state().graphId !== null) {
            app.setView(view === 'overview' ? 'graph' : view);
            paint();
          } else {
            // No instance is open: fall back to the list and say why, instead
            // of swallowing the click and leaving the frame untouched.
            app.setView('instances');
            paint();
            showToast(shellRefsOf(), labelText('DESKTOP_V2_NEED_INSTANCE', {}));
          }
          return;
        }
        if (view === 'project') {
          app.setView('project');
          paint();
          return;
        }
        // Paint the target view first and load its projection afterwards. A
        // slow or retrying request then shows up as late data, never as a
        // click that appears to do nothing.
        app.setView(view);
        paint();
        void app.openView(view, view === 'evidence' ? app.state().graphId : undefined).then(paint);
        return;
      }
      case 'canvas-pick':
        app.setView('canvas');
        paint();
        void app.loadCanvas(String(value)).then(paint);
        return;
      case 'tab': {
        const view = typeof value === 'string' ? value : 'graph';
        if (view === 'evidence') {
          app.setView('evidence');
          paint();
          void app.openView('evidence', app.state().graphId).then(paint);
          return;
        }
        app.setView(view);
        paint();
        if (view === 'queue') void app.loadQueue().then(paint);
        return;
      }
      case 'back':
      case 'drill-back':
        app.back();
        paint();
        return;
      case 'open-instance': {
        const id = value && typeof value === 'object' ? value.instanceId : value;
        if (typeof id === 'string' && id.length > 0) {
          void app.openGraph(id).then(() => {
            app.setView('graph');
            paint();
          });
        }
        return;
      }
      case 'filter':
        app.state().listFilter = typeof value === 'string' ? value : 'all';
        paint();
        return;
      case 'pick-template':
        app.updateNewPanel({ template: typeof value === 'string' ? value : null, message: null, success: null });
        paint();
        return;
      case 'open-drill': {
        const roleId = value && typeof value === 'object' ? value.nodeId : value;
        void app.openRoleDrill(roleId).then(paint);
        return;
      }
      case 'open-special': {
        const payload = value && typeof value === 'object' ? value : {};
        void app.openSpecialNode(payload).then(paint);
        return;
      }
      case 'open-node': {
        const nodeId = value && typeof value === 'object' ? value.nodeId : value;
        void app.openNodeDrawer({ nodeId }).then(paint);
        return;
      }
      case 'dag-node': {
        const nodeId = value && typeof value === 'object' ? value.nodeId : value;
        void app.openRoleDrill(nodeId).then(paint);
        return;
      }
      case 'open-connection': {
        const edgeId = value && typeof value === 'object' ? value.edgeId : value;
        void app.openConnectionDrawer({ edgeId }).then(paint);
        return;
      }
      case 'open-escalation': {
        const escalationId = value && typeof value === 'object' ? value.escalationId : value;
        void app.openEscalationDrawer({ escalationId }).then(paint);
        return;
      }
      case 'close-drawer':
        app.closeDrawer();
        paint();
        return;
      case 'drill-all-nodes':
        app.openAllNodes();
        paint();
        return;
      case 'continue-escalation': {
        const escalationId = value && typeof value === 'object' ? value.escalationId : value;
        void app.continueEscalation({
          instanceId: app.state().graphId ?? app.state().drill?.instanceId ?? null,
          escalationId,
        }).then(paint);
        return;
      }
      case 'select-row':
        app.toggleRow(typeof value === 'string' ? value : null);
        paint();
        return;
      case 'decide': {
        const payload = value && typeof value === 'object' ? value : {};
        void handleShellDecision(payload);
        return;
      }
      case 'toggle-pref': {
        if (typeof value !== 'string') return;
        const current = app.state().queuePrefs?.[value];
        void app.saveQueuePrefs({ [value]: current !== true }).then(paint);
        return;
      }
      case 'asset-kind':
        void app.loadAssets(typeof value === 'string' ? value : undefined).then(paint);
        return;
      case 'asset-row': {
        const payload = value && typeof value === 'object' ? value : {};
        void app.loadAssetDetail(payload.kind ?? app.state().assetKind, payload.id).then(paint);
        return;
      }
      case 'evidence-node':
        app.state().evidenceNode = typeof value === 'string' ? value : null;
        paint();
        return;
      case 'zoom':
        app.zoom(value === 'out' ? 'out' : 'in');
        paint();
        return;
      case 'reset-view':
        app.resetView();
        paint();
        return;
      case 'exit-focus':
        app.escape();
        paint();
        return;
      case 'pause-instance':
        void app.pauseInstance(typeof value === 'string' ? value : app.state().graphId).then(paint);
        return;
      case 'cancel-instance':
        app.beginCancel(typeof value === 'string' ? value : app.state().graphId);
        paint();
        return;
      case 'export-otel':
        showToast(shellRefsOf(), labelText('DESKTOP_V2_EXPORT_OTEL', {}));
        return;
      case 'copy-evidence':
        void copyText(copyTargetOf(node)).then((ok) => showToast(shellRefsOf(), ok ? labelText('DESKTOP_V2_COPY', {}) : ''));
        return;
      case 'jump-host': {
        const id = app.hostSession();
        if (id !== null) void copyText(id);
        showToast(shellRefsOf(), id === null ? labelText('DRILL_HOST_NONE', {}) : labelText('DRILL_HOST_HINT', { id }));
        return;
      }
      case 'pick-project':
        void app.pickProject();
        return;
      case 'read-all':
        app.state().notifications = [];
        paint();
        return;
      case 'follow-notify': {
        const payload = value && typeof value === 'object' ? value : {};
        void app.followNotification({ kind: payload.kind ?? 'escalation', ids: Array.isArray(payload.ids) ? payload.ids : [] }).then(paint);
        return;
      }
      case 'palette':
        openShellPalette();
        return;
      case 'retry-connection':
        app.retryConnection();
        void app.start().then(paint);
        return;
      case 'retry-graph':
        void app.retryGraph().then(paint);
        return;
      case 'back-to-list':
        app.backToList();
        paint();
        return;
      case 'reset-view-legacy':
        app.resetView();
        paint();
        return;
      case 'toggle-not-started':
        app.toggleNotStarted();
        paint();
        return;
      case 'expand-groups':
      case 'collapse-groups':
        if (typeof value === 'string') app.toggleGroup(value);
        paint();
        return;
      case 'view-graph':
        app.setView('graph');
        paint();
        return;
      case 'view-board':
        app.setView('board');
        paint();
        return;
      case 'open-new':
        app.openNewPanel();
        app.setView('new');
        paint();
        return;
      case 'close-new':
        app.closeNewPanel();
        app.setView('instances');
        paint();
        return;
      case 'submit-new': {
        const pending = app.submitNewPanel();
        paint();
        void pending.then((result) => {
          // A successful start closes the form and returns to the list, where
          // the new row appears through the push frame (AC-04).
          if (result?.ok) app.setView('instances');
          paint();
        });
        return;
      }
      default:
        return;
    }
  }

  /** Queue decision from the new queue cards (rowKey + decision token). */
  async function handleShellDecision(payload) {
    const items = Array.isArray(app.state().queue?.items) ? app.state().queue.items : [];
    const row = items.find((item) => item?.key === payload.rowKey) ?? {};
    if (!row.id) return;
    if (payload.decision === 'cancel') {
      app.beginCancel(row.id);
      paint();
      return;
    }
    const kind = (payload.type ?? row.type) === 'approval' ? 'approval' : 'escalation';
    const decision = payload.decision === 'pass' ? 'pass'
      : payload.decision === 'retry' ? 'retry'
        : payload.decision === 'allow' ? 'allow'
          : 'deny';
    await app.decide(kind, row.id, decision, {
      type: payload.type ?? row.type, id: row.id, decision, action: row.reasonSummary ?? decision,
    });
    paint();
  }

  /** Shell chrome refs for toasts (created on the first paint). */
  function shellRefsOf() {
    return shellRefs(host);
  }

  /** Copy helper; returns false when the clipboard is unavailable. */
  async function copyText(value) {
    const text = typeof value === 'string' ? value : '';
    if (text.length === 0) return false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  /** Copy target carried by the clicked element (evidence refs and ids). */
  function copyTargetOf(node) {
    if (node === null || typeof node !== 'object') return null;
    const ref = node.getAttribute?.('data-copy') ?? null;
    return typeof ref === 'string' && ref.length > 0 ? ref : null;
  }

  /** Command palette: pages, instances and drawer-free actions. */
  function openShellPalette() {
    const refs = shellRefs(host);
    const entries = [];
    const pages = [
      ['instances', 'DESKTOP_V2_SETTINGS_PROJECT'],
      ['queue', 'DESKTOP_VIEW_QUEUE'],
      ['assets', 'DESKTOP_VIEW_ASSETS'],
      ['occupancy', 'DESKTOP_VIEW_OCCUPANCY'],
      ['canvas', 'DESKTOP_VIEW_CANVAS'],
      ['governance', 'DESKTOP_V2_NAV_AUDIT'],
      ['notifications', 'DESKTOP_NOTIFY_TOGGLE'],
      ['settings', 'DESKTOP_V2_NAV_SETTINGS'],
      ['new', 'DESKTOP_NEW_TITLE'],
    ];
    for (const [view, key] of pages) {
      entries.push({ section: labelText('DESKTOP_NOTIFY_SEG_INSTANCE', {}), label: labelText(key, {}), action: 'nav', arg: view });
    }
    for (const item of app.state().instances ?? []) {
      const id = typeof item?.instanceId === 'string' ? item.instanceId : null;
      if (id === null) continue;
      entries.push({ section: labelText('DESKTOP_NOTIFY_SEG_INSTANCE', {}), label: id, action: 'open-instance', arg: { instanceId: id } });
    }
    openPalette(refs, { t: (key, params) => labelText(key, params ?? {}) }, entries, (action, arg) => {
      handleAction(action, arg, null);
    });
  }


  /** Parse a `data-arg` payload: JSON objects/arrays stay structured. */
  function parseArg(raw) {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    const first = raw[0];
    if (first === '{' || first === '[') {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return raw;
  }

  /**
   * Actions that only navigate or open a surface: nothing is submitted and
   * nothing is destroyed. They fire on press so the frame under the pointer
   * can never be swapped out mid-click — the same reason `click` is dropped
   * when a live frame repaints between mousedown and mouseup.
   */
  const PRESS_ACTIONS = new Set([
    'nav', 'tab', 'back', 'drill-back', 'open-instance', 'open-drill', 'open-special',
    'open-node', 'dag-node', 'open-connection', 'open-escalation', 'close-drawer',
    'palette', 'asset-kind', 'asset-row', 'evidence-node', 'filter', 'select-row',
    'open-new', 'close-new', 'pick-template', 'view-graph', 'view-board',
    'drill-all-nodes', 'expand-groups', 'collapse-groups', 'zoom', 'reset-view',
    'exit-focus', 'toggle-not-started', 'retry-graph', 'back-to-list', 'jump-host',
    'pick-project', 'read-all', 'follow-notify', 'toggle-pref', 'export-otel', 'canvas-pick',
  ]);

  let pressAt = 0;
  let pressKey = '';

  host.addEventListener('pointerdown', (event) => {
    if (typeof event.button === 'number' && event.button !== 0) return;
    const node = event.target?.closest?.('[data-action]') ?? null;
    if (node === null) return;
    const action = node.getAttribute('data-action');
    if (!PRESS_ACTIONS.has(action)) return;
    pressAt = Date.now();
    pressKey = `${action}|${node.getAttribute('data-arg') ?? ''}`;
    handleAction(action, parseArg(node.getAttribute('data-arg')), node);
  }, true);

  host.addEventListener('click', (event) => {
    if (event.target?.classList?.contains('mask')) {
      app.closeDrawer();
      paint();
      return;
    }
    const backdrop = event.target.closest?.('.modal-backdrop') ?? null;
    if (backdrop && event.target === backdrop) {
      app.closeNewPanel();
      paint();
      return;
    }
    const quick = event.target.closest?.('[data-quick-template]') ?? null;
    if (quick) {
      app.setView('instances');
      app.openNewPanel(quick.getAttribute('data-quick-template'));
      paint();
      return;
    }
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
    const actionNode = event.target.closest?.('[data-action]') ?? null;
    if (actionNode) {
      const action = actionNode.getAttribute('data-action');
      const key = `${action}|${actionNode.getAttribute('data-arg') ?? ''}`;
      // The press already handled this surface; a following click would run it
      // twice. Anything outside the press window (keyboard Enter) still falls
      // through to the normal path.
      if (pressKey === key && Date.now() - pressAt < 600) {
        pressKey = '';
        return;
      }
      handleAction(action, parseArg(actionNode.getAttribute('data-arg')), actionNode);
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

  host.addEventListener('input', (event) => {
    if (event.target?.id === 'new-task') {
      app.updateNewPanel({ task: event.target.value, message: null, success: null });
      return;
    }
    const task = event.target.closest?.('[data-field="task"]') ?? null;
    if (task) app.updateNewPanel({ task: task.value, message: null, success: null });
  });

  host.addEventListener('change', (event) => {
    const prefAction = event.target.closest?.('[data-action="toggle-pref"]') ?? null;
    if (prefAction) {
      handleAction('toggle-pref', prefAction.getAttribute('data-arg'), prefAction);
      return;
    }
    const template = event.target.closest?.('[data-field="template"]') ?? null;
    if (template) {
      app.updateNewPanel({ template: template.value, message: null, success: null });
      for (const option of host.querySelectorAll('.workflow-option')) {
        const input = option.querySelector('input[data-field="template"]');
        option.classList.toggle('selected', input?.checked === true);
      }
      return;
    }
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
    const refs = shellRefs(host);
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
      event.preventDefault();
      openShellPalette();
      return;
    }
    if (event.key === 'Escape') {
      if (paletteOpen(refs)) {
        closePalette(refs);
        return;
      }
      if (app.state().drawerOpen) {
        app.closeDrawer();
        paint();
        return;
      }
    }
    const panelOpen = app.state().newPanel.open;
    if (event.key === 'Escape') {
      if (panelOpen) app.closeNewPanel();
      else app.escape();
      paint();
      return;
    }
    if (!panelOpen && event.key === 'ArrowLeft' && !event.target?.closest?.('input, textarea')) {
      const state = app.state();
      if (['drill', 'node-detail', 'escalation-panel', 'connection-panel', 'subflow'].includes(state.view)
          || state.routeHistory.length > 0) {
        event.preventDefault();
        app.back();
        paint();
        return;
      }
    }
    if (panelOpen && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      const pending = app.submitNewPanel();
      paint();
      void pending.then(paint);
      return;
    }
    const row = event.target.closest?.('[data-instance]') ?? null;
    if (row && !panelOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      void app.openGraph(row.getAttribute('data-instance')).then(paint);
    }
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
    if (pendingPaint !== null) clearTimeout(pendingPaint);
    pendingPaint = null;
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
          else if (result.repaint === 'list') schedulePaint();
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
    // Contract A5: the drill view reuses the SAME graph stream. Opening it
    // while `view === 'drill'` is a new call site, not a second channel and
    // not a new frame type; graphStreamId keeps the existing de-dup.
    if ((current.view === 'graph' || current.view === 'drill')
        && current.graphId !== null && current.graphId !== graphStreamId) {
      if (graphClose) graphClose();
      graphStreamId = current.graphId;
      app.noteGraphStreamOpen();
      graphClose = transport.openStream(
        `${origin()}/instances/${encodeURIComponent(current.graphId)}/graph/stream`,
        {
          onFrame(frame) {
            if (app.state().connection.isPending()) app.state().connection.markReady();
            const result = app.handleFrame(frame);
            if (result.repaint === 'graph') schedulePaint();
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
          if (result.repaint === 'queue' && app.state().view === 'queue') schedulePaint();
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
          if (app.state().view === 'queue') schedulePaint();
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
        // An explicit refresh re-announces the rendered rows even when the text
        // is unchanged: the caller asked for a fresh read, so a `rows` probe
        // lost to a dropped POST must not silence every later attempt.
        lastRowsSignature = '[]';
        void app.loadInstances().then(paint);
      } else if (action === 'open-instance' && typeof arg === 'string') {
        void app.openGraph(arg).then(paint);
      // I1.10b WP-4 drill navigation actions. Capability seam only: the
      // shell drives the same createApp methods the UI uses, never a test
      // rendering branch.
      } else if (action === 'open-drill' && arg && typeof arg === 'object') {
        app.openDrill(arg);
        paint();
      } else if (action === 'back-graph') {
        app.backToGraph();
        paint();
      } else if (action === 'all-nodes') {
        app.openAllNodes();
        paint();
      } else if (action === 'back-drill') {
        app.backToDrill();
        paint();
      } else if (action === 'open-escalation' && arg && typeof arg === 'object') {
        app.openEscalationPanel(arg);
        paint();
      // I1.10b AC-51: a connection line opens the handoff panel, never the
      // escalation panel / drill. Same seam as open-escalation, no new channel.
      } else if (action === 'open-connection' && arg && typeof arg === 'object') {
        app.openConnectionPanel(arg);
        paint();
      } else if (action === 'continue-escalation' && arg && typeof arg === 'object') {
        void app.continueEscalation(arg).then(paint);
      } else if (action === 'open-queue') {
        // I1.11 D-52: shell notify click / tray queue-open lands on the
        // queue view, selecting the entry the shell supplied (AC-04 / AC-49).
        const selected = arg && typeof arg === 'object' && typeof arg.selected === 'string'
          ? [arg.selected] : [];
        void app.followNotification({ kind: 'escalation', ids: selected }).then(paint);
      }
    };
  }

  // One boot event per window: tells the acceptance probe whether the module
  // graph actually evaluated before any render happened.
  emitProbe({ event: 'ui-boot', shell: 'beta.2' });
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
    // ---- beta.2 drill / detail / connection / escalation / subflow reads ----
    getDrill: (instanceId, roleId) => request(
      `/instances/${encodeURIComponent(instanceId)}/drill/${encodeURIComponent(roleId)}`,
    ),
    getNode: (instanceId, nodeId) => request(
      `/instances/${encodeURIComponent(instanceId)}/nodes/${encodeURIComponent(nodeId)}`,
    ),
    getConnection: (instanceId, edgeId) => request(
      `/instances/${encodeURIComponent(instanceId)}/connections/${encodeURIComponent(edgeId)}`,
    ),
    getEscalations: (instanceId) => request(`/instances/${encodeURIComponent(instanceId)}/escalations`),
    getSubflow: (instanceId, ref) => request(
      `/instances/${encodeURIComponent(instanceId)}/subworkflow/${encodeURIComponent(ref)}`,
    ),
    postControl: (verb, instanceId) => request(
      `/control/${encodeURIComponent(verb)}`,
      { method: 'POST', body: JSON.stringify({ instanceId }) },
    ),
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
