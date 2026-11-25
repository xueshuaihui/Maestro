/**
 * Studio store: one atomic JSON document at `.orch/studio.json`.
 *
 * Single file (not a directory tree) because every operation here mutates a
 * small, cross-referenced graph (role -> employee -> team -> flow -> run);
 * splitting it would make multi-file consistency the product's problem. The
 * document is versioned (`schemaVersion`) and unknown fields survive a
 * load/save round-trip via the shape merge below.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from '../persistence/atomic-write.js';
import {
  STUDIO_FILE,
  STUDIO_SCHEMA_VERSION,
  emptyStudio,
  isPlainObject,
  departmentLabelKey
} from './schema.js';

export function studioPath(root) {
  return path.join(root, STUDIO_FILE);
}

function normalizeDoc(raw) {
  const doc = emptyStudio();
  if (!isPlainObject(raw)) return doc;
  for (const key of ['roles', 'employees', 'sessions', 'teams', 'flows', 'tasks', 'defects', 'changes', 'runs']) {
    if (Array.isArray(raw[key])) doc[key] = raw[key];
  }
  if (Array.isArray(raw.departments) && raw.departments.length > 0) {
    doc.departments = raw.departments
      .filter((d) => isPlainObject(d) && typeof d.id === 'string')
      .map((d) => {
        const row = { id: d.id, labelKey: d.labelKey ?? departmentLabelKey(d.id) };
        // Custom departments carry a literal name; archived ones carry the
        // marker. Dropping either here made user maintenance impossible.
        if (typeof d.name === 'string') row.name = d.name;
        if (d.archived === true) row.archived = true;
        if (typeof d.archivedAt === 'string') row.archivedAt = d.archivedAt;
        return row;
      });
  }
  if (typeof raw.updatedAt === 'string') doc.updatedAt = raw.updatedAt;
  doc.schemaVersion = STUDIO_SCHEMA_VERSION;
  return doc;
}

/**
 * @returns {Promise<{ok:true, doc:object, path:string, existed:boolean}
 *   | {ok:false, code:'STUDIO_INVALID', params:{path:string, cause:string}}>}
 */
export async function loadStudio(root) {
  const file = studioPath(root);
  let text = null;
  try {
    text = await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return { ok: true, doc: emptyStudio(), path: file, existed: false };
    }
    return { ok: false, code: 'STUDIO_INVALID', params: { path: file, cause: err?.message ?? String(err) } };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, code: 'STUDIO_INVALID', params: { path: file, cause: err?.message ?? 'JSON 解析失败' } };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, code: 'STUDIO_INVALID', params: { path: file, cause: '顶层不是对象' } };
  }
  return { ok: true, doc: normalizeDoc(parsed), path: file, existed: true };
}

/** Persist the document; `updatedAt` is bumped here (single write path). */
export async function saveStudio(root, doc) {
  const file = studioPath(root);
  const next = { ...doc, schemaVersion: STUDIO_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
  const written = await writeJsonAtomic(file, next);
  if (!written.ok) return written;
  doc.updatedAt = next.updatedAt;
  return { ok: true, path: file, bytes: written.bytes };
}

/**
 * Read-modify-write with one save. `mutator` must be synchronous so two
 * concurrent commands cannot interleave inside it.
 */
export async function updateStudio(root, mutator) {
  const loaded = await loadStudio(root);
  if (!loaded.ok) return loaded;
  const result = mutator(loaded.doc);
  if (result && result.ok === false) return result;
  const saved = await saveStudio(root, loaded.doc);
  if (!saved.ok) return saved;
  return { ok: true, doc: loaded.doc, value: result?.value ?? null, path: saved.path };
}

export function findById(list, id) {
  return (Array.isArray(list) ? list : []).find((item) => item.id === id) ?? null;
}

export function indexBy(list, key) {
  const map = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    if (typeof item?.[key] === 'string') map.set(item[key], item);
  }
  return map;
}
