import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import * as paths from '../../src/persistence/paths.js';

// 纯内存路径形状断言，不触碰磁盘。root 仅作字符串参与 path.join，无需真实存在。
const ROOT = '/tmp/maestro-i17-paths-root';
const ID = 'INST-001';
const ROLE = 'developer';

test('instanceCodeWorktreeDir 返回 <workspace>/worktrees/<roleId>', () => {
  const workspace = paths.instanceWorkspaceDir(ROOT, ID);
  const expected = path.join(workspace, 'worktrees', ROLE);
  assert.equal(paths.instanceCodeWorktreeDir(ROOT, ID, ROLE), expected);
  // 组成段逐字正确：末尾为 worktrees/<roleId>，其父为 workspace。
  assert.equal(path.basename(paths.instanceCodeWorktreeDir(ROOT, ID, ROLE)), ROLE);
  assert.equal(
    path.dirname(paths.instanceCodeWorktreeDir(ROOT, ID, ROLE)),
    path.join(workspace, 'worktrees'),
  );
});

test('instanceDataDir 返回 <workspace>/artifacts/data', () => {
  const workspace = paths.instanceWorkspaceDir(ROOT, ID);
  const expected = path.join(workspace, 'artifacts', 'data');
  assert.equal(paths.instanceDataDir(ROOT, ID), expected);
  assert.equal(path.basename(paths.instanceDataDir(ROOT, ID)), 'data');
  assert.equal(
    path.dirname(paths.instanceDataDir(ROOT, ID)),
    path.join(workspace, 'artifacts'),
  );
});

test('既有路径函数输出与改动前逐字一致（WP-1 未动既有函数体）', () => {
  const workspace = paths.instanceWorkspaceDir(ROOT, ID);
  assert.equal(paths.instanceWorkspaceDir(ROOT, ID), path.join(paths.instanceDir(ROOT, ID), 'workspace'));
  assert.equal(paths.instanceDocsDir(ROOT, ID), path.join(workspace, 'artifacts', 'docs'));
  assert.equal(paths.instanceReportsDir(ROOT, ID), path.join(workspace, 'artifacts', 'reports'));
  assert.equal(paths.instanceSharedDir(ROOT, ID), path.join(workspace, 'shared'));
});
