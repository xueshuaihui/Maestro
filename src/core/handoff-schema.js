/**
 * Handoff payload validation (iteration-4 D-3 / C-07).
 *
 * Pure field and path checks plus minimal injectable IO. This module never
 * emits events, never mutates instance state and never calls store.save:
 * turning a failed verdict into one CAS rejection is owned by the caller.
 * User-facing wording is reused from status-text.js via handoffInvalidDetail.
 *
 * Dependency direction: node builtins + core/status-text.js only.
 */
import path from 'node:path';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';

import { handoffInvalidDetail } from './status-text.js';

export const CODES = Object.freeze({
  HANDOFF_FIELD_MISSING: 'HANDOFF_FIELD_MISSING',
  HANDOFF_EDGE_INVALID: 'HANDOFF_EDGE_INVALID',
  HANDOFF_EVIDENCE_MISSING: 'HANDOFF_EVIDENCE_MISSING',
  HANDOFF_EVIDENCE_UNREADABLE: 'HANDOFF_EVIDENCE_UNREADABLE',
  HANDOFF_EVIDENCE_EMPTY: 'HANDOFF_EVIDENCE_EMPTY',
  HANDOFF_EVIDENCE_ESCAPE: 'HANDOFF_EVIDENCE_ESCAPE',
  HANDOFF_HASH_MISMATCH: 'HANDOFF_HASH_MISMATCH',
  HANDOFF_BACKFLOW_INCOMPLETE: 'HANDOFF_BACKFLOW_INCOMPLETE'
});

const EDGE_KINDS = new Set(['forward', 'backflow', 'retest']);
const WORKSPACE_POLICIES = new Set(['fixed-workspace', 'versioned-doc']);
const LINE_SUFFIX_RE = /#L\d+(?:-L\d+)?$/;

/** Default IO: promises-based fs subset, replaceable through the `fs` option. */
const defaultIo = Object.freeze({
  stat: (p) => fsp.stat(p),
  realpath: (p) => fsp.realpath(p),
  readFile: (p) => fsp.readFile(p)
});

function ok(extra = {}) {
  return { ok: true, ...extra };
}

/** Machine-readable code plus a displayable detail, both kept in one result. */
function failure(code, params) {
  return { ok: false, code, params, detail: handoffInvalidDetail(code, params) };
}

function idOf(handoff) {
  return typeof handoff?.handoffId === 'string' ? handoff.handoffId : '';
}

/** Strip a trailing #L<n> or #L<n>-L<m> marker (defect evidence only). */
export function stripLineSuffix(ref) {
  return typeof ref === 'string' ? ref.replace(LINE_SUFFIX_RE, '') : ref;
}

/** Collect raw evidence references; suffix stripping happens later, per source. */
export function evidenceRefsOf(handoff) {
  const refs = [];
  const ar = handoff?.artifactRefs;
  if (ar && typeof ar === 'object' && !Array.isArray(ar)) {
    const input = Array.isArray(ar.input) ? ar.input : [];
    input.forEach((ref, index) => {
      if (typeof ref === 'string' && ref.length > 0) {
        refs.push({ source: 'input', ref, index });
      }
    });
    const prev = ar.previous;
    if (prev && typeof prev === 'object' && typeof prev.ref === 'string' && prev.ref.length > 0) {
      refs.push({
        source: 'previous',
        ref: prev.ref,
        index: 0,
        sha256: typeof prev.sha256 === 'string' ? prev.sha256 : null
      });
    }
  }
  if (Array.isArray(handoff?.defects)) {
    handoff.defects.forEach((defect, index) => {
      if (defect && typeof defect.evidence === 'string' && defect.evidence.length > 0) {
        refs.push({ source: 'defect', ref: defect.evidence, index });
      }
    });
  }
  return refs;
}

/** Defect evidence joins the evidence set only for a backflow edge (D-3.2.4). */
function activeRefs(handoff) {
  const all = evidenceRefsOf(handoff);
  return handoff?.edge?.kind === 'backflow'
    ? all
    : all.filter((item) => item.source !== 'defect');
}

/** Resolve the artifact policy of the source node; never keyed by graph id. */
function artifactPolicyOf(sourceNode, graph) {
  let def = sourceNode;
  if (typeof sourceNode === 'string' && Array.isArray(graph?.nodes)) {
    def = graph.nodes.find((node) => node && (node.id === sourceNode || node.nodeId === sourceNode)) ?? null;
  }
  return def && typeof def === 'object' ? (def.artifactPolicy ?? null) : null;
}

function isWithin(root, target) {
  if (!root || !target) return false;
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * Resolve one evidence reference to an absolute path (pure, no IO).
 *
 * C-07 order:
 *   1. absolute -> must sit under workspaceDir or task dir (cwd);
 *   2. artifacts/ prefix -> workspace relative;
 *   3. otherwise -> relative to the source node artifact policy:
 *      fixed-workspace / versioned-doc -> workspace, else task dir.
 * Any resolution outside the allowed roots (including `..` traversal) is an escape.
 */
export function resolveEvidenceRef(ref, { workspaceDir, cwd, sourceNode, graph } = {}) {
  const ws = workspaceDir ? path.resolve(workspaceDir) : null;
  const task = cwd ? path.resolve(cwd) : null;
  if (typeof ref !== 'string' || ref.length === 0) {
    return { ok: false, code: CODES.HANDOFF_EVIDENCE_ESCAPE, params: { ref } };
  }

  let candidate;
  let allowedRoots;
  let via;
  let policy = null;

  if (path.isAbsolute(ref)) {
    candidate = path.resolve(ref);
    allowedRoots = [ws, task].filter(Boolean);
    via = 'absolute';
  } else {
    policy = artifactPolicyOf(sourceNode, graph);
    let base;
    if (/^artifacts[/\\]/.test(ref)) {
      base = ws;
      via = 'artifacts';
    } else {
      base = WORKSPACE_POLICIES.has(policy) ? ws : task;
      via = 'policy';
    }
    if (!base) {
      return { ok: false, code: CODES.HANDOFF_EVIDENCE_ESCAPE, params: { ref } };
    }
    candidate = path.resolve(base, ref);
    allowedRoots = [base];
  }

  if (!allowedRoots.some((root) => isWithin(root, candidate))) {
    return { ok: false, code: CODES.HANDOFF_EVIDENCE_ESCAPE, params: { ref } };
  }
  return { ok: true, path: candidate, allowedRoots, via, policy };
}

/** Pure checks for D-3.2 steps 1-4: fields, edge/target, evidence set. */
export function validateHandoffFields(handoff, { graph } = {}) {
  void graph;
  const edge = handoff?.edge;
  if (edge === null || edge === undefined) return ok({ skipped: true });
  const id = idOf(handoff);

  for (const field of ['handoffId', 'instanceId', 'fromNodeId', 'toNodeId']) {
    if (typeof handoff?.[field] !== 'string' || handoff[field].length === 0) {
      return failure(CODES.HANDOFF_FIELD_MISSING, { id, field });
    }
  }
  if (!Number.isInteger(handoff?.round) || handoff.round <= 0) {
    return failure(CODES.HANDOFF_FIELD_MISSING, { id, field: 'round' });
  }
  if (handoff?.createdAt === undefined || handoff?.createdAt === null || handoff?.createdAt === '') {
    return failure(CODES.HANDOFF_FIELD_MISSING, { id, field: 'createdAt' });
  }

  if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
    return failure(CODES.HANDOFF_EDGE_INVALID, { id });
  }
  if (!EDGE_KINDS.has(edge.kind)) {
    return failure(CODES.HANDOFF_EDGE_INVALID, { id });
  }
  if (typeof handoff.createdAt !== 'string' || !Number.isFinite(Date.parse(handoff.createdAt))) {
    return failure(CODES.HANDOFF_EDGE_INVALID, { id });
  }
  if (handoff.fromNodeId !== edge.from || handoff.toNodeId !== edge.to) {
    return failure(CODES.HANDOFF_EDGE_INVALID, { id });
  }

  const ar = handoff?.artifactRefs;
  if (!ar || typeof ar !== 'object' || Array.isArray(ar)) {
    return failure(CODES.HANDOFF_FIELD_MISSING, { id, field: 'artifactRefs' });
  }
  if (ar.input !== undefined && !Array.isArray(ar.input)) {
    return failure(CODES.HANDOFF_FIELD_MISSING, { id, field: 'artifactRefs.input' });
  }
  if (activeRefs(handoff).length === 0) {
    return failure(CODES.HANDOFF_EVIDENCE_MISSING, { id, field: 'evidence', ref: '' });
  }
  return ok();
}

async function defaultSha256Of(filePath, io) {
  const buf = await io.readFile(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * D-3.2 step 5: per-reference resolution + stat + realpath + hash.
 * `fs` and `sha256Of` are injectable; no file is ever written.
 */
export async function validateHandoffEvidence(
  handoff,
  { workspaceDir, cwd, sourceNode, graph, fs, sha256Of } = {}
) {
  const edge = handoff?.edge;
  if (edge === null || edge === undefined) return ok({ skipped: true });
  const io = fs ?? defaultIo;
  const hashOf = sha256Of ?? ((p) => defaultSha256Of(p, io));
  const id = idOf(handoff);
  const refs = activeRefs(handoff);
  if (refs.length === 0) {
    return failure(CODES.HANDOFF_EVIDENCE_MISSING, { id, field: 'evidence', ref: '' });
  }

  for (const item of refs) {
    const target = item.source === 'defect' ? stripLineSuffix(item.ref) : item.ref;
    const resolved = resolveEvidenceRef(target, { workspaceDir, cwd, sourceNode, graph });
    if (!resolved.ok) {
      return failure(CODES.HANDOFF_EVIDENCE_ESCAPE, { id, ref: item.ref });
    }

    let stat;
    try {
      stat = await io.stat(resolved.path);
    } catch {
      return failure(CODES.HANDOFF_EVIDENCE_UNREADABLE, { id, ref: item.ref });
    }
    if (!stat || typeof stat.isFile !== 'function' || !stat.isFile()) {
      return failure(CODES.HANDOFF_EVIDENCE_UNREADABLE, { id, ref: item.ref });
    }
    if (!(stat.size > 0)) {
      return failure(CODES.HANDOFF_EVIDENCE_EMPTY, { id, ref: item.ref });
    }

    // Symlink escape: compare the real path against the real resolved roots.
    if (typeof io.realpath === 'function') {
      let real;
      try {
        real = await io.realpath(resolved.path);
      } catch {
        return failure(CODES.HANDOFF_EVIDENCE_UNREADABLE, { id, ref: item.ref });
      }
      const realRoots = await Promise.all(
        resolved.allowedRoots.map((root) => io.realpath(root).catch(() => root))
      );
      if (!realRoots.some((root) => isWithin(root, real))) {
        return failure(CODES.HANDOFF_EVIDENCE_ESCAPE, { id, ref: item.ref });
      }
    }

    if (item.source === 'previous' && typeof item.sha256 === 'string' && item.sha256.length > 0) {
      let digest;
      try {
        digest = await hashOf(resolved.path);
      } catch {
        return failure(CODES.HANDOFF_EVIDENCE_UNREADABLE, { id, ref: item.ref });
      }
      if (String(digest).toLowerCase() !== item.sha256.toLowerCase()) {
        return failure(CODES.HANDOFF_HASH_MISMATCH, { id, ref: item.ref });
      }
    }
  }
  return ok();
}

/** D-3.2 step 6: backflow completeness, checked last. */
function validateBackflow(handoff) {
  if (handoff?.edge?.kind !== 'backflow') return ok();
  const id = idOf(handoff);
  const defects = handoff?.defects;
  if (!Array.isArray(defects) || defects.length === 0) {
    return failure(CODES.HANDOFF_BACKFLOW_INCOMPLETE, { id, field: 'defects' });
  }
  for (const defect of defects) {
    if (!defect || typeof defect.summary !== 'string' || defect.summary.length === 0 ||
        typeof defect.evidence !== 'string' || defect.evidence.length === 0) {
      return failure(CODES.HANDOFF_BACKFLOW_INCOMPLETE, { id, field: 'defect.summary/evidence' });
    }
  }
  const rev = handoff?.revisionRequirement;
  const retest = handoff?.retestRequirement;
  const hasRequirement =
    (typeof rev === 'string' && rev.length > 0) ||
    (typeof retest === 'string' && retest.length > 0);
  if (!hasRequirement) {
    return failure(CODES.HANDOFF_BACKFLOW_INCOMPLETE, { id, field: 'requirements' });
  }
  return ok();
}

/** Fixed order: fields -> edge/target -> evidence -> backflow completeness. */
export async function validateHandoff(handoff, opts = {}) {
  const fields = validateHandoffFields(handoff, opts);
  if (!fields.ok || fields.skipped) return fields;
  const evidence = await validateHandoffEvidence(handoff, opts);
  if (!evidence.ok) return evidence;
  const backflow = validateBackflow(handoff);
  if (!backflow.ok) return backflow;
  return ok();
}
