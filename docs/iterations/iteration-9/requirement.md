# I1.9 三层日志 + 健康度计算 · 完整需求文档

- **迭代号**：I1.9 / 阶段一（DSH 单宿主完整流程）
- **依据章节**：`docs/index.md` 第一部分 §3.1 节点状态（129–168 行）、§3.2 会话状态（170–193 行）、§3.3 角色状态（195–222 行）、§3.4 交接包状态（224–246 行）、§4 能力域 5（§5.5 三层日志 503–507 行、§5.8 健康度规则 532–541 行）、§4 能力域 6 审计粒度（551–571 行，其中 **564 行「会话状态变更：进执行日志摘要，不进主审计」**）、§5.2 数据布局（600–614 行）、§6 边界声明第 5/7/9 条；第二部分迭代规划 `#### I1.9 — 三层日志 + 健康度计算`（828–836 行）；清退归属见第二部分 `#### I1.12`（898 行「审计粒度规则落地」）
- **模板路径**：`docs/templates/requirement-template.md`（8 节 + 三条用户视角硬约束；本项目自 I1.2 起扩展为附录 A~D）
- **格式样板**：`docs/iterations/iteration-7/requirement.md`（已收口迭代的定稿需求，沿用其 A~D 附录形态）
- **版本**：v7
- **状态**：第六轮独立评审判 FAIL（阻断 2 / 建议 8）后已按 `review-round6.md` 的修复清单（F-01~F-10）逐项修订（v7 待复核；本文件不自行宣布通过）。v7 的可构造性口径：**精确等值边界（恰好等于阈值）只在单元级 `computeHealth({ state, now })` 注入固定 `now` 断言；CLI 级一律用远离边界的安全余量**（节点超时 31s vs 30s、P90 70s vs 50s、TTL 15:05 vs 15:00）。v7 的终端输出期望值均有实跑依据：`single` 的 `节点 已完成 · 耗时 2s`、`code-loop` 冻结窗口的 `HO-002 consumed / round 2`、第二进程取消实际走 live 分支、`task-loop` 的 `dispatch-fail-first` 终态只有一条待处理升级（无会话、无隔离），依据见附录 C 的 v6 / v7 行。
- **一句话说明**：把实例运行过程沉淀为三层可复盘记录——只追加且首尾相接的事件日志、回答“这个节点为什么失败”的执行日志摘要、可按回流轮次展开的追踪跨度；并按四档规则计算实例健康度、写入实例元数据、变化进事件日志，用户用 `orch trace show` 与 `orch instance status` 即可看到全部结论。

---

## 一、背景与问题

### 1.1 现状与问题

到 I1.7 收口时，Maestro 已经能跑通单节点、编码闭环、非编码闭环，也能把每个状态迁移追加进 `events.jsonl`。但对“事后复盘”和“现在这个实例到底好不好”这两件事，用户仍然拿不到结论：

- **审计记录只能看，不能核对**。事件确实只追加、序号也单调，但每条记录与前一条之间没有可核对的联系；用户无法向审计方证明“这份记录没有被中间抽换过一条”。
- **节点失败后答不出“为什么”**。完整执行日志留在宿主，核心侧只有一个失败状态与一句错误原文；用户看不到失败命令、退出码、关键输出有多少行、完整日志在哪里，排障只能重新翻宿主。
- **跨角色回流看不见因果**。一次“测试驳回 → 开发返工 → 再送测”在事件列表里是许多行状态迁移，用户要自己按时间拼出“谁把哪一包交给了谁、第几轮、链路是否接上”。
- **实例健康度靠人肉判断**。用户必须逐条读节点、会话、交接包、升级，才能判断这个实例是正常、慢，还是需要立刻处理；没有一个稳定、可复述的四档结论。
- **健康度的变化没有留痕**。即使有人口头判断“这个实例变慢了”，事后也无法从审计记录里找到“何时从正常变成慢、因为什么”。

不解决会怎样：实例越多，复盘成本越高；“假交付”“越权唤醒”“无法追溯”三类风险里，“无法追溯”这一条始终缺一块可核对的证据链。

### 1.2 目标与成功衡量

做完之后，用户可观测的变化：

1. **审计链可逐条核对**：新实例的每一条事件都带前一条记录的指纹，任意相邻两条都能对上；继续运行只追加、不改写，链不断、序号不重。衡量：一次完整运行后，链核对断点为 0。
2. **失败可解释**：任意一个失败节点，用户执行一次 `orch trace show` 就能同时看到失败命令、退出码、关键输出行数、完整日志引用四项；四项齐全，才能回答“为什么失败”。衡量：失败夹具的四要素齐全率为 100%。
3. **回流可展开**：一次跨角色回流在 `orch trace show` 中展开为 3 条跨度（开发 → 测试 → 开发，见附录 A-3）与 1 条回流交接，按时间顺序可见；同一节点的多轮各占一行、按该轮 `round` 标注，不合并、不覆盖。衡量：回流夹具的跨角色因果链完整率 100%。
4. **健康度一眼可读**：四档健康度在四个夹具场景各命中一次；每次档位变化都能在事件日志中找到一条“从哪档到哪档、因为什么”的记录。衡量：四档命中 4/4，健康度变化留痕率 100%。
5. **零回归、零新依赖**：`single` / `code-loop` / `task-loop` 三条主链的运行输出逐字不变；`orch instance status` / `graph` 的既有非健康度输出逐字不变；`dependencies` 仍为 `{}`。

### 1.3 范围

**范围内（本次让用户获得的新能力）**：

- 事件日志的**链式哈希基础**：每条新事件携带前一条记录的指纹，首条使用固定起点指纹；只追加、不改写、序号不复用；同一实例一条链，不同实例各自独立。
- **执行日志摘要**：会话完成或失败时，把命令、退出码、关键输出行数、日志文件引用作为摘要附加到事件日志；完整日志仍留在宿主，核心只保存摘要与引用。
- **追踪跨度**：每个实例一个追踪号；节点每轮一条跨度，记录开始、结束、状态、关联交接包；追踪数据落到 `instances/<id>/state/traces.jsonl`；回流链按轮次可展开。
- **`orch trace show <实例号>`**：以时间线展示跨度，并单独展开回流链；空追踪、单节点、实例不存在都有明确提示。
- **健康度四档**：🔴 需关注 / 🟡 慢 / 🟢 正常 / ⚪ 已结束的规则落地；健康度写入实例元数据，`orch instance status` 与 `status.md` 可见；档位变化进事件日志。
- **两个口径的明确定义**：🟡 的 P90 样本来源与判定方法、🟡 的 TTL 起算点与 50% 阈值，均在本需求内给出可复现定义（见附录 B 与 BR-19 / BR-20）。
- **会话留痕的审计粒度**：会话的逐条状态迁移不作为新的审计事件；用户要知道“这个会话为什么结束 / 失败 / 被取消”，看的是执行日志摘要那一条（依据基线 564 行）。节点、交接包、升级的状态变更照常审计；审批与取消一类治理动作照常留痕。

**范围外（本次不覆盖，逐项注明去向）**：

- **OpenTelemetry 导出**：明确属 I1.12，本次只在数据布局上预留，不实现导出格式、不新增导出命令。
- **崩溃恢复、检查点、`session/resume` / `session/load` 恢复方言**：属 I1.8；本迭代不读写检查点，不改变实例恢复规则。
- **桌面壳、面板健康度徽标、追踪可视化界面、WebSocket 推送**：属 I1.10a / I1.10b；本迭代只交付 CLI 与 `status.md` 的可见面。
- **链式哈希的篡改检测报告 / 校验命令**：属 I1.12；本迭代只保证链本身可逐条核对，不新增“校验失败”命令或审计报告。
- **`pending → expired` 自动过期与随之而来的升级**：本迭代只为健康度读取待投递时长，不改变交接包状态机、不自动置 `expired`、不生成过期升级；自动过期机制留待后续治理迭代。
- **健康度参与路由决策的具体策略**：基线要求健康度“影响路由决策”（`docs/index.md` 541 行），但当前核心没有基于健康度的路由分支，规划条目（830–836 行）也只要求“规则落地 + 写入元数据 + 变化进日志”；本迭代保证健康度可被核心后续读取，不新增任何调度/路由行为改变。此项**登记为基线偏差**（附录 B 的 U-4），**不阻塞开工**，需评审/主控确认豁免，不是“无声略过”。
- **既有 12 处逐条会话状态事件的清退**：`main@70277df` 的 `src/core/orchestrator.js` 已有 12 处逐条会话状态事件写入点，与基线 564 行的审计粒度口径不符。这些写入点**在本迭代仍然存在、仍在发射**——新实例运行中依旧会写入逐条会话记录，本迭代只是**不再新增**同类发射点，并新增会话级摘要一条；不改写已落盘的记录、不删除既有发射点。逐条事件的移除属基线 898 行“审计粒度规则落地”，由 I1.12 承接，逐处去留见附录 D-7（保留 4 / 冻结 7 / 复用 1）。此项**登记为基线偏差**（附录 B 的 U-7），**不阻塞开工**，需评审/主控确认豁免。
- **真实宿主的执行日志格式适配**：本迭代按 B 类零 DSH 验收，摘要由核心在接收宿主工具事件时尽力提取（落点见附录 D-4 / D-7）；宿主未提供的项显示“未提供”，不阻塞实例。真实宿主的取证与格式补齐留待后续真机迭代。
- **追踪数据的保留期与轮转**：本迭代只追加，不清理、不压缩；保留策略留待后续。

**回归红线（本次必须守住）**：

- `single` / `code-loop` / `task-loop` 三条主链的既有终端输出逐字不变。
- `orch instance status` / `orch instance graph` 的既有非健康度输出逐字不变；健康度只允许以**新增一行**的方式出现，原有行的文字与相对顺序不得变化。
- 零第三方运行时依赖；新增中文只落 `src/cli/labels.js`；`src/core` / `src/daemon` 不出现模板名、角色字面量与 31 词禁词表全文。

---

## 二、具体功能细节（用户视角）

### 2.1 功能总览

| 功能点 | 谁在用 | 解决什么问题 | 本次交付到什么程度 |
|---|---|---|---|
| §2.2 审计链与执行摘要 | 复盘排障的人、审计方、交付验收人 | 证明记录未被抽换；失败节点能当场解释“为什么” | 新事件全部带前一条指纹；失败节点四要素摘要齐全，缺项明确显示“未提供” |
| §2.3 追踪与 `orch trace show` | 需要看懂一次回流的人、值班人 | 把跨角色因果从事件列表里拼出来 | 实例级追踪号、节点每轮一条跨度、回流链按轮次展开；空/单节点/不存在都有提示 |
| §2.5 健康度四档 | 实例负责人、值班人、面板后续消费者 | 不用逐条读状态就能判断“现在要不要管” | 四档规则 + 五类红条件 + 两类黄条件；写入实例元数据，CLI 与 `status.md` 可见，变化进事件日志 |
| §2.4 功能之间的衔接 | 所有使用本迭代能力的用户 | 把日志、摘要、追踪、健康度串成一次完整使用体验 | 覆盖“实例跑 → 进日志 → 带摘要 → 可展开 → 健康度升降 → CLI 看到”的完整路径 |

### 2.2 审计链与执行摘要：用户能做什么，看到什么

#### 2.2.1 事件日志：一条首尾相接、只追加的审计链

- **使用角色**：需要复盘或对外说明“这件事确实这样发生过”的人；以及关注合规留痕的审计方。
- **使用场景**：实例跑完或跑到一半，用户要确认这段运行记录完整、连续、没有被中间替换过一条。
- **用户操作**：用户照常运行实例；复盘时执行 `orch instance log <实例号> --format json` 查看逐条记录，或继续让实例运行后再看新增记录。
- **预期效果**：
  - 每条记录都带一个“前一条记录的指纹”；第一条使用统一的起点指纹。用户按顺序看下去，每一条的“前一条指纹”都等于上一条记录自身的指纹，链首尾相接。
  - 继续运行只会把新记录接在末尾：已有记录的内容与顺序不变，序号继续递增、不复用、不重号。
  - 同一实例是一条链，不同实例各是一条独立链，互不串接。
  - 用户不需要额外的校验工具，也能通过逐条比对确认“这条链是连着的”。
- **异常情况**：
  - 历史实例在升级前已有记录、没有“前一条指纹”这个标记时：旧记录原样保留（内容、序号、字节都不动、不回填），升级后的**第一条新记录**仍能接在最近一条可解析的旧记录之后，用户按顺序看下去照样能对上；旧记录缺标记**不计为断点**，也不阻断实例继续运行。
  - 若末行被强杀截断成半行：跳过该行，从最近一条可解析记录继续接链，不把序号打回 1；用户在 `orch instance log` 里能看到一行“已跳过 N 行不可读记录”的提示，其余记录照常可读，命令以成功退出码结束。
  - 只有整份记录都不可解析时（一条可读记录都没有），新记录才从固定起点重新起链：此时没有任何可读序号可供续接，新链的序号从 1 开始，与已存在的可读序号不构成重号（不可读行不贡献任何序号）；原有文件原样保留在原位——一行不删、不改写、不改名，新记录仍追加在文件末尾；用户在 `orch instance log` 里同样看到“已跳过 N 行不可读记录”的提示（N 为被跳过的行数），不弹堆栈、不中断实例，命令以成功退出码结束。
- **边界说明**：本迭代只保证“链能被逐条核对”，不提供“篡改报告 / 校验失败提示 / 审计报告”这类能力，后者留待 I1.12；链只覆盖事件日志，不覆盖宿主内的完整执行日志。升级前遗留的无标记旧记录按“历史”对待：不校验、不回填、不算断点。

#### 2.2.2 执行日志摘要：失败节点当场回答“为什么失败”

- **使用角色**：排障人、实例负责人、需要验收“失败是否合理”的人。
- **使用场景**：某个节点失败或升级，用户要知道它到底跑了什么、哪一步退出、完整日志在哪。
- **用户操作**：用户执行 `orch trace show <实例号>`，在对应节点的跨度下直接阅读失败摘要；需要更细的现场时，按摘要里的日志文件引用去宿主侧打开完整日志。
- **预期效果**：
  - 会话收尾时附加一条摘要：完成、失败、取消三种收尾都算收尾（规划原文是“会话完成时”，成功与失败都算完成，取消也是会话结束）。摘要挂在**会话**上：一条会话一条摘要，同一节点因回流重跑几轮就有几条摘要，每轮各一条、按轮次分开、不合并、不覆盖。失败的那一轮在追踪里表现为该跨度下方多出一行摘要，同时给出四项：**执行的命令、退出码、关键输出行数、日志文件引用**。
  - 这四项让用户能当场回答“这个节点为什么失败”：命令说明做了什么，退出码说明是否非零退出，关键输出行数说明有多少条需要看的输出，日志引用指向完整现场。
  - 摘要只保存“摘要 + 引用”，完整日志不被复制进实例目录；实例目录不会因此膨胀。
  - 用户在 `orch instance log` 里按节点数摘要行，行数就是这个节点经历过的会话轮次数（单轮一行、两轮两行），用户不必自己按时间拼。
- **异常情况**：宿主没有提供某一项时，该项显示“未提供”，其余项照常展示，实例不崩溃、追踪仍可打开；节点成功完成时摘要照常记入日志（用户执行 `orch instance log` 可查到），只是追踪里不强制展示失败摘要；会话被取消时同样记一条摘要（被中断的命令没有退出码，其余不可得的项显示“未提供”），取消的摘要只在 `orch instance log` 里可查，追踪里不新增“取消摘要”这类前缀。
- **边界说明**：摘要的完整性取决于宿主上报；本迭代不解析完整日志正文，不做日志内容分析，也不把宿主日志搬进核心。

### 2.3 追踪：一次回流的跨角色因果链

#### 2.3.1 追踪跨度：每个实例一条时间线

- **使用角色**：需要理解“这次协作到底怎么走的”的人；值班人与复盘人。
- **使用场景**：实例运行中或结束后，用户想按时间顺序看每个节点这一轮从什么时候开始、什么时候结束、结果如何、跟哪些交接包有关。
- **用户操作**：用户执行 `orch trace show <实例号>`。
- **预期效果**：
  - 用户先看到实例号与本次运行的追踪号，再看到“跨度 N 条 · 回流 M 次”的汇总；N 只统计已经结束、已落地的跨度，正在进行的节点在时间线末尾单独一行显示。
  - 每条跨度一行：开始时刻 → 结束时刻、节点编号与标题、本轮结果、关联的交接包编号；同一节点多轮出现多行，按时间排序。
  - 正在执行、尚未结束的节点显示为“进行中”，结束时刻显示为“—”，不伪造结束时间。
  - 尚未有任何已完成跨度、但已有进行中节点时，时间线仍显示这些“进行中”跨度（汇总为“跨度 0 条”）；只有连进行中节点都没有时，才显示“暂无追踪记录”。
  - 同一实例的跨度共用同一个追踪号；不同实例的追踪号不同。
  - 追踪记录随实例状态一起存放：用户按命令提示就能在实例目录的 `state/` 下找到追踪文件，它不会散落在实例根目录，也不和 `status.md`、产物目录混在一起。
- **异常情况**：还没有任何跨度时，用户看到“暂无追踪记录”，命令正常结束；实例不存在时看到“不存在”的提示，命令以失败退出码结束，不打印堆栈。追踪文件缺失时按“还没有追踪”处理；文件里个别行不可读时，用户看到“追踪记录有 N 行不可读，已跳过”的提示，其余跨度照常显示——异常不静默、也不让整份追踪打不开。
- **边界说明**：追踪只覆盖节点轮次级因果，不记录模型推理内容、不记录会话内每一次工具调用的全文；追踪数据只追加，不清理、不轮转。

#### 2.3.2 `orch trace show`：把回流链单独展开

- **使用角色**：要确认“测试驳回后开发是否真的返工、返工后又交给谁”的人。
- **使用场景**：一次回流发生之后，用户要从时间线里直接看出跨角色的因果，而不是自己按时间拼。
- **用户操作**：用户执行 `orch trace show <实例号>`，先读上方时间线，再读下方“回流链”段。
- **预期效果**：
  - 时间线按发生顺序列出跨角色跨度，用户能看出“谁先做、谁后做、谁把结果交给谁”。
  - “回流链”段按轮次逐条列出回流交接：轮次、从哪个角色到哪个角色、交接包编号、当前交接状态。**轮次取该回流交接包的 `round`**（即该回流发生在接收节点的第几轮），不是“第几次回流”：本夹具的唯一回流包 `HO-002` 的 `round` 为 `2`，因此显示“第 2 轮”。
  - 多轮回流按轮次分别列出，历史轮次不被合并、不被覆盖；用户能顺着轮次看出返工的完整因果。
  - 命令是只读的：重复执行多次，输出一致，不改变实例状态，不追加事件。
- **异常情况**：实例只有单节点、没有回流时，时间线正常显示一条跨度，“回流链”显示“无”；空追踪与实例不存在按 §2.3.1 的提示处理。
- **边界说明**：本次只提供文本输出，不提供 JSON 输出、不做 OpenTelemetry 导出、不做图形化时间线；这些分别留待后续或 I1.12。

### 2.4 功能之间的衔接

把 §2.2、§2.3、§2.5 串起来，用户走完一遍是这样一条体验：

1. **实例跑起来，每一步进审计链（§2.2.1）**：用户正常启动实例，节点派发、交接包流转、升级生成继续写入事件日志；会话这一层不逐条进主审计，它只在收尾时留一条摘要（§2.2.2；升级前已实现的 12 处逐条会话事件本迭代不新增、不删除，仍在发射，清退由 I1.12 承接，见附录 B 的 U-7）。不同之处是每条新记录都接上一条的指纹，用户后续可以逐条核对。
2. **节点/会话有结论时，摘要跟着落地（§2.2.2）**：某个节点完成、失败或被取消，用户不需要去宿主翻日志；追踪里已经带上命令、退出码、关键输出行数、日志引用四项，失败的“为什么”当场可答。会话结束时同一份摘要也让用户不必翻遍会话逐条记录；同一节点回流几轮就有几条摘要，按轮次分开。
3. **时间线自动成形（§2.3.1）**：节点每一轮结束就多一条跨度；用户随时执行 `orch trace show`，看到的是按时间排序的完整经历，正在跑的节点显示“进行中”。
4. **一次回流被展开成因果链（§2.3.2）**：测试节点驳回、开发节点返工、结果再交回测试，时间线上出现跨角色的多行跨度；“回流链”段按轮次列出交接包从谁到谁、当前什么状态，用户不用自己拼。
5. **健康度随状态变化升降（§2.5）**：用户每次执行 `orch instance status`，先看实例状态行，再看紧跟其后的那一行健康度；同一实例两次查看之间若有异常发生，档位就不再停在“正常”，并带一句中文原因告诉用户该看哪里；实例结束后这一档不再反复跳动。
6. **变化本身留痕（§2.5）**：用户事后回看 `orch instance log`，能对上“什么时候从哪一档变成哪一档、因为什么”，中间没有反复刷屏的重复记录；判定细节见 §2.6 与 BR-11 ~ BR-15。
7. **用户用 CLI 收口（§2.2 / §2.3 / §2.5）**：用户先 `orch instance status` 看当前档位与首要原因，判断要不要现在处理；要排障就 `orch trace show` 看时间线、回流链与失败摘要；要对外说明就 `orch instance log --format json` 逐条核对审计链。三步都在终端完成，不需要打开面板。

简言之：**运行产生记录（§2.2.1）→ 失败带摘要（§2.2.2）→ 时间线可展开（§2.3.1）→ 回流因果可见（§2.3.2）→ 健康度给出结论（§2.5）→ 变化留痕并可复核**，构成一次完整的“跑完能复盘、出事能解释、现在好不好一眼知道”的闭环。

### 2.5 健康度：四档状态一眼可见

- **使用角色**：实例负责人、值班人、需要快速分诊的人；后续面板也会消费同一结论。
- **使用场景**：用户同时照看多个实例，需要先看“哪个要管”，再决定下钻哪个实例。
- **用户操作**：用户执行 `orch instance status <实例号>`，或在共享工作区打开 `status.md`；无需额外命令。
- **预期效果**：
  - 实例状态行下方新增一行健康度，四档之一：**需关注**、**慢**、**正常**、**已结束**。同一时刻只显示一档。
  - “需关注”命中任一情况即成立：有待处理升级、节点运行超过声明的超时、会话崩溃、有角色不可用、有连接线被拒绝或已过期。用户能看到具体原因，例如“有待处理升级”“节点 T-001 执行超时”“会话 mock-sess-12345-1 崩溃”“角色 开发 不可用”“连接线 测试→开发 已拒绝”“连接线 测试→开发 已过期”；一次同时命中多条时按同一固定顺序并列显示，逐字见附录 A-6 附。**“声明的超时”取实例级节点超时阈值（`state.health.nodeTimeoutMs`，缺省 30000 毫秒）**；本迭代运行期图不带节点级 `timeout`，不声称读取工作流定义层。
  - “慢”命中任一情况即成立：有节点运行时长**超过**本实例的 P90、有连接线待投递时长**超过** TTL 的一半（严格大于，恰好一半不算）。用户能看到具体原因与对象。
  - “正常”表示没有任何上述异常；“已结束”表示实例已经进入终态（已完成 / 失败 / 已取消 / 已中断），此时不再回升为“需关注”或“慢”。
  - 健康度会写入实例元数据；用户下次查看、或面板后续读取时，拿到的是同一结论。
  - 每次档位变化都进事件日志：用户回看时看到的是一句中文话——从哪一档到哪一档、因为什么（例如“正常 → 需关注  原因 有待处理升级”）；档位没变就不重复记，用户不会看到同一档位被反复刷屏。
- **异常情况**：追踪文件缺失、单行损坏、历史数据缺少起止时刻时，健康度按“该条件不成立”处理，不崩溃、不误报；没有声明超时的节点、没有起算时间的旧交接包不参与对应判定。这里的“降级”不是静默：被跳过的追踪行数会在 `orch trace show` 里以“追踪记录有 N 行不可读，已跳过”提示给用户，档位本身仍照常给出。
- **边界说明**：健康度是只读结论，不改变节点/会话/交接包状态、不生成升级、不改变调度或路由；本迭代不实现自动过期（`pending → expired`），只读取时间做“慢”的判定；面板徽标与通知留待 I1.10 / I1.11。

### 2.6 用户可见的业务规则

- **BR-01**：事件日志只追加；已有记录的内容、顺序与序号不被改写，新记录只接在链尾。“序号不复用”说的是**可读序号**：不可读行不贡献任何序号，因此不与新序号构成重号；整份不可解析时的重起链口径见 BR-25，从 1 起算不算复用。
- **BR-02**：每条新事件携带前一条记录的指纹；第一条使用统一固定起点；同一实例一条链，不同实例各自独立。
- **BR-03**：本迭代只保证链可被逐条核对；不提供篡改检测报告或校验命令，该能力留待 I1.12。
- **BR-04**：每个会话收尾（完成、失败、取消）时，都会在日志里留一条四项执行摘要：命令、退出码、关键输出行数、日志文件引用；四项共同回答“为什么失败 / 为什么结束”。摘要挂在会话上：一条会话一条摘要，同一节点多轮回流时每轮各一条、按轮次分开、不合并也不覆盖。失败的那一轮在追踪里直接显示这行摘要；成功与取消的收尾只在日志里可查，追踪不强制展示。
- **BR-05**：摘要只保留摘要与引用，完整日志留在宿主、不复制进实例目录；宿主未提供的项显示“未提供”，不阻塞实例。
- **BR-06**：每个实例一个追踪号；节点每轮一条跨度，包含开始、结束、结果与关联交接包；未结束的节点显示“进行中”。
- **BR-07**：回流链按轮次展开，按时间顺序显示跨角色的交接因果；多轮不合并、不覆盖。
- **BR-08**：`orch trace show` 只读；重复执行输出一致，不改变实例状态、不追加事件。
- **BR-09**：空白追踪（连进行中节点都没有）显示“暂无追踪记录”并正常结束；单节点显示一条跨度且回流为“无”；实例不存在显示“不存在”并以失败退出码结束。
- **BR-10**：健康度固定四档——需关注、慢、正常、已结束；同一时刻只显示一档。
- **BR-11**：出现待处理升级、节点超时、会话崩溃、角色不可用、连接线被拒绝或已过期中的任意一项，健康度为“需关注”。节点超时的“超时”指节点运行时长**严格大于**实例级阈值 `health.nodeTimeoutMs`（缺省 30000 毫秒）；恰好等于阈值不算超时。
- **BR-12**：出现节点运行时长**严格大于**本实例 P90、连接线待投递**严格大于** TTL 一半中的任意一项，健康度为“慢”；恰好等于 P90、恰好等于 TTL 一半均不算。
- **BR-13**：没有任何异常时为“正常”；实例进入终态（已完成、失败、已取消、已中断）后为“已结束”，终态优先于其他档。
- **BR-14**：健康度写入实例元数据；`orch instance status` 与 `status.md` 显示档位与原因。
- **BR-15**：健康度档位每次变化都进事件日志，记录从哪档到哪档、原因是什么；档位未变不重复记；首次写入不算变化。
- **BR-16**：健康度是只读结论，不改变节点、会话、交接包状态，不生成升级，不改变调度与路由。
- **BR-17**：`single` / `code-loop` / `task-loop` 三条主链的运行输出逐字不变；健康度只出现在实例状态视图与 `status.md`。
- **BR-18**：`orch instance status` / `orch instance graph` 的既有非健康度输出逐字不变；健康度只允许以新增一行出现。
- **BR-19**：P90 的样本是同一实例内已结束节点轮次的跨度时长；样本少于 5 条时不触发“慢”。
- **BR-20**：TTL 从交接包进入 `pending` 的时刻起算；默认 TTL 为 30 分钟，待投递时长**超过** 50%（即严格大于 15 分钟）即判“慢”，恰好 15 分钟不算“慢”；没有起算时间的旧包不参与判定。
- **BR-21**：追踪与摘要对宿主没有新增依赖；宿主未提供摘要项时降级显示“未提供”，不阻塞实例。
- **BR-22**：升级前已有的旧记录即使没有“前一条指纹”标记，也原样保留、不回填、不改写、不算断点；新记录接在最近一条可解析记录之后，序号继续递增、不回 1；末行被截断只跳过该行并提示跳过的行数，不阻断实例继续运行。
- **BR-23**：会话的逐条状态迁移不作为新的审计事件供用户核对；用户要知道会话为什么结束、失败或被取消，看的是执行日志摘要那一条；节点、交接包、升级的状态变更照常审计，审批与取消等治理动作照常留痕。升级前已有的 12 处逐条会话事件本迭代不新增、不删除，仍在发射（新实例仍会写入逐条会话记录），清退由 I1.12 承接（附录 B 的 U-7）。
- **BR-24**：追踪记录缺失、单行不可读、历史跨度缺少起止时刻时，健康度按“该条件不成立”处理并照常给出档位，不崩溃、不误报；被跳过的行数提示给用户，异常不被静默吞掉。
- **BR-25**：事件日志里没有任何一条可解析记录（整份不可解析）时，新记录从固定起点重新起链，序号从 1 开始；不可读行不贡献任何可读序号，因此不与已有序号构成重号。旧文件一行不删、不改写、不改名，新记录仍追加在末尾；用户看到“已跳过 N 行不可读记录”的提示（N 为跳过的行数），实例不中断、命令以成功退出码结束。

---

## 三、验收标准（用户视角）

### 3.1 功能验收标准（AC）

> 每个 AC 的夹具都是独立项目根，位于 `/tmp` 下，绝不放进仓库；运行前注入 `NODE_ENV=test`。CLI 一律在夹具目录内执行，命令中的 `$MAESTRO_REPO` 指向仓库根。所有路径断言只用相对路径或结尾匹配，不断言 `/tmp` 与 `/private/tmp` 的差异。
>
> AC 标题形态沿用本项目 I1.7 定稿需求的 `**AC-xx · …**`（既有约定，不改为 `#### AC-`）；机械扫描取号请用 `^\*\*AC-`（见附录 D-10）。

**AC-01 · 事件日志只追加：旧行不变、序号不复用**
- 场景类型：功能 / 审计
- 风险：中（审计链的基础，出错会污染全部历史）
- 引用：BR-01
- **Given** 用户在 `/tmp/maestro-i19-append` 启动一个单节点实例，跑到节点执行中，实例目录已有若干条事件记录。
- **When** 用户记下当前文件内容与最后一条序号，然后让实例继续运行到结束，再执行 `orch instance log INST-001 --format json`。
- **Then** 新记录只出现在末尾，旧记录的内容与顺序完全不变；序号连续递增、不复用、不重号；用户看到的事件条数只增不减。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言追加前后旧行字节哈希一致、序号严格递增且无空洞。
- 夹具：`cd /tmp/maestro-i19-append && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，夹具在运行启动后轮询 `events.jsonl`，出现首条记录即复制一份，再等待运行结束；比较运行前的副本与新文件的旧行前缀字节。
- 架构检查：本 AC 不新增目录约束，沿用 `src/persistence/instance-store.js` 的整行追加语义。

**AC-02 · 链式哈希：每条记录接上前一条的指纹**
- 场景类型：功能 / 审计
- 风险：高（本迭代的核心新能力）
- 引用：BR-02, BR-03
- **Given** 用户在 `/tmp/maestro-i19-chain` 启动并跑完一个单节点实例，`NODE_ENV=test`。
- **When** 用户执行 `orch instance log INST-001 --format json` 逐条查看记录，并把记录按序号排好；同一根下再启动第二个实例、对它执行同一命令，把两条链并排比对。
- **Then** 第一条带统一固定起点指纹；从第二条起，每条记录的“前一条指纹”都等于上一条记录自身的指纹；整条链从首到尾没有断点；另一个实例的链与本实例互不串接。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中对每条记录做规范化序列化后计算 SHA-256，与下一条的“前一条指纹”逐条比对，断点数必须为 0。
- 夹具：`cd /tmp/maestro-i19-chain && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，再执行 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json`，保存输出供逐条核对；同一根下再启动 `INST-002`，断言两条链的起点指纹相同但后续指纹不同。
- 架构检查：`cd "$MAESTRO_REPO" && node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-03 · 回归红线：三条主链运行输出逐字不变**
- 场景类型：回归
- 风险：高（破坏即阻断收口）
- 引用：BR-17
- **Given** 仓库当前基线为 I1.7 收口后的 `main`，`NODE_ENV=test`。
- **When** 用户分别跑 `single`、`code-loop`、`task-loop` 三条主链，并比对收口基线的输出。
- **Then** 三条主链的终端输出逐字一致，没有多一行健康度、没有多一行追踪、没有任何文字或顺序变化。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js" 2>&1 | tee /tmp/i19-tests.log`，失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 的差集必须为 0，测试条数只增不减。
- 夹具：`cd /tmp/maestro-i19-regress && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，再分别用 `--template code-loop`、`--template task-loop` 各跑一次，输出与 `test/templates/**` 的既有逐字基线比对。
- 架构检查：同上 31 词纯净扫描必须 `exit 0`；`node -p "Object.keys(require('./package.json').dependencies||{}).length"` 输出 `0`。

**AC-04 · 执行摘要四要素：失败节点当场回答“为什么失败”**
- 场景类型：功能 / 规划验收
- 风险：高（规划验收句第三段的直接判据）
- 引用：BR-04, BR-21
- 判据（规划逐字）：执行日志摘要能回答“这个节点为什么失败”。
- **Given** 用户在 `/tmp/maestro-i19-fail-summary` 启动一个会失败的节点：夹具让宿主上报一次非零退出的工具调用，命令为 `node out/run.js`、退出码 1、输出 3 行、完整日志在 `host-logs/T-001.log`，`NODE_ENV=test`。
- **When** 用户执行 `orch trace show INST-001`，随后执行 `orch instance log INST-001`（文本视图）与 `orch instance log INST-001 --format json`。
- **Then** 失败节点上方为跨度行 `10:00:40 → 10:01:30  T-001  失败  交接 HO-001`（`single` 的节点无 `title`，只显示节点号、不显示角色），下方出现摘要行，逐字包含：`失败摘要 命令 node out/run.js`、`退出码 1`、`关键输出 3 行`、`日志 host-logs/T-001.log` 四项；用户据此能回答“这个节点为什么失败”——执行了什么、是否非零退出、有多少条关键输出、完整日志在哪。用户对交付验收方说明同一件事时，执行 `orch instance log INST-001` 也能查到这一条摘要（内容与追踪里一致，不重新推导），该行逐字为附录 A-12。夹具再跑一个成功节点，确认成功完成同样附加四项摘要，只是追踪不强制展示。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言摘要四项全部存在且取值与夹具一致、`orch instance log INST-001 --format json` 可检索到同一条会话摘要记录（四项取值逐项相等）、成功节点也有摘要记录，且 `orch trace show` 退出码为 `0`。
- 夹具：夹具预置 `/tmp/maestro-i19-fail-summary/.orch/hosts/mock.json`，`launch.args` 指向仓库内 `test/fixtures/mock-acp-agent.js` 并带 `--fail-tool`；`cd /tmp/maestro-i19-fail-summary && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "执行 out/run.js"`，随后 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`，再执行 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001` 与 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json`，对三份输出逐字断言（文本视图那一行对照附录 A-12）；`host-logs/T-001.log` 由夹具预置在项目根、不在实例目录内。
- 架构检查：摘要不得包含完整日志正文；新增 `src/core` 文件纳入 31 词扫描。

**AC-05 · 摘要边界：只存摘要与引用，缺项显示“未提供”**
- 场景类型：功能 / 边界
- 风险：中
- 引用：BR-05, BR-21
- **Given** 用户在 `/tmp/maestro-i19-summary-missing` 启动一个失败节点，夹具只让宿主提供命令与退出码，不提供关键输出行数与日志引用，`NODE_ENV=test`。
- **When** 用户执行 `orch trace show INST-001`，并检查实例目录。
- **Then** 缺失的两项显示“未提供”，命令与退出码照常显示；实例目录内不存在完整日志副本；实例没有崩溃、追踪仍可打开。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言摘要记录无完整输出正文字段、缺失项渲染为“未提供”、实例目录下无宿主日志副本。
- 夹具：夹具预置 `/tmp/maestro-i19-summary-missing/.orch/hosts/mock.json`，`launch.args` 指向仓库内 `test/fixtures/mock-acp-agent.js` 并带 `--fail-tool-no-refs`；`cd /tmp/maestro-i19-summary-missing && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "执行 out/run.js"`，随后 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001` 与 `find .orch/instances/INST-001 -type f`；`host-logs/` 位于项目根之外。
- 架构检查：`src/core` 不读取完整日志正文，只读取摘要字段。

**AC-06 · 追踪跨度：追踪号、起止、结果、交接包齐全**
- 场景类型：功能
- 风险：中
- 引用：BR-06
- **Given** 用户在 `/tmp/maestro-i19-span` 跑完一个两节点正向实例（开发 → 测试），`NODE_ENV=test`。
- **When** 用户执行 `orch trace show INST-001`，并查看实例的追踪数据文件位置。
- **Then** 用户看到实例级追踪号、两条按时间排序的跨度；每条跨度含开始时刻、结束时刻、节点标题、本轮结果、关联交接包；追踪记录落在实例目录的状态子目录里，不散落在实例根目录，用户按提示即可找到。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言跨度字段齐全、结束时间非空、`handoff_ids` 与状态中的交接包一致，且追踪文件路径为 `instances/<id>/state/traces.jsonl`。
- 夹具：`cd /tmp/maestro-i19-span && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template code-loop --task "实现并测试"`，随后 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`；检查 `.orch/instances/INST-001/state/traces.jsonl` 存在且每行一条跨度。
- 架构检查：新增 `instanceStateDir` / `instanceTracesPath` 只追加导出，既有路径函数不动。

**AC-07 · 回流链按轮次展开：同一节点多轮不合并、不覆盖**
- 场景类型：功能 / 回流
- 风险：中
- 引用：BR-07
- **Given** 用户在 `/tmp/maestro-i19-backflow` 跑一次真实回流：开发第 1 轮 → 测试第 1 轮驳回 → 开发第 2 轮返工 → 测试第 2 轮复测通过，`NODE_ENV=test`。夹具 `backflow-once` 只产生 **1 次回流**（`HO-002`，`edge.kind='backflow'`，`round=2`）；`backflow-twice` / `retest-fail` 别名映射到 `rounds-exceeded`，是“1 次回流 + 升级”，不是两次回流，故不用于本 AC。
- **When** 用户执行 `orch trace show INST-001`。
- **Then** 时间线上同一节点按轮次出现多行：`T-001` 两行、`T-002` 两行，共 4 行（轮的区分由数据层 `round` 决定，时间线不额外输出轮次列）；回流链段恰好列出 1 条回流交接，逐字为附录 A-3 的回流链行 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`（`HO-002` 的 `round=2`、当前状态 `consumed`）；`T-001` 的第 1 轮跨度仍在（时间线上第一条 `T-001` 行），没有被第 2 轮覆盖；汇总“回流 1 次”只统计 `edge.kind='backflow'` 的交接，复测包 `HO-003`（`kind='retest'`）不计入回流。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言 `.mock` 无 `stopped-after-*`、实例已结束；跨度恰为 4 条（`T-001` 2 条 + `T-002` 2 条）、`round` 分别覆盖 1 与 2；回流链恰 1 条、`HO-002` 的 `round=2` 且状态 `consumed`；`HO-003` 的 `edge.kind='retest'` 未被计入“回流 1 次”。
- 夹具：`cd /tmp/maestro-i19-backflow && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/code-loop-driver.mjs" --root /tmp/maestro-i19-backflow --scenario backflow-once`（场景表 `code-loop-driver.mjs:137-139` 的 `backflow`，别名 `backflow-once`；驱动把 `--root` / `--scenario` 写进 `.orch/hosts/mock.json` 的 `launch.args`），驱动自行退出后执行 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`。实测该场景结束态为 `handoffs=3`（`HO-001 forward r1` / `HO-002 backflow r2` / `HO-003 retest r2`）、`sessions=4`、`state=completed`。
- 架构检查：跨度按轮次追加，不按节点覆盖写。

**AC-08 · 规划验收①：`orch trace show` 能展开一次回流的跨角色因果链**
- 场景类型：规划验收（核心）
- 风险：高（规划逐字验收句）
- 引用：BR-06, BR-07
- 判据（规划逐字）：`orch trace show` 能展开一次回流的跨角色因果链。
- **Given** 用户在 `/tmp/maestro-i19-trace-chain` 用 `code-loop` 跑一次真实回流：开发节点第 1 轮完成 → 测试节点第 1 轮驳回 → 开发节点第 2 轮返工完成；驱动停在“第 3 步（开发返工）已完成、第 4 步（复测）尚未派发”的窗口（`.mock/stopped-after-3` 存在），`NODE_ENV=test`。
- **When** 用户在该暂停窗口内执行 `orch trace show INST-001`。
- **Then** 输出与附录 A-3 逐字一致：汇总行为“跨度 3 条 · 回流 1 次”；时间线上按顺序出现 3 条已完成跨度（`T-001 开发 已完成` → `T-002 测试 失败` → `T-001 开发 已完成`），末尾**没有**“进行中”行，开发与测试两个角色都出现；回流链段出现 1 条回流交接，逐字为 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`（`HO-002` 的 `round=2`、当前状态 `consumed`）；用户能顺着读出“开发交付 → 测试驳回 → 开发返工”的完整因果链。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言 `.mock/stopped-after-3` 存在（冻结点成立）、跨度恰为 3 条且顺序正确、时间线不含“进行中”、汇总行文案为“跨度 3 条 · 回流 1 次”、输出含两个角色标题、两个节点编号、回流交接编号 `HO-002` 与轮次“第 2 轮”、交接状态“已完成”，并将时间线 3 行与回流链段 1 条交接行同附录 A-3 逐字比较。
- 夹具：在**第二进程/后台**启动 driver（`--keep` 会阻塞到 SIGINT，`code-loop-driver.mjs:801-809`）：`cd /tmp/maestro-i19-trace-chain && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/code-loop-driver.mjs" --root /tmp/maestro-i19-trace-chain --scenario backflow-once --stop-after 3 --keep & DRV=$!`；然后轮询 `.mock/stopped-after-3`（文件出现即继续，不使用固定 `sleep`），出现后执行 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`，对照附录 A-3 逐字断言；断言完成写 `.mock/release` 放行并 `kill -INT $DRV` 结束 driver。`--stop-after 3` 以 `MAESTRO_TEST_STOP_AFTER=3` 传给核心，由核心在 `counters.dispatchCount` 达到 3、派发第 4 步之前写 `.mock/stopped-after-3` 并等待 `.mock/release`（`code-loop-driver.mjs:386-392`、`:714-716`；`src/core/orchestrator.js:354`、`:4164-4183`、`:3141`）。
  - **不采用 `retest-hold`**：该场景在第 4 步已派发后把会话挂在 `start`（`code-loop-driver.mjs:247-251`），第 4 步会作为一条“进行中”跨度出现在时间线末尾，与 A-3 的 3 行基线不符；`--stop-after 3` 冻结在派发之前，才与 A-3 的 3 条已完成跨度一致。
- 架构检查：`orch trace show` 只读，实现不得写入 `state.json` 或 `events.jsonl`。

**AC-09 · 追踪的三种空形态：空、单节点、实例不存在**
- 场景类型：边界
- 风险：低
- 引用：BR-09
- **Given** 分别准备三个夹具：`/tmp/maestro-i19-trace-empty` 有一个刚创建、尚无跨度的实例；`/tmp/maestro-i19-trace-single` 有一个跑完的单节点实例；`/tmp/maestro-i19-trace-missing` 只有一个空项目根。三个都注入 `NODE_ENV=test`。
- **When** 用户在三个夹具分别执行 `orch trace show INST-001`、`orch trace show INST-001`、`orch trace show INST-999`。
- **Then** 第一个逐字为附录 A-1：显示“暂无追踪记录”，并以成功退出码结束；第二个逐字为附录 A-2：显示实例追踪号、“跨度 1 条 · 回流 0 次”、一条跨度、以及末尾的“回流链”“无”两行；第三个逐字为附录 A-5：显示“实例 INST-999 · 不存在”，并以失败退出码结束，不打印堆栈。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言三种输出的文案与退出码。
- 夹具：三个夹具分别执行对应命令；空实例夹具直接写 `state.json`（`state: 'created'`、`nodes[0].state='pending'`、无 `traces.jsonl`），不派发节点；单节点实例跑完；缺失实例只建空根。
- 架构检查：无。

**AC-10 · 追踪只读：重复执行不改状态、不追加事件**
- 场景类型：功能 / 只读
- 风险：低
- 引用：BR-08
- **Given** 用户在 `/tmp/maestro-i19-trace-readonly` 跑完一个两节点实例，`NODE_ENV=test`。
- **When** 用户连续执行三次 `orch trace show INST-001`，并比较执行前后的实例元数据与事件条数。
- **Then** 三次输出完全一致；实例元数据中的节点、会话、交接包、升级、健康度均未变化；事件条数不增加。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言三次输出字节一致、`state.json` 与 `events.jsonl` 字节哈希不变。
- 夹具：`cd /tmp/maestro-i19-trace-readonly && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template code-loop --task "实现并测试"`，再连续三次 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`。
- 架构检查：`trace` 命令只调用只读接口，不调用任何写方法。

**AC-11 · 健康度 🟢 正常：无异常时显示正常**
- 场景类型：功能
- 风险：低
- 引用：BR-10, BR-13
- **Given** 用户在 `/tmp/maestro-i19-health-green` 准备一个运行中的 `code-loop` 实例：`state: 'running'`、`nodes: T-001 done / T-002 pending`（**没有 `running` 节点**，因此节点超时条件不可能命中），没有待处理升级、没有崩溃、没有不可用角色、没有异常连接线；实例快照显式写入 `health.nodeTimeoutMs = 300000`（远离 30s 缺省阈值，避免任何查看时长敏感性），`NODE_ENV=test`。
- **When** 用户执行 `orch instance status INST-001`，并打开 `.orch/instances/INST-001/workspace/status.md`。
- **Then** 实例状态行下方显示“健康度 正常”，且没有附加原因；`status.md` 的“健康度”行为“正常”。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言状态行与 `status.md` 行均为“正常”。
- 夹具：`cd /tmp/maestro-i19-health-green`，**按 §3.3 先在空目录拉起核心**（`instance status INST-001` 返回“不存在”即可），再直接写 `.orch/instances/INST-001/state.json`（`state: 'running'`、`template: 'code-loop'`、`nodes: [{nodeId:'T-001',roleId:'developer',round:1,state:'done',startedAt:...,endedAt:...},{nodeId:'T-002',roleId:'tester',round:0,state:'pending'}]`、`sessions: []`、`handoffs: []`、`escalations: []`、`health: { nodeTimeoutMs: 300000 }`），不派发节点；再执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001` 并读取 `workspace/status.md`。**该夹具没有运行中节点，也没有 `--hold-session`，因此 30s 阈值与查看时长都不参与判定**（F-07）。
- 架构检查：无。

**AC-12 · 健康度 ⚪ 已结束：终态优先，不回升**
- 场景类型：功能 / 边界
- 风险：中（优先级错误会让已结束实例长期显示“需关注”）
- 引用：BR-10, BR-13
- **Given** 用户在 `/tmp/maestro-i19-health-ended` 跑完一个实例；该实例历史上有过一条已过期的连接线，`NODE_ENV=test`。
- **When** 用户执行 `orch instance status INST-001`，并打开 `.orch/instances/INST-001/workspace/status.md`。
- **Then** 健康度显示“已结束”，不显示“需关注”或“慢”；`status.md` 同样显示“已结束”。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言四个终态（已完成、失败、已取消、已中断）都命中“已结束”，历史红条件不再覆盖终态。
- 夹具：`cd /tmp/maestro-i19-health-ended && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"` 跑完后执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`；另用夹具构造带历史过期交接包的终态快照复验。
- 架构检查：无。

**AC-13 · 健康度 🔴 五类条件（六个夹具）矩阵：任一项命中即需关注**
- 场景类型：功能 / 判定矩阵
- 风险：高（四档规则的核心）
- 引用：BR-11
- **Given** 六个独立夹具分别构造一种红条件：`/tmp/maestro-i19-health-pending`（待处理升级）、`/tmp/maestro-i19-health-timeout`（节点运行超过声明超时）、`/tmp/maestro-i19-health-crash`（会话崩溃/已隔离）、`/tmp/maestro-i19-health-role`（角色不可用）、`/tmp/maestro-i19-health-conn-rejected`（连接线被拒绝）、`/tmp/maestro-i19-health-conn-expired`（连接线已过期）；都注入 `NODE_ENV=test`。
- **When** 用户在六个夹具分别执行 `orch instance status INST-001`。
- **Then** 六者都显示“健康度 需关注”，健康度行逐字为附录 A-6 附的对应行：`健康度 需关注 · 有待处理升级`、`健康度 需关注 · 节点 T-001 执行超时`、`健康度 需关注 · 会话 mock-sess-12345-1 崩溃`、`健康度 需关注 · 角色 开发 不可用`、`健康度 需关注 · 连接线 测试→开发 已拒绝`、`健康度 需关注 · 连接线 测试→开发 已过期`。允许一次同时命中多个原因，此时原因按 A-6 附的固定顺序用同一个 ` · ` 并列，断言目标原因必须出现。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言六种原因全部命中且六条健康度行与附录 A-6 附逐字相等、每次只显示“需关注”一档、原因顺序固定；**每个夹具只含目标条件**（角色与崩溃分开构造，隔离会话只计“崩溃”、升级会话只计“角色不可用”），因此单行可逐字命中。节点超时按 `当前时刻 − 节点 startedAt > 实例快照的 health.nodeTimeoutMs` 判定（`startedAt` 是实例快照里节点开始时刻，见附录 B-1；阈值缺省 30000 毫秒，见附录 D-3；严格大于：31 秒 vs 30 秒命中）。**等值边界下沉单元级**：在 `test/wp12/health.test.js` 中对 `computeHealth({ state, now })` 注入固定 `now`，断言 `now − startedAt === 30000` 时**不**命中“节点超时”、`=== 30001` 时命中；同一组单测覆盖 AC-14 的 P90 等值与 AC-15 的 TTL 等值。
- 夹具：六个夹具分别构造对应快照，**每个快照只放一种红条件**并在 `NODE_ENV=test` 下渲染状态文本（全部直接写快照，避免真实运行顺带产生第二条原因；**每个夹具都按 §3.3 先在空目录拉起核心、再写快照**，避免启动对账把 `running` 判成 `interrupted`）。
  - **待处理升级**：`escalations: [{state:'pending'}]`，其余无异常。
  - **节点超时**：`nodes[0].state='running'`、`nodes[0].startedAt = new Date(Date.now() - 31000).toISOString()`、`health.nodeTimeoutMs = 30000`、实例状态 `running`；**不注入工作流定义、不依赖时钟接缝**，健康度在 `instance status` 读取时按真实 `Date.now()` 计算（31s 与 30s 之间留 1s 安全余量，δ 只会让结论更确定）。
  - **会话崩溃**：一条 `sessions[].quarantined = true` 且其绑定节点 `failed`，**不**放升级、该会话 `state` 不是 `escalated`。
  - **角色不可用**：`code-loop` 快照里 `T-001`（`roleId: 'developer'`）绑定的一条会话 `state: 'escalated'`、`quarantined: false`，`T-001` 节点状态 `review`（非 `running`，不触发超时；非 `failed/escalated`，不触发崩溃），**不放升级**。
  - **连接线两种状态**：各用一个独立夹具、各自只放一条连接线——`conn-rejected` 的快照里只有一条 `state: 'rejected'` 的交接包，`conn-expired` 的快照里只有一条 `state: 'expired'` 的交接包，避免两条并列后无法逐字命中单行。
- 架构检查：红条件读取既有状态字段与新增的实例级阈值 `health.nodeTimeoutMs`；不新增节点/会话/交接包状态字段。

**AC-14 · 健康度 🟡 超过 P90：样本、阈值与边界**
- 场景类型：功能 / 阈值
- 风险：中（口径必须可复现）
- 引用：BR-12, BR-19
- **Given** 用户在 `/tmp/maestro-i19-health-p90` 准备三个运行中的 `code-loop` 实例，都显式写入 `health.nodeTimeoutMs = 300000`（使最长 70s 的运行时长也远小于 300s 超时阈值，不会先命中红档）：`INST-001` 与 `INST-002` 各有 5 条已结束跨度（时长 10s、20s、30s、40s、50s，故 P90=50s），`INST-003` 只有 4 条已结束跨度（10s、20s、30s、40s，样本少于 5 条）。三个实例的第 6 个节点 `T-006` 都在运行中：`INST-001` 已运行 **70s**（明显超过 P90=50s）、`INST-002` 已运行 **30s**（明显低于 P90=50s）、`INST-003` 已运行 **70s**。三者 `NODE_ENV=test`。
- **When** 用户分别对三个实例执行 `orch instance status INST-001`、`orch instance status INST-002`、`orch instance status INST-003`。
- **Then** `INST-001` 健康度显示“慢”，原因行为附录 A-6 附的 `健康度 慢 · 节点 T-006 执行超过本实例 P90`；`INST-002` 显示“正常”（30s 明显低于 P90=50s，且未触发任何红条件）；`INST-003` 显示“正常”（4 条样本 < 5 条最小样本，不触发“慢”）。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中按最近秩法计算 P90（升序第 ⌈0.9×N⌉ 条），断言 5 条样本时 P90=50s、70s 触发、30s 不触发、4 条样本不触发；三次 `instance status` 的档位依次为 `慢` / `正常` / `正常`（三个独立实例，互不影响）。**等值边界不在 CLI 级断言**：在 `test/wp12/health.test.js` 中对 `computeHealth({ state, now })` 注入固定 `now`，断言运行时长**恰好等于** P90=50000ms 时**不**判“慢”、`50001ms` 时判“慢”（此时 `health.nodeTimeoutMs` 取 300000，超时红档不会抢先命中）。
- 夹具：`cd /tmp/maestro-i19-health-p90`，**按 §3.3 先在空目录拉起核心**，再分别为三个实例写 `state.json` 与 `state/traces.jsonl`：每个实例写 5 条已结束跨度（`INST-003` 只写 4 条，时长 10s、20s、30s、40s），再写一个运行中节点 `T-006`，`INST-001` / `INST-003` 的 `startedAt = new Date(Date.now() - 70000).toISOString()`、`INST-002` 的 `startedAt = new Date(Date.now() - 30000).toISOString()`；三个实例的 `state.json` 都写 `health: { nodeTimeoutMs: 300000 }`。随后依次执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`、`... INST-002`、`... INST-003`。**不依赖时钟注入、不 `sleep`**；健康度按读取时的真实 `Date.now()` 计算，CLI 级只使用 70s / 30s 这类远离 50s 的值。
- 架构检查：P90 只读追踪，不修改追踪文件。

**AC-15 · 健康度 🟡 连接线待投递超过 TTL 50%**
- 场景类型：功能 / 阈值 / 边界
- 风险：中（TTL 口径必须明确）
- 引用：BR-12, BR-20
- **Given** 用户在 `/tmp/maestro-i19-health-ttl` 准备三个 `code-loop` 实例，**每个实例只放一条 `pending` 交接包**，避免多原因并列：`INST-001` 的包进入待投递时刻距读取时约 **14 分 55 秒**（明显未过 15 分钟）；`INST-002` 的包进入待投递时刻距读取时约 **15 分 05 秒**（明显超过 15 分钟）；`INST-003` 的包状态为 `pending` 但**没有起算时间**。三者 `NODE_ENV=test`。
- **When** 用户分别执行 `orch instance status INST-001`、`orch instance status INST-002`、`orch instance status INST-003`。
- **Then** `INST-002` 的包命中“慢”，健康度行逐字为附录 A-6 附的 `健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半`（`HO-006` 为 A-0 占位符，夹具按实际待投递包编号替换）；`INST-001` 的 14:55 包不命中（未过一半）；`INST-003` 没有起算时间，不命中、不报错；两个不命中的实例显示“正常”。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言 15:05 命中且健康度行与附录 A-6 附逐字相等、14:55 不命中、无起算时间不命中，且不改变交接包状态。**等值边界不在 CLI 级断言**：在 `test/wp12/health.test.js` 中对 `computeHealth({ state, now })` 注入固定 `now`，断言待投递时长**恰好等于** 900000ms 时**不**命中、`900001ms` 时命中、`899999ms` 时不命中（对应 BR-20 的“严格大于 15 分钟，恰好 15 分钟不算”）。
- 夹具：`cd /tmp/maestro-i19-health-ttl`，**按 §3.3 先在空目录拉起核心**，再为三个实例各写一条 `state: 'pending'` 的交接包：`INST-001` 的 `pendingAt = new Date(Date.now() - 895000).toISOString()`（14:55）、`INST-002` 的 `pendingAt = new Date(Date.now() - 905000).toISOString()`（15:05）、`INST-003` 的 `pendingAt` 缺失（且无 `createdAt`）；三个实例都只放这一条 `pending` 包，其余状态为 `running` 且没有运行中节点。随后依次执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`、`... INST-002`、`... INST-003`。**不拨钟、不 `sleep`**；健康度按读取时的真实 `Date.now()` 与各包的 `pendingAt` 计算，CLI 级 14:55 / 15:05 与 15:00 各留 5 分钟安全余量，δ 不可能把结论反转。
- 架构检查：本迭代不实现 `pending → expired` 自动过期，健康度只读时间。

**AC-16 · 规划验收②：健康度在实例状态变化后正确更新并进事件日志**
- 场景类型：规划验收（核心）
- 风险：高（规划逐字验收句）
- 引用：BR-14, BR-15
- 判据（规划逐字）：健康度在实例状态变化后正确更新并进事件日志。
- **Given** 用户在 `/tmp/maestro-i19-health-event` 准备一个运行中的 `code-loop` 实例：`state: 'running'`、`nodes: T-001 done / T-002 pending`（没有 `running` 节点）、`sessions: []`、`escalations: []`、`health.nodeTimeoutMs = 300000`，即**没有任何异常**（健康度应为“正常”），`NODE_ENV=test`。
- **When** 用户先执行 `orch instance status INST-001` 看到“正常”；随后夹具在该实例快照里**只追加一条 `state: 'pending'` 的升级**（不改节点、不改会话、不新增任何会话级异常），用户再执行 `orch instance status INST-001`，并执行 `orch instance log INST-001` 文本视图与 `orch instance log INST-001 --format json`。
- **Then** 健康度从“正常”变为“需关注”，用户看到的顺序是：`orch instance status` 显示 `健康度 需关注 · 有待处理升级`（夹具只加了这一条异常，因此不并列其他原因）；`orch instance log INST-001` 的文本视图新增一行，以时刻开头、其后逐字为 `健康度 INST-001  正常 → 需关注  原因 有待处理升级`（中文原因，不出现英文档位词）；该记录本身也接在链尾。用户若用 `--format json` 对外交付，同一条记录的 `reason` 为 `health.changed`、`detail.reasons` 含 `pending_escalation` —— **中文原因是用户可见判据，码值是 JSON 机读层**，两层一一对应、不互相替代（逐字见附录 A-8）。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言变化前后的档位、原因与事件字段（`from`/`to`/`reason`/`detail.reasons`），事件链指纹连续；同一档位连续执行两次 `orch instance status` 后 `events.jsonl` 的条数不变（档位未变不追加同类事件）；同一档位每次变化至多追加一条事件，不重复。
- 夹具：`cd /tmp/maestro-i19-health-event`，**按 §3.3 先在空目录拉起核心**，再写 `state.json`（无 `health.level`、只有 `health.nodeTimeoutMs: 300000`，无升级），执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`（首次计算写回 `health`，按 BR-15 不算档位变化、不追加事件）；随后**读回**该 `state.json`（保留首次写入的 `health`），只追加 `escalations: [{escalationId:'ESC-001',nodeId:'T-002',state:'pending'}]` 并更新 `updatedAt`，再执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`、`node "$MAESTRO_REPO/bin/orch.js" instance log INST-001`（文本视图，对照附录 A-8 的文本基行）与 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json`，并对比命令前后的 `events.jsonl` 条数。该变化由第二次读取触发一次窄 CAS 写入与一条 `health.changed`（D-3），不依赖真实升级场景，因此不会顺带产生“会话崩溃 / 角色不可用”。
- 架构检查：健康度变化事件不得重复；档位未变时不追加同类事件；新增事件类型只有 `health.changed` 一种。

**AC-17 · 健康度写入实例元数据，并在两个用户面可见**
- 场景类型：功能 / 可见性
- 风险：中
- 引用：BR-14
- **Given** 用户在 `/tmp/maestro-i19-health-visible` 用 `task-loop` 的 `dispatch-fail-first` 场景跑出一个“需关注”实例：第 1 次派发失败生成一条待处理升级，且没有任何会话被建立（因此不会并列出“会话崩溃 / 角色不可用”），`NODE_ENV=test`。
- **When** 用户执行 `orch instance status INST-001`，并打开 `.orch/instances/INST-001/workspace/status.md`；随后检查实例元数据。
- **Then** `orch instance status` 显示“健康度 需关注 · 有待处理升级”；`status.md` 出现同一行“- 健康度：需关注 · 有待处理升级”；用户再次查看时仍看到同一档位与原因，不需要重新推断。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言实例元数据中的档位与原因、状态行、`status.md` 行三者一致。
- 夹具：`cd /tmp/maestro-i19-health-visible && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/task-loop-driver.mjs" --root /tmp/maestro-i19-health-visible --scenario dispatch-fail-first`（场景文件 `test/fixtures/scenarios/task-loop/dispatch-fail-first.json`）；该场景以升级收尾，`orch run` 退出码非 `0` 属预期。随后执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001` 并查看 `workspace/status.md`。实测终态：`state: suspended`、`nodes: T-001 escalated / T-002·T-003 pending`、`sessions: []`、`escalations: [ESC-001 pending]`，升级原因 `dispatch_failed`。
- 架构检查：健康度只写入实例元数据，不写入 `graph.json`。

**AC-18 · 健康度只读：不改变节点/会话/交接包，不触发升级**
- 场景类型：功能 / 边界
- 风险：中（误写会污染编排状态）
- 引用：BR-16
- **Given** 用户在 `/tmp/maestro-i19-health-readonly` 用 `task-loop` 的 `dispatch-fail-first` 场景跑出一个“需关注”实例（终态只有一条待处理升级，无会话），`NODE_ENV=test`。
- **When** 用户连续执行三次 `orch instance status INST-001` 与三次 `orch trace show INST-001`，并比较节点、会话、交接包、升级四组状态；同时保留该实例那次运行的终端输出，核对收尾没有多出健康度行。
- **Then** 四组状态完全不变；没有新增升级；健康度档位不因查看而改变；`orch run` 的收尾输出没有多出健康度行。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言四组状态深比较相等、升级条数不变、运行输出无健康度行。
- 夹具：`cd /tmp/maestro-i19-health-readonly && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/task-loop-driver.mjs" --root /tmp/maestro-i19-health-readonly --scenario dispatch-fail-first`（保存该次运行的终端输出；退出码非 `0` 属预期），再连续执行 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001` 与 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001` 各三次。
- 架构检查：健康度计算不得调用状态迁移或升级生成接口。

**AC-19 · 既有状态输出不回归：只允许新增一行健康度**
- 场景类型：回归
- 风险：高（用户可见输出）
- 引用：BR-18
- **Given** 用户在 `/tmp/maestro-i19-regress-status` 跑完 `single` 与 `code-loop` 两个实例，`NODE_ENV=test`。
- **When** 用户分别执行 `orch instance status INST-001`、`orch instance graph INST-001 --format json`、`orch instance graph INST-001`。
- **Then** `instance status` 的原有各行文字与相对顺序完全不变，只在实例状态行之后新增一行健康度；`instance graph` 的文本与 JSON 输出逐字不变，不出现健康度字段。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中把 `instance status` 输出删除健康度行后与基线逐字比较，`instance graph` 输出与基线字节比较。
- 夹具：两类实例各跑一遍，保存 `instance status` 与 `instance graph` 两种格式的输出；对照 `test/templates/**` 与 I1.7 收口基线。
- 架构检查：`renderGraphJson` / `renderGraphText` 不改；健康度只在 `instance status` 与 `status.md` 渲染。

**AC-20 · 非功能：零依赖、中文唯一来源、纯净扫描、无宿主分支**
- 场景类型：非功能 / 架构
- 风险：中（违反即阻断合入）
- 引用：无（非功能约束）
- **Given** 仓库完成本迭代实现，`NODE_ENV=test`。
- **When** 检查依赖、中文来源、纯净扫描与宿主分支。
- **Then** `dependencies` 仍为 `{}`；新增中文全部来自 `src/cli/labels.js`；`src/core` / `src/daemon` 不出现 31 词禁词、不出现 `if host ==` / `switch (host)` 分支；空白与契约测试全绿。
- 机检：`cd "$MAESTRO_REPO" && node -p "Object.keys(require('./package.json').dependencies||{}).length"` 必须输出 `0`；`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中 `labels-sync` 与纯净扫描用例通过。
- 夹具：本 AC 是仓库静态检查，不使用业务夹具；命令在 `NODE_ENV=test` 下从仓库根执行，不读写 `/tmp` 业务数据，避免环境漂移。
- 架构检查：`cd "$MAESTRO_REPO" && node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check` 必须 `exit 0`。

**AC-21 · 事件链的历史兼容：旧记录无标记、末行被截断仍能续链**
- 场景类型：功能 / 异常 / 兼容
- 风险：高（升级后第一笔写入就会碰到，处理错会污染整条链）
- 引用：BR-01, BR-02, BR-22
- **Given** 两个夹具：`/tmp/maestro-i19-chain-legacy` 里 `events.jsonl` 已预置 3 条升级前写入、没有“前一条指纹”标记的记录（序号 1~3）；`/tmp/maestro-i19-chain-truncated` 同样 3 条，且末行被强杀截断成半行；两者都注入 `NODE_ENV=test`。
- **When** 用户在两个夹具内各跑一次单节点实例，让新记录追加进去，然后执行 `orch instance log INST-001`（文本视图）与 `orch instance log INST-001 --format json`。
- **Then** 用户看到：旧记录原样保留（内容、顺序、序号都不变，不回填标记）；新记录的序号从 4 接着往下走、不回 1、不重号；`truncated` 夹具里用户看到一行“已跳过 1 行不可读记录”的提示（逐字为附录 A-13），其余记录与链照常可读；两个夹具都**没有**“校验失败”“链已断”之类的报错，实例照常跑完、命令以成功退出码结束——即“校验失败时不阻断启动，链从最近一条可解析记录继续”。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言旧 3 行字节哈希运行前后一致、新记录 `seq` 从 4 起连续、新记录首条的 `prev_event_hash` 等于旧第 3 条记录的规范化指纹、`badLines` 计数为 1、命令退出码为 `0`。
- 夹具：`cd /tmp/maestro-i19-chain-legacy && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，随后 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001`（文本视图，`truncated` 夹具据此对照附录 A-13）与 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json`；`truncated` 夹具先复制前者的 3 行再截断末行（`head -c` 去掉最后一个字符）后跑同样两条命令。
- 架构检查：续链逻辑必须复用既有“末行坏则前溯”的口径，不得新增第二条序号来源；不得对旧记录做任何回填写入。

**AC-22 · 进行中的跨度：显示“进行中”与结束位“—”，不显示“暂无追踪记录”**
- 场景类型：功能 / 边界
- 风险：中（运行中的实例是最常见的查看时刻）
- 引用：BR-06, BR-09
- **Given** 用户在 `/tmp/maestro-i19-trace-running` 启动一个单节点实例，用宿主夹具的 `--hold-session` 让节点停在运行中：节点已派发、尚无任何已结束跨度，`NODE_ENV=test`。
- **When** 用户执行 `orch trace show INST-001`；随后放行该节点跑完，再执行一次同一命令。
- **Then** 第一次输出逐字为附录 A-10：实例与追踪号一行、`跨度 0 条 · 回流 0 次`、一行 `10:00:00 → —  T-001  进行中  交接 HO-001`，以及末尾的“回流链”“无”两行——结束位置显示“—”、结果位显示“进行中”，不伪造结束时刻，也不显示“暂无追踪记录”；第二次输出变成一条已完成跨度、汇总为 `跨度 1 条 · 回流 0 次`，原来那行“进行中”不再出现，末尾仍是“回流链”“无”两行。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言第一次输出含“进行中”且结束位为“—”且不含“暂无追踪记录”、汇总为“跨度 0 条”、退出码 `0`；放行后断言汇总为“跨度 1 条”且不含“进行中”。
- 夹具：`cd /tmp/maestro-i19-trace-running && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，宿主夹具以 `--hold-session` 保持会话不落定；在另一进程执行 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`，再放行宿主会话。
- 架构检查：进行中的行由读取时按当前实例状态叠加得出，不写入 `traces.jsonl`。

**AC-23 · 追踪异常：文件缺失、单行损坏、缺时间字段都降级且可见**
- 场景类型：功能 / 异常 / 边界
- 风险：中（异常被静默吞掉会让用户误信“没有异常”）
- 引用：BR-24, BR-19
- **Given** 三个夹具：`/tmp/maestro-i19-trace-degraded-missing` 删除了实例的追踪文件；`/tmp/maestro-i19-trace-degraded-badline` 的追踪文件含 1 条损坏行与 2 条正常跨度；`/tmp/maestro-i19-trace-degraded-notime` 的跨度缺少起止时刻；三者都是“需关注”以外的正常运行中实例，并注入 `NODE_ENV=test`。
- **When** 用户在每个夹具分别执行 `orch trace show INST-001` 与 `orch instance status INST-001`。
- **Then** 三个夹具都正常出结果、退出码 `0`、不打印堆栈：`missing` 显示“暂无追踪记录”，健康度照常给出（不因缺文件报错）；`badline` 显示“追踪记录有 1 行不可读，已跳过”（附录 A-11），并照常列出 2 条正常跨度；`notime` 的跨度不计入 P90 样本，健康度仍给出档位、不误判为“慢”。异常一律有可见提示，不被静默吞掉。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言三者退出码为 `0`、输出无堆栈、`badline` 的跳过行数为 1 且正常跨度数为 2、`notime` 的 P90 样本数为 0 且档位不为“慢”。
- 夹具：三个夹具分别删除文件、写入一条 `{"trace_id":` 半行、删除跨度的 `start_time` / `end_time`，再执行上述两条命令。
- 架构检查：追踪读取只跳过坏行并计数，不因一行损坏拒绝整份文件；健康度计算不得读取完整日志正文。

**AC-24 · 会话的审计粒度：逐条状态不进主审计，摘要回答“为什么结束”**
- 场景类型：功能 / 审计
- 风险：高（与基线 564 行的审计粒度直接对应）
- 引用：BR-04, BR-23
- **Given** 用户在 `/tmp/maestro-i19-audit-grain` 跑一个带失败节点的实例（宿主夹具上报一次非零退出的工具调用），`NODE_ENV=test`；另有一份升级前遗留的实例目录 `/tmp/maestro-i19-audit-legacy`，其中已有历史的逐条会话记录。
- **When** 用户执行 `orch instance log INST-001`、`orch instance log INST-001 --format json`，并对遗留实例执行同一命令。
- **Then** 新实例的会话结束处有一条摘要，逐字含命令、退出码、关键输出行数、日志引用四项（取值同附录 A-4，在 `orch instance log` 文本视图里逐字为附录 A-12），用户据此回答“这个会话为什么结束”，不必逐条读会话状态；本迭代**新增的会话级记录只有这一种摘要**，没有新增第二类逐条会话审计；审批等治理动作仍照常在日志里留痕。遗留实例里既有的逐条会话记录仍按原样可读（只追加、不可改写），其清退按基线 898 行由 I1.12 承接（附录 B 的 U-7），用户不会看到历史记录被删改。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言新实例中 `reason` 为 `execution.summary` 的会话摘要每个会话恰好 1 条、四项取值与夹具一致；断言本实例事件里除 `execution.summary` 外没有新增的会话级事件类型；断言遗留实例的事件条数与字节在查看前后不变。
- 夹具：夹具预置 `/tmp/maestro-i19-audit-grain/.orch/hosts/mock.json`，`launch.args` 指向仓库内 `test/fixtures/mock-acp-agent.js` 并带 `--fail-tool`；`cd /tmp/maestro-i19-audit-grain && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "执行 out/run.js"`；遗留目录由夹具预置三条逐条会话记录。
- 架构检查：`cd "$MAESTRO_REPO" && grep -c "object: 'session'" src/core/orchestrator.js` 不得超过 `13`（12 处既有发射点 + 1 处摘要写入点）；会话级事件类型只允许新增 `execution.summary` 一种，不得出现第三类逐条会话事件；摘要写入复用会话收尾的既有路径，不另开事件通道。

**AC-25 · 事件链整份不可解析：从固定起点重起链、序号从 1、旧行原样保留**
- 场景类型：功能 / 异常 / 兼容
- 风险：中（只在整个文件都损坏时触发，处理错会丢旧记录或阻断启动）
- 引用：BR-01, BR-02, BR-22, BR-25
- **Given** `/tmp/maestro-i19-chain-corrupt` 里 `events.jsonl` 已预置 3 行整份不可解析的内容（每行都不是可读的事件记录，一条可解析记录都没有），`NODE_ENV=test`。
- **When** 用户在夹具内跑一次单节点实例，让新记录追加进去，然后执行 `orch instance log INST-001` 与 `orch instance log INST-001 --format json`。
- **Then** 用户看到：旧的 3 行原样还在（行数、内容、字节都不变，没有被删除、改写或改名）；文本视图末尾多出一行“已跳过 3 行不可读记录”（逐字为附录 A-13）；新记录从序号 1 重新开始、逐条递增、彼此不重号；没有“校验失败”“链已断”之类的报错，实例照常跑完、两条命令都以成功退出码结束。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言旧 3 行字节哈希运行前后一致、新记录 `seq` 从 1 起连续无空洞、新链首条的 `prev_event_hash` 为 64 个 `0`、跳过行数计数为 3、两条命令退出码均为 `0`。
- 夹具：`cd /tmp/maestro-i19-chain-corrupt && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --task "写一份说明"`，随后执行 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001` 与 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json`；夹具预置的 3 行是不含任何 JSON 结构的乱码文本。
- 架构检查：重起链不得删除、重命名或改写原文件；不得新增第二条序号来源；提示行的跳过计数与读取层的坏行计数同源。

**AC-26 · 取消收尾的执行摘要：被取消的会话也答得出“为什么结束”**
- 场景类型：功能 / 审计 / 边界
- 风险：中（取消是会话收尾的第三种形态，缺它会让“为什么结束”在取消路径上无解）
- 引用：BR-04, BR-05, BR-23
- **Given** 用户在 `/tmp/maestro-i19-cancel-summary` 启动一个单节点实例，宿主夹具以 `--turn-delay-ms 30000` 在首次工具调用后保持 30 秒，使会话进入 `tool_running`（工具调用已上报、尚未结束），`NODE_ENV=test`。
- **When** 用户在另一进程执行 `orch cancel --instance INST-001`；该 run 仍在核心的 `activeRuns` 中（`finished=false`），因此走 **live 取消** `cancelLive`（`src/core/orchestrator.js:3746-3747`），再以 `ctx` 调 `applyCancel`（`:3801`），不是 `:3762` 的 `applyCancel(instanceId, state, emit, null)` 分支。随后执行 `orch instance log INST-001`（文本视图）与 `orch instance status INST-001`。
- **Then** 该会话结束处出现一条执行摘要，除行首时刻与会话号取夹具实际值外逐字为附录 A-14：`会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供`。本 AC 覆盖的是 live 取消：`ctx` 摘要缓存里只有 `tool_call.title`（mock 实测 `write`），它是工具名、不是命令；且 `applyCancel` 在落盘前把 `session.toolName` 置空（`:3843`）。因此四项一律显示“未提供”，不猜值、不省略；实例状态变为“已取消”（实测 `cancelled`），健康度为“已结束”且不再回升为“需关注”或“慢”；取消这一条仍是会话级唯一新增的记录类型，没有多出逐条会话审计；`orch cancel` 本身以成功退出码结束。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言该会话 `reason` 为 `execution.summary` 的记录恰好 1 条、四项取值与附录 A-14 逐项相等（`command` / `exitCode` / `keyOutputLines` / `logRef` 全为空并渲染为“未提供”）、实例状态为 `cancelled`、健康度为 `ended`、`orch cancel` 退出码为 `0`，且本实例除 `execution.summary` 与既有 12 处冻结的会话级事件外，没有新增的第二类会话级事件。
- 夹具：夹具预置 `/tmp/maestro-i19-cancel-summary/.orch/hosts/mock.json`，`launch.command` 为 Node、`launch.args` 指向仓库内 `test/fixtures/mock-acp-agent.js` 并带 `--turn-delay-ms 30000`；执行 `cd /tmp/maestro-i19-cancel-summary && NODE_ENV=test node "$MAESTRO_REPO/bin/orch.js" run --cwd . --template single --host mock --task "执行 out/run.js"`。夹具监听 `events.jsonl`，出现该会话 `to: 'tool_running'` 的事件（`reason: 'session.state'`）后，另一进程执行 `node "$MAESTRO_REPO/bin/orch.js" cancel --instance INST-001`，再执行 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001` 与 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`，两份输出逐字断言。实测取消后会话 `state=idle`、`toolName=null`、`quarantined=true`，节点 `cancelled`，交接包 `rejected`。
- 架构检查：取消摘要复用 `applyCancel` 这一既有收尾路径，不新增第四个摘要入口；`grep -c "object: 'session'" src/core/orchestrator.js` 仍不得超过 `13`。

**AC-27 · 同一节点多轮：每轮会话各一条摘要，条数等于轮次**
- 场景类型：功能 / 回流 / 边界
- 风险：中（条数口径不清会让“一个节点几条摘要”无法判定）
- 引用：BR-04
- **Given** 用户在 `/tmp/maestro-i19-summary-rounds` 用 `code-loop` 跑一次回流、开发节点经历两轮：测试第 1 轮驳回 → 开发节点第 2 轮返工完成；驱动停在“第 3 步（开发返工）已完成、第 4 步（复测）尚未派发”的窗口（`.mock/stopped-after-3` 存在）。此时开发节点 `T-001 开发` 经历第 1、2 两轮会话，测试节点 `T-002 测试` 只经历第 1 轮会话，`NODE_ENV=test`。
- **When** 用户在该暂停窗口内执行 `orch instance log INST-001`（文本视图）、`orch instance log INST-001 --format json`，再执行 `orch trace show INST-001`。
- **Then** 日志里 `T-001` 出现 2 条执行摘要行（第 1 轮、第 2 轮各 1 条），按时刻升序排列，各自完整、不合并也不覆盖，行数等于该节点经历的会话轮次数（附录 A-12 的行数判据）；这 2 行也等于 `orch trace show` 里 `T-001` 出现的跨度行数（2 条）；同一夹具里的单轮节点 `T-002` 只有 1 条摘要、1 条跨度（与 AC-04 的“一条会话一条摘要”口径一致；AC-04 是 `single` 单节点示例，不是本夹具的 `T-002`）。用户据此能按轮次回答“这一轮为什么结束”。
- 机检：`cd "$MAESTRO_REPO" && NODE_ENV=test node --test "test/**/*.test.js"` 中断言 `.mock/stopped-after-3` 存在、`execution.summary` 中 `detail.nodeId` 为 `T-001` 的记录恰为 2 条、`detail.round` 分别为 1 与 2、`detail.nodeId` 为 `T-002` 的记录恰为 1 条、每个会话恰好 1 条、全文摘要条数等于会话数，且文本视图中 `T-001` 的摘要行数为 2、`T-002` 为 1。
- 夹具：在**第二进程/后台**启动 driver（`--keep` 会阻塞到 SIGINT，`code-loop-driver.mjs:801-809`）：`cd /tmp/maestro-i19-summary-rounds && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/code-loop-driver.mjs" --root /tmp/maestro-i19-summary-rounds --scenario backflow-once --stop-after 3 --keep & DRV=$!`；然后轮询 `.mock/stopped-after-3`（文件出现即继续，不使用固定 `sleep`），出现后执行 `node "$MAESTRO_REPO/bin/orch.js" instance log INST-001`、`node "$MAESTRO_REPO/bin/orch.js" instance log INST-001 --format json` 与 `node "$MAESTRO_REPO/bin/orch.js" trace show INST-001`；断言完成写 `.mock/release` 放行并 `kill -INT $DRV` 结束 driver。`--stop-after 3` 以 `MAESTRO_TEST_STOP_AFTER=3` 传给核心，核心在 `counters.dispatchCount` 达到 3、派发第 4 步之前写 `.mock/stopped-after-3` 并等待 `.mock/release`（`code-loop-driver.mjs:386-392`、`:714-716`；`src/core/orchestrator.js:354`、`:4164-4183`、`:3141`）。
- 架构检查：摘要按会话追加，不按节点覆盖写；不新增第二个摘要入口。

### 3.2 非功能验收标准

- **NF-1（可读性）**：用户执行一次 `orch instance status`，10 秒内拿到健康度结论；一次 `orch trace show`，在 20 个节点、50 条跨度的夹具上 1 秒内输出完整时间线。
- **NF-2（可靠性）**：审计链断点、序号重复、旧行被改写均为 0；追踪单行损坏只跳过该行并计数，不让整份追踪不可读；健康度计算遇到缺失字段按“条件不成立”处理，不崩溃、不误报。
- **NF-3（无回归）**：三条主链运行输出逐字不变；`instance status` / `graph` 既有非健康度输出逐字不变；全量测试的失败集合与 I1.7 基线差集为 0，测试条数只增不减。
- **NF-4（边界）**：完整执行日志不进入实例目录；追踪与摘要不复制宿主日志正文；健康度不改变任何编排状态。
- **NF-5（依赖）**：零第三方运行时依赖，`dependencies` 保持 `{}`。

### 3.3 验收前置条件

- **环境**：Node ≥ 22；仓库根由 `MAESTRO_REPO` 指向；每个 AC 的独立项目根放在 `/tmp` 下，绝不放进仓库；所有命令注入 `NODE_ENV=test`。
- **宿主夹具**：在夹具根的 `.orch/hosts/mock.json` 中把 `launch.command` / `launch.args` 指向仓库内 `test/fixtures/mock-acp-agent.js`，运行时加 `--host mock`，由它扮演宿主；验收不需要真实 DSH、不需要模型凭据，属 B 类零 DSH。
- **回流场景的注入口径**：AC-07 / AC-08 / AC-27 一律用 `test/fixtures/code-loop-driver.mjs --root <夹具根> --scenario backflow-once`（或内置名 `--scenario backflow`，`code-loop-driver.mjs:145-146`），由驱动把 `--root` / `--scenario` 写进 `.orch/hosts/mock.json` 的 `launch.args`（`code-loop-driver.mjs:423-432`、`:450-451`）；场景步为“开发 r1 → 测试 r1 驳回 → 开发 r2 → 复测”（`:137-139`）。该场景只有 **1 次回流**；别名 `backflow-twice` / `retest-fail` 映射到 `rounds-exceeded`（`:230-231`），是“1 次回流 + 升级”，不是两次回流，不得用来断言“两次回流”。**不采用 `retest-hold`**：它在第 4 步已派发后把会话挂在 `start`（`:247-251`），会多出一条“进行中”跨度，无法与 A-3 的 3 行基线对齐。
- **中间态冻结（AC-08 / AC-27）**：用 `--stop-after 3`。驱动把它转成环境变量 `MAESTRO_TEST_STOP_AFTER=3`（`code-loop-driver.mjs:386-392`、`:714-716`），核心在 `counters.dispatchCount` 达到 3、派发第 4 步之前写 `.mock/stopped-after-3` 并轮询 `.mock/release`（`src/core/orchestrator.js:354`、`:4164-4183`，调用点 `:3141`）；这是在**核心侧**实现的既有测试接缝，不依赖 mock。冻结时刻为“开发第 2 轮已完成、复测尚未派发”，此时已完成跨度为 3 条、无进行中跨度。**`--keep` 会让 driver 打印摘要后阻塞等 SIGINT（`code-loop-driver.mjs:801-809`），因此 AC-08 / AC-27 的 driver 必须在第二进程/后台启动**：先 `& DRV=$!`，再轮询 `.mock/stopped-after-3`（文件出现即继续，不用固定 `sleep`），断言后写 `.mock/release` 放行并 `kill -INT $DRV`。
- **取消摘要的运行中窗口（AC-26）**：不用 `--hold-session`（该开关只在非场景模式下生效，且挂住时不会发出任何 `tool_call`，会话仍为 `idle`，`applyCancel` 会跳过 idle 会话、不写摘要）。改用 `mock-acp-agent.js` 的既有开关 `--turn-delay-ms 30000`：先发 `tool_call` 再保持 30 秒，会话进入 `tool_running` 后由第二进程取消；夹具监听 `events.jsonl` 中该会话 `to: 'tool_running'` 的记录（`reason: 'session.state'`），命中后立即取消，不依赖固定间隔轮询。该 run 仍在 `activeRuns` 中，实际走 `cancelLive` → `applyCancel(..., ctx, handle)`，**不是** `:3762` 的无 `ctx` 分支（见附录 A-14 与 D-4）。
- **失败摘要夹具**：实现侧需给 mock agent 增加一个**默认关闭**的失败工具步骤，开关名固定为 `--fail-tool`，能上报命令、退出码、输出行数与日志引用；另有**独立的缺项变体开关** `--fail-tool-no-refs`，只上报命令与退出码、不提供输出行数与日志引用，供 AC-05 使用。两个开关互不依赖，既有 12 个开关与三条场景套件的既有行为不得改变。
- **并发与轮询**：需要“边跑边看”的 AC（AC-01 追加前后比对、AC-08 / AC-27 的 `--keep` 冻结窗口、AC-22 的运行中查看、AC-26 的运行中取消）一律用**第二个进程**在同一夹具目录执行查看或取消命令，不引入终端复用；对 `events.jsonl` 的监听用文件监听（`fs.watch`）或“文件出现即复制”的一次性触发，**不使用固定间隔的 `sleep` 循环**，避免机器快慢影响判定。AC-11 / AC-16 已改为快照夹具，不再需要第二进程。
- **时间型条件（CLI 级只用安全余量）**：节点超时、P90、TTL 三项在 CLI 级不依赖时钟注入、也不 `sleep`；夹具把快照里的 `startedAt` / `pendingAt` 直接写成当前时刻之前的绝对 ISO 时刻，健康度在读取时按真实 `Date.now()` 计算。**为避免 δ>0 把“恰好等于阈值”推成“严格大于”**，CLI 级只使用远离边界的值：节点超时 `31s` vs 阈值 `30s`（31s 本就严格大于，δ 不改变结论）、P90 `70s` / `30s` vs P90 `50s`、TTL `15:05` / `14:55` vs `15:00`。**恰好等于阈值的等值边界一律下沉到单元级**：对纯函数 `computeHealth({ state, now })` 注入固定 `now`，断言“恰好等于不命中、超出 1ms 命中”（见 AC-13 / AC-14 / AC-15 的机检）。节点超时的阈值由实例快照的 `health.nodeTimeoutMs` 给出（缺省 30000 毫秒，见附录 D-3），AC-14 显式把它提高到 `300000`，使运行时长不触发红档；**不注入工作流定义**。
- **健康度矩阵夹具**：AC-13 的六个红条件**全部用只含该条件的实例快照构造**（不混放第二条异常），保证每条健康度行可逐字命中；AC-14 / AC-15 每个实例只放一条目标条件的记录；AC-16 用快照前后两次读取构造“正常 → 需关注”的真实档位变化；AC-17 / AC-18 用 `task-loop` 的 `dispatch-fail-first` 真实运行（终态只有一条待处理升级，无升级会话、无隔离会话，实测）。
  - **快照夹具的启动顺序（必须照做）**：核心启动时会对 `created` / `running` 的实例做对账，把不属于当前核心代的实例判为 `interrupted`（`orchestrator.js:4060-4078` 的 `reconcileOnBoot`），健康度会因此变成“已结束”。所以快照夹具必须**先在空目录上拉起核心**（执行一次 `node "$MAESTRO_REPO/bin/orch.js" instance status INST-001`，此时返回“不存在”并留下 daemon），**再写** `state.json` / `traces.jsonl`，最后才执行 `instance status`；这样写进去的 `running` 快照不会被对账改写。快照一律带 `schemaVersion: 2`（否则会被当成 legacy 跳过或按旧口径处理）。AC-09 的空实例快照同样适用（先起核心、再写 `state: 'created'`）。
- **task-loop 升级夹具（AC-17 / AC-18）**：固定用仓库内驱动与真实场景名——`cd <夹具根> && NODE_ENV=test node "$MAESTRO_REPO/test/fixtures/task-loop-driver.mjs" --root <夹具根> --scenario dispatch-fail-first`（场景文件 `test/fixtures/scenarios/task-loop/dispatch-fail-first.json`）。该场景在第 1 次派发即失败，终态 `suspended`、`nodes: T-001 escalated / T-002·T-003 pending`、`sessions: []`、`escalations: [ESC-001 pending]`（本轮实测）；因此健康度唯一原因是“有待处理升级”，不会并列“会话崩溃 / 角色不可用”。该场景以升级收尾，`orch run` 的退出码非 `0` 属预期，夹具不以退出码判失败。AC-16 不使用该驱动：其“正常 → 需关注”变化由快照前后两次读取构造（真实升级场景会同时产生隔离会话与不可用角色，破坏单行断言）。
- **命令口径**：所有 CLI 命令在夹具目录内以 `node "$MAESTRO_REPO/bin/orch.js" ...` 执行；`orch run` 必须带 `--cwd .`（该命令要求 `--cwd <目录>`，缺省会打印用法并以参数错误退出；本文件所有 `run` 夹具均已带 `--cwd .`）；路径断言只用相对路径或结尾匹配，不断言 `/tmp` 与 `/private/tmp` 的差异。
- **回归基线**：全量测试以 I1.7 基线 `1028 tests / 1019 pass / 8 fail / 1 skipped` 为对照；第五轮评审实测为 `1029 tests / 1019 pass / 9 fail / 1 skipped`，多出的 1 条为 `test/wp5/lifecycle.test.js` 的并行临时目录清理竞争（单独复跑 6/6 通过），非需求引入；收口仍以失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 的差集为 0 判定，不以“零失败”判定。

---

## 附录 A · 输出基线（用户可见文案）

> 所有用户可见中文取自 `src/cli/labels.js`；`status.md` 的字段名由 `src/core/status-text.js` 从 `labels.js` 镜像，两边由 `labels-sync` 测试锁定。以下为逐字基线，实现必须按此输出；“逐字”的边界由 **A-0 可变值约定**界定，A-1 ~ A-14 每一小节都适用该约定。

### A-0 可变值约定（适用 A-1 ~ A-14）

> “逐字”= 除下列**可变值**外，文字、空格、缩进、分隔符（` · ` / `→` / 两个空格）、标点、单位（`条` / `次` / `行`）与顺序完全相等。断言时先把可变值替换为夹具实际值，再逐字比较。

**逐字固定（不得随夹具变）**：

- 所有中文文案与层名（`实例` / `追踪` / `跨度` / `回流链` / `第 N 轮` / `会话` / `执行摘要` / `失败摘要` / `健康度` / `未提供` / `暂无追踪记录` / `进行中` / `无` 等）。
- 四档词只用 `正常` / `慢` / `需关注` / `已结束`；结果位只用 `已完成` / `失败` / `已取消` / `已中断` / `进行中`。
- 结束位占位固定为 `—`；摘要四项的分隔符固定为 ` · `；无交接时固定为 `交接 无`（本附录的 `single` / `code-loop` 示例都有交接包：`single` 固定 `HO-001`，`code-loop` 依次 `HO-001` / `HO-002`）。
- 节点列固定规则（只适用于 `orch trace show` 的跨度行）：图节点有 `title` 时输出 `节点号 标题`（如 `T-001 开发`）；无 `title` 时只输出节点号（如 `T-001`）；不输出 `roleId` 原文。`status.md` 只在图节点多于 1 个（`multi`）时输出 `## 节点` 段，`single` 的 `status.md` **不输出节点段**，因此 `status.md` 里不存在 `worker`；`orch trace show` 的 `single` 示例只显示 `T-001`，同样不出现 `worker`（`src/core/status-text.js:310-320`、`src/cli/render.js:567-584`）。
- 实例号在 A-1 ~ A-14 中固定为 `INST-001`；实例不存在用例固定为 `INST-999`。

**随夹具变（断言时替换，不作为逐字比较对象）**：

| 可变值 | 真实来源 | A 小节示例 |
|---|---|---|
| 时刻 | 夹具按真实时刻回填（`startedAt` / `pendingAt` / 跨度起止写成当前时刻之前的绝对 ISO 时刻），读取时用真实 `Date.now()`；不拨钟 | `10:00:00` / `10:02:10` |
| 追踪号 | 实例创建时随机生成，形如 `TRC-` + 8 位小写十六进制 | `TRC-1a2b3c4d` |
| 节点编号与标题 | `code-loop` 实测 `T-001 开发` / `T-002 测试`（`src/templates/index.js:193-216`）；`single` 的图节点 `title: null`、`roleId: worker`（`src/templates/index.js:161-173`），`ROLE_LABEL` 无 `worker`（`src/cli/labels.js:77-85`），因此 `orch trace show` 的节点列只显示节点号 `T-001`（`title ?? nodeId`，`src/core/status-text.js:167-168`），不显示角色；`single` 的 `status.md` 不输出 `## 节点` 段（`renderStatusDoc` 仅在 `multi` 时输出，`src/core/status-text.js:310-320`），因此不存在“只显示 T-001 的节点列”这一说法；`instance status` / `orch run` 的 single 节点行只显示 `节点 已完成 · 耗时 2s`（`render.js:567-584`，不渲染节点号与角色） | A-2 / A-4 / A-10 的 `single` 示例为 `T-001`（无角色）；A-3 的 `T-001 开发` / `T-002 测试` |
| 会话号 | mock 实时生成 `mock-sess-<pid>-<序号>`（`mock-acp-agent.js:377-378`，每次派发一个进程、`序号` 从 1 起） | A-6 附 / A-12 / A-14 的 `mock-sess-12345-1` |
| 追踪号 / 跨度时长 / P90 / TTL 数值 | 夹具样本与真实时刻回填（跨度 `start_time` / `end_time`、`pendingAt` 均为绝对 ISO 时刻） | A-2 / A-3 / A-10 / A-14 的时刻与时长 |
| 摘要四项取值（命令 / 退出码 / 关键输出行数 / 日志引用） | 宿主夹具上报；未上报则 `未提供` | A-4 / A-12 的 `node out/run.js` 等 |
| 交接包编号 | 按实例内已有交接包递增（`advance.js:120` 的 `HO-` + 3 位）；空实例的 code-loop 依次为 `HO-001` / `HO-002` / `HO-003` | A-3 的 `HO-001` / `HO-002` |
| 事件序号、事件时间戳、`prev_event_hash` | 事件总线写入时生成 | A-8 的 `seq` / `ts` / `prev_event_hash` |
| 跳过行数 `N`、原因码数组 | 读取时按实际坏行数与命中原因生成 | A-11 / A-13 的 `N`、A-8 的 `detail.reasons` |

### A-1 `orch trace show`：空追踪

```
实例 INST-001 · 暂无追踪记录
```

退出码 `0`。

### A-2 `orch trace show`：单节点、无回流

```
实例 INST-001 · 追踪 TRC-1a2b3c4d
跨度 1 条 · 回流 0 次

10:00:00 → 10:02:10  T-001  已完成  交接 HO-001

回流链
无
```

没有回流时「回流链」段仍然出现，标题下一行是 `无`（对应 BR-09 的“回流为‘无’”）；有回流时该段按 A-3 列出轮次与交接。A-2 与 A-3 构成“无回流 / 有回流”的完整分支覆盖。

### A-3 `orch trace show`：一次回流的跨角色因果链

> 本基线对应 `code-loop` 的冻结窗口：`--scenario backflow-once --stop-after 3`（开发第 2 轮完成、复测尚未派发，`.mock/stopped-after-3` 存在）。此时已落地跨度为 3 条、无进行中跨度；若跑到实例结束（复测通过），会多出第 4 条跨度，汇总变为“跨度 4 条 · 回流 1 次”，不属于本基线。

```
实例 INST-001 · 追踪 TRC-1a2b3c4d
跨度 3 条 · 回流 1 次

10:00:00 → 10:00:40  T-001 开发  已完成  交接 HO-001
10:00:40 → 10:01:30  T-002 测试  失败  交接 HO-001 HO-002
10:01:30 → 10:02:20  T-001 开发  已完成  交接 HO-002

回流链
第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成
```

> 冻结窗口实测（`--scenario backflow-once --stop-after 3`）：`HO-002` 的 `state = consumed`、`round = 2`，因此回流链行是“第 2 轮 / 已完成”，不是“第 1 轮 / 已接受”。`HO-002` 是唯一一条 `edge.kind='backflow'` 的交接包；`HO-001` 是第 1 轮正向包；`HO-003` 是完整跑完时才创建的复测包（冻结窗口内不存在），不计入“回流 1 次”。轮次口径见 §2.3.2。

### A-4 `orch trace show`：失败摘要四要素

> 示例取 `single` 模板的失败节点 `T-001`（`single` 的节点 `roleId: worker`、`title: null`；`ROLE_LABEL` 无 `worker`，因此 trace 的节点列只显示节点号 `T-001`，不显示角色；single 路径固定创建 `HO-001`，见 `orchestrator.js:3407`），四要素由 AC-04 的夹具注入；节点号、日志引用随夹具，其余文字与 ` · ` 分隔符固定。

```
10:00:40 → 10:01:30  T-001  失败  交接 HO-001
  失败摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
```

宿主未提供某项时，对应位置替换为 `未提供`，其余项不省略。

### A-5 `orch trace show`：实例不存在

```
实例 INST-999 · 不存在
```

退出码 `1`。

### A-6 健康度在 `orch instance status` 的四组基线

> 下列为模板逐字基线；示例中的节点号（`T-002`）与实例状态词随夹具不同而变，只有模板文字与分隔符固定——各 AC 的夹具按自己的节点号断言，文案骨架必须与本组一致（可变值口径见 A-0）。

正常：

```
实例 INST-001 · 运行中
健康度 正常
```

慢：

```
实例 INST-001 · 运行中
健康度 慢 · 节点 T-002 执行超过本实例 P90
```

需关注：

```
实例 INST-001 · 已挂起
健康度 需关注 · 有待处理升级
```

已结束：

```
实例 INST-001 · 已完成
健康度 已结束
```

**A-6 附：原因句逐字基线**

> 下列每行都是一条完整的健康度行；`T-001` / `T-006` / `mock-sess-12345-1` / 角色名 / `HO-006` / `测试→开发` 是占位符，随夹具替换为实参，其余文字、空格与 ` · `（空格 + 间隔号 + 空格）分隔符固定不变。**引用范围**：AC-13 / AC-14 / AC-15 的 Then 按本组逐字断言；AC-16 / AC-17 只在 `instance status` 的健康度行上引用本组的对应行（AC-16 另见 A-8 的日志文本行、AC-17 另见 A-7 的 `status.md` 行），不把本组格式套用到日志行或 `status.md` 行。

```
健康度 需关注 · 有待处理升级
健康度 需关注 · 节点 T-001 执行超时
健康度 需关注 · 会话 mock-sess-12345-1 崩溃
健康度 需关注 · 角色 开发 不可用
健康度 需关注 · 连接线 测试→开发 已拒绝
健康度 需关注 · 连接线 测试→开发 已过期
健康度 慢 · 节点 T-006 执行超过本实例 P90
健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半
```

- 单条命中时逐字为上面八行中的对应行；同一夹具同时命中多条时，原因按 D-3 的固定顺序用同一个 ` · ` 分隔符并列，例如 `健康度 需关注 · 有待处理升级 · 节点 T-001 执行超时`。
- 节点号只是占位符：A-6 正文慢档示例的 `节点 T-002` 与本节的 `节点 T-006` 同属占位符，实际取值随夹具（AC-14 用 `T-006`、AC-13 超时夹具用 `T-001`）。
- 档位词只用 `正常` / `慢` / `需关注` / `已结束` 四个中文词，不带 emoji、不带英文档位词。
- 本组只固定“档位 + 原因句”的文案；实例状态词（`运行中` / `已挂起` / `已完成` 等）随夹具变化，口径见 A-6 首段。

### A-7 健康度在 `status.md` 的基线

在 `- 状态：…` 之后插入一行，其余行不变：

```
- 状态：运行中
- 健康度：需关注 · 有待处理升级
- 暂停：否
```

### A-8 健康度变化事件（`orch instance log --format json` 可见）

```
{
  "object": "health",
  "objectId": "INST-001",
  "from": "normal",
  "to": "attention",
  "result": "applied",
  "reason": "health.changed",
  "detail": { "reasons": ["pending_escalation"] },
  "seq": 12,
  "ts": "2026-11-10T10:00:00.000Z",
  "prev_event_hash": "…"
}
```

同一事件在 `orch instance log` 文本视图中的基线（**用户可见判据以这一行为准**）：

```
10:00:00  健康度 INST-001  正常 → 需关注  原因 有待处理升级
```

两层表达固定分工，互不替代：

| 层 | 用户看到什么 | 取值 |
|---|---|---|
| 文本视图（`orch instance log`） | 用户可见判据，验收按此逐字断言 | 中文档位 + 中文原因（原因由 `HEALTH_REASON_*` 从码值映射） |
| JSON（`--format json`） | 供对外交付 / 机读，用户直接可见但不用来判「有没有说清原因」 | `reason: "health.changed"`、`detail.reasons: ["pending_escalation"]` |

即：**原因以中文句子的形式呈现给用户，码值只出现在 JSON 里**；两者由同一张映射表生成，一一对应（`pending_escalation` → `有待处理升级`，其余原因码同理）。

### A-9 文案键与归属

| 用户可见场景 | 键 | 归属 |
|---|---|---|
| 四档健康度词 | `HEALTH_LABEL` | `labels.js` |
| 健康度行模板与原因模板 | `HEALTH_LINE` / `HEALTH_REASON_*` | `labels.js` |
| `status.md` 字段名“健康度” | `CORE_TEXT.doc.health` | `status-text.js` 镜像 `labels.js` |
| 追踪头、跨度行、回流链、失败摘要 | `TRACE_*` / `SUMMARY_*` | `labels.js` |
| 三种空形态提示 | `TRACE_EMPTY` / `TRACE_NO_BACKFLOW` / `INSTANCE_MISSING` | `labels.js` |
| 进行中标识与结束位占位 | `TRACE_RUNNING` / `TRACE_NO_END` | `labels.js` |
| 追踪不可读行提示 | `TRACE_DEGRADED` | `labels.js` |
| `orch instance log` 的执行摘要行（A-12）与取消收尾的摘要行（A-14，同一行模板） | `SUMMARY_LOG_LINE` | `labels.js` |
| 事件日志的不可读行提示（A-13） | `EVENTS_SKIPPED` | `labels.js` |
| 既有实例/节点/会话/交接/升级文案 | 沿用既有键 | 不改 |

### A-10 `orch trace show`：进行中的跨度

```
实例 INST-001 · 追踪 TRC-1a2b3c4d
跨度 0 条 · 回流 0 次

10:00:00 → —  T-001  进行中  交接 HO-001

回流链
无
```

结束位固定为 `—`，结果位固定为 `进行中`，不出现“暂无追踪记录”；没有回流时「回流链」段照常出现、标题下一行为 `无`（与 A-2 同一条规则）。放行后该行变为已完成跨度（`10:00:00 → 10:02:10  T-001  已完成  交接 HO-001`，汇总变 `跨度 1 条 · 回流 0 次`，「回流链」段仍为 `无`）。

### A-11 `orch trace show`：追踪文件有不可读行

```
实例 INST-001 · 追踪 TRC-1a2b3c4d
追踪记录有 1 行不可读，已跳过
跨度 2 条 · 回流 0 次
```

提示行位于汇总行之前；`N` 为本次读取实际跳过的行数，正常跨度的行照常列出。追踪文件整体缺失时不出现该提示，按 A-1 显示“暂无追踪记录”。

### A-12 `orch instance log`：执行摘要那一行

```
10:02:10  会话 mock-sess-12345-1  执行摘要 命令 node out/run.js · 退出码 1 · 关键输出 3 行 · 日志 host-logs/T-001.log
```

- 行首为时刻，其后是层名 `会话`、会话号，再后是 `执行摘要` 加四项，四项之间用 ` · `（空格 + 间隔号 + 空格）分隔，取值与 A-4 的四项逐项相同。会话号是 mock 实时生成的 `mock-sess-<pid>-<序号>`（`mock-acp-agent.js:377-378`），示例 `mock-sess-12345-1` 中的数字随夹具替换（见 A-0）。
- 宿主未提供某项时，该位置替换为 `未提供`，其余项不省略（与 A-4 同一条降级规则）。
- 一行对一条会话：同一节点多轮回流时，每一轮会话各产生一行（完成、失败、取消各算该轮的一次收尾，同一轮不重复），行数等于该节点经历过的会话轮次数；各轮按时刻升序排列，不合并、不覆盖。
- 行数判据：一个节点的摘要行数等于该节点经历过的会话轮次数，也等于 `orch trace show` 里该节点出现的跨度行数——单轮节点一行对一条跨度，两轮返工的节点两行对两条跨度。
- 成功完成的节点同样有这一行，文案与失败时一致（`执行摘要` 前缀两种情形都用）；取消收尾的同一行模板见 A-14；`失败摘要` 前缀只出现在 `orch trace show` 的跨度下方（A-4）。本行是 `orch instance log` 里的用户可见判据。

### A-13 `orch instance log`：事件日志有不可读行

```
已跳过 1 行不可读记录
```

- 单独成行、不带时刻前缀，出现在事件行列表末尾；`N` 为本次读取实际跳过的行数（末行被截断时为 1，整份不可解析时为文件总行数）。
- 其余可读记录照常列出；文件整体可读时不出现该行。追踪侧的同类提示用 A-11 的措辞（`追踪记录有 N 行不可读，已跳过`），两者不混用。

### A-14 `orch instance log`：取消收尾的执行摘要

取消也是一种会话收尾，同样留一条摘要，行格式与 A-12 完全一致：

```
10:03:00  会话 mock-sess-12345-1  执行摘要 命令 未提供 · 退出码 未提供 · 关键输出 未提供 · 日志 未提供
```

- 行首时刻与会话号随夹具（示例 `mock-sess-12345-1` 的数字随夹具替换，见 A-0）；层名 `会话`、`执行摘要` 与 ` · ` 分隔符与 A-12 同一条模板。
- **live 取消（AC-26 实跑走的路径）**：第二进程执行 `orch cancel` 时，核心的 `activeRuns` 仍持有该 run（`finished=false`），于是走 `cancelLive`（`src/core/orchestrator.js:3746-3747`），再以 `ctx` 调 `applyCancel(handle.instanceId, loaded.state, emit, ctx, handle)`（`:3801`）；不是 `:3762` 的无 `ctx` 分支。`ctx` 摘要缓存里只有 `tool_call.title`（mock 实测 `write`），它是工具名、不是命令；`applyCancel` 还会在落盘前把 `session.toolName` 置空（`:3843`）。因此四项一律 `未提供`，这就是 AC-26 的唯一判据；不猜值、不省略（与 A-4 / A-12 同一条降级规则）。
- **非 live 取消（`:3762` 分支）本迭代保留，但 AC-26 不覆盖它**：该分支同样没有 `ctx`、没有待写摘要缓存，四项一律 `未提供`；不得因为本 AC 走 live 分支就把 A-14 的判据改成“可能部分有值”。无论取消时会话是否已上报工具事件，AC-26 的四项全 `未提供` 判据不变。
- 同进程 live 取消若 `ctx` 摘要缓存已有四项取值，可按缓存渲染实际值；AC-26 的 mock 夹具只上报 `tool_call.title`，没有四项中的任何一项，因此仍按上一条的全 `未提供` 判据。
- 取消摘要仍是 `execution.summary` 这一种会话级记录，不新增第二类逐条会话审计；它只出现在 `orch instance log` 里，追踪不新增“取消摘要”前缀（`失败摘要` 前缀仍只属 A-4）。

---

## 附录 B · 术语与未决问题

### B-1 术语

- **事件日志**：核心在每次编排动作后追加的审计记录；本迭代起每条带前一条记录的指纹，形成链。
- **链路指纹**：对一条完整事件记录做规范化序列化后计算的 SHA-256；下一条记录用它作为“前一条指纹”。
- **执行日志摘要**：会话完成或失败时附加到事件日志的四项摘要——命令、退出码、关键输出行数、日志文件引用；不是完整日志。
- **追踪跨度**：节点一轮从开始到结束的时间段，含开始、结束、结果、关联交接包。
- **跨度字段与实例字段**：跨度（`traces.jsonl`）里的开始/结束时刻叫 `start_time` / `end_time`，沿用基线 832 行与 507 行的原始命名，也是 `orch trace show` 读取的字段名；实例快照里同一个节点的这两个时刻叫 `startedAt` / `endedAt`。两者是**同一时刻在两层数据里的字段名**，不是两种语义：健康度判“节点超时”读实例快照的 `startedAt`，`orch trace show` 与追踪基线读跨度的 `start_time`；全文不出现第三种写法。
- **回流链**：跨角色、按轮次展开的交接因果；用于回答“谁驳回、谁返工、结果又交给谁”。
- **健康度**：核心按固定规则算出的实例结论，四档为需关注、慢、正常、已结束。

### B-2 口径问题一：🟡 的“节点运行时长超过 P90”

**正面回答**：

- **样本来源**：同一实例内**已结束的节点轮次跨度**。同一节点多轮各计一条；状态为已完成、失败、已升级、已取消的跨度都计入；当前仍在运行的节点不计入样本。
- **P90 定义**：把样本时长按升序排列，取第 ⌈0.9 × N⌉ 条（1-based，最近秩法）作为 P90。
- **最小样本**：N < 5 时不触发“慢”，避免首个节点被自己或极少数样本误判。
- **触发条件**：任一正在运行的节点，其当前运行时长严格大于 P90。
- **用户可判定**：`orch instance status` 显示 `健康度 慢 · 节点 T-002 执行超过本实例 P90`；`orch trace show` 的时间线给出每条跨度的起止时刻，用户可自行复算。
- **基线缺口**：基线只写“超过 P90”，未给数值与样本范围；上述定义是本需求对口径的补全。**不阻塞开工**，但需评审确认；若评审改数值或最小样本数，只影响阈值常量，不影响功能结构。

### B-3 口径问题二：🟡 的“连接线 `pending` 超过 TTL 50%”

**正面回答**：

- **既有来源**：交接包记录已有 `pendingAt`（进入待投递的时刻）与 `expiredAt`（过期时刻）字段；但**没有 TTL 数值字段**，基线也未给数值。
- **TTL 取值**：本需求采用默认 TTL **30 分钟**，只用于健康度判定与展示，不写入交接包、不改变状态机。
- **起算点**：优先 `pendingAt`；缺失时退回 `createdAt`；两者都缺失时不参与判定，不报错。
- **50% 判定**：当前时刻减去起算点**严格大于** 15 分钟（即 > 900000ms，900001ms 起命中）才判“慢”；恰好 900000ms**不**命中；不足 15 分钟的当然不命中。
- **用词统一**：基线 537 行的原文是“超过 TTL 50%”，因此本需求全文（§2.5、BR-12、BR-20、AC-15、本条）一律用“超过”，不使用“达到”。**等值边界的构造层级**：恰好 15:00 不命中、15:00+1ms 命中，这一对值由单元级 `computeHealth({ state, now })` 注入固定 `now` 断言（真实时钟读取时 δ>0 会把“恰好”推成“超过”，CLI 级不可构造）；AC-15 的 CLI 夹具因此用 14:55（不命中）/ 15:05（命中）的安全余量，不再使用 15:01 / 14:59。
- **用户可判定**：`orch instance status` 显示 `健康度 慢 · 交接包 HO-006 待投递超过 TTL 一半`。
- **边界**：本迭代不实现 `pending → expired` 自动过期，也不生成过期升级；自动过期与升级留待后续。**不阻塞开工**，但 TTL 数值属口径补全，需评审确认。

### B-4 🔴 条件依赖的既有字段与缺口

| 红条件 | 依赖的既有状态 | 本迭代前是否存在 | 本迭代的处理 |
|---|---|---|---|
| 有待处理升级 | `escalations[].state === 'pending'` | 存在 | 直接读取 |
| 节点超时 | `nodes[].state === 'running'`、`nodes[].startedAt`、实例快照 `health.nodeTimeoutMs`（毫秒，缺省 30000） | 状态与时间存在；运行期图不带 `timeout`；本迭代新增实例级阈值 `state.health.nodeTimeoutMs` 作为判定来源 | 健康度只读计算（`computeHealth({ state, now })`，`now` 可注入），不改节点状态、不生成失败；**不声称注入或读取工作流定义层** |
| 会话崩溃 | `sessions[].quarantined === true`，且该会话绑定的节点为 `failed` / `escalated` | `quarantined` 与节点状态存在；“崩溃”没有独立字段或状态 | 以“会话被隔离且其节点未成功”近似，原因文案按“崩溃”展示；被隔离会话**不再**重复计入“角色不可用” |
| 角色不可用 | `state.sessions` 中某角色绑定会话的 `state === 'escalated'`（角色由 `state.nodes[].roleId` 取得） | 会话状态存在，角色实例投影可由状态直接派生；核心无角色资产注册表 | **直接由状态投影，不调用 `buildRoleInstances`、不读注册表**（避免 `unknown-role` 把全部角色误判为不可用）；角色资产缺失由 `orch role list` 报告，不并入健康度 |
| 连接线被拒绝或已过期 | `handoffs[].state` 为 `rejected` / `expired` | 存在；连接线聚合是派生视图，不单独持久化 | 直接读取交接包状态，等价于聚合优先级 |

**本迭代之前完全不存在、由本迭代新增**：`health` 字段、`health.nodeTimeoutMs` 实例级阈值、`traces.jsonl`、追踪号、`prev_event_hash`、TTL 数值、节点超时判定口径、会话崩溃判定口径、角色不可用判定口径（只计升级会话，隔离会话归“崩溃”）。

### B-5 未决问题

- **U-1（不阻塞）**：P90 的最小样本数取 5 是本需求补全的口径；评审若要求改为其他值，只改常量。
- **U-2（不阻塞）**：真实宿主可能不提供退出码、关键输出行数或日志引用；本迭代按“未提供”降级，不阻塞。真实宿主格式补齐留待后续真机迭代。
- **U-3（不阻塞，需评审确认）**：终态集合取“已完成、失败、已取消、已中断”四种，进入后健康度统一为“已结束”。基线原文是“实例完成或终止”，本需求把失败与中断也视作已结束，避免已结束实例长期显示“需关注”；若评审要求失败仍显示“需关注”，需调整 BR-13。
- **U-4（基线偏差，不阻塞，需评审/主控确认豁免）**：基线 541 行要求健康度“影响路由决策”。当前核心没有基于健康度的路由分支，I1.9 规划（830–836 行）也未含该子项；本迭代只保证健康度可被读取，不新增调度/路由行为。此处按“能力延后”登记：路由接入留待后续治理迭代，需在评审时确认豁免，而不是仅写“留待后续”。
- **U-5（不阻塞）**：追踪数据只追加，不清理、不轮转；保留期策略留待后续。
- **U-6（不阻塞）**：`orch trace show` 本次只提供文本输出；JSON 输出与 OpenTelemetry 导出留待后续或 I1.12。
- **U-7（基线偏差，不阻塞，需评审/主控确认豁免）**：基线 564 行规定“会话状态变更：进执行日志摘要，不进主审计”。升级前的实现（`main@70277df`）已在 `src/core/orchestrator.js` 写有 12 处逐条会话状态事件，与基线口径不符。本迭代的执行口径是一句话：**既有 12 处（保留 4 / 冻结 7 / 复用 1，逐处见 D-7）仍在发射、行为不变、不新增同类发射点；除此之外，本次只新增“执行摘要”这一条会话级记录**（完成 / 失败 / 取消各一条，每会话一条，见 BR-04、AC-26、AC-27），不新增第二类逐条会话审计。已落盘的历史事件不可改写（append-only），逐条事件的移除属基线 898 行“审计粒度规则落地”，由 I1.12 承接。回归口径见 AC-24（既有 12 处仍在发射、不新增同类发射点、会话级新增记录只有摘要）与 AC-03 / AC-19（三条主链、`instance status` / `graph` 输出不变）。
- **U-8（不阻塞）**：当前夹具表没有“两次以上回流”的场景：`backflow-once` 只回流 1 次，`backflow-twice` / `retest-fail` 映射到 `rounds-exceeded`（1 次回流 + 升级）。AC-07 因此只断言“一次回流下的同节点两轮不合并、不覆盖”，并断言回流链恰 1 条；两次以上回流的合并不覆盖由 BR-07 约束，夹具扩展留待后续，本迭代不声称已用夹具覆盖两次回流。
- **U-9（既有布局偏差，不阻塞）**：基线 §5.2（`docs/index.md` 613 行）把事件日志画在 `.orch/events.jsonl`，当前实现与 `main@70277df` 一致，落在 `.orch/instances/<id>/events.jsonl`（`src/persistence/paths.js:51-53` 的 `eventsPath`）。这是**本迭代之前就存在的布局偏差**，与 I1.9 的功能无关；本迭代**沿用实现布局、不改基线、不迁移文件**，避免回归。若后续要让实现与基线一致，应作为独立的布局迁移迭代处理。

---

## 附录 C · 变更记录

- v1（2026-11-10）：首次产出。依据 `docs/index.md` 第一部分 §3.1~§3.4、§4 能力域 5（§5.5 / §5.8）、§4 能力域 6、§5.2、§6 与第二部分 `#### I1.9`（828–836 行）撰写；8 节齐全，BR-01~21、AC-01~20 连续编号；附录 A~D 按本项目 A~D 口径。状态：评审中，待独立评审。
- v2 / F-01 / §1.3 范围内新增“会话留痕的审计粒度”条、§1.3 范围外新增“既有逐条会话事件清退”条、§2.4 第 1 步改写、§2.6 新增 BR-23、附录 B 新增 U-7、附录 D-4 重写、附录 D-7 补 12 处会话发射点处置、新增 AC-24 回归口径。
- v2 / F-02 / AC-16 Then 与附录 A-8 统一为“文本视图中文原因 = 用户可见判据、JSON `reason`/`detail.reasons` = 机读层”，A-8 增两层分工表并改文本基行为 `原因 有待处理升级`。
- v2 / F-03 / §2.2.1 异常情况扩写为三条用户可见分支、§2.6 新增 BR-22、§3.1 新增 AC-21（旧记录无标记 / 末行截断 / 不阻断启动）。
- v2 / F-04 / §2.3.1 补“跨度 N 只统计已落地跨度”、附录 A 新增 A-10 进行中基线、§3.1 新增 AC-22。
- v2 / F-05 / §2.5 异常情况补“降级不静默、跳过行数可见”、§2.6 新增 BR-24、附录 A 新增 A-11、§3.1 新增 AC-23。
- v2 / F-06 / 附录 D-4 改为“核心在接收宿主工具事件处提取四项”、附录 D-7 授权 `src/core/orchestrator.js:1183-1230`（`handleUpdate` 的 `tool_call` / `tool_call_update` 分支）。
- v2 / F-07 / 附录 C 的 v1 行更正为 BR-01~21（原写 22），并在 v2 行说明。
- v2 / F-08 / BR-20、§2.5、B-3、AC-15 统一为“超过（严格大于）15 分钟”；AC-15 夹具改为 15:01 命中 / 15:00 与 14:59 不命中。
- v2 / F-09 / AC-08 Then 与机检改为与附录 A-3 一致的 3 条跨度与“跨度 3 条 · 回流 1 次”；§1.2 第 3 条同步。
- v2 / F-10 / §3.1 前言与附录 D-10 注明 AC 标题沿用 I1.7 的 `**AC-xx ·` 形态，机械扫描用 `^\*\*AC-`。
- v2 / F-11 / AC-13 补“注入含 `timeout` 的工作流定义 + `start_time` 置为 31 秒前”，机检给出 `now − start_time > timeout` 判定式；§3.3 时间型条件同步。
- v2 / F-12 / §1.3 范围外该条与 B-5 U-4 改登记为“基线偏差（基线 541 行），需评审/主控确认豁免”。
- v2 / F-13 / §2.3.1 预期效果补“追踪记录随实例状态存放在实例目录 `state/` 下、不散落在实例根目录”。
- v2 / F-14 / §2.4 第 1、2、5、6 步改为体验叙述，判定规则留在 §2.5 / §2.6（BR-11 ~ BR-15）。
- v2 / F-15 / §2.2.1“指纹字段”改“指纹标记”；AC-04 的 `instance log --format json` 断言下沉到机检、Then 改用户视角；AC-06 的 `traces.jsonl` 路径断言下沉到机检。
- v2 / F-16 / §3.3 新增“并发与轮询”段（第二进程查看、文件监听替 `sleep`），失败摘要夹具补独立缺项变体开关。
- v2 / F-17 / AC-16 机检补“同一档位连续两次 `instance status` 后 `events.jsonl` 条数不变”。
- v2 / 未改判据的核对 / 全文 AC 由 20 条增至 24 条（只增不减）、BR 由 21 条增至 24 条；头部版本与本行版本一致为 v2。
- v3 / F-01 / 附录 A-2 与 A-10 末尾补「回流链」「无」两行基线，并注明 A-2 与 A-3 构成「无回流 / 有回流」完整分支覆盖；AC-09 Then 改为逐字引用 A-1 / A-2 / A-5；AC-22 Then 补「回流链」「无」两行，并写明放行后该段仍为「无」。
- v3 / F-02 / §1.3 范围外「清退」条改写为「12 处发射点仍在发射、本迭代不新增不删除」；§2.4 第 1 步括注同步改写；BR-23 末补同义句；U-7 补「仍在发射」。
- v3 / F-03 / §2.2.1 异常情况第 3 条补齐「序号从 1、旧文件一行不动、提示跳过行数、成功退出码」；新增 BR-25；附录 D-1 补整份不可解析口径；新增 AC-25（含夹具与机检）。
- v3 / F-04 / 附录 D-7 改写 `handleUpdate` 段（`tool_call_update` 分支在 `src/adapter/session-state.js:153`、不在 `1183-1230`）；摘要写入点统一为 `quiesceSession` / `idleSession` / `applyCancel` 三处并点名 `:2222`；节点收尾段取消「附加摘要」授权；附录 D-4 同步。
- v3 / F-05 / AC-13 机检与夹具两处 `start_time` 改为 `startedAt`；附录 B-1 新增「跨度字段与实例字段」条，说明 `start_time`/`end_time` 与 `startedAt`/`endedAt` 的对应关系。
- v3 / F-06 / BR-04 扩为「节点完成或失败时」；§2.2.2 预期效果与异常情况补「成功节点同样有摘要、追踪不强制展示」。
- v3 / F-07 / B-5 的 U-4、U-7 标题补「不阻塞」；§1.3 对应两条范围外条目补「不阻塞开工」。
- v3 / F-08 / 附录 A 新增 A-12（`instance log` 摘要行）与 A-13（`已跳过 N 行不可读记录`）；A-9 补 `SUMMARY_LOG_LINE` / `EVENTS_SKIPPED`；AC-04、AC-21、AC-24 的 Then 指向对应基线；D-5 补两处新文案落点。
- v3 / 未改判据的核对 / 全文 AC 由 24 条增至 25 条（只增不减）、BR 由 24 条增至 25 条；头部版本与本行版本一致为 v3；附录 D-10 计数同步为 25 / 25。
- v4 / F-01 / 附录 A-6 下新增“A-6 附：原因句逐字基线”（五类红 + 连接线已过期 + P90 + TTL 共 8 行逐字句、占位符替换规则、多原因并列顺序）；§2.5 的“需关注”示例补“已过期”并指向该附；AC-13 / AC-14 / AC-15 的 Then 改为逐字引用该附，AC-13 / AC-15 机检补逐字断言。
- v4 / F-02 / BR-04 与 §2.2.2 的计数单位由“节点”改为“会话”（一条会话一条摘要、同一节点多轮回流每轮各一条）；§2.4 第 2 步同步；附录 A-12 补“行数对一条会话”与“行数判据”两段；新增 AC-27 覆盖多轮回流条数。
- v4 / F-03 / 取消纳入会话收尾口径：BR-04、§2.2.2、§1.3、§2.4、D-4 一致为“完成 / 失败 / 取消”，D-4 补非 live 取消的缺缓存规则；附录 A-14 新增取消摘要基线（A-9、D-5 同步，A-12 相关表述对齐）；新增 AC-26 覆盖取消摘要与终态。
- v4 / F-04 / AC-04、AC-16、AC-21 的 When 与夹具补齐 Then 所需的命令（`instance log` 文本视图与 `--format json` 两条都跑）；AC-11、AC-12 的 When 补“打开 `status.md`”（其 Then 已断言该文件）。
- v4 / F-05 / 附录 D-7 的摘要调用点改为“以函数名为准、调用点仅示例”，补列 `:2666` / `:2775` 并注明 `:2807`；授权段统一为 `:2120-2230` / `:2530-2575` / `:2660-2810` / `:3240-3250`，点名“只改摘要出口调用，不改状态迁移”；节点收尾段的段号与之一致。
- v4 / F-06 / BR-01 补“可读序号”限定，与 BR-25 的“不可读行不贡献序号”口径一致。
- v4 / F-07 / U-7 括注改为“既有 12 处（保留 4 / 冻结 7 / 复用 1）仍在发射、不新增同类发射点；除此之外本次只新增‘执行摘要’这一条会话级记录”，与 D-7 逐处裁决一致。
- v4 / 未改判据的核对 / 全文 AC 由 25 条增至 27 条（只增不减、编号连续）、BR 仍为 25 条；头部版本与本行版本一致为 v4；附录 D-10 计数同步为 27 / 25。
- v5 / F-01 / AC-27 的节点号由叙述示例 `T-003` 改为真实模板节点 `T-001`（`src/templates/index.js:195-210`），`detail.nodeId` 断言同步；Given/机检/夹具改为 `--scenario backflow-once --stop-after 3` 冻结点，使 `T-001` 恰有两轮、`T-002` 恰有一轮；A-2 / A-3 / A-4 / A-10 的节点号同步为 `T-001` / `T-002`。
- v5 / F-02 / AC-08 的停点改为核心侧 `--stop-after 3`（`MAESTRO_TEST_STOP_AFTER=3`，`orchestrator.js:354` / `:4164-4183` / `:3141`），冻结在“开发第 2 轮完成、复测未派发”，跨度 3 条且无进行中行；§3.3 补“两轮回流场景注入”“中间态冻结”两段并说明不采用 `retest-hold`；AC-07 明写完整回流为 4 条跨度；A-3 注明本基线对应冻结窗口。
- v5 / F-03 / 附录 A 新增 A-0“可变值约定”（时刻 / 追踪号 / 节点号 / 会话号 / 交接包编号 / 摘要取值 / P90 / TTL 随夹具，其余文字与分隔符逐字固定），A-1~A-14 全部适用；A-3 / A-4 节点号改 `T-001` / `T-002`，A-6 / A-6 附 / A-12 / A-14 的会话号改 mock 实际形态 `mock-sess-12345-1`，A-12 / A-14 的日志引用改 `host-logs/T-001.log`；A-2 / A-4 / A-10 的交接位按 `single` 实际创建的 `HO-001` 修正（`orchestrator.js:3407`），A-3 按空实例实际 `HO-001` / `HO-002` 修正。
- v5 / F-04 / AC-13 由 5 个夹具扩为 6 个：连接线被拒绝与已过期各用一个独立夹具、各自只放一条连接线；Then / 机检 / 夹具统一为“六条健康度行”。
- v5 / F-05 / AC-26 机检的“没有第二类会话级事件”改为“除 `execution.summary` 与既有 12 处冻结的会话级事件外，没有新增的第二类会话级事件”。
- v5 / F-06 / D-4 补 `command` 的持久化来源：会话快照无 `command` 字段，`session.toolName` 是 `tool_call.title`（mock 为 `write`），不得冒充命令；非 live 取消四项一律 `未提供`。AC-26 改用 `--turn-delay-ms 30000` 构造运行中会话，Then / 机检 / 夹具同步为四项全 `未提供`；A-14 改为该唯一判据。
- v5 / F-07 / 附录 D-7 的授权段 `:2120-2210` 改为 `:2120-2230`（含 `:2222` 的 `fail()` 收尾），节点收尾段同步。
- v5 / F-08 / AC-14 补 When 的三次 `instance status` 与夹具的两步改写（运行中节点改 50s、样本删到 4 条），使 Then 的三个变体各自可构造。
- v5 / F-09 / A-6 附的引用范围收窄：AC-13 / AC-14 / AC-15 逐字引用本组；AC-16 / AC-17 只引用 `instance status` 健康度行，日志行另见 A-8、`status.md` 行另见 A-7。
- v5 / 未改判据的核对 / 全文 AC 仍为 27 条（AC-01~AC-27 连续、只增不减）、BR 仍为 25 条；头部版本与本行版本一致为 v5；附录 D-10 计数同步为 27 / 25。
- v6 / F-01 / 删掉 A-0 “`single` 的 `T-001 开发` 是既有标签”的错误断言；A-2 / A-4 / A-10 的 `single` 示例改为实测可达的 `T-001`（无角色），AC-22 的 Then 同步；A-0 补节点列规则（`title ?? nodeId`，不输出 `roleId`），D-5 同步。实测：`single` 的 `instance status` 为 `节点 已完成 · 耗时 2s`，`state.json` 节点只有 `nodeId: T-001` / `roleId: worker`，`ROLE_LABEL` 无 `worker`。
- v6 / F-02 / A-3 的回流链行改为 `第 2 轮  T-002 测试 → T-001 开发  HO-002  已完成`；§2.3.2 定义“轮次取回流交接包的 `round`”；AC-08 的“第 1 轮”改“第 2 轮”、补“状态 `已完成`（`consumed`）”。实测冻结窗口 `HO-002` = `consumed`、`round = 2`。
- v6 / F-03 / “节点超时”改用实例级阈值 `state.health.nodeTimeoutMs`（缺省 30000 毫秒），D-3 / B-4 声明为本迭代交付项；AC-13 的夹具改为直接写 `state.json`（`nodes[0].state='running'`、`startedAt=now-31s`、`health.nodeTimeoutMs=30000`），不再声称“注入含 `timeout` 的工作流定义”；§2.5 / §3.3 同步。
- v6 / F-04 / AC-07 改为“一次回流下的同节点两轮”：Then 断言 `T-001` / `T-002` 各两轮共 4 条跨度、回流链恰 1 条（`HO-002`，`round=2`，`已完成`），复测 `HO-003` 不计入回流；§3.3 与 U-8 明写 `backflow-twice` 别名是“1 次回流 + 升级”，不是两次回流。实测完整场景 `handoffs=3`、`sessions=4`、`state=completed`。
- v6 / F-05 / AC-26 改述为 **live 取消**：第二进程 `orch cancel` 命中 `activeRuns` → `cancelLive`（`orchestrator.js:3746-3747`）→ `applyCancel(..., ctx, handle)`（`:3801`），不是 `:3762` 的无 `ctx` 分支；A-14 / D-4 同步，并写明 `applyCancel` 会把 `session.toolName` 置空（`:3843`）。实测取消后 `state=cancelled`、会话 `idle` / `toolName=null` / `quarantined=true`、交接包 `rejected`。
- v6 / F-06 / 删除“测试时钟接缝”：§3.3 / A-0 / AC-13 / AC-14 / AC-15 改为夹具按真实时刻回填 `startedAt` / `pendingAt`（`now-31s` / `now-60s` / `now-15m01s`），读取时用真实 `Date.now()`，不拨钟、不 `sleep`。
- v6 / F-07 / AC-08 / AC-27 的 `--keep` driver 改为第二进程/后台启动 + 轮询 `.mock/stopped-after-3` + 断言后写 `.mock/release` 并 `kill -INT`；§3.3 “中间态冻结”“并发与轮询”同步。
- v6 / F-08 / D-2 补跨度写入时机与 `handoff_ids` 来源：交接包创建/接收之后、下一次派发之前写跨度；冻结窗口 3 条跨度的 `handoff_ids` 依次为 `[HO-001]`、`[HO-001, HO-002]`、`[HO-002]`。
- v6 / F-09 / AC-27 的“与 AC-04 的单轮口径一致”改为“与 AC-04 的‘一条会话一条摘要’口径一致（AC-04 是 `single` 单节点示例，不是本夹具的 `T-002`）”。
- v6 / F-10 / D-7 的 `paths.js:47-53` 改为按 `corruptPath`（`:55-58`）之后、`instanceWorkspaceDir`（`:60-66`）之前定位；`statePath` / `eventsPath` 在 `:47-53` 不改。
- v6 / 附加可构造性 / 所有 `orch run` 夹具补 `--cwd .`（`run` 缺 `--cwd` 会打印用法并以参数错误退出，实测）；AC-26 的轮询条件改为 `events.jsonl` 中 `to: 'tool_running'` 的事件；AC-09 的空追踪夹具改为直接写 `state: 'created'` 快照；失败夹具的两个开关名钉死为 `--fail-tool` / `--fail-tool-no-refs`；§3.3 命令口径与 D-4 同步。
- v6 / 未改判据的核对 / 全文 AC 仍为 27 条（AC-01~AC-27 连续、只增不减）、BR 仍为 25 条；头部版本与本行版本一致为 v6；附录 D-10 计数同步为 27 / 25；新增 U-8（两次以上回流无夹具，不阻塞）；§3.3 回归基线补第五轮实测 `1029 / 1019 / 9 / 1` 与 flaky 说明，不改变“失败集合差集为 0”的收口口径。
- v7 / F-01 / 阻断修复：AC-14 改为三个独立实例（70s vs P90 50s → 慢；30s → 正常；4 条样本 + 70s → 正常），三个快照都显式写 `health.nodeTimeoutMs = 300000`，不会先命中 30s 红档；50s 等值边界移入 `computeHealth({ state, now })` 单元级（恰好 50000ms 不判慢、50001ms 判慢）。D-3 写明 `now` 为可注入参数、`computeHealth` 为纯函数；B-4 节点超时行同步。
- v7 / F-02 / 阻断修复：AC-15 改为三个实例、每个只放一条 `pending` 包（14:55 不命中 / 15:05 命中单行 / 无起算时间不命中），消除 δ 漂移与多原因并列；15:00 等值边界移入单元级（恰好 900000ms 不命中、900001ms 命中、899999ms 不命中）。§3.3 时间型条件与健康度矩阵夹具同步。
- v7 / F-03 / D-2 重写：跨度在**节点收尾时**写入（早于 `maybeStopAfter` `orchestrator.js:3141` 与 `advance()` `:3157`），因此 `--stop-after 3` 冻结窗口有 3 条跨度；`handoff_ids` 改为**读取时**由 `fromNodeId` / `toNodeId` 与 `round` 推导（接收包 `round === 本轮`；产出包正向 `round === 本轮`、回流 `round === 本轮 + 1`），删除“按 `round` 等于本轮过滤”这一会漏 `HO-002` 的规则；字段名统一为 `fromNodeId` / `toNodeId`，并说明读取时推导才能让 T-002 r1 拿到 `advance()` 之后创建的 `HO-002`。
- v7 / F-04 / D-7 补授权：`statusCommand`（`main.js:999-1070`，约 `:1062-1065`）只插入一行健康度；`instance log` 分支（`:1191-1211`）只对 `execution.summary` / `health.changed` 分派并在末尾追加跳过行；`render.js` 授权五个新纯函数与 `renderEventLines` 开头的一个 reason 分派分支，其他行顺序与文案不变。D-5 的函数清单同步为五个。
- v7 / F-05 / A-0 改述：节点列规则只适用于 `orch trace show`；`single` 的 `status.md` 不输出 `## 节点` 段（`status-text.js:310-320` 仅 `multi` 输出），因此不存在“只显示 T-001 的节点列”；A-0 可变值表的节点行同步。
- v7 / F-06 / AC-14 删除“50s（P90 以下）”的错误用词：CLI 级改用 30s（明显低于 50s）与 70s（明显高于 50s），等值边界改由单元级断言。
- v7 / F-07 / AC-11 改为直接快照（`state: running`、`T-001 done / T-002 pending`、无 `running` 节点、显式 `health.nodeTimeoutMs = 300000`），不再用 `--hold-session` 与 30s 阈值赛跑；AC-16 改为快照前后两次读取，同样不受查看时长影响；§3.3 健康度矩阵同步。
- v7 / F-08 / AC-17 / AC-18 钉死 `test/fixtures/task-loop-driver.mjs --root <夹具根> --scenario dispatch-fail-first`（场景文件 `scenarios/task-loop/dispatch-fail-first.json`）；实测终态 `suspended`、`sessions: []`、仅一条 `dispatch_failed` 升级，因此健康度只有“有待处理升级”一条原因；写明该场景 `orch run` 退出码非 `0` 属预期。AC-16 不使用该场景（真实升级会并列崩溃/角色原因），改由快照构造单调变化。
- v7 / F-09 / B-5 新增 U-9：事件日志实现落在 `instances/<id>/events.jsonl`（`paths.js:51-53`），与基线 §5.2 的 `.orch/events.jsonl` 不同，登记为既有布局偏差、不阻塞；本迭代不改布局、不迁移。
- v7 / F-10 / D-3 点明角色来源：`computeHealth` 不接收 `roles`、不调用需要注册表的 `buildRoleInstances`（核心无注册表，空表会把全部角色判成 `unavailable`），改由 `state.nodes[].roleId` + `state.sessions` 投影（`escalated` → 角色不可用；`quarantined` 只计会话崩溃）；B-4 角色行与 AC-13 角色夹具同步。
- v7 / 未改判据的核对 / 全文 AC 仍为 27 条（AC-01~AC-27 连续、只增不减）、BR 仍为 25 条、U 由 8 条增至 9 条（U-9 不阻塞）；头部版本与本行版本一致为 v7；附录 D-10 计数同步为 27 / 25。

---

## 附录 D · 实现约束（技术要点，仅供编码参考，不进入需求判定）

> 本附录是需求对实现的约束摘要，写代码的 Agent 据此落地；评审对需求的判定不依赖本附录。

### D-1 事件链的字段与算法边界

- **新增字段只有一个**：每条事件记录增加 `prev_event_hash`，取值为 64 位小写十六进制；第一条使用 64 个 `0` 作为固定起点。
- **算法**：对“前一条完整记录”做规范化 JSON 序列化（递归按键名排序、UTF-8、无多余空白），再计算 SHA-256。不得对原始行字节直接哈希，避免字段顺序变化导致断链。
- **同一次尾读**：序号与上一条指纹必须来自**同一次文件尾读取**，禁止先取序号再取指纹两次读；新增 store 侧尾读方法，单实例仍在事件总线的串行队列内执行。
- **旧记录兼容**：历史记录没有指纹字段时保持原字节不动；新记录以最近一条可解析记录的规范化哈希作为前一条指纹；末行被截断时继续向前找，与既有 `nextSeq` 的容错口径一致。整份不可解析（无任何可解析行）时按固定起点起链、序号从 1 起算，原文件不删、不改写、不改名，口径与 BR-25 一致。
- **边界**：只做链，不做校验命令、不做篡改报告、不做签名；这些属 I1.12。

### D-2 `traces.jsonl` 的落盘位置与追加语义

- **路径**：`instances/<id>/state/traces.jsonl`。新增 `instanceStateDir(root, id)` 与 `instanceTracesPath(root, id)` 两个路径工厂；`state.json` 与 `events.jsonl` 仍在原位，不迁移，避免回归。
- **追加语义**：节点每轮结束时追加一行，整行一次追加，不重写、不批量缓冲；未结束的节点不写跨度，由 `orch trace show` 从当前实例状态叠加显示为“进行中”。
- **写入时机：节点本轮收尾（finish）时写跨度，早于停点与 `advance()`**。核心在节点收尾段追加该轮跨度（`start_time` / `end_time` / `status` / `round`），然后驱动循环才调用 `maybeStopAfter`（`orchestrator.js:3141`）、再调 `advance()`（`:3157`）。因此 `--stop-after 3` 冻结时，T-001 第 2 轮的跨度**已经写好**，冻结窗口内恰有 3 条已完成跨度（T-001 r1、T-002 r1、T-001 r2），与 A-3 / AC-08 一致；“先 `advance()` 再写跨度”的实现会在冻结窗口只剩 2 条，**不得采用**。
- **`handoff_ids` 在读取时推导，不落盘为冻结值**。交接包的 `round` 是**接收节点**的轮次（`buildHandoff` 的 `round` 字段，见 `advance.js:177-179` 的 `round` / `fromNodeId` / `toNodeId`）。对跨度 `(node, round r)`，`orch trace show` 按下列两条规则从 `state.handoffs` 现场取编号，按 `createdAt` 升序、去重后渲染：
  - **接收包**：`toNodeId === node && round === r`（本轮被唤醒时接收的包）；
  - **产出包**：`fromNodeId === node`，且正向包 `round === r`、回流包 `round === r + 1`（回流包的接收轮次比产出轮次大 1）。
  **不得只按“`round` 等于本轮”过滤**：冻结窗口的 `HO-002` 是 T-002 第 1 轮产出、`round = 2`（接收方 T-001 的第 2 轮），按 `round === 1` 会把它从 T-002 r1 的跨度里漏掉，而 A-3 要求 T-002 r1 的交接为 `HO-001 HO-002`。按上述规则，冻结窗口 3 条跨度的 `handoff_ids` 依次为 `[HO-001]`、`[HO-001, HO-002]`、`[HO-002]`。
  **为什么必须读取时推导**：`HO-002` 由 `advance()` 在 T-002 收尾之后创建，晚于 T-002 r1 跨度的 `end_time`；若写入时把 `handoff_ids` 冻结，T-002 r1 的跨度就永远少一个 `HO-002`。读取时推导使“跨度只记本轮起止与结果、交接归属按当前快照计算”，与停点位置无关。字段名统一用交接包真实的 `fromNodeId` / `toNodeId`（或 `edge.from` / `edge.to`）；交接包顶层没有 `from` / `to`。
- **跨度字段**：`traces.jsonl` 每行落 `trace_id`、`instance_id`、`node_id`、`round`、`start_time`、`end_time`、`status`；`handoff_ids` 是 `orch trace show` 的**呈现字段**，按上一条规则在读取时推导（不落盘为冻结值，避免冻结窗口少 `HO-002`）。`status` 使用节点状态的英文原值。
- **追踪号**：实例创建时生成一次，形如 `TRC-` 加 8 位小写十六进制；同一实例保持不变，不同实例不同。
- **读取**：追踪读取只读，单行损坏跳过并计数；不因一行损坏让整份追踪不可读。跳过的行数交给 `orch trace show` 渲染为 A-11 的提示行（不可静默）。
- **计数口径**：`orch trace show` 汇总行的“跨度 N 条”只统计已落地的跨度；进行中的节点在时间线末尾叠加一行（A-10），不计入 N。

### D-3 健康度写入哪个既有元数据位置

- **模块**：新增 `src/core/health.js`，对外提供**纯函数** `computeHealth({ state, graph, traces, now })`，返回 `{ level, reasons }`；不读盘、不取系统时间。**`now` 是可注入的毫秒时间戳（缺省 `Date.now()`）**，单测注入固定 `now` 覆盖“恰好等于阈值”的等值边界（节点超时 30000ms、P90 50000ms、TTL 900000ms），CLI 级只用安全余量。**角色不可用的来源**：本函数不接收角色注册表、也不调用 `buildRoleInstances`（`src/registry/role-instances.js:123` 的投影需要注册表才能区分 `unknown-role`；核心侧没有注册表，传空表会把所有角色判成 `unavailable`）。改为直接由 `state.nodes[].roleId` + `state.sessions` 投影：某角色只要有一条绑定会话 `state === 'escalated'` 即判“角色不可用”；`quarantined` 会话只计“会话崩溃”（见 B-4），不重复计入角色不可用；角色资产缺失（`unknown-role`）不在健康度内报，由 `orch role list` 负责。
- **位置**：实例快照 `state.json` 的顶层 `health` 字段，形如 `{ level, reasons, computedAt, nodeTimeoutMs }`；`level` 取 `normal` / `slow` / `attention` / `ended`；`reasons` 为固定顺序的原因码数组。
- **节点超时阈值（本迭代交付项）**：`health.nodeTimeoutMs` 是实例级节点超时阈值（毫秒），实例创建时写入、缺省 `30000`；`computeHealth` 读取它，回写 `health` 时**保留**该字段，不得被计算结果覆盖。判定为 `nodes[].state === 'running'` 且 `now − startedAt > health.nodeTimeoutMs`（严格大于）。若未来运行期图带节点级 `timeout`（秒），按节点级优先；**本迭代运行期 `GRAPHS` 无 `timeout`，不声称读取工作流定义层**。AC-13 的超时夹具用写 `state.json` 的方式构造该字段。
- **计算时机**：每次实例快照写入前计算一次；每次用户读取实例状态（`instance.get`）时再计算一次，覆盖时间型条件（超时、P90、TTL）。读取时若 `state.health` 缺少 `level`（首次计算），补写 `health` 并刷新 `status.md`，按 BR-15 **不追加** `health.changed`；若档位变化，走一次窄 CAS 写入（与 `saveState` 同路径，`status.md` 随之刷新）并追加事件；档位未变不写。
- **终态优先**：实例状态属于 `completed` / `failed` / `cancelled` / `interrupted` 时直接返回 `ended`，不再评估红黄条件。
- **原因码固定顺序**：`pending_escalation`、`node_timeout`、`session_crash`、`role_unavailable`、`connection_rejected`、`connection_expired`、`p90_exceeded`、`handoff_ttl_half`。渲染时按此顺序拼接，命中多个则全部展示。
- **事件**：档位变化追加 `health.changed` 事件，`object` 为 `health`，`objectId` 为实例号，`from` / `to` 为档位，`detail.reasons` 为原因码数组；首次写入不算变化。
- **禁止**：不得把健康度写入 `graph.json`，不得因健康度调用状态迁移、升级生成或调度逻辑。

### D-4 事件 vs 执行日志摘要的边界

- 节点、交接包、升级、实例的状态迁移继续进事件日志；会话状态变更**不逐条**进主审计（基线 564 行），只在会话收尾时追加一条 `execution.summary` 摘要事件（完成 / 失败 / 取消三种收尾各一次，落点见 D-7；BR-04 的用户可见判据已按“完成 / 失败 / 取消、每会话一条”表述，AC-04 / AC-26 / AC-27 逐项验收，与本条一致）。升级前已存在的 12 处逐条会话状态事件按 U-7 冻结保留、不新增、**仍在发射**（新实例仍会写出逐条会话记录），清退由 I1.12 承接（处置逐条见 D-7）。
- 摘要事件形状：`object: 'session'`、`objectId: 会话号`、`result: 'note'`、`reason: 'execution.summary'`，`detail` 含 `nodeId`、`round`、`summary` 四项：`command`、`exitCode`、`keyOutputLines`、`logRef`。
- `logRef` 可以是项目根相对路径或绝对路径；核心只记录引用，不复制文件、不读取正文。缺失项存 `null`，渲染为“未提供”。
- **取消路径的缺缓存情形与 `command` 的持久化来源**：AC-26 的取消发生在 run 仍活跃时，核心先命中 `activeRuns`，走 `cancelLive`（`orchestrator.js:3746-3747`），再以 `ctx` 调 `applyCancel`（`:3801`）；`:3762` 的 `applyCancel(instanceId, state, emit, null)` 是非 live 分支，本迭代保留但 **AC-26 不覆盖它**。实例快照的会话对象由 `buildSession`（`orchestrator.js:713-727`）建立，可持久化的字段只有 `sessionId` / `nodeId` / `round` / `hostId` / `state` / `stateSince` / `createdAt` / `lastEventAt` / `toolName` / `turnId` / `artifactRef` / `pendingPermission` / `quarantined`——**没有 `command` 字段**；其中 `toolName` 来自 `tool_call.title`（mock 实测为 `write`，`mock-acp-agent.js:589`），是工具名，不是命令行；`applyCancel` 还会在落盘前把 `session.toolName` 置空（`:3843`）。因此本迭代**不把命令写入会话状态**，AC-26 的四项一律存 `null` 并渲染为“未提供”（附录 A-14 第 2 条），不因缺缓存跳过摘要、也不阻断取消，更不得用 `toolName` 冒充 `command`。同进程 live 取消若 `ctx` 摘要缓存已有四项取值，按缓存写实际值；AC-26 的 mock 只有 `tool_call.title`，没有四项，因此仍全 `未提供`。
- **提取落点在核心，不在适配器**：四项摘要由 `src/core/orchestrator.js` 的 `handleUpdate`（1183 行起）读取原始帧后缓存，会话收尾时一次性写成摘要；帧名取 `tool_call` / `tool_call_update` 两个取值，但**这两个名字的分类分支不在 `orchestrator.js` 里**——它在 `src/adapter/session-state.js:146-160`（`:153` 的 `tool_call_update` 分支），由 `handleUpdate` 经 `:1191` 的 `normalizer.reduce` 调用。适配器只做状态与工具名归一化，不承担摘要提取、也不新增摘要字段（该文件本迭代**不改**，见 D-7）。提取不到的部分按缺项处理，不阻塞会话收尾，也不影响节点状态判定。
- 夹具扩展：`test/fixtures/mock-acp-agent.js` 增加默认关闭的失败工具步骤（开关名 `--fail-tool`），能上报命令、退出码、输出行数、日志引用；再增加一个独立的缺项变体开关 `--fail-tool-no-refs`（只给命令与退出码）。既有 12 个开关与三条场景套件的既有行为逐字不变。

### D-5 CLI 命令面

- 在运行时命令表加入 `trace`，子命令只有 `show`；位置参数一个实例号，也接受 `--instance`；不新增 `--format`。
- **不得修改** `USAGE_LINES` 的 25 行基线（I1.6 逐字锁定）；`trace` 的用法通过参数错误路径提示，不进入主用法块。
- 退出码：成功（含空追踪、单节点）为 `0`；实例不存在为 `1`；参数错误为 `2`。
- 新增 `renderHealthLine`、`renderTraceShow`、`renderSummaryLogLine`、`renderHealthEventLine`、`renderEventsSkippedLine` 五个纯函数；中文全部来自 `labels.js`。`instance status` 只在实例状态行之后插入健康度行；`instance graph` 不插入任何健康度内容。`instance log` 对 `execution.summary` / `health.changed` 两种记录分别委托前两个日志行函数，并在列表末尾按需输出“已跳过 N 行不可读记录”；**其他事件的既有行格式与相对顺序不变**。
- `renderTraceShow` 的节点列按 `graphNode.title ?? nodeId` 输出：有 `title` 时 `节点号 标题`（`code-loop` 的 `T-001 开发`），无 `title` 时只输出节点号（`single` 的 `T-001`）；不输出 `roleId` 原文，`single` 的 `worker` 不得出现在 trace 或 `status.md`。轮次取跨度 / 节点的 `round`；回流链的“第 N 轮”取回流交接包的 `round`（§2.3.2）。
- `orch instance log` 的文本视图要能读懂健康度事件：`labels.js` 增加 `LAYER.health = '健康度'`、`HEALTH_LABEL` 与 `HEALTH_REASON_*`（码值 → 中文原因），`render.js` 的 `STATE_LABEL.health` 指向同一张表；文本行按 `健康度 INST-001  正常 → 需关注  原因 有待处理升级` 渲染（附录 A-8），JSON 仍保留 `health.changed` 与原因码。不要求改造既有事件行格式。
- `instance log` 另有两处新文案：执行摘要行用 `SUMMARY_LOG_LINE`（附录 A-12，四项取值与 A-4 一致、缺项渲染 `未提供`；取消收尾复用同一行模板，基线见附录 A-14），事件不可读行提示用 `EVENTS_SKIPPED`（附录 A-13，单独成行、不带时刻前缀）。

### D-6 中文、禁词与宿主边界

- 新增中文只落 `src/cli/labels.js`；`src/core/status-text.js` 只允许引用 `labels.js` 的键做镜像（沿用 `labels-sync` 测试），不得新增中文硬编码。
- `src/core` / `src/daemon` 不出现模板名、角色字面量、`if host ==` / `switch (host)` 分支；健康度原因中的角色名一律由图或状态注入，不写死。
- 31 词禁词表（供 `--forbid` 原样复制）：

```
task-loop,researcher,writer,reviewer,研究员,撰写者,审核者,code-loop,developer,tester,coordinator,arbiter,planner,summarizer,worker,data-analyst,fact-checker,editor,code-reviewer,compliance-reviewer,requirement-clarifier,research-brief,fact-check,data-analysis,doc-draft,doc-review,code-change,test-run,code-review,coordination,compliance-check
```

- 零第三方运行时依赖；不得引入任何日志、哈希、追踪库，全部用 Node 内置模块。

### D-7 授权修改清单（点名文件 + 行号 + 只改哪一段）

- `src/core/event-bus.js:90-105`：只在 `emit` 内计算并附加 `prev_event_hash`。不得改“先落盘再广播”的顺序、不得改 `instanceId` 的路由语义、不得改返回结构。
- `src/core/event-bus.js:110-122`（`replay`）：只把 `store.readEvents` 已返回的 `badLines` 一并透出（返回值改为 `{ events, badLines }` 或等价的附带字段），不改变 `readEvents` 的坏行计数口径、不改 `emit` 的落盘顺序、不改 `subscribe`。
- `src/persistence/instance-store.js:260-291` 与 `:380-399`：只新增“同一次尾读返回序号与上一条指纹”的辅助方法；`doAppend` 的整行追加语义、`nextSeq` 的容错口径、`readEvents` 的 `badLines` 计数不动。
- `src/persistence/paths.js`：只追加 `instanceStateDir` / `instanceTracesPath` 两个导出；落点在 `corruptPath`（`:55-58`）之后、`instanceWorkspaceDir`（`:60-66`）之前（当前约 `:59`），实现以函数名 `corruptPath` 定位，不按固定行号；既有函数体不动。`statePath` / `eventsPath` 在 `:47-53`，本迭代不改。
- `src/core/orchestrator.js:444-454`（`saveState`）：在保存前调用 `computeHealth({ state, graph, traces, now })` 并写回 `state.health`（保留 `nodeTimeoutMs`）；`src/core/orchestrator.js:1595-1615`（节点开始）与 `:2120-2230`、`:2530-2575`、`:2660-2810`、`:3240-3250`（节点收尾，与下一条的授权段同一口径）只追加“结束本轮跨度”的调用，**不在节点收尾段写摘要**（摘要的唯一落点见下一条），不改既有迁移、时间戳与事件顺序。
- `src/core/orchestrator.js:735`（`newState`，实例初始快照）：只追加 `health: { nodeTimeoutMs: 30000 }` 一个字段，其余初始字段与顺序不动；已存在的实例在读取时缺该字段则按缺省 30000 处理（不批量回填历史快照）。
- `src/core/orchestrator.js:4036`（`getStatus`，`instance.get` 的读取路径）：读取时按真实 `now` 重算健康度；若 `state.health` 缺 `level`（首次），补写并刷新 `status.md`、不追加事件；若档位变化，走一次窄 CAS 写入（与 `saveState` 同路径）并追加 `health.changed`；档位未变不写。只允许在返回快照前做这一步，不改 `getStatus` 的既有返回结构与只读语义（除健康度字段与上述一次受控写入）。
- `src/core/orchestrator.js:1183-1230`（`handleUpdate`）：**本迭代唯一被授权做摘要提取的段落**。只允许把命令、退出码、关键输出行数、日志引用四项读入会话级的待写摘要缓存；不得改 `pendingEvents` 里的会话状态迁移判定、不得改 `session.state` / `stateSince` 赋值、不得改 `applyHandoff` 与 `enqueue` 的时序、不得在这里新增任何 `emit`。
  - **帧名与分支归属（实测口径）**：本函数经 `:1191` 的 `normalizer.reduce` 处理 `sessionUpdate`，`tool_call` 与 `tool_call_update` 两类帧都进得来；其中 `:1221` 是 `tool_call` 分支，而 **`tool_call_update` 的分类分支不在本段**，在 `src/adapter/session-state.js:153`（该文件本迭代不改）。因此摘要提取按帧名取值读取原始帧即可，不依赖适配器的状态判定，也不得在适配器里加摘要字段。
- `src/core/orchestrator.js` 的**摘要写入点固定在三个会话收尾函数内，不新增第四个入口**：会话收尾 `quiesceSession`（`:1282` 起，含 `:1294`）、`idleSession`（`:1311` 起，含 `:1323`），以及取消路径 `applyCancel`（`:3807` 起，含 `:3846-3854` 的 `run.cancelled` 事件、`:3852` 为 `reason`；非 live 路径为 `:3762` 的 `applyCancel(instanceId, state, emit, null)`，无 `ctx`；AC-26 实际走 `:3801` 的 live 分支，两者都按 D-4 的缺缓存规则写摘要）。除这三处之外不写摘要，也不额外开事件通道；摘要每个会话只写一次，重复收尾不重复写。
  - **判定以函数名为准，调用点清单只作示例、不是白名单**：实测 `quiesceSession` 的调用点为 `:2131`、`:2167`、`:2222`（权限拒绝）、`:3247`；`idleSession` 的调用点为 `:2143`、`:2568`、`:2666`（`verification.failed`）、`:2707`、`:2775`（`verification.failed`）、`:2807`（`run.completed`）。调用点落在上述三个函数内的，一律自动获得摘要，不必回头改本清单；新增第四个函数则不允许。
  - **授权范围（按行段定位，段内只改摘要出口调用）**：`:2120-2230`（含 `:2131` / `:2143` / `:2167` / `:2222`；`:2222` 是 `fail()` 收尾处的 `quiesceSession`，权限拒绝时为 `permission.denied`、其余为 `run.failed`，因此行段上界取 2230 而不是 2210）、`:2530-2575`（含 `:2568`）、`:2660-2810`（含 `:2666` / `:2707` / `:2775` / `:2807`）、`:3240-3250`（含 `:3247`）。在这些段内**只允许追加“结束本轮跨度”与“写摘要出口”的调用，不改状态迁移、不改时间戳、不改既有事件顺序**；此前漏列的 `:2666` / `:2775` 与段外的 `:2807` 已按上列范围纳入授权。
  - **摘要写入集中一处**：三个收尾函数调用同一个共享辅助函数落 `execution.summary`，`object: 'session'` 字面量因此只新增 1 处，`grep -c` 上限仍是 13（12 处既有 + 1 处摘要）；不得在三个函数里各写一份字面量。
- `src/core/orchestrator.js` 的**会话状态事件发射点（12 处，逐处定去留）**——本迭代一律不改写、不删除、不新增：
  - 保留（审批留痕，属能力域 6 的“拒绝并留痕”）：`:1004`、`:1046`（`permission.requested`）、`:1102`、`:1133`（`permission.allowed` / `permission.denied`）。
  - 冻结（逐条运行态迁移，与基线 564 行不符，按 U-7 由 I1.12 清退）：`:1203`（`session.state`）、`:1294`、`:1323`（收尾回 `idle`）、`:2085`、`:2306`（`output.submitted`）、`:2325`（`run.completed`）、`:4889`（`state.change`）。冻结指“本迭代不改写、不删除、不新增”，这些行的**发射行为保持不变**——新实例运行中仍会写出逐条会话记录。
  - 摘要触发点：不新增独立触发点，复用上一条列出的三个收尾函数（`quiesceSession` / `idleSession` / `applyCancel`），在收尾的同一处写 `execution.summary`；`:3852`（`run.cancelled`）只是取消收尾路径上的一个已有发射点，不是第二个摘要入口。
  - 约束：本迭代结束前 `grep -c "object: 'session'" src/core/orchestrator.js` 不得超过 **13**（12 处既有发射点 + 1 处 `execution.summary` 写入点）；会话级事件类型只允许新增 `execution.summary` 一种，禁止出现第三类逐条会话事件。
- `src/adapter/session-state.js:146-160`：**不改**。该段只做状态与工具名归一化，摘要提取不在此处；若实现为取值方便需要读取 `update` 原始帧，改在 `orchestrator.js` 侧做。
- `src/core/status-text.js:310-342`：只在 `- 状态：…` 之后插入健康度行；`CORE_TEXT.doc` 只追加 `health` 字段名；既有段名、字段顺序、空值处理不动。
- `src/cli/labels.js`：只在文件末尾追加健康度与追踪文案键；`USAGE_LINES`（183–208 行）与既有键不动。
- `src/cli/render.js`：只新增 `renderHealthLine`、`renderTraceShow`、`renderSummaryLogLine`、`renderHealthEventLine`、`renderEventsSkippedLine` 五个纯函数；`renderEventLines` 只允许在函数开头增加一个按 `event.reason` 的分派分支（`execution.summary` / `health.changed` 委托新函数），其余事件仍走原逻辑，既有渲染函数与既有事件行格式不动。
- `src/cli/main.js`：除下列三处外不改任何分支；`run` / `cancel` / `graph` 路径不动。
  - `src/cli/main.js:194-206`（命令表）、`:543-561`（位置参数规则）、`:571`（运行时命令词）、`:628-634`（分发）、`:1167-1230`（实例命令区）：只追加 `trace show` 分支。
  - **`statusCommand`（`:999-1070`）**：只在实例状态行（`renderInstanceLine` / `renderInterruptedNote` 之后，当前约 `:1062-1065`）**插入一行** `renderHealthLine(snapshot, ctx.now())`；既有节点行、会话行、交接行、等待行的文字与相对顺序不变（BR-18）。这是 D-5 “`instance status` 只在实例状态行之后插入健康度行”的唯一落点。
  - **`instance log` 分支（`:1191-1211`）**：在既有 `for (const event of list)` 循环内，只对 `reason === 'execution.summary'` 与 `reason === 'health.changed'` 分别委托 `renderSummaryLogLine` / `renderHealthEventLine`，其余事件仍调 `renderEventLines`；循环结束后，若 `eventsRes.result.badLines > 0`，追加 `renderEventsSkippedLine(badLines)`。不改其他事件的渲染与顺序，不改事件排序（仍按 `seq` 升序）。
- `src/daemon/server.js:201-233`：只追加只读的 `instance.trace` 方法，并在 `instance.events`（`:225-232`）的返回里带上 `badLines`（与 `events` 同源）；既有方法表、错误映射与 `instance.get` 的返回结构不动。
- 新增文件：`src/core/health.js`、`src/core/trace.js`；不得出现 31 禁词与宿主分支。

### D-8 断言修改清单（只改期望文本，不放宽断言）

- `test/wp11/status-doc.test.js:68-130`：两处整份期望文本在 `- 状态：运行中` 后插入 `- 健康度：正常`；其余行逐字不动。`status-doc.test.js:179-251` 的“人工改写 / 无新状态不覆盖”用例不动。
- `test/wp9/cli-e2e.test.js:135-180`：若存在 `instance status` 整份输出断言，只插入健康度行；超时、状态词、会话行断言不动。
- `test/wp11/labels-sync.test.js:22-29`：不改映射表；新增健康度文案不并入六张状态表即可。
- `test/wp12/cli-assets.test.js:119-132`：**不改**；`USAGE_LINES` 必须仍是 25 行且前 8 行逐字不变。
- `test/wp11/purity.test.js`：31 词表不动；新增 `src/core` 文件必须被同一扫描覆盖。
- 新增用例放在本迭代新增的测试文件中，覆盖附录 A 的全部输出基线与附录 B 的两个口径；不得通过删除既有断言或放宽 `Then` 让覆盖表变绿。其中 `test/wp12/health.test.js` 专门覆盖 `computeHealth({ state, now })` 的三组等值边界（节点超时 30000ms、P90 50000ms、TTL 900000ms），通过注入固定 `now` 构造“恰好等于不命中、超出 1ms 命中”。

### D-9 回归门禁

- `single` / `code-loop` / `task-loop` 三条主链输出逐字不变；以 I1.7 收口后的 `main` 为基线。
- `orch instance status` / `graph` 既有非健康度输出逐字不变；健康度只允许新增一行。
- 全量测试失败集合与 `docs/iterations/iteration-7/baseline-failures.txt` 差集为 0，测试条数只增不减。
- `dependencies` 为 `{}`；31 词纯净扫描 `exit 0`。

### D-10 编号与标题形态（评审口径说明）

- 本文件 AC 标题**沿用本项目 I1.7 定稿需求的 `**AC-xx · …**` 形态**，未改为 `#### AC-`；机械取号请用 `grep -cE '^\*\*AC-'`，v7 为 27 条（AC-01~AC-27 连续、无缺号重号）。
- BR 取号请用 `grep -cE '^- \*\*BR-'`，v7 为 25 条（BR-01~BR-25 连续）。
- 上述两条形态属既有约定；若后续要统一为 `####`，应作为一次性格式迁移，不与本轮需求修订混做。

### D-11 本迭代明确不动的既有行为（便于回归判定）

- 会话逐条状态事件的现有发射点（12 处）不改、不删、不新增（去留见 D-7 与 U-7）。
- `USAGE_LINES` 的 25 行基线不动；`instance graph` 两种格式不动；`instance log` 既有事件行格式不动（只新增健康度事件的中文原因渲染与摘要记录）。
- 既有路径工厂、`nextSeq` 的容错口径、`event-bus` 的“先落盘再广播”顺序不动。
