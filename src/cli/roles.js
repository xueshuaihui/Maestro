/**
 * `orch role list|show|validate` (split doc 2.9).
 *
 * Discipline:
 * 1. No Chinese literal in this file (AC-43). Every sentence comes from
 *    `labels.js`; registry failures are assembled from `REGISTRY_ERROR[code]` +
 *    `params`, with `YAML_PARSE_FAILED`'s `{detail}` coming from `YAML_DETAIL`.
 * 2. The registry module never says which *value* a template placeholder takes, and
 *    this module never re-derives a verdict: it only projects and prints.
 * 3. `render.js` does the line formatting; this file decides what to print and the
 *    exit code. No file is written, no `state.json` is read directly (D-1).
 * 4. A command without `--instance` never calls `ctx.createClient` (AC-38 / BR-24).
 */

import { loadRegistry } from '../registry/index.js';
import { buildRoleInstances } from '../registry/role-instances.js';
import { GROUPS } from '../registry/role-schema.js';
import { getGraph } from '../templates/index.js';
import * as render from './render.js';
import { GROUP_LABEL, REGISTRY_ERROR, ROLE_CLI_TEXT, YAML_DETAIL } from './labels.js';

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

/**
 * One registry error -> its human detail (A-5). `YAML_PARSE_FAILED` needs the nested
 * detail phrase first, because its template has both `{line}` and `{detail}`.
 *
 * @param {{code:string, params?:object, line?:number|null}} err
 * @returns {string}
 */
export function detailOf(err) {
  const template = REGISTRY_ERROR[err?.code] ?? '';
  const params = { ...(err?.params ?? {}) };
  if (err?.code === 'YAML_PARSE_FAILED') {
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

/** Text slots for `ROLE_CLI_TEXT.listRow`. */
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

function validateRoles({ registry, format, out }) {
  const counts = registry.counts;
  const rows = registry.errors.map((err) => ({
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
          errors: registry.errors.map((err) => ({
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

  // The only usage error judged here. The other five live in `parseArgs`, so that a
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
  return validateRoles({ registry, format, out });
}
