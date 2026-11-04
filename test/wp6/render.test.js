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
