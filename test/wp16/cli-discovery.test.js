/**
 * A1 / capability domain 0: CLI discovery is read-only, evidence-backed, and
 * reports "installed but not on PATH" instead of silently dropping a CLI.
 *
 * Fixtures use os.tmpdir() with NODE_ENV=test; all injected paths point at the
 * throwaway tree, so no real home/PATH/app dir is ever scanned by these tests.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  discoverAgentClis,
  KNOWN_AGENT_CLI,
  CLI_STATUS,
  SCHEMA_VERSION
} from '../../src/adapter/cli-discovery/index.js';
import { saveCliRegistry, loadCliRegistry } from '../../src/adapter/cli-discovery/registry.js';

const noCjk = (source) => assert.equal(/[\u3400-\u9fff]/.test(String(source)), false, 'CJK literal in discovery module');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-discovery-'));
  const bin = path.join(root, 'bin');
  const home = path.join(root, 'home');
  const apps = path.join(root, 'apps');
  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.mkdirSync(path.join(home, '.gemini'), { recursive: true });
  fs.mkdirSync(apps, { recursive: true });
  return { root, bin, home, apps, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/**
 * Host-native shape of a PATH-installed CLI.
 *
 * The POSIX exec bit cannot be represented on NTFS, so asserting `mode & 0o111`
 * on a Windows runner tests the filesystem rather than our resolver. On win32
 * the fixture therefore uses the real Windows shape — a `<name>.CMD` shim
 * resolved through PATHEXT — which is what the product must handle there.
 */
const HOST = process.platform;
const HOST_PATHEXT = '.CMD;.EXE;.BAT';

function fakePathBin(dir, name, platform = HOST) {
  const win = platform === 'win32';
  const target = path.join(dir, win ? `${name}.CMD` : name);
  fs.writeFileSync(target, win ? '@echo off\r\n' : '#!/bin/sh\necho test\n', 'utf8');
  if (!win) fs.chmodSync(target, 0o755);
  return target;
}

/** Env that mirrors the host's real executable-resolution inputs. */
function hostEnv(extra = {}) {
  return HOST === 'win32' ? { PATHEXT: HOST_PATHEXT, ...extra } : { ...extra };
}

test('A1-01: PATH executable is discovered with evidence and idle status', () => {
  const fx = fixture();
  try {
    const codexBin = fakePathBin(fx.bin, 'codex');
    const result = discoverAgentClis({
      env: hostEnv({ PATH: fx.bin }),
      home: fx.home,
      platform: HOST,
      pathEntries: [fx.bin],
      appDirs: [fx.apps],
      npmGlobalRoot: null,
      clock: () => '2026-11-23T00:00:00.000Z'
    });
    assert.equal(result.ok, true);
    assert.equal(result.schemaVersion, SCHEMA_VERSION);
    const codex = result.findings.find((item) => item.cli_id === 'codex');
    assert.ok(codex, 'codex discovered');
    assert.equal(codex.executable, codexBin);
    assert.equal(codex.connection_status, CLI_STATUS.IDLE);
    assert.equal(codex.not_on_path, false);
    assert.ok(codex.evidence.some((item) => item.type === 'path'));
  } finally {
    fx.cleanup();
  }
});

test('A1-02: home marker alone is reported as unreachable, not dropped', () => {
  const fx = fixture();
  try {
    const result = discoverAgentClis({
      env: {},
      home: fx.home,
      platform: 'darwin',
      pathEntries: [],
      appDirs: [],
      npmGlobalRoot: null
    });
    const ids = result.findings.map((item) => item.cli_id);
    assert.ok(ids.includes('codex'), 'home marker .codex listed');
    assert.ok(ids.includes('gemini'), 'home marker .gemini listed');
    for (const finding of result.findings) {
      assert.equal(finding.executable, null);
      assert.equal(finding.not_on_path, true);
      assert.equal(finding.connection_status, CLI_STATUS.UNREACHABLE);
    }
  } finally {
    fx.cleanup();
  }
});

test('A1-03: duplicate executable names resolve to the first PATH entry', () => {
  const fx = fixture();
  try {
    const first = fakePathBin(fx.bin, 'claude');
    const result = discoverAgentClis({
      env: hostEnv(),
      home: fx.home,
      platform: HOST,
      pathEntries: [fx.bin, fx.bin],
      appDirs: [],
      clock: () => 'T0'
    });
    const claude = result.findings.find((item) => item.cli_id === 'claude-code');
    assert.equal(claude.executable, first);
    assert.equal(claude.evidence.filter((item) => item.type === 'path').length, 1);
  } finally {
    fx.cleanup();
  }
});

test('A1-04: app directory marker is reported for WorkBuddy', () => {
  const fx = fixture();
  try {
    fs.mkdirSync(path.join(fx.apps, 'WorkBuddy.app'), { recursive: true });
    const result = discoverAgentClis({
      env: {},
      home: fx.home,
      platform: 'darwin',
      pathEntries: [],
      appDirs: [fx.apps]
    });
    const wb = result.findings.find((item) => item.cli_id === 'workbuddy');
    assert.ok(wb);
    assert.ok(wb.evidence.some((item) => item.type === 'app'));
    assert.equal(wb.connection_status, CLI_STATUS.UNREACHABLE);
  } finally {
    fx.cleanup();
  }
});

test('A1-08: a CLI bundled inside an app package resolves to its shim, not just evidence', () => {
  const fx = fixture();
  try {
    // DeepSeek Harness ships `dsh` in Contents/Resources/runtime/cli/bin and
    // never links it onto PATH; the app marker alone used to yield
    // executable: null, so the finding read "installed but not on PATH".
    const appDir = path.join(fx.apps, 'DeepSeek Harness.app');
    const shimDir = path.join(appDir, 'Contents', 'Resources', 'runtime', 'cli', 'bin');
    fs.mkdirSync(shimDir, { recursive: true });
    const shim = path.join(shimDir, 'dsh');
    fs.writeFileSync(shim, '#!/bin/sh\necho dsh\n', 'utf8');
    fs.chmodSync(shim, 0o755);

    const result = discoverAgentClis({
      env: {},
      home: fx.home,
      platform: 'darwin',
      pathEntries: [],
      appDirs: [fx.apps],
      npmGlobalRoot: null,
      clock: () => '2026-11-26T00:00:00.000Z'
    });
    const dsh = result.findings.find((item) => item.cli_id === 'dsh');
    assert.ok(dsh, 'bundled dsh must be discovered');
    assert.equal(dsh.executable, shim, 'the bundled shim is the executable');
    assert.equal(dsh.not_on_path, false, 'a bundled shim is launchable');
    assert.equal(dsh.bundled, true);
    assert.ok(dsh.evidence.some((item) => item.type === 'app-bin'));
    // `dsh --acp` rejects the flag: the ACP entry is a profile launcher.
    assert.deepEqual(dsh.acp_args, ['--profile', 'acp']);
  } finally {
    fx.cleanup();
  }
});

test('A1-09: npm global root falls back to nvm when the GUI process has no npm', () => {
  const fx = fixture();
  try {
    // A window launched from Finder has no npm on PATH, so `npm root -g`
    // cannot run; without the fallback every npm-distributed CLI stayed
    // "not ready" forever on such machines.
    const pkg = path.join(fx.home, '.nvm', 'versions', 'node', 'v22.10.0', 'lib', 'node_modules',
      '@anthropic-ai', 'claude-code');
    fs.mkdirSync(pkg, { recursive: true });

    const result = discoverAgentClis({
      env: {},
      home: fx.home,
      platform: 'darwin',
      pathEntries: [],
      appDirs: [],
      clock: () => '2026-11-26T00:00:00.000Z'
    });
    assert.equal(result.sources.npm_global_root, path.join(fx.home, '.nvm', 'versions', 'node',
      'v22.10.0', 'lib', 'node_modules'));
    const claude = result.findings.find((item) => item.cli_id === 'claude-code');
    assert.ok(claude, 'claude-code discovered through the nvm root');
    assert.ok(claude.evidence.some((item) => item.type === 'npm-global'));
  } finally {
    fx.cleanup();
  }
});

test('A1-05: no evidence means no finding (no false positives)', () => {
  const fx = fixture();
  try {
    const result = discoverAgentClis({
      env: {},
      home: fx.home,
      platform: 'darwin',
      pathEntries: [],
      appDirs: []
    });
    // no bin/claude exists, no .claude home, no app -> codex/gemini still present
    const ids = result.findings.map((item) => item.cli_id);
    assert.equal(ids.includes('claude-code'), false);
    assert.equal(ids.includes('workbuddy'), false);
    assert.equal(ids.includes('qwen'), false);
  } finally {
    fx.cleanup();
  }
});

test('A1-06: discovery never writes to scanned directories', () => {
  const fx = fixture();
  try {
    fakePathBin(fx.bin, 'codex');
    const before = fs.readdirSync(fx.root).sort();
    discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [fx.bin], appDirs: [fx.apps]
    });
    assert.deepEqual(fs.readdirSync(fx.root).sort(), before);
  } finally {
    fx.cleanup();
  }
});

test('A1-07: known-agent table is stable and CJK-free', () => {
  const ids = KNOWN_AGENT_CLI.map((item) => item.cli_id);
  assert.equal(new Set(ids).size, ids.length, 'unique cli ids');
  for (const required of ['codex', 'claude-code', 'gemini', 'opencode', 'dsh', 'workbuddy']) {
    assert.ok(ids.includes(required), `missing ${required}`);
  }
  noCjk(fs.readFileSync(new URL('../../src/adapter/cli-discovery/known-agents.js', import.meta.url), 'utf8'));
  noCjk(fs.readFileSync(new URL('../../src/adapter/cli-discovery/discover.js', import.meta.url), 'utf8'));
  noCjk(fs.readFileSync(new URL('../../src/adapter/cli-discovery/probe.js', import.meta.url), 'utf8'));
  noCjk(fs.readFileSync(new URL('../../src/cli/cli-discovery.js', import.meta.url), 'utf8'));
});

// --- WP-1 additions: fourth source (user config) + finding contract --------
const MATRIX_FIELDS = [
  'acp', 'transport', 'resume_dialect', 'max_concurrent_sessions', 'evidence_hook'
];

test('WP1-01: user-config entry is discovered with user-config evidence', () => {
  const fx = fixture();
  try {
    const tool = path.join(fx.root, 'mytool');
    const result = discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [], appDirs: [], npmGlobalRoot: null,
      userConfig: [{
        name: 'MyCLI', executable: tool,
        version_args: ['--version'], added_at: '2026-11-23T00:05:00.000Z'
      }]
    });
    const item = result.findings.find((f) =>
      f.evidence.some((e) => e.type === 'user-config'));
    assert.ok(item, 'user-config finding is present');
    assert.equal(item.cli_id, 'mycli');
    assert.equal(item.name, 'MyCLI');
    assert.equal(item.executable, tool);
    assert.equal(item.detected_at, '2026-11-23T00:05:00.000Z');
    assert.equal(item.connection_status, CLI_STATUS.IDLE);
    assert.equal(item.not_on_path, false);
    assert.equal(item.verified_at, null);
    assert.deepEqual(item.version_args, ['--version']);
    assert.deepEqual(item.evidence, [{ type: 'user-config', value: tool }]);
  } finally {
    fx.cleanup();
  }
});

test('WP1-02: every finding starts with all five matrix fields null', () => {
  const fx = fixture();
  try {
    const tool = path.join(fx.root, 'mytool');
    const result = discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [], appDirs: [],
      userConfig: [{ name: 'MyCLI', executable: tool }]
    });
    assert.ok(result.findings.length > 0, 'at least one finding');
    for (const finding of result.findings) {
      for (const field of MATRIX_FIELDS) {
        assert.equal(finding[field], null, `${finding.cli_id}.${field} is null`);
      }
    }
  } finally {
    fx.cleanup();
  }
});

test('WP1-03: source overview covers all discovery sources', () => {
  const fx = fixture();
  try {
    fakePathBin(fx.bin, 'codex');
    fs.mkdirSync(path.join(fx.apps, 'WorkBuddy.app'), { recursive: true });
    const npmRoot = path.join(fx.root, 'npm');
    fs.mkdirSync(path.join(npmRoot, 'opencode-ai'), { recursive: true });
    const tool = path.join(fx.root, 'mytool');
    const result = discoverAgentClis({
      env: hostEnv({ PATH: fx.bin }), home: fx.home, platform: HOST,
      pathEntries: [fx.bin], appDirs: [fx.apps], npmGlobalRoot: npmRoot,
      userConfig: [{ name: 'MyCLI', executable: tool }]
    });
    assert.deepEqual(Object.keys(result.sources).sort(),
      ['app_dirs', 'home', 'npm_global_root', 'path_entries'].sort());
    assert.equal(result.sources.path_entries, 1);
    assert.equal(result.sources.app_dirs, 1);
    assert.equal(result.sources.npm_global_root, npmRoot);
    const types = new Set();
    for (const finding of result.findings) {
      for (const evidence of finding.evidence) types.add(evidence.type);
    }
    for (const expected of ['path', 'home', 'app', 'npm-global', 'user-config']) {
      assert.ok(types.has(expected), `evidence type ${expected} present`);
    }
  } finally {
    fx.cleanup();
  }
});

test('WP1-04: rescans keep user_config and refresh scanned_at', async () => {
  const fx = fixture();
  try {
    const tool = path.join(fx.root, 'mytool');
    const userConfig = [{
      cli_id: 'mycli', name: 'MyCLI', executable: tool,
      version_args: ['--version'], added_at: '2026-11-23T00:05:00.000Z'
    }];
    const scan1 = discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [], appDirs: [], userConfig,
      clock: () => '2026-11-23T00:00:00.000Z'
    });
    const saved1 = await saveCliRegistry(fx.root, scan1, { userConfig });
    assert.equal(saved1.ok, true);
    assert.equal(saved1.registry.scanned_at, '2026-11-23T00:00:00.000Z');

    const loaded = await loadCliRegistry(fx.root);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.registry.user_config.length, 1);

    const scan2 = discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [], appDirs: [], userConfig: loaded.registry.user_config,
      clock: () => '2026-11-23T01:00:00.000Z'
    });
    const saved2 = await saveCliRegistry(fx.root, scan2, {
      userConfig: loaded.registry.user_config
    });
    assert.equal(saved2.ok, true);
    assert.equal(saved2.registry.scanned_at, '2026-11-23T01:00:00.000Z');
    assert.equal(saved2.registry.user_config.length, 1);
    assert.equal(saved2.registry.user_config[0].cli_id, 'mycli');
    assert.equal(saved2.registry.user_config[0].executable, tool);
    assert.equal(saved2.registry.user_config[0].added_at, '2026-11-23T00:05:00.000Z');
    const userFindings = saved2.registry.clis.filter((c) =>
      c.evidence.some((e) => e.type === 'user-config'));
    assert.equal(userFindings.length, 1);
  } finally {
    fx.cleanup();
  }
});

test('WP1-05: save without options.userConfig keeps persisted user items', async () => {
  const fx = fixture();
  try {
    const tool = path.join(fx.root, 'mytool');
    const userConfig = [{ cli_id: 'mycli', name: 'MyCLI', executable: tool }];
    const scan = discoverAgentClis({
      env: {}, home: fx.home, platform: 'darwin',
      pathEntries: [], appDirs: [], userConfig, clock: () => 'T0'
    });
    const first = await saveCliRegistry(fx.root, scan, { userConfig });
    assert.equal(first.ok, true);
    // probe write-back passes only the scan result
    const saved = await saveCliRegistry(fx.root, scan);
    assert.equal(saved.ok, true);
    assert.equal(saved.registry.user_config.length, 1);
    assert.equal(saved.registry.user_config[0].executable, tool);
  } finally {
    fx.cleanup();
  }
});

test('WP1-06: legacy registry without user_config loads as []', async () => {
  const fx = fixture();
  try {
    fs.mkdirSync(path.join(fx.root, '.orch'), { recursive: true });
    fs.writeFileSync(path.join(fx.root, '.orch', 'cli-registry.json'),
      JSON.stringify({ schemaVersion: 1, scanned_at: 'T0', clis: [] }), 'utf8');
    const loaded = await loadCliRegistry(fx.root);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.registry.user_config, []);
  } finally {
    fx.cleanup();
  }
});
