/**
 * Project root resolution and the first-screen guard (I1.10a WP-8;
 * requirement A-3 / AC-31, split doc 2.2, U-1).
 *
 * Priority is fixed by the requirement: `--project` argument, then the
 * environment value, then the remembered project root, then the "project
 * missing" prompt. A supplied root that fails the usability predicate stops
 * at `project-invalid` with that path in the line: the higher-priority value
 * never falls through to the next source, so a bad `--project` can never be
 * masked by a remembered project.
 *
 * The module is pure: the caller injects `isUsable` (the shell validates the
 * directory; a test passes a predicate). Without a predicate only the
 * syntactic shape is checked, which keeps the module usable before the
 * channel is live.
 *
 * Every visible line comes from the frozen label keys (`DESKTOP_PROJECT_*`)
 * at render time. A summary without a label table still carries `messageKey`
 * and `params`, so the view can render it as soon as the table arrives.
 *
 * Zero CJK literals.
 */

import { fillTemplate, resolveLabels } from './labels/labels.js';

/** The three project views the first screen can take. */
export const PROJECT_VIEW = Object.freeze({
  instances: 'instances',
  missing: 'project-missing',
  invalid: 'project-invalid',
});

function normalizeRoot(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function defaultUsable(value) {
  return normalizeRoot(value) !== null;
}

function messageFor(key, params, labels) {
  const table = resolveLabels(labels ?? {}).keys;
  const template = table[key];
  if (typeof template !== 'string' || template.length === 0) return null;
  return fillTemplate(template, params ?? {});
}

function summaryFor(view, { root = null, source, messageKey, params, labels } = {}) {
  return {
    view,
    root,
    source,
    messageKey,
    params: params ?? {},
    message: messageFor(messageKey, params, labels),
  };
}

/**
 * Resolve the first-screen project view.
 *
 * @param {object} [input]
 * @param {string} [input.argRoot] `--project` value (highest priority)
 * @param {string} [input.envRoot] environment value (second priority)
 * @param {string} [input.remembered] remembered project root (third priority)
 * @param {(root: string) => boolean} [input.isUsable] directory predicate
 * @param {unknown} [input.labels] flat key table or `{ keys }` payload
 * @returns {{ view: string, root: string|null, source: string,
 *             messageKey: string|null, params: object, message: string|null }}
 */
export function resolveProject({
  argRoot,
  envRoot,
  remembered,
  isUsable,
  labels,
} = {}) {
  const usable = typeof isUsable === 'function' ? isUsable : defaultUsable;

  const candidates = [
    ['arg', normalizeRoot(argRoot)],
    ['env', normalizeRoot(envRoot)],
    ['remembered', normalizeRoot(remembered)],
  ];
  for (const [source, root] of candidates) {
    if (root === null) continue;
    if (usable(root)) {
      return summaryFor(PROJECT_VIEW.instances, { root, source, labels });
    }
    return summaryFor(PROJECT_VIEW.invalid, {
      root,
      source,
      messageKey: 'DESKTOP_PROJECT_INVALID',
      params: { path: root },
      labels,
    });
  }

  return summaryFor(PROJECT_VIEW.missing, {
    source: 'none',
    messageKey: 'DESKTOP_PROJECT_MISSING',
    labels,
  });
}

/**
 * Render one project summary against a label table (used after the labels
 * channel arrives, when the summary was produced without one).
 */
export function projectMessage(summary, labels) {
  if (summary === null || typeof summary !== 'object') return null;
  if (typeof summary.messageKey !== 'string' || summary.messageKey.length === 0) return null;
  return messageFor(summary.messageKey, summary.params, labels);
}

/**
 * True when the summary keeps the first screen on the prompt page.
 */
export function isProjectBlocked(summary) {
  return summary?.view === PROJECT_VIEW.missing || summary?.view === PROJECT_VIEW.invalid;
}
