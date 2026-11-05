/**
 * Review-file validator for the single-document loop (requirement D-7).
 *
 * Fixed path: `<cwd>/out/review.json`. The file is the only authority — the agent's
 * chat text is never inspected. Eleven steps, checked in this order, first hit wins:
 *
 *   1 missing -> 2 stale -> 3 unreadable -> 4 unparsable -> 5 schema ->
 *   6 decision -> 7 artifact present -> 8 artifact matches this round ->
 *   9 decision/defect consistency -> 10 defect shape -> 11 evidence readable
 *
 * Only four fields are read: `decision` / `artifact` / `defects` / `revisionRequirement`.
 * Unknown fields are ignored (C-05); an invalid defect list invalidates the whole file
 * (no partial defects are ever returned); evidence is only `stat`-ed, never read.
 * Nothing is written here — the caller decides whether to escalate (same contract as
 * `verdict.js`).
 */
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_REVISION_REQUIREMENT, REVIEW_TEXT } from '../cli/labels.js';

export const REVIEW_PATH = 'out/review.json';

const defaultNow = () => Date.now();

/** `#L<n>` (and `#L<n>-<m>`) suffixes are line hints, not part of the path (B-07). */
const LINE_SUFFIX = /#L\d+(?:-L?\d+)?$/;

const DRIVE_LETTER = /^[A-Za-z]:/;

function detailOf(key, vars = null) {
  const raw = REVIEW_TEXT[key] ?? '';
  const body = vars
    ? raw.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined || vars[name] === null ? '' : String(vars[name])))
    : raw;
  return `${REVIEW_TEXT.prefix}${body}`;
}

function fail(code, { stage, reasonCode, key, vars = null, extra = {} }) {
  const message = detailOf(key, vars);
  return {
    ok: false,
    code,
    stage,
    reasonCode,
    reasonDetail: message,
    reviewPath: REVIEW_PATH,
    detail: { stage, reasonCode, message, ...extra }
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

const unparsable = (stage = 'unparsable', extra = {}) =>
  fail('REVIEW_UNPARSABLE', {
    stage,
    reasonCode: 'review_invalid',
    key: 'unparsable',
    extra
  });

const schemaInvalid = (stage = 'schema') =>
  fail('REVIEW_SCHEMA_INVALID', { stage, reasonCode: 'review_invalid', key: 'unparsable' });

/**
 * Shape-check a parsed review document (steps 4-7, 9, 10).
 *
 * @param {string} rawText
 * @param {{expectedArtifact?:string|null}} [options] when given, step 8 runs here so the
 *   1→11 order is preserved exactly (a mismatch is reported before a defect-shape error)
 * @returns {{ok:true, review:{decision:'pass'|'reject', artifact:string, defects:Array,
 *   defectCount:number, revisionRequirement:string}}
 *   |{ok:false, code:string, stage:string, reasonCode:string, reasonDetail:string,
 *      reviewPath:string, detail:object}}
 */
export function parseReview(rawText, { expectedArtifact = null } = {}) {
  // 4. JSON.parse
  const parsed = parseJson(rawText);
  if (!parsed.ok) return unparsable('unparsable');

  // 5. top level is a non-array object
  const document = parsed.value;
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return schemaInvalid('schema');
  }

  // 6. decision is strictly pass or reject
  const decision = document.decision;
  if (decision !== 'pass' && decision !== 'reject') {
    return fail('REVIEW_DECISION_INVALID', {
      stage: 'decision',
      reasonCode: 'review_invalid',
      key: 'decisionInvalid'
    });
  }

  // 7. artifact is a non-empty string
  const artifact = typeof document.artifact === 'string' ? document.artifact.trim() : '';
  if (artifact.length === 0) {
    return fail('REVIEW_ARTIFACT_MISSING', {
      stage: 'artifact_missing',
      reasonCode: 'review_artifact_missing',
      key: 'artifactMissing'
    });
  }

  // `defects` must be an array when present; absent means empty.
  if (document.defects !== undefined && document.defects !== null && !Array.isArray(document.defects)) {
    return schemaInvalid('schema');
  }
  const defects = Array.isArray(document.defects) ? document.defects : [];

  // 8. the review must point at this round's document
  const expected = typeof expectedArtifact === 'string' ? expectedArtifact.trim() : '';
  if (expected.length > 0 && artifact !== expected) {
    return fail('REVIEW_ARTIFACT_MISMATCH', {
      stage: 'artifact_mismatch',
      reasonCode: 'review_artifact_mismatch',
      key: 'artifactMismatch',
      vars: { artifact }
    });
  }

  // 9. decision / defect-count consistency
  if (decision === 'pass' && defects.length > 0) {
    return fail('REVIEW_PASS_WITH_DEFECTS', {
      stage: 'pass_with_defects',
      reasonCode: 'review_pass_with_defects',
      key: 'passWithDefects'
    });
  }
  if (decision === 'reject' && defects.length === 0) {
    return fail('REVIEW_REJECT_NO_DEFECTS', {
      stage: 'reject_no_defects',
      reasonCode: 'review_reject_no_defects',
      key: 'rejectNoDefects'
    });
  }

  // 10. every defect carries a non-empty summary and evidence
  const shaped = [];
  for (const defect of defects) {
    if (defect === null || typeof defect !== 'object' || Array.isArray(defect)) {
      return fail('REVIEW_DEFECT_SHAPE', {
        stage: 'defect_shape',
        reasonCode: 'review_defect_shape',
        key: 'defectShape'
      });
    }
    const summary = typeof defect.summary === 'string' ? defect.summary.trim() : '';
    const evidence = typeof defect.evidence === 'string' ? defect.evidence.trim() : '';
    if (summary.length === 0 || evidence.length === 0) {
      return fail('REVIEW_DEFECT_SHAPE', {
        stage: 'defect_shape',
        reasonCode: 'review_defect_shape',
        key: 'defectShape'
      });
    }
    shaped.push({ summary, evidence });
  }

  const requirement =
    typeof document.revisionRequirement === 'string' ? document.revisionRequirement.trim() : '';

  return {
    ok: true,
    review: {
      decision,
      artifact,
      defects: shaped,
      defectCount: shaped.length,
      revisionRequirement: requirement.length > 0 ? requirement : DEFAULT_REVISION_REQUIREMENT
    }
  };
}

/** Strip the `#L<n>` hint and decide whether the remainder may point inside the workspace. */
function evidenceToRef(raw) {
  const trimmed = String(raw ?? '').trim().replace(LINE_SUFFIX, '');
  if (trimmed.length === 0) return null;
  if (path.isAbsolute(trimmed) || path.win32.isAbsolute(trimmed) || DRIVE_LETTER.test(trimmed)) {
    return null;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  const segments = normalized.split('/').filter((segment) => segment.length > 0 && segment !== '.');
  if (segments.length === 0) return null;
  if (segments.some((segment) => segment === '..')) return null;
  return segments.join('/');
}

/**
 * Verify every defect's evidence path under `workspaceDir` (step 11). Only `stat`.
 * @returns {Promise<{ok:true}|{ok:false, raw:string}>}
 */
async function verifyEvidence(baseDir, defects, io) {
  for (const defect of defects) {
    const ref = evidenceToRef(defect.evidence);
    if (ref === null) return { ok: false, raw: defect.evidence };
    const absPath = path.resolve(baseDir, ref);
    let stat;
    try {
      stat = asStat(await io.stat(absPath));
    } catch {
      stat = null;
    }
    if (stat === null || !(stat.size > 0)) return { ok: false, raw: defect.evidence };
  }
  return { ok: true };
}

/**
 * @param {{cwd?:string|null, workspaceDir?:string|null, expectedArtifact?:string|null,
 *          roundStartedAt?:string|number|null, fs?:object, now?:Function}} options
 * @returns {Promise<{ok:true, review:{decision:string, artifact:string, defects:Array,
 *   defectCount:number, revisionRequirement:string, reviewPath:string, readAt:string}}
 *   |{ok:false, code:string, stage:string, reasonCode:string, reasonDetail:string,
 *      reviewPath:string, detail:object}>}
 */
export async function readReview({
  cwd = null,
  workspaceDir = null,
  expectedArtifact = null,
  roundStartedAt = null,
  fs = fsPromises,
  now = defaultNow
} = {}) {
  const io = fs ?? fsPromises;
  const baseDir = path.resolve(cwd ?? '.');
  const absPath = path.join(baseDir, REVIEW_PATH);

  // 1. existence
  let stat;
  try {
    stat = asStat(await io.stat(absPath));
  } catch {
    stat = null;
  }
  if (stat === null) {
    return fail('REVIEW_MISSING', {
      stage: 'missing',
      reasonCode: 'review_missing',
      key: 'missing'
    });
  }

  // 2. written by this round
  const startedMs = startedAtMs(roundStartedAt);
  if (startedMs !== null && stat.mtimeMs < startedMs) {
    return fail('REVIEW_STALE', {
      stage: 'stale',
      reasonCode: 'review_stale',
      key: 'stale'
    });
  }

  // 3. readable
  let text;
  try {
    text = await io.readFile(absPath, 'utf8');
  } catch {
    return unparsable('unreadable');
  }

  // 4-10 (including step 8 when `expectedArtifact` is supplied)
  const parsed = parseReview(text, { expectedArtifact });
  if (!parsed.ok) return parsed;

  // 11. evidence paths resolve inside the workspace
  const evidenceDir = path.resolve(workspaceDir ?? cwd ?? '.');
  const evidence = await verifyEvidence(evidenceDir, parsed.review.defects, io);
  if (!evidence.ok) {
    return fail('REVIEW_EVIDENCE_UNREADABLE', {
      stage: 'evidence_unreadable',
      reasonCode: 'review_evidence_unreadable',
      key: 'evidenceUnreadable',
      vars: { evidence: evidence.raw }
    });
  }

  return {
    ok: true,
    review: {
      decision: parsed.review.decision,
      artifact: parsed.review.artifact,
      defects: parsed.review.defects,
      defectCount: parsed.review.defectCount,
      revisionRequirement: parsed.review.revisionRequirement,
      reviewPath: REVIEW_PATH,
      readAt: new Date(typeof now === 'function' ? now() : Date.now()).toISOString()
    }
  };
}
