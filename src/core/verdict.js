/**
 * Structured verdict reader. Only the file is authoritative — the agent's chat text
 * is never inspected here.
 *
 * Fixed path: `<cwd>/out/verdict.json`. Six failure classes, checked in this order:
 *   1 missing -> 2 stale -> 3 unparsable / schema -> 4 no defects (fail)
 *   -> 5 defects present (pass) -> 6 unreadable evidence
 *
 * The result always carries a machine code plus the D-5 `reasonCode` / `stage` and
 * the verbatim `reasonDetail` the caller stores on the escalation. Any failure is
 * returned, never thrown; the caller decides whether to escalate.
 */
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { VERDICT_TEXT } from '../cli/labels.js';

export const VERDICT_PATH = 'out/verdict.json';

const defaultNow = () => Date.now();

function detailOf(key) {
  return `${VERDICT_TEXT.prefix}${VERDICT_TEXT[key]}`;
}

function fail(code, { stage, reasonCode, key, extra = {} }) {
  return {
    ok: false,
    code,
    stage,
    reasonCode,
    reasonDetail: detailOf(key),
    verdictPath: VERDICT_PATH,
    detail: { stage, reasonCode, message: detailOf(key), ...extra }
  };
}

function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function startedAtMs(roundStartedAt) {
  if (roundStartedAt === null || roundStartedAt === undefined) return null;
  if (typeof roundStartedAt === 'number' && Number.isFinite(roundStartedAt)) return roundStartedAt;
  const parsed = Date.parse(String(roundStartedAt));
  return Number.isFinite(parsed) ? parsed : null;
}

function asStat(value) {
  if (!value || typeof value !== 'object') return null;
  const mtimeMs = Number.isFinite(value.mtimeMs) ? value.mtimeMs : Number(value.mtime);
  if (!Number.isFinite(mtimeMs)) return null;
  return { size: Number(value.size ?? 0), mtimeMs };
}

/**
 * Parse and shape-check a verdict document.
 * @returns {{ok:true, value:'pass'|'fail', defects:Array, message:string|null}|{ok:false, stage:string}}
 */
export function parseVerdict(rawText) {
  const parsed = parseJson(rawText);
  if (!parsed.ok) return { ok: false, stage: 'unparsable' };

  const document = parsed.value;
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return { ok: false, stage: 'schema' };
  }

  // Requirement §3.3: `verdict` must be strictly "pass" or "fail".
  // No alias (e.g. `result`) is accepted — a document lacking the key is invalid.
  const value = document.verdict ?? null;
  if (value !== 'pass' && value !== 'fail') return { ok: false, stage: 'schema' };

  const defects = Array.isArray(document.defects) ? document.defects : null;
  if (defects === null) return { ok: false, stage: 'schema' };

  const shaped = [];
  for (const defect of defects) {
    if (defect === null || typeof defect !== 'object' || Array.isArray(defect)) {
      return { ok: false, stage: 'schema' };
    }
    const summary = typeof defect.summary === 'string' ? defect.summary.trim() : '';
    const evidence = typeof defect.evidence === 'string' ? defect.evidence.trim() : '';
    shaped.push({ summary, evidence });
  }

  if (value === 'fail') {
    const wellFormed =
      shaped.length > 0 && shaped.every((item) => item.summary.length > 0 && item.evidence.length > 0);
    if (!wellFormed) return { ok: false, stage: 'no_defects' };
  } else if (shaped.length > 0) {
    return { ok: false, stage: 'pass_with_defects' };
  }

  return {
    ok: true,
    value,
    defects: shaped,
    message: typeof document.message === 'string' ? document.message : null
  };
}

/**
 * Check every evidence path can be opened. Relative paths resolve against `cwd`.
 * @returns {Promise<{ok:true, defects:Array}|{ok:false}>}
 */
export async function verifyEvidence(cwd, defects, io = fsPromises) {
  const baseDir = path.resolve(cwd ?? '.');
  const checked = [];
  for (const defect of Array.isArray(defects) ? defects : []) {
    const absPath = path.isAbsolute(defect.evidence)
      ? defect.evidence
      : path.resolve(baseDir, defect.evidence);
    let stat;
    try {
      stat = asStat(await io.stat(absPath));
    } catch {
      return { ok: false };
    }
    if (stat === null) return { ok: false };
    checked.push({ ...defect, absPath, bytes: stat.size });
  }
  return { ok: true, defects: checked };
}

/**
 * @param {{cwd?:string, roundStartedAt?:string|number|null, fs?:object, now?:Function}} options
 * @returns {Promise<
 *   {ok:true, verdict:{value:string, result:string, defects:Array, defectCount:number,
 *                      message:string|null, verdictPath:string, readAt:string}}
 *   | {ok:false, code:string, stage:string, reasonCode:string, reasonDetail:string,
 *      verdictPath:string, detail:object}>}
 */
export async function readVerdict({
  cwd = null,
  roundStartedAt = null,
  fs = fsPromises,
  now = defaultNow
} = {}) {
  const io = fs ?? fsPromises;
  const baseDir = path.resolve(cwd ?? '.');
  const absPath = path.join(baseDir, VERDICT_PATH);

  // 1. existence
  let stat;
  try {
    stat = asStat(await io.stat(absPath));
  } catch {
    stat = null;
  }
  if (stat === null) {
    return fail('VERDICT_MISSING', { stage: 'missing', reasonCode: 'verdict_missing', key: 'missing' });
  }

  // 2. written by this round
  const startedMs = startedAtMs(roundStartedAt);
  if (startedMs !== null && stat.mtimeMs < startedMs) {
    return fail('VERDICT_STALE', { stage: 'stale', reasonCode: 'verdict_stale', key: 'stale' });
  }

  // 3. readable + parseable + schema
  let text;
  try {
    text = await io.readFile(absPath, 'utf8');
  } catch {
    return fail('VERDICT_UNPARSABLE', {
      stage: 'unparsable',
      reasonCode: 'verdict_invalid',
      key: 'unparsable'
    });
  }

  const parsed = parseVerdict(text);
  if (!parsed.ok) {
    if (parsed.stage === 'unparsable') {
      return fail('VERDICT_UNPARSABLE', {
        stage: 'unparsable',
        reasonCode: 'verdict_invalid',
        key: 'unparsable'
      });
    }
    if (parsed.stage === 'no_defects') {
      return fail('VERDICT_NO_DEFECTS', {
        stage: 'no_defects',
        reasonCode: 'verdict_invalid',
        key: 'noDefects'
      });
    }
    if (parsed.stage === 'pass_with_defects') {
      return fail('VERDICT_SCHEMA_INVALID', {
        stage: 'pass_with_defects',
        reasonCode: 'verdict_invalid',
        key: 'passWithDefects'
      });
    }
    return fail('VERDICT_SCHEMA_INVALID', {
      stage: 'schema',
      reasonCode: 'verdict_invalid',
      key: 'schemaInvalid'
    });
  }

  // 6. every evidence path is readable (only reached with a valid defect list)
  const evidence = await verifyEvidence(baseDir, parsed.defects, io);
  if (!evidence.ok) {
    return fail('VERDICT_EVIDENCE_UNREADABLE', {
      stage: 'evidence_unreadable',
      reasonCode: 'verdict_invalid',
      key: 'evidenceUnreadable'
    });
  }

  return {
    ok: true,
    verdict: {
      value: parsed.value,
      result: parsed.value,
      defects: evidence.defects,
      defectCount: evidence.defects.length,
      message: parsed.message,
      verdictPath: VERDICT_PATH,
      readAt: new Date(typeof now === 'function' ? now() : Date.now()).toISOString()
    }
  };
}
