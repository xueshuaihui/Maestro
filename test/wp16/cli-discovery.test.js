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

function fakePathBin(dir, name) {
  const target = path.join(dir, name);
  fs.writeFileSync(target, '#!/bin/sh\necho test\n', 'utf8');
  fs.chmodSync(target, 0o755);
  return target;
}

test('A1-01: PATH executable is discovered with evidence and idle status', () => {
  const fx = fixture();
  try {
    const codexBin = fakePathBin(fx.bin, 'codex');
    const result = discoverAgentClis({
      env: { PATH: fx.bin },
      home: fx.home,
      platform: 'darwin',
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
      env: {},
      home: fx.home,
      platform: 'darwin',
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
