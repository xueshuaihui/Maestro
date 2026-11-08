/**
 * Field contract for role and skill assets (requirement D-3).
 *
 * This module holds the closed value sets plus the two pure shape checkers. It
 * never reads a file, never produces natural-language text and never mentions a
 * concrete asset id: `GROUPS` is a group enumeration, not an asset name.
 *
 * Returned arrays are already in output order (D-3 steps 3..7):
 *   required keys -> id / file name -> group -> artifact_type -> side_effect
 *   -> max_concurrent_sessions ; skills additionally check applies_to.
 */

export const ROLE_SCHEMA_VERSION = 'role/v1';
export const SKILL_SCHEMA_VERSION = 'skill/v1';

export const GROUPS = Object.freeze(['coordinator', 'research', 'writing', 'coding', 'ops']);
export const ARTIFACT_TYPES = Object.freeze(['code', 'document', 'dataset', 'report']);
export const SIDE_EFFECTS = Object.freeze(['none', 'read', 'write', 'exec']);

export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = 5;

export const ROLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const ROLE_ID_MIN = 2;
export const ROLE_ID_MAX = 32;

export const ROLE_REQUIRED_KEYS = Object.freeze([
  'schema',
  'id',
  'name',
  'group',
  'summary',
  'artifact_type',
  'side_effect',
  'skills',
  'max_concurrent_sessions'
]);

export const ROLE_OPTIONAL_KEYS = Object.freeze([
  'tools',
  'wake_allow',
  'inputs',
  'outputs',
  'dispatchable'
]);

export const SKILL_REQUIRED_KEYS = Object.freeze(['schema', 'id', 'name', 'summary']);
export const SKILL_OPTIONAL_KEYS = Object.freeze(['applies_to', 'commands']);

const ROLE_STRING_ARRAY_KEYS = Object.freeze([
  'skills',
  'tools',
  'wake_allow',
  'inputs',
  'outputs'
]);

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function idInvalid(value) {
  if (typeof value !== 'string') return true;
  if (value.length < ROLE_ID_MIN || value.length > ROLE_ID_MAX) return true;
  return !ROLE_ID_PATTERN.test(value);
}

/**
 * @param {object} obj parsed role file
 * @param {{fileId?: string}} [context] file name without extension
 * @returns {Array<{code:string, field:string|null, params:object}>}
 */
export function checkRoleShape(obj, { fileId } = {}) {
  const out = [];
  const source = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};

  for (const key of ROLE_REQUIRED_KEYS) {
    if (!has(source, key)) {
      out.push({ code: 'ROLE_SCHEMA_MISSING', field: key, params: { field: key } });
    }
  }
  if (has(source, 'schema') && source.schema !== ROLE_SCHEMA_VERSION) {
    out.push({ code: 'ROLE_SCHEMA_MISSING', field: 'schema', params: { field: 'schema' } });
  }
  for (const key of ['name', 'summary']) {
    if (has(source, key) && typeof source[key] !== 'string') {
      out.push({ code: 'ROLE_SCHEMA_MISSING', field: key, params: { field: key } });
    }
  }
  for (const key of ROLE_STRING_ARRAY_KEYS) {
    if (has(source, key) && !isStringArray(source[key])) {
      out.push({ code: 'ROLE_SCHEMA_MISSING', field: key, params: { field: key } });
    }
  }
  if (has(source, 'dispatchable') && typeof source.dispatchable !== 'boolean') {
    out.push({ code: 'ROLE_SCHEMA_MISSING', field: 'dispatchable', params: { field: 'dispatchable' } });
  }

  if (has(source, 'id')) {
    const mismatch = idInvalid(source.id) || (fileId !== undefined && source.id !== fileId);
    if (mismatch) {
      out.push({
        code: 'ROLE_ID_MISMATCH',
        field: 'id',
        params: { fileId: fileId ?? null, declaredId: source.id }
      });
    }
  }

  if (has(source, 'group') && !GROUPS.includes(source.group)) {
    out.push({ code: 'ROLE_GROUP_INVALID', field: 'group', params: { value: source.group } });
  }
  if (has(source, 'artifact_type') && !ARTIFACT_TYPES.includes(source.artifact_type)) {
    out.push({
      code: 'ROLE_ARTIFACT_TYPE_INVALID',
      field: 'artifact_type',
      params: { value: source.artifact_type }
    });
  }
  if (has(source, 'side_effect') && !SIDE_EFFECTS.includes(source.side_effect)) {
    out.push({
      code: 'ROLE_SIDE_EFFECT_INVALID',
      field: 'side_effect',
      params: { value: source.side_effect }
    });
  }
  if (has(source, 'max_concurrent_sessions')) {
    const value = source.max_concurrent_sessions;
    const validNumber =
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= CONCURRENCY_MIN &&
      value <= CONCURRENCY_MAX;
    if (!validNumber) {
      out.push({
        code: 'ROLE_MAX_CONCURRENT_INVALID',
        field: 'max_concurrent_sessions',
        params: { value }
      });
    }
  }

  return out;
}

/**
 * @param {object} meta parsed front matter
 * @param {{dirId?: string}} [context] skill directory name
 * @returns {Array<{code:string, field:string|null, params:object}>}
 */
export function checkSkillMeta(meta, { dirId } = {}) {
  const out = [];
  const source = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};

  for (const key of SKILL_REQUIRED_KEYS) {
    if (!has(source, key)) {
      out.push({ code: 'SKILL_SCHEMA_MISSING', field: key, params: { field: key } });
    }
  }
  if (has(source, 'schema') && source.schema !== SKILL_SCHEMA_VERSION) {
    out.push({ code: 'SKILL_SCHEMA_MISSING', field: 'schema', params: { field: 'schema' } });
  }
  for (const key of ['name', 'summary']) {
    if (has(source, key) && typeof source[key] !== 'string') {
      out.push({ code: 'SKILL_SCHEMA_MISSING', field: key, params: { field: key } });
    }
  }

  if (has(source, 'id')) {
    const mismatch = idInvalid(source.id) || (dirId !== undefined && source.id !== dirId);
    if (mismatch) {
      out.push({
        code: 'SKILL_ID_MISMATCH',
        field: 'id',
        params: { dirId: dirId ?? null, declaredId: source.id }
      });
    }
  }

  if (has(source, 'applies_to')) {
    const values = isStringArray(source.applies_to) ? source.applies_to : [source.applies_to];
    for (const value of values) {
      if (!GROUPS.includes(value)) {
        out.push({ code: 'SKILL_GROUP_INVALID', field: 'applies_to', params: { value } });
        break;
      }
    }
  }
  if (has(source, 'commands') && !isStringArray(source.commands)) {
    out.push({ code: 'SKILL_SCHEMA_MISSING', field: 'commands', params: { field: 'commands' } });
  }

  return out;
}
