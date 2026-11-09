/**
 * I1.6 WP-6 tests: the role write surface plus the AC-48 ten-form regression.
 *
 * Scope of this file (everything else belongs to WP-11 / WP-7 suites):
 * - AC-48: the ten I1.5 `role` command forms stay byte-identical, with the two
 *   D-7b-authorized `可唤醒` lines (researcher → writer, writer → editor, reviewer)
 *   pinned as the only exceptions. JSON forms stay untouched (`toRoleJson()` has
 *   no wake field).
 * - `src/registry/asset-write.js` unit contracts (split doc 2.8): C-07 key order,
 *   inline arrays, the `summary : ''` trick, `serializeSkill` / `serializeWorkflow`
 *   layouts and `atomicWrite` atomicity (no `.tmp` survives a failure).
 * - Write-command ACs: AC-01..AC-04 (create), AC-05 / AC-09 / AC-56 (edit),
 *   AC-07 / AC-08 / AC-55 / AC-58 (export / import), AC-10 / AC-57 (diff) and the
 *   AC-11 CLI counters (31/16/10/invalid 5) that only the CLI layer can produce.
 *
 * Harness mirrors `test/wp11/cli-role.test.js`: `main` is called in-process with an
 * `out` sink and a `cwd`; no process spawns and no core starts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { main } from '../../src/cli/main.js';
import { USAGE_LINES } from '../../src/cli/labels.js';
import {
  serializeRole,
  serializeSkill,
  serializeWorkflow,
  atomicWrite
} from '../../src/registry/asset-write.js';

const tempRoots = [];

function makeProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-rw-'));
  tempRoots.push(root);
  for (const [relative, content] of Object.entries(files || {})) {
    const abs = path.join(root, relative);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return root;
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function harness({ cwd }) {
  const lines = [];
  const run = async (argv) =>
    main(argv, { cwd, out: (line) => lines.push(line), createClient: () => null });
  return { run, lines };
}

/** JSON.parse of the harness lines re-joined (every JSON command prints one block). */
function jsonOf(lines) {
  return JSON.parse(lines.join('\n'));
}

/** Snapshot and clear the sink so one harness can serve several commands. */
function takeLines(h) {
  const snapshot = h.lines.slice();
  h.lines.length = 0;
  return snapshot;
}

const ROLE_TOP_KEYS = [
  'id',
  'name',
  'group',
  'groupLabel',
  'artifactType',
  'sideEffect',
  'skills',
  'maxConcurrentSessions',
  'source',
  'file'
];

const EXPECTED_LIST = [
  '角色 16 个（内置 16 · 项目 0）',
  '- arbiter 裁决者 · 通用协调 · report · none · 技能 1 · 并发 1',
  '- coordinator 协调者 · 通用协调 · report · none · 技能 1 · 并发 1',
  '- planner 规划者 · 通用协调 · report · read · 技能 2 · 并发 1',
  '- summarizer 汇总者 · 通用协调 · report · read · 技能 1 · 并发 2',
  '- worker 执行者 · 通用协调 · document · write · 技能 0 · 并发 1',
  '- data-analyst 数据分析师 · 研究分析 · dataset · write · 技能 2 · 并发 2',
  '- fact-checker 事实核查员 · 研究分析 · report · read · 技能 1 · 并发 1',
  '- researcher 研究员 · 研究分析 · report · write · 技能 1 · 并发 1',
  '- editor 编辑 · 内容创作 · document · write · 技能 2 · 并发 1',
  '- reviewer 审核者 · 内容创作 · document · read · 技能 1 · 并发 1',
  '- writer 撰写者 · 内容创作 · document · write · 技能 1 · 并发 2',
  '- code-reviewer 代码审查 · 编码工程 · code · read · 技能 1 · 并发 1',
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '- tester 测试 · 编码工程 · code · exec · 技能 1 · 并发 1',
  '- compliance-reviewer 合规审查者 · 业务运营 · report · read · 技能 1 · 并发 1',
  '- requirement-clarifier 需求澄清者 · 业务运营 · document · write · 技能 2 · 并发 1'
];

const SHOW_DEVELOPER = [
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '  职责：按任务修改代码，交出声明的产物文件',
  '  技能：code-change, test-run',
  '  工具：read, write, edit, bash',
  '  可唤醒：tester',
  '  来源：内置 assets/roles/developer.yaml'
];

const SHOW_RESEARCHER = [
  '- researcher 研究员 · 研究分析 · report · write · 技能 1 · 并发 1',
  '  职责：围绕问题收集资料，写出带出处的调研结论',
  '  技能：research-brief',
  '  工具：read, write',
  '  可唤醒：writer',
  '  来源：内置 assets/roles/researcher.yaml'
];

const SHOW_WRITER = [
  '- writer 撰写者 · 内容创作 · document · write · 技能 1 · 并发 2',
  '  职责：依据调研结论写出结构完整的文档初稿',
  '  技能：doc-draft',
  '  工具：read, write, edit',
  '  可唤醒：editor, reviewer',
  '  来源：内置 assets/roles/writer.yaml'
];

// ---------------------------------------------------------------------------
// AC-48: the ten forms
// ---------------------------------------------------------------------------

test('AC-48: role list and role show developer / researcher / writer keep the I1.5 text, with only the two D-7b wake lines new', async () => {
  const root = makeProject();
  const h = harness({ cwd: root });

  assert.equal(await h.run(['role', 'list']), 0);
  assert.deepEqual(takeLines(h), EXPECTED_LIST);

  assert.equal(await h.run(['role', 'show', 'developer']), 0);
  assert.deepEqual(takeLines(h), SHOW_DEVELOPER);

  assert.equal(await h.run(['role', 'show', 'researcher']), 0);
  assert.deepEqual(takeLines(h), SHOW_RESEARCHER);

  assert.equal(await h.run(['role', 'show', 'writer']), 0);
  assert.deepEqual(takeLines(h), SHOW_WRITER);

  assert.equal(await h.run(['role', 'validate']), 0);
  assert.deepEqual(takeLines(h), ['校验资产 26 个：全部通过（角色 16 · 技能 10）']);
});

test('AC-48: the JSON forms carry the 10-key toRoleJson payload and no wake field', async () => {
  const root = makeProject();
  const h = harness({ cwd: root });

  assert.equal(await h.run(['role', 'list', '--format', 'json']), 0);
  const listed = jsonOf(takeLines(h));
  assert.deepEqual(Object.keys(listed), ['counts', 'groups', 'roles']);
  assert.deepEqual(listed.counts, { total: 16, builtin: 16, project: 0, invalid: 0 });
  assert.equal(listed.roles.length, 16);
  for (const role of listed.roles) assert.deepEqual(Object.keys(role), ROLE_TOP_KEYS);

  assert.equal(await h.run(['role', 'show', 'developer', '--format', 'json']), 0);
  const shown = jsonOf(takeLines(h));
  assert.deepEqual(Object.keys(shown), ['role', 'instance', 'roleInstance']);
  assert.deepEqual(Object.keys(shown.role), ROLE_TOP_KEYS);
  assert.ok(!('wake' in shown.role) && !('wakeAllow' in shown.role));

  assert.equal(await h.run(['role', 'show', 'researcher', '--format', 'json']), 0);
  const researcher = jsonOf(takeLines(h));
  assert.deepEqual(Object.keys(researcher.role), ROLE_TOP_KEYS);
  assert.equal(researcher.role.id, 'researcher');
  assert.ok(!('wake' in researcher.role) && !('wakeAllow' in researcher.role));

  assert.equal(await h.run(['role', 'show', 'writer', '--format', 'json']), 0);
  const writer = jsonOf(takeLines(h));
  assert.deepEqual(Object.keys(writer.role), ROLE_TOP_KEYS);
  assert.equal(writer.role.id, 'writer');
  assert.ok(!('wake' in writer.role) && !('wakeAllow' in writer.role));

  assert.equal(await h.run(['role', 'validate', '--format', 'json']), 0);
  const validated = jsonOf(takeLines(h));
  assert.deepEqual(Object.keys(validated), ['counts', 'errors']);
  assert.deepEqual(validated.counts, {
    assets: 26,
    roles: 16,
    skills: 10,
    builtin: 26,
    project: 0,
    invalid: 0
  });
  assert.deepEqual(validated.errors, []);
});

// ---------------------------------------------------------------------------
// asset-write unit contracts (split doc 2.8)
// ---------------------------------------------------------------------------

test('serializeRole: C-07 key order, inline arrays and absent optional keys', () => {
  const text = serializeRole({
    schema: 'role/v1',
    id: 'lead-dev',
    name: '首席开发',
    group: 'coding',
    summary: 'desc',
    artifact_type: 'code',
    side_effect: 'write',
    derived_from: 'developer',
    skills: ['code-change', 'test-run'],
    tools: ['read', 'write', 'edit', 'bash'],
    wake_allow: ['tester'],
    max_concurrent_sessions: 1
  });
  assert.deepEqual(text.split('\n'), [
    'schema: role/v1',
    'id: lead-dev',
    'name: 首席开发',
    'group: coding',
    'summary: desc',
    'artifact_type: code',
    'side_effect: write',
    'derived_from: developer',
    'skills: [code-change, test-run]',
    'tools: [read, write, edit, bash]',
    'wake_allow: [tester]',
    'max_concurrent_sessions: 1',
    ''
  ]);
});

test('serializeRole: quoting, empty arrays and the summary : \'\' trick', () => {
  const text = serializeRole({
    id: 'q',
    summary: '',
    tools: [],
    wake_allow: ['a: b'],
    name: ' 引子 '
  });
  const lines = text.split('\n');
  assert.equal(lines[0], 'id: q');
  assert.ok(lines.includes("summary : ''"), 'summary stays loadable while `summary:` does not match');
  assert.ok(!text.includes('summary:'));
  assert.ok(lines.includes('tools: []'));
  assert.ok(lines.includes('wake_allow: ["a: b"]'));
  assert.ok(lines.includes('name: " 引子 "'));
});

test('serializeRole: camelCase aliases are accepted and numbers render bare', () => {
  const text = serializeRole({
    schema: 'role/v1',
    id: 'al',
    name: '别名',
    group: 'ops',
    summary: 's',
    artifactType: 'report',
    sideEffect: 'none',
    maxConcurrentSessions: 2
  });
  assert.ok(text.includes('artifact_type: report'));
  assert.ok(text.includes('side_effect: none'));
  assert.ok(text.includes('max_concurrent_sessions: 2'));
});

test('serializeSkill: front matter order and a single trailing newline on the body', () => {
  const text = serializeSkill(
    {
      schema: 'skill/v1',
      id: 'doc-draft',
      name: '文档起草',
      summary: 's',
      applies_to: ['writing'],
      commands: []
    },
    '正文\n没有结尾换行'
  );
  assert.deepEqual(text.split('\n'), [
    '---',
    'schema: skill/v1',
    'id: doc-draft',
    'name: 文档起草',
    'summary: s',
    'applies_to: [writing]',
    'commands: []',
    '---',
    '正文',
    '没有结尾换行',
    ''
  ]);
});

test('serializeWorkflow: block-sequence nodes and edges, edge defaults omitted', () => {
  const text = serializeWorkflow({
    schema: 'workflow/v1',
    id: 'solo',
    name: '单链',
    entry: 'T-001',
    terminal: 'T-002',
    nodes: [
      { id: 'T-001', node_type: 'role', role: 'scout', outputs: ['notes'] },
      { id: 'T-002', node_type: 'role', role: 'scribe', inputs: ['notes'] }
    ],
    edges: [
      { from: 'T-001', to: 'T-002', kind: 'forward', when: 'always', join: 'all' },
      {
        from: 'T-001',
        to: 'T-002',
        map: [{ from: 'T-001.notes', to: 'notes' }]
      }
    ]
  });
  assert.deepEqual(text.split('\n'), [
    'schema: workflow/v1',
    'id: solo',
    'name: 单链',
    'entry: T-001',
    'terminal: T-002',
    'nodes:',
    '  - id: T-001',
    '    node_type: role',
    '    role: scout',
    '    outputs: [notes]',
    '  - id: T-002',
    '    node_type: role',
    '    role: scribe',
    '    inputs: [notes]',
    'edges:',
    '  - from: T-001',
    '    to: T-002',
    '  - from: T-001',
    '    to: T-002',
    '    map:',
    '      - from: T-001.notes',
    '        to: notes',
    ''
  ]);
});

test('atomicWrite: lands the text, creates the parent directory and leaves no .tmp', async () => {
  const root = makeProject();
  const target = path.join(root, '.orch', 'skills', 'new-skill', 'SKILL.md');
  const result = await atomicWrite({ target, text: 'hello\n' });
  assert.deepEqual(result, { ok: true });
  assert.equal(fs.readFileSync(target, 'utf8'), 'hello\n');
  const leftovers = fs.readdirSync(path.dirname(target)).filter((name) => name.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('atomicWrite: a failure keeps the target untouched and cleans the temp file', async () => {
  const root = makeProject();
  // `blocker` is a file, so creating the directory `blocker/inner` must fail.
  fs.writeFileSync(path.join(root, 'blocker'), 'x', 'utf8');
  const result = await atomicWrite({ target: path.join(root, 'blocker', 'inner', 'r.yaml'), text: 'y\n' });
  assert.deepEqual(result, { ok: false, code: 'ASSET_WRITE_FAILED' });
  assert.equal(fs.readFileSync(path.join(root, 'blocker'), 'utf8'), 'x');
  assert.deepEqual(fs.readdirSync(root).filter((name) => name.endsWith('.tmp')), []);
});

// ---------------------------------------------------------------------------
// AC-01..AC-04: role create
// ---------------------------------------------------------------------------

test('AC-01: create prints exactly three lines and registers the project role', async () => {
  const root = makeProject();
  const h = harness({ cwd: root });
  assert.equal(
    await h.run([
      'role',
      'create',
      'lead-dev',
      '--name',
      '首席开发',
      '--group',
      'coding',
      '--artifact-type',
      'code',
      '--side-effect',
      'write',
      '--skills',
      'code-change,test-run'
    ]),
    0
  );
  assert.deepEqual(takeLines(h), [
    '已创建项目角色：.orch/roles/lead-dev.yaml',
    '- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1',
    '校验：通过'
  ]);
  assert.ok(fs.existsSync(path.join(root, '.orch', 'roles', 'lead-dev.yaml')));
  const text = fs.readFileSync(path.join(root, '.orch', 'roles', 'lead-dev.yaml'), 'utf8');
  assert.ok(text.startsWith('schema: role/v1\n'));
  assert.ok(text.includes('max_concurrent_sessions: 1'));

  assert.equal(await h.run(['role', 'list', '--format', 'json']), 0);
  const listed = jsonOf(takeLines(h));
  assert.equal(listed.counts.project, 1);
  assert.equal(listed.counts.total, 17);
  assert.equal(listed.roles.find((role) => role.id === 'lead-dev').source, 'project');
});

test('AC-02: create without the required flags prints the usage block plus one reason line and exits 2', async () => {
  const root = makeProject();
  const h = harness({ cwd: root });

  assert.equal(await h.run(['role', 'create', 'lead-dev']), 2);
  let block = h.lines[0].split('\n');
  assert.equal(block.length, 26);
  assert.equal(block[25], '  （role create 需要 --name）');

  assert.equal(await h.run(['role', 'create', 'lead-dev', '--group', 'coding']), 2);
  block = h.lines[1].split('\n');
  assert.equal(block[25], '  （role create 需要 --name）');

  assert.equal(
    await h.run([
      'role',
      'create',
      'lead-dev',
      '--name',
      '首席开发',
      '--group',
      'coding',
      '--artifact-type',
      'code'
    ]),
    2
  );
  block = h.lines[2].split('\n');
  assert.equal(block[25], '  （role create 需要 --side-effect）');

  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  assert.equal(USAGE_LINES.length, 25);
});

test('AC-03: an existing target is refused until --force overwrites it', async () => {
  const root = makeProject();
  const create = [
    'role',
    'create',
    'lead-dev',
    '--name',
    '首席开发',
    '--group',
    'coding',
    '--artifact-type',
    'code',
    '--side-effect',
    'write'
  ];
  const first = harness({ cwd: root });
  assert.equal(await first.run(create), 0);
  const target = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
  const before = fs.readFileSync(target, 'utf8');

  const clash = harness({ cwd: root });
  assert.equal(await clash.run([...create, '--name', '另一个名字']), 1);
  assert.deepEqual(clash.lines, ['已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）']);
  assert.equal(fs.readFileSync(target, 'utf8'), before);
  assert.equal(fs.readFileSync(target, 'utf8').includes('另一个名字'), false);

  const forced = harness({ cwd: root });
  assert.equal(await forced.run([...create, '--name', '另一个名字', '--force']), 0);
  assert.equal(forced.lines[0], '已创建项目角色：.orch/roles/lead-dev.yaml');
  assert.equal(forced.lines[1], '- lead-dev 另一个名字 · 编码工程 · code · write · 技能 0 · 并发 1');
  assert.equal(fs.readFileSync(target, 'utf8').includes('另一个名字'), true);
});

test('AC-04: --from derive inherits everything, defaults the name to 开发（派生） and adds the derive line', async () => {
  const root = makeProject();
  const h = harness({ cwd: root });
  assert.equal(await h.run(['role', 'create', 'lead-dev', '--from', 'developer', '--skills', 'test-run']), 0);
  assert.deepEqual(h.lines, [
    '已创建项目角色：.orch/roles/lead-dev.yaml',
    '- lead-dev 开发（派生） · 编码工程 · code · write · 技能 1 · 并发 1',
    '校验：通过'
  ]);

  const text = fs.readFileSync(path.join(root, '.orch', 'roles', 'lead-dev.yaml'), 'utf8');
  assert.ok(text.includes('derived_from: developer'));
  assert.ok(text.includes('name: 开发（派生）'));
  assert.ok(text.includes('tools: [read, write, edit, bash]'));
  assert.ok(text.includes('wake_allow: [tester]'));

  const show = harness({ cwd: root });
  assert.equal(await show.run(['role', 'show', 'lead-dev']), 0);
  assert.equal(show.lines.length, 7);
  assert.equal(show.lines[6], '  派生自：developer');

  const json = harness({ cwd: root });
  assert.equal(await json.run(['role', 'show', 'lead-dev', '--format', 'json']), 0);
  const shown = jsonOf(json.lines);
  assert.deepEqual(Object.keys(shown.role), ROLE_TOP_KEYS);
  assert.deepEqual(shown.role.skills, ['test-run']);

  const list = harness({ cwd: root });
  assert.equal(await list.run(['role', 'list', '--format', 'json']), 0);
  const role = jsonOf(list.lines).roles.find((entry) => entry.id === 'lead-dev');
  assert.equal(role.maxConcurrentSessions, 1);
  assert.equal(role.artifactType, 'code');
  assert.deepEqual(role.skills, ['test-run']);
});

// ---------------------------------------------------------------------------
// AC-05 / AC-09 / AC-56: role edit
// ---------------------------------------------------------------------------

test('AC-05: editing the skill list updates show, list and validate together', async () => {
  const root = makeProject();
  const setup = harness({ cwd: root });
  await setup.run(['role', 'create', 'lead-dev', '--from', 'developer', '--skills', 'test-run']);

  const edit = harness({ cwd: root });
  assert.equal(await edit.run(['role', 'edit', 'lead-dev', '--set', 'skills=test-run,code-review']), 0);

  const show = harness({ cwd: root });
  assert.equal(await show.run(['role', 'show', 'lead-dev']), 0);
  assert.equal(show.lines[2], '  技能：test-run, code-review');
  takeLines(show);
  assert.equal(await show.run(['role', 'show', 'lead-dev', '--format', 'json']), 0);
  assert.deepEqual(jsonOf(show.lines).role.skills, ['test-run', 'code-review']);

  const list = harness({ cwd: root });
  assert.equal(await list.run(['role', 'list']), 0);
  const row = list.lines.find((line) => line.startsWith('- lead-dev '));
  assert.ok(row.endsWith('· 技能 2 · 并发 1'));

  const validate = harness({ cwd: root });
  assert.equal(await validate.run(['role', 'validate', '--format', 'json']), 0);
  assert.equal(jsonOf(validate.lines).counts.invalid, 0);
});

test('AC-09: project roles edit in place while builtin roles are read-only', async () => {
  const root = makeProject();
  const setup = harness({ cwd: root });
  await setup.run([
    'role',
    'create',
    'lead-dev',
    '--name',
    '首席开发',
    '--group',
    'coding',
    '--artifact-type',
    'code',
    '--side-effect',
    'write'
  ]);
  const builtinPath = path.join(process.cwd(), 'assets', 'roles', 'developer.yaml');
  const developerText = fs.readFileSync(builtinPath, 'utf8');

  const edit = harness({ cwd: root });
  assert.equal(await edit.run(['role', 'edit', 'lead-dev', '--set', 'artifact_type=document']), 0);
  assert.equal(edit.lines.length, 4);
  assert.equal(edit.lines[0], '已更新项目角色：.orch/roles/lead-dev.yaml');
  assert.equal(edit.lines[1], '- lead-dev 首席开发 · 编码工程 · document · write · 技能 0 · 并发 1');
  assert.equal(edit.lines[2], '校验：通过');
  assert.equal(edit.lines[3], '（已按规范格式重写，注释不保留）');
  const rewritten = fs.readFileSync(path.join(root, '.orch', 'roles', 'lead-dev.yaml'), 'utf8');
  assert.equal((rewritten.match(/artifact_type: document/g) ?? []).length, 1);

  const builtin = harness({ cwd: root });
  assert.equal(await builtin.run(['role', 'edit', 'developer', '--set', 'artifact_type=document']), 1);
  assert.deepEqual(builtin.lines, [
    '内置角色不可编辑：先 orch role create <新角色> --from developer'
  ]);
  assert.equal(fs.readFileSync(builtinPath, 'utf8'), developerText);
});

test('AC-56: --set / --unset usage errors leave the file untouched; unsetting summary keeps it loadable', async () => {
  const root = makeProject();
  const setup = harness({ cwd: root });
  await setup.run([
    'role',
    'create',
    'lead-dev',
    '--name',
    '首席开发',
    '--group',
    'coding',
    '--artifact-type',
    'code',
    '--side-effect',
    'write',
    '--skills',
    'code-change,test-run'
  ]);
  const target = path.join(root, '.orch', 'roles', 'lead-dev.yaml');
  const before = fs.readFileSync(target, 'utf8');

  const unknown = harness({ cwd: root });
  assert.equal(await unknown.run(['role', 'edit', 'lead-dev', '--set', 'nope=1']), 2);
  let block = unknown.lines[0].split('\n');
  assert.equal(block.length, 26);
  assert.equal(block[25], '  （未知字段：nope）');
  assert.equal(fs.readFileSync(target, 'utf8'), before);
  assert.equal(before.includes('nope:'), false);

  const unsetName = harness({ cwd: root });
  assert.equal(await unsetName.run(['role', 'edit', 'lead-dev', '--unset', 'name']), 2);
  block = unsetName.lines[0].split('\n');
  assert.equal(block[25], '  （role edit 不能删除必填字段：name）');
  assert.equal(fs.readFileSync(target, 'utf8'), before);

  const edit = harness({ cwd: root });
  assert.equal(await edit.run(['role', 'edit', 'lead-dev', '--set', 'artifact_type=document', '--unset', 'summary']), 0);
  assert.equal(edit.lines.length, 4);
  assert.equal(edit.lines[3], '（已按规范格式重写，注释不保留）');
  const rewritten = fs.readFileSync(target, 'utf8');
  assert.equal((rewritten.match(/artifact_type: document/g) ?? []).length, 1);
  assert.equal((rewritten.match(/summary:/g) ?? []).length, 0);

  const show = harness({ cwd: root });
  assert.equal(await show.run(['role', 'show', 'lead-dev']), 0);
  assert.equal(show.lines[0], '- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1');
  assert.equal(show.lines[1], '  职责：');
});

// ---------------------------------------------------------------------------
// AC-07 / AC-08 / AC-55 / AC-58: role export / import
// ---------------------------------------------------------------------------

test('AC-07: an exported role installs byte-identically into another project', async () => {
  const rootA = makeProject();
  const setup = harness({ cwd: rootA });
  await setup.run(['role', 'create', 'lead-dev', '--from', 'developer', '--skills', 'test-run']);

  const exporter = harness({ cwd: rootA });
  assert.equal(await exporter.run(['role', 'export', 'lead-dev', '--out', 'exports/lead-dev.yaml']), 0);
  assert.deepEqual(exporter.lines, ['已导出角色 lead-dev 到 exports/lead-dev.yaml']);
  const exported = fs.readFileSync(path.join(rootA, 'exports', 'lead-dev.yaml'), 'utf8');
  assert.ok(exported.includes('derived_from: developer'));

  const rootB = makeProject({ 'lead-dev.yaml': exported });
  const importer = harness({ cwd: rootB });
  assert.equal(await importer.run(['role', 'import', 'lead-dev.yaml']), 0);
  assert.deepEqual(importer.lines, [
    '已安装项目角色：.orch/roles/lead-dev.yaml',
    '校验：通过'
  ]);
  assert.equal(
    fs.readFileSync(path.join(rootB, '.orch', 'roles', 'lead-dev.yaml'), 'utf8'),
    exported
  );

  const list = harness({ cwd: rootB });
  assert.equal(await list.run(['role', 'list']), 0);
  assert.equal(list.lines[0], '角色 17 个（内置 16 · 项目 1）');

  const validate = harness({ cwd: rootB });
  assert.equal(await validate.run(['role', 'validate', '--format', 'json']), 0);
  assert.equal(jsonOf(validate.lines).counts.invalid, 0);
});

test('AC-08: imports that fail validation or hit an existing target never land', async () => {
  const root = makeProject({
    'ghost.yaml': [
      'schema: role/v1',
      'id: ghost',
      'name: 悬空',
      'group: coding',
      'summary: 技能不存在',
      'artifact_type: code',
      'side_effect: read',
      'skills: [no-such]',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });
  const setup = harness({ cwd: root });
  await setup.run([
    'role',
    'create',
    'lead-dev',
    '--name',
    '首席开发',
    '--group',
    'coding',
    '--artifact-type',
    'code',
    '--side-effect',
    'write',
    '--skills',
    'test-run'
  ]);
  const leadDev = [
    'schema: role/v1',
    'id: lead-dev',
    'name: 首席开发',
    'group: coding',
    'summary: 合法角色',
    'artifact_type: code',
    'side_effect: write',
    'skills: [test-run]',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(root, 'lead-dev.yaml'), leadDev, 'utf8');
  const before = fs.readdirSync(path.join(root, '.orch', 'roles')).sort();

  const ghost = harness({ cwd: root });
  assert.equal(await ghost.run(['role', 'import', 'ghost.yaml']), 1);
  assert.deepEqual(ghost.lines, ['导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）']);
  assert.equal(fs.existsSync(path.join(root, '.orch', 'roles', 'ghost.yaml')), false);

  const clash = harness({ cwd: root });
  assert.equal(await clash.run(['role', 'import', 'lead-dev.yaml']), 1);
  assert.deepEqual(clash.lines, ['已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）']);
  assert.deepEqual(fs.readdirSync(path.join(root, '.orch', 'roles')).sort(), before);
});

test('AC-55: non-role files are refused with the schema message and never land', async () => {
  const root = makeProject({
    'not-role.yaml': 'id: half\nname: 半份\n',
    'wrong-schema.yaml': [
      'schema: workflow/v1',
      'id: not-a-role',
      'name: 冒名',
      'entry: T-001',
      'terminal: T-001',
      'nodes: []',
      ''
    ].join('\n')
  });

  const first = harness({ cwd: root });
  assert.equal(await first.run(['role', 'import', 'not-role.yaml']), 1);
  assert.deepEqual(first.lines, ['导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）']);

  const second = harness({ cwd: root });
  assert.equal(await second.run(['role', 'import', 'wrong-schema.yaml']), 1);
  assert.deepEqual(second.lines, ['导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）']);

  assert.equal(fs.existsSync(path.join(root, '.orch', 'roles')), false);
  const list = harness({ cwd: root });
  assert.equal(await list.run(['role', 'list', '--format', 'json']), 0);
  assert.equal(jsonOf(list.lines).counts.total, 16);
});

test('AC-58: importing a file that claims a builtin id is refused and assets stay untouched', async () => {
  const repoAssets = path.join(process.cwd(), 'assets', 'roles', 'developer.yaml');
  const original = fs.readFileSync(repoAssets, 'utf8');
  const root = makeProject({ 'developer.yaml': original });

  const importer = harness({ cwd: root });
  assert.equal(await importer.run(['role', 'import', 'developer.yaml']), 1);
  assert.deepEqual(importer.lines, ['导入被拒：内置角色只读：developer（ASSET_READONLY）']);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  assert.equal(fs.readFileSync(repoAssets, 'utf8'), original);
});

// ---------------------------------------------------------------------------
// AC-10 / AC-57: role diff
// ---------------------------------------------------------------------------

test('AC-10: diff against the default builtin baseline lists the three changed rows', async () => {
  const root = makeProject();
  const setup = harness({ cwd: root });
  await setup.run(['role', 'create', 'lead-dev', '--from', 'developer', '--skills', 'test-run']);

  const diff = harness({ cwd: root });
  assert.equal(await diff.run(['role', 'diff', 'lead-dev']), 0);
  assert.deepEqual(diff.lines, [
    '对比角色 lead-dev（项目）与基线 developer（内置）',
    '+ derived_from：developer',
    '~ name：开发 → 开发（派生）',
    '~ skills：code-change, test-run → test-run',
    '差异 3 项'
  ]);

  const json = harness({ cwd: root });
  assert.equal(await json.run(['role', 'diff', 'lead-dev', '--format', 'json']), 0);
  const payload = jsonOf(json.lines);
  assert.deepEqual(Object.keys(payload), ['base', 'target', 'changes']);
  assert.equal(payload.changes.length, 3);
  assert.deepEqual(
    [...new Set(payload.changes.map((change) => change.kind))].sort(),
    ['added', 'changed']
  );
  for (const change of payload.changes) {
    assert.deepEqual(Object.keys(change), ['field', 'kind', 'base', 'target']);
    assert.notEqual(change.field, 'id');
  }
});

test('AC-10: a field-identical copy reports 无差异 and the JSON has no id row', async () => {
  const builtin = fs.readFileSync(
    path.join(process.cwd(), 'assets', 'roles', 'developer.yaml'),
    'utf8'
  );
  const text = builtin.replace(/^id: developer$/m, 'id: my-dev');
  const root = makeProject({ '.orch/roles/my-dev.yaml': text });

  const diff = harness({ cwd: root });
  assert.equal(await diff.run(['role', 'diff', 'my-dev', '--against', 'developer']), 0);
  assert.equal(diff.lines[diff.lines.length - 1], '无差异');

  const json = harness({ cwd: root });
  assert.equal(await json.run(['role', 'diff', 'my-dev', '--against', 'developer', '--format', 'json']), 0);
  const payload = jsonOf(json.lines);
  assert.deepEqual(Object.keys(payload), ['base', 'target', 'changes']);
  assert.equal(payload.changes.some((change) => change.field === 'id'), false);
});

test('AC-57: editing a missing role and diffing without a baseline are refused', async () => {
  const root = makeProject({
    '.orch/roles/my-role.yaml': [
      'schema: role/v1',
      'id: my-role',
      'name: 自有',
      'group: ops',
      'summary: 没有同名内置',
      'artifact_type: report',
      'side_effect: none',
      'skills: []',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });

  const ghost = harness({ cwd: root });
  assert.equal(await ghost.run(['role', 'edit', 'ghost-id', '--set', 'summary=x']), 1);
  assert.deepEqual(ghost.lines, ['找不到角色：ghost-id', '可用角色：执行 orch role list 查看']);

  const noBase = harness({ cwd: root });
  assert.equal(await noBase.run(['role', 'diff', 'my-role']), 1);
  assert.deepEqual(noBase.lines, ['缺少对比基线：my-role（用 --against 指定内置角色或文件）']);

  const against = harness({ cwd: root });
  assert.equal(await against.run(['role', 'diff', 'my-role', '--against', 'developer']), 0);
  const last = against.lines[against.lines.length - 1];
  assert.ok(last === '无差异' || /^差异 \d+ 项$/.test(last));
  if (/^差异 (\d+) 项$/.test(last)) {
    const json = harness({ cwd: root });
    await json.run(['role', 'diff', 'my-role', '--against', 'developer', '--format', 'json']);
    const payload = jsonOf(json.lines);
    assert.equal(Number(last.slice(3, -2)), payload.changes.length);
  }
});

// ---------------------------------------------------------------------------
// AC-11: the CLI-layer counters
// ---------------------------------------------------------------------------

const BAD_ROLES = {
  '.orch/roles/m1.yaml': [
    'schema: role/v1',
    'id: m1',
    'name: 缺数',
    'group: coding',
    'summary: 缺 max_concurrent_sessions',
    'artifact_type: code',
    'side_effect: read',
    'skills: []',
    ''
  ].join('\n'),
  '.orch/roles/s1.yaml': [
    'schema: role/v1',
    'id: s1',
    'name: 引用悬空',
    'group: coding',
    'summary: 引用不存在的技能',
    'artifact_type: code',
    'side_effect: read',
    'skills: [no-such]',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n'),
  '.orch/roles/c1.yaml': [
    'schema: role/v1',
    'id: c1',
    'name: 契约断链',
    'group: coding',
    'summary: 输入没来源',
    'artifact_type: code',
    'side_effect: read',
    'skills: []',
    'inputs: [brief]',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n'),
  '.orch/roles/p1.yaml': [
    'schema: role/v1',
    'id: p1',
    'name: 权限不符',
    'group: coding',
    'summary: read 带写工具',
    'artifact_type: code',
    'side_effect: read',
    'skills: []',
    'tools: [write]',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n'),
  '.orch/roles/d1.yaml': [
    'schema: role/v1',
    'id: d1',
    'name: 派生成环',
    'group: coding',
    'summary: 自己派生自己',
    'artifact_type: code',
    'side_effect: read',
    'skills: []',
    'derived_from: d1',
    'max_concurrent_sessions: 1',
    ''
  ].join('\n'),
  '.orch/workflows/use-c.yaml': [
    'schema: workflow/v1',
    'id: use-c',
    'name: 引用 c1',
    'entry: T-001',
    'terminal: T-002',
    'nodes:',
    '  - id: T-001',
    '    node_type: role',
    '    role: c1',
    '  - id: T-002',
    '    node_type: role',
    '    role: reviewer',
    'edges:',
    '  - from: T-001',
    '    to: T-002',
    ''
  ].join('\n')
};

test('AC-11: five bad roles yield the five reason codes and the 31/16/10/invalid-5 counters', async () => {
  const root = makeProject(BAD_ROLES);
  const h = harness({ cwd: root });
  assert.equal(await h.run(['role', 'validate', '--format', 'json']), 1);
  const payload = jsonOf(h.lines);

  assert.deepEqual(payload.counts, {
    assets: 31,
    roles: 16,
    skills: 10,
    builtin: 26,
    project: 3,
    invalid: 5
  });
  assert.deepEqual(
    payload.errors.map((error) => error.code).sort(),
    [
      'ROLE_CONTRACT_UNBOUND',
      'ROLE_DERIVE_CYCLE',
      'ROLE_PERMISSION_MISMATCH',
      'ROLE_SCHEMA_MISSING',
      'ROLE_SKILL_NOT_FOUND'
    ]
  );
  for (const error of payload.errors) {
    assert.deepEqual(Object.keys(error), ['code', 'file', 'scope', 'field', 'line', 'detail']);
  }
  const contract = payload.errors.find((error) => error.code === 'ROLE_CONTRACT_UNBOUND');
  assert.equal(contract.file, 'roles/c1.yaml');
  assert.equal(contract.detail, '契约不连通：brief 没有来源');

  const text = harness({ cwd: root });
  assert.equal(await text.run(['role', 'validate']), 1);
  assert.equal(text.lines[0], '校验资产 31 个：5 个不合法');
});
