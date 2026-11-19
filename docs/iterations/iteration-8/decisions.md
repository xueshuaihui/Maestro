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
