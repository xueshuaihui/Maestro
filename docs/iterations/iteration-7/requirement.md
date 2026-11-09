# I1.7 产物类型隔离 + 代码 worktree 集成 · 完整需求文档

- **迭代号**：I1.7 / 阶段一（DSH 单宿主完整流程）
- **依据章节**：`docs/index.md` 第一部分 §1.5 任务类型、§4.1 能力域 1（产物类型驱动隔离）、§5.2 数据布局、§6 边界声明第 4 条；第二部分迭代规划 `#### I1.7 — 产物类型隔离 + 代码 worktree 集成`（docs/index.md 约 803–809 行）；上游契约 `docs/iterations/iteration-6/requirement.md`（HEAD `3f35bfa`，I1.6 已收口）。
- **模板路径**：`docs/templates/requirement-template.md`（8 节 + 三条用户视角硬约束；本项目自 I1.2 起扩展为附录 A~D）
- **版本**：v2
- **状态**：**定稿**（S0 第 2 轮独立评审 PASS，2026-11-09；`review-round2.md`）
- **一句话说明**：按角色声明的 `artifact_type` 将产物分流到隔离区——`code` 走 git worktree、`document` 走版本化文件区、`dataset` 走快照区、`report` 走只追加区；并为代码类角色提供独立 worktree 与分支、由核心托管顺序合并，合并冲突被检测并升级给人。

---

## 一、背景与问题

### 1.1 现状与问题

Maestro 的角色契约里已有 `artifact_type` 字段（基线 §1.5、§4.1），它决定「产物隔离由角色声明的 `artifact_type` 决定」。但到 I1.6 收口时，`artifact_type` 仍只是**被当作契约字段读取，没有真正落地目录隔离**：

- 代码类产物（`code`）至今没有 worktree 隔离，多个开发角色若并行改同一模块，改动会落在同一工作树里互相覆盖；
- 文档类（`document`）的版本化文件区由 `task-loop` 的 `doc-single` 策略支撑，研究笔记/报告（`report`）落在 `artifacts/reports`，但 `dataset` 快照区、`code` worktree 都还不存在；
- `src/persistence/paths.js` 目前只有 `instanceDocsDir / instanceReportsDir / instanceSharedDir / instanceStageDir / instanceWorkspaceDir`，**没有 code worktree 路径函数**；
- `src/core/workspace.js` 的 `prepareWorkspace()` 只在 `graph.productPolicy === 'doc-single'` 时预建 `artifacts/{docs,reports}`，其余类型不预建；
- `src/core/doc-artifact.js` 的 `resolveNodeProducts()` 现有策略为 `fixed-workspace / versioned-doc / review / declared / heuristic`，**没有 worktree 分支**；
- worktree 至今未实现（上游契约明示「worktree 至今未实现」）。

用户视角的问题：当一个工作流里有多个编码角色并行干活时，他们没有各自独立的工作空间，也无法保证「谁先合并、谁后合并、撞文件了怎么办」，核心也不在他们之间做隔离与仲裁。

### 1.2 目标与成功衡量

做完之后，用户可观测的变化：

1. 声明 `artifact_type: code` 的角色，运行时各自拥有**独立 git worktree 与独立分支**，并行改动互不影响（可观测：每个代码角色在实例视图里显示自己的分支名与合并状态）。
2. 多个代码角色完成时，核心**按确定顺序逐个合并**进集成线，且合并过程对用户可见、可追溯。
3. 两个代码角色改同一文件产生冲突时，核心**检测到冲突并升级给人**，绝不静默覆盖任何一方改动（可观测：升级队列里出现一条合并冲突升级）。
4. 非代码类型（`document`/`dataset`/`report`）按各自隔离区落盘，且既有 `doc-single` 文档闭环行为逐字不变（回归基线不破）。

### 1.3 范围

**范围内（本次让用户获得的新能力）**：

- 四类 `artifact_type` 的产物隔离落地：`code`→git worktree、`document`→版本化文件区、`dataset`→快照区、`report`→只追加区。
- 代码类角色：独立 worktree、独立分支；核心管理合并顺序（顺序合并、可观测）。
- 合并冲突检测与升级（复用 I1.2/I1.4 的升级机制）。
- 规划验收句的可复现判定：两开发角色并行改同模块不同文件→顺序合并无覆盖；改同一文件→冲突被检测并升级。

**范围外（明确留给后续迭代，本次不覆盖）**：

- 崩溃恢复 / ACP 恢复方言（I1.8）。
- 版本锁（能力域 2「版本锁定」项，留 I1.12 或更后）。
- 产物汇总顺序里「文档版本合并 / 数据人工裁决」的细节（能力域 2「产物合并/汇总顺序」整体留给后续；本次只做单类型的隔离与代码合并仲裁，不做跨类型汇总裁决）。
- 真实 git 远程推送（本次只在本地仓库内做 worktree/分支/合并，不 push）。
- 跨实例 worktree 共享、worktree 生命周期清理策略（实例终止时的保留/清理留后续）。
- 冲突的**自动解决**：本次只「检测 + 升级」，不自动解冲突、不自动选边。

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|
| §2.2 产物类型隔离 | 定义角色/工作流的用户、运行实例的核心 | 不同产物按类型落到正确隔离区，不串、不覆盖 | `code`/`document`/`dataset`/`report` 四类全部落地对应隔离区 |
| §2.3 代码类角色 worktree 与合并顺序 | 用编码角色的实例 | 多个开发角色并行不互相踩；谁先合并由核心说了算 | 独立 worktree+分支、核心顺序合并、进度可见 |
| §2.4 功能之间的衔接 | 所有使用本迭代能力的用户 | 把隔离 / worktree / 冲突升级 / 可见状态串成一条完整用户流程 | 覆盖规划验收句两条逐字路径 + 失败路径 |
| §2.5 合并冲突检测与升级 | 同上 + 处理升级的人工 | 撞文件时不静默覆盖，交给人裁决 | 检测到冲突→生成升级请求→人用既有入口处理 |
| §2.6 用户可见的业务规则 | 所有用户 | 清楚知道隔离与合并的边界 | BR-01~BR-11 |

### 2.2 产物类型隔离：用户能做什么，看到什么

- **使用角色**：定义角色/工作流的用户；运行实例时由核心执行隔离。
- **使用场景**：用户声明一个角色的产物类型（`artifact_type`），或从内置编码角色启动工作流。
- **用户操作**：在角色/工作流里为节点指定 `artifact_type`（取值 `code` / `document` / `dataset` / `report`）；正常启动实例即可，隔离对用户透明。
- **预期效果**：
  - `code`：该角色的产出文件只落在该角色**自己的 git worktree** 内（独立分支），不进别人的工作树，也不进共享区。I1.7 用 git worktree 实现 code 隔离，物理落点为 `<workspace>/worktrees/<roleId>`（每个 code 角色一个 worktree 目录），这是基线 §5.2 示意中 `artifacts/code/` 的**具体实现形态**（后者为示意，本迭代以 worktree 目录为准，不再另建平铺 `artifacts/code/`）；`dataset` 快照区仍沿用基线 `artifacts/data/` 命名（与 §5.2 `data` 对齐），不要混淆。
  - `document`：产物进入**版本化文件区**，每轮生成新版本文件（如 `v1`/`v2` 并存），不回写上一版。
  - `dataset`：产物进入**快照区**，每轮产出独立快照。
  - `report`：产物进入**只追加区**，新内容追加而非覆盖原有内容。
- **异常情况**：若某类型不被本迭代支持（如未知取值），回退到既有非 git 隔离方式，实例照常运行（见 BR-10）。
- **边界说明**：非 `code` 类型**不做 git 隔离**（与基线 §1.5、§6 边界声明第 4 条「不对非编码任务强制 git 隔离」一致）。

### 2.3 代码类角色：独立 worktree、独立分支，核心管理合并顺序

- **使用角色**：使用编码角色（如 `developer`）的实例；关心「谁先合并」的用户。
- **使用场景**：一个工作流里有多个编码角色，或同一角色多轮开发。
- **用户操作**：用户正常启动含编码角色的实例；核心自动为每个 `code` 角色建 worktree 与分支。
- **预期效果**：
  - 每个编码角色拥有**独立 worktree 与独立分支**，彼此工作树不共享，并行改动互不串扰。
  - 多个编码角色先后完成时，核心**按确定顺序（节点顺序/完成到达顺序）逐个合并**进集成线，**不并发合并**。
  - 合并进度对用户可见：每个编码角色显示「合并中 / 已合并 / 冲突待升级」之类状态。
- **异常情况**：
  - worktree 或分支无法创建（如分支名冲突、权限不足）→ 该节点**升级**而非静默失败（见 §2.5、BR-11）。
  - 合并过程异常（工作树脏、合并被中断等）→ 同样**升级**，改动不静默丢失（BR-11）。
- **边界说明**：合并只在本地仓库内进行，不推送远程；核心只托管「顺序」，不替用户解冲突。

### 2.4 功能之间的衔接

当用户启动一个含多个 `code` 角色的工作流时，把 §2.2～§2.5 串成一条用户走完一遍的完整流程（不写接口/字段/状态机，仅用户视角）：

1. **产物先按类型分流（§2.2）**：每个 `code` 角色的产物被隔离进它自己的 git worktree（而非共享区或别人的工作树）；`document`/`dataset`/`report` 各自进入版本化文件区、快照区、只追加区，互不串扰。
2. **每个代码角色独立建 worktree + 分支，核心托管顺序合并（§2.3）**：核心为每个 `code` 角色自动建出独立 worktree 与独立分支；多个角色先后完成时，核心按确定顺序逐个合并进集成线，不并发合并，合并进度对用户可见。
3. **规划验收句路径一（AC-07，逐字）**：两个开发角色并行修改同一模块下的**不同文件**（如 `a.py` 与 `b.py`），各自 worktree 隔离后，核心顺序将其分支合并进集成线——两份改动均被保留、任何一方不被覆盖，相关节点进入完成态。
4. **规划验收句路径二（AC-08，逐字）**：若两个开发角色改的是**同一文件**的同一区段，核心在顺序合并第二份时撞车，冲突被检测出来，核心生成升级请求（原因标注合并冲突），绝不静默覆盖任何一方改动、不自动解冲突；用户可见升级队列出现一条合并冲突升级。
5. **用户在实例视图全程看见状态（AC-12）**：上述每一步，用户都能在实例视图看到每个 code 角色的分支名、合并状态（进行中 / 已合并 / 冲突待升级）以及存在的合并冲突升级条目，无需翻日志。
6. **失败路径同样落在这条流程里（AC-13 / AC-14）**：若某 code 角色的 worktree/分支无法创建（如分支名冲突、权限不足），或合并过程异常（工作树脏、被中断），核心同样升级而非静默失败/丢失改动，用户可见对应升级条目、两方 worktree 与分支仍完整保留待裁决——这与第 4 步的冲突升级共用同一「检测→升级」用户感知（§2.5，AC-09 复用既有入口裁决后可继续合并）。

简言之：**隔离（§2.2）→ 各建 worktree/分支并顺序合并（§2.3）→ 撞文件则检测冲突并升级（§2.5）→ 全程状态可见（AC-12）→ 创建失败/合并异常也升级（AC-13/14）**，构成用户视角的完整闭环，两条规划验收路径与失败路径均在此闭环内可复现。

### 2.5 合并冲突检测与升级

- **使用角色**：编码实例 + 处理升级的人工。
- **使用场景**：两个编码角色改了同一文件的同一区段，核心顺序合并第二份时撞车。
- **用户操作**：用户无需主动操作；核心在合并时自动检测冲突。冲突发生后，用户通过**既有的升级处理入口**（`orch escalate list` / `orch escalate resolve`，I1.4 已实现）查看与裁决。
- **预期效果**：
  - 冲突被检测后，核心**生成升级请求**（原因标注为合并冲突），节点保持「等待人工」状态，两方 worktree 与分支都完整保留，便于人裁决。
  - 绝不静默覆盖任何一方改动，也**不自动解冲突**。
- **异常情况**：升级后若用户完成裁决/手动合并并重投，核心重新合并使集成线包含该文件改动、节点继续（复用 I1.4 升级机制，不新造 UI）。
- **边界说明**：升级入口、取消路径（`escalated→cancelled`，I1.2 已实现）全部复用既有机制，本迭代不新增升级界面。

### 2.6 用户可见的业务规则

- **BR-01**：声明 `artifact_type: code` 的角色，运行时各自拥有独立 git worktree 与独立分支，彼此工作树不共享。
- **BR-02**：`artifact_type: document` 的产物进入版本化文件区，按轮次生成新版本文件，不回写上一版。
- **BR-03**：`artifact_type: dataset` 的产物进入快照区，每轮产出独立快照。
- **BR-04**：`artifact_type: report` 的产物进入只追加区，新内容追加而非覆盖。
- **BR-05**：多个代码角色完成时，核心按确定顺序逐个将其分支合并进集成线，不并发合并。
- **BR-06**：两个代码角色改同模块不同文件，顺序合并后两份改动均保留，互不覆盖。
- **BR-07**：两个代码角色改同一文件，合并时检测到冲突，核心生成升级请求，不静默覆盖、不自动解冲突。
- **BR-08**：非 `code` 类型的角色不做 git 隔离，沿用既有隔离方式（与 §1.5 / §6 边界声明第 4 条一致）。
- **BR-09**：代码角色的 worktree/分支、合并进度、冲突升级对用户可见（实例状态 / 升级队列）。
- **BR-10**：既有 `doc-single` 文档闭环行为不变；未声明 `artifact_type` 或取值不被本迭代支持时，回退到既有非 git 隔离。
- **BR-11**：当 code 角色的 worktree/分支创建或合并无法安全完成时，核心生成升级请求而非静默丢失改动，确保用户可知可控。

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

**AC-01 · 隔离映射：code → 独立 worktree 与分支被创建**
- 场景类型：功能
- 风险：中（git 初始化/路径计算是核心新行为）
- 引用：BR-01, BR-09
- **Given** 用户在 `/tmp` 下新建一个独立项目根（已 `git init`），注入 `NODE_ENV=test`，定义一个声明 `artifact_type: code` 的角色并启动一个只含该角色的实例。
- **When** 实例启动并派发该角色、角色开始执行。
- **Then** 用户看到该角色拥有独立 worktree 与分支（在实例状态/CLI 中可见分支名与该角色专属工作区），且该角色的产出文件只落在该角色自己的 worktree 内，未进入共享区或其它角色空间。
- 机检：`node --test "test/**/*.test.js"` 中对应用例断言 worktree 目录存在、分支存在、产出文件位于该 worktree 内。
- 夹具：`/tmp/maestro-i17-code` 项目根，`git init`，`NODE_ENV=test`；用内置 `developer` 角色（本迭代补 `artifact_type: code`，见附录 D）或等价自定义角色启动实例，断言路径隔离。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-02 · 隔离映射：document → 版本化文件区（回归，逐字不变）**
- 场景类型：功能 / 回归
- 风险：低（I1.3 已具备）
- 引用：BR-02, BR-10
- **Given** 用户用 `--template task-loop`（或等价 `doc-single` 工作流）在 `/tmp` 项目根启动实例，`NODE_ENV=test`。
- **When** 撰写者角色交出新一版文档。
- **Then** 产物进入版本化文件区，每轮生成新版本文件（`v1`/`v2` 并存），用户可见两版均在、且上一版未被回写。
- 机检：`node --test "test/**/*.test.js"` 中 `task-loop` 版本化文档断言与 I1.6 基线逐字一致。
- 夹具：`/tmp/maestro-i17-doc`，`NODE_ENV=test`，跑 `task-loop`；断言 `artifacts/docs/<名>.v1.md` 与 `.v2.md` 并存且内容独立。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-03 · 隔离映射：dataset → 快照区**
- 场景类型：功能
- 风险：中（新增快照区路径）
- 引用：BR-03
- **Given** 用户在 `/tmp` 项目根定义一个声明 `artifact_type: dataset` 的角色并启动实例，`NODE_ENV=test`。
- **When** 该角色每轮产出数据集。
- **Then** 产物进入快照区，每轮产出独立快照，用户可见多轮快照并列、互不覆盖。
- 机检：`node --test "test/**/*.test.js"` 断言 `artifacts/data/` 下存在按轮次独立命名的快照文件，且不同轮次互不影响。
- 夹具：`/tmp/maestro-i17-data`，`NODE_ENV=test`，驱动 dataset 角色两轮的产出，断言快照区两快照独立。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-04 · 隔离映射：report → 只追加区（回归，逐字不变）**
- 场景类型：功能 / 回归
- 风险：低
- 引用：BR-04, BR-10
- **Given** 用户在 `/tmp` 项目根启动含报告角色的实例（如 `task-loop` 的研究员产出 `artifacts/reports/research-notes.v1.md`），`NODE_ENV=test`。
- **When** 报告角色写出内容。
- **Then** 产物进入只追加区，新内容追加而非覆盖原有内容，用户可见报告区文件持续累积。
- 机检：`node --test "test/**/*.test.js"` 中 `task-loop` 研究笔记断言与 I1.6 基线逐字一致。
- 夹具：`/tmp/maestro-i17-report`，`NODE_ENV=test`，跑 `task-loop` 断言 `artifacts/reports/` 内容追加语义不变。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-05 · 代码类角色：两个 code 角色并行，worktree/分支独立不串扰**
- 场景类型：功能
- 风险：中
- 引用：BR-01
- **Given** 用户在 `/tmp` 项目根启动一个含两个 `code` 角色（A、B）的工作流，`NODE_ENV=test`，底层为本地 git 仓库。
- **When** 两个角色被并行派发并同时处于执行中。
- **Then** 用户看到 A、B 各自拥有独立 worktree 与分支，A 的改动不影响 B 的工作树，B 的改动也不影响 A，两角色状态均为执行中且无相互串扰。
- 机检：`node --test "test/**/*.test.js"` 断言两 worktree 目录与两分支均独立存在、互不包含对方未合并的改动。
- 夹具：`/tmp/maestro-i17-parallel`，`NODE_ENV=test`，构造两 code 角色图；断言并行期间双方工作树隔离。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-06 · 合并顺序由核心托管：顺序合并、进度可见**
- 场景类型：功能
- 风险：中
- 引用：BR-05, BR-09
- **Given** 同 AC-05 的两个 code 角色先后完成（均进入待合并）。
- **When** 核心执行合并。
- **Then** 用户看到合并按确定顺序逐个进行（如按节点顺序），合并进度可见（如「合并中 / 已合并」），最终集成线包含两者改动。
- 机检：`node --test "test/**/*.test.js"` 断言合并队列为顺序执行（前一次完成/升级后才进行下一次）、集成线两分支改动均在。
- 夹具：`/tmp/maestro-i17-merge-order`，`NODE_ENV=test`，断言合并顺序确定、无并发 merge、进度状态可观测。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-07 · 验收句 1：不同文件并行改 → 顺序合并无覆盖**
- 场景类型：规划验收（核心）
- 风险：高（规划逐字验收句）
- 引用：BR-06
- **Given** 两个 `code` 角色并行修改同一模块下的**不同文件**（如 `a.py` 与 `b.py`），各自 worktree 隔离，底层为本地 git 仓库，项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 核心在 worktree 隔离后顺序将其分支合并进集成线。
- **Then** 两份改动均被保留，任何一方不被覆盖；用户可见集成线中 `a.py` 与 `b.py` 均含预期改动，相关节点均进入完成态。
- 机检：`node --test "test/**/*.test.js"` 断言合并后 `a.py`、`b.py` 两文件改动均存在、无相互覆盖、无丢失。
- 夹具：`/tmp/maestro-i17-diff-files`，`NODE_ENV=test`，两角色分别改不同文件后顺序合并，断言两文件改动完整保留。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-08 · 验收句 2：同文件并行改 → 冲突被检测并升级**
- 场景类型：规划验收（核心）
- 风险：高（规划逐字验收句）
- 引用：BR-07, BR-09
- **Given** 两个 `code` 角色并行修改同一文件的同一区段，各自 worktree 隔离，底层为本地 git 仓库，项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 核心顺序合并第二份改动时触发合并冲突。
- **Then** 冲突被检测到，核心生成升级请求（原因标注合并冲突），绝不静默覆盖任何一方改动、不自动解冲突；用户可见升级队列出现一条合并冲突升级，相关节点保持等待人工。
- 机检：`node --test "test/**/*.test.js"` 断言 `git merge` 后存在未合并路径（冲突检出）、升级请求已生成、两 worktree/分支仍完整保留。
- 夹具：`/tmp/maestro-i17-same-file`，`NODE_ENV=test`，两角色改同文件同区段后顺序合并，断言冲突升级生成且半成品合并已回滚。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-09 · 同文件冲突后：复用既有升级入口裁决后可继续合并**
- 场景类型：功能 / 复用既有机制
- 风险：中
- 引用：BR-07, BR-09
- **Given** AC-08 已生成合并冲突升级，项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 用户通过既有升级处理入口（`orch escalate list` 看到该升级、`orch escalate resolve` 完成裁决或手动合并后重投）。
- **Then** 核心重新合并，使集成线包含该文件改动，相关节点继续推进；整个过程复用 I1.4 升级机制，无新界面。
- 机检：`node --test "test/**/*.test.js"` 断言升级条目出现在 `orch escalate list` 输出、经 `orch escalate resolve` 后节点状态可继续、集成线含该文件改动。
- 夹具：`/tmp/maestro-i17-resolve`，`NODE_ENV=test`，构造冲突升级后调用既有 `orch escalate` 命令族裁决，断言节点继续。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-10 · 边界：非 code 角色不做 git 隔离**
- 场景类型：边界
- 风险：低
- 引用：BR-08
- **Given** 一个含 `document` 角色与 `code` 角色的实例，项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 实例运行。
- **Then** 用户可见只有 `code` 角色拥有 worktree/分支标识；`document` 角色不进入 git worktree，沿用既有版本化文件区隔离。
- 机检：`node --test "test/**/*.test.js"` 断言仅 code 角色产生 worktree、document 角色不创建 git 隔离。
- 夹具：`/tmp/maestro-i17-boundary`，`NODE_ENV=test`，混合角色实例，断言隔离类型按 artifact_type 正确分流。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-11 · 向后兼容：doc-single 文档闭环行为逐字不变**
- 场景类型：回归
- 风险：中（回归红线）
- 引用：BR-10
- **Given** 用 `--template task-loop` 在 `/tmp` 项目根启动实例，`NODE_ENV=test`。
- **When** 走完 研究 → 撰写 → 审核 全链路。
- **Then** 行为与 I1.6 收口时逐字一致：研究笔记路径、版本化文档、审核文件、节点状态流转、CLI 文案均不变；三主链 `single`/`code-loop`/`task-loop` 输出无变化。
- 机检：`node --test "test/**/*.test.js"` 全量通过，且与 `origin/main`（HEAD `3f35bfa`）的失败集合差集为 0。
- 夹具：`/tmp/maestro-i17-regress`，`NODE_ENV=test`，重跑三主链，断言输出逐字一致。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`；另对 `src/registry` 用同表去 `coordinator`（30 词）`exit 0`。

**AC-12 · 用户可见状态：worktree/分支/合并/冲突在实例视图可见**
- 场景类型：功能 / 可见性
- 风险：低
- 引用：BR-09
- **Given** 一个含 code 角色的实例，项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 用户查看实例状态（CLI `orch instance status` / `orch instance graph --format json` 或面板）。
- **Then** 用户能看到每个 code 角色的分支名、合并状态（进行中 / 已合并 / 冲突待升级），以及存在的合并冲突升级条目。
- 机检：`node --test "test/**/*.test.js"` 断言实例导出/状态输出含 code 角色的分支与合并状态文字。
- 夹具：`/tmp/maestro-i17-visibility`，`NODE_ENV=test`，启动 code 实例后查状态，断言分支/合并状态文字可见。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-13 · 失败路径：worktree/分支创建失败 → 节点升级而非静默失败**
- 场景类型：失败 / 异常
- 风险：中
- 引用：BR-01, BR-11
- **Given** 一个 code 角色派发时底层无法创建 worktree（如分支名冲突或权限不足），项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 实例启动并试图为该角色建 worktree/分支。
- **Then** 该节点进入升级（用户可见升级队列出现一条创建失败升级），实例不崩溃、不静默丢失该角色的工作请求。
- 机检：`node --test "test/**/*.test.js"` 断言创建失败时生成升级请求、节点状态为升级、进程未异常退出。
- 夹具：`/tmp/maestro-i17-create-fail`，`NODE_ENV=test`，通过故障注入使 worktree 创建失败，断言升级生成。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-14 · 失败路径：合并异常（工作树脏/被中断）→ 升级而非静默丢失改动**
- 场景类型：失败 / 异常 / 超限
- 风险：中
- 引用：BR-11
- **Given** 核心合并某 code 角色分支时遇到非冲突性异常（如工作树脏、合并被外部中断），项目根在 `/tmp`，`NODE_ENV=test`。
- **When** 合并过程异常。
- **Then** 核心生成升级请求而非静默丢失该角色改动；用户可见升级条目，两方 worktree/分支仍完整保留待裁决。
- 机检：`node --test "test/**/*.test.js"` 断言合并异常时生成升级、半成品合并回滚、改动不丢失。
- 夹具：`/tmp/maestro-i17-merge-fail`，`NODE_ENV=test`，故障注入合并异常，断言升级生成且改动保留。
- 架构检查：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

### 3.2 非功能验收标准

- **NF-1（可靠性·用户可感知）**：代码工作流里任何一方改动在冲突时**绝不静默覆盖**，用户总能通过升级队列看到「发生了什么、等谁裁决」。
- **NF-2（可观测）**：合并是顺序且可追溯的——用户查看实例状态时能看到合并顺序与当前进度，不必翻日志才能知道「卡在合并哪一步」。
- **NF-3（无回归）**：本迭代不引入新的第三方运行时依赖，`package.json` 的 `dependencies` 保持 `{}`；既有三主链输出逐字不变。

### 3.3 验收前置条件

- **环境**：Node ≥ 22；本机 `git` 在 `PATH` 中（本迭代所有 AC 均可用**本地 git 仓库**在 `/tmp` 构造，无需真实 DSH、无需远程，属 B 类零 DSH 夹具面）。
- **夹具现场**：每个 AC 的独立项目根一律放 `/tmp`（不放仓库内），运行前注入 `NODE_ENV=test`；同进程串行场景 ≤ 10 个。
- **代码角色就绪**：内置 `developer` 角色在本迭代补 `artifact_type: code`（实现侧，见附录 D）；验收用到的两 code 角色工作流由夹具构造，不依赖真实宿主。
- **既有命令可用**：`orch escalate list` / `orch escalate resolve`（I1.4 已实现）用于 AC-09 的升级裁决验证。
- **回归基线**：全量测试当前基线数字（以 `origin/main` HEAD `3f35bfa` 为准）已全绿，作为 AC-11/AC-14 回归门禁的参照。

---

## 附录 A · 输出基线（用户可见文案）

> 所有用户可见文案一律取自 `src/cli/labels.js`（中文唯一来源）。下列每条带文案 AC 的文案来源键如下；键名若当前不存在，由本迭代实现补充到 `labels.js`（属授权修改，见附录 D-7）。

| AC | 用户可见文案场景 | labels.js 键（待实现/复用） | 说明 |
|---|---|---|---|
| AC-01/AC-05/AC-12 | code 角色分支与 worktree 状态（分支名、合并中/已合并/冲突待升级） | `CODE_ROLE_BRANCH` / `MERGE_PENDING` / `MERGE_MERGING` / `MERGE_MERGED` / `MERGE_CONFLICT` | 状态文字，复用既有状态展示通道 |
| AC-08/AC-09/AC-14 | 合并冲突升级条目原因 | `ESCALATION_REASON_MERGE_CONFLICT` | 升级原因文案，复用 I1.4 升级渲染 |
| AC-13 | worktree/分支创建失败升级 | `ESCALATION_REASON_WORKTREE_INIT_FAILED` | 复用 I1.4 升级渲染 |
| AC-11/AC-02/AC-04 | doc-single 文档闭环既有文案 | 沿用 I1.3/I1.6 现有键，不新增 | 逐字不变 |
| AC-03/AC-10 | dataset/report 隔离落盘（无新用户提示时为空） | 无新增文案 | 仅路径隔离，无新提示 |

## 附录 B · 术语与未决问题

- **术语**：
  - `artifact_type`：角色契约声明的产物类型字段（`code`/`document`/`dataset`/`report`），决定隔离方式（基线 §1.5、§4.1）。
  - worktree：git 的「工作树」机制，允许同一仓库在多个目录各自检出不同分支（本次用于代码角色隔离）。
  - 集成线：核心把各 code 角色分支顺序合并进去的目标分支（本迭代为本地分支，不推送远程）。
- **未决问题**：
  - U-1（不阻塞）：实例终止时 worktree/分支的清理策略（保留或删除）本迭代未定，留后续；不影响开工，因本迭代只实现创建与合并。
  - U-2（不阻塞）：`dataset` 快照区的「快照」具体命名/指纹方式（如按轮次还是内容哈希）由实现侧在附录 D 约束内决定，不影响需求验收。
  - U-3（不阻塞）：多 code 角色合并顺序的「确定顺序」细则（节点 order 优先还是完成到达顺序优先）由实现侧定，须保证可观测、可复现；不影响开工。

## 附录 C · 变更记录

- v1（2026-11-09）：首次产出，依据 `docs/index.md` 第一部分 §1.5/§4.1/§5.2/§6 与第二部分 `#### I1.7`（约 803–809 行）+ 上游 I1.6 契约（HEAD `3f35bfa`）撰写；8 节齐全，BR-01~11、AC-01~14 连续编号；附录 A~D 按本项目 A~D 口径。状态：评审中。
- v2（2026-11-09）：修复 review-round1 的 F-01（§2.4 改为功能之间的衔接，原功能点顺移为 §2.5、BR 顺移为 §2.6，全文交叉引用同步）/ F-02（worktree 路径与基线 §5.2 `artifacts/code/` 示意的对齐声明）；结构合规，规划语义覆盖不变。

## 附录 D · 实现约束（技术要点，仅供编码参考，不进入需求判定）

> 本附录是需求对实现的约束摘要，写代码的 Agent 据此落地；评审对需求的判定不依赖本附录。

**D-1 路径与 git 布局（新增/修改 `src/persistence/paths.js`）**
- I1.7 用 git worktree 实现 code 隔离，物理落点为 `<workspace>/worktrees/<roleId>`（每个 code 角色一个 worktree 目录），这是基线 §5.2 示意中 `artifacts/code/` 的**具体实现形态**（后者为示意，本迭代以 worktree 目录为准，不再另建平铺 `artifacts/code/`）；`dataset` 快照区仍沿用基线 `artifacts/data/` 命名（与 §5.2 `data` 对齐），不要混淆。
- 新增 `instanceCodeWorktreeDir(root, id, roleId)` → `<workspace>/worktrees/<roleId>`；可选 `instanceDataDir(root, id)` → `<workspace>/artifacts/data`（dataset 快照区）。
- worktree 的父 git 仓库初始化于 `<workspace>`（若非 git 仓库则 `git init`）；每个 code 角色 `git worktree add <worktreeDir> -b maestro/<instanceId>/<roleId>`。
- 授权断言修改清单：`paths.js` 既有函数（`instanceDocsDir` 等）**不改动**；新增函数不得引入 31 禁词。若新增图/角色字面量落在 `src/templates/**`（不被纯净扫描），不影响 D-9；若误落在 `src/core,src/daemon` 则须并入禁词表。

**D-2 git 操作范围（建议新增 `src/core/code-isolation.js`，由 orchestrator 调用）**
- 仅本地操作：`init`（按需）、`worktree add`、`branch` 创建、`merge`（fast-forward 或 `--no-ff` 合并进集成分支 `maestro/<instanceId>/integration`）。
- **不** push 到远程（真实远程推送留范围外）；**不** rebase/squash，保持合并语义可追溯。

**D-3 artifact_type → 隔离策略映射**
- 读取角色契约的 `artifact_type`（I1.6 已作为契约字段存在）：`code`→worktree 隔离；`document`→版本化文件区（复用 `doc-artifact` 的 `versioned-doc`）；`dataset`→快照区；`report`→只追加区（`artifacts/reports` 已存在）。
- 与 `productPolicy` 关系：`productPolicy: 'doc-single'` 行为不变（I1.6 预建 docs/reports）；`artifact_type` 为节点/角色级覆盖——`code` 优先走 worktree，不受 `productPolicy` 限制。
- 内置 `developer` 角色补 `artifact_type: 'code'`（`src/templates/index.js` 的 `ROLES.developer`）；`tester` 不改（非 code）。如需支撑验收新增内置两 code 角色图，图名不得含 31 禁词。

**D-4 合并顺序由核心管理**
- code 节点 done 且需合并时，合并请求入「合并队列」；核心按确定顺序（节点 order / 完成到达顺序，见 U-3）逐个执行 `git merge`，前一次完成（或升级）后才进行下一次，**禁止并发 merge**。
- 合并进度状态（pending/merging/merged/conflict）作为用户可见状态写入实例状态与升级/状态展示，复用既有状态机，不新增节点态。

**D-5 冲突检测**
- merge 后执行 `git diff --name-only --diff-filter=U` 或检查 `git merge` 退出码；若 unmerged paths 非空 → 冲突。核心 `git merge --abort` 回滚本次半成品合并，保留两角色 worktree 与其分支完整，便于用户裁决。

**D-6 升级入口复用 I1.2/I1.4**
- 冲突 / 创建失败 / 合并异常 → 调用既有 escalation 生成（`orch escalate`），reason 为 `merge_conflict` / `worktree_init_failed` / `merge_aborted`；用户用既有 `orch escalate list` / `orch escalate resolve` 处理（I1.4 已实现）。
- 节点进入既有 `escalated` 态，保持 `escalated→cancelled` 取消路径（I1.2）。本迭代不新造升级 UI。

**D-7 回归与授权断言修改清单**
- 三主链 `single`/`code-loop`/`task-loop` 输出逐字不变（回归红线，见 `docs/index.md` 第二部分回归红线与 `regression-2026-11-09.md`）。给内置 `developer` 补 `artifact_type: code` 后，`code-loop` 的用户可见编排输出（节点态、handoff、CLI 文案）必须保持不变——worktree 隔离对既有编排断言透明。
- **新行为打破既有精确断言时，一律扩清单/补测试，不许弱化断言或放宽 `Then`**：若 `resolveNodeProducts` 因 code 分支改路径而在 `test/wp4/orchestrator.test.js` 的 code-loop 场景触发既有精确断言失败，应扩展该断言覆盖 worktree 路径，而非改回 cwd 语义。
- 纯净扫描（D-9）：若实现仅在 `src/templates/**` 增角色字面量，不触碰 `src/core,src/daemon` 禁词 → 词表维持 31 词；若因新内置图/角色引入新字面量且落在扫描目录，须并入禁词表（当前 31 词，见回归 gates.log）并同步 `docs/templates/execution-template.md` §0.3。本迭代预计无需新增禁词（`developer`/`tester`/`code-loop` 已在表）。
- 授权修改清单（点名文件 + 只改哪段）：
  - `src/templates/index.js`：`ROLES.developer` 增加 `artifact_type: 'code'`（仅该角色对象，不动 `tester`/`coordinator`）。
  - `src/persistence/paths.js`：新增 `instanceCodeWorktreeDir` / `instanceDataDir`（仅追加导出，不改既有函数体）。
  - `src/core/workspace.js`：`prepareWorkspace()` 在识别到 code 角色时确保 workspace 为 git 仓库（仅补一段 `if` 分支，不改动 doc-single 既有逻辑）。
  - `src/core/doc-artifact.js`：`resolveNodeProducts()` 仅**新增** `code` 策略分支（worktree 路径），不改 `declared`/`versioned-doc` 等既有分支语义。
  - `src/cli/labels.js`：仅追加本迭代新增文案键（附录 A 所列），不改既有键。
  - 新增 `src/core/code-isolation.js`（合并队列、冲突检测）；不得出现 31 禁词、不得出现 `if host ==` 分支。
