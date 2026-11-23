/**
 * D — multi-project registry.
 *
 * The per-project state lives under that project's `.orch/`; the only global
 * fact is "which project roots exist and which one was opened last". That list
 * lives in `~/.maestro/projects.json` so opening Maestro in a different folder
 * still shows the user's projects.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeJsonAtomic } from '../persistence/atomic-write.js';
import { fail, isPlainObject } from './schema.js';

export function projectsFile() {
  return path.join(os.homedir(), '.maestro', 'projects.json');
}

function emptyRegistry() {
  return { schemaVersion: 1, active: null, projects: [] };
}

export async function loadProjects() {
  const file = projectsFile();
  try {
    const text = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) return { ok: true, doc: emptyRegistry(), path: file };
    const doc = emptyRegistry();
    doc.active = typeof parsed.active === 'string' ? parsed.active : null;
    doc.projects = Array.isArray(parsed.projects)
      ? parsed.projects.filter((p) => isPlainObject(p) && typeof p.root === 'string')
      : [];
    return { ok: true, doc, path: file };
  } catch (err) {
    if (err?.code === 'ENOENT') return { ok: true, doc: emptyRegistry(), path: file };
    return { ok: false, code: 'PROJECTS_INVALID', params: { path: file, cause: err?.message ?? String(err) } };
  }
}

async function saveProjects(doc) {
  const file = projectsFile();
  const written = await writeJsonAtomic(file, doc);
  if (!written.ok) return written;
  return { ok: true, path: file };
}

function projectIdFromRoot(root) {
  const base = path.basename(root).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base.length >= 2 ? base : `project-${Buffer.from(root).toString('hex').slice(0, 8)}`;
}

export async function addProject({ root, name = null }) {
  if (typeof root !== 'string' || root.length === 0) return fail('PROJECT_ROOT_REQUIRED');
  const abs = path.resolve(root);
  try {
    const stat = await fs.stat(abs);
    if (!stat.isDirectory()) return fail('PROJECT_ROOT_NOT_DIRECTORY', { root: abs });
  } catch {
    return fail('PROJECT_ROOT_MISSING', { root: abs });
  }
  const loaded = await loadProjects();
  if (!loaded.ok) return loaded;
  const doc = loaded.doc;
  let entry = doc.projects.find((p) => p.root === abs);
  if (!entry) {
    entry = {
      id: projectIdFromRoot(abs),
      name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : path.basename(abs),
      root: abs,
      addedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString()
    };
    doc.projects.push(entry);
  } else {
    entry.lastOpenedAt = new Date().toISOString();
    if (typeof name === 'string' && name.trim().length > 0) entry.name = name.trim();
  }
  doc.active = entry.root;
  const saved = await saveProjects(doc);
  if (!saved.ok) return saved;
  return { ok: true, project: entry, path: saved.path };
}

export async function listProjects() {
  const loaded = await loadProjects();
  if (!loaded.ok) return loaded;
  return { ok: true, projects: loaded.doc.projects, active: loaded.doc.active, path: loaded.path };
}

export async function useProject(root) {
  const abs = path.resolve(root);
  const loaded = await loadProjects();
  if (!loaded.ok) return loaded;
  const entry = loaded.doc.projects.find((p) => p.root === abs);
  if (!entry) return fail('PROJECT_UNKNOWN', { root: abs });
  entry.lastOpenedAt = new Date().toISOString();
  loaded.doc.active = entry.root;
  const saved = await saveProjects(loaded.doc);
  if (!saved.ok) return saved;
  return { ok: true, project: entry };
}

export async function removeProject(ref) {
  const loaded = await loadProjects();
  if (!loaded.ok) return loaded;
  const before = loaded.doc.projects.length;
  const target = loaded.doc.projects.find((p) => p.id === ref || p.root === path.resolve(ref));
  if (!target) return fail('PROJECT_UNKNOWN', { project: String(ref) });
  loaded.doc.projects = loaded.doc.projects.filter((p) => p !== target);
  if (loaded.doc.active === target.root) loaded.doc.active = loaded.doc.projects[0]?.root ?? null;
  const saved = await saveProjects(loaded.doc);
  if (!saved.ok) return saved;
  return { ok: true, removed: target, remaining: before - 1 };
}

/**
 * D1/D2 — host matrix: which CLIs can carry which role, and how many a team
 * spans. Capability-driven: no per-CLI special casing.
 */
export function hostMatrix(clis, teams = [], roles = []) {
  const rows = (Array.isArray(clis) ? clis : []).map((cli) => ({
    cli_id: cli.cli_id,
    name: cli.name,
    executable: cli.executable ?? null,
    connection_status: cli.connection_status,
    acp: cli.acp ?? null,
    max_concurrent_sessions: cli.max_concurrent_sessions ?? null
  }));
  const ready = rows.filter((row) => row.executable && row.connection_status !== 'unreachable');
  const perTeam = (Array.isArray(teams) ? teams : []).map((team) => {
    const used = new Set();
    for (const roleId of team.roleIds ?? []) {
      const role = roles.find((r) => r.id === roleId);
      const code = role?.code ?? null;
      if (code) used.add(code);
    }
    return { teamId: team.id, name: team.name, roleCodes: [...used] };
  });
  return { rows, readyCount: ready.length, teams: perTeam };
}
