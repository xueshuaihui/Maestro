# I1.3 — 非编码闭环（研究 → 撰写 → 审核 → 回流 → 升级）

> 迭代：阶段一 · I1.3 ｜ 依据：`docs/index.md`（§3.1 节点状态 / §3.2 会话状态 / §3.4 交接包状态 / §3.5 一次回流时序 / §3.6 崩溃恢复、§5.2 数据布局、能力域 1 / 2 / 4 / 6、I1.3 条目）｜ 模板：`docs/templates/requirement-template.md`
> 状态：**v5（第 7 轮自洽性复核修复，可开工）** ｜ 上游：I1.2（**开发中**；契约见 `docs/iterations/iteration-2/requirement.md` v16，实现见 `src/`）
> 契约变更 **M-1 ~ M-10**、补充契约 **C-01 ~ C-14**；业务规则 **BR-01 ~ BR-40**；AC **45 条**；附录 A 输出基线、附录 B 术语与未决问题、附录 C 变更记录、附录 D 实现约束。
>
> **v5 摘要**（第 7 轮自洽性复核：**5 处阻断 + 10 处重要 + 5 处次要**）：① AC-35 的 T-002 第 2 轮换成可与 T-003 第 1 轮 `review.rejected`（`result='note'`）比较（T-003 无门控、不产生 `review.evidence_verified`）；② D-9 补登 `test/templates/fake-graph.test.js`（`buildHandoff` 键集合）与 `test/wp2/labels.test.js` 的 `REASON_LABEL` 条数两处**授权断言**，AC-36 / §3.3#10 相应放宽；③ D-6 按边表改为四行并逐列写明 `input` / `output` / `previous` 的取值来源（backflow 的 `input` 用目标轮次 n−1），并禁止 `productsOf()` 在 `doc-single` 下回退到任务 `产物：` 行；④ D-1 的 `promptFor` 只把 `research` / `write` / `review` 交给 `node.prompt`，`single` / `forward` / `verify` 与按 `edge.kind` 选 `backflow` / `retest` 的分支逐字保留；⑤ 审核提示词新增 `工作区：<绝对路径>`，`reviewDecoy` 据此定位干扰文件。其余 10 处重要项与 5 处次要项见附录 C 的 v5 行。
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
| `review_reason` 子状态（evidence / downstream） | §2.3；附录 D-3 | AC-04、AC-05、AC-34 |
| **验收**：审核角色第 2 轮驳回 → 核心停止回流、生成升级 | §2.5；AC-10 ~ AC-12 | AC-10 |
| **验收**：与 I1.2 共享同一引擎 | §1.4 M-7 ~ M-9；附录 D-1 | AC-38 |

**规划解释登记（R）**

- **R-1（模板范围）**：`review_reason` 子状态本迭代只在 `task-loop` 启用。I1.2 的 `code-loop` 在判定后立即落 `failed`，46 条 AC 已把这个时序钉死；若回填"等待下游"，`failed` 的出现时刻、`--stop-after 2` 的中间态与多条 AC 都会改变。因此 `code-loop` 保持 v16 口径，`task-loop` 完整实现 `evidence → downstream → done` 的门控；引擎以图节点标志启用，后续迭代可零改动回填 `code-loop`。
- **R-2（数据布局节奏）**：基线 §5.2 的 `workspace/` 下还有 `shared/`、`stage/`、`status.md`，它们属于 I1.4。本迭代只创建 `workspace/artifacts/docs/` 与 `workspace/artifacts/reports/`；不创建、不显示其他目录。
- **R-3（产物声明形态）**：`task-loop` 的 `产物：` 行只接受**裸文件名**（如 `产物：release-notes.md`），不接受路径。版本号与目录由核心按规则生成，避免用户写出的路径与版本区不一致。
- **R-4（研究笔记归类）**：研究笔记是"报告"而不是"交付文档"，固定落在 `artifacts/reports/`，与交付文档的 `artifacts/docs/` 分开；这样用户把交付文档命名为 `research-notes.md` 也不会撞名。
- **R-5（审核无效的处置）**：审核文件无效（缺失、陈旧、不可解析、引用不符、证据不可解析）一律升级并挂起，不回流。理由与 I1.2 的"判定无效不回流"一致：无效文件不构成可执行的驳回意见，回流只会把噪声带给撰写者。
- **R-6（内容指纹提前到本迭代）**：`src/core/verify-artifact.js` 的注释把 `sha256` 排在 I1.12，但本迭代的"上一版必须原样保留"（BR-07 / AC-20）与交接包的 `previous` 指纹（M-4）都需要内容指纹，靠 `mtime` 无法证明未被改写。因此按 M-6 **只提前最小面**：对核对通过的产物计算一次 `sha256` 并落盘（`artifactRefs` / `artifactHistory` / `handoff.artifactRefs.previous`）；基线里的"证据过期检测：证据与声明产物指纹不一致时拒绝交接"和"从 `session/update` 提取工作区指纹"（属 I1.11 / I1.12 规划）本迭代不做。

### 1.4 对 I1.1 / I1.2 契约的修改（授权变更）

> 说明：M 是"必须改代码/数据结构"的变更；C 是补充契约（实现时必须按此口径，避免出现两套解释）。未列出的 I1.2 契约保持不变。

| 编号 | 现状（I1.2 v16 / 代码） | 变更 | 为什么 | 兼容 / 影响 |
|---|---|---|---|---|
| **M-1** | `src/templates/index.js` 的 `ROLES` 只有 developer / tester / coordinator（`:19`），`GRAPHS` 只有 `single` / `code-loop`（`:147`）；中文标签在**另一处**——`src/cli/labels.js` 的 `ROLE_LABEL`（`:51`）与 `TEMPLATE_LABEL`（`:58`）只登记既有项 | 新增内置角色 `researcher` / `writer` / `reviewer`，新增图 `task-loop`（三节点四边），注册到 `GRAPHS`；`TEMPLATE_LABEL` 增 `task-loop: '通用任务闭环'`；`ROLE_LABEL` 增三项（**这两项改在 `src/cli/labels.js`，不在模板目录**）。角色仍是代码常量，不加载 YAML | 规划要求三个内置角色与通用任务闭环 | 既有 id 与名称不变；未知模板仍返回 `TEMPLATE_UNKNOWN`；I1.5 注册表启用时可原样迁移 |
| **M-2** | 图节点字段：`id/nodeId/roleId/order/title/artifactPolicy/judge/products/wakeFrom/prompt` | 图级追加 `productPolicy: 'declared' \| 'doc-single'`（缺省 `declared`）；节点追加可选字段：`downstreamGate`（布尔）、`artifactPolicy` 取值扩展 `fixed-workspace` / `versioned-doc` / `review`、`artifactDir`、`artifactExt`、`reviewPath`、`prompt` 取值 `research` / `write` / `review`。字段缺省时行为与 I1.2 完全一致 | 引擎不能写死模板名/角色名（AC-38）；产物声明规则、产物与审核策略必须由图数据驱动，`startRun` 不得按模板名分支 | 旧图不填新字段即保持原语义；`productPolicy` 缺省沿用 I1.2 的 `declared` |
| **M-3** | `nodes[]` 字段含 `nodeId/roleId/round/state/stateSince/startedAt/roundStartedAt/endedAt/failure/note/verdict/sessionId/artifactRefs`；`artifactRefs[]` 无 `sha256`/`round`，且每次派发被清空；顶层 `state` 无产物名词干字段 | `nodes[]` 追加 `reviewReason: 'evidence'\|'downstream'\|null`（**只在 `state==='review'` 期间有值**：新一轮派发时清 `null`，取消落盘时也清 `null`，见 AC-45）、`review: object\|null`（**唯一形状见 D-6**：`{decision, defectCount, reviewPath, artifact, readAt, defects:[{summary,evidence}], revisionRequirement}`，与 D-7 的返回值逐字段一致）；`artifactRefs[]` 的落盘投影**按产物策略分流**（见 M-6）：`declared`（`single` / `code-loop`，缺省）逐字沿用 I1.2 的 spread（`{...verifyProducts 的 ref, verifiedAt: iso()}`，`src/core/orchestrator.js:1225` 与 `:1528`），**不加 `sha256`、不删字段**；只有 `doc-single` 的 `fixed-workspace` / `versioned-doc` 投成 `{ref, bytes, sha256, verifiedAt}`。**不加 `round`**：轮次只进 `artifactHistory`；新增 `artifactHistory[]`（只追加，不随派发清空），元素 `{round, ref, sha256, bytes, verifiedAt}`；顶层追加 **`artifactStem: string\|null`**（与字符串 `task` 并列，**不改 `state.task` 的形状**；仅 `productPolicy==='doc-single'` 有值，`startRun` 从产物行算出并只读，旧实例缺省 `null`；详见 D-8） | 下游门控需要可观测的子原因；版本完整性需要上一轮指纹；审核结果需要审计；版本引用要按轮次生成，必须有一个不受任务原文漂移的名干 | 全部为追加字段；`schemaVersion` 仍为 2；I1.2 状态文件读取不受影响（缺字段即 `null`） |
| **M-4** | 交接包字段含 `handoffId/edge/state/timestamps/rejectReason/acceptedSignal/ambiguityWindowMs/defects/note/wakeConsumedAt`；`handoffToState()` 是白名单投影 | 追加 `artifactRefs: {input: string[], output: string\|null, previous: {ref, sha256}\|null}` 与 `revisionRequirement: string\|null`；`handoffToState()` 仅在源对象**确实带该字段**时投影（与 `edge/defects/note` 同规则）；`consumeHandoff()` 里显式重组快照的那一处必须同步透传，否则 `accepted → consumed` 时新字段会被抹掉 | 回流要带上一版引用与修改要求；白名单若漏字段，任意 `session/update` 都会把上下文抹掉（I1.2 M-5 同类缺陷） | 旧交接包没有新字段时渲染与行为不变 |
| **M-5** | 只有 `src/core/verdict.js`（`out/verdict.json`），六类失败顺序 | 新增 `src/core/review.js`（`out/review.json`），按 D-7 的 11 步顺序返回机器码与逐字原因；`verdict.js` 不改 | 审核是第二个"只认文件"的判定入口；不能用模板名分支塞进 `verdict.js` | 新模块；`code-loop` 的判定路径零改动 |
| **M-6** | `verifyProducts()` 只接受 `{cwd, products, roundStartedAt}`；`sha256` 不计算 | `verifyProducts()` 追加可选 `baseDir`（默认 `cwd`）与 `sha256`（默认不计算）；**返回值只追加 `sha256`**，I1.2 的 `{ref, absPath, exists, bytes, mtime, verifiedAt}` 一个字段都不能少或改名（`src/core/verify-artifact.js:336-343` 是唯一事实，`test/wp4/verify-artifact.test.js:178-179` 断言 `mtime` / `verifiedAt` 是字符串）；两个新参数都不传时返回元素与 I1.2 逐字一致。落盘投影按策略分流（M-3 / D-3）：`declared` 保持现有 spread，`doc-single` 才去掉 `absPath` / `exists` / `mtime` 投成 `{ref, bytes, sha256, verifiedAt}`。（I1.2 需求 A-2 把落盘元素写成 5 字段、实现实际多一个 `mtime`；本迭代**以实现为事实**，两者都不动）；新增 `src/core/doc-artifact.js`：产品名解析、版本引用生成、上一版完整性校验。`finishArtifactNode()` 与 `hasSubmittedOutput()` 都改用 `doc-artifact.resolveNodeProducts()`，`baseDir` 按 `artifactPolicy` 取：`fixed-workspace` / `versioned-doc` 用 `workspaceDir`，`declared` 用 `cwd`（I1.2 语义不变）；`hasSubmittedOutput()` 不再回退到任务里的 `产物：` 行；`judge:'review'` 的节点在 `hasSubmittedOutput()` 中用 `readReview()` 判定是否交卷 | 文档产物在实例工作区，不在任务根；旧版指纹必须可复核；状态文件不得保存绝对路径（NFR-08）；否则 T-002 会被任务里的裸文件名误导，回合结束被误判为"无产出" | `baseDir` 缺省时行为不变；`sha256` 为追加字段；I1.2 调用点无需改 |
| **M-7** | `finishGraphNode()` 只分 `judge:'verdict'` 与产物节点；产物节点核对通过即 `done` | 增加 `judge:'review'` 分支 `finishReviewNode()`：合法 `pass → done`、合法 `reject` 未超限 `→ failed`、合法 `reject` 超限 / 无效 `→ escalated`；事件 `review.read/passed/rejected/invalid`。**与推进层的映射**：`classifyNodeOutcome()` 对 `state==='failed'` 的审核节点读 `node.review.decision`，`'pass'` 当 `'pass'`、`'reject'` 当 `'fail'`；`planAdvance()` 在 `verdict-fail` 分支优先用 `node.review.defects` / `node.review.revisionRequirement` 构造回流包 | 审核节点与测试节点语义不同：驳回是业务结果，无效是异常；不显式映射会被 `classifyNodeOutcome()` 当 `error` 升级，回流永远不会发生 | 只对 `judge:'review'` 生效；`verdict` 路径不变 |
| **M-8** | 产物节点核对通过即 `review → done`；节点进入 `review` 时不写任何子原因；`latestEndedNodeId()` 只认 `done/failed/escalated`；`classifyNodeOutcome()` 对 `review` 返回 `error` | 启用 `downstreamGate` 的节点：在 `running → review` 那一次落盘（**核对之前**，D-3 步骤 1）就写 `reviewReason='evidence'`，因此 `after_output` 暂停点可见 `待校验（核对证据）`；核对通过后保持 `review`，子原因 `evidence → downstream`（不改状态、不发迁移事件），记录 `endedAt`，由 `advance` 派发下游；下游首个 turn 事件时 `review(downstream) → done`；`latestEndedNodeId()`（`orchestrator.js` 与 `advance.js` 两处同名逻辑）纳入 `review(downstream)`；`classifyNodeOutcome()` 把 `review(downstream)` 归为 `passed` | 基线的 `done` 要等下游接受；否则"已完成"会在下游接手前出现；子原因若只在核对后写，核对期间的状态就与 I1.2 完全同形，用户分不清"在核对"还是"在等下游" | 仅 `downstreamGate:true` 的图节点写 `reviewReason`；无门控的图该字段恒为 `null` 且渲染为裸 `待校验`（B-10），`code-loop` / `single` 输出逐字不变（R-1） |
| **M-9** | CLI 只有 I1.2 的 4 个模板错误码；`PREFLIGHT_CODES` 只有 `DSH_SPAWN_FAILED` / `CWD_NOT_WRITABLE` / `CORE_START_FAILED`（退出码 3）；节点行只有"失败（等待复测）"三档限定词；无审核/产物后缀 | `startRun` 按图数据校验 `task-loop` 产物行；新增错误码 `PRODUCT_LINE_MISSING_TASK_LOOP`、`PRODUCT_INVALID_TASK_LOOP`、`WORKSPACE_INIT_FAILED`；**`WORKSPACE_INIT_FAILED` 与 `CWD_NOT_WRITABLE` 一样加入 `PREFLIGHT_CODES`**（`src/cli/main.js`），因此退出码 3；新增节点限定词"核对证据 / 等待下游 / 等待复审"、审核后缀与产物后缀；新增事件中文词条 | 用户必须看到"为什么停"与"这一轮交了什么"；创建不出工作区时不能把它当成一次普通运行失败 | 新文案只在 `task-loop` 出现；`single` / `code-loop` 输出逐字不变；既有三个 preflight 码的退出码不变 |
| **M-10** | 夹具只有 `code-loop-driver.mjs`，mock agent 的 step 选项只服务 code-loop 场景 | 新增 `test/fixtures/task-loop-driver.mjs`（透传 `orch run` 的 stdout 与退出码）；mock agent 增 `--suite task-loop`、`artifact` / `review` / `artifactUtimes` / `reviewUtimes` / `mutatePrevious` 步；新增 D-9 的测试同步清单 | 审核/版本/下游门控必须有确定性夹具；真实面只覆盖一条主路径 | `--suite` 缺省为 code-loop，I1.2 场景逐字不变 |

#### 补充契约条目（C-01 ~ C-14）

| 编号 | 契约 |
|---|---|
| **C-01** | 实例工作区路径唯一由 `src/persistence/paths.js` 计算：`instanceWorkspaceDir(root, id)` = `<root>/.orch/instances/<id>/workspace`；本迭代只创建 `artifacts/docs/` 与 `artifacts/reports/`。其他模块不得自行拼 `.orch/instances/...`。创建失败返回 `WORKSPACE_INIT_FAILED`，不落实例 |
| **C-02** | `task-loop` 的任务必须含且只含一个 `产物：<文件名>.md`（全角冒号）。文件名不得含 `/`、`\`、`..`、盘符；去掉 `.md` 后不得以 `.v<数字>` 结尾（如 `release-notes.v1.md` 自带版本号）；不接受 `.md` 以外扩展名。违反分别返回 `PRODUCT_LINE_MISSING_TASK_LOOP` / `PRODUCT_INVALID_TASK_LOOP`，退出码 1，不建实例 |
| **C-03** | 审核文件固定为任务目录相对的 `out/review.json`；状态与事件中只写该相对路径，不写绝对路径 |
| **C-04** | 审核读取顺序固定：缺失 → 陈旧 → 不可读/不可解析/schema → 结论枚举 → 文档引用 → 缺陷形状 → 证据可解析。命中即返回，不继续后续检查；每次失败都带机器码（D-7；同一原因码可对应多步，如不可读与不可解析都记 `review_invalid`） |
| **C-05** | 审核文件只认 `decision` / `artifact` / `defects` / `revisionRequirement` 四个字段，未知字段忽略。`decision='pass'` 时 `defects` 必须为空；`decision='reject'` 时 `defects` 必须非空，每条含非空 `summary` 与非空 `evidence`；`revisionRequirement` 可空，空时使用默认修改要求 |
| **C-06** | 审核的 `artifact` 与 `defects[].evidence` 都是**实例工作区相对路径**；允许证据带 `#L<数字>` 行号后缀，校验时剥离后缀。绝对路径、盘符、含 `..` 的路径一律视为不可解析。证据文件必须存在且 `bytes > 0` |
| **C-07** | 撰写版本引用 = `artifacts/docs/<stem>.v<node.round><ext>`；`stem` 来自任务产物名的去扩展名部分；轮次只增不减、绝不复用。研究笔记固定 `artifacts/reports/research-notes.v1.md` |
| **C-08** | 每轮产物核对成功后计算 `sha256` 并写入 `artifactRefs` 与 `artifactHistory`。撰写第 `n>1` 轮在核对当前版**之前**先核对第 `n-1` 版：不存在 → `artifact_previous_missing`；指纹不符 → `artifact_previous_modified`。两种都升级挂起，不派发审核 |
| **C-09** | 下游接受的幂等键是"交接包 `accepted` 那一刻 + 源节点处于 `review(downstream)`"。同一交接包只允许把源节点迁移一次；后续帧命中时直接返回。迁移为 `review → done`，同时把源节点对应的会话从 `waiting_dependency` 拉回 `idle`；两条迁移必须写在下游节点的同一个 live 状态里，并随触发接受的这一次帧保存**一次 CAS 落盘**（不得另起一次落盘后再回头覆盖，否则 rev 冲突会丢状态）。源节点的 `review → done` **不得**走 `transit()`（它自带一次 CAS）；直接在帧内改 live 状态 + 手工 emit 一条 `result='applied'` 事件，由该帧排队的 `saveLive` 一起落盘 |
| **C-10** | 下游接受只认 I1.2 已实现的 `TURN_UPDATES` 白名单事件，且交接包必须先 `delivered`；噪声帧不触发接受（沿用 `handoff-tracker` 的硬约束） |
| **C-11** | 节点回合结束、产出已提交时，会话即进入 `waiting_dependency`（显示"等待下游"）——这一刻早于证据核对；启用下游门控的源节点核对通过后**保持**该状态、不进入 `idle`，下游接受后再 `idle`。审核节点自身在合法通过/驳回后直接 `idle`。不得出现"节点已完成、会话仍在执行中" |
| **C-12** | 取消覆盖 `pending/running/review/failed/escalated` 节点（含 `review(downstream)`）；`created/delivered/accepted` 交接包记 `rejected`（原因 `withdrawn`，与 I1.2 的 `CANCELABLE_HANDOFF` 一致）；`pending` 升级记 `voided`；实例落 `cancelled`。取消与升级并发时沿用 I1.2 的 CAS 优先口径 |
| **C-13** | 目录唯一性对**所有多节点图**生效（`code-loop` 与 `task-loop` 互斥）：同一 `cwd` 下存在未结束的多节点实例时，新发起返回 `DIR_BUSY`。`single` 实例不参与该限制（与 I1.1 一致） |
| **C-14** | 重启后：`suspended` 保持挂起（`CORE_IMMUTABLE_INSTANCE` 含它，不被改写）；其余未终态实例被 `reconcileOnBoot` / `interruptAll` 记成 `interrupted`，**状态字段**（`state` / `round` / `reviewReason` / 交接包 `state`）不被改写——`escalated` 节点保持、`failed` 节点保持等待复审、`review` 节点不自动重新核对、不重复派发；唯一的例外是 `note` 会被写成停点说明（见 AC-45 注）；`v1` 旧格式只读。`schemaVersion` 不因本迭代升到 3；新增字段全部可缺省读取 |

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
orch run --cwd ./demo-doc --template task-loop --task "写一篇发布说明，面向使用 v1.2 的开发者，包含「新功能」「升级步骤」「回滚方案」三节。
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

**发起前的六种拦截**

| 情况 | 我看到 | 退出码 |
|---|---|---|
| 任务只有空白字符 | `任务描述不能为空` | 1 |
| 没写 `产物：` 或用了半角冒号 | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）` | 1 |
| 产物带目录、非 `.md`、或自带版本号 | `通用任务闭环的产物名不合法：<我写的内容>（只写文件名，.md 结尾，不带目录与版本号）` | 1 |
| 模板名不存在 | `未知模板：<名字>` | 1 |
| `--cwd` 指到不可写的目录 | `工作目录不可写：<绝对路径>`（CLI 先把 `--cwd` 按当前 shell 目录解析成绝对路径再交给核心，所以这里回显的是解析后的路径，不是我敲的 `./no-such-dir`） | 3 |
| 任务目录可写，但工作区目录创建失败（如磁盘满、只读卷） | `无法创建工作区：<原因>` | 3 |

六种情况都不会建实例、不会建会话、不会创建工作区目录（`.orch/instances/` 下不出现该实例目录，`workspace/artifacts/` 也不出现）。后两种属于"开始前失败"，与 DSH 起不来同类，所以退出码同为 **3**；前四种（任务为空、没写产物行、产物名不合法、模板名不存在）是这次发起的参数不合法，退出码 **1**。

这六条是本迭代新增的**参数与前置检查**；编码闭环已有的五条发起拦截——同目录已有一个在跑的实例（`DIR_BUSY`）、指定实例正在运行（`INSTANCE_RUNNING`）、指定实例已挂起、指定实例已终态、旧格式实例只读——在通用任务闭环上一字不改地生效，文案、退出码与"不新建实例"的行为都沿用 I1.2（§2.8 的共存清单与 AC-24 / AC-36 一起守这条）。

### 2.3 B 看三个节点到哪

`orch status --instance INST-001` 的节点表：

```text
实例 INST-001 · 运行中 · 模板 通用任务闭环
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 6s
节点 T-003 审核者 执行中 · 第 1 轮
会话 空闲
交接包 HO-001  研究员→撰写者  已构造   10:00:01
交接包 HO-001  研究员→撰写者  已投递   10:00:02
交接包 HO-001  研究员→撰写者  已接受   10:00:02
交接包 HO-001  研究员→撰写者  已完成   10:00:08
交接包 HO-002  撰写者→审核者  已构造   10:00:10
交接包 HO-002  撰写者→审核者  已投递   10:00:10
交接包 HO-002  撰写者→审核者  已投递   等待目标响应 · 已等待 1s
升级 —
```

和编码闭环一样，一个交接包已发生过的每个状态各占一行（所以 HO-001 有 4 行、HO-002 有 2 行 + 1 行等待）。

这里 T-002 已核对通过、正等下游接手，所以是"待校验（等待下游）"；T-003 已拿到交接包并开始执行，审核者接手后 T-002 才转"已完成"。

**为什么 T-003 已经是"执行中"，而 HO-002 还停在"已投递"、会话却还是"空闲"**：这里读的是三个不同来源。**节点**"执行中"来自**派发**那一刻（核心把节点置 `running` 并把提示词交给宿主）；**会话**"执行中"和交接包"已接受"来自**同一个信号**——下游第一个"回合内"帧（`agent_message_chunk` / `agent_thought_chunk` / `tool_call` / `tool_call_update` / `plan` / `user_message_chunk` 六类之一，噪声帧——用量与可用命令——不算）。所以在"刚派发完、下游还没回帧"这一瞬间，正确的组合就是：T-003 `执行中`、会话 `空闲`、HO-002 `已投递` + 等待行、T-002 仍 `待校验（等待下游）`。等那个帧一到，会话同时翻"执行中"、HO-002 同时变"已接受"，T-002 也在这同一帧转"已完成"（AC-05 / AC-34）。

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

**耗时口径**：节点行显示的耗时是**这个节点"首次派发 → 本轮结束"的累计区间**，沿用编码闭环已有的口径——同一节点被重新打开时，起点不重置。所以研究员（只有一轮）的 4s 就是它干活的时间；撰写者跑到第 2 轮时，节点行显示的是从第 1 次派发到第 2 轮核对通过的总时长，中间审核者那轮和等待下游的时间都包含在内。**上游核对通过之后等下游接手的那段，不计入上游耗时**（结束时刻在核对通过时就已写下）。要看每一轮各自干了多久，用 `orch status --instance <号> --events` 对照事件时间戳（AC-35）。

**会话行**：只显示当前（最后一个）会话。**两个面不一样**：`orch status` 的第 4 段就是状态词本身（上游已交产出、正在等下游时显示 `会话 等待下游`，不带后缀）；`orch run` 的流式会话行在同一个状态下会追加 `· 产出已提交`（`会话 等待下游 · 产出已提交`，见 A-1）。**这个"等待窗口"从上游产出提交的那一刻就开始**——会话在核对证据之前就先切成等待下游，所以它同时覆盖"待校验（核对证据）"和"待校验（等待下游）"两段（AC-04 用 `--stop-after 2` 定格的是后一段）。下游一旦派发，会话行就切到下游的新会话，从 `会话 空闲` 起步——要等下游第一个"回合内"帧回来才变 `会话 执行中`（与交接包"已接受"同帧，见上）。这里只展开本迭代新增的这一支；六种会话状态各自的逐字行（含 `执行中 · 调用工具（…）`、`等待审批：…`、`已升级`）见 A-2 第 4 段的表，本迭代一条都不改。

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

**升级块固定四行 + 可选缺陷行**：抬头（升级号与状态）、原因、节点与轮次、下一步这四行必有；缺陷按条数 0..N 行插在"节点"与"下一步"之间（`rounds_exceeded` 才有）。逐字版式见 A-2 第 6 段。节点行只显示 `已升级`，具体原因在升级块里，不在节点行里堆。

**升级不是失败**：`orch run` 以"挂起"结束，退出码 4；不要用"失败"两个字去理解它。

**升级本身写不进去时**（例如状态文件写入失败）：核心不会假装挂起，也不会继续派发。它会停住并这样收尾：

```text
无法记录升级：<原因>；已停止推进
实例 INST-001 · 运行中 · 已停止推进 · 模板 通用任务闭环
节点 T-003 审核者 待校验（升级未记录） · 第 1 轮
下一步：查看 orch status --instance INST-001 --events；本版本不能继续，只能取消
```

- 退出码 5；节点保持升级前的状态（这里停在"待校验"），不会被改成"失败"或"已升级"。
- 实例仍是"运行中"，但带"已停止推进"；不会再自动派发，只能取消。
- 等 60 秒再查也不会自己恢复。

### 2.7 F 版本化文件区与审核文件

**目录**

```text
<项目根>/                              # 我执行 orch 命令时所在的目录（.orch 就在这里）
└── .orch/instances/INST-001/workspace/
    └── artifacts/
        ├── docs/
        │   ├── release-notes.v1.md      # 第 1 轮
        │   └── release-notes.v2.md      # 第 2 轮（若发生驳回）
        └── reports/
            └── research-notes.v1.md     # 研究员交的研究笔记

<任务目录>/                              # orch run --cwd 指的地方，在项目根之下
└── out/review.json                      # 审核者每轮覆盖写
```

两个根不是一回事（沿用 I1.2 的执行根规则）：`.orch/` 与实例工作区跟着**项目根**走，`out/review.json` 跟着 `--cwd` 的**任务目录**走；夹具默认任务目录是 `<项目根>/demo-doc`，所以它显示在项目根下面，但换目录发起时两者会分开。

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

- 正在执行的节点、待校验的节点（无论"核对证据"还是"等待下游"）、失败等待复审的节点、已升级的节点都会收成"已取消"。取消后"等待下游"的限定词消失，节点行只剩 `已取消`。耗时按 A-2 的口径：**只要这个节点被派发过，取消后就有耗时**——取消收尾会把"首次派发 → 取消时刻"写成一格，正在执行、停在"核对证据"、停在"等待下游"三种停点一视同仁（都不显示"耗时 0s"）。没派发过的节点（`待执行`）仍然没有轮次、没有耗时。
- 已构造未投递的交接包记"已拒绝 · 已撤回"；已投递或已被下游接受的同样撤回。**已经"已完成"（被下游产出消费掉）的交接包不撤回**，它保持"已完成"。
- 待处理的升级作废。
- 已完成的节点保持"已完成"，不会被取消回滚。
- 一般 5 秒内收敛；收完后会话不再执行。

**重启**

- 核心重启（崩溃、被停、我主动 `orch core stop`）之后，当时还没结束的实例会被记成**已中断**——包括停在"待校验（等待下游）"的那一个；**唯一例外是"已挂起"**：挂起中的实例连实例层都不被改写，重启后仍是"已挂起"（升级块与轮次都还在）。这是编码闭环已有的口径，本迭代不改。
- "已中断"是终态：之后 `orch cancel` 只会回 `实例已结束（已中断），无需取消`、退出码 1，既不撤回交接包也不改节点。想再跑只能重新发起一个新实例。所以"既停在等待下游、又能取消"只在**核心还活着**的时候成立（AC-45 因此分成两根验）。
- 对账只改写"实例"这一层和一条停点说明，**状态字段**（`state` / `round` / `reviewReason` / 交接包 `state`）不被改写；`note` 会被写成停点说明（见 AC-45 注）：停在"等待下游"的节点仍是"待校验（等待下游）"，不会被补判成"已完成"；已"已完成"（被下游消费掉）的交接包保持"已完成"；失败的节点仍带"等待复审"、已升级的节点仍是"已升级"；不新增派发、不新增交接包、不自动推进。
- `orch status` 在"已中断"下把实例行换成 `实例 INST-001 · 已中断 ｜ 停在节点 <状态> / 会话 <状态>`，**节点表、会话行、交接包行照常打印**（编码闭环的既有行为：只是不重复打实例行，不是只留一行）。停点那句里的节点必须是真正卡住的那一条——三节点模板里"第一个执行中/待校验的节点"往往是 T-002，而这条提示过去取的是节点表第一条（通常是已完成的研究员 T-001），会写成"停在节点 已完成"。I1.3 把这两处对齐（A-2 第 2 段、D-6、AC-45 第 1 支）。

**老实例**

- I1.1 的旧格式实例仍然只能查看，不能取消、不能重跑、不能继续。
- I1.2 的编码闭环实例在本版本可以照常查看与取消；它们的状态与输出不受通用任务闭环影响。

**与编码闭环共存**

- 同一目录下两种闭环不能同时跑；第二个发起会被 `DIR_BUSY` 拦下。
- 编码闭环保持 I1.2 的显示与时机：测试判定不通过时，测试节点直接显示"失败（等待复测）"，不出现"待校验（等待下游）"（R-1）。
- 通用任务闭环才使用"待校验（核对证据）→ 待校验（等待下游）→ 已完成"这条门控。

### 2.9 功能之间的衔接：走完一遍

下面是一次"一轮驳回、一轮通过"的完整走查。每一步给出节点表和**本步新增的**交接包状态行（未列出的行保持上一步的样子）；一个包已发生过的每个状态各占一行，完整版式见 §2.3。

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
会话 执行中 · 已运行 1s
交接包 HO-001  研究员→撰写者  已构造   10:00:01
交接包 HO-001  研究员→撰写者  已投递   10:00:02
交接包 HO-001  研究员→撰写者  已接受   10:00:02
```

研究员交出的研究笔记成为撰写者的输入；撰写者的提示词里写明研究笔记引用与本轮要写的文档引用。

**第 3 步：撰写者交 v1，审核者接手**

```text
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 待校验（等待下游） · 第 1 轮 · 耗时 6s
节点 T-003 审核者 执行中 · 第 1 轮
会话 空闲
交接包 HO-001  研究员→撰写者  已完成   10:00:08
交接包 HO-002  撰写者→审核者  已构造   10:00:10
交接包 HO-002  撰写者→审核者  已投递   10:00:10
交接包 HO-002  撰写者→审核者  已投递   等待目标响应 · 已等待 1s
```

此时 v1 已经通过"存在、非空、本轮新写"的核对（HO-001 也在这一刻被消费为"已完成"），审核者已被派发（节点已是"执行中"），但它的**第一个回合内帧还没到**——所以交接包仍是"已投递"、会话仍是"空闲"。那个帧一到，三件事同时发生：会话转"执行中"、HO-002 转"已接受"、T-002 转"已完成"。再往前一点，在"撰写者产出已提交、证据还没核对完"的那一刻，会话行就已经是 `会话 等待下游` 了（等待窗口从产出提交开始，比"待校验（核对证据）"更早，见 §2.3 的会话行），节点行则是 `待校验（核对证据）`；`--stop-after 2` 的定格发生在证据核对之后、审核者派发之前，所以那一拍看到的是 `节点 T-002 撰写者 待校验（等待下游）` 配 `节点 T-003 审核者 待执行` 与 `会话 等待下游`（AC-04；`· 产出已提交` 后缀只出现在 `orch run` 的流式行，见 A-1）。

**第 4 步：审核者驳回**

```text
节点 T-002 撰写者 执行中 · 第 2 轮
节点 T-003 审核者 失败（等待复审） · 第 1 轮 · 耗时 3s · 审核 驳回 · 缺陷 2 条
会话 执行中 · 已运行 1s
交接包 HO-002  撰写者→审核者  已接受   10:00:11
交接包 HO-002  撰写者→审核者  已完成   10:00:13
交接包 HO-003  审核者→撰写者（回流）  已构造   10:00:13
交接包 HO-003  审核者→撰写者（回流）  已投递   10:00:13
交接包 HO-003  审核者→撰写者（回流）  已接受   10:00:14
```

撰写者在审核者接手时先变成"已完成"（HO-002 已接受的那一刻），紧接着被回流重新打开为第 2 轮；HO-001 仍是"已完成"（它在撰写者第 1 轮产出核对通过时就已消费）。

**第 5 步：撰写者交 v2**

```text
节点 T-002 撰写者 待校验（等待下游） · 第 2 轮 · 耗时 19s
节点 T-003 审核者 执行中 · 第 2 轮
会话 空闲
交接包 HO-003  审核者→撰写者（回流）  已完成   10:00:20
交接包 HO-004  撰写者→审核者（复测）  已构造   10:00:20
交接包 HO-004  撰写者→审核者（复测）  已投递   10:00:20
交接包 HO-004  撰写者→审核者（复测）  已投递   等待目标响应 · 已等待 1s
```

v2 已写出，上一版 v1 复核未变、原样保留；审核者从"失败（等待复审）"重新打开为第 2 轮，正在复测。**这里的"耗时 19s"是从撰写者首次派发（约 10:00:02）算到第 2 轮核对通过的累计时长**，不是第 2 轮单独用了 19 秒——撰写者被重新打开时起点不重置（§2.3 的"耗时口径"）。

**第 6 步：复测通过，闭环完成**

```text
实例 INST-001 · 已完成 · 模板 通用任务闭环
节点 T-001 研究员 已完成 · 第 1 轮 · 耗时 4s · 产物 artifacts/reports/research-notes.v1.md
节点 T-002 撰写者 已完成 · 第 2 轮 · 耗时 19s · 产物 artifacts/docs/release-notes.v2.md
节点 T-003 审核者 已完成 · 第 2 轮 · 耗时 9s · 审核 通过
会话 空闲
升级 —
```

（实例已进入终态，所以不再出现交接包等待行；HO-001 ~ HO-004 各自的最后一行都是"已完成"。）

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
  下一步：本版本只能查看；要终止请执行 orch cancel --instance INST-001
```

撰写者保持"已完成"（它的产物没问题），审核者"已升级"，没有第 4 次派发，也没有回流包。

### 2.10 用户可见的业务规则

| 编号 | 规则 | 覆盖 AC |
|---|---|---|
| **BR-01** | 通用任务闭环固定三个节点，按"研究 → 撰写 → 审核"顺序推进；第一个执行的是研究员 | AC-01 |
| **BR-02** | 发起任务必须非空，且含唯一一行 `产物：<文件名>.md`（全角冒号、裸文件名、`.md`、不带版本号） | AC-01、AC-22、AC-23 |
| **BR-03** | 同一目录不能同时存在两个未结束的多节点实例（编码闭环与通用任务闭环互斥） | AC-25、AC-26 |
| **BR-04** | 运行中、已挂起、已结束的实例都不能在原实例上再次发起 | AC-27 |
| **BR-05** | 研究笔记固定交到 `artifacts/reports/research-notes.v1.md` | AC-01、AC-02、AC-21 |
| **BR-06** | 撰写产物固定交到 `artifacts/docs/<名>.v<轮次>.md`，第 1 轮是 v1 | AC-02、AC-03、AC-07、AC-09、AC-40 |
| **BR-07** | 每一轮写新版本，旧版本不得被改写或删除；旧版被删/被改时停下升级 | AC-07、AC-09、AC-20、AC-40 |
| **BR-08** | 文档与研究笔记必须存在、非空、且是本轮新写 | AC-03、AC-19、AC-21 |
| **BR-09** | 审核结论只认 `out/review.json`，不认对话 | AC-13、AC-32 |
| **BR-10** | 审核文件必须是审核者本轮新写 | AC-14 |
| **BR-11** | 审核结论只能是 `pass` 或 `reject` | AC-15 |
| **BR-12** | 审核引用的文档必须等于本轮文档引用 | AC-16 |
| **BR-13** | 通过时缺陷清单必须为空；驳回时必须至少一条缺陷，每条含摘要与证据 | AC-17 |
| **BR-14** | 缺陷证据必须能在工作区内解析；绝对路径、盘符、`..` 不接受 | AC-18 |
| **BR-15** | 审核文件无效时一律升级挂起，不回流、不再派发 | AC-13 ~ AC-18、AC-31 |
| **BR-16** | 产物无效时一律升级挂起，不派发下游 | AC-19、AC-20、AC-21 |
| **BR-17** | 审核驳回且未到上限时，自动回流到撰写者，撰写轮次 +1 | AC-07、AC-09、AC-40 |
| **BR-18** | 审核最多 2 轮；第 2 轮仍驳回 → 停止回流、升级、挂起 | AC-10、AC-11、AC-40 |
| **BR-19** | 撰写最多 2 轮；第 2 轮产物核对通过后才再次派发审核 | AC-07、AC-09 |
| **BR-20** | 同一节点正在执行或待校验时，重复投递被拒 | AC-41 |
| **BR-21** | 每次派发（首派除外）对应一张交接包，编号连续、不跳号 | AC-33 |
| **BR-22** | 交接包带本轮引用、上一版引用、缺陷、证据与修改要求 | AC-02、AC-03、AC-08 |
| **BR-23** | 下游接受前，上游保持"待校验（等待下游）"，不显示"已完成" | AC-04、AC-05、AC-35 |
| **BR-24** | 下游首个工作事件到达后，上游才变"已完成"；交接包随后在目标产出核对通过时变"已完成" | AC-05、AC-34、AC-35 |
| **BR-25** | 已完成的上游可以被下游驳回重新打开（撰写者 done → running） | AC-07 |
| **BR-26** | 已产出、等下游接手的会话：`orch run` 的流式会话行显示"会话 等待下游 · 产出已提交"，`orch status` 只显示"会话 等待下游"（后缀只属于运行流，本迭代不新增后缀逻辑） | AC-04 |
| **BR-27** | 取消把节点、交接包、升级收敛到终态，5 秒内完成 | AC-28、AC-45 |
| **BR-28** | 已升级节点只能取消，不能继续 | AC-29 |
| **BR-29** | 核心重启不自动推进、不重复派发：节点、会话与交接包的**状态字段**原样保留（`note` 会被写成停点说明，见 AC-45 注；挂起中的实例更是不被改写），但当时未结束的实例本身会被记成终态"已中断" | AC-11、AC-12、AC-45 |
| **BR-30** | I1.1 旧格式实例只读可查 | AC-37 |
| **BR-31** | `single` 与 `code-loop` 的输出与行为不因本迭代改变 | AC-24、AC-36 |
| **BR-32** | "待校验（等待下游）"只在通用任务闭环启用；编码闭环保持 I1.2 口径 | AC-36 |
| **BR-33** | 所有产物与证据路径不得越出实例工作区；**审核文件是唯一例外**：它是宿主侧交付物，固定读**任务目录**下的 `out/review.json`（不落到工作区，也不接受别的位置） | AC-18、AC-23 |
| **BR-34** | 审核读取、通过、驳回、无效、下游接受、回流、超上限、升级都写入事件记录 | AC-39 |
| **BR-35** | 通用任务闭环与编码闭环共用同一套推进、回流、上限与升级逻辑 | AC-38 |
| **BR-36** | 节点行必须显示这一轮的产物或审核结论，便于我知道它交了什么 | AC-02、AC-04、AC-06、AC-07 |
| **BR-37** | 升级写不进去时实例停住并明确显示"已停止推进"，不伪装成挂起或完成，也不再派发 | AC-30 |
| **BR-38** | 派发建不起会话、或回合执行报错/被拒，一律升级挂起并说明原因，不回流、不重试 | AC-42、AC-43 |
| **BR-39** | 任务目录不可写、或实例工作区创建不出来时，在发起前就停，退出码 3，既不留实例也不留半个工作区 | AC-44 |
| **BR-40** | 停在"待校验（等待下游）"的实例：核心活着时可以正常取消；核心一旦重启就记成"已中断"（终态，之后取消被拒），节点与交接包的**状态字段**（节点 `state` / `round` / `reviewReason`、交接包 `state`）原样保留（`note` 会被写成停点说明），不补判上游、不重复派发；"已中断"的停点提示必须点名真正卡住的那个节点 | AC-45 |

---

## 三、验收标准（用户视角）

> 约定：每条 AC 默认使用**全新项目根**（`.orch` 为空），并且**所有命令都在该项目根下执行**。`orch run` 必须带 `--cwd <任务目录>`（缺省任务目录是 `<项目根>/demo-doc`，下文为简洁省略 `--cwd`）；`--cwd` 指的是任务目录，**不是**项目根（I1.2 执行根规则）。`orch status` / `orch cancel` 不带 `--cwd`，项目根按当前 shell 目录解析。机检里写的 `.orch/...`、`.mock/...` 都相对项目根（即该 AC 的 `--root`），不是相对任务目录。"机检"表示读取 `.orch/instances/<id>/state.json`、`events.jsonl` 或 `.mock/prompts/<n>.json`；"夹具"表示按 §3.3 的场景名运行；"架构检查"不依赖运行实例。
> **"输出"归属**：AC 里的 `输出含 …` / `输出按 … 排列` **只指紧邻上一条 `When` 或 `Given` 的那条命令自己的 stdout**（`Then` 与同一条 `Then` 里的多个 `And` 都归属它；`orch` 的 stderr 只在写"输出含错误行"的 A-3 类断言里出现，其余按 stdout）。夹具场景的 stdout 由 `task-loop-driver.mjs` **原样透传**它最后那一次 `orch run`（§3.3 第 3 条），所以"Given 夹具场景 X 已停在……"里的 `输出` 指那次 `run`；跑到该步后新敲的 `orch status` 属于下一条 `When`，不能拿它的输出验 `run` 的文案。跨命令断言必须写成两条 `When`。
> 状态字段的中文对照见附录 A；实现结构见附录 D-6。
> **占位符规则**：`输出含"…"` 里出现 `<d>` 时，它是**通配段**而不是逐字内容——把该行按 `<d>` 切成若干逐字片段，要求它们**按顺序**出现在同一行内，且 `<d>` 处匹配 `\d+(\.\d+)?(ms|s|m|h)`（如 `耗时 <d> · 产物 X` = 逐字 `…耗时 ` + 一个耗时串 + 逐字 ` · 产物 X`）。附录 A 的格式列与 §2.2 的"我看到"列里的尖括号（`<号>`、`<d>`、`<原因>`、`<我写的内容>` 等）是**版式说明**，不是断言文本；AC 必须像 AC-23 / AC-24 那样把它换成逐字值，或按本规则拆分。除 `<d>` 外，AC 的 `输出含` 中不使用通配段（`<n>`、`<路径>` 等一律写成实际值或拆成前后缀）。**唯一的例外**：文案本身在 `labels.js` 里就带尖括号（如 `通用任务闭环需要在任务里写「产物：<文件名>.md」一行`，编码闭环的同族文案 `src/cli/labels.js:130` 也是这个形状），那是逐字内容、不是通配段，AC 按整行逐字断言（AC-22 / D-5）。

### 3.1 功能验收标准（AC）

#### AC-01 发起通用任务闭环，三节点按序建好
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：低 ｜ **规则**：BR-01、BR-02、BR-05
```gherkin
Given 全新项目根，我先执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --prepare-only
When 我执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario doc-hold-research --keep
Then 10 秒内输出含"实例 INST-001 · 运行中 · 模板 通用任务闭环"
And 第 2 行匹配 ^会话已创建 \S+$（会话号由宿主给出，不逐字断言）
And 第 3 行是"任务已投递"
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-001 研究员 执行中 · 第 1 轮"
And 输出含"节点 T-002 撰写者 待执行"
And 输出含"节点 T-003 审核者 待执行"
And 机检：nodes 依次为 T-001/T-002/T-003，roleId 依次为 researcher/writer/reviewer
And 机检：只有 T-001 的 state='running' 且 round=1；其余 round=0、state='pending'
And 机检：`.orch/instances/INST-001/workspace/artifacts/docs` 与 `.../artifacts/reports` 都存在
```

#### AC-02 研究完成后，撰写者收到研究笔记与写作路径
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-05、BR-06、BR-22、BR-36
```gherkin
Given 夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"研究员与撰写者第 1 轮均已核对通过，审核者尚未派发"
And 机检：`.mock/stopped-after-2` 存在
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
And 输出含"会话 等待下游"，且**不带**"· 产出已提交"（该后缀只在 `orch run` 的流式会话行出现，见 A-1）
Given 另起全新根 B，场景 doc-pass 以 --stop-after 2 --keep 启动
When 我读到该次 `orch run` 的流式输出（驱动透传，见 §3.3 第 3 条）
Then 输出含"会话 等待下游 · 产出已提交"
When 我等到 `.mock/stopped-after-2` 出现，执行 orch status --instance INST-001
Then 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"
And 输出含"会话 等待下游"（`status` 的第 4 段不加后缀）
And 机检：T-002 的 state='review'，reviewReason='downstream'
And 机检：T-001 的 state='done'
```

#### AC-05 下游接受之后，上游才变已完成
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-23、BR-24
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：按 `(节点, 触发它的那张交接包)` 配对断言，四对分别是 `(T-001, HO-001)`、`(T-002 第 1 轮, HO-002)`、`(T-002 第 2 轮, HO-004)`、`(T-003, 无上游门控)`：
And 机检：存在 object='node'、objectId='T-001'、to='done'、reason='review.downstream_accepted' 的事件，其 seq **大于** HO-001 的 `accepted` 事件 seq
And 机检：objectId='T-002'、to='done'、reason='review.downstream_accepted' 的事件**有 2 条**，**按 `detail.round` 配对**（`round=1` 对 HO-002、`round=2` 对 HO-004；seq 仅作交叉验证，也必须分别大于对应 `accepted` 的 seq）
And 机检：不存在 T-001 / T-002 的任何 `to='done'` 事件早于**它自己那一张**交接包的 `accepted`（逐对比较，不跨对）
And 机检：T-003 的迁移事件是 object='node'、to='done'、result='applied'、reason='verification.passed'（terminal 节点 `downstreamGate:false`，走 I1.2 既有路径）；它的审核结论是**同节点上另一条** result='note'、reason='review.passed' 的事件，两条不是同一条记录
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
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：高 ｜ **规则**：BR-06、BR-07、BR-17、BR-19、BR-25、BR-36
```gherkin
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 --keep 停在"撰写者第 2 轮已核对通过，审核者第 2 次尚未派发"
And 机检：`.mock/stopped-after-4` 存在
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-003 审核者 失败（等待复审） · 第 1 轮"
And 三行节点行里都不出现"等待复测"（那是编码闭环的限定词，通用任务闭环走不到兜底分支，见 A-2 第 3 段）
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
Given 夹具场景 doc-backflow-once 已用 --stop-after 4 --keep 停在"撰写者第 2 轮已核对通过，审核者第 2 次尚未派发"
And 机检：`.mock/stopped-after-4` 存在
Then 机检：HO-003 的 edge.kind='backflow'，defects 恰好 2 条
And 机检：每条 defect 的 summary 与 evidence 都非空，evidence 指向 v1
And 机检：HO-003 的 revisionRequirement 非空
And 机检：HO-003 的 artifactRefs.previous = {ref:'artifacts/docs/release-notes.v1.md', sha256:<非空>}
And 机检：HO-003 的 artifactRefs.output = 'artifacts/docs/release-notes.v2.md'
And 机检：`.mock/prompts/4.json` 的 `task` 字段含逐字前缀"缺陷 1："与"缺陷 2："（各一次），两条都以"（证据 "起、"）"止，中间分别是 HO-003 对应 defect 的 `summary` 与 `evidence`
And 机检：该 `task` 含"修改要求："与"上一版文档引用：artifacts/docs/release-notes.v1.md"
And 机检：该 `task` 含"本轮文档引用：artifacts/docs/release-notes.v2.md"
```

#### AC-09 第 2 轮通过 → 闭环完成，两版共存
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：中 ｜ **规则**：BR-06、BR-07、BR-17、BR-19
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
And 机检：读取根是**任务目录**而不是实例工作区——`review-missing` 场景本身就配了 `reviewDecoy:'workspace'`（D-9 的 `reviewDecoy` 项），夹具在 `.orch/instances/INST-001/workspace/out/review.json` 放一份**合法 pass** 的干扰文件，核心仍报"未找到审核文件 out/review.json"，且 `demo-doc/out/` 下没有该文件
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
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-14、BR-15、BR-33
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
And 机检：两次都是 handoffs 恰好 3 条（HO-001~HO-003），其中 edge.kind='backflow' 恰好 1 条；不存在 HO-004
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
Given 全新项目根 <根绝对路径>
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "   "
Then 输出含"任务描述不能为空"，退出码 1
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明，但没有产物行"
Then 输出含"通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）"，退出码 1
When 我执行 orch run --template task-loop --cwd ./demo-doc --task "写一篇发布说明。产物: release-notes.md"
Then 同样输出上面的提示，退出码 1
And 机检：三次之后 `.orch/instances` 仍为空，没有创建工作区目录
And 单独用 --task "" 发起时，输出含"--task 需要一个值"，退出码 2，同样不建实例
```

#### AC-23 发起前拦截非法产物名
- **验证面**：用户可见 ｜ **类型**：异常 ｜ **风险**：低 ｜ **规则**：BR-02、BR-33
```gherkin
Given 全新项目根 <根绝对路径>
When 我依次用产物名 docs/release-notes.md、../release-notes.md、C:\release-notes.md、release-notes.txt、release-notes.v1.md 执行 orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：<上面的产物名>"
Then 每次都输出"通用任务闭环的产物名不合法："开头、"（只写文件名，.md 结尾，不带目录与版本号）"结尾的一行，且冒号与"（"之间的内容**逐字等于**该次写入的产物名；五次分别是：
And `通用任务闭环的产物名不合法：docs/release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：../release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：C:\release-notes.md（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：release-notes.txt（只写文件名，.md 结尾，不带目录与版本号）`
And `通用任务闭环的产物名不合法：release-notes.v1.md（只写文件名，.md 结尾，不带目录与版本号）`
And 五次退出码均为 1
And 机检：五次之后 `.orch/instances` 仍为空
```

#### AC-24 未知模板仍被拒绝
- **验证面**：用户可见 ｜ **类型**：回归 ｜ **风险**：低 ｜ **规则**：BR-31
```gherkin
Given 全新项目根 <根绝对路径>
When 我执行 orch run --template taskloop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"
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
When 我执行 orch run --instance INST-001 --template task-loop --cwd <该实例的项目根> --task "重写发布说明。产物：release-notes.md"
Then 输出含"该实例已挂起，不能再次发起；如要重来请新建实例"，退出码 1
And 机检：INST-001 仍是 suspended，escalations 数量不变
```

#### AC-28 运行中取消 5 秒内收敛
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-27
```gherkin
Given 夹具场景 doc-slow-reviewer --keep 让撰写者完成、审核者正在执行
And 机检：HO-002 的 state='accepted'（审核者已接手）
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
Given 全新项目根 <根绝对路径>，我先执行 node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario review-missing --prepare-only（已写好 `.mock` 与 host 配置），且核心已停
When 我在 Git Bash 下执行 MAESTRO_FAULT=state_write:escalation node test/fixtures/task-loop-driver.mjs --root <根绝对路径> --scenario review-missing --keep
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
Given 夹具场景 review-says-pass 已用 --stop-after 4 --keep 停在"回流已投递、T-002 第 2 轮已核对通过"（审核者的消息说"全部通过"，但 out/review.json 写的是 reject）
And 机检：`.mock/stopped-after-4` 存在
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
Then 机检：每张 handoff 的 acceptedAt 都晚于或等于 deliveredAt（同一毫秒允许；不允许早于）
And 机检：acceptedSignal 是 turn 内事件名，不是 usage/available_commands 噪声
And 机检：每张 handoff 的 consumedAt 都晚于或等于**消费它的那一轮**的 `node.dispatch` 事件 ts（逐轮配对，不从终态 `state.json` 取 `roundStartedAt`——它会被后续轮次的派发重置，见下方说明）
And 机检：没有 handoff 停在 created/delivered/accepted
```

**为什么这里不能直接读 `roundStartedAt`**：`roundStartedAt` 每次派发都会重置成新一轮的起点（`src/core/orchestrator.js:975-985`），而 `consumedAt` 写完就不再改。doc-backflow-once 里 T-003 有两个轮次，终态文件上的 T-003 `roundStartedAt` 是**第 2 轮**的派发时刻，晚于第 1 轮那张 forward 交接包（HO-002）的 `consumedAt`——按字段比较会得出"消费早于开始"的假阳性。逐轮配对一律走 `events.jsonl` 的 `node.dispatch`（同 AC-35 / AC-39 的口径）。

#### AC-35 阶段耗时区间不重叠，等待下游不计入上游耗时
- **验证面**：夹具 ｜ **类型**：主流程 ｜ **风险**：低 ｜ **规则**：BR-23、BR-24
```gherkin
Given 夹具场景 doc-backflow-once 已完整跑完
Then 机检：T-001 的 `review.evidence_verified` 事件 ts ≤ T-002 第 1 轮 `node.dispatch` 事件 ts
And 机检：T-002 第 1 轮 `review.evidence_verified` 事件 ts ≤ T-003 第 1 轮 `node.dispatch` 事件 ts
And 机检：T-003 第 1 轮的 `review.read` 事件 ts ≤ T-002 第 2 轮 `node.dispatch` 事件 ts
And 机检：T-002 第 2 轮 `review.evidence_verified` 事件 ts ≤ T-003 第 2 轮 `node.dispatch` 事件 ts
And 机检：T-001 第 1 轮的 `roundStartedAt` ≥ `run.started` 事件 ts（它由 `run.started` 直接派发，上游没有产物核对事件）；T-002 第 1 轮的 `roundStartedAt` ≥ T-001 的 `review.evidence_verified` 事件 ts（同一时刻允许）
And 机检：T-002 第 2 轮的上游是 T-003（`downstreamGate:false`，**不产生** `review.evidence_verified`），改为 `roundStartedAt` ≥ T-003 第 1 轮 `review.rejected`（`result='note'`）事件 ts（同一时刻允许）
And 机检：T-002 的 `startedAt` = 第 1 轮 `node.dispatch` 事件 ts、`endedAt` = 第 2 轮完成时刻（**跨轮累计**，第 2 轮派发不重置 `startedAt`，`src/core/orchestrator.js:980`）
And 机检：终态 `orch status` 的 T-001 行耗时 ≈ `T-001.endedAt - T-001.startedAt`，且 T-001 的 `endedAt` ≤ HO-001 的 `accepted` 事件 ts（**核对通过即定格，等下游的那段不计入**）
And 机检：`node`→`done`、reason=`review.downstream_accepted` 的事件共 3 条（T-001 一次、T-002 两轮各一次）；T-003 的 `done` 事件 reason 是 `verification.passed`，不在这 3 条里
And 节点行不含"耗时 0s"
```

**为什么耗时只能用事件 ts 逐轮核对**：每次派发会把 `node.endedAt` 清回 null、`roundStartedAt` 重置，而 `startedAt` **不重置**（`src/core/orchestrator.js:975-985`），所以终态文件里只有"首次派发 → 最后一次结束"这一个区间；逐轮的边界一律从 `events.jsonl` 的 `ts` / `seq` 取（D-3 / AC-39）。**"等待下游不计入耗时"这一条只对上游节点成立**（它的 `endedAt` 在核对通过时就写完了）；撰写者第 2 轮行上的累计值包含中间审核者与等待时间，这不是缺陷（§2.3 的"耗时口径"、A-2 第 3 段）。

#### AC-36 编码闭环与单节点输出不回归
- **验证面**：混合 ｜ **类型**：回归 ｜ **风险**：高 ｜ **规则**：BR-31、BR-32
```gherkin
Given 我执行 I1.2 的完整测试集（含 code-loop 夹具与 I1.1 单节点测试）
Then 全部通过
Given 用 code-loop-driver 以 --scenario backflow-once --stop-after 3 --keep 停在"开发第 2 轮完成、复测未派发"
When 我执行 orch status --instance INST-001
Then 输出含"节点 T-002 测试 失败（等待复测） · 第 1 轮"
And 输出不含"待校验（等待下游）"
And `single` 的 `orch run` 与 `orch status` 输出与 I1.1 验收样例逐字一致
And `code-loop` 的 I1.2 附录 A-1 / A-2 / A-3 / A-4 输出样例除 D-9 登记的两处断言（`buildHandoff` 键集合、`REASON_LABEL` 条数）外逐字不变（指 `docs/iterations/iteration-2/requirement.md` 的附录，不是本迭代的同名附录）
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
Then `src/core` 与 `src/daemon` **全目录**（含子目录）的所有文件中不出现字符串 'task-loop'、'researcher'、'writer'、'reviewer'、'研究员'、'撰写者'、'审核者'（用 `test/fixtures/purity-check.mjs --forbid` 传 7 词全表扫描，含注释）
And `src/core/orchestrator.js` 的推进入口仍是 `driveGraph` → `finishGraphNode` → `advance` → `planAdvance`
And `task-loop` 与 `code-loop` 的节点状态词取自 `src/core/state-machine.js` 的 `NODE_STATES`，迁移合法性由该表定义（既有直写点保持不变）
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
- **验证面**：真实面 ｜ **类型**：主流程 ｜ **风险**：高（模型行为） ｜ **规则**：BR-06、BR-07、BR-17、BR-18
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
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-38
```gherkin
Given 夹具场景 dispatch-fail-first 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
And 输出的最后三行依次是挂起收尾三行，第一行含"实例 INST-001 · 已挂起 · 模板 通用任务闭环"
When 我执行 orch status --instance INST-001
Then 输出含"原因：派遣失败：目标会话不可用"与"节点 T-001 研究员 已升级"
And 机检：实例 state='suspended'；T-001 state='escalated'；escalations[0].reasonCode='dispatch_failed'
And 机检：counters.dispatchCount=1；sessions 为空（首派会话没建起来）
```

#### AC-43 回合执行失败 → 升级挂起，不回流
- **验证面**：夹具 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-38
```gherkin
Given 夹具场景 execution-fail 已完整跑完
Then 命令在 30 秒内结束，退出码是 4
When 我执行 orch status --instance INST-001
Then 输出含"原因：执行失败："与"节点 T-002 撰写者 已升级"
And 机检：实例 state='suspended'；T-001 state='review'、reviewReason='downstream'；T-002 state='escalated'；escalations[0].reasonCode='execution_failed'
And 机检：HO-001 state='delivered'（T-002 未发出任何回合事件，上游尚未转 done）
And 机检：counters.dispatchCount=2；没有 HO-002，也没有第 3 次派发
```

#### AC-44 任务目录不可写 / 工作区建不出来 → 发起前停住，退出码 3
- **验证面**：用户可见 ｜ **类型**：异常 ｜ **风险**：中 ｜ **规则**：BR-39
```gherkin
Given 全新项目根 A，其中不存在名为 no-such-dir 的目录
When 我执行 orch run --template task-loop --cwd ./no-such-dir --task "写发布说明。产物：release-notes.md"
Then 那一行以"工作目录不可写："开头、以"no-such-dir"结尾（冒号后是 CLI 解析过的**绝对路径**，不是原样的 `./no-such-dir`，见 D-5）；退出码 3
And 机检：`.orch/instances` 不存在或为空目录；`.orch/instances/INST-001` 不存在
Given 另起全新项目根 B，我先 mkdir -p demo-doc 建好任务目录，并确认**根 B 下没有正在运行的核心**（管道按项目根隔离，全新根天然是冷启动；只有在同一根里紧跟着别的场景跑过时，才需要先在该根执行 `orch core stop`）
When 我在 Git Bash 下执行 MAESTRO_FAULT=workspace_init:fail orch run --template task-loop --cwd ./demo-doc --task "写发布说明。产物：release-notes.md"
Then 输出含"无法创建工作区：注入故障（workspace_init:fail）"，退出码 3
And 机检：`.orch/instances` 为空——本次新建的 `.orch/instances/INST-001` 已被删除，不留 `workspace/` 空壳、不写 state.json
And 机检：`.mock/prompts` 不存在或为空（没有发起任何会话）
```

> **第一支为什么不断言完整路径**：`--cwd` 在 CLI 侧就被解析成绝对路径（`src/cli/main.js:221`），路径里含该根的实际位置，逐字断言等于把测试绑死在某个目录上；因此只断言前后缀，中间段允许是任何绝对路径（口径见 D-5 的 `CWD_NOT_WRITABLE` 行）。
>
> **第二支为什么要"没有正在运行的核心"**：`MAESTRO_FAULT` / `MAESTRO_TEST_*` 只在**核心冷启动**时读一次（`src/core/orchestrator.js:253-259`），CLI 的 `orch run` 会直接连上已在跑的热核心（`src/daemon/client.js` 的 `connect({ensure:true})`）。管道按项目根隔离，所以全新的根 B 天然是冷启动；如果这条改在已经起过核心的根里跑，必须先 `orch core stop`，否则注入不生效，这条 AC 会退化成"照常跑完"。§3.3 第 7 条与 AC-30 同一口径。

#### AC-45 停在"待校验（等待下游）"：核心活着能取消，重启后记成已中断且不重复派发
- **验证面**：夹具 ｜ **类型**：恢复 ｜ **风险**：高 ｜ **规则**：BR-27、BR-29、BR-40
```gherkin
Given 全新项目根 A，夹具场景 doc-pass 已用 --stop-after 2 --keep 停在"T-002 核对通过、下游尚未派发"
And 机检：`.mock/stopped-after-2` 存在
And 机检：T-001 state='done'；T-002 state='review'、reviewReason='downstream'；handoffs 只有 HO-001 且 state='consumed'
When 我执行 orch core stop
And 我重新执行一次 orch status --instance INST-001（必要时自动拉起核心）
Then 输出含"实例 INST-001 · 已中断 ｜ 停在节点 待校验 / 会话 等待下游"（停点是真正卡住的 T-002，不是节点表第一条 T-001）
And "实例 INST-001 · 已中断"这一行只出现 1 次（已中断时不再单独重复实例行，编码闭环 C-7 的既有版式）
And 输出含"节点 T-001 研究员 已完成 · 第 1 轮"
And 输出含"节点 T-002 撰写者 待校验（等待下游） · 第 1 轮"，不含"节点 T-002 撰写者 已完成"
And 输出含"会话 等待下游"与"交接包 HO-001  研究员→撰写者  已完成"
And 机检：实例 state='interrupted'；T-002 仍是 'review' 且 reviewReason='downstream'；T-001 仍是 'done'；HO-001 仍是 'consumed'
And 机检：相对停核心之前只多出 1 条 instance 层迁到 'interrupted' 的事件；没有新增 node.dispatch、handoff.created 或 review.evidence_verified
When 我执行 orch cancel --instance INST-001
Then 输出含"实例已结束（已中断），无需取消"，退出码 1
And 机检：这次取消没有改写任何节点、交接包或会话状态

Given 另起全新项目根 B，夹具场景 doc-pass 同样以 --stop-after 2 --keep 停在同一刻（核心**不停**）
When 我执行 orch cancel --instance INST-001
Then 命令在 5 秒内结束，退出码 0
And 机检：实例 state='cancelled'；T-001 state='done'（已完成节点保持）；T-002 state='cancelled'
And 机检：T-002 的 reviewReason 在取消落盘后为 null；HO-001 仍为 'consumed'（已消费的交接包不撤回）
And 机检：T-002 的 endedAt 非空（被派发过的节点取消后一定有耗时，`src/core/orchestrator.js:2502`）
And 机检：sessions 中没有 thinking/tool_running/waiting_input/waiting_dependency
When 我执行 orch status --instance INST-001
Then 输出含"实例 INST-001 · 已取消"与"节点 T-002 撰写者 已取消"，且不再出现交接包等待行
```

> **两支不能共用一个根，顺序也不能反过来**：`orch core stop` 会把非终态实例对账成 `interrupted`（`src/core/orchestrator.js:2684-2698`；任何核心重启另有 `:2665-2682` 的冷启动对账，`coreGeneration` 每次启动都是新值，`src/daemon/server.js:61`），而 `interrupted` ∈ `TERMINAL_INSTANCE`（`state-machine.js:142-147`）。此后的 `orch cancel` 走 `cancel()` 的终态分支，回的是 `CANCEL_NOT_NEEDED` = `实例已结束（已中断），无需取消`（`orchestrator.js:2401-2403`、`src/cli/labels.js:136`，`{state}` 由 `render.js:836` 换成中文），退出码 1——**不是** `INSTANCE_TERMINAL` / `…本迭代不支持重跑`，那条文案只来自 `cancelLive()`（`:2441-2443`）与 `startRun --instance`（`:2305-2306`）。这是 I1.2 的既有口径，本迭代不改，所以"取消面"必须在核心还活着的那一支验。
>
> **停点提示为什么必须改**：`markInterrupted` 选的现场节点是"第一条 `running` 或 `review`"（`:2703`），三节点模板里是 T-002；而 `renderInterruptedNote` 取 `snapshot.node = nodes[0]`（`src/cli/render.js:141`、`:258-263`），在 `task-loop` 下是已完成的 T-001，会打成"停在节点 已完成"。I1.3 的修法见 D-4 / A-2 第 2 段：核心在快照里点名停点节点，渲染层优先读它、读不到时保持 `nodes[0]`（`single` / `code-loop` 的既有快照与 I1.2 测试都不带该字段，零回归，AC-36）。
>
> **`markInterrupted` 会把现场节点的 `note` 覆盖成英文串**（`stopped at node review / session …`，`:2713`），门控限定词不能依赖 `node.note`，必须由 `reviewReason` 显式分支给出（D-4）。

### 3.2 非功能验收标准

| 编号 | 要求 | 怎么验 |
|---|---|---|
| **NFR-01** | 不新增运行时依赖；`package.json` 的 `dependencies` 保持为空 | `npm ls --prod --depth=0` 无新增包 |
| **NFR-02** | 审核读取与版本核对在本机 50ms 内完成（≤ 5MB 文档） | 新增计时用例 `test/wp10/perf.test.js`：对**真实**的 `readReview()` 与 `verifyProducts({sha256:true, baseDir})` 各调用 20 次，用 `performance.now()` 逐次实测（不用注入 `clock`，否则量不到真实耗时），断言排序后第 19 个（p95）≤ 50ms；测试文件由用例自己生成 1MB 与 5MB 两份 |
| **NFR-03** | 每次状态落盘仍是单次 CAS；一次状态变化最多两次落盘（迁移 + 收尾） | 代码审查 + `events.jsonl` 与 `rev` 递增核对 |
| **NFR-04** | `orch status` 在 0.5 秒内返回；`orch run` 启动后 5 秒内出现前三行 | 新增脚本 `test/perf/task-loop-timing.mjs`（`node test/perf/task-loop-timing.mjs --root <根> --scenario doc-pass`）：`doc-pass` 跑完后连续 5 次 `orch status` 逐次记 `Date.now()` 差值并打印，断言最大值 ≤ 500ms；前三行走 AC-01 已有的"10 秒内输出含……"计时（不新建断言） |
| **NFR-05** | 取消在 5 秒内收敛（含审核中的实例） | AC-28 |
| **NFR-06** | Windows 与 Linux 路径一致；不得手拼 `.orch/instances/...` | 架构检查；`paths.js` 唯一计算点 |
| **NFR-07** | 夹具可重复：同一场景连续 5 次结果一致（事件顺序可因调度略有差异，终态与文件内容一致） | 5 次连跑 |
| **NFR-08** | `task-loop` 的状态文件不保存文档正文、不保存绝对路径；只保存引用、字节数与 sha256（`declared` 图的 I1.2 落盘形状含 `artifactRefs[].absPath`，属既有事实，本迭代不删不改，见 M-3 / D-6） | 机检 `task-loop` 的 state.json：除 `cwd` 外无绝对路径、无文档正文；`sha256` 存在 |
| **NFR-09** | 所有新增用户可见文案来自 `labels.js`；事件原因有中文词条 | 架构检查 + AC-39 |
| **NFR-10** | 新增/修改测试文件与附录 D-9 清单一致，全部可在 `node --test "test/**/*.test.js"` 下运行 | CI / 本地全量 |

### 3.3 验收前置条件

1. **环境**：Node.js ≥ 22（ESM），仓库根执行过 `npm link`，`orch` 可用；Windows 使用 Git Bash。所有夹具路径用绝对路径传入 `--root`。
2. **全新根规则**：每条 AC 默认一个空目录；同一 AC 内需要多次运行时明确写"另起全新根"。不得复用上一个场景的 `.orch` 与 `.mock`。
3. **夹具入口**：`node test/fixtures/task-loop-driver.mjs --root <绝对路径> --scenario <场景名> [--keep] [--prepare-only] [--stop-after <n>] [--reset]`；默认任务目录 `<root>/demo-doc`。驱动只写 `<root>/.mock/` 与 `<root>/.orch/hosts/`，实例一律由 `bin/orch.js run` 发起。除 `--prepare-only` 外，驱动**原样透传 `orch run` 的 stdout**，并在其结束后**以同一退出码退出**（0/1/3/4/5，AC-44 的退出码 3 也经此透传；`--task ""` 一类的退出码 2 由 AC 直接敲 `orch` 断言，不经驱动），AC-42 / AC-43 / AC-44 的退出码断言据此判定。
   - `task-loop-driver.mjs` 必须沿用 `test/fixtures/code-loop-driver.mjs:464` 的 `cleanEnv`：注入 `NODE_ENV='test'` 并清掉 `MAESTRO_DSH_EXE` / `MAESTRO_DSH_BIN` / `MAESTRO_DSH_ARGS` 残留。`MAESTRO_TEST_PAUSE` / `MAESTRO_TEST_STOP_AFTER` / `MAESTRO_FAULT` 只在 `isTest`（要求 `NODE_ENV==='test'`）为真时生效，漏掉这一步会**静默空转**，表现为驱动 60 秒超时而不是断言失败。
   - 驱动写宿主配置 `<root>/.orch/hosts/dsh.json`（字段沿用 I1.2：`launch.command = process.execPath`、`launch.args = [<仓库绝对路径>/test/fixtures/mock-acp-agent.js, "--root", <root>, "--suite", "task-loop", "--scenario", <场景名>]`）；`--suite task-loop` **必须**进 `launch.args`，否则 mock 落在 code-loop 分支，产物/审核步不会执行。核心经 `host-config → stdio-transport → acp-client` 拉起，与真实 DSH 同一条链路，不使用内存桩。
   - `--stop-after <n>`：**由核心**在 `dispatchCount` 达到 `n` 的那一步——即第 `n` 步的产出核对通过、落盘之后，推进（派发下游）之前——写 `<root>/.mock/stopped-after-<n>` 并原地等 `<root>/.mock/release`（`src/core/orchestrator.js:2772-2790`，沿用 I1.2 的实现，本迭代不改归属）。驱动侧只做两件事：轮询到 `stopped-after-<n>` 就返回（`test/fixtures/code-loop-driver.mjs:632-643` 同款），以及**不带 `--keep` 时最多 60 秒后写 `.mock/release` 放行**、带 `--keep` 时不写、进程不退出（实例停在中间态）。因此凡是断言中间态的 AC 一律加 `--keep`，并在机检里确认 `.mock/stopped-after-<n>` 存在；验证"放行后继续跑"的 AC 由测试自己写 `.mock/release`。
4. **mock 宿主**：沿用 `test/fixtures/mock-acp-agent.js`，新增 `--suite task-loop`（经宿主 `launch.args` 传入，见上一条）；step 支持 `artifact`（按 prompt 的"写入路径"落盘）、`review`（写 `<任务目录>/out/review.json`）、`reviewDecoy`、`reviewUtimes`、`artifactUtimes`、`mutatePrevious`、`remove`、`delayMs`、`hold`、`hostError`、`sessionNew`。`.mock/prompts/<n>.json` 记录 `{n, nodeId, round, task}`，其中 `task` 是完整提示词原文（沿用 I1.2 字段名，不新增别名）。
5. **step ↔ 节点轮次**：第 1 步 T-001 第 1 轮；第 2 步 T-002 第 1 轮；第 3 步 T-003 第 1 轮；第 4 步 T-002 第 2 轮；第 5 步 T-003 第 2 轮。第 6 步出现即视为实现缺陷。
6. **场景清单**（D-9 给出逐步内容）：`doc-pass`、`doc-backflow-once`、`doc-reject-twice`、`doc-hold-research`、`doc-slow-reviewer`、`review-missing`、`review-stale`、`review-bad-json`、`review-decision-invalid`、`review-artifact-missing`、`review-artifact-mismatch`、`review-reject-no-defects`、`review-pass-with-defects`、`review-defect-shape`、`review-evidence-unreadable`、`review-evidence-outside`、`doc-missing`、`doc-empty`、`doc-stale`、`doc-previous-modified`、`doc-previous-missing`、`research-missing`、`research-empty`、`research-stale`、`dispatch-fail-first`、`dispatch-fail-backflow`、`execution-fail`、`review-says-pass`、`review-says-reject`。
7. **暂停/故障注入**：沿用 I1.2 的 `MAESTRO_TEST_PAUSE=after_accepted[:<nodeId>]`、`after_output[:<nodeId>]`、`after_verdict[:<nodeId>]`；`MAESTRO_FAULT=state_write:escalation`；**新增 `MAESTRO_FAULT=workspace_init:fail`**（只对 `task-loop` 的实例工作区创建生效：`fs.mkdir(workspace/artifacts/{docs,reports})` 那一步抛错，核心随后删除本次新建的实例目录并返回 `WORKSPACE_INIT_FAILED`）；`MAESTRO_TEST_STOP_AFTER=<n>`。核心冷启动时读取这些变量。凡使用 `--stop-after <n>` 的 AC，都必须机检 `.mock/stopped-after-<n>` 存在，证明停在预期中间态而不是跑到终态。
8. **审核样本**：AC 中出现的 `out/review.json` 内容必须是合法 JSON（`review-bad-json` 除外），字段与 §2.7 一致。
9. **真实面**：真实 DSH 的模型、网络与配额由环境提供；AC-40 的"第 1 轮故意不写回滚方案"依赖模型按任务话术执行，允许按 AC 写明重试；夹具面必须独立通过，不得用真实面替代。
10. **测试命令**：`node --test "test/**/*.test.js"` 为全量入口（本机 Node v22.22.2 / Windows 下直接传目录会报 `Cannot find module`，不用这种写法）；I1.2 既有测试除 D-9 登记的两处断言（`buildHandoff` 键集合、`REASON_LABEL` 条数）外逐字不变、全部保留并通过（AC-36）。

---

## 附录 A 输出基线（**唯一**，AC-02 / AC-03 / AC-04 / AC-06 / AC-07 / AC-09 / AC-10 / AC-13 ~ AC-21 的判定依据）

> 字段之间一律单空格，不做列对齐；`<d>` 是 `3s` / `1m12s` 这类时长（亚秒正值至少显示 `1s`；已派发节点若 `startedAt` 与 `endedAt` 同毫秒，渲染钳到 `1s`——钳在渲染层，`formatDuration` 的既有行为不改，见 A-2 第 3 段的耗时规则）；时间戳一律本地时区 `HH:mm:ss`。本文的"输出含"只按逐字片段匹配，不要求整行相等。

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

- 运行期间**只**流式打印会话行；节点行、交接包行只在 `run.wait` 返回后打印一次（I1.2 附录 B-19）。
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

**第 2 段（已中断提示）在 `task-loop` 下的停点**：`<状态>` 只有状态词，不带限定词、不带节点号与角色名。**它必须是真正卡住的那个节点**——核心侧的现场节点选取是"第一条 `running` 或 `review` 的节点"（`src/core/orchestrator.js:2703`），三节点模板里停在等待下游时是 T-002；而渲染层现在读的是 `snapshot.node = nodes[0]`（`src/cli/render.js:141` + `:258-263`），会打成 `停在节点 已完成`。I1.3 的修法：`snapshotOf()` 按与 `markInterrupted` 相同的选取规则派生一个**只读快照字段** `interruptedNodeId`（不落 `state.json`，`schemaVersion` 仍为 2，见 D-6），`renderInterruptedNote()` 优先按它取节点，**取不到时回落 `snapshot.node`**——`single` 与 `code-loop` 的既有快照都不带这个字段，`test/wp6/render.test.js:20-28` 与 `test/wp9/render-fixes.test.js:172-192` 传的都是裸 `node`，回落分支保证零回归（AC-36）。节点表、会话行、交接包行在已中断下照常打印，只是不重复实例行（编码闭环 C-7）。

**第 3 段规则**

- **限定词**（`reviewReason` 限定词只对图节点 `downstreamGate: true` 生效，见 M-8 / D-3；无门控的图该字段恒为 `null`，`review` 渲染为裸 `待校验`，与 I1.2 一致 — B-10）：
  - `downstreamGate` 节点 + `review` + `'evidence'` → `待校验（核对证据）`；`review` + `'downstream'` → `待校验（等待下游）`；
  - 无门控节点 + `review` → `待校验`（不带限定词）；
  - `failed` + `note='等待复审'` → `（等待复审）`；`escalated` 不带限定词；`failed` 且无 `等待复审` 标记时（仅 `code-loop`）→ `（等待复测）`；
  - **`halted` 优先**：升级未记录时限定词槽只放 `（升级未记录）`，**不再叠加** `reviewReason` 或 `等待复审` 限定词。`markHalted` 只写 `halted` 标记，**不改节点状态**（升级事务里那次 `node.state='escalated'` 随写失败一起回滚），所以状态词是**升级前的那一个**：审核无效 / 超上限时节点停在 `review`，显示 `待校验（升级未记录）`（§2.6 与 AC-30 的样例就是这个），不会显示 `已升级`，也不会显示 `失败（等待复审）（升级未记录）`（见 A-3）。
  - **判定顺序固定**（`nodeQualifier()`，`src/cli/render.js:364-376`）：`single` / `escalated` 先短路返回 `null`（现有两行）→ `halted` → `state==='review'` 按 `reviewReason`（仅 `downstreamGate`）→ `state==='failed'` 且 `note==='等待复审'` → 其余 `failed` 兜底 `（等待复测）`。新增分支**必须排在 `halted` 之后**：现有代码把 `node.qualifier ?? node.note` 的查表放在 `halted` 判定**之前**（`:368-373`），直接复用那条查表会让带 `note` 的停止推进实例丢掉 `（升级未记录）`。
  - **不要把中文当表键**：`NODE_QUALIFIER` 的键是机器码（`waiting_retest` / `escalation_unrecorded`，`src/cli/labels.js:90-93`），而 `node.note` 存的是中文原文（`'等待复测'` 由 `src/core/orchestrator.js:1593` 写入，本迭代的 `'等待复审'` 同形）——`:369` 的 `hasOwnProperty(NODE_QUALIFIER, note)` 因此**命不中**，`失败（等待复测）` 实际靠 `:374` 的状态兜底渲染。I1.3 追加 `NODE_QUALIFIER.waiting_review = '等待复审'`，并由上面那条 `note==='等待复审'` 的显式分支取值；不要为了走 `:369` 而加一个中文键。
  - **`task-loop` 走不到 `:374` 的兜底**：通用任务闭环里 `failed` 只有一个来源——审核驳回且未超上限，核心必定同时写 `note='等待复审'`（D-3 / D-6）；超上限走升级、无产物走 `escalated`，都不留"裸 `failed`"。所以 `（等待复测）` 那条兜底在 `task-loop` 下**不可达**，AC-07 断言三行节点里都不出现"等待复测"。
- **轮次**：只在 `round > 0` 时出现；未派发节点只有状态。
- **耗时**：区间口径沿用 I1.2 —— **`startedAt`（首次派发时刻，重新打开一轮时不重置，`src/core/orchestrator.js:980`）→ `endedAt`**，即多轮节点的耗时是**累计**值，`roundStartedAt` 只用于"本轮新写"判定，不参与渲染。出现条件：`done` / `cancelled` 且 `startedAt` 与 `endedAt` 都有效（`src/cli/render.js:416-419` 现有判断）；`review(downstream)` 也算已离开执行态（M-8 在核对通过时写 `endedAt`，因此"等下游"那段不计入）；`review(evidence)` **不显示**（此时核对未结束，`endedAt` 尚未写入）；`task-loop` 的 `failed` + `note='等待复审'` 也显示（D-3 在驳回时写 `endedAt`）；`escalated` 不显示（即使 `endedAt` 有值，渲染层也按状态抑制）；`code-loop` 的 `failed（等待复测）` 沿用 I1.2，不显示耗时。**渲染层不因本迭代改变区间来源**（改成就本轮区间会让 `code-loop` 的既有样例变化，AC-36 直接挂）。**同毫秒钳到 `1s`**：已派发节点若 `startedAt` 与 `endedAt` 同毫秒，渲染时把该区间钳到 `1s`（`formatDuration(0)` 本身仍返回 `0s`，所以钳在渲染层、不改 `formatDuration` 的既有行为，避免 `single` / `code-loop` 回归）；据此 AC-35 的"节点行不含耗时 0s"保持成立。
- **后缀**（互斥，最多一个）：**以下后缀与上面「耗时」里新增的 `review(downstream)` / `failed`+`等待复审` 两支只在 `productPolicy==='doc-single'` 渲染**；`single` / `code-loop` 逐字不变（M-9 / AC-36）。
  - `done` 且本轮有 `artifactRefs[0].ref` → `· 产物 <ref>`；
  - `done` 且 `review.decision='pass'` → `· 审核 通过`；
  - `failed` 且 `review.decision='reject'` → `· 审核 驳回 · 缺陷 <n> 条`（`n=review.defectCount`）；
  - `review`（无论 `evidence` 还是 `downstream`）与 `escalated` 不带后缀。
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

**第 4 段在两个面上不一样**（重要）：`orch status` 只打状态词本身——上游已交产出、正在等下游时是 `会话 等待下游`，**不带**"· 产出已提交"。`· 产出已提交` 只出现在 `orch run` 的流式会话行（`src/cli/main.js:272` 的 `printSnapshot` 在会话为 `waiting_dependency` 时改用 `renderSessionSubmitted`；`src/cli/main.js:461` 的 `status` 走 `renderSessionLine`，不加后缀），条件是**会话状态**，与节点处于 `review` 的哪个子原因无关，也不是"核对通过"之后才加。下游开始后会话行切换到下游的会话。

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

挂起（退出码 4），以三行收尾（之前已有发起时的实例/会话/任务三行）：

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
| **工作区** | `<项目根>/.orch/instances/<实例号>/workspace/`；项目根是我执行 `orch` 命令时所在的目录（不是 `--cwd` 的任务目录），文档与证据路径都相对工作区 |

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
| v2 | 2026-11-05 | 评审修复（4 轮）：**M-8 / D-3 / A-2** 把 `reviewReason='evidence'` 的写入点提到"核对之前"的那次落盘，`待校验（核对证据）` 才真正可观测，且限定词只对 `downstreamGate` 节点生效（无门控图仍是裸 `待校验`，B-10 / AC-36 不变）；A-2 补 `halted` 限定词优先（只显"升级未记录"，不叠加）；§3.1 补 `<d>` 通配规则与"输出归属"两条约定，AC-23 改成逐字五行；M-9 / D-4 / D-5 把 `WORKSPACE_INIT_FAILED` 归入 `PREFLIGHT_CODES`（退出码 3）；§2.2 拦截表由四种补成六种；新增 **BR-39 / BR-40** 与 **AC-44**（目录不可写、工作区建不出来）、**AC-45**（停在"等待下游"时重启与取消）；§2.3 补"执行中来自送达、已接受来自首个回合事件"的中间窗口说明；§2.8 补重启口径与"已完成的交接包不撤回"；D-9 `doc-pass` 的交接包数改为 2 张；R-6 登记 sha256 提前自 I1.12 |
| v3 | 2026-11-05 | 第 5 轮评审修复（Part 2 / Part 3 各一轮干净评审）：**会话行 `· 产出已提交` 统一为"只属 `orch run` 流式面"**（BR-26 / §2.3 / §2.9 / A-2 第 4 段 / D-1 的 `main.js` 行同一个口径，`orch status` 恒为裸 `会话 等待下游`），并按磁盘事实把"刚派发"三元组改成 `节点 执行中 / 会话 空闲 / 已投递`；`review` 对象形状以 D-6 为唯一定义、D-7 返回值补 `defectCount`、`reviewPath` 不再写死；`expectedArtifact` 的取值源改为**派发给审核者的交接包 `artifactRefs.input[0]`**（forward/retest 边的 `output` 恒为 `null`），修正 D-3 / D-8；`artifactRefs` 落盘投影**按 `productPolicy` 分流**（`declared` 保持 I1.2 六字段 spread，含 `absPath`；只有 `doc-single` 投成 `{ref,bytes,sha256,verifiedAt}`），`verifyProducts()` 返回只追加 `sha256`，M-3 / M-6 / D-1 / D-3 / D-6 / D-8 / D-9 / NFR-08 同步；AC-35 的跨轮时间断言改用 `events.jsonl` 的 `ts`（`node.endedAt` 每次派发被清空）；AC-44 第二支补"新根 + 核心未热"前置（`MAESTRO_FAULT` 只在冷启动读一次）；AC-45 拆成两根（`core stop` 会把实例对账成终态 `interrupted`，之后不能 cancel）；D-5 新增"两种带变量文案的机制"红线（`ERROR_TEMPLATE` 只能用 `render.js:831` 白名单名，故 `{value}`→`{name}`；`REVIEW_TEXT`/`ARTIFACT_TEXT` 由核心拼接，条目本身不含占位符）；A-2 第 3 段固定限定词判定顺序并说明 `NODE_QUALIFIER` 的键是机器码、中文 `note` 查不中；M-1 的 `TEMPLATE_LABEL`/`ROLE_LABEL` 归属改回 `src/cli/labels.js`；§3.3 第 3 条把 `.mock/stopped-after-<n>` 的写入方归回核心；NFR-02 / NFR-04 给出可机检的计时落点（`test/wp10/perf.test.js`、`test/perf/task-loop-timing.mjs`）；另修正 §2.8 取消后的耗时口径、AC-08 的缺陷行逐字断言、AC-13 干扰文件归属、AC-36 的附录编号归属、D-9 示例 review 形状 |
| v4 | 2026-11-06 | 第 6 轮评审修复（Part 2 / Part 3 各一轮干净评审）：**重启口径按磁盘事实改判**——`reconcileOnBoot`（`orchestrator.js:2665-2682`）与 `interruptAll`（`:2684-2698`）在核心重启时把未终态实例记成终态 `interrupted`，§2.8 重启段、BR-29、BR-40、C-14、D-10 同步（节点 / 会话 / 交接包现场保留，不补判、不重派发；`suspended` 才是不被改写的那一支）；**AC-45 第 1 支重写**为"停核心 → `已中断` → 节点表仍显示 T-002 `待校验（等待下游）` → 再 cancel 被拒"，并修正终态取消的文案与来源码：`cancel()` 走 `CANCEL_NOT_NEEDED` = `实例已结束（已中断），无需取消`、退出码 1（`:2401-2403`、`labels.js:136`），**不是** `INSTANCE_TERMINAL`（那条只来自 `cancelLive()` `:2441-2443` 与 `startRun --instance` `:2305-2306`）；**新增"已中断停点提示必须点名真正卡住的节点"**（`markInterrupted` `:2703` 选第一条 `running`/`review`，`renderInterruptedNote` 现在读 `nodes[0]`，三节点下会打成"停在节点 已完成"）：A-2 第 2 段 + D-6 的只读快照字段 `interruptedNodeId` + D-1 的 `render.js` / `orchestrator.js` 行 + D-9 的"两条既有用例不改断言"；§2.8 取消段改为"派发过的节点取消后一律有耗时"（`applyCancel` `:2502` 在任何 `startedAt` 上写 `endedAt`，与 `review` 子原因无关），并去掉第二部分里的字段名；等待窗口起点改为**产出提交**（`:1393-1410` 早于 `running → review`），§2.3 / §2.9 第 3 步 / C-11 同步；AC-34 的 `consumedAt` 改与"消费它那一轮的 `node.dispatch` 事件 ts"比较并补说明（`roundStartedAt` 每次派发重置，HO-002 对终态 T-003 会假阳性）；AC-35 删掉"T-003 也有 `review.downstream_accepted`"这条不可能的断言（terminal 无门控，`done` 的 reason 是 `verification.passed`），`review.evidence_verified` 的逐轮比较限定在门控节点；AC-05 的 T-003 行改为区分 `result='applied'` 迁移事件与 `result='note'` 结论事件；AC-44 与 D-5 的 `CWD_NOT_WRITABLE` 改为**绝对路径**口径（`main.js:221` 先 `path.resolve`），断言改成前后缀；AC-01 的 `sess-xxx` 改成 `^会话已创建 \S+$` 的行匹配（真实 id 是 `mock-sess-<pid>-<n>`，`mock-acp-agent.js:340-343`）；§2.2 补 I1.2 五条既有发起拦截不受影响、§2.6 升级块改为"四行 + 可选缺陷行"、§2.3 会话行指回 A-2 六分支、A-2 补"`（等待复测）` 兜底在 `task-loop` 不可达"并由 AC-07 断言、BR-36 覆盖补 AC-02、D-6 / D-10 明确取消时清 `reviewReason` |
| v5 | 2026-11-06 | 第 7 轮**自洽性复核**修复（**5 处阻断 + 10 处重要 + 5 处次要**，未新增/删除 AC，编号范围不变）：**P0** ① AC-35 拆成两条机检——T-001 第 1 轮对 `run.started`、T-002 第 1 轮对 T-001 的 `review.evidence_verified`；T-002 第 2 轮的上游 T-003 无门控、不产生该事件，改与 T-003 第 1 轮 `review.rejected`（`result='note'`）比较，去掉不可构造的"每一轮都比"；② D-9 补登 `test/templates/fake-graph.test.js`（`:214-229` 的 `buildHandoff` 键集合追加两键，其余 14 键不变），AC-36 与 §3.3#10 改为"除 D-9 登记的两处断言（`buildHandoff` 键集合、`REASON_LABEL` 条数）外逐字不变"；③ D-6 按边表改为四行、逐列写明取值来源（forward/retest 的 `input` 取源节点 `artifactRefs[0].ref`；backflow 的 `input`/`previous` 取目标轮次 n−1、`output` 取 n；`productsOf()` 在 `doc-single` 下不得回退到任务 `产物：` 行），D-1 的 `buildHandoff` 行同步指向该表；④ D-1 的 `promptFor` 改为"新增 `research`/`write`/`review` 三键由 `node.prompt` 分派，`single`/`forward`/`verify` 与 `edge.kind` 的 `backflow`/`retest` 分支逐字保留"；⑤ 审核提示词新增 `工作区：<绝对路径>`（同款 `toPosix`），D-9 的 `reviewDecoy` 改为从该行取路径。**P1** ⑥ D-3 补 `consumeHandoff(ctx,'handoff.consumed')`（先于 `saveLive`）；⑦ AC-20 改为"handoffs 恰好 3 条、backflow 恰好 1 条、无 HO-004"；⑧ D-9 的 `labels.test.js` 行补 `REASON_LABEL` 33 → 39；⑨ §3.3#3 要求 `task-loop-driver.mjs` 沿用 `cleanEnv` 注入 `NODE_ENV='test'`；⑩ A-2 的后缀与新增耗时两支加 `productPolicy==='doc-single'` 门控；⑪ 升级落盘同时清 `node.reviewReason`（D-3 失败路径 / D-6）；⑫ D-8 的 `sha256` 关闭时不产生该键；⑬ D-8 的产物名校验不得复用 `extractProductLines`（取原文 token、5 项规则、原样回显）；⑭ §2.8 / C-14 / BR-29 的"现场不被改写"改为"状态字段不被改写，`note` 会被写成停点说明"；⑮ C-09 补"源节点 `review → done` 不得走 `transit()`，手工 emit `result='applied'` 由该帧 `saveLive` 落盘"。**P2** ⑯ D-6 的 `artifactRefs` 形状补 `verifiedAt`、D-5 的常量名改为沿用 `ESC_TEXT.roundsPrefix`（`orchestrator.js:78`）、A-1 的 `B-19` 标注为 I1.2 附录、AC-13 括注改为"D-9 的 `reviewDecoy` 项"；⑰ AC-38 改为 `src/core` + `src/daemon` 全目录 7 词扫描、状态词取自 `NODE_STATES`；⑱ `review.downstream_accepted` 的 detail 补 `round`，AC-05 按 `detail.round` 配对、seq 仅作交叉验证；⑲ §3.3#10 与 NFR-10 的测试命令改为 `node --test "test/**/*.test.js"`；⑳ 统一 `0s` 口径——已派发节点若 `startedAt` 与 `endedAt` 同毫秒，渲染层钳到 `1s`（不改 `formatDuration(0)='0s'` 的既有行为），AC-35 的"不含耗时 0s"因此仍成立 |

---

## 附录 D 实现约束（非用户可见，供实现与任务拆分使用）

### D-1 架构与引擎复用

**新增/修改模块**

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/core/review.js` | 新增 | `out/review.json` 的读取、11 步校验、原因码与逐字原因（D-7） |
| `src/core/doc-artifact.js` | 新增 | 产物名解析、工作区引用、版本引用、上一版完整性、`sha256` |
| `src/core/verify-artifact.js` | 修改 | `verifyProducts()` 追加 `baseDir` / `sha256`；返回元素**只追加** `sha256`，I1.2 的六字段不改不删；`doc-single` 的调用方落盘前投影掉 `absPath` / `exists` / `mtime`，`declared` 的调用方沿用现有 spread |
| `src/core/orchestrator.js` | 修改 | `finishReviewNode()`、下游门控、`review.read` 等事件、`consumeHandoff()` 投影、`latestEndedNodeId()` 纳入 `review(downstream)`；`hasSubmittedOutput()` 改用 `resolveNodeProducts()` / `readReview()`；`finishArtifactNode()` 落盘前投影 `artifactRefs`；`startRun` 按 `productPolicy` 校验产物行并建工作区、写 `state.artifactStem`；`snapshotOf()`（`:2605`）派生只读字段 `interruptedNodeId`（选取规则与 `markInterrupted` `:2703` 一致：第一条 `running`/`review`，否则 `null`），**不写进 `state.json`**（D-6 / A-2 第 2 段） |
| `src/core/advance.js` | 修改 | `latestNodeId()` 纳入 `review(downstream)`；`classifyNodeOutcome()` 把 `review(downstream)` 归 `passed`，并按 `node.review.decision` 映射审核节点的 `pass/fail`；`planAdvance()` 的 `verdict-fail` 分支从 `node.review.defects` / `revisionRequirement` 取值；`buildHandoff()` 带 `artifactRefs` / `revisionRequirement`，三列取值来源见 D-6 按边表（`forward` / `retest` 的 `input` 取**源节点** `artifactRefs[0].ref`；`backflow` 的 `input` 与 `previous` 取**目标轮次 n−1**、`output` 取 n） |
| `src/core/graph.js` | 只读复用 | 不新增边类型；`edgeFor()` 的 `passed → forward/retest` 已够用 |
| `src/core/state-machine.js` | 不改 | 现有 node 表已包含本迭代全部迁移（D-2） |
| `src/core/escalation.js` | 不改 | 复用一次 CAS 的升级事务 |
| `src/persistence/paths.js` | 修改 | 新增 `instanceWorkspaceDir()`、`instanceDocsDir()`、`instanceReportsDir()` |
| `src/templates/index.js` | 修改 | 新增三角色、`task-loop` 图、四个提示词、`REVIEW_REQUIREMENT`；`promptFor({node, task, artifactStem, round, defects, revisionRequirement})` 新增 `research` / `write` / `review` 三个键由 `node.prompt` 分派；既有的 `single` / `forward` / `verify` 与按 `handoff.edge.kind` 选 `backflow` / `retest` 的分支**逐字保留**（`templates/index.js:221-237`），`write` 再按 `round === 1` / `round > 1` 细分；`stem` 取 `state.artifactStem`、`round` 取本轮已 +1 的值，并注入 `写入路径`（`toPosix` 归一化）；仍是**唯一**允许出现模板名/角色名/提示词字面量的产品目录 |
| `src/cli/labels.js` | 修改 | 新增模板/角色/限定词/后缀/错误码/审核文案/事件原因（D-4 / D-5） |
| `src/cli/render.js` | 修改 | `task-loop` 的节点限定词（按 A-2 第 3 段固定顺序：短路 → `halted` → `reviewReason` → `note==='等待复审'` → `failed` 兜底"等待复测"；新增分支排在现有 `:368-373` 的 hint 查表与 `halted` 判定之间，不得让带 `note` 的停止推进实例丢掉"升级未记录"）、产物/审核后缀、`done` / `review(downstream)` / `failed（等待复审）` 的耗时（`escalated` 一律不显示）、回流的"修改要求"明细、`renderInterruptedNote()`（`:258-263`）的停点节点优先读 `snapshot.interruptedNodeId`、缺失时保持现有 `snapshot.node` / `nodes[0]` 行为（`test/wp6/render.test.js:20-28` 与 `test/wp9/render-fixes.test.js:172-192` 都只传裸 `node`，走回落分支，逐字不变）。`PLACEHOLDERS`（`:831`）**不扩项** |
| `src/cli/main.js` | 修改 | `orch run` 的挂起/停止推进收尾（退出码 4/5）、`task-loop` 的节点行、`--cwd` 仍为必填（AC 命令必须带）。第 4 段**不新增后缀逻辑**：`orch run` 的流式快照在最后一个会话为 `waiting_dependency` 时走 `renderSessionSubmitted()`，输出 `会话 等待下游 · 产出已提交`（现有逻辑，`src/cli/main.js:272`）；`orch status` 仍走 `renderSessionLine`（`src/cli/main.js:461`），只输出 `会话 等待下游`（BR-26 / AC-04） |

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
  └─ expectedArtifact = 派发给审核者的那张交接包 .artifactRefs.input[0]   // forward/retest 边的 input 就是本轮 v<n>；该边的 output 恒为 null（D-6 按边表）；缺省回退上游节点 artifactRefs[0].ref
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

1. **核对之前**（`finishGraphNode` 的回合结束段，现有实现先落 `review` 再 `saveLive`，最后才 `pauseFor('after_output')`）：
   - 会话 `→ waiting_dependency`、节点 `running → review`（reason `output.submitted`）；
   - **仅当 `def.downstreamGate === true`** 时同时写 `node.reviewReason='evidence'`；无门控的图**不写**（保持 `null`，B-10），因此在 `after_output` 暂停点渲染出的仍是 I1.2 的裸 `待校验`；
   - 这次 `saveLive` 必须**先于**核对，所以 `待校验（核对证据）` 是可观测的（AC-04 根 A 的暂停点就落在这里）；
   - 核对之后（`finishArtifactNode` 成功分支）：
   - 写 `node.artifactRefs`：`productPolicy==='doc-single'` 时投影为 `[{ref, bytes, sha256, verifiedAt}]`（不带 `absPath` / `exists` / `mtime`）；`declared` 图（`single` / `code-loop`）逐字沿用现有 spread，字段与形状不变（AC-31 / AC-36）；
   - 追加 `artifactHistory[]`：`{round: node.round, ref, sha256, bytes, verifiedAt}`；
   - 若 `def.downstreamGate === true`：`reviewReason` 由 `'evidence'` 改为 `'downstream'`（**不发迁移事件**，状态仍是 `review`），另发 `review.evidence_verified`（`result:'note'`），写 `node.endedAt`；会话保持 `waiting_dependency`；
   - 若无门控：`review → done`（reason `verification.passed`），与 I1.2 一致；
   - 调 `consumeHandoff(ctx,'handoff.consumed')`（与 I1.2 同位置，**先于** `saveLive`），否则 AC-02 / AC-03 / AC-06 的"核对通过即消费"都会漏；
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

**审核节点的推进映射（`finishReviewNode` → `advance`）**

| 审核结果 | 节点落点 | 推进层读取 | 结果 |
|---|---|---|---|
| 合法 `pass` | `done` + `node.review.decision='pass'` | `classifyNodeOutcome` → `passed` | 终态完成（T-003 是 terminal） |
| 合法 `reject`、`round < maxRounds` | `failed` + `node.review.decision='reject'` + `note='等待复审'` | `classifyNodeOutcome` → `verdict-fail`；`planAdvance` 用 `node.review.defects` / `node.review.revisionRequirement` 构造回流 | `backflow` 到 T-002 |
| 合法 `reject`、`round === maxRounds` | `escalated` | `classifyNodeOutcome` → `escalated` | `rounds_exceeded` 升级 |
| 无效审核 | `escalated` | `classifyNodeOutcome` → `escalated` | 按 reasonCode 升级 |

> `planAdvance` 的 `verdict-fail` 分支保持原签名，`verdict` 参数允许为空：缺陷优先取 `verdict.defects`，为空时取 `node.review.defects`；修改要求同理。这样 `code-loop` 的 `out/verdict.json` 路径零改动。
> `reject` 落 `failed` 时同时写 `node.endedAt`（节点行要显示本轮耗时）；`escalated` 不保证 `endedAt` 为空（`escalation.js` 现有实现会写），但 A-2 规定升级节点一律不显示耗时，渲染层按状态抑制。

**两个同名逻辑必须同步**

| 文件 | 函数 | 改动 |
|---|---|---|
| `src/core/orchestrator.js` | `latestEndedNodeId(state)` | 纳入 `state==='review' && reviewReason==='downstream'` |
| `src/core/advance.js` | `latestNodeId(nodes)` | 同上 |
| `src/core/advance.js` | `classifyNodeOutcome()` | `review` + `downstream` → `'passed'`；其他 `review` 仍 `'error'`；`failed` 的审核节点按 `node.review.decision` 映射 `pass/fail` |
| `src/core/advance.js` | `planAdvance()` | `verdict-fail` 分支在 `verdict` 为空时取 `node.review.defects` / `node.review.revisionRequirement` |
| `src/core/advance.js` | `buildHandoff()` | 追加 `artifactRefs` / `revisionRequirement` |
| `src/core/orchestrator.js` | `handoffToState()` | 仅在源对象**确实带字段**时投影 `artifactRefs` / `revisionRequirement`（与 `edge/defects/note` 同规则） |
| `src/core/orchestrator.js` | `consumeHandoff()` | 显式重组快照的那一处必须把 `artifactRefs` / `revisionRequirement` 一起传入，否则 `accepted → consumed` 会抹掉 |
| `src/core/orchestrator.js` | `dispatchInState()` | `isNodeBusyState()` 已含 `review`；`review(downstream)` 同样拒绝重复投递（AC-41） |

**失败路径**

- 上游产物核对失败：不进入门控，直接升级（`review → escalated`），下游不派发。
- 下游派发失败：按 D-2 的 `pending/done/failed → escalated` 处理，升级挂在**接收派发的目标节点**上；源节点保持 `review(downstream)`（不假装完成）。
- 审核节点没有 `downstreamGate`：合法 pass 直接 `done`，合法 reject 未超限直接 `failed`。
- **升级落盘时同时把 `node.reviewReason = null`**（与 `applyCancel` 同处），维持"该字段只在 `state==='review'` 时非空"的不变式：`rounds_exceeded`、`review_*`、`artifact_*` 各支升级都要做，否则 `escalated` 节点上会残留 `'evidence'` / `'downstream'`。

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
| 边 | `T-001→T-002 forward`、`T-002→T-003 forward`、`T-003→T-002 backflow`、`T-002→T-003 retest` | 四边，不新增 kind。节点上的 `wakeFrom` 沿用 I1.2 写法仅作声明——**引擎不读取它**（`src/templates/index.js:93/118/130` 之外没有任何消费点），回流/复测的分支实际由 `edge.kind` 决定，任何行为都不得依赖 `wakeFrom` |
| `NODE_QUALIFIER` | `evidence_check:'核对证据'`、`waiting_downstream:'等待下游'`、`waiting_review:'等待复审'`、`waiting_retest:'等待复测'`、`escalation_unrecorded:'升级未记录'` | 前两项由 `reviewReason` 推导；`waiting_review` 由**显式分支**读 `node.note === '等待复审'` 后取 `NODE_QUALIFIER.waiting_review`——`node.note` 存的是中文原文，**不是表键**，`:369` 的查表命不中它（见 A-2 第 3 段的判定顺序） |
| 节点后缀 | `· 产物 <ref>`、`· 审核 通过`、`· 审核 驳回 · 缺陷 <n> 条` | 互斥；见 A-2 第 3 段 |
| 路径 | `WORKSPACE='workspace'`、`ARTIFACTS='artifacts'`、`DOCS='artifacts/docs'`、`REPORTS='artifacts/reports'`、`REVIEW_PATH='out/review.json'`、`RESEARCH_REF='artifacts/reports/research-notes.v1.md'` | 唯一计算点：`paths.js` / `doc-artifact.js` |
| 事件 | `review.read`、`review.passed`、`review.rejected`、`review.invalid`、`review.downstream_accepted`、`review.evidence_verified`、`handoff.created`、`handoff.delivered`、`handoff.consumed`、`backflow.constructed`、`rounds.exceeded`、`escalation.created`、`node.dispatch`、`run.started` | 全部需中文词条（D-5） |
| 错误码 | `PRODUCT_LINE_MISSING_TASK_LOOP`、`PRODUCT_INVALID_TASK_LOOP`（退出码 1）；`WORKSPACE_INIT_FAILED`（加入 `PREFLIGHT_CODES`，退出码 3）；沿用 `CWD_NOT_WRITABLE`（已是 preflight，退出码 3） | 见 D-5 与 AC-44 |
| 审核原因码 | `review_missing`、`review_stale`、`review_invalid`、`review_artifact_missing`、`review_artifact_mismatch`、`review_pass_with_defects`、`review_reject_no_defects`、`review_defect_shape`、`review_evidence_unreadable`、`rounds_exceeded` | 写入升级 `reasonCode` |
| 产物原因码 | `artifact_missing`、`artifact_empty`、`artifact_stale`、`artifact_previous_missing`、`artifact_previous_modified`、`execution_failed`、`dispatch_failed` | 同上 |
| 退出码 | `0` 成功 / `1` 业务错误 / `2` 用法 / `3` 连接或内部 / `4` 挂起 / `5` 停止推进 | 与 I1.2 一致 |

### D-5 文案与错误码逐字表（新增文案以 `labels.js` 为唯一来源）

> **两种"带变量的文案"机制不能混（实现时最容易踩）**
> 1. `ERROR_TEMPLATE` 家族（`PRODUCT_*` / `WORKSPACE_INIT_FAILED` / 沿用 I1.2 的 `CWD_NOT_WRITABLE` 等）由 CLI 侧 `applyPlaceholders()` 填充，**只能用 `src/cli/render.js:831` 白名单里的名字**：`cause / path / step / raw / reason / state / name / instanceId / i / summary / evidence / text`。本迭代**不扩白名单**（改它等于动 `single` / `code-loop` 的渲染面，AC-36 会挂）：非法产物名用既有的 `{name}`，工作区失败用既有的 `{cause}`。
> 2. `REVIEW_TEXT` / `ARTIFACT_TEXT` 家族与 I1.2 的 `VERDICT_TEXT` 同构：条目**本身不含占位符**（见 `src/cli/labels.js:190-199`，`evidenceUnreadable` 就是裸的 `缺陷证据不可解析`），变量段由核心用 JS 模板字面量拼在条目之后（`src/core/verdict.js:23` 的 `${prefix}${text}` 同一形状）。本表里写 `…{artifact}` / `…{ref}` 只是**标注**"这一行末尾会接变量"，不是 `applyPlaceholders` 的语法，也不要因为这些名字不在白名单里就改成别的措辞。

| 键 | 逐字原文 | 用于哪条 AC |
|---|---|---|
| `PRODUCT_LINE_MISSING_TASK_LOOP` | `通用任务闭环需要在任务里写「产物：<文件名>.md」一行（全角冒号，例如 产物：release-notes.md）`。**`<文件名>` 是文案里的逐字尖括号**（编码闭环的同族文案也这样写：`src/cli/labels.js:130` 的 `「产物：<路径>」`），不是通配段，AC-22 按整行逐字断言 | AC-22 |
| `PRODUCT_INVALID_TASK_LOOP` | `通用任务闭环的产物名不合法：{name}（只写文件名，.md 结尾，不带目录与版本号）` | AC-23 |
| `WORKSPACE_INIT_FAILED` | `无法创建工作区：{cause}`；`{cause}` 由核心写入，真实失败时为 `fs` 错误的 `message` 首行，注入故障时逐字为 `注入故障（workspace_init:fail）` | AC-44（M-9）；退出码 3（`PREFLIGHT_CODES`） |
| `CWD_NOT_WRITABLE`（沿用 I1.2） | `工作目录不可写：{path}`。**`{path}` 两分支都是绝对路径**：CLI 在 `run.start` 前已把 `--cwd` 按当前 shell 目录 `path.resolve` 成绝对路径（`src/cli/main.js:221`），核心只是把它原样回传——目录不存在时走 `realpath` 失败分支（`src/core/orchestrator.js:2269-2271`），存在但不可写时回传 `realpath` 结果（`:2274-2276`）。本迭代**不改**这条文案与取址口径 | AC-44；退出码 3 |
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
| `ESC_TEXT.roundsPrefix` | `回流超上限：`（**沿用现有常量** `ESC_TEXT.roundsPrefix`，`src/core/orchestrator.js:78`；`roundsDetail(title, round)` 在 `:81-84` 拼成 `回流超上限：{图节点 title}已派发 {round} 次仍未通过`，**不要新建重名常量**） | AC-10 断言的整句 `回流超上限：审核者已派发 2 次仍未通过` **由图数据 + 轮次生成**，不是文案常量；`task-loop` 的 T-003 `title:'审核者'` 决定主语，因此引擎里不得新增"审核者"字面量 |
| `ARTIFACT_TEXT.missing` | `未找到声明的产出 {ref}` | AC-19 / AC-21 |
| `ARTIFACT_TEXT.empty` | `产出为空 {ref}` | AC-19 / AC-21 |
| `ARTIFACT_TEXT.stale` | `产出不是本轮新写 {ref}` | AC-19 / AC-21 |
| `ARTIFACT_TEXT.previousMissing` | `上一版文档缺失 {ref}` | AC-20 |
| `ARTIFACT_TEXT.previousModified` | `上一版文档被改写 {ref}` | AC-20 |
| `DEFAULT_REVISION_REQUIREMENT` | `请按缺陷清单逐条修改后交出新版本` | 审核文件没写修改要求时 |
| `派遣失败：目标会话不可用` / `执行失败：{原文}` | **复用 I1.2 既有文案**（升级原因串，本迭代不新增词条） | AC-42 / AC-43 |
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
- `review.downstream_accepted`：`{handoffId, fromNodeId, round}`（`round` = 源节点被接受时的轮次，供 AC-05 按轮配对）。
- `review.evidence_verified`：`{ref, sha256}`。
- `backflow.constructed`：`{defects, revisionRequirement}`；`task-loop` 渲染缺陷行与 `修改要求：`，`code-loop` 仍渲染 `复测要求：`。
- 未知 reason 必须被 `REASON_LABEL` 覆盖；否则 `renderEventLine` 会把英文 reason 打给用户（AC-39 的反面）。
- `task-loop` 新增事件（`node.dispatch`、`output.submitted`、`review.read`、`review.passed`、`review.rejected`、`review.invalid`、`review.evidence_verified`、`review.downstream_accepted`、`backflow.constructed`、`rounds.exceeded` 等）逐个登记 `REASON_LABEL`；单测枚举夹具跑出的全部 reason，断言都能查到中文词条，不依赖英文兜底。
- **note 行渲染**：`result='note'` 的事件（`review.read` / `review.invalid` / `review.evidence_verified` / `review.downstream_accepted` / `rounds.exceeded`）在 `task-loop` 下中段取 `REASON_LABEL[reason]`，不再追加"原因"段；`single` / `code-loop` 保持 I1.2 版式，避免事件行回归（AC-36）。状态迁移行（`result='applied'`）仍按 `原因 <中文词>` 渲染。

### D-6 状态结构（追加字段，`schemaVersion` 仍为 2）

**节点**

| 字段 | 形状 | 说明 |
|---|---|---|
| `reviewReason` | `'evidence' \| 'downstream' \| null` | 仅 `state==='review'` 时有值；派发新一轮时清 `null`；取消收尾时也清 `null`（D-10 的 `applyCancel` 新增句）；**升级落盘时同样清 `null`**（与 `applyCancel` 同处，见 D-3 失败路径），终态节点上不得残留 |
| `review` | `{decision:'pass'\|'reject', defectCount:number, reviewPath:string, artifact:string, readAt:string, defects:[{summary,evidence}], revisionRequirement:string} \| null` | **本表即唯一形状**，M-3 / D-7 以它为准。`reviewPath` 取节点配置值（`task-loop` 为 `out/review.json`），不写死；`defectCount = defects.length`，由 D-7 一起返回，渲染 `· 审核 驳回 · 缺陷 <n> 条` 用。审核节点每轮覆盖；产物节点恒为 `null`；`defects` / `revisionRequirement` 供回流包取值 |
| `artifactRefs` | `[{ref:string, bytes:number, sha256:string, verifiedAt:string}]` | 本轮产物；派发时清空，旧版信息在 `artifactHistory`（形状以 D-3 为准，三处一致） |
| `artifactHistory` | `[{round:number, ref:string, sha256:string, bytes:number, verifiedAt:string}]` | 只追加；不随派发清空 |
| `note` | `string \| null` | 审核驳回未超限时写 `'等待复审'`；其他节点可为 `null`。沿用 I1.2 已有的 `'等待复测'` 口径（`orchestrator.js` 里已有该中文标记），本迭代不改动它的存储形态；统一改成机器码属于后续迭代的清理项 |

**交接包**

| 字段 | 形状 | 说明 |
|---|---|---|
| `artifactRefs` | `{input:string[], output:string\|null, previous:{ref:string, sha256:string}\|null}` | 正向带 `input`/`output`；回流带 `input`（上一版）/`output`（新版）/`previous` |
| `revisionRequirement` | `string \| null` | 仅回流包有值；空时用默认句 |

**`artifactRefs` 按边的取值**

| 边 | `input` | `output` | `previous` |
|---|---|---|---|
| `T-001→T-002`（forward） | 源节点 `artifactRefs[0].ref`（= `artifacts/reports/research-notes.v1.md`，fixed-workspace 产物） | 目标轮次 n → `artifacts/docs/<stem>.v<n>.md`（n=1，即 v1） | `null` |
| `T-002→T-003`（forward） | 源节点 `artifactRefs[0].ref`（= 本轮 `artifacts/docs/<stem>.v<n>.md`）；**不要用 `productsOf()`** | `null` | `null` |
| `T-003→T-002`（backflow） | **目标轮次 n − 1** → `artifacts/docs/<stem>.v<n-1>.md`（被驳回版）；**不取 `T-003.artifactRefs`，它为空** | 目标轮次 n → `artifacts/docs/<stem>.v<n>.md` | `{ref: artifacts/docs/<stem>.v<n-1>.md, sha256: 从 artifactHistory 里 round===n-1 的那一条取}` |
| `T-002→T-003`（retest） | 源节点 `artifactRefs[0].ref`（= `artifacts/docs/<stem>.v<n>.md`） | `null` | `null` |

上表的 `n` 一律是**目标节点本轮派发后的 `round`**（派发即 +1）：`T-003` 第 1 轮 n=1、第 2 轮 n=2；`T-002` 被回流重开时 n=2。因此 backflow 行的 `input` 与 `output` 是**两个不同的轮次**（n−1 与 n），不能用同一个符号。`previous.sha256` 取 `artifactHistory` 里 `round === n-1` 的那一条的 `sha256`（不是重算）。

`advance.js` 的 `productsOf()`（`:294-299`）在 `productPolicy==='doc-single'` 时**不得**回退到任务 `产物：` 行（否则会得到裸文件名 `release-notes.md`，不是版本引用；与 M-6 对 `hasSubmittedOutput()` 的口径一致）。

**其他**

- `counters.dispatchCount`：每次派发 +1（含首派）；AC-01/10/13/19/20/21/30/33/41 用它核对"没有继续派发"。
- `artifactStem`：**顶层字段**（与既有字符串 `task` 并列，不改 `state.task` 的形状）；仅 `productPolicy==='doc-single'` 的实例有；`startRun` 从任务产物行算出（去 `.md`），此后只读；旧实例缺省 `null`（不参与版本解析）。
- `state.rev`：每次落盘递增；`expectedState` 比较 `{state, halted, rev}`（C-01 / NFR-03）。
- **`task-loop`（`productPolicy==='doc-single'`）的 `state`** 中不得出现 `absPath`、文档正文、绝对路径；`cwd` 与 `handoff.artifactRefs` 里的引用都是相对引用（NFR-08）。`declared` 图（`single` / `code-loop`）保持 I1.2 的落盘形状不变，其中 `artifactRefs[].absPath` 属既有事实，本迭代不删不改（AC-31 / AC-36）。
- `snapshot.interruptedNodeId`：**只在快照里，不落 `state.json`**。`snapshotOf()`（`src/core/orchestrator.js:2605`）按与 `markInterrupted` 相同的规则派生——第一条 `running` 或 `review` 的节点 id，没有则 `null`；`renderInterruptedNote()` 读到它就用对应节点的状态填"停在节点"，读不到（`single` / `code-loop` 的既有快照、以及 I1.2 的两条渲染测试传的都是裸 `node`）保持现在的 `nodes[0]` 行为（A-2 第 2 段 / AC-45）。因此 `schemaVersion` 与落盘形状都不变。
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

**夹具覆盖不到的两步**：第 3 步（`readFile` 失败：文件存在但读不出，如被独占）与第 5 步（顶层是**数组**或 `null` 这类非对象 JSON）没有对应的夹具场景——它们与第 4 步同归 `review_invalid`，Windows 上也没有稳定的"存在但不可读"造法。这两步**必须有单元测试**（`test/wp10/review.test.js`，见 D-9）用注入的 `fs` 桩分别造 `readFile` 抛错、`JSON.parse` 返回 `[1,2]` / `null`，断言 `code`、`stage`（`unreadable` / `schema`）、`reasonCode='review_invalid'` 与逐字原因；不得因为夹具面通不到就跳过（NFR-10）。

**返回值**

```js
// 成功
{ ok: true, review: {
  decision, artifact, defects: [{summary, evidence}],
  defectCount: defects.length,              // 与 D-6 形状一致；渲染"缺陷 <n> 条"用，调用方不再自算
  revisionRequirement: string,          // 缺省时填 DEFAULT_REVISION_REQUIREMENT
  reviewPath: <node.reviewPath>, readAt: ISO
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
2. 文件名：非空、无 `/`、`\`、`..`、盘符、控制字符；必须以 `.md` 结尾；**去掉 `.md` 后**不得以 `.v<数字>` 结尾（自带版本号，如 `release-notes.v1.md`）。
3. 违反 1 → `PRODUCT_LINE_MISSING_TASK_LOOP`；违反 2 → `PRODUCT_INVALID_TASK_LOOP`；都在建实例/建工作区之前返回，退出码 1。`doc-single` 的产物行校验**不得复用** `extractProductLines`（它会先把 `../x.md` 归一成 `null`，导致报错码错、且无法回显原文）；应按"整行唯一的 `产物：` 之后到行尾"取原文 token，再按第 2 条的 5 项规则（非空 / 无 `/` `\` `..` / 无盘符与控制字符 / `.md` 结尾 / 去掉 `.md` 后不带 `.v<数字>`）逐项校验，并**原样回显**用户写的 token（AC-23）。
4. `declared` 图（`code-loop`）仍走 I1.2 的 `extractProductLines` 与 `PRODUCT_LINE_MISSING`，文案不变。

**产物解析（按节点 `artifactPolicy`，唯一入口 `doc-artifact.resolveNodeProducts(def, { node })`）**

| `artifactPolicy` | 本轮产物来源 | 本轮路径 | 核对方式 |
|---|---|---|---|
| `fixed-workspace` | 图节点 `products[]` 原样 | `artifacts/reports/research-notes.v1.md` | 当前版三重检查（存在/非空/不陈旧）+ `sha256` |
| `versioned-doc` | `doc-artifact.nodeProducts({ artifactDir, artifactExt, stem, round })` | `<artifactDir>/<stem>.v<round>.md` | `round > 1` 时先验上一版完整性（D-8 核对流程第 2 步），再当前版三重检查 |
| `review` | 不解析产物（审查方只交审核文件） | `reviewPath`（`out/review.json`） | 走 D-7，不调 `verifyProducts`；`expectedArtifact` 取**派发给审核者的那张交接包的 `artifactRefs.input[0]`**（`T-002→T-003` 的 forward / retest 边：`input` 是本轮 v<n>，`output` 恒为 `null`，见 D-6 按边表），缺省回退上游节点 `artifactRefs[0].ref`，不重复拼路径 |
| `declared`（I1.2 缺省） | 任务里 `产物：<路径>` 提取（`productsOfTask`） | 任务声明路径 | I1.2 原语义 |

> `round` 在本轮派发时已 +1（派发即 +1，沿用 I1.2 口径），因此 T-002 首派得到 `v1`、回流后第 2 轮得到 `v2`；回流包里的 `previous` 也由同一个函数以 `round-1` 算出，不另写一份拼接逻辑。
> `hasSubmittedOutput()` 使用同一解析；`baseDir` 同样按 `artifactPolicy` 取（`fixed-workspace` / `versioned-doc` → `workspaceDir`，`declared` → `cwd`）；`judge:'review'` 的节点用 `readReview()` 判定是否交卷，**不得**回退到任务里的 `产物：` 行（否则 T-002 会被裸文件名误导）。
> `stem` 来自 D-8 产物声明（任务里的文件名去 `.md`），在 `startRun` 时算一次并写进顶层 `state.artifactStem`，后续各轮只读。

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

> 提示词里的 `写入路径：` 与审核提示词的 `工作区：` 都使用工作区绝对路径，并统一做 `toPosix`（把 `\` 归一化为 `/`）后再插入；相对引用本来就是 `/`。这样 Windows 与 POSIX 上的提示词一致，夹具按 `写入路径：` / `工作区：` 取路径也无需处理分隔符差异。

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
工作区：<workspace 绝对路径>
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

- `verifyProducts()` 新增 `baseDir`（默认 `cwd`）与 `sha256`（默认不计算）；返回值**只追加** `sha256`：`refs: [{ref, absPath, exists, bytes, mtime, verifiedAt, sha256?}]`。前六个字段是 I1.2 的实现事实（`src/core/verify-artifact.js:336-343`），删除或改名都会让 `test/wp4/verify-artifact.test.js` 与 `single` / `code-loop` 一起挂掉（AC-36）。`sha256` 开关关闭时**不产生该键**（不是置 `null`）；`declared` 图的调用方不传 `sha256:true`，所以 `single` / `code-loop` 的 `state.json` 里不会多出 `sha256`（M-3 的"逐字沿用 I1.2 spread"）。
- 落盘投影**按 `productPolicy` 分流**：`declared` 保持 I1.2 的 `{...ref, verifiedAt: iso()}` 不变（`src/core/orchestrator.js:1225` / `:1528`，含 `absPath`，属既有行为）；`doc-single` 的 `fixed-workspace` / `versioned-doc` 投成 `[{ref, bytes, sha256, verifiedAt}]`，`absPath` / `exists` / `mtime` 只留在内存，不进 `task-loop` 的 `state.json`（NFR-08）。
- `sha256` 以文件字节流计算；不把正文写入状态或事件。

### D-9 夹具与测试同步

**新增/修改夹具**

| 文件 | 动作 | 说明 |
|---|---|---|
| `test/fixtures/task-loop-driver.mjs` | 新增 | 场景驱动、`--root` / `--scenario` / `--task` / `--cwd` / `--keep` / `--stop-after` / `--prepare-only` / `--reset`；写 `.mock/` 与 host 配置，实例由 `bin/orch.js run` 发起；除 `--prepare-only` 外透传其 stdout 并以同一退出码退出 |
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
  "review": { "decision": "reject", "artifact": "artifacts/docs/release-notes.v1.md", "defects": [{ "summary": "缺少回滚方案", "evidence": "artifacts/docs/release-notes.v1.md#L12" }], "revisionRequirement": "补写「回滚方案」一节" },
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
- `reviewDecoy:'workspace'`：**只在 `reviewSkip` 为真时生效**。在**实例工作区** `<root>/.orch/instances/<实例号>/workspace/out/review.json` 写一份合法 `pass` 的干扰文件（路径由 mock 从审核提示词的 `工作区：` 取到**绝对路径**，再拼 `out/review.json`；提示词里没有这一行或取不到绝对路径，就写 `.mock/bad-decoy-path` 并不写，让 AC 直接失败）。用于 AC-13 证明读取根是任务目录。
- `mutatePrevious`：作用对象是**上一轮那份文档**，即 `<workspaceDir>/artifacts/docs/<stem>.v<本轮轮次 - 1>.md`（第 2 轮时是 `v1`）。执行顺序固定：**先写本轮 v<n>，再动上一版**（否则本轮核对会先失败，得到 `artifact_missing` 而不是上一版的原因）。`modify` 追加一行 `- 改动（夹具注入）`；`remove` 删除该文件。两者都不改 `artifactHistory` 已记录的 sha256，因此分别得到 `artifact_previous_modified` 与 `artifact_previous_missing`（AC-20）。
- `hold.when:'prompt'`：在收到 `session/prompt` 后、产生任何输出前挂起，直到 `.mock/release`；**不能**用 `session/new` 挂起，否则 `run` 的前三行不会出现（AC-01）。
- `writePromptRecord()` 落 `{n, nodeId, round, task}`；`task` 是完整提示词原文。

**场景表（29 个）**

| 场景 | 步骤（节点/轮次） | 关键动作 | 预期 |
|---|---|---|---|
| `doc-pass` | 1 T-001/1；2 T-002/1；3 T-003/1 | 研究笔记；完整 v1；审核 pass | 完成，2 张交接包（HO-001 研究→撰写、HO-002 撰写→审核） |
| `doc-backflow-once` | 1 T-001/1；2 T-002/1；3 T-003/1；4 T-002/2；5 T-003/2 | v1 缺「回滚方案」；驳回 2 条（证据 v1#L1 / v1#L18）；v2 完整；pass | 完成，4 张交接包 |
| `doc-reject-twice` | 同 1~4；5 T-003/2 | 第 2 轮再驳回 2 条（证据 v2） | 挂起，`rounds_exceeded` |
| `doc-hold-research` | 1 T-001/1 | `hold.when='prompt'`，不写 | T-001 执行中；AC-01 / 25 / 26 |
| `doc-slow-reviewer` | 1 T-001/1；2 T-002/1；3 T-003/1 | 审核 `delayMs=60000` | T-003 执行中；AC-28 |
| `review-missing` | 1 T-001/1；2 T-002/1；3 T-003/1 | `reviewSkip` + `reviewDecoy:'workspace'`（工作区放合法 pass 干扰文件） | 挂起，`review_missing`（AC-13 借此证明读取根是任务目录） |
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
| `review-says-pass` | 1 T-001/1；2 T-002/1；3 T-003/1；4 T-002/2 | 消息说"全部通过"、文件写 reject；第 4 步写 v2 | 以 `--stop-after 4 --keep` 停在第 4 步核对通过后；T-003 第 1 轮 `review.decision='reject'` |
| `review-says-reject` | 1 T-001/1；2 T-002/1；3 T-003/1 | 消息说"不通过"、文件写 pass | 完成，无回流包 |

**必须同步的测试**

| 文件 | 改动 |
|---|---|
| `test/wp2/labels.test.js` | 新增模板/角色/限定词/后缀/错误码/审核文案/事件原因断言（D-4 / D-5）；把 `REASON_LABEL` 的条数断言 **33 → 39**（新增 6 条 `review.*`），其余键逐字不动 |
| `test/templates/fake-graph.test.js` | 第 **:214-229** 行的 `buildHandoff` 键集合断言追加 `'artifactRefs'` / `'revisionRequirement'`（M-4 授权变更，其余 14 键与顺序不变）；同文件其余断言逐字不动 |
| `test/wp4/orchestrator.test.js` | 新增 `task-loop` 下游门控、审核节点三分支、`consumeHandoff` 字段保留、一次 CAS（`rev` 只 +1）用例 |
| `test/wp4/verify-artifact.test.js` | **I1.2 既有断言一条都不改**（含 `:178-179` 的 `mtime` / `verifiedAt`）；只新增 `baseDir`、`sha256` 开关，以及 `doc-single` 落盘投影去掉 `absPath`/`exists`/`mtime` 的用例 |
| `test/wp10/perf.test.js` | 新增：NFR-02 的 `readReview()` / `verifyProducts({sha256:true})` 各 20 次实测取 p95 ≤ 50ms |
| `test/perf/task-loop-timing.mjs` | 新增：NFR-04 的 `orch status` 5 次计时脚本（打印逐次毫秒与最大值，最大值 > 500ms 时以非 0 退出） |
| `test/wp6/render.test.js`、`test/wp9/render-fixes.test.js` | 新增 `task-loop` 节点限定词、产物/审核后缀、`review(downstream)` 耗时、升级块；`single` / `code-loop` 旧样例原样保留。`renderInterruptedNote` 的两条既有用例（`test/wp6/render.test.js:20-28`、`test/wp9/render-fixes.test.js:172-192`）**不改断言**——它们传的是裸 `node`、不带 `nodes` / `interruptedNodeId`，走回落分支，逐字输出必须不变；停点选取只允许新增用例覆盖 |
| `test/wp9/cli-e2e.test.js` | 新增 `task-loop` 发起/成功/挂起/取消；I1.2 用例全部保留（AC-36） |
| `test/wp10/review.test.js` | 新增：11 步顺序、逐字原因、`#L` 剥离、越界拒绝、`pass`/`reject` 形状 |
| `test/wp10/doc-artifact.test.js` | 新增：产物名解析、版本引用、上一版完整性、`sha256` |
| `test/fixtures/task-loop-driver.mjs` + 场景 JSON | 新增；29 个场景必须可独立运行并复位 |
| `test/fixtures/mock-acp-agent.js` | 新增 `--suite task-loop`；不带该参数时 I1.2 行为逐字不变 |

### D-10 并发、取消与恢复

| 规则 | 实现点 | 验收 |
|---|---|---|
| 同一目录只能有一个未结束的多节点实例（`code-loop` 与 `task-loop` 互斥） | 复用 I1.2 已有的 `findDirBusy({multiOnly:true})`，它已遍历全部多节点图；`single` 不参与 | AC-25 / AC-26 |
| 同一节点在 `running` / `review`（含 `review(downstream)`）时拒绝重复投递 | `dispatchInState()` 的 `isNodeBusyState()` | AC-41 |
| 取消覆盖 `pending/running/review/failed/escalated`（`review` 含 `evidence` 与 `downstream` 两种子原因） | `CANCELABLE_NODE` 已含这些状态；`review(downstream)` 同为 `review`；**本迭代在 `applyCancel` 的节点循环里新增一句**：与 `node.endedAt = at`（`src/core/orchestrator.js:2502`）同处把 `node.reviewReason = null`，维持"该字段只在 `state==='review'` 时非空"的不变式（渲染层按状态分支，不改也不会显示限定词，但机检与后续读状态的人依赖这条） | AC-28 / AC-29 / AC-45 |
| 取消把 `created/delivered/accepted` 交接包记 `rejected`、原因 `withdrawn` | `CANCELABLE_HANDOFF` | AC-28 |
| 取消把 `pending` 升级记 `voided` | `applyCancel` 的升级循环 | AC-29 |
| 取消后会话回 `idle`，不再执行 | `applyCancel` 的会话循环 + `quarantined` | AC-28 |
| 重启后 `suspended` 保持、`escalated` 节点保持、`failed` 保持、`review` 不自动重新核对 | `CORE_IMMUTABLE_INSTANCE` 含 `suspended`；`reconcileOnBoot` 不写挂起实例 | AC-11 / AC-12 |
| `review(downstream)` 重启后保持等待，不重派发 | 状态读取无特殊分支；只有下游交接包 `accepted` 才迁移 | **AC-45**（AC-12 是同类口径） |
| I1.1 旧格式只读；I1.2 编码闭环实例可查可取消 | `isLegacy()` 在 `run` / `cancel` 入口拦截 | AC-37 |

**`startRun` 的检查顺序（`task-loop`）**

1. 模板未知 → `TEMPLATE_UNKNOWN`；
2. 任务为空 → `TASK_EMPTY`；
3. `productPolicy==='doc-single'` 的产物声明校验（D-8）→ `PRODUCT_LINE_MISSING_TASK_LOOP` / `PRODUCT_INVALID_TASK_LOOP`；
4. 目录不可写 → `CWD_NOT_WRITABLE`；
5. 带 `--instance`：旧格式 → `LEGACY_READ_ONLY`；运行中 → `INSTANCE_RUNNING`；挂起 → `INSTANCE_SUSPENDED`；终态 → `INSTANCE_TERMINAL`；
6. 同目录已有未结束的多节点实例 → `DIR_BUSY`；
7. 分配实例号并创建 `.orch/instances/<新号>/`，在其中建工作区 `workspace/artifacts/{docs,reports}`（失败 → `WORKSPACE_INIT_FAILED`）；建好之后才**第一次写 `state.json`**。

> 3 必须在 7 之前：产物声明不合法时不得留下 `.orch/instances/<id>/workspace`（AC-22 / AC-23 的机检）。
> 7 内部顺序不可颠倒：工作区必须落在实例目录里，所以"先建目录、建工作区失败就回滚"是唯一可行形状。失败时**只删本次新建的那一个实例目录**（`fs.rm(recursive)` 前校验它是本轮 `mkdir` 出来的，绝不碰已存在的实例），且因为 `state.json` 尚未写，`orch list` / `orch status` 本来就看不到它（AC-44 的"不留实例"由此成立）。


