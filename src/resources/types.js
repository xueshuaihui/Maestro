/**
 * Unified resource platform: type registry and meta projection.
 *
 * The platform does NOT introduce a new database. It projects the three
 * existing domains (built-in assets / `.orch/studio.json` / instances) into
 * one stable shape so the desktop can offer real CRUD + archive + reuse.
 *
 * Pure: no IO, no natural-language copy (CJK-free by discipline).
 */

export const RESOURCE_TYPES = Object.freeze([
  'department',
  'role',
  'skill',
  'employee',
  'team',
  'flow',
  'instance',
  'run'
]);

export const STUDIO_TYPES = Object.freeze(['department', 'role', 'employee', 'team', 'flow', 'run']);
export const ASSET_TYPES = Object.freeze(['role', 'skill']);
export const READONLY_SOURCES = Object.freeze(['builtin']);

/** Fields every projected resource carries, in this order (frozen shape). */
export const META_KEYS = Object.freeze([
  'id',
  'type',
  'name',
  'source',
  'origin',
  'archived',
  'createdAt',
  'updatedAt'
]);

export function isType(value) {
  return RESOURCE_TYPES.includes(value);
}

export function isStudioType(type) {
  return STUDIO_TYPES.includes(type);
}

export function studioField(type) {
  if (type === 'department') return 'departments';
  if (type === 'role') return 'roles';
  if (type === 'employee') return 'employees';
  if (type === 'team') return 'teams';
  if (type === 'flow') return 'flows';
  if (type === 'run') return 'runs';
  return null;
}

/**
 * Project one raw resource into the unified meta shape.
 * Extra domain fields are kept after the meta keys so nothing is lost.
 */
export function projectMeta(type, raw = {}, options = {}) {
  if (!isType(type) || raw === null || typeof raw !== 'object') return null;
  const source = options.source === 'builtin' ? 'builtin' : 'project';
  const origin = typeof options.origin === 'string' && options.origin.length > 0 ? options.origin : null;
  const id = typeof raw.id === 'string' ? raw.id : '';
  const name = typeof raw.name === 'string' && raw.name.length > 0
    ? raw.name
    : (typeof raw.title === 'string' ? raw.title : id);
  const meta = {
    id,
    type,
    name,
    source,
    origin,
    archived: raw.archived === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null
  };
  const rest = {};
  for (const key of Object.keys(raw)) {
    if (!(key in meta)) rest[key] = raw[key];
  }
  return { ...meta, ...rest };
}

/** Sort comparator: unarchived first, then type, then id. */
export function compareResources(a, b) {
  if (a?.archived !== b?.archived) return a?.archived === true ? 1 : -1;
  const at = String(a?.type ?? '');
  const bt = String(b?.type ?? '');
  if (at !== bt) return at < bt ? -1 : 1;
  const ai = String(a?.id ?? '');
  const bi = String(b?.id ?? '');
  return ai < bi ? -1 : ai > bi ? 1 : 0;
}

/** New id for a clone/fork: `<base>-copy-N`, never colliding with `taken`. */
export function deriveId(base, taken = []) {
  const clean = String(base ?? '').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const root = clean.length > 0 ? clean : 'resource';
  const used = new Set(Array.isArray(taken) ? taken.filter((v) => typeof v === 'string') : []);
  if (!used.has(root)) return root;
  for (let n = 2; n < 10000; n += 1) {
    const candidate = `${root}-copy-${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return null;
}
