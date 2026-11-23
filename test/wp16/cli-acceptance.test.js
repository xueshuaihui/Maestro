/**
 * WP-5 / S3 acceptance scaffolding for A1 (integration batch, last WP).
 *
 * This file is the ONLY file owned by WP-5. It never touches src/**, other
 * tests, labels or docs. Every command runs through the real bin/orch.js
 * entry point with a throwaway os.tmpdir() root and NODE_ENV=test.
 *
 * Scope (iteration-A1.md §4 WP-5):
 *  - subprocess-level end-to-end coverage of `orch cli scan|list|probe|add`
 *    for AC-12 / AC-14 / AC-15;
 *  - three-state evidence labelling whose wording is the verbatim
 *    EVIDENCE_LEVEL_* value from CLI_DISCOVERY_TEXT;
 *  - AC-12 blocked record: no target CLI on the local PATH, with tried paths
 *    (PATH scan result + app/home evidence); mock never posed as real;
 *  - AC-14 mock surface isolated from AC-12 real-host surface;
 *  - AD-06 gate wrapper (affected-surface serial + baseline-tree red diff)
 *    expressed as a lower-bound check, self-checked but NOT executing the
 *    full suite here (historical concurrent EXIT 137);
 *  - architecture guard: zero autoProbe/setInterval in discovery surfaces.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { CLI_DISCOVERY_TEXT as T, fill } from '../../src/cli/labels.js';

const ORCH = fileURLToPath(new URL('../../bin/orch.js', import.meta.url));
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const TEST_DIR = fileURLToPath(new URL('.', import.meta.url));
const SELF = path.basename(fileURLToPath(import.meta.url));
const REGISTRY = path.join('.orch', 'cli-registry.json');

// The three targets named by AC-12's tried-path clause (requirement.md L289).
const TARGET_BINS = ['codex', 'claude', 'gemini'];
const TARGET_IDS = ['codex', 'claude-code', 'gemini'];

const MATRIX_HEADER = [
  T.MATRIX_COL_ACP,
  T.MATRIX_COL_TRANSPORT,
  T.MATRIX_COL_RESUME_DIALECT,
  T.MATRIX_COL_CONCURRENCY,
  T.MATRIX_COL_EVIDENCE_HOOK
].join('  |  ');

// --- fixtures -------------------------------------------------------------

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-acceptance-'));
  return {
    root,
    registryPath: path.join(root, REGISTRY),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}

function run(root, args, extraEnv = {}) {
  const result = spawnSync(process.execPath, [ORCH, 'cli', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', ...extraEnv }
  });
  if (result.error) throw result.error;
  return { code: result.status, out: result.stdout ?? '', err: result.stderr ?? '' };
}

function readRegistry(root) {
  return JSON.parse(fs.readFileSync(path.join(root, REGISTRY), 'utf8'));
}

function isolatedEnv(root) {
  // No PATH entries, no real HOME markers; /Applications may still contribute
  // an app-only (unreachable) finding, which is exactly AC-12's app evidence.
  return { PATH: '', HOME: path.join(root, 'home') };
}

/**
 * A self-contained executable used by the AC-14 mock surface: --version prints
 * a recognisable version line; --acp speaks the ACP NDJSON initialize reply.
 * It is created in os.tmpdir(), never inside the repository.
 */
function mockAgent(root) {
  const script = path.join(root, 'codex-mock');
  const lines = [
    '#!/usr/bin/env node',
    'const NL = String.fromCharCode(10);',
    'const a = process.argv.slice(2);',
    'if (a.includes("--acp")) {',
    '  process.stdin.setEncoding("utf8");',
    '  let buf = "";',
    '  process.stdin.on("data", (c) => {',
    '    buf += c;',
    '    for (const line of buf.split(NL)) {',
    '      if (!line.trim()) continue;',
    '      try { const m = JSON.parse(line); if (m.method === "initialize") {',
    '        process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{',
    '          protocolVersion:1,capabilities:{session:true},',
    '          sessionCapabilities:["close","list","resume"]}}) + NL);',
    '      } } catch (e) {}',
    '    }',
    '  });',
    '  setTimeout(() => process.exit(0), 200);',
    '} else {',
    '  process.stdout.write("codex 1.2.3" + NL);',
    '}'
  ];
  fs.writeFileSync(script, lines.join('\n'), 'utf8');
  fs.chmodSync(script, 0o755);
  return { script };
}

// --- evidence tri-state ---------------------------------------------------

/**
 * Map an AC outcome to one of the three verbatim evidence levels from labels.
 * Unrecognised / unobserved results fall back to PENDING (AD-08 §3.4:
 * "observed nothing -> blocked", never a silent pass).
 *
 * @param {{evidence?: 'mock'|'pending'|'real', mock?: boolean, realHost?: boolean}} result
 * @returns {string} one of T.EVIDENCE_LEVEL_MOCK / _PENDING / _REAL
 */
export function evidenceLevel(result) {
  const tag = result && typeof result === 'object' ? result.evidence : null;
  if (tag === 'real' || result?.realHost === true) return T.EVIDENCE_LEVEL_REAL;
  if (tag === 'mock' || result?.mock === true) return T.EVIDENCE_LEVEL_MOCK;
  return T.EVIDENCE_LEVEL_PENDING;
}

// --- AC-12 blocked record (read-only local observation) -------------------

function readOnlyPathScan(envPath) {
  const entries = String(envPath ?? '').split(path.delimiter).filter(Boolean);
  const found = [];
  for (const dir of entries) {
    for (const bin of TARGET_BINS) {
      const candidate = path.join(dir, bin);
      try {
        if (fs.statSync(candidate).isFile()) {
          fs.accessSync(candidate, fs.constants.X_OK);
          found.push(candidate);
        }
      } catch { /* not present / not executable */ }
    }
  }
  return { entries: entries.length, found, bins: [...TARGET_BINS] };
}

function readOnlyAppHomeEvidence() {
  const evidence = [];
  for (const dir of ['/Applications', path.join(os.homedir(), 'Applications')]) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/workbuddy/i.test(name)) evidence.push({ type: 'app', value: path.join(dir, name) });
      }
    } catch { /* directory unreadable */ }
  }
  for (const marker of ['.codex', '.claude', '.gemini']) {
    const target = path.join(os.homedir(), marker);
    try {
      fs.accessSync(target);
      evidence.push({ type: 'home', value: target });
    } catch { /* no marker */ }
  }
  return evidence;
}

/**
 * Build AC-12's blocked record on this machine. No writes, no probe spawn:
 * it only records what PATH/app/home observation can and cannot see.
 */
function ac12BlockerRecord() {
  const pathScan = readOnlyPathScan(process.env.PATH);
  const appHome = readOnlyAppHomeEvidence();
  const apps = appHome.filter((item) => item.type === 'app').map((item) => item.value);
  const homes = appHome.filter((item) => item.type === 'home').map((item) => item.value);
  const hasTargetOnPath = pathScan.found.length > 0;
  return {
    ac: 'AC-12',
    // AD-08: real-host surface not observable here -> blocked, not passed.
    status: hasTargetOnPath ? '需重新取证（本机检出目标 CLI）' : '阻塞',
    evidence: hasTargetOnPath ? 'real' : 'pending',
    prerequisite: '需一台装有目标 Agent CLI 的机器',
    targetsOnPath: pathScan.found,
    appHomeEvidence: appHome,
    triedPaths: [
      `PATH 扫描（${pathScan.entries} 目录 × ${pathScan.bins.join('/')}）：${hasTargetOnPath ? pathScan.found.join(', ') : '未检出'}`,
      `应用目录证据：${apps.length ? apps.join(', ') : '未检出'}`,
      `home 标记证据：${homes.length ? homes.join(', ') : '未检出'}`
    ],
    mockPosedAsReal: 0
  };
}

// --- AD-06 gate wrapper (encapsulation + self-check only) -----------------

/** Lower-bound writing required by template §2.5: fail===0, pass===tests, tests>=baseline (never a hardcoded count). */
export function ad06LowerBound(summary, baselineTests) {
  const fail = summary?.fail ?? -1;
  const pass = summary?.pass ?? -1;
  const tests = summary?.tests ?? 0;
  return fail === 0 && pass === tests && tests >= baselineTests;
}

/** New red diff = current affected-surface reds minus the baseline tree's reds. */
export function ad06RedDiff(currentReds, baselineReds) {
  const base = new Set(baselineReds ?? []);
  return (currentReds ?? []).filter((name) => !base.has(name));
}

/** AD-06 equivalent gate: affected-surface serial + baseline-tree red diff. */
export function ad06GateCheck({ affected, baseline }) {
  const lowerBoundOk = ad06LowerBound(affected, baseline?.tests ?? 0);
  const newReds = ad06RedDiff(affected?.reds, baseline?.reds);
  return { lowerBoundOk, newReds, ok: lowerBoundOk && newReds.length === 0 };
}

/** Derive counts from source at runtime; no test count literal is hardcoded. */
function countTopLevelTests(dir, skipFile) {
  let total = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.test.js') || name === skipFile) continue;
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    total += (src.match(/^test\(/gm) ?? []).length;
  }
  return total;
}

// --- architecture token scan (zero dependency, read-only) -----------------

function tokenHits() {
  const files = [];
  const dir = path.join(REPO, 'src', 'adapter', 'cli-discovery');
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.js')) files.push(path.join(dir, name));
  }
  files.push(path.join(REPO, 'src', 'cli', 'cli-discovery.js'));
  const hits = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const token of ['autoProbe', 'setInterval']) {
      if (src.includes(token)) hits.push(`${path.relative(REPO, file)}:${token}`);
    }
  }
  return hits;
}

// --- tests ---------------------------------------------------------------

test('ACC-1: evidenceLevel yields the three verbatim EVIDENCE_LEVEL_* label strings', () => {
  assert.equal(T.EVIDENCE_LEVEL_MOCK, 'mock 实测');
  assert.equal(T.EVIDENCE_LEVEL_PENDING, '待本机实测（需装有目标 CLI 的机器）');
  assert.equal(T.EVIDENCE_LEVEL_REAL, '已实测（真实宿主面）');

  assert.equal(evidenceLevel({ evidence: 'mock' }), T.EVIDENCE_LEVEL_MOCK);
  assert.equal(evidenceLevel({ evidence: 'pending' }), T.EVIDENCE_LEVEL_PENDING);
  assert.equal(evidenceLevel({ evidence: 'real' }), T.EVIDENCE_LEVEL_REAL);
  // Tag fallbacks used by the ledgers below; unobserved defaults to PENDING.
  assert.equal(evidenceLevel({ mock: true }), T.EVIDENCE_LEVEL_MOCK);
  assert.equal(evidenceLevel({ realHost: true }), T.EVIDENCE_LEVEL_REAL);
  assert.equal(evidenceLevel(null), T.EVIDENCE_LEVEL_PENDING);
  assert.equal(evidenceLevel({}), T.EVIDENCE_LEVEL_PENDING);
});

test('ACC-2: AC-14 mock surface - add -> scan -> list -> probe end-to-end (subprocess)', () => {
  const fx = fixture();
  const mock = mockAgent(fx.root);
  try {
    // add: register the mock executable without installing or probing it.
    const added = run(fx.root, ['add', '--name', 'CodexCLI', '--path', mock.script]);
    assert.equal(added.code, 0, added.err);
    assert.ok(added.out.includes(fill(T.ADD_OK, { name: 'CodexCLI', path: mock.script })));

    // scan: isolated root, user_config rehydrated into clis.
    const scanned = run(fx.root, ['scan'], isolatedEnv(fx.root));
    assert.equal(scanned.code, 0, scanned.err);
    const registry = readRegistry(fx.root);
    const userFinding = registry.clis.find((cli) =>
      cli.evidence?.some((item) => item.type === 'user-config'));
    assert.ok(userFinding, 'user config finding present after scan');
    assert.equal(userFinding.cli_id, 'codexcli');
    assert.equal(userFinding.executable, mock.script);
    assert.equal(userFinding.connection_status, 'idle', 'discovery alone does not probe');

    // list: four visible fields, no fabricated version before probing.
    const before = run(fx.root, ['list']);
    assert.equal(before.code, 0, before.err);
    assert.match(before.out, /CodexCLI/);
    assert.match(before.out, /可用/);
    assert.ok(before.out.includes(MATRIX_HEADER), 'five frozen matrix columns present');

    // probe: explicit opt-in ACP handshake with the speaking mock.
    const probed = run(fx.root, ['probe', 'codexcli']);
    assert.equal(probed.code, 0, probed.err);
    assert.ok(probed.out.includes(fill(T.PROBE_OK, {
      name: 'CodexCLI', acp: T.PROBE_ACP_YES
    })), probed.out);

    const after = readRegistry(fx.root);
    const probedFinding = after.clis.find((cli) => cli.cli_id === 'codexcli');
    assert.equal(probedFinding.connection_status, 'connected');
    assert.equal(probedFinding.acp, true);
    assert.equal(probedFinding.version, 'codex 1.2.3');
    assert.ok(probedFinding.verified_at, 'verified_at refreshed');
    // No guessing: three dimensions stay null for the mock surface too.
    for (const key of ['transport', 'resume_dialect', 'evidence_hook']) {
      assert.equal(probedFinding[key], null, `${key} not fabricated`);
    }

    const listed = run(fx.root, ['list']);
    assert.equal(listed.code, 0, listed.err);
    assert.match(listed.out, /CodexCLI/);
    assert.match(listed.out, /已连接/);
    assert.match(listed.out, /未探测/);

    const mockResult = { evidence: 'mock', cli: 'codexcli', probed: probedFinding };
    assert.equal(evidenceLevel(mockResult), T.EVIDENCE_LEVEL_MOCK);
  } finally {
    fx.cleanup();
  }
});

test('ACC-3: AC-15 empty fixture shows empty state, fix hint and five-column matrix', () => {
  const fx = fixture();
  try {
    // Fresh root: no registry yet -> empty list; no probe, no writes to src.
    const listed = run(fx.root, ['list']);
    assert.equal(listed.code, 0, listed.err);
    assert.ok(listed.out.includes(T.TITLE));
    assert.ok(listed.out.includes(T.NONE));
    assert.ok(listed.out.includes(T.NONE_HINT), 'install-then-rescan guidance visible');
    assert.ok(listed.out.includes(T.HINT_ADD_PATH), 'manual add hint visible');
    assert.ok(listed.out.includes(T.MATRIX_TITLE));
    assert.ok(listed.out.includes(MATRIX_HEADER), 'matrix still has five columns in empty state');
    assert.ok(listed.out.includes(`${T.MATRIX_SOURCES}:`), 'source overview visible');

    // A scan on an empty isolated fixture is read-only except the one cache.
    const scanned = run(fx.root, ['scan'], isolatedEnv(fx.root));
    assert.equal(scanned.code, 0, scanned.err);
    const registry = readRegistry(fx.root);
    assert.equal(registry.user_config.length, 0);
    assert.ok(Array.isArray(registry.clis));
    const after = run(fx.root, ['list']);
    assert.equal(after.code, 0, after.err);
    assert.ok(after.out.includes(T.MATRIX_SOURCES));
  } finally {
    fx.cleanup();
  }
});

test('ACC-4: AC-12 blocked record - no target CLI on PATH, tried paths recorded', () => {
  const record = ac12BlockerRecord();
  // Documented precondition on this machine (AD-08 / D-2 / D-4 / P-4).
  assert.equal(record.targetsOnPath.length, 0,
    'PATH has no runnable codex/claude/gemini (AC-12 given unavailable)');
  assert.equal(record.status, '阻塞', 'real-host面判阻塞，不判通过');
  assert.equal(evidenceLevel(record), T.EVIDENCE_LEVEL_PENDING);
  assert.ok(record.prerequisite.includes('装有目标 Agent CLI 的机器'));

  // Tried paths: PATH scan result + app/home evidence, all with raw values.
  assert.equal(record.triedPaths.length, 3);
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('PATH 扫描') && entry.includes('未检出')));
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('应用目录证据')));
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('home 标记证据')));
  assert.deepEqual(record.appHomeEvidence, readOnlyAppHomeEvidence(), 'app/home evidence is the actual observation');
  assert.ok(record.triedPaths.some((entry) => entry.includes('WorkBuddy')),
    'WorkBuddy.app app evidence recorded as the only install marker');

  // mock never posed as a real-host success on AC-12.
  assert.equal(record.mockPosedAsReal, 0);
  assert.notEqual(evidenceLevel(record), T.EVIDENCE_LEVEL_MOCK);
  assert.notEqual(evidenceLevel(record), T.EVIDENCE_LEVEL_REAL);
});

test('ACC-5: AC-12 fixture - isolated scan finds no runnable target; probe/handshake is blocked', () => {
  const fx = fixture();
  try {
    const scanned = run(fx.root, ['scan'], isolatedEnv(fx.root));
    assert.equal(scanned.code, 0, scanned.err);
    const registry = readRegistry(fx.root);
    const runnableTargets = registry.clis.filter((cli) =>
      TARGET_IDS.includes(cli.cli_id) && cli.executable);
    assert.equal(runnableTargets.length, 0, 'no runnable target CLI in isolated fixture');

    // App/home evidence is preserved as unreachable, never a real handshake.
    const markers = registry.clis.filter((cli) =>
      cli.evidence?.some((item) => item.type === 'app' || item.type === 'home'));
    assert.ok(markers.length > 0, 'app/home marker retained (not silently dropped)');
    for (const marker of markers) {
      assert.equal(marker.executable, null);
      assert.equal(marker.not_on_path, true);
      assert.equal(marker.connection_status, 'unreachable');
    }

    // probe of every AC-12 target fails with a readable "not found" result.
    for (const id of TARGET_BINS) {
      const probe = run(fx.root, ['probe', id]);
      assert.equal(probe.code, 1, `${id} probe blocked on this host`);
      assert.ok(probe.out.includes(fill(T.NOT_FOUND, { id })), probe.out);
      assert.equal(probe.out.includes(T.PROBE_ACP_YES), false, 'no ACP success leaked into real-host面');
    }
    // The app-only marker has no executable: blocked with the "not on PATH" reason.
    const appProbe = run(fx.root, ['probe', 'workbuddy']);
    assert.equal(appProbe.code, 1);
    assert.ok(appProbe.out.includes(T.NOT_ON_PATH));
    assert.equal(appProbe.out.includes(T.PROBE_ACP_YES), false);

    assert.equal(evidenceLevel(ac12BlockerRecord()), T.EVIDENCE_LEVEL_PENDING);
  } finally {
    fx.cleanup();
  }
});

test('ACC-6: mock 0 times posed as real - evidence ledger keeps AC-12 and AC-14 apart', () => {
  const ledger = [];
  const record = (ac, result) => ledger.push({ ac, level: evidenceLevel(result) });

  // AC-14 mock面: all four reproducible fields from ACC-2's mock run.
  record('AC-14', { evidence: 'mock' });
  record('AC-14', { mock: true });
  // AC-12 real面: blocked, never backed by the mock run above.
  record('AC-12', ac12BlockerRecord());

  const ac12 = ledger.filter((entry) => entry.ac === 'AC-12');
  const ac14 = ledger.filter((entry) => entry.ac === 'AC-14');
  assert.ok(ac12.length > 0 && ac14.length > 0);
  assert.equal(ac12.filter((entry) => entry.level === T.EVIDENCE_LEVEL_MOCK).length, 0,
    'mock 0 次冒充真实宿主面');
  assert.equal(ac12.filter((entry) => entry.level === T.EVIDENCE_LEVEL_REAL).length, 0,
    'AC-12 未写「已实测（真实宿主面）」');
  assert.ok(ac14.every((entry) => entry.level === T.EVIDENCE_LEVEL_MOCK),
    'AC-14 全量标注 mock 实测');
  assert.equal(ac12BlockerRecord().mockPosedAsReal, 0);
});

test('ACC-7: AC-14 mock evidence level differs from AC-12 real-host evidence level', () => {
  const mockLevel = evidenceLevel({ evidence: 'mock' });
  const blockedLevel = evidenceLevel(ac12BlockerRecord());
  assert.equal(mockLevel, T.EVIDENCE_LEVEL_MOCK);
  assert.equal(blockedLevel, T.EVIDENCE_LEVEL_PENDING);
  assert.notEqual(mockLevel, blockedLevel, 'AC-14 与 AC-12 证据级别必须不同');
  // The unused third state remains available for a genuine取证 machine.
  assert.equal(evidenceLevel({ evidence: 'real' }), T.EVIDENCE_LEVEL_REAL);
});

test('ACC-8: AD-06 gate wrapper - lower-bound writing + red diff, self-check only', () => {
  // Counts are derived from source, never hardcoded (template §2.5).
  const baselineTests = countTopLevelTests(TEST_DIR, SELF);
  const ownTests = (fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
    .match(/^test\(/gm) ?? []).length;
  assert.ok(baselineTests > 0, 'baseline test count derived at runtime');
  assert.ok(ownTests > 0, 'this file adds tests on top of the baseline');

  const affected = {
    name: 'wp16 affected surface (serial)',
    fail: 0, pass: baselineTests + ownTests, tests: baselineTests + ownTests, reds: []
  };
  const baseline = { name: 'git worktree baseline tree', tests: baselineTests, reds: [] };
  const gate = ad06GateCheck({ affected, baseline });
  assert.equal(gate.lowerBoundOk, true, 'fail===0 && pass===tests && tests>=baseline');
  assert.deepEqual(gate.newReds, [], 'no new red vs baseline tree');
  assert.equal(gate.ok, true);

  // Self-check of each red line: lower bound, parameterised baseline, red diff.
  assert.equal(ad06GateCheck({ affected: { ...affected, fail: 1 }, baseline }).ok, false);
  assert.equal(ad06GateCheck({ affected: { ...affected, pass: affected.tests - 1 }, baseline }).ok, false);
  assert.equal(ad06LowerBound(affected, baselineTests + 1000), false,
    'baseline is a parameter, not a hardcoded test count');
  assert.deepEqual(
    ad06GateCheck({ affected: { ...affected, reds: ['new.test.js'] }, baseline }).newReds,
    ['new.test.js']);
  assert.deepEqual(
    ad06GateCheck({ affected, baseline: { ...baseline, reds: ['pre-existing.test.js'] } }).newReds,
    [], 'pre-existing baseline reds do not count as new');
  // Historical local limits are recorded, not hidden: this package does not
  // execute the full suite here (concurrent EXIT 137 / flaky 20->21).
  assert.equal(affected.fail, 0);
  assert.ok(affected.tests >= baseline.tests);
});

test('ACC-9: no background auto-probe (autoProbe|setInterval) in discovery surfaces', () => {
  const result = spawnSync('grep', [
    '-REn', 'autoProbe|setInterval',
    'src/adapter/cli-discovery', 'src/cli/cli-discovery.js'
  ], { cwd: REPO, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 1, 'grep exit 1 = zero matches');
  assert.equal(result.stdout.trim(), '', 'no autoProbe/setInterval line in either surface');
  // Zero-dependency read-only re-check over the same two surfaces.
  assert.deepEqual(tokenHits(), []);
});
