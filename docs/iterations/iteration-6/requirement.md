# I1.6 — 自定义角色 + 工作流完整原语 + 校验器 + CLI 资产命令集

> **迭代**：阶段一 · I1.6
> **依据**：`docs/index.md` 第一部分「需求基线」（§3 四层状态模型 129~301 行、§4 能力域 1「角色与技能资产」307~326 行、能力域 2「通用任务工作流编排」329~344 行、能力域 4「会话间唤醒与交接」365~412 行、§5 运行时模型与数据布局 575~614 行、§6 边界声明 618~629 行）+ 第二部分 `#### I1.6` 条目（741~753 行）、阶段一退出条件（865~867 行）、迭代依赖关系（957~973 行）、每个迭代的固定产出（977~984 行）——**行号一律以基线 `0cd113b` 的 `docs/index.md` 为准**；若工作区在该文档阶段一标题之后插入了进度台账之类的段落，`I1.6` 及其后条目会整体下移相同行数，按标题名检索即可
> **模板**：`docs/templates/requirement-template.md`
> **版本**：v7 ｜ **状态**：**定稿**（S0 第 3 轮独立评审 PASS，2026-11-09；`review-round3.md`）
> **上游**：I1.5 已收口（`docs/iterations/iteration-5/report.md`，611/611 全绿，45/45 AC）；本迭代 HEAD 基线 `0cd113b`
> **契约变更** `M-1 ~ M-7`、补充契约 `C-01 ~ C-14`；业务规则 **BR-01 ~ BR-41**；AC **65 条**；附录 A 输出基线、附录 B 术语与未决问题、附录 C 变更记录、附录 D 实现约束
> **裁决登记**：规划歧义的 7 条裁决（裁-1 ~ 裁-7）与「18 → 17 条命令」口误更正，登记在同目录 `decisions.md`（触发点 / 依据 / 决定 / 影响面）。本文件凡出现「裁-N」处，均指该文件中的同名条目。
>
> **本迭代的一句话**：把「角色」从只能读的资产变成**能建、能改、能从内置派生、能导出导入**的资产，并把「工作流」从三张硬编码在代码里的内建图，变成**可写、可校验、可 dry-run 的声明式定义**——建坏了在你按下回车的那一刻就告诉你哪一行不对，而不是跑到一半才崩。

---

## 一、背景与问题

### 1.1 现状与问题

I1.5 之后，角色与技能已经能加载、能校验、能查看，但它们仍然是**只读资产**：想加一个「首席开发」，只能去翻 `assets/roles/developer.yaml` 抄一份、手工改、再祈祷字段没错。

- **想建一个自己的角色，只能靠抄文件**。`roles/` 与 `skills/` 里的 26 份资产都躺在只读位置，项目里要新增角色只能手写 YAML。写错一个字段名（`max_concurrent` / `max_concurrent_sessions`）、写错一个技能名，要等到下次 `orch role validate` 才发现，或者干脆等到 `orch run` 报「注册表不合法」。
- **「从内置派生」这件事现在等于复制粘贴**。派生出来的文件与来源之间没有任何记录：以后来源改了字段，谁也不知道哪些角色是从它派生的；两个文件互相派生也查不出来。
- **角色校验只回答了两件事**（字段齐全、技能存在）。「这个角色声明了输入，可流程里根本没人给它输入」「它说自己是只读角色，工具却带着写文件」「它把唤醒白名单指向一个不存在的角色」——这三类问题今天全部静默通过。
- **技能同样只能看不能建**：`skills/<id>/SKILL.md` 没有创建命令，导出给别人、从别人那里装进来也没有入口。
- **工作流根本不是一个「东西」**。`src/templates/index.js` 里的三张图是硬编码对象：`single` / `code-loop` / `task-loop`。**我无法写一条自己的工作流**，更没有一处能告诉我「这条工作流能不能跑」。规划要求的并行 fan-out/fan-in、条件分支、子工作流、超时、重试、字段映射，在这三张图里**一个都没有**；`node_type`（角色 / 人工 / 升级 / 子工作流）在节点模型里也不存在。
- **「先看看编排对不对」这件事没有入口**。今天唯一能验证编排的办法是 `orch run` 真跑一遍——起核心、建会话、花掉一次真实执行，才知道第三条边指向了一个不存在的节点。
- **子工作流无从表达**。规划要求「子工作流在流程图中显示为折叠组节点」，而折叠组节点的前提是工作流文件里能声明「这个节点其实是一条工作流」。

**不解决会怎样**：I1.7 的产物隔离要按角色契约分配空间（契约现在只有字段、没有连通性）、I1.10a 的角色流程图要渲染「含人工节点和子工作流的拓扑」（今天没有这类节点）、I1.11 的资产库要浏览和编辑角色/技能/工作流（今天没有写入口）、I1.12 的角色包/工作流包导出要基于本迭代的导出格式。这一轮不做，后面每一条都要先补「资产怎么写、怎么才算对」。

### 1.2 目标与成功衡量

| # | 指标 | 目标值 | 怎么量 |
|---|---|---|---|
| 1 | 从零/派生/导入三条路径建出的角色，能直接通过校验的比例 | 3 / 3 | 三条路径各建一个角色，`orch role validate` 全部通过 |
| 2 | 建坏的资产在「按下回车时」就被拒绝的比例 | 100%（不留半成品文件） | 6 类坏输入（缺字段、技能悬空、工具越权、派生链成环、输入无来源、白名单悬空）各建一次，目标文件均不存在 |
| 3 | 角色校验器的检查项 | 5 项（schema 完整性 / 技能引用 / 契约连通 / 权限闭环 / 派生链无循环） | 5 个坏样本各触发一个专属原因码，一次 `role validate` 全数报出 |
| 4 | 工作流可表达的原语 | 11 项（顺序、并行 fan-out/fan-in、条件分支、回流循环、轮次上限、超时、重试、人工节点、子工作流、升级、终止；**字段映射**按基线能力域 2 单列，不并入这 11 项） | 一条含全部原语的工作流通过校验并在 `dry-run` 中逐项可见（裁-5） |
| 5 | 工作流校验器的检查项 | 6 项（可达性 / 回流轮次上限 / 并行 scope 不重叠 / 变量引用 / 状态转换 / 唤醒权限） | 6 个坏样本各触发一个专属原因码 |
| 6 | 需要真跑一次才能知道编排有错的情形 | 0 次 | `orch workflow dry-run` 在不起核心、不建会话的前提下给出结论 |
| 7 | 新增资产命令数 | 17 条（角色 5 + 技能 6 + 工作流 6） | `orch role|skill|workflow` 的用法块逐行可数 |
| 8 | I1.5 既有输出变化 | **除 D-7b 授权的两处 `可唤醒` 行外 0 处** | 判定口径：`role show researcher` / `role show writer` 的「可唤醒」行按 D-7b 对齐后的值逐字固定（分别为 `  可唤醒：writer` / `  可唤醒：editor, reviewer`，由 AC-48 钉住，是唯一例外）；`role list --format json`（`toRoleJson()` 不含 `wakeAllow` 字段）、`role show developer`、`role validate`、三条主链一律逐字节不变，其余 I1.5 既有输出一字不变 |
| 9 | 新增运行时依赖 | 0 个 | `package.json` 的 `dependencies` 键数量为 0 |
| 10 | 三条内置工作流通过六项校验的比例 | 3 / 3（`invalid = 0`） | `orch workflow validate --format json` 的 `counts.invalid === 0`、`counts.assets === 3`（裁-2 的回归红线） |

### 1.3 范围

**范围内**

1. **自定义角色三条路径**
   - 从零：`orch role create <角色>` 一条命令生成合法的项目角色文件。
   - 从内置派生：`--from <角色>` 生成派生文件，并在文件里记下派生来源；未显式给的字段继承来源，显式给的覆盖。
   - 导入包安装：`orch role import <文件>` 安装一份 `orch role export` 产出的角色文件。
2. **角色写命令**：`create` / `edit` / `export` / `import` / `diff`。全部只写项目根 `.orch/roles/**`，绝不改内置资产；写入前先校验，不合法不落盘。
3. **角色校验器五项**：在既有 `orch role validate` 这一条命令里补齐「契约连通」「权限闭环」「派生链无循环」三项，并与既有「schema 完整性」「技能引用」共用同一份输出与计数口径（不新增命令、不改版式）。
4. **技能命令六条**：`list` / `show` / `create` / `validate` / `export` / `import`；技能资产的格式仍是 `skills/<id>/SKILL.md`。
5. **工作流资产**：项目工作流 `.orch/workflows/<id>.yaml`（`workflow/v1`）；三张内建图以只读的「内置工作流」形式可列出、可查看、可作为 `diff` 与 `create` 的基线（**不新增内建图、不改内建图的任何一个字段**）。
6. **节点模型补 `node_type`**：资产字段名就叫 `node_type`（JSON 输出为 `nodeType`，与既有驼峰口径一致），四类取值 `role` / `human` / `escalate` / `subworkflow`，每类各有自己的必填字段与合法出入边（裁-1、F-04）。
7. **工作流完整原语 11 项**：顺序、并行 fan-out/fan-in（算 1 项）、条件分支、回流循环、轮次上限、超时、重试、人工节点、子工作流、升级、终止（裁-5）；**字段映射**是基线能力域 2 里单列的一项映射能力，不并入这 11 项。
8. **工作流校验器六项**：可达性、回流边轮次上限、并行 scope 不重叠、变量引用有效、节点状态转换合法性（按静态图约束，运行时九态迁移不在本迭代）、角色对唤醒权限（**所有**被校验的工作流，含三条内置图）。
9. **工作流命令六条**：`list` / `show` / `create` / `validate` / `diff` / `dry-run`。`dry-run` 是纯静态推演：不起核心、不建会话、不写任何文件。
10. **兼容与纯净**：I1.5 的 `role list / show / validate` 文本与 `--format json` 契约逐字不变（**除 D-7b 授权、AC-48 逐字固定的 `role show researcher` / `role show writer` 两处『可唤醒』行外**；`--format json` 因 `toRoleJson()` 不含 `wakeAllow` 而不受该例外影响）；三条主链输出逐字不变；零运行时依赖；新增中文仍然只来自 `labels.js`。

**范围外**

| 不做的事 | 留给谁 | 备注 |
|---|---|---|
| 用项目工作流发起实例（`orch run --workflow`） | 未分配（登记为未决 B-01，建议 I1.7 或 I1.8 承接） | 本迭代工作流是**定义与校验**资产：可列出、可查看、可校验、可 dry-run、可 diff，但 `orch run` 仍只认三个内建模板名，`未知模板：<名字>` 文案不变 |
| 把角色技能正文、角色契约拼进派发提示词 | 仍不做 | I1.5 R-6 的理由继续成立；提示词有逐字断言 |
| 派发时按 `max_concurrent_sessions` 拦截第 N+1 个会话 | I1.7 | 需要并行原语落地 + 隔离空间 |
| `artifact_type` 驱动的目录隔离（worktree / 版本化文件区 / 快照 / 只追加区） | I1.7 | 本迭代只把 `artifact_type` 当契约字段读 |
| 角色包/工作流包的**依赖闭包、签名校验、版本兼容检查、来源追溯** | I1.12 | 本迭代的「包」= **单个可导出/导入的资产文件**（角色或技能，含 schema 与全部元数据，YAML/Markdown 原样）；`import` 只装这一个文件，缺技能直接拒绝导入（裁-3） |
| 崩溃恢复、ACP 恢复方言、会话复用策略 | I1.8 | 本迭代不碰适配层 |
| 角色流程图/工作流画布渲染、折叠组节点下钻 | I1.10a / I1.10b / I1.11 | 本迭代只把「工作流里有子工作流/人工/升级节点」这件事变成可校验的数据 |
| 工作流的 `pause / resume / abort` | I1.4（实例侧） | 那是实例操作，不是资产操作，本迭代不重复实现 |
| 多人协作下的资产锁、并发写冲突 | 不做 | 写命令是单进程一次性写；冲突检测不在本迭代 |
| 资产的权限、链式哈希审计 | I1.12 | 本迭代不做 ACL |
| **产物合并 / 汇总顺序**（并行节点按声明顺序合并、代码走 git 合并、文档走版本合并、数据走人工裁决） | I1.7 | 基线能力域 2 单列项；本迭代只把「并行组、作用域、映射」变成可校验的数据，不落合并动作 |
| **版本锁定**（实例启动时锁定资产版本） | I1.8 | 需要实例管理器；本迭代没有运行时，没有「运行中资产更新」这个场景 |
| 工作流的**权限匹配**（节点权限与角色工具集匹配） | I1.8 | 需要派发链路与宿主权限模型；本迭代的「权限」只在角色侧（权限闭环）与图侧（唤醒白名单）落地 |
| 节点 9 态运行时迁移（`done→running`、`failed→escalated`、`escalated→cancelled` 等） | I1.8 | 本迭代没有运行时；「节点状态转换合法性」按静态图约束实现（裁-1，见 §2.9） |

### 1.3.1 与 I1.6 规划的逐项对应

| 规划条目（`docs/index.md:741-753`，行号基准见文档头部） | 本需求落点 | 验收 |
|---|---|---|
| 自定义角色三条路径：从零、从内置派生、导入包 | §2.2、§2.3；附录 A-2 ~ A-4、D-4 | AC-01 ~ AC-08 |
| 角色校验器：schema 完整性、技能引用、契约连通、权限闭环、派生链无循环 | §2.5；C-08、A-15 | AC-11 ~ AC-15 |
| 工作流完整原语：并行 fan-out/fan-in、条件分支、子工作流、超时、重试、字段映射（+ 基线已有的顺序/回流/轮次上限/人工/升级/终止） | §2.7、§2.8；附录 A-1、A-13、A-14 | AC-24、AC-27 ~ AC-30、AC-37、AC-63 ~ AC-64 |
| 节点模型补 `node_type`（role / human / escalate / subworkflow） | §2.7；附录 A-1、D-2 | AC-22、AC-24 ~ AC-26、AC-62 |
| 工作流校验器：可达性、回流边轮次上限、并行 scope 不重叠、变量引用有效、节点状态转换合法性、角色对唤醒权限 | §2.9；附录 D-3、A-15 | AC-31 ~ AC-38、AC-60 ~ AC-61、AC-64 |
| CLI 资产命令集：`role create/edit/export/import/diff` | §2.2 ~ §2.4 | AC-01 ~ AC-10、AC-53 ~ AC-59 |
| CLI 资产命令集：`skill list/show/create/validate/export/import` | §2.6 | AC-16 ~ AC-20、AC-58 |
| CLI 资产命令集：`workflow list/show/create/validate/diff/dry-run` | §2.7 ~ §2.10 | AC-21 ~ AC-23、AC-38 ~ AC-42 |
| CLI 通用纪律：一份用法块、用法错误矩阵、只读不建 `.orch`、写只写 `.orch`（**非 I1.6 规划原文**，见 §1.3.2） | §2.2 ~ §2.10（贯穿）；附录 A-12、D-6、D-7 | AC-43 ~ AC-46 |
| **验收**：派生角色修改技能引用后行为变化符合预期 | §2.3 | AC-05 |
| **验收**：契约不连通的工作流被校验器拒绝 | §2.9 | AC-31 |
| **验收**：含 `human` / `escalate` 节点的工作流校验通过 | §2.7 | AC-24 |
| **验收**：`orch workflow dry-run` 不启动会话即可校验编排 | §2.8 | AC-41 |
| 能力域 1「角色校验：契约连通、权限闭环、派生链无循环」（I1.5 登记为 R-4 顺延） | §2.5 | AC-11 ~ AC-14、AC-53 |
| 能力域 2「工作流校验：变量引用有效、节点状态转换合法性、角色对唤醒权限」 | §2.9 | AC-35 ~ AC-38、AC-60 |

> 说明：本表第 9 行（CLI 通用纪律）与第 3 行里的「顺序 / 回流 / 轮次上限 / 人工 / 升级 / 终止」并非 I1.6 规划原文的逐字条目，而是**基线**（能力域 1/2、§5.2、§6 边界 #5/#8）与 I1.5 CLI 纪律的延续；原先把它标注成「`docs/index.md:741-753`」属来源失实，已按 F-09 改正，并在 §1.3.2 单独登记。

### 1.3.2 无规划逐字来源、但由基线或 I1.5 红线推出的条目（登记）

| 条目 | 真实来源 | 落点 |
|---|---|---|
| 用法块集中成一份、前 8 行逐字不变 | I1.5 `USAGE_LINES` 与 `test/wp11/cli-role.test.js:350-358` 的既有纪律（非本迭代规划） | §2.2 ~ §2.10 贯穿；A-12、D-7 |
| 用法错误矩阵（未知子命令 / 未知参数 / 标志用错子命令 / 缺位置参数） | I1.5 C-2 的纪律延续（基线未单列） | AC-44 |
| 只读命令不建 `.orch`、不连核心 | 基线 §5.2 数据布局（604）与 §6 边界 #5/#8（624、627） | AC-45、BR-30 |
| 写命令只写 `.orch/**`，内置资产只读 | 基线 §5.2（604）+ I1.5 资产只读红线 | AC-46、BR-01 |
| 工作流不能被 `orch run` 实例化 | 规划 751 的 CLI 清单反推（无 `run --workflow`），基线能力域 2 的命令集含 `run` 但归运行时迭代 | AC-47、BR-28 |
| 兼容与纯净（I1.5 输出不变、零运行时依赖、无游离中文） | 项目宪法与 I1.5 逐字红线（规划未要求） | AC-48 ~ AC-52、BR-31 ~ BR-34 |

**规划解释登记（R）**

| 编号 | 解释 | 理由 |
|---|---|---|
| R-1 | 内置工作流 = 三张内建图的**只读投影**，不新增 `assets/workflows/**` 文件 | 新增内建图或改内建图字段会直接打破 `test/templates/task-loop.test.js:298-300`（`GRAPHS` 恰好三键、`single`/`code-loop` 不得有 `productPolicy`）与三条主链逐字红线；投影能让 `workflow list/show/diff/create` 有基线，且零风险 |
| R-2 | 项目工作流与内置同名时**整体覆盖**（与角色/技能的合并口径一致） | 一套合并语义比三套好解释；也让「fork 一个内建图再改」成为唯一约定 |
| R-3 | 本迭代不把工作流接进运行时（`orch run --workflow` 不在范围内） | 规划 I1.6 的 CLI 清单里没有 `run --workflow`；接进运行时等于重写派发路径（并行/超时/重试/子工作流），与「三条主链逐字不变」的红线正面冲突；本迭代的验收面是 `dry-run` |
| R-4 | 角色校验器的「契约连通」需要读工作流，但**不计入** `role validate` 的资产计数 | I1.5 的 `校验资产 26 个` 是逐字基线；把工作流算进资产数会让基线当场变红。工作流的资产计数归 `workflow validate` |
| R-5 | 「权限闭环」按**工具集与副作用等级自洽 + 唤醒白名单自洽**落地，不做跨工作流的全覆盖检查 | 内置 `coordinator.wake_allow=[planner, worker]` 在工作流里没有任何出边，全覆盖检查会让 16 个内置角色当场不合法（I1.5 基线变红） |
| R-6 | 「角色对唤醒权限」对**所有被 `orch workflow validate` / `dry-run` 校验的工作流**生效，**含三条内置图**，不豁免、不收窄（裁-2）；为此按附录 D-7b 对齐两个内置角色的白名单 | `task-loop` 的 `researcher → writer` 与 `writer → reviewer` 是正向边，而 I1.5 里 `researcher.wake_allow=[]`、`writer.wake_allow=[editor]`；把内置图排除在外等于让规划条目在 3/3 内置资产上失效（评审 §1 表 #22 判为「收窄」）。改规则不如改资产：只改两个 YAML 的 `wake_allow` 值，不动任何字段结构，属对 I1.5 资产的**最小修正** |
| R-7 | 写命令一律「先校验、后落盘」 | 「不合法不留半成品」比「先写再报错」对用户更省事：不会留下一个必须手工删的文件，也不会让下一次 `role list` 莫名多一行坏资产 |
| R-8 | 用法块集中成**一份 25 行**，不在每个子命令里另印 | 只有一处帮助，用户不必猜「帮助在哪」；代价是 `test/wp11/cli-role.test.js:354/357` 的两处行数断言必须同步（附录 D-7a 点名授权） |
| R-9 | 「节点状态转换合法性」按**静态图约束**实现：按 `node_type` 规定合法的出入边，运行时九态迁移（§3.1 的 9 态边表）明确留 I1.8（裁-1） | 本迭代没有运行时，无法观测 `done→running` 这类迁移；把规则写死成图上可机检的约束，才能让校验器在本迭代给出结论，且不与基线 §3.1 的九态语义混用（见 §2.9 的边界说明） |
| R-10 | 「工作流完整原语」统一按 **11 项**枚举（并行 fan-out/fan-in 算 1 项，含升级、终止），**字段映射**按基线能力域 2 单列（裁-5） | 规划 745 与基线 335 的枚举口径不同（§1.2 与 §1.3 原先给出 11/12 两套）；统一成一套才好逐项对 AC，也避免把「映射」与「原语」混为一谈 |

### 1.4 对既有契约的修改（授权变更）

> M 是「必须改代码/数据结构」的变更；C 是补充契约。未列出的既有契约一律保持不变。

| 编号 | 现状 | 变更 | 为什么 | 兼容 / 影响 |
|---|---|---|---|---|
| **M-1** | CLI 命令树只有 `run/status/cancel/core/role`；`role` 子命令只有 `list/show/validate` | `COMMANDS` 增 `skill`、`workflow`；`role` 子命令扩到 8 条（增 `create/edit/export/import/diff`）；`VALUE_FLAGS` 增 `from/name/artifact-type/side-effect/summary/skills/tools/wake-allow/max-concurrent/set/unset/out/against/body-file/applies-to/commands`；新增可重复标志 `set/unset` 与布尔标志 `force` | 规划要求 17 条资产命令 | 旧命令、旧参数、旧退出码逐字不变；每个子命令有独立标志白名单，跨子命令使用仍是用法错误（I1.5 C-2 的纪律反向成立） |
| **M-2** | `USAGE_LINES` 8 行；`test/wp11/cli-role.test.js:354/357` 断言 8 行与总行数 9 | 用法块扩到 25 行（前 8 行**逐字不变**，追加 17 条子命令行） | 17 条新命令必须有唯一帮助入口（R-8） | **授权修改** `test/wp11/cli-role.test.js:354`（9 → 26）与 `:357`（8 → 25）；`:356` 的 `slice(0, 8)` 不动。其余测试文件一个字符都不动（附录 D-7a） |
| **M-3** | `src/registry/index.js` 只加载角色与技能，`counts` 为 26 资产 | **不改** `loadRegistry`；新增独立的工作流加载器与计划器 | R-4：改 `loadRegistry` 会让 I1.5 的 26 资产基线与 `role list` 的 16 角色计数同时变红 | 只增文件；`loadRegistry` 的返回结构、计数口径、报错顺序全部不变 |
| **M-4** | 角色文件没有「派生来源」这个概念 | 角色文件新增可选键 `derived_from`（已有可选键 `tools/wake_allow/inputs/outputs/dispatchable` 不变） | 派生链无循环需要一条可追溯的边 | `checkRoleShape` 只校验「出现过的键」，新增可选键不改变任何既有角色的合法性；新增 `derived_from` 可选键**不需要**改动任何内置资产；本迭代对内置资产的唯一改动是 D-7b 授权的两处 `wake_allow` 对齐 |
| **M-5** | 角色实例 JSON、`role list/show/validate` 的 JSON 与文本都是逐字基线 | 一律**不加键、不改版式**；派生信息只出现在 `role show` 的**第 7 行**（仅派生角色）、`role export` 的文件内容、`role diff` 的输出里 | 保住 I1.5 的 `test/wp11/cli-role.test.js:285-300 / 499 / 523 / 563 / 577-590` 全部键集合断言 | 非派生角色（含 16 个内置角色）的输出逐字不变（**除 D-7b 授权、AC-48 逐字固定的 `role show researcher` / `role show writer` 两处『可唤醒』行外**：两处 `可唤醒` 行按 D-7b 对齐、由 AC-48 钉住；`--format json` 因 `toRoleJson()` 不含 `wakeAllow` 而不受影响） |
| **M-6** | `src/cli/labels.js` 已有角色六态、分组名、14 条资产原因码 | 新增：角色/技能/工作流三族命令文案、7 条角色新原因码、19 条工作流原因码、5 条条件与类型标签 | 中文唯一来源 | 既有表一个键都不加不改；新增表只被新代码引用 |
| **M-7** | 节点模型只有 `roleId` 一种身份 | 工作流资产的节点新增必填 `node_type`（`role/human/escalate/subworkflow`；JSON 键 `nodeType`）；内建图投影出的节点一律为 `node_type: role` | 规划 746 要求补 `node_type`（F-04：字段名逐字沿用规划，不改写成 `type`） | 内建图对象本身不改；`state.json` 的节点结构不改（本迭代不实例化项目工作流） |

#### 补充契约条目（C-01 ~ C-14）

| 编号 | 契约 |
|---|---|
| C-01 | 角色/技能/工作流 id 一律 `^[a-z][a-z0-9-]*$`、长度 2~32；角色文件名 = `<id>.yaml`，技能目录名 = `<id>`，工作流文件名 = `<id>.yaml`，与声明的 `id` 不一致一律不合法。 |
| C-02 | 写命令的默认落点只有三处：`.orch/roles/<id>.yaml`、`.orch/skills/<id>/SKILL.md`、`.orch/workflows/<id>.yaml`；**或用户显式 `--out <路径>` 指定的那个文件**（`role export` / `skill export` 的唯一例外）。**不得**写 `assets/**`，**不得**创建其它目录。 |
| C-03 | 写命令一律「先校验、后落盘」（R-7）：把要写的内容在内存里跑完整校验，任一原因码出现即不写文件，输出 `<动作>被拒：<明细>（<原因码>）`，退出 1。 |
| C-04 | 落盘是原子的：先写同目录临时文件再改名；失败时目标文件保持原样，不留 `.tmp` 残留。 |
| C-05 | 目标文件已存在时写命令拒绝并提示 `（加 --force 覆盖）`；`--force` 只覆盖文件，不跳过校验。 |
| C-06 | 内置资产只读：`role edit` / `role import` / `skill create`（同名覆盖内置）遇到内置 id 时拒绝；`role export` / `role create --from` / `workflow create --from` 可以**读**内置资产。 |
| C-07 | 序列化口径固定：key 顺序 `schema, id, name, group, summary, artifact_type, side_effect, derived_from, skills, tools, wake_allow, inputs, outputs, dispatchable, max_concurrent_sessions`；只输出源文件里出现过的可选键；数组一律行内序列 `[a, b]`，空数组写 `[]`；缩进 2 空格。**注释不保留**（重写即规范化）。 |
| C-08 | 角色校验器的检查顺序固定：① 必填键 ② id/文件名 ③ group ④ artifact_type ⑤ side_effect ⑥ max_concurrent_sessions ⑦ 技能引用 ⑧ 工具取值与副作用自洽（权限闭环）⑨ 唤醒白名单（权限闭环）⑩ 派生链 ⑪ 契约连通。同一文件的同一原因码只报第一条。 |
| C-09 | 工作流校验器的检查顺序固定：① YAML 解析 ② 必填键 ③ id/文件名 ④ 节点 id 唯一 ⑤ `node_type` 与类型必填字段 ⑥ 端点引用（角色/子工作流） ⑦ 边取值 ⑧ 可达性 ⑨ 回流边轮次上限 ⑩ 并行组与 scope ⑪ 变量引用与字段映射（控制流边 `backflow` / `retest` 跳过） ⑫ 静态图上的状态转换（见 D-3 的出入边矩阵） ⑬ 唤醒权限（**所有**工作流，含内置）。同一文件的同一原因码只报第一条；**项内遍历顺序**也写死：①~⑬ 按序号从小到大，同一项内按「节点/边的 YAML 声明顺序」，同一节点内按 A-1 的字段声明顺序；`errors` 输出先按文件排序（项目按文件名字典序、内置以 `内置 ` 前缀参与排序），同文件内按本顺序。 |
| C-10 | 内置工作流由三张内建图投影得到：节点 `node_type` 一律 `role`，`title` 取图节点 `title`（`null` 时用角色中文名），`max_rounds` 取图 `maxRounds[nodeId]`，边 `kind` 取图边 `kind`、`when` 取图边 `condition` 的归一化值（`null` → `always`；图里 `verdict-fail` / `review-reject` / `reopen-failed-target` 这类运行时条件一律归 `always`，条件语义由图边的 `kind` 表达，保证 `workflow show` 的内置三图输出与 A-8 逐字一致）。投影结果不落盘、不参与任何写命令，但**参与全部六项校验，含唤醒权限**（裁-2）。 |
| C-11 | `workflow validate` 的资产集合 = 内置 3 个 + 项目 `.orch/workflows/*.yaml`；同名项目覆盖内置。`role validate` 的资产集合**不变**（角色 + 技能）。两个命令的计数各自独立、不得混用。 |
| C-12 | `dry-run` 是纯函数：只读资产文件与任务文本，不连核心、不起核心、不建 `.orch`、不写任何文件、不创建 `.orch/instances`。同一输入两次输出逐字节相同。 |
| C-13 | 失败码分两层：**资产级**原因码（角色 7 个新增 + 工作流 19 个）只出现在 `validate` / 写命令被拒 / `dry-run` 被拒的输出里；**命令级**失败码（`ROLE_NOT_FOUND`、`SKILL_NOT_FOUND`、`WORKFLOW_NOT_FOUND`、`ASSET_EXISTS`、`ASSET_READONLY`、`BASELINE_MISSING`）决定退出码与首句文案，不进资产错误表。全部沿用既有退出码语义：0 成功 / 1 资产或目标不合法 / 2 用法错误 / 3 预检失败。 |
| C-14 | 语言口径：`src/registry/**`、`src/cli/roles.js`、`src/cli/skills.js`、`src/cli/workflows.js` **零 CJK、零资产名字面量**；所有中文与原因码模板只在 `src/cli/labels.js`；`src/core`、`src/daemon` 不 import 任何注册表模块。 |

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| # | 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|---|
| A | 从零建角色 | 我 / 团队里定角色的人 | 不必再抄 YAML，一条命令生成一个能通过校验的角色 | 完整：`role create` |
| B | 从内置派生 + 导入包 | 我 / 拿到别人角色包的人 | 派生有据可查，团队之间能交换角色 | 完整：`role create --from`、`role export`、`role import` |
| C | 改角色 + 看差异 | 我 | 改字段不用打开编辑器；改了什么一眼看清 | 完整：`role edit`、`role diff` |
| D | 角色校验五项 | 我 / 写角色的人 | 「连不上、越权、派生打转」在发起前就说清楚 | 完整：仍是 `role validate` 一条命令 |
| E | 技能资产命令 | 我 / 写技能的人 | 技能能建、能看、能校验、能交换 | 完整：`skill list/show/create/validate/export/import` |
| F | 工作流资产与节点类型 | 我 / 设计流程的人 | 流程从「代码里的对象」变成「我能读能写的文件」 | 完整：`workflows/*.yaml` + 四类节点 + `workflow list/show/create` |
| G | 预演编排 | 设计流程的人 | 「先看编排对不对」，不花一次真实执行 | 完整：`workflow dry-run`（不起核心、不建会话） |
| H | 工作流校验六项 | 设计流程的人 | 编排写错在哪、为什么错，一次说清 | 完整：`workflow validate` |
| I | 看差异 | 我 | 我的工作流和内置基线差在哪 | 完整：`workflow diff` |

### 2.2 A 从零建角色：一条命令得到一个合法角色

- **使用角色**：我；团队里负责定角色边界的人。
- **使用场景**：我的项目需要一个「首席开发」，内置的 `developer` 不够用；我不想抄 YAML，也不想记住 9 个必填字段的名字。
- **用户操作**：在项目根执行

  ```
  orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run
  ```

- **预期效果**：终端给出三行——写到了哪个文件、这个角色的契约行、校验结论：

  ```
  已创建项目角色：.orch/roles/lead-dev.yaml
  - lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1
  校验：通过
  ```

  随后 `orch role list` 的首行变成 `角色 17 个（内置 16 · 项目 1）`，`orch role show lead-dev` 的来源行是 `来源：项目 .orch/roles/lead-dev.yaml`。没写的字段按默认值补齐：`summary` 为空串、`tools` 为空、`wake_allow` 为空、`max_concurrent_sessions` 为 1。
- **异常情况**：
  - 少了必填参数（比如没给 `--name`）：打印用法 + `（role create 需要 --name）`，退出码 2，**不建文件**。
  - 技能名写错：`创建被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`，退出码 1，**不建文件**。
  - 已经存在同名项目角色：`已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）`，退出码 1。
  - 分组/产物类型/副作用等级取值不对：用法错误，退出码 2，提示合法取值。
- **边界说明**：`create` 只写项目目录，不碰内置资产；用内置 id 建角色一律被拒绝（`--force` 也只覆盖**项目里已有的同名文件**，不能覆盖内置）。
- **异常补充**：`--name` / `--group` / `--artifact-type` / `--side-effect` 的取值不在合法集合里（例如 `--group nope`、`--artifact-type doc`、`--side-effect heavy`）时是**用法错误**：打印用法块 + `（role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）` 这类一行原因，退出码 2，不建文件（AC-54）。

#### 2.2.1 建 / 改角色时还能改哪些字段，写错时看到什么

> 这一节回答「除了 id 与四个必填项，还能给什么；给错了看到哪句话」。所有取值域的合法性都在**落盘前**判定：取值非法 → 用法错误（退出码 2，不建/不改文件）；字段组合非法 → 资产被拒（退出码 1，不建/不改文件）。

| 我给的东西 | 我看到的效果 | 我给错了 |
|---|---|---|
| `--summary <摘要>` | `role show` 的「职责」行变成这段文字；不给则职责行为空 | 无（任意文本） |
| `--skills a,b` | 契约行的「技能 N」与 `role show` 的「技能」行；引用不存在的技能 → 创建被拒 | `创建被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`，退出 1 |
| `--tools a,b` | 「工具」行；四类取值 `read` / `write` / `edit` / `bash` | 取值非法 → `创建被拒：工具取值非法：grep；合法取值：read / write / edit / bash（ROLE_TOOL_UNKNOWN）`，退出 1 |
| `--wake-allow a,b` | 「可唤醒」行；空数组显示为 `—` | 指向不存在的角色 → `ROLE_WAKE_UNKNOWN`；包含自己 → `ROLE_WAKE_SELF`，退出 1 |
| `--max-concurrent 1..5` | 契约行的「并发 N」 | 越界 → 用法错误，退出 2 |
| `role edit --set <键=值>` | 就地改写该字段并回新的契约行 | 未知键 → 用法错误 `（未知字段：<键>）`，退出 2（AC-56） |
| `role edit --unset <键>` | 该字段回到缺省值（`summary` 空串、数组为空、`max_concurrent_sessions` 为 1） | 删必填键 → 用法错误 `（role edit 不能删除必填字段：<键>）`，退出 2（AC-56） |
| `role create --from <来源>` | 未给的字段继承来源（见 §2.3） | 来源不存在 → `ROLE_DERIVE_MISSING`，退出 1 |

### 2.3 B 从内置派生与导入包：派生有据可查，角色能交换

- **使用角色**：我；拿别人角色包的人。
- **使用场景**：我想要 `developer` 的全部设定，只改名字和技能；我要把团队里定好的角色发给同事，或者从同事那里装一个。
- **用户操作**：
  - 派生：`orch role create lead-dev --from developer --name 首席开发 --skills test-run`
  - 导出：`orch role export lead-dev --out exports/lead-dev.yaml`
  - 导入：`orch role import exports/lead-dev.yaml`
- **预期效果**：
  - 派生的文件里多一行 `derived_from: developer`；`orch role show lead-dev` 在来源行之后多一行 `派生自：developer`；**没显式给的字段一律继承来源**（工具、唤醒白名单、并发上限、产物类型都沿用 `developer`），显式给的（名字、技能）覆盖。
  - **给了 `--from` 时，四个必填项都可以不写**：`--name` 省略用默认名、`--group` / `--artifact-type` / `--side-effect` 省略即继承来源。也就是说 `orch role create lead-dev --from developer --skills test-run` 这一条命令就能建出合法角色，不会因为「缺 `--name`」退 2（F-03）。没给 `--from` 时四个必填项仍然一个都不能少（§2.2、BR-03）。
  - 不写 `--name` 时，派生角色的中文名默认是 `开发（派生）`。
  - `export` 打印一份可以直接 `import` 的完整文件（YAML 正文）；带 `--out` 时写到文件并回一行 `已导出角色 lead-dev 到 exports/lead-dev.yaml`。
  - `import` 成功后回两行：`已安装项目角色：.orch/roles/lead-dev.yaml` 与 `校验：通过`；随后 `role list` 里它是「项目」来源。
  - 导出再导入同一个项目（round-trip）得到的是同一份内容，校验结论不变。
- **异常情况**：
  - 派生来源不存在：`创建被拒：派生来源不存在：developer（ROLE_DERIVE_MISSING）`，退出码 1，不建文件。
  - 派生链成环（A 派生自 B、B 派生自 A，或自己派生自己）：`校验` 报 `ROLE_DERIVE_CYCLE`，指明链条。
  - 导入的文件不是角色文件（缺 `schema`，或 `schema` 不是 `role/v1`）：`导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）`，退出码 1，不落盘（AC-55）。
  - 导入的文件引用了本机没有的技能：`导入被拒：引用的技能不存在：x（ROLE_SKILL_NOT_FOUND）`，退出码 1。**不会**装进一个必然不合法的资产。
  - 导入的文件用了内置 id（例如一份 `id: developer` 的角色文件）：`导入被拒：内置角色只读：developer（ASSET_READONLY）`，退出码 1，内置资产一个字节都不动（AC-58）。
  - 已存在同名项目角色且没加 `--force`：与创建同一条提示，退出码 1。
- **边界说明**：本迭代的「包」= **单个可导出/导入的资产文件**（角色或技能，含 schema 与全部元数据，YAML/Markdown 原样进原样出）——`import` 只装这一个文件，不解析依赖闭包、不验签名、不检查版本兼容、不做来源追溯（I1.12，裁-3）；技能要自己先装好。`derived_from` **只记一层**：A 派生自 B、B 派生自 C 时，A 的字段**不会**回溯到 C，链只用于「来源存在」与「成环」判定（B-04）。

### 2.4 C 改角色与看差异

- **使用角色**：我。
- **使用场景**：上线前把某个角色的产物类型从 `code` 改成 `document`；或者想确认自己那份角色和内置的到底差在哪。
- **用户操作**：
  - `orch role edit lead-dev --set artifact_type=document --set summary=负责终审代码改动`
  - `orch role diff lead-dev`
- **预期效果**：
  - `edit` 就地重写那一份项目文件，回三行：`已更新项目角色：…` + 新的契约行 + `校验：通过`。改写是规范化的：字段按固定顺序排列、数组写成 `[a, b]`、**文件里的注释不保留**（这一点命令成功后会在末尾提示 `（已按规范格式重写，注释不保留）`）。
  - `diff` 逐行给出差异，只打印不同的字段，末行给差异项数：

    ```
    对比角色 lead-dev（项目）与基线 developer（内置）
    ~ name：开发 → 首席开发
    ~ skills：code-change, test-run → test-run
    差异 2 项
    ```

    完全一致时末行是 `无差异`。**角色 `diff` 比对口径**（仅 `orch role diff`，与 §2.10 的工作流 `diff` 口径 BR-37 不同）：忽略 `id`（身份键，`--against <文件>` 时两边 id 可能不同），`name` 与其余键**全比**（故 AC-10 会出现 `~ name` 差异行）；缺省键按缺省值参与比较（没写 ≈ 空串 / 空数组），所以「没写 `summary`」与「写了空 `summary`」不算差异。差异项数 = 差异行数。
- **异常情况**：
  - 改内置角色：`内置角色不可编辑：先 orch role create <新角色> --from developer`，退出码 1。
  - 改一个不存在的角色：`找不到角色：<id>` + `可用角色：执行 orch role list 查看`，退出码 1（AC-57）。
  - `--set` 的键不认识：用法错误，`（未知字段：<键>）`，退出码 2；`--unset` 要删必填键：用法错误，`（role edit 不能删除必填字段：<键>）`，退出码 2（AC-56）。
  - 改完会不合法（例如把 `side_effect` 改成 `read` 却留着写工具）：`编辑被拒：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）`，退出码 1，文件保持原样。
- **边界说明**：`edit` 只能改项目角色；`diff` 的基线默认是同名内置角色，没有同名内置时用 `--against <内置角色|文件>` 指定，否则提示 `缺少对比基线：<id>（用 --against 指定内置角色或文件）`、退出码 1（AC-57）。

### 2.5 D 角色校验五项：五件事一次说完

- **使用角色**：我；写角色的人。
- **使用场景**：我写完一批角色，想在发起前确认它们「不只是字段齐全，而且真能接进流程」。
- **用户操作**：`orch role validate`（全部）或 `orch role validate <角色>`（单个）。
- **预期效果**：全部合法时的输出**与 I1.5 完全一样**（一行 `校验资产 26 个：全部通过（角色 16 · 技能 10）`）。不合法时逐条列出 `- <相对路径>：<人话明细>（<原因码>）`，退出码 1；新增的三类结论复用它同一套版式：

  | 检查项 | 什么情况下报 | 原因码 |
  |---|---|---|
  | schema 完整性 | 缺必填字段、取值越界 | `ROLE_SCHEMA_MISSING`（沿用 I1.5）；工具名不在四类里 → `ROLE_TOOL_UNKNOWN`（**本迭代新增**，I1.5 只校验 `tools` 是字符串数组、不校验取值，见 A-15） |
  | 技能引用 | 引用的技能不存在 | `ROLE_SKILL_NOT_FOUND`（沿用 I1.5） |
  | 契约连通 | **逐字段**判：某个输入字段没有任何指向该角色的工作流边提供它（既没有 `map.to` 落到该字段，上游节点 `outputs` 里也没有同名字段）；或某个输出字段没有任何从该角色出发的边消费它（既没有 `map.from` 指向该字段，下游节点 `inputs` 里也没有同名字段） | `ROLE_CONTRACT_UNBOUND` |
  | 权限闭环 | 说只读却带写工具、说可执行却带不了命令；白名单里出现不存在的角色；白名单包含自己 | `ROLE_PERMISSION_MISMATCH`、`ROLE_WAKE_UNKNOWN`、`ROLE_WAKE_SELF` |
  | 派生链无循环 | 派生来源不存在，或派生链成环 | `ROLE_DERIVE_MISSING`、`ROLE_DERIVE_CYCLE` |

- **异常情况**：同一份文件同时有多类问题时，**每一类各一行**（同一原因码在同一文件只报一条；同一原因码有多个字段时，按 C-08 的检查顺序与字段声明顺序取第一条，所以「谁先被报」是确定的，不是随机的）；派生链成环时环上**每个文件各报一条**（同码不同文件不算重复）。某个工作流文件坏到解析不了时，这一项（契约连通）对它跳过——那个工作流的错由 `orch workflow validate` 负责，不在 `role validate` 里重复报。
- **边界说明**：这是**同一条命令的扩展**，不是新命令：命令名、输出首行、计数口径（角色 + 技能）、退出码语义全部沿用 I1.5。`orch run` 的发起前预检行为也不变（只拦前两类 + 新增三类资产级问题，工作流不进预检）。

### 2.6 E 技能资产命令

- **使用角色**：我；写技能的人。
- **使用场景**：我要给团队定一个「引用规范」技能；我要看看 `code-change` 到底让人怎么做；我要把技能发给别人。
- **用户操作与预期效果**（按模板 §2.2 的六段结构组织；本节把「用户操作」与「预期效果」合并成下表的两列 `我做什么` / `我看到什么`，`使用角色` / `使用场景` / `异常情况` / `边界说明` 另列，F-18）：

  | 命令 | 我做什么 | 我看到什么 |
  |---|---|---|
  | `orch skill list` | 看全部技能 | 首行 `技能 10 个（内置 10 · 项目 0）`，随后一行一个：`- code-change 代码修改 · 编码工程 · 命令 1` |
  | `orch skill show code-change` | 看一个技能 | 六行元数据（契约行、摘要、命令、适用、来源、`正文：`），随后是正文，每行缩进两格 |
  | `orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处` | 建一个技能 | `已创建项目技能：.orch/skills/quote/SKILL.md` + 契约行 + `校验：通过`；不写正文时自动填一段「工作方法」骨架 |
  | `orch skill validate` | 校验技能 | `校验技能 10 个：全部通过`；不合法时逐条 `- skills/<id>/SKILL.md：<明细>（<原因码>）`，退出 1 |
  | `orch skill export code-change --out exports/code-change.md` | 导出一个技能 | `已导出技能 code-change 到 exports/code-change.md` |
  | `orch skill import exports/code-change.md` | 装一个技能 | `已安装项目技能：.orch/skills/code-change/SKILL.md` + `校验：通过` |

- **异常情况**：目录名与 id 不一致、缺 `summary`、正文为空、适用分组取值不对，全部报既有原因码（`SKILL_ID_MISMATCH` / `SKILL_SCHEMA_MISSING` / `SKILL_BODY_EMPTY` / `SKILL_GROUP_INVALID`）。`create` / `import` 遇到**内置** id 时拒绝，回 `创建被拒：内置技能只读：code-change（ASSET_READONLY）` / `导入被拒：内置技能只读：…`，退出 1；`--force` 只覆盖**项目里**的同名资产（回 `已存在同名项目技能：<路径>（加 --force 覆盖）`），永远不动内置（AC-58）。
- **还能给什么**：`--applies-to <a,b>`（适用分组，多组用逗号）、`--commands <命令>`（一条验证命令）、`--body-file <文件>`（正文来源；不给时自动填 A-7 的「工作方法」骨架）。取值写错时与 §2.2.1 同一套口径：语法/取值问题退 2，资产问题退 1（AC-59）。
- **边界说明**：技能正文仍然不进派发提示词（沿用 I1.5 的范围外结论）；技能资产不参与 `orch run` 预检之外的新逻辑。

### 2.7 F 工作流资产与四类节点

- **使用角色**：我；设计流程的人。
- **使用场景**：三张内建图不够用——我要一条「研究 → 两人并行撰写 → 汇总 → 人工确认 → 失败就升级」的流程。
- **用户操作**：`orch workflow create doc-fanout --name 文档并行版 --from task-loop`，然后在 `.orch/workflows/doc-fanout.yaml` 里改节点与边。
- **预期效果**：
  - `orch workflow list` 首行 `工作流 3 个（内置 3 · 项目 0）`，随后 `- code-loop 编码闭环 · 2 节点 · 3 边 · 内置` 这样的行。
  - `orch workflow show doc-fanout` 给出：首行摘要、入口与终点、逐节点一行（含节点类型、角色、超时、重试）、逐边一行（含方向、轮次上限、条件、字段映射条数）。
  - 节点有四种类型（字段名 `node_type`，与规划 746 逐字一致），各自的必填项与**允许的出入边**一目了然（裁-1）：

    | `node_type` | 谁在干 | 必填 | 允许的出入边 | 不能做什么 |
    |---|---|---|---|---|
    | `role` | 某个角色 | `role` | 可入可出；可作正向边两端，也可作回流 / 复测的目标 | 缺 `role` 不合法 |
    | `human` | 人 | `title` | **终点型**：可以没有出边（此时它就是流程终点）；若有出边，只能是带「人工通过 / 人工驳回」条件的正向边 | 不得声明 `role`；不得有「无条件」出边；不得作为回流 / 复测的目标 |
    | `escalate` | 升级队列 | `title` | **终点型**：不得有任何出边（升级是终点） | 出边一律不合法（正向 / 回流 / 复测都不行） |
    | `subworkflow` | 另一条工作流 | `workflow` | 按**单一节点**参与出入边（可入可出，折叠组不展开） | 不得引用自己、不得形成子工作流环（跨工作流也不行） |

  - **回流边只允许指向 `role` 节点**：`kind: backflow` / `retest` 的 `to` 必须是 `role`；指向 `human` / `escalate` / `subworkflow` 一律不合法。
  - **终止**：终点由 `terminal` 字段声明；此外 `human` 与 `escalate` 节点天然就是终点（流程可以停在人工确认或升级队列上）。「每个节点都能走到某个终点」是本迭代的可达性判据之一（BR-35、AC-64）。
  - 同名项目工作流**整体覆盖**同名内置基线（`workflow list` 里那条的来源变成「项目」）。
- **异常情况**：类型写错（`node_type: script`）→ `WORKFLOW_NODE_TYPE_INVALID`，明细列出四个合法取值；`human` 缺 `title` → `WORKFLOW_NODE_FIELD_MISSING`，明细指明缺哪个字段；子工作流名写错 → `WORKFLOW_SUB_UNKNOWN`；子工作流成环 → `WORKFLOW_SUB_CYCLE`（AC-62）。
- **边界说明**：`create --from` 只复制结构（节点、边、轮次上限），不复制内建图的运行时语义；`workflow create` 生成的文件**不能**被 `orch run` 使用（见 §2.11）。

### 2.8 G 预演编排：先看对不对，再决定跑不跑

- **使用角色**：设计流程的人。
- **使用场景**：我写完一条 6 节点带并行的流程，想知道它会怎么走，但不想为「看一眼」起一次核心。
- **用户操作**：`orch workflow dry-run doc-fanout`
- **预期效果**：终端按「层」列出编排计划（并行组占一行）、条件分支、字段映射、超时与重试，最后一行给结论：

  ```
  编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流
  1. T-001 研究（角色节点 researcher）
  2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all
  3. T-004 人工确认（人工节点）
  4. T-006 代码闭环（子工作流 code-loop · 2 节点）
  5. T-005 升级（升级节点）
  条件分支：
  - T-004 → T-006 当 人工通过
  - T-004 → T-005 当 人工驳回
  - T-006 → T-005 当 判定不通过
  字段映射：
  - T-001.research.notes → T-002.brief
  - T-001.research.notes → T-003.brief
  超时与重试：
  - T-001 超时 600s · 重试 2
  结论：编排可执行，未启动任何会话
  ```

  整个过程**不建实例、不起核心、不建会话、不写任何文件**；跑完项目根下仍然没有 `.orch/instances`、没有 `.orch/core.json`。
- **异常情况**：工作流不合法时**不预演**，直接给结论：`预演被拒：<第一条明细>（<原因码>）`，退出码 1，并提示 `执行 orch workflow validate` 看全部问题。
- **边界说明**：`dry-run` 只推演「结构上会怎么走」，不评估条件真假（条件在运行时才成立）；它给的是「有哪些分支」而不是「这次会走哪条」。

### 2.9 H 工作流校验六项

- **使用角色**：设计流程的人。
- **使用场景**：我抄了一条流程、加了并行和人工节点，想在自己跑之前先知道「这张图合不合法」——不是「跑起来对不对」，而是「有没有断头路、有没有人叫不醒、有没有回不来的环」。
- **用户操作**：`orch workflow validate` 或 `orch workflow validate doc-fanout`。
- **预期效果**：全部通过时一行 `校验工作流 3 个：全部通过`（新建了项目工作流就是 4 个）；不合法时逐条 `- <相对路径>：<明细>（<原因码>）`，退出 1。六项内容：

  | 检查项 | 我在什么时候撞上 | 原因码 |
  |---|---|---|
  | 可达性 | 有个节点谁都不指向它（从入口进不来）；或者某个节点一路走下去也到不了任何终点（`terminal`、人工节点、升级节点都到不了） | `WORKFLOW_UNREACHABLE` |
  | 回流边轮次上限 | 有一条回边，但被回流的节点没写轮次上限 | `WORKFLOW_BACKFLOW_NO_LIMIT` |
  | 并行 scope 不重叠 | 同一并行组里两个节点写同一个产物作用域；或一个并行组只有 1 个节点 | `WORKFLOW_SCOPE_OVERLAP`、`WORKFLOW_SCOPE_INVALID` |
  | 变量引用有效 | 映射里引用了上游没有的字段；下游要的输入没有来源（**契约不连通**） | `WORKFLOW_VAR_UNKNOWN`、`WORKFLOW_MAPPING_INCOMPLETE` |
  | 节点状态转换合法性（**静态图约束**） | 入口节点被回流；升级节点有出边；人工节点的出边没写人工条件；回流指向了非角色节点 | `WORKFLOW_TRANSITION_ILLEGAL` |
  | 角色对唤醒权限 | 一条**正向**边的上游角色，其唤醒白名单里没有下游角色（白名单为空数组 = 谁都不许主动唤醒） | `WORKFLOW_WAKE_DENIED` |

- **用户可见的边界（裁-1）**：这一项叫「状态转换」，但它查的是**图上节点类型与边是否合法**（静态），**不是**节点跑起来时的 9 态迁移（`done→running`、`failed→escalated` 等）。本迭代没有运行时，那套九态迁移留 I1.8；所以 `orch workflow validate` 通过 = 「这张图在结构上能跑」，不等于「这次跑会怎么跳状态」。
- **异常情况**：一个文件可以有多条错误（不同原因码各一条）；同一文件同一原因码只报一条，报哪一条由 C-09 写死的遍历顺序决定（所以「第一条」是确定的）。**三条内置图也逐项参与全部六项校验，包括唤醒权限**（裁-2、R-6）——这道检查同时是内建图的回归门禁：`assets/roles/*.yaml` 被改坏时，`workflow validate` 会先红（AC-61）。
- **边界说明**：`workflow validate` **不会**因为项目工作流坏了而拦住 `orch run`（`run` 只用内建模板，见 §2.11）；它是显式门禁，不是隐式全局拦截。

### 2.10 I 看差异：我的工作流和内置差在哪

- **使用角色**：我。
- **使用场景**：我从内置 `code-loop` 派生了一份，改了两处，想确认「到底改了哪几处」；也想确认「原封不动派生出来的那份是不是真的没差异」。
- **用户操作**：`orch workflow diff fork --against code-loop`；原封不动的那份直接 `orch workflow diff copy`。
- **预期效果**：

  ```
  对比工作流 fork（项目）与基线 code-loop（内置）
  ~ nodes[0].title：开发 → 开发（改）
  差异 1 项
  ```

  完全一致时第 2 行是 `无差异`（没有差异行）；没有同名内置基线又没给 `--against` 时提示 `缺少对比基线：<id>（用 --against 指定内置工作流或文件）`、退出 1。
- **比对口径（F-02，与 A-11 逐字一致）**：只比**定义体** `summary` / `entry` / `terminal` / `nodes` / `edges`；**忽略** `schema`（固定值）、`id`（身份键，派生后必然不同）、`name`（标签键，派生后按新名命名）。节点、边按**下标**配对，缺省键按缺省值比（未写 ≈ 空）。差异项数 = 差异行数。
- **异常情况**：工作流不存在 → `找不到工作流：<id>`，退出 1；没有同名内置基线又没给 `--against` → `缺少对比基线：…`，退出 1（AC-57）。
- **边界说明**：`diff` 只比较「定义」，不比较运行时状态；`=`（相同）的字段不打印。

### 2.11 功能之间的衔接：走完一遍

1. 我在空项目里 `orch role create lead-dev --from developer --name 首席开发 --skills test-run`：三行结果，`role list` 变 17 个。
2. 我 `orch role diff lead-dev`：`~ name`、`~ skills`、`+ derived_from` 三行，`差异 3 项`。
3. 我把技能改成一个不存在的名字 `orch role edit lead-dev --set skills=no-such`：`编辑被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`，文件没变（`role show` 的技能行还是 `test-run`）。
4. 我 `orch role export lead-dev --out exports/lead-dev.yaml`：文件里带着 `derived_from: developer`。
5. 同事在另一台机器的项目里 `orch role import exports/lead-dev.yaml`：两行结果；他那边的 `role list` 变 17 个，`role show lead-dev` 多一行 `派生自：developer`。
6. 我写 `.orch/workflows/doc-fanout.yaml`（6 节点：研究 → 并行撰写 → 汇总 → 人工确认 → 升级 / 子工作流），然后 `orch workflow validate doc-fanout`：`校验工作流 4 个：全部通过`。
7. 我把 T-002 的输入多加一个 `outline` 却没给映射：`workflow validate` 报 `WORKFLOW_MAPPING_INCOMPLETE`，说明 `T-002 的输入 outline 没有来源`；我把映射补上，再校验通过。
8. `orch workflow dry-run doc-fanout`：看到并行组、三条条件分支、两条字段映射、一个子工作流；项目根下没有多出任何实例目录。
9. 我照常 `orch run --template code-loop …`：三张内建图的行为与 I1.5 一模一样；`orch workflow create` 建出来的流程**不会**被 `--template` 认出来（`未知模板：doc-fanout`），这是本迭代明确的边界。

### 2.12 用户可见的业务规则

| 编号 | 规则 |
|---|---|
| BR-01 | 所有写命令只写项目根 `.orch/roles/**`、`.orch/skills/**`、`.orch/workflows/**`，以及用户**显式 `--out` 指定的那个文件**（`export` 的唯一例外）；内置资产只读，任何命令都不修改 `assets/**`。 |
| BR-02 | 从零、从内置派生、从导入包安装三条路径产出的都是一份**普通的项目角色文件**：之后 `show` / `edit` / `validate` / `diff` 对它一视同仁。 |
| BR-03 | **没有 `--from` 时**，从零创建必须给出 id、中文名、分组、产物类型、副作用等级；缺任一项是用法错误（退出码 2），不建文件。**给了 `--from` 时**这四个参数都可省略（见 BR-38）。 |
| BR-04 | 派生会在文件里写下派生来源；未显式指定的字段继承来源，显式指定的覆盖。 |
| BR-05 | 派生时不给中文名，默认叫「<来源中文名>（派生）」。 |
| BR-06 | 派生来源必须是一个存在的角色；派生链不得成环（含自己派生自己）。 |
| BR-07 | 写命令一律先校验后落盘：内容不合法就**不写文件**，并给出第一条原因码。 |
| BR-08 | 目标文件已存在时拒绝写入，只有加 `--force` 才覆盖；`--force` 不跳过校验。 |
| BR-09 | 内置角色/技能只读：可以导出、可以作为派生来源，不能就地编辑、不能导入覆盖。 |
| BR-10 | `role import` / `skill import` 只安装单个文件，不解析依赖闭包、不验签名、不检查版本兼容（留待 I1.12）；缺依赖（引用不存在的技能）时拒绝导入。 |
| BR-11 | `diff` 只打印不同的字段，末行给差异项数；完全一致时明说「无差异」；默认与同名内置基线比较。 |
| BR-12 | 角色校验器五项在同一条 `orch role validate` 里给结论；命令名、首行文案、计数口径（角色 + 技能）、退出码语义与 I1.5 完全一致。 |
| BR-13 | 契约连通（**逐字段**判）：角色声明的**每个输入字段**都必须有来源——某条指向它的工作流边的 `map.to` 等于该字段，或该边上游节点的 `outputs` 含同名字段；角色声明的**每个输出字段**都必须有去处——某条从它出发的边的 `map.from` 指向该字段（形如 `<节点 id>.<字段>`），或该边下游节点的 `inputs` 含同名字段。只对「被至少一个工作流引用」的角色生效。 |
| BR-14 | 权限闭环：工具集必须与副作用等级对得上（`none` 不带工具、`read` 只带读、`write` 必须带写或编辑、`exec` 必须带命令）；工具名只能是 `read`/`write`/`edit`/`bash`；唤醒白名单里的角色必须存在，且不得包含自己。 |
| BR-15 | 技能资产的格式仍是 `skills/<id>/SKILL.md`（前置元数据 + 正文），可被创建、查看、校验、导出、导入；正文不拼进派发提示词。 |
| BR-16 | 技能校验沿用既有原因码与版式，计数口径只算技能。 |
| BR-17 | 工作流是声明式资产 `.orch/workflows/<id>.yaml`；三张内建图以只读「内置工作流」形式可列出、可查看、可作为基线与派生来源。 |
| BR-18 | 同名项目工作流整体覆盖同名内置基线（不逐字段合并）。 |
| BR-19 | 每个工作流节点必须有类型（`role`/`human`/`escalate`/`subworkflow`），类型决定必填字段与允许的连接方式。 |
| BR-20 | 工作流校验六项，逐项给出专属原因码；一个文件的不同原因码各报一条，同一原因码只报一条。 |
| BR-21 | 可达性：所有节点都必须从入口可达（正向、沿所有边遍历），且每个节点都必须能走到某个**终态**——`terminal` 指定的节点，或者任意 `human` / `escalate` 节点（BR-35）。 |
| BR-22 | 只要存在一条回流边，被回流的节点就必须声明轮次上限。 |
| BR-23 | 并行组至少两个节点，同一并行组内各节点的产物作用域不得重复。 |
| BR-24 | 变量引用必须解析得到：映射的来源必须是本边上游节点的输出字段或 `task`，目标必须落在下游节点的输入里；下游每个输入都必须有来源（同名或显式映射），否则算契约不连通。 |
| BR-25 | 节点状态转换合法性（**静态图约束**，不是 §3.1 的九态迁移）：入口不得被回流；`escalate` 不得有任何出边；`human` 的出边必须是「人工通过 / 人工驳回」两种条件之一；`human` / `escalate` / `subworkflow` 不得成为回流 / 复测的目标（回流只允许指向 `role`，BR-36）。 |
| BR-26 | 角色对唤醒权限：**每条正向边**（`kind: forward`）的源角色，其 `wake_allow` 必须包含目标角色；`wake_allow: []` 表示**不允许主动唤醒任何角色**；`backflow` / `retest` 边由核心回流触发、不受白名单约束，但目标必须是 `role` 节点。三条内置图与项目工作流**同一套规则、不豁免**（裁-2）。 |
| BR-27 | `dry-run` 只做静态推演：不起核心、不建会话、不建实例目录、不写任何文件、不联网；同一输入两次输出逐字节相同。 |
| BR-28 | 本迭代不给 `orch run` 增加工作流入参：`--template` 仍只认三个内建模板名，未知名字仍报 `未知模板：<名字>` 并退出 1。 |
| BR-29 | 全部资产命令的帮助集中在一份用法块里；用法块前 8 行与 I1.5 逐字一致，新增的 17 行逐条对应 17 条子命令。 |
| BR-30 | `role list/show/validate`、`skill list/show/validate`、`workflow list/show/validate/diff/dry-run` 不创建 `.orch`、不启动核心、不连核心；写命令也不连核心。 |
| BR-31 | 所有新增中文只来自 `labels.js`；新增实现文件不出现任何角色/技能/工作流名字面量。 |
| BR-32 | I1.5 的 `role list / show / validate` 文本与 JSON 逐字不变；唯一增量是派生角色的 `role show` 多一行 `派生自：<来源>`。**唯一例外**：`role show researcher` / `role show writer` 的「可唤醒」行按附录 D-7b 对齐（`  可唤醒：writer` / `  可唤醒：editor, reviewer`），由 AC-48 逐字钉住；其余 I1.5 既有输出一字不变。理由是 `src/cli/roles.js:91-104` 的 `toRoleJson()` 不含 `wakeAllow` 字段，所以 `role list --format json` 与 `role show --format json` 都不受两处 `wake_allow` 改动影响。 |
| BR-33 | 三条主链（`single` / `code-loop` / `task-loop`）的终端输出与 I1.5 逐字一致。 |
| BR-34 | 不新增运行时依赖；`package.json` 的 `dependencies` 键数量仍为 0。 |
| BR-35 | **终态定义**（F-01）：终态 = `terminal` 字段指定的节点，或任意 `human` 节点，或任意 `escalate` 节点。「走到终点」不再只指 `terminal` 一个节点，所以「人工确认」「升级」这种停在人这边的结束方式是合法的。 |
| BR-36 | **节点类型与出入边矩阵**（裁-1）：`role` 可入可出；`human` 是终点型（可无出边，出边只能是带人工条件的正向边，且不能有别的条件）；`escalate` 是终点型（不得有任何出边）；`subworkflow` 按单一节点参与出入边；`backflow` / `retest` 只允许指向 `role` 节点。 |
| BR-37 | **工作流 `diff` 口径**（F-02，**仅 `orch workflow diff`**）：只比定义体 `summary` / `entry` / `terminal` / `nodes` / `edges`，忽略 `schema` / `id` / `name`；节点与边按下标配对；缺省键按缺省值比较；差异项数 = 差异行数。因此「无差异」与「差异 N 项」在给定输入下都可达。**角色 `diff` 口径另见 §2.4 / BR-11**：忽略 `id`（身份键）、`name` 与其余键全比（AC-10 的 `~ name` 由此而来），缺省键按缺省值比较、差异项数 = 差异行数；两套口径不可混用。 |
| BR-38 | **派生时参数可省**（F-03）：给了 `--from` 时 `--group` / `--artifact-type` / `--side-effect` 省略即继承来源，`--name` 省略即用「<来源中文名>（派生）」；四项都省略也能建出合法角色。 |
| BR-39 | **唤醒权限对所有工作流生效**（裁-2）：被 `workflow validate` / `dry-run` 校验的工作流（含三条内置图）逐条正向边校验白名单，不豁免、不收窄；空数组等于不允许主动唤醒任何角色。 |
| BR-40 | **校验顺序与错误排序固定**（F-11）：工作流校验按 C-09 的 ①~⑬ 顺序执行，项内按 YAML 声明顺序；输出先按文件排序、同文件内按检查顺序。因此「恰好 N 条错误」「第一条是哪个」都是确定的，不依赖实现的遍历巧合。 |
| BR-41 | **三条内置工作流必须全部通过六项校验**（`invalid = 0`）：这是资产对齐（附录 D-7b）的回归红线——把 `researcher` / `writer` 的 `wake_allow` 改回去，`orch workflow validate` 必须变红。 |

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> **观测口径**：本迭代允许四类观测——① **命令输出**（用户直接看到的行与退出码）；② **机检**：`--format json` 的结构、项目根下的 `.orch/**` 文件内容与 `sha256`；③ **夹具**：仓库内 mock ACP agent 与 `test/fixtures/*-driver.mjs`（涉及实例的 AC 必须注入 `NODE_ENV=test`）；④ **架构检查**：源码字面量/CJK/依赖扫描。②③④一律以 `机检：` / `夹具：` / `架构检查：` 开头并给出完整命令。
>
> **每个 AC 的 Given 都是一个可构造的项目根**：命令面 AC 在 `%TEMP%/maestro-acc-p6/<AC 编号>/` 下新建空目录（开始前不存在 `.orch`），需要项目资产时由该 AC 自己预置；需要实例的 AC 用仓库内夹具 + `NODE_ENV=test`。`$REPO` 指仓库根，`$ROOT` 指该 AC 的项目根，`orch` 一律等价于 `node "$REPO/bin/orch.js"`。

#### AC-01 从零建出一个能通过校验的角色

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-02、BR-03、BR-07
- **Given** 一个全新项目根（无 `.orch`）
- **When** 我执行 `orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run`
- **Then** 终端恰好三行：`已创建项目角色：.orch/roles/lead-dev.yaml`、契约行 `- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1`、`校验：通过`；退出码 0；随后 `orch role list` 首行是 `角色 17 个（内置 16 · 项目 1）`
- **机检：** `test -f "$ROOT/.orch/roles/lead-dev.yaml"` 为真；文件首行 `schema: role/v1`，含 `max_concurrent_sessions: 1`；`node "$REPO/bin/orch.js" role list --format json` 的 `counts.project === 1`、`counts.total === 17`、`roles` 中 `lead-dev` 的 `source === 'project'`

#### AC-02 从零创建缺必填参数是用法错误

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-03
- **Given** 一个全新项目根（以下三条命令都**不带** `--from`；带 `--from` 时这四个参数可省略，见 AC-04、BR-38）
- **When** 依次执行 `orch role create lead-dev`、`orch role create lead-dev --group coding`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type code`
- **Then** 三次都打印用法块并追加一行原因（分别是 `（role create 需要 --name）`、`（role create 需要 --name）`、`（role create 需要 --side-effect）`），退出码都是 2，且都没有建文件
- **机检：** 三次退出码 2；`test -e "$ROOT/.orch"` 为假

#### AC-03 目标已存在时拒绝，`--force` 才覆盖

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-08
- **Given** `.orch/roles/lead-dev.yaml` 已存在（由 AC-01 的同一条命令建出），内容为 `summary` 为空
- **When** 我先执行 `orch role create lead-dev --name 另一个名字 --group coding --artifact-type code --side-effect write`，再执行同一条命令加 `--force`
- **Then** 第一次输出 `已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）`、退出码 1，文件内容不变；第二次成功、退出码 0，契约行的名字变成 `另一个名字`
- **机检：** 第一次后 `grep -c '另一个名字' "$ROOT/.orch/roles/lead-dev.yaml"` 为 0；第二次后为 1

#### AC-04 从内置派生：继承、覆盖与「派生自」

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-02、BR-04、BR-05、BR-38
- **Given** 一个全新项目根
- **When** 我执行 `orch role create lead-dev --from developer --skills test-run`（**不写** `--name`，也不写 `--group` / `--artifact-type` / `--side-effect`），再执行 `orch role show lead-dev`
- **Then** 命令成功、退出码 0（不会因为缺四个必填项退 2）；文件里写下 `derived_from: developer`；中文名默认是 `开发（派生）`；技能是 `test-run`（覆盖），工具是 `read, write, edit, bash`、可唤醒是 `tester`、并发上限是 1、产物类型是 `code`、分组是 `编码工程`（全部继承）；`role show` 在来源行之后多一行 `派生自：developer`，其余行与内置 `developer` 的版式一致
- **机检：** `orch role show lead-dev --format json` 的 `role` 对象**仍是 10 个键**（派生信息不进 JSON）；文本输出第 7 行等于 `  派生自：developer`；`test/wp11/cli-role.test.js` 全绿（内置角色的 6 行基线不变）
- **机操：** `orch role list --format json` 中 `lead-dev.maxConcurrentSessions === 1`、`lead-dev.artifactType === 'code'`、`lead-dev.skills` 等于 `['test-run']`

#### AC-05 派生角色改技能引用后，三处行为同时变化

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-04、BR-12
- **Given** AC-04 建出的 `lead-dev`（技能 `['test-run']`）
- **When** 我执行 `orch role edit lead-dev --set skills=test-run,code-review`，然后分别执行 `orch role show lead-dev`、`orch role list`、`orch role validate`
- **Then** ① `role show` 的技能行从 `  技能：test-run` 变成 `  技能：test-run, code-review`；② `role list` 中 `lead-dev` 那一行的技能数从 `技能 1` 变成 `技能 2`；③ `role validate` 仍然全部通过、退出码 0
- **机检：** 改前改后 `role show --format json` 的 `role.skills` 分别为 `['test-run']` 与 `['test-run','code-review']`；`role list` 文本行改后以 `· 技能 2 · 并发 1` 结尾；`role validate` 的 `counts.invalid === 0`

#### AC-06 派生链缺失与成环被拒

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-06
- **Given** 一个全新项目根，预置两份项目角色：`.orch/roles/a.yaml`（`derived_from: b`）与 `.orch/roles/b.yaml`（`derived_from: a`），其余字段合法
- **When** 我执行 `orch role validate`；随后把 `b.yaml` 的 `derived_from` 改成 `ghost` 再执行一次
- **Then** 第一次报两条 `ROLE_DERIVE_CYCLE`（环上每个文件各一条，明细给出环上的角色名），退出 1；第二次只报一条 `ROLE_DERIVE_MISSING`，明细给出 `ghost`，退出 1
- **机检：** 第一次 `errors.map(e => e.code)` 全为 `ROLE_DERIVE_CYCLE`、长度 2、`errors[0].file === 'roles/a.yaml'`（按文件名字典序）；第二次 `errors.length === 1`、`errors[0].code === 'ROLE_DERIVE_MISSING'`、`errors[0].file === 'roles/b.yaml'`

#### AC-07 导出再导入，角色在另一个项目里可用

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-02、BR-09、BR-10
- **Given** 项目根 A（含 AC-04 的 `lead-dev`）与项目根 B（空）
- **When** 我在 A 里执行 `orch role export lead-dev --out exports/lead-dev.yaml`，把它拷到 B 的根下，在 B 里执行 `orch role import lead-dev.yaml`，再执行 `orch role list` 与 `orch role validate`
- **Then** 导出回一行 `已导出角色 lead-dev 到 exports/lead-dev.yaml`、退出 0；B 里导入回 `已安装项目角色：.orch/roles/lead-dev.yaml` 与 `校验：通过`、退出 0；B 的 `role list` 首行 `角色 17 个（内置 16 · 项目 1）`
- **机检：** A 导出的文件里含 `derived_from: developer`；B 的 `.orch/roles/lead-dev.yaml` 与 A 导出的文件逐字节相同；B 的 `role validate` `counts.invalid === 0`

#### AC-08 导入被拒的两种情形都不落盘

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-07、BR-08、BR-10
- **Given** 一个全新项目根，预置两份文件：`ghost.yaml`（技能为 `no-such`）、`lead-dev.yaml`（合法，技能 `test-run`）；同时项目里已有 `.orch/roles/lead-dev.yaml`
- **When** 我依次执行 `orch role import ghost.yaml`、`orch role import lead-dev.yaml`
- **Then** 第一次输出 `导入被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）`、退出 1，`.orch/roles/` 下没有任何新文件；第二次输出 `已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）`、退出 1，文件内容不变
- **机检：** 两次退出码都是 1；`.orch/roles` 下文件清单在两次执行前后逐字相同；第一次执行后 `test -e "$ROOT/.orch/roles/ghost.yaml"` 为假

#### AC-09 就地编辑与内置角色只读

- 场景类型：混合 ｜ 风险：P1 ｜ 引用：BR-07、BR-09
- **Given** AC-01 建出的 `lead-dev`（`artifact_type: code`）
- **When** 我执行 `orch role edit lead-dev --set artifact_type=document`，再执行 `orch role edit developer --set artifact_type=document`
- **Then** 第一次回四行（`已更新项目角色：…`、契约行中产物类型变 `document`、`校验：通过`、`（已按规范格式重写，注释不保留）`）、退出 0；第二次回 `内置角色不可编辑：先 orch role create <新角色> --from developer`、退出 1
- **机检：** 第一次后 `grep -c 'artifact_type: document' "$ROOT/.orch/roles/lead-dev.yaml"` 为 1，且 `assets/roles/developer.yaml` 的 `sha256` 前后相同；第二次退出码 1

#### AC-10 差异清单与「无差异」

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-11
- **Given** AC-04 的 `lead-dev`（与 `developer` 相比：名字、技能、派生来源三处不同），以及一份与内置 `developer` 逐字段相同的项目覆盖文件
- **When** 我执行 `orch role diff lead-dev`，再对那份逐字段相同的角色执行 `orch role diff`
- **Then** 第一次打印 `对比角色 lead-dev（项目）与基线 developer（内置）` + 三行差异（`+ derived_from：developer`、`~ name：开发 → 开发（派生）`、`~ skills：code-change, test-run → test-run`）+ `差异 3 项`，退出 0；第二次末行是 `无差异`
- **机检：** 第一次输出行数 5、末行逐字匹配 `差异 3 项`；`--format json` 的顶层键恰为 `base`/`target`/`changes`，`changes` 长度 3 且 `kind` 集合为 `{added, changed}`

#### AC-11 角色校验器的五项各有专属原因码

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-06、BR-12、BR-13、BR-14
- **Given** 一个全新项目根，预置五份坏角色与一条引用它们的工作流：`m.yaml`（缺 `max_concurrent_sessions`）、`s.yaml`（技能 `no-such`）、`c.yaml`（声明 `inputs: [brief]`）、`p.yaml`（`side_effect: read` + `tools: [write]`）、`d.yaml`（`derived_from: d`）；工作流 `.orch/workflows/use-c.yaml`：`T-001`（`c`，入口）→ `T-002`（`reviewer`），`terminal: T-002`（`c` 只作入口，没有任何边给它 `brief`）
- **When** 我执行 `orch role validate --format json`
- **Then** 五条错误，原因码恰好是 `ROLE_SCHEMA_MISSING`、`ROLE_SKILL_NOT_FOUND`、`ROLE_CONTRACT_UNBOUND`、`ROLE_PERMISSION_MISMATCH`、`ROLE_DERIVE_CYCLE`；退出码 1
- **机检：** `counts.assets === 31`（16 角色 + 10 技能 + 5 个坏文件）、`counts.roles === 16`、`counts.skills === 10`、`counts.invalid === 5`；`errors.map(e => e.code)` 排序后与上面五个逐字相同；每条 `errors[]` 仍只有 6 个键

#### AC-12 契约连通：输入没人给、输出没人要

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-13
- **Given** 一个全新项目根，预置两个角色与一条工作流：`scout`（`inputs: [brief]`、`outputs: [notes]`）、`scribe`（`inputs: [notes]`、`outputs: [digest]`）；工作流 `solo`：`T-001`（`scout`，入口）→ `T-002`（`scribe`，终点），这条边上带 `map: T-001.notes → notes`
- **When** 我执行 `orch role validate`
- **Then** 恰好两行：`- roles/scout.yaml：…（ROLE_CONTRACT_UNBOUND）`（明细含 `brief`，说的是「输入没来源」）与 `- roles/scribe.yaml：…（ROLE_CONTRACT_UNBOUND）`（明细含 `digest`，说的是「输出没去处」），退出 1；`notes` **两边都不报**——`scout` 的 `notes` 被 `T-001 → T-002` 的 `map.from` 消费，`scribe` 的 `notes` 由同一映射提供（字段级口径，F-05）
- **机检：** `--format json` 的 `errors.length === 2`、`errors.map(e => e.code)` 全为 `ROLE_CONTRACT_UNBOUND`、`errors[0].file === 'roles/scout.yaml'` 且 `errors[0].detail` 含 `brief`、`errors[1].file === 'roles/scribe.yaml'` 且 `errors[1].detail` 含 `digest`；两处 `detail` 都不含 `notes`

#### AC-13 权限闭环：工具集与副作用等级对不上

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-14
- **Given** 一个全新项目根，预置三份坏角色：`r1.yaml`（`side_effect: read` + `tools: [read, write]`）、`r2.yaml`（`side_effect: exec` + `tools: [read]`）、`r3.yaml`（`side_effect: none` + `tools: [read]`）
- **When** 我执行 `orch role validate`
- **Then** 三条错误，原因码都是 `ROLE_PERMISSION_MISMATCH`，明细分别是「副作用等级为 read 的角色不能带写工具 write」「副作用等级为 exec 的角色必须带能执行命令的工具 bash」「副作用等级为 none 的角色不能带任何工具」，退出 1
- **机检：** `errors.map(e => e.code)` 全为 `ROLE_PERMISSION_MISMATCH`、长度 3、按文件名排序；`counts.invalid === 3`

#### AC-14 权限闭环：白名单悬空与自唤醒

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-14
- **Given** 一个全新项目根，预置 `w1.yaml`（`wake_allow: [ghost]`）与 `w2.yaml`（id 为 `w2`，`wake_allow: [w2]`），其余字段合法
- **When** 我执行 `orch role validate`
- **Then** 两条错误：`ROLE_WAKE_UNKNOWN`（明细含 `ghost`）与 `ROLE_WAKE_SELF`（明细含 `w2`），退出 1
- **机检：** `errors.map(e => e.code)` 排序后等于 `['ROLE_WAKE_SELF','ROLE_WAKE_UNKNOWN']`

#### AC-15 26 个内置资产仍然全通过（I1.5 基线不变）

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-12、BR-32
- **Given** 一个全新项目根（没有任何项目资产、也没有工作流）
- **When** 我执行 `orch role validate` 与 `orch role validate --format json`
- **Then** 文本输出恰好一行 `校验资产 26 个：全部通过（角色 16 · 技能 10）`、退出码 0；JSON 的 `counts` 仍是 6 键，`assets === 26`、`roles === 16`、`skills === 10`、`invalid === 0`、`errors` 为空
- **机检：** 与 I1.5 收口提交 `0cd113b` 的同一条命令输出逐字节 diff 为空（`git stash` 不参与；直接对比 `docs/iterations/iteration-5/evidence/` 中的基线文本）

#### AC-16 技能清单可列且格式稳定

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-15、BR-29
- **Given** 一个全新项目根
- **When** 我执行 `orch skill list`
- **Then** 首行 `技能 10 个（内置 10 · 项目 0）`，随后 10 行，每行形如 `- code-change 代码修改 · 编码工程 · 命令 1`；按 id 字典序；退出码 0
- **机检：** 总行数 11；`--format json` 顶层键恰为 `counts`/`skills`，`counts` 4 键（`total`/`builtin`/`project`/`invalid`），`skills` 长度 10，每个技能对象恰 7 键（`id`/`name`/`appliesTo`/`appliesToLabels`/`commands`/`source`/`file`）

#### AC-17 技能详情含正文

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-15
- **Given** 一个全新项目根
- **When** 我执行 `orch skill show code-change`
- **Then** 前 6 行是契约行、`  摘要：…`、`  命令：node --test`、`  适用：编码工程`、`  来源：内置 assets/skills/code-change/SKILL.md`、`  正文：`；第 7 行是 `  ### 工作方法`；退出码 0
- **机检：** `lines.length > 7`；`lines[5] === '  正文：'`、`lines[6] === '  ### 工作方法'`；`--format json` 顶层键恰为 `skill`/`body`，`body` 含 `### 工作方法`

#### AC-18 建技能并立即通过校验

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-07、BR-15、BR-16
- **Given** 一个全新项目根
- **When** 我执行 `orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing`
- **Then** 三行：`已创建项目技能：.orch/skills/quote/SKILL.md`、契约行 `- quote 引用规范 · 内容创作 · 命令 0`、`校验：通过`，退出 0；随后 `orch skill validate` 首行是 `校验技能 11 个：全部通过`
- **机检：** 文件以 `---` 开头且含 `schema: skill/v1`、`id: quote`；正文去掉空白后非空（`skill validate` `counts.invalid === 0`）

#### AC-19 技能校验定位到具体文件

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-16
- **Given** 一个全新项目根，预置 `.orch/skills/half/SKILL.md`（缺 `summary`）与 `.orch/skills/empty/SKILL.md`（正文只有空行）
- **When** 我执行 `orch skill validate`
- **Then** 首行 `校验技能 12 个：2 个不合法`，随后两行 `- skills/half/SKILL.md：缺少必填字段：summary（SKILL_SCHEMA_MISSING）` 与 `- skills/empty/SKILL.md：技能正文为空：empty（SKILL_BODY_EMPTY）`，退出 1
- **机检：** `--format json` 的 `codes` 排序后等于 `['SKILL_BODY_EMPTY','SKILL_SCHEMA_MISSING']`，`counts.assets === 12`

#### AC-20 技能导出再导入

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-08、BR-15
- **Given** 一个全新项目根 A 与另一个空项目根 B
- **When** 在 A 里 `orch skill export code-change --out exports/code-change.md`，把文件拷进 B 后 `orch skill import code-change.md`
- **Then** A 回 `已导出技能 code-change 到 exports/code-change.md`、退出 0；B 回 `已安装项目技能：.orch/skills/code-change/SKILL.md` 与 `校验：通过`、退出 0；B 的 `skill list` 首行 `技能 10 个（内置 9 · 项目 1）`
- **机检：** B 的 `.orch/skills/code-change/SKILL.md` 与 A 导出的文件逐字节相同；B 的 `skill validate` `counts.invalid === 0`、`counts.project === 1`

#### AC-21 内置工作流可列出

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-17、BR-29
- **Given** 一个全新项目根
- **When** 我执行 `orch workflow list`
- **Then** 首行 `工作流 3 个（内置 3 · 项目 0）`，随后三行 `- code-loop 编码闭环 · 2 节点 · 3 边 · 内置`、`- single 单节点 · 1 节点 · 0 边 · 内置`、`- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置`；退出码 0
- **机检：** 总行数 4；`--format json` 顶层键恰为 `counts`/`workflows`，`counts.total === 3`、`workflows[0]` 恰 6 键（`id`/`name`/`nodeCount`/`edgeCount`/`source`/`file`），`source === 'builtin'`、`file === null`

#### AC-22 工作流详情给出节点、边与类型

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-17、BR-19
- **Given** 一个全新项目根
- **When** 我执行 `orch workflow show code-loop`
- **Then** 首行 `- code-loop 编码闭环 · 2 节点 · 3 边 · 内置`；随后 `  入口：T-001 · 终点：T-002`、`  节点：`、两行节点（`    T-001 开发 · 角色节点 developer · 超时 — · 重试 0`）、`  边：`、三行边（含 `    T-002 → T-001 回流 · 轮次上限 2`）；退出码 0
- **机检：** `--format json` 的 `nodes` 长度 2，每个节点恰 11 键（`id`/`nodeType`/`role`/`title`/`timeout`/`retry`/`maxRounds`/`parallelScope`/`scope`/`inputs`/`outputs`），`nodes[0].nodeType === 'role'`；`edges` 长度 3，`edges[1].kind === 'backflow'`

#### AC-23 项目工作流覆盖同名内置

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-18
- **Given** 一个全新项目根，预置 `.orch/workflows/code-loop.yaml`（3 节点、4 边，结构与内置不同但合法）
- **When** 我执行 `orch workflow list` 与 `orch workflow show code-loop`
- **Then** `workflow list` 首行 `工作流 3 个（内置 2 · 项目 1）`；`workflow show code-loop` 首行是 `- code-loop 编码闭环 · 3 节点 · 4 边 · 项目`，节点数为 3
- **机检：** `--format json` 中 `counts.builtin === 2`、`counts.project === 1`，同名条目的 `source === 'project'`、`file === '.orch/workflows/code-loop.yaml'`

#### AC-24 四类节点齐备的工作流校验通过

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-19、BR-20、BR-35（规划验收：含 `human` / `escalate` 节点的工作流校验通过）
- **Given** 一个全新项目根，预置附录 A-1/A-13 的 `doc-fanout`（6 节点，含 `role`/`human`/`escalate`/`subworkflow` 四类；`T-005` 是升级终点、`T-004` 是人工节点）
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** `校验工作流 4 个：全部通过`，退出码 0（`T-005` 没有出边也**不算**不可达：它是升级终点，BR-35）
- **机检：** `--format json` 的 `counts.invalid === 0`、`counts.assets === 4`；`workflow show doc-fanout --format json` 的 `nodes.map(n => n.nodeType)` 去重后等于 `['escalate','human','role','subworkflow']`，`subworkflow` 节点（`T-006`）多一个 `workflow` 键且值等于 `'code-loop'`

#### AC-25 非法节点类型与类型必填字段被拒

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-19
- **Given** 一个全新项目根，预置三份工作流：`bad-type.yaml`（`node_type: script`）、`no-title.yaml`（`node_type: human` 且无 `title`）、`no-role.yaml`（`node_type: role` 且无 `role`）
- **When** 我执行 `orch workflow validate`
- **Then** 三条错误，原因码分别是 `WORKFLOW_NODE_TYPE_INVALID`（明细列出四个合法类型）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `title`）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `role`），退出 1
- **机检：** `errors.map(e => e.code)` 排序后等于 `['WORKFLOW_NODE_FIELD_MISSING','WORKFLOW_NODE_FIELD_MISSING','WORKFLOW_NODE_TYPE_INVALID']`，按文件名排序且 `errors[0].file` 是 `workflows/bad-type.yaml`

#### AC-26 子工作流引用必须存在且不得成环

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-19
- **Given** 一个全新项目根，预置 `sub-ghost.yaml`（`node_type: subworkflow` + `workflow: ghost`）与 `sub-self.yaml`（`workflow: sub-self`）
- **When** 我执行 `orch workflow validate`
- **Then** 两条错误：`WORKFLOW_SUB_UNKNOWN`（明细含 `ghost`）与 `WORKFLOW_SUB_CYCLE`（明细含 `sub-self`），退出 1
- **机检：** `errors.map(e => e.code)` 排序后等于 `['WORKFLOW_SUB_CYCLE','WORKFLOW_SUB_UNKNOWN']`

#### AC-27 并行 fan-out / fan-in 通过校验并在预演中成组

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-20、BR-23、BR-27
- **Given** 附录 A-13 的 `doc-fanout`（`T-002`/`T-003` 同属并行组 `draft`，同进同出）
- **When** 我执行 `orch workflow validate doc-fanout` 与 `orch workflow dry-run doc-fanout`
- **Then** 校验 `全部通过`；预演里出现一行 `2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all`，且这两个节点**不在**同一层的两行里分别出现
- **机检：** 预演 JSON 的 `layers[1].parallel === true`、`layers[1].nodes` 等于 `['T-002','T-003']`；`layers` 里不存在第二个同时含 `T-002` 的层；`nodeCount === 6`、`edgeCount === 7`

#### AC-28 条件分支可表达并在预演中逐条列出

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-20、BR-25、BR-27
- **Given** 附录 A-13 的 `doc-fanout`（`T-004` 有两条出边：人工通过→子工作流、人工驳回→升级；`T-006` 失败→升级）
- **When** 我执行 `orch workflow dry-run doc-fanout`
- **Then** 输出含 `条件分支：` 段与三行：`- T-004 → T-006 当 人工通过`、`- T-004 → T-005 当 人工驳回`、`- T-006 → T-005 当 判定不通过`
- **机检：** 预演 JSON 的 `branches` 长度 3，元素为 `{from,to,when}` 三键，`when` 集合等于 `{human_approved,human_rejected,failed}`

#### AC-29 超时与重试：取值合法可用，越界被拒

- 场景类型：混合 ｜ 风险：P1 ｜ 引用：BR-20、BR-27
- **Given** 一个全新项目根，预置 `timeout-ok.yaml`（某节点 `timeout: 600`、`retry: 2`）与 `timeout-bad.yaml`（`timeout: 0`、另一节点 `retry: 9`）
- **When** 我分别执行 `orch workflow validate timeout-ok` 与 `orch workflow validate timeout-bad`，再对合法的那个执行 `orch workflow dry-run timeout-ok`
- **Then** 第一个 `校验工作流 1 个：全部通过`、退出 0；第二个报 `WORKFLOW_TIMEOUT_INVALID` 与 `WORKFLOW_RETRY_INVALID`、退出 1；预演输出含 `- <节点> 超时 600s · 重试 2`
- **机检：** 预演 JSON 的 `policies` 含 `{nodeId, timeout:600, retry:2}`；`timeout` 合法范围为 1~86400 的整数、`retry` 为 0~5 的整数

#### AC-30 字段映射可表达并可核对

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-24、BR-27
- **Given** 附录 A-13 的 `doc-fanout`（`T-001.research.notes` 映射到 `T-002.brief` 与 `T-003.brief`）
- **When** 我执行 `orch workflow dry-run doc-fanout`
- **Then** 输出含 `字段映射：` 段与两行 `- T-001.research.notes → T-002.brief`、`- T-001.research.notes → T-003.brief`
- **机检：** 预演 JSON 的 `mappings` 长度 2、元素恰 3 键（`from`/`to`/`edge`），`mappings[0].from === 'T-001.research.notes'`

#### AC-31 契约不连通的工作流被拒绝（规划验收）

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-24
- **Given** 把附录 A-13 的 `T-002.inputs` 改成 `[brief, outline]`，但没有任何边提供 `outline`
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报一条 `WORKFLOW_MAPPING_INCOMPLETE`，明细为 `T-002 的输入 outline 没有来源`，退出 1；把映射补上后同一命令 `全部通过`
- **机检：** 失败时 `errors[0].code === 'WORKFLOW_MAPPING_INCOMPLETE'`、`errors[0].detail` 含 `outline`；补上后 `counts.invalid === 0`

#### AC-32 可达性

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-21
- **Given** 附录 A-13 的 `doc-fanout` 追加一个谁都不指向的节点 `T-007`（`node_type: role`、`role: tester`）
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报 `WORKFLOW_UNREACHABLE`，明细含 `T-007`，退出 1
- **机检：** `errors[0].code === 'WORKFLOW_UNREACHABLE'`、`errors[0].detail` 含 `T-007`

#### AC-33 回流边必须有轮次上限

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-22
- **Given** 附录 A-13 的 `doc-fanout` 追加一条 `T-003 → T-002` 的 `backflow` 边（`kind: backflow`、`when: failed`；源 `T-003` 是 `role` 节点、不是 `human`，符合 BR-25 / BR-36，且只加边、不改任何 `scope`，不与 AC-34 的 `T-002` / `T-003` scope 夹具互相污染），`T-002` 仍是回边目标且没有声明 `max_rounds`
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报 `WORKFLOW_BACKFLOW_NO_LIMIT`，明细含 `T-002`；给 `T-002` 补上 `max_rounds: 2` 后同一命令通过
- **机检：** 失败时 `errors[0].code === 'WORKFLOW_BACKFLOW_NO_LIMIT'`；补上后 `counts.invalid === 0`

#### AC-34 并行组内作用域不得重复

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-23
- **Given** 把附录 A-13 的 `T-002` 与 `T-003` 的 `scope` 都改成 `draft`
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报 `WORKFLOW_SCOPE_OVERLAP`，明细同时含 `T-002`、`T-003`、`draft`；把并行组 `draft` 改成只剩一个节点时改报 `WORKFLOW_SCOPE_INVALID`
- **机检：** 两次的 `errors[0].code` 分别为 `WORKFLOW_SCOPE_OVERLAP` 与 `WORKFLOW_SCOPE_INVALID`

#### AC-35 变量引用无效

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-24
- **Given** 把附录 A-13 的 `T-001 → T-002` 映射改成 `from: T-003.research.notes`（`T-003` 不是该边的上游）
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报 `WORKFLOW_VAR_UNKNOWN`，明细含 `T-003.research.notes`，退出 1
- **机检：** `errors[0].code === 'WORKFLOW_VAR_UNKNOWN'`、`errors[0].detail` 含 `T-003.research.notes`

#### AC-36 节点状态转换合法性

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-25
- **Given** 附录 A-13 的 `doc-fanout` 追加一条 `T-005 → T-006` 的 `forward` 边（升级节点不得有正向出边）
- **When** 我执行 `orch workflow validate doc-fanout`
- **Then** 报 `WORKFLOW_TRANSITION_ILLEGAL`，明细含 `T-005`；把 `T-004` 的两条出边的 `when` 去掉后，改报 `WORKFLOW_TRANSITION_ILLEGAL` 且明细含 `人工条件`
- **机检：** 两次的 `errors[0].code` 均为 `WORKFLOW_TRANSITION_ILLEGAL`，`detail` 分别含 `T-005` 与 `人工条件`

#### AC-37 角色对唤醒权限

- 场景类型：异常 ｜ 风险：P0 ｜ 引用：BR-26
- **Given** 一个全新项目根，预置工作流 `wake.yaml`：`T-001`（`role: writer`，`wake_allow` 为 `[editor]`）→ `T-002`（`role: reviewer`），`terminal: T-002`
- **When** 我执行 `orch workflow validate wake`
- **Then** 报 `WORKFLOW_WAKE_DENIED`，明细含 `writer`、`reviewer`，退出 1；把下游换成 `editor` 后同一命令通过
- **机检：** 失败时 `errors[0].code === 'WORKFLOW_WAKE_DENIED'`；换成 `editor` 后 `counts.invalid === 0`

#### AC-38 工作流校验的文本与 JSON 一致

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-20
- **Given** 一个全新项目根（只有内置三张图）
- **When** 我执行 `orch workflow validate` 与 `orch workflow validate --format json`
- **Then** 文本恰好一行 `校验工作流 3 个：全部通过`、退出 0；JSON 顶层恰两键 `counts`/`errors`
- **机检：** `counts` 恰 4 键（`assets`/`builtin`/`project`/`invalid`），`assets === 3`、`builtin === 3`、`invalid === 0`、`errors` 为空；`errors[]` 出现时恰 6 键（`code`/`file`/`scope`/`field`/`line`/`detail`），`scope === 'workflow'`

#### AC-39 工作流差异与「无差异」

- 场景类型：混合 ｜ 风险：P1 ｜ 引用：BR-11、BR-18
- **Given** 项目工作流 `fork.yaml` 由 `orch workflow create fork --name 分叉版 --from code-loop` 生成后再改一个节点标题
- **When** 我执行 `orch workflow diff fork --against code-loop`；再新建 `copy`（`--from code-loop` 后一字不改）并执行 `orch workflow diff copy`
- **Then** 第一次打印 `对比工作流 fork（项目）与基线 code-loop（内置）` + 一行 `~ nodes[0].title：开发 → 开发（改）` + `差异 1 项`，退出 0；第二次末行 `无差异`
- **机检：** 第一次的 `--format json` 顶层键恰 `base`/`target`/`changes`，`changes.length === 1` 且 `changes[0].field === 'nodes[0].title'`

#### AC-40 从内置工作流生成项目工作流

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-07、BR-17、BR-08
- **Given** 一个全新项目根
- **When** 我执行 `orch workflow create fork --name 分叉版 --from code-loop`
- **Then** 回两行 `已创建项目工作流：.orch/workflows/fork.yaml` 与 `校验：通过`，退出 0；随后 `orch workflow validate` 首行 `校验工作流 4 个：全部通过`
- **机检：** 生成文件含 `schema: workflow/v1`、`id: fork`、两个 `- id: T-00` 节点与三条边；`workflow list --format json` 的 `counts.project === 1`
- **When（`--force` 追加用例，只加不减）** 在同名项目工作流已预置存在的情形下（`fork.yaml` 已存在且合法），先执行 `orch workflow create fork --name 另一个名字`（不带 `--force`），再执行同一条命令加 `--force`；随后把 `fork.yaml` 换成一份不合法的工作流内容，再执行一次带 `--force` 的 `orch workflow create fork --name 另一个名字`
- **Then（`--force` 追加用例）** 第一次输出 `已存在同名项目工作流：.orch/workflows/fork.yaml（加 --force 覆盖）`、退出码 1、文件不变；第二次成功、退出码 0（回两行 `已创建项目工作流：.orch/workflows/fork.yaml` 与 `校验：通过`），文件被覆盖为 `--name 另一个名字` 对应的合法工作流；第三次即使带 `--force`，因待覆盖内容不合法仍被拒（`创建被拒：<明细>（<原因码>）`、退出 1、目标文件保持原样）——`--force` 只覆盖文件、**不跳过校验**（BR-08 / C-05）
- **机检（`--force` 追加用例）：** 第一次后 `grep -c '另一个名字' "$ROOT/.orch/workflows/fork.yaml"` 为 0；第二次后为 1 且 `node "$REPO/bin/orch.js" workflow validate fork --format json` 的 `counts.invalid === 0`；第三次退出码 1 且目标文件 `sha256` 与覆盖前相同

#### AC-41 预演不启动会话、不建实例（规划验收）

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-27
- **Given** 一个全新项目根，预置附录 A-13 的 `doc-fanout`，并记录执行前 `.orch` 的目录清单与 `sha256` 清单
- **When** 我执行 `orch workflow dry-run doc-fanout`
- **Then** 末行是 `结论：编排可执行，未启动任何会话`，退出码 0；执行后 `.orch` 下**没有** `instances/`、没有 `core.json`，所有既有文件的 `sha256` 与执行前相同
- **机检：** `test -e "$ROOT/.orch/instances"` 为假、`test -e "$ROOT/.orch/core.json"` 为假；`find "$ROOT/.orch" -type f -exec sha256sum {} +` 前后逐字相同；同一命令连续执行两次 stdout 逐字节相同

#### AC-42 预演对不合法工作流直接拒绝

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-20、BR-27
- **Given** 把附录 A-13 的 `T-001` 的 `role` 改成不存在的 `ghost-role`
- **When** 我执行 `orch workflow dry-run doc-fanout`
- **Then** 输出 `预演被拒：引用的角色不存在：ghost-role（WORKFLOW_ROLE_UNKNOWN）` 与提示 `执行 orch workflow validate 查看全部问题`，退出码 1；没有任何编排计划行
- **机检：** stdout 不含 `编排计划`；退出码 1；`.orch/instances` 不存在

#### AC-43 用法块：25 行，前 8 行逐字不变

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-29
- **Given** 一个全新项目根
- **When** 我执行 `orch role bogus`
- **Then** 打印的用法块共 25 行，前 8 行与 I1.5 逐字相同（首行仍是 `用法：orch run|status|cancel|core`），第 9~25 行依次是 17 条新子命令；最后再追加一行 `  （未知的 role 子命令：bogus）`；退出码 2
- **机检：** `USAGE_LINES.length === 25` 且 `USAGE_LINES.slice(0,8)` 与 I1.5 基线逐字相同；整块行数 26（25 + 原因行）

#### AC-44 三族命令的用法错误矩阵

- 场景类型：异常 ｜ 风险：P1 ｜ 引用：BR-29
- **Given** 一个全新项目根
- **When** 我对 `skill` / `workflow` / `role` 三族各执行四类错误：未知子命令（`skill bogus`、`workflow bogus`、`role bogus`）、未知参数（各加 `--nope`）、标志用错子命令（`skill show x --instance y`、`workflow list --group x`、`role show x --group coding`）、缺必填位置参数（`skill show`、`workflow show`、`role show`）
- **Then** 十二次都是打印用法块 + 一行具体原因，退出码都是 2，且原因文案分别是 `未知的 <族> 子命令：bogus`、`未知参数：--nope`、`--<键> 不适用于 <族> <子命令>`，缺位置参数的三次分别是 `role show 需要角色 id`、`skill show 需要技能 id`、`workflow show 需要工作流 id`
- **机检：** 十二次退出码均为 2；`grep -c '（' ` 每条原因各出现一次；用法块行数恒为 25

#### AC-45 只读命令不建 `.orch`、不连核心

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-30
- **Given** 一个全新项目根（无 `.orch`）
- **When** 我依次执行 `role list`、`role show developer`、`role validate`、`skill list`、`skill show code-change`、`skill validate`、`workflow list`、`workflow show code-loop`、`workflow validate`、`workflow diff code-loop`（全部只读；`workflow diff` 对内置自比无差异）
- **Then** 十条命令都退出 0 或 0/1（仅因资产不合法），项目根下 `.orch` 目录始终不存在，没有任何进程被拉起
- **机检：** 执行后 `test -e "$ROOT/.orch"` 为假；`assets/**` 的 `sha256` 清单前后逐字相同

#### AC-46 写命令只写 `.orch`，内置资产一字不动

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-01、BR-30
- **Given** 一个全新项目根，执行前记录 `assets/**` 的 `sha256` 清单
- **When** 我依次执行 `role create`、`role create --from`、`role export --out`、`role import`、`role edit`、`skill create`、`skill export --out`、`skill import`、`workflow create`
- **Then** 九条命令全部成功（退出 0），新增文件只出现在 `.orch/roles`、`.orch/skills`、`.orch/workflows` 与显式 `--out` 指定的目录里；`assets/**` 的 `sha256` 清单前后逐字相同
- **机检：** `find assets -type f -exec sha256sum {} +` 前后一致；`git status --porcelain assets` 为空；`test -e "$ROOT/.orch/core.json"` 为假（写命令不连核心）

#### AC-47 工作流不能被 `orch run` 实例化（范围边界）

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-28
- **Given** 项目里存在合法的项目工作流 `doc-fanout`
- **When** 我执行 `orch run --cwd ./demo --task "写下说明" --template doc-fanout`
- **Then** 输出 `未知模板：doc-fanout`，退出码 1；没有启动核心、没有建实例
- **机检：** `.orch/instances` 不存在、`.orch/core.json` 不存在；`assets` 与 `.orch/workflows` 的文件字节不变

#### AC-48 I1.5 的 role 三命令逐字不变

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-32
- **Given** 一个全新项目根
- **When** 我依次执行 `role list`、`role show developer`、`role validate`、`role list --format json`、`role show developer --format json`、`role validate --format json`、`role show researcher`、`role show writer`、`role show researcher --format json`、`role show writer --format json`
- **Then** 六条输出与 I1.5 收口提交 `0cd113b` 的同一条命令输出逐字节相同（唯一允许的差异是用法块所在命令的输出，本 AC 不涉及）
  - 以上六条逐字断言保持不变；以下为 D-7b 授权例外的**追加**断言（只加不减）：
  - `role show researcher` 的「可唤醒」行逐字为 `  可唤醒：writer`、`role show writer` 的「可唤醒」行逐字为 `  可唤醒：editor, reviewer`（按附录 D-7b 对齐后的新值，是 I1.5 逐字红线的**唯一例外两行**）；这两条 show 的其余行仍与 I1.5 逐字节相同
  - `role show researcher --format json` / `role show writer --format json` 的 `role` 对象仍是 `src/cli/roles.js:91-104` `toRoleJson()` 的 10 键（`id`/`name`/`group`/`groupLabel`/`artifactType`/`sideEffect`/`skills`/`maxConcurrentSessions`/`source`/`file`）、**不含** `wake` / `wakeAllow` 字段（show 的 JSON payload 是 `:296-312` 的 `{role, instance, roleInstance}`），故两条 JSON 输出不受两处 `wake_allow` 改动影响、与 I1.5 基线逐字节相同，不写 `['writer']` / `['editor','reviewer']` 之类源码里不存在的字段断言；被改两角色的新值由上面两条文本「可唤醒」行钉住
- **机检：** 六条输出分别与 `docs/iterations/iteration-5/evidence/` 中的基线文本做 `diff`，全部为空；`test/wp11/cli-role.test.js` 全绿
- **机检（D-7b 资产比对）：** `cd "$REPO" && b=$(mktemp) && for f in $(git ls-files assets/); do git show "0cd113b:$f" > "$b" 2>/dev/null || continue; diff "$b" "$f"; done; rm -f "$b"` —— 把当前 `assets/**` 逐文件与 `git show 0cd113b:assets/...` 比对，差异恰好只有 D-7b 授权的两处 `wake_allow` 行（`assets/roles/researcher.yaml` 的 `wake_allow: []` → `wake_allow: [writer]`、`assets/roles/writer.yaml` 的 `wake_allow: [editor]` → `wake_allow: [editor, reviewer]`），其余 `assets/**` 文件与 `0cd113b` 逐字节相同

#### AC-49 三条主链逐字回归

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-33
- **Given** 独立项目根（`%TEMP%/maestro-acc-p6/AC-49/`）+ 仓库内 mock ACP agent，`NODE_ENV=test`
- **When** 依次跑 `single`、`code-loop`、`task-loop` 三条主链
- **Then** 三条都是退出码 0，且终端输出在去掉「已运行 Ns」片段与 `HH:mm:ss` 时间戳后与 `0cd113b` 的基线逐字一致
- **夹具：** `NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root "$ROOT" --scenario <内置场景>`（`task-loop` 用 `task-loop-driver.mjs`；`single` 用 `bin/orch.js run` 直跑）
- **机检：** `sed -E 's/已运行 [0-9]+s//g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}//g'` 归一化后 `diff` 为空；`.mock/prompts/*.json` 的 `task` 文本与基线一致

#### AC-50 全量测试全绿且不低于 611

- 场景类型：回归 ｜ 风险：P0 ｜ 引用：BR-33、BR-34
- **Given** 实现完成后的源码树
- **When** 执行 `node --test --test-concurrency=4 "test/**/*.test.js"`
- **Then** `fail === 0`、`pass === tests`、`tests >= 611`
- **机检：** 用下限断言 `fail === 0 && pass === tests && tests >= 611`，不写死条数；既有断言修改仅限附录 D-7 点名的两行

#### AC-51 架构纯净：无资产名、无游离中文

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-31
- **Given** 实现完成后的源码树
- **When** 按下方「架构检查：」段给出的四条完整命令执行扫描（该段为附录 D-9 的逐字副本）
- **Then** 四条命令都退出 0：前三条输出 `OK: 扫描 N 个文件…零命中`，第四条输出 `OK: no CJK`
- **架构检查：** 以下为附录 D-9 的 `$COMMON` / `$NOCOORD` 词表定义与四条完整命令的逐字副本（D-9 为唯一权威、不得改动），四条都必须退出 0：

  ```bash
  COMMON="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
  NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')

  # 1) 引擎：与 I1.5 完全相同的 31 词
  node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"

  # 2) 注册表实现（含本迭代新增的 workflows/workflow-schema/workflow-plan/contracts/asset-write）：30 词
  node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"

  # 3) 三族命令实现：逐文件扫（labels.js 合法持有资产名，不得整目录扫）
  node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"

  # 4) 新增实现零 CJK（中文唯一来源是 labels.js 与 assets/**）
  node -e "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(/[\u4e00-\u9fff]/.test(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\n'));process.exit(1);}console.log('OK: no CJK');"
  ```

#### AC-52 零运行时依赖

- 场景类型：架构检查 ｜ 风险：P0 ｜ 引用：BR-34
- **Given** 实现完成后的 `package.json`
- **When** 读取 `dependencies`
- **Then** 键数量为 0
- **架构检查：** `node -e "const p=require('./package.json');console.log(Object.keys(p.dependencies ?? {}).length)"` 输出必须是 `0`

#### AC-53 能力域 1 三项顺延落地：一次 role validate 全数报出且同文件多类各一行

- 场景类型：异常路径 ｜ 风险：P0 ｜ 引用：BR-06、BR-12、BR-13、BR-14
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-53/`，无 `.orch`；命令面 AC，只读写项目资产与终端输出，不注入 `NODE_ENV=test`），预置三份坏角色与一条工作流：`c.yaml`（`inputs: [brief]`，被 `.orch/workflows/use-c.yaml` 的入口节点引用，但没有任何边给它 `brief`）、`p.yaml`（`side_effect: read` + `tools: [write]` + `wake_allow: [ghost]`）、`d.yaml`（`derived_from: d`）；三份文件都不缺必填键
- **When** 我执行 `orch role validate`，再执行 `orch role validate --format json`
- **Then** 错误行恰好四条：`- roles/c.yaml：契约不连通：brief 没有来源（ROLE_CONTRACT_UNBOUND）`、`- roles/p.yaml：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）`、`- roles/p.yaml：唤醒白名单里的角色不存在：ghost（ROLE_WAKE_UNKNOWN）`、`- roles/d.yaml：派生链成环：d（ROLE_DERIVE_CYCLE）`，退出码 1；同一文件（`p.yaml`）多类问题各一行、互不吞并，谁先被报由 C-08 的检查顺序固定；命令名、首行文案、计数口径与 I1.5 完全一致
- **机检：** `node "$REPO/bin/orch.js" role validate --format json` 的 `errors.map(e => e.code)` 排序后等于 `['ROLE_CONTRACT_UNBOUND','ROLE_DERIVE_CYCLE','ROLE_PERMISSION_MISMATCH','ROLE_WAKE_UNKNOWN']`、`errors.filter(e => e.file === 'roles/p.yaml').length === 2`、`counts.invalid === 3`

#### AC-54 role create 四个必填参数取值非法是用法错误、不建文件

- 场景类型：异常路径 ｜ 风险：P1 ｜ 引用：BR-03、BR-07、BR-38
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-54/`，无 `.orch`）
- **When** 我依次执行 `orch role create lead-dev --name 首席开发 --group nope --artifact-type code --side-effect write`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type doc --side-effect write`、`orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect heavy`
- **Then** 三次都打印 25 行用法块并各追加一行 `  （<原因>）`（A-12 的用法错误句式，合计 26 行），其中 `--group` 那条逐字为 `  （role create 的 --group 只接受 通用协调/研究分析/内容创作/编码工程/业务运营）`，另两条同句式、各自列出合法取值；三次退出码都是 2，且都没有建文件
- **机检：** 三次退出码均为 2；`test -e "$ROOT/.orch"` 为假；`node "$REPO/bin/orch.js" role bogus` 输出的用法块行数恒为 25

#### AC-55 导入非角色文件被拒且不落盘

- 场景类型：异常路径 ｜ 风险：P0 ｜ 引用：BR-07、BR-10、BR-12
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-55/`，无 `.orch`），预置 `not-role.yaml`（缺 `schema` 的一段 YAML）与 `wrong-schema.yaml`（`schema: workflow/v1`）
- **When** 我执行 `orch role import not-role.yaml`，再执行 `orch role import wrong-schema.yaml`
- **Then** 两次都只回一行 `导入被拒：缺少必填字段：schema（ROLE_SCHEMA_MISSING）`，退出码都是 1；`import` 只装单个文件，两次都没有在 `.orch/roles/` 下留下任何文件
- **机检：** 两次退出码 1；`test -e "$ROOT/.orch/roles/not-role.yaml"` 与 `test -e "$ROOT/.orch/roles/wrong-schema.yaml"` 都为假；`node "$REPO/bin/orch.js" role list --format json` 的 `counts.total === 16`

#### AC-56 role edit 的 --set / --unset 用法错误不改动文件

- 场景类型：异常路径 ｜ 风险：P1 ｜ 引用：BR-02、BR-07
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-56/`，无 `.orch`），先执行 `orch role create lead-dev --name 首席开发 --group coding --artifact-type code --side-effect write --skills code-change,test-run` 建出 `lead-dev`（三条路径产出的都是普通项目角色文件，`edit` 对它一视同仁）
- **When** 我依次执行 `orch role edit lead-dev --set nope=1`、`orch role edit lead-dev --unset name`、`orch role edit lead-dev --set artifact_type=document --unset summary`
- **Then** 第一次打印用法块并追加 `  （未知字段：nope）`、退出码 2、文件内容不变；第二次追加 `  （role edit 不能删除必填字段：name）`、退出码 2、文件内容不变；第三次成功、退出 0，回四行（含 `（已按规范格式重写，注释不保留）`），`orch role show lead-dev` 的产物类型变 `document`、职责行变空
- **机检：** 前两次退出码 2、`grep -c 'nope:' "$ROOT/.orch/roles/lead-dev.yaml"` 为 0；第三次后 `grep -c 'artifact_type: document' "$ROOT/.orch/roles/lead-dev.yaml"` 为 1、`grep -c 'summary:'` 为 0

#### AC-57 改不存在的角色与 diff 缺对比基线

- 场景类型：异常路径 ｜ 风险：P1 ｜ 引用：BR-11、BR-37
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-57/`，无 `.orch`），预置 `.orch/roles/my-role.yaml`（合法角色，id `my-role`，无同名内置角色）与 `.orch/workflows/my-wf.yaml`（合法工作流，id `my-wf`，无同名内置工作流）
- **When** 我依次执行 `orch role edit ghost-id --set summary=x`、`orch role diff my-role`、`orch workflow diff my-wf`、`orch role diff my-role --against developer`
- **Then** 第一次回 `找不到角色：ghost-id` 与 `可用角色：执行 orch role list 查看`、退出 1；第二、三次分别回 `缺少对比基线：my-role（用 --against 指定内置角色或文件）` 与 `缺少对比基线：my-wf（用 --against 指定内置工作流或文件）`、退出 1；第四次按 §2.4 / BR-11 的**角色 `diff`** 口径（忽略 `id`，`name` 与其余键全比，缺省键按缺省值比较）给出 `差异 N 项` 或 `无差异`、退出 0
- **机检：** 前三次退出码 1；`node "$REPO/bin/orch.js" role diff my-role --against developer --format json` 顶层键恰 `base`/`target`/`changes`，`changes` 中不存在 `field === 'id'` 的项；若 `changes` 中存在 `field === 'name'` 的项，其 `base` / `target` 值须分别等于内置 `developer` 资产与 `.orch/roles/my-role.yaml` 里的 `name` 字段（按附录 A-14 的 `changes[]` 四键结构核对，为净增的正向断言，只增不减）；且文本末行的 N 仍等于 `changes.length`

#### AC-58 内置资产只读：导入 / 创建 / --force 都不动内置

- 场景类型：异常路径 ｜ 风险：P0 ｜ 引用：BR-01、BR-08、BR-09、BR-10
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-58/`，无 `.orch`），预置 `developer.yaml`（一份 `id: developer` 的合法角色文件）与项目技能 `.orch/skills/quote/SKILL.md`；执行前记录 `assets/**` 的 `sha256` 清单
- **When** 我依次执行 `orch role import developer.yaml`、`orch skill create code-change --name 冒名 --summary 占位 --force`、`orch skill create quote --name 冒名 --summary 占位`、`orch skill create quote --name 冒名 --summary 占位 --force`
- **Then** 第一次回 `导入被拒：内置角色只读：developer（ASSET_READONLY）`、退出 1；第二次回 `创建被拒：内置技能只读：code-change（ASSET_READONLY）`、退出 1（`--force` 也不豁免内置）；第三次回 `已存在同名项目技能：.orch/skills/quote/SKILL.md（加 --force 覆盖）`、退出 1、文件不变；第四次成功、退出 0（契约行 + `校验：通过`），`--force` 只覆盖项目里的同名资产；四次后 `assets/**` 一个字节都没变
- **机检：** 前三次退出码 1、第四次退出码 0；`git status --porcelain assets` 为空；`find assets -type f -exec sha256sum {} +` 前后逐字相同；第二次执行后 `test -e "$ROOT/.orch/skills/code-change/SKILL.md"` 为假

#### AC-59 skill create 的 --applies-to / --commands / --body-file 与取值错误口径

- 场景类型：正常路径 ｜ 风险：P1 ｜ 引用：BR-07、BR-15、BR-16
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-59/`，无 `.orch`），预置 `body.md`（一段技能正文）与 `empty.md`（空文件）
- **When** 我依次执行 `orch skill create quote --name 引用规范 --summary 给结论配上可核对的出处 --applies-to writing,review --commands "node --test" --body-file body.md`、`orch skill create quote2 --name 坏组 --summary x --applies-to nope`、`orch skill create quote3 --name 缺摘要 --body-file empty.md`、`orch skill create quote4 --name 空正文 --summary x --body-file empty.md`
- **Then** 第一次回 `已创建项目技能：.orch/skills/quote/SKILL.md` + 契约行 + `校验：通过`、退出 0，`orch skill show quote` 的「命令」行是 `node --test`、「适用」行含两个分组、正文是 `body.md` 的内容；第二次打印用法块 + 一行取值原因、退出 2、不建文件（取值非法属用法错误）；第三次打印用法块 + `  （skill create 需要 --summary）`、退出 2、不建文件；第四次回 `创建被拒：技能正文为空：quote4（SKILL_BODY_EMPTY）`、退出 1、不建文件（资产问题退 1）
- **机检：** 第一次后 `grep -c 'node --test' "$ROOT/.orch/skills/quote/SKILL.md"` 为 1、`node "$REPO/bin/orch.js" skill validate --format json` 的 `counts.invalid === 0`；第二、三、四次退出码分别为 2 / 2 / 1，且 `test -e "$ROOT/.orch/skills/quote2/SKILL.md"`、`test -e "$ROOT/.orch/skills/quote3/SKILL.md"`、`test -e "$ROOT/.orch/skills/quote4/SKILL.md"` 都为假

#### AC-60 工作流校验器补充面：变量引用 / 状态转换 / 唤醒权限

- 场景类型：异常路径 ｜ 风险：P1 ｜ 引用：BR-24、BR-25、BR-26、BR-39
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-60/`，无 `.orch`），预置四条工作流：`task-var.yaml`（映射 `from: task.brief`）、`backflow-target.yaml`（`kind: backflow` 指向 `human` 节点）、`wake-empty.yaml`（源角色 `wake_allow: []`，有一条 `forward` 边指向 `role` 节点）、`retest-ok.yaml`（`kind: retest` 指向 `role` 节点，白名单为空）
- **When** 我依次执行 `orch workflow validate task-var`、`orch workflow validate backflow-target`、`orch workflow validate wake-empty`、`orch workflow validate retest-ok`
- **Then** 第一次 `校验工作流 1 个：全部通过`（`task.<字段>` 作任务输入恒合法，字段映射完整）；第二次报 `WORKFLOW_TRANSITION_ILLEGAL`、明细为 `{node} 不能成为回流目标`；第三次报 `WORKFLOW_WAKE_DENIED`（`wake_allow: []` = 不允许主动唤醒任何角色）；第四次 `校验工作流 1 个：全部通过`（`backflow` / `retest` 由核心回流触发、不受白名单约束，但目标必须是 `role` 节点）
- **机检：** 四次 `counts.invalid` 分别为 `0` / `1` / `1` / `0`；第二次 `errors[0].code === 'WORKFLOW_TRANSITION_ILLEGAL'`、`errors[0].detail` 含 `回流目标`；第三次 `errors[0].code === 'WORKFLOW_WAKE_DENIED'`、`errors[0].detail` 含 `白名单`

#### AC-61 三条内置工作流回归门禁：invalid=0，资产被改坏时先红

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-20、BR-26、BR-39、BR-41
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-61/`，无 `.orch`，只有内置三图），对齐后的 `assets/roles/researcher.yaml` 为 `wake_allow: [writer]`、`assets/roles/writer.yaml` 为 `wake_allow: [editor, reviewer]`（附录 D-7b）
- **When** 我执行 `orch workflow validate` 与 `orch workflow validate --format json`；随后把 `assets/roles/writer.yaml` 的 `wake_allow` 改回 `[editor]`，再执行一次 `orch workflow validate`（验完立即还原）
- **Then** 前两次都是 `校验工作流 3 个：全部通过`、退出 0；第三次变红：`校验工作流 3 个：1 个不合法` 与一行 `唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）`（按 A-9 的 `内置 <id>` 句式、`内置 ` 前缀参与排序）、退出 1
- **机检：** 对齐后 `node "$REPO/bin/orch.js" workflow validate --format json` 的 `counts.invalid === 0`、`counts.assets === 3`、`counts.builtin === 3`、`errors` 为空；改回后 `counts.invalid === 1`、`errors[0].code === 'WORKFLOW_WAKE_DENIED'`、`errors[0].file` 以 `内置 ` 开头、`errors[0].detail` 含 `writer → reviewer`

#### AC-62 node_type 四类取值异常与子工作流引用 / 跨工作流环

- 场景类型：异常路径 ｜ 风险：P1 ｜ 引用：BR-19、BR-36
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-62/`，无 `.orch`），预置 `bad-type.yaml`（`node_type: script`）、`esc-no-title.yaml`（`node_type: escalate` 缺 `title`）、`sub-no-wf.yaml`（`node_type: subworkflow` 缺 `workflow`）、`sub-ghost.yaml`（`node_type: subworkflow` + `workflow: ghost`）、`sub-a.yaml` / `sub-b.yaml`（`sub-a` 引用 `sub-b`、`sub-b` 引用 `sub-a`，跨工作流成环）
- **When** 我执行 `orch workflow validate` 与 `orch workflow validate --format json`
- **Then** 四类原因码各至少一行：`WORKFLOW_NODE_TYPE_INVALID`（明细逐字含 `节点类型取值非法：script；合法取值：role / human / escalate / subworkflow`）、`WORKFLOW_NODE_FIELD_MISSING`（明细含 `title` 与 `workflow`）、`WORKFLOW_SUB_UNKNOWN`（明细含 `ghost`）、`WORKFLOW_SUB_CYCLE`（明细给出 `sub-a` / `sub-b` 的环），退出 1；同一原因码在同一文件只报第一条，报哪一条由 C-09 的 ①~⑬ 顺序固定
- **机检：** `errors.map(e => e.code)` 去重后含 `WORKFLOW_NODE_TYPE_INVALID` / `WORKFLOW_NODE_FIELD_MISSING` / `WORKFLOW_SUB_UNKNOWN` / `WORKFLOW_SUB_CYCLE`；`errors[0].file === 'workflows/bad-type.yaml'`（按文件名字典序）、`errors[0].detail` 含 `合法取值：role / human / escalate / subworkflow`

#### AC-63 11 项完整原语逐项可表达且逐项可见

- 场景类型：正常路径 ｜ 风险：P0 ｜ 引用：BR-19、BR-20、BR-27、BR-35
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-63/`，无 `.orch`），预置附录 A-1 / A-13 的 `doc-fanout`（统一按 11 项枚举：顺序、并行 fan-out/fan-in（算 1 项）、条件分支、回流循环、轮次上限、超时、重试、人工节点、子工作流、升级、终止；字段映射按能力域 2 单列）
- **When** 我执行 `orch workflow validate doc-fanout`、`orch workflow dry-run doc-fanout`，再执行 `orch workflow show code-loop`
- **Then** 校验 `校验工作流 4 个：全部通过`、退出 0；预演首行逐字为 `编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流`，11 项原语逐项可见：顺序（层 1/3/4/5）、并行 fan-out/fan-in（层 2 并行组一行）、条件分支（`条件分支：` 三行）、超时 / 重试（`- T-001 超时 600s · 重试 2`）、人工节点（`3. T-004 人工确认（人工节点）`）、子工作流（`4. T-006 代码闭环（子工作流 code-loop · 2 节点）`）、升级（`5. T-005 升级（升级节点）`）、终止（升级终点），回流循环与轮次上限在 `orch workflow show code-loop` 的 `    T-002 → T-001 回流 · 轮次上限 2` 一行可见；末行 `结论：编排可执行，未启动任何会话`
- **机检：** `node "$REPO/bin/orch.js" workflow dry-run doc-fanout --format json` 的 `layers` / `branches` / `mappings` / `policies` 四段齐全，`nodeCount === 6`、`edgeCount === 7`；预演文本中 `1 个子工作流` 出现 1 次且层行 `4. T-006 代码闭环（子工作流 code-loop · 2 节点）` 存在；`node "$REPO/bin/orch.js" workflow show code-loop --format json` 的 `edges[1].kind === 'backflow'`、`nodes` 中存在 `maxRounds === 2`；`counts.invalid === 0`；预演文本的并行组行显示 `汇合：all`（`join` 缺省 `all` 时 fan-in 的汇合条件用户可见，F-19）

#### AC-64 可达性终态定义：human / escalate 也是终点

- 场景类型：边界 ｜ 风险：P0 ｜ 引用：BR-21、BR-35、BR-36
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-64/`，无 `.orch`），预置 `human-end.yaml`（`entry: T-001` → `T-END`（`role`，`terminal: T-END`）与 → `T-H`（`human`，无出边））、`escalate-end.yaml`（同结构、把 `T-H` 换成 `escalate` 节点 `T-E`）、`no-end.yaml`（把 `T-H` / `T-E` 换成普通 `role` 节点 `T-R`，无出边且不在 `terminal`）；三条工作流所有节点都从入口可达
- **When** 我依次执行 `orch workflow validate human-end`、`orch workflow validate escalate-end`、`orch workflow validate no-end`
- **Then** 前两次都是 `校验工作流 1 个：全部通过`、退出 0（`human` / `escalate` 天然是终态，流程可以停在这两类节点上）；第三次报 `WORKFLOW_UNREACHABLE`，明细为 `节点不可达：T-R`，退出 1
- **机检：** 前两次 `counts.invalid === 0`；第三次 `errors[0].code === 'WORKFLOW_UNREACHABLE'`、`errors[0].detail` 含 `T-R`；`node "$REPO/bin/orch.js" workflow show human-end --format json` 的 `nodes` 里 `T-H` 的 `nodeType === 'human'`

#### AC-65 校验顺序与错误排序固定（BR-40）

- 场景类型：边界 ｜ 风险：P1 ｜ 引用：BR-20、BR-40
- **Given** 一个独立项目根（`%TEMP%/maestro-acc-p6/AC-65/`，无 `.orch`），预置 `bad-type.yaml`（`node_type: script`）与 `wake.yaml`（一条 `forward` 边的源角色白名单不含目标角色），内置三图按附录 D-7b 对齐后合法
- **When** 我连续两次执行 `orch workflow validate --format json`，再执行 `orch workflow validate`（文本）
- **Then** 文本首行逐字为 `校验工作流 5 个：2 个不合法`，随后两行按「文件名字典序 + 同文件内 C-09 ①~⑬ 顺序」固定：第一条逐字是 `- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）`，随后是 `- workflows/wake.yaml：…（WORKFLOW_WAKE_DENIED）`，退出 1；两次 JSON 输出逐字节相同，第一条错误不依赖实现的遍历巧合
- **机检：** `node "$REPO/bin/orch.js" workflow validate --format json` 连续两次经 `sha256sum` 结果相同；`errors.map(e => e.file + ':' + e.code)` 等于 `['workflows/bad-type.yaml:WORKFLOW_NODE_TYPE_INVALID','workflows/wake.yaml:WORKFLOW_WAKE_DENIED']`；`errors[0].code === 'WORKFLOW_NODE_TYPE_INVALID'`、`counts.assets === 5`、`counts.invalid === 2`

### 3.2 非功能验收标准

| # | 场景 | 目标（用户可感知的口径） |
|---|---|---|
| NFR-01 | 20 个节点、30 条边的项目工作流，`orch workflow validate` | 2 秒内给出结论并回到提示符 |
| NFR-02 | 同一个 20 节点工作流，`orch workflow dry-run` | 2 秒内打印完最后一行 `结论：…` |
| NFR-03 | 项目里放 100 个合法角色文件 | `orch role list` 2 秒内出首行，不因文件数明显变慢 |
| NFR-04 | 同一输入连续执行两次任何只读命令（含 `dry-run`） | 两次输出逐字节相同 |
| NFR-05 | `orch role create` / `skill create` / `workflow create` 的成功路径 | 命令返回时文件已落盘可读，且不会有半成品文件残留（`*.tmp` 一律不存在） |
| NFR-06 | 回归 | 三条主链输出不变；全量测试 `fail === 0` 且 `tests >= 611` |
| NFR-07 | 依赖与联网 | 不新增运行时依赖；全部资产命令离线可用 |

### 3.3 验收前置条件

1. Node ≥ 22（本机 v22.24.0 或更高）与 Git Bash；`$REPO` 为仓库根，`orch` 一律写作 `node "$REPO/bin/orch.js"`（`npm link` 后可直接用 `orch`）。
2. 每个 AC 使用全新临时项目根 `%TEMP%/maestro-acc-p6/<AC 编号>/`；开始前 `.orch` 不含任何资产，需要预置的由该 AC 自己写入，写好后不再改动（AC-04、AC-05、AC-09 属「先建后改」，其前后两段各自保持稳定）。
3. **65 条 AC 按面分组，每组的前置条件如下**（除第 4 ~ 7 条另述的特例外，全部不需要宿主、不需要 `NODE_ENV=test`，只读写项目根下的资产文件与终端输出）：
   - **命令面**（AC-01 ~ AC-10、AC-16 ~ AC-23、AC-39 ~ AC-48、AC-53 ~ AC-59）：直接调用 `role` / `skill` / `workflow` 三族命令；前置是「全新临时项目根 + 需预置的资产由该 AC 自己写入」，判定依据是终端输出与 `.orch` 下的文件。
   - **校验器面**（AC-11 ~ AC-14、AC-24 ~ AC-38、AC-60 ~ AC-62、AC-64 ~ AC-65）：以 `role validate` / `workflow validate` 的原因码、C-08 / C-09 检查顺序与 `--format json` 计数为核心；前置是全新项目根 + 该 AC 预置的坏资产，全部是静态资产判定、同样不碰宿主（AC-11 ~ AC-14 只是预置坏资产的角色校验用例）。
   - **回归与门禁面**（AC-15、AC-49 ~ AC-52、AC-63）：I1.5 逐字回归、全量测试、架构纯净 / 零依赖扫描、11 项原语与内置三图门禁；AC-49 / AC-50 的 `NODE_ENV=test`、基线 worktree 与夹具按第 4、5 条，AC-51 / AC-52 的架构扫描按第 7 条，需「执行前后字节对比」的 AC-15 / AC-45 / AC-46 / AC-48 按第 6 条。
4. **第 3 条各面的特例**（AC-49 / AC-50 均属回归与门禁面，不另设面名；AC-50 为全量测试）使用仓库内 `test/fixtures/mock-acp-agent.js` 与 `*-driver.mjs`，必须注入 `NODE_ENV=test`；项目根放在 `%TEMP%` 下，**绝不放仓库内**。
5. AC-49 的基线取自 `0cd113b` 的同一命令输出（`git worktree add --detach 0cd113b` 挂基线树，用 `git -c core.autocrlf=false` 避免 CRLF 干扰），比对前按 AC-49 给的两条 `sed` 归一化。
6. 需要「执行前后对比字节」的 AC（AC-15、AC-45、AC-46、AC-48）先求 `sha256` 清单再执行，比对时逐行 diff。
7. 架构检查类 AC（AC-51、AC-52）只用仓库内 `test/fixtures/purity-check.mjs` 与 `node -e`，不引入新工具。
8. 所有 AC 的 Given 都可由本文件给出的步骤构造；不存在「历史会话恰好空闲」这类不可构造的前置状态——本迭代的验收面全部是**静态资产与终端输出**。
9. Windows 下用 Git Bash 或等价 shell；本文命令以 POSIX shell 书写；「2 秒内」在负载正常的机器上判定，允许同一次运行内比较。

---

## 附录 A 输出基线（**唯一**，AC-01 ~ AC-48 中涉及命令输出的判定依据）

> 既有基线（I1.1 §3、I1.2 A-1~A-4、I1.3 A-1~A-4、I1.5 A-1~A-7）继续有效。本附录只登记**新增**输出；未登记的输出不得改动。

### A-1 新增资产的字段口径

**角色文件新增可选键**：`derived_from`（字符串，角色 id）。其余键与 I1.5 A-1 完全一致，26 个内置资产一个字节不改。

**工作流文件（`workflow/v1`）**

```yaml
schema: workflow/v1
id: doc-fanout
name: 文档并行版
summary: 研究后两人并行撰写，汇总后人工确认
entry: T-001
terminal: T-006
nodes:
  - id: T-001
    node_type: role
    role: researcher
    title: 研究
    timeout: 600
    retry: 2
    outputs: [research.notes]
  - id: T-002
    node_type: role
    role: writer
    title: 撰写A
    parallel_scope: draft
    scope: draft-a
    inputs: [brief]
  - id: T-003
    node_type: role
    role: editor
    title: 撰写B
    parallel_scope: draft
    scope: draft-b
    inputs: [brief]
  - id: T-004
    node_type: human
    title: 人工确认
  - id: T-005
    node_type: escalate
    title: 升级
  - id: T-006
    node_type: subworkflow
    workflow: code-loop
    title: 代码闭环
edges:
  - from: T-001
    to: T-002
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-001
    to: T-003
    map:
      - from: T-001.research.notes
        to: brief
  - from: T-002
    to: T-004
  - from: T-003
    to: T-004
  - from: T-004
    to: T-006
    when: human_approved
  - from: T-004
    to: T-005
    when: human_rejected
  - from: T-006
    to: T-005
    when: failed
```

**必填键**：`schema`（固定 `workflow/v1`）、`id`、`name`、`entry`、`terminal`、`nodes`（非空数组）。
**可选键**：`summary`、`edges`（缺省为空数组）。

**节点必填**：`id`、`node_type`。**按类型追加**：`role` 需 `role`；`human` 需 `title`；`escalate` 需 `title`；`subworkflow` 需 `workflow`。
**节点可选**：`title`、`timeout`（1~86400 的整数）、`retry`（0~5 的整数）、`max_rounds`（1~9 的整数）、`parallel_scope`（并行组名）、`scope`（产物作用域，缺省 = 节点 id）、`inputs`、`outputs`（字符串数组）。

**边必填**：`from`、`to`。**可选**：`kind`（`forward` / `backflow` / `retest`，缺省 `forward`）、`when`（`always` / `passed` / `failed` / `human_approved` / `human_rejected`，缺省 `always`）、`join`（`all` / `any`，缺省 `all`）、`map`（`{from, to}` 列表）。

`join` 决定 fan-in 的汇合条件，`dry-run` 的并行组行会显示 `汇合：all` 或 `汇合：any`。

### A-2 `orch role create`

成功：

```
已创建项目角色：.orch/roles/lead-dev.yaml
- lead-dev 首席开发 · 编码工程 · code · write · 技能 2 · 并发 1
校验：通过
```

被拒（只印一行）：

```
创建被拒：引用的技能不存在：no-such（ROLE_SKILL_NOT_FOUND）
```

已存在：

```
已存在同名项目角色：.orch/roles/lead-dev.yaml（加 --force 覆盖）
```

### A-3 `orch role edit`

```
已更新项目角色：.orch/roles/lead-dev.yaml
- lead-dev 首席开发 · 编码工程 · document · write · 技能 2 · 并发 1
校验：通过
（已按规范格式重写，注释不保留）
```

内置角色：

```
内置角色不可编辑：先 orch role create <新角色> --from developer
```

被拒（不写回）：

```
编辑被拒：副作用等级为 read 的角色不能带写工具 write（ROLE_PERMISSION_MISMATCH）
```

### A-4 `orch role export` / `orch role import`

`export` 带 `--out`：`已导出角色 lead-dev 到 exports/lead-dev.yaml`；不带 `--out` 时 stdout 只有文件正文（以 `schema: role/v1` 开头）。

`import` 成功：

```
已安装项目角色：.orch/roles/lead-dev.yaml
校验：通过
```

`import` 被拒：`导入被拒：<明细>（<原因码>）` / `已存在同名项目角色：<路径>（加 --force 覆盖）` / `导入被拒：文件不存在：<路径>`。

### A-5 `orch role diff`

```
对比角色 <id>（项目）与基线 <id>（内置）
+ derived_from：developer
~ name：开发 → 开发（派生）
~ skills：code-change, test-run → test-run
差异 3 项
```

- 差异行前缀：`+` 仅目标有 / `-` 仅基线有 / `~` 两边不同。
- 无差异时第 2 行是 `无差异`（没有差异行）。
- 数组值按 `a, b` 拼接；空数组写 `—`；`null` 写 `—`。

### A-6 `orch skill list` / `orch skill show`

`list`：

```
技能 10 个（内置 10 · 项目 0）
- code-change 代码修改 · 编码工程 · 命令 1
- code-review 代码审查 · 编码工程 · 命令 0
```

行格式固定 `- <id> <名称> · <适用组|—> · 命令 <n>`；多组用 `, ` 连接；有坏资产时末行 `N 个资产未通过校验，执行 orch skill validate 查看`。

`show`：

```
- code-change 代码修改 · 编码工程 · 命令 1
  摘要：定位到要改的文件，做最小改动，并写清改了什么
  命令：node --test
  适用：编码工程
  来源：内置 assets/skills/code-change/SKILL.md
  正文：
  ### 工作方法
```

正文每行前加两个空格；正文开头的空行跳过。

### A-7 `orch skill create` / `validate` / `export` / `import`

`create`：

```
已创建项目技能：.orch/skills/quote/SKILL.md
- quote 引用规范 · 内容创作 · 命令 0
校验：通过
```

不给 `--body-file` 时的默认正文（逐字）：

```
### 工作方法

1. 按任务要求完成本技能覆盖的工作，并在结果里写清做了什么。
```

`validate`：`校验技能 <N> 个：全部通过` / `校验技能 <N> 个：<M> 个不合法` + `- <相对路径>：<明细>（<原因码>）`（相对资产根，项目写 `skills/<id>/SKILL.md`，内置写 `assets/skills/<id>/SKILL.md`）。

`export`：`已导出技能 <id> 到 <路径>`（不带 `--out` 时 stdout 为 SKILL.md 正文）。

`import`：`已安装项目技能：<路径>` + `校验：通过`；被拒同 A-4 的句式。

### A-8 `orch workflow list` / `orch workflow show`

`list`：

```
工作流 3 个（内置 3 · 项目 0）
- code-loop 编码闭环 · 2 节点 · 3 边 · 内置
- single 单节点 · 1 节点 · 0 边 · 内置
- task-loop 通用任务闭环 · 3 节点 · 4 边 · 内置
```

行格式 `- <id> <名称> · <节点> 节点 · <边> 边 · <内置|项目>`；有坏资产时末行 `N 个工作流未通过校验，执行 orch workflow validate 查看`。

`show`：

```
- code-loop 编码闭环 · 2 节点 · 3 边 · 内置
  入口：T-001 · 终点：T-002
  节点：
    T-001 开发 · 角色节点 developer · 超时 — · 重试 0
    T-002 测试 · 角色节点 tester · 超时 — · 重试 0
  边：
    T-001 → T-002 正向
    T-002 → T-001 回流 · 轮次上限 2
    T-001 → T-002 复测
```

- 节点行 `    <id> <标题> · <类型文案> · 超时 <n>s|— · 重试 <n>`；类型文案为 `角色节点 <role>` / `人工节点` / `升级节点` / `子工作流 <id> · <n> 节点`。
- 边行 `    <from> → <to> <方向>`，方向为 `正向` / `回流` / `复测`；回边追 ` · 轮次上限 <n>`（无上限时 ` · 轮次上限 —`）；`when` 非 `always` 时追 ` · 条件 <条件名>`；有映射时追 ` · 字段映射 <n> 条`。

`create`：

```
已创建项目工作流：.orch/workflows/fork.yaml
校验：通过
```

被拒同 A-2 / A-4 的句式：`创建被拒：<明细>（<原因码>）` / `已存在同名项目工作流：<路径>（加 --force 覆盖）`。

### A-9 `orch workflow validate`

```
校验工作流 3 个：全部通过
```

有坏资产：

```
校验工作流 5 个：2 个不合法
- workflows/bad-type.yaml：节点类型取值非法：script；合法取值：role / human / escalate / subworkflow（WORKFLOW_NODE_TYPE_INVALID）
- 内置 wake：唤醒不在白名单内：writer → reviewer（WORKFLOW_WAKE_DENIED）
```

- 行格式 `- <相对路径>：<明细>（<原因码>）`；项目写 `workflows/<id>.yaml`，内置写 `内置 <id>`。
- 明细按文件名字典序；`内置` 行排在同一字典序位置（以 `内置 ` 前缀参与排序）。

### A-10 `orch workflow dry-run`

```
编排计划 doc-fanout · 6 节点 · 7 边 · 1 个并行组 · 1 个子工作流
1. T-001 研究（角色节点 researcher）
2. 并行组 draft：T-002 撰写A（角色节点 writer）｜ T-003 撰写B（角色节点 editor） · 汇合：all
3. T-004 人工确认（人工节点）
4. T-006 代码闭环（子工作流 code-loop · 2 节点）
5. T-005 升级（升级节点）
条件分支：
- T-004 → T-006 当 人工通过
- T-004 → T-005 当 人工驳回
- T-006 → T-005 当 判定不通过
字段映射：
- T-001.research.notes → T-002.brief
- T-001.research.notes → T-003.brief
超时与重试：
- T-001 超时 600s · 重试 2
结论：编排可执行，未启动任何会话
```

- 首行 `编排计划 <id> · <N> 节点 · <M> 边 · <K> 个并行组 · <S> 个子工作流`（K/S 为 0 时仍写 `0 个并行组` / `0 个子工作流`）。
- 层行：`<层号>. <单节点描述>` 或 `<层号>. 并行组 <名>：<节点描述>｜ <节点描述>`；并行组层行**段尾固定带 ` · 汇合：all|any`**（`join` 的取值，缺省 `all`；`join` 语义见 A-1）；单节点描述 `T-00X <标题>（<类型文案>）`，类型文案同 A-8。
- 三段小标题固定：`条件分支：`、`字段映射：`、`超时与重试：`；某段为空时整段（含标题）不打印。
- 条件名中文映射：`passed` → `判定通过`、`failed` → `判定不通过`、`human_approved` → `人工通过`、`human_rejected` → `人工驳回`。
- 末行 `结论：编排可执行，未启动任何会话`；有提醒时 `结论：编排可执行，有 <n> 条提醒，未启动任何会话`。
- 被拒：`预演被拒：<第一条明细>（<原因码>）` + `执行 orch workflow validate 查看全部问题`，退出 1。

### A-11 `orch workflow diff`

```
对比工作流 fork（项目）与基线 code-loop（内置）
~ nodes[0].title：开发 → 开发（改）
差异 1 项
```

- 字段路径口径：顶层键写其键名（`name` 按 BR-37 不属于比对范围、不产生 `~ name` 差异行，此处仅示例字段路径写法），节点写 `nodes[<下标>].<键>`，边写 `edges[<下标>].<键>`，映射写 `nodes[<下标>].map[<j>]`。
- 无差异时第 2 行 `无差异`；缺基线时 `缺少对比基线：<id>（用 --against 指定内置工作流或文件）`、退出 1。

### A-12 用法块（25 行）

```
用法：orch run|status|cancel|core
  orch run --cwd <目录> --task <说明> [--instance <实例号>] [--template <名字>] [--host <宿主>]
  orch status [--instance <实例号>] [--events]
  orch cancel --instance <实例号>
  orch core stop
  orch role list [--group <组>] [--instance <实例号>] [--format text|json]
  orch role show <角色> [--instance <实例号>] [--format text|json]
  orch role validate [<角色>] [--format json]
  orch role create <角色> [--from <角色>] --name <中文名|继承> --group <组|继承> --artifact-type <类型|继承> --side-effect <等级|继承> [--summary <摘要>] [--skills <a,b>] [--tools <a,b>] [--wake-allow <a,b>] [--max-concurrent <1-5>] [--force]
  orch role edit <角色> [--set <键=值>]... [--unset <键>]...
  orch role export <角色> [--out <文件>]
  orch role import <文件> [--force]
  orch role diff <角色> [--against <内置角色|文件>] [--format text|json]
  orch skill list [--group <组>] [--format text|json]
  orch skill show <技能> [--format text|json]
  orch skill create <技能> --name <中文名> --summary <摘要> [--applies-to <a,b>] [--commands <命令>] [--body-file <文件>] [--force]
  orch skill validate [<技能>] [--format json]
  orch skill export <技能> [--out <文件>]
  orch skill import <文件|目录> [--force]
  orch workflow list [--format text|json]
  orch workflow show <工作流> [--format text|json]
  orch workflow create <工作流> --name <中文名> [--from <工作流>] [--force]
  orch workflow validate [<工作流>] [--format json]
  orch workflow diff <工作流> [--against <内置工作流|文件>] [--format text|json]
  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]
```

用法错误时在末行后追加一行 `  （<原因>）`，合计 26 行。

`role create` 的四个参数按两档口径判定（BR-38、AC-04）：**没有 `--from`** 时 `--name` / `--group` / `--artifact-type` / `--side-effect` 四项必填，缺一即用法错误（退出码 2、不建文件）；**给了 `--from`** 时四项都可省，省略时 `--group` / `--artifact-type` / `--side-effect` 继承来源、`--name` 用「<来源中文名>（派生）」，四项全省略也能建出合法角色。用法行里的 `|继承` 只在给了 `--from` 时生效。

### A-13 夹具工作流全文（`doc-fanout`，AC-24、AC-27 ~ AC-38 复用）

即 A-1 中的 `doc-fanout` 全文，逐字使用（AC-24 ~ AC-42 全部复用它）。

### A-14 JSON 结构

**`role diff --format json`**：顶层恰三键 `base` / `target` / `changes`；`changes[]` 恰四键 `field` / `kind`（`added` / `removed` / `changed`）/ `base` / `target`。

**`skill list --format json`**：顶层恰两键 `counts`（4 键 `total`/`builtin`/`project`/`invalid`）与 `skills`；技能对象恰 7 键 `id`/`name`/`appliesTo`/`appliesToLabels`/`commands`/`source`/`file`。

**`skill show --format json`**：顶层恰两键 `skill`（同上 7 键）与 `body`（字符串）。

**`skill validate --format json`**：顶层恰两键 `counts`（恰 5 键 `assets`/`skills`/`builtin`/`project`/`invalid`）与 `errors`（同 A-13 的 6 键结构，`scope` 恒为 `skill`）。

**`workflow list --format json`**：顶层恰两键 `counts`（`total`/`builtin`/`project`/`invalid`）与 `workflows`；工作流对象恰 6 键 `id`/`name`/`nodeCount`/`edgeCount`/`source`/`file`（内置 `file` 为 `null`）。

**`workflow show --format json`**：顶层恰三键 `workflow`（同 6 键 + `entry` + `terminal`）/ `nodes` / `edges`；节点对象恰 11 键 `id`/`nodeType`/`role`/`title`/`timeout`/`retry`/`maxRounds`/`parallelScope`/`scope`/`inputs`/`outputs`；边对象恰 5 键 `from`/`to`/`kind`/`when`/`map`。

**`workflow validate --format json`**：顶层恰两键 `counts`（`assets`/`builtin`/`project`/`invalid`）与 `errors`（6 键，`scope` 恒为 `workflow`）。

**`workflow dry-run --format json`**：顶层恰 8 键 `id`/`name`/`nodeCount`/`edgeCount`/`layers`/`branches`/`mappings`/`policies`；不含 `warnings` 时不输出该键。`layers[]` 恰 2 键 `parallel`/`nodes`；`branches[]` 恰 3 键 `from`/`to`/`when`；`mappings[]` 恰 3 键 `from`/`to`/`edge`；`policies[]` 恰 3 键 `nodeId`/`timeout`/`retry`。

### A-15 新增原因码与退出码

| 原因码 | 明细模板 | 属于 |
|---|---|---|
| `ROLE_TOOL_UNKNOWN` | `工具取值非法：{value}；合法取值：read / write / edit / bash` | 角色 |
| `ROLE_PERMISSION_MISMATCH` | `{reason}`（三条固定句：`副作用等级为 read 的角色不能带写工具 {tool}` / `副作用等级为 exec 的角色必须带能执行命令的工具 bash` / `副作用等级为 none 的角色不能带任何工具`） | 角色 |
| `ROLE_WAKE_UNKNOWN` | `唤醒白名单里的角色不存在：{role}` | 角色 |
| `ROLE_WAKE_SELF` | `唤醒白名单不能包含自己：{role}` | 角色 |
| `ROLE_DERIVE_MISSING` | `派生来源不存在：{role}` | 角色 |
| `ROLE_DERIVE_CYCLE` | `派生链成环：{chain}` | 角色 |
| `ROLE_CONTRACT_UNBOUND` | `契约不连通：{field} 没有{side}`（`side` 为 `来源` / `去处`） | 角色 |
| `WORKFLOW_SCHEMA_MISSING` | `缺少必填字段：{field}` | 工作流 |
| `WORKFLOW_ID_MISMATCH` | `工作流 id 与文件名不一致：文件 {fileId} / 声明 {declaredId}` | 工作流 |
| `WORKFLOW_NODE_DUPLICATE` | `节点 id 重复：{id}` | 工作流 |
| `WORKFLOW_NODE_TYPE_INVALID` | `节点类型取值非法：{value}；合法取值：role / human / escalate / subworkflow` | 工作流 |
| `WORKFLOW_NODE_FIELD_MISSING` | `节点 {node} 缺少必填字段：{field}` | 工作流 |
| `WORKFLOW_ROLE_UNKNOWN` | `引用的角色不存在：{role}` | 工作流 |
| `WORKFLOW_SUB_UNKNOWN` | `引用的子工作流不存在：{id}` | 工作流 |
| `WORKFLOW_SUB_CYCLE` | `子工作流成环：{chain}` | 工作流 |
| `WORKFLOW_EDGE_INVALID` | `边不合法：{detail}` | 工作流 |
| `WORKFLOW_TIMEOUT_INVALID` | `超时取值非法：{value}；合法范围：1~86400 的整数` | 工作流 |
| `WORKFLOW_RETRY_INVALID` | `重试取值非法：{value}；合法范围：0~5 的整数` | 工作流 |
| `WORKFLOW_UNREACHABLE` | `节点不可达：{node}` | 工作流 |
| `WORKFLOW_BACKFLOW_NO_LIMIT` | `回流目标缺少轮次上限：{node}` | 工作流 |
| `WORKFLOW_SCOPE_OVERLAP` | `并行组 {scope} 内的 {a} 与 {b} 使用了同一作用域 {name}` | 工作流 |
| `WORKFLOW_SCOPE_INVALID` | `并行组 {scope} 只有 1 个节点` | 工作流 |
| `WORKFLOW_VAR_UNKNOWN` | `变量引用无法解析：{ref}` | 工作流 |
| `WORKFLOW_MAPPING_INCOMPLETE` | `{node} 的输入 {field} 没有来源` | 工作流 |
| `WORKFLOW_TRANSITION_ILLEGAL` | `{detail}`（固定句：`入口节点 {node} 不能有回流入边` / `升级节点 {node} 不能有正向出边` / `人工节点 {node} 的出边必须写人工条件` / `{node} 不能成为回流目标`） | 工作流 |
| `WORKFLOW_WAKE_DENIED` | `唤醒不在白名单内：{from} → {to}` | 工作流 |

命令级失败码（只决定首句与退出码，不进资产错误表）：`ROLE_NOT_FOUND`、`SKILL_NOT_FOUND`、`WORKFLOW_NOT_FOUND`、`ASSET_EXISTS`、`ASSET_READONLY`、`BASELINE_MISSING`；对应首句见 A-5 / A-11（`找不到角色` / `找不到技能` / `找不到工作流` / `已存在同名…（加 --force 覆盖）` / `内置…只读` / `缺少对比基线`）。

**退出码**：0 成功 ｜ 1 资产不合法 / 目标不存在 / 被拒 ｜ 2 用法错误 ｜ 3 预检失败（`orch run` 注册表不合法，行为不变）。

---

## 附录 B 术语与未决问题

### B.1 术语

| 术语 | 含义 | 易混对象 |
|---|---|---|
| 角色（role） | 静态定义资产，描述「这类工作由什么样的执行者承担」 | 不是会话，也不是节点 |
| 派生（derive）/ `derived_from` | 新角色以某个已有角色为来源生成，文件里记下来源 id | 不是「继承后再合并」：字段是**复制**，来源后续改动不会自动同步 |
| 工作流（workflow） | 声明式资产 `<id>.yaml`：节点、边、原语参数 | 不是「实例」：实例是它跑起来的产物（本迭代不产生） |
| 内置工作流 | 三张内建图的只读投影（`single` / `code-loop` / `task-loop`） | 不是文件：没有 `.yaml` 落盘，`file` 为 `null` |
| `node_type` | 节点的四类身份：`role` / `human` / `escalate` / `subworkflow`。**字段名唯一口径**：YAML / 资产文件里的键逐字用 `node_type`（规划 746 行）；JSON 输出的键用驼峰 `nodeType`（与 `maxRounds` / `parallelScope` 同口径） | 不是节点状态：类型是静态定义，状态是运行时 |
| 角色节点（`role`） | 由某个角色承担的工作节点 | — |
| 人工节点（`human`） | 由人处理、必须显式给「通过 / 驳回」的节点 | 不是升级节点：人工节点是正常路径上的一站 |
| 升级节点（`escalate`） | 异常出口，流程在此止步等待人工裁决 | 不是人工节点：升级节点没有正向出边 |
| 子工作流（`subworkflow`） | 一个节点背后是另一条完整工作流 | 不是「复用节点」：它有独立入口/终点，渲染为折叠组 |
| `subworkflow` / 子工作流嵌套 | 子工作流里的节点可以再引用别的子工作流 | 不得自引用、不得成环 |
| fan-out | 一个节点分出多条同时推进的边（进入同一 `parallel_scope`） | 不是条件分支：并行是**都走**，条件是**选一条** |
| fan-in | 多条并行边汇入同一个下游节点 | 不是「合并产物」：产物合并顺序属于 I1.7 |
| `parallel_scope` | 并行组名：同名节点属于同一组，在预演里占同一层、输出成一行 | 不是 `scope`：一个说「和谁一起跑」，一个说「写哪里」 |
| `scope` | 节点的产物作用域（缺省 = 节点 id）；同组内不得重复 | 不是工作区目录（I1.7 才落目录） |
| 变量引用 | 形如 `<节点 id>.<字段>` 或 `task.<字段>` 的字段路径 | 不是文件路径 |
| 字段映射（`map`） | 边上声明「上游某字段 → 下游某输入字段」 | 不是同名自动对接：同名只是缺省规则之一 |
| 契约连通 | 角色声明的输入有来源、输出有去处 | 与「字段映射完整」不同：前者跨工作流看角色，后者只看一条工作流 |
| 权限闭环 | 工具集与副作用等级对得上，唤醒白名单自洽 | 不是宿主侧的真实权限（宿主原生机制负责） |
| `when` / 条件 | 边上的闭集取值：`always` / `passed` / `failed` / `human_approved` / `human_rejected` | 不是表达式语言：本迭代不支持任意表达式 |
| `dry-run` / 预演 | 只读推演：分层、并行组、分支、映射、策略，不建会话不写盘 | 不是 `validate`：`validate` 判合法性，`dry-run` 给出**计划长什么样** |
| 内置投影 | 把内建图对象按工作流字段口径读出的一份只读定义 | 不是文件，也不参与任何写命令 |
| 包（package） | 本迭代指 `role export` / `skill export` 产出的单份文件 | 不是 I1.12 的「含依赖闭包、可验签」的资产包 |

### B.2 未决问题与假设

| # | 问题 | 本文件结论 | 是否阻塞开工 |
|---|---|---|---|
| B-01 | 项目工作流什么时候能被 `orch run` 实例化？`docs/index.md` 的 I1.6 条目只要求 dry-run，但 I1.10a 的验收需要「含人工节点与子工作流的实例在流程图上拓扑完整」——那要求运行时真的能跑这类工作流 | 本迭代**不做**运行时实例化，`run --template` 仍只认三个内建模板名（BR-28）；建议在 I1.7（并行与作用域）或 I1.8（实例管理器）承接，并在规划侧补一条迭代条目 | 不阻塞 I1.6；**阻塞 I1.10a**，需规划方裁决归属 |
| B-02 | 工作流是否需要「版本号」字段，供 I1.12 的版本兼容检查使用 | 本迭代不加版本字段；`schema: workflow/v1` 即版本位 | 不阻塞 |
| B-03 | 内置 `task-loop` 的 `writer → reviewer` 与 `writer.wake_allow=[editor]` 不一致（I1.5 资产遗留） | 唤醒权限对**所有被校验工作流**生效（含三条内置图），不豁免、不收窄（裁-2 / R-6 / BR-39 / BR-41）；本迭代按附录 D-7b 对齐 `assets/roles/researcher.yaml`（`wake_allow: [] → [writer]`）与 `assets/roles/writer.yaml`（`[editor] → [editor, reviewer]`），并新增 AC-61 作为「资产被改坏时 `workflow validate` 先红」的回归红线（`role show researcher` / `role show writer` 的「可唤醒」行按 D-7b 对齐后的新值逐字固定，是 I1.5 逐字红线的**唯一例外两行，已由 AC-48 逐字固定**；`role list --format json` 不含 `wakeAllow`、不受影响，其余 I1.5 既有输出一字不变） | 不阻塞 I1.6 |
| B-04 | `derived_from` 是否要支持多级继承的字段解析（A 派生于 B，B 派生于 C，A 未声明的字段是否该取 C 的值） | 不支持：派生是**一次复制**，来源只在 A→B 这一层；链只用于「来源存在性」和「成环检测」 | 不阻塞 |
| B-05 | `role edit` 是否应保留文件里的注释 | 不保留（规范化重写），并在命令输出末行明说（A-3） | 不阻塞 |
| B-06 | `workflow create --from` 是否要复制 `timeout` / `retry` / `map` | 复制全部结构与策略字段（节点、边、超时、重试、映射、并行组、作用域），不复制运行时产物 | 不阻塞 |
| B-07 | 主控口述「CLI 资产命令集三组共 18 个命令」与规划原文不符 | **规划原文逐条相加是 17 条**：`docs/index.md:749-751`（基线 `0cd113b`）为 `role` 5 条 + `skill` 6 条 + `workflow` 6 条；「18」是主控口述口误，按 17 条实现（逐条列在 §2.2~§2.10 与 A-12），已在 `decisions.md`「口误更正」登记 | 不阻塞 |
| B-08 | 契约连通是否会对「只写了角色、还没写工作流」的用户产生噪音 | 不会：只对「被至少一个工作流引用」的角色生效（BR-13） | 不阻塞 |

---

## 附录 C 变更记录

| 版本 | 日期 | 变更 | 说明 |
|---|---|---|---|
| v1 | 2026-11-08 | 初稿 | 52 条 AC、34 条 BR、7 条 M、14 条 C、7 条 NFR；待独立评审 |
| v2 | 2026-11-08 | 按 `review-round1.md` §5 F-01 ~ F-22 逐条修订 | AC 52→65（补 AC-53 ~ AC-65）、BR 34→41（补 BR-35 ~ BR-41）；补裁-1 ~ 裁-5 与「18 → 17 条命令」口误更正的落点（登记于 `decisions.md`）；术语/字段名统一 `node_type`；唤醒权限对含三条内置图的所有工作流生效（B-03）；待第 2 轮独立评审 |
| v3 | 2026-11-08 | 内部自洽性修补（7 项）+ F-06 / F-19 闭合 | ① D-7 拆出 D-7a（标题下补「本节记作 D-7a」）并新增 `### D-7b 内置资产对齐授权`，悬空引用全部可解析；② D-3 与裁-2 / BR-26 / BR-35 三处硬冲突对齐（⑬ 含三条内置图、终态含 `human` / `escalate`、只查 `forward` 边、⑤ 字段名 `node_type`）；③ B.1 定死 `node_type` / `nodeType` 唯一口径并清 A-1 / A-14 / AC-22 / D-3 残留（AC-22 的 Then 不动）；④ §3.3 第 3 条按命令面 / 校验器面 / 回归与门禁面覆盖全部 65 条 AC；⑤ A-12 / D-6 补 `--from` 两档口径（BR-38）；⑥ M-4 / D-1 补 D-7b 唯一例外；⑦ F-06 改 AC-33 Given 回边源为 `role` 节点、F-19 保留 `join` 并补 dry-run 可见语义与 AC-63 核对点；AC 仍 65 条、BR 仍 41 条、无 Then 放宽、无方向变更；待第 2 轮独立评审 |
| v4 | 2026-11-08 | 5 项自洽性收口（v3 复核） | ① A-10 并行组层行补「· 汇合：all」后缀、层行格式定义写明并行组层行固定带「· 汇合：all/any」段，并同步 §2.8 / A-10 示例 / AC-27 等所有逐字断言该行的地方（以附录 A 统一文本为准，不删任何断言、不改成模糊包含；A-1 / AC-63 的汇合口径不动）；② 补字面 `### D-7a 授权断言修改清单（只有这两行）` 标题并在其前补伞形说明「附录 D-7 = D-7a + D-7b，两节合称 D-7」，AC-50 / R-8 / M-2 等引用均可解析；③ D-3 ⑪ 判定口径写死 backflow / retest 控制流边跳过（不携带产物映射、⑪ 只查 forward 边；⑫ 仍管回流目标类型、⑨ 仍管 max_rounds），C-09 ⑪ 同步「控制流边跳过」括注，AC-33 Then / 机检不动；④ §3.3 第 4 条「实例/夹具面」改为「第 3 条各面的特例」，AC-49 / AC-50 只归回归与门禁面一个面名、无重复无遗漏；⑤ A-12 用法块只改 role create 行（四项去方括号、改用「中文名/继承」式显式标注表达两档必填性），仍 25 行、前 8 行逐字不变（AC-43 不破），说明段补一句「用法行里的『继承』标注只在给了 --from 时生效」；AC 仍 65 条、BR 仍 41 条、无 Then 放宽、无方向变更；待第 2 轮独立评审 |
| v5 | 2026-11-08 | 按 `review-round2.md` G-01~G-05 修订 + 裁-6 收口 | ① G-01／裁-6：保留裁-2「唤醒权限含三条内置图」，把 I1.5 逐字红线显式限定为「除 D-7b 授权的两处 `可唤醒` 行外 0 处」并用 AC-48 逐字钉住新值（§1.2 指标 8／BR-32／AC-48／B-03／D-8 同步）；② G-02：BR-37 限定为仅工作流 `diff`、角色 `diff` 口径单独写清并同步 A-11／§2.4；③ G-03：AC-40 追加 `workflow create --force` 用例（覆盖成功退 0 且不跳过校验）；④ G-04：D-9 词表与四条命令逐字复制进 AC-51「架构检查：」段；⑤ G-05：§1.3.1「第 5 行」→「第 3 行」；`decisions.md` 新增裁-6 与第六节「v5 收口」；AC 仍 65 条、BR 仍 41 条、无 Then 放宽、无方向变更；待第 3 轮独立评审 |
| v6 | 2026-11-09 | 3 项修补 + 全文交叉一致性自检扫描 | ① 修补 1（AC-57 / G-02 连带错误）：Then 由 BR-37 工作流 `diff` 口径纠正为 §2.4 / BR-11 **角色 `diff`** 口径（忽略 `id`、`name` 与其余键全比），机检由「不存在 `id` 或 `name`」改为「不存在 `id`」+ 净增 `name` 正向断言（`base` / `target` 与两份对比文件 `name` 一致）+「末行 N = `changes.length`」，断言强度只增不减；全文 BR-37 / `忽略.*name` 扫描无其他角色 `diff` 串用；② 修补 2：§1.3 第 10 项、M-5 两处「逐字不变」补 D-7b 两行例外（`--format json` 因 `toRoleJson()` 不含 `wakeAllow` 不受影响），全文同类位置已核对、例外未扩大到第三条；③ 修补 3：`decisions.md` 登记裁-7（以源码为准，AC-48 的 JSON 断言保持「10 键、不含 `wake` / `wakeAllow`、与 I1.5 逐字节相同」）、新增第七节「v6 连带纠错（3 项）」、头部改 v6 /「待第 3 轮独立评审」/ 裁决数 6→7；④ 自检扫描结论：role `diff` / workflow `diff` 口径互不串用，各 AC 的 Then 与附录 A 逐字输出一致，AC-48 四条新增命令与 `toRoleJson()` / `showRole` 实形一致，无同类残留；AC 仍 65 条、BR 仍 41 条、无 Then / 机检放宽、无方向变更；待第 3 轮独立评审 |
| v7 | 2026-11-09 | 定稿前机械自检（头部裁决数同步 + 8 类校验） | ① 头部「裁决登记」由「5 条裁决（裁-1 ~ 裁-5）」同步为「7 条裁决（裁-1 ~ 裁-7）」，与 `decisions.md` 实有 7 条裁决一致，保留「18 → 17 条命令」口误更正；② 头部 `v6` → `v7`、状态改「草稿（S0 第 3 轮独立评审待判）」，`decisions.md` 头部「对应需求」同步 v7 并新增第八节「v7 定稿前机械自检」；③ 实跑 8 类机械自检结论：版本链 v1~v7 无跳号且 v7 为附录 C 末行、与头部一致；AC 65 / BR 41 / NFR 7 / M 7 / C 14 编号连续无缺号、AC 与 BR 无重复定义；章节骨架 3 正文节 + 附录 A~D 齐全、附录小节 26 个且 D-7a / D-7b / D-9 可解析（D-7 有伞形说明）；交叉引用无悬空、`见附录` 0 命中、64 处「机检：」与 AC-51「架构检查：」均为完整命令；65 条 AC 三件套齐全、§3.3 三面分组覆盖 65 条无重复；`node_type` / `nodeType` 口径统一、`type:` 残留 0；④ 只改头部两行 + 追加本行 + `decisions.md` 头部与第八节，未动任何 AC 的 Then / 机检、未增减 AC 或 BR、未改需求方向；⑤ §2 的 5 处字段 / 内部结构描述（242 / 246 / 283 / 398 / 454 行）属用户视角越界嫌疑，按「只检查不改正文」记录、交第 3 轮评审裁决；AC 仍 65 条、BR 仍 41 条；不宣布评审通过 / 需求定稿、不提交 git；待第 3 轮独立评审；第 3 轮独立评审 PASS、阻断 0、建议 4 条转 S1/实现期；定稿 |

---

## 附录 D 实现约束（非用户可见，供实现与任务拆分使用）

### D-1 模块与文件边界

| 模块 | 职责 | 允许依赖 | 禁止 |
|---|---|---|---|
| `src/registry/workflow-schema.js` | 工作流字段契约、四类节点、取值域（`kind`/`when`/`join`）、19 个原因码常量、单节点/单边形状检查 | 无 | 读写文件、中文、出现具体资产名 |
| `src/registry/workflows.js` | 扫描 `.orch/workflows`、内置投影合并、解析、校验、排序；返回 `{ok, workflows, workflowMap, errors, counts}` | `yaml-lite`、`workflow-schema`、`node:fs` | 中文、写文件、建目录、联网、出现图名 |
| `src/registry/workflow-plan.js` | `planWorkflow({workflow, task})` → 分层/并行组/分支/映射/策略（纯函数） | `workflow-schema` | 读写文件、看时钟、中文 |
| `src/registry/contracts.js` | `checkRoleContracts({roles, workflows})` → 角色侧契约连通/权限闭环/派生链问题 | `workflow-schema` | 读写文件、中文 |
| `src/registry/asset-write.js` | 规范化序列化 + 原子写（临时文件 + rename），只允许写三个落点 | `node:fs`、`node:path` | 中文、出现资产名、写 `assets/**` |
| `src/cli/roles.js` | 扩到 8 条子命令；把注册表/契约检查的结果交 `labels.js` 组装人话 | 既有 + `contracts`、`workflow(s)`、`asset-write` | 中文、直读 `state.json` |
| `src/cli/skills.js` | `skill` 六条子命令 | `registry/*`、`render`、`labels` | 中文、联网 |
| `src/cli/workflows.js` | `workflow` 六条子命令 | `registry/*`、`render`、`labels`、`templates/index.js`（只取 `GRAPHS`） | 中文、直读 `state.json` |
| `src/cli/labels.js` | 新增三族文案、7 条角色原因码、19 条工作流原因码、条件与类型标签、25 行 `USAGE_LINES` | 无 | — |
| `src/cli/main.js` | `COMMANDS` 增 `skill`/`workflow`；每子命令标志白名单；`--set`/`--unset` 可重复 | `roles/skills/workflows` | 中文、资产名 |

**不得改动**：`src/registry/index.js` 的加载与计数（M-3）、`src/templates/index.js`（任何字段）、`src/core/**`、`src/daemon/**`、`assets/**`。**唯一例外**：D-7b 授权的两处 `wake_allow` 对齐；除此之外 `assets/**` 不得改动。该例外是开发期的仓库文件修改，不是 CLI 运行时行为，BR-01 / AC-46 / AC-58 的「内置只读」不受影响。

### D-2 工作流文件的 YAML 子集约束

沿用 `src/registry/yaml-lite.js`，不新增解析能力：

- 节点与边一律写成**映射序列**（`- id: T-001` 后跟同缩进的键），不得使用行内映射 `{...}`；
- 不得使用块标量（`|` / `>`）、锚点别名（`&` / `*`）、`---` 分隔符、制表符缩进；
- 标量里不得出现 `{`（`yaml-lite` 会判 `unsupported-token`）；
- 字段值含冒号时用引号包裹（`summary: "研究：两人并写"`）。

解析失败一律 `YAML_PARSE_FAILED`，带 1 基行号；`{detail}` 仍由 `labels.js` 的 `YAML_DETAIL` 组装（I1.5 D-3 的 v5 口径不变）。

### D-3 工作流校验顺序与判定口径（C-09 的可执行版）

```
loadWorkflows({root, builtinGraphs}) ->
  1. 内置投影 = builtinGraphs 逐图转 workflow 形状（C-10），source='builtin'，file=null
  2. 项目 = 扫描 <root>/.orch/workflows/*.yaml（不存在即跳过）
  3. 合并 = 内置按 id → 项目整体覆盖
  4. 逐个校验（同一文件同一原因码只报第一条）：
     ① 解析 → YAML_PARSE_FAILED
     ② 必填键 schema/id/name/entry/terminal/nodes → WORKFLOW_SCHEMA_MISSING
     ③ id 字符集 + 文件名 → WORKFLOW_ID_MISMATCH
     ④ 节点 id 存在且唯一 → WORKFLOW_NODE_DUPLICATE
     ⑤ node_type 取值 → WORKFLOW_NODE_TYPE_INVALID；类型必填字段 → WORKFLOW_NODE_FIELD_MISSING
     ⑥ role 解析 → WORKFLOW_ROLE_UNKNOWN；subworkflow 解析 → WORKFLOW_SUB_UNKNOWN / WORKFLOW_SUB_CYCLE
     ⑦ 边端点/sort/kind/when/join/timeout/retry → WORKFLOW_EDGE_INVALID、
        WORKFLOW_TIMEOUT_INVALID、WORKFLOW_RETRY_INVALID
     ⑧ 可达性 → WORKFLOW_UNREACHABLE
     ⑨ 回边轮次上限 → WORKFLOW_BACKFLOW_NO_LIMIT
     ⑩ 并行组 → WORKFLOW_SCOPE_OVERLAP / WORKFLOW_SCOPE_INVALID
     ⑪ 变量引用与映射完整性 → WORKFLOW_VAR_UNKNOWN / WORKFLOW_MAPPING_INCOMPLETE
     ⑫ 状态转换 → WORKFLOW_TRANSITION_ILLEGAL
     ⑬ 唤醒权限（所有工作流，含三条内置图）→ WORKFLOW_WAKE_DENIED
  5. counts = { assets: 参与校验数（含不合法）, builtin, project, invalid: 涉及文件数 }
```

**判定口径（逐条写死，避免实现各说各话）**

- 可达性：从 `entry` 沿所有边（含回边/复测边）做一次遍历，未访问到的节点逐个报 `WORKFLOW_UNREACHABLE`；再反向从所有节点求「能否到某个终态」——终态 = `terminal` 指定节点**或任意 `human` / `escalate` 节点**（BR-35），不能到达任一终态的节点报 `WORKFLOW_UNREACHABLE`（同一原因码只报第一条）。
- 回边轮次上限：存在 `kind: backflow` 的边时，其 `to` 节点必须有 `max_rounds`；缺则报 `WORKFLOW_BACKFLOW_NO_LIMIT`。
- 并行组：按 `parallel_scope` 分组；组内节点数 < 2 → `WORKFLOW_SCOPE_INVALID`；组内 `scope`（缺省为节点 id）出现重复 → `WORKFLOW_SCOPE_OVERLAP`。
- 变量引用：`map.from` 必须匹配 `^(task|[A-Za-z0-9-]+)\.[A-Za-z0-9_.-]+$`；前缀是节点 id 时必须等于该边的 `from`，且首字段必须在该节点 `outputs` 里；前缀是 `task` 时视为任务输入、恒合法。`map.to` 必须在该边 `to` 节点的 `inputs` 里。
- 映射完整性：对每条边，目标节点的每个 `inputs` 字段都必须有来源（同名上游 `outputs` 或一条 `map.to` 等于该字段）；否则 `WORKFLOW_MAPPING_INCOMPLETE`。
- 控制流边豁免（⑪）：`backflow` / `retest` 属控制流边，不携带产物映射，⑪ 只对 `forward` 边检查 `map` 与下游输入来源；⑫ 仍负责校验回流目标必须是 `role` 节点、⑨ 仍负责回流目标 `max_rounds`。
- 状态转换：入口节点不得有 `kind: backflow` 入边；`escalate` 节点不得有 `kind: forward` 出边；`human` 节点的所有出边 `when` 必须是 `human_approved` / `human_rejected`；`human` / `escalate` 不得作为 `backflow` 的 `to`。
- 唤醒权限：**只检查 `kind: forward` 的边**：若 `from` 节点是 `role`，其 `wake_allow` 不含 `to` 节点的角色 → `WORKFLOW_WAKE_DENIED`；`wake_allow` 为空数组表示「不允许主动唤醒任何角色」，此时只要有 forward 出边就报该码；`backflow` / `retest` 边跳过本项（由 ⑫ 状态转换项保证目标必须是 `role`）；`to` 不是 `role` 节点时跳过本项。

### D-4 角色写命令的落盘规则（C-02 ~ C-07 的可执行版）

```
create:  收集参数 → 组装对象（--from 时先取来源对象再逐字段覆盖）→ 校验 → 序列化 → 原子写
edit:    读取现有项目文件 → 应用 --set/--unset → 校验 → 序列化 → 原子写（覆盖原文件）
export:  读取角色（项目优先）→ 序列化 → stdout 或 --out 写文件（--out 不做原子写以外的校验）
import:  读取文件 → 解析 → 校验 → 目标已存在且无 --force 则拒 → 原子写
```

- 校验入口与 `role validate` 同一套（`checkRoleShape` + 技能解析 + `contracts.js`），**不得**另写一份判定。
- `--from` 继承字段集合：`name` / `summary` / `group` / `artifact_type` / `side_effect` / `skills` / `tools` / `wake_allow` / `inputs` / `outputs` / `dispatchable` / `max_concurrent_sessions`；**不继承** `id` 与 `derived_from`（`derived_from` 写成本次来源）。
- 派生默认名：来源中文名 + `（派生）`，模板放 `labels.js`（`{base}（派生）`）。
- 序列化只输出「必填 9 键 + 源对象里出现过的可选键」；`derived_from` 排在 `side_effect` 之后。
- 内置只读判定：`registry.roles` 里同 id 项的 `source === 'builtin'` 即为内置。

### D-5 dry-run 计划生成（纯函数，C-12）

```
planWorkflow({workflow, task}) ->
  1. 分层：从 entry 做最长路径分层（回边不参与分层，只标注）
  2. 并行组：同一层里 parallel_scope 相同的节点合并为一条层记录（parallel=true）
  3. 分支：收集 when != always 的边，按 (from 层号, to, when) 稳定排序
  4. 映射：收集所有 map 项，按 (from 层号, to 节点, 序号) 稳定排序
  5. 策略：收集 timeout/retry 非空的节点，按层号排序
  6. 子工作流：subworkflow 节点的 `workflow` 解析出节点数，写进节点描述
```

不读实例、不看时钟、不联网；同一输入两次输出逐字节相同（NFR-04）。

### D-6 CLI 参数与白名单（M-1 的可执行版）

| 子命令 | 位置参数 | 允许的标志 |
|---|---|---|
| `role list` | 无 | `--group` `--instance` `--format` |
| `role show` | 角色 | `--instance` `--format` |
| `role validate` | 可选角色 | `--format` |
| `role create` | 角色 | `--from` `--name` `--group` `--artifact-type` `--side-effect` `--summary` `--skills` `--tools` `--wake-allow` `--max-concurrent` `--force` |
| `role edit` | 角色 | `--set`（可重复） `--unset`（可重复） |
| `role export` | 角色 | `--out` |
| `role import` | 文件 | `--force` |
| `role diff` | 角色 | `--against` `--format` |
| `skill list` | 无 | `--group` `--format` |
| `skill show` | 技能 | `--format` |
| `skill create` | 技能 | `--name` `--summary` `--applies-to` `--commands` `--body-file` `--force` |
| `skill validate` | 可选技能 | `--format` |
| `skill export` | 技能 | `--out` |
| `skill import` | 文件或目录 | `--force` |
| `workflow list` | 无 | `--format` |
| `workflow show` | 工作流 | `--format` |
| `workflow create` | 工作流 | `--name` `--from` `--force` |
| `workflow validate` | 可选工作流 | `--format` |
| `workflow diff` | 工作流 | `--against` `--format` |
| `workflow dry-run` | 工作流 | `--task` `--format` |

- 白名单检查放在解析**之后**（I1.5 C-2 的口径），保证「未知参数」与「标志用错子命令」是两句不同的话。
- `--set` / `--unset` 进 `REPEATABLE_FLAGS`，解析成数组；其余命令的解析结果字段集合一个都不变。
- `--force` 进 `BOOLEAN_FLAGS`；`role`/`skill`/`workflow` 之外的命令收到它仍是 `未知参数：--force`。
- `role create` 的必填检查按两档口径：**没有 `--from`** 时 `--name` / `--group` / `--artifact-type` / `--side-effect` 四项必填，检查顺序固定为 `--name` → `--group` → `--artifact-type` → `--side-effect`（先缺先报、缺一退 2，AC-02 依赖这个顺序）；**给了 `--from`** 时四项均可省，省略时 `--group` / `--artifact-type` / `--side-effect` 继承来源、`--name` 用「<来源中文名>（派生）」，必填检查跳过这四项（BR-38、AC-04）；`skill create` 为 `--name` → `--summary`；`workflow create` 为 `--name`。

附录 D-7 = D-7a（既有断言的两行授权）+ D-7b（内置资产对齐的唯一例外），两节合称 D-7。

### D-7a 授权断言修改清单（只有这两行）

本节记作 D-7a（既有断言，只有两行）；D-7b 是紧随其后的内置资产对齐授权。二者是附录 D-7 的两个子节。

| 文件 | 行 | 现状 | 只改这一段 | 理由 |
|---|---|---|---|---|
| `test/wp11/cli-role.test.js` | 354 | `assert.equal(block.length, 9, 'eight usage lines plus the reason line');` | 把 `9` 改成 `26`，注释改成 `twenty-five usage lines plus the reason line` | 用法块从 8 行扩到 25 行（M-2），整块行数 = 25 + 1 |
| `test/wp11/cli-role.test.js` | 357 | `assert.equal(USAGE_LINES.length, 8);` | 把 `8` 改成 `25` | 同上 |

**第 356 行 `assert.deepEqual(block.slice(0, 8), [...USAGE_LINES]);` 不得改动**：它正是「前 8 行逐字不变」的守卫。除这两行外，`test/**` 一个字符都不许改；新增断言一律放新文件（D-10）。

### D-7b 内置资产对齐授权（裁-2 的唯一例外）

裁-2 要求「角色对唤醒权限」对所有被校验的工作流（含三条内置图）生效，而 `task-loop` 存在 `researcher → writer`、`writer → reviewer` 两条 `forward` 边，I1.5 的 `researcher.wake_allow=[]` 与 `writer.wake_allow=[editor]` 会让这两条边触发 `WORKFLOW_WAKE_DENIED`。因此本迭代**唯一允许改动的内置资产**是：

- `assets/roles/researcher.yaml`：`wake_allow: []` → `wake_allow: [writer]`；
- `assets/roles/writer.yaml`：`wake_allow: [editor]` → `wake_allow: [editor, reviewer]`。

理由：这两处只改 `wake_allow` 的取值、不动任何字段结构，是让 BR-26 / BR-39 / BR-41 在三条内置图上同时成立的最小修正。**除此之外 `assets/**` 一个字节不得改动。**这两处改动发生在**实现阶段由开发者改仓库文件**（本迭代交付的仓库内容），**不是任何 CLI 命令的运行时行为**——命令运行时 `assets/**` 仍然只读，故 BR-01 / AC-46 / AC-58 的「内置只读」口径不变。

### D-8 兼容性红线

> **唯一例外（裁-6）**：`role show researcher` / `role show writer` 的「可唤醒」行按附录 D-7b 对齐（`  可唤醒：writer` / `  可唤醒：editor, reviewer`），**已由 AC-48 逐字固定**；除此之外 I1.5 既有输出逐字节不变。`role list --format json` 与 `role show --format json` 的 `toRoleJson()` 不含 `wakeAllow` 字段，故不受两处 `wake_allow` 改动影响；派生角色 `role show` 多出的 `派生自：<来源>` 一行另按 BR-32 计。下表其余各行的判定方式不变。

| 红线 | 判定方式 |
|---|---|
| `role list` / `role show`（非派生角色）/ `role validate` 的文本 | 逐字节比对 I1.5 基线（AC-48） |
| `role list --format json` 的 3 键、`counts` 4 键、角色对象 10 键 | `test/wp11/cli-role.test.js:285-300` 不改且全绿 |
| `role show --format json` 的 3 键、`roleInstance` 9 键 | `test/wp11/cli-role.test.js:499/523/530` 不改 |
| `role validate --format json` 的 `counts` 6 键、`errors` 6 键 | `test/wp11/cli-role.test.js:577-590` 不改 |
| 三条主链输出 | AC-49 |
| `orch run` 预检与 `未知模板` 文案 | AC-47 + `test/wp6/main.test.js:247` 不改 |
| `loadRegistry` 的计数与报错顺序 | `test/wp11/registry.test.js` 不改且全绿 |

### D-9 架构纯净扫描（AC-51 的完整命令）

```bash
COMMON="task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check"
NOCOORD=$(echo "$COMMON" | sed 's/,coordinator//')

# 1) 引擎：与 I1.5 完全相同的 31 词
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"

# 2) 注册表实现（含本迭代新增的 workflows/workflow-schema/workflow-plan/contracts/asset-write）：30 词
node test/fixtures/purity-check.mjs --dirs src/registry --forbid "$NOCOORD"

# 3) 三族命令实现：逐文件扫（labels.js 合法持有资产名，不得整目录扫）
node test/fixtures/purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"

# 4) 新增实现零 CJK（中文唯一来源是 labels.js 与 assets/**）
node -e "const fs=require('fs'),p=require('path');const roots=['src/registry','src/cli/roles.js','src/cli/skills.js','src/cli/workflows.js'];const bad=[];const walk=d=>{const st=fs.statSync(d);if(st.isDirectory()){for(const e of fs.readdirSync(d))walk(p.join(d,e));}else if(/[\u4e00-\u9fff]/.test(fs.readFileSync(d,'utf8')))bad.push(d);};roots.forEach(walk);if(bad.length){console.log(bad.join('\n'));process.exit(1);}console.log('OK: no CJK');"
```

四条都必须退出 0；第 2 条仍保留 I1.5 的定点断言（`coordinator` 在 `src/registry/**` 只允许出现在 `role-schema.js` 的 `GROUPS` 一行）。

### D-10 测试与夹具约束

- 新增用例统一放 `test/wp12/`，8 个文件：`role-write.test.js`、`role-contracts.test.js`、`skill-assets.test.js`、`workflow-schema.test.js`、`workflow-yaml.test.js`、`workflow-validate.test.js`、`workflow-plan.test.js`、`cli-assets.test.js`。
- 纯函数类用例（`workflow-schema` / `workflow-plan`）不碰磁盘：输入是内存对象。
- 需要项目根的用例用 `fs.mkdtemp` 在 `os.tmpdir()` 下造，**不放仓库内**；`assets/**` 只读不写。
- `cli-assets.test.js` 直接 `import { main }` 并注入 `out` / `cwd`，不 spawn 进程、不启核心；退出码用返回值。
- 全量测试命令固定 `node --test --test-concurrency=4 "test/**/*.test.js"`；回归断言用下限（`fail === 0 && pass === tests && tests >= 611`）。
- AC-49 的驱动沿用 `test/fixtures/code-loop-driver.mjs` / `task-loop-driver.mjs` 与 `mock-acp-agent.js`，必须注入 `NODE_ENV=test`；夹具自述行（`{"ok":true,"root":…}`）在比对前剔除。
