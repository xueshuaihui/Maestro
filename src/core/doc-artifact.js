/**
 * Document artifacts for the single-document loop (requirement D-8).
 *
 * This module is the **only** place that
 *   1. reads the `产物：<文件名>.md` line of a task (`doc-single` policy),
 *   2. joins a versioned document reference `<dir>/<stem>.v<round>.md`,
 *   3. decides what "this round's products" means per node policy,
 *   4. fingerprints a file (streaming sha256, never the body into memory),
 *   5. checks that the previous version was not rewritten.
 *
 * `advance.js`, `orchestrator.js` and `src/templates` all go through it, so the
 * versioned filename is never assembled twice.
 */
import crypto from 'node:crypto';
import fsPromises from 'node:fs/promises';
import { createReadStream as createFileReadStream } from 'node:fs';
import path from 'node:path';

import { ARTIFACT_TEXT } from '../cli/labels.js';

export const ARTIFACTS_DIR = 'artifacts';
export const DOCS_DIR = 'artifacts/docs';
export const REPORTS_DIR = 'artifacts/reports';

/** The fixed research note, relative to the instance workspace. */
export const RESEARCH_REF = 'artifacts/reports/research-notes.v1.md';

/** Policies a graph node may declare. `declared` is the I1.1 / I1.2 default. */
export const NODE_POLICIES = Object.freeze([
  'fixed-workspace',
  'versioned-doc',
  'review',
  'declared',
  'heuristic'
]);

const PRODUCT_MARKER = '产物：';
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const DRIVE_LETTER = /^[A-Za-z]:/;
/** A name that already carries `.v<number>` is not allowed: the core owns the version. */
const VERSIONED_TAIL = /\.v\d+$/;

/** Fill `{ref}` in an `ARTIFACT_TEXT` entry and prefix it like the user sees it. */
export function artifactMessage(key, ref = null) {
  const text = ARTIFACT_TEXT[key] ?? '';
  const body = text.replace(/\{ref\}/g, ref === null || ref === undefined ? '' : String(ref));
  return body;
}

function invalidDeclaration(name) {
  return { ok: false, code: 'PRODUCT_INVALID_TASK_LOOP', name };
}

/**
 * Read the single `产物：<文件名>.md` declaration of a `doc-single` task.
 *
 * Deliberately **not** `extractProductLines()`: that helper normalizes `../x.md` to
 * `null` first, which loses the original token the user has to see in the error line
 * (AC-23) and reports the wrong machine code.
 *
 * @param {string} task
 * @returns {{ok:true, name:string, stem:string}
 *   |{ok:false, code:'PRODUCT_LINE_MISSING_TASK_LOOP'|'PRODUCT_INVALID_TASK_LOOP',
 *      name:string|null}}
 */
export function parseProductDeclaration(task) {
  const text = typeof task === 'string' ? task : '';
  const lines = text.split(/\r?\n/);

  // "Exactly one `产物：` marker in the whole task": 0 or 2+ both mean "no usable line".
  const hits = [];
  for (let index = 0; index < lines.length; index += 1) {
    const at = lines[index].indexOf(PRODUCT_MARKER);
    if (at >= 0) hits.push({ line: index, at });
  }
  if (hits.length !== 1) {
    return { ok: false, code: 'PRODUCT_LINE_MISSING_TASK_LOOP', name: null };
  }

  const { line, at } = hits[0];
  const raw = lines[line].slice(at + PRODUCT_MARKER.length).trim();

  if (raw.length === 0) return invalidDeclaration(raw);
  if (raw.includes('/') || raw.includes('\\')) return invalidDeclaration(raw);
  if (raw.includes('..')) return invalidDeclaration(raw);
  if (DRIVE_LETTER.test(raw) || CONTROL_CHARS.test(raw)) return invalidDeclaration(raw);
  if (!raw.endsWith('.md')) return invalidDeclaration(raw);

  const stem = raw.slice(0, -'.md'.length);
  if (stem.length === 0) return invalidDeclaration(raw);
  if (VERSIONED_TAIL.test(stem)) return invalidDeclaration(raw);

  return { ok: true, name: raw, stem };
}

/** `<dir>/<stem>.v<round><ext>` — the one and only versioned reference builder. */
export function docRef({ artifactDir = DOCS_DIR, artifactExt = '.md', stem, round } = {}) {
  if (typeof stem !== 'string' || stem.length === 0) return null;
  if (!Number.isInteger(round) || round < 1) return null;
  const dir = String(artifactDir ?? DOCS_DIR).replace(/\/+$/, '');
  const ext = String(artifactExt ?? '.md');
  return `${dir}/${stem}.v${round}${ext}`;
}

/** Alias kept for the wording in requirement D-8 (`doc-artifact.nodeProducts(...)`). */
export const nodeProducts = docRef;

function fail(code, detail = null) {
  return { ok: false, code, detail };
}

/**
 * Resolve this round's products for one graph node. The only entry point: the engine
 * never decides a product path itself.
 *
 * @param {{artifactPolicy?:string, products?:string[], artifactDir?:string,
 *          artifactExt?:string, reviewPath?:string}} def
 * @param {{node?:object, state?:object, workspaceDir?:string|null, cwd?:string|null,
 *          productPolicy?:string}} [context]
 * @returns {{ok:true, policy:string, baseDir:string, products:string[]}
 *   |{ok:false, code:string, policy:string, detail?:string|null}}
 */
export function resolveNodeProducts(def, context = {}) {
  const { node = null, state = null, workspaceDir = null, cwd = null } = context;
  const productPolicy = context.productPolicy ?? 'declared';
  const policy = def?.artifactPolicy ?? 'declared';

  if (policy === 'review') {
    // The review node only hands in a review file; the caller goes through `readReview()`.
    return fail('NO_PRODUCTS', def?.reviewPath ?? null);
  }

  if (policy === 'fixed-workspace') {
    const products = (Array.isArray(def?.products) ? def.products : []).filter(
      (item) => typeof item === 'string' && item.length > 0
    );
    if (products.length === 0) return fail('NO_PRODUCTS');
    if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
      return fail('WORKSPACE_MISSING');
    }
    return { ok: true, policy, baseDir: workspaceDir, products };
  }

  if (policy === 'versioned-doc') {
    const stem = state?.artifactStem ?? null;
    const round = node?.round ?? 0;
    const ref = docRef({
      artifactDir: def?.artifactDir ?? DOCS_DIR,
      artifactExt: def?.artifactExt ?? '.md',
      stem,
      round
    });
    if (ref === null) {
      return fail(typeof stem === 'string' && stem.length > 0 ? 'ROUND_INVALID' : 'ARTIFACT_STEM_MISSING');
    }
    if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
      return fail('WORKSPACE_MISSING');
    }
    return { ok: true, policy, baseDir: workspaceDir, products: [ref] };
  }

  // `declared` / `heuristic` — the I1.2 behaviour, unchanged for the two older graphs.
  const baseDir = path.resolve(cwd ?? workspaceDir ?? '.');
  const declared = (Array.isArray(def?.products) ? def.products : []).filter(
    (item) => typeof item === 'string' && item.length > 0
  );
  if (declared.length > 0) {
    return { ok: true, policy: policy === 'heuristic' ? 'heuristic' : 'declared', baseDir, products: declared };
  }
  if (productPolicy === 'doc-single') {
    // Never fall back to the task line here: it would hand back a bare `<name>.md`
    // and make the document node look "submitted" while nothing was written (risk R3).
    return fail('NO_PRODUCTS');
  }
  return { ok: true, policy: 'heuristic', baseDir, products: [] };
}

/**
 * Streaming sha256, so a large document never lands in memory as a single string.
 *
 * @param {string} absPath
 * @param {{fs?:object}} [options] `fs.createReadStream` is used when the caller injects one
 * @returns {Promise<{ok:true, sha256:string, bytes:number}|{ok:false, code:'READ_FAILED'}>}
 */
export async function sha256Of(absPath, { fs: io = null } = {}) {
  const makeStream = typeof io?.createReadStream === 'function' ? io.createReadStream : createFileReadStream;
  try {
    const hash = crypto.createHash('sha256');
    let bytes = 0;
    const stream = makeStream(absPath);
    for await (const chunk of stream) {
      hash.update(chunk);
      bytes += chunk.length;
    }
    return { ok: true, sha256: hash.digest('hex'), bytes };
  } catch {
    return { ok: false, code: 'READ_FAILED' };
  }
}

/**
 * Step 2 of the document node's verification flow (requirement D-8): the previous version must
 * still be there and unchanged. Only reached on round > 1.
 *
 * @param {{baseDir:string, ref:string, sha256?:string|null, fs?:object}} options
 * @returns {Promise<{ok:true}|{ok:false, code:'artifact_previous_missing'|'artifact_previous_modified', ref:string}>}
 */
export async function verifyPrevious({ baseDir, ref, sha256 = null, fs: io = fsPromises } = {}) {
  const ioLayer = io ?? fsPromises;
  const absPath = path.resolve(baseDir ?? '.', ref);
  let stat = null;
  try {
    stat = await ioLayer.stat(absPath);
  } catch {
    stat = null;
  }
  if (stat === null || stat.isDirectory?.() === true) {
    return { ok: false, code: 'artifact_previous_missing', ref };
  }
  if (typeof sha256 === 'string' && sha256.length > 0) {
    const digest = await sha256Of(absPath, { fs: ioLayer });
    if (!digest.ok) return { ok: false, code: 'artifact_previous_missing', ref };
    if (digest.sha256 !== sha256) return { ok: false, code: 'artifact_previous_modified', ref };
  }
  return { ok: true };
}
