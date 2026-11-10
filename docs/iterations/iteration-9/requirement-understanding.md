# I1.9 需求理解纪要（三层日志 + 健康度计算）

- **角色**：需求理解工程师（S0 PASS 之后派单 C，判据 `docs/templates/execution-template.md` §1.0.5）
- **依据**：定稿需求 `docs/iterations/iteration-9/requirement.md` **v7**（1060 行，27 AC / 25 BR / 附录 A~D）；评审记录 `review-round1.md` ~ `review-round7.md`（最终轮 round7 总判 PASS、阻断 0 / 建议 0，用户给定 S0 已 PASS）；基线判据 `docs/index.md` 第一部分 §3 / §4 能力域 5·6 / §5.5 / §5.8 / §5.2 与第二部分 `#### I1.9`（L828-836）；`docs/templates/execution-template.md` §1.1（13 条 DoR）与 §5（全流程硬约束）；基线 HEAD `70277df`
- **代码现状**：仅用于理解约束（`src/core/event-bus.js`、`src/core/orchestrator.js`、`src/persistence/instance-store.js`、`src/persistence/paths.js`、`src/cli/main.js`、`src/cli/render.js`、`src/cli/labels.js`、`src/core/status-text.js` 及夹具 `code-loop-driver.mjs` / `task-loop-driver.mjs` / `mock-acp-agent.js`），**不作需求来源**
- **职责边界**：不参与评审、不宣布「评审通过」（引用 round7 结论仅作输入事实）；不改需求正文、不改写任何 AC 的 `Then` 或判据；发现的疑点只登记为「需主控裁决」，不自行修正
- **只读声明**：本纪要只写本文件；未修改 `requirement.md`、`review-round*.md`、`progress.md`、`docs/index.md`、`src/**`、`test/**`、模板

> 标题约定：§2 的 AC「一句话标题」是需求原文 `**AC-xx · …**` 标题的紧凑转写（省去四档 emoji 标记 🟢/🟡/🔴/⚪，改用「正常/慢/需关注/已结束」档位词），**不改判据**；逐字标题见需求 §3.1。

---

## 1. 范围（In / Out）

### 1.1 In · 逐条对应需求 §1.3 与规划 L830-836 的 5 个子项

规划（`docs/index.md` L830-834）共 5 个子项，L836 是三段验收句（对账见 §2.2）。需求 §1.3「范围内」共 7 条，与 5 个子项的对应关系如下：

| # | 规划子项（逐字 + 行号） | 需求 §1.3 范围内条目 | 一句话交付 |
|---|---|---|---|
| 1 | `事件日志：append-only、链式哈希基础`（L830） | 第 1 条「事件日志的链式哈希基础」；第 7 条「会话留痕的审计粒度」（部分对应） | 每条新事件带前一条记录的指纹、首条固定起点；只追加不改写、序号不复用、同实例一条链不同实例独立；「基础」= 只做链、不做校验命令 |
| 2 | `执行日志摘要：会话完成时附加命令、退出码、关键输出行数、日志 artifact 引用`（L831） | 第 2 条「执行日志摘要」；第 7 条（会话级只留一条摘要） | 会话完成/失败/取消各留一条四项摘要，挂在**会话**上、每轮各一条；完整日志留宿主，缺项显示「未提供」 |
| 3 | `追踪 span：trace_id、节点 span（start_time / end_time / status / handoff_ids）、回流链可展开`（L832） | 第 3 条「追踪跨度」；第 4 条「`orch trace show <实例号>`」 | 实例级追踪号、节点每轮一条跨度、落 `instances/<id>/state/traces.jsonl`；回流链按轮次展开；空/单节点/不存在都有提示 |
| 4 | `健康度计算：🔴 / 🟡 / 🟢 / ⚪ 规则落地，健康度写入实例元数据，变化进事件日志`（L833） | 第 5 条「健康度四档」；第 6 条「两个口径的明确定义」（P90 样本、TTL 起算点/50% 阈值） | 四档规则 + 五类红 + 两类黄；写 `state.json` 顶层 `health`；`instance status` / `status.md` 可见；档位变化进事件日志 |
| 5 | `CLI：orch trace show <instance_id>`（L834） | 第 4 条「`orch trace show <实例号>`」 | 只读文本时间线 + 单独展开回流链；不提供 JSON 输出、不做 OTel 导出、不做图形化 |

> §1.3 范围内第 6 条（两个口径定义）与第 7 条（会话留痕审计粒度）不是独立的第 6/7 个规划子项：前者是子项 4 的可复现口径补全（B-2 / B-3 / BR-19 / BR-20），后者是能力域 6 审计粒度（基线 L564）的收口。两者都在 In 内。

### 1.2 Out · 逐条列出范围外 + 是否阻塞开工

需求 §1.3「范围外」L49-59 共 9 条，另加承自 I1.7 的 worktree 生命周期项；每条注明去向与是否阻塞：

| # | 范围外项 | 去向 / 登记 | 是否阻塞开工 |
|---|---|---|---|
| O-1 | OpenTelemetry 导出（不实现导出格式、不新增导出命令，仅在数据布局预留） | I1.12（基线 §5.5 L507）；§1.3 L51、§2.3.2 L139 双处排除 | **不阻塞** |
| O-2 | 崩溃恢复、检查点、`session/resume` / `session/load` 恢复方言 | I1.8；本迭代不读写检查点、不改实例恢复规则（§1.3 L52） | **不阻塞**（progress.md D-0：I1.9 不引用 I1.8 能力） |
| O-3 | 桌面壳、面板健康度徽标、追踪可视化界面、WebSocket 推送 | I1.10a / I1.10b；本迭代只交付 CLI 与 `status.md` 可见面（§1.3 L53） | **不阻塞** |
| O-4 | 链式哈希的篡改检测报告 / 校验命令 | I1.12；本迭代只保证链可逐条核对（§1.3 L54、BR-03、D-1） | **不阻塞** |
| O-5 | `pending → expired` 自动过期与随之而来的升级 | 后续治理迭代；本迭代只读待投递时长做「慢」判定，不改交接包状态机、不生成过期升级（§1.3 L55、§2.5 L168、BR-16） | **不阻塞** |
| O-6 | **健康度参与路由决策的具体策略**（基线 L541「影响路由决策」） | 登记为**基线偏差 U-4**（§1.3 L56、B-5 L851）；本迭代保证健康度可被核心读取，不新增调度/路由行为 | **不阻塞**（需评审/主控确认豁免，见 §5 / §9） |
| O-7 | **既有 12 处逐条会话状态事件的清退**（`main@70277df` 的 `orchestrator.js` 已存在，与基线 L564 不符） | 属基线 L898「审计粒度规则落地」，由 **I1.12** 承接；本迭代 12 处（保留 4 / 冻结 7 / 复用 1，逐处见 D-7）**仍在发射、不新增不删除、行为不变**，只新增 `execution.summary` 一条会话级记录 | **不阻塞**（基线偏差 U-7，需评审/主控确认豁免） |
| O-8 | 真实宿主的执行日志格式适配 | 本迭代按 B 类零 DSH 验收，摘要由核心接收宿主工具事件时尽力提取；宿主未提供项显示「未提供」；真实宿主取证与格式补齐留后续真机迭代（§1.3 L58、B-5 U-2） | **不阻塞** |
| O-9 | 追踪数据的保留期与轮转 | 本迭代只追加、不清理、不压缩；保留策略留后续（§1.3 L59、B-5 U-5） | **不阻塞** |
| O-10 | **worktree 生命周期清理策略**（实例终止时 worktree 保留/清理） | 承自 **I1.7 §1.3 L51**「worktree 生命周期清理策略（实例终止时的保留/清理留后续）」；**不是 I1.9 §1.3 的明文条目**，I1.9 继承该 Out、不涉及、不改动（契约差异见 §7） | **不阻塞** |

> 需求 §1.3 L61-65 另有「回归红线」三条（三主链输出逐字不变 / `status`·`graph` 既有输出逐字不变且健康度只新增一行 / 零依赖+中文唯一来源+31 词纯净扫描），归入本纪要 §8 的 R 清单，不在 Out 表内重复。

---

## 2. AC 清单与分面

### 2.1 27 条 AC 全量清单（编号 + 一句话标题 + 分面）

分面取值：**审计链 / 执行摘要 / 追踪 / 健康度 / CLI 可见 / 异常与边界 / 回归与非功能**（主分面 1 个，跨面用「兼」标注）。

| AC | 一句话标题 | 分面 |
|---|---|---|
| AC-01 | 事件日志只追加：旧行不变、序号不复用 | 审计链 |
| AC-02 | 链式哈希：每条记录接上前一条的指纹 | 审计链 |
| AC-03 | 回归红线：三条主链运行输出逐字不变 | 回归与非功能 |
| AC-04 | 执行摘要四要素：失败节点当场回答「为什么失败」 | 执行摘要（规划验收③） |
| AC-05 | 摘要边界：只存摘要与引用，缺项显示「未提供」 | 执行摘要（兼 异常与边界） |
| AC-06 | 追踪跨度：追踪号、起止、结果、交接包齐全 | 追踪 |
| AC-07 | 回流链按轮次展开：同一节点多轮不合并、不覆盖 | 追踪 |
| AC-08 | 规划验收①：`orch trace show` 能展开一次回流的跨角色因果链 | 追踪（规划验收①） |
| AC-09 | 追踪的三种空形态：空、单节点、实例不存在 | CLI 可见（兼 异常与边界） |
| AC-10 | 追踪只读：重复执行不改状态、不追加事件 | 追踪 |
| AC-11 | 健康度「正常」档：无异常时显示正常 | 健康度 |
| AC-12 | 健康度「已结束」档：终态优先、不回升 | 健康度（兼 异常与边界） |
| AC-13 | 健康度「需关注」五类条件（六个夹具）矩阵：任一项命中即需关注 | 健康度 |
| AC-14 | 健康度「慢」超过 P90：样本、阈值与边界 | 健康度 |
| AC-15 | 健康度「慢」连接线待投递超过 TTL 50% | 健康度（兼 异常与边界） |
| AC-16 | 规划验收②：健康度在实例状态变化后正确更新并进事件日志 | 健康度（规划验收②，兼 审计链） |
| AC-17 | 健康度写入实例元数据，并在两个用户面可见 | CLI 可见 |
| AC-18 | 健康度只读：不改变节点/会话/交接包、不触发升级 | 健康度 |
| AC-19 | 既有状态输出不回归：只允许新增一行健康度 | 回归与非功能 |
| AC-20 | 非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支 | 回归与非功能 |
| AC-21 | 事件链的历史兼容：旧记录无标记、末行被截断仍能续链 | 异常与边界（兼 审计链） |
| AC-22 | 进行中的跨度：显示「进行中」与结束位「—」，不显示「暂无追踪记录」 | 追踪（兼 异常与边界） |
| AC-23 | 追踪异常：文件缺失、单行损坏、缺时间字段都降级且可见 | 异常与边界 |
| AC-24 | 会话的审计粒度：逐条状态不进主审计，摘要回答「为什么结束」 | 执行摘要（兼 审计链） |
| AC-25 | 事件链整份不可解析：从固定起点重起链、序号从 1、旧行原样保留 | 异常与边界（兼 审计链） |
| AC-26 | 取消收尾的执行摘要：被取消的会话也答得出「为什么结束」 | 执行摘要（兼 异常与边界） |
| AC-27 | 同一节点多轮：每轮会话各一条摘要，条数等于轮次 | 执行摘要 |

分面计数：审计链 2（AC-01/02）、执行摘要 5（AC-04/05/24/26/27）、追踪 5（AC-06/07/08/10/22）、健康度 8（AC-11~16/18）、CLI 可见 2（AC-09/17）、异常与边界 2（AC-21/23 为主）、回归与非功能 3（AC-03/19/20）；跨面「兼」标注如上，合计 27 条不重不漏。

### 2.2 规划三段验收句 → AC 对账（`docs/index.md` L836）

| 验收句（规划逐字） | 判据逐字落点 | 主 AC | 支撑 AC / 基线 |
|---|---|---|---|
| ① `orch trace show` 能展开一次回流的跨角色因果链 | AC-08 L290「判据（规划逐字）」 | **AC-08**（Then L293 与 A-3 逐字一致：`跨度 3 条 · 回流 1 次`、3 条跨角色跨度、`第 2 轮 T-002 测试 → T-001 开发 HO-002 已完成`、无进行中行） | AC-07（完整回流 4 条跨度）、AC-09（空形态）；A-3 L596-606；D-2 的 `handoff_ids` 读取时推导使 `HO-002` 不漏；`--stop-after 3` 冻结窗口 |
| ② 健康度在实例状态变化后正确更新并进事件日志 | AC-16 L385「判据（规划逐字）」 | **AC-16**（快照前后两次读取构造「正常 → 需关注」，文本行 `健康度 INST-001  正常 → 需关注  原因 有待处理升级` + JSON `health.changed` / `detail.reasons`） | A-8 L691-721；BR-14 / BR-15；D-3 读取时重算 + 窄 CAS 写入；AC-17（元数据/两用户面可见） |
| ③ 执行日志摘要能回答「这个节点为什么失败」 | AC-04 L245「判据（规划逐字）」 | **AC-04**（失败节点 `T-001` 跨度行 + 下方四项 `失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log`） | AC-05（缺项降级）、AC-24（会话审计粒度）、AC-26（取消）、AC-27（多轮条数）；A-4 / A-12；BR-04 |

> round7 §2.1 判定规划 12 句 **12/12 覆盖**、非「覆盖」条目 0；三段验收句分别由 AC-08 / AC-16 / AC-04 承接，无收窄、无换名、无合并。

---

## 3. BR / M / C 契约清单

### 3.1 25 条 BR 逐条（编号 + 约束要点 + 被哪些 AC 引用）

| BR | 约束要点 | 被哪些 AC 引用 |
|---|---|---|
| BR-01 | 事件日志只追加；已有记录内容/顺序/序号不被改写，新记录只接链尾；「序号不复用」指**可读序号**，不可读行不贡献序号，整份不可解析按 BR-25 从 1 起算不算复用 | AC-01, AC-21, AC-25 |
| BR-02 | 每条新事件携带前一条记录指纹；首条用统一固定起点；同一实例一条链、不同实例独立 | AC-02, AC-21, AC-25 |
| BR-03 | 只保证链可逐条核对；不提供篡改检测报告/校验命令（留 I1.12） | AC-02 |
| BR-04 | 每个会话收尾（完成/失败/取消）留一条四项执行摘要（命令/退出码/关键输出行数/日志引用）；摘要挂**会话**、一条会话一条，同一节点多轮每轮各一条、按轮次分开不合并；失败轮在追踪里显示，成功/取消只在日志可查 | AC-04, AC-24, AC-26, AC-27 |
| BR-05 | 摘要只保留摘要与引用，完整日志留宿主、不复制进实例目录；宿主未提供项显示「未提供」，不阻塞实例 | AC-05, AC-26 |
| BR-06 | 每实例一个追踪号；节点每轮一条跨度（开始/结束/结果/关联交接包）；未结束节点显示「进行中」 | AC-06, AC-08, AC-22 |
| BR-07 | 回流链按轮次展开、按时间顺序显示跨角色交接因果；多轮不合并、不覆盖 | AC-07, AC-08 |
| BR-08 | `orch trace show` 只读；重复执行输出一致，不改实例状态、不追加事件 | AC-10 |
| BR-09 | 空白追踪（连进行中节点都没有）显示「暂无追踪记录」并正常结束；单节点显示一条跨度且回流为「无」；实例不存在显示「不存在」并以失败退出码结束 | AC-09, AC-22 |
| BR-10 | 健康度固定四档（需关注/慢/正常/已结束）；同一时刻只显示一档 | AC-11, AC-12 |
| BR-11 | 待处理升级/节点超时/会话崩溃/角色不可用/连接线被拒绝或已过期任一命中即「需关注」；节点超时 = 运行时长**严格大于**实例级 `health.nodeTimeoutMs`（缺省 30000ms），恰好等于不算 | AC-13 |
| BR-12 | 节点运行时长**严格大于**本实例 P90、或连接线待投递**严格大于** TTL 一半任一命中即「慢」；恰好等于 P90 / TTL 一半均不算 | AC-14, AC-15 |
| BR-13 | 无异常为「正常」；实例进入终态（已完成/失败/已取消/已中断）后为「已结束」，终态优先于其他档 | AC-11, AC-12 |
| BR-14 | 健康度写入实例元数据；`orch instance status` 与 `status.md` 显示档位与原因 | AC-16, AC-17 |
| BR-15 | 档位每次变化都进事件日志（从哪档到哪档、原因）；档位未变不重复记；首次写入不算变化 | AC-16 |
| BR-16 | 健康度只读，不改节点/会话/交接包状态、不生成升级、不改调度与路由 | AC-18 |
| BR-17 | `single` / `code-loop` / `task-loop` 三主链运行输出逐字不变；健康度只出现在实例状态视图与 `status.md` | AC-03 |
| BR-18 | `orch instance status` / `orch instance graph` 既有非健康度输出逐字不变；健康度只允许以新增一行出现 | AC-19 |
| BR-19 | P90 样本是同一实例内已结束节点轮次的跨度时长；样本少于 5 条不触发「慢」 | AC-14, AC-23 |
| BR-20 | TTL 从交接包进入 `pending` 的时刻起算；默认 TTL 30 分钟；待投递时长**超过** 50%（严格大于 15 分钟）即判「慢」，恰好 15 分钟不算；无起算时间的旧包不参与判定 | AC-15 |
| BR-21 | 追踪与摘要对宿主无新增依赖；宿主未提供摘要项时降级显示「未提供」，不阻塞实例 | AC-04, AC-05 |
| BR-22 | 升级前旧记录无指纹标记也原样保留、不回填、不改写、不算断点；新记录接最近一条可解析记录之后，序号继续递增、不回 1；末行被截断只跳过该行并提示跳过行数，不阻断实例继续运行 | AC-21, AC-25 |
| BR-23 | 会话逐条状态迁移不作为新审计事件供用户核对；会话为什么结束/失败/被取消看执行摘要那一条；节点/交接包/升级状态变更照常审计，审批与取消等治理动作照常留痕；既有 12 处逐条会话事件本迭代不新增、不删除、**仍在发射**，清退由 I1.12 承接 | AC-24, AC-26 |
| BR-24 | 追踪记录缺失、单行不可读、历史跨度缺起止时刻时，健康度按「该条件不成立」处理并照常给出档位，不崩溃、不误报；被跳过的行数提示给用户，异常不被静默吞掉 | AC-23 |
| BR-25 | 事件日志整份不可解析（无任何可解析记录）时，新记录从固定起点重新起链、序号从 1 开始；不可读行不贡献任何可读序号；旧文件一行不删/不改写/不改名，新记录仍追加末尾；用户看到「已跳过 N 行不可读记录」，实例不中断、命令以成功退出码结束 | AC-25 |

**双向覆盖核对**：25/25 每条 BR 至少被一条 AC 引用（上表）；AC 引用的 BR 均真实存在，无悬空引用。与 round7 §6.1「BR 双向 25/25、未被引用 []、悬空 []」一致。

### 3.2 M / C 契约编号

**本迭代需求未使用 M/C 编号，契约全部以 BR + 附录 D 承载。**

核对依据：需求全文的编号前缀只有 `AC-`（27）、`BR-`（25）、`NF-`（5）、`U-`（9），以及附录编号 `A-0~A-14` / `B-1~B-5` / `C`（变更记录）/ `D-1~D-11` 与修复项 `F-xx`；机械扫描 `\*\*(AC|BR|U|NF|M|C|F|R)-[0-9]+` 中 `M-` / `C-` 命中 0。需求里出现的「附录 C」是**变更记录**（v1~v7 的 F 修复流水），不是 `C-xx` 契约；源码 `src/cli/main.js` 注释里的 `C-7` / `C-11` 属 I1.1 历史编号，与本迭代契约编号体系无关。实现约束集中在附录 D（D-1~D-11），用户可见业务规则集中在 BR-01~BR-25。

---

## 4. 附录 A / D 索引

### 4.1 A-0 ~ A-14 · 每节锁定的「用户可见输出」

| 节 | 一句话：锁定的用户可见输出 |
|---|---|
| A-0 | 「逐字」的可变值边界：时刻/追踪号/节点号与标题/会话号/摘要四项取值/交接包编号/事件序号·`ts`·`prev_event_hash`/跳过行数·原因码随夹具替换，其余中文文案、空格、缩进、` · `/`→`/两空格分隔符、单位与顺序逐字固定；`orch trace show` 节点列 `title ?? nodeId`，`single` 只显示 `T-001`、不显示 `roleId`/`worker`，`single` 的 `status.md` 不输出 `## 节点` 段 |
| A-1 | 空追踪：`实例 INST-001 · 暂无追踪记录`，退出码 `0` |
| A-2 | 单节点无回流：追踪号 + `跨度 1 条 · 回流 0 次` + 一条跨度 + 末尾「回流链」「无」两行 |
| A-3 | 一次回流冻结窗口：`跨度 3 条 · 回流 1 次` + 3 条跨角色跨度 + 回流链行 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`（`HO-002 round=2 / consumed`） |
| A-4 | 失败节点：跨度行 + 下方四项 `失败摘要` 行（缺项替换「未提供」，` · ` 分隔） |
| A-5 | 实例不存在：`实例 INST-999 · 不存在`，退出码 `1`、不打印堆栈 |
| A-6 | `orch instance status` 四档基线（实例状态行 + 健康度行）；**A-6 附**给出 8 行原因句逐字基线、占位符替换规则、多原因按 D-3 固定顺序用同一 ` · ` 并列；档位词只用 4 个中文词、不带 emoji/英文档位词 |
| A-7 | `status.md`：在 `- 状态：…` 之后插入 `- 健康度：…` 一行，其余行不变 |
| A-8 | 健康度变化事件：JSON 形状（`object/objectId/from/to/result/reason/detail.reasons/seq/ts/prev_event_hash`）+ 文本视图基行 `10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级`；中文原因是用户可见判据、码值只在 JSON 机读层，两层一一对应 |
| A-9 | 文案键与归属表：`HEALTH_LABEL` / `HEALTH_LINE` / `HEALTH_REASON_*` / `TRACE_*` / `SUMMARY_*` / `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED` 全落 `labels.js`，`status.md` 字段名由 `status-text.js` 镜像 |
| A-10 | 进行中跨度：`跨度 0 条 · 回流 0 次` + `10:00:00 → —  T-001  进行中  交接 HO-001` + 末尾「回流链」「无」；结束位 `—`、结果位「进行中」、不出现「暂无追踪记录」 |
| A-11 | 追踪有坏行：汇总行之前插入 `追踪记录有 1 行不可读，已跳过`，正常跨度照常列出 |
| A-12 | `orch instance log` 执行摘要行（时刻 + `会话 <号>  执行摘要` + 四项 + ` · `）；一行对一条会话、行数 = 会话轮次数 = 该节点跨度行数；`single` 的 `失败摘要` 前缀只属 A-4 |
| A-13 | `orch instance log` 事件不可读行提示 `已跳过 1 行不可读记录`（单独成行、不带时刻前缀、置于列表末尾）；与 A-11 措辞不混用 |
| A-14 | 取消收尾的执行摘要（与 A-12 同一行模板）：四项一律「未提供」；**live 取消（AC-26 实跑路径）**四项全 `未提供` 是唯一判据，非 live 分支 `:3762` 本迭代保留但 AC-26 不覆盖 |

### 4.2 D-1 ~ D-11 · 每节给实现的「约束」

| 节 | 一句话：给实现的约束 |
|---|---|
| D-1 | 事件链只新增 `prev_event_hash` 一个字段（64 位小写 hex，首条 64 个 `0`）；规范化 JSON 序列化（递归键排序/UTF-8/无空白）后 SHA-256，**不得对原始行字节直接哈希**；序号与上一条指纹必须**同一次文件尾读取**；旧记录不回填、末行截断前溯、整份不可解析按固定起点重起；只做链，不做校验/篡改报告/签名 |
| D-2 | `traces.jsonl` 落 `instances/<id>/state/traces.jsonl`（新增 `instanceStateDir`/`instanceTracesPath` 两导出，既有路径函数不动）；节点每轮收尾整行一次追加、未结束节点不写跨度；**跨度写入时机在节点本轮收尾、早于 `maybeStopAfter`(orchestrator.js:3141) 与 `advance()`(:3157)**；`handoff_ids` **读取时**按 `fromNodeId`/`toNodeId` + `round` 推导（接收包 `round===r`、产出包正向 `round===r` / 回流 `round===r+1`），不落盘为冻结值；追踪号 `TRC-` + 8 位小写 hex；读取只跳过坏行并计数；汇总只统计已落地跨度 |
| D-3 | 新增 `src/core/health.js` 纯函数 `computeHealth({ state, graph, traces, now })` → `{ level, reasons }`，不读盘、不取系统时间，`now` 可注入（缺省 `Date.now()`）；健康度写 `state.json` 顶层 `health`（`level/reasons/computedAt/nodeTimeoutMs`）；`health.nodeTimeoutMs` 缺省 **30000**、回写保留；不接收角色注册表、不调用 `buildRoleInstances`，角色由 `state.nodes[].roleId` + `state.sessions` 投影；终态优先；8 个原因码固定顺序；变化追加 `health.changed`（首次不算）；禁止写 `graph.json` / 触发状态迁移或调度 |
| D-4 | 节点/交接/升级/实例状态迁移继续进事件日志，会话状态变更不逐条进主审计，只在收尾追加 `execution.summary`（完成/失败/取消各一次）；事件形状 `object:'session'` / `reason:'execution.summary'` / `detail` 含 `nodeId/round/summary` 四项（`command/exitCode/keyOutputLines/logRef`，缺项 `null` →「未提供」）；**提取落点在核心 `handleUpdate`（orchestrator.js:1183-1230）读原始帧缓存**，`src/adapter/session-state.js` 不改；取消路径缺缓存四项全「未提供」，不得用 `toolName`（来自 `tool_call.title`）冒充 `command`；夹具新增 `--fail-tool` / `--fail-tool-no-refs` 两个默认关闭开关，既有 12 个开关与三条场景套件行为逐字不变 |
| D-5 | CLI 加 `trace show`（位置参数或 `--instance`，**不新增 `--format`**）；`USAGE_LINES` 25 行不动；退出码 `0`/`1`/`2`；新增 5 个纯渲染函数（`renderHealthLine` / `renderTraceShow` / `renderSummaryLogLine` / `renderHealthEventLine` / `renderEventsSkippedLine`），中文全来自 `labels.js`；`instance status` 只在实例状态行之后插健康度行、`graph` 不插；`instance log` 只对 `execution.summary`/`health.changed` 分派并在末尾按需输出跳过行；节点列按 `graphNode.title ?? nodeId` |
| D-6 | 新增中文只落 `src/cli/labels.js`，`status-text.js` 只镜像键；`src/core`/`src/daemon` 不出现模板名、角色字面量、`if host ==` / `switch (host)` 分支；31 词禁词表原样供 `--forbid` 复制；零第三方运行时依赖，全部用 Node 内置模块 |
| D-7 | 授权修改清单：点名文件 + 行号 + 只改哪一段（详见 §4.3 专表） |
| D-8 | 断言修改清单：只改期望文本、不放宽断言（详见 §4.3 专表） |
| D-9 | 回归门禁：三主链输出逐字不变；`status`/`graph` 既有非健康度输出逐字不变（健康度只新增一行）；全量测试失败集合与 I1.7 基线差集 = 0、条数只增不减；`dependencies` 为 `{}`；31 词纯净扫描 `exit 0` |
| D-10 | AC 标题沿用 `**AC-xx ·` 形态（机械取号 `grep -cE '^\*\*AC-'` = 27），BR 用 `grep -cE '^- \*\*BR-'` = 25；若要统一为 `####` 应另做一次性格式迁移，不与本轮修订混做 |
| D-11 | 本迭代明确不动：12 处会话逐条发射点、`USAGE_LINES` 25 行、`instance graph` 两种格式、`instance log` 既有事件行格式、既有路径工厂 / `nextSeq` 容错口径 / `event-bus` 先落盘再广播顺序 |

### 4.3 任务点名的 5 项特别标注

**(1) D-7 授权修改清单涉及的全部文件**（`requirement.md` L1003-1032）：

| 文件 | 授权范围（只改哪一段） |
|---|---|
| `src/core/event-bus.js` | `:90-105` `emit` 内计算并附加 `prev_event_hash`（不改先落盘再广播顺序/路由语义/返回结构）；`:110-122` `replay` 透出 `readEvents` 已返回的 `badLines` |
| `src/persistence/instance-store.js` | `:260-291`、`:380-399` 只新增「同一次尾读返回序号与上一条指纹」辅助方法（`doAppend` 整行追加、`nextSeq` 容错、`readEvents` 的 `badLines` 计数不动） |
| `src/persistence/paths.js` | 只追加 `instanceStateDir` / `instanceTracesPath` 两导出；落点在 `corruptPath`(`:55-58`) 之后、`instanceWorkspaceDir`(`:60-66`) 之前（按函数名定位，不按固定行号）；`statePath`/`eventsPath`(`:47-53`) 不改 |
| `src/core/orchestrator.js` | `:444-454`（`saveState` 写回 `health`）、`:735`（`newState` 加 `health: { nodeTimeoutMs: 30000 }`）、`:1183-1230`（`handleUpdate` 摘要提取唯一授权段）、`:1595-1615` / `:2120-2230` / `:2530-2575` / `:2660-2810` / `:3240-3250`（节点收尾追加跨度，只改摘要出口/跨度调用，不改状态迁移/时间戳/事件顺序）、`:4036`（`getStatus` 读取时重算 + 窄 CAS + `health.changed`）；摘要写入固定 `quiesceSession`(`:1282`)/`idleSession`(`:1311`)/`applyCancel`(`:3807`) 三函数、**不新增第四入口**，`object:'session'` 字面量只新增 1 处（`grep -c` ≤ 13）；12 处会话发射点不改写、不删除、不新增 |
| `src/adapter/session-state.js` | **明确不改**（只做状态与工具名归一化；`tool_call_update` 分类分支在 `:153`） |
| `src/core/status-text.js` | `:310-342` 只在 `- 状态：…` 之后插健康度行、`CORE_TEXT.doc` 只追加 `health` 字段名 |
| `src/cli/labels.js` | 只在文件末尾追加健康度/追踪文案键；`USAGE_LINES`(`:183-208`) 与既有键不动 |
| `src/cli/render.js` | 只新增 5 个纯函数；`renderEventLines` 只允许在函数开头加一个按 `event.reason` 的分派分支 |
| `src/cli/main.js` | `:194-206` / `:543-561` / `:571` / `:628-634` / `:1167-1230` 追加 `trace show`；`statusCommand`(`:999-1070`，约 `:1062-1065`) 只插一行 `renderHealthLine`；`instance log`(`:1191-1211`) 只对两种 reason 分派 + 末尾追加跳过行；`run`/`cancel`/`graph` 路径不动 |
| `src/daemon/server.js` | `:201-233` 只追加只读 `instance.trace`，`instance.events`(`:225-232`) 返回带 `badLines` |
| **新增文件** | `src/core/health.js`、`src/core/trace.js`（不得出现 31 禁词与宿主分支） |

**(2) D-8 断言修改清单**（L1034-1041，只改期望文本、不放宽断言）：

- `test/wp11/status-doc.test.js:68-130`：两处整份期望文本在 `- 状态：运行中` 后插 `- 健康度：正常`；`:179-251`「人工改写/无新状态不覆盖」用例不动
- `test/wp9/cli-e2e.test.js:135-180`：若存在 `instance status` 整份输出断言，只插健康度行；超时/状态词/会话行断言不动
- `test/wp11/labels-sync.test.js:22-29`：不改映射表
- `test/wp12/cli-assets.test.js:119-132`：**不改**（`USAGE_LINES` 仍 25 行、前 8 行逐字不变）
- `test/wp11/purity.test.js`：31 词表不动，新增 `src/core` 文件必须被同一扫描覆盖
- **新增** `test/wp12/health.test.js`：覆盖 `computeHealth({ state, now })` 三组等值边界（30000 / 50000 / 900000ms）
- 通则：新用例放本迭代新增测试文件，覆盖附录 A 全部输出基线与附录 B 两个口径；**不得删除既有断言或放宽 `Then` 让覆盖表变绿**

**(3) D-3 的 `health.nodeTimeoutMs` 缺省值**：**30000 毫秒**。实例创建时写入 `state.json` 顶层 `health.nodeTimeoutMs`；已存在实例读取时缺该字段按缺省 30000 处理（不批量回填历史快照）；回写 `health` 时**保留**该字段、不得被计算结果覆盖。判定 `nodes[].state === 'running' && now − startedAt > health.nodeTimeoutMs`（严格大于）；本迭代运行期 `GRAPHS` 无节点级 `timeout`，**不声称读取工作流定义层**（若未来图带节点级 `timeout`（秒）则按节点级优先）。AC-13 超时夹具写 30000 + `startedAt=now-31s`；AC-14/15/16 显式覆盖 300000，使 70s/50s 运行时长不先命中红档。

**(4) `computeHealth({ state, now })` 的 `now` 注入**：D-3 L963 给完整签名 `computeHealth({ state, graph, traces, now })`，纯函数、`now` 为**可注入毫秒时间戳**（缺省 `Date.now()`）、不读盘不取系统时间。AC-13/14/15 机检、头部 L8、§3.3 L531 共 9 处用简写 `computeHealth({ state, now })` 强调注入 `now`——round7 §7.2 判定「简写 vs 完整签名」构造方式与声明一致、不构成冲突。**精确等值边界只在此单元级注入固定 `now`**：节点超时 30000 不命中 / 30001 命中；P90 50000 不判慢 / 50001 判慢；TTL 900000 不命中 / 900001 命中 / 899999 不命中（单测文件 `test/wp12/health.test.js` 由 D-8 声明新增）。**CLI 级一律只用远离边界的安全余量**，绝不在 CLI 断言「恰好等于」。

**(5) `badLines` 既有来源**：**不是本迭代新增能力**。实测 `src/persistence/instance-store.js:293-315` 的 `readEvents` 已返回 `{ ok, events, badLines }`（`:299` ENOENT 返回 0；`:304` 声明计数；`:312` 单行 `JSON.parse` 失败 `badLines += 1`；`:315` 返回）。D-7 L1006 只要求 `event-bus.js:110-122` 的 `replay` 把该既有值透出（返回值改 `{ events, badLines }` 或等价附带字段），不改 `readEvents` 计数口径、不改 `emit` 落盘顺序、不改 `subscribe`；`src/daemon/server.js:225-232` 的 `instance.events` 返回同源带上；A-13 的跳过行计数与读取层 `badLines` 同源。round7 §2.2 判定「既有能力透出，非夹带」。

---

## 5. 未决问题与假设（U-1 ~ U-9）

逐条注明「不阻塞」及依据（含 round1~round6 的来龙去脉）：

| U | 内容 | 不阻塞 | 依据 / 来龙去脉 |
|---|---|---|---|
| U-1 | P90 最小样本数取 5 是需求补全口径，评审若改只改常量 | **不阻塞** | B-5 L848、B-2 L817、BR-19；round1 §5 起即判「只影响常量、不影响功能结构」 |
| U-2 | 真实宿主可能不提供退出码/关键输出行数/日志引用；按「未提供」降级，真实宿主格式补齐留后续真机迭代 | **不阻塞** | B-5 L849、BR-05/21、§1.3 L58；round1 起列为建议级、非阻断 |
| U-3 | 终态集合取「已完成/失败/已取消/已中断」四种，进入后统一「已结束」（基线原文「实例完成或终止」）；若评审要求失败仍显「需关注」需调 BR-13 | **不阻塞（需评审确认）** | B-5 L850、BR-13；round2 §5.1 D-C 起历轮「接受，不阻塞」（round3/4/5/6/7 D-C 均保持） |
| U-4 | 基线 L541 要求健康度「影响路由决策」，当前核心无基于健康度的路由分支，I1.9 规划 L830-836 也未含该子项；本迭代只保证健康度可被读取、不新增调度/路由行为 | **不阻塞（基线偏差，需评审/主控确认豁免）** | B-5 L851、§1.3 L56；**来龙去脉**：round1 F-12 指出「U-4 只说『留待后续』，未标为基线偏差」→ round2 F-12 改为「登记为基线偏差（基线 541 行），需评审/主控确认豁免」→ round2 F-07 / round3 F-07 补「不阻塞」字样 → round3~round7 §5.2 D-A 均裁决「接受，不阻塞」 |
| U-5 | 追踪数据只追加、不清理、不轮转；保留期策略留后续 | **不阻塞** | B-5 L852、§1.3 L59、D-2；round1 起列为非阻断 |
| U-6 | `orch trace show` 本次只提供文本输出；JSON 输出与 OTel 导出留后续或 I1.12 | **不阻塞** | B-5 L853、§1.3 L51、§2.3.2 L139、D-5；round1 §2 已判 OTel 双处排除 |
| U-7 | 基线 L564「会话状态变更进执行日志摘要、不进主审计」，而 `main@70277df` 的 `orchestrator.js` 已有 12 处逐条会话状态事件；本迭代口径 = 既有 12 处（保留 4 / 冻结 7 / 复用 1，逐处见 D-7）**仍在发射、行为不变、不新增同类发射点**；除此之外只新增 `execution.summary` 一条会话级记录；逐条事件移除属基线 L898 由 I1.12 承接 | **不阻塞（基线偏差，需评审/主控确认豁免）** | B-5 L854、§1.3 L57、D-4 L974、D-7 L1018-1022、AC-24；**来龙去脉**：round2 F-02 澄清 §2.4「存量」措辞与「仍在发射」的张力 → round3 F-07 统一为「新增的会话级记录**类型**只有摘要；既有 12 处逐条发射照旧」→ round4 F-07 / v4 F-02 同步 → round6 §6.3 实测 `grep -c "object: 'session'"` = 12（D-7 上限 13 口径成立）→ round7 D-B 接受 |
| U-8 | 夹具表无「两次以上回流」场景（`backflow-once` 只 1 次；`backflow-twice`/`retest-fail` 映射 `rounds-exceeded` = 1 次回流 + 升级）；AC-07 只断言「一次回流下同节点两轮不合并、不覆盖」、回流链恰 1 条；两次以上回流的合并不覆盖由 BR-07 约束，夹具扩展留后续 | **不阻塞** | B-5 L855、§3.3 L526、AC-07 L279；v6 新增（round6 §6.1 U 8/8 不阻塞），round7 §6.1 U 9/9 不阻塞 |
| U-9 | 基线 §5.2 L613 把事件日志画在 `.orch/events.jsonl`，当前实现与 `main@70277df` 一致落在 `.orch/instances/<id>/events.jsonl`（`paths.js:51-53` 的 `eventsPath`） | **不阻塞（既有布局偏差）** | B-5 L856；**来龙去脉**：round6 §2.3 指出「既有偏差未登记」并列为 F-09（建议级）→ v7 F-09 新增 U-9 登记为「既有布局偏差、不阻塞、本迭代不改布局不迁移」→ round7 §5.2 D-F 由「未登记」转「已登记，接受，不阻塞」 |

### 5.1 两条口径的结论（P90 样本来源 / TTL 50% 来源，及 `health.nodeTimeoutMs` / `pendingAt` 兜底）

- **P90 样本来源（B-2 / BR-19）**：样本 = 同一实例内**已结束节点轮次跨度**的时长（同一节点多轮各计一条；状态为已完成/失败/已升级/已取消的跨度都计入；当前运行中节点不计入）；P90 取升序第 `⌈0.9 × N⌉` 条（1-based 最近秩法）；`N < 5` 不触发「慢」；任一运行中节点当前运行时长**严格大于** P90 即判「慢」。**兜底**：基线只写「超过 P90」未给数值与样本范围，由本需求补全（需评审确认但不阻塞，U-1）；「慢」不会被「需关注/节点超时」抢先命中，靠 D-3 的实例级阈值 **`health.nodeTimeoutMs`**（缺省 30000、AC-14 显式覆盖 300000）兜底——所有时间型判定统一由 `computeHealth({ state, now })` 读同一个 `now` 与 `health.nodeTimeoutMs`，70s 运行时长 < 300s 阈值时红档不成立，P90 判定才生效。
- **TTL 50% 来源（B-3 / BR-20）**：基线 L537 原文「超过 TTL 50%」，需求全文（§2.5、BR-12、BR-20、AC-15、B-3）一律用「超过」不用「达到」；本需求采用默认 **TTL 30 分钟**（只用于健康度判定与展示，不写入交接包、不改状态机）；50% = 严格大于 15 分钟（> 900000ms，900001ms 起命中，恰好 900000ms 不命中）；起算点优先交接包既有 **`pendingAt`**、缺失退回 `createdAt`、两者都无则不参与判定、不报错；本迭代不实现 `pending → expired` 自动过期、不生成过期升级。**兜底**：交接包记录已有 `pendingAt` / `expiredAt` 但**没有 TTL 数值字段**（B-3 L826），TTL 数值与起算点由本需求补全（需评审确认但不阻塞，U-1 / D-D）；起算时间由既有 `pendingAt` 字段兜底、不新增字段（夹具 `INST-003` 写 `pendingAt` 缺失且无 `createdAt` 验证该分支）；等值边界由 `computeHealth({ state, now })` 注入固定 `now` 兜底，CLI 级只用 14:55 / 15:05 与 15:00 各留 5 分钟安全余量。

---

## 6. Given 可构造性核查（逐 AC，重点）

### 6.0 公共构造口径与四条特殊规则（先读本节，再看逐 AC 表）

- **独立 root**：每个 AC 各自一个 `/tmp/maestro-i19-<name>` 项目根，绝不放进仓库；所有路径断言只用相对路径或结尾匹配，不断言 `/tmp` 与 `/private/tmp` 差异（需求 §3.1 前言 L204）。
- **`NODE_ENV=test` 接缝**：所有命令注入；CLI 一律 `node "$MAESTRO_REPO/bin/orch.js" ...` 在夹具目录内执行；`orch run` **必须带 `--cwd .`**（缺则打印用法并以参数错误退出，v6 实测）。
- **宿主夹具**：夹具根 `.orch/hosts/mock.json` 的 `launch.command`/`launch.args` 指向仓库内 **`test/fixtures/mock-acp-agent.js`**（实测文件名是 `.js`；任务简报列 `.mjs` 系笔误，需求 §3.3 L525 / D-4 L979 / A-0 L563 一致用 `.js`）；§3.3 L525 总口径「运行时加 `--host mock`」；验收属 B 类零 DSH，不需真实 DSH / 模型凭据。
- **机检统一命令**：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"`；架构检查统一带完整 31 词 `--forbid` 词表。
- **快照夹具启动顺序（必须照做，§3.3 L533）**：核心启动 `reconcileOnBoot`（`orchestrator.js:4059-4078`）会把非本代 `created`/`running` 判 `interrupted`，健康度变「已结束」；故**先在空目录拉起核心**（执行 `instance status INST-001` 返回「不存在」并留下 daemon）→ **再写** `state.json`（一律带 `schemaVersion: 2`）/ `state/traces.jsonl` → 最后才执行 `instance status`。
- **规则 A（精确等值边界）**：节点超时 30000ms、P90 50000ms、TTL 900000ms 的「恰好等于不命中 / 超出 1ms 命中」**只在 `test/wp12/health.test.js` 对纯函数 `computeHealth({ state, now })` 注入固定 `now` 断言**；CLI 级绝不断言等值。
- **规则 B（CLI 级只用安全余量）**：时间型条件不拨钟、不 `sleep`、`startedAt`/`pendingAt` 直接写成当前时刻之前的绝对 ISO 时刻、读取时按真实 `Date.now()` 计算；CLI 级只用 31s vs 30s、70s/30s vs P90 50s、15:05/14:55 vs 15:00（各留 1s / 20s / 5min 安全余量，δ>0 不可能反转结论）。AC-14/15/16 显式写 `health.nodeTimeoutMs = 300000` 避免红档抢先。
- **规则 C（`--stop-after 3` 冻结窗口，AC-08 / AC-27）**：driver 以 `--keep` 会打印摘要后**阻塞等 SIGINT**（`code-loop-driver.mjs:801-809`），因此必须**第二进程/后台启动**：`... --scenario backflow-once --stop-after 3 --keep & DRV=$!` → **轮询 `.mock/stopped-after-3`**（文件出现即继续，不用固定 `sleep`）→ 文件出现后在同夹具目录执行 `trace show` / `instance log` → 断言完成**写 `.mock/release` 放行**并 `kill -INT $DRV`。`--stop-after 3` 经 `MAESTRO_TEST_STOP_AFTER=3` 传给核心，由核心在 `counters.dispatchCount` 达到 3、派发第 4 步之前写标记并等待放行（`code-loop-driver.mjs:386-392`/`:714-716`；`orchestrator.js:354`/`:4164-4183`/`:3141`），**不采用 `retest-hold`**（第 4 步已派发会多出「进行中」跨度，与 A-3 的 3 行基线不符）。
- **规则 D（取消路径，AC-26）**：不用 `--hold-session`（挂住时无 `tool_call`、`applyCancel` 跳过 idle 会话不写摘要）；改用 `mock-acp-agent.js` 既有 `--turn-delay-ms 30000`，夹具监听 `events.jsonl` 中该会话 `to: 'tool_running'`（`reason: 'session.state'`）的事件后，第二进程执行 `orch cancel --instance INST-001`。该 run 仍在 `activeRuns`（`finished=false`），因此走 **live 取消 `cancelLive`**（`orchestrator.js:3746-3747`）→ 以 `ctx` 调 `applyCancel(handle.instanceId, loaded.state, emit, ctx, handle)`（`:3801`），**不是** `:3762` 的无 `ctx` 分支；`applyCancel` 落盘前把 `session.toolName` 置空（`:3843`），故四项一律「未提供」。

### 6.1 27 条 AC 逐条核查（层级 → 构造方式 → 是否可构造）

| AC | 层级 | 构造方式（独立 root + `NODE_ENV=test` + 具体开关/命令） | 是否可构造 |
|---|---|---|---|
| AC-01 | 夹具实跑 + 机检 | `/tmp/maestro-i19-append`；`run --cwd . --template single --task "写一份说明"`；启动后轮询 `events.jsonl` 出现首条即复制，运行结束比对旧行前缀字节哈希一致、`seq` 严格递增无空洞、条数只增不减 | **可构造** |
| AC-02 | 夹具实跑 + 机检 | `/tmp/maestro-i19-chain`；同根两次 `run`（INST-001 / INST-002）`--template single`；`instance log INST-001 --format json` 规范化序列化 SHA-256 逐条比对、断点 0、两链起点相同后续不同；架构检查 31 词纯净扫描 | **可构造** |
| AC-03 | 夹具实跑 + 机检 | `/tmp/maestro-i19-regress`；`--template single` / `code-loop` / `task-loop` 各跑一次；输出与 `test/templates/**` 逐字基线比对；机检失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 差集 = 0、条数只增不减；`dependencies` 键数 = 0 | **可构造** |
| AC-04 | 夹具实跑 + 机检 | `/tmp/maestro-i19-fail-summary`；预置 `.orch/hosts/mock.json` + 开关 `--fail-tool`；`run --cwd . --template single --task "执行 out/run.js"`（宿主接缝按 §3.3 L525；夹具命令行 `--host mock` 口径差异见 §6.2）；`trace show` + `instance log` 文本 / `--format json` 三视图逐字断言（A-4 / A-12）；`host-logs/T-001.log` 预置在项目根、非实例目录；再跑成功节点确认同样有四项摘要 | **可构造**（夹具命令行 `--host mock` 口径差异见 §6.2 / 文末开放点） |
| AC-05 | 夹具实跑 + 机检 | 同上，改用独立变体开关 `--fail-tool-no-refs`（只给命令与退出码）；`trace show` + `find .orch/instances/INST-001 -type f` 确认无完整日志副本；`host-logs/` 位于项目根之外 | **可构造**（同上口径差异） |
| AC-06 | 夹具实跑 + 机检 | `/tmp/maestro-i19-span`；`run --cwd . --template code-loop --task "实现并测试"`；`trace show`；检查 `.orch/instances/INST-001/state/traces.jsonl` 存在且每行一条跨度、`handoff_ids` 与状态一致 | **可构造** |
| AC-07 | 夹具实跑 + 机检 | `/tmp/maestro-i19-backflow`；`code-loop-driver.mjs --root ... --scenario backflow-once`（驱动自行退出）；`trace show`；断言 4 跨度（T-001/T-002 各 2 轮）、回流链恰 1 条（`HO-002 round=2 consumed`）、`HO-003` 的 `edge.kind='retest'` 不计入回流 | **可构造** |
| AC-08 | 夹具实跑（后台冻结） + 机检 | `/tmp/maestro-i19-trace-chain`；**后台** `code-loop-driver.mjs --scenario backflow-once --stop-after 3 --keep & DRV=$!` → 轮询 `.mock/stopped-after-3` → `trace show INST-001` 对照 A-3 → 写 `.mock/release` + `kill -INT $DRV`（规则 C）；断言 3 条已完成跨度、无进行中行、两角色、`第 2 轮 ... HO-002 已完成` | **可构造** |
| AC-09 | CLI 快照（3 夹具） | `/tmp/maestro-i19-trace-empty`（先起核心再写 `state: 'created'`、`nodes[0].pending`、无 `traces.jsonl`）/ `-single`（跑完单节点）/ `-missing`（空根）；分别 `trace show INST-001` / `INST-001` / `INST-999`，对照 A-1 / A-2 / A-5 与退出码 0/0/1 | **可构造** |
| AC-10 | 夹具实跑 + 机检 | `/tmp/maestro-i19-trace-readonly`；`run --cwd . --template code-loop --task "实现并测试"`；连续三次 `trace show`；比对 `state.json` / `events.jsonl` 字节哈希不变、三次输出字节一致 | **可构造** |
| AC-11 | CLI 快照 | `/tmp/maestro-i19-health-green`；按规则先起核心再写快照（`state:'running'`、T-001 done / T-002 pending、**无 running 节点**、`sessions:[]`、`escalations:[]`、`health.nodeTimeoutMs=300000`）；`instance status` + `workspace/status.md` | **可构造**（30s 阈值与查看时长均不参与判定，F-07） |
| AC-12 | 夹具实跑 + CLI 快照 | `/tmp/maestro-i19-health-ended`；`run --cwd . --template single --task "写一份说明"` 跑完 `instance status`；另造带历史 `expired` 交接包的四终态（completed/failed/cancelled/interrupted）快照复验「已结束」不回升 | **可构造** |
| AC-13 | CLI 快照（6 夹具） + **单元** | 6 个独立快照各只放一种红条件：升级 `escalations:[{state:'pending'}]` / 超时 `nodes[0].state='running'`+`startedAt=now-31000`+`health.nodeTimeoutMs=30000` / 崩溃 `sessions[].quarantined=true`+绑定节点 `failed` / 角色 `code-loop` 中 `T-001` 绑定会话 `state:'escalated'`+节点 `review` / 各自一条 `state:'rejected'` / `state:'expired'` 交接包；按规则先起核心、带 `schemaVersion:2`；**精确等值 30000/30001 只在 `test/wp12/health.test.js` 注入固定 `now`**（规则 A）；CLI 级 31s vs 30s 安全余量（规则 B） | **可构造** |
| AC-14 | CLI 快照（3 实例） + **单元** | 3 个 `code-loop` 实例各写 `state.json` + `state/traces.jsonl`（5/5/4 条已结束跨度 10/20/30/40/50s）+ 运行中 `T-006`（`startedAt` = now-70000 / now-30000 / now-70000）；**三个都写 `health.nodeTimeoutMs=300000`**；三次 `instance status`；**P90 等值 50000/50001 只在单元级注入固定 `now`**；CLI 级 70s/30s vs P90 50s 安全余量 | **可构造** |
| AC-15 | CLI 快照（3 实例） + **单元** | 每实例只一条 `pending` 包：`pendingAt=now-895000`(14:55) / `now-905000`(15:05) / 缺失（且无 `createdAt`）；其余 `running`、无运行中节点；三次 `instance status`；**TTL 等值 900000/900001/899999 只在单元级注入固定 `now`**；CLI 级 14:55/15:05 与 15:00 留 5min 安全余量 | **可构造** |
| AC-16 | CLI 快照（前后两次读取） + 机检 | `/tmp/maestro-i19-health-event`；先起核心 → 写快照（无 `health.level`、`nodeTimeoutMs:300000`、无异常）→ 第一次 `instance status`（首次写回按 BR-15 不算变化、不追加事件）→ **读回保留 `health`**、只追加 `escalations:[{state:'pending'}]` + `updatedAt` → 第二次 `instance status` + `instance log` 文本 / `--format json`；对比命令前后 `events.jsonl` 条数、文本行对照 A-8 | **可构造** |
| AC-17 | 夹具实跑 | `/tmp/maestro-i19-health-visible`；`task-loop-driver.mjs --root ... --scenario dispatch-fail-first`（场景文件 `test/fixtures/scenarios/task-loop/dispatch-fail-first.json`；终态 `suspended`、`sessions:[]`、仅 1 条 `dispatch_failed` 升级；`orch run` 退出码非 0 属预期）；`instance status` + `workspace/status.md` | **可构造** |
| AC-18 | 夹具实跑 + 机检 | `/tmp/maestro-i19-health-readonly`；同 `dispatch-fail-first`（保存该次运行终端输出）；连续三次 `instance status` + 三次 `trace show`；四组状态深比较相等、升级条数不变、收尾输出无健康度行 | **可构造** |
| AC-19 | 夹具实跑 + 机检 | `/tmp/maestro-i19-regress-status`；`single` 与 `code-loop` 各跑一遍，保存 `instance status` / `instance graph --format json` / `instance graph`；删除健康度行后与基线逐字比对、`graph` 输出字节比对 | **可构造** |
| AC-20 | 机检（仓库静态检查） | 无业务夹具；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` → `0`；`purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` → `exit 0`；`labels-sync` 与纯净扫描用例通过；命令从仓库根在 `NODE_ENV=test` 下执行、不读写 `/tmp` 业务数据 | **可构造** |
| AC-21 | 夹具实跑 + 机检 | `/tmp/maestro-i19-chain-legacy`（预置 3 条无指纹旧记录 `seq` 1~3）/ `-truncated`（复制前 3 行后 `head -c` 去掉最后一个字符）；各跑一次 `single`；`instance log` 文本 / `--format json`；断言旧 3 行字节不变、新 `seq` 从 4、首条 `prev_event_hash` = 旧第 3 条规范化指纹、`badLines=1`、退出码 0、文本视图对照 A-13 | **可构造** |
| AC-22 | 夹具实跑（第二进程查看） | `/tmp/maestro-i19-trace-running`；`run --cwd . --template single --task "写一份说明"` + 宿主夹具 `--hold-session` 保持会话不落定；**另一进程** `trace show`（对照 A-10）→ 放行宿主会话 → 再 `trace show`（`跨度 1 条`、无「进行中」） | **可构造**（宿主接缝口径见 §6.2） |
| AC-23 | CLI 快照（3 夹具） | `-missing` 删 `traces.jsonl` / `-badline` 写 1 条 `{"trace_id":` 半行 + 2 条正常跨度 / `-notime` 删跨度 `start_time`/`end_time`；各执行 `trace show` + `instance status`；断言退出码 0、无堆栈、跳过行数 1、正常跨度 2、`notime` 的 P90 样本数 0 且档位不为「慢」 | **可构造** |
| AC-24 | 夹具实跑 + 机检 | `/tmp/maestro-i19-audit-grain`（`--fail-tool`）+ `/tmp/maestro-i19-audit-legacy`（预置 3 条逐条会话记录）；`instance log` 文本 / `--format json`；断言 `execution.summary` 每会话恰 1 条、四项与夹具一致、除摘要外无新增会话级事件类型、遗留实例查看前后字节不变；`grep -c "object: 'session'" src/core/orchestrator.js` ≤ 13 | **可构造**（夹具命令行 `--host mock` 口径差异见 §6.2 / 文末开放点） |
| AC-25 | 夹具实跑 + 机检 | `/tmp/maestro-i19-chain-corrupt`；预置 3 行不含任何 JSON 结构的乱码；`run --cwd . --template single --task "写一份说明"`；`instance log` 文本 / `--format json`；断言旧 3 行字节不变、新 `seq` 从 1 连续无空洞、首条 `prev_event_hash` 为 64 个 `0`、跳过 3 行、两条命令退出码均 0 | **可构造** |
| AC-26 | 夹具实跑（第二进程取消） | `/tmp/maestro-i19-cancel-summary`；`mock-acp-agent.js --turn-delay-ms 30000`；**`run --cwd . --template single --host mock --task "执行 out/run.js"`**；监听 `events.jsonl` 出现 `to:'tool_running'` → 第二进程 `orch cancel --instance INST-001`（**规则 D：走 `cancelLive` live 分支，非 `:3762` 无 `ctx` 分支**）；`instance log`（A-14 四项全「未提供」）+ `instance status`（`cancelled` / `ended`） | **可构造** |
| AC-27 | 夹具实跑（后台冻结） + 机检 | `/tmp/maestro-i19-summary-rounds`；**后台** `code-loop-driver.mjs --scenario backflow-once --stop-after 3 --keep & DRV=$!` → 轮询 `.mock/stopped-after-3` → `instance log` 文本 / `--format json` + `trace show` → 写 `.mock/release` + `kill -INT $DRV`（规则 C）；断言 `T-001` 2 条摘要（`detail.round` 1/2）、`T-002` 1 条、每会话恰 1 条、全文摘要数 = 会话数 | **可构造** |

**结论：27/27 在声明层级均可构造**（与 round7 §5.4「AC-13/14/15/16 四条层级 → 构造 → 可得，全部为可得」及 §7.1「无不可构造判据」一致）。构造依赖两类东西：① 既有接缝（`--stop-after` / `--keep` / `--turn-delay-ms` / `--hold-session` / `reconcileOnBoot` / `readEvents.badLines` / `cancelLive`）；② 本迭代**已声明的新增交付项**（`src/core/health.js` 的 `computeHealth`、`test/wp12/health.test.js`、`src/core/trace.js`、两个 `--fail-tool*` 开关、5 个 `render*` 纯函数）。round7 §6.4 已说明「终端实际输出本轮观测不到」，故本节的「可构造」是**声明层级**判定，终端文案留 S3 实现后按附录 A 逐字取证，不冒充实跑。

### 6.2 构造口径差异登记（不自行修正，需主控裁决）

需求 §3.3 L525 的宿主总口径为「把 `launch.command`/`launch.args` 指向 `test/fixtures/mock-acp-agent.js`，**运行时加 `--host mock`**」，AC-26 L500 与两个 driver（`code-loop-driver.mjs:494` / `task-loop-driver.mjs:253` 实测均显式传 `'--host','mock'`）也带该参数；但 AC-04 L250 / AC-05 L261 / AC-24 L478（以及 AC-22 L456）的直接 `run` 夹具命令行**未显式带 `--host mock`**。代码侧仅作约束理解：`src/cli/main.js:806` 仅当 `flags.host` 为字符串才注入 `hostId`，`src/adapter/factory.js:43,50` 默认 `hostId='dsh'`、`src/adapter/host-config.js:39-40` 配置路径为 `<root>/.orch/hosts/<hostId>.json`，故省略参数时会解析 `dsh.json` 而非夹具预置的 `mock.json`，`--fail-tool` / `--fail-tool-no-refs` / `--hold-session` 开关可能不被拉起（既有 `test/wp9/cli-e2e.test.js:34-41` 采用的是「写 `dsh.json`、不传 `--host`」的另一套口径）。**需求理解不自行补写命令行参数、不改任何 `Then` 或判据**：相关 AC 仍按 §3.3 L525 总口径判「可构造」，此口径差异登记为「需主控裁决」（见文末「附：本纪要的开放点」第 3 条），属夹具示例文字对齐、不影响判据强度。

---

## 7. 与上一迭代（I1.7）的契约差异

I1.7「产物类型隔离 + 代码 worktree 集成」留下三项与本迭代事件链/健康度相邻的既有行为。**本迭代不改这些既有行为**（与 D-11「明确不动」同精神）：

| I1.7 契约 | 现状（代码实测，仅作约束理解） | 对本次事件链 / 健康度的影响 | 本迭代是否改动 |
|---|---|---|---|
| **`includeBranch` 三视图开关** | `renderNodeRow`（`src/cli/render.js:508`）的 `includeBranch` 控制 code 角色分支/合并片段：`orch run` 收尾路径不传该标志（`main.js:950`，逐字红线）、`orch instance status` 传 `true`（`main.js:1068` / `:1076`）、`orch instance graph` text 由 `renderGraphText` 直接调 `codeBranchFragment`（`render.js:1398`）。三视图 = run（不显示分支）/ status（显示）/ graph（显示） | 健康度新行**只**由 `statusCommand`（`main.js:999-1070`，约 `:1062-1065`）在实例状态行之后插入（D-7 L1029），**不进 `graph`、不进 `run`**，也不触碰 `renderNodeRow` / `renderNodeLines` / `renderEscalationBlock` / `renderGraphText` 的分支片段逻辑。实作若顺手在节点行/升级块/图里加健康度，会同时破坏 I1.7 三视图红线与 BR-18 | **不改**。I1.7 的 `includeBranch` 三视图分工原样保留；健康度是独立新增行，与既有节点行的分支片段互不影响 |
| **`ROLES.developer.artifact_type = 'code'`** | `src/templates/index.js:28-37`（`:33` `artifact_type: 'code'`）；`code` 角色走独立 git worktree + 分支，`workspace.js:104` / `orchestrator.js:1914` 以 `ROLES[roleId]?.artifact_type === 'code'` 判定；`doc-artifact.js:144-151` 角色级 `artifact_type` 覆盖节点级策略 | ① 事件链：`prev_event_hash` 对**所有**既有发射点一视同仁接链，含 code 角色合并路径产生的状态迁移（`run.completed` / `verification.failed` / 合并升级等），不因其来自 worktree 而跳过；② 健康度：读取的 `nodes[].startedAt` / `nodes[].roleId` / `sessions` / `escalations` 在 code 角色下同样成立，但健康度判定**不读取** branch / worktree / mergeStatus 字段（D-3 只投影 `roleId` + `sessions`）；`code` 角色的分支片段仍只属 CLI 节点行，不进健康度原因句 | **不改**。不改 `artifact_type` 取值、不改四类产物隔离策略、不改健康度的字段读取面 |
| **worktree 合并队列** | `orchestrator.js:1926-1941` 每实例一条串行 `mergeQueues`（`createMergeQueue`），节点收尾 `enqueueCodeMerge`（`:2570-2572`）、合并升级重入（`:4930`）；`code-isolation.js:261-262` 说明队列串行语义 | 合并发生在「节点本轮收尾」附近，与 D-2 要求的「跨度在节点收尾时写入、早于 `maybeStopAfter`(`:3141`) 与 `advance()`(`:3157`)」**时序邻接**：实作写跨度时不得依赖合并队列的完成结果，否则 `--stop-after 3` 冻结窗口的跨度条数会漂移、A-3 的 3 行基线对不上。合并队列产生的事件同样接链、同样受 `seq` 单调约束 | **不改**。不改合并队列的串行语义、不改 hook 位置；跨度写入按 D-2 独立落 `traces.jsonl` |
| （附）worktree 生命周期 | I1.7 §1.3 L51 把「实例终止时 worktree 保留/清理策略」列为范围外 | 与 I1.9 的事件链/健康度无关 | **不改**（承继为 §1.2 O-10，I1.9 不涉及） |

> 一句话：I1.9 的事件链是**横向覆盖**所有既有发射点（含 I1.7 code 角色路径），健康度是**只读新增**横向读取既有状态字段；两者都不改写 I1.7 的隔离 / 三视图 / 合并队列契约。回归判定见 §8。

---

## 8. 回归红线清单（R-1 ~ R-14，逐条给可判定口径）

| R | 红线 | 可判定口径（命令 / 比较） |
|---|---|---|
| R-1 | 三主链 `single` / `code-loop` / `task-loop` 运行期输出逐字不变 | 三链各跑一次 `--cwd .`，终端输出与 I1.7 收口基线 / `test/templates/**` 既有逐字基线**字节相等**；不得多出健康度行、追踪行或任何文字/顺序变化（BR-17、AC-03、§1.3 L63） |
| R-2 | `orch instance status` / `orch instance graph` 既有非健康度输出不回归 | 把 `instance status` 输出**删除健康度行后**与基线逐字比较；`instance graph` 文本与 JSON 输出与基线**字节比较**、不出现健康度字段（BR-18、AC-19、D-9） |
| R-3 | 健康度只允许以「新增一行」出现 | `instance status` 在实例状态行之后**恰多 1 行** `健康度 …`，原有各行文字与相对顺序不变（A-6）；`status.md` 在 `- 状态：…` 之后恰多 1 行 `- 健康度：…`，其余行逐字不动（A-7、D-8 的 `status-doc.test.js:68-130`）；`graph` / `run` / `orch trace show` 不含健康度行 |
| R-4 | 零第三方运行时依赖 | `node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`；不得引入任何日志/哈希/追踪库，全部 Node 内置模块（AC-20、D-6、NF-5） |
| R-5 | 中文唯一来源 `src/cli/labels.js` | 新增中文全部来自 `labels.js`；`src/core/status-text.js` 只引用 `labels.js` 键做镜像（`labels-sync` 测试锁定），`src/core` / `src/daemon` 不得 import CLI、不得新增中文硬编码（AC-20、D-6、A-9） |
| R-6 | 31 词纯净扫描 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <D-6 的 31 词全表>` 必须 `exit 0`；新增 `src/core/health.js` / `trace.js` 纳入同一扫描；`src/core`/`src/daemon` 不出现模板名、角色字面量、`if host ==` / `switch (host)` 分支（AC-02/03/20、D-6） |
| R-7 | 事件**先落盘再广播** | `src/core/event-bus.js:97-104` 顺序不改（`appendEvent` 成功后才 `broadcast`）；`emit` 失败返回 `STORE_WRITE_FAILED` 且**不广播、不改内存状态**；`instanceId` 只作路由键、不落盘不广播；单实例串行队列不动（D-1、D-7、I1.1 硬约束 #4） |
| R-8 | `transit()` 唯一状态入口 | 状态迁移唯一入口 `orchestrator.transit()`（以磁盘最新快照为 `from` 重校验 + `save(expectedState)` CAS）；**任何地方不许直接 `store.save` 改状态**；健康度读取时重算只允许 D-3 L966 / D-7 L1011 声明的一次窄 CAS 写入（与 `saveState` 同路径），不得新开状态写入通道（I1.1 硬约束 #1、BR-16、D-3） |
| R-9 | `seq` 单调与 `ts` 同刻复用 | `seq` 严格单调、`ts` 不早于同实例上一条；事件 `ts` 必须复用状态变更的同一时刻（`startedAt`/`endedAt` 各自 `iso()` 会差 4~8ms），`event-bus.emit()` 已支持可选 `ts`；`seq` 与上一条 `prev_event_hash` 必须**同一次文件尾读**（D-1 L942），禁止两次读（I1.3 硬约束 #5/#6） |
| R-10 | 事件链 append-only / 旧行不改写不回填 | 旧记录（含升级前无标记记录、被截断半行、整份乱码行）**内容/顺序/字节/序号**运行前后一致、不回填 `prev_event_hash`；`readEvents` 的 `badLines` 计数口径不动；整份不可解析时新链 `seq` 从 1、旧文件一行不删/不改写/不改名（BR-01/22/25、AC-01/21/25、D-1） |
| R-11 | `USAGE_LINES` / `graph` / 既有事件行格式不动 | `USAGE_LINES` 仍 25 行且前 8 行逐字不变（`test/wp12/cli-assets.test.js:119-132` 不改）；`renderGraphJson` / `renderGraphText` 不改；`instance log` 既有事件行格式与相对顺序不变（仅对 `execution.summary` / `health.changed` 分派 + 末尾追加跳过行）；`trace` 用法不进主用法块（D-5、D-11、D-8） |
| R-12 | 既有路径工厂 / `nextSeq` 容错口径 / 12 处会话发射点不动 | `statePath` / `eventsPath`（`paths.js:47-53`）不改，只追加两个新导出；`nextSeq`「末行坏则前溯」容错口径不动（不新增第二条序号来源）；`grep -c "object: 'session'" src/core/orchestrator.js` 实测基线 12、本迭代结束**不得超过 13**（12 处既有 + 1 处 `execution.summary`），会话级事件类型只允许新增 `execution.summary` 一种（D-7、BR-23、U-7、AC-24/26） |
| R-13 | 全量测试「失败集合差集 = 0」、条数只增不减 | 基线 HEAD `70277df` = `1028 tests / 1019 pass / 8 fail / 1 skipped`；收口以失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 的**差集 = 0** 判定（不得新增超出基线 8 条的失败），测试条数只增不减；**不以「零失败/绝对全绿」判定**（见 §9 第 9 条） |
| R-14 | 完整执行日志不进实例目录 / 健康度只读 | `find .orch/instances/INST-001 -type f` 不存在宿主日志副本，核心只存摘要与引用、不读取完整日志正文（BR-05/16、AC-05/18、NF-4）；`state.json`/`events.jsonl` 在 `orch trace show` 前后字节哈希不变（BR-08、AC-10）；健康度不写入 `graph.json`、不调用状态迁移/升级生成/调度（D-3、BR-16） |

---

## 9. DoR 13 条逐条预判（绿 / 需主控裁决）

判据：`docs/templates/execution-template.md` §1.1（L202-218）。

| # | DoR 条目 | 预判 | 依据 |
|---|---|---|---|
| 1 | 头部版本已定稿、无「评审修复中/草稿」字样，附录 C 最后一版与头部一致 | **绿** | 头部 L7 = `v7`；附录 C 末条 L930 声明「一致为 v7」；round7 §6.1 脚本比对 `头部 == 末条 = true` |
| 2 | AC 编号连续、每条有 `场景类型/风险/引用` 三件套、都有 `**Then**` | **绿** | AC-01~AC-27 连续无重号；27/27 含 Given/When/Then + 三件套（round7 §6.1）；D-10 `grep -cE '^\*\*AC-'` = 27 |
| 3 | 每条 AC 至少有 `机检：`/`夹具：`/`架构检查：` 之一作为判定锚点 | **绿** | 27/27 三锚点齐（AC-09 架构检查显式写「无」属声明，round7 §4.9）；架构检查给完整 `--forbid` 词表（第 12 条） |
| 4 | BR 双向覆盖：每条 BR 至少被一条 AC 引用，AC 引用的 BR 都真实存在 | **绿** | 25/25，未被引用 []、悬空 []（本纪要 §3.1 映射表 + round7 §6.1） |
| 5 | 附录 A 的输出基线覆盖所有带文案的 AC；附录 D 的实现约束能直接指导编码 | **绿** | A-0~A-14 覆盖全部带文案 AC（本纪要 §4.1）；D-1~D-11 行号经 round7 §6.3 源码实测全命中（main.js 999/1061/1063/1196/1208/1209、render.js 988/508/567、status-text.js 310/313/319/320/330、orchestrator.js 3141/3157/4059/738、advance.js 177-179、paths.js 47-53、instance-store.js 299-315） |
| 6 | 附录 D「授权断言修改清单」点名文件 + 行号 + 只改哪一段；新行为打破既有精确断言时扩清单、不弱化功能 | **绿** | D-8 点名 6 个测试文件 + 行段 + 「只改期望文本、不放宽断言」通则（本纪要 §4.3(2)）；D-7 点名 10 个既有文件 + 2 个新增文件 + 行段（§4.3(1)）；round7 F-04 自核行号吻合 |
| 7 | 无阻塞实现的「假设」状态未决问题；前置条件里的命令与夹具都真实存在 | **绿（带注）** | U-1~U-9 共 9 条全部标「不阻塞」、无阻塞实现的假设；夹具实测存在：`code-loop-driver.mjs` / `task-loop-driver.mjs` / `mock-acp-agent.js` / `scenarios/task-loop/dispatch-fail-first.json` / `purity-check.mjs` / `baseline-failures.txt`。**注**：两个 `--fail-tool*` 开关、`test/wp12/health.test.js`、`src/core/health.js`、`src/core/trace.js` 是本迭代**已声明的新增交付项**（§3.3 L529 / D-4 L979 / D-8 L1041 / D-7 L1032），当前不存在属预期、非夹具缺漏（round7 §7.2 已排除） |
| 8 | 范围外清单明确（哪些留给后续迭代） | **绿** | §1.3 范围外 9 条 + 承自 I1.7 的 worktree 生命周期项，去向明确（I1.8 / I1.10a·b / I1.12 / 后续治理迭代），逐条标「不阻塞」（本纪要 §1.2） |
| 9 | 全量测试当前基线数字已记录，且为全绿 | **需主控裁决** | 基线 HEAD `70277df` 全量 **1028 / 1019 / 8 / 1**；**8 条为预存在、环境敏感失败**（NFR-02 readReview/verifyProducts p95、`core.stop` 5s 收敛、自动拉起 detached 真进程、`cursor.json` 并发消费、`main --cwd` 相对解析、task-loop 审核提示词绝对路径、早返回 turn-delay 时序），与本迭代无关（`progress.md` L18-20、`baseline-failures.txt` 实测 8 行）。回归口径**沿用 I1.7 已确立的「失败集合差集 = 0」**（不得新增超出基线 8 条的失败 + 测试条数只增不减），**不是绝对全绿**；第五轮评审实测 `1029 / 1019 / 9 / 1`，多出的 1 条为 `test/wp5/lifecycle.test.js` 并行临时目录清理竞争（单独复跑 6/6 通过），非需求引入，收口仍以差集判定。DoR 第 9 条字面「且为全绿」与实况不符，需主控确认按 I1.7 差集口径豁免（不改判定口径、不放宽） |
| 10 | 每条 AC 的 Given 可构造；写明独立项目根 + `NODE_ENV=test` 接缝 + 具体步骤 | **绿** | 本纪要 §6 逐条核查 27/27 判「可构造」；均写明独立 `/tmp` root + `NODE_ENV=test` + 具体开关/命令；无「历史会话为空闲或已隔离」类不可复现状态；快照夹具按 §3.3 L533「先起核心再写快照 + `schemaVersion:2`」规避 `reconcileOnBoot`；round7 §5.4 / §7.1 同判 |
| 11 | 同一编号跨 AC 语义不漂移（术语表单列一行区分） | **绿** | A-0 可变值约定 + B-1 术语表锁定：`start_time`/`end_time`（跨度，`traces.jsonl`）vs `startedAt`/`endedAt`（实例快照）是同一时刻在两层数据里的**字段名**、不是两种语义；`INST-001`/`INST-999` 固定含义；`pending`/`consumed`/`rejected`/`expired` 状态词沿用基线 §3.4；`round` 取回流交接包的接收轮次；`suspended` 非终态（round7 §7.2(6)）。round7 §5.1 状态词与基线逐字一致。本迭代无 `reject` vs `deny` 之类混用 |
| 12 | 架构检查必须给可执行命令；AC 里写出完整 `--forbid` 词表 | **绿** | AC-02 / AC-03 / AC-20 均写出完整 `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词全表>`（D-6 L995-999 原样）与 `node -p "Object.keys(require('./package.json').dependencies||{}).length"` → `0`；非「执行架构扫描」这类空话 |
| 13 | S0 评审闭环已 PASS：存在 `review-round1..k.md` 且最后一轮总判 PASS、F 项清零；首轮起每轮含「规划原文逐句覆盖表」；最终轮无 `部分/缺漏/越界/收窄`、反向扫描无「夹带」；头部版本与附录 C 末行一致 | **绿** | S0 共 **7 轮独立评审**（`review-round1.md` ~ `review-round7.md` 齐全、不覆盖不合并）；最终 **round7 总判 PASS、阻断 0 / 建议 0、F 项清零**（round6 的 F-01~F-10 全部闭合：已修 10 / 未修 0 / 引入新问题 0）；**规划 12/12 覆盖**、非「覆盖」条目 0、无 `部分/缺漏/越界/收窄`；**反向扫描无「夹带」**（AC-26/27、A-14、A-0、A-6 附、`health.nodeTimeoutMs`、`now` 注入、`badLines` 均归基线或已声明交付项）；头部 v7 == 附录 C 末行 L930 v7 |

**汇总**：13 条中 **12 条绿 / 1 条需主控裁决**（第 9 条，口径偏离已如实写明，非放宽判定）。另有 §6.2 登记的夹具命令行 `--host mock` 口径差异、U-4 / U-7 的「需评审/主控确认豁免」书面留痕，一并列入文末开放点。

---

## 附：本纪要的开放点（需主控裁决，非评审复核）

以下为需求理解阶段登记的口径差异 / 待确认项，**不构成对评审结论的复核或改写**，不自行补写、不改任何 `Then` 或判据：

1. **U-4 / U-7 的「需评审/主控确认豁免」书面留痕**：需求正文（§1.3 L56/L57、B-5 L851/L854）自述两条基线偏差需主控确认豁免；评审 round7 §5.2 已裁决「接受，不阻塞」，但按职责分工需求理解不替主控拍板，这两条豁免的书面确认仍待主控留痕（不阻断开工）。
2. **DoR 第 9 条字面「且为全绿」与实况不符**：见 §9 第 9 条；请主控确认沿用 I1.7「失败集合差集 = 0」口径。
3. **AC-04 / AC-05 / AC-24（及 AC-22）夹具命令行未显式带 `--host mock`**：见 §6.2；与 §3.3 L525 总口径、AC-26 L500、两个 driver 不一致，代码侧默认 `hostId='dsh'`。请主控裁决以 §3.3 总口径（夹具补 `--host mock`）还是以夹具预置 `dsh.json` 的方式对齐；属夹具示例文字口径、不影响 AC 判据强度。
