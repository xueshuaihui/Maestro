# I1.2 任务拆分 — 编码闭环（开发 → 测试 → 缺陷回流 → 升级）

> 迭代：阶段一 · I1.2 ｜ 需求依据：`docs/iterations/iteration-2/requirement.md` **v15**（v14 + §8 的 X1~X3 字段回补；唯一需求依据），本文件不增删其范围
> 评审依据：`docs/iterations/iteration-2/review-baseline.md`（S1~S13 未登记接缝）、`review-contract.md`（C-01~C-14 必补契约）、`review-v14-consistency.md`（16 处残留的契约侧落点）
> 上游依据：`docs/iterations/iteration-1.md`（写法与结构）、`docs/index.md` §3.1~§3.6（已按 v14 修订）
> 本文性质：**拆分 + 选型 + 文件级接口契约**。不含实现代码；伪签名只固定参数与返回结构，JSON 只作形状样例。
> 版本：v1.1 ｜ 2026-11-05 ｜ 本次变更：契约与数据模型对齐需求 v15（X1~X3 回补 + M-12/D-2/AC-45/D-6 表述同步），工作包划分不变
> 硬约束：状态名 / 文案 / AC 编号 / 错误码**逐字取自需求**；`AC-17` 与 `AC-30` **已作废**，不出现在任何工作包的验收口径里。

---

## 0. 迭代定位、范围与退出标准

### 0.1 一句话目标

把「写完要验、验不过要改」从**人肉搬运缺陷**，变成**一条命令跑完开发 → 测试 → 回流 → 复测 → 通过或升级挂起**，且轮次、交接包、升级、停止点全部落盘可复核。

### 0.2 In scope（对应需求 §1.3「范围内」10 条，逐条落位）

| # | 需求原条文（摘要） | 本迭代落地形态（文件 / 机制） |
|---|---|---|
| 1 | 一条命令发起编码闭环 `orch run --template code-loop`，两节点自动建好、按序推进 | `src/templates/index.js` 的 `code-loop` 图 + `advance()`；不写工作流文件 |
| 2 | 三个内置角色，**本迭代只派发开发与测试**（协调者只定义） | `ROLE_LABEL` 三角色；`code-loop` 图只含 `T-001`/`T-002` |
| 3 | 节点表：角色名 / 轮次 / 状态 / 耗时，**当前会话另起一行** | `renderNodeLines()` + `renderSessionLine()` |
| 4 | 测试必须交结构化判定，核心**只认文件** | `src/core/verdict.js` 的 `readVerdict()` |
| 5 | 交接包带上下文（正向 / 回流 / 复测三型） | `buildHandoff()` + `handoffs[].edge.kind` + 派发 prompt 组装 |
| 6 | 测试最多派发 2 次；第 2 次仍不通过 → 停止回流、升级、挂起 | `graph.maxRounds['T-002']=2` + `commitEscalation()` |
| 7 | 闭环引擎可复用（接受注入图） | `createOrchestrator({ graph, graphs })`；`src/core` 不含模板字面量（AC-28） |
| 8 | 兼容与可追溯：v1 只读可查（读也不改）、多节点按节点记录、重启不丢 | `schemaVersion:2` + v1 四规则 + `reconcileOnBoot` 跳过 v1 |
| 9 | 取消：一条命令收敛实例与节点，未投递交接包「已撤回」，升级作废 | `applyCancel()` 遍历四数组 + `CANCELABLE_*` 常量 |
| 10 | 等待下游可见：会话行 `等待下游` 与 `执行中` 区分 | `SESSION_LABEL.waiting_dependency='等待下游'`（沿用 I1.1 实现，R-4） |

### 0.3 Out of scope（摘要 6 条 + 指向原表）

| 不做的事 | 留给谁 | 本迭代的物理约束 |
|---|---|---|
| 角色注册表、`roles/*.yaml`、角色实例 6 态、`orch role` | I1.5 | 三角色是 `src/templates/index.js` 的代码常量；无 `roles/` 目录 |
| 声明式工作流 YAML、模板注册表、校验器、完整原语（并行/条件/超时/重试） | I1.6 | 只有两张内置图；`maxRounds` 固定 2，不可配；`validateGraph()` 只给单测用，不是加载器 |
| 非编码闭环、审核角色、`review_reason` 子状态 | I1.3 | 不交付任何非编码图；AC-28 的假图只在 `test/templates/` |
| 判定 schema 版本化、证据 TTL、产物指纹、交接包 schema 校验器、持久化信箱与重投 | I1.4 | 只做最小判定校验（取值 + 缺陷清单 + 证据存在 + 本轮新写）；不产生 `pending`/`expired` |
| 升级处理入口（`orch escalate list/resolve`、审批放行、人工队列） | I1.4 / I1.11 | 升级只进不出；挂起唯一出路是取消 |
| 产物类型隔离（worktree / 快照 / 版本化区）、git 合并 | I1.7 | 所有产物落同一任务目录 |

> 完整 18 行范围外表见 `requirement.md` §1.3「范围外」；其余条目（CLI 参数族、`--host` 产品化、会话恢复、三层日志、桌面、通知、链式哈希、Cursor/WorkBuddy）一律按原表执行，本文件不重复。

### 0.4 退出标准

1. **44 条有效 AC 全部通过**，分面计数：
   - **真实宿主面 5 条**：AC-01 / AC-03 / AC-21 / AC-22 / AC-45（真实 DSH + 真实模型，`demo-code-pass` / `demo-code-fail` / `demo`）；
   - **夹具 / 混合 / 架构面 39 条**：其余有效条目（AC-28 为架构检查，非用户面）。
   - AC-17 / AC-30 **作废**，不计入分母、不排入任何工作包。
2. **证据可复核**：每条 AC 附 ① 命令原文或夹具命令 ② `state.json` 快照片段 ③ 相关 `events.jsonl` 行 ④ 真实面附 ACP 原始帧路径。全部落 `docs/iterations/iteration-2/evidence/`。
3. **I1.1 的 216 个用例仍全绿**，或按需求 **D-8** 合法改写后全绿（改写清单见 D-8，共 15 个文件/夹具；其中 3 个是「新增用例」而非「会先红」）。
4. **NFR**：NFR-01a/01b（冷热启动）、NFR-02（判定 → 回流 1s）、NFR-09（挂起 10s 内返回，退出码 4）逐条按 §3.2 命令记录。
5. **架构检查通过**：`node test/fixtures/purity-check.mjs --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator` 退出码 0。

---

## 1. 技术选型

> 每条给出 **结论 / 理由 / 被否决的选项与否决理由**。否决项写清「为什么不选」，否则不算决策。

### 1.1 决策一：图引擎形态 —— `src/templates/**` 的数据对象 + `createOrchestrator({graph, graphs})`

**结论**

- 图是**纯数据对象**（含少量函数字段：节点 prompt 组装、产物策略名字符串），放 `src/templates/index.js` 一个文件：
  - `ROLES`：`developer` / `tester` / `coordinator`（coordinator 只定义、不派发）；
  - `GRAPHS.single`：`entry='T-001'`、`nodes=[{nodeId:'T-001', roleId:'worker', artifactPolicy:'heuristic', judge:'none'}]`、`edges=[]`、`terminals=['T-001']`、`showTemplate=false`；
  - `GRAPHS['code-loop']`：`T-001 developer` → `T-002 tester`，边 `forward`（T-001→T-002）、`backflow`（T-002→T-001）、`retest`（T-001→T-002），`terminals=['T-002']`、`maxRounds={'T-002':2}`、`showTemplate=true`；
  - `getGraph(name) -> graph|null`（未知模板返回 `null`，不抛）；
  - `initialStateOf(graph, {instanceId, cwd, task, clock}) -> nodes[]`（由图的 `nodes` 生成初始数组）。
- `createOrchestrator({ graph, graphs })`：`graph` = 本次运行的图（默认 `GRAPHS.single`）；`graphs` = 名字 → 图的字典（`startRun({template})` 时查表）。**核心只认对象字段，不认模板名**。
- `single` 的**行为与输出逐字不变**：`roleId='worker'`、`nodeId='T-001'`、`handoffId='HO-001'` 全部搬进 `GRAPHS.single`；`buildPrompt(task)` 原样保留（`${task}\n\n完成后直接结束，不需要额外说明。`）。

**理由**

1. AC-28 用 `purity-check` 扫 `src/core,src/daemon` 禁止四个字面量；图数据留在 core 必挂。
2. 默认图是 `single` 时，I1.1 的所有路径只是「数据来源从模块常量变成对象字段」，输出与事件序列可逐字保持（BR-29 / AC-21 / AC-22）。
3. I1.3 的「只加图定义」在结构上成立：新增一张图 = 新增一个数据对象，核心零改动（判定与产物策略按节点字段查表，见 §1.5）。

**被否决**

- **图写成 YAML / JSON 资产文件 + 解析器**：否决。I1.6 才做声明式与校验器；本迭代引入解析器等于提前交付半个 I1.6，且 `purity-check` 白名单 `src/templates/**` 是为代码常量设计的。
- **图硬编码进 `orchestrator.js`（用 `if (template === 'code-loop')`）**：否决。AC-28 直接失败；I1.3 只能复制引擎。
- **模板注册表 / `defineTemplate()` / schema 校验**：否决。范围外（I1.6），本迭代只需要 `getGraph(name)` 一次查表。

### 1.2 决策二：多节点推进器 —— `src/core/advance.js` 纯规划 + `orchestrator.advance()` 执行（C-03）

**结论（分两层，避免循环依赖）**

| 层 | 位置 | 职责 | 是否 IO |
|---|---|---|---|
| 纯规划 | `src/core/advance.js` | `classifyNodeOutcome()` / `planAdvance()` / `checkWakeGate()` / `buildHandoff()` / `nextHandoffId()` | 否（可单测、可被假图驱动） |
| 执行 | `orchestrator.advance(instanceId)`（私有，非导出） | 读最新快照 → 调 `planAdvance` → 建交接包落盘 → `dispatchToNode` → 轮次 +1 → 收尾判定 | 是（CAS / 事件 / 派发） |

**`advance(instanceId)` 的完整算法（顺序固定，实现以此为准）**

```
advance(instanceId):
  前置：调用方已持有 withLock(instanceId)（同一实例串行推进，禁止并发 advance）

  1. loaded = store.load(instanceId)
     失败 → {ok:false, code}
  2. state = loaded.state
     state.halted === true            → {action:'halt'}
     state.state ∈ RUN_DONE_INSTANCE  → {action:'stop'}        // 已终态/已挂起，不再推进
  3. fromNodeId = 最近完成的节点：nodes 中 endedAt 最大且 state ∈ {done, failed, escalated}
  4. outcome = classifyNodeOutcome(state, fromNodeId)
     'passed'       节点 done 且 verdict ∈ {null('none' 判定), pass}
     'verdict-fail' 节点 failed 且 verdict.value==='fail'    // 仅 code-loop 第 1 轮
     'escalated'    节点 escalated                          // 已由 commitEscalation 收尾
     'error'        节点 failed 且 failure.code 非判定类     // single 的旧路径
  5. 已 escalated / halted → {action:'stop'}（升级事务自己负责实例挂起）
  6. edge = edgeFor(graph, fromNodeId, outcome)   // 'passed'→forward|retest；'verdict-fail'→backflow
     无出边：
       graph.terminals 含 fromNodeId → 6.1 一次 CAS：instance running → completed（reason run.completed）
                                       → {action:'complete'}
       否则 → commitEscalation(rounds_exceeded 的防御分支，正常不可达)
  7. gate = checkWakeGate({graph, state, edge, target: edge.to})
     失败 → emit {reason:'wake.rejected', detail:{code}}；返回 {action:'reject', code}
        NO_PENDING_BACKFLOW  : done→running 无「kind=backflow、to=目标、state∈{created,delivered}、
                               wakeConsumedAt===null」的包
        ROUNDS_EXCEEDED     : 目标节点 round >= graph.maxRounds[target]
        TARGET_NOT_ELIGIBLE : 唤醒源与目标角色不匹配（backflow 只能唤 done 的开发；retest 只能唤 failed 的测试）
     **门控用派发前的 round 校验，通过后才 +1**（D-2，顺序不得颠倒）
  8. 幂等：命中待唤醒包时只写 wakeConsumedAt=now（包状态保持 created/delivered，不改 accepted）
  9. 建包：buildHandoff({...}) → handoffs[] 追加一条 state='created'
     → **先落盘**（一次 CAS，expectedState={state:'running', halted:false, rev}）
     → emit handoff created / backflow.constructed（如为回流）
 10. dispatchToNode(instanceId, target, {handoffId, reason:'node.dispatch'})
     a) 目标节点 state ∈ {running,review} → {ok:false, code:'NODE_BUSY'}（AC-32，不改 round）
     b) 目标节点 round += 1；counters.dispatchCount += 1；roundStartedAt = now；startedAt ??= now；state = running
        —— **轮次 +1 与派发计数 +1 都发生在真正派发时，且目标会话没建成也算一次**（需求 §2.5 口径）
     c) adapterFactory.create → initialize → newSession
        失败 → commitEscalation(reasonCode='dispatch_failed', 挂在**接收派发的目标节点**)
              → 实例 suspended（AC-33 / BR-24）
     d) 投递 prompt → tracker.delivered → handoffs[i].state='delivered' → 一次 CAS
     e) 注册新 ctx 到 activeRuns
 11. 返回 {action:'dispatch', ctx, nodeId:target, round}
```

**`finishRun` 的改造（C-03 的落点）**：把现有 `finishRun` 收窄为**单节点收尾** `finishNode(ctx)`：

- 通过：节点 `review→done`、交接包 `accepted→consumed`、`node.endedAt`，**不再** `transition('instance','completed')`，改为返回 `{kind:'passed'}` 交 `driveGraph`；
- 判定不通过（`code-loop` 第 1 轮）：节点 `review→failed`（`note='等待复测'`）、交接包停在 `accepted`，返回 `{kind:'verdict-fail'}`；
- 判定第 2 轮不通过 / 核对失败 / 产物不合格 / 宿主报错：调 `commitEscalation()`，返回 `{kind:'escalated'}`；
- `single` 完全保持 I1.1：通过 → 实例 `completed`；核对不通过 → 节点 `failed` + 实例 `failed`（`review→failed` 在 `single` 保留）。

**实例只在图终节点完成时 `completed`**：唯一写 `instance→completed` 的地点是 `advance` 步骤 6.1；`single` 的终节点就是 `T-001`，因此 I1.1 行为不变。

**被否决**

- **把推进器塞进 `finishRun` 内部递归调用**：否决。`finishRun` 已在 `withLock` 外的后台链上，递归会让 CAS 重试与轮次 +1 的时序不可控，且 `waitForRun` 无法判断「这一轮结束」与「整个实例结束」。
- **用事件回调驱动推进（订阅 `handoff.consumed` 再派发）**：否决。事件总线是审计面，不是调度面；回调里做 CAS 会把失败路径变成「事件已落盘、状态没推进」。
- **每个节点一个 `driveRun`**：否决。`waitForRun`/`earlyReturn` 会被拆成多段，`run.wait` 在第一个节点结束就返回（C-04 要修的正是这个）。

### 1.3 决策三：`run.start` 早返回点与 `run.wait` 完成条件（C-04）

**结论**

- **早返回点固定为 T-001 的 HO-001 `delivered`**：`claimRun()` 现在就在 `delivered` 后返回，**不改早返回位置**；只改「返回之后由谁驱动」——`earlyResult()` 调用 `driveGraph(ctx)` 而不是 `driveRun(ctx)`。
- **`run.wait` 完成条件 = 实例状态 ∈ `RUN_DONE_INSTANCE`（`completed/failed/cancelled/interrupted/suspended`）∪ `halted === true`**。`waitForRun` 的 waiter 由 `driveGraph` 在**整图结束**时 resolve，不再由第一个 `finishNode` resolve。
- `single` 语义不变：`suspended`/`halted` 在 `single` 永不产生，`RUN_DONE_INSTANCE` 对 `single` 等价于原 `TERMINAL_INSTANCE`。

**改造点（精确到函数）**

| 现有实现 | 改造 |
|---|---|
| `driveRun(ctx)`（`orchestrator.js:1066`） | → `driveGraph(instanceId, firstCtx)`：循环 `finishNode → advance`，直到 `action ∈ {complete, stop, halt, reject}`；**唯一** resolve `runWaiters` 的地方 |
| `earlyResult(ctx)`（`:1087`） | 改调 `driveGraph`；返回结构不变（`{ok, instanceId, nodeId, sessionId}`） |
| `waitForRun`（`:1154`） | ① `TERMINAL_INSTANCE` → `RUN_DONE_INSTANCE`；② 无 waiter 时：`state ∈ RUN_DONE_INSTANCE || halted === true` 立即返回快照，否则 `NOT_RUNNING`；③ 有 waiter 时在 `halted` 落盘后立即 resolve（`driveGraph` 负责），不额外轮询 |
| `activeRuns`（`:119`） | 值从「单节点 ctx」变成「图运行句柄」：`{ instanceId, currentCtx, cancelled, finished }`；`cancelLive` 取 `currentCtx` 发 `session/cancel` |
| `runWaiters`（`:121`） | 生命周期不变，resolver 从 `driveRun` 移到 `driveGraph` |

**`orch run` 的收尾分支（A-3 / A-4）**

| 快照 | 输出 | 退出码 |
|---|---|---|
| `completed` | 节点行 ×N → 交接包行 → `升级 —` | 0 |
| `suspended` | **恰好三行**（A-4 挂起） | 4 |
| `halted === true`（`state='running'`） | **一行错误 + 三行收尾**（A-4 停止推进） | 5 |
| `interrupted` / `failed` | 沿用 I1.1 路径（`single`） | 1 |

**被否决**

- **`run.start` 改成等整图结束再返回**：否决。违反 AC-01「第 1 行等于 `实例 INST-001 · 运行中 · 模板 编码闭环`」与 NFR-01b（5 秒内看到执行中）。
- **`run.wait` 轮询 `state.json`**：否决。与单一写者原则冲突（CLI 不读盘），且 30 分钟窗口内轮询会放大 IO。
- **`halted` 单独加一个 IPC 方法**：否决。`instance.get` 已返回快照，`halted` 只是快照字段；多一个方法等于多一条要维护的契约。

### 1.4 决策四：持久化 v2 与 CAS（C-01 / C-02 / C-07）

**结论**

- `state.json` 升 `schemaVersion: 2`，完整形状**直接引用需求 §3.3 D-6（v15 已并入 `rev`、`escalations[].defects[]`、`counters.dispatchCount`）**；本文件 §3.1 的样例与 D-6 逐字段一致，三个字段的落地口径见 §3.1 末尾「相对 D-6 的增量」。
- **`store.save(id, state, {expectedState})` 的兼容策略**：

```
expectedState:
  string        → v1 旧语义：比较 disk.state.state（旧调用方零改动，仍兼容）
  {state?, halted?, rev?}
                → v2 新语义：逐个比较**提供了的字段**
                  state  → disk.state.state
                  halted → Boolean(disk.halted)
                  rev    → disk.rev ?? 0（整快照版本；缺失的历史快照按 0 处理）
冲突 → {ok:false, code:'STORE_CONFLICT', params:{expected, actual:{state,halted,rev}}}，**不写**
成功 → state.rev = (disk.rev ?? 0) + 1（由 store 统一递增并落盘），返回 {ok:true, updatedAt, rev}
```

- **旧调用传 `string` 仍兼容**：I1.1 的三处 `saveState` 不改也能跑（只比实例状态）；新代码（`advance` / `commitEscalation` / `applyCancel` / `transit`）一律传 `{state, halted, rev}`，`rev` 是唯一的整快照版本依据。传对象时**只比较显式提供了的键**，便于「只写 `halted:true`」这类窄条件写。

- **`transit(instanceId, object, to, {nodeId|sessionId|handoffId|escalationId})`**：v2 必须按 id 定位数组元素；`smFor` 显式映射五张表；未知 `object` 报 `UNKNOWN_OBJECT` 且**不回退**到 instance SM。

```
transit(instanceId, 'node',        'escalated', {nodeId:'T-002'})
transit(instanceId, 'session',     'idle',      {sessionId:'sess-…'})
transit(instanceId, 'handoff',     'delivered', {handoffId:'HO-003'})
transit(instanceId, 'escalation',  'voided',    {escalationId:'ESC-001'})
transit(instanceId, 'instance',    'suspended', {})
定位失败（数组里没有该 id）→ {ok:false, code:'UNKNOWN_OBJECT'|'UNKNOWN_STATE'}，不写任何文件
```

**理由**

1. D-3 的「一次 CAS 落盘」在当前代码不可实现：`instance-store.js:138-147` 只比 `state.state` 字符串，传对象永远冲突（S1）。
2. 只比实例状态时，「取消」与「升级」两个并发写都会看到 `running` 并都成功 → 丢失更新，BR-18「取消优先」没有实现基础。
3. 按 id 定位是 v2 的唯一寻址方式；`state.node`/`state.session`/`state.handoff` 在 v2 下是 `undefined`（S2 / S6）。

**被否决**

- **每次写整文件、不加 `rev`**：否决。并发写丢更新（上面第 2 条），且 AC-37「取消优先」不可复现。
- **给每个对象单独存一个文件（`nodes/T-001.json`…）**：否决。改动面覆盖 store / list / 原子写 / 损坏处理，`state.json` 的原子性优势丢失；I1.12 的审计还要跨文件拼。
- **`expectedState` 只接受对象、不兼容 string**：否决。`test/wp8/f3-cas.test.js` 的旧断言会红，且 I1.1 的三处 `saveState` 全部要改，回归面翻倍。
- **把 `rev` 放在 `updatedAt` 里（用时间戳当版本）**：否决。同毫秒两次写会碰撞；整数单调递增才可判等。

### 1.5 决策五：判定与升级的事务边界（D-2 / D-3 / C-08 / C-13）

**结论**

- **判定读取全部在 `src/core/verdict.js`**：schema 校验、缺陷清单、证据可打开、本轮新写（mtime > `nodes[].roundStartedAt`）四件事**只在这里**做；核心拿到的只有 `{ok:true, verdict}` 或 `{ok:false, reasonCode, reasonDetail}`，不自己拼文案。
- **产物核对在 `src/core/verify-artifact.js`**：`code-loop` 走新增的 `verifyDeclaredArtifacts({cwd, declared, roundStartedAt, clock})`（固定 `产物：` 格式 + mtime + 空文件文案）；`single` 保留 `verifyArtifacts()` / `extractDeclaredArtifacts()` **原样不动**（M-11）。
- **升级写入 `commitEscalation()` 一次 CAS 落盘**：

```
内存里同时改好四件事：
  escalations[] 追加一条 pending（幂等键 (nodeId, round)）
                 defects = verdict.defects[]（无判定 / 无缺陷时 []，类型同回流交接包）
  节点 → escalated（note 清空，endedAt=now）
  会话存在时 → escalated（quarantined=true，quiescing=true；首派建会话失败时没有会话，跳过）
  实例 → suspended
→ 一次 save {expectedState:{state:'running', halted:false, rev}}
→ 成功：按 escalation.created → node → session（存在时）→ instance（reason core.suspend）顺序发事件
→ 失败：**整体丢弃内存改动**（重新 load），再用**一次独立 CAS 只写 halted:true**
        → emit {reason:'run.halted'}；实例保持 running，节点保持升级前状态（review/running/done/pending/failed）
```

- **`MAESTRO_FAULT=state_write:escalation` 只作用于 `commitEscalation()` 的那一次 `saveState`**；`halted` 的独立写入必须成功；`store.save` **不感知** `MAESTRO_FAULT`（C-13 / S13）。
- **会话状态守卫（C-08）**：`normalizer` 增加 `escalated` 终态守卫——进入 `escalated` 后除 `onCancelled` 外任何 `reduce` / `onPermission*` / `onPromptSettled` 都保持 `escalated`；升级事务置 `quarantined=true`。

**理由**

- 四步串行写在第 2~4 步失败会留下「节点已升级、实例仍 running」，而 `escalated` 没有回边（D-1）→ 不可自愈。
- 故障注入若放在 `store.save` 全局，`halted` 也写不进，AC-38 无法复现（要么全成功、要么全失败）。

**被否决**

- **升级写入失败时把节点落成 `failed`**：否决。违反 BR-25 / AC-38（节点必须保持 `review` 并显示 `待校验（升级未记录）`）。
- **先写 `halted`、再尝试升级**：否决。正常路径会多一次写，且 `halted` 与 `suspended` 的互斥不变式要说两次。
- **用 `transit()` 逐步写四个对象**：否决。每次 `transit` 自带一次 `save`，正是 D-3 明令禁止的四次独立落盘。

### 1.6 决策六：CLI 渲染的分流（C-10 / C-11）

**结论**

- `render.js` 的每个渲染函数按 `template` 分流；**`single` 保持 I1.1 逐字版式**，`code-loop` 走新格式：

| 函数 | `single` | `code-loop` |
|---|---|---|
| `renderInstanceLine(snapshot)` | `实例 INST-001 · 运行中`（无模板） | `实例 INST-001 · 运行中 · 模板 编码闭环`；`halted` 时 `· 已停止推进` 在模板前 |
| `renderNodeLines(snapshot,{template})` | 1 行，无节点号/角色/轮次，`失败` 内联原因 | N 行：`节点 T-001 开发 已完成 · 第 1 轮 · 耗时 1m02s`；带限定词与判定 |
| `renderSessionLine(snapshot,now,{template})` | 取 `snapshot.session`（v2 取最新一条） | 同左，六种分支 |
| `renderHandoffLines(snapshot,{template})` | 无方向：`交接包 HO-001  已构造   10:30:02` | 带方向：`交接包 HO-001  开发→测试  已构造   10:30:02`（号/方向/状态之间各 2 空格） |
| `renderEscalationBlock(snapshot)` | 不打印（`升级 —` 也不打） | 无升级 → `升级 —`；有升级 → 1 + 4 行明细 |
| `renderEventLine(event,{template})` | I1.1 版式（无 seq、原因原样英文） | `[#seq] HH:mm:ss  层 id  中段  原因 中文`；`node.dispatch` 中段固定 `派发 → 执行中`；`escalation.to==='pending'` 中段 `待处理`；`result==='rejected'` **两种模板都不加 seq** |
| `renderCancelLines(result)` | 接受旧 `{session,node,handoff}` | 接受数组 `{sessions,nodes,handoffs,escalations}`，按 会话 → 节点 → 交接包 → 升级 展开 |

- **`labels.js` 是唯一中文来源**，新增：`ROLE_LABEL` / `TEMPLATE_LABEL` / `ESCALATION_LABEL` / `REASON_LABEL`（11 新 + I1.1 21 旧，逐字按 D-5）/ `HANDOFF_DIRECTION` / `NODE_QUALIFIER` / `INSTANCE_STOPPED_SUFFIX` / `BACKFLOW_DEFECT_LINE` / `BACKFLOW_RETEST_LINE` / 9 条新错误码文案。
- **错误模板占位符白名单**从 `cause,path,step,raw,reason,state` 扩到 `+ name,instanceId,i,summary,evidence`；`renderError` 只做机械替换，`TEMPLATE_UNKNOWN` / `DIR_BUSY` / `BACKFLOW_DEFECT_LINE` 必须走该机制（C-11 / S11）。

**分流的准确表述（需求 v15 M-12 / C-10 已对齐）**：`code-loop` 的事件行加 `[#seq]` 并把原因换成中文；`single` 保持 I1.1 版式（无 seq、原因原样英文）；`result==='rejected'` 两种模板都不加 seq（保 I1.1 AC-26）。因此 `renderEventLine` 现在只收 `event`（`render.js:346`）、没有模板上下文时必须显式接收 `{template}`，否则无法二选一。

**被否决**

- **全局给所有模板加 `[#seq]` 并改 BR-29 / AC-21**：否决。AC-21/22 是真实面回归，改断言等于把「I1.1 不回归」这条验收删掉；v15 已按 `code-loop` 单侧加 seq 定稿。
- **按 `snapshot.template` 猜（不传 template 入参）**：否决。事件行来自 `instance.events` 的独立数组，快照不在手边；`renderEventLine` 必须显式接收 `{template}`。
- **让 `main.js` 拼中文**：否决。I1.1 已确立「中文只在 labels/render」，`main.js` 拼串会让 AC 断言散落到命令层。

### 1.7 决策七：夹具形态 —— driver 起现场 + mock agent 演宿主，都走产品链路

**结论**

| 夹具 | 形态 | 关键约束 |
|---|---|---|
| `test/fixtures/code-loop-driver.mjs` | **现场准备 + 驱动**：写 `.mock/cursor.json`、`.orch/hosts/mock.json`，通过**产品 IPC** 调 `run.start({template:'code-loop', hostId:'mock'})`，按 `--stop-after` / `--keep` 保活 | **不直接写 `state.json`**；只写 `.mock/` 与 `.orch/hosts/` |
| `test/fixtures/mock-acp-agent.js --root --scenario` | **每次派发一个新进程的 ACP agent**：启动即原子消费 `cursor.json` 第 n 步（`tmp`+`rename`，**消费点在 `session/new` 之前**），写 `prompts/<n>.json`，按 step 造产物/判定/延迟/失败 | 由 `host-config → stdio-transport → acp-client` 拉起；**不带 `--root/--scenario` 时，I1.1 的 12 个开关与缺省行为完全不变**（AC-22） |
| `test/fixtures/call-seam.mjs` | 调核心侧接缝，单行 JSON 打 stdout | 走**仅 `NODE_ENV=test` 挂载**的 IPC 方法 `test.dispatch` / `test.escalate` |
| `test/fixtures/attempt-transition.mjs` | 直接 import 状态机提交非法迁移（核心停止时跑） | 新增 `--node <nodeId>`，v2 从 `nodes[]` 定位（缺省 `nodes[0]`） |
| `test/fixtures/purity-check.mjs` | 源码字面量扫描 | `--dirs` / `--forbid`；白名单 `src/templates/**`、`test/**`、`docs/**` |

**driver 的启动顺序（固定）**

```
1. 解析 --root（realpath）；--reset → 删 <root>/.mock/ 全部内容
2. 写 <root>/.mock/cursor.json = {"next":1}
3. 写 <root>/.orch/hosts/mock.json（launch.command = node 绝对路径；args 全绝对路径）
4. --prepare-only → 退出码 0（不启核心、不建实例）
5. best-effort core.stop（≤5s）：保证 NODE_ENV / MAESTRO_TEST_PAUSE / MAESTRO_TEST_STOP_AFTER /
   MAESTRO_FAULT 在**冷启动**被读取（这些变量只在核心进程启动时读一次）
6. client.connect({ensure:true}) → run.start({cwd, task, template:'code-loop', hostId:'mock'})
7. --keep → 保持进程与核心；否则 run.wait(60s) 后打一行摘要退出
8. 全部退出路径都**不删** .orch/instances（后续 orch status 要用）
```

**被否决**

- **driver 直接改 `state.json` 造中间态**：否决。AC-05/34/37/44 要证明的是产品链路（会话 → 交接包 → 判定），改盘等于自证。
- **mock agent 与 driver 合成一个脚本**：否决。mock 是宿主侧、每派发一个进程；driver 是客户端侧、单进程。合并后 `--scenario` 的进程模型无法成立。
- **用进程内假 adapter 代替 mock agent**：否决。`host-config → stdio → acp-client` 这条链路正是验收对象（AC-43 的 `prompts/<n>.json` 只能从真实进程侧写出）。
- **`--prepare-only` 里顺便启核心**：否决。AC-12/38 需要由 `orch run` 自己发起，prepare 阶段启核心会让 env 与实例号不可控。

### 1.8 决策八：测试接缝（M-14）—— 运行时条件导出 + 仅 test 的 IPC 路由

**结论**

- `createOrchestrator` 在 `NODE_ENV === 'test'` 时**额外**返回两个方法（条件展开，生产构建的返回对象里没有这两个键）：

```js
...(isTest ? { dispatchToNode, escalateOnce } : {})
```

- `src/daemon/server.js` 在 `NODE_ENV === 'test'` **且** orchestrator 暴露了这两个方法时，挂载两条路由：`test.dispatch` / `test.escalate`；否则不注册（未知方法沿用现有 `UNKNOWN_METHOD`）。
- 暂停点 / 定点停止 / 故障注入（全部只在 `NODE_ENV=test` 生效，核心启动时读一次）：

| 变量 | 触发位置 | 产出 |
|---|---|---|
| `MAESTRO_TEST_PAUSE=after_accepted[:<nodeId>]` | 核心把该节点会话置 `accepted` 后（**只在首次 created/delivered→accepted**） | 写 `.mock/paused`，轮询 `.mock/release` |
| `MAESTRO_TEST_PAUSE=after_output[:<nodeId>]` | 会话回合结束、开始核对前（节点已 `review`、会话已 `waiting_dependency`） | 同上 |
| `MAESTRO_TEST_PAUSE=after_verdict` | 读完判定、**节点已 `review→failed`**、回流包已落盘 `created`、投递前 | 同上 |
| `MAESTRO_TEST_STOP_AFTER=<n>` | 第 n 步核对完成后、派发第 n+1 步前 | 写 `.mock/stopped-after-<n>`，轮询 `.mock/release` |
| `MAESTRO_FAULT=state_write:escalation` | `commitEscalation()` 的唯一一次 CAS | 返回 `ESCALATION_WRITE_FAILED`；`halted` 独立写仍成功 |

- **暂停用异步轮询（100ms）**，不阻塞事件循环：暂停期间 `orch status` / `orch cancel` 必须可用（AC-37 依赖这一点）。
- 进入暂停点时若 `.mock/release` **已存在** → 视为已放行，不重复停（AC-34/36/37/44 只放行一次）。
- `call-seam.mjs` 的返回原样 `JSON.stringify` 成**单行**打 stdout：`{"ok":true,"escalationId":"ESC-001","reused":true}`。

**为什么需要 IPC 路由**：AC-26/27/32 的对象是**正在跑的核心**（"且核心在跑"），而接缝是进程内导出；`call-seam.mjs` 是独立进程，只能经 IPC 触达。

**被否决**

- **`if (process.env.NODE_ENV === 'test')` 写在方法体内部（始终导出）**：否决。生产对象上仍会出现可调用的 `dispatchToNode`，等于给外部留了一个绕开门控的入口。
- **构建期剔除（tree-shaking / 单独入口）**：否决。项目无构建步骤（I1.1 决策：零依赖、无编译），只能运行时守卫。
- **把接缝做成 CLI 隐藏命令**：否决。会污染产品命令面与 usage，且 `parseArgs` 的未知参数路径已有明确语义（退出码 2）。

### 1.9 评审接缝 S1~S13 与契约 C-01~C-14 的落位（逐条，不得遗漏）

| 编号 | 落点 | 由谁实现 | 验收 |
|---|---|---|---|
| **S1 / C-01** | `store.save` 的 `expectedState` 双形状 + `rev` 递增 | WP-2 | AC-37/38（取消优先、升级 halt）；`f3-cas` |
| **S2 / C-02** | `smFor` 五表显式映射；`transit` 按 id 寻址；`UNKNOWN_OBJECT` | WP-1（表）+ WP-4（transit） | AC-25/26/36/42 |
| **S3 / C-03** | `advance()` 图驱动；实例只在终节点 `completed` | WP-3（plan）+ WP-4（执行） | AC-01/02/03/05/45/46 |
| **S4 / C-04** | 早返回固定 HO-001 `delivered`；`run.wait` 等 `RUN_DONE_INSTANCE ∪ suspended ∪ halted`；`driveGraph` | WP-4 | AC-01/07/12/38 |
| **S5 / C-05** | `run.start` 白名单加 `template`；`instance.cancel` 原样透传四数组；CLI 发 `hostId/template` | WP-5 | AC-11/31/42 |
| **S6 / C-06** | 会话读写统一 `findSession()`；`snapshotOf().session` 取最新；只渲染一条 | WP-4 | AC-05/11/39/44 |
| **S7 / C-07** | `store.list()` 投影增 `schemaVersion/template/cwd/pendingEscalations`；列表行后缀 | WP-2 + WP-5 | AC-09/20/40 |
| **S8 / C-08** | `normalizer` 的 `escalated` 终态守卫 + `quarantined` | WP-4 | AC-39（升级后无「会话 执行中」） |
| **S9 / C-09** | `withLock('@dir:'+realpath(cwd))` 包住「列目录 → 判未结束 → 分配 → 首次落盘」 | WP-4 | AC-40（并发下同目录唯一） |
| **S10 / C-10** | `renderEventLine(event,{template})`；`rejected` 两模板都不加 seq | WP-5 | AC-02/15/24 + AC-21/22 |
| **S11 / C-11** | 占位符白名单 `+ name/instanceId/i/summary/evidence` | WP-5 | AC-23/24/40 |
| **S12 / C-12** | 图与角色常量放 `src/templates/**`；`src/core,src/daemon` 零模板字面量 | WP-3 | AC-28 |
| **S13 / C-13** | 故障注入只作用于 `commitEscalation()` 的唯一 CAS；`halted` 独立写 | WP-3（committer）+ WP-4（注入开关） | AC-38 |
| **C-14** | D-8 补 `wp1/instance-store`、`wp5/ipc-server`、`wp7`；三处「新增用例」不改旧断言 | WP-1/2/4/5 各自的测试清单 | 216 用例全绿或按 D-8 改写 |

---

## 2. 模块划分与文件级接口契约

> 约定：返回统一 `{ok:true, …}` / `{ok:false, code, detail|params}`；时间一律 ISO-8601 UTC 毫秒字符串；`code` 一律大写下划线。**伪签名不是实现**，函数体由工作包补。

### 2.1 新增 `src/templates/index.js`（WP-3）

**职责**：内置角色、两张内置图、图查询、初始节点数组生成。**唯一允许出现 `code-loop` / `developer` / `tester` / `coordinator` 字面量的产品目录**（AC-28 白名单）。

```js
export const ROLES = {
  developer:   { roleId:'developer',   labelKey:'developer'   },
  tester:      { roleId:'tester',      labelKey:'tester'      },
  coordinator: { roleId:'coordinator', labelKey:'coordinator', dispatchable:false }
};

export const GRAPHS = {
  single: {
    id:'single', showTemplate:false, entry:'T-001', terminals:['T-001'],
    maxRounds:{ 'T-001':1 },
    nodes:[{ nodeId:'T-001', roleId:'worker', title:null,
             artifactPolicy:'heuristic', judge:'none', wakeFrom:[] }],
    edges:[]
  },
  'code-loop': {
    id:'code-loop', showTemplate:true, entry:'T-001', terminals:['T-002'],
    maxRounds:{ 'T-001':2, 'T-002':2 },
    nodes:[
      { nodeId:'T-001', roleId:'developer', title:'开发',
        artifactPolicy:'declared', judge:'none',   wakeFrom:['backflow'] },
      { nodeId:'T-002', roleId:'tester',    title:'测试',
        artifactPolicy:'verdict',  judge:'verdict', wakeFrom:['retest'] }
    ],
    edges:[
      { from:'T-001', to:'T-002', kind:'forward'  },
      { from:'T-002', to:'T-001', kind:'backflow', requiresHandoff:true },
      { from:'T-001', to:'T-002', kind:'retest'   }
    ]
  }
};

getGraph(name)        -> object | null                 // 未知模板返回 null（不抛）
defaultGraph()        -> GRAPHS.single
initialNodes(graph, {stateAt, clock}) -> Array<node>   // 每项按 D-6 的 nodes[] 形状，state='pending'
promptFor({graph, node, state, handoff, task}) -> string
```

`promptFor` 的三条模板（内容由模板层持有，核心不拼）：

- 正向包：任务原文 + `产物：<路径>` + 「把结论写到 `out/verdict.json`」要求；
- 回流包：任务原文 + 每条缺陷 + 证据 + 复测要求；
- 复测包：任务原文 + 产物路径 + `上一轮缺陷：<n> 条`。

### 2.2 新增 `src/core/graph.js`（WP-3）

**职责**：对图对象的**只读查询**，不含 IO、不含状态。

```js
findNode(graph, nodeId)                     -> node | null
initialNode(graph)                          -> node
outEdges(graph, nodeId)                     -> edge[]
edgeFor(graph, nodeId, outcome)             -> edge | null
   // outcome: 'passed' → kind ∈ {forward, retest}（按目标节点当前状态择一）
   // outcome: 'verdict-fail' → kind === 'backflow'
isTerminal(graph, nodeId)                   -> boolean
maxRoundsOf(graph, nodeId)                  -> number
wakeSourceOf(graph, nodeId, kind)           -> 'done' | 'failed' | null
validateGraph(graph)                        -> {ok:true} | {ok:false, code:'GRAPH_INVALID', detail}
   // 只给 test/templates/fake-graph.test.js 用；不是加载器、不是注册表
```

### 2.3 新增 `src/core/advance.js`（WP-3）

**职责**：推进决策的**纯函数**部分（可被假图单测）。

```js
classifyNodeOutcome(state, nodeId)
  -> 'passed' | 'verdict-fail' | 'escalated' | 'error'

checkWakeGate({ graph, state, edge })
  -> {ok:true, wakeHandoffId:string|null}
   | {ok:false, code:'NO_PENDING_BACKFLOW'|'ROUNDS_EXCEEDED'|'TARGET_NOT_ELIGIBLE'}

nextHandoffId(handoffs) -> 'HO-001' | 'HO-002' | …      // 全局连续、不复用

buildHandoff({ graph, state, edge, round, defects, retestRequirement, clock })
  -> {
       handoff: {                                     // 直接进 handoffs[]（D-6 形状）
         handoffId, edge:{from,to,kind}, state:'created', createdAt,
         deliveredAt:null, acceptedAt:null, consumedAt:null,
         rejectedAt:null, rejectReason:null, wakeConsumedAt:null,
         acceptedSignal:null, ambiguityWindowMs:null,
         defects:[{summary,evidence}], note:null
       },
       promptText: string                              // 只用于本次派发，不落 state.json
     }

planAdvance({ graph, state, fromNodeId, outcome, clock })
  -> {action:'dispatch', edge, targetNodeId, round, handoffDraft, promptText}
   | {action:'complete'}
   | {action:'stop'}
   | {action:'reject', code, detail}
```

**不变式**（单测必须覆盖）：`planAdvance` 不读文件、不写文件、不改入参；同一 `(graph,state,fromNodeId,outcome)` 必得同一结果。

### 2.4 新增 `src/core/verdict.js`（WP-3）

**职责**：判定文件的最小校验（存在 / 本轮新写 / 可解析 / 取值 / 缺陷清单 / 证据可打开）。**不写状态、不发事件**。

```js
export const VERDICT_PATH = 'out/verdict.json';

readVerdict({ cwd, roundStartedAt, clock })
  -> { ok:true,
       verdict:{ value:'pass'|'fail', defects:[{summary,evidence,absPath,bytes}],
                 defectCount, verdictPath:'out/verdict.json', readAt } }
   | { ok:false,
       code:'VERDICT_FAILED',
       reasonCode:'verdict_missing'|'verdict_stale'|'verdict_invalid',
       stage:'missing'|'stale'|'unparsable'|'no_defects'|'pass_with_defects'|'evidence_unreadable',
       reasonDetail:string,          // 逐字中文（D-5 / §2.6）
       verdictPath:'out/verdict.json' }

parseVerdict(rawText)   -> {ok:true, verdict} | {ok:false, stage:'unparsable'}
verifyEvidence(cwd, defects) -> {ok:true, defects} | {ok:false, stage:'evidence_unreadable'}
```

**六种失败分类（顺序固定，不可交换）**

| 顺序 | 检查 | `stage` | `reasonCode` | `reasonDetail`（逐字） |
|---|---|---|---|---|
| 1 | 文件存在 | `missing` | `verdict_missing` | `核对失败：未找到判定文件 out/verdict.json` |
| 2 | mtime > `nodes[].roundStartedAt` | `stale` | `verdict_stale` | `核对失败：判定文件不是本轮新写 out/verdict.json` |
| 3 | JSON 可解析且 `verdict ∈ {pass,fail}` | `unparsable` | `verdict_invalid` | `核对失败：判定文件不可解析` |
| 4 | `fail` ⇒ `defects` 非空且每条 `summary`/`evidence` 非空 | `no_defects` | `verdict_invalid` | `核对失败：判定为不通过，但没有缺陷清单` |
| 5 | `pass` ⇒ `defects` 为空数组 | `pass_with_defects` | `verdict_invalid` | `核对失败：判定为通过，但缺陷清单非空` |
| 6 | 每条 `evidence` 文件存在 | `evidence_unreadable` | `verdict_invalid` | `核对失败：缺陷证据不可解析` |

### 2.5 新增 `src/core/escalation.js`（WP-3）

**职责**：升级实体的纯构造 + **一次 CAS** 的提交器（IO 全部由注入的 `load/save/emit` 提供，便于故障注入与单测）。

```js
nextEscalationId(escalations)                        -> 'ESC-001' | 'ESC-002' | …
findPending(escalations, {nodeId, round})            -> escalation | null     // 幂等键
buildEscalation({ escalations, nodeId, round, reasonCode, reasonDetail,
                  defects = [], clock })
  -> { escalationId, nodeId, round, reasonCode, reasonDetail,
       defects:[{summary,evidence}], state:'pending', createdAt, voidedAt:null }
  // defects 类型同回流交接包 handoffs[].defects[]；来源是本次判定的 verdict.defects[]，
  // 无判定 / 无缺陷（含 dispatch_failed、artifact_* 等非判定原因）一律 []，不省略字段

createEscalationCommitter({ load, save, emit, clock, fault })
  -> { commitEscalation }

committer.commitEscalation({ instanceId, nodeId, round, reasonCode, reasonDetail,
                             verdict, liveState })
  -> { ok:true, escalationId, reused:boolean }
   | { ok:false, code:'ESCALATION_WRITE_FAILED'|'STORE_CONFLICT', params }
```

**语义**

- 幂等：同 `(nodeId, round)` 已存在 `pending` → 直接 `{ok:true, escalationId, reused:true}`，**不新增记录、不写迁移事件**（AC-27）。
- 成功：一次 CAS `{state:'running', halted:false, rev}` → 事件顺序 `escalation(created→pending, reason escalation.created)` → `node(→escalated)` → `session(→escalated，会话存在时)` → `instance(→suspended, reason core.suspend)`。
- 失败：重新 `load` 覆盖内存（丢弃全部升级改动）→ 独立 CAS 只写 `halted:true` → `emit {reason:'run.halted'}` → 返回 `ESCALATION_WRITE_FAILED`。

### 2.6 修改 `src/core/orchestrator.js`（WP-4，**唯一负责人**）

**职责**：从「单节点单次」升级为「图驱动多节点」，同时保持 `single` 行为逐字不变。

```js
createOrchestrator({
  store, bus, adapterFactory, verify = defaultVerify, clock, generation,
  permissionPolicy, env,
  graph        = defaultGraph(),     // 新增：本次运行的图
  graphs       = GRAPHS             // 新增：模板名 → 图（startRun 用）
}) -> orch

orch.startRun({ cwd, task, instanceId?, hostId='dsh', template?, onProgress?, earlyReturn? })
  -> {ok:true, instanceId, nodeId, sessionId}                        // earlyReturn
   | {ok:true, snapshot}                                             // 同步跑完（single）
   | {ok:false, code:'TASK_EMPTY'|'TEMPLATE_UNKNOWN'|'PRODUCT_LINE_MISSING'|
        'DIR_BUSY'|'INSTANCE_RUNNING'|'INSTANCE_SUSPENDED'|'INSTANCE_TERMINAL'|
        'LEGACY_READ_ONLY'|'NODE_BUSY'|'CWD_NOT_WRITABLE'|'DSH_SPAWN_FAILED', params}

orch.waitForRun({instanceId, timeoutMs})   -> {ok:true, snapshot} | {ok:false, code:'WAIT_TIMEOUT'|'NOT_RUNNING'}
orch.cancel({instanceId})                  -> {ok:true, nodes, sessions, handoffs, escalations}
                                            | {ok:false, code:'CANCEL_NOT_NEEDED'|'LEGACY_READ_ONLY'|'STATE_CORRUPT'}
orch.getStatus({instanceId})               -> {ok:true, snapshot}
orch.listInstances()                       -> {ok:true, items}
orch.reconcileOnBoot({generation})         -> {ok:true, interrupted[]}   // 跳过 v1 / suspended
orch.interruptAll({reason})                -> {ok:true, interrupted[]}   // 跳过 CORE_IMMUTABLE_INSTANCE
orch.dispose()                             -> Promise<void>

// 仅 NODE_ENV==='test' 时额外返回：
dispatchToNode(instanceId, nodeId) -> {ok:true, instanceId, nodeId, round, sessionId}
                                    | {ok:false, code:'NODE_BUSY'|'WAKE_REJECTED', detail:{code}}
escalateOnce(instanceId, nodeId)   -> {ok:true, escalationId, reused}
```

**`startRun` 的检查顺序（D-4，不得交换）**

```
A. template 查表：graphs[template] 不存在 → TEMPLATE_UNKNOWN（业务层，退出码 1）
B. task 全空白 → TASK_EMPTY（code-loop）；single 沿用既有 UNKNOWN_ERROR（BR-29）
C. code-loop 且任务无「产物：」行 → PRODUCT_LINE_MISSING
D. 带 --instance：
   1) 旧格式 → LEGACY_READ_ONLY
   2) 仅 single 且节点 ∈ {running,review} → NODE_BUSY
   3) state==='running' → INSTANCE_RUNNING
   4) state==='suspended' → INSTANCE_SUSPENDED
   5) TERMINAL_INSTANCE → INSTANCE_TERMINAL
   6) 同目录另有未结束实例 → DIR_BUSY
E. 不带 --instance：同目录已有未结束 code-loop 实例 → DIR_BUSY
```

**落盘顺序（`code-loop`）**：先落盘实例（`created` + `nodes[]` 两行 + `template` + `state.rev`）→ 置 `running`（发 `run.started`）→ 派发 T-001。`single` 沿用「preflight 失败不落盘」。

**`counters.dispatchCount` 的写点（唯一）**：`dispatchToNode` 在 `round += 1` 的同一次内存修改里 `counters.dispatchCount += 1`，**会话没建成也算一次**（与「轮次 +1 发生在真正派发时、目标会话没建成也算」同一口径），随后随该次 CAS 落盘。它供 **AC-24 的事件序号**与**「整轮第 n 次派发」断言**使用（`orch status --events` 的 `[#seq]` 定位、`node.dispatch` 的第 n 次与 `detail.round` 对账）；`eventSeq` 只增不减、与 `dispatchCount` 各记各的，不得互相代替。

**`transit` 的最终签名与 CAS 语义**

```js
transit(instanceId, object, to, {
  nodeId?, sessionId?, handoffId?, escalationId?,   // 按 object 取其一
  emit, state, reason, detail
}) -> {ok:true, from, to, repeat?} | {ok:false, code, from, to}
```

1. 每次以磁盘最新快照为 `from` 重新校验（内存与磁盘分叉先按磁盘校正）；
2. 非法 → 落 `result:'rejected'、reason:'illegal_transition'`，磁盘不动；
3. 合法 → 改内存 → `save(..., {expectedState:{state,halted,rev}})`；
4. `STORE_CONFLICT` → 重新 load 重试（最多 3 次）→ 仍冲突落 `store.conflict` 并放弃。

**`applyCancel` 的最终形状**

```js
applyCancel(instanceId, state, emit, ctx)
  -> {ok:true, nodes:[…], sessions:[…], handoffs:[…], escalations:[…]}
```

- 遍历 `sessions[]`：非 `idle` → `idle`，`quarantined=true`；
- 遍历 `nodes[]`：`CANCELABLE_NODE={pending,running,review,failed,escalated}` → `cancelled`；**删除** `review→failed` 特判与 `cancelled_in_review` note；`endedAt` 仅在从未派发时不写（供「不显示耗时」）；
- 遍历 `handoffs[]`：`CANCELABLE_HANDOFF={created,delivered,accepted}` → `rejected` + `rejectReason='withdrawn'`；`consumed/rejected` 不动；
- 遍历 `escalations[]`：`pending → voided`（`voidedAt`）；
- 实例 → `cancelled`；**一次 CAS 落盘后再逐条 emit**（与 D-3 同构，避免中途失败留下半截）。

**`snapshotOf(state)` 的变化**：`session` 取 `sessions[]` 中 `createdAt` 最大者（数组按创建顺序持久化）；派生 `sessionIdleMs/sessionStalled` 用该条；新增 `pendingEscalations`（`escalations.filter(state==='pending').length`）。

### 2.7 修改 `src/core/state-machine.js`（WP-1）

```js
export const INSTANCE_STATES = [...,'suspended'];            // 7 态
export const NODE_STATES     = [...,'escalated'];            // 不变（7 态）
export const HANDOFF_STATES  = [...];                        // 7 态不变
export const ESCALATION_STATES = ['pending','voided'];

createInstanceSM / createNodeSM / createHandoffSM / createEscalationSM / createSessionSM
// 五个 SM 同形：can / assert / apply / isTerminal / definedOnly
```

**节点表（I1.2 运行表，10 条新增边）**

| from | to | 门控 |
|---|---|---|
| `pending` | `running`、`escalated`、`cancelled` | 轮到它 / 首派建会话失败（仅 code-loop）/ 取消 |
| `running` | `review`、`failed`、`escalated`、`cancelled` | 出料 / 宿主报错（仅 single）/ 宿主报错或会话中途失效（仅 code-loop）/ 取消 |
| `review` | `done`、`failed`、`escalated`、`cancelled` | 核对通过 / 核对不通过（仅 single）/ 判定不通过第 1 轮（code-loop）/ 核对失败或第 2 轮不通过 / 取消 |
| `done` | `running`、`escalated` | 被回流唤醒（仅开发）/ 回流派发失败 |
| `failed` | `running`、`escalated`、`cancelled` | 复测派发（仅测试）/ 复测派发失败 / 取消 |
| `escalated` | `cancelled` | 取消（唯一出口） |
| `cancelled` | — | 终态 |

`DEFINED_ONLY.node` **置空**；新增 `escalation: {pending:['voided'], voided:[]}`，`DEFINED_ONLY.escalation=[]`；`handoff.created` 增加 `rejected`（与 `handoff-tracker.js` 的 `LEGAL` **同步改**）。

> **`failed→escalated` 必存**：AC-33 的 `dispatch-fail-retest` 是 T-002 在 `failed`（复测待派）状态下派发失败，门控表（D-2）的派发失败行必须同时列 `pending→escalated` / `done→escalated` / `failed→escalated`，本表与之一致；漏掉这条，第三个样本无法落到 `escalated`。
> **门控顺序**（D-2）：先按派发前的 `round` 校验（`failed→running` 要求 `round < 2`），通过后真正派发时才 `round += 1`；`after_verdict` 暂停点触发前必须已完成 `review→failed`，再构造回流包。

**会话表（guard 用，C-02 要求 `smFor('session')` 显式映射）**

| from | to |
|---|---|
| `idle` | `thinking`、`escalated` |
| `thinking` | `tool_running`、`waiting_dependency`、`waiting_input`、`idle`、`escalated` |
| `tool_running` | `thinking`、`waiting_dependency`、`waiting_input`、`idle`、`escalated` |
| `waiting_input` | `thinking`、`idle`、`escalated` |
| `waiting_dependency` | `idle`、`escalated` |
| `escalated` | `idle`（仅取消） |

> 该表只服务 `transit('session', …)` 与升级/取消路径；I1.1 的直写路径不经过它，因此不改现有行为。

### 2.8 修改 `src/core/verify-artifact.js`（WP-3）

```js
// I1.1 原样保留（single 用）
extractDeclaredArtifacts(taskText) -> string[]
verifyArtifacts({cwd, declared, observedRefs}) -> {ok, refs, note?, failure?}

// 新增（code-loop 用；不改旧函数）
export const PRODUCT_LINE = /产物：/;
extractProductLines(taskText) -> {ok:true, refs:string[]} | {ok:false, code:'PRODUCT_LINE_MISSING'}
   // 只认全角「产物：」；半角「产物:」视为未声明，由 startRun 报 PRODUCT_LINE_MISSING
normalizeProductRef(raw, cwd) -> string | null      // `./calc.js` ≡ `calc.js`；`\` 先规范化
verifyDeclaredArtifacts({cwd, declared, roundStartedAt, clock})
  -> {ok:true, refs:[{ref,absPath,exists,bytes,mtime,verifiedAt}]}
   | {ok:false, failure:{code:'MISSING'|'EMPTY'|'STALE', ref, message}}
   // message 逐字：未找到声明的产出 <路径> / 产出为空 <路径> / 产出不是本轮新写 <路径>
```

### 2.9 修改 `src/persistence/instance-store.js`（WP-2）

```js
createStore({root}) -> store

store.load(id)   -> {ok:true, state} | {ok:false, code:'NOT_FOUND'|'STATE_CORRUPT'|'STORE_READ_FAILED', …}
store.save(id, state, {expectedState} = {})
  // expectedState: string（v1 旧语义，比 disk.state.state；旧调用传 string 仍兼容）
  //              | {state?, halted?, rev?}（v2，只比提供了的字段；rev 为整快照版本）
  -> {ok:true, updatedAt, rev} | {ok:false, code:'STORE_CONFLICT'|'STORE_WRITE_FAILED'|'STORE_WRITE_BLOCKED_CORRUPT', params}
store.list() -> {ok:true, items:[{
  instanceId, schemaVersion, template, cwd, state,
  nodeState, sessionState, handoffState, pendingEscalations, updatedAt, readable
}]}
store.appendEvent / readEvents / nextSeq / markCorrupt     // 不变
```

- `list()` 对 v2 读数组（`nodes[0]/sessions.at(-1)/handoffs.at(-1)/escalations` 计数），对 v1 读单对象（`template=null`、`pendingEscalations=0`）；
- **v1 只读**：`load` 只读不回写；`reconcileOnBoot`/`interruptAll`/`cancel`/`startRun` 对 `schemaVersion<2` 一律 `LEGACY_READ_ONLY` 且不写任何文件；
- `save` 成功时把 `state.rev` 写成 `(disk.rev ?? 0) + 1` 后再落盘（返回值同步）。

### 2.10 修改 `src/adapter/session-state.js`（WP-4）

```js
normalizer.reduce(prev, sessionUpdate, ctx)   // 增：rec.state==='escalated' 且未取消 → 吸收，dropped:true
normalizer.onEscalated(sessionId)             // 改：state='escalated'，quarantined=true
normalizer.onPermissionSettled(...)           // 改：escalated 时保持 escalated
normalizer.onPromptSettled(...)               // 改：escalated 时保持 escalated
normalizer.onCancelled(sessionId)             // 不变（唯一允许离开 escalated 的入口）
```

### 2.11 修改 `src/daemon/server.js`（WP-5）

```js
'run.start': params 白名单 = { cwd, task, instanceId?, hostId?, template? }
             → orchestrator.startRun({..., template})
'instance.cancel': result 原样透传 { nodes, sessions, handoffs, escalations }
// 仅 NODE_ENV==='test' 且 orchestrator 暴露接缝时挂载：
'test.dispatch': { instanceId, nodeId } -> dispatchToNode(...)
'test.escalate': { instanceId, nodeId } -> escalateOnce(...)
```

IPC 只做字段校验与透传，**不重建业务对象**（C-05，S5）。

### 2.12 修改 `src/cli/main.js`（WP-5）

```js
VALUE_FLAGS = ['cwd','task','instance','project','generation','template','host'];   // 新增 2
EXIT_SUSPENDED = 4;  EXIT_HALTED = 5;

runCommand(flags, ctx):
  run.start 请求体 = { cwd, task, instanceId?, template?, hostId? }
  run.wait → 按快照分流：
    completed            → 节点行 ×N → 交接包行 → 升级块（code-loop）→ 0
    suspended            → A-4 三行 → 4
    halted === true      → A-4 四行（错误行 + 三行）→ 5
    interrupted/failed   → I1.1 路径 → 1
statusCommand: 渲染传 {template}；列表行支持 template / 待处理升级
cancelCommand: 输出数组结果
```

### 2.13 修改 `src/cli/render.js`（WP-5）

```js
renderInstanceLine(snapshot)                        // 模板后缀 / 已停止推进
renderInstanceListRow(item, snapshot)               // 模板 + 待处理升级 N
renderNodeLines(snapshot, {template}) -> string[]
renderNodeLine(snapshot)                            // single 旧版式（保留）
renderSessionLine(snapshot, nowMs, {template})
renderHandoffLines(snapshot, {template}) -> string[]
renderHandoffWait(snapshot, nowMs)
renderEscalationBlock(snapshot) -> string[]
renderEventLine(event, {template}) -> string
renderBackflowDetail(event) -> string[]             // 6 空格缩进明细
renderRejectedTransition(event)                     // 两模板都不加 seq
renderCancelLines(result)                           // 数组或旧对象
renderRunTail(snapshot, {template}) -> string[]      // A-4
renderError({code, params})
```

### 2.14 修改 `src/cli/labels.js`（WP-1）

```js
INSTANCE_LABEL   += { suspended:'已挂起' }
NODE_LABEL       += { escalated:'已升级' }
ROLE_LABEL        = { developer:'开发', tester:'测试', coordinator:'协调者' }
TEMPLATE_LABEL    = { single:'单节点', 'code-loop':'编码闭环' }      // single 项保留不用
ESCALATION_LABEL  = { pending:'待处理', voided:'已作废' }
HANDOFF_DIRECTION = { forward:'', backflow:'回流', retest:'复测' }
NODE_QUALIFIER    = { waiting_retest:'等待复测', escalation_unrecorded:'升级未记录' }
REASON_LABEL      = { …11 新（D-5 逐字）+ 21 I1.1 旧（不改写） }
ERROR_TEMPLATE   += TASK_EMPTY / TEMPLATE_UNKNOWN / PRODUCT_LINE_MISSING / DIR_BUSY /
                    INSTANCE_RUNNING / INSTANCE_SUSPENDED / LEGACY_READ_ONLY /
                    ESCALATION_WRITE_FAILED / CANCEL_NOT_NEEDED
HANDOFF_REJECT_REASON = { withdrawn:'已撤回', permission_denied:'审批被拒', target_rejected:'目标拒绝' }
INSTANCE_STOPPED_SUFFIX = '已停止推进'
BACKFLOW_DEFECT_LINE    = '缺陷 {i}：{summary}（证据 {evidence}）'
BACKFLOW_RETEST_LINE    = '复测要求：{text}'
ESCALATION_BLOCK        = { header:'升级 {id} {state}', reason:'  原因：{detail}',
                            node:'  节点：{nodeId} {role} · 第 {round} 轮',
                            defect:'  缺陷：{summary}（证据 {evidence}）',
                            next:'  下一步：本版本只能查看；要终止请执行 orch cancel --instance {id}' }
```

### 2.15 新增测试夹具（WP-6）

```js
// test/fixtures/code-loop-driver.mjs
main(argv) -> exitCode
//  --root <abs> [--scenario <name>] [--cwd <dir>] [--task <text>]
//  [--stop-after <n>] [--keep] [--reset] [--prepare-only]

// test/fixtures/call-seam.mjs
main(argv) -> exitCode
//  --root <abs> --instance <id> --call dispatchToNode|escalateOnce [--node <nodeId>]
//  单行 JSON 到 stdout

// test/fixtures/purity-check.mjs
main(argv) -> exitCode
//  --dirs src/core,src/daemon --forbid code-loop,developer,tester,coordinator

// test/fixtures/attempt-transition.mjs（修改）
//  新增 --node <nodeId>；v2 从 nodes[] 定位，缺省 nodes[0]
```

场景文件 `test/fixtures/scenarios/<name>.json`：

```json
{ "steps": [ { "write": [ { "path": "calc.js", "content": "…", "utimes": null } ],
               "verdict": { "verdict": "fail", "defects": [ { "summary": "…", "evidence": "out/test-log.txt" } ] },
               "message": "mock: done", "sessionNew": "ok", "hostError": null,
               "hold": null, "historyMarker": null, "delayMs": 0 } ],
  "stopAfter": null }
```

### 2.16 修改 `test/fixtures/mock-acp-agent.js`（WP-6）

- 新增入口 `--root <abs> --scenario <name>`；**不带这两个参数时，I1.1 的 12 个开关与缺省行为完全不变**（AC-22 用旧开关重跑 I1.1 的 AC-15~25）。
- 消费点在 `session/new` **之前**：`cursor.json` → `{next:n}` → 写 `cursor.json.tmp` → `rename` → 写 `prompts/<n>.json = {n, nodeId, round, task}`（`nodeId/round` 取 step 的可选字段，缺省按 §3.3 的 step↔节点表推导）。
- 按 step 执行：`write`（含 `utimes` / `content:""`）、`verdict`（对象或 `"raw:<文本>"`）、`message`、`sessionNew:'fail'`（`session/new` 回 error）、`hostError`、`hold.when='start'`、`historyMarker`（写 `.mock/history/<n>.txt`；后续步骤任务里出现旧 marker → 写 `.mock/history-leak` 并非 0 退出）、`delayMs`（**先发 `tool_call` 再等**，保证交接包进 `accepted`）。
- 步数耗尽：`next > steps.length` → 写 `.mock/exhausted` 并以非 0 退出（核心按宿主错误处理）。

---

## 3. 数据模型

### 3.1 `state.json` v2（主样例：已挂起；2 节点 / 4 会话 / 3 交接包 / 1 升级）

> 形状以需求 **D-6（v15）** 为准，本样例只为实现与测试对齐。字段名、枚举值不得改写。v15 已把 `rev`（顶层）、`escalations[].defects[]`、`counters.dispatchCount` 并入 D-6，本样例三者都出现，且与 §1.4 / §2.5 / §2.6 的契约一致。
>
> **字段冻结口径（v15 D-6 原句）**：除 `template` / `wakeConsumedAt` / `escalations[]` / `halted` / `roundStartedAt` / `rev` 与数组化本身，其余是 I1.1 冻结字段；`edge` / `defects` / `verdict` / `note` 是新增字段。`defects` 在两处出现：`handoffs[].defects[]`（回流交接包）与 `escalations[].defects[]`（升级条目，类型相同）。

```json
{
  "schemaVersion": 2,
  "instanceId": "INST-001",
  "state": "suspended",
  "template": "code-loop",
  "cwd": "D:\\WWW\\Maestro\\demo-code-pass",
  "task": "给 calc.js 补 div 函数，让 node --test 全绿。改动写在 calc.js\n产物：calc.js",
  "coreGeneration": "gen-1f3c9a2b",
  "halted": false,
  "rev": 37,
  "createdAt": "2026-11-05T10:30:01.900Z",
  "updatedAt": "2026-11-05T10:41:12.400Z",
  "stateSince": "2026-11-05T10:41:12.400Z",
  "counters": { "eventSeq": 42, "runCount": 1, "dispatchCount": 4 },
  "hostRaw": {
    "stopReason": "end_turn",
    "lastError": null,
    "agentInfo": { "name": "deepseek-harness-acp", "version": "0.0.1" }
  },
  "nodes": [
    {
      "nodeId": "T-001",
      "roleId": "developer",
      "round": 2,
      "state": "done",
      "stateSince": "2026-11-05T10:36:40.000Z",
      "startedAt": "2026-11-05T10:30:02.100Z",
      "roundStartedAt": "2026-11-05T10:31:05.000Z",
      "endedAt": "2026-11-05T10:36:40.000Z",
      "failure": null,
      "note": null,
      "verdict": null,
      "sessionId": "sess-b2e2",
      "artifactRefs": [
        { "ref": "calc.js", "absPath": "D:\\WWW\\Maestro\\demo-code-pass\\calc.js",
          "exists": true, "bytes": 212, "verifiedAt": "2026-11-05T10:36:40.000Z" }
      ]
    },
    {
      "nodeId": "T-002",
      "roleId": "tester",
      "round": 2,
      "state": "escalated",
      "stateSince": "2026-11-05T10:41:12.400Z",
      "startedAt": "2026-11-05T10:30:03.000Z",
      "roundStartedAt": "2026-11-05T10:36:44.000Z",
      "endedAt": "2026-11-05T10:41:12.400Z",
      "failure": null,
      "note": null,
      "verdict": { "value": "fail", "defectCount": 1,
                   "verdictPath": "out/verdict.json", "readAt": "2026-11-05T10:41:12.300Z" },
      "sessionId": "sess-c7a3",
      "artifactRefs": []
    }
  ],
  "sessions": [
    {
      "sessionId": "sess-b2e1", "nodeId": "T-001", "round": 1, "hostId": "mock",
      "state": "idle", "stateSince": "2026-11-05T10:31:00.000Z",
      "createdAt": "2026-11-05T10:30:02.500Z", "lastEventAt": "2026-11-05T10:30:59.000Z",
      "toolName": null, "turnId": "turn-1", "artifactRef": "calc.js",
      "pendingPermission": null, "quarantined": false
    },
    {
      "sessionId": "sess-c7a1", "nodeId": "T-002", "round": 1, "hostId": "mock",
      "state": "idle", "stateSince": "2026-11-05T10:31:00.300Z",
      "createdAt": "2026-11-05T10:30:03.400Z", "lastEventAt": "2026-11-05T10:31:00.200Z",
      "toolName": null, "turnId": "turn-1", "artifactRef": null,
      "pendingPermission": null, "quarantined": false
    },
    {
      "sessionId": "sess-b2e2", "nodeId": "T-001", "round": 2, "hostId": "mock",
      "state": "idle", "stateSince": "2026-11-05T10:36:40.000Z",
      "createdAt": "2026-11-05T10:31:05.300Z", "lastEventAt": "2026-11-05T10:36:39.800Z",
      "toolName": null, "turnId": "turn-1", "artifactRef": "calc.js",
      "pendingPermission": null, "quarantined": false
    },
    {
      "sessionId": "sess-c7a3", "nodeId": "T-002", "round": 2, "hostId": "mock",
      "state": "escalated", "stateSince": "2026-11-05T10:41:12.400Z",
      "createdAt": "2026-11-05T10:36:44.500Z", "lastEventAt": "2026-11-05T10:41:11.900Z",
      "toolName": null, "turnId": "turn-1", "artifactRef": null,
      "pendingPermission": null, "quarantined": true
    }
  ],
  "handoffs": [
    { "handoffId": "HO-001", "edge": { "from": "T-001", "to": "T-002", "kind": "forward" },
      "state": "consumed", "createdAt": "2026-11-05T10:30:02.700Z",
      "deliveredAt": "2026-11-05T10:30:02.742Z", "acceptedAt": "2026-11-05T10:30:02.805Z",
      "consumedAt": "2026-11-05T10:31:00.000Z", "rejectedAt": null, "rejectReason": null,
      "wakeConsumedAt": null, "acceptedSignal": "agent_thought_chunk",
      "ambiguityWindowMs": 63, "defects": [], "note": null },
    { "handoffId": "HO-002", "edge": { "from": "T-002", "to": "T-001", "kind": "backflow" },
      "state": "consumed", "createdAt": "2026-11-05T10:31:05.000Z",
      "deliveredAt": "2026-11-05T10:31:05.100Z", "acceptedAt": "2026-11-05T10:31:06.000Z",
      "consumedAt": "2026-11-05T10:36:40.000Z", "rejectedAt": null, "rejectReason": null,
      "wakeConsumedAt": "2026-11-05T10:31:05.000Z", "acceptedSignal": "tool_call",
      "ambiguityWindowMs": 900,
      "defects": [
        { "summary": "div 在除数为 0 时返回 Infinity，未抛错", "evidence": "out/test-log.txt" },
        { "summary": "div(6,0) 未返回 NaN", "evidence": "out/test-log.txt" }
      ], "note": null },
    { "handoffId": "HO-003", "edge": { "from": "T-001", "to": "T-002", "kind": "retest" },
      "state": "consumed", "createdAt": "2026-11-05T10:36:44.000Z",
      "deliveredAt": "2026-11-05T10:36:44.100Z", "acceptedAt": "2026-11-05T10:36:45.000Z",
      "consumedAt": "2026-11-05T10:41:12.300Z", "rejectedAt": null, "rejectReason": null,
      "wakeConsumedAt": null, "acceptedSignal": "tool_call",
      "ambiguityWindowMs": 900, "defects": [], "note": null }
  ],
  "escalations": [
    { "escalationId": "ESC-001", "nodeId": "T-002", "round": 2,
      "reasonCode": "rounds_exceeded",
      "reasonDetail": "回流超上限：测试已派发 2 次仍未通过",
      "defects": [ { "summary": "div 在除数为 0 时返回 Infinity，未抛错", "evidence": "out/test-log.txt" } ],
      "state": "pending", "createdAt": "2026-11-05T10:41:12.400Z", "voidedAt": null }
  ]
}
```

**`halted` 变体（停止推进分支，与上面互斥；此处只列差异字段）**

```json
{
  "state": "running",
  "halted": true,
  "rev": 41,
  "counters": { "eventSeq": 46, "runCount": 1, "dispatchCount": 4 },
  "escalations": [],
  "nodes": [
    { "nodeId": "T-001", "state": "done", "round": 2 },
    { "nodeId": "T-002", "state": "review", "round": 2,
      "verdict": { "value": "fail", "defectCount": 1,
                   "verdictPath": "out/verdict.json", "readAt": "…" } }
  ]
}
```

> 不变式：`已挂起 ⇔ ≥1 个节点 已升级 且恰有 1 条 待处理 升级`；`halted=true` 时**没有**升级、实例仍 `running`、节点保持升级前状态（`review` / `running` / `done` / `pending` / `failed` 之一）。两个变体都带 `rev` 与 `counters.dispatchCount`，只列差异字段不改变它们的必存性。

**相对 D-6 的增量字段（3 个；v15 已正式并入 D-6，此处保留落地口径）**

| 字段 | 谁写 | 需求 v15 口径 / 为什么需要 |
|---|---|---|
| `rev` | `store.save` 每次成功写入 +1 | 单调递增整数，CAS 依据（`expectedState.rev`）；D-6 v15 已含此字段，旧调用传 `string` 仍兼容 |
| `escalations[].defects[]` | `commitEscalation` | 类型同回流交接包 `handoffs[].defects[]`；无缺陷时 `[]`（不省略）。供升级块渲染「缺陷：…」与缺陷数；第 2 轮不建回流包，判定缺陷只能落在升级条目上 |
| `counters.dispatchCount` | `dispatchToNode` 每次派发 +1（含失败派发） | 整实例累计派发次数；供 AC-24 的事件序号与「整轮第 n 次派发」断言使用，也是 `--stop-after` / `MAESTRO_TEST_STOP_AFTER=<n>` 的权威「第 n 步」计数 |

### 3.2 `events.jsonl` 新增事件（`object:"escalation"` + 11 个 reason）

```json
{"seq":11,"ts":"2026-11-05T10:31:00.000Z","object":"node","objectId":"T-002","from":"running","to":"review","result":"applied","reason":"output.submitted","detail":null,"gen":"gen-1f3c9a2b"}
{"seq":12,"ts":"2026-11-05T10:31:00.100Z","object":"node","objectId":"T-002","from":null,"to":null,"result":"note","reason":"verdict.read","detail":{"source":"file","path":"out/verdict.json","verdict":"fail"},"gen":"gen-1f3c9a2b"}
{"seq":13,"ts":"2026-11-05T10:31:00.200Z","object":"node","objectId":"T-002","from":"review","to":"failed","result":"applied","reason":"verification.failed","detail":{"verdict":"fail","defectCount":2},"gen":"gen-1f3c9a2b"}
{"seq":14,"ts":"2026-11-05T10:31:05.000Z","object":"handoff","objectId":"HO-002","from":null,"to":"created","result":"applied","reason":"handoff.created","detail":null,"gen":"gen-1f3c9a2b"}
{"seq":15,"ts":"2026-11-05T10:31:05.010Z","object":"handoff","objectId":"HO-002","from":null,"to":null,"result":"note","reason":"backflow.constructed","detail":{"defects":[{"summary":"div 在除数为 0 时返回 Infinity，未抛错","evidence":"out/test-log.txt"},{"summary":"div(6,0) 未返回 NaN","evidence":"out/test-log.txt"}],"retestRequirement":"修完后请重跑 node --test，并确认上述 2 条都不再出现"},"gen":"gen-1f3c9a2b"}
{"seq":16,"ts":"2026-11-05T10:31:05.020Z","object":"node","objectId":"T-001","from":"done","to":"running","result":"applied","reason":"node.dispatch","detail":{"round":2,"nodeId":"T-001","roleId":"developer"},"gen":"gen-1f3c9a2b"}
{"seq":42,"ts":"2026-11-05T10:41:12.400Z","object":"escalation","objectId":"ESC-001","from":null,"to":"pending","result":"applied","reason":"escalation.created","detail":{"reasonCode":"rounds_exceeded","reasonDetail":"回流超上限：测试已派发 2 次仍未通过"},"gen":"gen-1f3c9a2b"}
```

**`reason` → `detail` 形状（11 条，逐字对齐 M-4）**

| reason | object | detail |
|---|---|---|
| `node.dispatch` | node | `{round, nodeId, roleId}`（渲染中段固定 `派发 → 执行中`、原因固定 `派发 · 第 <n> 轮`） |
| `verdict.read` | node | `{source:'file', path:'out/verdict.json', verdict:'pass'|'fail'}`（**相对路径**） |
| `verdict.invalid` | node | `{reasonCode, stage, message}` |
| `backflow.constructed` | handoff | `{defects:[{summary,evidence}], retestRequirement}`（渲染追加缩进明细） |
| `rounds.exceeded` | node | `{round, maxRounds}` |
| `handoff.rejected` | handoff | `{reason:'withdrawn'}` |
| `escalation.created` | escalation | `{reasonCode, reasonDetail}` |
| `escalation.voided` | escalation | `{escalationId}` |
| `core.suspend` | instance | `{escalationId}` |
| `wake.rejected` | node | `{code:'NO_PENDING_BACKFLOW'|'ROUNDS_EXCEEDED'|'TARGET_NOT_ELIGIBLE'}` |
| `run.halted` | instance | `{cause}` |

> 老读端遇到未知 `object`/`reason` 只显示原值、不报错（I1.1 `render.js:62-70` 已如此）。

### 3.3 `out/verdict.json`

**合法样本**

```json
{ "verdict": "pass", "defects": [] }
```

```json
{ "verdict": "fail",
  "defects": [
    { "summary": "div 在除数为 0 时返回 Infinity，未抛错", "evidence": "out/test-log.txt" },
    { "summary": "div(6,0) 未返回 NaN", "evidence": "out/test-log.txt" }
  ] }
```

**六种非法样本（与 `readVerdict` 的 stage 一一对应）**

| # | 样本 | 命中 stage | 升级块原文 |
|---|---|---|---|
| 1 | 文件不存在 | `missing` | `原因：核对失败：未找到判定文件 out/verdict.json` |
| 2 | 存在但 mtime 早于 `roundStartedAt` | `stale` | `原因：核对失败：判定文件不是本轮新写 out/verdict.json` |
| 3 | `{"verdict":"maybe","defects":[]}` / `not-json` | `unparsable` | `原因：核对失败：判定文件不可解析` |
| 4 | `{"verdict":"fail","defects":[]}` | `no_defects` | `原因：核对失败：判定为不通过，但没有缺陷清单` |
| 5 | `{"verdict":"pass","defects":[{"summary":"x","evidence":"out/test-log.txt"}]}` | `pass_with_defects` | `原因：核对失败：判定为通过，但缺陷清单非空` |
| 6 | `{"verdict":"fail","defects":[{"summary":"x","evidence":"out/nope.txt"}]}` | `evidence_unreadable` | `原因：核对失败：缺陷证据不可解析` |

---

## 4. 工作包拆分（WP-1 ~ WP-7）

> 粒度原则：**文件清单互不重叠**（并行实现不互相覆盖），依赖是 DAG，每个包能独立跑通自己的契约测试。**`src/core/orchestrator.js` 只由 WP-4 负责**。

### WP-1 状态机 · 文案 · 标签（契约地基）

- **负责文件（4）**：
  - `src/core/state-machine.js`
  - `src/cli/labels.js`
  - `test/wp2/state-machine.test.js`
  - `test/wp2/labels.test.js`
- **依赖**：无。
- **交付**：
  - 节点表 10 条新增边 + `escalated:['cancelled']` + `DEFINED_ONLY.node=[]`；
  - `HANDOFF_STATES` 补 `created→rejected`；
  - 新增 `ESCALATION_STATES` / `TABLES.escalation` / `createEscalationSM`；
  - 新增会话 guard 表 `createSessionSM`（C-02 要求显式映射）；
  - `INSTANCE_STATES` 加 `suspended`（**不进** `TERMINAL_INSTANCE`）；
  - 四组常量（`TERMINAL_INSTANCE` / `CORE_IMMUTABLE_INSTANCE` / `RUN_DONE_INSTANCE` / `CANCELABLE_NODE` / `CANCELABLE_HANDOFF`）——常量放 `state-machine.js` 导出；
  - `labels.js` 全量新增（D-5 逐字）。
- **验收口径**：AC-07（`已升级` 有对应状态）、AC-08/24/39（中文词表）、AC-25（非法迁移拒绝）、AC-36/42（取消边）、AC-20（v1 不显示轮次/模板的标签基础）；D-8 的 `wp2/state-machine` 与 `wp2/labels` 改写。
- **可否并行**：可（纯逻辑 + 纯常量，零 IO）。

### WP-2 持久化 v2 · CAS · v1 只读

- **负责文件（4）**：`src/persistence/instance-store.js`、`test/wp1/instance-store.test.js`、`test/wp8/f3-cas.test.js`、`test/fixtures/legacy-v1/**`（`OLD-001/`、`OLD-002/`、`SHA256SUMS`）
- **依赖**：无（只依赖 C-01 的 `rev`/`halted` 形状，与 WP-1 无文件交集）。
- **交付**：
  - `expectedState` 双形状（string 旧语义保持）；`rev` 每次写 +1；冲突 `STORE_CONFLICT` 不写；
  - `list()` 投影增 `schemaVersion/template/cwd/pendingEscalations`（v2 读数组、v1 读单对象）；
  - v1 只读：`load` 不回写；`save` 对 `schemaVersion<2` 不提供旁路（由 orchestrator 拒绝写入）；
  - `legacy-v1` 两份快照（`completed` / `running`）+ `SHA256SUMS`。
- **验收口径**：AC-20（只读 + 哈希一致）、AC-09（列表行 `待处理升级 1` 的数据来源）、AC-40（DIR_BUSY 需要 `list()` 的 `cwd/template`）、AC-10/35（重启后数组可读）；D-8 的 `wp1/instance-store` 与 `f3-cas`。
- **可否并行**：可（与 WP-1 零交集）。

### WP-3 图引擎 · 判定 · 升级 · 产物核对

- **负责文件（8）**：
  - `src/templates/index.js`（新增）
  - `src/core/graph.js`（新增）
  - `src/core/advance.js`（新增）
  - `src/core/verdict.js`（新增）
  - `src/core/escalation.js`（新增）
  - `src/core/verify-artifact.js`
  - `test/templates/fake-graph.test.js`（新增）
  - `test/wp4/verify-artifact.test.js`
- **依赖**：WP-1（状态机表 + 常量）、WP-2（CAS 形状）。
- **交付**：
  - 两张图的完整数据 + `promptFor` 三条模板；
  - `graph.js` 六个查询函数；`advance.js` 的纯规划 + `buildHandoff` + 门控；
  - `verdict.js` 六种失败分类；
  - `escalation.js` 的幂等键与一次 CAS 提交器（含故障开关形参）；
  - `verify-artifact.js` 的 `code-loop` 分支（`产物：` 全角、`roundStartedAt` mtime、`产出为空 <路径>`），**不改** `single` 的两个旧函数。
- **验收口径**：AC-28（假图 + purity 的图侧）、AC-29（产物三态）、AC-13/14/16/18/19（判定六类）、AC-08/27（升级幂等与缺陷）、AC-45/46（回流/复测包字段）；D-8 的 `wp4/verify-artifact`（新增用例，不改旧断言）。
- **可否并行**：WP-1/WP-2 合入后可与 WP-4 **同时开工**（WP-4 只 import 签名，不 import 内部）。

### WP-4 编排核心 · 会话守卫（最大包）

- **负责文件（8）**：
  - `src/core/orchestrator.js`
  - `src/adapter/session-state.js`
  - `test/wp4/orchestrator.test.js`
  - `test/wp7/wp7.test.js`
  - `test/wp8/helpers.js`
  - `test/wp8/f1-permission.test.js`
  - `test/wp8/f2-reconcile.test.js`
  - `test/wp8/f4-error.test.js`、`test/wp8/f5-hold.test.js`
- **依赖**：WP-1 / WP-2 / WP-3。
- **交付**：
  - `createOrchestrator({graph, graphs})`；
  - `advance()` + `driveGraph()` + `dispatchToNode()` + `commitEscalation()` 接线；
  - `startRun` 多节点落盘顺序与检查顺序（D-4）；
  - `transit` 五表按 id 寻址；`snapshotOf` 多会话；`handoffToState` 白名单扩到 14 字段（+`edge/defects/note/wakeConsumedAt`）；
  - `applyCancel` 数组化（一次 CAS 后逐条 emit）；
  - `withLock('@dir:'+realpath(cwd))` 目录唯一性；
  - `reconcileOnBoot`/`interruptAll` 跳过 v1 与 `suspended`；
  - 会话 `escalated` 终态守卫；
  - 仅 test 导出的两个接缝。
- **验收口径**：AC-01/02/03/05/06/07/11/31/32/33/34/35/37/38/39/41/42/43/44/45/46（核心侧）；D-8 的 `wp4/orchestrator` 形状断言、`wp7`、`wp8/*`。
- **可否并行**：**不可**（关键路径；WP-3 的契约冻结后立即开工）。

### WP-5 IPC 与 CLI

- **负责文件（7）**：
  - `src/daemon/server.js`
  - `src/cli/main.js`
  - `src/cli/render.js`
  - `test/wp5/ipc-server.test.js`
  - `test/wp6/render.test.js`
  - `test/wp6/main.test.js`
  - `test/wp9/render-fixes.test.js`
- **依赖**：WP-1（labels）、WP-2（list 投影）、WP-4（方法签名；可在签名冻结后先写）。
- **交付**：
  - `run.start` 白名单加 `template`；`instance.cancel` 透传四数组；仅 test 的 `test.dispatch`/`test.escalate`；
  - `--template`/`--host` 解析 + 全链路透传；退出码 4/5；
  - 渲染分流（`single` 逐字 / `code-loop` 新格式）；`code-loop` 事件行 `[#seq]` + 中文原因，`single` 保持 I1.1 版式；`rejected` 两模板都不加 seq；
  - 占位符白名单扩展；`A-2`/`A-3`/`A-4` 全部版式；
  - `--events` 时间线、列表行模板/待处理升级。
- **验收口径**：AC-01/02/03/04/07/08/09/12/20/21/22/23/24/31/36/38/42 的**可见性**部分；D-8 的 `wp5/ipc-server`、`wp6/render`、`wp6/main`（新增）、`wp9/render-fixes`。
- **可否并行**：可与 WP-4 并行（契约冻结后），但联调需 WP-4 可实例化。

### WP-6 夹具与场景（可执行契约）

- **负责文件（5 类）**：
  - `test/fixtures/mock-acp-agent.js`（改）
  - `test/fixtures/code-loop-driver.mjs`（新增）
  - `test/fixtures/call-seam.mjs`（新增）
  - `test/fixtures/attempt-transition.mjs`（改：`--node`）
  - `test/fixtures/scenarios/*.json`（新增 21 个场景文件）
- **依赖**：WP-4（接缝）、WP-3（step↔节点/轮次的语义）；**可在契约冻结后先写**，用 `--prepare-only` 自测现场。
- **交付**：场景清单全覆盖（`code-pass` / `backflow-once` / `backflow-hold` / `retest-hold` / `retest-slow` / `backflow-twice` / `retest-fail` / `hold-forever` / `hold-test` / `verdict-missing` / `verdict-bad-json` / `verdict-no-field` / `verdict-maybe` / `verdict-pass-with-defects` / `verdict-says-fail` / `verdict-stale` / `verdict-stale-retest` / `verdict-no-defects` / `verdict-missing-evidence` / `artifact-missing` / `artifact-empty` / `artifact-stale` / `dispatch-fail-first` / `dispatch-fail-backflow` / `dispatch-fail-retest`）。
- **验收口径**：AC-04/05/06/09/11/13/14/15/16/18/19/26/27/29/32/33/34/36/37/38/41/42/43/44/46 的夹具侧。
- **可否并行**：可（唯一允许写 `test/fixtures/**` 可执行脚本的包）。

### WP-7 集成收口（**必须有**，I1.1 的教训）

- **负责文件（6 类）**：
  - `test/fixtures/purity-check.mjs`（新增）
  - `test/wp9/cli-e2e.test.js`
  - `demo-code-pass/**`（`calc.js` / `calc.test.js` / `package.json` / `out/`）
  - `demo-code-fail/**`（同上，`calc.test.js` 额外断言 `div(1,0)` 抛错）
  - `demo/**`
  - `docs/iterations/iteration-2/evidence/**`（逐 AC 证据 + `i1.1-regression.md`）
- **依赖**：WP-1 ~ WP-6 全部合入。
- **交付 / 必查项**：
  1. **装配完整性**：`serve-entry` 构造 `createOrchestrator` 时 `adapterFactory` / `graph` / `graphs` / `env` **全部有值**（I1.1 的教训：5 个包各自全绿，接缝漏了 `adapterFactory` 无人提供 → 端到端跑不通）；
  2. **`startRun` 不阻塞**：`earlyReturn=true` 时 `run.start` 必须 <5s 返回（I1.1 的第二个教训）；
  3. 真实面 5 条 AC 全跑（含 AC-45 的 `demo-code-fail` 回流闭环）；**AC-45 的机检口径按 v15**：`verdict.read`（`detail.verdict='fail'`）的 `seq` **大于 T-002 第 1 轮派发、小于 T-001 第 2 轮派发（整轮第 3 次 `node.dispatch`）**——不是 v14 的「小于第 2 次 `node.dispatch`」；
  4. 44 条有效 AC 逐条填证据，`node --test "test/**/*.test.js"` 全绿（≥216 + 新增）；
  5. `purity-check` 退出码 0；
  6. 夹具全场景串跑一遍（NFR-03：5 个场景各一次，核对事件序列）。
- **验收口径**：全部 44 条有效 AC 的**最终判定**；D-8 全部改写落地。
- **可否并行**：不可（链尾）。

### 4.1 文件 → 工作包归属（互不重叠校验）

| 文件 | WP |
|---|---|
| `src/core/state-machine.js`、`src/cli/labels.js`、`test/wp2/state-machine.test.js`、`test/wp2/labels.test.js` | 1 |
| `src/persistence/instance-store.js`、`test/wp1/instance-store.test.js`、`test/wp8/f3-cas.test.js`、`test/fixtures/legacy-v1/**` | 2 |
| `src/templates/index.js`、`src/core/{graph,advance,verdict,escalation}.js`、`src/core/verify-artifact.js`、`test/templates/fake-graph.test.js`、`test/wp4/verify-artifact.test.js` | 3 |
| `src/core/orchestrator.js`、`src/adapter/session-state.js`、`test/wp4/orchestrator.test.js`、`test/wp7/wp7.test.js`、`test/wp8/{helpers,f1-permission,f2-reconcile,f4-error,f5-hold}.*` | 4 |
| `src/daemon/server.js`、`src/cli/{main,render}.js`、`test/wp5/ipc-server.test.js`、`test/wp6/{render,main}.test.js`、`test/wp9/render-fixes.test.js` | 5 |
| `test/fixtures/{mock-acp-agent.js,code-loop-driver.mjs,call-seam.mjs,attempt-transition.mjs,scenarios/**}` | 6 |
| `test/fixtures/purity-check.mjs`、`test/wp9/cli-e2e.test.js`、`demo*/**`、`docs/iterations/iteration-2/evidence/**` | 7 |

> 校验：31 个文件/目录组，每组恰属 1 个包；`src/core/orchestrator.js` 只在 WP-4。共享**契约**（签名与 JSON 形状）不共享文件。

---

## 5. 交付物清单

| 路径 | 内容 | 工作包 |
|---|---|---|
| `src/templates/index.js` | 三角色 + 两张图 + `getGraph`/`initialNodes`/`promptFor` | WP-3 |
| `src/core/graph.js` | 图只读查询（找边 / 终节点 / 轮次上限 / 假图校验） | WP-3 |
| `src/core/advance.js` | 推进规划（判定 → 边 → 门控 → 交接包草案） | WP-3 |
| `src/core/verdict.js` | `readVerdict` 六种失败分类 | WP-3 |
| `src/core/escalation.js` | 升级构造 + 幂等键 + 一次 CAS 提交器 | WP-3 |
| `src/core/state-machine.js` | 五张状态表 + 五组常量 + 四个 SM 工厂 | WP-1 |
| `src/core/verify-artifact.js` | `code-loop` 固定 `产物：` 核对（`roundStartedAt` / 空文件文案） | WP-3 |
| `src/core/orchestrator.js` | 图驱动主流程 + `advance` + `driveGraph` + 取消数组化 | WP-4 |
| `src/adapter/session-state.js` | `escalated` 终态守卫 | WP-4 |
| `src/persistence/instance-store.js` | v2 投影 + `rev` CAS + v1 只读 | WP-2 |
| `src/daemon/server.js` | `template` 白名单 + cancel 透传 + 仅 test 接缝路由 | WP-5 |
| `src/cli/main.js` | `--template/--host` + 退出码 4/5 + 收尾分流 | WP-5 |
| `src/cli/render.js` | 双轨渲染（节点表 / 会话单行 / 多交接包 / 升级块 / 事件行） | WP-5 |
| `src/cli/labels.js` | 唯一中文来源（ROLE/TEMPLATE/ESCALATION/REASON…） | WP-1 |
| `test/fixtures/code-loop-driver.mjs` | 现场准备 + 产品链路驱动 | WP-6 |
| `test/fixtures/mock-acp-agent.js` | `--root/--scenario` 模式（12 旧开关不变） | WP-6 |
| `test/fixtures/call-seam.mjs` | 接缝调用（单行 JSON） | WP-6 |
| `test/fixtures/attempt-transition.mjs` | 非法迁移 + `--node` | WP-6 |
| `test/fixtures/scenarios/*.json` | 25 个场景文件 | WP-6 |
| `test/fixtures/legacy-v1/**` | v1 只读快照 + `SHA256SUMS` | WP-2 |
| `test/fixtures/purity-check.mjs` | AC-28 架构扫描 | WP-7 |
| `test/wp1` / `wp2` / `wp4` ~ `wp9` | D-8 全部改写 + 新增用例 | WP-1/2/3/4/5/7 |
| `demo-code-pass/` `demo-code-fail/` `demo/` | 真实面样例目录 | WP-7 |
| `docs/iterations/iteration-2/evidence/**` | 逐 AC 证据 + I1.1 回归记录 | WP-7 |

> 本迭代**不交付**：`docs/iterations/iteration-2/report.md`（执行期产出，不属拆分范围）；不新增 `roles/*.yaml`、`workflows/*.yaml`。

---

## 6. 依赖与并行策略

```
WP-1 状态机/文案 ──┬──────────────────────────┐
WP-2 持久化/CAS ───┤                          ├──► WP-4 编排核心 ──► WP-5 IPC/CLI ──► WP-7 集成收口
WP-3 图/判定/升级 ─┴──────────────────────────┘            ▲                ▲
                                                            │                │
WP-6 夹具/场景 ─────────────────────────────────────────────┴────────────────┘
箭头 = 「上游可 import 之后才能联调」，不是「不能先写」
```

- **可同时开工（零前置）**：**WP-1 / WP-2**；**WP-6 的场景文件**可在契约冻结后立刻写（`--prepare-only` 自测现场）。
- **第二波**：**WP-3**（等 WP-1 的表 + WP-2 的 CAS 形状）。
- **第三波**：**WP-4**（关键路径）与 **WP-5**（可与 WP-4 同时开工，渲染层先用假快照）。
- **第四波**：**WP-7**（全部合入后）。
- **关键路径**：WP-1/WP-2 → WP-3 → WP-4 → WP-5 → WP-7（5 跳）。

**每个包的「契约先冻结、实现后对齐」点**

| 包 | 先冻结什么 | 后对齐什么 |
|---|---|---|
| WP-1 | `NODE_STATES`/`ESCALATION_STATES`、五组常量名、`labels` 的 key 清单 | 与 WP-3/4 的 `reasonCode` 是否齐全（D-5 对账） |
| WP-2 | `save` 的 `expectedState` 双形状、`rev` 递增规则、`list()` 投影字段 | 与 WP-4 的 `saveState` 调用点全部改成对象形状 |
| WP-3 | `planAdvance` 的返回枚举、`buildHandoff` 的字段、`readVerdict` 的六 stage | 与 WP-4 的 `commitEscalation` 注入参数 |
| WP-4 | `startRun`/`waitForRun`/`cancel` 的返回形状、`advance` 的算法顺序 | 与 WP-5 的 `server.js` 方法表、与 WP-6 的接缝返回值 |
| WP-5 | `render*` 的函数签名与 `{template}` 入参、退出码表 | 与 WP-4 的快照字段（`pendingEscalations`、`halted`） |
| WP-6 | `prompts/<n>.json` 的 `{n,nodeId,round,task}`、`cursor.json` 消费时序、场景 JSON schema | 与 WP-3 的 step↔轮次语义、与 WP-4 的暂停点触发位置 |
| WP-7 | 证据目录结构与 AC 清单 | 全部 |

**整合检查点（4 个）**

1. WP-1+2+3 合入后：跑 `wp2/*` + `wp1/instance-store` + `templates/fake-graph` + `wp4/verify-artifact`；
2. WP-4 合入后：用 `mock-acp-agent` 旧开关跑一次 `single` 端到端（证明 I1.1 未回归），再用 `code-loop` 跑 `code-pass` 场景；
3. WP-5+6 合入后：跑夹具 25 个场景 + `orch status` 的 `A-2` 版式对照；
4. WP-7：44 条 AC 全量 + `purity-check` + `npm test`。

---

## 7. 风险与降级

| # | 风险 | 触发条件 | 影响 | 降级动作 |
|---|---|---|---|---|
| R1 | **`finishRun` 单节点收尾是多节点第一道墙**（`orchestrator.js:916`） | 任何 `code-loop` 用例在 T-001 完成后直接把实例写 `completed` | `run.wait` 立即返回，T-002 永不派发；AC-01/02/03/05/45/46 全挂 | 先落 `advance()`/`driveGraph`（WP-3 契约 + WP-4 执行），再谈 M-1 的边；WP-4 的第一个提交必须是「删掉 `:916` 的 `instance→completed`」 |
| R2 | **整实例 CAS 在多对象并发下丢更新**（S1） | 取消与升级同时写；两次写都看到 `running` | 「实例已取消、升级仍 pending」；BR-18 无实现基础 | `rev` 全量版本比较（C-01）；`applyCancel` 与 `commitEscalation` 都走对象形状；冲突重试 3 次后放弃并落 `store.conflict` 事件 |
| R3 | **`nodes[]` 集合化打穿 `handleUpdate`/`snapshotOf`/`applyCancel`**（S6） | v2 下 `state.session` 为 `undefined` | 会话行全丢、`sessionStalled` 失效、取消只收最后一个会话 | 统一 `findSession(state, sessionId)`；`snapshotOf().session` 取 `createdAt` 最大者；取消遍历四数组；D-8 的 `wp4/wp7/wp8` 先改断言 |
| R4 | **`src/core` 禁词表与 AC-28 的冲突**（S12） | 图数据或角色名落进 `src/core`/`src/daemon` | 架构检查直接失败；I1.3 只能复制引擎 | 图与角色只放 `src/templates/**`；核心只出现「对象字段」；`purity-check` 在 WP-7 作为门禁 |
| R5 | **D-8 之外会先红的测试** | `wp1/instance-store`（list 投影 deepEqual）、`wp5/ipc-server`（cancel 形状）、`wp7`（`snapshot.node`） | 第 1 天同时红 30+ 处，分不清回归红与契约变更红 | 按 D-8 的**三批**顺序改：第 1 批只改「旧契约编码」的断言，一次改完再动实现；三个「新增用例」文件（`wp4/verify-artifact`、`wp3/launch-config`、`wp6/main`）不得改旧断言 |
| R6 | **真实模型判定不稳定**（AC-45） | 第 1 轮开发主动补了 `div(1,0)` 边界 → 第 1 轮直接通过 | AC-45 不成立（无回流证据） | **不许伪造**：判定为「本轮不成立」，记录 `state.json` 与真实 `verdict.json`，收紧任务话术（只要求基本 `div`、明确禁止改 `calc.test.js`）后重跑；连续 3 次仍不成立则上报主 Agent，并**保留**夹具面 AC-46 作为回流的等价证据 |
| R7 | 交接包 `created` 已落盘、派发前崩溃 | 取消恰好与判定同时发生 | 出现「已构造但无人认领」的包 | `created` 先落盘 + `applyCancel` 覆盖 `created`（AC-37）；派发在 `withLock` 内，失败即 `escalation(dispatch_failed)` |
| R8 | `halted` 分支与 `waitForRun` 卡住（M-9） | 升级 CAS 失败，实例仍 `running` | `orch run` 等 30 分钟后报「未知错误」 | `waitForRun` 增加 `halted===true` 立即返回；`main` 打一行错误 + 三行收尾，退出码 5 |
| R9 | 暂停点阻塞事件循环 | 用 `Atomics.wait` / 同步 sleep 实现 `MAESTRO_TEST_PAUSE` | 暂停期间 `orch status`/`cancel` 不可用，AC-37 无法执行 | 只允许异步轮询（100ms）；`--keep` 不限时，否则 60 秒上限 |
| R10 | v1 实例被启动对账改写 | `reconcileOnBoot` 用 `TERMINAL_INSTANCE` 遍历 | AC-20 的「哈希一致」失败；旧实例被改成 `已中断` | `reconcileOnBoot`/`interruptAll`/`cancel`/`startRun` 对 `schemaVersion<2` 一律跳过并返回 `LEGACY_READ_ONLY`，不写任何文件 |
| R11 | `DIR_BUSY` 并发窗口 | 两个 `run.start` 在 `store.list()` 的 await 期间都看到空列表 | 同目录两个闭环互相覆盖产物（AC-40） | `withLock('@dir:'+realpath(cwd))` 包住「列目录 → 判未结束 → 分配 id → 首次落盘」；锁不覆盖整个 turn |
| R12 | 测试节点被判成 `artifact_missing` | `out/verdict.json` 参与 D-7 的存在性检查 | `verdict_missing` 被误报成 `artifact_missing`，AC-13 失败 | D-7 明确：**测试节点只走判定契约**，产物核对只约束开发节点；`artifactPolicy:'verdict'` 时 `verifyDeclaredArtifacts` 直接跳过 |
| R13 | 渲染双轨把 `single` 改坏 | 为省事全局套用 `code-loop` 版式 | AC-21/22 回归红（事件行、节点行、交接包行三处） | `renderNodeLine` 旧函数保留；新逻辑放 `renderNodeLines`；`reject` 行两模板都不加 seq；`wp6/render` 保留旧版式用例 |
| R14 | `escalations[]` 缺 `defects[]` 导致升级块无缺陷行 | D-6（v14）的 escalation 无缺陷字段，第 2 轮又不建回流包 | AC-08 的「缺陷：…」无数据来源 | 需求 v15 已回补 `escalations[].defects[]`（类型同回流交接包，无缺陷时 `[]`），见 §2.5 / §3.1；`commitEscalation` 取 `verdict.defects[]` |

---

## 8. 与需求 / 代码现状的冲突（拆分前必须知道）

| # | 冲突 | 两侧原文 / 事实 | 本文处置 | 状态 |
|---|---|---|---|---|
| X1 | **D-6 无版本字段，C-01 要求整快照 CAS** | v14 D-6 字段表无 `rev`；C-01 要求 `rev` 每次写递增 | 需求 v15 已把 `rev` 并入 D-6（顶层单调递增整数，CAS 依据）；本文 §1.4 / §2.5 / §2.6 / §2.7 / §2.9 / §3.1 同步，v1 无此字段（只读） | **已回补（需求 v15）** |
| X2 | **M-7 的 `escalations[]` 无 `defects[]`，AC-08 要求升级块显示缺陷** | v14 D-6：`{escalationId,nodeId,round,reasonCode,reasonDetail,state,createdAt,voidedAt}`；AC-08 断言 `缺陷：div 在除数为 0 时…` | 需求 v15 已把 `escalations[].defects[]` 并入 D-6（类型同回流交接包，无缺陷时 `[]`）；§2.5 `buildEscalation` / §3.1 样例同步 | **已回补（需求 v15）** |
| X3 | **`MAESTRO_TEST_STOP_AFTER` 的「第 n 步」没有权威计数** | §3.3 用「第 n 步」；v14 D-6 的 `counters` 只有 `eventSeq/runCount` | 需求 v15 已把 `counters.dispatchCount` 并入 D-6（每次派发 +1，含失败派发），供 AC-24 事件序号与「整轮第 n 次派发」断言；§2.6 / §3.1 同步 | **已回补（需求 v15）** |
| X4 | **接缝是进程内导出，但 AC-26/27/32 要求对运行中的核心调用** | M-14：「仅 test 导出的接缝」；AC-26：「且核心在跑」+ `call-seam.mjs` | 除条件导出外，`server.js` 在 `NODE_ENV=test` 挂 `test.dispatch`/`test.escalate` 两条 IPC；生产不注册 | **已处置**：§1.8 + §2.11（新增 C-05 的 test-only 例外） |
| X5 | **`--reset` 只清 `.mock/`，但 test 环境变量只在核心冷启动读取** | §3.3：「`--reset` 只清 `<root>/.mock/`，不清 `.orch/instances`」；「`NODE_ENV`/`MAESTRO_*` 在核心进程启动时读取一次」；AC-38：「核心已停」 | driver 在启动前 best-effort `core.stop`（不动实例），再由 `client.connect({ensure:true})` 用当前 env 拉起 | **已处置**：§1.7「driver 的启动顺序」第 5 步（对 `--reset` 语义的细化，不删实例） |
| X6 | **取消已终态实例的错误码从 `INSTANCE_TERMINAL` 变成 `CANCEL_NOT_NEEDED`** | I1.1 `cancel` 返回 `INSTANCE_TERMINAL`；D-5 规定 `CANCEL_NOT_NEEDED`（文案 `实例已结束（<状态>），无需取消`） | 按 D-5 改；`test/wp5/ipc-server` 与 `wp6/main` 的旧断言按 D-8 同步改 | **已处置**：§2.6 `cancel` 返回形状 + §2.14 `ERROR_TEMPLATE` + WP-2/WP-5 的 D-8 改写（文案与码位以 D-5 为准） |
| X7 | **单节点的 `roleId='worker'` 与 `code-loop` 的 `developer/tester` 并存** | M-13 要求把 `ROLE_ID/NODE_ID/HANDOFF_ID` 搬进 `single`；D-6 的 `nodes[].roleId` 无默认值 | `GRAPHS.single.nodes[0].roleId='worker'`（I1.1 兼容值）；`code-loop` 用 `developer/tester`；`ROLE_LABEL` 不含 `worker`（单节点节点行不显示角色名） | **已处置**：§2.1 `GRAPHS.single` + §2.14 `ROLE_LABEL` |
| X8 | **`AC-23②` 的 `TASK_EMPTY` 与 `single` 的旧文案** | I1.1 空任务返回 `UNKNOWN_ERROR：任务描述为空`；D-5 新增 `TASK_EMPTY` | `code-loop` 返回 `TASK_EMPTY`；`single` 保持 I1.1（BR-29），不改旧断言 | **已处置**：§2.6 `startRun` 检查顺序 B + §2.14 错误码表 |
| X9 | **`verify-artifact` 的 `sha256` 字段** | I1.1 `refs[]` 含 `sha256:null`；D-6 的 `artifactRefs` 只有 `{ref,absPath,exists,bytes,verifiedAt}` | `code-loop` 的 `verifyDeclaredArtifacts` **不输出** `sha256`；`single` 保留旧字段（不改旧测试） | **已处置**：§2.8 两套函数并存 |

---

> 本文与 `requirement.md` **v15** 的关系：不增删范围、不改 AC、不改文案；§8 的 X1~X3（`rev`、`escalations[].defects[]`、`counters.dispatchCount`）已由需求 v15 回补并并入 D-6，本文只负责把契约与样例同步到 v15；X4~X9 保持本文处置。事件行分流（`code-loop` 加 `[#seq]` + 中文原因 / `single` 保持 I1.1 / `rejected` 两模板都不加 seq）、`failed→escalated` 门控、AC-45 的「整轮第 3 次派发」序数、D-6 字段冻结表述均按 v15 对齐。
