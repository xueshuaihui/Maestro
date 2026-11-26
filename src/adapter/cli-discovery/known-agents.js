/**
 * Known Agent CLI identification table.
 *
 * Origin: the MIT-licensed `geiger-scan` (Atomburstofficial/geiger) known-agents
 * data, trimmed to the entries that can act as an ACP-capable execution carrier.
 * This file intentionally depends on nothing outside Node builtins: the desktop
 * build cannot assume the user has Node/npx or network access.
 *
 * Discipline (mirrors the rest of src/):
 * - Zero CJK here; every user-visible sentence lives in src/cli/labels.js.
 * - `bin` values are executable names looked up on PATH; `homeDirs` are evidence
 *   markers only (a config dir does not prove the CLI is on PATH).
 * - Evidence is read-only. This module never writes to the user's machine.
 */

const CLI = Object.freeze({
  claudeCode: {
    cli_id: 'claude-code',
    name: 'Claude Code',
    bin: ['claude'],
    npmPackages: ['@anthropic-ai/claude-code'],
    homeDirs: ['.claude'],
    versionArgs: ['--version']
  },
  codex: {
    cli_id: 'codex',
    name: 'Codex CLI',
    bin: ['codex'],
    npmPackages: ['@openai/codex'],
    homeDirs: ['.codex'],
    versionArgs: ['--version']
  },
  gemini: {
    cli_id: 'gemini',
    name: 'Gemini CLI',
    bin: ['gemini'],
    npmPackages: ['@google/gemini-cli'],
    homeDirs: ['.gemini'],
    versionArgs: ['--version']
  },
  qwen: {
    cli_id: 'qwen',
    name: 'Qwen Code',
    bin: ['qwen'],
    npmPackages: ['@qwen-code/qwen-code'],
    homeDirs: ['.qwen'],
    versionArgs: ['--version']
  },
  opencode: {
    cli_id: 'opencode',
    name: 'OpenCode',
    bin: ['opencode'],
    npmPackages: ['opencode-ai', 'opencode'],
    homeDirs: ['.opencode'],
    versionArgs: ['--version'],
    // Verified 2026-11-24 against opencode 1.19.6: `opencode acp` starts a
    // real ACP NDJSON server; `--acp` is not a valid flag (exit 1).
    acpArgs: ['acp']
  },
  aider: {
    cli_id: 'aider',
    name: 'Aider',
    bin: ['aider'],
    npmPackages: ['aider-js'],
    homeDirs: ['.aider'],
    versionArgs: ['--version']
  },
  dsh: {
    cli_id: 'dsh',
    name: 'DeepSeek Harness',
    bin: ['dsh'],
    npmPackages: ['@deepseek-ai/dsh'],
    homeDirs: ['.dsh', '.deepseek-harness'],
    // The macOS/Windows installer never writes an entry into PATH: the only
    // CLI is the launcher shim shipped inside the bundle
    // (`Contents/Resources/runtime/cli/bin/dsh`). Without `appNames` the app
    // directory was never a candidate, so a working install reported
    // "installed but not on PATH" forever.
    appNames: ['DeepSeek Harness.app', 'DeepSeek Harness'],
    appBins: [
      'Contents/Resources/runtime/cli/bin/dsh',
      'Contents/Resources/runtime/bin/dsh',
      'Contents/Resources/cli/bin/dsh',
      'Contents/MacOS/dsh',
      'resources/runtime/cli/bin/dsh',
      'resources/cli/bin/dsh',
      'resources/app.asar.unpacked/bin/dsh'
    ],
    // `dsh --acp` exits with `error: --profile <name> is required`: dsh is a
    // profile launcher, not a flag-driven binary. The bundled ACP server runs
    // behind the `acp` profile, so the handshake starts with that profile.
    acpArgs: ['--profile', 'acp'],
    versionArgs: ['--version']
  },
  copilot: {
    cli_id: 'copilot',
    name: 'GitHub Copilot CLI',
    bin: ['copilot', 'gh-copilot'],
    npmPackages: ['@github/copilot'],
    homeDirs: ['.copilot'],
    versionArgs: ['--version']
  },
  continue: {
    cli_id: 'continue',
    name: 'Continue',
    bin: ['continue'],
    npmPackages: [],
    homeDirs: ['.continue'],
    versionArgs: ['--version']
  },
  grok: {
    cli_id: 'grok',
    name: 'Grok Build',
    bin: ['grok'],
    npmPackages: [],
    homeDirs: ['.grok'],
    versionArgs: ['--version']
  },
  workbuddy: {
    cli_id: 'workbuddy',
    name: 'WorkBuddy',
    bin: ['workbuddy', 'wb'],
    npmPackages: [],
    homeDirs: [],
    appNames: ['WorkBuddy.app'],
    // Same failure mode dsh had: `appNames` only ever produced evidence, so the
    // bundle was recognised and the executable stayed null. These are the
    // places an Electron bundle keeps a shim; a missing one is simply skipped.
    appBins: [
      'Contents/Resources/app/bin/workbuddy',
      'Contents/Resources/app/bin/wb',
      'Contents/Resources/bin/workbuddy',
      'Contents/MacOS/workbuddy',
      'resources/app/bin/workbuddy',
      'resources/bin/workbuddy'
    ],
    versionArgs: ['--version']
  },
  cursor: {
    cli_id: 'cursor',
    name: 'Cursor Agent',
    bin: ['cursor-agent', 'agent'],
    npmPackages: [],
    homeDirs: ['.cursor'],
    appNames: ['Cursor.app'],
    appBins: [
      'Contents/Resources/app/bin/cursor-agent',
      'Contents/Resources/app/bin/agent',
      'Contents/Resources/app/bin/cursor',
      'Contents/MacOS/cursor-agent',
      'resources/app/bin/cursor-agent'
    ],
    // Cursor's agent CLI starts ACP with a subcommand, not a flag.
    acpArgs: ['acp'],
    versionArgs: ['--version']
  }
});

/** Ordered so display order is stable and independent of filesystem order. */
export const KNOWN_AGENT_CLI = Object.freeze(Object.values(CLI));

export const CLI_STATUS = Object.freeze({
  IDLE: 'idle',
  PROBING: 'probing',
  CONNECTED: 'connected',
  UNREACHABLE: 'unreachable'
});

export const SCHEMA_VERSION = 1;
