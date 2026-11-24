/**
 * Local, read-only discovery of Agent CLI executables on this machine.
 *
 * Sources (matching the v2 PRD capability domain 0):
 *   1. PATH              - executable lookup, no shell, no `which` dependency.
 *   2. home markers      - config dirs, evidence only (not proof of an executable).
 *   3. npm global root   - package dirs, read via `npm root -g` when available.
 *   4. application dirs  - macOS /Applications, Windows Program Files, XDG.
 *   5. user config       - explicitly registered executables (options.userConfig).
 *
 * Discipline:
 * - Zero CJK here; wording lives in labels.js and is attached by the CLI layer.
 * - Never writes to / spawns anything in discovery itself. Version and ACP
 *   probing are separate, explicitly-invoked steps (see probe.js).
 * - Every finding carries `evidence` so the UI can show where it came from.
 * - Injectable fs/env/platform for deterministic tests; fixtures use os.tmpdir().
 */

import fsSync from 'node:fs';
import path from 'node:path';

import { KNOWN_AGENT_CLI, CLI_STATUS, SCHEMA_VERSION } from './known-agents.js';

/** ACP entrypoint args from the known table; legacy flag for unknown CLIs. */
function acpArgsForKnown(cliId, known = KNOWN_AGENT_CLI) {
  const def = typeof cliId === 'string' ? known.find((item) => item.cli_id === cliId) : null;
  return def?.acpArgs ?? ['--acp'];
}

const exists = (fileSystem, target) => {
  try {
    fileSystem.accessSync(target);
    return true;
  } catch {
    return false;
  }
};

const isDir = (fileSystem, target) => {
  try {
    return fileSystem.statSync(target).isDirectory();
  } catch {
    return false;
  }
};

/**
 * `platform` is explicit on purpose: the caller may pin it (tests, capability
 * matrix previews, cross-platform re-scans of a mounted volume). Reading
 * `process.platform` here would silently ignore the injected value and, on
 * Windows, append PATHEXT suffixes to a name the caller asked to resolve
 * as-is.
 */
const isExecutable = (fileSystem, target, platform = process.platform) => {
  try {
    const mode = fileSystem.statSync(target).mode;
    // Windows has no exec bit in the POSIX sense; existence of a resolvable
    // file in a PATH entry is the practical signal there.
    return platform === 'win32' || (mode & 0o111) !== 0;
  } catch {
    return false;
  }
};

function splitPath(pathValue, pathSeparator) {
  return String(pathValue ?? '')
    .split(pathSeparator)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function resolveOnPath(bin, pathEntries, fileSystem, pathApi, { platform, env } = {}) {
  const win = (platform ?? process.platform) === 'win32';
  const pathext = (env ?? process.env).PATHEXT;
  const extensions = win
    ? String(pathext ?? '.EXE;.CMD;.BAT').split(';').filter(Boolean)
    : [''];
  for (const entry of pathEntries) {
    for (const ext of extensions) {
      const candidate = pathApi.join(entry, `${bin}${ext}`);
      if (exists(fileSystem, candidate) && isExecutable(fileSystem, candidate, platform)) return candidate;
    }
  }
  return null;
}

function homeMarkerPaths(def, home, pathApi) {
  if (!home) return [];
  return (def.homeDirs ?? [])
    .map((dir) => pathApi.join(home, dir))
    .filter((target) => isDir(fsSync, target) || exists(fsSync, target));
}

function appPaths(def, options, pathApi, fileSystem) {
  const result = [];
  for (const name of def.appNames ?? []) {
    const candidates = options.appDirs ?? [];
    for (const dir of candidates) {
      const target = pathApi.join(dir, name);
      if (exists(fileSystem, target)) result.push(target);
    }
  }
  return result;
}

function npmPackagePaths(def, npmGlobalRoot, pathApi, fileSystem) {
  if (!npmGlobalRoot) return [];
  return (def.npmPackages ?? [])
    .map((pkg) => pathApi.join(npmGlobalRoot, pkg))
    .filter((target) => isDir(fileSystem, target));
}

// A persisted user entry has no guaranteed cli_id. Derive a stable one from
// name (then executable basename) so the id survives repeated scans.
function userConfigCliId(entry) {
  if (typeof entry?.cli_id === 'string' && entry.cli_id.trim()) return entry.cli_id.trim();
  const slug = (value) => String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const fromName = slug(entry?.name);
  if (fromName) return fromName;
  const executable = String(entry?.executable ?? '');
  const base = executable ? path.basename(executable, path.extname(executable)) : '';
  return slug(base) || 'user-cli';
}

function userConfigFinding(entry, detectedAt) {
  const executable = entry?.executable ?? null;
  return {
    cli_id: userConfigCliId(entry),
    name: entry?.name ?? '',
    executable,
    version: null,
    detected_at: entry?.added_at ?? detectedAt,
    capabilities: [],
    acp: null,
    transport: null,
    resume_dialect: null,
    max_concurrent_sessions: null,
    evidence_hook: null,
    connection_status: CLI_STATUS.IDLE,
    not_on_path: false,
    verified_at: null,
    evidence: [{ type: 'user-config', value: executable }],
    version_args: entry?.version_args ?? ['--version'],
    acp_args: entry?.acp_args ?? acpArgsForKnown(entry?.cli_id)
  };
}

/**
 * @param {{
 *   env?: Record<string, string|undefined>,
 *   home?: string,
 *   platform?: string,
 *   pathSeparator?: string,
 *   pathEntries?: string[],
 *   appDirs?: string[],
 *   npmGlobalRoot?: string|null,
 *   clock?: () => string,
 *   fileSystem?: object,
 *   known?: Array<object>,
 *   pathApi?: object,
 *   userConfig?: Array<{cli_id?: string, name: string, executable: string, version_args?: string[], added_at?: string}>,
 * }} options
 */
export function discoverAgentClis(options = {}) {
  const fileSystem = options.fileSystem ?? fsSync;
  const pathApi = options.pathApi ?? path;
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const separator = options.pathSeparator ?? pathApi.delimiter;
  const home = options.home ?? env.HOME ?? env.USERPROFILE ?? '';
  const clock = options.clock ?? (() => new Date().toISOString());
  const known = options.known ?? KNOWN_AGENT_CLI;

  const pathEntries = options.pathEntries ?? splitPath(env.PATH, separator);
  const appDirs = options.appDirs ?? defaultAppDirs(home, platform, pathApi);
  const npmGlobalRoot = options.npmGlobalRoot ?? null;

  const detectedAt = clock();
  const findings = [];

  for (const def of known) {
    const evidence = [];
    let executable = null;

    for (const bin of def.bin ?? []) {
      const found = resolveOnPath(bin, pathEntries, fileSystem, pathApi, { platform, env });
      if (found) {
        executable = found;
        evidence.push({ type: 'path', value: found, note: bin });
        break;
      }
    }
    for (const marker of homeMarkerPaths(def, home, pathApi)) {
      evidence.push({ type: 'home', value: marker });
    }
    for (const app of appPaths(def, { appDirs }, pathApi, fileSystem)) {
      evidence.push({ type: 'app', value: app });
    }
    for (const pkg of npmPackagePaths(def, npmGlobalRoot, pathApi, fileSystem)) {
      evidence.push({ type: 'npm-global', value: pkg });
    }

    // A CLI is reportable when it has ANY evidence: a PATH executable is a
    // usable carrier, while home/app/npm markers mean "installed but not on
    // PATH". The latter must still be listed (PRD: never silently drop an
    // unreachable CLI) so the UI can show a fix hint instead of an empty page.
    if (evidence.length === 0) continue;

    findings.push({
      cli_id: def.cli_id,
      name: def.name,
      executable,
      version: null,
      detected_at: detectedAt,
      capabilities: [],
      acp: null,
      transport: null,
      resume_dialect: null,
      evidence_hook: null,
      max_concurrent_sessions: null,
      connection_status: executable ? CLI_STATUS.IDLE : CLI_STATUS.UNREACHABLE,
      not_on_path: executable ? false : true,
      verified_at: null,
      evidence,
      version_args: def.versionArgs ?? ['--version'],
      acp_args: def.acpArgs ?? ['--acp']
    });
  }

  // Fourth source: explicitly registered entries. They are appended after the
  // automatic sources so re-scans can rehydrate them from the registry.
  for (const entry of Array.isArray(options.userConfig) ? options.userConfig : []) {
    findings.push(userConfigFinding(entry, detectedAt));
  }

  return {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    scanned_at: detectedAt,
    sources: {
      path_entries: pathEntries.length,
      home: home || null,
      app_dirs: appDirs.length,
      npm_global_root: npmGlobalRoot ?? null
    },
    findings
  };
}

function defaultAppDirs(home, platform, pathApi) {
  if (!home) return [];
  if (platform === 'darwin') return [pathApi.join(home, 'Applications'), '/Applications'];
  if (platform === 'win32') {
    return [
      pathApi.join(home, 'AppData', 'Local', 'Programs'),
      pathApi.join(process.env.ProgramFiles ?? 'C:\\Program Files', '')
    ];
  }
  return [pathApi.join(home, '.local', 'share', 'applications')];
}

export { SCHEMA_VERSION, CLI_STATUS };
