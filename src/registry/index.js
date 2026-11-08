/**
 * Registry loader: scan -> merge -> validate -> sort (requirement D-3 / D-4).
 *
 * The loader is strictly read-only and never produces natural-language text.
 * Every failure is returned as `{code, file, scope, field, line, params}`; the CLI
 * layer turns it into a sentence with the `REGISTRY_ERROR` templates in
 * `src/cli/labels.js` (the registry must stay free of CJK, AC-43).
 *
 * Error order: by `file`, then by the fixed D-3 step order inside one file. The
 * generated order already is the D-3 order, so a stable sort by `file` is enough.
 */

import fs from 'node:fs';
import path from 'node:path';

import { assetsRoot } from './assets.js';
import { parseYaml } from './yaml-lite.js';
import { parseSkillFile } from './skill-file.js';
import { checkRoleShape, checkSkillMeta, GROUPS } from './role-schema.js';

const ROLE_EXT = '.yaml';
const SKILL_FILE = 'SKILL.md';

const BUILTIN = 'builtin';
const PROJECT = 'project';

function compareText(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function listEntries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function makeError(code, file, scope, field, line, params) {
  return {
    code,
    file,
    scope,
    field: field ?? null,
    line: line ?? null,
    params: params ?? {}
  };
}

/**
 * `file` is relative to the asset root of its own layer: built-in assets are
 * written as `assets/...` (root = repository root), project assets as `roles/...`
 * or `skills/...` (root = `<root>/.orch`). The `.orch/` prefix shown to users is
 * added by the CLI projection, so the same field serves A-4 and A-3 / A-6.
 * The prefix is a literal, not derived from the injected built-in root, so a test
 * fixture produces the same paths as the real tree.
 */
function roleAssetPath(source, fileName) {
  return source === PROJECT ? `roles/${fileName}` : `assets/roles/${fileName}`;
}

function skillAssetPath(source, dirId) {
  return source === PROJECT
    ? `skills/${dirId}/${SKILL_FILE}`
    : `assets/skills/${dirId}/${SKILL_FILE}`;
}

function collectRoleFiles(baseDir, source) {
  const out = [];
  for (const entry of listEntries(baseDir)) {
    if (!entry.isFile() || !entry.name.endsWith(ROLE_EXT)) continue;
    const abs = path.join(baseDir, entry.name);
    const text = readText(abs);
    if (text === null) continue;
    out.push({
      fileId: entry.name.slice(0, -ROLE_EXT.length),
      source,
      file: roleAssetPath(source, entry.name),
      text
    });
  }
  return out;
}

/**
 * Skills are discovered by enumerating the directories under `skills/`, then
 * looking for `SKILL.md` inside each one. Globbing for that file name directly
 * would silently skip a directory whose file is missing, and that directory is
 * exactly what `SKILL_FILE_MISSING` has to report (AC-13).
 */
function collectSkillDirs(baseDir, source) {
  const out = [];
  for (const entry of listEntries(baseDir)) {
    if (!entry.isDirectory()) continue;
    out.push({
      dirId: entry.name,
      source,
      file: skillAssetPath(source, entry.name),
      abs: path.join(baseDir, entry.name, SKILL_FILE)
    });
  }
  return out;
}

/** Project wins as a whole file: no field is inherited from the built-in copy. */
function mergeByKey(builtinList, projectList, key) {
  const merged = new Map();
  for (const item of builtinList) merged.set(item[key], item);
  for (const item of projectList) merged.set(item[key], item);
  return merged;
}

function validateSkill(candidate, errors) {
  const text = readText(candidate.abs);
  if (text === null) {
    errors.push(
      makeError('SKILL_FILE_MISSING', candidate.file, 'skill', null, null, { dir: candidate.dirId })
    );
    return null;
  }

  const parsed = parseSkillFile(text);
  if (!parsed.ok) {
    errors.push(
      makeError('YAML_PARSE_FAILED', candidate.file, 'skill', null, parsed.line, {
        line: parsed.line,
        detailKey: parsed.detailKey,
        detailParams: parsed.detailParams ?? {}
      })
    );
    return null;
  }

  // Steps 3..5 of D-3, in output order (required keys -> id -> applies_to).
  const issues = checkSkillMeta(parsed.meta, { dirId: candidate.dirId });
  for (const issue of issues) {
    errors.push(makeError(issue.code, candidate.file, 'skill', issue.field, null, issue.params));
  }

  // Step 6: the body check comes last, so `errors[0]` stays the metadata problem.
  const body = String(parsed.body ?? '');
  const bodyEmpty = body.trim() === '';
  if (bodyEmpty) {
    errors.push(
      makeError('SKILL_BODY_EMPTY', candidate.file, 'skill', null, null, { dir: candidate.dirId })
    );
  }

  if (issues.length > 0 || bodyEmpty) return null;

  const meta = parsed.meta;
  return {
    id: meta.id,
    name: meta.name,
    summary: meta.summary,
    appliesTo: isStringArray(meta.applies_to) ? meta.applies_to.slice() : [],
    commands: isStringArray(meta.commands) ? meta.commands.slice() : [],
    body,
    source: candidate.source,
    file: candidate.file
  };
}

function validateRole(candidate, skillIds, errors) {
  const parsed = parseYaml(candidate.text);
  if (!parsed.ok) {
    errors.push(
      makeError('YAML_PARSE_FAILED', candidate.file, 'role', null, parsed.line, {
        line: parsed.line,
        detailKey: parsed.detailKey,
        detailParams: parsed.detailParams ?? {}
      })
    );
    return null;
  }

  const value =
    parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
      ? parsed.value
      : {};

  // Steps 2..7 of D-3.
  const issues = checkRoleShape(value, { fileId: candidate.fileId });
  for (const issue of issues) {
    errors.push(makeError(issue.code, candidate.file, 'role', issue.field, null, issue.params));
  }

  // Step 8 runs after every skill has been loaded, so a forward reference works.
  // One missing skill per file is enough to explain the failure (same-code rule).
  let missingSkill = null;
  if (isStringArray(value.skills)) {
    for (const skillId of value.skills) {
      if (!skillIds.has(skillId)) {
        missingSkill = skillId;
        break;
      }
    }
  }
  if (missingSkill !== null) {
    errors.push(
      makeError('ROLE_SKILL_NOT_FOUND', candidate.file, 'role', 'skills', null, {
        skill: missingSkill
      })
    );
  }

  if (issues.length > 0 || missingSkill !== null) return null;

  return {
    id: value.id,
    name: value.name,
    group: value.group,
    summary: value.summary,
    artifactType: value.artifact_type,
    sideEffect: value.side_effect,
    skills: isStringArray(value.skills) ? value.skills.slice() : [],
    tools: isStringArray(value.tools) ? value.tools.slice() : [],
    wakeAllow: isStringArray(value.wake_allow) ? value.wake_allow.slice() : [],
    dispatchable: value.dispatchable === undefined ? true : value.dispatchable === true,
    maxConcurrentSessions: value.max_concurrent_sessions,
    source: candidate.source,
    file: candidate.file
  };
}

/** Fixed five entries in `GROUPS` order; only valid roles are counted. */
function groupCounts(roles) {
  return GROUPS.map((group) => ({
    group,
    count: roles.filter((role) => role.group === group).length
  }));
}

function emptyRegistry(errors) {
  return {
    ok: false,
    roles: [],
    roleMap: new Map(),
    skills: [],
    skillMap: new Map(),
    errors,
    counts: { assets: 1, roles: 0, skills: 0, builtin: 0, project: 0, invalid: 1 },
    groups: groupCounts([])
  };
}

/**
 * @param {{root?:string, onlyRole?:string|null, builtinRoot?:string|null}} [options]
 * @returns {{ok:boolean, roles:Array, roleMap:Map, skills:Array, skillMap:Map,
 *            errors:Array, counts:object, groups:Array}}
 */
export function loadRegistry({ root, onlyRole = null, builtinRoot = null } = {}) {
  const base = builtinRoot === null || builtinRoot === undefined ? assetsRoot() : builtinRoot;

  // A missing built-in root is an environment-level failure: report that one line
  // and stop instead of emitting one error per absent file (D-3 step 4).
  if (!isDirectory(base)) {
    return emptyRegistry([
      makeError('REGISTRY_ASSETS_MISSING', 'roles', 'role', null, null, { path: base })
    ]);
  }

  const projectRoot = root ?? process.cwd();

  // Skills first: skill references are resolved only after the whole table exists.
  const skillErrors = [];
  const skillCandidates = mergeByKey(
    collectSkillDirs(path.join(base, 'skills'), BUILTIN),
    collectSkillDirs(path.join(projectRoot, '.orch', 'skills'), PROJECT),
    'dirId'
  );
  const skills = [];
  for (const candidate of [...skillCandidates.values()].sort((a, b) =>
    compareText(a.dirId, b.dirId)
  )) {
    const def = validateSkill(candidate, skillErrors);
    if (def) skills.push(def);
  }
  skills.sort((a, b) => compareText(a.id, b.id));

  const skillMap = new Map(skills.map((skill) => [skill.id, skill]));
  const skillIds = new Set(skillMap.keys());

  const builtinRoles = collectRoleFiles(path.join(base, 'roles'), BUILTIN);
  const projectRoles = collectRoleFiles(path.join(projectRoot, '.orch', 'roles'), PROJECT);

  if (onlyRole !== null && onlyRole !== undefined) {
    // Single-role mode: project wins over built-in, skills load in full (so a valid
    // reference is not reported as dangling) but their errors are dropped.
    const candidate =
      projectRoles.find((item) => item.fileId === onlyRole) ??
      builtinRoles.find((item) => item.fileId === onlyRole) ??
      null;
    const errors = [];
    const def = candidate ? validateRole(candidate, skillIds, errors) : null;
    const roles = def ? [def] : [];
    return {
      ok: errors.length === 0,
      roles,
      roleMap: new Map(roles.map((role) => [role.id, role])),
      skills,
      skillMap,
      errors,
      counts: {
        assets: 1,
        roles: roles.length,
        skills: 0,
        builtin: def && def.source === BUILTIN ? 1 : 0,
        project: def && def.source === PROJECT ? 1 : 0,
        invalid: errors.length > 0 ? 1 : 0
      },
      groups: groupCounts(roles)
    };
  }

  const errors = [];
  const roles = [];
  const roleCandidates = mergeByKey(builtinRoles, projectRoles, 'fileId');
  for (const candidate of [...roleCandidates.values()].sort((a, b) =>
    compareText(a.fileId, b.fileId)
  )) {
    const def = validateRole(candidate, skillIds, errors);
    if (def) roles.push(def);
  }
  roles.sort((a, b) => {
    const delta = GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group);
    return delta !== 0 ? delta : compareText(a.id, b.id);
  });

  const allErrors = errors.concat(skillErrors);
  // Stable sort: inside one file the D-3 order is preserved.
  allErrors.sort((a, b) => compareText(a.file, b.file));

  const invalidFiles = new Set(allErrors.map((item) => item.file));
  const invalid = invalidFiles.size;
  const builtinCount =
    roles.filter((role) => role.source === BUILTIN).length +
    skills.filter((skill) => skill.source === BUILTIN).length;
  const projectCount =
    roles.filter((role) => role.source === PROJECT).length +
    skills.filter((skill) => skill.source === PROJECT).length;

  return {
    ok: allErrors.length === 0,
    roles,
    roleMap: new Map(roles.map((role) => [role.id, role])),
    skills,
    skillMap,
    errors: allErrors,
    counts: {
      assets: roles.length + skills.length + invalid,
      roles: roles.length,
      skills: skills.length,
      builtin: builtinCount,
      project: projectCount,
      invalid
    },
    groups: groupCounts(roles)
  };
}
