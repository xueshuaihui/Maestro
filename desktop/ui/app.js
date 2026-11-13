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
import { ARC_LIFT, computeLayout } from './graph/layout.js';
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
});

/** Controls that carry no wording of their own (ASCII glyphs only). */
const CONTROL_BACK = '\u2190';
const CONTROL_RETRY = '\u21BB';

/** Aggregate states whose line label is visible without hovering (A-11). */
const NOT_STARTED = 'not_started';

/** Cards fed to the board projection when only the graph payload is known. */
function boardCardsFromGraph(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  return nodes.map((node) => ({
    nodeId: node.id,
    id: node.id,
    state: node.status,
    roleId: node.roleId,
    title: node.title,
  }));
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
 * Create the assembly model. No DOM is touched here: `compose()` returns the
 * full view model and `mountApp()` paints it.
 *
 * @param {object} [options]
 * @param {unknown} [options.labels] `/ui/labels` body or flat table
 * @param {object} [options.project] summary from `resolveProject`
 * @param {object} [options.io] transport seam (see `mountApp`)
 * @param {object} [options.modules] module overrides (same shapes)
 */
export function createApp({ labels, project, io = {}, modules = {} } = {}) {
  const m = { ...DEFAULT_MODULES, ...(modules ?? {}) };
  const transport = io ?? {};

  const state = {
    labels: m.resolveLabels(labels ?? {}).keys,
    project: project ?? { view: 'instances' },
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
            text: fill(state.labels?.DESKTOP_GRAPH_MISSING, { id }),
            retryable: true,
            returnable: true,
          };
        } else if (status === 422) {
          state.notice = {
            key: 'DESKTOP_LIST_UNREADABLE',
            text: fill(state.labels?.DESKTOP_LIST_UNREADABLE, { id }),
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
      return api;
    },

    resetView() {
      state.viewState?.reset?.();
      state.offsets = {};
      state.focus = null;
      void persistOffsets({ offsets: {}, updatedAt: stamp() });
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
      void persistOffsets({ offsets: state.offsets, updatedAt: stamp() });
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

      if (type === 'graph.snapshot') {
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
          state: { nodes: boardCardsFromGraph(state.graph) },
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

      return model;
    },
  };

  // ---------------------------------------------------------------- helpers

  function stamp() {
    const base = typeof transport.now === 'function' ? transport.now() : Date.now();
    return new Date(base).toISOString();
  }

  async function persistOffsets(payload) {
    if (typeof transport.writeViewOffsets !== 'function') return;
    try {
      await transport.writeViewOffsets(state.graphId, payload, state.project?.root ?? null);
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
        fromTitle: asText(fromNode?.title) ?? undefined,
        toTitle: asText(toNode?.title) ?? undefined,
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
      focusTitle = fill(current.labels.DESKTOP_VIEW_FOCUS, {
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

/** Literal `{xx}` replacement (same discipline as the label table). */
function fill(template, params) {
  if (typeof template !== 'string') return null;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
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
 * @param {{port:number, token:string}} [options.credentials]
 * @param {object} [options.project]
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

  const creds = credentials ?? credentialsFromLocation();
  const transport = { ...defaultTransport(creds), ...(io ?? {}) };
  const app = createApp({ labels, project: project ?? undefined, io: transport, modules });

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
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(node.x));
      rect.setAttribute('y', String(node.y));
      rect.setAttribute('width', String(node.width));
      rect.setAttribute('height', String(node.height));
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', '#ffffff');
      rect.setAttribute('stroke', node.abnormal ? COLOR_TOKENS.red : '#c7ced8');
      rect.setAttribute('stroke-width', node.abnormal ? '2' : '1');
      group.appendChild(rect);
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

  function edgeGeometry(edge, nodes) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return { d: '', mid: { x: 0, y: 0 } };
    const a = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const b = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
    if (edge.path?.kind === 'arc') {
      const lift = ARC_LIFT * (model.graph.zoom ?? 1);
      const ctrl = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
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
          if (status === 'error') {
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
            if (status === 'error') {
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

function credentialsFromLocation() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const injected = window.__MAESTRO_DESKTOP__ ?? {};
  const port = params.get('port') ?? injected.port ?? (window.location.port || null);
  const token = params.get('token') ?? injected.token ?? null;
  if (port === null || token === null) return null;
  return { port: Number(port), token: String(token) };
}

function parseSseBlock(block) {
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
  return { event: eventName, data: payload, type: payload.type ?? eventName };
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

function defaultTransport(creds) {
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
    writeViewOffsets: async (instanceId, payload, root) => {
      const invoke = globalThis.window?.__TAURI__?.core?.invoke
        ?? globalThis.window?.__TAURI__?.invoke;
      if (typeof invoke !== 'function' || typeof root !== 'string') return;
      await invoke('write_view_command', { root, instance_id: instanceId, offsets: payload });
    },
    probe: (event) => {
      const sink = globalThis.window?.__MAESTRO_PROBE__;
      if (typeof sink === 'function') sink(event);
    },
    openStream: (url, handlers) => openStream(url, creds?.token ?? '', handlers),
  };
}

// The page entry lives in `index.html`: it imports `mountApp` and starts the
// assembly. This module stays free of a document-presence branch so the same
// code path is imported directly by tests and by the window.

