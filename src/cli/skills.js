/**
 * `orch skill list|show|create|validate|export|import` (split doc 2.10, WP-7).
 *
 * Discipline (mirrors `roles.js`):
 * 1. No CJK literal in this file (D-9 / AC-51). Every sentence comes from
 *    `labels.js`; registry failures are assembled through `roles.js`'s exported
 *    `detailOf`, so the templates have exactly one assembly site (D-4).
 * 2. `render.js` owns the line layout; this file decides what to print and the
 *    exit code. `--format json` bypasses the renderers and `JSON.stringify`s
 *    directly (A-6 / A-7).
 * 3. Every disk write goes through WP-6's `asset-write` (`serializeSkill` +
 *    `atomicWrite`, called by the frozen section-2.8 signature contract); the
 *    `.orch/skills/<id>/SKILL.md` landing whitelist is guarded there. Read-only
 *    commands never call `ctx.createClient` and never create `.orch` (AC-45).
 * 4. Usage-level checks live in `parseArgs` (WP-5) and are NOT repeated here.
 *    The only value checks judged here are the two WP-5 left behind: the
 *    `--applies-to` group names and the `--body-file` existence (AC-59: a value
 *    error prints the usage block and exits 2, an asset problem exits 1).
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadRegistry } from '../registry/index.js';
import { parseSkillFile } from '../registry/skill-file.js';
import { checkSkillMeta, GROUPS, SKILL_SCHEMA_VERSION } from '../registry/role-schema.js';
import { builtinSkillsDir, projectSkillsDir } from '../registry/assets.js';
import { serializeSkill, atomicWrite } from '../registry/asset-write.js';
import * as render from './render.js';
import { detailOf } from './roles.js';
import { GROUP_LABEL, REGISTRY_ERROR, SKILL_CLI_TEXT } from './labels.js';

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

/**
 * TODO(labels): A-7's default body skeleton is a verbatim CJK three-line block
 * (a heading line + blank + one numbered sentence), but `labels.js` (WP-5's file)
 * has no key for it and this file must stay CJK-free (AC-51 / D-9). Until WP-5
 * lands a key (suggested: `SKILL_CLI_TEXT.defaultBody`), an English placeholder
 * keeps the same shape; the key must replace this constant verbatim.
 */
const DEFAULT_BODY =
  '### Work method\n\n1. Complete the work covered by this skill as required by the task, and state clearly what was done.\n';

/**
 * TODO(labels): no `labels.js` key exists for a missing `--body-file` value
 * (AC-59 treats it as a usage error, exit 2). English placeholder until WP-5
 * lands one; suggested: `SKILL_CLI_TEXT.usageReason.bodyFileMissing`.
 */
const BODY_FILE_MISSING = 'body file not found: {file}';

/** `{name}` substitution; absent values become empty strings, never `undefined`. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars?.[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Skill-scope error files only; roles never leak into the skill counts (D-4). */
function skillErrorFiles(errors) {
  const files = new Set();
  for (const err of errors) {
    if (err.scope === 'skill') files.add(err.file);
  }
  return files;
}

/** A-6's seven-key skill object. The `.orch/` prefix is added here only. */
function toSkillJson(skill) {
  return {
    id: skill.id,
    name: skill.name,
    appliesTo: skill.appliesTo.slice(),
    appliesToLabels: skill.appliesTo.map((group) => GROUP_LABEL[group] ?? group),
    commands: skill.commands.slice(),
    source: skill.source,
    file: skill.source === 'project' ? `.orch/${skill.file}` : skill.file
  };
}

/** `<applies-to groups or dash>` display: group labels joined with `, ` (A-6). */
function displayAppliesTo(json) {
  return json.appliesToLabels.length > 0 ? json.appliesToLabels.join(', ') : SKILL_CLI_TEXT.placeholder;
}

/** The `commands <n>` row slot and the show commands line share the array. */
function displayCommands(commands) {
  return commands.length > 0 ? commands.join(', ') : SKILL_CLI_TEXT.placeholder;
}

/**
 * The A-6 contract row: rendered from the same `listRow` template as `list`, so
 * the list line and the show/create first line are byte-identical (A-6 / A-7).
 */
function rowText(json) {
  return fill(SKILL_CLI_TEXT.listRow, {
    id: json.id,
    name: json.name,
    appliesTo: displayAppliesTo(json),
    commands: json.commands.length
  });
}

/** One registry error → the A-7 validate row `{file, detail, code}`. */
function errorRow(err) {
  return { file: err.file, detail: detailOf(err), code: err.code };
}

// ---------------------------------------------------------------- subcommands

function listSkills({ registry, flags, format, out }) {
  const group = typeof flags.group === 'string' ? flags.group : null;
  const rows = group === null ? registry.skills : registry.skills.filter((skill) => skill.appliesTo.includes(group));
  const invalid = skillErrorFiles(registry.errors).size;
  const counts = {
    total: rows.length,
    builtin: rows.filter((skill) => skill.source === 'builtin').length,
    project: rows.filter((skill) => skill.source === 'project').length,
    invalid
  };
  const jsonRows = rows.map(toSkillJson);

  if (format === 'json') {
    // AC-16: exactly two top-level keys, four-key counts, seven keys per skill.
    out(JSON.stringify({ counts, skills: jsonRows }, null, 2));
  } else {
    for (const line of render.renderSkillList({
      counts,
      rows: jsonRows.map((json) => ({
        id: json.id,
        name: json.name,
        appliesTo: displayAppliesTo(json),
        commands: json.commands.length
      }))
    })) {
      out(line);
    }
  }
  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

function showSkill({ registry, format, out, skillId }) {
  const skill = registry.skillMap.get(skillId);
  if (!skill) {
    out(fill(SKILL_CLI_TEXT.notFoundSkill, { id: skillId }));
    out(SKILL_CLI_TEXT.notFoundSkillHint);
    return EXIT_FAILED;
  }

  const json = toSkillJson(skill);
  if (format === 'json') {
    // AC-17: exactly two top-level keys (`skill`, `body`).
    out(JSON.stringify({ skill: json, body: skill.body }, null, 2));
    return EXIT_OK;
  }
  for (const line of render.renderSkillShow({
    row: rowText(json),
    summary: skill.summary,
    commands: displayCommands(json.commands),
    appliesTo: displayAppliesTo(json),
    source: { kind: json.source, file: json.file },
    body: skill.body
  })) {
    out(line);
  }
  return EXIT_OK;
}

/**
 * Skill-level validation counts (A-7 / AC-19): five keys, counted over skills
 * only — `assets` is valid skills plus invalid skill files, never the registry's
 * asset-level number.
 */
function validateCounts(skills, invalid) {
  return {
    assets: skills.length + invalid,
    skills: skills.length,
    builtin: skills.filter((skill) => skill.source === 'builtin').length,
    project: skills.filter((skill) => skill.source === 'project').length,
    invalid
  };
}

function validateSkills({ registry, format, out, onlySkill }) {
  let skills = registry.skills;
  let errors = registry.errors.filter((err) => err.scope === 'skill');
  if (onlySkill !== null) {
    // `orch skill validate [<skill id>]` (A-12): narrow both sides to that one id.
    const suffixes = [`skills/${onlySkill}/SKILL.md`, `assets/skills/${onlySkill}/SKILL.md`];
    errors = errors.filter((err) => suffixes.includes(err.file));
    skills = skills.filter((skill) => skill.id === onlySkill);
    if (skills.length === 0 && errors.length === 0) {
      out(fill(SKILL_CLI_TEXT.notFoundSkill, { id: onlySkill }));
      out(SKILL_CLI_TEXT.notFoundSkillHint);
      return EXIT_FAILED;
    }
  }
  const counts = validateCounts(skills, skillErrorFiles(errors).size);
  const rows = errors.map(errorRow);

  if (format === 'json') {
    // AC-19: `codes` are read off `errors[].code`; six keys per error, same as
    // `role validate` (A-7's JSON shape).
    out(
      JSON.stringify(
        {
          counts,
          errors: errors.map((err) => ({
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
    for (const line of render.renderSkillValidate({ counts, rows })) out(line);
  }
  return counts.invalid > 0 ? EXIT_FAILED : EXIT_OK;
}

/** `--applies-to <a,b>` value check (AC-59): every group must be a real one. */
function checkAppliesTo(rawValue) {
  const groups = String(rawValue)
    .split(',')
    .map((item) => item.trim());
  for (const group of groups) {
    if (!GROUPS.includes(group)) return { ok: false, value: group };
  }
  return { ok: true, groups };
}

async function createSkill({ registry, flags, out, skillId, cwd }) {
  // Value checks first (usage class, exit 2), before any registry verdict.
  let appliesTo = [];
  if (flags['applies-to'] !== undefined) {
    const checked = checkAppliesTo(flags['applies-to']);
    if (!checked.ok) {
      out(render.renderUsage(fill(REGISTRY_ERROR.SKILL_GROUP_INVALID, { value: checked.value })));
      return EXIT_USAGE;
    }
    appliesTo = checked.groups;
  }
  let body = DEFAULT_BODY;
  if (flags['body-file'] !== undefined) {
    const text = readText(path.resolve(cwd, flags['body-file']));
    if (text === null) {
      // TODO(labels): usage-style reason line for a missing body file (AC-59).
      out(render.renderUsage(fill(BODY_FILE_MISSING, { file: flags['body-file'] })));
      return EXIT_USAGE;
    }
    body = text;
  }

  const skill = registry.skillMap.get(skillId);
  if (skill && skill.source === 'builtin') {
    // AC-58: `--force` never exempts a built-in id; assets/** stays untouched.
    out(
      fill(SKILL_CLI_TEXT.createRejected, {
        detail: fill(SKILL_CLI_TEXT.builtinReadonly, { id: skillId }),
        code: 'ASSET_READONLY'
      })
    );
    return EXIT_FAILED;
  }

  if (body.trim() === '') {
    // AC-59 case 4: an empty body is an asset problem (exit 1), nothing on disk.
    out(
      fill(SKILL_CLI_TEXT.createRejected, {
        detail: fill(REGISTRY_ERROR.SKILL_BODY_EMPTY, { dir: skillId }),
        code: 'SKILL_BODY_EMPTY'
      })
    );
    return EXIT_FAILED;
  }

  const file = `.orch/skills/${skillId}/SKILL.md`;
  const target = path.join(cwd, '.orch', 'skills', skillId, 'SKILL.md');
  if (fs.existsSync(target) && flags.force !== true) {
    out(fill(SKILL_CLI_TEXT.exists, { file }));
    return EXIT_FAILED;
  }

  // Same validator as the loader (D-4): a created skill must validate clean.
  const meta = { schema: SKILL_SCHEMA_VERSION, id: skillId, name: flags.name, summary: flags.summary };
  if (appliesTo.length > 0) meta.applies_to = appliesTo;
  if (flags.commands !== undefined) meta.commands = [flags.commands];
  const issues = checkSkillMeta(meta, { dirId: skillId });
  if (issues.length > 0) {
    const issue = issues[0];
    out(
      fill(SKILL_CLI_TEXT.createRejected, {
        detail: detailOf({ code: issue.code, params: issue.params }),
        code: issue.code
      })
    );
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target, text: serializeSkill(meta, body) });
  if (!written.ok) {
    out(fill(SKILL_CLI_TEXT.createRejected, { detail: written.code, code: written.code }));
    return EXIT_FAILED;
  }

  out(fill(SKILL_CLI_TEXT.created, { file }));
  out(
    rowText({
      id: skillId,
      name: flags.name,
      appliesToLabels: appliesTo.map((group) => GROUP_LABEL[group] ?? group),
      commands: meta.commands ?? []
    })
  );
  out(SKILL_CLI_TEXT.checkPassed);
  return EXIT_OK;
}

async function exportSkill({ registry, flags, out, skillId, cwd }) {
  const skill = registry.skillMap.get(skillId);
  if (!skill) {
    out(fill(SKILL_CLI_TEXT.notFoundSkill, { id: skillId }));
    out(SKILL_CLI_TEXT.notFoundSkillHint);
    return EXIT_FAILED;
  }

  const sourceFile =
    skill.source === 'builtin'
      ? path.join(builtinSkillsDir(), skill.id, 'SKILL.md')
      : path.join(projectSkillsDir(cwd), skill.id, 'SKILL.md');
  const text = readText(sourceFile);
  if (text === null) {
    out(fill(SKILL_CLI_TEXT.notFoundSkill, { id: skillId }));
    out(SKILL_CLI_TEXT.notFoundSkillHint);
    return EXIT_FAILED;
  }

  // Without --out the SKILL.md body itself is the stdout (A-7); with --out the
  // one explicit file is written through the same atomic-write contract (§2.8).
  if (flags.out === undefined) {
    out(text);
    return EXIT_OK;
  }
  const target = path.resolve(cwd, flags.out);
  const written = await atomicWrite({ target, text });
  if (!written.ok) {
    out(fill(SKILL_CLI_TEXT.createRejected, { detail: written.code, code: written.code }));
    return EXIT_FAILED;
  }
  out(fill(SKILL_CLI_TEXT.exported, { id: skillId, file: flags.out }));
  return EXIT_OK;
}

async function importSkill({ flags, out, fileArg, cwd }) {
  const abs = path.resolve(cwd, fileArg);
  const text = readText(abs);
  if (text === null) {
    out(fill(SKILL_CLI_TEXT.importFileMissing, { file: fileArg }));
    return EXIT_FAILED;
  }

  const parsed = parseSkillFile(text);
  if (!parsed.ok) {
    out(
      fill(SKILL_CLI_TEXT.importRejected, {
        detail: detailOf({
          code: 'YAML_PARSE_FAILED',
          params: { line: parsed.line, detailKey: parsed.detailKey, detailParams: parsed.detailParams ?? {} }
        }),
        code: 'YAML_PARSE_FAILED'
      })
    );
    return EXIT_FAILED;
  }

  const meta = parsed.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta) ? parsed.meta : {};
  const dirId = typeof meta.id === 'string' ? meta.id : undefined;
  const issues = checkSkillMeta(meta, { dirId });
  if (issues.length > 0) {
    const issue = issues[0];
    out(
      fill(SKILL_CLI_TEXT.importRejected, {
        detail: detailOf({ code: issue.code, params: issue.params }),
        code: issue.code
      })
    );
    return EXIT_FAILED;
  }

  if (String(parsed.body ?? '').trim() === '') {
    out(
      fill(SKILL_CLI_TEXT.importRejected, {
        detail: fill(REGISTRY_ERROR.SKILL_BODY_EMPTY, { dir: dirId }),
        code: 'SKILL_BODY_EMPTY'
      })
    );
    return EXIT_FAILED;
  }

  // AC-20: importing a built-in id installs it as the project copy (project
  // wins as a whole file, `builtin 9 · project 1`); `--force` covers a project
  // twin. The raw file text lands verbatim, so export → import is byte-equal.
  const file = `.orch/skills/${dirId}/SKILL.md`;
  const target = path.join(cwd, '.orch', 'skills', dirId, 'SKILL.md');
  if (fs.existsSync(target) && flags.force !== true) {
    out(fill(SKILL_CLI_TEXT.exists, { file }));
    return EXIT_FAILED;
  }

  const written = await atomicWrite({ target, text });
  if (!written.ok) {
    out(fill(SKILL_CLI_TEXT.importRejected, { detail: written.code, code: written.code }));
    return EXIT_FAILED;
  }
  out(fill(SKILL_CLI_TEXT.installed, { file }));
  out(SKILL_CLI_TEXT.checkPassed);
  return EXIT_OK;
}

// ---------------------------------------------------------------- dispatcher

/**
 * @param {{command:'skill', sub:string, positional:string|null, flags:object}} parsed
 * @param {{cwd:string, out:(line:string)=>void, createClient:Function, now?:Function}} ctx
 * @returns {Promise<number>} 0 ok / 1 bad assets or target missing / 2 usage
 */
export async function skillCommand(parsed, ctx) {
  const out = ctx.out;
  const flags = parsed.flags ?? {};
  const format = flags.format ?? 'text';
  const registry = loadRegistry({ root: ctx.cwd });

  switch (parsed.sub) {
    case 'list': {
      // The one `list` value check WP-5 left behind: same template as create's
      // `--applies-to` (no dedicated `labels.js` key exists for `list --group`).
      if (typeof flags.group === 'string' && !GROUPS.includes(flags.group)) {
        out(render.renderUsage(fill(REGISTRY_ERROR.SKILL_GROUP_INVALID, { value: flags.group })));
        return EXIT_USAGE;
      }
      return listSkills({ registry, flags, format, out });
    }
    case 'show':
      return showSkill({ registry, format, out, skillId: parsed.positional ?? '' });
    case 'validate':
      return validateSkills({
        registry,
        format,
        out,
        onlySkill:
          typeof parsed.positional === 'string' && parsed.positional.length > 0 ? parsed.positional : null
      });
    case 'create':
      return createSkill({ registry, flags, out, skillId: parsed.positional ?? '', cwd: ctx.cwd });
    case 'export':
      return exportSkill({ registry, flags, out, skillId: parsed.positional ?? '', cwd: ctx.cwd });
    case 'import':
      return importSkill({ flags, out, fileArg: parsed.positional ?? '', cwd: ctx.cwd });
    default:
      // Unreachable: `parseArgs` rejects unknown subs before dispatch (WP-5).
      out(render.renderUsage(SKILL_CLI_TEXT.notImplemented));
      return EXIT_USAGE;
  }
}
