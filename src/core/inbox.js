/**
 * Durable inbox files (iteration-4 D-4 / C-08).
 *
 * File IO only: write atomically first, then report deliverable. Retry timers,
 * attempt counters and status fields are owned by the caller; this module
 * never invents, auto-increments or schedules them.
 *
 * Dependency direction: persistence/paths.js + persistence/atomic-write.js.
 */
import fsPromises from 'node:fs/promises';

import { instanceInboxDir, inboxFilePath } from '../persistence/paths.js';
import { writeJsonAtomic } from '../persistence/atomic-write.js';

/** Fixed 10-key shape (D-4.1); never add or drop a key. */
const MESSAGE_KEYS = [
  'handoffId',
  'instanceId',
  'fromNodeId',
  'toNodeId',
  'sessionId',
  'promptText',
  'createdAt',
  'deliveryAttempts',
  'deliveredAt',
  'lastError'
];

/** Default IO reuses the real atomic-write kernel; `fs` can replace it in tests. */
const defaultIo = Object.freeze({
  writeJsonAtomic: (filePath, value) => writeJsonAtomic(filePath, value),
  readFile: (p, enc) => fsPromises.readFile(p, enc),
  readdir: (p) => fsPromises.readdir(p),
  unlink: (p) => fsPromises.unlink(p)
});

function defaultForKey(key, fallback) {
  if (key === 'promptText') return '';
  if (key === 'deliveryAttempts') return 1;
  if (key === 'handoffId') return fallback?.handoffId ?? null;
  if (key === 'instanceId') return fallback?.instanceId ?? null;
  return null;
}

/** Project any shape onto the fixed 10-key message; extra keys are dropped. */
function normalizeMessage(message, fallback = {}) {
  const src = message && typeof message === 'object' ? message : {};
  const out = {};
  for (const key of MESSAGE_KEYS) {
    out[key] = Object.prototype.hasOwnProperty.call(src, key)
      ? src[key]
      : defaultForKey(key, fallback);
  }
  return out;
}

export function buildInboxMessage({
  handoffId,
  instanceId,
  fromNodeId,
  toNodeId,
  sessionId,
  promptText,
  createdAt,
  deliveryAttempts = 1
} = {}) {
  return normalizeMessage({
    handoffId,
    instanceId,
    fromNodeId,
    toNodeId,
    sessionId,
    promptText,
    createdAt,
    deliveryAttempts,
    deliveredAt: null,
    lastError: null
  });
}

function writeFailed(filePath, cause) {
  const text = cause instanceof Error ? cause.message : String(cause ?? 'write failed');
  return {
    ok: false,
    code: 'INBOX_WRITE_FAILED',
    params: { path: filePath, cause: text },
    deliverable: false
  };
}

/** Atomically persist first; only a successful write is deliverable (C-08). */
export async function writeInbox({ root, instanceId, handoffId, message, fs, fault } = {}) {
  const io = fs ?? defaultIo;
  const filePath = inboxFilePath(root, instanceId, handoffId);
  if (fault === 'inbox_write:fail') return writeFailed(filePath, 'inbox_write:fail');
  const value = normalizeMessage(message, { handoffId, instanceId });
  let written;
  try {
    written = await io.writeJsonAtomic(filePath, value);
  } catch (err) {
    return writeFailed(filePath, err);
  }
  if (!written || written.ok !== true) {
    return writeFailed(filePath, written?.params?.errno ?? written?.code ?? 'write failed');
  }
  return { ok: true, path: filePath, deliverable: true };
}

export async function readInbox({ root, instanceId, handoffId, fs } = {}) {
  const io = fs ?? defaultIo;
  const filePath = inboxFilePath(root, instanceId, handoffId);
  let text;
  try {
    text = await io.readFile(filePath, 'utf8');
  } catch {
    return { ok: false, code: 'INBOX_NOT_FOUND', params: { path: filePath } };
  }
  try {
    return { ok: true, path: filePath, message: normalizeMessage(JSON.parse(text)) };
  } catch (err) {
    return {
      ok: false,
      code: 'INBOX_CORRUPT',
      params: {
        path: filePath,
        cause: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

/** Merge a caller-supplied patch; only the fixed 10 keys survive. */
export async function patchInbox({ root, instanceId, handoffId, patch, fs, fault } = {}) {
  const io = fs ?? defaultIo;
  const filePath = inboxFilePath(root, instanceId, handoffId);
  const current = await readInbox({ root, instanceId, handoffId, fs: io });
  if (!current.ok) return current;
  const value = normalizeMessage({ ...current.message, ...(patch ?? {}) });
  if (fault === 'inbox_write:fail') return writeFailed(filePath, 'inbox_write:fail');
  let written;
  try {
    written = await io.writeJsonAtomic(filePath, value);
  } catch (err) {
    return writeFailed(filePath, err);
  }
  if (!written || written.ok !== true) {
    return writeFailed(filePath, written?.params?.errno ?? written?.code ?? 'write failed');
  }
  return { ok: true, path: filePath };
}

/** Stable order: ascending handoffId. */
export async function listInbox({ root, instanceId, fs } = {}) {
  const io = fs ?? defaultIo;
  let names;
  try {
    names = await io.readdir(instanceInboxDir(root, instanceId));
  } catch {
    return { ok: true, entries: [] };
  }
  const entries = names
    .filter((name) => typeof name === 'string' && name.endsWith('.json'))
    .map((name) => {
      const id = name.slice(0, -'.json'.length);
      return { handoffId: id, path: inboxFilePath(root, instanceId, id) };
    })
    .sort((a, b) => (a.handoffId < b.handoffId ? -1 : a.handoffId > b.handoffId ? 1 : 0));
  return { ok: true, entries };
}

export async function removeInbox({ root, instanceId, handoffId, fs } = {}) {
  const io = fs ?? defaultIo;
  const filePath = inboxFilePath(root, instanceId, handoffId);
  try {
    await io.unlink(filePath);
    return { ok: true, path: filePath };
  } catch {
    return { ok: false, code: 'INBOX_NOT_FOUND', params: { path: filePath } };
  }
}
