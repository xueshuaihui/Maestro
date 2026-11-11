// I1.9 S3 验收 A 组：AC-03（三条主链运行输出逐字不变）。
//
// 口径（D-17 ⑤/⑥）：
// - 基线树 = `git worktree add /tmp/acc9-baseline 322fb5e`（评审与主控用的同一基线）；
// - 同一夹具、交替运行「基线 → 当前」与「当前 → 基线」，至少 2 对；
// - A-0 归一化后逐字 diff 必须为 0；`single` / `code-loop` 每一对都必须 0；
//   `task-loop` 因基线本身 flaky（`会话 已升级`），按「不得低于基线」判：
//   出现率不得低于基线，且双方都出现时逐字 diff 为 0。
//
// 复跑：`NODE_ENV=test node probe/acc9-a-regress.mjs`
// 证据：docs/iterations/iteration-9/evidence/acc9/AC-03/
import fs from 'node:fs';
import path from 'node:path';

import {
  BASE, NODE, ORCH, REPO, collapseRefresh, ensureDir, evidenceDir, freshRoot, makeChecks, normalizeStdout,
  nowIso, removeProject, report, runCli, stopCore, writeEvidence, writeMockConfig,
} from './acc9-a-lib.mjs';
import { spawnSync } from 'node:child_process';

const BASELINE_TREE = '/tmp/acc9-baseline';
const PAIRS = 3;
const TASK_LOOP_PAIRS = 6;

const CHAINS = {
  single: { task: '写一份说明', exit: 0 },
  'code-loop': { task: '实现一个示例功能\n产物：calc.js', exit: 4 },
  'task-loop': { task: '整理一份调研纪要\n产物：release-notes.md', exit: 4 },
};

function gitHead(tree) {
  return spawnSync('git', ['-C', tree, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
}

async function main() {
  ensureDir(evidenceDir('AC-03'));
  const { checks, check } = makeChecks();

  check('基线 worktree 存在且 HEAD = 322fb5e',
    fs.existsSync(path.join(BASELINE_TREE, 'bin', 'orch.js'))
      && fs.readFileSync(path.join(BASELINE_TREE, '.git'), 'utf8').includes('gitdir'),
    { tree: BASELINE_TREE });

  const result = { at: nowIso(), baselineTree: BASELINE_TREE, head: null, chains: {} };
  result.head = { repo: gitHead(REPO), baseline: gitHead(BASELINE_TREE) };
  check('当前树 HEAD = 40eb704、基线树 HEAD = 322fb5e',
    result.head.repo === '40eb704' && result.head.baseline === '322fb5e', result.head);

  for (const [template, chain] of Object.entries(CHAINS)) {
    const spec = { ...chain, template };
    const pairCount = template === 'task-loop' ? TASK_LOOP_PAIRS : PAIRS;
    const pairs = [];

    for (let i = 0; i < pairCount; i += 1) {
      const order = i % 2 === 0 ? ['base', 'cur'] : ['cur', 'base'];
      const runs = {};
      for (const side of order) {
        const root = freshRoot(`AC-03-${template}-${i}-${side}`);
        writeMockConfig(root);
        const orch = side === 'base' ? path.join(BASELINE_TREE, 'bin', 'orch.js') : ORCH;
        const r = runCli(root, [
          'run', '--cwd', '.', '--template', spec.template, '--host', 'mock', '--task', spec.task,
        ], { timeout: 150_000, orch });
        runs[side] = { ...r, normalized: collapseRefresh(normalizeStdout(r.stdout)), root };
      }

      pairs.push({
        pair: i,
        order,
        base: runs.base,
        cur: runs.cur,
        diff: diffLines(runs.base.normalized, runs.cur.normalized),
      });
    }

    const pairDiffs = pairs.map((p) => p.diff);
    const baseUpgradeHits = pairs.filter((p) => p.base.normalized.includes('会话 已升级')).length;
    const curUpgradeHits = pairs.filter((p) => p.cur.normalized.includes('会话 已升级')).length;

    if (template === 'task-loop') {
      check(`${template}：当前出现率不低于基线（会话 已升级 ${curUpgradeHits}/${pairs.length} vs 基线 ${baseUpgradeHits}/${pairs.length}）`,
        curUpgradeHits >= baseUpgradeHits, { baseUpgradeHits, curUpgradeHits, pairs: pairs.length });
      const bothHave = pairs.filter((p) => p.base.normalized.includes('会话 已升级')
        && p.cur.normalized.includes('会话 已升级'));
      check(`${template}：双方都出现「会话 已升级」的对照逐字 diff 为 0（${bothHave.length} 对）`,
        bothHave.length > 0 && bothHave.every((p) => p.diff.length === 0),
        { compared: bothHave.length, diffs: bothHave.map((p) => ({ pair: p.pair, diff: p.diff })) });
    } else {
      check(`${template}：每对 A-0 归一化后逐字 diff 为 0（${pairDiffs.filter((d) => d.length === 0).length}/${pairs.length} 对）`,
        pairDiffs.every((d) => d.length === 0), { diffs: pairDiffs.map((d, i) => ({ pair: i, diff: d })) });
    }

    check(`${template}：退出码与基线一致（期望 ${spec.exit}）`,
      pairs.every((p) => p.base.exitCode === spec.exit && p.cur.exitCode === spec.exit),
      { base: pairs.map((p) => p.base.exitCode), cur: pairs.map((p) => p.cur.exitCode) });
    check(`${template}：当前树输出不含健康度/追踪/执行摘要等新增可见词`,
      pairs.every((p) => !['健康度', '追踪', '执行摘要', '已跳过'].some((w) => p.cur.stdout.includes(w))));

    for (const p of pairs) {
      writeEvidence('AC-03', `${template}-pair${p.pair}-base.txt`, p.base.stdout + p.base.stderr);
      writeEvidence('AC-03', `${template}-pair${p.pair}-cur.txt`, p.cur.stdout + p.cur.stderr);
    }
    writeEvidence('AC-03', `${template}-normalized.json`, pairs.map((p) => ({
      pair: p.pair,
      order: p.order,
      baseExit: p.base.exitCode,
      curExit: p.cur.exitCode,
      baseNormalized: p.base.normalized,
      curNormalized: p.cur.normalized,
      diff: p.diff,
    })));

    result.chains[template] = {
      pairs: pairs.length,
      diffs: pairDiffs,
      exitCodes: { base: pairs.map((p) => p.base.exitCode), cur: pairs.map((p) => p.cur.exitCode) },
      upgradeHits: { base: baseUpgradeHits, cur: curUpgradeHits },
    };
  }

  for (const root of fs.readdirSync(BASE).filter((n) => n.startsWith('AC-03-'))) {
    stopCore(path.join(BASE, root));
    removeProject(path.join(BASE, root));
  }

  const payload = { ...result, checks, pass: checks.every((c) => c.ok) };
  report('AC-03', payload);
  process.stdout.write(`AC-03 ${payload.pass ? 'PASS' : 'FAIL'}\n`);
  return payload.pass;
}

function diffLines(a, b) {
  const out = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) out.push({ line: i, base: a[i] ?? null, cur: b[i] ?? null });
  }
  return out;
}

process.exit((await main()) ? 0 : 1);
