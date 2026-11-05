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
  voided: '已作废'
});

/** Role names (requirement D-5). `coordinator` is defined but not dispatched this iteration. */
export const ROLE_LABEL = Object.freeze({
  developer: '开发',
  tester: '测试',
  coordinator: '协调者'
});

/** Template names. The `single` entry is kept but unused: a `single` instance line prints no template. */
export const TEMPLATE_LABEL = Object.freeze({
  single: '单节点',
  'code-loop': '编码闭环'
});

/** Layer prefixes for status lines (requirement appendix A). */
export const LAYER = Object.freeze({
  instance: '实例',
  node: '节点',
  session: '会话',
  handoff: '交接包',
  escalation: '升级'
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

/** Node-row qualifiers (requirement 2.3 / D-5). Rendered inside full-width parentheses. */
export const NODE_QUALIFIER = Object.freeze({
  waiting_retest: '等待复测',
  escalation_unrecorded: '升级未记录'
});

/** Handoff reject reasons (requirement D-5; same mapping as the I1.1 renderer). */
export const HANDOFF_REJECT_REASON = Object.freeze({
  withdrawn: '已撤回',
  permission_denied: '审批被拒',
  target_rejected: '目标拒绝'
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
  CANCEL_NOT_NEEDED: '实例已结束（{state}），无需取消'
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
  'run.halted': '停止推进'
});

/** `已停止推进` suffix on the instance line when the escalation write failed. */
export const INSTANCE_STOPPED_SUFFIX = '已停止推进';

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

/** Indented details under a `backflow.constructed` event line (6-space prefix at render time). */
export const BACKFLOW_DEFECT_LINE = '缺陷 {i}：{summary}（证据 {evidence}）';
export const BACKFLOW_RETEST_LINE = '复测要求：{text}';

/** Waiting line for a session that has already produced output (requirement appendix A-1 #5). */
export const SESSION_WAITING_DOWNSTREAM = '会话 等待下游';

/** Escalation block under `orch status` (requirement 2.6 / D-5). */
export const ESCALATION_BLOCK = Object.freeze({
  none: '升级 —',
  header: '升级 {id} {state}',
  reason: '  原因：{detail}',
  node: '  节点：{nodeId} {role} · 第 {round} 轮',
  defect: '  缺陷：{summary}（证据 {evidence}）',
  next: '  下一步：本版本只能查看；要终止请执行 orch cancel --instance {id}'
});

/** One-line escalation summary printed by `orch run` when it ends suspended (appendix A-4). */
export const ESCALATION_SUMMARY_LINE = '升级 {id} {state} · 节点 {nodeId} {role} · 第 {round} 轮';

/** Closing "next step" lines for `orch run` (appendix A-4). */
export const NEXT_STEP_SUSPENDED =
  '下一步：查看详情 orch status --instance {id} --events；本版本不能继续，要终止请执行 orch cancel --instance {id}';
export const NEXT_STEP_HALTED =
  '下一步：查看 orch status --instance {id} --events；本版本不能继续，只能取消';

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
