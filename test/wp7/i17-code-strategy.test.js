/**
 * I1.7 WP-3 — artifact strategy + role contract.
 *
 * Pure/in-memory: no disk, no git. Covers the new `code` policy on
 * `resolveNodeProducts`, the role-level `artifact_type` override, and the
 * regression guard that the five pre-existing branches keep their semantics.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { resolveNodeProducts } from '../../src/core/doc-artifact.js';
import { ROLES } from '../../src/templates/index.js';
import { instanceCodeWorktreeDir, instanceWorkspaceDir } from '../../src/persistence/paths.js';

const ROOT = path.join('/tmp', 'i17-strategy');
const INSTANCE = 'INST-007';
const WORKSPACE = instanceWorkspaceDir(ROOT, INSTANCE);

test('resolveNodeProducts：artifactPolicy=code 返回 worktree 路径', () => {
  const def = { artifactPolicy: 'code', roleId: 'alpha', products: ['a.py'] };
  const result = resolveNodeProducts(def, {
    node: { roleId: 'alpha' },
    state: { instanceId: INSTANCE },
    workspaceDir: WORKSPACE,
  });

  assert.equal(result.ok, true);
  assert.equal(result.policy, 'code');
  assert.equal(result.baseDir, instanceCodeWorktreeDir(ROOT, INSTANCE, 'alpha'));
  assert.deepEqual(result.products, ['a.py']);
});

test('resolveNodeProducts：角色 artifact_type=code 覆盖节点级 declared（D-3）', () => {
  const def = { artifactPolicy: 'declared', roleId: 'developer', products: [] };
  const result = resolveNodeProducts(def, {
    node: { roleId: 'developer', round: 1 },
    state: { instanceId: INSTANCE },
    workspaceDir: WORKSPACE,
  });

  assert.equal(result.ok, true);
  assert.equal(result.policy, 'code');
  assert.equal(result.baseDir, instanceCodeWorktreeDir(ROOT, INSTANCE, 'developer'));
});

test('resolveNodeProducts：root 优先进 instanceCodeWorktreeDir 单一口径', () => {
  const def = { artifactPolicy: 'code', roleId: 'alpha', products: [] };
  const result = resolveNodeProducts(def, {
    root: ROOT,
    node: { roleId: 'alpha' },
    state: { instanceId: INSTANCE },
    workspaceDir: WORKSPACE,
  });

  assert.equal(result.policy, 'code');
  assert.equal(result.baseDir, instanceCodeWorktreeDir(ROOT, INSTANCE, 'alpha'));
});

test('ROLES.developer 带 artifact_type=code，其余角色不带', () => {
  assert.equal(ROLES.developer.artifact_type, 'code');
  assert.equal(ROLES.tester.artifact_type, undefined);
  assert.equal(ROLES.coordinator.artifact_type, undefined);
  assert.equal(ROLES.researcher.artifact_type, undefined);
  assert.equal(ROLES.writer.artifact_type, undefined);
  assert.equal(ROLES.reviewer.artifact_type, undefined);
});

test('R-6：既有 fixed-workspace / versioned-doc / review 分支语义不变', () => {
  const fixed = resolveNodeProducts(
    { artifactPolicy: 'fixed-workspace', products: ['artifacts/reports/notes.md'] },
    { workspaceDir: WORKSPACE, productPolicy: 'doc-single' }
  );
  assert.equal(fixed.ok, true);
  assert.equal(fixed.policy, 'fixed-workspace');
  assert.equal(fixed.baseDir, WORKSPACE);
  assert.deepEqual(fixed.products, ['artifacts/reports/notes.md']);

  const versioned = resolveNodeProducts(
    { artifactPolicy: 'versioned-doc', artifactDir: 'artifacts/docs', artifactExt: '.md' },
    { node: { round: 1 }, state: { artifactStem: 's' }, workspaceDir: WORKSPACE }
  );
  assert.equal(versioned.ok, true);
  assert.equal(versioned.policy, 'versioned-doc');
  assert.deepEqual(versioned.products, ['artifacts/docs/s.v1.md']);

  const review = resolveNodeProducts(
    { artifactPolicy: 'review', reviewPath: 'out/review.json' },
    { node: { round: 1 } }
  );
  assert.equal(review.ok, false);
  assert.equal(review.code, 'NO_PRODUCTS');
});

test('R-6：declared / heuristic 与非角色节点（worker）语义不变', () => {
  const declared = resolveNodeProducts(
    { artifactPolicy: 'declared', products: ['p.txt'] },
    { cwd: '/c' }
  );
  assert.equal(declared.ok, true);
  assert.equal(declared.policy, 'declared');
  assert.deepEqual(declared.products, ['p.txt']);

  // The single graph declares a `worker` node that is NOT in ROLES: it must keep
  // falling through to `heuristic` exactly as before (no worktree, no override).
  const heuristic = resolveNodeProducts(
    { artifactPolicy: 'heuristic', products: [], roleId: 'worker' },
    { node: { roleId: 'worker' }, workspaceDir: WORKSPACE }
  );
  assert.equal(heuristic.ok, true);
  assert.equal(heuristic.policy, 'heuristic');
  assert.deepEqual(heuristic.products, []);
});
