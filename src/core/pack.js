/**
 * I1.12 WP-4 package core: dependency-closure export, Ed25519 signature plus
 * version compatibility verification, staged atomic import, and reference-only
 * migrations (AC-13 ~ AC-17 / D-7 / D-8 / freeze point 4).
 *
 * Discipline:
 * 1. Pure/read-only paths (`buildPackage`, `verifyPackage`, `listMigrations`)
 *    never touch the disk for writing. All filesystem writes are confined to
 *    the atomic paths of `importPackage` and `applyMigrations`.
 * 2. No user-facing literal is carried here. Results expose machine codes and
 *    label-key names only; the Chinese templates belong to `labels.js`.
 * 3. Verification runs before any write. A failed verification returns before
 *    a staging directory is created, so the asset tree stays byte-identical.
 * 4. `fs` is injectable in every path that touches the disk.
 */

import fsSync from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const LABEL_KEYS = Object.freeze({
  importOk: 'PACK_IMPORT_OK',
  signatureInvalid: 'PACK_SIGNATURE_INVALID',
  versionIncompatible: 'PACK_VERSION_INCOMPATIBLE',
  buildCycle: 'PACK_BUILD_CYCLE',
  buildMissing: 'PACK_BUILD_MISSING',
  migrateList: 'MIGRATE_LIST',
  migrateNone: 'MIGRATE_NONE',
  migrateDone: 'MIGRATE_DONE',
  migrateBad: 'MIGRATE_BAD_REFERENCE'
});

const TYPE_DIR = Object.freeze({ role: 'roles', skill: 'skills', workflow: 'workflows' });

function ioOf(injected) {
  return injected && typeof injected.readFile === 'function' ? injected : fsp;
}

function syncIoOf(injected) {
  return injected && typeof injected.readFileSync === 'function' ? injected : fsSync;
}

function sha256(text) {
  return crypto.createHash('sha256').update(Buffer.from(String(text ?? ''), 'utf8')).digest('hex');
}

/**
 * The signed bytes. `buildPackage` always constructs `manifest` with this fixed
 * insertion order, so `JSON.stringify` is a reproducible canonical form.
 */
function manifestBytes(manifest) {
  return Buffer.from(JSON.stringify(manifest), 'utf8');
}

function publicKeyOf(input) {
  if (input && typeof input === 'object' && typeof input.asymmetricKeyType === 'string') return input;
  if (typeof input === 'string') return crypto.createPublicKey(input);
  if (input instanceof Uint8Array) {
    return crypto.createPublicKey({ key: Buffer.from(input), format: 'der', type: 'spki' });
  }
  throw new TypeError('publicKey must be a KeyObject, a PEM string, or a DER Uint8Array');
}

function normalizeRel(rel, type, id) {
  const raw = typeof rel === 'string' && rel.length > 0 ? rel : `.orch/${TYPE_DIR[type] ?? type}s/${id}.yaml`;
  const cleaned = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  return cleaned.startsWith('.orch/') ? cleaned : `.orch/${cleaned}`;
}

function indexOf(registry) {
  const index = { role: new Map(), skill: new Map(), workflow: new Map() };
  if (registry === null || typeof registry !== 'object') return index;
  const groups = [
    ['role', registry.roles ?? registry.roleMap],
    ['skill', registry.skills ?? registry.skillMap],
    ['workflow', registry.workflows ?? registry.workflowMap]
  ];
  for (const [type, group] of groups) {
    if (group instanceof Map) {
      for (const [key, value] of group) index[type].set(String(key), value ?? {});
    } else if (Array.isArray(group)) {
      for (const value of group) {
        if (value && typeof value.id === 'string') index[type].set(value.id, value);
      }
    } else if (group !== null && typeof group === 'object') {
      for (const [key, value] of Object.entries(group)) index[type].set(key, value ?? {});
    }
  }
  return index;
}

function depOf(raw) {
  if (typeof raw === 'string') {
    const at = raw.lastIndexOf('@');
    if (at > 0 && /^\d+$/.test(raw.slice(at + 1))) {
      return { name: raw.slice(0, at), version: Number(raw.slice(at + 1)) };
    }
    return { name: raw, version: null };
  }
  if (raw !== null && typeof raw === 'object') {
    const name = raw.name ?? raw.id;
    if (typeof name === 'string') {
      return {
        name,
        version: Number.isInteger(raw.version) ? raw.version : null
      };
    }
  }
  return null;
}

/** Only real dependency edges are emitted; nothing else is pulled into the closure. */
function dependenciesOf(type, entry) {
  const deps = [];
  const add = (raw, depType) => {
    const dep = depOf(raw);
    if (dep !== null && dep.name.length > 0) deps.push({ ...dep, type: depType });
  };
  if (type === 'role') {
    const skills = Array.isArray(entry?.skills) ? entry.skills : [];
    for (const skill of skills) add(skill, 'skill');
    if (entry?.derived_from !== undefined) add(entry.derived_from, 'role');
  } else if (type === 'workflow') {
    const children = Array.isArray(entry?.subworkflows)
      ? entry.subworkflows
      : Array.isArray(entry?.subworkflow)
        ? entry.subworkflow
        : [];
    for (const child of children) add(child, 'workflow');
    const nodes = Array.isArray(entry?.nodes) ? entry.nodes : [];
    for (const node of nodes) {
      if (node && node.node_type === 'subworkflow' && typeof node.workflow === 'string') {
        add(node.workflow, 'workflow');
      }
    }
  }
  const seen = new Set();
  return deps.filter((dep) => {
    const key = `${dep.type}:${dep.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function entryText(entry, root) {
  if (entry && typeof entry.text === 'string') return entry.text;
  const rel = entry && typeof entry.file === 'string' ? entry.file : null;
  if (rel === null) return null;
  try {
    return fsSync.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function entryVersion(entry, fallback) {
  if (Number.isInteger(fallback)) return fallback;
  if (entry && Number.isInteger(entry.version)) return entry.version;
  return 1;
}

/**
 * Build the dependency closure of one asset. Read-only: file digests are taken
 * from in-memory `entry.text` or from the asset file on disk; no file is written.
 */
export function buildPackage({ asset, registry, root } = {}) {
  if (asset === null || typeof asset !== 'object' || typeof asset.id !== 'string') {
    return { ok: false, code: 'INVALID_ASSET', detail: 'asset.id is required' };
  }
  const type = asset.type;
  if (type !== 'role' && type !== 'skill' && type !== 'workflow') {
    return { ok: false, code: 'INVALID_ASSET', detail: 'asset.type is invalid' };
  }
  const index = indexOf(registry);
  const rootDir = typeof root === 'string' ? root : '.';
  const manifest = { type, id: asset.id, version: entryVersion(asset, asset.version), deps: [], files: {} };
  const files = {};
  const visiting = new Set();
  const visited = new Set();

  function visit(currentType, id, versionHint) {
    const key = `${currentType}:${id}`;
    if (visiting.has(key)) {
      return {
        ok: false,
        code: 'DEPENDENCY_CYCLE',
        detail: { chain: [...visiting, key] },
        labelKey: LABEL_KEYS.buildCycle
      };
    }
    if (visited.has(key)) return { ok: true };

    const indexed = index[currentType].get(id);
    const isRoot = currentType === type && id === asset.id;
    const entry = indexed ?? (isRoot ? asset : null);
    if (entry === null) {
      return {
        ok: false,
        code: 'DEPENDENCY_MISSING',
        detail: { name: id, type: currentType },
        labelKey: LABEL_KEYS.buildMissing
      };
    }

    const version = entryVersion(entry, versionHint);
    visiting.add(key);
    for (const dep of dependenciesOf(currentType, entry)) {
      const target = index[dep.type].get(dep.name);
      if (target === undefined) {
        visiting.delete(key);
        return {
          ok: false,
          code: 'DEPENDENCY_MISSING',
          detail: { name: dep.name, type: dep.type },
          labelKey: LABEL_KEYS.buildMissing
        };
      }
      const resolvedVersion = entryVersion(target, dep.version);
      const walked = visit(dep.type, dep.name, resolvedVersion);
      if (!walked.ok) {
        visiting.delete(key);
        return walked;
      }
      manifest.deps.push({ name: dep.name, type: dep.type, version: resolvedVersion });
    }

    const rel = normalizeRel(entry.file, currentType, id);
    const text = entryText(entry, rootDir);
    if (text === null) {
      visiting.delete(key);
      return {
        ok: false,
        code: 'DEPENDENCY_MISSING',
        detail: { name: id, type: currentType, file: rel },
        labelKey: LABEL_KEYS.buildMissing
      };
    }
    files[rel] = text;
    manifest.files[rel] = sha256(text);
    visiting.delete(key);
    visited.add(key);
    return { ok: true };
  }

  const walked = visit(type, asset.id, asset.version);
  if (!walked.ok) return walked;

  const seenDep = new Set();
  manifest.deps = manifest.deps.filter((dep) => {
    const key = `${dep.type}:${dep.name}`;
    if (seenDep.has(key)) return false;
    seenDep.add(key);
    return true;
  });
  return { ok: true, manifest, files };
}

/**
 * Signature first, version second. Both failures are returned before the
 * caller can open any write path (D-7 / BR-14).
 */
export function verifyPackage({ pkg, publicKey, systemVersion } = {}) {
  if (pkg === null || typeof pkg !== 'object') {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      detail: 'package is not an object',
      labelKey: LABEL_KEYS.signatureInvalid
    };
  }
  const manifest = pkg.manifest;
  const signature = pkg.signature;
  const compat = pkg.compat;
  if (
    manifest === null ||
    typeof manifest !== 'object' ||
    signature === null ||
    typeof signature !== 'object' ||
    compat === null ||
    typeof compat !== 'object'
  ) {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      detail: 'manifest / signature / compat are required',
      labelKey: LABEL_KEYS.signatureInvalid
    };
  }

  let valid = false;
  try {
    const key = publicKeyOf(publicKey);
    const sig = typeof signature.sig === 'string'
      ? Buffer.from(signature.sig, 'base64')
      : signature.sig;
    valid =
      signature.alg === 'Ed25519' &&
      Buffer.isBuffer(sig) &&
      sig.length > 0 &&
      crypto.verify(null, manifestBytes(manifest), key, sig);
  } catch {
    valid = false;
  }
  if (!valid) {
    return {
      ok: false,
      code: 'SIGNATURE_INVALID',
      detail: 'signature verification failed',
      labelKey: LABEL_KEYS.signatureInvalid
    };
  }

  if (
    !Number.isInteger(compat.min) ||
    !Number.isInteger(compat.max) ||
    !Number.isInteger(systemVersion) ||
    systemVersion < compat.min ||
    systemVersion > compat.max
  ) {
    return {
      ok: false,
      code: 'VERSION_INCOMPATIBLE',
      detail: { systemVersion, min: compat.min, max: compat.max },
      labelKey: LABEL_KEYS.versionIncompatible
    };
  }

  return {
    ok: true,
    signatureValid: true,
    versionCompatible: true,
    labelKey: LABEL_KEYS.importOk
  };
}

/**
 * Verify, digest-check, then stage every file under a temporary directory and
 * move it into place. An existing target is never overwritten. Every failure
 * before or during the move removes the staging tree and any moved file.
 */
export async function importPackage({ pkg, publicKey, systemVersion, root, fs: injectedFs } = {}) {
  const checked = verifyPackage({ pkg, publicKey, systemVersion });
  if (!checked.ok) return checked;

  const io = ioOf(injectedFs);
  const rootDir = typeof root === 'string' ? root : '.';
  const manifest = pkg.manifest;
  const entries = Object.entries(manifest.files ?? {});
  if (entries.length === 0) {
    return { ok: false, code: 'PACKAGE_EMPTY', detail: 'manifest.files is empty' };
  }

  const contents = {};
  for (const [rel, digest] of entries) {
    const text = pkg.files?.[rel];
    if (typeof text !== 'string' || sha256(text) !== digest) {
      return { ok: false, code: 'FILE_DIGEST_MISMATCH', detail: rel };
    }
    contents[rel] = text;
  }

  const segmentsOf = (rel) => String(rel).replace(/\\/g, '/').split('/').filter((p) => p.length > 0 && p !== '.' && p !== '..');
  const targetOf = (rel) => path.join(rootDir, ...segmentsOf(rel));

  for (const [rel] of entries) {
    const target = targetOf(rel);
    try {
      await io.stat(target);
      return { ok: false, code: 'ASSET_EXISTS', detail: rel };
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        return { ok: false, code: 'ASSET_EXISTS', detail: rel };
      }
    }
  }

  const stage = path.join(
    rootDir,
    '.orch',
    `.pack-stage-${process.pid}-${crypto.randomBytes(4).toString('hex')}`
  );
  const moved = [];
  const removeStage = async () => {
    try { await io.rm(stage, { recursive: true, force: true }); } catch { /* best effort */ }
  };
  const rollback = async () => {
    for (const target of moved) {
      try { await io.rm(target, { force: true }); } catch { /* best effort */ }
    }
    await removeStage();
  };

  try {
    await io.mkdir(stage, { recursive: true });
    for (const [rel, text] of Object.entries(contents)) {
      const staged = path.join(stage, ...segmentsOf(rel));
      await io.mkdir(path.dirname(staged), { recursive: true });
      await io.writeFile(staged, text, 'utf8');
    }
    for (const [rel] of entries) {
      const staged = path.join(stage, ...segmentsOf(rel));
      const target = targetOf(rel);
      await io.mkdir(path.dirname(target), { recursive: true });
      await io.rename(staged, target);
      moved.push(target);
    }
  } catch (err) {
    await rollback();
    return {
      ok: false,
      code: 'IMPORT_WRITE_FAILED',
      detail: String(err?.code ?? err?.message ?? 'write failed')
    };
  }

  await removeStage();
  return {
    ok: true,
    installed: moved.slice(),
    labelKey: LABEL_KEYS.importOk
  };
}

function walkAssetFiles(rootDir, io) {
  const base = path.join(rootDir, '.orch');
  const found = [];
  const visitDir = (dir) => {
    let entries;
    try {
      entries = io.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.pack-stage-') || entry.name.startsWith('.migrate-')) continue;
        visitDir(abs);
      } else if (/\.ya?ml$/i.test(entry.name)) {
        let text;
        try {
          text = io.readFileSync(abs, 'utf8');
        } catch {
          continue;
        }
        found.push({ rel: path.relative(rootDir, abs).replace(/\\/g, '/'), text });
      }
    }
  };
  visitDir(base);
  return found;
}

function mergeRegistryVersions(index, registry) {
  if (registry === null || typeof registry !== 'object') return;
  const buckets = [registry.roles, registry.roleMap, registry.skills, registry.skillMap, registry.workflows, registry.workflowMap, registry.versionMap, registry.versions];
  for (const bucket of buckets) {
    if (bucket instanceof Map) {
      for (const [key, value] of bucket) {
        if (Number.isInteger(value?.version)) index.set(String(key), value.version);
      }
    } else if (Array.isArray(bucket)) {
      for (const value of bucket) {
        if (typeof value?.id === 'string' && Number.isInteger(value.version)) index.set(value.id, value.version);
      }
    } else if (bucket !== null && typeof bucket === 'object') {
      for (const [key, value] of Object.entries(bucket)) {
        if (Number.isInteger(value)) index.set(key, value);
        else if (Number.isInteger(value?.version)) index.set(key, value.version);
      }
    }
  }
}

function versionIndex(rootDir, io, registry) {
  const index = new Map();
  for (const file of walkAssetFiles(rootDir, io)) {
    const id = file.text.match(/^id:\s*(\S+)\s*$/m)?.[1];
    const version = file.text.match(/^version:\s*(\d+)\s*$/m)?.[1];
    if (id && version && !index.has(id)) index.set(id, Number(version));
  }
  mergeRegistryVersions(index, registry);
  return index;
}

function fieldOfLine(line, section) {
  if (/^\s*derived_from\s*:/.test(line)) return 'derived_from';
  if (/^\s*subworkflows?\s*:/.test(line)) return 'subworkflows';
  if (line.includes('subworkflow')) return 'subworkflow';
  return section ?? 'references';
}

/** One list item per `@version` token; `from -> to` is strictly one-to-one. */
export function listMigrations({ root, registry, fs: injectedFs } = {}) {
  const io = syncIoOf(injectedFs);
  const rootDir = typeof root === 'string' ? root : '.';
  const index = versionIndex(rootDir, io, registry);
  const items = [];

  for (const file of walkAssetFiles(rootDir, io)) {
    let section = null;
    for (const line of file.text.split(/\r?\n/)) {
      const header = line.match(/^\s*([A-Za-z_][\w-]*)\s*:/);
      if (header) section = header[1];
      for (const match of line.matchAll(/([A-Za-z0-9_.-]+)@(\d+)/g)) {
        const name = match[1];
        const from = Number(match[2]);
        const current = index.get(name);
        if (current !== undefined && current === from) continue;
        items.push({
          from,
          to: current === undefined ? null : current,
          file: file.rel,
          field: fieldOfLine(line, section),
          name,
          targetExists: current !== undefined
        });
      }
    }
  }
  return { items, total: items.length };
}

function replaceToken(text, name, from, to) {
  const needle = `${name}@${from}`;
  const at = text.indexOf(needle);
  if (at < 0) return { ok: false, text };
  return {
    ok: true,
    text: text.slice(0, at) + `${name}@${to}` + text.slice(at + needle.length)
  };
}

/**
 * Backup first, then rewrite reference tokens through a staging directory.
 * A missing target is rejected before any write. A failed move restores the
 * original bytes from the backup and removes every temporary file.
 */
export async function applyMigrations({ root, plan, backupDir, fs: injectedFs } = {}) {
  const io = ioOf(injectedFs);
  const rootDir = typeof root === 'string' ? root : '.';
  const items = Array.isArray(plan?.items) ? plan.items : [];

  if (items.length === 0) {
    return { ok: true, changed: 0, summary: { changed: 0, items: [], backupDir: null } };
  }

  for (const item of items) {
    if (item?.targetExists === false || !Number.isInteger(item?.to)) {
      return {
        ok: false,
        code: 'MIGRATION_TARGET_MISSING',
        detail: { name: item?.name ?? null, file: item?.file ?? null },
        labelKey: LABEL_KEYS.migrateBad
      };
    }
  }

  const segmentsOf = (rel) => String(rel).replace(/\\/g, '/').split('/').filter((p) => p.length > 0 && p !== '.' && p !== '..');
  const targetOf = (rel) => path.join(rootDir, ...segmentsOf(rel));
  const byFile = new Map();
  for (const item of items) {
    if (!byFile.has(item.file)) byFile.set(item.file, []);
    byFile.get(item.file).push(item);
  }

  const backup = typeof backupDir === 'string' && backupDir.length > 0
    ? backupDir
    : path.join(rootDir, '.orch', `.migrate-backup-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  const backed = [];
  const stage = path.join(rootDir, '.orch', `.migrate-stage-${process.pid}-${crypto.randomBytes(4).toString('hex')}`);
  const restore = async () => {
    for (const entry of backed) {
      try {
        const text = await io.readFile(entry.backup, 'utf8');
        await io.writeFile(entry.target, text, 'utf8');
      } catch { /* best effort */ }
    }
    try { await io.rm(stage, { recursive: true, force: true }); } catch { /* best effort */ }
  };

  try {
    for (const rel of byFile.keys()) {
      const target = targetOf(rel);
      const backupFile = path.join(backup, ...segmentsOf(rel));
      const text = await io.readFile(target, 'utf8');
      await io.mkdir(path.dirname(backupFile), { recursive: true });
      await io.writeFile(backupFile, text, 'utf8');
      backed.push({ target, backup: backupFile, text });
    }

    await io.mkdir(stage, { recursive: true });
    for (const [rel, fileItems] of byFile) {
      const original = backed.find((entry) => entry.target === targetOf(rel))?.text ?? '';
      let next = original;
      for (const item of fileItems) {
        const replaced = replaceToken(next, item.name, item.from, item.to);
        if (!replaced.ok) {
          await restore();
          return {
            ok: false,
            code: 'MIGRATION_REFERENCE_NOT_FOUND',
            detail: { name: item.name, file: rel },
            labelKey: LABEL_KEYS.migrateBad
          };
        }
        next = replaced.text;
      }
      const staged = path.join(stage, ...segmentsOf(rel));
      await io.mkdir(path.dirname(staged), { recursive: true });
      await io.writeFile(staged, next, 'utf8');
      await io.rename(staged, targetOf(rel));
    }
  } catch (err) {
    await restore();
    return {
      ok: false,
      code: 'MIGRATION_WRITE_FAILED',
      detail: String(err?.code ?? err?.message ?? 'write failed')
    };
  }

  await io.rm(stage, { recursive: true, force: true });
  return {
    ok: true,
    changed: items.length,
    summary: {
      changed: items.length,
      items: items.map((item) => ({
        from: item.from,
        to: item.to,
        file: item.file,
        field: item.field,
        name: item.name
      })),
      backupDir: backup
    },
    labelKey: LABEL_KEYS.migrateDone
  };
}
