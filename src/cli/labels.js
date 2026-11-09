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

/** 分组名（D-3 的五组，顺序即展示顺序）。 */
export const GROUP_LABEL = Object.freeze({
  coordinator: '通用协调',
  research: '研究分析',
  writing: '内容创作',
  coding: '编码工程',
  ops: '业务运营'
});

/** 角色实例六态（D-5）。`unknown-role` 不是状态，是 `unavailable` 的 `statusReason`。 */
export const ROLE_INSTANCE_STATUS_LABEL = Object.freeze({
  inactive: '未参与',
  available: '可用',
  busy: '服务中',
  cooldown: '冷却中',
  unavailable: '不可用',
  retired: '已关闭'
});

/**
 * `orch role` 的全部文案（唯一来源；`render.js` / `roles.js` 只引用键名）。
 * `usageReason` 的五条模板由 `main.js` 的 `parseArgs` 取用，`badGroup` 例外：
 * `--group` 的**取值**归 `roles.js` 判，`{groups}` 由它用 `GROUPS` 拼。
 */
export const ROLE_CLI_TEXT = Object.freeze({
  listHeader: '角色 {total} 个（内置 {builtin} · 项目 {project}）',
  listRow: '- {id} {name} · {groupLabel} · {artifactType} · {sideEffect} · 技能 {skillCount} · 并发 {max}',
  listInvalidTail: '{n} 个资产未通过校验，执行 orch role validate 查看',
  showDuty: '  职责：{summary}',
  showSkills: '  技能：{skills}',
  showTools: '  工具：{tools}',
  showWake: '  可唤醒：{wake}',
  showSourceBuiltin: '  来源：内置 {file}',
  showSourceProject: '  来源：项目 {file}',
  instanceLine:
    '  实例 {instanceId}：{status} · 活跃会话 {active}/{max} · 服务节点 {nodes} · 宿主 {host} · {last}',
  lastAction: '最近 {nodeId} · 轮次 {round}/{maxRounds}',
  // 图取不到时 maxRounds / round 可能缺省：不打印悬空的 `/`（A-3 的正常路径逐字不变）。
  lastActionNoMax: '最近 {nodeId} · 轮次 {round}',
  lastActionNodeOnly: '最近 {nodeId}',
  lastActionMissing: '最近 —',
  instanceUnused: '  实例 {instanceId}：本实例未使用该角色',
  unknownRoleNote: '（注册表中不存在该角色）',
  validateOk: '校验资产 {assets} 个：全部通过（角色 {roles} · 技能 {skills}）',
  validateFail: '校验资产 {assets} 个：{invalid} 个不合法',
  validateRow: '- {file}：{detail}（{code}）',
  notFoundRole: '找不到角色：{id}',
  notFoundRoleHint: '可用角色：执行 orch role list 查看',
  notFoundInstance: '找不到实例：{id}',
  runRegistryInvalid: '注册表不合法：{detail}',
  placeholder: '—',
  usageReason: Object.freeze({
    unknownRoleSub: '未知的 role 子命令：{sub}',
    missingRoleId: 'role show 需要角色 id',
    badFormat: '--format 只接受 text 或 json',
    badGroup: '--group 只接受 {groups}',
    flagNotApplicable: '--{key} 不适用于 role {sub}'
  })
});

/**
 * 14 个资产级原因码的人话模板（附录 A-5 逐字）。`registry` 只给
 * `{code, file, scope, field, line, params}`，由 `roles.js` 的 `fill()` 组装。
 */
export const REGISTRY_ERROR = Object.freeze({
  YAML_PARSE_FAILED: '第 {line} 行无法解析：{detail}',
  ROLE_SCHEMA_MISSING: '缺少必填字段：{field}',
  ROLE_ID_MISMATCH: '角色 id 与文件名不一致：文件 {fileId} / 声明 {declaredId}',
  ROLE_GROUP_INVALID: '分组取值非法：{value}；合法取值：coordinator / research / writing / coding / ops',
  ROLE_ARTIFACT_TYPE_INVALID: '产物类型取值非法：{value}；合法取值：code / document / dataset / report',
  ROLE_SIDE_EFFECT_INVALID: '副作用等级取值非法：{value}；合法取值：none / read / write / exec',
  ROLE_MAX_CONCURRENT_INVALID: '并发上限取值非法：{value}；合法范围：1~5 的整数',
  ROLE_SKILL_NOT_FOUND: '引用的技能不存在：{skill}',
  SKILL_FILE_MISSING: '技能目录缺少 SKILL.md：{dir}',
  SKILL_SCHEMA_MISSING: '缺少必填字段：{field}',
  SKILL_ID_MISMATCH: '技能 id 与目录名不一致：目录 {dirId} / 声明 {declaredId}',
  SKILL_BODY_EMPTY: '技能正文为空：{dir}',
  SKILL_GROUP_INVALID: '适用分组取值非法：{value}；合法取值：coordinator / research / writing / coding / ops',
  REGISTRY_ASSETS_MISSING: '内置资产目录缺失：{path}'
});

/** `yaml-lite` / `skill-file` 的五个机器键 → 中文短语（D-3 的 v5 修正）。 */
export const YAML_DETAIL = Object.freeze({
  'inconsistent-indentation': '缩进不一致',
  'unsupported-token': '不支持的语法：{token}',
  'duplicate-key': '键重复：{key}',
  'missing-value': '缺少值：{key}',
  'missing-front-matter': '缺少前置元数据分隔符'
});

/**
 * Usage block (A-12, 25 lines). The first 8 lines are the I1.5 original, byte-for-byte
 * frozen — `test/wp11/cli-role.test.js:356` asserts `slice(0, 8)` against this array
 * and `test/wp12/cli-assets.test.js` pins all 25 lines against the A-12 text.
 * Lines 9-25 are the 17 new asset subcommands, one line each (BR-29).
 */
export const USAGE_LINES = Object.freeze([
  '用法：orch run|status|cancel|core',
  '  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]',
  '  orch status [--instance <实例号>] [--events]',
  '  orch cancel --instance <实例号>',
  '  orch core stop',
  '  orch role list [--group <组>] [--instance <实例号>] [--format text|json]',
  '  orch role show <角色> [--instance <实例号>] [--format text|json]',
  '  orch role validate [<角色>] [--format json]',
  '  orch role create <角色> [--from <角色>] --name <中文名|继承> --group <组|继承> --artifact-type <类型|继承> --side-effect <等级|继承> [--summary <摘要>] [--skills <a,b>] [--tools <a,b>] [--wake-allow <a,b>] [--max-concurrent <1-5>] [--force]',
  '  orch role edit <角色> [--set <键=值>]... [--unset <键>]...',
  '  orch role export <角色> [--out <文件>]',
  '  orch role import <文件> [--force]',
  '  orch role diff <角色> [--against <内置角色|文件>] [--format text|json]',
  '  orch skill list [--group <组>] [--format text|json]',
  '  orch skill show <技能> [--format text|json]',
  '  orch skill create <技能> --name <中文名> --summary <摘要> [--applies-to <a,b>] [--commands <命令>] [--body-file <文件>] [--force]',
  '  orch skill validate [<技能>] [--format json]',
  '  orch skill export <技能> [--out <文件>]',
  '  orch skill import <文件|目录> [--force]',
  '  orch workflow list [--format text|json]',
  '  orch workflow show <工作流> [--format text|json]',
  '  orch workflow create <工作流> --name <中文名> [--from <工作流>] [--force]',
  '  orch workflow validate [<工作流>] [--format json]',
  '  orch workflow diff <工作流> [--against <内置工作流|文件>] [--format text|json]',
  '  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]'
]);

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
  CANCEL_NOT_NEEDED: '实例已结束（{state}），无需取消',
  // I1.3 business codes (requirement D-5, verbatim). All three use existing placeholder
  // names only — the `applyPlaceholders()` whitelist is NOT extended (AC-36).
  PRODUCT_LINE_MISSING_TASK_LOOP:
    '通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）',
  PRODUCT_INVALID_TASK_LOOP:
    '通用任务闭环的产物名不合法：{name}（只写文件名，.md 结尾，不带目录与版本号）',
  WORKSPACE_INIT_FAILED: '无法创建工作区：{cause}'
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
  'review.evidence_verified': '证据核对通过'
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

// ---------------------------------------------------------------- I1.6 新增（WP-5）
//
// 以下全部是本迭代新增的表；既有表（REGISTRY_ERROR / YAML_DETAIL / ROLE_CLI_TEXT 等）
// 一个键都不加不改（M-6）。所有新增中文只出现在本文件（BR-31 / AC-51）。

/** A-15 的 7 条角色原因码明细模板。CLI 层用 `{name}` 填充组装人话明细。 */
export const ROLE_REASON_TEXT = Object.freeze({
  ROLE_TOOL_UNKNOWN: '工具取值非法：{value}；合法取值：read / write / edit / bash',
  ROLE_PERMISSION_MISMATCH: '{reason}',
  ROLE_WAKE_UNKNOWN: '唤醒白名单里的角色不存在：{role}',
  ROLE_WAKE_SELF: '唤醒白名单不能包含自己：{role}',
  ROLE_DERIVE_MISSING: '派生来源不存在：{role}',
  ROLE_DERIVE_CYCLE: '派生链成环：{chain}',
  ROLE_CONTRACT_UNBOUND: '契约不连通：{field} 没有{side}'
});

/**
 * `ROLE_PERMISSION_MISMATCH` 的三条固定句（A-15 逐字）。`contracts.js`（WP-2）选句并
 * 把成句放进错误对象的 `params.reason`，CLI 层经 `ROLE_REASON_TEXT.ROLE_PERMISSION_MISMATCH`
 * 原样透出，不再改写。
 */
export const ROLE_PERMISSION_TEXT = Object.freeze({
  readWithWriteTool: '副作用等级为 read 的角色不能带写工具 {tool}',
  execNeedsCommandTool: '副作用等级为 exec 的角色必须带能执行命令的工具 bash',
  noneWithAnyTool: '副作用等级为 none 的角色不能带任何工具'
});

/** A-15 的 19 条工作流原因码明细模板（逐字）。 */
export const WORKFLOW_REASON_TEXT = Object.freeze({
  WORKFLOW_SCHEMA_MISSING: '缺少必填字段：{field}',
  WORKFLOW_ID_MISMATCH: '工作流 id 与文件名不一致：文件 {fileId} / 声明 {declaredId}',
  WORKFLOW_NODE_DUPLICATE: '节点 id 重复：{id}',
  WORKFLOW_NODE_TYPE_INVALID: '节点类型取值非法：{value}；合法取值：role / human / escalate / subworkflow',
  WORKFLOW_NODE_FIELD_MISSING: '节点 {node} 缺少必填字段：{field}',
  WORKFLOW_ROLE_UNKNOWN: '引用的角色不存在：{role}',
  WORKFLOW_SUB_UNKNOWN: '引用的子工作流不存在：{id}',
  WORKFLOW_SUB_CYCLE: '子工作流成环：{chain}',
  WORKFLOW_EDGE_INVALID: '边不合法：{detail}',
  WORKFLOW_TIMEOUT_INVALID: '超时取值非法：{value}；合法范围：1~86400 的整数',
  WORKFLOW_RETRY_INVALID: '重试取值非法：{value}；合法范围：0~5 的整数',
  WORKFLOW_UNREACHABLE: '节点不可达：{node}',
  WORKFLOW_BACKFLOW_NO_LIMIT: '回流目标缺少轮次上限：{node}',
  WORKFLOW_SCOPE_OVERLAP: '并行组 {scope} 内的 {a} 与 {b} 使用了同一作用域 {name}',
  WORKFLOW_SCOPE_INVALID: '并行组 {scope} 只有 1 个节点',
  WORKFLOW_VAR_UNKNOWN: '变量引用无法解析：{ref}',
  WORKFLOW_MAPPING_INCOMPLETE: '{node} 的输入 {field} 没有来源',
  WORKFLOW_TRANSITION_ILLEGAL: '{detail}',
  WORKFLOW_WAKE_DENIED: '唤醒不在白名单内：{from} → {to}'
});

/**
 * `WORKFLOW_TRANSITION_ILLEGAL` 的四条固定句（A-15 逐字）。`workflow-schema.js`（WP-1）
 * / `workflows.js`（WP-3）选句并放进 `params.detail`，CLI 经
 * `WORKFLOW_REASON_TEXT.WORKFLOW_TRANSITION_ILLEGAL` 原样透出。
 */
export const WORKFLOW_TRANSITION_TEXT = Object.freeze({
  entryBackflow: '入口节点 {node} 不能有回流入边',
  escalateOutbound: '升级节点 {node} 不能有正向出边',
  humanEdgeCondition: '人工节点 {node} 的出边必须写人工条件',
  backflowTarget: '{node} 不能成为回流目标'
});

/** 边条件的中文名（A-10 逐字）。`always` 不进条件分支段，仅为查表完备而设。 */
export const CONDITION_LABEL = Object.freeze({
  always: '无条件',
  passed: '判定通过',
  failed: '判定不通过',
  human_approved: '人工通过',
  human_rejected: '人工驳回'
});

/** 四类 `node_type` 的类型文案（A-8）。`role`/`subworkflow` 的带参形态另见 WORKFLOW_CLI_TEXT。 */
export const NODE_TYPE_LABEL = Object.freeze({
  role: '角色节点',
  human: '人工节点',
  escalate: '升级节点',
  subworkflow: '子工作流'
});

/** 派生角色的默认中文名（BR-05）：`<来源中文名>（派生）`。 */
export const DERIVED_NAME_TEMPLATE = '{base}（派生）';

/** 共用的 diff 行版式（A-5 / A-11 同一套前缀与计数；两族只差首句模板）。 */
export const DIFF_TEXT = Object.freeze({
  added: '+ {field}：{value}',
  removed: '- {field}：{value}',
  changed: '~ {field}：{base} → {target}',
  count: '差异 {n} 项',
  none: '无差异'
});

/**
 * `role create` 的两档必填与取值校验文案（AC-02 / AC-54，检查在 `main.js` 的
 * `parseArgs` 里）。`{values}` 由 `main.js` 用 `GROUP_LABEL` / `role-schema` 常量拼。
 */
export const ROLE_USAGE_TEXT = Object.freeze({
  requiresFlag: 'role create 需要 --{key}',
  badGroup: 'role create 的 --group 只接受 {values}',
  badArtifactType: 'role create 的 --artifact-type 只接受 {values}',
  badSideEffect: 'role create 的 --side-effect 只接受 {values}',
  missingId: Object.freeze({
    show: 'role show 需要角色 id',
    create: 'role create 需要角色 id',
    edit: 'role edit 需要角色 id',
    export: 'role export 需要角色 id',
    import: 'role import 需要文件',
    diff: 'role diff 需要角色 id'
  })
});

/**
 * I1.6 新增 role 写命令与 diff 的成功/失败句式（A-2 ~ A-5 逐字；`roles.js` 取用）。
 * 既有 `ROLE_CLI_TEXT` 不扩键（M-6），故新句式全部落在这里。
 */
export const ROLE_WRITE_TEXT = Object.freeze({
  created: '已创建项目角色：{file}',
  checkPassed: '校验：通过',
  createRejected: '创建被拒：{detail}（{code}）',
  exists: '已存在同名项目角色：{file}（加 --force 覆盖）',
  updated: '已更新项目角色：{file}',
  rewrittenNote: '（已按规范格式重写，注释不保留）',
  editRejected: '编辑被拒：{detail}（{code}）',
  builtinEditReadonly: '内置角色不可编辑：先 orch role create <新角色> --from {id}',
  exported: '已导出角色 {id} 到 {file}',
  installed: '已安装项目角色：{file}',
  importRejected: '导入被拒：{detail}（{code}）',
  importFileMissing: '导入被拒：文件不存在：{file}',
  diffHeader: '对比角色 {id}（{source}）与基线 {base}（{baseSource}）',
  missingBaseline: '缺少对比基线：{id}（用 --against 指定内置角色或文件）',
  sourceBuiltin: '内置',
  sourceProject: '项目'
});

/** `orch skill` 六条子命令的全部文案（A-6 / A-7 逐字；`skills.js` / `render.js` 取用）。 */
export const SKILL_CLI_TEXT = Object.freeze({
  listHeader: '技能 {total} 个（内置 {builtin} · 项目 {project}）',
  listRow: '- {id} {name} · {appliesTo} · 命令 {commands}',
  listInvalidTail: '{n} 个资产未通过校验，执行 orch skill validate 查看',
  showSummary: '  摘要：{summary}',
  showCommands: '  命令：{commands}',
  showAppliesTo: '  适用：{appliesTo}',
  showSourceBuiltin: '  来源：内置 {file}',
  showSourceProject: '  来源：项目 {file}',
  showBodyHeader: '  正文：',
  validateOk: '校验技能 {assets} 个：全部通过',
  validateFail: '校验技能 {assets} 个：{invalid} 个不合法',
  validateRow: '- {file}：{detail}（{code}）',
  created: '已创建项目技能：{file}',
  checkPassed: '校验：通过',
  createRejected: '创建被拒：{detail}（{code}）',
  exists: '已存在同名项目技能：{file}（加 --force 覆盖）',
  builtinReadonly: '内置技能只读：{id}',
  exported: '已导出技能 {id} 到 {file}',
  installed: '已安装项目技能：{file}',
  importRejected: '导入被拒：{detail}（{code}）',
  importFileMissing: '导入被拒：文件不存在：{file}',
  notFoundSkill: '找不到技能：{id}',
  notFoundSkillHint: '可用技能：执行 orch skill list 查看',
  notImplemented: 'skill 命令尚未实现',
  placeholder: '—',
  usageReason: Object.freeze({
    unknownSub: '未知的 skill 子命令：{sub}',
    flagNotApplicable: '--{key} 不适用于 skill {sub}',
    badFormat: '--format 只接受 text 或 json',
    requiresName: 'skill create 需要 --name',
    requiresSummary: 'skill create 需要 --summary',
    missingId: Object.freeze({
      show: 'skill show 需要技能 id',
      create: 'skill create 需要技能 id',
      export: 'skill export 需要技能 id',
      import: 'skill import 需要文件'
    })
  })
});

/** `orch workflow` 六条子命令的全部文案（A-8 ~ A-11 逐字；`workflows.js` / `render.js` 取用）。 */
export const WORKFLOW_CLI_TEXT = Object.freeze({
  listHeader: '工作流 {total} 个（内置 {builtin} · 项目 {project}）',
  listRow: '- {id} {name} · {nodes} 节点 · {edges} 边 · {source}',
  sourceBuiltin: '内置',
  sourceProject: '项目',
  builtinFile: '内置 {id}',
  listInvalidTail: '{n} 个工作流未通过校验，执行 orch workflow validate 查看',
  showEntry: '  入口：{entry} · 终点：{terminal}',
  nodesHeader: '  节点：',
  edgesHeader: '  边：',
  nodeRow: '    {id} {title} · {type} · 超时 {timeout} · 重试 {retry}',
  nodeTypeRole: '角色节点 {role}',
  nodeTypeSub: '子工作流 {id} · {nodes} 节点',
  edgeRow: '    {from} → {to} {kind}',
  edgeKind: Object.freeze({ forward: '正向', backflow: '回流', retest: '复测' }),
  edgeRounds: ' · 轮次上限 {rounds}',
  edgeCondition: ' · 条件 {when}',
  edgeMappings: ' · 字段映射 {n} 条',
  validateOk: '校验工作流 {assets} 个：全部通过',
  validateFail: '校验工作流 {assets} 个：{invalid} 个不合法',
  validateRow: '- {file}：{detail}（{code}）',
  created: '已创建项目工作流：{file}',
  checkPassed: '校验：通过',
  createRejected: '创建被拒：{detail}（{code}）',
  exists: '已存在同名项目工作流：{file}（加 --force 覆盖）',
  notFoundWorkflow: '找不到工作流：{id}',
  notFoundWorkflowHint: '可用工作流：执行 orch workflow list 查看',
  diffHeader: '对比工作流 {id}（{source}）与基线 {base}（{baseSource}）',
  missingBaseline: '缺少对比基线：{id}（用 --against 指定内置工作流或文件）',
  notImplemented: 'workflow 命令尚未实现',
  placeholder: '—',
  plan: Object.freeze({
    header: '编排计划 {id} · {nodes} 节点 · {edges} 边 · {groups} 个并行组 · {subs} 个子工作流',
    layerNode: '{index}. {node}',
    layerParallel: '{index}. 并行组 {name}：{nodes} · 汇合：{join}',
    nodeDesc: '{id} {title}（{type}）',
    branchesHeader: '条件分支：',
    branchRow: '- {from} → {to} 当 {when}',
    mappingsHeader: '字段映射：',
    mappingRow: '- {from} → {to}',
    policiesHeader: '超时与重试：',
    policyRow: '- {node} 超时 {timeout}s · 重试 {retry}',
    conclusion: '结论：编排可执行，未启动任何会话',
    conclusionWarned: '结论：编排可执行，有 {n} 条提醒，未启动任何会话',
    rejected: '预演被拒：{detail}（{code}）',
    rejectedHint: '执行 orch workflow validate 查看全部问题'
  }),
  usageReason: Object.freeze({
    unknownSub: '未知的 workflow 子命令：{sub}',
    flagNotApplicable: '--{key} 不适用于 workflow {sub}',
    badFormat: '--format 只接受 text 或 json',
    requiresName: 'workflow create 需要 --name',
    missingId: Object.freeze({
      show: 'workflow show 需要工作流 id',
      create: 'workflow create 需要工作流 id',
      diff: 'workflow diff 需要工作流 id',
      'dry-run': 'workflow dry-run 需要工作流 id'
    })
  })
});

/**
 * （WP-6 越权申报）AC-04 / AC-12 / AC-53 / AC-58 的逐字文案在 WP-5 交付的表中缺失
 * （`派生自：`、契约 side 的`来源/去处`、`内置角色只读：`）。按 M-6 的字母口径
 * 「既有表一个键都不加不改」另立新表承载，仅供 WP-6 新代码引用；既有表零改动。
 */
export const ROLE_WRITE_SUPPLEMENT = Object.freeze({
  showDerived: '  派生自：{from}',
  contractSide: Object.freeze({ source: '来源', destination: '去处' }),
  builtinReadonly: '内置角色只读：{id}',
  unknownField: '未知字段：{key}',
  unsetRequired: 'role edit 不能删除必填字段：{key}'
});
