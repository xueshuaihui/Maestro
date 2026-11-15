# I1.10b 需求评审记录 · Round 4

- **评审对象**：`docs/iterations/iteration-10b/requirement.md`（**v4**，1653 行；AC-01~AC-51 / BR-01~BR-43 / NF-1~NF-7；头部「版本：v4」，附录 C 末条为 v4）
- **评审角色**：需求评审工程师（干净上下文，只读）。只按判据与产物独立判断；未采信需求自述与附录 C 的修复回执。
- **判据来源**：`docs/index.md` 第一部分（§1 定位 / §3 四层状态模型 / §4 能力域 / §5 运行时与数据布局 / §6 边界）、第二部分 `#### I1.10b`（861–874）、`#### I1.10a`（840–857）、`#### I1.11`（878–888）、`#### I1.12`（892–907）、阶段一退出条件（911–913）、`docs/templates/requirement-template.md`（8 节 + 三条硬约束）、`docs/templates/execution-template.md` §1.0.3 / §1.1（13 条 DoR）/ §1.2、`docs/iterations/iteration-10b/decisions.md`（**裁决 A~I，效力最高**）。
- **只读声明**：唯一写入为本文件；未改 `requirement.md`、`decisions.md`、`docs/index.md`、模板、`src/**`、`test/**`、`desktop/**`。
- **复核方式**：Windows 11 / Git Bash / Node `v22.22.2`；分支 `feat/i1.10b-drilldown`，HEAD `66e5a6b`。共 24 组静态锚点实跑 + 4 组真实 `buildRoleInstances` 投影实跑；未跑全量 1425 条（会写 `docs/iterations/iteration-4/evidence/**`，与只读约束冲突，改用 `summary.json` 的 `gate.tests=1425` 与既有基线）。

---

## §0 总判

**总判：FAIL。**

- **阻断 4 项 / 建议 10 项**（F4-01~F4-04 阻断，F4-05~F4-14 建议；见 §7）。
- **上轮 15 项三态**：**已修 14 / 未修 0 / 修了但引入新问题 1**（F3-03；见 §1）。
- **规划覆盖**：13 行（10 子项 + 验收句 3 段）**覆盖 13 / 部分 0 / 缺漏 0 / 越界 0 / 收窄 0**（§2）。第 8、9、13 行继续按裁决 C / 裁决 A / 裁决 I 记「一致」；正文均已显式标注偏离，未自称逐字达成。
- **形式面**：AC 51 条连续无重号，七类字段 51/51 齐全；BR 43/43 双向覆盖（无未引用、无幻引用）；附录 A~D 齐全、头部 v4 与附录 C 一致、无括号指引残留；`dependencies` 仍为 `{}`，两处 31 词纯净扫描均 `exit 0`。
- **本轮 FAIL 的性质**：v4 把 round3 的 5 个阻断基本修实（F3-01 的投影口径已用真实 `buildRoleInstances` 复核通过，F3-02/F3-04/F3-05 的接缝与夹具已换到真实能力上）。**剩余阻断集中在「v4 新写的判定细节」**：
  1. **AC-08 / BR-06 把基线 489 的 8 档卡片排序折叠成 7 档**，`assigned` 被抬到 `review` 之前；
  2. **A-5 / AC-19 的 `HO-010` 行时间与同一包的时间线自相矛盾**（09:12:40 对 09:12:41）；
  3. **AC-29 的 Given 没有构造 Then 3/4 需要的证据、摘要、原因与缺陷**，且 When ⑥→⑦ 缺一次「返回流程图」；
  4. **AC-50 声称的「既有断开/自动重连」路径只覆盖 `view === 'graph'`**（`app.js:1477`），下钻 `view === 'drill'` 时该路径不存在。

---

## §1 上轮 FAIL 复核（F3-01~F3-15）

> 三态口径：`已修` = 原判据按上轮要求闭合（涉及裁决 A~I 的以 `decisions.md` 为准）；`未修` = 原问题仍在；`修了但引入新问题` = 原判据看似闭合，但修法本身产生新的不可执行 / 不可构造。

| # | 判定 | v4 落点（行） | 证据 |
|---|---|---|---|
| F3-01 | **已修** | §2.3 126–134；A-1 1081–1087；AC-01 425–428；AC-04 458–461；AC-37 840–843；D-2 1486；A-10 1317 | 用 AC-01 的 Given 实跑真实 `buildRoleInstances`：`status=busy`、`activeSessions=["S1","S2"]`、`servingNodes=["T-001","T-002"]`、`hostIcons=["dsh","cursor"]`、`lastAction={T-002,round:2,maxRounds:3,state:review}`，与 A-1 第 7 行逐字一致；AC-04 三现场实跑为 `busy/3/["T-001","T-002","T-003"]/["dsh","cursor"]`、`available/0/[]/[]/T-010`、`inactive/0/[]/[]/null`，与 A-1 第 4/2/3 行一致；AC-37 实跑为 `unavailable/1/["T-021"]/["dsh"]/T-021`，与正文一致。A-1 第 5/6 行也实跑可产出（§8.3）；第 1 行是第 7 行的同口径变体（两服务中节点、单宿主、轮次 1/2）。 |
| F3-02 | **已修** | AC-27 722；AC-43 910；AC-47 954；AC-48 965；AC-50 983–987；D-3 1503；D-14 A2 1606 | `applyTestOverlay` 实点 `stream.js:255`，`node.status` 覆盖在 `:263`，边覆盖在 `:269`；`server.js:318` 为既有唯一调用点。AC-48 已改成「只翻状态词」并明写限制；AC-50 用第二份快照补「绑定归零」；接缝可见范围与 D-3 一致。**但 AC-50 的重取路径自身有构造问题 → F4-04。** |
| F3-03 | **修了但引入新问题** | AC-29 736–753；Given 741；When 742；Then 746/747；机检 751；夹具 752 | 原两点已闭合：When 增了 ⑦ 点 `S-001`、⑧ 点面包屑；Given 增了 `HO-008` 的 `rejected` 交接包，Then 第 1 条的红色连接线有来源。**新问题**：Given 没有构造 Then 3 的 `execution.summary` / 证据引用，也没有构造 Then 4 的 `reasonDetail` / `defects`；When ⑥「继续」之后直接 ⑦ 点 `S-001`，缺一次从升级面板回到流程图的动作。→ **F4-03**。 |
| F3-04 | **已修** | AC-23 667–675；D-14 B2/B3 1616–1617 | Given ① 改为 `test.escalate` 的真实产出（`src/daemon/server.js:345-352`；`src/core/escalation.js:120-160`），再用 `escalate resolve` 预置 `resolved`；Given ② 明写「运行中 + 待处理升级」不可由产品路径产生（`orchestrator.js:5051-5052`），改用 `io.continueEscalation` 注入点 + 真实错误形状，并补「连发两次 → `ESCALATION_NOT_PENDING`」的真守卫复核。给定与接缝一致，原问题闭合。 |
| F3-05 | **已修** | AC-01 428–429；D-14 A1 1605 | 机检先用 `desktop/harness/graph-dump.mjs --project … --instance … --payload …` 产图；实测该脚本 `parseArgs` 支持 `--project/--instance/--payload`（`graph-dump.mjs:45-64`），且头注释 10–15 行明示三种用法；`collect.mjs` 只采列表与文案表，已不再用于 AC-01。 |
| F3-06 | **已修** | AC-28 731–732；NF-4 1006；U-16 1375–1376 | Then 只留「三处一致、切换无闪烁无等待、不崩、不重复加载感」；`opCount / fetchCount / maxFetchesPerView` 移入机检内部断言；NF-4 补了「40/30 为本迭代自定稳定性口径、只作内部指标」。残留的「40 次导航动作」仍在 Then 中，但不改变判定强度（建议级，见 F4-10）。 |
| F3-07 | **已修** | AC-05 471–472；AC-06 482–483；AC-43 908–909 | Then 已改为「边框明显更粗」「滚到对应卡片并高亮」「条目没有从眼皮底下跳走」；`bold === true`、`scrollTarget`、`anchorRowTop ≤ 1px` 只在机检内部断言出现。 |
| F3-08 | **已修** | AC-15 582–584；AC-17 604–606；AC-36 832–834 | 「恰好 N 条」已改为行为/语义断言：方向由定义边 `kind` 决定、子图坐标与同一 `computeLayout` 输出逐字节相等、`depth` 增减与 `returnCount === 3`；静态扫描降为「≥1 条 / 零命中」且注明不绑写法。 |
| F3-09 | **已修** | AC-02 441 ④ | 补扫 `app.js:410-417` 的 `backToList()`（`state.viewState = null` 在 417 行）；新增「返回后 `viewState !== null` 且五组值逐字段相等」的行为断言；`grep backToList( desktop/ui/drill/` 零命中。 |
| F3-10 | **已修** | AC-04 458；AC-07 491 | AC-04 ① 钉住 `T-001/T-002/T-003` 的状态、`stateSince`、宿主顺序、`maxRounds`；AC-07 钉住两张卡的标题、角色、状态、轮次、`stateSince`、工具、依赖、产物、证据数。逐字断言字段均可由 Given 派生。 |
| F3-11 | **已修** | §1.3 60；§2.11 260–261；AC-49 974；BR-42 400 | 统一为「只在**本实例**升级处理面板内（入口两处：升级节点 / `escalated` 角标）」；`escalated` 角标与升级节点进同一面板，措辞一致。 |
| F3-12 | **已修** | §2.10 248；BR-43 401；AC-51 990–999 | 新增「与基线 477 行的取舍（显式留痕）」段：连线侧改道交接包面板，角标侧进升级面板；BR-43 声明改道理由；AC-51 判定三次点击的落点。建议标题措辞见 F4-09。 |
| F3-13 | **已修** | AC-25 697 | 写明翻转在两次点击之间进行、直接重写 `%TEMP%/…/state.json` 的 `SESS-A.lastChangedAt`（下钻路由每次 `loadState` 读盘、不缓存）、与 §3.3「先起核再写盘」的关系、要求留三态片段。 |
| F3-14 | **已修** | NF-1 1003；NF-2 1004；NF-3 1005；NF-5 1007；AC-01 428 ③ | NF-1/2/3/5 均挂 AC 号；AC-01 机检补 `createApp({labels, project, io})` 断言 `view === 'drill'` 与内部断言 `t_drill - t_click ≤ 1000`；AC-16 已有返回后 `view === 'drill'`。 |
| F3-15 | **已修（原两处）** | AC-23 672–675；AC-49 977 | 行号已补全：`ESCALATION_NOT_PENDING` 在 `core/escalation.js:89`、`orchestrator.js:5049`、`cli/labels.js:336`、`cli/render.js:1125`；`INSTANCE_NOT_SUSPENDED` 在 `orchestrator.js:5052`、`cli/labels.js:339`、`cli/main.js:1554`（1552 是注释）；AC-49 改为 `grep -REn … | wc -l` 必须输出 `1`。**v4 新写的 AC-50 引入一处新行号错误（`connection.js:172` 是 `retry()`，守卫在 173）→ F4-05。** |

**统计：已修 14（F3-01、F3-02、F3-04~F3-15）；未修 0；修了但引入新问题 1（F3-03）。未闭合编号：F3-03（并由 F4-03 承接）。**

---

## §2 规划原文逐句覆盖表（强制）+ 反向扫描

> 规划原文逐字摘自 `docs/index.md` 861–874 行；「符合性」取 `一致 / 收窄 / 降级 / 越界`；「覆盖判定」只取 `覆盖` 为 PASS。

| # | 规划原文（逐字 + `index.md` 行号） | 需求 §2 落点 | 需求 §3 落点 | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | `角色下钻视图：局部 DAG（1 跳）+ 任务卡片列表`（863） | §2.2（102）/ §2.4（136）/ §2.5（153） | AC-01、AC-05、AC-07、AC-38、AC-39、AC-40 | 一致 | **覆盖** |
| 2 | `任务卡片三层信息 + 会话状态指示器 + 节点类型特殊显示`（864） | §2.5（153–171） | AC-07、AC-09、AC-10、AC-41 | 一致（**排序档位与基线 489 冲突 → F4-01，不影响「已落点」**） | **覆盖** |
| 3 | `DAG 与卡片联动：点击 DAG 节点滚动到对应卡片`（865） | §2.6（173–184） | AC-06 | 一致 | **覆盖** |
| 4 | `点击卡片进入节点详情（会话状态时间线、ACP 事件摘要、证据引用、交接包历史）`（866） | §2.7（186–202） | AC-11、AC-12、AC-13、AC-14、AC-15 | 一致 | **覆盖** |
| 5 | `“查看全部节点”切换：切换到全实例节点看板（7 列）`（867） | §2.8（204–214） | AC-16 | 一致 | **覆盖** |
| 6 | `` `subworkflow` 下钻：点击折叠组节点进入子工作流角色流程图 ``（868） | §2.9（216–230） | AC-17、AC-18、AC-36 | 一致 | **覆盖** |
| 7 | `连接线点击展开交接包列表 + 时间线`（869） | §2.10（232–248） | AC-19、AC-42、AC-43、AC-51 | 一致（**A-5 行时间与时间线冲突 → F4-02**） | **覆盖** |
| 8 | `特殊节点点击跳转人工任务/升级队列`（870） | §2.11（250–267）/ §2.12（269–284） | AC-20、AC-21、AC-24、AC-44、AC-49 | 一致（「升级队列」按**裁决 C** 落为**本实例**面板；§2.11 267、U-01 1343–1344 已声明） | **覆盖** |
| 9 | `一键跳转宿主会话：从角色节点跳转到 DSH 对应会话`（871） | §2.13（286–304） | AC-25、AC-26、AC-33、AC-46 | 一致（**裁决 A** 三段口径；§1.3 63、§2.13 298、AC-25 692、AC-29 740 均标注「属裁决 A 的偏离说明」，未自称逐字达成） | **覆盖** |
| 10 | `角色状态栏（inactive/available/busy/cooldown/unavailable）`（872） | §2.3（121–134） | AC-03、AC-04、AC-37 | 一致（五词映射：未参与/可用/服务中/冷却中/不可用） | **覆盖** |
| 11 | 验收句前段：`人在面板上完整走“角色流程图发现异常→下钻到角色→查看任务卡片→展开证据→处理升级→实例继续”，不需要终端`（874） | §2.15（322–355）/ §2.12 | AC-22、AC-29、AC-45 | 一致（**AC-29 的 Given/Then 缺口 → F4-03**） | **覆盖** |
| 12 | 验收句中段：`子工作流可下钻`（874） | §2.9（216–230） | AC-17、AC-36 | 一致 | **覆盖** |
| 13 | 验收句后段：`一键跳转能打开 DSH 对应会话`（874） | §2.13（286–304） | AC-25（**按裁决 A + 裁决 I 的口径判定，未逐字达成规划原文该段**） | 一致（**裁决 A / I**：§2.13 298、AC-25 692 已显式标注偏离；§8.7 本机 `cargo` 不存在、DSH 0.2.2-rc.1 存在） | **覆盖** |

**统计：覆盖 13 / 部分 0 / 缺漏 0 / 越界 0 / 收窄 0。**

### 2.1 反向扫描 ①：§2 功能点与 AC 反查规划来源（查夹带）

- §2.1 的 13 个功能点（§2.2~§2.14）逐条可追到规划 10 子项、验收句 3 段，或追到基线 §3.3 / §4 能力域 4·5 / §5.7 的具体条目；51 条 AC 亦同。**无规划之外的新能力。**
- 四类「非逐字来源」均可归到基线或裁决，不构成越界：
  1. §2.3 的五项顺序与折叠 → 基线 §5.2「角色节点视觉编码」（449–450）+ §3.3 `role_instance` 模型（208–220）；
  2. §2.12 的「继续」 → 验收句「处理升级→实例继续」+ 裁决 C（§1.3 54、U-08 1358–1359）；
  3. §2.14 的实时/节流 → 基线 §5.7（514–530）；
  4. AC-48 / AC-50（角色中途退出 / 绑定归零）→ §2.14（318、340）+ 基线 §3.3 / §5.7，属异常分支补齐（裁决 E 允许「补 AC」）。
- **唯一「量化目标无规划/基线逐字来源」的一处**：NF-4 的「40 次导航 / 30 次取数」是需求自定稳定性口径；v4 已在 NF-4 与 U-16 标明只作内部指标，不构成新能力，不计夹带。

**结论：反向扫描 ① 无夹带。**

### 2.2 反向扫描 ②：基线状态词与能力域反查 §2 落点（查缺漏）

| 基线项 | §2 落点 | 判定 |
|---|---|---|
| 节点 9 态（129–168） | A-0（1049–1050）写明 9 态→7 显示词折叠（`assigned`→执行中、`pending`→待执行 + 档位拆分）；BR-06；AC-08 含 `assigned` 实例 | 显示词覆盖；**卡片排序档位与基线 489 冲突 → F4-01** |
| 会话 6 态（170–193） | A-0 / A-3 指示器表（1155–1165）/ BR-08（6→5 标签 + 无会话） | 覆盖 |
| 角色 6 态（195–222） | §2.3 五词 + BR-02 + U-09（`retired`→`inactive`→未参与；`graph.js:117` 实点） | 词表覆盖；**基线 450「服务节点 = 当前绑定节点 ID 列表」与 v4 的「服务中节点」口径有字面差异 → F4-08（建议）** |
| 交接包 7 态（224–246） | A-0 七词、A-5 时间线、§2.10 聚合优先级（基线 395）、AC-19 | 覆盖；**A-5 `HO-010` 行时间冲突 → F4-02** |
| 能力域 2「子工作流折叠」（342） | §2.9、BR-16/BR-32、AC-17/18/36 | 覆盖 |
| 能力域 4（365–412） | §2.10、§2.14、A-5、AC-19/42/43/51 | 覆盖 |
| 能力域 5 视图层次（416–439）/ 角色流程图（441–496） | §2.2~§2.8、BR-01~BR-15 | 覆盖 |
| 能力域 5.6 人工干预队列（509–512） | §2.11/§2.12 仅本实例、仅「继续」；跨实例队列在 §1.3 60 明确留 I1.11 | 覆盖（作用域按裁决 C） |
| 能力域 5.7 数据接口与实时推送（514–530） | §2.14 + §3.3 测试接缝（1018）；U-13 | 覆盖 |
| §5.2 数据布局（600–614） | §2.7 证据/日志引用；§3.3 夹具写 `state.json`/`events.jsonl`/`traces.jsonl`；D-2 证据存在性 | 覆盖 |
| 基线 477「点击红色/橙色连接线**或** escalated 角标 → 跳转升级处理面板」 | 角标侧：§2.11 261 + AC-49 + BR-42（已落）；连线侧：§2.10 248 改道交接包面板（BR-43 + AC-51，已显式留痕） | 覆盖（改道已声明；建议标题措辞见 F4-09） |
| §6 边界 5/7/9/10（624/626/628/629） | §2.3 134、§2.10 248、§2.12 284、§1.3 63 | 覆盖 |

**结论：无整体缺漏；一处基线排序冲突（F4-01）、一处服务节点口径字面差异（F4-08，建议）、一处 A-5 时间冲突（F4-02）。**

---

## §3 第二部分（A 符合规划 / B 罗列全面）

| 判据 | 结论 | 依据（行号 / AC） |
|---|---|---|
| **A①** 规划 10 子项逐字 → §2，不降级/收窄/换名/合并 | **PASS** | 子项 1~7、10 与 §2.2~§2.9、§2.3 语义一致；子项 8 的「升级队列」按裁决 C 落为**本实例**面板（§2.11 267、U-01 1343–1344），已声明；子项 9 与验收句后段按裁决 A 落为三段口径（§2.13 291–301、AC-25 692），并在 63 / 298 / 692 / 740 / 1651 行标注「属裁决 A 的偏离说明」，未自称逐字达成。 |
| **A②** 功能点六要素（操作/效果/异常/边界）与规划语义一致 | **PASS** | §2.2~§2.14 均六要素齐全；§2.5 的未知状态统一「被阻塞 + 状态未知」（168），与 `desktop/ui/board/board.js` 及 10a AC-35 同口径（裁决 D）；§2.13 四种降级与裁决 A 三段逐条对应（299–303）。**BR-06 的排序档位另见 F4-01。** |
| **A③** 规划「范围外/留待后续」未被写成范围内 | **PASS** | 通知/跨实例队列/审批/重派/终止 → I1.11（60）；证据过期/指纹/治理/预算/生态/性能 → I1.12（61）；多宿主/Web → I2.4（62）；窗口级自动判定 → 裁决 B（64）；AC-24 断言面板只有「继续/取消」（683–686）。 |
| **A④** 向后兼容有落点 | **PASS** | §1.2 第 7 条（40）、§1.3 红线（73–78）、BR-28（386）、AC-34（799–812）、D-13（1589–1595）声明三条主链、CLI 格式、`USAGE_LINES` 25、I1.10a 44 条 AC 与 A-1~A-14 文案不变；AC-34 的判定已按裁决 G 改为「差集 = 0」。 |
| **A⑤** 无夹带 | **PASS** | 反向扫描 ①：0 夹带；NF-4 的量化目标已标为内部指标，不是新能力。 |
| **B①** 规划条目（10 子项 + 验收 3 段）↔ §2.1 / 对账表零缺漏 | **PASS** | §2.1 13 行（86–100）与文末对账表 13 行（1634–1648）逐项对应；10 子项全部有 §2 落点与 AC。 |
| **B②** 基线 §3/§4/§5.2/§6 相关处都有落点 | **PASS（2 建议）** | 见 §2.2：四层状态词、能力域 2/4/5、§5.7、§5.2、§6 均有落点；基线 489 排序冲突（F4-01）与基线 450 服务节点口径（F4-08）另列。 |
| **B③** §2.15 衔接覆盖验收句完整流程（含失败路径） | **PASS** | §2.15 十步（326–335）覆盖「发现异常→下钻→卡片→证据→处理升级→继续→看板→子流程→交接→跳宿主」；降级分支（337–353）逐条挂 AC。**AC-29 的 Given/When 缺口另见 F4-03，不影响 §2.15 的落点。** |
| **B④** 43 条 BR 覆盖每条用户可见规则 | **PASS** | 实跑 BR 43/43 双向覆盖：无未引用 BR、无引用不存在的 BR（§8.1）。 |

**§3 判定：PASS（第二部分本身符合规划与罗列要求；排序/时间/AC-29 的问题落在 §4/§7）。**

---

## §4 第三部分（C 符合规划 / D 罗列全面）

| 判据 | 结论 | 依据（AC 号 / 行号） |
|---|---|---|
| **C①** 验收句逐字 → AC 且不被弱化 | **PASS** | 前段：AC-29（736–753，7 条逐条 + 「无终端」探针集合断言）；中段：AC-17（597–606）；后段：按裁决 A / I 由 AC-25（688–701）三段判定，AC-29 740 明示「不声称该语义已达成、也不声称被 AC-25 覆盖」。语义强度未被放宽。**AC-29 的 Given/When 缺口见 F4-03。** |
| **C②** Given/When/Then 用户视角 | **PASS（2 建议）** | 51 条基本为用户视角；AC-05/06/43 的字段级断言已在机检、Then 已改用户语义（F3-07 已闭合）；AC-28 Then 仍保留「40 次导航动作」（属操作定义，非性能数字；建议见 F4-10）。 |
| **C③** 失败/异常/超限路径有 AC | **PASS** | AC-18（子流程读不到/循环/空）、AC-23（升级已处理/实例未挂起）、AC-26（三种降级）、AC-31（四类运行期异常）、AC-45（继续失败）、AC-46（唤起失败）、AC-48/AC-50（角色中途退出/绑定归零）、AC-37~AC-44（DAG/卡片/长列表/空态边界）——§2 的异常分支均有 AC 落点。 |
| **C④** 每条 AC 三件套 + **可执行锚点** | **FAIL** | 机械上 51/51 都有 `场景类型/风险/引用/Then/机检/夹具/架构检查`（§8.1），但有 4 处锚点在当前仓库事实上不成立或不可构造：**AC-08**（7 档排序与基线 489 的 8 档冲突，§7 F4-01）、**AC-19 / A-5**（`HO-010` 行时间与时间线冲突，F4-02）、**AC-29**（Given 未构造 Then 3/4 的证据/原因，When ⑥→⑦ 缺返回，F4-03）、**AC-50**（「既有断开/重连」路径只覆盖 `view === 'graph'`，`view === 'drill'` 时不存在，F4-04）。 |
| **D①** §2 每个功能点（含异常/边界）→ ≥1 AC | **PASS** | §2.2→AC-01/02/31/37/48/50；§2.3→AC-01/03/04/37/48/50；§2.4→AC-05/38/39/40；§2.5→AC-07/08/09/10/41；§2.6→AC-06；§2.7→AC-11~15；§2.8→AC-16；§2.9→AC-17/18/36；§2.10→AC-19/42/43/51；§2.11→AC-20/21/44/49；§2.12→AC-22/23/45；§2.13→AC-25/26/33/46；§2.14→AC-27/28/47/48/50。 |
| **D②** 规划每条目 → ≥1 AC | **PASS** | 13 行对账全部有 AC；子项 8 的裁决 C 形态由 AC-20/21/24/44/49 判定。 |
| **D③** BR 双向覆盖 | **PASS** | 43 条全部被引用、无幻引用（§8.1）。 |
| **D④** §3.2 非功能、§3.3 前置齐全且用户视角 | **PASS（2 建议）** | NF-1~NF-7 齐全，NF-1/2/3/5 已挂 AC 号（F3-14 闭合）；NF-4 的 40/30 已标内部指标、U-16 登记；§3.3 的环境/夹具/DSH 面为项目既有技术前置，可接受。AC-42/43 的滚动指标无 DOM 承载（§9-2，建议）。 |
| **D⑤** AC 编号连续无重复 | **PASS** | `grep -cE '^\*\*AC-'` = 51；AC-01~AC-51 连续、无重号（§8.1）。 |

**§4 判定：FAIL（C④；AC-08 / AC-19 / AC-29 / AC-50）。**

---

## §5 基线与模板合规 + 新增 AC-50/51、BR-43 依据审查

### 5.1 模板三条硬约束与 8 节结构

- **用户视角**：§2 基本为用户语言；§2.12 的实现口径指 D-3（278），§2.13 的 asar/headless 细节指 D-4/U-02（304）；§2.10 已无「虚拟滚动」等实现词。**PASS。**
- **Then 用户可见**：AC-05/06/43 的字段级断言已移入机检（F3-07）；AC-28 仍含「40 次导航动作」但已标为操作定义（建议 F4-10）。**PASS（1 建议）。**
- **编号与双向引用**：AC 51 / BR 43 / NF 7；BR 43/43 双向覆盖（§8.1）。**PASS。**
- **8 节结构**：§1 背景/目标/范围；§2 总览 + 14 功能点 + 衔接 + BR（§2.16）；§3 AC/NF/前置；附录 A~D。**PASS。**
- **括号指引 / 版本**：`待补充|TBD|TODO|XXX|[需求标题]|填写指引` 零命中；头部 v4（7）与附录 C 末条 v4（1429–1448）一致。**PASS。**

### 5.2 状态词与基线一致性（重点）

| 层 | 基线 | 需求 | 判定 |
|---|---|---|---|
| 节点 | 9 态（129–168） | A-0 明确 9→7 显示词折叠（`assigned`→执行中、`pending`→待执行 + 档位另拆）；BR-06 同口径 | **显示词 PASS；卡片排序档位 FAIL（F4-01）** |
| 会话 | 6 态（170–193） | 6→5 标签 + 「无会话」；`thinking`/`tool_running` 共用执行中、后者带工具图标（BR-08 / A-3 1155–1165） | **PASS** |
| 角色 | 6 态（195–222） | 五词 + `retired`→`inactive`→未参与（U-09、`graph.js:117` 实点） | **PASS（词表与投影均实测可产出）** |
| 交接包 | 7 态（224–246） | A-0 七词、A-5 时间线、聚合优先级按基线 395 | **PASS（A-5 行时间另见 F4-02）** |
| 看板列 | 7 列（166） | AC-16 列名/顺序与 `src/daemon/http/labels.js:101-107` 逐字一致（§8.2） | **PASS** |

**A-1 可产出性实测**：用 AC-01 / AC-04 / AC-37 的 Given 跑真实 `buildRoleInstances`，A-1 第 1~7 行所需的 `status / activeSessions.length / servingNodes / hostIcons / lastAction` 均可产出；AC-01 第 7 行、AC-04 第 4/2/3 行、AC-37 的 `不可用 + 服务 T-021 + 宿主 dsh` 均与投影一致（§8.3）。**F3-01 已闭合。**

**基线 450 的字面差异（建议）**：基线 450 写「服务节点 | 当前绑定节点 ID 列表」，v4 §2.3 / A-1 取 `servingNodes`（`running`/`review`）口径。v4 的理由是「与角色流程图同一口径」，但正文没有逐字对照基线 450；建议补一句，避免 S1 按「全部绑定节点」实现后与 AC-01/04/37 冲突（F4-08）。

### 5.3 附录与授权清单

- **附录 A~D**：A-0~A-10、B-1/B-2（U-01~U-16）、C 变更记录、D-1~D-14 齐全；附录 D 可指导编码（D-1 文件边界、D-2 投影规则、D-3 七端点 + 错误码映射、D-4 打开宿主、D-5 角色态来源、D-6 只读、D-7 节流、D-8 词表、D-9 测试接缝、D-10/D-11 授权、D-12 编号、D-13 不动清单、D-14 契约锚点）。**PASS。**
- **D-11 行号**：`EXPECTED_DESKTOP_KEYS` 63 行、`EXPECTED_DESKTOP_VALUES` 131 行、147 断言 310 行，实点一致（§8.2）。**PASS。**
- **契约锚点**：4 条 `契约：`（A1 `drill-dump.mjs::main`、A2 `createStreamHub().applyTestOverlay`、A3 返回流程图导航方法、A4 `io.continueEscalation`）与 D-14 表 A 逐条一致；A2 的 `stream.js:255/650`、`server.js:318` 实点正确。**PASS。**
- **零命中/文件存在性锚点的登记方式（建议）**：§3.1 规则 6 声称所有指向新建产物的锚点（`src/daemon/drill.js`、`desktop/ui/drill/*`、`test/wp14/*`、`probe/*`）都属第 ② 类，但大量 `grep … desktop/ui/drill/` 与 `test -f test/wp14/…` 未写成 `契约：`，也未进 D-14；S3 可能把目录不存在时的 `exit 2` 误当失败。建议在 D-14 补「零命中/文件存在性」登记或在这些 AC 标「S2 前未落地不计通过」（F4-11）。

### 5.4 新增 AC-50 / AC-51 / BR-43 依据审查

| 编号 | 依据是否真在规划或基线 | Given 可构造 | Then 用户可见 | 锚点可执行 | 结论 |
|---|---|---|---|---|---|
| **AC-50 / BR-41** | 依据在 §2.14（318、340）与基线 §3.3 角色态 / §5.7 推送，不在规划 10 子项的逐字条目内——属异常分支补齐（裁决 E 允许「补 AC」），**不是凭空扩范围** | **否（按 v4 写法）**：`state-b.json` 替换可做，但「既有断开/自动重连」在 `view === 'drill'` 下不重开图流（`app.js:1477` 只在 `view === 'graph'` 时开图流）；除非 S2 新增 drill 订阅/重连，需求未写 | 是（未参与 · 任务无 · DAG 保留） | 否（AC-50 的 Given 与机检依赖的「既有路径」不存在；`connection.js:172` 还是 `retry()` 而非守卫） | **不通过（F4-04）** |
| **AC-51 / BR-43** | 依据在基线 477（红色/橙色连接线或角标 → 升级面板）与规划 869（连接线点击 → 交接包列表 + 时间线）；两条来源冲突，v4 选规划并在 §2.10 248 / BR-43 / AC-51 显式留痕 | 是（三条 `rejected`/`expired`/`delivered` 交接包 + 定义边） | 是（三次都进交接包面板，不进升级面板/下钻） | 是（`connection-panel.test.js` + `handoff-panel.js` 零命中 `escalation`；均为 S2 新建，属契约） | **通过（1 处标题措辞建议 F4-09）** |
| **BR-43** | 基线 477 连线侧 + 规划 869；改道理由（规划优先、拒绝/过期原因可读）成立，且明确「不新增第三个入口」 | — | 是（用户点任意连接线都进交接包面板） | — | **通过** |

**编号与覆盖**：AC 51 条连续无重号，BR 43 条连续无重号，BR 双向 43/43；AC-50/51、BR-43 均为接续编号，未重排既有编号（D-12 1584–1585 一致）。**新增 AC-50 的构造问题见 F4-04；AC-51 的改道本身成立。**

### 5.5 其他字段级一致性（建议，不单独阻断）

- **`lastAction` 的字段集**：A-1（1078）与 §2.3（134）把 `lastAction` 的来源写成 `{nodeId,round,maxRounds,state,stateSince}`；AC-01（428）、AC-04（461）、AC-37（843）的机检却把期望对象写成不含 `stateSince` 的四字段。若 `drill-dump` 原样导出投影，deep-equal 会失败；若只导出四字段，又与「取投影」表述不完全一致。建议改为子集断言或补齐 `stateSince`（F4-05）。
- **AC-20 的空态词**：A-4（1184–1187）是 `时间线 无记录` / `摘要 无记录` / `证据 无记录` / `交接 无记录`；AC-20（636）写「时间线与摘要为『记录 无』」。A-9 的 `记录 无` 是通用空态，不是 A-4 的逐字行；建议统一（F4-06）。
- **AC-21 的原因/缺陷**：Given（645）只写两条 pending 升级，Then（647）要求 `原因：<原文>` 与缺陷行、机检（648）要求「原因行逐字」，但 Given 未钉 `reasonDetail` / `defects` 的字面值；建议在 Given 写明夹具值（F4-07）。

---

## §6 判定锚点实测抽查表

> 全部在 `D:/WWW/Maestro` 根执行；HEAD `66e5a6b`。`desktop/ui/drill/**`、`src/daemon/drill.js`、`src/adapter/host-open.js` 尚未创建（S2 未开工），涉及它们的 `grep` 返回 `exit 2`（No such file），不是 `exit 1`；按「未落地不计通过」记，不冒充通过。

| # | AC | 命令（摘要） | 实测输出 / exit | 断言 | 判定 |
|---|---|---|---|---|---|
| 1 | AC-01（投影） | `node --input-type=module` 跑 `buildRoleInstances`（AC-01 Given） | `busy / ["S1","S2"] / ["T-001","T-002"] / ["dsh","cursor"] / T-002 2/3 review` | A-1 第 7 行 + `activeSessions===2` | **符合**（`lastAction` 多 `stateSince`，见 F4-05） |
| 2 | AC-01（夹具） | 读 `desktop/harness/graph-dump.mjs` 头注释/`parseArgs` | 支持 `--project/--instance/--payload`，exit 0 | AC-01 ① 可用 | **符合（现状脚本）**；`drill-dump` 为契约，S2 前未落地 |
| 3 | AC-04（投影） | 同式跑 AC-04 三现场 | `busy/3/.../["dsh","cursor"]`、`available/0/[]/[]/T-010`、`inactive/0/[]/[]/null` | A-1 第 4/2/3 行 | **符合** |
| 4 | AC-37（投影） | 同式跑 AC-37 | `unavailable/1/["T-021"]/["dsh"]/T-021` | 正文逐字行/`statusReason==='unknown-role'` | **符合** |
| 5 | AC-02① | `grep -REn "createViewState\(" desktop/ui/app.js` | `396:` / `462:`（2 条，exit 0） | 恰好 2 条 | **符合** |
| 6 | AC-02② | `grep -REn "createViewState\(" desktop/ui/drill/` | exit 2（目录不存在） | 零命中（S2 后） | **S2 前不可判定** |
| 7 | AC-03② | `grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js` | `23:` / `137:`（2 条，exit 0） | ≥1 | **符合** |
| 8 | AC-03 | `grep -REn "已关闭" desktop/ui desktop/harness` | 0 命中（exit 1） | 零命中（exit 1） | **符合** |
| 9 | AC-09 | `grep -REn "git_push" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 10 | AC-13 | `grep -REn "execution\.summary" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 11 | AC-14 | `grep -REn "已过期\|过期" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 12 | AC-22① | `grep -REn "state = 'running'\|node.state = " src/daemon/http/` | 0 命中（exit 1） | 零命中 | **符合** |
| 13 | AC-23①/④ | `grep -REn "ESCALATION_NOT_PENDING\|INSTANCE_NOT_SUSPENDED" desktop/ui` / `desktop/harness` | 各 0 命中（exit 1） | 零命中 | **符合** |
| 14 | AC-23③ | 同式扫 `src/core src/daemon src/cli` | 8 条（`escalation.js:89`、`orchestrator.js:5049/5052`、`labels.js:336/339`、`main.js:1554`、`render.js:1125`；`main.js:1552` 为注释） | 各 ≥1 | **符合** |
| 15 | AC-25① | `grep -REn "dsh" src/daemon/http/routes.js` | 0 命中（exit 1） | 零命中 | **符合（routes 现状）**；`drill.js`/`host-open.js` 为契约 |
| 16 | AC-26 | `grep -REn "DeepSeek Harness" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 17 | AC-30 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>`；`desktop/ui,desktop/harness` | 两处均 `OK … 零命中`，exit 0；`dependencies` 为 `{}` | exit 0 / `{}` | **符合** |
| 18 | AC-34 | `ls test/wp13/*.test.js \| wc -l`；`wc -l baseline-failures-win32.txt`；`summary.json.gate.tests` | 36 / 35 行（16 条登记项）/ 1425 | 点数 36、基数 1425 | **部分（未跑全量；只核清单）** |
| 19 | AC-42 | `node -p "JSON.stringify(require('./package.json').dependencies||{})"` | `{}` | 输出 `{}` | **符合** |
| 20 | **AC-08** | 对比 `BR-06` / `AC-08` 的 `rank=[1,2,3,3,4,5,6,7,7]` 与基线 489 | 基线为 `escalated>failed>running>review>assigned>ready>blocked>done`（8 档） | `assigned` 应在 `review` 之后 | **不符（F4-01）** |
| 21 | **AC-19 / A-5** | 读 A-5 1198–1200 与 AC-19 625 | 行 `09:12:40`；时间线 `09:12:41 已投递` | 行时间与最近活动一致 | **不符（F4-02）** |
| 22 | **AC-29** | 读 AC-29 Given 741 / Then 746–747 / When 742 | Given 无 `execution.summary`、证据、`reasonDetail`、`defects`；⑥→⑦ 无返回 | Then 3/4 可判定 | **不符（F4-03）** |
| 23 | **AC-50** | 读 AC-50 984 / 987；`grep -n "current.view === 'graph'" desktop/ui/app.js`；`grep -n "function retry\|status !== 'failed'" desktop/ui/connection.js` | `app.js:1477` 仅 graph；`connection.js:172` 是 `retry()`，守卫在 173 | `view==='drill'` 下既有重连路径可用；行号正确 | **不符（F4-04/F4-05）** |
| 24 | AC-51 | 读 §2.10 248 / BR-43 401 / AC-51 996 | 改道已留痕；三次点击均进交接包面板 | 与基线 477 的取舍已声明 | **符合（建议标题 F4-09）** |

**抽查统计：24 组，覆盖 20 条 AC。符合 16 / 不符 4（AC-08、AC-19/A-5、AC-29、AC-50） / 不可判定 2（AC-02 drill 段、AC-25 host-open 段） / 部分 2（AC-01 lastAction、AC-34 未跑全量）。**

**必查三项结论**：
1. **F3-01 的投影口径**：已闭合；A-1 第 1~7 行均能由真实 `buildRoleInstances` 产出（§8.3）。
2. **F3-03 的 AC-29**：原缺的子流程点击与红色连接线已补；但仍缺 Then 3/4 的 Given 构造与 ⑥→⑦ 的返回动作（F4-03）。
3. **AC-50 的构造**：`state-b.json` 可替换，但「既有断开/自动重连」没有 drill 分支（`app.js:1477` 只认 `view === 'graph'`）；AC-50 不能按 v4 文字执行（F4-04）。

---

## §7 本轮清单 F4-01 …

> 严重度：`阻断` = 落在本轮四类边界内（内部自相矛盾 / 与基线或规划逐字冲突 / 判据不可判定 / 覆盖面缺漏），不修不能进入 S1；`建议` = 不阻断，留给 S1 拆分 §7 风险 / S2 实现期处理。

### 阻断项

**F4-01｜BR-06 / AC-08 把基线 489 的 8 档卡片排序折叠成 7 档，`assigned` 被抬到 `review` 之前**
- **位置**：BR-06（364）；AC-08（498–507，`rank` 数组 505）；D-2（1479）；A-0（1050）；基线 `docs/index.md:489`。
- **原文**：`BR-06：卡片排序固定为 已升级 > 失败 > 执行中 > 待校验 > 可调度 > 被阻塞 > 已完成；... assigned 与 running 同落「执行中」档`；`AC-08：rank 序列为 [1,2,3,3,4,5,6,7,7]`；基线 489：`按节点状态排序：escalated > failed > running > review > assigned > ready > blocked > done`。
- **违反**：基线 489 是**卡片排序**的逐字规则（不是显示词）；基线 166 的「`assigned` 归入 `running` 列」只约束**看板列**，不能推出卡片排序也折叠。v4 用看板列折叠解释卡片排序，改变了 `assigned` 与 `review` 的相对优先级，且没有裁决留痕。
- **建议修法**：恢复基线 489 的 8 档排序（`assigned` 在 `review` 之后、`ready` 之前），显示词仍可用「执行中」；AC-08 的期望顺序改为 `T-010 → T-011 → T-013 → T-014 → T-012 → T-015 → T-016 → T-017 → T-018`，`rank` 改为 `[1,2,3,4,5,6,7,8,8]`；或由主控裁决「卡片排序采用 7 档」并写入 `decisions.md`，再回改 BR-06/AC-08/D-2/A-0。
- **严重度**：**阻断**。

**F4-02｜A-5 / AC-19 的 `HO-010` 行时间与同一包时间线自相矛盾**
- **位置**：A-5（1198–1200）；§2.10（240）；AC-19（625–626）。
- **原文**：A-5 `交接 HO-010 · 第 3 轮 · 已投递 · 09:12:40`；同一节时间线 `时间线 09:12:40 已构造` / `时间线 09:12:41 已投递`；§2.10 `按最近活动倒序，每行 交接 HO-010 · 第 3 轮 · 已投递 · 09:12:40`。
- **违反**：如果行时间是「最近活动」，`HO-010` 的最新状态是 09:12:41 已投递，行时间应为 09:12:41；如果行时间是「构造时间」，正文的「按最近活动倒序」与逐字行会让用户把 09:12:40 读成最近活动。两种读法只能选一种，当前无法同时成立（内部算术不自洽）。
- **建议修法**：把 A-5 行时间改为 `09:12:41`，AC-19 的 Given 同步改为 `09:12:41`；或在 A-5/§2.10 明写「行时间为构造时间，排序按最近活动」并补一条机检断言；二选一，全文统一。
- **严重度**：**阻断**。

**F4-03｜AC-29 的 Given 未构造 Then 3/4 所需的证据、摘要、原因与缺陷；When ⑥→⑦ 缺一次返回**
- **位置**：AC-29（736–753；Given 741；When 742；Then 746–747；机检 751；夹具 752）。
- **原文**：`Given ... 异常面在 Given 里就造全：① T-003 已升级、实例 suspended、1 条 pending 升级；② ... HO-008 rejected`；`Then 3 节点详情四段齐全，证据段至少 1 条可解析、摘要给出退出码`；`Then 4 升级面板列出 ESC-001，原因与缺陷可见`；`When ⑥ 点「继续」并确认 → ⑦ 点 S-001 折叠组进入子工作流`。
- **违反**：Given 只造了升级、`suspended`、`rejected` 交接；没有 `execution.summary`（命令/退出码/日志引用）、没有可解析的 `artifactRefs`/证据条目、没有 `reasonDetail`/`defects`。Then 3 的「证据段至少 1 条可解析、摘要给出退出码」和 Then 4 的「原因与缺陷可见」没有对应的 Given 构造，S3 无法按需求复现。另，⑥ 仍在升级面板内，⑦ 要点 `S-001` 折叠组必须先回到流程图，When 没有这一步（机检 probe 有 `graph-returned`，但 When 文本未写）。
- **建议修法**：在 Given 增写 `T-003` 的 `execution.summary`（`command/exitCode/keyOutputLines/logRef`）、至少一条存在文件（如 `artifacts/code/calc.js`）与一条缺陷引用（如 `defects/d1.md`）、`ESC-001` 的 `reasonDetail` 与 `defects`；在 When ⑥ 与 ⑦ 之间加「点返回流程图」；机检 probe 序列同步（`continued → graph-returned → subflow-shown` 已含，可保留）。
- **严重度**：**阻断**。

**F4-04｜AC-50 的「既有断开/自动重连」路径只覆盖 `view === 'graph'`，下钻 `view === 'drill'` 时不存在**
- **位置**：AC-50（979–988；Given 983–984；机检 986；夹具 987）；`desktop/ui/app.js:1477`（`current.view === 'graph'`）；`desktop/ui/app.js:1463-1472`（list stream）/ `1488-1495`（graph stream）/ `1444-1451`（`scheduleReconnect`）。
- **原文**：`让既有推送连接进入断开态（createApp 的 onStatus('closed') 分支，app.js:1463-1472 实点——connection.disconnect() 后 scheduleReconnect() 在 1 秒后调 ensureStreams() 重开图流（app.js:1444-1451），图流同样在 app.js:1488-1495 走这条分支）`。
- **违反**：`ensureStreams()` 只在 `current.view === 'graph'` 时打开 `/instances/:id/graph/stream`（`app.js:1477`）；AC-16 已把下钻定为 `view === 'drill'`。下钻视图没有这条图流，断开后 `scheduleReconnect()` 不会重开 drill 的订阅，AC-50 所称的「既有路径」在 `view === 'drill'` 下不成立。若 S2 新增 drill 订阅/重连，则这是**新建接缝**，不是「既有路径」，需求必须按契约登记并写明；若不新增，AC-50 的 Given 不可构造。
- **建议修法（择一，写进需求与 D-1/D-14）**：
  1. 在 `app.js` 新增 drill 视图的 stream 分支（明确这是新增调用点，补 `契约：desktop/ui/app.js::drillStream` 或等价登记），AC-50 的 Given 改为「drill 流断开 → 重连 → 首帧 `graph.snapshot`」；
  2. 用 `createApp({ io })` 的可注入 `openStream` 在 `drill-live.test.js` 中模拟 drop + refetch，并把它登记为契约；
  3. 若两者都不做，AC-50 只能改成「重新进入下钻」的静态构造，不能再写「下钻期间断开/自动重连」。
- **严重度**：**阻断**。

### 建议项（留给 S1 拆分 §7 风险 / S2 实现期处理）

- **F4-05｜`lastAction` 期望对象缺 `stateSince`**：AC-01（428）/AC-04（461）/AC-37（843）的 deep-equal 期望对象只有四字段，A-1（1078）/§2.3（134）的投影含 `stateSince`；建议改为子集断言，或补齐 `stateSince`。
- **F4-06｜AC-20 的空态词与 A-4 不一致**：A-4（1184–1187）是 `时间线 无记录` / `摘要 无记录` / `证据 无记录` / `交接 无记录`；AC-20（636）写「记录 无」；建议统一为 A-4 的逐字行，并给交接行补 A-4 的时间字段。
- **F4-07｜AC-21 的原因/缺陷未在 Given 钉住**：Given（645）只有两条 pending 升级，Then（647）/机检（648）要求 `原因：<原文>` 与缺陷行逐字；建议在 Given 写 `reasonDetail` 与 `defects` 的字面值。
- **F4-08｜基线 450「服务节点 = 当前绑定节点 ID 列表」与 v4 的 `servingNodes` 口径**：v4 已选服务中口径且与 10a 一致，但正文只写「与流程图同口径」，没有逐字对照基线 450；建议补一句，避免 S1 按「全部绑定节点」实现。
- **F4-09｜AC-51 标题措辞**：标题「基线 477 的连线侧落点」容易被读成「遵循 477 的连线侧」；建议改为「基线 477 连线侧的改道判定」，与 §2.10/BR-43 一致。
- **F4-10｜AC-28 的「40 次导航动作」仍在 Then**：NF-4/U-16 已标内部指标，但 Then 仍出现 40 次；建议把 40 次移到机检操作定义，Then 只留「连续导航后不崩、不重启、三处不变、无重复加载感」。
- **F4-11｜零命中/文件存在性锚点未按 `契约：` 登记**：§3.1 规则 6 声称所有新建产物锚点属第 ② 类，但 `grep … desktop/ui/drill/`、`test -f test/wp14/…` 未写成 `契约：`，也未进 D-14；建议在 D-14 补登记或在 AC 标「S2 前未落地不计通过」，避免 S3 把 `exit 2` 当失败。
- **F4-12｜AC-41/AC-39 的静态扫描过严**：AC-41（889）禁 `undefined` 会误杀 `value === undefined` 一类正确写法；AC-39（867）禁 `pending` 会误杀在卡片层做显示分支的写法；建议改为「输出文本不含 undefined/null」「DAG/卡片状态来自投影」的行为断言。
- **F4-13｜AC-50 的「DAG 保留」与 §2.14「重新取一份完整数据」的关系**：建议明写「绑定归零时 DAG 保留上一帧、卡片与状态栏按新快照更新」的局部更新规则，否则 S2 可能按完整替换把 DAG 清空。
- **F4-14｜AC-42/AC-43 的滚动指标无 DOM 承载**：`scrollElapsed ≤ 200ms`、`anchorRowTop ≤ 1px` 在纯模块面只能是模型坐标；建议在 D-9 写明最小滚动模型，或明确这些是模型断言、不改用户可见结论（§9-2）。

---

## §8 实跑命令与输出摘要

### 8.1 编号、字段与 BR 双向覆盖

```bash
grep -cE '^\*\*AC-' docs/iterations/iteration-10b/requirement.md          # 51
grep -cE '^- \*\*BR-' docs/iterations/iteration-10b/requirement.md         # 43
grep -cE '^- \*\*NF-' docs/iterations/iteration-10b/requirement.md         # 7
node -e "…按 ^\*\*AC- 切块检查 场景类型/风险/引用/Then/机检/夹具/架构检查…"
# blocks 51；AC-02/25/30 的「架构检查（四条/两条）」为变体，字段均在
node -e "…BR 双向…"   # BRs 43 / uncited: none / phantom: none
grep -nE "待补充|TBD|TODO|XXX|\[需求标题\]|填写指引" …   # 零命中（exit 1）
```

### 8.2 既有代码锚点实点

```bash
grep -REn "createViewState\(" desktop/ui/app.js
# 396: / 462:（2 条，exit 0）
grep -REn "createViewState\(" desktop/ui/drill/         # exit 2（目录未创建）
grep -n "state.viewState = null" desktop/ui/app.js       # 417
grep -n "current.view === 'graph'" desktop/ui/app.js     # 1477
grep -n "function retry\|status !== 'failed'" desktop/ui/connection.js
# 172: retry() {；173: if (status !== 'failed') return status;

grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js   # 23 / 137
grep -n "DESKTOP_BOARD_COLUMN_" src/daemon/http/labels.js          # 101–107（7 列）
grep -REn "applyTestOverlay" src/daemon/http/stream.js src/daemon/http/server.js
# stream.js:255 / 650；server.js:318
grep -n "overlay.roles.set\|overlay.edges.set\|node.status = patch.status" src/daemon/http/stream.js
# 586 / 596 / 263
grep -n "test.escalate" src/daemon/server.js                        # 345
grep -n "state.state !== 'suspended'" src/core/orchestrator.js       # 5051
grep -n "state.state = 'suspended'" src/core/escalation.js           # 153
grep -n "EXPECTED_DESKTOP_KEYS\|EXPECTED_DESKTOP_VALUES\|147, '新增" test/wp13/labels-desktop.test.js
# 63 / 131 / 310
```

### 8.3 真实 `buildRoleInstances` 投影实跑（F3-01 闭合与 A-1 可产出性）

```bash
node --input-type=module <<'EOF'
import { buildRoleInstances } from './src/registry/role-instances.js';
// AC-01：T-001 running / T-002 review / T-003 done；会话 thinking(dsh)、waiting_dependency(cursor)、idle(dsh)
// AC-04：T-001/T-002/T-003 三服务中节点 + 3 条非空闲会话；T-010 pending；协调者 0 绑定
// AC-37：external-auditor 两绑定节点（T-020 pending、T-021 running）+ thinking(dsh)
EOF
# AC-01 => busy / ["S1","S2"] / ["T-001","T-002"] / ["dsh","cursor"] / T-002 2/3 review
# AC-04 => developer busy/3/["T-001","T-002","T-003"]/["dsh","cursor"]/T-002 2/3 review
#          tester available/0/[]/[]/T-010 1/1 pending
#          coordinator inactive/0/[]/[]/null
# AC-37 => unavailable/1/["T-021"]/["dsh"]/T-021 1/1 running
# A-1 第 5/6 行 => reviewer unavailable/1/[]/[]/T-020 2/2 escalated；writer cooldown/0/[]/[]/T-002 1/2 done
```

### 8.4 文案与纯净扫描

```bash
grep -REn "已关闭" desktop/ui desktop/harness          # 0（exit 1）
grep -REn "git_push" desktop/ui                         # 0（exit 1）
grep -REn "execution\.summary" desktop/ui               # 0（exit 1）
grep -REn "已过期|过期" desktop/ui                      # 0（exit 1）
grep -REn "DeepSeek Harness" desktop/ui                 # 0（exit 1）
grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/ui        # 0（exit 1）
grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/harness   # 0（exit 1）
grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" src/core src/daemon src/cli
# escalation.js:89 / orchestrator.js:5049,5052 / labels.js:336,339 / main.js:1554 / render.js:1125（8 条）
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>   # exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词> # exit 0
node -p "JSON.stringify(require('./package.json').dependencies||{})"      # {}
node -p "Object.keys(require('./src/daemon/http/labels.js').UI_LABEL_KEYS).length" # 147
```

### 8.5 跨迭代与平台事实

```bash
ls test/wp13/*.test.js | wc -l                            # 36
wc -l docs/iterations/iteration-10a/baseline-failures-win32.txt  # 35（登记项 16 条，行 20–35）
node -p "require('./docs/iterations/iteration-10a/summary.json').gate.tests"  # 1425
git rev-parse --short HEAD                                # 66e5a6b
cargo --version                                           # command not found
ls "$LOCALAPPDATA/Programs/DeepSeek Harness/DeepSeek Harness.exe"  # 存在
```

### 8.6 未实跑项（不冒充已跑）

- **全量 1425 条串行测试**：未跑；按裁决 G 与 `summary.json` 的 `gate.tests=1425` 只核基数与允许集合；跑全量会写 `docs/iterations/iteration-4/evidence/**`，与「唯一可写 review-round4.md」冲突。
- **`desktop/ui/drill/**`、`src/daemon/drill.js`、`src/adapter/host-open.js`、`test/wp14/**`、`probe/**`**：S2 未开工，涉及它们的零命中/文件存在性锚点记 `exit 2` 或契约未落地，不记通过。
- **真实 DSH 窗口前置 / 剪贴板实际内容**：本机无 Rust/MSVC，按裁决 B 属人工核验项；只核了 DSH 可执行文件存在与 `cargo` 缺失（§8.5）。

---

## §9 最可疑但无法证伪的点（供主控判断，未计入 F4）

1. **AC-50 的「替换 `state.json` + 断开/自动重连」能否在真实核心上稳定复现。** 即使补了 drill 流，核心可能缓存/回写状态，`state-b.json` 的 `rev` 也可能被核心的后续写入覆盖；需求说「夹具动作，不主张产品可达」，但没有给出核心不会覆盖的证明。建议 S2 先做一次最小实验，再决定 AC-50 是否保留「第二份快照」写法。
2. **AC-42 / AC-43 的滚动类指标在「不访问 DOM」的纯模块面上如何测得真实值。** `scrollElapsed ≤ 200ms`、`anchorRowTop` 前后差 ≤ 1px 只能是注入时钟 + 模型坐标；用户可见的「能滚到最后一条、不卡顿」缺乏真实 DOM 承载。建议 S2 在 D-9 明确最小滚动模型，或把这两条降为模型断言并另设人工核验。
3. **「会话标识 == `state.sessions[].sessionId`」与「在 DSH 中按标识定位」之间的最后一公里。** 裁决 I 已把「目录同名」降为待验事实，AC-25 只判「标识 == `state.sessions[].sessionId`」；如果用户在 DSH 里按该 UUID 无法定位（目录名/ID 空间不同），产品体验仍会落空。该风险已在 U-15 / D-14 C1 登记，但本机未实测，无法证伪。
