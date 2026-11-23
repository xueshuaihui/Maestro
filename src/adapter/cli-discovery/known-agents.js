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
    versionArgs: ['--version']
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
    versionArgs: ['--version']
  },
  cursor: {
    cli_id: 'cursor',
    name: 'Cursor Agent',
    bin: ['cursor-agent', 'agent'],
    npmPackages: [],
    homeDirs: ['.cursor'],
    appNames: ['Cursor.app'],
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
