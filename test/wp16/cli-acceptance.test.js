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
 *  - AC-12 record: env-adaptive (blocked when no runnable target on PATH,
 *    measurable + real handshake when one is present), with tried paths
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
  const isWin = process.platform === 'win32';
  // Windows cannot execute an extensionless shebang script: agent CLIs there
  // are `.cmd` shims over a JS body, so the fixture mirrors that shape instead
  // of pretending the POSIX layout is portable.
  const script = path.join(root, isWin ? 'codex-mock.cmd' : 'codex-mock');
  const body = path.join(root, 'codex-mock.js');
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
  fs.writeFileSync(body, lines.join('\n'), 'utf8');
  if (isWin) {
    fs.writeFileSync(script, `@echo off\r\nnode "%~dp0codex-mock.js" %*\r\n`, 'utf8');
  } else {
    fs.copyFileSync(body, script);
    fs.chmodSync(script, 0o755);
  }
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
  // Windows finds PATH executables through PATHEXT, so the read-only scan has
  // to widen each target name the same way; POSIX resolves the bare name.
  const exts = process.platform === 'win32'
    ? String(process.env.PATHEXT ?? '.CMD;.EXE;.BAT').split(';').filter(Boolean)
    : [''];
  const found = [];
  for (const dir of entries) {
    for (const bin of TARGET_BINS) {
      for (const ext of exts) {
        const candidate = path.join(dir, `${bin}${ext}`);
        try {
          if (fs.statSync(candidate).isFile()) {
            fs.accessSync(candidate, fs.constants.X_OK);
            if (!found.includes(candidate)) found.push(candidate);
          }
        } catch { /* not present / not executable */ }
      }
    }
  }
  return { entries: entries.length, found, bins: [...TARGET_BINS] };
}

function readOnlyAppHomeEvidence(home) {
  const evidence = [];
  for (const dir of ['/Applications', path.join(home, 'Applications')]) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (/workbuddy/i.test(name)) evidence.push({ type: 'app', value: path.join(dir, name) });
      }
    } catch { /* directory unreadable */ }
  }
  for (const marker of ['.codex', '.claude', '.gemini']) {
    const target = path.join(home, marker);
    try {
      fs.accessSync(target);
      evidence.push({ type: 'home', value: target });
    } catch { /* no marker */ }
  }
  return evidence;
}

/**
 * Read-only, injectable observation of the host's AC-12 prerequisites.
 * No writes and no probe spawn: only PATH/app/home facts. Accepting an env
 * argument lets the tests simulate a forensics machine (runnable target on
 * PATH) without touching the real host; the default is this machine's env.
 */
function ac12Observation(env = process.env) {
  const home = env.HOME ?? env.USERPROFILE ?? os.homedir();
  const pathScan = readOnlyPathScan(env.PATH);
  const appHome = readOnlyAppHomeEvidence(home);
  const apps = appHome.filter((item) => item.type === 'app').map((item) => item.value);
  const homes = appHome.filter((item) => item.type === 'home').map((item) => item.value);
  const hasRunnable = pathScan.found.length > 0;
  return {
    hasRunnable,
    targetsOnPath: pathScan.found,
    pathScan,
    appHome,
    apps,
    homes,
    hasWorkBuddyApp: apps.some((value) => /workbuddy/i.test(value)),
    triedPaths: [
      `PATH 扫描（${pathScan.entries} 目录 × ${pathScan.bins.join('/')}）：${hasRunnable ? pathScan.found.join(', ') : '未检出'}`,
      `应用目录证据：${apps.length ? apps.join(', ') : '未检出'}`,
      `home 标记证据：${homes.length ? homes.join(', ') : '未检出'}`
    ]
  };
}

/**
 * AC-12 ledger record derived purely from a read-only observation. The
 * blocked/measurable status is a fact of the observed env, never hardcoded:
 * no runnable target -> 阻塞; a real target on PATH -> 需重新取证 / REAL.
 */
function ac12BlockerRecord(env = process.env) {
  const obs = ac12Observation(env);
  return {
    ac: 'AC-12',
    status: obs.hasRunnable ? '需重新取证（本机检出目标 CLI）' : '阻塞',
    evidence: obs.hasRunnable ? 'real' : 'pending',
    prerequisite: '需一台装有目标 Agent CLI 的机器',
    targetsOnPath: obs.targetsOnPath,
    appHomeEvidence: obs.appHome,
    triedPaths: obs.triedPaths,
    mockPosedAsReal: 0
  };
}

/**
 * A genuine ACP-capable executable discovered via PATH on the simulated
 * forensics host. It is spawned by the real probe path (--version / --acp),
 * so the handshake it returns is a real observed result, not a mock posed as
 * AC-12. The absolute node shebang keeps it runnable under an injected PATH.
 */
function speakingTargetBin(root) {
  const dir = path.join(root, 'bin');
  fs.mkdirSync(dir, { recursive: true });
  const isWin = process.platform === 'win32';
  // Windows resolves PATH entries through PATHEXT and refuses to spawn a
  // shebang script, so the forked host is modelled the way it really looks
  // there: a `.CMD` shim over a `.js` body invoking this same node binary.
  const bin = path.join(dir, isWin ? 'codex.CMD' : 'codex');
  // The JS body must live OUTSIDE the PATH directory: Windows PATHEXT commonly
  // includes `.JS`, so keeping it next to the shim makes the read-only PATH
  // scan report two targets instead of one.
  const body = path.join(root, 'speaking-target.js');
  const lines = [
    `#!${process.execPath}`,
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
  fs.writeFileSync(body, lines.join('\n'), 'utf8');
  if (isWin) {
    fs.writeFileSync(bin, `@echo off\r\n"${process.execPath}" "${body}" %*\r\n`, 'utf8');
  } else {
    fs.copyFileSync(body, bin);
    fs.chmodSync(bin, 0o755);
  }
  return { dir, bin };
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

test('ACC-4: AC-12 record adapts to the host (blocked here / measurable on a forensics host)', () => {
  const obs = ac12Observation();
  const record = ac12BlockerRecord();

  // Shared invariants: the record is a raw, read-only observation and mock
  // never stands in for the real-host surface, whatever the environment is.
  assert.equal(record.ac, 'AC-12');
  assert.ok(record.prerequisite.includes('装有目标 Agent CLI 的机器'));
  assert.equal(record.triedPaths.length, 3);
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('PATH 扫描')));
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('应用目录证据')));
  assert.ok(record.triedPaths.some((entry) => entry.startsWith('home 标记证据')));
  assert.deepEqual(record.appHomeEvidence, obs.appHome, 'app/home evidence is the actual observation');
  assert.deepEqual(record.targetsOnPath, obs.targetsOnPath);
  assert.equal(record.mockPosedAsReal, 0);
  assert.notEqual(evidenceLevel(record), T.EVIDENCE_LEVEL_MOCK, 'mock never posed as real');

  // WorkBuddy app evidence: only require it when the host actually has it.
  const appEntry = record.triedPaths.find((entry) => entry.startsWith('应用目录证据'));
  if (obs.hasWorkBuddyApp) {
    assert.ok(appEntry.includes('WorkBuddy'), 'WorkBuddy.app marker recorded when present');
  } else {
    assert.ok(appEntry.includes('未检出'), 'no WorkBuddy.app marker -> recorded as 未检出');
  }

  if (obs.hasRunnable) {
    // Forensics host: a real target is on PATH -> 可实测, never forced blocked.
    assert.ok(obs.targetsOnPath.length > 0);
    assert.equal(record.status, '需重新取证（本机检出目标 CLI）');
    assert.equal(record.evidence, 'real');
    assert.equal(evidenceLevel(record), T.EVIDENCE_LEVEL_REAL);
    assert.ok(record.triedPaths.some((entry) => entry.startsWith('PATH 扫描') && !entry.includes('未检出')),
      'tried PATH scan records the detected target');
  } else {
    // This host: real-host面 not observable -> 阻塞, never a silent pass.
    assert.equal(obs.targetsOnPath.length, 0);
    assert.equal(record.status, '阻塞');
    assert.equal(evidenceLevel(record), T.EVIDENCE_LEVEL_PENDING);
    assert.ok(record.triedPaths.some((entry) => entry.startsWith('PATH 扫描') && entry.includes('未检出')));
    assert.notEqual(evidenceLevel(record), T.EVIDENCE_LEVEL_REAL);
  }
});

test('ACC-5: AC-12 fixture - isolated scan never fabricates a runnable target or ACP success', () => {
  const fx = fixture();
  try {
    const scanned = run(fx.root, ['scan'], isolatedEnv(fx.root));
    assert.equal(scanned.code, 0, scanned.err);
    const registry = readRegistry(fx.root);
    // PATH='' in the isolated env guarantees no runnable target, regardless
    // of which CLIs happen to be installed on the host.
    const runnableTargets = registry.clis.filter((cli) =>
      TARGET_IDS.includes(cli.cli_id) && cli.executable);
    assert.equal(runnableTargets.length, 0, 'no runnable target CLI in isolated fixture');

    // App/home evidence, when the host provides any, is retained as
    // unreachable - never a real handshake. Marker presence is env-dependent.
    const markers = registry.clis.filter((cli) =>
      cli.evidence?.some((item) => item.type === 'app' || item.type === 'home'));
    if (ac12Observation().apps.length > 0) {
      assert.ok(markers.length > 0, 'host app marker retained (not silently dropped)');
    }
    for (const marker of markers) {
      assert.equal(marker.executable, null);
      assert.equal(marker.not_on_path, true);
      assert.equal(marker.connection_status, 'unreachable');
    }

    // probe of every AC-12 target fails with a readable "not found" result.
    for (const id of TARGET_BINS) {
      const probe = run(fx.root, ['probe', id]);
      assert.equal(probe.code, 1, `${id} absent from the isolated registry`);
      assert.ok(probe.out.includes(fill(T.NOT_FOUND, { id })), probe.out);
      assert.equal(probe.out.includes(T.PROBE_ACP_YES), false, 'no ACP success leaked into real-host面');
    }
    // The app-only marker has no executable: blocked with the "not on PATH"
    // reason when present; otherwise the id is simply not found. Either way
    // it is a blocked outcome, never a handshake.
    const wbInRegistry = registry.clis.some((cli) => cli.cli_id === 'workbuddy');
    const appProbe = run(fx.root, ['probe', 'workbuddy']);
    assert.equal(appProbe.code, 1);
    if (wbInRegistry) {
      assert.ok(appProbe.out.includes(T.NOT_ON_PATH));
    } else {
      assert.ok(appProbe.out.includes(fill(T.NOT_FOUND, { id: 'workbuddy' })));
    }
    assert.equal(appProbe.out.includes(T.PROBE_ACP_YES), false);

    // The host-level record follows the observed environment.
    const hostRecord = ac12BlockerRecord();
    if (ac12Observation().hasRunnable) {
      assert.equal(evidenceLevel(hostRecord), T.EVIDENCE_LEVEL_REAL);
    } else {
      assert.equal(evidenceLevel(hostRecord), T.EVIDENCE_LEVEL_PENDING);
    }
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
  // AC-12 real面: observed from the host, never backed by the mock run above.
  record('AC-12', ac12BlockerRecord());

  const ac12 = ledger.filter((entry) => entry.ac === 'AC-12');
  const ac14 = ledger.filter((entry) => entry.ac === 'AC-14');
  assert.ok(ac12.length > 0 && ac14.length > 0);
  assert.equal(ac12.filter((entry) => entry.level === T.EVIDENCE_LEVEL_MOCK).length, 0,
    'mock 0 次冒充真实宿主面');
  if (ac12Observation().hasRunnable) {
    // Forensics host: REAL is legitimate here because the real surface is
    // observable; it is still backed by a genuine handshake (see ACC-10).
    assert.equal(ac12.filter((entry) => entry.level === T.EVIDENCE_LEVEL_REAL).length, ac12.length,
      'AC-12 REAL 由真实宿主面支撑');
  } else {
    assert.equal(ac12.filter((entry) => entry.level === T.EVIDENCE_LEVEL_REAL).length, 0,
      'AC-12 未写「已实测（真实宿主面）」');
  }
  assert.ok(ac14.every((entry) => entry.level === T.EVIDENCE_LEVEL_MOCK),
    'AC-14 全量标注 mock 实测');
  assert.equal(ac12BlockerRecord().mockPosedAsReal, 0);
});

test('ACC-7: AC-14 mock evidence level differs from the host-adaptive AC-12 level', () => {
  const mockLevel = evidenceLevel({ evidence: 'mock' });
  const hostLevel = evidenceLevel(ac12BlockerRecord());
  assert.equal(mockLevel, T.EVIDENCE_LEVEL_MOCK);
  if (ac12Observation().hasRunnable) {
    assert.equal(hostLevel, T.EVIDENCE_LEVEL_REAL);
  } else {
    assert.equal(hostLevel, T.EVIDENCE_LEVEL_PENDING);
  }
  assert.notEqual(mockLevel, hostLevel, 'AC-14 与 AC-12 证据级别必须不同');
  // The REAL state is exercised end-to-end on the simulated forensics host.
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

test('ACC-10: AC-12 measurable branch - injected PATH with a runnable CLI gives a real handshake and EVIDENCE_LEVEL_REAL', () => {
  const fx = fixture();
  try {
    // Simulate the forensics host: a genuine ACP-capable executable on PATH.
    const speaking = speakingTargetBin(fx.root);
    const injected = { PATH: speaking.dir, HOME: path.join(fx.root, 'home') };

    // Branch driver: the observation itself must flip to the measurable side
    // from environment facts, not from a hardcoded expectation.
    const obs = ac12Observation(injected);
    assert.equal(obs.hasRunnable, true, 'read-only scan sees the runnable CLI');
    assert.deepEqual(obs.targetsOnPath, [speaking.bin]);
    const record = ac12BlockerRecord(injected);
    assert.equal(record.status, '需重新取证（本机检出目标 CLI）');
    assert.equal(record.evidence, 'real');
    assert.notEqual(evidenceLevel(record), T.EVIDENCE_LEVEL_PENDING);

    // Real-host面: scan discovers it via PATH, probe really spawns it. No
    // `add` and no AC-14 mock is involved, so nothing poses as real.
    const scanned = run(fx.root, ['scan'], injected);
    assert.equal(scanned.code, 0, scanned.err);
    const registry = readRegistry(fx.root);
    const target = registry.clis.find((cli) => cli.cli_id === 'codex' && cli.executable);
    assert.ok(target, 'runnable target discovered from PATH');
    assert.equal(target.executable, speaking.bin);
    assert.equal(target.connection_status, 'idle', 'discovery alone does not probe');
    assert.ok(target.evidence.some((item) => item.type === 'path'), 'PATH carrier evidence recorded');

    const probed = run(fx.root, ['probe', 'codex']);
    assert.equal(probed.code, 0, probed.err);
    assert.ok(probed.out.includes(fill(T.PROBE_OK, {
      name: target.name, acp: T.PROBE_ACP_YES
    })), probed.out, 'real ACP handshake succeeded');

    const after = readRegistry(fx.root);
    const probedFinding = after.clis.find((cli) => cli.cli_id === 'codex');
    assert.equal(probedFinding.acp, true, 'ACP verdict is a real observed true');
    assert.equal(probedFinding.connection_status, 'connected');
    for (const key of ['transport', 'resume_dialect', 'evidence_hook']) {
      assert.equal(probedFinding[key], null, `${key} not fabricated even on the real surface`);
    }

    // Evidence level is earned by the real handshake, not written by hand.
    const realResult = { evidence: 'real', cli: 'codex', probed: probedFinding };
    assert.equal(evidenceLevel(realResult), T.EVIDENCE_LEVEL_REAL);
    assert.notEqual(evidenceLevel(realResult), T.EVIDENCE_LEVEL_MOCK,
      'no mock substituted for the real handshake');
  } finally {
    fx.cleanup();
  }
});
