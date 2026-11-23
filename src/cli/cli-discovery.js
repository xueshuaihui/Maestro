/**
 * `orch cli list|scan|probe` - A1 of the v2 core form.
 *
 * Discipline:
 * - Zero CJK in this file; all wording comes from CLI_DISCOVERY_TEXT in
 *   labels.js (the single source of Chinese text in this project).
 * - `list` is read-only and never creates .orch; `scan` writes only
 *   .orch/cli-registry.json; `probe` is explicitly opt-in per CLI.
 * - Machine output via `--format json` is a direct JSON.stringify of the
 *   discovery/registry shape, no renderer in between.
 * - Root is process.cwd(), matching the rest of the CLI (no --project here).
 */

import {
  discoverAgentClis,
  probeVersion,
  probeAcp,
  withProbeResults,
  loadCliRegistry,
  saveCliRegistry,
  CLI_STATUS
} from '../adapter/cli-discovery/index.js';
import { CLI_DISCOVERY_TEXT as T, fill } from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

const SUBS = new Set(['list', 'scan', 'probe']);

const STATUS_TEXT = Object.freeze({
  [CLI_STATUS.IDLE]: T.STATUS_IDLE,
  [CLI_STATUS.CONNECTED]: T.STATUS_CONNECTED,
  [CLI_STATUS.UNREACHABLE]: T.STATUS_UNREACHABLE,
  [CLI_STATUS.PROBING]: T.STATUS_PROBING
});

function statusText(status) {
  return STATUS_TEXT[status] ?? String(status);
}

function evidenceText(finding) {
  const types = [...new Set((finding.evidence ?? []).map((item) => item.type))];
  return types.join('+');
}

function renderList(clis, scannedAt) {
  const lines = [T.TITLE];
  if (scannedAt) lines.push(`${T.SCANNED_AT}: ${scannedAt}`);
  lines.push('');
  if (clis.length === 0) {
    lines.push(T.NONE);
    lines.push(T.NONE_HINT);
    return lines.join('\n');
  }
  const header = [T.COL_ID, T.COL_NAME, T.COL_VERSION, T.COL_STATUS, T.COL_PATH, T.COL_EVIDENCE].join('  |  ');
  lines.push(header);
  lines.push('-'.repeat(header.length));
  for (const cli of clis) {
    lines.push([
      cli.cli_id,
      cli.name,
      cli.version ?? '-',
      statusText(cli.connection_status) + (cli.not_on_path ? ` (${T.NOT_ON_PATH})` : ''),
      cli.executable ?? '-',
      evidenceText(cli)
    ].join('  |  '));
  }
  return lines.join('\n');
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>}
 */
export async function cliDiscoveryMain(argv) {
  const tokens = Array.isArray(argv) ? [...argv] : [];
  const sub = tokens.shift();
  if (!SUBS.has(sub)) {
    process.stdout.write(`${fill(T.UNKNOWN_SUB, { sub: sub ?? '' })}\n${T.USAGE}\n`);
    return EXIT_USAGE;
  }

  const flags = {};
  let positional = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--format') {
      flags.format = tokens[i + 1];
      i += 1;
    } else if (typeof token === 'string' && token.startsWith('--')) {
      process.stdout.write(`${T.USAGE}\n`);
      return EXIT_USAGE;
    } else if (positional === null) {
      positional = token;
    } else {
      process.stdout.write(`${T.USAGE}\n`);
      return EXIT_USAGE;
    }
  }
  const asJson = flags.format === 'json';
  const root = process.cwd();

  if (sub === 'list' || sub === 'scan') {
    const loaded = await loadCliRegistry(root);
    if (!loaded.ok) {
      process.stdout.write(`${T.REGISTRY_INVALID}: ${loaded.path}\n`);
      return EXIT_FAILED;
    }
    if (sub === 'scan') {
      const scan = discoverAgentClis();
      const saved = await saveCliRegistry(root, scan);
      if (!saved.ok) {
        process.stdout.write(`${T.REGISTRY_INVALID}\n`);
        return EXIT_FAILED;
      }
      if (asJson) {
        process.stdout.write(`${JSON.stringify(saved.registry, null, 2)}\n`);
      } else {
        process.stdout.write(`${fill(T.SCAN_DONE, { n: scan.findings.length })}\n`);
        process.stdout.write(`${renderList(saved.registry.clis, saved.registry.scanned_at)}\n`);
        process.stdout.write(`${fill(T.SCAN_SAVED, { path: saved.path })}\n`);
      }
      return EXIT_OK;
    }

    if (asJson) {
      process.stdout.write(`${JSON.stringify(loaded.registry, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderList(loaded.registry.clis, loaded.registry.scanned_at)}\n`);
    }
    return EXIT_OK;
  }

  // probe <cli_id>
  if (typeof positional !== 'string' || positional.length === 0) {
    process.stdout.write(`${T.USAGE}\n`);
    return EXIT_USAGE;
  }
  const loaded = await loadCliRegistry(root);
  if (!loaded.ok) {
    process.stdout.write(`${T.REGISTRY_INVALID}\n`);
    return EXIT_FAILED;
  }
  const target = loaded.registry.clis.find((item) => item.cli_id === positional);
  if (!target) {
    process.stdout.write(`${fill(T.NOT_FOUND, { id: positional })}\n`);
    return EXIT_FAILED;
  }
  if (!target.executable) {
    process.stdout.write(`${fill(T.PROBE_FAIL, { name: target.name, cause: T.NOT_ON_PATH })}\n`);
    return EXIT_FAILED;
  }

  const [version, acp] = await Promise.all([
    probeVersion(target),
    probeAcp(target)
  ]);
  const probed = withProbeResults(target, { version, acp });
  const clis = loaded.registry.clis.map((item) => item.cli_id === probed.cli_id ? probed : item);
  await saveCliRegistry(root, {
    ok: true,
    scanned_at: loaded.registry.scanned_at,
    sources: loaded.registry.sources,
    findings: clis
  });

  if (asJson) {
    process.stdout.write(`${JSON.stringify(probed, null, 2)}\n`);
  } else {
    process.stdout.write(`${fill(T.PROBE_OK, {
      name: probed.name,
      acp: acp.ok && acp.acp ? T.PROBE_ACP_YES : T.PROBE_ACP_NO
    })}\n`);
    if (!version.ok || !acp.ok) {
      const cause = !version.ok ? version.params?.cause : acp.params?.cause;
      process.stdout.write(`${fill(T.PROBE_FAIL, { name: probed.name, cause: cause ?? '' })}\n`);
    }
  }
  return EXIT_OK;
}
