import test from 'node:test';
import assert from 'node:assert/strict';

import * as render from '../../src/cli/render.js';

/** 造一个“本地时区 10:30:02”的 ISO，避免断言依赖运行机器的时区。 */
function localIso(h, m, s, day = 4) {
  return new Date(2026, 10, day, h, m, s).toISOString();
}

const at = (h, m, s) => localIso(h, m, s);

// ---------------------------------------------------------------- 实例行

test('renderInstanceLine：实例号 + 状态名', () => {
  assert.equal(render.renderInstanceLine({ instanceId: 'INST-001', state: 'running' }), '实例 INST-001 · 运行中');
  assert.equal(render.renderInstanceLine({ instanceId: 'INST-002', state: 'interrupted' }), '实例 INST-002 · 已中断');
});

test('renderInterruptedNote：说明停在节点/会话哪一步（AC-12）', () => {
  const line = render.renderInterruptedNote({
    instanceId: 'INST-001',
    state: 'interrupted',
    node: { state: 'running' },
    session: { state: 'thinking' },
  });
  assert.equal(line, '实例 INST-001 · 已中断 ｜ 停在节点 执行中 / 会话 执行中');
});

test('renderInstanceListRow：实例/状态/节点/会话/耗时/更新时间', () => {
  const line = render.renderInstanceListRow(
    { instanceId: 'INST-001', state: 'completed', nodeState: 'done', sessionState: 'idle' },
    {
      instanceId: 'INST-001',
      state: 'completed',
      elapsedMs: 72_000,
      updatedAt: at(10, 31, 14),
      node: { state: 'done' },
      session: { state: 'idle' },
    },
  );
  assert.equal(line, '实例 INST-001 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 1m12s · 更新 10:31:14');
});

test('renderInstanceUnreadable / renderInstanceMissing：不假装没有这个实例', () => {
  assert.equal(render.renderInstanceUnreadable({ instanceId: 'INST-009' }), '实例 INST-009 · 状态不可读');
  assert.equal(render.renderInstanceMissing('INST-009'), '实例 INST-009 · 不存在');
});

// ---------------------------------------------------------------- 会话行

test('renderSessionLine：五个可观测状态各有各的文案', () => {
  assert.equal(render.renderSessionLine({ elapsedMs: 3000, session: { state: 'thinking' } }), '会话 执行中 · 已运行 3s');
  assert.equal(render.renderSessionLine({ session: { state: 'tool_running', toolName: 'write' } }), '会话 执行中 · 调用工具（write）');
  assert.equal(render.renderSessionLine({ session: { state: 'waiting_input', pendingPermission: 'write' } }), '会话 等待审批：write');
  assert.equal(render.renderSessionLine({ session: { state: 'waiting_dependency' } }), '会话 等待下游');
  assert.equal(render.renderSessionLine({ session: { state: 'idle' } }), '会话 空闲');
});

test('renderSessionLine：pendingPermission 是 {action} 结构时也显示动作名', () => {
  assert.equal(
    render.renderSessionLine({ session: { state: 'waiting_input', pendingPermission: { action: 'git_push' } } }),
    '会话 等待审批：git_push',
  );
});

test('renderSessionLine：没有 toolName 时退回时长，不出现空括号', () => {
  const line = render.renderSessionLine({ elapsedMs: 4200, session: { state: 'tool_running', toolName: null } });
  assert.equal(line, '会话 执行中 · 已运行 4s');
  assert.ok(!line.includes('（）'));
});

test('renderSessionLine：没有会话返回 null（不打印半截行）', () => {
  assert.equal(render.renderSessionLine({ instanceId: 'INST-001', state: 'created' }), null);
});

test('renderSessionStall：仅 sessionStalled 为真时追加“无新事件”', () => {
  assert.equal(
    render.renderSessionStall({ elapsedMs: 480_000, session: { state: 'thinking' }, sessionStalled: true }),
    '会话 执行中 · 已运行 8m · 无新事件',
  );
  assert.equal(render.renderSessionStall({ session: { state: 'thinking' } }), null);
  assert.equal(render.renderSessionStall({ session: { state: 'idle' }, sessionStalled: true }), null);
});

test('renderSessionSubmitted：等待下游 + 产出已提交（需求 2.2 第 5 行）', () => {
  assert.equal(
    render.renderSessionSubmitted({ session: { state: 'waiting_dependency' } }),
    '会话 等待下游 · 产出已提交',
  );
});

test('renderSessionCreated / renderTaskSubmitted：需求 2.2 第 2、3 行原文', () => {
  assert.equal(render.renderSessionCreated('sess-7f3a'), '会话已创建 sess-7f3a');
  assert.equal(render.renderTaskSubmitted(), '任务已投递');
});

// ---------------------------------------------------------------- 节点行

test('renderNodeLine：完成带耗时、待校验不带、失败带核对原因', () => {
  assert.equal(
    render.renderNodeLine({
      node: { state: 'done', startedAt: at(10, 30, 2), endedAt: at(10, 31, 14) },
    }),
    '节点 已完成 · 耗时 1m12s',
  );
  assert.equal(render.renderNodeLine({ node: { state: 'review' } }), '节点 待校验');
  assert.equal(render.renderNodeLine({ node: { state: 'pending' } }), '节点 待执行');
  assert.equal(render.renderNodeLine({ node: { state: 'cancelled' } }), '节点 已取消');
  assert.equal(
    render.renderNodeLine({
      node: { state: 'failed', failure: { code: 'MISSING', ref: 'out/intro.md', message: '未找到声明的产出 out/intro.md' } },
    }),
    '节点 失败 · 核对失败：未找到声明的产出 out/intro.md',
  );
});

test('renderNodeFailure：宿主原文 / 审批步骤 / 未知错误各走各的模板', () => {
  assert.equal(
    render.renderNodeFailure({ node: { state: 'failed', failure: { code: 'HOST_ERROR', message: 'upstream 500' } } }),
    '执行失败：upstream 500',
  );
  assert.equal(
    render.renderNodeFailure({ node: { state: 'failed', failure: { code: 'PERMISSION_DENIED', step: 'write' } } }),
    '审批被拒绝，任务中止于 write',
  );
  assert.equal(
    render.renderNodeFailure({ node: { state: 'failed', failure: { code: 'E_SOMETHING', message: 'weird' } } }),
    '未知错误：weird',
  );
});

// ---------------------------------------------------------------- 交接包

test('renderHandoffLines：四行按时间戳顺序与格式输出', () => {
  const lines = render.renderHandoffLines({
    handoff: {
      handoffId: 'HO-001',
      state: 'consumed',
      createdAt: at(10, 30, 2),
      deliveredAt: at(10, 30, 2),
      acceptedAt: at(10, 30, 5),
      consumedAt: at(10, 31, 14),
      rejectedAt: null,
    },
  });

  assert.deepEqual(lines, [
    '交接包 HO-001  已构造   10:30:02',
    '交接包 HO-001  已投递   10:30:02',
    '交接包 HO-001  已接受   10:30:05',
    '交接包 HO-001  已完成   10:31:14',
  ]);
  // 逐行校验时间不早于前一行
  const stamps = lines.map((line) => line.slice(-8));
  assert.deepEqual(stamps, ['10:30:02', '10:30:02', '10:30:05', '10:31:14']);
});

test('renderHandoffLines：拒绝行带原因，且不会同时出现 consumed 与 rejected', () => {
  const lines = render.renderHandoffLines({
    handoff: {
      handoffId: 'HO-001',
      state: 'rejected',
      createdAt: at(10, 30, 2),
      deliveredAt: at(10, 30, 2),
      acceptedAt: null,
      consumedAt: null,
      rejectedAt: at(10, 31, 20),
      rejectReason: 'withdrawn',
    },
  });
  assert.deepEqual(lines, [
    '交接包 HO-001  已构造   10:30:02',
    '交接包 HO-001  已投递   10:30:02',
    '交接包 HO-001  已拒绝   10:31:20  原因 已撤回',
  ]);
});

test('renderHandoffWait：已投递 + 未终态才显示等待时长（AC-24 绝不显示已过期）', () => {
  const line = render.renderHandoffWait(
    {
      state: 'running',
      handoff: { handoffId: 'HO-001', state: 'delivered', deliveredAt: at(10, 30, 2) },
      handoffWaitMs: 120_000,
    },
    Date.parse(at(10, 32, 2)),
  );
  assert.equal(line, '交接包 HO-001  已投递   等待目标响应 · 已等待 2m');
  assert.ok(!line.includes('已过期'));

  // 实例已终态 → 不再显示“等待目标响应”
  assert.equal(
    render.renderHandoffWait(
      { state: 'completed', handoff: { handoffId: 'HO-001', state: 'delivered' }, handoffWaitMs: 120_000 },
      Date.now(),
    ),
    null,
  );
  // 不是 delivered → 不显示
  assert.equal(
    render.renderHandoffWait({ state: 'running', handoff: { handoffId: 'HO-001', state: 'accepted' } }, Date.now()),
    null,
  );
});

test('renderCancelLines：会话空闲 / 节点已取消 / 交接包已拒绝（已撤回）', () => {
  assert.deepEqual(
    render.renderCancelLines({
      session: { state: 'idle' },
      node: { state: 'cancelled' },
      handoff: { handoffId: 'HO-001', state: 'rejected', rejectReason: 'withdrawn' },
    }),
    ['会话 空闲', '节点 已取消', '交接包 HO-001 已拒绝（已撤回）'],
  );
});

// ---------------------------------------------------------------- 事件行

test('renderEventLine：时间 + 对象 + 迁移 + 原因', () => {
  assert.equal(
    render.renderEventLine({
      seq: 18,
      ts: at(10, 30, 5),
      object: 'handoff',
      objectId: 'HO-001',
      from: 'delivered',
      to: 'accepted',
      result: 'applied',
      reason: 'turn.first_event',
    }),
    '10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event',
  );
});

test('renderEventLine：备注事件（from/to 为空）用 detail.note', () => {
  assert.equal(
    render.renderEventLine({
      ts: at(10, 31, 14),
      object: 'node',
      objectId: 'T-001',
      from: null,
      to: null,
      result: 'note',
      reason: 'verification.skipped',
      detail: { note: '未声明产出，跳过存在性检查' },
    }),
    '10:31:14  节点 T-001  未声明产出，跳过存在性检查  原因 verification.skipped',
  );
});

test('renderEventLine：同一文案的两个会话状态补上触发事件名', () => {
  assert.equal(
    render.renderEventLine({
      ts: at(10, 30, 5),
      object: 'session',
      objectId: 'sess-1',
      from: 'thinking',
      to: 'tool_running',
      result: 'applied',
      reason: 'session.state',
      detail: { event: 'tool_call' },
    }),
    '10:30:05  会话 sess-1  执行中 → 执行中（tool_call）  原因 session.state',
  );
});

test('renderRejectedTransition：拒绝的迁移（AC-26）', () => {
  assert.equal(
    render.renderRejectedTransition({
      ts: at(10, 31, 20),
      object: 'node',
      objectId: 'T-001',
      from: 'done',
      to: 'running',
      result: 'rejected',
      reason: 'illegal_transition',
    }),
    '10:31:20  节点 T-001  拒绝的迁移：已完成 → 执行中',
  );
});

// ---------------------------------------------------------------- 错误文案

test('renderError：九条原文逐字一致（需求 2.6）', () => {
  const cases = [
    [{ code: 'DSH_SPAWN_FAILED', params: { cause: 'spawn ENOENT' } }, '无法启动 DSH：spawn ENOENT'],
    [{ code: 'CWD_NOT_WRITABLE', params: { path: 'D:\\demo' } }, '工作目录不可写：D:\\demo'],
    [{ code: 'CORE_START_FAILED', params: { cause: '30s 内未能连接核心' } }, '核心进程启动失败：30s 内未能连接核心'],
    [{ code: 'NODE_BUSY', params: {} }, '该节点正在执行，本次未发起'],
    [{ code: 'SESSION_INVALID', params: {} }, '会话已失效，需要重新创建'],
    [{ code: 'PERMISSION_DENIED', params: { step: 'write' } }, '审批被拒绝，任务中止于 write'],
    [{ code: 'HOST_ERROR', params: { raw: 'upstream model request failed' } }, '执行失败：upstream model request failed'],
    [
      { code: 'VERIFY_FAILED', params: { reason: '未找到声明的产出 out/intro.md' } },
      '核对失败：未找到声明的产出 out/intro.md',
    ],
    [
      { code: 'UNKNOWN_ERROR', params: { raw: 'E_QUASAR_7719 unrecognized failure token' } },
      '未知错误：E_QUASAR_7719 unrecognized failure token',
    ],
  ];

  for (const [input, expected] of cases) {
    assert.equal(render.renderError(input), expected);
  }
});

test('renderError：STATE_CORRUPT 逐字一致，带 backupPath 时追加实际路径（AC-13）', () => {
  assert.equal(render.renderError({ code: 'STATE_CORRUPT' }), '状态不可读，已备份为 state.json.corrupt');
  assert.equal(
    render.renderError({ code: 'STATE_CORRUPT', params: { backupPath: 'D:\\p\\.orch\\instances\\INST-001\\state.json.corrupt' } }),
    '状态不可读，已备份为 state.json.corrupt（D:\\p\\.orch\\instances\\INST-001\\state.json.corrupt）',
  );
});

test('renderError：INSTANCE_TERMINAL 用中文状态名，不暴露英文枚举', () => {
  assert.equal(
    render.renderError({ code: 'INSTANCE_TERMINAL', params: { state: 'completed' } }),
    '实例已结束（已完成），本迭代不支持重跑',
  );
});

test('renderError：不认识的失败码透出 code，不显示成 “未知错误：?”', () => {
  assert.equal(render.renderError({ code: 'IPC_CLOSED' }), '未知错误：IPC_CLOSED');
});

test('renderError：params.raw 含换行时原文不被改写', () => {
  const raw = 'Error: boom\n  at foo (bar.js:1:2)\n  at baz (qux.js:3:4)';
  assert.equal(render.renderError({ code: 'HOST_ERROR', params: { raw } }), `执行失败：${raw}`);
});

test('renderError：params.raw 超长时不被截断', () => {
  const raw = 'x'.repeat(5000);
  const text = render.renderError({ code: 'UNKNOWN_ERROR', params: { raw } });
  assert.equal(text.slice('未知错误：'.length), raw);
  assert.equal(text.length, '未知错误：'.length + 5000);
});

// ================================================================ I1.2 / WP-5
// 以下用例逐字断言需求附录 A-1/A-2/A-3/A-4；上面所有 `single` 用例是 I1.1 回归红线。

/** 一张 `code-loop` 快照：T-001 已完成、T-002 执行中、一张正向交接包。 */
function loopSnapshot(overrides = {}) {
  return {
    instanceId: 'INST-001',
    state: 'running',
    template: 'code-loop',
    halted: false,
    elapsedMs: 12_000,
    updatedAt: at(10, 31, 14),
    nodes: [
      {
        nodeId: 'T-001',
        roleId: 'developer',
        state: 'done',
        round: 1,
        startedAt: at(10, 29, 0),
        endedAt: at(10, 30, 12),
      },
      { nodeId: 'T-002', roleId: 'tester', state: 'running', round: 1, startedAt: at(10, 30, 3) },
    ],
    sessions: [{ sessionId: 'sess-1', state: 'thinking', stateSince: at(10, 30, 55) }],
    handoffs: [
      {
        handoffId: 'HO-001',
        state: 'accepted',
        createdAt: at(10, 30, 2),
        deliveredAt: at(10, 30, 3),
        acceptedAt: at(10, 30, 3),
        consumedAt: null,
        rejectedAt: null,
        edge: { from: 'T-001', to: 'T-002', kind: 'forward' },
      },
    ],
    escalations: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------- A-2 实例行

test('A-2 实例行：code-loop 带模板，halted 时“已停止推进”在模板前，single 不带', () => {
  assert.equal(render.renderInstanceLine(loopSnapshot()), '实例 INST-001 · 运行中 · 模板 编码闭环');
  assert.equal(
    render.renderInstanceLine(loopSnapshot({ halted: true })),
    '实例 INST-001 · 运行中 · 已停止推进 · 模板 编码闭环',
  );
  assert.equal(
    render.renderInstanceLine({ instanceId: 'INST-001', state: 'suspended', template: 'code-loop' }),
    '实例 INST-001 · 已挂起 · 模板 编码闭环',
  );
  // 红线：single 全文不出现“模板”
  assert.equal(render.renderInstanceLine({ instanceId: 'INST-001', state: 'running', template: 'single' }), '实例 INST-001 · 运行中');
  assert.ok(!render.renderInstanceLine({ instanceId: 'INST-001', state: 'running' }).includes('模板'));
});

test('A-2 列表行：code-loop 追加模板与“待处理升级 N”，v1/single 不追加（C-07）', () => {
  const snapshot = loopSnapshot({ escalations: [{ escalationId: 'ESC-001', state: 'pending' }] });
  assert.equal(
    render.renderInstanceListRow({ instanceId: 'INST-001', schemaVersion: 2, template: 'code-loop', pendingEscalations: 1 }, snapshot),
    '实例 INST-001 · 运行中 · 模板 编码闭环 · 待处理升级 1 · 节点 已完成 · 会话 执行中 · 耗时 1m12s · 更新 10:31:14',
  );
  // v1 投影不显示模板与升级
  assert.equal(
    render.renderInstanceListRow(
      { instanceId: 'INST-009', schemaVersion: 1, template: 'single', pendingEscalations: 0 },
      { instanceId: 'INST-009', state: 'completed', elapsedMs: 72_000, updatedAt: at(10, 31, 14), nodes: [{ nodeId: 'T-001', state: 'done' }], sessions: [{ state: 'idle' }], template: 'single' },
    ),
    '实例 INST-009 · 已完成 · 节点 已完成 · 会话 空闲 · 耗时 1m12s · 更新 10:31:14',
  );
  // 无待处理升级时不打印该段
  assert.ok(!render.renderInstanceListRow({ instanceId: 'INST-001', schemaVersion: 2, template: 'code-loop' }, loopSnapshot()).includes('待处理升级'));
});

// ---------------------------------------------------------------- A-2 节点表

test('A-2 节点行：号/角色/状态/轮次/耗时，单空格不对齐；未派发不带轮次与耗时', () => {
  assert.deepEqual(render.renderNodeLines(loopSnapshot()), [
    '节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s',
    '节点 T-002 测试 执行中 · 第 1 轮',
  ]);

  const pending = render.renderNodeLines(
    loopSnapshot({
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', state: 'pending', round: 0 },
        { nodeId: 'T-002', roleId: 'tester', state: 'pending', round: 0 },
      ],
    }),
  );
  assert.deepEqual(pending, ['节点 T-001 开发 待执行', '节点 T-002 测试 待执行']);
  for (const line of pending) {
    assert.ok(!line.includes('第 0 轮'));
    assert.ok(!line.includes('耗时'));
  }
});

test('A-2 节点行：判定通过 / 不通过 + 缺陷条数；失败带“等待复测”限定词', () => {
  const lines = render.renderNodeLines(
    loopSnapshot({
      nodes: [
        { nodeId: 'T-001', roleId: 'developer', state: 'running', round: 2, verdict: null },
        {
          nodeId: 'T-002',
          roleId: 'tester',
          state: 'failed',
          round: 1,
          verdict: { value: 'fail', defectCount: 2 },
        },
        { nodeId: 'T-003', roleId: 'tester', state: 'done', round: 2, startedAt: at(10, 30, 0), endedAt: at(10, 31, 0), verdict: { value: 'pass' } },
      ],
    }),
  );
  assert.deepEqual(lines, [
    '节点 T-001 开发 执行中 · 第 2 轮',
    '节点 T-002 测试 失败（等待复测） · 第 1 轮 · 判定 不通过 · 缺陷 2 条',
    '节点 T-003 测试 已完成 · 第 2 轮 · 耗时 1m · 判定 通过',
  ]);
});

test('A-2 节点行：升级未记录只挂在升级前的那个节点上；已升级不带限定词', () => {
  const snapshot = loopSnapshot({
    halted: true,
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1, startedAt: at(10, 29, 0), endedAt: at(10, 30, 12) },
      { nodeId: 'T-002', roleId: 'tester', state: 'review', round: 2 },
    ],
  });
  assert.deepEqual(render.renderNodeLines(snapshot), [
    '节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m12s',
    '节点 T-002 测试 待校验（升级未记录） · 第 2 轮',
  ]);

  const escalated = render.renderNodeLines(
    loopSnapshot({
      state: 'suspended',
      nodes: [{ nodeId: 'T-002', roleId: 'tester', state: 'escalated', round: 2 }],
    }),
  );
  assert.deepEqual(escalated, ['节点 T-002 测试 已升级 · 第 2 轮']);
});

test('renderNodeLines：single 仍是 I1.1 一行，且不带号/角色/轮次', () => {
  assert.deepEqual(
    render.renderNodeLines({ instanceId: 'INST-001', template: 'single', nodes: [{ nodeId: 'T-001', roleId: 'worker', state: 'review', round: 1 }] }),
    ['节点 待校验'],
  );
});

// ---------------------------------------------------------------- A-2 会话行

test('A-2 会话行：六种分支各一行，只渲染当前 1 行', () => {
  const at11 = Date.parse(at(10, 31, 14));
  const cases = [
    [{ state: 'idle' }, '会话 空闲'],
    [{ state: 'thinking', stateSince: at(10, 31, 11) }, '会话 执行中 · 已运行 3s'],
    [{ state: 'tool_running', toolName: 'write', stateSince: at(10, 31, 11) }, '会话 执行中 · 调用工具（write） · 已运行 3s'],
    [{ state: 'waiting_input', pendingPermission: 'write' }, '会话 等待审批：write'],
    [{ state: 'waiting_dependency' }, '会话 等待下游'],
    [{ state: 'escalated' }, '会话 已升级'],
  ];
  for (const [session, expected] of cases) {
    assert.equal(render.renderSessionLine({ sessions: [{ sessionId: 's-0', state: 'idle' }, session] }, at11), expected);
  }
});

// ---------------------------------------------------------------- A-2 交接包

test('A-2 交接包：code-loop 带方向（号/方向/状态各 2 空格），single 无方向', () => {
  const snapshot = loopSnapshot();
  assert.deepEqual(render.renderHandoffLines(snapshot), [
    '交接包 HO-001  开发→测试  已构造   10:30:02',
    '交接包 HO-001  开发→测试  已投递   10:30:03',
    '交接包 HO-001  开发→测试  已接受   10:30:03',
  ]);

  const backflow = {
    ...snapshot,
    handoffs: [
      {
        handoffId: 'HO-002',
        state: 'delivered',
        createdAt: at(10, 31, 0),
        deliveredAt: at(10, 31, 0),
        acceptedAt: null,
        consumedAt: null,
        rejectedAt: null,
        edge: { from: 'T-002', to: 'T-001', kind: 'backflow' },
      },
      {
        handoffId: 'HO-003',
        state: 'created',
        createdAt: at(10, 32, 0),
        deliveredAt: null,
        acceptedAt: null,
        consumedAt: null,
        rejectedAt: null,
        edge: { from: 'T-001', to: 'T-002', kind: 'retest' },
      },
    ],
  };
  assert.deepEqual(render.renderHandoffLines(backflow), [
    '交接包 HO-002  测试→开发（回流）  已构造   10:31:00',
    '交接包 HO-002  测试→开发（回流）  已投递   10:31:00',
    '交接包 HO-003  开发→测试（复测）  已构造   10:32:00',
  ]);

  // 同一张带 edge 的包在 single 下整段方向消失（I1.1 逐字）
  assert.deepEqual(render.renderHandoffLines(snapshot, { template: 'single' }), [
    '交接包 HO-001  已构造   10:30:02',
    '交接包 HO-001  已投递   10:30:03',
    '交接包 HO-001  已接受   10:30:03',
  ]);
});

test('A-2 交接包等待行：code-loop 带方向，single 逐字保留', () => {
  const snapshot = loopSnapshot({
    handoffs: [
      {
        handoffId: 'HO-002',
        state: 'delivered',
        createdAt: at(10, 31, 0),
        deliveredAt: at(10, 31, 0),
        edge: { from: 'T-002', to: 'T-001', kind: 'backflow' },
      },
    ],
    handoffWaitMs: 120_000,
  });
  assert.equal(
    render.renderHandoffWait(snapshot, Date.parse(at(10, 33, 0))),
    '交接包 HO-002  测试→开发（回流）  已投递   等待目标响应 · 已等待 2m',
  );
  const single = {
    state: 'running',
    template: 'single',
    handoff: { handoffId: 'HO-001', state: 'delivered', deliveredAt: at(10, 30, 2) },
    handoffWaitMs: 120_000,
  };
  assert.equal(render.renderHandoffWait(single, Date.parse(at(10, 32, 2))), '交接包 HO-001  已投递   等待目标响应 · 已等待 2m');
});

// ---------------------------------------------------------------- A-2 升级块

test('A-2 升级块：single 不打印；code-loop 无升级打“升级 —”，有升级打 1+4 行', () => {
  assert.deepEqual(render.renderEscalationBlock({ template: 'single', escalations: [{ escalationId: 'ESC-001', state: 'pending' }] }), []);
  assert.deepEqual(render.renderEscalationBlock(loopSnapshot()), ['升级 —']);

  const pending = loopSnapshot({
    state: 'suspended',
    escalations: [
      {
        escalationId: 'ESC-001',
        nodeId: 'T-002',
        round: 2,
        reasonCode: 'rounds_exceeded',
        reasonDetail: '回流超上限：测试已派发 2 次仍未通过',
        defects: [{ summary: 'div 在除数为 0 时返回 Infinity', evidence: 'out/test-log.txt' }],
        state: 'pending',
      },
    ],
  });
  assert.deepEqual(render.renderEscalationBlock(pending), [
    '升级 ESC-001 待处理',
    '  原因：回流超上限：测试已派发 2 次仍未通过',
    '  节点：T-002 测试 · 第 2 轮',
    '  缺陷：div 在除数为 0 时返回 Infinity（证据 out/test-log.txt）',
    '  下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance INST-001',
  ]);
});

// ---------------------------------------------------------------- A-3 / A-4 收尾

test('A-4 挂起收尾：正好三行（实例 + 升级摘要 + 下一步），不含节点/交接包行', () => {
  const snapshot = loopSnapshot({
    state: 'suspended',
    nodes: [{ nodeId: 'T-002', roleId: 'tester', state: 'escalated', round: 2 }],
    escalations: [
      { escalationId: 'ESC-001', nodeId: 'T-002', round: 2, state: 'pending', reasonDetail: '回流超上限' },
    ],
  });
  assert.deepEqual(render.renderRunTail(snapshot), [
    '实例 INST-001 · 已挂起 · 模板 编码闭环',
    '升级 ESC-001 待处理 · 节点 T-002 测试 · 第 2 轮',
    '下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance INST-001',
  ]);
});

test('A-4 停止推进收尾：错误行 + 三行，节点行是唯一状态行且带“升级未记录”', () => {
  const snapshot = loopSnapshot({
    halted: true,
    haltCause: 'state_write_failed',
    nodes: [
      { nodeId: 'T-001', roleId: 'developer', state: 'done', round: 1, startedAt: at(10, 29, 0), endedAt: at(10, 30, 12) },
      { nodeId: 'T-002', roleId: 'tester', state: 'review', round: 2 },
    ],
  });
  assert.deepEqual(render.renderRunTail(snapshot), [
    '无法记录升级：state_write_failed；已停止推进',
    '实例 INST-001 · 运行中 · 已停止推进 · 模板 编码闭环',
    '节点 T-002 测试 待校验（升级未记录） · 第 2 轮',
    '下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消',
  ]);
});

// ---------------------------------------------------------------- C-10 事件行

test('C-10 事件行：code-loop 加 [#seq] 与中文原因、task-loop 的 note 行只放中文原因词；single 保持 I1.1 逐字', () => {
  const event = {
    seq: 18,
    ts: at(10, 30, 5),
    object: 'handoff',
    objectId: 'HO-001',
    from: 'delivered',
    to: 'accepted',
    result: 'applied',
    reason: 'turn.first_event',
  };
  assert.equal(render.renderEventLine(event, { template: 'code-loop' }), '[#18] 10:30:05  交接包 HO-001  已投递 → 已接受  原因 首个事件');
  assert.equal(render.renderEventLine(event), '10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event');
  assert.equal(render.renderEventLine(event, { template: 'single' }), '10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event');

  // A-2 第 7 段（AC-39）：`task-loop` 的 note 行中段直接用中文原因词，不再追加「原因」段。
  const note = {
    seq: 68,
    ts: at(13, 33, 46),
    object: 'node',
    objectId: 'T-003',
    from: null,
    to: null,
    result: 'note',
    reason: 'review.read',
    detail: { source: 'file', path: 'out/review.json', decision: 'reject', results: 2 },
  };
  assert.equal(render.renderEventLine(note, { template: 'task-loop' }), '[#68] 13:33:46  节点 T-003  读取审核');
  // 分流边界：同一事件在 code-loop 下仍是 I1.2 版式（英文 reason 作中段 + 中文原因段）。
  assert.equal(render.renderEventLine(note, { template: 'code-loop' }), '[#68] 13:33:46  节点 T-003  review.read  原因 读取审核');
  // 其余 note 原因词：无迁移信息的核对/回流、带 from/to 的下游接受，都只留中文词。
  assert.deepEqual(
    [
      { seq: 8, ts: at(13, 33, 47), object: 'node', objectId: 'T-001', from: null, to: null, result: 'note', reason: 'review.evidence_verified' },
      { seq: 14, ts: at(13, 33, 48), object: 'node', objectId: 'T-001', from: 'review', to: 'done', result: 'note', reason: 'review.downstream_accepted' },
      { seq: 37, ts: at(13, 33, 49), object: 'handoff', objectId: 'HO-003', from: null, to: null, result: 'note', reason: 'backflow.constructed', detail: { defects: [], revisionRequirement: '请按缺陷清单逐条修改' } },
    ].map((item) => render.renderEventLine(item, { template: 'task-loop' })),
    [
      '[#8] 13:33:47  节点 T-001  证据核对通过',
      '[#14] 13:33:48  节点 T-001  下游已接受',
      '[#37] 13:33:49  交接包 HO-003  构造回流',
    ],
  );
  // 状态迁移行（result='applied'）在 task-loop 下保持「原因 <中文词>」。
  assert.equal(
    render.renderEventLine(
      { seq: 11, ts: at(13, 33, 50), object: 'handoff', objectId: 'HO-001', from: 'created', to: 'delivered', result: 'applied', reason: 'handoff.delivered' },
      { template: 'task-loop' },
    ),
    '[#11] 13:33:50  交接包 HO-001  已构造 → 已投递  原因 交接已投递',
  );
});

test('C-10 事件行：node.dispatch 中段固定“派发 → 执行中”、原因带轮次', () => {
  assert.equal(
    render.renderEventLine(
      {
        seq: 13,
        ts: at(10, 31, 5),
        object: 'node',
        objectId: 'T-001',
        from: 'done',
        to: 'running',
        result: 'applied',
        reason: 'node.dispatch',
        detail: { round: 2, nodeId: 'T-001', roleId: 'developer' },
      },
      { template: 'code-loop' },
    ),
    '[#13] 10:31:05  节点 T-001  派发 → 执行中  原因 派发 · 第 2 轮',
  );
});

test('C-10 事件行：escalation 进入 pending 时中段是“待处理”', () => {
  assert.equal(
    render.renderEventLine(
      {
        seq: 20,
        ts: at(10, 32, 0),
        object: 'escalation',
        objectId: 'ESC-001',
        from: null,
        to: 'pending',
        result: 'applied',
        reason: 'escalation.created',
      },
      { template: 'code-loop' },
    ),
    '[#20] 10:32:00  升级 ESC-001  待处理  原因 创建升级',
  );
});

test('C-10 回流事件：行 + 6 空格缩进的缺陷明细与复测要求（AC-24）', () => {
  const event = {
    seq: 12,
    ts: at(10, 31, 0),
    object: 'handoff',
    objectId: 'HO-002',
    from: null,
    to: 'created',
    result: 'applied',
    reason: 'backflow.constructed',
    detail: {
      defects: [
        { summary: 'div 在除数为 0 时返回 Infinity，未抛错', evidence: 'out/test-log.txt' },
        { summary: 'div(6,0) 未返回 NaN', evidence: 'out/test-log.txt' },
      ],
      retestRequirement: '修完后请重跑 node --test，并确认上述 2 条都不再出现',
    },
  };
  assert.deepEqual(render.renderEventLines(event, { template: 'code-loop' }), [
    '[#12] 10:31:00  交接包 HO-002  已构造  原因 构造回流',
    '      缺陷 1：div 在除数为 0 时返回 Infinity，未抛错（证据 out/test-log.txt）',
    '      缺陷 2：div(6,0) 未返回 NaN（证据 out/test-log.txt）',
    '      复测要求：修完后请重跑 node --test，并确认上述 2 条都不再出现',
  ]);
  // single 不追加明细（I1.1 版式红线）
  assert.deepEqual(render.renderEventLines(event, { template: 'single' }), [
    '10:31:00  交接包 HO-002  已构造  原因 backflow.constructed',
  ]);
});

test('C-10 rejected：两种模板都保持 I1.1 版式（无 seq、无原因）', () => {
  const event = {
    seq: 26,
    ts: at(10, 31, 20),
    object: 'node',
    objectId: 'T-001',
    from: 'done',
    to: 'running',
    result: 'rejected',
    reason: 'illegal_transition',
  };
  const expected = '10:31:20  节点 T-001  拒绝的迁移：已完成 → 执行中';
  assert.equal(render.renderEventLine(event, { template: 'single' }), expected);
  assert.equal(render.renderEventLine(event, { template: 'code-loop' }), expected);
  assert.deepEqual(render.renderEventLines(event, { template: 'code-loop' }), [expected]);
});

// ---------------------------------------------------------------- 取消（数组）

test('renderCancelLines：v2 数组按 会话 → 节点 → 交接包 → 升级 展开', () => {
  assert.deepEqual(
    render.renderCancelLines({
      sessions: [{ state: 'idle' }],
      nodes: [{ nodeId: 'T-001', roleId: 'developer', state: 'cancelled' }],
      handoffs: [{ handoffId: 'HO-001', state: 'rejected', rejectReason: 'withdrawn' }],
      escalations: [{ escalationId: 'ESC-001', state: 'voided' }],
    }),
    ['会话 空闲', '节点 T-001 开发 已取消', '交接包 HO-001 已拒绝（已撤回）', '升级 ESC-001 已作废'],
  );
});

// ---------------------------------------------------------------- C-11 占位符

test('C-11 renderError：新占位符 name/instanceId/i/summary/evidence/text 不再残留 {...}', () => {
  const cases = [
    [{ code: 'TEMPLATE_UNKNOWN', params: { name: 'code-lop' } }, '未知模板：code-lop'],
    [
      { code: 'DIR_BUSY', params: { instanceId: 'INST-001' } },
      '该目录已有未结束的实例 INST-001，本次未发起',
    ],
    [{ code: 'TASK_EMPTY', params: {} }, '任务描述不能为空'],
    [
      { code: 'PRODUCT_LINE_MISSING' },
      '编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）',
    ],
    [{ code: 'INSTANCE_RUNNING', params: {} }, '该实例正在执行，本次未发起'],
    [
      { code: 'INSTANCE_SUSPENDED' },
      '该实例已挂起，不能再次发起；如要重来请新建实例',
    ],
    [{ code: 'LEGACY_READ_ONLY' }, '该实例为旧格式，本版本只支持查看'],
    [
      { code: 'ESCALATION_WRITE_FAILED', params: { cause: 'state_write_failed' } },
      '无法记录升级：state_write_failed；已停止推进',
    ],
    [{ code: 'CANCEL_NOT_NEEDED', params: { state: 'completed' } }, '实例已结束（已完成），无需取消'],
  ];
  for (const [input, expected] of cases) {
    const text = render.renderError(input);
    assert.equal(text, expected);
    assert.ok(!/\{\w+\}/.test(text), text);
  }
});

// ---------------------------------------------------------------- task-loop（I1.3 / WP-4）

/** `task-loop` 三节点快照；`productPolicy` 由核心下发，测试里显式给。 */
function docSnapshot(over = {}) {
  return {
    instanceId: 'INST-001',
    state: 'running',
    template: 'task-loop',
    productPolicy: 'doc-single',
    nodes: [
      {
        nodeId: 'T-001',
        roleId: 'researcher',
        state: 'done',
        round: 1,
        startedAt: at(10, 0, 1),
        endedAt: at(10, 0, 5),
        artifactRefs: [{ ref: 'artifacts/reports/research-notes.v1.md' }],
      },
      {
        nodeId: 'T-002',
        roleId: 'writer',
        state: 'review',
        round: 1,
        reviewReason: 'downstream',
        startedAt: at(10, 0, 10),
        endedAt: at(10, 0, 16),
        artifactRefs: [{ ref: 'artifacts/docs/release-notes.v1.md' }],
      },
      { nodeId: 'T-003', roleId: 'reviewer', state: 'pending', round: 0 },
    ],
    session: { state: 'waiting_dependency' },
    handoffs: [],
    escalations: [],
    ...over,
  };
}

test('task-loop 节点行：三种后缀与「等待下游」限定词逐字', () => {
  const lines = render.renderNodeLines(docSnapshot(), { template: 'task-loop' });
  assert.deepEqual(lines, [
    '节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md',
    '节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 6s',
    '节点 T-003 审核者 待执行',
  ]);
});

test('task-loop 节点行：审核通过与驳回的后缀', () => {
  const passed = docSnapshot({
    nodes: [
      { nodeId: 'T-003', roleId: 'reviewer', state: 'done', round: 1, review: { decision: 'pass', defectCount: 0 } },
    ],
  });
  assert.equal(
    render.renderNodeLines(passed, { template: 'task-loop' })[0],
    '节点 T-003 审核者 已完成 · 第 1 轮 · 审核 通过',
  );

  const rejected = docSnapshot({
    nodes: [
      {
        nodeId: 'T-003',
        roleId: 'reviewer',
        state: 'failed',
        round: 1,
        note: '等待复审',
        startedAt: at(10, 0, 20),
        endedAt: at(10, 0, 23),
        review: { decision: 'reject', defectCount: 2 },
      },
    ],
  });
  assert.equal(
    render.renderNodeLines(rejected, { template: 'task-loop' })[0],
    '节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 3s · 审核 驳回 · 缺陷 2 条',
  );
});

test('task-loop 限定词：核对证据与裸「待校验」按 reviewReason 区分', () => {
  const evidence = docSnapshot({
    nodes: [{ nodeId: 'T-002', roleId: 'writer', state: 'review', round: 1, reviewReason: 'evidence' }],
  });
  assert.equal(
    render.renderNodeLines(evidence, { template: 'task-loop' })[0],
    '节点 T-002 撰写者 待校验（核对证据） · 第 1 轮',
  );

  // 无门控：`review` 不带限定词（B-10 / code-loop 逐字不变）
  const plain = { nodes: [{ nodeId: 'T-0', roleId: 'worker', state: 'review', round: 1 }], template: 'code-loop' };
  assert.equal(render.renderNodeLines(plain, { template: 'code-loop' })[0].includes('（'), false);
});

test('task-loop 限定词：halted 优先于 note，节点行不带耗时（A-3）', () => {
  const halted = docSnapshot({
    halted: true,
    nodes: [
      {
        nodeId: 'T-003',
        roleId: 'reviewer',
        state: 'review',
        round: 1,
        note: 'stopped at node review / session s-1',
        startedAt: at(10, 0, 1),
        endedAt: at(10, 0, 2),
      },
    ],
    escalations: [{ escalationId: 'ESC-001', state: 'pending', nodeId: 'T-003', round: 1 }],
  });
  assert.equal(
    render.renderNodeLines(halted, { template: 'task-loop' })[0],
    '节点 T-003 审核者 待校验（升级未记录） · 第 1 轮',
  );
});

test('task-loop 耗时：review(evidence) 与 escalated 不显示，同毫秒钳到 1s', () => {
  const evidence = docSnapshot({
    nodes: [
      {
        nodeId: 'T-002',
        roleId: 'writer',
        state: 'review',
        round: 1,
        reviewReason: 'evidence',
        startedAt: at(10, 0, 10),
        endedAt: at(10, 0, 16),
      },
    ],
  });
  assert.equal(
    render.renderNodeLines(evidence, { template: 'task-loop' })[0].includes('耗时'),
    false,
  );

  const escalated = docSnapshot({
    nodes: [
      {
        nodeId: 'T-003',
        roleId: 'reviewer',
        state: 'escalated',
        round: 2,
        startedAt: at(10, 0, 10),
        endedAt: at(10, 0, 16),
      },
    ],
  });
  assert.equal(
    render.renderNodeLines(escalated, { template: 'task-loop' })[0],
    '节点 T-003 审核者 已升级 · 第 2 轮',
  );

  const sameMs = docSnapshot({
    nodes: [
      {
        nodeId: 'T-001',
        roleId: 'researcher',
        state: 'done',
        round: 1,
        startedAt: at(10, 0, 1),
        endedAt: at(10, 0, 1),
        artifactRefs: [{ ref: 'artifacts/reports/research-notes.v1.md' }],
      },
    ],
  });
  assert.match(
    render.renderNodeLines(sameMs, { template: 'task-loop' })[0],
    /耗时 1s · 产物 artifacts\/reports\/research-notes\.v1\.md$/,
  );
});

test('task-loop 会话行：status 不带后缀，run 流式补「产出已提交」', () => {
  const snapshot = docSnapshot();
  assert.equal(render.renderSessionLine(snapshot, Date.now()), '会话 等待下游');
  assert.equal(
    render.renderSessionSubmitted({ ...snapshot, elapsedMs: 1000 }, Date.now()),
    '会话 等待下游 · 产出已提交',
  );
});

test('renderInterruptedNote：优先点位停点节点，缺字段时回落 nodes[0]（AC-45）', () => {
  const snapshot = docSnapshot({
    state: 'interrupted',
    interruptedNodeId: 'T-002',
    session: { state: 'waiting_dependency' },
  });
  assert.equal(
    render.renderInterruptedNote(snapshot),
    '实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游',
  );

  // 旧模板快照不带该字段 → 仍按 nodes[0]（I1.2 零回归）
  const legacy = { instanceId: 'INST-001', state: 'interrupted', node: { state: 'done' }, session: { state: 'idle' } };
  assert.equal(
    render.renderInterruptedNote(legacy),
    '实例 INST-001 · 已中断 ｜ 停在节点 已完成 / 会话 空闲',
  );
});

test('task-loop A-3 收尾：挂起三行逐字', () => {
  const snapshot = docSnapshot({
    state: 'suspended',
    nodes: [{ nodeId: 'T-003', roleId: 'reviewer', state: 'escalated', round: 2 }],
    escalations: [{ escalationId: 'ESC-001', state: 'pending', nodeId: 'T-003', round: 2 }],
  });
  assert.deepEqual(render.renderRunTail(snapshot, { template: 'task-loop' }), [
    '实例 INST-001 · 已挂起 · 模板 通用任务闭环',
    '升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮',
    '下一步：orch escalate list --instance INST-001 查看升级；orch escalate resolve ESC-nnn --instance INST-001 --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance INST-001',
  ]);
});

test('task-loop A-3 收尾：停止推进四行逐字（含节点行不带耗时）', () => {
  const snapshot = docSnapshot({
    halted: true,
    haltCause: 'disk full',
    nodes: [
      {
        nodeId: 'T-001',
        roleId: 'researcher',
        state: 'done',
        round: 1,
        startedAt: at(10, 0, 1),
        endedAt: at(10, 0, 5),
        artifactRefs: [{ ref: 'artifacts/reports/research-notes.v1.md' }],
      },
      {
        nodeId: 'T-003',
        roleId: 'reviewer',
        state: 'review',
        round: 1,
        startedAt: at(10, 0, 10),
      },
    ],
    escalations: [{ escalationId: 'ESC-001', state: 'pending', nodeId: 'T-003', round: 1 }],
  });
  assert.deepEqual(render.renderRunTail(snapshot, { template: 'task-loop' }), [
    '无法记录升级：disk full；已停止推进',
    '实例 INST-001 · 运行中 · 已停止推进 · 模板 通用任务闭环',
    '节点 T-003 审核者 待校验（升级未记录） · 第 1 轮',
    '下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消',
  ]);
});
