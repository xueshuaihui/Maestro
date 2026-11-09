/**
 * I1.7 WP-2 — code-isolation (local git worktrees + core-managed merge queue).
 *
 * Every scenario runs against a throwaway repo under the OS temp dir (never the
 * project tree), so the whole file is a pure local-git fixture: no DSH, no remote.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';

import {
  ensureGitRepo,
  createWorktree,
  mergeIntoIntegration,
  detectConflict,
  abortMerge,
  buildMergeEscalation,
  createMergeQueue,
} from '../../src/core/code-isolation.js';

/** Real command runner, same shape as the module's default `execa`. */
const realExec = (file, args, { cwd = null } = {}) =>
  new Promise((resolve) => {
    execFile(file, args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({ exitCode, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });

function gitSync(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

async function tmpWorkspace() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'i17-'));
}

async function commitFile(worktreeDir, name, content) {
  await fs.writeFile(path.join(worktreeDir, name), content, 'utf8');
  gitSync(worktreeDir, ['add', name]);
  gitSync(worktreeDir, ['commit', '-m', `add ${name}`]);
}

test('ensureGitRepo：非仓库初始化为 git 仓库并建初始提交；再次调用幂等', async () => {
  const ws = await tmpWorkspace();

  const first = await ensureGitRepo(ws);
  assert.equal(first.ok, true);
  assert.equal(first.created, true);

  // HEAD must exist, otherwise `git worktree add -b` cannot branch.
  const head = await realExec('git', ['rev-parse', '--verify', 'HEAD'], { cwd: ws });
  assert.equal(head.exitCode, 0);

  const second = await ensureGitRepo(ws);
  assert.equal(second.ok, true);
  assert.equal(second.created, false);
});

test('createWorktree：worktree 目录与 maestro/<instance>/<role> 分支同时就绪', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const res = await createWorktree({ workspaceDir: ws, instanceId: 'INST-001', roleId: 'alpha' });
  assert.equal(res.ok, true);
  assert.equal(res.branch, 'maestro/INST-001/alpha');

  const stat = await fs.stat(res.worktreeDir);
  assert.equal(stat.isDirectory(), true);

  const current = await realExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: res.worktreeDir,
  });
  assert.equal(current.stdout.trim(), 'maestro/INST-001/alpha');
});

test('AC-07：两 worktree 改不同文件，顺序合并后两文件都保留、无覆盖', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const a = await createWorktree({ workspaceDir: ws, instanceId: 'INST-001', roleId: 'alpha' });
  const b = await createWorktree({ workspaceDir: ws, instanceId: 'INST-001', roleId: 'beta' });
  await commitFile(a.worktreeDir, 'a.txt', 'A');
  await commitFile(b.worktreeDir, 'b.txt', 'B');

  const queue = createMergeQueue({});
  const r1 = await queue.enqueue({
    nodeId: 'N1',
    instanceId: 'INST-001',
    roleId: 'alpha',
    workspaceDir: ws,
  });
  const r2 = await queue.enqueue({
    nodeId: 'N2',
    instanceId: 'INST-001',
    roleId: 'beta',
    workspaceDir: ws,
  });

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal((await fs.readFile(path.join(ws, 'a.txt'), 'utf8')).trim(), 'A');
  assert.equal((await fs.readFile(path.join(ws, 'b.txt'), 'utf8')).trim(), 'B');
});

test('AC-08：同文件冲突被检测，abort 回滚半成品合并、两 worktree/分支完整保留', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const a = await createWorktree({ workspaceDir: ws, instanceId: 'INST-002', roleId: 'alpha' });
  const b = await createWorktree({ workspaceDir: ws, instanceId: 'INST-002', roleId: 'beta' });
  await commitFile(a.worktreeDir, 'f.txt', 'AAA');
  await commitFile(b.worktreeDir, 'f.txt', 'BBB');

  const mergedA = await mergeIntoIntegration({
    workspaceDir: ws,
    instanceId: 'INST-002',
    roleId: 'alpha',
  });
  assert.equal(mergedA.ok, true);

  const mergedB = await mergeIntoIntegration({
    workspaceDir: ws,
    instanceId: 'INST-002',
    roleId: 'beta',
  });
  assert.equal(mergedB.ok, false);
  assert.equal(mergedB.code, 'MERGE_CONFLICT');

  const conflict = detectConflict({ workspaceDir: ws });
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.paths.includes('f.txt'), true);

  const aborted = await abortMerge({ workspaceDir: ws });
  assert.equal(aborted.ok, true);

  // The half-made merge is gone: integration keeps only alpha's content.
  assert.equal((await fs.readFile(path.join(ws, 'f.txt'), 'utf8')).trim(), 'AAA');

  // Both worktrees + branches survive, each still holding its own rewrite.
  const list = gitSync(ws, ['worktree', 'list']);
  assert.equal(list.includes('alpha'), true);
  assert.equal(list.includes('beta'), true);
  const branches = gitSync(ws, ['branch', '--list', 'maestro/INST-002/*']);
  assert.equal(branches.includes('maestro/INST-002/alpha'), true);
  assert.equal(branches.includes('maestro/INST-002/beta'), true);
  assert.equal((await fs.readFile(path.join(a.worktreeDir, 'f.txt'), 'utf8')).trim(), 'AAA');
  assert.equal((await fs.readFile(path.join(b.worktreeDir, 'f.txt'), 'utf8')).trim(), 'BBB');
});

test('createMergeQueue：严格顺序、绝不并发合并，branch/mergeStatus 生命周期正确', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const a = await createWorktree({ workspaceDir: ws, instanceId: 'INST-003', roleId: 'alpha' });
  const b = await createWorktree({ workspaceDir: ws, instanceId: 'INST-003', roleId: 'beta' });
  await commitFile(a.worktreeDir, 'a.txt', 'A');
  await commitFile(b.worktreeDir, 'b.txt', 'B');

  const changes = [];
  let active = 0;
  let maxActive = 0;
  const watchedExec = async (file, args, opts) => {
    const isMerge = args[0] === 'merge' && args[1] !== '--abort';
    if (isMerge) {
      active += 1;
      maxActive = Math.max(maxActive, active);
    }
    const res = await realExec(file, args, opts);
    if (isMerge) active -= 1;
    return res;
  };

  const queue = createMergeQueue({
    execa: watchedExec,
    applyStateChange: (change) => changes.push(`${change.nodeId}:${change.mergeStatus}`),
  });

  const p1 = queue.enqueue({
    nodeId: 'N1',
    instanceId: 'INST-003',
    roleId: 'alpha',
    workspaceDir: ws,
  });
  const p2 = queue.enqueue({
    nodeId: 'N2',
    instanceId: 'INST-003',
    roleId: 'beta',
    workspaceDir: ws,
  });
  await Promise.all([p1, p2]);

  assert.equal(maxActive, 1, '两次合并不得并发');
  assert.equal(queue.size(), 0);
  assert.deepEqual(
    changes.filter((entry) => entry.startsWith('N1:')),
    ['N1:pending', 'N1:merging', 'N1:merged']
  );
  assert.deepEqual(
    changes.filter((entry) => entry.startsWith('N2:')),
    ['N2:pending', 'N2:merging', 'N2:merged']
  );
});

test('AC-13：worktree 创建失败 → WORKTREE_INIT_FAILED + worktree_init_failed 升级条目', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const failingExec = async (file, args, opts) => {
    if (args[0] === 'worktree' && args[1] === 'add') {
      return { exitCode: 1, stdout: '', stderr: 'injected worktree failure' };
    }
    return realExec(file, args, opts);
  };

  const res = await createWorktree({
    workspaceDir: ws,
    instanceId: 'INST-004',
    roleId: 'alpha',
    execa: failingExec,
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'WORKTREE_INIT_FAILED');

  const escalation = buildMergeEscalation({
    nodeId: 'N1',
    round: 1,
    reasonCode: 'worktree_init_failed',
    reasonDetail: 'injected',
  });
  assert.equal(escalation.reasonCode, 'worktree_init_failed');
  assert.equal(escalation.state, 'pending');
  assert.equal(typeof escalation.escalationId, 'string');
  assert.deepEqual(escalation.defects, []);
});

test('AC-14：合并异常 → merge_aborted 升级 + mergeStatus conflict；reprocess 后合并成功', async () => {
  const ws = await tmpWorkspace();
  await ensureGitRepo(ws);

  const a = await createWorktree({ workspaceDir: ws, instanceId: 'INST-005', roleId: 'alpha' });
  await commitFile(a.worktreeDir, 'a.txt', 'A');

  let failMerge = true;
  const flakyExec = async (file, args, opts) => {
    if (failMerge && args[0] === 'merge' && args[1] !== '--abort') {
      return { exitCode: 1, stdout: '', stderr: 'injected merge failure' };
    }
    return realExec(file, args, opts);
  };

  const applied = [];
  const committed = [];
  const queue = createMergeQueue({
    execa: flakyExec,
    applyStateChange: (change) => applied.push(change),
    commitEscalation: async ({ instanceId, escalation }) => {
      committed.push({ instanceId, escalation });
      return { ok: true, escalationId: 'ESC-001' };
    },
  });

  const result = await queue.enqueue({
    nodeId: 'N1',
    instanceId: 'INST-005',
    roleId: 'alpha',
    workspaceDir: ws,
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'merge_aborted');
  assert.equal(committed.length, 1);
  assert.equal(committed[0].instanceId, 'INST-005');
  assert.equal(committed[0].escalation.reasonCode, 'merge_aborted');
  assert.equal(
    applied.some((change) => change.mergeStatus === 'conflict'),
    true
  );

  // The conflict is cleared once the user resolves it: reprocess retries the merge.
  failMerge = false;
  const again = await queue.reprocess('ESC-001');
  assert.equal(again.ok, true);
  assert.equal(
    applied.some((change) => change.mergeStatus === 'merged'),
    true
  );
  assert.equal((await fs.readFile(path.join(ws, 'a.txt'), 'utf8')).trim(), 'A');
});

test('reprocess：未知升级号返回 ESCALATION_NOT_FOUND', async () => {
  const queue = createMergeQueue({});
  const res = await queue.reprocess('ESC-999');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'ESCALATION_NOT_FOUND');
});
