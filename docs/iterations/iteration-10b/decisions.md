# I1.10b 主控裁决记录

> 触发：`review-round1.md` 总判 FAIL（10 阻断 / 21 项），其中 **F-02 / F-04** 与三项平台事实属「需求无法自证、必须由主控裁决」的范围，按 `docs/templates/execution-template.md` §2.8 留痕。
> 裁决日期：2026-11-15｜裁决人：主控 Agent｜效力：本迭代需求的定稿依据，实施方与评审方均以此为准。

---

## 裁决 A：一键跳转「打开 DSH 对应会话」的可达性与交付口径（对应 F-04）

**事实取证（本机实测，2026-11-15）**：DSH `0.2.2-rc.1`，安装目录 `%LOCALAPPDATA%\Programs\DeepSeek Harness`。

| 项 | 实测结果 | 取证方式 |
|---|---|---|
| 自定义协议注册 | 仅 `setAsDefaultProtocolClient("dsh")` 一处 | `grep -ao "setAsDefaultProtocolClient.\{0,60\}" resources/app.asar` |
| 可识别的深链 | 只有 `dsh://open`、`dsh://open/`、`dsh://host`、`dsh://cordis` | `grep -ao "dsh://[a-zA-Z0-9/_?=.&-]*" resources/app.asar \| sort -u` |
| 会话级深链 | **不存在**（无 `dsh://session/...` 一类形态） | 同上，符号集内无 session 段 |
| `--session-id` | 仅出现在 **headless runner** 文档串中（「resume a conversation」「Pass `--session-id <id>` to continue that conversation」），是**继续一次对话运行**，不是把 GUI 打开到该会话 | `grep -ao ".\{80\}--session-id.\{80\}" resources/app.asar` |

**裁决**：
1. 规划 871 行「一键跳转宿主会话：从角色节点跳转到 DSH 对应会话」与 874 行「一键跳转能打开 DSH 对应会话」，在 DSH `0.2.2-rc.1` 上**无法逐字达成**——宿主 GUI 只接受聚焦主窗口，没有"打开某个会话"的入口。属**规划不可达**，不是需求作者收窄，也不是实现方能力不足。
2. 本迭代交付口径定为三段，**必须逐字写进需求 §2.13 与 AC**，并在需求正文显式标注「属裁决 A 的偏离说明」：
   - ① 唤起宿主：未运行则启动，已运行则前置到前台；
   - ② 显示可核对的会话标识，并写入剪贴板，提示「在 DSH 中按标识定位」；
   - ③ 该标识与宿主会话落盘目录同名，构成双向核对（用户在 DSH 内可据此定位同一会话）。
3. **禁止**把「进程被拉起」写成「窗口已选中该会话」；需求任何位置不得出现「自动选中」「直达会话详情」一类承诺。
4. 若宿主后续版本提供会话级深链，作为**后续迭代增强**登记，不在 I1.10b 内承诺，也不因此阻塞本迭代。
5. 该 AC 的真实面判定照旧为 C 类：本机可构造则按实测取证；宿主不可用则判 `阻塞`，**不得**用夹具结果顶替。

---

## 裁决 B：窗口级自动判据的取舍（对应评审未决 U-04 / F-18）

**事实**：本机为 Windows，**无 Rust / MSVC / Windows SDK**，`cargo` 不存在 → Tauri 壳无法在本机构建，因此任何「双击图标 / 窗口内点击 / 托盘菜单」的自动判据在本机不可执行。

**裁决**：
1. 本迭代**不设窗口级自动判据**，界面行为一律在两条可执行面上判定：
   - **纯模块面**：`desktop/ui/**` 的纯函数模块 + `desktop/harness/*.mjs` 导出探针（沿用 I1.10a 的 dump 机制）；
   - **回环接口面**：`127.0.0.1` 只读 HTTP + SSE 帧（`src/daemon/http/**`）。
2. 真正只存在于窗口内的动作（唤起宿主、窗口前置、剪贴板）登记为**人工核验**，在验收报告中单列「人工核验项」，标注证据分级为 `人工核验`，不得计入自动判定通过数。
3. 跨平台构建产物存在性由 I1.10a 的 AC-38~44（GitHub CI Release）承担，本迭代**不重复取证、也不新增窗口级 AC**。

---

## 裁决 C：「跳转升级队列」的作用域（对应评审 §2 第 8 行解释分歧）

**裁决**：I1.10b 的「跳转」落在**单实例现场**，跨实例统一队列属 I1.11（`docs/index.md` 878~888）。
1. `human` 节点 → 跳到该人工任务的**节点详情**（只读，本迭代不做处置）。
2. `escalate` 节点 → 跳到**本实例的升级处理面板**，面板只暴露**唯一处置动作「继续」+ 取消**，走既有 `resolveEscalation` 的 `retry` 语义（与 `orch escalate resolve --decision retry` 同一条核心路径），不新增 RPC、不改状态机。
3. 重派 / 终止 / 审批允许拒绝 / 批量处置 / 通知 / 跨实例统一队列 → **明确归 I1.11**，本迭代 AC 要断言「面板上不存在除继续与取消之外的处置项」。
4. 前提不满足（实例未挂起等）时，界面原样呈现既有错误文案，不自造码。

---

## 裁决 D：未知节点状态的档位统一（对应 F-02）

**裁决**：历史数据里的未知节点状态，**看板列与卡片档一律落「被阻塞」并在该处标注「状态未知」**，与 I1.10a 已交付的 AC-35（`column === 'blocked'`）与 BR-30 保持一致。
不允许「看板被阻塞、卡片可调度」这种双口径——那会直接违反本迭代 BR-31 的「四处一致」。需求须按此统一改写 AC-10 与 §2.5/§2.8。

---

## 裁决 E：本轮修复的增删口径（对应 F-05）

**裁决**：按 `execution-template.md` §1.2「只能补不能减」执行。
- **允许**：补 AC（F-05 要求的异常/边界 AC、F-18 的 NF 落点）、补 BR、修逐字基线自洽性、修架构检查命令、修 Given 可构造性、修订不动判定强度的措辞。
- **禁止**：删 AC、合并 AC、放宽 `Then`、把规划条目挪到范围外、把裁决 A 的偏离写成"规划本来如此"。
- 每条 AC 必须保持「场景类型 / 风险 / 引用」三件套与可执行判定锚点；新增 AC 接续编号（AC-37 起），不得重排既有编号。

---

## 裁决 G：回归基线的判定口径（对应 F2-01 / F2-02，收敛 F-18）

**事实**：同一分支同一 HEAD（`66e5a6b`）、同一命令（`node --test "test/**/*.test.js"`）在本机复跑三次，结果分别为
`1425/1395/21/9`、`1425/1401/15/9`、`1425/1402/14/9`——**条数稳定（1425），失败条数与成员不稳定**。
失败成员在 SSE 时序、脉冲、`EBUSY` 清理、符号链接等平台/并发敏感用例之间翻转。

**裁决**：本迭代的回归判定**不比绝对失败条数**，改为可复核的三段式：

1. **条数只增不减**：全量 `tests` 总数不低于基线 **1425**；
2. **失败集合按差集判**：允许的失败集合 = `docs/iterations/iteration-10a/baseline-failures-win32.txt` 登记的 Windows 平台噪声
   ∪ 本迭代**实跑观测到并可复核为 flake 的**用例（必须附「文件级隔离复跑通过」的原始帧）；
   差集（新增失败）= 0 才算通过。**禁止**把「21 条」「15 条」这类单次数字写成硬判据，也**禁止**在需求里对失败原因做未经证实的归因。
3. **flake 判定必须留证**：新增红一律先 `--test-concurrency=1` 单文件独占复跑；确认通过记 flake（留帧），确认失败照旧判红。
   **禁止**用 `--no-flake-confirm` 一类开关一把关掉。

**对需求的约束**：§3.3 只写「取数时间 + 口径 + 观测到的失败集合与翻转事实 + 判定公式」，不写单一数字结论；
AC 里不得要求「36 个文件每个 `# fail 0`」这类在本机不可达的绝对断言，改为「差集 = 0 + 点名允许的基线噪声文件」。

---

## 裁决 H：判据必须落在真实投影与真实接缝上（对应 F3-01~F3-05 及评审 §⑥）

**事实（本机实读代码，2026-11-15）**：

| 事实 | 取证 |
|---|---|
| 角色投影 `buildRoleInstances` 只产出这些字段：`roleId`、`roleInstanceId`、`status`、`statusReason`、`activeSessions[]`、`servingNodes[]`、`hostIcons[]`、`maxConcurrentSessions`、`lastAction{nodeId,round,maxRounds,state,stateSince}` | `src/registry/role-instances.js:123-202` |
| `hostIcons` 只来自**服务中节点的会话**（`hostIconsOf(serving, sessions)`） | 同上 `:72-86` |
| 测试接缝 `POST /__test__/graph/pulse` 只作用于**图投影的内存 overlay**，不进磁盘、不新增事件类型 | `src/daemon/http/server.js:351,451`、`src/daemon/http/stream.js:206-211,544` |
| `desktop/harness/collect.mjs` 只做采集，**不产图**；产图的是 `graph-dump.mjs` | `desktop/harness/*.mjs` |

**裁决**：

1. **状态栏取数不得超出既有投影字段**。「0 会话却有宿主」不可产出（`hostIcons` 只随服务中节点的会话出现），附录 A-1 这类行必须按真实可得字段重写（无宿主时显示 `宿主 —`）；「服务节点」「活跃会话数」「最近动作」逐项对应 `servingNodes` / `activeSessions.length` / `lastAction`。
2. **下钻投影必须与图投影共用同一 overlay 来源**：下钻数据从「同一实例快照 + 同一 pulse overlay」派生，**禁止**为下钻另建推送通道或新增事件类型（与 U-13 一致）。这样 `POST /__test__/graph/pulse` 天然覆盖下钻视图的变化，F3-02 不再是缺口。
3. **锚点分两类，必须标注**：
   - **现状事实锚点**：命令在当前仓库上真跑通过（如 `grep` 计数、既有 dump 导出）；
   - **契约事实锚点**：指向本迭代**将新建**的接缝，必须同时给出「文件路径 + 导出签名 + 同类既有实现作依据」，并在附录 D 登记。只有前者可直接当架构检查；后者须写成 `契约：<path>::<export>` 形式，S2 落地后由验收复核。
4. **夹具脚本只能用真实存在的**：产图用 `desktop/harness/graph-dump.mjs`，看板用 `board-dump.mjs`，布局用 `layout-dump.mjs`，`collect.mjs` 只能用于采集类断言。
5. **滚动/时序类判据分层**：用户可见 Then 只写「能滚到第 N 行、行内容正确、无空白行」；`≤200ms`、`anchorRowTop ≤ 1px` 这类只能在注入时钟 + 模型坐标下测得的指标，**必须标注为内部断言**并放进「机检（内部断言）」，不得冒充用户可见结论。
6. **不可由产品路径构造的现场，改用既有接缝并写明契约**：如「运行中 + 待处理升级」，若 `test.escalate` 实际产出的是 `suspended`，Given 就按 `suspended` 写，**禁止**虚构 `running` 与升级并存。

---

## 裁决 J：批次 3 两处逐字偏差的修法（2026-11-16）

**事实（批次 3 两位实现 Agent 回报 + 主控实读代码复核）**：

1. `AC-25` 机检原文要求 `button.label` 含 `expected.id`；但 WP-3 `desktop/ui/drill/host-jump.js::sessionTag` 的 `text.slice(sep + 3, at)` 在 `DRILL_HOST_OPENED = '已打开 DeepSeek Harness · 会话 {id}'` 上只取到 `会话 `、**丢掉 `{id}` 占位符**，实测 `button.label === '打开宿主会话 · 会话 '`。WP-5 因此把该断言降级为 `button.sessionId` + toast 含 id——**属放宽既有 Then 的机检，不予接受**。
2. `AC-23` Then 为 `升级 ESC-001 已处理 · 状态 已处理`，模板 `DRILL_ESC_ALREADY = '升级 {id} 已处理 · 状态 {state}'` 已冻结在 daemon 文案表（63 键）；WP-4 `app.js:369` 用 `noticeText('ESCALATION_LABEL_RESOLVED', {})` 取 `{state}`，但该键**不在下发键表里**，生产路径会得到空串，测试靠从 CLI 表注入该键才通过——**属人工补足缺失依赖，不予接受**。

**裁决**：

1. **J-1（button.label）**：修 WP-3 `sessionTag`——把 `text.slice(sep + 3, at)` 改为包含占位符的 `text.slice(sep + 3)` 再 `fillTemplate(part, { id })`，使 `button.label` 逐字成为 `打开宿主会话 · 会话 <id>`；WP-5 恢复 `button.label` 含 `expected.id` 的机检断言，与 `button.sessionId` / toast 双重同源。**不新增文案键、不改 AC-25 Then**。
2. **J-2（升级状态词）**：**不新增文案键**（63 键冻结、两处 `147 + 63` 精确断言保持）。由 WP-2 daemon 的 `continue` 响应**新增结构化字段** `stateLabel`，值取既有 `src/cli/labels.js::ESCALATION_LABEL.resolved`（中文唯一来源不变）；WP-4 `app.js` 用 `result.stateLabel` 填 `DRILL_ESC_ALREADY` 的 `{state}`，删除对不存在键 `ESCALATION_LABEL_RESOLVED` 的依赖，测试不再从 CLI 表注入该键。**AC-23 Then 逐字不变**，`drill-fixtures.test.js` 的 `message` 逐字断言（COMMAND_ERROR 原文）也不变。
3. **J-3（C1 待验事实已实测）**：WP-5 `--check session-dir` 本机实测 `total: 8, compared: 8, dirEqualsInternalIdCount: 8, c1: 一致`；按裁决 I 在附录 D-14 表 C1 **补注「已实测一致」**，**不回填为 AC 判据、不改 AC 强度**。
4. 三处修复均属**实现缺陷回改**，走批次 3 修复与复评流程；不许借机改需求 AC / BR / Then、不许增删文案键。

---

## 裁决 I：会话标识的核对方式（对应评审 round3 §⑥-1）

**事实**：ACP `session/new` 返回的 `sessionId` 与宿主落盘目录 `~/.dsh/sessions/<工作区>/<目录名>/` 是否同一个 ID 空间，**本迭代尚未实测**（此前只核过两者"形态"都存在）。

**裁决**：

1. 需求**不得**把「与宿主会话目录同名」写成 Then 或机检断言——未经实测的事实不能当判据。
2. 第 ③ 段改为可判定的：**界面显示并在剪贴板写入的标识，等于该节点会话在实例状态里的 `sessionId`**（可从 `state.sessions[].sessionId` 直接比对，可机检）。
3. 「用户在 DSH 内按该标识定位」只作为**提示文案**，不作为断言。
4. 「目录同名」降级为附录 D 的**待验事实**：S2 开工首日实测一次，一致则补注「已验证：目录名 = sessionId」，不一致则删掉该说法，**均不改 AC 判定强度**。

---

## 裁决 F：架构检查与判定锚点的可执行性（对应 F-01 / F-07 / F-15）

**裁决**：架构检查命令必须在**当前仓库**上真跑为真，且多条锚点之间不得互斥。
1. 断言「某函数在既有文件里恰好 N 处」这类计数，必须**先实点当前真实条数**再写断言（`createViewState` 当前为 2 处，不是 1 处）。
2. 判定「drill 层不得自算」时，锚点应指向**被禁的语义**（如 `decideStatus` / `statusReason`），不得指向中文词表常量名；否则会与"drill 必须按名取词"的另一条锚点互斥。
3. 任何 `--forbid` 词表必须写全量字面（31 词），不写"同一词表"。
