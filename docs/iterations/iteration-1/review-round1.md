# I1.1 实现评审（第 1 轮）

> 评审人：独立评审子 Agent ｜ 范围：WP-1~WP-5 已落地代码 ｜ 基准：requirement.md v5

## 0. 总判

**结论：需修复后验收（阻断 7 项）**

阻断项：7 ｜ 建议项：12

**评审快照**：2026-11-04 22:18（本地）。评审期间 `src/core/orchestrator.js`（22:15:16）、`src/daemon/server.js`（22:15:31）、`src/daemon/serve-entry.js`（22:15:24）、`src/adapter/factory.js`（22:16:16）正在被并行修改，本报告只对上述 mtime 之后的状态负责；文中所有"能过/会挂"均以该快照实测为准。

**复核方式（均已实跑，非印象）**

| 用途 | 命令 |
|---|---|
| 全量契约测试 | `node --test "test/**/*.test.js"` → **143 pass / 0 fail** |
| 真实核心 + mock 宿主端到端 | 自建脚本经 `createClient` → `run.start` / `run.wait` / `instance.get` / `core.stop`（临时项目根 + `.orch/hosts/dsh.json` 指向 `test/fixtures/mock-acp-agent.js`） |
| 状态机/编排单点 | 直接 `createStore` + `createEventBus` + `createOrchestrator`（假 adapterFactory） |
| 双核心竞态 | 起核心 A → 跑任务 → 再起 `serve-entry.js` 同项目 → 观察 A 的实例状态 |

**先给结论性事实**（后面各条引用）：`run.start` 早返回已生效（mock 宿主下 402 ms 返回，`type=task`）；一次完整成功运行产出 14 条事件，字段 `object/objectId/from/to/result/reason/seq/ts/gen` **14/14 齐全**；核心在 CLI 退出后存活（同 pid 热重连）。

---

## 1. 阻断项（必须修，否则 AC 必挂）

| ID | 对应 AC/BR | 现象（引用文件:行） | 为什么会导致验收失败 | 期望行为 |
|---|---|---|---|---|
| **B-1** | AC-17、BR-14 | `waiting_input` **全仓无产生路径**：`src/adapter/session-state.js:185-189` 定义了 `onWaitingInput`，但 `src` 内没有任何调用点（`grep onWaitingInput` 只命中定义与导出）；`src/core/orchestrator.js:479-485` 明确写"审批应答由适配器承担，核心不订阅"，而 `src/adapter/acp-client.js:154-157` 在无 handler 时直接 `allow-once` 自动应答。实测 `--permission=ask` 全轮事件只有 `thinking → tool_running → waiting_dependency`，**从未出现 `waiting_input`** | AC-17 的第一条 Then 是"会话行显示「等待审批：」加上被审批的动作名"。该状态在实现里根本不可能出现，AC-17 必挂；连带 AC-18 的"停在哪一步"无数据来源 | 适配器在 `session/request_permission` 到达时（应答前）把 `waiting_input` + 动作名（`toolCall.title`，缺省 `toolCallId`）抛给编排层，落一条 `session → waiting_input` 事件；节点保持 `running`（BR-03） |
| **B-2** | AC-12、BR-11、NFR-03 | **监听归属检查之前就跑了启动对账**：`src/daemon/server.js:231` 先 `await reconcileOnBoot()`，`:236` 才 `listenOnce()`。同项目第二个核心（客户端并发自动拉起、或手工再起）在拿到 `EADDRINUSE` 之前，已经用自己的新 `generation` 把**第一个核心正在跑的实例**判成 `已中断`。实测（真实产品路径）：实例 `running` 时起第二个核心 → 事件写入 `8 instance running->interrupted applied/core.gone`，随后第一个核心照常跑完 | 第二个进程最终以 `CORE_ALREADY_RUNNING` 退出，但它留在磁盘上的 `interrupted` 是真的。AC-12 的"已中断"因此可能是**误报**，"状态变化 1 秒内反映、错标 0 次"（指标 3 / NFR-03）不成立；并行拉起是 `client.connect` 的常规路径，不是极端情况 | 先决定"我是否拥有这条管道"，再对账：`listen()` 成功（或 `probeAlive()` 判定无人占用）之后才允许 `reconcileOnBoot`；`CORE_ALREADY_RUNNING` 分支必须**零副作用** |
| **B-3** | BR-10、AC-26、AC-12 | **状态机只校验内存副本，落盘态被绕过**：`src/core/orchestrator.js:163-186`（`applyTo`）只读 `holder.state`，`finishRun` 全程用 `ctx.state` 内存对象（`:645`、`:692`、`:729`），从不 `store.load` 复核。上条 B-2 触发的实测事件序列为 `8 instance running->interrupted` → `14 instance running->completed`：**磁盘上的实例已从 `running` 变成 `interrupted`（终态），却又被写成 `completed`，而 `interrupted → completed` 在迁移表里是非法边，核心没有拒绝、也没有留"拒绝的迁移"** | ① 事件记录自相矛盾（同一实例先中断后完成，中间没有任何合法回边）；② AC-26 的"表外迁移一律拒绝"只对 `attempt-transition.mjs` 那条直连路径成立，产品运行期可以写出表外迁移；③ AC-12 的"已中断"会被后续一次 `save` 覆盖，重启后看到的是 `completed`，等于**偷偷把中断翻成成功** | 每次迁移前以落盘快照为 `from` 重新校验（或在 `save` 时做乐观并发校验：`from` 与磁盘不一致即 `rejected` 并留事件）；内存态与磁盘态分叉时不允许静默覆盖 |
| **B-4** | AC-21（显示面）、BR-12、BR-14、NFR-03 | **失败路径不收敛会话状态**：`src/core/orchestrator.js:735-775`（`finishPromptError`）与 `:720-733`（核对失败）只推节点/实例/交接包，**从不改 `session.state`**；对比取消路径 `:982-1000` 有显式 `→ idle`。实测 `--host-error`：`实例 failed / 节点 failed / 会话 thinking / 交接包 rejected` | 用户在 `orch status` 里会看到"实例 失败、节点 失败、会话 执行中"三行互相打架；BR-12 要"看得出停在哪一步"，结果是会话看起来还在干活。验收记录里这一行会被当成缺陷；连续 10 次任务里出现假"执行中"，NFR-03 的"0 次错乱"无法自证 | 失败收尾统一走"会话 → `idle`（或 `waiting_dependency`）"并落事件，与取消路径同构；`thinking` 不得跨到终态之后 |
| **B-5** | AC-15、BR-05 | **AC-15 是自证，产品无此窗口，夹具开关是死的**：① `test/fixtures/mock-acp-agent.js:107` 解析了 `--hold-session` 但全文件**再未读取**该字段（`grep holdSession` 只有赋值行）；② `test/fixtures/probe-adapter.mjs:115-123` 的 `session.state` 是**夹具自己写死的 `'idle'`**，不投递时当然还是 `idle`，不经过产品任何判定；③ 产品侧 `src/core/orchestrator.js:456-471` 在"建会话"同一拍就把会话置 `thinking` 并落事件，**不存在"已建好、未接任务"的可观测窗口** | AC-15 的验证面就是夹具。当前写法无论产品把默认状态写成什么都会"通过"，属于假证据；需求 2.3 表里"空闲（仅夹具可停在此时刻）"这条能力事实上没有交付。需求 3.3 把 `--hold-session` 列为支撑 AC-15/16 的开关，而它无效 | `--hold-session` 必须真的改变行为（建会话后挂住、不响应 prompt）；探针必须读**归一化器的输出**（`normalizer.getSession(id).state`）而不是自己写的字面量；产品要给出"会话已建、任务未投递"的窗口（哪怕由核心显式 `idle → thinking` 落后于 `session/new` 一拍） |
| **B-6** | AC-20、BR-13 | **`--session-missing` 语义写错，AC-20 无构造路径**：`test/fixtures/mock-acp-agent.js:222` 的判据是 `!session \|\| (opts.sessionMissing && session.closed)`，而 `closed` 字段**从未被置 true**——`:399-405` 的 `session/close` 直接 `sessions.delete()`。实测带 `--session-missing` 走完整一轮仍然是 `end_turn`（`promptError: null`） | AC-20 要求"向一个已关闭或不存在的会话投递 → 会话已失效"。当前实现只有"天生的未知 sessionId"才返回 `-32602`，而产品永远只用自己刚建的 id，所以夹具**造不出**该场景，AC-20 只能是伪过或被迫跳过 | 夹具提供"第 N 次 prompt 前把会话丢弃/回 `-32602 unknown session`"的确定行为（例如 `--session-missing` 在首轮 prompt 时即删表并回错），并有一条脚本真的把它投给核心 |
| **B-7** | AC-18、BR-12、BR-14 | **审批被拒时"步骤"恒为 null**：`src/core/orchestrator.js:628-635` 用 `state.session?.toolName` 填 `params.step`，但 `waiting_input` 永不产生（B-1），且 `handleUpdate:556-560` 在非 `tool_running` 时把 `toolName` 置空；`test/fixtures/mock-acp-agent.js:272-276` 的 `deny` 分支**根本不发 `session/request_permission`**，发完 `agent_thought_chunk` 直接回 `stopReason: refusal`。实测终态 `params.step = null`，`node.failure.message = "PERMISSION_DENIED"` | AC-18 要求"我看到「审批被拒绝」**以及停在哪一步**"。渲染 `审批被拒绝，任务中止于 <null>`（标签模板 `src/cli/labels.js:50`）直接违反逐字口径；同时"审批"这一前提（停在一个需要放行的动作上）在夹具里没有被构造出来 | 审批请求到达时把 `toolCall.title`（真实 DSH 下是 `write`/`pwsh` 之类）记进会话与 `params.step`；`--permission=deny` 必须先发 `request_permission` 再按客户端拒绝收尾，而不是直接 `refusal` |

---

## 2. 建议项（不阻断，但会留技术债）

| ID | 位置 | 现状 | 建议 |
|---|---|---|---|
| S-1 | `src/daemon/server.js:182-190` | `instance.get` 只回 `code/params`，把 `getStatus` 返回的 `backupPath` 丢掉 | 透出 `backupPath`，否则 AC-13 的"被告知备份到了哪个文件"只剩一句固定文案 |
| S-2 | `src/core/verify-artifact.js:26-30,73-91` | 声明产出靠"含分隔符或含字母扩展名"猜 token，实测 `用 Node.js 写一段说明，保存到 out/intro.md` → `["out/intro.md","Node.js"]` | 句子里任何英文带点词都会变成"声明产出"，随后必然 `MISSING` 判失败。建议只在引导词（保存到/写入/…）之后取路径，裸 token 仅接受以 `/` 分段的形式 |
| S-3 | `src/core/orchestrator.js:720-733` | 核对失败时交接包停在 `delivered`（若首帧 turn 事件没到）或 `accepted`（正常），终态实例挂着非终态交接包 | 明确"核对未通过"的交接包去向（`rejected` 或带 `note`），别让"已接受"挂在失败实例上 |
| S-4 | `src/core/state-machine.js:157-165`、`src/core/orchestrator.js:182-185` | `emit` 返回 `{ok:false}`（落盘失败）时 `apply`/`applyTo` 仍返回成功并推进内存态 | BR-10 的"事件必落盘"在 I/O 故障下被静默破坏；建议 `applyTo` 检查 `bus.emit` 结果，失败即阻断迁移 |
| S-5 | `src/core/orchestrator.js:1157-1168` | `created` 实例在重启对账时先补一条 `created → running` 再判 `interrupted` | 事件里会凭空出现"没跑过却运行过"。建议 `created` 直接判 `已中断`（或按需求补 `created → interrupted` 的正式口径） |
| S-6 | `src/core/orchestrator.js:672-681`、`:1180-1181` | `verification.skipped` 的 `detail.note` 是中文，`node.note` 是英文，两处都进了 core | 与 §1.5「中文只在 `cli/labels.js`」冲突；note 建议存机器码（如 `stopped_at: {node, session}`）由渲染层拼中文 |
| S-7 | `src/adapter/factory.js:56-106` | 从不调用 `probeDshInstalled`，§1.7 的"启动前校验 exe 与 bin 都存在"未生效 | 拉起前探一次，把"未找到 C:\…\bin.js"作为 `DSH_SPAWN_FAILED.cause`，而不是让 spawn 的 errno 顶上来 |
| S-8 | `src/core/orchestrator.js:1003-1015` | `cancel` 在 `review` 阶段：节点表没有 `review → cancelled`，会落一条 `result:rejected` 事件，节点停在 `待校验` 而实例已 `cancelled` | 明确"校验中取消"的口径（需求 2.4 表确实没有这条边），至少不要让节点成为孤儿 |
| S-9 | `src/persistence/instance-store.js:204-206` | `list()`（读操作）会调用 `markCorrupt` 写 `state.json.corrupt`；而 `allocateInstanceId`（`orchestrator:218-230`）每次 run 都调用 `list()` | 读路径带写副作用，任何 `orch run` 都可能给别的实例生成备份文件。建议只在 `load`/显式 `markCorrupt` 时写 |
| S-10 | `src/core/orchestrator.js:894-895` | `reserved.add(allocated)` 在 `'@allocate'` 锁释放之后执行 | 当前靠微任务顺序成立（5 并发实测无撞号），但语义脆弱。建议把"分配 + 占位"放进同一临界区 |
| S-11 | `src/adapter/handoff-tracker.js:78-96` | `apply()` 先改 `state` 再 `emit`，`emit` 异常被吞 | 与 S-4 同源：状态推进与证据落地不是原子的 |
| S-12 | `src/daemon/server.js:585-602` | `drainStream` 是死代码（`startRun` 不返回 `stream`），契约 §2.12 的 `stream` 字段实际不存在 | 要么补 `stream`，要么把 §2.12 的签名改成 `run.start` + `run.wait`，别让契约与实现两套口径 |

---

## 3. 逐条 AC 预判

> 验证面按需求原文标注。`能过` = 本轮已用产品代码路径实测通过；`待验` = 缺 CLI/显示层或缺少可构造环境，实现侧未见缺陷；`会挂` = 有确定性缺陷。

| AC | 验证面 | 预判 | 依据 |
|---|---|---|---|
| AC-01 | 产品命令 | 待验 | 核心侧全链路已实测：`run.start` 402 ms 返回（mock 宿主）、产物落盘、`run.wait` 到 `completed`；缺 `main.js`/`render.js`/`bin/orch.js`，6 行输出无法产生 |
| AC-02 | 产品命令 | 待验 | `instance.get`/`instance.list` 走 IPC 已实测；`client.js` 不读 `state.json`（单一写者成立）；缺 CLI |
| AC-03 | 产品命令 | 待验 | `snapshot.elapsedMs`、`snapshot.sessionIdleMs` 已计算（`orchestrator:1063-1088`）；缺渲染与二次查询对比 |
| AC-04 | 产品命令 | 能过 | 事件序列 `handoff created→delivered→accepted→consumed`，时间戳 `49.219 → .231 → .234 → .664`，严格递增 |
| AC-05 | 产品命令 | 能过 | `acceptedAt 49.234 < consumedAt 49.664`；两者之间 `10 node running->review`、`11 node review->done`，节点确实经过"待校验" |
| AC-06 | 产品命令 | 能过 | 事件 `node running→review`（seq 10）→`review→done`（seq 11）；会话在提交后为 `waiting_dependency`（seq 9），不是"已完成" |
| AC-07 | 产品命令 | 能过 | 同实例并发第二次发起 → `NODE_BUSY`，`newSession` 计数 = 1，原运行状态未被改写（实测） |
| AC-08 | 产品命令 | 能过 | 被拒请求不落任何状态写入，原实例继续 `running` 直至 `completed` |
| AC-09 | 产品命令 | 能过 | 适配器 create 抛错时 `store.list()` 为空、连 `.orch/instances/` 都不创建、无 `state.json`、无事件 |
| AC-10 | 产品命令 | 待验 | `claimRun:297-308` 有 `realpath` + `W_OK` 前置校验，失败不建实例；Windows 下"不可写目录"难以稳定构造，且 `fs.access(W_OK)` 对目录的语义偏弱 |
| AC-11 | 产品命令 | 能过 | `cancel` 实测 11 ms 收敛：会话 `idle`、节点 `cancelled`、交接包 `rejected(withdrawn)`，三者均落盘 |
| AC-12 | 产品命令 | 能过 | `core stop` 实测：实例 `interrupted`、`reason=core.stop`、节点/会话保持原值并附 note；重启后 `instance.get` 仍为 `interrupted`，无重跑。**但见 B-2/B-3：并发多核心会污染该结论** |
| AC-13 | 产品命令 | 能过 | 实测：`state.json` 原字节完全一致、生成 `state.json.corrupt`、`save` 返回 `STORE_WRITE_BLOCKED_CORRUPT`、`list` 仍以 `readable:false` 可见；`backupPath` 在 IPC 层被丢（S-1） |
| AC-14 | 产品命令 | 能过 | 14 条事件全部含 `object/objectId/from/to/result/reason/seq/ts/gen`，`seq` 从 1 单调递增；显示层缺失不影响数据可追溯 |
| AC-15 | 夹具 | **会挂** | B-5：`--hold-session` 死开关；探针断言的是自己写死的 `'idle'`；产品无"已建会话未投递"窗口 |
| AC-16 | 夹具 | 能过 | 实测 `--slow-tool write --turn-delay-ms 300` → `state=tool_running, toolName="write"`（取自 `tool_call.title`） |
| AC-17 | 夹具 | **会挂** | B-1：`waiting_input` 无产生路径；实测 `--permission=ask` 全程无该状态 |
| AC-18 | 夹具 | **会挂** | B-7：`step=null`；且 deny 夹具不构造"待放行动作"。交接包 `rejected(permission_denied)` 与节点 `failed` 两项是好的 |
| AC-19 | 夹具 | 能过 | 实测：首条噪声（`usage_update`）到达时交接包仍 `delivered`，首个 turn 内事件才 `accepted`（`acceptedSignal=agent_thought_chunk`） |
| AC-20 | 夹具 | **会挂** | B-6：`--session-missing` 对已存在会话无效，实测仍 `end_turn`；产品无"已关闭会话"入口 |
| AC-21 | 夹具 | 能过 | `--host-error` → 节点 `failed`、实例 `failed`、交接包 `rejected(target_rejected)`，`node.failure.message` 与宿主原文逐字一致；**但会话停在 `thinking`（B-4）** |
| AC-22 | 夹具 | 能过 | `--unknown-error` → `UNKNOWN_ERROR`，原文 `mock-host: E_QUASAR_7719 unrecognized failure token` 未改写未截断 |
| AC-23 | 夹具 | 待验 | 无 TTL、无静默判失败（已核）；"无新事件 + 已等待"只有 `snapshot.sessionStalled/sessionIdleMs`，渲染层缺失；`--turn-delay-ms` 的静默期落在 `tool_running` 而非 `thinking` |
| AC-24 | 夹具 | 能过 | `--accept-delay-ms 1500` 实测中途为 `running/running/thinking/delivered`，无 `expired`、节点未失败，最终正常完成 |
| AC-25 | 夹具 | 待验 | 结构上成立（`handleUpdate` 按 `sessionId` 过滤 + 每 run 新建 normalizer），但**没有脚本**构造"上一任务收尾帧到达 + 第二个会话"，属未真验 |
| AC-26 | 夹具 | 能过 | `attempt-transition.mjs` 实测：`ILLEGAL_TRANSITION`，同 `events.jsonl` 追加 `{"object":"node","from":"done","to":"running","result":"rejected","reason":"illegal_transition"}`，字段齐全；**产品运行期仍可能写出表外迁移（B-3）** |

---

## 4. 逐条 BR 预判

| BR | 预判 | 依据 |
|---|---|---|
| BR-01 | 能过 | 同实例并发第二次 → `NODE_BUSY`，只建 1 个会话；自动分配路径 5 并发得 5 个不同实例号（非违规，属不同实例），无撞号 |
| BR-02 | 能过 | `accepted`(seq 6) 之后节点仍是 `running`→`review`，直到核对通过才 `done`(seq 11) 与 `consumed`(seq 12) |
| BR-03 | 能过 | 会话 `tool_running` 期间节点保持 `running`；`waiting_input` 虽不存在，但"不改变节点"这条成立 |
| BR-04 | 待验 | 未投递就不会有会话（新建会话与投递同拍），"十分钟后仍空闲"没有可观测面 |
| BR-05 | **会挂** | 同 AC-15：产品无"建好未接任务"的 `idle` 窗口，夹具为自证 |
| BR-06 | 能过 | 取消后三对象全部终态，交接包 `withdrawn`，无中间态残留（实测 11 ms） |
| BR-07 | 待验 | 每 run 新建 normalizer + 按 `sessionId` 过滤，原理上不会串；缺 AC-25 那条脚本 |
| BR-08 | 能过 | 无 TTL、无超时判定（`handoff-tracker.js` 无定时器）；`--accept-delay` 期间保持 `delivered` 并给出 `handoffWaitMs` |
| BR-09 | 能过 | 事件里节点先 `review` 再 `done`，`consumed` 在核对通过之后 |
| BR-10 | 能过（有边角） | 14/14 事件七要素齐全；边角见 S-4/S-11（落盘失败时仍推进内存态） |
| BR-11 | 能过（有污染风险） | `reconcileOnBoot` 只判 `已中断`、不重跑不重连（实测重启后 `running` 节点原样保留）；但 B-2 会误判 |
| BR-12 | 能过（部分） | 宿主原文逐字保留（HOST/UNKNOWN 实测）；"出错步骤"仅 `toolName`，审批场景为 null（B-7） |
| BR-13 | 能过 | 9 条文案键与 2.6 逐字一致，`-32602` 按 message 分流，`-32002/-32603/未登记` 各归其位 |
| BR-14 | 部分 | 工具名可显示（`write`）；审批动作名不可得（B-1/B-7） |
| BR-15 | 能过 | 噪声帧不推进 `accepted`（实测首噪声时仍 `delivered`），未知判别值也不当进展 |
| BR-16 | 能过 | 损坏时复制不重命名、原文件字节不变、`save` 被阻断、实例仍以不可读形式可见 |

---

## 5. 与需求/契约的偏离清单

| # | 偏离 | 依据 | 影响 |
|---|---|---|---|
| 1 | `startRun` 不再返回 `stream`，改用 `run.wait` 拉终态；`server.drainStream` 成为死代码 | 拆分 §2.12 冻结签名 `{ok,instanceId,nodeId,sessionId,stream}` | WP-6 不能再按 `stream` 写；契约需回写，否则验收对不上文档 |
| 2 | 启动对账发生在"确认自己拥有管道"之前 | 拆分 §1.3（第二核心应"正常退出"） | 见 B-2：退出前已污染别人正在跑的实例 |
| 3 | 失败收尾不把会话拉回非"执行中" | 需求 2.3 边界说明只写了"取消或关闭后…回到空闲" | 见 B-4：失败实例配"会话 执行中"，用户可见矛盾 |
| 4 | `waiting_input` 只有定义与映射，没有产生路径 | 需求 2.3 表要求"等待审批（仅夹具）"可观测；拆分 §2.7 要求核心显式调用 | 见 B-1：AC-17 必挂 |
| 5 | `--hold-session` 解析后无任何行为 | 需求 3.3 夹具表；拆分 §1.9 开关表 | 见 B-5：AC-15 只能自证 |
| 6 | `--session-missing` 只在"会话已被 close 且 `closed=true`"时生效，而该字段永不置真 | 需求 3.3；拆分 §1.9 | 见 B-6：AC-20 不可构造 |
| 7 | `--turn-delay-ms` 的静默发生在 `tool_call_update(in_progress)` 之后，不是"整轮不发帧" | 拆分 §1.9 表"单轮耗时（期间不发任何帧）" | 静默期状态是 `tool_running` 而非 `thinking`，AC-23 的叙述与实测状态不同 |
| 8 | `--illegal-transition` 从 mock agent 移到 `attempt-transition.mjs` | 需求 3.3 表 vs 拆分 §8 X7（已登记改派） | 已登记，不算新偏离；但验收记录必须写明改派理由 |
| 9 | 中文进入 core（`verification.skipped` 的 `detail.note`） | 拆分 §1.5「中文只在 `cli/labels.js`」 | 两层语言来源，后续 i18n/断言会漂移 |
| 10 | 重启对账对 `created` 实例补写一条 `created → running` | 需求 2.2 迁移表（`created→running` 合法，但此处并不存在"运行过"的事实） | 事件记录出现凭空一步，影响复盘可信度 |
| 11 | 读路径 `store.list()` 会写 `state.json.corrupt` | 拆分 §2.11 只把"复制备份"挂在 `load`/`markCorrupt` | 备份文件可能由无关命令产生，AC-13 的时间点不可控 |
| 12 | 新增第 10 条错误文案 `INSTANCE_TERMINAL`（`实例已结束（{state}），本迭代不支持重跑`） | 需求 2.6 只有 9 条；拆分 §2.9 只列 9 条 + `STATE_CORRUPT` | 超出需求文案表；若 CLI 展示它，属于未登记的用户可见文案（对应 X4 的待确认项） |
| 13 | `probeDshInstalled` 从未被装配链调用 | 拆分 §1.7「启动前校验：exe 与 bin 都存在」 | 真实宿主安装不全时，报错来自 spawn errno 而不是明确的"未找到 <path>" |
