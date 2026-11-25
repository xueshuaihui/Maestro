/**
 * Unified resource facade for the studio domains.
 *
 * All mutations go through `updateStudio` (one atomic read-modify-write) so the
 * existing store invariants stay intact. Built-in assets are never written:
 * `fork` copies them into the project first, then the copy becomes writable.
 *
 * Error shape follows the project convention: `{ok:false, code, params}`.
 * No natural-language copy lives in this module (CJK-free by discipline).
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadStudio, updateStudio, findById } from '../studio/store.js';
import {
  addRole,
  updateRole,
  removeRole,
  addEmployee,
  updateEmployee,
  removeEmployee
} from '../studio/org.js';
import { createTeam, updateTeam, removeTeam } from '../studio/team.js';
import {
  createFlow,
  updateFlow,
  removeFlow
} from '../studio/flow.js';
import { loadRegistry } from '../registry/index.js';
import { ROLE_SCHEMA_VERSION } from '../registry/role-schema.js';
import {
  serializeRole,
  serializeSkill,
  atomicWrite
} from '../registry/asset-write.js';
import { parseSkillFile } from '../registry/skill-file.js';
import { parseYaml } from '../registry/yaml-lite.js';
import { projectRolesDir, projectSkillsDir } from '../registry/assets.js';
import {
  isType,
  isStudioType,
  studioField,
  projectMeta,
  compareResources,
  deriveId,
  META_KEYS
} from './types.js';
import { collectRefs, detachRefs } from './refs.js';

function failure(code, params = {}) {
  return { ok: false, code, params };
}

function asRoot(value) {
  return typeof value === 'string' && value.length > 0 ? path.resolve(value) : process.cwd();
}

function isWritable(target) {
  return target?.source !== 'builtin';
}

function normalizeInput(input) {
  return input !== null && typeof input === 'object' ? input : {};
}

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

export async function listResources(root, options = {}) {
  const base = asRoot(root);
  const types = Array.isArray(options.types) && options.types.length > 0
    ? options.types.filter(isType)
    : null;
  const includeArchived = options.includeArchived === true;
  const sourceFilter = typeof options.source === 'string' ? options.source : null;

  const loaded = await loadStudio(base);
  if (!loaded.ok) return loaded;
  const items = [];

  // Studio-backed types: departments / roles / employees / teams / flows / runs.
  for (const type of types ?? ['department', 'role', 'employee', 'team', 'flow', 'run']) {
    if (!isStudioType(type)) continue;
    const field = studioField(type);
    for (const raw of loaded.doc[field] ?? []) {
      const item = projectMeta(type, raw, { source: 'project' });
      if (item !== null) items.push(item);
    }
  }

  // Built-in asset mirror (roles / skills): read-only, fork to make writable.
  if (types === null || types.includes('role') || types.includes('skill')) {
    const registry = loadRegistry({ root: base });
    {
      for (const def of registry.roles ?? []) {
        if (types !== null && !types.includes('role')) continue;
        const row = projectMeta('role', {
          id: def.id,
          name: def.name,
          summary: def.summary,
          group: def.group,
          source: def.source
        }, { source: def.source, origin: def.derived_from ?? null });
        // A project asset role is NOT the same thing as a studio role even if
        // their ids collide. Mark it so fork/clone see every taken id.
        if (def.source === 'project') row.store = 'asset';
        items.push(row);
      }
      for (const def of registry.skills ?? []) {
        if (types !== null && !types.includes('skill')) continue;
        const row = projectMeta('skill', {
          id: def.id,
          name: def.name,
          summary: def.summary,
          applies_to: def.applies_to,
          source: def.source
        }, { source: def.source });
        if (def.source === 'project') row.store = 'asset';
        items.push(row);
      }
    }
  }

  // Instances (read-only projection of the engine store).
  if (types === null || types.includes('instance')) {
    try {
      const dir = path.join(base, '.orch', 'instances');
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        let state = null;
        try {
          state = JSON.parse(await fs.promises.readFile(path.join(dir, entry.name, 'state.json'), 'utf8'));
        } catch {
          continue;
        }
        items.push(projectMeta('instance', {
          id: entry.name,
          name: String(state.title ?? state.task ?? entry.name).slice(0, 120),
          state: state.state ?? null,
          phase: state.phase ?? null,
          paused: state.paused === true,
          createdAt: state.createdAt ?? null,
          updatedAt: state.updatedAt ?? null
        }, { source: 'project' }));
      }
    } catch {
      // No instances directory yet: an empty project is valid.
    }
  }

  const filtered = items.filter((item) => {
    if (!includeArchived && item.archived === true) return false;
    if (sourceFilter !== null && item.source !== sourceFilter) return false;
    return true;
  });
  filtered.sort(compareResources);
  const counts = {};
  for (const item of filtered) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return { ok: true, items: filtered, counts, total: filtered.length };
}

export async function getResource(root, type, id) {
  if (!isType(type)) return failure('RESOURCE_TYPE_UNKNOWN', { type: String(type) });
  const listed = await listResources(root, { types: [type], includeArchived: true });
  if (!listed.ok) return listed;
  const item = listed.items.find((row) => row.id === id);
  if (!item) return failure('RESOURCE_NOT_FOUND', { type, id: String(id) });
  return { ok: true, item };
}

// ---------------------------------------------------------------------------
// mutate studio-backed resources
// ---------------------------------------------------------------------------

function studioMutation(type, input, id) {
  switch (type) {
    case 'department':
      return (doc) => {
        const raw = normalizeInput(input);
        const deptId = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : id;
        if (doc.departments.some((d) => d.id === deptId)) return failure('RESOURCE_EXISTS', { id: deptId });
        doc.departments.push({ id: deptId, labelKey: raw.labelKey ?? null, name: raw.name ?? deptId, createdAt: new Date().toISOString() });
        return { ok: true, value: { id: deptId } };
      };
    case 'role':
      return (doc) => {
        const result = addRole(doc, input);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'employee':
      return (doc) => {
        const result = addEmployee(doc, input);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'team':
      return (doc) => {
        const result = createTeam(doc, input);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'flow':
      return (doc) => {
        const result = createFlow(doc, input);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'run':
      return () => failure('RESOURCE_CREATE_UNSUPPORTED', { type });
    default:
      return () => failure('RESOURCE_TYPE_UNSUPPORTED', { type });
  }
}

export async function createResource(root, type, input = {}) {
  if (!isType(type)) return failure('RESOURCE_TYPE_UNKNOWN', { type: String(type) });
  const raw = normalizeInput(input);
  if (!isStudioType(type)) return failure('RESOURCE_CREATE_UNSUPPORTED', { type });
  const saved = await updateStudio(asRoot(root), studioMutation(type, raw, raw.id));
  if (!saved.ok) return saved;
  return { ok: true, item: projectMeta(type, saved.value?.role ?? saved.value?.employee ?? saved.value?.team ?? saved.value?.flow ?? { id: saved.value?.id }, { source: 'project' }) };
}

function studioUpdate(type, id, patch) {
  switch (type) {
    case 'department':
      return (doc) => {
        const dept = findById(doc.departments, id);
        if (!dept) return failure('RESOURCE_NOT_FOUND', { type, id });
        for (const key of ['name', 'labelKey']) {
          if (typeof patch[key] === 'string') dept[key] = patch[key];
        }
        dept.updatedAt = new Date().toISOString();
        return { ok: true, value: { id } };
      };
    case 'role':
      return (doc) => {
        const result = updateRole(doc, id, patch);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'employee':
      return (doc) => {
        const result = updateEmployee(doc, id, patch);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'team':
      return (doc) => {
        const result = updateTeam(doc, id, patch);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'flow':
      return (doc) => {
        const result = updateFlow(doc, id, patch);
        return result.ok ? { ok: true, value: result } : result;
      };
    case 'run':
      return () => failure('RESOURCE_UPDATE_UNSUPPORTED', { type });
    default:
      return () => failure('RESOURCE_TYPE_UNSUPPORTED', { type });
  }
}

export async function updateResource(root, type, id, patch = {}) {
  if (!isType(type)) return failure('RESOURCE_TYPE_UNKNOWN', { type: String(type) });
  const current = await getResource(root, type, id);
  if (!current.ok) return current;
  if (!isWritable(current.item)) return failure('RESOURCE_READONLY', { type, id, source: current.item.source });
  const values = normalizeInput(patch);
  delete values.archived;
  if (isStudioType(type)) {
    const saved = await updateStudio(asRoot(root), studioUpdate(type, id, values));
    if (!saved.ok) return saved;
    const value = saved.value?.role ?? saved.value?.employee ?? saved.value?.team ?? saved.value?.flow ?? { id: saved.value?.id };
    return { ok: true, item: projectMeta(type, { ...current.item, ...value }, { source: 'project' }) };
  }
  return updateAsset(root, type, id, values);
}

// ---------------------------------------------------------------------------
// archive / restore / remove
// ---------------------------------------------------------------------------

export async function archiveResource(root, type, id) {
  const current = await getResource(root, type, id);
  if (!current.ok) return current;
  if (!isWritable(current.item)) return failure('RESOURCE_READONLY', { type, id });
  const saved = await updateStudio(asRoot(root), (doc) => {
    const field = studioField(type);
    const row = field ? findById(doc[field], id) : null;
    if (!row) return failure('RESOURCE_NOT_FOUND', { type, id });
    row.archived = true;
    row.archivedAt = new Date().toISOString();
    return { ok: true, value: { id } };
  });
  if (!saved.ok) return saved;
  return { ok: true, item: { ...current.item, archived: true } };
}

export async function restoreResource(root, type, id) {
  const saved = await updateStudio(asRoot(root), (doc) => {
    const field = studioField(type);
    const row = field ? findById(doc[field], id) : null;
    if (!row) return failure('RESOURCE_NOT_FOUND', { type, id });
    row.archived = false;
    delete row.archivedAt;
    return { ok: true, value: { id } };
  });
  if (!saved.ok) return saved;
  const current = await getResource(root, type, id);
  return current.ok ? { ok: true, item: { ...current.item, archived: false } } : current;
}

export async function removeResource(root, type, id, options = {}) {
  if (!isType(type)) return failure('RESOURCE_TYPE_UNKNOWN', { type: String(type) });
  const current = await getResource(root, type, id);
  if (!current.ok) return current;
  if (!isWritable(current.item)) return failure('RESOURCE_READONLY', { type, id });
  const refs = await collectRefs(root, type, id);
  if (refs.ok && refs.incoming.length > 0 && options.force !== true) {
    return failure('RESOURCE_IN_USE', { type, id, refs: refs.incoming });
  }
  if (options.archive !== false) return archiveResource(root, type, id);

  if (isStudioType(type)) {
    const saved = await updateStudio(asRoot(root), (doc) => {
      const field = studioField(type);
      if (!field) return failure('RESOURCE_DELETE_UNSUPPORTED', { type });
      const before = doc[field].length;
      doc[field] = doc[field].filter((row) => row.id !== id);
      if (doc[field].length === before) return failure('RESOURCE_NOT_FOUND', { type, id });
      return { ok: true, value: { id } };
    });
    if (!saved.ok) return saved;
    await detachRefs(root, type, id);
    return { ok: true, id, type };
  }
  return removeAsset(root, type, id);
}

export async function cloneResource(root, type, id, input = {}) {
  const current = await getResource(root, type, id);
  if (!current.ok) return current;
  const raw = normalizeInput(input);
  const taken = await listResources(root, { types: [type], includeArchived: true });
  const newId = deriveId(raw.id ?? id, taken.ok ? taken.items.map((row) => row.id) : []);
  if (newId === null) return failure('RESOURCE_ID_EXHAUSTED', { type, id });
  const source = await rawObject(root, type, id);
  if (!source.ok) return source;
  const payload = { ...source.item, id: newId, name: `${current.item.name} copy` };
  for (const key of META_KEYS) {
    if (key !== 'id' && key !== 'name') delete payload[key];
  }
  const created = await createResource(root, type, payload);
  if (!created.ok) return created;
  return { ok: true, item: created.item, sourceId: id };
}

// ---------------------------------------------------------------------------
// built-in -> project fork (roles and skills)
// ---------------------------------------------------------------------------

export async function forkResource(root, type, builtinId, input = {}) {
  if (!['role', 'skill'].includes(type)) return failure('RESOURCE_FORK_UNSUPPORTED', { type });
  const current = await getResource(root, type, builtinId);
  if (!current.ok) return current;
  if (current.item.source !== 'builtin') return failure('RESOURCE_NOT_BUILTIN', { type, id: builtinId });
  const raw = normalizeInput(input);
  const base = asRoot(root);
  const taken = await listResources(base, { types: [type], includeArchived: true });
  const newId = deriveId(raw.id ?? builtinId, taken.ok ? taken.items.map((row) => row.id) : []);
  if (newId === null) return failure('RESOURCE_ID_EXHAUSTED', { type, id: builtinId });

  if (type === 'role') {
    const registry = loadRegistry({ root: base });
    const def = registry.roleMap.get(builtinId);
    if (!def) return failure('RESOURCE_NOT_FOUND', { type, id: builtinId });
    const cloned = { schema: ROLE_SCHEMA_VERSION, ...def, id: newId, name: raw.name ?? `${def.name} copy`, derived_from: builtinId };
    delete cloned.source;
    delete cloned.file;
    const target = path.join(projectRolesDir(base), `${newId}.yaml`);
    if (fs.existsSync(target)) return failure('RESOURCE_EXISTS', { id: newId });
    const written = await atomicWrite({ target, text: serializeRole(cloned) });
    if (!written.ok) return written;
    return { ok: true, item: projectMeta('role', cloned, { source: 'project', origin: builtinId }) };
  }

  const skillsDir = path.join(base, 'assets', 'skills', builtinId);
  const file = path.join(skillsDir, 'SKILL.md');
  let text = '';
  try {
    text = await fs.promises.readFile(file, 'utf8');
  } catch {
    return failure('RESOURCE_NOT_FOUND', { type, id: builtinId });
  }
  const parsed = parseSkillFile(text);
  if (!parsed.ok) return failure('RESOURCE_INVALID', { type, id: builtinId });
  const meta = { ...parsed.meta, id: newId, name: raw.name ?? `${parsed.meta.name} copy`, derived_from: builtinId };
  delete meta.source;
  const target = path.join(projectSkillsDir(base), newId, 'SKILL.md');
  if (fs.existsSync(target)) return failure('RESOURCE_EXISTS', { id: newId });
  const written = await atomicWrite({ target, text: serializeSkill(meta, parsed.body) });
  if (!written.ok) return written;
  return { ok: true, item: projectMeta('skill', meta, { source: 'project', origin: builtinId }) };
}

// ---------------------------------------------------------------------------
// asset write helpers (project roles / skills) - used by updateResource/removeAsset
// ---------------------------------------------------------------------------

async function rawObject(root, type, id) {
  if (isStudioType(type)) {
    const listed = await loadStudio(asRoot(root));
    if (!listed.ok) return listed;
    const field = studioField(type);
    const row = field ? findById(listed.doc[field], id) : null;
    if (!row) return failure('RESOURCE_NOT_FOUND', { type, id });
    return { ok: true, item: row };
  }
  return getResource(root, type, id);
}

async function updateAsset(_root, _type, _id, _patch) {
  // Project role/skill edits are served by the CLI `role edit` / `skill create`
  // facade; the HTTP route delegates there. Kept explicit so the facade never
  // silently pretends a built-in asset became writable.
  return failure('RESOURCE_UPDATE_UNSUPPORTED', { type: _type, hint: 'use asset command' });
}

async function removeAsset(root, type, id) {
  const base = asRoot(root);
  const file = type === 'role'
    ? path.join(projectRolesDir(base), `${id}.yaml`)
    : path.join(projectSkillsDir(base), id, 'SKILL.md');
  try {
    await fs.promises.unlink(file);
  } catch (err) {
    if (err?.code === 'ENOENT') return failure('RESOURCE_NOT_FOUND', { type, id });
    return failure('RESOURCE_DELETE_FAILED', { type, id, cause: err?.message ?? String(err) });
  }
  return { ok: true, id, type };
}

// ---------------------------------------------------------------------------
// export / import
// ---------------------------------------------------------------------------

export async function exportResource(root, type, id) {
  const source = await rawObject(root, type, id);
  if (!source.ok) return source;
  const current = await getResource(root, type, id);
  if (!current.ok) return current;
  return {
    ok: true,
    payload: {
      format: 'maestro-resource/v1',
      type,
      id,
      meta: {
        id: current.item.id,
        name: current.item.name,
        source: current.item.source,
        origin: current.item.origin
      },
      body: source.item
    }
  };
}

export async function importResource(root, payload = {}) {
  if (payload?.format !== 'maestro-resource/v1') return failure('RESOURCE_FORMAT_UNKNOWN', { format: payload?.format });
  const type = payload.type;
  if (!isType(type)) return failure('RESOURCE_TYPE_UNKNOWN', { type: String(type) });
  if (!isStudioType(type)) return failure('RESOURCE_IMPORT_UNSUPPORTED', { type });
  const body = normalizeInput(payload.body);
  const created = await createResource(root, type, body);
  if (!created.ok) return created;
  return { ok: true, item: created.item, importedFrom: payload.meta?.id ?? null };
}
