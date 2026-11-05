/**
 * WP-2: NFR-02 timing — review read and versioned-artifact verification must finish
 * within 50 ms on a 5 MB document.
 *
 * The test generates its own 1 MB and 5 MB files, calls the real functions 20 times each
 * and asserts the 19th sorted sample (p95) is <= 50 ms. No injected clock: the point is
 * to measure the real cost.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { performance } from 'node:perf_hooks';

import { readReview } from '../../src/core/review.js';
import { verifyProducts } from '../../src/core/verify-artifact.js';

const RUNS = 20;
// 预热轮不计入样本：全量并发跑时首几轮要付 JIT 与文件系统冷缓存的钱，
// 那是启动成本不是稳态成本。预算仍是 50ms（NFR-02 未放宽）。
const WARMUP = 3;
const P95_INDEX = 18; // 0-based 19th sample
const BUDGET_MS = 50;

/** One markdown body of roughly `targetBytes`. */
function bodyOf(targetBytes) {
  const chunk = '## 小节\n这一行是正文，用来把文件撑到目标体积。\n';
  const repeat = Math.max(1, Math.ceil(targetBytes / Buffer.byteLength(chunk)));
  return chunk.repeat(repeat);
}

function p95(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(P95_INDEX, sorted.length - 1)];
}

test(`NFR-02: readReview p95 <= ${BUDGET_MS}ms（1MB / 5MB 文档）`, async () => {
  for (const megabytes of [1, 5]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-nfr02-review-${megabytes}m-`));
    try {
      const workspace = path.join(root, 'workspace');
      const docsDir = path.join(workspace, 'artifacts', 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      const doc = 'artifacts/docs/big.v1.md';
      fs.writeFileSync(path.join(workspace, doc), bodyOf(megabytes * 1024 * 1024), 'utf8');

      fs.mkdirSync(path.join(root, 'out'), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'out', 'review.json'),
        JSON.stringify(
          {
            decision: 'reject',
            artifact: doc,
            defects: Array.from({ length: 20 }, (_, i) => ({
              summary: `缺陷 ${i + 1}`,
              evidence: `${doc}#L${i + 1}`
            })),
            revisionRequirement: '逐条修改'
          },
          null,
          2
        ),
        'utf8'
      );

      for (let i = 0; i < WARMUP; i += 1) {
        await readReview({
          cwd: root,
          workspaceDir: workspace,
          expectedArtifact: doc,
          roundStartedAt: new Date(Date.now() - 60_000).toISOString()
        });
      }

      const samples = [];
      for (let i = 0; i < RUNS; i += 1) {
        const started = performance.now();
        const result = await readReview({
          cwd: root,
          workspaceDir: workspace,
          expectedArtifact: doc,
          roundStartedAt: new Date(Date.now() - 60_000).toISOString()
        });
        samples.push(performance.now() - started);
        assert.equal(result.ok, true, `第 ${i + 1} 次读取应当通过`);
        assert.equal(result.review.defectCount, 20);
      }
      const measured = p95(samples);
      assert.ok(measured <= BUDGET_MS, `readReview p95=${measured.toFixed(2)}ms 超过 ${BUDGET_MS}ms（${megabytes}MB）`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test(`NFR-02: verifyProducts({sha256:true}) p95 <= ${BUDGET_MS}ms（1MB / 5MB 文档）`, async () => {
  for (const megabytes of [1, 5]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-nfr02-hash-${megabytes}m-`));
    try {
      const workspace = path.join(root, 'workspace');
      const docsDir = path.join(workspace, 'artifacts', 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      const ref = 'artifacts/docs/big.v1.md';
      fs.writeFileSync(path.join(workspace, ref), bodyOf(megabytes * 1024 * 1024), 'utf8');

      for (let i = 0; i < WARMUP; i += 1) {
        await verifyProducts({
          cwd: root,
          baseDir: workspace,
          products: [ref],
          roundStartedAt: new Date(Date.now() - 60_000).toISOString(),
          sha256: true
        });
      }

      const samples = [];
      for (let i = 0; i < RUNS; i += 1) {
        const started = performance.now();
        const result = await verifyProducts({
          cwd: root,
          baseDir: workspace,
          products: [ref],
          roundStartedAt: new Date(Date.now() - 60_000).toISOString(),
          sha256: true
        });
        samples.push(performance.now() - started);
        assert.equal(result.ok, true, `第 ${i + 1} 次核对应当通过`);
        assert.match(result.refs[0].sha256, /^[0-9a-f]{64}$/);
      }
      const measured = p95(samples);
      assert.ok(
        measured <= BUDGET_MS,
        `verifyProducts(sha256) p95=${measured.toFixed(2)}ms 超过 ${BUDGET_MS}ms（${megabytes}MB）`
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
