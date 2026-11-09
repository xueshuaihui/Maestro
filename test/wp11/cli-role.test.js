/**
 * `orch role` command tests (WP-4).
 *
 * `main` is imported directly and given an `out` sink plus a `cwd`, so no process is
 * spawned and no core is started. Argument parsing, the preflight order and the
 * byte-level output of A-2 / A-3 / A-4 / A-5 / A-6 / A-7 are all observable here;
 * the end-to-end variant lives in the S3 acceptance harness.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { main, parseArgs } from '../../src/cli/main.js';
import { roleCommand, firstRegistryDetail, detailOf } from '../../src/cli/roles.js';
import { GROUP_LABEL, REGISTRY_ERROR, ROLE_CLI_TEXT, USAGE_LINES, YAML_DETAIL } from '../../src/cli/labels.js';

const tempRoots = [];

function makeProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-cli-'));
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

/**
 * One empty project root shared by the read-only cases. Thirty separate `mkdtemp`
 * trees buy nothing (the commands never write) and add IO pressure to an already
 * parallel suite, which shows up as flaky p95 assertions elsewhere.
 */
let sharedCleanRoot = null;

function cleanProject() {
  if (sharedCleanRoot === null) sharedCleanRoot = makeProject();
  return sharedCleanRoot;
}

function mockClient(options = {}) {
  const calls = [];
  return {
    calls,
    connect: async () => {
      calls.push('connect');
      return options.connectOk === false
        ? { ok: false, code: 'CORE_START_FAILED', params: {} }
        : { ok: true };
    },
    request: async (method, params) => {
      calls.push(`${method}:${params?.instanceId ?? ''}`);
      if (method === 'instance.get') {
        if (typeof options.get === 'function') return options.get(params);
        return options.snapshot
          ? { ok: true, result: options.snapshot }
          : { ok: false, code: 'NOT_FOUND', params: { instanceId: params.instanceId } };
      }
      return { ok: false, code: 'UNKNOWN_ERROR', params: {} };
    },
    close: async () => {
      calls.push('close');
    }
  };
}

/**
 * @param {{cwd:string, client?:object|null, forbidClient?:boolean}} options
 */
function harness({ cwd, client = null }) {
  const lines = [];
  const created = [];
  const run = async (argv) => {
    const code = await main(argv, {
      cwd,
      out: (line) => lines.push(line),
      createClient: (root) => {
        created.push(root);
        if (client === null) throw new Error('createClient must not be called');
        return client;
      }
    });
    return code;
  };
  return { run, lines, created };
}

const BROKEN_ROLE = [
  'schema: role/v1',
  'id: broken',
  'name: 坏文件',
  '    summary: 坏缩进',
  'group: coding',
  'artifact_type: code',
  'side_effect: write',
  'skills: []',
  'max_concurrent_sessions: 1',
  ''
].join('\n');

const BROKEN_GHOST = [
  'schema: role/v1',
  'id: ghost-skill',
  'name: 悬空',
  'group: research',
  'summary: 引用了不存在的技能',
  'artifact_type: report',
  'side_effect: read',
  'skills:',
  '  - no-such-skill',
  'max_concurrent_sessions: 1',
  ''
].join('\n');

// ---------------------------------------------------------------------------
// A-2 / A-3 / AC-01 .. AC-03
// ---------------------------------------------------------------------------

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

const EXPECTED_SHOW = [
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '  职责：按任务修改代码，交出声明的产物文件',
  '  技能：code-change, test-run',
  '  工具：read, write, edit, bash',
  '  可唤醒：tester',
  '  来源：内置 assets/roles/developer.yaml'
];

test('AC-01: role list prints seventeen lines and exits 0', async () => {
  const { run, lines, created } = harness({ cwd: cleanProject() });
  const code = await run(['role', 'list']);

  assert.equal(code, 0);
  assert.deepEqual(lines, EXPECTED_LIST);
  assert.equal(lines.length, 17);
  assert.deepEqual(created, [], 'role list must not create a client');
});

test('AC-02: role show developer is the six documented lines', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  const code = await run(['role', 'show', 'developer']);

  assert.equal(code, 0);
  assert.deepEqual(lines, EXPECTED_SHOW);
  assert.equal(lines.length, 6);
});

test('AC-03: a project role overrides the built-in one and says so', async () => {
  const root = makeProject({
    '.orch/roles/researcher.yaml': [
      'schema: role/v1',
      'id: researcher',
      'name: 研究员',
      'group: research',
      'summary: 项目自己的调研流程',
      'artifact_type: report',
      'side_effect: write',
      'skills: [research-brief, fact-check]',
      'max_concurrent_sessions: 1',
      ''
    ].join('\n')
  });
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['role', 'list']), 0);
  assert.equal(lines[0], '角色 16 个（内置 15 · 项目 1）');
  assert.ok(
    lines.includes('- researcher 研究员 · 研究分析 · report · write · 技能 2 · 并发 1'),
    lines.join('\n')
  );

  const show = harness({ cwd: root });
  assert.equal(await show.run(['role', 'show', 'researcher']), 0);
  assert.equal(show.lines[5], '  来源：项目 .orch/roles/researcher.yaml');
});

// ---------------------------------------------------------------------------
// AC-10 / AC-11: bad assets
// ---------------------------------------------------------------------------

test('AC-10: an invalid registry stops orch run before the client exists', async () => {
  const root = makeProject({ '.orch/roles/ghost-skill.yaml': BROKEN_GHOST });
  const { run, lines, created } = harness({ cwd: root });

  const code = await run(['run', '--cwd', '.', '--task', '写下说明']);

  assert.equal(code, 3);
  assert.deepEqual(created, [], 'the core must not be started');
  assert.equal(lines.length, 1);
  assert.ok(
    lines[0].startsWith('注册表不合法：roles/ghost-skill.yaml：引用的技能不存在：no-such-skill'),
    lines[0]
  );
  assert.ok(!fs.existsSync(path.join(root, '.orch', 'instances')), 'no instance may be created');
  assert.ok(!fs.existsSync(path.join(root, '.orch', 'core.json')), 'no core may be started');
});

test('AC-11: a broken asset does not block the list but fails the exit code', async () => {
  const root = makeProject({ '.orch/roles/broken.yaml': BROKEN_ROLE });
  const { run, lines } = harness({ cwd: root });

  const code = await run(['role', 'list']);

  assert.equal(code, 1);
  assert.equal(lines.length, 18);
  assert.equal(lines[0], '角色 16 个（内置 16 · 项目 0）');
  assert.equal(lines[17], '1 个资产未通过校验，执行 orch role validate 查看');
  assert.deepEqual(lines.slice(1, 17), EXPECTED_LIST.slice(1));
});

test('A-4: role validate prints one row per bad asset', async () => {
  const root = makeProject({ '.orch/roles/broken.yaml': BROKEN_ROLE });
  const { run, lines } = harness({ cwd: root });

  const code = await run(['role', 'validate']);

  assert.equal(code, 1);
  assert.deepEqual(lines, [
    '校验资产 27 个：1 个不合法',
    '- roles/broken.yaml：第 4 行无法解析：缩进不一致（YAML_PARSE_FAILED）'
  ]);
});

test('A-4: a clean tree prints the single success line', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  assert.equal(await run(['role', 'validate']), 0);
  assert.deepEqual(lines, ['校验资产 26 个：全部通过（角色 16 · 技能 10）']);
});

// ---------------------------------------------------------------------------
// AC-32 / AC-33: grouping and JSON shape
// ---------------------------------------------------------------------------

test('AC-32: --group lists only that group in text and JSON', async () => {
  const root = cleanProject();
  const text = harness({ cwd: root });
  assert.equal(await text.run(['role', 'list', '--group', 'coding']), 0);
  assert.deepEqual(text.lines, [
    '角色 3 个（内置 3 · 项目 0）',
    '- code-reviewer 代码审查 · 编码工程 · code · read · 技能 1 · 并发 1',
    '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
    '- tester 测试 · 编码工程 · code · exec · 技能 1 · 并发 1'
  ]);

  const json = harness({ cwd: root });
  assert.equal(await json.run(['role', 'list', '--group', 'coding', '--format', 'json']), 0);
  const payload = JSON.parse(json.lines.join('\n'));
  assert.deepEqual(payload.groups, [{ group: 'coding', label: '编码工程', count: 3 }]);
  assert.equal(payload.roles.length, 3);
  assert.deepEqual(payload.counts, { total: 3, builtin: 3, project: 0, invalid: 0 });
});

test('AC-33: role list JSON has exactly three top-level keys and ten role keys', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  assert.equal(await run(['role', 'list', '--format', 'json']), 0);

  const payload = JSON.parse(lines.join('\n'));
  assert.deepEqual(Object.keys(payload).sort(), ['counts', 'groups', 'roles']);
  assert.deepEqual(Object.keys(payload.counts).sort(), ['builtin', 'invalid', 'project', 'total']);
  assert.equal(payload.roles.length, 16);
  for (const role of payload.roles) {
    assert.deepEqual(Object.keys(role).sort(), [
      'artifactType',
      'file',
      'group',
      'groupLabel',
      'id',
      'maxConcurrentSessions',
      'name',
      'sideEffect',
      'skills',
      'source'
    ]);
  }
  assert.deepEqual(payload.groups, [
    { group: 'coordinator', label: '通用协调', count: 5 },
    { group: 'research', label: '研究分析', count: 3 },
    { group: 'writing', label: '内容创作', count: 3 },
    { group: 'coding', label: '编码工程', count: 3 },
    { group: 'ops', label: '业务运营', count: 2 }
  ]);
});

// ---------------------------------------------------------------------------
// AC-34 .. AC-37: usage errors
// ---------------------------------------------------------------------------

test('AC-34: an unknown role names it and points at role list', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  const code = await run(['role', 'show', 'no-such-role']);

  assert.equal(code, 1);
  assert.deepEqual(lines, ['找不到角色：no-such-role', '可用角色：执行 orch role list 查看']);
});

test('AC-35: role show without an id is a usage error', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  const code = await run(['role', 'show']);

  assert.equal(code, 2);
  assert.equal(lines.length, 1, 'renderUsage prints the whole block as one string');
  assert.ok(lines[0].includes('orch role show <角色>'));
  assert.ok(lines[0].includes('（role show 需要角色 id）'));
});

test('AC-37: unknown subcommand, unknown flag and bad --format are usage errors', async () => {
  const root = cleanProject();

  const bogus = harness({ cwd: root });
  assert.equal(await bogus.run(['role', 'bogus']), 2);
  assert.ok(bogus.lines[0].includes('（未知的 role 子命令：bogus）'));

  const unknownFlag = harness({ cwd: root });
  assert.equal(await unknownFlag.run(['role', 'list', '--nope']), 2);
  assert.ok(unknownFlag.lines[0].includes('（未知参数：--nope）'));

  const badFormat = harness({ cwd: root });
  assert.equal(await badFormat.run(['role', 'list', '--format', 'yaml']), 2);
  assert.ok(badFormat.lines[0].includes('（--format 只接受 text 或 json）'));
});

test('the usage block has eight lines and keeps the I1.1 first line', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  await run(['role', 'bogus']);

  const block = lines[0].split('\n');
  assert.equal(block.length, 26, 'twenty-five usage lines plus the reason line');
  assert.equal(block[0], '用法：orch run|status|cancel|core');
  assert.deepEqual(block.slice(0, 8), USAGE_LINES.slice(0, 8));
  assert.equal(USAGE_LINES.length, 25);
});

test('a flag that belongs to another subcommand is rejected', async () => {
  const root = cleanProject();

  const groupOnShow = harness({ cwd: root });
  assert.equal(await groupOnShow.run(['role', 'show', 'developer', '--group', 'coding']), 2);
  assert.ok(groupOnShow.lines[0].includes('（--group 不适用于 role show）'));

  const instanceOnValidate = harness({ cwd: root });
  assert.equal(await instanceOnValidate.run(['role', 'validate', '--instance', 'INST-1']), 2);
  assert.ok(instanceOnValidate.lines[0].includes('（--instance 不适用于 role validate）'));

  const badGroup = harness({ cwd: root });
  assert.equal(await badGroup.run(['role', 'list', '--group', 'marketing']), 2);
  assert.ok(badGroup.lines[0].includes('（--group 只接受 coordinator / research / writing / coding / ops）'));
});

test('role flags leak into other commands as unknown parameters (M-9)', () => {
  const cases = [
    ['run', '--cwd', '.', '--task', 't', '--format', 'json'],
    ['status', '--group', 'coding'],
    ['cancel', '--instance', 'x', '--format', 'json'],
    ['core', 'stop', '--group', 'x']
  ];
  for (const argv of cases) {
    const parsed = parseArgs(argv);
    assert.equal(parsed.ok, false, argv.join(' '));
    assert.equal(parsed.code, 'USAGE');
    assert.ok(parsed.message.startsWith('未知参数：--'), parsed.message);
  }
});

test('parseArgs keeps the old result shape for the four original commands', () => {
  const parsed = parseArgs(['status', '--instance', 'INST-1']);
  assert.deepEqual(Object.keys(parsed).sort(), ['command', 'flags', 'ok', 'sub']);
  assert.equal('positional' in parsed, false);
});

// ---------------------------------------------------------------------------
// AC-36 / AC-38: single role and read-only
// ---------------------------------------------------------------------------

test('AC-36: role validate <id> counts one asset and hides other files', async () => {
  const root = makeProject({ '.orch/roles/broken.yaml': BROKEN_ROLE });
  const { run, lines } = harness({ cwd: root });

  const code = await run(['role', 'validate', 'researcher']);

  assert.equal(code, 0);
  assert.deepEqual(lines, ['校验资产 1 个：全部通过（角色 1 · 技能 0）']);
  assert.ok(!lines.join('\n').includes('broken'));
});

test('AC-38: the three read-only commands never create .orch nor a client', async () => {
  const root = cleanProject();
  const { run, created, lines } = harness({ cwd: root });

  assert.equal(await run(['role', 'list']), 0);
  assert.equal(await run(['role', 'show', 'developer']), 0);
  assert.equal(await run(['role', 'validate']), 0);

  assert.deepEqual(created, []);
  assert.equal(fs.existsSync(path.join(root, '.orch')), false);
  assert.ok(lines.length > 0);
});

// ---------------------------------------------------------------------------
// --instance (AC-39 and A-6 shape)
// ---------------------------------------------------------------------------

function snapshotFor(roleIds, { state = 'running', template = 'code-loop' } = {}) {
  const nodes = roleIds.map((roleId, index) => ({
    nodeId: `T-00${index + 1}`,
    roleId,
    round: 1,
    state: index === 0 ? 'running' : 'pending',
    stateSince: '2026-11-08T10:00:00.000Z'
  }));
  return {
    instanceId: 'INST-001',
    template,
    state,
    rev: 3,
    maxRounds: { 'T-001': 2, 'T-002': 2 },
    nodes,
    sessions: nodes.map((node, index) => ({
      sessionId: `s-${index + 1}`,
      nodeId: node.nodeId,
      round: 1,
      hostId: 'dsh',
      state: 'thinking',
      stateSince: '2026-11-08T10:00:00.000Z',
      createdAt: '2026-11-08T10:00:00.000Z',
      quarantined: false
    }))
  };
}

test('AC-39: an unknown instance still prints the role contract first', async () => {
  const client = mockClient();
  const { run, lines } = harness({ cwd: cleanProject(), client });

  const code = await run(['role', 'show', 'developer', '--instance', 'INST-999']);

  assert.equal(code, 1);
  assert.deepEqual(lines.slice(0, 6), EXPECTED_SHOW);
  assert.equal(lines[6], '找不到实例：INST-999');
  assert.equal(lines.length, 7);
  assert.ok(client.calls.includes('close'), 'the client must be closed');
});

test('role show --instance appends the instance line (A-3)', async () => {
  const snapshot = snapshotFor(['developer', 'tester']);
  const client = mockClient({ snapshot });
  const { run, lines } = harness({ cwd: cleanProject(), client });

  const code = await run(['role', 'show', 'developer', '--instance', 'INST-001']);

  assert.equal(code, 0);
  assert.deepEqual(lines.slice(0, 6), EXPECTED_SHOW);
  assert.equal(
    lines[6],
    '  实例 INST-001：服务中 · 活跃会话 1/1 · 服务节点 T-001 · 宿主 dsh · 最近 T-001 · 轮次 1/2'
  );
});

test('role show --instance on a role outside the instance says so', async () => {
  const snapshot = snapshotFor(['developer', 'tester']);
  const client = mockClient({ snapshot });
  const { run, lines } = harness({ cwd: cleanProject(), client });

  assert.equal(await run(['role', 'show', 'writer', '--instance', 'INST-001']), 0);
  assert.equal(lines[6], '  实例 INST-001：本实例未使用该角色');
});

test('role show JSON has three keys and null instance without --instance', async () => {
  const { run, lines } = harness({ cwd: cleanProject() });
  assert.equal(await run(['role', 'show', 'developer', '--format', 'json']), 0);

  const payload = JSON.parse(lines.join('\n'));
  assert.deepEqual(Object.keys(payload).sort(), ['instance', 'role', 'roleInstance']);
  assert.equal(payload.instance, null);
  assert.equal(payload.roleInstance, null);
  assert.deepEqual(Object.keys(payload.role).sort(), [
    'artifactType',
    'file',
    'group',
    'groupLabel',
    'id',
    'maxConcurrentSessions',
    'name',
    'sideEffect',
    'skills',
    'source'
  ]);
});

test('role show --instance JSON exposes the nine-key role instance', async () => {
  const snapshot = snapshotFor(['developer', 'tester']);
  const client = mockClient({ snapshot });
  const { run, lines } = harness({ cwd: cleanProject(), client });

  assert.equal(await run(['role', 'show', 'tester', '--instance', 'INST-001', '--format', 'json']), 0);
  const payload = JSON.parse(lines.join('\n'));
  assert.deepEqual(Object.keys(payload).sort(), ['instance', 'role', 'roleInstance']);
  assert.deepEqual(Object.keys(payload.instance).sort(), [
    'instanceId',
    'roleToSessions',
    'state',
    'template'
  ]);
  assert.deepEqual(Object.keys(payload.roleInstance).sort(), [
    'activeSessions',
    'hostIcons',
    'lastAction',
    'maxConcurrentSessions',
    'roleId',
    'roleInstanceId',
    'servingNodes',
    'status',
    'statusReason'
  ]);
  assert.equal(payload.roleInstance.roleInstanceId, 'RI-tester');
  assert.equal(payload.roleInstance.status, 'available');
});

test('role list --instance appends one line per instance role', async () => {
  const snapshot = snapshotFor(['developer', 'tester']);
  const client = mockClient({ snapshot });
  const { run, lines } = harness({ cwd: cleanProject(), client });

  assert.equal(await run(['role', 'list', '--instance', 'INST-001']), 0);
  // 17 list lines + 3 instance roles: coordinator is declared by the graph but unbound.
  assert.equal(lines.length, 20);
  assert.ok(lines.some((line) => line.includes('实例 INST-001：未参与')), lines.join('\n'));
});

test('role list --instance JSON adds a fourth key with roleToSessions', async () => {
  const snapshot = snapshotFor(['developer', 'tester']);
  const client = mockClient({ snapshot });
  const { run, lines } = harness({ cwd: cleanProject(), client });

  assert.equal(await run(['role', 'list', '--instance', 'INST-001', '--format', 'json']), 0);
  const payload = JSON.parse(lines.join('\n'));
  assert.deepEqual(Object.keys(payload).sort(), ['counts', 'groups', 'instance', 'roles']);
  assert.deepEqual(payload.instance.roleToSessions, {
    developer: ['s-1'],
    tester: ['s-2']
  });
  assert.equal(payload.instance.roles.length, 3);
});

test('role validate JSON rebuilds six-key errors and leaks no params', async () => {
  const root = makeProject({ '.orch/roles/broken.yaml': BROKEN_ROLE });
  const { run, lines } = harness({ cwd: root });

  assert.equal(await run(['role', 'validate', '--format', 'json']), 1);
  const payload = JSON.parse(lines.join('\n'));
  assert.deepEqual(Object.keys(payload).sort(), ['counts', 'errors']);
  assert.deepEqual(Object.keys(payload.counts).sort(), [
    'assets',
    'builtin',
    'invalid',
    'project',
    'roles',
    'skills'
  ]);
  assert.equal(payload.errors.length, 1);
  assert.deepEqual(Object.keys(payload.errors[0]).sort(), [
    'code',
    'detail',
    'field',
    'file',
    'line',
    'scope'
  ]);
  assert.equal(payload.errors[0].file, 'roles/broken.yaml');
  assert.equal(payload.errors[0].line, 4);
  assert.equal(payload.errors[0].detail, '第 4 行无法解析：缩进不一致');
});

// ---------------------------------------------------------------------------
// Detail assembly
// ---------------------------------------------------------------------------

test('every registry error code has a label template', () => {
  const codes = [
    'YAML_PARSE_FAILED',
    'ROLE_SCHEMA_MISSING',
    'ROLE_ID_MISMATCH',
    'ROLE_GROUP_INVALID',
    'ROLE_ARTIFACT_TYPE_INVALID',
    'ROLE_SIDE_EFFECT_INVALID',
    'ROLE_MAX_CONCURRENT_INVALID',
    'ROLE_SKILL_NOT_FOUND',
    'SKILL_FILE_MISSING',
    'SKILL_SCHEMA_MISSING',
    'SKILL_ID_MISMATCH',
    'SKILL_BODY_EMPTY',
    'SKILL_GROUP_INVALID',
    'REGISTRY_ASSETS_MISSING'
  ];
  assert.equal(Object.keys(REGISTRY_ERROR).length, 14);
  for (const code of codes) assert.equal(typeof REGISTRY_ERROR[code], 'string', code);
  assert.equal(Object.keys(YAML_DETAIL).length, 5);
});

test('detailOf fills every template without leaving a placeholder', () => {
  const samples = {
    YAML_PARSE_FAILED: {
      params: { line: 4, detailKey: 'inconsistent-indentation', detailParams: {} },
      expected: '第 4 行无法解析：缩进不一致'
    },
    ROLE_SCHEMA_MISSING: {
      params: { field: 'skills' },
      expected: '缺少必填字段：skills'
    },
    ROLE_ID_MISMATCH: {
      params: { fileId: 'writer', declaredId: 'wordsmith' },
      expected: '角色 id 与文件名不一致：文件 writer / 声明 wordsmith'
    },
    ROLE_GROUP_INVALID: {
      params: { value: 'marketing' },
      expected: '分组取值非法：marketing；合法取值：coordinator / research / writing / coding / ops'
    },
    ROLE_SKILL_NOT_FOUND: { params: { skill: 'no-such-skill' }, expected: '引用的技能不存在：no-such-skill' },
    SKILL_FILE_MISSING: { params: { dir: 'half-done' }, expected: '技能目录缺少 SKILL.md：half-done' },
    SKILL_ID_MISMATCH: {
      params: { dirId: 'quote', declaredId: 'quoting' },
      expected: '技能 id 与目录名不一致：目录 quote / 声明 quoting'
    },
    SKILL_BODY_EMPTY: { params: { dir: 'empty-body' }, expected: '技能正文为空：empty-body' },
    REGISTRY_ASSETS_MISSING: { params: { path: '/x/assets' }, expected: '内置资产目录缺失：/x/assets' }
  };

  for (const [code, sample] of Object.entries(samples)) {
    const detail = detailOf({ code, params: sample.params });
    assert.equal(detail, sample.expected, code);
    assert.ok(!detail.includes('{'), `${code} left a placeholder: ${detail}`);
    assert.ok(!detail.includes('undefined'), code);
  }
});

test('firstRegistryDetail returns the A-4 row without the dash prefix', () => {
  assert.equal(firstRegistryDetail([]), null);
  assert.equal(
    firstRegistryDetail([
      { code: 'ROLE_SKILL_NOT_FOUND', file: 'roles/ghost-skill.yaml', params: { skill: 'no-such-skill' } }
    ]),
    'roles/ghost-skill.yaml：引用的技能不存在：no-such-skill（ROLE_SKILL_NOT_FOUND）'
  );
});

test('roleCommand is reachable directly and honours the frozen ctx shape', async () => {
  const root = cleanProject();
  const lines = [];
  const code = await roleCommand(
    { command: 'role', sub: 'list', positional: null, flags: { group: 'ops' } },
    {
      cwd: root,
      out: (line) => lines.push(line),
      createClient: () => {
        throw new Error('must not create a client');
      }
    }
  );

  assert.equal(code, 0);
  assert.equal(lines[0], '角色 2 个（内置 2 · 项目 0）');
  assert.equal(GROUP_LABEL.ops, '业务运营');
  assert.equal(ROLE_CLI_TEXT.placeholder, '—');
});
