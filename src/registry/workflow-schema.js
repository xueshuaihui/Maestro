/**
 * Field contract for workflow assets (requirement A-1 / A-15 / D-2 / D-3).
 *
 * Pure shape kernel: no IO, no natural language, no concrete asset id. It
 * judges ONE object at a time — a workflow document, a single node or a
 * single edge. Graph-level checks (reachability, cycles, parallel scopes,
 * variable references, wake permissions) belong to the loader, not here.
 *
 * Returned arrays follow the `checkRoleShape` convention: an ordered list of
 * `{ code, field, params }` entries where `field` may be null and `params`
 * is a placeholder object consumed by the label layer.
 */

export const WORKFLOW_SCHEMA_VERSION = 'workflow/v1';

export const NODE_TYPES = Object.freeze(['role', 'human', 'escalate', 'subworkflow']);
export const EDGE_KINDS = Object.freeze(['forward', 'backflow', 'retest']);
export const WHEN_VALUES = Object.freeze(['always', 'passed', 'failed', 'human_approved', 'human_rejected']);
export const JOIN_VALUES = Object.freeze(['all', 'any']);

/**
 * The 19 workflow reason codes, verbatim from A-15 (constant name and
 * string value are identical on purpose).
 */
export const WORKFLOW_REASONS = Object.freeze({
  WORKFLOW_SCHEMA_MISSING: 'WORKFLOW_SCHEMA_MISSING',
  WORKFLOW_ID_MISMATCH: 'WORKFLOW_ID_MISMATCH',
  WORKFLOW_NODE_DUPLICATE: 'WORKFLOW_NODE_DUPLICATE',
  WORKFLOW_NODE_TYPE_INVALID: 'WORKFLOW_NODE_TYPE_INVALID',
  WORKFLOW_NODE_FIELD_MISSING: 'WORKFLOW_NODE_FIELD_MISSING',
  WORKFLOW_ROLE_UNKNOWN: 'WORKFLOW_ROLE_UNKNOWN',
  WORKFLOW_SUB_UNKNOWN: 'WORKFLOW_SUB_UNKNOWN',
  WORKFLOW_SUB_CYCLE: 'WORKFLOW_SUB_CYCLE',
  WORKFLOW_EDGE_INVALID: 'WORKFLOW_EDGE_INVALID',
  WORKFLOW_TIMEOUT_INVALID: 'WORKFLOW_TIMEOUT_INVALID',
  WORKFLOW_RETRY_INVALID: 'WORKFLOW_RETRY_INVALID',
  WORKFLOW_UNREACHABLE: 'WORKFLOW_UNREACHABLE',
  WORKFLOW_BACKFLOW_NO_LIMIT: 'WORKFLOW_BACKFLOW_NO_LIMIT',
  WORKFLOW_SCOPE_OVERLAP: 'WORKFLOW_SCOPE_OVERLAP',
  WORKFLOW_SCOPE_INVALID: 'WORKFLOW_SCOPE_INVALID',
  WORKFLOW_VAR_UNKNOWN: 'WORKFLOW_VAR_UNKNOWN',
  WORKFLOW_MAPPING_INCOMPLETE: 'WORKFLOW_MAPPING_INCOMPLETE',
  WORKFLOW_TRANSITION_ILLEGAL: 'WORKFLOW_TRANSITION_ILLEGAL',
  WORKFLOW_WAKE_DENIED: 'WORKFLOW_WAKE_DENIED'
});

/** Closed value domains for the numeric primitives (A-1). */
export const TIMEOUT_MIN = 1;
export const TIMEOUT_MAX = 86400;
export const RETRY_MIN = 0;
export const RETRY_MAX = 5;
export const MAX_ROUNDS_MIN = 1;
export const MAX_ROUNDS_MAX = 9;

export const WORKFLOW_REQUIRED_KEYS = Object.freeze([
  'schema',
  'id',
  'name',
  'entry',
  'terminal',
  'nodes'
]);

export const WORKFLOW_OPTIONAL_KEYS = Object.freeze(['summary', 'edges']);

export const WORKFLOW_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const WORKFLOW_ID_MIN = 2;
export const WORKFLOW_ID_MAX = 32;

/**
 * Per-type required field matrix (A-1: role -> role, human/escalate ->
 * title, subworkflow -> workflow).
 */
export const NODE_REQUIRED_FIELD = Object.freeze({
  role: 'role',
  human: 'title',
  escalate: 'title',
  subworkflow: 'workflow'
});

const NODE_STRING_KEYS = Object.freeze(['parallel_scope', 'scope']);
const NODE_STRING_ARRAY_KEYS = Object.freeze(['inputs', 'outputs']);

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function inRange(value, min, max) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function idInvalid(value) {
  if (typeof value !== 'string') return true;
  if (value.length < WORKFLOW_ID_MIN || value.length > WORKFLOW_ID_MAX) return true;
  return !WORKFLOW_ID_PATTERN.test(value);
}

/**
 * Shape and value-domain check for a single node (D-3 step 5 shape part).
 * @param {object} node parsed node mapping
 * @returns {Array<{code:string, field:string|null, params:object}>}
 */
export function checkNodeShape(node) {
  const out = [];
  const source = isPlainObject(node) ? node : {};
  const nodeId = has(source, 'id') && typeof source.id === 'string' ? source.id : null;
  const missing = (field) => {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_NODE_FIELD_MISSING,
      field,
      params: { node: nodeId, field }
    });
  };

  if (!has(source, 'id') || typeof source.id !== 'string') missing('id');
  if (!has(source, 'node_type')) {
    missing('node_type');
  } else if (!NODE_TYPES.includes(source.node_type)) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_NODE_TYPE_INVALID,
      field: 'node_type',
      params: { value: source.node_type }
    });
  } else {
    const required = NODE_REQUIRED_FIELD[source.node_type];
    if (!has(source, required) || typeof source[required] !== 'string') missing(required);
  }

  if (has(source, 'title') && typeof source.title !== 'string') missing('title');
  if (has(source, 'timeout') && !inRange(source.timeout, TIMEOUT_MIN, TIMEOUT_MAX)) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_TIMEOUT_INVALID,
      field: 'timeout',
      params: { value: source.timeout }
    });
  }
  if (has(source, 'retry') && !inRange(source.retry, RETRY_MIN, RETRY_MAX)) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_RETRY_INVALID,
      field: 'retry',
      params: { value: source.retry }
    });
  }
  if (has(source, 'max_rounds') && !inRange(source.max_rounds, MAX_ROUNDS_MIN, MAX_ROUNDS_MAX)) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_EDGE_INVALID,
      field: 'max_rounds',
      params: { detail: 'max_rounds', value: source.max_rounds }
    });
  }
  for (const key of NODE_STRING_KEYS) {
    if (has(source, key) && typeof source[key] !== 'string') missing(key);
  }
  for (const key of NODE_STRING_ARRAY_KEYS) {
    if (has(source, key) && !isStringArray(source[key])) missing(key);
  }

  return out;
}

/**
 * Shape and closed-set check for a single edge (D-3 step 7 shape part).
 * `map` only gets its `{from, to}` list shape here; reference resolution of
 * `map.from` / `map.to` belongs to the loader.
 * @param {object} edge parsed edge mapping
 * @returns {Array<{code:string, field:string|null, params:object}>}
 */
export function checkEdgeShape(edge) {
  const out = [];
  const source = isPlainObject(edge) ? edge : {};
  const invalid = (field, params) => {
    out.push({ code: WORKFLOW_REASONS.WORKFLOW_EDGE_INVALID, field, params });
  };

  for (const key of ['from', 'to']) {
    if (!has(source, key) || typeof source[key] !== 'string') {
      invalid(key, { detail: key });
    }
  }
  if (has(source, 'kind') && !EDGE_KINDS.includes(source.kind)) {
    invalid('kind', { detail: 'kind', value: source.kind });
  }
  if (has(source, 'when') && !WHEN_VALUES.includes(source.when)) {
    invalid('when', { detail: 'when', value: source.when });
  }
  if (has(source, 'join') && !JOIN_VALUES.includes(source.join)) {
    invalid('join', { detail: 'join', value: source.join });
  }
  if (has(source, 'max_rounds') && !inRange(source.max_rounds, MAX_ROUNDS_MIN, MAX_ROUNDS_MAX)) {
    invalid('max_rounds', { detail: 'max_rounds', value: source.max_rounds });
  }
  if (has(source, 'map')) {
    const items = source.map;
    const wellFormed =
      Array.isArray(items) &&
      items.every((item) => isPlainObject(item) && has(item, 'from') && has(item, 'to') &&
        typeof item.from === 'string' && typeof item.to === 'string');
    if (!wellFormed) invalid('map', { detail: 'map' });
  }

  return out;
}

/**
 * Shape check for one workflow document: top-level required/optional keys,
 * schema value, id charset plus optional file-name match, node id
 * uniqueness, then per-node and per-edge shape (D-3 steps 2..5 and 7).
 * @param {object} obj parsed workflow file
 * @param {{fileId?: string}} [context] file name without extension
 * @returns {Array<{code:string, field:string|null, params:object}>}
 */
export function checkWorkflowShape(obj, { fileId } = {}) {
  const out = [];
  const source = isPlainObject(obj) ? obj : {};

  for (const key of WORKFLOW_REQUIRED_KEYS) {
    if (!has(source, key)) {
      out.push({
        code: WORKFLOW_REASONS.WORKFLOW_SCHEMA_MISSING,
        field: key,
        params: { field: key }
      });
    }
  }
  if (has(source, 'schema') && source.schema !== WORKFLOW_SCHEMA_VERSION) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_SCHEMA_MISSING,
      field: 'schema',
      params: { field: 'schema' }
    });
  }
  for (const key of ['name', 'summary', 'entry', 'terminal']) {
    if (has(source, key) && typeof source[key] !== 'string') {
      out.push({
        code: WORKFLOW_REASONS.WORKFLOW_SCHEMA_MISSING,
        field: key,
        params: { field: key }
      });
    }
  }

  if (has(source, 'id') && (idInvalid(source.id) || (fileId !== undefined && source.id !== fileId))) {
    out.push({
      code: WORKFLOW_REASONS.WORKFLOW_ID_MISMATCH,
      field: 'id',
      params: { fileId: fileId ?? null, declaredId: source.id }
    });
  }

  if (has(source, 'nodes')) {
    if (!Array.isArray(source.nodes) || source.nodes.length === 0) {
      out.push({
        code: WORKFLOW_REASONS.WORKFLOW_SCHEMA_MISSING,
        field: 'nodes',
        params: { field: 'nodes' }
      });
    } else {
      const seen = new Set();
      const reported = new Set();
      for (const node of source.nodes) {
        const id = isPlainObject(node) && has(node, 'id') && typeof node.id === 'string' ? node.id : null;
        if (id === null) continue;
        if (seen.has(id)) {
          if (!reported.has(id)) {
            reported.add(id);
            out.push({
              code: WORKFLOW_REASONS.WORKFLOW_NODE_DUPLICATE,
              field: 'nodes',
              params: { id }
            });
          }
        } else {
          seen.add(id);
        }
      }
      for (const node of source.nodes) out.push(...checkNodeShape(node));
    }
  }

  if (has(source, 'edges')) {
    if (!Array.isArray(source.edges)) {
      out.push({
        code: WORKFLOW_REASONS.WORKFLOW_SCHEMA_MISSING,
        field: 'edges',
        params: { field: 'edges' }
      });
    } else {
      for (const edge of source.edges) out.push(...checkEdgeShape(edge));
    }
  }

  return out;
}
