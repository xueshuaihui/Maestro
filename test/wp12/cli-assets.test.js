/**
 * I1.6 WP-5 contract tests for the CLI asset families (split doc 2.8 / D-10 file 8).
 *
 * `main` is imported directly and given an `out` sink plus a `cwd`, so no process is
 * spawned and no core is started; exit codes are the returned numbers (D-10:1683).
 * Covered here: the 25-line usage block with the byte-frozen first 8 lines (AC-43),
 * the 12-case family usage-error matrix (AC-44), the two-tier `role create` checks
 * (AC-02 / AC-54), the D-6 whitelist matrix, the read-only discipline (AC-45), the
 * unchanged `run` template preflight (AC-47), zero runtime dependencies (AC-52) and
 * the byte-level render shapes of A-5 / A-6 / A-8 / A-10 / A-11.
 *
 * Interim note: `skill` / `workflow` dispatch dynamic-imports `skills.js` (WP-7) and
 * `workflows.js` (WP-8), which do not exist yet; a valid parse that reaches dispatch
 * exits 2 with `skill 命令尚未实现` / `workflow 命令尚未实现`. Every AC-44 case is
 * caught in `parseArgs` before dispatch, so the full matrix is asserted now.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { exitCodeFor, main, parseArgs } from '../../src/cli/main.js';
import { USAGE_LINES } from '../../src/cli/labels.js';
import {
  renderRoleDiff,
  renderSkillList,
  renderSkillShow,
  renderSkillValidate,
  renderWorkflowDiff,
  renderWorkflowList,
  renderWorkflowShow,
  renderWorkflowValidate,
  renderWorkflowDryRun,
  renderUsage,
} from '../../src/cli/render.js';

const tempRoots = [];

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-assets-'));
  tempRoots.push(root);
  return root;
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

/** One empty project root shared by the read-only cases (same trick as wp11). */
let sharedCleanRoot = null;

function cleanProject() {
  if (sharedCleanRoot === null) sharedCleanRoot = makeProject();
  return sharedCleanRoot;
}

function harness({ cwd } = {}) {
  const root = cwd ?? cleanProject();
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

/** The usage block as a line array; the whole block arrives as one `out` string. */
function usageBlock(lines) {
  assert.equal(lines.length, 1, 'renderUsage prints the whole block as one string');
  return lines[0].split('\n');
}

// ---------------------------------------------------------------------------
// A-12 verbatim: the 25-line usage block (first 8 lines are the I1.5 original)
// ---------------------------------------------------------------------------

const USAGE_I15_FIRST_8 = [
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
  '  orch status [--instance <实例号>] [--events]',
  '  orch cancel --instance <实例号>',
  '  orch core stop',
  '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
  '  orch role show <角色> [--instance <实例号>] [--format text|json]',
  '  orch role validate [<角色>] [--format json]'
];

const A12_LINES = [
  ...USAGE_I15_FIRST_8,
  '  orch role create <角色> [--from <角色>] --name <中文名|继承> --group <组|继承> --artifact-type <类型|继承> --side-effect <等级|继承> [--summary <摘要>] [--skills <a,b>] [--tools <a,b>] [--wake-allow <a,b>] [--max-concurrent <1-5>] [--force]',
  '  orch role edit <角色> [--set <键=值>]... [--unset <键>]...',
  '  orch role export <角色> [--out <文件>]',
  '  orch role import <文件> [--force]',
  '  orch role diff <角色> [--against <内置角色|文件>] [--format text|json]',
  '  orch skill list [--group <组>] [--format text|json]',
  '  orch skill show <技能> [--format text|json]',
  '  orch skill create <技能> --name <中文名> --summary <摘要> [--applies-to <a,b>] [--commands <命令>] [--body-file <文件>] [--force]',
  '  orch skill validate [<技能>] [--format json]',
  '  orch skill export <技能> [--out <文件>]',
  '  orch skill import <文件|目录> [--force]',
  '  orch workflow list [--format text|json]',
  '  orch workflow show <工作流> [--format text|json]',
  '  orch workflow create <工作流> --name <中文名> [--from <工作流>] [--force]',
  '  orch workflow validate [<工作流>] [--format json]',
  '  orch workflow diff <工作流> [--against <内置工作流|文件>] [--format text|json]',
  '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]'
];

test('AC-43: USAGE_LINES is the 25 A-12 lines with the first 8 byte-identical to I1.5', () => {
  assert.equal(USAGE_LINES.length, 25);
  assert.deepEqual([...USAGE_LINES], A12_LINES);
  assert.deepEqual(USAGE_LINES.slice(0, 8), USAGE_I15_FIRST_8);
});

test('AC-43: a usage error prints 25 lines plus one reason line and exits 2', async () => {
  const { run, lines } = harness();
  const code = await run(['role', 'bogus']);

  assert.equal(code, 2);
  const block = usageBlock(lines);
  assert.equal(block.length, 26, 'twenty-five usage lines plus the reason line');
  assert.deepEqual(block.slice(0, 25), [...USAGE_LINES]);
  assert.equal(block[25], '  （未知的 role 子命令：bogus）');
});

test('renderUsage without a reason stays exactly 25 lines', () => {
  assert.equal(renderUsage().split('\n').length, 25);
  assert.equal(renderUsage('任意原因').split('\n').length, 26);
});

// ---------------------------------------------------------------------------
// AC-44: three families x four error classes, all exit 2 with distinct reasons
// ---------------------------------------------------------------------------

const AC44_CASES = [
  [['role', 'bogus'], '未知的 role 子命令：bogus'],
  [['skill', 'bogus'], '未知的 skill 子命令：bogus'],
  [['workflow', 'bogus'], '未知的 workflow 子命令：bogus'],
  [['role', 'list', '--nope'], '未知参数：--nope'],
  [['skill', 'list', '--nope'], '未知参数：--nope'],
  [['workflow', 'list', '--nope'], '未知参数：--nope'],
  [['role', 'show', 'developer', '--group', 'coding'], '--group 不适用于 role show'],
  [['skill', 'show', 'code-change', '--instance', 'INST-1'], '--instance 不适用于 skill show'],
  [['workflow', 'list', '--group', 'coding'], '--group 不适用于 workflow list'],
  [['role', 'show'], 'role show 需要角色 id'],
  [['skill', 'show'], 'skill show 需要技能 id'],
  [['workflow', 'show'], 'workflow show 需要工作流 id']
];

test('AC-44: the twelve usage errors all exit 2 with their own reason line', async () => {
  const reasons = [];
  for (const [argv, reason] of AC44_CASES) {
    const { run, lines } = harness();
    const code = await run(argv);

    assert.equal(code, 2, argv.join(' '));
    const block = usageBlock(lines);
    assert.equal(block.length, 26, argv.join(' '));
    assert.deepEqual(block.slice(0, 25), [...USAGE_LINES]);
    assert.equal(block[25], `  （${reason}）`, argv.join(' '));
    reasons.push(reason);
  }
  // AC-44's wording classes: `未知参数：--nope` is one shared sentence for the three
  // families by design ("未知参数" has no family placeholder); everything else is
  // family-specific, so exactly ten distinct texts across the twelve runs.
  const unique = new Set(reasons);
  assert.equal(unique.size, 10);
  const repeated = reasons.filter((reason, index) => reasons.indexOf(reason) !== index);
  assert.deepEqual(repeated, ['未知参数：--nope', '未知参数：--nope']);
});

// ---------------------------------------------------------------------------
// AC-02 / AC-54: role create two-tier required flags and value legality
// ---------------------------------------------------------------------------

test('AC-02: role create without --from reports the first missing required flag', async () => {
  const root = makeProject();
  const cases = [
    [['role', 'create', 'lead-dev'], 'role create 需要 --name'],
    [['role', 'create', 'lead-dev', '--group', 'coding'], 'role create 需要 --name'],
    [
      ['role', 'create', 'lead-dev', '--name', '首席开发', '--group', 'coding', '--artifact-type', 'code'],
      'role create 需要 --side-effect'
    ]
  ];
  for (const [argv, reason] of cases) {
    const { run, lines } = harness({ cwd: root });
    const code = await run(argv);

    assert.equal(code, 2, argv.join(' '));
    assert.ok(lines[0].endsWith(`  （${reason}）`), lines[0]);
    assert.equal(fs.existsSync(path.join(root, '.orch')), false, argv.join(' '));
  }
});

test('AC-54: illegal role create values are usage errors listing the legal ones', async () => {
  const root = makeProject();
  const cases = [
    [
      ['role', 'create', 'lead-dev', '--name', '首席开发', '--group', 'nope', '--artifact-type', 'code', '--side-effect', 'write'],
      'role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营'
    ],
    [
      ['role', 'create', 'lead-dev', '--name', '首席开发', '--group', 'coding', '--artifact-type', 'doc', '--side-effect', 'write'],
      'role create 的 --artifact-type 只接受 code/document/dataset/report'
    ],
    [
      ['role', 'create', 'lead-dev', '--name', '首席开发', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'heavy'],
      'role create 的 --side-effect 只接受 none/read/write/exec'
    ]
  ];
  for (const [argv, reason] of cases) {
    const { run, lines } = harness({ cwd: root });
    const code = await run(argv);

    assert.equal(code, 2, argv.join(' '));
    assert.ok(lines[0].endsWith(`  （${reason}）`), lines[0]);
    assert.equal(fs.existsSync(path.join(root, '.orch')), false, argv.join(' '));
  }
});

test('AC-04/BR-38: with --from the four required flags are skippable at parse level', () => {
  const parsed = parseArgs(['role', 'create', 'lead-dev', '--from', 'developer', '--skills', 'test-run']);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, 'role');
  assert.equal(parsed.sub, 'create');
  assert.equal(parsed.positional, 'lead-dev');
  assert.deepEqual(parsed.flags, { from: 'developer', skills: 'test-run' });
});

test('AC-56 groundwork: --set / --unset parse into arrays (D-6 repeatable flags)', () => {
  const parsed = parseArgs(['role', 'edit', 'lead-dev', '--set', 'a=1', '--set', 'b=2', '--unset', 'summary']);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.flags, { set: ['a=1', 'b=2'], unset: ['summary'] });
});

// ---------------------------------------------------------------------------
// D-6: the 18-row per-subcommand whitelist
// ---------------------------------------------------------------------------

/** Minimal argv context per row: positional plus the flags create-time checks need. */
const D6_MATRIX = [
  ['role', 'list', null, ['group', 'instance', 'format']],
  ['role', 'show', 'developer', ['instance', 'format']],
  ['role', 'validate', null, ['format']],
  ['role', 'create', 'lead-dev', ['from', 'name', 'group', 'artifact-type', 'side-effect', 'summary', 'skills', 'tools', 'wake-allow', 'max-concurrent', 'force']],
  ['role', 'edit', 'lead-dev', ['set', 'unset']],
  ['role', 'export', 'lead-dev', ['out']],
  ['role', 'import', 'lead-dev.yaml', ['force']],
  ['role', 'diff', 'lead-dev', ['against', 'format']],
  ['skill', 'list', null, ['group', 'format']],
  ['skill', 'show', 'code-change', ['format']],
  ['skill', 'create', 'quote', ['name', 'summary', 'applies-to', 'commands', 'body-file', 'force']],
  ['skill', 'validate', null, ['format']],
  ['skill', 'export', 'code-change', ['out']],
  ['skill', 'import', 'exports/code-change.md', ['force']],
  ['workflow', 'list', null, ['format']],
  ['workflow', 'show', 'code-loop', ['format']],
  ['workflow', 'create', 'fork', ['name', 'from', 'force']],
  ['workflow', 'validate', null, ['format']],
  ['workflow', 'diff', 'fork', ['against', 'format']],
  ['workflow', 'dry-run', 'doc-fanout', ['task', 'format']]
];

/** One representative legal value per flag; booleans take no value. */
const FLAG_VALUES = {
  group: 'coding',
  instance: 'INST-001',
  format: 'json',
  from: 'developer',
  name: '中文名',
  'artifact-type': 'code',
  'side-effect': 'write',
  summary: '摘要',
  skills: 'code-change,test-run',
  tools: 'read,write',
  'wake-allow': 'tester',
  'max-concurrent': '2',
  set: 'summary=x',
  unset: 'summary',
  out: 'exports/x.yaml',
  against: 'developer',
  'body-file': 'body.md',
  'applies-to': 'coding',
  commands: 'node --test',
  task: '任务说明'
};

function argvFor(family, sub, positional, flag) {
  const argv = [family, sub];
  if (positional !== null) argv.push(positional);
  // Create-time required flags so the value checks never fire on positive cases.
  if (family === 'role' && sub === 'create') {
    argv.push('--name', '中文名', '--group', 'coding', '--artifact-type', 'code', '--side-effect', 'write');
  }
  if (family === 'skill' && sub === 'create') {
    argv.push('--name', '中文名', '--summary', '摘要');
  }
  if (family === 'workflow' && sub === 'create') {
    argv.push('--name', '中文名');
  }
  if (FLAG_VALUES[flag] !== undefined) argv.push(`--${flag}`, FLAG_VALUES[flag]);
  else argv.push(`--${flag}`);
  return argv;
}

test('D-6: every whitelist entry parses cleanly', () => {
  for (const [family, sub, positional, flags] of D6_MATRIX) {
    for (const flag of flags) {
      const parsed = parseArgs(argvFor(family, sub, positional, flag));
      assert.equal(parsed.ok, true, `${family} ${sub} --${flag}: ${parsed.message ?? ''}`);
      assert.equal(parsed.positional ?? null, positional, `${family} ${sub} --${flag}`);
    }
  }
});

test('D-6: a known flag on the wrong subcommand is flagged as not applicable', () => {
  const cases = [
    [['role', 'list', '--against', 'developer'], '--against 不适用于 role list'],
    [['skill', 'show', 'code-change', '--out', 'x.md'], '--out 不适用于 skill show'],
    [['workflow', 'dry-run', 'doc-fanout', '--from', 'code-loop'], '--from 不适用于 workflow dry-run'],
    [['workflow', 'show', 'code-loop', '--task', 'x'], '--task 不适用于 workflow show']
  ];
  for (const [argv, reason] of cases) {
    const parsed = parseArgs(argv);
    assert.equal(parsed.ok, false, argv.join(' '));
    assert.equal(parsed.message, reason, argv.join(' '));
  }
});

test('M-9: --force outside the three families is still an unknown parameter', () => {
  for (const argv of [
    ['status', '--force'],
    ['cancel', '--instance', 'x', '--force'],
    ['core', 'stop', '--force'],
    ['run', '--cwd', '.', '--task', 't', '--force']
  ]) {
    const parsed = parseArgs(argv);
    assert.equal(parsed.ok, false, argv.join(' '));
    assert.equal(parsed.message, '未知参数：--force', argv.join(' '));
  }
});

test('old commands keep their exact parse result key set', () => {
  const parsed = parseArgs(['status', '--instance', 'INST-1']);
  assert.deepEqual(Object.keys(parsed).sort(), ['command', 'flags', 'ok', 'sub']);
  assert.equal('positional' in parsed, false);
});

// ---------------------------------------------------------------------------
// AC-45 / AC-47: read-only discipline and the unchanged run preflight
// ---------------------------------------------------------------------------

test('AC-45: the read-only role commands never create .orch nor a client', async () => {
  const root = makeProject();
  const { run, lines, created } = harness({ cwd: root });

  assert.equal(await run(['role', 'list']), 0);
  assert.equal(await run(['role', 'show', 'developer']), 0);
  assert.equal(await run(['role', 'validate']), 0);

  assert.deepEqual(created, []);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  assert.ok(lines.length > 0);
});

test('AC-45: family read commands stay read-only', async () => {
  const root = makeProject();
  const { run, lines, created } = harness({ cwd: root });

  // WP-7 has landed skills.js (exit 0); WP-8 has not landed workflows.js yet
  // (exit 2 interim). Both paths must still never create .orch nor a client.
  assert.equal(await run(['skill', 'list']), 0);
  assert.ok(lines[0].startsWith('技能 10 个（内置 10 · 项目 0）'), lines[0]);
  assert.equal(await run(['workflow', 'list']), 2);
  assert.ok(lines.at(-1).endsWith('  （workflow 命令尚未实现）'), lines.at(-1));

  assert.deepEqual(created, []);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
});

test('AC-47: run still rejects unknown templates with exit 1 before any client', async () => {
  const root = makeProject();
  const { run, lines, created } = harness({ cwd: root });

  const code = await run(['run', '--cwd', '.', '--task', '写下说明', '--template', 'doc-fanout']);

  assert.equal(code, 1);
  assert.equal(lines[0], '未知模板：doc-fanout');
  assert.deepEqual(created, [], 'the core must not be started');
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
});

test('exitCodeFor keeps the I1.5 mapping for preflight and usage codes', () => {
  assert.equal(exitCodeFor('USAGE'), 2);
  assert.equal(exitCodeFor('REGISTRY_INVALID'), 3);
  assert.equal(exitCodeFor('TEMPLATE_UNKNOWN'), 1);
});

// ---------------------------------------------------------------------------
// AC-52: zero runtime dependencies
// ---------------------------------------------------------------------------

test('AC-52: package.json declares zero runtime dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
});

// ---------------------------------------------------------------------------
// Render shapes: A-5 / A-6 / A-8 / A-9 / A-10 / A-11 (in-memory inputs only)
// ---------------------------------------------------------------------------

test('A-5: renderRoleDiff prints the header, change rows and the count', () => {
  const lines = renderRoleDiff({
    id: 'lead-dev',
    idSource: 'project',
    base: 'developer',
    baseSource: 'builtin',
    changes: [
      { field: 'derived_from', kind: 'added', base: null, target: 'developer' },
      { field: 'name', kind: 'changed', base: '开发', target: '开发（派生）' },
      { field: 'skills', kind: 'changed', base: ['code-change', 'test-run'], target: ['test-run'] }
    ]
  });
  assert.deepEqual(lines, [
    '对比角色 lead-dev（项目）与基线 developer（内置）',
    '+ derived_from：developer',
    '~ name：开发 → 开发（派生）',
    '~ skills：code-change, test-run → test-run',
    '差异 3 项'
  ]);
});

test('A-5: empty arrays, null values and the no-difference tail use the dash', () => {
  const lines = renderRoleDiff({
    id: 'same',
    idSource: 'project',
    base: 'same',
    baseSource: 'builtin',
    changes: []
  });
  assert.deepEqual(lines, ['对比角色 same（项目）与基线 same（内置）', '无差异']);

  const row = renderRoleDiff({
    id: 'x',
    idSource: 'builtin',
    base: 'y',
    baseSource: 'project',
    changes: [{ field: 'tools', kind: 'removed', base: [], target: undefined }]
  });
  assert.deepEqual(row, ['对比角色 x（内置）与基线 y（项目）', '- tools：—', '差异 1 项']);
});

test('A-11: renderWorkflowDiff prints the field-path change line', () => {
  const lines = renderWorkflowDiff({
    id: 'fork',
    idSource: 'project',
    base: 'code-loop',
    baseSource: 'builtin',
    changes: [{ field: 'nodes[0].title', kind: 'changed', base: '开发', target: '开发（改）' }]
  });
  assert.deepEqual(lines, [
    '对比工作流 fork（项目）与基线 code-loop（内置）',
    '~ nodes[0].title：开发 → 开发（改）',
    '差异 1 项'
  ]);
});

test('A-6: renderSkillList prints the header, rows and invalid tail', () => {
  const lines = renderSkillList({
    counts: { total: 10, builtin: 10, project: 0, invalid: 1 },
    rows: [
      { id: 'code-change', name: '代码修改', appliesTo: '编码工程', commands: 1 },
      { id: 'code-review', name: '代码审查', appliesTo: '编码工程', commands: 0 }
    ]
  });
  assert.deepEqual(lines, [
    '技能 10 个（内置 10 · 项目 0）',
    '- code-change 代码修改 · 编码工程 · 命令 1',
    '- code-review 代码审查 · 编码工程 · 命令 0',
    '1 个资产未通过校验，执行 orch skill validate 查看'
  ]);
});

test('A-6: renderSkillShow indents the body and skips leading blank lines', () => {
  const lines = renderSkillShow({
    row: '- code-change 代码修改 · 编码工程 · 命令 1',
    summary: '定位到要改的文件，做最小改动，并写清改了什么',
    commands: 'node --test',
    appliesTo: '编码工程',
    source: { kind: 'builtin', file: 'assets/skills/code-change/SKILL.md' },
    body: '\n### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作。\n'
  });
  assert.deepEqual(lines, [
    '- code-change 代码修改 · 编码工程 · 命令 1',
    '  摘要：定位到要改的文件，做最小改动，并写清改了什么',
    '  命令：node --test',
    '  适用：编码工程',
    '  来源：内置 assets/skills/code-change/SKILL.md',
    '  正文：',
    '  ### 工作方法',
    '  ',
    '  1. 按任务要求完成本技能覆盖的工作。',
    '  '
  ]);
});

test('A-7/A-9: skill and workflow validate render the one-line all-pass form', () => {
  assert.deepEqual(
    renderSkillValidate({ counts: { assets: 10, skills: 10, builtin: 10, project: 0, invalid: 0 }, rows: [] }),
    ['校验技能 10 个：全部通过']
  );
  assert.deepEqual(
    renderSkillValidate({
      counts: { assets: 11, skills: 11, builtin: 10, project: 1, invalid: 1 },
      rows: [{ file: 'skills/bad/SKILL.md', detail: '缺少必填字段：summary', code: 'SKILL_SCHEMA_MISSING' }]
    }),
    ['校验技能 11 个：1 个不合法', '- skills/bad/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）']
  );
  assert.deepEqual(
    renderWorkflowValidate({ counts: { assets: 3, builtin: 3, project: 0, invalid: 0 }, rows: [] }),
    ['校验工作流 3 个：全部通过']
  );
});

test('A-8: renderWorkflowList and renderWorkflowShow print the built-in baselines', () => {
  const list = renderWorkflowList({
    counts: { total: 3, builtin: 3, project: 0, invalid: 0 },
    rows: [
      { id: 'code-loop', name: '编码闭环', nodeCount: 2, edgeCount: 3, source: 'builtin' },
      { id: 'single', name: '单节点', nodeCount: 1, edgeCount: 0, source: 'builtin' },
      { id: 'task-loop', name: '通用任务闭环', nodeCount: 3, edgeCount: 4, source: 'builtin' }
    ]
  });
  assert.deepEqual(list, [
    '工作流 3 个（内置 3 · 项目 0）',
    '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置',
    '- single 单节点 · 1 节点 · 0 边 · 内置',
    '- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置'
  ]);

  const show = renderWorkflowShow({
    row: '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置',
    entry: 'T-001',
    terminal: 'T-002',
    nodes: [
      { id: 'T-001', title: '开发', nodeType: 'role', role: 'developer' },
      { id: 'T-002', title: '测试', nodeType: 'role', role: 'tester', maxRounds: 2 }
    ],
    edges: [
      { from: 'T-001', to: 'T-002', kind: 'forward' },
      { from: 'T-002', to: 'T-001', kind: 'backflow', rounds: 2 },
      { from: 'T-001', to: 'T-002', kind: 'retest' }
    ]
  });
  assert.deepEqual(show, [
    '- code-loop 编码闭环 · 2 节点 · 3 边 · 内置',
    '  入口：T-001 · 终点：T-002',
    '  节点：',
    '    T-001 开发 · 角色节点 developer · 超时 — · 重试 0',
    '    T-002 测试 · 角色节点 tester · 超时 — · 重试 0',
    '  边：',
    '    T-001 → T-002 正向',
    '    T-002 → T-001 回流 · 轮次上限 2',
    '    T-001 → T-002 复测'
  ]);
});

test('A-9: a broken built-in workflow keeps the 内置 prefix in its row', () => {
  const lines = renderWorkflowValidate({
    counts: { assets: 5, builtin: 3, project: 2, invalid: 2 },
    rows: [
      {
        file: 'workflows/bad-type.yaml',
        detail: '节点类型取值非法：script；合法取值：role / human / escalate / subworkflow',
        code: 'WORKFLOW_NODE_TYPE_INVALID'
      },
      { file: '内置 wake', detail: '唤醒不在白名单内：writer → reviewer', code: 'WORKFLOW_WAKE_DENIED' }
    ]
  });
  assert.deepEqual(lines, [
    '校验工作流 5 个：2 个不合法',
    '- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）',
    '- 内置 wake：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）'
  ]);
});

/** A-1 fixture `doc-fanout` as in-memory workflow nodes (render input only). */
const DOC_FANOUT_NODES = [
  { id: 'T-001', title: '研究', nodeType: 'role', role: 'researcher', timeout: 600, retry: 2, outputs: ['research.notes'] },
  { id: 'T-002', title: '撰写A', nodeType: 'role', role: 'writer', parallelScope: 'draft', scope: 'draft-a', inputs: ['brief'] },
  { id: 'T-003', title: '撰写B', nodeType: 'role', role: 'editor', parallelScope: 'draft', scope: 'draft-b', inputs: ['brief'] },
  { id: 'T-004', title: '人工确认', nodeType: 'human' },
  { id: 'T-005', title: '升级', nodeType: 'escalate' },
  { id: 'T-006', title: '代码闭环', nodeType: 'subworkflow', workflow: 'code-loop', subNodeCount: 2 }
];

/** §3.4's frozen plan shape for `doc-fanout` (WP-4 output as documented). */
const DOC_FANOUT_PLAN = {
  id: 'doc-fanout',
  name: '文档并行版',
  nodeCount: 6,
  edgeCount: 7,
  layers: [
    { parallel: false, nodes: ['T-001'] },
    { parallel: true, nodes: ['T-002', 'T-003'] },
    { parallel: false, nodes: ['T-004'] },
    { parallel: false, nodes: ['T-006'] },
    { parallel: false, nodes: ['T-005'] }
  ],
  branches: [
    { from: 'T-004', to: 'T-006', when: 'human_approved' },
    { from: 'T-004', to: 'T-005', when: 'human_rejected' },
    { from: 'T-006', to: 'T-005', when: 'failed' }
  ],
  mappings: [
    { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-002' },
    { from: 'T-001.research.notes', to: 'brief', edge: 'T-001→T-003' }
  ],
  policies: [{ nodeId: 'T-001', timeout: 600, retry: 2 }]
};

test('A-10: renderWorkflowDryRun prints the doc-fanout plan verbatim', () => {
  const lines = renderWorkflowDryRun({
    plan: DOC_FANOUT_PLAN,
    nodes: DOC_FANOUT_NODES,
    joins: ['all', 'all', 'all', 'all', 'all']
  });
  assert.deepEqual(lines, [
    '编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流',
    '1. T-001 研究（角色节点 researcher）',
    '2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all',
    '3. T-004 人工确认（人工节点）',
    '4. T-006 代码闭环（子工作流 code-loop · 2 节点）',
    '5. T-005 升级（升级节点）',
    '条件分支：',
    '- T-004 → T-006 当 人工通过',
    '- T-004 → T-005 当 人工驳回',
    '- T-006 → T-005 当 判定不通过',
    '字段映射：',
    '- T-001.research.notes → T-002.brief',
    '- T-001.research.notes → T-003.brief',
    '超时与重试：',
    '- T-001 超时 600s · 重试 2',
    '结论：编排可执行，未启动任何会话'
  ]);
});

test('A-10: warnings switch the conclusion line', () => {
  const lines = renderWorkflowDryRun({
    plan: { ...DOC_FANOUT_PLAN, warnings: ['w1'] },
    nodes: DOC_FANOUT_NODES,
    joins: []
  });
  assert.equal(lines.at(-1), '结论：编排可执行，有 1 条提醒，未启动任何会话');
});
