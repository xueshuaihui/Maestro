/**
 * Read/write <root>/.orch/cli-registry.json.
 *
 * Discipline:
 * - The registry is a cache of a scan, never the source of truth. A stale
 *   registry must be refreshable by `orch cli scan` without touching anything
 *   else under .orch.
 * - atomicWrite semantics: write temp then rename (reuse persistence helper's
 *   contract but keep this module dependency-light and testable).
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
    clis: []
  };
}

export async function loadCliRegistry(root) {
  const filePath = cliRegistryPath(root);
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.clis)) {
      return { ok: false, code: 'CLI_REGISTRY_INVALID', params: { path: filePath } };
    }
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
  const registry = {
    schemaVersion: SCHEMA_VERSION,
    scanned_at: scanResult.scanned_at,
    sources: scanResult.sources ?? null,
    clis: (scanResult.findings ?? []).map((finding) => ({
      cli_id: finding.cli_id,
      name: finding.name,
      executable: finding.executable ?? null,
      version: finding.version ?? null,
      detected_at: finding.detected_at,
      capabilities: finding.capabilities ?? [],
      max_concurrent_sessions: finding.max_concurrent_sessions ?? null,
      connection_status: finding.connection_status ?? CLI_STATUS.IDLE,
      not_on_path: finding.not_on_path === true,
      verified_at: finding.verified_at ?? null,
      evidence: finding.evidence ?? []
    }))
  };

  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  await fs.rename(temp, filePath);
  return { ok: true, registry, path: filePath };
}
