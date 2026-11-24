/**
 * `orch cli list|scan|probe|add` - A1 of the v2 core form.
 *
 * Discipline:
 * - Zero CJK in this file; all wording comes from CLI_DISCOVERY_TEXT in
 *   labels.js (the single source of Chinese text in this project).
 * - `list` is read-only and never creates .orch; `scan` writes only
 *   .orch/cli-registry.json; `probe` is explicitly opt-in per CLI.
 * - `add` only records an executable path in the registry user_config
 *   segment. The target file is never modified and no probe is triggered.
 * - Machine output via `--format json` is a direct JSON.stringify of the
 *   discovery/registry shape, no renderer in between.
 * - Root is process.cwd(), matching the rest of the CLI (no --project here).
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  discoverAgentClis,
  probeVersion,
  probeAcp,
  acpArgsFor,
  withProbeResults,
  loadCliRegistry,
  saveCliRegistry,
  buildMatrixData,
  CLI_STATUS
} from '../adapter/cli-discovery/index.js';
import { CLI_DISCOVERY_TEXT as T, fill } from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

const SUBS = new Set(['list', 'scan', 'probe', 'add']);

const STATUS_TEXT = Object.freeze({
  [CLI_STATUS.IDLE]: T.STATUS_IDLE,
  [CLI_STATUS.CONNECTED]: T.STATUS_CONNECTED,
  [CLI_STATUS.UNREACHABLE]: T.STATUS_UNREACHABLE,
  [CLI_STATUS.PROBING]: T.STATUS_PROBING
});

// Dimension key -> frozen label key. The dimension list itself comes from the
// adapter constant, so this map only renders it and never adds/drops a column.
const MATRIX_COLUMN_TEXT = Object.freeze({
  acp: T.MATRIX_COL_ACP,
  transport: T.MATRIX_COL_TRANSPORT,
  resume_dialect: T.MATRIX_COL_RESUME_DIALECT,
  max_concurrent_sessions: T.MATRIX_COL_CONCURRENCY,
  evidence_hook: T.MATRIX_COL_EVIDENCE_HOOK
});

const SOURCE_TYPES = Object.freeze(['path', 'home', 'app', 'npm-global', 'user-config']);

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
    lines.push(T.HINT_ADD_PATH);
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

function matrixCell(value) {
  if (value === null || value === undefined || value === '') return T.NOT_PROBED;
  if (typeof value === 'boolean') return value ? T.PROBE_ACP_YES : T.PROBE_ACP_NO;
  return String(value);
}

function sourceOverview(clis) {
  const counts = new Map(SOURCE_TYPES.map((type) => [type, 0]));
  for (const cli of clis) {
    const types = new Set((cli?.evidence ?? []).map((item) => item?.type));
    for (const type of types) {
      if (counts.has(type)) counts.set(type, counts.get(type) + 1);
    }
  }
  return SOURCE_TYPES.map((type) => `${type}:${counts.get(type)}`).join('  ');
}

/**
 * Render the capability matrix as a segment appended after renderList.
 * The table has exactly one column per frozen dimension (five); the CLI name
 * is printed on its own line so no extra table column is introduced.
 */
function renderMatrix(matrixData, clis = []) {
  const lines = [T.MATRIX_TITLE, ''];
  const dimensions = matrixData?.dimensions ?? [];
  const header = dimensions.map((dimension) => MATRIX_COLUMN_TEXT[dimension] ?? dimension).join('  |  ');
  lines.push(header);
  lines.push('-'.repeat(header.length));
  for (const row of matrixData?.rows ?? []) {
    lines.push(`${row.name ?? row.cli_id ?? '-'}:`);
    lines.push(dimensions.map((dimension) => matrixCell(row[dimension])).join('  |  '));
  }
  lines.push('');
  lines.push(`${T.MATRIX_SOURCES}: ${sourceOverview(clis)}`);
  return lines.join('\n');
}

function cliIdFor(name, executable) {
  const slug = (value) => String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug(name)
    || slug(path.basename(executable, path.extname(executable)))
    || 'user-cli';
}

function canonicalPath(target) {
  const resolved = path.resolve(target);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function fail(text) {
  process.stdout.write(`${text}\n`);
  return EXIT_FAILED;
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
    } else if (token === '--name') {
      flags.name = tokens[i + 1];
      i += 1;
    } else if (token === '--path') {
      flags.path = tokens[i + 1];
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
      const scan = discoverAgentClis({ userConfig: loaded.registry.user_config });
      const saved = await saveCliRegistry(root, scan, { userConfig: loaded.registry.user_config });
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
      process.stdout.write(`${renderMatrix(buildMatrixData(loaded.registry.clis), loaded.registry.clis)}\n`);
    }
    return EXIT_OK;
  }

  // add --name <name> --path <executable>: record a path, leave the file as-is.
  if (sub === 'add') {
    const name = typeof flags.name === 'string' ? flags.name.trim() : '';
    const rawPath = typeof flags.path === 'string' ? flags.path.trim() : '';
    if (!name) return fail(T.ADD_FAIL_EMPTY_NAME);
    if (!rawPath) return fail(T.ADD_FAIL_EMPTY_PATH);
    const executable = path.resolve(rawPath);
    const canonical = canonicalPath(executable);
    try {
      fs.accessSync(executable, fs.constants.X_OK);
      if (!fs.statSync(executable).isFile()) return fail(T.ADD_FAIL_NOT_EXECUTABLE);
    } catch (err) {
      const missing = err?.code === 'ENOENT' || err?.code === 'ENOTDIR';
      return fail(missing ? T.ADD_FAIL_NOT_FOUND : T.ADD_FAIL_NOT_EXECUTABLE);
    }

    const loaded = await loadCliRegistry(root);
    if (!loaded.ok) {
      process.stdout.write(`${T.REGISTRY_INVALID}: ${loaded.path}\n`);
      return EXIT_FAILED;
    }
    const existing = loaded.registry.user_config ?? [];
    const duplicate = [...existing, ...(loaded.registry.clis ?? [])].some((item) => {
      if (!item?.executable) return false;
      try {
        return canonicalPath(item.executable) === canonical;
      } catch {
        return false;
      }
    });
    if (duplicate) return fail(fill(T.ADD_EXISTS, { path: executable }));

    const addedAt = new Date().toISOString();
    const nextUserConfig = [
      ...existing,
      {
        cli_id: cliIdFor(name, executable),
        name,
        executable,
        version_args: ['--version'],
        acp_args: acpArgsFor({ cli_id: cliIdFor(name, executable) }),
        added_at: addedAt
      }
    ];
    // Project the user_config entries through the adapter's own pure path so
    // the new item is visible in `clis` immediately, without touching PATH,
    // home or app directories and without any probing.
    const scan = discoverAgentClis({
      env: {}, home: '', platform: process.platform,
      pathEntries: [], appDirs: [], npmGlobalRoot: null,
      known: [], userConfig: nextUserConfig, clock: () => addedAt
    });
    const autoClis = (loaded.registry.clis ?? []).filter(
      (item) => !(item?.evidence ?? []).some((evidence) => evidence?.type === 'user-config')
    );
    scan.findings = [...autoClis, ...scan.findings];

    const saved = await saveCliRegistry(root, scan, { userConfig: nextUserConfig });
    if (!saved.ok) return fail(T.REGISTRY_INVALID);
    process.stdout.write(`${fill(T.ADD_OK, { name, path: executable })}\n`);
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
