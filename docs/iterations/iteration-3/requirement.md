# I1.3 — 非编码闭环（研究 → 撰写 → 审核 → 回流 → 升级）

> 迭代：阶段一 · I1.3 ｜ 依据：`docs/index.md`（§3.1 节点状态 / §3.2 会话状态 / §3.4 交接包状态 / §3.5 一次回流时序 / §3.6 崩溃恢复、§5.2 数据布局、能力域 1 / 2 / 4 / 6、I1.3 条目）｜ 模板：`docs/templates/requirement-template.md`
> 状态：**v1 首版（待评审）** ｜ 上游：I1.2（**开发中**；契约见 `docs/iterations/iteration-2/requirement.md` v16，实现见 `src/`）
> 契约变更 **M-1 ~ M-10**、补充契约 **C-01 ~ C-14**；AC **43 条**；附录 A 输出基线、附录 B 术语与未决问题、附录 C 变更记录、附录 D 实现约束。
>
> **读法**：第二部分只写"我看得到、做得到"的事，不出现内部字段名与迁移表；第三部分每条 AC 都以用户可观察结果或明确的机检/夹具/架构检查开头；实现细节集中在附录 D。

---

## 一、背景与问题

### 1.1 现状与问题

I1.2 之后，我可以一条命令让"开发 → 测试 → 缺陷回流"自己转起来。但真实工作里还有一半不是代码：**写发布说明、写方案、写调研报告**。这些任务同样有"研究 → 撰写 → 审核 → 驳回 → 再改"，I1.2 的引擎却一步也用不上：

- **研究与写作之间的上下文靠手搬**。研究员查到的关键事实、约束、结构建议停在对话里，撰写者只能重新问一遍；问漏了，文档就写偏。
- **审核意见没有落点**。"这段不行""回滚方案没写"散落在聊天里，撰写者要自己归纳；驳回几次之后，谁也说不清第 1 轮到底提了哪几条。
- **文档改版靠文件名人肉管理**。v1、v2、最终版、最终版2 混在一个目录里，旧版被覆盖后无法回溯；审核引用的是哪一版也说不清。
- **审核不过没有边界**。有的文档两轮就好，有的十轮还在打转；没有上限，也没有"必须由我拍板"的停止点。
- **"完成"只看自己**。节点自己说写完了就算完成，下游还没接手、还没看，状态已经是"已完成"；下游随后驳回，状态再被拽回去，用户看到的是来回跳。

**不解决会怎样**：I1.4 的共享工作区、I1.6 的工作流原语、I2.2 的非编码闭环回归，都要求"同一条引擎能驱动非代码产物"。如果这一轮把文档流程写成编码闭环的旁支，后面每加一种任务类型就要再造一套轮次、回流与升级逻辑；`review_reason` 也会退化成只存在于文档里的名词。

### 1.2 目标与成功衡量

| # | 指标 | 目标值 | 怎么量 |
|---|---|---|---|
| 1 | 一个文档任务从发起到结束，我的人工介入次数 | 0 次（只有触发升级时需要我） | 人工计数，连跑 5 次 |
| 2 | 审核意见回到撰写者时，需要我手工搬运的次数 | 0 次 | 连跑 5 次；检查回流内容同时含缺陷摘要、证据位置与修改要求，且证据可打开 |
| 3 | 旧版本被覆盖或丢失的次数 | 0 次 | 第 2 轮结束后比对第 1 轮文件的指纹，必须与第 1 轮记录一致 |
| 4 | 审核文件无效时仍继续回流/派发的次数 | 0 次 | 9 类无效原因（11 个夹具样本）各跑一次；全部停在升级，派发次数不再增加 |
| 5 | 与编码闭环共用同一套推进/回流/上限/升级逻辑 | 1 套 | 架构检查：核心推进文件不出现本模板名与角色名；两种闭环走同一个推进循环 |

### 1.3 范围

**范围内**

1. **一条命令发起通用任务闭环**：`orch run --template task-loop`，三节点（研究 → 撰写 → 审核）由核心自动建好、按序推进；模板是代码内置定义，不是工作流文件。
2. **三个内置角色**（研究员 / 撰写者 / 审核者）：有职责、有"必须交什么"、有内置提示词；本迭代只保留代码常量，不引入角色注册表（I1.5）。
3. **文档类产物的版本化文件区**：研究笔记固定写入 `artifacts/reports/`；撰写产物按轮次写入 `artifacts/docs/<名>.v<轮次>.md`；旧版本只读、不得覆盖。
4. **审核文件**：审核者必须交 `out/review.json`（通过 / 驳回 + 缺陷清单 + 修改要求），核心**只认文件**，不读对话。
5. **证据模型泛化**：文件存在 + 引用可解析 + 审核角色确认，三者同时成立才算本轮通过。
6. **驳回回流**：审核驳回且未到上限 → 核心把缺陷摘要、证据位置、修改要求、上一版引用打包成回流交接包，派发撰写者的下一轮。
7. **轮次上限与升级**：审核最多派发 2 次；第 2 次仍驳回 → 停止回流、生成升级、实例挂起，重启也不自动推进。
8. **`review_reason` 子状态**：节点"待校验"期间区分"核对证据"与"等待下游"；下游接受之前，上游不显示"已完成"（本迭代在 `task-loop` 启用，`code-loop` 保持 I1.2 口径，见 R-1）。
9. **引擎复用**：不新增第二套推进器；`task-loop` 与 `code-loop` 共用 `planAdvance` / `driveGraph` / 交接包状态机 / 轮次上限 / 升级事务。
10. **兼容与可追溯**：`single` 与 `code-loop` 的输出不回归；I1.2 状态文件可读；I1.1 旧格式实例仍然只读可查。

**范围外**

| 不做的事 | 留给谁 | 备注 |
|---|---|---|
| `shared/`、`stage/`、`status.md` 共享工作区 | I1.4 | 本迭代只建 `artifacts/docs/` 与 `artifacts/reports/` |
| 交接包 schema 校验、持久化信箱与重投 | I1.4 | 本迭代仍用 I1.2 的交接包投递路径 |
| 角色注册表、`roles/*.yaml`、角色实例与 6 个角色状态、`orch role` | I1.5 | 三角色是代码内置常量；不显示角色状态 |
| 声明式工作流、`node_type`、并行、条件分支、子工作流 | I1.6 | 本迭代只加第二个内置图 |
| 产物类型隔离、代码 worktree、数据集快照、报告只追加区 | I1.7 | 本迭代只做文档版本区 |
| `escalated` 的人工裁决出边（`orch escalate resolve`） | I1.4 | 本迭代升级后只能查看或取消 |
| `review_reason: downstream` 回填到 `code-loop` | 后续迭代（R-1） | 回填会改变 I1.2 的 46 条 AC，本迭代不重开 |
| 部分改写 / diff 合并 / 自动润色 | 不做 | 每轮必须交完整的新版本，旧版不动 |
| 版本回滚命令 | I1.4+ | 本迭代只保证旧版不被覆盖，不提供切换命令 |
| 审核者在驳回时直接改文件 | 不做 | 审核者只交审核文件；修改由撰写者执行 |
| 非 Markdown 文档（PDF/Word/表格） | 后续迭代 | 本迭代只接受 `.md` |

### 1.3.1 与 I1.3 规划的逐项对应

| 规划条目（`docs/index.md` I1.3） | 本需求落点 | 验收 |
|---|---|---|
| 内置角色：研究员、撰写者、审核者 | §2.1 角色表；附录 D-4 常量表 | AC-01 |
| 通用任务闭环模板：研究 → 撰写 → 审核 → 驳回回流 → 轮次上限 → 升级 | §2.2 ~ §2.6；附录 D-2 迁移表 | AC-01、AC-07 ~ AC-11 |
| 文档类产物走版本化文件区 | §2.7；附录 D-8 | AC-03、AC-07 ~ AC-09、AC-20 |
| 证据模型泛化：文件存在 + 引用可解析 + 审核角色确认 | §2.4、§2.7；附录 D-7 | AC-08、AC-13 ~ AC-19 |
| `review_reason` 子状态（evidence / downstream） | §2.3；附录 D-3 | AC-04、AC-05、AC-41 |
| **验收**：审核角色第 2 轮驳回 → 核心停止回流、生成升级 | §2.5；AC-10 ~ AC-12 | AC-10 |
| **验收**：与 I1.2 共享同一引擎 | §1.4 M-7 ~ M-9；附录 D-1 | AC-38 |

**规划解释登记（R）**

- **R-1（模板范围）**：`review_reason` 子状态本迭代只在 `task-loop` 启用。I1.2 的 `code-loop` 在判定后立即落 `failed`，46 条 AC 已把这个时序钉死；若回填"等待下游"，`failed` 的出现时刻、`--stop-after 2` 的中间态与多条 AC 都会改变。因此 `code-loop` 保持 v16 口径，`task-loop` 完整实现 `evidence → downstream → done` 的门控；引擎以图节点标志启用，后续迭代可零改动回填 `code-loop`。
- **R-2（数据布局节奏）**：基线 §5.2 的 `workspace/` 下还有 `shared/`、`stage/`、`status.md`，它们属于 I1.4。本迭代只创建 `workspace/artifacts/docs/` 与 `workspace/artifacts/reports/`；不创建、不显示其他目录。
- **R-3（产物声明形态）**：`task-loop` 的 `产物：` 行只接受**裸文件名**（如 `产物：release-notes.md`），不接受路径。版本号与目录由核心按规则生成，避免用户写出的路径与版本区不一致。
- **R-4（研究笔记归类）**：研究笔记是"报告"而不是"交付文档"，固定落在 `artifacts/reports/`，与交付文档的 `artifacts/docs/` 分开；这样用户把交付文档命名为 `research-notes.md` 也不会撞名。
- **R-5（审核无效的处置）**：审核文件无效（缺失、陈旧、不可解析、引用不符、证据不可解析）一律升级并挂起，不回流。理由与 I1.2 的"判定无效不回流"一致：无效文件不构成可执行的驳回意见，回流只会把噪声带给撰写者。

### 1.4 对 I1.1 / I1.2 契约的修改（授权变更）

> 说明：M 是"必须改代码/数据结构"的变更；C 是补充契约（实现时必须按此口径，避免出现两套解释）。未列出的 I1.2 契约保持不变。

| 编号 | 现状（I1.2 v16 / 代码） | 变更 | 为什么 | 兼容 / 影响 |
|---|---|---|---|---|
| **M-1** | `src/templates/index.js` 的 `ROLES` 只有 developer / tester / coordinator；`GRAPHS` 只有 `single` / `code-loop`；`TEMPLATE_LABEL` 只有两项 | 新增内置角色 `researcher` / `writer` / `reviewer`，新增图 `task-loop`（三节点四边），注册到 `GRAPHS`；`TEMPLATE_LABEL` 增 `task-loop: '通用任务闭环'`；`ROLE_LABEL` 增三项。角色仍是代码常量，不加载 YAML | 规划要求三个内置角色与通用任务闭环 | 既有 id 与名称不变；未知模板仍返回 `TEMPLATE_UNKNOWN`；I1.5 注册表启用时可原样迁移 |
| **M-2** | 图节点字段：`id/nodeId/roleId/order/title/artifactPolicy/judge/products/wakeFrom/prompt` | 图级追加 `productPolicy: 'declared' \| 'doc-single'`（缺省 `declared`）；节点追加可选字段：`downstreamGate`（布尔）、`artifactPolicy` 取值扩展 `fixed-workspace` / `versioned-doc` / `review`、`artifactDir`、`artifactExt`、`reviewPath`、`prompt` 取值 `research` / `write` / `review`。字段缺省时行为与 I1.2 完全一致 | 引擎不能写死模板名/角色名（AC-38）；产物声明规则、产物与审核策略必须由图数据驱动，`startRun` 不得按模板名分支 | 旧图不填新字段即保持原语义；`productPolicy` 缺省沿用 I1.2 的 `declared` |
| **M-3** | `nodes[]` 字段含 `nodeId/roleId/round/state/stateSince/startedAt/roundStartedAt/endedAt/failure/note/verdict/sessionId/artifactRefs`；`artifactRefs[]` 无 `sha256`/`round`，且每次派发被清空 | 追加 `reviewReason: 'evidence'\|'downstream'\|null`、`review: {decision, defectCount, reviewPath, artifact, readAt}\|null`；`artifactRefs[]` 元素追加 `sha256`（**不加 `round`**：轮次只进 `artifactHistory`，落盘投影统一为 `{ref, bytes, sha256}`，见 M-6）；新增 `artifactHistory[]`（只追加，不随派发清空），元素 `{round, ref, sha256, bytes, verifiedAt}` | 下游门控需要可观测的子原因；版本完整性需要上一轮指纹；审核结果需要审计 | 全部为追加字段；`schemaVersion` 仍为 2；I1.2 状态文件读取不受影响 |
| **M-4** | 交接包字段含 `handoffId/edge/state/timestamps/rejectReason/acceptedSignal/ambiguityWindowMs/defects/note/wakeConsumedAt`；`handoffToState()` 是白名单投影 | 追加 `artifactRefs: {input: string[], output: string\|null, previous: {ref, sha256}\|null}` 与 `revisionRequirement: string\|null`；`handoffToState()` 仅在源对象**确实带该字段**时投影（与 `edge/defects/note` 同规则）；`consumeHandoff()` 里显式重组快照的那一处必须同步透传，否则 `accepted → consumed` 时新字段会被抹掉 | 回流要带上一版引用与修改要求；白名单若漏字段，任意 `session/update` 都会把上下文抹掉（I1.2 M-5 同类缺陷） | 旧交接包没有新字段时渲染与行为不变 |
| **M-5** | 只有 `src/core/verdict.js`（`out/verdict.json`），六类失败顺序 | 新增 `src/core/review.js`（`out/review.json`），按 D-7 的 11 步顺序返回机器码与逐字原因；`verdict.js` 不改 | 审核是第二个"只认文件"的判定入口；不能用模板名分支塞进 `verdict.js` | 新模块；`code-loop` 的判定路径零改动 |
| **M-6** | `verifyProducts()` 只接受 `{cwd, products, roundStartedAt}`；`sha256` 不计算 | `verifyProducts()` 追加可选 `baseDir`（默认 `cwd`）与 `sha256` 计算；返回元素允许带 `absPath`，但**落盘前必须投影掉**，只写 `{ref, bytes, sha256}`；新增 `src/core/doc-artifact.js`：产品名解析、版本引用生成、上一版完整性校验 | 文档产物在实例工作区，不在任务根；旧版指纹必须可复核；状态文件不得保存绝对路径（NFR-08） | `baseDir` 缺省时行为不变；`sha256` 为追加字段；I1.2 调用点无需改 |
| **M-7** | `finishGraphNode()` 只分 `judge:'verdict'` 与产物节点；产物节点核对通过即 `done` | 增加 `judge:'review'` 分支 `finishReviewNode()`：合法 `pass → done`、合法 `reject` 未超限 `→ failed`、合法 `reject` 超限 / 无效 `→ escalated`；事件 `review.read/passed/rejected/invalid` | 审核节点与测试节点语义不同：驳回是业务结果，无效是异常 | 只对 `judge:'review'` 生效；`verdict` 路径不变 |
| **M-8** | 产物节点核对通过即 `review → done`；`latestEndedNodeId()` 只认 `done/failed/escalated`；`classifyNodeOutcome()` 对 `review` 返回 `error` | 启用 `downstreamGate` 的节点：核对通过后保持 `review`，子原因 `evidence → downstream`，记录 `endedAt`，由 `advance` 派发下游；下游首个 turn 事件时 `review(downstream) → done`；`latestEndedNodeId()`（`orchestrator.js` 与 `advance.js` 两处同名逻辑）纳入 `review(downstream)`；`classifyNodeOutcome()` 把 `review(downstream)` 归为 `passed` | 基线的 `done` 要等下游接受；否则"已完成"会在下游接手前出现 | 仅 `downstreamGate:true` 的图节点走新路径；`code-loop` 不受影响（R-1） |
| **M-9** | CLI 只有 I1.2 的 4 个模板错误码；节点行只有"失败（等待复测）"三档限定词；无审核/产物后缀 | `startRun` 按图数据校验 `task-loop` 产物行；新增错误码 `PRODUCT_LINE_MISSING_TASK_LOOP`、`PRODUCT_INVALID_TASK_LOOP`、`WORKSPACE_INIT_FAILED`；新增节点限定词"核对证据 / 等待下游 / 等待复审"、审核后缀与产物后缀；新增事件中文词条 | 用户必须看到"为什么停"与"这一轮交了什么" | 新文案只在 `task-loop` 出现；`single` / `code-loop` 输出逐字不变 |
| **M-10** | 夹具只有 `code-loop-driver.mjs` + mock agent 的 code-loop 场景；prompt 记录不含全文 | 新增 `test/fixtures/task-loop-driver.mjs`；mock agent 增 `--suite task-loop`、`artifact` / `review` 步与 `prompt` 全文记录；新增 D-9 的测试同步清单 | 审核/版本/下游门控必须有确定性夹具；真实面只覆盖一条主路径 | `--suite` 缺省为 code-loop，I1.2 场景逐字不变 |

#### 补充契约条目（C-01 ~ C-14）

| 编号 | 契约 |
|---|---|
| **C-01** | 实例工作区路径唯一由 `src/persistence/paths.js` 计算：`instanceWorkspaceDir(root, id)` = `<root>/.orch/instances/<id>/workspace`；本迭代只创建 `artifacts/docs/` 与 `artifacts/reports/`。其他模块不得自行拼 `.orch/instances/...`。创建失败返回 `WORKSPACE_INIT_FAILED`，不落实例 |
| **C-02** | `task-loop` 的任务必须含且只含一个 `产物：<文件名>.md`（全角冒号）。文件名不得含 `/`、`\`、`..`、盘符，不得以 `.v<数字>.` 结尾；不接受 `.md` 以外扩展名。违反分别返回 `PRODUCT_LINE_MISSING_TASK_LOOP` / `PRODUCT_INVALID_TASK_LOOP`，退出码 1，不建实例 |
| **C-03** | 审核文件固定为任务目录相对的 `out/review.json`；状态与事件中只写该相对路径，不写绝对路径 |
| **C-04** | 审核读取顺序固定：缺失 → 陈旧 → 不可读/不可解析/schema → 结论枚举 → 文档引用 → 缺陷形状 → 证据可解析。命中即返回，不继续后续检查；每次失败都带唯一机器码（D-7） |
| **C-05** | 审核文件只认 `decision` / `artifact` / `defects` / `revisionRequirement` 四个字段，未知字段忽略。`decision='pass'` 时 `defects` 必须为空；`decision='reject'` 时 `defects` 必须非空，每条含非空 `summary` 与非空 `evidence`；`revisionRequirement` 可空，空时使用默认修改要求 |
| **C-06** | 审核的 `artifact` 与 `defects[].evidence` 都是**实例工作区相对路径**；允许证据带 `#L<数字>` 行号后缀，校验时剥离后缀。绝对路径、盘符、含 `..` 的路径一律视为不可解析。证据文件必须存在且 `bytes > 0` |
| **C-07** | 撰写版本引用 = `artifacts/docs/<stem>.v<node.round><ext>`；`stem` 来自任务产物名的去扩展名部分；轮次只增不减、绝不复用。研究笔记固定 `artifacts/reports/research-notes.v1.md` |
| **C-08** | 每轮产物核对成功后计算 `sha256` 并写入 `artifactRefs` 与 `artifactHistory`。撰写第 `n>1` 轮在核对当前版**之前**先核对第 `n-1` 版：不存在 → `artifact_previous_missing`；指纹不符 → `artifact_previous_modified`。两种都升级挂起，不派发审核 |
| **C-09** | 下游接受的幂等键是"交接包 `accepted` 那一刻 + 源节点处于 `review(downstream)`"。同一交接包只允许把源节点迁移一次；后续帧命中时直接返回。迁移为 `review → done`，同时把源节点对应的会话从 `waiting_dependency` 拉回 `idle`；两条迁移必须写在下游节点的同一个 live 状态里，并随触发接受的这一次帧保存**一次 CAS 落盘**（不得另起一次落盘后再回头覆盖，否则 rev 冲突会丢状态） |
| **C-10** | 下游接受只认 I1.2 已实现的 `TURN_UPDATES` 白名单事件，且交接包必须先 `delivered`；噪声帧不触发接受（沿用 `handoff-tracker` 的硬约束） |
| **C-11** | 启用下游门控的源节点在核对通过后，会话保持 `waiting_dependency`（显示"等待下游"），不进入 `idle`；下游接受后再 `idle`。审核节点自身在合法通过/驳回后直接 `idle`。不得出现"节点已完成、会话仍在执行中" |
| **C-12** | 取消覆盖 `pending/running/review/failed/escalated` 节点（含 `review(downstream)`）；`created/delivered/accepted` 交接包记 `rejected`（原因 `withdrawn`，与 I1.2 的 `CANCELABLE_HANDOFF` 一致）；`pending` 升级记 `voided`；实例落 `cancelled`。取消与升级并发时沿用 I1.2 的 CAS 优先口径 |
| **C-13** | 目录唯一性对**所有多节点图**生效（`code-loop` 与 `task-loop` 互斥）：同一 `cwd` 下存在未结束的多节点实例时，新发起返回 `DIR_BUSY`。`single` 实例不参与该限制（与 I1.1 一致） |
| **C-14** | 重启后：`suspended` 保持挂起；`escalated` 节点保持；`failed` 节点保持等待复审；`review` 节点不自动重新核对；`v1` 旧格式只读。`schemaVersion` 不因本迭代升到 3；新增字段全部可缺省读取 |

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

通用任务闭环是 Maestro 的第二个内置模板：一条命令发起，三个角色按"研究 → 撰写 → 审核"自动推进；审核驳回时自动把意见带回撰写者；审核两次仍驳回就停下来等我。

| 角色 | 我交给它什么 | 它必须交什么 | 它不能做什么 |
|---|---|---|---|
| 研究员 | 任务原文 | 一份研究笔记：背景、关键事实、约束、建议结构 | 不写最终文档，不改任务文件 |
| 撰写者 | 任务原文 + 研究笔记（第 2 轮起再加审核意见） | 每轮一份完整的 Markdown 文档，按轮次生成新版本 | 不改研究笔记，不改旧版本 |
| 审核者 | 任务原文 + 本轮文档 | 一份审核文件：通过或驳回；驳回时逐条给缺陷、证据与修改要求 | 不直接改文档；不凭对话下结论 |

**发起方式**

```bash
orch run --template task-loop --task "写一篇发布说明，面向使用 v1.2 的开发者，包含「新功能」「升级步骤」「回滚方案」三节。
产物：release-notes.md"
```

任务里必须有且只有一行 `产物：<文件名>.md`（全角冒号）。文件名只能是文件名，不能带目录；版本号由核心按轮次生成。

**用户能看到的七件事**

| 段 | 我能做什么 | 详见 |
|---|---|---|
| A | 发起一个通用任务闭环 | §2.2 |
| B | 看三个节点各自到哪、这一轮交了什么 | §2.3 |
| C | 审核驳回后，意见自动回到撰写者 | §2.4 |
| D | 审核到上限就停，不无限打转 | §2.5 |
| E | 停下来时看得懂"为什么停、下一步做什么" | §2.6 |
| F | 版本化文件区与审核文件长什么样 | §2.7 |
| G | 取消、查老实例、与编码闭环共存 | §2.8 |

### 2.2 A 发起一个通用任务闭环

**任务怎么写**

```text
写一篇发布说明，面向使用 v1.2 的开发者，必须包含三节：
1. 新功能
2. 升级步骤
3. 回滚方案
产物：release-notes.md
```

规则：

1. 任务描述不能为空；空白任务在发起前被拦下。
2. `产物：` 必须是**全角冒号**；半角 `产物:` 视为没写，提示按全角重写。
3. 产物只写文件名，且必须是 `.md`：
   - 可以：`release-notes.md`
   - 不可以：`docs/release-notes.md`、`../release-notes.md`、`C:\tmp\release-notes.md`、`release-notes.v1.md`、`release-notes.txt`
4. 研究笔记的名字由核心固定，不需要我在任务里写。
5. 同一目录下已有未结束的多节点实例（无论编码闭环还是通用任务闭环）时，新发起会被拒绝，并告诉我占用目录的实例号。

**发起后先看到什么**

```text
实例 INST-001 · 运行中 · 模板 通用任务闭环
会话已创建 sess-001
任务已投递
会话 执行中 · 已运行 1s
```

**发起前的四种拦截**

| 情况 | 我看到 | 退出码 |
|---|---|---|
| 任务为空 | `任务描述不能为空` | 1 |
| 没写 `产物：` 或用了半角冒号 | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）` | 1 |
| 产物带目录、非 `.md`、或自带版本号 | `通用任务闭环的产物只写文件名（.md），不能带路径：<我写的内容>` | 1 |
| 模板名不存在 | `未知模板：<名字>` | 1 |

四种情况都不会建实例、不会建会话、不会创建工作区目录。

### 2.3 B 看三个节点到哪

`orch status --instance INST-001` 的节点表：

```text
实例 INST-001 · 运行中 · 模板 通用任务闭环
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 6s
节点 T-003 审核者 待执行
会话 等待下游 · 产出已提交
交接包 HO-001  研究员→撰写者  已完成   10:00:04
交接包 HO-002  撰写者→审核者  已投递   10:00:10
升级 —
```

**"待校验"的两种限定词**

| 显示 | 含义 | 我该做什么 |
|---|---|---|
| `待校验（核对证据）` | 这一轮刚交完，核心正在核对文件是否存在、是否本轮新写、引用是否可解析 | 等几秒；不用我插手 |
| `待校验（等待下游）` | 它自己的活已经核对通过，下游还没接手；它还不算"已完成" | 等下游开始；这是正常状态 |

**"失败"的限定词**

| 显示 | 含义 |
|---|---|
| `失败（等待复审）` | 审核者已驳回，等撰写者改完再复审；不是异常 |
| `失败（等待复测）` | 只用于编码闭环；通用任务闭环不出现 |

**节点行的三个后缀**

- `· 产物 <引用>`：研究员或撰写者本轮交出的文件（研究笔记或文档版本）。
- `· 审核 通过`：审核者本轮确认通过。
- `· 审核 驳回 · 缺陷 N 条`：审核者本轮驳回，并给出 N 条缺陷。

**耗时口径**：节点耗时只算"它自己干活"的区间。研究员核对通过后去等下游，等待时间不计入它的耗时；审核者从被派发到交审核文件，算自己的耗时。

**会话行**：只显示当前（最后一个）会话。上游在等下游时，如果它是最后一个会话，会显示 `会话 等待下游 · 产出已提交`；下游开始后，会话行切换到下游。

### 2.4 C 审核驳回时自动回流

审核者把结论写进任务目录下的 `out/review.json`。驳回样本：

```json
{
  "decision": "reject",
  "artifact": "artifacts/docs/release-notes.v1.md",
  "defects": [
    {
      "summary": "缺少「回滚方案」一节",
      "evidence": "artifacts/docs/release-notes.v1.md#L1"
    },
    {
      "summary": "升级步骤没有说明旧版本数据如何迁移",
      "evidence": "artifacts/docs/release-notes.v1.md#L18"
    }
  ],
  "revisionRequirement": "补写「回滚方案」一节；在升级步骤中说明数据迁移与回退顺序。"
}
```

核心读到合法驳回后：

1. 审核者节点落 `失败（等待复审）`，节点行显示 `审核 驳回 · 缺陷 2 条`。
2. 核心构造一张回流交接包，方向是 `审核者→撰写者（回流）`，内容包含：
   - 两条缺陷的摘要与证据位置；
   - 修改要求；
   - 上一版文档引用 `artifacts/docs/release-notes.v1.md`；
   - 本轮要写的新版本引用 `artifacts/docs/release-notes.v2.md`。
3. 撰写者被重新打开为"执行中 · 第 2 轮"。它收到的提示词里逐条列出缺陷、证据与修改要求，并明确"不得改写上一版文件"。
4. 撰写者交出新版本后，审核者从"失败（等待复审）"重新打开为"执行中 · 第 2 轮"（复测）。
5. 复测通过 → 闭环完成；复测仍驳回 → 到上限，进入升级。

**版本规则**：

- 第 1 轮写 `artifacts/docs/release-notes.v1.md`；第 2 轮写 `artifacts/docs/release-notes.v2.md`。
- 每一轮都是**完整文档**，不是补丁；旧版本原样保留。
- 核心在核对第 2 轮产出时，同时复核第 1 轮还在、且内容没被改过；被删或被改都会停下升级，不会假装通过。

**审核者不改文档**：驳回意见只写在审核文件里；改由撰写者做。这样"谁改了什么"始终可追溯。

### 2.5 D 到上限就停

- 审核者最多派发 **2 次**（第 1 轮审核 + 第 2 轮复测）。
- 撰写者也最多 2 轮；第 2 轮产物核对通过后才会再次派发审核。
- 第 2 轮审核仍驳回时，核心**不再构造第 3 次回流**：

```text
实例 INST-001 · 已挂起 · 模板 通用任务闭环
升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮
下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001
```

原因、节点轮次和两条缺陷在随后 `orch status --instance INST-001` 的升级块里逐行给出：

```text
升级 ESC-001 待处理
  原因：回流超上限：审核者已派发 2 次仍未通过
  节点：T-003 审核者 · 第 2 轮
  缺陷：缺少「回滚方案」一节（证据 artifacts/docs/release-notes.v2.md#L1）
  缺陷：升级步骤没有说明旧版本数据如何迁移（证据 artifacts/docs/release-notes.v2.md#L18）
  下一步：本版本只能查看；要终止请执行 orch cancel --instance INST-001
```

- `orch run` 自己结束，不报错，退出码 4。
- 挂起后等 60 秒再查：没有新事件、没有新派发、没有新会话。
- 重启核心后仍是"已挂起"，轮次与升级都在；不会自动重试。
- 本版本没有"人工裁决继续"的入口；要终止就取消（I1.4 再补裁决）。

### 2.6 E 升级了看得懂

**升级原因一览**

| 我看到的原因 | 发生在哪 | 含义 | 我该做什么 |
|---|---|---|---|
| `回流超上限：审核者已派发 2 次仍未通过` | 审核第 2 轮驳回 | 两轮都没过 | 看缺陷，决定是否取消后重开 |
| `核对失败：未找到审核文件 out/review.json` | 审核者回合结束 | 审核者没交文件 | 查审核者会话；本版本只能取消 |
| `核对失败：审核文件不是本轮新写 out/review.json` | 审核者回合结束 | 交的是旧文件 | 同上 |
| `核对失败：审核文件不可解析` | 审核者回合结束 | 不是合法 JSON 或结构不对 | 同上 |
| `核对失败：审核结论只能是 pass 或 reject` | 审核者回合结束 | `decision` 写了别的 | 同上 |
| `核对失败：审核未引用本轮文档` | 审核者回合结束 | 没写 `artifact` | 同上 |
| `核对失败：审核引用的不是本轮文档 <引用>` | 审核者回合结束 | 引用了旧版或别的文件 | 同上 |
| `核对失败：审核为通过，但缺陷清单非空` | 审核者回合结束 | 自相矛盾 | 同上 |
| `核对失败：审核为驳回，但没有缺陷清单` | 审核者回合结束 | 无法执行的回流 | 同上 |
| `核对失败：审核缺陷缺少摘要或证据` | 审核者回合结束 | 缺陷条目不完整 | 同上 |
| `核对失败：缺陷证据不可解析 <证据>` | 审核者回合结束 | 证据文件找不到或越界 | 同上 |
| `核对失败：未找到声明的产出 <引用>` | 研究员 / 撰写者回合结束 | 文件没写出来 | 查该角色会话 |
| `核对失败：产出为空 <引用>` | 研究员 / 撰写者回合结束 | 写了空文件 | 同上 |
| `核对失败：产出不是本轮新写 <引用>` | 研究员 / 撰写者回合结束 | 旧文件冒充本轮 | 同上 |
| `核对失败：上一版文档缺失 <引用>` | 撰写者第 2 轮 | 上一版被删 | 同上 |
| `核对失败：上一版文档被改写 <引用>` | 撰写者第 2 轮 | 上一版被覆盖 | 同上 |
| `派遣失败：目标会话不可用` | 任一派发 | 会话建不起来 | 查宿主；取消后重开 |
| `执行失败：<原文>` | 任一回合 | 宿主报错、拒绝或取消 | 查会话与宿主日志 |

**升级块固定四段**：升级号与状态、原因、节点与轮次、缺陷（有则逐条），最后一行"下一步"。节点行只显示 `已升级`，具体原因在升级块里，不在节点行里堆。

**升级不是失败**：`orch run` 以"挂起"结束，退出码 4；不要用"失败"两个字去理解它。

**升级本身写不进去时**（例如状态文件写入失败）：核心不会假装挂起，也不会继续派发。它会停住并这样收尾：

```text
无法记录升级：<原因>；已停止推进
实例 INST-001 · 运行中 · 已停止推进 · 模板 通用任务闭环
节点 T-003 审核者 待校验（升级未记录） · 第 1 轮
下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，只能取消
```

- 退出码 5；节点保持升级前的状态（这里停在"待校验"），不会被改成"失败"或"已升级"。
- 实例仍是"运行中"，但带"已停止推进"；不会再自动派发，只能取消。
- 等 60 秒再查也不会自己恢复。

### 2.7 F 版本化文件区与审核文件

**目录**

```text
<任务目录>/
├── .orch/instances/INST-001/workspace/
│   └── artifacts/
│       ├── docs/
│       │   ├── release-notes.v1.md      # 第 1 轮
│       │   └── release-notes.v2.md      # 第 2 轮（若发生驳回）
│       └── reports/
│           └── research-notes.v1.md     # 研究员交的研究笔记
└── out/review.json                      # 审核者每轮覆盖写
```

说明：

- `artifacts/docs/` 与 `artifacts/reports/` 由核心在实例创建时建好；`shared/`、`stage/`、`status.md` 属于 I1.4，本迭代不出现。
- 交付文档的引用统一写成 `artifacts/docs/<名>.v<轮次>.md`；研究笔记统一写成 `artifacts/reports/research-notes.v1.md`。
- 这些引用是**工作区相对路径**，不是任务目录相对路径；用户不需要记绝对路径。

**审核文件**

- 位置：任务目录下 `out/review.json`，每轮由审核者覆盖写。
- 通过：

```json
{
  "decision": "pass",
  "artifact": "artifacts/docs/release-notes.v2.md",
  "defects": []
}
```

- 驳回：`decision` 为 `reject`，`defects` 至少一条，每条有 `summary` 与 `evidence`；`revisionRequirement` 建议写，没写时核心使用"请按缺陷清单逐条修改后交出新版本"。
- `artifact` 必须等于本轮文档引用，不能写上一版，也不能写研究笔记。
- 证据路径必须是工作区相对路径，可以带 `#L<行号>`；绝对路径、盘符、`..` 一律不接受。
- 核心只读这个文件；审核者在对话里说"通过了"但文件写的是 `reject`，按 `reject` 处理；反之亦然。

**"本轮新写"怎么判**

- 研究笔记 / 文档：文件的最后修改时间必须不早于本轮派发时间。
- 审核文件：文件的最后修改时间必须不早于审核者本轮派发时间。
- 上一版文档：每轮核对通过时记录内容指纹；下一轮**产出核对时**复核指纹未变（不是下一轮开始前）。

### 2.8 G 取消、老实例与共存

**取消**

```bash
orch cancel --instance INST-001
```

- 正在执行的节点、待校验的节点、失败等待复审的节点、已升级的节点都会收成"已取消"。
- 已构造未投递的交接包记"已拒绝 · 已撤回"；已投递或已被下游接受的同样撤回。
- 待处理的升级作废。
- 已完成的节点保持"已完成"，不会被取消回滚。
- 一般 5 秒内收敛；收完后会话不再执行。

**老实例**

- I1.1 的旧格式实例仍然只能查看，不能取消、不能重跑、不能继续。
- I1.2 的编码闭环实例在本版本可以照常查看与取消；它们的状态与输出不受通用任务闭环影响。

**与编码闭环共存**

- 同一目录下两种闭环不能同时跑；第二个发起会被 `DIR_BUSY` 拦下。
- 编码闭环保持 I1.2 的显示与时机：测试判定不通过时，测试节点直接显示"失败（等待复测）"，不出现"待校验（等待下游）"（R-1）。
- 通用任务闭环才使用"待校验（核对证据）→ 待校验（等待下游）→ 已完成"这条门控。

### 2.9 功能之间的衔接：走完一遍

下面是一次"一轮驳回、一轮通过"的完整走查。每一步都给出我会看到的节点表（省略未变化行）。

**第 1 步：发起**

```text
实例 INST-001 · 运行中 · 模板 通用任务闭环
会话已创建 sess-001
任务已投递
会话 执行中 · 已运行 1s
```

**第 2 步：研究完成，撰写者接手**

```text
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 执行中 · 第 1 轮
节点 T-003 审核者 待执行
交接包 HO-001  研究员→撰写者  已接受   10:00:04
```

研究员交出的研究笔记成为撰写者的输入；撰写者的提示词里写明研究笔记引用与本轮要写的文档引用。

**第 3 步：撰写者交 v1，审核者接手**

```text
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 6s
节点 T-003 审核者 执行中 · 第 1 轮
交接包 HO-002  撰写者→审核者  已投递   10:00:10
```

此时 v1 已经通过"存在、非空、本轮新写"的核对；撰写者在等审核者接手。

**第 4 步：审核者驳回**

```text
节点 T-002 撰写者 执行中 · 第 2 轮
节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 3s · 审核 驳回 · 缺陷 2 条
交接包 HO-003  审核者→撰写者（回流）  已接受   10:00:13
```

撰写者在审核者接手时先变成"已完成"，紧接着被回流重新打开为第 2 轮；HO-001 仍是"已完成"（它在撰写者第 1 轮产出核对通过时就已消费）。

**第 5 步：撰写者交 v2**

```text
节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 7s
节点 T-003 审核者 执行中 · 第 2 轮
交接包 HO-003  审核者→撰写者（回流）  已完成   10:00:13
交接包 HO-004  撰写者→审核者（复测）  已投递   10:00:20
```

v2 已写出，上一版 v1 复核未变、原样保留；审核者从"失败（等待复审）"重新打开为第 2 轮，正在复测。

**第 6 步：复测通过，闭环完成**

```text
实例 INST-001 · 已完成 · 模板 通用任务闭环
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 7s · 产物 artifacts/docs/release-notes.v2.md
节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 3s · 审核 通过
交接包 HO-001 ~ HO-004 均已完成
升级 —
```

`orch run` 退出码 0。`artifacts/docs/` 下同时存在 v1 与 v2；v1 的内容与第 1 轮记录一致。

**另一条走查：审核文件缺失**

`orch run` 的收尾：

```text
实例 INST-001 · 已挂起 · 模板 通用任务闭环
升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 1 轮
下一步：查看详情 orch status --instance INST-001 --events；本版本不能继续，要终止请执行 orch cancel --instance INST-001
```

随后 `orch status --instance INST-001`（省略会话与交接包行）：

```text
节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 5s · 产物 artifacts/docs/release-notes.v1.md
节点 T-003 审核者 已升级 · 第 1 轮
升级 ESC-001 待处理
  原因：核对失败：未找到审核文件 out/review.json
  节点：T-003 审核者 · 第 1 轮
```

撰写者保持"已完成"（它的产物没问题），审核者"已升级"，没有第 4 次派发，也没有回流包。

### 2.10 用户可见的业务规则

| 编号 | 规则 | 覆盖 AC |
|---|---|---|
| **BR-01** | 通用任务闭环固定三个节点，按"研究 → 撰写 → 审核"顺序推进；第一个执行的是研究员 | AC-01 |
| **BR-02** | 发起任务必须非空，且含唯一一行 `产物：<文件名>.md`（全角冒号、裸文件名、`.md`、不带版本号） | AC-01、AC-22、AC-23 |
| **BR-03** | 同一目录不能同时存在两个未结束的多节点实例（编码闭环与通用任务闭环互斥） | AC-25、AC-26 |
| **BR-04** | 运行中、已挂起、已结束的实例都不能在原实例上再次发起 | AC-27 |
| **BR-05** | 研究笔记固定交到 `artifacts/reports/research-notes.v1.md` | AC-02、AC-21 |
| **BR-06** | 撰写产物固定交到 `artifacts/docs/<名>.v<轮次>.md`，第 1 轮是 v1 | AC-03、AC-07、AC-09、AC-40 |
| **BR-07** | 每一轮写新版本，旧版本不得被改写或删除；旧版被删/被改时停下升级 | AC-07、AC-09、AC-20、AC-40 |
| **BR-08** | 文档与研究笔记必须存在、非空、且是本轮新写 | AC-03、AC-19、AC-21 |
| **BR-09** | 审核结论只认 `out/review.json`，不认对话 | AC-13、AC-32 |
| **BR-10** | 审核文件必须是审核者本轮新写 | AC-14 |
| **BR-11** | 审核结论只能是 `pass` 或 `reject` | AC-15 |
| **BR-12** | 审核引用的文档必须等于本轮文档引用 | AC-16 |
| **BR-13** | 通过时缺陷清单必须为空；驳回时必须至少一条缺陷，每条含摘要与证据 | AC-17 |
| **BR-14** | 缺陷证据必须能在工作区内解析；绝对路径、盘符、`..` 不接受 | AC-18 |
| **BR-15** | 审核文件无效时一律升级挂起，不回流、不再派发 | AC-13 ~ AC-18、AC-31 |
| **BR-16** | 产物无效时一律升级挂起，不派发下游 | AC-19、AC-20、AC-21、AC-30 |
| **BR-17** | 审核驳回且未到上限时，自动回流到撰写者，撰写轮次 +1 | AC-07、AC-09、AC-40 |
| **BR-18** | 审核最多 2 轮；第 2 轮仍驳回 → 停止回流、升级、挂起 | AC-10、AC-11、AC-40 |
| **BR-19** | 撰写最多 2 轮；第 2 轮产物核对通过后才再次派发审核 | AC-07、AC-09 |
| **BR-20** | 同一节点正在执行或待校验时，重复投递被拒 | AC-41 |
| **BR-21** | 每次派发（首派除外）对应一张交接包，编号连续、不跳号 | AC-33 |
| **BR-22** | 交接包带本轮引用、上一版引用、缺陷、证据与修改要求 | AC-02、AC-03、AC-08 |
| **BR-23** | 下游接受前，上游保持"待校验（等待下游）"，不显示"已完成" | AC-04、AC-05、AC-35、AC-41 |
| **BR-24** | 下游首个工作事件到达后，上游才变"已完成"；交接包随后在目标产出核对通过时变"已完成" | AC-05、AC-34、AC-35 |
| **BR-25** | 已完成的上游可以被下游驳回重新打开（撰写者 done → running） | AC-07 |
| **BR-26** | 已产出、等下游接手的会话显示"会话 等待下游 · 产出已提交" | AC-04 |
| **BR-27** | 取消把节点、交接包、升级收敛到终态，5 秒内完成 | AC-28 |
| **BR-28** | 已升级节点只能取消，不能继续 | AC-29 |
| **BR-29** | 重启后挂起仍挂起、升级仍在、失败仍等待复审，不自动推进 | AC-11、AC-12 |
| **BR-30** | I1.1 旧格式实例只读可查 | AC-37 |
| **BR-31** | `single` 与 `code-loop` 的输出与行为不因本迭代改变 | AC-24、AC-36 |
| **BR-32** | "待校验（等待下游）"只在通用任务闭环启用；编码闭环保持 I1.2 口径 | AC-36 |
| **BR-33** | 所有产物与证据路径不得越出实例工作区 | AC-23、AC-18 |
| **BR-34** | 审核读取、通过、驳回、无效、下游接受、回流、超上限、升级都写入事件记录 | AC-39 |
| **BR-35** | 通用任务闭环与编码闭环共用同一套推进、回流、上限与升级逻辑 | AC-38 |
| **BR-36** | 节点行必须显示这一轮的产物或审核结论，便于我知道它交了什么 | AC-04、AC-06、AC-07 |
| **BR-37** | 升级写不进去时实例停住并明确显示"已停止推进"，不伪装成挂起或完成，也不再派发 | AC-30 |

---

## 三、验收标准（用户视角）

> 约定：每条 AC 默认使用**全新项目根**（`.orch` 为空）。"机检"表示读取 `.orch/instances/<id>/state.json`、`events.jsonl` 或 `.mock/prompts/<n>.json`；"夹具"表示按 §3.3 的场景名运行；"架构检查"不依赖运行实例。
> 状态字段的中文对照见附录 A；实现结构见附录 D-6。

### 3.1 功能验收标准（AC）

#### AC-01 发起通用任务闭环，三节点按序建好
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：低 ｜ **规则**：BR-01、BR-02、BR-05
```gherkin
Given 全新项目根，我先执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --prepare-only
When 我执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --keep
Then 10 秒内输出含"实例 INST-001 · 运行中 · 模板 通用任务闭环"
And 输出含"会话已创建 sess-xxx"与"任务已投递"
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-001 研究员 执行中 · 第 1 轮"
And 输出含"节点 T-002 撰写者 待执行"
And 输出含"节点 T-003 审核者 待执行"
And 机检：nodes 依次为 T-001/T-002/T-003，roleId 依次为 researcher/writer/reviewer
And 机检：只有 T-001 的 state='running' 且 round=1；其余 round=0、state='pending'
And 机检：`.orch/instances/INST-001/workspace/artifacts/docs` 与 `.../artifacts/reports` 都存在
```

#### AC-02 研究完成后，撰写者收到研究笔记与写作路径
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-05、BR-06、BR-22
```gherkin
Given 夹具场景 doc-pass 已用 --stop-after 2 跑完（研究员与撰写者第 1 轮均已核对通过，审核者尚未派发）
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-001 研究员 已完成 · 第 1 轮"
And 输出含"产物 artifacts/reports/research-notes.v1.md"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"
And 输出含"交接包 HO-001  研究员→撰写者  已完成"
And 机检：`.mock/prompts/2.json` 的 `task` 字段（完整提示词原文）同时含"研究笔记：artifacts/reports/research-notes.v1.md"与"本轮文档引用：artifacts/docs/release-notes.v1.md"
And 机检：prompt 含写入路径".orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md"
And 机检：`.orch/instances/INST-001/workspace/artifacts/reports/research-notes.v1.md` 存在且非空
```

#### AC-03 撰写完成后，审核者收到本轮文档引用
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-06、BR-08、BR-22
```gherkin
Given 夹具场景 doc-pass 已完整跑完
Then 机检：`.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v1.md` 存在且 bytes > 0
And 机检：`.mock/prompts/3.json` 的 `task` 字段含"本轮文档引用：artifacts/docs/release-notes.v1.md"
And 机检：prompt 含审核文件路径"out/review.json"
And 机检：handoffs 中 HO-002 的 edge 为 {from:'T-002', to:'T-003', kind:'forward'}，state='consumed'
And 机检：handoffs 中 HO-002 的 artifactRefs.input 含 "artifacts/docs/release-notes.v1.md"
And 节点 T-002 的最终行含"产物 artifacts/docs/release-notes.v1.md"
```

#### AC-04 待校验的两种限定词与会话等待行
- **验证面**：混合 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-23、BR-26、BR-36
```gherkin
Given 全新根 A，场景 doc-pass 以 MAESTRO_TEST_PAUSE=after_output:T-002 --keep 启动
When 我等到 `.mock/paused` 出现，执行 orch status --instance INST-001
Then 输出含"节点 T-002 撰写者 待校验（核对证据） · 第 1 轮"
And 输出不含"待校验（等待下游）"
Given 另起全新根 B，场景 doc-pass 以 --stop-after 2 --keep 启动
When 我等到 `.mock/stopped-after-2` 出现，执行 orch status --instance INST-001
Then 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"
And 输出含"会话 等待下游 · 产出已提交"
And 机检：T-002 的 state='review'，reviewReason='downstream'
And 机检：T-001 的 state='done'
```

#### AC-05 下游接受之后，上游才变已完成
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-23、BR-24
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：events 中存在 object='node'、objectId='T-001'、to='done'、reason='review.downstream_accepted' 的事件
And 机检：该事件的 seq 大于 HO-001 的 accepted 事件 seq
And 机检：存在 objectId='T-002'、to='done'、reason='review.downstream_accepted' 的事件，其 seq 大于 HO-002 的 accepted 事件 seq
And 机检：不存在 T-001/T-002 在对应 handoff accepted 之前就 to='done' 的记录
And 机检：T-001/T-002 最终 reviewReason 为空，state='done'
```

#### AC-06 审核通过后闭环完成
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：低 ｜ **规则**：BR-36
```gherkin
Given 夹具场景 doc-pass 已完整跑完
Then 命令退出码是 0
And 输出含"节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/reports/research-notes.v1.md"
And 输出含"节点 T-002 撰写者 已完成 · 第 1 轮 · 耗时 <d> · 产物 artifacts/docs/release-notes.v1.md"
And 输出含"节点 T-003 审核者 已完成 · 第 1 轮 · 耗时 <d> · 审核 通过"
And 输出含"升级 —"
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已完成 · 模板 通用任务闭环"
And 机检：实例 state='completed'，三个节点 state 都是 'done'
And 机检：sessions 中每一轮派发的会话 state 最终都是 'idle'
And 机检：handoffs 全部 state='consumed'，且 consumedAt 非空
```

#### AC-07 审核第 1 轮驳回 → 自动回流，撰写者交出新版本
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：高 ｜ **规则**：BR-06、BR-07、BR-17、BR-25
```gherkin
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 跑完（撰写者第 2 轮已核对通过，审核者第 2 次尚未派发）
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-003 审核者 失败（等待复审） · 第 1 轮"
And 输出含"审核 驳回 · 缺陷 2 条"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 2 轮"
And 输出含"交接包 HO-003  审核者→撰写者（回流）"
And 机检：`.orch/instances/INST-001/workspace/artifacts/docs/release-notes.v2.md` 存在且非空
And 机检：v1 的 sha256 与第 1 轮 artifactHistory 中记录的一致
And 机检：T-002 的 round=2；T-003 的 round=1、state='failed'、note='等待复审'
```

#### AC-08 回流内容带齐缺陷、证据、修改要求与上一版引用
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：高 ｜ **规则**：BR-22
```gherkin
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 跑完
Then 机检：HO-003 的 edge.kind='backflow'，defects 恰好 2 条
And 机检：每条 defect 的 summary 与 evidence 都非空，evidence 指向 v1
And 机检：HO-003 的 revisionRequirement 非空
And 机检：HO-003 的 artifactRefs.previous = {ref:'artifacts/docs/release-notes.v1.md', sha256:<非空>}
And 机检：HO-003 的 artifactRefs.output = 'artifacts/docs/release-notes.v2.md'
And 机检：`.mock/prompts/4.json` 的 `task` 字段含两条"缺陷 <i>：…（证据 …）"
And 机检：该 `task` 含"修改要求："与"上一版文档引用：artifacts/docs/release-notes.v1.md"
And 机检：该 `task` 含"本轮文档引用：artifacts/docs/release-notes.v2.md"
```

#### AC-09 第 2 轮通过 → 闭环完成，两版共存
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-06、BR-07、BR-19
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 命令退出码是 0
And 输出含"节点 T-002 撰写者 已完成 · 第 2 轮"
And 输出含"节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过"
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已完成 · 模板 通用任务闭环"
And 机检：v1 与 v2 同时存在，且 v1 的 sha256 与第 1 轮记录一致
And 机检：T-003 的 review.decision='pass'、review.artifact='artifacts/docs/release-notes.v2.md'
And 机检：实例 state='completed'，无 pending 升级
```

#### AC-10 审核第 2 轮驳回 → 停止回流、升级挂起
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-18
```gherkin
Given 夹具场景 doc-reject-twice 已完整跑完
Then 命令在 60 秒内结束，退出码是 4
And 输出含"实例 INST-001 · 已挂起 · 模板 通用任务闭环"
And 输出含"升级 ESC-001 待处理 · 节点 T-003 审核者 · 第 2 轮"
When 我执行 orch status --instance INST-001
Then 输出含"原因：回流超上限：审核者已派发 2 次仍未通过"
And 输出含"节点：T-003 审核者 · 第 2 轮"
And 输出含两条"缺陷："行
And 机检：实例 state='suspended'
And 机检：T-003 state='escalated'、round=2；T-002 state='done'、round=2
And 机检：counters.dispatchCount=5；handoffs 恰好 4 条，没有 HO-005
And 机检：escalations 恰好 1 条，state='pending'，defects 2 条
```

#### AC-11 挂起后不再自动推进
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-18、BR-29
```gherkin
Given AC-10 的实例已挂起，核心仍在运行
When 我等待 60 秒
Then 机检：dispatchCount 仍为 5
And 机检：events.jsonl 行数与等待前相同
And 机检：sessions 数量不再增加
And 机检：T-003 仍为 'escalated'，实例仍为 'suspended'
```

#### AC-12 重启后仍挂起，轮次与升级都在
- **验证面**：夹具 ｜ **类型**：恢复 ｜ **风险**：中 ｜ **规则**：BR-29
```gherkin
Given AC-10 的实例已挂起
When 我执行 orch core stop
And 我重新执行一次 orch status --instance INST-001（必要时自动拉起核心）
Then 第一行含"已挂起"，不含"已中断"
And 输出仍含"升级 ESC-001 待处理"与"回流超上限"
And 机检：T-002 round=2、T-003 round=2，与重启前一致
And 机检：没有新增 node.dispatch 事件
```

#### AC-13 审核文件缺失 → 升级，不回流
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-09、BR-15
```gherkin
Given 夹具场景 review-missing 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到审核文件 out/review.json"
And 输出含"节点 T-003 审核者 已升级"
And 输出含"节点 T-002 撰写者 已完成"
And 机检：T-003 state='escalated'；T-002 state='done'
And 机检：counters.dispatchCount=3；handoffs 恰好 2 条，没有 HO-003
And 机检：events 中没有 backflow.constructed
```

#### AC-14 审核文件不是本轮新写 → 单独原因
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-10、BR-15
```gherkin
Given 夹具场景 review-stale 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核文件不是本轮新写 out/review.json"
And 输出不含"未找到审核文件"
And 机检：T-003 state='escalated'；counters.dispatchCount=3
```

#### AC-15 审核文件不可解析或结论非法
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-11、BR-15
```gherkin
Given 夹具场景 review-bad-json 已完整跑完
Then 退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核文件不可解析"
Given 另起全新根，夹具场景 review-decision-invalid 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核结论只能是 pass 或 reject"
And 机检：两次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
```

#### AC-16 审核未引用或引用了别的文档
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-12、BR-15
```gherkin
Given 夹具场景 review-artifact-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核未引用本轮文档"
Given 另起全新根，夹具场景 review-artifact-mismatch 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核引用的不是本轮文档 artifacts/docs/orphan.md"
And 机检：两次的 T-003 state 都是 'escalated'
And 机检：都没有 backflow.constructed，也没有 HO-003
```

#### AC-17 审核结论与缺陷清单自相矛盾
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-13、BR-15
```gherkin
Given 夹具场景 review-pass-with-defects 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核为通过，但缺陷清单非空"
Given 另起全新根，夹具场景 review-reject-no-defects 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核为驳回，但没有缺陷清单"
Given 另起全新根，夹具场景 review-defect-shape 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：审核缺陷缺少摘要或证据"
And 机检：三次的 T-003 state 都是 'escalated'，dispatchCount 都是 3
```

#### AC-18 缺陷证据不可解析
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-14、BR-15
```gherkin
Given 夹具场景 review-evidence-unreadable 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：缺陷证据不可解析 artifacts/docs/missing.md#L3"
Given 另起全新根，夹具场景 review-evidence-outside 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：缺陷证据不可解析 ../outside.md#L1"
And 机检：两次的 T-003 state 都是 'escalated'
And 机检：escalations[0].defects 为空（未校验通过的缺陷不进入升级块）
```

#### AC-19 撰写产物缺失、为空或不是本轮新写
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-08、BR-16
```gherkin
Given 夹具场景 doc-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到声明的产出 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-empty 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出为空 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-stale 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出不是本轮新写 artifacts/docs/release-notes.v1.md"
And 机检：三次都是 T-002 state='escalated'、T-003 state='pending'
And 机检：三次的 counters.dispatchCount 都是 2
And 机检：三次都没有名为 HO-002 的交接包
```

#### AC-20 上一版被改写或删除
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-07、BR-16
```gherkin
Given 夹具场景 doc-previous-modified 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：上一版文档被改写 artifacts/docs/release-notes.v1.md"
Given 另起全新根，夹具场景 doc-previous-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：上一版文档缺失 artifacts/docs/release-notes.v1.md"
And 机检：两次都是 T-002 state='escalated'、round=2
And 机检：两次的 T-003 state='failed'、round=1（保持等待复审）
And 机检：两次的 counters.dispatchCount 都是 4
And 机检：两次都没有第三次 backflow 交接包
```

#### AC-21 研究笔记缺失、为空或不是本轮新写
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-05、BR-08、BR-16
```gherkin
Given 夹具场景 research-missing 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：未找到声明的产出 artifacts/reports/research-notes.v1.md"
Given 另起全新根，夹具场景 research-empty 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出为空 artifacts/reports/research-notes.v1.md"
Given 另起全新根，夹具场景 research-stale 已完整跑完
When 我执行 orch status --instance INST-001
Then 输出含"原因：核对失败：产出不是本轮新写 artifacts/reports/research-notes.v1.md"
And 机检：三次都是 T-001 state='escalated'、T-002 state='pending'
And 机检：三次的 counters.dispatchCount 都是 1
```

#### AC-22 发起前拦截空任务与缺产物行
- **验证面**：用户可见 ｜ **类型**：异常 ｜ **风险**：低 ｜ **规则**：BR-02
```gherkin
Given 全新项目根
When 我执行 orch run --template task-loop --task ""
Then 输出含"任务描述不能为空"，退出码 1
When 我执行 orch run --template task-loop --task "写一篇发布说明，但没有产物行"
Then 输出含"通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）"，退出码 1
When 我执行 orch run --template task-loop --task "写一篇发布说明。产物: release-notes.md"
Then 同样输出上面的提示，退出码 1
And 机检：三次之后 `.orch/instances` 仍为空，没有创建工作区目录
```

#### AC-23 发起前拦截非法产物名
- **验证面**：用户可见 ｜ **类型**：异常 ｜ **风险**：低 ｜ **规则**：BR-02、BR-33
```gherkin
Given 全新项目根
When 我依次用产物名 docs/release-notes.md、../release-notes.md、C:\\release-notes.md、release-notes.txt、release-notes.v1.md 发起 task-loop
Then 每次都输出"通用任务闭环的产物只写文件名（.md），不能带路径：<我写的内容>"，退出码 1
And 机检：五次之后 `.orch/instances` 仍为空
```

#### AC-24 未知模板仍被拒绝
- **验证面**：用户可见 ｜ **类型**：回归 ｜ **风险**：低 ｜ **规则**：BR-31
```gherkin
Given 全新项目根
When 我执行 orch run --template taskloop --task "…产物：release-notes.md"
Then 输出含"未知模板：taskloop"，退出码 1
And 机检：`.orch/instances` 为空
```

#### AC-25 同一目录不能同时跑两个通用任务闭环
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-03
```gherkin
Given 夹具场景 doc-hold-research --keep 让 INST-001 在 demo-doc 目录运行
When 我在项目根发起第二个 task-loop（--task "…产物：second.md"），--cwd 仍指向 demo-doc
Then 输出含"该目录已有未结束的实例 INST-001，本次未发起"，退出码 1
And 机检：`.orch/instances` 仍只有 INST-001
```

#### AC-26 编码闭环与通用任务闭环同目录互斥
- **验证面**：混合 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-03
```gherkin
Given 夹具场景 doc-hold-research --keep 让 INST-001 在 demo-doc 目录运行
When 我用同一目录发起 code-loop（--cwd ./demo-doc --task "…产物：calc.js"）
Then 输出含"该目录已有未结束的实例 INST-001，本次未发起"，退出码 1
And 机检：没有生成第二个实例
```

#### AC-27 已挂起实例不能再次发起
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：低 ｜ **规则**：BR-04
```gherkin
Given 夹具场景 doc-reject-twice 已跑完，INST-001 已挂起
When 我执行 orch run --instance INST-001 --template task-loop --task "…产物：release-notes.md"
Then 输出含"该实例已挂起，不能再次发起；如要重来请新建实例"，退出码 1
And 机检：INST-001 仍是 suspended，escalations 数量不变
```

#### AC-28 运行中取消 5 秒内收敛
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-27
```gherkin
Given 夹具场景 doc-slow-reviewer --keep 让撰写者完成、审核者正在执行
When 我执行 orch cancel --instance INST-001
Then 命令在 5 秒内结束，退出码 0
And 机检：实例 state='cancelled'
And 机检：T-001/T-002 state='done'，T-003 state='cancelled'
And 机检：所有 state 为 created/delivered/accepted 的 handoff 都变 'rejected'，rejectReason='withdrawn'
And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency
```

#### AC-29 已升级节点也能被取消
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-28
```gherkin
Given 夹具场景 doc-reject-twice 已跑完，T-003 已升级、实例已挂起
When 我执行 orch cancel --instance INST-001
Then 退出码是 0
And 机检：实例 state='cancelled'
And 机检：T-003 state='cancelled'（不是 'escalated'）
And 机检：escalations[0].state='voided'
```

#### AC-30 升级写不进去时不假装挂起
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-37
```gherkin
Given 全新项目根，task-loop-driver --scenario review-missing --prepare-only 已写好 .mock 与 host 配置
And 核心已停
When 我用 MAESTRO_FAULT=state_write:escalation NODE_ENV=test 启动场景
Then 命令在 10 秒内结束，退出码是 5
And 输出含"无法记录升级："与"；已停止推进"
And 输出含"运行中 · 已停止推进"，不含"已挂起"
And 输出含"节点 T-003 审核者 待校验（升级未记录） · 第 1 轮"
And 输出不含以"交接包 HO-"开头的行
And 机检：state='running'，halted=true，escalations 为空
And 机检：T-003 state='review'（不是 'failed'，也不是 'escalated'）
```

#### AC-31 审核无效时不留下回流包、不再派发
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：高 ｜ **规则**：BR-15
```gherkin
Given 夹具场景 review-missing 已完整跑完
Then 机检：counters.dispatchCount=3
And 机检：events 中没有 reason='backflow.constructed'
And 机检：handoffs 中没有 edge.kind='backflow'
And 机检：T-002 state='done'，T-003 state='escalated'
And 机检：T-003 对应的会话 state='escalated'
```

#### AC-32 审核以文件为准，不以对话为准
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-09
```gherkin
Given 夹具场景 review-says-pass 已用 --stop-after 4 跑完（审核者的消息说"全部通过"，但 out/review.json 写的是 reject；回流已投递，T-002 第 2 轮已核对通过）
When 我查状态
Then 机检：T-003 第 1 轮留下 review.decision='reject'，并发生回流（存在 edge.kind='backflow'）
Given 另起全新根，夹具场景 review-says-reject 的消息说"不通过"，但文件写的是 pass
Then 机检：T-003 review.decision='pass'，实例 state='completed'
And 机检：没有 edge.kind='backflow' 的交接包
```

#### AC-33 每次派发对应一张交接包，编号连续
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-21
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：handoffs 恰好 4 条，handoffId 依次是 HO-001、HO-002、HO-003、HO-004
And 机检：edge.kind 依次是 forward、forward、backflow、retest
And 机检：四条 state 都是 'consumed'，createdAt/consumedAt 都非空
And 机检：counters.dispatchCount=5（首派没有前置交接包）
And orch status --instance INST-001 --events 里的 [#序号] 严格递增、不跳号
```

#### AC-34 交接包 accepted 与 consumed 的时机
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-24
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：每张 handoff 的 acceptedAt 都晚于 deliveredAt
And 机检：acceptedSignal 是 turn 内事件名，不是 usage/available_commands 噪声
And 机检：每张 handoff 的 consumedAt 都晚于对应目标节点的 roundStartedAt
And 机检：没有 handoff 停在 created/delivered/accepted
```

#### AC-35 阶段耗时区间不重叠，等待下游不计入上游耗时
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：低 ｜ **规则**：BR-23、BR-24
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：T-001.endedAt ≤ T-002.startedAt
And 机检：T-002 第 1 轮 endedAt ≤ T-003 第 1 轮 startedAt
And 机检：T-002 第 2 轮 endedAt ≤ T-003 第 2 轮 startedAt
And 机检：T-002 的 endedAt 早于 HO-002 的 acceptedAt（等待下游不计入耗时）
And 节点行不含"耗时 0s"
```

#### AC-36 编码闭环与单节点输出不回归
- **验证面**：混合 ｜ **类型**：回归 ｜ **风险**：高 ｜ **规则**：BR-31、BR-32
```gherkin
Given 我执行 I1.2 的完整测试集（含 code-loop 夹具与 I1.1 单节点测试）
Then 全部通过
And 夹具场景 code-loop 的 retest-fail 输出中，测试节点直接是"失败（等待复测）"
And 输出不含"待校验（等待下游）"
And `single` 的 `orch run` 与 `orch status` 输出与 I1.1 验收样例逐字一致
And `code-loop` 的 A-1 / A-2 / A-3 / A-4 输出样例不变
```

#### AC-37 I1.1 旧格式实例只读可查
- **验证面**：夹具 ｜ **类型**：回归 ｜ **风险**：中 ｜ **规则**：BR-30
```gherkin
Given 项目根里放入 I1.1 的 v1 实例（schemaVersion=1）
When 我执行 orch status --instance <旧实例号>
Then 能正常显示实例行与节点行
And 我执行 orch cancel --instance <旧实例号> 或 orch run --instance <旧实例号> …
Then 输出含"该实例为旧格式，本版本只支持查看"，退出码 1
And 机检：旧实例的 state.json 字节未改变
```

#### AC-38 通用任务闭环与编码闭环共用同一引擎
- **验证面**：架构检查 ｜ **类型**：架构 ｜ **风险**：高 ｜ **规则**：BR-35
```gherkin
Given 源码工作区
Then `src/core/orchestrator.js`、`src/core/advance.js`、`src/core/graph.js` 中不出现字符串 'task-loop'、'researcher'、'writer'、'reviewer'、'研究员'、'撰写者'、'审核者'
And `src/core/orchestrator.js` 的推进入口仍是 `driveGraph` → `finishGraphNode` → `advance` → `planAdvance`
And `task-loop` 与 `code-loop` 的节点状态迁移都使用 `src/core/state-machine.js` 的同一张 node 表
And 新图只通过 `src/templates/index.js` 注入
And `src/core/review.js` 不出现任何模板名或角色名
```

#### AC-39 事件记录覆盖审核与下游门控
- **验证面**：夹具 ｜ **类型**：可观测 ｜ **风险**：中 ｜ **规则**：BR-34
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
When 我执行 orch status --instance INST-001 --events
Then 输出含"派发"、"读取审核"、"审核驳回"、"审核通过"、"证据核对通过"、"下游已接受"、"构造回流"、"交接已投递"、"已完成"
And 输出不含任何未翻译的英文 reason（如 'review.passed'、'node.dispatch'）
And 机检：events 中 object 覆盖 node / session / handoff
And 机检：review.read 的 detail 含 path='out/review.json' 与 results 计数
Given 另起全新根，夹具场景 review-bad-json 已完整跑完并挂起
When 我执行 orch status --instance INST-001 --events
Then 机检：review.invalid 的 detail 含 reasonCode 与 message
And 机检：events 中 object 覆盖 escalation，且含 escalation.created
```

#### AC-40 真实宿主上的"审核驳回 → 改稿 → 通过"（真实面）
- **验证面**：真实面 ｜ **类型**：主流程 ｜ **风险**：高（模型行为） ｜ **规则**：BR-06、BR-17、BR-18
```gherkin
Given 真实 DSH 可用，全新项目根 demo-doc-real
And 任务文本为：
  "写一篇发布说明，面向使用 v1.2 的开发者，必须包含「新功能」「升级步骤」「回滚方案」三节。
   第 1 轮先只写「新功能」与「升级步骤」，故意不要写「回滚方案」；审核会驳回，第 2 轮再补上「回滚方案」。
   产物：release-notes.md"
When 我执行 orch run --cwd ./demo-doc-real --template task-loop --task "<上面的任务>"
Then 命令在 10 分钟内结束，退出码 0
And 输出含"节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 <d> · 审核 通过"
And 机检：v1 与 v2 同时存在，v1 的 sha256 与第 1 轮记录一致
And 机检：存在 1 条 edge.kind='backflow' 的交接包，且其 defects 至少 1 条、证据可解析
And 机检：没有升级
And 若因模型未按话术写作导致第 1 轮未驳回，允许最多重试 3 次；3 次仍不稳定则记录为"真实面不稳定"，不阻塞本迭代
```

#### AC-41 同一节点被重复投递时被拒
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-20
```gherkin
Given 夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"撰写者 review(downstream)"
When 我执行 node test/fixtures/call-seam.mjs --root <根> --instance INST-001 --call dispatch --node T-002
Then 输出是单行 JSON，含 "ok":false 与 "code":"NODE_BUSY"
And 机检：T-002 仍是 'review'，round 仍为 1
And 机检：counters.dispatchCount 仍为 2
```

#### AC-42 派发失败 → 升级挂起，不假装执行中
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-16
```gherkin
Given 夹具场景 dispatch-fail-first 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
And 输出的第一行含"实例 INST-001 · 已挂起 · 模板 通用任务闭环"
When 我执行 orch status --instance INST-001
Then 输出含"原因：派遣失败：目标会话不可用"与"节点 T-001 研究员 已升级"
And 机检：实例 state='suspended'；T-001 state='escalated'；escalations[0].reasonCode='dispatch_failed'
And 机检：counters.dispatchCount=1；sessions 为空（首派会话没建起来）
```

#### AC-43 回合执行失败 → 升级挂起，不回流
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-16
```gherkin
Given 夹具场景 execution-fail 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：执行失败："与"节点 T-002 撰写者 已升级"
And 机检：实例 state='suspended'；T-001 state='done'；T-002 state='escalated'；escalations[0].reasonCode='execution_failed'
And 机检：counters.dispatchCount=2；没有 HO-002，也没有第 3 次派发
```

### 3.2 非功能验收标准

| 编号 | 要求 | 怎么验 |
|---|---|---|
| **NFR-01** | 不新增运行时依赖；`package.json` 的 `dependencies` 保持为空 | `npm ls --prod --depth=0` 无新增包 |
| **NFR-02** | 审核读取与版本核对在本机 50ms 内完成（≤ 5MB 文档） | 夹具计时；p95 ≤ 50ms |
| **NFR-03** | 每次状态落盘仍是单次 CAS；一次状态变化最多两次落盘（迁移 + 收尾） | 代码审查 + `events.jsonl` 与 `rev` 递增核对 |
| **NFR-04** | `orch status` 在 0.5 秒内返回；`orch run` 启动后 5 秒内出现前三行 | 5 次计时取 p95 |
| **NFR-05** | 取消在 5 秒内收敛（含审核中的实例） | AC-28 |
| **NFR-06** | Windows 与 Linux 路径一致；不得手拼 `.orch/instances/...` | 架构检查；`paths.js` 唯一计算点 |
| **NFR-07** | 夹具可重复：同一场景连续 5 次结果一致（事件顺序可因调度略有差异，终态与文件内容一致） | 5 次连跑 |
| **NFR-08** | 状态文件不保存文档正文、不保存绝对路径；只保存引用、字节数与 sha256 | 机检 state.json 不含 `cwd` 以外的绝对路径；不含文档内容 |
| **NFR-09** | 所有新增用户可见文案来自 `labels.js`；事件原因有中文词条 | 架构检查 + AC-39 |
| **NFR-10** | 新增/修改测试文件与附录 D-9 清单一致，全部可在 `node --test` 下运行 | CI / 本地全量 |

### 3.3 验收前置条件

1. **环境**：Node.js ≥ 22（ESM），仓库根执行过 `npm link`，`orch` 可用；Windows 使用 Git Bash。所有夹具路径用绝对路径传入 `--root`。
2. **全新根规则**：每条 AC 默认一个空目录；同一 AC 内需要多次运行时明确写"另起全新根"。不得复用上一个场景的 `.orch` 与 `.mock`。
3. **夹具入口**：`node test/fixtures/task-loop-driver.mjs --root <绝对路径> --scenario <场景名> [--keep] [--prepare-only] [--stop-after <n>] [--reset]`；默认任务目录 `<root>/demo-doc`。驱动只写 `<root>/.mock/` 与 `<root>/.orch/hosts/`，实例一律由 `bin/orch.js run` 发起。
4. **mock 宿主**：沿用 `test/fixtures/mock-acp-agent.js`，新增 `--suite task-loop`；step 支持 `artifact`（按 prompt 的"写入路径"落盘）、`review`（写 `out/review.json`）、`reviewUtimes`、`remove`、`utimes`、`delayMs`、`hold`、`hostError`、`sessionNew`。`.mock/prompts/<n>.json` 记录 `{n, nodeId, round, task}`，其中 `task` 是完整提示词原文（沿用 I1.2 字段名，不新增别名）。
5. **step ↔ 节点轮次**：第 1 步 T-001 第 1 轮；第 2 步 T-002 第 1 轮；第 3 步 T-003 第 1 轮；第 4 步 T-002 第 2 轮；第 5 步 T-003 第 2 轮。第 6 步出现即视为实现缺陷。
6. **场景清单**（D-9 给出逐步内容）：`doc-pass`、`doc-backflow-once`、`doc-reject-twice`、`doc-hold-research`、`doc-slow-reviewer`、`review-missing`、`review-stale`、`review-bad-json`、`review-decision-invalid`、`review-artifact-missing`、`review-artifact-mismatch`、`review-reject-no-defects`、`review-pass-with-defects`、`review-defect-shape`、`review-evidence-unreadable`、`review-evidence-outside`、`doc-missing`、`doc-empty`、`doc-stale`、`doc-previous-modified`、`doc-previous-missing`、`research-missing`、`research-empty`、`research-stale`、`dispatch-fail-first`、`dispatch-fail-backflow`、`execution-fail`、`review-says-pass`、`review-says-reject`。
7. **暂停/故障注入**：沿用 I1.2 的 `MAESTRO_TEST_PAUSE=after_accepted[:<nodeId>]`、`after_output[:<nodeId>]`、`after_verdict[:<nodeId>]`；`MAESTRO_FAULT=state_write:escalation`；`MAESTRO_TEST_STOP_AFTER=<n>`。核心冷启动时读取这些变量。
8. **审核样本**：AC 中出现的 `out/review.json` 内容必须是合法 JSON（`review-bad-json` 除外），字段与 §2.7 一致。
9. **真实面**：真实 DSH 的模型、网络与配额由环境提供；AC-40 的"第 1 轮故意不写回滚方案"依赖模型按任务话术执行，允许按 AC 写明重试；夹具面必须独立通过，不得用真实面替代。
10. **测试命令**：`node --test test/` 为全量入口；I1.2 既有测试必须全部保留并通过（AC-36）。

---

## 附录 A 输出基线（**唯一**，AC-02 / AC-03 / AC-04 / AC-06 / AC-07 / AC-09 / AC-10 / AC-13 ~ AC-21 的判定依据）

> 字段之间一律单空格，不做列对齐；`<d>` 是 `3s` / `1m12s` 这类时长（亚秒正值至少显示 `1s`）；时间戳一律本地时区 `HH:mm:ss`。本文的"输出含"只按逐字片段匹配，不要求整行相等。

### A-1 `orch run --template task-loop`（成功路径）

| # | 段 | 行数 | 说明 |
|---|---|---|---|
| 1 | 实例行 | 1 | `实例 INST-xxx · 运行中 · 模板 通用任务闭环`，只在开头打一次 |
| 2 | 会话已创建 | 1 | `会话已创建 sess-xxx` |
| 3 | 任务已投递 | 1 | `任务已投递` |
| 4 | 会话行（流式） | 0..N | 六种分支见 A-2 第 4 段；有产出时补 ` · 产出已提交` |
| 5 | 节点行 | 3 | A-2 第 3 段，按 T-001 → T-002 → T-003 |
| 6 | 交接包行 | 每包多行 | A-2 第 5 段，带方向 |
| 7 | 交接包等待行 | 0..1 | A-2 第 5 段末行 |
| 8 | 升级块 | 1 | 无升级时仅 `升级 —`；有升级时走 A-3 的挂起收尾，不打本段 |

约束：

- 运行期间**只**流式打印会话行；节点行、交接包行只在 `run.wait` 返回后打印一次（B-19）。
- 成功路径**不打印**终态实例行；`实例 … · 已完成` 只在随后 `orch status --instance` 出现。
- 成功路径全文不出现 `核对失败` / `执行失败` / `未知错误`，退出码 0。
- 交接包行按包号正序；同一包按 `已构造 → 已投递 → 已接受 → 已完成` 依次打印，已发生的状态各占一行（与 I1.2 相同）。

### A-2 `orch status --instance` 的段序（`task-loop`）

| # | 段 | 行数 | 逐字格式 |
|---|---|---|---|
| 1 | 实例行 | 1 | `实例 <号> · <状态>[ · 已停止推进][ · 模板 通用任务闭环]` |
| 2 | 已中断提示（仅 `interrupted`） | 0..1 | `实例 <号> · 已中断 ｜ 停在节点 <状态> / 会话 <状态>` |
| 3 | 节点行 | 3 | `节点 <T-00n> <角色> <状态>[（限定词）][ · 第 <n> 轮][ · 耗时 <d>][ · 产物 <引用> \| · 审核 通过 \| · 审核 驳回 · 缺陷 <n> 条]` |
| 4 | 会话行 | 0..1 | 只显示当前（最后一个）会话；六种分支见下 |
| 5 | 交接包行 | 每包多行 | `交接包 <号>  <方向>  <状态>   <时间戳>[  原因 <词>]`；`已投递` 且实例未终态时另起一行 `交接包 <号>  <方向>  已投递   等待目标响应 · 已等待 <d>` |
| 6 | 升级块 | 1..N | 无升级时仅 `升级 —`；有升级时每条约 4+N 行（见下） |
| 7 | 事件行（仅 `--events`） | 0..N | `[#<seq>] <时间戳>  <层> <id>  <从 → 到>  原因 <中文词>`；`result='note'` 的 note 行中段直接用中文原因词、**不再追加"原因"段**（如 `[#12] 10:00:10  节点 T-003  读取审核`）；`result='rejected'` 的事务行沿用 I1.1 版式（不带序号与原因） |

**第 3 段规则**

- **限定词**：`review` + `reviewReason` 为空或 `'evidence'` → `（核对证据）`；`review` + `'downstream'` → `（等待下游）`；`failed` + `note='等待复审'` → `（等待复审）`；`escalated` 不带限定词；`failed` 且无 `等待复审` 标记时（仅 `code-loop`）→ `（等待复测）`；`halted` 的节点保留原状态并追加 `（升级未记录）`（见 A-3）。
- **轮次**：只在 `round > 0` 时出现；未派发节点只有状态。
- **耗时**：`startedAt` 与 `endedAt` 都有效且节点已离开执行态时出现；`review(downstream)` 也算已离开执行态（M-8 写 `endedAt`）；`escalated` 默认没有 `endedAt`，不显示耗时。
- **后缀**（互斥，最多一个）：
  - `done` 且本轮有 `artifactRefs[0].ref` → `· 产物 <ref>`；
  - `done` 且 `review.decision='pass'` → `· 审核 通过`；
  - `failed` 且 `review.decision='reject'` → `· 审核 驳回 · 缺陷 <n> 条`（`n=review.defectCount`）；
  - `review(downstream)` 与 `escalated` 不带后缀。
- **角色名**：研究员 / 撰写者 / 审核者（`ROLE_LABEL`）。

**第 4 段六种分支**（与 I1.2 相同，`waiting_dependency` 额外显示"等待下游"）

| 会话状态 | 行 |
|---|---|
| `idle` | `会话 空闲` |
| `thinking` | `会话 执行中 · 已运行 <d>` |
| `tool_running` | `会话 执行中 · 调用工具（<工具名>） · 已运行 <d>`；无工具名时省略工具段 |
| `waiting_input` | `会话 等待审批：<动作>`；无动作时 `会话 等待审批` |
| `waiting_dependency` | `会话 等待下游` |
| `escalated` | `会话 已升级` |

上游本轮已交产出、会话仍是最后一个时，第 4 段显示 `会话 等待下游 · 产出已提交`（BR-26 / AC-04）。下游开始后会话行切换到下游的会话。

**第 6 段升级块逐字**

```
升级 ESC-xxx 待处理
  原因：<reasonDetail>
  节点：T-00n <角色> · 第 <n> 轮
  缺陷：<summary>（证据 <evidence>）        # 0..N 行，逐条
  下一步：本版本只能查看；要终止请执行 orch cancel --instance INST-xxx
```

**0 参数列表行**（`orch status` 不带 `--instance`）：

```
实例 <号> · <状态>[ · 模板 通用任务闭环][ · 待处理升级 <n>] · 节点 <状态> · 会话 <状态> · 耗时 <d> · 更新 <HH:mm:ss>
```

### A-3 挂起 / 停止推进收尾（`orch run`，逐字）

挂起（退出码 4），正好三行：

```
实例 INST-xxx · 已挂起 · 模板 通用任务闭环
升级 ESC-xxx 待处理 · 节点 T-00n <角色> · 第 <n> 轮
下一步：查看详情 orch status --instance INST-xxx --events；本版本不能继续，要终止请执行 orch cancel --instance INST-xxx
```

停止推进（退出码 5），先打一行错误，再打三行收尾：

```
无法记录升级：<原因>；已停止推进
实例 INST-xxx · 运行中 · 已停止推进 · 模板 通用任务闭环
节点 T-00n <角色> <升级前的状态>（升级未记录） · 第 <n> 轮
下一步：查看 orch status --instance INST-xxx --events；本版本不能继续，只能取消
```

两个分支都**不打印**节点表其余行、交接包行与等待行；停止推进分支的节点行不带耗时。

### A-4 `orch cancel` 的结果行

| 段 | 行 |
|---|---|
| 会话 | 每个会话一行 `会话 <状态>`；取消后为 `会话 空闲` |
| 节点 | 多节点图每个节点一行 `节点 <T-00n> <角色> <状态>`（已完成节点保持 `已完成`） |
| 交接包 | 每个交接包一行 `交接包 <号> <状态>`；被撤回的为 `交接包 HO-xxx 已拒绝（已撤回）` |
| 升级 | 每条升级一行 `升级 ESC-xxx <状态>`；取消后为 `升级 ESC-001 已作废` |

---

## 附录 B 术语与未决问题

### B.1 术语

| 术语 | 含义 |
|---|---|
| **通用任务闭环** | 研究 → 撰写 → 审核 的三节点固定流程；审核驳回自动回流，审核两次仍驳回则升级挂起 |
| **研究笔记** | 研究员交给撰写者的背景/事实/约束/结构建议，固定 `artifacts/reports/research-notes.v1.md` |
| **文档版本** | 撰写者每轮交出的完整 Markdown，固定 `artifacts/docs/<名>.v<轮次>.md`；旧版只读 |
| **审核文件** | 审核者每轮覆盖写的 `out/review.json`；核心只认文件，不读对话 |
| **缺陷** | 审核驳回时的一条意见，含非空 `summary` 与非空 `evidence` |
| **证据位置** | 指向实例工作区内文件的路径，可带 `#L<行号>`；绝对路径、盘符、`..` 不接受 |
| **修改要求** | 审核文件里的 `revisionRequirement`；为空时核心使用默认句 |
| **下游门控** | "上游自己的活核对通过"与"上游已完成"分开：先 `review(evidence)`，下游接手后 `review(downstream)`，下游首个工作事件到达才 `done` |
| **核对证据 / 等待下游** | `review` 的两个子原因：前者是核心正在核对本轮文件，后者是下游还没接手 |
| **等待复审** | 审核者已驳回、等撰写者改完再复审；节点显示 `失败（等待复审）` |
| **回流** | 审核驳回且未到上限时，把缺陷、证据、修改要求与上一版引用打包交回撰写者 |
| **复测** | 撰写者交出新版本后再次派发审核者；与编码闭环的"复测"共用同一种边 |
| **轮次** | 该节点被**派发**的次数；派发即 +1，不论目标会话是否建成 |
| **升级** | 核心判定"不能再自动推进"时生成的待人工记录；**不是失败** |
| **挂起** | 实例因有待处理升级而停止自动推进的状态；本版本唯一出路是取消 |
| **工作区** | `<任务目录>/.orch/instances/<实例号>/workspace/`；文档与证据路径都相对它 |

### B.2 未决问题与假设

| # | 问题 / 假设 | 影响 | 谁来定 |
|---|---|---|---|
| **B-01** | **已裁定（R-1）**：`review_reason: downstream` 本迭代只在 `task-loop` 启用；`code-loop` 保持 I1.2 的"判定后立即 `failed`"口径 | 不回填 `code-loop`，避免推翻 I1.2 的 46 条 AC；引擎按图节点 `downstreamGate` 启用，后续可零改动回填 | 已定，后续迭代复核 |
| **B-02** | **已定**：审核文件固定 `out/review.json`，不引入"审核笔记"或其他审核产物；多审核人/审核工作流留给 I1.6 | 审核能力保持单文件、单角色；扩展时不改核心校验入口 | 已定，I1.6 扩展 |
| **B-03** | **已定**：本轮不做 diff / 部分改写 / 自动合并；每轮必须交完整文档 | 版本区语义简单可验证；合并能力留给 I1.6 / I1.7 | 已定 |
| **B-04** | **假设**：真实宿主上的模型会按提示词写研究笔记、文档与审核文件；AC-40 允许最多 3 次重试，3 次仍不稳定记为"真实面不稳定"，不阻塞迭代 | 若模型普遍不写文件，夹具面仍能验收产品逻辑；真实面只作证据 | 待真实面验收 |
| **B-05** | **假设**：`.orch/instances/<id>/workspace/artifacts/` 默认对用户可见；本迭代不改 `.gitignore`，也不把工作区加入版本库 | 用户可能看到 `.orch` 下的文档；是否隐藏/忽略留给 I1.4 的共享工作区统一决定 | 待评审 |
| **B-06** | **已定**：研究笔记只有固定名 `research-notes.v1.md`，不按任务产物名生成，也不支持多个研究笔记 | 避免与交付文档撞名；多笔记留给后续"报告只追加区" | 已定 |
| **B-07** | **已定**：`#L<行号>` 只用于定位，不校验行号是否存在、不读该行内容；只校验"去掉后缀后的文件存在且非空" | 审核意见仍可定位；避免因文档改版导致行号漂移而误判无效 | 已定 |
| **B-08** | **假设**：对 ≤5MB 文档计算 `sha256` + 读取审核文件在本机 50ms 内完成（NFR-02） | 若真实文档更大，需改为按需/分块；本迭代按 5MB 设上限 | 待性能验收 |
| **B-09** | **已定**：`out/review.json` 每轮覆盖写；每轮审核内容的历史只保存在事件（`review.read` 的 detail）与回流交接包（`defects`）里，不另存审核文件副本 | 避免新增版本化审核文件；追溯靠事件与交接包 | 已定 |
| **B-10** | **已定**：没有 `downstreamGate` 的图（`single` / `code-loop`）状态里仍保留 `reviewReason` 字段，但恒为 `null` 且渲染不体现 | 字段统一、读取兼容；不改变 I1.1 / I1.2 的任何输出 | 已定 |

---

## 附录 C 变更记录

| 版本 | 日期 | 变更 |
|---|---|---|
| v1 | 2026-11-05 | 首版：43 条 AC、10 条授权变更（M-1 ~ M-10）、14 条补充契约（C-01 ~ C-14）、29 个夹具场景、附录 A ~ D |

---

## 附录 D 实现约束（非用户可见，供实现与任务拆分使用）

### D-1 架构与引擎复用

**新增/修改模块**

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/core/review.js` | 新增 | `out/review.json` 的读取、11 步校验、原因码与逐字原因（D-7） |
| `src/core/doc-artifact.js` | 新增 | 产物名解析、工作区引用、版本引用、上一版完整性、`sha256` |
| `src/core/verify-artifact.js` | 修改 | `verifyProducts()` 追加 `baseDir` / `sha256`；返回元素可带 `absPath`，但**调用方落盘前必须投影掉** |
| `src/core/orchestrator.js` | 修改 | `finishReviewNode()`、下游门控、`review.read` 等事件、`consumeHandoff()` 投影、`latestEndedNodeId()` 纳入 `review(downstream)` |
| `src/core/advance.js` | 修改 | `latestNodeId()` 纳入 `review(downstream)`；`classifyNodeOutcome()` 把 `review(downstream)` 归 `passed`；`buildHandoff()` 带 `artifactRefs` / `revisionRequirement` |
| `src/core/graph.js` | 只读复用 | 不新增边类型；`edgeFor()` 的 `passed → forward/retest` 已够用 |
| `src/core/state-machine.js` | 不改 | 现有 node 表已包含本迭代全部迁移（D-2） |
| `src/core/escalation.js` | 不改 | 复用一次 CAS 的升级事务 |
| `src/persistence/paths.js` | 修改 | 新增 `instanceWorkspaceDir()`、`instanceDocsDir()`、`instanceReportsDir()` |
| `src/templates/index.js` | 修改 | 新增三角色、`task-loop` 图、四个提示词、`REVIEW_REQUIREMENT`；仍是**唯一**允许出现模板名/角色名/提示词字面量的产品目录 |
| `src/cli/labels.js` | 修改 | 新增模板/角色/限定词/后缀/错误码/审核文案/事件原因（D-4 / D-5） |
| `src/cli/render.js` | 修改 | `task-loop` 的节点限定词、产物/审核后缀、`review(downstream)` 的耗时、回流的"修改要求"明细 |

**架构红线（AC-38）**

1. `src/core/**`、`src/daemon/**` 不出现字符串 `task-loop` / `researcher` / `writer` / `reviewer` / `研究员` / `撰写者` / `审核者`。
2. `startRun` 不按模板名分支；一切差异来自图数据：`productPolicy`、节点 `artifactPolicy` / `artifactDir` / `artifactExt` / `reviewPath` / `prompt` / `downstreamGate` / `judge`。
3. `finishGraphNode()` 仍是唯一收尾入口：`judge==='verdict'` → `finishVerdictNode`；`judge==='review'` → `finishReviewNode`；其余 → `finishArtifactNode`。
4. 推进入口不变：`driveGraph` → `finishGraphNode` → `advance` → `planAdvance`；回流/复测仍由 `planAdvance` 返回 `backflow` / `dispatch` 动作。
5. `src/core/review.js` 不出现任何模板名或角色名，只接收 `expectedArtifact`、`workspaceDir` 等参数。
6. 不新增运行时依赖；`package.json` 的 `dependencies` 保持为空（NFR-01）。

**调用图（新增部分）**

```
startRun(graph=task-loop)
  └─ validateTaskProducts(graph.productPolicy)            // doc-single
  └─ ensureWorkspace(paths.instanceWorkspaceDir)
  └─ claimGraph → dispatchInState(T-001)
       └─ promptFor({node.prompt:'research'})
finishGraphNode(T-001) → finishArtifactNode
  └─ verifyProducts({baseDir: workspace, products:[research ref], sha256:true})
  └─ downstreamGate → review(evidence) → review(downstream) → save
  └─ advance → planAdvance → dispatchInState(T-002)   // 交接包 HO-001
finishGraphNode(T-002) → finishArtifactNode
  └─ verifyProducts({baseDir: workspace, products:[doc v1], sha256:true})
  └─ verifyPrevious(round>1) → review(evidence) → review(downstream) → save
  └─ advance → dispatchInState(T-003)
finishGraphNode(T-003) → finishReviewNode
  └─ readReview({cwd, workspaceDir, expectedArtifact, roundStartedAt})
  └─ pass → done；reject 未超限 → failed（note='等待复审'）
  └─ reject 超限 / 无效 → escalate（一次 CAS）
  └─ reject 未超限 → advance → planAdvance(backflow) → dispatchInState(T-002 第 2 轮)
```

### D-2 节点迁移表（不新增边；只说明本迭代用到哪些）

| 内部状态 | 能走到 | 本迭代的使用场景 |
|---|---|---|
| `pending` | `running`、`escalated`、`cancelled` | 轮到它 / 目标会话建不起来（`dispatch_failed`）/ 取消 |
| `running` | `review`、`failed`、`escalated`、`cancelled` | 回合结束交出产出 / 仅 `single` 的判定失败 / 宿主报错或拒绝 / 取消 |
| `review` | `done`、`failed`、`escalated`、`cancelled` | 产物核对通过且无下游门控；审核驳回未超限（`review→failed`）；审核无效或超限、产物无效（`review→escalated`）；取消 |
| `done` | `running`、`escalated` | 被回流唤醒（撰写者）/ 回流派发失败。**已完成不参与取消** |
| `failed` | `running`、`escalated`、`cancelled` | 复测派发（审核者）/ 复测派发失败 / 取消 |
| `escalated` | `cancelled` | 取消（唯一出口） |
| `cancelled` | — | 终态 |

补充：

- 下游门控的 `review(evidence) → review(downstream)` **不是迁移**：状态仍是 `review`，只改 `reviewReason`。
- `review(downstream) → done` 由下游交接包 `accepted` 触发（D-3）。
- `done → running` 只用于撰写者被回流重新打开；`failed → running` 只用于审核者复测。
- 本迭代不新增任何迁移边，因此 `state-machine.js` 与 `state-machine.test.js` 的迁移表**不需要改**（只需补 `task-loop` 的场景断言）。

### D-3 下游门控与接受序列（幂等键 = 交接包 accepted 的那一刻）

**写入点与顺序**

1. `finishArtifactNode` 核对成功：
   - 写 `node.artifactRefs = [{ref, bytes, sha256}]`（投影后，不带 `absPath` / `mtime`）；
   - 追加 `artifactHistory[]`：`{round: node.round, ref, sha256, bytes, verifiedAt}`；
   - 发 `node: running → review`，reason `output.submitted`；
   - 若 `def.downstreamGate === true`：`node.reviewReason='evidence'`，发 `review.evidence_verified`（note），随后改为 `'downstream'`，写 `node.endedAt`；会话保持 `waiting_dependency`；
   - 一次 `saveLive`（CAS）。
2. `advance` 读到该节点（`latestEndedNodeId` 必须能选中 `review(downstream)`，`classifyNodeOutcome` 返回 `passed`），`planAdvance` 走 `forward` 边，构造交接包并派发下游。
3. 下游会话首个 `TURN_UPDATES` 事件到达，`handoff-tracker.observeTurnEvent()` 返回 `accepted`。**同一帧内**在 `sessionUpdate` 里：
   - 用 `handoff.edge.from` 找到源节点；
   - 仅当 `源节点.state==='review' && 源节点.reviewReason==='downstream' && 交接包.state==='accepted'` 时执行：
     - 源节点 `review → done`（`reason='review.downstream_accepted'`），`reviewReason=null`；
     - 源节点对应会话 `waiting_dependency → idle`；
   - 两条迁移只改**当前 live 状态**，随后由这一帧排队的 `saveLive` 与下游节点自己的状态**一次 CAS 落盘**；**不得**先调用一次独立 `saveLive` 再回头覆盖（C-09）。
4. 幂等性：
   - 同一交接包只在 `tracker` 由 `delivered → accepted` 的那一次触发；重复帧返回 `ignored`，不会二次迁移；
   - 即使钩子被重复调用，第二次看到的源节点已是 `done`，直接返回；
   - 下游交接包未 `delivered` 时不会 `accepted`，不接受噪声帧（`usage_update` / `available_commands_update`）。

**两个同名逻辑必须同步**

| 文件 | 函数 | 改动 |
|---|---|---|
| `src/core/orchestrator.js` | `latestEndedNodeId(state)` | 纳入 `state==='review' && reviewReason==='downstream'` |
| `src/core/advance.js` | `latestNodeId(nodes)` | 同上 |
| `src/core/advance.js` | `classifyNodeOutcome()` | `review` + `downstream` → `'passed'`；其他 `review` 仍 `'error'` |
| `src/core/advance.js` | `buildHandoff()` | 追加 `artifactRefs` / `revisionRequirement` |
| `src/core/orchestrator.js` | `handoffToState()` | 仅在源对象**确实带字段**时投影 `artifactRefs` / `revisionRequirement`（与 `edge/defects/note` 同规则） |
| `src/core/orchestrator.js` | `consumeHandoff()` | 显式重组快照的那一处必须把 `artifactRefs` / `revisionRequirement` 一起传入，否则 `accepted → consumed` 会抹掉 |
| `src/core/orchestrator.js` | `dispatchInState()` | `isNodeBusyState()` 已含 `review`；`review(downstream)` 同样拒绝重复投递（AC-41） |

**失败路径**

- 上游产物核对失败：不进入门控，直接升级（`review → escalated`），下游不派发。
- 下游派发失败：按 D-2 的 `pending/done/failed → escalated` 处理，升级挂在**接收派发的目标节点**上；源节点保持 `review(downstream)`（不假装完成）。
- 审核节点没有 `downstreamGate`：合法 pass 直接 `done`，合法 reject 未超限直接 `failed`。

### D-4 常量表（`task-loop` 新增；其余沿用 I1.2）

| 常量 | 值 | 说明 |
|---|---|---|
| `TEMPLATE_LABEL['task-loop']` | `通用任务闭环` | 实例行 / 列表行 |
| `ROLE_LABEL.researcher` | `研究员` | T-001 |
| `ROLE_LABEL.writer` | `撰写者` | T-002 |
| `ROLE_LABEL.reviewer` | `审核者` | T-003 |
| 图 `task-loop` | `entry:'T-001'`、`terminal:'T-003'`、`showTemplate:true`、`productPolicy:'doc-single'` | 注入 `GRAPHS` |
| 节点 T-001 | `roleId:'researcher'`、`order:1`、`title:'研究员'`、`prompt:'research'`、`downstreamGate:true`、`artifactPolicy:'fixed-workspace'`、`artifactDir:'artifacts/reports'`、`artifactExt:'.md'`、`products:['artifacts/reports/research-notes.v1.md']` | 研究笔记 |
| 节点 T-002 | `roleId:'writer'`、`order:2`、`title:'撰写者'`、`prompt:'write'`、`downstreamGate:true`、`artifactPolicy:'versioned-doc'`、`artifactDir:'artifacts/docs'`、`artifactExt:'.md'` | 文档版本 |
| 节点 T-003 | `roleId:'reviewer'`、`order:3`、`title:'审核者'`、`prompt:'review'`、`downstreamGate:false`、`artifactPolicy:'review'`、`judge:'review'`、`reviewPath:'out/review.json'` | 审核文件 |
| `maxRounds` | `{'T-001':1, 'T-002':2, 'T-003':2}` | 研究 1 次；撰写/审核各 2 轮 |
| 边 | `T-001→T-002 forward`、`T-002→T-003 forward`、`T-003→T-002 backflow`、`T-002→T-003 retest` | 四边，不新增 kind |
| `NODE_QUALIFIER` | `evidence_check:'核对证据'`、`waiting_downstream:'等待下游'`、`waiting_review:'等待复审'`、`waiting_retest:'等待复测'`、`escalation_unrecorded:'升级未记录'` | `review` 的前两项由 `reviewReason` 推导；`waiting_review` 由 `node.note` 命中 |
| 节点后缀 | `· 产物 <ref>`、`· 审核 通过`、`· 审核 驳回 · 缺陷 <n> 条` | 互斥；见 A-2 第 3 段 |
| 路径 | `WORKSPACE='workspace'`、`ARTIFACTS='artifacts'`、`DOCS='artifacts/docs'`、`REPORTS='artifacts/reports'`、`REVIEW_PATH='out/review.json'`、`RESEARCH_REF='artifacts/reports/research-notes.v1.md'` | 唯一计算点：`paths.js` / `doc-artifact.js` |
| 事件 | `review.read`、`review.passed`、`review.rejected`、`review.invalid`、`review.downstream_accepted`、`review.evidence_verified`、`handoff.created`、`handoff.delivered`、`handoff.consumed`、`backflow.constructed`、`rounds.exceeded`、`escalation.created`、`node.dispatch`、`run.started` | 全部需中文词条（D-5） |
| 错误码 | `PRODUCT_LINE_MISSING_TASK_LOOP`、`PRODUCT_INVALID_TASK_LOOP`、`WORKSPACE_INIT_FAILED` | 退出码 1 |
| 审核原因码 | `review_missing`、`review_stale`、`review_invalid`、`review_artifact_missing`、`review_artifact_mismatch`、`review_pass_with_defects`、`review_reject_no_defects`、`review_defect_shape`、`review_evidence_unreadable`、`rounds_exceeded` | 写入升级 `reasonCode` |
| 产物原因码 | `artifact_missing`、`artifact_empty`、`artifact_stale`、`artifact_previous_missing`、`artifact_previous_modified`、`execution_failed`、`dispatch_failed` | 同上 |
| 退出码 | `0` 成功 / `1` 业务错误 / `2` 用法 / `3` 连接或内部 / `4` 挂起 / `5` 停止推进 | 与 I1.2 一致 |

### D-5 文案与错误码逐字表（新增文案以 `labels.js` 为唯一来源）

| 键 | 逐字原文 | 用于哪条 AC |
|---|---|---|
| `PRODUCT_LINE_MISSING_TASK_LOOP` | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）` | AC-22 |
| `PRODUCT_INVALID_TASK_LOOP` | `通用任务闭环的产物只写文件名（.md），不能带路径：{value}` | AC-23 |
| `WORKSPACE_INIT_FAILED` | `无法创建工作区：{cause}` | 架构/异常（无 AC，M-9） |
| `REVIEW_TEXT.prefix` | `核对失败：` | AC-13 ~ AC-18 |
| `REVIEW_TEXT.missing` | `未找到审核文件 out/review.json` | AC-13 |
| `REVIEW_TEXT.stale` | `审核文件不是本轮新写 out/review.json` | AC-14 |
| `REVIEW_TEXT.unparsable` | `审核文件不可解析` | AC-15 |
| `REVIEW_TEXT.decisionInvalid` | `审核结论只能是 pass 或 reject` | AC-15 |
| `REVIEW_TEXT.artifactMissing` | `审核未引用本轮文档` | AC-16 |
| `REVIEW_TEXT.artifactMismatch` | `审核引用的不是本轮文档 {artifact}` | AC-16（`{artifact}` 保留文件里的原值） |
| `REVIEW_TEXT.passWithDefects` | `审核为通过，但缺陷清单非空` | AC-17 |
| `REVIEW_TEXT.rejectNoDefects` | `审核为驳回，但没有缺陷清单` | AC-17 |
| `REVIEW_TEXT.defectShape` | `审核缺陷缺少摘要或证据` | AC-17 |
| `REVIEW_TEXT.evidenceUnreadable` | `缺陷证据不可解析 {evidence}` | AC-18（`{evidence}` 保留原始串，含 `#L<n>`） |
| `REVIEW_TEXT.roundsExceeded` | `回流超上限：审核者已派发 2 次仍未通过` | AC-10 |
| `ARTIFACT_TEXT.missing` | `未找到声明的产出 {ref}` | AC-19 / AC-21 |
| `ARTIFACT_TEXT.empty` | `产出为空 {ref}` | AC-19 / AC-21 |
| `ARTIFACT_TEXT.stale` | `产出不是本轮新写 {ref}` | AC-19 / AC-21 |
| `REVIEW_TEXT.previousMissing` | `上一版文档缺失 {ref}` | AC-20 |
| `REVIEW_TEXT.previousModified` | `上一版文档被改写 {ref}` | AC-20 |
| `DEFAULT_REVISION_REQUIREMENT` | `请按缺陷清单逐条修改后交出新版本` | 审核文件没写修改要求时 |
| `REASON_LABEL['review.read']` | `读取审核` | AC-39 |
| `REASON_LABEL['review.passed']` | `审核通过` | AC-39 |
| `REASON_LABEL['review.rejected']` | `审核驳回` | AC-39 |
| `REASON_LABEL['review.invalid']` | `审核无效` | AC-39 |
| `REASON_LABEL['review.downstream_accepted']` | `下游已接受` | AC-05 / AC-39 |
| `REASON_LABEL['review.evidence_verified']` | `证据核对通过` | AC-39 |
| `BACKFLOW_REVISION_LINE` | `修改要求：{text}`（事件行下的缩进明细，前缀 6 空格） | AC-39（`task-loop` 的 `backflow.constructed`） |

**事件 detail 约定**

- `review.read`：`{source:'file', path:'out/review.json', decision:'pass'|'reject', results:<校验通过的缺陷条数，pass 为 0>}`（AC-39）。
- `review.invalid`：`{reasonCode, stage, message}`（AC-39）。
- `review.downstream_accepted`：`{handoffId, fromNodeId}`。
- `review.evidence_verified`：`{ref, sha256}`。
- `backflow.constructed`：`{defects, revisionRequirement}`；`task-loop` 渲染缺陷行与 `修改要求：`，`code-loop` 仍渲染 `复测要求：`。
- 未知 reason 必须被 `REASON_LABEL` 覆盖；否则 `renderEventLine` 会把英文 reason 打给用户（AC-39 的反面）。
- **note 行渲染**：`result='note'` 的事件（`review.read` / `review.invalid` / `review.evidence_verified` / `review.downstream_accepted` / `rounds.exceeded`）在 `task-loop` 下中段取 `REASON_LABEL[reason]`，不再追加"原因"段；`single` / `code-loop` 保持 I1.2 版式，避免事件行回归（AC-36）。状态迁移行（`result='applied'`）仍按 `原因 <中文词>` 渲染。

### D-6 状态结构（追加字段，`schemaVersion` 仍为 2）

**节点**

| 字段 | 形状 | 说明 |
|---|---|---|
| `reviewReason` | `'evidence' \| 'downstream' \| null` | 仅 `state==='review'` 时有值；派发新一轮时清 `null` |
| `review` | `{decision:'pass'\|'reject', defectCount:number, reviewPath:'out/review.json', artifact:string, readAt:string} \| null` | 审核节点每轮覆盖；产物节点恒为 `null` |
| `artifactRefs` | `[{ref:string, bytes:number, sha256:string}]` | 本轮产物；派发时清空，旧版信息在 `artifactHistory` |
| `artifactHistory` | `[{round:number, ref:string, sha256:string, bytes:number, verifiedAt:string}]` | 只追加；不随派发清空 |
| `note` | `string \| null` | 审核驳回未超限时写 `'等待复审'`；其他节点可为 `null` |

**交接包**

| 字段 | 形状 | 说明 |
|---|---|---|
| `artifactRefs` | `{input:string[], output:string\|null, previous:{ref:string, sha256:string}\|null}` | 正向带 `input`/`output`；回流带 `input`（上一版）/`output`（新版）/`previous` |
| `revisionRequirement` | `string \| null` | 仅回流包有值；空时用默认句 |

**其他**

- `counters.dispatchCount`：每次派发 +1（含首派）；AC-01/10/13/19/20/21/30/33/41 用它核对"没有继续派发"。
- `task.artifactStem`：仅 `productPolicy==='doc-single'` 的实例有；`startRun` 从任务产物行算出（去 `.md`），此后只读；旧实例缺省 `null`（不参与版本解析）。
- `state.rev`：每次落盘递增；`expectedState` 比较 `{state, halted, rev}`（C-01 / NFR-03）。
- `state` 中**不得**出现 `absPath`、文档正文、绝对路径；`cwd` 与 `handoff.artifactRefs` 里的引用都是相对引用（NFR-08）。
- 读取旧状态：缺省字段按 `null` / `[]` 处理；`schemaVersion:1` 仍只读。

### D-7 审核校验器契约（`src/core/review.js`）

**常量与入口**

```js
export const REVIEW_PATH = 'out/review.json';
export function parseReview(rawText);        // 纯函数，供单测
export async function readReview({ cwd, workspaceDir, expectedArtifact, roundStartedAt, fs, now });
```

**11 步顺序（命中即返回，不继续后续检查）**

| 步 | 检查 | 失败码 | `stage` | `reasonCode` | 逐字原因 |
|---|---|---|---|---|---|
| 1 | `stat(<cwd>/out/review.json)` 成功 | `REVIEW_MISSING` | `missing` | `review_missing` | `核对失败：未找到审核文件 out/review.json` |
| 2 | `mtime >= roundStartedAt` | `REVIEW_STALE` | `stale` | `review_stale` | `核对失败：审核文件不是本轮新写 out/review.json` |
| 3 | `readFile` 成功 | `REVIEW_UNPARSABLE` | `unreadable` | `review_invalid` | `核对失败：审核文件不可解析` |
| 4 | `JSON.parse` 成功 | `REVIEW_UNPARSABLE` | `unparsable` | `review_invalid` | 同上 |
| 5 | 顶层是非数组对象 | `REVIEW_SCHEMA_INVALID` | `schema` | `review_invalid` | 同上 |
| 6 | `decision === 'pass' \|\| 'reject'` | `REVIEW_DECISION_INVALID` | `decision` | `review_invalid` | `核对失败：审核结论只能是 pass 或 reject` |
| 7 | `artifact` 是非空字符串 | `REVIEW_ARTIFACT_MISSING` | `artifact_missing` | `review_artifact_missing` | `核对失败：审核未引用本轮文档` |
| 8 | `artifact === expectedArtifact` | `REVIEW_ARTIFACT_MISMATCH` | `artifact_mismatch` | `review_artifact_mismatch` | `核对失败：审核引用的不是本轮文档 {artifact}` |
| 9 | `pass` 时 `defects` 为空；`reject` 时 `defects` 非空 | `REVIEW_PASS_WITH_DEFECTS` / `REVIEW_REJECT_NO_DEFECTS` | `pass_with_defects` / `reject_no_defects` | `review_pass_with_defects` / `review_reject_no_defects` | `核对失败：审核为通过，但缺陷清单非空` / `核对失败：审核为驳回，但没有缺陷清单` |
| 10 | 每条缺陷 `summary` 与 `evidence` 都是非空字符串 | `REVIEW_DEFECT_SHAPE` | `defect_shape` | `review_defect_shape` | `核对失败：审核缺陷缺少摘要或证据` |
| 11 | 每条证据去掉 `#L<n>` 后：不是绝对路径、不含盘符、不含 `..`；在 `workspaceDir` 下存在且 `bytes > 0` | `REVIEW_EVIDENCE_UNREADABLE` | `evidence_unreadable` | `review_evidence_unreadable` | `核对失败：缺陷证据不可解析 {evidence}` |

**返回值**

```js
// 成功
{ ok: true, review: {
  decision, artifact, defects: [{summary, evidence}],
  revisionRequirement: string,          // 缺省时填 DEFAULT_REVISION_REQUIREMENT
  reviewPath: 'out/review.json', readAt: ISO
} }
// 失败
{ ok: false, code, stage, reasonCode, reasonDetail, reviewPath, detail:{stage, reasonCode, message, ...extras} }
```

**约束**

- 只读 `decision` / `artifact` / `defects` / `revisionRequirement` 四个字段，未知字段忽略（C-05）。
- `defects` 不合法时整份审核无效；不回传"部分缺陷"。
- 证据校验只 `stat`，不读内容；`#L` 后缀剥离后定位，不做行号范围检查（B-07）。
- 校验器不做任何状态写入；失败由调用方升级（与 `verdict.js` 同构）。
- `review.read` 事件在成功路径发出，detail 含 `path='out/review.json'` 与 `results`（= `defects.length`，`pass` 为 0）。

### D-8 产物版本化与提示词契约

**产物声明（`productPolicy: 'doc-single'`）**

1. 任务必须含**恰好一行** `产物：<文件名>.md`（全角冒号）。
2. 文件名：非空、无 `/`、`\`、`..`、盘符、控制字符；必须以 `.md` 结尾；不得以 `.v<数字>.` 结尾（自带版本号）。
3. 违反 1 → `PRODUCT_LINE_MISSING_TASK_LOOP`；违反 2 → `PRODUCT_INVALID_TASK_LOOP`；都在建实例/建工作区之前返回，退出码 1。
4. `declared` 图（`code-loop`）仍走 I1.2 的 `extractProductLines` 与 `PRODUCT_LINE_MISSING`，文案不变。

**产物解析（按节点 `artifactPolicy`，唯一入口 `doc-artifact.resolveNodeProducts(def, { node })`）**

| `artifactPolicy` | 本轮产物来源 | 本轮路径 | 核对方式 |
|---|---|---|---|
| `fixed-workspace` | 图节点 `products[]` 原样 | `artifacts/reports/research-notes.v1.md` | 当前版三重检查（存在/非空/不陈旧）+ `sha256` |
| `versioned-doc` | `doc-artifact.nodeProducts({ artifactDir, artifactExt, stem, round })` | `<artifactDir>/<stem>.v<round>.md` | `round > 1` 时先验上一版完整性（D-8 核对流程第 2 步），再当前版三重检查 |
| `review` | 不解析产物（审查方只交审核文件） | `reviewPath`（`out/review.json`） | 走 D-7，不调 `verifyProducts` |
| `declared`（I1.2 缺省） | 任务里 `产物：<路径>` 提取（`productsOfTask`） | 任务声明路径 | I1.2 原语义 |

> `round` 在本轮派发时已 +1（派发即 +1，沿用 I1.2 口径），因此 T-002 首派得到 `v1`、回流后第 2 轮得到 `v2`；回流包里的 `previous` 也由同一个函数以 `round-1` 算出，不另写一份拼接逻辑。
> `stem` 来自 D-8 产物声明（任务里的文件名去 `.md`），在 `startRun` 时算一次并写进 `state.task.artifactStem`，后续各轮只读。

**工作区与引用**

| 项 | 规则 |
|---|---|
| 工作区 | `instanceWorkspaceDir(root, id) = <root>/.orch/instances/<id>/workspace` |
| 目录 | 创建 `workspace/artifacts/docs/`、`workspace/artifacts/reports/`；不创建 `shared/`、`stage/`、`status.md` |
| 研究笔记 | `artifacts/reports/research-notes.v1.md` |
| 文档第 n 轮 | `artifacts/docs/<stem>.v<n>.md`；`stem` 是任务产物名去 `.md` |
| 上一版 | `artifacts/docs/<stem>.v<n-1>.md` |
| 审核文件 | `<cwd>/out/review.json`（任务目录相对，不是工作区） |
| 证据 | 工作区相对路径；可带 `#L<n>` |

**核对流程（撰写者）**

1. 第 1 轮：核对当前版存在、非空、`mtime >= roundStartedAt`；成功 → 计算 `sha256`，写 `artifactRefs` 与 `artifactHistory`。
2. 第 n>1 轮：**先**核对上一版 `v<n-1>`：不存在 → `artifact_previous_missing`；`sha256` 与 `artifactHistory` 记录不一致 → `artifact_previous_modified`；两者都升级挂起，不派发审核。
3. 再核对当前版 `v<n>`：缺失 / 为空 / 陈旧 → `artifact_missing` / `artifact_empty` / `artifact_stale`。
4. 成功后进入下游门控（D-3）。

**提示词（逐字片段；完整文本放 `src/templates/index.js`）**

> 提示词里的 `写入路径：` 使用工作区绝对路径，并统一做 `toPosix`（把 `\` 归一化为 `/`）后再插入；相对引用本来就是 `/`。这样 Windows 与 POSIX 上的提示词一致，夹具按 `写入路径：` 取路径也无需处理分隔符差异。

研究（T-001）：

```text
{task}

研究笔记：artifacts/reports/research-notes.v1.md
写入路径：<workspace 绝对路径>/artifacts/reports/research-notes.v1.md
只交研究笔记，不写最终文档。
```

撰写第 1 轮（T-002）：

```text
{task}

研究笔记：artifacts/reports/research-notes.v1.md
本轮文档引用：artifacts/docs/<stem>.v1.md
写入路径：<workspace 绝对路径>/artifacts/docs/<stem>.v1.md
每一轮交完整文档，不要改写上一版。
```

撰写第 2 轮（回流，T-002）：

```text
{task}

上一轮审核不通过，请按下列缺陷修改：
缺陷 1：<summary>（证据 <evidence>）
缺陷 2：<summary>（证据 <evidence>）
修改要求：<revisionRequirement>
研究笔记：artifacts/reports/research-notes.v1.md
上一版文档引用：artifacts/docs/<stem>.v1.md
本轮文档引用：artifacts/docs/<stem>.v2.md
写入路径：<workspace 绝对路径>/artifacts/docs/<stem>.v2.md
不得改写上一版文件。
```

审核（T-003）：

```text
{task}

本轮文档引用：artifacts/docs/<stem>.v<n>.md
审核文件写入路径：out/review.json
只认审核文件：{"decision":"pass"|"reject","artifact":"artifacts/docs/<stem>.v<n>.md","defects":[{"summary":"一句话缺陷","evidence":"artifacts/docs/<stem>.v<n>.md#L1"}],"revisionRequirement":"..."}
判定为 reject 时至少一条缺陷；判定为 pass 时 defects 必须为空。
不要修改文档。
```

**审核文件 schema**

```json
{
  "decision": "pass",
  "artifact": "artifacts/docs/release-notes.v1.md",
  "defects": [],
  "revisionRequirement": ""
}
```

- `decision='reject'` 时 `defects` 至少一条，每条 `{summary, evidence}` 都非空。
- `revisionRequirement` 可空；空时按 D-7 填默认句。
- 未知字段忽略；文件里可以只有上述四个字段之一（校验按 D-7 顺序缺失即报）。

**`sha256` 与落盘投影**

- `verifyProducts()` 新增 `baseDir`（默认 `cwd`）与 `sha256`（默认关闭）；返回 `refs: [{ref, absPath, bytes, mtime, sha256}]`。
- `finishArtifactNode` 落盘前**必须投影**为 `[{ref, bytes, sha256}]`；`absPath` / `mtime` 只能留在内存，不能进 `state.json`（NFR-08）。
- `sha256` 以文件字节流计算；不把正文写入状态或事件。

### D-9 夹具与测试同步

**新增/修改夹具**

| 文件 | 动作 | 说明 |
|---|---|---|
| `test/fixtures/task-loop-driver.mjs` | 新增 | 场景驱动、`--root` / `--scenario` / `--task` / `--cwd` / `--keep` / `--stop-after` / `--prepare-only` / `--reset`；写 `.mock/` 与 host 配置，实例由 `bin/orch.js run` 发起 |
| `test/fixtures/scenarios/*.json` | 新增 | 本附录场景表；也可内置在 driver 中，但字段形状必须一致 |
| `test/fixtures/mock-acp-agent.js` | 修改 | 新增 `--suite task-loop`；新增 `artifact` / `review` / `reviewUtimes` / `mutatePrevious` 步；`hold` 支持 `when:'prompt'`；`--suite` 缺省时 I1.2 行为逐字不变 |
| `test/fixtures/call-seam.mjs` | 不改 | AC-41 直接复用 I1.2 的 `dispatch` 接缝 |

**step 形状**

```json
{
  "nodeId": "T-002",
  "round": 1,
  "artifact": "artifacts/docs/release-notes.v1.md",
  "content": "……完整文档……",
  "artifactSkip": false,
  "artifactUtimes": { "offsetMs": -120000 },
  "mutatePrevious": "modify",
  "review": { "decision": "reject", "artifact": "artifacts/docs/release-notes.v1.md", "defects": [] },
  "reviewSkip": false,
  "reviewUtimes": { "offsetMs": -120000 },
  "delayMs": 0,
  "hold": { "when": "prompt" },
  "hostError": "…",
  "sessionNew": "fail",
  "message": "……",
  "historyMarker": "…"
}
```

- `nodeId` / `round` 必须显式写；**不得**沿用 code-loop 的"交替 T-001/T-002 + `ceil(n/2)`"默认值。
- `artifact`：mock 从提示词里取 `写入路径：` 的绝对路径（模板已归一化为 `/`），确认其以 `artifact` 结尾（分隔符归一化）后写入；不匹配则写 `.mock/bad-write-path` 并不写文件，让 AC 直接失败。
- `artifactSkip:true`：不写文件（missing）；`content:""`：写空文件（empty）；`artifactUtimes:{offsetMs:number}`：写后把 mtime 设为 `Date.now()+offsetMs`（stale 场景用 `-120000`，即 120 秒前）。
- `reviewSkip:true`：不写审核文件（missing）；`review`：写 `<cwd>/out/review.json`；`reviewUtimes:{offsetMs:number}`：写后改 mtime（同上，取相对当前时间的偏移，不用绝对时间）。
- `mutatePrevious`：`modify` 改写上一版内容；`remove` 删除上一版；用于 AC-20。
- `hold.when:'prompt'`：在收到 `session/prompt` 后、产生任何输出前挂起，直到 `.mock/release`；**不能**用 `session/new` 挂起，否则 `run` 的前三行不会出现（AC-01）。
- `writePromptRecord()` 落 `{n, nodeId, round, task}`；`task` 是完整提示词原文。

**场景表（29 个）**

| 场景 | 步骤（节点/轮次） | 关键动作 | 预期 |
|---|---|---|---|
| `doc-pass` | 1 T-001/1；2 T-002/1；3 T-003/1 | 研究笔记；完整 v1；审核 pass | 完成，HO-001 ~ HO-003 |
| `doc-backflow-once` | 1 T-001/1；2 T-002/1；3 T-003/1；4 T-002/2；5 T-003/2 | v1 缺「回滚方案」；驳回 2 条（证据 v1#L1 / v1#L18）；v2 完整；pass | 完成，4 张交接包 |
| `doc-reject-twice` | 同 1~4；5 T-003/2 | 第 2 轮再驳回 2 条（证据 v2） | 挂起，`rounds_exceeded` |
| `doc-hold-research` | 1 T-001/1 | `hold.when='prompt'`，不写 | T-001 执行中；AC-01 / 25 / 26 |
| `doc-slow-reviewer` | 1 T-001/1；2 T-002/1；3 T-003/1 | 审核 `delayMs=60000` | T-003 执行中；AC-28 |
| `review-missing` | 1 T-001/1；2 T-002/1；3 T-003/1 | `reviewSkip` | 挂起，`review_missing` |
| `review-stale` | 同上 | 写 pass 后 `reviewUtimes={offsetMs:-120000}` | 挂起，`review_stale` |
| `review-bad-json` | 同上 | 审核文件写 `{` | 挂起，`review_invalid` |
| `review-decision-invalid` | 同上 | `decision:'maybe'` | 挂起，`review_invalid` |
| `review-artifact-missing` | 同上 | 不写 `artifact` | 挂起，`review_artifact_missing` |
| `review-artifact-mismatch` | 同上 | `artifact:'artifacts/docs/orphan.md'` | 挂起，`review_artifact_mismatch` |
| `review-reject-no-defects` | 同上 | `reject` + `defects:[]` | 挂起，`review_reject_no_defects` |
| `review-pass-with-defects` | 同上 | `pass` + 1 条缺陷 | 挂起，`review_pass_with_defects` |
| `review-defect-shape` | 同上 | 缺陷缺 `evidence` | 挂起，`review_defect_shape` |
| `review-evidence-unreadable` | 同上 | 证据 `artifacts/docs/missing.md#L3` | 挂起，`review_evidence_unreadable` |
| `review-evidence-outside` | 同上 | 证据 `../outside.md#L1` | 挂起，`review_evidence_unreadable` |
| `doc-missing` | 1 T-001/1；2 T-002/1 | `artifactSkip` | T-002 升级，`artifact_missing` |
| `doc-empty` | 同上 | `content:""` | T-002 升级，`artifact_empty` |
| `doc-stale` | 同上 | `artifactUtimes={offsetMs:-120000}` | T-002 升级，`artifact_stale` |
| `doc-previous-modified` | 1 T-001/1；2 T-002/1；3 T-003/1；4 T-002/2 | 第 4 步写 v2 并 `mutatePrevious:'modify'` | T-002 升级，`artifact_previous_modified` |
| `doc-previous-missing` | 同上 | 第 4 步写 v2 并 `mutatePrevious:'remove'` | T-002 升级，`artifact_previous_missing` |
| `research-missing` | 1 T-001/1 | `artifactSkip` | T-001 升级，`artifact_missing` |
| `research-empty` | 1 T-001/1 | `content:""` | T-001 升级，`artifact_empty` |
| `research-stale` | 1 T-001/1 | `artifactUtimes={offsetMs:-120000}` | T-001 升级，`artifact_stale` |
| `dispatch-fail-first` | 1 T-001/1 | `sessionNew:'fail'` | 挂起，`dispatch_failed`；AC-42 |
| `dispatch-fail-backflow` | 1~3；4 T-002/2 | 第 4 步 `sessionNew:'fail'` | 挂起，`dispatch_failed`；**无 AC，引擎自测** |
| `execution-fail` | 1 T-001/1；2 T-002/1 | 第 2 步 `hostError` | 挂起，`execution_failed`；AC-43 |
| `review-says-pass` | 1 T-001/1；2 T-002/1；3 T-003/1；4 T-002/2 | 消息说"全部通过"、文件写 reject；第 4 步写 v2 | 以 `--stop-after 4` 跑完；T-003 第 1 轮 `review.decision='reject'` |
| `review-says-reject` | 1 T-001/1；2 T-002/1；3 T-003/1 | 消息说"不通过"、文件写 pass | 完成，无回流包 |

**必须同步的测试**

| 文件 | 改动 |
|---|---|
| `test/wp2/labels.test.js` | 新增模板/角色/限定词/后缀/错误码/审核文案/事件原因断言（D-4 / D-5） |
| `test/wp4/orchestrator.test.js` | 新增 `task-loop` 下游门控、审核节点三分支、`consumeHandoff` 字段保留、一次 CAS（`rev` 只 +1）用例 |
| `test/wp4/verify-artifact.test.js` | 新增 `baseDir` / `sha256` / `absPath` 投影用例；I1.2 既有断言不改 |
| `test/wp6/render.test.js`、`test/wp9/render-fixes.test.js` | 新增 `task-loop` 节点限定词、产物/审核后缀、`review(downstream)` 耗时、升级块；`single` / `code-loop` 旧样例原样保留 |
| `test/wp9/cli-e2e.test.js` | 新增 `task-loop` 发起/成功/挂起/取消；I1.2 用例全部保留（AC-36） |
| `test/wp10/review.test.js` | 新增：11 步顺序、逐字原因、`#L` 剥离、越界拒绝、`pass`/`reject` 形状 |
| `test/wp10/doc-artifact.test.js` | 新增：产物名解析、版本引用、上一版完整性、`sha256` |
| `test/fixtures/task-loop-driver.mjs` + 场景 JSON | 新增；29 个场景必须可独立运行并复位 |
| `test/fixtures/mock-acp-agent.js` | 新增 `--suite task-loop`；不带该参数时 I1.2 行为逐字不变 |

### D-10 并发、取消与恢复

| 规则 | 实现点 | 验收 |
|---|---|---|
| 同一目录只能有一个未结束的多节点实例（`code-loop` 与 `task-loop` 互斥） | `findDirBusy({multiOnly:true})` 遍历全部多节点图；`single` 不参与 | AC-25 / AC-26 |
| 同一节点在 `running` / `review`（含 `review(downstream)`）时拒绝重复投递 | `dispatchInState()` 的 `isNodeBusyState()` | AC-41 |
| 取消覆盖 `pending/running/review/failed/escalated` | `CANCELABLE_NODE` 已含这些状态；`review(downstream)` 同为 `review` | AC-28 / AC-29 |
| 取消把 `created/delivered/accepted` 交接包记 `rejected`、原因 `withdrawn` | `CANCELABLE_HANDOFF` | AC-28 |
| 取消把 `pending` 升级记 `voided` | `applyCancel` 的升级循环 | AC-29 |
| 取消后会话回 `idle`，不再执行 | `applyCancel` 的会话循环 + `quarantined` | AC-28 |
| 重启后 `suspended` 保持、`escalated` 节点保持、`failed` 保持、`review` 不自动重新核对 | `CORE_IMMUTABLE_INSTANCE` 含 `suspended`；`reconcileOnBoot` 不写挂起实例 | AC-11 / AC-12 |
| `review(downstream)` 重启后保持等待，不重派发 | 状态读取无特殊分支；只有下游交接包 `accepted` 才迁移 | AC-12（同类口径） |
| I1.1 旧格式只读；I1.2 编码闭环实例可查可取消 | `isLegacy()` 在 `run` / `cancel` 入口拦截 | AC-37 |

**`startRun` 的检查顺序（`task-loop`）**

1. 模板未知 → `TEMPLATE_UNKNOWN`；
2. 任务为空 → `TASK_EMPTY`；
3. `productPolicy==='doc-single'` 的产物声明校验（D-8）→ `PRODUCT_LINE_MISSING_TASK_LOOP` / `PRODUCT_INVALID_TASK_LOOP`；
4. 目录不可写 → `CWD_NOT_WRITABLE`；
5. 带 `--instance`：旧格式 → `LEGACY_READ_ONLY`；运行中 → `INSTANCE_RUNNING`；挂起 → `INSTANCE_SUSPENDED`；终态 → `INSTANCE_TERMINAL`；
6. 同目录已有未结束的多节点实例 → `DIR_BUSY`；
7. 建工作区（失败 → `WORKSPACE_INIT_FAILED`），再建实例。

> 3 必须在 7 之前：产物声明不合法时不得留下 `.orch/instances/<id>/workspace`（AC-22 / AC-23 的机检）。


