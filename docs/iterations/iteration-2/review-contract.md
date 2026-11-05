# I1.2 契约变更与代码现状一致性评审
> 评审人：独立评审子 Agent ｜ 基准：`src/**` 实际代码（I1.1，216 用例全绿，实测 `node --test "test/**/*.test.js"` → 216 pass / 0 fail） ｜ 对象：`requirement.md` §1.4 M-1~M-14 + 附录 D

## 0. 总判

**结论：需先改需求（阻断 4 处）。**

阻断项（不改需求就会在实施第 1 天撞墙）：

1. **D-3 的 CAS 形状当前不可实现**：`store.save` 只接受字符串 `expectedState` 并与 `disk.state.state` 比较（`src/persistence/instance-store.js:138-147`），D-3 要求 `expectedState: { instance: 'running', halted: false }`。传对象永远冲突。
2. **缺“多节点推进器”这一整块契约**：`src/**` 里没有任何 `nodes` / `dispatch` / `advance` 标识（`grep -rn "dispatch\|nextNode\|advance\|nodes\b" src` 为空），`finishRun` 在第一个节点核对通过后直接把**实例**置 `completed`（`src/core/orchestrator.js:916`）。M-1~M-14 没有一条定义“谁派发 T-002/T-003、何时算一轮结束”。
3. **M-12 与 BR-29 直接冲突**：M-12 要求事件行全局带 `[#seq]` 与中文原因，BR-29 要求 `single` 的“运行、失败、取消与 I1.1 一致”。事件行没有模板上下文（`renderEventLine(event)` 只收 event，`src/cli/render.js:346`），必须二选一。
4. **D-8 的“必红清单”不完整且部分误判**：漏了 `test/wp1/instance-store.test.js`、`test/wp5/ipc-server.test.js`、`test/wp7/wp7.test.js` 的断言；同时把 `wp4/verify-artifact`、`wp3/launch-config` 误标成“会先红”。

M-1~M-14 中 **需求描述有误的是 M-5、M-8、M-13**（M-3 方向正确但严重低估影响面；M-12 描述准确但与 BR-29 冲突）。其余 9 条与代码相符。

---

## 1. M-1~M-14 逐条核对

| M | 需求描述的现状 | 代码实际（文件:行） | 结论 | 影响文件 | 会红的测试 |
|---|---|---|---|---|---|
| **M-1** | `TABLES.node`：`pending→{running,cancelled}`、`running→{review,failed,cancelled}`、`review→{done,failed}`、`done/failed/cancelled=[]`；`DEFINED_ONLY.node=['escalated']`；新增 10 条边 | 完全一致：`state-machine.js:59-66` 共 **7 条边**；`state-machine.js:84-88` `node: Object.freeze(['escalated'])`；`escalated` 不在 `TABLES.node` 里（无行），由 `can()` 的 `definedOnlyStates.includes(from)` 拦截（`:121-127`） | **相符** | `src/core/state-machine.js`：`TABLES.node`、`DEFINED_ONLY.node`、新增 `escalated` 行；`src/core/orchestrator.js` 的 `finishRun`/`applyCancel` 门控 | `wp2/state-machine.test.js` 4 个用例（见 §4） |
| **M-2** | 实例无 `suspended`；`TERMINAL_INSTANCE` 四态；`render.js` 有第二份副本；`ACTIVE_NODE={pending,running,review}` | `orchestrator.js:34` `const TERMINAL_INSTANCE = new Set(['completed','failed','cancelled','interrupted'])`；`render.js:38` **确有第二份**同值副本；`orchestrator.js:35` `ACTIVE_NODE`，唯一使用点 `orchestrator.js:1265` | **相符** | `orchestrator.js:34-35,395,1164,1199,1265,1382`；`render.js:38,310`；`instance-store` 无需改常量 | 现有用例不红（`suspended` 是新增态）；`wp6/render` 的 `renderHandoffWait` 只在新增 `suspended` 快照时需补测 |
| **M-3** | 单对象 + `schemaVersion:1`；v1 只读四规则；三个写入点；`list()` 投影读数组并补 `cwd/template` | `newState` 写 `schemaVersion: 1` 与单 `node/session/handoff`（`orchestrator.js:336-364`）；`load` **只校验 schemaVersion 是否存在，不校验取值**（`instance-store.js:24-34,93-94`）；`list()` 只读 `parsed.node?.state / parsed.session?.state / parsed.handoff?.state`（`:267-275`）。写入路径实为 **`claimRun`（run/复用）、`applyCancel`（cancel）、`markInterrupted`（reconcileOnBoot 与 interruptAll 共用）**（`orchestrator.js:373,1230,1391`，调用点 `1360/1377/1184`） | **相符（但影响面被严重低估）** | `orchestrator.js` 全部读写点（`newState`、`claimRun`、`finishRun`、`handleUpdate`、`quiesceSession`、`snapshotOf`、`applyCancel`、`markInterrupted`）；`instance-store.js:24-34,219-280`；`render.js` 全部渲染函数 | `wp1/instance-store`（投影 deepEqual）、`wp4/orchestrator`（所有 `state.node/...`）、`wp7`、`wp8/f1~f5`、`wp5/ipc-server`、`wp9/render-fixes` |
| **M-4** | `object ∈ {instance,node,session,handoff}`；新增 `escalation` 与 11 个 reason；老读端只显示不报错 | 事件总线**没有 object/reason 白名单**：`event-bus.js:66-92` 只校验 event 是对象且带 `instanceId`；`render.js:62-70` 对未知 object 回退 `String(object)`，对未知 state 回退原值，不会抛 | **相符** | `src/core/orchestrator.js` 各 emit 点；`render.js:22-29,346-376`（要加 escalation 层/标签） | 现有 `wp1/event-bus` 不红（新增 event 可透传） |
| **M-5** | 白名单“只有 timestamps 与 acceptedSignal”；`tracker.wake()` 写入、`snapshot()` 输出、`handoffToState()` 投影“三处分离” | `handoffToState` 实际 10 个字段：`handoffId,state,createdAt,deliveredAt,acceptedAt,consumedAt,rejectedAt,rejectReason,acceptedSignal,ambiguityWindowMs`（`orchestrator.js:55-68`），**不止 timestamps+acceptedSignal**；`tracker.snapshot()`（`handoff-tracker.js:190-207`）无 `wakeConsumedAt/edge/defects/note`；**`wake()` 根本不存在**（返回对象 `:209-218` 只有 created/delivered/observeTurnEvent/consumed/rejected/state/snapshot/can）；`LEGAL.created` 只有 `['delivered']`（`:25-33`） | **描述有误（细节）**：白名单多了 `handoffId/state/rejectReason`；`wake()` 不是“已有待穿透”，而是三处都要新建/扩展 | `state-machine.js:67-75`；`handoff-tracker.js:25-33,190-207` + 新 `wake()`；`orchestrator.js:55-68` | `wp2/state-machine`（HANDOFF_EDGES 缺 `created→rejected`）；`wp3/handoff-tracker` 现有断言不红，只需补用例 |
| **M-6** | `INSTANCE_LABEL` 6 项、`NODE_LABEL` 无 escalated、无 ROLE/TEMPLATE/ESCALATION/REASON_LABEL；`LAYER` 四层；`ERROR_TEMPLATE` 11 条不改 | 一致：`labels.js:6-13` 6 项；`:15-22` 无 escalated；全文无 `ROLE_LABEL/TEMPLATE_LABEL/ESCALATION_LABEL/REASON_LABEL`；`render.js:22` 四层；`ERROR_TEMPLATE` 9+`STATE_CORRUPT`+`INSTANCE_TERMINAL`=11（`labels.js:54-68`） | **相符** | `labels.js` 全量新增；`render.js:22-29`（`LAYER.escalation`、`STATE_LABEL.escalation`） | `wp2/labels.test.js`（`:63-71` 隐式禁止 escalated） |
| **M-7** | 无升级实体；新增 `escalations[]` + 一条边 + `DEFINED_ONLY.escalation=[]` | 无任何 escalation 代码；`smFor()` 把未知 object 一律当 instance（`orchestrator.js:184-188`），`objectIdOf()` 未知 object 返回 instanceId（`:190-194`） | **相符（新增）** | `state-machine.js` 新增 `ESCALATION_STATES`/`TABLES.escalation`/`DEFINED_ONLY.escalation`/`createEscalationSM`；`orchestrator.js:184-194` 必须显式映射；`newState`/`applyCancel` | 无现有用例（新增） |
| **M-8** | `VALUE_FLAGS` 无 `template/host`；`run.start` 无 `template`；“host-config 已支持 hostId，缺的是 CLI 解析” | `VALUE_FLAGS = ['cwd','task','instance','project','generation']`（`main.js:43`）；未知参数在 `parseArgs` 直接 usage（`:90-92`）→ 退出 2；`run.start` 请求体只送 `cwd/task/instanceId`（`:220-227`）；server 端**已经**接受并透传 `hostId`（`server.js:139`），factory 也已支持（`factory.js:43,49-60`）。真正缺的是 **parse + main 发送 + server 的 template 白名单** | **描述有误（细节）**：hostId 只缺 CLI→main 一段，不是“host-config 缺”；server `run.start` 的对象重建（`server.js:133-140`）会静默丢掉 `template` | `main.js:43,90-92,220-228`；`server.js:123-140`；`labels.js` 错误码；`render.js:40-46` usage | `wp6/main.test.js` 不红（未断言 VALUE_FLAGS）；需新增用例 |
| **M-9** | `waitForRun` 只认四态；退出码 0/1/2/3；`run.wait` 已实现但契约漏登 | `waitForRun` 用 `TERMINAL_INSTANCE` 判定（`orchestrator.js:1164`）；`exitCodeFor` 只返回 0/1/2/3（`main.js:126-130`）；`run.wait` **已注册**（`server.js:165-180`），`main` 用 30min 上限调用（`main.js:24-25,296-300`）；I1.1 契约 §2.13 方法表 9 项，确无 `run.wait` | **相符** | `orchestrator.js:1154-1181`；`main.js` run 收尾；`labels.js`/`render.js` 三行/四行收尾 | `wp6/main` 现有断言不红（只测已有码）；需新增 4/5 |
| **M-10** | `applyCancel` 单对象；`ACTIVE_NODE` 三态；交接包条件 `delivered|accepted`；`review→failed` 特判 + `cancelled_in_review`；返回值 `{session,node,handoff}` | 全部一致：`applyCancel` 操作 `state.session/state.node/state.handoff`（`orchestrator.js:1230-1306`）；review 特判与 note 在 `:1254-1264`（`state.node.note='cancelled_in_review'`，detail 同值）；交接包条件 `:1271`；返回值 `:1300-1305`；`ACTIVE_NODE` 仅 `:1265` | **相符** | `orchestrator.js:1230-1306`；`render.js:322-341`；`server.js:215-223`（结果形状硬编码，M-10 未列） | `wp4/orchestrator` cancel 用例、`wp8/f1/f5`、`wp5/ipc-server:262` |
| **M-11** | 启发式路径提取、只查存在/非空；空文件文案 `声明的产出为空 <路径>`；`single` 保留启发式 | 空文件文案逐字 **`声明的产出为空 ${ref}`**（`verify-artifact.js:173`）；缺失文案 `未找到声明的产出 ${ref}`（`:171`）；提取规则是“中文引导词从句 + 含分隔符的裸 token”，不是泛化启发式：`LEAD_WORDS`（`:22`）、`CLAUSE_END`（`:25`）、`PATH_TOKEN`（`:28`）、ASCII 字符集+扩展名/分隔符（`:33-36,62-70`）、绝对路径与 `..` 丢弃（`:59-63`）；**当前完全不认 `产物：`**（无该字面量） | **相符** | `verify-artifact.js` 新增 code-loop 分支（建议新函数，保留旧函数）；`orchestrator.finishRun:891-893` 需传 `template`/`roundStartedAt`；`render.js` 空文件文案随 `failure.message` 透传 | `wp4/verify-artifact` 空文件用例只 `includes`（`:83`），**不会因文案先红**；若全局替换 `extractDeclaredArtifacts` 则 `:17-41` 4 个用例红 |
| **M-12** | `render` 单节点/单会话/单交接包/无模板/无升级；`renderEventLine` 不打印 seq；被 `rejected` 保持 I1.1 版式 | 一致：`renderNodeLine` → `节点 已完成 · 耗时 1m12s` / `节点 待校验`（`render.js:220-237`）；`renderHandoffLines` → `交接包 HO-001  已构造   10:30:02`（`:277-301`，模板 `:298`）；`renderEventLine` → `10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event`（`:346-376`，无 seq）；`renderRejectedTransition` 不带 seq/原因（`:379-387`） | **相符（但与 BR-29 冲突，见 §2）** | `render.js` 全部；`main.js:321-327,443-456`（行序/事件分流，M-12 未列） | `wp6/render` 4 组精确字符串、`wp9/render-fixes` 节点行/状态行 |
| **M-13** | `createOrchestrator` 固定使用**内置图** | **没有“图”这个对象**：单节点流程写死在 `createOrchestrator` 内，节点/交接包号是常量 `ROLE_ID='worker'`、`NODE_ID='T-001'`、`HANDOFF_ID='HO-001'`（`orchestrator.js:23-27`）；构造参数实为 `{store,bus,adapterFactory(必填),verify,clock,generation,permissionPolicy,env}`（`:80-98`，`adapterFactory` 缺失直接 `TypeError` `:96-98`），无 `graph` | **描述有误**：不是“内置图”，而是“无图、单节点硬编码” | `orchestrator.js:23-27,80-98,819-959`；新增 `src/templates/**`；`serve-entry.js:80` 构造点 | 无现有用例；AC-28 的 purity 扫描会因图数据落点而新增约束 |
| **M-14** | 无测试接缝；`createOrchestrator` 只导出 8 个方法 | 一致：`orchestrator.js:1439-1448` 恰 8 个（startRun/waitForRun/cancel/getStatus/listInstances/reconcileOnBoot/interruptAll/dispose）；无 `NODE_ENV` / `MAESTRO_TEST_*` / `dispatchToNode` / `escalateOnce`；但构造参数已有 `env`（`:88`，现仅用于审批策略），可作为接入点；“生产构建不挂载”不成立——无构建步骤，只能运行时条件导出 | **相符（措辞需改为运行时守卫）** | `orchestrator.js:80-98,1439-1448`；`serve-entry.js:80`；新增 `test/fixtures/call-seam.mjs` | 无现有用例 |

---

## 2. 需求描述与代码不符的条目（详细）

### 2.1 M-5：白名单字段清单不准确，`wake()` 不存在

`src/core/orchestrator.js:55-68`：

```js
function handoffToState(snapshot) {
  return {
    handoffId: snapshot.handoffId,
    state: snapshot.state,
    createdAt: snapshot.timestamps?.createdAt ?? null,
    ...
    rejectReason: snapshot.rejectReason ?? null,
    acceptedSignal: snapshot.acceptedSignal ?? null,
    ambiguityWindowMs: snapshot.ambiguityWindowMs ?? null,
  };
}
```

需求说“现有白名单只有 timestamps 与 acceptedSignal”不准确：还有 `handoffId`、`state`、`rejectReason`。结论不变（`edge/defects/note/wakeConsumedAt` 确实会被 `handleUpdate` 的 `state.handoff = handoffToState(tracker.snapshot())` 任意一次重投影抹掉，`orchestrator.js:764-767`）。但实施时不要按“只加三个字段”理解：要**同时**在 `tracker` 内新增 `wake()` 与字段、`snapshot()` 输出、`handoffToState` 投影三处补齐，否则 `wakeConsumedAt` 写不进也读不出。

另：`handoff-tracker.js:209-218` 的返回对象没有 `wake`；`snapshot()`（`:190-207`）也没有 `edge/defects/note`。以代码为准：这是**新增能力**，不是“穿透既有字段”。

### 2.2 M-8：hostId 已通到 server/factory，缺的是 CLI 与 main

- `src/adapter/factory.js:43,49-60`：`create({hostId})` 已按 `hostId` 读 `.orch/hosts/<id>.json`。
- `src/daemon/server.js:139`：`...(typeof params?.hostId === 'string' ? { hostId: params.hostId } : {})`，已透传。
- 真正缺口：`main.js:43` 的 `VALUE_FLAGS` 无 `host/template`；`main.js:220-227` 的请求体不送 `hostId`；`server.js:133-140` 重建参数对象时不带 `template`。

所以“缺的是 CLI 解析”只对一半：**解析 + main 发送 + server 白名单** 三处都要改，需求的影响清单应写全。

### 2.3 M-13：不存在“内置图”，是单节点硬编码

`src/core/orchestrator.js:23-27`：

```js
const ROLE_ID = 'worker';
const DEFAULT_HOST_ID = 'dsh';
const NODE_ID = 'T-001';
const HANDOFF_ID = 'HO-001';
```

`finishRun`（`:819-959`）只处理一个 `state.node`，并在核对通过后直接 `transition('instance','completed')`（`:916`）。因此 M-13 实际要求的是**引入图模型 + 多节点调度器**，不是“把已有内置图参数化”。AC-28 的 `purity-check --forbid code-loop,developer,tester,coordinator --dirs src/core,src/daemon` 也要求图数据不能落在 `src/core`（需求自己的白名单是 `src/templates/**`，当前不存在）。这一点必须写进影响清单，否则实现者会把 `code-loop` 图塞进 core，AC-28 直接失败。

### 2.4 M-12 与 BR-29 的契约冲突（不是代码错误，是需求内部冲突）

- M-12 要求“事件行改为 `[#<seq>] <时间>  <层> <id>  <中段>  原因 <中文原因>`”，没有模板例外。
- BR-29 要求“不带 `--template` 时（`single`），用户看到的运行、失败、取消与 I1.1 一致”；I1.1 的事件行是 `10:30:05  交接包 HO-001  已投递 → 已接受  原因 turn.first_event`（`render.js:346-376`，测试 `wp6/render.test.js:219-265`）。
- `renderEventLine(event)` 没有 template 入参，`main.js:451-454` 也没有把快照模板传下去。

必须以代码为准二选一：**要么 M-12 限定 `code-loop`**（`renderEventLine(event,{template})`），**要么**删掉/改写 BR-29 与 AC-21/22 中“事件行不变”的断言。现状无法同时满足。

### 2.5 M-3 的“影响面”不是“加几个字段”，而是全核心对象模型改造

`grep -rn "nodes\b\|dispatch\|advance" src` 为空；`state.node`/`state.session`/`state.handoff` 出现在 `orchestrator.js` 的 `finishRun`（`:819-959`）、`handleUpdate`（`:716-785`）、`quiesceSession`（`:791-816`）、`snapshotOf`（`:1308-1333`）、`applyCancel`（`:1230-1306`）、`markInterrupted`（`:1391-1420`）、`claimRun`（`:373-584`）。M-3 只写“字段见 D-6”，但这些函数全部要改成“按 nodeId/sessionId/handoffId 定位元素”。这不是“字段替换”，而是**调度与收尾重写**。

---

## 3. 未登记但必然要动的接缝

| # | 位置（文件:行） | 现状 | 为什么必须动 | 建议补进需求的契约文本 |
|---|---|---|---|---|
| **S1** | `src/persistence/instance-store.js:138-147` | `const actual = disk.ok ? disk.state.state ?? null : null; if (actual !== opts.expectedState) return STORE_CONFLICT;` —— 只比**实例状态字符串** | D-3 要求 `expectedState: {instance:'running', halted:false}`；对象与字符串永远不等 → D-3 的“一次 CAS 落盘”无法实现。且只比实例状态，两个并发写（如 cancel 与 escalate）都看到 `running`，都能成功 → 丢失更新，BR-18“取消优先”无实现基础 | “`store.save(id,state,{expectedState})` 的 `expectedState` 接受 `string`（旧）或 `{state?, halted?, rev?}`（新）；`rev` 为 `updatedAt`/单调版本；CAS 必须检测整快照版本，而非仅 `state.state`。v1 调用保持字符串语义。” |
| **S2** | `src/core/orchestrator.js:184-194,205-282` | `smFor(object)` 只认 node/handoff，**其余一律 instance**；`objectIdOf` 未知 object 返回 instanceId；`transit` 取 `state[object]`，只支持单对象 | v2 的 `nodes[]/sessions[]/handoffs[]/escalations[]` 没有“按 id 取元素”的入口；`transit(instanceId,'node',...)` 在 v2 会拿到 `undefined` → `UNKNOWN_STATE`。M-7 的 `escalation` 会被静默当成 instance SM | “`transit(instanceId, object, to, {nodeId?,sessionId?,handoffId?,escalationId?,index?})`：v2 必须按 id 定位数组元素；`smFor('escalation')` 返回第 4 个 SM；未知 object 必须报 `UNKNOWN_OBJECT`，不得回退到 instance。” |
| **S3** | `src/core/orchestrator.js:819-959`（`finishRun`），尤其 `:916` | 一个 `finishRun` 只处理一个节点；核对通过后直接 `transition('instance','completed')`，同时 `driveRun` 在 `:1065-1084` resolve | 编码闭环要求 T-001 完成后派发 T-002、T-003；当前没有任何“下一步节点”概念，T-001 一完成实例就 `completed`。这是**第一道功能墙**，比字段改名严重 | “新增引擎级 `advance(instanceId)`：按图定义找当前节点的出边，构造下一张交接包并 `dispatchToNode`；实例只在图终节点完成时 `completed`；`runCount/round` 的推进只由 `advance` 负责。” |
| **S4** | `src/core/orchestrator.js:1086-1095,1106-1146,1154-1181` | `earlyReturn` 在“会话建立 + 首个交接包 delivered”后返回（`claimRun` 末尾）；`run.wait` 等的是 `driveRun` 里**这一次** run 的 `finishRun` | 多节点下“何时可返回”未定义：run.start 返回后 T-002/T-003 还没发生；`driveRun` 只包住第一个节点，实例终态提前出现；`waitForRun` 的 waiter 在第一个节点结束就被删除 | “`run.start` 的早返回点固定为 **T-001 的 HO-001 delivered**；`run.wait` 的完成条件是**实例终态 ∪ suspended ∪ halted**，与单节点 run 的结束解耦；`driveRun` 改为 `driveGraph` 长生命周期。” |
| **S5** | `src/daemon/server.js:123-140,215-223`；`src/cli/main.js:220-227` | `run.start` 手工重建 `{cwd,task,earlyReturn,instanceId,hostId}`，**静默丢弃 template**；`instance.cancel` 返回体硬编码 `{session,node,handoff}` | M-8 的 template 全链路、M-10 的 `{nodes,sessions,handoffs,escalations}` 都会在 IPC 层被截断；D-8 完全没列 `server.js`/`wp5/ipc-server.test.js` | “`run.start` params 白名单增加 `template`；`instance.cancel` 结果直接透传 orchestrator 的数组结果；IPC 不重建业务对象，只做字段校验。” |
| **S6** | `src/core/orchestrator.js:158-187,716-816,1308-1333` | `renderSessionLine`/`handleUpdate`/`quiesceSession`/`snapshotOf`/`applyCancel` 全部直接读写 `state.session`（单对象） | v2 `sessions[]` 后，`state.session` 为 `undefined`；`handleUpdate` 无法找到当前 `ctx.sessionId` 对应元素；`snapshotOf` 的 `sessionIdleMs/sessionStalled` 失效；`applyCancel` 的会话收敛只覆盖最后一个 | “v2 的会话读写统一走 `findSession(state, sessionId)`；`snapshotOf` 的 `session` 字段取**最新一条**（status 只显示当前会话），其余字段从该条派生。” |
| **S7** | `src/persistence/instance-store.js:219-280`；`src/cli/render.js:108-119` | `list()` 只输出 `nodeState/sessionState/handoffState` 三个标量；`renderInstanceListRow` 只读 `snapshot.node/session` | 无 `--instance` 的 `orch status` 要显示 `已挂起 · 待处理升级 1`（§2.5），列表项没有 `template/cwd/escalations`；M-3 只提 `cwd/template`，没提升级计数 | “`store.list()` 投影增加 `schemaVersion, template, cwd, pendingEscalations`（只读摘要，不读数组全量）；`renderInstanceListRow` 按 `template` 决定是否打模板与升级后缀。” |
| **S8** | `src/adapter/session-state.js:69-163,229-234` | `reduce()` 不校验迁移；`onEscalated()` 只改自身记录；`quarantined` 只按 sessionId 记 | D-6 规定 `escalated` 无出边（除取消），但升级后若宿主迟到 `agent_message_chunk`，`reduce` 会把会话翻回 `thinking`；当前只有 `quarantine` 能挡，升级路径若不置 `ctx.quiescing/quarantined` 就会出现“实例已挂起、会话执行中” | “`normalizer` 增加 `escalated` 终态守卫：进入 `escalated` 后除 `onCancelled` 外任何 `reduce/onPermission*/onPromptSettled` 都保持 `escalated`；升级事务必须同时置 `ctx.quiescing=true` 与会话 `quarantined=true`。” |
| **S9** | `src/core/orchestrator.js:373-432`；`src/persistence/paths.js:77-87` | `startRun` 没有目录级检查；`withLock` 只按 instanceId/'@allocate' 加锁；`pipeName` 只保证一个核心 | B-14 的“同目录只能一个未结束实例”若写成 `store.list()` 查询，两个并发 `run.start` 会在 await 期间同时看到空列表 → 各建一个实例；路径哈希不提供目录锁 | “在 `claimRun` 前用 `withLock('@dir:'+resolvedCwd)` 串行化‘列目录 → 判未结束 → 分配 id → 首次落盘’；锁范围必须覆盖 `store.list()` 与第一次 `save`。” |
| **S10** | `src/cli/render.js:346-376`；`src/cli/main.js:443-456` | `renderEventLine(event)` 无模板上下文；rejected 行单独走 `renderRejectedTransition` | M-12 要全局加 `[#seq]` 与中文原因，BR-29 要 single 保持 I1.1 事件行；没有 template 入参就无法分流；rejected 行是否加 seq 也只由 M-12 单向规定 | “`renderEventLine(event,{template})`：`single` 保持 I1.1 版式；`code-loop` 加 `[#seq]` 与 `REASON_LABEL`；`result==='rejected'` 两种模板都不加 seq（保留 I1.1 AC-26）。” |
| **S11** | `src/cli/render.js:391,411-415`；`src/cli/labels.js:54-68` | `PLACEHOLDERS = ['cause','path','step','raw','reason','state']`；替换只处理白名单 | D-5 新增 `TEMPLATE_UNKNOWN='未知模板：{name}'`、`DIR_BUSY='该目录已有未结束的实例 {instanceId}，本次未发起'`、`BACKFLOW_DEFECT_LINE` 的 `{i}/{summary}/{evidence}`；`{name}`/`{instanceId}`/`{i}` 不在白名单 → 会原样打出 `{name}`，AC-23/AC-40 直接失败 | “`ERROR_TEMPLATE` 的占位符白名单增加 `name/instanceId/i/summary/evidence`；新增文案必须逐字进入 `labels.js`，`renderError` 只做机械替换。” |
| **S12** | `src/core/orchestrator.js:23-27`；AC-28（需求 §3.1） | core 内现有 `worker/T-001/HO-001` 字面量；无 `src/templates` | AC-28 扫描 `src/core,src/daemon` 禁止 `code-loop/developer/tester/coordinator`；若把图数据放 core 必挂；若保留 `worker` 等旧字面量，虽不在 forbid 列表，但“图数据在 core”违反架构约束 | “内置图与角色定义放 `src/templates/**`（新增目录）；`src/core` 只接受 `graph` 对象，不含任何模板/角色名；AC-28 的白名单包含 `src/templates/**`。” |
| **S13** | `src/persistence/instance-store.js:126-159`；M-14/D-3 | `MAESTRO_FAULT=state_write:escalation` 要求“只让升级那一次 CAS 失败、halted 独立写成功”，但 store 没有注入点，orchestrator 也没有 `commitEscalation` | 若无明确落点，实现者会在 `save` 全局注入故障 → `halted` 也写不进，AC-38 不可复现；或只在前端伪造，无法验证真实降级 | “故障注入点固定在 `orchestrator.commitEscalation()` 的**那一次** `saveState` 调用；`store.save` 不感知 `MAESTRO_FAULT`；`halted` 走另一条独立 `saveState`。” |

---

## 4. 会先红的测试与 D-8 完整性

> “会红”指按 M-x 字面实现后，现有断言必然失败；“新增用例”不算红。D-8 列出的 12 个文件全部存在（`test/wp2/state-machine.test.js`、`test/wp9/render-fixes.test.js`、`test/fixtures/attempt-transition.mjs` 等均存在）。

| 测试文件 | 用例 | 断言（行） | 为何会红 | D-8 是否覆盖 |
|---|---|---|---|---|
| `test/wp2/state-machine.test.js` | `node: every in-table edge...` | `NODE_EDGES` 只有 7 条（`:24-32`） | M-1 新增 10 条边 | 覆盖 |
| 同上 | `node: every out-of-table pair...` | `:102-141` 遍历 states | `done→running`/`done→escalated`/`review→cancelled` 变合法 | 覆盖（文件级） |
| 同上 | `node: terminal states accept nothing` | `terminal: ['done','failed','cancelled']`（`:58`） | `done` 不再是终态 | 覆盖 |
| 同上 | `escalated accepts no transition at all` | `:171-186` | `DEFINED_ONLY.node` 清空、新增 `escalated→cancelled` | **未点名** |
| 同上 | `explicit out-of-table samples...` | `:164-165` `done→running`、`:185` `done→escalated` | 同上 | **未点名** |
| `test/wp2/labels.test.js` | `node labels ... hide escalated` | `:63-71`（deepEqual + `'escalated' in NODE_LABEL === false`） | M-6 必须加 `NODE_LABEL.escalated` | 覆盖 |
| `test/wp1/instance-store.test.js` | `list：完整/半截实例` | `:212-221` deepEqual 整个 item | M-3 投影增加 `cwd/template`（S7） | **未覆盖** |
| `test/wp4/orchestrator.test.js` | `happy path` | `:149-157` `state.node.state/handoff.state/session.state/roleId` | M-3 v2 数组 | 覆盖（只提事件序列，**未提形状断言**） |
| 同上 | `VERIFY_FAILED...` | `:221-227` 同上 | M-3/M-11 | 覆盖但原因不全 |
| 同上 | `cancel：立即落三对象终态...` | `:246-253` | M-10 + M-3 | 覆盖 |
| `test/wp5/ipc-server.test.js` | `instance.cancel` | `:262-263` `cancelled.result.node.state` | M-10 返回值改 `{nodes,...}` | **未覆盖** |
| `test/wp6/render.test.js` | `renderNodeLine...` | `:100-116` | M-12 加节点号/角色/轮次 | 覆盖 |
| 同上 | `renderHandoffLines...` | `:135-177` | M-12 加方向 | 覆盖 |
| 同上 | `renderEventLine...` | `:219-265` | M-12 加 `[#seq]`/中文原因 | 覆盖 |
| 同上 | `renderCancelLines...` | `:206-215` | M-10 改数组 | 覆盖 |
| `test/wp7/wp7.test.js` | `早返回...` | `:130-133` `waited.snapshot.node.state` | M-3 快照改 `nodes[]` | **未覆盖**（只把 wp7 列在“夹具兼容”） |
| 同上 | `run.wait...` | `:194` 只查 `state`，但 `:133/:152` 查 `.node` | M-3 | **未覆盖（断言层）** |
| `test/wp8/f1-permission.test.js` | 三个用例 | `:48,64,80-83,104-105` | M-3 数组 + M-10 | 部分（D-8 仅说 M-10） |
| `test/wp8/f2-reconcile.test.js` | 对账 | seed 用的是 v1 `node/session/handoff`（`:20-38`） | M-3 只读 v1 后不得被对账改写；若对账逻辑改数组，seed 断言会变 | 部分 |
| `test/wp8/f3-cas.test.js` | 存储 CAS | `:32-40` 字符串 `expectedState` | S1 若把 `expectedState` 改成对象，旧断言红；若保持字符串则绿 | **未覆盖（S1 未登记）** |
| `test/wp8/f4-error.test.js` | 失败收敛 | `:19-20,47-50,64-68,86` | M-3 数组 | 部分 |
| `test/wp9/render-fixes.test.js` | C-1/C-4/C-7 | `:95-98,216-255,257-273` | M-12 节点行/状态行；若保留 single 旧版式则绿 | 覆盖（文件级） |

**D-8 明确漏掉/误判的：**

- **漏文件**：`test/wp1/instance-store.test.js`（列表投影 deepEqual）、`test/wp5/ipc-server.test.js`（cancel 结果形状）、`test/wp7/wp7.test.js`（`snapshot.node` 断言）。这三个会在 M-3/M-10 落地时立刻红。
- **漏断言**：`test/wp4/orchestrator.test.js` 的 `state.node/handoff/session` 全量断言（D-8 只写“事件序列/退出码/applyCancel”）；`test/wp2/state-machine.test.js` 的 `explicit out-of-table samples` 与 `escalated accepts no transition`；`test/wp8/f2` 的 v1 seed。
- **误判为“必红”**：`test/wp4/verify-artifact.test.js` 的 `未找到声明的产出` 断言在 M-11 下**不改**（`:68`），空文件用例只 `includes`（`:83`）→ 不会红，只需新增 `roundStartedAt`/`产物：` 用例；`test/wp3/launch-config.test.js` 现有用例完全不涉及 `hostId` → 不会红，是新增断言；`test/wp6/main.test.js` 的 `exitCodeFor` 只测 0/1/3 → 不会红，是新增 4/5。
- **文件存在性**：D-8 列的 12 个文件/夹具全部存在；但需求 §3.3 的 `code-loop-driver.mjs`、`call-seam.mjs`、`purity-check.mjs`、`scenarios/`、`legacy-v1/` 目前均不存在（属本迭代交付物，不是“漏列”）。

---

## 5. 建议的实现顺序（先改测试 → 再改核心 → 再改 CLI）

**第 0 步（写代码前）**：先把 §7 的 C-01~C-14 补进 `requirement.md`，否则测试改成什么样没有唯一答案。

**第 1 批：先改“旧契约编码”的测试（不改就一动一片红）**

1. `test/wp1/instance-store.test.js`：`list()` 投影改为 v2 断言（`schemaVersion/template/cwd/pendingEscalations`），并补 `load` 对 `schemaVersion:1` 仍可读的用例。
2. `test/wp2/state-machine.test.js`：`NODE_EDGES` 17 条、`terminal` 去掉 `done`、`HANDOFF_EDGES` 加 `created→rejected`、删除/改写 `escalated accepts no transition` 与 `explicit samples`。
3. `test/wp2/labels.test.js`：按 D-5 全量补 `ROLE/TEMPLATE/ESCALATION/REASON_LABEL`、`NODE_LABEL.escalated`、`INSTANCE_LABEL.suspended`。
4. `test/wp4/orchestrator.test.js`：把 `state.node/session/handoff` 全部改为 `nodes[0]/sessions.at(-1)/handoffs.at(-1)`；事件序列加 `node.dispatch/verdict.*/escalation.*`；cancel 返回改数组。
5. `test/wp5/ipc-server.test.js`：`instance.cancel` 结果改 `{nodes,sessions,handoffs,escalations}`。
6. `test/wp6/render.test.js`、`test/wp9/render-fixes.test.js`：按 A-1/A-2/A-3/A-4 重写节点行/交接包方向/事件行/取消行；**保留 single 旧版式用例**作为回归。
7. `test/wp7/wp7.test.js`、`test/wp8/f1~f5`：先抽 `test/wp8/helpers.js` 的 `firstNode(state)/lastSession(state)/lastHandoff(state)`，全部断言改用 helper。
8. `test/wp9/cli-e2e.test.js`：只保留 `single` 用例，另加 `code-loop` 前三行/退出码 4/5。

**第 2 批：可以“先加测试、后改实现”的增量**

9. `test/wp3/handoff-tracker.test.js`：加 `wake()`/`wakeConsumedAt`/`created→rejected`。
10. `test/wp4/verify-artifact.test.js`：加 `roundStartedAt` 与 `产物：` 用例；旧 `保存到` 用例保留，证明 single 不变。
11. `test/wp6/main.test.js`：加 `template/host` 解析、退出码 4/5、usage。
12. `test/wp3/launch-config.test.js`：加 `hostId` 透传到 factory 的断言（新增，不是改写）。

**第 3 批：核心（按依赖顺序）**

13. `state-machine.js`（M-1/M-5/M-7）→ `instance-store.js`（S1/S7 投影与 CAS）→ `orchestrator.js`（S2/S3/S4/S6/S8/S9，M-2/M-9/M-10/M-13/M-14）→ `verify-artifact.js`（M-11）→ `session-state.js`（S8）。
14. **CLI**：`labels.js` → `render.js`（S10/S11）→ `main.js`（M-8/M-9）。
15. **夹具/交付物**：`src/templates/code-loop.js`、`mock-acp-agent.js` 的 `--root/--scenario`、`code-loop-driver.mjs`、`call-seam.mjs`、`purity-check.mjs`、`scenarios/*.json`、`legacy-v1/`。

> 关键：第 1 批必须一次改完再动实现；否则 `wp4/orchestrator` 与 `wp8/*` 会在“v2 数组”改造的第一步同时红 30+ 处，无法区分是回归还是契约变更。

---

## 6. 兼容策略与高风险点

### 6.1 哪些 M-x 无法在不破坏 `single` 的前提下直接完成

| M | 冲突点 | 兼容策略 |
|---|---|---|
| **M-3** | v2 数组 vs I1.1 单对象测试/渲染 | **写入统一 v2**（否则 `--instance` 无法复用）；渲染层以 `snapshot.nodes` 是否存在分支：有 → 多节点版式；无 → 保持 `renderNodeLine(snapshot.node)` 旧实现。不要把 `state.node` 留作“兼容副本”，否则两套事实源。测试用 helper 读 `nodes[0]`。 |
| **M-9** | `waitForRun` 完成态扩展 | 只扩展 `RUN_DONE_INSTANCE` 与 `halted` 早退；`single` 永不产生 `suspended/halted`，旧路径逐字不变。`main.js` 的 0/1 分支保留，新 4/5 只在 `template==='code-loop'` 的快照上生效。 |
| **M-10** | `applyCancel` 返回数组 vs I1.1 三行取消输出 | `applyCancel` 只返回数组；`renderCancelLines` 同时接受 `{session,node,handoff}` 与 `{sessions,nodes,handoffs,escalations}`，数组按 `session → node → handoff` 顺序展开；`single` 得到的三行与 I1.1 逐字一致。 |
| **M-11** | 固定 `产物：` 格式 vs I1.1 `保存到` 启发式 | 新增 `verifyCodeLoopArtifacts()`，**不改** `verifyArtifacts()`/`extractDeclaredArtifacts()`；`finishRun` 按 `ctx.template` 选择。`single` 永不触发 `PRODUCT_LINE_MISSING`。 |
| **M-12** | 全局 `[#seq]` vs BR-29 | 推荐 `renderEventLine(event,{template})`：`code-loop` 新格式、`single` 旧格式；`rejected` 两种都不加 seq。若需求坚持全局，则必须改 BR-29 + AC-21/22 的事件行断言。 |
| **M-13** | 图注入 vs 现有单节点行为 | 默认图 = “单节点图”（`ROLE_ID/NODE_ID/HANDOFF_ID` 搬进 `src/templates/single.js`）；`createOrchestrator({graph})` 不传时走默认图。这样 `single` 的路径与输出不变，只是数据来源从常量变成图。 |
| **M-14** | 测试接缝 vs 生产 | 无构建步骤，必须**运行时** `process.env.NODE_ENV === 'test'` 才挂载 `dispatchToNode/escalateOnce`；返回对象用条件展开，避免生产多出可调用方法。`serve-entry` 不传 `env`，接缝读 `process.env`。 |

### 6.2 高风险点（按撞墙顺序）

1. **`finishRun` 单节点收尾**（`orchestrator.js:819-959`，`:916`）：任何 `code-loop` 用例都会在 T-001 完成后把实例写成 `completed`；`waitForRun` 随即返回，T-002/T-003 永远不会被派发。必须先有 `advance()`/图驱动，再谈 M-1 的边。
2. **CAS 粒度（S1）**：D-3 的对象形状当前不可用；若只用字符串 CAS，升级与取消并发时“取消优先”无法保证。建议在 `store.save` 增加 `rev`（`updatedAt` 或递增计数），所有 `transit`/`commitEscalation`/`applyCancel` 都带 `rev`。
3. **`applyCancel` 的多次 `transit` + 最后 `saveState`**（`:1230-1306`）：不是一次 CAS；中途失败会留下“实例已取消、节点仍执行中”。M-10 没要求原子性，但 BR-18 要求“收干净”。应改为“内存改完 → 一次 `saveState` → 再逐条 emit”（与 D-3 同构）。
4. **DIR_BUSY 竞态（S9）**：两个并发 `run.start` 在 `store.list()` 的 await 窗口内都能通过检查。必须在同一把 `@dir` 锁内完成“查 + 建”。
5. **`MAESTRO_FAULT` 注入点（S13）**：若注入到 `store.save` 全局，`halted` 独立写也会失败，AC-38 不可复现。

---

## 7. 必须补进需求的条目清单（14 条）

| # | 建议加入 §1.4 的契约条目 |
|---|---|
| **C-01** | **`store.save` 的 CAS 契约**：`expectedState` 同时接受 `string`（v1）与 `{state, halted, rev}`（v2）；`rev` 必须每次写递增；冲突返回 `STORE_CONFLICT` 且不写。D-3 的 `{instance,halted}` 改为该形状。 |
| **C-02** | **v2 对象寻址**：`transit(instanceId, object, to, {nodeId|sessionId|handoffId|escalationId})`；`smFor` 显式四张表，未知 object 报 `UNKNOWN_OBJECT`；禁止回退到 instance SM。 |
| **C-03** | **多节点推进器**：新增 `advance(instanceId)`（图驱动）；定义“当前节点完成 → 找边 → 建交接包 → 派发下一节点”；实例只在图终节点完成时 `completed`；轮次 +1 只发生在 `advance` 的实际派发。 |
| **C-04** | **`run.start`/`run.wait` 生命周期**：`run.start` 早返回点 = T-001 的 HO-001 `delivered`；`run.wait` 完成条件 = 实例 `RUN_DONE_INSTANCE ∪ halted`，与单节点 run 解耦；`earlyReturn` 对 `single` 语义不变。 |
| **C-05** | **IPC/CLI 透传**：`run.start` params 白名单加 `template`；`instance.cancel` 原样透传 `{nodes,sessions,handoffs,escalations}`；`main.run` 发送 `hostId/template`；`VALUE_FLAGS` 加 `template/host`。 |
| **C-06** | **会话集合化**：v2 所有会话读写按 `sessionId` 定位；`snapshotOf` 的 `session` 取最新一条；`renderSessionLine` 只渲染该条；取消遍历 `sessions[]`。 |
| **C-07** | **`store.list()` 投影**：增加 `schemaVersion/template/cwd/pendingEscalations`；`renderInstanceListRow` 按 `template` 决定模板后缀与“待处理升级 N”后缀；v1 项不带模板。 |
| **C-08** | **会话状态守卫**：`escalated` 无出边（除取消）；升级事务置 `quiescing + quarantined`；`onEscalated` 后任何迟到帧不得改变会话状态。 |
| **C-09** | **目录唯一性原子化**：`DIR_BUSY` 检查与实例创建必须在同一把 `@dir:<realpath(cwd)>` 锁内；锁只覆盖“查未结束 → 分配 → 首次落盘”，不覆盖整个 turn。 |
| **C-10** | **事件行模板上下文**：`renderEventLine(event,{template})`；`code-loop` = `[#seq] + REASON_LABEL`；`single` = I1.1 版式；`rejected` 两种都不加 seq。对应修订/保留 BR-29。 |
| **C-11** | **错误模板占位符**：`renderError` 的占位符白名单加 `name/instanceId/i/summary/evidence`；所有新增文案逐字进 `labels.js`；`TEMPLATE_UNKNOWN/DIR_BUSY/BACKFLOW_*` 必须走该机制。 |
| **C-12** | **图数据落点**：内置图与角色常量放 `src/templates/**`；`src/core` 不含 `code-loop/developer/tester/coordinator`；AC-28 白名单包含 `src/templates/**`；`createOrchestrator({graph})` 的默认图是 `single`。 |
| **C-13** | **故障注入点**：`MAESTRO_FAULT=state_write:escalation` 只作用于 `commitEscalation()` 的唯一一次 `saveState`；`halted` 的独立写入必须成功；`store.save` 不感知该变量。 |
| **C-14** | **D-8 补全**：加入 `test/wp1/instance-store.test.js`、`test/wp5/ipc-server.test.js`、`test/wp7/wp7.test.js`；把 `wp4` 的“形状断言”、`wp2` 的“explicit samples/escalated”写入改法；把 `wp4/verify-artifact`、`wp3/launch-config`、`wp6/main` 标为“新增用例”而非“会先红”。 |

---

> 复核口径：本文所有“代码实际”均来自 `src/**` 当前工作树；测试基线为 216 pass。未修改 `src/**`、`test/**`、`requirement.md`。
