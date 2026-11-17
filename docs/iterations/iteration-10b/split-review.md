# I1.10b 拆分与契约评审报告（split-review）

> 评审对象：`docs/iterations/iteration-10b.md`（S1 拆分文档）
> 判据来源：`requirement.md` v5（51 AC / 43 BR / 7 NF，机械取号实跑核实）、`requirement-understanding.md`、`decisions.md`（裁决 A~I）、`progress.md`、`execution-template.md` §1.3/§1.4/§1.5/§3.3、代码现状实跑
> 评审日期：2026-11-16｜评审 Agent：拆分与契约评审（干净上下文，只读，本文件为唯一可写产物）

---

## §0 总判

**总判：FAIL（阻断 1 / 建议 4）。**

唯一阻断为 WP-2 的独立可验收性（模板 §1.4 硬规则 2 实质违反，见 §5 疑点 2 与 SR-01）；其余维度（需求唯一性、8 节骨架、文件级契约与 D-14 一致性、AC 满覆盖、风险覆盖、行号真实性）全部 PASS，且行号抽查 **30 处全部实点吻合、0 处不实**。阻断修正方向明确且不触碰需求（不增删 AC / 不放宽 Then），修复成本小。

**评审方式（实跑命令清单）**：

| # | 命令 | 用途 |
|---|---|---|
| 1 | `grep -n "^## " docs/iterations/iteration-10b.md` | 8 节骨架 |
| 2 | `grep -cE '^\*\*AC-' / '^- \*\*BR-' / '^- \*\*NF-' requirement.md` | 需求条数 = 51 / 43 / 7 |
| 3 | Node 脚本：提取 §4 各 WP 负责文件求交集 | 零交集 |
| 4 | Node 脚本：提取 §4 映射表 AC→WP 行比对 AC-01~AC-51 | 满覆盖 / 缺号 / 重号 / 主责分布 |
| 5 | `sed -n` / `grep -REn` 对 `app.js` / `connection.js` / `stream.js` / `server.js` / `routes.js` / `labels.js` / `escalation.js` / `orchestrator.js` / `role-instances.js` / `dsh-launch.js` / `cli/{labels,main,render}.js` / `graph.js` / `daemon/server.js` / `labels-desktop.test.js` / `collect.mjs` / `graph-dump.mjs` | 行号与签名抽查 30 处 |
| 6 | `ls test/wp13/*.test.js \| wc -l`、`grep -c "" baseline-failures-win32.txt` + 全文核对 | 36 文件 / 16 条登记项 |
| 7 | `cargo --version`、`ls desktop/harness/`、`ls probe/ \| grep acc10b`、`ls desktop/ui/board/board.js`、`test -f test/fixtures/purity-check.mjs desktop/ui/graph/layout.js` | 平台事实与既有文件存在性 |

---

## §1 八节骨架与退出标准核查（维度 B：PASS）

- **8 节齐全且顺序正确**：`grep -n "^## "` 输出 0~8 共 9 个节标题（`iteration-10b.md:11,54,134,195,340,458,502,531,549`），节号与模板 §1.3 表格逐节对应；§8 标题「与需求 v5 的对齐声明」属模板明示允许的措辞差异（模板 §1.3 首段）。PASS。
- **§0 退出标准可量化**：7 条全部带数字或逐字口径（`iteration-10b.md:42-50`）：① 51/51 + 每条 ≥4 份原始帧（数字来源合法：模板 §3.3「每条 AC 至少 4 个证据文件」）；② `tests ≥ 1425` + 差集 = 0 + 两稳定红豁免；③ USAGE_LINES 25 / `147 + N`；④ purity `exit 0` + deps `0`；⑤ D-14 表 A 5 条 + 表 D 15 条 + 表 C1 首日实测；⑥ `git show --stat` 逐 WP 核对；⑦ NF-1~NF-7 逐条带锚点 AC 号。无「功能做完」类不可判定表述。PASS。
- **§1 被否决项**：§1.1~§1.11 共 11 个决策段逐一核查（`iteration-10b.md:60-61,68-71,77-79,85,91-94,100-102,108,114,120,125,130`），每段均含「被否决」方案及原因，无缺漏。PASS。

## §2 需求符合性（维度 A：PASS）+ 冲突清单完整性

- **AC 集合零增删**：映射表机械比对 = 51 行、AC-01~AC-51 连续、无缺号、无重号（§8 命令 4 输出）；拆分未出现 AC-52 或合并编号；`grep -cE '^\*\*AC-'` = 51 未被改动。
- **In scope 对齐**：§0 表 11 行逐条对应需求 §1.3「范围内」11 条（`requirement.md:44-56`），AC 落点与 §4 映射表主责一致（抽查条目 9：AC-22/23→WP-2、AC-24/44→WP-3、AC-45→WP-4，与映射表 `iteration-10b.md:423,425,446` 一致）。范围外摘要未收窄（`iteration-10b.md:33-39` 与 `requirement.md:58-69` 逐条对得上，深链条目完整保留裁决 A 偏离说明）。
- **不放宽 Then 抽查**：WP-4 `drill-live.test.js` 交付描述（`iteration-10b.md:375`）逐项对应 AC-27/32/47/48/50 的机检断言原文（`requirement.md:721,784,953,964,986`），无弱化；WP-6 AC-29 九步探针序列（`iteration-10b.md:393`）与需求 `requirement.md:742,751` 逐字一致。
- **§8.2 冲突清单 12 条逐条核实**（`iteration-10b.md:567-582`）：行 1/2/3（规划 871/874、基线 477/869、基线 450）、行 4（`app.js:1477`）、行 5（`app.js:410-417`，417 行 `state.viewState = null`）、行 6（`stream.js:255-275,586`）、行 7（`orchestrator.js:5051-5052` 守卫）、行 8（`escalation.js:89` / `orchestrator.js:5049/5052`）、行 9/10（16 条登记项含 `lsof` 与 `readonly-local` 两稳定红，文件全文核对 16 条属实）、行 11（`cargo --version` = command not found 实跑）、行 12（`labels-desktop.test.js:310` = `147`）——**12 条现状实点全部实跑吻合，每条均引裁决出处**。
- **无「顺手消化」**：唯一疑似处为 §2.3 role-bar.js 约束段（`iteration-10b.md:162`）对 AC-03 锚点（`statusReason|decideStatus` 零命中）与 AC-37 断言（`roleBar.statusReason === 'unknown-role'`）张力的解释。复核后判定**不构成违宪**：需求 AC-32 自身已声明「锚点指向被禁的语义而不是常量名」（`requirement.md:786`），拆分只是复述该语义口径。但该张力应在 §8.2 留痕（见 SR-03，建议级）。

## §3 文件级契约与 D-14 落地核查（维度 C：PASS，附 1 处建议）

- **D-14 表 A 五条全部落地到具体文件与函数**（拆分自报锚点总表 `iteration-10b.md:137`）：
  - A1 → §2.4 `desktop/harness/drill-dump.mjs::main`（`iteration-10b.md:174`）：`export async function main(argv: string[]): Promise<number>`（0/1/2 退出码）+ CLI 形态与输出 JSON 七键，与 `requirement.md:1630` 表 A1 签名**逐字一致**；「仿 graph-dump.mjs 的 parseArgs/fail 形态、--payload 既可输入也可输出」经实跑 `graph-dump.mjs:38,45` 与文件头 10-15 行注释核实为真。
  - A2 → §2.1 `routes.js` 第二调用点（`iteration-10b.md:150`）：调用既有 `createStreamHub().applyTestOverlay(graph, instanceId)`、不改 overlay 结构——`stream.js:255` 定义 / `650` 导出 / `server.js:318` 既有唯一调用，三处实点吻合；未新增推送通道 / 事件类型（裁决 H 第 2 条）。
  - A3 → §2.5 app.js 返回导航方法（`iteration-10b.md:179`）：保留五组视图状态值、不复用三个反例路径——`backToList()` 的 `state.viewState = null` 实点 417 行、`createViewState(` 实跑恰好 2 处（396/462），与 D-14 表 A3「仍恰好 2 条」锚点一致。
  - A4 → §2.5 `io.continueEscalation`（`iteration-10b.md:181`）：签名 `({instanceId, escalationId}) => Promise<{ok, code?, messageKey?, message?}>` 与表 A4 一致；未注入时走真实 POST 的口径也在。
  - A5 → §2.5 `ensureStreams()` 图流条件扩 `graph || drill`（`iteration-10b.md:180`）：实点 `app.js:1477` 现状 `current.view === 'graph'`、重连骨架 1444-1451 / 图流 onStatus 1488-1495 实点吻合；明确「不是新接口、不是新帧类型」（§1.3，`iteration-10b.md:75`）。
- **表 D 15 条随文件落齐**：D1（`iteration-10b.md:141`）、D2~D9（162-169）、D10（149）、D11（174）、D12（187）、D13（191）、D14（180）、D15（170），15/15 存在且签名形式 `契约：<path>::<export>` 合规。
- **缺陷（建议级）**：§2 头部锚点总表（`iteration-10b.md:137`）的节指针有 4 处错位：A2 写「§2.3 routes.js」（routes.js 实在 §2.1）、D1 写「§2.2」（drill.js 实在 §2.1）、D2~D9/D15 写「§2.4」（drill 模块实在 §2.3）、D10 写「§2.2」（host-open.js 实在 §2.1）。契约本体均在正确小节、签名与 D-14 一致，故判建议（SR-02）。同段把契约 A4/A5 列入「冻结点 ②（WP-2 产出）」亦属归属措辞不准（A4/A5 是 WP-4 的 app.js 接缝，冻结的是描述而非 WP-2 产物）。
- **§3 数据模型**：异常态三类齐备——未知状态（`Z-001 mystery`，`iteration-10b.md:211,229,270`）、升级挂起（`T-003 escalated` + `suspended` + pending，且钉死「必须由 test.escalate 真实接缝产出」= D-14 表 B2）、0 会话（`T-010` → `服务 —/宿主 —/最近 T-010`，229 行）；§3.3 补 `unknown-role` / 0 绑定节点两形态。唯一事实来源标注为 `buildRoleInstances` 9 字段投影并引 `role-instances.js:123` 与裁决 H 第 1 条（197 行）——9 字段清单与 `decisions.md:96` 逐字一致；`hostIcons` 只随服务中节点会话（`:72-86`，实点 `hostIconsOf` 73-86 行）与「0 会话却有宿主在投影里不存在」的论断成立。
- **§5 交付物**：35 行 = 新增 30 + 修改 5，与 D-1 / D-10 / D-11 授权清单逐一对上；含 `test/wp14/**` 17 个、`desktop/harness/drill-dump.mjs`、`probe/acc10b-jump-verify.mjs`；`probe/` 目录现存（acc10-* 系列在）、`acc10b-jump-verify.mjs` 尚不存在 = 符合 D-13 契约类定位。PASS。

## §4 WP 硬规则核查（维度 D/E）

**① 文件清单互不重叠（实跑脚本，不采信自检）**：见 §8 命令 3。各 WP 负责文件数（按文档正文）：WP-1×3、WP-2×5、WP-3×15、WP-4×8、WP-5×2、WP-6×2 = **35**，与 §5「35 个登记文件（新增 30 + 修改 5）」一致；两两交集为**空**、无重复登记。PASS。（脚本对 WP-1 多捕 `desktop/ui`、`desktop/harness`、对 WP-5 多捕 `/hosts/open` 系交付行文字噪音，非负责文件清单成员，已人工剔除后复核。）

**② 依赖成 DAG**：边集 WP-2→1、WP-3→{1,2}、WP-4→{1,2,3}、WP-5→{1,2,3}、WP-6→{1..5}（`iteration-10b.md:518`），无环；与各 WP 依赖声明（348/356/365/374/383/392 行）一致。PASS。**但「每包可独立验收」对 WP-2 不成立**——见 §5 疑点 2，判阻断（SR-01）。

**③ 按能力切不按目录切**：六个 WP 各对应一组可独立验证的 AC（WP-1 文案底座 / WP-2 数据面 / WP-3 模块面 / WP-4 装配 / WP-5 跳转判定 / WP-6 守门），无「按目录打包」形态；`app.js` 大文件唯一负责人（WP-4）符合硬规则 1 的唯一负责人要求。PASS。

**④ AC→WP 满覆盖（实跑脚本）**：见 §8 命令 4。映射表 51 行、缺号无、重号无；主责分布 WP-1(1)/WP-2(2)/WP-3(32)/WP-4(10)/WP-5(4)/WP-6(2)，与 `iteration-10b.md:454` 自报分布逐条一致（WP-3 的 32 条清单与脚本输出逐项相同）。机检文件 17 个归属登记（1/1/5/7/1/2）与各 WP 负责文件清单中的 test 文件数吻合。PASS。

**维度 E 五字段**：六个 WP 均具备负责文件(k)/依赖/交付(具体到函数、常量、字段)/验收口径(引 AC 号)/可否并行 五字段（345-396 行），无缺字段。PASS。

## §5 重点核查三疑点的独立判定

**疑点 1：契约 A5 是否只是 `ensureStreams()` 的 view 白名单扩 `drill`；与 A2 是否构成完整取数链 —— 判定：PASS（合规）。**

- 拆分对 `app.js` 的新增边界收敛在四类（§2.5，`iteration-10b.md:178-183`），其中流订阅接缝仅第 2 类「`ensureStreams()` 图流打开条件 `graph || drill`、沿用 `graphStreamId` 去重」，与 D-10 对 app.js 的授权措辞（`requirement.md:1495`）逐字对齐；§1.3 显式声明「不是新接口、不是新帧类型」，全文无新增 SSE 通道 / 帧类型 / `new EventEmitter` 的表述（§1.2 被否决项还反向禁止）。
- 取数链完整性：UI 侧（A5）订阅既有 `/instances/:id/graph/stream` → daemon 侧（A2）下钻路由构建投影后调用既有 `applyTestOverlay` 第二调用点 → `POST /__test__/graph/pulse` 经同一 overlay 对下钻生效。两接缝均「只调用既有导出、不改 overlay 结构」（150 行），满足裁决 H 第 2 条「禁止为下钻另建推送通道或新增事件类型」。**无偷换。**

**疑点 2：WP-2 独立可验收性 —— 判定：FAIL（硬规则 2 实质违反，阻断 SR-01）。**

- 事实：WP-2 负责文件中唯一测试为 `test/wp14/drill-fixtures.test.js`，且拆分自述「夹具构造自检，**不绑定 AC 判定**」（`iteration-10b.md:357`，与 D-9 角色描述一致）；其验收口径明写「**AC 判定的下游契约测试（WP-4/WP-5）在本包合入后执行**」（358 行）；检查点 1 门禁（524 行）不含 7 端点与五个投影导出的任何行为验证。
- 后果：批次 1 收口时，WP-2 的核心交付（5 个投影导出、7 端点、continue 路由转发 `resolveEscalation`、错误码映射、`openHost`）**没有任何包内行为断言**——主责 AC-22/23 的 daemon 面、AC-25/26/46 的 daemon 面（如「连发两次 continue 得 `ESCALATION_NOT_PENDING`」「`/hosts/open` 错误形状」）全部只能等批次 3 的 WP-4/WP-5 才能首次验证。这正属模板 §1.4 硬规则 2「每个包可独立验收：包内自带契约测试」要防的失效形态：批次 1 声称完成但不可验收，形状错了批次 2/3 全线返工。
- 修正方向（不新增文件、不触碰 D-9 的 17 文件清单、不增删 AC）：把**回环接口面的最小契约断言并入 `drill-fixtures.test.js`**（该文件本就自起真实核心 + 接缝，具备条件），覆盖：① 5 条 GET 路由存在且响应形状符合 §3.3~§3.5；② `test.escalate` + `escalate resolve` 产出真实现场后连发两次 continue，第二次 `code === 'ESCALATION_NOT_PENDING'`；③ `/hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` 形状；④ 五个投影导出对夹具快照的基本形状断言。同时在 §8.2 登记该文件角色相对 D-9「不绑定 AC 判定」措辞的扩展（或经主控确认），映射表的 AC 主责归属**不变**（机检文件归属仍按现表）。
- 注：其余五包独立可验收性成立（WP-3 五个模块级测试、WP-4 七个装配测试、WP-5 host-jump 测试、WP-6 两个守门测试均在包内绑定 AC；WP-1 的 labels-drill.test.js 同理）。

**疑点 3：F5-01 竞态实验是否写死为 WP-2 批次 1 第一步 + 回改路径明确 —— 判定：PASS。**

- §7 风险 1（`iteration-10b.md:535`）处置明确三要素：① 时机「S2 开工先做最小实验」且载体点名「WP-2 的 `drill-fixtures.test.js` 第一步」（WP-2 属批次 1，`iteration-10b.md:507-508`）；② 实验内容具体（核心存活时 `state-b.json` 替换根 `state.json`，观察 `rev` 回写）；③ 回改路径明确（「竞态成立则回改构造方式（如先 `orch core stop` 再替换、重进），AC 判定强度不变」+ 留痕落点）。与 progress.md 移交的 F5-01 及 round5 建议口径一致，未改判定强度。**合规。**

## §6 风险覆盖核查（维度 H：PASS）

§7 共 11 条风险，逐条对照必覆盖项（`iteration-10b.md:531-545`）：

| 必覆盖项 | 落点 | 结论 |
|---|---|---|
| progress.md 移交：round5 F5-01 竞态实验 | 风险 1（535 行，WP-2 第一步 + 回改路径） | ✓ |
| progress.md 移交：F5-02 滚动指标模拟承载 | 风险 2（536 行，`handoff-panel.js` 模型坐标 + 注入时钟、人工核验项保留） | ✓ |
| progress.md 移交：F5-03 目录名实测 | 风险 3（537 行，S2 首日 `--check session-dir` 取 3 条、两种结果都不改 AC 强度 = 裁决 I / 表 C1 口径） | ✓ |
| progress.md 移交：契约锚点纪律（exit 2 不判红） | 风险 6（540 行，表 D 口径复核） | ✓ |
| progress.md 移交：真实面 AC-25/33 DSH 依赖 | 风险 4（538 行，不可用判 `阻塞`、不得夹具顶替、检查点 3 登记） | ✓ |
| 裁决 G 全量 flake 三段式 | 风险 5（539 行）+ 退出标准 2（45 行）：`tests ≥ 1425` + 16 条登记项 ∪ 留帧 flake 差集 0、单文件独占复跑、禁 `--no-flake-confirm`、两稳定红豁免 | ✓ |
| 每条风险点名文件/函数 | 11 条均点名（`drill-fixtures.test.js` / `handoff-panel.js` / `probe/acc10b-jump-verify.mjs` / `routes.js` 306-330 / `server.js` claimedByHandler 337-360 与分派段 414-460 / `app.js:137-146` 哨兵 / `orchestrator.js:5051-5052` 等），实点核实：`claimedByHandler` 实存于 `src/daemon/http/server.js`、`test.escalate` 实存于 `src/daemon/server.js:343-352`、`routes.js` 返回表实存 306-330 | ✓ |

## §7 修复清单

| # | 位置 | 原文（摘要） | 违反条款 | 建议修法 | 严重度 |
|---|---|---|---|---|---|
| SR-01 | `iteration-10b.md:357-359`（WP-2 交付/验收）、`:524`（检查点 1） | 「drill-fixtures.test.js 夹具构造自检（不绑定 AC 判定）」「AC 判定的下游契约测试（WP-4/WP-5）在本包合入后执行」 | 模板 §1.4 硬规则 2「每包可独立验收：包内自带契约测试」 | 按 §5 疑点 2 修法：把回环接口面最小契约断言（5 GET 形状 / 连发两次 continue 得 `ESCALATION_NOT_PENDING` / `/hosts/open` 错误形状 / 五投影基本形状）并入 `drill-fixtures.test.js`，检查点 1 增加对应门禁；§8.2 登记该角色扩展；映射表归属不变 | **阻断** |
| SR-02 | `iteration-10b.md:137` | 锚点总表节指针：A2→「§2.3」、D1→「§2.2」、D2~D9/D15→「§2.4」、D10→「§2.2」 | 文档交叉引用错误（契约本体与签名均正确） | 改为 A2→§2.1、D1→§2.1、D2~D9/D15→§2.3、D10→§2.1；同段将 A4/A5 从「冻结点 ②（WP-2 产出）」的归属措辞中拆出（冻结的是 D-14 描述，产物属 WP-4） | 建议 |
| SR-03 | `iteration-10b.md:162` | §2.3 role-bar.js 约束段对 AC-03 锚点与 AC-37 `roleBar.statusReason` 断言张力的解释 | 维度 A：冲突应留痕于 §8.2，避免 S2 各自解读（「statusReason」字面出现在 role-bar.js 会不会击穿零命中 grep） | 把该解释升格为 §8.2 第 13 条，引裁决 F 第 2 条（锚点指向被禁语义）与需求 AC-32 的同口径说明，明确「透传键名以对象展开等不含字面量的写法承载，或以语义判据复核」 | 建议 |
| SR-04 | `iteration-10b.md:366`（WP-3 交付 drill-dag.test.js） | 「联动 scrollTarget」归入 drill-dag.test.js | 契约 D3（`buildDag`）返回对象无 `scrollTarget`/`highlight` 字段，该断言的承载模块未点名 | 在 WP-3 交付里点明 AC-06 断言经 `desktop/ui/drill/index.js::createDrillView({labels, data, interactions})`（契约 D15，170 行）承载，避免机检对象悬空 | 建议 |
| SR-05 | `iteration-10b.md:45`（退出标准 1） | 「每条至少 4 份原始帧」 | 无违反（模板 §3.3「每条 AC 至少 4 个证据文件」），仅提示出处未标注 | 补一句「（模板 §3.3）」标明出处，防止被误读为拆分自加需求 | 建议 |

## §8 实跑命令与输出摘要

```
① grep -n "^## " docs/iterations/iteration-10b.md
→ 11:## 0. / 54:## 1. / 134:## 2. / 195:## 3. / 340:## 4. / 458:## 5. / 502:## 6. / 531:## 7. / 549:## 8.（8 节齐全有序）

② grep -cE '^\*\*AC-' requirement.md → 51；grep -cE '^- \*\*BR-' → 43；grep -cE '^- \*\*NF-' → 7

③ 零交集脚本（提取各 WP「负责文件」行内路径求交）：
   WP-1:3（labels.js改 / labels-desktop.test.js改 / labels-drill.test.js）
   WP-2:5（drill.js / host-open.js / routes.js / server.js / drill-fixtures.test.js）
   WP-3:15（9 drill 模块 + drill-dump.mjs + 5 test）
   WP-4:8（app.js + 7 test）
   WP-5:2（host-jump.test.js / acc10b-jump-verify.mjs）
   WP-6:2（acceptance-drill-e2e / regression-drill）
   合计 35；两两交集 = 空；重复登记 = 无

④ AC→WP 覆盖脚本：映射表行数 51；缺号 = 无；重号 = 无；
   主责分布：WP-3×32（AC-01,03~15,17~21,24,32,35~44,51）、WP-4×10（02,16,27,28,31,45,47~50）、
   WP-2×2（22,23）、WP-5×4（25,26,33,46）、WP-6×2（29,34）、WP-1×1（30）——与 :454 自报一致

⑤ 行号抽查（30 处，全部吻合）：
   app.js:1477(view==='graph') / 1444-1451(scheduleReconnect) / 1488-1495(图流 onStatus closed)
   app.js:410-417(backToList, 417 viewState=null) / 310(openGraph) / 389,396(rebuildGraph+createViewState)
   app.js:462(createViewState#2) / grep -REc "createViewState\(" = 2 / 192(createApp) / 1517-1531(__MAESTRO_CTL__)
   wc -l app.js = 1837 / connection.js:172-173(retry 守卫 failed) / stream.js:192,255,269-271,462,518,586,596,650
   http/server.js:318(applyTestOverlay 唯一既有调用) / claimedByHandler 实存 / routes.js:306-330(三路由返回表)
   http/labels.js:23,31,137 / labels-desktop.test.js:63,131,310(=147) / escalation.js:89 / escalation.js:120-160 段
   orchestrator.js:5049,5051-5052 / role-instances.js:73-86(hostIconsOf),123(buildRoleInstances),23(SERVING=running,review),156
   dsh-launch.js:69(resolveDshLaunch) / cli/labels.js:336,339 / cli/main.js:1552,1554 / cli/render.js:1125
   graph.js:554(E-NN) / daemon/server.js:343-352(test.escalate) / collect.mjs:79-80(只采 /instances 与 /ui/labels)
   graph-dump.mjs:38(fail),45(parseArgs) + 头注(--payload 输入/输出)

⑥ ls test/wp13/*.test.js | wc -l → 36；baseline-failures-win32.txt 全文 35 行、登记项恰 16 条（含 lsof 与 readonly-local 两稳定红）
⑦ cargo --version → command not found；desktop/harness/ = {board-dump,collect,graph-dump,layout-dump,render-list}.mjs
   probe/ 现存（acc10-* 系列）、acc10b-jump-verify.mjs 不存在（符合 D-13 契约类）
   desktop/ui/board/board.js、test/fixtures/purity-check.mjs、desktop/ui/graph/layout.js 均存在
```
