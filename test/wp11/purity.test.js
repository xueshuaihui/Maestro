/**
 * Architecture guards for I1.5 (WP-6, AC-40 / AC-41 / AC-43).
 *
 * Every assertion here shells out to the same command the requirement prints, so the
 * evidence can be reproduced by hand. The word lists differ per command on purpose:
 * `src/registry` must be scanned with 30 words because `GROUPS` legitimately spells
 * `coordinator` as a group value (D-7's v5 correction).
 *
 * AC-42 (the whole suite stays green without editing an existing assertion) is not
 * covered here — a test cannot assert its own run. The main controller records the
 * full `node --test` run over `test/` for that one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TEST_DIR, '..', '..');
const SCRIPT = path.join(REPO, 'test', 'fixtures', 'purity-check.mjs');

/** D-7's full 31-word table (used for `src/core,src/daemon` and `src/cli/roles.js`). */
const WORDS_31 = [
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
  'compliance-check'
];

/**
 * D-7's 30-word table for `src/registry`: same list minus `coordinator`, which has to
 * appear there as a group value. Scanning with 31 would fail by construction.
 */
const WORDS_30 = WORDS_31.filter((word) => word !== 'coordinator');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: REPO,
    encoding: 'utf8'
  });
}

function runNode(code) {
  return spawnSync(process.execPath, ['-e', code], { cwd: REPO, encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// AC-40: three scans plus the one-hit pin
// ---------------------------------------------------------------------------

test('AC-40 #1: src/core,src/daemon is free of the 31 forbidden words', () => {
  const result = run(['--dirs', 'src/core,src/daemon', '--forbid', WORDS_31.join(',')]);

  assert.equal(result.status, 0, result.stdout);
  assert.ok(result.stdout.startsWith('OK: 扫描 '), result.stdout);
  assert.ok(result.stdout.includes('零命中'), result.stdout);
});

test('AC-40 #2: src/registry is free of the 30 forbidden words', () => {
  const result = run(['--dirs', 'src/registry', '--forbid', WORDS_30.join(',')]);

  assert.equal(result.status, 0, result.stdout);
  assert.ok(result.stdout.startsWith('OK: 扫描 '), result.stdout);
  assert.equal(WORDS_30.length, 30);
  assert.equal(WORDS_31.length, 31);
});

test('AC-40 #3: src/cli/roles.js alone is free of the 31 forbidden words', () => {
  const result = run(['--files', 'src/cli/roles.js', '--forbid', WORDS_31.join(',')]);

  assert.equal(result.status, 0, result.stdout);
  assert.ok(result.stdout.startsWith('OK: 扫描 1 个文件，src/cli/roles.js'), result.stdout);
});

test('AC-40 pin: coordinator appears exactly once in src/registry, on the GROUPS line', () => {
  // `purity-check` exits 1 whenever it has a hit, and this scan always has one, so the
  // verdict comes from `--json` — asserting exit 0 here would contradict itself.
  const result = run(['--dirs', 'src/registry', '--forbid', 'coordinator', '--json']);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.hits.length, 1, JSON.stringify(payload.hits));
  assert.equal(payload.hits[0].file, 'src/registry/role-schema.js');
  assert.match(payload.hits[0].snippet, /GROUPS/);
  assert.equal(payload.files, null);
});

// ---------------------------------------------------------------------------
// AC-43: no CJK outside labels.js
// ---------------------------------------------------------------------------

test('AC-43: src/registry and src/cli/roles.js hold no CJK character', () => {
  // Verbatim from the requirement, so the check can be rerun by hand.
  const code = [
    "const fs=require('fs'),path=require('path');",
    'const bad=[];',
    'const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);',
    "  if(e.isDirectory()) walk(p); else if(/[\\u4e00-\\u9fff]/.test(fs.readFileSync(p,'utf8'))) bad.push(p);}};",
    "walk('src/registry');",
    "for(const f of ['src/cli/roles.js']) if(/[\\u4e00-\\u9fff]/.test(fs.readFileSync(f,'utf8'))) bad.push(f);",
    "if(bad.length){console.log('命中：'+bad.join(', '));process.exit(1);}console.log('OK: CJK 零命中');"
  ].join('\n');

  const result = runNode(code);
  assert.equal(result.status, 0, result.stdout);
  assert.equal(result.stdout.trim(), 'OK: CJK 零命中');
});

// ---------------------------------------------------------------------------
// AC-41: zero runtime dependencies
// ---------------------------------------------------------------------------

test('AC-41: package.json has no runtime dependency', () => {
  const result = runNode(
    "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '0');
});

// ---------------------------------------------------------------------------
// `--files` itself (split doc 2.12)
// ---------------------------------------------------------------------------

test('--files scans exactly the listed files and ignores --dirs', () => {
  const result = run([
    '--files',
    'src/cli/roles.js',
    '--dirs',
    'src/core',
    '--forbid',
    'coordinator',
    '--json'
  ]);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.scannedFiles, 1);
  assert.deepEqual(payload.files, ['src/cli/roles.js']);
  assert.deepEqual(payload.dirs, [], '--dirs must not survive alongside --files');
  assert.equal(payload.hits.length, 0);
});

test('--files on a missing path exits 2 instead of reporting a clean tree', () => {
  const result = run(['--files', 'src/does-not-exist.js', '--forbid', 'zzz']);

  assert.equal(result.status, 2);
  assert.equal(result.stdout.trim(), '文件不存在：src/does-not-exist.js');
});

test('without --files the default scope is unchanged', () => {
  const result = run(['--forbid', 'zzzz-not-present', '--json']);

  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.dirs, ['src/core', 'src/daemon']);
  assert.equal(payload.files, null);
  assert.equal(payload.ok, true);
  assert.ok(payload.scannedFiles > 0);
});
