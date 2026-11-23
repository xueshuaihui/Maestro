/**
 * A1: registry persistence and explicit ACP capability probe.
 *
 * The probe tests spawn a tiny local mock ACP agent that speaks NDJSON, so the
 * initialize handshake and capability extraction are exercised for real - this
 * is the step geiger-scan does not implement and must stay under our control.
 */
process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  probeAcp,
  probeVersion,
  withProbeResults,
  loadCliRegistry,
  saveCliRegistry,
  CLI_STATUS,
  SCHEMA_VERSION
} from '../../src/adapter/cli-discovery/index.js';

function tmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-registry-'));
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function mockAcpScript() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-mock-acp-'));
  const script = path.join(root, 'mock-acp.mjs');
  const NL = String.fromCharCode(10);
  const lines = [
    "process.stdin.setEncoding('utf8');",
    "let buf = '';",
    "process.stdin.on('data', (chunk) => {",
    "  buf += chunk;",
    "  for (const line of buf.split(String.fromCharCode(10))) {",
    "    if (!line.trim()) continue;",
    "    try { const msg = JSON.parse(line); if (msg.method === 'initialize') {",
    "      process.stdout.write(JSON.stringify({ jsonrpc:'2.0', id: msg.id, result: {",
    "        protocolVersion: 1, capabilities: { session: true },",
    "        sessionCapabilities: ['close','list','resume'] } }) + String.fromCharCode(10));",
    "    } } catch {}",
    "  }",
    "});",
    "setTimeout(() => process.exit(0), 250);"
  ];
  fs.writeFileSync(script, lines.join(NL), 'utf8');
  return { script, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('A1-08: registry round-trip preserves finding shape', async () => {
  const fx = tmpRoot();
  try {
    const loaded = await loadCliRegistry(fx.root);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.registry.clis.length, 0);

    const scan = {
      ok: true,
      scanned_at: '2026-11-23T00:00:00.000Z',
      sources: { path_entries: 1 },
      findings: [{
        cli_id: 'codex', name: 'Codex CLI', executable: '/bin/codex',
        version: null, detected_at: '2026-11-23T00:00:00.000Z',
        capabilities: [], connection_status: CLI_STATUS.IDLE,
        evidence: [{ type: 'path', value: '/bin/codex' }]
      }]
    };
    const saved = await saveCliRegistry(fx.root, scan);
    assert.equal(saved.ok, true);
    const reloaded = await loadCliRegistry(fx.root);
    assert.equal(reloaded.registry.clis.length, 1);
    assert.equal(reloaded.registry.clis[0].cli_id, 'codex');
    assert.equal(reloaded.registry.clis[0].not_on_path, false);
    assert.equal(reloaded.registry.schemaVersion, SCHEMA_VERSION);
  } finally {
    fx.cleanup();
  }
});

test('A1-09: invalid registry is reported, not silently accepted', async () => {
  const fx = tmpRoot();
  try {
    fs.mkdirSync(path.join(fx.root, '.orch'), { recursive: true });
    fs.writeFileSync(path.join(fx.root, '.orch', 'cli-registry.json'), '{"schemaVersion":99}', 'utf8');
    const loaded = await loadCliRegistry(fx.root);
    assert.equal(loaded.ok, false);
    assert.equal(loaded.code, 'CLI_REGISTRY_INVALID');
  } finally {
    fx.cleanup();
  }
});

test('A1-10: probeAcp parses NDJSON initialize response and extracts session capabilities', async () => {
  const mock = mockAcpScript();
  try {
    const result = await probeAcp(
      { cli_id: 'mock', name: 'Mock', executable: process.execPath, version_args: ['--version'] },
      { args: [mock.script], timeoutMs: 3000 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.acp, true);
    assert.equal(result.protocolVersion, 1);
    assert.deepEqual(result.sessionCapabilities, ['close', 'list', 'resume']);
    assert.equal(result.connection_status, CLI_STATUS.CONNECTED);
  } finally {
    mock.cleanup();
  }
});

test('A1-11: probeVersion captures first output line', async () => {
  const mock = mockAcpScript();
  try {
    const result = await probeVersion(
      { executable: process.execPath, version_args: ['-v'] },
      { timeoutMs: 3000 }
    );
    assert.equal(result.ok, true);
    assert.match(result.version, /^v\d+/);
  } finally {
    mock.cleanup();
  }
});

test('A1-12: withProbeResults merges capabilities without duplicating', () => {
  const finding = {
    cli_id: 'codex', name: 'Codex CLI', executable: '/bin/codex',
    capabilities: ['resume'], connection_status: CLI_STATUS.IDLE, evidence: []
  };
  const merged = withProbeResults(finding, {
    version: { ok: true, version: '1.2.3' },
    acp: {
      ok: true, acp: true,
      sessionCapabilities: ['resume', 'close'],
      connection_status: CLI_STATUS.CONNECTED
    }
  });
  assert.deepEqual(merged.capabilities, ['resume', 'close']);
  assert.equal(merged.version, '1.2.3');
  assert.equal(merged.connection_status, CLI_STATUS.CONNECTED);
  assert.ok(merged.verified_at);
});

test('A1-13: probe timeout returns data, never throws', async () => {
  const result = await probeVersion(
    { executable: process.execPath, version_args: ['-e', 'setTimeout(()=>{},5000)'] },
    { timeoutMs: 300 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CLI_PROBE_TIMEOUT');
});

// WP-2 additions: A1-08 ~ A1-13 above are kept verbatim.
function probeFinding() {
  return {
    cli_id: 'codex', name: 'Codex CLI', executable: '/bin/codex',
    version: null, detected_at: '2026-11-23T00:00:00.000Z',
    capabilities: [], acp: null, transport: null, resume_dialect: null,
    max_concurrent_sessions: null, evidence_hook: null,
    connection_status: CLI_STATUS.IDLE, not_on_path: false,
    verified_at: null, evidence: []
  };
}

test('WP-2: withProbeResults lands acp=true on a successful acp handshake', () => {
  const merged = withProbeResults(probeFinding(), {
    version: { ok: true, version: 'codex 1.2.3' },
    acp: {
      ok: true, acp: true, protocolVersion: 1,
      capabilities: ['session'], sessionCapabilities: ['close', 'list', 'resume'],
      exitCode: 0, connection_status: CLI_STATUS.CONNECTED
    }
  });
  assert.equal(merged.acp, true);
  assert.equal(merged.version, 'codex 1.2.3');
  assert.deepEqual(merged.capabilities, ['close', 'list', 'resume']);
  assert.equal(merged.connection_status, CLI_STATUS.CONNECTED);
  assert.equal(merged.max_concurrent_sessions, null);
  assert.ok(merged.verified_at);
});

test('WP-2: withProbeResults writes acp=null on failed/timed-out acp probe, never false', () => {
  const timeout = {
    ok: false, code: 'CLI_PROBE_TIMEOUT',
    params: { cause: 'probe timed out', timeoutMs: 10000 }
  };
  const merged = withProbeResults(probeFinding(), {
    version: { ok: true, version: '1.2.3' },
    acp: timeout
  });
  assert.equal(merged.acp, null);
  assert.notEqual(merged.acp, false);
  assert.deepEqual(merged.capabilities, []);
  assert.equal(merged.version, '1.2.3');
  assert.equal(merged.connection_status, CLI_STATUS.UNREACHABLE);
  assert.equal(merged.max_concurrent_sessions, null);
  assert.ok(merged.verified_at);
});

test('WP-2: real acp timeout data lands as acp=null', async () => {
  const result = await probeAcp(
    { executable: process.execPath },
    { args: ['-e', 'setTimeout(()=>{},5000)'], timeoutMs: 300 }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CLI_PROBE_TIMEOUT');
  const merged = withProbeResults(probeFinding(), { acp: result });
  assert.equal(merged.acp, null);
});

test('WP-2: transport, resume_dialect and evidence_hook stay null (no guessing)', () => {
  const merged = withProbeResults(probeFinding(), {
    acp: {
      ok: true, acp: true,
      sessionCapabilities: ['resume'],
      transport: 'stdio', resume_dialect: 'resume', evidence_hook: true
    }
  });
  assert.equal(merged.transport, null);
  assert.equal(merged.resume_dialect, null);
  assert.equal(merged.evidence_hook, null);
  assert.equal(merged.acp, true);

  const noResult = withProbeResults(probeFinding());
  assert.equal(noResult.acp, null);
  assert.equal(noResult.transport, null);
  assert.equal(noResult.resume_dialect, null);
  assert.equal(noResult.evidence_hook, null);
});
