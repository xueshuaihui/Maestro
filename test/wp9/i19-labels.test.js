/**
 * I1.9 WP-4 文案键底座契约测试。
 *
 * 纯内存：只 import 常量表并做字符串逐字比对，不读数据文件、不写磁盘、不起进程。
 * 中文逐字基线取需求 v7 附录 A-1~A-14（A-9 为键名权威来源）；既有键与
 * `USAGE_LINES` 为只读回归基线（口径同 test/wp12/cli-assets.test.js 与
 * test/wp11/labels-sync.test.js，二者不在本 WP 修改）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import * as L from '../../src/cli/labels.js';
import { CORE_TEXT } from '../../src/core/status-text.js';

/** 占位符替换：仅替换 `{word}`，未知键原样保留，便于逐字比对。 */
function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key])));
}

/** 用 A-9 的键渲染一条完整健康度行（带 0~N 条原因，` · ` 并列）。 */
function healthLine(level, codes, vars) {
  const reasons = codes.map((code) => fill(L.HEALTH_REASON[code], vars)).join(L.HEALTH_LINE.sep);
  return fill(L.HEALTH_LINE.withReasons, { level: L.HEALTH_LABEL[level], reasons });
}
function healthBase(level) {
  return fill(L.HEALTH_LINE.base, { level: L.HEALTH_LABEL[level] });
}

/** WP-4 新增的全部导出名（23 个）与其中的冻结映射表（5 张）。 */
const NEW_EXPORT_NAMES = Object.freeze([
  'HEALTH_LABEL', 'HEALTH_LINE', 'HEALTH_REASON', 'HEALTH_EVENT_LINE', 'LAYER_HEALTH',
  'TRACE_HEADER', 'TRACE_EMPTY_LINE', 'TRACE_MISSING_LINE', 'TRACE_SUMMARY',
  'TRACE_SPAN', 'TRACE_BACKFLOW_HEADER', 'TRACE_BACKFLOW_ROW',
  'TRACE_EMPTY', 'TRACE_NO_BACKFLOW', 'INSTANCE_MISSING', 'TRACE_RUNNING',
  'TRACE_NO_END', 'TRACE_DEGRADED',
  'SUMMARY_LABEL', 'SUMMARY_OUTPUT_LINES', 'SUMMARY_FAIL_LINE', 'SUMMARY_LOG_LINE',
  'EVENTS_SKIPPED'
]);
const TABLE_NAMES = Object.freeze([
  'HEALTH_LABEL', 'HEALTH_LINE', 'HEALTH_REASON', 'LAYER_HEALTH', 'SUMMARY_LABEL'
]);
/** 逐字约定的纯分隔符/占位（不含汉字，但仍属固定文案）。 */
const PURE_SYMBOLS = Object.freeze(['—', ' · ']);

// ---------------------------------------------------------------------------
// 1. 新键存在、类型、Object.freeze、中文/文案非空
// ---------------------------------------------------------------------------

test('WP-4: 23 个新导出全部存在、类型正确、均 Object.freeze 且文案非空', () => {
  assert.equal(NEW_EXPORT_NAMES.length, 23);
  for (const name of NEW_EXPORT_NAMES) {
    const value = L[name];
    assert.ok(value !== undefined, `${name} 缺失`);
    assert.equal(Object.isFrozen(value), true, `${name} 未 Object.freeze`);
    const isTable = TABLE_NAMES.includes(name);
    if (isTable) {
      assert.equal(typeof value, 'object', `${name} 应为冻结对象`);
      assert.ok(value !== null && !Array.isArray(value), `${name} 应为对象表`);
    } else {
      assert.equal(typeof value, 'string', `${name} 应为字符串`);
    }
    const strings = isTable ? Object.values(value) : [value];
    for (const s of strings) {
      assert.equal(typeof s, 'string', `${name} 含非字符串值`);
      assert.ok(s.length > 0, `${name} 含空字符串`);
      assert.ok(
        /[\u3400-\u9FFF]/.test(s) || PURE_SYMBOLS.includes(s),
        `${name} 的 "${s}" 不是中文文案`
      );
    }
  }
});

test('WP-4: 5 张新增映射表对象本身冻结且每个值为非空中文字符串', () => {
  for (const name of TABLE_NAMES) {
    const table = L[name];
    assert.equal(Object.isFrozen(table), true, `${name} 未冻结`);
    assert.ok(Object.keys(table).length > 0, `${name} 为空表`);
    for (const [key, value] of Object.entries(table)) {
      assert.equal(typeof value, 'string', `${name}.${key} 非字符串`);
      assert.ok(value.length > 0, `${name}.${key} 为空`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. 健康度：四档词、8 原因码、A-6 附 8 行、A-6 正文、A-8 文本行
// ---------------------------------------------------------------------------

test('A-0 / A-6: HEALTH_LABEL 四档词逐字（无 emoji、无英文档位词）', () => {
  assert.deepEqual({ ...L.HEALTH_LABEL }, {
    normal: '正常', slow: '慢', attention: '需关注', ended: '已结束'
  });
  for (const word of Object.values(L.HEALTH_LABEL)) {
    assert.ok(/^[\u3400-\u9FFF]+$/.test(word), `${word} 不是纯中文档位词`);
  }
});

test('D-3:968 / A-6 附: HEALTH_REASON 8 码键顺序与中文原因句逐字', () => {
  assert.deepEqual(Object.keys(L.HEALTH_REASON), [
    'pending_escalation', 'node_timeout', 'session_crash', 'role_unavailable',
    'connection_rejected', 'connection_expired', 'p90_exceeded', 'handoff_ttl_half'
  ]);
  assert.deepEqual({ ...L.HEALTH_REASON }, {
    pending_escalation: '有待处理升级',
    node_timeout: '节点 {nodeId} 执行超时',
    session_crash: '会话 {sessionId} 崩溃',
    role_unavailable: '角色 {role} 不可用',
    connection_rejected: '连接线 {connection} 已拒绝',
    connection_expired: '连接线 {connection} 已过期',
    p90_exceeded: '节点 {nodeId} 执行超过本实例 P90',
    handoff_ttl_half: '交接包 {handoffId} 待投递超过 TTL 一半'
  });
});

test('A-6 正文四组健康度行逐字（含无原因与带原因两种模板）', () => {
  assert.equal(healthBase('normal'), '健康度 正常');
  assert.equal(healthBase('ended'), '健康度 已结束');
  assert.equal(
    healthLine('slow', ['p90_exceeded'], { nodeId: 'T-002' }),
    '健康度 慢 · 节点 T-002 执行超过本实例 P90'
  );
  assert.equal(
    healthLine('attention', ['pending_escalation'], {}),
    '健康度 需关注 · 有待处理升级'
  );
  // A-6 附：多条原因按固定顺序用同一个 ` · ` 并列。
  assert.equal(
    healthLine('attention', ['pending_escalation', 'node_timeout'], { nodeId: 'T-001' }),
    '健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时'
  );
});

test('A-6 附: 8 条原因句逐字（用 A-9 的键渲染比对）', () => {
  const cases = [
    ['attention', ['pending_escalation'], {}, '健康度 需关注 · 有待处理升级'],
    ['attention', ['node_timeout'], { nodeId: 'T-001' }, '健康度 需关注 · 节点 T-001 执行超时'],
    ['attention', ['session_crash'], { sessionId: 'mock-sess-12345-1' }, '健康度 需关注 · 会话 mock-sess-12345-1 崩溃'],
    ['attention', ['role_unavailable'], { role: '开发' }, '健康度 需关注 · 角色 开发 不可用'],
    ['attention', ['connection_rejected'], { connection: '测试→开发' }, '健康度 需关注 · 连接线 测试→开发 已拒绝'],
    ['attention', ['connection_expired'], { connection: '测试→开发' }, '健康度 需关注 · 连接线 测试→开发 已过期'],
    ['slow', ['p90_exceeded'], { nodeId: 'T-006' }, '健康度 慢 · 节点 T-006 执行超过本实例 P90'],
    ['slow', ['handoff_ttl_half'], { handoffId: 'HO-006' }, '健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半']
  ];
  assert.equal(cases.length, 8);
  for (const [level, codes, vars, expected] of cases) {
    assert.equal(healthLine(level, codes, vars), expected);
  }
});

test('A-8: 健康度变化事件文本行逐字（中文档位 + 中文原因）', () => {
  const segment = fill(L.HEALTH_EVENT_LINE, {
    layer: L.LAYER_HEALTH.health,
    instanceId: 'INST-001',
    from: L.HEALTH_LABEL.normal,
    to: L.HEALTH_LABEL.attention,
    reasons: L.HEALTH_REASON.pending_escalation
  });
  assert.equal(
    `10:00:00  ${segment}`,
    '10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级'
  );
});

// ---------------------------------------------------------------------------
// 3. 追踪：A-1 / A-5 / A-10 / A-11 空形态、进行中、结束位、降级、层名
// ---------------------------------------------------------------------------

test('A-1 / A-5 / A-10 / A-11: 空形态、进行中、结束位、降级提示与层名逐字', () => {
  assert.equal(L.TRACE_EMPTY, '暂无追踪记录');
  assert.equal(fill(L.TRACE_EMPTY_LINE, { instanceId: 'INST-001' }), '实例 INST-001 · 暂无追踪记录');
  assert.equal(L.INSTANCE_MISSING, '不存在');
  assert.equal(fill(L.TRACE_MISSING_LINE, { instanceId: 'INST-999' }), '实例 INST-999 · 不存在');
  assert.equal(L.TRACE_NO_BACKFLOW, '无');
  assert.equal(L.TRACE_RUNNING, '进行中');
  assert.equal(L.TRACE_NO_END, '—');
  assert.equal(L.LAYER_HEALTH.health, '健康度');
  assert.equal(fill(L.TRACE_DEGRADED, { n: 1 }), '追踪记录有 1 行不可读，已跳过');
  const runningSpan = fill(L.TRACE_SPAN, {
    start: '10:00:00', end: L.TRACE_NO_END, node: 'T-001',
    result: L.TRACE_RUNNING, handoffs: 'HO-001'
  });
  assert.equal(runningSpan, '10:00:00 → —  T-001  进行中  交接 HO-001');
});

test('A-2 / A-3: 追踪头、汇总、跨度行、回流链逐字', () => {
  assert.equal(
    fill(L.TRACE_HEADER, { instanceId: 'INST-001', traceId: 'TRC-1a2b3c4d' }),
    '实例 INST-001 · 追踪 TRC-1a2b3c4d'
  );
  assert.equal(fill(L.TRACE_SUMMARY, { spans: 1, backflows: 0 }), '跨度 1 条 · 回流 0 次');
  assert.equal(fill(L.TRACE_SUMMARY, { spans: 3, backflows: 1 }), '跨度 3 条 · 回流 1 次');
  assert.equal(fill(L.TRACE_SUMMARY, { spans: 0, backflows: 0 }), '跨度 0 条 · 回流 0 次');
  assert.equal(L.TRACE_BACKFLOW_HEADER, '回流链');

  const spanVars = [
    { start: '10:00:00', end: '10:00:40', node: 'T-001 开发', result: '已完成', handoffs: 'HO-001' },
    { start: '10:00:40', end: '10:01:30', node: 'T-002 测试', result: '失败', handoffs: 'HO-001 HO-002' },
    { start: '10:01:30', end: '10:02:20', node: 'T-001 开发', result: '已完成', handoffs: 'HO-002' }
  ];
  assert.deepEqual(spanVars.map((v) => fill(L.TRACE_SPAN, v)), [
    '10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001',
    '10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002',
    '10:01:30 → 10:02:20  T-001 开发  已完成  交接 HO-002'
  ]);
  assert.equal(
    fill(L.TRACE_BACKFLOW_ROW, {
      round: 2, from: 'T-002 测试', to: 'T-001 开发', handoff: 'HO-002', state: '已完成'
    }),
    '第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成'
  );
});

// ---------------------------------------------------------------------------
// 4. 执行摘要：A-4 / A-12 / A-14；事件跳过行：A-13
// ---------------------------------------------------------------------------

test('A-4 / A-12 / A-14: 四要素标签、未提供、失败摘要行与执行摘要行逐字', () => {
  assert.deepEqual({ ...L.SUMMARY_LABEL }, {
    command: '命令', exitCode: '退出码', keyOutput: '关键输出', log: '日志', unavailable: '未提供'
  });
  assert.equal(L.SUMMARY_LABEL.unavailable, '未提供');
  assert.equal(fill(L.SUMMARY_OUTPUT_LINES, { n: 3 }), '3 行');

  const four = {
    command: 'node out/run.js', exitCode: '1',
    keyOutput: fill(L.SUMMARY_OUTPUT_LINES, { n: 3 }), log: 'host-logs/T-001.log'
  };
  assert.equal(
    fill(L.SUMMARY_FAIL_LINE, four),
    '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log'
  );
  assert.equal(
    fill(L.SUMMARY_LOG_LINE, {
      ts: '10:02:10', layer: L.LAYER.session, sessionId: 'mock-sess-12345-1', ...four
    }),
    '10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log'
  );
  const missing = L.SUMMARY_LABEL.unavailable;
  assert.equal(
    fill(L.SUMMARY_LOG_LINE, {
      ts: '10:03:00', layer: L.LAYER.session, sessionId: 'mock-sess-12345-1',
      command: missing, exitCode: missing, keyOutput: missing, log: missing
    }),
    '10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供'
  );
});

test('A-13: 事件不可读行提示逐字（与追踪侧 A-11 措辞不混用）', () => {
  assert.equal(fill(L.EVENTS_SKIPPED, { n: 1 }), '已跳过 1 行不可读记录');
  assert.equal(fill(L.EVENTS_SKIPPED, { n: 3 }), '已跳过 3 行不可读记录');
  assert.notEqual(L.EVENTS_SKIPPED, L.TRACE_DEGRADED);
});

// ---------------------------------------------------------------------------
// 5. 回归保护：USAGE_LINES、既有键、六张状态表（只读基线口径）
// ---------------------------------------------------------------------------

/** cli-assets.test.js:87-96 的前 8 行逐字口径。 */
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
/** cli-assets.test.js:98-117 的全 25 行 A-12 口径。 */
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

test('回归: USAGE_LINES 仍 25 行、冻结、全 25 行与前 8 行逐字不变', () => {
  assert.equal(L.USAGE_LINES.length, 25);
  assert.equal(Object.isFrozen(L.USAGE_LINES), true);
  assert.deepEqual([...L.USAGE_LINES], A12_LINES);
  assert.deepEqual(L.USAGE_LINES.slice(0, 8), USAGE_I15_FIRST_8);
});

test('回归: 抽 12 个既有键值逐字不变', () => {
  const legacy = [
    ['INSTANCE_LABEL.running', L.INSTANCE_LABEL.running, '运行中'],
    ['NODE_LABEL.done', L.NODE_LABEL.done, '已完成'],
    ['SESSION_LABEL.waiting_input', L.SESSION_LABEL.waiting_input, '等待审批'],
    ['HANDOFF_LABEL.consumed', L.HANDOFF_LABEL.consumed, '已完成'],
    ['ESCALATION_LABEL.pending', L.ESCALATION_LABEL.pending, '待处理'],
    ['APPROVAL_LABEL.approved', L.APPROVAL_LABEL.approved, '已通过'],
    ['LAYER.instance', L.LAYER.instance, '实例'],
    ['LAYER.session', L.LAYER.session, '会话'],
    ['HANDOFF_DIRECTION.backflow', L.HANDOFF_DIRECTION.backflow, '回流'],
    ['ERROR_TEMPLATE.UNKNOWN_ERROR', L.ERROR_TEMPLATE.UNKNOWN_ERROR, '未知错误：{raw}'],
    ['ROLE_WRITE_SUPPLEMENT.unknownField', L.ROLE_WRITE_SUPPLEMENT.unknownField, '未知字段：{key}'],
    ['TEMPLATE_LABEL[task-loop]', L.TEMPLATE_LABEL['task-loop'], '通用任务闭环']
  ];
  assert.equal(legacy.length, 12);
  for (const [name, actual, expected] of legacy) {
    assert.equal(actual, expected, `${name} 被改动`);
  }
});

test('回归: 新键未并入六张状态表（labels-sync 映射表口径不受破坏）', () => {
  const six = {
    instance: L.INSTANCE_LABEL, node: L.NODE_LABEL, session: L.SESSION_LABEL,
    handoff: L.HANDOFF_LABEL, escalation: L.ESCALATION_LABEL, approval: L.APPROVAL_LABEL
  };
  const expectedKeys = {
    instance: ['created', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'suspended'],
    node: ['pending', 'running', 'review', 'done', 'failed', 'cancelled', 'escalated'],
    session: ['idle', 'thinking', 'tool_running', 'waiting_input', 'waiting_dependency', 'escalated'],
    handoff: ['created', 'delivered', 'pending', 'accepted', 'consumed', 'rejected', 'expired'],
    escalation: ['pending', 'resolved', 'voided'],
    approval: ['pending', 'approved', 'denied', 'withdrawn']
  };
  const forbidden = [
    'health', 'normal', 'slow', 'attention', 'ended',
    'pending_escalation', 'node_timeout', 'session_crash', 'role_unavailable',
    'connection_rejected', 'connection_expired', 'p90_exceeded', 'handoff_ttl_half',
    'unavailable', 'empty', 'degraded'
  ];
  for (const [name, table] of Object.entries(six)) {
    assert.equal(Object.isFrozen(table), true, `${name} 表未冻结`);
    assert.deepEqual(Object.keys(table), expectedKeys[name], `${name} 键集合被改动`);
    for (const key of forbidden) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(table, key), false,
        `新键 ${key} 被并入 ${name} 状态表`
      );
    }
    // 与 CORE_TEXT 对应表逐字一致（labels-sync 的核心交叉比对口径）。
    assert.deepEqual({ ...CORE_TEXT[name] }, { ...table }, `${name} 与 CORE_TEXT 不一致`);
  }
});
