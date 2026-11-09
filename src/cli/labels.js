/**
 * The only place where user-visible Chinese lives.
 * Internal state values stay English everywhere else (iteration doc 1.5).
 */

export const INSTANCE_LABEL = Object.freeze({
  created: '已创建',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  interrupted: '已中断',
  suspended: '已挂起'
});

export const NODE_LABEL = Object.freeze({
  pending: '待执行',
  running: '执行中',
  review: '待校验',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
  escalated: '已升级'
});

export const SESSION_LABEL = Object.freeze({
  idle: '空闲',
  thinking: '执行中',
  tool_running: '执行中',
  waiting_input: '等待审批',
  waiting_dependency: '等待下游',
  escalated: '已升级'
});

export const HANDOFF_LABEL = Object.freeze({
  created: '已构造',
  delivered: '已投递',
  pending: '待投递',
  accepted: '已接受',
  consumed: '已完成',
  rejected: '已拒绝',
  expired: '已过期'
});

export const ESCALATION_LABEL = Object.freeze({
  pending: '待处理',
  resolved: '已处理',
  voided: '已作废'
});

/** Approval lifecycle (requirement D-8 / M-7). */
export const APPROVAL_LABEL = Object.freeze({
  pending: '待处理',
  approved: '已通过',
  denied: '已拒绝',
  withdrawn: '已作废'
});

/** Escalation decision wording (requirement D-8 / D-6). */
export const RESOLUTION_LABEL = Object.freeze({
  pass: '通过',
  fail: '失败',
  retry: '重新分配'
});

/**
 * `workflow` subcommand wording (requirement A-3 / D-8). The result lines themselves
 * reuse the instance row and the cancel row; only the action words live here.
 */
export const WORKFLOW_LABEL = Object.freeze({
  pause: '暂停',
  resume: '恢复',
  abort: '终止'
});

/** Role names (requirement D-5). `coordinator` is defined but not dispatched. */
export const ROLE_LABEL = Object.freeze({
  developer: '开发',
  tester: '测试',
  coordinator: '协调者',
  // I1.3 `task-loop` roles (requirement D-4).
  researcher: '研究员',
  writer: '撰写者',
  reviewer: '审核者'
});

/** Template names. The `single` entry is kept but unused: a `single` instance line prints no template. */
export const TEMPLATE_LABEL = Object.freeze({
  single: '单节点',
  'code-loop': '编码闭环',
  'task-loop': '通用任务闭环'
});

/** Layer prefixes for status lines (requirement appendix A). */
export const LAYER = Object.freeze({
  instance: '实例',
  node: '节点',
  session: '会话',
  handoff: '交接包',
  escalation: '升级',
  approval: '审批'
});

/**
 * Handoff direction suffix by edge kind (requirement D-5).
 * The direction text is always `<fromRole>→<toRole>`; only a non-empty suffix is
 * appended as `（<suffix>）`, i.e. `开发→测试`, `测试→开发（回流）`, `开发→测试（复测）`.
 */
export const HANDOFF_DIRECTION = Object.freeze({
  forward: '',
  backflow: '回流',
  retest: '复测'
});

export function formatHandoffDirection(fromRole, toRole, kind = 'forward') {
  const suffix = HANDOFF_DIRECTION[kind] ?? '';
  const base = `${fromRole}→${toRole}`;
  return suffix ? `${base}（${suffix}）` : base;
}

/**
 * Node-row qualifiers (requirement 2.3 / D-5). Rendered inside full-width parentheses.
 *
 * Keys are machine codes, never the Chinese text: `node.note` stores the Chinese
 * wording, so a `hasOwnProperty(NODE_QUALIFIER, note)` lookup cannot match it. The
 * `waiting_review` / `evidence_check` / `waiting_downstream` entries are read by the
 * explicit branches in `render.js` only (I1.3, requirement A-2).
 */
export const NODE_QUALIFIER = Object.freeze({
  waiting_retest: '等待复测',
  escalation_unrecorded: '升级未记录',
  evidence_check: '核对证据',
  waiting_downstream: '等待下游',
  waiting_review: '等待复审'
});

/**
 * Mutually exclusive suffixes on a node row (requirement D-4 / A-2). Only rendered for
 * `productPolicy === 'doc-single'` instances.
 */
export const NODE_SUFFIX = Object.freeze({
  artifact: '· 产物 {ref}',
  reviewPassed: '· 审核 通过',
  reviewRejected: '· 审核 驳回 · 缺陷 {n} 条'
});

/** Handoff reject reasons (requirement D-5; same mapping as the I1.1 renderer). */
export const HANDOFF_REJECT_REASON = Object.freeze({
  withdrawn: '已撤回',
  permission_denied: '审批被拒',
  target_rejected: '目标拒绝',
  invalid_payload: '内容不合规',
  delivery_failed: '投递失败'
});

/**
 * Non-failure hint lines (Chinese lives here too).
 *
 * `CORE_GONE_NOTE`：`orch run` 等待期间核心被 `core stop` 停掉、且重连不上/取不到快照时
 * 的一行说明（C-3）。它必须和"未知错误"区分开：核心没了不是宿主错误。
 */
export const CLI_NOTE = Object.freeze({
  CORE_GONE_NOTE: '实例 {id} · 已中断 ｜ 核心已停止'
});

/** Nine user-facing failure texts (requirements 2.6, verbatim) plus I1.2 business codes. */
export const ERROR_TEMPLATE = Object.freeze({
  DSH_SPAWN_FAILED: '无法启动 DSH：{cause}',
  CWD_NOT_WRITABLE: '工作目录不可写：{path}',
  CORE_START_FAILED: '核心进程启动失败：{cause}',
  NODE_BUSY: '该节点正在执行，本次未发起',
  SESSION_INVALID: '会话已失效，需要重新创建',
  PERMISSION_DENIED: '审批被拒绝，任务中止于 {step}',
  HOST_ERROR: '执行失败：{raw}',
  VERIFY_FAILED: '核对失败：{reason}',
  UNKNOWN_ERROR: '未知错误：{raw}',
  STATE_CORRUPT: '状态不可读，已备份为 state.json.corrupt',
  // 契约第 10 条：终态不支持重跑的独立原因，不属于需求 2.6 的 9 条（BR-13 禁止合并不同原因），
  // 登记于 iteration-1.md §2.14。
  INSTANCE_TERMINAL: '实例已结束（{state}），本迭代不支持重跑',
  // I1.2 business codes (requirement D-5, verbatim). All exit with code 1.
  TASK_EMPTY: '任务描述不能为空',
  TEMPLATE_UNKNOWN: '未知模板：{name}',
  PRODUCT_LINE_MISSING: '编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）',
  DIR_BUSY: '该目录已有未结束的实例 {instanceId}，本次未发起',
  INSTANCE_RUNNING: '该实例正在执行，本次未发起',
  INSTANCE_SUSPENDED: '该实例已挂起，不能再次发起；如要重来请新建实例',
  LEGACY_READ_ONLY: '该实例为旧格式，本版本只支持查看',
  ESCALATION_WRITE_FAILED: '无法记录升级：{cause}；已停止推进',
  CANCEL_NOT_NEEDED: '实例已结束（{state}），无需取消',
  // I1.3 business codes (requirement D-5, verbatim). All three use existing placeholder
  // names only — the `applyPlaceholders()` whitelist is NOT extended (AC-36).
  PRODUCT_LINE_MISSING_TASK_LOOP:
    '通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）',
  PRODUCT_INVALID_TASK_LOOP:
    '通用任务闭环的产物名不合法：{name}（只写文件名，.md 结尾，不带目录与版本号）',
  WORKSPACE_INIT_FAILED: '无法创建工作区：{cause}',
  // I1.4 general code (requirement A-5): only generic codes enter this table; the
  // command-level A-5 codes are rendered by their own command handlers.
  STORE_CONFLICT: '操作冲突，请重试'
});

/**
 * Command-level failure texts (requirement A-5, verbatim). These codes never enter
 * `src/core/error-map.js` `CODES` (D-10.4) and never reach `renderError`; each command
 * renders its own row from this table. Placeholders: `{id}` = the addressed id,
 * `{state}` = a Chinese state word, `{decision}` / `{allowed}` = raw CLI values.
 */
export const COMMAND_ERROR = Object.freeze({
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

/**
 * Event reason vocabulary (requirement D-5). Every event line renders one of these;
 * a missing key would print the raw English reason to the user.
 */
export const REASON_LABEL = Object.freeze({
  // I1.1 baseline (unchanged).
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
  // I1.2 additions.
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

/** `已停止推进` suffix on the instance line when the escalation write failed. */
export const INSTANCE_STOPPED_SUFFIX = '已停止推进';

/**
 * I1.4 row fragments (requirement A-2 / D-8): the paused qualifier replaces the state
 * word on an instance line, the approval counter is only appended when > 0, and the
 * retry suffix is appended to a `待投递` handoff row.
 */
export const INSTANCE_PAUSED_SUFFIX = '（已暂停）';
export const PENDING_APPROVAL_SUFFIX = '待处理审批 {n}';
export const HANDOFF_RETRY_SUFFIX = '重试 {n}/2';

/**
 * Verdict-file wording (requirement D-5). WP-3 currently keeps an identical copy in
 * `src/templates/index.js` because `src/core/**` may not import this module this
 * round; `labels.js` is the canonical wording table and that copy is expected to
 * switch its import to here (no wording change).
 */
export const VERDICT_TEXT = Object.freeze({
  prefix: '核对失败：',
  missing: '未找到判定文件 out/verdict.json',
  stale: '判定文件不是本轮新写 out/verdict.json',
  unparsable: '判定文件不可解析',
  schemaInvalid: '判定文件不可解析',
  noDefects: '判定为不通过，但没有缺陷清单',
  passWithDefects: '判定为通过，但缺陷清单非空',
  evidenceUnreadable: '缺陷证据不可解析'
});

/**
 * Review-file wording (requirement D-5, I1.3). Same shape as `VERDICT_TEXT`: the entry
 * itself carries no placeholder; the core appends the variable segment as a JS template
 * literal (`{artifact}` / `{evidence}` here only mark "a value follows on this line").
 */
export const REVIEW_TEXT = Object.freeze({
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

/** Product-file wording (requirement D-5, I1.3). `{ref}` is appended by the core. */
export const ARTIFACT_TEXT = Object.freeze({
  missing: '未找到声明的产出 {ref}',
  empty: '产出为空 {ref}',
  stale: '产出不是本轮新写 {ref}',
  previousMissing: '上一版文档缺失 {ref}',
  previousModified: '上一版文档被改写 {ref}'
});

/** Used when the review file carries no `revisionRequirement` (requirement D-5). */
export const DEFAULT_REVISION_REQUIREMENT = '请按缺陷清单逐条修改后交出新版本';

/** Indented details under a `backflow.constructed` event line (6-space prefix at render time). */
export const BACKFLOW_DEFECT_LINE = '缺陷 {i}：{summary}（证据 {evidence}）';
export const BACKFLOW_RETEST_LINE = '复测要求：{text}';
export const BACKFLOW_REVISION_LINE = '修改要求：{text}';

/** Waiting line for a session that has already produced output (requirement appendix A-1 #5). */
export const SESSION_WAITING_DOWNSTREAM = '会话 等待下游';

/** Escalation block under `orch status` (requirement 2.6 / D-5 / A-2 #4). */
export const ESCALATION_BLOCK = Object.freeze({
  none: '升级 —',
  header: '升级 {id} {state}',
  reason: '  原因：{detail}',
  node: '  节点：{nodeId} {role} · 第 {round} 轮',
  defect: '  缺陷：{summary}（证据 {evidence}）',
  next:
    '  下一步：orch escalate list --instance {id} 查看升级；orch escalate resolve ESC-nnn --instance {id} --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance {id}'
});

/** One-line escalation summary printed by `orch run` when it ends suspended (appendix A-4). */
export const ESCALATION_SUMMARY_LINE = '升级 {id} {state} · 节点 {nodeId} {role} · 第 {round} 轮';

/**
 * Closing "next step" lines for `orch run` (appendix A-2 #4 / #5). `NEXT_STEP_HALTED`
 * is unchanged: a halted instance can only be cancelled.
 */
export const NEXT_STEP_SUSPENDED =
  '下一步：orch escalate list --instance {id} 查看升级；orch escalate resolve ESC-nnn --instance {id} --decision retry|pass|fail 处理；要终止请执行 orch cancel --instance {id}';
export const NEXT_STEP_HALTED =
  '下一步：查看 orch status --instance {id} --events；本版本不能继续，只能取消';
/** Foreground `orch run` ending on a dispatch-boundary pause (requirement A-2 #6 / D-7.9). */
export const NEXT_STEP_PAUSED = '下一步：恢复推进 orch workflow resume {id}';

/**
 * Duration for display: '3s' | '1m12s' | '2m'.
 * Sub-second positive values clamp to 1s so a running task never reads '0s'.
 */
export function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '0s';

  let totalSeconds = Math.round(value / 1000);
  if (totalSeconds < 1) totalSeconds = 1;

  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m${seconds}s`;
}
