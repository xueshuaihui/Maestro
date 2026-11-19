/**
 * WP-5 契约测试：恢复 / 连接线 / 会话失败 / 复用的用户可见文案与渲染（I1.8）。
 *
 * 口径（需求 v3）：
 * - AC-10：恢复摘要行只出现 1 次；非恢复实例不出现该行（A-2 / A-3 / A-4）。
 * - AC-36：连接线聚合行逐字；恢复实例 JSON 含 `recovery` / `connections`，
 *   非恢复实例仍 11 个顶层键且顺序不变（A-4 / A-9）。
 * - AC-47：崩溃文案不含「判定为运行慢」，慢文案不含「正在重建会话」，
 *   各自关键短语计数为 1（A-6）。
 * - AC-14 / AC-51 / AC-55 的文案侧锚点。
 *
 * 只 import 常量与纯渲染函数，读一次 `main.js` 源文本校验 `COMMANDS`；
 * 不 spawn 子进程、不启核心、不写仓库内文件。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as labels from '../../src/cli/labels.js';
import * as render from '../../src/cli/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 本地时区 ISO，避免断言依赖运行机器的时区（同 test/wp6/render.test.js）。 */
function localIso(h, m, s, day = 9) {
  return new Date(2026, 10, day, h, m, s).toISOString();
}

function countOf(text, needle) {
  return String(text).split(needle).length - 1;
}

const GRAPH = {
  nodes: [
    { nodeId: 'T-001', roleId: 'developer' },
    { nodeId: 'T-002', roleId: 'tester' },
  ],
  edges: [
    { from: 'T-001', to: 'T-002', kind: 'forward' },
    { from: 'T-002', to: 'T-001', kind: 'backflow' },
  ],
  maxRounds: { 'T-001': 3, 'T-002': 3 },
};

/** AC-09 / AC-10 的恢复现场：开发第二轮已完成、测试复测执行中。 */
function recoveredSnapshot(overrides = {}) {
  return {
    instanceId: 'INST-001',
    state: 'running',
    template: 'code-loop',
    recoveredAt: localIso(10, 31, 0),
    recovery: {
      checkpointAt: localIso(10, 30, 0),
      skipped: 1,
      round: 2,
      maxRounds: 3,
    },
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 2 },
      { nodeId: 'T-002', roleId: 'tester', state: 'running', round: 2, phase: 'assigned' },
    ],
    handoffs: [
      { handoffId: 'HO-002', state: 'pending', deliveryAttempts: 1, edge: { from: 'T-002', to: 'T-001', kind: 'backflow' } },
    ],
    connections: [{ from: 'T-002', to: 'T-001', kind: 'backflow', aggregate: 'pending' }],
    escalations: [],
    approvals: [],
    ...overrides,
  };
}

/** 未发生恢复的同形快照：不得出现任何恢复行 / JSON 键。 */
function plainSnapshot(overrides = {}) {
  const snapshot = recoveredSnapshot(overrides);
  delete snapshot.recoveredAt;
  delete snapshot.recovery;
  delete snapshot.connections;
  return snapshot;
}

const GRAPH_KEYS = [
  'graphVersion', 'instanceId', 'template', 'state', 'paused', 'nodes', 'edges',
  'handoffs', 'escalations', 'approvals', 'current',
];

// ---------------------------------------------------------------- AC-10（A-2）

test('AC-10：恢复摘要行逐字且只出现 1 次；非恢复实例不出现', () => {
  const expected = '恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3';
  assert.equal(render.renderRecoveryLine(recoveredSnapshot(), GRAPH), expected);

  // 状态头（标准实例行之后追加一行）——WP-4 接线用的同一函数。
  const statusText = render.renderInstanceStatusLines(recoveredSnapshot(), GRAPH).join('\n');
  assert.equal(countOf(statusText, expected), 1, statusText);
  assert.ok(statusText.startsWith('实例 INST-001 · 运行中'), statusText);

  // `instance graph` 文本顶部同样一行（A-4）。
  const graphLines = render.renderGraphText(recoveredSnapshot(), GRAPH);
  assert.equal(graphLines[0], '实例 INST-001 · 编码闭环 · 运行中');
  assert.equal(graphLines[1], expected);
  assert.equal(countOf(graphLines.join('\n'), expected), 1);

  // 非恢复实例：返回 null / 空块 / 文本无恢复行。
  assert.equal(render.renderRecoveryLine(plainSnapshot(), GRAPH), null);
  assert.deepEqual(render.renderRecoveryBlock(plainSnapshot(), GRAPH), []);
  assert.deepEqual(render.renderInstanceStatusLines(plainSnapshot(), GRAPH), [
    '实例 INST-001 · 运行中 · 模板 编码闭环',
  ]);
  assert.ok(!render.renderGraphText(plainSnapshot(), GRAPH).join('\n').includes('恢复：'));
});

// ---------------------------------------------------------------- AC-36（A-4 / A-9）

test('AC-36：连接线聚合行逐字，文本与 JSON 聚合值一致', () => {
  const lines = render.renderGraphText(recoveredSnapshot(), GRAPH);
  const expected = '连接线：测试→开发（回流） 待投递（重投中）';
  assert.equal(lines[2], expected);
  assert.equal(countOf(lines.join('\n'), '连接线：'), 1);

  const obj = JSON.parse(render.renderGraphJson(recoveredSnapshot(), GRAPH));
  assert.equal(obj.connections[0].aggregate, 'pending');
  assert.equal(
    labels.CONNECTION_AGGREGATE_LABEL[obj.connections[0].aggregate],
    '待投递（重投中）',
  );
});

test('AC-36：恢复实例 JSON 在 current 之后追加 recovery / connections（13 键）', () => {
  const obj = JSON.parse(render.renderGraphJson(recoveredSnapshot(), GRAPH));
  assert.deepEqual(Object.keys(obj), [...GRAPH_KEYS, 'recovery', 'connections']);
  assert.equal(obj.graphVersion, 1);

  assert.deepEqual(Object.keys(obj.recovery), ['checkpointAt', 'skipped', 'round', 'maxRounds']);
  assert.equal(obj.recovery.checkpointAt, localIso(10, 30, 0));
  assert.equal(obj.recovery.skipped, 1);
  assert.equal(obj.recovery.round, 2);
  assert.equal(obj.recovery.maxRounds, 3);

  assert.equal(obj.connections.length, 1);
  assert.deepEqual(Object.keys(obj.connections[0]), ['from', 'to', 'kind', 'aggregate']);
  assert.deepEqual(obj.connections[0], {
    from: 'T-002', to: 'T-001', kind: 'backflow', aggregate: 'pending',
  });
});

test('AC-36：非恢复实例仍 11 个顶层键、顺序不变，且不含 recovery / connections', () => {
  const obj = JSON.parse(render.renderGraphJson(plainSnapshot(), GRAPH));
  assert.deepEqual(Object.keys(obj), GRAPH_KEYS);
  assert.equal(Object.keys(obj).length, 11);
  assert.ok(!('recovery' in obj));
  assert.ok(!('connections' in obj));
});

test('AC-36 / A-4：恢复块没有连接线时只打印摘要，不打印 连接线： 段', () => {
  const snapshot = recoveredSnapshot({ connections: [] });
  const lines = render.renderGraphText(snapshot, GRAPH);
  assert.equal(countOf(lines.join('\n'), '恢复：检查点'), 1);
  assert.ok(!lines.join('\n').includes('连接线：'));
});

// ---------------------------------------------------------------- AC-47（A-6）

test('AC-47：崩溃与运行慢两类文案不混用，各自关键短语计数为 1', () => {
  const crashLines = [
    render.renderSessionCrashLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
    render.renderSessionRebuiltLine({ sessionId: 'sess-005', nodeId: 'T-003', round: 2, maxRounds: 3 }),
    render.renderSessionRebuildFailedLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
  ];
  const slowLines = [
    render.renderSessionSlowLine({ nodeId: 'T-003', minutes: 10 }),
    render.renderNodeTimeoutLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
  ];

  assert.equal(crashLines[0], '会话进程已退出：正在重建会话（节点 T-003 · 轮次 2/3）');
  assert.equal(slowLines[0], '会话无进展：判定为运行慢，不重建会话（节点 T-003 · 已等待 10m）');

  const crashText = crashLines.join('\n');
  const slowText = slowLines.join('\n');
  assert.ok(!crashText.includes('判定为运行慢'), crashText);
  assert.ok(!slowText.includes('正在重建会话'), slowText);
  assert.equal(countOf(crashText, '正在重建会话'), 1);
  assert.equal(countOf(slowText, '判定为运行慢'), 1);
});

// ---------------------------------------------------------------- A-3 / A-6 逐字

test('A-3：17 行模板逐字（含第 17 行 重新核对）', () => {
  assert.deepEqual(Object.values(labels.RECOVERY_TEXT), [
    '恢复：检查点 {HH:MM:SS} · 跳过 {N} 个已完成节点 · 轮次 {轮}/{上限}',
    '恢复：会话 {会话号} · session/resume（不回放）',
    '恢复：会话 {会话号} · session/load（回放）',
    '恢复：会话 {会话号} · session/new（新建）',
    '恢复：session/resume 失败，回退 session/load（回放）',
    '恢复：session/load 失败，回退 session/new（新建）',
    '恢复：角色 {角色中文名} · 服务中 → 可用（会话不可恢复）',
    '恢复：角色 {角色中文名} · 不可用 → 可用（会话已重建）',
    '恢复：交接包 {包号} 已构造 → 继续投递',
    '会话 复用 {会话号}（角色 {角色中文名}）',
    '恢复：连接线 {方向} 已投递 → 待投递（重投）',
    '恢复：人工节点 {节点号} 保持等待人工（不重派）',
    '按实例记录恢复（可能重跑当前轮）',
    '旧实例无检查点：已中断（如需继续请新建实例）',
    '恢复失败：{原因}；实例已中断（可执行 orch instance log 查看详情）',
    '检查点写入失败：{原因}；本次进展已保存，崩溃恢复可能回退到上一个检查点',
    '重新核对：{节点号} · 证据重新校验（不重放会话）',
  ]);

  // AC-14 / 附录 A-3 第 17 行：渲染后逐字。
  assert.equal(
    labels.fill(labels.RECOVERY_TEXT.reverify, { nodeId: 'T-003' }),
    '重新核对：T-003 · 证据重新校验（不重放会话）',
  );
});

test('A-6：五行逐字（渲染后）', () => {
  assert.equal(
    render.renderSessionCrashLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
    '会话进程已退出：正在重建会话（节点 T-003 · 轮次 2/3）',
  );
  assert.equal(
    render.renderSessionRebuiltLine({ sessionId: 'sess-005', nodeId: 'T-003', round: 2, maxRounds: 3 }),
    '会话已重建 sess-005（节点 T-003 · 轮次 2/3）',
  );
  assert.equal(
    render.renderSessionRebuildFailedLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
    '会话重建失败：已升级人工（节点 T-003 · 轮次 2/3）',
  );
  assert.equal(
    render.renderSessionSlowLine({ nodeId: 'T-003', minutes: 10 }),
    '会话无进展：判定为运行慢，不重建会话（节点 T-003 · 已等待 10m）',
  );
  assert.equal(
    render.renderNodeTimeoutLine({ nodeId: 'T-003', round: 2, maxRounds: 3 }),
    '节点 T-003 超时：按运行慢处理，已升级人工（节点 T-003 · 轮次 2/3）',
  );
});

// ---------------------------------------------------------------- A-5 / A-10（AC-51）

test('A-5：复用行位置在「可唤醒」之后、「来源」之前；未声明不出现', () => {
  const base = {
    roleRow: '- developer 开发',
    duty: '写代码',
    skills: [],
    tools: [],
    wake: [],
    source: { kind: 'builtin', file: 'developer.yaml' },
  };

  const withReuse = render.renderRoleShow({ ...base, sessionPolicy: 'reuse' });
  const wakeIndex = withReuse.findIndex((line) => line.startsWith('  可唤醒：'));
  const policyIndex = withReuse.indexOf('  会话复用：复用（reuse）');
  const sourceIndex = withReuse.findIndex((line) => line.startsWith('  来源：'));
  assert.ok(wakeIndex >= 0, withReuse.join('\n'));
  assert.equal(policyIndex, wakeIndex + 1);
  assert.equal(sourceIndex, policyIndex + 1);

  const withFresh = render.renderRoleShow({ ...base, sessionPolicy: 'fresh' });
  assert.ok(withFresh.includes('  会话复用：每任务新会话（fresh）'));

  const undeclared = render.renderRoleShow(base);
  assert.equal(undeclared.length, 6);
  assert.ok(!undeclared.some((line) => line.includes('会话复用')));
});

test('A-10：非法复用策略的原因码文案逐字', () => {
  assert.equal(labels.ROLE_SESSION_POLICY_INVALID, '会话复用策略不合法：{value}（可选 reuse / fresh）');
  assert.equal(
    labels.fill(labels.ROLE_SESSION_POLICY_INVALID, { value: 'always' }),
    '会话复用策略不合法：always（可选 reuse / fresh）',
  );
});

// ---------------------------------------------------------------- A-1 位置投影

test('A-1：NODE_PHASE_LABEL 九态投影的显示词（phase 仅 blocked/ready/assigned/running）', () => {
  assert.deepEqual({ ...labels.NODE_PHASE_LABEL }, {
    blocked: '待执行',
    ready: '待执行',
    assigned: '已分配',
    running: '执行中',
  });
  // `phase` 缺省的旧节点仍按既有 NODE_LABEL 显示（逐字不变）。
  const rows = render.renderNodeLines(recoveredSnapshot(), { template: 'code-loop' });
  assert.deepEqual(rows, [
    '节点 T-001 开发 已完成 · 第 2 轮',
    '节点 T-002 测试 已分配 · 第 2 轮',
  ]);
  const legacy = render.renderNodeLines(
    { instanceId: 'INST-002', state: 'running', template: 'code-loop', nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'running', round: 1 }] },
    { template: 'code-loop' },
  );
  assert.deepEqual(legacy, ['节点 T-001 开发 执行中 · 第 1 轮']);
});

// ---------------------------------------------------------------- AC-55（用法块）

test('AC-55：USAGE_LINES 仍 25 行，前 8 行逐字；COMMANDS 不含 recover', () => {
  assert.equal(labels.USAGE_LINES.length, 25);
  assert.deepEqual(labels.USAGE_LINES.slice(0, 8), [
    '用法：orch run|status|cancel|core',
    '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
    '  orch status [--instance <实例号>] [--events]',
    '  orch cancel --instance <实例号>',
    '  orch core stop',
    '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
    '  orch role show <角色> [--instance <实例号>] [--format text|json]',
    '  orch role validate [<角色>] [--format json]',
  ]);

  const source = fs.readFileSync(path.join(ROOT, 'src', 'cli', 'main.js'), 'utf8');
  const declaration = /const COMMANDS = new Set\(\[([\s\S]*?)\]\)/.exec(source);
  assert.ok(declaration, 'main.js 必须仍以 COMMANDS 集合登记命令');
  const commands = [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.ok(commands.includes('run'), commands.join(','));
  assert.ok(!commands.includes('recover'), commands.join(','));
});
