/**
 * V3.2 CLI resource pool: two-stage discovery, health checks and capability
 * matrix. English only by design (see plan section 0.7 red line 5).
 *
 * All state writes go through store.transit(). Discovery/probe modules are
 * imported read-only; no external scan tool is a runtime dependency.
 *
 * Implementation conventions (the spec does not fix these literals):
 * - health: healthy | degraded | unhealthy | unknown
 * - auth: authenticated | unauthenticated | not_required | unknown
 * - resumableStatus: yes | no | unknown (resumable itself must be boolean per
 *   the T01 cliInstall shape, so an undetermined result stores false plus an
 *   explicit unknown status and reason instead of a fabricated verdict)
 * - source: scan-quick | scan-full | manual
 * - stale: true when a scanned installation was absent from the latest scan
 * - fingerprint: sha256 of the normalized absolute path, prefixed fp1:
 */

import { createHash } from 'node:crypto';
import path from 'node:path';

import { fail, ok, validate } from './contracts.js';
import { createV32Store } from './store.js';
import {
  CLI_STATUS, discoverAgentClis, resolveNpmGlobalRoot
} from '../adapter/cli-discovery/discover.js';
import {
  acpArgsFor, probeAcp, probeVersion, withProbeResults
} from '../adapter/cli-discovery/probe.js';

export const UNKNOWN = 'unknown';
export const CLI_SCAN_MODES = Object.freeze(['quick', 'full']);
export const CLI_SCAN_PHASES = Object.freeze(['quick', 'full', 'done']);

export const CLI_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
});
export const CLI_AUTH = Object.freeze({
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  NOT_REQUIRED: 'not_required',
  UNKNOWN: 'unknown'
});
export const CLI_RESUME = Object.freeze({ YES: 'yes', NO: 'no', UNKNOWN: 'unknown' });
export const CLI_SOURCES = Object.freeze({ QUICK: 'scan-quick', FULL: 'scan-full', MANUAL: 'manual' });

/** The eight information items required by spec section 7.1. */
export const CLI_INSTALL_FIELDS = Object.freeze([
  'name', 'path', 'version', 'adapter', 'capabilities', 'health', 'auth', 'resumable'
]);

const REASONS = Object.freeze({
  QUICK: 'quick scan does not run version or acp probes',
  NO_EXECUTABLE: 'discovery returned no executable path',
  NO_ACP: 'acp probe returned no verdict',
  NO_VERSION: 'version probe returned no value',
  NO_AUTH: 'auth state is not exposed by version or acp probes',
  NO_RESUME: 'session resume capability requires an acp probe verdict',
  NO_CAP: 'capability declaration requires an acp probe verdict',
  NO_HEALTH: 'health requires an executable and a probe verdict',
  BAD_PATH: 'path must be a non-empty absolute path'
});

const isText = (value) => typeof value === 'string' && value.length > 0;

function normalizePath(candidate) {
  if (!isText(candidate)) return null;
  const value = candidate.trim();
  if (!path.isAbsolute(value)) return null;
  return process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
}

/** Stable identity of an executable. Path-based on purpose: upgrades keep the pin. */
export function fingerprintFor(candidate) {
  const normalized = normalizePath(candidate);
  if (!normalized) return null;
  return `fp1:${createHash('sha256').update(normalized).digest('hex').slice(0, 32)}`;
}

function fingerprintForFinding(finding) {
  if (isText(finding?.executable)) return fingerprintFor(finding.executable);
  const key = isText(finding?.cli_id) ? `cli:${finding.cli_id}` : `name:${finding?.name ?? ''}`;
  return `fp1:${createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
}

function capabilitiesOf({ items = [], session = [], source = UNKNOWN, reason = null, acp = null } = {}) {
  return {
    items: Array.isArray(items) ? items.slice() : [],
    session: Array.isArray(session) ? session.slice() : [],
    source,
    reason,
    acp
  };
}

function resumeVerdict(session, acpVerdict) {
  if (acpVerdict !== true) {
    return {
      resumable: false,
      resumableStatus: acpVerdict === false ? CLI_RESUME.NO : CLI_RESUME.UNKNOWN
    };
  }
  const list = Array.isArray(session) ? session.map((item) => String(item).toLowerCase()) : [];
  const canResume = list.some((item) => ['resume', 'loadsession', 'load', 'load_session'].includes(item));
  return { resumable: canResume, resumableStatus: canResume ? CLI_RESUME.YES : CLI_RESUME.NO };
}

function healthVerdict({ acpVerdict, versionKnown, executable }) {
  if (!executable) return { health: CLI_HEALTH.UNKNOWN, healthReason: REASONS.NO_HEALTH };
  if (acpVerdict === true) {
    return versionKnown
      ? { health: CLI_HEALTH.HEALTHY, healthReason: null }
      : { health: CLI_HEALTH.DEGRADED, healthReason: REASONS.NO_VERSION };
  }
  if (acpVerdict === false) return { health: CLI_HEALTH.UNHEALTHY, healthReason: null };
  return { health: CLI_HEALTH.UNKNOWN, healthReason: REASONS.NO_ACP };
}

function unknownFieldsFor(fields) {
  const out = {};
  for (const [field, reason] of Object.entries(fields)) {
    if (reason) out[field] = reason;
  }
  return out;
}

/**
 * Build and validate one cliInstall object. All eight spec items are always
 * present; undetermined items carry a literal 'unknown' plus a reason.
 */
export function buildInstall({
  id, name, installPath, version, adapter, protocol = null, capabilities,
  health, auth, resumable, resumableStatus = null, resumableReason = null,
  healthReason = null, authReason = null, healthCheckedAt = null,
  fingerprint, source, stale = false, unknownFields = {}, extra = {}
}) {
  const resolvedResume = resumableStatus
    ? { resumable: Boolean(resumable), resumableStatus }
    : { resumable: Boolean(resumable), resumableStatus: resumable ? CLI_RESUME.YES : CLI_RESUME.NO };
  const install = {
    id: id ?? null,
    name: isText(name) ? name : UNKNOWN,
    path: isText(installPath) ? installPath : UNKNOWN,
    version: isText(version) ? version : UNKNOWN,
    adapter: isText(adapter) ? adapter : UNKNOWN,
    capabilities: capabilities ?? capabilitiesOf(),
    health: health ?? CLI_HEALTH.UNKNOWN,
    auth: auth ?? CLI_AUTH.UNKNOWN,
    resumable: resolvedResume.resumable,
    fingerprint: isText(fingerprint) ? fingerprint : null,
    source: isText(source) ? source : UNKNOWN,
    protocol: isText(protocol) ? protocol : UNKNOWN,
    stale: Boolean(stale),
    healthReason: healthReason ?? null,
    healthCheckedAt: healthCheckedAt ?? null,
    authReason: authReason ?? null,
    resumableStatus: resolvedResume.resumableStatus,
    resumableReason: resumableReason ?? null,
    unknownFields: { ...unknownFields },
    ...extra
  };
  install.id = id ?? `CLI-PENDING-${install.fingerprint ?? 'none'}`;
  const checked = validate('cliInstall', install);
  if (!checked.ok) return fail(checked.code, checked.params);
  return ok(install);
}

function safeProbe(fn) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      return value.then((result) => result, (error) => ({
        ok: false,
        code: 'CLI_PROBE_THREW',
        params: { cause: String(error?.message ?? error) }
      }));
    }
    return value;
  } catch (error) {
    return { ok: false, code: 'CLI_PROBE_THREW', params: { cause: String(error?.message ?? error) } };
  }
}

function probeReason(result) {
  if (!result) return REASONS.NO_ACP;
  if (result.ok === false) return String(result.params?.cause ?? result.code ?? REASONS.NO_ACP);
  return null;
}

function findingToInstall(finding, probeResults, mode, timestamp) {
  const executable = isText(finding?.executable);
  const full = mode === 'full';
  const versionResult = full ? probeResults.version : null;
  const acpResult = full ? probeResults.acp : null;
  const merged = full
    ? withProbeResults(finding, {
      version: versionResult?.ok ? versionResult : null,
      acp: acpResult?.ok ? acpResult : null
    })
    : finding;

  const acpVerdict = typeof merged.acp === 'boolean' ? merged.acp : null;
  const version = full && versionResult?.ok && isText(merged.version) ? merged.version : UNKNOWN;
  const adapter = acpVerdict === true ? 'acp' : UNKNOWN;
  const protocol = acpVerdict === true ? 'acp' : UNKNOWN;
  const session = full && Array.isArray(acpResult?.sessionCapabilities)
    ? acpResult.sessionCapabilities
    : (Array.isArray(merged.sessionCapabilities) ? merged.sessionCapabilities : []);
  const caps = capabilitiesOf({
    items: merged.capabilities ?? [],
    session,
    source: acpVerdict === true ? 'acp-probe' : UNKNOWN,
    reason: acpVerdict === true ? null : (full ? probeReason(acpResult) : REASONS.QUICK),
    acp: acpVerdict
  });
  const health = full
    ? healthVerdict({ acpVerdict, versionKnown: version !== UNKNOWN, executable })
    : { health: CLI_HEALTH.UNKNOWN, healthReason: REASONS.QUICK };
  const resume = full ? resumeVerdict(caps.session, acpVerdict) : {
    resumable: false, resumableStatus: CLI_RESUME.UNKNOWN
  };

  const unknown = {
    version: version === UNKNOWN
      ? (full ? (versionResult?.ok ? REASONS.NO_VERSION : probeReason(versionResult)) : REASONS.QUICK)
      : null,
    adapter: acpVerdict === true ? null : (full ? (executable ? REASONS.NO_ACP : REASONS.NO_EXECUTABLE) : REASONS.QUICK),
    capabilities: caps.source === UNKNOWN ? caps.reason : null,
    health: health.health === CLI_HEALTH.UNKNOWN ? health.healthReason : null,
    auth: REASONS.NO_AUTH,
    resumable: resume.resumableStatus === CLI_RESUME.UNKNOWN ? REASONS.NO_RESUME : null,
    path: executable ? null : REASONS.NO_EXECUTABLE
  };

  return buildInstall({
    name: finding?.name ?? finding?.cli_id ?? UNKNOWN,
    installPath: executable ? finding.executable : UNKNOWN,
    version,
    adapter,
    protocol,
    capabilities: caps,
    health: health.health,
    healthReason: health.healthReason,
    auth: CLI_AUTH.UNKNOWN,
    authReason: REASONS.NO_AUTH,
    resumable: resume.resumable,
    resumableStatus: resume.resumableStatus,
    resumableReason: resume.resumableStatus === CLI_RESUME.UNKNOWN ? REASONS.NO_RESUME : null,
    healthCheckedAt: full && executable ? timestamp : null,
    fingerprint: fingerprintForFinding(finding),
    source: mode === 'full' ? CLI_SOURCES.FULL : CLI_SOURCES.QUICK,
    stale: false,
    unknownFields: unknownFieldsFor(unknown),
    extra: {
      cliId: finding?.cli_id ?? null,
      evidence: Array.isArray(finding?.evidence) ? finding.evidence.slice() : [],
      detectedAt: finding?.detected_at ?? timestamp,
      updatedAt: timestamp
    }
  });
}

/**
 * @param {object} options
 * @param {object} [options.store] injected store (otherwise created lazily from root)
 * @param {string} [options.root] absolute project root
 * @param {Function} [options.now] ISO clock
 * @param {object} [options.discovery] overrides for discover.js exports (tests)
 * @param {object} [options.probe] overrides for probe.js exports (tests)
 * @param {object} [options.discoveryOptions] passed to discoverAgentClis
 * @param {object} [options.probeOptions] passed to probeVersion / probeAcp
 */
export function createCliPool({
  store: injectedStore = null,
  root = null,
  now = () => new Date().toISOString(),
  discovery = {},
  probe = {},
  discoveryOptions = {},
  probeOptions = {}
} = {}) {
  let cachedStore = injectedStore;
  const getStore = () => {
    if (!cachedStore) {
      if (!isText(root) || !path.isAbsolute(root)) {
        throw new TypeError('createCliPool: absolute root or injected store required');
      }
      cachedStore = createV32Store({ root, now });
    }
    return cachedStore;
  };

  const discoverFn = discovery.discoverAgentClis ?? discoverAgentClis;
  const npmRootFn = discovery.resolveNpmGlobalRoot ?? resolveNpmGlobalRoot;
  const statusEnum = discovery.CLI_STATUS ?? CLI_STATUS;
  const probeVersionFn = probe.probeVersion ?? probeVersion;
  const probeAcpFn = probe.probeAcp ?? probeAcp;
  const withProbeFn = probe.withProbeResults ?? withProbeResults;
  const acpArgsFn = probe.acpArgsFor ?? acpArgsFor;

  const list = () => getStore().list('cliInstall');

  function scanStatus() {
    const state = getStore().read();
    const installs = state.cliPool.installs;
    return {
      ...state.cliPool.scan,
      discovered: installs.length,
      available: installs.filter((item) => item.health === CLI_HEALTH.HEALTHY).length,
      unhealthy: installs.filter((item) => item.health === CLI_HEALTH.UNHEALTHY).length
    };
  }

  async function runProbes(finding) {
    if (!isText(finding?.executable)) {
      return { version: null, acp: null };
    }
    const args = acpArgsFn(finding);
    const [version, acp] = await Promise.all([
      safeProbe(() => probeVersionFn(finding, probeOptions)),
      safeProbe(() => probeAcpFn(finding, { ...probeOptions, args }))
    ]);
    return { version, acp };
  }

  /**
   * Two-stage scan. Writes only cliPool.installs[] and cliPool.scan:
   * running (started event) -> discovery -> optional full probes -> done (finished event).
   */
  async function scan({ mode = 'full', reason = 'v32-cli-scan', actor = 'system' } = {}) {
    if (!CLI_SCAN_MODES.includes(mode)) return fail('V32_INVALID_INPUT', { field: 'mode', value: mode });
    const store = getStore();
    const startedAt = now();

    const started = store.transit((draft) => {
      draft.cliPool.scan = {
        mode,
        startedAt,
        finishedAt: null,
        status: 'running',
        phase: mode === 'full' ? 'full' : 'quick',
        discovered: null,
        available: null,
        unhealthy: null
      };
      return {
        ok: true,
        value: { ...draft.cliPool.scan },
        events: [{
          type: 'cli.scan.started',
          refs: {},
          payload: { mode, startedAt }
        }]
      };
    }, { expectedRev: store.read().rev, reason, actor });
    if (!started.ok) return started;

    let findings;
    try {
      const discovered = await discoverFn({ ...discoveryOptions });
      if (!discovered?.ok) return fail('V32_INVALID_INPUT', {
        field: 'discovery', code: discovered?.code ?? 'CLI_DISCOVERY_FAILED'
      });
      findings = Array.isArray(discovered.findings) ? discovered.findings : [];
    } catch (error) {
      return fail('V32_INVALID_INPUT', { field: 'discovery', message: String(error?.message ?? error) });
    }

    const built = [];
    for (const finding of findings) {
      const probes = mode === 'full' ? await runProbes(finding) : { version: null, acp: null };
      const builtInstall = findingToInstall(finding, probes, mode, startedAt);
      if (!builtInstall.ok) return builtInstall;
      built.push(builtInstall.value);
    }

    const finishedAt = now();
    const result = store.transit((draft, ctx) => {
      const seen = new Set();
      for (const candidate of built) {
        const existing = draft.cliPool.installs.find((item) => item.fingerprint === candidate.fingerprint);
        seen.add(candidate.fingerprint);
        if (existing) {
          const preserved = mode === 'quick' && existing.version !== UNKNOWN
            ? {
              version: existing.version,
              adapter: existing.adapter,
              protocol: existing.protocol,
              capabilities: existing.capabilities,
              health: existing.health,
              healthReason: existing.healthReason,
              healthCheckedAt: existing.healthCheckedAt,
              auth: existing.auth,
              authReason: existing.authReason,
              resumable: existing.resumable,
              resumableStatus: existing.resumableStatus,
              resumableReason: existing.resumableReason
            }
            : {};
          Object.assign(existing, candidate, preserved, {
            id: existing.id,
            stale: false,
            source: candidate.source
          });
        } else {
          const allocated = ctx.nextId('cliInstall');
          if (!allocated.ok) return allocated;
          draft.cliPool.installs.push({ ...candidate, id: allocated.value });
        }
      }
      for (const install of draft.cliPool.installs) {
        if (!seen.has(install.fingerprint) && install.source !== CLI_SOURCES.MANUAL) install.stale = true;
      }
      const installs = draft.cliPool.installs;
      const stats = {
        discovered: installs.length,
        available: installs.filter((item) => item.health === CLI_HEALTH.HEALTHY).length,
        unhealthy: installs.filter((item) => item.health === CLI_HEALTH.UNHEALTHY).length
      };
      draft.cliPool.scan = {
        mode,
        startedAt,
        finishedAt,
        status: 'done',
        phase: 'done',
        ...stats
      };
      return {
        ok: true,
        value: { scan: { ...draft.cliPool.scan }, installs: installs.slice(), stats },
        events: [{
          type: 'cli.scan.finished',
          refs: {},
          payload: { mode, startedAt, finishedAt, ...stats }
        }]
      };
    }, { expectedRev: store.read().rev, reason, actor });
    if (!result.ok) return result;
    return ok(result.mutatorValue);
  }

  /** Re-probe one installation. Data stays visible even when the probe fails. */
  async function checkHealth({ id, reason = 'v32-cli-health', actor = 'system' } = {}) {
    const store = getStore();
    const current = store.get('cliInstall', id);
    if (!current) return fail('V32_NOT_FOUND', { kind: 'cliInstall', id });
    const finding = {
      cli_id: current.cliId ?? null,
      name: current.name,
      executable: current.path !== UNKNOWN ? current.path : null,
      version_args: current.versionArgs ?? ['--version'],
      acp_args: current.acpArgs ?? null,
      capabilities: current.capabilities?.items ?? [],
      evidence: current.evidence ?? []
    };
    const probes = await runProbes(finding);
    const updated = findingToInstall(finding, probes, 'full', now());
    if (!updated.ok) return updated;
    const checkedAt = now();
    const result = store.transit((draft) => {
      const target = draft.cliPool.installs.find((item) => item.id === id);
      if (!target) return fail('V32_NOT_FOUND', { kind: 'cliInstall', id });
      Object.assign(target, updated.value, {
        id,
        fingerprint: current.fingerprint,
        source: current.source,
        stale: false,
        healthCheckedAt: checkedAt,
        updatedAt: checkedAt
      });
      return {
        ok: true,
        value: { ...target },
        events: [{
          type: 'cli.health.checked',
          refs: { cliInstallationId: id },
          payload: { id, health: target.health, healthReason: target.healthReason, checkedAt }
        }]
      };
    }, { expectedRev: store.read().rev, reason, actor });
    return result.ok ? ok(result.mutatorValue) : result;
  }

  /** Manual add. Duplicate fingerprint returns the existing row unchanged. */
  function addManual(input = {}, { reason = 'v32-cli-manual-add', actor = 'system' } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return fail('V32_INVALID_INPUT', { field: 'input' });
    }
    const installPath = isText(input.path) ? input.path.trim() : null;
    if (!installPath || !path.isAbsolute(installPath)) return fail('V32_INVALID_INPUT', {
      field: 'path', reason: REASONS.BAD_PATH
    });
    const fingerprint = fingerprintFor(installPath);
    const store = getStore();
    const duplicate = store.list('cliInstall').find((item) => item.fingerprint === fingerprint);
    if (duplicate) return ok({ install: duplicate, deduplicated: true });

    const capabilities = input.capabilities && typeof input.capabilities === 'object'
      ? capabilitiesOf({
        items: Array.isArray(input.capabilities.items) ? input.capabilities.items : [],
        session: Array.isArray(input.capabilities.session) ? input.capabilities.session : [],
        source: isText(input.capabilities.source) ? input.capabilities.source : 'manual',
        reason: input.capabilities.reason ?? null,
        acp: typeof input.capabilities.acp === 'boolean' ? input.capabilities.acp : null
      })
      : capabilitiesOf({ source: 'manual', reason: 'no capability declaration provided' });
    const health = CLI_HEALTH_VALUES.includes(input.health) ? input.health : CLI_HEALTH.UNKNOWN;
    const auth = CLI_AUTH_VALUES.includes(input.auth) ? input.auth : CLI_AUTH.UNKNOWN;
    const resumeStatus = Object.values(CLI_RESUME).includes(input.resumableStatus)
      ? input.resumableStatus : (typeof input.resumable === 'boolean' ? CLI_RESUME.YES : CLI_RESUME.UNKNOWN);
    const built = buildInstall({
      name: input.name,
      installPath,
      version: input.version,
      adapter: input.adapter,
      protocol: input.protocol,
      capabilities,
      health,
      healthReason: health === CLI_HEALTH.UNKNOWN ? REASONS.NO_HEALTH : null,
      auth,
      authReason: auth === CLI_AUTH.UNKNOWN ? REASONS.NO_AUTH : null,
      resumable: typeof input.resumable === 'boolean' ? input.resumable : false,
      resumableStatus: resumeStatus,
      resumableReason: resumeStatus === CLI_RESUME.UNKNOWN ? REASONS.NO_RESUME : null,
      healthCheckedAt: health === CLI_HEALTH.UNKNOWN ? null : now(),
      fingerprint,
      source: CLI_SOURCES.MANUAL,
      stale: false,
      unknownFields: unknownFieldsFor({
        version: isText(input.version) ? null : 'no version provided',
        adapter: isText(input.adapter) ? null : 'no adapter provided',
        capabilities: capabilities.source === 'manual' && capabilities.items.length === 0 ? 'no capability declaration provided' : null,
        health: health === CLI_HEALTH.UNKNOWN ? 'no health result provided' : null,
        auth: auth === CLI_AUTH.UNKNOWN ? REASONS.NO_AUTH : null,
        resumable: resumeStatus === CLI_RESUME.UNKNOWN ? REASONS.NO_RESUME : null
      }),
      extra: {
        cliId: input.cliId ?? null,
        evidence: [],
        detectedAt: now(),
        updatedAt: now(),
        versionArgs: Array.isArray(input.versionArgs) ? input.versionArgs.slice() : ['--version'],
        acpArgs: Array.isArray(input.acpArgs) ? input.acpArgs.slice() : null
      }
    });
    if (!built.ok) return built;

    const result = store.transit((draft, ctx) => {
      const allocated = ctx.nextId('cliInstall');
      if (!allocated.ok) return allocated;
      const install = { ...built.value, id: allocated.value };
      draft.cliPool.installs.push(install);
      return { ok: true, value: install };
    }, { expectedRev: store.read().rev, reason, actor });
    return result.ok ? ok({ install: result.mutatorValue, deduplicated: false }) : result;
  }

  /** Capability matrix consumed by task preflight (T07/T09). */
  function capabilitiesOfInstall(id) {
    const store = getStore();
    const install = store.get('cliInstall', id);
    if (!install) return fail('V32_NOT_FOUND', { kind: 'cliInstall', id });
    const caps = install.capabilities ?? capabilitiesOf();
    const session = Array.isArray(caps.session) ? caps.session : [];
    const lower = session.map((item) => String(item).toLowerCase());
    const has = (name) => {
      if (caps.acp !== true) return UNKNOWN;
      return lower.includes(name);
    };
    return ok({
      id: install.id,
      name: install.name,
      version: install.version,
      adapter: install.adapter,
      protocol: install.protocol,
      acp: caps.acp === null || caps.acp === undefined ? UNKNOWN : caps.acp,
      declared: caps.items ?? [],
      session,
      matrix: {
        acp: caps.acp === null || caps.acp === undefined ? UNKNOWN : caps.acp,
        sessionClose: has('close'),
        sessionList: has('list'),
        sessionResume: has('resume'),
        sessionLoad: has('loadsession') || has('load') || has('load_session'),
        resumable: install.resumableStatus === CLI_RESUME.UNKNOWN ? UNKNOWN : install.resumable,
        health: install.health,
        usable: install.health === CLI_HEALTH.HEALTHY,
        auth: install.auth,
        authenticated: install.auth === CLI_AUTH.AUTHENTICATED || install.auth === CLI_AUTH.NOT_REQUIRED
          ? true : (install.auth === CLI_AUTH.UNKNOWN ? UNKNOWN : false)
      },
      health: install.health,
      auth: install.auth,
      resumable: install.resumable,
      resumableStatus: install.resumableStatus,
      unknownFields: install.unknownFields ?? {}
    });
  }

  return {
    list,
    scanStatus,
    scan,
    checkHealth,
    addManual,
    capabilitiesOf: capabilitiesOfInstall,
    getStore,
    get statusEnum() { return statusEnum; },
    get npmRootFn() { return npmRootFn; }
  };
}

const CLI_HEALTH_VALUES = Object.freeze(Object.values(CLI_HEALTH));
const CLI_AUTH_VALUES = Object.freeze(Object.values(CLI_AUTH));
