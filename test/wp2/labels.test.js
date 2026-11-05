import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INSTANCE_LABEL,
  NODE_LABEL,
  SESSION_LABEL,
  HANDOFF_LABEL,
  ESCALATION_LABEL,
  ROLE_LABEL,
  TEMPLATE_LABEL,
  HANDOFF_DIRECTION,
  NODE_QUALIFIER,
  HANDOFF_REJECT_REASON,
  LAYER,
  REASON_LABEL,
  ESCALATION_BLOCK,
  INSTANCE_STOPPED_SUFFIX,
  BACKFLOW_DEFECT_LINE,
  BACKFLOW_RETEST_LINE,
  SESSION_WAITING_DOWNSTREAM,
  ESCALATION_SUMMARY_LINE,
  NEXT_STEP_SUSPENDED,
  NEXT_STEP_HALTED,
  ERROR_TEMPLATE,
  formatHandoffDirection,
  formatDuration
} from '../../src/cli/labels.js';

test('nine failure texts match requirement 2.6 verbatim', () => {
  // Expected values are copied from docs/iterations/iteration-1/requirement.md 2.6,
  // with the angle-bracket slots turned into named placeholders.
  assert.equal(ERROR_TEMPLATE.DSH_SPAWN_FAILED, '无法启动 DSH：{cause}');
  assert.equal(ERROR_TEMPLATE.CWD_NOT_WRITABLE, '工作目录不可写：{path}');
  assert.equal(ERROR_TEMPLATE.CORE_START_FAILED, '核心进程启动失败：{cause}');
  assert.equal(ERROR_TEMPLATE.NODE_BUSY, '该节点正在执行，本次未发起');
  assert.equal(ERROR_TEMPLATE.SESSION_INVALID, '会话已失效，需要重新创建');
  assert.equal(ERROR_TEMPLATE.PERMISSION_DENIED, '审批被拒绝，任务中止于 {step}');
  assert.equal(ERROR_TEMPLATE.HOST_ERROR, '执行失败：{raw}');
  assert.equal(ERROR_TEMPLATE.VERIFY_FAILED, '核对失败：{reason}');
  assert.equal(ERROR_TEMPLATE.UNKNOWN_ERROR, '未知错误：{raw}');
});

test('store-level texts are unchanged', () => {
  assert.equal(ERROR_TEMPLATE.STATE_CORRUPT, '状态不可读，已备份为 state.json.corrupt');
  assert.equal(ERROR_TEMPLATE.INSTANCE_TERMINAL, '实例已结束（{state}），本迭代不支持重跑');
});

test('I1.2 business error texts match requirement D-5 verbatim', () => {
  assert.equal(ERROR_TEMPLATE.TASK_EMPTY, '任务描述不能为空');
  assert.equal(ERROR_TEMPLATE.TEMPLATE_UNKNOWN, '未知模板：{name}');
  assert.equal(
    ERROR_TEMPLATE.PRODUCT_LINE_MISSING,
    '编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）'
  );
  assert.equal(ERROR_TEMPLATE.DIR_BUSY, '该目录已有未结束的实例 {instanceId}，本次未发起');
  assert.equal(ERROR_TEMPLATE.INSTANCE_RUNNING, '该实例正在执行，本次未发起');
  assert.equal(ERROR_TEMPLATE.INSTANCE_SUSPENDED, '该实例已挂起，不能再次发起；如要重来请新建实例');
  assert.equal(ERROR_TEMPLATE.LEGACY_READ_ONLY, '该实例为旧格式，本版本只支持查看');
  assert.equal(ERROR_TEMPLATE.ESCALATION_WRITE_FAILED, '无法记录升级：{cause}；已停止推进');
  assert.equal(ERROR_TEMPLATE.CANCEL_NOT_NEEDED, '实例已结束（{state}），无需取消');
});

test('formatDuration samples', () => {
  assert.equal(formatDuration(3000), '3s');
  assert.equal(formatDuration(72000), '1m12s');
  assert.equal(formatDuration(120000), '2m');
});

test('formatDuration edge values', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(500), '1s');
  assert.equal(formatDuration(59999), '1m');
  assert.equal(formatDuration(60000), '1m');
  assert.equal(formatDuration(65000), '1m5s');
  assert.equal(formatDuration(-5), '0s');
  assert.equal(formatDuration('bad'), '0s');
});

test('instance labels include suspended', () => {
  assert.deepEqual({ ...INSTANCE_LABEL }, {
    created: '已创建',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    interrupted: '已中断',
    suspended: '已挂起'
  });
});

test('node labels include escalated', () => {
  assert.deepEqual({ ...NODE_LABEL }, {
    pending: '待执行',
    running: '执行中',
    review: '待校验',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消',
    escalated: '已升级'
  });
});

test('session labels match the display table', () => {
  assert.deepEqual({ ...SESSION_LABEL }, {
    idle: '空闲',
    thinking: '执行中',
    tool_running: '执行中',
    waiting_input: '等待审批',
    waiting_dependency: '等待下游',
    escalated: '已升级'
  });
});

test('handoff labels cover all seven states', () => {
  assert.deepEqual({ ...HANDOFF_LABEL }, {
    created: '已构造',
    delivered: '已投递',
    pending: '待投递',
    accepted: '已接受',
    consumed: '已完成',
    rejected: '已拒绝',
    expired: '已过期'
  });
});

test('escalation labels match D-5', () => {
  assert.deepEqual({ ...ESCALATION_LABEL }, { pending: '待处理', voided: '已作废' });
});

test('role labels keep coordinator defined', () => {
  assert.deepEqual({ ...ROLE_LABEL }, {
    developer: '开发',
    tester: '测试',
    coordinator: '协调者'
  });
});

test('template labels match D-5 (single kept but unused)', () => {
  assert.deepEqual({ ...TEMPLATE_LABEL }, { single: '单节点', 'code-loop': '编码闭环' });
});

test('handoff direction: forward has no suffix, backflow / retest append full-width parens', () => {
  assert.deepEqual({ ...HANDOFF_DIRECTION }, { forward: '', backflow: '回流', retest: '复测' });

  assert.equal(formatHandoffDirection('开发', '测试', 'forward'), '开发→测试');
  assert.equal(formatHandoffDirection('开发', '测试'), '开发→测试');
  assert.equal(formatHandoffDirection('测试', '开发', 'backflow'), '测试→开发（回流）');
  assert.equal(formatHandoffDirection('开发', '测试', 'retest'), '开发→测试（复测）');
});

test('node qualifiers and handoff reject reasons match the display table', () => {
  assert.deepEqual({ ...NODE_QUALIFIER }, { waiting_retest: '等待复测', escalation_unrecorded: '升级未记录' });
  assert.deepEqual({ ...HANDOFF_REJECT_REASON }, {
    withdrawn: '已撤回',
    permission_denied: '审批被拒',
    target_rejected: '目标拒绝'
  });
});

test('layer prefixes include escalation', () => {
  assert.deepEqual({ ...LAYER }, {
    instance: '实例',
    node: '节点',
    session: '会话',
    handoff: '交接包',
    escalation: '升级'
  });
});

test('reason vocabulary is complete (I1.1 baseline + I1.2 additions)', () => {
  // Transcribed from requirement D-5; a missing key would print the raw English reason.
  assert.deepEqual({ ...REASON_LABEL }, {
    'state.change': '状态变化',
    illegal_transition: '非法迁移',
    'store.write_failed': '写入失败',
    'store.conflict': '写入冲突',
    'run.started': '开始运行',
    'permission.requested': '请求审批',
    'permission.allowed': '审批放行',
    'permission.denied': '审批拒绝',
    'session.state': '会话状态',
    'output.submitted': '产出已提交',
    'verification.skipped': '跳过核对',
    'verification.passed': '核对通过',
    'verification.failed': '核对失败',
    'run.cancelled': '取消运行',
    'run.completed': '运行完成',
    'run.failed': '运行失败',
    'handoff.created': '构造交接',
    'handoff.delivered': '交接已投递',
    'handoff.rejected': '交接被拒',
    'handoff.consumed': '产出核对通过',
    'turn.first_event': '首个事件',
    'core.stop': '核心停止',
    'core.gone': '核心消失',
    'node.dispatch': '派发',
    'verdict.read': '读取判定',
    'verdict.invalid': '判定无效',
    'backflow.constructed': '构造回流',
    'rounds.exceeded': '超上限',
    'escalation.created': '创建升级',
    'escalation.voided': '作废升级',
    'core.suspend': '挂起',
    'wake.rejected': '唤醒被拒',
    'run.halted': '停止推进'
  });
  assert.equal(Object.keys(REASON_LABEL).length, 33);
});

test('event-line fragments match D-5 verbatim', () => {
  assert.equal(BACKFLOW_DEFECT_LINE, '缺陷 {i}：{summary}（证据 {evidence}）');
  assert.equal(BACKFLOW_RETEST_LINE, '复测要求：{text}');
  assert.equal(INSTANCE_STOPPED_SUFFIX, '已停止推进');
  assert.equal(SESSION_WAITING_DOWNSTREAM, '会话 等待下游');
});

test('escalation block matches requirement 2.6 / D-5', () => {
  assert.deepEqual({ ...ESCALATION_BLOCK }, {
    none: '升级 —',
    header: '升级 {id} {state}',
    reason: '  原因：{detail}',
    node: '  节点：{nodeId} {role} · 第 {round} 轮',
    defect: '  缺陷：{summary}（证据 {evidence}）',
    next: '  下一步：本版本只能查看；要终止请执行 orch cancel --instance {id}'
  });
});

test('orch run closing lines match appendix A-4', () => {
  assert.equal(ESCALATION_SUMMARY_LINE, '升级 {id} {state} · 节点 {nodeId} {role} · 第 {round} 轮');
  assert.equal(
    NEXT_STEP_SUSPENDED,
    '下一步：查看详情 orch status --instance {id} --events；本版本不能继续，要终止请执行 orch cancel --instance {id}'
  );
  assert.equal(
    NEXT_STEP_HALTED,
    '下一步：查看 orch status --instance {id} --events；本版本不能继续，只能取消'
  );
});
