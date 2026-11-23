/**
 * Explicit, opt-in probes for a discovered CLI.
 *
 * Two independent probes, both optional and both read-only from the user's
 * perspective (spawning `--version` does not change CLI state; ACP initialize
 * opens a session that is closed immediately):
 *
 *   1. version:    spawn <executable> --version, capture first non-empty line.
 *   2. acp:        spawn <executable> with the ACP stdio handshake and record
 *                  whether initialize succeeds. This is the capability step
 *                  that geiger-scan does NOT do and must stay in our control.
 *
 * Discipline:
 * - Never auto-probes during discovery. The caller decides (UI button / CLI).
 * - Timeouts are hard: a hung CLI must not block the desktop app.
 * - Zero CJK; wording belongs to labels.js.
 * - All failures are data: {ok:false, code, params}, never thrown.
 */

import { spawn } from 'node:child_process';

import { CLI_STATUS } from './known-agents.js';

function fail(code, cause, extra = {}) {
  return { ok: false, code, params: { cause: String(cause), ...extra } };
}

function runCommand({ command, args, cwd, timeoutMs, env, input }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (err) {
      resolve(fail('CLI_PROBE_SPAWN_FAILED', err?.message ?? String(err)));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already gone */ }
      resolve(fail('CLI_PROBE_TIMEOUT', 'probe timed out', { timeoutMs }));
    }, timeoutMs);

    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    // ACP initialize must be written to stdin before waiting for a response.
    // A hung/broken pipe is a probe failure, never a thrown error.
    if (typeof input === 'string' && child.stdin) {
      child.stdin.on('error', () => { /* downstream closed early */ });
      child.stdin.write(input, () => {
        try { child.stdin.end(); } catch { /* already closed */ }
      });
    } else if (child.stdin) {
      child.stdin.end();
    }
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(fail('CLI_PROBE_SPAWN_FAILED', err?.message ?? String(err)));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: true,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

/** Version probe: first non-empty stdout/stderr line, capped in length. */
export async function probeVersion(finding, options = {}) {
  if (!finding || typeof finding.executable !== 'string') {
    return fail('CLI_PROBE_INVALID', 'finding.executable required');
  }
  const timeoutMs = options.timeoutMs ?? 5000;
  const result = await runCommand({
    command: finding.executable,
    args: finding.version_args ?? ['--version'],
    cwd: options.cwd,
    timeoutMs,
    env: options.env
  });
  if (!result.ok) return result;

  const line = (result.stdout || result.stderr).split(/\r?\n/).find((v) => v.trim().length > 0);
  return {
    ok: true,
    version: line ? line.trim().slice(0, 200) : null,
    exitCode: result.code
  };
}

/**
 * ACP capability probe. Sends a minimal NDJSON initialize request over stdio
 * (the Maestro ACP dialect, not LSP Content-Length), then closes immediately.
 * Returns capability flags; never starts a prompt/session/new operation.
 */
export async function probeAcp(finding, options = {}) {
  if (!finding || typeof finding.executable !== 'string') {
    return fail('CLI_PROBE_INVALID', 'finding.executable required');
  }
  const timeoutMs = options.timeoutMs ?? 10_000;
  const args = options.args ?? ['--acp'];
  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: 1, clientInfo: { name: 'maestro-probe', version: '1' } }
  };

  const result = await runCommand({
    command: finding.executable,
    args,
    cwd: options.cwd,
    timeoutMs,
    env: options.env,
    input: JSON.stringify(request) + '\n'
  });
  if (!result.ok) return result;

  // ACP speaks NDJSON. Parse line by line; only initialize response counts.
  let response = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      if (message.id === 1 && message.result) { response = message.result; break; }
    } catch { /* non-JSON noise from CLI banner is ignored */ }
  }

  if (!response) {
    return {
      ok: true,
      acp: false,
      capabilities: [],
      sessionCapabilities: [],
      reason: 'no initialize response',
      exitCode: result.code
    };
  }

  const sessionCapabilities = Array.isArray(response.sessionCapabilities)
    ? response.sessionCapabilities
    : Array.isArray(response.capabilities?.session)
      ? response.capabilities.session
      : [];

  return {
    ok: true,
    acp: true,
    protocolVersion: response.protocolVersion ?? null,
    capabilities: Object.keys(response.capabilities ?? {}),
    sessionCapabilities,
    exitCode: result.code,
    connection_status: CLI_STATUS.CONNECTED
  };
}

/** Merge probe results back into a finding (pure, no disk write). */
export function withProbeResults(finding, { version, acp } = {}) {
  const capabilities = [...(finding.capabilities ?? [])];
  if (acp?.ok && acp.acp) {
    for (const item of acp.sessionCapabilities ?? []) {
      if (!capabilities.includes(item)) capabilities.push(item);
    }
  }
  return {
    ...finding,
    version: version?.ok ? version.version : finding.version,
    capabilities,
    max_concurrent_sessions: typeof acp?.maxConcurrentSessions === 'number'
      ? acp.maxConcurrentSessions
      : finding.max_concurrent_sessions,
    connection_status: acp?.ok && acp.acp ? CLI_STATUS.CONNECTED : CLI_STATUS.UNREACHABLE,
    verified_at: version?.ok || acp?.ok ? new Date().toISOString() : finding.verified_at
  };
}
