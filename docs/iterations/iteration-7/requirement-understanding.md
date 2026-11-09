# I1.7 需求理解 · 需求理解工程师产出

- **迭代号**：I1.7 / 阶段一
- **评审对象**：`docs/iterations/iteration-7/requirement.md` **v2**（状态：评审 PASS，依据 `review-round2.md` §0 总判 PASS、阻断 0 项、F-01/F-02 已闭合）
- **上游契约**：`docs/iterations/iteration-6/requirement.md`（I1.6 已收口，HEAD `3f35bfa`）
- **本文件角色**：需求理解工程师产出（**只读**，不改 `requirement.md` 或任何源文件；不为「变绿」而删 AC / 改 Then）
- **结论前置**：定稿需求 14 条 AC、11 条 BR 连续无缺漏、双向覆盖闭合、31 词架构检查逐字一致且实跑 `exit 0`（见 `review-round2.md` §6）；本文件仅做「范围 / 分面 / 契约 / 索引 / 假设 / Given 可构造性 / 回归红线」的结构化梳理，便于主控复核与实现方落地。

---

## 1. 范围（In / Out）

> 依据需求 **§1.3 范围**（requirement.md L36–53）。括号内为对应 AC / BR 引用。

### 1.1 范围内（本次让用户获得的新能力）

| # | 范围内能力 | 对应 AC | 对应 BR |
|---|---|---|---|
| In-1 | 四类 `artifact_type` 产物隔离落地：`code`→git worktree、`document`→版本化文件区、`dataset`→快照区、`report`→只追加区 | AC-01 / AC-02 / AC-03 / AC-04 | BR-01 / BR-02 / BR-03 / BR-04 |
| In-2 | 代码类角色：独立 worktree、独立分支；核心管理合并顺序（顺序合并、可观测） | AC-05 / AC-06 | BR-01 / BR-05 / BR-09 |
| In-3 | 合并冲突检测与升级（复用 I1.2/I1.4 升级机制，不新造 UI） | AC-08 / AC-09 | BR-07 / BR-09 |
| In-4 | 规划验收句的可复现判定：两开发角色并行改同模块不同文件→顺序合并无覆盖；改同一文件→冲突被检测并升级 | AC-07 / AC-08 | BR-06 / BR-07 |

### 1.2 范围外（明确留给后续迭代，本次不覆盖）

| # | 范围外能力 | 出处 | 对应 AC（应为无） |
|---|---|---|---|
| Out-1 | 崩溃恢复 / ACP 恢复方言 | §1.3 L47（留 I1.8） | 无（不拉入 AC） |
| Out-2 | 版本锁（能力域 2「版本锁定」项） | §1.3 L48（留 I1.12 或更后） | 无 |
| Out-3 | 产物汇总顺序里「文档版本合并 / 数据人工裁决」细节（能力域 2「产物合并/汇总顺序」整体留后续；本次只做单类型隔离与代码合并仲裁，不做跨类型汇总裁决） | §1.3 L49 | 无 |
| Out-4 | 真实 git 远程推送（本次只在本地仓库内做 worktree/分支/合并，不 push） | §1.3 L50（与附录 D-2「不 push」一致） | 无 |
| Out-5 | 跨实例 worktree 共享、worktree 生命周期清理策略（实例终止时保留/清理留后续，即 U-1） | §1.3 L51 | 无（U-1 不阻塞） |
| Out-6 | 冲突的**自动解决**（本次只「检测 + 升级」，不自动解冲突、不自动选边） | §1.3 L52（与 BR-07 / D-6 一致） | 无 |

> 范围核对结论：§1.3 范围外 6 项均未以任何形式写进范围内；review-round2.md 的 A-3 已确认「规划范围外未被写成范围内」。In 4 项 / Out 6 项均与需求 §1.3 一一对应，无越界、无收窄。

---

## 2. AC 清单与分面

> 分面口径：按需求给每条 AC 的「场景类型」归主面，跨面项在「可见性（跨面）」单列。每条给「引用 BR / 风险 / 一句话判定要点」。

### 2.1 功能（6 条：AC-01, AC-03, AC-05, AC-06, AC-09, AC-12）

| AC | 引用 BR | 风险 | 判定要点 |
|---|---|---|---|
| AC-01 · code → 独立 worktree 与分支被创建 | BR-01, BR-09 | 中 | worktree 目录存在、分支存在、产出文件位于该 worktree 内、未进共享区或其它角色空间 |
| AC-03 · dataset → 快照区 | BR-03 | 中 | `artifacts/data/` 下存在按轮次独立命名的快照文件，不同轮次互不影响 |
| AC-05 · 两 code 角色并行，worktree/分支独立不串扰 | BR-01 | 中 | 两 worktree 目录与两分支均独立存在、互不包含对方未合并的改动 |
| AC-06 · 合并顺序由核心托管：顺序合并、进度可见 | BR-05, BR-09 | 中 | 合并队列为顺序执行（前一次完成/升级后才进行下一次）、集成线两分支改动均在、进度状态可观测 |
| AC-09 · 同文件冲突后复用既有升级入口裁决后可继续合并 | BR-07, BR-09 | 中 | 升级条目出现在 `orch escalate list`、经 `orch escalate resolve` 后节点状态可继续、集成线含该文件改动（复用 I1.4，无新界面） |
| AC-12 · 用户可见状态：worktree/分支/合并/冲突在实例视图可见 | BR-09 | 低 | 实例状态/图输出含 code 角色的分支名、合并状态文字（进行中/已合并/冲突待升级）及存在的冲突升级条目 |

### 2.2 回归（3 条：AC-02, AC-04, AC-11）

| AC | 引用 BR | 风险 | 判定要点 |
|---|---|---|---|
| AC-02 · document → 版本化文件区（逐字不变） | BR-02, BR-10 | 低 | `artifacts/docs/<名>.v1.md` 与 `.v2.md` 并存且内容独立，与 I1.6 基线逐字一致 |
| AC-04 · report → 只追加区（逐字不变） | BR-04, BR-10 | 低 | `artifacts/reports/` 内容追加语义不变，与 I1.6 基线逐字一致 |
| AC-11 · 向后兼容：doc-single 文档闭环行为逐字不变 | BR-10 | 中（回归红线） | 三主链 `single`/`code-loop`/`task-loop` 输出无变化；全量测试与 `origin/main` HEAD `3f35bfa` 的失败集合差集为 0 |

### 2.3 边界（1 条：AC-10）

| AC | 引用 BR | 风险 | 判定要点 |
|---|---|---|---|
| AC-10 · 非 code 角色不做 git 隔离 | BR-08 | 低 | 仅 `code` 角色产生 worktree；`document` 角色不进入 git worktree，沿用既有版本化文件区隔离（与基线 §6 边界声明第 4 条一致） |

### 2.4 失败异常（2 条：AC-13, AC-14）

| AC | 引用 BR | 风险 | 判定要点 |
|---|---|---|---|
| AC-13 · worktree/分支创建失败 → 节点升级而非静默失败 | BR-01, BR-11 | 中 | 创建失败时生成升级请求、节点状态为 `escalated`、进程未异常退出 |
| AC-14 · 合并异常（工作树脏/被中断）→ 升级而非静默丢失改动 | BR-11 | 中 | 合并异常时生成升级、半成品合并回滚、改动不丢失、两方 worktree/分支仍完整保留待裁决 |

### 2.5 规划验收（2 条：AC-07, AC-08）

| AC | 引用 BR | 风险 | 判定要点 |
|---|---|---|---|
| AC-07 · 验收句 1：不同文件并行改 → 顺序合并无覆盖 | BR-06 | 高（规划逐字验收句） | 合并后 `a.py`、`b.py` 两文件改动均存在、无相互覆盖、无丢失；相关节点均进入完成态 |
| AC-08 · 验收句 2：同文件并行改 → 冲突被检测并升级 | BR-07, BR-09 | 高（规划逐字验收句） | `git merge` 后存在未合并路径（冲突检出）、升级请求已生成、两 worktree/分支仍完整保留、半成品合并已回滚 |

### 2.6 可见性（跨面补充）

> 以下 AC 主面不在「可见性」，但含明确用户可见性维度，单独列出便于验收时关照：
> - **AC-08**（规划验收）：用户可见升级队列出现一条合并冲突升级、相关节点保持等待人工。
> - **AC-09**（功能/复用）：复用既有 `orch escalate list/resolve` 入口，节点继续推进对用户可见。
> - **AC-12**（功能/可见性）：实例视图全程显示分支名与合并状态，无需翻日志。

### 2.7 分面分布汇总

| 分面 | 条数 | AC |
|---|---|---|
| 功能 | 6 | AC-01, AC-03, AC-05, AC-06, AC-09, AC-12 |
| 回归 | 3 | AC-02, AC-04, AC-11 |
| 边界 | 1 | AC-10 |
| 失败异常 | 2 | AC-13, AC-14 |
| 规划验收 | 2 | AC-07, AC-08 |
| 可见性（跨面） | 3（重叠） | AC-08, AC-09, AC-12 |
| **合计** | **14（主面去重后 14，无遗漏）** | AC-01 ~ AC-14 |

---

## 3. BR / M / C 契约清单

### 3.1 本迭代 BR-01~11 列表

| BR | 用户可见业务规则 | 出处 |
|---|---|---|
| BR-01 | 声明 `artifact_type: code` 的角色，运行时各自拥有独立 git worktree 与独立分支，彼此工作树不共享 | §2.6 L121 |
| BR-02 | `artifact_type: document` 的产物进入版本化文件区，按轮次生成新版本文件，不回写上一版 | L122 |
| BR-03 | `artifact_type: dataset` 的产物进入快照区，每轮产出独立快照 | L123 |
| BR-04 | `artifact_type: report` 的产物进入只追加区，新内容追加而非覆盖 | L124 |
| BR-05 | 多个代码角色完成时，核心按确定顺序逐个将其分支合并进集成线，不并发合并 | L125 |
| BR-06 | 两个代码角色改同模块不同文件，顺序合并后两份改动均保留，互不覆盖 | L126 |
| BR-07 | 两个代码角色改同一文件，合并时检测到冲突，核心生成升级请求，不静默覆盖、不自动解冲突 | L127 |
| BR-08 | 非 `code` 类型的角色不做 git 隔离，沿用既有隔离方式（与 §1.5 / §6 边界声明第 4 条一致） | L128 |
| BR-09 | 代码角色的 worktree/分支、合并进度、冲突升级对用户可见（实例状态 / 升级队列） | L129 |
| BR-10 | 既有 `doc-single` 文档闭环行为不变；未声明 `artifact_type` 或取值不被本迭代支持时，回退到既有非 git 隔离 | L130 |
| BR-11 | 当 code 角色的 worktree/分支创建或合并无法安全完成时，核心生成升级请求而非静默丢失改动 | L131 |

### 3.2 M / C 清单

- **M（修改点清单）= 无（独立编号）**：本迭代未在需求中单列 `M` 编号；所有「修改点」已并入**附录 D-7 授权修改清单**（点名文件 + 只改哪段）。
- **C（兼容性清单）= 无（独立编号）**：本迭代未在需求中单列 `C` 编号；所有兼容性承诺已并入 **BR-10 / BR-08 / AC-11** 与附录 D-7（三主链逐字、doc-single 逐字、package.json 空、31 词纯净）。
- 说明：本项目自 I1.2 起的需求模板以「BR（用户可见业务规则）+ 附录 D（实现约束）」表达契约，已覆盖修改与兼容两面，故不另设 M/C 编号，且不影响双向覆盖核对。

### 3.3 BR 双向覆盖核对（每条 BR → 被哪些 AC 覆盖）

| BR | 覆盖 AC（引用来源，需求 L142–285） | 是否闭合 |
|---|---|---|
| BR-01 | AC-01（L142）、AC-05（L186）、AC-13（L274） | ✅ |
| BR-02 | AC-02（L153） | ✅ |
| BR-03 | AC-03（L164） | ✅ |
| BR-04 | AC-04（L175） | ✅ |
| BR-05 | AC-06（L197） | ✅ |
| BR-06 | AC-07（L208） | ✅ |
| BR-07 | AC-08（L219）、AC-09（L230） | ✅ |
| BR-08 | AC-10（L241） | ✅ |
| BR-09 | AC-01（L142）、AC-06（L197）、AC-08（L219）、AC-09（L230）、AC-12（L263） | ✅ |
| BR-10 | AC-02（L153）、AC-04（L175）、AC-11（L252） | ✅ |
| BR-11 | AC-13（L274）、AC-14（L285） | ✅ |

> 反向核对（review-round2.md D-3 已 PASS）：每条 AC 引用的 BR 编号均真实存在于 §2.6（无悬空）；11 条 BR 全部被 AC 引用（无孤立）。**双向覆盖 11/11 闭合。**

---

## 4. 附录 A / D 索引

### 4.1 附录 A 输出基线（用户可见文案键）→ 对应 AC

> 文案一律取自 `src/cli/labels.js`（中文唯一来源）；键名若不存在由本迭代实现补充（授权见 D-7）。

| 文案场景 | labels.js 键 | 对应 AC | 说明 |
|---|---|---|---|
| code 角色分支与 worktree 状态（分支名、合并中/已合并/冲突待升级） | `CODE_ROLE_BRANCH` / `MERGE_PENDING` / `MERGE_MERGING` / `MERGE_MERGED` / `MERGE_CONFLICT` | AC-01 / AC-05 / AC-12 | 状态文字，复用既有状态展示通道（附录 A L315） |
| 合并冲突升级条目原因 | `ESCALATION_REASON_MERGE_CONFLICT` | AC-08 / AC-09 / AC-14 | 升级原因文案，复用 I1.4 升级渲染（L316） |
| worktree/分支创建失败升级 | `ESCALATION_REASON_WORKTREE_INIT_FAILED` | AC-13 | 复用 I1.4 升级渲染（L317） |
| doc-single 文档闭环既有文案 | 沿用 I1.3/I1.6 现有键，不新增 | AC-11 / AC-02 / AC-04 | 逐字不变（L318） |
| dataset/report 隔离落盘（无新用户提示时为空） | 无新增文案 | AC-03 / AC-10 | 仅路径隔离，无新提示（L319） |

### 4.2 附录 D 实现约束（D-1~D-7）逐条摘要 + 涉及源文件

| 约束 | 一句话摘要 | 涉及源文件 |
|---|---|---|
| **D-1 路径与 git 布局** | 新增 `instanceCodeWorktreeDir(root,id,roleId)`→`<workspace>/worktrees/<roleId>`（基线 §5.2 `artifacts/code/` 示意的具体实现形态，不再另建平铺 `artifacts/code/`）、`instanceDataDir`→`<workspace>/artifacts/data`；worktree 父 git 仓库初始化于 `<workspace>`，每 code 角色 `git worktree add <dir> -b maestro/<instanceId>/<roleId>`；既有函数不改、新增函数不得含 31 禁词 | `src/persistence/paths.js` |
| **D-2 git 操作范围** | 仅本地 `init`/`worktree add`/`branch`/`merge`（fast-forward 或 `--no-ff` 进 `maestro/<instanceId>/integration`）；**不** push 远程、**不** rebase/squash | 建议新增 `src/core/code-isolation.js` |
| **D-3 artifact_type → 隔离策略映射** | `code`→worktree、`document`→`versioned-doc`、`dataset`→快照、`report`→只追加（`artifacts/reports`）；`productPolicy:'doc-single'` 行为不变；内置 `developer` 补 `artifact_type:'code'`，`tester` 不改 | `src/templates/index.js`（`ROLES.developer`）、`src/core/doc-artifact.js` |
| **D-4 合并顺序由核心管理** | code 节点 done 入「合并队列」，核心按确定顺序逐个 `git merge`，前一次完成/升级后才进行下一次、**禁止并发**；状态 pending/merging/merged/conflict 写入实例状态与升级展示，复用既有状态机不新增节点态 | 编排核心（orchestrator / `src/core`） |
| **D-5 冲突检测** | merge 后 `git diff --name-only --diff-filter=U` 或检查退出码，unmerged 非空即冲突；`git merge --abort` 回滚半成品合并，保留两角色 worktree 与分支完整 | 新增 `src/core/code-isolation.js` |
| **D-6 升级入口复用 I1.2/I1.4** | 冲突/创建失败/合并异常 → 调用既有 `orch escalate`（reason `merge_conflict`/`worktree_init_failed`/`merge_aborted`）；节点入既有 `escalated` 态，保持 `escalated→cancelled` 取消路径（I1.2）；本迭代不新造升级 UI | `src/core`（复用既有 escalation） |
| **D-7 回归与授权断言修改清单** | 三主链输出逐字不变；新行为打破既有精确断言时一律扩清单/补测试，不许弱化断言或放宽 `Then`；纯净扫描 31 词；**授权修改点名**：`src/templates/index.js`（`developer` 加 `artifact_type:code`）、`src/persistence/paths.js`（追加两函数）、`src/core/workspace.js`（补 git 仓库确保）、`src/core/doc-artifact.js`（`resolveNodeProducts` 加 code 分支）、`src/cli/labels.js`（追加文案键）、新增 `src/core/code-isolation.js`（禁词+无 `if host==`） | 上述 6 处 |

---

## 5. 未决问题与假设

### 5.1 附录 B 未决问题（U-1/U-2/U-3）

| 未决项 | 内容 | 是否阻塞开工 | 验收前置/说明 |
|---|---|---|---|
| **U-1**（不阻塞） | 实例终止时 worktree/分支的清理策略（保留或删除）本迭代未定，留后续 | **否** | 因本迭代只实现创建与合并；不影响任何 AC 的 Given 构造 |
| **U-2**（不阻塞） | `dataset` 快照区的「快照」具体命名/指纹方式（按轮次还是内容哈希）由实现侧在附录 D 约束内决定 | **否** | 不影响需求验收，AC-03 只断言「按轮次独立命名、互不影响」 |
| **U-3**（不阻塞） | 多 code 角色合并顺序的「确定顺序」细则（节点 order 优先还是完成到达顺序优先）由实现侧定，须保证可观测、可复现 | **否** | 不影响开工；AC-06 只断言「顺序执行、无并发 merge、进度可观测」 |

> 结论：**U-1/U-2/U-3 均不阻塞开工**（需求 L328–330 已显式标注「不阻塞」；review-round2.md E-4 已 PASS）。

### 5.2 验收前置条件里的环境假设（需求 §3.3 L299–305）

- **本地 git 假设**：Node ≥ 22；本机 `git` 在 `PATH`；所有 AC 均可用**本地 git 仓库**在 `/tmp` 构造，**无需真实 DSH、无需远程**（B 类零 DSH 夹具面，见 index.md L684 定义）。
- **/tmp 夹具假设**：每个 AC 的独立项目根一律放 `/tmp`（不放仓库内），运行前注入 `NODE_ENV=test`；同进程串行场景 ≤ 10 个。
- **内置 developer 补 `artifact_type:code` 假设**：内置 `developer` 角色在本迭代补 `artifact_type: code`（实现侧，见附录 D-3/D-7）；验收用到的两 code 角色工作流由**夹具构造**，不依赖真实宿主。
- **既有命令可用假设**：`orch escalate list` / `orch escalate resolve`（I1.4 已实现）用于 AC-09 的升级裁决验证。
- **回归基线假设**：全量测试当前基线数字（以 `origin/main` HEAD `3f35bfa` 为准）已全绿，作为 AC-11 / AC-14 回归门禁参照。

---

## 6. Given 可构造性核查（逐 AC）

> 判定口径：每条 AC 的 Given 是否可在**夹具（本地 git + /tmp 独立项目根 + NODE_ENV=test）**上构造；是否存在「历史会话为空闲」之类不可构造状态。结论：**14/14 全可构造，无不可构造状态。**

| AC | 独立项目根（/tmp） | NODE_ENV=test 接缝 | 构造步骤（角色/模板/命令触发） | 断言什么 | 可构造 |
|---|---|---|---|---|---|
| AC-01 | `/tmp/maestro-i17-code`（`git init`） | ✅ | 内置 `developer`（补 `artifact_type:code`）或等价自定义 code 角色，启动只含该角色的实例，派发并让其开始执行 | worktree 目录存在、分支存在、产出文件位于该 worktree 内、未进共享区 | ✅ |
| AC-02 | `/tmp/maestro-i17-doc` | ✅ | `--template task-loop`（doc-single）启动实例，撰写者交出新一版文档 | `artifacts/docs/<名>.v1.md` 与 `.v2.md` 并存且内容独立，与 I1.6 逐字一致 | ✅ |
| AC-03 | `/tmp/maestro-i17-data` | ✅ | 定义 `artifact_type: dataset` 角色，启动实例，驱动两轮产出 | `artifacts/data/` 下两快照独立、互不影响 | ✅ |
| AC-04 | `/tmp/maestro-i17-report` | ✅ | `task-loop` 研究员产出 `artifacts/reports/research-notes.v1.md`，报告角色写出内容 | `artifacts/reports/` 追加语义不变 | ✅ |
| AC-05 | `/tmp/maestro-i17-parallel` | ✅ | 构造含两 code 角色（A、B）的工作流，并行派发且同时执行中 | 两 worktree/两分支独立存在、互不包含对方未合并的改动 | ✅ |
| AC-06 | `/tmp/maestro-i17-merge-order` | ✅ | 同 AC-05 两 code 角色先后完成（入待合并），核心执行合并 | 合并队列顺序执行、无并发 merge、集成线两分支改动均在、进度状态可观测 | ✅ |
| AC-07 | `/tmp/maestro-i17-diff-files` | ✅ | 两 code 角色改同模块不同文件（`a.py`/`b.py`），worktree 隔离后顺序合并 | `a.py`/`b.py` 两文件改动均保留、无覆盖、无丢失 | ✅ |
| AC-08 | `/tmp/maestro-i17-same-file` | ✅ | 两 code 角色改同文件同区段，顺序合并第二份触发冲突 | 未合并路径存在、升级请求生成、两 worktree/分支保留、半成品合并已回滚 | ✅ |
| AC-09 | `/tmp/maestro-i17-resolve` | ✅ | AC-08 冲突升级后，调 `orch escalate list` 看到升级、`orch escalate resolve` 裁决/手动合并后重投 | 节点继续、集成线含该文件改动（复用既有命令族，I1.4 已实现） | ✅ |
| AC-10 | `/tmp/maestro-i17-boundary` | ✅ | 混合实例（含 `document` 角色与 `code` 角色），运行时 | 仅 `code` 角色产生 worktree、`document` 不创建 git 隔离 | ✅ |
| AC-11 | `/tmp/maestro-i17-regress` | ✅ | 重跑三主链 `single`/`code-loop`/`task-loop` 走完 | 输出逐字一致、与 `origin/main` `3f35bfa` 失败集合差集为 0 | ✅ |
| AC-12 | `/tmp/maestro-i17-visibility` | ✅ | 启动 code 实例后，`orch instance status` / `orch instance graph --format json` | 分支名、合并状态文字（进行中/已合并/冲突待升级）及冲突升级条目可见 | ✅ |
| AC-13 | `/tmp/maestro-i17-create-fail` | ✅ | 故障注入使 worktree/分支创建失败（分支名冲突/权限不足），启动实例试图建 worktree | 升级生成、节点 `escalated`、进程未异常退出 | ✅（故障注入可构造） |
| AC-14 | `/tmp/maestro-i17-merge-fail` | ✅ | 故障注入合并异常（工作树脏/被中断），核心合并时触发 | 升级生成、半成品合并回滚、改动不丢失、两方 worktree/分支保留 | ✅（故障注入可构造） |

> 核查结论：**Given 可构造性 14/14 全可构造**。所有 Given 均基于「本地 git 仓库 + /tmp 独立根 + NODE_ENV=test」的 B 类零 DSH 夹具面，无任何「历史会话为空闲」「需真实 DSH 在线」等不可构造状态；AC-13/AC-14 的失败现场由故障注入构造，属可控夹具手段。

---

## 7. 与上一迭代（I1.6）的契约差异与回归红线清单

### 7.1 I1.7 相对 I1.6 改了什么（契约差异）

| # | 差异点 | I1.6 契约状态 | I1.7 新契约 | 依据 |
|---|---|---|---|---|
| Δ-1 | 内置 `developer` 补 `artifact_type: code` | I1.6 仅把 `artifact_type` 当契约字段读取，developer 无此声明 | `src/templates/index.js` 的 `ROLES.developer` 增加 `artifact_type: 'code'`（仅该角色，不动 tester/coordinator） | 需求 §1.1 L16–23、附录 D-3 L354、D-7 L372 |
| Δ-2 | 新增 worktree 路径函数 | I1.6 `paths.js` 仅有 `instanceDocsDir/ReportsDir/SharedDir/StageDir/WorkspaceDir`，**无 code worktree 函数** | 新增 `instanceCodeWorktreeDir(root,id,roleId)`→`<workspace>/worktrees/<roleId>`、`instanceDataDir`→`<workspace>/artifacts/data`（仅追加导出，不改既有函数体） | 需求 §1.1 L20、D-1 L341–345、D-7 L373 |
| Δ-3 | 新增 code 隔离模块 | I1.6 无此模块 | 新增 `src/core/code-isolation.js`（合并队列、冲突检测）；不得出现 31 禁词、不得出现 `if host ==` 分支 | 需求 D-2 L347、D-5 L360、D-7 L377 |
| Δ-4 | `resolveNodeProducts` 新增 code 策略 | I1.6 策略为 `fixed-workspace/versioned-doc/review/declared/heuristic`，**无 worktree 分支** | `src/core/doc-artifact.js` 的 `resolveNodeProducts()` 仅**新增** `code` 策略分支（worktree 路径），不改 `declared`/`versioned-doc` 等既有分支语义 | 需求 §1.1 L22、D-3 L351–353、D-7 L375 |
| Δ-5 | `workspace.js` 补 git 仓库确保 | I1.6 `prepareWorkspace()` 仅在 `graph.productPolicy==='doc-single'` 时预建 `artifacts/{docs,reports}`，其余类型不预建 | `src/core/workspace.js` 的 `prepareWorkspace()` 在识别到 code 角色时**确保 workspace 为 git 仓库**（仅补一段 `if` 分支，不改动 doc-single 既有逻辑） | 需求 §1.1 L21、D-7 L374 |

### 7.2 回归红线清单（逐项，实现方不得触碰）

| # | 回归红线 | 出处 | 校验方式 |
|---|---|---|---|
| R-1 | **三主链 `single` / `code-loop` / `task-loop` 输出逐字不变**；给 `developer` 补 `artifact_type: code` 后，`code-loop` 用户可见编排输出（节点态、handoff、CLI 文案）必须不变（worktree 隔离对既有编排断言透明） | 需求 AC-11 L255、D-7 L368；index.md 回归红线 L711 | 重跑三主链，断言逐字一致；若 `resolveNodeProducts` 因 code 分支改路径触发 `test/wp4/orchestrator.test.js` code-loop 精确断言失败，须扩清单/补测试覆盖 worktree 路径，**不许弱化断言或放宽 Then**（D-7 L369） |
| R-2 | **doc-single 文档闭环逐字不变**（研究笔记路径、版本化文档、审核文件、节点状态流转、CLI 文案均不变） | BR-10、AC-02/AC-04/AC-11 | `task-loop` 版本化文档与 I1.6 基线逐字一致（AC-02 机检）；`artifacts/reports/` 追加语义不变（AC-04） |
| R-3 | **`package.json` 的 `dependencies` 恒为 `{}`**（空，0 键，不引入新第三方运行时依赖） | NF-3 L297、I1.6 BR-34 L451 | 已核实当前 `package.json`（HEAD `3f35bfa`）无 `dependencies` 键；实现后仍须 `node -e "Object.keys(require('./package.json').dependencies ?? {}).length" === 0` |
| R-4 | **`purity-check --forbid` 31 词表 `exit 0`**：`src/core`、`src/daemon` 扫描零命中；新增 `code-isolation.js` 不得出现 31 禁词 | AC-01~14 架构检查逐字一致（L148 等）、review-round2 §6.1 实跑 31 词 exit 0；index.md L711 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词>` 必须 `exit 0`；新增图/角色字面量若落 `src/templates/**` 不扫描，若误落 `src/core,src/daemon` 须并入禁词表 |
| R-5 | **既有 AC 条数只增不减**：I1.6 为 65 AC，I1.7 为 AC-01~14（共 14 条全新），不削减既有；既有测试条数只增不减 | index.md 回归红线 L711「既有测试条数只增不减」 | AC 编号连续无重复（AC-01~14）；全量测试与 `origin/main` `3f35bfa` 失败集合差集为 0（AC-11 机检） |
| R-6（派生） | **`resolveNodeProducts` 既有分支（`declared`/`versioned-doc`/`fixed-workspace`/`review`/`heuristic`）语义不得改动**；新行为打破既有精确断言时一律扩清单/补测试，不许弱断言或放宽 `Then` | D-7 L369–370 | 既有 `task-loop`/`doc-single` 断言全量通过；新增 code 分支为纯增量 |

> 回归红线结论：R-1~R-5 为 index.md / 需求明示的硬红线，R-6 为 D-7 派生的实现约束红线，共 **6 条**。实现方任何改动若触碰上述任一红线，均视为回归门禁失败，须回退或扩清单（非弱化断言）。

---

## 附：复核索引（便于主控定位）

- 需求 v2 总结构：`requirement.md` 标题 L1、状态 L7、一句话说明 L8
- 范围：§1.3 L36–53（范围内 L38–43、范围外 L45–53）
- AC 14 条：§3.1 L139–291（每条含 Given/When/Then/机检/夹具/架构检查）
- BR 11 条：§2.6 L119–131
- 附录 A 文案基线：L309–319；附录 B 未决 U-1/2/3：L321–330；附录 D 实现约束 D-1~D-7：L337–378
- 评审 PASS 与 F 项闭合：`review-round2.md` §0 L10–17、§5 L117–130、§6 实跑 L134–179
- 上游 I1.6 契约 HEAD：`3f35bfa`（requirement.md L4）；`package.json` 当前无 `dependencies` 键已核实
