/**
 * WP-3 契约测试：角色 `session_policy` 与会话复用配置（I1.8 / 需求 §2.9 / D-13）。
 *
 * 覆盖同号 AC 的 Then：
 * - AC-48 `fresh` 默认：两轮会话 id 不同；`role show developer` 与 I1.6 基线逐字节相同。
 * - AC-49 `reuse`：两轮会话 id 相同、`session/new` 只 1 次、复用行逐字。
 * - AC-50 两实例会话 id 交集为空。
 * - AC-51 配置可见 / 非法值被拒（`ROLE_SESSION_POLICY_INVALID` 计入 `errors`）。
 * - AC-65 `reuse` 但无空闲会话 → 新建，不出现复用行。
 * - AC-66 不跨宿主、不复用正服务其他节点的会话。
 * - 裁-10a 补派：`running` + `phase: 'assigned'` 不算服务节点（AC-28 的 `服务节点 —`）。
 *
 * 口径：
 * 1. 会话选择一律走 `orchestrator.js` 冻结导出的纯函数 `selectReusableSession`
 *    （裁-10c：`(sessionList, {instanceId, roleId, hostId, nodeId}) -> session | null`）；
 *    派发接线归 WP-4，本文件不 spawn daemon、不启核心。
 * 2. 中文一律取自 `labels.js`（A-5 行、A-10 文案、A-2 复用行），不硬编码。
 * 3. `role show` / `role validate` / `role edit` / `role create` 直接 `main()` 调用，
 *    项目根用 `fs.mkdtemp` 到 `os.tmpdir()`，不写仓库内文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { main } from '../../src/cli/main.js';
import { detailOf } from '../../src/cli/roles.js';
import {
  ROLE_SESSION_POLICY_INVALID,
  ROLE_SESSION_POLICY_LINE,
  RECOVERY_TEXT,
  fill
} from '../../src/cli/labels.js';
import { selectReusableSession } from '../../src/core/orchestrator.js';
import { checkRoleShape, SESSION_POLICIES, ROLE_OPTIONAL_KEYS } from '../../src/registry/role-schema.js';
import { serializeRole } from '../../src/registry/asset-write.js';
import { buildRoleInstances } from '../../src/registry/role-instances.js';
import { loadRegistry } from '../../src/registry/index.js';

process.env.NODE_ENV = 'test';

const tempRoots = [];

function makeProject(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-session-reuse-'));
  tempRoots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const abs = path.join(root, relative);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return root;
}

test.after(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

/** `out` 收集器；`createClient` 只读命令不得调用（AC-38 / BR-24）。 */
async function runCli(cwd, argv) {
  const lines = [];
  const code = await main(argv, {
    cwd,
    out: (line) => lines.push(line),
    createClient: () => {
      throw new Error('createClient must not be called by role read/write commands');
    }
  });
  return { code, lines, text: lines.join('\n') };
}

/** 最小合法角色资产（`session_policy` 只在显式传入时追加）。 */
function roleYaml({ id, name = '复用角色', group = 'coding', policy }) {
  const lines = [
    'schema: role/v1',
    `id: ${id}`,
    `name: ${name}`,
    `group: ${group}`,
    'summary: 会话复用测试角色',
    'artifact_type: code',
    'side_effect: read',
    'skills: []',
    'max_concurrent_sessions: 1'
  ];
  if (policy !== undefined) lines.push(`session_policy: ${policy}`);
  return `${lines.join('\n')}\n`;
}

/** I1.6 的 `role show developer` 基线，六行逐字（AC-48 / A-3）。 */
const I16_DEVELOPER_SHOW = [
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '  职责：按任务修改代码，交出声明的产物文件',
  '  技能：code-change, test-run',
  '  工具：read, write, edit, bash',
  '  可唤醒：tester',
  '  来源：内置 assets/roles/developer.yaml'
].join('\n');

/**
 * D-13 派发模型：`fresh` 从不查询选择器；`reuse` 查询 `selectReusableSession`，
 * 未命中则新建。`line` 是本次派发写入 `instance log` 的复用行（新建时为 null）。
 * 派发接线归 WP-4，这里只驱动两侧冻结的纯函数契约。
 */
function dispatchRound({ policy, sessions, instanceId, roleId, hostId, nodeId, nextSessionId }) {
  const reused =
    policy === 'reuse'
      ? selectReusableSession(sessions, { instanceId, roleId, hostId, nodeId })
      : null;
  if (reused !== null) {
    reused.state = 'thinking';
    reused.servingNodeId = nodeId;
    return { session: reused, created: false, line: reuseLine(reused.sessionId, roleId) };
  }
  const created = {
    sessionId: nextSessionId,
    instanceId,
    roleId,
    hostId,
    nodeId,
    state: 'thinking',
    servingNodeId: nodeId
  };
  sessions.push(created);
  return { session: created, created: true, line: null };
}

/** 会话回到空闲：`state === 'idle'` 且不再服务任何节点（C-15）。 */
function release(session) {
  session.state = 'idle';
  session.servingNodeId = '';
  return session;
}

/** A-2 的复用日志行，占位全部由 labels 模板提供。 */
function reuseLine(sessionId, roleName) {
  return fill(RECOVERY_TEXT.sessionReuse, { 会话号: sessionId, 角色中文名: roleName });
}

// ---------------------------------------------------------------- 冻结点 5：键位

test('冻结点 5：session_policy 在可选键末尾、键序末位、别名 sessionPolicy', () => {
  assert.deepEqual([...ROLE_OPTIONAL_KEYS], [
    'tools',
    'wake_allow',
    'inputs',
    'outputs',
    'dispatchable',
    'session_policy'
  ]);
  assert.deepEqual([...SESSION_POLICIES], ['reuse', 'fresh']);

  const text = serializeRole({
    schema: 'role/v1',
    id: 'audit-role',
    name: '审计',
    group: 'coding',
    summary: '顺序检查',
    artifact_type: 'code',
    side_effect: 'read',
    skills: [],
    max_concurrent_sessions: 2,
    sessionPolicy: 'reuse'
  });
  assert.equal(
    text,
    [
      'schema: role/v1',
      'id: audit-role',
      'name: 审计',
      'group: coding',
      'summary: 顺序检查',
      'artifact_type: code',
      'side_effect: read',
      'skills: []',
      'max_concurrent_sessions: 2',
      'session_policy: reuse',
      ''
    ].join('\n')
  );

  // 未声明时不写入（缺省 `fresh` 不进文件，也不进渲染对象）。
  assert.equal(text.includes('session_policy: fresh'), false);
  const absent = serializeRole({ schema: 'role/v1', id: 'audit-role', skills: [] });
  assert.equal(absent.includes('session_policy'), false);
});

test('枚举校验：reuse / fresh 合法，其它值报 ROLE_SESSION_POLICY_INVALID 并带原值', () => {
  const base = {
    schema: 'role/v1',
    id: 'audit-role',
    name: '审计',
    group: 'coding',
    summary: '校验',
    artifact_type: 'code',
    side_effect: 'read',
    skills: [],
    max_concurrent_sessions: 1
  };
  assert.deepEqual(checkRoleShape({ ...base, session_policy: 'reuse' }, { fileId: 'audit-role' }), []);
  assert.deepEqual(checkRoleShape({ ...base, session_policy: 'fresh' }, { fileId: 'audit-role' }), []);

  const issues = checkRoleShape({ ...base, session_policy: 'always' }, { fileId: 'audit-role' });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'ROLE_SESSION_POLICY_INVALID');
  assert.equal(issues[0].field, 'session_policy');
  assert.deepEqual(issues[0].params, { value: 'always' });

  // A-10：明细文案取自 labels，含原值与两个合法取值。
  assert.equal(
    detailOf(issues[0]),
    '会话复用策略不合法：always（可选 reuse / fresh）'
  );
  assert.equal(fill(ROLE_SESSION_POLICY_INVALID, { value: 'always' }), detailOf(issues[0]));
});

// ---------------------------------------------------------------- AC-48

test('AC-48：fresh 默认每任务新会话，role show developer 与 I1.6 基线逐字节相同', async () => {
  const options = { instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh' };
  const sessions = [];
  const round1 = dispatchRound({
    policy: 'fresh',
    sessions,
    ...options,
    nodeId: 'T-001',
    nextSessionId: 'sess-003'
  });
  release(round1.session);
  const round2 = dispatchRound({
    policy: 'fresh',
    sessions,
    ...options,
    nodeId: 'T-001',
    nextSessionId: 'sess-004'
  });

  assert.notEqual(round2.session.sessionId, round1.session.sessionId, '两轮开发会话 id 必须不同');
  assert.equal(round2.created, true);
  assert.equal(round1.line, null);
  assert.equal(round2.line, null, 'fresh 不得出现复用行');
  assert.equal(
    sessions.filter((session) => session.sessionId.startsWith('sess-')).length,
    2,
    'fresh 每轮都新建'
  );

  const shown = await runCli(makeProject(), ['role', 'show', 'developer']);
  assert.equal(shown.code, 0);
  assert.equal(shown.text, I16_DEVELOPER_SHOW);
  assert.equal(shown.text.includes('会话复用'), false, '未声明策略不得出现复用行');
});

// ---------------------------------------------------------------- AC-49

test('AC-49：reuse 复用第一轮会话，session/new 只 1 次，复用行逐字', () => {
  const sessions = [];
  const options = { instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh' };
  const round1 = dispatchRound({
    policy: 'reuse',
    sessions,
    ...options,
    nodeId: 'T-001',
    nextSessionId: 'sess-003'
  });
  release(round1.session);
  const round2 = dispatchRound({
    policy: 'reuse',
    sessions,
    ...options,
    nodeId: 'T-001',
    nextSessionId: 'sess-004'
  });

  assert.equal(round1.created, true);
  assert.equal(round2.created, false, '第二轮必须复用，不再 session/new');
  assert.equal(round2.session.sessionId, 'sess-003');
  assert.equal(round2.session.sessionId, round1.session.sessionId);
  assert.equal(sessions.length, 1, 'session/new 只 1 次');

  assert.equal(round2.line, '会话 复用 sess-003（角色 developer）');
  assert.equal(round2.line, reuseLine('sess-003', 'developer'));
});

// ---------------------------------------------------------------- AC-50

test('AC-50：两个实例的会话 id 交集为空', () => {
  const shared = [];
  const first = dispatchRound({
    policy: 'reuse',
    sessions: shared,
    instanceId: 'INST-001',
    roleId: 'developer',
    hostId: 'dsh',
    nodeId: 'T-001',
    nextSessionId: 'sess-003'
  });
  release(first.session);
  const second = dispatchRound({
    policy: 'reuse',
    sessions: shared,
    instanceId: 'INST-002',
    roleId: 'developer',
    hostId: 'dsh',
    nodeId: 'T-001',
    nextSessionId: 'sess-004'
  });

  assert.equal(second.created, true, '另一实例的空闲会话不得跨实例复用');
  assert.notEqual(second.session.sessionId, first.session.sessionId);

  const firstIds = new Set([first.session.sessionId]);
  const secondIds = new Set([second.session.sessionId]);
  const overlap = [...firstIds].filter((id) => secondIds.has(id));
  assert.deepEqual(overlap, []);
});

// ---------------------------------------------------------------- AC-51

test('AC-51：显式声明时多一行，位置在「可唤醒」之后、「来源」之前', async () => {
  const root = makeProject({ '.orch/roles/developer.yaml': roleYaml({ id: 'developer', policy: 'reuse' }) });
  const shown = await runCli(root, ['role', 'show', 'developer']);

  assert.equal(shown.code, 0);
  const wakeIndex = shown.lines.findIndex((line) => line.startsWith('  可唤醒：'));
  const sourceIndex = shown.lines.findIndex((line) => line.startsWith('  来源：'));
  assert.ok(wakeIndex >= 0, shown.text);
  assert.equal(shown.lines[wakeIndex + 1], ROLE_SESSION_POLICY_LINE.reuse);
  assert.equal(shown.lines[wakeIndex + 1], '  会话复用：复用（reuse）');
  assert.equal(sourceIndex, wakeIndex + 2);
  assert.equal(shown.lines.length, 7, '六行 + 复用行');

  // fresh 显式声明同样是单行，词面取 labels 常量。
  const freshRoot = makeProject({ '.orch/roles/developer.yaml': roleYaml({ id: 'developer', policy: 'fresh' }) });
  const freshShown = await runCli(freshRoot, ['role', 'show', 'developer']);
  assert.equal(freshShown.code, 0);
  assert.ok(freshShown.lines.includes(ROLE_SESSION_POLICY_LINE.fresh), freshShown.text);
  assert.equal(ROLE_SESSION_POLICY_LINE.fresh, '  会话复用：每任务新会话（fresh）');
});

test('AC-51：非法值报 ROLE_SESSION_POLICY_INVALID 计入 errors，退出码 1', async () => {
  const root = makeProject({
    '.orch/roles/policy-bad.yaml': roleYaml({ id: 'policy-bad', policy: 'always' })
  });
  const validated = await runCli(root, ['role', 'validate', '--format', 'json']);
  assert.equal(validated.code, 1);
  const payload = JSON.parse(validated.text);
  const hit = payload.errors.find((err) => err.code === 'ROLE_SESSION_POLICY_INVALID');
  assert.ok(hit, validated.text);
  assert.equal(hit.file, 'roles/policy-bad.yaml');
  assert.equal(hit.detail, '会话复用策略不合法：always（可选 reuse / fresh）');
  assert.ok(payload.counts.invalid >= 1);

  // `role show developer` 未声明策略时没有该行（AC-51 机检第三条）。
  const clean = await runCli(makeProject(), ['role', 'show', 'developer']);
  assert.equal(clean.code, 0);
  assert.equal(clean.lines.some((line) => line.startsWith('  会话复用：')), false);
});

test('D-13：role edit --set 写入 reuse，--unset 从文件移除该键（不写 fresh）', async () => {
  const root = makeProject({ '.orch/roles/developer.yaml': roleYaml({ id: 'developer' }) });
  const file = path.join(root, '.orch', 'roles', 'developer.yaml');

  assert.equal((await runCli(root, ['role', 'edit', 'developer', '--set', 'session_policy=reuse'])).code, 0);
  assert.equal(fs.readFileSync(file, 'utf8').includes('session_policy: reuse'), true);

  const withLine = await runCli(root, ['role', 'show', 'developer']);
  assert.ok(withLine.lines.includes(ROLE_SESSION_POLICY_LINE.reuse), withLine.text);

  assert.equal((await runCli(root, ['role', 'edit', 'developer', '--unset', 'session_policy'])).code, 0);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(text.includes('session_policy'), false, '--unset 是删键，不是写 fresh');
  const withoutLine = await runCli(root, ['role', 'show', 'developer']);
  assert.equal(withoutLine.lines.some((line) => line.startsWith('  会话复用：')), false);

  // 非法值在写入前被同一套校验拒绝（D-4 / A-10）。
  const rejected = await runCli(root, ['role', 'edit', 'developer', '--set', 'session_policy=always']);
  assert.equal(rejected.code, 1);
  assert.ok(rejected.text.includes('ROLE_SESSION_POLICY_INVALID'), rejected.text);
});

test('D-13：role create --from 继承 session_policy', async () => {
  const root = makeProject({ '.orch/roles/developer.yaml': roleYaml({ id: 'developer', policy: 'reuse' }) });
  const created = await runCli(root, ['role', 'create', 'pick-dev', '--from', 'developer']);

  assert.equal(created.code, 0, created.text);
  const text = fs.readFileSync(path.join(root, '.orch', 'roles', 'pick-dev.yaml'), 'utf8');
  assert.equal(text.includes('session_policy: reuse'), true);
  assert.equal(text.includes('derived_from: developer'), true);

  // 来源未声明时，派生角色也不凭空多出该键（缺省不注入）。
  const plainRoot = makeProject({ '.orch/roles/developer.yaml': roleYaml({ id: 'developer' }) });
  assert.equal((await runCli(plainRoot, ['role', 'create', 'pick-dev', '--from', 'developer'])).code, 0);
  const plainText = fs.readFileSync(path.join(plainRoot, '.orch', 'roles', 'pick-dev.yaml'), 'utf8');
  assert.equal(plainText.includes('session_policy'), false);
});

test('D-13 红线：加载器不把缺省 fresh 注入角色对象', () => {
  const root = makeProject({
    '.orch/roles/declared.yaml': roleYaml({ id: 'declared', policy: 'reuse' }),
    '.orch/roles/undeclared.yaml': roleYaml({ id: 'undeclared' })
  });
  const registry = loadRegistry({ root });

  for (const id of ['declared', 'undeclared']) {
    const role = registry.roleMap.get(id);
    assert.ok(role, `${id} 应加载成功`);
    assert.equal('sessionPolicy' in role, false, 'loader 定义不得带 sessionPolicy');
    assert.equal('session_policy' in role, false, 'loader 定义不得带 session_policy');
  }
});

// ---------------------------------------------------------------- AC-65

test('AC-65：无空闲会话时新建，session/new +1 且复用行 0 次', () => {
  const sessions = [
    { sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh', state: 'thinking', servingNodeId: 'T-001' },
    // 空闲但正服务其它节点：不算可用（C-15 / AC-66）。
    { sessionId: 'sess-004', instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh', state: 'idle', servingNodeId: 'T-002' }
  ];
  const round = dispatchRound({
    policy: 'reuse',
    sessions,
    instanceId: 'INST-001',
    roleId: 'developer',
    hostId: 'dsh',
    nodeId: 'T-003',
    nextSessionId: 'sess-005'
  });

  assert.equal(round.created, true, '无空闲会话必须新建并继续');
  assert.equal(round.session.sessionId, 'sess-005');
  assert.equal(sessions.length, 3, 'session/new 增加 1 次');
  assert.equal(round.line, null, '复用行次数为 0');
});

// ---------------------------------------------------------------- AC-66

test('AC-66：跨宿主不复用；正服务其它节点的会话不复用；仅 servingNodeId 为空才选中', () => {
  const options = { instanceId: 'INST-001', roleId: 'developer', nodeId: 'T-003' };

  const crossHost = [
    { sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer', hostId: 'cursor', state: 'idle', servingNodeId: '' }
  ];
  assert.equal(selectReusableSession(crossHost, { ...options, hostId: 'dsh' }), null);
  assert.equal(selectReusableSession(crossHost, { ...options, hostId: 'cursor' })?.sessionId, 'sess-003');

  const busyOther = [
    { sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh', state: 'idle', servingNodeId: 'T-002' }
  ];
  assert.equal(selectReusableSession(busyOther, { ...options, hostId: 'dsh' }), null);

  const freeSameNode = [
    { sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh', state: 'idle', servingNodeId: 'T-003' }
  ];
  const picked = selectReusableSession(freeSameNode, { ...options, hostId: 'dsh' });
  assert.equal(picked?.sessionId, 'sess-003');
  assert.equal(picked.hostId, 'dsh', '被复用会话的 hostId 与新会话宿主一致');

  const emptyServing = [
    { sessionId: 'sess-003', instanceId: 'INST-001', roleId: 'developer', hostId: 'dsh', state: 'idle', servingNodeId: '' }
  ];
  assert.equal(selectReusableSession(emptyServing, { ...options, hostId: 'dsh' })?.sessionId, 'sess-003');
  // 非 idle 一律不选（C-15：角色状态不当作会话态）。
  assert.equal(
    selectReusableSession([{ ...emptyServing[0], state: 'thinking' }], { ...options, hostId: 'dsh' }),
    null
  );
  // 跨角色不复用。
  assert.equal(
    selectReusableSession([{ ...emptyServing[0], roleId: 'tester' }], { ...options, hostId: 'dsh' }),
    null
  );
});

// ---------------------------------------------------------------- 裁-10a：服务节点收窄

test('AC-28 补派：running + phase=assigned 不算服务节点，服务节点显示 —', () => {
  const graph = { roles: ['developer'], maxRounds: { 'T-001': 2 } };
  const roles = new Map([
    [
      'developer',
      {
        id: 'developer',
        name: '开发',
        group: 'coding',
        summary: '',
        artifactType: 'code',
        sideEffect: 'write',
        skills: [],
        tools: [],
        wakeAllow: [],
        dispatchable: true,
        maxConcurrentSessions: 1,
        source: 'project',
        file: '.orch/roles/developer.yaml'
      }
    ]
  ]);
  const build = (phase) =>
    buildRoleInstances({
      state: {
        state: 'running',
        nodes: [
          { nodeId: 'T-001', roleId: 'developer', state: 'running', phase, round: 1, stateSince: '2026-11-08T10:00:00.000Z' }
        ],
        sessions: []
      },
      graph,
      roles
    }).roles[0];

  const assigned = build('assigned');
  assert.deepEqual(assigned.servingNodes, []);
  assert.equal(assigned.status, 'available');

  const serving = build('running');
  assert.deepEqual(serving.servingNodes, ['T-001']);
  assert.equal(serving.status, 'busy');

  // `review` 仍算服务中（既有规则不动）。
  const review = buildRoleInstances({
    state: {
      state: 'running',
      nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'review', phase: 'running', round: 1, stateSince: '2026-11-08T10:00:00.000Z' }],
      sessions: []
    },
    graph,
    roles
  }).roles[0];
  assert.deepEqual(review.servingNodes, ['T-001']);
});
