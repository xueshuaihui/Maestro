/**
 * Instance maintenance: archive / clone / rename / export / save-as-template.
 *
 * Instances are engine artifacts, not studio resources, so they are maintained
 * at the filesystem level under `.orch/instances/**` without touching the
 * orchestrator's state machine. Active runs are refused archive/clone to avoid
 * racing a CAS write.
 */

import fs from 'node:fs';
import path from 'node:path';

import { instanceDir, instancesDir, statePath } from '../persistence/paths.js';

function failure(code, params = {}) {
  return { ok: false, code, params };
}
function safeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id) ? id : null;
}
async function readState(root, id) {
  try {
    return JSON.parse(await fs.promises.readFile(statePath(root, id), 'utf8'));
  } catch {
    return null;
  }
}
function isActive(state) {
  const value = String(state?.state ?? '').toLowerCase();
  return ['running', 'created', 'ready'].includes(value) && state?.paused !== true;
}
async function copyDir(src, dst) {
  await fs.promises.mkdir(dst, { recursive: true });
  for (const entry of await fs.promises.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else await fs.promises.copyFile(from, to);
  }
}

export async function archiveInstance(root, idRaw) {
  const id = safeId(idRaw);
  if (id === null) return failure('INSTANCE_ID_INVALID', { id: String(idRaw) });
  const state = await readState(root, id);
  if (state === null) return failure('INSTANCE_NOT_FOUND', { id });
  if (isActive(state)) return failure('INSTANCE_ACTIVE', { id, state: state.state });
  const archiveRoot = path.join(instancesDir(root), '.archive');
  await fs.promises.mkdir(archiveRoot, { recursive: true });
  const target = path.join(archiveRoot, `${id}-${Date.now()}`);
  await fs.promises.rename(instanceDir(root, id), target);
  return { ok: true, id, archivedTo: path.relative(root, target) };
}

export async function cloneInstance(root, idRaw, input = {}) {
  const id = safeId(idRaw);
  if (id === null) return failure('INSTANCE_ID_INVALID', { id: String(idRaw) });
  const state = await readState(root, id);
  if (state === null) return failure('INSTANCE_NOT_FOUND', { id });
  const base = typeof input.id === 'string' && safeId(input.id)
    ? input.id
    : `${id}-copy-${Date.now().toString(36)}`;
  const target = instanceDir(root, base);
  if (fs.existsSync(target)) return failure('INSTANCE_EXISTS', { id: base });
  await copyDir(instanceDir(root, id), target);
  const cloned = { ...state, instanceId: base, state: 'created', paused: false, clonedFrom: id };
  delete cloned.nodes;
  delete cloned.counters;
  await fs.promises.writeFile(statePath(root, base), JSON.stringify(cloned, null, 2), 'utf8');
  return { ok: true, id: base, sourceId: id };
}

export async function renameInstance(root, idRaw, name) {
  const id = safeId(idRaw);
  if (id === null) return failure('INSTANCE_ID_INVALID', { id: String(idRaw) });
  if (typeof name !== 'string' || name.trim().length === 0) return failure('INSTANCE_NAME_REQUIRED', {});
  const state = await readState(root, id);
  if (state === null) return failure('INSTANCE_NOT_FOUND', { id });
  const next = { ...state, title: name.trim().slice(0, 120), updatedAt: new Date().toISOString() };
  await fs.promises.writeFile(statePath(root, id), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, id, name: next.title };
}

export async function exportInstance(root, idRaw) {
  const id = safeId(idRaw);
  if (id === null) return failure('INSTANCE_ID_INVALID', { id: String(idRaw) });
  const dir = instanceDir(root, id);
  if (!fs.existsSync(dir)) return failure('INSTANCE_NOT_FOUND', { id });
  const state = (await readState(root, id)) ?? {};
  const readLines = async (file) => {
    try {
      const text = await fs.promises.readFile(file, 'utf8');
      return text.split('\n').filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  };
  const events = await readLines(path.join(dir, 'events.jsonl'));
  const spans = await readLines(path.join(dir, 'state', 'traces.jsonl'));
  return {
    ok: true,
    payload: {
      format: 'maestro-instance-export/v1',
      instanceId: id,
      exportedAt: new Date().toISOString(),
      summary: { state: state.state ?? null, template: state.template ?? null, nodeCount: (state.nodes ?? []).length },
      events,
      spans
    }
  };
}

/** Persist an instance's execution shape as a reusable workflow asset. */
export async function saveInstanceAsTemplate(root, idRaw, input = {}) {
  const id = safeId(idRaw);
  if (id === null) return failure('INSTANCE_ID_INVALID', { id: String(idRaw) });
  const state = await readState(root, id);
  if (state === null) return failure('INSTANCE_NOT_FOUND', { id });
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  if (nodes.length === 0) return failure('INSTANCE_NO_NODES', { id });
  const newId = safeId(input.id) ?? `from-${id}-${Date.now().toString(36)}`;
  const target = path.join(root, '.orch', 'workflows', `${newId}.yaml`);
  if (fs.existsSync(target)) return failure('WORKFLOW_EXISTS', { id: newId });

  const roleIds = [...new Set(nodes.map((node) => node.roleId ?? node.role).filter(Boolean))];
  const workflowNodes = nodes.map((node, index) => ({
    id: String(node.id ?? node.nodeId ?? `n${index + 1}`),
    node_type: 'role',
    // Role id comes from the node itself; never invent a role name here
    // (src/daemon must stay free of role/graph literals, AC-28).
    role: String(node.roleId ?? node.id ?? `n${index + 1}`),
    title: String(node.title ?? node.id ?? `Node ${index + 1}`)
  }));
  const ids = workflowNodes.map((node) => node.id);
  const edges = [];
  for (let i = 0; i < ids.length - 1; i += 1) {
    edges.push({ from: ids[i], to: ids[i + 1], kind: 'forward', when: 'always', join: 'all' });
  }
  const text = [
    'schema: workflow/v1',
    `id: ${newId}`,
    `name: ${typeof input.name === 'string' && input.name.trim() ? input.name.trim() : `From ${id}`}`,
    `entry: ${ids[0]}`,
    `terminal: ${ids[ids.length - 1]}`,
    'nodes:',
    ...workflowNodes.map((n) => `  - id: ${n.id}\n    node_type: role\n    role: ${n.role}\n    title: ${JSON.stringify(n.title)}`),
    'edges:',
    ...edges.map((e) => `  - from: ${e.from}\n    to: ${e.to}\n    kind: forward\n    when: always\n    join: all`)
  ].join('\n') + '\n';
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, text, 'utf8');
  return { ok: true, id: newId, path: path.relative(root, target), roles: roleIds };
}
