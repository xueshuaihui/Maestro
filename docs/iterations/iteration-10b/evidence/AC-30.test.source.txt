/**
 * I1.10b WP-1：DRILL_* 下钻文案键冻结测试（`test/wp14/labels-drill.test.js`）。
 *
 * 承担（需求 AC-30 机检 + 拆分文档 §4 WP-1 + 附录 D-11）：
 * ① A-10 全表 63 个 `DRILL_*` 新增键齐全，值逐字等于冻结基线（措辞与附录
 *    A-1 ~ A-9 样例行一字不差；`DRILL_ROLE_STATUS_TOKEN` 为五 token JSON 映射）；
 * ② 既有键按键值逐字不变：I1.10a 的 64 个桌面新增键 + 83 个复用键（147 键）
 *    键名与值一个不改（独立基线内嵌于本文件，不来自实现）；
 * ③ `GET /ui/labels` 自动下发新键：labels.js 是下发源（`UI_LABEL_KEYS` 展开
 *    `DESKTOP_LABEL_KEYS`），断言下发载荷含全部新键、形状不变；
 * ④ `desktop/ui/**` 与 `desktop/harness/**` 的 CJK 命中数为 0——目录缺失按
 *    0 命中处理（`existsSync` 守卫，`desktop/ui/drill/` 尚未创建时报 0 而非报错）。
 *
 * 运行：`NODE_ENV=test node --test test/wp14/labels-drill.test.js`
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
  TEMPLATE_LABEL
} from '../../src/cli/labels.js';
import {
  DESKTOP_LABEL_KEYS,
  UI_LABEL_KEYS,
  labelKeysPayload
} from '../../src/daemon/http/labels.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// ---------------------------------------------------------------------------
// ① A-10 全表：63 个 DRILL_* 键与逐字值（冻结基线，WP-1 产出）
// ---------------------------------------------------------------------------

/** A-10 全表键名（面包屑 3 / 角色栏 4 / DAG 5 / 卡片 7 / 指示器 3 / 详情 6 / 连接线 4 / 升级 11 / 宿主 7 / 视图 4 / 降级 8 / token 映射 1）。 */
const EXPECTED_DRILL_KEYS = Object.freeze([
  'DRILL_CRUMB_ROLE',
  'DRILL_CRUMB_NODE',
  'DRILL_CRUMB_SUBFLOW',
  'DRILL_ROLE_BAR',
  'DRILL_ROLE_SERVING_MORE',
  'DRILL_LAST_ACTION',
  'DRILL_LAST_ACTION_MISSING',
  'DRILL_DAG_NODE',
  'DRILL_DAG_EDGE',
  'DRILL_DAG_REL_SELF',
  'DRILL_DAG_REL_UP',
  'DRILL_DAG_REL_DOWN',
  'DRILL_CARD_TITLE',
  'DRILL_CARD_EXEC',
  'DRILL_CARD_DEPS',
  'DRILL_CARD_TYPE_HUMAN',
  'DRILL_CARD_TYPE_ESCALATE',
  'DRILL_CARD_TYPE_SUBFLOW',
  'DRILL_CARD_EMPTY',
  'DRILL_INDICATOR',
  'DRILL_INDICATOR_INPUT_DETAIL',
  'DRILL_INDICATOR_NONE',
  'DRILL_DETAIL_HEAD',
  'DRILL_DETAIL_TIMELINE',
  'DRILL_DETAIL_SUMMARY',
  'DRILL_DETAIL_EVIDENCE',
  'DRILL_DETAIL_HANDOFF',
  'DRILL_DETAIL_NONE',
  'DRILL_CONN_HEAD',
  'DRILL_CONN_PARALLEL',
  'DRILL_CONN_HANDOFF',
  'DRILL_CONN_EMPTY',
  'DRILL_ESC_TITLE',
  'DRILL_ESC_COUNT',
  'DRILL_ESC_ROW',
  'DRILL_ESC_REASON',
  'DRILL_ESC_DEFECT',
  'DRILL_ESC_CONTINUE',
  'DRILL_ESC_CANCEL',
  'DRILL_ESC_DONE',
  'DRILL_ESC_ALREADY',
  'DRILL_ESC_NOT_SUSPENDED',
  'DRILL_ESC_FAILED',
  'DRILL_HOST_OPEN',
  'DRILL_HOST_OPENED',
  'DRILL_HOST_HINT',
  'DRILL_HOST_NONE',
  'DRILL_HOST_UNSUPPORTED',
  'DRILL_HOST_MISSING',
  'DRILL_HOST_FAILED',
  'DRILL_VIEW_BACK_GRAPH',
  'DRILL_VIEW_BACK_DRILL',
  'DRILL_VIEW_BACK_LEVEL',
  'DRILL_VIEW_ALL_NODES',
  'DRILL_EMPTY_TASK',
  'DRILL_EMPTY_ROLE',
  'DRILL_EMPTY_RECORD',
  'DRILL_NO_SESSION',
  'DRILL_UNKNOWN_STATE',
  'DRILL_NODE_MISSING',
  'DRILL_ROLE_UNUSED',
  'DRILL_SUBFLOW_CYCLE',
  'DRILL_ROLE_STATUS_TOKEN'
]);

/** A-10 全表逐字值（措辞 = 附录 A-1 ~ A-9 样例行，一字不差）。 */
const EXPECTED_DRILL_VALUES = Object.freeze({
  DRILL_CRUMB_ROLE: '实例 {id} / 角色 {role}',
  DRILL_CRUMB_NODE: '节点 {node}',
  DRILL_CRUMB_SUBFLOW: '子工作流 {title}',
  DRILL_ROLE_BAR:
    '角色栏 {role} · {status} · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts} · 最近 {last}',
  DRILL_ROLE_SERVING_MORE: '{first} 等 {n} 个',
  DRILL_LAST_ACTION: '最近 {node} · 轮次 {round}/{maxRounds} · {state}',
  DRILL_LAST_ACTION_MISSING: '最近 —',
  DRILL_DAG_NODE: '局部节点 {node} · {relation} · {type} · {status}',
  DRILL_DAG_EDGE: '局部连线 {from}→{to} · {direction} · {status}',
  DRILL_DAG_REL_SELF: '本角色',
  DRILL_DAG_REL_UP: '上游',
  DRILL_DAG_REL_DOWN: '下游',
  DRILL_CARD_TITLE: '卡片 {node} · {title} · 轮次 {round}/{maxRounds} · {status}',
  DRILL_CARD_EXEC: '执行 {role} · {session} · 已运行 {elapsed} · 工具 {tool}',
  DRILL_CARD_DEPS: '依赖 {deps} · 产物 {products} · 证据 {evidence}',
  DRILL_CARD_TYPE_HUMAN: '人工节点 {node}',
  DRILL_CARD_TYPE_ESCALATE: '升级节点 {node}',
  DRILL_CARD_TYPE_SUBFLOW: '子工作流：{title} · 角色 {n}',
  DRILL_CARD_EMPTY: '执行 {role} · 无会话 · — · 工具 —',
  DRILL_INDICATOR: '{label}{detail}',
  DRILL_INDICATOR_INPUT_DETAIL: '：{action}',
  DRILL_INDICATOR_NONE: '无会话',
  DRILL_DETAIL_HEAD: '节点 {node} · {title} · {status} · 轮次 {round}/{maxRounds}',
  DRILL_DETAIL_TIMELINE: '时间线 {time} {state}',
  DRILL_DETAIL_SUMMARY: '摘要 命令 {command} · 退出码 {exitCode} · 关键输出 {lines} 行 · 日志 {log}',
  DRILL_DETAIL_EVIDENCE: '证据 {index} · {ref} · {type} · {status}',
  DRILL_DETAIL_HANDOFF: '交接 {id} · {direction} · 第 {round} 轮 · {state} · {time}',
  DRILL_DETAIL_NONE: '{section} 无记录',
  DRILL_CONN_HEAD: '连接 {from}→{to} · {direction} · {status}',
  DRILL_CONN_PARALLEL: ' · {n} 并行交接',
  DRILL_CONN_HANDOFF: '交接 {id} · 第 {round} 轮 · {state} · {time}',
  DRILL_CONN_EMPTY: '交接 无',
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
  DRILL_HOST_OPEN: '打开宿主会话',
  DRILL_HOST_OPENED: '已打开 DeepSeek Harness · 会话 {id}',
  DRILL_HOST_HINT: '会话标识已复制 · 在 DSH 中按标识定位',
  DRILL_HOST_NONE: '无可跳转会话',
  DRILL_HOST_UNSUPPORTED: '宿主 {host} 不支持跳转',
  DRILL_HOST_MISSING: '未找到 DeepSeek Harness',
  DRILL_HOST_FAILED: '跳转失败 · {reason}',
  DRILL_VIEW_BACK_GRAPH: '返回流程图',
  DRILL_VIEW_BACK_DRILL: '返回角色下钻',
  DRILL_VIEW_BACK_LEVEL: '返回上一层',
  DRILL_VIEW_ALL_NODES: '查看全部节点',
  DRILL_EMPTY_TASK: '任务 无',
  DRILL_EMPTY_ROLE: '角色 无',
  DRILL_EMPTY_RECORD: '交接 无',
  DRILL_NO_SESSION: '无会话',
  DRILL_UNKNOWN_STATE: '状态未知',
  DRILL_NODE_MISSING: '节点 {node} · 不存在',
  DRILL_ROLE_UNUSED: '角色 {role} · 本实例未使用',
  DRILL_SUBFLOW_CYCLE: '子工作流定义存在循环 · 已停止下钻',
  DRILL_ROLE_STATUS_TOKEN:
    '{"available":"可用","serving":"服务中","cooldown":"冷却中","unavailable":"不可用","inactive":"未参与"}'
});

/** `DRILL_ROLE_STATUS_TOKEN` 的五 token 映射（A-10 逐字；serving 对应 cli 词表成员 `busy`）。 */
const EXPECTED_ROLE_STATUS_TOKEN = Object.freeze({
  available: '可用',
  serving: '服务中',
  cooldown: '冷却中',
  unavailable: '不可用',
  inactive: '未参与'
});

/** 图投影 token → `ROLE_INSTANCE_STATUS_LABEL` 成员名（同值核对的成员映射）。 */
const TOKEN_TO_CLI_MEMBER = Object.freeze({
  available: 'available',
  serving: 'busy',
  cooldown: 'cooldown',
  unavailable: 'unavailable',
  inactive: 'inactive'
});

// ---------------------------------------------------------------------------
// ② 既有键零改动基线：I1.10a 的 64 个桌面新增键（值逐字内嵌，独立于实现）
// ---------------------------------------------------------------------------

const EXPECTED_ORIGINAL_DESKTOP_VALUES = Object.freeze({
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
  GROUP_LABEL_CODING: '编码工程',
  GROUP_LABEL_RESEARCH: '研究分析',
  GROUP_LABEL_UNGROUPED: '未分组',
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

/** 既有复用表成员清单（83 键的冻结锚点，不来自实现；平铺名 = `表名_成员名`）。 */
const EXPECTED_REUSE_MEMBERS = Object.freeze([
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

/** 平铺命名：`表名_成员名`（成员名大写、`-` 归一 `_`、驼峰拆分；与 daemon 侧同规则）。 */
function flatName(prefix, member) {
  const snake = String(member)
    .replaceAll('-', '_')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase();
  return `${prefix}_${snake}`;
}

const ORIGINAL_DESKTOP_KEYS = Object.freeze(Object.keys(EXPECTED_ORIGINAL_DESKTOP_VALUES));

// ---------------------------------------------------------------------------
// ① A-10 全表冻结
// ---------------------------------------------------------------------------

test('A-10 新增键齐全：DRILL_* 键集合与全表精确相等（63 键，多键/少键都 fail）', () => {
  const drillKeys = Object.keys(DESKTOP_LABEL_KEYS).filter((k) => k.startsWith('DRILL_'));
  assert.equal(drillKeys.length, 63, `DRILL_* 键数应为 63，实为 ${drillKeys.length}`);
  assert.deepEqual(drillKeys.sort(), [...EXPECTED_DRILL_KEYS].sort());
  // A-10 命名约定：DRILL_* 前缀不得与 DESKTOP_* 撞名；DESKTOP_* 既有键原样保留。
  assert.equal(
    Object.keys(DESKTOP_LABEL_KEYS).length,
    ORIGINAL_DESKTOP_KEYS.length + EXPECTED_DRILL_KEYS.length,
    '桌面键总数 = 既有 64 + 新增 63'
  );
  for (const key of ORIGINAL_DESKTOP_KEYS) {
    assert.ok(key in DESKTOP_LABEL_KEYS, `既有键被删：${key}`);
  }
});

test('A-10 逐字值：每个 DRILL_* 键值与冻结基线一字不差', () => {
  for (const key of EXPECTED_DRILL_KEYS) {
    assert.equal(DESKTOP_LABEL_KEYS[key], EXPECTED_DRILL_VALUES[key], `${key} 文案漂移`);
  }
});

test('DRILL_ROLE_STATUS_TOKEN：JSON 承载且五 token 映射逐字（与 ROLE_INSTANCE_STATUS_LABEL 同值）', () => {
  const parsed = JSON.parse(DESKTOP_LABEL_KEYS.DRILL_ROLE_STATUS_TOKEN);
  assert.deepEqual(parsed, EXPECTED_ROLE_STATUS_TOKEN);
  for (const [token, label] of Object.entries(EXPECTED_ROLE_STATUS_TOKEN)) {
    assert.equal(
      label,
      ROLE_INSTANCE_STATUS_LABEL[TOKEN_TO_CLI_MEMBER[token]],
      `token ${token} 与既有词表不同值`
    );
  }
});

// ---------------------------------------------------------------------------
// ② 既有键零改动锚点（AC-30「既有按键值逐字不变」）
// ---------------------------------------------------------------------------

test('既有桌面键零改动：64 键的键名与值逐字不变（改即回归缺陷）', () => {
  for (const [key, value] of Object.entries(EXPECTED_ORIGINAL_DESKTOP_VALUES)) {
    assert.equal(DESKTOP_LABEL_KEYS[key], value, `${key} 既有文案漂移`);
  }
  const nonDrill = Object.keys(DESKTOP_LABEL_KEYS).filter((k) => !k.startsWith('DRILL_'));
  assert.deepEqual(nonDrill.sort(), [...ORIGINAL_DESKTOP_KEYS].sort(), '既有键集合被增删');
});

test('既有复用键零改动：83 个平铺键与 src/cli/labels.js 对应成员逐字同源', () => {
  let total = 0;
  for (const [prefix, table, members] of EXPECTED_REUSE_MEMBERS) {
    assert.deepEqual(Object.keys(table).sort(), [...members].sort(), `${prefix} 成员集合漂移`);
    for (const member of members) {
      const name = flatName(prefix, member);
      assert.ok(name in UI_LABEL_KEYS, `下发键缺少 ${name}`);
      assert.equal(UI_LABEL_KEYS[name], table[member], `${name} 与 cli 表成员值不同源`);
      total += 1;
    }
  }
  assert.equal(total, 83, `复用键应为 83，实为 ${total}`);
});

test('全集计数：UI_LABEL_KEYS = 既有 64 + 新增 63 + 复用 83 = 210', () => {
  assert.equal(Object.keys(UI_LABEL_KEYS).length, 210);
});

// ---------------------------------------------------------------------------
// ③ GET /ui/labels 自动下发（labels.js 是下发源，追加即下发）
// ---------------------------------------------------------------------------

test('GET /ui/labels 下发载荷：形状仍为 { keys } 且覆盖全部 A-10 新增键', () => {
  const payload = labelKeysPayload();
  assert.deepEqual(Object.keys(payload), ['keys']);
  const keys = payload.keys;
  for (const key of EXPECTED_DRILL_KEYS) {
    assert.ok(key in keys && keys[key].length > 0, `下发载荷缺少新增键：${key}`);
    assert.equal(keys[key], DESKTOP_LABEL_KEYS[key], `下发值与文案表不同源：${key}`);
  }
  assert.deepEqual(keys, UI_LABEL_KEYS);
});

// ---------------------------------------------------------------------------
// ④ desktop/ui 与 desktop/harness 的 CJK 命中数为 0（目录缺失 = 0 命中）
// ---------------------------------------------------------------------------

/** CJK 命中扫描（与 wp13 同一口径；目录不存在按 0 文件处理，不报错）。 */
const CJK_PATTERN = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.css', '.json']);

function collectTextFiles(dir) {
  if (!fs.existsSync(dir)) return []; // 目录缺失：命中数自然为 0（desktop/ui/drill 尚未创建属正常）
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

test('AC-30：desktop/ui 与 desktop/harness 的 CJK 命中数为 0（子目录缺失按 0 命中）', () => {
  for (const dir of ['desktop/ui', 'desktop/harness']) {
    const { hits, scanned } = scanCjkHits(dir);
    assert.deepEqual(hits, [], `${dir} 出现 CJK 字符：${hits.join(', ')}`);
    assert.ok(scanned >= 0);
    // 缺失守卫语义自查：不存在的目录不得导致扫描抛错，命中数恒为 0。
    const missing = scanCjkHits(path.join(dir, '__definitely_missing__'));
    assert.deepEqual(missing.hits, []);
    assert.equal(missing.scanned, 0);
  }
});
