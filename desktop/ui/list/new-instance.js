/**
 * New-instance panel logic, pure module (I1.10a WP-3; requirement A-5 /
 * AC-05 / AC-06, split doc 2.2). No DOM, no fs, no `Date.now`, no `window`.
 *
 * Validation happens before anything is sent: a missing workflow selection
 * answers `DESKTOP_NEW_VALIDATE_WORKFLOW` and an empty task answers
 * `DESKTOP_NEW_VALIDATE_TASK` (A-5, panel stays open, nothing is started).
 * Workflow rule failures (e.g. the product-declaration line) are NOT invented
 * here: the server answers with the existing error code and the panel renders
 * the `ERROR_TEMPLATE` wording through the flat label keys wrapped by
 * `DESKTOP_NEW_START_FAILED` — the UI layer never hardcodes wording.
 *
 * Zero CJK characters; placeholders are replaced literally and a missing
 * argument keeps its `{xx}` form (batch-1 consumption discipline).
 */

/**
 * Literal `{xx}` replacement; a missing argument keeps the placeholder
 * verbatim.
 */
function fill(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (raw, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : raw
  );
}

function text(value) {
  return typeof value === 'string' ? value : '';
}

/**
 * Validates the panel form: `{ok:true}` when both fields are present, else
 * `{ok:false, message}` with the A-5 validation wording. A whitespace-only
 * task counts as empty (same rule as the CLI run path).
 */
export function validateNewInstance(form = {}, labels = {}) {
  const template = typeof form.template === 'string' ? form.template.trim() : '';
  const task = typeof form.task === 'string' ? form.task : '';
  if (template.length === 0) {
    return { ok: false, message: text(labels.DESKTOP_NEW_VALIDATE_WORKFLOW) };
  }
  if (task.trim().length === 0) {
    return { ok: false, message: text(labels.DESKTOP_NEW_VALIDATE_TASK) };
  }
  return { ok: true };
}

/**
 * Builds the `POST /instances` request body: exactly `{template, task}` —
 * the panel offers no host / concurrency / policy fields (D-2).
 */
export function buildStartRequest(form = {}) {
  return {
    template: typeof form.template === 'string' ? form.template : '',
    task: typeof form.task === 'string' ? form.task : '',
  };
}

/**
 * Renders one server failure answer into the A-5 failure line: the reason is
 * the existing `ERROR_TEMPLATE` wording resolved through the flat key
 * (`ERROR_TEMPLATE_<CODE>` + literal placeholder replacement), falling back to
 * the server-provided message, then to the raw code. The whole reason is
 * wrapped by `DESKTOP_NEW_START_FAILED` (start-failed prefix + original text).
 */
export function renderStartFailure(failure = {}, labels = {}) {
  const reason = renderErrorText(failure, labels);
  return fill(labels.DESKTOP_NEW_START_FAILED, { reason });
}

function renderErrorText({ code, params, message } = {}, labels) {
  const key = typeof code === 'string' && code.length > 0
    ? `ERROR_TEMPLATE_${code}`
    : null;
  const template = key !== null ? labels[key] : null;
  if (typeof template === 'string') return fill(template, params ?? {});
  if (typeof message === 'string' && message.length > 0) return message;
  return typeof code === 'string' && code.length > 0 ? code : '';
}

/**
 * Renders the A-5 started confirmation (`DESKTOP_NEW_STARTED`) for an
 * instance id returned by a successful `POST /instances`.
 */
export function renderStarted(instanceId, labels = {}) {
  return fill(labels.DESKTOP_NEW_STARTED, { id: instanceId ?? '' });
}
