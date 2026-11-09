# I1.8 拆分与契约评审 · Round 1（独立评审，不采信拆分方自述）

> 评审身份：I1.8「拆分与契约评审工程师」。本评审不参与 `iteration-8.md` 撰写，不采信其 §0/§1.5/§8 自述的「自检全绿 / 第 3 轮 PASS」。所有结论来自逐字读基准文档、`%TEMP%` 只读脚本统计、命令 exit code、`src/**`·`test/**` 现状 Grep。

## 0. 总判、阻断与建议

- **总判：FAIL**（按任务书硬规则「只有全部判据 PASS 且阻断 0 才允许写 PASS」；A⑤ 判 FAIL，故总判记 FAIL）。
- **阻断：0 条** ／ **建议：7 条**（S-01~S-07）。
- **逐判据汇总**：A 7 + B 4 + C 7 + D 5 = **23 条；22 PASS / 1 FAIL**。唯一 FAIL 为 **A⑤**（建议级，非阻断）。
- **评审对象**：`docs/iterations/iteration-8.md`（739 行，7 WP，9 个 `##` 大节）。
- **基准输入**（逐字读，不采信摘要）：`requirement.md` v3 全文（1419 行，分段 1-250/251-500/501-750/751-1000/1001-1250/1251-1419）、`requirement-understanding.md`、`execution-template.md` §1.3/§1.4/§1.5/§2.5、`decisions.md`（裁-1~裁-6）、`review-round3.md`、`integration-2026-11-09.md`、`src/**`·`test/**` 现状。
- **复核方式**：4 个 `%TEMP%` 只读脚本 `i18-review.cjs` / `i18-review2.cjs` / `i18-review3.cjs` / `i18-review4.cjs`（当场重跑，数字见 §2/§6）+ 门禁四件套命令逐条实跑（§4/§6）。全量测试改写 `iteration-4/evidence/*.json` 后已 `git checkout --` 精确还原；全仓 `git status` 仅余评审前既有 `M decisions.md` / `?? iteration-8.md`。
- **判定原则**（供复核，避免双标）：① 判据核心要求（结构齐全、契约与需求逐字一致、命令可实跑、AC 满覆盖、无夹带/无放宽）按严格口径判；② 判据括号内「举例清单 / 点名方式」若文档以需求原文等价形式或文档自身声明口径覆盖、且可逐字验证，不因脚本正则未命中直接判 FAIL，但登记为观察/建议；③ 核心要求存在实质缺失（判据点名的内容确实没写）判 FAIL。据此 A④ / C④ / C⑦ / A③ 的脚本告警经逐字复核后判 PASS 并登记建议（依据见对应节），A⑤ 为实质缺失判 FAIL。

> 结论性质：**无阻断项**。FAIL 由 1 条建议级判据构成（§3 异常态样例未列全），其余 6 条为增强建议；不涉及需求契约错误、命令不可跑、AC 放宽或夹带。补齐 S-01 后可转 PASS；主控可据此决定带建议开工或先补后复审。

## 1. A 结构合规（7 条逐条判定）

| 判据 | 结论 | 依据（行号 / 实跑） |
|---|---|---|
| A① 8 节 `## 0`~`## 8` 节号·顺序·标题逐字符合模板 §1.3 | **PASS** | 脚本2 逐字比对 9 个 `##`：0~8 全 OK（`:10/:46/…/:706` 与模板 §1.3 表一致） |
| A② 每 WP 固定五字段齐全 | **PASS** | 脚本2：7 WP 全齐全；逐字核 `:401~:452`（`负责文件（k）/依赖/交付/验收口径/可否并行`） |
| A③ §1 每关键决策有「结论 + 理由 + 被否决方案及原因」 | **PASS** | 脚本2 报 FAIL 系把 `### 1.13 被否决项汇总`（`:143` 汇总表，26 条编号无缺号/重号）当第 13 个决策；逐字核 §1.13 是汇总表非决策小节。排除后 `1.1~1.12` 共 12 个技术决策「结论/理由/被否决」三段全 true（脚本2 逐条输出）。**脚本误报，人工裁定 PASS**，登记 §2 说明 |
| A④ §2 每文件标「新增/修改 + 导出签名 + 入参出参 + 归属 WP」 | **PASS** | 脚本3：`§2.1~§2.11` 11 个产品源文件四项**全部齐全**（`:161~:226`）。`§2.12~§2.15`（`:227~:256`）为测试/夹具/probe **占位登记**：表格逐文件给了「新增/改 + 归属 WP + 类型 + 契约内容/逐字实文锚点」，未列「导出签名/入参出参」——测试与 probe 占位文件不产出产品 API，该字段不适用；且 §7 表头/模板口径针对产品接口契约。按判定原则②判 PASS，缺字段登记为 S-02 |
| A⑤ §3 数据模型完整样例且含异常态（检查点写失败、无检查点、方言全失败、二次崩溃、重投失败），并标唯一事实 | **FAIL（建议）** | 逐字读 §3 全文（`:275~:394`）：§3.1 `checkpoint/v1` 完整 JSON、§3.2 `state.json` 增量键、§3.3 恢复事件（含 `checkpoint.write_failed`/`session.crash`/`session.slow`）、§3.4 `recovery`/`connections`、§3.5 A-6 逐字文案、§3.6 异常态 5 条均标「唯一事实来源」。§3.6（`:390~:394`）含「检查点不可读/恢复失败/旧实例无检查点/三方言全失败降级/写失败异常态」，命中判据 5 项中的 3 项（检查点写失败 `:394`、无检查点 `:387/:392`、方言全失败 `:393`）；**「二次崩溃」「重投失败」两类在 §3 全节无样例**（脚本2 `§3 全节命中=false` 两项）。二者仅在 §2.12（`:236/:237`）、§4 映射表（AC-62/AC-63 `:522/:523`）、§7 风险 11（`:695`）、WP-4 交付（`:429`）登记，不在 §3 数据模型。属判据点名内容实质缺失，按原则③判 FAIL。修复见 S-01 |
| A⑥ §5 三列表含 `test/wp13/**`、新夹具、probe 占位 | **PASS** | 脚本2：`test/wp13` 10 行、新夹具 `recovery-driver.mjs`/`human-node-state.json`/`graph-timeout.json` 全有、`acc8-f-*` probe 占位 3 处；§5 表格 35 行 |
| A⑦ §8 有「不新增需求条目、冲突以需求为准」声明与冲突清单 | **PASS** | 逐字读 `:708` 声明 + `:710~:727` 冲突清单 14 行 + `:729~:735` 需主控确认段；脚本2 三项断言全 true |

## 2. B 模板四条硬规则（机械实跑输出，不采信自述）

> 脚本 `%TEMP%/i18-review.cjs`（当场重跑）+ 修正脚本 `%TEMP%/i18-review4.cjs`（按 §6 权威口径重判 DAG）。输出为脚本 stdout 摘要。

**① 文件清单互不重叠（两种口径）+ 共享大文件唯一负责人** → **PASS**

```
[口径A §1.5 原样] 登记路径数: 28 | 跨 WP 交集: （空）
[口径B 精确路径] 登记路径数: 30 | 跨 WP 交集: （空）
src/core/orchestrator.js owner: 精确口径 ["WP-4"] / 口径A ["WP-4"]   ← 唯一负责人
```
7 个 WP 负责文件（精确口径）：WP-1(3)/WP-2(2)/WP-3(4)/WP-4(7)/WP-5(3)/WP-6(7)/WP-7(4)，两两求交为空。

**② 依赖成 DAG、无环、编号存在、每 WP 可独立验收** → **PASS**

- 脚本1 按「`- **依赖**` 行全文」提取时误报环 `WP-3->WP-4->WP-5->WP-3`：它把 WP-5「依赖：无（…冻住后 WP-3/4 才能并行接线）」（`:436`）括号内的 `WP-3/4` 说明文字误抓为依赖，又把 WP-3 说明误读，伪造出 `WP-5←WP-3` 回边。
- 按 §6:578 明确声明「依赖边清单 + §4 标题/依赖字段是 DAG 判定唯一依据」重跑 `i18-review4.cjs`（从 `:603` 机械提取边集合 + DFS + Kahn）：

```
§6:603 边集合: WP-3←{WP-4,WP-5}  WP-4←{WP-1,WP-2,WP-5}  WP-7←{WP-3,WP-4,WP-6}
§6 边集合 vs §4 标题依赖 一致性: true（7/7 逐字一致）
悬空/不存在依赖编号: 无
DFS 发现环: 无 | DAG 有环: 否（PASS）
拓扑序: WP-1 -> WP-2 -> WP-5 -> WP-6 -> WP-4 -> WP-3 -> WP-7 | 全部节点可排序: true
```
- 每 WP 可独立验收：WP-1~6 均有包内契约测试（`test/wp13/*` 或夹具自检）线索；WP-7 按 §2.12（`:241`）/§2.14（`:248~:251`）设计「改 D-9 既有断言 + probe 真实面」、不新增 `test/wp13`，已声明且验收对象可独立定义；依赖未就绪包用「契约兼容缺省 / 内存 stub」（`:398/:420/:428`）。**脚本1 环为脚本缺陷，非文档缺陷**。

**③ 按能力切不按目录切** → **PASS**

脚本1 输出 7 个 WP 标题：`检查点与持久化契约 / ACP 恢复方言 / 角色 session_policy 与会话复用配置 / 恢复编排内核 / 文案与渲染唯一来源 / 测试夹具故障注入与现场构造 / 授权断言架构门禁与真实宿主面取证`——全部按能力维度命名，无按目录/文件类型切分。

**④ AC→WP 满覆盖映射表** → **PASS**

```
需求 AC 定义数: 67 | 去重: 67 | 需求 AC 重号: 无
映射表行数: 67 | 引用去重数: 67 | 映射表重号(重复行): 无
需求有、映射表未覆盖(未覆盖/缺号): 无
映射表引用了不存在的 AC: 无
主责列为空/无 WP 号的行: 无
主责分布: {"WP-4":39,"WP-1":2,"WP-5":3,"WP-2":8,"WP-6":3,"WP-3":6,"WP-7":6} | 合计 67
```
每条 AC 至少一个主责 WP，跨包行均标「主责 + 协作」（抽检 `:465/:475/:483` 等），并声明「验收口径 = 需求 v3 §3.1 同号 Then 逐字口径，只登记锚点、不复制/不改写/不合并/不放宽」（`:398`）。

## 3. C 与需求/契约一致性（7 条逐条判定，含裁-6、13 条 AC 抽查）

| 判据 | 结论 | 依据 |
|---|---|---|
| C① §0 退出标准逐条可判定且覆盖需求 §1.2 / §3.1 全部成功衡量 | **PASS** | §0 退出标准 9 条（`:35~:45`）逐条含数字/逐字口径（67/67、`tests>=992`、25 行、11/13 键、`exit 0`、`d4b0f94`、NFR-01~08、真实面判阻塞）；脚本3 断言全 true。逐条比对需求 §1.2 表 10 行（`:37~:46`）：①已完成节点重跑 0 次→退出6(NFR-02)+退出1；②轮次重置 0 次→退出6+退出1；③方言命中 3/3→退出1+退出4；④回退可见 100%→退出1+退出6；⑤崩溃/慢 2/2→退出6+退出1；⑥busy→available 1/1→退出1；⑦delivered→pending 1/1→退出1；⑧非恢复输出 0 处→退出5+退出2；⑨真实宿主 2/2→退出7；⑩新增依赖 0 个→退出4+退出6。**10/10 覆盖** |
| C② §2 文件级契约与附录 D-1~D-13 逐条对齐（写点顺序、`transit(...,{phase})` 同一次 CAS、`resumeOrCreate` 返回结构、`recovery`/`connections` 追加键、`session_policy` 键序/缺省不注入、M-7 接缝名） | **PASS** | 脚本2 「关键契约逐字抽查」7 项全 OK：写点顺序「实例记录→检查点→事件广播」、transit phase 同一次 CAS、`{restored,dialect,attempts}`、追加在 `current` 之后、缺省 fresh 不注入渲染、`MAESTRO_TEST_RECOVERY_HOLD`、`MAESTRO_FAULT=checkpoint_write:fail`；逐字核 §6 冻结点 1/2/3/4/5/6/9/10（`:616~:625`）。M-7 接缝名集合：脚本2 报「需求 17 / 拆分 §2 15，差 `MAESTRO_TEST_DELIVERY_DELAY_MS`、`MAESTRO_TEST_STOP_AFTER`，拆分文档出现但需求没有的环境名：无」——Grep 实文确认二者是**现状既有接缝**（`src/core/orchestrator.js:351`/`:367`），需求 M-7「不改既有参数语义」（`:1360`）、§2.13（`:246`）与 §6 冻结点 7（`:622`）已声明复用既有参数，不属本迭代新增冻结项、且**无需求外夹带**。登记 S-07 |
| C③ §6 契约先冻结点 ≥8 且逐字写清冻结什么、整合检查点存在 | **PASS** | 脚本3：10 个冻结点（`:615~:625`）、每个含「逐字冻结」措辞 10 处、整合检查点存在且含命令代码块（`:627~:675`） |
| C④ §7 每条风险有具体处置（点名文件/函数/WP），且吸收理解纪要 5 条风险提示 | **PASS** | 逐字读 §7 全表（`:679~:704`）：20 条风险**每条都有具体处置**；脚本3 确认 5 条必须吸收项全在（风险 1 超集 `:685` / 2 集成版 `d4b0f94` 基线 `:686` / 3 D-9 两行+`:588~592` 一字不改 `:687` / 4 autocrlf `:688` / 5 真实面判阻塞不得夹具冒充 `:689` / 6 I1.7 合入后重跑 `:690`），且这些行处置列均点名 `src/...` 文件、函数（如 `transit()`/`saveState()`/`snapshotOf()`/`reconcileOnBoot()`）与 `WP-x`。脚本3 报「风险 15、20 处置列未点名文件/函数/WP」：逐字核 `:699`/`:704` 点名的是 AC 编号（`AC-54`/`AC-04`/`AC-46`）、§6 检查点 #2 命令块、§8 确认段等**文档锚点**，与 §7 表头「处置（点名文件 / 函数 / AC）」（`:683`）一致，非「无处置」。按判定原则②判 PASS，点名方式差异登记 S-03 |
| C⑤ 裁-6 是否被遵守（`session_policy` 有无被写成 `session_reuse` 或其它名字） | **PASS** | 逐字读 `decisions.md:30` 裁-6：「按需求原文 `session_policy` 落地，不改名为 `session_reuse`；B-09 从『需评审裁决』改判『已裁决（不阻塞）』只在 S1 评审记录与本台账留痕，需求正文 v3 一字不改」，影响面明列「`iteration-8.md` §2/§4/§6（已据此冻结）」。脚本3：冻结点5 含 `session_policy`/不含 `session_reuse`；§2(7/0)、§4(4/0)、§6(7/0)。全文 `session_reuse` 仅 2 处（`:726` 冲突13 描述附录 B-09 待裁决、**`:731` 假设「若主控改名」**），均为语境引用，**产品契约段零改名**。拆分文档实际结论（`:726`「按需求已选口径落地、不阻塞开工」/`:731`「建议按需求 `session_policy` 落地」）与裁-6 一致。遗留：§8 `:729~:731` 仍把 B-09 表述为「需评审裁决 / 需主控书面确认」，与裁-6「已裁决」留痕口径有张力——列为主控裁决点 + S-04 |
| C⑥ 无挪出范围 / 删合并 AC / 放宽 Then / 夹带规划外新能力（抽查 ≥10 条，含指定 13 条） | **PASS** | 脚本2 抽查 **13 条**（AC-01/06/14/25/26/27/51/53/54/56/57/63/67，即任务书点名全部），逐条比对「需求 Then 首句 ↔ 映射表主责/协作/备注」：AC-25/26/27 备注「真实 DSH…无 DSH 判阻塞」「阻塞口径」、AC-53「失败集合差集=0、条数只增不减」、AC-56「I1.7 未合入不依赖 worktree、合入后重跑」、AC-57「真实宿主隔离、阻塞口径」、AC-63「二次崩溃直接升级、不再重建」——**无放宽、无删并、无挪出**；§8 冲突14（`:727`）+ §0 Out of scope 13 项（`:33`）+ B④ 67/67 全在范围内。抽查结果见下方子表 |
| C⑦ 需求附录 A 逐字文案在 §3/§5/WP 验收口径里有无被改写 | **PASS** | 逐字读附录 A（`:972~:1060`）与拆分文档出现的所有附录 A 风格文案：§3.5（`:369~:373`）A-6 五行与需求 `:1055~:1059` **逐字一致**；§3.4（`:364`）连接线行与 A-4 `:1035` 一致；`:387` 与 `:1023` 一致；WP-2（`:414`）`恢复：会话 sess-003 · session/resume（不回放）` 与需求 AC-19 Then（`:535`）具体值逐字一致；WP-4（`:430`）`恢复：检查点 10:30:00 · 跳过 1 个已完成节点 · 轮次 2/3`（`:999`）、`按实例记录恢复…`（`:1022`）、`恢复：角色 开发 · 服务中 → 可用（会话不可恢复）`（AC-28 Then `:607`）、`恢复：连接线 测试→开发（回流） 已投递 → 待投递（重投）`（AC-32 Then `:639`）均逐字。脚本2「附录 A 逐字命中 14/27」的 13 条未命中全是 **A-3 模板占位符行**（如 `恢复：检查点 {HH:MM:SS}…`、`恢复：会话 {会话号}…`）与「AC Then 具体值行 / `<原因>` vs `{原因}` 记法」的口径差异，**无措辞改写**；§4:398 / §8:708 明确「不复制/不改写/以需求为准」。按原则②判 PASS，登记 S-05 |

**C⑥ 抽查 13 条 AC 结果（需求 Then 首句 → 映射表，判定「未放宽」）**

| AC | 需求 Then 要点（简） | 主责 / 协作 | 判定 |
|---|---|---|---|
| AC-01 | 已完成「已完成」/已分配「已分配」带「等待重新分配会话」/执行中「执行中」/待校验「待校验」 | WP-4 / WP-5、WP-6 | 未放宽（9 位置投影 + NODE_STATES 仍 7 项） |
| AC-06 | 「状态不可读」+ `state.json.corrupt` 备份、不从检查点静默重建 | WP-4 / WP-1、WP-6 | 未放宽 |
| AC-14 | 待校验 → 「重新核对」不重放 | WP-4 / WP-5、WP-6 | 未放宽（A-3 第 17 行逐字） |
| AC-25 | `session/resume（不回放）`，无 `session/load` | WP-2 / WP-7 | 未放宽（真实面取证、无 DSH 判阻塞） |
| AC-26 | 已完成节点无新派发、恢复摘要 | WP-2 / WP-4、WP-7 | 未放宽（阻塞口径） |
| AC-27 | 真实可用则 `session/load（回放）` | WP-2 / WP-7 | 未放宽（真验否则阻塞） |
| AC-51 | `会话复用：复用（reuse）` + `ROLE_SESSION_POLICY_INVALID` | WP-3 / WP-5 | 未放宽 |
| AC-53 | 条数只增不减、失败集合差集 0、不要求零失败 | WP-7 / WP-6 | 未放宽 |
| AC-54 | 五条命令 exit 0、`dependencies` 0、三文件口径 | WP-7 / — | 未放宽 |
| AC-56 | 只读现有 `artifactRefs`、无 worktree 假设、I1.7 合入后重跑 | WP-7 / WP-4 | 未放宽 |
| AC-57 | `DSH_HOME` 指向 `%TEMP%`、凭据复制不动用户 `~/.dsh` | WP-7 / — | 未放宽（阻塞口径） |
| AC-63 | 「会话重建失败：已升级人工」、不出现第二次「正在重建会话」 | WP-4 / WP-6 | 未放宽 |
| AC-67 | 「可用 · 活跃会话 0/1 · 服务节点 —」、不新建会话 | WP-4 / WP-5、WP-6 | 未放宽 |

## 4. D 可执行性实跑（命令清单 + exit 码 + 不存在参数/函数清单）

> 全部命令在 `d:/WWW/Maestro` 当前基线（未改任何文件）实跑；会写仓库的全量测试已还原 evidence。临时根/日志均在 `%TEMP%`。

| D 判据 | 结论 | 实跑 / 核实结果 |
|---|---|---|
| D① 拆分文档所有命令逐条实跑或核实；门禁四件套 exit 码；driver `--scenario` 取值真实存在 | **PASS** | 见下方「命令清单」。`--demo` 类不存在参数：`scenarioNames()` 实跑 `含 pass: true / 含 demo: false`，**拆分文档未使用 `--demo`**，用的是 `--scenario pass`（code-loop，`:664`）与 `doc-pass`（task-loop，`:665`，场景文件 `test/fixtures/scenarios/task-loop/doc-pass.json` 存在）。`git worktree add --detach`（`:663`）**未实跑**——该命令写 `.git/worktrees`、违反只读纪律；已核实 `d4b0f94`/`0cd113b` 均为有效 `commit` 且命令语法有效，留 S3 执行。`--kill-after` 为 §2.13（`:245`）声明 WP-6 S2 新增参数，非现状命令，未冒充实跑 |
| D② §2 引用函数/导出真实存在；新增的必须明确标「新增」，写成现状已有即 FAIL | **PASS** | 脚本1 符号核对：现状已有（FOUND）`writeJsonAtomic`/`writeTextAtomic`/`copyToBackup`/`projectRoot`/`orchDir`/`statePath`/`ensureLayout`/`transit`/`reconcileOnBoot`/`saveState`/`snapshotOf`/`markInterrupted`/`newSession`/`prompt`/`cancel`/`closeSession`/`resumeOrCreate`/`COMMANDS`/`parseArgs`/`ROLE_OPTIONAL_KEYS`/`checkRoleShape`/`serializeRole`/`renderGraphJson`/`USAGE_LINES`/`NODE_STATES`/`GRAPHS` 等全存在。src 现状 ABSENT 的 10 个符号**全部在 §2 明确标新增**：`§2.1`（`:161` **新增**）`CHECKPOINT_SCHEMA`/`buildCheckpoint`/`writeCheckpoint`/`loadCheckpoint`；`§2.2`（`:169` **新增**）`checkpointPath`；`§2.3`（`:175` **新增导出**）`selectReusableSession`、`recoverInstance`（`:176` 标注内部函数）、`reconcileOnBoot` 返回 `recovered`（**新增键**）；`§2.4`（`:181` **新增**）`normalizeCapabilities`/`resumeSession`/`loadSession`。**无「新增被写成现状已有」**。`DEFAULT_FORBID` 在 `test/fixtures/purity-check.mjs`（非 src 产品文件），§2.16（`:271`）标边界守护「只读复用、现状已有」，脚本在 src 扫不到属口径、非缺陷 |
| D③ §5 交付物路径可写、无与现有 tracked 冲突 | **PASS** | 脚本1：15 个规划新增路径全部 `NOT_EXIST tracked=false`（`src/core/checkpoint.js`、`test/wp13/*` 9 个、`test/fixtures/recovery*` 3 个、`probe/acc8-f-lib.mjs`、`docs/iterations/iteration-8/evidence`）；`docs/iterations/iteration-8.md` 存在但未 tracked（评审对象本身，S1 拆分文档未提交属正常）。无 tracked 冲突 |
| D④ 三主链基线写成集成版 `d4b0f94`，未误用 `0cd113b` | **PASS** | 脚本2：`d4b0f94` 9 次 / `0cd113b` 8 次；8 处 `0cd113b` 上下文逐条核（`:41/:686/:724/:726/…`）全为「**不是** I1.6 的 `0cd113b`」「不能套 `0cd113b`」「I1.5 `0cd113b` 基线」等排除/对比语境，基线统一 `d4b0f94`。`git cat-file -t` 二者均 `commit`；`git log -1 d4b0f94` = `merge(I1.4+I1.5+I1.6): 并行迭代集成 — 双 workflow 语义分流后合入 main`（与 `integration-2026-11-09.md` 一致） |
| D⑤ D-9 两行授权断言行号与实文一致 | **PASS** | `test/wp11/role-schema.test.js:55~59` 实文 `assert.deepEqual([...ROLE_OPTIONAL_KEYS], ['tools','wake_allow','inputs','outputs','dispatchable']);`（`:57`）；`test/wp4/orchestrator.test.js:480` 用例标题、`:575` `assert.deepEqual(result.interrupted, ['INST-009']);`、`:578`、`:580`、`:584~586`、`:588~592` `legacyAfter`/`legacyBefore` + `assert.equal(legacyAfter, legacyBefore, 'v1 实例必须一字不改')` 实文一致。拆分 §2.14（`:250~:251`）/§7 风险3（`:687`）/§8 冲突12（`:725`，裁-5 `:588~592`）/§6 冻结点8（`:623`）全部按 `:588~592` 落地。两文件 `node --test` 均 `exit=0`（36/36、33/33） |

**命令清单（§6 检查点 `:629~:675` + 判据 D①，全部当场实跑）**

| # | 命令 | exit | 关键输出 |
|---|---|---|---|
| 1 | `node --test --test-concurrency=4 "test/**/*.test.js"` | **1** | `tests 992 / pass 988 / fail 4`（本轮）；前一轮 `992/987/5`，差 1 条属 §0:7 / §7 风险16（`:700`）已登记的 Windows 并发噪声浮动。4 个失败：`--host-error 早返回…(AC-63)`、`HANDOFF_EVIDENCE_ESCAPE：符号链接绕过`、`resolveEvidenceRef 纯路径判定…`、`可注入 fs：stat 结果决定通过…`，与 `integration-2026-11-09.md` §4 既有噪声一致；门禁口径为「失败集合差集=0 + 条数只增不减」，不要求零失败。**跑后已还原 evidence** |
| 2 | `purity-check.mjs --dirs src/core,src/daemon --forbid "$COMMON"`（31 词） | 0 | `OK: 扫描 21 个文件…零命中` |
| 3 | `purity-check.mjs --dirs src/registry --forbid "$NOCOORD"`（30 词） | 0 | `OK: 扫描 11 个文件…零命中` |
| 4 | `purity-check.mjs --files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js --forbid "$COMMON"`（三文件口径） | 0 | `OK: 扫描 3 个文件…零命中` |
| 5 | `node -e "...Object.keys(require('./package.json').dependencies ?? {}).length"` | 0 | 输出 `0` |
| 6 | `node -e "...CJK 扫描 src/registry + 三 cli 文件"` | 0 | 输出 `OK: no CJK` |
| 7 | `node --test test/wp11/role-schema.test.js` | 0 | `36/36 pass` |
| 8 | `node --test test/wp4/orchestrator.test.js` | 0 | `33/33 pass` |
| 9 | `node bin/orch.js --help` | **2** | 打印完整 **25 行用法块**（前 8 行逐字）+ 第 26 行「（未知命令：--help）」→ **CLI 未注册 `--help` 参数**，走「未知命令打印用法」路径；拆分 §6 #5（`:656`）未声明该命令 exit 码、仅预期「USAGE_LINES.length===25 + 前 8 行逐字」，不矛盾。登记 S-06 |
| 10 | `node bin/orch.js recover` | 2 | 打印 25 行用法 + 「（未知命令：recover）」→ **符合 AC-55 / §6 #5「`orch recover` 退出码 2」** |
| 11 | `code-loop-driver.mjs --root %TEMP% --scenario pass --task $'…\n产物：calc.js' --reset` | 0 | `state=completed`、两节点 done、handoffs=1（`--task` 含「产物：」行才合规，首次用纯文字 task 会 `exit=1` 并提示，属 driver 既有输入约束，非参数不存在） |
| 12 | `task-loop-driver.mjs --root %TEMP% --scenario doc-pass --task $'…\n产物：release-notes.md' --reset` | 0 | 交接包已完成、`exitCode:0` 类输出 |
| 13 | `test ! -e src/core/worktree.js` / `grep -R "worktree" src/ \| wc -l` / `grep -R -E "artifact_type.*dir\|merge.*order" src/core src/daemon \| wc -l` / `test ! -e docs/iterations/iteration-7/requirement.md` | 0 | `0` / `0` / `0` / `NOT_EXIST`（AC-56 四锚点） |
| 14 | `git cat-file -t d4b0f94` / `0cd113b` / `git log -1 --format=%s d4b0f94` | 0 | 均 `commit`；log 见 D④ |
| — | `git worktree add --detach "$BASE" d4b0f94`（§6 #6） | **未实跑** | 会写 `.git/worktrees`，与只读纪律冲突；仅核实 commit 存在 + 语法有效，S3 验收期执行 |

**「不存在参数 / 不存在函数」清单（判据 D①/D② 要求抓出）**

- 不存在的 driver 场景参数：`--demo`（`scenarioNames()` 实跑 `含 demo: false`）——**拆分文档未使用**，不构成缺陷；实际使用 `pass`/`doc-pass` 均真实存在。
- 未注册 CLI 参数：`--help`（`node bin/orch.js --help` 走未知命令路径，exit 2）——拆分 §6 #5 用其触发用法块打印，登记 S-06。
- S2 规划新增、现状不存在的参数：`--kill-after`（§2.13 `:245`）、M-7 `MAESTRO_MOCK_*`/`MAESTRO_TEST_*` 新接缝（§6 冻结点 6 `:621`）——文档明确标「新增/先冻」，未冒充现状命令。
- 现状不存在但文档**明确标新增**的函数（正确，非 FAIL）：`checkpointPath`、`selectReusableSession`、`recoverInstance`、`normalizeCapabilities`、`resumeSession`、`loadSession`、`CHECKPOINT_SCHEMA`、`buildCheckpoint`、`writeCheckpoint`、`loadCheckpoint`（见 D②）。
- 现状不存在且文档**写成现状已有**的函数：**无**（D② 判 PASS 的关键）。

## 5. 修复清单 S-01…（位置 / 原文依据 / 违反哪条 / 建议修法 / 严重度）

> 全部为**建议级**，无阻断级。仅 S-01 对应判据 FAIL（A⑤）；S-02~S-07 为观察/增强建议，不影响逐条 PASS 结论。

- **S-01（对应 A⑤ = 唯一判据 FAIL；严重度 建议）**
  - 位置：`docs/iterations/iteration-8.md` §3.6 异常态样例（`:378~:394`）。
  - 原文依据：§3.6 五条 bullet 仅「检查点不可读 / 恢复失败 / 旧格式实例（无检查点）/ 三方言全失败降级 / 写失败异常态」；脚本2 `二次崩溃 : §3全节命中=false`、`重投失败 : §3全节命中=false`。判据 A⑤ 点名的 5 类异常态缺 2 类。
  - 缺什么：§3 数据模型未把「二次崩溃」「重投失败」作为异常态样例列出；二者散落在 §2.12（`:236/:237`）、§4（AC-62/63 `:522/:523`）、§7 风险11（`:695`）、WP-4 交付（`:429`），未收敛到 §3 唯一事实来源段。
  - 建议修法：在 §3.6 补 2 条 JSON 样例并逐条标判定 + 唯一事实来源：①「二次崩溃」——`MAESTRO_MOCK_CRASH=twice` 下不再出现第二次 `session.crash`/重建事件、节点直接 `escalated`、`session/new` 不增加、轮次不变（对 AC-63 / D-8 `:1343`）；②「重投失败」——handoff `state:'expired'`、`deliveryAttempts:3`、`escalations` 新增 1 条（对 AC-62 / C-17 / `:900`）。补后 A⑤ 转 PASS，总判可转 PASS。
- **S-02（对应 A④ 观察；严重度 建议）**
  - 位置：§2.12~§2.15（`:227~:256`）。原文：表格/占位说明逐文件给了「新增/改 + 归属 WP + 类型 + 契约内容」，未列「导出签名 / 入参出参」。
  - 依据：脚本3 `2.12~2.15 签名=false / 入出参=false`。按判定原则②（测试/probe 占位不产出产品 API）已判 A④ PASS，但机械口径存在歧义。
  - 建议修法：在 4 个小节每文件补一行「接口形状」，或统一加注「测试/占位文件无产品导出签名，验收靠 `test/wp13/*` 断言与 §2.14 逐字实文锚点」；便于机检口径自洽。
- **S-03（对应 C④ 观察；严重度 建议）**
  - 位置：§7 风险 15（`:699`）、风险 20（`:704`）。原文：处置列点名 `AC-54 正文` / `§6 检查点 #2 命令块` / `§8 确认段` 等文档锚点与 AC 编号，未点名 `src/` 文件 / 函数名 / `WP-x`。
  - 依据：脚本3 `处置列未点名文件/函数/WP 的风险行: 15,20`；§7 表头（`:683`）为「点名文件 / 函数 / **AC**」，与判据字面「文件/函数/WP」有措辞差异。
  - 建议修法：在两行处置列补具体锚点（如风险15 补 `test/fixtures/purity-check.mjs` + `WP-7`；风险20 补 `WP-4` / `src/cli/labels.js`），贴合判据字面。
- **S-04（对应 C⑤ / 裁-6 留痕口径；严重度 建议；**同时是主控裁决点**）**
  - 位置：§8 冲突13（`:726`）、「需要主控书面确认 / 裁决的点」（`:729~:731`，尤其 `:731` B-09）。原文：「附录 B-09 标『需评审裁决』」「需要主控书面确认 / 裁决的点」。
  - 依据：`decisions.md:30` 裁-6 已把 B-09「从『需评审裁决』改判『已裁决（不阻塞）』」，且影响面明列「`iteration-8.md` §2/§4/§6（已据此冻结）」。拆分文档产品段已按 `session_policy` 落地（C⑤ PASS），但 §8 状态表述仍停留在「需评审裁决」，未同步裁-6 的「已裁决」结论。
  - 建议修法：把 §8 B-09 段改为「已裁决（不阻塞）：按需求 `session_policy` 落地、不改名 `session_reuse`、需求正文 v3 一字不改，仅 S1 评审记录与 `decisions.md` 台账留痕」，并保留「如实登记附录 B 正文仍写需评审裁决」的说明。**是否按裁-6 同步 §8 措辞，请主控裁决**（见返回格式 ⑤）。
- **S-05（对应 C⑦ 观察；严重度 建议）**
  - 位置：§3 / §5 / WP 验收口径对附录 A 文案的引用。原文：采用「AC Then 具体值」而非附录 A-3 模板占位符行逐字复制（脚本2 `14/27` 逐字命中）。
  - 依据：逐字核对无措辞改写（C⑦ PASS），§4:398 / §8:708 已声明「以需求为准、不改写」。但机检「附录 A 逐字副本」口径不闭合。
  - 建议修法：在 §3 或 §5 补一份「附录 A-1~A-10 逐字来源登记表」（可只列 A-3 17 行的模板形式并注明「AC Then 为同文案具体值实例」），或比照裁-4 对 D-11 五条命令的做法给逐字副本，避免机检误报「被改写」。
- **S-06（对应 D① `--help` 观察；严重度 建议）**
  - 位置：§6 检查点 #5（`:656~:659`）。原文：`node bin/orch.js --help` 列作「用法块 / 命令树 / 11 键 JSON」检查命令。
  - 依据：实跑 `exit=2`、输出 25 行用法块 + 第 26 行「（未知命令：--help）」——CLI 未注册 `--help`，借「未知命令打印用法」路径达成目的；`orch recover` 退 2 才是 AC-55 的正式断言。
  - 建议修法：在 §6 #5 注明 `--help` 是「未知命令触发用法块」路径（exit 2），S3 取证 `USAGE_LINES.length === 25` 与前 8 行逐字时直接断言 `src/cli/labels.js` 的 `USAGE_LINES` 常量，避免把「未知命令」误读为「help 参数可用」。
- **S-07（对应 C② M-7 接缝名差集；严重度 建议）**
  - 位置：§6 冻结点 6（`:621`）。原文：逐字冻结 15 个 M-7 新增接缝名。
  - 依据：脚本2 需求环境名 17 / 拆分 §2 15，差 `MAESTRO_TEST_STOP_AFTER`、`MAESTRO_TEST_DELIVERY_DELAY_MS`；Grep 实文确认二者是 `src/core/orchestrator.js:351/:367` 现状既有接缝（需求 `:900`/`:1360` 声明「不改既有参数语义」）。C② 已判 PASS（无需求外夹带），但差集未显式说明。
  - 建议修法：在冻结点 6 补一句「另有 2 个现状既有接缝 `MAESTRO_TEST_STOP_AFTER` / `MAESTRO_TEST_DELIVERY_DELAY_MS` 按既有语义复用、不属本迭代新增冻结项」，使 17/15 差集可机检自洽。

## 6. 实跑命令与输出摘要

**只读纪律与 evidence 还原**
```
评审前 git status:  M docs/iterations/iteration-8/decisions.md ; ?? docs/iterations/iteration-8.md
全量测试后:  docs/iterations/iteration-4/evidence/{nfr-perf-atomic,nfr-perf-batch,nfr-perf-render}.json 被改写
执行: git checkout -- docs/iterations/iteration-4/evidence/nfr-perf-atomic.json \
       docs/iterations/iteration-4/evidence/nfr-perf-batch.json \
       docs/iterations/iteration-4/evidence/nfr-perf-render.json
还原后: git status --short docs/iterations/iteration-4/evidence/  →  （空）
终态 git status:  M docs/iterations/iteration-8/decisions.md ; ?? docs/iterations/iteration-8.md
                 （+ 唯一新建 docs/iterations/iteration-8/split-review-round1.md）
```
未修改 `iteration-8.md` / `requirement.md` / `decisions.md` / `src/**` / `test/**`。临时脚本与日志全部在 `%TEMP%`：`i18-review.cjs`、`i18-review2.cjs`、`i18-review3.cjs`、`i18-review4.cjs`、`i18-review-fulltest2.log`、`i18-wp11.log`、`i18-wp4.log`、`i18-help.log`、`i18-recover.log`、`i18-review-smoke/*`。

**机械脚本输出摘要（当场重跑）**
```
i18-review.cjs   : B① 两种口径交集均空 / orchestrator.js owner=["WP-4"] ; B④ 67 定义=67 引用、无缺号重号、主责合计 67 ; D② 符号 FOUND/ABSENT 清单 ; §5 15 新增路径 NOT_EXIST tracked=false
                   注：B② 该脚本按「依赖行全文」误报环，已由 i18-review4.cjs 按 §6 权威口径推翻
i18-review2.cjs  : A① 9 个 ## 全 OK ; A② 7 WP 五字段齐全 ; A③ 1.1~1.12 三段全 true、1.13 汇总表误计 ; A⑤ 3/5 命中 ; A⑥/A⑦ true ; C② 7 项逐字 OK ; C⑦ 14/27 ; C⑥ 13 条抽查 ; D④ d4b0f94=9 / 0cd113b=8
i18-review3.cjs  : §1.13 26 编号无缺号重号 ; C③ 冻结点 10 个 + 整合检查点 ; C④ 20 风险、5 吸收项全在、15/20 点名口径 ; C① 退出标准 9 条 ; A④ §2.1~2.11 全齐、2.12~2.15 缺签名/入参出参 ; C⑤ §2/§4/§6 session_policy 全、session_reuse 0
i18-review4.cjs  : §6:603 边集合 vs §4 标题 7/7 一致 ; 悬空依赖 无 ; DFS 无环 ; 拓扑序 WP-1→2→5→6→4→3→7 全可排
```

**门禁四件套与关键命令 exit 码汇总**（详表见 §4 命令清单）
```
全量测试                       exit=1  (992/988/4，前次 992/987/5；4 个既有噪声；evidence 已还原)
D-11 五条纯净扫描              exit=0 ×5（#4 输出 0、#5 输出 OK: no CJK）
零运行时依赖                   exit=0  输出 0
D-9 两授权文件                 exit=0 ×2（36/36、33/33）
orch --help                    exit=2  （25 行用法块 + 未知命令 --help；登记 S-06）
orch recover                   exit=2  （符合 AC-55）
code-loop --scenario pass      exit=0
task-loop --scenario doc-pass  exit=0
AC-56 四锚点                   0 / 0 / 0 / NOT_EXIST
git cat-file -t d4b0f94|0cd113b  commit / commit
```

**未实跑 / 仅核实的命令**：`git worktree add --detach "$BASE" d4b0f94`（§6 #6，会写 `.git/worktrees`，与只读纪律冲突，仅核实 commit 与语法，留 S3）；`--kill-after` 等 S2 规划新增接缝（标新增，未冒充现状命令）。

**总判复核**：23 条判据 22 PASS / 1 FAIL（A⑤ 建议级），阻断 0 / 建议 7。按任务书「只有全部判据 PASS 且阻断 0 才允许写 PASS」→ **总判 FAIL**。
