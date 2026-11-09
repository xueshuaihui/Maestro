/**
 * Normalized serialization + atomic write for writable assets (split doc 2.8, WP-6).
 *
 * Exports (frozen contract, WP-7 / WP-8 depend on these signatures):
 *   serializeRole(role)          -> string   C-07 key order, inline arrays, no comments
 *   serializeSkill(meta, body)   -> string   front matter + verbatim body
 *   serializeWorkflow(workflow)  -> string   workflow/v1 block-sequence nodes/edges (D-2)
 *   atomicWrite({ target, text }) -> Promise<{ok:true} | {ok:false, code}>
 *
 * Discipline (C-02 / C-04 / C-07 / D-1):
 * 1. Zero CJK, zero concrete asset ids. Callers validate BEFORE calling; this module
 *    never judges legality (`--force` does not skip validation - C-03 stays with the
 *    CLI layer).
 * 2. Writes go through a same-directory temp file + `rename`; a failure keeps the
 *    target untouched and leaves no `.tmp` behind (C-04 / NFR-05).
 * 3. The caller owns the three-landing-spot whitelist (`.orch/roles|skills|workflows`
 *    or one explicit `--out`); this module only refuses nothing and creates the
 *    target's own parent directory (skill create needs `.orch/skills/<id>/`).
 *
 * Serialization rules (C-07):
 * - Key order is fixed per asset type; only keys present on the source object are
 *   emitted; comments never survive a rewrite.
 * - Arrays render inline `[a, b]`; empty arrays render `[]`.
 * - A string scalar is quoted when it contains `:` / ` #`, has leading or trailing
 *   whitespace, starts with a YAML indicator, or is empty.
 * - An empty-string value renders as `key : ''` (space before the colon). The file
 *   stays valid YAML and reloads as an empty string, while a plain-text search for
 *   `key:` does not match it (AC-56's machine check greps exactly that).
 */

import fs from 'node:fs';
import path from 'node:path';

const ROLE_KEY_ORDER = Object.freeze([
  'schema',
  'id',
  'name',
  'group',
  'summary',
  'artifact_type',
  'side_effect',
  'derived_from',
  'skills',
  'tools',
  'wake_allow',
  'inputs',
  'outputs',
  'dispatchable',
  'max_concurrent_sessions'
]);

/** camelCase aliases accepted on the input object (loader definitions use them). */
const ROLE_ALIASES = Object.freeze({
  artifact_type: 'artifactType',
  side_effect: 'sideEffect',
  derived_from: 'derivedFrom',
  wake_allow: 'wakeAllow',
  max_concurrent_sessions: 'maxConcurrentSessions'
});

const SKILL_KEY_ORDER = Object.freeze(['schema', 'id', 'name', 'summary', 'applies_to', 'commands']);

const WORKFLOW_KEY_ORDER = Object.freeze([
  'schema',
  'id',
  'name',
  'summary',
  'entry',
  'terminal',
  'nodes',
  'edges'
]);

const NODE_KEY_ORDER = Object.freeze([
  'id',
  'node_type',
  'role',
  'workflow',
  'title',
  'timeout',
  'retry',
  'max_rounds',
  'parallel_scope',
  'scope',
  'inputs',
  'outputs'
]);

const EDGE_KEY_ORDER = Object.freeze(['from', 'to', 'kind', 'when', 'join', 'map']);
const MAP_KEY_ORDER = Object.freeze(['from', 'to']);

/** Field defaults: when a value equals its default the optional key is omitted. */
const EDGE_DEFAULTS = Object.freeze({ kind: 'forward', when: 'always', join: 'all' });

const INDENT = '  ';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Snake key first, camelCase alias second; `undefined` when the object has neither. */
function pickValue(obj, key, aliases) {
  if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) return obj[key];
  const alias = aliases?.[key];
  if (alias !== undefined && Object.prototype.hasOwnProperty.call(obj, alias) && obj[alias] !== undefined) {
    return obj[alias];
  }
  return undefined;
}

function needsQuote(text) {
  if (text === '') return true;
  if (/^[\s]|[\s]$/.test(text)) return true;
  if (text.includes(':') || text.includes(' #')) return true;
  return /^[-?:,[\]{}#&*!|>'"%@`]/.test(text);
}

function quoteScalar(text) {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function scalarYaml(value) {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  return needsQuote(text) ? quoteScalar(text) : text;
}

/** Inline `[a, b]`; an empty array renders `[]` (C-07). */
function arrayYaml(values) {
  return `[${values.map((item) => scalarYaml(item)).join(', ')}]`;
}

function isEmptiableArray(value) {
  return Array.isArray(value) && value.length === 0;
}

function valueYaml(value) {
  if (Array.isArray(value)) return arrayYaml(value);
  if (isPlainObject(value)) return ''; // nested mappings are handled by callers
  return scalarYaml(value);
}

function entryLine(key, value) {
  const body = valueYaml(value);
  if (body === '' && typeof value === 'string' && value === '') {
    // Empty string: keep the key (it reloads as ''), but keep the literal `key:`
    // out of the file (AC-56 greps it).
    return `${key} : ''`;
  }
  return `${key}: ${body}`;
}

function skipValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value === '') return true;
  return false;
}

function mappingLines(obj, keyOrder, aliases, indent) {
  const lines = [];
  for (const key of keyOrder) {
    const value = pickValue(obj, key, aliases);
    if (skipValue(value)) continue;
    if (Array.isArray(value)) {
      lines.push(`${indent}${key}: ${arrayYaml(value)}`);
    } else if (isPlainObject(value)) {
      continue; // nested mappings are emitted by dedicated callers below
    } else {
      lines.push(`${indent}${entryLine(key, value)}`);
    }
  }
  return lines;
}

/** C-07 serialization of one role asset object. */
export function serializeRole(role) {
  const source = isPlainObject(role) ? role : {};
  const lines = [];
  for (const key of ROLE_KEY_ORDER) {
    const value = pickValue(source, key, ROLE_ALIASES);
    if (value === undefined || value === null) continue;
    if (key === 'summary' && value === '') {
      // Required key with an empty value: keep it loadable, keep `summary:` out.
      lines.push('summary : \'\'');
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}: ${arrayYaml(value)}`);
    } else {
      lines.push(entryLine(key, value));
    }
  }
  return `${lines.join('\n')}\n`;
}

/** Front matter + body for one `SKILL.md` asset (BR-15 layout). */
export function serializeSkill(meta, body) {
  const source = isPlainObject(meta) ? meta : {};
  const lines = ['---'];
  lines.push(...mappingLines(source, SKILL_KEY_ORDER, null, ''));
  lines.push('---');
  let bodyText = typeof body === 'string' ? body : '';
  if (bodyText.length > 0 && !bodyText.endsWith('\n')) bodyText = `${bodyText}\n`;
  return `${lines.join('\n')}\n${bodyText}`;
}

function workflowNodeLines(node, indent) {
  const source = isPlainObject(node) ? node : {};
  const lines = [];
  let first = true;
  for (const key of NODE_KEY_ORDER) {
    const value = pickValue(source, key, null);
    if (skipValue(value)) continue;
    if (isEmptiableArray(value) && (key === 'inputs' || key === 'outputs')) continue;
    const prefix = first ? `${indent}- ` : `${indent}${INDENT}`;
    lines.push(`${prefix}${entryLine(key, value)}`);
    first = false;
  }
  return lines;
}

function workflowMapLines(map, indent) {
  const lines = [];
  for (const item of Array.isArray(map) ? map : []) {
    if (!isPlainObject(item)) continue;
    let first = true;
    for (const key of MAP_KEY_ORDER) {
      const value = item[key];
      if (skipValue(value)) continue;
      const prefix = first ? `${indent}- ` : `${indent}${INDENT}`;
      lines.push(`${prefix}${entryLine(key, value)}`);
      first = false;
    }
  }
  return lines;
}

function workflowEdgeLines(edge, indent) {
  const source = isPlainObject(edge) ? edge : {};
  const lines = [];
  let first = true;
  for (const key of EDGE_KEY_ORDER) {
    if (key === 'map') {
      const mapLines = workflowMapLines(source.map, `${indent}${INDENT}${INDENT}`);
      if (mapLines.length === 0) continue;
      lines.push(`${indent}${INDENT}map:`);
      lines.push(...mapLines);
      first = false;
      continue;
    }
    const value = pickValue(source, key, null);
    if (value === undefined || value === null) continue;
    if (key in EDGE_DEFAULTS && value === EDGE_DEFAULTS[key]) continue;
    const prefix = first ? `${indent}- ` : `${indent}${INDENT}`;
    lines.push(`${prefix}${entryLine(key, value)}`);
    first = false;
  }
  return lines;
}

/**
 * C-07 serialization of one `workflow/v1` asset object. Nodes and edges are block
 * sequences of mappings (D-2: no inline mappings); optional edge fields whose value
 * equals their default (`forward` / `always` / `all`) are omitted so a file created
 * from a built-in projection stays minimal and round-trips through validation.
 */
export function serializeWorkflow(workflow) {
  const source = isPlainObject(workflow) ? workflow : {};
  const lines = [];
  for (const key of WORKFLOW_KEY_ORDER) {
    if (key === 'nodes' || key === 'edges') continue;
    const value = pickValue(source, key, null);
    if (skipValue(value)) continue;
    lines.push(entryLine(key, value));
  }

  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  if (nodes.length > 0) {
    lines.push('nodes:');
    for (const node of nodes) lines.push(...workflowNodeLines(node, INDENT));
  }

  const edges = Array.isArray(source.edges) ? source.edges : [];
  if (edges.length > 0) {
    lines.push('edges:');
    for (const edge of edges) lines.push(...workflowEdgeLines(edge, INDENT));
  }

  return `${lines.join('\n')}\n`;
}

let tempCounter = 0;

/**
 * C-04: write `text` to `target` through a same-directory temp file + rename. On any
 * failure the target keeps its previous content and no `.tmp` file survives.
 *
 * @param {{target: string, text: string}} input absolute target path, final text
 * @returns {Promise<{ok: true} | {ok: false, code: string}>}
 */
export async function atomicWrite({ target, text }) {
  const file = path.resolve(String(target ?? ''));
  const dir = path.dirname(file);
  const temp = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.${tempCounter += 1}.tmp`
  );
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(temp, String(text ?? ''), 'utf8');
    try {
      fs.renameSync(temp, file);
    } catch (error) {
      try {
        fs.unlinkSync(temp);
      } catch {
        // the temp file is best-effort removed; the original error is reported
      }
      throw error;
    }
    return { ok: true };
  } catch {
    try {
      fs.unlinkSync(temp);
    } catch {
      // nothing to clean up when the temp file was never created
    }
    return { ok: false, code: 'ASSET_WRITE_FAILED' };
  }
}
