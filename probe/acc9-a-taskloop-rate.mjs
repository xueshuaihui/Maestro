// I1.9 S3 验收 A 组：AC-03 的 task-loop 专项出现率采样（D-17 ⑥）。
//
// `会话 已升级` 这一行在基线树本身就是 flaky（review-wp7 / D-17 ⑥：基线 ≈91%）；
// AC-03 对 `task-loop` 的判据是「不得低于基线」，因此这里做**成对交替**采样：
// 同一对里先基线后当前（偶数对）或先当前后基线（奇数对），逐对记录是否命中，
// 并在双方都命中时做 A-0 归一化逐字 diff。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-taskloop-rate.mjs [pairs]`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-03/taskloop-rate*.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  ORCH, REPO, collapseRefresh, evidenceDir, freshRoot, normalizeStdout, nowIso, removeProject,
  report, runCli, stopCore, writeEvidence, writeMockConfig,
} from './acc9-a-lib.mjs';

const BASELINE_TREE = '/tmp/acc9-baseline';
const TASK = '整理一份调研纪要\n产物：release-notes.md';
const PAIRS = Number(process.argv[2] ?? 8);
const BASELINE_REFERENCE_RATE = '9/10（D-17 ⑥ review-wp7-r2 实测）';

function head(tree) {
  return spawnSync('git', ['-C', tree, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
}

function diffLines(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) out.push({ line: i, base: a[i] ?? null, cur: b[i] ?? null });
  }
  return out;
}

const pairs = [];
for (let i = 0; i < PAIRS; i += 1) {
  const order = i % 2 === 0 ? ['base', 'cur'] : ['cur', 'base'];
  const runs = {};
  for (const side of order) {
    const root = freshRoot(`AC-03-rate-${i}-${side}`);
    writeMockConfig(root);
    const orch = side === 'base' ? path.join(BASELINE_TREE, 'bin', 'orch.js') : ORCH;
    const r = runCli(root, ['run', '--cwd', '.', '--template', 'task-loop', '--host', 'mock', '--task', TASK], {
      timeout: 150_000, orch,
    });
    runs[side] = {
      exitCode: r.exitCode,
      normalized: collapseRefresh(normalizeStdout(r.stdout)),
      raw: r.stdout + r.stderr,
      hit: r.stdout.includes('会话 已升级'),
    };
    stopCore(root);
    removeProject(root);
  }
  pairs.push({
    pair: i,
    order,
    baseHit: runs.base.hit,
    curHit: runs.cur.hit,
    baseExit: runs.base.exitCode,
    curExit: runs.cur.exitCode,
    diff: diffLines(runs.base.normalized, runs.cur.normalized),
  });
  writeEvidence('AC-03', `taskloop-rate-pair${i}.txt`,
    `---- base ----\n${runs.base.raw}\n---- cur ----\n${runs.cur.raw}`);
  process.stdout.write(`pair ${i}: base=${runs.base.hit ? 'hit' : 'miss'} cur=${runs.cur.hit ? 'hit' : 'miss'} diff=${runs.cur.hit && runs.base.hit ? runs.base.hit && diffLines(runs.base.normalized, runs.cur.normalized).length : '-'}\n`);
}

const baseHits = pairs.filter((p) => p.baseHit).length;
const curHits = pairs.filter((p) => p.curHit).length;
const both = pairs.filter((p) => p.baseHit && p.curHit);
const bothDiffZero = both.filter((p) => p.diff.length === 0).length;

const payload = {
  at: nowIso(),
  pairs: PAIRS,
  heads: { repo: head(REPO), baseline: head(BASELINE_TREE) },
  baseHits,
  curHits,
  baselineReference: BASELINE_REFERENCE_RATE,
  pairDiff: pairs.map((p) => ({ pair: p.pair, baseHit: p.baseHit, curHit: p.curHit, diff: p.diff })),
  bothHitPairs: both.length,
  bothHitDiffZero: bothDiffZero,
  exitCodes: { base: pairs.map((p) => p.baseExit), cur: pairs.map((p) => p.curExit) },
  checks: [
    { name: `task-loop 当前出现率不低于基线（cur ${curHits}/${PAIRS} vs base ${baseHits}/${PAIRS}）`, ok: curHits >= baseHits },
    { name: `双方都命中的对照逐字 diff 为 0（${bothDiffZero}/${both.length}）`, ok: both.length > 0 && bothDiffZero === both.length },
  ],
};
payload.pass = payload.checks.every((c) => c.ok);
report('AC-03', payload, `taskloop-rate-${PAIRS}.json`);
process.stdout.write(`\nbase ${baseHits}/${PAIRS} · cur ${curHits}/${PAIRS} · both-diff-zero ${bothDiffZero}/${both.length}\n`);
process.exit(payload.pass ? 0 : 1);
