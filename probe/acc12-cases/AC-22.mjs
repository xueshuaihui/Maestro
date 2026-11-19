/**
 * AC-22 · 回归红线：上游 AC 与不变量只增不改。
 * 取证口径：主控已跑全量（tests 1659 / pass 1636 / fail 14 / skipped 9、差集 0、三主链 8/8）；
 * 本用例【不重跑全量】（避免覆盖历史证据），只做证据索引 + 口径核对 + 轻量只读断言。
 */
import fs from 'node:fs';
import path from 'node:path';

import { REPO, freshRoot, cleanupRoot, runCmd, readText } from '../acc12-f-lib.mjs';
import { makeCase, evidence, check, verify, includes, eq, finish } from '../acc12-f-common.mjs';
import { cli } from './AC-13.mjs';

const EVID = path.join(REPO, 'docs/iterations/iteration-12/evidence');

export async function run() {
  const c = makeCase('AC-22', { scenario: 'regress', title: '回归红线：上游 AC 与不变量只增不改（证据索引）' });
  c.root = freshRoot('regress-ac22');
  try {
    // 复用主控历史证据，绝不重跑/覆盖。
    const fullLog = readText(path.join(EVID, 'AC-22.full-suite.log'));
    const chainsLog = readText(path.join(EVID, 'AC-22.main-chains.log'));
    const diffset = readText(path.join(EVID, 'AC-22.diffset.txt'));
    evidence(c, 'index', 'full-suite.log', fullLog.slice(-2500));
    evidence(c, 'index', 'main-chains.log', chainsLog);
    evidence(c, 'index', 'diffset.txt', diffset);

    const num = (key) => {
      const m = fullLog.match(new RegExp(`^# ${key} (\\d+)`, 'm'));
      return m ? Number(m[1]) : null;
    };
    const tests = num('tests'), pass = num('pass'), fail = num('fail'), skipped = num('skipped');
    evidence(c, 'index', 'counts.json', JSON.stringify({ tests, pass, fail, skipped }, null, 2));
    verify(c, '全量测试条数 ≥ 上游基线 1425', tests, (n) => n !== null && n >= 1425, '>= 1425');
    eq(c, '计数自洽：pass+fail+skipped = tests', pass + fail + skipped, tests);
    verify(c, '失败条数与差集日志一致（fail=14）', fail, (n) => n === 14, '14');
    includes(c, '差集日志写明「集合外新增红：0」', diffset, '集合外新增红：0');
    includes(c, '差集日志基线满足（tests >= 1425）', diffset, 'tests >= 1425 满足');
    eq(c, '三主链独立复跑 tests=8', (chainsLog.match(/^# tests 8$/m) || []).length, 1);
    eq(c, '三主链独立复跑 pass=8', (chainsLog.match(/^# pass 8$/m) || []).length, 1);
    eq(c, '三主链独立复跑 fail=0', (chainsLog.match(/^# fail 0$/m) || []).length, 1);
    const okChains = (chainsLog.match(/^ok \d+ -/gm) || []).length;
    eq(c, '三主链 8/8 断言通过', okChains, 8);

    // 轻量只读断言（不重跑全量）。
    const labelsMod = await import('../../src/cli/labels.js');
    const usage = runCmd([process.execPath, '-e',
      "import('./src/cli/labels.js').then(m=>console.log('U'+m.USAGE_LINES.length+' I'+m.USAGE_LINES_I112.length))"], { cwd: REPO });
    evidence(c, 'check', 'usage.txt', `exitCode=${usage.exitCode}\n${usage.stdout}${usage.stderr}\n`);
    eq(c, '机检：USAGE_LINES 既有 25 行逐字保留', labelsMod.USAGE_LINES.length, 25);
    check(c, '机检：三新增命令独立用法块追加（不改既有行）', labelsMod.USAGE_LINES_I112.length >= 3, 'I112 block appended');

    const deps = runCmd([process.execPath, '-e',
      "const p=require('./package.json');console.log(Object.keys(p.dependencies||{}).length)"], { cwd: REPO });
    evidence(c, 'check', 'deps.txt', `exitCode=${deps.exitCode}\n${deps.stdout}${deps.stderr}\n`);
    eq(c, '机检：dependencies 为 {}（输出 0）', Number(deps.stdout.trim()), 0);

    const purity = runCmd([process.execPath, 'test/fixtures/purity-check.mjs', '--dirs', 'src/core,src/daemon',
      '--forbid', 'task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check'], { cwd: REPO });
    evidence(c, 'check', 'purity.txt', `exitCode=${purity.exitCode}\n${purity.stdout.slice(-500)}${purity.stderr}\n`);
    eq(c, '机检：purity 双目录禁词表 exit 0', purity.exitCode, 0);

    evidence(c, 'meta', 'result.json', JSON.stringify({
      counts: { tests, pass, fail, skipped }, okChains,
      usage: { base: labelsMod.USAGE_LINES.length, appended: labelsMod.USAGE_LINES_I112.length },
      deps: deps.stdout.trim(), purityExit: purity.exitCode,
      reused: ['AC-22.full-suite.log', 'AC-22.main-chains.log', 'AC-22.diffset.txt'],
      checks: c.checks,
    }, null, 2));
  } finally {
    cleanupRoot(c.root);
  }
  return finish(c);
}

cli('AC-22', run, import.meta.url);
