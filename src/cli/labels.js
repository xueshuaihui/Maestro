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
  'workspace.status_write_failed': '状态页写入失败',
  // I1.12 WP-7 / decision A-4 / decision D-3: a normal enumerable key. All
  // pre-existing keys above stay byte-for-byte unchanged (incl. wake.rejected).
  'wake.not-whitelisted': '越权唤醒被拒绝'
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

// ---------------------------------------------------------------- I1.7 WP-5 新增（仅追加 7 键，既有键零改动；M-6 口径）

/**
 * AC-12：code 角色「分支名」片段模板。渲染时由调用方经 `{role}` / `{branch}` 占位替换填入
 * （`replaceAll` / `applyPlaceholders` 白名单），本文件是唯一中文来源。
 */
export const CODE_ROLE_BRANCH = '{role} 分支 {branch}';

/** AC-12：合并状态四态（合并待执行 / 合并中 / 已合并 / 冲突待升级）。 */
export const MERGE_PENDING = '合并待执行';
export const MERGE_MERGING = '合并中';
export const MERGE_MERGED = '已合并';
export const MERGE_CONFLICT = '冲突待升级';

/** AC-08/AC-09/AC-13/AC-14：合并冲突 / worktree 创建失败的升级原因中文（复用 I1.4 升级渲染通道）。 */
export const ESCALATION_REASON_MERGE_CONFLICT = '合并冲突';
export const ESCALATION_REASON_WORKTREE_INIT_FAILED = 'worktree/分支创建失败';

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
    }),
    bodyFileMissing: '正文文件不存在：{file}'
  })
});

/** `skill create` 不给 `--body-file` 时的默认正文（A-7 逐字；`skills.js` 取用）。 */
export const SKILL_DEFAULT_BODY = Object.freeze(
  '### 工作方法\n\n1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。\n'
);

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

// ---------------------------------------------------------------- I1.9 WP-4 新增（只在文件末尾追加；既有键零改动）
//
// 中文逐字取需求 v7 附录 A-1~A-14：健康度（A-6 / A-6 附 / A-8）、追踪
// （A-1~A-5 / A-10 / A-11）、执行摘要（A-4 / A-12 / A-14）、事件跳过行（A-13）。
// 占位符沿用既有 `{n}` / `{role}` / `{id}` 风格。按本 WP 硬约束，所有新增导出
// 统一 `Object.freeze`（标量经 Object.freeze 返回原字符串，isFrozen 为 true）。
// 既有 `LAYER` 是文件前半部分的冻结表、禁止改动，故 `LAYER.health` 的层名
// 另立 `LAYER_HEALTH` 承载（见回执④）。

/** 四档健康度词（A-0 / A-6；码值与 src/core/health.js 的 HEALTH_LEVELS 一致）。 */
export const HEALTH_LABEL = Object.freeze({
  normal: '正常',
  slow: '慢',
  attention: '需关注',
  ended: '已结束'
});

/** 健康度行模板：无原因 `健康度 {level}`，带原因以 ` · ` 拼接（A-6 / A-6 附）。 */
export const HEALTH_LINE = Object.freeze({
  base: '健康度 {level}',
  withReasons: '健康度 {level} · {reasons}',
  sep: ' · '
});

/** 8 原因码 → 中文原因句（A-6 附 8 行逐字；码值与固定顺序见 D-3:968）。 */
export const HEALTH_REASON = Object.freeze({
  pending_escalation: '有待处理升级',
  node_timeout: '节点 {nodeId} 执行超时',
  session_crash: '会话 {sessionId} 崩溃',
  role_unavailable: '角色 {role} 不可用',
  connection_rejected: '连接线 {connection} 已拒绝',
  connection_expired: '连接线 {connection} 已过期',
  p90_exceeded: '节点 {nodeId} 执行超过本实例 P90',
  handoff_ttl_half: '交接包 {handoffId} 待投递超过 TTL 一半'
});

/** A-8 健康度变化事件文本行（档位取 HEALTH_LABEL、原因取 HEALTH_REASON）。 */
export const HEALTH_EVENT_LINE = Object.freeze(
  '{layer} {instanceId}  {from} → {to}  原因 {reasons}'
);

/** `LAYER.health = '健康度'` 的独立承载（既有 LAYER 冻结表零改动）。 */
export const LAYER_HEALTH = Object.freeze({ health: '健康度' });

// ---- 追踪：A-1 / A-2 / A-3 / A-5 / A-10 / A-11 ----

export const TRACE_HEADER = Object.freeze('实例 {instanceId} · 追踪 {traceId}');
export const TRACE_EMPTY_LINE = Object.freeze('实例 {instanceId} · 暂无追踪记录');
export const TRACE_MISSING_LINE = Object.freeze('实例 {instanceId} · 不存在');
export const TRACE_SUMMARY = Object.freeze('跨度 {spans} 条 · 回流 {backflows} 次');
export const TRACE_SPAN = Object.freeze('{start} → {end}  {node}  {result}  交接 {handoffs}');
export const TRACE_BACKFLOW_HEADER = Object.freeze('回流链');
export const TRACE_BACKFLOW_ROW = Object.freeze('第 {round} 轮  {from} → {to}  {handoff}  {state}');

/** 三种空形态提示与降级提示（A-9 / A-1 / A-2 / A-5 / A-10 / A-11）。 */
export const TRACE_EMPTY = Object.freeze('暂无追踪记录');
export const TRACE_NO_BACKFLOW = Object.freeze('无');
export const INSTANCE_MISSING = Object.freeze('不存在');
export const TRACE_RUNNING = Object.freeze('进行中');
export const TRACE_NO_END = Object.freeze('—');
export const TRACE_DEGRADED = Object.freeze('追踪记录有 {n} 行不可读，已跳过');

// ---- 执行摘要：A-4 / A-12 / A-14 ----

/** 四要素标签与缺项值（A-4 / A-12 / A-14 逐字）。 */
export const SUMMARY_LABEL = Object.freeze({
  command: '命令',
  exitCode: '退出码',
  keyOutput: '关键输出',
  log: '日志',
  unavailable: '未提供'
});

/** 关键输出行数带单位（A-0 单位「行」）；缺项由 SUMMARY_LABEL.unavailable 顶替。 */
export const SUMMARY_OUTPUT_LINES = Object.freeze('{n} 行');

/** A-4 失败摘要行（trace 跨度下方，两空格缩进）。 */
export const SUMMARY_FAIL_LINE = Object.freeze(
  '  失败摘要 命令 {command} · 退出码 {exitCode} · 关键输出 {keyOutput} · 日志 {log}'
);

/** A-12 / A-14 执行摘要行（同一行模板；四项取值与 A-4 一致、缺项 未提供）。 */
export const SUMMARY_LOG_LINE = Object.freeze(
  '{ts}  {layer} {sessionId}  执行摘要 命令 {command} · 退出码 {exitCode} · 关键输出 {keyOutput} · 日志 {log}'
);

// ---- 事件不可读行：A-13 ----

export const EVENTS_SKIPPED = Object.freeze('已跳过 {n} 行不可读记录');

// ===========================================================================
// I1.12 WP-7 — user-visible text for the three new commands and all governance
// decisions (requirement appendix A-0 ~ A-7). This file is the ONLY source of
// user-visible Chinese: capability modules carry frozen ASCII keys only and
// throw when a required key is absent (decision C item 3), never falling back
// to a hardcoded literal. Existing frozen baselines above are untouched.
// ===========================================================================

/** A-0 vocabulary: the 24 user-visible新增 terms, single source of truth. */
export const I112_VOCAB = Object.freeze({
  chainComplete: '链完整',
  chainBroken: '链已断',
  firstMismatch: '第一条失配',
  countSuffix: '共 N 条',
  wakeNotWhitelisted: '越权唤醒被拒绝',
  evidenceMismatch: '证据与声明产物不一致',
  evidenceMissing: '证据缺失',
  handoffRejected: '已拒绝交接',
  highRiskNoReview: '高风险节点下游缺少人工终审',
  needsHumanReview: '需要人工终审',
  budgetExhausted: '预算耗尽',
  suspended: '已挂起',
  noMigration: '无需迁移',
  signatureValid: '签名有效',
  versionCompatible: '版本兼容',
  signatureInvalid: '签名无效',
  versionIncompatible: '版本不兼容',
  docBottleneck: '文档瓶颈',
  serializationRegression: '串行化退化',
  confirmationBias: '确认偏误',
  insufficientData: '数据不足',
  perfPending: '待本机实测',
  perfReal: '已实测（真实宿主面）',
  perfMock: 'mock 实测',
});

/** A-1 / A-2 frozen keys from audit-verify.js::CHAIN_LABEL_KEYS. */
export const CHAIN_COMPLETE = '链完整，共 [N] 条';
export const CHAIN_BROKEN = '链已断：第 [N] 条记录与前一条指纹不匹配';

/** A-3 ~ A-5 governance decision lines (variable placeholders per A-0). */
export const WAKE_NOT_WHITELISTED_TEXT = '[角色甲] → [角色丙]  越权唤醒被拒绝  [原因：不在唤醒白名单]';
export const EVIDENCE_STALE_MISMATCH = '交接 [HO-ID]  已拒绝交接  [证据与声明产物不一致]';
export const EVIDENCE_STALE_MISSING = '交接 [HO-ID]  已拒绝交接  [证据缺失]';
export const HIGH_RISK_MISSING_REVIEW = '工作流 [名称]  校验未通过  [高风险节点 [节点] 下游缺少人工终审]';
export const BUDGET_EXHAUSTED = '实例 [实例]  已挂起  [预算耗尽]';

/** A-6 import / migration result keys (pack.js::LABEL_KEYS, flat). */
export const PACK_IMPORT_OK = '导入成功  [签名有效 · 版本兼容]';
export const PACK_SIGNATURE_INVALID = '导入被拒绝  [签名无效]';
export const PACK_VERSION_INCOMPATIBLE = '导入被拒绝  [版本不兼容]';
export const PACK_BUILD_CYCLE = '导出被拒绝  [依赖缺失或派生链循环]';
export const PACK_BUILD_MISSING = '导出被拒绝  [依赖缺失]';
export const MIGRATE_LIST = '{file}  {field}  {name}  {from} → {to}';
export const MIGRATE_NONE = '无需迁移，资产已是最新';
export const MIGRATE_DONE = '迁移完成  共 [N] 处引用已升级';
export const MIGRATE_BAD_REFERENCE = '迁移被拒绝  [{code}]';

/**
 * migrate.js camelCase table (MIGRATE_TEXT.*). Its ASCII render contract is
 * pinned by `test/wp15/migrate.test.js` (MIGRATE prefix / MIGRATION DONE ...),
 * so the values are the frozen fallback templates; the A-6 Chinese result
 * wording is carried by the flat MIGRATE_NONE / MIGRATE_DONE keys above.
 */
export const MIGRATE_TEXT = Object.freeze({
  migrateRow: 'MIGRATE {file} {field} {name} {from} {to}',
  migrateNone: 'NO MIGRATION NEEDED',
  migrateDone: 'MIGRATION DONE {N} REFERENCES UPGRADED',
  migrateCancelled: 'MIGRATION CANCELLED',
  migrateBadReference: 'MIGRATION REJECTED {code}',
});

/**
 * otel.js table (OTEL_TEXT.* / EXPORT_TEXT.*), S-04. ASCII render contract is
 * pinned by `test/wp15/otel-export.test.js` (noCjk + EXPORT OK prefix).
 */
export const OTEL_TEXT = Object.freeze({
  EXPORT_DONE: 'EXPORT OK EVENTS {events} SPANS {spans} -> {out}',
  EXPORT_FAILED: 'EXPORT FAILED {code}',
  EXPORT_USAGE: 'EXPORT USAGE <events|traces|pack>',
});

/** A-7 antipattern signal keys (antipattern.js::SIGNAL_DETAIL_KEYS, flat). */
export const SIGNAL_DOC_BOTTLENECK = '[实例]  [节点]  文档瓶颈：文档类节点长时间停留在待校验';
export const SIGNAL_SERIALIZATION_REGRESSION = '[实例]  [节点]  串行化退化：本可并行的节点被串行执行';
export const SIGNAL_CONFIRMATION_BIAS = '[实例]  [节点]  确认偏误：审核结论与上游一致且无独立证据';
export const SIGNAL_INSUFFICIENT_DATA = '[实例]  数据不足，无法判定反模式信号';

/** A-0 / A-7 performance evidence levels (perf-baseline.js machine keys). */
export const PERF_LEVEL_MOCK = 'mock 实测';
export const PERF_LEVEL_REAL = '已实测（真实宿主面）';
export const PERF_LEVEL_PENDING = '待本机实测';
export const PERF_EVIDENCE_LINE = '性能证据：handoff 延迟 [值]  ·  证据级别 [mock 实测 | 已实测（真实宿主面） | 待本机实测]';

/** verify.js review-pass line (no A literal; labels-owned). */
export const VERIFY_REVIEW_PASSED = '校验通过';

/** notImplemented parity with the two frozen family modules (main.js wiring). */
export const VERIFY_CLI_TEXT = Object.freeze({ notImplemented: 'verify 命令尚未实现' });
export const MIGRATE_CLI_TEXT = Object.freeze({ notImplemented: 'migrate 命令尚未实现' });
export const EXPORT_CLI_TEXT = Object.freeze({ notImplemented: 'export 命令尚未实现' });

/**
 * I1.12 independent usage block (D-13 / decision A item 2): the existing 25
 * `USAGE_LINES` above are byte-for-byte frozen (`AC-22` pins length === 25).
 * The three new commands are registered separately (I1.10a 裁决口径 "单独登记"),
 * so `--help`'s first 25 lines stay identical while the new block is available
 * to the new handlers via labels.js only.
 */
export const USAGE_LINES_I112 = Object.freeze([
  '  orch verify <实例> [--instance <实例号>]',
  '  orch verify <包> --package [--public-key <文件>]',
  '  orch verify import <包> [--public-key <文件>]',
  '  orch verify review <工作流>',
  '  orch migrate [--yes] [--backup <目录>]',
  '  orch export <events|traces|pack> [--out <文件>] [--instance <实例号>]',
]);
// ---------------------------------------------------------------- I1.11 新增（WP-7，只在文件末尾追加；既有键零改动）
//
// 附录 A-11 的桌面文案键（中文逐字基线 = 需求附录 A-1 ~ A-9；`{xx}` 为字面占位
// 符，替换时不做转义加工）。六个守护进程投影模块（notify / prefs / queue /
// assets-view / occupancy / canvas / evidence）的模块内字面量全部改为本表的
// import（BR-26 中文唯一来源）；桌面界面与壳层经 /ui/labels 与 config.rs 消费。

// ---- A-1 通知标题与正文（五段固定段序的段词；合并形态） ----

export const DESKTOP_NOTIFY_TITLE_PREFIX = Object.freeze('通知');
export const DESKTOP_NOTIFY_CATEGORY_ESCALATION = Object.freeze('升级待处理');
export const DESKTOP_NOTIFY_CATEGORY_COMPLETED = Object.freeze('实例完成');
export const DESKTOP_NOTIFY_CATEGORY_ANOMALY = Object.freeze('实例异常');
export const DESKTOP_NOTIFY_SEG_INSTANCE = Object.freeze('实例');
export const DESKTOP_NOTIFY_SEG_ESCALATION = Object.freeze('升级');
export const DESKTOP_NOTIFY_SEG_NODE = Object.freeze('节点');
export const DESKTOP_NOTIFY_SEG_ROUND_PREFIX = Object.freeze('第');
export const DESKTOP_NOTIFY_SEG_ROUND_SUFFIX = Object.freeze('轮');
export const DESKTOP_NOTIFY_SEG_MISSING = Object.freeze('—');
export const DESKTOP_NOTIFY_SEG_SEPARATOR = Object.freeze(' · ');
export const DESKTOP_NOTIFY_MERGE_COUNT_PREFIX = Object.freeze('共');
export const DESKTOP_NOTIFY_MERGE_COUNT_SUFFIX = Object.freeze('次');
export const DESKTOP_NOTIFY_MERGE_LATEST_PREFIX = Object.freeze('最近：');

// ---- A-2 通知开关与失效提示 ----

export const DESKTOP_NOTIFY_TOGGLE = Object.freeze('通知');
export const DESKTOP_NOTIFY_TOGGLE_ESCALATION = Object.freeze('升级待处理');
export const DESKTOP_NOTIFY_TOGGLE_COMPLETED = Object.freeze('实例完成');
export const DESKTOP_NOTIFY_TOGGLE_ANOMALY = Object.freeze('实例异常');
export const DESKTOP_NOTIFY_UNAVAILABLE = Object.freeze('通知不可用 · 队列仍可用');

// ---- A-3 队列行、空态与降级标注 ----

export const DESKTOP_QUEUE_ROW_ESC = Object.freeze(
  '升级 {id} · 实例 {instanceId} · 节点 {nodeId} {role} · 第 {round} 轮 · {state} · {reason} · {createdAt}'
);
export const DESKTOP_QUEUE_ROW_APR = Object.freeze(
  '审批 {id} · 实例 {instanceId} · 节点 {nodeId} {role} · 第 {round} 轮 · {state} · 动作 {action} · {createdAt}'
);
export const DESKTOP_QUEUE_EMPTY = Object.freeze('暂无待处理项');
export const DESKTOP_QUEUE_DISCONNECTED = Object.freeze('已断开 · 正在重连…');
export const DESKTOP_QUEUE_ROW_STATE_UNREADABLE = Object.freeze('实例 {id} · 状态不可读');
export const DESKTOP_QUEUE_STATE_UNREADABLE = Object.freeze('状态不可读');

// ---- A-4 五种动作、确认与结果 ----

export const DESKTOP_QUEUE_ACTION_PREFIX = Object.freeze('动作');
export const DESKTOP_QUEUE_ACTION_PASS = Object.freeze('继续');
export const DESKTOP_QUEUE_ACTION_RETRY = Object.freeze('重派');
export const DESKTOP_QUEUE_ACTION_CANCEL = Object.freeze('终止');
export const DESKTOP_QUEUE_ACTION_ALLOW = Object.freeze('允许');
export const DESKTOP_QUEUE_ACTION_DENY = Object.freeze('拒绝');
export const DESKTOP_QUEUE_CONFIRM_CANCEL = Object.freeze('终止实例 {id}？终止后该实例不再继续');
export const DESKTOP_QUEUE_CONFIRM_OK = Object.freeze('终止');
export const DESKTOP_QUEUE_CONFIRM_DISMISS = Object.freeze('取消');
export const DESKTOP_QUEUE_RESULT_ESCALATION = Object.freeze('升级 {id} 已处理（{conclusion}）');
export const DESKTOP_QUEUE_RESULT_CANCELLED = Object.freeze('实例 {id} 已取消');
export const DESKTOP_QUEUE_RESULT_APPROVAL = Object.freeze('审批 {id} {conclusion} · 动作 {action}');
export const DESKTOP_QUEUE_ALREADY_RESOLVED = Object.freeze('已处理（{conclusion}），无需再次处理');
export const DESKTOP_QUEUE_DISABLED_HINT = Object.freeze('该升级只能重派或终止');
export const DESKTOP_QUEUE_ACTION_UNSUPPORTED = Object.freeze('升级 {id} 不支持该动作');

/** D-3 错误映射表的固定结论词（键 = 核心错误码；「已处理（{结论}）」模板取值）。 */
export const DESKTOP_QUEUE_CONCLUSIONS = Object.freeze({
  ESCALATION_NOT_PENDING: '已处理',
  INSTANCE_NOT_SUSPENDED: '不是挂起状态',
  APPROVAL_NOT_PENDING: '已处理',
  APPROVAL_SESSION_GONE: '已失效'
});

// ---- A-5 资产库（行、计数、详情、异常） ----

export const DESKTOP_ASSET_SOURCE_BUILTIN = Object.freeze('内置');
export const DESKTOP_ASSET_SOURCE_PROJECT = Object.freeze('项目');
export const DESKTOP_ASSET_BUILTIN_FILE_PREFIX = Object.freeze('内置 ');
export const DESKTOP_ASSET_VALIDATION_PASS = Object.freeze('通过');
export const DESKTOP_ASSET_VALIDATION_FAIL = Object.freeze('不通过');
export const DESKTOP_ASSET_VALIDATION_UNKNOWN = Object.freeze('未校验');
export const DESKTOP_ASSET_VALIDATION_UNREADABLE = Object.freeze('不可读');
export const DESKTOP_ASSET_MISSING = Object.freeze('缺失');
export const DESKTOP_ASSET_KIND_ROLES = Object.freeze('角色');
export const DESKTOP_ASSET_KIND_SKILLS = Object.freeze('技能');
export const DESKTOP_ASSET_KIND_WORKFLOWS = Object.freeze('工作流');
export const DESKTOP_ASSET_GROUP_PLACEHOLDER = Object.freeze('—');
export const DESKTOP_ASSET_UNREADABLE = Object.freeze('资产不可读 · {dir}');
export const DESKTOP_ASSET_ITEM_UNREADABLE = Object.freeze('{kind} {id} · 不可读');
export const DESKTOP_ASSET_ROW_ROLE = Object.freeze('角色 {name} · {group} · {source} · {validation}');
export const DESKTOP_ASSET_ROW_SKILL = Object.freeze('技能 {id} · {group} · {source} · 命令 {n} · {validation}');
export const DESKTOP_ASSET_ROW_WORKFLOW = Object.freeze('工作流 {name} · {source} · {nodes} 节点 · {edges} 条边 · {validation}');
export const DESKTOP_ASSET_COUNT = Object.freeze('{kind} {total} 个（内置 {builtin} · 项目 {project}）');
export const DESKTOP_ASSET_DETAIL_ROLE_HEADER = Object.freeze(
  '角色 {name} · {group} · 产物 {artifact} · 副作用 {effect} · 并发 {n}'
);
export const DESKTOP_ASSET_DETAIL_ROLE_SKILLS = Object.freeze('技能 引用 {n} 个 · {list}');
export const DESKTOP_ASSET_DETAIL_TOOLS = Object.freeze('工具 {tools}');
export const DESKTOP_ASSET_DETAIL_WAKE = Object.freeze('唤醒 允许 {n} 个 · {list}');
export const DESKTOP_ASSET_DETAIL_SKILL_HEADER = Object.freeze('技能 {id} · {group} · 命令 {n}');
export const DESKTOP_ASSET_DETAIL_SUMMARY = Object.freeze('摘要 {summary}');
export const DESKTOP_ASSET_DETAIL_BODY = Object.freeze('正文 摘要 {n} 行');
export const DESKTOP_ASSET_DETAIL_WORKFLOW_HEADER = Object.freeze('工作流 {name} · {nodes} 节点 · {edges} 条边');
export const DESKTOP_ASSET_DETAIL_BACKFLOW = Object.freeze('回流 {n} 条');
export const DESKTOP_ASSET_DETAIL_VALIDATION = Object.freeze('校验 {validation}');

// ---- A-6 全局角色占用 ----

export const DESKTOP_OCCUPANCY_ROW = Object.freeze(
  '角色 {role} · {status} · 参与 {instances} 个实例 · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts}'
);
export const DESKTOP_OCCUPANCY_EMPTY = Object.freeze('暂无角色占用');
export const DESKTOP_OCCUPANCY_SKIPPED = Object.freeze('{n} 个实例状态不可读，已跳过');

// ---- A-7 工作流画布 ----

export const DESKTOP_CANVAS_TITLE = Object.freeze('工作流 {name} · 定义态 · {n} 节点 · {m} 条边');
export const DESKTOP_CANVAS_INVALID = Object.freeze('校验不通过');
export const DESKTOP_CANVAS_UNREADABLE = Object.freeze('定义不可读 · 仅显示可解析部分');
export const DESKTOP_CANVAS_EMPTY = Object.freeze('定义 空');
export const DESKTOP_CANVAS_SUBFLOW_ROW = Object.freeze('子工作流：{title} · {n} 角色');
export const DESKTOP_CANVAS_SUBFLOW_UNKNOWN = Object.freeze('子工作流 {id} · 角色数未知');

// ---- A-8 证据（命令 / 退出码 / 关键输出 / 日志四项标签复用 SUMMARY_LABEL） ----

export const DESKTOP_EVIDENCE_NODE_ROW = Object.freeze('节点 {id} · 第 {n} 轮');
export const DESKTOP_EVIDENCE_ARTIFACT = Object.freeze('产物');
export const DESKTOP_EVIDENCE_VERIFIED_AT = Object.freeze('校验于 {at}');
export const DESKTOP_EVIDENCE_UNPROVIDED = Object.freeze('未提供');
export const DESKTOP_EVIDENCE_LOG_ON_HOST = Object.freeze('完整日志留在宿主');
export const DESKTOP_EVIDENCE_UNREADABLE = Object.freeze('引用不可读');
export const DESKTOP_EVIDENCE_TRUNCATED = Object.freeze('体积超限已截断');

// ---- A-9 托盘信息行与暂停 ----

export const DESKTOP_TRAY_STATUS = Object.freeze('实例 {n} · 待处理升级 {m}');
export const DESKTOP_TRAY_STATUS_DISCONNECTED = Object.freeze('实例 — · 待处理升级 —');
export const DESKTOP_TRAY_PAUSE = Object.freeze('暂停');
export const DESKTOP_TRAY_RESUME = Object.freeze('继续');
export const DESKTOP_TRAY_PAUSE_SUMMARY = Object.freeze('{n} 个实例已暂停，{m} 个已跳过');
export const DESKTOP_TRAY_PAUSE_NONE = Object.freeze('没有可暂停的实例');

// ---- A-11 v9 五个新视图导航键（D-51 追加；经 /ui/labels 白名单下发） ----

export const DESKTOP_VIEW_QUEUE = Object.freeze('人工干预队列');
export const DESKTOP_VIEW_ASSETS = Object.freeze('角色与技能库');
export const DESKTOP_VIEW_OCCUPANCY = Object.freeze('角色占用');
export const DESKTOP_VIEW_CANVAS = Object.freeze('工作流画布');
export const DESKTOP_VIEW_EVIDENCE = Object.freeze('证据浏览');

// ===========================================================================
// I1.8 WP-5 — 实例恢复的用户可见文案（需求附录 A-1 ~ A-6 / A-10 逐字）。
//
// 纪律（M-6 / D-11）：
// 1. 只在文件末尾追加；上面所有既有表（六张状态表 / USAGE_LINES / REASON_LABEL …）
//    一个键都不加不改。
// 2. 本文件是中文唯一来源；`render.js` 与本迭代其它消费者只引用这里的键。
// 3. 恢复相关行只在实例带 `recoveredAt`（或对应数据）时由 `render.js` 追加；
//    非恢复路径的输出逐字不变（BR-44 / D-12）。
// 4. 占位符沿用既有 `{n}` / `{id}` / `{role}` 风格；A-3 / A-6 的模板逐字取自
//    需求附录，保留文档里的中文占位名（`{节点号}` / `{轮}` / `{上限}` …）。
//    `fill()` 同时接受文档占位名与 `nodeId` / `round` / `maxRounds` 等 ASCII 别名，
//    调用方不必手写中文键。
// 5. 所有新增常量一律 `Object.freeze`。
// ===========================================================================

/**
 * A-1 / D-2：节点「精确位置」显示词。`phase` 只允许出现在 `pending` / `running`
 * 上，故只有四个取值；缺省 `phase` 的旧节点仍走既有 `NODE_LABEL`（不改那张表）。
 */
export const NODE_PHASE_LABEL = Object.freeze({
  blocked: '待执行',
  ready: '待执行',
  assigned: '已分配',
  running: '执行中'
});

/** A-1：`orch instance graph` 节点行的条件后缀（已分配 / 人工节点等待人工）。 */
export const NODE_PHASE_SUFFIX = Object.freeze({
  assigned: '等待重新分配会话',
  human: '等待人工'
});

/**
 * A-2 / A-3 / A-4：恢复摘要、方言、角色 / 交接包 / 人工节点恢复、降级兜底与
 * 检查点写失败的逐字短语。`summary` 同时是 A-2 的状态行与 A-3 的第 1 行。
 */
export const RECOVERY_TEXT = Object.freeze({
  summary: '恢复：检查点 {HH:MM:SS} · 跳过 {N} 个已完成节点 · 轮次 {轮}/{上限}',
  sessionResume: '恢复：会话 {会话号} · session/resume（不回放）',
  sessionLoad: '恢复：会话 {会话号} · session/load（回放）',
  sessionNew: '恢复：会话 {会话号} · session/new（新建）',
  fallbackResumeToLoad: '恢复：session/resume 失败，回退 session/load（回放）',
  fallbackLoadToNew: '恢复：session/load 失败，回退 session/new（新建）',
  roleUnrecoverable: '恢复：角色 {角色中文名} · 服务中 → 可用（会话不可恢复）',
  roleRebuilt: '恢复：角色 {角色中文名} · 不可用 → 可用（会话已重建）',
  handoffCreated: '恢复：交接包 {包号} 已构造 → 继续投递',
  sessionReuse: '会话 复用 {会话号}（角色 {角色中文名}）',
  connectionRedeliver: '恢复：连接线 {方向} 已投递 → 待投递（重投）',
  humanHeld: '恢复：人工节点 {节点号} 保持等待人工（不重派）',
  recordFallback: '按实例记录恢复（可能重跑当前轮）',
  legacyNoCheckpoint: '旧实例无检查点：已中断（如需继续请新建实例）',
  failed: '恢复失败：{原因}；实例已中断（可执行 orch instance log 查看详情）',
  checkpointWriteFailed: '检查点写入失败：{原因}；本次进展已保存，崩溃恢复可能回退到上一个检查点',
  reverify: '重新核对：{节点号} · 证据重新校验（不重放会话）'
});

/** A-4：`orch instance graph` 的连接线聚合行（每条连接线一行）。 */
export const RECOVERY_GRAPH_TEXT = Object.freeze({
  connectionLine: '连接线：{方向} {聚合}'
});

/**
 * A-4 / D-6：连接线聚合状态 → 文本行里的显示词。优先级由核心重算，
 * 这里只负责逐字映射；`not_started` 与 I1.10 的既有桌面词一致（未开始）。
 */
export const CONNECTION_AGGREGATE_LABEL = Object.freeze({
  not_started: '未开始',
  rejected: '已拒绝',
  expired: '已过期',
  pending: '待投递（重投中）',
  delivered: '已投递',
  accepted: '已接受',
  consumed: '已完成'
});

/** A-6：会话崩溃 / 重建 / 运行慢 / 超时的五行逐字文案。 */
export const SESSION_FAILURE_TEXT = Object.freeze({
  crash: '会话进程已退出：正在重建会话（节点 {节点号} · 轮次 {轮}/{上限}）',
  rebuilt: '会话已重建 {会话号}（节点 {节点号} · 轮次 {轮}/{上限}）',
  rebuildFailed: '会话重建失败：已升级人工（节点 {节点号} · 轮次 {轮}/{上限}）',
  slow: '会话无进展：判定为运行慢，不重建会话（节点 {节点号} · 已等待 {N}m）',
  timeout: '节点 {节点号} 超时：按运行慢处理，已升级人工（节点 {节点号} · 轮次 {轮}/{上限}）'
});

/** A-5：`orch role show` 的会话复用行（只在角色显式声明 `session_policy` 时显示）。 */
export const ROLE_SESSION_POLICY_LINE = Object.freeze({
  reuse: '  会话复用：复用（reuse）',
  fresh: '  会话复用：每任务新会话（fresh）'
});

/** A-10：角色校验新原因码的明细文案（`ROLE_SESSION_POLICY_INVALID`）。 */
export const ROLE_SESSION_POLICY_INVALID = Object.freeze('会话复用策略不合法：{value}（可选 reuse / fresh）');

/**
 * 桌面 UI v2（beta.2）外壳文案（纯增量）。
 *
 * 只服务 `desktop/ui/shell/**` 的新外壳：侧栏分组、概览页、下钻抽屉、治理与
 * 设置页。现有 312 键一字未改，本表全部以 `DESKTOP_V2_` 前缀追加，经
 * `/ui/labels` 下发，桌面层不出现任何中文字面量。
 */
/** A1 (v2): Agent CLI discovery command wording. Single source of truth. */
export const CLI_DISCOVERY_TEXT = Object.freeze({
  TITLE: '本机 Agent CLI',
  SCANNED_AT: '扫描时间',
  NONE: '未发现可用的 Agent CLI',
  NONE_HINT: '请安装一个 Agent CLI（如 Codex / Claude Code / Gemini CLI）后重新扫描',
  USAGE: '用法：orch cli list|scan|probe <cli_id> [--format json]',
  UNKNOWN_SUB: '未知子命令：{sub}',
  NOT_FOUND: '未找到 CLI：{id}',
  SCAN_DONE: '扫描完成，发现 {n} 个 Agent CLI',
  COL_ID: '标识',
  COL_NAME: '名称',
  COL_VERSION: '版本',
  COL_PATH: '路径',
  COL_STATUS: '状态',
  COL_EVIDENCE: '来源',
  STATUS_IDLE: '可用',
  STATUS_CONNECTED: '已连接',
  STATUS_UNREACHABLE: '未就绪',
  STATUS_PROBING: '检测中',
  NOT_ON_PATH: '已安装但不在 PATH',
  PROBE_OK: '{name} 探测完成：ACP {acp}',
  PROBE_FAIL: '{name} 探测失败：{cause}',
  PROBE_ACP_YES: '支持',
  PROBE_ACP_NO: '不支持',
  SCAN_SAVED: '扫描结果已保存至 {path}',
  REGISTRY_INVALID: 'CLI 注册表格式不正确',
  // --- WP-4 additions: manual add, capability matrix, readable hints --------
  ADD_OK: '已添加 {name}  {path}',
  ADD_EXISTS: '已存在：{path}（未重复添加）',
  ADD_FAIL_EMPTY_NAME: '添加失败：名称为空',
  ADD_FAIL_EMPTY_PATH: '添加失败：路径为空',
  ADD_FAIL_NOT_FOUND: '添加失败：文件不存在',
  ADD_FAIL_NOT_EXECUTABLE: '添加失败：不可执行',
  HINT_ADD_PATH: '修复建议：可用 orch cli add --name <名称> --path <可执行路径> 手动登记该 CLI',
  MATRIX_TITLE: 'CLI 能力矩阵',
  MATRIX_SOURCES: '来源概览',
  MATRIX_COL_ACP: 'ACP',
  MATRIX_COL_TRANSPORT: 'stdio·transport',
  MATRIX_COL_RESUME_DIALECT: '会话恢复方言',
  MATRIX_COL_CONCURRENCY: '并发上限',
  MATRIX_COL_EVIDENCE_HOOK: '证据钩子',
  NOT_PROBED: '未探测',
  EVIDENCE_LEVEL_MOCK: 'mock 实测',
  EVIDENCE_LEVEL_PENDING: '待本机实测（需装有目标 CLI 的机器）',
  EVIDENCE_LEVEL_REAL: '已实测（真实宿主面）'
});

/** v2 A2~A6 studio wording. Single source of truth for every user-visible string. */
export const STUDIO_TEXT = Object.freeze({
  TITLE: '研发组织',
  USAGE: [
    '用法：',
    '  orch org init                                  初始化组织（六个部门）',
    '  orch org list [--format json]                  组织总览',
    '  orch org role add --name <名> --code <角色代码> --dept <部门> [--duty <职责>]',
    '  orch org role list [--format json]             角色清单',
    '  orch org emp add --name <名> --role <角色> --cli <cli_id> [--max-concurrent 2]',
    '  orch org emp list [--format json]              员工清单',
    '  orch org check [--format json]                 能力校验（角色所需能力 vs 员工 CLI）',
    '  orch org session open --emp <员工> [--task <说明>]',
    '  orch org session list|close <会话>',
    '  orch team create --name <名> --lead <角色> --roles <角色,角色> [--flow <工作流>] [--run-mode semi]',
    '  orch team list|show <团队>|check <团队>|export <团队>|remove <团队>',
    '  orch flow create --name <名> --template rd-12 [--run-mode semi]',
    '  orch flow create --name <名> --from <dag.json> 或 --stages <a:b,c|b:d>',
    '  orch flow list|show <工作流>|validate <工作流>|remove <工作流>',
    '  orch studio run --team <团队> [--flow <工作流>] [--mode plan|simulate|engine]',
    '  orch studio approve <run> [--stage <阶段>] [--reject]',
    '  orch studio list|show <run>|status|hosts',
    '  orch task list|move <任务> --to <状态>|exception <任务> --kind <类型>',
    '  orch task defect --run <run> --stage <阶段> --summary <描述> [--requirement]',
    '  orch task change --run <run> --stage <阶段> --summary <描述>    QA 发现需求缺失→退回产品评审',
    '  orch project add [<目录>] [--name <名>] | list | use <目录> | remove <项目>'
  ].join('\n'),
  UNKNOWN_SUB: '未知子命令：{sub}',
  UNKNOWN_FLAG: '未知参数：--{flag}',
  INIT_DONE: '组织已初始化：{departments} 个部门',
  INIT_EXISTS: '组织已存在，未重复初始化',
  NO_ROLES: '还没有角色。先执行：orch org role add --name 产品负责人 --code product-lead --dept product',
  NO_EMPLOYEES: '还没有员工。先执行：orch org emp add --name 张三 --role product-lead --cli <cli_id>',
  NO_TEAMS: '还没有团队。先执行：orch team create --name 核心研发团队 --lead eng-lead --roles product-lead,eng-lead',
  NO_FLOWS: '还没有工作流。先执行：orch flow create --name 研发流程 --template rd-12',
  NO_RUNS: '还没有运行记录。先执行：orch studio run --team <团队>',
  ROLE_ADDED: '已创建角色：{id}（{name}）',
  ROLE_UPDATED: '已更新角色：{id}',
  ROLE_REMOVED: '已删除角色：{id}',
  EMP_ADDED: '已创建员工：{id}（{name}，角色 {role}，CLI {cli}）',
  EMP_UPDATED: '已更新员工：{id}',
  EMP_REMOVED: '已删除员工：{id}',
  SESSION_OPENED: '已创建会话：{id}（员工 {employee}，CLI {cli}，模式 {mode}）',
  SESSION_CLOSED: '已关闭会话：{id}',
  TEAM_CREATED: '已创建团队：{id}（{roles} 个角色，{employees} 名员工，运行模式 {mode}）',
  TEAM_UPDATED: '已更新团队：{id}',
  TEAM_REMOVED: '已删除团队：{id}',
  TEAM_READY: '团队 {id} 就绪：{roles} 个角色 / {employees} 名员工 / 覆盖阶段角色 {covered}',
  TEAM_NOT_READY: '团队 {id} 未就绪：{reason}',
  TEAM_EXPORTED: '已导出团队模板：{path}',
  FLOW_CREATED: '已创建工作流：{id}（{stages} 个阶段，{gates} 道门禁，{edges} 条依赖）',
  FLOW_VALID: '工作流 {id} 校验通过：{stages} 个阶段，入口 {entry}，出口 {terminal}',
  FLOW_INVALID: '工作流 {id} 校验失败：{reason}',
  FLOW_REMOVED: '已删除工作流：{id}',
  RUN_STARTED: '已创建运行：{id}（团队 {team}，工作流 {flow}，模式 {mode}）',
  RUN_STAGE_DONE: '  阶段 {stage} 完成，产物 {artifacts}',
  RUN_WAITING: '  门禁拦截：阶段 {stage} 需要 {gate} 审批（运行模式 {mode}）。继续：orch studio approve {run}',
  RUN_APPROVED: '  已批准阶段 {stage}，继续推进',
  RUN_REJECTED: '  已驳回阶段 {stage}，运行转入 blocked',
  RUN_COMPLETED: '运行 {id} 已完成：{stages} 个阶段，产物 {artifacts} 个文件，耗时 {ms}ms',
  RUN_PLANNED: '运行 {id} 已生成执行计划（未执行）',
  RUN_STATUS: '运行 {id}：{status}（{done}/{total} 阶段完成）',
  RUN_ENGINE_PREPARED: '已编译引擎资产：{count} 个文件（工作流 {flow}）',
  RUN_ENGINE_NO_HOST: '未检测到宿主配置，引擎未启动（非阻塞）。配置后可用：{path}',
  RUN_ENGINE_HOST_READY: '检测到宿主配置：{hosts}（真实会话驱动属 B1 续接）',
  RUN_UNKNOWN: '未找到运行：{id}',
  TASK_MOVED: '任务 {id} → {status}',
  TASK_EXCEPTION: '任务 {id} 记录异常：{kind}',
  TASK_NO_TASKS: '还没有任务。运行一次 orch studio run 会生成任务。',
  DEFECT_OPENED: '已登记缺陷：{id}（{severity}）',
  CHANGE_OPENED: '已开启变更评审：{id}（退回产品评审），任务 {task} 已置为 blocked',
  CHANGE_REVIEWED: '变更 {id} 结论：{status}',
  PROJECT_ADDED: '已登记项目：{id}（{root}）',
  PROJECT_LIST_EMPTY: '还没有登记项目。执行：orch project add .',
  PROJECT_USING: '当前项目：{id}（{root}）',
  PROJECT_REMOVED: '已移除项目：{id}',
  PROJECT_UNKNOWN: '未找到项目：{ref}',
  HOSTS_TITLE: '宿主能力矩阵',
  HOSTS_READY: '可直接承载：{n} 个 CLI',
  HOSTS_NONE: '未发现可执行 CLI（已安装但不在 PATH 的见 orch cli list）',
  COL_ID: 'ID',
  COL_NAME: '名称',
  COL_CODE: '角色代码',
  COL_DEPT: '部门',
  COL_EMPLOYEES: '员工数',
  COL_ROLE: '角色',
  COL_CLI: 'CLI',
  COL_MAX: '并发',
  COL_STATUS: '状态',
  COL_STAGE: '阶段',
  COL_GATE: '门禁',
  COL_ARTIFACTS: '产物',
  COL_ROLES: '角色',
  COL_TASK: '任务',
  COL_PROJECT: '项目',
  COL_ROOT: '目录',
  COL_CLI_ID: 'CLI',
  COL_ACP: 'ACP',
  MODE_AUTO: '全自动',
  MODE_SEMI: '半自动',
  MODE_MANUAL: '手动',
  MODE_PLAN: '仅计划',
  MODE_SIMULATE: '模拟执行',
  MODE_ENGINE: '引擎编译',
  GATE_PRD_FREEZE: 'PRD 冻结',
  GATE_ARCH_CONFIRM: '架构确认',
  GATE_RELEASE_APPROVE: '发布审批',
  GATE_NONE: '无',
  GATE_PENDING: '待审批',
  GATE_APPROVED: '已批准',
  GATE_AUTO: '自动放行',
  GATE_REJECTED: '已驳回',
  STAGE_PENDING: '待执行',
  STAGE_RUNNING: '执行中',
  STAGE_DONE: '已完成',
  STAGE_WAITING: '待审批',
  STAGE_BLOCKED: '阻塞',
  RUN_PLANNED_STATUS: '计划中',
  RUN_RUNNING_STATUS: '运行中',
  RUN_COMPLETED_STATUS: '已完成',
  RUN_WAITING_STATUS: '待审批',
  RUN_BLOCKED_STATUS: '阻塞',
  RUN_PREPARED_STATUS: '已编译待启动',
  TASK_TODO: '待处理',
  TASK_READY: '可领取',
  TASK_CLAIMED: '已领取',
  TASK_RUNNING: '进行中',
  TASK_REVIEW: '待评审',
  TASK_FIXING: '修改中',
  TASK_DONE: '已完成',
  TASK_BLOCKED: '阻塞',
  TASK_CANCELLED: '已取消',
  DEPT_PRODUCT: '产品部',
  DEPT_ENGINEERING_MANAGEMENT: '研发管理部',
  DEPT_FRONTEND: '前端部',
  DEPT_BACKEND: '后端部',
  DEPT_QA: '测试部',
  DEPT_PLATFORM_SECURITY: '平台安全部',
  STAGE_S01: '阶段1 产品构思与需求分析',
  STAGE_S02: '阶段2 PRD 评审与确认',
  STAGE_S03: '阶段3 技术架构与研发规划',
  STAGE_S04: '阶段4 技术方案评审',
  STAGE_S05: '阶段5 迭代启动与任务分配',
  STAGE_S06: '阶段6 并行研发',
  STAGE_S07: '阶段7 集成与联调',
  STAGE_S08: '阶段8 QA 测试',
  STAGE_S09: '阶段9 缺陷处理闭环',
  STAGE_S10: '阶段10 迭代验收',
  STAGE_S11: '阶段11 发布与交付',
  STAGE_S12: '阶段12 复盘与下一迭代',
  FLOW_RD12: '12 阶段研发工作流',
  ARTIFACT_PRD: 'PRD',
  ARTIFACT_RESEARCH_NOTES: '调研笔记',
  ARTIFACT_PRD_REVIEW: 'PRD 评审记录',
  ARTIFACT_ISSUE_LIST: '问题清单',
  ARTIFACT_ARCHITECTURE: '架构设计',
  ARTIFACT_API_CONTRACT: '接口契约',
  ARTIFACT_DATA_MODEL: '数据模型',
  ARTIFACT_ARCH_REVIEW: '架构评审记录',
  ARTIFACT_RISK_LIST: '风险清单',
  ARTIFACT_ITERATION_PLAN: '迭代计划',
  ARTIFACT_TASK_BREAKDOWN: '任务拆分',
  ARTIFACT_CODE: '代码',
  ARTIFACT_UNIT_TESTS: '单元测试',
  ARTIFACT_INTEGRATION_REPORT: '联调报告',
  ARTIFACT_TEST_PLAN: '测试计划',
  ARTIFACT_TEST_REPORT: '测试报告',
  ARTIFACT_DEFECT_LIST: '缺陷清单',
  ARTIFACT_FIX_RECORD: '修复记录',
  ARTIFACT_ACCEPTANCE_REPORT: '验收报告',
  ARTIFACT_RELEASE_RECORD: '发布记录',
  ARTIFACT_SMOKE_REPORT: '冒烟报告',
  ARTIFACT_RETROSPECTIVE: '复盘记录',
  ARTIFACT_NEXT_ITERATION_PLAN: '下一迭代计划',
  ROLE_PRODUCT_LEAD: '产品负责人',
  ROLE_PRODUCT_ANALYST: '产品分析师',
  ROLE_USER_RESEARCHER: '用户研究员',
  ROLE_COMPETITOR_ANALYST: '竞品分析师',
  ROLE_PRODUCT_REVIEWER: '产品评审员',
  ROLE_ENG_LEAD: '研发负责人',
  ROLE_ARCHITECT: '系统架构师',
  ROLE_TECH_REVIEWER: '技术评审员',
  ROLE_FRONTEND_LEAD: '前端负责人',
  ROLE_FRONTEND_DEV: '前端开发',
  ROLE_FRONTEND_REVIEWER: '前端审核员',
  ROLE_BACKEND_LEAD: '后端负责人',
  ROLE_BACKEND_DEV: '后端开发',
  ROLE_BACKEND_REVIEWER: '后端审核员',
  ROLE_QA_LEAD: 'QA 负责人',
  ROLE_QA_FUNCTIONAL: '功能测试',
  ROLE_QA_API: '接口测试',
  ROLE_QA_AUTOMATION: '自动化测试',
  ROLE_QA_PERFORMANCE: '性能测试',
  ROLE_QA_SECURITY: '安全测试',
  ROLE_DEVOPS: 'DevOps 工程师',
  ROLE_SECURITY_REVIEWER: '安全审核员',
  ROLE_DATA_ARCHITECT: '数据架构师',
  ROLE_DBA: '数据库专家',
  SEED_DONE: '已生成 {roles} 个角色、{employees} 名员工（CLI：{cli}）',
  SEED_SKIP: '组织已有角色，跳过初始化种子（用 --force 重建）',
  DEMO_DONE: '核心旅程已完成：{roles} 角色 / {employees} 员工 / {teams} 团队 / {flows} 工作流 / 运行 {run}',
  DEMO_HINT: '提示：未发现可执行 CLI，员工绑定 {{cli}} 占位；装好目标 CLI 后重新 orch cli scan 再用 orch org emp set 换绑',
  UI_STEP_CLI: '1 · Agent CLI',
  UI_STEP_ORG: '2 · 组织与角色',
  UI_ORG_HINT: '这里只统计本项目里已建的角色；内置角色在「角色与技能库」页，未加入项目时不会显示在这里。',
  UI_STUDIO_TO_INSTANCES: '查看实例',
  UI_STEP_TEAM: '3 · 团队',
  UI_STEP_FLOW: '4 · 工作流',
  UI_STEP_RUN: '5 · 运行与门禁',
  UI_STEP_TASK: '6 · 任务与变更',
  UI_SCAN: '扫描 CLI',
  UI_DEMO: '一键搭出示例团队',
  UI_REFRESH: '刷新',
  UI_ADD_ROLE: '添加角色',
  UI_ADD_EMP: '添加员工',
  UI_CREATE_TEAM: '创建团队',
  UI_CREATE_FLOW: '创建工作流',
  UI_START_RUN: '开始运行',
  UI_APPROVE: '批准',
  UI_CANVAS_ADD_STAGE: '新增阶段',
  UI_CANVAS_LINK: '连线',
  UI_CANVAS_LINK_ON: '连线中',
  UI_CANVAS_LINK_HINT: '选择起点与终点阶段，然后添加依赖',
  UI_CANVAS_ADD_EDGE: '添加依赖',
  UI_CANVAS_REMOVE_EDGE: '删除依赖',
  UI_CANVAS_REMOVE_STAGE: '删除阶段',
  UI_CANVAS_RESET_LAYOUT: '重置布局',
  UI_CANVAS_PROGRESS: '进度',
  UI_HOST_TITLE: '运行宿主',
  UI_HOST_NONE: '还没有绑定宿主：实例需要本机 Agent CLI 才能真正启动',
  UI_HOST_SCAN: '扫描本机 CLI',
  UI_HOST_READY: '可用',
  UI_HOST_UNUSABLE: '不可用',
  UI_HOST_NO_COMMAND: '未配置启动命令',
  UI_HOST_NO_EXEC: '本机没有找到可执行的 Agent CLI。装好后重新扫描，或手工写 .orch/hosts/<id>.json',
  UI_HOST_BIND: '绑定为宿主',
  UI_HOST_BOUND: '已绑定',
  UI_HOST_SCANNING: '正在扫描…',
  UI_START_TITLE: '从这里开始',
  UI_START_STEP_CLI: '第一步 · 连接本机 Agent',
  UI_START_STEP_FLOW: '第二步 · 选工作流',
  UI_START_STEP_TASK: '第三步 · 写任务并启动',
  UI_START_CLI_READY: '已连接',
  UI_START_CLI_ACTION: '扫描并连接本机 Agent',
  UI_START_CLI_BUSY: '正在扫描…',
  UI_START_STUDIO_LINK: '要搭自己的团队和工作流？去搭建台',
  UI_START_GO: '开始运行',
  UI_START_GO_BUSY: '正在启动…',
  UI_START_HINT: '三步完成后，实例会出现在这个页面，可从概览一路看到证据。',
  UI_START_ADVANCED: '高级设置（宿主 / 组织 / 角色）',
  UI_TASK_HINT_CODE_LOOP: '这个工作流要求任务里有一行「产物：<路径>」，例如 产物：calc.js',
  UI_TASK_HINT_TASK_LOOP: '这个工作流要求任务里有一行「产物：<文件名>.md」，例如 产物：release-notes.md',
  UI_CANVAS_RUN: '用这个流程运行',
  UI_CONTROL_SKIPPED: '该实例当前状态不允许这个操作',
  UI_SAVE: '保存',
  UI_CLOSE: '关闭',
  UI_REJECT: '驳回',
  UI_CHANGE: '登记需求缺失',
  UI_NAME: '名称',
  UI_CODE: '角色代码',
  UI_DEPT: '部门',
  UI_ROLE: '角色',
  UI_CLI: 'CLI',
  UI_FLOW: '工作流',
  UI_RUN_MODE: '运行模式',
  UI_LEAD: '负责人',
  UI_ROLES: '角色（多选）',
  UI_MODE: '模式',
  UI_EMPTY_CLI: '还没有可用 CLI：先点「扫描 CLI」，或安装一个 Agent CLI',
  UI_EMPTY_ROLE: '还没有角色：点「一键搭出示例团队」或手动添加',
  UI_EMPTY_TEAM: '还没有团队',
  UI_EMPTY_FLOW: '还没有工作流',
  UI_EMPTY_RUN: '还没有运行记录',
  UI_NEXT_STEP: '下一步',
  UI_BLOCKED: '未就绪',
  UI_READY: '就绪',
  UI_TASKS: '任务',
  UI_LOADING: '加载中',
  UI_TOKEN_MISSING: '未取得桌面令牌，请从应用内打开此页',
  UI_STAGES: '阶段',
  UI_EDGES: '依赖',
  UI_SELECT_PLACEHOLDER: '请选择',
  UI_CUSTOM_FLOW_HINT: '自定义 DAG 写法：s01:product-lead,product-analyst|s02:eng-lead（竖线分隔阶段，冒号后是角色代码）',
  UI_RUNNING_HINT: '运行完成后可在下方查看每个阶段的产物与门禁状态',
  UI_CHANGE_SUMMARY: '描述缺失的需求',
  UI_WARNINGS: '校验提示',
  UI_ERRORS: '校验错误',
  UI_OPEN_STUDIO: '打开搭建台',
  UI_DEMO_HINT2: '示例团队会生成 23 个角色、1 个工作流（12 阶段）、1 个团队，并模拟跑完一次迭代',
  ERR_ROLE_NAME_REQUIRED: '缺少角色名称（--name）',
  ERR_ROLE_CODE_UNKNOWN: '角色代码不在允许集合内：{code}',
  ERR_ROLE_UNKNOWN: '未找到角色：{role}',
  ERR_ROLE_IN_USE: '角色仍被引用，无法删除：{role}（员工 {employees} / 团队 {teams}）',
  ERR_EMPLOYEE_UNKNOWN: '未找到员工：{employee}',
  ERR_EMPLOYEE_BUSY: '员工仍有进行中的会话，无法删除：{employee}（{sessions} 个）',
  ERR_CLI_REQUIRED: '缺少 CLI 绑定（--cli <cli_id>）。先看可用 CLI：orch cli list',
  ERR_CLI_UNKNOWN: 'CLI 未在注册表中：{cli}。先执行 orch cli scan',
  ERR_CLI_UNREACHABLE: 'CLI 不可执行：{cli}（已安装但不在 PATH？）',
  ERR_CAPABILITY_MISMATCH: '能力不满足：员工 {employee} 绑定的 {cli} 缺少 {dimension}',
  ERR_CAPABILITY_UNPROBED: '能力未探测：{cli}（{dimension}），先执行 orch cli probe {cli}',
  ERR_DEPARTMENT_UNKNOWN: '未找到部门：{department}',
  ERR_TEAM_NAME_REQUIRED: '缺少团队名称（--name）',
  ERR_TEAM_NO_ROLE: '团队至少需要一个角色',
  ERR_TEAM_UNKNOWN: '未找到团队：{team}',
  ERR_TEAM_NOT_READY: '团队未就绪：{reason}',
  ERR_TEAM_LEAD_REMOVE: '不能移除团队负责人：{role}',
  ERR_TEAM_NO_FLOW: '团队尚未绑定工作流（--flow）',
  ERR_FLOW_SPEC_REQUIRED: '创建工作流需要 --template rd-12 或 --from/--stages',
  ERR_FLOW_INVALID: '工作流不合法：{reason}',
  ERR_FLOW_UNKNOWN: '未找到工作流：{flow}',
  ERR_FLOW_EXISTS: '工作流已存在：{id}',
  ERR_FLOW_IN_USE: '工作流仍被团队引用：{flow}（{teams} 个）',
  ERR_FLOW_CYCLE: '工作流存在环',
  ERR_FLOW_ROLE_UNCOVERED: '工作流需要的角色代码未被团队覆盖：{code}',
  ERR_FLOW_STAGE_NO_ROLE: '阶段缺少角色：{stage}',
  ERR_FLOW_NAME_REQUIRED: '工作流需要名称',
  ERR_FLOW_STAGE_UNKNOWN: '未找到阶段：{stage}',
  ERR_FLOW_STAGE_NAME_REQUIRED: '阶段需要名称：{stage}',
  ERR_FLOW_EDGE_INVALID: '依赖端点不存在：{from} -> {to}',
  ERR_FLOW_EDGE_SELF: '阶段不能依赖自身：{stage}',
  ERR_FLOW_EDGE_EXISTS: '依赖已存在：{from} -> {to}',
  ERR_FLOW_EDGE_UNKNOWN: '未找到依赖：{from} -> {to}',
  ERR_STUDIO_HOST_EXEC_MISSING: '宿主启动命令不存在：{path}',
  ERR_STUDIO_HOST_EXEC_INVALID: '宿主启动命令必须是可执行文件的绝对路径：{path}',
  ERR_STUDIO_HOST_EXEC_NOT_EXECUTABLE: '宿主启动命令没有执行权限：{path}',
  ERR_STUDIO_HOST_ID_INVALID: '宿主标识不合法（小写字母、数字、点、下划线、连字符）：{id}',
  ERR_STUDIO_HOST_ARGS_INVALID: '宿主启动参数不合法（{count} 个）',
  ERR_STUDIO_HOST_POLICY_INVALID: '审批策略不支持：{policy}',
  ERR_STUDIO_HOST_WRITE_FAILED: '宿主配置写入失败：{path}',
  ERR_STUDIO_HOST_UNKNOWN: '未找到宿主：{id}',
  ERR_RUN_UNKNOWN: '未找到运行：{id}',
  ERR_RUN_NO_GATE: '当前没有待审批的门禁',
  ERR_RUN_GATE_NOT_PENDING: '阶段 {stage} 不在待审批状态',
  ERR_RUN_MODE_UNKNOWN: '未知运行模式：{mode}（plan / simulate / engine）',
  ERR_TASK_UNKNOWN: '未找到任务：{task}',
  ERR_TASK_TRANSITION: '非法任务流转：{from} → {to}',
  ERR_TASK_STATUS_UNKNOWN: '未知任务状态：{status}',
  ERR_STUDIO_INVALID: '组织数据损坏：{path}（{cause}）',
  ERR_ID_INVALID: '无法生成合法标识：{name}',
  ERR_SKILL_ID_REQUIRED: '缺少技能标识（--id）',
  ERR_SKILL_NAME_REQUIRED: '缺少技能名称（--name）',
  ERR_SKILL_SUMMARY_REQUIRED: '缺少技能摘要（--summary）',
  ERR_SKILL_READONLY: '内置技能只读，不能覆盖：{id}',
  ERR_SKILL_EXISTS: '技能已存在：{id}（用 --force 覆盖）',
  ERR_SKILL_SCHEMA_MISSING: '缺少必填字段：{field}',
  ERR_SKILL_ID_MISMATCH: '技能 id 与目录名不一致：目录 {dirId} / 声明 {declaredId}',
  ERR_SKILL_GROUP_INVALID: '适用分组取值非法：{value}；合法取值：coordinator / research / writing / coding / ops',
  UI_DUTY: '职责',
  UI_SUMMARY: '摘要',
  UI_SKILLS: '技能',
  UI_INPUTS: '输入',
  UI_OUTPUTS: '输出',
  UI_REQUIRES_ACP: '要求 ACP',
  UI_EDIT_ROLE: '编辑角色',
  UI_SAVE_ROLE: '保存角色',
  UI_ADD_SKILL: '新建技能',
  UI_SKILL_ID: '技能标识',
  UI_SKILL_NAME: '技能名称',
  UI_APPLIES_TO: '适用分组',
  UI_COMMANDS: '命令',
  UI_BODY: '正文',
  UI_OPTION_UNSET: '不声明',
  UI_OPTION_REQUIRED: '要求',
  UI_OPTION_FORBIDDEN: '禁止',
  UI_EMPTY_SKILL: '还没有自定义技能',
  UI_SKILL_CREATED: '技能已创建：{id}',
  UI_DELETE: '删除',
  UI_DELETE_CONFIRM: '确定删除「{name}」吗？此操作会归档该资源。',
  UI_DELETED: '已归档：{name}',
  UI_RESTORE: '恢复',
  UI_ADD_DEPT: '新增部门',
  UI_DEPT_ID: '部门标识',
  UI_DEPT_NAME: '部门名称',
  UI_DEPT_CREATED: '部门已创建：{name}',
  UI_NO_DELETE: '该资源仍被引用，请先解除引用后再删除。',
  ERR_ACTION: '请给出子命令。{usage}'
});

export const DESKTOP_V2_LABEL = Object.freeze({
  DESKTOP_V2_TAB_OVERVIEW: '概览',
  DESKTOP_V2_NAV_STUDIO: '搭建台',
  DESKTOP_V2_NAV_AUDIT: '审计与治理',
  DESKTOP_V2_NAV_SETTINGS: '设置',
  DESKTOP_V2_SEARCH: '搜索实例、节点、页面',
  DESKTOP_V2_CMD_HINT: '输入页面、实例或节点编号…',
  DESKTOP_V2_NO_MATCH: '无匹配结果',
  DESKTOP_V2_COMMAND: '命令面板',
  DESKTOP_V2_FILTER_ALL: '全部',
  DESKTOP_V2_BACK: '返回',
  DESKTOP_V2_CLOSE: '关闭',
  DESKTOP_V2_RETRY: '重试',
  DESKTOP_V2_EMPTY: '暂无数据',
  DESKTOP_V2_LOADING: '加载中…',
  DESKTOP_V2_HEALTH: '健康度',
  DESKTOP_V2_PENDING: '待处理',
  DESKTOP_V2_NEXT: '下一步',
  DESKTOP_V2_TIMELINE: '时间线',
  DESKTOP_V2_SUMMARY: '事件摘要',
  DESKTOP_V2_EVIDENCE_REFS: '证据引用',
  DESKTOP_V2_HANDOFF_HISTORY: '交接包历史',
  DESKTOP_V2_ROLE_BAR: '角色栏',
  DESKTOP_V2_CARDS: '任务卡片',
  DESKTOP_V2_LOCAL_DAG: '局部图',
  DESKTOP_V2_DETAIL: '详情',
  DESKTOP_V2_SESSIONS: '活跃会话',
  DESKTOP_V2_SERVING: '服务节点',
  DESKTOP_V2_ROUND: '第 {n} 轮',
  DESKTOP_V2_ARTIFACTS: '产物',
  DESKTOP_V2_COPY: '复制',
  DESKTOP_V2_EXPORT: '导出',
  DESKTOP_V2_HASH_CHAIN: '链式哈希',
  DESKTOP_V2_PERMISSION_DENY: '越权拦截',
  DESKTOP_V2_EVIDENCE_EXPIRED: '证据过期',
  DESKTOP_V2_BUDGET: '预算配额',
  DESKTOP_V2_ANTIPATTERN: '反模式信号',
  DESKTOP_V2_EXPORT_OTEL: '导出追踪',
  DESKTOP_V2_AUDIT_STREAM: '审计事件流',
  DESKTOP_V2_SETTINGS_PROJECT: '项目',
  DESKTOP_V2_SETTINGS_HOST: '宿主',
  DESKTOP_V2_SETTINGS_NOTIFY: '通知',
  DESKTOP_V2_SETTINGS_INTERACTION: '交互',
  DESKTOP_V2_SETTINGS_RECOVERY: '恢复策略',
  DESKTOP_V2_SETTINGS_DATA: '数据目录',
  DESKTOP_V2_STATE: '状态',
  DESKTOP_V2_KIND: '类型',
  DESKTOP_V2_TIME: '时间',
  DESKTOP_V2_NODE: '节点',
  DESKTOP_V2_CHECKPOINT: '检查点',
  DESKTOP_V2_PAUSE: '暂停',
  DESKTOP_V2_RESUME: '继续',
  DESKTOP_V2_COUNT: '{n} 项',
  DESKTOP_V2_STAGE: '阶段',
  DESKTOP_V2_DURATION: '耗时',
  DESKTOP_V2_OPEN_INSTANCE: '打开实例',
  DESKTOP_V2_NEED_INSTANCE: '请先打开一个实例',
  DESKTOP_V2_CONNECTED: '已连接',
  DESKTOP_V2_NO_INSTANCE: '还没有实例，从右侧选择一个工作流开始',
  DESKTOP_V2_RUNS_TITLE: '工作流运行',
  DESKTOP_V2_RUNS_HINT: '由搭建台启动；点一条运行可在画布上查看阶段进度',
  DESKTOP_V2_RUNS_EMPTY: '还没有工作流运行；在搭建台选好团队与工作流后启动',
  DESKTOP_NEW_HOST_HINT: '本机还没有可用的 Agent CLI：先在搭建台扫描，再把员工绑定到可用的 CLI，然后重新启动。',
  DESKTOP_V2_SWITCH_PROJECT: '切换项目',
  DESKTOP_V2_HOST_NOTE: '编排核心随应用启动，同一项目下的实例共享一个会话池。',
  DESKTOP_V2_RECOVERY_TEXT: '状态每次变更即落盘，重启后从最新检查点恢复，已完成节点不重放。',
  DESKTOP_V2_OCCUPANCY_HINT: '角色占用只统计运行中的实例；启动实例后可在这里看到各角色的并发占用。',
  DESKTOP_V2_NOT_AVAILABLE: '—',
  DESKTOP_V2_GOVERNANCE_HINT: '治理计数来自实例证据链，当前还没有可汇总的证据。',
  DESKTOP_V2_NO_ANOMALY: '没有检测到异常信号',
  DESKTOP_V2_READ_ALL: '全部标记已读',
  DESKTOP_V2_SELECT_ITEM: '从左侧选择一个条目查看详情',
  DESKTOP_ASSET_FORK: '加入项目',
  DESKTOP_ASSET_FORKED: '已加入项目，可在搭建台编辑',
  DESKTOP_ASSET_DELETE: '删除项目副本',
  DESKTOP_ASSET_EDIT: '编辑',
  DESKTOP_INST_ARCHIVE: '归档',
  DESKTOP_INST_CLONE: '克隆',
  DESKTOP_INST_RENAME: '重命名',
  DESKTOP_INST_SAVE_TEMPLATE: '存为工作流',
  DESKTOP_INST_EXPORT: '下载追踪',
  DESKTOP_INST_ARCHIVED: '实例已归档',
  DESKTOP_INST_CLONED: '实例已克隆',
  DESKTOP_INST_RENAMED: '实例已重命名',
  DESKTOP_INST_TEMPLATE_SAVED: '已存为工作流模板',
  DESKTOP_INST_EXPORTED: '追踪数据已生成',
  DESKTOP_V2_NAV_RESOURCES: '资源平台',
  DESKTOP_V2_ARCHIVED: '已归档',
  // beta.4 menu redesign: one entry per job (section) and one tab per screen
  // inside it. Appended last so the frozen beta.2 prefix stays byte-identical.
  DESKTOP_SECTION_RUN: '运行',
  DESKTOP_SECTION_TEAM: '团队',
  DESKTOP_SECTION_FLOW: '流程',
  DESKTOP_SECTION_GOVERN: '治理',
  DESKTOP_SECTION_SETUP: '设置',
  DESKTOP_TAB_QUEUE: '待处理',
  DESKTOP_TAB_NOTIFY: '通知',
  DESKTOP_TAB_OCCUPANCY: '占用',
  DESKTOP_TAB_ORG: '组织',
  DESKTOP_TAB_RESOURCES: '资源库',
  DESKTOP_TAB_BUILTIN: '内置资产',
  DESKTOP_TAB_FLOWS: '工作流',
  DESKTOP_TAB_CANVAS: '画布',
  DESKTOP_TAB_AUDIT: '审计',
  DESKTOP_TAB_PROJECT: '项目',
  DESKTOP_TAB_PREFS: '偏好',
  DESKTOP_RES_DEPARTMENT: '部门',
  DESKTOP_RES_ROLE: '角色',
  DESKTOP_RES_SKILL: '技能',
  DESKTOP_RES_EMPLOYEE: '员工',
  DESKTOP_RES_TEAM: '团队',
  DESKTOP_RES_FLOW: '工作流',
  DESKTOP_RES_INSTANCE: '实例',
  DESKTOP_RES_RUN: '运行记录',
  DESKTOP_RES_HINT: '一页管理组织与流程资源：新建、归档、恢复、克隆。新建的资源立刻可以在团队和流程里选用。',
  DESKTOP_RES_NAME: '名称',
  DESKTOP_RES_CREATE: '新建',
  DESKTOP_RES_AUTO: '该类型由运行产生，不支持手动新建。',
  DESKTOP_RES_OPS: '操作',
  DESKTOP_RES_ORG_HINT: '角色、员工与团队在这张表里只做归档、恢复、克隆；新建请到组织搭建，那里能填角色代码、绑定 CLI。',
  DESKTOP_RES_GOTO_ORG: '去组织搭建',
  DESKTOP_RES_FLOW_HINT: '工作流带阶段与连线，新建入口在工作流页（可从内置研发流程复制一份）。',
  DESKTOP_RES_GOTO_FLOW: '去工作流页',
  DESKTOP_RES_CLONED: '已克隆：{name}',
  DESKTOP_RES_ARCHIVED: '已归档：{name}',
  DESKTOP_RES_RESTORED: '已恢复：{name}',
  DESKTOP_RES_READY: '可用',
  DESKTOP_RES_ARCHIVE: '归档',
  DESKTOP_RES_RESTORE: '恢复',
  DESKTOP_RES_CREATED: '已新建：{name}',
  DESKTOP_COL_ID: 'ID',
  DESKTOP_COL_NAME: '名称',
  DESKTOP_COL_STATUS: '状态',
  // Every label the shell asks for is delivered: an undelivered key renders an
  // empty header or an invisible button, which reads as "the feature is a
  // shell" even when the handler works.
  DESKTOP_ACTION_SKIPPED: '操作未完成，请重试',
  DESKTOP_CONFIRM_DELETE: '确定删除？资源会先归档，之后可以在「已归档」里恢复。',
  DESKTOP_HOST_NO_EXEC: '这个 CLI 没有可执行的入口命令，换一个或重新扫描。',
  DESKTOP_REF_BLOCKED: '该资源仍被引用，先解除引用再删除。',
  DESKTOP_FLOWS_HINT: '项目流程可以改，内置模板可以直接跑；打开画布看结构，运行则回到新建页填任务。',
  DESKTOP_FLOWS_NAME: '新流程名称（从内置研发流程复制）',
  DESKTOP_FLOWS_CREATE: '新建流程',
  DESKTOP_FLOWS_EMPTY: '还没有工作流。先新建一个，或在团队里创建角色与团队后回到这里。',
  DESKTOP_FLOWS_OPEN: '打开画布',
  DESKTOP_FLOWS_RUN: '运行',
  DESKTOP_FLOWS_COPY: '复制',
  DESKTOP_FLOWS_PROJECT: '项目',
  DESKTOP_FLOWS_BUILTIN: '内置',
  DESKTOP_FLOWS_STAGES: '{n} 阶段',
  DESKTOP_FLOWS_SOURCE: '来源',
  DESKTOP_FLOWS_CREATED: '已新建流程：{name}',
  DESKTOP_FLOWS_COPIED: '已复制流程',
  DESKTOP_FLOWS_CREATE_FAILED: '流程操作失败，请稍后重试',
  DESKTOP_FLOWS_NAME_REQUIRED: '请先填写流程名称'
});

/**
 * 文档占位名 → 调用方常用 ASCII 键的别名表。`{N}` 的取值按模板语境在 `fill()`
 * 内单独解析（`N` / `n` / `skipped` / `minutes`）。
 */
const PLACEHOLDER_ALIASES = Object.freeze({
  'HH:MM:SS': 'clock',
  '会话号': 'sessionId',
  '角色中文名': 'role',
  '包号': 'handoffId',
  '方向': 'direction',
  '原因': 'reason',
  '节点号': 'nodeId',
  '轮': 'round',
  '上限': 'maxRounds',
  '聚合': 'aggregateLabel'
});

/**
 * 占位替换（唯一实现；`render.js` 与本迭代消费者共用）。支持 `{name}` 形式的
 * 任意占位（含 `{HH:MM:SS}` / `{轮}` 这类非 `\w` 字符），未知占位替换为空串。
 *
 * @param {string} template
 * @param {object} [vars]
 * @returns {string}
 */
export function fill(template, vars = {}) {
  const values = vars && typeof vars === 'object' ? vars : {};
  return String(template).replace(/\{([^{}]+)\}/g, (match, key) => {
    let value = values[key];
    if (value === undefined || value === null) {
      const alias = PLACEHOLDER_ALIASES[key];
      if (alias) value = values[alias];
    }
    if ((value === undefined || value === null) && key === 'N') {
      value = values.N ?? values.n ?? values.skipped ?? values.minutes;
    }
    return value === undefined || value === null ? '' : String(value);
  });
}
