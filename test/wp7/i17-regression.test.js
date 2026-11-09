/**
 * I1.7 WP-6 — regression guard.
 *
 * Locks the three built-in chains (`single` / `code-loop` / `task-loop`) to their
 * pre-I1.7 rendering, the versioned-doc + report-area semantics, the non-code role
 * boundary, and the architecture gates (zero third-party deps, 31-word purity).
 *
 * The full-suite failure-set-diff gate is executed at acceptance time against the
 * `3f35bfa` baseline; here we keep the cheap, deterministic guards that must stay
 * green on every run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { GRAPHS, ROLES } from '../../src/templates/index.js';
import { renderNodeLines } from '../../src/cli/render.js';
import { docRef, DOCS_DIR, REPORTS_DIR } from '../../src/core/doc-artifact.js';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const FORBID = [
  'task-loop',
  'researcher',
  'writer',
  'reviewer',
  '研究员',
  '撰写者',
  '审核者',
  'code-loop',
  'developer',
  'tester',
  'coordinator',
  'arbiter',
  'planner',
  'summarizer',
  'worker',
  'data-analyst',
  'fact-checker',
  'editor',
  'code-reviewer',
  'compliance-reviewer',
  'requirement-clarifier',
  'research-brief',
  'fact-check',
  'data-analysis',
  'doc-draft',
  'doc-review',
  'code-change',
  'test-run',
  'code-review',
  'coordination',
  'compliance-check',
];

test('R-1 / AC-11：三主链节点行逐字不变（run 路径无分支片段回灌）', () => {
  const single = renderNodeLines(
    { template: 'single', state: 'completed', nodes: [{ nodeId: 'T-001', roleId: 'worker', state: 'done', round: 1 }] },
    { template: 'single' }
  );
  assert.deepEqual(single, ['节点 已完成']);

  const codeLoop = renderNodeLines(
    {
      template: 'code-loop',
      state: 'completed',
      // A code role that has already merged must still print the pre-I1.7 line
      // because `run` never passes `includeBranch`.
      nodes: [
        {
          nodeId: 'T-001',
          roleId: 'developer',
          state: 'done',
          round: 1,
          branch: 'maestro/INST-001/developer',
          mergeStatus: 'merged',
        },
      ],
    },
    { template: 'code-loop' }
  );
  assert.deepEqual(codeLoop, ['节点 T-001 开发 已完成 · 第 1 轮']);

  const taskLoop = renderNodeLines(
    {
      template: 'task-loop',
      state: 'completed',
      nodes: [
        { nodeId: 'T-001', roleId: 'researcher', state: 'done', round: 1 },
        { nodeId: 'T-002', roleId: 'writer', state: 'done', round: 1 },
        { nodeId: 'T-003', roleId: 'reviewer', state: 'done', round: 1 },
      ],
    },
    { template: 'task-loop' }
  );
  assert.deepEqual(taskLoop, [
    '节点 T-001 研究员 已完成 · 第 1 轮',
    '节点 T-002 撰写者 已完成 · 第 1 轮',
    '节点 T-003 审核者 已完成 · 第 1 轮',
  ]);
});

test('R-1：三主链图结构（节点/角色/终态）逐字不变', () => {
  assert.deepEqual(GRAPHS.single.nodes.map((n) => n.nodeId), ['T-001']);
  assert.equal(GRAPHS.single.nodes[0].roleId, 'worker');
  assert.deepEqual(GRAPHS['code-loop'].nodes.map((n) => n.nodeId), ['T-001', 'T-002']);
  assert.equal(GRAPHS['code-loop'].nodes[0].roleId, 'developer');
  assert.deepEqual(GRAPHS['task-loop'].nodes.map((n) => n.nodeId), ['T-001', 'T-002', 'T-003']);
  assert.equal(GRAPHS['task-loop'].nodes[1].artifactPolicy, 'versioned-doc');
});

test('AC-02：document 版本化文件区 v1/v2 并存且内容独立', () => {
  assert.equal(DOCS_DIR, 'artifacts/docs');
  const v1 = docRef({ stem: 'release-notes', round: 1 });
  const v2 = docRef({ stem: 'release-notes', round: 2 });
  assert.equal(v1, 'artifacts/docs/release-notes.v1.md');
  assert.equal(v2, 'artifacts/docs/release-notes.v2.md');
  assert.notEqual(v1, v2);
});

test('AC-04：report 只追加区路径不变', () => {
  assert.equal(REPORTS_DIR, 'artifacts/reports');
  assert.equal('artifacts/reports/research-notes.v1.md'.startsWith(`${REPORTS_DIR}/`), true);
});

test('AC-10：仅 developer 是 code 角色，其余角色无 artifact_type', () => {
  assert.equal(ROLES.developer.artifact_type, 'code');
  for (const roleId of ['tester', 'coordinator', 'researcher', 'writer', 'reviewer']) {
    assert.equal(ROLES[roleId].artifact_type, undefined, `${roleId} 不应被 git 隔离`);
  }
});

test('R-3 / R-4：dependencies 键数 = 0 且 31 词纯净扫描 exit 0', async () => {
  const pkgRaw = await fs.readFile(path.join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'dependencies 必须为空对象');

  // Throws (non-zero exit) if any forbidden word appears under src/core,src/daemon.
  execFileSync(
    'node',
    ['test/fixtures/purity-check.mjs', '--dirs', 'src/core,src/daemon', '--forbid', FORBID.join(',')],
    { cwd: ROOT, encoding: 'utf8' }
  );
});
