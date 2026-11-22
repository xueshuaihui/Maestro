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
  APPROVAL_LABEL,
  COMMAND_ERROR,
  ERROR_TEMPLATE,
  HANDOFF_LABEL,
  HEALTH_LABEL,
  HEALTH_LINE,
  HEALTH_REASON,
  INSTANCE_LABEL,
  NODE_LABEL,
  RESOLUTION_LABEL,
  ROLE_INSTANCE_STATUS_LABEL,
  ROLE_LABEL,
  TEMPLATE_LABEL
} from '../../cli/labels.js';
// D-51: A-11 I1.11 top-level single keys are read by name from the same CLI
// source (no literal is rewritten here); the 12 reuse tables above stay intact.
import * as cliLabels from '../../cli/labels.js';

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
  // A-14 补充（裁决 K / B-16）：组显示名，供 `DESKTOP_GROUP_ROW` 的 `{group}` 取值。
  // 只登记 AC-19 文本已给出的两组 + 未分组兜底；其余组本迭代不下发中文名，
  // 渲染层回退原始 group id（不臆造）。三键均无占位符。
  GROUP_LABEL_CODING: '编码工程',
  GROUP_LABEL_RESEARCH: '研究分析',
  GROUP_LABEL_UNGROUPED: '未分组',
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
  DESKTOP_DEF_UNREADABLE: '流程图定义不可读 · 已按内置模板显示',

  // -----------------------------------------------------------------------
  // I1.10b WP-1（需求附录 A-10 全表，冻结点 ①）：`DRILL_*` 下钻文案键。
  // 逐字基线 = 附录 A-1 ~ A-9 的样例行（措辞一字不改）；占位符只做字面替换。
  // `DRILL_ROLE_STATUS_TOKEN` 为五 token → 中文映射（A-10 逐字：键为图投影的
  // 五种 token，值与 `ROLE_INSTANCE_STATUS_LABEL` 同值），以 JSON 字符串承载
  // （键值表的值必须为字符串，渲染层 JSON.parse 后按键取值、不重算状态）。
  // -----------------------------------------------------------------------

  // 面包屑（A-8）：CRUMB_ROLE 含实例根段；` / ` 连接与 `实例 {id} / 节点 {node}`
  // 等直接进入形态由渲染层按结构拼装（实例根段取自 CRUMB_ROLE 的首段）。
  DRILL_CRUMB_ROLE: '实例 {id} / 角色 {role}',
  DRILL_CRUMB_NODE: '节点 {node}',
  DRILL_CRUMB_SUBFLOW: '子工作流 {title}',
  // 角色状态栏与最近动作（A-1：`{last}` 取 LAST_ACTION 或 LAST_ACTION_MISSING）。
  DRILL_ROLE_BAR:
    '角色栏 {role} · {status} · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts} · 最近 {last}',
  DRILL_ROLE_SERVING_MORE: '{first} 等 {n} 个',
  DRILL_LAST_ACTION: '最近 {node} · 轮次 {round}/{maxRounds} · {state}',
  DRILL_LAST_ACTION_MISSING: '最近 —',
  // 局部 DAG（A-2：节点行三段固定 = 关系 / 类型 / 状态）。
  DRILL_DAG_NODE: '局部节点 {node} · {relation} · {type} · {status}',
  DRILL_DAG_EDGE: '局部连线 {from}→{to} · {direction} · {status}',
  DRILL_DAG_REL_SELF: '本角色',
  DRILL_DAG_REL_UP: '上游',
  DRILL_DAG_REL_DOWN: '下游',
  // 任务卡片（A-3：类型前缀键填入 CARD_TITLE 的 {node} 段；EMPTY 为无会话执行行整行）。
  DRILL_CARD_TITLE: '卡片 {node} · {title} · 轮次 {round}/{maxRounds} · {status}',
  DRILL_CARD_EXEC: '执行 {role} · {session} · 已运行 {elapsed} · 工具 {tool}',
  DRILL_CARD_DEPS: '依赖 {deps} · 产物 {products} · 证据 {evidence}',
  DRILL_CARD_TYPE_HUMAN: '人工节点 {node}',
  DRILL_CARD_TYPE_ESCALATE: '升级节点 {node}',
  DRILL_CARD_TYPE_SUBFLOW: '子工作流：{title} · 角色 {n}',
  DRILL_CARD_EMPTY: '执行 {role} · 无会话 · — · 工具 —',
  // 会话指示器（A-3 指示器表：标签复用 SESSION_LABEL 族；INPUT_DETAIL 为 `：<动作>`）。
  DRILL_INDICATOR: '{label}{detail}',
  DRILL_INDICATOR_INPUT_DETAIL: '：{action}',
  DRILL_INDICATOR_NONE: '无会话',
  // 节点详情（A-4：四段标题内嵌于内容行模板；NONE 为空段 `{section} 无记录`）。
  DRILL_DETAIL_HEAD: '节点 {node} · {title} · {status} · 轮次 {round}/{maxRounds}',
  DRILL_DETAIL_TIMELINE: '时间线 {time} {state}',
  DRILL_DETAIL_SUMMARY: '摘要 命令 {command} · 退出码 {exitCode} · 关键输出 {lines} 行 · 日志 {log}',
  DRILL_DETAIL_EVIDENCE: '证据 {index} · {ref} · {type} · {status}',
  DRILL_DETAIL_HANDOFF: '交接 {id} · {direction} · 第 {round} 轮 · {state} · {time}',
  DRILL_DETAIL_NONE: '{section} 无记录',
  // 连接线面板（A-5：并行后缀 1 时省略；EMPTY 为整段空态，与详情段内 `无记录` 区分）。
  DRILL_CONN_HEAD: '连接 {from}→{to} · {direction} · {status}',
  DRILL_CONN_PARALLEL: ' · {n} 并行交接',
  DRILL_CONN_HANDOFF: '交接 {id} · 第 {round} 轮 · {state} · {time}',
  DRILL_CONN_EMPTY: '交接 无',
  // 升级面板（A-6 + D-3 messageKey 映射：ALREADY / NOT_SUSPENDED / FAILED）。
  DRILL_ESC_TITLE: '升级处理',
  DRILL_ESC_COUNT: '本实例待处理升级 {n} 个',
  DRILL_ESC_ROW: '升级 {id} · {state} · 节点 {node} {role} · 第 {round} 轮',
  DRILL_ESC_REASON: '原因：{reason}',
  DRILL_ESC_DEFECT: '缺陷：{summary}（证据 {evidence}）',
  DRILL_ESC_CONTINUE: '继续',
  DRILL_ESC_CANCEL: '取消',
  DRILL_ESC_DONE: '已继续 · {id}',
  DRILL_ESC_ALREADY: '升级 {id} 已处理 · 状态 {state}',
  DRILL_ESC_NOT_SUSPENDED: '实例 未挂起 · 无法继续',
  DRILL_ESC_FAILED: '继续失败 · {reason}',
  // 打开宿主（A-7：成功两行成对；三种降级各一行）。
  DRILL_HOST_OPEN: '打开宿主会话',
  DRILL_HOST_OPENED: '已打开 DeepSeek Harness · 会话 {id}',
  DRILL_HOST_HINT: '会话标识已复制 · 在 DSH 中按标识定位',
  DRILL_HOST_NONE: '无可跳转会话',
  DRILL_HOST_UNSUPPORTED: '宿主 {host} 不支持跳转',
  DRILL_HOST_MISSING: '未找到 DeepSeek Harness',
  DRILL_HOST_FAILED: '跳转失败 · {reason}',
  // 视图控件（A-8）。
  DRILL_VIEW_BACK_GRAPH: '返回流程图',
  DRILL_VIEW_BACK_DRILL: '返回角色下钻',
  DRILL_VIEW_BACK_LEVEL: '返回上一层',
  DRILL_VIEW_ALL_NODES: '查看全部节点',
  // 降级提示（A-9：`交接 无`（整段空态）与详情段内 `{section} 无记录` 是两处语境）。
  DRILL_EMPTY_TASK: '任务 无',
  DRILL_EMPTY_ROLE: '角色 无',
  DRILL_EMPTY_RECORD: '交接 无',
  DRILL_NO_SESSION: '无会话',
  DRILL_UNKNOWN_STATE: '状态未知',
  DRILL_NODE_MISSING: '节点 {node} · 不存在',
  DRILL_ROLE_UNUSED: '角色 {role} · 本实例未使用',
  DRILL_SUBFLOW_CYCLE: '子工作流定义存在循环 · 已停止下钻',
  // 角色状态 token → 中文（A-10 逐字五 token 映射，与 ROLE_INSTANCE_STATUS_LABEL 同值）。
  DRILL_ROLE_STATUS_TOKEN:
    '{"available":"可用","serving":"服务中","cooldown":"冷却中","unavailable":"不可用","inactive":"未参与"}'
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

/**
 * D-51 / A-11 v9: I1.11 top-level `DESKTOP_*` single keys plus the five view
 * navigation keys, listed explicitly. Values are read from `cliLabels` by name
 * so the Chinese wording keeps a single source; the object table
 * `DESKTOP_QUEUE_CONCLUSIONS` is deliberately excluded (not a string label).
 */
export const I11_DESKTOP_KEYS = Object.freeze([
  // A-1/A-2 notify
  'DESKTOP_NOTIFY_CATEGORY_ANOMALY',
  'DESKTOP_NOTIFY_CATEGORY_COMPLETED',
  'DESKTOP_NOTIFY_CATEGORY_ESCALATION',
  'DESKTOP_NOTIFY_MERGE_COUNT_PREFIX',
  'DESKTOP_NOTIFY_MERGE_COUNT_SUFFIX',
  'DESKTOP_NOTIFY_MERGE_LATEST_PREFIX',
  'DESKTOP_NOTIFY_SEG_ESCALATION',
  'DESKTOP_NOTIFY_SEG_INSTANCE',
  'DESKTOP_NOTIFY_SEG_MISSING',
  'DESKTOP_NOTIFY_SEG_NODE',
  'DESKTOP_NOTIFY_SEG_ROUND_PREFIX',
  'DESKTOP_NOTIFY_SEG_ROUND_SUFFIX',
  'DESKTOP_NOTIFY_SEG_SEPARATOR',
  'DESKTOP_NOTIFY_TITLE_PREFIX',
  'DESKTOP_NOTIFY_TOGGLE',
  'DESKTOP_NOTIFY_TOGGLE_ANOMALY',
  'DESKTOP_NOTIFY_TOGGLE_COMPLETED',
  'DESKTOP_NOTIFY_TOGGLE_ESCALATION',
  'DESKTOP_NOTIFY_UNAVAILABLE',
  // A-3/A-4 queue
  'DESKTOP_QUEUE_ACTION_ALLOW',
  'DESKTOP_QUEUE_ACTION_CANCEL',
  'DESKTOP_QUEUE_ACTION_DENY',
  'DESKTOP_QUEUE_ACTION_PASS',
  'DESKTOP_QUEUE_ACTION_PREFIX',
  'DESKTOP_QUEUE_ACTION_RETRY',
  'DESKTOP_QUEUE_ACTION_UNSUPPORTED',
  'DESKTOP_QUEUE_ALREADY_RESOLVED',
  'DESKTOP_QUEUE_CONFIRM_CANCEL',
  'DESKTOP_QUEUE_CONFIRM_DISMISS',
  'DESKTOP_QUEUE_CONFIRM_OK',
  'DESKTOP_QUEUE_DISABLED_HINT',
  'DESKTOP_QUEUE_DISCONNECTED',
  'DESKTOP_QUEUE_EMPTY',
  'DESKTOP_QUEUE_RESULT_APPROVAL',
  'DESKTOP_QUEUE_RESULT_CANCELLED',
  'DESKTOP_QUEUE_RESULT_ESCALATION',
  'DESKTOP_QUEUE_ROW_APR',
  'DESKTOP_QUEUE_ROW_ESC',
  'DESKTOP_QUEUE_ROW_STATE_UNREADABLE',
  'DESKTOP_QUEUE_STATE_UNREADABLE',
  // A-5 asset
  'DESKTOP_ASSET_BUILTIN_FILE_PREFIX',
  'DESKTOP_ASSET_COUNT',
  'DESKTOP_ASSET_DETAIL_BACKFLOW',
  'DESKTOP_ASSET_DETAIL_BODY',
  'DESKTOP_ASSET_DETAIL_ROLE_HEADER',
  'DESKTOP_ASSET_DETAIL_ROLE_SKILLS',
  'DESKTOP_ASSET_DETAIL_SKILL_HEADER',
  'DESKTOP_ASSET_DETAIL_SUMMARY',
  'DESKTOP_ASSET_DETAIL_TOOLS',
  'DESKTOP_ASSET_DETAIL_VALIDATION',
  'DESKTOP_ASSET_DETAIL_WAKE',
  'DESKTOP_ASSET_DETAIL_WORKFLOW_HEADER',
  'DESKTOP_ASSET_GROUP_PLACEHOLDER',
  'DESKTOP_ASSET_ITEM_UNREADABLE',
  'DESKTOP_ASSET_KIND_ROLES',
  'DESKTOP_ASSET_KIND_SKILLS',
  'DESKTOP_ASSET_KIND_WORKFLOWS',
  'DESKTOP_ASSET_MISSING',
  'DESKTOP_ASSET_ROW_ROLE',
  'DESKTOP_ASSET_ROW_SKILL',
  'DESKTOP_ASSET_ROW_WORKFLOW',
  'DESKTOP_ASSET_SOURCE_BUILTIN',
  'DESKTOP_ASSET_SOURCE_PROJECT',
  'DESKTOP_ASSET_UNREADABLE',
  'DESKTOP_ASSET_VALIDATION_FAIL',
  'DESKTOP_ASSET_VALIDATION_PASS',
  'DESKTOP_ASSET_VALIDATION_UNKNOWN',
  'DESKTOP_ASSET_VALIDATION_UNREADABLE',
  // A-6 occupancy
  'DESKTOP_OCCUPANCY_EMPTY',
  'DESKTOP_OCCUPANCY_ROW',
  'DESKTOP_OCCUPANCY_SKIPPED',
  // A-7 canvas
  'DESKTOP_CANVAS_EMPTY',
  'DESKTOP_CANVAS_INVALID',
  'DESKTOP_CANVAS_SUBFLOW_ROW',
  'DESKTOP_CANVAS_SUBFLOW_UNKNOWN',
  'DESKTOP_CANVAS_TITLE',
  'DESKTOP_CANVAS_UNREADABLE',
  // A-8 evidence
  'DESKTOP_EVIDENCE_ARTIFACT',
  'DESKTOP_EVIDENCE_LOG_ON_HOST',
  'DESKTOP_EVIDENCE_NODE_ROW',
  'DESKTOP_EVIDENCE_TRUNCATED',
  'DESKTOP_EVIDENCE_UNPROVIDED',
  'DESKTOP_EVIDENCE_UNREADABLE',
  'DESKTOP_EVIDENCE_VERIFIED_AT',
  // A-9 tray
  'DESKTOP_TRAY_PAUSE',
  'DESKTOP_TRAY_PAUSE_NONE',
  'DESKTOP_TRAY_PAUSE_SUMMARY',
  'DESKTOP_TRAY_RESUME',
  'DESKTOP_TRAY_STATUS',
  'DESKTOP_TRAY_STATUS_DISCONNECTED',
  // A-11 v9 five navigation keys (D-51)
  'DESKTOP_VIEW_QUEUE',
  'DESKTOP_VIEW_ASSETS',
  'DESKTOP_VIEW_OCCUPANCY',
  'DESKTOP_VIEW_CANVAS',
  'DESKTOP_VIEW_EVIDENCE'
]);

/** D-51: read the whitelist values from the CLI source, keyed by their own names. */
const I11_LABEL_TABLE = Object.freeze(
  Object.fromEntries(I11_DESKTOP_KEYS.map((key) => [key, cliLabels[key]]))
);

/**
 * 下发全集：桌面新增键 + 复用键 + I1.11 顶层键 + beta.2 外壳增量键，
 * 扁平 `KEY -> 文案模板`（值与 `src/cli/labels.js` 同一引用）。 */
export const UI_LABEL_KEYS = Object.freeze({
  ...DESKTOP_LABEL_KEYS,
  ...I11_LABEL_TABLE,
  ...cliLabels.DESKTOP_V2_LABEL,
  ...flattenTable('INSTANCE_LABEL', INSTANCE_LABEL),
  ...flattenTable('NODE_LABEL', NODE_LABEL),
  ...flattenTable('ROLE_LABEL', ROLE_LABEL),
  ...flattenTable('APPROVAL_LABEL', APPROVAL_LABEL),
  ...flattenTable('RESOLUTION_LABEL', RESOLUTION_LABEL),
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
