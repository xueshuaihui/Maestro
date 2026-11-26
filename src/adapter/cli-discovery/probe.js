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
import path from 'node:path';

import { CLI_STATUS, KNOWN_AGENT_CLI } from './known-agents.js';

/**
 * ACP entrypoint args declared on the known-agent table. Falls back to the
 * legacy `--acp` flag only when the CLI is unknown, so a user-registered
 * opencode (which has no acp_args in user_config) still starts correctly.
 */
export function acpArgsFor(finding) {
  if (Array.isArray(finding?.acp_args) && finding.acp_args.length > 0) return finding.acp_args;
  const id = finding?.cli_id;
  const known = typeof id === 'string' ? KNOWN_AGENT_CLI.find((item) => item.cli_id === id) : null;
  return known?.acpArgs ?? ['--acp'];
}

function fail(code, cause, extra = {}) {
  return { ok: false, code, params: { cause: String(cause), ...extra } };
}

/**
 * Windows cannot spawn a `.cmd` / `.bat` shim directly: Node refuses it without
 * a shell (EINVAL) since the CVE-2024-27980 fix, and that is exactly what an
 * npm-installed agent CLI is on Windows (`claude.cmd`, `gemini.cmd`, ...).
 * Route those through `cmd.exe /d /s /c` explicitly instead of `shell: true`,
 * so quoting stays in our hands and the POSIX path keeps using spawn verbatim.
 */
function spawnTarget(command, args) {
  if (process.platform !== 'win32') return { file: command, argv: args };
  const ext = path.extname(String(command)).toLowerCase();
  if (ext !== '.cmd' && ext !== '.bat') return { file: command, argv: args };
  const quote = (value) => {
    const text = String(value);
    return /[\s"&|<>^]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = [command, ...args].map(quote).join(' ');
  return { file: process.env.ComSpec || 'cmd.exe', argv: ['/d', '/s', '/c', line] };
}

function runCommand({ command, args, cwd, timeoutMs, env, input }) {
  return new Promise((resolve) => {
    let child;
    const target = spawnTarget(command, args);
    try {
      child = spawn(target.file, target.argv, {
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

  // Version output is often mixed with launcher noise. `dsh --version` exits 0
  // after printing two Electron `SecCodeCheckValidity` / `NODE_OPTIONS`
  // warnings to stderr, so "first non-empty line" reported a warning instead
  // of a version. Prefer the first line that actually carries a version
  // number, and fall back to the last non-empty line (built tools often print
  // a banner first and the version last).
  const lines = [result.stdout, result.stderr]
    .flatMap((text) => String(text ?? '').split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const versioned = lines.find((line) => /\d+\.\d+\.\d+/.test(line));
  const line = versioned ?? lines[lines.length - 1] ?? null;
  return {
    ok: true,
    version: line ? line.slice(0, 200) : null,
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
  // ACP entrypoints differ per CLI: some expose a subcommand (`opencode acp`),
  // others a flag (`codex --acp`). Caller override wins, then the finding's
  // declared args, then the known-agent table lookup. Never hardcode a dialect.
  const args = options.args ?? acpArgsFor(finding);
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

  // ACP wire shapes seen in the wild (all must be accepted, never guessed):
  //   1. legacy Maestro fixture: sessionCapabilities: ['close','list','resume']
  //   2. legacy variant:         capabilities: { session: [...] }
  //   3. standard ACP (opencode, Zed agents):
  //        agentCapabilities: { sessionCapabilities: { close:{}, list:{}, ... },
  //                              mcpCapabilities: {...}, promptCapabilities: {...},
  //                              loadSession: true }
  // For the object form, the capability NAMES are the object keys; the values
  // are option bags and are intentionally discarded (no guessing of semantics).
  const caps = response.agentCapabilities ?? response.capabilities ?? {};
  let sessionCapabilities = [];
  if (Array.isArray(response.sessionCapabilities)) {
    sessionCapabilities = response.sessionCapabilities;
  } else if (Array.isArray(response.capabilities?.session)) {
    sessionCapabilities = response.capabilities.session;
  } else if (caps.sessionCapabilities && typeof caps.sessionCapabilities === 'object') {
    sessionCapabilities = Object.keys(caps.sessionCapabilities);
  }

  return {
    ok: true,
    acp: true,
    protocolVersion: response.protocolVersion ?? null,
    capabilities: Object.keys(caps),
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
  // Only the acp handshake is real evidence. A failed or timed-out probe has
  // no verdict: write null instead of false so it is not mistaken for a
  // confirmed "unsupported" result. The other dimensions have no probe
  // implementation yet, so they stay null rather than being guessed.
  const acpVerdict = acp?.ok === true && typeof acp.acp === 'boolean' ? acp.acp : null;
  return {
    ...finding,
    version: version?.ok ? version.version : finding.version,
    capabilities,
    acp: acpVerdict,
    transport: null,
    resume_dialect: null,
    evidence_hook: null,
    max_concurrent_sessions: typeof acp?.maxConcurrentSessions === 'number'
      ? acp.maxConcurrentSessions
      : finding.max_concurrent_sessions,
    connection_status: acp?.ok && acp.acp ? CLI_STATUS.CONNECTED : CLI_STATUS.UNREACHABLE,
    verified_at: version?.ok || acp?.ok ? new Date().toISOString() : finding.verified_at
  };
}
