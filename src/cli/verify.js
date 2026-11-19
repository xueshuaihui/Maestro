/**
 * I1.12 WP-7 - `orch verify` shared handler (decision A item 1, D-13:704).
 *
 * One handler, four frozen targets:
 *   verify <instance>       -> audit-verify.verifyChain        (async)
 *   verify <package>        -> pack.verifyPackage
 *   verify import <package> -> pack.importPackage              (async)
 *   verify review <workflow>-> governance.validateHighRiskReview
 *
 * No second dispatch table: target selection lives in resolveTarget() and the
 * module lookups reuse the frozen specifiers from main.js::FAMILY_MODULES.
 *
 * Every user-visible string comes from labels.js. A missing key throws: there
 * is deliberately no hardcoded Chinese fallback (decision C item 3). This
 * module carries ASCII keys, ASCII codes and English diagnostics only.
 *
 * Injected frozen-signature stubs (`ctx.deps.verifyChain`, etc.) are used by
 * the wiring contract test so it never needs to load a capability package.
 */

import * as labels from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;

/** Frozen target tokens (ASCII; not user-visible). */
export const VERIFY_TARGETS = Object.freeze({
  CHAIN: 'CHAIN',
  PACKAGE: 'PACKAGE',
  IMPORT: 'IMPORT',
  REVIEW: 'REVIEW',
});

/** Frozen label keys consumed by this handler; values live in labels.js. */
export const VERIFY_LABEL_KEYS = Object.freeze({
  chainComplete: 'CHAIN_COMPLETE',
  chainBroken: 'CHAIN_BROKEN',
  packImportOk: 'PACK_IMPORT_OK',
  packSignatureInvalid: 'PACK_SIGNATURE_INVALID',
  packVersionIncompatible: 'PACK_VERSION_INCOMPATIBLE',
  highRiskNoReview: 'HIGH_RISK_MISSING_REVIEW',
  reviewPassed: 'VERIFY_REVIEW_PASSED',
});

/**
 * A missing key must throw rather than silently print an English code or a
 * hardcoded literal. Mirrors audit-verify.js::templateOf (decision C item 3).
 */
export function requireLabel(table, key) {
  if (table !== null && typeof table === 'object' && typeof table[key] === 'string') {
    return table[key];
  }
  throw new TypeError(`verifyCommand: missing label template "${key}"`);
}

/** Resolve one of the four frozen targets from a parsed argv object. */
export function resolveTarget(parsed) {
  const sub = typeof parsed?.sub === 'string' ? parsed.sub : null;
  if (sub === 'import') return VERIFY_TARGETS.IMPORT;
  if (sub === 'review') return VERIFY_TARGETS.REVIEW;
  const flags = parsed?.flags ?? {};
  const wantsPackage =
    flags.package === true ||
    flags.package === 'true' ||
    (typeof flags.package === 'string' && flags.package.length > 0);
  return wantsPackage ? VERIFY_TARGETS.PACKAGE : VERIFY_TARGETS.CHAIN;
}

/** The single positional target (last wins), with flag fallbacks. */
export function targetValueOf(parsed) {
  const pos = Array.isArray(parsed?.positionals) ? parsed.positionals : [];
  if (pos.length > 0) return pos[pos.length - 1];
  if (typeof parsed?.positional === 'string') return parsed.positional;
  const flags = parsed?.flags ?? {};
  return flags.instance ?? flags.package ?? null;
}

function outOf(ctx) {
  return typeof ctx?.out === 'function' ? ctx.out : () => {};
}

/** Replace {NAME} and [NAME] placeholders from a label template. */
export function fill(template, vars) {
  return String(template)
    .replace(/\{(\w+)\}/g, (match, key) => valueOrEmpty(vars?.[key]))
    .replace(/\[(\w+)\]/g, (match, key) => valueOrEmpty(vars?.[key]));
}

function valueOrEmpty(value) {
  return value === undefined || value === null ? '' : String(value);
}

function depsOf(ctx) {
  return ctx && typeof ctx.deps === 'object' && ctx.deps !== null ? ctx.deps : {};
}

function rootOf(ctx) {
  return typeof ctx?.cwd === 'string' && ctx.cwd.length > 0 ? ctx.cwd : '.';
}

function packageResultKey(code) {
  return code === 'VERSION_INCOMPATIBLE'
    ? VERIFY_LABEL_KEYS.packVersionIncompatible
    : VERIFY_LABEL_KEYS.packSignatureInvalid;
}

/** Load a frozen module export unless a frozen-signature stub was injected. */
async function load(deps, name, specifier, exportName) {
  if (typeof deps[name] === 'function') return deps[name];
  const mod = await import(specifier);
  return mod[exportName];
}

/**
 * @param {{sub?:string, positionals?:string[], positional?:string, flags?:object}} parsed
 * @param {{cwd?:string, out?:(line:string)=>void, publicKey?:string, roles?:*, graph?:*,
 *   deps?:{verifyChain?:Function, verifyPackage?:Function, importPackage?:Function,
 *     validateHighRiskReview?:Function, fs?:object, pkg?:object, publicKey?:string,
 *     systemVersion?:number, workflow?:*, roles?:*, graph?:*}}} ctx
 * @returns {Promise<number>} 0 ok / 1 rejected (tamper, bad signature, version, block)
 */
export async function verifyCommand(parsed, ctx = {}) {
  const out = outOf(ctx);
  const deps = depsOf(ctx);
  const target = resolveTarget(parsed);
  const value = targetValueOf(parsed);

  if (target === VERIFY_TARGETS.CHAIN) {
    const run = await load(deps, 'verifyChain', '../core/audit-verify.js', 'verifyChain');
    const result = await run({ root: rootOf(ctx), instanceId: value, fs: deps.fs ?? ctx?.fs });
    const ok = result?.ok === true;
    const key = ok ? VERIFY_LABEL_KEYS.chainComplete : VERIFY_LABEL_KEYS.chainBroken;
    // A break must report the mismatching record's seq (decision E / D-2), not
    // the number of records verified before the break. A complete chain still
    // reports its verified count. No label or exit-code change here.
    const n = ok
      ? result?.count ?? result?.total ?? 0
      : result?.seq ?? result?.firstMismatch ?? result?.badIndex ?? result?.count ?? result?.total ?? 0;
    out(fill(requireLabel(labels, key), { N: n }));
    return ok ? EXIT_OK : EXIT_FAILED;
  }

  if (target === VERIFY_TARGETS.PACKAGE) {
    const run = await load(deps, 'verifyPackage', '../core/pack.js', 'verifyPackage');
    const result = run({
      pkg: deps.pkg ?? value,
      publicKey: deps.publicKey ?? ctx?.publicKey,
      systemVersion: deps.systemVersion,
    });
    if (result?.ok === true) {
      out(requireLabel(labels, VERIFY_LABEL_KEYS.packImportOk));
      return EXIT_OK;
    }
    out(requireLabel(labels, packageResultKey(result?.code)));
    return EXIT_FAILED;
  }

  if (target === VERIFY_TARGETS.IMPORT) {
    const run = await load(deps, 'importPackage', '../core/pack.js', 'importPackage');
    const result = await run({
      pkg: deps.pkg ?? value,
      publicKey: deps.publicKey ?? ctx?.publicKey,
      systemVersion: deps.systemVersion,
      root: rootOf(ctx),
      fs: deps.fs ?? ctx?.fs,
    });
    if (result?.ok === true) {
      out(requireLabel(labels, VERIFY_LABEL_KEYS.packImportOk));
      return EXIT_OK;
    }
    out(requireLabel(labels, packageResultKey(result?.code)));
    return EXIT_FAILED;
  }

  // VERIFY_TARGETS.REVIEW - high-risk human-gate path check.
  const run = await load(deps, 'validateHighRiskReview', '../core/governance.js', 'validateHighRiskReview');
  const result = run({
    workflow: deps.workflow ?? value,
    roles: deps.roles ?? ctx?.roles,
    graph: deps.graph ?? ctx?.graph,
  });
  // needsHumanReview marks an existing human gate, not a validation failure.
  if (result?.ok === true && result?.blocked !== true) {
    out(requireLabel(labels, VERIFY_LABEL_KEYS.reviewPassed));
    return EXIT_OK;
  }
  out(requireLabel(labels, VERIFY_LABEL_KEYS.highRiskNoReview));
  return EXIT_FAILED;
}
