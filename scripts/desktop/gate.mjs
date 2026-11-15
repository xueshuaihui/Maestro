#!/usr/bin/env node
/**
 * 发布门禁——需求 AC-40 / NF-6 / NF-8。
 *
 * 复用仓库**既有判定**，不为发布另开一套宽松口径：
 *   1. 全量单测：`# fail` 的用例名集合必须 ⊆ 判定基线（历史 `baseline-failures.txt` 8 条 +
 *      裁决 R-08 允许的 `AC-04` 一项 = 9 条），差集 0
 *   2. 测试条数只增不减（基线 1157）
 *   3. `dependencies` 仍为 `{}`（BR-22 红线）
 *   4. 31 词纯净扫描两轮 exit 0（`src/core`+`src/daemon`、`desktop/ui`）
 *   5. 版本三处对齐（AC-41）
 *
 * 任一不过 → 非零退出，发布不得继续（AC-40：门禁在打包之前）。
 *
 * 用法：node scripts/desktop/gate.mjs [--skip-tests] [--no-flake-confirm]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { REPO, checkAligned } from './version.mjs';

const BASELINE_TESTS = 1157;
const BASELINE_FAILURES = path.join(REPO, 'docs', 'iterations', 'iteration-7', 'baseline-failures.txt');

/**
 * 裁决 R-08 的允许项：`AC-04` 的时序竞态在批次前快照 `aca57d6` 上同样失败，
 * 已登记为**已知基线项**（`decisions.md` 裁决 R）。
 *
 * 判定口径 = 历史 `baseline-failures.txt` 的物理 8 条 + 本条 = **9 条**
 * （与 `probe/acc10-f-gates.mjs` 的 `allow`、`test/wp13/regression.test.js` 的断言同源）。
 * 这里只是复现仓库已裁决的口径，不是放宽：任何**不在**这 9 条里的失败仍然判红。
 */
const ADJUDICATED_ALLOW = ['AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新'];

/**
 * 平台敏感项：仓库的测试面是 macOS 作者写的，其中少数断言依赖 `lsof`、LF 字节、
 * POSIX 信号语义或细粒度时钟，在 windows-latest 上必然失败（真实红 run 43712132192
 * 实测 16 条）。这份清单**只约束 win32**，且**不代表这些用例在 Windows 上通过**：
 * 它只是把这些失败登记为已知项，让「新出现的失败」仍然判红。
 * 逐条归因与原始帧见该文件头部注释。
 */
const WIN32_BASELINE = path.join(REPO, 'docs', 'iterations', 'iteration-10a', 'baseline-failures-win32.txt');

const FORBID = [
  'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
  'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner', 'summarizer',
  'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer', 'compliance-reviewer',
  'requirement-clarifier', 'research-brief', 'fact-check', 'data-analysis', 'doc-draft',
  'doc-review', 'code-change', 'test-run', 'code-review', 'coordination', 'compliance-check',
].join(',');

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail: String(detail ?? '') });
  process.stdout.write(`[gate] ${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}\n`);
  return Boolean(ok);
}

function parseTap(output) {
  const lines = output.split('\n');
  let tests = null;
  let fail = 0;
  let pass = 0;
  const notOk = [];
  for (const line of lines) {
    const summary = line.match(/^# (tests|pass|fail) (\d+)$/);
    if (summary) {
      if (summary[1] === 'tests') tests = Number(summary[2]);
      if (summary[1] === 'pass') pass = Number(summary[2]);
      if (summary[1] === 'fail') fail = Number(summary[2]);
      continue;
    }
    const bad = line.match(/^not ok \d+ - (.+)$/);
    if (bad) notOk.push(bad[1].trim());
  }
  return { tests, pass, fail, notOk };
}

function parseBaselineFile(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'));
}

function readBaselineFailures() {
  const historical = parseBaselineFile(BASELINE_FAILURES);
  const platform = process.platform === 'win32' && fs.existsSync(WIN32_BASELINE) ? parseBaselineFile(WIN32_BASELINE) : [];
  return { list: [...historical, ...ADJUDICATED_ALLOW, ...platform], historical: historical.length, platform: platform.length };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 对「不在基线里的失败」做一次隔离复跑确认。
 *
 * 为什么需要：全量并发下本仓存在已知负载型 flake（残留 `orch core serve` 进程、
 * 壳单实例锁竞争等），同一条断言逐文件复跑会全绿。这里**只做确认、不做放宽**：
 * 复跑仍失败 → 该失败成立；复跑通过 → 记为 flake 并打印名单，供 S3/S4 登记。
 */
function confirmFlakes(names) {
  const flakes = [];
  const real = [];
  for (const name of names) {
    const r = spawnSync(process.execPath, ['--test', '--test-name-pattern', escapeRegExp(name), 'test/**/*.test.js'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 20 * 60 * 1000,
    });
    const tap = parseTap(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
    const stillFailing = tap.notOk.includes(name) || (tap.tests === 0 && r.status !== 0);
    if (stillFailing) real.push(name);
    else flakes.push(name);
    process.stdout.write(`[gate] 复跑 ${stillFailing ? 'FAIL' : 'FLAKE'} ${name}\n`);
  }
  return { flakes, real };
}

function main() {
  const skipTests = process.argv.includes('--skip-tests');
  // CI runner 上没有本机那类残留进程负载，且一次隔离复跑要重扫全量；
  // 流水线里直接判红更快、也更严格（不把意外失败降级成 flake）。
  const noFlakeConfirm = process.argv.includes('--no-flake-confirm');

  if (!skipTests) {
    const run = spawnSync(process.execPath, ['--test', 'test/**/*.test.js'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30 * 60 * 1000,
    });
    const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
    const tap = parseTap(output);
    const baseline = readBaselineFailures();
    const unexpected = tap.notOk.filter((name) => !baseline.list.includes(name));
    let unexpectedReal = unexpected;
    let flakes = [];
    if (unexpected.length) {
      if (noFlakeConfirm) {
        process.stdout.write(`[gate] 跳过隔离复跑（--no-flake-confirm）：${unexpected.length} 条意外失败直接判红\n`);
      } else {
        const confirmed = confirmFlakes(unexpected);
        flakes = confirmed.flakes;
        unexpectedReal = confirmed.real;
      }
    }
    check('全量单测可运行并产出 TAP 摘要', tap.tests !== null, `tests=${tap.tests} pass=${tap.pass} fail=${tap.fail}`);
    check(
      '失败集合与判定基线差集为 0',
      unexpectedReal.length === 0,
      unexpectedReal.length
        ? `意外失败（隔离复跑仍失败）：${unexpectedReal.join(' / ')}`
        : `${tap.notOk.length} 条失败全部落在判定基线 ${baseline.list.length} 条内（历史 ${baseline.historical} 条 + 裁决 R-08 允许的 AC-04 一项${baseline.platform ? ` + win32 平台敏感 ${baseline.platform} 条` : ''}）${flakes.length ? `（另有 ${flakes.length} 条为并发 flake，隔离复跑通过）` : ''}`,
    );
    if (flakes.length) process.stdout.write(`[gate] flake 名单：${flakes.join(' / ')}\n`);
    check('测试条数只增不减', (tap.tests ?? 0) >= BASELINE_TESTS, `tests=${tap.tests} ≥ ${BASELINE_TESTS}`);
  }

  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).dependencies ?? {});
  check('dependencies 为空（零 npm 依赖）', deps.length === 0, deps.length ? deps.join(',') : '{}');

  for (const [label, dirs] of [
    ['src/core,src/daemon', 'src/core,src/daemon'],
    ['desktop/ui', 'desktop/ui'],
  ]) {
    const r = spawnSync(process.execPath, ['test/fixtures/purity-check.mjs', '--dirs', dirs, '--forbid', FORBID], {
      cwd: REPO,
      encoding: 'utf8',
    });
    check(`31 词纯净扫描（${label}）`, r.status === 0, `exit ${r.status}`);
  }

  const aligned = checkAligned();
  check('版本三处对齐', aligned.ok, aligned.ok ? aligned.version : JSON.stringify(aligned.details));

  const failed = checks.filter((c) => !c.ok);
  process.stdout.write(`[gate] 汇总：${checks.length - failed.length}/${checks.length} 通过\n`);
  if (failed.length) process.exit(1);
}

main();
