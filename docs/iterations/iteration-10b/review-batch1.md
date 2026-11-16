# I1.10b 实现评审报告 · 批次 1（WP-1 / WP-2）

> 评审对象：`feat/i1.10b-drilldown` 分支、基线 `c0e46aa` 之后 WP-1（3 文件）/ WP-2（5 文件）的未提交改动
> 评审 Agent：实现评审 Agent（批次 1，干净上下文，只读；本报告为唯一可写产物）
> 评审日期：2026-11-16
> 判据：`requirement.md` v5（A-10 逐字表 / D-1 / D-3 / D-9~D-11 / 附录 D 表 A2、A4）、`iteration-10b.md`（§2.1/§2.2、§2.5、§3.3~§3.7、§4 WP-1/WP-2、§7 风险 1、检查点 1）、`decisions.md`（裁决 H / F）、`split-review-round2.md`（PASS 轮三注意事项）、上游代码实读（`role-instances.js` / `stream.js` / `escalation.js` / `labels.js@c0e46aa`）
> 原则：自己实跑核，不采信 Agent 自述；每条结论带行号；阻断只判越界/授权段外/文案非逐字/签名形状不符/只读性破坏/测试弱化/判定强度下降/静态门禁红，文风组织问题一律建议。

---

## §0 总判

**总判：FAIL（阻断 1 / 建议 5）。**

- 阻断仅 1 条：**B1-01**——`POST .../continue` 的错误响应 `message` 字段由 `server.js:424-433` 用 `ERROR_TEMPLATE` 查表，而 `ESCALATION_NOT_PENDING` / `INSTANCE_NOT_SUSPENDED` 两个码只定义在 `COMMAND_ERROR`（`src/cli/labels.js:336/339`），落入 UNKNOWN_ERROR 兜底；实跑 HTTP 得到 `"message":"未知错误：ESCALATION_NOT_PENDING"`，不符 §3.6 (`iteration-10b.md:322`) 的逐字响应体，也非 D-3 (`requirement.md:1521`) 要求的「既有错误原文」。属「文案非逐字 / 响应形状不符」的阻断，不涉只读性、文件边界、静态门禁，其余全部 PASS。
- WP-1（文案键底座）与 WP-2（只读投影 + 7 端点 + 宿主适配器）的**主体实现正确**：63 键逐字齐全、147 键零改动、五投影签名与响应形状对齐、A2 第二调用点正确、只读性成立、门禁全绿、两个测试文件全绿。
- 文件边界：WP-1 仅动 3 文件、WP-2 仅动 5 文件，`routes.js` / `server.js` / `labels-desktop.test.js` 的**敏感既有逻辑（既有 3 条路由、`buildGraphSnapshot`、`matchPattern`、鉴权、静态资源、pulse、window-probe、既有 147 键值）零改动**；新增 helper/import 落在授权段之外但属新路由的必要装配，不触冻结逻辑，记建议 S-01 待主控裁定口径（详见 §1）。
- 重点判定：`test.escalate` → 产品路径自然升级**等价且判定强度不降**（§4.4）；continue 第二次 `ESCALATION_NOT_PENDING` 确来自核心守卫、非测试桩（§重点核查 3）。

**实跑命令清单（全量输出见 §7）**：`git status/diff --stat`、3 个 `git diff`、`grep` 静态门禁 5 组、purity 31 词、`node --test` 三文件、2 个实证小实验（核心守卫二次调用 / continue 第二次 HTTP 响应体）。

---

## §1 文件边界与授权段核查（维度 A：PASS）

### 1.1 文件边界
`git status --short` + `git diff --stat` 实读（WP-1/WP-2 负责文件清单来自 `iteration-10b.md:347/355`）：

| WP | 负责文件 | 实点 | 越界 |
|---|---|---|---|
| WP-1 | `src/daemon/http/labels.js`(M)、`test/wp13/labels-desktop.test.js`(M)、`test/wp14/labels-drill.test.js`(??) | 3/3 | 无 |
| WP-2 | `src/daemon/drill.js`(??)、`src/adapter/host-open.js`(??)、`src/daemon/http/routes.js`(M)、`src/daemon/http/server.js`(M)、`test/wp14/drill-fixtures.test.js`(??) | 5/5 | 无 |

工作区另有 `.workbuddy/memory/*`、`docs/iterations/iteration-4/evidence/*.json` 改动，**不属 WP-1/WP-2 产物、不在本次评审路径内**，不计越界，提请主控确认来源（建议 S-05）。

### 1.2 符号锚点（行号漂移已按符号复核）
- `routes.js`：既有 3 条路由 `method GET /instances` / `POST /instances` / `GET /workflows` handler（`routes.js:558-577`）与基线逐字一致、未被改写；5 条新 GET 追加在 `return [...]` 数组尾部（`:582/:589/:596/:603/:610`）。
- `server.js`：`claimedByHandler`（`:363`）与分派段 `handleRequest`（`:527`）内**仅追加分支**（白名单 `:372-376`、分派 `:618-631`）；`buildGraphSnapshot` 内 `hub.applyTestOverlay(graphPayload, instanceId)` 由基线 `:318` 漂移到 `:341`（上移插入导致），函数体未改；`/ui/labels`、pulse、window-probe、鉴权、静态资源段未改（diff 核实）。
- `labels-desktop.test.js`：`EXPECTED_DESKTOP_KEYS`（`:124`）、`EXPECTED_DESKTOP_VALUES`（`:194`）、`EXPECTED_DESKTOP_PLACEHOLDERS`（`:331`）三表追加，`147` 断言（`:505`）改 `210`（147+63）；既有 147 键名/值逐字未动（见 §2.3）。第四处 `PLACEHOLDERS` 追加是本文件既有断言 `labels-desktop.test.js:538-542`「占位符期望表必须覆盖全部新增键」的机械必要同步，非放宽。
- 新增 helper/import 落在授权段之外（`server.js:50-64/223-233/424-527`、`routes.js:26-40/54-60/218-240/333-560`）：属新端点的装配与新代码，**未修改任何既有被冻结函数**，与 `iteration-10b.md:150` 明示的「hub 经 server.js 注入 / S-02 惰性接缝」机制一致。按文风/组织问题记建议 S-01，**不判越界阻断**；若主控对 D-10 作最严格字面解释，请裁定是否升级。

---

## §2 文案逐字核查（维度 B：PASS）

### 2.1 A-10 键数 / 分组
`grep -cE "^  DRILL_[A-Z_]+:" src/daemon/http/labels.js` = **63**。`labels-drill.test.js:47-111` 内嵌 63 键冻结基线、`labels.js:113-202` 逐条对应；分组实点：面包屑 3 / 角色栏 4 / DAG 5 / 卡片 7 / 指示器 3 / 详情 6 / 连接线 4 / 升级 11 / 宿主 7 / 视图 4 / 降级 8 / token 映射 1 = 63（与 A-10 `requirement.md:1312-1325` 逐行对齐）。三文件（labels.js / labels-desktop.test.js:124-195 / labels-drill.test.js:47-111）键名集合经实跑 `deepEqual` 一致。

### 2.2 逐字值对照（A-1~A-9 基线）
`labels-drill.test.js:114-180` 的 63 值与 `labels.js:113-202` 逐条相等（测试 `labels-drill.test.js:317-321` 实跑 PASS）。针对 A-10 逐字要求的关键项逐条核对：
- 角色状态栏 `DRILL_ROLE_BAR` = `角色栏 {role} · {status} · {sessions} 个活跃会话 · 服务 {serving} · 宿主 {hosts} · 最近 {last}`（A-1 第 1083 行）✓；`_LAST_ACTION` / `_LAST_ACTION_MISSING`（`:121/122`）= `最近 {node} · 轮次 {round}/{maxRounds} · {state}` / `最近 —` ✓。
- 升级面板 `DRILL_ESC_ALREADY` = `升级 {id} 已处理 · 状态 {state}`（`labels.js:184`）、`DRILL_ESC_NOT_SUSPENDED` = `实例 未挂起 · 无法继续`（`:185`）——与 §3.6 (`iteration-10b.md:322-323`) 的 messageKey 对应文案、WP-2 映射（见 §3.3）字面一致 ✓。
- `DRILL_ROLE_STATUS_TOKEN`（`labels.js:200-201`）= `{"available":"可用","serving":"服务中","cooldown":"冷却中","unavailable":"不可用","inactive":"未参与"}`，五 token 齐全、与 `ROLE_INSTANCE_STATUS_LABEL` 同值（测试 `labels-drill.test.js:323-333` 实跑 PASS，含 `serving→busy` 成员映射）✓。
- 降级提示 `DRILL_EMPTY_RECORD`（`交接 无`）与详情段 `DRILL_DETAIL_NONE`（`{section} 无记录`）按 A-9 `requirement.md:1306` 两语境分列 ✓。

### 2.3 既有 147 键零改动
`labels-drill.test.js:204-271` 内嵌 64 个桌面新增键冻结值、`:274-285` 内嵌 83 个复用键成员清单，测试 `:339-359` 实跑 PASS（键名与值逐字不变，平铺总数 83）。`git diff labels.js` 显示既有段（`:109` 之前）仅把 `DESKTOP_DEF_UNREADABLE` 行尾补逗号后追加新键，既有键一行未删改。`labels-desktop.test.js:505` 计数由 147 改 210（+63），注释 `新增 64 + 63 + 复用 83` 算术正确。**无放宽既有断言**。

**维度 B 判定：PASS**（A-10 全表逐字齐全、147 键零改动）。

---

## §3 五投影与 7 端点核查（维度 C / D：PASS，但 D 含 B1-01 阻断）

### 3.1 五投影导出签名（§2.1 vs §2.2）
`drill.js` 五导出实点：

| 导出 | 签名（行号） | §2.1 契约（`iteration-10b.md:142-146`） | 一致 |
|---|---|---|---|
| `buildDrill` | `drill.js:249` `({state, workflowDef, roleId, roles, graph, now})` | `({state, workflowDef, roles, graph, now})` | 一致（`roleId` 为 D-3 路径参数，routes.js:584 传入） |
| `buildNodeDetail` | `drill.js:449` `({state, workflowDef, events, handoffs, nodeId, workspace, cwd})`，async | 同（签名逐字） | ✓ |
| `buildConnectionPanel` | `drill.js:561` `({state, workflowDef, handoffs, edgeId, graph})` | 同 | ✓ |
| `buildEscalationList` | `drill.js:610` `({state})` | 同 | ✓ |
| `buildSubflowGraph` | `drill.js:652` `({workflowDef, ref, visited, state})` | `({workflowDef, ref, visited})` | 一致（`state` 为只读状态源，D-2 子工作流节点状态所需） |

状态栏只取 `buildRoleInstances` 9 字段（裁决 H）：`drill.js:257-275` 的 `roleBar` 由 `buildRoleInstances(...)` 的 `roleView` 取 `statusReason / activeSessions / servingNodes / hostIcons / lastAction / maxConcurrentSessions`，`statusToken` 取图投影角色节点 `node.status`（`:268`），未重算状态、未引入 9 字段外字段。异常态落点：未知状态 `mystery`→`blocked`+`unknownStatus`（`:396-399`、测试 `:375-377`）、升级挂起 `buildEscalationList` 只取 pending（`:618-620`）、0 会话 `hostIcons:[]` 与 `activeSessions:0` 同源（`role-instances.js:72-86/192`，测试 `:351-354`）。卡位 8 档 `CARD_TIERS`（`drill.js:33-42`）= `escalated,failed,running,review,assigned,ready,blocked,done`，逐字对齐 F4-01（`requirement.md:1457`）。

### 3.2 5 GET 响应形状（§3.3~§3.6）
`drill-fixtures.test.js:325-451` 实跑 9/9 通过，5 条 GET 形状断言齐全：drill（`:338-378`，breadcrumb/roleBar/dag/cards）、nodes（`:380-405`，node/timeline/summary/evidence/handoffs 四段全空态保留）、connections（`:407-426`，edge/handoffs/timeline，行数恒等包数）、escalations（`:428-431`，只列 pending）、subworkflow（`:433-442`，nodes/edges/workflow）。**契约 A2 第二调用点**：`routes.js:455-456` `hub.applyTestOverlay(graphPayload, instanceId)`（签名 `stream.js:255` 的 `applyTestOverlay(graph, instanceId)` 逐字；既有唯一调用 `server.js:341`），只调用不改 overlay 语义；测试 `:328-346` 证 pulse `serving` 覆盖下钻 `statusToken`、`:423-426` 证 overlay 只翻聚合词不改 handoff 行——**复用成立、无新通道**。drill 路由调 overlay 后再 `buildDrill`（`routes.js:455→458`），connection 路由同理传 overlay 后 graph（`:484`），顺序正确。

### 3.3 2 POST
- **continue**（`server.js:443-472`）：转发 `orchestrator.resolveEscalation({instanceId, escalationId, decision:'retry'})`（`:446`，决策 C / D-3 同核心路径），不直接改状态（静态门禁 G2 零命中）。成功 `{ok:true, escalationId}`（`:451-453`）；失败映射 `{ok:false, code, messageKey, message}`（`:459-467`），`ESC_MESSAGE_KEYS`（`:60-63`）= `ESCALATION_NOT_PENDING→DRILL_ESC_ALREADY`、`INSTANCE_NOT_SUSPENDED→DRILL_ESC_NOT_SUSPENDED`，与 A-10/WP-2 映射逐字一致；`code` 只留 daemon、`messageKey` 给界面，符合 D-3/ AC-23 架构检查。**唯 `message` 字段取值错误，见 B1-01。**
- **/hosts/open**（`server.js:490-524`）：body `{instanceId, sessionId}`，从实例状态 `sessions[].hostId` 取宿主（无宿主名字面分支），调 `openHost`；参数错误 400 / payload 413 / host 缺失 404；结果原样 `sendJson`。测试 `drill-fixtures.test.js:520-529` 对 mock 宿主返回 `{ok:false, code:'HOST_UNSUPPORTED', message:'宿主 mock 不支持跳转'}` 深等通过，形状符合 §3.7 (`iteration-10b.md:332`)。

---

## §4 宿主适配器 / 夹具与实验核查（维度 E / F：PASS）

### 4.1 宿主适配器（维度 E：PASS）
`host-open.js:110-139` `openHost` 配置驱动：解析顺序 `<root>/.orch/hosts/<hostId>.json` 的 `open:{command,args}`（`:34/:75-93`）→ 缺 open 段 `HOST_UNSUPPORTED`→ 文件不存在复用 `resolveDshLaunch`（`:19/:88`，只 import 不改）；`grep -REn "hosts/"` 命中 3 条（`:3/:34` 等，≥1）；500ms 去重（`:21/24/121/137`，测试 `:531-564` 探针计数证实窗口内仅 1 次 spawn）；`spawn(detached:true, stdio:'ignore')` 不等待不轮询（`:155-175`）；`HOST_UNSUPPORTED` / `DSH_SPAWN_FAILED:未找到 DeepSeek Harness` / `跳转失败 · 原因` 三形状齐（`:49-68`）；daemon/drill/routes 零 `dsh` 字面（门禁 G4）。**没有真实宿主调用**：场景 B 的 `dsh` 宿主配置指向仓库内 mock（`drill-fixtures.test.js:293` `mockHostConfig()` launch=process.execPath+MOCK），场景 A 用 mock / opener（`:274-280`，opener 仅写探针文件）。

### 4.2 夹具构造纪律（PASS）
`drill-fixtures.test.js:48-51` 声明纪律，实现逐条落地：独立 `%TEMP%` 根 `tmpRoot('maestro-i10b-')`（`:80-82/:264/:289`）；`envFor()` 注入 `NODE_ENV=test` 并清除 DSH 环境键（`:98-104`）；先起核再写盘——`getSceneA` 起核后 `GET /instances` 为 0（`:266-272`）、`desktop.json` birthtime ≤ `state.json` birthtime（`:313-323`）；落盘一律 `fs.writeFileSync`，不硬编码 bash（`:250-255`）；快照 `schemaVersion:2`（`:186`）。

### 4.3 四组最小契约断言（PASS）
`drill-fixtures.test.js`：① 5 GET 形状（`:325-451`）；② 连发两次 continue 第二次 `code==='ESCALATION_NOT_PENDING'`（`:588-607`）；③ `/hosts/open` 对 mock 返回 `HOST_UNSUPPORTED`（`:520-529`）；④ 五投影导出各 ≥1（`:453-518`）。检查点 1（`iteration-10b.md:524`）要求的 7 端点行为验证逐项覆盖。

### 4.4 F5-01 实验与 `test.escalate` 等价性判定（重点判定：PASS）
- **实验真实性与回改路径**：`drill-fixtures.test.js:18-45` 头部记录 F5-01 完整现象（外部替换运行中实例 `state.json`：rev=9999→核心后续写盘 rev=10010、probe 字段被抹；CAS 冲突按磁盘 prevRev 重读续写最终覆盖外部写入）与结论（竞态成立）。回改路径 `:35-41` 落地：场景 A 静态投影实例「先起核再写盘」且核心绝不驱动（`:37-38`，与 §3.3 铁序一致）；一切行为场景走产品路径 / 既有接缝（自然升级=AC-22 口径、CLI escalate resolve=B3），不替换运行中实例 state（`:38-41`）。现象与回改均真实、可追溯。
- **`test.escalate` → 「产品路径自然升级」等价性（AC-23 Given）**：**等价，判定强度不降，PASS**。理由：
  1. AC-23 Given ①（`requirement.md:667`）的现场是「节点 escalated + 会话 escalated/quarantined + 实例 suspended + 1 条 pending ESC-001」，且要求「真实产出、不手写 state」。产品路径自然升级（快速 mock 首派交接包证据不可读→`handoff_invalid`→suspended，`:154-162/:568-586`）由核心 `escalateState`/`commitEscalation` 真实产出同一现场，与 `test.escalate→escalateOnce`（`src/daemon/server.js:344-352`→`orchestrator.js:4465`）走的是同一核心升级写路径，产出结构同源。
  2. AC-22 Given 夹具（`requirement.md:660`）已明确「`T-002` 连续失败自然升级，是产品可达路径；可用退路才是 `test.escalate`」——本实现选主路径，与需求口径一致，非弱化。
  3. 「已处理现场」由既有 CLI `escalate resolve`（B3 接缝，`drill-fixtures.test.js:609-634`）真实产出，与原 Given ② 处置步骤逐字同口径；「真实守卫端到端复核」（连发两次→ESCALATION_NOT_PENDING，`:588-607`）保留且更强（真守卫、非桩，见重点核查 3）。
  4. 替代动因有实证支撑（`drill-fixtures.test.js:42-45`）：`test.escalate` 只写盘（store CAS）、活跃 run 的下一次 saveLive 覆盖、CLI 的 `instance.get` 对活跃 run 返回内存态（`orchestrator.js:4206-4219`）看不见它——在活跃实例上用 `test.escalate` 造现场不可行，与 F5-01 结论一致（详见重点核查 2）。
  5. 未出现「为过测试改需求/拆分」痕迹；AC-22/23 判定强度由 WP-4 的 `escalation-continue.test.js` 承担（批次 3），本文件仅提供包内最小契约面，主责归属未偷改（§8.2 第 14 条）。

**维度 E：PASS；维度 F：PASS**（含重点判定等价）。

---

## §5 静态门禁与测试实跑表（维度 G：PASS）

| # | 命令 / 项 | 期望 | 实跑 | 结论 |
|---|---|---|---|---|
| 1 | `grep -REn "saveState\|appendSpan\|emit\(\|Date[.]now" src/daemon/drill.js` | 零命中 exit 1 | 零命中 exit 1 | PASS |
| 2 | `grep -REn "state = 'running'\|node\.state = " src/daemon/http/` | 零命中 exit 1 | 零命中 exit 1 | PASS |
| 3 | `grep -REn "saveState\|appendSpan\|emit\(\|Date[.]now\|new EventEmitter" src/daemon/drill.js`（§2.1 全量） | 零命中 exit 1 | 零命中 exit 1 | PASS |
| 4 | `grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js` | 零命中 exit 1 | 零命中 exit 1 | PASS |
| 5 | `grep -REn "hosts/" src/adapter/host-open.js \| wc -l` | ≥1 | 3 | PASS |
| 6 | `node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31 词>` | exit 0 | OK 扫描 31 文件零命中 exit 0 | PASS |
| 7 | `NODE_ENV=test node --test test/wp14/labels-drill.test.js` | 全绿 | tests 8 / pass 8 / fail 0 | PASS |
| 8 | `NODE_ENV=test node --test test/wp13/labels-desktop.test.js` | 全绿 | tests 25 / pass 25 / fail 0 | PASS |
| 9 | `NODE_ENV=test node --test test/wp14/drill-fixtures.test.js` | 全绿 | tests 9 / pass 9 / fail 0 | PASS |

静态门禁无红、测试全绿。**维度 G：PASS。**

---

## §6 修复清单

### B1 阻断清单

**B1-01 · continue 错误响应 `message` 查错表，返回兜底文案，不符 §3.6 逐字响应体与 D-3「既有错误原文」**
- **位置**：`src/daemon/http/server.js:424-433`（`escalationErrorText` 用 `ERROR_TEMPLATE` 查表），`:51`（`import { ERROR_TEMPLATE }`），`:466`（`message: escalationErrorText(...)`）。
- **原文**：
  ```
  424  function escalationErrorText(code, params = {}) {
  425    const known = typeof code === 'string'
  426      && Object.prototype.hasOwnProperty.call(ERROR_TEMPLATE, code);
  427    const template = known ? ERROR_TEMPLATE[code] : ERROR_TEMPLATE.UNKNOWN_ERROR;
  ...
  466      message: escalationErrorText(code, result?.params ?? {}),
  ```
- **违反条款**：§3.6 (`iteration-10b.md:322`) 响应体逐字 `message: "升级 ESC-001 已处理 · 状态 已处理"` / `"实例 未挂起 · 无法继续"`；D-3 (`requirement.md:1521`) `message` 为「既有错误原文」；AC-23 架构口径「界面不翻译不自造」。
- **实证**：`ESCALATION_NOT_PENDING` / `INSTANCE_NOT_SUSPENDED` 不在 `ERROR_TEMPLATE`，只在 `COMMAND_ERROR`（`src/cli/labels.js:334-339`）；实跑 HTTP（`/tmp` 只读实验）第二次 continue 响应为 `{"ok":false,"code":"ESCALATION_NOT_PENDING","messageKey":"DRILL_ESC_ALREADY","message":"未知错误：ESCALATION_NOT_PENDING"}`。`message` 把原始错误码透到用户可见文本，违背语义。
- **严重度**：阻断（文案非逐字 / 响应形状不符）。不影响只读性、文件边界、门禁。
- **建议修法**：对这两个码改用 `COMMAND_ERROR`（`src/cli/labels.js`）查表并填 `id`/`state` 参数，或按 §3.6 逐字值（UI 按 `messageKey` 分支的稳定文案）产出 `message`；保持 `code` 只留 daemon、`messageKey` 给界面的分层。现有测试 `drill-fixtures.test.js:606` 仅断言 `message` 非空，建议同步补一条逐字断言防回归。

（无其他阻断。）

### 建议清单（均非阻断）

| # | 位置 | 问题 | 建议 | 严重度 |
|---|---|---|---|---|
| S-01 | `server.js:50-64/223-233/424-527`、`routes.js:26-40/54-60/218-240/333-560` | 新增 import / helper / 工厂参数落在 D-10 点名的行段之外（未触冻结逻辑，与拆分 §1.1 hub 注入机制一致） | 主控裁定 D-10 口径：若按最严格字面解释需迁移装配代码；若按「不改既有被冻结函数」解释则维持 | 建议 |
| S-02 | `drill.js:249` `buildDrill({..., roleId, ...})`、`:652` `buildSubflowGraph({..., state})` | 两导出较 §2.1 冻结签名各多一个入参（`roleId`/`state`，均为路由必传的只读输入） | 在 D-14 表 D 的签名登记补注，供批次 2/3 下游按实际签名消费，避免被当成契约漂移 | 建议 |
| S-03 | §3.3 样例 `breadcrumb` 为字符串（`iteration-10b.md:254`）vs 实现 `drill.js:277-282` 返回 `{key, instanceId, roleId, roleTitle}` | daemon 按 A-10 职责划分下发「键+结构化数据」、拼行在渲染层，形状与样例字符串不同（语义正确） | 移交 WP-3 时明确 `role-bar.js`/index 按键拼行，不期望 daemon 下发整句 | 建议 |
| S-04 | `drill-fixtures.test.js:638-654` 收尾 test 仅 `assert.ok(true)`（`:653`） | 该 test 主体是清理（停核+删临时根），唯一断言恒真 | 属清理脚手架、非判定测试，不记「测试弱化」；可 unnamed 或改 `assert.doesNotThrow` 风格以免误读 | 建议 |
| S-05 | 工作区 `.workbuddy/memory/*`、`docs/iterations/iteration-4/evidence/*.json` 改动 | 非 WP-1/WP-2 产物、不在评审路径内 | 主控确认来源，评审不计入批次 1 文件边界 | 建议 |

---

## §7 三个重点独立核查结论

**核查 1 · `drill.js` 只读性（无状态迁移 / 无写盘 / 无 emit / 无 Date.now，A2 调用点只在 routes.js）**
- 实跑门禁 1/3 零命中（§5）；`drill.js` 仅 `import fs/promises` 做只读 `fs.stat`（`:200-222` 证据存在性），无 saveState / 无 state 赋值 / 无 EventEmitter。
- `applyTestOverlay` 全仓调用点：`server.js:341`（既有唯一）、`routes.js:456`（新增第二调用点）；`drill.js` 零引用。`drill.js:17-20` 注释明确 statusToken 取调用方已过 overlay 的 graph。
- **结论：只读性成立，A2 调用点位置与 semantics 符合契约。**

**核查 2 · `test.escalate` 在活跃实例上不可用的实验结论与 server.js:344-352 + core 写路径一致**
- 说明：任务书写的 `src/daemon/http/server.js:345-352` 应为 `src/daemon/server.js:344-352`（需求原文 `requirement.md:667` 为 `src/daemon/server.js:345-352`）；http/server.js:345-352 是 `safeUrl`，非 test 接缝。以实际接缝为准。
- 代码路径一致：`test.escalate→escalateOnce`（`server.js:344-352`→`orchestrator.js:4465-4515`）`store.load`+`saveState`（`escalateState→commitEscalation`，`orchestrator.js:1961` 起）只写盘；活跃 run 的 `saveLive`（`orchestrator.js:763-777`）以内存 `ctx.state` CAS 写盘、冲突时按磁盘 prevRev 续写后仍写内存态；`getStatus`（`orchestrator.js:4206-4219`）对活跃 run 返回 `snapshotOf(liveState ?? loaded.state)`，忽略磁盘。故 test.escalate 的盘写会被下一次 saveLive 覆盖、且 instance.get 看不见它。
- 实证补充（`/tmp` 只读实验，未改产品代码）：桌面 daemon 模式无 IPC socket 故未直接发 test.escalate RPC，但观察到活跃 run 持续推进时 `state.json` rev 由 7→14、外部 probe 字段被抹、escalations 由 1→2，印证「外部写被内存态覆盖」。
- **结论：头部实验结论与真实写路径一致，回改用产品路径自然升级成立，判定强度不降。**

**核查 3 · continue 第二次调用错误是否真来自核心守卫（非测试桩）**
- 代码路径：`server.js:443-472` 的 continue handler 直接 `await orchestrator.resolveEscalation({..., decision:'retry'})`（`:446`），无 mock/stub 注入；第二次调用进入核心 `orchestrator.js:5022` 的 `entry.state !== 'pending'` 守卫（`:5047-5049`）返回 `{ok:false, code:'ESCALATION_NOT_PENDING'}`；daemon 映射为 `messageKey:'DRILL_ESC_ALREADY'`、HTTP 409（`server.js:459-465`）。
- 实证 1（纯模块实验）：`applyResolution` 对同一 entry 连续两次，首次 `{ok:true,state:'resolved'}`、第二次 `{ok:false,code:'ESCALATION_NOT_PENDING'}`。
- 实证 2（真实 HTTP，见 B1-01）：第二次 POST 得 `{"ok":false,"code":"ESCALATION_NOT_PENDING","messageKey":"DRILL_ESC_ALREADY",...}`，状态 409。测试桩（`io.continueEscalation`）是 WP-4 批次 3 的另一现场，本包内无桩。
- **结论：第二次错误确来自核心守卫，真实非桩。**

---

## §8 维度逐维结论速览（返回格式②）

| 维度 | 结论 | 一句证据 |
|---|---|---|
| A 文件边界 | **PASS** | WP-1 3/WP-2 5，敏感既有逻辑零改；授权段外新增为装配代码记 S-01 |
| B 文案逐字 | **PASS** | 63 键逐字齐全、147 键零改动、token 五映射完整 |
| C 五投影 | **PASS** | 5 签名对齐、9 字段取数、异常态齐、8 档排序 |
| D 7 端点 | **FAIL→B1-01** | 5 GET 形状+A2+映射全对；唯 continue `message` 查错表 |
| E 宿主适配器 | **PASS** | 配置驱动+500ms 去重+三错误形状+无真实宿主调用 |
| F 夹具与实验 | **PASS** | 纪律齐、四断言齐、F5-01 真实、test.escalate 等价判定 PASS |
| G 静态门禁 | **PASS** | 5 组 grep+purity+3 测试文件全绿 |
| H 不弱化 | **PASS** | 147 断言未放宽、skip/todo 0；`:653` 恒真属清理记 S-04 |

---

## §9 实跑命令与输出摘要（返回格式⑦）

```
$ git status --short / git diff --stat
  M labels.js, routes.js, server.js, labels-desktop.test.js; ?? drill.js, host-open.js, test/wp14/*
  diff --stat: labels.js +89; routes.js +292; server.js +153; labels-desktop.test.js +203

$ grep -cE "^  DRILL_[A-Z_]+:" src/daemon/http/labels.js  → 63

$ grep -REn "saveState|appendSpan|emit\(|Date[.]now" src/daemon/drill.js        → exit 1（零命中）
$ grep -REn "state = 'running'|node\.state = " src/daemon/http/                 → exit 1（零命中）
$ grep -REn "saveState|appendSpan|emit\(|Date[.]now|new EventEmitter" src/daemon/drill.js → exit 1
$ grep -REn "dsh" src/daemon/drill.js src/daemon/http/routes.js                 → exit 1
$ grep -REn "hosts/" src/adapter/host-open.js | wc -l                           → 3

$ node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid <31词> → OK 31文件零命中 exit 0

$ NODE_ENV=test node --test test/wp14/labels-drill.test.js       → 8 pass / 0 fail
$ NODE_ENV=test node --test test/wp13/labels-desktop.test.js     → 25 pass / 0 fail
$ NODE_ENV=test node --test test/wp14/drill-fixtures.test.js     → 9 pass / 0 fail（含 2 个 daemon 场景）

$ node --input-type=module -e "applyResolution 连续两次"          → 第二次 ESCALATION_NOT_PENDING
$ /tmp/i10b-continue-probe.mjs（真实 HTTP 第二次 continue）        → message:"未知错误：ESCALATION_NOT_PENDING"（B1-01 实证）
```

---

## §10 返回格式汇总

**① 总判 + 计数**：FAIL；阻断 1（B1-01）/ 建议 5（S-01~S-05）。
**② 8 维度逐维**：A PASS / B PASS / C PASS / D FAIL（B1-01）/ E PASS / F PASS / G PASS / H PASS（详见 §8）。
**③ 三重点核查**：核查1 只读性与 A2 调用点 PASS；核查2 test.escalate 结论与 core 写路径一致、等价判定 PASS；核查3 第二次错误来自核心守卫非桩 PASS（详见 §7）。
**④ B1 阻断标题行**：**B1-01 · continue 错误响应 `message` 查错表（用 `ERROR_TEMPLATE` 而非 `COMMAND_ERROR`），实跑返回「未知错误：ESCALATION_NOT_PENDING」，违反 §3.6 逐字响应体与 D-3「既有错误原文」**（位置 `src/daemon/http/server.js:424-433`）。
**⑤ 移交批次 2 注意事项**：
1. 修 B1-01 后，`message` 取值若按 §3.6 逐字稳定文案产出，WP-4 `escalation-continue.test.js` 应对 `message` 加逐字断言；若为「既有错误原文」，确认 `id`/`state` 参数填充与 CLI 显示口径一致。
2. 批次 2/3 消费 `buildDrill`/`buildSubflowGraph` 时按**实际签名**（多 `roleId`/`state`）取数（S-02）；`breadcrumb` 是 `{key,instanceId,roleId,roleTitle}`，拼行与 `DRILL_CRUMB_*` 取值在渲染层完成（S-03）。
3. 冻结文案键名按本批 63 键消费（`DRILL_LAST_ACTION` / `DRILL_NO_SESSION` 等无前缀变体已冻结于 `labels.js`）；批次 2 不得再增删键，发现缺键回改 A-10（风险 10 / 检查点 1 纪律）。
