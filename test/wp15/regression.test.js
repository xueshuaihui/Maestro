/**
 * I1.12 WP-7 / AC-22 regression STRUCTURAL gatekeeper tests.
 *
 * This file does NOT recursively run the full suite (that would re-enter
 * itself) and does NOT claim a full run or the three main chains were
 * executed here. Per decision D-5, the full suite (tests >= 1425 + zero
 * difference set) and the three verbatim main-chain comparisons are acceptance
 * evidence collected by S3 and re-checked by S4. `judgeRun` below is the
 * decision-G contract function S3 consumes against a real summary.json /
 * results.jsonl; the synthetic summaries in this file only pin its semantics.
 * What runs here are the fast architecture gates directly:
 *   - tests >= 1425 + allowance-set difference contract (static judgeRun)
 *   - purity: 31 forbidden words, both directory sets, exit 0 (spawnSync)
 *   - dependencies === {}
 *   - three main chains / USAGE_LINES / command tables frozen (static registration)
 *   - transit( hit set unchanged
 * No new total test count is hardcoded here.
 *
 * No CJK literal and no inline unicode escape: expected strings come from
 * requirement.md / the frozen baseline files at runtime.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { USAGE_LINES } from '../../src/cli/labels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8').replace(/\r\n/g, '\n');
const CJK = new RegExp(
  '[' + String.fromCharCode(0x4e00) + '-' + String.fromCharCode(0x9fff) + ']',
);
const MARKER = String.fromCharCode(92) + 'u';
const TESTS_BASELINE = 1425;

/** 31-word forbid list, parsed from the AC-22 machine check in requirement.md. */
function forbidList() {
  const text = read('docs/iterations/iteration-12/requirement.md');
  const match = /FORBID="([^"]+)"/.exec(text);
  assert.ok(match, 'FORBID list not found in AC-22');
  const words = match[1].split(',');
  assert.equal(words.length, 31, 'forbid list must be exactly 31 words');
  return match[1];
}

/** Allowed failures from the frozen win32 baseline file. */
function win32Allowed() {
  const text = read('docs/iterations/iteration-10a/baseline-failures-win32.txt');
  const names = text.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  assert.equal(names.length, 16, 'win32 baseline must register 16 entries');
  return new Set(names);
}

/**
 * Decision-G equivalent semantics: clean = fail 0 && pass === tests; allowed =
 * tests >= baseline && counts consistent && every failure named &&
 * (failNames \ allowed) === []. No absolute fail count is hardcoded.
 *
 * S3 feeds this function a REAL summary produced by the full-suite run; the
 * cases in the test below are synthetic contract shapes, not a claim that a
 * full run happened here (decision D-5).
 */
function judgeRun(summary, allowedSet, baseline = TESTS_BASELINE) {
  const failNames = Array.isArray(summary.failNames) ? summary.failNames : [];
  const testsOk = Number.isInteger(summary.tests) && summary.tests >= baseline;
  const consistent =
    Number.isInteger(summary.tests) && Number.isInteger(summary.pass) && Number.isInteger(summary.fail) &&
    summary.pass + summary.fail + (summary.skipped ?? 0) === summary.tests;
  const diff = failNames.filter((name) => !allowedSet.has(name));
  const named = failNames.every((name) => typeof name === 'string' && name.length > 0);
  const clean = summary.fail === 0 && summary.pass === summary.tests;
  return {
    diff,
    pass: Boolean(testsOk && consistent && named && summary.fail === failNames.length && diff.length === 0 &&
      (clean || failNames.length > 0 || summary.fail === 0)),
  };
}

// ---------------------------------------------------------------------------
// 1. Full-suite >= 1425 + difference-set-zero contract (no recursion)
// ---------------------------------------------------------------------------

test('full-suite baseline >= 1425 and allowance set is structurally complete', () => {
  assert.ok(TESTS_BASELINE >= 1425);
  const drill = read('test/wp14/regression-drill.test.js');
  assert.ok(drill.includes('const TESTS_BASELINE = 1425;'));
  const ac22 = read('docs/iterations/iteration-12/requirement.md');
  assert.ok(ac22.includes('--test-concurrency=1'));
  assert.ok(ac22.includes('--test-timeout=120000'));
  assert.ok(ac22.includes('--test-force-exit'));
  assert.equal(win32Allowed().size, 16);
});

test('judgeRun: clean / registered subset / new red / under-baseline / inconsistent', () => {
  const allowed = win32Allowed();
  const first = [...allowed][0];
  assert.equal(judgeRun({ tests: 1468, pass: 1468, fail: 0, skipped: 0, failNames: [] }, allowed).pass, true);
  const subset = judgeRun({ tests: 1468, pass: 1453, fail: 2, skipped: 13, failNames: [first, [...allowed][1]] }, allowed);
  assert.equal(subset.pass, true);
  assert.deepEqual(subset.diff, []);
  const newRed = judgeRun({ tests: 1468, pass: 1454, fail: 1, skipped: 13, failNames: ['NEW_RED'] }, allowed);
  assert.equal(newRed.pass, false);
  assert.deepEqual(newRed.diff, ['NEW_RED']);
  assert.equal(judgeRun({ tests: 1424, pass: 1424, fail: 0, skipped: 0, failNames: [] }, allowed).pass, false);
  assert.equal(judgeRun({ tests: 1468, pass: 1400, fail: 1, skipped: 13, failNames: [] }, allowed).pass, false);
});

// ---------------------------------------------------------------------------
// 2. Purity: 31 forbid words, both directory sets, exit 0
// ---------------------------------------------------------------------------

test('purity-check exits 0 for src/core,src/daemon and desktop/ui,desktop/harness', () => {
  const forbid = forbidList();
  const checker = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');
  assert.equal(fs.existsSync(checker), true);
  for (const dirs of ['src/core,src/daemon', 'desktop/ui,desktop/harness']) {
    const res = spawnSync(process.execPath, [checker, '--dirs', dirs, '--forbid', forbid], {
      cwd: REPO,
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
    });
    assert.equal(res.status, 0, `purity ${dirs} failed:\n${res.stdout}\n${res.stderr}`);
  }
});

test('dependencies is the empty object', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

// ---------------------------------------------------------------------------
// 3. Three main chains / USAGE_LINES / command tables frozen
// ---------------------------------------------------------------------------

test('three main-chain baselines remain registered in the frozen regression drill', () => {
  const drill = read('test/wp14/regression-drill.test.js');
  assert.ok(drill.includes('const CHAINS = {'));
  for (const key of ['single:', "'code-loop':", "'task-loop':"]) {
    assert.ok(drill.includes(key), `main chain baseline missing: ${key}`);
  }
  assert.ok(drill.includes('baseline: ['));
  assert.ok(drill.includes('assert.equal(USAGE_LINES.length, 25'));
  assert.ok(drill.includes('normalizeLine'));
});

test('AC-22: USAGE_LINES 25 lines and command tables are unchanged', () => {
  assert.equal(USAGE_LINES.length, 25);
  assert.ok(USAGE_LINES[0].includes('orch run|status|cancel|core'));
  assert.ok(USAGE_LINES[24].includes('orch workflow dry-run'));
  const main = read('src/cli/main.js');
  assert.ok(main.includes("const COMMANDS = new Set(['run', 'status', 'cancel', 'core', 'role', 'skill', 'workflow']);"));
  assert.ok(main.includes("role: new Set(['list', 'show', 'validate', 'create', 'edit', 'export', 'import', 'diff'])"));
  assert.ok(main.includes("skill: new Set(['list', 'show', 'create', 'validate', 'export', 'import'])"));
  assert.ok(main.includes("workflow: new Set(['list', 'show', 'create', 'validate', 'diff', 'dry-run'])"));
});

// ---------------------------------------------------------------------------
// 4. transit() single entry + new source hygiene
// ---------------------------------------------------------------------------

test('transit( hit set matches the frozen baseline (unique migration entry)', () => {
  const files = ['src/core/orchestrator.js', 'src/core/state-machine.js'];
  const total = files
    .map((f) => read(f).split('\n').filter((line) => line.includes('transit(')).length)
    .reduce((a, b) => a + b, 0);
  assert.equal(total, 6);
  const orch = read('src/core/orchestrator.js');
  assert.equal((orch.match(/async function transit\(/g) ?? []).length, 1);
});

test('new source files carry no CJK literal and no inline unicode escape', () => {
  for (const rel of [
    'src/cli/verify.js',
    'test/wp15/wiring.test.js',
    'test/wp15/regression.test.js',
  ]) {
    const source = read(rel);
    assert.equal(CJK.test(source), false, `${rel} contains a CJK literal`);
    assert.equal(source.includes(MARKER), false, `${rel} contains an inline unicode escape`);
  }
});
