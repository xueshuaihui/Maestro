# I1.5 — 角色/技能注册表 + 内置角色扩展 + 角色实例模型

> 迭代：阶段一 · I1.5 ｜ 依据：`docs/index.md`（§1.5 任务类型五组、§3.3 角色状态与角色实例数据模型、§5.2 数据布局、§5.2 角色流程图、能力域 1 角色与技能资产、I1.5 条目）｜ 模板：`docs/templates/requirement-template.md`
> 状态：**定稿（v6）/ AC 45 条** ｜ 评审：第 1 轮 15 条阻塞、第 2 轮 8 条阻塞、第 3 轮 2 条阻塞全部收口；**第 4 轮独立评审 PASS**；**第 5 轮（拆分期独立评审）发现 4 处结构性缺陷并已修正**（D-7 第 2 条词表、A-5 用法块首行、D-5 的 `unknown-role` 优先级与排序键、D-3 的 YAML 明细语言）；**第 6 轮复评的 8 处连带修正见附录 C 的 v6 行**｜ 上游：I1.1 / I1.2 / I1.3 已收口（`docs/iterations/iteration-3/requirement.md` v5，418 条测试全绿）；I1.4 由其他同学并行实现（本迭代不依赖 I1.4 的任何新代码）
> 契约变更 **M-1 ~ M-9**、补充契约 **C-01 ~ C-13**；业务规则 **BR-01 ~ BR-29**；AC **45 条**；附录 A 输出基线、附录 B 术语与未决问题、附录 C 变更记录、附录 D 实现约束。
>
> **读法**：第二部分只写"我看得到、做得到"的事，不出现内部字段名与迁移表；第三部分每条 AC 都以用户可观察结果或明确的机检/夹具/架构检查开头；实现细节集中在附录 D。
>
> **本迭代的一句话**：把"角色、技能这些最基础的资产"从硬编码在代码里的 6 个名字，变成一份**可加载、可校验、可查询的定义资产**，并把"角色在这一次实例里到底在干什么"从一句文档描述，变成一份**随时可重算的角色实例视图**。

---

## 一、背景与问题

### 1.1 现状与问题

I1.1 ~ I1.3 之后，三种内建模板已经能自己转起来，但"角色"这件事在系统里仍然只是一串硬编码的字符串：

- **角色不是一个"东西"，只是一个 id**。`src/templates/index.js` 里 6 个角色各写了几行字：职责一句、要交什么、用哪套提示词。除此之外，一个角色该有哪些工具、能唤醒谁、产物是什么类型、能不能并行开多个会话，**一条都没有**。我想确认"审核者到底能写文件吗"，只能去读源码。
- **五组角色名存实亡**。`docs/index.md` 要求内置角色覆盖研究分析、内容创作、编码工程、业务运营、通用协调五组，每组的产物形态和副作用完全不同。现在 `src/templates/index.js` 的 6 个角色只落在三组（编码工程 / 内容创作 / 通用协调），研究分析与业务运营两组一个角色都没有；单节点模板用的 `worker` 甚至不在任何角色表里（`ROLE_LABEL` 里查不到它）。
- **技能完全不存在**。规划里"角色引用可复用的技能包（提示词 + 工作方法 + 可选验证命令）"，现在没有任何加载点；"引用不存在的技能"这种错误**根本不会发生，因为不存在引用**——但也就意味着，一旦下周开始写自定义角色（I1.6），第一批坏配置会直接跑起来，跑到一半才出错。
- **没有任何一处能回答"这个角色现在在干什么"**。节点有状态、会话有状态、交接包有状态，唯独角色没有。角色流程图（I1.10a 主视图）的数据源被明确规定是**角色实例**，而现在这个数据源不存在：谁在服务哪几个节点、开了几个会话、还能不能再开一个，全靠人肉从 `state.json` 里数。
- **`inactive` 是一句空话**。规划里"工作流定义了该角色，但本实例中尚未绑定任何节点 → 灰色显示、不参与路由"，现在既没有"工作流定义了哪些角色"这个声明，也没有"灰色"的计算规则。

**不解决会怎样**：I1.6 的自定义角色与派生角色、I1.7 的产物类型隔离（`artifact_type` 是角色契约字段）、I1.10a 的角色流程图（数据源是角色实例）、I1.11 的资产库浏览（要列出角色与技能），都要先有"注册表 + 角色实例"这两块地基。这一轮不做，后面每加一个角色就要再改一次模板代码，每加一个视图就要再猜一次"角色的状态到底怎么算"。

### 1.2 目标与成功衡量

| # | 指标 | 目标值 | 怎么量 |
|---|---|---|---|
| 1 | 内置角色数 / 覆盖分组数 | 16 个 / 5 组，每组 ≥ 2 | `orch role list --format json` 的 `counts.total` 与 `groups[].count` |
| 2 | 内置技能数 / 无人引用的技能数 | 10 个 / 0 个 | `orch role validate --format json` 的 `skills` 计数 + 全角色技能并集 |
| 3 | 角色契约缺字段、技能引用悬空、取值越界时**跑起来才发现**的次数 | 0 次 | 对 8 类坏配置逐项各跑一次 `orch role validate` 与 `orch run`，全部在发起前被拒 |
| 4 | 需要读源码才能回答"这个角色能做什么"的次数 | 0 次 | `orch role show <id>` 一条命令给出职责、技能、工具、唤醒白名单、并发上限、来源文件 |
| 5 | 需要数 `state.json` 才能回答"这个角色在干什么"的次数 | 0 次 | `orch role show <id> --instance <实例号>` 给出状态、活跃会话数/上限、服务节点、宿主、最近动作 |
| 6 | 角色实例状态的判定歧义 | 0 处 | 6 个状态各有一条 AC，判定优先级在附录 D-5 定死为 `retired > unknown-role > inactive > unavailable > busy > cooldown > available` |
| 7 | 既有三条主链的输出变化 | 0 处 | `single` / `code-loop` / `task-loop` 三条主链逐字回归；418 条既有测试除授权清单外全绿 |
| 8 | 新增运行时依赖 | 0 个 | 读 `package.json` 的 `dependencies`，键数量为 0（YAML 子集解析自实现） |

### 1.3 范围

**范围内**

1. **角色注册表**：定义 `roles/*.yaml` 的字段契约与校验规则；内置角色随仓库分发（`assets/roles/`），项目级角色放 `.orch/roles/`，两者合并加载，同名 id 以项目文件为准。两层都是只读加载，本迭代不提供写入命令。
2. **注册表加载与校验**：YAML 子集解析（零依赖）、必填字段、id 与文件名一致、分组取值、产物类型、副作用等级、并发上限范围、技能引用可解析；错误按资产逐条报出，带原因码与文件名。
3. **技能注册表**：`skills/<id>/SKILL.md` 加载，前置元数据（id / 名称 / 摘要 / 适用分组）解析、正文非空校验、目录名与 id 一致；角色对技能的引用解析成技能对象。项目级技能放 `.orch/skills/<id>/SKILL.md`，同 id 覆盖内置。
4. **内置角色扩展至 16 个**，覆盖五组：通用协调 5、研究分析 3、内容创作 3、编码工程 3、业务运营 2；现有三种模板用到的 6 个角色 + 单节点的 `worker` 全部在表内，中文名与既有状态行逐字一致。
5. **内置技能 10 个**，每个至少被一个角色引用；技能正文写"工作方法"，供 I1.6 起拼进提示词。
6. **角色实例模型**：按"工作流声明的角色 ∪ 图中节点角色"为每个角色建一个角色实例，记录状态、活跃会话、服务节点、宿主、并发上限与最近动作；提供 `role_to_sessions` 映射；`inactive` / `available` / `busy` / `cooldown` / `unavailable` / `retired` 六个状态的计算规则与判定优先级。
7. **图角色声明**：三种内建图显式声明参与角色；`code-loop` 声明协调者为"参与者但不绑定节点"，用来承载 `inactive`。
8. **CLI 角色命令集**：`orch role list [--group <组>] [--instance <实例号>] [--format text|json]`、`orch role show <角色> [--instance <实例号>] [--format text|json]`、`orch role validate [<角色>] [--format json]`；全部只读：不带 `--instance` 时不连接也不启动核心，带 `--instance` 时按 `status` 的既有口径连核心（C-09）。
9. **发起前预检**：`orch run` 在启动核心之前校验注册表；不合法时退出码 3，不建会话、不派发、不留半个实例。
10. **兼容与纯净**：I1.1 ~ I1.3 的输出与调用方式不回归；`src/core`、`src/daemon` 不出现角色名、技能名、模板名字面量；零运行时依赖。

**范围外**

| 不做的事 | 留给谁 | 备注 |
|---|---|---|
| 角色的创建 / 编辑 / 派生（从零、从内置派生）/ 导入导出 / diff | I1.6 | 本迭代只做"加载 + 校验 + 查询"，不改写资产文件 |
| `orch skill list / show / create / validate / export / import` | I1.6 | 本迭代技能只在角色解析与校验中被引用；`role validate` 会报告技能资产结果 |
| 工作流文件 `workflows/*.yaml` 与工作流校验器 | I1.6 | 本迭代"工作流声明的角色"落在内建图对象的 `roles` 字段上，不引入工作流文件 |
| 把角色契约/技能正文拼进派发提示词 | I1.6 | 提示词有逐字断言；注入技能正文会改动既有提示词字节，本轮不做 |
| 派发时强制 `max_concurrent_sessions` 上限（拒绝第 N+1 个会话） | I1.6 / I1.7 | 并行 fan-out 原语在 I1.6；本迭代只落字段并在视图上显示 `活跃/上限` |
| `artifact_type` 驱动的产物隔离（worktree / 版本化文件区 / 快照 / 只追加区） | I1.7 | 本迭代只把 `artifact_type` 作为角色契约字段加载与校验 |
| 角色流程图渲染（布局、状态色、角标、拖拽、折叠） | I1.10a / I1.10b | 本迭代只交付**数据模型与计算规则**，不出图形 |
| 角色实例写入 `state.json` | 不做 | 角色实例是派生视图（附录 D-5），避免与节点/会话状态形成第二份真相 |
| 跨宿主 `host_icons` 并列 | I2.3 | 本迭代宿主来自实例内会话的 `hostId`，单宿主；多宿主混跑在阶段二 |
| 角色/技能资产的权限、签名、版本锁定 | I1.12 | 本迭代不做 ACL 与链式哈希 |

### 1.3.1 与 I1.5 规划的逐项对应

| 规划条目（`docs/index.md` I1.5） | 本需求落点 | 验收 |
|---|---|---|
| 角色注册表：`roles/*.yaml` 加载、schema 校验（静态配置） | §2.2、§2.3；附录 D-2 / D-3 / D-4 | AC-01 ~ AC-11 |
| 技能注册表：`skills/*/SKILL.md` 加载、技能引用解析 | §2.4；附录 D-3 | AC-08、AC-12 ~ AC-16、AC-45 |
| 内置角色扩展至约 15 个，覆盖五组 | §2.5；附录 A-1 | AC-17 ~ AC-19 |
| 内置技能约 10 个 | §2.5；附录 A-1 | AC-12 |
| 角色实例模型：`role_instance` 数据模型、`role_to_sessions` 映射、`max_concurrent_sessions` 字段、`inactive` 状态计算规则 | §2.6；附录 A-6、D-5 | AC-20 ~ AC-31 |
| CLI 角色命令集：`orch role list / show / validate` | §2.7；附录 A-2 ~ A-5 | AC-32 ~ AC-39 |
| **验收**：`orch role list` 列出全部角色 | §2.7 | AC-01、AC-32、AC-33 |
| **验收**：引用不存在的技能时加载被拒绝 | §2.3 | AC-08、AC-10 |
| **验收**：角色实例能记录活跃会话和服务节点 | §2.6 | AC-21、AC-22、AC-29 |
| **验收**：`inactive` 状态正确计算 | §2.6 | AC-25、AC-20 |
| 能力域 1「关键分离：角色注册表（静态）与角色实例（运行时）」 | §2.6、附录 D-5 | AC-21、AC-30 |
| 能力域 1「角色校验：schema 完整性、技能引用有效」 | §2.3 | AC-04 ~ AC-09、AC-13 ~ AC-16 |
| 能力域 1「契约连通、权限闭环、派生链无循环」 | **不在本轮** | 依赖工作流与派生（I1.6），登记为 R-4 |
| `docs/index.md:690`「协调者角色在 I1.5 注册表启用时再进图」 | §2.6、M-1 | AC-20、AC-25 |

**规划解释登记（R）**

| 编号 | 解释 | 理由 |
|---|---|---|
| R-1 | 内置资产落在仓库根的 `assets/roles/` 与 `assets/skills/`，项目级资产落在项目根的 `.orch/roles/`；`docs/index.md` §5.2 的 `.orch/roles/` 只表示"项目级可变区"，内置资产随程序分发，不能写进用户项目 | 内置资产必须在只读安装目录里可用；写进 `.orch/` 会让每个项目各存一份副本，升级时全部过期 |
| R-2 | `orch role validate` 通过时退出 0；`orch role list` 遇坏资产**仍列出合法角色**，但以退出 1 结束并在末行提示去看 validate | 用户坏了一个项目角色时，不应该连"有哪些角色"都看不到（fail-soft 展示、fail-fast 校验分离） |
| R-3 | `orch run` 的注册表预检在 CLI 侧完成（启动核心之前），不引入核心对注册表的依赖 | 注册表是静态资产，不是实例状态；核心引入注册表读取会把"资产坏了"变成"实例半启动"，且与 I1.4 正在改的 IPC 面正面冲突 |
| R-4 | "契约连通 / 权限闭环 / 派生链无循环"三类校验不在 I1.5：本迭代没有工作流文件、没有派生角色、没有跨角色权限图 | 无对象的校验只能造假数据；I1.6 引入工作流与派生后再校验 |
| R-5 | 角色实例是**派生视图**：不写 `state.json`，由 CLI 用"实例快照 + 图 + 注册表"现算 | 与 §6.9「连接线聚合状态是派生视图」同一口径；写进状态会让 `rev`/CAS 面扩大，且节点与会话已是唯一真相 |
| R-6 | 技能正文本轮不拼进提示词 | 既有提示词有逐字断言（`test/templates/task-loop.test.js`）；拼技能正文等于改提示词字节，留给 I1.6 连同自定义角色一起做 |
| R-7 | `max_concurrent_sessions` 本轮只做"字段 + 视图显示"，不做出派发拦截 | 拦截需要 I1.6 的并行原语与 I1.7 的隔离空间；本轮拦截会改变既有单会话派发行为，踩回归红线 |
| R-8 | 单节点模板的角色 `worker` 补进注册表，归入「通用协调」组 | 它必须能被 `role list` 查到、被 `role show` 解释；不给它建注册项就会让"图中角色必须可解析"这条规则当场自相矛盾 |

### 1.4 对 I1.1 / I1.2 / I1.3 契约的修改（授权变更）

> 说明：M 是"必须改代码 / 数据结构"的变更；C 是补充契约（实现时必须按此口径，避免出现两套解释）。未列出的既有契约保持不变。

| 编号 | 现状（I1.3 v5 / 代码） | 变更 | 为什么 | 兼容 / 影响 |
|---|---|---|---|---|
| **M-1** | `src/templates/index.js` 的三个图只有 `nodes` / `edges` / `maxRounds` 等字段；"工作流定义了哪些角色"无处表达 | 三个图各增 `roles` 声明：`single: ['worker']`、`code-loop: ['developer','tester','coordinator']`、`task-loop: ['researcher','writer','reviewer']`；图对象**只增字段**，节点、边、`maxRounds`、`terminals`、`productPolicy` 一律不动 | `inactive` 的定义是"工作流声明了但没绑定节点"，没有声明就没有 `inactive`；`docs/index.md:690` 已把协调者进图的时间点定在 I1.5 | 新增字段不参与派发、不进提示词、不进 CLI 输出；`test/templates/task-loop.test.js` 对 `GRAPHS` 键与 `productPolicy` 的断言不受影响 |
| **M-2** | 没有注册表模块；YAML 解析无实现（零依赖约束） | 新增 `src/registry/`：`yaml-lite.js`（YAML 子集解析）、`skill-file.js`（SKILL.md 前置元数据）、`role-schema.js`（角色/技能字段校验）、`index.js`（加载与合并）、`role-instances.js`（角色实例计算）、`assets.js`（内置资产目录定位） | 加载、校验、计算三件事各有唯一入口，CLI 与测试共用同一套实现 | 全部新增文件；`src/core`、`src/daemon` 不 import 这些模块（核心不依赖注册表，见 R-3） |
| **M-3** | 内置角色只有 6 个硬编码常量，无资产文件；技能不存在 | 新增 `assets/roles/*.yaml`（16 个）与 `assets/skills/<id>/SKILL.md`（10 个）；`src/templates/index.js` 的 `ROLES` 常量保持原样（不删、不改），注册表与它是两套用途：前者是**资产定义**，后者是**模板派发所需的提示词键** | 删 `ROLES` 会让派发路径与 6 个既有断言一起改，属于无谓回归；两者职责不同，允许并存，并由对照测试锁住中文名一致 | 只增文件；`ROLES` 与 `labels.js` 的既有断言不变 |
| **M-4** | CLI 只有 `run/status/cancel/core`；`VALUE_FLAGS` 无 `group`/`format`；`COMMANDS` 无 `role` | 命令树新增 `role list|show|validate`；新增 `--group`、`--format`；`runCommand` 在启动核心前插入注册表预检（模板名校验同时前移），`PREFLIGHT_CODES` 新增 `REGISTRY_INVALID`（退出码 3） | 规划要求 `orch role list / show / validate`；坏的注册表必须在"发起了才发现"之前拦住 | 旧命令、旧参数、旧退出码逐字不变；未放 `.orch/roles/` 的项目行为与今天一致（只加载内置资产） |
| **M-5** | `labels.js` 无分组名、角色实例状态名、role 命令文案；用法行 `USAGE_LINES` 放在 `render.js` | `labels.js` 新增 `GROUP_LABEL`（分组名）、`ROLE_INSTANCE_STATUS_LABEL`（六态名）、`ROLE_CLI_TEXT`（命令文案）、`REGISTRY_ERROR`（14 条明细模板）、`YAML_DETAIL`（5 条解析明细）；`USAGE_LINES` 从 `render.js` 迁入 `labels.js`（**文本逐字不变**），`render.js` 改为 import | 规则是"中文唯一来源是 `labels.js`"，而用法行一直是例外；新增大量 role 文案后这个例外会变成两套来源 | `renderUsage` 输出逐字不变（迁移不改一个字符）；`test/wp2/labels.test.js` 对既有表的断言不受影响（不改动既有 6 张表） |
| **M-6** | `render.js` 无角色渲染函数 | 新增 `renderRoleList` / `renderRoleShow` / `renderRoleValidate`，纯函数、只 import `labels.js`，不读文件、不发 IPC | 与既有渲染层同一纪律（纯函数、可单测） | 只增函数；既有渲染分支一行不动 |
| **M-7** | 测试基线 418 条；既无 `test/wp11`，也无角色/技能/注册表相关用例 | 新增 `test/wp11/**`（8 个用例文件，清单见 D-9）+ 对照测试；授权修改清单见附录 D-8 | 新能力必须可独立验证 | 只新增测试；**不修改任何既有断言**（D-8 的"授权断言修改"一节为空，只有 3 项非断言改动），未列出的一律不动 |
| **M-8** | `src/core/advance.js:65`、`src/core/orchestrator.js:1856`、`src/core/orchestrator.js:2267` 三处注释里出现 `planner` 一词 | 三处注释改为 `dispatcher` / `scheduler` 等同义说法（**纯注释，零行为变化**） | 新增内置角色 id `planner` 要进 D-7 禁词表，而这三处是引擎注释里的普通英文词，不改就无法让扫描 exit 0 | 只改注释文字；任何代码、断言、输出、事件都不变 |
| **M-9** | `parseArgs` 的 `VALUE_FLAGS` 是全局集合，任何命令都接受同一批标志 | 新增 `--group` / `--format` **只在对应 `role` 子命令下合法**；`orch run --format json`、`orch status --group x` 仍是用法错误 | 全局放开标志会把"用法错误"变成"静默接受"，属于对既有 CLI 契约的隐性放宽 | 既有命令的可接受标志集合一个都不变；`未知参数` 文案沿用 A-5 |

#### 补充契约条目（C-01 ~ C-13）

| 编号 | 契约 |
|---|---|
| C-01 | 角色 id 与技能 id 只能由小写字母、数字、连字符组成（`^[a-z][a-z0-9-]*$`），长度 2~32；角色文件名必须是 `<id>.yaml`，技能目录名必须是 `<id>`，两者与声明的 `id` 不一致一律判不合法。 |
| C-02 | 项目级资产与内置资产按 id 合并：同 id 时项目版**整体覆盖**内置版（不逐字段合并），`source` 标记为 `project`；项目目录不存在视为"没有项目资产"，不是错误。 |
| C-03 | 注册表加载全程只读：不创建任何目录（包括 `.orch/`）、不写文件、不联网、不读实例状态。 |
| C-04 | 角色实例集合 = 图 `roles` 声明 ∪ 图中全部节点 `roleId`，去重后按「分组顺序 → id 字典序」稳定排序；每个角色恰好一个角色实例，编号形如 `RI-<roleId>`。 |
| C-05 | 角色实例状态判定优先级固定为 `retired > unknown-role > inactive > unavailable > busy > cooldown > available`，命中即停，不允许出现两个状态同时成立的口径。`unknown-role` 是 `unavailable` 的子情形（`statusReason='unknown-role'`），但判定顺序**先于** `inactive`——否则"图里声明了、yaml 被删、又没有节点绑定"的角色会被算成 `inactive`（v5 修正）。 |
| C-06 | 活跃会话 = 该角色名下节点当前绑定的会话中，**会话状态不是 `idle` 或 `quarantined === true`** 的那些（隔离路径会把状态置回 `idle`，只按状态判会漏掉它）；`activeSessions` 按创建顺序排列；被隔离的会话计入活跃列表，同时该角色状态判为 `unavailable`。 |
| C-07 | 角色实例不写入 `state.json`，也不写入任何新文件；它由"实例快照 + 图 + 注册表"现算，任何时刻都可重算，且重算结果只取决于这三份输入。 |
| C-08 | 角色与技能的中文名、职责摘要只来自资产文件；`labels.js` 只放分组名、角色实例状态名、命令文案与错误文案。同名角色的中文名必须与 `labels.js` 里既有条目逐字一致，由对照测试锁住。 |
| C-09 | **不带 `--instance`** 的 `role list` / `role show` / `role validate` 不连接核心、不启动核心、不创建 `.orch`。**带 `--instance`** 时按既有 `status` 的口径连核心（`connect({ensure:true})`，必要时拉起），再经 `instance.get` 取快照：实例不存在 → `找不到实例：<id>` 退出 1；核心起不来 → 沿用既有 `CORE_START_FAILED` / `CORE_NOT_RUNNING` 文案与退出码（3 / 1），不新增错误码。 |
| C-10 | `run` 的预检顺序固定为：任务非空与模板存在 → 注册表合法 → 启动核心。注册表不合法时打印第一条错误明细并退出 3，**不创建 `.orch/instances`**。模板名非法时沿用既有 `TEMPLATE_UNKNOWN` 文案与退出码 1（`test/wp6/main.test.js:247` 是这条的回归点），只是判定时机前移到启动核心之前。 |
| C-11 | 注册表错误码是**资产级**原因码（`YAML_PARSE_FAILED` / `ROLE_SCHEMA_MISSING` / `ROLE_ID_MISMATCH` / `ROLE_GROUP_INVALID` / `ROLE_ARTIFACT_TYPE_INVALID` / `ROLE_SIDE_EFFECT_INVALID` / `ROLE_MAX_CONCURRENT_INVALID` / `ROLE_SKILL_NOT_FOUND` / `SKILL_FILE_MISSING` / `SKILL_SCHEMA_MISSING` / `SKILL_ID_MISMATCH` / `SKILL_BODY_EMPTY` / `SKILL_GROUP_INVALID` / `REGISTRY_ASSETS_MISSING`，共 14 个），只出现在资产校验输出里，不并入既有 `ERROR_TEMPLATE` 的通用错误码表；`orch run` 的预检失败用**命令级**失败码 `REGISTRY_INVALID`（只决定退出 3 与 `注册表不合法：` 文案），不进入资产错误表。 |
| C-12 | 角色实例的 JSON 字段一律 camelCase（`roleId` / `activeSessions` / `servingNodes` / `hostIcons` / `maxConcurrentSessions`）；`docs/index.md` §3.3 的 `role_instance` 示例是 snake_case 且 `last_action_summary` 为字符串。本轮按 camelCase + `lastAction` 对象实现，字段映射为：`role_id→roleId`、`active_sessions→activeSessions`、`serving_nodes→servingNodes`、`host_icons→hostIcons`、`max_concurrent_sessions→maxConcurrentSessions`、`last_action_summary→lastAction`（字符串改为结构化对象，文本由渲染层拼）；状态枚举以本需求 6 态为准（上游示例的 `status` 缺 `retired`）。差异在 `decisions.md` 登记，不改 `docs/index.md`。 |
| C-13 | 中文名的唯一来源是资产文件（`name` 字段）；`labels.js` 的 `ROLE_LABEL` 保留既有 6 个键以免破坏逐字渲染，但不得新增键。两者一致性由对照用例锁定（AC-18），以资产为准。 |

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| # | 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|---|
| A | 角色注册表 | 我 / 后续工作流设计者 | 角色从"代码里的字符串"变成可加载、可覆盖的定义资产 | 完整：加载 + 合并 + 校验 + 查询 |
| B | 技能注册表 | 我 / 角色作者 | 角色引用的技能包有明确的落点与解析结果 | 完整：加载 + 引用解析 + 校验（正文不拼提示词） |
| C | 内置角色库 | 我（选模板、看流程图时） | 五组角色齐备，能覆盖研究/写作/编码/运营/协调 | 完整：16 个角色、10 个技能、五组各 ≥ 2 |
| D | 角色实例 | 我（看"谁在干什么"时） | 角色在这一次实例里的状态、会话、服务节点可查 | 完整：模型 + 六个状态计算规则 + 派生视图 |
| E | 角色命令集 | 我（日常运维） | 用三条命令看清资产与实例，不用读源码、不用数 JSON | 完整：`list` / `show` / `validate`，含 JSON 输出 |
| F | 发起前预检 | 我（启动实例时） | 坏配置在发起前就被拦住，而不是跑到一半才出错 | 完整：退出码 3 + 第一条错误明细 |

### 2.2 A 角色注册表：角色变成一份能看懂的定义

- **使用角色**：我；后续要写自定义角色的人（I1.6）。
- **使用场景**：我想知道系统里有哪些角色、每个角色能做什么；我在自己项目里放了一个改过的角色定义，希望它生效。
- **用户操作**：执行 `orch role list`；或在自己的项目根建 `.orch/roles/<角色>.yaml` 写一份定义。
- **预期效果**：`orch role list` 一行一个角色，给出 id、中文名、分组、产物类型、副作用等级、技能数、并发上限，并在首行给出"共 N 个（内置 a · 项目 b）"。项目里放的同名文件会覆盖内置定义，`orch role show` 的来源一行会写 `项目`。
- **异常情况**：某个角色文件写坏了，`role list` 仍然把合法的角色列出来，但末行提示"N 个资产未通过校验"，命令以退出码 1 结束；`orch role validate` 会逐条列出坏在哪、缺什么字段、哪个技能不存在。
- **边界说明**：本迭代不支持在命令里创建/编辑角色（I1.6）；角色文件只能手工放进去。

### 2.3 B 注册表校验：坏了就在发起前说清楚

- **使用角色**：我。
- **使用场景**：我改了一份角色定义，或者从别处拷了一份进来，不确定对不对。
- **用户操作**：执行 `orch role validate`（全部）或 `orch role validate <角色>`（单个）；然后照常 `orch run`。
- **预期效果**：全部合法时给出一行"校验资产 N 个：全部通过（角色 16 · 技能 10）"并以 0 退出；不合法时逐条列出 `文件名：原因（原因码）`，并以 1 退出。
- **异常情况**：注册表不合法时 `orch run` 在**发起前**停住：打印第一条错误明细，退出码 3，不建会话、不派发、不留下 `.orch/instances/` 目录。
- **边界说明**：校验只覆盖"资产自身是否成立"与"技能引用是否存在"；契约连通、权限闭环、派生链无循环不在本轮（R-4）。

### 2.4 C 技能注册表：角色引用的技能包有落点

- **使用角色**：我 / 角色作者。
- **使用场景**：一个角色声明 `skills: [code-change, test-run]`，我要确认这两个技能真实存在、内容不空。
- **用户操作**：`orch role show <角色>` 看技能列表；`orch role validate` 看技能资产是否齐全。
- **预期效果**：每个技能是 `skills/<id>/SKILL.md`，前置元数据声明 id、名称、摘要、适用分组，正文写"工作方法"。技能 id 与目录名不一致、缺必填字段、正文为空都算不合法。
- **异常情况**：角色引用了不存在的技能 → 该角色文件判不合法，原因码 `ROLE_SKILL_NOT_FOUND`，并指名是哪个技能。
- **边界说明**：技能正文本轮不拼进派发提示词（R-6），技能也不单独提供 `orch skill` 命令（I1.6）。

### 2.5 D 内置角色库：五组齐备，老角色不改口

- **使用角色**：我（选模板、看流程图、给团队解释"这个工具能干什么"时）。
- **使用场景**：我要用文档闭环，需要知道"研究员 / 撰写者 / 审核者"各能做什么；我要用编码闭环，需要知道"开发 / 测试"的边界；我想给运营类任务找个角色。
- **用户操作**：`orch role list` 看全表；`orch role show <角色>` 看细节。
- **预期效果**：16 个角色、五组：通用协调（协调者 / 规划者 / 汇总者 / 裁决者 / 执行者）、研究分析（研究员 / 事实核查员 / 数据分析师）、内容创作（撰写者 / 编辑 / 审核者）、编码工程（开发 / 测试 / 代码审查）、业务运营（需求澄清者 / 合规审查者）。原有 6 个角色的中文名与现在状态行里的叫法**一模一样**。
- **异常情况**：无（这是内置资产）。若内置资产被删或损坏，等同注册表不合法：`role validate` 报错、`run` 退出 3。
- **边界说明**：`artifact_type` 只作为契约字段展示与校验，本轮不驱动目录隔离（I1.7）；角色不改变既有模板的提示词与输出。

### 2.6 E 角色实例：这一次，谁在干什么

- **使用角色**：我（看实例状态时）；后续角色流程图（I1.10a）。
- **使用场景**：编码闭环跑到一半，我想知道"测试到底在不在忙、开了几个会话、还能不能再开"；协调者明明在定义里，为什么流程图上没动静。
- **用户操作**：`orch role show <角色> --instance <实例号>`。
- **预期效果**：在角色契约之后追加一行实例状态：状态（未参与 / 可用 / 服务中 / 冷却中 / 不可用 / 已关闭）、活跃会话数/上限、服务节点、宿主、最近动作。六个状态的判定规则写死在附录 D-5，同一份状态只会有一个结论。
- **异常情况**：角色不在本实例的声明里 → 明确写"本实例未使用该角色"，而不是显示一个假的"未参与"；实例号不存在 → 退出码 1。
- **边界说明**：角色实例是**派生视图**：不落盘、不参与状态迁移、不改变 `rev`；删掉注册表文件后角色定义查不到，但实例侧的角色实例仍按同一套规则重算（本轮不做这种删除场景的兜底，只保证"不落盘、可重算"）。

### 2.7 F 角色命令集与发起前预检

- **使用角色**：我。
- **使用场景**：日常查资产、查角色实例、改完配置先自检、启动实例。
- **用户操作**：

| 命令 | 作用 | 备注 |
|---|---|---|
| `orch role list` | 列出全部角色 + 分组计数 | `--group <组>` 只列该组；`--instance <实例号>` 每行追加实例状态；`--format json` 供机器读取 |
| `orch role show <角色>` | 角色契约全貌 | `--instance <实例号>` 追加实例状态；`--format json` 同上 |
| `orch role validate [<角色>]` | 校验资产并逐条报错 | 通过 0 / 不合法 1 |
| `orch run …` | 发起实例（预检注册表） | 注册表不合法 → 退出 3，不发核心 |

- **预期效果**：四条路径都不需要读源码、不需要 `jq` 数 JSON。
- **异常情况**：`role` 后跟未知子命令、多余参数、`--format` 取值不是 `text|json`、`show` 缺角色参数 → 都是用法错误，退出码 2 并打印用法；找不到角色 / 找不到实例 → 退出码 1 并指名。
- **边界说明**：不带 `--instance` 的 role 命令不连接也不启动核心；`role list --instance` 与 `role show --instance` 按 `status` 的既有口径连核心（必要时拉起），再由 `instance.get` 取快照。

### 2.8 功能之间的衔接：走完一遍

1. 我在空项目里敲 `orch role list`：首行是 `角色 16 个（内置 16 · 项目 0）`，随后 16 个角色按五组列出（没有坏资产时不出末行提示）。
2. 我挑一个角色细看：`orch role show researcher`：职责、技能、工具、唤醒白名单、并发上限、来源文件一目了然。
3. 我在 `.orch/roles/researcher.yaml` 放了一份自己的定义（多引用一个技能），再 `orch role show researcher`：来源变成 `项目`，技能列表跟着变。
4. 我把技能名写错一个字母，`orch role validate`：一条 `ROLE_SKILL_NOT_FOUND`，指名拼错的技能；`orch run` 直接退出 3，没有起核心。
5. 我改对之后 `orch run --template code-loop …` 正常跑起来；跑到测试节点时 `orch role show tester --instance INST-001` 显示「服务中 · 活跃会话 1/1 · 服务节点 T-002 · 宿主 dsh」。
6. 同时 `orch role show coordinator --instance INST-001` 显示「未参与 · 活跃会话 0/1 · 服务节点 —」——它在注册表里、也被本实例声明为参与角色，但没有任何节点绑定它，所以灰色、不派发。

### 2.9 用户可见的业务规则

| 编号 | 规则 |
|---|---|
| BR-01 | 角色注册表是静态定义资产：内置角色随程序分发，项目可以在 `.orch/roles/` 放自己的角色文件；同 id 时项目版生效。 |
| BR-02 | 每个角色必须声明：id、中文名、分组、职责摘要、产物类型、副作用等级、技能列表、并发上限；缺任一项即不合法。 |
| BR-03 | 角色引用的技能必须真实存在；引用不存在的技能的角色文件不合法。 |
| BR-04 | 角色 id 必须与文件名一致；技能 id 必须与目录名一致。 |
| BR-05 | 资产不合法时 `role list` 仍列出合法角色，但以失败退出并提示去跑 `role validate`。 |
| BR-06 | 资产不合法时 `orch run` 在发起前停住（退出码 3），不建会话、不派发、不留半个实例。 |
| BR-07 | 技能以 `skills/<id>/SKILL.md` 存在：前置元数据声明 id、名称、摘要、适用分组；正文写工作方法，不能为空。 |
| BR-08 | 技能目录缺 SKILL.md、元数据缺字段、id 与目录名不一致、正文为空，都不合法。 |
| BR-09 | 内置角色覆盖五组，每组至少 2 个。 |
| BR-10 | 内置技能 10 个，每个至少被一个角色引用。 |
| BR-11 | 同一角色在同一实例中只有一个角色实例；角色实例按"工作流声明的角色 + 图中节点角色"建立。 |
| BR-12 | `inactive`：工作流声明了该角色，但本实例没有任何节点绑定它 → 灰色、不参与派发。 |
| BR-13 | `busy`：该角色正在服务至少一个节点（节点处于执行中或待校验）。 |
| BR-14 | `cooldown`：该角色没有正在服务的节点，但至少完成过一个节点，且实例仍在运行。 |
| BR-15 | `available`：该角色有绑定节点，但没有正在服务的节点、没有已完成节点，也不存在"不可用"信号（典型情形是节点都还没开始）。它是六态判定里排在最后的兜底状态。 |
| BR-16 | `unavailable`：该角色任一绑定会话被隔离或已升级；角色在本实例里存在、但注册表中查不到时也判为 `unavailable`（原因 `unknown-role`）。 |
| BR-17 | `retired`：实例已结束，角色实例一并关闭，历史仍可查。 |
| BR-18 | 角色实例记录活跃会话、服务节点、宿主、并发上限与最近动作；活跃会话数与并发上限同时展示。 |
| BR-19 | 角色到会话的映射保留该角色名下全部会话（同一角色回流后可能有多个会话）。 |
| BR-20 | 角色实例是派生视图：随时从当前实例状态重算，不单独落盘，也不与状态互相覆盖。 |
| BR-21 | `role list` 列出全部合法角色与分组计数；`--group` 过滤；`--format json` 供机器读取。 |
| BR-22 | `role show <角色>` 展示角色契约全貌；带 `--instance` 时追加该实例的角色实例状态。 |
| BR-23 | `role validate` 逐条报告不合法资产与原因码；全部合法时给出资产计数并以 0 退出。 |
| BR-24 | 角色命令只读：不带 `--instance` 时不创建 `.orch`、不改任何实例状态、不启动核心；带 `--instance` 时按 `status` 的既有口径连核心（可拉起常驻核心），但**仍只读**，不写实例状态、不建会话。 |
| BR-25 | 找不到角色或实例 → 退出码 1；用法错误 → 退出码 2。 |
| BR-26 | 角色命令的中文文案只在 `labels.js`；`src/core`、`src/daemon`、`src/registry` 与 `src/cli/roles.js` 不出现附录 D-7 词表里的资产名字面量（`src/registry` 按 D-7 的 **30 词**口径，`GROUPS` 里那个 `coordinator` 是唯一例外，由定点断言锁住只出现 1 行）。词表的取舍口径写在 D-7：`single` 因与图 id、提示词键同名共形且是通用英文词不进表；10 个新增角色的中文名因与"测试/开发/编辑"这类通用词冲突不进表（只收 I1.3 已收的 3 个）。 |
| BR-27 | 注册表加载不引入第三方依赖、不联网。 |
| BR-28 | 新增角色不改变既有三条主链的输出：`single` / `code-loop` / `task-loop` 逐字不变。 |
| BR-29 | 项目级技能可以覆盖内置同名技能：覆盖后角色解析到的是项目版（名称、摘要、正文都以项目文件为准）。 |

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> **观测口径**：本迭代允许四类观测——① **命令输出**（用户直接看到）；② **机检**：`orch role … --format json` 的字段、项目根下的 `.orch/roles/**`、`.orch/skills/**`、`.orch/instances/<id>/state.json`、`events.jsonl`；③ **夹具**：`test/fixtures/mock-acp-agent.js` 与 `*-driver.mjs`（`NODE_ENV=test` 必注入）产生的实例与提示词帧；④ **架构检查**：源码字面量扫描、依赖检查、中文来源扫描。②③④类断言一律以 **`机检：`** / **`夹具：`** / **`架构检查：`** 开头。
>
> 每条 AC 的 Given 都是用户可见或测试可准备的前置状态；When 是用户命令或夹具动作；Then 是用户可见结果或上述明确标注的观测。所有 `role` 命令 AC 都在**全新临时项目根**执行（开始前不存在 `.orch`）；涉及实例的 AC 使用 `%TEMP%` 下的独立根 + 仓库内 mock ACP agent。

#### AC-01 内置角色全表可列出

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-01、BR-09、BR-21
- **Given** 一个全新的项目根，没有 `.orch` 目录
- **When** 我执行 `orch role list`
- **Then** 首行是 `角色 16 个（内置 16 · 项目 0）`；随后 16 行，每行形如 `- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1`；分组按「通用协调 → 研究分析 → 内容创作 → 编码工程 → 业务运营」排列，同组内按 id 字典序；退出码 0
- **机检：** 总行数 17；`--format json` 的 `roles` 数组长度 16、`counts.total` 为 16、`counts.builtin` 为 16

#### AC-02 角色详情给全契约

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-02、BR-22
- **Given** 一个全新的项目根
- **When** 我执行 `orch role show developer`
- **Then** 输出恰好是附录 A-3 的 6 行：契约行（与 list 中 developer 行逐字相同）、职责、技能、工具、可唤醒、来源；来源行写 `内置 assets/roles/developer.yaml`；退出码 0
- **机检：** 6 行逐字匹配 A-3 模板；行数不等于 6 即判不通过

#### AC-03 项目角色覆盖内置并标来源

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-01、BR-21
- **Given** 项目根下 `.orch/roles/researcher.yaml` 是一份合法定义，技能为 `[research-brief, fact-check]`
- **When** 我执行 `orch role list` 与 `orch role show researcher`
- **Then** list 首行变为 `角色 16 个（内置 15 · 项目 1）`；researcher 行的技能数为 2；show 的来源行写 `项目 .orch/roles/researcher.yaml`；其它 15 个角色来源仍是内置
- **机检：** JSON 中 `researcher.source === 'project'`、`researcher.skills.length === 2`、`counts.builtin === 15`、`counts.project === 1`

#### AC-04 缺必填字段被拒绝

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-02、BR-23
- **Given** `.orch/roles/no-concurrency.yaml` 省略了 `max_concurrent_sessions`，其余字段齐全
- **When** 我执行 `orch role validate`
- **Then** 输出含一行 `- roles/no-concurrency.yaml：缺少必填字段：max_concurrent_sessions（ROLE_SCHEMA_MISSING）`；退出码 1；其余 26 个合法资产仍计为通过
- **机检：** `--format json` 的 `counts.assets === 27`、`counts.invalid === 1`、`counts.roles === 16`、`counts.skills === 10`；`errors` 长度 1，`errors[0].code === 'ROLE_SCHEMA_MISSING'`、`errors[0].field === 'max_concurrent_sessions'`、`errors[0].file === 'roles/no-concurrency.yaml'`

#### AC-05 角色 id 与文件名不一致被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-04、BR-23
- **Given** `.orch/roles/writer.yaml` 的内容里 `id: wordsmith`
- **When** 我执行 `orch role validate`
- **Then** 输出含 `roles/writer.yaml`，原因码 `ROLE_ID_MISMATCH`，明细同时给出文件名推出的 id 与内容声明的 id
- **机检：** `errors[0].code === 'ROLE_ID_MISMATCH'`，`errors[0].detail` 同时含 `writer` 与 `wordsmith`

#### AC-06 分组不在五组被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-02、BR-23
- **Given** `.orch/roles/bad-group.yaml` 里 `group: marketing`
- **When** 我执行 `orch role validate`
- **Then** 原因码 `ROLE_GROUP_INVALID`，明细列出五个合法取值（coordinator / research / writing / coding / ops）
- **机检：** `errors[0].code === 'ROLE_GROUP_INVALID'`，明细含全部五个取值

#### AC-07 产物类型、副作用等级、并发上限越界被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-02、BR-23
- **Given** 三份其余字段合法的项目角色：A 的 `artifact_type: slides`、B 的 `side_effect: admin`、C 的 `max_concurrent_sessions: 9`
- **When** 我执行 `orch role validate`
- **Then** 三条错误，原因码分别为 `ROLE_ARTIFACT_TYPE_INVALID`、`ROLE_SIDE_EFFECT_INVALID`、`ROLE_MAX_CONCURRENT_INVALID`；退出码 1
- **机检：** 三条错误的 `code` 集合与上面完全一致（顺序按文件名）；`max_concurrent_sessions` 的合法范围是 1~5 的整数

#### AC-08 引用不存在的技能被拒绝

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-03、BR-23
- **Given** `.orch/roles/ghost-skill.yaml` 的技能列表为 `[no-such-skill]`
- **When** 我执行 `orch role validate`
- **Then** 原因码 `ROLE_SKILL_NOT_FOUND`，明细指名 `no-such-skill`；退出码 1
- **机检：** `errors[0].code === 'ROLE_SKILL_NOT_FOUND'`，`errors[0].detail` 含 `no-such-skill`

#### AC-09 YAML 语法错误带行号

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-02、BR-23
- **Given** `.orch/roles/broken.yaml` 在第 4 行有一处非法缩进（同一层级出现两种缩进宽度）
- **When** 我执行 `orch role validate`
- **Then** 原因码 `YAML_PARSE_FAILED`，明细含 `第 4 行`；该文件不进入角色表；其它 16 个角色不受影响
- **机检：** `errors[0].code === 'YAML_PARSE_FAILED'`、`errors[0].line === 4`；`--format json` 的 `counts.roles` 仍为 16（A-7 的六键表，不是 A-6 的 `total`）

#### AC-10 注册表不合法时发起前停住

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-06
- **Given** 项目根下 `.orch/roles/ghost-skill.yaml`（技能不存在），并已配好 mock 宿主（`NODE_ENV=test`）
- **When** 我执行 `orch run --cwd ./demo --task "写下说明"`
- **Then** 终端出现 `注册表不合法：` 加第一条错误明细；退出码 3；没有启动核心；没有创建任何实例
- **机检：** `.orch/instances` 目录不存在；`.orch/core.json` 不存在；`./demo` 下没有 `.mock/prompts` 帧

#### AC-11 坏资产不阻塞列表但以失败退出

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-05、BR-21
- **Given** 项目根下 `.orch/roles/broken.yaml` 内容为（除第 4 行外都是 0 缩进的根键，第 4 行是 4 空格缩进且前面没有任何 2 空格的父级 —— 无父可挂）：

```yaml
schema: role/v1
id: broken
name: 坏文件
    summary: 坏缩进
group: coding
artifact_type: code
side_effect: write
skills: []
max_concurrent_sessions: 1
```

- **When** 我执行 `orch role list`
- **Then** 仍列出 16 个合法角色；末行是 `1 个资产未通过校验，执行 orch role validate 查看`；退出码 1；首行计数仍为 `角色 16 个（内置 16 · 项目 0）`
- **机检：** 行数 18（首行 + 16 行 + 末行）；JSON 的 `counts.invalid === 1` 且 `roles` 长度 16

#### AC-12 内置技能全部可解析且无悬空

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-07、BR-10
- **Given** 一个全新的项目根
- **When** 我执行 `orch role validate`（文本）与 `orch role validate --format json`（机器可读）
- **Then** 文本输出恰好一行 `校验资产 26 个：全部通过（角色 16 · 技能 10）`，退出码 0
- **机检：** JSON 的 `counts.assets === 26`、`counts.roles === 16`、`counts.skills === 10`、`counts.invalid === 0`、`errors` 为空；全部角色技能引用并集长度等于 10（无无人引用的技能）

#### AC-13 技能目录缺 SKILL.md 被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-08、BR-23
- **Given** `.orch/skills/half-done/` 目录存在但里面没有 `SKILL.md`
- **When** 我执行 `orch role validate`
- **Then** 原因码 `SKILL_FILE_MISSING`，明细含该目录名 `half-done`
- **机检：** `errors[0].code === 'SKILL_FILE_MISSING'`

#### AC-14 技能元数据缺字段或 id 不一致被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-08、BR-23
- **Given** `.orch/skills/quote/SKILL.md` 的前置元数据里 `id: quoting`，且缺少 `summary`
- **When** 我执行 `orch role validate`
- **Then** 对该文件报两条：`SKILL_SCHEMA_MISSING`（字段 `summary`）与 `SKILL_ID_MISMATCH`（目录名 `quote` / 声明 `quoting`）
- **机检：** 两条错误的 `code` 集合恰好是这两个

#### AC-15 技能正文为空被拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-07、BR-08
- **Given** `.orch/skills/empty-body/SKILL.md` 只有前置元数据，正文只有空白行
- **When** 我执行 `orch role validate`
- **Then** 原因码 `SKILL_BODY_EMPTY`
- **机检：** `errors[0].code === 'SKILL_BODY_EMPTY'`

#### AC-16 技能适用分组取值非法被拒绝

- 场景类型：异常 ｜ 风险：P2 ｜ 引用：BR-08
- **Given** `.orch/skills/bad-group/SKILL.md` 的前置元数据 `applies_to: [marketing]`
- **When** 我执行 `orch role validate`
- **Then** 原因码 `SKILL_GROUP_INVALID`，明细列出五个合法取值
- **机检：** `errors[0].code === 'SKILL_GROUP_INVALID'`

#### AC-17 五组各至少两个角色

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-09
- **Given** 一个全新的项目根
- **When** 我执行 `orch role list --format json`
- **Then** `groups` 数组长度 5，取值依次为 `coordinator` / `research` / `writing` / `coding` / `ops`，每组 `count` ≥ 2，`count` 之和等于 `counts.total`
- **机检：** 五组计数分别为 5 / 3 / 3 / 3 / 2

#### AC-18 模板角色全在注册表且中文名一致

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-09、BR-26
- **Given** 三种内建模板的节点角色集合与 `src/templates/index.js` 的 `ROLES`
- **When** 把这份集合与注册表逐条对照
- **Then** `worker` / `developer` / `tester` / `researcher` / `writer` / `reviewer` / `coordinator` 七个 id 全部存在于注册表；其中 6 个既有角色（不含 `worker`）的中文名与 `labels.js` 的 `ROLE_LABEL` 逐字一致
- **架构检查：** 由 `test/wp11/assets.test.js` 的两个对照用例承担（① 遍历 `GRAPHS` 的每个节点 `roleId` 与 `ROLES` 的每个键，断言注册表里存在同 id 角色；② 遍历 `ROLE_LABEL` 的每个键，断言注册表同 id 角色的 `name` 与之逐字相等）。命令：`node --test test/wp11/assets.test.js`，失败用例即刻 exit 1

#### AC-19 新增角色不改变三条主链输出

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-28
- **Given** 独立项目根 + 仓库内 mock ACP agent
- **When** 依次跑 `single`、`code-loop`、`task-loop` 三条主链
- **Then** 三条都是退出码 0，且终端输出在**去掉两类易变内容后**与 I1.3 基线逐字一致：① 形如 `已运行 12s` 的时长片段；② `HH:mm:ss` 时间戳
- **夹具：** `.mock/prompts/*.json` 的 `task` 文本与 I1.3 基线一致（未插入任何角色/技能字样）；`state.json` 的 `nodes` / `sessions` / `handoffs` 键集合与 I1.3 基线相同
- **机检：** 用 `sed -E 's/已运行 [0-9]+s//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g'` 归一化后 `diff` 为空；比对不通过即判不通过，不允许只比前几行

#### AC-20 声明但未绑定节点的角色不参与派发

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-11、BR-12、BR-26
- **Given** `code-loop` 完成一次回流后停在 T-002 第 2 轮执行中（实例 `state === 'running'`，不是终态）
- **When** 我执行 `orch role list --instance INST-001 --format json`
- **Then** 角色实例集合为 `developer` / `tester` / `coordinator` 三个；`coordinator` 的状态是 `inactive`，`servingNodes` 与 `activeSessions` 都为空；协调者没有会话、没有节点、没有派发
- **机检：** `instance.roles` 里 `roleId === 'coordinator'` 那一条的 `status === 'inactive'`、`servingNodes === []`、`activeSessions === []`；`state.json` 的 `nodes[].roleId` 集合不含 `coordinator`；`instance.roleToSessions` 里没有 `coordinator` 键

#### AC-21 每个图角色恰好一个角色实例

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-11
- **Given** `task-loop` 运行中（研究已完成、撰写执行中）
- **When** 我执行 `orch role list --instance INST-001 --format json`
- **Then** `instance.roles` 长度 3，顺序为 `researcher` / `reviewer` / `writer`（分组顺序 → id 字典序）；没有重复角色；每个元素都带 `roleId` 与 `roleInstanceId`
- **机检：** 每个元素的 `roleInstanceId === 'RI-' + roleId`（对应 A-6 的键，不是 `instanceId`）；去重后角色数仍为 3

#### AC-22 运行中角色为服务中且活跃会话、服务节点正确

- 场景类型：夹具 ｜ 风险：P0 ｜ 引用：BR-13、BR-18
- **Given** 夹具把 `code-loop` 停在「开发完成、测试执行中」
- **When** 我执行 `orch role show tester --instance INST-001 --format json`
- **Then** `status === 'busy'`、`activeSessions` 恰好 1 个（就是 `state.json` 里 T-002 的会话）、`servingNodes` 为 `['T-002']`、`hostIcons` 含 `dsh`、`lastAction.nodeId === 'T-002'`
- **夹具：** 断言期间用 `state.live` 抢落盘，避免 `core stop` 把中间态对账成 `interrupted`

#### AC-23 未开始角色为可用

- 场景类型：夹具 ｜ 风险：P1 ｜ 引用：BR-15
- **Given** `code-loop` 刚启动、T-001 尚未完成
- **When** 我执行 `orch role show tester --instance INST-001 --format json`
- **Then** `status === 'available'`、`activeSessions` 为空、`servingNodes` 为空
- **夹具：** 停在首个 turn 内（mock 首帧延迟）

#### AC-24 已完成角色为冷却中

- 场景类型：夹具 ｜ 风险：P1 ｜ 引用：BR-14
- **Given** `code-loop` 完成一次回流，T-001 已 `done`、T-002 正在 `running`
- **When** 我执行 `orch role show developer --instance INST-001 --format json`
- **Then** `status === 'cooldown'`、`activeSessions` 为空、`servingNodes` 为空
- **机检：** 该实例 `state` 不是终态（不是 `completed` / `failed` / `cancelled` / `interrupted`）

#### AC-25 声明未绑定角色为未参与

- 场景类型：夹具 ｜ 风险：P0 ｜ 引用：BR-12
- **Given** `code-loop` 停在 T-002 执行中
- **When** 我执行 `orch role show coordinator --instance INST-001 --format json`
- **Then** `status === 'inactive'`、`servingNodes` 为空、`activeSessions` 为空、`roleToSessions` 里没有 `coordinator` 键；文本输出为 `未参与`
- **机检：** 同一实例里 `coordinator` 的实例 id 为 `RI-coordinator`

#### AC-26 会话升级时角色为不可用

- 场景类型：夹具 ｜ 风险：P0 ｜ 引用：BR-16
- **Given** 用既有 `NODE_ENV=test` 接缝 `test.escalate` 让 T-002 升级（确定性入口，不依赖时序）；此时该节点 `state === 'escalated'` 且其会话 `state === 'escalated'`
- **When** 我执行 `orch role show tester --instance INST-001 --format json`
- **Then** `status === 'unavailable'`，`statusReason === 'escalated'`
- **机检：** `state.json` 里 T-002 节点 `state === 'escalated'`；`roleInstance.status === 'unavailable'`。隔离分支（`quarantined === true` → `statusReason === 'quarantined'`）不设独立 AC，由 `test/wp11/role-instances.test.js` 的单测覆盖（D-9）

#### AC-27 实例结束后角色为已关闭且仍可查

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-17
- **Given** `single` 主链跑完（实例 `completed`）
- **When** 我执行 `orch role show worker --instance INST-001`
- **Then** 状态显示 `已关闭`，退出码 0；活跃会话 0；服务节点 `—`
- **机检：** JSON 的 `status === 'retired'`

#### AC-28 活跃会话数与并发上限同时展示，且上限来自注册表

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-18
- **Given** `task-loop` 停在撰写执行中（内置 `writer` 并发上限为 2）；随后在 `.orch/roles/writer.yaml` 放一份上限为 3 的合法覆盖定义
- **When** 我分别执行 `orch role show writer --instance INST-001`
- **Then** 第一次显示 `活跃会话 1/2`；覆盖后显示 `活跃会话 1/3`（同一份实例状态，只有上限变了）
- **机检：** JSON 的 `maxConcurrentSessions` 前后分别为 2 与 3，`activeSessions.length` 始终为 1

#### AC-29 角色到会话的映射保留全部会话

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-19
- **Given** `code-loop` 完成一次回流，且 T-001 第 2 轮与 T-002 第 2 轮都已派发（两个节点各新建了一个会话，停在 T-002 第 2 轮执行中）
- **When** 我执行 `orch role list --instance INST-001 --format json`
- **Then** `roleToSessions.developer` 有 2 个会话 id（按创建顺序），`roleToSessions.tester` 有 2 个
- **机检：** 两个数组的元素与 `state.json` 的 `sessions[]` 里对应 `nodeId` 的会话顺序一致

#### AC-30 角色实例是派生视图，改状态即变且不回写

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-20
- **Given** 实例已挂起（T-002 升级），`role show tester --instance` 显示 `不可用`
- **When** 我手工把 `state.json` 里 T-002 的会话同时改成 `state: "idle"` 与 `quarantined: false`（升级路径会同时置这两个字段），再执行一次 `orch role show tester --instance --format json`
- **Then** 状态变为 `available`（`state.json` 的 `rev` 与 `updatedAt` 不变，即读命令没有回写）
- **机检：** 两次读的 `rev` 相同；`roleInstance.status` 前后为 `unavailable` → `available`；`roleInstance.statusReason` 前后为 `escalated` → `null`

#### AC-31 角色实例顺序稳定且不重复

- 场景类型：正常路径 ｜ 风险：P2 ｜ 引用：BR-11
- **Given** `task-loop` 运行中
- **When** 我连续执行两次 `orch role list --instance INST-001 --format json`
- **Then** 两次的 `roleId` 顺序完全一致，且都是 `researcher` / `reviewer` / `writer`
- **机检：** 两次输出的角色顺序数组深比较为真

#### AC-32 `--group` 只列该组

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-21
- **Given** 一个全新的项目根
- **When** 我执行 `orch role list --group coding`
- **Then** 首行是 `角色 3 个（内置 3 · 项目 0）`，随后 3 行都是编码工程组（`code-reviewer` / `developer` / `tester`）；退出码 0
- **机检：** JSON 的 `groups` 只有一个元素且 `count === 3`

#### AC-33 `--format json` 键集合稳定

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-21
- **Given** 一个全新的项目根
- **When** 我执行 `orch role list --format json`
- **Then** 顶层键恰好是 `counts` / `groups` / `roles`；每个角色对象的键恰好是附录 A-6 列出的 10 个
- **机检：** 键集合排序后逐字比对

#### AC-34 角色不存在时明确报错

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-25
- **Given** 一个全新的项目根
- **When** 我执行 `orch role show no-such-role`
- **Then** 终端出现 `找不到角色：no-such-role` 与一行 `可用角色：执行 orch role list 查看`；退出码 1
- **机检：** stdout 含这两行；退出码 1

#### AC-35 `role show` 缺参数是用法错误

- 场景类型：异常 ｜ 风险：P2 ｜ 引用：BR-25
- **Given** 一个全新的项目根
- **When** 我执行 `orch role show`
- **Then** 打印用法（含 `orch role show <角色>` 一行）与 `（role show 需要角色 id）`；退出码 2
- **机检：** 退出码 2；stdout 含用法行

#### AC-36 `role validate` 可只校验单个角色

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-23
- **Given** 项目里同时有一个坏角色文件和一个好角色文件
- **When** 我执行 `orch role validate researcher`
- **Then** 只报 `校验资产 1 个：全部通过（角色 1 · 技能 0）`，退出码 0；不出现坏文件那一条
- **机检：** 输出行不含坏文件名

#### AC-37 未知子命令、未知参数、非法 `--format` 都是用法错误

- 场景类型：异常 ｜ 风险：P2 ｜ 引用：BR-25
- **Given** 一个全新的项目根
- **When** 依次执行 `orch role bogus`、`orch role list --nope`、`orch role list --format yaml`
- **Then** 三次都打印用法并给出具体原因（`未知的 role 子命令：bogus` / `未知参数：--nope` / `--format 只接受 text 或 json`），退出码都是 2
- **机检：** 三次退出码 2；三条原因各出现一次

#### AC-38 角色命令只读

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-24
- **Given** 一个全新的项目根（没有 `.orch`）
- **When** 依次执行 `orch role list`、`orch role show developer`、`orch role validate`（三条都**不带** `--instance`）
- **Then** 三条命令都不创建 `.orch` 目录、不启动核心、不写任何文件
- **机检：** 执行后项目根下 `.orch` 目录不存在（`test -e .orch` 为假，因而不可能存在 `.orch/core.json`）；`assets/**` 的 `sha256` 清单前后逐字相同

#### AC-39 `--instance` 指向不存在的实例

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-25
- **Given** 一个全新的项目根（没有任何实例）
- **When** 我执行 `orch role show developer --instance INST-999`
- **Then** 终端出现 `找不到实例：INST-999`；退出码 1；角色契约部分仍然打印（先给资产，再给实例结论）
- **机检：** stdout 前 6 行是角色契约；末行含 `找不到实例：INST-999`

#### AC-40 架构纯净：核心与守护进程零角色字面量

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-26
- **Given** 实现完成后的源码树
- **When** 依次执行附录 D-7 的三条命令（第 1、3 条用 31 词全表；第 2 条 30 词——去掉 `coordinator`，理由见 D-7 的 v5 修正；分别扫 `src/core,src/daemon`、`src/registry`、`src/cli/roles.js`）
- **Then** 三条都退出码 0，输出都是 `OK: 扫描 N 个文件…零命中`；另有一条定点断言：`coordinator` 在 `src/registry/**` 只出现 1 次（`GROUPS` 那一行）
- **架构检查：** 命令原文写在 D-7；第三条用 `--files src/cli/roles.js`（`purity-check.mjs` 本轮新增的入参，见 D-8），确保只扫该文件而不是整个 `src/cli`（`labels.js` 合法含有既有 6 个角色名）

#### AC-41 零运行时依赖

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-27
- **Given** 实现完成后的 `package.json`
- **When** 读取 `dependencies`
- **Then** 键数量为 0
- **架构检查：** `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"`，输出必须是 `0`（当前 `package.json` **没有** `dependencies` 键，直接 `Object.keys(p.dependencies)` 会抛）

#### AC-42 既有 418 条测试全绿

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-28
- **Given** 实现完成后的源码树
- **When** 执行 `node --test "test/**/*.test.js"`
- **Then** `fail === 0`、`pass === tests`、`tests >= 418`；不得修改任何既有断言（附录 D-8 的授权断言清单为空）
- **机检：** 用下限断言 `fail === 0 && pass === tests && tests >= 418`，不写死条数

#### AC-43 新增中文只在 labels.js

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-26、C-08
- **Given** 实现完成后的源码树
- **When** 扫描 `src/registry` 与 `src/cli/roles.js`
- **Then** 这两个位置不出现 CJK 字符（中文一律在 `labels.js`）；`assets/**` 与 `labels.js` 不受此限
- **架构检查：** 按 `[\u4e00-\u9fff]` 扫描指定路径，命中即 exit 1

#### AC-44 注册表加载只读且不联网

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-24、BR-27
- **Given** 一个含项目资产的项目根（合法资产）
- **When** 执行 `orch role validate --format json`
- **Then** 所有资产文件的字节内容与修改时间都不变；没有新建目录；加载过程不发起任何网络调用
- **机检：** 执行前后对 `assets/**` 与 `.orch/**` 求 `sha256` 清单并比较 `mtime`（`find … -printf '%p %T@\n'`），两份清单逐字相同；执行前后 `find . -type d` 列表相同；`src/registry/**` 不 import `node:http` / `node:https` / `node:net` / `node:dns` / `node:tls`（静态扫描 import 行，命中即判不通过）

#### AC-45 项目级技能可覆盖内置同名技能

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-01、BR-29
- **Given** 项目根下 `.orch/skills/code-change/SKILL.md` 是一份合法技能，`name: 代码修改（项目版）`、`summary` 与正文都换成项目自己的内容；动作前置：先执行一次 `orch role validate --format json` 记录内置版的通过结果
- **When** 我再执行一次 `orch role validate --format json`，并执行 `orch role show developer --format json`
- **Then** 校验仍然全部通过（`counts.invalid === 0`、`counts.project === 1`）；`developer` 的技能列表仍为 `["code-change","test-run"]`（引用按 id 解析，不因覆盖而变）
- **机检：** 覆盖后 `counts.skills` 仍为 10（同 id 覆盖不增加总数）、`counts.builtin` 为 25、`counts.project` 为 1；`skills` 表里 `code-change` 的 `source === 'project'`（可由 `role validate --format json` 之外的 `test/wp11/registry.test.js` 断言，判定以该用例为准）

### 3.2 非功能验收标准

| # | 场景 | 目标 |
|---|---|---|
| NFR-01 | 内置 16 角色 + 10 技能，`orch role list` | 1 秒内看到首行输出 |
| NFR-02 | 项目里放 100 个合法角色文件 | `role list` 2 秒内完成，不因文件数退化为平方复杂度 |
| NFR-03 | `orch run` 增加注册表预检 | 预检耗时 ≤ 100ms（418 条测试总时长不因此显著上升） |
| NFR-04 | 同一输入连续执行两次 `role list --format json` | 两次输出逐字节相同 |
| NFR-05 | 回归 | I1.1 ~ I1.3 既有 418 条测试全部通过，且不修改任何既有断言（附录 D-8） |
| NFR-06 | 依赖 | 不新增运行时依赖，安装后无需联网即可运行 |
| NFR-07 | 角色命令不驻留 | `role` 命令执行完立即退出，自身不留后台进程；不带 `--instance` 时也不启动核心（带 `--instance` 时启动的常驻核心与 `orch status` 启动的是同一个，属既有行为，不算新增驻留） |

### 3.3 验收前置条件

1. Node ≥ 22（本机 v22.22.2）与 Git Bash；`orch` 通过 `node bin/orch.js` 或 `npm link` 可用。
2. 每个 AC 使用全新临时项目根（`%TEMP%/maestro-acc-p5/<AC 编号>/`）；开始前 `.orch` 不含任何资产，需要项目资产的 AC 由该 AC 自己预置，放好后不再改动。**例外**：AC-28 与 AC-45 需要在同一 AC 内先记录一次基线、再放覆盖文件、再取一次结果，其"覆盖前后"两段各自保持资产不变。
3. `role` 命令类 AC（AC-01 ~ AC-09、AC-11 ~ AC-18、AC-32 ~ AC-39、AC-43 ~ AC-45）不需要宿主，不需要 `NODE_ENV=test`。
4. 实例类 AC（AC-10、AC-19 ~ AC-31）使用仓库内 `test/fixtures/mock-acp-agent.js`，并注入 `NODE_ENV=test`；项目根放 `%TEMP%` 下，**不放仓库内**。AC-42 是全量测试，不需要宿主（用例自带 mock）。
5. 需要中间态的 AC（AC-20、AC-21、AC-22 ~ AC-26、AC-28、AC-29、AC-31）用 mock 慢回合或 `permissionPolicy=hold` 稳定停点，并在断言时刻用 `state.live` 抢先落盘。<br>其中 **AC-20 必须停在非终态**（`code-loop` 完成一次回流后停在 T-002 第 2 轮执行中，实例 `state === 'running'`）：若跑到终态，角色实例会被 D-5 判为 `retired` 而不是本 AC 要求的 `inactive`。**AC-21 同理**，需在停点同时观测到"协调者 `inactive`"与"其余角色非 `inactive`"。
6. AC-26 固定走 `test.escalate` 接缝的确定性升级分支（不依赖迟到帧时序）；隔离分支（`quarantined`）不设 AC，由 `test/wp11/role-instances.test.js` 单测覆盖。
7. AC-30 手工改 `state.json` 必须在实例已挂起（`suspended`）且核心已停止写入时进行，改前先记录 `rev`。
8. 架构检查类 AC（AC-40、AC-41、AC-43）只用仓库内 `test/fixtures/purity-check.mjs` 与 `node -e`，不引入新工具。
9. 主链回归（AC-19）的基线取自 `docs/iterations/iteration-3/evidence/` 与 `probe/acc3-*` 的既有输出，逐字比对。
10. Windows 下用 Git Bash 或等价 shell；本文命令以 POSIX shell 书写；时间断言允许同一秒内比较。

---

## 附录 A 输出基线（**唯一**，AC-01 ~ AC-39、AC-43 中涉及命令输出与 JSON 结构的判定依据）

> 既有基线（I1.1 §3、I1.2 A-1~A-4、I1.3 A-1~A-4）继续有效。本附录只登记**新增**的输出；未登记的输出不得改动。

### A-1 内置资产清单

**角色 16 个（按分组，组内按 id 字典序）**

| 组 | id | 名称 | 产物类型 | 副作用 | 技能 | 并发 |
|---|---|---|---|---|---|---|
| coordinator | arbiter | 裁决者 | report | none | coordination | 1 |
| coordinator | coordinator | 协调者 | report | none | coordination | 1 |
| coordinator | planner | 规划者 | report | read | coordination, research-brief | 1 |
| coordinator | summarizer | 汇总者 | report | read | coordination | 2 |
| coordinator | worker | 执行者 | document | write | — | 1 |
| research | data-analyst | 数据分析师 | dataset | write | data-analysis, fact-check | 2 |
| research | fact-checker | 事实核查员 | report | read | fact-check | 1 |
| research | researcher | 研究员 | report | write | research-brief | 1 |
| writing | editor | 编辑 | document | write | doc-draft, doc-review | 1 |
| writing | reviewer | 审核者 | document | read | doc-review | 1 |
| writing | writer | 撰写者 | document | write | doc-draft | 2 |
| coding | code-reviewer | 代码审查 | code | read | code-review | 1 |
| coding | developer | 开发 | code | write | code-change, test-run | 1 |
| coding | tester | 测试 | code | exec | test-run | 1 |
| ops | compliance-reviewer | 合规审查者 | report | read | compliance-check | 1 |
| ops | requirement-clarifier | 需求澄清者 | document | write | doc-draft, coordination | 1 |

组计数：coordinator 5 · research 3 · writing 3 · coding 3 · ops 2 = 16。

**技能 10 个**：`research-brief`（调研笔记）、`fact-check`（事实核查）、`data-analysis`（数据分析）、`doc-draft`（文档撰写）、`doc-review`（文档审核）、`code-change`（代码修改）、`test-run`（测试执行）、`code-review`（代码审查）、`coordination`（编排协调）、`compliance-check`（合规审查）。10 个技能全部被至少一个角色引用（`worker` 是唯一不引用技能的角色）。

**角色文件完整样例**（`assets/roles/developer.yaml`）：

```yaml
schema: role/v1
id: developer
name: 开发
group: coding
summary: 按任务修改代码，交出声明的产物文件
artifact_type: code
side_effect: write
skills:
  - code-change
  - test-run
tools:
  - read
  - write
  - edit
  - bash
wake_allow:
  - tester
max_concurrent_sessions: 1
```

**技能文件完整样例**（`assets/skills/code-change/SKILL.md`）：

```markdown
---
schema: skill/v1
id: code-change
name: 代码修改
summary: 定位到要改的文件，做最小改动，并写清改了什么
applies_to: [coding]
commands: ["node --test"]
---

### 工作方法

1. 先读任务里「产物：」那一行，确认要改的文件。
2. 只改必要位置，不动无关文件。
3. 改完说明：改了哪个文件、为什么这样改。
```

### A-2 `orch role list`

文本（`--format text`，缺省；16 行数据 + 1 行首行）：

```
角色 16 个（内置 16 · 项目 0）
- arbiter 裁决者 · 通用协调 · report · none · 技能 1 · 并发 1
- coordinator 协调者 · 通用协调 · report · none · 技能 1 · 并发 1
- planner 规划者 · 通用协调 · report · read · 技能 2 · 并发 1
- summarizer 汇总者 · 通用协调 · report · read · 技能 1 · 并发 2
- worker 执行者 · 通用协调 · document · write · 技能 0 · 并发 1
- data-analyst 数据分析师 · 研究分析 · dataset · write · 技能 2 · 并发 2
- fact-checker 事实核查员 · 研究分析 · report · read · 技能 1 · 并发 1
- researcher 研究员 · 研究分析 · report · write · 技能 1 · 并发 1
- editor 编辑 · 内容创作 · document · write · 技能 2 · 并发 1
- reviewer 审核者 · 内容创作 · document · read · 技能 1 · 并发 1
- writer 撰写者 · 内容创作 · document · write · 技能 1 · 并发 2
- code-reviewer 代码审查 · 编码工程 · code · read · 技能 1 · 并发 1
- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1
- tester 测试 · 编码工程 · code · exec · 技能 1 · 并发 1
- compliance-reviewer 合规审查者 · 业务运营 · report · read · 技能 1 · 并发 1
- requirement-clarifier 需求澄清者 · 业务运营 · document · write · 技能 2 · 并发 1
```

有坏资产时在末尾追加一行（`<N>` 为不合法资产数）：

```
<N> 个资产未通过校验，执行 orch role validate 查看
```

首行格式固定为 `角色 <总数> 个（内置 <内置数> · 项目 <项目数>）`；`--group <组>` 时总数与两个分项都只统计该组。

### A-3 `orch role show`

文本（`--format text`，缺省；恰好 6 行）：

```
- developer 开发 · 编码工程 · code · write · 技能 2 · 并发 1
  职责：按任务修改代码，交出声明的产物文件
  技能：code-change, test-run
  工具：read, write, edit, bash
  可唤醒：tester
  来源：内置 assets/roles/developer.yaml
```

- 第一行与 `role list` 中该角色那一行**逐字相同**（含前导 `- `）。
- 技能为空时写 `技能：—`；工具为空时写 `工具：—`；唤醒白名单为空时写 `可唤醒：—`。
- 项目覆盖时来源行为 `来源：项目 .orch/roles/<id>.yaml`。
- 带 `--instance <实例号>` 时追加一行：

```
  实例 INST-001：服务中 · 活跃会话 1/1 · 服务节点 T-002 · 宿主 dsh · 最近 T-002 · 轮次 1/2
```

`<状态>` 取值：`未参与` / `可用` / `服务中` / `冷却中` / `不可用` / `已关闭`；若该角色不在本实例的参与者集合里（既不在图的 `roles` 声明、也没有任何节点绑定它），整行改为 `实例 <实例号>：本实例未使用该角色`；无服务节点时写 `服务节点 —`，无宿主时写 `宿主 —`，无最近动作时写 `最近 —`（三个占位符可以同时出现，整行仍以 `最近 —` 结尾）。

### A-4 `orch role validate`

全部通过：

```
校验资产 26 个：全部通过（角色 16 · 技能 10）
```

有不合法资产（`<N>` 为资产总数，含不合法的）：

```
校验资产 <N> 个：<M> 个不合法
- roles/ghost-skill.yaml：引用的技能不存在：no-such-skill（ROLE_SKILL_NOT_FOUND）
- roles/broken.yaml：第 4 行无法解析：缩进不一致（YAML_PARSE_FAILED）
```

- 每个不合法资产占一行，格式固定为 `- <相对路径>：<人话明细>（<原因码>）`。
- 相对路径以**资产根**为基准：项目资产写 `roles/<id>.yaml` / `skills/<id>/SKILL.md`，内置资产写 `assets/roles/<id>.yaml`。
- 明细按文件名字典序列出。
- 单个角色校验（`orch role validate <角色>`）只把该角色算进资产总数，技能计 0。

### A-5 新增错误、原因码与退出码

`orch role` 的用法块（`renderUsage` 的完整输出，共 8 行；`orch run|status|cancel|core` 的既有 5 行**逐字不变**——含第 1 行，因为 `test/wp6/main.test.js:77` 逐字断言 `orch run|status|cancel|core` 这个子串，而 D-8 的授权断言清单为空——只在末尾新增 3 行 role 子行）：

```
用法：orch run|status|cancel|core
  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]
  orch status [--instance <实例号>] [--events]
  orch cancel --instance <实例号>
  orch core stop
  orch role list [--group <组>] [--instance <实例号>] [--format text|json]
  orch role show <角色> [--instance <实例号>] [--format text|json]
  orch role validate [<角色>] [--format json]
```

> **为什么不把 `role` 加进第 1 行**（v5 修正）：第 1 行写成 `orch run|status|cancel|role|core` 会让 `test/wp6/main.test.js:77` 的 `includes('orch run|status|cancel|core')` 不再成立；而 AC-42 要求"不得修改任何既有断言"、优先级高于附录 A。故第 1 行保持原样，`role` 只通过 3 条子行体现；行数仍是 8 行，AC-35/AC-37 只断言"打印用法 + 含 `orch role show <角色>` 一行 + 具体原因"，不受影响。

用法错误时在上面的块之后追加一行 `  （<原因>）`。

| 情形 | 输出 | 退出码 |
|---|---|---|
| `role show <未知角色>` | `找不到角色：<id>` + `可用角色：执行 orch role list 查看` | 1 |
| `role show <角色> --instance <未知实例>` | 先输出角色 6 行，再输出 `找不到实例：<id>` | 1 |
| `role validate` 有错 | A-4 的失败版式 | 1 |
| `role list` 有错 | 正常角色行 + A-2 的末行提示 | 1 |
| `orch run` 注册表不合法 | `注册表不合法：<第一条明细>`（明细版式同 A-4，不带 `- ` 前缀） | 3 |
| `role` 未知子命令 | 用法 + `（未知的 role 子命令：<sub>）` | 2 |
| `role show` 缺角色 id | 用法 + `（role show 需要角色 id）` | 2 |
| `--format` 取值非法 | 用法 + `（--format 只接受 text 或 json）` | 2 |
| 未知参数 | 用法 + `（未知参数：--<key>）` | 2 |
| 标志用错子命令 | 用法 + `（--<key> 不适用于 role <sub>）` | 2 |

资产级原因码共 14 个（与 C-11 逐字一致）：`YAML_PARSE_FAILED`、`ROLE_SCHEMA_MISSING`、`ROLE_ID_MISMATCH`、`ROLE_GROUP_INVALID`、`ROLE_ARTIFACT_TYPE_INVALID`、`ROLE_SIDE_EFFECT_INVALID`、`ROLE_MAX_CONCURRENT_INVALID`、`ROLE_SKILL_NOT_FOUND`、`SKILL_FILE_MISSING`、`SKILL_SCHEMA_MISSING`、`SKILL_ID_MISMATCH`、`SKILL_BODY_EMPTY`、`SKILL_GROUP_INVALID`、`REGISTRY_ASSETS_MISSING`。这些原因码只出现在 A-4 / A-5 的输出里，**不并入** `ERROR_TEMPLATE`。`REGISTRY_INVALID` 是**命令级**失败码（只用于决定 `orch run` 退出 3 与 `注册表不合法：` 文案），不进入资产错误表。

**每条原因码对应的人话明细模板**（唯一来源 `labels.js` 的 `REGISTRY_ERROR`，`registry` 只返回 `{code, file, field, line, params}`，不拼中文）：

| 原因码 | 明细模板 |
|---|---|
| `YAML_PARSE_FAILED` | `第 {line} 行无法解析：{detail}` |
| `ROLE_SCHEMA_MISSING` | `缺少必填字段：{field}` |
| `ROLE_ID_MISMATCH` | `角色 id 与文件名不一致：文件 {fileId} / 声明 {declaredId}` |
| `ROLE_GROUP_INVALID` | `分组取值非法：{value}；合法取值：coordinator / research / writing / coding / ops` |
| `ROLE_ARTIFACT_TYPE_INVALID` | `产物类型取值非法：{value}；合法取值：code / document / dataset / report` |
| `ROLE_SIDE_EFFECT_INVALID` | `副作用等级取值非法：{value}；合法取值：none / read / write / exec` |
| `ROLE_MAX_CONCURRENT_INVALID` | `并发上限取值非法：{value}；合法范围：1~5 的整数` |
| `ROLE_SKILL_NOT_FOUND` | `引用的技能不存在：{skill}` |
| `SKILL_FILE_MISSING` | `技能目录缺少 SKILL.md：{dir}` |
| `SKILL_SCHEMA_MISSING` | `缺少必填字段：{field}` |
| `SKILL_ID_MISMATCH` | `技能 id 与目录名不一致：目录 {dirId} / 声明 {declaredId}` |
| `SKILL_BODY_EMPTY` | `技能正文为空：{dir}` |
| `SKILL_GROUP_INVALID` | `适用分组取值非法：{value}；合法取值：coordinator / research / writing / coding / ops` |
| `REGISTRY_ASSETS_MISSING` | `内置资产目录缺失：{path}` |

### A-6 JSON 结构（`--format json`）

**`orch role list --format json`（不带 `--instance`）—— 顶层恰好三个键**

```json
{
  "counts": { "total": 16, "builtin": 16, "project": 0, "invalid": 0 },
  "groups": [
    { "group": "coordinator", "label": "通用协调", "count": 5 },
    { "group": "research", "label": "研究分析", "count": 3 },
    { "group": "writing", "label": "内容创作", "count": 3 },
    { "group": "coding", "label": "编码工程", "count": 3 },
    { "group": "ops", "label": "业务运营", "count": 2 }
  ],
  "roles": [
    {
      "id": "arbiter",
      "name": "裁决者",
      "group": "coordinator",
      "groupLabel": "通用协调",
      "artifactType": "report",
      "sideEffect": "none",
      "skills": ["coordination"],
      "maxConcurrentSessions": 1,
      "source": "builtin",
      "file": "assets/roles/arbiter.yaml"
    }
  ]
}
```

角色对象固定 10 个键（顺序不参与判定，集合参与判定）：`id`、`name`、`group`、`groupLabel`、`artifactType`、`sideEffect`、`skills`、`maxConcurrentSessions`、`source`（`builtin` / `project`）、`file`（相对仓库根的内置路径，或相对项目根的 `.orch/...` 路径）。

**`orch role list --instance <实例号> --format json`**：在顶层追加第四个键 `instance`：

```json
{
  "counts": { "total": 16, "builtin": 16, "project": 0, "invalid": 0 },
  "groups": [ { "group": "coordinator", "label": "通用协调", "count": 5 } ],
  "roles": [ { "id": "developer", "…": "同 A-6 第一个示例的 10 个键" } ],
  "instance": {
    "instanceId": "INST-001",
    "template": "code-loop",
    "state": "running",
    "roles": [
      {
        "roleId": "developer",
        "roleInstanceId": "RI-developer",
        "status": "busy",
        "statusReason": null,
        "activeSessions": ["mock-sess-1"],
        "servingNodes": ["T-001"],
        "hostIcons": ["dsh"],
        "maxConcurrentSessions": 1,
        "lastAction": {
          "nodeId": "T-001",
          "round": 1,
          "maxRounds": 2,
          "state": "running",
          "stateSince": "2026-11-08T10:00:00.000Z"
        }
      }
    ],
    "roleToSessions": { "developer": ["mock-sess-1"], "tester": ["mock-sess-2"] }
  }
}
```

**`orch role show <角色> --format json`**：顶层恰好三个键 `role`（10 键角色对象）、`instance`（`{instanceId, template, state, roleToSessions}`）与 `roleInstance`（9 键角色实例对象）。不带 `--instance` 时 `instance` 与 `roleInstance` 都是 `null`，顶层仍是三键。

`role show <角色> --instance <实例号>` 在角色不属于该实例时，`roleInstance` 为 `null`、`instance` 仍给出 `{instanceId, template, state, roleToSessions}`（文本输出按 A-3 的"本实例未使用该角色"）。

角色实例对象固定 9 个键：`roleId`、`roleInstanceId`（`RI-<roleId>`）、`status`（`inactive` / `available` / `busy` / `cooldown` / `unavailable` / `retired`）、`statusReason`（`null` / `quarantined` / `escalated` / `unknown-role`）、`activeSessions`、`servingNodes`、`hostIcons`、`maxConcurrentSessions`、`lastAction`（`null` 或 `{nodeId, round, maxRounds, state, stateSince}`）。

> **字段路径口径**：AC-22 ~ AC-30 里写的 `status` / `activeSessions` / `servingNodes` / `roleToSessions` 等字段，路径以本附录为准——`role show --format json` 下这些字段位于 `roleInstance.*`（`roleToSessions` 位于 `instance.roleToSessions`），`role list --instance --format json` 下位于 `instance.roles[].*`（`roleToSessions` 位于 `instance.roleToSessions`）。

> **不由 AC 判定的展示细节**（由 `test/wp11/cli-role.test.js` 单测覆盖，避免 AC 与版式细节互锁）：A-3 的三种空态占位符（`技能：—` / `工具：—` / `可唤醒：—`）、`role show --format json` 不带 `--instance` 时 `instance` 与 `roleInstance` 为 `null`、`role list --instance` 的文本追加行。

### A-7 JSON 结构（`orch role validate --format json`）

顶层恰好两个键：

```json
{
  "counts": {
    "assets": 26,
    "roles": 16,
    "skills": 10,
    "builtin": 26,
    "project": 0,
    "invalid": 0
  },
  "errors": [
    {
      "code": "ROLE_SKILL_NOT_FOUND",
      "file": "roles/ghost-skill.yaml",
      "scope": "role",
      "field": "skills",
      "line": null,
      "detail": "引用的技能不存在：no-such-skill"
    }
  ]
}
```

- `counts` 固定 6 个键：`assets`（参与校验的资产总数，含不合法）、`roles`（合法角色数）、`skills`（合法技能数）、`builtin` / `project`（合法资产的内置 / 项目分布）、`invalid`（不合法资产数，按文件计）。
- `errors` 每个元素固定 6 个键：`code`、`file`（相对资产根，同 A-4）、`scope`（`role` / `skill`）、`field`（缺字段或取值越界时给出字段名，其余为 `null`）、`line`（YAML 语法错误时给出 1 基行号，其余为 `null`）、`detail`（A-5 的人话明细，由 `labels.js` 的 `REGISTRY_ERROR` 组装）。
- `errors` 按 `file` 字典序，同文件内按 D-3 的校验顺序。
- `orch role validate <角色>` 时 `counts.assets` 为 1、`counts.skills` 为 0，`errors` 只含该角色文件。
- A-6 的 `counts`（4 键：`total` / `builtin` / `project` / `invalid`）与 A-7 的 `counts`（6 键：`assets` / `roles` / `skills` / `builtin` / `project` / `invalid`）是**两张不同的表**，不得混用。

---

## 附录 B 术语与未决问题

### B.1 术语

| 术语 | 含义 | 易混对象 |
|---|---|---|
| 角色（role） | 静态定义资产，描述"这类工作由什么样的执行者承担" | 不是"某个会话"，也不是"某个节点" |
| 角色实例（role instance） | 某角色在**某一次实例**里的运行视图：状态、活跃会话、服务节点 | 不是角色定义的副本；不落盘 |
| 注册表（registry） | 角色与技能定义的集合，含内置与项目两层 | 不是 `state.json`；不含运行态 |
| 资产（asset） | 一个角色文件或一个技能目录 | 与"实例"无关 |
| 服务节点（serving node） | 该角色当前正在服务的节点（节点处于执行中或待校验） | 不等于"该角色名下的全部节点" |
| 活跃会话（active session） | 该角色名下节点绑定的、状态不是空闲的会话 | `idle` 的会话不算活跃，但它仍在 `roleToSessions` 里 |
| `inactive` | 工作流声明了该角色，但本实例没有节点绑定它 | 与 `available`（有节点但都还没开始）不同 |
| 派生视图 | 只由"实例快照 + 图 + 注册表"三份输入算出的只读结果，不落盘、不回写 | 与"缓存"不同：缓存可以过期，派生视图不会 |
| 模板（template） | 内建图（`single` / `code-loop` / `task-loop`） | 不是工作流文件（I1.6） |

### B.2 未决问题与假设

| # | 问题 | 本轮结论 | 影响面 |
|---|---|---|---|
| B-01 | 内置资产放仓库根的 `assets/` 还是 `src/assets/` | 放仓库根 `assets/`：资产不是代码，不进 `src/`，也不被架构扫描的目录覆盖 | 打包与路径解析：`src/registry/assets.js` 用模块自身路径反推仓库根 |
| B-02 | 项目级技能是否支持覆盖内置技能 | 支持：`.orch/skills/<id>/SKILL.md` 与内置同 id 时以项目版为准，规则与角色一致 | 与 I1.6 的 `orch skill` 命令族一致，不冲突 |
| B-03 | `role show --instance` 在实例不可读（`STATE_CORRUPT`）时的表现 | 沿用既有 `instance.get` 的失败口径：打印 `状态不可读，已备份为 state.json.corrupt`，退出码 1；角色定义部分照常打印 | 不新增错误码 |
| B-04 | 角色实例是否需要 `cooldown` 的时长（"刚完成"的判定窗口） | 本轮**不用时长**：只要该角色名下有已完成节点、且没有正在服务的节点、实例未终结，就是 `cooldown`；时长展示留给 I1.9 的健康度 | 避免引入时钟依赖，AC-24 可稳定判定 |

---

## 附录 C 变更记录

| 版本 | 日期 | 变更 | 说明 |
|---|---|---|---|
| v1 | 2026-11-08 | 初稿 | 44 条 AC、28 条 BR、7 条 M、11 条 C；待独立评审 |
| v2 | 2026-11-08 | 第 1 轮评审修复 | 45 条 AC（新增 AC-45 项目级技能覆盖）、29 条 BR（新增 BR-29）、M 扩到 M-9（新增 M-8 注释改写、M-9 标志按子命令限定）、C 扩到 C-13（新增 C-12 字段映射、C-13 中文名唯一来源）；补 A-5 用法块与 `REGISTRY_ERROR` 明细表、A-7 validate JSON 结构；修 AC-04/11/18/19/20/21/26/30/38/40/44 的判定锚点；正文中指向"授权断言清单"的引用统一到 D-8（D-9 只保留"测试与夹具约束"） |
| v3 | 2026-11-08 | 第 2、3 轮评审修复 | 8 条阻塞项：用法块补 3 行 role 子行、`--instance` 的核心在线口径（C-09/BR-24/AC-38/39/27/B-03）、D-7 词表取舍理由、AC-29 停点、§3.3 删 90 秒兜底、AC-12 文本/JSON 分流、C-06+D-5 活跃会话含 `quarantined`、用例文件数统一为 8；另修 15 条非阻塞（A-6 示例真值、AC-09 `counts`、AC-20/38/44 锚点、A-3 文案、`--files` 与 `--dirs` 互斥等）。第 3 轮又修：§1.3-8/§2.7/NFR-07 三处核心口径、AC-20 停点、A-3「本实例未使用该角色」、A-6 该情形 `roleInstance: null`、§3.3 给 AC-28/AC-45 覆盖前后例外、D-7 补词表取舍理由、D-5 补未知角色排序 |
| v4 | 2026-11-08 | 第 4 轮评审 PASS 后收口 | 3 条非阻塞观察落地：§3.3 第 5 条中间态清单补 AC-20/AC-21 并写明"必须停在非终态"的理由；BR-24 首句补「不带 `--instance` 时」限定，明确带 `--instance` 仍只读；「裁调」→「裁决」误植。AC/BR/M/C/A/D 编号与数量不变（45 / 29 / M-1~9 / C-01~13 / A-1~7 / D-1~9） |
| v5 | 2026-11-08 | **拆分期独立评审发现的 4 处结构性缺陷（必改，否则门禁必然变红）** | ① **D-7 第 2 条**：31 词扫 `src/registry` 与 D-3 的分组枚举 `coordinator` 构造性互斥，改为 30 词（去掉 `coordinator`）+ 一条更强的定点断言（`coordinator` 在 `src/registry` 只允许出现在 `GROUPS` 一行）；AC-40 的 Given/Then 同步。② **A-5 用法块**：首行 `用法：orch run|status|cancel|role|core` 会让 `test/wp6/main.test.js:77` 的 `includes('orch run|status|cancel|core')` 失效，而 AC-42 不许改既有断言——首行恢复为 `orch run|status|cancel|core`，`role` 只经 3 条子行体现，仍 8 行。③ **D-5**：`unknown-role` 必须排在 `inactive` 之前（否则"声明了但 yaml 被删且零绑定"会算出 `inactive`）；排序键对未注册角色要用 `GROUP_ORDER.length` 而不是 `indexOf` 的 `-1`。④ **D-3**：`YAML_PARSE_FAILED` 的 `{detail}` 在 A-4 里是中文，但 `src/registry` 不许有 CJK（AC-43 优先级更高）——解析器改返回 `detailKey` + `detailParams`，`labels.js` 新增 `YAML_DETAIL` 映射，A-4 输出不变。AC/BR/M/C 编号与数量仍为 45 / 29 / M-1~9 / C-01~13 |
| v6 | 2026-11-08 | 第 2 轮拆分期复评的连带修正（**均为 v5 的配套，不改判定语义**） | ① C-05 与 §1.2 指标 6 的优先级链同步为 `retired > unknown-role > inactive > …`（v5 只改了 D-5，留下 C-05 一处旧链，属自相矛盾）；C-05 补一句"`unknown-role` 是 `unavailable` 的子情形但先于 `inactive` 判定"。② D-5 排序键改为 `role?.id ?? roleId`：写成 `role.id` 会在未注册角色上直接 TypeError（WP-5 的门禁必红）。③ BR-26 的"31 个资产名"补限定为"`src/registry` 按 30 词口径，`GROUPS` 的 `coordinator` 是唯一例外"。④ D-3 的 `YAML_DETAIL` 收敛为**一张表**（值里带占位符），删掉 `YAML_DETAIL_PARAM` 的第二张表说法。⑤ D-1 补：`labels.js` 职责含 `YAML_DETAIL`；`roles.js` 允许依赖 `templates/index.js`（只取 `getGraph`）。⑥ M-5 的表名改为实现用的终名（`GROUP_LABEL` / `ROLE_INSTANCE_STATUS_LABEL` / `ROLE_CLI_TEXT` / `YAML_DETAIL`），与拆分文档 F-6 一致。⑦ D-7 标题去掉"必须传全 31 词"的绝对表述。⑧ AC-41 的机检命令改为 `Object.keys(p.dependencies ?? {}).length`：当前 `package.json` 没有 `dependencies` 键，原写法会抛。AC/BR/M/C 编号与数量仍为 45 / 29 / M-1~9 / C-01~13 |

---

## 附录 D 实现约束（非用户可见，供实现与任务拆分使用）

### D-1 模块与文件边界

| 模块 | 职责 | 允许依赖 | 禁止 |
|---|---|---|---|
| `src/registry/yaml-lite.js` | YAML 子集解析（D-2） | 无 | 引第三方、读写文件 |
| `src/registry/skill-file.js` | 拆前置元数据与正文，复用 `yaml-lite` | `yaml-lite` | 读写文件、拼中文 |
| `src/registry/role-schema.js` | 字段契约常量（必填键、五组、产物类型、副作用、并发范围）与单条校验 | 无 | 读写文件、出现具体角色名/技能名 |
| `src/registry/index.js` | 目录扫描 → 解析 → 校验 → 合并 → 技能引用解析；返回 `{ok, registry, errors, counts}` | 上面三个 + `node:fs` + `assets.js` | 出现具体资产名、写文件、建目录、联网 |
| `src/registry/role-instances.js` | 纯函数 `buildRoleInstances({state, graph, roles})` → `{roles, roleToSessions}` | 无 | 读写文件、中文、出现资产名 |
| `src/registry/assets.js` | 反推内置资产目录（`assets/roles`、`assets/skills`） | `node:url` / `node:path` | 出现资产名 |
| `src/cli/roles.js` | `role` 子命令的参数校验、加载、渲染调度、退出码；把 `registry` 返回的 `{code, field, line, params}` 经 `labels.js` 的 `REGISTRY_ERROR` 组装成人话明细 | `registry/*`、`templates/index.js`（只取 `getGraph`）、`render.js`、`labels.js` | 任何中文字面量（AC-43）、直接读 `state.json`（实例状态走 `instance.get`） |
| `src/cli/main.js` | 命令树与 `run` 预检 | `roles.js` | 角色/技能中文字面量 |
| `src/cli/render.js` | 三个渲染函数 | `labels.js` | 读文件、发 IPC |
| `src/cli/labels.js` | 分组名、角色实例状态名、role 命令文案、14 条 `REGISTRY_ERROR` 明细模板、5 条 `YAML_DETAIL`、`USAGE_LINES` | 无 | — |
| `src/templates/index.js` | 三个图增 `roles` 声明 | 无 | 改节点/边/提示词 |

### D-2 YAML 子集（自实现，零依赖）

**支持**：块映射（2 空格缩进）、块序列（`- ` 开头）、行内序列（`[a, b]`）、纯量、单/双引号标量、整行与行尾注释（`#` 前必须有空白）、布尔 `true`/`false`、整数、空值（键后无内容 → `null`）、UTF-8 中文标量。

**不支持（遇到即 `YAML_PARSE_FAILED`）**：多行块标量（`|`、`>`）、锚点/别名（`&`、`*`）、行内映射（`{a: b}`）、制表符缩进、`---` 文档分隔、多文档、合并键 `<<`。

**报错要求**：每条错误带 `line`（1 基）与一句 `detail`；同一文件只报第一条错误即停止解析。缩进不一致（同一层级出现 2 与 4 空格）、序列项缺少冒号后的值、键重复都算语法错误。

### D-3 字段契约与校验顺序

**角色必填键（9）**：`schema`（固定 `role/v1`）、`id`、`name`、`group`、`summary`、`artifact_type`、`side_effect`、`skills`、`max_concurrent_sessions`。

**可选键**：`tools`、`wake_allow`、`inputs`、`outputs`、`dispatchable`。

**取值**：
- `group` ∈ `coordinator` / `research` / `writing` / `coding` / `ops`
- `artifact_type` ∈ `code` / `document` / `dataset` / `report`
- `side_effect` ∈ `none` / `read` / `write` / `exec`
- `max_concurrent_sessions`：1~5 的整数
- `skills` / `tools` / `wake_allow`：字符串数组（可为空数组）
- `dispatchable`：布尔（缺省按 `true`）
- `id`：`^[a-z][a-z0-9-]*$`，长度 2~32

**技能必填键（4）**：`schema`（固定 `skill/v1`）、`id`、`name`、`summary`；**可选**：`applies_to`（五组取值的数组）、`commands`（字符串数组）；正文（前置元数据之后的部分）去掉首尾空白后必须非空。

**校验顺序（固定，不得调换）**：

1. 扫描目录：内置 `assets/skills/*/SKILL.md` → 项目 `.orch/skills/*/SKILL.md`；内置 `assets/roles/*.yaml` → 项目 `.orch/roles/*.yaml`。
2. 技能：① 文件存在 → `SKILL_FILE_MISSING`；② 解析前置元数据 → `YAML_PARSE_FAILED`；③ 必填键 → `SKILL_SCHEMA_MISSING`（缺一个报一条，`field` 指名）；④ 目录名与 `id` → `SKILL_ID_MISMATCH`；⑤ `applies_to` 取值 → `SKILL_GROUP_INVALID`；⑥ 正文为空 → `SKILL_BODY_EMPTY`。
3. 角色：① 解析 → `YAML_PARSE_FAILED`；② 必填键 → `ROLE_SCHEMA_MISSING`；③ `id` 字符集与文件名 → `ROLE_ID_MISMATCH`；④ `group` → `ROLE_GROUP_INVALID`；⑤ `artifact_type` → `ROLE_ARTIFACT_TYPE_INVALID`；⑥ `side_effect` → `ROLE_SIDE_EFFECT_INVALID`；⑦ `max_concurrent_sessions` → `ROLE_MAX_CONCURRENT_INVALID`；⑧ 技能引用（在**技能全部加载完之后**）→ `ROLE_SKILL_NOT_FOUND`。
4. 内置资产目录整体缺失 → 单条 `REGISTRY_ASSETS_MISSING`，不再逐文件报错。

一个文件可以产生多条错误（AC-14 就是两条），但同一文件的同一原因码只报第一条。

**谁拼中文**：`src/registry/**` 只返回 `{code, file, scope, field, line, params}`，**不拼任何中文**；人话明细由 `src/cli/roles.js` 用 `labels.js` 的 `REGISTRY_ERROR[code]` 模板（占位符替换）组装。`Registry` 的 `detail` 字段只出现在 CLI 输出层（A-4 / A-5 / A-7），核心与注册表内部不产生中文。

> **v5 修正：YAML 语法错误的 `detail` 也不能由解析器拼中文。** `YAML_PARSE_FAILED` 的明细模板是 `第 {line} 行无法解析：{detail}`（A-5），其中 `{detail}` 在 A-4 的基线里是中文（`缩进不一致`）。但 `src/registry` 不许出现 CJK（AC-43，优先级高于附录 A），所以 `yaml-lite` 必须返回**机器可读的键**而不是整句：`{ok:false, line, detailKey, detailParams}`，`detailKey ∈ { inconsistent-indentation, unsupported-token, duplicate-key, missing-value, missing-front-matter }`（`missing-front-matter` 由 `skill-file` 产出）。`index.js` 把 `detailKey` / `detailParams` 原样塞进 `params`；`labels.js` 新增**一张** `YAML_DETAIL` 表（键 → 中文短语，值里可带 `{token}` / `{key}` 这类占位符，由 `roles.js` 用 `detailParams` 填充），共 5 个键：`inconsistent-indentation` → `缩进不一致`、`unsupported-token` → `不支持的语法：{token}`、`duplicate-key` → `键重复：{key}`、`missing-value` → `缺少值：{key}`、`missing-front-matter` → `缺少前置元数据分隔符`。这样 A-4 的 `第 4 行无法解析：缩进不一致（YAML_PARSE_FAILED）` 仍能逐字产出，同时注册表零中文。

### D-4 加载与合并

```
loadRegistry({root}) ->
  1. assetsRoot = <仓库根>/assets（由 src/registry/assets.js 反推）
  2. 内置技能 = 扫描 assets/skills；项目技能 = 扫描 <root>/.orch/skills（不存在即跳过，不报错）
  3. 技能表 = 内置按 id → 项目覆盖（source='project'）
  4. 角色同上：assets/roles → <root>/.orch/roles
  5. 校验（D-3 顺序）→ errors[]；合法角色与技能进入表，不合法的只进 errors
  6. counts = { total: 合法角色数, builtin, project, invalid: errors 涉及的文件数, roles: 合法角色数, skills: 合法技能数, assets: 参与校验的资产总数 }
```

- 合并粒度是**整个文件**：项目版不继承内置版的任何字段。
- 排序：`groups` 顺序固定为 D-3 的五组顺序；组内按 `id` 字典序（`<` 比较，非 locale）。
- 加载全程只读（C-03）：不 `mkdir`、不 `writeFile`、不读实例、不联网。

### D-5 角色实例计算

```
buildRoleInstances({ state, graph, roles }) ->
  roleIds = 去重( [...(graph.roles ?? []), ...graph.nodes.map(n => n.roleId)] )
  roleIds = 按 (role ? GROUP_ORDER.indexOf(role.group) : GROUP_ORDER.length, role?.id ?? roleId) 稳定排序
  roleToSessions = {}
  for roleId of roleIds:
    known   = roles.has(roleId)
    bound   = state.nodes.filter(n => n.roleId === roleId)
    serving = bound.filter(n => n.state === 'running' || n.state === 'review')
    sess    = state.sessions.filter(s => bound.some(n => n.nodeId === s.nodeId))
    active  = sess.filter(s => s.state !== 'idle' || s.quarantined === true)
    if sess.length > 0: roleToSessions[roleId] = sess.map(s => s.sessionId)   // 只写非空
    status =
      TERMINAL(state.state)                                   ? 'retired'
    : known === false                                         ? 'unavailable'   // v5 修正，见下方说明
    : bound.length === 0                                      ? 'inactive'
    : sess.some(s => s.quarantined === true || s.state === 'escalated') ? 'unavailable'
    : serving.length > 0                                      ? 'busy'
    : bound.some(n => n.state === 'done')                     ? 'cooldown'
    :                                                           'available'
    statusReason =
      status !== 'unavailable' ? null
    : known === false          ? 'unknown-role'
    : sess.some(s => s.state === 'escalated') ? 'escalated'
    :                            'quarantined'
    lastAction = bound 中 stateSince 最大者 → { nodeId, round, maxRounds: graph.maxRounds[nodeId] ?? null, state, stateSince }
```

- `TERMINAL(state.state)` 与既有渲染口径一致：`completed` / `failed` / `cancelled` / `interrupted`（`suspended` **不是**终态）。
- `graph` 由 `state.template` 经 `getGraph` 取得；取不到图时 `roleIds` 只来自节点（`graph.roles` 缺失按空数组）。
- 排序键：`(role ? GROUP_ORDER.indexOf(role.group) : GROUP_ORDER.length, role?.id ?? roleId)`；注册表里查不到的角色 `role` 为 `undefined`，一律**排在最后**并按 `id`（即 `roleId`）字典序（保证顺序稳定，AC-31 可判）。**必须写 `role?.id ?? roleId`**：写成 `role.id` 会在未注册角色上直接 TypeError（v5 修正）。**注意**：直接写 `GROUP_ORDER.indexOf(role.group)` 会得到 `-1`、把它排到**最前**，与"排最后"相反（v5 修正）。
- 角色在注册表里查不到时（`known === false`）：`status='unavailable'`、`statusReason='unknown-role'`，并在文本输出追加 `（注册表中不存在该角色）`。该判定**排在 `inactive` 之前**——否则"图里声明了、yaml 被删掉、又没有节点绑定"的角色会算出 `inactive`，与本条要求冲突（v5 修正）。修正后的优先级为 `retired > unknown-role > inactive > unavailable > busy > cooldown > available`，C-05 的"命中即停"仍然成立。
- 计算是纯函数：不读文件、不看时钟，同一输入必得同一输出（NFR-04）。

### D-6 CLI 参数与预检

- `role` 子命令集合：`list` / `show` / `validate`；位置参数只有 `show` / `validate` 接受一个角色 id。
- 标志适用范围：`--group` 仅 `list`；`--instance` 仅 `list` / `show`；`--format` 三者皆可（`text` | `json`，缺省 `text`）。超范围使用是用法错误（A-5）。
- `parseArgs` 需要的最小扩展：`COMMANDS` 加 `role`；`role` 取出子命令与可选位置参数；`VALUE_FLAGS` 加 `group`、`format`。既有命令的解析结果一个字段都不许变。
- `runCommand` 预检顺序（C-10）：`--cwd` / `--task` 解析 → 模板名存在（沿用既有 `getGraph` 判定与报错）→ 注册表加载与校验 → 连接/启动核心。注册表不合法时打印 A-5 的 `注册表不合法：<第一条明细>`，返回 3，**不连接核心**。
- 渲染：`renderRoleList` / `renderRoleShow` / `renderRoleValidate` 只做字符串拼接；分组名、状态名、所有模板文字来自 `labels.js`；JSON 输出用 `JSON.stringify(value, null, 2)` 后整块打印。

### D-7 架构纯净词表（31 词；第 1、3 条命令传全 31 词，第 2 条按下方 v5 修正用 30 词）

```
task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check
```

命令（三条都要 exit 0）：

```bash
# 1) 引擎：既有的 11 词 + 本轮新增的 20 个资产名
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <上面 31 词>

# 2) 注册表实现：不得硬编码任何资产名（掉一个词，见下方 v5 修正）
node test/fixtures/purity-check.mjs --dirs src/registry --forbid <上面 31 词，去掉 coordinator，即 30 词>

# 3) 新增的 role 命令实现：同上
node test/fixtures/purity-check.mjs --files src/cli/roles.js --forbid <上面 31 词>
```

> **v5 修正（结构性缺陷，必须按此实现）**：第 2 条**不能用 31 词**。`coordinator` 既是角色 id 又是**分组 id**，而 D-3 要求注册表知道 `group ∈ coordinator / research / writing / coding / ops` 这五个取值——`src/registry/role-schema.js` 的 `GROUPS` 常量必然含字面量 `coordinator`，而 `purity-check.mjs` 是子串匹配（`lines[ln].includes(word)`），31 词扫 `src/registry` 是**构造性必然失败**，AC-40 的"三条都 exit 0"永远达不成。
> 因此第 2 条用 30 词（去掉 `coordinator`），并用一条**更强**的定点断言补回强度（写进 `test/wp11/purity.test.js`）：`coordinator` 在 `src/registry/**` 里**只允许出现 1 次**，且必须在 `role-schema.js` 的 `GROUPS` 那一行（用 `--files` 逐文件扫、统计命中行数）。这条断言比"整目录零命中"更精确：它允许唯一合法的枚举定义，同时禁止任何按分组 id 分支的代码。
> 第 1、3 条仍用 31 词全表（`src/core` / `src/daemon` / `src/cli/roles.js` 都不需要分组枚举字面量——`roles.js` 从 `role-schema.js` import `GROUPS`，不复制）。

**词表取舍理由（逐条可核）**：`single` 不进表——它同时是图 id、提示词模板键与通用英文词，引擎里合法出现（如 `single` 分支），禁它会要求改核心语义；16 个角色 id 全部进表，但 10 个**新增**角色的中文名不进表——"测试/开发/编辑/裁决"这类词与引擎注释、既有文案里的通用词冲突（实测 `测试` 在 `src/core` 4 处命中），只收 I1.3 已收的 3 个中文名；10 个技能 id 全部进表。因此 31 词 = 既有 11 词 + 10 个新角色 id + 10 个技能 id。`coordinator` 留在第 1、3 条的表里，只在第 2 条按上面的说明去掉（它是本表唯一一个"同时是分组 id"的词）。

> 第 3 条必须用 `--files` 只扫这一个文件：`src/cli/labels.js` **合法地**包含既有 6 个角色名与三个中文名，扫整个 `src/cli` 会必然误报。`--files` 是本轮给 `test/fixtures/purity-check.mjs` 新增的入参（相对仓库根，逗号分隔）；**给了 `--files` 时只扫这些文件**（`dirs` 视为空，不再叠加默认的 `src/core,src/daemon`），没给时 `--dirs` 的行为与默认值一概不变。

### D-8 授权断言与改动清单

**本轮不修改任何既有测试断言**（逐处核过）：

| 位置 | 现状 | 本轮结论 |
|---|---|---|
| `test/wp2/labels.test.js:137` | `deepEqual({...ROLE_LABEL}, {...6 项...})` | 不动。本轮**不往 `ROLE_LABEL` 加条目**，新角色中文名来自 YAML |
| `test/wp2/labels.test.js:234/295/306` | `REASON_LABEL` 39 项、`REVIEW_TEXT` 11 项、`ARTIFACT_TEXT` 5 项 | 不动。这些表一个键都不加 |
| `test/templates/task-loop.test.js:299-301` | 299-300 行两个 `productPolicy` 断言；301 行 `Object.keys(GRAPHS)` 三键 | 不动。只给图对象**增** `roles` 字段，不加图、不加 `productPolicy` |
| `test/wp9/cli-e2e.test.js:214` | `stdout.includes('用法：orch run')` | 不动。用法块第 1 行保持 `用法：orch run|status|cancel|core`（A-5 v5 修正），仍包含该子串 |
| `test/wp6/main.test.js:8-40` | `parseArgs` 的既有断言 | 不动。`role` 是**新增**命令分支，既有输入的解析结果不变 |

**非断言类改动（需在 report 里单列）**：

| 位置 | 改动 | 理由 |
|---|---|---|
| `src/core/advance.js:65`、`src/core/orchestrator.js:1856`、`src/core/orchestrator.js:2267` | 三处注释里的 `planner` 改成 `dispatcher` / `scheduler` 等同义说法 | `planner` 是新增内置角色 id，要进 D-7 词表；这三处是引擎注释里的普通英文词，不改就无法让扫描 exit 0。**纯注释，零行为变化** |
| `src/cli/render.js:55-61` | `USAGE_LINES` 迁到 `labels.js` 并补 `role` 用法行 | M-5 / C-13：中文唯一来源。迁移不改变任何既有字符 |
| `test/fixtures/purity-check.mjs` | 新增 `--files <逗号分隔文件列表>` 入参（相对仓库根）；`--dirs` 行为与默认值一概不变 | D-7 第 3 条要精确扫 `src/cli/roles.js`；传文件给 `--dirs` 会被静默当成空目录（`readdirSync` 抛错被吞），扫 0 个文件却 exit 0 —— 那是假绿 |

### D-9 测试与夹具约束

- 新增用例统一放 `test/wp11/`，8 个文件：`yaml-lite.test.js`、`skill-file.test.js`、`role-schema.test.js`、`registry.test.js`、`role-instances.test.js`、`assets.test.js`、`cli-role.test.js`、`purity.test.js`（D-7 三条扫描命令 + AC-43 的 CJK 扫描，各断一次 exit 码）。
- 纯函数类用例（`yaml-lite` / `skill-file` / `role-schema` / `role-instances`）**不碰磁盘**：输入是字符串或内存对象。
- `registry.test.js` / `assets.test.js` 用 `fs.mkdtemp` 在 `os.tmpdir()` 下造项目根，**不放仓库内**；`assets.test.js` 直接读真实 `assets/`（内置资产是产品的一部分，必须被测试覆盖）。
- `cli-role.test.js` 直接 `import { main } from '../../src/cli/main.js'` 并注入 `out` 收集行、注入 `cwd`，**不 spawn 进程、不启核心**；需要退出码就用返回值。
- 全量测试命令固定 `node --test "test/**/*.test.js"`；回归断言用下限（`fail === 0 && pass === tests && tests >= 418`）。
- 任何用例都不得写仓库目录（`.orch/`、`.mock/` 一律在 `os.tmpdir()` 下）；串行场景每 10 个回收一次核心（沿用既有经验）。
