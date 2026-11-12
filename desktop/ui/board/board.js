/**
 * Node board projection (I1.10a WP-5; A-12 / AC-24 / AC-35, U-8).
 *
 * Contract (split doc 2.2 / requirement D-4):
 * - `projectBoard({ state, graph, labels })` derives the fixed seven read-only
 *   columns from the instance snapshot nodes plus the graph edges:
 *   `{ columns, columnNames, cards, cancelledFold, cancelledCount, unknownTag }`.
 * - Cards are the snapshot orchestration nodes (`state.nodes`, id =
 *   `nodeId ?? id`, raw status = `state ?? status`). The column mapping over
 *   the nine baseline states is: `blocked -> blocked`, `ready -> ready`,
 *   `assigned -> running`, `running -> running`, `review -> review`,
 *   `done -> done`, `failed -> failed`, `escalated -> escalated`.
 * - `pending` is the merged display state of `blocked + ready`; per U-8 the
 *   single state derives into the two columns: a `pending` node lands in
 *   `ready` when every upstream `forward` predecessor is `done` (or when it
 *   has no predecessors), otherwise in `blocked`.
 * - `cancelled` folds into the `done` column as a folded count
 *   (`cancelledFold` renders the frozen `DESKTOP_BOARD_CANCELLED_FOLD`
 *   template); the cards keep `column: 'done'` with `folded: true`.
 * - Unknown states fall to `blocked` with the `DESKTOP_BOARD_UNKNOWN_STATE`
 *   tag on the card: no card is dropped, no exception is thrown (AC-35).
 *   Unknown states never enter any state machine rewrite; they only affect
 *   this projection (explicit default branch).
 * - Upstream derivation (display id space -> snapshot id space): a `role`
 *   display node stands for the snapshot nodes bound to it — its `nodeIds`
 *   when the projection fills them, else the snapshot nodes carrying the
 *   same `roleId` (the frozen WP-4 shape keeps role `nodeIds` empty);
 *   special nodes stand for their own id. A `forward` edge makes the source
 *   ids predecessors of the target ids. A predecessor counts as done only
 *   when all of its snapshot nodes are `done`. No new state field is ever
 *   created.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Column names and fold/unknown texts come from the frozen label keys, so
 * this file stays CJK-free.
 */

/** Fixed seven columns in display order (A-12 / AC-24). */
export const BOARD_COLUMNS = Object.freeze([
  'blocked',
  'ready',
  'running',
  'review',
  'done',
  'failed',
  'escalated',
]);

const COLUMN_BY_STATE = Object.freeze({
  blocked: 'blocked',
  ready: 'ready',
  assigned: 'running',
  running: 'running',
  review: 'review',
  done: 'done',
  failed: 'failed',
  escalated: 'escalated',
});

/** Literal `{xx}` placeholder substitution (same discipline as labels.js). */
function fillTemplate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

function snapshotIdOf(node) {
  const id = node?.nodeId ?? node?.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function rawStateOf(node) {
  const raw = node?.state ?? node?.status;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * Map each display node to the snapshot ids it stands for, and collect card
 * titles along the way. Role nodes resolve through their bound `nodeIds`
 * when present, otherwise through the snapshot nodes carrying the same
 * `roleId` (frozen WP-4 shape: role `nodeIds` stay empty); every other node
 * stands for its own id.
 */
function displayIndex(graph, snapshotNodes) {
  const snapshotIdsByRole = new Map();
  for (const node of snapshotNodes) {
    const roleId = typeof node?.roleId === 'string' && node.roleId.length > 0 ? node.roleId : null;
    const id = snapshotIdOf(node);
    if (roleId === null || id === null) continue;
    if (!snapshotIdsByRole.has(roleId)) snapshotIdsByRole.set(roleId, []);
    snapshotIdsByRole.get(roleId).push(id);
  }

  const idsByDisplay = new Map();
  const titleById = new Map();
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  for (const node of nodes) {
    if (typeof node?.id !== 'string') continue;
    let ids;
    if (Array.isArray(node.nodeIds) && node.nodeIds.length > 0) {
      ids = node.nodeIds.filter((id) => typeof id === 'string');
    } else if (
      node.type === 'role' &&
      typeof node.roleId === 'string' &&
      snapshotIdsByRole.has(node.roleId)
    ) {
      ids = snapshotIdsByRole.get(node.roleId).slice();
    } else {
      ids = [node.id];
    }
    idsByDisplay.set(node.id, ids);
    for (const id of ids) {
      if (!titleById.has(id) && typeof node.title === 'string' && node.title.length > 0) {
        titleById.set(id, node.title);
      }
    }
  }
  return { idsByDisplay, titleById };
}

/**
 * Predecessor snapshot ids per snapshot id, from `forward` graph edges only
 * (D-4: the board column derives from node state + upstream completeness).
 */
function predecessorsBySnapshotId(graph, idsByDisplay) {
  const out = new Map();
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  for (const edge of edges) {
    if (edge?.direction !== 'forward') continue; // backflow never gates readiness
    const fromIds = idsByDisplay.get(edge?.from) ?? [];
    const toIds = idsByDisplay.get(edge?.to) ?? [];
    for (const to of toIds) {
      if (!out.has(to)) out.set(to, new Set());
      const bucket = out.get(to);
      for (const from of fromIds) {
        if (from !== to) bucket.add(from);
      }
    }
  }
  return out;
}

/**
 * Project the read-only node board.
 *
 * @param {{ state?: object|null, graph?: object|null, labels?: object }} input
 *        `state` is the instance snapshot (cards come from `state.nodes`),
 *        `graph` the WP-4 projection (upstream edges + titles), `labels` the
 *        frozen label key table for the seven column names and the fold and
 *        unknown texts.
 */
export function projectBoard({ state, graph, labels } = {}) {
  const snapshotNodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const { idsByDisplay, titleById } = displayIndex(graph, snapshotNodes);
  const predecessors = predecessorsBySnapshotId(graph, idsByDisplay);

  const stateById = new Map();
  for (const node of snapshotNodes) {
    const id = snapshotIdOf(node);
    if (id !== null && !stateById.has(id)) stateById.set(id, rawStateOf(node));
  }

  const isDone = (id) => stateById.get(id) === 'done';
  const upstreamDone = (id) => {
    const preds = predecessors.get(id);
    if (preds === undefined || preds.size === 0) return true; // no predecessors
    for (const pred of preds) {
      if (!isDone(pred)) return false;
    }
    return true;
  };

  const cards = [];
  let cancelledCount = 0;
  let unknownCount = 0;

  for (const node of snapshotNodes) {
    const id = snapshotIdOf(node);
    if (id === null) continue;
    const raw = rawStateOf(node);
    let column;
    let folded = false;
    let unknown = false;
    if (raw === 'pending') {
      // U-8: the single merged display state derives into the two columns.
      column = upstreamDone(id) ? 'ready' : 'blocked';
    } else if (raw === 'cancelled') {
      column = 'done'; // folds into the done column as a count (U-8)
      folded = true;
      cancelledCount += 1;
    } else if (COLUMN_BY_STATE[raw] !== undefined) {
      column = COLUMN_BY_STATE[raw];
    } else {
      // AC-35 explicit default branch: unknown states land in blocked with
      // the unknown tag; nothing throws, nothing is dropped.
      column = 'blocked';
      unknown = true;
      unknownCount += 1;
    }
    cards.push({
      id,
      title: titleById.get(id) ?? id,
      state: raw,
      column,
      folded,
      unknown,
    });
  }

  const cancelledFold = cancelledCount > 0 && typeof labels?.DESKTOP_BOARD_CANCELLED_FOLD === 'string'
    ? fillTemplate(labels.DESKTOP_BOARD_CANCELLED_FOLD, { n: cancelledCount })
    : null;

  return {
    columns: BOARD_COLUMNS.slice(),
    columnNames: [
      labels?.DESKTOP_BOARD_COLUMN_BLOCKED ?? null,
      labels?.DESKTOP_BOARD_COLUMN_READY ?? null,
      labels?.DESKTOP_BOARD_COLUMN_RUNNING ?? null,
      labels?.DESKTOP_BOARD_COLUMN_REVIEW ?? null,
      labels?.DESKTOP_BOARD_COLUMN_DONE ?? null,
      labels?.DESKTOP_BOARD_COLUMN_FAILED ?? null,
      labels?.DESKTOP_BOARD_COLUMN_ESCALATED ?? null,
    ],
    cards,
    cancelledFold,
    cancelledCount,
    unknownTag: typeof labels?.DESKTOP_BOARD_UNKNOWN_STATE === 'string'
      ? labels.DESKTOP_BOARD_UNKNOWN_STATE
      : null,
    unknownCount,
  };
}
