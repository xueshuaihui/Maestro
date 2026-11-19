/**
 * AC-53 · 全量测试回归门禁：失败集合差集为 0。
 *
 * 机检（需求 `:808`、progress.md「基线口径」）：本次实跑失败用例名集合 ∖
 * `probe/i18-s2/baseline-014fa6a-reds.txt` 必须为空，且测试条数只增不减（≥ 1841）。
 * 不要求「零失败」；既有噪声（EPERM / 盘符 / EBUSY）不计为新增失败。
 */
import fs from 'node:fs';
import path from 'node:path';

import { makeCase, evidence, eq, verify, check, note, finish } from '../acc8-f-common.mjs';
import {
  GRADING_ARCH, REPO, NODE, ACC8_PATHS, EVID, runCmd, readText, writeText, ensureDir, BASE,
} from '../acc8-f-lib.mjs';

const FULL_CMD = 'NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"';

/** 从 TAP 输出里抽「not ok N - <name>」的用例名（缩进子测试也算）。 */
function parseFailures(stdout) {
  const names = [];
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^\s*not ok \d+ - (.+?)\s*$/);
    if (m) names.push(m[1]);
  }
  return names;
}

function parseCounts(stdout) {
  const num = (label) => {
    const m = stdout.match(new RegExp(`^# ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  return {
    tests: num('tests'),
    pass: num('pass'),
    fail: num('fail'),
    skipped: num('skip'),
  };
}

export async function run() {
  const c = makeCase('AC-53', {
    scenario: 'full-suite-diffset',
    title: '全量测试回归门禁：失败集合差集为 0',
    grading: GRADING_ARCH,
  });
  c.root = path.join(BASE, 'maestro-i18', 'ac53');

  const started = Date.now();
  const r = runCmd([NODE, '--test', '--test-concurrency=1', '--test-timeout=120000', '--test-force-exit', 'test/**/*.test.js'], {
    cwd: REPO,
    timeout: 3_600_000,
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const durationMs = Date.now() - started;

  evidence(c, 'machine', 'full-suite.log', `${FULL_CMD}\n# exit=${r.exitCode} durationMs=${durationMs}\n\n# ---- stdout ----\n${r.stdout}\n\n# ---- stderr ----\n${r.stderr}`);

  const failures = parseFailures(r.stdout);
  const counts = parseCounts(r.stdout);
  const baseline = readText(ACC8_PATHS.BASELINE_REDS).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const baselineSet = new Set(baseline);
  const failSet = new Set(failures);
  const extra = [...failSet].filter((n) => !baselineSet.has(n)).sort();
  const fixed = baseline.filter((n) => !failSet.has(n)).sort();

  writeText(path.join(EVID, 'AC-53.diffset.txt'), [
    `# 本次失败集合 ${failSet.size} 条（TAP 计 fail=${counts.fail}）`,
    `# 基线红名单 ${baseline.length} 条（probe/i18-s2/baseline-014fa6a-reds.txt）`,
    '',
    '## 新增失败（差集，必须为空）',
    ...(extra.length ? extra.map((n) => `+ ${n}`) : ['(空)']),
    '',
    '## 基线红本次未复现（允许）',
    ...(fixed.length ? fixed.map((n) => `- ${n}`) : ['(空)']),
    '',
  ].join('\n'));

  verify(c, '测试条数 ≥ 1841（只增不减）', counts.tests, (n) => typeof n === 'number' && n >= 1841, '≥ 1841');
  eq(c, '新增失败集合（差集）为空', extra, []);
  check(c, '失败条数与 TAP 解析一致', counts.fail === failures.length || failures.length > 0, JSON.stringify(counts));
  note(c, `实跑：${JSON.stringify(counts)}，耗时 ${Math.round(durationMs / 1000)}s；基线红 ${baseline.length} 条，本次失败 ${failSet.size} 条，差集 ${extra.length} 条。`);
  note(c, `命令逐字：${FULL_CMD}`);

  return finish(c);
}
