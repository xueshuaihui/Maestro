/**
 * Health hover rendering, pure module (I1.10a WP-3; requirement A-7 /
 * AC-32, split doc 2.2). No DOM, no fs, no `Date.now`, no `window`.
 *
 * The hover line is rendered exclusively through the `HEALTH_LINE` /
 * `HEALTH_REASON` flat label keys delivered by `GET /ui/labels` plus the
 * `health.reasons` arguments as they arrive from the interface — this module
 * only formats, it never recomputes health, never reorders reasons and never
 * invents a sentence. With no reasons it renders exactly the bare health line
 * (`HEALTH_LINE_BASE` with the level word); reason sentences are joined with
 * `HEALTH_LINE_SEP` and wrapped by `HEALTH_LINE_WITH_REASONS`.
 *
 * Reason elements are either `{code, ...vars}` objects (the `GET /instances`
 * shape, with the placeholder arguments the daemon derived read-only from the
 * snapshot) or plain code strings; a code without a `HEALTH_REASON_<CODE>`
 * key renders as an empty fragment instead of a made-up sentence.
 *
 * Zero CJK characters; placeholders are replaced literally and a missing
 * argument keeps its `{xx}` form (batch-1 consumption discipline).
 */

/** Fallback separator (A-0 fixed separator) when the label key is missing. */
const FALLBACK_SEP = ' \u00B7 ';

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

/** Level word through `HEALTH_LABEL_<LEVEL>`; a missing level degrades to normal. */
function levelWord(health, labels) {
  const level = typeof health?.level === 'string' && health.level.length > 0
    ? health.level
    : 'normal';
  return text(labels[`HEALTH_LABEL_${level.toUpperCase()}`]) || level;
}

/** One reason sentence through `HEALTH_REASON_<CODE>`; unknown codes vanish. */
function sentenceFor(reason, labels) {
  const code = reason !== null && typeof reason === 'object' ? reason.code : reason;
  const vars = reason !== null && typeof reason === 'object' ? reason : {};
  if (typeof code !== 'string' || code.length === 0) return '';
  const template = labels[`HEALTH_REASON_${code.toUpperCase()}`];
  if (typeof template !== 'string') return '';
  return fill(template, vars);
}

/**
 * Renders the A-7 hover line for one instance health value: with reasons, the
 * `HEALTH_LINE_WITH_REASONS` template filled with the level word and the
 * `HEALTH_LINE_SEP`-joined reason sentences; without reasons (or with only
 * unknown codes), the bare `HEALTH_LINE_BASE` line.
 */
export function renderHealthHover(health = {}, labels = {}) {
  const level = levelWord(health, labels);
  const reasons = Array.isArray(health?.reasons) ? health.reasons : [];
  const sentences = reasons
    .map((reason) => sentenceFor(reason, labels))
    .filter((sentence) => sentence.length > 0);
  if (sentences.length === 0) {
    return fill(text(labels.HEALTH_LINE_BASE) || '', { level });
  }
  const sep = text(labels.HEALTH_LINE_SEP) || FALLBACK_SEP;
  return fill(text(labels.HEALTH_LINE_WITH_REASONS) || '', {
    level,
    reasons: sentences.join(sep),
  });
}
