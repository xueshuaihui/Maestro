# I1.8 拆分与契约评审 · Round 2（独立评审，不参与撰写 / 不参与任何一轮修复）

> 评审身份：I1.8「拆分与契约评审工程师」。本轮不采信 `iteration-8.md` §0「修订记录」、§1.5 自检自述、`split-review-round1.md` 修复回执、`decisions.md` 结论自述；全部结论来自逐字读基准文档 + `%TEMP%` 只读脚本机械统计 + 命令 exit code + `src/**` / `test/**` 实文 Grep/Read。

## 0. 总判、阻断与建议

- **总判：PASS**（23 条判据全 PASS、阻断 0，满足任务书「只有全部判据 PASS 且阻断 0 才允许写 PASS」）。
- **阻断：0 条 ／ 建议：0 条**（S-01~S-07 全部「已修」，无「修了但引入新问题」，本轮无新增问题 T-xx；§4 附 3 条非问题级机检口径观察，不构成建议、不影响总判）。
- **逐判据汇总**：A 7 + B 4 + C 7 + D 5 = **23 条；23 PASS / 0 FAIL**。唯一上轮 FAIL 的 **A⑤ 由 FAIL 转 PASS**；上轮 22 条 PASS **全部保持、无改坏**。
- **评审对象**：`docs/iterations/iteration-8.md`（`wc -l` = **812 行**，7 WP，`## 0`~`## 8` 共 9 个 `##` 大节；§0 `:47`「修订记录：R1 按 S-01~S-07 逐项修订…待第 2 轮拆分评审」）。
- **基准输入（逐字读，不采信摘要）**：`requirement.md` **v3 全文 1419 行**（1-360 / 361-720 / 721-1080 / 1081-1419 四段读完；67 AC / 54 BR / 附录 A-1~A-10、D-1~D-13）、`requirement-understanding.md`（§8.1 7 维度 / §8.2 8 冻结点 / §8.3 6 并行风险面）、`review-round3.md`（S0 总判 PASS / 阻断 0 / 建议 0 / DoR 13 全绿）、`execution-template.md` §1.3（8 节骨架）/ §1.4（四硬规则 + WP 五字段）/ §1.5（10 条自检 + 脚本）/ §2.5 / §2.8、`decisions.md`（裁-1~裁-7 全文）、`integration-2026-11-09.md`（§4 五条既有噪声 / O-I2 / `d4b0f94`）、`src/**`·`test/**` 实文。
- **复核方式（实跑命令，全部当场执行）**：`%TEMP%/i18r2-review.cjs` + `%TEMP%/i18r2-review2.cjs`（两个只读 Node 脚本，结果写 `%TEMP%/i18r2-result*.txt`）；`git diff HEAD -- requirement.md`（S-04）、A-3 逐行 diff、§3.6 两段 `JSON.parse`、`node bin/orch.js --help`/`recover`、`USAGE_LINES` 直接断言、`git cat-file -t d4b0f94|0cd113b`、D-11 五条纯净扫描、零依赖、D-9 两文件 `node --test`、三主链 driver、AC-56 四锚点、全量测试。**全量测试改写的 `docs/iterations/iteration-4/evidence/*.json` 已 `git checkout --` 精确还原**（还原后 `git status --short` 该目录为空）。
- **只读纪律**：未修改 `iteration-8.md` / `requirement.md` / `decisions.md` / `src/**` / `test/**`；临时脚本、日志、driver 项目根全部在 `%TEMP%`（`C:\Users\xuesh\AppData\Local\Temp`）。终态 `git status --short` = 评审前既有 `M decisions.md`、`?? iteration-8.md`、`?? split-review-round1.md` + **唯一新建本文件**。`git worktree add --detach`（§6 #6）**未实跑**（会写 `.git/worktrees`，与只读纪律冲突），仅核实 commit 与语法有效，留 S3。

## 1. S-01~S-07 逐条三态复核（改后行号 / JSON.parse / diff / 实核依据）

| 编号 | 三态 | 改后行号 | 实核依据（自己读原文 + 实跑，不采信修订记录） |
|---|---|---|---|
| **S-01**（对应 A⑤，上轮唯一 FAIL） | **已修** | §3.6 `:402`（二次崩溃判定）/ `:404~411`（JSON）/ `:413`（重投失败判定）/ `:415~422`（JSON）；§3.7 `:424~461` | `JSON.parse` 两段均 **OK**：二次崩溃顶层键 `instanceId,state,rev,nodes`，`state=suspended` / `nodes[0].state=escalated` / `round=2`，节点键 `id,state,round,roleId,sessionId` 全来自 §3.2（无自创字段），与 AC-63 `:907~908`、D-8 `:1339`/`:1343` 逐字一致；重投失败 `handoffs[0]` 6 键与 D-3 `:1227` 同形、`state='expired'` / `deliveryAttempts=3`、`escalations` 长度 1 且元素 4 字段 `escalationId,nodeId,round,state` 实读 `src/core/escalation.js:69~81`（`buildEscalation` 返回值）确为**既有字段子集**、`ESC-001` 与 `nextEscalationId`（`:32~39`）一致，与 AC-62 `:899~900`、C-17 `:176`、D-6 `:1321~1322` 逐字一致。两段均逐条标判定 + 唯一事实来源 + 依据。5 类异常态在 §3 全部有内容：检查点写失败（§3.3 `:340` `checkpoint.write_failed` 事件 JSON 样例 + §3.6 `:401`「写失败异常态」判定段）、无检查点（§3.6 `:393~395` JSON）、方言全失败（§3.6 `:400`「三方言全失败降级」判定）、二次崩溃（新增 JSON）、重投失败（新增 JSON）；§3 内 ` ```json ` 块共 9 个。按 round1 判定原则②（等价形式覆盖不因正则未命中判 FAIL）与 S-01 补法（只要求补 2 条 JSON），A⑤ 转 PASS |
| **S-02**（A④ 观察） | **已修** | §2.12 `:231`（统一注记）/ §2.13 `:251` / §2.14 `:257` / §2.15 `:263` | 四处「接口形状：不适用」齐备（机械计数 = 4）；§2.12 注记明写「§2.12~§2.15 统一注记，S-02」「不产出产品 API，无导出签名与入参出参」「该字段对测试与占位文件不适用」。§2.1~§2.11 产品源文件 11/11 四项（导出签名 / 入参出参 / 归属 WP）齐全。无矛盾、无新缺字段 |
| **S-03**（C④ 观察） | **已修** | §7 风险 15 `:770` / 风险 20 `:775` | 风险 15 处置列点名 **`WP-7`** + `test/fixtures/purity-check.mjs` + `src/cli/labels.js`/`render.js`/`main.js` + `DEFAULT_FORBID`；风险 20 处置列点名 **`WP-5`** + `src/cli/labels.js`（`USAGE_LINES`/`NODE_PHASE_LABEL`）+ **`WP-4`** + `src/core/orchestrator.js`。脚本断言「含 WP- / 含 src|test 路径 / 含函数名」三项全 true。与 §7 表头 `:754`「点名文件 / 函数 / AC」一致，且与 S-04「已裁决（不阻塞）」口径互相一致（风险 20 写「字段名 `session_policy`（B-09，按裁-6 已裁决、不改名）」） |
| **S-04**（C⑤ / 裁-6 / 裁-7） | **已修** | §8 冲突 13 `:797` / 如实登记段 `:800~808`（B-09 `:804`）；`decisions.md:26~38` | `git diff HEAD -- docs/iterations/iteration-8/requirement.md` **输出为空**（`git ls-files` 已跟踪，末次提交 `760b8a1 S0 需求定稿 v3`），需求正文 v3 **一字未改**。§8 冲突 13 裁决列改为「**已裁决（不阻塞）**：按需求 `session_policy` 落地、不改名 `session_reuse`、需求正文 v3 一字不改，仅 S1 评审记录与 `decisions.md` 台账（裁-6 / 裁-7）留痕」；`:797` 与 `:804` 均**如实登记**「附录 B 正文仍写『需评审裁决』（定稿文本不动），以 `decisions.md` 裁-6 为最终口径」。全文 `session_reuse` 共 **2 处**（`:797`、`:804`），逐处实读均为「**不改名 `session_reuse`**」语境，产品契约段零改名。`decisions.md` 裁-6 `:30` / 裁-7 `:38` 全文实读，与 §8 措辞一致 |
| **S-05**（C⑦ 观察） | **已修** | §3.7 `:424~461`（登记表 10 行 + A-3 逐字副本 `:439~459`） | 自写脚本抽取比对：需求 `requirement.md` 附录 A-3 代码块 `:1010~1026` **17 行** vs §3.7 `:442~458` **17 行**，**逐行 diff = 空（0 行不同）**。登记表 A-1~A-10 共 10 行，逐节给需求来源行号（`:976~992` / `:994~1003` / `:1005~1027`（代码块 `:1010~1026`）/ `:1029~1039` / `:1041~1050` / `:1052~1060` / `:1062~1064` / `:1066~1071` / `:1073~1075` / `:1077~1079`），与需求实际章节行号一致。§3.7 `:461` 声明「只登记来源，不改写需求附录 A 任何一行」「A-3 17 行是逐字副本」「AC Then 为同文案具体值实例、无措辞改写」；`git diff HEAD -- requirement.md` 为空证明未改写需求附录 A 原文 |
| **S-06**（D① `--help` 观察） | **已修** | §6 检查点 #5 `:722~730`（注 `:725~728`） | 实跑 `node bin/orch.js --help` → **exit 2**、输出 **26 行**：前 25 行为用法块（第 25 行 `  orch workflow dry-run <工作流> [--task <说明>] [--format text|json]`），**第 26 行 `（未知命令：--help）`**；`node bin/orch.js recover` → exit 2 + `（未知命令：recover）`。§6 `:725~728` 注记「--help 未注册，是『未知命令触发用法块』路径，exit 2，输出 25 行用法块 + 第 26 行『（未知命令：--help）』；不得误读为『help 参数可用』」与实跑**逐字一致**；并写明「S3 取证 `USAGE_LINES.length === 25` 与前 8 行逐字，应直接断言 `src/cli/labels.js` 的 `USAGE_LINES` 常量」。实跑 `node --input-type=module -e "import {USAGE_LINES} from './src/cli/labels.js'; …"` → `USAGE_LINES.length = 25`、前 8 行可逐字断言；常量定义 `src/cli/labels.js:183` 实文存在 |
| **S-07**（C② M-7 接缝差集） | **已修** | §6 冻结点 6 `:688` | 冻结点 6 末句补「**另有 2 个现状既有接缝 `MAESTRO_TEST_STOP_AFTER` / `MAESTRO_TEST_DELIVERY_DELAY_MS`（`src/core/orchestrator.js:351`/`:367`）按既有语义复用、不属本迭代新增冻结项**」，并写明「需求环境名 17 与本冻结点新增 15 的差集恰为这 2 项，17/15 差集可机检自洽、无需求外夹带」。Grep 实文核实：`src/core/orchestrator.js:351` = `MAESTRO_TEST_STOP_AFTER`（`parseInt`）、`:367` = `MAESTRO_TEST_DELIVERY_DELAY_MS`（`parseInt`，`isTest` 守卫）——两名与行号逐字一致。与 §3.6 重投失败 `:413`「后者为 S-07 登记的**现状既有接缝**」互相呼应，无矛盾 |

**三态汇总**：已修 7 / 未修 0 / 修了但引入新问题 0。S-01~S-07 逐条按 round1 补法落地，未发现修复动作破坏其它判据（详见 §6 对照表）。

## 2. 23 条判据全量回归逐条 PASS|FAIL（含机械脚本输出）

> 脚本 `%TEMP%/i18r2-review.cjs`（机械统计）+ `%TEMP%/i18r2-review2.cjs`（抽查 / 契约 / 路径），当场重跑；下表引用其 stdout 摘要。判定口径与 round1 §0「判定原则」保持一致（避免双标）：核心要求按严格口径；括号举例/点名方式若以需求原文等价形式或文档声明口径覆盖且可逐字验证，不因脚本正则未命中直接判 FAIL，但登记观察。

| 判据 | 结论 | 依据（行号 / 脚本输出） |
|---|---|---|
| **A①** 8 节 `## 0`~`## 8` 节号·顺序·标题逐字符合模板 §1.3 | **PASS** | 脚本逐字比对 9 个 `##`：`:10/:49/:159/:282/:463/:598/:641/:750/:777`，标题与模板 `:234~244` 表 9 行全 OK |
| **A②** 每 WP 固定五字段齐全 | **PASS** | 脚本：7 WP（`:468/:476/:484/:492/:500/:508/:516`）「负责文件（k）/依赖/交付/验收口径/可否并行」7/7 齐全 |
| **A③** §1 每关键决策「结论 + 理由 + 被否决方案及原因」 | **PASS** | 脚本：`1.1~1.12` 共 12 个决策三段全 true；`### 1.13 被否决项汇总`（`:139`）是汇总表非第 13 个决策；被否决编号 `#1~#26` 计数 = 26 |
| **A④** §2 每文件标「新增/修改 + 导出签名 + 入参出参 + 归属 WP」 | **PASS** | 脚本：§2.1~§2.11 共 11 节「导出签名/入参出参/WP-」三项 11/11 ✓；§2.12~§2.15 逐节「接口形状：不适用」4/4（S-02 已修）；§2.16 边界守护表 11 行标「不改」+ 边界守护 WP |
| **A⑤** §3 数据模型完整样例且含 5 类异常态，标唯一事实 | **PASS**（FAIL→PASS） | §3.1 `:288~309` checkpoint/v1 完整 JSON（与 D-3 `:1210~1231` 同形）、§3.2 `:315~327` state.json 增量键、§3.3 `:335~343` 7 条事件（含 `checkpoint.write_failed`/`session.crash`/`session.slow`）、§3.4 `:352~368` recovery/connections、§3.5 `:375~381` A-6 五行、§3.6 `:387~422` 5 类异常态、§3.7 `:424~461` 登记表。**新增两段 `JSON.parse` OK**（见 §1 S-01）。5 类全在 §3：检查点写失败（§3.3 事件 JSON + §3.6 `:401` 判定）、无检查点（§3.6 `:393~395` JSON）、方言全失败（§3.6 `:400` 判定）、二次崩溃（§3.6 `:404~411` JSON）、重投失败（§3.6 `:415~422` JSON）。按 round1 原则②与 S-01 补法判 PASS |
| **A⑥** §5 三列表含 `test/wp13/**`、新夹具、probe 占位 | **PASS** | 脚本：表头 `\| 路径 \| 内容 \| 归属 WP \|` ✓、数据行 34 行；含 `test/wp13/`（9 文件）、`recovery-driver.mjs`、`human-node-state.json`、`graph-timeout.json`、`probe/acc8-f`、`evidence/**` 全 true |
| **A⑦** §8 有「不新增需求条目、冲突以需求为准」声明与冲突清单 | **PASS** | 脚本：冲突清单 `\| 1 \|`~`\| 14 \|` = 14 行；`:779` 声明「本文档不新增需求条目…两者冲突时**以需求为准**」；含「已裁决（不阻塞）与需如实登记的点」段 `:800~808` |
| **B①** 文件清单互不重叠（两种口径）+ 共享大文件唯一负责人 | **PASS** | 脚本输出：`[口径A §1.5 原样] 登记路径数: 28 \| 跨 WP 交集: （空）`；`[口径B 精确路径] 登记路径数: 30 \| 跨 WP 交集: （空）`；`src/core/orchestrator.js owner: 口径A ["WP-4"] / 口径B ["WP-4"]`（唯一负责人）。7 WP 负责文件（精确口径）WP-1(3)/WP-2(2)/WP-3(4)/WP-4(7)/WP-5(3)/WP-6(7)/WP-7(4) 两两求交为空 |
| **B②** 依赖成 DAG、无环、编号存在、每 WP 可独立验收 | **PASS** | 按 §6 `:670` 权威「依赖边清单」机械提取：`WP-4 ← {WP-1,WP-2,WP-5}`、`WP-3 ← {WP-4,WP-5}`、`WP-7 ← {WP-3,WP-4,WP-6}`；与 §4 各 WP 标题/「依赖」字段逐字一致（WP-1/2/5/6 叶子、WP-4 汇合、WP-3 第 3 层、WP-7 末端）；依赖编号集合 `1,2,3,4,5,6,7`、越界 0；**DFS 发现环：无**；拓扑序 WP-1→WP-2→WP-5→WP-6→WP-4→WP-3→WP-7 全节点可排序。每 WP 自带契约测试（WP-7 按 §2.12/§2.14 改 D-9 两行 + probe 真实面，验收对象可独立定义） |
| **B③** 按能力切不按目录切 | **PASS** | 7 WP 标题（脚本输出）：检查点与持久化契约 / ACP 恢复方言 / 角色 `session_policy` 与会话复用配置 / 恢复编排内核 / 文案与渲染唯一来源 / 测试夹具故障注入与现场构造 / 授权断言架构门禁与真实宿主面取证——全部能力维度，无按目录/文件类型切分 |
| **B④** AC→WP 满覆盖 67/67（映射表存在、无缺/重号、引用真实存在） | **PASS** | 脚本输出：`需求 AC 定义数: 67 \| 去重: 67 \| 需求重号: 无`；`映射表行数: 67 \| 引用去重数: 67 \| 映射表重号: 无`；`需求有、映射表未覆盖: 无`；`映射表引用了不存在的 AC: 无`；`主责列为空/无 WP 号的行: 无`；`主责分布: {"WP-4":39,"WP-1":2,"WP-5":3,"WP-2":8,"WP-6":3,"WP-3":6,"WP-7":6} \| 合计 67`。映射表 `:524~596` 存在；`:465` 声明「验收口径 = 需求 v3 §3.1 同号 Then 逐字口径，只登记锚点、不复制/不改写/不合并/不放宽」 |
| **C①** §0 退出标准逐条可判定且覆盖需求 §1.2 / §3.1 | **PASS** | §0 退出标准 `:37~45` 共 9 条，逐条含数字/逐字口径（脚本断言）：`67/67 AC`、`tests >= 992`、`exit 0`、`USAGE_LINES.length === 25` + 前 8 行逐字、`11 个顶层键`、`d4b0f94`、`NFR-01~08`、真实面判「阻塞」、DoR 13/13。需求 §1.2 指标表 10 行（`:37~46`）逐条被退出标准 1/2/4/5/6/7/8/9 覆盖（10/10，人工逐条比对，与 round1 §3 C① 一致）。脚本「25 行」字面未命中系文档写 `USAGE_LINES.length === 25`（等价逐字口径），不影响可判定性 |
| **C②** §2 文件级契约与附录 D-1~D-13 逐条对齐 | **PASS** | 7 项关键契约脚本「拆分 + 需求双含」抽查：写点顺序「实例记录 → 检查点 → 事件广播」OK、`transit` phase 同一次 CAS OK、`recovery`/`connections` 追加在 `current` 之后 OK、`session_policy` 缺省不注入渲染 OK、`MAESTRO_FAULT=checkpoint_write:fail` OK、`MAESTRO_TEST_RECOVERY_HOLD=after_assign` OK。第 3 项 `resumeOrCreate {restored, dialect, attempts}` 需求侧字面未连写，实读需求 D-4 `:1260~1266`：成功 `{restored:false, dialect:'new'}` / `{restored:true, dialect:'resume'}`，「失败记录 attempts」、全失败 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`——拆分 §1.3 `:70` / §2.4 `:184` / §6 冻结点 3 `:685` 归纳为 `{restored, dialect, attempts}`，语义与 D-4/`:1277` 一致；**该段本轮未改动，上轮已判 PASS，保持 PASS**（附口径说明，不作 FAIL）。§6 冻结点 1~10 逐条写清冻结什么；冻结点 6 补 17/15 差集说明（S-07） |
| **C③** §6 契约先冻结点 ≥8 且逐字写清、整合检查点存在 | **PASS** | 脚本：冻结点 `1.~10.` = **10 个**（`:683~692`）、「逐字冻结」措辞 10 次、「整合检查点」存在且含命令代码块 `:694~746`。对齐理解纪要 §8.2 的 8 条 + 用户点名项 |
| **C④** §7 每条风险有具体处置（点名文件/函数/WP），吸收理解纪要 5 提示 | **PASS** | 脚本：风险行 `1~20` = **20 条**；表头 `:754`「处置（点名文件 / 函数 / AC）」；风险 15/20 处置列「含 WP- / 含 src|test 路径 / 含函数名」三项全 true（S-03 已修）。§7 吸收项逐条命中：风险 1 超集文件 `:756`、2 集成版 `d4b0f94` 基线 `:757`、3 D-9 两行 + `:588~592` 一字不改 `:758`、4 autocrlf `:759`、5 真实面判「阻塞」不得夹具冒充 `:760`、6 I1.7 合入后重跑 `:761`；脚本 6 个关键词全 true |
| **C⑤** 裁-6 是否被遵守（`session_policy` 未被写成 `session_reuse`） | **PASS** | 全文 `session_reuse` = 2 处（`:797`、`:804`），脚本逐处判定「不改名」语境 = true；产品契约段（§2.7~2.9 / §6 冻结点 5 `:687`）用 `session_policy`、零改名。`git diff HEAD -- requirement.md` 为空（需求正文 v3 零改动）。§8 措辞与 `decisions.md` 裁-6/裁-7 一致（S-04 已修） |
| **C⑥** 无挪出范围 / 删合并 AC / 放宽 Then / 夹带规划外新能力（抽查 ≥12 条） | **PASS** | 脚本抽查 **14 条**（AC-01/06/14/25/26/27/51/53/54/56/57/62/63/67，含任务书点名全部），逐条打印「需求 Then 首句 ↔ 映射表主责/协作/备注」，14/14 全部有主责 WP；AC-25/26/27 备注「真实面取证、无 DSH 判阻塞」、AC-53「失败集合差集=0、条数只增不减」、AC-56「I1.7 未合入不依赖 worktree、合入后重跑」、AC-57「阻塞口径」、AC-63「二次崩溃直接升级、不再重建」——**无放宽、无删并、无挪出**。§4 `:465` 声明、§8 冲突 14 `:798`、§0 Out of scope 13 项 `:33` 均在范围内 |
| **C⑦** 需求附录 A 逐字文案未被改写 | **PASS** | A-3 17 行 **diff 空**（S-05）；A-6 五行 §3.5 `:376~380` vs 需求 `:1055~1059` **diff 空**；§3.4 `:371` 连接线行与 A-4 `:1035` 逐字一致；§3.4 / §4 各处 `恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3` 与 A-2 `:999`/A-4 `:1034` 逐字一致。`git diff HEAD -- requirement.md` 为空证明需求附录 A 原文零改动。§3.7 `:461` 声明 AC Then 具体值实例为同文案替换占位符、无措辞改写 |
| **D①** 拆分文档所有命令逐条实跑/核实；门禁四件套 exit 码；driver `--scenario` 取值真实存在 | **PASS** | 见 §3 命令清单。全量测试 exit 1（992/987/5，失败集合与集成说明 §4 五条既有噪声一致、差集 0、条数 992 只增不减，符合 AC-53 口径）；D-11 五条全 exit 0；零依赖 0；三主链 driver `--scenario pass` / `doc-pass` 均 exit 0；`doc-pass.json` 场景文件存在；`--demo` 未使用；`--kill-after` 为 §2.13 声明 S2 新增、未冒充实跑；`git worktree add` 未实跑（只读纪律，仅核实 `git cat-file -t d4b0f94|0cd113b` 均 `commit`、语法有效，留 S3）。脚本「task-loop-driver 含 doc-pass 字面 = false」系 driver 动态枚举场景目录（非硬编码场景名），实跑 exit 0 证明参数真实存在 |
| **D②** §2 引用函数区分「现状已有」与「S2 新增」（新增写成现状已有即 FAIL） | **PASS** | 脚本：10 个新增符号（`CHECKPOINT_SCHEMA`/`buildCheckpoint`/`writeCheckpoint`/`loadCheckpoint`/`checkpointPath`/`selectReusableSession`/`recoverInstance`/`normalizeCapabilities`/`resumeSession`/`loadSession`）在 `src/**` 全 **absent**，且 §2.1~§2.4 逐节标「**新增**」；26 个现状符号（`writeJsonAtomic`/`transit`/`reconcileOnBoot`/`resumeOrCreate`/`USAGE_LINES`/`NODE_STATES` 等）全 **found**。**无「新增被写成现状已有」** |
| **D③** §5 交付物路径可写、无与现有 tracked 冲突 | **PASS** | 脚本：15 个规划新增路径（`src/core/checkpoint.js`、`test/wp13/*` 9 个、`test/fixtures/recovery*` 3 个、`probe/acc8-f-lib.mjs`、`docs/iterations/iteration-8/evidence`）全部 **NOT_EXIST**；`iteration-8.md` 存在但未 tracked（评审对象本身，S1 产物未提交属正常）；无 tracked 冲突 |
| **D④** 三主链基线写成集成版 `d4b0f94`，未误用 `0cd113b` | **PASS** | 脚本：`d4b0f94` **9 次** / `0cd113b` **8 次**；8 处 `0cd113b` 上下文逐条核（`:41/:135/:137/:732/:757/:792/…`）全为「**不是** I1.6 的 `0cd113b`」「不能套 `0cd113b`」「I1.5 `0cd113b` 基线」「#26 被否决：沿用旧基线」等排除/对比语境。`git cat-file -t` 二者均 `commit`；集成说明 `:108/:112` HEAD `d4b0f94`、O-I2 `:80~82` 一致 |
| **D⑤** D-9 两行授权断言行号与实文一致 | **PASS** | 脚本实读：`test/wp11/role-schema.test.js:57` = `assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools', 'wake_allow', 'inputs', 'outputs', 'dispatchable']);`；`test/wp4/orchestrator.test.js:575` = `assert.deepEqual(result.interrupted, ['INST-009']);`；`:588~592` = `legacyAfter`/`legacyBefore` + `:592` `assert.equal(legacyAfter, legacyBefore, 'v1 实例必须一字不改')`。拆分 §2.14 `:255~256` / §7 风险 3 `:758` / §8 冲突 12 `:796` / §6 冻结点 8 `:690` 全部按 `:588~592` 落地。两文件 `node --test` 均 exit 0（36/36、33/33） |

**模板 §1.5 十条自检（脚本逐条）**：① 8 节齐全 OK ② AC 满覆盖 OK ③ 每条 AC 在需求有同号 Then OK ④ WP 文件无交集 OK ⑤ DAG 无环 + 编号存在 OK ⑥ §0 退出标准可判定 OK ⑦ §2 每文件标归属 WP OK ⑧ §6 冻结点 + 整合检查点 OK ⑨ §7 每条风险有具体处置 OK ⑩ §8 不新增需求 + 冲突以需求为准 OK —— **10/10 OK**。

**§0「修订记录」如实性**：`:47` 写「R1 按 S-01~S-07 逐项修订（阻断 0），需求 v3 正文零改动；**待第 2 轮拆分评审**」——脚本断言「修订记录自行宣布 PASS = false」；§10「拆分自检」`:810~812` 只列 10 条检查项与「输出摘要见本次返回第 ② 项」，**未自行宣布 PASS**。符合要求。

## 3. 可执行性实跑（命令清单 + exit 码）

| # | 命令 | exit | 关键输出 |
|---|---|---|---|
| 1 | `git diff HEAD -- docs/iterations/iteration-8/requirement.md` | 0（输出空） | 需求正文 v3 一字未改（S-04 / S-05） |
| 2 | `node %TEMP%/i18r2-review.cjs` / `i18r2-review2.cjs` | 0 | 机械脚本输出见 §2（A-3 diff 空、JSON.parse OK、67/67、两口径交集空、DAG 无环、14 条 AC 抽查、D-9 实文等） |
| 3 | `node bin/orch.js --help` | **2** | 26 行输出：前 25 行用法块 + 第 26 行「（未知命令：--help）」（S-06 实跑） |
| 4 | `node bin/orch.js recover` | **2** | 「（未知命令：recover）」→ 符合 AC-55 / §6 #5 正式断言 |
| 5 | `node --input-type=module -e "import {USAGE_LINES} from './src/cli/labels.js'; …"` | 0 | `USAGE_LINES.length = 25`，前 8 行逐字（S-06 S3 取证口径） |
| 6 | `node --test --test-concurrency=4 "test/**/*.test.js"` | **1** | `tests 992 / pass 987 / fail 5`；5 个失败用例名与集成说明 §4 登记的既有噪声一致（EBUSY `promptFailures:2`、AC-63 `--host-error`、`HANDOFF_EVIDENCE_ESCAPE`、`resolveEvidenceRef`、`可注入 fs: stat`），**失败集合差集 = 0、条数 992 只增不减**，符合 AC-53 门禁口径（不要求零失败）。跑后已还原 evidence |
| 7 | `purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"`（31 词） | 0 | `OK: 扫描 21 个文件…零命中` |
| 8 | `purity-check.mjs --dirs src/registry --forbid "$NOCOORD"`（30 词） | 0 | `OK: 扫描 11 个文件…零命中` |
| 9 | `purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"`（三文件口径） | 0 | `OK: 扫描 3 个文件…零命中` |
| 10 | `node -e "…Object.keys(require('./package.json').dependencies ?? {}).length"` | 0 | 输出 `0` |
| 11 | `node -e "…CJK 扫描 src/registry + 三 cli 文件"` | 0 | 输出 `OK: no CJK` |
| 12 | `node --test test/wp11/role-schema.test.js` | 0 | `36/36 pass` |
| 13 | `node --test test/wp4/orchestrator.test.js` | 0 | `33/33 pass` |
| 14 | `NODE_ENV=test node test/fixtures/code-loop-driver.mjs --root %TEMP%/i18r2-smoke/code --scenario pass --task $'…\n产物：calc.js' --reset` | 0 | `state=completed`、两节点 `done`、`handoffs=1`、`exitCode:0` |
| 15 | `NODE_ENV=test node test/fixtures/task-loop-driver.mjs --root %TEMP%/i18r2-smoke/task --scenario doc-pass --task $'…\n产物：release-notes.md' --reset` | 0 | 交接包 HO-002 已完成、exit 0（doc-pass 场景真实存在） |
| 16 | `test ! -e src/core/worktree.js` / `grep -R "worktree" src/ \| wc -l` / `grep -R -E "artifact_type.*dir\|merge.*order" src/core src/daemon \| wc -l` / `test ! -e docs/iterations/iteration-7/requirement.md` | 0 | `NOT_EXIST` / `0` / `0` / `NOT_EXIST`（AC-56 四锚点） |
| 17 | `git cat-file -t d4b0f94` / `0cd113b` | 0 | 均 `commit` |
| — | `git worktree add --detach "$BASE" d4b0f94`（§6 #6） | **未实跑** | 会写 `.git/worktrees`，与只读纪律冲突；仅核实 commit 存在 + 语法有效，留 S3 执行 |

**不存在参数 / 不存在函数清单**：`--demo`（未使用，`doc-pass`/`pass` 均实跑 exit 0 真实存在）；`--help`（未注册，走未知命令路径 exit 2，§6 #5 已注明，S-06 已修）；`--kill-after`（§2.13 声明 S2 新增，未冒充实跑）；10 个 S2 新增符号在 src 现状全 absent 且 §2 标「新增」（正确，非 FAIL）；**现状不存在且文档写成现状已有的函数：无**。

## 4. 修复清单（新增问题 T-xx / 遗留 S-xx）

- **新增问题（T-xx）：0 条**。23 条判据全 PASS，本轮无 FAIL，故无阻断项、无需补法。
- **遗留 S-01~S-07：0 条**（逐条三态复核全部「已修」，见 §1；无「修了但引入新问题」）。
- **仅登记、不构成问题 / 不影响总判的 3 条机检口径观察**（非建议、无需修复）：
  1. §3.6 中「检查点写失败」「方言全失败」以 §3.3 事件 JSON 样例 + §3.6 文字判定段形式存在，**非独立 JSON 块**；S-01 补法（round1 `:150`）只要求补「二次崩溃」「重投失败」2 条 JSON，修订版已满足，按 round1 判定原则②不判 FAIL。若 S3 需机检「每类异常态各一块 JSON」，可自行补块，不属本轮缺陷。
  2. §1.3 `:70` / §2.4 `:184` / §6 冻结点 3 `:685` 把 `resumeOrCreate` 成功返回归纳为 `{restored, dialect, attempts}`；需求 D-4 `:1260~1266` 以分句表述（成功 `{restored, dialect}` + 「失败记录 attempts」+ 全失败 `{ok:false, code:'SESSION_RESTORE_FAILED', attempts}`）。属等价归纳、上轮已判 C② PASS、本轮该段未改动，保持 PASS。
  3. 全量测试本轮 `992/987/5`，round1 为 `992/988/4`、集成说明为 `992/987/5`；差的 1 条是 `promptFailures:2` 的 Windows `EBUSY` 并发噪声（集成说明 §4 明确登记），失败集合与集成版一致、差集 0，属噪声浮动，如实登记、不声称复核了固定通过数。

## 5. 实跑命令与输出摘要

**只读纪律与 evidence 还原**
```
评审前 git status:  M docs/iterations/iteration-8/decisions.md ; ?? docs/iterations/iteration-8.md ; ?? split-review-round1.md
全量测试后:  docs/iterations/iteration-4/evidence/{nfr-perf-atomic,nfr-perf-batch,nfr-perf-render}.json 被改写
执行: git checkout -- docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
       docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
       docs/iterations/iteration-4/evidence/nfr-perf-render.json
还原后: git status --short docs/iterations/iteration-4/evidence/  → （空）
终态 git status:  M docs/iterations/iteration-8/decisions.md ; ?? docs/iterations/iteration-8.md ; ?? split-review-round1.md
                 （+ 唯一新建 docs/iterations/iteration-8/split-review-round2.md）
```
未修改 `iteration-8.md` / `requirement.md` / `decisions.md` / `src/**` / `test/**`。临时文件全部在 `%TEMP%`：`i18r2-review.cjs`、`i18r2-review2.cjs`、`i18r2-result.txt`、`i18r2-result2.txt`、`i18r2-help.out`、`i18r2-recover.out`、`i18r2-p1/p2/p3.log`、`i18r2-wp11.log`、`i18r2-wp4.log`、`i18r2-code.log`、`i18r2-task.log`、`i18r2-fulltest.log`、`i18r2-smoke/{code,task}/`。

**机械脚本输出摘要（当场重跑）**
```
i18r2-review.cjs  : A-3 diff 空(17/17) / §3.7 登记表 10 节+来源行号 ; 两段 JSON.parse OK(二次崩溃 suspended+escalated+round2 / 重投失败 expired+3+escalations1)
                    A① 9 个 ## 全 OK ; A② 7 WP 五字段齐全 ; A③ 12 决策三段+26 编号 ; A⑤ §3 命中 5 类异常态 ;
                    B① 口径A 28/口径B 30 交集均空+orchestrator owner WP-4 ; B② 边集合 DFS 无环+编号 1..7 ;
                    B③ 7 能力标题 ; B④ 67 定义=67 引用/无缺重号/主责合计 67 ; C③ 10 冻结点+整合检查点 ;
                    C④ 20 风险+风险15/20 点名 WP/路径/函数+6 吸收项 ; C⑤ session_reuse 2 处全「不改名」+§8 已裁决/如实登记 ;
                    C⑦ A-6 diff 空 ; D② 10 新增 absent/26 现状 found ; D⑤ D-9 实文+ :592 ; D④ d4b0f94 9/0cd113b 8 全排除语境 ;
                    §1.5 十条自检 10/10 OK ; §0 修订记录未自行宣布 PASS
i18r2-review2.cjs : C⑥ 抽查 14 条 AC 全在映射表(需求 Then ↔ 主责/协作/备注) ; C② 7 项契约双含 ; C① 退出标准 9 条+需求 §1.2 10 行 ;
                    A④ §2.1~2.11 11/11 四项+§2.12~2.15 接口形状 4/4 ; A⑥ §5 三列表 34 行+新夹具/probe/evidence ;
                    A⑦ 冲突清单 14 行+声明 ; D③ 15 新增路径全 NOT_EXIST ; D① driver 场景/命令参数真实性
```

**门禁四件套与关键命令 exit 码汇总**
```
全量测试                       exit=1  (992/987/5，失败集合与集成版 §4 一致；evidence 已还原)
D-11 五条纯净扫描              exit=0 ×5（#4 输出 0、#5 输出 OK: no CJK）
零运行时依赖                   exit=0  输出 0
D-9 两授权文件                 exit=0 ×2（36/36、33/33）
orch --help                    exit=2  （25 行用法块 + 第 26 行「（未知命令：--help）」；S-06 已修）
USAGE_LINES 直接断言            length=25、常量在 src/cli/labels.js:183
orch recover                   exit=2  （符合 AC-55）
code-loop --scenario pass      exit=0
task-loop --scenario doc-pass  exit=0
AC-56 四锚点                   NOT_EXIST / 0 / 0 / NOT_EXIST
git cat-file -t d4b0f94|0cd113b  commit / commit
git diff HEAD -- requirement.md  （空）
```

**未实跑 / 仅核实的命令**：`git worktree add --detach "$BASE" d4b0f94`（§6 #6，写 `.git/worktrees`，与只读纪律冲突，仅核实 commit 与语法，留 S3）；`--kill-after` 等 S2 规划新增接缝（标新增，未冒充现状命令）。

## 6. 与 round1 的判定对照表

| 判据 | round1 | round2 | 变化 / 说明 |
|---|---|---|---|
| A① | PASS | **PASS** | 保持；8 节标题/顺序未改坏 |
| A② | PASS | **PASS** | 保持；7 WP 五字段未改坏 |
| A③ | PASS | **PASS** | 保持；12 决策三段 + §1.13 汇总表未改坏 |
| A④ | PASS | **PASS** | 保持；§2.12~2.15 补「接口形状：不适用」（S-02），机械口径更自洽，未改坏 |
| **A⑤** | **FAIL（建议）** | **PASS** | **FAIL → PASS**：S-01 已修，§3.6 补「二次崩溃」「重投失败」两段合法 JSON 样例（`JSON.parse` OK）+ 判定 + 唯一事实来源；5 类异常态全部在 §3 有内容 |
| A⑥ | PASS | **PASS** | 保持；§5 三列表未改坏（新增 §3.7 登记表不影响 §5） |
| A⑦ | PASS | **PASS** | 保持；§8 改为「已裁决（不阻塞）」+ 如实登记（S-04），声明与 14 行冲突清单仍在 |
| B① | PASS | **PASS** | 保持；两种口径交集仍空 |
| B② | PASS | **PASS** | 保持；§6 边集合/§4 标题未改，DFS 仍无环 |
| B③ | PASS | **PASS** | 保持；7 WP 能力标题未改 |
| B④ | PASS | **PASS** | 保持；67/67 映射表未改（修订只在 §3/§8/§6 说明/§7 风险，未动映射表） |
| C① | PASS | **PASS** | 保持；§0 退出标准 9 条未改 |
| C② | PASS | **PASS** | 保持；§2 契约段未改；冻结点 6 补 17/15 差集说明（S-07）后更自洽 |
| C③ | PASS | **PASS** | 保持；10 冻结点 + 整合检查点未改坏 |
| C④ | PASS | **PASS** | 保持；风险 15/20 补点名文件/函数/WP（S-03），20 条处置仍在 |
| C⑤ | PASS | **PASS** | 保持；S-04 同步 §8 措辞，`session_reuse` 2 处仍为「不改名」语境 |
| C⑥ | PASS | **PASS** | 保持；抽查 14 条 AC 无放宽/无删并/无夹带 |
| C⑦ | PASS | **PASS** | 保持；A-3 17 行逐字副本（S-05）、A-6 diff 空，需求附录 A 未改写 |
| D① | PASS | **PASS** | 保持；门禁四件套 exit 码与参数真实性复跑；§6 #5 补 `--help` 说明（S-06）与实跑一致 |
| D② | PASS | **PASS** | 保持；新增/现状符号区分未改坏 |
| D③ | PASS | **PASS** | 保持；15 新增路径仍 NOT_EXIST |
| D④ | PASS | **PASS** | 保持；基线仍 `d4b0f94` |
| D⑤ | PASS | **PASS** | 保持；D-9 行号与实文一致 |

- **由 FAIL 转 PASS：1 条（A⑤，S-01 对应）**。
- **PASS 保持：22 条**（A①②③④⑥⑦ / B①②③④ / C①②③④⑤⑥⑦ / D①②③④⑤），逐条重新判定、无「沿用上轮」式结论、无改坏。
- **总判：round1 FAIL（阻断 0 / 建议 7，22 PASS / 1 FAIL）→ round2 PASS（阻断 0 / 建议 0，23 PASS / 0 FAIL）**。按任务书硬规则「全部判据 PASS 且阻断 0 才允许写 PASS」→ **总判 PASS**。
