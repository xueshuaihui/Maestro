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
// I1.10b WP-4: the drill layer is a pure module; the assembly only feeds it
// frozen projections plus label keys. No second renderer, no transport inside.
import { createDrillView } from './drill/index.js';

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
  createDrillView,
});

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

    async retryGraph() {
      if (state.graphId !== null) await api.openGraph(state.graphId);
      return api;
    },

    setView(view) {
      if (view === 'graph' && state.graph !== null) state.view = 'graph';
      if (view === 'board' && state.graph !== null) state.view = 'board';
      if (view === 'instances') state.view = 'instances';
      return api;
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

    paintToolbar(host, model);
    if (model.view === 'board') paintBoard(host, model);
    else paintGraph(host, model);
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
  let reconnectTimer = null;

  const stopStreams = () => {
    if (listClose) listClose();
    if (graphClose) graphClose();
    listClose = null;
    graphClose = null;
    graphStreamId = null;
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
