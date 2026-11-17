/**
 * I1.12 WP-4 `orch migrate` carrier (AC-16 / AC-17 / D-8).
 *
 * The command lists every reference change first, mutates nothing until the
 * caller confirms, then applies the plan through `pack.applyMigrations`. All
 * user-facing templates come from `labels.js`; this module carries key names
 * and ASCII fallbacks only, never a Chinese literal.
 */

import * as labels from './labels.js';
import { applyMigrations, listMigrations } from '../core/pack.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;

const KEYS = Object.freeze({
  row: 'migrateRow',
  none: 'migrateNone',
  done: 'migrateDone',
  cancelled: 'migrateCancelled',
  bad: 'migrateBadReference'
});

const FALLBACK = Object.freeze({
  [KEYS.row]: 'MIGRATE {file} {field} {name} {from} {to}',
  [KEYS.none]: 'NO MIGRATION NEEDED',
  [KEYS.done]: 'MIGRATION DONE {N} REFERENCES UPGRADED',
  [KEYS.cancelled]: 'MIGRATION CANCELLED',
  [KEYS.bad]: 'MIGRATION REJECTED {code}'
});

function textOf(key) {
  const table = labels.MIGRATE_TEXT ?? labels.PACK_TEXT ?? {};
  return typeof table[key] === 'string' ? table[key] : FALLBACK[key];
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function isConfirmed(parsed, ctx, plan) {
  if (parsed?.flags?.yes === true) return true;
  if (typeof ctx?.confirm === 'function') return ctx.confirm(plan) === true;
  return false;
}

/**
 * @param {{flags?:object}} parsed
 * @param {{cwd:string, out:(line:string)=>void, confirm?:(plan:object)=>boolean, registry?:object}} ctx
 * @returns {Promise<number>} 0 ok / no-op / cancelled, 1 failed
 */
export async function migrateCommand(parsed, ctx) {
  const out = typeof ctx?.out === 'function' ? ctx.out : () => {};
  const root = typeof ctx?.cwd === 'string' ? ctx.cwd : '.';
  const plan = listMigrations({ root, registry: ctx?.registry });

  if (plan.total === 0) {
    out(fill(textOf(KEYS.none), { N: 0 }));
    return EXIT_OK;
  }

  for (const item of plan.items) {
    out(
      fill(textOf(KEYS.row), {
        file: item.file,
        field: item.field,
        name: item.name,
        from: item.from,
        to: item.to
      })
    );
  }

  if (!isConfirmed(parsed, ctx, plan)) {
    out(fill(textOf(KEYS.cancelled), { N: 0 }));
    return EXIT_OK;
  }

  const result = await applyMigrations({
    root,
    plan,
    backupDir: typeof parsed?.flags?.backup === 'string' ? parsed.flags.backup : undefined
  });
  if (!result.ok) {
    out(fill(textOf(KEYS.bad), { code: result.code, detail: result.detail }));
    return EXIT_FAILED;
  }

  out(fill(textOf(KEYS.done), { N: result.changed, total: plan.total }));
  return EXIT_OK;
}
