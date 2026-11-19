/**
 * Asset library view model (I1.11 WP-8; requirement A-5, AC-19 / AC-20 /
 * AC-21 / AC-22 / AC-23 / AC-24 / AC-46).
 *
 * Contract:
 * - Three tabs (roles / skills / workflows), each with its count line
 *   (key DESKTOP_ASSET_COUNT) and its row template. Rows are consumed in
 *   projection order; the view never
 *   recomputes the counts (D-36) — it renders what the projection answered
 *   and the count line must stay self-consistent with the row source words.
 * - The source segment of a row is only the builtin or project word (the
 *   projection's `source` word, passed through). A workflow row has no group column
 *   (BR-14): the workflow template owns that shape.
 * - A single unreadable asset stays in the list and renders the A-5
 *   single-file line (key DESKTOP_ASSET_ITEM_UNREADABLE); a whole unreadable
 *   directory renders the directory banner (key DESKTOP_ASSET_UNREADABLE)
 *   instead — the two forms never mix (A-5).
 * - Detail lines (A-5 blocks) are rendered in the fixed order with the
 *   detail fields passed through verbatim; missing references carry the
 *   missing word (key DESKTOP_ASSET_MISSING) from the label table; the
 *   validation line appends the CLI
 *   verbatim reason when the projection answered one. Missing optional
 *   fields render the placeholder, never an invented sentence.
 *
 * Purity: no DOM, no fs, no wall clock, no `window`; inputs never mutated.
 * Zero CJK literals: every visible word comes from the label table.
 */

import { fillTemplate, resolveLabels } from '../labels/labels.js';

/** Tab order of the asset library (fixed). */
export const ASSET_KINDS = Object.freeze(['roles', 'skills', 'workflows']);

const KIND_LABEL_KEY = Object.freeze({
  roles: 'DESKTOP_ASSET_KIND_ROLES',
  skills: 'DESKTOP_ASSET_KIND_SKILLS',
  workflows: 'DESKTOP_ASSET_KIND_WORKFLOWS',
});

const ROW_TEMPLATE_KEY = Object.freeze({
  roles: 'DESKTOP_ASSET_ROW_ROLE',
  skills: 'DESKTOP_ASSET_ROW_SKILL',
  workflows: 'DESKTOP_ASSET_ROW_WORKFLOW',
});

const PLACEHOLDER_KEY = 'DESKTOP_PLACEHOLDER';

function tableOf(labels) {
  return resolveLabels(labels).keys;
}

function word(labels, key) {
  const value = tableOf(labels)[key];
  return typeof value === 'string' ? value : null;
}

function placeholderOf(labels) {
  const value = tableOf(labels)[PLACEHOLDER_KEY];
  return typeof value === 'string' ? value : '';
}

function kindWord(kind, labels) {
  return word(labels, KIND_LABEL_KEY[kind] ?? '');
}

/** The `.orch/<kind>` directory text of the A-5 banner (ASCII path, no wording). */
function dirOf(kind) {
  return `.orch/${kind}`;
}

/** Tab caption of one asset kind. */
export function tabText(kind, labels) {
  return kindWord(kind, labels);
}

/**
 * Count line of one tab (A-5). The kind word comes from the label table so
 * the line reads from the template without this module knowing the vocabulary.
 */
export function countText(kind, counts, labels) {
  const template = word(labels, 'DESKTOP_ASSET_COUNT');
  if (template === null) return null;
  const safe = counts !== null && typeof counts === 'object' ? counts : {};
  return fillTemplate(template, {
    kind: kindWord(kind, labels),
    total: segment(safe.total),
    builtin: segment(safe.builtin),
    project: segment(safe.project),
  });
}

function segment(value) {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * One list row (A-5). Unreadable items (the projection marks them via the
 * `unreadable` ids list or the unreadable validation word) render the
 * single-file degradation line instead of the normal template.
 *
 * @param {string} kind one of `ASSET_KINDS`
 * @param {object} item the frozen list row (read-only)
 * @param {unknown} labels
 * @returns {{ id: string|null, text: string|null, unreadable: boolean }}
 */
export function rowText(kind, item, labels) {
  if (item === null || typeof item !== 'object') {
    return { id: null, text: null, unreadable: false };
  }
  const id = typeof item.id === 'string' ? item.id : null;
  const kindValue = kindWord(kind, labels);
  const validation = typeof item.validation === 'string' ? item.validation : null;
  const unreadableWord = word(labels, 'DESKTOP_ASSET_VALIDATION_UNREADABLE');
  const isUnreadable = item.unreadable === true
    || (unreadableWord !== null && validation === unreadableWord);
  if (isUnreadable) {
    const template = word(labels, 'DESKTOP_ASSET_ITEM_UNREADABLE');
    return {
      id,
      text: template === null ? null : fillTemplate(template, { kind: kindValue, id: id ?? '' }),
      unreadable: true,
    };
  }
  const template = word(labels, ROW_TEMPLATE_KEY[kind] ?? '');
  if (template === null) return { id, text: null, unreadable: false };
  const placeholder = placeholderOf(labels);
  const group = typeof item.group === 'string' && item.group.length > 0 ? item.group : placeholder;
  const source = typeof item.source === 'string' ? item.source : placeholder;
  const validationText = validation ?? placeholder;
  let text;
  if (kind === 'roles') {
    text = fillTemplate(template, { name: item.name ?? id ?? placeholder, group, source, validation: validationText });
  } else if (kind === 'skills') {
    text = fillTemplate(template, {
      id: id ?? placeholder,
      group,
      source,
      n: segment(item.commands),
      validation: validationText,
    });
  } else {
    text = fillTemplate(template, {
      name: item.name ?? id ?? placeholder,
      source,
      nodes: segment(item.nodeCount),
      edges: segment(item.edgeCount),
      validation: validationText,
    });
  }
  return { id, text, unreadable: false };
}

/** Directory-level degradation banner (A-5, key DESKTOP_ASSET_UNREADABLE). */
export function dirUnreadableText(kind, labels) {
  const template = word(labels, 'DESKTOP_ASSET_UNREADABLE');
  return template === null ? null : fillTemplate(template, { dir: dirOf(kind) });
}

/**
 * One multi-value list segment with the missing markers of A-5: a missing
 * reference renders the id plus the missing word (key DESKTOP_ASSET_MISSING),
 * which comes from the label table, never from this file.
 *
 * @param {Array<{id: string|null, missing?: boolean}>} refs
 */
function refListOf(refs, labels) {
  const list = Array.isArray(refs) ? refs : [];
  const missing = word(labels, 'DESKTOP_ASSET_MISSING');
  return list
    .map((ref) => {
      const id = typeof ref?.id === 'string' ? ref.id : '';
      if (ref?.missing === true && missing !== null) return `${id} · ${missing}`;
      return id;
    })
    .join(', ');
}

/** Validation line with the CLI-verbatim reason appended when present. */
function validationLine(detail, labels) {
  const template = word(labels, 'DESKTOP_ASSET_DETAIL_VALIDATION');
  if (template === null) return null;
  const placeholder = placeholderOf(labels);
  const validation = typeof detail?.validation === 'string' ? detail.validation : placeholder;
  const reason = typeof detail?.reason === 'string' && detail.reason.length > 0
    ? detail.reason
    : null;
  return fillTemplate(template, {
    validation: reason === null ? validation : `${validation} · ${reason}`,
  });
}

/**
 * Detail lines of one asset (A-5 blocks, fixed line order per kind).
 *
 * @param {string} kind one of `ASSET_KINDS`
 * @param {object} detail the frozen detail projection (read-only)
 * @param {unknown} labels
 * @returns {string[]} the rendered lines (empty when the detail is absent)
 */
export function detailLines(kind, detail, labels) {
  if (detail === null || typeof detail !== 'object' || detail.found === false) return [];
  const table = tableOf(labels);
  const placeholder = placeholderOf(labels);
  const dash = (value) => (value === null || value === undefined || value === '' ? placeholder : String(value));
  const lines = [];

  if (kind === 'roles') {
    const header = table.DESKTOP_ASSET_DETAIL_ROLE_HEADER;
    if (typeof header === 'string') {
      lines.push(fillTemplate(header, {
        name: dash(detail.name),
        group: dash(detail.groupLabel ?? detail.group),
        artifact: dash(detail.artifactType),
        effect: dash(detail.sideEffect),
        n: dash(detail.maxConcurrentSessions),
      }));
    }
    const skills = table.DESKTOP_ASSET_DETAIL_ROLE_SKILLS;
    if (typeof skills === 'string') {
      lines.push(fillTemplate(skills, {
        n: Array.isArray(detail.skills) ? detail.skills.length : 0,
        list: refListOf(detail.skills, labels) || placeholder,
      }));
    }
    const tools = table.DESKTOP_ASSET_DETAIL_TOOLS;
    if (typeof tools === 'string') {
      const list = Array.isArray(detail.tools) ? detail.tools.filter((t) => typeof t === 'string') : [];
      lines.push(fillTemplate(tools, { tools: list.join(', ') || placeholder }));
    }
    const wake = table.DESKTOP_ASSET_DETAIL_WAKE;
    if (typeof wake === 'string') {
      const refs = Array.isArray(detail.wakeAllow) ? detail.wakeAllow : [];
      lines.push(fillTemplate(wake, { n: refs.length, list: refListOf(refs, labels) || placeholder }));
    }
  } else if (kind === 'skills') {
    const header = table.DESKTOP_ASSET_DETAIL_SKILL_HEADER;
    if (typeof header === 'string') {
      const groups = Array.isArray(detail.appliesToLabels)
        ? detail.appliesToLabels.filter((g) => typeof g === 'string' && g.length > 0)
        : [];
      lines.push(fillTemplate(header, {
        id: dash(detail.id),
        group: groups.join(', ') || placeholder,
        n: Array.isArray(detail.commands) ? detail.commands.length : 0,
      }));
    }
    const summary = table.DESKTOP_ASSET_DETAIL_SUMMARY;
    if (typeof summary === 'string') {
      lines.push(fillTemplate(summary, { summary: dash(detail.summary) }));
    }
    const body = table.DESKTOP_ASSET_DETAIL_BODY;
    if (typeof body === 'string') {
      lines.push(fillTemplate(body, { n: dash(detail.bodyPreviewLines) }));
    }
  } else {
    const header = table.DESKTOP_ASSET_DETAIL_WORKFLOW_HEADER;
    if (typeof header === 'string') {
      lines.push(fillTemplate(header, {
        name: dash(detail.name),
        nodes: dash(detail.nodeCount),
        edges: dash(detail.edgeCount),
      }));
    }
    const nodes = Array.isArray(detail.nodes) ? detail.nodes : [];
    const nodeLine = nodes
      .map((node) => `${typeof node?.id === 'string' ? node.id : ''} ${dash(node?.typeLabel)}`.trim())
      .join(' · ');
    if (nodeLine.length > 0) lines.push(nodeLine);
    const backflow = table.DESKTOP_ASSET_DETAIL_BACKFLOW;
    if (typeof backflow === 'string') {
      lines.push(fillTemplate(backflow, { n: dash(detail.backflowCount) }));
    }
  }

  const validation = validationLine(detail, labels);
  if (validation !== null) lines.push(validation);
  return lines;
}
