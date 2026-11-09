# I1.8 需求评审 · 第 1 轮（独立评审）

## §0 总判

- **总判：FAIL**
- **阻断 12 项 / 建议 12 项**
- **评审对象**：`docs/iterations/iteration-8/requirement.md` v1（BR-01~BR-49、AC-01~AC-58、NFR-01~NFR-08、M-1~M-8、C-01~C-16、附录 A~D）
- **复核方式（实跑，非印象）**：逐字读 `docs/index.md` 第一部分 §1/§3.1~§3.6/§4 能力域 3·5·6/§5/§6、第二部分 `#### I1.8`（813~824）与 696 / 703 / 711 / 1003~1020、`docs/templates/requirement-template.md` 全文；对照 `docs/iterations/iteration-6/requirement.md` 附录 D-9 与 `report.md` §5；实跑 18 组命令/探针（见 §6），含一次真实回流现场的中间态探针（`code-loop-driver --scenario backflow-hold --keep`）。所有临时项目根在 `%TEMP%`（`/tmp/i18-*`），已删除；唯一新增文件是本评审报告。
- **一句话结论**：8 个规划子项都有独立落点、方言与恢复规则的文字骨架完整，但**核心验收场景（回流中途杀 daemon → 不重复已完成节点）的前提与产品事实相反**（回流发生时测试节点必为 `failed`、`done` 节点数为 0），加上「状态机」被降为 phase 投影、会话状态自创 `cooldown`、D-9 授权清单漏项，本轮不满足进入拆分（S1）的条件。

---

## §1 规划原文逐句覆盖表（强制）+ 反向扫描

### 1.1 覆盖表

> 判定只取「覆盖」为 PASS；`部分 / 缺漏 / 越界 / 收窄` 一律 FAIL。

| # | 规划原文（逐字 + `index.md` 行号） | 需求 §2 落点（节号） | 需求 §3 落点（AC 号） | 符合性 | 覆盖判定 |
|---|---|---|---|---|---|
| 1 | 「实例管理器完整：状态机、轮次计数、检查点」（815） | §2.2（189~205；总览 180） | AC-01、AC-02~06、AC-07、AC-09、AC-10、AC-14、AC-58 | **收窄**：`blocked/ready/assigned` 只作为 `phase` 存在，`NODE_STATES` 不扩；§2.2 标题由「状态机」改为「状态位置」（189） | **FAIL** |
| 2 | 「ACP 会话恢复方言处理：`session/resume`（不回放）、`session/load`（回放/追加）、`resumeOrCreate` 回退链」（816） | §2.3（207~220） | AC-19~27 | 一致 | 覆盖 |
| 3 | 「崩溃恢复：daemon 重启后从检查点恢复」（817） | §2.4（222~236） | AC-05、AC-09、AC-10、AC-11、AC-15、AC-16、AC-17、AC-18、AC-58 | 一致 | 覆盖 |
| 4 | 「角色实例恢复规则：`busy` 角色会话不可恢复时降级为 `available`」（818） | §2.5（238~249） | AC-28~31 | 一致（§3.3 `unavailable` 无口径见 F-04，不属本行句义） | 覆盖 |
| 5 | 「连接线聚合恢复规则：`delivered` 未 `accepted` 标记为 `pending` 并重投」（819） | §2.6（251~261） | AC-32~36 | 一致（重投失败路径无 AC 见 F-06；`created` 态见 F-04） | 覆盖 |
| 6 | 「特殊节点恢复规则：`human` 节点保持 `running`」（820） | §2.7（263~273） | AC-37~41 | 一致 | 覆盖 |
| 7 | 「会话失败区分：ACP 会话进程崩溃 vs 运行慢」（821） | §2.8（275~284） | AC-42~47 | 一致（二次崩溃无 AC 见 F-06） | 覆盖 |
| 8 | 「会话复用策略：`reuse` / `fresh`」（822） | §2.9（286~296） | AC-48~51 | **一致但用词越层**：`cooldown` 被当成会话状态（292 / BR-42:355 / C-15:169 / D-13:1269），见 F-03 | 覆盖 |
| 9 | **验收**「回流中途 kill daemon，重启后从检查点恢复且不重复已完成节点」（824） | §2.2 / §2.4 / §2.10（304~305） | AC-07、AC-08、AC-09、AC-10、AC-58 | **收窄**：场景前提与产品事实相反（code-loop 回流时测试必为 `failed`），「不重复已完成节点」无可判定的现场，见 F-01 | **FAIL** |
| 10 | **验收**「ACP 会话恢复方言正确回退」（824） | §2.3（216） | AC-19~23、AC-25、AC-27 | 一致 | 覆盖 |
| 11 | **验收**「角色实例和连接线聚合正确恢复」（824） | §2.5 / §2.6 | AC-28~36 | 一致 | 覆盖 |
| 12 | 环境归属「**预判 C**，真实面必须本机」（696） | §1.2#9、§3.3#5~6、§2.3 真实面 | AC-25、AC-26、AC-27、AC-57 | 一致 | 覆盖 |
| 13 | 分派结论「I1.8 **只能外派主体**，真实面与真机联调留在本机」（703） | §3.3#5~6、BR-48、BR-49 | AC-25~27、AC-57 | 一致 | 覆盖 |
| 14 | 回归红线「三主链逐字不变；`--forbid` 31 词 exit 0；失败集合差集 0；D-9 已扩到 31 词」（711） | §1.3#12、BR-44/45、D-11/D-12 | AC-52、AC-53、AC-54、AC-55 | **部分**：31 词与差集口径一致，但 D-11 第 3/4 条扫描面窄于 I1.6 D-9（F-13） | **FAIL** |
| 15 | 迭代依赖「I1.7 → I1.8」（1003~1020） | §1.3 范围外（68）、BR-47、R-9、C-16、B-01 | AC-56 | 一致（越前已在 B-01 登记，主控需书面确认）；AC-56 锚点恒假见 F-12 | 覆盖 |

**覆盖统计：15 行中 12 行覆盖、3 行 FAIL（#1、#9、#14）。**

### 1.2 反向扫描一：§2 每个功能点 → 规划来源

| §2 节 | 功能点 | 规划来源 | 判定 |
|---|---|---|---|
| 2.2 | 状态位置 / 轮次 / 检查点 | 815 + 基线 §3.1/§3.6/§5.2；写点与写失败提示来自 R-2/C-03/C-06 | 有来源（子能力派生），无夹带 |
| 2.3 | 恢复方言 | 816 + 能力域 3（`index.md:354`） | 有来源 |
| 2.4 | 崩溃恢复 | 817 + 基线 §3.6（282~301） | 有来源 |
| 2.5 | 角色实例恢复 | 818 + 基线 §3.6（291） | 有来源 |
| 2.6 | 连接线聚合恢复 | 819 + 能力域 4 聚合优先级（`index.md:395`） | 有来源 |
| 2.7 | 特殊节点恢复 | 820 + 基线 §3.6（294~295） | 有来源 |
| 2.8 | 会话失败区分 | 821 + 能力域 6（`index.md:568`） | 有来源 |
| 2.9 | 会话复用 | 822 + 能力域 3（`index.md:356`） | 有来源 |
| 2.10 | 功能衔接 | 824 验收句 | 有来源 |

**无「夹带」功能点。** 唯一越界嫌疑是 §2.9 的 `session_policy` 字段名，属角色作者可见的配置键（I1.6 先例），不判夹带。

### 1.3 反向扫描二：基线相关状态词 / 能力域 → §2 落点

| 基线来源 | 状态/条目 | §2 落点 | 判定 |
|---|---|---|---|
| §3.1 | `blocked` `ready` `assigned` `running` `review` `done` `failed` `escalated` `cancelled` | §2.2、A-1、BR-01 | 9/9 覆盖 |
| §3.2 | `idle` / `thinking` / `tool_running` | C-09、§2.3、§2.8 | 覆盖 |
| §3.2 | `waiting_dependency` | C-09（163）、D-4 | 覆盖 |
| §3.2 | `waiting_input` | §1.3 范围外（73）、BR-49、B-10 | 规划外，例外成立 |
| §3.2 | 会话 `escalated` | 无（仅节点 `escalated`） | 部分（会话侧无口径，随节点派生，可接受） |
| §3.3 | `inactive` / `available` / `busy` / `cooldown` / `retired` | §2.5、BR-24~26、§2.5 边界（249） | 覆盖 |
| §3.3 | **`unavailable`** | **无任何落点** | **缺漏（F-04）** |
| §3.4 | `delivered` / `pending` / `accepted` / `consumed` / `rejected` / `expired` | §2.6、BR-28~30 | 覆盖 |
| §3.4 | **`created`** | **无任何落点** | **缺漏（F-04）** |
| §3.6 | `running`+可恢复 / 不可恢复 | §2.3、§2.5、BR-22 | 覆盖 |
| §3.6 | `assigned` → `assigned` | 无独立落点（只有 `running→assigned`） | **缺漏（F-05）** |
| §3.6 | `review` → 重新校验 | BR-14、AC-14 | 覆盖 |
| §3.6 | **`blocked` / `ready` → 原状态** | **无任何落点** | **缺漏（F-05）** |
| §3.6 | 角色 `busy`→`available`、交接 `delivered`→`pending`、`suspended` 保持、`escalated` 不重派、`failed` 不重跑 | §2.5 / §2.6 / §2.7 / BR-15/16/35 | 覆盖 |
| §4 能力域 3 / 5 / 6 | 方言、实例管理、会话失败区分 | §2.3 / §2.2 / §2.8 | 覆盖 |
| §5.2 | `state/` 含检查点 | §2.2、M-2、D-3 | 覆盖 |
| §6 | #2 无宿主分支、#8 注册表/实例分离、#9 派生视图 | R-2、BR-23、BR-27、BR-31 | 覆盖 |

---

## §2 第二部分：符合规划 / 罗列全面

| 判据 | 结论 | 依据 |
|---|---|---|
| **A①** 规划条目逐字 → §2，语义不降级/不收窄/不换名/不合并 | **FAIL** | 815 的「状态机」被落成「状态位置投影」：§2.2 标题 `requirement.md:189`、§1.3#1 `:51`、R-1 `:107`、M-1 `:142`、B-11 `:1003` 明写「`NODE_STATES` 仍 6 项」；9 个位置只在 `phase` 上存在，不是状态。另 8 项（方言/崩溃/角色/连接线/特殊节点/失败区分/复用）逐项有独立 §2 节，无合并、无更名 |
| **A②** 用户操作/预期效果/异常/边界与规划能力语义一致 | PASS | §2.2~§2.9 六要素齐全；§2.4 `:228~236`、§2.5 `:243~249`、§2.6 `:256~261`、§2.7 `:268~273`、§2.8 `:280~284`、§2.9 `:291~296` 均覆盖规划语义 |
| **A③** 规划范围外没被写成范围内 | PASS | 审批（`:73`/BR-49）、worktree（`:68`/R-9/C-16）、human 运行时（`:70`/R-6）、资产版本（`:71`/B-02）、权限匹配（`:72`/B-03）均在范围外 |
| **A④** 规划「保持向后兼容」有旧写法落点 | PASS | `index.md:711` 三主链红线 → BR-44、AC-52/53/55、D-12（`:1248~1259`） |
| **A⑤** 无规划外新能力 | PASS | 未新增 CLI 命令（BR-46、AC-55）；`session_policy` / 检查点 / 恢复行均为 815~822 或基线派生 |
| **B①** 规划条目数与 §2.1 功能总览逐项对账、零缺漏 | PASS | 规划 8 条 ↔ §2.1 8 行（`:178~187`）一一对应；首行把 815 的三个子项合成一格，但 §2.2 内分述、AC 独立（AC-01 / AC-07 / AC-02~06），未失去可判定性 |
| **B②** §3 状态词（含 §3.6 每一行）、能力域、§5.2、§6 在 §2 有落点 | **FAIL** | 角色 `unavailable`、交接包 `created` 无落点（F-04）；§3.6 的 `assigned→assigned`、`blocked/ready→原状态` 两行无落点（F-05） |
| **B③** §2.4 功能衔接覆盖验收句完整流程（含失败路径） | **FAIL（部分）** | §2.10（`:298~308`）覆盖崩溃重建/升级/运行慢/角色降级/交接重投，但没有「恢复失败 → 已中断」「重投连续失败 → 已过期」两条失败路径（F-15） |
| **B④** §2.5 的 BR 覆盖每条用户可见规则 | PASS | 49 条 BR 覆盖 §2.2~§2.9 的用户规则；BR-45~49 属工程口径（与 I1.6 先例一致），BR-49 另见 F-09 |

---

## §3 第三部分：符合规划 / 罗列全面

| 判据 | 结论 | 依据 |
|---|---|---|
| **C①** 验收句逐字 → 至少一条 AC，语义不被弱化 | **FAIL** | 三句都有 AC（9→AC-09/10/58；10→AC-19~23；11→AC-28~36），但第 1 句「不重复已完成节点」的现场不成立：code-loop 发生回流只可能因测试判定不通过，此时测试节点是 `failed` 而非 `done`，`done` 节点数为 0（F-01，实跑取证见 §6#12）。AC-08 的 Given「开发、测试两个节点均显示已完成 + 第二轮在开发被强杀」在 code-loop 中**不可构造** |
| **C②** 每条 AC 的 Given/When/Then 是用户可见状态与操作 | PASS | 58 条 Then 均为用户可见词（状态词、命令输出行）；机检用内部字段属锚点，不属 Gherkin 正文。AC-01 的 Given 需夹具才可稳定构造（F-16） |
| **C③** 失败/异常/超限路径有对应 AC | **FAIL** | 缺 §2.6「重投连续失败 → 过期 → 升级」（`:260`）、§2.8「重建后再次崩溃 → 直接升级、最多一次」（`:283`、C-13:167）；AC-23 夹具不足以造成「三种方言都失败」（F-07）；AC-45 Given 不可构造（F-08） |
| **C④** 每条 AC 有场景类型/风险/引用三件套与可执行锚点 | **FAIL** | 机械核对 58/58 三件套齐全、均有「机检/夹具/架构检查」；但 AC-56 的锚点 `git log origin/main --grep "I1.7"` 为空**在当前基线恒假**（实测命中 `d4b0f94`），F-12 |
| **D①** §2 每个功能点（含异常、边界）→ 至少一条 AC，反向零缺漏 | **FAIL** | 缺口：§2.5 异常「既无可用会话、又无可调度节点 → 保持可用」（`:248`）、§2.9 边界「不跨宿主复用 / 不复用正在服务其他节点的会话」（`:296`）、§2.9 异常「reuse 无空闲会话 → 新建」（`:295`）、§2.6 重投失败、§2.8 二次崩溃（F-06、F-21）；AC-41 引用「无」但 §2.7 边界是用户可见规则（F-21） |
| **D②** 规划每个条目 → 至少一条 AC | PASS | 8/8 有 AC；验收句 3/3 有 AC |
| **D③** BR 双向覆盖 | **FAIL** | 机械核对：BR-01~BR-49 全部被引用，引用的 BR 全部存在；**BR-49 无任何 AC 引用**（F-09） |
| **D④** §3.2 非功能、§3.3 前置条件齐全且用户视角 | PASS | NFR-01~08、§3.3 12 条齐全；NFR-07 的判定写内部 `labels.js`（F-23，建议级） |
| **D⑤** AC 编号连续无重复 | PASS | AC-01~58 连续、无重复；BR-01~49 连续；NFR-01~08、M-1~8、C-01~16 连续 |

---

## §4 基线与需求模板合规

| 判据 | 结论 | 依据 |
|---|---|---|
| **E①** §2 不写接口/字段/表结构/内部状态机；§3 不写接口返回字段/日志（除用户可见） | PASS（附注） | §2 只写用户动作与可见行；§2.9 的 `session_policy` 是角色作者编辑的 YAML 键（I1.6 先例）。§3.1 机检引用 JSON 字段属执行锚点，项目惯例允许 |
| **E②** 状态词、术语与基线 §3 一致（逐个核对 9/6/6/7 态） | **FAIL** | 自创会话状态 `cooldown`：§2.9 `:292`「有 `空闲` 或 `冷却中` 的会话」、BR-42 `:355`、C-15 `:169`、D-13 `:1269`。基线 §3.2（`index.md:170~181`）会话只有 6 态，`cooldown` 是 §3.3 角色态；§3 开头（`index.md:127`）明写「四个层次…不能混用」。另「6 态表 / 6 个显示态」计数错误见 F-02 |
| **E③** 括号指引删净；附录 A~D 合规；C 与头部版本一致；D 可指导编码 | **FAIL** | 括号指引 0 残留；附录结构 A~D 齐全、C 表 v1 与头部 v1 一致。但：A 未登记 `会话 复用 …`（F-11）；A-9/D-12「既有 10 个顶层键」实测 11 键（F-14）；M-1「6 态」/ AC-01 机检「`NODE_STATES` 仍是 6 项」实测 7 项（F-02）；D-8 称「既有 `failed_reason: timeout`」并不存在（F-08） |
| **E④** 未决问题若影响开工须标阻塞 | **FAIL** | B-11（`:1003`）「位置投影是否满足规划『状态机完整』」直接决定核心交付物的形态，却标「不阻塞开工」；B-17（`:1009`）同一节点在 `instance graph` 显示「已分配」、在 `status.md` 显示「执行中」，属用户可见自相矛盾，也未标阻塞（并入 F-02/F-20） |
| **E-必核①** D-11 扫描口径与 `index.md:711`（31 词）/ I1.6 D-9 一致；范围是否被收窄 | **FAIL** | 词表 31 词逐字一致（实测 31）。但 D-11 第 3 条只扫 `src/cli/roles.js`，I1.6 D-9 第 3 条扫 `roles.js,skills.js,workflows.js`；D-11 第 4 条由 I1.6 的「新增实现零 CJK」换成了「零依赖」。判定：**不构成「为让扫描变绿而收窄」**（两种口径在当前 HEAD 均 exit 0，收窄前也不是红的），但**确为范围收窄**，且 D-11 自述「纳入后 18 处命中」实测 **34 处**（F-13） |
| **E-必核②** 授权断言修改清单点名文件+行号+只改哪段；新行为打破既有精确断言必须扩进清单 | **FAIL** | D-9（`:1208~1214`）只授权 `test/wp11/role-schema.test.js:57` 一行（该行逐字核对无误）。但 M-4 必破坏 `test/wp4/orchestrator.test.js:480~590`（`:575` `result.interrupted === ['INST-009']`、`:578` 状态 `interrupted`、`:586` `core.gone` 事件）——该用例当前全绿（实跑 33/33），改后必红，却不在清单（F-10） |

---

## §5 修复清单

### 阻断（12 项，按严重度排序）

**F-01｜核心验收场景前提与产品事实相反，「不重复已完成节点」不可判定**
- 位置：`requirement.md:305`（§2.10#4）、AC-03 `:389`、AC-08 `:429`、AC-09 `:439`、AC-10 `:447`、AC-24 `:557`；§1.2 指标 1/2（`:36~37`）
- 原文：「第二轮在开发节点被强杀…**已完成的开发第一轮与测试节点**没有重跑」「跳过 3 个已完成节点」
- 依据：code-loop 的回流只在测试判定 `reject` 时发生，该分支把测试节点置为 `failed`（`src/core/orchestrator.js:2483~2500`）；测试通过则实例直接 `completed`，不存在第二轮。实跑 `backflow-hold` 停在开发第二轮起点：`T-001 running round=2`、`T-002 failed round=1`、`done` 节点 0 个、`HO-002 backflow created`（§6#12）。因此 AC-08 的 Given（两节点均「已完成」+ 第二轮）在 code-loop 中逻辑上不可构造；AC-03 的「已完成节点 2 个」、AC-10 的「跳过 3 个」均为虚构数量
- 违反：C①（验收句语义未真正落地）、C③、D①；`index.md:824`「不重复已完成节点」
- 建议修法：改用**存在 `done` 节点的现场**——① task-loop：研究、撰写 `done`、审核 `running` 时杀核心（可断言 2 个 done 节点 0 次提示）；② 或 code-loop 在「开发第二轮 `done`、测试复测 `running`」时杀核心（1 个 done）。同时把「测试节点」改写为「`failed` 的测试节点按 BR-16 不自动重跑」，并把「跳过 N 个」改为该现场实测数量（预计 1~2，不是 3）
- 严重度：**阻断（最高）**

**F-02｜规划「状态机」被降为 phase 投影；6/7 态计数全篇错误**
- 位置：`:51`、`:107`（R-1）、`:142`（M-1）、`:189`（§2.2 标题）、`:376`（AC-01 机检）、`:1003`（B-11）
- 原文：「把基线 9 态完整落到实例管理器」「`NODE_STATES` 仍是 6 项（回归断言）」「节点状态表是 6 态（`pending`/`running`/`review`/`done`/`failed`/`cancelled`/`escalated`）」
- 依据：`src/core/state-machine.js:43~51` 的 `NODE_STATES` 实为 **7 项**（含 `escalated`），跑 `node -e` 已核（§6#2）；AC-01 的机检因此恒假。§1.3#1 的「既有 7 列与 6 个显示态」也与 `NODE_LABEL` 的 7 个显示词不符
- 违反：A①（收窄/换名）、E③（D 不可指导编码）、E④（B-11 影响开工却标不阻塞）
- 建议修法：二选一并写死——① 把 `blocked/ready/assigned` 落为真实状态并同步 D-2/AC-01（同时评估三条主链影响）；② 保留投影，但把 §2.2 标题改回「状态机（位置投影）」，在 B-11 写明「由主控裁决接受」，并把全文「6 态」改为「7 态」、「6 个显示态」改为「7 个显示态」、AC-01 机检改为「`NODE_STATES` 仍是 7 项」
- 严重度：**阻断**

**F-03｜自创会话状态 `cooldown`（四层混用）**
- 位置：`:292`（§2.9）、`:355`（BR-42）、`:169`（C-15）、`:1269`（D-13）
- 原文：「会话状态为 `idle` 或 `cooldown`」「`state ∈ {idle, cooldown}`」
- 依据：基线 §3.2（`index.md:170~181`）会话 6 态无 `cooldown`；`cooldown` 是 §3.3（`index.md:204`）角色态。`index.md:127` 明写四层「不能混用」；`src/cli/labels.js` 的 `SESSION_LABEL` 亦无该键
- 违反：E②（自创状态词，按判据一律阻断）
- 建议修法：改为「会话 `idle`（或 `waiting_dependency`）+ 角色 `cooldown`」；D-13 的筛选条件拆成「会话态 ∈ {idle}」且「角色态 ∈ {available, cooldown}」，不新增会话枚举
- 严重度：**阻断**

**F-04｜§3.3 角色 `unavailable` 与 §3.4 交接包 `created` 无恢复口径**
- 位置：§2.5（238~249）、§2.6（251~261）、BR-24~30（337~343）
- 原文：`unavailable`（"会话崩溃或宿主不可达"）与 `created`（"已构造，未投递"）全文 0 次
- 依据：实跑回流现场出现 `HO-002 state=created`（§6#12）——这正是「构造后、投递前崩溃」的真实窗口，§2.6 只处理 `delivered` 未 `accepted`，该包会停在「已构造」不再投递；`unavailable` 是会话崩溃场景的既定角色态（`index.md:205`），I1.8 引入崩溃判据后必须有去向
- 违反：B②、D①、`index.md:282~301` 的完整性
- 建议修法：§2.6 增一句「已构造但未投递的交接包恢复后继续投递（不重构造）」，并补 AC；§2.5 增「崩溃重建失败/宿主不可达时角色显示『不可用』，恢复后按派生规则回到可用/服务中」，并补 AC（或明确写「本迭代不产生 `unavailable`」并说明为什么崩溃不会触发它）
- 严重度：**阻断**

**F-05｜§3.6 两行无落点：`assigned → assigned`、`blocked/ready → 原状态`**
- 位置：§2.2/§2.4/§2.7（全节）、AC-23（546~552）
- 原文：基线 `index.md:288`「`assigned` | `assigned` | 重新调度」、`:290`「`blocked` / `ready` | 原状态 | 依赖关系不变」
- 依据：需求只有「`running` + 会话不可恢复 → `assigned`」（BR-22），没有「本来就 `assigned` 的节点重启后仍 `assigned` 并重新调度」；`blocked`/`ready` 在恢复语境下从未出现（只在 A-1 的显示表里）
- 违反：B②（§3.6 每行都要有落点）
- 建议修法：§2.2 增两句「恢复前就处于『已分配』的节点保持『已分配』并重新派发；处于『待执行』（`blocked`/`ready`）的节点保持原位置，依赖关系不变」，各补一条 AC（可与 AC-01 合并但需独立 Then）
- 严重度：**阻断（低）**

**F-06｜§2.6 异常与 §2.8 边界缺 AC**
- 位置：`:260`、`:283`、C-13（`:167`）
- 原文：「重投连续失败仍按既有规则进入 `待投递` 计数，最终 `已过期` 并升级人工」「同一次派发最多重建一次；重建后的会话再次崩溃，直接升级人工，不再重建」
- 依据：AC-32~36 全为成功/不回改路径；AC-42/43 只覆盖「第一次重建成功」「第一次重建失败」，「重建后再次崩溃」无 AC。C-13 是明确的用户可见处置规则
- 违反：C③、D①；模板「不能只写 happy path」
- 建议修法：新增 2 条 AC：① 重投 N 次仍失败 → `已过期` + 升级 + 用户看到「已过期」（断言 `handoff.state === 'expired'`、升级 1 条）；② 重建成功后会话再崩 → 直接「已升级人工」、`session/new` 不再增加、轮次不变
- 严重度：**阻断**

**F-07｜AC-23 夹具不足以造成「三种方言都失败」**
- 位置：AC-23 `:546~552`
- 原文：标题「三种方言都失败时按 §3.6 降级」；夹具只有 `MAESTRO_MOCK_CAPS=both` + `MAESTRO_MOCK_RESUME=fail` + `MAESTRO_MOCK_LOAD=fail`
- 依据：缺 `session/new` 失败注入时，mock 的 `session/new` 会成功（`test/fixtures/mock-acp-agent.js:1127` 正常分支），节点会进 `running`，不会出现 Then 的「已分配 / 可用 / 待投递」。同文件 AC-43 已使用 `MAESTRO_MOCK_NEW_FAIL=1`，说明接缝存在但此处漏写
- 违反：C③（关键降级路径不可达）
- 建议修法：夹具补 `+ MAESTRO_MOCK_NEW_FAIL=1`，并在 Then 明确「`session/new` 也失败后实例不进入运行」
- 严重度：**阻断**

**F-08｜AC-45 Given 不可构造；「既有 `failed_reason: timeout`」不实**
- 位置：AC-45 `:722~728`、D-8 `:1205`
- 原文：「夹具图给节点声明 `timeout: 2`」「按既有 `failed_reason: timeout` 进入失败/升级」
- 依据：① `orch run --template` 只接受三张内建图（`src/cli/main.js:756~757`、`src/core/orchestrator.js:3412~3426`），daemon 侧 `graphs` 不可外部注入，`recovery-driver` 也无法把自定义图送进 daemon；M-7/D-10 没给「自定义图」接缝 → Given 不可构造。② 全仓不存在 `failed_reason` 写入（仅 `src/core/advance.js:493/552` 的 `reason: 'verdict_fail'`），节点超时逻辑也不存在（`grep timeout src/core` 只有 `waitForRun`）→「既有」为假
- 违反：C②、C③、E③（D 不可指导编码）
- 建议修法：① 在 M-7 增一个仅测试生效的图注入口（如 `MAESTRO_TEST_GRAPH=<path>`），或改 AC 用「测试内直接构造 orchestrator 并注入 graphs」并写明；② 把「既有」改为「新增 `failed_reason: timeout`」，并在 M/C 中登记该字段与落盘位置
- 严重度：**阻断**

**F-09｜BR-49 无任何 AC 引用；且它不是用户可见规则**
- 位置：BR-49 `:362`、§3.3#7 `:855`
- 依据：机械核对 49 条 BR，唯 BR-49 无 AC 引用（§6#3）；内容「真实 DSH 写 cwd 不触发 `session/request_permission`」是环境事实，不属模板要求的「用户能感知的规则」
- 违反：D③、模板 §2.5 定义
- 建议修法：把该条从 BR 表移入 §3.3#7 或附录 B（B-10 已覆盖），BR 编号顺延或保留为「已迁移」；若保留为 BR，必须给一条 AC（例如 AC-57 的引用补上 BR-49）
- 严重度：**阻断（低）**

**F-10｜D-9 授权断言清单漏掉 `test/wp4/orchestrator.test.js`**
- 位置：D-9 `:1208~1214`
- 原文：「除这一行外，`test/**` 一个字符都不许改」
- 依据：M-4 把 `running`/`created` → `recoverInstance`，而该用例（`test/wp4/orchestrator.test.js:480~590`）预置 `template: 'single'`（内建图）的 `running` 实例并断言 `result.interrupted === ['INST-009']`、`state === 'interrupted'`、`core.gone` 事件。`single` 是内建图（`src/templates/index.js` GRAPHS 键），按 D-5 会走「按实例记录恢复」→ 状态仍 `running`、`interrupted` 为空 → 三条断言必红。当前该文件 33/33 全绿（§6#10）
- 违反：硬约束「授权断言修改清单」；`index.md:711` 回归红线
- 建议修法：把该用例列入 D-9，点名 `test/wp4/orchestrator.test.js:480`、`:575`、`:578`、`:586`，写清「改为：无检查点 + 内建图 → 恢复为 running、node 保持 running、写恢复事件」，并说明 `core stop`（`interruptAll`）用例不动
- 严重度：**阻断**

**F-11｜附录 A 未登记 `会话 复用 …` 行，与「未登记不得改动」自相矛盾**
- 位置：A-3 `:899~913`、A-5 `:927~936`；AC-49 `:759`、§2.9 `:292`
- 原文：AC-49 要求日志「`会话 复用 sess-003（角色 developer）`」；A 开头 `:866` 写「本附录只登记**新增/变更**输出；未登记的输出不得改动」
- 依据：A-3 的短语表 13 行无该行；A-5 只登记 `role show` 的复用行
- 违反：E③（附录不可指导编码/自相矛盾）、§1.3#11「全部进附录 A」
- 建议修法：A-3 增 `会话 复用 {会话号}（角色 {中文名}）`，并注明只 `reuse` 命中时出现
- 严重度：**阻断（低）**

**F-12｜AC-56 机检锚点恒假**
- 位置：AC-56 `:816`
- 原文：「`git log origin/main --grep "I1.7"` 为空」
- 依据：实跑 `git log origin/main --grep "I1.7" --format="%h %s"` 命中 `d4b0f94`（提交正文含「workflow 双语义建议 I1.7 统一命令树」），§6#11。锚点与「main 不含 I1.7 能力」不是同一命题
- 违反：C④（锚点不可执行）
- 建议修法：改为「`git log origin/main --oneline --grep "^[0-9a-f]* I1.7 —"` 为空」或直接检查能力：`test ! -e src/core/worktree.js`、`grep -R "worktree" src/ | wc -l === 0`；并在报告里以「I1.7 需求文件是否存在」为准
- 严重度：**阻断（低）**

### 建议（12 项）

> 本节 12 项严重度均为 **建议**（不阻断开工，但应在 S1 前收敛或书面登记）。

**F-13｜D-11 扫描面窄于 I1.6 D-9，且自述命中数错误**
- 位置：D-11 `:1227~1246`、§3.3#9 `:857`
- 违反：E-必核①（判据收窄）；§3.3#9「与 I1.6 D-9 一致」的自述
- 依据：I1.6 D-9#3 扫 `roles.js,skills.js,workflows.js`，D-11#3 只扫 `roles.js`；I1.6 D-9#4 是「新增实现零 CJK」（`src/registry` + 三个 CLI 文件），D-11#4 换成零依赖。实跑：D-11 四条 → 全 exit 0；I1.6 三文件口径 → exit 0；再加 `labels/render/main` → **34 处命中 exit 1**（D-11 自述「18 处」）。判定：**不是「为变绿而收窄」**（收窄前后都为绿），但确为**判据收窄**，被丢掉的 CJK 门禁恰好覆盖本迭代要改的 `src/registry/role-schema.js`、`asset-write.js`、`src/cli/roles.js`，而 NFR-07 依赖「新文案全部来自 labels.js」
- 建议：D-11 恢复为 5 条（补回 CJK 扫描），第 3 条恢复三文件；把「18 处」改为实测 34 处或删除该数字

**F-14｜A-9 / D-12「既有 10 个顶层键」与实测 11 键不符**
- 位置：A-9 `:961`、D-12 `:1254`
- 违反：E③（附录 D 不可指导编码）；D-12 的「既有 11 键」兼容红线
- 依据：`src/cli/render.js:1302~1316` 输出 11 键；`test/wp11/graph-view.test.js:16~19` 的 `GRAPH_KEYS` 11 项、`:81~83` 断言「恰好 11 键」。照 A-9 的字面执行会误删 `approvals` 或误判
- 建议：改为「既有 11 键与顺序不变」，并说明恢复实例追加到 13 键（`recovery`/`connections` 插在 `current` 之后）

**F-15｜§2.10 缺两条失败路径**
- 位置：§2.10 `:298~308`
- 违反：B③（功能衔接须含失败路径）
- 依据：没有「恢复失败 → 已中断」「重投连续失败 → 已过期 → 升级」；B③ 要求含失败路径
- 建议：在步骤 5/6 之后补一段「如果恢复本身失败，我看到『已中断』与原因；如果重投一直失败，交接包最终『已过期』并进入升级」

**F-16｜AC-01 Given 无夹具/接缝，「已分配」态不可稳定构造**
- 位置：AC-01 `:370~376`
- 违反：C②（Given 可构造性）；辅助对照「Given 是否可构造」
- 依据：正常 code-loop 中 `assigned` 是 `ready→running` 的瞬态；要让「已分配 / 执行中 / 待校验」同时出现，需 `MAESTRO_TEST_RECOVERY_HOLD=after_assign`（AC-28 已用）
- 建议：Given 追加该接缝，或补 `--scenario` 与 `.mock/paused` 等待点

**F-17｜AC-44 文案与夹具时间尺度矛盾**
- 位置：AC-44 `:714~720`
- 违反：C④（Then 文案与锚点不一致）
- 依据：Then 写「已等待 10m」，夹具用 `MAESTRO_TEST_SLOW_MS=100`，A-6 的 `{N}m` 只可能输出 `0m`
- 建议：Then 用 `已等待 {N}m`，或断言里同时接受缩短后的值并说明

**F-18｜AC-04「每实例 1 次」与 D-3「每次运行 1 次」不一致**
- 位置：AC-04 `:400`、D-3 `:1102`
- 违反：E③（附录 D 与 AC 自相矛盾）
- 建议：统一为「每次运行最多 1 次」，AC 机检同步

**F-19｜B-16「与 `state.json` 并列」措辞不实**
- 位置：B-16 `:1008`、D-3 `:1075`
- 违反：E③（附录 D 措辞与仓库布局不符）
- 依据：`state.json` 在 `instances/<id>/state.json`，新检查点在 `instances/<id>/state/checkpoint.json`——是新建子目录，不是并列文件
- 建议：改为「在实例目录下新建 `state/` 子目录，与 `state.json` 同级」

**F-20｜B-17 同一节点两处两种说法未裁决**
- 位置：B-17 `:1009`、D-2 `:1071`
- 违反：E②（同一状态两种说法）；E④（未决问题未标阻塞）
- 依据：`instance graph` 显示「已分配」，`status.md` 仍写「执行中」；用户在同一实例会看到两种说法
- 建议：开工前裁决；若接受，在附录 A 明写「`status.md` 不显示『已分配』」并在 AC-01 固定；若不接受，同步改 `src/core/status-text.js` 并把该断言列入 D-9

**F-21｜§2.5/§2.9 的异常与边界仍有 4 处无 AC**
- 位置：§2.5 `:248`；§2.9 `:295`、`:296`
- 违反：D①（含异常与边界说明零缺漏）
- 依据：无 AC 覆盖「无可用会话且无可调度节点 → 保持可用」「reuse 无空闲会话 → 新建」「不跨宿主复用」「不复用正在服务其他节点的会话」
- 建议：补 2 条 AC（一条角色、一条复用边界），或在 §2 明确降级为「本迭代不验证」并登记

**F-22｜NFR-07 判定依赖内部实现**
- 位置：NFR-07 `:844`
- 违反：模板 §3.2「用户能感知的约束」
- 依据：「新文案全部来自 `labels.js`」是内部结构，不是用户可感知约束
- 建议：用户侧保留「不出现裸英文原因码」；把 `labels.js` 移到 D 或机检说明

**F-23｜AC-26 的 mtime 断言可能被 `status.md` 刷新打破**
- 位置：AC-26 `:576`
- 违反：C④（锚点范围过宽，可能误判）
- 依据：恢复会写事件并可能刷新 `workspace/status.md`（`src/core/orchestrator.js` 有 `workspace.status_write_failed` 路径），「工作区产物文件 mtime 不变」范围过宽
- 建议：限定 `workspace/artifacts/**`

**F-24｜AC-45 Then 二选一，判定不唯一**
- 位置：AC-45 `:727`
- 违反：C④（Then 判定不唯一，测试有两解）
- 依据：「节点显示『失败』或『已升级』」使同一条 AC 有两种通过形态
- 建议：按 `timeout` 后的既有裁决路径固定为一种（失败后升级 → 「已升级」），另一种写为前置条件

---

## §6 实跑命令与输出摘要

> 环境：Windows 11 / Git Bash / Node v22.22.2；仓库 `D:/WWW/Maestro`，分支 `feat/i1.8-instance-recovery`，HEAD `3f35bfa`。所有项目根在 `/tmp/i18-*`，已删除。**未修改任何仓库文件**；全量测试会重写 `docs/iterations/iteration-4/evidence/nfr-perf-*.json` 的耗时数字，已在跑完后 `git checkout --` 还原（`git status` 现仅剩既有未跟踪目录 `docs/iterations/iteration-8/`）。

| # | 命令 | 输出摘要 | 用途 |
|---|---|---|---|
| 1 | `git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD` | `feat/i1.8-instance-recovery` / `3f35bfa` | 核对头部自述 |
| 2 | `node -e "import('./src/core/state-machine.js').then(m=>console.log(m.NODE_STATES.length, m.NODE_STATES))"` | **7** `["pending","running","review","done","failed","cancelled","escalated"]` | F-02 |
| 3 | `node -e "import('./src/cli/labels.js').then(m=>console.log(m.USAGE_LINES.length))"` | `25` | AC-55 成立 |
| 4 | `node bin/orch.js --help \| nl; node bin/orch.js recover` | 用法块 25 行 + `（未知命令：recover）`；exit **2** | AC-55 成立 |
| 5 | `sed -n '50,62p' test/wp11/role-schema.test.js` | `:57` 断言 `['tools','wake_allow','inputs','outputs','dispatchable']` | D-9 该行逐字无误 |
| 6 | `grep -n graphVersion -A 14 src/cli/render.js` + `sed -n '16,19p;81p' test/wp11/graph-view.test.js` | 顶层键 **11** 个；测试标题「恰好 11 键」 | F-14 |
| 7 | D-11 四条命令（`purity-check --dirs src/core,src/daemon` / `--dirs src/registry` / `--files src/cli/roles.js` / 零依赖） | 3 条 `OK` + 依赖数 `0`，全部 exit 0 | AC-54 现状可绿 |
| 8 | I1.6 D-9 第 3 条口径 `--files src/cli/roles.js,src/cli/skills.js,src/cli/workflows.js` | `OK: 扫描 3 个文件…零命中` exit 0 | 收窄前也是绿 |
| 9 | 再扩到 `labels.js,render.js,main.js` | **`FAIL: 34 处命中`** exit 1（D-11 自述「18 处」） | F-13 |
| 10 | I1.6 D-9 第 4 条（零 CJK：`src/registry` + 三个 CLI 文件） | `OK: no CJK` exit 0 | 被 D-11 丢掉的门禁当前为绿 |
| 11 | `git log origin/main --grep "I1.7" --format="%h %s"` | 命中 `d4b0f94 merge(I1.4+I1.5+I1.6)…` | AC-56 锚点恒假（F-12） |
| 12 | `node --test --test-concurrency=4 "test/**/*.test.js"` | `tests 992 / pass 988 / fail 4`；4 条为 EBUSY×1、EPERM symlink×1、盘符断言×2 | 与 §3.3#8 的「992/987·5 噪声」差 1（见 §6 末尾补充事实）；AC-53 的差集口径仍可行 |
| 13 | `node test/fixtures/code-loop-driver.mjs --root /tmp/i18-probe --scenario backflow-hold --keep`，随后读 `state.json` | `instance running`；`T-001 developer running round=2`；`T-002 tester **failed** round=1`；`HO-002 backflow **created**`；`done` 节点 0 个 | **F-01 / F-04 的现场取证** |
| 14 | 同上但 `MAESTRO_TEST_PAUSE=after_accepted:developer --scenario backflow` | driver 以 `paused:false`、`state:completed` 结束（该接缝在本机未构成暂停现场）；故改用 #13 的 `backflow-hold` | 说明取证路径 |
| 15 | `node bin/orch.js role show developer`（临时项目根） | 6 行（表头 + 职责/技能/工具/可唤醒/来源） | A-5 插入点与 D-12 六行红线成立 |
| 16 | `node bin/orch.js role validate --format json` | `assets 26 / roles 16 / skills 10` | D-12 计数成立 |
| 17 | `grep -R -n -E "worktree\|artifact_type.*dir\|merge.*order" src/core src/daemon` | 无命中 | AC-56 的能力面口径可行（建议替换锚点） |
| 18 | `git log origin/main --oneline -1` | `3f35bfa`（origin/main 与当前 HEAD 同点） | 回归对比基线 |

**观测不到的项（写清路径与原因）**：
- **真实 DSH 方言事实**（AC-25/AC-26 的 `{close,list,resume}`、无 `load`）：`which dsh` 无输出；`~/.dsh` 存在（`profiles/acp`、`profiles/desktop`、`.credentials.yaml`），`AppData/Local/Programs/DeepSeek Harness` 只有桌面 exe，没有 CLI。**无法在本机复核「0.2.2-rc.1 只广告 resume」这一事实**；按 BR-48/AC-25 的「无 DSH 判阻塞」处理，本评审不据此判 FAIL。
- **第三方 `dsh-acp-server` 0.14.4**：`which dsh-acp-server` 无输出，未安装；同样不据此判 FAIL。
- **`MAESTRO_TEST_PAUSE=after_accepted:developer` 的暂停点**：实跑未生效（#14）；`after_assign`、`checkpoint_write:fail`、`MAESTRO_TEST_SLOW_MS` 等 M-7 新接缝当前不存在（`src/core/orchestrator.js:3968~3973` 只认 3 种 kind），无法预演，属实现期事项。

**补充事实（并入建议，不单列编号）**：§3.3#8 与 AC-53 Given 的「992 条 / 987 通过 / 5 条噪声」与本次实跑的「992 / 988 / 4」差 1；噪声本身随机（EBUSY/EPERM），建议改为「本次实跑 992/988/4，门禁以失败集合差集为准」，不要写死通过数。
