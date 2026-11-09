/**
 * Code artifact isolation (I1.7).
 *
 * Every role whose `artifact_type === 'code'` edits inside its own local git
 * worktree (`<workspace>/worktrees/<roleId>`, branch `maestro/<instanceId>/<roleId>`)
 * so two roles never touch the same working tree. The core owns the merge order:
 * a single `createMergeQueue()` drains worktrees one after another into the
 * integration line (`maestro/<instanceId>/integration`), never concurrently.
 *
 * A merge that conflicts, or a worktree that cannot be created, is rolled back
 * (`git merge --abort` keeps both worktrees and branches intact) and escalated
 * through the existing escalation channel with a `reasonCode` of
 * `merge_conflict` / `merge_aborted` / `worktree_init_failed`.
 *
 * This module deliberately stays literal-free (no role/graph names) and carries
 * no display text: callers render the reason codes through `src/cli/labels.js`.
 * It also never writes orchestrator state directly — `branch` / `mergeStatus`
 * are projected back through the injected `applyStateChange` callback.
 */
import fsPromises from 'node:fs/promises';
import nodePath from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

import { buildEscalation } from './escalation.js';

/**
 * Default command runner. Resolves (never rejects) with the real exit code so the
 * callers can branch on it instead of catching. Injected `execa` must match this
 * shape: `(file, args, { cwd }) => Promise<{exitCode, stdout, stderr}>`.
 */
const defaultExec = (file, args, { cwd = null } = {}) =>
  new Promise((resolve) => {
    execFile(file, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({ exitCode, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });

/**
 * Make `<workspace>` a git repository (idempotent). A fresh repo gets an initial
 * empty commit plus a repo-local identity, because `git worktree add -b` needs a
 * HEAD to branch from and later merges would otherwise prompt for an author.
 *
 * @param {string} workspaceDir
 * @param {{fs?:object, execa?:Function}} [options]
 * @returns {Promise<{ok:true, created:boolean}|{ok:false, code:string, cause?:string}>}
 */
export async function ensureGitRepo(workspaceDir, { fs: io = fsPromises, execa = defaultExec } = {}) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return { ok: false, code: 'WORKSPACE_MISSING' };
  }
  await io.mkdir(workspaceDir, { recursive: true });

  const gitDir = nodePath.join(workspaceDir, '.git');
  let hasRepo = false;
  try {
    const stat = await io.stat(gitDir);
    hasRepo = stat.isDirectory();
  } catch {
    hasRepo = false;
  }
  if (hasRepo) return { ok: true, created: false };

  const init = await execa('git', ['init'], { cwd: workspaceDir });
  if (init.exitCode !== 0) {
    return { ok: false, code: 'GIT_INIT_FAILED', cause: init.stderr || init.stdout };
  }

  // Repo-local identity: keeps `commit` and `merge` from ever blocking on input.
  await execa('git', ['config', 'user.email', 'maestro@local'], { cwd: workspaceDir });
  await execa('git', ['config', 'user.name', 'maestro'], { cwd: workspaceDir });

  // The worktree area lives inside this repo; ignore it so checkouts stay clean.
  const ignorePath = nodePath.join(workspaceDir, '.gitignore');
  try {
    await io.writeFile(ignorePath, 'worktrees/\n', 'utf8');
  } catch {
    // A missing ignore file is not fatal: the worktree area stays untracked.
  }

  const commit = await execa('git', ['commit', '--allow-empty', '-m', 'maestro: init'], {
    cwd: workspaceDir,
  });
  if (commit.exitCode !== 0) {
    return { ok: false, code: 'GIT_INIT_FAILED', cause: commit.stderr || commit.stdout };
  }
  return { ok: true, created: true };
}

/**
 * Create the per-role worktree and its branch, or fail with `WORKTREE_INIT_FAILED`
 * (branch already taken, permissions, a repo without HEAD, …).
 *
 * @param {{workspaceDir:string, instanceId:string, roleId:string, fs?:object, execa?:Function}} options
 * @returns {Promise<{ok:true, branch:string, worktreeDir:string}
 *   |{ok:false, code:'WORKTREE_INIT_FAILED', cause:string}
 *   |{ok:false, code:'WORKSPACE_MISSING'}>}
 */
export async function createWorktree({
  workspaceDir,
  instanceId,
  roleId,
  fs: io = fsPromises,
  execa = defaultExec,
} = {}) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return { ok: false, code: 'WORKSPACE_MISSING' };
  }
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, code: 'WORKTREE_INIT_FAILED', cause: 'instanceId missing' };
  }
  if (typeof roleId !== 'string' || roleId.length === 0) {
    return { ok: false, code: 'WORKTREE_INIT_FAILED', cause: 'roleId missing' };
  }

  const branch = `maestro/${instanceId}/${roleId}`;
  const worktreeDir = nodePath.join(workspaceDir, 'worktrees', roleId);

  // Idempotent: a present `.git` returns immediately, so this only bootstraps
  // the repo when the caller (workspace preparation) has not done it yet.
  const ensured = await ensureGitRepo(workspaceDir, { fs: io, execa });
  if (!ensured.ok) {
    return { ok: false, code: 'WORKTREE_INIT_FAILED', cause: ensured.cause ?? ensured.code };
  }

  await io.mkdir(nodePath.join(workspaceDir, 'worktrees'), { recursive: true });
  const res = await execa('git', ['worktree', 'add', worktreeDir, '-b', branch], {
    cwd: workspaceDir,
  });
  if (res.exitCode !== 0) {
    return { ok: false, code: 'WORKTREE_INIT_FAILED', cause: res.stderr || res.stdout };
  }
  return { ok: true, branch, worktreeDir };
}

/**
 * Unmerged paths after a merge attempt (empty list means "no conflict").
 *
 * @param {{workspaceDir:string}} options
 * @returns {{conflict:boolean, paths:string[]}}
 */
export function detectConflict({ workspaceDir } = {}) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return { conflict: false, paths: [] };
  }
  try {
    const stdout = execFileSync('git', ['diff', '--name-only', '--diff-filter=U'], {
      cwd: workspaceDir,
      encoding: 'utf8',
    });
    const paths = String(stdout)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return { conflict: paths.length > 0, paths };
  } catch {
    return { conflict: false, paths: [] };
  }
}

/**
 * Merge one role branch into the integration line. The main worktree is switched
 * onto the integration branch (created on first use) so the merge commit lives on
 * `maestro/<instanceId>/integration`.
 *
 * @param {{workspaceDir:string, instanceId:string, roleId:string, fs?:object, execa?:Function}} options
 * @returns {Promise<{ok:true, merged:boolean}
 *   |{ok:false, code:'MERGE_CONFLICT'|'MERGE_ABORTED', conflictPaths:string[]}>}
 */
export async function mergeIntoIntegration({
  workspaceDir,
  instanceId,
  roleId,
  fs: io = fsPromises,
  execa = defaultExec,
} = {}) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return { ok: false, code: 'MERGE_ABORTED', conflictPaths: [] };
  }
  if (typeof instanceId !== 'string' || instanceId.length === 0) {
    return { ok: false, code: 'MERGE_ABORTED', conflictPaths: [] };
  }
  if (typeof roleId !== 'string' || roleId.length === 0) {
    return { ok: false, code: 'MERGE_ABORTED', conflictPaths: [] };
  }

  const branch = `maestro/${instanceId}/${roleId}`;
  const integration = `maestro/${instanceId}/integration`;

  const listed = await execa('git', ['branch', '--list', integration], { cwd: workspaceDir });
  const exists = listed.exitCode === 0 && listed.stdout.trim().length > 0;
  const checkout = exists
    ? await execa('git', ['checkout', integration], { cwd: workspaceDir })
    : await execa('git', ['checkout', '-b', integration], { cwd: workspaceDir });
  if (checkout.exitCode !== 0) {
    return { ok: false, code: 'MERGE_ABORTED', conflictPaths: [] };
  }

  const merged = await execa('git', ['merge', '--no-ff', '--no-edit', branch], {
    cwd: workspaceDir,
  });
  if (merged.exitCode === 0) return { ok: true, merged: true };

  const conflict = detectConflict({ workspaceDir });
  if (conflict.conflict) {
    return { ok: false, code: 'MERGE_CONFLICT', conflictPaths: conflict.paths };
  }
  return { ok: false, code: 'MERGE_ABORTED', conflictPaths: conflict.paths };
}

/**
 * Roll back a half-made merge. Both role worktrees and their branches survive, so
 * the user can resolve the conflict and re-run the merge.
 *
 * @param {{workspaceDir:string, execa?:Function}} options
 * @returns {Promise<{ok:true}|{ok:false, code:string, cause?:string}>}
 */
export async function abortMerge({ workspaceDir, execa = defaultExec } = {}) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) {
    return { ok: false, code: 'MERGE_ABORT_FAILED' };
  }
  const res = await execa('git', ['merge', '--abort'], { cwd: workspaceDir });
  if (res.exitCode !== 0) {
    return { ok: false, code: 'MERGE_ABORT_FAILED', cause: res.stderr || res.stdout };
  }
  return { ok: true };
}

/**
 * Build (never persist) the escalation entry for a merge/worktree failure. The
 * shape matches `src/core/escalation.js#buildEscalation`, so `commitEscalation`
 * accepts it unchanged.
 *
 * @param {{nodeId?:string|null, round?:number, reasonCode?:string,
 *          reasonDetail?:string, defects?:object[], escalations?:object[], now?:Function}} [options]
 * @returns {object}
 */
export function buildMergeEscalation({
  nodeId = null,
  round = 1,
  reasonCode = 'merge_conflict',
  reasonDetail = '',
  defects = [],
  escalations = [],
  now = Date.now,
} = {}) {
  const allowed = ['merge_conflict', 'worktree_init_failed', 'merge_aborted'];
  const code = allowed.includes(reasonCode) ? reasonCode : 'merge_conflict';
  return buildEscalation({
    escalations,
    nodeId,
    round,
    reasonCode: code,
    reasonDetail,
    defects,
    now,
  });
}

/**
 * The core-managed merge queue. `enqueue` returns a promise that settles when
 * that node's merge attempt is done; calls are chained, so two enqueues never
 * merge concurrently (a later one waits for the earlier one to finish or escalate).
 *
 * Lifecycle written back through `applyStateChange({nodeId, branch, mergeStatus})`:
 *   pending -> merging -> merged   (success)
 *   pending -> merging -> conflict (conflict/aborted; half-merge rolled back)
 *
 * @param {{commitEscalation?:Function, getState?:Function, applyStateChange?:Function,
 *          fs?:object, execa?:Function}} [options]
 * @returns {{enqueue:Function, reprocess:Function, size:Function}}
 */
export function createMergeQueue({
  commitEscalation = null,
  getState = null,
  applyStateChange = null,
  fs: io = fsPromises,
  execa = defaultExec,
} = {}) {
  const processed = new Map();
  let tail = Promise.resolve();
  let outstanding = 0;

  const applyChange = (change) => {
    if (typeof applyStateChange !== 'function') return;
    try {
      applyStateChange(change);
    } catch {
      // Projecting state back never breaks the queue.
    }
  };

  const branchOf = (ref) => `maestro/${ref.instanceId}/${ref.roleId}`;

  const normalize = (ref = {}) => ({
    nodeId: ref.nodeId ?? null,
    instanceId: ref.instanceId ?? null,
    roleId: ref.roleId ?? null,
    round: Number.isInteger(ref.round) ? ref.round : 1,
    workspaceDir: ref.workspaceDir ?? null,
  });

  async function processOnce(ref) {
    const branch = branchOf(ref);
    applyChange({ nodeId: ref.nodeId, branch, mergeStatus: 'merging' });

    let result;
    try {
      result = await mergeIntoIntegration({
        workspaceDir: ref.workspaceDir,
        instanceId: ref.instanceId,
        roleId: ref.roleId,
        fs: io,
        execa,
      });
    } catch {
      result = { ok: false, code: 'MERGE_ABORTED', conflictPaths: [] };
    }

    if (result.ok) {
      applyChange({ nodeId: ref.nodeId, branch, mergeStatus: 'merged' });
      return { ok: true, nodeId: ref.nodeId, mergeStatus: 'merged' };
    }

    const reasonCode = result.code === 'MERGE_CONFLICT' ? 'merge_conflict' : 'merge_aborted';

    // Roll back the half-made merge; the two worktrees and branches stay put.
    try {
      await abortMerge({ workspaceDir: ref.workspaceDir, execa });
    } catch {
      // Nothing to roll back (the merge never started) — still escalate below.
    }
    applyChange({ nodeId: ref.nodeId, branch, mergeStatus: 'conflict' });

    const escalation = buildMergeEscalation({
      nodeId: ref.nodeId,
      round: ref.round,
      reasonCode,
      reasonDetail: Array.isArray(result.conflictPaths) ? result.conflictPaths.join(', ') : '',
    });

    let escalationId = null;
    if (typeof commitEscalation === 'function') {
      const committed = await commitEscalation({ instanceId: ref.instanceId, escalation });
      escalationId = committed?.escalationId ?? escalation?.escalationId ?? null;
    }
    if (escalationId) processed.set(escalationId, { ...ref });

    return {
      ok: false,
      code: reasonCode,
      escalationId,
      nodeId: ref.nodeId,
      mergeStatus: 'conflict',
    };
  }

  // Strict serialisation: each attempt is chained on the previous one, so the
  // core never issues two merges at once (no concurrent merge).
  function schedule(ref) {
    outstanding += 1;
    const run = tail.then(() => processOnce(ref));
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run.finally(() => {
      outstanding -= 1;
    });
  }

  return {
    enqueue(ref) {
      const normalized = normalize(ref);
      applyChange({
        nodeId: normalized.nodeId,
        branch: branchOf(normalized),
        mergeStatus: 'pending',
      });
      return schedule(normalized);
    },
    reprocess(escalationId) {
      const ref = processed.get(escalationId);
      if (!ref) return Promise.resolve({ ok: false, code: 'ESCALATION_NOT_FOUND' });
      processed.delete(escalationId);
      // `getState` is accepted for the caller's convenience; the queue keeps the
      // node reference it stored at enqueue time, so it never re-reads stale state.
      void getState;
      return schedule({ ...ref });
    },
    size() {
      return outstanding;
    },
  };
}
