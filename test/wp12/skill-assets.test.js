/**
 * I1.6 WP-7 contract tests for the `orch skill` command family (split doc 2.10 /
 * D-10 file 8 of 8).
 *
 * Every case runs in its own `fs.mkdtemp(os.tmpdir())` project root — never
 * inside the repository — and drives `main` with an injected `out` sink, so no
 * process is spawned and no core is started; exit codes are the returned
 * numbers (D-10:1683). Fixture skill files are copied read-only from the real
 * `assets/skills/**` tree.
 *
 * Covered: `skill list` (AC-16), `skill show` (AC-17), `skill create` with the
 * default body skeleton (AC-18), `skill validate` with the two skill-only
 * reason codes (AC-19), export → import byte equality (AC-20), built-in
 * read-only discipline incl. `--force` and the sha256 face (AC-58), the three
 * AC-59 error paths (bad group exit 2 / missing summary exit 2 / empty body
 * exit 1 without landing), and the read/write package boundaries (AC-45/46).
 *
 * TODO(labels): A-7's default body skeleton is verbatim CJK but `labels.js` has
 * no key for it, so `skills.js` carries an English placeholder (WP-7 return
 * reports the missing key). The byte assertions below pin the placeholder's
 * shape and must be swapped to the verbatim skeleton once the key lands.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { main } from '../../src/cli/main.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const tempRoots = [];

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-skill-assets-'));
  tempRoots.push(root);
  return root;
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function harness({ cwd } = {}) {
  const root = cwd ?? makeProject();
  const lines = [];
  const created = [];
  const run = async (argv) => {
    const code = await main(argv, {
      cwd: root,
      out: (line) => lines.push(line),
      createClient: () => {
        created.push(root);
        throw new Error('createClient must not be called');
      }
    });
    return code;
  };
  return { run, lines, created, root };
}

/** Copy a real built-in skill directory (read-only source) into the project. */
function copyBuiltinSkill(root, id) {
  const source = path.join(repoRoot, 'assets', 'skills', id, 'SKILL.md');
  const target = path.join(root, '.orch', 'skills', id, 'SKILL.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return target;
}

function writeSkillFile(root, id, metaText, body) {
  const target = path.join(root, '.orch', 'skills', id, 'SKILL.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `---\n${metaText}\n---\n${body}`, 'utf8');
  return target;
}

/** sha256 manifest of the repository's built-in assets (AC-58 / AC-46 face). */
function sha256Assets() {
  const out = [];
  const walk = (base) => {
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(base, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(`${path.relative(repoRoot, abs).replace(/\\/g, '/')}=${createHash('sha256').update(fs.readFileSync(abs)).digest('hex')}`);
    }
  };
  walk(path.join(repoRoot, 'assets'));
  return out;
}

// ---------------------------------------------------------------------------
// AC-16: skill list is stable in both channels
// ---------------------------------------------------------------------------

test('AC-16: skill list prints the count header and ten id-sorted rows', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'list']), 0);
  assert.equal(lines.length, 11, 'header + ten rows');
  assert.equal(lines[0], '技能 10 个（内置 10 · 项目 0）');
  assert.equal(lines[1], '- code-change 代码修改 · 编码工程 · 命令 1');
  assert.equal(lines[2], '- code-review 代码审查 · 编码工程 · 命令 0');
  const ids = lines.slice(1).map((line) => line.slice(2).split(' ')[0]);
  assert.deepEqual([...ids].sort(), ids, 'rows are id-sorted');
});

test('AC-16: skill list --format json has exactly two top-level keys', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'list', '--format', 'json']), 0);
  assert.equal(lines.length, 1, 'JSON arrives as one out() call');
  const payload = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(payload).sort(), ['counts', 'skills']);
  assert.deepEqual(Object.keys(payload.counts).sort(), ['builtin', 'invalid', 'project', 'total']);
  assert.equal(payload.counts.total, 10);
  assert.equal(payload.counts.builtin, 10);
  assert.equal(payload.counts.project, 0);
  assert.equal(payload.counts.invalid, 0);
  assert.equal(payload.skills.length, 10);
  for (const skill of payload.skills) {
    assert.deepEqual(
      Object.keys(skill).sort(),
      ['appliesTo', 'appliesToLabels', 'commands', 'file', 'id', 'name', 'source'],
      'seven keys per skill object'
    );
    assert.equal(skill.source, 'builtin');
    assert.equal(skill.file, `assets/skills/${skill.id}/SKILL.md`);
  }
  const codeChange = payload.skills.find((skill) => skill.id === 'code-change');
  assert.deepEqual(codeChange.appliesTo, ['coding']);
  assert.deepEqual(codeChange.appliesToLabels, ['编码工程']);
  assert.deepEqual(codeChange.commands, ['node --test']);
});

test('AC-16: skill list --group filters by applies-to; a bad group exits 2', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'list', '--group', 'coding']), 0);
  assert.ok(lines[0].startsWith('技能 '), lines[0]);
  assert.ok(lines.slice(1).every((line) => line.includes('编码工程')), 'only coding rows');

  lines.length = 0;
  assert.equal(await run(['skill', 'list', '--group', 'nope']), 2);
  const block = lines[0].split('\n');
  assert.equal(block.length, 26, '25 usage lines plus the reason line');
  assert.ok(block.at(-1).includes('适用分组取值非法：nope'), block.at(-1));
});

// ---------------------------------------------------------------------------
// AC-17: skill show carries the body, six metadata lines first
// ---------------------------------------------------------------------------

test('AC-17: skill show prints six metadata lines then the indented body', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'show', 'code-change']), 0);
  assert.ok(lines.length > 7, 'body lines follow the metadata block');
  assert.equal(lines[0], '- code-change 代码修改 · 编码工程 · 命令 1');
  assert.equal(lines[1], '  摘要：定位到要改的文件，做最小改动，并写清改了什么');
  assert.equal(lines[2], '  命令：node --test');
  assert.equal(lines[3], '  适用：编码工程');
  assert.equal(lines[4], '  来源：内置 assets/skills/code-change/SKILL.md');
  assert.equal(lines[5], '  正文：');
  assert.equal(lines[6], '  ### 工作方法');
});

test('AC-17: skill show --format json has exactly skill and body', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'show', 'code-change', '--format', 'json']), 0);
  const payload = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(payload).sort(), ['body', 'skill']);
  assert.ok(payload.body.includes('### 工作方法'));
  assert.deepEqual(Object.keys(payload.skill).sort(), [
    'appliesTo',
    'appliesToLabels',
    'commands',
    'file',
    'id',
    'name',
    'source'
  ]);
});

test('AC-17: skill show of a project skill reports the project source', async () => {
  const root = makeProject();
  copyBuiltinSkill(root, 'code-change');
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'show', 'code-change']), 0);
  assert.equal(lines[0], '- code-change 代码修改 · 编码工程 · 命令 1');
  assert.equal(lines[4], '  来源：项目 .orch/skills/code-change/SKILL.md');
});

test('AC-17: skill show of an unknown id exits 1', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'show', 'ghost']), 1);
  assert.equal(lines[0], '找不到技能：ghost');
  assert.equal(lines[1], '可用技能：执行 orch skill list 查看');
});

// ---------------------------------------------------------------------------
// AC-18: create passes validation immediately, default body skeleton
// ---------------------------------------------------------------------------

test('AC-18: skill create prints three lines and lands a valid SKILL.md', async () => {
  const root = makeProject();
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote', '--name', '引用规范', '--summary', '给结论配上可核对的出处', '--applies-to', 'writing']), 0);
  assert.equal(lines[0], '已创建项目技能：.orch/skills/quote/SKILL.md');
  assert.equal(lines[1], '- quote 引用规范 · 内容创作 · 命令 0');
  assert.equal(lines[2], '校验：通过');

  const text = fs.readFileSync(path.join(root, '.orch', 'skills', 'quote', 'SKILL.md'), 'utf8');
  assert.ok(text.startsWith('---\n'), 'file starts with the front matter opener');
  assert.ok(text.includes('schema: skill/v1'));
  assert.ok(text.includes('id: quote'));
  assert.ok(text.replace(/\s/g, '').length > 0, 'body is non-empty');

  lines.length = 0;
  assert.equal(await run(['skill', 'validate']), 0);
  assert.equal(lines[0], '校验技能 11 个：全部通过');
});

test('AC-18: create without --body-file fills the default skeleton (TODO: labels key)', async () => {
  const root = makeProject();
  const { run } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote', '--name', '引用规范', '--summary', '给结论配上可核对的出处']), 0);
  const text = fs.readFileSync(path.join(root, '.orch', 'skills', 'quote', 'SKILL.md'), 'utf8');
  const body = text.split(/^---\n/m).slice(2).join('---\n');
  // TODO(labels): swap to the verbatim A-7 skeleton once `labels.js` lands the key.
  assert.equal(body, '### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。\n');
});

test('AC-18: create --commands and --body-file land verbatim (AC-59 happy path)', async () => {
  // NOTE: AC-59's Then uses `--applies-to writing,review`, but `review` is not in
  // the closed five-group set (coordinator / research / writing / coding / ops),
  // so the literal AC-59 command would exit 2 — a requirement-internal conflict
  // reported in the WP-7 return. This test pins the same multi-group path with
  // the legal pair `writing,research`.
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'body.md'), '给结论配上可核对的出处。\n', 'utf8');
  const { run, lines } = harness({ cwd: root });

  assert.equal(
    await run(['skill', 'create', 'quote', '--name', '引用规范', '--summary', 'x', '--applies-to', 'writing,research', '--commands', 'node --test', '--body-file', 'body.md']),
    0
  );
  assert.equal(lines[1], '- quote 引用规范 · 内容创作, 研究分析 · 命令 1');

  const text = fs.readFileSync(path.join(root, '.orch', 'skills', 'quote', 'SKILL.md'), 'utf8');
  assert.equal(text.split('\n').filter((line) => line.includes('node --test')).length, 1);
  assert.ok(text.includes('给结论配上可核对的出处。'), 'body file content is the body');

  lines.length = 0;
  assert.equal(await run(['skill', 'validate', '--format', 'json']), 0);
  assert.equal(JSON.parse(lines[0]).counts.invalid, 0);

  lines.length = 0;
  assert.equal(await run(['skill', 'show', 'quote']), 0);
  assert.equal(lines[2], '  命令：node --test');
  assert.equal(lines[3], '  适用：内容创作, 研究分析');
  assert.ok(lines.slice(6).some((line) => line.includes('给结论配上可核对的出处。')));
});

// ---------------------------------------------------------------------------
// AC-19: skill validate locates the broken files, skill-only counts
// ---------------------------------------------------------------------------

test('AC-19: two broken skills are reported with the two skill-only codes', async () => {
  const root = makeProject();
  writeSkillFile(root, 'half', 'schema: skill/v1\nid: half\nname: 半截', '有正文。');
  writeSkillFile(root, 'empty', 'schema: skill/v1\nid: empty\nname: 空壳\nsummary: 有摘要', '\n');
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'validate']), 1);
  assert.equal(lines[0], '校验技能 12 个：2 个不合法');
  const rows = lines.slice(1);
  assert.ok(
    rows.includes('- skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）'),
    'half is reported with its file and code'
  );
  assert.ok(
    rows.includes('- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY）'),
    'empty is reported with its file and code'
  );
  assert.equal(rows.length, 2);

  lines.length = 0;
  assert.equal(await run(['skill', 'validate', '--format', 'json']), 1);
  const payload = JSON.parse(lines[0]);
  assert.deepEqual(payload.errors.map((err) => err.code).sort(), ['SKILL_BODY_EMPTY', 'SKILL_SCHEMA_MISSING']);
  assert.equal(payload.counts.assets, 12);
  assert.equal(payload.counts.invalid, 2);
  assert.equal(payload.counts.skills, 10, 'only the ten built-in skills are valid');
});

// ---------------------------------------------------------------------------
// AC-20: export then import is byte-equal
// ---------------------------------------------------------------------------

test('AC-20: export --out then import into another root is byte-identical', async () => {
  const rootA = makeProject();
  const rootB = makeProject();
  const { run: runA, lines: linesA } = harness({ cwd: rootA });

  assert.equal(await runA(['skill', 'export', 'code-change', '--out', 'exports/code-change.md']), 0);
  assert.equal(linesA[0], '已导出技能 code-change 到 exports/code-change.md');
  const exported = fs.readFileSync(path.join(rootA, 'exports', 'code-change.md'));

  fs.mkdirSync(path.join(rootB, 'inbox'), { recursive: true });
  fs.writeFileSync(path.join(rootB, 'inbox', 'code-change.md'), exported);

  const { run: runB, lines: linesB } = harness({ cwd: rootB });
  assert.equal(await runB(['skill', 'import', 'inbox/code-change.md']), 0);
  assert.equal(linesB[0], '已安装项目技能：.orch/skills/code-change/SKILL.md');
  assert.equal(linesB[1], '校验：通过');

  const landed = fs.readFileSync(path.join(rootB, '.orch', 'skills', 'code-change', 'SKILL.md'));
  assert.deepEqual(landed, exported, 'import lands the exported bytes verbatim');

  linesB.length = 0;
  assert.equal(await runB(['skill', 'list']), 0);
  assert.equal(linesB[0], '技能 10 个（内置 9 · 项目 1）');

  linesB.length = 0;
  assert.equal(await runB(['skill', 'validate', '--format', 'json']), 0);
  const counts = JSON.parse(linesB[0]).counts;
  assert.equal(counts.invalid, 0);
  assert.equal(counts.project, 1);
});

test('AC-20: export without --out prints the SKILL.md body to stdout', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'export', 'code-change']), 0);
  const original = fs.readFileSync(path.join(repoRoot, 'assets', 'skills', 'code-change', 'SKILL.md'), 'utf8');
  assert.equal(lines[0], original);
});

test('AC-20: export of an unknown id exits 1; import of a missing file exits 1', async () => {
  const { run, lines } = harness();

  assert.equal(await run(['skill', 'export', 'ghost']), 1);
  assert.equal(lines[0], '找不到技能：ghost');

  lines.length = 0;
  assert.equal(await run(['skill', 'import', 'nope.md']), 1);
  assert.equal(lines[0], '导入被拒：文件不存在：nope.md');
});

test('AC-20: import rejects a file without front matter and an empty body', async () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'bad.md'), 'no front matter here\n', 'utf8');
  fs.writeFileSync(path.join(root, 'empty.md'), '---\nschema: skill/v1\nid: half\nname: 半截\nsummary: 有摘要\n---\n\n', 'utf8');
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'import', 'bad.md']), 1);
  assert.equal(lines[0], '导入被拒：第 1 行无法解析：缺少前置元数据分隔符（YAML_PARSE_FAILED）');

  lines.length = 0;
  assert.equal(await run(['skill', 'import', 'empty.md']), 1);
  assert.equal(lines[0], '导入被拒：技能正文为空：half（SKILL_BODY_EMPTY）');
  assert.equal(fs.existsSync(path.join(root, '.orch')), false, 'rejected imports never land');
});

// ---------------------------------------------------------------------------
// AC-58: built-in ids are read-only; --force only covers project twins
// ---------------------------------------------------------------------------

test('AC-58: create on a built-in id is refused even with --force', async () => {
  const root = makeProject();
  const before = sha256Assets();
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'code-change', '--name', '冒名', '--summary', '占位', '--force']), 1);
  assert.equal(lines[0], '创建被拒：内置技能只读：code-change（ASSET_READONLY）');
  assert.equal(fs.existsSync(path.join(root, '.orch', 'skills', 'code-change')), false);
  assert.deepEqual(sha256Assets(), before, 'assets/** untouched');
});

test('AC-58: project twin refuses without --force and is overwritten with it', async () => {
  const root = makeProject();
  const twin = copyBuiltinSkill(root, 'code-change');
  const original = fs.readFileSync(twin);
  const before = sha256Assets();
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'code-change', '--name', '冒名', '--summary', '占位']), 1);
  assert.equal(lines[0], '已存在同名项目技能：.orch/skills/code-change/SKILL.md（加 --force 覆盖）');
  assert.deepEqual(fs.readFileSync(twin), original, 'twin unchanged without --force');

  assert.equal(await run(['skill', 'create', 'code-change', '--name', '改名', '--summary', '新摘要', '--force']), 0);
  assert.notDeepEqual(fs.readFileSync(twin), original, '--force overwrites the project twin');
  assert.ok(fs.readFileSync(twin, 'utf8').includes('name: 改名'));
  assert.deepEqual(sha256Assets(), before, 'assets/** untouched');
});

// ---------------------------------------------------------------------------
// AC-59: the three value/asset error paths
// ---------------------------------------------------------------------------

test('AC-59: bad --applies-to group exits 2 with the usage block, nothing lands', async () => {
  const root = makeProject();
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote2', '--name', '坏组', '--summary', 'x', '--applies-to', 'nope']), 2);
  const block = lines[0].split('\n');
  assert.equal(block.length, 26);
  assert.ok(block.at(-1).includes('适用分组取值非法：nope'), block.at(-1));
  assert.equal(fs.existsSync(path.join(root, '.orch', 'skills', 'quote2')), false);
});

test('AC-59: missing --summary is caught in parseArgs, exit 2 before any file', async () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'empty.md'), '', 'utf8');
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote3', '--name', '缺摘要', '--body-file', 'empty.md']), 2);
  const block = lines[0].split('\n');
  assert.equal(block.length, 26);
  assert.equal(block.at(-1), '  （skill create 需要 --summary）');
  assert.equal(fs.existsSync(path.join(root, '.orch', 'skills', 'quote3')), false);
});

test('AC-59: an empty body file is an asset problem, exit 1 and nothing lands', async () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'empty.md'), '\n', 'utf8');
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote4', '--name', '空正文', '--summary', 'x', '--body-file', 'empty.md']), 1);
  assert.equal(lines[0], '创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）');
  assert.equal(fs.existsSync(path.join(root, '.orch', 'skills', 'quote4')), false);
});

// ---------------------------------------------------------------------------
// AC-45 / AC-46: package boundaries
// ---------------------------------------------------------------------------

test('AC-45: read-only skill commands never create .orch nor a client', async () => {
  const root = makeProject();
  const { run, created } = harness({ cwd: root });

  assert.equal(await run(['skill', 'list']), 0);
  assert.equal(await run(['skill', 'show', 'code-change']), 0);
  assert.equal(await run(['skill', 'validate']), 0);

  assert.deepEqual(created, []);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
});

test('AC-46: write commands only land under .orch, never touch assets', async () => {
  const root = makeProject();
  fs.writeFileSync(path.join(root, 'body.md'), '正文。\n', 'utf8');
  const before = sha256Assets();
  const { run, created } = harness({ cwd: root });

  assert.equal(await run(['skill', 'create', 'quote', '--name', '引用规范', '--summary', '给结论配上可核对的出处']), 0);
  assert.equal(await run(['skill', 'export', 'quote', '--out', 'exports/quote.md']), 0);
  assert.equal(await run(['skill', 'import', 'exports/quote.md', '--force']), 0);

  assert.deepEqual(created, [], 'no client is started by write commands');
  assert.equal(fs.existsSync(path.join(root, '.orch', 'core.json')), false, 'write commands never connect the core');
  assert.equal(fs.existsSync(path.join(root, '.orch', 'skills', 'quote', 'SKILL.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'exports', 'quote.md')), true);
  assert.deepEqual(sha256Assets(), before, 'assets/** sha256 manifest unchanged');
});
