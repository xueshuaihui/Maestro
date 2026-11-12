/**
 * I1.10a WP-7：桌面文案键全集冻结测试（`test/wp13/labels-desktop.test.js`）。
 *
 * 承担（拆分文档 §4 WP-7 + 需求 AC-28 文案面）：
 * ① 键全集 = 期望键名清单（精确集合相等，多键/少键都 fail）——A-14 全表；
 * ② 每个新键的占位符集合与期望一致（占位符只做字面替换）；
 * ③ 附录 A-1 ~ A-13 全部样例行逐字断言（中文标点 / 全角冒号 / 分隔符逐字）；
 * ④ `GET /ui/labels` 响应体形状（D-2：`{ keys: { "<KEY>": "<文案模板>" } }`）；
 * ⑤ AC-28 机检锚点：desktop/ui 与 desktop/harness 的 CJK 命中数为 0、
 *    下发键覆盖 A-14 契约键集合、新增键存在且非空、既有键内容逐字不变、
 *    `USAGE_LINES` 仍 25 行、`dependencies` / `devDependencies` 为空。
 *
 * 运行：`test -f test/wp13/labels-desktop.test.js && NODE_ENV=test node --test test/wp13/labels-desktop.test.js`
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  TEMPLATE_LABEL,
  USAGE_LINES
} from '../../src/cli/labels.js';
import {
  DESKTOP_LABEL_KEYS,
  UI_LABEL_KEYS,
  labelKeysPayload
} from '../../src/daemon/http/labels.js';
import {
  UI_LABELS_PATH,
  createLabelsRoute,
  labelsResponseBody,
  respondUiLabels
} from '../../src/daemon/http/labels-route.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 占位符字面替换（与桌面侧 `resolveLabels` 的既有纪律一致：只替换、不转义、不加工）。 */
function fill(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (raw, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : raw
  );
}

/** 提取模板占位符名集合（排序后比较）。 */
function placeholders(template) {
  return [...String(template).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

// ---------------------------------------------------------------------------
// 期望清单（冻结契约本体）：新增键 61 + 复用键 83 = 144。
// ---------------------------------------------------------------------------

/** 桌面新增键（键名即契约；值逐字断言见 EXPECTED_DESKTOP_VALUES）。 */
const EXPECTED_DESKTOP_KEYS = Object.freeze([
  'DESKTOP_LIST_ROW',
  'DESKTOP_LIST_FIELD_PROGRESS',
  'DESKTOP_LIST_FIELD_PENDING',
  'DESKTOP_LIST_EMPTY',
  'DESKTOP_LIST_UNREADABLE',
  'DESKTOP_PROJECT_MISSING',
  'DESKTOP_PROJECT_INVALID',
  'DESKTOP_CONN_CONNECTING',
  'DESKTOP_CONN_RECONNECTING',
  'DESKTOP_CONN_FAILED',
  'DESKTOP_NEW_TITLE',
  'DESKTOP_NEW_FIELD_WORKFLOW',
  'DESKTOP_NEW_FIELD_TASK',
  'DESKTOP_NEW_ACTION_START',
  'DESKTOP_NEW_ACTION_CANCEL',
  'DESKTOP_NEW_VALIDATE_WORKFLOW',
  'DESKTOP_NEW_VALIDATE_TASK',
  'DESKTOP_NEW_STARTED',
  'DESKTOP_NEW_START_FAILED',
  'DESKTOP_TRAY_OPEN',
  'DESKTOP_TRAY_QUIT',
  'DESKTOP_QUIT_CONFIRM',
  'DESKTOP_QUIT_CONFIRM_QUIT',
  'DESKTOP_QUIT_CONFIRM_CANCEL',
  'DESKTOP_LEGEND_ROLE',
  'DESKTOP_LEGEND_SPECIAL',
  'DESKTOP_ROLE_ROW',
  'DESKTOP_ROLE_ROW_SERVING_MORE',
  'DESKTOP_ROLE_ROW_SESSION_STACK',
  'DESKTOP_PLACEHOLDER',
  'DESKTOP_HUMAN_ROW',
  'DESKTOP_ESCALATE_ROW',
  'DESKTOP_SUBFLOW_ROW',
  'DESKTOP_GROUP_ROW',
  'DESKTOP_SUBFLOW_UNKNOWN',
  'DESKTOP_EDGE_ROW',
  'DESKTOP_EDGE_ROW_PARALLEL',
  'DESKTOP_EDGE_ROW_ACCEPTED_HOVER',
  'DESKTOP_EDGE_NOT_STARTED',
  'DESKTOP_EDGE_DIRECTION_FORWARD',
  'DESKTOP_EDGE_DIRECTION_BACKFLOW',
  'DESKTOP_VIEW_GRAPH',
  'DESKTOP_VIEW_BOARD',
  'DESKTOP_VIEW_RESET',
  'DESKTOP_VIEW_SHOW_NOT_STARTED',
  'DESKTOP_VIEW_HIDE_NOT_STARTED',
  'DESKTOP_VIEW_EXPAND_GROUPS',
  'DESKTOP_VIEW_COLLAPSE_GROUPS',
  'DESKTOP_VIEW_FOCUS',
  'DESKTOP_VIEW_FOCUS_EXIT',
  'DESKTOP_BOARD_COLUMN_BLOCKED',
  'DESKTOP_BOARD_COLUMN_READY',
  'DESKTOP_BOARD_COLUMN_RUNNING',
  'DESKTOP_BOARD_COLUMN_REVIEW',
  'DESKTOP_BOARD_COLUMN_DONE',
  'DESKTOP_BOARD_COLUMN_FAILED',
  'DESKTOP_BOARD_COLUMN_ESCALATED',
  'DESKTOP_BOARD_CANCELLED_FOLD',
  'DESKTOP_BOARD_UNKNOWN_STATE',
  'DESKTOP_GRAPH_MISSING',
  'DESKTOP_DEF_UNREADABLE'
]);

/** 新增键逐字值（= 需求附录 A 逐字基线；占位符名 = 大括号变量，一一对应）。 */
const EXPECTED_DESKTOP_VALUES = Object.freeze({
  DESKTOP_LIST_ROW:
    '实例 {id} · {template} · {state} · 进度 {done}/{total} · 待处理 {pending} · {health}',
  DESKTOP_LIST_FIELD_PROGRESS: '进度 {done}/{total}',
  DESKTOP_LIST_FIELD_PENDING: '待处理 {n}',
  DESKTOP_LIST_EMPTY: '实例 无',
  DESKTOP_LIST_UNREADABLE: '实例 {id} · 状态不可读',
  DESKTOP_PROJECT_MISSING: '项目 未指定 · 请填写项目目录',
  DESKTOP_PROJECT_INVALID: '项目 不可用 · {path}',
  DESKTOP_CONN_CONNECTING: '正在连接守护进程…',
  DESKTOP_CONN_RECONNECTING: '已断开 · 正在重连…',
  DESKTOP_CONN_FAILED: '连接守护进程失败 · 请确认项目目录后重试',
  DESKTOP_NEW_TITLE: '新建实例',
  DESKTOP_NEW_FIELD_WORKFLOW: '工作流',
  DESKTOP_NEW_FIELD_TASK: '任务说明',
  DESKTOP_NEW_ACTION_START: '启动',
  DESKTOP_NEW_ACTION_CANCEL: '取消',
  DESKTOP_NEW_VALIDATE_WORKFLOW: '请选择工作流',
  DESKTOP_NEW_VALIDATE_TASK: '请填写任务说明',
  DESKTOP_NEW_STARTED: '已启动 {id}',
  DESKTOP_NEW_START_FAILED: '启动失败 · {reason}',
  DESKTOP_TRAY_OPEN: '打开主窗口',
  DESKTOP_TRAY_QUIT: '退出',
  DESKTOP_QUIT_CONFIRM: '有 {n} 个实例正在运行，退出将停止守护进程',
  DESKTOP_QUIT_CONFIRM_QUIT: '退出',
  DESKTOP_QUIT_CONFIRM_CANCEL: '取消',
  DESKTOP_LEGEND_ROLE: '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与',
  DESKTOP_LEGEND_SPECIAL: '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流',
  DESKTOP_ROLE_ROW:
    '角色 {role} · {status} · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts} · 异常 {abnormal}',
  DESKTOP_ROLE_ROW_SERVING_MORE: '{first} 等 {n} 个',
  DESKTOP_ROLE_ROW_SESSION_STACK: '×{n}',
  DESKTOP_PLACEHOLDER: '—',
  DESKTOP_HUMAN_ROW: '人工节点 {title} · {status}',
  DESKTOP_ESCALATE_ROW: '升级节点 {title} · {status}',
  DESKTOP_SUBFLOW_ROW: '子工作流：{title} · {n} 角色',
  DESKTOP_GROUP_ROW: '分组 {group} · {n} 角色',
  DESKTOP_SUBFLOW_UNKNOWN: '子工作流 {id} · 角色数未知',
  DESKTOP_EDGE_ROW: '连接线 {from}→{to} · {direction} · {status}',
  DESKTOP_EDGE_ROW_PARALLEL: ' · {n} 并行交接',
  DESKTOP_EDGE_ROW_ACCEPTED_HOVER: '已接受 · 处理中',
  DESKTOP_EDGE_NOT_STARTED: '未开始',
  DESKTOP_EDGE_DIRECTION_FORWARD: '正向',
  DESKTOP_EDGE_DIRECTION_BACKFLOW: '回流',
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
  DESKTOP_GRAPH_MISSING: '实例 {id} · 不存在',
  DESKTOP_DEF_UNREADABLE: '流程图定义不可读 · 已按内置模板显示'
});

/** 新增键的期望占位符集合（与附录 A 大括号变量一一对应）。 */
const EXPECTED_DESKTOP_PLACEHOLDERS = Object.freeze({
  DESKTOP_LIST_ROW: ['done', 'health', 'id', 'pending', 'state', 'template', 'total'],
  DESKTOP_LIST_FIELD_PROGRESS: ['done', 'total'],
  DESKTOP_LIST_FIELD_PENDING: ['n'],
  DESKTOP_LIST_EMPTY: [],
  DESKTOP_LIST_UNREADABLE: ['id'],
  DESKTOP_PROJECT_MISSING: [],
  DESKTOP_PROJECT_INVALID: ['path'],
  DESKTOP_CONN_CONNECTING: [],
  DESKTOP_CONN_RECONNECTING: [],
  DESKTOP_CONN_FAILED: [],
  DESKTOP_NEW_TITLE: [],
  DESKTOP_NEW_FIELD_WORKFLOW: [],
  DESKTOP_NEW_FIELD_TASK: [],
  DESKTOP_NEW_ACTION_START: [],
  DESKTOP_NEW_ACTION_CANCEL: [],
  DESKTOP_NEW_VALIDATE_WORKFLOW: [],
  DESKTOP_NEW_VALIDATE_TASK: [],
  DESKTOP_NEW_STARTED: ['id'],
  DESKTOP_NEW_START_FAILED: ['reason'],
  DESKTOP_TRAY_OPEN: [],
  DESKTOP_TRAY_QUIT: [],
  DESKTOP_QUIT_CONFIRM: ['n'],
  DESKTOP_QUIT_CONFIRM_QUIT: [],
  DESKTOP_QUIT_CONFIRM_CANCEL: [],
  DESKTOP_LEGEND_ROLE: [],
  DESKTOP_LEGEND_SPECIAL: [],
  DESKTOP_ROLE_ROW: ['abnormal', 'hosts', 'role', 'serving', 'sessions', 'status'],
  DESKTOP_ROLE_ROW_SERVING_MORE: ['first', 'n'],
  DESKTOP_ROLE_ROW_SESSION_STACK: ['n'],
  DESKTOP_PLACEHOLDER: [],
  DESKTOP_HUMAN_ROW: ['status', 'title'],
  DESKTOP_ESCALATE_ROW: ['status', 'title'],
  DESKTOP_SUBFLOW_ROW: ['n', 'title'],
  DESKTOP_GROUP_ROW: ['group', 'n'],
  DESKTOP_SUBFLOW_UNKNOWN: ['id'],
  DESKTOP_EDGE_ROW: ['direction', 'from', 'status', 'to'],
  DESKTOP_EDGE_ROW_PARALLEL: ['n'],
  DESKTOP_EDGE_ROW_ACCEPTED_HOVER: [],
  DESKTOP_EDGE_NOT_STARTED: [],
  DESKTOP_EDGE_DIRECTION_FORWARD: [],
  DESKTOP_EDGE_DIRECTION_BACKFLOW: [],
  DESKTOP_VIEW_GRAPH: [],
  DESKTOP_VIEW_BOARD: [],
  DESKTOP_VIEW_RESET: [],
  DESKTOP_VIEW_SHOW_NOT_STARTED: [],
  DESKTOP_VIEW_HIDE_NOT_STARTED: [],
  DESKTOP_VIEW_EXPAND_GROUPS: [],
  DESKTOP_VIEW_COLLAPSE_GROUPS: [],
  DESKTOP_VIEW_FOCUS: ['hops', 'node'],
  DESKTOP_VIEW_FOCUS_EXIT: [],
  DESKTOP_BOARD_COLUMN_BLOCKED: [],
  DESKTOP_BOARD_COLUMN_READY: [],
  DESKTOP_BOARD_COLUMN_RUNNING: [],
  DESKTOP_BOARD_COLUMN_REVIEW: [],
  DESKTOP_BOARD_COLUMN_DONE: [],
  DESKTOP_BOARD_COLUMN_FAILED: [],
  DESKTOP_BOARD_COLUMN_ESCALATED: [],
  DESKTOP_BOARD_CANCELLED_FOLD: ['n'],
  DESKTOP_BOARD_UNKNOWN_STATE: [],
  DESKTOP_GRAPH_MISSING: ['id'],
  DESKTOP_DEF_UNREADABLE: []
});

/**
 * 复用键：`[平铺前缀, cli 导出表, 期望成员名（源键，冻结锚点）]`。
 * 成员名清单是"既有键计数与内容逐字不变"的独立锚点（不来自实现）。
 */
const REUSED_TABLES = Object.freeze([
  ['INSTANCE_LABEL', INSTANCE_LABEL, ['created', 'running', 'completed', 'failed', 'cancelled', 'interrupted', 'suspended']],
  ['NODE_LABEL', NODE_LABEL, ['pending', 'running', 'review', 'done', 'failed', 'cancelled', 'escalated']],
  ['HANDOFF_LABEL', HANDOFF_LABEL, ['created', 'delivered', 'pending', 'accepted', 'consumed', 'rejected', 'expired']],
  ['ROLE_INSTANCE_STATUS_LABEL', ROLE_INSTANCE_STATUS_LABEL, ['inactive', 'available', 'busy', 'cooldown', 'unavailable', 'retired']],
  ['HEALTH_LABEL', HEALTH_LABEL, ['normal', 'slow', 'attention', 'ended']],
  ['HEALTH_LINE', HEALTH_LINE, ['base', 'withReasons', 'sep']],
  ['HEALTH_REASON', HEALTH_REASON, ['pending_escalation', 'node_timeout', 'session_crash', 'role_unavailable', 'connection_rejected', 'connection_expired', 'p90_exceeded', 'handoff_ttl_half']],
  ['TEMPLATE_LABEL', TEMPLATE_LABEL, ['single', 'code-loop', 'task-loop']],
  ['ERROR_TEMPLATE', ERROR_TEMPLATE, ['DSH_SPAWN_FAILED', 'CWD_NOT_WRITABLE', 'CORE_START_FAILED', 'NODE_BUSY', 'SESSION_INVALID', 'PERMISSION_DENIED', 'HOST_ERROR', 'VERIFY_FAILED', 'UNKNOWN_ERROR', 'STATE_CORRUPT', 'INSTANCE_TERMINAL', 'TASK_EMPTY', 'TEMPLATE_UNKNOWN', 'PRODUCT_LINE_MISSING', 'DIR_BUSY', 'INSTANCE_RUNNING', 'INSTANCE_SUSPENDED', 'LEGACY_READ_ONLY', 'ESCALATION_WRITE_FAILED', 'CANCEL_NOT_NEEDED', 'PRODUCT_LINE_MISSING_TASK_LOOP', 'PRODUCT_INVALID_TASK_LOOP', 'WORKSPACE_INIT_FAILED', 'STORE_CONFLICT']],
  ['COMMAND_ERROR', COMMAND_ERROR, ['SESSION_NOT_FOUND', 'ESCALATION_NOT_FOUND', 'ESCALATION_NOT_PENDING', 'ESCALATION_DECISION_INVALID', 'ESCALATION_AMBIGUOUS', 'INSTANCE_NOT_SUSPENDED', 'APPROVAL_NOT_FOUND', 'APPROVAL_NOT_PENDING', 'APPROVAL_AMBIGUOUS', 'APPROVAL_SESSION_GONE', 'HANDOFF_NOT_FOUND', 'HANDOFF_AMBIGUOUS', 'INSTANCE_NOT_PAUSABLE', 'INSTANCE_NOT_RESUMABLE']]
]);

/** 平铺命名：`表名_成员名`（成员名大写、`-` 归一 `_`、驼峰拆分）。 */
function flatName(prefix, member) {
  const snake = String(member)
    .replaceAll('-', '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
  return `${prefix}_${snake}`;
}

/** 期望全集 = 新增键 + 复用键平铺（均来自上方显式清单，与实现无关）。 */
const EXPECTED_ALL_KEYS = (() => {
  const names = [...EXPECTED_DESKTOP_KEYS];
  for (const [prefix, , members] of REUSED_TABLES) {
    for (const member of members) names.push(flatName(prefix, member));
  }
  return Object.freeze(names.sort());
})();

// ---------------------------------------------------------------------------
// ① 键全集冻结
// ---------------------------------------------------------------------------

test('键全集冻结：下发键集合与期望清单精确相等（多键/少键都 fail）', () => {
  assert.deepEqual(Object.keys(UI_LABEL_KEYS).sort(), EXPECTED_ALL_KEYS);
  assert.equal(Object.keys(UI_LABEL_KEYS).length, EXPECTED_ALL_KEYS.length);
  assert.equal(Object.keys(UI_LABEL_KEYS).length, 144, '新增 61 + 复用 83');
});

test('桌面新增键：DESKTOP_LABEL_KEYS 与期望值表逐字相等（A-14 新增段冻结）', () => {
  assert.deepEqual(Object.keys(DESKTOP_LABEL_KEYS).sort(), [...EXPECTED_DESKTOP_KEYS].sort());
  for (const key of EXPECTED_DESKTOP_KEYS) {
    assert.equal(DESKTOP_LABEL_KEYS[key], EXPECTED_DESKTOP_VALUES[key], `${key} 文案漂移`);
  }
  assert.deepEqual({ ...DESKTOP_LABEL_KEYS }, EXPECTED_DESKTOP_VALUES);
});

test('键名纪律：全部 UPPER_SNAKE、值为非空字符串、两张表均冻结', () => {
  for (const [key, value] of Object.entries(UI_LABEL_KEYS)) {
    assert.match(key, /^[A-Z][A-Z0-9_]*$/, `键名不是 UPPER_SNAKE：${key}`);
    assert.equal(typeof value, 'string', `${key} 不是字符串`);
    assert.ok(value.length > 0, `${key} 为空`);
  }
  assert.ok(Object.isFrozen(DESKTOP_LABEL_KEYS));
  assert.ok(Object.isFrozen(UI_LABEL_KEYS));
});

// ---------------------------------------------------------------------------
// ② 占位符纪律
// ---------------------------------------------------------------------------

test('占位符集合：每个新增键的占位符与期望一一对应', () => {
  for (const [key, expected] of Object.entries(EXPECTED_DESKTOP_PLACEHOLDERS)) {
    assert.deepEqual(
      placeholders(UI_LABEL_KEYS[key]),
      [...expected].sort(),
      `${key} 占位符集合与期望不一致`
    );
  }
  assert.equal(
    Object.keys(EXPECTED_DESKTOP_PLACEHOLDERS).length,
    EXPECTED_DESKTOP_KEYS.length,
    '占位符期望表必须覆盖全部新增键'
  );
});

test('占位符字面替换：fill 只替换大括号变量、不加工分隔符', () => {
  assert.equal(fill('进度 {done}/{total}', { done: 1, total: 2 }), '进度 1/2');
  assert.equal(fill('待处理 {n}', { n: 0 }), '待处理 0');
  assert.equal(fill('已取消 {n}', { n: 2 }), '已取消 2');
  assert.equal(fill('×{n}', { n: 3 }), '×3');
  assert.equal(fill('宿主 {hosts}', {}), '宿主 {hosts}', '缺参保留占位符原样');
});

// ---------------------------------------------------------------------------
// ③ 复用键同源与既有键零改动锚点（AC-28 文案面）
// ---------------------------------------------------------------------------

test('复用键同源：平铺键值与 src/cli/labels.js 对应成员逐字相同', () => {
  for (const [prefix, table, members] of REUSED_TABLES) {
    if (!table) continue; // 无独立 import 的表经其它锚点断言
    for (const member of members) {
      const name = flatName(prefix, member);
      assert.ok(name in UI_LABEL_KEYS, `下发键缺少 ${name}`);
      assert.equal(UI_LABEL_KEYS[name], table[member], `${name} 与 cli 表成员值不同源`);
    }
  }
});

test('既有键计数锚点：复用表成员名清单与期望一致（既有表零改动）', () => {
  for (const [prefix, table, members] of REUSED_TABLES) {
    if (!table) continue;
    assert.deepEqual(
      Object.keys(table).sort(),
      [...members].sort(),
      `${prefix} 成员集合漂移（既有键计数变化）`
    );
  }
  assert.equal(USAGE_LINES.length, 25, 'USAGE_LINES 必须仍是 25 行');
  assert.equal(HEALTH_REASON['node_timeout'], '节点 {nodeId} 执行超时');
  assert.equal(
    ERROR_TEMPLATE.PRODUCT_LINE_MISSING,
    '编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）'
  );
  assert.equal(ERROR_TEMPLATE.DIR_BUSY, '该目录已有未结束的实例 {instanceId}，本次未发起');
});

// ---------------------------------------------------------------------------
// ④ 附录 A 全节样例逐字断言
// ---------------------------------------------------------------------------

const L = UI_LABEL_KEYS;

test('A-1 列表行：四行样例逐字（六项固定顺序，待处理 0 也显示）', () => {
  const row = (p) => fill(L.DESKTOP_LIST_ROW, p);
  assert.equal(
    row({ id: 'INST-001', template: L.TEMPLATE_LABEL_CODE_LOOP, state: L.INSTANCE_LABEL_RUNNING, done: 1, total: 2, pending: 1, health: L.HEALTH_LABEL_ATTENTION }),
    '实例 INST-001 · 编码闭环 · 运行中 · 进度 1/2 · 待处理 1 · 需关注'
  );
  assert.equal(
    row({ id: 'INST-003', template: L.TEMPLATE_LABEL_TASK_LOOP, state: L.INSTANCE_LABEL_SUSPENDED, done: 2, total: 3, pending: 2, health: L.HEALTH_LABEL_SLOW }),
    '实例 INST-003 · 通用任务闭环 · 已挂起 · 进度 2/3 · 待处理 2 · 慢'
  );
  assert.equal(
    row({ id: 'INST-004', template: L.TEMPLATE_LABEL_CODE_LOOP, state: L.INSTANCE_LABEL_RUNNING, done: 0, total: 2, pending: 0, health: L.HEALTH_LABEL_NORMAL }),
    '实例 INST-004 · 编码闭环 · 运行中 · 进度 0/2 · 待处理 0 · 正常'
  );
  assert.equal(
    row({ id: 'INST-002', template: L.TEMPLATE_LABEL_SINGLE, state: L.INSTANCE_LABEL_COMPLETED, done: 1, total: 1, pending: 0, health: L.HEALTH_LABEL_ENDED }),
    '实例 INST-002 · 单节点 · 已完成 · 进度 1/1 · 待处理 0 · 已结束'
  );
  assert.equal(fill(L.DESKTOP_LIST_FIELD_PROGRESS, { done: 1, total: 2 }), '进度 1/2');
  assert.equal(fill(L.DESKTOP_LIST_FIELD_PENDING, { n: 0 }), '待处理 0');
});

test('A-2 空态与不可读 + A-3 项目提示逐字', () => {
  assert.equal(L.DESKTOP_LIST_EMPTY, '实例 无');
  assert.equal(fill(L.DESKTOP_LIST_UNREADABLE, { id: 'INST-003' }), '实例 INST-003 · 状态不可读');
  assert.equal(L.DESKTOP_PROJECT_MISSING, '项目 未指定 · 请填写项目目录');
  assert.equal(fill(L.DESKTOP_PROJECT_INVALID, { path: '/tmp/nope' }), '项目 不可用 · /tmp/nope');
});

test('A-4 连接三态逐字', () => {
  assert.equal(L.DESKTOP_CONN_CONNECTING, '正在连接守护进程…');
  assert.equal(L.DESKTOP_CONN_RECONNECTING, '已断开 · 正在重连…');
  assert.equal(L.DESKTOP_CONN_FAILED, '连接守护进程失败 · 请确认项目目录后重试');
});

test('A-5 新建面板：标题/字段/按钮/三选项/校验/成功/失败（错误原文透传）逐字', () => {
  assert.equal(L.DESKTOP_NEW_TITLE, '新建实例');
  assert.equal(L.DESKTOP_NEW_FIELD_WORKFLOW, '工作流');
  assert.equal(L.DESKTOP_NEW_FIELD_TASK, '任务说明');
  assert.equal(L.DESKTOP_NEW_ACTION_START, '启动');
  assert.equal(L.DESKTOP_NEW_ACTION_CANCEL, '取消');
  assert.equal(L.TEMPLATE_LABEL_SINGLE, '单节点');
  assert.equal(L.TEMPLATE_LABEL_CODE_LOOP, '编码闭环');
  assert.equal(L.TEMPLATE_LABEL_TASK_LOOP, '通用任务闭环');
  assert.equal(L.DESKTOP_NEW_VALIDATE_WORKFLOW, '请选择工作流');
  assert.equal(L.DESKTOP_NEW_VALIDATE_TASK, '请填写任务说明');
  assert.equal(fill(L.DESKTOP_NEW_STARTED, { id: 'INST-004' }), '已启动 INST-004');
  assert.equal(
    fill(L.DESKTOP_NEW_START_FAILED, { reason: L.ERROR_TEMPLATE_PRODUCT_LINE_MISSING }),
    '启动失败 · 编码闭环需要在任务里写「产物：<路径>」一行（全角冒号，例如 产物：calc.js）'
  );
  assert.equal(
    fill(L.DESKTOP_NEW_START_FAILED, { reason: fill(L.ERROR_TEMPLATE_DIR_BUSY, { instanceId: 'INST-001' }) }),
    '启动失败 · 该目录已有未结束的实例 INST-001，本次未发起'
  );
});

test('A-6 托盘菜单与退出确认逐字', () => {
  assert.equal(L.DESKTOP_TRAY_OPEN, '打开主窗口');
  assert.equal(L.DESKTOP_TRAY_QUIT, '退出');
  assert.equal(fill(L.DESKTOP_QUIT_CONFIRM, { n: 1 }), '有 1 个实例正在运行，退出将停止守护进程');
  assert.equal(L.DESKTOP_QUIT_CONFIRM_QUIT, '退出');
  assert.equal(L.DESKTOP_QUIT_CONFIRM_CANCEL, '取消');
});

test('A-7 健康度悬停：八类原因句 + 无原因行逐字（经 HEALTH_LINE / HEALTH_REASON 模板渲染）', () => {
  const hover = (level, reason) => fill(L.HEALTH_LINE_WITH_REASONS, { level, reasons: reason });
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, L.HEALTH_REASON_PENDING_ESCALATION), '健康度 需关注 · 有待处理升级');
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, fill(L.HEALTH_REASON_NODE_TIMEOUT, { nodeId: 'T-001' })), '健康度 需关注 · 节点 T-001 执行超时');
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, fill(L.HEALTH_REASON_SESSION_CRASH, { sessionId: 'mock-sess-12345-1' })), '健康度 需关注 · 会话 mock-sess-12345-1 崩溃');
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, fill(L.HEALTH_REASON_ROLE_UNAVAILABLE, { role: '开发' })), '健康度 需关注 · 角色 开发 不可用');
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, fill(L.HEALTH_REASON_CONNECTION_REJECTED, { connection: '测试→开发' })), '健康度 需关注 · 连接线 测试→开发 已拒绝');
  assert.equal(hover(L.HEALTH_LABEL_ATTENTION, fill(L.HEALTH_REASON_CONNECTION_EXPIRED, { connection: '测试→开发' })), '健康度 需关注 · 连接线 测试→开发 已过期');
  assert.equal(hover(L.HEALTH_LABEL_SLOW, fill(L.HEALTH_REASON_P90_EXCEEDED, { nodeId: 'T-006' })), '健康度 慢 · 节点 T-006 执行超过本实例 P90');
  assert.equal(hover(L.HEALTH_LABEL_SLOW, fill(L.HEALTH_REASON_HANDOFF_TTL_HALF, { handoffId: 'HO-006' })), '健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半');
  assert.equal(fill(L.HEALTH_LINE_BASE, { level: L.HEALTH_LABEL_NORMAL }), '健康度 正常');
});

test('A-8 图例两行逐字', () => {
  assert.equal(L.DESKTOP_LEGEND_ROLE, '图例 ● 可用 · ● 服务中 · ● 冷却中 · ● 不可用 · ● 未参与');
  assert.equal(L.DESKTOP_LEGEND_SPECIAL, '图例 ▲ 人工节点 · ! 升级节点 · ▤ 子工作流 · ─ 正向 · ⤴ 回流');
});

test('A-9 角色节点行：五例 + 折叠形态 + 堆叠角标逐字', () => {
  const row = (p) => fill(L.DESKTOP_ROLE_ROW, p);
  assert.equal(row({ role: '开发', status: L.ROLE_INSTANCE_STATUS_LABEL_BUSY, sessions: 2, serving: 'T-001, T-002', hosts: 'dsh cursor', abnormal: 1 }), '角色 开发 · 服务中 · 2 个活跃会话 · 服务 T-001, T-002 · 宿主 dsh cursor · 异常 1');
  assert.equal(row({ role: '测试', status: L.ROLE_INSTANCE_STATUS_LABEL_AVAILABLE, sessions: 0, serving: L.DESKTOP_PLACEHOLDER, hosts: 'mock', abnormal: 0 }), '角色 测试 · 可用 · 0 个活跃会话 · 服务 — · 宿主 mock · 异常 0');
  assert.equal(row({ role: '协调者', status: L.ROLE_INSTANCE_STATUS_LABEL_INACTIVE, sessions: 0, serving: L.DESKTOP_PLACEHOLDER, hosts: L.DESKTOP_PLACEHOLDER, abnormal: 0 }), '角色 协调者 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 异常 0');
  assert.equal(row({ role: '撰写者', status: L.ROLE_INSTANCE_STATUS_LABEL_COOLDOWN, sessions: 0, serving: L.DESKTOP_PLACEHOLDER, hosts: 'mock', abnormal: 0 }), '角色 撰写者 · 冷却中 · 0 个活跃会话 · 服务 — · 宿主 mock · 异常 0');
  assert.equal(row({ role: '审核者', status: L.ROLE_INSTANCE_STATUS_LABEL_UNAVAILABLE, sessions: 1, serving: 'T-003', hosts: 'mock', abnormal: 1 }), '角色 审核者 · 不可用 · 1 个活跃会话 · 服务 T-003 · 宿主 mock · 异常 1');
  assert.equal(
    row({ role: '开发', status: L.ROLE_INSTANCE_STATUS_LABEL_BUSY, sessions: 3, serving: fill(L.DESKTOP_ROLE_ROW_SERVING_MORE, { first: 'T-001', n: 3 }), hosts: 'mock', abnormal: 0 }),
    '角色 开发 · 服务中 · 3 个活跃会话 · 服务 T-001 等 3 个 · 宿主 mock · 异常 0'
  );
  assert.equal(fill(L.DESKTOP_ROLE_ROW_SESSION_STACK, { n: 3 }), '×3');
  assert.equal(fill(L.DESKTOP_ROLE_ROW_SERVING_MORE, { first: 'T-001', n: 3 }), 'T-001 等 3 个');
});

test('A-10 特殊节点行：五例逐字（含子工作流全角冒号与角色数未知）', () => {
  assert.equal(fill(L.DESKTOP_HUMAN_ROW, { title: '人工验收', status: L.NODE_LABEL_PENDING }), '人工节点 人工验收 · 待执行');
  assert.equal(fill(L.DESKTOP_ESCALATE_ROW, { title: '人工裁决', status: L.NODE_LABEL_ESCALATED }), '升级节点 人工裁决 · 已升级');
  assert.equal(fill(L.DESKTOP_SUBFLOW_ROW, { title: '发布子流程', n: 3 }), '子工作流：发布子流程 · 3 角色');
  assert.equal(fill(L.DESKTOP_GROUP_ROW, { group: '编码工程', n: 8 }), '分组 编码工程 · 8 角色');
  assert.equal(fill(L.DESKTOP_SUBFLOW_UNKNOWN, { id: 'child-x' }), '子工作流 child-x · 角色数未知');
});

test('A-11 连接线行：四例 + 并行后缀 + accepted 悬停 + 7 态词逐字', () => {
  const row = (p) => fill(L.DESKTOP_EDGE_ROW, p);
  assert.equal(row({ from: '开发', to: '测试', direction: L.DESKTOP_EDGE_DIRECTION_FORWARD, status: L.HANDOFF_LABEL_DELIVERED }), '连接线 开发→测试 · 正向 · 已投递');
  assert.equal(row({ from: '测试', to: '开发', direction: L.DESKTOP_EDGE_DIRECTION_BACKFLOW, status: L.HANDOFF_LABEL_REJECTED }), '连接线 测试→开发 · 回流 · 已拒绝');
  assert.equal(
    row({ from: '开发', to: '测试', direction: L.DESKTOP_EDGE_DIRECTION_FORWARD, status: L.HANDOFF_LABEL_ACCEPTED }) + fill(L.DESKTOP_EDGE_ROW_PARALLEL, { n: 2 }),
    '连接线 开发→测试 · 正向 · 已接受 · 2 并行交接'
  );
  assert.equal(row({ from: '开发', to: '测试', direction: L.DESKTOP_EDGE_DIRECTION_FORWARD, status: L.DESKTOP_EDGE_NOT_STARTED }), '连接线 开发→测试 · 正向 · 未开始');
  assert.equal(L.DESKTOP_EDGE_ROW_ACCEPTED_HOVER, '已接受 · 处理中');
  assert.deepEqual(
    {
      rejected: L.HANDOFF_LABEL_REJECTED,
      expired: L.HANDOFF_LABEL_EXPIRED,
      pending: L.HANDOFF_LABEL_PENDING,
      delivered: L.HANDOFF_LABEL_DELIVERED,
      accepted: L.HANDOFF_LABEL_ACCEPTED,
      consumed: L.HANDOFF_LABEL_CONSUMED,
      not_started: L.DESKTOP_EDGE_NOT_STARTED
    },
    {
      rejected: '已拒绝',
      expired: '已过期',
      pending: '待投递',
      delivered: '已投递',
      accepted: '已接受',
      consumed: '已完成',
      not_started: '未开始'
    }
  );
});

test('A-12 视图控件九项 + 看板七列 + 折叠标记逐字', () => {
  assert.equal(L.DESKTOP_VIEW_GRAPH, '流程图');
  assert.equal(L.DESKTOP_VIEW_BOARD, '节点看板');
  assert.equal(L.DESKTOP_VIEW_RESET, '复位视图');
  assert.equal(L.DESKTOP_VIEW_SHOW_NOT_STARTED, '显示未开始连接线');
  assert.equal(L.DESKTOP_VIEW_HIDE_NOT_STARTED, '隐藏未开始连接线');
  assert.equal(L.DESKTOP_VIEW_EXPAND_GROUPS, '展开分组');
  assert.equal(L.DESKTOP_VIEW_COLLAPSE_GROUPS, '收起分组');
  assert.equal(fill(L.DESKTOP_VIEW_FOCUS, { node: 'T-001', hops: 2 }), '聚焦 T-001（2 跳）');
  assert.equal(L.DESKTOP_VIEW_FOCUS_EXIT, '退出聚焦');
  assert.equal(L.DESKTOP_BOARD_COLUMN_BLOCKED, '被阻塞');
  assert.equal(L.DESKTOP_BOARD_COLUMN_READY, '可调度');
  assert.equal(L.DESKTOP_BOARD_COLUMN_RUNNING, '执行中');
  assert.equal(L.DESKTOP_BOARD_COLUMN_REVIEW, '待校验');
  assert.equal(L.DESKTOP_BOARD_COLUMN_DONE, '已完成');
  assert.equal(L.DESKTOP_BOARD_COLUMN_FAILED, '失败');
  assert.equal(L.DESKTOP_BOARD_COLUMN_ESCALATED, '已升级');
  assert.equal(fill(L.DESKTOP_BOARD_CANCELLED_FOLD, { n: 2 }), '已取消 2');
  assert.equal(L.DESKTOP_BOARD_UNKNOWN_STATE, '状态未知');
});

test('A-13 图数据异常三行逐字', () => {
  assert.equal(fill(L.DESKTOP_GRAPH_MISSING, { id: 'INST-999' }), '实例 INST-999 · 不存在');
  assert.equal(L.DESKTOP_DEF_UNREADABLE, '流程图定义不可读 · 已按内置模板显示');
  assert.equal(fill(L.DESKTOP_SUBFLOW_UNKNOWN, { id: 'child-x' }), '子工作流 child-x · 角色数未知');
});

// ---------------------------------------------------------------------------
// ⑤ GET /ui/labels 响应体形状（D-2）
// ---------------------------------------------------------------------------

function createMockResponse() {
  const state = { statusCode: null, headers: null, body: null, ended: false };
  return {
    state,
    writeHead(statusCode, headers) {
      state.statusCode = statusCode;
      state.headers = headers;
      return this;
    },
    end(body) {
      state.body = body ?? '';
      state.ended = true;
      return this;
    }
  };
}

test('labelKeysPayload：形状恰为 { keys }，键值表与 UI_LABEL_KEYS 深比较相等', () => {
  const payload = labelKeysPayload();
  assert.deepEqual(Object.keys(payload), ['keys']);
  assert.deepEqual(payload.keys, UI_LABEL_KEYS);
});

test('respondUiLabels：200 + application/json; charset=utf-8 + { keys } 响应体', () => {
  const res = createMockResponse();
  respondUiLabels(res);
  assert.equal(res.state.statusCode, 200);
  assert.equal(res.state.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.ok(res.state.ended);
  const parsed = JSON.parse(res.state.body);
  assert.deepEqual(Object.keys(parsed), ['keys']);
  assert.deepEqual(parsed, { keys: { ...UI_LABEL_KEYS } });
});

test('labelsResponseBody / createLabelsRoute：S-02 handler 表形状与路径常量', () => {
  assert.deepEqual(JSON.parse(labelsResponseBody()), { keys: { ...UI_LABEL_KEYS } });
  const route = createLabelsRoute();
  assert.equal(route.method, 'GET');
  assert.equal(route.pattern, '/ui/labels');
  assert.equal(route.pattern, UI_LABELS_PATH);
  assert.equal(typeof route.handler, 'function');
  const res = createMockResponse();
  route.handler({}, res);
  assert.equal(res.state.statusCode, 200);
  assert.deepEqual(JSON.parse(res.state.body), { keys: { ...UI_LABEL_KEYS } });
});

// ---------------------------------------------------------------------------
// ⑥ AC-28 机检锚点
// ---------------------------------------------------------------------------

/** CJK 命中扫描（桌面界面层禁任何 CJK 字符，含注释）。目录不存在按 0 文件处理。 */
const CJK_PATTERN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.css', '.json']);

function collectTextFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...collectTextFiles(full));
    } else if (entry.isFile() && TEXT_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function scanCjkHits(relDir) {
  const hits = [];
  const files = collectTextFiles(path.join(REPO_ROOT, relDir));
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (CJK_PATTERN.test(line)) {
        hits.push(`${path.relative(REPO_ROOT, file)}:${i + 1}`);
      }
    });
  }
  return { hits, scanned: files.length };
}

test('AC-28：desktop/ui 与 desktop/harness 的 CJK 命中数为 0（中文只经 /ui/labels 下发）', () => {
  for (const dir of ['desktop/ui', 'desktop/harness']) {
    const { hits, scanned } = scanCjkHits(dir);
    assert.deepEqual(hits, [], `${dir} 出现 CJK 字符：${hits.join(', ')}`);
    assert.ok(scanned >= 0);
  }
});

test('AC-28：GET /ui/labels 覆盖 A-14 契约键集合（显式契约名 + 前缀族）', () => {
  const named = [
    'DESKTOP_LIST_ROW',
    'DESKTOP_PROJECT_MISSING',
    'DESKTOP_PROJECT_INVALID',
    'DESKTOP_CONN_CONNECTING',
    'DESKTOP_CONN_RECONNECTING',
    'DESKTOP_CONN_FAILED',
    'DESKTOP_TRAY_OPEN',
    'DESKTOP_TRAY_QUIT',
    'DESKTOP_QUIT_CONFIRM',
    'DESKTOP_LEGEND_ROLE',
    'DESKTOP_LEGEND_SPECIAL',
    'DESKTOP_ROLE_ROW',
    'DESKTOP_ROLE_ROW_SERVING_MORE',
    'DESKTOP_ROLE_ROW_SESSION_STACK',
    'DESKTOP_HUMAN_ROW',
    'DESKTOP_ESCALATE_ROW',
    'DESKTOP_SUBFLOW_ROW',
    'DESKTOP_GROUP_ROW',
    'DESKTOP_EDGE_ROW',
    'DESKTOP_EDGE_ROW_PARALLEL',
    'DESKTOP_BOARD_CANCELLED_FOLD',
    'DESKTOP_BOARD_UNKNOWN_STATE',
    'DESKTOP_GRAPH_MISSING',
    'DESKTOP_DEF_UNREADABLE',
    'DESKTOP_SUBFLOW_UNKNOWN'
  ];
  for (const key of named) {
    assert.ok(key in UI_LABEL_KEYS && UI_LABEL_KEYS[key].length > 0, `契约键缺失或为空：${key}`);
  }
  const prefixes = [
    ['DESKTOP_NEW_', 9],
    ['DESKTOP_VIEW_', 9],
    ['DESKTOP_LIST_FIELD_', 2],
    ['DESKTOP_BOARD_COLUMN_', 7]
  ];
  for (const [prefix, atLeast] of prefixes) {
    const count = Object.keys(UI_LABEL_KEYS).filter((k) => k.startsWith(prefix)).length;
    assert.ok(count >= atLeast, `前缀族 ${prefix} 键数 ${count} 少于 ${atLeast}`);
  }
  const reusedPrefixes = [
    'INSTANCE_LABEL_', 'NODE_LABEL_', 'HANDOFF_LABEL_', 'ROLE_INSTANCE_STATUS_LABEL_',
    'HEALTH_LABEL_', 'HEALTH_LINE_', 'HEALTH_REASON_', 'TEMPLATE_LABEL_',
    'ERROR_TEMPLATE_', 'COMMAND_ERROR_'
  ];
  for (const prefix of reusedPrefixes) {
    const count = Object.keys(UI_LABEL_KEYS).filter((k) => k.startsWith(prefix)).length;
    assert.ok(count > 0, `复用族 ${prefix} 键缺失`);
  }
});

test('AC-28：新增键存在且非空 + dependencies / devDependencies 为空', () => {
  for (const key of EXPECTED_DESKTOP_KEYS) {
    assert.ok(key in UI_LABEL_KEYS, `新增键缺失：${key}`);
    assert.ok(UI_LABEL_KEYS[key].length > 0, `新增键为空：${key}`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0, 'dependencies 必须为空');
  assert.equal(Object.keys(pkg.devDependencies ?? {}).length, 0, 'devDependencies 必须为空');
});
