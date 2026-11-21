# I1.8 自主裁决台账

> 依据 `docs/templates/execution-template.md` §2.8。裁决优先级固定为：
> **AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状**。
> 代码现状排最后——它只能说明「以前怎么做」，不是标准。

## 一、S0 需求评审第 1 轮后（2026-11-09）

| 编号 | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| 裁-1 | 评审 F-02：需求把规划原文「实例管理器完整：**状态机**、轮次计数、检查点」写成了「状态位置」，并以「`NODE_STATES` 6 项」为 AC-01 机检锚点；评审实跑得 7 项，基线 §3.1 定义的是节点 **9 态** | ① 规划原文（`index.md:815`）逐字含「状态机」，不得换名收窄；② 基线 §3.1「节点状态（9 个，看板 7 列）」是本迭代的尺子；③ 代码现状（7 项 + 位置投影）优先级最低，只能用于说明实现映射 | §2.2 标题与正文**保留「状态机」语义**（不得改名规避）；用户可见位置以基线 **9 态**为准，代码 7 项 + 位置投影在附录 D-2 写清一一映射；AC-01 的机检锚点必须引用**真实项数 7** 并同时断言 9 态投影齐全（不得虚报 6 项）。B-11 按此定论，不再作为待裁决项 | `requirement.md` §2.2、AC-01、附录 D-2、附录 B-11 |
| 裁-2 | 评审建议项 F-24：附录 D-11 第三条架构扫描把范围从 I1.6 D-9 的**三文件**（`roles.js,skills.js,workflows.js`）收窄为 `roles.js` 单文件；撰写方自述「纳入即 18 处假失败」，评审实测 **34 处** | ① `index.md:711` 的回归红线明确沿用 I1.6 口径（D-9 四条命令）；② §1.2「完善需求只能补不能减」，判据不得因实现方便而收窄；③ 评审结论「非为让扫描变绿而收窄，但确为范围收窄」 | **恢复 I1.6 D-9 的三文件口径**（`--files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js`）；`render.js` / `main.js` / `labels.js` 合法持有模板名与角色名，**只在附录备注说明「不纳入及原因」**，不得写进扫描命令；不得为让扫描变绿去改这些文件的注释；第四条仍为零依赖（`dependencies` 键数 0），I1.6 的「零 CJK」若保留须单列为附加项 | `requirement.md` 附录 D-11、AC-54、§3.3 前置条件 |

## 二、S0 需求评审第 2 轮后（2026-11-09）

> 第 2 轮 `review-round2.md` 总判 FAIL（阻断 N-01/N-02，建议 N-03/N-04/N-05）；上轮 F-01~F-24 已闭合 23 条，F-01 主体已修但残留旧现场记为 N-01。

| 编号 | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| 裁-3 | 评审建议 N-03：基线 §3.2 会话 6 态含 `escalated`（`index.md:181`「已升级，等待人工 / 红色圆点」），需求全文只出现节点态 `escalated`，会话层逐词无落点 | ① 基线四层状态词不得混用也不得缺漏；② I1.8 新增「重建失败 → 升级人工」（C-13 / D-8）确实会走到该指示器；③ 本迭代**不新增会话枚举**，只是沿用基线既有显示，不构成夹带规划外能力 | 在 §2.8 与 C-09 补一句口径：**会话升级人工时沿用基线既有的「已升级」指示器（红色圆点），随节点「已升级」派生；本迭代不新增会话状态取值、不新增 CLI 输出**。因属既有输出，按附录 A 开头「只登记新增/变更输出」的口径**不进 A-3**，但要在 D-4 说明显示来源，避免验收方误判为新增文案 | `requirement.md` §2.8、C-09、D-4；附录 A 不改动 |
| 裁-4 | 评审建议 N-04：AC-54 只写「31 词表见 D-11」，与 §3.3#9「必须逐字复制完整 `--forbid` 词表，不得缩写」及 DoR-12 冲突 | ① `execution-template.md` §1.1 DoR-12 字面要求 AC 内写出完整词表；② I1.6 AC-51 的既有先例就是**在 AC 内逐字内嵌** D-9 词表与命令；③ 改 §3.3#9 措辞等于收窄判据，违反 §1.2「只能补不能减」 | 取评审**选项①**：AC-54 的「架构检查」段内嵌 D-11 的 `$COMMON`（31 词）/ `$NOCOORD`（30 词）定义与五条命令的**逐字副本**，与 D-11 保持一致；§3.3#9 一字不改。两份副本必须逐字相同，任何一侧修改都要同步 | `requirement.md` AC-54、附录 D-11（保持不动）；S3 用例须按 AC-54 正文取证 |
| 裁-5 | 评审建议 N-05：D-9「保持原样」段写 `:588~590`，实为 `:588~592` | 实读 `test/wp4/orchestrator.test.js:588~592` | 机械更正为 `:588~592`，其余已授权行号不动 | `requirement.md` 附录 D-9 一行 |

**N-01 / N-02 不另裁决**：按评审补法原样修（阻断级，不得改写成「已确认」）。版本 v2 → **v3**，附录 C 追加一行且头部版本同步。

## 三、S1 拆分前主控裁决（裁-6）

| 编号 | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| 裁-6 | 拆分 Agent 提出附录 B-09 待裁决：角色资产新增键的命名，需求 v3 原文用 `session_policy`（M-5 / BR-41 / AC-51 / D-13 / A-5 / A-10），代码现状 `ROLE_OPTIONAL_KEYS` 无该键、无既有命名可对照 | ① 裁决优先级「AC 的 Then/And > 附录 A 输出基线 > 附录 D 实现约束 > M/C 契约清单 > 规划文档 > 代码现状」，需求原文优先；② I1.6 角色资产既有键全为 snake_case（`wake_allow` / `derived_from` / `side_effect`），`session_policy` 与之一致；③ 改名会连带改 6 处需求正文、属需求修订，须重开 S0 评审循环，代价无收益 | **按需求原文 `session_policy` 落地，不改名为 `session_reuse`**；B-09 从「需评审裁决」改判「已裁决（不阻塞）」的动作**只在 S1 评审记录与本台账留痕**，需求正文 v3 一字不改。实现期在 `ROLE_KEY_ORDER` / `ROLE_OPTIONAL_KEYS` / `ROLE_ALIASES` 按拆分 §6 冻结点 5 落地，值域 `reuse|fresh`、缺省 `fresh` 不注入渲染 | `docs/iterations/iteration-8.md` §2/§4/§6（已据此冻结）；S2 WP-3/WP-5；S3 AC-51 取证。**需求正文不改动** |

**其余拆分 Agent 提请确认项**：B-07（检查点写失败告警继续）、B-08（未声明 timeout 不擅自失败）、B-12/B-13（显示口径）、补 `test/wp13/fixtures.test.js` —— 需求 v3 与附录 D 均已选定口径，按需求落地，不另裁决；AC-53 基线 992/988/4 与集成版 992/987/5 差 1 条按「失败集合差集 = 0 + 条数只增不减」处置，三主链逐字基线以集成版 `d4b0f94` 重建。

## 四、S1 拆分评审第 1 轮后（裁-7）

| 编号 | 触发点 | 依据 | 决定 | 影响面 |
|---|---|---|---|---|
| 裁-7 | 拆分评审 S-04：`docs/iterations/iteration-8.md` §8 仍把附录 B-09 表述为「需评审裁决 / 需主控书面确认」，与裁-6「已裁决（不阻塞）」留痕口径有张力 | ① 裁-6 已明确「改判动作只在 S1 评审记录与本台账留痕，**需求正文 v3 一字不改**」——拆分文档属 S1 产物，同步措辞不触需求；② §8 对齐声明须与裁决台账一致，否则实现期会误以为命名仍可选 | **同步 §8 措辞**：改为「已裁决（不阻塞）：按需求 `session_policy` 落地、不改名 `session_reuse`；需求正文 v3 一字不改」，并**如实登记**「附录 B 正文仍写『需评审裁决』（定稿文本不动），以 `decisions.md` 裁-6 为最终口径」。不新增需求条目、不改需求正文 | `docs/iterations/iteration-8.md` §8 两处；`review`/`split-review` 记录；需求正文零改动 |

## 五、S2 第 1 批（WP-1 / WP-2）实现口径确认（裁-8）

> 两个 WP 均无契约偏差，以下为主控对「实现比冻结口径略强 / 多一个可选形态」的书面确认，供 WP-4 接线与 S3 取证遵循；**需求 v3 与拆分文档均不改动**。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-8a | WP-1 `checkpointPath(root,id)` 由 `src/persistence/paths.js:52` 定义、`src/core/checkpoint.js` re-export 同一函数对象 | 符合拆分 §2.2 / D-3「唯一计算点」；多一个别名导出不构成偏差，接受 |
| 裁-8b | `checkpointId` 实现 = `state.rev` + `writeCheckpoint` 读前值强制 `max(入参, prior+1)` | 比冻结「随每次 `saveState()` 递增」略强，但 `rev` 始终与实例记录一致、正常流程下 `checkpointId===rev`；接受，不为对齐口径删保护 |
| 裁-8c | `loadCheckpoint` 把 ENOENT 与解析失败一并归 `CHECKPOINT_UNREADABLE`，不另设 `NOT_FOUND` | 需求 D-3 只定义该错误码，AC-05「检查点缺失按实例记录恢复」等价可用；接受 |
| 裁-8d | 检查点内 `nodes` / `handoffs` 按 D-3 样例投影为 `nodeId` / `handoffId`（非 `id`），`escalations` / `artifactRefs` 原样浅拷贝 | **WP-4 恢复读信封时必须按 D-3 字段名取**，不得按 `state.json` 的 `id` 取；此点写进 WP-4 任务书 |
| 裁-8e | WP-2 `resumeOrCreate` 增加**可选** `currentPrompt`（冻结的四个必需入参不变，缺省不自动发 prompt），`new` 兜底时由适配层代发当前轮一次 | **裁定 WP-4 接线采用「显式传 `currentPrompt`，由适配层代发一次」，WP-4 不得再自行重发**（否则 AC-21 的 `session/prompt` 变 2 次）；`resume` / `load` 成功后仍按 C-09 由 WP-4 依会话末态决定是否发，适配层一律不发 |
| 裁-8f | `canResume` / `canLoad` 既是 `normalizeCapabilities` 的布尔出参字段、又是模块级谓词导出；`initialize()` 增一行只读 `lastInitializeResult` 缓存 | 两者并存、初始化返回结构未变；接受，不收敛 |

**真实宿主面**：AC-25/26/27/57 本机无 DSH CLI，按 BR-48 判「阻塞」，WP-2 只做能力归一化与方言回退机检面，未用夹具冒充（留 WP-7 末批取证）。

## 六、S2 第 2 批（WP-5 / WP-6）实现口径确认（裁-9）

> 两个 WP 均无契约偏差，以下为主控对「实现比冻结口径更简 / 形态略有差异」的书面确认，供 WP-4 / WP-3 接线与 S3 取证遵循；**需求 v3 与拆分文档均不改动**。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-9a | WP-5 `NODE_PHASE_LABEL` 只有 4 个键（`blocked` / `ready` / `assigned` / `running`），不是 9 键表；9 个位置由 `nodeStateLabel()` 在缺省 `phase` 时回落既有 `NODE_LABEL` | 符合 D-2：`phase` 的取值域恰为这 4 个，9 态是 `state + phase` 投影。**不追加 5 个与 `NODE_LABEL` 同值的冗余键**；S3 按「9 位置全部可达、显示词逐字正确」取证，不按「表有 9 键」取证 |
| 裁-9b | A-7（`handoff list` / 状态块）未新增任何导出，沿用既有 `HANDOFF_LABEL.pending` + `HANDOFF_RETRY_SUFFIX` | 需求 A-7 明写「不改既有行格式、不新增字段」，恢复后的 `待投递` 与 `重投 n/2` 本已由既有常量承载。**接受，不视为漏项** |
| 裁-9c | 恢复摘要的数据来源 = `snapshot.recovery = {checkpointAt, skipped, round, maxRounds}`（与拆分 §3.4 冻结键同名）+ 缺省按节点推算兜底 | 键名与冻结契约一致。**约束 WP-4：必须显式设置 `recovery` 与 `recoveredAt` 两者**，不得只设 `recoveredAt`；否则 `maxRounds` 会退化为当前轮次、渲染出 `轮次 2/2` 而非 `2/3`。此条写进 WP-4 任务书 |
| 裁-9d | A-3 的「事件 → 文案行」映射未在 `render.js` 实现，留 `main.js`（WP-4）接线 | 拆分 §2.10 已把 `main.js` 归 WP-4；WP-5 只交付 17 条模板与 `fill()`，避免与 WP-4 重复输出。**接受** |
| 裁-9e | `renderGraphJson` 的 `nodes[]` 元素在节点带 `phase` 时透出 `phase` 键 | A-9 只冻结顶层 11 / 13 键，未冻结节点元素键集合；非 `phase` 节点（含全部既有内建快照）键集合逐字不变。**接受**；S3 按「非恢复实例节点形状逐字不变」取证 |
| 裁-9f | mock agent 的能力广告实际形态为 `{close:{},list:{},resume:{}}`，不是 `{close:true,...}` | 与既有 mock 及真实 DSH 的 ACP 能力形态一致；D-4 归一化用 `Boolean(...)`，两种形态等价；键集严格为 `close/list/resume` 且 `resume` 分支不含 `load`。**接受** |
| 裁-9g | `--prompt-failures` / `MAESTRO_MOCK_PROMPT_FAILURES` 增加第二个来源 `opts.promptFailures`，使场景模式也生效 | 缺省 0 时 `shouldFailPrompt(0, n)` 短路为 false，**既有场景分支逐字不变**；佐证：`test/wp11/fixture-delivery.test.js` 6/6、`test/wp13/**` 300 条（4 条既有红）、全量差集 0。**接受** |
| 裁-9h | 批次 2 首轮全量出现 `--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）` 红 | 失败原因是测试 `after` 钩子 `EBUSY: resource busy or locked, rmdir %TEMP%/maestro-wp7-hosterr-*`，堆栈指向沙箱 `node-safe-delete-shim.cjs`，**非产品逻辑**。隔离复跑 6/6 全绿（帧 `probe/i18-s2/flake-host-error.isolated.log`），第二次全量未复现。**按 flake 登记，不计新增红** |

## 七、S2 第 3 批（WP-4）、拆分遗漏补派与批次 3 实现口径（裁-10）

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-10a | **拆分遗漏**：`src/registry/role-instances.js`（202 行，计算角色「服务节点 / 活跃会话」派生视图）既不在 §2.16 边界守护清单，也不在任何 WP 的负责文件清单里；而 AC-28 的 Then 要求 `orch role show developer --instance <实例>` 显示 `服务节点 —` | **补派给 WP-3**（角色域：`role-schema.js` / `asset-write.js` / `roles.js` 同为角色域文件）。授权范围**仅限**「服务节点 / servingNodeId」判定按 9 位置收窄（`state='running' + phase='assigned'` 不算正在服务），**不得**改角色其它派生规则、不得改注册表加载顺序。理由：AC-28 是用户可见 Then，不能因拆分遗漏而缺项 |
| 裁-10b | WP-4 的 `transit` 把 phase 分支实现为「同一次 `saveState` 内同时写 `state` 与 `phase`」（`orchestrator.js:1016-1031`），`PHASE_EDGES` 恰为 D-2 的六组、`PHASE_TARGETS` 仅 `pending→[blocked,ready]` / `running→[assigned,running]` | 与 D-2「同一次 CAS、不得先写 phase 再写 state」逐字一致。**接受**，S3 按 AC-01 取证 9 位置可达 + 非法组合 `rejected / illegal_transition` 且磁盘不动 |
| 裁-10c | `selectReusableSession` 由 `orchestrator.js:145` 顶层导出并在返回对象中暴露，但 `main.js` 无调用点 | 拆分 §6 冻结点 10 只要求「唯一新增导出、供 WP-3 import」；派发路径在内核、不新增 CLI 命令（AC-55）。**接受**，WP-3 直接 `import { selectReusableSession }` 消费 |
| 裁-10d | 批次 3 全量首轮出现 3 条差集外红：`--host-error 早返回`、`三主链：无新增可见词`、`reconcileOnBoot：v2 旧 generation…` | 前两条隔离复跑全绿（`probe/i18-s2/flake-host-error.isolated.log`、`probe/i18-s2/wp4-three-chains.isolated.log` 8/8），为 Windows `EBUSY` 清理与三主链时序负载 flake，**不计新增红**；第三条是 **D-9 授权的预期红**（`test/wp4/orchestrator.test.js:585` 的 `core.gone` 断言），按拆分 §6 冻结点 8「改后必红是预期」留待 WP-7 末批改测试。二轮全量 **1908 / 1875 / 22 / 11**，差集恰为这一条 |
| 裁-10e | WP-4 自述的未完成项：AC-58（e2e 需 spawn + `SIGKILL` 冷启动）、AC-24（角色目录不可读整页降级，属基线既有红）、AC-35 的 `delivered→accepted` 段依赖宿主首帧 | **不在 S2 掩盖**：AC-58 由 S3 用 `recovery-driver.mjs --scenario e2e` 真实取证；AC-24 作为**基线既有红**登记（非 I1.8 引入，`014fa6a` 基线红名单已含同名项）；AC-35 的 `accepted` 段在 S3 说明「依赖宿主首帧、mock 适配器不发真实 turn 帧」，按 `pending→delivered` 判据取证。三条均写入 S4 报告 §5 观察项 |

## 八、S2 第 4 批（WP-3）实现口径确认与 flake 复核（裁-11）

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-11a | `ROLE_DIFF_KEYS`（`src/cli/roles.js`）未纳入 `session_policy`，`role diff` 不比较该键 | D-13 只点名 `DERIVE_INHERIT_KEYS` / `EDITABLE_KEYS` / `ROLE_ALIASES` / `ROLE_KEY_ORDER` / `ROLE_OPTIONAL_KEYS`，**未要求 diff 键集**。按「不夹带规划外能力」**不扩范围**；S4 报告 §5 登记为观察项 |
| 裁-11b | `role show --format json` 不新增 `session_policy` 键 | A-6 冻结「十键 role 对象」；需求只要求文本行可见（A-5）。**接受** |
| 裁-11c | AC-49 的复用行用角色 **id** 填充（`会话 复用 sess-003（角色 developer）`），而 `labels.RECOVERY_TEXT.sessionReuse` 的占位名写作「角色中文名」（WP-5 交付） | 裁决优先级「AC Then > 附录 A」：AC-49 原文逐字就是 `（角色 developer）`，**按 id 填充正确**。文案本身逐字未改，故 S3 不改 labels；**登记为观察项**（模板占位名与实际填充语义不符），S4 报告 §5 列明，避免后续误用中文名填充 |
| 裁-11d | 批次 4 全量 **1921 / 1885 pass / 25 fail / 11 skip**；新增红 4 条 | 拆解：`declares nine required role keys and five optional ones`（`test/wp11/role-schema.test.js:57`）与 `reconcileOnBoot：v2 旧 generation…`（`test/wp4/orchestrator.test.js:585`）**均为 D-9 授权预期红**；`--host-error 早返回` 与 `三主链：无新增可见词` 为已知负载 flake，本批隔离复跑 **6/6** 与 **8/8** 全绿。**剔除后差集 = 0** |
| 裁-11e | `role-schema.js` 新增导出 `SESSION_POLICIES = Object.freeze(['reuse','fresh'])` | 与 `GROUPS` / `ARTIFACT_TYPES` / `SIDE_EFFECTS` 同风格的值域常量，零 CJK、零资产名；D-13 未禁止。**接受** |
| 裁-11f | `role-instances.js` 按裁-10a 收窄：仅排除 `state==='running' && phase==='assigned'`，`review` 与无 `phase` 的旧快照行为不变 | 与 D-2 的位置语义一致（`assigned` 是「已分配、会话待重建」，不是在服务）；既有 67 条实例用例全绿。**接受** |

## 九、S2 第 5 批（WP-7）前置裁决：AC-56 的「I1.7 已合入」重判口径（裁-12）

**背景**：AC-56 的 **Given** 写「当前 `origin/main` 不含 I1.7 的 worktree / 产物隔离能力」，机检锚点含
`grep -R "worktree" src/ | wc -l` 输出 `0` 与「`docs/iterations/iteration-7/requirement.md` 不存在」。
但 I1.7（产物类型隔离 + 代码 worktree 集成）已收口并合入 main，上述两个锚点**客观不再成立**。
AC-56 的 **Then** 末句已预留出口：「I1.7 合入后按同一套 AC 重跑」。

**判定**：不修改需求；按 Then 末句执行「合入后重判」，把机检从「文件是否存在」改为「I1.8 是否依赖 I1.7 的能力」。

**重判口径（S3 / S4 一律按此判 AC-56）**：

1. **核心判据（不变）**：I1.8 的恢复实现**只读现有 `artifactRefs`**，不假设 worktree 路径、不假设产物隔离目录。
   机检改为：`git diff 014fa6a..HEAD -- src/core/orchestrator.js | grep -c worktree` = `0`
   且 `git diff 014fa6a..HEAD -- src/core/orchestrator.js | grep -cE "artifact_type.*dir|merge.*order"` = `0`。
2. `test ! -e src/core/worktree.js` **仍成立**（I1.7 的隔离能力在 `src/core/code-isolation.js`，本就没有 `worktree.js`）——保留该断言。
3. `grep -R "worktree" src/ | wc -l` 输出 `0` **不再适用**（I1.7 自身引入），**不得为凑该数字去改 I1.7 代码**；
   改为「I1.8 新增行零命中」，即上述第 1 条。
4. 「`docs/iterations/iteration-7/requirement.md` 不存在」不再成立（文件存在），**改为登记事实**：
   报告写明「I1.7 已合入（`docs/iterations/iteration-7/requirement.md` 存在、`src/core/code-isolation.js` 存在），
   AC-56 已按合入后口径重判；67 条 AC 的合入后重跑体现在 I1.8 S2 全量回归（基线 `014fa6a`）与 S3 逐条取证中」。
5. 其余 4 条机检（`artifact_type.*dir|merge.*order` 零命中、报告登记「I1.7 合入后重跑」）**原样执行**。

**不做的事**：不改 `src/core/code-isolation.js`、不改 I1.7 任何产物、不删 `docs/iterations/iteration-7/**` 来凑旧判据。

## 十、S2 第 5 批（WP-7）实现口径、会话恢复降级缺陷修复与差集核对（裁-13）

**背景**：WP-7 回执明确拒绝「改测试迁就实现」，把一条产品缺陷上报：「mock 进程**已成功拉起并完成 initialize**，
只是适配器没暴露方言原语，却被判 `host_unreachable` → 实例被 `markInterrupted`」。主控复核后**亲自修产品代码**
（不派回 WP-4 负责人，避免契约漂移），并据此消除 D-9 两条授权预期红。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-13a | **产品缺陷（主控亲修）**：`recoverSessionEntry` 在 `initializeAdapterOnly` 已成功（宿主可达）后，若适配器既无 `client` 也无 `resumeOrCreate`，返回 `{ok:false, reason:'host_unreachable', unavailable:true}`，`recoverInstance` 据此判致命 → `markInterrupted('recovery.failed')` → 整个实例 `interrupted` | 与 D-5「**只有宿主不可达才致命**」（AC-17 的给定是 mock 进程**拉不起来**）明确不符。改为 `{ok:false, reason:'no_dialect', unavailable:false}`，走**会话级降级**：节点 `running → assigned`、角色回到 `available`、写恢复事件后继续调度。落地位置 `src/core/orchestrator.js:5210-5216`，随代码附 D-5/AC-17 注释说明「initialize 成功即宿主可达」 |
| 裁-13b | D-9 第二条授权预期红（`test/wp4/orchestrator.test.js:585` 的 `core.gone`）在裁-13a 修复后改测试即转绿 | **两条授权断言各司其职**：`:57` 改 `ROLE_OPTIONAL_KEYS` 元素数（`session_policy`），`:585` 改「无 `core.gone`、有 `recovery.*`」。改完 `test/wp4/orchestrator.test.js` **37/37 全绿**、`test/wp11/role-schema.test.js` **36/36 全绿**，`test/wp13/**` 无回归。**D-9 授权额度用尽，后续不得再改既有测试来迁就实现** |
| 裁-13c | AC-56 第 4 条机检（`artifact_type.*dir|merge.*order` 零命中）按**全仓**口径实测 2 处命中：`src/core/code-isolation.js:6`、`src/core/orchestrator.js:2496` | 已核实两处**均在 `014fa6a` 基线已存在**（`orchestrator.js` 同文在基线 `:2258`，仅因上方新增代码行号位移），I1.8 新增行**零命中**。按裁-12 第 1 条 diff 口径实测 `worktree=0`、`artifactdir_mergeorder=0`，**判通过**；全仓 2 处按裁-12 第 3 条「不得为凑数字改 I1.7 代码」**登记为事实**，不改代码。S4 报告 §5 列明「全仓 2 处 vs diff 0 处」的口径差 |
| 裁-13d | 批次 5 全量 **1921 / 1888 pass / 22 fail / 11 skip**；与基线 `014fa6a`（1841/1808/22/11）做失败集合差集 | **新增 1 条**：`--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）`，失败点在 `after` 钩子 `EBUSY: rmdir %TEMP%/maestro-wp7-hosterr-*`（沙箱 `node-safe-delete-shim.cjs`），隔离复跑 **6/6 全绿** → 记为 Windows 清理 flake，**不计新增红**。**消失 1 条**：`live 取消：四项全 null、终态 cancelled/ended、不阻断取消`（基线红、本次转绿，属改善）。**剔除 flake 后差集 = 0**，条数 1921 ≥ 1841 |
| 裁-13e | WP-7 自述未完成项：AC-26 第二条机检、AC-27、AC-53 差集口径、AC-56 第 4 条 | **一律不在 S2 掩盖**：AC-26 第二条（崩溃窗口内 `workspace/artifacts/**` 无产物，编码闭环实例产物落在 I1.7 `worktrees/` 与 `stage/`，强杀窗口内 `stage/` 为空）→ 判**阻塞**，不用空集冒充；AC-27（`dsh-acp-server@0.14.4` 真实安装成功，bin 启动即抛 `ERR_UNSUPPORTED_ESM_URL_SCHEME … Received protocol 'c:'`，本机只有 Electron + `app.asar/bin.js`、无 `dsh` CLI）→ 判**阻塞**并留原始 stderr 帧；AC-53 差集已由裁-13d 闭合；AC-56 已由裁-12 + 裁-13c 闭合。四条全部进 S3/S4 台账 |
| 裁-13f | 真实宿主版本实测 **0.2.2-rc.5**，需求 §3.3 与 `docs/index.md` 记 `0.2.2-rc.1` | **不改需求**（需求是验收依据，版本号属环境事实）。按「实测优先」在 S3 取证时以 rc.5 记录，S4 报告 §5 登记「需求记 rc.1 / 实测 rc.5」，Done 判定不受影响 |

## 十一、S3 验收批一（AC-01~12）主控复核裁决（裁-14 / 裁-15）

**背景**：批一 12 条用例由独立 Agent 撰写并实跑，回执 7 通过 / 5 不通过。主控不采信回执，逐条核对
`evidence/acc8/_acc8-f-results.jsonl` 原始记录，并对 5 条不通过项**串行隔离复跑**（严格无并发）。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-14a | AC-01（18/22）与 AC-07（4/10）在批次串行高负载下失败，失败点分别是「`已分配` 漂移成 `执行中`」与「`recoveredAt` 8 次轮询全 null」；Agent 单跑分别 22/22、10/10 | 复核隔离复跑：AC-01 **22/22**、AC-07 **10/10** 全绿；结果文件末次记录 AC-07 已转「通过 10/10」。根因是 `RECOVERY_HOLD` 落盘竞态与 `instance.get` 健康写 / 恢复 `saveState` 的 CAS 冲突，**非产品缺陷**，按既有负载 flake 口径登记，不计真实不通过。但**不掩盖**：S4 报告 §5 列为「可观测竞态观察项」，建议后续迭代消除 |
| 裁-14b | AC-03（32/33）、AC-08（4/9）、AC-09（8/9）隔离复跑后仍不通过（AC-08 5/9），失败点收敛为同一条：`T-002 round=2` 不可得，实测恒为 `failed round=1`（等待复测） | 核实 `src/templates/index.js:186`：内建 `code-loop` 的 `maxRounds = {T-001:2, T-002:2}`；`test/fixtures/code-loop-driver.mjs` 的 `backflow` 仅 4 步（`dev1 → fail → dev2 → pass`），`retest-slow` 的 `passStep(delayMs=30000)` 在恢复期新 mock 进程消费第 5 步即耗尽退出。需求 AC-03/08/09 的示例窗口「`skipped=1` + `T-002 round=2`」在 `killAfter=1200/2500` 两个窗口**不可兼得**（1200 得 skipped=1 但 round=1；2500 得 round=2 但 skipped=0）。**这是需求示例数字/窗口与内建夹具能力的冲突，不是 I1.8 恢复逻辑缺陷**——已完成节点不重放、`recovery.*` 事件、角色降级等 Then 均已实测通过。**判三条「不通过」成立且如实保留断言**，不放宽、不改夹具凑绿；S4 报告 §5 列明口径冲突，交用户裁决是否修夹具或修订需求示例 |
| 裁-15a | AC-01 用例 note：需求写 `MAESTRO_TEST_PAUSE=after_output:reviewer`，实测 `pauseFor()` 比对 nodeId，task-loop 审核节点是 `T-003`，须用 `after_output:T-003` | **以实测为准**，不改产品；需求示例措辞与实现不符，S4 报告 §5 登记 |
| 裁-15b | AC-04 用例 note：需求写提醒出现在 `orch run` 输出，实测在 `orch instance log` | 同上，**以实测通道断言**，差异登记 |
| 裁-15c | **发现验收用例违规放宽断言**：AC-07 原用例把需求机检 `maxRounds===3` 改成了「maxRounds 是正整数」，属「为让测试变绿而放宽断言」 | **主控纠正**：收紧为「恢复行轮次分母 === 内建模板真值 2」（`src/templates/index.js:186`），**不放宽为正整数、也不为凑需求示例伪造 3**。收紧后隔离重跑 **10/10 通过**，结论更硬。需求机检写 3 与模板实际 2 的冲突按裁-12 同类口径登记，S4 报告 §5 列明 |
| 裁-15d | AC-11 用例 note：需求 Given 写 `running`/`review` 各一，实测 rounds-exceeded 现场为 `done` + `escalated` | 以实测现场断言「重启后不变」（该 AC 的 Then 实质），差异登记 |

## 十二、S3 验收批二（AC-13~24）主控复核裁决（裁-16）

**背景**：批二 12 条用例实跑 6 通过 / 6 不通过。主控逐条核对原始帧，确认其中**两条是真实产品缺陷**（非用例问题），按批 5 先例由主控亲修产品代码；另两条是用例自身字段路径错误。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-16a | **产品缺陷 1（主控亲修）**：`src/adapter/acp-client.js:323` 的 `initialize()` 把 `client.capabilities` 只设为 `agentCapabilities.sessionCapabilities`，丢掉了顶层 `loadSession` 标志；而 `normalizeCapabilities()` 明确读 `init.loadSession === true`，导致恢复路径 `canLoad` 恒 false、load 方言不可达（AC-20 6/10、AC-22 6/10） | 修复：`result.loadSession === true` 时把 `{load:{}}` 并进 capabilities。AC-20 **10/10**、AC-22（配合裁-16b）**10/10**。补回归单测 `test/wp13/dialect.test.js`「initialize keeps the top-level loadSession flag」，锁定 load/both 为 true、resume/none 为 false，16/16 绿 |
| 裁-16b | **用例缺陷**：AC-22/AC-23 把 `fallback` 标记当事件顶层字段 `e.fallback` 过滤，而核心写在 `e.detail.fallback`，导致回退事件漏判 | 修正用例字段路径为 `e.detail?.fallback`（**不放宽断言**）。AC-22 转 10/10 |
| 裁-16c | **产品缺陷 2（主控亲修）**：`src/core/orchestrator.js` 的 `all_dialects_failed` 返回 `unavailable:true`，被上层当宿主不可达 → `markInterrupted` 中断整个实例；与 `index.md:225` / BR-22 / AC-23「三方言都失败 → 节点 assigned、角色 available、交接待投递、实例不假装运行」冲突，也与批 5 裁-13a 的 `no_dialect` 修复同类 | 修复：`unavailable:false`，走会话级降级。补 AC-23 交接包 Given 后实测：节点 `running→assigned`、角色「可用 · 活跃会话 0/1」、交接「待投递」、回退行可见**全部达成**（8/10） |
| 裁-16d | AC-23 剩余 2 条失败：①「实例不进入运行中」——降级后 `state` 仍 `running`；②「session/new 失败后无新会话」——真 `adapterFactory.create` 预开会话，`new` 方言直接复用，`all_dialects_failed` 分支在 CLI 真路径不可达 | **需求措辞与真 CLI 路径的结构性冲突，非产品缺陷**：① BR-22 的「实例不假装还在运行」语义由「节点 assigned + 角色 available + 会话隔离」承载，实例容器保持 running 才能继续调度，这是设计取舍；② 真 factory 预开会话是既有架构，不为凑夹具改工厂。**两条断言按原文保留并如实判不通过**，S4 报告 §5 列明，交用户裁决是否修订需求 Then |
| 裁-16e | AC-15 机检「state.json sha256 不变」与产品 `markInterrupted` 必须重写 state 不可兼得；AC-17「恢复失败原因可见」实测日志为「恢复失败：；…」原因为空 | AC-15：按原文保留断言判不通过（9/10），差异登记；AC-17：原因为空是**可观测性缺陷**但非 S2 阻塞（Then 实质「用户看到恢复失败」已由「实例已中断」行承载），按原文保留判不通过（8/9），S4 报告 §5 列明，建议后续迭代回填原因 |
| 裁-16f | AC-18 用例用「已完成恢复的受控快照 + 1 条 summary 事件」替代需求夹具的「连续两次 kill-after」；其余受控起点用例（AC-13/15/19/20/21/22/23）以手写 state 构造 Given，方言选择/恢复降级仍由产品核心连真 mock ACP 执行 | **接受该口径**：受控起点只用于稳定构造 Given（避开 CAS 竞态与 mock 步骤耗尽），Then 由产品核心实测产出，不构成「夹具冒充通过」。但 `driveDialect/driveRecovery` 的 `retryRecover` 与受控快照是负载 flake 的对症缓解，**根本竞态仍存**，S4 报告 §5 列为观察项 |
| 裁-16g | 批二全量回归首轮 `--test-concurrency=4` 跑 28 分钟未完成（记忆载有的并发资源耗尽老问题）；改串行后差集出现 7 条 `graph-stream` / pulse 假红（`404 !== 200`） | 并发跑停掉，改串行。**关键自纠**：串行首轮**漏注 `NODE_ENV=test`**，而 `test/wp13/graph-stream.test.js` 的 pulse 接缝门控要求该变量（`src/daemon/http/server.js:627`），导致 7 条 404 假红。注入后该文件 **7/7 全绿**，确认与产品修复、`dc54021` 的 server.js 改动均无关。全量以 `NODE_ENV=test node --test --test-concurrency=1 …` 重跑为准，帧 `probe/i18-s2/batch2-product-fix-full.log`。**不得把漏注环境变量造成的假红记成回归** |

## 十三、S3 验收批三（AC-28~40）主控复核裁决（裁-17）

**背景**：批三 13 条用例实跑 11 通过 / 2 不通过。主控核对原始帧，确认 AC-32 是产品缺陷（已修），AC-37 是夹具与图声明冲突（如实判）。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-17a | **产品缺陷（主控亲修）**：`src/cli/main.js:912` 的 `recovery.connection` 日志行把事件里的角色 **id**（`tester` / `developer`）直接传给 `formatHandoffDirection`，渲染成 `tester→developer（回流）`，而 `render.js:700-704` 的同类调用先用 `roleLabel()` 转中文名。违反「中文唯一来源 labels.js」且 AC-32 Then 要求「测试→开发（回流）」 | 修复：`main.js` 先用 `ROLE_LABEL[fromId] ?? fromId` 转换再传 `formatHandoffDirection`，与 render.js 同口径。AC-32 **8/9 → 9/9 通过**。不改 labels 文案 |
| 裁-17b | AC-37 失败：`test/fixtures/recovery/human-node-state.json` 预置的人工节点 **T-004 不在内建 code-loop 图声明内**（图只声明 T-001/T-002），`renderGraphText` 经 `graphNodes()` 只渲染图声明节点，故 graph 不显示 T-004 的「执行中 · 等待人工」；status 行有「节点 T-004 执行中 · 第 1 轮」但无该后缀 | **夹具与图声明的结构性冲突，非产品缺陷**：产品按图声明渲染是既有设计（`graphNodes` 在图声明非空时只返回声明节点），改它会影响所有内建图并撞三主链逐字基线（不变量 11）。`render.js:1479` 的「等待人工」后缀逻辑本身正确（读 `nodeTypeById`）。**断言按原文保留判不通过**，S4 报告 §5 列明，交用户裁决是否改夹具为「图声明内含 human 节点」或修订 AC-37 的 Then |
| 裁-17c | AC-38/AC-40 同样以图外的 T-003 核对（改以 status 节点行）；AC-39「既有下一步」以 status 的「节点 T-002 待执行」行核对（无独立「下一步：」行） | **接受**这些用例按「Then 实质」选可观测通道：节点状态保持、无重派、无重放均由 status/state/事件实测。措辞差异 `note()` 记录，S4 报告 §5 列明 |
| 裁-17d | AC-30/AC-31 首轮单跑失败经用例自查修正（events flush 窗口 300ms、忙标志改取 role show 文本 + `node.dispatch.phase=running`）后单跑与批次均稳定通过 | 属**用例采样口径问题**（CLI 快照比 `readState` 新一拍），非产品负载 flake。修正后 11/11 稳定，接受 |

## 十四、S3 验收批四（AC-41~51）主控复核裁决（裁-18）

**背景**：批四 11 条实跑 7 通过 / 4 不通过。主控逐条核对原始帧并对 4 条不通过项全部串行隔离复跑，结果一致（AC-49 4/7、AC-42 13/15、AC-43 13/14、AC-45 14/15），均为真实结论。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-18a | **重大发现：AC-49 reuse 端到端未接线**。核实 `grep -rn selectReusableSession src/` 仅两处（定义 `:145`、导出 `:6852`），`grep -rn session_policy src/core/` **零命中**；生产派发 `dispatchInState`（`:2105`）无条件 `createAdapter()` → `createAdapter` 内 `adapter.newSession()`（`:1354`），从不读角色策略、不查选择器。WP-3 只实现了配置 schema/CLI 展示，WP-4 派发内核从未消费。裁-10c 当时只判「无 CLI 调用点可接受」，**未发现生产派发也零调用**，这是 S2 跨 WP 接线遗漏 | **判不通过成立**，AC-49 4/7（两轮会话 id 不同、session/new=2、无复用行）。**不在 S3 仓促改核心派发**：接线需在 `dispatchInState` 读角色 `session_policy` 并改 `createAdapter` 支持复用既有会话，触及调度核心与三主链逐字基线（不变量 11），属新实现工作而非验收修补。S4 报告 §5 列为 **I1.8 功能缺口**，交用户裁决：补做（新批次接线 + 全量回归）或作为已知缺口收口 |
| 裁-18b | AC-50「reuse 不跨实例」7/7 通过，但 Agent note：因派发未接线，两实例各自新建会话使交集为空，跨实例边界仅由冻结选择器单测验证 | **通过成立但标注口径**：端到端 reuse 未触发（同裁-18a），本条只证明「不误跨实例」。S4 报告 §5 与 AC-49 一并说明 |
| 裁-18c | AC-42（13/15）、AC-43（13/14）、AC-45（14/15）失败点全是需求示例「节点 T-003 · 轮次 2/3」不可得：实测 `T-001 · 1/2`。AC-42 另有 `round===2` 实测 1；`crash-rebuild` 用内建 pass 图、`graph-timeout.json` 的 maxRounds=2，均无 T-003/2/3 现场 | 与裁-14b 同类**需求示例与夹具不可兼得**，崩溃重建/超时升级/文案分流等 Then 实质全部实测通过。断言按原文保留、如实判不通过，note 已记。S4 报告 §5 列明，交用户裁决是否提供 round=2/T-003 专用夹具 |
| 裁-18d | AC-44/46 的「运行慢」用例取 driver `core.stop` 前快照（stop 后实例标 interrupted）；AC-48/49/50 批次中偶发冷启动 `IPC_TIMEOUT`，用例加一次限次同参重试并保留首次原始帧，断言未放宽 | **接受**：core.stop 后状态变化是清理副作用，取 stop 前快照是正确口径；限次重试保留原始帧、不放宽断言，属对症负载 flake 的合法缓解（同裁-16f）。S4 报告 §5 列明 |

## 十五、S3 验收批五（AC-58~67）主控复核裁决（裁-19）

**背景**：末批 10 条实跑 5 通过 / 5 不通过。67/67 用例全部就绪。主控核对原始帧，5 条不通过分三类：需求自相矛盾、夹具能力缺口、需求示例冲突。

| 编号 | 事项 | 主控决定 |
|---|---|---|
| 裁-19a | **AC-60 需求机检自相矛盾**：Then 写「可调度的被派发」，机检写「重启前后 `nodes[].phase` 逐项相同」。派发必然把 `phase` 从 `ready` 改成 `running`，两条不可能同时成立。实测 `reconcileOnBoot` 走 `recovery.record (CHECKPOINT_MISSING)` 只做对账不派发 pending 节点；`orch run` 续跑被产品按运行中实例拒绝（帧 `AC-60.then.run-resume-output.txt`） | **需求内部矛盾，非产品缺陷**：保持断言原文、如实判不通过（6/8），不改产品。S4 报告 §5 列明，交用户裁决修订机检（「phase 逐项相同」应限定为「依赖未满足节点」，可调度节点应允许 phase 变化） |
| 裁-19b | **AC-67 需求与角色六态规则冲突**：Given「服务的节点都已处于终态」命中产品 `role-instances.js:79` 的 `doneCount>0 → cooldown` 规则，实测 `role show` 为「冷却中 · 活跃会话 0/1」，而 Then 要求「可用」。另 `role_to_sessions.developer` 仍留 idle 会话 | **需求与既有角色状态机冲突，非恢复缺陷**：产品的 `busy>cooldown>available` 优先序是 I1.5 起的既有契约，改它会破坏角色状态回归。断言按原文保留判不通过（7/9），S4 报告 §5 列明，交用户裁决修订 AC-67 的 Then 或 Given |
| 裁-19c | **AC-62 夹具能力缺口**：重投连续 3 次失败客观取不到——`MAESTRO_MOCK_PROMPT_FAILURES=3` 与 `--host-error` 均未在重投首条 prompt 命中，交接包直接 accepted、无 expired/升级。7 条 Then 逐字保留（2/9） | **阻塞级观察**：需求要求的「重投前 N 次确定性失败」接缝在现有 mock 中不存在。不用伪造的 expired 状态冒充，S4 报告 §5 列为夹具缺口，交用户裁决是否补接缝或判阻塞 |
| 裁-19d | AC-58（15/16）、AC-63（15/16）失败点均为示例数字/窗口：e2e driver 恢复后只等 5s 未到终态；AC-63 示例「T-003 · 轮次 2/3」实测「T-001 · 1/2」（同裁-18c）。AC-58 另记 `recovery.handoff created→delivered` 事件与 handoff list「已构造」不一致 | 示例冲突类保留断言判不通过、note 记录；`recovery.handoff` 事件与 handoff 视图不一致是可观测性观察项，S4 报告 §5 列明。不延长夹具窗口凑绿（那是改验收条件） |
| 裁-19e | AC-65/66 按裁-18a 用冻结选择器 + 可见 CLI 取证通过；Agent 明确「可见复用行恒为 0，不当端到端通过」 | **接受**：这两条只证明选择器契约与配置面，不抵消 AC-49 的端到端缺口。S4 报告与裁-18a 一并说明 |
| 裁-19f | AC-58/65 批次负载下 e2e/backflow 固定窗口偶发偏离，均已用同参数一次重试 + 双方证据处理，断言未放宽 | 接受（同裁-18d），S4 报告 §5 列明 |

## 十六、S4 前置收口：缺陷修复、定性自纠与 Done 未达成项（裁-20）

> 触发：批五交付后 67/67 用例就绪，主控逐条核对 17 条不通过项的原始帧。本节先修一处明确的产品缺陷，再**自纠裁-19a 的定性**，最后把 17 条按「可修 / 需返工 / 需求冲突 / 夹具缺口」四类归口，供 S4 终验与用户裁决。

| 编号 | 事实 | 裁决 |
|---|---|---|
| 裁-20a | **AC-17 产品缺陷（主控亲修）**：恢复失败时 `markInterrupted(state, 'recovery.failed')` 只写 `detail.note`，CLI 从 `detail.reason ?? detail.code` 取值为空，实测输出「恢复失败：**；**实例已中断」——需求 AC-17 Then 与 BR-12 明确要求「恢复失败：<原因>」 | `markInterrupted` 增加可选 `extraDetail` 参数（`{note, ...extra}`，`note` 键逐字不变）；`fatal` 取 `recovered.reason ?? recovered.message ?? 'host_unreachable'` 并作为 `detail.reason` 落盘。**AC-17 9/9 通过**。核心只传码不写中文，中文仍只在 `labels.js` |
| 裁-20b | **裁-19a 定性自纠**：原文把 AC-60 全部归为「需求内部矛盾，非产品缺陷」。复核 D-5 第 5 步原文「**从 `assigned` / `ready` 节点继续调度**」——这是需求明写的核心行为，而 `reconcileOnBoot` 恢复后只 push 到 `recovered` 列表，不驱动调度；`orch run` 对 `running` 实例返 `INSTANCE_RUNNING`（`orchestrator.js:4545/4566`），故恢复后**没有任何路径**推进可调度节点 | **双因叠加**：① 产品缺 D-5 第 5 步（属 WP-4 未交付，需返工）；② AC-60 机检「重启前后 `phase` 逐项相同」与 Then「可调度的被派发」自相矛盾（需改需求）。**不得**再把本条整体记成「非产品缺陷」 |
| 裁-20c | **AC-49 / AC-65 / AC-66 的 reuse 端到端缺口**：`selectReusableSession` 仅有定义（`:145`）与导出（`:6852`），`src/core` 零处读 `session_policy`；`state.roles` 全仓**零处写入**（仅 3 处读取），核心拿不到角色策略；`buildSession` 不写 `roleId` / `instanceId`，选择器对落盘会话恒 miss；`createAdapter` 强制 `newSession`，无「只 create+initialize」入口 | 返工范围已明确（S2 级，非 S3 可顺手改）：① CLI `run` 创建实例时把角色 `session_policy` 快照写入 `state`（checkpoint 九字段**不得**扩）；② `buildSession` 补 `roleId` / `instanceId` / `servingNodeId`；③ 拆 `createAdapterOnly`；④ 派发时 `reuse` 命中候选 → `resumeOrCreate({policy:'reuse'})` 接回并写 A-2 复用行，失败回退 `new` 并写回退行；⑤ 补单测 + 全量回归。**AC-65/66 的通过只证明选择器契约与配置面，不抵消本缺口**（沿用裁-19e） |
| 裁-20b-补 | **裁-20b 精确化（复核代码后）**：`recoverInstance` 末尾确有 `continueRecovery(instanceId, plan)`，重新派发的范围是 `plan.assigned` / `createdContinue` / `redeliver`——**不含原本就 `pending + phase='ready'` 的可调度节点**。故 D-5 第 5 步「从 `assigned` / `ready` 节点继续调度」只做了前一半 | 结论不变但更准：不是「完全没有继续调度」，而是**只覆盖 assigned/created/redeliver，漏 pending-ready**。AC-60 的 C07（`T-001 dispatch` 次数 0→应为 1）即由此而来。返工点为「recoverInstance 收集 `nodePosition(node)==='ready'` 的节点并加入 plan + continueRecovery 派发」；即使补上，AC-60 的 `phase` 逐项相同机检仍与「被派发」互斥，故该条仍需改需求。**本轮不做该返工**（改了也不能让 AC-60 转绿，投入产出比低），如实记为返工项 |
| 裁-20d | **需求文本与冻结基线硬冲突（不可通过改产品解决）**：① AC-42/43/45 的 Then 逐字要求「（节点 **T-003** · 轮次 **2/3**）」，而内建三图无 T-003、`maxRounds=2` 是 I1.1 逐字红线；② AC-15 机检「`state.json` sha256 不变」与「转为 `interrupted`」不可兼得（`markInterrupted` 必重写 state）；③ AC-67 Given「服务的节点都已处于终态」命中 `roles-instances` 的 `doneCount>0 → cooldown`（I1.5 契约），与 Then「显示可用」冲突；④ AC-37 的 `graph` 只渲染图声明节点，夹具 `T-004` 不在内建 `code-loop` 图内；⑤ AC-23 Then「实例不进入运行中」与 BR-22 降级 + D-5 第 5 步继续调度冲突；⑥ AC-60 分句 1 与分句 2 互斥 | **一律保持断言原文、如实判不通过，不改产品凑绿**。这类只能由用户裁决：修订需求文本（示例按实际值/实际节点表述、机检改口径），或对该条书面豁免。S4 报告 §5 逐条列明影响面 |
| 裁-20e | **夹具能力缺口（补齐观测路径即可重判）**：① AC-03/08/09/24 的 Given 要求「`T-001 done round=2` + `T-002 running round=2` + `skipped=1`」，`code-loop-driver --scenario retest-slow` 仅 4 步，`killAfter=1200` 得 `skipped=1` 但 `round=1`，`2500` 得 `round=2` 但 `skipped=0`；② AC-58 `e2e` 恢复后只等 `waitMs=5000`，未到终态；③ AC-62 无「重投前连续 3 次确定性失败」接缝（产品侧 `expired` + `delivery_failed` 升级**已实现**，`orchestrator.js:2039~2062`） | 属「补齐观测路径」而非放宽断言：需扩 `test/fixtures/code-loop-driver.mjs` 场景步数与 `e2e` 观察窗、给 mock 增投递失败接缝。**在补齐前不改判通过**，当前如实判不通过 |
| 裁-20f | **Done 判定（如实）**：当前 67 条中 17 条不通过、0 阻塞（阻塞项 AC-26 第二条 / AC-27 在 S2 已判阻塞，本轮为 WP-7 既有帧）。按模板 §4.5 第 1/2 项，**不通过 = 0 且阻塞 = 0 未满足 → I1.8 未达成 Done** | 不宣布结束、不把不通过写成通过、不删断言。S4 产出 `final-verification.md`（逐项 PASS/FAIL）+ `report.md`（含 §5 遗留）+ `summary.json`，并把「返工 AC-49/AC-60 + 用户裁决 6 条需求冲突 + 补齐 3 类夹具」作为收口阻塞项交用户裁决 |
| 裁-20g | **AC-03/08/09/24 的真实根因（主控亲修）**：`recoverInstance` 末尾写入 `recoveredAt` / `recovery` 的那次 `saveState(..., {expectedState})` 一旦 CAS 冲突就 `return {ok:false, code}`——**既不写摘要事件、也不标 interrupted、也不写可见原因**，`reconcileOnBoot` 只是把它从 `recovered` 列表里漏掉。用户看到「运行中」，实例实际从未被恢复。这违反 BR-12「不得静默假装仍在运行」。复现：`retest-slow` 的第 4 步 `delayMs=30s` 让恢复期的并发写者（会话回写/健康度写）与恢复落盘撞车 | **改为幂等重试**：CAS 冲突时重载磁盘快照、用新 `rev` 重算恢复记录再落盘（最多 2 次），成功后 `Object.assign(state, fresh)` 保持后续事件与磁盘一致；仍冲突则 `markInterrupted('recovery.failed', {reason: saved.code})` 显式中断并给出可见原因（复用裁-20a 的模板）。**AC-03 29/33→33/33、AC-09 →9/9、AC-24 →10/10、AC-08 →9/9**；`wp13/recovery-boot.test.js` 17/17 无回归 |
| 裁-20h | **AC-08 的 C07 断言纠正**：旧断言绑死 `崩溃前 T-002 round===1 且恢复后 round===2`——那是「固定 `killAfter` 抓到 r1」这个错误现场的产物。窗口改为 `retest-slow` 精确等待后，崩溃前本就是 r2。原断言若保留会把**正确的现场**判成失败 | 按需求 Then 的语义改为「崩溃时 `running` 且 `round>=2`，恢复后 `round` 不回退」。这是纠正绑死错误现场的断言，不是放宽（仍拒绝 done 跳过与 round 归零） |
| 裁-20i | **驱动夹具补窗（观测路径补齐）**：`probe/acc8-cases/AC-01.mjs` 的共享 `driveRecovery` 硬编码 `scenario:'backflow'`，第 4 步瞬时完成，窗口窄到抓不住「T-002 第 2 轮执行中」；`waitForRound2` 只等 `T-001 round>=2`（会杀在 T-001 第 2 轮**执行中**，T-001 未 done → 恢复必然 skipped=0） | 新增可选第 6 参 `{scenario, window}`：缺省值与既有调用**逐字不变**；AC-03/08/09/24 改传 `{scenario:'retest-slow', window:'retest'}`，判定条件为「T-001 `done` 且 `round>=2`、T-002 `round>=2` 且 `running`」。实测四条的 Given 全部精确命中需求现场 |
| 裁-20j | **AC-53 门禁口径代码化**：全量差集原判定 `extra === []`，在批次负载下必然偶发含「三主链」时序 flake（本轮隔离复跑 3×8/8 全绿，帧 `probe/i18-s2/acc53-three-chains.isolated.log`） | 改为「`extra ∖ 已知 flake 名单 = 空`」+ 双保险「剔除项必须逐条命中名单」。名单仅 3 条且各附隔离复跑证据；**名单外的任何新增红仍判失败**。这落实的是项目既有门禁纪律（新增红先独占复跑证伪），不是放宽断言 |

## 十七、返工落地、返回态复核与终验第 2 轮修正（裁-20k ~ 裁-20y）

> 触发：用户裁决「先返工 2 条产品缺口（推荐）」+「AC-26 / AC-27 书面豁免（推荐）」。本节记录两条产品缺口（AC-49 reuse 派发接线、AC-60 pending-ready 续派）的落地口径、随之必须重定的三处用例现场，以及豁免留痕。

| 编号 | 事实 | 裁决 |
|---|---|---|
| 裁-20k | **AC-49 reuse 派发接线已落地**：① CLI `run` 经 `roleSessionPolicies(registry, cwd)` 把角色文件里**显式**的 `session_policy: reuse` 读成 `{roleId:'reuse'}` 快照，随 `run.start` 下发（IPC 边界校验封闭集，`fresh` 不入快照）；② 核心写入 `state.sessionPolicies`（**不进 checkpoint**：`buildCheckpoint` 是显式白名单，九字段未扩）；③ `buildSession` 补 `roleId` / `instanceId` / `servingNodeId` / `reused`；④ 派发时 `sessionPolicyOf(state, roleId)==='reuse'` → `selectReusableSession` 命中候选 → `initializeAdapterOnly` + `resumeSession`/`loadSession` 接回（失败即静默回退 `new`，AC-65 的「不报错」）；⑤ 命中后写一条 `session.reuse` 事件，`main.js` 渲染 A-2 行 | **落地**。`instance log` 实测 `会话 复用 mock-sess-PID-1（角色 developer）`；两轮开发同会话 id、`session/new` 1 次。**`state.sessions` 仍按「每次派发一条记录」**：复用时同一 `sessionId` 出现两条（r1 留历史、r2 为当前绑定），故 AC-49 的夹具断言从「记录条数 = 1」改为**去重后会话 id 数 = 1**（需求原文「两轮会话 id 相同、`session/new` 只 1 次」的等价机检），并在用例 note 里写明理由 |
| 裁-20k-补 | **`sessionOf` 改为「同 id 取最新一条」**：`state.sessions` 出现同 id 两条后，`sessionOf`（原 first-match）会把会话状态迁移打到 r1 历史记录上，`instance log` / 快照会读到过期状态 | 改为倒序查找。**id 唯一时返回对象与 first-match 完全相同**，故除复用路径外零行为变化（全量回归验证） |
| 裁-20l | **AC-65 / AC-66 的现场必须重定**：两条原判通过靠的是「派发未接线 → 复用行恒为 0」这个恒真观测（裁-18a/19e 已声明不作端到端证据）。接线后该观测必然为假——backflow 现场里第一轮结束后会话是**空闲**的，属 AC-49 的 Given，不是 AC-65 的「没有空闲会话」 | 撤销「端到端不出现复用行」这项恒真断言，Given 改由**既有 `test.dispatch` 接缝 + 预置 `state.json`** 构造（预置 `thinking` / `servingNodeId=T-002` / `hostId=mock2` 三种会话），走真实 `dispatchInState` 分支断言「新建 + 0 条 `session.reuse`」；正控用「空闲、同角色、同宿主、未服务其他节点 → 复用同一 id + 1 条 `session.reuse`」。新增 `test/wp13/session-reuse-dispatch.test.js`（5 例）承载。**判据按需求原文，未放宽** |
| 裁-20m | **I1.9 冻结测试的合法扩项（AC-24）**：`test/wp9/i19-regression.test.js` 冻结「`object: 'session'` 发射点 ≤ 13、会话级 reason 白名单 9 项」。AC-49 需要一条会话级 `session.reuse`，撞红该表 | 按项目既定口径「前缀逐字不变 + 尾部精确清单」处理：**既有 9 项 reason 与 `execution.summary` 恰 1 处的断言原样保留**，上限 13→14 并注明是 I1.8 的合法扩项，另加两条**单列断言**把新增项钉死（`session.reuse` 出现在白名单且写入点恰 1 处）。**不放松为「任意新增都允许」** |
| 裁-20n | **AC-60 返工落地 + 机检不再互斥**：① `recoverInstance` 收集 `nodePosition(node)==='ready'` 的 `pending` 节点进 `plan.ready`（`blocked` 不进）；② `continueRecovery` 在 assigned/created/redeliver 之后逐个 `redispatchRecoveredNode`；③ 用例改用 `MAESTRO_TEST_RECOVERY_HOLD=after_assign`——该 hold 挂在 `continueRecovery` **派发之前**，于是「恢复后位置不变」在 hold 点取证（两节点仍 `ready`/`blocked`），「可调度节点被派发」在释放 hold 后取证 | **两条机检不再互斥**：位置不变约束的是**恢复本身**，派发是恢复之后的独立动作。AC-60 实测 10/10 通过（`node.dispatch` 恰 1 条且属 T-001、T-002 为 0、edges 逐项相同）。裁-19a/裁-20b 的「双因叠加」至此两因都已消除 |
| 裁-20o | **AC-26 / AC-27 书面豁免（用户裁决）**：AC-26 第二条机检的锚点 `workspace/artifacts/**` 在本机实跑场景下客观不存在（非空转取证不可得）；AC-27 需要 `dsh` CLI，而本机只有 Electron 形态的 DSH（无 `dsh` 可执行） | **按书面豁免处置**：两条保留 `blocked=1` 事实与原始帧，不改判通过、不伪造锚点、不拿替代目录冒充；豁免理由与影响面进 `blockers.md` 与报告 §5。Done 第 2 项因此只剩「不通过 = 0」一条卡点 |
| 裁-20p | **裁-20j 的白名单已撤销**：终验指出把「本次未出现、也未被本条证伪」的 flake 放进白名单等于预赦——将来变红也不判红 | **撤销白名单，AC-53 恢复硬判**（`extra === []`）。负载下偶发红如实判红，再由「独占复跑」另行证伪（帧落 `probe/i18-s2/*.isolated.log`），判据里不预赦。本条取代裁-20j |
| 裁-20q | **i19 AC-03（三主链逐字）的偶发红是负载 flake，非本轮回归**：单跑实测 code-loop 会话行 5 条与基线逐字一致；批次负载下偶发多出 1 条中间「会话 空闲」。该红在 `probe/i18-s2/batch4-reds.txt:23` **本轮之前已记录**，且基线树 `014fa6a` 单跑 8/8 全绿 | 记为已知负载 flake：不改断言、不延长窗口；门禁差异口径按「对照 `origin/main` 基线红名单」，并在报告 §5 观察项列明 |
| 裁-20r | **AC-53 门禁改为「逐条独占复跑证伪」（取代裁-20j 的白名单思路，落地裁-20p）**：新增红不再靠预置名单，而是对**本次实际出现**的每条新增红，用 TAP `location:` 反查所属测试文件，再 `--test-concurrency=1` 单文件跑一遍；单跑通过 → 负载 flake（附独立帧 `AC-53.isolated.*.log` + 台账 `probe/i18-s2/acc53-isolated.txt`）；单跑仍红 → 计入差集、本条判不通过 | 判据写成 `surviving === []`；「无法定位所属文件」按 `stillRed:true` 保守计入。**不核不剔**（本次出现才有资格被核实） |
| 裁-20s | **AC-53 的「失败条数一致」原判据是弱断言**：`counts.fail === failures.length \|\| failures.length > 0` 里的 `\|\|` 让该检查在「有任何失败」时恒真，TAP 计数与失败名解析错位永远发现不了（独立终验第 2 轮指出） | 改为严格 `failGap === 0`（`failGap = counts.fail - failures.length`）。若真出现「失败发生在 after 钩子/子测试、TAP 只给计数不给用例名」，必须把差额逐条查明留痕，**不得再用 `\|\|` 抹平** |
| 裁-20t | **AC-45 的 4 条失败是取证时序假阴性**：C07~C10（节点 `escalated` / 实例 `suspended` / `escalations+1` / `reasonCode=timeout`）原在 `session.timeout` 事件出现后立即读 `state.json`；实测 `events` 止于 seq 31、`state.updatedAt` 只比它晚 5ms，升级/挂起事件 #32~#35 在其后落盘 | 读点改为「等 `suspended` **且** `escalations≥1` 落定再读」（上限 20s，落不下来仍判红），并落 `AC-45.then.settle.txt` 记录 `settled` 与末条事件 seq/ts。**期望值一字未改**，复跑 10/15 → **14/15**，只剩 C05 逐字文案 |
| 裁-20u | **`.gitattributes` 的证据树空白豁免范围扩大**：原规则只覆盖 `evidence/**/*.log`，I1.8 的证据帧另有 `*.txt`（CLI 原始输出）与 `*.part.md` / `_acc8-f-*.md`（核对表与台账，内夹原始帧），`git diff --check` 会因「`原因 ` 后为空值」这类真实尾空格报红 | 改为 `docs/iterations/**/evidence/** -whitespace` 一条规则。**它只关告警、不改工作树与提交里的字节**，不影响任何 AC 判定，也不构成验收判据放宽；文档正文仍在默认规则内。按扩展名逐个放行必然继续漏，故按「证据目录整体逐字保留」处理 |
| 裁-20v | **`test/wp11/perf.test.js` 的跨迭代证据污染（可复现）**：该用例每次运行都把本机实测耗时写进 `docs/iterations/iteration-4/evidence/nfr-perf-*.json`，等于把 I1.4 已收口的验收证据替换成「另一台机器另一次跑」的数字，也让「被验证提交 = 干净工作区」无法自然成立（终验第 1、2 轮都要手工 `checkout-index` 恢复 3 个文件） | 默认写系统临时目录；重生成 I1.4 证据需显式 `NFR_EVID_DIR=docs/iterations/iteration-4/evidence`。断言零改动 |
| 裁-20w | **`_acc8-f-blockers.md` 的处置台账必须能活过重生成**：该文件由 `probe/acc8-f-final.mjs` 整文件重写，手工追加的「处置结论」段会被抹掉——抹掉后 Done#4「缺陷与遗留收口」就变成「清单里没有处置」 | 生成器改为：写之前先从旧文件里取出 `## 处置结论` 之后的段落，原样接回。台账则补「10 条不通过的逐项处置」表（归口 / 处置 / 谁来做 / 不做会怎样） |
| 裁-20x | **AC-03 的 `note` 已过期**：早期「需求示例三项不可兼得、按原文如实判红」的说明，在裁-20g（恢复落盘 CAS 重试）与裁-20i（驱动补窗）之后不成立——现三项断言同时成立且 33/33 全绿 | 改写 `AC-03.mjs` 的文件头与 `note`，说明缺口已修、断言仍按需求示例逐字保留 |
| 裁-20y | **归口算术与漏项（独立终验第 2 轮指出）**：`acceptance-fixture.md` §二汇总写「7 + 3 − 1 = 10」但实际是 **AC-67 漏进汇总表、AC-45 被计两次**；`report.md` 里 AC-53 一处写 `3/3` 与同文件 §2 的 `4/4` 冲突；`docs/index.md` 同样漏 AC-67 | 汇总改为 **需求冲突 8（含 AC-67）+ 夹具缺口 2 = 10**（AC-45 的 4 条时序项已按裁-20t 修好，不再计入夹具缺口）；`report.md` 统一 `4/4`；`index.md` 补 AC-67。四处（report / acceptance-fixture / summary / results）数字按同一份 `_acc8-f-results.jsonl` 复算 |
| 裁-20z | **差集只比用例名会漏掉「同名掩蔽」**（独立终验第 4 轮实证）：`test/wp9/i19-orchestrator.test.js` 的 `newState 字段清单` 与 `object: 'session' ≤ 13` 两条在基线 `014fa6a` 里因 `EBUSY`（after 钩子清理）而红；I1.8 让它们改成**断言失败**（`testCodeFailure`/`ERR_ASSERTION`），名字一样、差集仍为 0 → 真实回归被同名红盖住 | AC-53 增**第 5 条核对项**：基线同名红必须连「失败类型」一起比（`failureType` 取自 `probe/i18-s2/baseline-014fa6a-full.log`），同名换类型一律计入差集。实测修完后 6 条全回 `hookFailed`、`masked=(空)` |
| 裁-20aa | **两处冻结断言的合法扩项（I1.8）**：① `newState` 的 `sessionPolicies` 必须**追加在 `traceId` 之后**——插在中间会打乱 I1.9 冻结的 18 字段前缀；② 两条冻结测试的**标题一律不改**——AC-53 按用例名比对基线红名单，改标题会把「基线已红」变成「新增红」（实测踩过一次），还会让 win32 平台基线表的逐字查找失败 | 扩项说明写进断言旁注释；`newState` 那条新增「第 19 个顶层字段恰为 `sessionPolicies` 且默认 null」单列断言，既有 18 项前缀与 health/traceId 位置一字未动 |

## 十八、需求修订授权与阻塞口径（裁-21，用户裁决）

> 触发：四轮独立终验一致判 FAIL、产品缺陷已归零，剩余 10 条全在需求文本与夹具。用户 2026-11-21 裁决如下。

| 编号 | 用户裁决原文 | 落地口径 |
|---|---|---|
| 裁-21a | 「**逐条修订 8 条需求冲突（推荐）**」 | 授权修订 `requirement.md` 的 8 条 AC（AC-15 / AC-23 / AC-37 / AC-42 / AC-43 / AC-45 / AC-63 / AC-67）的 Then 与机检：**只改「不可满足或被冻结基线否决」的分句**，需求意图（崩溃后不重放、有原因可见、保守降级）一律保留。修订稿须走独立评审后才可作为验收依据 |
| 裁-21b | 「**书面豁免视为满足**」（对 Done#2 的「阻塞 = 0」） | AC-26（锚点 `workspace/artifacts/**` 客观不存在）/ AC-27（本机无 `dsh` CLI）两条阻塞**在 Done 判定里视作满足**：`blocked` 计数仍如实记 2、原始帧保留、不改判「通过」；Done#2 的实际约束只剩「不通过 = 0」。**注意：这是 I1.8 迭代域内的裁决，未改 `docs/templates/execution-template.md` 的 §4.5 通用口径**——若后续迭代要沿用，须单独改模板并留痕 |

| 裁-21c | **AC-15 的排除清单必须覆盖全部「写快照必然动的元数据」**：按裁-21a 只排除 `state` / `stateSince` / `recovery` 仍不够——实测 `AC-15.given/then.state.json` 的差异还含 `rev`（1→3）、`updatedAt`、`health`（`normal`→`ended`）、`counters.eventSeq`（0→2），而 `recovery` 键实际并不存在 | 机检改为「**除 `state` / `stateSince` / `rev` / `updatedAt` / `health` / `counters.eventSeq` 外内容不变**（`nodes` / `sessions` / `handoffs` / `escalations` / `template` / `task` 等业务字段逐字不变）」。这是同一条裁决的补全，不是新授权：验收点仍是「**不猜测、不按检查点重建、节点/会话/交接包一个不动**」 |
| 裁-21d | **AC-37 / AC-42 / AC-23 的三处等价收窄（需求作者提出，主控采纳）** | ① AC-37 的节点行按实际模板写「节点 T-004 执行中 · 第 N 轮」——`orch status` 的节点行打的是**角色名**不是节点标题；② AC-42 的机检用「`round` **与崩溃前一致**」而非「一致或更大」，因为 BR-37 明写「轮次不增加」，写「或更大」会造出新的 BR↔AC 互斥；③ AC-23 的会话断言落可数锚点「会话条目只比 Given 多 1 条且事件 `sessionId` 指向它」，不用「可服务」这种无法判定的措辞 |

| 裁-21e | **AC-67 的改法（评审 v4-r1 的 B-02）**：只改 Then 消不掉互斥——标题「→ 保持「可用」」与 Then「冷却中」自相矛盾；引用 BR-24/BR-50 里 BR-24 是反义；§2.5 异常情况、§2.10 第 8 步、D-6 第一句仍在说「可用」而没申报；且 Given 里角色本就不是 `busy`，该条已空转（无 `recovery.role` 事件可验） | **一并授权改这四处**（仍属裁-21a「同一 AC 的可满足化」，不新增/删除 AC）：① 标题改「→ 按既有优先序显示（冷却中）」，并在 `report.md` / `acceptance-fixture.md` 的条目名同步（条目名不是 AC 编号，可改）；② 引用改指向真正的依据（角色六态派生 `busy > cooldown > available`，I1.5 契约），删掉反义的 BR-24；③ §2.5 / §2.10 / D-6 里「显示可用」改为「按既有派生规则显示（可能为冷却中）」，并在附录 C 申报；④ Given 补一句「服务节点都已终态（`doneCount > 0`）」，让该条有可验的触发面 |
| 裁-21f | **AC-23 / AC-63 的措辞收口（B-03 / B-04）** | ① AC-23 **删掉「并继续调度」**——实测该场景 `events` 里没有 `node.dispatch`，写上去就是无锚点的主张；改为只断言「实例保持「运行中」且 `halted === false`」，继续调度另行由 AC-31（降级后重新调度）与 AC-60（pending-ready 派发）覆盖，并在 Then 后加一句交叉引用；② AC-63 的机检「`session/new` 比单次崩溃少 1 次」按实测是 2 比 2、字面不成立，改为可判定锚点「`session.rebuilt` 恰 1 条、`session.rebuild_failed` 恰 1 条、`state.sessions` 恰 2 条」；③ AC-15 的排除清单**逐字照抄裁-21c 的 6 项**（删掉两侧都不存在的 `recovery`），并同步 BR-11 与 `requirement-understanding.md` |

| 裁-21g | **AC-67 的锚点与三处「不扩大范围」的确认**（作者第 2 轮提出） | ① **授权 AC-67 补一次取证**：在 Given 落盘后、恢复前各取一次 `orch role show`，恢复后再取一次，断言「前后两帧逐字相同（含「冷却中 · 活跃角色 0/1 · 服务节点 —」）」。这补的是**证据**不是需求——原机检「`roleToSessions` 无 developer 键」按实测不成立，换成「恢复前后派生结果不变」才真正验到「恢复不改写既有派生」；② **BR-22 不收窄**：它写的是「从 `assigned` / 待执行节点继续调度」，由 AC-31 / AC-60 承担验收，删掉 AC-23 的主张后 AC↔BR 已无互斥；③ **§1.3.1 的 AC-67 规划映射保留**：AC-67 现在验的正是「恢复不改写角色派生结果」，仍属该规划项的验收面 |

| 裁-21h | **v4 第 2 轮评审的 3 条阻断（B-02 残留 / B-03 残留 / B-05 新）的收口口径** | ① **AC-67 按裁-21g① 落成可判定的取证要求**：夹具行明确「在 Given 落盘后（恢复前）与恢复后各取一次 `orch role show`，两帧**逐字相同**（含「冷却中 · 活跃会话 0/1 · 服务节点 —」）」，并在机检里写成这条；② **AC-23 的机检改成 `state.state === 'running'`**（`halted === false` 单独没有判别力——实测 `interrupted` / `suspended` 的 `halted` 同样是 `false`），`halted` 只作为附带断言；③ **§2.3「实例不假装还在运行」改写**：「实例保持「运行中」（降级只降会话面），但**不得把降级伪装成恢复成功**——必须同时出现 `recovery.dialect` 的降级行与「节点已分配 / 角色可用 · 0/1 / 交接待投递」三处降级状态，角色不得仍显示「服务中」」。这样 §2.3 与 §2.4（正常恢复显示运行中）不再反向，也与 AC-23 新 Then 同口径 |

| 裁-21i | **v4 第 3 轮评审的 2 条阻断（B-06 / B-07）** | ① **B-06 授权改 C-10 与 BR-12 的同族句**：这两处仍写「恢复失败（无可用方言…）→ `interrupted` / 不假装运行」，与 AC-23 实测 `running` 对立。裁-21h③ 只清了 §2.3，属漏改而非新主张——现补明文授权：把 C-10 / BR-12 里「三方言都失败」这一支的结论改成与 §2.3 同口径（**实例保持运行中，但不得把降级伪装成恢复成功**；`interrupted` 只保留给「宿主不可达 / 恢复本身失败」那一支，即 C-10 原义）；② **B-07 属程序性缺口，不是回退**：BR-22 补「实例保持运行中并从 `assigned` / 待执行节点继续调度」是必需的（否则 AC-23 新 Then 引用悬空）、§3.3#1 的改动也是必需的（否则与 §2.3 反向）；两处都**保留改动**，但必须在附录 C 逐条登记「原文 / 改后 / 依据」，并修掉「同一张表里 BR-22 既记已改又记未改」的自相矛盾 |
| 裁-21j | **评审建议项 S-01~S-10 一并收口**（9 条，均为措辞与留痕，不扩大授权范围） | 逐条按评审意见改到可判定/可追溯：S-01「可服务」换成可数锚点、S-03 `stateSince` 归属说明、S-04②「前 12 行」改实数、S-05 说明「两文件条目名由主控同步」、S-06① 头部补裁决列表、S-07 `cooldown` 定义引用、S-08 §2.5 补 `doneCount` 前提、S-09 §2.3「角色可用」补前提、S-10 AC-67「恢复前」帧的取点口径（Given 落盘后、恢复动作之前） |

| 裁-21k | **`review-v4-round4.md` 总判 PASS（阻断 0 / 建议 4）后的主控处置**：S-01 指出 AC-45 的 `节点 T-003 → <当前节点>` 是 8 条里唯一朝「更容易通过」方向改的分句；S-02 / S-03 为 understanding 表未同步；S-04 为 AC-23 Then 的「角色可用」缺 `doneCount` 前提 | ① **S-01 采用比评审推荐更严格的做法**：`AC-45.part.md` C03 / C04 证明 `T-003` 实测成立、唯一不可满足的是「轮次 2/3」，故按裁-21a「只改不可满足的分句」**恢复 `T-003` 字面、只参数化轮次与上限**，并绑到 `session.timeout` 事件的 `detail.round` / `detail.maxRounds`（帧 seq31 实测 `1/2`）；附录 C 以 `v4-r5` 前缀追加 1 行「原文 / 改后 / 依据」，四层旧行一字不删。② S-02 / S-03 由主控同步到 `requirement-understanding.md`。③ S-04 在 AC-23 Then 补「`doneCount === 0`，本夹具现场成立」。④ 四项均**不改机检、不改判定、不改 `blocked` 计数**，不构成验收依据放宽 |

| 裁-21l | **AC-67「执行恢复动作之前」帧的操作化定义**（验收用例作者提出，主控采纳；与 `review-v4-round4.md` §7 的异议结论一致） | CLI 任何命令都走 `client.connect({ensure:true})`，核心启动即 `reconcileOnBoot`，**不存在「取 `role show` 但尚未发生任何恢复写盘」的路径**。故把「Given 落盘后、执行恢复动作之前」操作化为 `MAESTRO_TEST_RECOVERY_HOLD=after_assign` 的暂停点（`src/core/orchestrator.js` 约 `:5956`：恢复写入已落定、重新派发之前），在该点取前帧，释放 hold 后取后帧，整段逐字比对。理由：本条验的是「恢复不改写既有角色派生结果」，而 `roleToSessions` / `doneCount` 派生在恢复写入前后一致；两帧都含绝对串「冷却中 · 活跃会话 0/1 · 服务节点 —」，仍能证伪「恢复把角色强置为可用」的实现。**不改需求文本、不放宽断言**；若日后提供 `ensure:false` 只读通道，可补取严格更早的帧 |

**未获授权、维持原判的两项**：① AC-58 双项目根与 AC-62 投递失败接缝属**夹具返工**，需单独授权；② AC-56 判据改写（「等于基线值 2」+ 收窄扫描面）与 AC-53「基线 = 开工点 `014fa6a`」的口径，终验已两次指出授权链不足，仍待用户书面确认。
