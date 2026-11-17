# I1.10b 需求评审记录 · Round 5

- **评审对象**：`docs/iterations/iteration-10b/requirement.md`（**v5**，1701 行；AC-01~AC-51 / BR-01~BR-43 / NF-1~NF-7；头部「版本：v5」，附录 C 末条 v5）
- **评审角色**：需求评审工程师（第 5 轮，干净上下文，只读）。只按判据与产物独立判断；未采信需求自述与附录 C 的修复回执。
- **判据来源**：`docs/index.md` 第一部分全部、第二部分 `#### I1.10b`（861–874）、`#### I1.10a`（840–857）、`#### I1.11`（878–888）、阶段一退出条件（911–913）；`docs/templates/requirement-template.md`；`docs/templates/execution-template.md` §1.0.3 / §1.1（13 条 DoR）/ §1.2；`docs/iterations/iteration-10b/decisions.md`（**裁决 A~I，效力最高**）；上轮 `review-round4.md`（仅用于逐条复核 F4-01~F4-14）。
- **只读声明**：唯一写入为本文件；未改 `requirement.md`、`decisions.md`、`docs/index.md`、模板、`src/**`、`test/**`、`desktop/**`。
- **复核方式**：Windows 11 / Git Bash / Node `v22.22.2`；分支 `feat/i1.10b-drilldown`，HEAD `66e5a6b`（与 round4 取数基线一致，工作区无 `src/**` / `test/**` 改动）。本轮共 **30 组实跑/实点**：5 组真实 `buildRoleInstances` 投影实跑（AC-01 / AC-04①②③ / AC-37 / AC-50 终态 / A-1 第 5 行形态）、2 组 31 词纯净扫描、DSH `app.asar` 深链复核、其余为 `grep`/`sed` 实点行号核验。未跑全量 1425 条（会写 `evidence/**`，与只读约束冲突；改核 `summary.json` 的 `gate.tests=1425` 与基线登记文件）。

---

## §0 总判

**总判：PASS。**

- **阻断 0 项 / 建议 3 项**（F5-01~F5-03 全部为「建议·移交 S1 §7」，见 §7）。
- **上轮 14 项三态**：**已修 14 / 未修 0 / 修了但引入新问题 0**（§1）。F4-01~F4-04 四个阻断全部闭合。
- **回归重扫无新增**：规划覆盖表 13 行 **覆盖 13 / 部分 0 / 缺漏 0 / 越界 0 / 收窄 0**（§2）；反向扫描无夹带、无缺漏；AC 51 连续、BR 43/43 双向覆盖、附录 A~D 齐全、头部 v5 与附录 C 末条一致（§5）。
- **判定锚点实跑**：29 组实测中 26 组「符合」、3 组按 D-14 表 D 记「契约未落地、不计通过」（`src/daemon/drill.js` / `desktop/ui/drill/` / `test/wp14/` / `probe/`，S2 未开工），**无一组「不符」**（§6）。
- **PASS 依据**：四类阻断项（内部自相矛盾 / 基线或规划逐字冲突 / 判据不可判定 / 覆盖面缺漏）均为 0；上轮 F4 全部闭合；回归扫描无新增问题。建议项不构成阻断理由（主控边界条款）。

---

## §1 上轮 FAIL 复核（F4-01~F4-14）

> 三态口径：`已修` = 原判据按 round4 要求闭合（涉及裁决的以 `decisions.md` 为准）；`未修` = 原问题仍在；`修了但引入新问题` = 原判据闭合但修法产生新的不可执行 / 不可构造 / 内部矛盾。

| # | 判定 | v5 落点（行） | 证据 |
|---|---|---|---|
| **F4-01** | **已修** | BR-06（364）；§2.5（159）；AC-08（498–507）；A-0（1050）；D-2（1503） | v5 恢复基线 489 的 **8 档**排序。实跑对照：`sed -n '489p' docs/index.md` = ``按节点状态排序：`escalated` > `failed` > `running` > `review` > `assigned` > `ready` > `blocked` > `done```，与 BR-06 / AC-08 逐字同序。AC-08 的 9 节点期望顺序 `T-010 → T-011 → T-013 → T-014 → T-012 → T-015 → T-016 → T-017 → T-018` 覆盖全部 8 档：`assigned`（`T-012`）独立第 5 档，位于「待校验」（`T-014`，第 4）之后、「可调度」（`T-015`，第 6）之前，**不再抬到 review 之前**；`rank=[1,2,3,4,5,6,7,8,8]` 与顺序逐项自洽（T-017 本角色 done 在 T-018 下游 done 之前，同档归属 tie-break 生效）；`tier` 字符串数组与 8 档名一一对应；显示词折叠（`T-012` 显示「执行中」）与排序档位折叠明确分开。A-0 / D-2 与 AC-08 同一口径，AC-32 的 `rank === 3`（running）在 8 档下自洽。 |
| **F4-02** | **已修** | A-5（1200、1216）；§2.10（240）；AC-19（623、626） | A-5 行 `交接 HO-010 · 第 3 轮 · 已投递 · 09:12:41`，与同一包时间线末条 `09:12:41 已投递`（1202）一致；A-5 增规则「行时间取该包最近一次活动的时刻」（1216）。§2.10（240）同步为 `09:12:41` 并写明「行时间与时间线末条同为 09:12:41，不取构造时刻」。AC-19 Given（623）`HO-010（第 3 轮、已投递、09:12:41——行时间取最近活动，与其时间线末条 09:12:41 已投递 一致）`；机检（626）断言四行时间戳 `['09:12:41','09:12:39','09:05:10','08:58:02']` 严格倒序且与 A-5 逐字一致。三种读法合并为一种，无残余矛盾（全文仅 240/626/1201/1216/1458 五处出现 `09:12:40`，均为时间线「已构造」行或变更留痕，合法）。 |
| **F4-03** | **已修** | AC-29（736–753；Given 741；When 742；Then 743–750；机检 751；夹具 752） | Given 增 ③ `T-003` 的 `execution.summary`（`{command:'npm test', exitCode:1, keyOutputLines:12, logRef:'logs/T-003.log'}`）+ `HO-008` 携带 `products:['artifacts/code/calc.js']`、`defects:[{evidence:'defects/d1.md'}]`、`artifactRefs:['logs/T-003.log']` + 项目根内真实存在两个文件、`defects/d1.md` 故意缺失 → Then 3 的三条证据行（可解析/缺失/可解析）与「摘要给出退出码 1」全部可由 Given 派生；④ `ESC-001` 的 `reasonDetail: 测试第 2 轮失败`、`defects:[{summary:'断言失败', evidence:'defects/d1.md'}]` → Then 4 的两行逐字有来源。When 改为**九步**，⑥ 与 ⑧ 之间新增 ⑦「关闭升级面板回到角色下钻、再点返回流程图」，消除「在升级面板内直接点 S-001」的路径断裂；probe 序列 9 段与九步一一对应。内部自洽复核：② 与 ③ 的 `HO-008` 同包双描述（开发→测试 rejected 边 + T-003 出向携带证据）不冲突；⑤ `X-001` 经定义边 `T-003→X-001` 进 1 跳 DAG，⑤ 的点击可达；Then 2 的「不可用」与 `escalated` 会话 → `unavailable` 投影（实跑 A-1 第 5 行同型可产出，§6#9）。 |
| **F4-04** | **已修** | AC-50（979–988）；BR-41（399）；§2.14（318）；§3.3（1018）；D-1（1495）；D-14 表 A5（1634）/ 表 D D14（1664） | v5 不再声称「既有断开/重连路径」覆盖 drill：Given 明写「现状 `app.js:1477` 只对 `view === 'graph'` 打开，S2 把条件扩到 `graph \|\| drill`，不新增通道、不新增帧类型」，并按 `契约：desktop/ui/app.js::ensureStreams().drill` 登记（D-14 表 A5 第 5 条 + 表 D D14）。实点核验与现状描述一致：`grep -n "current.view === 'graph'" desktop/ui/app.js` → 1477（唯一图流打开条件）；`1444-1451` scheduleReconnect、`1488-1495` 图流 onStatus closed → disconnect → scheduleReconnect、`stream.js:462,518` 首帧 `graph.snapshot` 均实点吻合。`connection.js:172` 是 `retry()` 声明、173 才是 `status !== 'failed'` 守卫——v5 表 B4（1643）已按此更正并声明 AC-50 不依赖 `retryConnection()`。构造改为「第二份快照 + 契约 A5 重开后的重取」，属登记在案的**新建调用点**，不再是虚构的既有路径。 |
| **F4-05** | **已修** | AC-01 机检（428）；AC-04 机检（461）；AC-37 机检（843） | 三处 `lastAction` 期望对象均已含 `stateSince`（ISO 8601 字面值）。**实跑闭合**：按 AC-01 / AC-04① / AC-37 的 Given 构造 `state.json`（节点数组 + `stateSince` + 按 `nodeId` 的 `maxRounds`）跑真实 `buildRoleInstances`，输出 `lastAction = {nodeId:'T-002',round:2,maxRounds:3,state:'review',stateSince:'2026-11-15T10:04:00.000Z'}`（AC-01 / AC-04①）与 `{nodeId:'T-021',round:1,maxRounds:1,state:'running',stateSince:'2026-11-15T10:04:00.000Z'}`（AC-37），与机检期望**逐字段相等**（§6#1/#2/#5）。 |
| **F4-06** | **已修** | AC-20（630–639）；A-9（1288–1303）；B-1（1344） | AC-20 Then（636）空态逐字为 A-4 的 `时间线 无记录` / `摘要 无记录` / `证据 无记录`；交接行补时间字段 `交接 HO-012 · 正向 · 第 1 轮 · 已接受 · 09:20:00` 且 Given（634）钉住该时间与「本 AC 与 AC-19 / AC-29 两个独立夹具、`HO-008` 不复用」的编号说明。全文扫描「记录 无」仅命中附录 C 的 v5 变更留痕（1462），正文零残留。 |
| **F4-07** | **已修** | AC-21 Given（645）、Then（647）、机检（648） | Given 逐字钉住 `ESC-001` 的 `reasonDetail: '测试第 2 轮失败'` 与 `defects: [{summary:'断言失败', evidence:'defects/d1.md'}]`（`ESC-002` 同步给值），Then / 机检的两行逐字断言（`原因：测试第 2 轮失败`、`缺陷：断言失败（证据 defects/d1.md）`）全部可由 Given 派生，与 A-6（1227–1228）同形。 |
| **F4-08** | **已修** | §2.3（134）；A-1（1080） | 两处均新增「与基线 450 的逐字对照（评审 F4-08）」段：引用基线 450 原文「服务节点 \| 当前绑定节点 ID 列表」、声明本迭代取 `servingNodes`（`running`/`review`）服务中口径、理由（与流程图同一投影）、以及「按全部绑定节点实现会使 A-1 第 2/5/6 行与 AC-01/04/37 不成立」的反证。S1 按「全部绑定节点」实现的风险已显式挡住。 |
| **F4-09** | **已修** | AC-51 标题（990） | 标题改为「基线 477 **连线侧的改道判定**：红色 / 橙色连接线进交接包面板，不进升级面板」，与 §2.10（248）/ BR-43（401）的「改道」措辞一致。 |
| **F4-10** | **已修** | AC-28（725–734）；NF-4（1006）；U-16（1382–1383） | Then（731）已无「40 次导航动作」；When（730）明写「次数与组合是机检的操作定义，不写进用户可见判据」；`opCount === 40`、`fetchCount === 30`、`maxFetchesPerView === 1` 全部留在机检内部断言（732）。算术自洽复核：40 = 10+10+10+10（进下钻/退出/进看板/下钻子流程）；30 = 进入下钻 10 + 进入看板 10 + 下钻子流程 10（退出与返回取 0），口径句「进入某视图取 1 次、退出与返回复用已取数据取 0 次，故 10 + 10 + 10」成立。 |
| **F4-11** | **已修** | §3.1 判定口径第 6 条（416）；D-14 表 D（1645–1665） | 判定口径第 6 条新增「未落地路径的零命中 / 存在性锚点」段：统一按 `契约：<path>::<export>` 读作契约类，S2 前 `exit 2` / `test -f` 为假记「未落地、不计通过、不记失败」。D-14 表 D 登记 **15 条**（D1~D15），逐条给出路径、导出签名与未落地读法；本轮实测 3 组未落地路径（drill.js / desktop\/ui\/drill / wp14 / probe）均按此口径记，不再有被误判为红的通道。 |
| **F4-12** | **已修** | AC-39（867）；AC-41（889） | 两条均改为**语义断言 + 来源置换**（输出文本不含 `undefined`/`null` 的行为断言 + 「把投影值改成 `TBD`/`blocked`，卡片必须跟着变」），并显式声明「本 AC 不设 `grep` 锚点」。原「`grep pending` / `grep undefined` 零命中误杀正确写法」的问题消除。 |
| **F4-13** | **已修** | §2.14（315）；AC-50 Then（985）；BR-41（399）；D-9（1583） | 三处一致写明局部更新规则：「重取只替换状态栏与卡片；局部 DAG 保留上一帧（节点数不变、不清空、不塌陷、不重排），不按空节点集重建」，并解释它与「重新取一份完整数据」不矛盾（"完整数据"指状态栏与卡片的数据来源）。S2 按"整页替换清空 DAG"实现的歧义已消除。 |
| **F4-14** | **已修** | AC-42（898）；AC-43（909）；D-9（1584） | 两条机检均补「承载说明」：纯模块面无 DOM，`scrollElapsed` / `anchorRowTop` / `renderedRows` 是"模型坐标 + 注入时钟"下的模拟值，只作内部回归信号，不冒充用户可见结论；D-9 同步登记承载方式。 |

**统计：已修 14 / 未修 0 / 修了但引入新问题 0。未闭合编号：无。**

**引入新问题的独立排查（负结果）**：① AC-29 的 `HO-008` 双重身份（rejected 边 + 证据携带者）在同一夹具内自洽；② AC-50 期望行与 A-1 第 3 行同形且实跑可产出；③ AC-08 的 rank/tier 与 AC-10（`tier==='blocked'`）、AC-32（`rank===3`）在新 8 档口径下无冲突；④ AC-25 的翻转复检数值（09:12:03 → 10:05:00 → 09:12:03，选中 SESS-C → SESS-A → SESS-C）自洽；⑤ 附录 C 的 v5 逐条登记与正文实际改动对得上（抽查 F4-01/02/04/06/11 五条均实改）。

---

## §2 规划原文逐句覆盖表（强制）+ 反向扫描

> 规划原文逐字摘自 `docs/index.md` 861–874 行；「符合性」取 `一致 / 收窄 / 降级 / 越界`；「覆盖判定」只取 `覆盖` 为 PASS。

| # | 规划原文（逐字 + `index.md` 行号） | 需求 §2 落点 | 需求 §3 落点 | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | `角色下钻视图：局部 DAG（1 跳）+ 任务卡片列表`（863） | §2.2（102）/ §2.4（136）/ §2.5（153） | AC-01、AC-02、AC-05、AC-07、AC-38、AC-39、AC-40 | 一致 | **覆盖** |
| 2 | `任务卡片三层信息 + 会话状态指示器 + 节点类型特殊显示`（864） | §2.5（153–171） | AC-07、AC-08、AC-09、AC-10、AC-35、AC-41 | 一致 | **覆盖** |
| 3 | `DAG 与卡片联动：点击 DAG 节点滚动到对应卡片`（865） | §2.6（173–184） | AC-06 | 一致 | **覆盖** |
| 4 | `点击卡片进入节点详情（会话状态时间线、ACP 事件摘要、证据引用、交接包历史）`（866） | §2.7（186–202） | AC-11、AC-12、AC-13、AC-14、AC-15、AC-20 | 一致 | **覆盖** |
| 5 | `“查看全部节点”切换：切换到全实例节点看板（7 列）`（867） | §2.8（204–214） | AC-16 | 一致 | **覆盖** |
| 6 | `` `subworkflow` 下钻：点击折叠组节点进入子工作流角色流程图 ``（868） | §2.9（216–230） | AC-17、AC-18、AC-36、AC-29（Then 7） | 一致 | **覆盖** |
| 7 | `连接线点击展开交接包列表 + 时间线`（869） | §2.10（232–248） | AC-19、AC-42、AC-43、AC-51 | 一致 | **覆盖** |
| 8 | `特殊节点点击跳转人工任务/升级队列`（870） | §2.11（250–267）/ §2.12（269–284） | AC-20、AC-21、AC-24、AC-44、AC-49 | 一致（「升级队列」按**裁决 C** 落为**本实例**面板；§2.11 267、U-01 1350–1351 已声明，AC-24 断言只有「继续/取消」） | **覆盖** |
| 9 | `一键跳转宿主会话：从角色节点跳转到 DSH 对应会话`（871） | §2.13（286–304） | AC-25、AC-26、AC-33、AC-46 | 一致（**裁决 A** 三段口径 + **裁决 I** 核对方式；63 / 298 / 692 / 740 行均显式标注「属裁决 A 的偏离说明」，未自称逐字达成；本轮实跑复核 `app.asar` 深链事实与裁决 A 一致，见 §6#28） | **覆盖** |
| 10 | `角色状态栏（inactive/available/busy/cooldown/unavailable）`（872） | §2.3（121–134） | AC-03、AC-04、AC-37 | 一致（五词映射：未参与/可用/服务中/冷却中/不可用；A-1 七行经真实投影实跑可产出） | **覆盖** |
| 11 | 验收句前段：`人在面板上完整走“角色流程图发现异常→下钻到角色→查看任务卡片→展开证据→处理升级→实例继续”，不需要终端`（874） | §2.15（322–355）/ §2.12 | AC-22、AC-29、AC-45 | 一致（AC-29 的 Given/When/Then 缺口已按 F4-03 闭合，证据链完整） | **覆盖** |
| 12 | 验收句中段：`子工作流可下钻`（874） | §2.9（216–230） | AC-17、AC-36 | 一致 | **覆盖** |
| 13 | 验收句后段：`一键跳转能打开 DSH 对应会话`（874） | §2.13（286–304） | AC-25（按裁决 A + 裁决 I 的口径判定，未逐字达成规划原文该段） | 一致（偏离已声明且经主控裁决定案；§2.13 298、AC-25 692 标注偏离） | **覆盖** |

**统计：覆盖 13 / 部分 0 / 缺漏 0 / 越界 0 / 收窄 0。**

### 2.1 反向扫描 ①：§2 功能点与 AC 反查规划来源（查夹带）

- §2.1 的 13 个功能点（§2.2~§2.14，86–100 行）逐条可追到规划 10 子项、验收句 3 段，或追到基线 §3.3 / §4 能力域 4·5 / §5.7 的具体条目；51 条 AC 亦同。**无规划之外的新能力。**
- 文末对账表（1684–1696）13 行与 §2.1 的 13 行逐项对应；第 13 行显式声明「唯一偏离行，按裁决 A + I 判定」；两条规划外显式留痕（1700：基线 477 连线侧 → AC-51 + BR-43；绑定归零 → AC-50）均已给出来源与理由，属裁决 E 允许的「补」，不是夹带。
- NF-4 的「40 次导航 / 30 次取数」仍是唯一量化自定口径，已在 NF-4（1006）/ U-16（1382）标明只作内部指标、可整体删除而不影响任何 Then——不计夹带。

**结论：反向扫描 ① 无夹带。**

### 2.2 反向扫描 ②：基线状态词与能力域反查 §2 落点（查缺漏）

| 基线项 | §2 落点 | 判定 |
|---|---|---|
| 节点 9 态（129–168） | A-0（1049–1050）9 态 → 7 显示词折叠 + **排序 8 档逐字对齐基线 489**（F4-01 闭合）；BR-06；AC-08 含 `assigned` 实例 | 覆盖（排序冲突已消除） |
| 会话 6 态（170–193） | A-0 / A-3 指示器表（1159–1167）/ BR-08（6→5 标签 + 无会话） | 覆盖 |
| 角色 6 态（195–222） | §2.3 五词 + BR-02 + U-09（`retired`→`inactive`，`graph.js:117` 实点 `retired: 'inactive'`） | 覆盖 |
| 交接包 7 态（224–246） | A-0 七词、A-5 时间线（行时间 = 最近活动，F4-02 闭合）、§2.10 聚合优先级（基线 395）、AC-19 | 覆盖 |
| 能力域 2「子工作流折叠」（342） | §2.9、BR-16/BR-32、AC-17/18/36 | 覆盖 |
| 能力域 4（365–412） | §2.10、§2.14、A-5、AC-19/42/43/51 | 覆盖 |
| 能力域 5 视图层次（416–439）/ 角色流程图（441–496） | §2.2~§2.8、BR-01~BR-15 | 覆盖 |
| 基线 450「服务节点」 | §2.3（134）/ A-1（1080）逐字对照段（F4-08 闭合） | 覆盖 |
| 基线 477「点击红色/橙色连接线或 escalated 角标 → 跳转升级处理面板」 | 角标侧：§2.11 261 + AC-49 + BR-42；连线侧：§2.10 248 改道交接包面板（BR-43 + AC-51 显式留痕） | 覆盖（改道已声明） |
| 能力域 5.6 人工干预队列（509–512） | §2.11/§2.12 仅本实例、仅「继续」；跨实例队列留 I1.11（§1.3 60） | 覆盖（按裁决 C） |
| 能力域 5.7 数据接口与实时推送（514–530） | §2.14 + §3.3 测试接缝（1018）+ U-13 | 覆盖 |
| §5.2 数据布局（600–614） | §2.7 证据/日志引用；§3.3 夹具写 `state.json`/`events.jsonl`/`traces.jsonl`；D-2 证据存在性 | 覆盖 |
| §6 边界 5/7/9/10（624/626/628/629） | §2.3 134、§2.10 248、§2.12 284、§1.3 63 | 覆盖 |

**结论：无缺漏。round4 的三处残留（F4-01 / F4-02 / F4-08）本轮全部闭合。**

---

## §3 第二部分（A 符合规划 / B 罗列全面）

| 判据 | 结论 | 依据（行号 / AC） |
|---|---|---|
| **A①** 规划 10 子项逐字 → §2，不降级/收窄/换名/合并 | **PASS** | 子项 1~7、10 与 §2.2~§2.9、§2.3 语义一致；子项 8 按裁决 C 落为本实例面板（267、U-01）；子项 9 与验收句后段按裁决 A 三段口径（291–301、AC-25 692），偏离标注齐全（63 / 298 / 692 / 740 / 1699）。 |
| **A②** 功能点六要素与规划语义一致 | **PASS** | §2.2~§2.14 六要素齐全；§2.5 未知状态「被阻塞 + 状态未知」（168，裁决 D）；§2.13 四种降级与裁决 A 对应（299–303）；§2.3 的基线 450 对照与投影口径经实跑复核（§6#1~#5）。 |
| **A③** 规划「范围外/留待后续」未被写成范围内 | **PASS** | 通知/跨实例队列/审批/重派/终止 → I1.11（60）；过期/指纹/治理/预算/生态/性能 → I1.12（61）；多宿主/Web → I2.4（62）；深链 → 裁决 A（63）；窗口级 → 裁决 B（64）；AC-24 断言面板只有「继续/取消」（683–686）。 |
| **A④** 向后兼容有落点 | **PASS** | §1.3 红线（73–78）、BR-28（386）、AC-34（799–812）、D-13（1614–1620）：三条主链、CLI 格式、`USAGE_LINES` 25、I1.10a 44 条 AC 与 A-1~A-14 不变；AC-34 按裁决 G 三段式判定。 |
| **A⑤** 无夹带 | **PASS** | 反向扫描 ① 零夹带。 |
| **B①** 规划条目 ↔ §2.1 / 对账表零缺漏 | **PASS** | §2.1 13 行（86–100）与对账表 13 行（1684–1696）逐项对应。 |
| **B②** 基线 §3/§4/§5.2/§6 相关处都有落点 | **PASS** | 见 §2.2 表：全部覆盖，无残留冲突。 |
| **B③** §2.15 衔接覆盖验收句完整流程（含失败路径） | **PASS** | §2.15 十步（326–335）+ 降级分支 14 条（339–353）逐条挂 AC；AC-29 的构造缺口已闭合，九步覆盖 Then 7 条。 |
| **B④** 43 条 BR 覆盖每条用户可见规则 | **PASS** | 实跑 BR 43/43 双向覆盖：无未引用、无幻引用（§8.1）。 |

**§3 判定：PASS。**

---

## §4 第三部分（C 符合规划 / D 罗列全面）

| 判据 | 结论 | 依据（AC 号 / 行号） |
|---|---|---|
| **C①** 验收句逐字 → AC 且不被弱化 | **PASS** | 前段：AC-29（736–753，九步 / 七条逐条）；中段：AC-17（597–606）+ AC-29 Then 7；后段：按裁决 A / I 由 AC-25（688–701）三段判定，AC-29 740 明示不声称后段语义已达成。语义强度未被放宽。 |
| **C②** Given/When/Then 用户视角 | **PASS** | 51 条 Then 基本为用户可见结果；`bold`/`scrollTarget`/`≤200ms`/`anchorRowTop`/`opCount` 等字段级与时序断言已全部移入「机检（内部断言）」并标注（判定口径第 7 条 417 行；AC-06 483、AC-28 732、AC-42 898、AC-43 909 实点）。 |
| **C③** 失败/异常/超限路径有 AC | **PASS** | AC-18（三种降级）、AC-23（两种异常 + 真守卫复核）、AC-26（三种降级）、AC-31（四类运行期异常）、AC-45（继续失败）、AC-46（唤起失败）、AC-48/AC-50（状态词翻转 / 绑定归零）、AC-37~AC-44（DAG/卡片/长列表/空态边界）。 |
| **C④** 每条 AC 三件套 + **可执行锚点** | **PASS（round4 FAIL → 本轮闭合）** | 机械面 51/51 有 `场景类型/风险/引用/Then/机检/夹具/架构检查`（§8.1）；round4 的四处锚点不符（AC-08 / AC-19 / AC-29 / AC-50）已全部修实（§1 F4-01/02/03/04），且本轮对 11 条必查 AC 实跑/实点无「不符」（§6）。 |
| **D①** §2 每个功能点（含异常/边界）→ ≥1 AC | **PASS** | §2.2→AC-01/02/31/37/48/50；§2.3→AC-01/03/04/37/48/50；§2.4→AC-05/38/39/40；§2.5→AC-07/08/09/10/35/41；§2.6→AC-06；§2.7→AC-11~15/20；§2.8→AC-16；§2.9→AC-17/18/36；§2.10→AC-19/42/43/51；§2.11→AC-20/21/44/49；§2.12→AC-22/23/45；§2.13→AC-25/26/33/46；§2.14→AC-27/28/47/48/50。 |
| **D②** 规划每条目 → ≥1 AC | **PASS** | 13 行对账全部有 AC（§2 表）。 |
| **D③** BR 双向覆盖 | **PASS** | 43/43，无未引用、无幻引用（§8.1）。 |
| **D④** §3.2 非功能、§3.3 前置齐全且用户视角 | **PASS** | NF-1~NF-7 齐全且全部挂判定锚点（NF-1→AC-01/06/17，NF-2→AC-27/47，NF-3→AC-22/23，NF-4→AC-28，NF-5→AC-28/22 + `readonly-local` 仅记录，NF-6→AC-34，NF-7→AC-30）；§3.3 含环境、夹具顺序、接缝口径、回归基线三段式（1026–1033）、人工核验项（1035）。 |
| **D⑤** AC 编号连续无重复 | **PASS** | `grep -cE '^\*\*AC-'` = 51；连续性扫描无 GAP（§8.1）。 |

**§4 判定：PASS。**

---

## §5 基线与模板合规 + 附录 A~D 完整性

- **模板三条硬约束**：§2 用户视角（实现细节集中 D-1~D-14）；Then 无接口返回字段 / 日志内容（时序与字段级断言已分层进机检，口径第 7 条）；BR/AC 编号与双向引用齐全。**PASS。**
- **括号指引 / 占位符**：`待补充|TBD|TODO|XXX|[需求标题]|填写指引` 仅命中 1 处（889 行）——该处是 AC-41「来源置换」断言里的**测试注入值**（"把投影注入的标题值改为 `TBD`"），属断言内容，不是撰写指引残留。**PASS。**
- **8 节结构**：§1 背景/目标/范围（含回归红线）；§2 总览 + 13 功能点 + 衔接 + BR-01~BR-43；§3 AC/NF/前置；附录 A~D。**PASS。**
- **版本一致性**：头部 v5（7 行）= 附录 C 末条 v5（1456 行），附录 C 对 v1~v5 每轮 F 项逐条留痕。**PASS。**
- **状态词与基线一致性**：节点（8 档排序对齐基线 489，实点逐字一致）、会话（6→5+无会话）、角色（五词 + `retired`→`inactive`，`graph.js:117` 实点）、交接包（7 词 + 聚合优先级基线 395）、看板 7 列（`labels.js:101-107` 实点逐字一致）。**PASS。**
- **附录 A~D 齐全**：A-0~A-10（A-1 七行经真实 `buildRoleInstances` 实跑可产出，§6#1~#9）；B-1/B-2（U-01~U-16）；C（v1~v5）；D-1~D-14（D-10 授权行号 `routes.js:307-330` 返回表、`server.js:337-360` 白名单、`app.js:1521` `__MAESTRO_CTL__` 均实点吻合；D-11 行号 63/131/310 与 147 键实点吻合，`UI_LABEL_KEYS` 实测 147）。**PASS。**
- **契约锚点登记**：D-14 表 A 共 **5 条**（A1 drill-dump、A2 applyTestOverlay、A3 返回导航、A4 io.continueEscalation、A5 ensureStreams().drill）——A2 的 `stream.js:255/650` + `server.js:318`、A5 的现状 `app.js:1477` 均实点吻合；表 B 4 条（B4 已按 `connection.js:172/173` 事实更正）；表 C 1 条待验事实（裁决 I）；表 D 15 条（F4-11）。**PASS。**
- **31 词纯净扫描 / 零依赖**：两处 `purity-check.mjs --forbid <31 词>` 均 `OK … 零命中，exit 0`；`dependencies` 为 `{}`。**PASS。**

---

## §6 判定锚点实测抽查表

> 全部在 `D:/WWW/Maestro` 根执行；HEAD `66e5a6b`。`desktop/ui/drill/**`、`src/daemon/drill.js`、`src/adapter/host-open.js`、`test/wp14/**`、`probe/**` 尚未创建（S2 未开工），涉及它们的锚点按 D-14 表 D 记「契约未落地、不计通过」，不冒充通过也不判失败。

| # | AC | 命令（摘要） | 实测输出 / exit | 断言 | 判定 |
|---|---|---|---|---|---|
| 1 | **AC-01** | `node --input-type=module` 按 Given 跑真实 `buildRoleInstances`（nodes/sessions 数组 + `stateSince` + `maxRounds:{'T-001':3,...}`） | `busy / ["S1","S2"] / ["T-001","T-002"] / ["dsh","cursor"] / lastAction={T-002,2,3,review,'2026-11-15T10:04:00.000Z'}` | A-1 第 7 行五段 + `lastAction` 含 `stateSince` | **符合** |
| 2 | **AC-04①** | 同式（3 服务中节点 + 3 非空闲会话） | `busy / ["S1","S2","S3"] / ["T-001","T-002","T-003"] / ["dsh","cursor"] / T-002 2/3 review` | A-1 第 4 行（折叠形态 `服务 T-001 等 3 个` 由渲染层折叠，`servingNodes.length===3` 成立） | **符合** |
| 3 | **AC-04②** | 同式（T-010 pending、0 会话） | `available / [] / [] / [] / lastAction={T-010,1,1,pending,…}` | A-1 第 2 行（`服务 —`+`宿主 —` 并存合法） | **符合** |
| 4 | **AC-04③** | 同式（协调者 0 绑定） | `inactive / [] / [] / [] / lastAction=null` | A-1 第 3 行（`最近 —` 后无轮次状态） | **符合** |
| 5 | **AC-37** | 同式（external-auditor 不在注册表，T-021 running + thinking dsh，stateSince 最晚） | `unavailable / statusReason:'unknown-role' / ["S9"] / ["T-021"] / ["dsh"] / lastAction={T-021,1,1,running,'…10:04'}` | 机检逐字段断言 | **符合** |
| 6 | **AC-50（终态投影）** | 同式（该角色绑定归零） | `inactive / [] / [] / [] / lastAction=null` | A-1 第 3 行形态（`角色栏 开发 · 未参与 · 0 个活跃会话 · 服务 — · 宿主 — · 最近 —`）可产出 | **符合** |
| 7 | A-1 第 5 行 | 同式（reviewer：T-020 escalated + escalated 会话） | `unavailable / statusReason:'escalated' / ["S8"] / [] / [] / T-020 2/2 escalated` | `不可用 + 1 个活跃会话 + 服务 — + 宿主 — + 最近 …已升级` | **符合** |
| 8 | **AC-08** | `sed -n '489p' docs/index.md` 对照 BR-06（364）/ AC-08（502–505） | 基线 8 档逐字 ``escalated > failed > running > review > assigned > ready > blocked > done``；v5 同序；rank `[1,2,3,4,5,6,7,8,8]` 与 9 节点顺序逐项自洽 | 8 档对齐、`assigned` 独立档 | **符合** |
| 9 | **AC-19 / A-5** | 读 §2.10（240）、AC-19（623/626）、A-5（1199–1219） | 行时间 `09:12:41` = 时间线末条；4 行时间戳倒序 `['09:12:41','09:12:39','09:05:10','08:58:02']`；标题 `已拒绝 · 2 并行交接` 三处一致 | 行时间 = 最近活动，全表自洽 | **符合** |
| 10 | **AC-23** | `grep -n "ESCALATION_NOT_PENDING\|INSTANCE_NOT_SUSPENDED" src/core … src/cli`；`sed` 实点 | `escalation.js:89`、`orchestrator.js:5049/5052`、`labels.js:336/339`、`main.js:1552(注释)/1554`、`render.js:1125` 全部实点吻合；`src/daemon/` 0 处（与本迭代新增映射的前提一致）；`test.escalate` 在 `server.js:345-346`；`escalation.js:120-160` 内实点 `node.state='escalated'` / `session.quarantined=true` / `state.state='suspended'` | 架构检查 ③ 两侧判据 | **符合** |
| 11 | **AC-25** | `ls` DSH exe；`grep -ao "dsh://…"` 与 `setAsDefaultProtocolClient` 复核 `app.asar` | exe 存在；深链仅 `dsh://open`、`dsh://open/`、`dsh://host`、`dsh://cordis`，无会话级深链 | 裁决 A 平台事实复核 | **符合**（窗口前置 / 剪贴板属人工核验项，不自动判） |
| 12 | **AC-29** | 读 Given（741）/ When（742）/ Then（743–750）/ probe（751） | Then 3 的证据三行与摘要退出码可由 Given ③ 派生；Then 4 两行可由 ④ 派生；九步与 probe 9 段一一对应；⑦ 补齐返回动作 | Given→Then 可派生 | **符合** |
| 13 | **AC-48** | `sed -n '255,275p'`+`586/596p` `stream.js`；`server.js:318` | overlay 只改 `node.status` 与 `edge.aggregateStatus`（连带 visual/labelVisible），写点 `overlay.roles.set` / `overlay.edges.set`；`applyTestOverlay` 定义 255 / 导出 650 / 调用 318 | 「接缝只翻状态词」的 Given 限制属实 | **符合** |
| 14 | **AC-50（代码现状）** | `grep -n "current.view === 'graph'"`；`sed 1444-1451/1488-1495`；`sed 170,175p connection.js`；`sed 460-464/516-520p stream.js` | `app.js:1477` 仅 graph；重连骨架 1444-1451 / 1488-1495 实点；`connection.js:172 retry(){`、`173 if (status !== 'failed')`；首帧 `graph.snapshot` 在 462/518 | 与 D-14 表 A5 / B4 的现状描述逐字一致 | **符合**（drill 分支为契约 A5，未落地不计通过） |
| 15 | **AC-51** | 读 §2.10（248）/ BR-43（401）/ AC-51（990–999）；`sed -n '477p' docs/index.md` | 基线 477 逐字命中；改道留痕齐全；AC-51 判定三次点击落点 | 取舍判定成立 | **符合** |
| 16 | AC-02 | `grep -n "createViewState(" desktop/ui/app.js`；`grep -n "state.viewState = null"`；`grep -n "openGraph\|rebuildGraph"` | `396 / 462`（恰好 2 条，exit 0）；417；`openGraph:310` / `rebuildGraph:389` | 架构检查 ①③④ 实点 | **符合** |
| 17 | AC-16 | `grep -n "DESKTOP_BOARD_COLUMN_" src/daemon/http/labels.js` | 101–107 七列：被阻塞/可调度/执行中/待校验/已完成/失败/已升级 | 列名顺序逐字 | **符合** |
| 18 | AC-22 | `grep -nE "maxRounds" src/templates/index.js` | `code-loop` 的 `maxRounds: {'T-001': 2, 'T-002': 2}`（186） | Given「T-002 maxRounds 2」属实 | **符合** |
| 19 | AC-30 | 两处 `purity-check.mjs --forbid <31 词>`；`node -p dependencies` | 均 `OK … 零命中`，exit 0；`{}` | exit 0 / 零依赖 | **符合** |
| 20 | **AC-34** | `ls test/wp13/*.test.js \| wc -l`；`grep` 基线登记文件；`node -p summary.json gate.tests` | 36；登记文件自述「16 条为本文件登记项」；`gate.tests = 1425` | 点数 36 / 16 条 / 基数 1425 | **符合**（全量串行实跑留待 S3，需求口径与裁决 G 一致） |
| 21 | AC-42/43 | `sed -n '550,556p' src/daemon/graph.js` | 边 id 形如 `E-01`（`E-${…padStart(2,'0')}`，554） | `key` 取 `E-NN` 的写法属实 | **符合** |
| 22 | D-11 | `grep -n "EXPECTED_DESKTOP_KEYS\|VALUES"`；`sed -n '310p'`；`node -p UI_LABEL_KEYS.length` | 63 / 131 / 310；147 | 授权行号实点 | **符合** |
| 23 | D-10 | `sed -n '307,312p' routes.js`；`sed 337-340p server.js`；`grep -n __MAESTRO_CTL__`；`ls src/adapter/dsh-launch.js` | 返回表 307 起；`claimedByHandler` 337 段；`__MAESTRO_CTL__` 1521（在 1517–1531 内）；dsh-launch 存在 | 授权段落实点 | **符合** |
| 24 | 平台事实 | `cargo --version`；`git rev-parse --short HEAD`；`git branch --show-current` | `command not found`；`66e5a6b`；`feat/i1.10b-drilldown` | 裁决 B 前提 / 取数基线 | **符合** |
| 25 | AC-05/06/17 等 drill 侧 | `ls desktop/ui/drill`、`ls src/daemon/drill.js`、`ls test/wp14`、`ls probe/acc10b-jump-verify.mjs` | 全部 No such file（exit 2） | D-14 表 D 的未落地路径 | **契约未落地、不计通过（不判红）** |
| 26 | AC-27/43/47 的 pulse 下发 | 见 #13 | 同上 | 同上 | **符合** |
| 27 | AC-33 | DSH exe + `test.escalate` 接缝实点 | 同 #11/#10 | 真实面/夹具面 Given 属实 | **符合**（自动面留 S3） |
| 28 | AC-49 | 读 BR-42（400）/ AC-49（968–977）；A-8（1269） | 面包屑 `实例 INST-001 / 升级处理` 形态与 A-8 一致；`DRILL_ESC_TITLE \| wc -l = 1` 为契约（drill 未落地） | 判据可执行（S2 后复核） | **符合** |
| 29 | AC-36 | 读 AC-36（825–834） | 段数 `[1,2,3,4]`、`returnCount === 3`、层级数 = 段数同一套定义，`rank` 语义不涉 | Given→Then 自洽 | **符合** |
| 30 | AC-28 | 读 AC-28（725–734）+ NF-4（1006） | `opCount 40 = 10×4`、`fetchCount 30 = 进入×3 组`、Then 无 40 次 | 算术与分层自洽 | **符合** |

**抽查统计：30 组，覆盖 21 条 AC（含全部 11 条必查：AC-01 / AC-04 / AC-08 / AC-19 / AC-23 / AC-25 / AC-29 / AC-37 / AC-48 / AC-50 / AC-51）。符合 26 / 契约未落地 1 组（#25，按 D-14 表 D 口径）/ 不符 0。**

---

## §7 本轮清单 F5-01 …

> 严重度：`阻断` = 落在四类边界内（内部自相矛盾 / 基线或规划逐字冲突 / 判据不可判定 / 覆盖面缺漏）；`建议` = 不阻断，移交 S1 拆分 §7 风险 / S2 实现期处理。

**阻断项：无。**

**建议项（全部「建议·移交 S1 §7」，不得作为 FAIL 依据）：**

- **F5-01｜AC-50 的 `state-b.json` 替换与核心运行期写盘的竞态仍未证明**（承 round4 §9-1）：核心存活期间可能回写 `state.json` 覆盖夹具替换，`rev` 冲突行为未实测。需求已把它限定为「夹具动作，不主张产品可达」（983–984）并要求留两份快照的 `rev`/哈希证据，判定路径可执行，但建议 S2 开工先做一次最小实验（替换后观察核心是否回写），若竞态成立再回改 AC-50 的构造方式（如先 `orch core stop` 再替换重进）。**不移交本轮阻断**：判据本身可判定，失败形态有明确归属。
- **F5-02｜AC-42 / AC-43 的滚动指标只有模型坐标承载**（承 round4 §9-2，F4-14 已加承载说明缓解）：`scrollElapsed ≤ 200ms`、`anchorRowTop` 差 ≤ 1px 在纯模块面是模拟值；用户可感的「滚得到、行对、不空白、不卡」已由 Then 承担，风险限于内部回归信号的灵敏度。建议 S2 按 D-9 的承载方式实现，并在验收报告中保留人工核验一项「长列表滚动手感」。
- **F5-03｜`sessionId` ↔ DSH 落盘目录名仍是待验事实**（裁决 I / D-14 表 C1 已登记）：若 S2 首日实测不一致，「在 DSH 中按标识定位」的提示文案对用户不可用（产品体验落空），但 AC-25 的判定强度不受影响（只判「标识 == `state.sessions[].sessionId`」）。建议 S2 首日按 C1 实测并按处理规则补注 / 删说法；若不一致，可考虑把 A-7 第二行文案在后续迭代改为不承诺定位方式（不在本迭代改判据）。

---

## §8 实跑命令与输出摘要

### 8.1 编号、字段与 BR 双向覆盖

```bash
grep -cE '^\*\*AC-' docs/iterations/iteration-10b/requirement.md   # 51
grep -cE '^- \*\*BR-' docs/iterations/iteration-10b/requirement.md  # 43
grep -cE '^- \*\*NF-' docs/iterations/iteration-10b/requirement.md  # 7
# AC 连续性扫描：无 GAP（awk NR>1 && $1!=prev+1 零输出）
node -e "…BR 双向…"   # BRs: 43 | uncited: none | phantom: none；AC 引用行 51
grep -nE "待补充|TBD|TODO|XXX|\[需求标题\]|填写指引" …
# 仅 889 行命中（AC-41 来源置换断言的测试注入值，非指引残留）
grep -n "记录 无" …    # 仅 1462 行（附录 C 变更留痕），正文零残留
grep -n "^\- \*\*版本\*\*" …  # v5；附录 C 末条 v5（1456）
```

### 8.2 真实 `buildRoleInstances` 投影实跑（AC-01 / AC-04 / AC-37 / AC-50 / A-1#5）

```bash
node --input-type=module   # 输入 {state, graph, roles}；nodes/sessions 为数组、节点带 stateSince、maxRounds 按 nodeId 键
# AC-01 dev   => busy / ["S1","S2"] / ["T-001","T-002"] / ["dsh","cursor"] / {T-002,2,3,review,'2026-11-15T10:04:00.000Z'}
# AC-04① dev => busy / ["S1","S2","S3"] / ["T-001","T-002","T-003"] / ["dsh","cursor"] / 同上
# AC-04② tst => available / [] / [] / [] / {T-010,1,1,pending,…}
# AC-04③ crd => inactive / [] / [] / [] / null
# AC-37      => unavailable / unknown-role / ["S9"] / ["T-021"] / ["dsh"] / {T-021,1,1,running,'…10:04'}
# AC-50 归零 => inactive / [] / [] / [] / null（= A-1 第 3 行形态）
# A-1#5      => unavailable / escalated / ["S8"] / [] / [] / {T-020,2,2,escalated,…}
```

### 8.3 代码锚点实点（节选）

```bash
grep -n "current.view === 'graph'" desktop/ui/app.js                     # 1477
grep -n "state.viewState = null" desktop/ui/app.js                       # 417
grep -n "createViewState(" desktop/ui/app.js                             # 396 / 462（恰好 2）
sed -n '1444,1451p;1488,1495p' desktop/ui/app.js                          # scheduleReconnect / 图流 onStatus closed
sed -n '170,175p' desktop/ui/connection.js                                # 172 retry(){ / 173 守卫
sed -n '460,464p;516,520p' src/daemon/http/stream.js                      # 首帧 graph.snapshot（462/518）
grep -n "applyTestOverlay" src/daemon/http/stream.js src/daemon/http/server.js
# stream.js:255（定义）/ 650（导出）；server.js:318（既有唯一调用）
sed -n '255,275p' src/daemon/http/stream.js                               # 只改 node.status / edge.aggregateStatus(+visual/labelVisible)
sed -n '586p;596p' src/daemon/http/stream.js                              # overlay.roles.set / overlay.edges.set
grep -n "ESCALATION_NOT_PENDING\|INSTANCE_NOT_SUSPENDED" src/core/escalation.js src/core/orchestrator.js src/cli/labels.js src/cli/main.js src/cli/render.js
# escalation.js:89 / orchestrator.js:5049,5052 / labels.js:336,339 / main.js:1552(注释),1554 / render.js:1125
grep -n "test.escalate" src/daemon/server.js                              # 345-346
sed -n '120,160p' src/core/escalation.js | grep -E "escalated|quarantined|suspended"
# node.state='escalated' / session.quarantined=true / state.state='suspended'
sed -n '489p;477p' docs/index.md                                          # 8 档排序与 477 行逐字原文
sed -n '101,107p' src/daemon/http/labels.js                               # 看板 7 列逐字
grep -nE "maxRounds" src/templates/index.js                               # code-loop: {'T-001':2,'T-002':2}（186）
sed -n '550,556p' src/daemon/graph.js                                     # 边 id E-NN（554）
grep -n "EXPECTED_DESKTOP_KEYS\|EXPECTED_DESKTOP_VALUES" test/wp13/labels-desktop.test.js  # 63 / 131；310 行 147 断言
node -p "Object.keys(require('./src/daemon/http/labels.js').UI_LABEL_KEYS).length"        # 147
sed -n '307,312p' src/daemon/http/routes.js                                # 返回表起点
grep -n "__MAESTRO_CTL__" desktop/ui/app.js                                # 1521
ls src/adapter/dsh-launch.js                                               # 存在
```

### 8.4 门禁与平台事实

```bash
node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>
# OK: 扫描 30 个文件 … 零命中；exit 0
node test/fixtures/purity-check.mjs --dirs desktop/ui,desktop/harness --forbid <31 词>
# OK: 扫描 21 个文件 … 零命中；exit 0
node -p "JSON.stringify(require('./package.json').dependencies||{})"       # {}
ls test/wp13/*.test.js | wc -l                                             # 36
grep -n "16 条" docs/iterations/iteration-10a/baseline-failures-win32.txt  # 「另外 16 条为本文件登记项」
node -p "require('./docs/iterations/iteration-10a/summary.json').gate.tests"  # 1425
ls "$LOCALAPPDATA/Programs/DeepSeek Harness/DeepSeek Harness.exe"          # 存在
grep -ao "dsh://[a-zA-Z0-9/_?=.&-]*" "$LOCALAPPDATA/…/resources/app.asar" | sort -u
# dsh://cordis / dsh://host / dsh://open / dsh://open/（无会话级深链，裁决 A 复核）
grep -ao 'setAsDefaultProtocolClient("dsh")' …/app.asar                     # 恰 1 处
cargo --version                                                             # command not found
git rev-parse --short HEAD ; git branch --show-current                      # 66e5a6b / feat/i1.10b-drilldown
```

### 8.5 未实跑项（不冒充已跑）

- **全量 1425 条串行测试**：未跑（会写 `evidence/**`，与只读约束冲突）；按裁决 G 只核基数（`gate.tests=1425`）、16 条登记项与判定公式，全量实跑留 S3。
- **`desktop/ui/drill/**`、`src/daemon/drill.js`、`src/adapter/host-open.js`、`desktop/harness/drill-dump.mjs`、`test/wp14/**`、`probe/**`**：S2 未开工，相关锚点按 D-14 表 D 记「契约未落地、不计通过」。
- **真实 DSH 窗口前置 / 剪贴板内容**：按裁决 B 属人工核验项；本轮只核 DSH exe 存在、`cargo` 缺失与 `app.asar` 深链事实。
- **`test.escalate` 端到端演出 / `resolveEscalation` 实跑**：属 S3 验收面，本轮只实点接缝代码与错误码定义处。

---

## §9 最可疑但无法证伪的点（供主控判断，未计入 F5 阻断）

1. **AC-50 的最小实验结论未知**：`state-b.json` 替换后核心是否回写、`rev` 冲突如何表现，只有 S2 开工后的最小实验能回答（F5-01）。需求已把失败形态限定为「夹具动作」并留证，风险可控但未消除。
2. **「最近活跃」规则的时钟来源**：AC-25 的 `lastChangedAt` 由实例状态供给，但核心写 `lastChangedAt` 的精度与同秒并列行为未实测；若两条会话同秒，`maxBy` 的 tie-break 未定义。建议 S2 在夹具中确保三条 `lastChangedAt` 秒级互异（本轮 Given 已写「互不相同的 `lastChangedAt`」，风险低）。
3. **drill 路由「每次 `loadState` 读盘、不缓存」是实现承诺而非现状**：AC-25 翻转复检与 AC-50 重取都依赖它；现状 `src/daemon/http/**` 的既有路由是否全为无缓存读盘未逐条核（`routes.js` 既有处理器为只读实取，倾向成立）。S2 落地后由 AC-25 翻转复检自动兜底。
