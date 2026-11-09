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
  APPROVAL_LABEL,
  RESOLUTION_LABEL,
  WORKFLOW_LABEL,
  COMMAND_ERROR,
  REASON_LABEL,
  ESCALATION_BLOCK,
  INSTANCE_STOPPED_SUFFIX,
  BACKFLOW_DEFECT_LINE,
  BACKFLOW_RETEST_LINE,
  SESSION_WAITING_DOWNSTREAM,
  ESCALATION_SUMMARY_LINE,
  NEXT_STEP_SUSPENDED,
  NEXT_STEP_HALTED,
  NEXT_STEP_PAUSED,
  INSTANCE_PAUSED_SUFFIX,
  PENDING_APPROVAL_SUFFIX,
  HANDOFF_RETRY_SUFFIX,
  ERROR_TEMPLATE,
  REVIEW_TEXT,
  ARTIFACT_TEXT,
  DEFAULT_REVISION_REQUIREMENT,
  NODE_SUFFIX,
  BACKFLOW_REVISION_LINE,
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
  assert.deepEqual({ ...ESCALATION_LABEL }, {
    pending: '待处理',
    resolved: '已处理',
    voided: '已作废'
  });
});

test('approval labels match D-8 / M-7', () => {
  assert.deepEqual({ ...APPROVAL_LABEL }, {
    pending: '待处理',
    approved: '已通过',
    denied: '已拒绝',
    withdrawn: '已作废'
  });
  assert.deepEqual({ ...RESOLUTION_LABEL }, { pass: '通过', fail: '失败', retry: '重新分配' });
});

test('role labels keep coordinator defined', () => {
  assert.deepEqual({ ...ROLE_LABEL }, {
    developer: '开发',
    tester: '测试',
    coordinator: '协调者',
    // I1.3 `task-loop` roles (requirement D-4).
    researcher: '研究员',
    writer: '撰写者',
    reviewer: '审核者'
  });
});

test('template labels match D-5 (single kept but unused)', () => {
  assert.deepEqual({ ...TEMPLATE_LABEL }, {
    single: '单节点',
    'code-loop': '编码闭环',
    'task-loop': '通用任务闭环'
  });
});

test('handoff direction: forward has no suffix, backflow / retest append full-width parens', () => {
  assert.deepEqual({ ...HANDOFF_DIRECTION }, { forward: '', backflow: '回流', retest: '复测' });

  assert.equal(formatHandoffDirection('开发', '测试', 'forward'), '开发→测试');
  assert.equal(formatHandoffDirection('开发', '测试'), '开发→测试');
  assert.equal(formatHandoffDirection('测试', '开发', 'backflow'), '测试→开发（回流）');
  assert.equal(formatHandoffDirection('开发', '测试', 'retest'), '开发→测试（复测）');
});

test('node qualifiers and handoff reject reasons match the display table', () => {
  assert.deepEqual({ ...NODE_QUALIFIER }, {
    waiting_retest: '等待复测',
    escalation_unrecorded: '升级未记录',
    evidence_check: '核对证据',
    waiting_downstream: '等待下游',
    waiting_review: '等待复审'
  });
  assert.deepEqual({ ...HANDOFF_REJECT_REASON }, {
    withdrawn: '已撤回',
    permission_denied: '审批被拒',
    target_rejected: '目标拒绝',
    invalid_payload: '内容不合规',
    delivery_failed: '投递失败'
  });
});

test('layer prefixes include escalation and approval', () => {
  assert.deepEqual({ ...LAYER }, {
    instance: '实例',
    node: '节点',
    session: '会话',
    handoff: '交接包',
    escalation: '升级',
    approval: '审批'
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
    'run.halted': '停止推进',
    // I1.3 additions (review node + downstream gate).
    'review.read': '读取审核',
    'review.passed': '审核通过',
    'review.rejected': '审核驳回',
    'review.invalid': '审核无效',
    'review.downstream_accepted': '下游已接受',
    'review.evidence_verified': '证据核对通过',
    // I1.4 additions (inbox retry / approval / pause / workspace status page).
    'handoff.inboxed': '已入信箱',
    'handoff.pending': '等待投递',
    'handoff.expired': '投递已过期',
    'escalation.resolved': '处理升级',
    'approval.created': '创建审批',
    'approval.withdrawn': '作废审批',
    'workflow.paused': '暂停推进',
    'workflow.resumed': '恢复推进',
    'workspace.status_write_failed': '状态页写入失败'
  });
  assert.equal(Object.keys(REASON_LABEL).length, 48);
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
    next:
      '  下一步：orch escalate list --instance {id} 查看升级；orch escalate resolve ESC-nnn --instance {id} --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance {id}'
  });
});

test('orch run closing lines match appendix A-4', () => {
  assert.equal(ESCALATION_SUMMARY_LINE, '升级 {id} {state} · 节点 {nodeId} {role} · 第 {round} 轮');
  // A-2 #4 / M-11: 挂起后的下一步必须给出 escalate list / resolve。
  assert.equal(
    NEXT_STEP_SUSPENDED,
    '下一步：orch escalate list --instance {id} 查看升级；orch escalate resolve ESC-nnn --instance {id} --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance {id}'
  );
  assert.equal(
    NEXT_STEP_HALTED,
    '下一步：查看 orch status --instance {id} --events；本版本不能继续，只能取消'
  );
  // A-2 #6 / D-7.9: paused is not a failure and not a suspension.
  assert.equal(NEXT_STEP_PAUSED, '下一步：恢复推进 orch workflow resume {id}');
});

test('workflow action words match D-8', () => {
  assert.deepEqual({ ...WORKFLOW_LABEL }, { pause: '暂停', resume: '恢复', abort: '终止' });
});

test('I1.4 row fragments match A-2 / D-8', () => {
  assert.equal(INSTANCE_PAUSED_SUFFIX, '（已暂停）');
  assert.equal(PENDING_APPROVAL_SUFFIX, '待处理审批 {n}');
  assert.equal(HANDOFF_RETRY_SUFFIX, '重试 {n}/2');
});

test('I1.4 generic error texts match A-5', () => {
  // 命令级错误码由各命令渲染器处理，只有通用码进 ERROR_TEMPLATE（D-10.4）。
  assert.equal(ERROR_TEMPLATE.STORE_CONFLICT, '操作冲突，请重试');
  assert.equal(ERROR_TEMPLATE.WORKSPACE_INIT_FAILED, '无法创建工作区：{cause}');
});

test('A-5 command-level error texts (14 codes, verbatim)', () => {
  assert.deepEqual({ ...COMMAND_ERROR }, {
    SESSION_NOT_FOUND: '未找到会话 {id}',
    ESCALATION_NOT_FOUND: '未找到升级 {id}',
    ESCALATION_NOT_PENDING: '升级 {id} 已处理（{state}），无需再次处理',
    ESCALATION_DECISION_INVALID: '升级 {id} 不支持「{decision}」；可选：{allowed}',
    ESCALATION_AMBIGUOUS: '升级号 {id} 在多个实例中存在，请加 --instance',
    INSTANCE_NOT_SUSPENDED: '实例 {id} 当前不是挂起状态，不能处理升级',
    APPROVAL_NOT_FOUND: '未找到审批 {id}',
    APPROVAL_NOT_PENDING: '审批 {id} 已处理（{state}），无需再次处理',
    APPROVAL_AMBIGUOUS: '审批号 {id} 在多个实例中存在，请加 --instance',
    APPROVAL_SESSION_GONE: '审批 {id} 已失效：会话不在运行',
    HANDOFF_NOT_FOUND: '未找到交接包 {id}',
    HANDOFF_AMBIGUOUS: '交接包号 {id} 在多个实例中存在，请加 --instance',
    INSTANCE_NOT_PAUSABLE: '实例 {id} 当前为{state}，不能暂停',
    INSTANCE_NOT_RESUMABLE: '实例 {id} 当前为{state}，不能恢复'
  });
  assert.equal(Object.keys(COMMAND_ERROR).length, 14);
});

test('A-5 command-level texts render with their placeholders filled', () => {
  const fill = (template, vars) =>
    String(template).replace(/\{(\w+)\}/g, (match, key) =>
      vars[key] === undefined || vars[key] === null ? '' : String(vars[key])
    );

  const cases = [
    ['SESSION_NOT_FOUND', { id: 'SES-001' }, '未找到会话 SES-001'],
    ['ESCALATION_NOT_FOUND', { id: 'ESC-001' }, '未找到升级 ESC-001'],
    ['ESCALATION_NOT_PENDING', { id: 'ESC-001', state: '已作废' }, '升级 ESC-001 已处理（已作废），无需再次处理'],
    [
      'ESCALATION_DECISION_INVALID',
      { id: 'ESC-001', decision: 'reopen', allowed: 'retry|pass|fail' },
      '升级 ESC-001 不支持「reopen」；可选：retry|pass|fail'
    ],
    ['ESCALATION_AMBIGUOUS', { id: 'ESC-001' }, '升级号 ESC-001 在多个实例中存在，请加 --instance'],
    ['INSTANCE_NOT_SUSPENDED', { id: 'INST-001' }, '实例 INST-001 当前不是挂起状态，不能处理升级'],
    ['APPROVAL_NOT_FOUND', { id: 'APR-001' }, '未找到审批 APR-001'],
    ['APPROVAL_NOT_PENDING', { id: 'APR-001', state: '已通过' }, '审批 APR-001 已处理（已通过），无需再次处理'],
    ['APPROVAL_AMBIGUOUS', { id: 'APR-001' }, '审批号 APR-001 在多个实例中存在，请加 --instance'],
    ['APPROVAL_SESSION_GONE', { id: 'APR-001' }, '审批 APR-001 已失效：会话不在运行'],
    ['HANDOFF_NOT_FOUND', { id: 'HO-001' }, '未找到交接包 HO-001'],
    ['HANDOFF_AMBIGUOUS', { id: 'HO-001' }, '交接包号 HO-001 在多个实例中存在，请加 --instance'],
    ['INSTANCE_NOT_PAUSABLE', { id: 'INST-001', state: '已挂起' }, '实例 INST-001 当前为已挂起，不能暂停'],
    ['INSTANCE_NOT_RESUMABLE', { id: 'INST-001', state: '已取消' }, '实例 INST-001 当前为已取消，不能恢复']
  ];

  for (const [code, vars, expected] of cases) {
    assert.equal(fill(COMMAND_ERROR[code], vars), expected, code);
  }
});

// --- I1.3 (requirement D-4 / D-5) ---------------------------------------------------

test('I1.3 business error texts match D-5 verbatim', () => {
  assert.equal(
    ERROR_TEMPLATE.PRODUCT_LINE_MISSING_TASK_LOOP,
    '通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）'
  );
  assert.equal(
    ERROR_TEMPLATE.PRODUCT_INVALID_TASK_LOOP,
    '通用任务闭环的产物名不合法：{name}（只写文件名，.md 结尾，不带目录与版本号）'
  );
  assert.equal(ERROR_TEMPLATE.WORKSPACE_INIT_FAILED, '无法创建工作区：{cause}');
});

test('review file wording matches D-5 verbatim (11 entries)', () => {
  assert.deepEqual({ ...REVIEW_TEXT }, {
    prefix: '核对失败：',
    missing: '未找到审核文件 out/review.json',
    stale: '审核文件不是本轮新写 out/review.json',
    unparsable: '审核文件不可解析',
    decisionInvalid: '审核结论只能是 pass 或 reject',
    artifactMissing: '审核未引用本轮文档',
    artifactMismatch: '审核引用的不是本轮文档 {artifact}',
    passWithDefects: '审核为通过，但缺陷清单非空',
    rejectNoDefects: '审核为驳回，但没有缺陷清单',
    defectShape: '审核缺陷缺少摘要或证据',
    evidenceUnreadable: '缺陷证据不可解析 {evidence}'
  });
  assert.equal(Object.keys(REVIEW_TEXT).length, 11);
});

test('product-file wording matches D-5 verbatim (5 entries)', () => {
  assert.deepEqual({ ...ARTIFACT_TEXT }, {
    missing: '未找到声明的产出 {ref}',
    empty: '产出为空 {ref}',
    stale: '产出不是本轮新写 {ref}',
    previousMissing: '上一版文档缺失 {ref}',
    previousModified: '上一版文档被改写 {ref}'
  });
  assert.equal(Object.keys(ARTIFACT_TEXT).length, 5);
});

test('node suffixes are mutually exclusive and only used by doc-single', () => {
  assert.deepEqual({ ...NODE_SUFFIX }, {
    artifact: '· 产物 {ref}',
    reviewPassed: '· 审核 通过',
    reviewRejected: '· 审核 驳回 · 缺陷 {n} 条'
  });
  assert.equal(DEFAULT_REVISION_REQUIREMENT, '请按缺陷清单逐条修改后交出新版本');
  assert.equal(BACKFLOW_REVISION_LINE, '修改要求：{text}');
});
