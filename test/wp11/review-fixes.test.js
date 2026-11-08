/**
 * Review follow-up regressions (I1.5 post-acceptance code review, F-1..F-7).
 *
 * These are NEW assertions only. The existing wp11 suites are deliberately left
 * untouched (requirement D-8: no existing assertion may be modified this round).
 * Each test names the finding it pins down, so a future regression is attributable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main, parseArgs } from '../../src/cli/main.js';
import { renderRoleInstanceLine } from '../../src/cli/render.js';
import { loadRegistry } from '../../src/registry/index.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(TEST_DIR, '..', '..');
const tempRoots = [];

function makeTemp(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `maestro-review-${label}-`));
  tempRoots.push(root);
  return root;
}

function writeAsset(root, relative, content) {
  const abs = path.join(root, relative);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

/** A read-only client that answers `instance.get` with the given snapshot. */
function mockClient(snapshot) {
  return {
    connect: async () => ({ ok: true }),
    request: async (method) =>
      method === 'instance.get'
        ? { ok: true, result: snapshot }
        : { ok: false, code: 'UNKNOWN_ERROR', params: {} },
    close: async () => {}
  };
}

async function run(argv, { cwd, client = null } = {}) {
  const lines = [];
  const created = [];
  const code = await main(argv, {
    cwd: cwd ?? makeTemp('clean'),
    out: (line) => lines.push(line),
    createClient: (root) => {
      created.push(root);
      if (client === null) throw new Error('createClient must not be called');
      return client;
    }
  });
  return { code, text: lines.join('\n'), lines, created };
}

// ---------------------------------------------------------------- F-1 / BR-25

test('F-1: role validate <unknown id> is "role not found", exit 1', async () => {
  const res = await run(['role', 'validate', 'no-such-role']);
  assert.equal(res.code, 1);
  assert.match(res.text, /找不到角色：no-such-role/);
  assert.match(res.text, /可用角色：执行 orch role list 查看/);
  assert.doesNotMatch(res.text, /全部通过/);
});

test('F-1: an existing role still validates normally (AC-36 shape unchanged)', async () => {
  const res = await run(['role', 'validate', 'researcher']);
  assert.equal(res.code, 0);
  assert.match(res.text, /校验资产 1 个：全部通过（角色 1 · 技能 0）/);
});

test('F-1: show <unknown id> keeps its BR-25 wording', async () => {
  const res = await run(['role', 'show', 'no-such-role']);
  assert.equal(res.code, 1);
  assert.match(res.text, /找不到角色：no-such-role/);
});

// ---------------------------------------------------------------- F-2 / D-6

test('F-2: list rejects a positional role id', async () => {
  const res = await run(['role', 'list', 'developer']);
  assert.equal(res.code, 2);
  assert.match(res.text, /（多余的参数：developer）/);
});

test('F-2: globally known flags are not silently ignored by role subcommands', async () => {
  const cases = [
    [['role', 'list', '--task', 'x'], '--task 不适用于 role list'],
    [['role', 'list', '--events'], '--events 不适用于 role list'],
    [['role', 'show', 'developer', '--template', 'y'], '--template 不适用于 role show'],
    [['role', 'validate', '--cwd', 'x'], '--cwd 不适用于 role validate'],
    [['role', 'validate', '--instance', 'INST-1'], '--instance 不适用于 role validate'],
    [['role', 'show', 'developer', '--group', 'coding'], '--group 不适用于 role show']
  ];
  for (const [argv, reason] of cases) {
    const res = await run(argv);
    assert.equal(res.code, 2, argv.join(' '));
    assert.match(res.text, new RegExp(reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), argv.join(' '));
  }
});

test('F-2: AC-37 wording and legal flag combinations are unchanged', async () => {
  const unknown = await run(['role', 'list', '--nope']);
  assert.equal(unknown.code, 2);
  assert.match(unknown.text, /（未知参数：--nope）/);

  const badFormat = await run(['role', 'list', '--format', 'yaml']);
  assert.equal(badFormat.code, 2);
  assert.match(badFormat.text, /（--format 只接受 text 或 json）/);

  const legal = await run(['role', 'list', '--group', 'coding', '--format', 'json']);
  assert.equal(legal.code, 0);

  const runStatus = await run(['status', '--instance', 'INST-1'], {
    client: mockClient({ instanceId: 'INST-1', state: 'completed', template: 'single', nodes: [], sessions: [] })
  });
  assert.equal(runStatus.code, 0);
});

test('F-2: parseArgs keeps the original shape for non-role commands', () => {
  assert.deepEqual(parseArgs(['status', '--instance', 'INST-1']), {
    ok: true,
    command: 'status',
    sub: null,
    flags: { instance: 'INST-1' }
  });
  assert.equal(parseArgs(['run', '--format', 'json', '--cwd', 'd', '--task', 't']).ok, false);
});

// ---------------------------------------------------------------- F-3 / D-5

test('F-3: an unregistered graph role is visible in the text list with its note', async () => {
  const snapshot = {
    instanceId: 'INST-001',
    state: 'running',
    template: 'code-loop',
    nodes: [
      {
        nodeId: 'T-001',
        roleId: 'ghost-role',
        state: 'running',
        round: 1,
        stateSince: '2026-11-08T10:00:00.000Z'
      }
    ],
    sessions: [
      {
        sessionId: 'sess-1',
        nodeId: 'T-001',
        hostId: 'dsh',
        state: 'thinking',
        stateSince: '2026-11-08T10:00:00.000Z',
        createdAt: '2026-11-08T10:00:00.000Z'
      }
    ]
  };
  const res = await run(['role', 'list', '--instance', 'INST-001'], {
    client: mockClient(snapshot)
  });
  assert.equal(res.code, 0);
  assert.match(res.text, /（注册表中不存在该角色）/);
  assert.equal((res.text.match(/（注册表中不存在该角色）/g) ?? []).length, 1);

  const withoutInstance = await run(['role', 'list']);
  assert.doesNotMatch(withoutInstance.text, /（注册表中不存在该角色）/);
});

// ---------------------------------------------------------------- F-4 / D-1

test('F-4: role-instances.js has no dependency on src/core', () => {
  const source = fs.readFileSync(path.join(REPO, 'src', 'registry', 'role-instances.js'), 'utf8');
  assert.doesNotMatch(source, /from ['"]\.\.\/core\//);
  assert.doesNotMatch(source, /state-machine/);
  assert.match(source, /completed['"],\s*['"]failed['"],\s*['"]cancelled['"],\s*['"]interrupted['"]/);
});

// ---------------------------------------------------------------- F-5 / D-3

test('F-5: same file + same reason code is reported once; different codes stay', () => {
  const builtinRoot = makeTemp('builtin');
  fs.mkdirSync(path.join(builtinRoot, 'roles'), { recursive: true });
  fs.mkdirSync(path.join(builtinRoot, 'skills'), { recursive: true });
  const root = makeTemp('project');

  // Two missing required keys (name, summary) => two raw issues, one reported error.
  writeAsset(root, '.orch/skills/multi-missing/SKILL.md', [
    '---',
    'schema: skill/v1',
    'id: multi-missing',
    '---',
    '',
    '### 工作方法',
    '',
    '1. 做事。',
    ''
  ].join('\n'));
  // AC-14 shape: two different codes in one file must both survive.
  writeAsset(root, '.orch/skills/quote/SKILL.md', [
    '---',
    'schema: skill/v1',
    'id: quoting',
    'name: 引文',
    '---',
    '',
    '1. 只摘原文。',
    ''
  ].join('\n'));

  const registry = loadRegistry({ root, builtinRoot });
  const codesFor = (file) =>
    registry.errors.filter((item) => item.file === file).map((item) => item.code);

  assert.deepEqual(codesFor('skills/multi-missing/SKILL.md'), ['SKILL_SCHEMA_MISSING']);
  assert.deepEqual(codesFor('skills/quote/SKILL.md'), ['SKILL_SCHEMA_MISSING', 'SKILL_ID_MISMATCH']);
  assert.equal(registry.counts.invalid, 2, 'invalid counts files, not error rows');
});

// ---------------------------------------------------------------- F-6 / D-5

test('F-6 (dismissed): roleToSessions keeps the AC-29 creation order', () => {
  // Review finding F-6 claimed D-5 uses an unsorted filter. AC-29's Then explicitly
  // says "by creation order", AC outranks appendix D, and an existing WP-5 test
  // pins that order with a deliberately shuffled `sessions[]`. No change was made;
  // this case records the adjudication instead.
  const state = {
    state: 'running',
    nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'running', round: 1, stateSince: 'b' }],
    sessions: [
      { sessionId: 'sess-late', nodeId: 'T-001', state: 'idle', createdAt: '2026-11-08T10:09:00Z' },
      { sessionId: 'sess-early', nodeId: 'T-001', state: 'idle', createdAt: '2026-11-08T10:01:00Z' }
    ]
  };
  const built = buildRoleInstances({
    state,
    graph: { roles: ['developer'], maxRounds: { 'T-001': 2 } },
    roles: new Map([['developer', { id: 'developer', group: 'coding', maxConcurrentSessions: 1 }]])
  });
  assert.deepEqual(built.roleToSessions.developer, ['sess-early', 'sess-late']);
});

// ---------------------------------------------------------------- F-7 / A-3

test('F-7: a missing maxRounds does not leave a dangling slash', () => {
  const view = {
    status: 'busy',
    statusReason: null,
    activeSessions: ['sess-1'],
    servingNodes: ['T-001'],
    hostIcons: ['dsh'],
    maxConcurrentSessions: 1
  };
  const line = (lastAction) =>
    renderRoleInstanceLine({ instanceId: 'INST-001', view: { ...view, lastAction } });

  const normal = line({ nodeId: 'T-001', round: 1, maxRounds: 2, state: 'running', stateSince: 'b' });
  assert.match(normal, /最近 T-001 · 轮次 1\/2/);

  const noMax = line({ nodeId: 'T-001', round: 1, maxRounds: null, state: 'running', stateSince: 'b' });
  assert.match(noMax, /最近 T-001 · 轮次 1$/);
  assert.doesNotMatch(noMax, /轮次 1\//);

  const noRound = line({ nodeId: 'T-001', round: null, maxRounds: null, state: 'running', stateSince: 'b' });
  assert.match(noRound, /最近 T-001$/);
  assert.doesNotMatch(noRound, /轮次/);
});
