/**
 * WP-4 / command surface: cli list matrix segment, scan user-config
 * passthrough, empty-state wording and readable diagnostics.
 *
 * Every command runs through the real bin/orch.js entry point in a throwaway
 * cwd so the assertions cover what a user actually sees.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { SCHEMA_VERSION, CLI_STATUS } from '../../src/adapter/cli-discovery/index.js';
import { CLI_DISCOVERY_TEXT as T, fill } from '../../src/cli/labels.js';

const ORCH = fileURLToPath(new URL('../../bin/orch.js', import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-command-'));
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
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

function writeRegistry(root, registry) {
  const dir = path.join(root, '.orch');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'cli-registry.json'), JSON.stringify(registry, null, 2), 'utf8');
}

function readRegistry(root) {
  return JSON.parse(fs.readFileSync(path.join(root, '.orch', 'cli-registry.json'), 'utf8'));
}

function baseRegistry(clis, userConfig = [], scannedAt = '2026-11-23T00:00:00.000Z') {
  return {
    schemaVersion: SCHEMA_VERSION,
    scanned_at: scannedAt,
    sources: { path_entries: 0, home: null, app_dirs: 0, npm_global_root: null },
    user_config: userConfig,
    clis
  };
}

const MATRIX_HEADER = [
  T.MATRIX_COL_ACP,
  T.MATRIX_COL_TRANSPORT,
  T.MATRIX_COL_RESUME_DIALECT,
  T.MATRIX_COL_CONCURRENCY,
  T.MATRIX_COL_EVIDENCE_HOOK
].join('  |  ');

const LIST_HEADER = [
  T.COL_ID, T.COL_NAME, T.COL_VERSION, T.COL_STATUS, T.COL_PATH, T.COL_EVIDENCE
].join('  |  ');

test('CLI-C1: cli list appends a five-column matrix segment after the six-column list', () => {
  const fx = fixture();
  try {
    const probed = {
      cli_id: 'probed', name: 'ProbedCLI', executable: null, version: null,
      detected_at: 'T0', capabilities: [],
      acp: true, transport: 'stdio', resume_dialect: 'resume',
      max_concurrent_sessions: 3, evidence_hook: null,
      connection_status: CLI_STATUS.CONNECTED, not_on_path: false,
      verified_at: 'T1', evidence: [{ type: 'path', value: '/x/probed' }], version_args: ['--version']
    };
    const unprobed = {
      cli_id: 'unprobed', name: 'UnprobedCLI', executable: null, version: null,
      detected_at: 'T0', capabilities: [],
      acp: null, transport: null, resume_dialect: null,
      max_concurrent_sessions: null, evidence_hook: null,
      connection_status: CLI_STATUS.IDLE, not_on_path: false,
      verified_at: null, evidence: [{ type: 'home', value: '/home/.unprobed' }], version_args: ['--version']
    };
    writeRegistry(fx.root, baseRegistry([probed, unprobed]));

    const result = run(fx.root, ['list']);
    assert.equal(result.code, 0, result.err);
    const lines = result.out.split('\n');

    // AC-09: original six-column list header order is untouched.
    assert.ok(lines.includes(LIST_HEADER), 'six-column list header preserved in order');

    // AC-09: matrix segment uses exactly the five frozen dimension columns.
    const headerIndex = lines.indexOf(MATRIX_HEADER);
    assert.ok(headerIndex >= 0, 'five-column matrix header present in frozen order');
    assert.ok(lines.indexOf(T.MATRIX_TITLE) >= 0, 'matrix title present');
    const tableLines = lines.filter((line) => line.split('  |  ').length === 5);
    assert.equal(tableLines[0], MATRIX_HEADER);
    assert.ok(tableLines.length >= 3, 'header plus two data rows');

    // Probed cells show real values; null stays "not probed".
    const probedIndex = lines.findIndex((line) => line === 'ProbedCLI:');
    assert.ok(probedIndex >= 0);
    assert.deepEqual(lines[probedIndex + 1].split('  |  '), [
      T.PROBE_ACP_YES, 'stdio', 'resume', '3', T.NOT_PROBED
    ]);

    const unprobedIndex = lines.findIndex((line) => line === 'UnprobedCLI:');
    assert.ok(unprobedIndex >= 0);
    assert.deepEqual(lines[unprobedIndex + 1].split('  |  '), Array(5).fill(T.NOT_PROBED));

    // AC-15: source overview is visible.
    const overview = lines.find((line) => line.startsWith(`${T.MATRIX_SOURCES}:`));
    assert.ok(overview, 'source overview line present');
    assert.match(overview, /path:1/);
    assert.match(overview, /home:1/);
    assert.match(overview, /user-config:0/);
  } finally {
    fx.cleanup();
  }
});

test('CLI-C2: scan passes loaded user_config to discovery and keeps it', () => {
  const fx = fixture();
  try {
    const entry = {
      cli_id: 'mycli', name: 'MyCLI', executable: path.join(fx.root, 'mytool'),
      version_args: ['--version'], added_at: '2026-11-23T00:05:00.000Z'
    };
    writeRegistry(fx.root, baseRegistry([], [entry]));

    const result = run(fx.root, ['scan'], { PATH: '', HOME: path.join(fx.root, 'home') });
    assert.equal(result.code, 0, result.err);
    const registry = readRegistry(fx.root);
    assert.equal(registry.user_config.length, 1);
    assert.equal(registry.user_config[0].cli_id, 'mycli');
    assert.equal(registry.user_config[0].executable, entry.executable);
    assert.equal(registry.user_config[0].added_at, entry.added_at);
    const userFinding = registry.clis.find((cli) =>
      cli.evidence.some((evidence) => evidence.type === 'user-config'));
    assert.ok(userFinding, 'user item rehydrated into clis on scan');
    assert.equal(userFinding.name, 'MyCLI');

    const list = run(fx.root, ['list']);
    assert.equal(list.code, 0, list.err);
    assert.match(list.out, /MyCLI/);
  } finally {
    fx.cleanup();
  }
});

test('CLI-C3: empty registry shows full empty-state wording with a fix hint', () => {
  const fx = fixture();
  try {
    const result = run(fx.root, ['list']);
    assert.equal(result.code, 0, result.err);
    assert.ok(result.out.includes(T.TITLE), 'list title present');
    assert.ok(result.out.includes(T.NONE), 'NONE wording present');
    assert.ok(result.out.includes(T.NONE_HINT), 'NONE_HINT wording present');
    assert.ok(result.out.includes(T.HINT_ADD_PATH), 'fix hint present');
    assert.ok(result.out.includes(T.MATRIX_TITLE), 'matrix segment still rendered in empty state');
  } finally {
    fx.cleanup();
  }
});

test('CLI-C4: unreachable item stays listed with readable diagnostic, not empty state', () => {
  const fx = fixture();
  try {
    const unreachable = {
      cli_id: 'codex', name: 'Codex CLI', executable: null, version: null,
      detected_at: 'T0', capabilities: [],
      acp: null, transport: null, resume_dialect: null,
      max_concurrent_sessions: null, evidence_hook: null,
      connection_status: CLI_STATUS.UNREACHABLE, not_on_path: true,
      verified_at: null, evidence: [{ type: 'home', value: '/home/.codex' }], version_args: ['--version']
    };
    writeRegistry(fx.root, baseRegistry([unreachable]));

    const list = run(fx.root, ['list']);
    assert.equal(list.code, 0, list.err);
    assert.match(list.out, /Codex CLI/);
    assert.ok(list.out.includes(T.NOT_ON_PATH), 'readable "not on PATH" reason shown');
    assert.ok(list.out.includes(T.STATUS_UNREACHABLE), 'unreachable status shown');
    assert.equal(list.out.includes(T.NONE), false, 'never falls back to empty state');

    const probe = run(fx.root, ['probe', 'codex']);
    assert.equal(probe.code, 1, 'probe of unreachable item fails with readable result');
    assert.ok(probe.out.includes(fill(T.PROBE_FAIL, { name: 'Codex CLI', cause: T.NOT_ON_PATH })));
  } finally {
    fx.cleanup();
  }
});

test('CLI-C5: all new command wording keys are defined in the single label table', () => {
  const required = [
    'ADD_OK', 'ADD_EXISTS', 'ADD_FAIL_EMPTY_NAME', 'ADD_FAIL_EMPTY_PATH',
    'ADD_FAIL_NOT_FOUND', 'ADD_FAIL_NOT_EXECUTABLE', 'MATRIX_TITLE',
    'MATRIX_COL_ACP', 'MATRIX_COL_TRANSPORT', 'MATRIX_COL_RESUME_DIALECT',
    'MATRIX_COL_CONCURRENCY', 'MATRIX_COL_EVIDENCE_HOOK', 'NOT_PROBED',
    'HINT_ADD_PATH', 'EVIDENCE_LEVEL_MOCK', 'EVIDENCE_LEVEL_PENDING',
    'EVIDENCE_LEVEL_REAL'
  ];
  for (const key of required) {
    assert.equal(typeof T[key], 'string', `${key} defined`);
    assert.ok(T[key].length > 0, `${key} non-empty`);
  }
  assert.equal(T.USAGE, '用法：orch cli list|scan|probe <cli_id> [--format json]');
});
