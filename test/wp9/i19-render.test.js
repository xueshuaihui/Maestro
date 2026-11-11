/**
 * I1.9 WP-6 渲染纯函数契约测试：逐字覆盖需求 v7 附录 A-1 ~ A-14 全部 15 节用户可见基线。
 *
 * 纯内存：只 import 渲染函数与 labels.js 常量表并做字符串逐字比对，不读数据文件、不写磁盘、
 * 不起进程。中文、空格、缩进、分隔符（` · ` / `→` / 两个半角空格）、`—`、单位按附录 A 固定。
 *
 * 可变值口径（A-0）：时刻 / 追踪号 / 节点号与标题 / 会话号 / 交接包号 / 摘要四项 / 跳过行数
 * 先用夹具实参替换再逐字比较。时刻用 `iso(h,m,s)` 按本地时区构造，`formatClock` 恒返回
 * `HH:MM:SS`，跨测试机时区稳定；其余可变值按附录 A 的示例值在夹具里逐字回填。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderHealthLine,
  renderTraceShow,
  renderSummaryLogLine,
  renderHealthEventLine,
  renderEventsSkippedLine,
  renderEventLine,
  renderEventLines,
  renderGraphJson,
  renderGraphText,
  renderNodeLines,
  formatClock,
} from '../../src/cli/render.js';
import * as L from '../../src/cli/labels.js';
import { renderStatusDoc, CORE_TEXT } from '../../src/core/status-text.js';
import { computeHealth } from '../../src/core/health.js';

/** 本地时区绝对时刻：formatClock(iso(h,m,s)) 恒为 `HH:MM:SS`（与测试机时区无关）。 */
const iso = (h, m, s) => new Date(2026, 10, 10, h, m, s).toISOString();
const T0 = iso(10, 0, 0);
const T_0_40 = iso(10, 0, 40);
const T_1_30 = iso(10, 1, 30);
const T_2_10 = iso(10, 2, 10);
const T_2_20 = iso(10, 2, 20);
const T_3_00 = iso(10, 3, 0);

/** 占位符替换：仅替换 `{word}`，未知键原样保留。 */
function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, key) => (vars[key] === undefined ? m : String(vars[key])));
}

/** 追踪 payload 基准形状（详见交付回执 D-11）。 */
function tracePayload(overrides = {}) {
  return {
    instanceId: 'INST-001',
    exists: true,
    traceId: 'TRC-1a2b3c4d',
    spans: [],
    backflows: [],
    badLines: 0,
    ...overrides,
  };
}

/** 一条已落地跨度；title 为 null 时节点列只显示节点号。 */
function landed(overrides = {}) {
  return {
    start_time: T0,
    end_time: T_2_10,
    node_id: 'T-001',
    title: null,
    result: '已完成',
    handoff_ids: ['HO-001'],
    summary: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A-1 / A-5 / A-2 / A-3 / A-10 / A-11：orch trace show 的形态
// ---------------------------------------------------------------------------

test('A-1 空追踪：实例 INST-001 · 暂无追踪记录', () => {
  assert.equal(
    renderTraceShow(tracePayload({ traceId: '', spans: [], badLines: 0 })),
    '实例 INST-001 · 暂无追踪记录'
  );
  // traceId 为 null 同样按空追踪处理。
  assert.equal(
    renderTraceShow(tracePayload({ traceId: null, spans: [], badLines: 0 })),
    '实例 INST-001 · 暂无追踪记录'
  );
  // D-26：D-19 后实例恒有 traceId，空态只看跨度是否为空 —— traceId 非空但无跨度仍为 A-1。
  assert.equal(
    renderTraceShow(tracePayload({ traceId: 'TRC-1a2b3c4d', spans: [], badLines: 0 })),
    '实例 INST-001 · 暂无追踪记录'
  );
});

test('A-2 单节点、无回流：逐字整份输出（含回流链「无」两行）', () => {
  const out = renderTraceShow(tracePayload({ spans: [landed()] }));
  assert.equal(
    out,
    [
      '实例 INST-001 · 追踪 TRC-1a2b3c4d',
      '跨度 1 条 · 回流 0 次',
      '',
      '10:00:00 → 10:02:10  T-001  已完成  交接 HO-001',
      '',
      '回流链',
      '无',
    ].join('\n')
  );
  // 无 title 时节点列只显示节点号，不输出 roleId 原文。
  assert.equal(out.includes('worker'), false);
});

test('A-3 一次回流的跨角色因果链：逐字整份输出（3 条跨角色跨度、无进行中行）', () => {
  const spans = [
    landed({ start_time: T0, end_time: T_0_40, node_id: 'T-001', title: '开发', result: '已完成', handoff_ids: ['HO-001'] }),
    landed({ start_time: T_0_40, end_time: T_1_30, node_id: 'T-002', title: '测试', result: '失败', handoff_ids: ['HO-001', 'HO-002'] }),
    landed({ start_time: T_1_30, end_time: T_2_20, node_id: 'T-001', title: '开发', result: '已完成', handoff_ids: ['HO-002'] }),
  ];
  const backflows = [{ round: 2, from: 'T-002 测试', to: 'T-001 开发', handoff: 'HO-002', state: '已完成' }];
  const out = renderTraceShow(tracePayload({ spans, backflows }));
  assert.equal(
    out,
    [
      '实例 INST-001 · 追踪 TRC-1a2b3c4d',
      '跨度 3 条 · 回流 1 次',
      '',
      '10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001',
      '10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002',
      '10:01:30 → 10:02:20  T-001 开发  已完成  交接 HO-002',
      '',
      '回流链',
      '第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成',
    ].join('\n')
  );
  // 逐字覆盖要求：不含进行中行、不含角色 roleId 原文。
  assert.equal(out.includes('进行中'), false);
  assert.equal(out.includes('worker'), false);
  assert.equal(out.split('\n').filter((line) => line.includes('→') && line.includes('交接')).length, 3);
});

test('D-25 / A-3：失败跨度 summary 四项全 null 时不渲染失败摘要行，其余逐字同 A-3', () => {
  const spans = [
    landed({ start_time: T0, end_time: T_0_40, node_id: 'T-001', title: '开发', result: '已完成', handoff_ids: ['HO-001'] }),
    landed({
      start_time: T_0_40, end_time: T_1_30, node_id: 'T-002', title: '测试', result: '失败',
      handoff_ids: ['HO-001', 'HO-002'],
      summary: { command: null, exitCode: null, keyOutputLines: null, logRef: null },
    }),
    landed({ start_time: T_1_30, end_time: T_2_20, node_id: 'T-001', title: '开发', result: '已完成', handoff_ids: ['HO-002'] }),
  ];
  const backflows = [{ round: 2, from: 'T-002 测试', to: 'T-001 开发', handoff: 'HO-002', state: '已完成' }];
  const out = renderTraceShow(tracePayload({ spans, backflows }));
  assert.equal(
    out,
    [
      '实例 INST-001 · 追踪 TRC-1a2b3c4d',
      '跨度 3 条 · 回流 1 次',
      '',
      '10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001',
      '10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002',
      '10:01:30 → 10:02:20  T-001 开发  已完成  交接 HO-002',
      '',
      '回流链',
      '第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成',
    ].join('\n')
  );
  assert.equal(out.includes('失败摘要'), false);
});

test('A-4 失败摘要四要素：缩进 2 半角空格的失败摘要行，四项逐字', () => {
  const spans = [
    landed({
      start_time: T_0_40,
      end_time: T_1_30,
      result: '失败',
      summary: { command: 'node out/run.js', exitCode: 1, keyOutputLines: 3, logRef: 'host-logs/T-001.log' },
    }),
  ];
  const out = renderTraceShow(tracePayload({ spans }));
  const failLine = '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log';
  assert.ok(out.split('\n').includes(failLine));
  // 行首恰好两个半角空格。
  assert.equal(/^ {2}\S/.test(failLine), true);
  // 失败摘要行紧随失败跨度行（相对顺序）。
  const lines = out.split('\n');
  const idx = lines.indexOf(failLine);
  assert.equal(lines[idx - 1], '10:00:40 → 10:01:30  T-001  失败  交接 HO-001');
});

test('A-4 缺项"未提供"：缺项替换、其余项不省略', () => {
  const spans = [
    landed({
      start_time: T_0_40,
      end_time: T_1_30,
      result: '失败',
      summary: { command: null, exitCode: 1, keyOutputLines: null, logRef: 'host-logs/T-001.log' },
    }),
  ];
  const out = renderTraceShow(tracePayload({ spans }));
  assert.ok(
    out.split('\n').includes(
      '  失败摘要 命令 未提供 · 退出码 1 · 关键输出 未提供 · 日志 host-logs/T-001.log'
    )
  );
});

test('D-25 / A-4：summary 部分缺项（命令+退出码有值、另两项 null）仍渲染一行', () => {
  const spans = [
    landed({
      start_time: T_0_40,
      end_time: T_1_30,
      result: '失败',
      summary: { command: 'node out/run.js', exitCode: 1, keyOutputLines: null, logRef: null },
    }),
  ];
  const out = renderTraceShow(tracePayload({ spans }));
  assert.ok(
    out.split('\n').includes(
      '  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 未提供 · 日志 未提供'
    )
  );
});

test('D-25：0 与空串算「有值」，只有 null/undefined 算缺（四项皆非 null 仍渲染）', () => {
  const spans = [
    landed({
      start_time: T_0_40,
      end_time: T_1_30,
      result: '失败',
      summary: { command: '', exitCode: 0, keyOutputLines: 0, logRef: '' },
    }),
  ];
  const out = renderTraceShow(tracePayload({ spans }));
  assert.ok(
    out.split('\n').includes('  失败摘要 命令  · 退出码 0 · 关键输出 0 行 · 日志 ')
  );
});

test('A-5 实例不存在：实例 INST-999 · 不存在', () => {
  assert.equal(
    renderTraceShow(tracePayload({ instanceId: 'INST-999', exists: false })),
    '实例 INST-999 · 不存在'
  );
});

test('A-10 进行中的跨度：跨度 0 条、结束位 —、结果位 进行中、回流链「无」', () => {
  const spans = [
    landed({ end_time: null, result: '进行中', title: null }),
  ];
  const out = renderTraceShow(tracePayload({ spans }));
  assert.equal(
    out,
    [
      '实例 INST-001 · 追踪 TRC-1a2b3c4d',
      '跨度 0 条 · 回流 0 次',
      '',
      '10:00:00 → —  T-001  进行中  交接 HO-001',
      '',
      '回流链',
      '无',
    ].join('\n')
  );
  assert.equal(out.includes('暂无追踪记录'), false);
});

test('A-11 追踪文件有不可读行：提示行位于汇总行之前；文件整体缺失按 A-1', () => {
  const spans = [
    landed({ start_time: T0, end_time: T_0_40 }),
    landed({ start_time: T_0_40, end_time: T_1_30 }),
  ];
  const lines = renderTraceShow(tracePayload({ spans, badLines: 1 })).split('\n');
  // 附录 A-11 的三行逐字基线（正常跨度的行照常列出）。
  assert.equal(lines[0], '实例 INST-001 · 追踪 TRC-1a2b3c4d');
  assert.equal(lines[1], '追踪记录有 1 行不可读，已跳过');
  assert.equal(lines[2], '跨度 2 条 · 回流 0 次');
  assert.ok(lines.includes('10:00:00 → 10:00:40  T-001  已完成  交接 HO-001'));
  assert.ok(lines.includes('10:00:40 → 10:01:30  T-001  已完成  交接 HO-001'));
  assert.ok(lines.includes('回流链'));
  // 追踪文件整体缺失时不出现该提示，按 A-1。
  const missing = renderTraceShow(tracePayload({ traceId: '', spans: [], badLines: 0 }));
  assert.equal(missing, '实例 INST-001 · 暂无追踪记录');
  assert.equal(missing.includes('不可读'), false);
});

// ---------------------------------------------------------------------------
// A-6 四组四档 / A-6 附 8 行原因句逐字 / 多原因并列按 8 码固定顺序
// ---------------------------------------------------------------------------

test('A-6 四组四档逐字（正常 / 慢 / 需关注 / 已结束）', () => {
  assert.equal(renderHealthLine({ health: { level: 'normal', reasons: [] } }, 0), '健康度 正常');
  assert.equal(
    renderHealthLine({ health: { level: 'slow', reasons: [{ code: 'p90_exceeded', nodeId: 'T-002' }] } }, 0),
    '健康度 慢 · 节点 T-002 执行超过本实例 P90'
  );
  assert.equal(
    renderHealthLine({ health: { level: 'attention', reasons: ['pending_escalation'] } }, 0),
    '健康度 需关注 · 有待处理升级'
  );
  assert.equal(renderHealthLine({ health: { level: 'ended', reasons: [] } }, 0), '健康度 已结束');
});

test('A-6 健康度缺省降级：state.health 缺 level 按 normal、不抛错', () => {
  assert.equal(renderHealthLine({}, 0), '健康度 正常');
  assert.equal(renderHealthLine({ health: {} }, 0), '健康度 正常');
  assert.equal(renderHealthLine(null, 0), '健康度 正常');
});

test('A-6 附 8 行原因句逐字（逐条单命中）', () => {
  const cases = [
    ['attention', 'pending_escalation', {}, '健康度 需关注 · 有待处理升级'],
    ['attention', 'node_timeout', { nodeId: 'T-001' }, '健康度 需关注 · 节点 T-001 执行超时'],
    ['attention', 'session_crash', { sessionId: 'mock-sess-12345-1' }, '健康度 需关注 · 会话 mock-sess-12345-1 崩溃'],
    ['attention', 'role_unavailable', { role: '开发' }, '健康度 需关注 · 角色 开发 不可用'],
    ['attention', 'connection_rejected', { connection: '测试→开发' }, '健康度 需关注 · 连接线 测试→开发 已拒绝'],
    ['attention', 'connection_expired', { connection: '测试→开发' }, '健康度 需关注 · 连接线 测试→开发 已过期'],
    ['slow', 'p90_exceeded', { nodeId: 'T-006' }, '健康度 慢 · 节点 T-006 执行超过本实例 P90'],
    ['slow', 'handoff_ttl_half', { handoffId: 'HO-006' }, '健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半'],
  ];
  assert.equal(cases.length, 8);
  for (const [level, code, vars, expected] of cases) {
    const reason = Object.keys(vars).length > 0 ? { code, ...vars } : code;
    assert.equal(renderHealthLine({ health: { level, reasons: [reason] } }, 0), expected);
  }
});

test('A-6 附 多原因并列按 8 码固定顺序用 ` · ` 连接', () => {
  // 两条并列（附录 A-6 附示例）。
  assert.equal(
    renderHealthLine(
      { health: { level: 'attention', reasons: ['pending_escalation', { code: 'node_timeout', nodeId: 'T-001' }] } },
      0
    ),
    '健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时'
  );
  // 8 码全命中：顺序与 D-3:968 固定顺序一致，逐字用 ` · ` 连接。
  const all = [
    'pending_escalation',
    { code: 'node_timeout', nodeId: 'T-001' },
    { code: 'session_crash', sessionId: 'mock-sess-12345-1' },
    { code: 'role_unavailable', role: '开发' },
    { code: 'connection_rejected', connection: '测试→开发' },
    { code: 'connection_expired', connection: '测试→开发' },
    { code: 'p90_exceeded', nodeId: 'T-006' },
    { code: 'handoff_ttl_half', handoffId: 'HO-006' },
  ];
  const expected = '健康度 需关注' + L.HEALTH_LINE.sep + [
    '有待处理升级',
    '节点 T-001 执行超时',
    '会话 mock-sess-12345-1 崩溃',
    '角色 开发 不可用',
    '连接线 测试→开发 已拒绝',
    '连接线 测试→开发 已过期',
    '节点 T-006 执行超过本实例 P90',
    '交接包 HO-006 待投递超过 TTL 一半',
  ].join(L.HEALTH_LINE.sep);
  assert.equal(renderHealthLine({ health: { level: 'attention', reasons: all } }, 0), expected);
});

// ---------------------------------------------------------------------------
// A-7 status.md 健康度行（CORE_TEXT.doc.health 镜像 + 同表同序）
// ---------------------------------------------------------------------------

test('A-7 status.md：- 状态 之后插入 - 健康度：需关注 · 有待处理升级', () => {
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't', updatedAt: '2026-11-10T10:00:00.000Z',
    nodes: [], handoffs: [], escalations: [], approvals: [],
    health: { level: 'attention', reasons: ['pending_escalation'] },
  };
  const text = renderStatusDoc(state, null, {});
  assert.ok(text.includes('- 状态：运行中\n- 健康度：需关注 · 有待处理升级\n- 暂停：否\n'));
  // CORE_TEXT.doc.health 镜像 labels.js（A-9 归属）。
  assert.equal(CORE_TEXT.doc.health, L.LAYER_HEALTH.health);
  assert.equal(CORE_TEXT.doc.health, '健康度');
});

test('A-7 健康度缺省降级：state.health 缺 level 渲染 - 健康度：正常', () => {
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't', updatedAt: '2026-11-10T10:00:00.000Z',
    nodes: [], handoffs: [], escalations: [], approvals: [],
  };
  const text = renderStatusDoc(state, null, {});
  assert.ok(text.includes('- 状态：运行中\n- 健康度：正常\n- 暂停：否\n'));
  // single 不输出 ## 节点 段（既有段名零改）。
  assert.equal(text.includes('## 节点'), false);
});

// ---------------------------------------------------------------------------
// A-8 健康度变化事件文本行（自补 HH:MM:SS + 2 个半角空格）
// ---------------------------------------------------------------------------

test('A-8 文本行逐字：10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级', () => {
  const event = {
    object: 'health', objectId: 'INST-001', from: 'normal', to: 'attention',
    result: 'applied', reason: 'health.changed',
    detail: { reasons: ['pending_escalation'] }, ts: T0,
  };
  assert.equal(
    renderHealthEventLine(event),
    '10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级'
  );
  // 行首时刻由 formatClock 自补 + 两个半角空格（HEALTH_EVENT_LINE 不含 {ts}）。
  assert.equal(event.ts, T0);
  assert.equal(formatClock(T0), '10:00:00');
  // 中文档位来自同一张 HEALTH_LABEL。
  assert.equal(L.HEALTH_LABEL.normal, '正常');
  assert.equal(L.HEALTH_LABEL.attention, '需关注');
  // 经 renderEventLines 分派得到单行数组。
  assert.deepEqual(
    renderEventLines(event, { template: 'single' }),
    ['10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级']
  );
});

// ---------------------------------------------------------------------------
// A-12 / A-14 执行摘要行；A-13 跳过行
// ---------------------------------------------------------------------------

function summaryEvent(ts, summary) {
  return {
    object: 'session', objectId: 'mock-sess-12345-1', reason: 'execution.summary',
    ts, detail: { summary },
  };
}

const FULL_SUMMARY = { command: 'node out/run.js', exitCode: 1, keyOutputLines: 3, logRef: 'host-logs/T-001.log' };

test('A-12 执行摘要行逐字（层名 会话、四项、缺项降级同模板）', () => {
  const event = summaryEvent(T_2_10, FULL_SUMMARY);
  assert.equal(
    renderSummaryLogLine(event),
    '10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log'
  );
  // keyOutputLines 带单位（`{n} 行`）；时刻取 event.ts 经 formatClock；层名取 LAYER.session。
  assert.equal(L.SUMMARY_OUTPUT_LINES, '{n} 行');
  assert.equal(formatClock(T_2_10), '10:02:10');
  assert.equal(L.LAYER.session, '会话');
  assert.deepEqual(
    renderEventLines(event, { template: 'single' }),
    ['10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log']
  );
});

test('A-14 取消四项全"未提供"：复用同一行模板 SUMMARY_LOG_LINE', () => {
  const event = summaryEvent(T_3_00, { command: null, exitCode: null, keyOutputLines: null, logRef: null });
  const expected = '10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供';
  const out = renderSummaryLogLine(event);
  assert.equal(out, expected);
  // 同一行模板：手工用 SUMMARY_LOG_LINE 填充 A-14 实参，与函数输出逐字一致。
  const manual = fill(L.SUMMARY_LOG_LINE, {
    ts: '10:03:00', layer: L.LAYER.session, sessionId: 'mock-sess-12345-1',
    command: L.SUMMARY_LABEL.unavailable, exitCode: L.SUMMARY_LABEL.unavailable,
    keyOutput: L.SUMMARY_LABEL.unavailable, log: L.SUMMARY_LABEL.unavailable,
  });
  assert.equal(out, manual);
  assert.equal(out.includes('\n'), false);
  assert.deepEqual(renderEventLines(event, { template: 'single' }), [expected]);
});

test('A-13 事件不可读行提示：单独成行、不带时刻前缀、填 {n}', () => {
  assert.equal(renderEventsSkippedLine(1), '已跳过 1 行不可读记录');
  assert.equal(renderEventsSkippedLine(3), '已跳过 3 行不可读记录');
  // 单独成行、不带时刻前缀。
  assert.equal(/^\d{2}:\d{2}:\d{2}/.test(renderEventsSkippedLine(1)), false);
  assert.equal(renderEventsSkippedLine(1).includes('\n'), false);
});

// ---------------------------------------------------------------------------
// 回归：renderEventLines 对既有事件样本的行格式与相对顺序零改；graph 不含健康度字段
// ---------------------------------------------------------------------------

test('回归：renderEventLines 既有事件样本行格式与相对顺序不变', () => {
  const TS = iso(10, 0, 5);
  const cases = [
    {
      tpl: 'single',
      ev: { object: 'session', objectId: 'sess-1', from: 'idle', to: 'thinking', reason: 'turn.first_event', result: 'applied', seq: 1, ts: TS, detail: { event: 'first_event' } },
      expected: ['10:00:05  会话 sess-1  空闲 → 执行中  原因 turn.first_event'],
    },
    {
      tpl: 'code-loop',
      ev: { object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', reason: 'handoff.delivered', result: 'applied', seq: 18, ts: TS, detail: {} },
      expected: ['[#18] 10:00:05  交接包 HO-001  已构造 → 已投递  原因 交接已投递'],
    },
    {
      tpl: 'single',
      ev: { object: 'node', objectId: 'T-001', from: 'done', to: 'running', reason: 'node.transit', result: 'rejected', seq: 3, ts: TS },
      expected: ['10:00:05  节点 T-001  拒绝的迁移：已完成 → 执行中'],
    },
    {
      tpl: 'code-loop',
      ev: { object: 'node', objectId: 'T-001', from: 'failed', to: 'running', reason: 'backflow.constructed', result: 'applied', seq: 20, ts: TS, detail: { defects: [{ summary: 'def x', evidence: 'ev y' }], retestRequirement: 'recheck' } },
      expected: [
        '[#20] 10:00:05  节点 T-001  失败 → 执行中  原因 构造回流',
        '      缺陷 1：def x（证据 ev y）',
        '      复测要求：recheck',
      ],
    },
    {
      tpl: 'task-loop',
      ev: { object: 'node', objectId: 'T-003', from: 'review', to: 'running', reason: 'node.dispatch', result: 'note', seq: 9, ts: TS, detail: { round: 2 } },
      expected: ['[#9] 10:00:05  节点 T-003  派发'],
    },
  ];
  for (const { tpl, ev, expected } of cases) {
    assert.deepEqual(renderEventLines(ev, { template: tpl }), expected);
    // 首行仍由零改的 renderEventLine 产出（既有行格式）。
    assert.equal(renderEventLines(ev, { template: tpl })[0], renderEventLine(ev, { template: tpl }));
  }
});

test('回归：STATE_LABEL.health 指向 HEALTH_LABEL（health 对象事件中文档位）', () => {
  const ev = {
    object: 'health', objectId: 'INST-001', from: 'normal', to: 'slow',
    reason: 'health.tick', result: 'applied', seq: 2, ts: T0,
  };
  // D-7：既有 LAYER 表零改、无 health 键，故 layerName('health') 回落为 'health'。
  // 用户可见的健康度事件（health.changed）走 renderEventLines 分派分支，
  // 层名取 LAYER_HEALTH.health = '健康度'（A-8）；本用例只验证 STATE_LABEL.health
  // 让档位取 HEALTH_LABEL：'正常 → 慢'。
  assert.equal(renderEventLine(ev, { template: 'code-loop' }), '[#2] 10:00:00  health INST-001  正常 → 慢  原因 health.tick');
  assert.equal(L.HEALTH_LABEL.normal, '正常');
  assert.equal(L.HEALTH_LABEL.slow, '慢');
});

test('回归：instance graph / 节点行既有格式零改，不出现健康度字段', () => {
  const state = {
    instanceId: 'INST-001', state: 'running', template: 'code-loop',
    nodes: [{ nodeId: 'T-001', title: '开发', roleId: 'r1', state: 'done', round: 1 }],
    handoffs: [], escalations: [], approvals: [],
  };
  const graph = { title: '编码闭环', nodes: [{ id: 'T-001', title: '开发' }], edges: [] };
  assert.equal(renderGraphJson(state, graph).includes('健康度'), false);
  assert.equal(renderGraphText(state, graph).join('\n').includes('健康度'), false);
  assert.equal(renderNodeLines(state, { template: 'code-loop' }).join('\n').includes('健康度'), false);
});

// ---------------------------------------------------------------------------
// D-12：真实快照（reasons 为纯码值数组 + 真实 nodes/sessions/handoffs）逐字覆盖 A-6 附
// ---------------------------------------------------------------------------

const HNOW = 1_700_000_000_000;
const TRACES_5 = [10000, 20000, 30000, 40000, 50000].map((duration, i) => ({
  trace_id: `TRC-${i}`, instance_id: 'INST-001', node_id: `T-x${i}`,
  round: 1, start_time: 0, end_time: duration, status: 'done',
}));

/** 由真实快照经 computeHealth 计算 level/reasons（纯码值）后写回 state.health。 */
function realHealthState(build, extra = {}) {
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't',
    updatedAt: '2026-11-10T10:00:00.000Z',
    nodes: [], sessions: [], handoffs: [], escalations: [], approvals: [],
    health: { nodeTimeoutMs: 30000 },
  };
  build(state);
  const { level, reasons } = computeHealth({ state, now: HNOW, ...extra });
  // 主契约：computeHealth 返回的 reasons 恒为纯码值字符串数组（D-12 ①）。
  assert.equal(Array.isArray(reasons), true);
  for (const code of reasons) assert.equal(typeof code, 'string');
  state.health = { ...state.health, level, reasons };
  return state;
}

/** 同一组快照下 CLI 行与 status.md 行的中文原因句必须逐字一致（D-12 ②）。 */
function assertSameSentences(state, expectedLine) {
  assert.equal(renderHealthLine(state, HNOW), expectedLine);
  const body = expectedLine.slice('健康度 '.length);
  const docLine = renderStatusDoc(state, null, {}).split('\n')
    .find((line) => line.startsWith('- 健康度：'));
  assert.equal(docLine, `- 健康度：${body}`);
  return body;
}

/** A-6 附 8 行：每行一个真实快照，reasons 为纯码值数组，占位符实参由快照推导。 */
const REAL_REASON_CASES = [
  {
    code: 'pending_escalation',
    expected: '健康度 需关注 · 有待处理升级',
    build: (s) => { s.escalations = [{ state: 'pending' }]; },
  },
  {
    code: 'node_timeout',
    expected: '健康度 需关注 · 节点 T-001 执行超时',
    build: (s) => {
      s.nodes = [{ nodeId: 'T-001', roleId: 'developer', state: 'running', startedAt: HNOW - 31000 }];
    },
  },
  {
    code: 'session_crash',
    expected: '健康度 需关注 · 会话 mock-sess-12345-1 崩溃',
    build: (s) => {
      s.nodes = [{ nodeId: 'T-001', roleId: 'developer', state: 'failed' }];
      s.sessions = [{ sessionId: 'mock-sess-12345-1', nodeId: 'T-001', state: 'idle', quarantined: true }];
    },
  },
  {
    code: 'role_unavailable',
    expected: '健康度 需关注 · 角色 开发 不可用',
    build: (s) => {
      s.nodes = [{ nodeId: 'T-001', roleId: 'developer', state: 'done' }];
      s.sessions = [{ sessionId: 's1', nodeId: 'T-001', state: 'escalated', quarantined: false }];
    },
  },
  {
    code: 'connection_rejected',
    expected: '健康度 需关注 · 连接线 测试→开发 已拒绝',
    build: (s) => {
      s.nodes = [
        { nodeId: 'T-001', roleId: 'developer', state: 'done' },
        { nodeId: 'T-002', roleId: 'tester', state: 'failed' },
      ];
      s.handoffs = [{ handoffId: 'HO-001', state: 'rejected', fromNodeId: 'T-002', toNodeId: 'T-001' }];
    },
  },
  {
    code: 'connection_expired',
    expected: '健康度 需关注 · 连接线 测试→开发 已过期',
    build: (s) => {
      s.nodes = [
        { nodeId: 'T-001', roleId: 'developer', state: 'done' },
        { nodeId: 'T-002', roleId: 'tester', state: 'failed' },
      ];
      s.handoffs = [{ handoffId: 'HO-001', state: 'expired', fromNodeId: 'T-002', toNodeId: 'T-001' }];
    },
  },
  {
    code: 'p90_exceeded',
    expected: '健康度 慢 · 节点 T-006 执行超过本实例 P90',
    build: (s) => {
      s.health.nodeTimeoutMs = 300000;
      s.nodes = [{ nodeId: 'T-006', roleId: 'developer', state: 'running', startedAt: HNOW - 70000 }];
    },
    extra: { traces: TRACES_5 },
  },
  {
    code: 'handoff_ttl_half',
    expected: '健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半',
    build: (s) => {
      s.health.nodeTimeoutMs = 300000;
      s.handoffs = [{ handoffId: 'HO-006', state: 'pending', pendingAt: HNOW - 900001 }];
    },
  },
];

test('D-12 / A-6 附 8 行：纯码值 reasons + 真实快照推导，两处渲染逐字一致', () => {
  assert.equal(REAL_REASON_CASES.length, 8);
  for (const { code, expected, build, extra } of REAL_REASON_CASES) {
    const state = realHealthState(build, extra ?? {});
    assert.equal(state.health.reasons.includes(code), true, `${code} 未被 computeHealth 命中`);
    assertSameSentences(state, expected);
  }
});

test('D-12 / A-6 附 多原因并列：6 红码 + 2 黄码按 8 码固定顺序（真实 computeHealth 输出）', () => {
  // 6 个红码同时命中：computeHealth 返回固定顺序的纯码值数组。
  const red = realHealthState((s) => {
    s.escalations = [{ state: 'pending' }];
    s.nodes = [
      { nodeId: 'T-001', roleId: 'developer', state: 'running', startedAt: HNOW - 31000 },
      { nodeId: 'T-002', roleId: 'tester', state: 'failed' },
    ];
    s.sessions = [
      { sessionId: 'mock-sess-12345-1', nodeId: 'T-002', state: 'idle', quarantined: true },
      { sessionId: 's2', nodeId: 'T-001', state: 'escalated', quarantined: false },
    ];
    s.handoffs = [
      { handoffId: 'HO-001', state: 'rejected', fromNodeId: 'T-002', toNodeId: 'T-001' },
      { handoffId: 'HO-002', state: 'expired', fromNodeId: 'T-002', toNodeId: 'T-001' },
    ];
  });
  assert.deepEqual(red.health.reasons, [
    'pending_escalation', 'node_timeout', 'session_crash', 'role_unavailable',
    'connection_rejected', 'connection_expired',
  ]);
  assertSameSentences(
    red,
    '健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时 · 会话 mock-sess-12345-1 崩溃 · 角色 开发 不可用 · 连接线 测试→开发 已拒绝 · 连接线 测试→开发 已过期'
  );

  // 2 个黄码（无红档短路），固定顺序。
  const yellow = realHealthState((s) => {
    s.health.nodeTimeoutMs = 300000;
    s.nodes = [{ nodeId: 'T-006', roleId: 'developer', state: 'running', startedAt: HNOW - 70000 }];
    s.handoffs = [{ handoffId: 'HO-006', state: 'pending', pendingAt: HNOW - 900001 }];
  }, { traces: TRACES_5 });
  assert.deepEqual(yellow.health.reasons, ['p90_exceeded', 'handoff_ttl_half']);
  assertSameSentences(
    yellow,
    '健康度 慢 · 节点 T-006 执行超过本实例 P90 · 交接包 HO-006 待投递超过 TTL 一半'
  );
});

test('D-12 / A-6 附 8 码全并列：纯码值数组按固定顺序用 ` · ` 连接（推导不抛错）', () => {
  // 手工 8 码纯码值数组（真实形态 string[]）；node_timeout 与 p90_exceeded 共用首个 running 节点。
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't', updatedAt: 'x',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'running' },
      { nodeId: 'T-002', roleId: 'tester', state: 'failed' },
    ],
    sessions: [
      { sessionId: 'mock-sess-12345-1', nodeId: 'T-002', quarantined: true },
      { sessionId: 's2', nodeId: 'T-001', state: 'escalated', quarantined: false },
    ],
    handoffs: [
      { handoffId: 'HO-001', state: 'rejected', fromNodeId: 'T-002', toNodeId: 'T-001' },
      { handoffId: 'HO-002', state: 'expired', fromNodeId: 'T-002', toNodeId: 'T-001' },
      { handoffId: 'HO-006', state: 'pending' },
    ],
    escalations: [{ state: 'pending' }], approvals: [],
    health: {
      level: 'attention',
      reasons: [
        'pending_escalation', 'node_timeout', 'session_crash', 'role_unavailable',
        'connection_rejected', 'connection_expired', 'p90_exceeded', 'handoff_ttl_half',
      ],
    },
  };
  const expected = '健康度 需关注' + L.HEALTH_LINE.sep + [
    '有待处理升级', '节点 T-001 执行超时', '会话 mock-sess-12345-1 崩溃',
    '角色 开发 不可用', '连接线 测试→开发 已拒绝', '连接线 测试→开发 已过期',
    '节点 T-001 执行超过本实例 P90', '交接包 HO-006 待投递超过 TTL 一半',
  ].join(L.HEALTH_LINE.sep);
  assertSameSentences(state, expected);
});

test('D-12 ②：health.reasonVars?.[code] 优先于快照推导（两处一致）', () => {
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't', updatedAt: 'x',
    nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'running' }],
    sessions: [], handoffs: [], escalations: [], approvals: [],
    health: {
      level: 'attention', reasons: ['node_timeout'],
      reasonVars: { node_timeout: { nodeId: 'T-999' } },
    },
  };
  assertSameSentences(state, '健康度 需关注 · 节点 T-999 执行超时');
});

test('D-12 ②：快照无匹配对象时降级空串、不抛错、不硬编码兜底中文', () => {
  const state = {
    instanceId: 'INST-001', state: 'running', paused: false, task: 't', updatedAt: 'x',
    nodes: [], sessions: [], handoffs: [], escalations: [], approvals: [],
    health: { level: 'attention', reasons: ['node_timeout', 'session_crash', 'handoff_ttl_half'] },
  };
  assert.equal(
    renderHealthLine(state, HNOW),
    '健康度 需关注 · 节点  执行超时 · 会话  崩溃 · 交接包  待投递超过 TTL 一半'
  );
  assert.doesNotThrow(() => renderStatusDoc(state, null, {}));
  assert.ok(
    renderStatusDoc(state, null, {}).includes('- 健康度：需关注 · 节点  执行超时')
  );
});

test('D-12 ④：事件文本行带占位符码从 detail.reasonVars 取值，A-8 基线不变', () => {
  const base = {
    object: 'health', objectId: 'INST-001', from: 'normal', to: 'attention',
    reason: 'health.changed', ts: T0,
  };
  // A-8 / AC-16 判据：pending_escalation 无占位符，逐字基线不变。
  assert.equal(
    renderHealthEventLine({ ...base, detail: { reasons: ['pending_escalation'] } }),
    '10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级'
  );
  // 带占位符码：event.detail.reasonVars?.[code] 提供实参。
  assert.equal(
    renderHealthEventLine({
      ...base,
      detail: { reasons: ['node_timeout'], reasonVars: { node_timeout: { nodeId: 'T-001' } } },
    }),
    '10:00:00  健康度 INST-001  正常 → 需关注  原因 节点 T-001 执行超时'
  );
  // 缺失 reasonVars 时降级（已知边界，不抛错）。
  assert.equal(
    renderHealthEventLine({ ...base, detail: { reasons: ['node_timeout'] } }),
    '10:00:00  健康度 INST-001  正常 → 需关注  原因 节点  执行超时'
  );
});

test('D-12 ③：对象形态 {code,...实参} 兼容保留（非主契约）', () => {
  assert.equal(
    renderHealthLine(
      { health: { level: 'attention', reasons: [{ code: 'node_timeout', nodeId: 'T-001' }] } },
      HNOW
    ),
    '健康度 需关注 · 节点 T-001 执行超时'
  );
});
