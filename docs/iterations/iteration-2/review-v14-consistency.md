# I1.2 需求 v14 自洽性复核

> 复核对象：`docs/iterations/iteration-2/requirement.md`（v14，1637 行）
> 对照：`docs/index.md`（当前工作区修订版）、`review-baseline.md`、`review-contract.md`、`src/**`
> 只读说明：本文件只新增本文件；未修改 `requirement.md`、`index.md`、`src/**`、`test/**`，未提交。

## 0. 总判（自洽 / 残留 N 处）

**不自洽。残留 16 处：阻断 6 / 重要 6 / 次要 4。**

- **两节点裁剪本身是彻底的**：正文、AC、输出基线、夹具场景、D-7 都没有按三节点写的漏改（详见 §1，0 处漏改）。`T-003` / `协调者` / `summary.md` / `第 4 张` 的出现全部属于角色定义、作废声明、历史变更记录或“不产出”声明。
- **真正的残留集中在 5 个新改点**：AC-45 的真实面断言、M-12 与 C-10 的分流、D-2 的 `failed→escalated` 门控、D-3 的“四改三事件”、D-6 的 `rev` 字段。
- **review-baseline 的 8 个阻断项中 7 项已实质修复**；第 3 项（R-4 等待下游）在 `index.md:180` 已改成“等待下游”，但需求 `:135` / `:187` 仍写“基线现值等待校验”，属文本残留（见 §5）。
- **review-contract 的 4 个阻断项中 1/2/4 基本修复；第 3 项（M-12 vs BR-29）没有闭合**：C-10 已给出正确分流，但 M-12 仍写“事件行改为 `[#seq]…`”且未限定 `code-loop`（见 §3 / §6）。

## 1. 两节点裁剪残留（逐条：行号 / 原文 / 应改为）

**结论：0 处漏改。** 逐关键字判断如下。

| 关键字 | 出现行 | 判定 |
|---|---|---|
| `T-003` | `:6`、`:1494` | **合法**：`:6` 是 v14 的删除声明，`:1494` 是变更记录。正文、AC、输出基线、夹具场景均无。 |
| `协调者` | `:6,101,135,139,157-164,232-234,271,524,751-752,897-898,1248,1441,1460,1494` | **合法**：角色定义（`:101,232`）、R-1 裁决（`:157-164`）、作废声明（`:751-752,897-898`）、D-7 不产出声明（`:1248`）、术语/裁决记录（`:1441,1460`）。没有出现在 AC Gherkin、输出样例或夹具场景的“派发”位置。 |
| `summary.md` | `:6,162,232,1248,1460,1494` | **合法**：均为“不产出 / 留作 I1.5 资产”的声明；`:232` 是角色表的“必须交什么”，已标注“本迭代不产出”。 |
| `三节点` / `三条节点行` / `4 张交接包` / `四条交接包` | 无 | **无漏改**。 |
| `第 4 张` | `:6,162,1494`；另 `:177` | **合法**：`:6/:162/:1494` 是“删除第 4 张交接包”的声明；`:177` 的“第 4 张状态表”指升级状态表（`escalations[]` 是第 4 张表），不是第 4 张交接包。 |

逐项核对：

1. **AC-17 / AC-30 只剩标题 + 作废声明**：`:751-752`、`:897-898` 两处均无 Gherkin 片段，正文已删干净。
2. **§1.3.1 不再引用 AC-17 / AC-30**：`:137-152` 的表格没有任何 AC-17 / AC-30。`:139` 第一列仍是规划原句“内置角色：开发、测试、协调者”（这是“规划依据”的引文），第二列已改为“§2.1 角色职责表（协调者只定义、不派发）”。按“规划原句不改、落点改”的口径，这是合法保留；若要求整行不再出现三角色字样，可把第一列改为“内置角色：开发、测试（协调者仅定义）”，但不阻断。
3. **§2.1 角色表**：`:228-232` 三角色均保留定义，协调者行明确“本迭代不派发 / 看不到 / 不进 code-loop 图”；合法。
4. **§2.2 输出样例**：`:254` “成功结束时补一次终态：两行节点（按 T-001/002）”；正确。
5. **§2.3 走查样例**：`:284-291` 只有两行节点，交接包只有 HO-001 的 3 行；正确。
6. **§2.6 升级样例**：`:431-445` 两行节点、HO-001/002/003 三张交接包；正确。
7. **A-2 列表行**：`:1395` code-loop 明确“2 行，按 T-001/002”；正确。
8. **A-3 code-loop run**：`:1415` “两行节点”；正确。
9. **§2.8 走查**：`:496-503` 第 1 步“两行节点”、第 8 步“两节点图，测试完成即闭环完成”；正确。

> 历史记录 `:38`（v10“AC-45 覆盖…协调者…完成”）和 `:58`（v7“协调者节点细化说明”）属于变更记录，按题面口径是合法保留；但建议在 v14 变更记录中已用“AC-45 改真实面 / AC-46 夹具镜像”覆盖，读者不会把它当成现行规范。

## 2. AC 自洽问题（含 AC-45 与 AC-46 的关系）

### 2.1 AC-45 的“第 2 次 node.dispatch”断言写错了序数（阻断）

`requirement.md:1115`：

```text
And 机检：存在 reason='verdict.read' 且 detail.verdict='fail' 的事件；其 seq 小于第 2 次 reason='node.dispatch' 的 seq（证明回流出真实判定失败，不是夹具造假）
```

一次两节点、一次回流的真实运行，`node.dispatch` 至少 4 次：

1. T-001 第 1 轮（首派）
2. T-002 第 1 轮（正向）
3. T-001 第 2 轮（回流）
4. T-002 第 2 轮（复测）

第 1 次判定失败发生在第 2 次 `node.dispatch`（T-002 第 1 轮）**之后**，它的 seq 一定**大于**“第 2 次 node.dispatch”。按字面断言，AC-45 必红。应改为“小于 T-001 第 2 轮派发（整轮第 3 次 `node.dispatch`）的 seq”。

### 2.2 AC-45 的任务话术与第 2 轮回流缺陷互相矛盾（阻断）

`requirement.md:1110` 的 When 与 `:1189` 的 §3.3 话术都写着：

```text
不要修改 calc.test.js；保持最简实现，不要额外处理除数为 0 的边界。
```

但 AC-45 的设计是第 1 轮因 `div(1,0)` 应抛错而失败 → 回流 → **第 2 轮开发按缺陷补齐边界**。回流包按 §2.4 会把“任务原文 + 缺陷 + 复测要求”一起交给开发；任务原文里仍明确“不要处理除数为 0”，与缺陷要求直接冲突。模型严格遵循任务原文时，第 2 轮可能仍不修，AC-45 无法稳定通过。

应把话术改成“第 1 轮保持最简、不处理边界；收到回流缺陷后，以回流交接包中的缺陷与复测要求为准”，或直接删掉“不要额外处理除数为 0”的绝对禁令。另：`calc.test.js` 对开发可见，模型仍可能主动补边界；`:1121` 已承认“若模型主动补了边界，本条判为不成立”，建议在 §3.3 把这一点写成已知风险，而不是把它当作可通过的验收。

### 2.3 AC-03 不是可独立执行的产品命令 AC（重要）

`requirement.md:581-583`：

```text
Given 第 1 次测试判定为"通过"
When 我执行 orch status --instance INST-001
```

- AC-03 标注“验证面：产品命令”，但没有 `orch run` 步骤；`Given` 直接预设了“测试判定通过”这个结果。
- §3.3 `:1164` 又规定“每条 AC 默认从全新项目根开始”。在全新根上，`orch status --instance INST-001` 没有实例可查。
- 因此 AC-03 目前只能被理解为 AC-01 同一实例的后置读取，不能独立执行；若按 §3.3 的新根规则，它不可构造。

应补一条 `orch run --cwd ./demo-code-pass --template code-loop --task "…产物：calc.js"` 的 Given/When，或明确写“AC-03 复用 AC-01 的实例，不另起新根”。

### 2.4 AC-45 与 AC-46 的关系：不矛盾、不是完全重复，但 AC-45 的独有断言需要修

- **不矛盾**：AC-45 是真实 DSH + 真实模型；AC-46 是夹具 `backflow-once`。两者都走“第 1 轮失败 → 回流 → 第 2 轮通过”，终态断言相同（`completed`、两节点 `done`、3 张交接包全 `consumed`、状态行 `判定 通过`、`升级 —`），这是**同路径的双面镜像**，不是互相矛盾。
- **不是完全重复**：AC-45 独有“`verdict.read fail` 的 seq 早于回流派发”的真实性证明；AC-46 独有 `.mock/prompts/3.json` 的 2 条缺陷证据和 `.mock/prompts/4.json` 的“上一轮缺陷：2 条”。两者各自提供了对方没有的观测点。
- **但 AC-46 已覆盖 AC-45 的全部终态断言**，而 AC-45 的唯一独有断言（`:1115`）目前写错；修好序数后，两条可以并存：AC-46 保证夹具可重复，AC-45 提供真实宿主证据。若只保留一条，保留 AC-46 更稳；若目标是 D-2 的“真实面回流”，则必须修 AC-45，不能删。
- **AC-03 与 AC-45 不重复**：AC-03 是“第 1 次测试通过”（1 张交接包、两节点均第 1 轮）；AC-45 是“第 2 次测试通过”（3 张交接包、两节点均第 2 轮）。观测点差异明确；问题只在 AC-03 自身不可独立执行（§2.3）。

### 2.5 AC-36 的暂停点与节点状态顺序未钉死（重要）

`requirement.md:985-988`：

```text
Given 我用 NODE_ENV=test MAESTRO_TEST_PAUSE=after_verdict 启动 code-loop-driver --scenario backflow-twice --keep（第 1 次判定不通过后停住），且核心在跑
When 我执行 orch status --instance INST-001
Then 机检：state='running'，nodes[1].state='failed'，nodes[1].round=1，escalations.length=0
```

而 `:1300` 对 `after_verdict` 的定义是“核心读完判定、**构造回流包后、投递前**”，没有规定 `review→failed` 与“构造回流包”的先后。若实现先构造回流包再改节点，暂停时 `nodes[1]` 仍是 `review`，AC-36 必红。§2.4 的时序样例（`:315-316`）暗示先 `failed` 再构造包，但这不是契约。应在 D-2 或 §3.3 明确“`after_verdict` 触发前必须已完成 `review→failed`”。

### 2.6 AC-01 / AC-04 / AC-06 / AC-11 / AC-25 / AC-42 的节点号与数量

逐条读 Gherkin，未发现两节点口径错误：

- **AC-01**：`T-001/T-002`、`nodes.length=2`、首个 `node.dispatch` 是 T-001；正确。
- **AC-04**：`retest-hold` 下两行节点都含“第 2 轮”，`grep -c '^节点 T-'` 为 2；正确。
- **AC-06**：`nodes.length` 仍为 2；正确。
- **AC-11**：`HO-003` 是第 3 张复测包，`nodes[1]` 原 `running` → `cancelled`；正确。
- **AC-25**：`T-002` 从 `cancelled` 到 `running` 被拒；`detail.message` 与 `state-machine.js:140` 的文案一致；正确。
- **AC-42**：`retest-fail` 下 3 张交接包全 `consumed`、`nodes[1]` 原 `escalated` → `cancelled`、`nodes[0]` 保持 `done`；正确。

### 2.7 规则引用

抽查全部 AC 的 `规则` 字段：`BR-01~BR-31` 均存在，语义与新 AC 基本一致。唯一的口径问题是 `BR-20` / `BR-21` 没有限定 `code-loop`，与 `single` 的例外冲突（见 §4.3）。

## 3. M/C 重叠与矛盾

| 组 | 关系 | 判断 |
|---|---|---|
| **M-1 / D-1 / C-02** | 边表 vs 对象寻址 | **补充**：M-1 定义边，C-02 定义按 id 定位；不打架。 |
| **M-2 / D-4 / M-10** | 五组常量 / 检查顺序 / 取消 | **补充，但 M-2 的检查顺序缺 D-4 第 6 步**（见 §4.1）。 |
| **M-3 / C-01 / C-07** | schema v2 / CAS / list 投影 | **补充**：M-3 管字段与只读，C-01 管 CAS，C-07 管摘要投影；**`rev` 在 D-6/M-3 的字段清单里缺失**（见 §4.2）。 |
| **M-5 / C-02 / D-2** | `wake()` / 寻址 / 门控 | **补充**：`wakeConsumedAt` 的写、读、投影分别落在 D-2、M-5、D-6，齐全。 |
| **M-8 / C-05 / M-10** | CLI / IPC / 取消返回形状 | **补充**：M-8 是解析与请求体，C-05 是白名单透传，M-10 是 orchestrator 返回值。三者是三层，不重复。 |
| **M-9 / C-04** | `waitForRun` 完成态 / `run.wait` 生命周期 | **补充**：C-04 的 `RUN_DONE_INSTANCE ∪ suspended ∪ halted` 里 `suspended` 已被 `RUN_DONE_INSTANCE` 包含，属冗余表述，不是走样。 |
| **M-10 / M-1** | 取消特判 / `review→failed` 边 | **表述风险**：M-10 写“删除 `review → failed` 特判”，字面可被读成删除状态机边；应限定为“删除 `applyCancel` 中 review 节点改 failed 的特判”，否则与 M-1/D-1 保留 `review→failed` 冲突。 |
| **M-12 / C-10 / BR-29** | 事件行格式 | **打架（阻断）**：M-12 仍写“事件行改为 `[#seq]…`”且未限定模板；C-10 规定 `single` 保持 I1.1 版式；BR-29 / AC-21/22 要求 `single` 不变。C-10 是正确的，但 M-12 没改，实施者按 M-12 会破坏 `single`。 |
| **M-13 / C-12** | 图数据落点 / 默认图 | **补充**：M-13 说明“无图、单节点硬编码”，C-12 指定 `src/templates/**` 与默认 `single`；一致。 |
| **M-14 / C-13** | 测试接缝 / 故障注入 | **补充**：C-13 把 `MAESTRO_FAULT` 固定到 `commitEscalation()` 的唯一一次 `saveState`；一致。 |

**C-01~C-04 形状抽查（对照 `review-contract.md` §7）**：

- **C-01**：`expectedState` 接受 `string` 与 `{state,halted,rev}`，`rev` 每次写递增、CAS 比整快照版本、冲突 `STORE_CONFLICT` 不写——**没有走样**。唯一残留是 `:195` 仍引用 D-3 旧形状 `{instance:'running', halted:false}`，而 D-3 已改为 `{state:'running',...}`。
- **C-02**：`transit(instanceId, object, to, {nodeId|sessionId|handoffId|escalationId})`、`smFor` 显式映射、未知 object 报 `UNKNOWN_OBJECT`、不回退——**没有走样**。
- **C-03**：`advance(instanceId)` 图驱动、终节点才 `completed`、`round+1` 只在 `advance` 实际派发——**没有走样**。
- **C-04**：`run.start` 早返回 T-001 的 HO-001 `delivered`、`run.wait` 完成条件 `RUN_DONE_INSTANCE ∪ halted`——**没有走样**；`∪ suspended` 是冗余（`RUN_DONE_INSTANCE` 已含），不是矛盾。

**M-5 / M-8 / M-13 与代码现状**：

- **M-5**：`orchestrator.js:54-66` 的 `handoffToState` 确有 10 个字段（`handoffId,state,createdAt,deliveredAt,acceptedAt,consumedAt,rejectedAt,rejectReason,acceptedSignal,ambiguityWindowMs`）；`wake()` 不存在；`snapshot()` 不含 `wakeConsumedAt/edge/defects/note`。需求写 `:55-68`，实际 `:54-66`，内容一致。
- **M-8**：`factory.js:43` 已有 `hostId` 参数，`server.js:139` 已透传；`main.js:43` 的 `VALUE_FLAGS` 无 `template/host`，`main.js:220-228` 请求体不送 `hostId/template`，`server.js:123-140` 重建参数对象时丢弃 `template`。需求描述准确。
- **M-13**：`orchestrator.js:23-27` 是 `ROLE_ID/DEFAULT_HOST_ID/NODE_ID/HANDOFF_ID/TURN_ID` 常量；`finishRun` 在 `:916` 直接 `transition('instance','completed')`；没有 `graph` 对象。需求描述准确。

## 4. 附录 D 问题

### 4.1 D-1 / D-4

- **D-1 与 `docs/index.md` §3.1 的 7 条基线边一致**：`index.md:142` 的 7 条（`ready→escalated`、`running→escalated`、`done→running`、`done→escalated`、`review→cancelled`、`failed→cancelled`、`escalated→cancelled`）在 D-1 的实现态表中分别对应 `pending→escalated`、`running→escalated`、`done→running`、`done→escalated`、`review→cancelled`、`failed→cancelled`、`escalated→cancelled`。**没有把 I1.1 的 10 条边当基线增量**；M-1 `:171` 与 §1.4 末② `:187` 已把“10 条（I1.1 7 态表）”和“7 条（基线 9 态）”分开。
- **D-1 本身缺一句表头**：它使用 `pending`，而基线用 `ready`；虽然 M-1 说明了“`pending` 不是基线状态”，D-1 表头仍应写“I1.1 实现态；`pending` = 基线 `blocked+ready`”，否则下一个读者仍可能把它当基线表。**不是混写，是标注不足**（不计入 16 处）。
- **D-4 五组常量与 M-2/M-10 一致**：`TERMINAL_INSTANCE` 四态、`CORE_IMMUTABLE_INSTANCE` 与 `RUN_DONE_INSTANCE` 都是 `TERMINAL ∪ {suspended}`、`CANCELABLE_NODE={pending,running,review,failed,escalated}`、`CANCELABLE_HANDOFF={created,delivered,accepted}`；**`suspended` 没有被误加进 `TERMINAL_INSTANCE`**。

### 4.2 D-2 / D-3

- **D-2 的唤醒门控是 `created/delivered`，不是 `accepted`**：`:1518-1519` 明确 `state ∈ {created, delivered}`、`wakeConsumedAt===null`，`:1530` 还专门解释“不能要求 accepted”。**这一项正确。**
- **D-2 漏了 `failed→escalated`（阻断）**：`:1524` 的派发失败行只写 `pending→escalated / done→escalated`；AC-33 第三个样本 `dispatch-fail-retest` 是 T-002 在 `failed` 状态下复测派发失败，需要 `failed→escalated`。D-1 的 `failed` 行和 D-5 的 `dispatch_failed` 起始状态（`:1612`，`pending/done/failed`）都承认这条边，只有 D-2 的门控表漏了。
- **D-3 的 CAS 形状与 C-01 一致**：`:1535` 使用 `{state:'running', halted:false, rev:<当前快照 rev>}`，正确。**`halted` 独立写也已写清**（`:1537`），但没有给出这次独立写的 `expectedState` / `rev` 取值，需补一句才能与 C-01 的“每次写 rev 递增”闭合。
- **D-3 的“四改三事件”不一致（阻断）**：`:1534` 在内存里改四件事（升级、节点、**会话**、实例），`:1536` 成功时只发三条迁移事件（`escalation.created / 节点 / 实例`），**漏了会话事件**。M-6 `:176` 要求“会话 escalated 与 escalation.created 同一事务”，AC-39 也要求 `sessions[].state='escalated'`；这会话状态没有对应事件，审计链不完整。
- **D-3 假设“一定有会话”不成立（阻断）**：`:1534` 的“会话 → escalated”不适用于 AC-33 第一个样本（首派 `sessionNew='fail'`，没有会话）。应写成“会话存在时 → escalated；首派失败没有会话时跳过”，并让 `:1536` 的事件清单按此分支。
- **D-3 的失败分支节点状态列表漏了 `failed`**：`:1537` 写“节点保持升级前的状态（`review` / `running` / `done` / `pending` 之一）”，但 D-1 的 `failed→escalated` 与 D-5 的 `dispatch_failed` 允许节点从 `failed` 进入升级；列表应补 `failed`。

### 4.3 D-5

- **9 条 I1.1 原文**：`labels.js:55-67` 与需求 §2.2/§2.7 引用的 `工作目录不可写：`、`无法启动 DSH：`、`核心进程启动失败：`、`该节点正在执行，本次未发起`、`会话已失效，需要重新创建`、`审批被拒绝，任务中止于`、`执行失败：`、`核对失败：`、`未知错误：` **一字未改**；`STATE_CORRUPT` / `INSTANCE_TERMINAL` 也未改。D-5 本身只声明“现有 11 条原文不改”，没有复列，但不构成矛盾。
- **新增文案齐全**：`TEMPLATE_UNKNOWN`、`DIR_BUSY`、`LEGACY_READ_ONLY`、`CANCEL_NOT_NEEDED`、`BACKFLOW_DEFECT_LINE`、`BACKFLOW_RETEST_LINE`、`ESCALATION_WRITE_FAILED`、`INSTANCE_STOPPED_SUFFIX` 都在 `:1573-1588`；`EXIT_SUSPENDED` / `EXIT_HALTED` 是退出码，不是文案键，三行收尾在 A-4 `:1420-1432` 给出，可接受。
- **`{text}` 不在 C-11 白名单（重要）**：C-11 `:205` 只要求给 `PLACEHOLDERS` 增加 `name/instanceId/i/summary/evidence`；D-5 的 `BACKFLOW_RETEST_LINE = 复测要求：{text}`（`:1587`）多一个 `{text}`。`render.js:391` 当前白名单是 `cause/path/step/raw/reason/state`；若 `BACKFLOW_RETEST_LINE` 也走 `renderError`，会原样打出 `{text}`。要么在 C-11 增加 `text`，要么明确它走独立渲染、不进 `ERROR_TEMPLATE`。
- **REASON_LABEL 分类有误（次要）**：`:1589` 把 `handoff.rejected` 与 `core.gone` 列为“I1.2 新增”，但两者在 I1.1 代码里已经存在（`src/adapter/handoff-tracker.js:183`、`src/core/orchestrator.js:1370`）；`:1590` 的 I1.1 既有词表反而漏了 `handoff.rejected`。不影响最终词表覆盖，但“新增/沿用”的账不对。

### 4.4 D-6

- **`sessions[]` / `nodes[]` / `handoffs[]` / `escalations[]` 字段基本完整**：`:1224-1235` 覆盖了 AC 引用的 `nodes[].round/state/verdict`、`sessions[].nodeId/round/state`、`handoffs[].edge/defects/wakeConsumedAt/acceptedAt/consumedAt`、`escalations[].nodeId/round/reasonCode/state`。
- **缺 `rev`（阻断）**：C-01 `:195` 与 D-3 `:1535` 都要求 `{state, halted, rev}`，D-3 还要读“当前快照 rev”；但 D-6 `:1220` 的顶层字段没有 `rev`，M-3 `:173` 的字段清单也没有。实施者不知道 `rev` 存哪、是否持久化。必须补进 `state.json` 顶层（或明确放在 `counters` 中）。
- **“其余字段都是 I1.1 已冻结字段”不成立（同一处）**：`:1237` 写“除 `template` / `wakeConsumedAt` / `escalations[]` / `halted` / `roundStartedAt` 与数组化本身，其余字段都是 I1.1 已冻结字段”，但 `edge`、`defects`、`nodes[].verdict`、`note`、`sessions[].round`、`rev` 都是本迭代新增/扩展的。应把这句话改成“其余字段沿用 I1.1 语义，但 `edge/defects/verdict/note/round/rev` 为本迭代新增”。
- **“回合结束 → idle”与 AC-44 的冲突已修好**：`:1239` 已改为“回合结束且**无产出提交** → `idle`；已提交产出 → 保持 `waiting_dependency` 到核对完成/升级/取消”，与 AC-44 的 `after_output`（节点 `review`、会话 `等待下游`）一致。**这一项通过。**

### 4.5 D-8

- **`wp1/instance-store`、`wp5/ipc-server`、`wp7/wp7` 已加入**：`:1625`、`:1630`、`:1633`，且写明了投影 deepEqual、cancel 返回形状、`snapshot.node` 断言。
- **`wp4/verify-artifact`、`wp3/launch-config`、`wp6/main` 已改为“新增用例”**：`:1629`、`:1627`、`:1632`，与 review-contract 的判定一致。
- **漏了 `test/wp2/state-machine.test.js` 的 `HANDOFF_EDGES`（重要）**：`:1623` 只写“`TABLES.handoff` 补 `created→rejected`”，但该测试的 `HANDOFF_EDGES`（`test/wp2/state-machine.test.js:34`）仍只有 `created→delivered`；M-5 新增 `created→rejected` 后，这个测试会先红。D-8 应点名“`HANDOFF_EDGES` 也补 `created→rejected`”。

## 5. 编号与引用问题

### 5.1 编号连续性（通过）

- **AC**：`AC-01` ~ `AC-46` 连续，无缺号；作废的是 `AC-17` / `AC-30`（`:751`、`:897`），标题保留、编号不复用。
- **BR**：`BR-01` ~ `BR-31` 连续，`§2.9` `:507` 明确“共 31 条”。
- **D**：`D-1` ~ `D-5` 在附录 D（`:1502-1569`），`D-6` / `D-7` 在 §3.3（`D-6` 在 `:1215` 附近、`D-7` 在 `:1241`），`D-8` 在附录末（`:1617`）；无重复、无断号。
- **A**：`A-1` ~ `A-4`（`:1371-1418`），无重复、无断号。
- **附录 D 编号说明已改正**：`:1500` 写“D-1 ~ D-5 在本附录；D-6（状态结构）与 D-7（图级产物）位于 §3.3；D-8 在本附录末尾”，与实际标题一致。

脚本抽查结果：全文 `AC-01..46`、`BR-01..31`、`M-1..14`、`C-01..14`、`D-1..8` 的引用均能在文中找到定义，**没有悬空编号**。

### 5.2 引用与口径问题（次要）

- **基线“现值等待校验”已过期**：`:135` 写“基线 §3.2 现值是「等待校验」”，`:187` 写“基线现值「等待校验」需同步”；但 `docs/index.md:180` 已经是“显示‘等待下游’”。应改为“基线已同步为「等待下游」”，否则读者会以为基线还没改。
- **`docs/index.md:671` 行号已过期**：`:159` 与 `:234` 引用 `docs/index.md:671` 作为“模板序列”的位置；当前 `index.md:671` 是空行，I1.2 条目在 `index.md:686` 附近。应改为 `index.md:686`。
- **`index.md:239` 行号已过期**：`:187` 引用 `index.md:239` 的“`consumed` 不等于节点 `done`”关键句；当前该句在 `index.md:246`。
- **AC-22 的“真实面”计数口径不一致（提示，不计入）**：AC-22 头部 `:804` 写“验证面：混合”，但 `:548` 与 `B-11` `:1465` 把 AC-22 计入“真实面共 5 条”。若按验证面分类，真实面应为 4 条 + 混合回归 AC-22；建议统一措辞。
- **`AC-22` 的 I1.1 AC-17/AC-30 不是悬空引用**：`:809` 的 `AC-15..AC-25` 是“I1.1 的 AC”，不是本文的 AC-17/30；保留合法。
- **历史记录 `:38` 提到“AC-45 → 协调者”**：这是 v10 变更记录，不是现行 AC-45；合法，但建议在 v14 记录中明确“AC-45 已改真实面”，避免读者把历史当现状。

## 6. 必须改的清单（按严重度排序，附精确 before→after）

### P0 阻断（6）

**1. AC-45 的 seq 序数**
`requirement.md:1115`
- before：`其 seq 小于第 2 次 reason='node.dispatch' 的 seq`
- after：`其 seq 小于“T-001 第 2 轮（回流后）”的 reason='node.dispatch' 的 seq（即整轮第 3 次 node.dispatch）`

**2. AC-45 的任务话术与回流缺陷冲突**
`requirement.md:1110`（正文）与 `:1189`（§3.3 话术）
- before：`不要修改 calc.test.js；保持最简实现，不要额外处理除数为 0 的边界。`
- after：`不要修改 calc.test.js；第 1 轮保持最简实现，不要额外处理除数为 0 的边界；若收到回流缺陷，以回流交接包中的缺陷与复测要求为准。`

**3. M-12 的事件行未限定模板**
`requirement.md:182`
- before：`事件行改为 `[#<seq>] <时间>  <层> <id>  <中段>  原因 <中文原因>``
- after：`code-loop 的事件行改为 `[#<seq>] <时间>  <层> <id>  <中段>  原因 <中文原因>`；single 保持 I1.1 版式（由 C-10 的 `renderEventLine(event,{template})` 分流）`

**4. D-6 / M-3 缺 `rev`，且“其余字段冻结”表述不准确**
`requirement.md:1220`、`:1237`、`:173`
- before（`:1220`）：`├─ instanceId, state, template, cwd, task, coreGeneration, halted`
- after：`├─ instanceId, state, template, cwd, task, coreGeneration, halted, rev`
- before（`:1237`）：`除 `template` / `wakeConsumedAt` / `escalations[]` / `halted` / `roundStartedAt` 与数组化本身，**其余字段都是 I1.1 已冻结字段**`
- after：`除 `template` / `rev` / `wakeConsumedAt` / `edge` / `defects` / `escalations[]` / `halted` / `roundStartedAt` / `verdict` / `note` 与数组化本身，其余字段沿用 I1.1 语义`
- 同时在 M-3 `:173` 的字段清单补 `rev`。

**5. D-2 漏 `failed→escalated`**
`requirement.md:1524`
- before：`| `pending→escalated` / `done→escalated` | 仅 `code-loop` | 目标节点派发时会话建不起来 | 原因码 `dispatch_failed` |`
- after：`| `pending→escalated` / `done→escalated` / `failed→escalated` | 仅 `code-loop` | 目标节点派发时会话建不起来（首派 / 回流 / 复测） | 原因码 `dispatch_failed` |`

**6. D-3 的“四改三事件”与无会话首派**
`requirement.md:1534`、`:1536`、`:1537`
- before（`:1534`）：`会话 → `escalated``
- after：`会话存在时 → `escalated`（首派建会话失败时没有会话，跳过）`
- before（`:1536`）：`发三条迁移事件（`escalation.created` / 节点 / 实例）并返回`
- after：`发四条迁移事件（`escalation.created` / 节点 / 会话 / 实例）并返回；首派失败没有会话时只发三条`
- before（`:1537`）：`（`review` / `running` / `done` / `pending` 之一）`
- after：`（`review` / `running` / `done` / `pending` / `failed` 之一）`

### P1 重要（6）

**7. AC-03 不是可独立执行的 AC**
`requirement.md:581-583`
- before：`Given 第 1 次测试判定为"通过"` / `When 我执行 orch status --instance INST-001`
- after：`Given 我在全新项目根执行 orch run --cwd ./demo-code-pass --template code-loop --task "…产物：calc.js"（第 1 次测试判定为"通过"）` / `When 我执行 orch status --instance INST-001`
- 或者明确写“AC-03 复用 AC-01 的 INST-001，不另起新根”，二选一。

**8. BR-20 / BR-21 没有限定 `code-loop`**
`requirement.md:530-531`
- before（BR-20）：`发起前拦掉注定跑不通的请求（未知模板、空任务、没写 `产物：` 行）`
- after：`发起前拦掉注定跑不通的请求（未知模板、空任务、`code-loop` 没写 `产物：` 行；`single` 不要求产物行）`
- before（BR-21）：`同一目录同时只允许一个未结束的闭环`
- after：`同一目录同时只允许一个未结束的 `code-loop` 闭环（`single` 不设此限制）`

**9. AC-36 的 `after_verdict` 顺序**
`requirement.md:1300`
- before：`| `after_verdict` | 核心读完判定、构造回流包后、投递前 | 核心（`MAESTRO_TEST_PAUSE=after_verdict`） |`
- after：`| `after_verdict` | 核心读完判定、已将节点 `review→failed`、构造回流包后、投递前 | 核心（`MAESTRO_TEST_PAUSE=after_verdict`） |`
- 同步在 D-2 `review→failed` 行注明“先落节点失败，再构造回流包”。

**10. C-11 白名单缺 `text`**
`requirement.md:205`、`:1587`
- before：`PLACEHOLDERS` 增加 `name/instanceId/i/summary/evidence`
- after：`PLACEHOLDERS` 增加 `name/instanceId/i/summary/evidence/text`（`text` 供 `BACKFLOW_RETEST_LINE`；若该行不走 `renderError`，在 D-5 注明独立渲染）

**11. M-2 的检查顺序缺“同目录其他实例”**
`requirement.md:172`
- before：`给了 `--instance` → 旧格式 → `single` 节点占用（`NODE_BUSY`）→ 正在执行 → 已挂起 → 已结束；没给 `--instance` → 同目录未结束实例`
- after：`给了 `--instance` → 旧格式 → `single` 节点占用（`NODE_BUSY`）→ 正在执行 → 已挂起 → 已结束 → 同目录其他未结束实例；没给 `--instance` → 同目录未结束实例`

**12. D-8 漏 `HANDOFF_EDGES`**
`requirement.md:1623`；`test/wp2/state-machine.test.js:34`
- before：`TABLES.handoff` 补 `created→rejected`
- after：`TABLES.handoff` 与测试里的 `HANDOFF_EDGES` 都补 `created→rejected`

### P2 次要（4）

**13. 基线引用过期**
`requirement.md:135`、`:187`、`:159`、`:234`；`docs/index.md:180`、`:686`、`:246`
- before（`:135`）：`基线 §3.2 现值是「等待校验」`
- after：`基线 §3.2 已同步为「等待下游」`
- before（`:187`）：`基线现值「等待校验」需同步`
- after：`基线 §3.2 已同步为「等待下游」`
- `docs/index.md:671` → `docs/index.md:686`
- `index.md:239` → `index.md:246`

**14. D-5 的 REASON_LABEL 分类**
`requirement.md:1589-1590`
- before：`handoff.rejected='交接被拒'` 与 `core.gone='核心消失'` 放在 I1.2 新增词表；I1.1 既有词表没有 `handoff.rejected`
- after：把 `handoff.rejected` 与 `core.gone` 移到 I1.1 既有词表；I1.2 新增词表只保留真正新增的 `node.dispatch` / `verdict.*` / `backflow.constructed` / `rounds.exceeded` / `escalation.*` / `wake.rejected` / `run.halted` 等。

**15. C-01 仍引用 D-3 旧形状**
`requirement.md:195`
- before：`D-3 的 `{instance:'running', halted:false}` 改为该形状`
- after：`D-3 的 `expectedState` 使用该对象形状（`{state:'running', halted:false, rev}`）`

**16. A-1 段 10 的失败摘要正则不完整**
`requirement.md:1384`；`src/cli/render.js:243-267`
- before：`^(核对失败：.+|会话已失效，需要重新创建)$`
- after：`^(核对失败：.+|执行失败：.+|审批被拒绝，任务中止于 .+|会话已失效，需要重新创建|未知错误：.+)$`

> 说明：D-1 的“`pending` = 基线 `blocked+ready`”标注、AC-22 的“真实面 5 条”计数，是文档可读性问题，不列为本轮 16 处残留；建议在下一版顺手补，不影响实施。
