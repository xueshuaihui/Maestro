/**
 * Human-intervention queue view model (I1.11 WP-8; requirement A-2 / A-3 /
 * A-4 / A-5, AC-08 / AC-11 / AC-15 / AC-43 / AC-44 / AC-47 / AC-49).
 *
 * Contract:
 * - One row per pending escalation / approval across instances. The row text
 *   is the fixed 7-segment ` · ` template of A-3 (`DESKTOP_QUEUE_ROW_ESC` /
 *   `DESKTOP_QUEUE_ROW_APR`); a row without a node keeps every segment
 *   (the node / round placeholder segments), nothing is dropped. Rows are consumed in the
 *   projection order (the daemon owns the sort: escalation first, then id,
 *   then instance) — this module never re-sorts and never recomputes counts
 *   (D-36: zero computation in the view layer).
 * - A degraded row (instance snapshot unreadable, `id === null`) renders the
 *   A-3 single-line unreadable form (key DESKTOP_QUEUE_ROW_STATE_UNREADABLE)
 *   and stays expandable-free:
 *   it carries no actions because there is nothing to decide on.
 * - Clicking a row expands that row only (AC-43: no drill-down, no jump, no
 *   filter / search / custom columns). `CONTROLS` is the closed action list;
 *   it never grows a `filter` / `search` / `columns` key.
 * - Five decisions (A-4): escalation -> continue / reassign / cancel,
 *   approval -> allow / deny. The continue button is disabled with the
 *   server hint only when the response or the projection says so
 *   (`passable === false`, optional `passHint`); the hint wording always
 *   comes from the server side (the projection field or the
 *   `DESKTOP_QUEUE_DISABLED_HINT` label) — this module never guesses text.
 * - Cancel is the only two-step action (AC-11): `confirmTexts` renders the
 *   A-4 confirmation line plus the confirm / dismiss pair.
 * - Result lines (A-4) and the already-resolved notice (A-2 /
 *   `DESKTOP_QUEUE_ALREADY_RESOLVED`) are templates filled with the values
 *   the daemon answered; the server-rendered `message` wins when no
 *   structured value exists (AC-16 wording stays verbatim).
 * - Notification preferences (U-10) render as the four toggle rows of A-2 at
 *   the top of the queue page; the write target is the prefs seam, never the
 *   instance state (BR-25).
 * - Disconnection (AC-47 / BR-36) keeps the last rows and prepends the
 *   A-3 line (key DESKTOP_QUEUE_DISCONNECTED); the caller decides when the channel
 *   recovered (the state machine owns the wording source, this module only
 *   renders `disconnectedText`).
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals: every visible word comes from the label table (flat
 * keys or a `{ keys }` payload through `resolveLabels`). Missing keys yield
 * `null` text — never an invented sentence.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

/** The closed action list of A-4 (escalation first, approval second). */
export const CONTROLS = Object.freeze(['pass', 'retry', 'cancel', 'allow', 'deny']);

/** Decision ids per row type, in the fixed button order of A-4. */
const ACTIONS_BY_TYPE = Object.freeze({
  escalation: Object.freeze([
    { id: 'pass', key: 'DESKTOP_QUEUE_ACTION_PASS' },
    { id: 'retry', key: 'DESKTOP_QUEUE_ACTION_RETRY' },
    { id: 'cancel', key: 'DESKTOP_QUEUE_ACTION_CANCEL' },
  ]),
  approval: Object.freeze([
    { id: 'allow', key: 'DESKTOP_QUEUE_ACTION_ALLOW' },
    { id: 'deny', key: 'DESKTOP_QUEUE_ACTION_DENY' },
  ]),
});

/** Placeholder key for the missing-value segments of A-3 (value `—`). */
const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';

/**
 * Notification preference toggle rows (U-10 / A-2): the master switch first,
 * then the three category switches, in the fixed order of the prefs keys.
 */
const PREF_ROWS = Object.freeze([
  { key: 'enabled', label: 'DESKTOP_NOTIFY_TOGGLE' },
  { key: 'escalate', label: 'DESKTOP_NOTIFY_TOGGLE_ESCALATION' },
  { key: 'completed', label: 'DESKTOP_NOTIFY_TOGGLE_COMPLETED' },
  { key: 'anomaly', label: 'DESKTOP_NOTIFY_TOGGLE_ANOMALY' },
]);

function tableOf(labels) {
  return resolveLabels(labels).keys;
}

function word(labels, key) {
  const value = tableOf(labels)[key];
  return typeof value === 'string' ? value : null;
}

function isRowShape(item) {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/** A degraded row has no id: the projection could not read the instance. */
function isDegraded(item) {
  return item?.id === null || item?.id === undefined;
}

function textOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Segment value for A-3: a missing field renders the fixed placeholder so
 * the row keeps all seven ` · ` segments (the degradation assertion of
 * AC-08). Numbers keep their value; only `null` / `undefined` degrade.
 */
function segmentValue(value, placeholder) {
  if (value === null || value === undefined) return placeholder;
  return String(value);
}

/**
 * The approval reason segment is the action name (ACTION_PREFIX + value form).
 * The projection packs it into `reasonSummary`; the A-3 approval template owns
 * the prefix (key DESKTOP_QUEUE_ACTION_PREFIX), so the packed prefix is
 * stripped once — the prefix word
 * itself comes from the label table (`DESKTOP_QUEUE_ACTION_PREFIX`), never
 * from this file.
 */
function approvalActionOf(item, labels) {
  const reason = textOrNull(item?.reasonSummary);
  if (reason === null) return null;
  const prefix = word(labels, 'DESKTOP_QUEUE_ACTION_PREFIX');
  if (prefix !== null && reason.startsWith(`${prefix} `)) {
    return reason.slice(prefix.length + 1);
  }
  return reason;
}

/**
 * Render one pending queue row into the A-3 text. Degraded rows render the
 * single-line unreadable form instead.
 *
 * @param {object} item the frozen queue projection row (read-only)
 * @param {unknown} labels flat key table or `{ keys }` payload
 * @returns {{ id: string|null, type: string|null, key: string,
 *             text: string|null, unreadable: boolean,
 *             passable: boolean, passHint: string|null }}
 */
export function renderQueueRow(item, labels) {
  if (!isRowShape(item)) {
    return { id: null, type: null, key: '', text: null, unreadable: false, passable: true, passHint: null };
  }
  const table = tableOf(labels);
  const placeholder = typeof table[PLACEHOLDER_KEY] === 'string' ? table[PLACEHOLDER_KEY] : '';
  if (isDegraded(item)) {
    const template = typeof table.DESKTOP_QUEUE_ROW_STATE_UNREADABLE === 'string'
      ? table.DESKTOP_QUEUE_ROW_STATE_UNREADABLE
      : null;
    const text = template === null
      ? null
      : fillTemplate(template, { id: segmentValue(item.instanceId, placeholder) });
    return {
      id: null,
      type: typeof item.type === 'string' ? item.type : null,
      key: degradedKeyOf(item),
      text,
      unreadable: true,
      passable: true,
      passHint: null,
    };
  }
  const isApproval = item.type === 'approval';
  const template = isApproval ? table.DESKTOP_QUEUE_ROW_APR : table.DESKTOP_QUEUE_ROW_ESC;
  const text = typeof template === 'string'
    ? fillTemplate(template, {
      id: segmentValue(item.id, placeholder),
      instanceId: segmentValue(item.instanceId, placeholder),
      nodeId: segmentValue(item.nodeId, placeholder),
      role: segmentValue(item.role, placeholder),
      round: segmentValue(item.round, placeholder),
      state: segmentValue(item.stateWord, placeholder),
      ...(isApproval
        ? { action: segmentValue(approvalActionOf(item, labels), placeholder) }
        : { reason: segmentValue(item.reasonSummary, placeholder) }),
      createdAt: segmentValue(item.createdAt, placeholder),
    })
    : null;
  return {
    id: typeof item.id === 'string' ? item.id : null,
    type: typeof item.type === 'string' ? item.type : null,
    key: rowKeyOf(item),
    text,
    unreadable: false,
    // The continue gate (AC-44) is server-driven: an explicit
    // `passable === false` disables the action; the absence of the field
    // keeps the action available (the projection may not carry the
    // capability yet — the decision path stays the authority either way).
    passable: item.passable !== false,
    passHint: textOrNull(item.passHint),
  };
}

/** Stable row key: the pending id, or the instance id for degraded rows. */
function rowKeyOf(item) {
  if (typeof item?.id === 'string' && item.id.length > 0) return item.id;
  return typeof item?.instanceId === 'string' ? `instance:${item.instanceId}` : '';
}

function degradedKeyOf(item) {
  return typeof item?.instanceId === 'string' ? `instance:${item.instanceId}` : '';
}

/**
 * The A-4 action buttons of one row, in the fixed order, with the disabled
 * / hint state of the continue gate.
 *
 * @returns {Array<{ id: string, text: string|null, disabled: boolean,
 *                   hint: string|null }>}
 */
export function actionsFor(row, labels) {
  if (row === null || typeof row !== 'object' || row.unreadable === true) return [];
  const spec = ACTIONS_BY_TYPE[row.type];
  if (spec === undefined) return [];
  const table = tableOf(labels);
  return spec.map((entry) => {
    const disabled = entry.id === 'pass' && row.passable === false;
    let hint = null;
    if (disabled) {
      hint = typeof row.passHint === 'string' && row.passHint.length > 0
        ? row.passHint
        : (typeof table.DESKTOP_QUEUE_DISABLED_HINT === 'string'
          ? table.DESKTOP_QUEUE_DISABLED_HINT
          : null);
    }
    return {
      id: entry.id,
      text: typeof table[entry.key] === 'string' ? table[entry.key] : null,
      disabled,
      hint,
    };
  });
}

/** Empty queue line (A-3, key DESKTOP_QUEUE_EMPTY) — rendered by the view, never cached. */
export function emptyText(labels) {
  return word(labels, 'DESKTOP_QUEUE_EMPTY');
}

/** Disconnected line (A-3 / BR-36). */
export function disconnectedText(labels) {
  return word(labels, 'DESKTOP_QUEUE_DISCONNECTED');
}

/** A-4 cancel confirmation: the question line plus the confirm / dismiss pair. */
export function confirmTexts(instanceId, labels) {
  const table = tableOf(labels);
  return {
    line: typeof table.DESKTOP_QUEUE_CONFIRM_CANCEL === 'string'
      ? fillTemplate(table.DESKTOP_QUEUE_CONFIRM_CANCEL, { id: instanceId ?? '' })
      : null,
    ok: typeof table.DESKTOP_QUEUE_CONFIRM_OK === 'string' ? table.DESKTOP_QUEUE_CONFIRM_OK : null,
    dismiss: typeof table.DESKTOP_QUEUE_CONFIRM_DISMISS === 'string'
      ? table.DESKTOP_QUEUE_CONFIRM_DISMISS
      : null,
  };
}

/**
 * Result line of a settled decision (A-4). `conclusion` is the fixed word
 * the daemon answered (`RESOLUTION_LABEL` / `APPROVAL_LABEL` vocabulary).
 */
export function resultText(type, { id, conclusion, action }, labels) {
  const table = tableOf(labels);
  if (type === 'cancel') {
    const template = table.DESKTOP_QUEUE_RESULT_CANCELLED;
    return typeof template === 'string' ? fillTemplate(template, { id }) : null;
  }
  if (type === 'approval') {
    const template = table.DESKTOP_QUEUE_RESULT_APPROVAL;
    return typeof template === 'string'
      ? fillTemplate(template, { id, conclusion, action })
      : null;
  }
  const template = table.DESKTOP_QUEUE_RESULT_ESCALATION;
  return typeof template === 'string' ? fillTemplate(template, { id, conclusion }) : null;
}

/**
 * Already-resolved notice (A-2 / D-13). `conclusion` must be a value the
 * daemon supplied; without one the notice stays `null` (the caller falls
 * back to the server-rendered message — this module never fabricates the
 * conclusion word).
 */
export function alreadyResolvedText(conclusion, labels) {
  const template = word(labels, 'DESKTOP_QUEUE_ALREADY_RESOLVED');
  if (template === null || conclusion === null || conclusion === undefined) return null;
  return fillTemplate(template, { conclusion });
}

/**
 * Unsupported-action line (A-5, key DESKTOP_QUEUE_ACTION_UNSUPPORTED) — used when the
 * denial carries no structured values at all.
 */
export function unsupportedText(id, labels) {
  const template = word(labels, 'DESKTOP_QUEUE_ACTION_UNSUPPORTED');
  return template === null ? null : fillTemplate(template, { id });
}

/**
 * Conclusion word of a decision (A-4 uses the fixed `RESOLUTION_LABEL` /
 * `APPROVAL_LABEL` vocabulary). The word always comes from the label table;
 * a decision without a registered word yields `null` (never invented text).
 */
function conclusionWordOf(decision, labels) {
  const table = tableOf(labels);
  const key = CONCLUSION_KEY_BY_DECISION[decision];
  return key === undefined ? null : (typeof table[key] === 'string' ? table[key] : null);
}

const CONCLUSION_KEY_BY_DECISION = Object.freeze({
  pass: 'RESOLUTION_LABEL_PASS',
  retry: 'RESOLUTION_LABEL_RETRY',
  allow: 'APPROVAL_LABEL_APPROVED',
  deny: 'APPROVAL_LABEL_DENIED',
});

/**
 * Map one decision answer onto the visible outcome. Priority (AC-16 / AC-15
 * / AC-44): a successful answer renders its A-4 result line (the conclusion
 * word is the daemon-supplied one when the answer carries it, else the
 * decision's own label); an already-resolved answer renders the A-2 notice
 * with the daemon conclusion; everything else renders the server message
 * verbatim (falling back to the unsupported line only when the answer has no
 * message at all).
 *
 * @param {object} answer the write response body
 *   (`{ ok, result?, conclusion?, hint?, error?, params?, message? }`)
 * @param {object} context `{ type, id, decision, action }` of the row
 * @param {unknown} labels
 * @returns {{ kind: 'result'|'notice'|'message'|'denied'|'none',
 *             text: string|null, passHint: string|null }}
 */
export function outcomeOf(answer, context, labels) {
  const body = isRowShape(answer) ? answer : {};
  if (body.ok === true) {
    const supplied = textOrNull(body.conclusion)
      ?? textOrNull(body.result?.conclusion)
      ?? conclusionWordOf(context.decision, labels);
    return {
      kind: 'result',
      text: resultText(context.type, {
        id: context.id,
        conclusion: supplied,
        action: context.action,
      }, labels),
      passHint: null,
    };
  }
  const passHint = textOrNull(body.hint);
  if (passHint !== null) {
    // A denied continue (AC-44): no result row, the hint becomes the hover
    // wording and the button disables for this row.
    return { kind: 'denied', text: null, passHint };
  }
  const conclusion = textOrNull(body.conclusion);
  if (conclusion !== null) {
    return {
      kind: 'notice',
      text: alreadyResolvedText(conclusion, labels),
      passHint: null,
    };
  }
  const message = textOrNull(body.message);
  if (message !== null) {
    return { kind: 'message', text: message, passHint: null };
  }
  return {
    kind: 'none',
    text: unsupportedText(context.id, labels),
    passHint: null,
  };
}

/**
 * The four notification toggle rows (U-10 / A-2), in the fixed order:
 * master switch first, then the three category switches.
 *
 * @param {object|null} prefs the stored preferences (`{ enabled, escalate,
 *        completed, anomaly }`); a missing table or key counts as enabled
 * @param {unknown} labels
 * @returns {Array<{ key: string, text: string|null, checked: boolean }>}
 */
export function prefsRows(prefs, labels) {
  const table = tableOf(labels);
  const source = prefs !== null && typeof prefs === 'object' ? prefs : {};
  return PREF_ROWS.map((row) => {
    const value = source[row.key];
    return {
      key: row.key,
      text: typeof table[row.label] === 'string' ? table[row.label] : null,
      checked: value !== false,
    };
  });
}
