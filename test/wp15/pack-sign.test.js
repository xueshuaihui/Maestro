/**
 * I1.12 WP-4 / AC-14 + AC-15 contract: Ed25519 signature and version gate,
 * staged atomic import, and no pollution of the asset tree on rejection.
 *
 * Fixtures live under os.tmpdir() (%TEMP%) with NODE_ENV=test. Keys are
 * generated in-process with node:crypto; no third-party dependency is used.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import { buildPackage, verifyPackage, importPackage } from '../../src/core/pack.js';

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const SYSTEM_VERSION = 2;
const COMPAT = { min: 1, max: 3 };

const sha = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

function freshRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-i112-import-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function snapshot(dir) {
  const out = {};
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out[path.relative(dir, abs).replace(/\\/g, '/')] = sha(fs.readFileSync(abs, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

function assertNoStage(dir) {
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      assert.ok(!entry.name.startsWith('.pack-stage-'), `staging residue: ${entry.name}`);
      if (entry.isDirectory()) walk(path.join(current, entry.name));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
}

function builtPackage() {
  const registry = {
    roles: {
      'role-a': {
        version: 2,
        file: '.orch/roles/role-a.yaml',
        skills: ['skill-x'],
        text: 'id: role-a\nversion: 2\n'
      }
    },
    skills: {
      'skill-x': {
        version: 2,
        file: '.orch/skills/skill-x.yaml',
        text: 'id: skill-x\nversion: 2\n'
      }
    },
    workflows: {}
  };
  const built = buildPackage({ asset: { type: 'role', id: 'role-a' }, registry, root: '.' });
  assert.equal(built.ok, true);
  return built;
}

function signed(built, overrides = {}) {
  const manifest = overrides.manifest ?? built.manifest;
  const sig = crypto.sign(null, Buffer.from(JSON.stringify(manifest)), privateKey).toString('base64');
  const signature = { alg: 'Ed25519', publicKeyId: 'local-main', sig: overrides.tamper ? `${sig.slice(0, 1) === 'A' ? 'B' : 'A'}${sig.slice(1)}` : sig };
  return {
    manifest,
    files: { ...built.files, ...(overrides.files ?? {}) },
    signature,
    compat: overrides.compat ?? COMPAT
  };
}

test('valid signature + compatible version imports successfully', async (t) => {
  const root = freshRoot(t);
  const built = builtPackage();
  const pkg = signed(built);

  const verified = verifyPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION });
  assert.deepEqual(
    { ok: verified.ok, signatureValid: verified.signatureValid, versionCompatible: verified.versionCompatible },
    { ok: true, signatureValid: true, versionCompatible: true }
  );
  assert.equal(verified.labelKey, 'PACK_IMPORT_OK');

  const result = await importPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION, root });
  assert.equal(result.ok, true);
  assert.equal(result.installed.length, 2);
  assert.equal(result.labelKey, 'PACK_IMPORT_OK');
  for (const [rel, text] of Object.entries(built.files)) {
    assert.equal(fs.readFileSync(path.join(root, rel), 'utf8'), text);
  }
  assertNoStage(root);
});

test('tampered signature is rejected before any write and leaves the tree byte-identical', async (t) => {
  const root = freshRoot(t);
  fs.mkdirSync(path.join(root, '.orch', 'roles'), { recursive: true });
  const keep = path.join(root, '.orch', 'roles', 'keep.yaml');
  fs.writeFileSync(keep, 'id: keep\nversion: 1\n', 'utf8');
  const before = snapshot(root);
  const pkg = signed(builtPackage(), { tamper: true });

  const verified = verifyPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION });
  assert.equal(verified.ok, false);
  assert.equal(verified.code, 'SIGNATURE_INVALID');
  const result = await importPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION, root });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SIGNATURE_INVALID');
  assert.deepEqual(snapshot(root), before);
  assertNoStage(root);
});

test('incompatible version is rejected before any write and leaves the tree byte-identical', async (t) => {
  const root = freshRoot(t);
  const keep = path.join(root, 'marker.txt');
  fs.writeFileSync(keep, 'unchanged', 'utf8');
  const before = snapshot(root);
  const pkg = signed(builtPackage(), { compat: { min: 1, max: 3 } });

  const verified = verifyPackage({ pkg, publicKey, systemVersion: 4 });
  assert.equal(verified.ok, false);
  assert.equal(verified.code, 'VERSION_INCOMPATIBLE');
  assert.deepEqual(verified.detail, { systemVersion: 4, min: 1, max: 3 });
  const result = await importPackage({ pkg, publicKey, systemVersion: 4, root });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'VERSION_INCOMPATIBLE');
  assert.deepEqual(snapshot(root), before);
  assertNoStage(root);
});

test('signature is checked before version when both are bad', (t) => {
  const pkg = signed(builtPackage(), { tamper: true, compat: { min: 9, max: 10 } });
  const result = verifyPackage({ pkg, publicKey, systemVersion: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SIGNATURE_INVALID');
});

test('a manifest changed after signing invalidates the signature', (t) => {
  const pkg = signed(builtPackage());
  pkg.manifest = { ...pkg.manifest, version: 99 };
  const result = verifyPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SIGNATURE_INVALID');
});

test('a file digest mismatch is rejected before any staging write', async (t) => {
  const root = freshRoot(t);
  const built = builtPackage();
  const rel = Object.keys(built.files)[0];
  const pkg = signed(built, { files: { [rel]: `${built.files[rel]}\nchanged` } });
  const result = await importPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION, root });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FILE_DIGEST_MISMATCH');
  assert.deepEqual(snapshot(root), {});
  assertNoStage(root);
});

test('an existing asset is never overwritten', async (t) => {
  const root = freshRoot(t);
  const built = builtPackage();
  const rel = Object.keys(built.files)[0];
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), 'existing bytes', 'utf8');
  const before = snapshot(root);
  const pkg = signed(built);

  const result = await importPackage({ pkg, publicKey, systemVersion: SYSTEM_VERSION, root });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ASSET_EXISTS');
  assert.deepEqual(snapshot(root), before);
  assertNoStage(root);
});

test('signature uses node Ed25519 and the package declares the frozen algorithm', (t) => {
  const pkg = signed(builtPackage());
  assert.equal(pkg.signature.alg, 'Ed25519');
  assert.equal(publicKey.asymmetricKeyType, 'ed25519');
  const ok = crypto.verify(
    null,
    Buffer.from(JSON.stringify(pkg.manifest)),
    publicKey,
    Buffer.from(pkg.signature.sig, 'base64')
  );
  assert.equal(ok, true);
});
