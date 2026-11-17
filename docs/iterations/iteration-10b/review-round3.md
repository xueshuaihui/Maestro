# I1.10b 需求评审记录 · Round 3

- **评审对象**：`docs/iterations/iteration-10b/requirement.md`（**v3**，1552 行；AC-01~AC-49 / BR-01~BR-42 / NF-1~NF-7；头部「版本：v3」，附录 C 末条为 v3）
- **评审角色**：需求评审工程师（干净上下文，只读）。未读撰写/修复方的自述与自查表，只按判据与产物独立判断；上一轮 `review-round2.md` 仅用于逐条复核 F2-01~F2-18，不作为本轮「正确答案」。
- **判据来源**：`docs/index.md` 第一部分（§1 定位 / §3 四层状态模型 9·6·6·7 态 / §4 六个能力域 / §5 运行时与数据布局 / §6 边界声明）、第二部分 `#### I1.10b`（861–874）/ `#### I1.10a`（840–857）/ `#### I1.11`（878–888）/ `#### I1.12`（892–907）/ 阶段一退出条件（911–913）、`docs/templates/requirement-template.md`（8 节 + 三条硬约束）、`docs/templates/execution-template.md` §1.0.3 / §1.1（13 条 DoR）/ §1.2、`docs/iterations/iteration-10b/decisions.md`（**裁决 A~G，效力最高**）
- **只读声明**：唯一写入为本文件；未改 `requirement.md`、`decisions.md`、`docs/index.md`、模板、`src/**`、`test/**`、`desktop/**`。
- **复核方式**：实跑，不采信需求自述。环境：Windows 11 / Git Bash / Node v22.22.2；分支 `feat/i1.10b-drilldown`，HEAD `66e5a6b`（工作区 `src/**`、`test/**`、`desktop/**` 无改动）；共 24 组机检/投影实跑（§6）+ 1 次全量串行测试（§8.6）。

---

## §0 总判

**总判：FAIL。**

- **阻断 5 项 / 建议 10 项**（F3-01~F3-05 阻断，F3-06~F3-15 建议；见 §7）。
- **上轮 18 项三态**：**已修 16 / 未修 0 / 修了但引入新问题 2**（F2-08、F2-18）。
- **规划覆盖**：13 行（10 子项 + 验收句 3 段）**覆盖 13 / 部分 0 / 缺漏 0 / 越界 0**（§2）。第 8、9、13 行按裁决 C / 裁决 A 记「一致」，正文均已显式标注偏离，未自称逐字达成。
- **形式面全绿**：AC 49 条连续无重号、七类字段 49/49 齐全；BR 42/42 双向覆盖（无未引用、无幻引用）；附录 A~D 齐全、头部 v3 与附录 C 一致、无括号指引残留；`dependencies` 仍为 `{}`，两处 31 词纯净扫描均 `exit 0`。
- **基线面全绿**：全量串行 `tests 1425 / pass 1400 / fail 16 / skip 9`（与 10a 的 `tests=1425` 相等）；16 条失败差集 = 0（13 条命中 win32 登记项 + 1 条 AC-04 允许项 + 2 条登记外且已定性为环境限制 / flake），详见 §8.6 与文末附表。
- **本轮 FAIL 的性质变了**：v2 的四个阻断是「判据写得不可判定」，v3 已把 AC-34 / A-3 / AC-36 / §3.3 修好；**v3 剩下的阻断全部是「判据写得漂亮，但在当前仓库的事实上不成立」**，集中在四条：
  1. **角色状态栏的「服务节点 / 宿主 / 状态词」与既有投影不自洽**——用 AC-01 的 Given 跑真实 `buildRoleInstances`，得到 `servingNodes=["T-002"]`、`hostIcons=["cursor"]`，而 AC-01 要求 `服务 T-001 等 3 个`、`宿主 dsh cursor`（§6 #21）；AC-37 / AC-04 ② 同因（§6 #22/#23）。A-1 第 2/5/6 行本身也不是这套投影能产生的形态。
  2. **测试接缝 `POST /__test__/graph/pulse` 的作用范围够不到下钻投影**——它只 patch 图快照的 `node.status` 与边 `aggregateStatus`（`src/daemon/http/stream.js:255-275,586`），不改 `servingNodes` / `cards` / 卡片的交接聚合；而 D-2 要求下钻投影「直接取 `buildRoleInstances` 的投影字段」。因此 AC-27 / AC-43 / AC-47 / AC-48 依赖的「脉冲 → 下钻变化」没有数据链，AC-48 的「清空角色绑定」更是接缝根本不支持的动作。
  3. **AC-29 的 When 与 Then 不对齐**：Then 第 7 条与机检 probe 序列要求 `subflow-shown`，但 When 的六步里没有「点击子工作流折叠组」；Then 第 1 条要求「红色/橙色连接线」，Given 也没构造。
  4. **AC-23 ② 的构造路径不成立**：`workflow resume` 的守卫要求 `disk.state==='running' && halted!==true`（`src/core/orchestrator.js:4689-4695`），而升级挂起后 `state='suspended'`（`src/core/escalation.js:153`）——被挂起实例无法被 resume 成「运行中」，「运行中 + 待处理升级」只能靠直接改 `state.json`，而这正是该 AC 自己排除的做法。
- **另有一处夹具工具选错**：AC-01 用 `desktop/harness/collect.mjs` 产 `graph.json`，该脚本只取 `GET /instances` + `GET /ui/labels`，输出 `{items, labels}`，不含图（`desktop/harness/collect.mjs:80-87`）；产图应用 `graph-dump.mjs --project --instance`。

---

## §1 上轮 FAIL 逐条复核（F2-01~F2-18）

> 三态口径：`已修` = 原判据按上轮要求闭合（涉及裁决 A~G 的以 `decisions.md` 为准）；`未修` = 原问题仍在；`修了但引入新问题` = 原判据看似闭合，但修法本身产生新的不可执行 / 不可构造。

| # | 判定 | v3 落点（行） | 证据（实跑或原文） |
|---|---|---|---|
| F2-01 | **已修** | AC-34 795–802；§3.3 994–1001；§1.3 78；NF-6 976 | 已删除「36 个文件逐个 `# fail 0`」；改为「`tests ≥ 1425` + 失败集合∖允许集合 = ∅ + 集合外必须 `# fail 0`」，并显式豁免 `http-channel`（lsof）与 `readonly-local`（AC-27）。实跑：两文件各 `# fail 1`（§8.5），二者确在 `iteration-10a/baseline-failures-win32.txt` 第 25/26 行（该文件登记项实点 16 条，行 20–35）。`ls test/wp13/*.test.js` 36，AC-34 点名 36/36 精确匹配（§8.4）。 |
| F2-02 | **已修** | §3.3 994–1001（尤其 997） | 只记「取数时间 + 唯一命令 + 三次观测 1425/21·15·14 + 成员双向翻转 + 三段式判定公式 + 两条稳定红」，并明写「本文件不对失败原因作归因」，HANDOFF_EVIDENCE_ESCAPE 列为平台/安全类；无「单次数字 = 结论」。与裁决 G 一致。 |
| F2-03 | **已修** | A-3 1103；A-3 说明 1114；AC-10 519–524 | A-3 新增 `卡片 U-001 · 播报确认 · 轮次 1/1 · 待执行`，并写明共 11 行（正常 3 / 空值 3 / 特殊 3 / 未知类型 1 / 未知状态 1）、AC-07 断 6 行、AC-10 断 5 行；AC-10 Given 逐项钉住 5 个节点的编号·类型·标题·轮次·状态，Then 与机检同为这 5 行。 |
| F2-04 | **已修** | AC-36 815–824 | Given「四层定义链（3 个 workflow 引用）」、Then「面包屑段数 1/2/3/4」、机检「`[1,2,3,4]`、`returnCount === 3`」，三者自洽，无 5 段/4 次残留。 |
| F2-05 | **已修** | AC-02 436 ① | 实点 `grep -REn "createViewState\(" desktop/ui/app.js` → `396:` / `462:`；读 `app.js:389-402` 确认 396 在 `rebuildGraph`（autoCollapse→computeLayout→新建，沿用 zoom/pan 并 `applyOffsets`），`app.js:455-466` 确认 462 在 `toggleGroup`。描述与代码一致。 |
| F2-06 | **已修** | AC-02 436 ③ | 禁项改为 `openGraph\(|rebuildGraph\(|replayGraph|reapplySnapshot`，并说明「帧名 `graph.snapshot` 可作为订阅键出现」，与 U-13 不再互斥。 |
| F2-07 | **已修** | AC-03 447；AC-04 458；AC-32 776；A-10 1282 | 四处统一为「daemon 下发键 + 结构化数据、不拼整句中文；drill 按键取值并拼行；中文值只在文案表」；AC-03 的锚点落为「`statusReason|decideStatus` 在 drill 零命中」+「`ROLE_INSTANCE_STATUS_LABEL` 在 daemon 侧 ≥1」，互不排斥（实点 23/137 两条，§8.2）。 |
| F2-08 | **修了但引入新问题** | AC-04 453–458 | Given 已钉字段，但 ② 写成「0 条会话、**无绑定节点**、宿主 `mock`、状态「可用」、`最近 —`」，Then 又要求逐字等于 A-1 **第 2 行**。实测该组合不可产生：`decideStatus` 在 `boundCount===0` 时返回 `inactive`（`src/registry/role-instances.js:58`），`hostIconsOf` 无 serving 节点时返回 `[]`（同文件 73–84），`lastActionOf([])` 为 `null`。→ **F3-01**。 |
| F2-09 | **已修** | AC-19 618–621；A-5 1175；§2.10 240 | 4 个交接包（`HO-010` 与并行 `HO-011` 同为第 3 轮）→ 列表 4 行；A-5 写明「`N 并行交接` 不合并行、行数恒等于包数」；全文无「3 行 + parallelCount 2」残留。 |
| F2-10 | **已修** | AC-28 720–722；NF-4 974 | 40 次动作（10+10+10+10）、取数 30（10+10+10）、`fetchCount ≤ opCount`、`maxFetchesPerView === 1`，算式自洽；「43 次」已删。 |
| F2-11 | **已修** | AC-43 898–899 | 改为「`HO-010` 作为**锚点行**保持视口内相对位置不变（允许 `scrollTop` 补偿）」，机检 `|anchorRowTop 差| ≤ 1` 且 `scrollTop` 只记录不判方向。 |
| F2-12 | **已修** | AC-47 943 | 机检由 `≤3000` 收紧为 `≤2000`，与 Then「2 秒内」同阈值（属收紧，不违反 §1.2）。 |
| F2-13 | **已修** | AC-42 887–888；§2.10 245；D-8 1487；§2.12 277；§2.13 303 | AC-42 的 Then 只留「能滚到最后一条且行正确、不出现空白行」；`renderedRows < 60` 移入机检并标「内部断言」、D-8 单列；§2.10 已删「虚拟滚动」；§2.12/§2.13 的实现细节改为指 D-3 / D-4。 |
| F2-14 | **已修** | §2.15 338–339 | 静态形态归 AC-31、动态形态归 AC-48，并新增「下钻期间角色不再参与」条目。 |
| F2-15 | **已修** | §2.11 260–261；A-8 1227/1238；AC-49 958–967；BR-42 398 | 角标入口已写进 §2.11 用户操作与预期效果，A-8 增 `实例 INST-001 / 升级处理` 并说明，AC-49 断言 `view==='escalation-panel'` 且 `view!=='drill'`。**残留**：基线 477 的「红色/橙色连接线 → 升级处理面板」一侧仍未落点 → **F3-12**（建议）。 |
| F2-16 | **已修（附事实小瑕）** | AC-23 667；D-3 1436 | 事实口径改为「码由核心/CLI 产生、daemon 新增映射字面量、码不越过界面层」，扫描改为 ①`desktop/ui` 零命中 ②`drill` 内 messageKey ≥1 ③`src/core src/daemon src/cli` ≥1 ④`desktop/harness` 零命中。实测 ①②④ 现状成立、③ 现有 5+3 处（§8.3）。**行号引用不全**（漏 `src/cli/labels.js:336`、`src/cli/render.js:1125`；`main.js:1552` 是注释而非码）→ **F3-15**（建议）。 |
| F2-17 | **已修** | AC-22 654–655 | 改为「同一份初始快照复制两份，夹具 A 走界面、夹具 B 走 CLI，各只跑一次」，并写明同一夹具先后跑会命中 `ESCALATION_NOT_PENDING`。与 `src/core/escalation.js:89` 的拒绝语义一致。 |
| F2-18 | **修了但引入新问题** | AC-48 947–956；BR-41 397 | 缺 AC 的问题在形式上闭合（新增 AC-48 / BR-41，接续编号），但 AC-48 的 When「用 pulse（`kind:"role"`）让角色节点绑定清空」在接缝上不存在：`handlePulse` 只 `overlay.roles.set(key,{status})`（`stream.js:586`），`applyTestOverlay` 只改 `node.status`（`stream.js:259-264`）。→ **F3-02**。 |

**统计：已修 16（F2-01~F2-07、F2-09~F2-17）；未修 0；修了但引入新问题 2（F2-08、F2-18）。**
**回归检查**：v3 的其余改动没有改坏前两轮已 PASS 的条目——AC-01/05/07/08/10/11/19/22/25/34/36 的 Given 与逐字基线、A-3~A-8 的文案基线、BR 双向覆盖均保持；被改坏的只有 AC-04（F2-08 的修法）与新增的 AC-48（F2-18 的修法）。

---

## §2 规划原文逐句覆盖表（强制）+ 反向扫描

> 规划原文逐字摘自 `docs/index.md` 861–874 行；「符合性」取 `一致 / 收窄 / 降级 / 越界`；「覆盖判定」只取 `覆盖` 为 PASS。

| # | 规划原文（逐字 + `index.md` 行号） | 需求 §2 落点 | 需求 §3 落点 | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | `角色下钻视图：局部 DAG（1 跳）+ 任务卡片列表`（863） | §2.2（102）/ §2.4（136）/ §2.5（153） | AC-01、AC-05、AC-07、AC-38、AC-39、AC-40 | 一致 | **覆盖**（锚点缺陷见 §6 #21，不影响「已落点」） |
| 2 | `任务卡片三层信息 + 会话状态指示器 + 节点类型特殊显示`（864） | §2.5（153–171） | AC-07、AC-09、AC-10、AC-41 | 一致 | **覆盖** |
| 3 | `DAG 与卡片联动：点击 DAG 节点滚动到对应卡片`（865） | §2.6（173–184） | AC-06 | 一致 | **覆盖** |
| 4 | `点击卡片进入节点详情（会话状态时间线、ACP 事件摘要、证据引用、交接包历史）`（866） | §2.7（186–202） | AC-11、AC-12、AC-13、AC-14、AC-15 | 一致 | **覆盖** |
| 5 | `“查看全部节点”切换：切换到全实例节点看板（7 列）`（867） | §2.8（204–214） | AC-16 | 一致 | **覆盖** |
| 6 | `` `subworkflow` 下钻：点击折叠组节点进入子工作流角色流程图 ``（868） | §2.9（216–230） | AC-17、AC-18、AC-36 | 一致 | **覆盖** |
| 7 | `连接线点击展开交接包列表 + 时间线`（869） | §2.10（232–247） | AC-19、AC-42、AC-43 | 一致 | **覆盖** |
| 8 | `特殊节点点击跳转人工任务/升级队列`（870） | §2.11（249–266）/ §2.12（268–283） | AC-20、AC-21、AC-24、AC-44、AC-49 | 一致（「升级队列」按**裁决 C** 落为**本实例**面板，§2.11 266 与 U-01 1303 已声明） | **覆盖** |
| 9 | `一键跳转宿主会话：从角色节点跳转到 DSH 对应会话`（871） | §2.13（285–303） | AC-25、AC-26、AC-33、AC-46 | 一致（**裁决 A** 三段口径；§1.3 63、§2.13 297、AC-25 684、AC-29 730 均标注「属裁决 A 的偏离说明」，未自称逐字达成） | **覆盖** |
| 10 | `角色状态栏（inactive/available/busy/cooldown/unavailable）`（872） | §2.3（121–134） | AC-03、AC-04、AC-37 | 一致（五词映射：未参与/可用/服务中/冷却中/不可用） | **覆盖**（AC-04/AC-37 的 Then 与投影不符 → §7 F3-01） |
| 11 | 验收句前段：`人在面板上完整走“角色流程图发现异常→下钻到角色→查看任务卡片→展开证据→处理升级→实例继续”，不需要终端`（874） | §2.15（321–353）/ §2.12 | AC-22、AC-29、AC-45 | 一致 | **覆盖**（AC-29 的 When/Then 不对齐 → §7 F3-03） |
| 12 | 验收句中段：`子工作流可下钻`（874） | §2.9（216–230） | AC-17、AC-36 | 一致 | **覆盖** |
| 13 | 验收句后段：`一键跳转能打开 DSH 对应会话`（874） | §2.13（285–303） | AC-25（**按裁决 A 的三段口径判定，未逐字达成规划原文该段**） | 一致（**裁决 A**：本机 `app.asar` 独立复核只识别 `dsh://open`/`dsh://open/`，版本 `0.2.2-rc.1`；§8.7） | **覆盖** |

**统计：覆盖 13 / 部分 0 / 缺漏 0 / 越界 0 / 收窄 0。**

### 2.1 反向扫描 ①：§2 功能点与 AC 反查规划来源（查夹带）

- §2.1 的 13 个功能点（§2.2~§2.14）逐条可追到规划 10 子项、验收句 3 段，或追到基线 §3.3 / §4 能力域 4·5 / §5.7 的具体条目；49 条 AC 亦同。**无规划之外的新能力。**
- 需说明的 4 处「非逐字来源」（均属基线派生，不构成越界）：
  1. §2.3 的五项顺序与折叠 → 基线 §5.2「角色节点视觉编码」（449–450）+ §3.3 `role_instance` 模型（208–220）；
  2. §2.12 的「继续」→ 验收句「处理升级→实例继续」+ 裁决 C（§1.3 54、U-08 1318）；
  3. §2.14 的实时/节流 → 基线 §5.7（514–530）；
  4. AC-48（角色中途退出）→ §2.14（317）+ 基线 §3.3/§5.7，属异常分支补齐（裁决 E 允许）。
- **唯一「量化目标无来源」的一处**：NF-4 的「40 次导航 / 30 次取数」既不在规划也不在基线，是需求自定的稳定性指标，且写进了 AC-28 的 Then（→ F3-06，建议）。它不构成新能力，不计夹带。

**结论：反向扫描 ① 无夹带。**

### 2.2 反向扫描 ②：基线状态词与能力域反查 §2 落点（查缺漏）

| 基线项 | §2 落点 | 判定 |
|---|---|---|
| 节点 9 态（129–168） | A-0（1017–1018）写明 9 态→7 显示词折叠（`assigned`→执行中、`pending`→待执行+档位拆分）；BR-06；AC-08 含 `assigned` 实例 | 覆盖 |
| 会话 6 态（170–193） | A-0 / A-3 指示器表（1118–1126）/ BR-08（6→5 标签 + 无会话） | 覆盖 |
| 角色 6 态（195–222） | §2.3 五词 + BR-02 + U-09（`retired`→`inactive`→未参与，`graph.js:110-118` 实点） | 覆盖（词映射一致；**但状态栏数据派生与既有投影冲突 → F3-01**） |
| 交接包 7 态（224–246） | A-0 七词、A-5 时间线、§2.10 聚合优先级（基线 395）、AC-19 | 覆盖 |
| 能力域 2「子工作流折叠」（342） | §2.9、BR-16/BR-32、AC-17/18/36 | 覆盖 |
| 能力域 4（365–412） | §2.10、§2.14、A-5、AC-19/42/43 | 覆盖 |
| 能力域 5 视图层次（416–439）/ 角色流程图（441–496） | §2.2~§2.8、BR-01~BR-15 | 覆盖 |
| 能力域 5.6 人工干预队列（509–512） | §2.11/§2.12 仅本实例、仅「继续」；跨实例队列在 §1.3 60 明确留 I1.11 | 覆盖（作用域按裁决 C） |
| 能力域 5.7 数据接口与实时推送（514–530） | §2.14 + §3.3 测试接缝（986）；U-13 | 覆盖 |
| §5.2 数据布局（600–614） | §2.7 证据/日志引用；§3.3 夹具写 `state.json`/`events.jsonl`/`traces.jsonl`；D-2 证据存在性 | 覆盖 |
| §5.2 交互 477「点击红色/橙色连接线**或** escalated 角标 → 跳转升级处理面板」 | 角标侧：§2.11 260 + AC-49 + BR-42（**已落**）；**连线侧**：§2.10 236 把任何连线点击都导向交接包面板（**改道**） | **落点存在但目标改道，未声明**（建议 F3-12；不判缺漏：规划 869 明确要求「连接线点击展开交接包列表」，两条基线本身冲突，需求依规划取舍） |
| §6 边界 5/7/9/10（624/626/628/629） | §2.3 134、§2.10 247、§2.12 283、§1.3 63 | 覆盖 |

**结论：无整体缺漏；一处改道未声明（建议级）。**

---

## §3 第二部分（A 符合规划 / B 罗列全面）

| 判据 | 结论 | 依据（行号 / AC） |
|---|---|---|
| **A①** 规划 10 子项逐字 → §2，不降级/收窄/换名/合并 | **PASS** | 子项 1~7、10 与 §2.2~§2.9、§2.3 语义一致；子项 8 的「升级队列」按裁决 C 落为**本实例**面板（§2.11 266、U-01 1303/1319），已声明；子项 9 与验收句后段按裁决 A 落为三段口径（§2.13 291–301、AC-25 684），并在 63 / 297 / 684 / 730 / 1551 行标注「属裁决 A 的偏离说明」，未自称逐字达成。 |
| **A②** 功能点六要素（操作/效果/异常/边界）与规划语义一致 | **PASS** | §2.2~§2.14 均六要素齐全；§2.5 的未知状态统一「被阻塞 + 状态未知」（168），与 `desktop/ui/board/board.js:192-198` 及 10a AC-35 同口径（裁决 D）；§2.13 四种降级与裁决 A 三段逐条对应（298–302）。 |
| **A③** 规划「范围外/留待后续」未被写成范围内 | **PASS** | 通知/跨实例队列/审批/重派/终止 → I1.11（60）；证据过期/指纹/治理/预算/生态/性能 → I1.12（61）；多宿主/Web → I2.4（62）；窗口级自动判定 → 裁决 B（64）；AC-24 断言面板只有「继续/取消」（675）。 |
| **A④** 向后兼容有落点 | **PASS** | §1.2 第 7 条（40）、§1.3 红线（73–78）、BR-28（384）、AC-34（789–802）、D-13（1522–1528）声明三条主链、CLI 格式、`USAGE_LINES` 25、I1.10a 44 条 AC 与 A-1~A-14 文案不变；AC-34 的判定已按裁决 G 改为「差集 = 0」，在本机可达成（§6 #19）。 |
| **A⑤** 无夹带 | **PASS** | 反向扫描 ①：0 夹带；NF-4 的量化目标属自定 NFR（F3-06，建议），不是新能力。 |
| **B①** 规划条目（10 子项 + 验收 3 段）↔ §2.1 / 对账表零缺漏 | **PASS** | §2.1 13 行（88–100）与文末对账表 13 行（1534–1548）逐项对应；10 子项全部有 §2 落点与 AC。 |
| **B②** 基线 §3/§4/§5.2/§6 相关处都有落点 | **PASS（1 建议）** | 见 §2.2：四层状态词、能力域 2/4/5、§5.7、§5.2、§6 均有落点；唯一改道是基线 477 的连线侧（F3-12）。 |
| **B③** §2.15 衔接覆盖验收句完整流程（含失败路径） | **PASS** | §2.15 十步（325–334）覆盖「发现异常→下钻→卡片→证据→处理升级→继续→看板→子流程→交接→跳宿主」；14 条中文降级分支（338–351）逐条挂 AC（AC-31/48/18/23/26/46/37/38–41/42/43/44/45/47），归因已按 F2-14 修正。 |
| **B④** 42 条 BR 覆盖每条用户可见规则 | **PASS** | 实跑 BR 42/42 双向覆盖：无未引用 BR、无引用不存在的 BR（§8.1）。 |

**§3 判定：PASS。**

---

## §4 第三部分（C 符合规划 / D 罗列全面）

| 判据 | 结论 | 依据（AC 号 / 行号） |
|---|---|---|
| **C①** 验收句逐字 → AC 且不被弱化 | **PASS** | 前段：AC-29（726–743，7 条逐条 + 「无终端」探针集合断言）；中段：AC-17（592–601）；后段：按裁决 A 由 AC-25（680–691）三段判定，AC-29 730 明示「不声称该语义已达成、也不声称被 AC-25 覆盖」。语义强度未被放宽。 |
| **C②** Given/When/Then 用户视角 | **PASS（1 建议）** | 49 条基本为用户视角；AC-28 的 Then 仍含「取数 = 一次回环 HTTP GET / 合计 30 次」（721）→ F3-06；AC-05/06/43 的 Then 残留 `bold: true` / `scrollTo` / `scrollTop`（466/477/898）→ F3-07。均属表述层，不改判定强度。 |
| **C③** 失败/异常/超限路径有 AC | **PASS** | AC-18（子流程读不到/循环/空）、AC-23（升级已处理/实例未挂起）、AC-26（三种降级）、AC-31（四类运行期异常）、AC-45（继续失败）、AC-46（唤起失败）、AC-48（下钻期间角色退出）、AC-37~AC-44（DAG/卡片/长列表/空态边界）——§2 的异常分支均有 AC 落点（形式面；AC-48 的可构造性见 F3-02）。 |
| **C④** 每条 AC 三件套 + **可执行锚点** | **FAIL** | 机械上 49/49 都有 `场景类型/风险/引用/Then/机检/夹具/架构检查`（§8.1），但有 5 处锚点在当前仓库事实上不成立或不可构造：**AC-01**（Then 的「服务 T-001 等 3 个 / 宿主 dsh cursor」与 Given 经真实投影不符；夹具用错脚本）、**AC-04**（② 的组合不可产生）、**AC-37**（「服务 T-020」不可产生）、**AC-23 ②**（构造路径不可达）、**AC-29**（When 缺一步、Then 第 1 条未构造）、**AC-48**（接缝不支持清空绑定）。见 §7 F3-01~F3-05。 |
| **D①** §2 每个功能点（含异常/边界）→ ≥1 AC | **PASS** | §2.2→AC-31/37；§2.3→AC-03/04；§2.4→AC-05/38/39/40；§2.5→AC-07/09/10/41；§2.6→AC-06；§2.7→AC-11~15；§2.8→AC-16；§2.9→AC-17/18/36；§2.10→AC-19/42/43；§2.11→AC-20/21/44/49；§2.12→AC-22/23/45；§2.13→AC-25/26/33/46；§2.14→AC-27/47/48。 |
| **D②** 规划每条目 → ≥1 AC | **PASS** | 13 行对账全部有 AC；子项 8 的裁决 C 形态由 AC-20/21/24/44/49 判定。 |
| **D③** BR 双向覆盖 | **PASS** | 42 条全部被引用、无幻引用（§8.1）。 |
| **D④** §3.2 非功能、§3.3 前置齐全且用户视角 | **FAIL** | NF-1~NF-7 齐全，NF-4/NF-6 有锚点（AC-28/AC-34）；但 **NF-4 把「取数 = 一次回环 HTTP GET、合计 30 次」写成用户可感知指标**（974），属接口层指标，不是「用户感知」；§3.3 另有三处技术性前置（984/986/999）——后者沿用 10a 项目实践可接受，前者不成立。→ F3-06。 |
| **D⑤** AC 编号连续无重复 | **PASS** | `grep -cE '^\*\*AC-'` = 49；AC-01~AC-49 连续、无重号（§8.1）。 |

**§4 判定：FAIL（C④、D④）。**

---

## §5 基线与模板合规 + 新增 AC/BR 依据审查

### 5.1 E1 用户视角（模板硬约束 1 / 2）

- §2 基本为用户语言；§2.12 的实现口径已改为指 D-3（277）、§2.13 的 asar/headless 细节已改为指 D-4/U-02（303），§2.10 已删「虚拟滚动」（245）。**PASS**。
- 第三部分：AC-28 的 Then 仍写「取数 = 一次回环 HTTP GET / 合计 30 次」（721）——**违反硬约束 2**（Then 必须用户可见）；AC-05/06/43 的 Then 有 `bold: true` / `scrollTo` / `scrollTop`（属轻微）。→ F3-06 / F3-07（**建议**，不单独构成阻断）。

### 5.2 E2 状态词与基线一致性（重点）

| 层 | 基线 | 需求 | 判定 |
|---|---|---|---|
| 节点 | 9 态（129–168） | A-0 明确 9→7 显示词折叠（`assigned`→执行中、`pending`→待执行 + 档位另拆）；BR-06 同口径 | **PASS**（显示折叠，不是收窄） |
| 会话 | 6 态（170–193） | 6→5 标签 + 「无会话」；`thinking`/`tool_running` 共用执行中、后者带工具图标（BR-08 / A-3 1118–1126） | **PASS** |
| 角色 | 6 态（195–222） | 五词 + `retired`→`inactive`→未参与（U-09、`graph.js:110-118` 实点） | **词表 PASS；数据形态 FAIL** |
| 交接包 | 7 态（224–246） | A-0 七词、A-5 时间线、聚合优先级按基线 395 | **PASS** |
| 看板列 | 7 列（166） | AC-16 列名/顺序与 `src/daemon/http/labels.js:101-107` 逐字一致（实点，§8.2） | **PASS** |

**角色状态栏一项判 FAIL 的事实（本轮新增，实测）：** 用 AC-01 的 Given（`T-001` 已完成 / `T-002` 待校验 / `T-003` 待执行，3 条非 idle 会话，宿主 dsh/cursor/dsh）跑真实 `buildRoleInstances`，得到

```
activeSessions: 3        （与 AC-01 的「3 个活跃会话」一致）
servingNodes:  ["T-002"] （AC-01 要求 服务 T-001 等 3 个）
hostIcons:     ["cursor"]（AC-01 要求 宿主 dsh cursor）
lastAction:    T-002 / round null / state review（A-1 第 7 行的「轮次 2/3」需要 state 上带 round/maxRounds）
```

原因是 `SERVING_NODE_STATES = {running, review}`（`src/registry/role-instances.js:23`），`done`/`pending` 不算「服务中」；`hostIconsOf` 只遍历 `serving`（同文件 73–84）。而 **D-2（1421）要求 drill 的 roleBar「直接取 `buildRoleInstances` 的投影字段（… servingNodes / hostIcons …），界面不重算」**，D-13（1526）又禁止改这套投影。于是「按 D-2 实现 → AC-01/AC-37/AC-04 挂；按 §2.3/A-1 实现 → 违反 D-2」。

同一根因在 A-1 的示例行上表现为三处不可产生：

| A-1 行 | 要求 | 按现有投影 | 结论 |
|---|---|---|---|
| 第 2 行（1048） | `可用 · 0 个活跃会话 · 服务 — · 宿主 mock · 最近 —` | `boundCount===0` → `inactive`；无绑定 → `lastAction null`；无 serving → `hostIcons []` | **三字段互斥，任何实现都产生不出这一行** |
| 第 5 行（1051） | `不可用 · 1 个活跃会话 · 服务 T-003 · 宿主 mock`（节点 `escalated`） | `escalated` 不在 `serving` 集合 → `servingNodes []`、`hostIcons []` | **「服务 T-003 / 宿主 mock」不可得**（除非改口径为「绑定节点」） |
| 第 6 行（1052） | `冷却中 · 0 个活跃会话 · 服务 — · 宿主 dsh` | 无 serving 节点 → `hostIcons []` | **「宿主 dsh」不可得** |

→ **F3-01（阻断）**。

### 5.3 E3 括号指引、8 节结构与附录

- **括号指引**：`待补充 / TBD / TODO / XXX / [需求标题] / 填写指引` 零命中（§8.1）。**PASS**。
- **8 节结构**：§1 背景/目标/范围；§2 总览 + 13 功能点 + 衔接 + BR（§2.16）；§3 AC/NF/前置；附录 A~D（1007 / 1286 / 1335 / 1387）。**PASS**。
- **附录 C 与头部**：头部 v3（7）、附录 C 末条 v3（1362–1383），逐项登记 F2-01~F2-18 与 §⑤-1/§⑤-2。**PASS**。
- **附录 D 可指导编码**：D-1 文件边界与授权清单、D-2 投影规则、D-3 七端点 + 错误码映射、D-4 打开宿主、D-5 角色态来源、D-6 只读、D-7 节流、D-8 词表、D-9 测试接缝（17 个 wp14 文件，与 AC 引用集合实跑一致）、D-10/D-11 授权修改（`labels-desktop.test.js` 63/131/310 三处行号实点正确）、D-12 编号、D-13 不动清单——**可指导编码，但 D-2 与 §2.3/A-1 的冲突必须先裁决（F3-01）**。

### 5.4 新增 AC-48 / AC-49 / BR-41 / BR-42 依据审查

| 编号 | 依据是否真在规划或基线 | Given 可构造 | Then 用户可见 | 锚点可执行 | 结论 |
|---|---|---|---|---|---|
| **AC-48 / BR-41** | 依据在 §2.14（317）与基线 §3.3 角色态 / §5.7 推送，不在规划逐字条目内——属异常分支补齐（裁决 E 允许「补 AC」），**不是凭空扩范围** | **否**：`pulse` 只能改 `node.status`，清空 `roleId` 绑定、让 `cards` 归零在接缝上不存在（`stream.js:586` / `259-264`） | 是（未参与 · 任务 无 · DAG 保留） | 否（AC-48 的 When 与机检 `serving==='服务 —'`、`cards.length===0` 无法由该接缝产生） | **不通过**（F3-02） |
| **AC-49 / BR-42** | 依据在基线 477「点击…escalated 角标 → 跳转升级处理面板」逐字；A-8 1227/1238 补了 `实例 INST-001 / 升级处理` 形态 | 是（两份 `state.json` + 图上 `escalated` 角标，`graph.js:320` 的 `abnormalCount` 实点） | 是（面包屑/计数行/两条升级/两动作） | 是（`view==='escalation-panel'`、`breadcrumb`、`items`、`actions` 均可断言）；唯一瑕疵是 `grep -REnc "DRILL_ESC_TITLE" … 合计必须恰好 1 条命中` 的「合计」写法（`-c` 按文件输出计数，需再求和） | **通过**（1 处措辞建议见 F3-15 附注） |

**编号与覆盖**：AC 49 条连续无重号，BR 42 条连续无重号，BR 双向 42/42；新增 AC-48/49、BR-41/42 均为接续编号，未重排既有编号（D-12 1517–1519 一致）。

---

## §6 判定锚点实测抽查表

> 全部在 `D:/WWW/Maestro` 根执行；分支 `feat/i1.10b-drilldown`、HEAD `66e5a6b`。`desktop/ui/drill/**`、`src/daemon/drill.js`、`src/adapter/host-open.js` 尚未创建（S2 未开工），涉及它们的锚点当前 `grep` 返回 **exit 2（No such file）**，不是 exit 1——记「不可判定（S3 前）」而非「通过」。

| # | AC | 命令（摘要） | 实测输出 | 断言 | 判定 |
|---|---|---|---|---|---|
| 1 | AC-02① | `grep -REn "createViewState\(" desktop/ui/app.js` | `396:` / `462:`（2 条，exit 0） | 恰好 2 条 | **符合** |
| 2 | AC-02③ | `grep -nE "openGraph\(\|rebuildGraph\(" desktop/ui/app.js`；drill 段同式 | `310`（openGraph 定义）/`389`（rebuildGraph 定义）+ 4 处调用；drill 段 exit 2 | 行号引用成立；drill 零命中 | **部分**：行号成立；drill 段不可判定 |
| 3 | AC-03② | `grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js` | `23:` / `137:`（2 条） | ≥1 | **符合** |
| 4 | AC-03 | `grep -REn "已关闭" desktop/ui desktop/harness` | 0 命中（exit 1） | 零命中（exit 1） | **符合** |
| 5 | AC-05 | `grep -REn "BFS\|bfs\|visited\|queue" desktop/ui/drill/dag.js` | exit 2（文件不存在） | 零命中（exit 1） | **不可判定（S3 前）** |
| 6 | AC-07 | `grep -REn "已运行\|轮次\|依赖" desktop/ui/drill/` | exit 2（目录不存在） | 零命中（exit 1） | **不可判定（S3 前）** |
| 7 | AC-09 | `grep -REn "git_push" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 8 | AC-13 | `grep -REn "execution\.summary" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 9 | AC-14 | `grep -REn "已过期\|过期" desktop/ui` | 0 命中（exit 1） | 零命中（drill 子集自然为零） | **符合** |
| 10 | AC-19 | `grep -REn "Date[.]now" src/daemon/drill.js` | exit 2（文件不存在） | 零命中（exit 1） | **不可判定（S3 前）** |
| 11 | AC-22① | `grep -REn "state = 'running'\|node.state = " src/daemon/http/` | 0 命中（exit 1） | 零命中 | **符合** |
| 12 | AC-23① | `grep -REn "ESCALATION_NOT_PENDING\|INSTANCE_NOT_SUSPENDED" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 13 | AC-23③ | 同式扫 `src/core src/daemon src/cli` | `core/escalation.js:89`、`core/orchestrator.js:5049/5052`、`cli/labels.js:336/339`、`cli/render.js:1125`、`cli/main.js:1552/1554` | 各 ≥1 | **符合**（但正文行号引用不全 → F3-15） |
| 14 | AC-23④ | 同式扫 `desktop/harness` | 0 命中（exit 1） | 零命中 | **符合** |
| 15 | AC-25① | `grep -REn "dsh" src/daemon/http/routes.js` | 0 命中（exit 1） | 零命中 | **符合**（`drill.js` 段 S3 前不可判定） |
| 16 | AC-26 | `grep -REn "DeepSeek Harness" desktop/ui` | 0 命中（exit 1） | 零命中 | **符合** |
| 17 | AC-30① | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | `OK … 零命中`，exit 0（扫 30 文件） | exit 0 | **符合**（词表实点 31/31 无重复） |
| 18 | AC-30② | 同式 `--dirs desktop/ui,desktop/harness` | `OK … 零命中`，exit 0（扫 21 文件） | exit 0 | **符合** |
| 19 | AC-34 | `wc -l baseline-failures-win32.txt`；解析点名清单 vs 磁盘；单跑两文件 | 16 条登记项（行 20–35）；named 36 / actual 36 / missing 0 / extra 0；`http-channel` `# tests 13 / pass 12 / fail 1`；`readonly-local` `# tests 1 / pass 0 / fail 1` | 豁免有据、清单完整 | **符合**（F2-01 闭合的实证） |
| 20 | AC-42 | `node -p "JSON.stringify(require('./package.json').dependencies||{})"` | `{}` | 输出 `{}` | **符合** |
| 21 | **AC-01** | 用 AC-01 的 Given 跑真实 `buildRoleInstances`（`node --input-type=module`） | `servingNodes ["T-002"]`、`hostIcons ["cursor"]`、`lastAction.round null` | `服务 T-001 等 3 个` / `宿主 dsh cursor` / `轮次 2/3` | **不符** |
| 22 | **AC-37** | 同式（`T-020` pending、注册表无 `external-auditor`、无会话） | `status unavailable`（✓）/ `servingNodes []` / `hostIcons []` | `服务 T-020` | **不符** |
| 23 | **AC-04②** | 同式（0 会话、0 绑定） | `status inactive` / `hostIcons []` / `lastAction null` | `可用` / `宿主 mock` | **不符** |
| 24 | **AC-48 / AC-27 / AC-43 / AC-47** | 读 `src/daemon/http/stream.js` 的 `handlePulse` / `applyTestOverlay` | `overlay.roles.set(key,{status})`；`node.status = patch.status`；仅 edge `aggregateStatus` | 需「清空绑定 → cards 0」/「roleBar 转服务中」/「面板聚合转已拒绝」 | **不符**（数据链不存在） |

**抽查统计：24 组，覆盖 18 条 AC。** 其中 **符合 15 / 不符 4（AC-01、AC-04、AC-37、AC-48；AC-27/43/47 同因） / 不可判定 5（AC-02 drill 段、AC-05、AC-07、AC-19、AC-25 drill 段）**。

**必查三项的结论：**

1. **F2-01 / AC-34 回归口径**：已闭合。豁免名单有据（两文件各 fail 1 且都在 16 条登记项内），点名清单 36/36 精确，脚本口径「差集 = 0 + 集合外必须 `# fail 0`」在本机可达成（§8.5）。
2. **AC-25 的时间戳翻转复检**：逻辑成立（三条 `lastChangedAt` 09:12:03 < 09:20:41 < 09:31:10，`maxBy` → SESS-C；翻转 A 到 10:05:00 → SESS-A；改回 → SESS-C），且「不预先点名」已消除 round2 的自证循环。**残留**：翻转需要在核心运行期改写 `state.json` 的 `lastChangedAt`，与 §3.3「先起核再写盘」（984）的顺序口径没有对齐说明（虽然下钻投影每次请求都从磁盘读，技术上可行）→ F3-13（建议）。
3. **AC-42 的用户可见判据**：已达标——Then 只留「能滚到最后一条、行文本正确、不出现空白行、不卡死」，`renderedRows < 60` 明确标为内部断言并移入 D-8（1487）。**残留**：`scrollElapsed ≤ 200ms` 在无 DOM 的纯模块面上如何测量未说明（列入 §9 可疑点）。

---

## §7 本轮修复清单 F3-01 …

> 严重度：`阻断` = 不修不能进入 S1（判据在当前仓库不可执行/不可构造，或与裁决、D 约束互斥）；`建议` = 不阻断但定稿前应修。

### 阻断项

**F3-01｜角色状态栏的「服务节点 / 宿主 / 状态词」与既有投影不自洽，AC-01、AC-04、AC-37 的 Then 不可达成**
- **位置**：§2.3 126–133；A-1 1047–1053（第 2/5/6/7 行）；AC-01 420–423；AC-04 453–455；AC-37 832；D-2 1421；D-13 1526。
- **原文**：`§2.3：服务节点：当前绑定的节点编号…`；`D-2：角色状态栏：直接取 buildRoleInstances 的投影字段（status / activeSessions / servingNodes / hostIcons / lastAction）…界面不重算`；`AC-01 Then：状态栏一行逐字等于附录 A-1 第 7 行（服务 T-001 等 3 个、宿主 dsh cursor…）`。
- **违反**：§1.0.3 C④（锚点必须可执行）、§1.1 DoR #10/#12；E2（与基线派生口径一致）。
- **事实（实测）**：`SERVING_NODE_STATES = new Set(['running','review'])`（`src/registry/role-instances.js:23`）；`hostIconsOf` 只遍历 `serving`（同文件 73–84）；`decideStatus` 在 `boundCount===0` 时返回 `inactive`（同文件 56）。用 AC-01 的 Given 实跑：`servingNodes=["T-002"]`、`hostIcons=["cursor"]`；AC-37 的 Given 实跑：`servingNodes=[]`、`hostIcons=[]`；AC-04② 的 Given 实跑：`status=inactive`、`hostIcons=[]`（§6 #21–23）。A-1 第 2 行（可用 + 最近 — + 宿主 mock）在投影上三字段互斥。
- **冲突面**：按 D-2 实现 → 三条 AC 挂；按 §2.3（绑定节点）实现 → 违反 D-2 且与流程图（10a 用的就是 `servingNodes`）口径不一致；改 `buildRoleInstances` → 违反 D-13。
- **建议修法（择一，并在需求内写死）**：
  1. **（推荐）** 由 drill 投影自己算两段：`servingNodes` = `state.nodes` 中 `roleId` 匹配的**全部绑定节点**；`hostIcons` = 这些绑定节点上会话的宿主（去重、按首次出现顺序）；`status` 仍取 `buildRoleInstances`。同时把 D-2 的「直接取 servingNodes/hostIcons」改写为上述规则，并在 U-09 旁补一句「drill 的『服务』是绑定口径（基线 449），流程图为服务中口径（10a 已交付），二者不要求一致」。
  2. 或全部改用「服务中口径」，则必须同步改 A-1 第 2/5/6/7 行、AC-01 的 Given（`T-001/T-003` 改成 `running`/`review`）、AC-04 ② 与 AC-37 的 Then。
- **连带必修**：A-1 第 2 行不可能行（改为 `未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —` 之类可产生的形态）；AC-04 ② 的「无绑定 + 可用 + 宿主 mock + 最近 —」组合；AC-37 的「服务 T-020」。
- **严重度**：**阻断**。

**F3-02｜测试接缝 `POST /__test__/graph/pulse` 的作用范围够不到下钻投影，AC-27 / AC-43 / AC-47 / AC-48 依赖的变化无法发生**
- **位置**：AC-27 709–711；AC-43 897–899；AC-47 941–943；AC-48 952–954；D-2 1421；D-3 1427–1431；D-9 1493（「复用 `POST /__test__/graph/pulse`；不新增测试路由」）。
- **原文**：`AC-48 When：用 POST /__test__/graph/pulse（kind: "role"）让该角色不再参与本实例（roleId 绑定被清空，角色转 inactive）`；`AC-27 When：用 POST /__test__/graph/pulse（kind:"role"）把某角色从「可用」改为「服务中」`。
- **违反**：§1.0.3 C④ / §1.1 DoR #10/#12。
- **事实**：`handlePulse` 只做 `overlay.roles.set(key,{ status })` 与 `overlay.edges.set(key,{ aggregateStatus })`（`src/daemon/http/stream.js:586,596`）；`applyTestOverlay` 只把 `node.status` 与 `edge.aggregateStatus/visual/labelVisible` 覆盖到**图快照**（`stream.js:255-275`），**不改** `servingNodes` / `activeSessions` / `hostIcons` / `cards`，也不改 `state.json`。而下钻投影按 D-2/D-3 从 `buildRoleInstances` + 状态/事件文件派生 → 脉冲对 `roleBar`、卡片、连接线面板全部无效；「清空绑定」这个动作在接缝上根本不存在。
- **建议修法（择一，并写进 D-2/D-3/D-9）**：
  1. 让下钻投影读**被 overlay 覆盖过的图快照**（`status` 从图节点取、其余仍从投影取），并把 pulse 的 body 扩为 `{kind:'role', status, servingNodes?, bindings?}`，由 `applyTestOverlay` 同时覆盖 `servingNodes`/`activeSessions`/`hostIcons`（这是扩展接缝参数，不是新增路由，需在 D-9 明确登记）；
  2. 或另设一个 `NODE_ENV=test` 下的「改写快照」接缝（明确登记为新增测试接缝，取代 AC-48 的「pulse 清空绑定」措辞）；
  3. 或把 AC-48 改为「静态两态 + 切换项目根」的构造（但那就不再是「下钻期间」，与 §2.14 的语义不符）。
- **严重度**：**阻断**。

**F3-03｜AC-29 的 When 与 Then / 机检不对齐：缺「点击子工作流」一步，第 1 条要求的连接线未在 Given 构造**
- **位置**：AC-29 731–741（When 732、Then 733–740、机检 741）。
- **原文**：`When 依次：在图上点击挂红色角标的角色 → 点排序第一的卡片 → 展开证据段 → 返回下钻 → 点升级节点 → 点「继续」并确认`；`Then 7. 子工作流折叠组点击后可进入子工作流角色流程图`；`机检 探针序列 … → continued(ESC-001) → subflow-shown(roles=3)`；`Then 1. 流程图上有红色角标与红色/橙色连接线`。
- **违反**：§1.0.3 C④（Then 必须由 When 可达）、§1.1 DoR #2/#12。
- **事实**：六步 When 里没有一次点击折叠组，而 Then 第 7 条与 probe 序列都要求 `subflow-shown`；Given 只写了「含 1 个子工作流」，没有构造任何 `rejected`/`expired` 的连接线，Then 第 1 条的「红色/橙色连接线」无从出现。
- **建议修法**：When 增两步「点折叠组 `S-001` → 点面包屑返回下钻」并把 `subflow-shown` 移到 `continued` 之后；Given 增一条已拒绝或已过期的连接线（如 `HO-008` 已拒绝），或把 Then 第 1 条改为「红色角标可见（连接线在 AC-19 判定）」。
- **严重度**：**阻断**（这是规划验收句的唯一端到端判据）。

**F3-04｜AC-23 ② 的「运行中 + 待处理升级」现场不可由产品路径构造**
- **位置**：AC-23 662（Given ②）。
- **原文**：`② 实例已恢复运行（state: running）而升级仍为 pending（构造：先 resolve 再写回 pending 的非法现场不采用——改由"实例被 workflow resume 恢复"构造）`。
- **违反**：§1.1 DoR #10（Given 必须可构造）、§1.0.3 C④。
- **事实**：`pause/resume` 的 CAS 守卫要求 `disk.state === 'running' && disk.halted !== true`（`src/core/orchestrator.js:4689-4695`），否则返回 `INSTANCE_NOT_RESUMABLE`；而升级提交会把实例置 `suspended`（`src/core/escalation.js:153`），`halted` 只在升级写入失败时才为 true（`orchestrator.js:2011-2032`）。因此 `suspended` 实例无法被 `workflow resume` 变成 `running`；而「先 resolve 再写回 pending」被该 AC 自己排除 → 无合法构造路径。
- **建议修法**：允许用 §3.3 的快照夹具**直接写** `state: "running"` + `escalations[0].state: "pending"`（明确说明「这是界面降级用例的合法夹具，不主张它是产品可达状态」）；或改判据为「两个客户端对同一升级并发点『继续』」的第二次（此时第一次已 resolved，天然得到 ① 的提示，② 改由「实例已被 `escalate resolve --decision retry` 恢复」构造——注意该路径下升级已 resolved，需另设 `INSTANCE_NOT_SUSPENDED` 的独立入口）。
- **严重度**：**阻断**。

**F3-05｜AC-01 的夹具用错脚本：`collect.mjs` 不产图**
- **位置**：AC-01 424（夹具）；机检 423（`drill-dump.mjs --payload .../graph.json`）。
- **原文**：`最后用 desktop/harness/collect.mjs --project "$TEMP/maestro-i10b-entry" --out .../graph.json 取图`。
- **违反**：§1.1 DoR #10/#12（前置条件里的命令必须真实存在且能做到它声明的事）。
- **事实**：`collect.mjs` 只 `GET /instances` 与 `GET /ui/labels`，写 `{items, labels}`（`desktop/harness/collect.mjs:80-87`），不含 `nodes`/`edges`；产图要用 `graph-dump.mjs --project <root> --instance <id> --payload <out>`（该脚本头注释 10–18 行明示）。
- **建议修法**：改为 `node desktop/harness/graph-dump.mjs --project "$TEMP/maestro-i10b-entry" --instance INST-001 --payload "$TEMP/maestro-i10b-entry/graph.json"`。
- **严重度**：**阻断**（AC-01 是「后面所有 AC 的地基」，其夹具跑不通则首条 AC 无法取证）。

### 建议项

**F3-06｜AC-28 的 Then 混入接口级指标；NF-4 的 40/30 量化无规划或基线依据**
- **位置**：AC-28 721（Then 末段）；NF-4 974。**原文**：`取数 = 一次回环 HTTP GET 读请求…因此合计取数 30 次 = 10 + 10 + 10`。
- **违反**：`requirement-template.md` 硬约束 2（Then 必须用户可见）、§3.2「用户能感知的性能」。
- **建议**：Then 只留「界面不崩、守护进程不重启、三处显示不变、无重复加载感」；把 `opCount/fetchCount/maxFetchesPerView` 全部移到机检并标「内部断言」；NF-4 若保留 40/30，需在附录 B 补一条「本迭代自定的稳定性口径，来源为基线 §5.7 节流规则」，否则删去具体数字。
- **严重度**：建议。

**F3-07｜AC-05 / AC-06 / AC-43 的 Then 残留内部字段名**
- **位置**：466（`bold: true`、`两次导出的坐标逐字节相同`）、477（`scrollTo 目标等于该卡片编号`）、898（`scrollTop`）。
- **建议**：改成用户语义（「本角色节点的边框更粗」「两次打开位置一样」「列表滚到该卡片并高亮」「可视位置不跳」），字段级断言留给机检。
- **严重度**：建议。

**F3-08｜三条「恰好 N 条命中」的锚点绑死了具体实现形态**
- **位置**：AC-15 579（`kind === 'backflow'` 恰好 1 条）、AC-17 601（`graph/layout` 恰好 1 条）、AC-36 824（`stack.push|stack.pop` 恰好 2 条）。
- **风险**：等价实现（如 `entry.kind !== 'forward'`、用相对路径 `../graph/layout.js` 之外的再导出、用 `levels = [...levels, x] / slice(0,-1)`）会零命中 → 正确的实现被判红。裁决 F 只要求「先实点再断言」，未要求绑死写法。
- **建议**：改为行为断言（方向由定义边 `kind` 决定：用一条 `forward` + 一条 `backflow` 的夹具断言输出方向词；子图复用布局：断言两层子图坐标与同一 `computeLayout` 输出逐字节相等；层级栈：断言 `depth` 增减各 1、返回 3 次视图序列正确）。
- **严重度**：建议。

**F3-09｜AC-02 的锚点范围漏掉真正的返回路径（在 `app.js`，且 `backToList()` 会清空视图状态）**
- **位置**：AC-02 436（①②③ 全部只扫 `desktop/ui/drill/`）；`desktop/ui/app.js:410-417`（`backToList()` 里 `state.viewState = null`）。
- **风险**：D-1 要求「在 `app.js` 新增下钻/子工作流/…的导航方法」，返回流程图的实现就在 `app.js`；若它走 `backToList()` 再 `openGraph()`，视图状态必被清空，而 AC-02 的三条锚点都不会命中（只扫 drill/）。
- **建议**：①③ 的禁项扩到 `app.js` 的新增导航段（或直接禁 `backToList()` 出现在下钻返回路径），并在机检里保留 `viewState` 五组值的行为断言（现已有）。
- **严重度**：建议。

**F3-10｜AC-04 ① 与 AC-07 的 Given 没有钉住被逐字断言的字段**
- **位置**：AC-04 453（`T-001/T-002/T-003` 只给标题与 `T-002` 的状态，`T-001/T-003` 的状态未给，却要 `服务 T-001 等 3 个`）；AC-07 486（第二张卡只给「协调者、已完成、无会话…」，未给标题 `需求澄清` 与 `轮次 1/1`，却要逐字等于 A-3 第 4–6 行）。
- **建议**：把 A-3 / A-1 被断言的每一个字段写进 Given（状态、标题、轮次），或直接写「复用 AC-01 的夹具」。
- **严重度**：建议。

**F3-11｜§1.3 与 AC-49 对升级面板入口的措辞不一致**
- **位置**：§1.3 60（`只在「从升级节点进来的本实例面板」内`）vs §2.11 260 / AC-49（`escalated` 角标也进同一面板）。
- **建议**：改为「只在**本实例**升级处理面板内（入口：升级节点 / 角色节点 `escalated` 角标）」。
- **严重度**：建议。

**F3-12｜基线 477 的「红色/橙色连接线 → 升级处理面板」未落点也未声明**
- **位置**：`docs/index.md` 477；需求 §2.10 236（所有连线点击 → 交接包面板）。
- **说明**：规划 869 要求「连接线点击展开交接包列表 + 时间线」，与基线 477 的目标冲突；需求选了规划一侧，这个取舍合理，但**没有像裁决 A 那样显式留痕**，而 AC-49 的标题却写「基线 477 落点」（只落了角标一半）。
- **建议**：在 §2.10 或 U-01 加一句「基线 477 的连线侧在本迭代落为交接包面板（理由：规划 869 与拒绝/过期原因的可读性），升级入口由角标与升级节点承担」；或让 `rejected`/`expired` 连线的面板顶部同时给「去升级处理」入口。
- **严重度**：建议。

**F3-13｜AC-25 的翻转复检需要写明「运行期改 `lastChangedAt`」的构造方式**
- **位置**：AC-25 688（`把 SESS-A.lastChangedAt 改为 10:05:00 → 重新进入下钻再点一次`）；§3.3 984（`先起核再写盘` 的顺序）。
- **风险**：翻转发生在核心已运行之后，写 `state.json` 与 §3.3 的启动顺序口径不同（虽然下钻路由每次 `loadState` 读盘，技术上可行）；若不写明，S3 取证时容易与「先起核再写盘」冲突。
- **建议**：补一句「翻转通过 `%TEMP%` 夹具在两次点击之间重写 `state.json` 的 `lastChangedAt`（核心只读、不缓存），并在报告中登记两次改写前后的 `state.json` 片段」。
- **严重度**：建议。

**F3-14｜NF-1 / NF-2 / NF-3 / NF-5 无判定锚点；AC-01 未机检「点击角色节点 → 进入下钻」与「≤ 1 秒」**
- **位置**：NF-1 971、NF-2 972、NF-3 973、NF-5 975（只有 NF-4/NF-6 标了锚点）；AC-01 的机检只用 `drill-dump.mjs` 导文本，未走 `createApp` 断言 `view === 'drill'` 与耗时。
- **说明**：§3.1 判定口径 1 承诺「导航行为由 `createApp` 装配路径断言」，但 AC-01（入口 AC）没有这条；AC-16 只在「返回后」断言 `view === 'drill'`。NF-1 的 1 秒 / AC-06 的 200ms / AC-17 的 1 秒中，只有 200ms 有机检。
- **建议**：AC-01 的机检补 `createApp` 断言（`view==='drill'`、`t_drill - t_click ≤ 1000`）；NF-1/2/3/5 各挂 AC 号（NF-1→AC-01/06/17，NF-2→AC-27/47，NF-3→AC-22，NF-5→AC-28）。
- **严重度**：建议。

**F3-15｜AC-23 的「事实口径」行号引用不全；AC-49 的 `-REnc「合计」` 写法需明确**
- **位置**：AC-23 667（`src/cli/main.js:1552/1554` 实际是注释 + `INSTANCE_NOT_SUSPENDED` 的三元判断；`ESCALATION_NOT_PENDING` 的 CLI 侧在 `src/cli/labels.js:336` 与 `src/cli/render.js:1125`）；AC-49 967（`grep -REnc "DRILL_ESC_TITLE" … 合计必须恰好 1 条命中`）。
- **建议**：补全行号（或改成「`grep -REn … | wc -l` = 5」式的实点计数）；AC-49 改为 `grep -REn "DRILL_ESC_TITLE" desktop/ui/drill/ | wc -l` 必须 `1`。
- **严重度**：建议。

---

## §8 实跑命令与输出摘要

> 全部在 `D:/WWW/Maestro` 根执行（Git Bash / Windows 11）。分支 `feat/i1.10b-drilldown`，HEAD `66e5a6b`；`git status` 仅 `docs/**` 与 `.workbuddy/memory` 有改动，`src/**`、`test/**`、`desktop/**` 干净。

### 8.1 编号、字段与 BR 双向覆盖

```bash
grep -cE '^\*\*AC-' docs/iterations/iteration-10b/requirement.md          # 49
grep -cE '^- \*\*BR-' docs/iterations/iteration-10b/requirement.md         # 42
grep -cE '^- \*\*NF-' docs/iterations/iteration-10b/requirement.md         # 7
node -e "…按 ^\*\*AC- 切块检查 场景类型/风险/引用/**Then**/机检/夹具/架构检查…"
# blocks 49；七类字段 missing: none；dupes: none
# 序列 AC-01 … AC-49 连续
node -e "…BR 双向…"   # BRs 42 / uncited: none / phantom: none
grep -nE "待补充|TBD|TODO|XXX|\[需求标题\]|填写指引" …   # 零命中
```

### 8.2 既有代码锚点实点

```bash
grep -REn "createViewState\(" desktop/ui/app.js
# 396:      const next = m.createViewState({      ← rebuildGraph（autoCollapse→computeLayout，沿用 zoom/pan + applyOffsets）
# 462:      const next = m.createViewState({      ← toggleGroup（折叠分组后重建，沿用 zoom/pan + applyOffsets）

grep -REn "ROLE_INSTANCE_STATUS_LABEL" src/daemon/http/labels.js
# 23 / 137  → AC-03 ② 的「≥1」成立

grep -nE "openGraph\(|rebuildGraph\(" desktop/ui/app.js
# 310 openGraph 定义；389 rebuildGraph 定义；429/1390/1525 调用；338/372 rebuildGraph 调用
# → AC-02 ③ 的行号引用（310 / 389）成立

grep -n "backToList\|state.viewState = null" desktop/ui/app.js
# 410 backToList()；417 state.viewState = null   ← 见 F3-09

grep -REn "dsh" src/daemon/http/routes.js          # 0（exit 1）
grep -REn "state = 'running'|node.state = " src/daemon/http/   # 0（exit 1）
grep -REn "DeepSeek Harness" desktop/ui             # 0（exit 1）
grep -REn "git_push" desktop/ui                     # 0（exit 1）
grep -REn "execution\.summary" desktop/ui           # 0（exit 1）
grep -REn "已过期|过期" desktop/ui                   # 0（exit 1）
grep -REn "已关闭" desktop/ui desktop/harness        # 0（exit 1）
node -p "Object.keys(require('./src/daemon/http/labels.js').UI_LABEL_KEYS).length"   # 147（DESKTOP 64，DRILL 0）
grep -n "EXPECTED_DESKTOP_KEYS\|EXPECTED_DESKTOP_VALUES\|147, '新增" test/wp13/labels-desktop.test.js
# 63 / 131 / 310  → D-11 行号正确
```

### 8.3 错误码与纯净扫描

```bash
grep -REn "ESCALATION_NOT_PENDING" src/core src/daemon src/cli
# src/core/escalation.js:89
# src/core/orchestrator.js:5049
# src/cli/labels.js:336
# src/cli/render.js:1125
grep -REn "INSTANCE_NOT_SUSPENDED" src/core src/daemon src/cli
# src/core/orchestrator.js:5052
# src/cli/labels.js:339
# src/cli/main.js:1554（1552 为注释）
grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/ui        # 0（exit 1）
grep -REn "ESCALATION_NOT_PENDING|INSTANCE_NOT_SUSPENDED" desktop/harness   # 0（exit 1）

node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>
# OK: 扫描 30 个文件 … 零命中；exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>
# OK: 扫描 21 个文件 … 零命中；exit 0
node -e "…统计 --forbid 词表…"   # words 31 / uniq 31
node -p "JSON.stringify(require('./package.json').dependencies||{})"   # {}
```

### 8.4 跨迭代基线

```bash
ls test/wp13/*.test.js | wc -l                                    # 36
node -e "…解析 AC-34 点名清单 vs 磁盘…"                             # named 36 / uniq 36 / actual 36
                                                                  # missing-in-doc: none / extra-in-doc: none
wc -l docs/iterations/iteration-10a/baseline-failures-win32.txt    # 35（其中登记项 16 条，行 20–35）
node -p "require('./docs/iterations/iteration-10a/summary.json').gate.tests"   # 1425
grep -cE '^\*\*AC-' docs/iterations/iteration-10a/requirement.md  # 44（v4，AC-01~44 均有 evidence 目录）
git merge-base --is-ancestor a093ede HEAD                          # 0（10a 终验提交在本分支祖先内）
```

### 8.5 两条稳定红（AC-34 豁免依据）

```bash
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 test/wp13/http-channel.test.js
# # tests 13 / # pass 12 / # fail 1   （the desktop port listens on loopback only (lsof shows 127.0.0.1)）
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 test/wp13/readonly-local.test.js
# # tests 1 / # pass 0 / # fail 1      （AC-27：读操作不写实例、四组状态不变、仅回环监听、数据面无凭据 401）
```

两条均在 16 条登记项内（文件第 25/26 行）→ AC-34 的「文件级豁免 + 集合内登记」有据，F2-01 的修法成立。

### 8.6 全量串行（AC-34 的条数基数）

```bash
NODE_ENV=test node --test --test-concurrency=1 --test-timeout=120000 --test-force-exit "test/**/*.test.js"
# 1..1425
# tests 1425 / pass 1400 / fail 16 / cancelled 0 / skipped 9 / duration_ms 235455 / exit=1
```

**用途只有两个**（按裁决 G，不以绝对失败条数作判据）：核 `tests ≥ 1425`、看失败集合是否仍落在「8 条历史基线 + 16 条 win32 登记项 + AC-04 允许项」内。

- **条数基数成立**：`tests=1425`，与 I1.10a 收口时的 `tests=1425` 相等 → AC-34 的 36 文件基数未被本迭代削减。
- **差集**：16 条失败中 **13 条**逐字命中 `docs/iterations/iteration-10a/baseline-failures-win32.txt` 的登记项；**1 条**是 AC-04 允许项（该文件头部口径：「8 条历史基线 + AC-04 允许项 + 本文件内」）；**2 条**在登记外，已逐条定性：
  - `HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`（`test/wp11/handoff-schema.test.js:182`）→ 本机 `EPERM: operation not permitted, symlink`（`fs.symlink` 无权限，Windows 未开开发者模式/非管理员），单独复跑同样红，属**环境限制**；该文件是 wp11，不在 AC-34 的 36 个 wp13 文件范围内。
  - `三主链：A-0 归一化后多次运行不得低于 I1.7 收口基线（每条链 ≥2 次）`（`test/wp13/regression.test.js:246`）→ 全量串行下多出一行 `会话 已升级`；隔离复跑 `test/wp13/regression.test.js` 得 `# tests 10 / # pass 9 / # fail 0`（1 skip），判为**负载相关 flake**。
  - → **登记外 0 条真实新增失败**，差集 = 0，符合裁决 G。
- **反向不构成问题**：16 条登记项中本次未失败的有 3 条（`A-1: developer.yaml…`、`A-1: code-change/SKILL.md…`、`两份 legacy 夹具的 state/events sha256…`）——登记项只表示「不作为回归判据」，不表示必然失败。
- 绝对值为 `fail 16` 而 10a 为 `fail 18`，不影响判定（裁决 G 明确不比绝对条数）。

### 8.7 DSH 独立取证（裁决 A）

```bash
cd "$LOCALAPPDATA/Programs/DeepSeek Harness/resources"
grep -ao "dsh://[a-zA-Z0-9/_?=.&-]*" app.asar | sort -u
# dsh://cordis / dsh://host / dsh://open / dsh://open/      ← 无会话级深链
grep -ao "0\.2\.2-rc\.[0-9]*" app.asar | sort | uniq -c
# 5300 0.2.2-rc.1
cargo --version   # command not found（裁决 B 的前提在本机成立）
```

### 8.8 数据面实跑：角色状态栏投影（F3-01 的证据）

```bash
node --input-type=module -e "
import { buildRoleInstances } from './src/registry/role-instances.js';
// AC-01 的 Given：T-001 done / T-002 review / T-003 pending；3 条非 idle 会话，host dsh/cursor/dsh
…
"
# AC-01 => {"active":3,"serving":["T-002"],"hosts":["cursor"],"last":"T-002","round":"null/null","state":"review"}
# AC-37 => {"status":"unavailable","active":0,"serving":[],"hosts":[],"last":"T-020"}
# AC-04② => {"status":"inactive","active":0,"serving":[],"hosts":[],"last":null}
```

对照 AC-01 Then / A-1 第 7 行（`服务 T-001 等 3 个` / `宿主 dsh cursor`）、AC-37 Then（`服务 T-020`）、AC-04 ② Then（`可用` / `宿主 mock`）→ **三条均不符**。

### 8.9 未独立核实项（不冒充已核）

- **真实 DSH 会话标识与 `~/.dsh/sessions/<工作区>/<标识>/` 同名**：只确认目录形态与 UUID 形态存在（4 个工作区目录），未构造「同一标识既是 ACP sessionId 又是目录名」的现场（列入 §9）。
- **窗口前置、剪贴板实际内容**：本机无 Rust/MSVC，不做窗口级核验；按裁决 B 属人工核验项。
- **CI / Linux 侧 wp13 是否 36/36 全绿**：本机 Windows 无法验证；本报告只判「AC-34 的豁免在本机有据」。
- **AC-42/AC-43 的滚动类指标（`scrollElapsed` / `anchorRowTop`）在无 DOM 的纯模块面上如何测量**：未实现，无法核实（列入 §9）。
- **全量串行对工作区的副作用（已复原）**：`test/**` 里的性能用例会把实测耗时写进 `docs/iterations/iteration-4/evidence/nfr-perf-{atomic,batch,render}.json`（仅 `totalMs` 类数值变化）。本次跑完后已 `git checkout --` 复原为 HEAD 版本，`git status` 现在只剩未跟踪的 `docs/iterations/iteration-10b/`；`src/**`、`test/**`、`desktop/**` 全程无改动。

---

## §9 最可疑但无法证伪的点（供主控判断，未计入 F3）

1. **「会话标识 = DSH 会话目录名」这一步没有闭环证据。** ACP `session/new` 返回的 sessionId 被当作「宿主真实会话标识」，而 DSH 本地目录名是另一个 ID 空间。本机只验证了目录与 UUID 形态存在（`~/.dsh/sessions/.../d6425e69-...`，round2 已核），没有验证「同一个值在两处一致」。若二者不同，AC-25 的第③段（双向核对）就落空，而 AC-25 的自动面只判「进程存在 + 目录同名」，判不出这个偏差。
2. **AC-42 / AC-43 的滚动指标在一个「不访问 DOM」的纯模块面上如何测得真实值。** D-1 规定 drill 模块不访问 DOM，`drill-dump.mjs` 只导出 JSON；那么 `scrollElapsed ≤ 200ms`、`anchorRowTop` 前后差 ≤ 1px 只能是模拟值（注入时钟 + 模型坐标）。这既让「能滚到最后一条、不卡顿」的用户可见结论缺乏真实承载，也让两条性能断言无法证伪——除非 S2 明确一个最小 DOM/滚动模型并在 D-9 写明。
3. **A-1 的「宿主」在 0 会话时的口径无法从基线唯一推出。** 基线 449/§2.3 只说「该角色会话所在的宿主；拿不到显示 —」，而 A-1 第 2/6 行要求「0 个活跃会话却有宿主」。要满足它们，必须引入「宿主按角色配置或历史粘滞」的新规则——这条规则既不在基线也不在裁决里；不引入则 A-1 两行永远不可产生（F3-01 已按「不可产生」处理，但「应该怎么定」超出评审可判范围，需主控裁决）。

---

## 附：全量串行 16 条失败逐条归因（§8.6 的明细）

> 命令与口径同 §8.6；`tests 1425 / pass 1400 / fail 16 / skipped 9`。归因列只写本机可观察到的现象，不臆造根因。

| # | TAP 标题（逐字） | 归因 | 是否在 10a 登记项 |
|---|---|---|---|
| 1 | `promptFailures:2 -> attempts 依次 1/2/3，前 2 次 -32603 第 3 次 end_turn` | [SIGNAL] 进程回收时序 | 是 |
| 2 | `--host-error 早返回（-32603）也在返回前写 attempts=1（AC-63）` | [SIGNAL] 同上 | 是 |
| 3 | `HANDOFF_EVIDENCE_ESCAPE：符号链接绕过` | [PRIV] 本机 `EPERM`，`fs.symlink` 无权限；隔离复跑同样红 | **否**（wp11，不在 AC-34 范围） |
| 4 | `resolveEvidenceRef 纯路径判定（越界 / artifacts / policy）` | [PATH] realpath / 大小写语义 | 是 |
| 5 | `可注入 fs：stat 结果决定通过，且不产生任何写` | [PATH] 同上 | 是 |
| 6 | `S-07: thirteen directly written role files are read by the registry (--host mock)` | [CRLF] 逐字节比较 | 是 |
| 7 | `the desktop port listens on loopback only (lsof shows 127.0.0.1)` | [LSOF] Windows 无 `lsof` | 是 |
| 8 | `AC-04：空态、不可读行不阻断、新实例 2 秒内由推送触发出现；F-18 脉冲后 2 秒内更新` | [TIMING] 2 秒窗口 | AC-04 允许项 |
| 9 | `AC-27：读操作不写实例、四组状态不变、仅回环监听、数据面无凭据 401` | [LSOF] 同上 | 是 |
| 10 | `三主链：A-0 归一化后多次运行不得低于 I1.7 收口基线（每条链 ≥2 次）` | [TIMING] 全量串行下多一行 `会话 已升级`；隔离复跑 0 fail | **否**（判为 flake） |
| 11 | `newState 只追加 health 与 traceId 两个字段、既有初始字段与顺序不动；缺 health 按 30000 缺省且不批量回填` | [TIMING] 事件条数/时序 | 是 |
| 12 | `execution.summary 每会话恰一条，成功/失败/取消三种收尾都有，缺项为 null` | [TIMING] 同上 | 是 |
| 13 | `--fail-tool 合并四项；--fail-tool-no-refs 缺项为 null 且 command 不被工具名冒充` | [SIGNAL] | 是 |
| 14 | `--stop-after 3 冻结窗口恰 3 条跨度、7 字段、无 handoff_ids、HO-002 读取时推导` | [TIMING] 窗口跨度 | 是 |
| 15 | `grep -c "object: 'session'" ≤ 13；会话级新增事件类型只有 execution.summary` | [TIMING] 计数窗口 | 是 |
| 16 | `single / code-loop / task-loop 三主链运行期输出不出现健康度 / 追踪新行` | [TIMING] | 是 |

**结论**：13 条命中登记项 + 1 条 AC-04 允许项 + 2 条登记外（1 环境限制、1 flake，均非本迭代引入）→ **登记外真实新增失败 0 条**。
