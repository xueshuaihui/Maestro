/**
 * Read/write the CLI registry.
 *
 * Scope: a CLI is a property of the machine, not of a project. When the shell
 * runs us (`MAESTRO_CONFIG_DIR` points at the per-user config dir) the registry
 * lives beside `projects.json` and every project shares one copy. With no such
 * variable — a bare `orch cli list` in a checkout, and every existing test —
 * the path stays `<root>/.orch/cli-registry.json`, so nothing that predates the
 * machine scope changes behaviour.
 *
 * Discipline:
 * - The registry is a cache of a scan, never the source of truth. A stale
 *   registry must be refreshable by `orch cli scan` without touching anything
 *   else under .orch.
 * - atomicWrite semantics: write temp then rename (reuse persistence helper's
 *   contract but keep this module dependency-light and testable).
 * - The `user_config` segment is independent of the scanned `clis`: entries
 *   are split out by evidence type on every save so re-scans and probe
 *   write-backs never drop them.
 * - Zero CJK; all wording in labels.js.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { SCHEMA_VERSION, CLI_STATUS } from './known-agents.js';

export const CLI_REGISTRY_FILE = path.join('.orch', 'cli-registry.json');

/** Per-user config dir handed down by the desktop shell, if any. */
function machineConfigDir() {
  const dir = process.env.MAESTRO_CONFIG_DIR;
  return typeof dir === 'string' && dir.length > 0 ? dir : null;
}

export function isMachineRegistry() {
  return machineConfigDir() !== null;
}

export function cliRegistryPath(root) {
  const dir = machineConfigDir();
  if (dir !== null) return path.join(dir, 'cli-registry.json');
  return path.join(root, CLI_REGISTRY_FILE);
}

/** The pre-machine-scope location, read once so manual entries survive. */
function legacyRegistryPath(root) {
  if (typeof root !== 'string' || root.length === 0) return null;
  return path.join(root, CLI_REGISTRY_FILE);
}

function emptyRegistry(scannedAt) {
  return {
    schemaVersion: SCHEMA_VERSION,
    scanned_at: scannedAt,
    user_config: [],
    clis: []
  };
}

function normalizeUserConfigEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const executable = entry.executable ?? null;
  if (!executable) return null;
  return {
    cli_id: entry.cli_id ?? null,
    name: entry.name ?? '',
    executable,
    version_args: entry.version_args ?? ['--version'],
    added_at: entry.added_at ?? null
  };
}

function userConfigKey(entry) {
  return entry.cli_id ?? entry.executable;
}

function userConfigFromFinding(finding) {
  const isUserConfig = (finding.evidence ?? [])
    .some((item) => item?.type === 'user-config');
  if (!isUserConfig) return null;
  return normalizeUserConfigEntry({
    cli_id: finding.cli_id,
    name: finding.name,
    executable: finding.executable,
    version_args: finding.version_args,
    added_at: finding.added_at ?? finding.detected_at
  });
}

// Rebuild the persisted user_config segment from the scan evidence while
// keeping the authoritative fields of already-persisted entries.
async function resolveUserConfig(root, options, findings) {
  const map = new Map();
  let persisted = [];
  if (Array.isArray(options.userConfig)) {
    persisted = options.userConfig;
  } else {
    const loaded = await loadCliRegistry(root);
    if (loaded.ok && Array.isArray(loaded.registry.user_config)) {
      persisted = loaded.registry.user_config;
    }
  }

  for (const entry of persisted) {
    const normalized = normalizeUserConfigEntry(entry);
    if (!normalized) continue;
    const key = userConfigKey(normalized);
    if (key && !map.has(key)) map.set(key, normalized);
  }
  for (const finding of findings ?? []) {
    const normalized = userConfigFromFinding(finding);
    if (!normalized) continue;
    const key = userConfigKey(normalized);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, normalized);
      continue;
    }
    if (!existing.added_at && normalized.added_at) existing.added_at = normalized.added_at;
    if (!existing.cli_id && normalized.cli_id) existing.cli_id = normalized.cli_id;
    if (!existing.name && normalized.name) existing.name = normalized.name;
  }
  return [...map.values()];
}

function parseRegistry(text, filePath) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.clis)) {
    return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { path: filePath } };
  }
  // Older registries predate the user_config segment; expose it as [].
  if (!Array.isArray(parsed.user_config)) parsed.user_config = [];
  return { ok: true, registry: parsed, path: filePath };
}

export async function loadCliRegistry(root) {
  const filePath = cliRegistryPath(root);
  try {
    return parseRegistry(await fs.readFile(filePath, 'utf8'), filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { path: filePath, cause: err?.message ?? String(err) } };
    }
  }
  // Machine scope: a project that was scanned before this change still holds a
  // project-local registry. Read it so manually registered paths are not lost;
  // the next save writes them to the machine-level file and the old copy turns
  // into a stale cache nobody reads again.
  const legacy = legacyRegistryPath(root);
  if (isMachineRegistry() && legacy !== null) {
    try {
      const adopted = parseRegistry(await fs.readFile(legacy, 'utf8'), filePath);
      if (adopted.ok) return { ...adopted, migratedFrom: legacy };
    } catch { /* no legacy registry: fall through to the empty one */ }
  }
  return { ok: true, registry: emptyRegistry(null), path: filePath };
}

export async function saveCliRegistry(root, scanResult, options = {}) {
  if (!scanResult || scanResult.ok !== true) {
    return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { cause: 'scan result required' } };
  }
  const filePath = cliRegistryPath(root);
  const findings = scanResult.findings ?? [];
  const user_config = await resolveUserConfig(root, options, findings);
  const registry = {
    schemaVersion: SCHEMA_VERSION,
    scanned_at: scanResult.scanned_at,
    sources: scanResult.sources ?? null,
    user_config,
    clis: findings.map((finding) => ({
      cli_id: finding.cli_id,
      name: finding.name,
      executable: finding.executable ?? null,
      version: finding.version ?? null,
      detected_at: finding.detected_at,
      capabilities: finding.capabilities ?? [],
      acp: finding.acp ?? null,
      transport: finding.transport ?? null,
      resume_dialect: finding.resume_dialect ?? null,
      evidence_hook: finding.evidence_hook ?? null,
      max_concurrent_sessions: finding.max_concurrent_sessions ?? null,
      connection_status: finding.connection_status ?? CLI_STATUS.IDLE,
      not_on_path: finding.not_on_path === true,
      bundled: finding.bundled === true,
      verified_at: finding.verified_at ?? null,
      evidence: finding.evidence ?? [],
      version_args: finding.version_args ?? ['--version'],
      // The ACP entrypoint differs per CLI (`--acp`, `acp`, `--profile acp`).
      // Persisting it means a later bind (new session, another page) starts the
      // same host instead of falling back to the legacy `--acp` flag.
      acp_args: Array.isArray(finding.acp_args) ? finding.acp_args.slice() : ['--acp']
    }))
  };

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await fs.rename(temp, filePath);
  return { ok: true, registry, path: filePath };
}
