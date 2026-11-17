# I1.10b 拆分与契约评审报告 round 2（split-review-round2）

> 评审对象：`docs/iterations/iteration-10b.md`（修订版，SR-01~SR-05 修复后）
> 判据来源：`requirement.md` v5（51 AC / 43 BR / 7 NF，`grep -cE '^\*\*AC-'` 实跑 = 51）、`decisions.md`（裁决 A~I）、`requirement-understanding.md`、`progress.md`、`execution-template.md` §1.3/§1.4/§1.5、上轮 `split-review.md`（仅用于逐条复核闭合）、代码现状实跑
> 评审日期：2026-11-16｜评审 Agent：拆分与契约评审 round 2（干净上下文，只读，本文件为唯一可写产物）

---

## §0 总判

**总判：PASS（阻断 0 / 建议 3）。**

- 上轮 SR-01~SR-05 **5 条全部闭合**（三态：已修 ×5 / 未修 ×0 / 修了但引入新问题 ×0；其中 SR-01/SR-02 各附 1 处建议级引用滑差，见 §1 与 SR2-01）。
- 全量回归扫描无新增阻断：8 节骨架齐全有序、退出标准 7 条可量化、AC→WP **51/51 双向覆盖**（无缺号 / 无重号 / 无夹带）、35 个登记文件**两两零交集**、§1 十一个决策全部带被否决项、§7 风险覆盖 progress 移交 5 条 + round5 建议 3 条 + AC-25/33 真实 DSH + 裁决 G flake、§8 冲突清单 14 条逐条有可追溯出处。
- 行号与契约抽查 17 处**全部实点吻合、0 处不实**（含本轮修订新增的 `requirement.md:786`、`role-instances.js:123`、`createDrillView` vs D-14 表 D D15 三处）。
- 修订方自报三风险（断言强度边界 / statusReason 语义复核二义性 / 行号漂移）按主控口径属实现期风险：前两条已在 §8.2 第 14 / 13 条留痕充分（无动作）；第三条留痕弱对应（§7 风险 6+8 联合覆盖），记建议 SR2-03，不判阻断。

**实跑命令清单**（摘要，全量见 §5）：

| # | 命令 | 用途 |
|---|---|---|
| 1 | `grep -n "^## " docs/iterations/iteration-10b.md` | 8 节骨架 |
| 2 | `grep -cE '^\*\*AC-'` / `'^- \*\*BR-'` / `'^- \*\*NF-'` requirement.md | 需求条数 51/43/7 |
| 3 | Node 脚本：映射表机械比对（行数 / 缺号 / 重号 / 主责分布 / 一 AC 多主责） | 51/51 覆盖 |
| 4 | Node 脚本：双向覆盖（拆分未引用 AC / 拆分引用但需求没有的 AC） | 防夹带 |
| 5 | Node 脚本：提取各 WP「负责文件」行路径求交集 | 零交集 |
| 6 | `sed -n` / `grep -REc` 对 app.js / stream.js / server.js / routes.js / labels.js / role-instances.js / escalation.js / orchestrator.js / dsh-launch.js / connection.js / labels-desktop.test.js / daemon/server.js | 行号与契约抽查 17 处 |
| 7 | `ls test/wp13/*.test.js \| wc -l`、baseline-failures-win32.txt 登记项计数 | 36 文件 / 16 条 |
| 8 | `ls src/daemon/drill.js src/adapter/host-open.js desktop/harness/drill-dump.mjs probe/acc10b-jump-verify.mjs test/wp14` | 契约类新文件现状（应不存在） |

---

## §1 SR-01~SR-05 三态复核

| # | 上轮位置 | 三态 | 修订版证据（行号） |
|---|---|---|---|
| SR-01 | `iteration-10b.md:357-359` / `:524` | **已修** | ① 断言并入落实：WP-2 交付（`:357`）新增「并入回环接口面的最小契约断言（不新增文件、D-9 文件清单与映射归属不变）」并列 ①~④：**5 条 GET 响应形状**（§3.3~§3.6）、**连发两次 continue 第二次 `code === 'ESCALATION_NOT_PENDING'`**（AC-23① 同口径、真实守卫非桩）、**`/hosts/open` 对 mock 宿主返回 `HOST_UNSUPPORTED` 错误形状**（§3.7）、**五个投影导出基本形状断言**；② 门禁同步且可量化：检查点 1（`:524`）改为「`drill-fixtures.test.js` 全绿且**含 7 端点行为验证**（5 条 GET 响应形状断言各 ≥1、连发两次 continue 第二次 `ESCALATION_NOT_PENDING`、`/hosts/open` HOST_UNSUPPORTED、五个投影导出基本形状断言各 ≥1）」——与 WP-2 验收口径（`:358`「包内契约测试可独立跑通……本包据此满足模板 §1.4 硬规则 2」）逐项对应，判据数字明确；③ 主责归属未被偷改：映射表 AC-22/23 行（`:423-424`）机检文件仍为 `escalation-continue.test.js`（WP-4），`:454` 自报「WP-2×1（drill-fixtures，不绑定 AC）」不变；④ 三处登记一致：§2.6（`:187`「主责归属不变，角色扩展见 §8.2 第 14 条」）/ §5（`:480`「不绑定 AC 判定主责」）/ §8.2 第 14 条（`:584`，并回指上轮 split-review §5 疑点 2）逐字相容；⑤ 未触碰 D-9：`requirement.md:1580` 的 17 文件清单与拆分 §5 合计 35 文件（新 30 + 改 5）均未变。附建议级滑差：新增文字「① 5 条 GET 端点（**§2.2** 追加的…）」的 §2.2 应为 §2.1（routes.js 在 §2.1，`:150`），见 SR2-01 |
| SR-02 | `iteration-10b.md:137` | **已修** | 锚点总表（`:137`）节指针全部改对并逐条实测核对：A1→§2.4（`:174`）、A2→§2.1 routes.js（`:150`）、A3/A4/A5→§2.5 app.js（`:179-181`）；D1→§2.1（`:141`）、D2~D9/D15→§2.3（`:162-170`）、D10→§2.1（`:149`）、D11→§2.4（`:174`）、D12→§2.6（`:187`）、D13→§2.7（`:191`）、D14→§2.5（`:180`）——12 组指针全部指向契约本体实际所在小节；A4/A5 归属措辞已拆出：冻结点 ②（`:521`）末句「其中 A4/A5 冻结的是 D-14 表 A4/A5 的契约**描述**……`app.js` 侧产物归 WP-4，非 WP-2 交付物」。附建议级滑差：`:357` 存留「五个只读投影导出（**§2.2** 全签名）」同类错位（应为 §2.1），见 SR2-01 |
| SR-03 | `iteration-10b.md:162` | **已修** | 已升格为 §8.2 第 13 条（`:583`）：登记 `statusReason` 字面在 `desktop/ui/drill/` 的锚点张力，引**裁决 F 第 2 条**（锚点指向被禁语义）与**需求 AC-32 同口径说明**（`requirement.md:786`「锚点指向**被禁的语义**而不是中文词表常量名」——实跑 `sed -n '780,790p'` 逐字吻合），并给出承载方式（对象展开等不含字面量的写法 / 语义判据复核）；§2.3 role-bar.js 约束段（`:162`）同口径解释保留，两处一致 |
| SR-04 | `iteration-10b.md:366` | **已修** | WP-3 交付（`:366`）已点名承载模块：「联动 scrollTarget（**AC-06 断言的承载模块为 `desktop/ui/drill/index.js::createDrillView({labels, data, interactions})`，契约 D15（§2.3）**——`buildDag`（D3）返回对象无 `scrollTarget` 字段，避免机检对象悬空）」；与 D-14 表 D D15（`requirement.md:1665` `契约：desktop/ui/drill/index.js::createDrillView`）路径与导出名逐字一致（表 D 未登记参数形状，拆分的 `{labels, data, interactions}` 为细化、无冲突） |
| SR-05 | `iteration-10b.md:44` | **已修** | 退出标准 1（`:44`）已补出处：「每条至少 4 份原始帧（**出处：模板 §3.3「每条 AC 至少 4 个证据文件」，非本拆分自加需求**）」 |

**三态统计：已修 5 / 未修 0 / 修了但引入新问题 0**（SR-01/SR-02 的引用滑差属建议级文风类，按主控阻断边界不判入三态失败）。

---

## §2 回归扫描

**① 8 节骨架**：`grep -n "^## "` → `11:## 0. / 54:## 1. / 134:## 2. / 195:## 3. / 340:## 4. / 458:## 5. / 502:## 6. / 531:## 7. / 549:## 8. / 592:## 附录`——0~8 节齐全有序，节号与模板 §1.3 一致；§8 标题「与需求 v5 的对齐声明」属模板明示允许的措辞差异。**PASS**。

**② 退出标准 7 条可量化**（`:42-50`）：① 51/51 + 每条 ≥4 帧（出处已标模板 §3.3）；② `tests ≥ 1425` + 允许集合差集 = 0 + 两稳定红豁免（裁决 G 三段式）；③ 三主链逐字 / `USAGE_LINES 25` / `147 + N`；④ purity 双目录 `exit 0` + `deps 0`；⑤ D-14 表 A 5 条 + 表 D 15 条 + 表 C1 首日实测；⑥ `git show --stat` 逐 WP 核对；⑦ NF-1~NF-7 逐条带锚点 AC 号。无「功能做完」类表述。**PASS**。

**③ AC→WP 满覆盖（实跑脚本，双向）**：
- 需求 AC 数 51（唯一 51）；拆分引用未覆盖 = **无**；拆分引用但需求没有（防夹带）= **无**。
- 映射表行数 51；缺号 = 无（AC-01~AC-51 连续）；重号 = 无；一 AC 多主责 = 无。
- 主责分布：`{"WP-3":32,"WP-4":10,"WP-2":2,"WP-5":4,"WP-6":2,"WP-1":1}` ——与 `:454` 自报分布逐项一致（WP-3 的 32 条清单 = 01/03~15/17~21/24/32/35~44/51）。**PASS**。

**④ WP 文件两两零交集（实跑脚本）**：从各 WP「负责文件」行机械提取——WP-1×3、WP-2×5、WP-3×15、WP-4×8、WP-5×2、WP-6×2 = **35**，与 §5「35 个登记文件（新增 30 + 修改 5）」一致；**两两交集 = 无**，重复登记 = 无。**PASS**（脚本输出全文见 §5④）。

**⑤ §1 被否决项**：§1.1~§1.11 共 11 个决策段逐一核查（`:60-61,68-71,77-79,85,91-94,100-102,108,114,120,125,130`），每段均含「被否决」方案及原因。**PASS**。

**⑥ §7 风险覆盖**（`:531-545`，11 条）：

| 必覆盖项 | 落点 | 结论 |
|---|---|---|
| progress 移交 1：round5 F5-01 竞态实验 | 风险 1（`:535`，S2 开工先做、WP-2 `drill-fixtures.test.js` 第一步 + 回改路径 + 判定强度不变） | ✓ |
| progress 移交 2：F5-02 滚动指标模拟承载 | 风险 2（`:536`，`handoff-panel.js` 模型坐标 + 注入时钟 + 人工核验项保留） | ✓ |
| progress 移交 3：F5-03 目录名实测 | 风险 3（`:537`，S2 首日 `--check session-dir` 取 3 条、两种结果均不改 AC 强度 = 裁决 I / 表 C1） | ✓ |
| progress 移交 4：契约锚点纪律（exit 2 不判红） | 风险 6（`:540`，未落地不计通过 + S2 落地后按原期望值复核） | ✓ |
| progress 移交 5：真实面 AC-25/33 DSH | 风险 4（`:538`，不可用判 `阻塞`、不得夹具顶替、检查点 3 登记） | ✓ |
| round5 建议 3 条 | F5-01/02/03 = 风险 1/2/3 | ✓ |
| AC-25/33 真实 DSH | 风险 4 | ✓ |
| 裁决 G flake | 风险 5（`:539`，三段式 + 留帧 + 禁 `--no-flake-confirm` + 两稳定红豁免）+ 退出标准 2 | ✓ |

11 条均点名文件 / 函数 / 命令。**PASS**。

**⑦ §8 冲突清单 14 条**（`:571-584`）：每条均有可追溯出处——第 1 条（裁决 A+I）、第 2 条（需求 §2.10 取舍段 + BR-43/AC-51）、第 3 条（F4-08）、第 4 条（F4-04）、第 5 条（F3-09）、第 6 条（F3-02/裁决 H 第 6 条）、第 7 条（F3-04/裁决 H 第 6 条）、第 8 条（D-3/F2-16）、第 9 条（裁决 G/F2-01）、第 10 条（裁决 G/F2-02）、第 11 条（裁决 B/U-04）、第 12 条（D-11，实点 `labels-desktop.test.js:310` = `147` 已实跑吻合）、第 13 条（裁决 F 第 2 条 + `requirement.md:786`，实点吻合）、第 14 条（split-review SR-01 + 模板 §1.4 硬规则 2）。第 13 / 14 条为本轮修订新增，均已与现状实点 / 上轮评审记录对上。**PASS**。

**⑧ 修订方自报三风险的留痕核验**：
- 断言强度边界 → §8.2 第 14 条（`:584`「该文件不承担 AC-22/23/25/26/46 的主责判定机检，只提供包内独立验收的最小契约面」）+ §2.6（`:187`）——留痕充分，无动作。
- statusReason 语义复核二义性 → §8.2 第 13 条（`:583`，所引 `requirement.md:786` 实点逐字吻合）——留痕充分，无动作。
- 行号漂移 → §7 风险 6（复核纪律）+ 风险 8（授权行段核对）联合覆盖，但未逐字点名「漂移」本身——留痕弱对应，记建议 SR2-03，不判阻断。

---

## §3 行号与契约抽查表（17 处，全部实跑）

| # | 抽查点 | 命令 / 方法 | 实测 | 判定 |
|---|---|---|---|---|
| 1 | `requirement.md:786`（修订新增引用） | `sed -n '780,790p'` | 786 行 = AC-32 架构检查「锚点指向**被禁的语义**而不是中文词表常量名」+ `grep -REn "decideStatus\|statusReason" desktop/ui/drill/` 零命中 | ✓ 吻合 |
| 2 | `role-instances.js:123`（修订新增引用） | `sed -n '120,128p'` | 123 行 = `export function buildRoleInstances({ state, graph, roles } = {})`；`statusReason` 为投影既有字段（文件内 10 处） | ✓ 吻合 |
| 3 | `createDrillView` vs D-14 表 D D15（修订新增引用） | `grep -n "createDrillView" requirement.md` | D15（`requirement.md:1665`）= `契约：desktop/ui/drill/index.js::createDrillView`（新文件聚合入口，未登记参数形状）；拆分 `:170` 与 `:366` 的路径 / 导出名逐字一致，`{labels, data, interactions}` 为细化无冲突 | ✓ 一致 |
| 4 | `app.js:1477` | `sed -n '1476,1478p'` | `if (current.view === 'graph' && current.graphId !== null …)` | ✓ |
| 5 | `app.js:410-417`（417 = viewState null） | `sed -n '410,417p'` | `backToList() {` 起，417 行 `state.viewState = null` | ✓ |
| 6 | `createViewState(` 恰好 2 处 = 396/462 | `grep -REc "createViewState\(" desktop/ui/app.js` | 输出 `2`；396/462 两行均为 `const next = m.createViewState({` | ✓ |
| 7 | `stream.js:255/650` + `server.js:318`（契约 A2） | `sed -n '255p;650p'` / `sed -n '316,320p'` | 255 = `function applyTestOverlay(graph, instanceId)`，650 = 导出 `applyTestOverlay,`；server.js:318 = `hub.applyTestOverlay(graphPayload, instanceId)`（既有唯一调用） | ✓ |
| 8 | `routes.js:306-330`（D-10 授权段） | `sed -n '306,331p'` | `return [ { GET /instances }, { POST /instances }, { GET /workflows } ]` 三条既有路由 | ✓ |
| 9 | `claimedByHandler`（约 337~360） | `grep -n` | 定义于 `server.js:340`，调用于 381 | ✓ |
| 10 | `http/labels.js:23/31/137` | `sed -n '23p;31p;137p'` | 23 = `ROLE_INSTANCE_STATUS_LABEL,`，31 = `export const DESKTOP_LABEL_KEYS = Object.freeze({`，137 = `...flattenTable('ROLE_INSTANCE_STATUS_LABEL', …)` | ✓ |
| 11 | `labels-desktop.test.js:63/131/310` | `sed -n '63p;131p;310p'` | 63 = `EXPECTED_DESKTOP_KEYS`，131 = `EXPECTED_DESKTOP_VALUES`，310 = `assert.equal(Object.keys(UI_LABEL_KEYS).length, 147, …)` | ✓ |
| 12 | `escalation.js:89` | `sed -n '88,90p'` | 89 行 = `return { ok: false, code: 'ESCALATION_NOT_PENDING' }` 所在守卫行 | ✓ |
| 13 | `orchestrator.js:5049/5052` | `sed -n '5048,5053p'` | 5049 = `fail('ESCALATION_NOT_PENDING'…)`，5052 = `fail('INSTANCE_NOT_SUSPENDED'…)` | ✓ |
| 14 | `dsh-launch.js:69` | `sed -n '68,70p'` | 69 行 = `export function resolveDshLaunch({ env = process.env, config = null })` | ✓ |
| 15 | `connection.js:172-173` | `sed -n '172,173p'` | 172 = `retry() {`，173 = `if (status !== 'failed') return status;`（与 D-14 表 B4 口径一致） | ✓ |
| 16 | `daemon/server.js:345-352`（test.escalate） | `sed -n '343,352p'` | `methods['test.escalate']` 接缝实存该行段，转发 `orchestrator.escalateOnce` | ✓ |
| 17 | 平台事实 | `ls test/wp13/*.test.js \| wc -l` / baseline 登记项计数 / `ls` 契约类新文件 | wp13 = **36**；baseline 文件 35 行、登记项恰 **16 条**（含 lsof 与 readonly-local 两稳定红）；`src/daemon/drill.js` / `src/adapter/host-open.js` / `drill-dump.mjs` / `acc10b-jump-verify.mjs` / `test/wp14/` 均不存在（符合 D-14 表 D 契约类定位） | ✓ |

附加核对：`wc -l desktop/ui/app.js` = **1837**（与 §1.1/§7 风险 7 自报一致）；`app.js:1444-1451`（scheduleReconnect 1 秒）/ `1488-1495`（图流 onStatus closed）/ `192-205`（createApp io）/ `1517-1531`（ctl seam）/ `stream.js:462,518`（graph.snapshot 首帧）/ `role-instances.js:72-86`（hostIconsOf）均实点吻合。**0 处不实**。

---

## §4 修复清单 SR2（均为建议级，非阻断）

| # | 位置 | 问题 | 建议修法 | 严重度 |
|---|---|---|---|---|
| SR2-01 | `iteration-10b.md:357` | 两处「§2.2」指针错位：「五个只读投影导出（**§2.2** 全签名）」与新增的「① 5 条 GET 端点（**§2.2** 追加的 drill / nodes / connections / escalations / subworkflow）」——drill.js 五导出签名与 routes.js 5 条 GET 均登记在 **§2.1**（`:141-150`）；后者为本轮 SR-01 修订新增文字，SR-02 同类节指针错位在新文字中再现（`:137` 锚点总表本体已修对）。另：断言①称响应形状「符合 §3.3~§3.6」，但 §3 无 subworkflow GET 的样例（§3.3~§3.7 只覆盖 drill/nodes/connections/escalations/hosts-open） | 「§2.2」改「§2.1」；断言①的形状依据补「+ §2.1 `buildSubflowGraph` 契约（`:146`）」 | 建议 |
| SR2-02 | `iteration-10b.md:357` ④ | 「五个投影导出（状态栏 / 任务卡 / 节点详情 / 连接线 / 升级）」枚举漏「子工作流」：五个导出 = `buildDrill` / `buildNodeDetail` / `buildConnectionPanel` / `buildEscalationList` / `buildSubflowGraph`，括号内五词实为 4 个导出的 5 个面（buildDrill 拆成状态栏 + 任务卡） | 枚举补「子工作流」或改为「五导出（buildDrill / buildNodeDetail / buildConnectionPanel / buildEscalationList / buildSubflowGraph）」；检查点 1（`:524`）用「五个投影导出……各 ≥1」无枚举，不受影响 | 建议 |
| SR2-03 | `iteration-10b.md:542`（§7 风险 8） | 修订方自报风险③「行号漂移」留痕弱对应：§7 风险 6（复核纪律 / exit 2 口径）+ 风险 8（授权行段外溢）联合覆盖，但未点名「S2 编辑致 D-10 行段漂移」本身 | 风险 8 处置补一句：「S2 编辑导致行号漂移时，以符号锚点（函数名 / 导出名，如 `claimedByHandler` / `applyTestOverlay`）为准复核授权段，不以死行号判违规」 | 建议 |

自报风险①（断言强度边界）与②（statusReason 二义性）留痕充分（§8.2 第 14 / 13 条），无需修法。

---

## §5 实跑命令与输出摘要

```
① grep -n "^## " docs/iterations/iteration-10b.md
→ 11:## 0. / 54:## 1. / 134:## 2. / 195:## 3. / 340:## 4. / 458:## 5. / 502:## 6. / 531:## 7. / 549:## 8. / 592:## 附录（8 节齐全有序）

② grep -cE '^\*\*AC-' requirement.md → 51；grep -cE '^- \*\*BR-' → 43；grep -cE '^- \*\*NF-' → 7

③ AC→WP 覆盖脚本（映射表机械比对）：
   映射表行数: 51 | 缺号: 无 | 重号: 无 | 一AC多主责: 无
   主责分布: {"WP-3":32,"WP-4":10,"WP-2":2,"WP-5":4,"WP-6":2,"WP-1":1}
   双向覆盖：需求AC 51（唯一51）| 拆分未引用: 无 | 拆分引用但需求没有(防夹带): 无

④ 零交集脚本（各 WP「负责文件」行路径提取求交）：
   WP-1: 3（http/labels.js / labels-desktop.test.js / labels-drill.test.js）
   WP-2: 5（daemon/drill.js / adapter/host-open.js / http/routes.js / http/server.js / drill-fixtures.test.js）
   WP-3: 15（drill 9 模块 + drill-dump.mjs + 5 test）
   WP-4: 8（app.js + 7 test）
   WP-5: 2（host-jump.test.js / acc10b-jump-verify.mjs）
   WP-6: 2（acceptance-drill-e2e / regression-drill）
   合计 35 | 两两交集重叠: 无

⑤ 行号抽查（§3 表 17 处 + 附加 6 处，全部吻合，0 处不实）

⑥ ls test/wp13/*.test.js | wc -l → 36；baseline-failures-win32.txt = 35 行、登记项恰 16 条

⑦ ls src/daemon/drill.js src/adapter/host-open.js desktop/harness/drill-dump.mjs
   probe/acc10b-jump-verify.mjs test/wp14 → 全部 No such file（符合 D-14 表 D 契约类现状）
   desktop/harness/ = {board-dump,collect,graph-dump,layout-dump,render-list}.mjs（drill-dump 尚未落地）
⑧ wc -l desktop/ui/app.js → 1837
```
