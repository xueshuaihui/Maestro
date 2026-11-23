/**
 * Read/write <root>/.orch/cli-registry.json.
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

export function cliRegistryPath(root) {
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

export async function loadCliRegistry(root) {
  const filePath = cliRegistryPath(root);
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.clis)) {
      return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { path: filePath } };
    }
    // Older registries predate the user_config segment; expose it as [].
    if (!Array.isArray(parsed.user_config)) parsed.user_config = [];
    return { ok: true, registry: parsed, path: filePath };
  } catch (err) {
    if (err?.code === 'ENOENT') return { ok: true, registry: emptyRegistry(null), path: filePath };
    return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { path: filePath, cause: err?.message ?? String(err) } };
  }
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
      verified_at: finding.verified_at ?? null,
      evidence: finding.evidence ?? [],
      version_args: finding.version_args ?? ['--version']
    }))
  };

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await fs.rename(temp, filePath);
  return { ok: true, registry, path: filePath };
}
