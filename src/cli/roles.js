/**
 * `orch role list|show|validate|create|edit|export|import|diff` (split doc 2.9).
 *
 * Discipline:
 * 1. No Chinese literal in this file (AC-43 / C-14). Every sentence comes from
 *    `labels.js`; registry / contract failures are assembled from
 *    `REGISTRY_ERROR[code]` + `ROLE_REASON_TEXT[code]` (+ `ROLE_PERMISSION_TEXT`
 *    for the three fixed mismatch sentences), with `YAML_PARSE_FAILED`'s
 *    `{detail}` coming from `YAML_DETAIL`.
 * 2. The registry / contract modules never say which *value* a template
 *    placeholder takes, and this module never re-derives a verdict for loaded
 *    assets: it only projects and prints. Write commands validate the candidate
 *    through the same pipeline as `role validate` (`checkRoleShape` + skill
 *    resolution + `checkRoleContracts`, D-4) - never a second judgement.
 * 3. `render.js` does the line formatting; this file decides what to print and
 *    the exit code. Only write commands touch the disk, and only through
 *    `asset-write.js`'s `atomicWrite` (C-02 / C-04); `state.json` is never read
 *    directly (D-1).
 * 4. A command without `--instance` never calls `ctx.createClient` (AC-38 / BR-24);
 *    write commands never connect to the core either (BR-30).
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadRegistry } from '../registry/index.js';
import { buildRoleInstances } from '../registry/role-instances.js';
import { assetsRoot } from '../registry/assets.js';
import { checkRoleContracts } from '../registry/contracts.js';
import { loadWorkflows } from '../registry/workflows.js';
import { parseYaml } from '../registry/yaml-lite.js';
import { serializeRole, atomicWrite } from '../registry/asset-write.js';
import {
  CONCURRENCY_MAX,
  CONCURRENCY_MIN,
  GROUPS,
  ROLE_SCHEMA_VERSION,
  checkRoleShape
} from '../registry/role-schema.js';
import { GRAPHS, getGraph } from '../templates/index.js';
import * as render from './render.js';
import {
  DERIVED_NAME_TEMPLATE,
  GROUP_LABEL,
  REGISTRY_ERROR,
  ROLE_CLI_TEXT,
  ROLE_PERMISSION_TEXT,
  ROLE_REASON_TEXT,
  ROLE_WRITE_SUPPLEMENT,
  ROLE_WRITE_TEXT,
  YAML_DETAIL
} from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;
const EXIT_PREFLIGHT = 3;

const INSTANCE_TIMEOUT_MS = 5000;

/**
 * Kept local instead of importing `main.js`'s `exitCodeFor`: `main.js` imports this
 * module, and a back-import would create a cycle. The set mirrors `PREFLIGHT_CODES`
 * (the "failed before start" class, exit 3).
 */
const PREFLIGHT_CODES = new Set([
  'DSH_SPAWN_FAILED',
  'CWD_NOT_WRITABLE',
  'CORE_START_FAILED',
  'WORKSPACE_INIT_FAILED',
  'REGISTRY_INVALID'
]);

function exitCodeFor(code) {
  return PREFLIGHT_CODES.has(code) ? EXIT_PREFLIGHT : EXIT_FAILED;
}

/** `{name}` substitution. An absent value becomes an empty string, never `undefined`. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Human sentence for one machine detail key (`YAML_DETAIL`, five entries). */
function yamlDetail(params) {
  const template = YAML_DETAIL[params?.detailKey] ?? '';
  return fill(template, params?.detailParams ?? {});
}

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** The `{side}` slot of `ROLE_CONTRACT_UNBOUND` (source / destination -> Chinese). */
const CONTRACT_SIDE = ROLE_WRITE_SUPPLEMENT.contractSide;

/**
 * One error -> its human detail (A-5 / A-15). `YAML_PARSE_FAILED` needs the nested
 * detail phrase first, because its template has both `{line}` and `{detail}`.
 * The seven I1.6 role reason codes resolve through `ROLE_REASON_TEXT`; the three
 * permission sentences arrive pre-selected by `contracts.js` via the English
 * `params.reason` key and render through `ROLE_PERMISSION_TEXT`.
 *
 * @param {{code:string, params?:object, line?:number|null}} err
 * @returns {string}
 */
export function detailOf(err) {
  const code = err?.code;
  if (typeof ROLE_REASON_TEXT[code] === 'string') {
    const params = { ...(err?.params ?? {}) };
    if (code === 'ROLE_PERMISSION_MISMATCH') {
      params.reason = fill(ROLE_PERMISSION_TEXT[params.reason] ?? '', { tool: params.tool });
    } else if (code === 'ROLE_DERIVE_CYCLE') {
      const chain = Array.isArray(params.chain) ? params.chain : [];
      const open =
        chain.length > 1 && chain[0] === chain[chain.length - 1] ? chain.slice(0, -1) : chain;
      params.chain = open.join(' → ');
    } else if (code === 'ROLE_CONTRACT_UNBOUND') {
      params.side = CONTRACT_SIDE[params.side] ?? '';
    }
    return fill(ROLE_REASON_TEXT[code], params);
  }
  const template = REGISTRY_ERROR[code] ?? '';
  const params = { ...(err?.params ?? {}) };
  if (code === 'YAML_PARSE_FAILED') {
    params.detail = yamlDetail(params);
    if (params.line === undefined || params.line === null) params.line = err?.line ?? null;
  }
  return fill(template, params);
}

/**
 * `<relative path>：<detail>（<code>）` — the A-4 row without its `- ` prefix.
 * Used by `role validate` rows and by `orch run`'s registry-invalid line, so the
 * "first detail" wording is assembled in exactly one place (A-5).
 *
 * @param {Array<object>} errors
 * @returns {string|null}
 */
export function firstRegistryDetail(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return `${errors[0].file}：${detailOf(errors[0])}（${errors[0].code}）`;
}

/** A-6's ten-key role object. The `.orch/` prefix is added here only (A-3 / A-6). */
function toRoleJson(role) {
  return {
    id: role.id,
    name: role.name,
    group: role.group,
    groupLabel: GROUP_LABEL[role.group] ?? role.group,
    artifactType: role.artifactType,
    sideEffect: role.sideEffect,
    skills: role.skills.slice(),
    maxConcurrentSessions: role.maxConcurrentSessions,
    source: role.source,
    file: role.source === 'project' ? `.orch/${role.file}` : role.file
  };
}

// ---------------------------------------------------------------- asset access

function repoRoot() {
  return path.dirname(assetsRoot());
}

function roleFileAbs(role, cwd) {
  return role.source === 'project'
    ? path.join(cwd, '.orch', role.file)
    : path.join(repoRoot(), role.file);
}

function readTextFile(abs) {
  try {
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function parseRoleText(text) {
  const parsed = parseYaml(text);
  if (!parsed.ok) return null;
  const value = parsed.value;
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : null;
}

/**
 * The full snake_case asset object of one registry entry, re-read from its file so
 * the optional keys the loader definitions drop (`inputs` / `outputs` /
 * `derived_from`) reach `checkRoleContracts` (D-4 pass-through). Falls back to the
 * loader definition when the file cannot be re-read.
 */
function assetObjectOf(entry, cwd) {
  const text = readTextFile(roleFileAbs(entry, cwd));
  if (text !== null) {
    const parsed = parseRoleText(text);
    if (parsed !== null) return parsed;
  }
  return {
    schema: ROLE_SCHEMA_VERSION,
    id: entry.id,
    name: entry.name,
    group: entry.group,
    summary: entry.summary ?? '',
    artifact_type: entry.artifactType,
    side_effect: entry.sideEffect,
    skills: entry.skills ?? [],
    tools: entry.tools ?? [],
    wake_allow: entry.wakeAllow ?? [],
    max_concurrent_sessions: entry.maxConcurrentSessions
  };
}

/** Registry roles as full asset objects (source / file markers preserved). */
function rolesWithAssetKeys(registry, cwd) {
  return registry.roles.map((role) => ({
    ...assetObjectOf(role, cwd),
    source: role.source,
    file: role.file
  }));
}

/**
 * The workflow collection contract binding is judged against (WP-3, R-4).
 *
 * Deliberately loaded WITHOUT `roles`: passing them would run workflow validate's
 * own wake-permission step (⑬) inside the loader, and a workflow that fails it is
 * excluded from `workflowMap` — which would silently drop the contract binding for
 * exactly the roles AC-11 / AC-12 need judged. Role validate only consumes the
 * graph structure (§2.5: a workflow's own verdicts belong to `orch workflow
 * validate`), so the role-dependent loader checks stay out of this call.
 */
function loadContractWorkflows(cwd) {
  return loadWorkflows({ root: cwd, builtinGraphs: GRAPHS });
}

// ---------------------------------------------------------------- text slots

/** Text slots for `ROLE_CLI_TEXT.listRow`, from a snake_case asset object. */
function contractLineOf(role) {
  return fill(ROLE_CLI_TEXT.listRow, {
    id: role.id,
    name: role.name,
    groupLabel: GROUP_LABEL[role.group] ?? role.group,
    artifactType: role.artifact_type,
    sideEffect: role.side_effect,
    skillCount: Array.isArray(role.skills) ? role.skills.length : 0,
    max: role.max_concurrent_sessions
  });
}

/** Text slots for `ROLE_CLI_TEXT.listRow`, from a loader definition (camelCase). */
function rowOf(roleJson) {
  return {
    id: roleJson.id,
    name: roleJson.name,
    groupLabel: roleJson.groupLabel,
    artifactType: roleJson.artifactType,
    sideEffect: roleJson.sideEffect,
    skillCount: roleJson.skills.length,
    max: roleJson.maxConcurrentSessions
  };
}

/**
 * A-6's four-key counts: **role level**, `total` = visible rows. The registry's own
 * table is asset level (`builtin` is 26 there, 16 here), so the two must never be
 * swapped — the header is a byte-for-byte assertion (A-2).
 */
function listCounts(rows, registry) {
  return {
    total: rows.length,
    builtin: rows.filter((role) => role.source === 'builtin').length,
    project: rows.filter((role) => role.source === 'project').length,
    invalid: registry.counts.invalid
  };
}

/**
 * Five entries in `GROUPS` order when unfiltered; exactly the selected group when
 * `--group` is used (AC-32 wants `groups.length === 1`).
 */
function groupsFor(rows, group) {
  const list = group === null ? GROUPS : [group];
  return list.map((name) => ({
    group: name,
    label: GROUP_LABEL[name] ?? name,
    count: rows.filter((role) => role.group === name).length
  }));
}

function instanceIdOf(snapshot, fallback) {
  return typeof snapshot?.instanceId === 'string' ? snapshot.instanceId : fallback;
}

/**
 * Read one snapshot through the core. The client is closed in `finally`: a read-only
 * `role` command must not leave a resident connection behind (NFR-07).
 *
 * @returns {Promise<{ok:true, snapshot:object} | {ok:false, message:string, code:number}>}
 */
async function loadInstance(instanceId, ctx) {
  const client = ctx.createClient(ctx.cwd);
  try {
    const connected = await client.connect({ ensure: true });
    if (!connected.ok) {
      return {
        ok: false,
        message: render.renderError({ code: connected.code, params: connected.params }),
        code: exitCodeFor(connected.code)
      };
    }
    const res = await client.request('instance.get', { instanceId }, { timeoutMs: INSTANCE_TIMEOUT_MS });
    if (!res.ok) {
      if (res.code === 'NOT_FOUND') {
        return {
          ok: false,
          message: fill(ROLE_CLI_TEXT.notFoundInstance, { id: instanceId }),
          code: EXIT_FAILED
        };
      }
      return {
        ok: false,
        message: render.renderError({ code: res.code, params: res.params ?? {} }),
        code: exitCodeFor(res.code)
      };
    }
    return { ok: true, snapshot: res.result ?? null };
  } finally {
    await client.close?.();
  }
}

function projectInstance({ snapshot, fallbackId, registry }) {
  const built = buildRoleInstances({
    state: snapshot,
    graph: getGraph(snapshot?.template),
    roles: registry.roleMap
  });
  return {
    instanceId: instanceIdOf(snapshot, fallbackId),
    roles: built.roles,
    roleToSessions: built.roleToSessions,
    template: snapshot?.template ?? null,
    state: snapshot?.state ?? null
  };
}

/** `derived_from` of a project role (BR-32: one extra `role show` line, text only). */
function derivedFromOf(role, cwd) {
  if (role.source !== 'project') return null;
  const parsed = parseRoleText(readTextFile(roleFileAbs(role, cwd)) ?? '');
  const from = parsed?.derived_from;
  return typeof from === 'string' && from.length > 0 ? from : null;
}

// ---------------------------------------------------------------- subcommands

async function listRoles({ registry, flags, format, ctx, out }) {
  const group = typeof flags.group === 'string' ? flags.group : null;
  const rows = group === null ? registry.roles : registry.roles.filter((role) => role.group === group);
  const counts = listCounts(rows, registry);
  const groups = groupsFor(rows, group);
  const roleJsonList = rows.map(toRoleJson);

  let instance = null;
  if (typeof flags.instance === 'string') {
    const loaded = await loadInstance(flags.instance, ctx);
    if (!loaded.ok) {
      out(loaded.message);
      return loaded.code;
    }
    instance = projectInstance({
      snapshot: loaded.snapshot,
      fallbackId: flags.instance,
      registry
    });
  }

  if (format === 'json') {
    const payload = { counts, groups, roles: roleJsonList };
    if (instance !== null) {
      payload.instance = {
        instanceId: instance.instanceId,
        template: instance.template,
        state: instance.state,
        roles: instance.roles,
        roleToSessions: instance.roleToSessions
      };
    }
    out(JSON.stringify(payload, null, 2));
  } else {
    for (const line of render.renderRoleList({ counts, groups, rows: roleJsonList.map(rowOf) })) {
      out(line);
    }
    if (instance !== null) {
      const visible = new Set(roleJsonList.map((role) => role.id));
      for (const view of instance.roles) {
        // D-5: a graph-declared role whose asset is missing must still be visible in
        // the unfiltered text list, with its unknown-role note. Without this branch
        // the note is unreachable: `show` refuses unregistered ids up front.
        const extra = group === null && view.statusReason === 'unknown-role';
        if (!visible.has(view.roleId) && !extra) continue;
        out(render.renderRoleInstanceLine({ instanceId: instance.instanceId, view }));
      }
    }
  }

  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

async function showRole({ registry, flags, format, ctx, out, roleId }) {
  const role = registry.roleMap.get(roleId);
  if (!role) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id: roleId }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }

  const roleJson = toRoleJson(role);
  // The contract line is rendered from the same template as `role list`, so the two
  // are byte-identical (A-3).
  const baseLines = render.renderRoleShow({
    roleRow: fill(ROLE_CLI_TEXT.listRow, rowOf(roleJson)),
    duty: role.summary,
    skills: role.skills,
    tools: role.tools,
    wake: role.wakeAllow,
    source: { kind: role.source, file: roleJson.file }
  });

  let instance = null;
  let view = null;
  let failure = null;

  if (typeof flags.instance === 'string') {
    const loaded = await loadInstance(flags.instance, ctx);
    if (!loaded.ok) {
      failure = loaded;
    } else {
      instance = projectInstance({
        snapshot: loaded.snapshot,
        fallbackId: flags.instance,
        registry
      });
      view = instance.roles.find((item) => item.roleId === roleId) ?? null;
    }
  }

  if (format === 'json') {
    // A-6: three keys; `instance` / `roleInstance` stay `null` when `--instance` is absent.
    if (failure !== null) {
      out(failure.message);
      return failure.code;
    }
    const payload = { role: roleJson, instance: null, roleInstance: view };
    if (instance !== null) {
      payload.instance = {
        instanceId: instance.instanceId,
        template: instance.template,
        state: instance.state,
        roleToSessions: instance.roleToSessions
      };
    }
    out(JSON.stringify(payload, null, 2));
    return EXIT_OK;
  }

  for (const line of baseLines) out(line);
  // BR-32: a derived project role adds one line after the source line (AC-04);
  // built-in roles never carry `derived_from`, so their six lines stay byte-identical.
  const derivedFrom = derivedFromOf(role, ctx.cwd);
  if (derivedFrom !== null) {
    out(fill(ROLE_WRITE_SUPPLEMENT.showDerived, { from: derivedFrom }));
  }
  // A-5: the role contract is printed first, then the instance verdict (AC-39).
  if (failure !== null) {
    out(failure.message);
    return failure.code;
  }
  if (typeof flags.instance === 'string') {
    out(
      view === null
        ? render.renderRoleInstanceUnused(flags.instance)
        : render.renderRoleInstanceLine({ instanceId: instance.instanceId, view })
    );
  }
  return EXIT_OK;
}

/**
 * AC-11 counters, recomputed as the union of the loader's own errors and the
 * contract issues (WP-2 / WP-3 wiring; `loadRegistry` itself stays untouched, M-3):
 * `invalid` = number of distinct files holding either kind of error, `roles` =
 * loader-valid roles whose file holds no error at all, `skills` / `builtin` /
 * `project` straight from the loader, `assets = roles + skills + invalid`.
 * Workflows joined the contract judgement but never enter the counts (R-4).
 */
function validateRoles({ registry, fullRegistry, onlyRole, format, out, ctx }) {
  const contractRegistry = fullRegistry ?? registry;
  const workflows = loadContractWorkflows(ctx.cwd);
  const issues = checkRoleContracts({
    roles: rolesWithAssetKeys(contractRegistry, ctx.cwd),
    workflows: workflows.workflowMap
  });
  // Single-role mode judges the whole universe but reports only that one file
  // (its wake whitelist needs the full id set, AC-36).
  const candidateFile =
    onlyRole !== null
      ? registry.roles[0]?.file ?? registry.errors[0]?.file ?? null
      : null;
  const scopedIssues =
    candidateFile === null ? issues : issues.filter((issue) => issue.file === candidateFile);

  const allErrors = [...registry.errors, ...scopedIssues];
  allErrors.sort((a, b) => compareText(a.file, b.file));
  const errorFiles = new Set(allErrors.map((err) => err.file));
  const validRoles = registry.roles.filter((role) => !errorFiles.has(role.file)).length;
  const counts = {
    assets: validRoles + registry.counts.skills + errorFiles.size,
    roles: validRoles,
    skills: registry.counts.skills,
    builtin: registry.counts.builtin,
    project: registry.counts.project,
    invalid: errorFiles.size
  };
  const rows = allErrors.map((err) => ({
    file: err.file,
    detail: detailOf(err),
    code: err.code
  }));

  if (format === 'json') {
    // A-7: six keys per error, `params` replaced (not appended) by `detail`.
    out(
      JSON.stringify(
        {
          counts,
          errors: allErrors.map((err) => ({
            code: err.code,
            file: err.file,
            scope: err.scope,
            field: err.field,
            line: err.line,
            detail: detailOf(err)
          }))
        },
        null,
        2
      )
    );
  } else {
    for (const line of render.renderRoleValidate({ counts, rows })) out(line);
  }

  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

// ---------------------------------------------------------------- write commands

/** D-4: fields a `--from` derive inherits (`id` / `derived_from` never inherit). */
const DERIVE_INHERIT_KEYS = Object.freeze([
  'name',
  'summary',
  'group',
  'artifact_type',
  'side_effect',
  'skills',
  'tools',
  'wake_allow',
  'inputs',
  'outputs',
  'dispatchable',
  'max_concurrent_sessions'
]);

const EDITABLE_KEYS = Object.freeze([
  'name',
  'summary',
  'group',
  'artifact_type',
  'side_effect',
  'derived_from',
  'skills',
  'tools',
  'wake_allow',
  'inputs',
  'outputs',
  'dispatchable',
  'max_concurrent_sessions'
]);

/** `--unset` on these is a usage error (AC-56). */
const PROTECTED_KEYS = Object.freeze(['schema', 'id', 'name', 'group', 'artifact_type', 'side_effect']);

const ARRAY_VALUE_KEYS = new Set(['skills', 'tools', 'wake_allow', 'inputs', 'outputs']);

function splitList(raw) {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function convertSetValue(key, raw) {
  if (ARRAY_VALUE_KEYS.has(key)) return splitList(raw);
  if (key === 'dispatchable') return raw === 'true' ? true : raw === 'false' ? false : raw;
  if (key === 'max_concurrent_sessions' && /^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function cloneValue(value) {
  return Array.isArray(value) ? value.slice() : value;
}

function isConcurrencyValue(raw) {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return false;
  const value = Number(raw);
  return Number.isInteger(value) && value >= CONCURRENCY_MIN && value <= CONCURRENCY_MAX;
}

/**
 * The shared write-command judgement (D-4): `checkRoleShape` + skill resolution +
 * `checkRoleContracts`, in C-08 order, deduped to one issue per reason code. The
 * candidate joins the full role universe for wake-whitelist resolution; only the
 * candidate file's issues gate the write.
 */
function candidateIssues({ candidate, fileId, registry, cwd, workflows }) {
  const file = `roles/${fileId}.yaml`;
  const issues = [];
  for (const issue of checkRoleShape(candidate, { fileId })) {
    issues.push({
      code: issue.code,
      file,
      scope: 'role',
      field: issue.field,
      line: null,
      params: issue.params ?? {}
    });
  }
  const skills = Array.isArray(candidate.skills) ? candidate.skills : [];
  for (const skillId of skills) {
    if (!registry.skillMap.has(skillId)) {
      issues.push({
        code: 'ROLE_SKILL_NOT_FOUND',
        file,
        scope: 'role',
        field: 'skills',
        line: null,
        params: { skill: skillId }
      });
      break;
    }
  }
  const universe = rolesWithAssetKeys(registry, cwd).filter((role) => role.id !== candidate.id);
  universe.push({ ...candidate, file });
  const contract = checkRoleContracts({ roles: universe, workflows });
  issues.push(...contract.filter((issue) => issue.file === file));
  const seen = new Set();
  return issues.filter((issue) => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  });
}

function writeFailure(out, code) {
  out(render.renderError({ code: 'UNKNOWN_ERROR', params: { raw: code } }));
  return EXIT_FAILED;
}

async function createRole({ parsed, flags, ctx, out, registry, workflows }) {
  const id = parsed.positional;
  const rawMax = flags['max-concurrent'];
  if (rawMax !== undefined && !isConcurrencyValue(rawMax)) {
    out(render.renderUsage(fill(REGISTRY_ERROR.ROLE_MAX_CONCURRENT_INVALID, { value: rawMax })));
    return EXIT_USAGE;
  }

  const builtinEntry = registry.roleMap.get(id);
  if (builtinEntry !== undefined && builtinEntry.source === 'builtin') {
    out(
      fill(ROLE_WRITE_TEXT.createRejected, {
        detail: fill(ROLE_WRITE_SUPPLEMENT.builtinReadonly, { id }),
        code: 'ASSET_READONLY'
      })
    );
    return EXIT_FAILED;
  }

  const targetAbs = path.join(ctx.cwd, '.orch', 'roles', `${id}.yaml`);
  if (flags.force !== true && fs.existsSync(targetAbs)) {
    out(fill(ROLE_WRITE_TEXT.exists, { file: `.orch/roles/${id}.yaml` }));
    return EXIT_FAILED;
  }

  let role;
  if (typeof flags.from === 'string') {
    const sourceEntry = registry.roleMap.get(flags.from);
    if (sourceEntry === undefined) {
      out(
        fill(ROLE_WRITE_TEXT.createRejected, {
          detail: fill(ROLE_REASON_TEXT.ROLE_DERIVE_MISSING, { role: flags.from }),
          code: 'ROLE_DERIVE_MISSING'
        })
      );
      return EXIT_FAILED;
    }
    const source = assetObjectOf(sourceEntry, ctx.cwd);
    role = { schema: ROLE_SCHEMA_VERSION, id };
    for (const key of DERIVE_INHERIT_KEYS) {
      if (source[key] !== undefined) role[key] = cloneValue(source[key]);
    }
    role.derived_from = flags.from;
    // BR-38: inherit fills `name` from the source, so the default applies when
    // the user passed no `--name`, not when the inherited field is missing.
    if (flags.name === undefined) {
      role.name = fill(DERIVED_NAME_TEMPLATE, { base: source.name ?? sourceEntry.name ?? '' });
    }
  } else {
    role = {
      schema: ROLE_SCHEMA_VERSION,
      id,
      name: flags.name,
      group: flags.group,
      summary: flags.summary ?? '',
      artifact_type: flags['artifact-type'],
      side_effect: flags['side-effect'],
      skills: splitList(flags.skills),
      max_concurrent_sessions: rawMax !== undefined ? Number(rawMax) : 1
    };
  }

  if (flags.name !== undefined) role.name = flags.name;
  if (flags.summary !== undefined) role.summary = flags.summary;
  if (flags.group !== undefined) role.group = flags.group;
  if (flags['artifact-type'] !== undefined) role.artifact_type = flags['artifact-type'];
  if (flags['side-effect'] !== undefined) role.side_effect = flags['side-effect'];
  if (flags.skills !== undefined) role.skills = splitList(flags.skills);
  if (flags.tools !== undefined) role.tools = splitList(flags.tools);
  if (flags['wake-allow'] !== undefined) role.wake_allow = splitList(flags['wake-allow']);
  if (rawMax !== undefined) role.max_concurrent_sessions = Number(rawMax);

  const issues = candidateIssues({ candidate: role, fileId: id, registry, cwd: ctx.cwd, workflows });
  if (issues.length > 0) {
    out(fill(ROLE_WRITE_TEXT.createRejected, { detail: detailOf(issues[0]), code: issues[0].code }));
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target: targetAbs, text: serializeRole(role) });
  if (!written.ok) return writeFailure(out, written.code);
  out(fill(ROLE_WRITE_TEXT.created, { file: `.orch/roles/${id}.yaml` }));
  out(contractLineOf(role));
  out(ROLE_WRITE_TEXT.checkPassed);
  return EXIT_OK;
}

async function editRole({ parsed, flags, ctx, out, registry, workflows }) {
  const id = parsed.positional;
  const entry = registry.roleMap.get(id);
  if (entry === undefined) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }
  if (entry.source === 'builtin') {
    out(fill(ROLE_WRITE_TEXT.builtinEditReadonly, { id }));
    return EXIT_FAILED;
  }

  const sets = Array.isArray(flags.set) ? flags.set : [];
  const unsets = Array.isArray(flags.unset) ? flags.unset : [];

  for (const item of sets) {
    const eq = typeof item === 'string' ? item.indexOf('=') : -1;
    const key = eq >= 0 ? item.slice(0, eq) : item;
    if (!EDITABLE_KEYS.includes(key)) {
      out(render.renderUsage(fill(ROLE_WRITE_SUPPLEMENT.unknownField, { key })));
      return EXIT_USAGE;
    }
  }
  for (const key of unsets) {
    if (PROTECTED_KEYS.includes(key)) {
      out(render.renderUsage(fill(ROLE_WRITE_SUPPLEMENT.unsetRequired, { key })));
      return EXIT_USAGE;
    }
    if (!EDITABLE_KEYS.includes(key)) {
      out(render.renderUsage(fill(ROLE_WRITE_SUPPLEMENT.unknownField, { key })));
      return EXIT_USAGE;
    }
  }

  const fileAbs = path.join(ctx.cwd, '.orch', 'roles', `${id}.yaml`);
  const role = parseRoleText(readTextFile(fileAbs) ?? '');
  if (role === null) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }
  // A file may lack `summary` (an earlier rewrite dropped the empty line); the
  // in-memory object always carries the default so validation stays possible.
  if (role.summary === undefined) role.summary = '';

  for (const item of sets) {
    const eq = typeof item === 'string' ? item.indexOf('=') : -1;
    const key = eq >= 0 ? item.slice(0, eq) : item;
    const value = eq >= 0 ? item.slice(eq + 1) : '';
    role[key] = convertSetValue(key, value);
  }
  for (const key of unsets) {
    if (key === 'summary') role.summary = '';
    else if (ARRAY_VALUE_KEYS.has(key)) role[key] = [];
    else if (key === 'derived_from') delete role.derived_from;
    else if (key === 'dispatchable') role.dispatchable = true;
    else if (key === 'max_concurrent_sessions') role.max_concurrent_sessions = 1;
  }

  const issues = candidateIssues({ candidate: role, fileId: id, registry, cwd: ctx.cwd, workflows });
  if (issues.length > 0) {
    out(fill(ROLE_WRITE_TEXT.editRejected, { detail: detailOf(issues[0]), code: issues[0].code }));
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target: fileAbs, text: serializeRole(role) });
  if (!written.ok) return writeFailure(out, written.code);
  out(fill(ROLE_WRITE_TEXT.updated, { file: `.orch/${entry.file}` }));
  out(contractLineOf(role));
  out(ROLE_WRITE_TEXT.checkPassed);
  out(ROLE_WRITE_TEXT.rewrittenNote);
  return EXIT_OK;
}

async function exportRole({ parsed, flags, ctx, out, registry }) {
  const id = parsed.positional;
  const entry = registry.roleMap.get(id);
  if (entry === undefined) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }
  const text = serializeRole(assetObjectOf(entry, ctx.cwd));
  const outPath = typeof flags.out === 'string' ? flags.out : null;
  if (outPath === null) {
    out(text.endsWith('\n') ? text.slice(0, -1) : text);
    return EXIT_OK;
  }
  // A relative `--out` lands inside the project root (the command's cwd), not the
  // launcher's process.cwd() — AC-07 exports into `exports/` of the project.
  const written = await atomicWrite({ target: path.resolve(ctx.cwd, outPath), text });
  if (!written.ok) return writeFailure(out, written.code);
  out(fill(ROLE_WRITE_TEXT.exported, { id, file: outPath }));
  return EXIT_OK;
}

async function importRole({ parsed, flags, ctx, out, registry, workflows }) {
  const fileArg = parsed.positional;
  const text = readTextFile(path.resolve(ctx.cwd, fileArg));
  if (text === null) {
    out(fill(ROLE_WRITE_TEXT.importFileMissing, { file: fileArg }));
    return EXIT_FAILED;
  }

  const parsedYaml = parseYaml(text);
  const value = parsedYaml.ok ? parsedYaml.value : null;
  if (
    !parsedYaml.ok ||
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    const err = parsedYaml.ok
      ? {
          code: 'ROLE_SCHEMA_MISSING',
          file: fileArg,
          scope: 'role',
          field: null,
          line: null,
          params: { field: 'schema' }
        }
      : {
          code: 'YAML_PARSE_FAILED',
          file: fileArg,
          scope: 'role',
          field: null,
          line: parsedYaml.line,
          params: {
            line: parsedYaml.line,
            detailKey: parsedYaml.detailKey,
            detailParams: parsedYaml.detailParams ?? {}
          }
        };
    out(fill(ROLE_WRITE_TEXT.importRejected, { detail: detailOf(err), code: err.code }));
    return EXIT_FAILED;
  }

  const role = { ...value };
  // AC-55: a file that does not declare `schema: role/v1` is not a role at all.
  // `checkRoleShape` would report the wrong-schema mismatch only after the
  // required-key gaps (WP-1 order), so this short-circuit pins the AC's
  // schema-missing wording for both the key-less and the workflow/v1 file.
  if (role.schema !== ROLE_SCHEMA_VERSION) {
    out(
      fill(ROLE_WRITE_TEXT.importRejected, {
        detail: fill(REGISTRY_ERROR.ROLE_SCHEMA_MISSING, { field: 'schema' }),
        code: 'ROLE_SCHEMA_MISSING'
      })
    );
    return EXIT_FAILED;
  }
  const id = typeof role.id === 'string' ? role.id : '';
  const issues = candidateIssues({
    candidate: role,
    fileId: id !== '' ? id : undefined,
    registry,
    cwd: ctx.cwd,
    workflows
  });
  if (issues.length > 0) {
    out(fill(ROLE_WRITE_TEXT.importRejected, { detail: detailOf(issues[0]), code: issues[0].code }));
    return EXIT_FAILED;
  }

  const builtinEntry = registry.roleMap.get(role.id);
  if (builtinEntry !== undefined && builtinEntry.source === 'builtin') {
    out(
      fill(ROLE_WRITE_TEXT.importRejected, {
        detail: fill(ROLE_WRITE_SUPPLEMENT.builtinReadonly, { id: role.id }),
        code: 'ASSET_READONLY'
      })
    );
    return EXIT_FAILED;
  }

  const targetAbs = path.join(ctx.cwd, '.orch', 'roles', `${role.id}.yaml`);
  if (flags.force !== true && fs.existsSync(targetAbs)) {
    out(fill(ROLE_WRITE_TEXT.exists, { file: `.orch/roles/${role.id}.yaml` }));
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target: targetAbs, text: serializeRole(role) });
  if (!written.ok) return writeFailure(out, written.code);
  out(fill(ROLE_WRITE_TEXT.installed, { file: `.orch/roles/${role.id}.yaml` }));
  out(ROLE_WRITE_TEXT.checkPassed);
  return EXIT_OK;
}

// ---------------------------------------------------------------- role diff

/**
 * The role diff key set: everything except `id` (BR-11: the identity key is ignored,
 * `name` and all other keys compare; the workflow diff semantics never mix in, F-02).
 */
const ROLE_DIFF_KEYS = Object.freeze([
  'schema',
  'name',
  'group',
  'summary',
  'artifact_type',
  'side_effect',
  'derived_from',
  'skills',
  'tools',
  'wake_allow',
  'inputs',
  'outputs',
  'dispatchable',
  'max_concurrent_sessions'
]);

/** Missing keys join at their default: empty string / array compare as "absent". */
function diffSlot(obj, key) {
  const has = obj !== null && Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined;
  const raw = has ? obj[key] : null;
  if (raw === null || raw === '') {
    return key === 'dispatchable' ? true : key === 'max_concurrent_sessions' ? 1 : null;
  }
  if (Array.isArray(raw)) return raw.length === 0 ? null : raw.slice();
  return raw;
}

function sameDiffValue(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function roleDiffChanges(baseObj, targetObj) {
  const added = [];
  const removed = [];
  const changed = [];
  for (const key of ROLE_DIFF_KEYS) {
    const base = diffSlot(baseObj, key);
    const target = diffSlot(targetObj, key);
    if (sameDiffValue(base, target)) continue;
    const change = {
      field: key,
      kind:
        base === null && target !== null
          ? 'added'
          : target === null && base !== null
            ? 'removed'
            : 'changed',
      base,
      target
    };
    if (change.kind === 'added') added.push(change);
    else if (change.kind === 'removed') removed.push(change);
    else changed.push(change);
  }
  // A-5 / §3.5 row order: additions first, then removals, then changes; each group
  // keeps the fixed key order (`+ derived_from` precedes `~ name` in AC-10).
  return [...added, ...removed, ...changed];
}

function parsedFileObject(cwd, fileArg) {
  const text = readTextFile(path.resolve(cwd, fileArg));
  if (text === null) return null;
  const parsed = parseYaml(text);
  return parsed.ok &&
    parsed.value !== null &&
    typeof parsed.value === 'object' &&
    !Array.isArray(parsed.value)
    ? { ...parsed.value }
    : null;
}

async function diffRole({ parsed, flags, format, ctx, out, registry }) {
  const id = parsed.positional;
  const entry = registry.roleMap.get(id);
  if (entry === undefined) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }
  const targetObj = assetObjectOf(entry, ctx.cwd);

  const against = typeof flags.against === 'string' ? flags.against : null;
  let baseObj = null;
  let baseLabel = null;
  let baseSource = 'builtin';
  if (against !== null) {
    const builtinBase = registry.roleMap.get(against);
    if (builtinBase !== undefined && builtinBase.source === 'builtin') {
      baseObj = assetObjectOf(builtinBase, ctx.cwd);
      baseLabel = against;
    } else {
      const fileBase = parsedFileObject(ctx.cwd, against);
      if (fileBase !== null) {
        baseObj = fileBase;
        baseLabel = against;
        baseSource = 'project';
      }
    }
    if (baseObj === null) {
      out(fill(ROLE_WRITE_TEXT.missingBaseline, { id }));
      return EXIT_FAILED;
    }
  } else {
    // Default baseline: the same-name built-in role; a derived project role falls
    // back to its `derived_from` source (AC-10 baselines the derive source).
    const sameName = registry.roleMap.get(id);
    if (sameName !== undefined && sameName.source === 'builtin') {
      baseObj = assetObjectOf(sameName, ctx.cwd);
      baseLabel = id;
    } else {
      const from = targetObj.derived_from;
      const derivedBase =
        typeof from === 'string' && from.length > 0 ? registry.roleMap.get(from) : undefined;
      if (derivedBase !== undefined) {
        baseObj = assetObjectOf(derivedBase, ctx.cwd);
        baseLabel = from;
        baseSource = derivedBase.source === 'project' ? 'project' : 'builtin';
      }
    }
    if (baseObj === null) {
      out(fill(ROLE_WRITE_TEXT.missingBaseline, { id }));
      return EXIT_FAILED;
    }
  }

  const changes = roleDiffChanges(baseObj, targetObj);
  if (format === 'json') {
    // A-14: exactly three top-level keys; the ids are the endpoints (§3.5).
    out(JSON.stringify({ base: baseLabel, target: id, changes }, null, 2));
    return EXIT_OK;
  }
  for (const line of render.renderRoleDiff({
    id,
    idSource: entry.source,
    base: baseLabel,
    baseSource,
    changes
  })) {
    out(line);
  }
  return EXIT_OK;
}

// ---------------------------------------------------------------- dispatch

/**
 * @param {{command:'role', sub:string, positional:string|null, flags:object}} parsed
 * @param {{cwd:string, out:(line:string)=>void, createClient:Function, now?:Function}} ctx
 * @returns {Promise<number>} 0 ok / 1 bad assets / 2 usage / 3 core start failure
 */
export async function roleCommand(parsed, ctx) {
  const out = ctx.out;
  const sub = parsed.sub;
  const flags = parsed.flags ?? {};
  const format = flags.format ?? 'text';

  // The only usage error judged here. The others live in `parseArgs`, so that a
  // single cause never produces two different sentences (AC-37).
  if (sub === 'list' && typeof flags.group === 'string' && !GROUPS.includes(flags.group)) {
    out(
      render.renderUsage(
        fill(ROLE_CLI_TEXT.usageReason.badGroup, { groups: GROUPS.join(' / ') })
      )
    );
    return EXIT_USAGE;
  }

  const onlyRole =
    sub === 'validate' && typeof parsed.positional === 'string' ? parsed.positional : null;
  const registry = loadRegistry({ root: ctx.cwd, onlyRole });

  // BR-25: a positional id that matches no asset means "role not found" (exit 1),
  // not "one asset validated successfully". An existing-but-invalid role always
  // produces errors, so this combination only occurs when no candidate existed.
  if (onlyRole !== null && registry.roles.length === 0 && registry.errors.length === 0) {
    out(fill(ROLE_CLI_TEXT.notFoundRole, { id: onlyRole }));
    out(ROLE_CLI_TEXT.notFoundRoleHint);
    return EXIT_FAILED;
  }

  if (sub === 'list') return listRoles({ registry, flags, format, ctx, out });
  if (sub === 'show') {
    return showRole({
      registry,
      flags,
      format,
      ctx,
      out,
      roleId: parsed.positional ?? ''
    });
  }
  if (sub === 'validate') {
    const fullRegistry = onlyRole !== null ? loadRegistry({ root: ctx.cwd }) : registry;
    return validateRoles({ registry, fullRegistry, onlyRole, format, out, ctx });
  }

  const workflows = loadContractWorkflows(ctx.cwd).workflowMap;
  if (sub === 'create') return createRole({ parsed, flags, ctx, out, registry, workflows });
  if (sub === 'edit') return editRole({ parsed, flags, ctx, out, registry, workflows });
  if (sub === 'export') return exportRole({ parsed, flags, ctx, out, registry });
  if (sub === 'import') return importRole({ parsed, flags, ctx, out, registry, workflows });
  if (sub === 'diff') return diffRole({ parsed, flags, format, ctx, out, registry });
  return validateRoles({ registry, fullRegistry: registry, onlyRole: null, format, out, ctx });
}
