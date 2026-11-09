// I1.5 验收 —— 需求附录的逐字基线（A-2 / A-3 / A-5 / A-7 / D-7）。
// 以 `_` 开头，runner 不会把它当成用例加载；用例只 import，不再各自抄一遍。
// 唯一来源：docs/iterations/iteration-5/requirement.md 附录 A / D-7。

/** A-2：16 行角色数据（首行另算）。顺序 = 分组顺序 + 同组 id 字典序。 */
export const LIST_ROWS = [
  '- arbiter 裁决者 · 通用协调 · report · none · 技能 1 · 并发 1',
  '- coordinator 协调者 · 通用协调 · report · none · 技能 1 · 并发 1',
  '- planner 规划者 · 通用协调 · report · read · 技能 2 · 并发 1',
  '- summarizer 汇总者 · 通用协调 · report · read · 技能 1 · 并发 2',
  '- worker 执行者 · 通用协调 · document · write · 技能 0 · 并发 1',
  '- data-analyst 数据分析师 · 研究分析 · dataset · write · 技能 2 · 并发 2',
  '- fact-checker 事实核查员 · 研究分析 · report · read · 技能 1 · 并发 1',
  '- researcher 研究员 · 研究分析 · report · write · 技能 1 · 并发 1',
  '- editor 编辑 · 内容创作 · document · write · 技能 2 · 并发 1',
  '- reviewer 审核者 · 内容创作 · document · read · 技能 1 · 并发 1',
  '- writer 撰写者 · 内容创作 · document · write · 技能 1 · 并发 2',
  '- code-reviewer 代码审查 · 编码工程 · code · read · 技能 1 · 并发 1',
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '- tester 测试 · 编码工程 · code · exec · 技能 1 · 并发 1',
  '- compliance-reviewer 合规审查者 · 业务运营 · report · read · 技能 1 · 并发 1',
  '- requirement-clarifier 需求澄清者 · 业务运营 · document · write · 技能 2 · 并发 1'
];

/** A-2 首行：`角色 <总数> 个（内置 <内置数> · 项目 <项目数>）`。 */
export function listHeader({ total = 16, builtin = 16, project = 0 } = {}) {
  return `角色 ${total} 个（内置 ${builtin} · 项目 ${project}）`;
}

/** A-2 末行（有坏资产时）。 */
export function invalidHint(n = 1) {
  return `${n} 个资产未通过校验，执行 orch role validate 查看`;
}

/** AC-01 的完整 17 行。 */
export const FULL_LIST = [listHeader(), ...LIST_ROWS];

/** A-3：`role show developer` 的 6 行。 */
export const SHOW_DEVELOPER = [
  '- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1',
  '  职责：按任务修改代码，交出声明的产物文件',
  '  技能：code-change, test-run',
  '  工具：read, write, edit, bash',
  '  可唤醒：tester',
  '  来源：内置 assets/roles/developer.yaml'
];

/** A-5：`orch role` 的 8 行用法块。 */
export const USAGE_LINES = [
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
  '  orch status [--instance <实例号>] [--events]',
  '  orch cancel --instance <实例号>',
  '  orch core stop',
  '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
  '  orch role show <角色> [--instance <实例号>] [--format text|json]',
  '  orch role validate [<角色>] [--format json]'
];

/** A-7：`role validate --format json` 的 counts 六键（干净树）。 */
export const COUNTS_CLEAN = { assets: 26, roles: 16, skills: 10, builtin: 26, project: 0, invalid: 0 };

/** A-6：角色对象的 10 个键。 */
export const ROLE_KEYS = [
  'id', 'name', 'group', 'groupLabel', 'artifactType',
  'sideEffect', 'skills', 'maxConcurrentSessions', 'source', 'file'
];

/** A-6：角色实例对象的 9 个键。 */
export const ROLE_INSTANCE_KEYS = [
  'roleId', 'roleInstanceId', 'status', 'statusReason', 'activeSessions',
  'servingNodes', 'hostIcons', 'maxConcurrentSessions', 'lastAction'
];

/** A-6：`role list --format json` 的顶层键（不带 --instance）。 */
export const LIST_TOP_KEYS = ['counts', 'groups', 'roles'];

/** A-6：`role list --format json` 的顶层键（带 --instance）。 */
export const LIST_TOP_KEYS_WITH_INSTANCE = ['counts', 'groups', 'instance', 'roles'];

/** A-6：`role show --format json` 的顶层键。 */
export const SHOW_TOP_KEYS = ['instance', 'role', 'roleInstance'];

/** A-7：errors 每个元素的 6 个键。 */
export const ERROR_KEYS = ['code', 'detail', 'field', 'file', 'line', 'scope'];

/** 五组（顺序即展示顺序）。 */
export const GROUPS = ['coordinator', 'research', 'writing', 'coding', 'ops'];
/** 五组中文名（A-6）。 */
export const GROUP_LABELS = {
  coordinator: '通用协调',
  research: '研究分析',
  writing: '内容创作',
  coding: '编码工程',
  ops: '业务运营'
};

/** D-7 词表：31 词（第 1、3 条命令用全表）。 */
export const FORBID_31 = [
  'task-loop', 'researcher', 'writer', 'reviewer', '研究员', '撰写者', '审核者',
  'code-loop', 'developer', 'tester', 'coordinator', 'arbiter', 'planner', 'summarizer',
  'worker', 'data-analyst', 'fact-checker', 'editor', 'code-reviewer',
  'compliance-reviewer', 'requirement-clarifier',
  'research-brief', 'fact-check', 'data-analysis', 'doc-draft', 'doc-review',
  'code-change', 'test-run', 'code-review', 'coordination', 'compliance-check'
];
/** D-7 第 2 条：30 词（去掉 coordinator：它同时是分组 id，v5 修正）。 */
export const FORBID_30 = FORBID_31.filter((w) => w !== 'coordinator');

/** code-loop 场景里，两个节点各自的会话（AC-22/24/29 的机检口径）。 */
export const CODE_NODES = ['T-001', 'T-002'];
