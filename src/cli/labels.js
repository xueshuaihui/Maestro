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
  interrupted: '已中断'
});

export const NODE_LABEL = Object.freeze({
  pending: '待执行',
  running: '执行中',
  review: '待校验',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消'
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

/**
 * 非失败类的提示行模板（同样只在这里放中文）。
 *
 * `CORE_GONE_NOTE`：`orch run` 等待期间核心被 `core stop` 停掉、且重连不上/取不到快照时
 * 的一行说明（C-3）。它必须和"未知错误"区分开：核心没了不是宿主错误。
 */
export const CLI_NOTE = Object.freeze({
  CORE_GONE_NOTE: '实例 {id} · 已中断 ｜ 核心已停止',
});

/** Nine user-facing failure texts (requirements 2.6, verbatim) plus two store-level ones. */
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
  INSTANCE_TERMINAL: '实例已结束（{state}），本迭代不支持重跑'
});

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
