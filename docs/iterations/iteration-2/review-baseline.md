# I1.2 需求与规划基线一致性评审

> 评审人：独立评审子 Agent ｜ 基准：`docs/index.md` ｜ 对象：`docs/iterations/iteration-2/requirement.md`
> 只读说明：本文只新增本文件；未修改 `requirement.md`、`index.md`、`src/**`、`test/**`，未执行任何写仓库的命令。
> 阅读口径：行号取自当前工作区。`requirement.md` 当前有 3 处未提交改动（见 §7.1），`index.md` 为工作区当前版本。

---

## 0. 总判

**结论：需修订（阻断 8 项 / 建议 18 项）。**

一句话结论：**I1.2 的规划覆盖性基本达标，但“基线八处修订”把 I1.1 的 7 态边表当成了基线 §3.1 的 9 态边表，且 `waiting_dependency`、`escalated` 出边、`done` 进入条件三处方向错误；B-06 / B-11 未裁决前，AC 集与基线不能冻结。**

阻断项（不改则不能进入实现）：

1. **八处②“补 10 条边”对象错**：这 10 条是 I1.1 7 态表的增量，不是基线 9 态图的增量；其中 `review→escalated`、`failed→running`、`failed→escalated` 基线已有，`pending` 又不是基线状态（基线用 `blocked/ready/assigned`）。按原文改会把基线改重、改错。
2. **八处①把 `escalated` 出边收窄为 `cancelled`**：基线原文是“人工裁决后 → done / failed / 重新分配”，收窄会删掉 I1.4 `orch escalate resolve` 的三条裁决路径。
3. **R-4 / 八处⑧ `waiting_dependency` 显示词用错**：基线“等待校验”对应“证据核对”阶段，“等待下游”对应 `review_reason: downstream`（等下游 `accepted`）。需求把两者对调，AC-44 / BR-28 建立在这个错位上。
4. **`done` 的进入条件没改**：基线是“证据校验通过 + 下游接受”，I1.2 实际“证据通过即 done”，`review_reason: downstream` 又被推到 I1.3。只加“可回流”注解不够，基线与实现仍冲突。
5. **B-06 协调者节点未裁决**：三节点已写进 AC-01/02/03/04/06/11/17/30/42/45、A-2/A-3 和基线⑥；未确认前 AC 集与基线都不稳定。
6. **B-11 真实面缺失败路径**：规划验收点“第 2 轮仍失败 → 停止回流、生成升级、实例挂起”只有夹具证据；`demo-code-fail/` 本可提供真实失败闭环，取舍理由不成立。
7. **AC-15 场景不可构造**：`verdict-says-fail` 只写了 `message` 与 `verdict`，没写 `defects` 与非空证据；按 §3.3 判定契约会被判 `verdict_invalid`，不会产生 AC-15 断言的回流交接包。
8. **D-6“任意→idle（回合结束）”与 AC-44 冲突**：AC-44 的 `after_output` 正是“回合结束、核对前”，要求会话仍为 `waiting_dependency`；D-6 却规定回合结束→`idle`。实现任一边，另一边必红。

---

## 1. 规划覆盖性

### 1.1 规划原文逐句覆盖表

规划原文均取自 `docs/index.md:668-675`。判定只针对“需求有没有把这条能力落到可验收的位置”，不针对“实现是否已写”。

| # | 规划原文（逐字） | 需求落到哪（章节 / AC） | 覆盖判定 |
|---|---|---|---|
| 1 | `- 内置角色：开发、测试、协调者`（`index.md:670`） | §1.3 范围内 2（`requirement.md:93`）、§2.1 角色职责表（`requirement.md:197-201`）、AC-04（`:561`）、AC-08 / AC-39（`:610` / `:1013`） | 覆盖（三个角色都有职责与产物；角色是代码常量，见 B-01） |
| 2 | 同上，`开发` | §2.1 开发行（`:199`）、§2.2（`:207-224`）、AC-01 / AC-05 / AC-43 | 覆盖 |
| 3 | 同上，`测试` | §2.1 测试行（`:200`）、§2.4（`:274-323`）、AC-05 / AC-08 / AC-15~AC-19 | 覆盖 |
| 4 | 同上，`协调者` | §2.1 协调者行（`:201`）、§1.3.1 R-1（`:147-155`）、AC-03 / AC-17 / AC-30 / AC-45 | 覆盖“角色定义”；节点化为 R-1，**待 B-06 确认** |
| 5 | `- 编码闭环模板：开发 → 测试 → 缺陷回流 → 轮次上限 → 升级`（`index.md:671`） | §1.3 范围内 1（`:92`）、§2.2（`:207-224`）、§2.8（`:468-475`）、AC-01 / AC-02 / AC-03 / AC-07 | 覆盖（模板是代码常量，不是 YAML；I1.6 才做声明式） |
| 6 | 同上，`缺陷回流` | §2.4 C（`:274-323`）、BR-03 / BR-09 / BR-26、AC-05 / AC-15~AC-19 / AC-24 | 覆盖 |
| 7 | 同上，`轮次上限` | §2.5 轮次口径表（`:358-367`）、BR-05、AC-07 / AC-24 | 覆盖 |
| 8 | 同上，`升级` | §2.6 E（`:393-442`）、BR-08 / BR-17、AC-08 / AC-12 / AC-27 / AC-39 | 覆盖 |
| 9 | `- 交接包构造与 ACP 投递；轮次计数与升级生成`（`index.md:672`） | §2.4 交接包内容（`:279-283`）、§2.8（`:468-475`）、BR-22 / BR-26、AC-34 / AC-41 / AC-43 / AC-45 | 覆盖；真实宿主上的 ACP 投递由 AC-01/AC-03 覆盖，夹具面由 AC-43 的 `prompts/<n>.json` 覆盖 |
| 10 | 同上，`轮次计数` | §2.5（`:358-367`）、BR-04 / BR-11、AC-05 / AC-06 / AC-35 | 覆盖 |
| 11 | 同上，`升级生成` | §2.6（`:393-442`）、BR-08 / BR-17、AC-08 / AC-12 / AC-27 / AC-39 | 覆盖 |
| 12 | `- 交接包 \`accepted → consumed\` 流转验证`（`index.md:673`） | §2.3（`:258-260`）、§2.4（`:285-290`）、BR-19、AC-34 / AC-41 / AC-45 | 覆盖 |
| 13 | `**验收**：测试第 2 轮失败 → 核心停止回流`（`index.md:675`） | §2.5 D（`:330-341`）、BR-05、AC-07 / AC-41 | 覆盖（夹具面）；真实面见 B-11 |
| 14 | 同上，`生成升级` | §2.6（`:393-442`）、AC-08 / AC-12 / AC-27 / AC-39 | 覆盖 |
| 15 | 同上，`实例挂起等待人工` | §2.5 实例状态（`:369-379`）、BR-06 / BR-23、AC-07 / AC-09 / AC-10 / AC-12 | 覆盖“挂起 + 可见”；人工处理入口按规划留 I1.4 / I1.11，需求只做“能看见、不能处理” |
| 16 | 同上，`交接包状态正确流转` | BR-19 / BR-22、AC-34 / AC-41 / AC-45 | 覆盖 |

**覆盖结论：规划 I1.2 条目的每一句都能在需求里找到落点，没有整条遗漏。** 但有两处“覆盖了但口径不稳”：

- 第 4 条“协调者”：覆盖的是“角色定义”，不是“规划原文要求的节点”。规划模板序列只写到 `升级`，没有把协调者放进序列；R-1 是新增节点，不是原文要求（见 §5.3）。
- 第 13~16 条“验收”：覆盖的是夹具面，不是真实宿主面；规划的这条验收点恰恰是失败路径，B-11 的取舍需要补真实证据（见 §5.4）。

### 1.2 越界检查（需求里有没有 I1.2 之外的能力）

判定原则：**“I1.2 的验收离开它就无法成立”= 必须现在做；“只是提前做了后续迭代更完整形态”= 可以推到后续。**

| # | 需求里的能力 | 按基线属于 | 需求位置 | 判定 | 处置建议 |
|---|---|---|---|---|---|
| 1 | `orch run --template code-loop` 参数 | I1.4「CLI 核心命令集」（`index.md:696`） | §1.3 范围内 1（`:92`）、M-8（`:168`）、B-13（`:1427`） | **必须现在做**（没有它无法发起闭环） | 在基线登记“I1.2 先占最小形态、I1.4 补全并保持兼容”（见 §6.1） |
| 2 | `--host <id>` 参数 | I1.4 未列；本质是验收夹具 | M-8（`:168`）、B-20（`:1434`） | **可推到后续**（产品不需要） | 只保留为夹具入口；建议改成 `NODE_ENV=test` 下的 test-only 参数或环境变量，不写进 usage 的产品参数区 |
| 3 | `createOrchestrator({ graph })`、`src/templates/**` | I1.6「声明式工作流 + 完整原语」（`index.md:722-734`） | M-13（`:173`）、AC-28（`:851-861`） | **必须现在做**（I1.3 验收要求“与 I1.2 共享同一引擎”，`index.md:687`） | 只做“图数据 + 注入”，明确不做注册表、校验器、YAML 解析；见 §6.2 的耦合风险 |
| 4 | `schemaVersion: 2`、v1 只读 | I1.12 `orch migrate`（`index.md:837`） | M-3（`:163`）、B-09（`:1423`） | **必须现在做**（状态从单对象变数组，旧实例必须还能查） | 只做只读兼容，不做迁移；I1.12 再做 `orch migrate` |
| 5 | `escalations[]` + `pending→voided` | I1.4 `orch escalate list/resolve`（`index.md:700`） | M-7（`:167`）、B-08（`:1422`） | **必须现在做**（“生成升级”要有落点） | 只做创建/作废；I1.4 扩 `resolve`，不得重定义字段 |
| 6 | 多节点 `applyCancel`（遍历 `nodes[]/sessions[]/handoffs[]/escalations[]`） | I1.1 `orch cancel` 的延伸；I1.4 另有 `orch workflow abort`（`index.md:703`） | M-10（`:170`）、AC-11 / AC-42 | **必须现在做**（挂起唯一出路是取消） | 不新增 `orch workflow abort`；取消仍是 I1.1 那条命令 |
| 7 | `review_reason` 子状态 | I1.3（`index.md:685`） | §1.3 范围外（`:109`） | **可以推到 I1.3** | 需求已明确不做，正确；但 `done` 进入条件仍要按 §3.1 补注（见 §2.2） |
| 8 | 证据模型泛化（文件存在 + 引用可解析 + 审核角色确认） | I1.3（`index.md:684`） | §1.3 范围外（`:109`） | **可以推到 I1.3** | 本迭代只做编码闭环的 `out/verdict.json` 最小校验，已够 |
| 9 | 产物类型隔离 / worktree / 合并 | I1.7（`index.md:738-744`） | §1.3 范围外（`:114`） | **可以推到 I1.7** | 所有产物落同一任务目录，已明确 |
| 10 | 会话复用 / resume / 崩溃续跑 | I1.8（`index.md:748-759`） | §1.3 范围外（`:115`） | **可以推到 I1.8** | 本迭代只做“挂起/中断不自动推进”，不做恢复 |
| 11 | 三层日志 / 健康度 / 连接线聚合 | I1.9 / I1.10a（`index.md:763-790`） | §1.3 范围外（`:116`） | **可以推到 I1.9 / I1.10a** | 需求只显示事件行与交接包行，正确 |
| 12 | 桌面应用 / 通知 / 人工干预队列 | I1.10a / I1.10b / I1.11（`index.md:775-823`） | §1.3 范围外（`:117-118`） | **可以推到后续** | 需求只做 CLI，正确 |
| 13 | 链式哈希 / 预算 / `orch migrate` | I1.12（`index.md:827-840`） | §1.3 范围外（`:119`） | **可以推到 I1.12** | 需求只加事件与旧格式只读，正确 |
| 14 | `[#seq]` 事件行与升级块 | 事件日志是 I1.1 底座；展示是 I1.2 审计需要 | M-12（`:172`）、AC-24 | **必须现在做**（否则“轮次/升级可追溯”无法验收） | 不新增日志层，只改渲染 |

**越界结论：没有发现“整块把后续迭代能力搬进 I1.2”的情况。** 真正的边界问题只有三处：`--template` 与 I1.4 的归属（必须登记）、`--host` 的产品面（应收进 test-only）、`createOrchestrator({graph})` 的“图注入”是否足以让 I1.3 只加图（见 §6.2）。

---

## 2. 状态模型冲突清单

### 2.1 与 `docs/index.md` §3.1~§3.6 逐条对照

| # | index.md 行 | 基线原文（逐字） | 需求口径（逐字 / 位置） | 结论 | 处置 |
|---|---|---|---|---|---|
| 1 | `index.md:279` | `| \`running\` + 会话不可恢复 | \`assigned\` | 重新分配会话，从当前轮次重试 |` | `| \`已挂起\` | 有升级等我处理，核心不再推进 | \`已取消\`（唯一出路） |`（`requirement.md:375`） | **新增（基线无实例状态层）**，不冲突，但 §3.6 缺 `suspended` 行 | 补 §3.6 行（见 §3.2.4） |
| 2 | `index.md:151` | `| \`escalated\` | 升级人工 | 轮次超限 / 依赖死锁 / 连续失败 | 人工裁决后 → done / failed / 重新分配 |` | `节点"已升级"唯一出口是"已取消"`（`requirement.md:1422`）；D-1 `| \`escalated\` | \`cancelled\` | 取消（唯一出口） |`（`:1470`） | **冲突（收窄）**：删掉了基线的 `done/failed/重新分配` 三条裁决路径 | 基线保留三条路径，只补“I1.2 仅实现取消；裁决入口在 I1.4” |
| 3 | `index.md:149` | `| \`done\` | 验收通过 | 证据校验通过 + 下游接受 | 终态 |` | `**本需求取 §3.5**`（`requirement.md:176`）；`节点 T-003: done → running`（`index.md:256`） | **基线内部冲突**：§3.1 说终态，§3.5 t2 说可回流 | 取 §3.5 的理由成立（回流闭环必须有此边），但必须同时改 `done` 的“终态”和进入条件，不能只加注 |
| 4 | `index.md:149` | 同上，`证据校验通过 + 下游接受` | `review_reason 子状态 | I1.3`（`requirement.md:109`）；BR-13 `核心核对通过才算`（`:493`） | **冲突**：I1.2 在证据通过即 `done`，不等下游 `accepted`；基线的 `downstream` 阶段被推到 I1.3 | 基线 `done` 行注明“I1.2 只按 evidence；I1.3 起加 downstream 门控” |
| 5 | `index.md:150` | `| \`failed\` | 执行失败 | 会话崩溃 / 证据缺失 / 契约不满足 | 回流到 running 或升级 |` | `失败 在本模板下表示"本轮判定未通过、等复测"`（`requirement.md:266`）；§3.5 `节点 T-005: review → failed（等待复测）`（`index.md:257`） | **基线内部冲突**：§3.1 的 `failed` 是“执行失败”，§3.5 用它表示“判定不通过” | 取 §3.5 对测试节点成立，但要把 `failed` 行改成“执行/判定未通过”，并加 `failed_reason: verdict_fail` |
| 6 | `index.md:136` / `index.md:150` | `failed → running（回流）`；`回流到 running 或升级` | M-1 `**\`running→failed\` 必须保留**`，并新增 `failed→running`（`requirement.md:161`） | **兼容（不是新增）**：基线图已有 `failed→running` | 不要在基线里重复加这条边；M-1 的“新增”只是相对 I1.1 的 7 态表 |
| 7 | `index.md:175` / `index.md:186` | `| \`escalated\` | 已升级，等待人工 | 红色圆点 |`；`核心生成 escalation | \`escalated\`` | `thinking/tool_running/idle/waiting_dependency/waiting_input→escalated`（`requirement.md:1196`） | **细化（基线未限制 from）**，兼容 | 可在 §3.2 映射表补全 from 集合 |
| 8 | `index.md:187` | `| \`session/cancel\` 或会话关闭 | \`idle\` 或从视图移除 |` | `escalated→idle`（仅取消，保证取消后不残留在"已升级"）（`requirement.md:1196`） | **兼容/细化** | 可在 §3.2 映射表补一行；不冲突 |
| 9 | `index.md:222-227` / `index.md:236` | 交接包图无 `created→rejected`；`| \`rejected\` | 目标会话拒绝 | 触发回流或升级 |` | M-5 `新增 created → rejected`（`requirement.md:165`）；`未完成交接包 已拒绝（已撤回）`（`:460`） | **新增边 + 语义冲突**：`created` 时没有目标会话，不可能“目标会话拒绝”；“撤回”也不是“触发回流或升级” | 加边，同时改 `rejected` 行（见 §3.2.3） |
| 10 | `index.md:234` | `| \`accepted\` | 目标会话已接受 | 目标节点从 \`assigned\` 进入 \`running\` |` | `accepted 由目标会话建起后的首个事件置位`（`requirement.md:1487`）；`目标节点先 running、交接包后 accepted`（`:176`） | **冲突（时序反了）**：基线说“先 assigned→running，再 accepted”，需求说“先 running，后 accepted” | 改 §3.4 `accepted` 行 + §3.5 t2/t3（见 §3.2.7） |
| 11 | `index.md:235` / `index.md:239` | `| \`consumed\` | 目标节点产出提交 | 交接包被消费完毕 |`；`\`consumed\` 才表示目标节点已完成` | `"已完成"指本轮产出被核对通过`（`requirement.md:321`）；AC-41 `HO-003 末态是 consumed 而非 rejected`（`:1046`，测试节点已升级） | **冲突**：基线说“产出提交 / 节点已完成”，需求说“核对通过 / 节点可以不是 done” | 改 §3.4 `consumed` 行 + `index.md:239` 关键句（见 §3.2.5） |
| 12 | `index.md:174` | `| \`waiting_dependency\` | 已产出，等待下游或证据校验 | 黄色圆点，显示“等待校验” |` | BR-28 `节点已出料、正在核对时，会话显示 \`等待下游\``（`requirement.md:508`）；`\`等待下游\` 表示节点已出料、正在被核对`（`:270`） | **冲突（语义错位）**：基线“等待校验”才是证据核对；“等待下游”是 `review_reason: downstream`（等 `accepted`） | 基线不改；需求改回“等待校验”（见 §3.2.8） |
| 13 | `index.md:154-156` | `review_reason: evidence —— 等待核心校验证据`；`review_reason: downstream —— 证据已通过，等待下游交接包 accepted` | `review_reason 子状态 | I1.3`（`requirement.md:109`）；I1.2 直接 `review→done` | **冲突/延后**：I1.2 只有 evidence，且不等 downstream | 基线注明“I1.2 只有 evidence；downstream 在 I1.3”；不要把 `done` 写成已完成下游接受 |
| 14 | `index.md:281` | `| \`review\` | \`review\` | 等待核心重新校验 |` | `核心在节点"待校验"时消失 → 重启后实例 已中断，节点停在 待校验，**不自动重新核对**（"核心消失后重新核对"是 I1.8）`（`requirement.md:354`） | **冲突**：基线说重启后重新校验，I1.2 说不重校 | 基线加“阶段适用”注：I1.8 起才自动重校（见 §4.1） |
| 15 | `index.md:278-279` | `running + 会话可恢复 → 保持 running`；`running + 会话不可恢复 → assigned` | `重启后按"运行中核心消失"判 已中断`（`requirement.md:350`） | **冲突（I1.2 过渡行为）**：I1.2 没有 resume，也没有重新分配，直接中断 | 基线加“I1.2 不实现恢复方言；I1.8 起按上表” |
| 16 | `index.md:252` | `→ 目标会话 dev_1: cooldown → thinking` | B-05 `基线 §3.5 的 \`cooldown → thinking\` 本迭代不实现`（`requirement.md:1419`） | **冲突/延后**：I1.2 每次派发新会话，没有 `cooldown` | 基线 §3.5 t1 加注“I1.2 fresh；cooldown 在 I1.5，复用唤醒在 I1.8” |
| 17 | `index.md:356` | `- **主动唤醒投递**：适配器调用 \`session/prompt\` 向空闲会话发起新 turn` | BR-10 `每次派发都是新会话`（`requirement.md:490`） | **冲突**：基线是“向空闲会话发新 turn”，I1.2 是“新建会话再 prompt” | 基线加注“I1.2 fresh；空闲会话复用/唤醒在 I1.8” |
| 18 | `index.md:595` | `│   ├── state/                         # 节点状态、轮次、检查点、角色实例、连接线聚合、traces.jsonl` | M-3 `state.json`、`schemaVersion: 2`（`requirement.md:163`） | **冲突（既有偏差）**：基线是 `state/` 目录，I1.1 实际是 `state.json` + `events.jsonl`；I1.2 又加 v2 | 改 §5.2 为实际布局，或注明 `state/` 是概念目录（见 §4.7） |
| 19 | `index.md:151` | `轮次超限 / 依赖死锁 / 连续失败` | D-5 原因码表（`requirement.md:1560-1572`）新增 `verdict_missing/stale/invalid`、`artifact_missing/empty/stale`、`dispatch_failed`、`execution_failed` | **细化（进入条件扩展）**：不冲突，但基线未列这些原因 | 基线 `escalated` 行补“派发失败 / 核对失败（`verdict_*` / `artifact_*`）” |
| 20 | `index.md:387` | `| \`rejected\` | 任一交接包 \`rejected\` | 红色实线 + 回流箭头 |` | `已拒绝（已撤回）`（`requirement.md:462`）；取消写 `rejectReason='withdrawn'`（`requirement.md:1556`） | **冲突（I1.10a 派生视图）**：撤回不是异常，不该显示红色回流箭头 | 聚合条件排除 `withdrawn`，或归入 `not_started`（见 §4.8） |

### 2.2 需求自己承认的三处矛盾：取哪一边、理由是否成立

#### 2.2.1 `done` 是终态还是可回流唤醒

- 需求取的边：**§3.5**。原文 `**本需求取 §3.5**（仅节点时序；交接包 \`accepted\` 的置位时刻按 D-2，晚于目标节点进入 \`running\`）`（`requirement.md:176`）。
- 理由是否成立：**成立，但不完整。** 如果 `done` 是终态，§3.5 t2 的 `done → running` 就无法实现，回流闭环不成立；I1.2 的整条验收都依赖它。取 §3.5 是对的。
- 不完整在哪：§3.1 的 `done` 行有**两个**与 I1.2 冲突的点——①“终态”②“证据校验通过 + 下游接受”。需求只处理了①（而且只是“加注”），没有处理②。I1.2 的 `done` 是“本轮产出核对通过”，不等待下游 `accepted`（`review_reason: downstream` 明确推到 I1.3）。所以基线的 `done` 行必须同时改“进入条件”和“离开条件”，否则 I1.3 一接 `downstream` 又会二次冲突。
- 建议：在 §3.1 的 `done` 行写“证据校验通过（I1.2 不等待下游接受；I1.3 起加 `review_reason: downstream` 门控）”，离开条件写“下游驳回 → running（仅开发）；否则终态”。不要只写“可回流唤醒”。

#### 2.2.2 `failed` 的语义（执行失败 vs 判定不通过）

- 需求取的边：**§3.5**。原文 `\`failed\` 在 \`code-loop\` 下承担"本轮未成功但流程继续（仅测试判定不通过）"，在 \`single\` 下仍是"执行失败"`（`requirement.md:176`）。
- 理由是否成立：**对测试节点成立，但语义过载。** 测试节点确实“执行成功、判定不通过”，§3.5 t2 也写 `review → failed（等待复测）`；如果不用 `failed`，就要新增状态或子状态，而基线明确“不新增独立状态”（`index.md:158` 的超时同理）。所以取 §3.5 是现实选择。
- 不完整在哪：`failed` 同时承担“会话崩溃/证据缺失/契约不满足”（`index.md:150`）和“测试判定不通过”，会让 I1.9 健康度、I1.10a 连接线、I1.12 审计都难以区分。需求只加了 `nodes[].verdict` 与 `note`，没有加 `failed_reason: verdict_fail`；基线原本只有 `failed_reason: timeout`（`index.md:158`）。
- 建议：`failed` 行改成“本轮执行/判定未通过（含测试判定不通过）”，并补 `failed_reason: timeout | verdict_fail`；`single` 的 `failed` 仍是执行失败。这样 I1.9 的健康度可以只对 `timeout`/崩溃告警，不把“判定不通过”误报成红色。

#### 2.2.3 `waiting_dependency` 的显示词

- 需求取的边：**“等待下游”**。原文 `节点已出料、正在核对时，会话显示 \`等待下游\``（`requirement.md:508`）；`\`等待下游\` 表示节点已出料、正在被核对`（`:270`）。
- 理由是否成立：**不成立。** 基线把 `waiting_dependency` 定义为“已产出，等待下游或证据校验”，显示词选的是“等待校验”（`index.md:174`）；“下游”在基线里是 `review_reason: downstream`——“证据已通过，等待下游交接包 `accepted`”（`index.md:154-156`）。需求把“正在核对证据”叫成“等待下游”，正好把两个阶段对调。
- 后果：BR-28、AC-44、§2.3 六种会话行、A-1/A-2 的会话正则全部建立在这个词上；如果按需求改基线，I1.3 再实现 `review_reason: downstream` 时就没有词可用了。
- 建议：**基线不改**；需求把 `等待下游` 全部改为 `等待校验`（或 `等待核对`），把“等待下游”留给 I1.3 的 `downstream`。

---

## 3. 基线八处修订核实

> 逐处回答三个问题：(a) 是否确实需要改；(b) 方向是否准确；(c) before / after 精确文本 + 改后是否与 §3.5 / §3.6 / 能力域 4 自洽。
> before 均与 `docs/index.md` 当前原文逐字一致；after 是建议替换文本。

### 3.1 八处总表

| # | 事项 | 是否必须改 | 方向准确性 | 结论 |
|---|---|---|---|---|
| ① | §3.1 的 `done` / `failed` / `escalated` 三行 | 必须 | `done`/`failed` 方向对但不完整；`escalated` 方向**错** | 改，但 `escalated` 必须保留三条裁决路径 |
| ② | §3.1 节点迁移图补 10 条边 | 必须 | **错**：10 条是 I1.1 7 态表的增量，基线 9 态只需 7 条；3 条已存在；`pending` 非基线态 | 改为 7 条基线边 |
| ③ | §3.4 补 `created→rejected` | 必须 | 边对，但 `rejected` 语义不完整 | 加边 + 改 `rejected` 行 |
| ④ | §3.6 加 `suspended` 行 | 必须 | 对，但不完整（`review`/`running`/`escalated` 未处理） | 加 `suspended` + 补 3 行/注 |
| ⑤ | §3.4 `consumed` 语义 | 必须 | 对，但漏了 `index.md:239` 的关键句 | 改 row + 关键句 |
| ⑥ | I1.2 条目补 R-1 | 条件必须（B-06） | 条件对；未裁决前不应改 | 等 B-06 |
| ⑦ | §3.5 t2 时序 | 必须 | 对，但不完整（t3/t4/§3.4 `accepted` 未改） | 改 t2 + t3/t4 + `accepted` 行 |
| ⑧ | §3.2 `waiting_dependency` 显示词 | **不必** | **错**：证据核对≠等待下游 | 基线不改；需求改回“等待校验” |

**“方向有误”共 3 处：①（仅 `escalated` 子项）、②、⑧。** 其中 ②、⑧ 是阻断项；① 的 `done`/`failed` 子项方向对但不完整，`escalated` 子项方向错。

### 3.2 逐处 before / after

#### 3.2.1 ① §3.1 的 `done` / `failed` / `escalated` 三行

**(a) 是否确实需要改：是。**

- `done`：`index.md:149` 写 `终态`，`index.md:256` 写 `节点 T-003: done → running（轮次 1/2）`，同一份基线自相矛盾；不改则 §3.5 t2 无法实现。
- `failed`：`index.md:150` 写 `执行失败`，`index.md:257` 写 `节点 T-005: review → failed（等待复测）`；同一份基线自相矛盾；不改则 I1.2 的“测试判定不通过”没有状态可落。
- `escalated`：I1.2 只需要“取消是唯一出口”，但基线已经写了 `done / failed / 重新分配` 三条人工裁决路径；**不需要改基线的出边**，只需要加“I1.2 只实现取消”的阶段注。

**(b) 方向准确性：`done`/`failed` 对但不完整；`escalated` 错。**

- `done` 只加“下游驳回可回流唤醒”不够：还要改“终态”和“下游接受”这个进入条件。
- `failed` 只加“含测试判定不通过”不够：还要改“执行失败”这个标签，并补 `failed_reason: verdict_fail`。
- `escalated` 不能把出边改成“人工裁决 → cancelled”；这等于把 I1.4 的 `orch escalate resolve` 三条路径删掉。

**(c) before / after**

before（`docs/index.md:149-151`）：

```text
| `done` | 验收通过 | 证据校验通过 + 下游接受 | 终态 |
| `failed` | 执行失败 | 会话崩溃 / 证据缺失 / 契约不满足 | 回流到 running 或升级 |
| `escalated` | 升级人工 | 轮次超限 / 依赖死锁 / 连续失败 | 人工裁决后 → done / failed / 重新分配 |
```

after（可直接替换）：

```text
| `done` | 本轮验收通过（可被下游驳回重新打开） | 证据校验通过；I1.2 不等待下游接受，I1.3 起加 `review_reason: downstream` 门控 | 下游驳回 → running（仅开发节点，见 §3.5 t2）；否则终态 |
| `failed` | 本轮执行/判定未通过（含测试判定不通过） | 会话崩溃 / 证据缺失 / 契约不满足 / 测试判定不通过（`code-loop`，`failed_reason: verdict_fail`） | 回流到 running 或升级 |
| `escalated` | 升级人工 | 轮次超限 / 依赖死锁 / 连续失败 / 派发失败 / 核对失败 | 人工裁决后 → done / failed / 重新分配；取消 → cancelled（I1.2 仅实现取消，裁决入口在 I1.4） |
```

**改后自洽性：**

- `done` 的“下游驳回 → running”与 §3.5 t2 一致；`I1.3 起加 downstream` 与 §3.1 的 `review_reason` 表一致。
- `failed` 的 `verdict_fail` 与 §3.5 t2 一致；`single` 的执行失败仍走原语义。
- `escalated` 保留三条裁决路径，与 I1.4 `orch escalate resolve` 一致；只加“取消”这条，与 AC-42 一致。
- 注意：M-1 是 I1.1 **代码表**的修改（`escalated: ['cancelled']`），不是基线表的修改。需求应把这两层分开写，否则实施者会拿 M-1 去改 `docs/index.md`。

#### 3.2.2 ② §3.1 节点迁移图补 10 条边

**(a) 是否确实需要改：是。** 基线图没有 `done→running`，也没有取消从 `review/failed/escalated` 收掉的边；I1.2 需要这些边。

**(b) 方向准确性：错，且是本次评审最重要的错。**

需求列的 10 条是：

`pending→escalated`、`running→escalated`、`review→escalated`、`review→cancelled`、`done→running`、`done→escalated`、`failed→running`、`failed→escalated`、`failed→cancelled`、`escalated→cancelled`（`requirement.md:161`）。

把它和基线 `docs/index.md:133-140` 对照：

- **基线已经有**：`review→escalated`（`index.md:138`）、`failed→running`（`index.md:136`）、`failed→escalated`（`index.md:137`）。这 3 条不是“补”，是重复。
- **`pending` 不是基线状态**：基线是 9 态 `blocked/ready/assigned/running/review/done/failed/escalated/cancelled`（`index.md:129-152`）；`pending` 是 I1.1 把 `blocked + ready` 合并后的 7 态表中的状态（`iteration-1.md:236`、`:421`）。把 `pending→escalated` 写进基线，等于把实现态混进基线态。
- **基线 9 态真正需要新增的是 7 条**：`ready→escalated`（首派建会话失败，对应 I1.1 的 `pending→escalated`）、`running→escalated`（code-loop 宿主报错/会话中途失效）、`done→running`（仅开发，下游驳回）、`done→escalated`（回流派发失败）、`review→cancelled`、`failed→cancelled`、`escalated→cancelled`。

**(c) before / after**

before（`docs/index.md:133-140`）：

```text
blocked → ready → assigned → running → review → done
                    │           │        │
                    │           │        ├→ failed → running（回流）
                    │           │        │         └→ escalated
                    │           │        └→ escalated
                    └→ cancelled（终态，折叠显示）
```

after（保留原图，在图下补一段“增补边”；不要重画整张 ASCII）：

```text
blocked → ready → assigned → running → review → done
                    │           │        │
                    │           │        ├→ failed → running（回流）
                    │           │        │         └→ escalated
                    │           │        └→ escalated
                    └→ cancelled（终态，折叠显示）

**I1.2 增补边（基线 9 态口径，共 7 条）**：`ready→escalated`（首派建会话失败）、`running→escalated`（`code-loop` 宿主报错/会话中途失效）、`done→running`（仅开发，下游驳回回流）、`done→escalated`（回流派发失败）、`review→cancelled`、`failed→cancelled`、`escalated→cancelled`。
`review→escalated`、`failed→running`、`failed→escalated` 已在本图，不重复添加；`pending` 是 I1.1 的合并显示态（`blocked + ready`），不是基线状态。
```

**改后自洽性：**

- 7 条边与 §3.1 表的 `done` / `failed` / `escalated` 行一致；`ready→escalated` 对应 I1.1 的 `pending→escalated`，`running→escalated` 对应 code-loop 的 `execution_failed`。
- 与 `index.md:160` 的 7 列表一致：`done` 仍归 done 列，`cancelled` 仍归 done 列折叠区；只是 `done` 卡片可回 running，不新增列。
- 与 §3.5 t2 的 `done→running` 一致；与 AC-42 的 `escalated→cancelled` 一致。
- 需求侧 M-1 的 10 条边保留为“I1.1 7 态表的增量”即可，但必须加一句“这 10 条不是基线 9 态的增量，基线对应 7 条”。否则实施者会把两套边表混用。

#### 3.2.3 ③ §3.4 补 `created→rejected`

**(a) 是否确实需要改：是。** 取消可能发生在“已构造、未投递”；没有 `created→rejected`，AC-37 的 `state='rejected'` 不成立。

**(b) 方向准确性：边对，但 `rejected` 行的语义不完整。** 基线 `rejected` 的触发是“目标会话拒绝”（`index.md:236`），而 `created` 时还没有目标会话；需求把它用于“取消撤回”，这是第二种语义。只加边不改行，交接包表会自相矛盾。

**(c) before / after**

before（`docs/index.md:222-227`、`:236`）：

```text
created → delivered → accepted → consumed
              │           │
              │           └→ rejected
              └→ pending → expired
```

```text
| `rejected` | 目标会话拒绝 | 触发回流或升级 |
```

after：

```text
created → delivered → accepted → consumed
   │          │           │
   │          │           └→ rejected（目标拒绝 / 取消撤回）
   │          └→ pending → expired
   └→ rejected（取消撤回）
```

```text
| `rejected` | 目标会话拒绝；或取消时撤回（`rejectReason: withdrawn`） | 触发回流或升级；取消撤回不触发回流/升级 |
```

**改后自洽性：**

- `created→rejected` 只在取消时发生，`rejectReason='withdrawn'`；与 AC-37 一致。
- 与 §3.4 “7 个状态”不冲突：没有新增状态，只新增一条边和一种触发原因。
- 与能力域 4 的聚合状态有冲突：`index.md:387` 的 `rejected` 聚合会把“撤回”画成红色回流箭头。需要同步排除 `withdrawn`（见 §4.8）。

#### 3.2.4 ④ §3.6 加 `suspended` 行

**(a) 是否确实需要改：是。** 基线 §3.6 的恢复表没有实例级 `suspended`；如果不写，读者可能把 `running` 的“不可恢复 → assigned”套到挂起实例上，或者把挂起当“中断”。

**(b) 方向准确性：对，但不完整。** 只加 `suspended` 还不够：`review` 的“等待核心重新校验”（`index.md:281`）、`running` 的“不可恢复 → assigned”（`index.md:279`）都与 I1.2 的实际行为冲突；`escalated` 节点也没有恢复行。

**(c) before / after**

before（`docs/index.md:276-284`）：

```text
| 恢复时状态 | 恢复后状态 | 条件 |
|---|---|---|
| `running` + 会话可恢复（`session/resume` 成功） | 保持 `running` | 会话继续执行 |
| `running` + 会话不可恢复 | `assigned` | 重新分配会话，从当前轮次重试 |
| `assigned` | `assigned` | 重新调度 |
| `review` | `review` | 等待核心重新校验 |
| `blocked` / `ready` | 原状态 | 依赖关系不变 |
| 角色实例 `busy` + 会话不可恢复 | `available` | 重新调度其服务节点 |
| 交接包 `delivered` 未 `accepted` | `pending` | 重投 |
```

after（在原表后加 3 行 + 1 段阶段注）：

```text
| 恢复时状态 | 恢复后状态 | 条件 |
|---|---|---|
| `running` + 会话可恢复（`session/resume` 成功） | 保持 `running` | 会话继续执行 |
| `running` + 会话不可恢复 | `assigned` | 重新分配会话，从当前轮次重试 |
| `assigned` | `assigned` | 重新调度 |
| `review` | `review` | 等待核心重新校验 |
| `blocked` / `ready` | 原状态 | 依赖关系不变 |
| 角色实例 `busy` + 会话不可恢复 | `available` | 重新调度其服务节点 |
| 交接包 `delivered` 未 `accepted` | `pending` | 重投 |
| 实例 `suspended` | 保持 `suspended` | 有待处理升级，不判 `interrupted`、不重派 |
| 节点 `escalated` | `escalated` | 待人工，不重派；I1.2 唯一出口是取消 |
| 节点 `failed`（`code-loop`） | `failed` | 等待复测/升级，不自动重跑 |

> **阶段适用**：I1.2 不实现 `session/resume` 与自动重校。`running` 核心消失按 `interrupted` 处理；`review` 不自动重新校验；上表 `assigned` / 重新校验 行自 I1.8 起生效。
```

**改后自洽性：**

- `suspended` 行与 AC-10“core stop 后仍已挂起”一致；`escalated` 行与 AC-10/AC-36 一致；`failed` 行与 AC-36 一致。
- 阶段注与 §2.5“重启后按运行中核心消失判已中断”（`requirement.md:350`）一致，也不删掉 I1.8 的未来规则。
- 但 §3.6 的 `running + 可恢复 → 保持 running` 与 I1.2 的“无恢复方言”仍冲突；阶段注必须明确“I1.2 不适用这两行”，否则读者仍会误解。

#### 3.2.5 ⑤ §3.4 `consumed` 语义

**(a) 是否确实需要改：是。** 基线 `consumed` 的进入条件是“目标节点产出提交”（`index.md:235`），但 §3.5 t4 在两边都 `done` 后才写 `accepted → consumed`；AC-41 又要求测试判定为 fail、节点 `escalated` 时 `HO-003` 仍为 `consumed`。基线的一句话无法同时满足。

**(b) 方向准确性：对，但漏了 `index.md:239`。** 只改 row，不改“`consumed` 才表示目标节点已完成”，AC-41 的 `consumed + escalated` 仍会被判为矛盾。

**(c) before / after**

before（`docs/index.md:235`、`:239`）：

```text
| `consumed` | 目标节点产出提交 | 交接包被消费完毕 |
```

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 才表示目标节点已完成。连接线“已完成”条件是所有交接包均为 `consumed`。
```

after：

```text
| `consumed` | 目标节点本轮产出核对通过（不等于测试判定通过） | 交接包被消费完毕 |
```

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 表示目标节点本轮产出已核对完毕；判定不通过时节点可为 `failed` / `escalated`，因此 `consumed` 不等于节点 `done`。连接线“已完成”条件是所有交接包均为 `consumed`。
```

**改后自洽性：**

- 与 §3.5 t4 的 `accepted → consumed`（两边 done 后）一致；与 AC-41 的 `HO-003 consumed`（测试节点 escalated）一致；与 B-07“因上限停止不改 rejected”一致。
- 与 `index.md:392` 的连接线 `consumed` 视觉一致：连接线“已完成”仍看全部 `consumed`，但不再暗示节点 `done`。
- 与 §3.4 `consumed` 的“目标节点产出提交”原义有偏差：原义是“提交”，新义是“核对通过”。这是必要的语义修正，必须在基线里写清楚，否则 I1.10a 会把“测试失败但产出合法”的连接线画成绿色“已完成”，而节点是红色“已升级”。

#### 3.2.6 ⑥ I1.2 条目补 R-1

**(a) 是否确实需要改：条件必须。** 只有 B-06 选择“三节点”时才需要；如果选择“两节点”，基线原文不动。

**(b) 方向准确性：条件对；未裁决前不应改。** 需求自己也写 `**待使用者确认**；未确认前 T-003 保持可裁剪`（`requirement.md:155`），所以不能把 R-1 当成已定事实写进基线。

**(c) before / after**

before（`docs/index.md:670-671`）：

```text
- 内置角色：开发、测试、协调者
- 编码闭环模板：开发 → 测试 → 缺陷回流 → 轮次上限 → 升级
```

after（仅在 B-06 = 三节点时插入；两节点则保持原文）：

```text
- 内置角色：开发、测试、协调者
- 编码闭环模板：开发 → 测试 → 缺陷回流 → 轮次上限 → 升级
- 模板含协调者汇总节点（R-1；测试通过后汇总，只汇总不裁决，产出 `out/summary.md`）
```

**改后自洽性：**

- 与 §1.3.1 R-1、§2.1 协调者行、AC-03/17/30/45 一致。
- 与 I1.3 的“非编码闭环”不冲突：协调者只在编码闭环里；I1.3 的审核者是另一个角色。
- 如果 B-06 = 两节点，则不能插入这段；否则基线会比 AC 多一个节点，验收无法对齐。

#### 3.2.7 ⑦ §3.5 t2 时序

**(a) 是否确实需要改：是。** 基线 t2 先写 `HO-006: delivered → accepted`，再写 `节点 T-003: done → running`；但 `accepted` 只能由目标会话建起后的首个事件产生（`requirement.md:1487`），而目标会话正是本次唤醒派发才创建的。先 `accepted` 再 `running` 在 I1.1 的实现里不成立。

**(b) 方向准确性：对，但不完整。** 只改 t2，t3 仍是“HO-007: created → delivered → accepted”在“节点 T-005: failed → running”之前，t4 的 `consumed` 也没有说明“核对通过后置位”；§3.4 的 `accepted` 行还是“目标节点从 assigned 进入 running”。这三处不改，§3.5 仍然自相矛盾。

**(c) before / after**

before（`docs/index.md:254-257`）：

```text
t2  dev_1 接受交接包
    → HO-006: delivered → accepted
    → 节点 T-003: done → running（轮次 1/2）
    → 节点 T-005: review → failed（等待复测）
```

after：

```text
t2  dev_1 接受交接包
    → 节点 T-003: done → running（轮次 1/2）
    → HO-006: delivered → accepted（目标会话首个事件后置位）
    → 节点 T-005: review → failed（等待复测）
```

同时改 t3 / t4（`docs/index.md:259-271`）：

before（t3 片段）：

```text
    → 构造 HO-007（复测指令）
    → HO-007: created → delivered → accepted
    → 节点 T-005: failed → running（复测）
```

after：

```text
    → 构造 HO-007（复测指令）
    → HO-007: created → delivered
    → 节点 T-005: failed → running（复测）
    → HO-007: delivered → accepted（目标会话首个事件后置位）
```

before（t4 片段）：

```text
    → HO-006 / HO-007: accepted → consumed
```

after：

```text
    → HO-006 / HO-007: accepted → consumed（目标节点本轮产出核对通过后置位）
```

**改后自洽性：**

- 与 §3.4 `accepted` 行需要同步改：`| \`accepted\` | 目标会话首个事件已到达（已开始工作） | 目标节点已进入 \`running\` 后的首个 turn 内事件 |`。否则 §3.4 仍说“目标节点从 assigned 进入 running”，与 t2 反着。
- 与 I1.1 的 `turn.first_event` 一致（`iteration-1.md:853` 的 `reason:'turn.first_event'`）。
- 与 D-2 的幂等写法一致：唤醒时只写 `wakeConsumedAt`，交接包状态保持 `created/delivered`；`accepted` 由首个事件置位。
- 与 §3.5 t4 的 `consumed` 一致：先 `review → done`，再 `accepted → consumed`。

#### 3.2.8 ⑧ §3.2 `waiting_dependency` 显示词

**(a) 是否确实需要改：不必。** 基线的“等待校验”正好对应 I1.2 的“节点已出料、核心在核对”阶段；改掉反而失去 `review_reason: downstream` 的词位。

**(b) 方向准确性：错。** 见 §2.2.3。需求把“证据核对”叫“等待下游”，把“下游接受”这个词提前占用了。

**(c) before / after**

before（`docs/index.md:174`，保持不动）：

```text
| `waiting_dependency` | 已产出，等待下游或证据校验 | 黄色圆点，显示“等待校验” |
```

after（**建议不改基线**；改需求侧）：

- `requirement.md:508` BR-28：

```text
before: | **BR-28** | 节点已出料、正在核对时，会话显示 `等待下游`，不显示 `执行中` | `status` 里同时看到 `节点 … 待校验` 与 `会话 等待下游` |
after:  | **BR-28** | 节点已出料、正在核对时，会话显示 `等待校验`，不显示 `执行中` | `status` 里同时看到 `节点 … 待校验` 与 `会话 等待校验` |
```

- `requirement.md:270`：

```text
before: **`等待下游` 表示节点已出料、正在被核对**（节点此时是 `待校验`），与 `执行中` 不是一回事（AC-44）。
after:  **`等待校验` 表示节点已出料、正在被核对**（节点此时是 `待校验`），与 `执行中` 不是一回事（AC-44）。
```

- AC-44 标题与 Then：

```text
before: #### AC-44 核对期间会话显示"等待下游"
after:  #### AC-44 核对期间会话显示"等待校验"
before: And 输出含独立行"会话 等待下游"
after:  And 输出含独立行"会话 等待校验"
```

- `requirement.md:145`（§1.3.1 的验收面取舍注）里“等待下游”同步改“等待校验”；`requirement.md:177` 八处⑧整条删除，或改为“R-4 不成立：保留基线‘等待校验’”。

**改后自洽性：**

- 基线 §3.2 的 6 个会话状态显示词不变；I1.3 的 `review_reason: downstream` 仍可占用“等待下游”。
- AC-44 仍能区分“执行中”与“等待校验”，只是词更准确。
- 如果产品坚持“等待下游”这个 UI 词，就必须在基线里把 `review_reason: downstream` 改名为“等待接受”，否则两个阶段重名。**不建议**，因为会牵连 §3.1、§3.4、能力域 4 的连接线文案。

---

## 4. 漏掉的基线修订点

以下 10 处是需求“八处”之外、但按 I1.2 的实际行为必须处理（或必须加阶段注）的基线冲突。只列有实质冲突的；纯文字润色不列。

### 4.1 §3.6 的 `review` / `running` 恢复规则

**冲突：**

- `index.md:281`：`| \`review\` | \`review\` | 等待核心重新校验 |`
- `index.md:278-279`：`running + 会话可恢复 → 保持 running`；`running + 会话不可恢复 → assigned`
- 需求 `requirement.md:350`：`重启后按"运行中核心消失"判 已中断`
- 需求 `requirement.md:354`：`不自动重新核对（"核心消失后重新核对"是 I1.8）`

**before（原文）：**

```text
| `running` + 会话可恢复（`session/resume` 成功） | 保持 `running` | 会话继续执行 |
| `running` + 会话不可恢复 | `assigned` | 重新分配会话，从当前轮次重试 |
| `review` | `review` | 等待核心重新校验 |
```

**after（加阶段注，不删未来规则）：**

```text
| `running` + 会话可恢复（`session/resume` 成功） | 保持 `running` | 会话继续执行 |
| `running` + 会话不可恢复 | `assigned` | 重新分配会话，从当前轮次重试 |
| `review` | `review` | 等待核心重新校验 |

> **阶段适用（I1.2）**：I1.2 不实现 `session/resume` 与自动重校；`running` 核心消失按 `interrupted` 处理，`review` 不自动重新校验。上表 `assigned` / 重新校验 行自 I1.8 起生效。
```

### 4.2 §3.6 缺 `escalated` 节点恢复行

**冲突：** I1.2 升级后实例 `suspended`，节点 `escalated`；重启后必须保持（AC-10/AC-36）。§3.6 没有 `escalated` 行，读者只能类推到 `running→assigned`，会错误重派。

**before（原文）：** 同 §4.1 的表，无 `escalated` 行。

**after：** 加一行：

```text
| 节点 `escalated` | `escalated` | 待人工，不重派；I1.2 唯一出口是取消 |
```

### 4.3 §3.4 `accepted` 行的触发条件

**冲突：**

- `index.md:234`：`| \`accepted\` | 目标会话已接受 | 目标节点从 \`assigned\` 进入 \`running\` |`
- 需求 `requirement.md:1487`：`accepted 由目标会话建起后的首个事件置位`
- 需求 `requirement.md:176`：`目标节点先 running、交接包后 accepted`

**before（原文）：**

```text
| `accepted` | 目标会话已接受 | 目标节点从 `assigned` 进入 `running` |
```

**after：**

```text
| `accepted` | 目标会话首个事件已到达（已开始工作） | 目标节点已进入 `running` 后的首个 turn 内事件 |
```

### 4.4 §3.4 `index.md:239` 的“consumed 才表示目标节点已完成”

**冲突：** AC-41 的 `HO-003` 在测试判定 fail、节点 `escalated` 时仍为 `consumed`；基线这句话会把 AC-41 判成矛盾。

**before（原文）：**

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 才表示目标节点已完成。连接线“已完成”条件是所有交接包均为 `consumed`。
```

**after：**

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 表示目标节点本轮产出已核对完毕；判定不通过时节点可为 `failed` / `escalated`，因此 `consumed` 不等于节点 `done`。连接线“已完成”条件是所有交接包均为 `consumed`。
```

### 4.5 §3.5 t1 的 `cooldown → thinking`

**冲突：**

- `index.md:252`：`→ 目标会话 dev_1: cooldown → thinking`
- 需求 `requirement.md:1419`：`B-05 ... 基线 §3.5 的 cooldown → thinking 本迭代不实现`
- I1.2 的会话状态只有 6 个（`idle/thinking/tool_running/waiting_input/waiting_dependency/escalated`，`index.md:168-175`），没有 `cooldown`；`cooldown` 是角色状态（`index.md:198`），在 I1.5。

**before（原文）：**

```text
t1  核心构造交接包 HO-006（缺陷引用 + 复测命令）
    → HO-006: created → delivered
    → 目标会话 dev_1: cooldown → thinking
```

**after：**

```text
t1  核心构造交接包 HO-006（缺陷引用 + 复测命令）
    → HO-006: created → delivered
    → 目标会话 dev_1: idle → thinking（I1.2 每次派发新会话；cooldown 角色态在 I1.5，复用唤醒在 I1.8）
```

### 4.6 能力域 4 的“向空闲会话发起新 turn”与“失败重试/pending”

**冲突：**

- `index.md:356`：`- **主动唤醒投递**：适配器调用 \`session/prompt\` 向空闲会话发起新 turn`
- `index.md:358`：`- **交接可靠性**：唤醒消息先落盘再投递；失败重试；宿主不在线时消息保持 \`pending\``
- 需求 `requirement.md:490`：`每次派发都是新会话`
- 需求 §1.3 范围外：`持久化信箱与重投、\`pending\` / \`expired\` | I1.4`（`requirement.md:110`）

**before（原文）：**

```text
- **主动唤醒投递**：适配器调用 `session/prompt` 向空闲会话发起新 turn
- **交接可靠性**：唤醒消息先落盘再投递；失败重试；宿主不在线时消息保持 `pending`
```

**after：**

```text
- **主动唤醒投递**：适配器调用 `session/prompt` 向目标会话发起新 turn；I1.2 每次派发新建会话（fresh），空闲会话复用与 `cooldown` 在 I1.8。
- **交接可靠性**：唤醒消息先落盘再投递；I1.2 只保证落盘 + 一次投递，失败重试与 `pending` 在 I1.4。
```

### 4.7 §5.2 数据布局的 `state/` 与 `schemaVersion: 2`

**冲突：**

- `index.md:595`：`│   ├── state/                         # 节点状态、轮次、检查点、角色实例、连接线聚合、traces.jsonl`
- 需求 M-3：`state.json`、`schemaVersion: 2`（`requirement.md:163`）
- I1.1 实际：`.orch/instances/<id>/state.json` + `events.jsonl`（`iteration-1.md:212`）
- 基线没有 `schemaVersion` 概念；I1.2 的 v1 只读、v2 写入完全依赖它。

**before（原文，`index.md:591-597`）：**

```text
├── instances/<id>/
│   ├── workspace/
│   │   ├── shared/  stage/  status.md
│   │   └── artifacts/{code,docs,data,reports}/
│   ├── state/                         # 节点状态、轮次、检查点、角色实例、连接线聚合、traces.jsonl
│   └── graph.json                     # 角色流程图数据快照
```

**after：**

```text
├── instances/<id>/
│   ├── workspace/
│   │   ├── shared/  stage/  status.md
│   │   └── artifacts/{code,docs,data,reports}/
│   ├── state.json                     # 实例/节点/会话/交接包/升级快照，schemaVersion:2（I1.2 起）
│   ├── events.jsonl                   # 事件日志（I1.1 起；链式哈希在 I1.12）
│   └── graph.json                     # 角色流程图数据快照（I1.10a）
```

> 如果不想在基线里改目录名，至少加一句：“阶段一实际布局为 `state.json` + `events.jsonl`；`state/` 是概念目录，I1.9/I1.10a 再拆分。”否则每个迭代都要重新解释一次。

### 4.8 能力域 4 的 `rejected` 聚合包含 `withdrawn`

**冲突：**

- `index.md:387`：`| \`rejected\` | 任一交接包 \`rejected\` | 红色实线 + 回流箭头 |`
- 需求取消写 `rejected` + `rejectReason='withdrawn'`（`requirement.md:460`、`:1556`）
- 取消是正常操作，不是“目标拒绝”异常；I1.10a 会把它画成红色回流箭头。

**before（原文）：**

```text
| `rejected` | 任一交接包 `rejected` | 红色实线 + 回流箭头 |
```

**after：**

```text
| `rejected` | 任一交接包 `rejected` 且 `rejectReason !== 'withdrawn'` | 红色实线 + 回流箭头 |
| `not_started` | 角色对已定义但无交接包，或仅有 `withdrawn` 的交接包 | 灰色虚线（默认隐藏，开关显示） |
```

### 4.9 §3.2 审批放行的会话映射

**冲突：** 基线 `index.md:184` 只写 `session/request_permission → waiting_input`，没有写应答后回 `thinking`；I1.1 已有 `onPermissionSettled`（`src/adapter/session-state.js:210-216`），需求 D-6 也补了 `waiting_input→thinking`（`requirement.md:1196`）。基线不补，读者会以为审批放行后会话一直停在 `waiting_input`。

**before（原文，`index.md:184`）：**

```text
| `session/request_permission` | `waiting_input` |
```

**after：**

```text
| `session/request_permission` | `waiting_input` |
| 审批应答 `allow` | `thinking` |
| 审批应答 `deny` | `idle` |
```

### 4.10 §3.1 `failed_reason` 与 `escalated` 进入条件

**冲突：**

- `index.md:158`：`**超时归入 \`failed\` 的子类型**（\`failed_reason: timeout\`），不新增独立状态。`
- 需求 `failed` 又承担“测试判定不通过”（`requirement.md:266`），但没有 `verdict_fail` 子类型。
- 需求 D-5 新增 `dispatch_failed` / `verdict_*` / `artifact_*` / `execution_failed`（`requirement.md:1560-1572`），基线 `escalated` 进入条件只列了 `轮次超限 / 依赖死锁 / 连续失败`（`index.md:151`）。

**before（原文，`index.md:158`、`:151`）：**

```text
**超时归入 `failed` 的子类型**（`failed_reason: timeout`），不新增独立状态。理由：超时和失败在编排语义上都是“本次执行未成功”，区别只在重试策略。
```

```text
| `escalated` | 升级人工 | 轮次超限 / 依赖死锁 / 连续失败 | 人工裁决后 → done / failed / 重新分配 |
```

**after：**

```text
**`failed` 的子类型**：`timeout`（超时）、`verdict_fail`（测试判定不通过，`code-loop`），不新增独立状态。理由：两者在编排语义上都是“本次执行未成功”，区别只在重试策略。
```

```text
| `escalated` | 升级人工 | 轮次超限 / 依赖死锁 / 连续失败 / 派发失败 / 核对失败（`verdict_*` / `artifact_*`） | 人工裁决后 → done / failed / 重新分配；取消 → cancelled（I1.2 仅实现取消） |
```

---

## 5. 未决项裁决建议（B-01~B-21）

### 5.1 三类分类

| # | 分类 | 建议裁决 | 不裁决的后果 |
|---|---|---|---|
| B-01 | **待使用者确认** | 接受“代码内置常量”，但要求角色 ID 用 I1.5 的最终 ID、图数据放 `src/templates/**` | 若要求本迭代做注册表，会与 I1.5 重复；若不先定 ID，I1.5 改名会牵动 AC/夹具 |
| B-02 | **待使用者确认** | 接受“节点时序以 §3.5 为准”，但基线修订按 §3 的 before/after 改，不照抄 M-1 的 10 条边 | 基线三处自相矛盾留到 I1.3，每个迭代重新裁定 |
| B-03 | **假设待评审** | 接受“图内置提示词保证判定/汇总”，但必须加真实面验证（见 B-11） | 提示词没生效时，真实面全部升级，I1.2 看起来“不可用” |
| B-04 | 已定可执行 | 维持“坏判定一律升级，不回流” | 拿坏数据打回开发，回流内容不可信 |
| B-05 | 已定可执行 | 维持“每次派发新会话”，在基线加 §3.5 t1 注 | 与会话复用语义混淆；I1.8 才能补 |
| B-06 | **待使用者确认** | **默认两节点**；协调者只定义不派发，汇总留 I1.3/I1.6（详见 §5.3） | AC-01/02/03/04/06/11/17/30/42/45 与 A-2/A-3 不稳定 |
| B-07 | 已定可执行 | 维持“上限停止不改 `rejected`”，但基线 §3.4 `consumed` 语义要改（§3.2.5） | I1.10a 会把失败轮次画成绿色“已完成” |
| B-08 | 已定可执行 | 维持“挂起唯一出路是取消”，I1.4 补 `resolve` | 产品死路，但已文档化 |
| B-09 | 已定可执行 | 维持 `schemaVersion:2` + v1 只读，不做迁移 | 旧实例不可查，或启动对账把旧实例改坏 |
| B-10 | **假设待评审** | 接受“核心不校验测试命令真跑过”，把真实性留给 I1.3 | 测试造假拦不住；但这不是 I1.2 的验收点 |
| B-11 | **待使用者确认** | **不接受“真实面只成功闭环”**；补 `demo-code-fail` 真实失败闭环（详见 §5.4） | 规划验收点只有夹具证据；真实宿主 verdict/回流 bug 可能漏过 |
| B-12 | 已定可执行 | 维持 `--template` 缺省不启用 | 改默认会破坏 I1.1 调用与 AC |
| B-13 | **待使用者确认** | 登记“I1.2 先占最小形态，I1.4 补全并保持兼容”（详见 §6.1） | I1.4 可能重定义参数，破坏 I1.2 |
| B-14 | 已定可执行 | 维持“同目录只允许一个未结束 `code-loop`” | 两个闭环互相覆盖产物 |
| B-15 | 已定可执行 | 维持“`MAESTRO_*` 仅 `NODE_ENV=test` 生效” | 生产误设导致写失败/卡住 |
| B-16 | 已定可执行 | 维持全角冒号式文案 | 与 I1.1 `ERROR_TEMPLATE` 冲突，回归红 |
| B-17 | 已定可执行 | 维持四类观测，但明确这是对模板“用户可见”约束的例外 | AC 只能写“看起来对”，无法机检 |
| B-18 | 已定可执行 | 维持 `run` 在挂起/停止推进时自己结束（4/5） | 卡 30 分钟报“未知错误” |
| B-19 | 已定可执行 | 维持 `run` 只流式打印会话行 | 与 I1.1 实际输出冲突 |
| B-20 | 已定可执行 | 维持 `--host` 仅夹具；建议改成 test-only 环境变量 | 产品用户误用未支持参数；I1.4 兼容负担 |
| B-21 | 已定可执行 | 维持“旧格式只读 + `suspended` 可取消” | 旧实例不可查，挂起成死路 |

### 5.2 必须由使用者拍板的 5 项

**B-01（代码常量）**：建议接受。理由：规划 I1.2 只说“内置角色”，没有要求 `roles/*.yaml`；I1.5 才是注册表。后果：若要求本迭代做注册表，范围翻倍，且与 I1.5 重复。需要使用者确认的只是“角色 ID 是否现在就用 I1.5 的最终 ID”，以免 I1.5 改名。

**B-02（基线口径）**：建议接受“§3.5 优先”，但必须按 §3 的 before/after 改，而不是照抄 M-1 的 10 条边。理由：§3.1 是 9 态表，I1.1 是 7 态表，两套编号不能混。后果：不确认则基线仍是三处自相矛盾，I1.3 起每个迭代都要重新裁定。

**B-06（协调者）**：建议**两节点**。理由见 §5.3。后果：不裁决则 AC 集、A-2/A-3、基线⑥都不稳定，实施可能建错图。

**B-11（验收面）**：建议**补真实失败闭环**。理由见 §5.4。后果：不补则规划验收点只有 mock 证据，真实宿主上的 verdict 读取/回流/升级没有证据。

**B-13（`--template` 归属）**：建议按 §6.1 登记。理由：I1.4 的验收明确包含“CLI 核心命令集”，不登记就会两边各定义一次。后果：I1.4 可能改参数/输出，破坏 I1.2 的 AC。

### 5.3 B-06 专项：协调者进图（三节点）还是严格两节点

**从“规划符合性”看，两节点更贴近 `docs/index.md` 的 I1.2 原文。** 理由：

1. 规划 I1.2 的模板原文是 `- 编码闭环模板：开发 → 测试 → 缺陷回流 → 轮次上限 → 升级`（`index.md:671`）。序列里没有协调者。
2. `- 内置角色：开发、测试、协调者`（`index.md:670`）只说明“内置角色库里有这三个角色”，不等于“这张图有三个节点”。角色是资产，节点是编排单位，基线自己在 §3.3 就区分了“角色注册表”和“角色实例”（`index.md:191`）。
3. 规划的验收原文只提“测试第 2 轮失败 → 停止回流、生成升级、实例挂起”（`index.md:675`），没有“汇总”这一步。三节点会新增 `out/summary.md`、第四张交接包、成功路径的额外 AC，这些都不在 I1.2 原文里。
4. 需求自己的理由“一个内置角色如果没有执行面，就只剩一个名字”（`requirement.md:151`）是产品完整性理由，不是规划符合性理由；I1.5 的角色注册表验收是“`orch role list` 列出全部角色；引用不存在的技能时加载被拒绝；角色实例能记录活跃会话和服务节点”（`index.md:718`），不需要 I1.2 先派发协调者。

**建议裁决：两节点。** 协调者角色在 §2.1 保留定义（职责、产物模板可以留作 I1.5 的资产），但不进 `code-loop` 图、不派发、不产生 `out/summary.md`。如果业务确实需要“测试通过后的汇总”，放到 I1.3 的审核角色（非编码闭环本来就有审核者）或 I1.6 的 `human`/汇总节点。

**如果使用者坚持三节点**，需求自己的删除清单还不够，必须同时改：

- 删 AC-03 / AC-17 / AC-30 / AC-45（需求已列）。
- 改写 AC-01 / AC-02 / AC-04 / AC-06 / AC-11 / AC-42（需求已列）。
- **需求未列但必须改**：§2.1 协调者行（`:201`）、§2.2“三节点”（`:187`、`:213`）、§2.8 第 8 步（`:475`）、BR-01（`:481`）、BR-14（`:494`）、D-7 的 `out/summary.md` 行（`:1204`）、§1.3.1 表里对 AC-03/AC-45 的引用（`:132`、`:136`）、A-3 的“三行节点”（`:1375`）。
- 如果选两节点，则反过来：上述所有“协调者/三节点”表述都要删，AC-41 的 3 张交接包不变，AC-45 删除。

**不裁决的后果**：AC 集无法冻结；实现可能先按三节点建，再按两节点改，返工最大。

### 5.4 B-11 专项：真实面只验成功闭环 + 回归，是否可接受

**结论：不可接受，至少补一条真实失败闭环。** 理由：

1. 规划 I1.2 的验收点就是失败路径：`**验收**：测试第 2 轮失败 → 核心停止回流、生成升级、实例挂起等待人工`（`index.md:675`）。只验成功闭环，等于把规划的核心验收点全部放在 mock 上。
2. 需求说“真实模型不肯稳定失败”（`requirement.md:1425`），但这个理由不够成立：`demo-code-fail/` 已经准备了“`calc.test.js` 额外断言 `div(1,0)` 应抛错”（`requirement.md:1144`）。只要任务话术只要求基本 `div`、不要求补 `div(1,0)` 边界，测试命令就会**真的失败**；测试角色不需要“选择失败”，它只要如实写 `out/verdict.json` 的 `fail` 与缺陷。若开发主动补了边界，换一个开发任务未覆盖的失败点即可（例如断言未声明的输出格式）；关键是让**命令输出**决定判定，而不是让模型自由发挥。这比“完全不做真实失败面”强得多。
3. 需求自己也承认“代价是回流、升级与取消在真实宿主上无证据”（`requirement.md:1425`）。这不是可接受的代价，因为 I1.2 的名字就是“编码闭环（开发→测试→回流→升级）”，回流与升级是主体。
4. 夹具面仍然必要：取消、`dispatch_failed`、`state_write:escalation`、`after_verdict` 这些无法在真实宿主稳定复现，继续走夹具，没问题。问题只是“真实面完全不含失败路径”。

**建议新增 AC-07R（产品命令面）：**

```gherkin
#### AC-07R 真实宿主上的第 2 轮失败 → 升级 → 挂起
- **验证面**：产品命令 ｜ **类型**：主流程 ｜ **风险**：高 ｜ **规则**：BR-05、BR-06、BR-08
Given 任务目录 demo-code-fail，calc.test.js 额外断言 div(1,0) 应抛错，任务话术只要求基本 div、不要求补该边界
When 我在项目根执行 orch run --cwd ./demo-code-fail --template code-loop --task "给 calc.js 补 div 函数…产物：calc.js"
Then 第 2 次测试判定仍为不通过，命令最终返回（不挂在 30 分钟超时），退出码 4
And 从实例进入"已挂起"到命令返回不超过 10 秒
And 输出含"实例 INST-001 · 已挂起 · 模板 编码闭环"与"升级 ESC-001 待处理"
And 机检：nodes[1].round=2、nodes[1].state='escalated'、escalations.length=1
And 机检：不存在 round=3 的节点记录
```

**不裁决的后果**：真实宿主上的 verdict 读取、回流交接包构造、升级落盘、挂起收尾都没有证据；mock 的 ACP 实现与真实 DSH 的差异（事件时序、`stopReason`、审批）可能让真实面在第 2 轮直接崩，而验收发现不了。

---

## 6. 相邻迭代边界

### 6.1 I1.2 与 I1.4 的 `--template` 归属

**冲突事实：**

- `index.md:696`：I1.4 的 `orch run` / `orch status` “最小形态已在 I1.1 交付，本迭代负责补全参数与输出格式，并保持向后兼容”。
- 需求 M-8（`requirement.md:168`）在 I1.2 新增 `--template <name>`，B-13（`:1427`）说“I1.2 先占、I1.4 补全并保持兼容”。
- 需求 §1.3 范围外（`:112`）也写了“`--template` 先占最小形态，I1.4 补全并保持向后兼容（同 I1.1 的 B-5 处理方式）”。

**判断：需要在基线上登记。** 这不是“越界”，而是“参数归属”必须写清楚，否则 I1.4 会以为 `--template` 是自己的新参数，重新定义输出/缺省值，破坏 I1.2。

**登记文本（建议加到 `docs/index.md` I1.2 条目）：**

```text
- CLI 入口：`orch run --template code-loop`（最小形态；完整参数族与输出格式在 I1.4 补全，且保持本迭代调用方式、退出码与输出段序兼容）
```

**登记文本（建议加到 `docs/index.md` I1.4 条目，`index.md:696` 之后）：**

```text
> 参数归属：I1.2 已先占 `--template` 的最小形态（仅 `code-loop`，缺省 `single`）；本迭代补全 `--template` 的参数族（`--format`、多实例视图等）与输出格式，必须保持 I1.2 的调用方式、退出码与输出段序兼容。I1.4 的验收应重跑 I1.2 的 AC-01 / AC-03 / AC-12。
```

**`--host` 的登记：**

```text
> `--host` 仅用于验收夹具（把核心指向 mock 宿主），不是产品参数；I1.4 若要把多宿主选择产品化，另立参数与兼容策略，不复用本迭代的 `--host` 语义。
```

**向后兼容的最低验收：** I1.4 补全参数后，`orch run --template code-loop --task "…产物：<路径>"` 的调用方式、退出码 0/4/5、A-3/A-4 的输出段序不变；I1.2 的 AC-01/03/12 重跑通过。

### 6.2 与 I1.3 的“共享同一引擎”：`createOrchestrator({ graph })` 是否足够

**结论：方向正确，但当前设计不够；I1.3 很可能仍要改核心，不是“只加图定义 + 判定适配”。**

**已看到的三层耦合（按当前 I1.1 代码）：**

1. **单节点常量**：`src/core/orchestrator.js:23-27` 有 `ROLE_ID='worker'`、`NODE_ID='T-001'`、`HANDOFF_ID='HO-001'`；`finishRun` 在第一个节点核对通过后直接把实例置 `completed`（见 `review-contract.md` 的代码核对）。M-13 只说“接受注入图”，没有明确要求删除这些常量、把完成判定改为“图中所有节点 done”。I1.3 的非编码闭环有 4 个节点，如果不先做多节点推进器，I1.3 必然改 `orchestrator.js`。
2. **判定/产物策略写死**：M-11 把 `产物：` 解析与 `out/verdict.json` 的判定放在 `verify-artifact.js` / `finishRun` 的路径里，并说“固定格式只对 `code-loop` 生效”。如果实现成 `if (template === 'code-loop')`，I1.3 的文档产物（存在 + 引用可解析 + 审核角色确认）就必须再改核心；如果实现成“按节点策略查表”，I1.3 才能只加图。
3. **`review` 子原因与 `done` 门控**：I1.3 要加 `review_reason: evidence | downstream`，而 I1.2 的 `review→done` 是无条件（D-1，`:1467`）。I1.3 要加 downstream 门控，必须改状态机/推进器；如果现在不预留 `reviewReason` 字段与门控钩子，I1.3 又要改核心。

**要让“I1.3 只加图定义 + 判定适配”成立，M-13 至少要补三句：**

```text
- 图定义包含：节点（roleId、prompt、artifactPolicy、judge）、边（from/to/kind）、轮次上限、升级原因映射；不含注册表、YAML 解析、校验器（I1.6）。
- 核心删除 `ROLE_ID` / `NODE_ID` / `HANDOFF_ID` 常量；节点/交接包编号由图与计数器生成；实例完成由“图中所有节点 done”判定。
- 判定与产物核对按节点 `judge` / `artifactPolicy` 查表调用，核心不得出现 `if (template === 'code-loop')`；`review` 预留 `reviewReason` 字段，`done` 的门控由图的边策略决定。
```

**隐含的编码耦合（需要写进拆分文档的风险）：**

- `verify-artifact.js` 的 `extractDeclaredArtifacts` 目前是“中文引导词 + 裸 token”的启发式（见 `review-contract.md` 对 `src/core/verify-artifact.js` 的核对），不是按图策略；如果 I1.2 只在它里面加一个 `code-loop` 分支，I1.3 会复制这段分支。
- `applyCancel` 目前只处理单对象；M-3 的数组化会改它，但 I1.3 的取消语义（文档产物、审核节点）可能还要加规则；如果 I1.2 把“取消”写成“遍历四数组 + 固定规则”，I1.3 需要再扩展。
- `escalations[]` 的 `reasonCode` 是字符串；I1.3 会新增原因码。如果 I1.2 在 D-5 把原因码写死成枚举，I1.3 要改枚举；建议把原因码定义为图数据的一部分，核心只存字符串。

**判断：** `createOrchestrator({graph})` 是必要条件，不是充分条件。需求 §1.3 第 7 条“I1.3 只加图定义与判定适配”目前是**承诺**，不是**可验证的契约**；AC-28 只证明“核心目录没有四个字面量 + 假图能跑”，不证明“判定/产物策略可插拔”。建议在 AC-28 增加一条：**注入一张假图，节点的 `judge`/`artifactPolicy` 与 `code-loop` 不同，核心不改一行也能跑通**。否则 I1.3 的“共享同一引擎”会在实现时变成“复制一份引擎”。

---

## 7. 内部一致性

### 7.1 版本号与未提交改动

**题面说“头部写 v12 待终审”，实际文件不是。** `requirement.md:4` 逐字是：

```text
> 状态：**v13 待终审** ｜ 上游：I1.1（**开发中**；契约见 `docs/iterations/iteration-1.md` §2 / §3，实现见 `src/`）
```

附录 C 也有 v13 行（`requirement.md:1453`），所以“头部 v12 / 附录 v13”的不一致**不存在**。真正的问题是：工作区有 3 处未提交改动，均未进 v13 变更记录（`git diff` 已核对）：

1. `requirement.md:1196`：D-6 增加 `escalated→idle`（仅取消）。
2. `requirement.md:1214-1216`：driver 增加 `--cwd` / `--task` 两个参数及说明。
3. `requirement.md:1357`、`:1361`：A-2 交接包方向段改为“各 2 个空格”。

**判断：当前真实版本应是 v14，不是 v13。** 理由：v13 的变更记录（`:1453`）没有这三项；这三项都是实质性契约/输出改动，不是排版。按本文件“每轮评审后升版”的惯例，应升 v14 并补一行变更记录；如果坚持 v13，则必须把这三项写进 v13 行，否则“v13 待终审”不是干净的基线。

**建议 v14 变更记录（可直接追加到附录 C）：**

```text
| v14 | 2026-11-05 | 基线评审后修订：① 登记 3 处未入账改动（`escalated→idle`、driver `--cwd/--task`、交接包方向 2 空格）；② 基线八处②改为“基线 9 态 7 条边”，① 的 `escalated` 保留三条裁决路径，⑧ 撤回“等待下游”；③ 补 `done` 进入条件、§3.4 `accepted`/`consumed`/`rejected`、§3.6 `review/running/escalated`、§3.5 t1、§5.2 数据布局；④ B-06 / B-11 裁决登记 |
```

### 7.2 AC 编号

- 定义：`AC-01` ~ `AC-45`，**45 条，连续，无跳号、无重号**（`grep '^#### AC-'` 逐条核对）。
- 引用：全文 `AC-\d+` 的引用集合与定义集合完全相等，**没有引用不存在的 AC**，也没有“定义了但从未被引用”的 AC。
- 没有 `AC-46`。头部 `requirement.md:62` 写“AC **45 条**”，与定义一致。
- 但如果 B-06 选两节点，AC-03/17/30/45 会被删除；届时 §1.3.1 表（`:132`、`:136`）仍引用 AC-03/AC-45，会变成悬空引用。**删除时必须同步改 §1.3.1 表**（需求 B-06 的清单没列这一项）。

### 7.3 BR 编号

- 定义：`BR-01` ~ `BR-31`，**31 条，连续，无跳号、无重号**（不是题面猜的 BR-28）。
- 引用：全文 `BR-\d+` 的引用集合与定义集合完全相等，没有悬空引用。
- 但变更记录只写到 `BR-24~BR-28`（v7，`:1447`），**BR-29 / BR-30 / BR-31 的引入没有变更记录**。BR-29（`single` 回归）、BR-30（核心消失→已中断）、BR-31（唤醒门控）分别被 AC-21/22、AC-35、AC-26 引用，是实质规则，应补进 v14 的变更记录。

### 7.4 附录 A / D 编号

- `A-1` ~ `A-4`：连续，无跳号/重号；A-1 内部段 1~10，段 5/8/9/10 是 0..1，合法。
- `D-1` ~ `D-5` 在附录 D（`:1461-1574`）；`D-6` / `D-7` 在 §3.3 原地定义（`:1172` / `:1198`）；`D-8` 在附录 D（`:1576`）。**没有 D-9，没有重号**。
- **但附录 D 的编号说明自相矛盾**（`:1459`）：

```text
> 编号说明：**D-6（状态结构）与 D-7（图级产物）位于 §3.3**，原地定义以免与用户面章节割裂；本附录从 D-8 继续。
```

紧接着的下一行就是 `### D-1`（`:1461`），不是 D-8。应改为：

```text
> 编号说明：D-1~D-5 在本附录；**D-6（状态结构）与 D-7（图级产物）位于 §3.3**，原地定义；D-8 在本附录末尾。
```

- **D-6 / D-7 确实在 §3.3 原地定义**，不是只被引用；这一点题面的怀疑不成立。
- `D-8` 的表有 12 行，覆盖 `state-machine` / `labels` / `handoff-tracker` / `launch-config` / `orchestrator` / `verify-artifact` / 夹具 / `render` / `main` / `wp8` / `attempt-transition`，没有明显漏项；但 `review-contract.md` 已指出它漏了 `test/wp1/instance-store.test.js`、`test/wp5/ipc-server.test.js`、`test/wp7/wp7.test.js` 的断言（那是契约评审的范围，本文不重复展开）。

### 7.5 悬空引用 / 编号引用

- AC / BR：无悬空引用（见 §7.2 / §7.3）。
- `M-1` ~ `M-14`：定义连续，全文引用都能找到定义。
- `R-1` / `R-2` / `R-3` / `R-4`：R-1 有专节（`:147-155`）；R-2/R-3/R-4 只在 §1.3.1 开头一句里描述（`:127`），没有独立定义。R-4 在 BR-28 里有正文，R-2/R-3 只在 B-14/B-09/B-21 里出现。**不算悬空，但“R-2/R-3 是什么”需要读者自己拼**；建议在 §1.3.1 开头给三行小定义。
- `§2.3` 引用 `AC-44`、`BR-28`；`§2.4` 引用 `AC-43`；`§2.5` 引用 `BR-24/25`；都存在。
- `§1.3.1` 表的标题写“规划原文（`docs/index.md` I1.2 条目）”，但表里后三行是“能力域 2 / 4 / 6”（`:141-143`），不是 I1.2 条目。**标题以偏概全**，建议改为“规划依据（I1.2 条目 + 相关能力域）”。

### 7.6 其他内部矛盾

1. **`§2.3` 的“字段间一律单空格”与交接包样例的 2 空格冲突**：
   - `requirement.md:250`：`（与附录 A-2 完全一致，行序固定、**字段间一律单空格，不做列对齐**）`
   - `requirement.md:258-260` 样例：`交接包 HO-001  开发→测试  已构造   10:30:02`（2 空格）
   - `requirement.md:1360`：`- **不做列对齐**：字段间一律单空格（...）`
   - `requirement.md:1361`：`号与方向之间、方向与状态之间各 **2 个空格**`
   - 这三处必须统一。建议把“单空格”限定为“节点行与实例行”，交接包行按 A-2 固定 2 空格；否则 AC-04 的 `grep -c '节点 T-001 开发 已完成'`（节点行单空格）与交接包样例（2 空格）会互相打架。
2. **`§2.3` 的“六种会话行”与 D-6 的“回合结束→idle”冲突**：
   - `requirement.md:270` 六种：`空闲 / 执行中 · 已运行 / 调用工具 / 等待审批 / 等待下游 / 已升级`
   - `requirement.md:1196`：`任意→idle（回合结束、审批拒绝或取消）`
   - AC-44 的 `after_output` 是“回合结束、核对前”，要求 `会话 等待下游`；如果 D-6 的“回合结束→idle”生效，AC-44 必红。应改为“回合结束且**无产出提交**→idle；已提交产出→保持 `waiting_dependency` 到核对完成/升级/取消”。这是一条阻断项。
3. **`§2.3` 的“只显示当前（或最后一个）会话一行”与 `sessions[]` 的多会话**：`requirement.md:265` 说只显示当前/最后一个会话；`§3.3 D-6` 有 `sessions[]` 数组；AC-05 断言 `sessions` 里 T-001 有两条不同 sessionId。显示层只取最后一条是合理的，但“最后一个”是“按 `createdAt` 最大”还是“按数组末位”？D-6 没有定义排序；建议补一句“按 `createdAt` 升序，取最后一条；`sessions[]` 的持久化顺序按创建顺序”。这是一个小的可实现性缺口。
4. **`A-1` 段 10“失败摘要”与 `AC-21`**：A-1 段 10 是 `^(核对失败：.+|会话已失效，需要重新创建)$`，只在 `run` 以失败结束出现；AC-21 是成功路径，不涉及段 10，没问题。但 `A-1` 段 9“已中断提示”与段 10“失败摘要”互斥的说明在 `:1346`，而 `single` 的 `run` 失败路径是否一定走段 10？I1.1 的 `renderNodeFailure` 可能输出“执行失败：…”，不一定匹配 `核对失败：`。建议确认段 10 的正则是否覆盖 I1.1 的 `执行失败：`，否则 AC-21 的“每一行都能匹配 A-1”在失败回归时会红。这是一个待核项，不是阻断。

---

## 8. 必须修改清单（可直接执行的 before→after）

> 只列阻断项 + 必须登记的边界；每条给出可直接替换的文本。排序按“先冻结口径，再改基线，再改 AC/夹具”。

### 8.1 冻结 B-06：两节点为默认，三节点需显式批准

**before（`requirement.md:155`）：**

```text
- **授权状态**：R-1 是本文对规划的细化提案，**待使用者确认**；未确认前 T-003 保持可裁剪——删掉它不影响回流、上限、升级三条核心语义，但 AC 集与输出基线需按 B-06 同步改写。
```

**after：**

```text
- **授权状态**：R-1 是本文对规划的细化提案，**待使用者确认**。未确认前，AC 集、A-2/A-3 与 `code-loop` 图以**两节点**（开发 → 测试）为基线冻结；T-003 相关 AC/样例不得作为验收依据。确认采用三节点后，再按 B-06 的删除/改写清单一次性切换，不得边实现边改口径。
```

同时把 §1.3 范围内 1（`:92`）的“三节点（开发 → 测试 → 协调者）”改为“两节点（开发 → 测试）；协调者是否进图见 R-1/B-06”。如果最终选三节点，则保留原文并补基线⑥。

### 8.2 改回 `waiting_dependency` 显示词

**before（`requirement.md:508`）：**

```text
| **BR-28** | 节点已出料、正在核对时，会话显示 `等待下游`，不显示 `执行中` | `status` 里同时看到 `节点 … 待校验` 与 `会话 等待下游` |
```

**after：**

```text
| **BR-28** | 节点已出料、正在核对时，会话显示 `等待校验`，不显示 `执行中` | `status` 里同时看到 `节点 … 待校验` 与 `会话 等待校验` |
```

**before（`requirement.md:270`）：**

```text
**`等待下游` 表示节点已出料、正在被核对**（节点此时是 `待校验`），与 `执行中` 不是一回事（AC-44）。
```

**after：**

```text
**`等待校验` 表示节点已出料、正在被核对**（节点此时是 `待校验`），与 `执行中` 不是一回事（AC-44）。
```

**before（`requirement.md:1078-1086`）：**

```text
#### AC-44 核对期间会话显示"等待下游"
...
And 输出含独立行"会话 等待下游"
```

**after：**

```text
#### AC-44 核对期间会话显示"等待校验"
...
And 输出含独立行"会话 等待校验"
```

**before（`requirement.md:177` 八处⑧）：**

```text
⑧ §3.2 的 `waiting_dependency` 显示词由「等待校验」改为「等待下游」（R-4 / BR-28），并加注"节点出料、等待核对"的语义。
```

**after：**

```text
⑧ 不改 §3.2：保留「等待校验」；R-4 撤回。`waiting_dependency` 就是“节点出料、等待核心核对证据”，“等待下游”留给 I1.3 的 `review_reason: downstream`。
```

### 8.3 修正基线八处②的边表口径

**before（`requirement.md:177` 八处②）：**

```text
② §3.1 的节点迁移图补 10 条边；
```

**after：**

```text
② §3.1 的节点迁移图按基线 9 态补 7 条边：`ready→escalated`（首派建会话失败）、`running→escalated`（`code-loop` 宿主报错/会话中途失效）、`done→running`（仅开发，下游驳回回流）、`done→escalated`（回流派发失败）、`review→cancelled`、`failed→cancelled`、`escalated→cancelled`。`review→escalated`、`failed→running`、`failed→escalated` 已存在；`pending` 是 I1.1 的合并态，不写入基线；
```

**before（`requirement.md:161` M-1 开头）：**

```text
| **M-1** | ... | 见附录 D-1。**新增 10 条边**：...
```

**after（只加一句限定，不删 10 条边）：**

```text
| **M-1** | ... | 见附录 D-1。**新增 10 条边（相对 I1.1 的 7 态表；基线 9 态对应 7 条，见 §1.4 末②）**：...
```

### 8.4 修正基线八处①的 `escalated` 方向

**before（`requirement.md:177` 八处①）：**

```text
① §3.1 的 `done` 行（加注"下游驳回可回流唤醒"）、`failed` 行（加注"含测试判定不通过"）、`escalated` 行（出边改为"人工裁决 → cancelled；裁决回退在 I1.4"）；
```

**after：**

```text
① §3.1 的 `done` 行（改"终态"为"可被下游驳回重新打开"；进入条件注明 I1.2 只按 evidence，I1.3 起加 downstream）、`failed` 行（改"执行失败"为"执行/判定未通过"，补 `failed_reason: verdict_fail`）、`escalated` 行（**保留**"人工裁决 → done / failed / 重新分配"，补"取消 → cancelled；I1.2 仅实现取消，裁决入口在 I1.4"）；
```

同时确认 M-1 的 `escalated: ['cancelled']` 是 **I1.1 代码表**的修改，不是基线表的修改；在 M-1 的影响栏加一句：

```text
**注意**：这里的 `escalated: ['cancelled']` 只改 `src/core/state-machine.js` 的 I1.2 运行表；`docs/index.md` §3.1 仍保留 I1.4 的三条裁决路径。
```

### 8.5 修正 `done` 的进入条件与 `consumed` 的关键句

**before（`docs/index.md:149`）：**

```text
| `done` | 验收通过 | 证据校验通过 + 下游接受 | 终态 |
```

**after：**

```text
| `done` | 本轮验收通过（可被下游驳回重新打开） | 证据校验通过；I1.2 不等待下游接受，I1.3 起加 `review_reason: downstream` 门控 | 下游驳回 → running（仅开发节点，见 §3.5 t2）；否则终态 |
```

**before（`docs/index.md:239`）：**

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 才表示目标节点已完成。连接线“已完成”条件是所有交接包均为 `consumed`。
```

**after：**

```text
**关键**：`accepted` 只表示目标接受了交接包，`consumed` 表示目标节点本轮产出已核对完毕；判定不通过时节点可为 `failed` / `escalated`，因此 `consumed` 不等于节点 `done`。连接线“已完成”条件是所有交接包均为 `consumed`。
```

### 8.6 补 §3.6 的 `suspended` / `escalated` / 阶段注

**before（`docs/index.md:276-284`）：** 见 §3.2.4 的 before 表。

**after：** 见 §3.2.4 的 after 表 + 阶段注。

### 8.7 补 §3.5 t1/t2/t3/t4 与 §3.4 `accepted`

- t1：`cooldown → thinking` 改为 `idle → thinking（I1.2 fresh；cooldown 在 I1.5）`（§4.5）。
- t2：先 `节点 T-003: done → running`，后 `HO-006: delivered → accepted`（§3.2.7）。
- t3：先 `HO-007: created → delivered`、`节点 T-005: failed → running`，后 `HO-007: delivered → accepted`（§3.2.7）。
- t4：`accepted → consumed（目标节点本轮产出核对通过后置位）`（§3.2.7）。
- §3.4 `accepted` 行：改为“目标会话首个事件已到达；目标节点已进入 running 后的首个 turn 内事件”（§4.3）。

### 8.8 补 `created→rejected` 与 `rejected` 语义

**before（`docs/index.md:222-227`、`:236`）：** 见 §3.2.3 的 before。

**after：** 见 §3.2.3 的 after。

### 8.9 修 D-6 的“回合结束→idle”

**before（`requirement.md:1196`）：**

```text
任意→`idle`（回合结束、审批拒绝或取消）；`escalated→idle`（仅取消，保证取消后不残留在"已升级"）；除取消外 `escalated` 无出边。
```

**after：**

```text
回合结束且**无产出提交** → `idle`；已提交产出 → 保持 `waiting_dependency` 到核对完成 / 升级 / 取消；审批拒绝 / 取消 → `idle`；`escalated→idle`（仅取消，保证取消后不残留在"已升级"）；除取消外 `escalated` 无出边。
```

### 8.10 修“单空格”与“2 空格”的冲突

**before（`requirement.md:250`）：**

```text
（与附录 A-2 完全一致，行序固定、**字段间一律单空格，不做列对齐**）
```

**after：**

```text
（与附录 A-2 完全一致，行序固定、**节点行与实例行字段间一律单空格；交接包行的号/方向/状态之间按 A-2 固定为 2 个空格**）
```

**before（`requirement.md:1360`）：**

```text
- **不做列对齐**：字段间一律单空格（`节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m02s`）
```

**after：**

```text
- **不做列对齐**：节点行与实例行字段间一律单空格（`节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m02s`）；交接包行的号/方向/状态之间固定 2 个空格（见上表第 5 段）
```

### 8.11 补 AC-15 / AC-08 / AC-24 的场景缺陷内容

**before（`requirement.md:1290`）：**

```text
| `verdict-says-fail` | step 2 `message="全部通过"`、`verdict=fail` | 说通过但判定不通过；AC-15 |
```

**after：**

```text
| `verdict-says-fail` | step 2 `message="全部通过"`、`verdict=fail`、`defects` 至少 1 条且 `evidence` 指向同一步写出的非空 `out/test-log.txt` | 说通过但判定不通过；AC-15 |
```

**同时补：**

- `backflow-once` / `verdict-says-fail` 的 fail 步：2 条缺陷、2 条证据（AC-05 断言 2 条）。
- `retest-fail` / `backflow-twice` 的第 2 次 fail 步：1 条缺陷、1 条证据（AC-08 断言 1 条）。
- 在 §3.3 step 契约里加一句：`verdict='fail'` 的 step 必须显式给 `defects`；缺省不是空数组，除 `verdict-no-defects` 外不得为空。

### 8.12 补 B-11 的真实失败闭环

**before（`requirement.md:145`）：**

```text
真实宿主只验成功闭环与回归（AC-01 / AC-03 / AC-21 / AC-22），**取消只在夹具面验证**（AC-11 / AC-42）。
```

**after：**

```text
真实宿主验成功闭环（AC-01 / AC-03 / AC-21 / AC-22）**与一次真实失败闭环**（AC-07R，任务目录 `demo-code-fail`，测试断言 `div(1,0)` 抛错、开发未实现，判定为 fail，走回流→第 2 轮→升级→挂起）；取消只在夹具面验证（AC-11 / AC-42）。
```

**新增 AC-07R：** 见 §5.4 的 Gherkin。并在 §3.3 样例目录表（`requirement.md:1143-1145`）把 `demo-code-fail/` 的用途从“真实面不跑它，仅供人工演示”改为“AC-07R 的真实失败闭环”。

### 8.13 登记 I1.4 的 `--template` 归属

**before（`docs/index.md:696`）：**

```text
- CLI 核心命令集（`orch run` / `orch status` 的**最小形态**已在 I1.1 交付，本迭代负责补全参数与输出格式，并**保持向后兼容**——I1.1 的调用方式不得失效）：
```

**after（在该条后插入）：**

```text
- CLI 核心命令集（`orch run` / `orch status` 的**最小形态**已在 I1.1 交付，本迭代负责补全参数与输出格式，并**保持向后兼容**——I1.1 的调用方式不得失效）：

> 参数归属：I1.2 已先占 `--template` 的最小形态（仅 `code-loop`，缺省 `single`）；本迭代补全 `--template` 的参数族（`--format`、多实例视图等）与输出格式，必须保持 I1.2 的调用方式、退出码与输出段序兼容。I1.4 的验收应重跑 I1.2 的 AC-01 / AC-03 / AC-12。`--host` 仅用于验收夹具，不是产品参数。
```

### 8.14 修 D-6 / D-7 的编号说明

**before（`requirement.md:1459`）：**

```text
> 编号说明：**D-6（状态结构）与 D-7（图级产物）位于 §3.3**，原地定义以免与用户面章节割裂；本附录从 D-8 继续。
```

**after：**

```text
> 编号说明：D-1~D-5 在本附录；**D-6（状态结构）与 D-7（图级产物）位于 §3.3**，原地定义；D-8 在本附录末尾。
```

### 8.15 补版本号与 BR-29~31 变更记录

**before（`requirement.md:4`）：**

```text
> 状态：**v13 待终审** ｜ 上游：I1.1（**开发中**；契约见 `docs/iterations/iteration-1.md` §2 / §3，实现见 `src/`）
```

**after：**

```text
> 状态：**v14 待终审** ｜ 上游：I1.1（**开发中**；契约见 `docs/iterations/iteration-1.md` §2 / §3，实现见 `src/`）
```

**在附录 C 末尾追加：**

```text
| v14 | 2026-11-05 | 基线评审后修订：① 登记 3 处未入账改动（`escalated→idle`、driver `--cwd/--task`、交接包方向 2 空格）；② 基线八处②改为“基线 9 态 7 条边”，① 的 `escalated` 保留三条裁决路径，⑧ 撤回“等待下游”；③ 补 `done` 进入条件、§3.4 `accepted`/`consumed`/`rejected`、§3.6 `review`/`running`/`escalated`、§3.5 t1、§5.2 数据布局；④ 补 BR-29~BR-31 的引入记录；⑤ B-06 / B-11 裁决登记 |
```

### 8.16 补固定产出

**现状：** `docs/iterations/iteration-2/` 只有 `requirement.md`（+ 已有的 `review-contract.md`，不是本迭代固定产出）。

**缺什么（按 `docs/index.md:958-965` 与 `docs/templates/requirement-template.md` 开头）：**

1. **`docs/iterations/iteration-2.md`（任务拆分）**：模板明确要求“需求文档 → 任务拆分（`iteration-N.md`）→ 执行 → 验证报告（`iteration-N/report.md`）”。当前没有。
2. **`docs/iterations/iteration-2/report.md`（验收实验记录）**：通过/失败、失败原因；AC-22 还引用 `docs/iterations/iteration-2/evidence/i1.1-regression.md`，当前 `evidence/` 不存在。
3. **`docs/iterations/iteration-2/acceptance*.md`**：I1.1 有 `acceptance.md` / `acceptance-product.md` / `acceptance-fixture.md`；I1.2 没有。按 I1.1 惯例，至少要有产品面/夹具面两份，或一份分节。
4. **迭代复盘**：流程偏差、技术债、下迭代调整。
5. **资产更新**：角色/工作流/技能的不足纳入下迭代（本迭代至少记录“三角色是代码常量，I1.5 提取”）。
6. **可演示增量**：实现与夹具，当前尚未开始。

**`iteration-2.md` 必须包含什么（按模板与 I1.1 的 `iteration-1.md` 结构）：**

- §0 迭代定位、In scope / Out of scope（逐条对齐需求 §1.3）、退出标准（AC 全过、证据可复核、NFR）。
- §1 技术选型与架构决策：graph 注入、`schemaVersion:2`、数组化、v1 只读、升级 CAS、fresh session、夹具形态（driver + mock agent）。
- §2 模块划分与文件级接口契约：`src/core/orchestrator`、`state-machine`、`verify-artifact`、`src/templates/**`、`src/cli/render` / `labels`、`src/persistence/instance-store`、`test/fixtures/*`。
- §3 数据契约：D-6 的 `state.json` 字段、`events.jsonl` 事件、`escalations[]`、`handoffs[]`、`wakeConsumedAt`、`roundStartedAt`。
- §4 工作包拆分（WP-1~WP-N）：文件清单互不重叠、依赖 DAG、可并行性、每个包的验收口径。
- §5 AC ↔ WP ↔ 验证面映射：45 条 AC 每条落到包与证据类型（产品/夹具/混合/架构）。
- §6 夹具与场景计划：driver、mock agent、scenario 文件、legacy-v1 快照、`SHA256SUMS`、`call-seam`、`attempt-transition`、`purity-check`。
- §7 回归计划：I1.1 的 AC-02~AC-25 + AC-26 改造；D-8 的 11 个测试文件。
- §8 风险与未决项：B-06/B-11 裁决、I1.3 引擎耦合、I1.4 `--template` 兼容、v1 只读边界。
- §9 交付物与退出清单。

---

## 9. 附：本次评审的取证清单

- 规划覆盖：`docs/index.md:668-675`、`:958-965`、`:938-947`。
- 状态模型：`docs/index.md:129-162`（节点）、`:164-187`（会话）、`:189-216`（角色）、`:218-239`（交接包）、`:241-272`（时序）、`:274-286`（恢复）。
- 能力域：`docs/index.md:314-329`（2）、`:350-397`（4）、`:536-556`（6）、`:560-599`（5）。
- 需求：`requirement.md:3-62`（头/摘要）、`:88-177`（范围/对应/契约修改）、`:181-511`（功能/BR）、`:515-1103`（AC）、`:1122-1323`（前置/夹具）、`:1329-1393`（A）、`:1411-1435`（B）、`:1437-1453`（C）、`:1457-1591`（D）。
- 代码现状（用于 I1.3 耦合判断）：`src/core/orchestrator.js:23-27`、`:80-98`、`:871-893`；`src/adapter/session-state.js:174-184`、`:210-226`；`src/core/state-machine.js:140`；`test/fixtures` 现有夹具。
- 交叉评审：`docs/iterations/iteration-2/review-contract.md`（契约与代码现状；本文不重复其 M-1~M-14 代码逐条核对，只引用其“单节点/无图/`finishRun` 在首节点完成”的事实）。
