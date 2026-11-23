/**
 * Studio domain shape kernel (v2 A2/A3/A4).
 *
 * Pure: no IO, no natural language. Departments, stage titles and artifact
 * names are label keys resolved by the CLI layer (`src/cli/labels.js`), so this
 * module stays free of user-visible copy.
 */

export const STUDIO_SCHEMA_VERSION = 1;
export const STUDIO_FILE = '.orch/studio.json';

/** Six departments from the baseline (index.md §1.3). Order is stable. */
export const DEPARTMENT_SEEDS = Object.freeze([
  'product',
  'engineering-management',
  'frontend',
  'backend',
  'qa',
  'platform-security'
]);

/** Semantic role codes a workflow may require. A role opts into one code. */
export const ROLE_CODES = Object.freeze([
  'product-lead',
  'product-analyst',
  'user-researcher',
  'competitor-analyst',
  'product-reviewer',
  'eng-lead',
  'architect',
  'tech-reviewer',
  'frontend-lead',
  'frontend-dev',
  'frontend-reviewer',
  'backend-lead',
  'backend-dev',
  'backend-reviewer',
  'qa-lead',
  'qa-functional',
  'qa-api',
  'qa-automation',
  'qa-performance',
  'qa-security',
  'devops',
  'security-reviewer',
  'data-architect',
  'dba'
]);

export const RUN_MODES = Object.freeze(['auto', 'semi', 'manual']);
export const GATE_KINDS = Object.freeze(['prd-freeze', 'arch-confirm', 'release-approve']);
export const TASK_STATUS = Object.freeze([
  'todo',
  'ready',
  'claimed',
  'running',
  'review',
  'fixing',
  'done',
  'blocked',
  'cancelled'
]);
/** Exceptional task transitions (baseline §5 / A6). */
export const TASK_EXCEPTIONS = Object.freeze([
  'clarify',
  'change-request',
  'conflict',
  'timeout',
  'agent-exit',
  'reassign'
]);

/** Capability dimension order is shared with A1's matrix (F-01). */
export const CAPABILITY_DIMENSIONS = Object.freeze([
  'acp',
  'transport',
  'resume_dialect',
  'max_concurrent_sessions',
  'evidence_hook'
]);

export const ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/** Normalize a display name into a stable id; returns null when unusable. */
export function slugify(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw.length === 0) return null;
  const ascii = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 32);
  return null;
}

/** Empty capability requirement: null means "not declared", not "false". */
export function emptyRequires() {
  return {
    acp: null,
    transport: null,
    resume_dialect: null,
    max_concurrent_sessions: null,
    evidence_hook: null
  };
}

export function normalizeRequires(raw) {
  const out = emptyRequires();
  if (!isPlainObject(raw)) return out;
  if (typeof raw.acp === 'boolean') out.acp = raw.acp;
  if (Array.isArray(raw.transport) && raw.transport.every((v) => typeof v === 'string')) {
    out.transport = raw.transport.slice();
  }
  if (typeof raw.resume_dialect === 'string') out.resume_dialect = raw.resume_dialect;
  if (Number.isInteger(raw.max_concurrent_sessions) && raw.max_concurrent_sessions > 0) {
    out.max_concurrent_sessions = raw.max_concurrent_sessions;
  }
  if (typeof raw.evidence_hook === 'boolean') out.evidence_hook = raw.evidence_hook;
  return out;
}

export function emptyStudio() {
  const now = new Date().toISOString();
  return {
    schemaVersion: STUDIO_SCHEMA_VERSION,
    updatedAt: now,
    departments: DEPARTMENT_SEEDS.map((id) => ({ id, labelKey: departmentLabelKey(id) })),
    roles: [],
    employees: [],
    sessions: [],
    teams: [],
    flows: [],
    tasks: [],
    defects: [],
    changes: [],
    runs: []
  };
}

export function departmentLabelKey(id) {
  return `DEPT_${String(id).replace(/-/g, '_').toUpperCase()}`;
}

export function stageLabelKey(index) {
  return `STAGE_S${String(index).padStart(2, '0')}`;
}

export function artifactLabelKey(id) {
  return `ARTIFACT_${String(id).replace(/-/g, '_').toUpperCase()}`;
}

/** Errors follow the project convention: `{ok:false, code, params}`. */
export function failure(code, params = {}) {
  return { ok: false, code, params };
}

export function fail(code, params) {
  return failure(code, params);
}

/** Collect duplicate ids in one array field. */
export function duplicateIds(list, key = 'id') {
  const seen = new Set();
  const dup = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = item?.[key];
    if (typeof id !== 'string') continue;
    if (seen.has(id)) dup.push(id);
    seen.add(id);
  }
  return dup;
}
