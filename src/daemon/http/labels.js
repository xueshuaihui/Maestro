/**
 * 桌面文案键全集（I1.10a WP-7）：`GET /ui/labels` 的唯一键值来源（需求 D-2 / A-14）。
 *
 * 组成（中文逐字基线 = 需求附录 A-1 ~ A-13，逐字边界见 A-0）：
 * 1. `DESKTOP_LABEL_KEYS`：本迭代桌面新增键（UPPER_SNAKE + `{xx}` 字面占位符，
 *    风格沿用 `src/cli/labels.js` 既有惯例；占位符只做字面替换，不做插值）。
 * 2. 复用键：经只读 import `src/cli/labels.js` 平铺为 `表名_成员名`（daemon 读 CLI
 *    文案模块做下发属需求 D-2/D-7 明确设计，中文唯一来源不变，见拆分文档 C-03）。
 *
 * 冻结契约：键名集合是 WP-2/3/5/6/8 的取值依据，增删改键必须先改需求附录 A-14
 * 并同步 `test/wp13/labels-desktop.test.js`（键全集精确集合相等，多键/少键都 fail）。
 */

import {
  COMMAND_ERROR,
  ERROR_TEMPLATE,
  HANDOFF_LABEL,
  HEALTH_LABEL,
  HEALTH_LINE,
  HEALTH_REASON,
  INSTANCE_LABEL,
  NODE_LABEL,
  ROLE_INSTANCE_STATUS_LABEL,
  TEMPLATE_LABEL
} from '../../cli/labels.js';

/**
 * 桌面新增键（附录 A-1 ~ A-13 逐字；`{xx}` 为占位符，替换时不做任何转义加工）。
 * 分组顺序与附录 A 小节一一对应。
 */
export const DESKTOP_LABEL_KEYS = Object.freeze({
  // A-1 主窗口实例列表行（六项固定顺序；`待处理 0` 也显示）。
  DESKTOP_LIST_ROW:
    '实例 {id} · {template} · {state} · 进度 {done}/{total} · 待处理 {pending} · {health}',
  DESKTOP_LIST_FIELD_PROGRESS: '进度 {done}/{total}',
  DESKTOP_LIST_FIELD_PENDING: '待处理 {n}',
  // A-2 空态与不可读行（文案与 CLI 渲染层现状逐字一致）。
  DESKTOP_LIST_EMPTY: '实例 无',
  DESKTOP_LIST_UNREADABLE: '实例 {id} · 状态不可读',
  // A-3 项目未指定 / 项目不可用。
  DESKTOP_PROJECT_MISSING: '项目 未指定 · 请填写项目目录',
  DESKTOP_PROJECT_INVALID: '项目 不可用 · {path}',
  // A-4 连接三态。
  DESKTOP_CONN_CONNECTING: '正在连接守护进程…',
  DESKTOP_CONN_RECONNECTING: '已断开 · 正在重连…',
  DESKTOP_CONN_FAILED: '连接守护进程失败 · 请确认项目目录后重试',
  // A-5 新建实例面板、校验与失败（错误原文经 ERROR_TEMPLATE 透传，不在此复写）。
  DESKTOP_NEW_TITLE: '新建实例',
  DESKTOP_NEW_FIELD_WORKFLOW: '工作流',
  DESKTOP_NEW_FIELD_TASK: '任务说明',
  DESKTOP_NEW_ACTION_START: '启动',
  DESKTOP_NEW_ACTION_CANCEL: '取消',
  DESKTOP_NEW_VALIDATE_WORKFLOW: '请选择工作流',
  DESKTOP_NEW_VALIDATE_TASK: '请填写任务说明',
  DESKTOP_NEW_STARTED: '已启动 {id}',
  DESKTOP_NEW_START_FAILED: '启动失败 · {reason}',
  // A-6 托盘菜单与退出确认（N 为运行中实例数，0 时不出现确认）。
  DESKTOP_TRAY_OPEN: '打开主窗口',
  DESKTOP_TRAY_QUIT: '退出',
  DESKTOP_QUIT_CONFIRM: '有 {n} 个实例正在运行，退出将停止守护进程',
  DESKTOP_QUIT_CONFIRM_QUIT: '退出',
  DESKTOP_QUIT_CONFIRM_CANCEL: '取消',
  // A-8 流程图图例（固定两行，锚点画布左下角）。
  DESKTOP_LEGEND_ROLE: '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与',
  DESKTOP_LEGEND_SPECIAL: '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流',
  // A-9 角色节点行（折叠形态：`{first} 等 {n} 个`；堆叠角标 `×{n}`；缺项占位 `—`）。
  DESKTOP_ROLE_ROW:
    '角色 {role} · {status} · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts} · 异常 {abnormal}',
  DESKTOP_ROLE_ROW_SERVING_MORE: '{first} 等 {n} 个',
  DESKTOP_ROLE_ROW_SESSION_STACK: '×{n}',
  DESKTOP_PLACEHOLDER: '—',
  // A-10 特殊节点行（子工作流标签用全角冒号；`角色数未知` 为子定义读不到时的降级）。
  DESKTOP_HUMAN_ROW: '人工节点 {title} · {status}',
  DESKTOP_ESCALATE_ROW: '升级节点 {title} · {status}',
  DESKTOP_SUBFLOW_ROW: '子工作流：{title} · {n} 角色',
  DESKTOP_GROUP_ROW: '分组 {group} · {n} 角色',
  DESKTOP_SUBFLOW_UNKNOWN: '子工作流 {id} · 角色数未知',
  // A-11 连接线行（并行计数与正文之间以 ` · ` 相接，故模板自带分隔符）。
  DESKTOP_EDGE_ROW: '连接线 {from}→{to} · {direction} · {status}',
  DESKTOP_EDGE_ROW_PARALLEL: ' · {n} 并行交接',
  DESKTOP_EDGE_ROW_ACCEPTED_HOVER: '已接受 · 处理中',
  DESKTOP_EDGE_NOT_STARTED: '未开始',
  DESKTOP_EDGE_DIRECTION_FORWARD: '正向',
  DESKTOP_EDGE_DIRECTION_BACKFLOW: '回流',
  // A-12 视图控件与看板列名（列状态顺序 blocked/ready/running/review/done/failed/escalated）。
  DESKTOP_VIEW_GRAPH: '流程图',
  DESKTOP_VIEW_BOARD: '节点看板',
  DESKTOP_VIEW_RESET: '复位视图',
  DESKTOP_VIEW_SHOW_NOT_STARTED: '显示未开始连接线',
  DESKTOP_VIEW_HIDE_NOT_STARTED: '隐藏未开始连接线',
  DESKTOP_VIEW_EXPAND_GROUPS: '展开分组',
  DESKTOP_VIEW_COLLAPSE_GROUPS: '收起分组',
  DESKTOP_VIEW_FOCUS: '聚焦 {node}（{hops} 跳）',
  DESKTOP_VIEW_FOCUS_EXIT: '退出聚焦',
  DESKTOP_BOARD_COLUMN_BLOCKED: '被阻塞',
  DESKTOP_BOARD_COLUMN_READY: '可调度',
  DESKTOP_BOARD_COLUMN_RUNNING: '执行中',
  DESKTOP_BOARD_COLUMN_REVIEW: '待校验',
  DESKTOP_BOARD_COLUMN_DONE: '已完成',
  DESKTOP_BOARD_COLUMN_FAILED: '失败',
  DESKTOP_BOARD_COLUMN_ESCALATED: '已升级',
  DESKTOP_BOARD_CANCELLED_FOLD: '已取消 {n}',
  DESKTOP_BOARD_UNKNOWN_STATE: '状态未知',
  // A-13 图数据异常提示（第一行沿用既有 renderInstanceMissing 文案形态）。
  DESKTOP_GRAPH_MISSING: '实例 {id} · 不存在',
  DESKTOP_DEF_UNREADABLE: '流程图定义不可读 · 已按内置模板显示'
});

/**
 * 复用键平铺：`表名_成员名`（成员名大写、`-` 归一为 `_`）。
 * 经 `Object.entries` 取名，不在本文件复写任何既有键字面量，保证同源零漂移。
 */
function flattenTable(prefix, table) {
  const out = {};
  for (const [name, value] of Object.entries(table)) {
    const snake = String(name)
      .replaceAll('-', '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toUpperCase();
    out[`${prefix}_${snake}`] = value;
  }
  return out;
}

/** 下发全集：桌面新增键 + 复用键，扁平 `KEY -> 文案模板`（值与 `src/cli/labels.js` 同一引用）。 */
export const UI_LABEL_KEYS = Object.freeze({
  ...DESKTOP_LABEL_KEYS,
  ...flattenTable('INSTANCE_LABEL', INSTANCE_LABEL),
  ...flattenTable('NODE_LABEL', NODE_LABEL),
  ...flattenTable('HANDOFF_LABEL', HANDOFF_LABEL),
  ...flattenTable('ROLE_INSTANCE_STATUS_LABEL', ROLE_INSTANCE_STATUS_LABEL),
  ...flattenTable('HEALTH_LABEL', HEALTH_LABEL),
  ...flattenTable('HEALTH_LINE', HEALTH_LINE),
  ...flattenTable('HEALTH_REASON', HEALTH_REASON),
  ...flattenTable('TEMPLATE_LABEL', TEMPLATE_LABEL),
  ...flattenTable('ERROR_TEMPLATE', ERROR_TEMPLATE),
  ...flattenTable('COMMAND_ERROR', COMMAND_ERROR)
});

/** `GET /ui/labels` response body (requirement D-2: `{ keys: { "<KEY>": "<label>" } }`). */
export function labelKeysPayload() {
  return Object.freeze({ keys: UI_LABEL_KEYS });
}

// ---------------------------------------------------------------------------
// `GET /ui/labels` route assembly (decision G: folded in from the removed
// labels-route.js). Exports match the WP-2 handler-table seam shape
// `{ method, pattern, handler }`; auth, static files and lifecycle stay in
// `http/server.js` (WP-2).
// ---------------------------------------------------------------------------

/** The single route path constant (matches the requirement D-2 interface table). */
export const UI_LABELS_PATH = '/ui/labels';

/** Response body JSON string (recomputed per call; the key/value table is frozen). */
export function labelsResponseBody() {
  return JSON.stringify(labelKeysPayload());
}

/** Writes 200 + JSON; `res` is a `node:http` ServerResponse. */
export function respondUiLabels(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(labelsResponseBody());
  return res;
}

/** Route descriptor (handler-table shape, see the seam note above). */
export function createLabelsRoute() {
  return {
    method: 'GET',
    pattern: UI_LABELS_PATH,
    handler(req, res) {
      respondUiLabels(res);
    }
  };
}
